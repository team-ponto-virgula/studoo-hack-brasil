import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conferirBetaExterno } from '../scripts/conferir-beta-externo.mjs';

const app = () => ({ expo: {
  owner: 'studoo', extra: { eas: { projectId: '81f67b49-67e1-4807-bf88-16f187169dfd' } },
  ios: { bundleIdentifier: 'com.studoo.mobile.dev', usesAppleSignIn: true },
  plugins: ['expo-apple-authentication'],
} });
const eas = () => ({ build: { testflight: {
  distribution: 'store', env: { EXPO_PUBLIC_STUDOO_API_URL: 'https://beta.example.test' },
} } });
const config = (extra = {}) => ({ google: true, apple: true, cadastro: true, recuperacao: true, ia: 'openai', ...extra });

function servidor({ auth = config(), respostas = {}, falhas = {} } = {}) {
  const chamadas = [];
  const fetchImpl = async (url, opcoes) => {
    const caminho = url.pathname;
    chamadas.push({ caminho, opcoes });
    if (falhas[caminho]) throw falhas[caminho];
    if (respostas[caminho]) return respostas[caminho].clone();
    if (caminho === '/api/saude') return Response.json({ ok: true, status: 'ok' });
    if (caminho === '/api/auth/config') return Response.json(auth);
    if (caminho === '/api/mobile/apple/nonce') return new Response(null, { status: 405 });
    if (['/privacidade', '/suporte'].includes(caminho)) return new Response('<!doctype html><html><body>Studoo</body></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    throw new Error('O teste não pode chamar outro endpoint.');
  };
  return { fetchImpl, chamadas };
}
const erros = (r) => r.verificacoes.filter((v) => v.nivel === 'erro').map((v) => v.codigo);

test('aprova a candidata pública com Apple e IA real, sem alterar contas nem seguir redirecionamentos', async () => {
  const s = servidor();
  const resultado = await conferirBetaExterno({ appConfig: app(), easConfig: eas(), fetchImpl: s.fetchImpl });
  assert.equal(resultado.apto, true);
  assert.deepEqual(erros(resultado), []);
  assert.equal(s.chamadas.length, 5);
  for (const { opcoes } of s.chamadas) {
    assert.equal(opcoes.method, 'GET');
    assert.equal(opcoes.redirect, 'error');
    assert.ok(opcoes.signal instanceof AbortSignal);
    assert.equal(opcoes.body, undefined);
    assert.equal(opcoes.headers.Authorization, undefined);
  }
  assert.match(resultado.limites, /não comprova login real.*assinatura/);
});

test('Apple desligada bloqueia o beta externo quando Google está disponível', async () => {
  const resultado = await conferirBetaExterno({ appConfig: app(), easConfig: eas(), ...servidor({ auth: config({ apple: false }) }) });
  assert.equal(resultado.apto, false);
  assert.deepEqual(erros(resultado), ['apple_ativo']);
  assert.match(resultado.verificacoes.find((v) => v.codigo === 'apple_ativo').mensagem, /Google/);
});

test('Apple ausente ou com valor não booleano não passa como habilitada', async () => {
  for (const apple of [undefined, 'true', 1]) {
    const resultado = await conferirBetaExterno({ appConfig: app(), easConfig: eas(), ...servidor({ auth: config({ apple }) }) });
    assert.equal(resultado.apto, false);
    assert.ok(erros(resultado).includes('apple_ativo'));
  }
});

test('cadastro e recuperação desligados são avisos, sem impedir o beta com Apple', async () => {
  const resultado = await conferirBetaExterno({ appConfig: app(), easConfig: eas(), ...servidor({ auth: config({ cadastro: false, recuperacao: false }) }) });
  assert.equal(resultado.apto, true);
  assert.deepEqual(resultado.verificacoes.filter((v) => v.nivel === 'aviso').map((v) => v.codigo), ['cadastro_email', 'recuperacao_email']);
});

test('IA falsa ou desconhecida bloqueia a candidata', async () => {
  for (const ia of ['falsa', undefined, 'desconhecida']) {
    const resultado = await conferirBetaExterno({ appConfig: app(), easConfig: eas(), ...servidor({ auth: config({ ia }) }) });
    assert.equal(resultado.apto, false);
    assert.ok(erros(resultado).includes('ia_real'));
  }
});

test('página ausente, login HTML no lugar de JSON, nonce incorreto e redirect bloqueiam', async () => {
  for (const [caminho, resposta, codigo] of [
    ['/privacidade', new Response('não existe', { status: 404 }), 'privacidade'],
    ['/suporte', new Response('{}', { headers: { 'content-type': 'application/json' } }), 'suporte'],
    ['/api/auth/config', new Response('<html>Login</html>', { headers: { 'content-type': 'text/html' } }), 'auth_config'],
    ['/api/mobile/apple/nonce', new Response(null, { status: 200 }), 'apple_nonce'],
    ['/privacidade', new Response(null, { status: 302, headers: { location: '/login' } }), 'privacidade'],
    ['/api/saude', Response.json({ ok: false, status: 'erro' }), 'saude_ok'],
  ]) {
    const resultado = await conferirBetaExterno({ appConfig: app(), easConfig: eas(), ...servidor({ respostas: { [caminho]: resposta } }) });
    assert.equal(resultado.apto, false, caminho);
    assert.ok(erros(resultado).includes(codigo), codigo);
  }
});

test('erros de rede ou JSON inválido não expõem o corpo nem a mensagem da exceção', async () => {
  const segredo = 'chave-que-nao-pode-aparecer';
  const resultado = await conferirBetaExterno({ appConfig: app(), easConfig: eas(), ...servidor({
    falhas: { '/suporte': new Error(`erro com ${segredo}`) },
    respostas: { '/api/auth/config': new Response(`{"token":"${segredo}"`, { headers: { 'content-type': 'application/json' } }) },
  }) });
  assert.equal(resultado.apto, false);
  assert.ok(erros(resultado).includes('suporte'));
  assert.ok(erros(resultado).includes('auth_config'));
  assert.ok(!JSON.stringify(resultado).includes(segredo));
});

test('relatório permite apenas flags públicas, sem chaves e sem valores arbitrários', async () => {
  const segredo = 'segredo-da-resposta';
  const appConfig = app();
  appConfig.expo.extra.segredo = segredo;
  const easConfig = eas();
  easConfig.build.testflight.env.APPLE_PRIVATE_KEY = segredo;
  const resultado = await conferirBetaExterno({ appConfig, easConfig, ...servidor({ auth: config({ chave: segredo, token: segredo, visitante: segredo }) }) });
  assert.equal(resultado.apto, true);
  assert.deepEqual(resultado.flags, { google: true, apple: true, cadastro: true, recuperacao: true, ia: 'openai' });
  assert.ok(!JSON.stringify(resultado).includes(segredo));
});

test('configuração de loja e vínculo EAS faltantes bloqueiam; origem insegura não faz pedidos', async () => {
  const appConfig = app();
  delete appConfig.expo.owner;
  delete appConfig.expo.extra.eas.projectId;
  delete appConfig.expo.ios.bundleIdentifier;
  appConfig.expo.ios.usesAppleSignIn = false;
  const easConfig = eas();
  easConfig.build.testflight.distribution = 'internal';
  easConfig.build.testflight.env.EXPO_PUBLIC_STUDOO_API_URL = 'http://beta.example.test';
  const s = servidor();
  const resultado = await conferirBetaExterno({ appConfig, easConfig, fetchImpl: s.fetchImpl });
  assert.equal(resultado.apto, false);
  assert.deepEqual(erros(resultado), ['expo_owner', 'eas_project_id', 'ios_bundle', 'distribuicao_store', 'apple_nativo', 'origem_https']);
  assert.equal(s.chamadas.length, 0);
});

test('origem com segredo ou parâmetros é recusada sem ecoar a URL', async () => {
  const segredo = 'segredo-na-url';
  for (const origem of [`https://usuario:${segredo}@beta.example.test`, `https://beta.example.test?token=${segredo}`]) {
    const easConfig = eas();
    easConfig.build.testflight.env.EXPO_PUBLIC_STUDOO_API_URL = origem;
    const s = servidor();
    const resultado = await conferirBetaExterno({ appConfig: app(), easConfig, fetchImpl: s.fetchImpl });
    assert.equal(resultado.apto, false);
    assert.equal(s.chamadas.length, 0);
    assert.ok(!JSON.stringify(resultado).includes(segredo));
  }
});

test('perfil herdado e plugin em tupla mantêm a conferência do build efetivo', async () => {
  const appConfig = app();
  appConfig.expo.plugins = [['expo-apple-authentication', {}]];
  const easConfig = eas();
  easConfig.build.production = easConfig.build.testflight;
  easConfig.build.testflight = { extends: 'production' };
  const resultado = await conferirBetaExterno({ appConfig, easConfig, ...servidor() });
  assert.equal(resultado.apto, true);
});
