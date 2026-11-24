import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Executa o TSX e o store reais com um host pequeno de hooks, eventos e relógio.
// Não desenha pixels nem simula UIKit, o driver nativo, VoiceOver ou um aparelho.
// Para observar as regressões na fonte anterior, sem trocar a worktree:
// STUDOO_INTRO_TEST_REF=e5bb84c node --test tests/abertura-inicializacao-mobile.test.mjs
const raiz = new URL('../', import.meta.url);
const referencia = process.env.STUDOO_INTRO_TEST_REF;
if (referencia) assert.match(referencia, /^[a-f\d]{7,40}$/i);
async function fonte(caminho) {
  return referencia
    ? execFileSync('git', ['show', `${referencia}:${caminho}`], { cwd: raiz, encoding: 'utf8' })
    : readFile(new URL(caminho, raiz), 'utf8');
}
const caminhos = ['packages/contratos/src/abertura.ts', 'apps/mobile/src/movimento.ts', 'apps/mobile/src/abertura.tsx'];
const codigos = await Promise.all(caminhos.map(async (p) => ts.transpileModule(await fonte(p), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText));
const movimento = JSON.parse(await fonte('packages/contratos/src/abertura-motion.json'));

function adiado() {
  let resolve, reject;
  const promise = new Promise((ok, erro) => { resolve = ok; reject = erro; });
  return { promise, resolve, reject };
}
function nos(arvore) {
  if (Array.isArray(arvore)) return arvore.flatMap(nos);
  if (!arvore || typeof arvore !== 'object') return [];
  return [arvore, ...nos(arvore.props?.children)];
}
function iguais(a, b) {
  return Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
}

function ambiente({ estadoInicial = 'active', plataforma = 'ios', caminho = '/', parametros = {} } = {}) {
  let agora = 0, sequencia = 0, cursor = 0, slots = [], efeitos = [], arvore, sujo = false, montado = false;
  let props = { pronta: true, children: { type: 'Conteudo', props: {} } };
  const tarefas = new Map(), eventos = new Map(), animacoes = [], splash = [], erros = [];
  const preferencia = adiado(), leitor = adiado();
  const agendar = (acao, atraso = 0) => {
    const id = ++sequencia;
    tarefas.set(id, { quando: agora + Math.max(0, atraso), acao });
    return id;
  };
  const cancelar = (id) => tarefas.delete(id);
  const assinarEvento = (nome, callback) => {
    const grupo = eventos.get(nome) ?? new Set();
    eventos.set(nome, grupo); grupo.add(callback);
    return { remove: () => grupo.delete(callback) };
  };
  const appState = {
    currentState: estadoInicial,
    addEventListener: (nome, callback) => assinarEvento(`app:${nome}`, callback),
  };
  const hooks = {
    useState(inicial) {
      const i = cursor++;
      slots[i] ??= { valor: typeof inicial === 'function' ? inicial() : inicial };
      return [slots[i].valor, (novo) => {
        const valor = typeof novo === 'function' ? novo(slots[i].valor) : novo;
        if (!Object.is(valor, slots[i].valor)) { slots[i].valor = valor; sujo = true; }
      }];
    },
    useRef(inicial) {
      const i = cursor++;
      slots[i] ??= { current: inicial };
      return slots[i];
    },
    useMemo(criar, deps) {
      const i = cursor++;
      if (!slots[i] || !iguais(slots[i].deps, deps)) slots[i] = { deps, valor: criar() };
      return slots[i].valor;
    },
    useEffect(criar, deps) {
      const i = cursor++;
      if (!slots[i] || !iguais(slots[i].deps, deps)) {
        const anterior = slots[i];
        slots[i] = { deps, criar, cleanup: anterior?.cleanup };
        efeitos.push(() => { slots[i].cleanup?.(); slots[i].cleanup = criar(); });
      }
    },
    useSyncExternalStore(assinar, snapshot) {
      const i = cursor++;
      if (!slots[i]) {
        slots[i] = { criar: () => assinar(() => { sujo = true; }) };
        efeitos.push(() => { slots[i].cleanup = slots[i].criar(); });
      }
      return snapshot();
    },
  };
  class ValorAnimado {
    constructor(valor) { this.valor = valor; }
    setValue(valor) { this.valor = valor; }
    interpolate(configuracao) { return configuracao; }
  }
  const nativo = {
    AppState: appState,
    AccessibilityInfo: {
      addEventListener: (nome, callback) => assinarEvento(`acesso:${nome}`, callback),
      isReduceMotionEnabled: () => preferencia.promise,
      isScreenReaderEnabled: () => leitor.promise,
    },
    Platform: { OS: plataforma },
    Animated: {
      Value: ValorAnimado, View: 'Animated.View', Image: 'Animated.Image',
      timing(valor, opcoes) {
        let tarefa, callback, terminou = false;
        return {
          start(aoTerminar) {
            callback = aoTerminar;
            animacoes.push({ em: agora, duracao: opcoes.duration, destino: opcoes.toValue, nativo: opcoes.useNativeDriver });
            tarefa = agendar(() => {
              terminou = true; valor.valor = opcoes.toValue; callback?.({ finished: true });
            }, opcoes.duration);
          },
          stop() {
            cancelar(tarefa);
            if (!terminou) { terminou = true; callback?.({ finished: false }); }
          },
        };
      },
    },
    BackHandler: { addEventListener: (nome, callback) => assinarEvento(`back:${nome}`, callback) },
    Easing: { bezier: () => (x) => x }, StyleSheet: { create: (estilos) => estilos },
    View: 'View', Image: 'Image',
  };
  const globais = {
    setTimeout: agendar, clearTimeout: cancelar,
    requestAnimationFrame: (cb) => agendar(cb, 16), cancelAnimationFrame: cancelar,
    performance: { now: () => agora }, Promise, Date, console,
  };
  const carregar = (codigo, imports) => {
    const exports = {};
    runInNewContext(codigo, { ...globais, exports, require: (nome) => {
      assert.ok(nome in imports, `módulo sem dublê: ${nome}`);
      return imports[nome];
    } });
    return exports;
  };
  const contrato = carregar(codigos[0], { './abertura-motion.json': movimento });
  const store = carregar(codigos[1], { react: hooks, 'react-native': nativo });
  const jsx = (type, props) => ({ type, props });
  const componente = carregar(codigos[2], {
    '@studoo/contratos/abertura': contrato, react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': nativo, 'expo-router': { usePathname: () => caminho, useGlobalSearchParams: () => parametros },
    expo: { isRunningInExpoGo: () => false },
    'expo-splash-screen': {
      preventAutoHideAsync: () => Promise.resolve(), setOptions() {},
      hideAsync: () => { splash.push({ em: agora }); return Promise.resolve(); },
    },
    './movimento': store, './tema': { cores: { acao: '#2563FF' } },
    '../assets/marca/logo-com-sorriso.png': 1, '../assets/marca/abertura-oculos-hd.png': 2,
  });
  function renderizar() {
    if (!montado) return;
    let rodadas = 0;
    do {
      assert.ok(++rodadas < 30, 'efeitos não devem criar um loop de render');
      cursor = 0; sujo = false; efeitos = [];
      arvore = componente.Abertura(props);
      const lote = efeitos; efeitos = []; lote.forEach((efeito) => efeito());
    } while (sujo);
  }
  async function estabilizar() {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      if (sujo) renderizar();
    }
  }
  async function avancar(ms) {
    await estabilizar();
    const fim = agora + ms;
    for (;;) {
      const proxima = [...tarefas].filter(([, t]) => t.quando <= fim)
        .sort((a, b) => a[1].quando - b[1].quando || a[0] - b[0])[0];
      if (!proxima) break;
      tarefas.delete(proxima[0]); agora = proxima[1].quando;
      try { proxima[1].acao(); } catch (erro) { erros.push(erro); throw erro; }
      if (sujo) renderizar();
      await estabilizar();
    }
    agora = fim; await estabilizar();
  }
  async function montar(atraso = 0) {
    if (atraso) await avancar(atraso);
    montado = true; renderizar(); await estabilizar();
  }
  async function prontoVisual() {
    nos(arvore).find((n) => n.props?.onLayout)?.props.onLayout();
    nos(arvore).filter((n) => n.props?.onLoad).forEach((n) => n.props.onLoad());
    if (sujo) renderizar();
    await estabilizar();
  }
  async function emitir(nome, valor) {
    if (nome === 'app:change') appState.currentState = valor;
    [...(eventos.get(nome) ?? [])].forEach((cb) => cb(valor));
    if (sujo) renderizar(); await estabilizar();
  }
  async function desmontar() {
    slots.forEach((s) => s?.cleanup?.());
    slots = []; montado = false; arvore = undefined; await estabilizar();
  }
  return {
    montar, prontoVisual, avancar, emitir, desmontar, estabilizar,
    resolverPreferencia: async (valor) => { preferencia.resolve(valor); await estabilizar(); },
    resolverLeitor: async (valor) => { leitor.resolve(valor); await estabilizar(); },
    rejeitarPreferencia: async () => { preferencia.reject(new Error('consulta indisponível')); await estabilizar(); },
    atualizar: async (novas) => { props = { ...props, ...novas }; renderizar(); await estabilizar(); },
    repetirEfeitosDeMontagem: async () => {
      slots.filter((s) => s?.criar).forEach((s) => s.cleanup?.());
      slots.filter((s) => s?.criar).forEach((s) => { s.cleanup = s.criar(); });
      if (sujo) renderizar(); await estabilizar();
    },
    falharImagem: async () => {
      const imagem = nos(arvore).find((n) => n.props?.onError);
      assert.ok(imagem, 'imagem da assinatura montada'); imagem.props.onError();
      if (sujo) renderizar(); await estabilizar();
    },
    tocar: async () => {
      const flags = { preveniu: false, propagacao: false };
      const camada = nos(arvore).find((n) => n.props?.testID === 'abertura-studoo');
      assert.ok(camada, 'camada disponível para a dispensa');
      camada.props.onResponderGrant({ preventDefault: () => { flags.preveniu = true; }, stopPropagation: () => { flags.propagacao = true; } });
      if (sujo) renderizar(); await estabilizar(); return flags;
    },
    camada: () => nos(arvore).find((n) => n.props?.testID === 'abertura-studoo'),
    animacoes, coreografias: () => animacoes.filter((a) => a.destino === 1), splash, erros,
    agora: () => agora,
  };
}

test('cold boot inactive/null/unknown aguarda active e toca a assinatura com preferência real false', async () => {
  for (const estadoInicial of ['inactive', null, 'unknown']) {
    const a = ambiente({ estadoInicial });
    await a.montar(); await a.prontoVisual();
    await a.resolverPreferencia(false); await a.resolverLeitor(false);
    await a.avancar(160);
    assert.equal(a.coreografias().length, 0, 'não anima antes do primeiro foreground');
    assert.ok(a.camada(), 'boot transitório não consome a assinatura');
    await a.emitir('app:change', 'inactive'); await a.avancar(40);
    assert.ok(a.camada(), 'a transição inicial inactive ainda não é um retorno ao segundo plano');
    await a.emitir('app:change', 'active'); await a.avancar(32);
    assert.equal(a.coreografias().length, 1, String(estadoInicial));
    assert.equal(a.coreografias()[0].duracao, 880);
    assert.equal(a.coreografias()[0].nativo, true);
    await a.avancar(1100); assert.equal(a.camada(), undefined);
  }
});

test('fontes prontas antes da resposta nativa não convertem preferência pendente em dispensa', async () => {
  const a = ambiente(); await a.montar(); await a.prontoVisual(); await a.resolverLeitor(false);
  await a.avancar(320);
  assert.ok(a.camada()); assert.equal(a.coreografias().length, 0);
  await a.resolverPreferencia(false); await a.avancar(32);
  assert.equal(a.coreografias().length, 1);
  await a.avancar(1100); assert.equal(a.camada(), undefined);
});

test('consulta de leitor pendente também impede começar movimento antes de conhecer a preferência', async () => {
  const a = ambiente(); await a.montar(); await a.prontoVisual(); await a.resolverPreferencia(false);
  await a.avancar(160); assert.equal(a.coreografias().length, 0);
  await a.resolverLeitor(false); await a.avancar(32); assert.equal(a.coreografias().length, 1);
});

test('montagem tardia e imagens tardias não gastam a janela da coreografia durante o carregamento', async () => {
  for (const atraso of [600, 2500]) {
    const a = ambiente(); await a.montar(atraso);
    await a.resolverPreferencia(false); await a.resolverLeitor(false); await a.prontoVisual();
    await a.avancar(32); assert.equal(a.coreografias().length, 1, `montagem em ${atraso}`);
    assert.equal(a.coreografias()[0].duracao, 880);
    await a.avancar(1100); assert.equal(a.camada(), undefined);
  }
  const a = ambiente(); await a.montar(); await a.resolverPreferencia(false); await a.resolverLeitor(false);
  await a.avancar(900); await a.prontoVisual(); await a.avancar(32);
  assert.equal(a.coreografias().length, 1); assert.equal(a.coreografias()[0].duracao, 880);
});

test('Reduzir Movimento e leitor reais dispensam sem iniciar Animated.timing de movimento', async () => {
  for (const [preferencia, leitor] of [[true, false], [false, true]]) {
    const a = ambiente(); await a.montar(); await a.prontoVisual();
    await a.resolverPreferencia(preferencia); await a.resolverLeitor(leitor); await a.avancar(64);
    assert.equal(a.coreografias().length, 0); assert.equal(a.camada(), undefined);
  }
});

test('toque antes da consulta terminar dispensa uma vez e não atravessa para o conteúdo', async () => {
  const a = ambiente(); await a.montar(); await a.prontoVisual();
  assert.deepEqual(await a.tocar(), { preveniu: true, propagacao: true });
  await a.resolverPreferencia(false); await a.resolverLeitor(false); await a.avancar(1500);
  assert.equal(a.coreografias().length, 0); assert.equal(a.camada(), undefined);
});

test('segundo plano após active encerra e retorno não reinicia a assinatura', async () => {
  const a = ambiente(); await a.montar(); await a.prontoVisual();
  await a.resolverPreferencia(false); await a.resolverLeitor(false); await a.avancar(100);
  assert.equal(a.coreografias().length, 1);
  await a.emitir('app:change', 'inactive'); assert.equal(a.camada(), undefined);
  await a.emitir('app:change', 'active'); await a.avancar(1000);
  assert.equal(a.coreografias().length, 1); assert.equal(a.camada(), undefined);
});

test('background inicial, link direto e callback seguem sem espera de marca', async () => {
  for (const caso of [{ estadoInicial: 'background' }, { caminho: '/t/exemplo' }, { parametros: { code: 'retorno' } }]) {
    const a = ambiente(caso); await a.montar(); await a.prontoVisual();
    await a.resolverPreferencia(false); await a.resolverLeitor(false); await a.avancar(32);
    assert.equal(a.camada(), undefined); assert.equal(a.coreografias().length, 0);
  }
});

test('preferência sem resposta e falha de consulta terminam estáticas em vez de bloquear o app', async () => {
  const a = ambiente(); await a.montar(); await a.prontoVisual(); await a.resolverLeitor(false);
  await a.avancar(2100); assert.equal(a.camada(), undefined); assert.equal(a.coreografias().length, 0);
  const b = ambiente(); await b.montar(); await b.prontoVisual(); await b.rejeitarPreferencia();
  await b.avancar(32); assert.equal(b.camada(), undefined); assert.equal(b.coreografias().length, 0);
});

test('remontar o root no mesmo processo não repete a assinatura consumida', async () => {
  const a = ambiente(); await a.montar(); await a.prontoVisual();
  await a.resolverPreferencia(false); await a.resolverLeitor(false); await a.avancar(1150);
  assert.equal(a.coreografias().length, 1); assert.equal(a.camada(), undefined);
  await a.desmontar(); await a.montar(); await a.prontoVisual(); await a.avancar(1200);
  assert.equal(a.coreografias().length, 1); assert.equal(a.camada(), undefined);
});

test('repetir setup/cleanup de efeitos no boot não consome a animação antes dos eventos visuais', async () => {
  const a = ambiente({ estadoInicial: 'inactive' }); await a.montar();
  await a.repetirEfeitosDeMontagem(); await a.prontoVisual();
  await a.resolverPreferencia(false); await a.resolverLeitor(false);
  await a.emitir('app:change', 'active'); await a.avancar(1100);
  assert.equal(a.coreografias().length, 1); assert.equal(a.camada(), undefined);
});

test('reconectar efeitos depois da conclusão não reabre a camada nem repete a assinatura', async () => {
  const a = ambiente(); await a.montar(); await a.prontoVisual();
  await a.resolverPreferencia(false); await a.resolverLeitor(false); await a.avancar(1150);
  assert.equal(a.camada(), undefined); assert.equal(a.coreografias().length, 1);
  await a.repetirEfeitosDeMontagem(); await a.avancar(1200);
  assert.equal(a.camada(), undefined); assert.equal(a.coreografias().length, 1);
});

test('fontes tardias só liberam a saída; não atrasam o começo nem reiniciam a coreografia', async () => {
  const a = ambiente(); await a.montar(); await a.atualizar({ pronta: false });
  await a.prontoVisual(); await a.resolverPreferencia(false); await a.resolverLeitor(false);
  await a.avancar(900);
  assert.equal(a.coreografias().length, 1); assert.ok(a.camada(), 'ainda espera o frame local pronto');
  await a.atualizar({ pronta: true }); await a.avancar(210);
  assert.equal(a.coreografias().length, 1); assert.equal(a.camada(), undefined);
});

test('preferência ativada durante o movimento e erro de imagem encerram sem replay tardio', async () => {
  for (const motivo of ['preferencia', 'imagem']) {
    const a = ambiente(); await a.montar(); await a.prontoVisual();
    await a.resolverPreferencia(false); await a.resolverLeitor(false); await a.avancar(100);
    if (motivo === 'preferencia') await a.emitir('acesso:reduceMotionChanged', true);
    else await a.falharImagem();
    assert.equal(a.camada(), undefined); await a.emitir('acesso:reduceMotionChanged', false); await a.avancar(1200);
    assert.equal(a.coreografias().length, 1); assert.equal(a.camada(), undefined);
  }
});

test('guarda nativa continua ocultando o splash se a raiz nunca montar', async () => {
  const a = ambiente(); await a.avancar(5100);
  assert.equal(a.splash.length, 1); assert.equal(a.coreografias().length, 0); assert.deepEqual(a.erros, []);
});
