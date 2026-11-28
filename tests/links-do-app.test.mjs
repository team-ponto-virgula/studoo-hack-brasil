import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  CAMINHOS_DOS_EMAILS,
  VALIDADE_EMAIL_LEMBRADO_MS,
  codigoDoFragmento,
  emailDaLembranca,
  lembrancaDoEmail,
  linkComCodigo,
} from '../packages/contratos/src/autenticacao.ts';
import { APP_NATIVO, CAMINHOS_DO_APP, associacaoAndroid, associacaoApple } from '../src/links-do-app.ts';
import { ORIGEM_APP_STUDOO } from '../src/enderecos-publicos.ts';
import { GET as getApple } from '../src/app/.well-known/apple-app-site-association/route.ts';
import { GET as getAndroid } from '../src/app/.well-known/assetlinks.json/route.ts';

// Os links dos e-mails abrem o app quando ele está instalado (links universais no iPhone, App Links no Android) e o
// site quando não: o código vai no fragmento, e o e-mail fica lembrado só no aparelho que pediu o código.
const ler = (caminho) => readFileSync(new URL(`../${caminho}`, import.meta.url), 'utf8');
const appJson = JSON.parse(ler('apps/mobile/app.json')).expo;
const easJson = JSON.parse(ler('apps/mobile/eas.json'));
const HOST = new URL(ORIGEM_APP_STUDOO).host;
/** Objetos que nascem dentro do vm têm outro protótipo: compara pelo conteúdo. */
const plano = (valor) => JSON.parse(JSON.stringify(valor));

test('o código vai no fragmento e só um código de 6 dígitos é aceito de volta', () => {
  assert.equal(linkComCodigo('https://app.hellostudoo.com.br/cadastro', '482913'), 'https://app.hellostudoo.com.br/cadastro#codigo=482913');
  // Um fragmento que já existia não se soma ao do código.
  assert.equal(linkComCodigo('https://app.hellostudoo.com.br/recuperar#velho', '000123'), 'https://app.hellostudoo.com.br/recuperar#codigo=000123');
  for (const [fragmento, esperado] of [
    ['#codigo=482913', '482913'], ['codigo=482913', '482913'], ['#outra=1&codigo=482913', '482913'], ['codigo=482913&x=1', '482913'],
    ['#codigo=48291', null], ['#codigo=4829130', null], ['#codigo=48a913', null], ['#codigo=', null], ['#xcodigo=482913', null],
    ['', null], [null, null], [undefined, null], ['#codigo=%34%38%32%39%31%33', null],
  ]) assert.equal(codigoDoFragmento(fragmento), esperado, String(fragmento));
});

test('o e-mail lembrado vale pelo tempo do código e só no formato certo', () => {
  const agora = 1_800_000_000_000;
  assert.equal(VALIDADE_EMAIL_LEMBRADO_MS, 15 * 60_000);
  const guardado = lembrancaDoEmail('Pessoa@Example.com ', agora);
  assert.equal(emailDaLembranca(guardado, agora), 'pessoa@example.com');
  assert.equal(emailDaLembranca(guardado, agora + VALIDADE_EMAIL_LEMBRADO_MS - 1), 'pessoa@example.com');
  assert.equal(emailDaLembranca(guardado, agora + VALIDADE_EMAIL_LEMBRADO_MS), null, 'vencido junto com o código');
  for (const estragado of [null, undefined, '', 'x', '{}', '[]', 'null', JSON.stringify({ email: 'sem-arroba', ate: agora + 1000 }),
    JSON.stringify({ email: 'a@b.co', ate: String(agora + 1000) }), JSON.stringify({ email: 'a@b.co', ate: agora + VALIDADE_EMAIL_LEMBRADO_MS + 60_000 })]) {
    assert.equal(emailDaLembranca(estragado, agora), null, String(estragado));
  }
});

test('o site publica a associação com o app, igual à do app.json e à do eas.json', async () => {
  const bundle = appJson.ios.bundleIdentifier;
  const equipe = easJson.submit.testflight.ios.appleTeamId;
  assert.equal(APP_NATIVO.appleAppId, `${equipe}.${bundle}`);
  assert.equal(APP_NATIVO.pacoteAndroid, appJson.android.package);
  for (const certificado of APP_NATIVO.certificadosAndroid) assert.match(certificado, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);

  // Só as telas dos e-mails abrem o app; o resto do site (a raiz, /api, /baixar) continua no navegador.
  assert.deepEqual([...CAMINHOS_DO_APP].sort(), Object.values(CAMINHOS_DOS_EMAILS).sort());
  assert.deepEqual(associacaoApple(), {
    applinks: { details: [{ appIDs: [APP_NATIVO.appleAppId], components: CAMINHOS_DO_APP.map((c) => ({ '/': c })) }] },
    webcredentials: { apps: [APP_NATIVO.appleAppId] },
  });
  assert.deepEqual(associacaoAndroid()[0].target, { namespace: 'android_app', package_name: appJson.android.package, sha256_cert_fingerprints: APP_NATIVO.certificadosAndroid });
  assert.ok(associacaoAndroid()[0].relation.includes('delegate_permission/common.handle_all_urls'));

  // As rotas respondem JSON direto (a Apple e o Google não seguem redirecionamento).
  for (const [get, esperado] of [[getApple, associacaoApple()], [getAndroid, associacaoAndroid()]]) {
    const resposta = get();
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('content-type'), 'application/json');
    assert.equal(resposta.headers.get('location'), null);
    assert.deepEqual(await resposta.json(), esperado);
  }
  // O proxy (CSP, redirecionamento da landing) não pega /.well-known.
  assert.doesNotMatch(ler('src/proxy.ts'), /well-known/);
});

test('o app declara o domínio: links universais no iPhone e App Links verificados no Android', () => {
  assert.deepEqual(appJson.ios.associatedDomains, [`applinks:${HOST}`, `webcredentials:${HOST}`]);
  const filtros = appJson.android.intentFilters;
  assert.equal(filtros.length, 1);
  const [filtro] = filtros;
  assert.equal(filtro.action, 'VIEW');
  assert.equal(filtro.autoVerify, true);
  assert.deepEqual(filtro.category.sort(), ['BROWSABLE', 'DEFAULT']);
  assert.deepEqual(filtro.data, CAMINHOS_DO_APP.map((path) => ({ scheme: 'https', host: HOST, path })));
});

test('cada link do e-mail tem a rota dele no app, que abre a tela certa com o código do fragmento', () => {
  const telas = { [CAMINHOS_DOS_EMAILS.entrar]: 'entrar', [CAMINHOS_DOS_EMAILS.cadastro]: 'cadastro', [CAMINHOS_DOS_EMAILS.recuperar]: 'recuperar' };
  for (const caminho of CAMINHOS_DO_APP) {
    const arquivo = `apps/mobile/app${caminho}.tsx`;
    assert.ok(existsSync(new URL(`../${arquivo}`, import.meta.url)), arquivo);
    const rota = ler(arquivo);
    assert.match(rota, new RegExp(`acessoDosParametros\\('${telas[caminho]}', useLocalSearchParams\\(\\)\\)`), arquivo);
    assert.match(rota, /<Inicio key=\{acesso\.codigo \?\? '[a-z]+'\} acesso=\{acesso\} \/>/, arquivo);
  }
  assert.match(ler('apps/mobile/app/index.tsx'), /<AppMobile destino=\{destino\} acesso=\{acesso\} \/>/);
});

function moduloDoApp() {
  const fonte = ler('apps/mobile/src/codigo-do-link.ts');
  const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const guardados = new Map();
  let falhar = false;
  const SecureStore = {
    setItemAsync: async (chave, valor) => { if (falhar) throw new Error('SecureStore indisponível'); guardados.set(chave, valor); },
    getItemAsync: async (chave) => { if (falhar) throw new Error('SecureStore indisponível'); return guardados.get(chave) ?? null; },
    deleteItemAsync: async (chave) => { if (falhar) throw new Error('SecureStore indisponível'); guardados.delete(chave); },
  };
  const modulos = { 'expo-secure-store': SecureStore, '@studoo/contratos/autenticacao': { codigoDoFragmento, emailDaLembranca, lembrancaDoEmail } };
  const exports = {};
  runInNewContext(outputText, { exports, require: (nome) => { assert.ok(nome in modulos, `módulo sem dublê: ${nome}`); return modulos[nome]; } });
  return { app: exports, guardados, falha: (v) => { falhar = v; } };
}

test('app: o fragmento chega em params["#"], e o e-mail fica no SecureStore até a conta ou a senha nova', async () => {
  const { app, guardados, falha } = moduloDoApp();
  assert.deepEqual(plano(app.acessoDosParametros('cadastro', { '#': 'codigo=482913' })), { tela: 'cadastro', codigo: '482913' });
  assert.deepEqual(plano(app.acessoDosParametros('recuperar', { '#': 'codigo=12' })), { tela: 'recuperar', codigo: null });
  assert.deepEqual(plano(app.acessoDosParametros('entrar', {})), { tela: 'entrar', codigo: null });
  assert.deepEqual(plano(app.acessoDosParametros('cadastro', { '#': ['codigo=482913'] })), { tela: 'cadastro', codigo: null });

  assert.equal(await app.emailDoCodigo(), null);
  await app.lembrarEmailDoCodigo('pessoa@example.com');
  assert.equal([...guardados.keys()].join(), 'studoo.email-do-codigo');
  assert.equal(await app.emailDoCodigo(), 'pessoa@example.com');
  await app.esquecerEmailDoCodigo();
  assert.equal(await app.emailDoCodigo(), null);
  // Sem SecureStore, nada quebra: a tela só pede o e-mail de novo.
  falha(true);
  await app.lembrarEmailDoCodigo('pessoa@example.com');
  assert.equal(await app.emailDoCodigo(), null);
  await app.esquecerEmailDoCodigo();
});

test('app: sem sessão, o link abre a tela dele; com sessão, o app abre como sempre', () => {
  const sessao = ler('apps/mobile/src/sessao.tsx');
  assert.match(sessao, /if \(!token\) \{\s*const inicial = await telaDoLink\(acesso\);\s*if \(ativo\) setSessao\(inicial\);\s*return;\s*\}/);
  assert.equal(sessao.match(/telaDoLink\(/g).length, 2, 'só a restauração sem token usa o link');
  assert.match(sessao, /if \(acesso\.tela === 'cadastro'\) return \{ tipo: 'cadastro', email, codigo \};/);
  assert.match(sessao, /if \(acesso\.tela === 'recuperar'\) return \{ tipo: 'recuperar', email, codigo \};/);
  assert.match(sessao, /return \{ tipo: 'entrada', email \};/);
  assert.match(sessao, /<CriarConta emailInicial=\{sessao\.email\} codigoInicial=\{sessao\.codigo\}/);
  assert.match(sessao, /<RecuperarAcesso emailInicial=\{sessao\.email\} codigoInicial=\{sessao\.codigo\}/);
  assert.match(sessao, /<Entrada erroInicial=\{sessao\.erro\} emailInicial=\{sessao\.email\}/);
  assert.match(sessao, /const \[email, setEmail\] = useState\(emailInicial \?\? ''\);/);
  assert.match(sessao, /await abrirSessao\(token\);\s*void esquecerEmailDoCodigo\(\);/);
});

test('app e web: a tela aberta pelo link vai direto ao passo da senha, e quem pede o código lembra o e-mail', () => {
  const cadastroApp = ler('apps/mobile/src/cadastro.tsx');
  assert.match(cadastroApp, /useState<'email' \| 'codigo'>\(codigoInicial \? 'codigo' : 'email'\)/);
  assert.match(cadastroApp, /useState\(codigoInicial \?\? ''\)/);
  assert.match(cadastroApp, /pedirCodigoCadastro\(normalizado, true\);\s*void lembrarEmailDoCodigo\(normalizado\);/);
  assert.match(cadastroApp, /editable=\{!ocupado && \(etapa === 'email' \|\| doLink === 'sem-email'\)\}/);
  assert.match(cadastroApp, /m\.codigoDoLink : doLink === 'sem-email' \? m\.codigoDoLinkSemEmail : m\.enviado/);

  const recuperarApp = ler('apps/mobile/src/recuperar.tsx');
  assert.match(recuperarApp, /useState<'email' \| 'codigo' \| 'pronto'>\(codigoInicial \? 'codigo' : 'email'\)/);
  assert.match(recuperarApp, /recuperarSenha\(email\.trim\(\), true\);\s*void lembrarEmailDoCodigo\(email\.trim\(\)\);/);
  assert.match(recuperarApp, /redefinirSenha\(email\.trim\(\), codigo, senha, true\);\s*void esquecerEmailDoCodigo\(\);/);

  const cadastroWeb = ler('src/app/cadastro/cadastro.tsx');
  assert.match(cadastroWeb, /const codigoDoLink = tomarCodigoDoLink\(\);/);
  assert.match(cadastroWeb, /pedirCodigoCadastro\(normalizado\);\s*lembrarEmailDoCodigo\(normalizado\);/);
  assert.match(cadastroWeb, /cliente\.cadastrar\(normalizado, codigo, senha\);\s*esquecerEmailDoCodigo\(\);/);
  assert.match(cadastroWeb, /disabled=\{ocupado \|\| \(etapa === 'codigo' && doLink !== 'sem-email'\)\}/);

  const recuperarWeb = ler('src/app/recuperar/recuperar.tsx');
  assert.match(recuperarWeb, /const codigoDoLink = tomarCodigoDoLink\(\);/);
  assert.match(recuperarWeb, /recuperarSenha\(email\.trim\(\)\);\s*lembrarEmailDoCodigo\(email\.trim\(\)\);/);
  assert.match(recuperarWeb, /redefinirSenha\(email\.trim\(\), codigo, senha\);\s*esquecerEmailDoCodigo\(\);/);
});

function moduloDaWeb({ hash = '', semArmazenamento = false } = {}) {
  const fonte = ler('src/app/codigo-do-link.ts');
  const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const guardados = new Map();
  const trocas = [];
  const localStorage = {
    setItem: (c, v) => { if (semArmazenamento) throw new Error('bloqueado'); guardados.set(c, v); },
    getItem: (c) => { if (semArmazenamento) throw new Error('bloqueado'); return guardados.get(c) ?? null; },
    removeItem: (c) => { if (semArmazenamento) throw new Error('bloqueado'); guardados.delete(c); },
  };
  const window = {
    location: { hash, pathname: '/cadastro', search: '?origem=email' },
    history: { state: { __next: 1 }, replaceState: (estado, _titulo, endereco) => trocas.push({ estado, endereco }) },
  };
  const modulos = { '@studoo/contratos/autenticacao': { codigoDoFragmento, emailDaLembranca, lembrancaDoEmail } };
  const exports = {};
  runInNewContext(outputText, { exports, window, localStorage, require: (nome) => { assert.ok(nome in modulos, `módulo sem dublê: ${nome}`); return modulos[nome]; } });
  return { web: exports, trocas, guardados };
}

test('web: o código sai do endereço assim que é lido, e o e-mail lembrado some depois de usado', () => {
  const comCodigo = moduloDaWeb({ hash: '#codigo=482913' });
  assert.equal(comCodigo.web.tomarCodigoDoLink(), '482913');
  assert.deepEqual(comCodigo.trocas, [{ estado: { __next: 1 }, endereco: '/cadastro?origem=email' }]);

  const invalido = moduloDaWeb({ hash: '#codigo=abc' });
  assert.equal(invalido.web.tomarCodigoDoLink(), null);
  assert.equal(invalido.trocas.length, 1, 'mesmo inválido, o fragmento sai do endereço');

  const semFragmento = moduloDaWeb();
  assert.equal(semFragmento.web.tomarCodigoDoLink(), null);
  assert.equal(semFragmento.trocas.length, 0);

  const { web, guardados } = moduloDaWeb();
  web.lembrarEmailDoCodigo('pessoa@example.com');
  assert.equal(web.emailDoCodigo(), 'pessoa@example.com');
  assert.deepEqual([...guardados.keys()], ['studoo.email-do-codigo']);
  web.esquecerEmailDoCodigo();
  assert.equal(web.emailDoCodigo(), null);

  const bloqueado = moduloDaWeb({ semArmazenamento: true }).web;
  bloqueado.lembrarEmailDoCodigo('pessoa@example.com');
  assert.equal(bloqueado.emailDoCodigo(), null);
  bloqueado.esquecerEmailDoCodigo();
});
