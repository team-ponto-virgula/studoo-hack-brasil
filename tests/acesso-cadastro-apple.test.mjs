import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { after, beforeEach, test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { banco } from '../src/servidor/banco/cliente.ts';
import { cadastrar, pedirCodigoCadastro, cadastroAtivo } from '../src/servidor/acesso/cadastro.ts';
import { entrar, usuarioDaSessao, criarSessao } from '../src/servidor/acesso/sessao.ts';
import { solicitarRecuperacao } from '../src/servidor/acesso/recuperacao.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import {
  appleAtivo, cifrar, decifrar, emitirNonceApple, entrarApple, emailSemEmailApple, lerNotificacaoApple, revogarApple,
  sha256Hex, verificarTokenApple,
} from '../src/servidor/acesso/apple.ts';
import { excluirConta } from '../src/servidor/privacidade/conta.ts';
import { POST as codigoWeb } from '../src/app/api/cadastro/codigo/route.ts';
import { POST as cadastroWeb } from '../src/app/api/cadastro/route.ts';
import { POST as cadastroMobile } from '../src/app/api/mobile/cadastro/route.ts';
import { POST as appleMobile } from '../src/app/api/mobile/apple/route.ts';
import { POST as notificacaoApple } from '../src/app/api/auth/apple/notificacoes/route.ts';
import { POST as nonceMobile } from '../src/app/api/mobile/apple/nonce/route.ts';
import { GET as configAcesso } from '../src/app/api/auth/config/route.ts';

// Contas efêmeras; sem Resend nem Apple reais (o e-mail falso grava em .studoo-local/emails só em loopback).
const prefixo = `cad-${randomUUID()}`;
const emails = [];
const subs = [];
process.env.STUDOO_CHAVE_ASSINATURA = randomBytes(32).toString('hex');
const chaveP8 = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });

beforeEach(() => {
  process.env.STUDOO_ORIGEM = 'http://localhost:3100';
  process.env.STUDOO_DOMINIO_EMAIL = 'example.test';
  delete process.env.STUDOO_EMAILS_PERMITIDOS;
  process.env.EMAIL = 'falso';
  process.env.STUDOO_CADASTRO = '1';
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = '1';
  process.env.STUDOO_APPLE = '1';
  process.env.APPLE_TEAM_ID = 'TEAM123456';
  process.env.APPLE_KEY_ID = 'KEY1234567';
  process.env.APPLE_PRIVATE_KEY = chaveP8.replace(/\n/g, '\\n');
  process.env.APPLE_BUNDLE_IDS = 'com.studoo.mobile,com.studoo.mobile.dev';
});
after(async () => {
  const onde = { OR: [{ email: { in: emails } }, { appleSub: { in: subs } }] };
  await banco.sessao.deleteMany({ where: { usuario: onde } });
  await banco.usuario.deleteMany({ where: onde });
  for (const nome of await readdir('.studoo-local/emails').catch(() => [])) {
    const m = JSON.parse(await readFile(`.studoo-local/emails/${nome}`, 'utf8'));
    if (emails.includes(m.to)) await unlink(`.studoo-local/emails/${nome}`);
  }
  await banco.$disconnect();
});
function emailNovo() { const email = `${prefixo}-${emails.length}@example.test`; emails.push(email); return email; }
async function mensagensPara(email) {
  const lista = [];
  for (const nome of await readdir('.studoo-local/emails')) {
    const m = JSON.parse(await readFile(`.studoo-local/emails/${nome}`, 'utf8'));
    if (m.to === email) lista.push(m);
  }
  return lista;
}
async function codigoPara(email) {
  const lista = (await mensagensPara(email)).filter(m => /é: (\d{6})/.test(m.text));
  assert.equal(lista.length, 1);
  return /é: (\d{6})/.exec(lista[0].text)[1];
}
const erro = (codigo) => (e) => e.codigo === codigo;
const outro = (codigo) => (codigo === '000000' ? '000001' : '000000');

test('cadastro: código de posse, uso único, sessão na hora, senha funciona no login', async () => {
  assert.equal(cadastroAtivo(), true);
  const email = emailNovo();
  assert.deepEqual(await pedirCodigoCadastro(email, `rede-${randomUUID()}`), { enviado: true });
  const codigo = await codigoPara(email);
  const registro = await banco.verificacaoCadastro.findUnique({ where: { chave: assinatura(`cadastro-verificacao\0${email}`) } });
  assert.ok(registro && !registro.chave.includes('@') && !registro.codigoHash.includes(codigo), 'nem e-mail nem código ficam em claro');
  await assert.rejects(cadastrar(email, outro(codigo), 'senha-de-teste-1', 'WEB'), erro('codigo_invalido'));
  const sessao = await cadastrar(email, codigo, 'senha-de-teste-1', 'MOBILE');
  const usuario = await banco.usuario.findUnique({ where: { email } });
  assert.equal(await usuarioDaSessao(sessao.token, 'MOBILE'), usuario.id);
  assert.equal(usuario.googleSub, null); assert.equal(usuario.appleSub, null);
  await assert.rejects(cadastrar(email, codigo, 'senha-de-teste-1', 'WEB'), erro('codigo_invalido'));
  assert.equal((await entrar(email, 'senha-de-teste-1')).estado, 'ok');
});

test('cadastro: resposta neutra para e-mail com conta, que recebe só aviso e nunca código', async () => {
  const email = emailNovo();
  const existente = await banco.usuario.create({ data: { email, googleSub: `g-${randomUUID()}`, fuso: 'America/Sao_Paulo' } });
  assert.deepEqual(await pedirCodigoCadastro(email, `rede-${randomUUID()}`), { enviado: true });
  const recebidas = await mensagensPara(email);
  assert.equal(recebidas.length, 1);
  assert.match(recebidas[0].subject, /já tem uma conta/);
  assert.doesNotMatch(recebidas[0].text, /\d{6}/);
  // Sem código salvo: qualquer tentativa falha e a conta Google não ganha senha (sem vínculo pelo e-mail).
  await assert.rejects(cadastrar(email, '123456', 'senha-de-teste-1', 'WEB'), erro('codigo_invalido'));
  const depois = await banco.usuario.findUnique({ where: { id: existente.id } });
  assert.equal(depois.senhaHash, null);
});

test('cadastro: 5 tentativas erradas invalidam o código; limites por e-mail; domínio e flag', async () => {
  const email = emailNovo();
  const rede = `rede-${randomUUID()}`;
  await pedirCodigoCadastro(email, rede);
  const codigo = await codigoPara(email);
  for (let i = 0; i < 5; i++) await assert.rejects(cadastrar(email, outro(codigo), 'senha-de-teste-1', 'WEB'), erro('codigo_invalido'));
  await assert.rejects(cadastrar(email, codigo, 'senha-de-teste-1', 'WEB'), erro('codigo_invalido'));
  await pedirCodigoCadastro(email, rede); await pedirCodigoCadastro(email, rede);
  await assert.rejects(pedirCodigoCadastro(email, rede), erro('limite_cadastro'));
  await assert.rejects(pedirCodigoCadastro('alguem@fora.test', rede), erro('email_nao_permitido'));
  await assert.rejects(pedirCodigoCadastro('visitante+1-ab@visitante.studoo.local', rede), erro('invalido'));
  await assert.rejects(cadastrar(emailNovo(), '123456', 'curta', 'WEB'), erro('invalido'));
  process.env.STUDOO_CADASTRO = '0';
  await assert.rejects(pedirCodigoCadastro(emailNovo(), rede), erro('cadastro_indisponivel'));
  process.env.STUDOO_CADASTRO = '1'; process.env.EMAIL = 'resend'; delete process.env.RESEND_API_KEY;
  assert.equal(cadastroAtivo(), false, 'sem e-mail não há cadastro');
});

test('cadastro: limite por rede vale entre e-mails diferentes', async () => {
  const rede = `rede-${randomUUID()}`;
  for (let i = 0; i < 10; i++) await pedirCodigoCadastro(emailNovo(), rede);
  await assert.rejects(pedirCodigoCadastro(emailNovo(), rede), erro('limite_cadastro'));
});

test('rotas de cadastro: web exige mesma origem e grava cookie; app devolve sessão e recusa cookie', async () => {
  const email = emailNovo();
  const origem = process.env.STUDOO_ORIGEM;
  const json = (corpo, extra = {}) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(corpo) });
  assert.equal((await codigoWeb(new Request(`${origem}/api/cadastro/codigo`, json({ email }, { origin: 'https://malicioso.test' })))).status, 403);
  const pedido = await codigoWeb(new Request(`${origem}/api/cadastro/codigo`, json({ email }, { origin: origem })));
  assert.equal(pedido.status, 200);
  const codigo = await codigoPara(email);
  const criado = await cadastroWeb(new Request(`${origem}/api/cadastro`, json({ email, codigo, senha: 'senha-de-teste-1' }, { origin: origem })));
  assert.equal(criado.status, 201);
  assert.match(criado.headers.get('set-cookie'), /studoo-sessao=[A-Za-z0-9_-]{43}; Path=\/; HttpOnly; SameSite=Lax/);

  process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
  const mobile = await cadastroMobile(new Request('https://studoo.example.test/api/mobile/cadastro',
    json({ email: emailNovo(), codigo: '123456', senha: 'senha-de-teste-1' }, { host: 'studoo.example.test', cookie: 'a=b' })));
  assert.equal(mobile.status, 401);
  const config = await (await configAcesso(new Request('https://studoo.example.test/api/auth/config', { headers: { host: 'studoo.example.test' } }))).json();
  assert.equal(config.cadastro, false, 'e-mail falso só vale em loopback');
  assert.equal(config.apple, true);
});

test('recuperação nunca escreve para endereços internos (visitante, Apple sem e-mail)', async () => {
  const sub = `apple-${randomUUID()}`; subs.push(sub);
  const interno = emailSemEmailApple(sub);
  await banco.usuario.create({ data: { email: interno, appleSub: sub, fuso: 'America/Sao_Paulo' } });
  process.env.STUDOO_EMAILS_PERMITIDOS = interno;
  assert.deepEqual(await solicitarRecuperacao(interno), { enviado: true });
  assert.equal((await mensagensPara(interno)).length, 0);
});

// ---------------- Apple ----------------
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'apple-teste', alg: 'RS256' };
const chaves = createLocalJWKSet({ keys: [jwk] });
async function tokenApple(claims, opcoes = {}) {
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'apple-teste' })
    .setIssuer(opcoes.iss ?? 'https://appleid.apple.com').setAudience(opcoes.aud ?? 'com.studoo.mobile')
    .setIssuedAt().setExpirationTime('5m').sign(privateKey);
}
function usarHttps() { process.env.STUDOO_ORIGEM = 'https://studoo.example.test'; }
const verificar = (token, nonceHash) => verificarTokenApple(token, nonceHash, chaves);
const trocas = [];
const trocar = async (codigo, identidade) => { trocas.push({ codigo, sub: identidade.sub }); return `renovacao-${codigo}`; };

test('Apple: token validado com assinatura, emissor, público, nonce e e-mail verificado', async () => {
  usarHttps();
  const nonce = randomBytes(32).toString('base64url');
  const bom = await verificar(await tokenApple({ sub: 's1', nonce: sha256Hex(nonce), email: 'X@privaterelay.appleid.com', email_verified: 'true' }), sha256Hex(nonce));
  assert.deepEqual(bom, { sub: 's1', email: 'x@privaterelay.appleid.com', cliente: 'com.studoo.mobile' });
  const semVerificar = await verificar(await tokenApple({ sub: 's1', nonce: sha256Hex(nonce), email: 'a@example.test', email_verified: false }), sha256Hex(nonce));
  assert.equal(semVerificar.email, null);
  await assert.rejects(verificar(await tokenApple({ sub: 's1', nonce: sha256Hex('outro') }), sha256Hex(nonce)), erro('apple_invalido'));
  await assert.rejects(verificar(await tokenApple({ sub: 's1', nonce: sha256Hex(nonce) }, { aud: 'com.outro.app' }), sha256Hex(nonce)), erro('apple_invalido'));
  await assert.rejects(verificar(await tokenApple({ sub: 's1', nonce: sha256Hex(nonce) }, { iss: 'https://falso.test' }), sha256Hex(nonce)), erro('apple_invalido'));
  const alheio = (await generateKeyPair('RS256')).privateKey;
  const forjado = await new SignJWT({ sub: 's1', nonce: sha256Hex(nonce) }).setProtectedHeader({ alg: 'RS256', kid: 'apple-teste' })
    .setIssuer('https://appleid.apple.com').setAudience('com.studoo.mobile').setIssuedAt().setExpirationTime('5m').sign(alheio);
  await assert.rejects(verificar(forjado, sha256Hex(nonce)), erro('apple_invalido'));
});

test('Apple: nonce de uso único, conta criada pelo sub, mantida sem e-mail, token de renovação cifrado', async () => {
  usarHttps();
  assert.equal(appleAtivo(), true);
  const sub = `apple-${randomUUID()}`; subs.push(sub);
  const relay = `${randomUUID()}@privaterelay.appleid.com`;
  process.env.STUDOO_DOMINIO_EMAIL = '';
  const { nonce } = await emitirNonceApple(`rede-${randomUUID()}`);
  const pedido = { identityToken: await tokenApple({ sub, nonce: sha256Hex(nonce), email: relay, email_verified: true }), authorizationCode: 'code-1', nonce };
  const primeira = await entrarApple(pedido, { verificar, trocar });
  const conta = await banco.usuario.findUnique({ where: { appleSub: sub } });
  assert.equal(conta.email, relay);
  assert.equal(await usuarioDaSessao(primeira.token, 'MOBILE'), conta.id);
  assert.ok(!conta.appleRenovacao.includes('renovacao-code-1'));
  assert.equal(decifrar(conta.appleRenovacao), 'renovacao-code-1');
  assert.equal(conta.appleCliente, 'com.studoo.mobile');
  await assert.rejects(entrarApple(pedido, { verificar, trocar }), erro('apple_invalido'), 'nonce não pode ser reusado');

  // Segundo acesso sem e-mail no token: mesma conta, e-mail preservado.
  const n2 = (await emitirNonceApple(`rede-${randomUUID()}`)).nonce;
  const segunda = await entrarApple({ identityToken: await tokenApple({ sub, nonce: sha256Hex(n2) }), authorizationCode: 'code-2', nonce: n2 }, { verificar, trocar });
  const mesma = await banco.usuario.findUnique({ where: { appleSub: sub } });
  assert.equal(mesma.id, conta.id); assert.equal(mesma.email, relay);
  assert.equal(decifrar(mesma.appleRenovacao), 'renovacao-code-2');
  assert.equal(await usuarioDaSessao(segunda.token, 'MOBILE'), conta.id);
});

test('Apple: sem e-mail na primeira vez cria conta interna; e-mail de outra conta não vincula', async () => {
  usarHttps();
  process.env.STUDOO_DOMINIO_EMAIL = '';
  const sub = `apple-${randomUUID()}`; subs.push(sub);
  const n = (await emitirNonceApple(`rede-${randomUUID()}`)).nonce;
  await entrarApple({ identityToken: await tokenApple({ sub, nonce: sha256Hex(n) }), authorizationCode: 'c', nonce: n }, { verificar, trocar });
  assert.equal((await banco.usuario.findUnique({ where: { appleSub: sub } })).email, emailSemEmailApple(sub));

  const email = emailNovo();
  const comSenha = await banco.usuario.create({ data: { email, senhaHash: 'x.y', fuso: 'America/Sao_Paulo' } });
  const outroSub = `apple-${randomUUID()}`; subs.push(outroSub);
  const n2 = (await emitirNonceApple(`rede-${randomUUID()}`)).nonce;
  let revogados = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => { if (String(url).endsWith('/auth/revoke')) revogados++; return new Response('', { status: 200 }); };
  try {
    await assert.rejects(entrarApple({ identityToken: await tokenApple({ sub: outroSub, nonce: sha256Hex(n2), email, email_verified: true }), authorizationCode: 'c2', nonce: n2 },
      { verificar, trocar }), erro('apple_conta_existente'));
  } finally { globalThis.fetch = original; }
  assert.equal(revogados, 1, 'token recebido sem conta volta para a Apple');
  assert.equal((await banco.usuario.findUnique({ where: { id: comSenha.id } })).appleSub, null);
  assert.equal(await banco.usuario.findUnique({ where: { appleSub: outroSub } }), null);
});

test('Apple: domínio restrito bloqueia conta nova fora da lista; desligado responde indisponível', async () => {
  usarHttps();
  const sub = `apple-${randomUUID()}`; subs.push(sub);
  const n = (await emitirNonceApple(`rede-${randomUUID()}`)).nonce;
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 200 });
  try {
    await assert.rejects(entrarApple({ identityToken: await tokenApple({ sub, nonce: sha256Hex(n), email: 'r@privaterelay.appleid.com', email_verified: true }),
      authorizationCode: 'c', nonce: n }, { verificar, trocar }), erro('email_nao_permitido'));
  } finally { globalThis.fetch = original; }
  process.env.STUDOO_APPLE = '0';
  await assert.rejects(emitirNonceApple('x'), erro('apple_indisponivel'));
  process.env.STUDOO_APPLE = '1'; process.env.STUDOO_ORIGEM = 'http://localhost:3100';
  assert.equal(appleAtivo(), false, 'só com origem HTTPS');
});

test('Apple: rota do nonce só no canal do app; excluir conta revoga o token na Apple (TN3194)', async () => {
  usarHttps();
  const pedido = (extra = {}) => new Request('https://studoo.example.test/api/mobile/apple/nonce', { method: 'POST', headers: { host: 'studoo.example.test', ...extra } });
  assert.equal((await nonceMobile(pedido({ origin: 'https://studoo.example.test' }))).status, 403);
  const ok = await nonceMobile(pedido());
  assert.equal(ok.status, 200);
  assert.match((await ok.json()).nonce, /^[A-Za-z0-9_-]{43}$/);

  const sub = `apple-${randomUUID()}`; subs.push(sub);
  const usuario = await banco.usuario.create({ data: { email: emailSemEmailApple(sub), appleSub: sub, appleRenovacao: cifrar('rt-secreto'), appleCliente: 'com.studoo.mobile.dev', fuso: 'UTC' } });
  const sessao = await criarSessao(usuario.id, 'MOBILE');
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opcoes) => { chamadas.push({ url: String(url), corpo: new URLSearchParams(String(opcoes.body)) }); return new Response('', { status: 200 }); };
  try { await excluirConta(usuario.id, 'EXCLUIR'); } finally { globalThis.fetch = original; }
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, 'https://appleid.apple.com/auth/revoke');
  assert.equal(chamadas[0].corpo.get('token'), 'rt-secreto');
  assert.equal(chamadas[0].corpo.get('token_type_hint'), 'refresh_token');
  assert.equal(chamadas[0].corpo.get('client_id'), 'com.studoo.mobile.dev');
  assert.equal(chamadas[0].corpo.get('client_secret').split('.').length, 3);
  assert.equal(await banco.usuario.findUnique({ where: { id: usuario.id } }), null);
  assert.equal(await usuarioDaSessao(sessao.token, 'MOBILE'), null);
  // Falha da Apple não impede a exclusão nem lança.
  assert.equal(await revogarApple(cifrar('rt'), 'com.studoo.mobile', async () => new Response('', { status: 500 })), false);
});

test('Apple: sessão pelo endpoint nativo, revogação, reentrada e exclusão notificada com o login desligado', async (t) => {
  usarHttps();
  const sub = `apple-${randomUUID()}`; subs.push(sub);
  const email = emailNovo();
  const renovar = await tokenApple({ sub });
  let revogacoes = 0;
  t.mock.method(globalThis, 'fetch', async (url) => {
    switch (new URL(url).pathname) {
      case '/auth/keys': return Response.json({ keys: [jwk] });
      case '/auth/token': return Response.json({ refresh_token: 'renovacao-simulada', id_token: renovar });
      case '/auth/revoke': revogacoes++; return new Response(null, { status: 200 });
      default: throw new Error('Destino fora da simulação');
    }
  });
  const requisicao = (rota, body) => new Request(new URL(rota, process.env.STUDOO_ORIGEM), {
    method: 'POST', headers: { host: 'studoo.example.test', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const entrarNativo = async () => {
    const { nonce } = await (await nonceMobile(requisicao('/api/mobile/apple/nonce', {}))).json();
    const resp = await appleMobile(requisicao('/api/mobile/apple', {
      nonce, identityToken: await tokenApple({ nonce: sha256Hex(nonce), sub, email, email_verified: true }),
      authorizationCode: randomUUID(),
    }));
    assert.equal(resp.status, 200);
    return (await resp.json()).token;
  };
  const notificar = async type => {
    const payload = await tokenApple({ events: { type, sub, event_time: Math.floor(Date.now() / 1000) } });
    return notificacaoApple(requisicao('/api/auth/apple/notificacoes', { payload }));
  };
  const primeira = await entrarNativo();
  const id = await usuarioDaSessao(primeira, 'MOBILE');
  assert.ok(id);
  assert.equal((await notificar('consent-revoked')).status, 200);
  assert.equal(await usuarioDaSessao(primeira, 'MOBILE'), null);
  assert.equal((await banco.usuario.findUniqueOrThrow({ where: { id } })).appleRenovacao, null);
  const segunda = await entrarNativo();
  assert.equal(await usuarioDaSessao(segunda, 'MOBILE'), id);
  process.env.STUDOO_APPLE = '0';
  assert.equal(appleAtivo(), false);
  assert.equal((await notificar('account-deleted')).status, 200);
  assert.equal(await banco.usuario.findUnique({ where: { id } }), null);
  assert.equal(await usuarioDaSessao(segunda, 'MOBILE'), null);
  assert.equal(revogacoes, 1);
  assert.equal((await notificar('account-deleted')).status, 200);
});

test('Apple: notificação servidor-a-servidor só vale assinada pela Apple', async () => {
  const evento = { type: 'consent-revoked', sub: 's9', event_time: Date.now() };
  const valido = await tokenApple({ events: JSON.stringify(evento) });
  assert.deepEqual(await lerNotificacaoApple(valido, chaves), { tipo: 'consent-revoked', sub: 's9' });
  assert.equal(await lerNotificacaoApple(await tokenApple({ events: JSON.stringify(evento) }, { aud: 'com.outro' }), chaves), null);
  assert.equal(await lerNotificacaoApple('nao-e-jwt', chaves), null);
});
