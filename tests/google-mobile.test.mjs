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

// Executa o hook de configuração e o render de provedores de produção. Os dublês representam só o servidor,
// a elegibilidade Apple e os componentes nativos; a decisão Google usa o código real do build acima.
const acessoFonte = await readFile(new URL('../apps/mobile/src/acesso-mobile.tsx', import.meta.url), 'utf8');
const acessoAst = ts.createSourceFile('acesso-mobile.tsx', acessoFonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const acessoFuncoes = ['useConfigAcesso', 'ProvedoresAcesso'].map(nome => {
  const declaracao = acessoAst.statements.find(no => ts.isFunctionDeclaration(no) && no.name?.text === nome);
  assert.ok(declaracao, `função de acesso ausente: ${nome}`);
  return declaracao.getText(acessoAst);
}).join('\n');
const acessoJs = ts.transpileModule(acessoFuncoes, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function nos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(nos);
  if (!arvore || typeof arvore !== 'object') return [];
  return [arvore, ...nos(arvore.props?.children)];
}

async function provedoresDoAcesso({ google = true, apple = true, appleElegivel = true, env = {} } = {}) {
  const estados = [], efeitos = [];
  let cursor = 0;
  const jsx = (type, props) => ({ type, props });
  const api = {};
  runInNewContext(acessoJs, {
    exports: api, require: () => ({ jsx, jsxs: jsx }),
    useState(inicial) {
      const i = cursor++;
      if (!(i in estados)) estados[i] = inicial;
      return [estados[i], valor => { estados[i] = typeof valor === 'function' ? valor(estados[i]) : valor; }];
    },
    useEffect: acao => { efeitos.push(acao); },
    criarClienteNativo: () => ({ configuracaoAcesso: async () => ({ google, apple, cadastro: true, recuperacao: true, visitante: false }) }),
    googleNoAparelho: ambiente({ env }).api.googleNoAparelho,
    appleDisponivelNoAparelho: async () => appleElegivel,
    View: 'View', Text: 'Text', Pressable: 'Pressable', Image: 'Image',
    s: new Proxy({}, { get: (_, chave) => chave }), LOGO_GOOGLE: { fonte: 'google-oficial' },
    mensagens: { acesso: { google: 'Continuar com Google' } },
    AppleAuthentication: { AppleAuthenticationButton: 'AppleOficial', AppleAuthenticationButtonType: { CONTINUE: 'CONTINUE' }, AppleAuthenticationButtonStyle: { WHITE_OUTLINE: 'WHITE_OUTLINE' } },
  });
  const renderizar = config => api.ProvedoresAcesso({ config, google() {}, apple() {}, ocupado: false, executar: acao => acao() });
  assert.equal(renderizar(api.useConfigAcesso()), null, 'não oferece provedores antes de consultar a configuração');
  efeitos.forEach(acao => acao());
  await new Promise(setImmediate);
  cursor = 0;
  return nos(renderizar(api.useConfigAcesso()));
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
  for (const google of [false, true]) {
    for (const chave of [undefined, 'ligado', 'desligado']) {
      const lista = await provedoresDoAcesso({ google, env: { EXPO_PUBLIC_STUDOO_GOOGLE_NATIVO: chave } });
      assert.equal(lista.some(no => no.props?.testID === 'login-google'), google && chave !== 'desligado', `servidor=${google}, build=${chave}`);
    }
  }
  for (const apple of [false, true]) {
    for (const appleElegivel of [false, true]) {
      const lista = await provedoresDoAcesso({ apple, appleElegivel });
      assert.equal(lista.some(no => no.props?.testID === 'login-apple'), apple && appleElegivel, `Apple servidor=${apple}, aparelho=${appleElegivel}`);
    }
  }
  const eas = JSON.parse(await readFile(new URL('../apps/mobile/eas.json', import.meta.url), 'utf8'));
  const perfil = eas.build.testflight;
  assert.equal(perfil.ios.simulator, undefined);
  assert.equal(perfil.distribution, 'store');
  assert.match(perfil.env.EXPO_PUBLIC_STUDOO_API_URL, /^https:\/\//);
  // Decisão de 20/11: nenhum perfil desliga o Google; no iPhone ele vem com a Apple (4.8), que o app.json habilita.
  for (const nome of Object.keys(eas.build)) {
    assert.notEqual(eas.build[nome].env?.EXPO_PUBLIC_STUDOO_GOOGLE_NATIVO, 'desligado', nome);
  }
  const app = JSON.parse(await readFile(new URL('../apps/mobile/app.json', import.meta.url), 'utf8'));
  assert.equal(app.expo.ios.usesAppleSignIn, true);
  assert.ok(app.expo.plugins.includes('expo-apple-authentication'));
  const testflight = await provedoresDoAcesso({ env: perfil.env });
  const google = testflight.find(no => no.props?.testID === 'login-google');
  const apple = testflight.find(no => no.props?.testID === 'login-apple');
  assert.ok(google && apple, 'TestFlight oferece ambos quando servidor e aparelho habilitam');
  assert.ok(testflight.indexOf(google) < testflight.indexOf(apple), 'Google vem antes da Apple');
  const oficial = testflight.find(no => no.type === 'AppleOficial');
  assert.equal(oficial.props.buttonType, 'CONTINUE');
  assert.equal(oficial.props.buttonStyle, 'WHITE_OUTLINE');
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
