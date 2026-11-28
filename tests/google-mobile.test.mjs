import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const fonte = await readFile(new URL('../apps/mobile/src/google-nativo.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
function ambiente({ cancelado = false, falharArmazenamento = false, env = {} } = {}) {
  const dados = new Map(); const chamadas = { troca: 0, logout: 0, salvo: null, url: null };
  const codigo = randomBytes(32).toString('base64url'); const token = randomBytes(32).toString('base64url');
  const chave = 'studoo.google.api.example.test'; const retorno = `studoo-dev://auth/google?codigo=${codigo}`;
  class ErroStudoo extends Error { constructor(codigo) { super(codigo); this.codigo = codigo; } }
  const modulos = {
    'expo-crypto': { getRandomBytesAsync: async n => randomBytes(n), CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { BASE64: 'base64' },
      digestStringAsync: async (alg, texto, { encoding }) => createHash(alg).update(texto).digest(encoding) },
    'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'privado', setItemAsync: async (k,v) => dados.set(k,v),
      getItemAsync: async k => dados.get(k) ?? null, deleteItemAsync: async k => dados.delete(k) },
    'expo-web-browser': { openAuthSessionAsync: async url => { chamadas.url = new URL(url); return cancelado ? { type: 'cancel' } : { type: 'success', url: retorno }; } },
    '@studoo/contratos': { ErroStudoo },
    './api-nativa': {
      origemConfigurada: () => new URL('https://api.example.test'),
      guardarToken: async valor => { if (falharArmazenamento) throw new Error('SecureStore indisponível'); chamadas.salvo = valor; },
      criarClienteNativo: () => ({
        trocarCodigoGoogle: async (recebido, verificador) => {
          chamadas.troca++; assert.equal(recebido, codigo);
          assert.ok(verificador.length >= 43);
          if (chamadas.url) assert.equal(createHash('sha256').update(verificador).digest('base64url'), chamadas.url.searchParams.get('desafio'));
          return { token };
        },
        logout: async () => { chamadas.logout++; },
      }),
    },
  };
  const exports = {};
  runInNewContext(outputText, { exports, require: nome => modulos[nome], URL, process: { env }, setTimeout: () => 0 });
  return { api: exports, dados, chamadas, chave, retorno, token };
}

test('Google nativo usa PKCE, troca o código e só persiste a sessão no SecureStore', async () => {
  const a = ambiente();
  assert.equal(await a.api.entrarComGoogle(), a.token);
  assert.equal(a.chamadas.url.origin, 'https://api.example.test');
  assert.equal(a.chamadas.url.searchParams.get('mobile'), '1');
  assert.equal(a.chamadas.url.searchParams.has('verificador'), false);
  assert.equal(a.chamadas.salvo, a.token);
  assert.equal(a.dados.has(a.chave), false);
  assert.equal(a.chamadas.troca, 1);
});

test('cancelar o navegador não cria sessão nem mostra um login falso', async () => {
  const a = ambiente({ cancelado: true });
  assert.equal(await a.api.entrarComGoogle(), null);
  assert.equal(a.chamadas.troca, 0);
  assert.equal(a.chamadas.salvo, null);
});

test('retorno a frio lê o verificador persistido e deduplica browser/rota concorrentes', async () => {
  const a = ambiente();
  a.dados.set(a.chave, JSON.stringify({ verificador: randomBytes(32).toString('hex'), expiraEm: Date.now() + 60_000 }));
  const [primeiro, segundo] = await Promise.all([a.api.concluirGoogle(a.retorno), a.api.concluirGoogle(a.retorno)]);
  assert.equal(primeiro, a.token); assert.equal(segundo, a.token);
  assert.equal(a.chamadas.troca, 1);
});

test('retorno de outro esquema e tentativa expirada não chegam ao servidor', async () => {
  const a = ambiente();
  await assert.rejects(a.api.concluirGoogle(a.retorno.replace('studoo-dev:', 'malicioso:')));
  a.dados.set(a.chave, JSON.stringify({ verificador: randomBytes(32).toString('hex'), expiraEm: 0 }));
  await assert.rejects(a.api.concluirGoogle(a.retorno));
  assert.equal(a.chamadas.troca, 0);
});

test('falha ao guardar a sessão revoga o token recém-criado', async () => {
  const a = ambiente({ falharArmazenamento: true });
  await assert.rejects(a.api.entrarComGoogle());
  assert.equal(a.chamadas.logout, 1);
  assert.equal(a.chamadas.salvo, null);
});

test('beta do iPhone sem Google (spec 07, P27): o build desligado não abre o navegador nem troca código', async () => {
  const a = ambiente({ env: { EXPO_PUBLIC_STUDOO_GOOGLE_NATIVO: 'desligado' } });
  assert.equal(a.api.googleNoAparelho(), false);
  await assert.rejects(a.api.entrarComGoogle(), erro => erro.codigo === 'google_indisponivel');
  a.dados.set(a.chave, JSON.stringify({ verificador: randomBytes(32).toString('hex'), expiraEm: Date.now() + 60_000 }));
  await assert.rejects(a.api.concluirGoogle(a.retorno), erro => erro.codigo === 'google_indisponivel');
  assert.equal(a.chamadas.url, null);
  assert.equal(a.chamadas.troca, 0);
  assert.equal(a.chamadas.salvo, null);
});

test('sem a chave (ou com outro valor), o Google segue ligado como antes', () => {
  assert.equal(ambiente().api.googleNoAparelho(), true);
  assert.equal(ambiente({ env: { EXPO_PUBLIC_STUDOO_GOOGLE_NATIVO: 'ligado' } }).api.googleNoAparelho(), true);
});

test('a entrada só mostra o Google quando o servidor oferece e o build não desligou; o TestFlight leva Google e Apple juntos', async () => {
  const sessao = await readFile(new URL('../apps/mobile/src/sessao.tsx', import.meta.url), 'utf8');
  assert.match(sessao, /setGoogleDisponivel\(c\.google && googleNoAparelho\(\)\)/);
  const eas = JSON.parse(await readFile(new URL('../apps/mobile/eas.json', import.meta.url), 'utf8'));
  const perfil = eas.build.testflight;
  assert.equal(perfil.ios.simulator, undefined);
  assert.equal(perfil.distribution, 'store');
  for (const nome of ['development', 'preview', 'production', 'testflight']) {
    assert.equal(eas.build[nome].env.EXPO_PUBLIC_STUDOO_API_URL, 'https://app.hellostudoo.com.br', nome);
  }
  // Decisão de 20/11: nenhum perfil desliga o Google; no iPhone ele vem com a Apple (4.8), que o app.json habilita.
  for (const nome of Object.keys(eas.build)) {
    assert.notEqual(eas.build[nome].env?.EXPO_PUBLIC_STUDOO_GOOGLE_NATIVO, 'desligado', nome);
  }
  const app = JSON.parse(await readFile(new URL('../apps/mobile/app.json', import.meta.url), 'utf8'));
  assert.equal(app.expo.ios.usesAppleSignIn, true);
  assert.ok(app.expo.plugins.includes('expo-apple-authentication'));
  assert.match(sessao, /setAppleDisponivel\(c\.apple === true && appleNoAparelho\)/);
});

test('pacote de loja: sem o texto de Face ID (o app não usa biometria) e com a fase que tira a rede local do dev-client no Release', async () => {
  const app = JSON.parse(await readFile(new URL('../apps/mobile/app.json', import.meta.url), 'utf8')).expo;
  const seguro = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-secure-store');
  assert.deepEqual(seguro?.[1], { faceIDPermission: false }, 'expo-secure-store sem NSFaceIDUsageDescription');
  const { execSync } = await import('node:child_process');
  const usoBiometria = execSync('grep -rln "requireAuthentication\\|LocalAuthentication" apps/mobile/src || true', { cwd: new URL('..', import.meta.url) }).toString().trim();
  assert.equal(usoBiometria, '', 'nenhum uso de biometria no app');
  const lancador = await readFile(new URL('../node_modules/expo-dev-launcher/plugin/build/withDevLauncher.js', import.meta.url), 'utf8');
  assert.match(lancador, /Strip Local Network Keys for Release/, 'o expo-dev-launcher tira _expo._tcp e o texto de rede local do Release');
});
