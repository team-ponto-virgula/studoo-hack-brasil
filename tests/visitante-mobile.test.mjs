import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// "Experimentar sem conta" no app (rodada 4.3), no molde do test:google-mobile: o módulo nativo roda com o cliente e o
// SecureStore simulados.
const fonte = await readFile(new URL('../apps/mobile/src/visitante-nativo.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS } });

function ambiente({ token = randomBytes(32).toString('base64url'), erro, falharArmazenamento = false, atraso } = {}) {
  const chamadas = { pedidos: 0, salvo: null, logout: 0, tokenDoLogout: null };
  class ErroStudoo extends Error { constructor(codigo) { super(codigo); this.codigo = codigo; } }
  const modulos = {
    '@studoo/contratos': { ErroStudoo },
    './api-nativa': {
      guardarToken: async (valor) => { if (falharArmazenamento) throw new Error('SecureStore indisponível'); chamadas.salvo = valor; },
      criarClienteNativo: (comToken) => ({
        entrarVisitanteNativo: async () => {
          chamadas.pedidos += 1;
          if (atraso) await atraso;
          if (erro) throw new ErroStudoo(erro);
          return { token, expiraEm: new Date(Date.now() + 86_400_000).toISOString() };
        },
        logout: async () => { chamadas.logout += 1; chamadas.tokenDoLogout = comToken; },
      }),
    },
  };
  const exports = {};
  runInNewContext(outputText, { exports, require: (nome) => modulos[nome] });
  return { api: exports, chamadas, token };
}

test('visitante: pede a conta temporária pela rota do app e guarda o token no SecureStore', async () => {
  const a = ambiente();
  assert.equal(await a.api.entrarComoVisitante(), a.token);
  assert.equal(a.chamadas.pedidos, 1);
  assert.equal(a.chamadas.salvo, a.token);
  assert.equal(a.chamadas.logout, 0);
});

test('visitante: dois toques seguidos fazem um pedido só', async () => {
  let liberar;
  const atraso = new Promise((resolve) => { liberar = resolve; });
  const a = ambiente({ atraso });
  const primeiro = a.api.entrarComoVisitante();
  const segundo = a.api.entrarComoVisitante();
  liberar();
  assert.equal(await primeiro, a.token);
  assert.equal(await segundo, a.token);
  assert.equal(a.chamadas.pedidos, 1);
});

test('visitante: limite_visitante chega com o código e nada é guardado', async () => {
  const a = ambiente({ erro: 'limite_visitante' });
  await assert.rejects(a.api.entrarComoVisitante(), (erro) => erro.codigo === 'limite_visitante');
  assert.equal(a.chamadas.salvo, null);
  // Depois de um erro, um toque novo faz outro pedido (não fica preso no anterior).
  await assert.rejects(a.api.entrarComoVisitante());
  assert.equal(a.chamadas.pedidos, 2);
});

test('visitante: token fora do formato não é guardado', async () => {
  const a = ambiente({ token: 'curto' });
  await assert.rejects(a.api.entrarComoVisitante(), (erro) => erro.codigo === 'falha');
  assert.equal(a.chamadas.salvo, null);
});

test('visitante: falha ao guardar encerra no servidor a sessão recém-criada', async () => {
  const a = ambiente({ falharArmazenamento: true });
  await assert.rejects(a.api.entrarComoVisitante());
  assert.equal(a.chamadas.logout, 1);
  assert.equal(a.chamadas.tokenDoLogout, a.token);
});

// Executa a EntradaMobile e seu hook real com dublês dos componentes nativos. A árvore JSX é inspecionada sem
// montar a interface nativa; os toques e as atualizações assíncronas executam o código de produção.
const { mensagens } = await import('../packages/contratos/src/experiencia.ts');
const { normalizarEmailEntrada } = await import('../packages/contratos/src/autenticacao.ts');
const acessoJs = ts.transpileModule(await readFile(new URL('../apps/mobile/src/acesso-mobile.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function entrada({ visitante, entrarVisitante = async () => {} } = {}) {
  const estados = [], efeitos = [];
  let cursor = 0, pendentes = [];
  const hooks = {
    useState(inicial) {
      const i = cursor++;
      if (!(i in estados)) estados[i] = typeof inicial === 'function' ? inicial() : inicial;
      return [estados[i], valor => { estados[i] = typeof valor === 'function' ? valor(estados[i]) : valor; }];
    },
    useRef(inicial) { const i = cursor++; return estados[i] ??= { current: inicial }; },
    useEffect(acao, deps) {
      const i = cursor++;
      if (!efeitos[i] || !deps || deps.some((v, n) => !Object.is(v, efeitos[i].deps?.[n]))) {
        const anterior = efeitos[i];
        efeitos[i] = { deps };
        pendentes.push(() => { anterior?.limpar?.(); efeitos[i].limpar = acao(); });
      }
    },
    useContext: () => null,
  };
  class ErroStudoo extends Error { constructor(codigo) { super(codigo); this.codigo = codigo; } }
  const elemento = (type, props) => ({ type, props });
  const modulos = {
    react: hooks,
    'react/jsx-runtime': { jsx: elemento, jsxs: elemento, Fragment: 'Fragment' },
    'react-native': { StyleSheet: { create: valor => valor }, Platform: { OS: 'web' }, Keyboard: { dismiss() {} },
      View: 'View', Text: 'Text', Pressable: 'Pressable', TextInput: 'TextInput', Image: 'Image', ActivityIndicator: 'ActivityIndicator' },
    'expo-apple-authentication': {},
    'react-native-safe-area-context': {},
    '@studoo/contratos': { ErroStudoo },
    '@studoo/contratos/autenticacao': { normalizarEmailEntrada },
    './api-nativa': { criarClienteNativo: () => ({ configuracaoAcesso: async () => ({ visitante, google: false, apple: false, cadastro: false, recuperacao: false }) }) },
    './apple-nativo': { appleDisponivelNoAparelho: async () => false },
    './google-nativo': { googleNoAparelho: () => false },
    './marca-google': {}, './icone': {}, './interface': {}, './movimento': {}, './foco': {}, './mascote': {},
    './mensagens': { mensagens: { ...mensagens, entrada: mensagens.login }, mensagemDeErro: erro => mensagens.erros[erro.codigo] ?? mensagens.erros.falha },
    './seguranca': {}, './voltar': {},
    '../assets/marca/logo-com-sorriso.png': 0, '../assets/marca/abertura-oculos-hd.png': 0,
  };
  const api = {};
  runInNewContext(acessoJs, { exports: api, require(nome) { assert.ok(nome in modulos, `módulo sem dublê: ${nome}`); return modulos[nome]; }, setTimeout, clearTimeout });
  const props = { entrar: async () => {}, google: async () => {}, apple: async () => {}, criarConta() {}, visitante: entrarVisitante, recuperar() {} };
  function render() {
    cursor = 0;
    const arvore = api.EntradaMobile(props);
    const fila = pendentes; pendentes = []; fila.forEach(efeito => efeito());
    return arvore;
  }
  return { render, ErroStudoo, api, async atualizar() { await new Promise(setImmediate); return render(); } };
}

function nos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(nos);
  if (!arvore || typeof arvore !== 'object') return [];
  return [arvore, ...nos(arvore.props?.children)];
}
const porId = (arvore, id) => nos(arvore).find(no => no.props?.testID === id);
function textos(arvore) {
  if (Array.isArray(arvore)) return arvore.map(textos).join(' ');
  if (typeof arvore === 'string' || typeof arvore === 'number') return String(arvore);
  return textos(arvore?.props?.children ?? []);
}

test('entrada: só a configuração visitante estritamente true oferece experimentar sem conta', async () => {
  for (const visitante of [false, undefined, 'true', 1, true]) {
    const a = entrada({ visitante });
    assert.equal(porId(a.render(), 'experimentar-sem-conta'), undefined, 'não oferece antes de consultar a configuração');
    const arvore = await a.atualizar();
    assert.equal(Boolean(porId(arvore, 'experimentar-sem-conta')), visitante === true, `visitante=${visitante}`);
  }
});

test('entrada: informa duração e ausência de migração antes de confirmar; dois toques criam uma sessão só', async () => {
  let chamadas = 0, liberar;
  const pedido = new Promise(resolve => { liberar = resolve; });
  const a = entrada({ visitante: true, entrarVisitante: async () => { chamadas++; await pedido; } });
  a.render();
  let arvore = await a.atualizar();
  assert.equal(porId(arvore, 'confirmar-visitante'), undefined);
  porId(arvore, 'experimentar-sem-conta').props.acao();
  arvore = a.render();
  assert.equal(chamadas, 0, 'abrir o aviso não cria sessão');
  assert.match(textos(arvore), /24 horas neste aparelho e não é transferido para uma conta/);
  const confirmar = porId(arvore, 'confirmar-visitante');
  confirmar.props.acao(); confirmar.props.acao();
  assert.equal(chamadas, 1);
  assert.equal(porId(a.render(), 'confirmar-visitante').props.desativado, true);
  liberar();
  assert.equal(porId(await a.atualizar(), 'confirmar-visitante').props.desativado, false);
});

test('entrada: a recusa por limite mostra a mensagem do contrato e permite uma nova tentativa', async () => {
  let chamadas = 0;
  const a = entrada({ visitante: true, entrarVisitante: async () => { chamadas++; throw new a.ErroStudoo('limite_visitante'); } });
  a.render();
  porId(await a.atualizar(), 'experimentar-sem-conta').props.acao();
  porId(a.render(), 'confirmar-visitante').props.acao();
  const arvore = await a.atualizar();
  const erro = nos(arvore).find(no => no.type === a.api.ErroAcesso);
  assert.equal(erro.props.mensagem, mensagens.erros.limite_visitante);
  assert.equal(porId(arvore, 'confirmar-visitante').props.desativado, false);
  porId(arvore, 'confirmar-visitante').props.acao();
  await a.atualizar();
  assert.equal(chamadas, 2);
});
