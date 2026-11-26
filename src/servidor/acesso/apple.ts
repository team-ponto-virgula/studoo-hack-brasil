import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose';
import { banco } from '@/servidor/banco/cliente';
import { normalizarEmail } from './credenciais';
import { FalhaApi } from './http';
import { origemStudoo } from './origem';
import { consumirLimite, emailPermitido } from './seguranca';
import { criarSessao, hashToken } from './sessao';

/**
 * Iniciar sessão com a Apple no iPhone (App Review 4.8), seguindo a TN3194 para a exclusão:
 * nonce de uso único emitido aqui → token de identidade validado (assinatura da Apple, `iss`, `aud` = bundle do app,
 * validade e nonce) → `authorizationCode` trocado por um token de renovação, guardado cifrado → revogado na exclusão.
 * A chave privada da Apple fica só no servidor (variáveis de ambiente), nunca no app.
 */

const EMISSOR = 'https://appleid.apple.com';
const chavesApple = createRemoteJWKSet(new URL(`${EMISSOR}/auth/keys`), { timeoutDuration: 5000 });
const validadeNonceMs = 10 * 60_000;
const formatoNonce = /^[A-Za-z0-9_-]{43}$/;
const formatoId = /^[A-Z0-9]{10}$/;
const formatoBundle = /^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export const sha256Hex = (valor: string) => createHash('sha256').update(valor).digest('hex');

type ConfigApple = { equipe: string; chaveId: string; chave: string; bundles: string[] };

/**
 * Ligado com `STUDOO_APPLE=1` e as quatro variáveis: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (o .p8 em PEM,
 * quebras como `\n`) e `APPLE_BUNDLE_IDS` (bundles aceitos no `aud`, separados por vírgula). Precisa também da sessão do
 * app (`STUDOO_SESSAO_MOBILE_PILOTO=1`) e de origem HTTPS, como as outras entradas do app.
 */
export function configuracaoApple(): ConfigApple | null {
  const equipe = process.env.APPLE_TEAM_ID?.trim() ?? '';
  const chaveId = process.env.APPLE_KEY_ID?.trim() ?? '';
  const chave = (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();
  const bundles = (process.env.APPLE_BUNDLE_IDS ?? '').split(',').map(b => b.trim()).filter(b => formatoBundle.test(b));
  if (!formatoId.test(equipe) || !formatoId.test(chaveId) || !chave.includes('PRIVATE KEY') || !bundles.length) return null;
  return { equipe, chaveId, chave, bundles };
}

export function appleAtivo() {
  return process.env.STUDOO_APPLE === '1' && !!configuracaoApple() && process.env.STUDOO_SESSAO_MOBILE_PILOTO === '1' && !!origemStudoo()?.startsWith('https:');
}

function exigirConfig() {
  const config = configuracaoApple();
  if (!config || !appleAtivo()) throw new FalhaApi('apple_indisponivel');
  return config;
}

/** O `client_secret` da Apple: JWT ES256 assinado com a chave .p8, válido por 5 minutos. */
async function segredoCliente(config: ConfigApple, cliente: string) {
  const chave = await importPKCS8(config.chave, 'ES256');
  return new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: config.chaveId })
    .setIssuer(config.equipe).setIssuedAt().setExpirationTime('5m').setAudience(EMISSOR).setSubject(cliente)
    .sign(chave);
}

// Token de renovação cifrado com uma chave derivada de STUDOO_CHAVE_ASSINATURA (HKDF), nunca em texto puro no banco.
function chaveCifra() {
  const segredo = process.env.STUDOO_CHAVE_ASSINATURA ?? '';
  if (!/^(?:[a-fA-F0-9]{2}){32,}$/.test(segredo)) throw new Error('Configuração de autenticação ausente');
  return Buffer.from(hkdfSync('sha256', Buffer.from(segredo, 'hex'), Buffer.alloc(0), 'studoo-apple-renovacao-v1', 32));
}
export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chaveCifra(), iv);
  const dados = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
  return ['v1', iv.toString('base64url'), cifra.getAuthTag().toString('base64url'), dados.toString('base64url')].join('.');
}
export function decifrar(valor: string) {
  const [versao, iv, tag, dados] = valor.split('.');
  if (versao !== 'v1' || !iv || !tag || !dados) throw new Error('Formato inválido');
  const decifra = createDecipheriv('aes-256-gcm', chaveCifra(), Buffer.from(iv, 'base64url'));
  decifra.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decifra.update(Buffer.from(dados, 'base64url')), decifra.final()]).toString('utf8');
}

/** Nonce de uso único (10 min). Limites: 30 por rede a cada 10 min e 300 por minuto no total. */
export async function emitirNonceApple(rede: string) {
  exigirConfig();
  const nonce = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + validadeNonceMs);
  const permitido = await banco.$transaction(async tx => {
    if (!await consumirLimite(tx, `apple-nonce\0${rede}`, 30, validadeNonceMs)) return false;
    if (!await consumirLimite(tx, 'apple-nonce-global', 300, 60_000)) return false;
    await tx.nonceApple.deleteMany({ where: { expiraEm: { lte: new Date() } } });
    await tx.nonceApple.create({ data: { nonceHash: hashToken(nonce), expiraEm } });
    return true;
  });
  if (!permitido) throw new FalhaApi('limite_login');
  return { nonce, expiraEm: expiraEm.toISOString() };
}

export type IdentidadeApple = { sub: string; email: string | null; cliente: string };

/** Valida o token de identidade da Apple. `nonceEsperado` é o hash SHA-256 (hex) do nonce bruto. */
export async function verificarTokenApple(token: string, nonceEsperado: string | null, chaves: JWTVerifyGetKey = chavesApple): Promise<IdentidadeApple> {
  const config = configuracaoApple();
  if (!config) throw new FalhaApi('apple_indisponivel');
  let payload;
  try {
    ({ payload } = await jwtVerify(token, chaves, {
      algorithms: ['RS256'], issuer: EMISSOR, audience: config.bundles, maxTokenAge: '10m',
      requiredClaims: ['sub', 'iat', 'exp', ...(nonceEsperado ? ['nonce'] : [])],
    }));
  } catch { throw new FalhaApi('apple_invalido'); }
  if (!payload.sub || payload.sub.length > 255) throw new FalhaApi('apple_invalido');
  if (nonceEsperado !== null && payload.nonce !== nonceEsperado) throw new FalhaApi('apple_invalido');
  const cliente = typeof payload.aud === 'string' ? payload.aud : payload.aud?.[0];
  if (!cliente || !config.bundles.includes(cliente)) throw new FalhaApi('apple_invalido');
  // A Apple manda `email_verified` como booleano ou como texto. Sem verificação, o e-mail é ignorado.
  const verificado = payload.email_verified === true || payload.email_verified === 'true';
  const email = verificado ? normalizarEmail(payload.email) : null;
  return { sub: payload.sub, email, cliente };
}

/** Troca o `authorizationCode` pelo token de renovação. O id_token devolvido precisa ser da mesma pessoa. */
async function trocarCodigoApple(codigo: string, identidade: IdentidadeApple): Promise<string> {
  const config = exigirConfig();
  let corpo: Record<string, unknown>;
  try {
    const resposta = await fetch(`${EMISSOR}/auth/token`, {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: identidade.cliente, client_secret: await segredoCliente(config, identidade.cliente),
        code: codigo, grant_type: 'authorization_code' }),
    });
    if (!resposta.ok) throw new Error('recusado');
    corpo = await resposta.json() as Record<string, unknown>;
  } catch { throw new FalhaApi('apple_invalido'); }
  if (typeof corpo.refresh_token !== 'string' || typeof corpo.id_token !== 'string') throw new FalhaApi('apple_invalido');
  const confirmada = await verificarTokenApple(corpo.id_token, null);
  if (confirmada.sub !== identidade.sub || confirmada.cliente !== identidade.cliente) throw new FalhaApi('apple_invalido');
  return corpo.refresh_token;
}

type Provedores = {
  verificar?: (token: string, nonceHash: string) => Promise<IdentidadeApple>;
  trocar?: (codigo: string, identidade: IdentidadeApple) => Promise<string>;
};

/** E-mail interno de quem entrou com a Apple sem compartilhar e-mail (não recebe mensagens). */
export const emailSemEmailApple = (sub: string) => `apple+${sha256Hex(`apple\0${sub}`).slice(0, 24)}@apple.studoo.local`;

/**
 * Entrada nativa. A conta é achada pelo `sub` da Apple; o e-mail nunca vincula contas. Se o e-mail não vier (segundo
 * acesso, ou a pessoa não compartilhou), a conta existente continua a mesma. E-mail já usado por outra conta responde
 * `apple_conta_existente`. Os provedores só são trocados por testes no servidor, nunca por HTTP.
 */
export async function entrarApple(entrada: unknown, provedores: Provedores = {}) {
  exigirConfig();
  const { identityToken, authorizationCode, nonce } = (entrada ?? {}) as Record<string, unknown>;
  if (typeof identityToken !== 'string' || identityToken.length > 8192 || typeof authorizationCode !== 'string'
    || !authorizationCode || authorizationCode.length > 1024 || typeof nonce !== 'string' || !formatoNonce.test(nonce)) {
    throw new FalhaApi('invalido');
  }
  // Uso único: o nonce some antes de qualquer validação, com sucesso ou não.
  const consumido = await banco.nonceApple.deleteMany({ where: { nonceHash: hashToken(nonce), expiraEm: { gt: new Date() } } });
  if (!consumido.count) throw new FalhaApi('apple_invalido');
  const identidade = await (provedores.verificar ?? verificarTokenApple)(identityToken, sha256Hex(nonce));
  const renovacao = await (provedores.trocar ?? trocarCodigoApple)(authorizationCode, identidade);
  const renovacaoCifrada = cifrar(renovacao);

  const sessao = await banco.$transaction(async tx => {
    const chave = hashToken(`apple\0${identidade.sub}`);
    await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0::bigint))`;
    const usuario = await tx.usuario.findUnique({ where: { appleSub: identidade.sub }, select: { id: true, email: true } });
    if (usuario) {
      const data: { appleRenovacao: string; appleCliente: string; email?: string } = { appleRenovacao: renovacaoCifrada, appleCliente: identidade.cliente };
      // E-mail novo (a pessoa trocou o compartilhamento) só substitui se ninguém mais usa; senão a conta fica como está.
      if (identidade.email && identidade.email !== usuario.email && emailPermitido(identidade.email)
        && !await tx.usuario.findUnique({ where: { email: identidade.email }, select: { id: true } })) {
        data.email = identidade.email;
        await tx.recuperacaoSenha.deleteMany({ where: { usuarioId: usuario.id } });
      }
      if (!emailPermitido(data.email ?? usuario.email)) throw new FalhaApi('email_nao_permitido');
      await tx.usuario.update({ where: { id: usuario.id }, data });
      return criarSessao(usuario.id, 'MOBILE', tx);
    }
    const email = identidade.email ?? emailSemEmailApple(identidade.sub);
    if (identidade.email && await tx.usuario.findUnique({ where: { email }, select: { id: true } })) throw new FalhaApi('apple_conta_existente');
    if (!emailPermitido(email)) throw new FalhaApi('email_nao_permitido');
    const criado = await tx.usuario.create({ data: {
      email, appleSub: identidade.sub, appleRenovacao: renovacaoCifrada, appleCliente: identidade.cliente, fuso: 'America/Sao_Paulo',
      onboarding: { create: {} },
    }, select: { id: true } });
    return criarSessao(criado.id, 'MOBILE', tx, undefined, true);
  }).catch(async (erro: unknown) => {
    // Nenhuma conta ficou com o token: devolve à Apple para não deixar autorização órfã.
    await revogarApple(renovacaoCifrada, identidade.cliente);
    throw erro;
  });
  return { token: sessao.token, expiraEm: sessao.expiraEm.toISOString() };
}

/**
 * Revoga o token da Apple (TN3194), chamado na exclusão da conta. Não lança: a exclusão segue mesmo se a Apple falhar,
 * e o registro não leva token nem e-mail.
 */
export async function revogarApple(renovacaoCifrada: string | null, cliente: string | null, enviar: typeof fetch = fetch): Promise<boolean> {
  if (!renovacaoCifrada || !cliente) return false;
  const config = configuracaoApple();
  try {
    if (!config) throw new Error('sem configuração');
    const resposta = await enviar(`${EMISSOR}/auth/revoke`, {
      method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: cliente, client_secret: await segredoCliente(config, cliente),
        token: decifrar(renovacaoCifrada), token_type_hint: 'refresh_token' }),
    });
    if (!resposta.ok) throw new Error(`status ${resposta.status}`);
    return true;
  } catch {
    console.error(JSON.stringify({ rota: 'excluir-conta', codigo: 'apple_revogacao_falhou' }));
    return false;
  }
}

/**
 * Notificações servidor-a-servidor da Apple (`consent-revoked`, `account-deleted`, `email-disabled`, `email-enabled`).
 * Devolve o evento já validado (JWT assinado pela Apple, `aud` = bundle aceito) ou null.
 */
export async function lerNotificacaoApple(payload: unknown, chaves: JWTVerifyGetKey = chavesApple) {
  const config = configuracaoApple();
  if (!config || typeof payload !== 'string' || payload.length > 16_384) return null;
  try {
    const { payload: dados } = await jwtVerify(payload, chaves, { algorithms: ['RS256'], issuer: EMISSOR, audience: config.bundles });
    const evento = typeof dados.events === 'string' ? JSON.parse(dados.events) : dados.events;
    if (!evento || typeof evento.type !== 'string' || typeof evento.sub !== 'string') return null;
    return { tipo: evento.type as string, sub: evento.sub as string };
  } catch { return null; }
}
