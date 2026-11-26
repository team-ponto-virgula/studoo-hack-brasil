import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// O "G" oficial do Google no "Continuar com Google" do app (spec 06, regra de 20/11): o mesmo PNG da web em
// packages/contratos/assets, 20 × 20 à esquerda do rótulo, decorativo, na entrada e no cadastro com a mesma implementação.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const ladoDoPng = async (caminho) => { const b = await readFile(new URL(caminho, raiz)); assert.equal(b.toString('ascii', 1, 4), 'PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('o ativo é um só, compartilhado com a web, nas três densidades (20, 40 e 60 px)', async () => {
  assert.deepEqual(await ladoDoPng('packages/contratos/assets/google-g.png'), [20, 20]);
  assert.deepEqual(await ladoDoPng('packages/contratos/assets/google-g@2x.png'), [40, 40]);
  assert.deepEqual(await ladoDoPng('packages/contratos/assets/google-g@3x.png'), [60, 60]);
  const marca = await ler('apps/mobile/src/marca-google.ts');
  assert.match(marca, /fonte: require\('\.\.\/\.\.\/\.\.\/packages\/contratos\/assets\/google-g\.png'\),\s*tamanho: 20,/);
});

// O componente compartilhado é executado com JSX de teste: verifica a ordem efetiva, as capacidades e os callbacks.
async function provedores(props) {
  const fonte = await ler('apps/mobile/src/acesso-mobile.tsx');
  const ast = ts.createSourceFile('acesso.tsx', fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaracao = ast.statements.find(no => ts.isFunctionDeclaration(no) && no.name?.text === 'ProvedoresAcesso');
  assert.ok(declaracao);
  const js = ts.transpileModule(declaracao.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const elemento = (type, props) => ({ type, props });
  const api = {};
  const s = new Proxy({}, { get: (_, chave) => chave });
  const AppleAuthentication = { AppleAuthenticationButton: 'AppleOficial', AppleAuthenticationButtonType: { CONTINUE: 'CONTINUE' }, AppleAuthenticationButtonStyle: { WHITE_OUTLINE: 'WHITE_OUTLINE' } };
  runInNewContext(js, { exports: api, require: () => ({ jsx: elemento, jsxs: elemento }), s,
    View: 'View', Pressable: 'Pressable', Image: 'Image', Text: 'Text', LOGO_GOOGLE: { fonte: 'google-oficial' },
    mensagens: { acesso: { google: 'Continuar com Google' } }, AppleAuthentication });
  return api.ProvedoresAcesso(props);
}
function nos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(nos);
  if (!arvore || typeof arvore !== 'object') return [];
  return [arvore, ...nos(arvore.props?.children)];
}

test('o Google vem antes da Apple oficial; capacidades desligadas não expõem botões nem callbacks', async () => {
  const chamadas = [];
  const props = { google: () => chamadas.push('google'), apple: () => chamadas.push('apple'), ocupado: false, executar: acao => acao() };
  assert.equal(await provedores({ ...props, config: { google: false, apple: false } }), null);
  const arvore = await provedores({ ...props, config: { google: true, apple: true } });
  const lista = nos(arvore);
  const google = lista.find(no => no.props?.testID === 'login-google');
  const apple = lista.find(no => no.props?.testID === 'login-apple');
  assert.ok(lista.indexOf(google) < lista.indexOf(apple));
  google.props.onPress();
  const oficial = lista.find(no => no.type === 'AppleOficial');
  oficial.props.onPress();
  assert.deepEqual(chamadas, ['google', 'apple']);
  assert.equal(oficial.props.buttonStyle, 'WHITE_OUTLINE');
  assert.equal(oficial.props.buttonType, 'CONTINUE');
  const somenteGoogle = nos(await provedores({ ...props, config: { google: true, apple: false }, prefixo: 'cadastro' }));
  assert.ok(somenteGoogle.some(no => no.props?.testID === 'cadastro-google'));
  assert.ok(!somenteGoogle.some(no => no.type === 'AppleOficial'));
});

test('entrada e cadastro usam o mesmo botão oficial de Google, sem uma segunda implementação', async () => {
  const acesso = await ler('apps/mobile/src/acesso-mobile.tsx');
  const cadastro = await ler('apps/mobile/src/cadastro.tsx');
  const acessoAst = ts.createSourceFile('acesso.tsx', acesso, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const entrada = acessoAst.statements.find(no => ts.isFunctionDeclaration(no) && no.name?.text === 'EntradaMobile')?.getText(acessoAst);
  assert.ok(entrada, 'o login continua definido como componente próprio');
  assert.match(entrada, /<ProvedoresAcesso config=\{config\} google=\{google\} apple=\{apple\}/);
  const ast = ts.createSourceFile('cadastro.tsx', cadastro, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let compartilhado;
  function visitar(no) {
    if (ts.isJsxSelfClosingElement(no) && no.tagName.getText(ast) === 'ProvedoresAcesso') compartilhado = no;
    ts.forEachChild(no, visitar);
  }
  visitar(ast);
  assert.ok(compartilhado, 'o cadastro usa o componente compartilhado');
  assert.match(compartilhado.getText(ast), /prefixo="cadastro"/);
  assert.match(compartilhado.parent.getText(ast), /etapa === 'email' &&/);
});

test('a imagem oficial é decorativa, 20 × 20, e os dois provedores ficam indisponíveis durante o envio', async () => {
  const arvore = await provedores({ config: { google: true, apple: true }, google() {}, apple() {}, ocupado: true, executar() {} });
  const lista = nos(arvore);
  const imagem = lista.find(no => no.type === 'Image');
  assert.equal(imagem.props.source, 'google-oficial');
  assert.equal(imagem.props.accessible, false);
  assert.deepEqual(JSON.parse(JSON.stringify(imagem.props.style)), { width: 20, height: 20 });
  assert.equal(imagem.props.accessibilityLabel, undefined);
  assert.equal(lista.find(no => no.props?.testID === 'login-google').props.disabled, true);
  assert.equal(lista.find(no => no.props?.testID === 'login-apple').props.pointerEvents, 'none');
  assert.equal(lista.find(no => no.props?.testID === 'login-apple').props.accessibilityState.disabled, true);
});
