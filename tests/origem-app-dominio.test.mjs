import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, beforeEach, mock, test } from 'node:test';
import { banco } from '../src/servidor/banco/cliente.ts';
import { criarHashSenha, verificarSenha } from '../src/servidor/acesso/credenciais.ts';
import {
  ORIGEM_APP_STUDOO,
  origemStudoo,
  origemWebDaRequisicao,
  origemWebPermitida,
  origensWebPermitidas,
} from '../src/servidor/acesso/origem.ts';
import { criarSessao, hashToken, usuarioDaSessao } from '../src/servidor/acesso/sessao.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { configuracaoGoogle, desafioPkce, iniciarGoogle, retornarGoogle } from '../src/servidor/acesso/google.ts';
import { enviarAvisoContaExistente, enviarRecuperacao } from '../src/servidor/email/recuperacao.ts';
import { POST as loginWeb } from '../src/app/api/login/route.ts';
import { POST as visitanteWeb } from '../src/app/api/visitante/route.ts';
import { DELETE as sairSessao, GET as lerSessao } from '../src/app/api/sessao/route.ts';
import { POST as criarProposta } from '../src/app/api/aprendizado/propostas/route.ts';
import { GET as iniciarGoogleRota } from '../src/app/api/auth/google/iniciar/route.ts';
import { GET as callbackGoogleRota } from '../src/app/api/auth/google/callback/route.ts';
import { POST as recuperarWeb } from '../src/app/api/senha/recuperar/route.ts';
import { POST as redefinirWeb } from '../src/app/api/senha/redefinir/route.ts';
import { POST as cadastroCodigoWeb } from '../src/app/api/cadastro/codigo/route.ts';
import { POST as sessaoMobile } from '../src/app/api/mobile/sessao/route.ts';
import { POST as googleMobile } from '../src/app/api/mobile/google/route.ts';

const ORIGEM_ANTIGA = 'https://studoo-antigo.example.test';
const HOST_ANTIGO = new URL(ORIGEM_ANTIGA).host;
const HOST_NOVO = new URL(ORIGEM_APP_STUDOO).host;
const prefixo = `dom-${randomUUID()}`;
const emails = [];
const usuariosExtras = [];
const estadosGoogle = [];
const chavesLimite = [];

const envOriginal = {
  STUDOO_ORIGEM: process.env.STUDOO_ORIGEM,
  STUDOO_PROXY_HTTPS: process.env.STUDOO_PROXY_HTTPS,
  STUDOO_DOMINIO_EMAIL: process.env.STUDOO_DOMINIO_EMAIL,
  STUDOO_SESSAO_MOBILE_PILOTO: process.env.STUDOO_SESSAO_MOBILE_PILOTO,
  STUDOO_VISITANTE: process.env.STUDOO_VISITANTE,
  STUDOO_CADASTRO: process.env.STUDOO_CADASTRO,
  STUDOO_CHAVE_ASSINATURA: process.env.STUDOO_CHAVE_ASSINATURA,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  STUDOO_GOOGLE_MOBILE_REDIRECT_URI: process.env.STUDOO_GOOGLE_MOBILE_REDIRECT_URI,
  EMAIL: process.env.EMAIL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  IA: process.env.IA,
};

process.env.STUDOO_CHAVE_ASSINATURA = randomBytes(32).toString('hex');

beforeEach(() => {
  process.env.STUDOO_ORIGEM = ORIGEM_ANTIGA;
  process.env.STUDOO_PROXY_HTTPS = '1';
  process.env.STUDOO_DOMINIO_EMAIL = 'example.test';
  process.env.STUDOO_SESSAO_MOBILE_PILOTO = '1';
  process.env.STUDOO_VISITANTE = '1';
  process.env.STUDOO_CADASTRO = '1';
  process.env.GOOGLE_CLIENT_ID = 'teste-google.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'segredo-exclusivo-de-teste';
  process.env.STUDOO_GOOGLE_MOBILE_REDIRECT_URI = 'studoo-dev://auth/google';
  process.env.EMAIL = 'resend';
  process.env.RESEND_API_KEY = 're_chave_sintetica';
  process.env.EMAIL_FROM = 'Studoo <acesso@example.test>';
  process.env.IA = 'falsa';
});

function emailNovo() {
  const email = `${prefixo}-${emails.length}@example.test`;
  emails.push(email);
  return email;
}

async function criarContaComAceite(senha = 'senha-original-2026') {
  return banco.usuario.create({
    data: {
      email: emailNovo(),
      senhaHash: await criarHashSenha(senha),
      fuso: 'America/Sao_Paulo',
      consentimentoIaEm: new Date(),
      consentimentoIaVersao: '2026-04-16',
    },
  });
}

function extrairCookie(resposta) {
  const bruto = resposta.headers.get('set-cookie') ?? '';
  assert.ok(bruto.startsWith('__Host-studoo-sessao='), `cookie inesperado: ${bruto}`);
  assert.ok(bruto.includes('; Path=/; HttpOnly; SameSite=Lax;'));
  assert.ok(bruto.includes('; Secure'));
  assert.equal(/;\s*Domain=/i.test(bruto), false, 'cookie __Host- não pode definir Domain');
  assert.equal(resposta.headers.get('access-control-allow-origin'), null);
  return bruto.split(';')[0];
}

function reqWeb(caminho, { metodo = 'POST', origem, corpo, cookie, host } = {}) {
  const headers = {};
  if (origem !== undefined) headers.origin = origem;
  if (cookie) headers.cookie = cookie;
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  const hostEfetivo = host ?? (origem && origem.startsWith('https://') ? new URL(origem).host : HOST_NOVO);
  headers['x-forwarded-proto'] = 'https';
  headers['x-forwarded-host'] = hostEfetivo;
  return new Request(`http://127.0.0.1:3000${caminho}`, {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

test('origens web permitidas aceitam origem antiga HTTPS e https://app.hellostudoo.com.br exata, e rejeitam alheias', () => {
  assert.equal(ORIGEM_APP_STUDOO, 'https://app.hellostudoo.com.br');
  assert.equal(origemStudoo(), ORIGEM_ANTIGA);
  assert.deepEqual(origensWebPermitidas(), [ORIGEM_ANTIGA, ORIGEM_APP_STUDOO]);

  assert.equal(origemWebPermitida(ORIGEM_ANTIGA), true);
  assert.equal(origemWebPermitida(ORIGEM_APP_STUDOO), true);

  for (const alheia of [
    null,
    '',
    '*',
    'null',
    'http://app.hellostudoo.com.br',
    'https://hellostudoo.com.br',
    'https://www.hellostudoo.com.br',
    'https://app.hellostudoo.com.br/',
    'https://app.hellostudoo.com.br:8443',
    'https://sub.app.hellostudoo.com.br',
    'https://app.hellostudoo.com.br.evil.test',
    'https://APP.HELLOSTUDOO.COM.BR',
    'https://malicioso.test',
  ]) {
    assert.equal(origemWebPermitida(alheia), false, `deveria rejeitar ${String(alheia)}`);
  }

  // Sem duplicar quando STUDOO_ORIGEM já for o novo domínio.
  process.env.STUDOO_ORIGEM = ORIGEM_APP_STUDOO;
  assert.deepEqual(origensWebPermitidas(), [ORIGEM_APP_STUDOO]);

  // Em HTTP loopback local, não abre para origem remota HTTPS.
  process.env.STUDOO_ORIGEM = 'http://localhost:3100';
  assert.deepEqual(origensWebPermitidas(), ['http://localhost:3100']);
  assert.equal(origemWebPermitida(ORIGEM_APP_STUDOO), false);

  // Sem STUDOO_ORIGEM válida, falha fechado.
  for (const invalida of ['', 'http://studoo.example.test', 'https://studoo.example.test/caminho']) {
    process.env.STUDOO_ORIGEM = invalida;
    assert.deepEqual(origensWebPermitidas(), []);
    assert.equal(origemWebPermitida(ORIGEM_APP_STUDOO), false);
  }
});

test('origemWebDaRequisicao respeita STUDOO_PROXY_HTTPS e ignora hosts forjados', () => {
  // Com proxy HTTPS confiável, reconhece x-forwarded-host dos dois domínios aceitos (inclusive :443).
  assert.equal(
    origemWebDaRequisicao(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
      headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': HOST_NOVO },
    })),
    ORIGEM_APP_STUDOO,
  );
  assert.equal(
    origemWebDaRequisicao(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
      headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': `${HOST_NOVO}:443` },
    })),
    ORIGEM_APP_STUDOO,
  );
  assert.equal(
    origemWebDaRequisicao(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
      headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'hellostudoo.com.br' },
    })),
    null,
  );
  assert.equal(
    origemWebDaRequisicao(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
      headers: { 'x-forwarded-proto': 'http', 'x-forwarded-host': HOST_NOVO },
    })),
    null,
  );

  // Sem STUDOO_PROXY_HTTPS=1, cabeçalhos encaminhados não são confiáveis.
  delete process.env.STUDOO_PROXY_HTTPS;
  assert.equal(
    origemWebDaRequisicao(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
      headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': HOST_NOVO },
    })),
    null,
  );
  assert.equal(
    origemWebDaRequisicao(new Request(`${ORIGEM_APP_STUDOO}/api/auth/google/iniciar`)),
    ORIGEM_APP_STUDOO,
  );
});

test('login por senha, sessão, escritas do app e logout funcionam nas duas origens válidas e rejeitam alheias', async () => {
  const usuario = await criarContaComAceite('senha-original-2026');

  for (const origem of [ORIGEM_APP_STUDOO, ORIGEM_ANTIGA]) {
    const resLogin = await loginWeb(reqWeb('/api/login', {
      origem,
      corpo: { email: usuario.email, senha: 'senha-original-2026' },
    }));
    assert.equal(resLogin.status, 200);
    assert.deepEqual(await resLogin.json(), { autenticado: true });
    const cookie = extrairCookie(resLogin);

    const resSessao = await lerSessao(reqWeb('/api/sessao', { metodo: 'GET', origem, cookie }));
    assert.equal(resSessao.status, 200);
    // `conta`: o identificador opaco da conta (spec 04, Retomada da criação), só para o aparelho guardar o que é dela.
    const { conta, ...sessao } = await resSessao.json();
    assert.deepEqual(sessao, { autenticado: true, visitante: false });
    assert.match(conta, /^[\w-]{16,}$/);

    const resEscrita = await criarProposta(reqWeb('/api/aprendizado/propostas', {
      origem,
      cookie,
      corpo: { objetivo: 'Praticar filtros e junções em SQL para uma prova.' },
    }));
    assert.equal(resEscrita.status, 200);
    const proposta = await resEscrita.json();
    assert.ok(typeof proposta.token === 'string' && proposta.token.length > 0);

    const resSair = await sairSessao(reqWeb('/api/sessao', { metodo: 'DELETE', origem, cookie }));
    assert.equal(resSair.status, 204);
    assert.match(resSair.headers.get('set-cookie') ?? '', /__Host-studoo-sessao=;.*Max-Age=0/);
  }

  // Origens alheias e ausência de Origin são rejeitadas com 403 em login e escritas.
  const sessaoAtiva = await criarSessao(usuario.id, 'WEB');
  const cookieAtivo = `__Host-studoo-sessao=${sessaoAtiva.token}`;
  for (const origemRuim of [
    undefined,
    'http://app.hellostudoo.com.br',
    'https://hellostudoo.com.br',
    'https://app.hellostudoo.com.br.evil.test',
    'https://malicioso.test',
    '*',
  ]) {
    const rLogin = await loginWeb(reqWeb('/api/login', {
      origem: origemRuim,
      corpo: { email: usuario.email, senha: 'senha-original-2026' },
    }));
    assert.equal(rLogin.status, 403, `login deveria recusar ${String(origemRuim)}`);
    assert.equal((await rLogin.json()).codigo, 'origem_invalida');
    assert.equal(rLogin.headers.get('access-control-allow-origin'), null);

    const rEscrita = await criarProposta(reqWeb('/api/aprendizado/propostas', {
      origem: origemRuim,
      cookie: cookieAtivo,
      corpo: { objetivo: 'Aprender SQL.' },
    }));
    assert.equal(rEscrita.status, 403, `escrita deveria recusar ${String(origemRuim)}`);
    assert.equal((await rEscrita.json()).codigo, 'origem_invalida');
  }
});

test('visitante funciona nas duas origens válidas, preserva cookie __Host- e recusa origens alheias', async () => {
  const ips = [
    `198.51.100.${Math.floor(Math.random() * 100) + 10}`,
    `198.51.100.${Math.floor(Math.random() * 100) + 120}`,
  ];
  for (const ip of ips) chavesLimite.push(assinatura(`visitante:ip:${ip}`));

  for (const [indice, origem] of [ORIGEM_APP_STUDOO, ORIGEM_ANTIGA].entries()) {
    const req = reqWeb('/api/visitante', { origem });
    req.headers.set('x-forwarded-for', ips[indice]);
    const res = await visitanteWeb(req);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { autenticado: true });
    const cookie = extrairCookie(res);
    assert.ok((res.headers.get('set-cookie') ?? '').includes('Max-Age=86400'));

    const token = cookie.split('=')[1];
    const usuarioId = await usuarioDaSessao(token, 'WEB');
    assert.ok(usuarioId);
    usuariosExtras.push(usuarioId);

    const resSessao = await lerSessao(reqWeb('/api/sessao', { metodo: 'GET', origem, cookie }));
    assert.equal(resSessao.status, 200);
    const { conta, ...sessaoVisitante } = await resSessao.json();
    assert.deepEqual(sessaoVisitante, { autenticado: true, visitante: true });
    assert.match(conta, /^[\w-]{16,}$/, 'o visitante também recebe a conta opaca');

    const resEscrita = await criarProposta(reqWeb('/api/aprendizado/propostas', {
      origem,
      cookie,
      corpo: { objetivo: 'Praticar SQL básico.' },
    }));
    assert.equal(resEscrita.status, 200);
  }

  const recusada = await visitanteWeb(reqWeb('/api/visitante', { origem: 'https://hellostudoo.com.br' }));
  assert.equal(recusada.status, 403);
  assert.equal((await recusada.json()).codigo, 'origem_invalida');
});

test('Google iniciado em app.hellostudoo.com.br encaminha ao início canônico, preserva callback cadastrado e conclui sessão no domínio canônico', async () => {
  const antes = await banco.autorizacaoGoogle.count();

  // 1) Navegação em https://app.hellostudoo.com.br/api/auth/google/iniciar redireciona ao início canônico sem cookie/estado órfão.
  const salto = await iniciarGoogleRota(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
    method: 'GET',
    headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': HOST_NOVO },
  }));
  assert.equal(salto.status, 303);
  assert.equal(salto.headers.get('location'), `${ORIGEM_ANTIGA}/api/auth/google/iniciar`);
  assert.equal(salto.headers.get('set-cookie'), null);
  assert.equal(await banco.autorizacaoGoogle.count(), antes);

  // 2) Seguindo o redirect no domínio canônico (STUDOO_ORIGEM), cria estado + cookie __Host-studoo-google e usa callback cadastrado.
  const inicio = await iniciarGoogleRota(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
    method: 'GET',
    headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': HOST_ANTIGO },
  }));
  assert.equal(inicio.status, 303);
  const urlGoogle = new URL(inicio.headers.get('location'));
  assert.equal(urlGoogle.origin, 'https://accounts.google.com');
  assert.equal(urlGoogle.searchParams.get('redirect_uri'), `${ORIGEM_ANTIGA}/api/auth/google/callback`);
  const state = urlGoogle.searchParams.get('state');
  estadosGoogle.push(hashToken(state));
  const cookieGoogleBruto = inicio.headers.get('set-cookie') ?? '';
  assert.ok(cookieGoogleBruto.startsWith('__Host-studoo-google='));
  assert.ok(cookieGoogleBruto.includes('; Secure'));
  const cookieGoogle = cookieGoogleBruto.split(';')[0];

  // 3) Retorno no callback canônico autentica e conclui o usuário em ${ORIGEM_ANTIGA}/.
  const email = emailNovo();
  const sub = randomUUID();
  const retornoUrl = new URL('/api/auth/google/callback', ORIGEM_ANTIGA);
  retornoUrl.searchParams.set('state', state);
  retornoUrl.searchParams.set('code', 'codigo-google-teste');
  const fim = await retornarGoogle(
    new Request(retornoUrl, { headers: { cookie: cookieGoogle } }),
    async (_code, _verificador, nonce) => {
      assert.equal(nonce, urlGoogle.searchParams.get('nonce'));
      return { sub, email };
    },
  );
  assert.equal(fim.status, 303);
  assert.equal(fim.headers.get('location'), `${ORIGEM_ANTIGA}/`);
  const cookiesFim = fim.headers.getSetCookie();
  const sessaoCookie = cookiesFim.find((c) => c.startsWith('__Host-studoo-sessao='));
  assert.ok(sessaoCookie && sessaoCookie.includes('; Secure'));
  const token = /__Host-studoo-sessao=([\w-]+)/.exec(sessaoCookie)[1];
  assert.ok(await usuarioDaSessao(token, 'WEB'));

  // 4) Com Google desligado, erro volta ao login do próprio host que pediu.
  delete process.env.GOOGLE_CLIENT_ID;
  const indisponivel = await iniciarGoogle(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
    headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': HOST_NOVO },
  }));
  assert.equal(indisponivel.status, 303);
  assert.equal(indisponivel.headers.get('location'), `${ORIGEM_APP_STUDOO}/login?erro=google_indisponivel`);

  // 5) Quando STUDOO_ORIGEM já for o novo domínio, não há salto (evita loop).
  process.env.GOOGLE_CLIENT_ID = 'teste-google.apps.googleusercontent.com';
  process.env.STUDOO_ORIGEM = ORIGEM_APP_STUDOO;
  const direto = await iniciarGoogle(new Request('http://127.0.0.1:3000/api/auth/google/iniciar', {
    headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': HOST_NOVO },
  }));
  assert.equal(direto.status, 303);
  const urlDireta = new URL(direto.headers.get('location'));
  assert.equal(urlDireta.origin, 'https://accounts.google.com');
  assert.equal(urlDireta.searchParams.get('redirect_uri'), `${ORIGEM_APP_STUDOO}/api/auth/google/callback`);
  estadosGoogle.push(hashToken(urlDireta.searchParams.get('state')));
});

const encaminhado = (host) => ({ 'x-forwarded-proto': 'https', 'x-forwarded-host': host });
const INICIO_GOOGLE = 'http://127.0.0.1:3000/api/auth/google/iniciar';

test('Google web abre a sessão no domínio do app pelo callback', async () => {
  process.env.STUDOO_ORIGEM = ORIGEM_APP_STUDOO;
  const antes = await banco.autorizacaoGoogle.count();

  // 1) Quem começa no endereço antigo é levado ao início do app., sem cookie nem estado órfão.
  const salto = await iniciarGoogleRota(new Request(INICIO_GOOGLE, { headers: encaminhado(HOST_ANTIGO) }));
  assert.equal(salto.status, 303);
  assert.equal(salto.headers.get('location'), `${ORIGEM_APP_STUDOO}/api/auth/google/iniciar`);
  assert.equal(salto.headers.get('set-cookie'), null);
  assert.equal(await banco.autorizacaoGoogle.count(), antes);

  // 2) No app.: estado, cookie do host do app. e o endereço de retorno /callback, sem novo salto.
  const inicio = await iniciarGoogleRota(new Request(INICIO_GOOGLE, { headers: encaminhado(HOST_NOVO) }));
  assert.equal(inicio.status, 303);
  const urlGoogle = new URL(inicio.headers.get('location'));
  assert.equal(urlGoogle.origin, 'https://accounts.google.com');
  assert.equal(urlGoogle.searchParams.get('redirect_uri'), `${ORIGEM_APP_STUDOO}/api/auth/google/callback`);
  const state = urlGoogle.searchParams.get('state');
  estadosGoogle.push(hashToken(state));
  const cookieBruto = inicio.headers.get('set-cookie') ?? '';
  assert.ok(cookieBruto.startsWith('__Host-studoo-google=') && cookieBruto.includes('; Secure'));
  assert.equal(/;\s*Domain=/i.test(cookieBruto), false, 'cookie __Host- não pode definir Domain');
  const cookie = cookieBruto.split(';')[0];

  // 3) O Google devolve a pessoa em /callback: a troca usa o mesmo endereço de retorno e a sessão nasce no app.
  const email = emailNovo();
  const sub = randomUUID();
  const retorno = new URL('/api/auth/google/callback', ORIGEM_APP_STUDOO);
  retorno.searchParams.set('state', state);
  retorno.searchParams.set('code', 'codigo-google-teste');
  const fim = await retornarGoogle(
    new Request(retorno, { headers: { cookie } }),
    async (_codigo, _verificador, nonce) => {
      assert.equal(nonce, urlGoogle.searchParams.get('nonce'));
      return { sub, email };
    },
  );
  assert.equal(fim.status, 303);
  assert.equal(fim.headers.get('location'), `${ORIGEM_APP_STUDOO}/`);
  const cookies = fim.headers.getSetCookie();
  const sessaoCookie = cookies.find((c) => c.startsWith('__Host-studoo-sessao='));
  assert.ok(sessaoCookie && sessaoCookie.includes('; Secure'));
  assert.ok(cookies.some((c) => /^__Host-studoo-google=;.*Max-Age=0/.test(c)), 'o cookie do estado é limpo');
  assert.ok(await usuarioDaSessao(/__Host-studoo-sessao=([\w-]+)/.exec(sessaoCookie)[1], 'WEB'));
});

test('Google mobile usa o callback e troca o código no domínio do app', async () => {
  process.env.STUDOO_ORIGEM = ORIGEM_APP_STUDOO;
  const verificador = randomBytes(32).toString('hex');
  const desafio = desafioPkce(verificador);

  // O app abre o endereço da API gravado no build com o desafio vinculado ao aparelho.
  const inicioApp = new URL('/api/auth/google/iniciar', ORIGEM_APP_STUDOO);
  inicioApp.searchParams.set('mobile', '1');
  inicioApp.searchParams.set('desafio', desafio);
  const inicio = await iniciarGoogleRota(new Request(inicioApp, { headers: encaminhado(HOST_NOVO) }));
  assert.equal(inicio.status, 303);
  const urlGoogle = new URL(inicio.headers.get('location'));
  assert.equal(urlGoogle.searchParams.get('redirect_uri'), `${ORIGEM_APP_STUDOO}/api/auth/google/callback`);
  const state = urlGoogle.searchParams.get('state');
  estadosGoogle.push(hashToken(state));
  const cookie = (inicio.headers.get('set-cookie') ?? '').split(';')[0];
  assert.ok(cookie.startsWith('__Host-studoo-google='));
  assert.equal((await banco.autorizacaoGoogle.findFirst({ where: { estadoHash: hashToken(state) } })).desafioMobile, desafio);

  // 3) O /callback entrega ao app só o código temporário, pelo link do app, e não abre sessão de navegador.
  const retorno = new URL('/api/auth/google/callback', ORIGEM_APP_STUDOO);
  retorno.searchParams.set('state', state);
  retorno.searchParams.set('code', 'codigo-google-app');
  const fim = await retornarGoogle(
    new Request(retorno, { headers: { cookie } }),
    async () => ({ sub: randomUUID(), email: emailNovo() }),
  );
  const deepLink = new URL(fim.headers.get('location'));
  assert.equal(deepLink.protocol, 'studoo-dev:');
  assert.equal(deepLink.host, 'auth');
  assert.equal(deepLink.pathname, '/google');
  assert.equal(fim.headers.getSetCookie().some((c) => c.startsWith('__Host-studoo-sessao=')), false);
  const codigo = deepLink.searchParams.get('codigo');

  // O app troca o código na API atual e o servidor abre uma sessão MOBILE.
  const troca = await googleMobile(new Request('http://127.0.0.1:3000/api/mobile/google', {
    method: 'POST',
    headers: { ...encaminhado(HOST_NOVO), 'content-type': 'application/json' },
    body: JSON.stringify({ codigo, verificador }),
  }));
  assert.equal(troca.status, 200);
  assert.ok(await usuarioDaSessao((await troca.json()).token, 'MOBILE'));
});

test('o callback recebe o Google somente no domínio configurado', async () => {
  process.env.STUDOO_ORIGEM = ORIGEM_APP_STUDOO;
  const caminho = '/api/auth/google/callback';
  assert.equal(configuracaoGoogle().callback, `${ORIGEM_APP_STUDOO}${caminho}`);

  const fora = await callbackGoogleRota(new Request(`http://127.0.0.1:3000${caminho}`, {
    headers: { ...encaminhado(HOST_ANTIGO), Origin: ORIGEM_APP_STUDOO },
  }));
  assert.equal(fora.status, 404);
  assert.equal(fora.headers.get('set-cookie'), null);

  const semEstado = await callbackGoogleRota(new Request(`http://127.0.0.1:3000${caminho}`, {
    headers: encaminhado(HOST_NOVO),
  }));
  assert.equal(semEstado.status, 303);
  assert.equal(semEstado.headers.get('location'), `${ORIGEM_APP_STUDOO}/login?erro=google_invalido`);
  assert.match(semEstado.headers.get('set-cookie') ?? '', /^__Host-studoo-google=;.*Max-Age=0/);
});

test('recuperação de senha e aviso de conta existente funcionam em ambos os hosts com link seguro e revogação total', async () => {
  const usuario = await criarContaComAceite('senha-original-2026');
  const sessaoWeb = await criarSessao(usuario.id, 'WEB');
  const sessaoMobile = await criarSessao(usuario.id, 'MOBILE');
  const enviados = [];

  const fetchMock = mock.method(globalThis, 'fetch', async (url, opcoes) => {
    assert.equal(url, 'https://api.resend.com/emails');
    enviados.push(JSON.parse(opcoes.body));
    return Response.json({ id: `email-${enviados.length}` });
  });

  try {
    // Pedido pelo host novo gera link do host novo.
    const rRecNovo = await recuperarWeb(reqWeb('/api/senha/recuperar', {
      origem: ORIGEM_APP_STUDOO,
      corpo: { email: usuario.email },
    }));
    assert.equal(rRecNovo.status, 200);
    assert.deepEqual(await rRecNovo.json(), { enviado: true });
    assert.equal(enviados.length, 1);
    assert.ok(enviados[0].text.includes(`${ORIGEM_APP_STUDOO}/recuperar`));
    const codigo = /é: (\d{6})/.exec(enviados[0].text)[1];

    // Redefinição pelo host novo altera a senha, limpa cookie e revoga sessões WEB e MOBILE.
    const novaSenha = 'Nova senha segura 2026!';
    const rRedefinir = await redefinirWeb(reqWeb('/api/senha/redefinir', {
      origem: ORIGEM_APP_STUDOO,
      corpo: { email: usuario.email, codigo, senha: novaSenha },
    }));
    assert.equal(rRedefinir.status, 200);
    assert.deepEqual(await rRedefinir.json(), { alterada: true });
    assert.match(rRedefinir.headers.get('set-cookie') ?? '', /__Host-studoo-sessao=;.*Max-Age=0/);
    assert.equal(await usuarioDaSessao(sessaoWeb.token, 'WEB'), null);
    assert.equal(await usuarioDaSessao(sessaoMobile.token, 'MOBILE'), null);
    const atualizado = await banco.usuario.findUnique({ where: { id: usuario.id } });
    assert.equal(await verificarSenha(novaSenha, atualizado.senhaHash), true);

    // Novo login no host novo funciona com a nova senha.
    const rLoginNovo = await loginWeb(reqWeb('/api/login', {
      origem: ORIGEM_APP_STUDOO,
      corpo: { email: usuario.email, senha: novaSenha },
    }));
    assert.equal(rLoginNovo.status, 200);

    // Pedido pelo host antigo continua mandando link do host antigo.
    const rRecAntigo = await recuperarWeb(reqWeb('/api/senha/recuperar', {
      origem: ORIGEM_ANTIGA,
      corpo: { email: usuario.email },
    }));
    assert.equal(rRecAntigo.status, 200);
    assert.ok(enviados[1].text.includes(`${ORIGEM_ANTIGA}/recuperar`));

    // Aviso de conta existente no cadastro também respeita o host da requisição.
    const ipCad = `198.51.102.${Math.floor(Math.random() * 200) + 10}`;
    chavesLimite.push(assinatura(`cadastro-codigo\0${usuario.email}`), assinatura(`cadastro-rede\0${ipCad}`));
    const reqCad = reqWeb('/api/cadastro/codigo', { origem: ORIGEM_APP_STUDOO, corpo: { email: usuario.email } });
    reqCad.headers.set('x-forwarded-for', ipCad);
    const rCad = await cadastroCodigoWeb(reqCad);
    assert.equal(rCad.status, 200);
    assert.ok(enviados[2].text.includes(`${ORIGEM_APP_STUDOO}/recuperar`));

    // Origem alheia nunca entra no e-mail, mesmo se passada diretamente aos helpers.
    await enviarRecuperacao(usuario.email, '654321', 'https://malicioso.test');
    await enviarAvisoContaExistente(usuario.email, 'https://hellostudoo.com.br');
    assert.ok(enviados[3].text.includes(`${ORIGEM_ANTIGA}/recuperar`));
    assert.ok(enviados[4].text.includes(`${ORIGEM_ANTIGA}/recuperar`));

    // Rotas de recuperação recusam origem alheia.
    assert.equal((await recuperarWeb(reqWeb('/api/senha/recuperar', {
      origem: 'https://hellostudoo.com.br',
      corpo: { email: usuario.email },
    }))).status, 403);
    assert.equal((await redefinirWeb(reqWeb('/api/senha/redefinir', {
      origem: 'https://hellostudoo.com.br',
      corpo: { email: usuario.email, codigo: '123456', senha: novaSenha },
    }))).status, 403);
  } finally {
    fetchMock.mock.restore();
  }
});

test('canal mobile existente segue funcional no domínio antigo e permanece fechado para Origin ou host novo', async () => {
  const usuario = await criarContaComAceite('senha-mobile-2026');

  // Login mobile no domínio antigo (sem Origin, sem Cookie, behind HTTPS proxy) funciona.
  const okMobile = await sessaoMobile(new Request('http://127.0.0.1:3000/api/mobile/sessao', {
    method: 'POST',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': HOST_ANTIGO,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: usuario.email, senha: 'senha-mobile-2026' }),
  }));
  assert.equal(okMobile.status, 200);
  assert.equal(okMobile.headers.get('set-cookie'), null);
  const { token } = await okMobile.json();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);

  // Leitura autenticada mobile no domínio antigo funciona.
  const sessaoOk = await lerSessao(new Request('http://127.0.0.1:3000/api/sessao', {
    method: 'GET',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': HOST_ANTIGO,
      authorization: `Bearer ${token}`,
    },
  }));
  assert.equal(sessaoOk.status, 200);

  // Qualquer Origin (inclusive o novo domínio web permitido) é rejeitado no canal mobile.
  const comOriginNovo = await sessaoMobile(new Request('http://127.0.0.1:3000/api/mobile/sessao', {
    method: 'POST',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': HOST_ANTIGO,
      origin: ORIGEM_APP_STUDOO,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: usuario.email, senha: 'senha-mobile-2026' }),
  }));
  assert.equal(comOriginNovo.status, 403);

  // Host novo não abre o canal mobile dos apps instalados no domínio antigo.
  const hostNovoEntrada = await sessaoMobile(new Request('http://127.0.0.1:3000/api/mobile/sessao', {
    method: 'POST',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': HOST_NOVO,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email: usuario.email, senha: 'senha-mobile-2026' }),
  }));
  assert.equal(hostNovoEntrada.status, 404);

  const hostNovoSessao = await lerSessao(new Request('http://127.0.0.1:3000/api/sessao', {
    method: 'GET',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': HOST_NOVO,
      authorization: `Bearer ${token}`,
    },
  }));
  assert.equal(hostNovoSessao.status, 401);

  // Google mobile no domínio antigo segue entregando código PKCE e trocando por sessão MOBILE.
  const verificador = randomBytes(32).toString('hex');
  const inicioMobUrl = new URL('/api/auth/google/iniciar', ORIGEM_ANTIGA);
  inicioMobUrl.searchParams.set('mobile', '1');
  inicioMobUrl.searchParams.set('desafio', desafioPkce(verificador));
  const inicioMob = await iniciarGoogle(new Request(inicioMobUrl));
  assert.equal(inicioMob.status, 303);
  const gMob = new URL(inicioMob.headers.get('location'));
  const stateMob = gMob.searchParams.get('state');
  estadosGoogle.push(hashToken(stateMob));
  const retMobUrl = new URL('/api/auth/google/callback', ORIGEM_ANTIGA);
  retMobUrl.searchParams.set('state', stateMob);
  retMobUrl.searchParams.set('code', 'codigo-mob');
  const fimMob = await retornarGoogle(
    new Request(retMobUrl, { headers: { cookie: inicioMob.headers.get('set-cookie').split(';')[0] } }),
    async () => ({ sub: randomUUID(), email: emailNovo() }),
  );
  const deepLink = new URL(fimMob.headers.get('location'));
  assert.equal(deepLink.protocol, 'studoo-dev:');
  const codigoMob = deepLink.searchParams.get('codigo');
  const troca = await googleMobile(new Request('http://127.0.0.1:3000/api/mobile/google', {
    method: 'POST',
    headers: {
      'x-forwarded-proto': 'https',
      'x-forwarded-host': HOST_ANTIGO,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ codigo: codigoMob, verificador }),
  }));
  assert.equal(troca.status, 200);
  const sessaoMobGoogle = await troca.json();
  assert.ok(await usuarioDaSessao(sessaoMobGoogle.token, 'MOBILE'));
});

after(async () => {
  const encontrados = await banco.usuario.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = [...new Set([...encontrados.map((u) => u.id), ...usuariosExtras])];
  if (ids.length > 0) {
    await banco.sessao.deleteMany({ where: { usuarioId: { in: ids } } });
    await banco.usuario.deleteMany({ where: { id: { in: ids } } });
  }
  if (estadosGoogle.length > 0) {
    await banco.autorizacaoGoogle.deleteMany({ where: { estadoHash: { in: estadosGoogle } } });
  }
  const chaves = [
    assinatura('google-iniciar-global'),
    ...chavesLimite,
    ...emails.flatMap((email) => [assinatura(`recuperar\0${email}`), assinatura(`redefinir\0${email}`)]),
  ];
  await banco.tentativaLogin.deleteMany({ where: { chave: { in: chaves } } });

  for (const [chave, valor] of Object.entries(envOriginal)) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
  await banco.$disconnect();
});
