import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readdir, readFile, unlink } from 'node:fs/promises';
import { test, beforeEach, after } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { banco } from '../src/servidor/banco/cliente.ts';
import { criarHashSenha, verificarSenha } from '../src/servidor/acesso/credenciais.ts';
import { criarSessao, usuarioDaSessao, hashToken, entrar } from '../src/servidor/acesso/sessao.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { solicitarRecuperacao, redefinirSenha } from '../src/servidor/acesso/recuperacao.ts';
import { iniciarGoogle, retornarGoogle, trocarCodigoMobile, desafioPkce, verificarTokenGoogle } from '../src/servidor/acesso/google.ts';
import { recuperacaoDisponivel } from '../src/servidor/email/recuperacao.ts';
import { POST as recuperarWeb } from '../src/app/api/senha/recuperar/route.ts';
import { POST as recuperarMobile } from '../src/app/api/mobile/senha/recuperar/route.ts';
import { POST as redefinirMobile } from '../src/app/api/mobile/senha/redefinir/route.ts';
import { POST as googleMobile } from '../src/app/api/mobile/google/route.ts';

// Só contas efêmeras, sem Google ou SMTP reais. Requer migrações aplicadas no banco de testes/local.
const prefixo = `auth-${randomUUID()}`;
const emails = [];
const estados = [];
const novaSenha = 'Uma senha de teste 2026!';
process.env.STUDOO_CHAVE_ASSINATURA = randomBytes(32).toString('hex');
beforeEach(() => {
  process.env.STUDOO_ORIGEM = 'http://localhost:3100';
  process.env.STUDOO_DOMINIO_EMAIL = 'example.test';
  process.env.EMAIL = 'falso';
  process.env.GOOGLE_CLIENT_ID = 'teste-google.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'segredo-exclusivo-de-teste';
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = '1';
  process.env.STUDOO_GOOGLE_MOBILE_REDIRECT_URI = 'studoo-dev://auth/google';
});
function emailNovo() { const email = `${prefixo}-${emails.length}@example.test`; emails.push(email); return email; }
async function conta() {
  return banco.usuario.create({ data: { email: emailNovo(), senhaHash: await criarHashSenha('senha-original'), fuso: 'America/Sao_Paulo' } });
}
async function codigoPara(email) {
  const arquivos = await readdir('.studoo-local/emails');
  const mensagens = [];
  for (const nome of arquivos) {
    const mensagem = JSON.parse(await readFile(`.studoo-local/emails/${nome}`, 'utf8'));
    if (mensagem.to === email) mensagens.push({ ...mensagem, nome });
  }
  assert.equal(mensagens.length, 1);
  return /é: (\d{6})/.exec(mensagens[0].text)[1];
}
function erro(codigo) { return e => e.codigo === codigo; }
async function autorizacao(mobile = false) {
  if (mobile) process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
  const verificador = randomBytes(32).toString('hex');
  const url = new URL('/api/auth/google/iniciar', process.env.STUDOO_ORIGEM);
  if (mobile) { url.searchParams.set('mobile', '1'); url.searchParams.set('desafio', desafioPkce(verificador)); }
  const resposta = await iniciarGoogle(new Request(url));
  assert.equal(resposta.status, 303);
  const google = new URL(resposta.headers.get('location'));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(!google.searchParams.has('client_secret'));
  const state = google.searchParams.get('state'); estados.push(hashToken(state));
  const cookie = resposta.headers.get('set-cookie').split(';')[0];
  const retorno = new URL('/api/auth/google/retorno', process.env.STUDOO_ORIGEM);
  retorno.searchParams.set('state', state); retorno.searchParams.set('code', 'codigo-google-de-teste');
  return { retorno, cookie, verificador, nonce: google.searchParams.get('nonce'), state };
}

test('recuperação tem resposta neutra, código protegido, uso único e revoga ambas as sessões', async () => {
  const usuario = await conta();
  const web = await criarSessao(usuario.id, 'WEB'); const mobile = await criarSessao(usuario.id, 'MOBILE');
  const resposta = await solicitarRecuperacao(usuario.email);
  assert.deepEqual(resposta, await solicitarRecuperacao(emailNovo()));
  assert.deepEqual(resposta, { enviado: true });
  const codigo = await codigoPara(usuario.email);
  const registro = await banco.recuperacaoSenha.findUnique({ where: { usuarioId: usuario.id } });
  assert.notEqual(registro.codigoHash, codigo);
  await assert.rejects(redefinirSenha(usuario.email, codigo === '000000' ? '000001' : '000000', novaSenha), erro('codigo_invalido'));
  assert.equal(await usuarioDaSessao(web.token, 'WEB'), usuario.id);
  assert.deepEqual(await redefinirSenha(usuario.email, codigo, novaSenha), { alterada: true });
  assert.equal(await usuarioDaSessao(web.token, 'WEB'), null);
  assert.equal(await usuarioDaSessao(mobile.token, 'MOBILE'), null);
  const alterado = await banco.usuario.findUnique({ where: { id: usuario.id } });
  assert.equal(await verificarSenha(novaSenha, alterado.senhaHash), true);
  assert.equal(await verificarSenha('senha-original', alterado.senhaHash), false);
  assert.equal((await entrar(usuario.email, novaSenha)).estado, 'ok');
  await assert.rejects(redefinirSenha(usuario.email, codigo, novaSenha), erro('codigo_invalido'));
});

test('código expirado, senha curta e código de outra conta não alteram senha', async () => {
  const usuario = await conta(); await solicitarRecuperacao(usuario.email); const codigo = await codigoPara(usuario.email);
  await assert.rejects(redefinirSenha(usuario.email, codigo, 'curta'), erro('invalido'));
  await assert.rejects(redefinirSenha(emailNovo(), codigo, novaSenha), erro('codigo_invalido'));
  await banco.recuperacaoSenha.update({ where: { usuarioId: usuario.id }, data: { expiraEm: new Date(0) } });
  await assert.rejects(redefinirSenha(usuario.email, codigo, novaSenha), erro('codigo_invalido'));
  assert.equal(await verificarSenha('senha-original', (await banco.usuario.findUnique({ where: { id: usuario.id } })).senhaHash), true);
});

test('limita pedidos de e-mails inexistentes e bloqueia a sexta tentativa de código', async () => {
  const email = emailNovo();
  for (let i = 0; i < 3; i++) await solicitarRecuperacao(email);
  await assert.rejects(solicitarRecuperacao(email), erro('limite_recuperacao'));
  const usuario = await conta(); await solicitarRecuperacao(usuario.email); const codigo = await codigoPara(usuario.email);
  const errado = codigo === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) await assert.rejects(redefinirSenha(usuario.email, errado, novaSenha), erro('codigo_invalido'));
  await assert.rejects(redefinirSenha(usuario.email, codigo, novaSenha), erro('limite_recuperacao'));
});

test('duas trocas simultâneas do mesmo código têm somente um vencedor', async () => {
  const usuario = await conta(); await solicitarRecuperacao(usuario.email); const codigo = await codigoPara(usuario.email);
  const resultados = await Promise.allSettled([redefinirSenha(usuario.email, codigo, novaSenha), redefinirSenha(usuario.email, codigo, novaSenha)]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
});

test('Google web verifica vínculo do navegador, estado, cria sessão e não aceita replay', async () => {
  const a = await autorizacao(); const email = emailNovo(); const sub = randomUUID();
  let chamadas = 0;
  const provedor = async (_code, _verificador, nonce) => { chamadas++; assert.equal(nonce, a.nonce); return { sub, email }; };
  const errado = await retornarGoogle(new Request(a.retorno), provedor);
  assert.match(errado.headers.get('location'), /google_invalido/); assert.equal(chamadas, 0);
  const request = () => new Request(a.retorno, { headers: { Cookie: a.cookie } });
  const resposta = await retornarGoogle(request(), provedor);
  assert.equal(resposta.headers.get('location'), process.env.STUDOO_ORIGEM + '/');
  const cookies = resposta.headers.getSetCookie();
  assert.ok(cookies.some(c => c.includes('HttpOnly') && c.includes('SameSite=Lax')));
  const token = /studoo-sessao=([\w-]+)/.exec(cookies.join(';'))[1];
  assert.ok(await usuarioDaSessao(token, 'WEB')); assert.equal(await usuarioDaSessao(token, 'MOBILE'), null);
  assert.equal(chamadas, 1);
  assert.match((await retornarGoogle(request(), provedor)).headers.get('location'), /google_invalido/);
  assert.equal(chamadas, 1);
});

test('Google não vincula uma conta com senha somente por coincidência de e-mail', async () => {
  const usuario = await conta(); const a = await autorizacao();
  const resposta = await retornarGoogle(new Request(a.retorno, { headers: { Cookie: a.cookie } }), async () => ({ sub: randomUUID(), email: usuario.email }));
  assert.match(resposta.headers.get('location'), /google_conta_existente/);
  assert.equal((await banco.usuario.findUnique({ where: { id: usuario.id } })).googleSub, null);
});

test('Google mobile entrega somente código PKCE, com troca única e sessão isolada', async () => {
  const a = await autorizacao(true); const email = emailNovo();
  const resposta = await retornarGoogle(new Request(a.retorno, { headers: { Cookie: a.cookie } }), async () => ({ sub: randomUUID(), email }));
  const retorno = new URL(resposta.headers.get('location'));
  assert.equal(retorno.protocol, 'studoo-dev:'); assert.equal(retorno.host, 'auth');
  assert.equal(retorno.searchParams.has('token'), false);
  assert.ok(!resposta.headers.getSetCookie().some(c => c.includes('studoo-sessao')));
  const codigo = retorno.searchParams.get('codigo'); assert.ok(codigo);
  await assert.rejects(trocarCodigoMobile(codigo, randomBytes(32).toString('hex')), erro('google_invalido'));
  const resultados = await Promise.allSettled([trocarCodigoMobile(codigo, a.verificador), trocarCodigoMobile(codigo, a.verificador)]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  const sessao = resultados.find(r => r.status === 'fulfilled').value;
  assert.ok(await usuarioDaSessao(sessao.token, 'MOBILE'));
  assert.equal(await usuarioDaSessao(sessao.token, 'WEB'), null);
});

test('estado expirado, cancelamento e URI de retorno não permitida não autenticam', async () => {
  const a = await autorizacao();
  await banco.autorizacaoGoogle.update({ where: { estadoHash: hashToken(a.state) }, data: { expiraEm: new Date(0) } });
  const provedor = async () => { throw new Error('não deve chamar o provedor'); };
  assert.match((await retornarGoogle(new Request(a.retorno, { headers: { Cookie: a.cookie } }), provedor)).headers.get('location'), /google_invalido/);
  const b = await autorizacao(); b.retorno.searchParams.set('error', 'access_denied');
  assert.match((await retornarGoogle(new Request(b.retorno, { headers: { Cookie: b.cookie } }), provedor)).headers.get('location'), /google_invalido/);
  process.env.STUDOO_GOOGLE_MOBILE_REDIRECT_URI = 'javascript://auth/google';
  await assert.rejects(autorizacao(true), erro('google_indisponivel'));
});

test('sessão Google existente reutiliza usuário e o código mobile expira', async () => {
  const email = emailNovo(); const sub = randomUUID();
  const a = await autorizacao();
  await retornarGoogle(new Request(a.retorno, { headers: { Cookie: a.cookie } }), async () => ({ sub, email }));
  const usuario = await banco.usuario.findUnique({ where: { googleSub: sub } });
  assert.equal(usuario.senhaHash, null);
  assert.equal((await entrar(email, 'qualquer-senha')).estado, 'credenciais_invalidas');
  const b = await autorizacao(true);
  const resposta = await retornarGoogle(new Request(b.retorno, { headers: { Cookie: b.cookie } }), async () => ({ sub, email }));
  assert.equal(await banco.usuario.count({ where: { googleSub: sub } }), 1);
  const codigo = new URL(resposta.headers.get('location')).searchParams.get('codigo');
  await banco.codigoGoogleMobile.update({ where: { codigoHash: hashToken(codigo) }, data: { expiraEm: new Date(0) } });
  await assert.rejects(trocarCodigoMobile(codigo, b.verificador), erro('google_invalido'));
});

test('rotas nativas permitem recuperação HTTPS sem cookie e trocam a senha', async () => {
  process.env.STUDOO_ORIGEM = 'https://localhost:3443';
  const usuario = await conta();
  const request = (path, body) => new Request(process.env.STUDOO_ORIGEM + path, {
    method: 'POST', headers: { Host: 'localhost:3443', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await recuperarMobile(request('/api/mobile/senha/recuperar', { email: usuario.email }))).status, 200);
  const codigo = await codigoPara(usuario.email);
  assert.equal((await redefinirMobile(request('/api/mobile/senha/redefinir', { email: usuario.email, codigo, senha: novaSenha }))).status, 200);
  assert.equal((await entrar(usuario.email, novaSenha, 'MOBILE')).estado, 'ok');
});

test('JWT Google valida assinatura, emissor, público, validade, nonce e e-mail verificado', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey); const resolver = createLocalJWKSet({ keys: [{ ...jwk, kid: 'teste', alg: 'RS256' }] });
  const email = emailNovo(); const nonce = randomUUID();
  const token = (patch = {}) => new SignJWT({ email, email_verified: true, nonce, sub: '12345',
    iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID,
    iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300, ...patch })
    .setProtectedHeader({ alg: 'RS256', kid: 'teste' }).sign(privateKey);
  assert.deepEqual(await verificarTokenGoogle(await token(), nonce, resolver), { sub: '12345', email });
  for (const patch of [{ aud: 'outro-app' }, { iss: 'https://malicioso.test' }, { exp: 1 }, { nonce: 'outro' }, { email_verified: false }, { sub: '' }]) {
    await assert.rejects(verificarTokenGoogle(await token(patch), nonce, resolver));
  }
  const outro = await generateKeyPair('RS256');
  const forjado = await new SignJWT({ email, email_verified: true, nonce }).setProtectedHeader({ alg: 'RS256', kid: 'teste' }).sign(outro.privateKey);
  await assert.rejects(verificarTokenGoogle(forjado, nonce, resolver));
});

test('rotas mantêm proteção de origem/canal; e-mail falso não opera em domínio público', async () => {
  const body = JSON.stringify({ email: emailNovo() });
  const r = await recuperarWeb(new Request('http://localhost:3100/api/senha/recuperar', {
    method: 'POST', headers: { Origin: 'https://malicioso.test', 'Content-Type': 'application/json' }, body,
  }));
  assert.equal(r.status, 403);
  process.env.STUDOO_ORIGEM = 'https://studoo.example.test';
  assert.equal(recuperacaoDisponivel(), false);
  const mobile = await googleMobile(new Request('https://studoo.example.test/api/mobile/google', {
    method: 'POST', headers: { Origin: 'https://studoo.example.test', Host: 'studoo.example.test', 'Content-Type': 'application/json' }, body: '{}',
  }));
  assert.equal(mobile.status, 403);
});

after(async () => {
  const usuarios = await banco.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = usuarios.map(u => u.id);
  await banco.sessao.deleteMany({ where: { usuarioId: { in: ids } } });
  await banco.usuario.deleteMany({ where: { id: { in: ids } } });
  await banco.autorizacaoGoogle.deleteMany({ where: { estadoHash: { in: estados } } });
  const chaves = [assinatura('google-iniciar-global'), ...emails.flatMap(email => [assinatura(`recuperar\0${email}`), assinatura(`redefinir\0${email}`)])];
  await banco.tentativaLogin.deleteMany({ where: { chave: { in: chaves } } });
  for (const nome of await readdir('.studoo-local/emails').catch(() => [])) {
    const path = `.studoo-local/emails/${nome}`;
    if (emails.includes(JSON.parse(await readFile(path, 'utf8')).to)) await unlink(path);
  }
  await banco.$disconnect();
});
