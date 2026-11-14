import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { banco } from '@/servidor/banco/cliente';
import { cabecalhosSeguros, FalhaApi } from './http';
import { cookieSessao, origemStudoo } from './origem';
import { criarSessao, hashToken } from './sessao';
import { consumirLimite, emailPermitido, iguais } from './seguranca';
import { normalizarEmail } from './credenciais';

const aleatorio = () => randomBytes(32).toString('base64url');
const formatoToken = /^[A-Za-z0-9_-]{43}$/;
const chavesGoogle = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), { timeoutDuration: 5000 });
export const desafioPkce = (valor: string) => createHash('sha256').update(valor).digest('base64url');

export function configuracaoGoogle() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const segredo = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const origem = origemStudoo();
  return id && segredo && origem ? { id, segredo, retorno: `${origem}/api/auth/google/retorno` } : null;
}
function retornoMobile() {
  const retorno = process.env.STUDOO_GOOGLE_MOBILE_REDIRECT_URI ?? 'studoo-dev://auth/google';
  try {
    const url = new URL(retorno);
    if (/^studoo(?:-[a-z0-9-]+)?:$/.test(url.protocol)
      && url.host === 'auth' && url.pathname === '/google' && !url.search && !url.hash && !url.username && !url.password) return url;
  } catch { /* configuração inválida */ }
  throw new FalhaApi('google_indisponivel');
}
function cookieGoogle(valor: string, idade = 600) {
  const seguro = origemStudoo()?.startsWith('https:');
  return `${seguro ? '__Host-' : ''}studoo-google=${valor}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${idade}${seguro ? '; Secure' : ''}`;
}
function lerNavegador(request: Request) {
  const nome = `${origemStudoo()?.startsWith('https:') ? '__Host-' : ''}studoo-google=`;
  return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith(nome))?.slice(nome.length) ?? '';
}
function redirecionar(url: URL | string, cookie?: string) {
  return new Response(null, { status: 303, headers: { ...cabecalhosSeguros, Location: String(url), ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}
export async function iniciarGoogle(request: Request) {
  const config = configuracaoGoogle();
  if (!config) return redirecionar(new URL('/login?erro=google_indisponivel', origemStudoo()!));
  const params = new URL(request.url).searchParams;
  const mobile = params.get('mobile') === '1';
  const desafioMobile = mobile ? params.get('desafio') : null;
  if (mobile) {
    if (process.env.STUDOO_SESSAO_MOBILE_PILOTO !== '1' || !origemStudoo()?.startsWith('https:')) throw new FalhaApi('google_indisponivel');
    if (!desafioMobile || !formatoToken.test(desafioMobile)) throw new FalhaApi('invalido');
    retornoMobile();
  }
  const estado = aleatorio(); const navegador = aleatorio(); const nonce = aleatorio(); const verificador = aleatorio();
  const permitido = await banco.$transaction(async tx => {
    if (!await consumirLimite(tx, 'google-iniciar-global', 120, 60_000)) return false;
    await tx.autorizacaoGoogle.deleteMany({ where: { expiraEm: { lte: new Date() } } });
    await tx.codigoGoogleMobile.deleteMany({ where: { expiraEm: { lte: new Date() } } });
    await tx.autorizacaoGoogle.create({ data: {
      estadoHash: hashToken(estado), navegadorHash: hashToken(navegador), nonce, verificador, desafioMobile,
      expiraEm: new Date(Date.now() + 600_000),
    } });
    return true;
  });
  if (!permitido) throw new FalhaApi('limite_login');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.id, redirect_uri: config.retorno, response_type: 'code',
    scope: 'openid email', state: estado, nonce, code_challenge: desafioPkce(verificador), code_challenge_method: 'S256', prompt: 'select_account' }).toString();
  return redirecionar(url, cookieGoogle(navegador));
}

export async function verificarTokenGoogle(token: string, nonce: string, chaves: JWTVerifyGetKey = chavesGoogle) {
  const config = configuracaoGoogle();
  if (!config) throw new FalhaApi('google_indisponivel');
  const { payload } = await jwtVerify(token, chaves, {
    algorithms: ['RS256'], issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: config.id,
    maxTokenAge: '10m', requiredClaims: ['sub', 'email', 'email_verified', 'nonce', 'iat', 'exp'],
  });
  const email = normalizarEmail(payload.email);
  if (!email || payload.email_verified !== true || !payload.sub || payload.sub.length > 255
    || typeof payload.nonce !== 'string' || !iguais(payload.nonce, nonce)) throw new FalhaApi('google_invalido');
  return { sub: payload.sub, email };
}
async function trocarGoogle(codigo: string, verificador: string, nonce: string) {
  const config = configuracaoGoogle();
  if (!config) throw new FalhaApi('google_indisponivel');
  const resposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: codigo, client_id: config.id, client_secret: config.segredo,
      redirect_uri: config.retorno, grant_type: 'authorization_code', code_verifier: verificador }),
  });
  if (!resposta.ok) throw new FalhaApi('google_invalido');
  const corpo = await resposta.json();
  if (typeof corpo.id_token !== 'string') throw new FalhaApi('google_invalido');
  return verificarTokenGoogle(corpo.id_token, nonce);
}

/** O provedor pode ser substituído somente por testes no servidor, nunca por parâmetros HTTP. */
export async function retornarGoogle(request: Request, provedor = trocarGoogle) {
  let destinoMobile: URL | null = null;
  try {
    const params = new URL(request.url).searchParams;
    const estado = params.get('state') ?? ''; const navegador = lerNavegador(request);
    if (!formatoToken.test(estado) || !formatoToken.test(navegador)) throw new FalhaApi('google_invalido');
    const where = { estadoHash: hashToken(estado), navegadorHash: hashToken(navegador), expiraEm: { gt: new Date() } };
    const autorizacao = await banco.autorizacaoGoogle.findFirst({ where });
    if (!autorizacao || !(await banco.autorizacaoGoogle.deleteMany({ where })).count) throw new FalhaApi('google_invalido');
    if (autorizacao.desafioMobile) destinoMobile = retornoMobile();
    const codigo = params.get('code');
    if (params.has('error') || !codigo || codigo.length > 4096) throw new FalhaApi('google_invalido');
    const identidade = await provedor(codigo, autorizacao.verificador, autorizacao.nonce);
    if (!emailPermitido(identidade.email)) throw new FalhaApi('google_invalido');
    const resultado = await banco.$transaction(async tx => {
      const chave = hashToken(`google\0${identidade.sub}`);
      await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0::bigint))`;
      let usuario = await tx.usuario.findUnique({ where: { googleSub: identidade.sub } });
      const existente = await tx.usuario.findUnique({ where: { email: identidade.email } });
      // Não vincula automaticamente uma identidade Google a uma conta com senha só pelo e-mail.
      if (existente && existente.id !== usuario?.id) throw new FalhaApi('google_conta_existente');
      if (!usuario) usuario = await tx.usuario.create({ data: { email: identidade.email, googleSub: identidade.sub, fuso: 'America/Sao_Paulo' } });
      else if (usuario.email !== identidade.email) {
        await tx.recuperacaoSenha.deleteMany({ where: { usuarioId: usuario.id } });
        usuario = await tx.usuario.update({ where: { id: usuario.id }, data: { email: identidade.email } });
      }
      if (autorizacao.desafioMobile) {
        const codigo = aleatorio();
        await tx.codigoGoogleMobile.create({ data: { codigoHash: hashToken(codigo), usuarioId: usuario.id,
          desafio: autorizacao.desafioMobile, expiraEm: new Date(Date.now() + 120_000) } });
        return { mobile: true as const, codigo };
      }
      return { mobile: false as const, ...await criarSessao(usuario.id, 'WEB', tx) };
    });
    if (resultado.mobile) {
      destinoMobile!.searchParams.set('codigo', resultado.codigo);
      return redirecionar(destinoMobile!, cookieGoogle('', 0));
    }
    const resposta = redirecionar(new URL('/', origemStudoo()!), cookieGoogle('', 0));
    resposta.headers.append('Set-Cookie', cookieSessao(resultado.token));
    return resposta;
  } catch (erro) {
    const codigo = erro instanceof FalhaApi ? erro.codigo : 'google_invalido';
    const url = destinoMobile ?? new URL('/login', origemStudoo()!);
    url.searchParams.set('erro', codigo);
    return redirecionar(url, cookieGoogle('', 0));
  }
}
export async function trocarCodigoMobile(codigo: unknown, verificador: unknown) {
  if (typeof codigo !== 'string' || !formatoToken.test(codigo) || typeof verificador !== 'string'
    || !/^[A-Za-z0-9._~-]{43,128}$/.test(verificador)) throw new FalhaApi('google_invalido');
  return banco.$transaction(async tx => {
    const where = { codigoHash: hashToken(codigo), desafio: desafioPkce(verificador), expiraEm: { gt: new Date() } };
    const registro = await tx.codigoGoogleMobile.findFirst({ where });
    if (!registro || !(await tx.codigoGoogleMobile.deleteMany({ where })).count) throw new FalhaApi('google_invalido');
    const sessao = await criarSessao(registro.usuarioId, 'MOBILE', tx);
    return { token: sessao.token, expiraEm: sessao.expiraEm.toISOString() };
  });
}
