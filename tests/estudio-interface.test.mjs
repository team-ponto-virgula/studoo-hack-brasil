import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compilar = async (caminho) =>
  ts.transpileModule(
    await readFile(new URL(`../${caminho}`, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
const textos = { exports: {} };
vm.runInNewContext(
  await compilar('packages/contratos/src/experiencia.ts'),
  textos,
);
const mensagens = textos.exports.mensagens;
const fontes = await Promise.all(
  ['src/app/estudio.tsx', 'apps/mobile/src/estudio-adaptativo.tsx'].map(
    compilar,
  ),
);
const adiado = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const esperar = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

// Exercita handlers e efeitos reais dos componentes, sem câmera ou permissão física.
function montar(nativo, { carregar, permissao, preparar } = {}) {
  let cursor = 0;
  const slots = [];
  let efeitos = [];
  let arvore;
  const documento = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  };
  const appState = {
    currentState: 'active',
    addEventListener() {
      return { remove() {} };
    },
  };
  const contagem = { gravar: 0, parar: 0, liberar: 0, pontes: 0 };
  const modos = [];
  const gravador = {
    prepareToRecordAsync: () => preparar?.promise ?? Promise.resolve(),
    record() {
      contagem.gravar++;
    },
    async stop() {
      contagem.parar++;
    },
    uri: null,
  };
  const midia = {
    getTracks: () => [
      {
        stop() {
          contagem.liberar++;
        },
      },
    ],
  };
  const ponte = {
    motivo: 'Reforço novo',
    conceito: 'Uma explicação nova.',
    exemplo: 'Um novo exemplo.',
    simulado: true,
    concluida: false,
    exercicio: {
      tipo: 'multipla_escolha',
      enunciado: 'Outra pergunta',
      opcoes: [
        { id: '0', texto: 'A' },
        { id: '1', texto: 'B' },
      ],
    },
  };
  const cliente = {
    apoioLicao: () =>
      carregar?.promise ??
      Promise.resolve({ erros: 1, ponte: null, ensino: null }),
    criarPonte: async () => {
      contagem.pontes++;
      return { erros: 1, ponte, ensino: null };
    },
  };
  const hooks = {
    useState(initial) {
      const i = cursor++;
      slots[i] ??= {
        valor: typeof initial === 'function' ? initial() : initial,
      };
      return [
        slots[i].valor,
        (v) => {
          slots[i].valor = typeof v === 'function' ? v(slots[i].valor) : v;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      slots[i] ??= { current: initial };
      return slots[i];
    },
    useEffect(fn, deps) {
      const i = cursor++;
      const prev = slots[i];
      if (!prev || deps.some((d, j) => d !== prev.deps[j])) {
        slots[i] = { deps, cleanup: prev?.cleanup };
        efeitos.push(() => {
          slots[i].cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const imports = {
    react: hooks,
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    '@studoo/contratos': {
      ErroStudoo: class extends Error {},
      LIMITES_ESTUDIO: { arquivoBytes: 5 * 1024 * 1024 },
    },
    '../contratos/cliente-web': { clienteStudooWeb: cliente },
    '../mensagens/pt-BR': { mensagens },
    './mensagens': { mensagens },
    '../ui': { Botao: 'Botao', Stu: 'Stu' },
    './estudio.css': {},
    'react-native': {
      Animated: { View: 'View' },
      AppState: appState,
      Platform: { OS: 'android' },
      Text: 'Text',
      View: 'View',
      ScrollView: 'ScrollView',
      StyleSheet: { create: (x) => x },
    },
    'expo-file-system': { File: class {} },
    'expo-document-picker': {},
    'expo-image-picker': {},
    'expo-audio': {
      useAudioRecorder: () => gravador,
      RecordingPresets: { HIGH_QUALITY: {} },
      requestRecordingPermissionsAsync: () =>
        permissao?.promise ?? Promise.resolve({ granted: true }),
      setAudioModeAsync: async (x) => {
        modos.push(x);
      },
    },
    './interface': { Botao: 'Botao', Campo: 'Campo', estilos: {} },
    './animacoes': { useAparecer: () => 0 },
    './tema': { cores: {} },
  };
  const contexto = {
    exports: {},
    require: (n) => {
      assert.ok(n in imports, n);
      return imports[n];
    },
    document: documento,
    navigator: {
      mediaDevices: {
        getUserMedia: () => permissao?.promise ?? Promise.resolve(midia),
      },
    },
    MediaRecorder: class {
      constructor() {
        contagem.gravar++;
      }
      start() {}
    },
    setInterval: () => 1,
    clearInterval() {},
    Blob,
  };
  vm.runInNewContext(fontes[nativo ? 1 : 0], contexto);
  const props = {
    cliente,
    licao: { id: 'licao', exercicio: {} },
    avaliacao: { correta: false },
  };
  function render() {
    cursor = 0;
    efeitos = [];
    arvore = contexto.exports.ApoioDaLicao(props);
    efeitos.forEach((f) => f());
    return arvore;
  }
  function buscar(no, nome) {
    if (!no) return null;
    if (Array.isArray(no)) {
      for (const filho of no) {
        const b = buscar(filho, nome);
        if (b) return b;
      }
      return null;
    }
    if (typeof no !== 'object') return null;
    if (
      no.type === 'Botao' &&
      (no.props.rotulo === nome || no.props.children === nome)
    )
      return no;
    return buscar(no.props?.children, nome);
  }
  function clicar(nome) {
    const b = buscar(arvore, nome);
    assert.ok(b, `Botão ${nome}`);
    return (b.props.onClick ?? b.props.acao)();
  }
  function conteudo(no) {
    if (Array.isArray(no)) return no.map(conteudo).join(' ');
    if (typeof no === 'string') return no;
    if (!no || typeof no !== 'object') return '';
    return conteudo(no.props?.children);
  }
  render();
  return {
    render,
    clicar,
    botao: (nome) => buscar(arvore, nome),
    texto: () => conteudo(arvore),
    documento,
    appState,
    contagem,
    modos,
    midia,
  };
}

for (const nativo of [false, true]) {
  const plataforma = nativo ? 'app' : 'web';
  test(`${plataforma}: resposta atrasada não apaga reforço novo; clique duplicado só gera uma vez`, async () => {
    const carregar = adiado();
    const ui = montar(nativo, { carregar });
    ui.clicar(mensagens.estudio.construir);
    ui.clicar(mensagens.estudio.construir);
    await esperar();
    ui.render();
    assert.equal(ui.contagem.pontes, 1);
    assert.match(ui.texto(), /Reforço novo/);
    carregar.resolve({ erros: 1, ponte: null, ensino: null });
    await esperar();
    ui.render();
    assert.match(ui.texto(), /Reforço novo/);
  });
  test(`${plataforma}: permissão que chega em segundo plano não inicia microfone`, async () => {
    const permissao = adiado();
    const ui = montar(nativo, { permissao });
    await esperar();
    ui.render();
    if (nativo) {
      ui.clicar(mensagens.estudio.ensinar);
      ui.render();
    }
    ui.clicar(mensagens.estudio.gravar);
    if (nativo) {
      ui.appState.currentState = 'background';
      permissao.resolve({ granted: true });
    } else {
      ui.documento.hidden = true;
      permissao.resolve(ui.midia);
    }
    await esperar();
    assert.equal(ui.contagem.gravar, 0);
    if (!nativo) assert.equal(ui.contagem.liberar, 1);
  });
}
test('app: segundo plano durante preparo libera modo de gravação', async () => {
  const preparar = adiado();
  const ui = montar(true, { preparar });
  await esperar();
  ui.render();
  ui.clicar(mensagens.estudio.ensinar);
  ui.render();
  ui.clicar(mensagens.estudio.gravar);
  await esperar();
  ui.appState.currentState = 'background';
  preparar.resolve();
  await esperar();
  assert.equal(ui.contagem.gravar, 0);
  assert.equal(ui.contagem.parar, 1);
  assert.equal(ui.modos.at(-1).allowsRecording, false);
});

for (const nativo of [false, true])
  test(`${nativo ? 'app' : 'web'}: gravação bloqueia requisição de reforço concorrente`, async () => {
    const ui = montar(nativo);
    await esperar();
    ui.render();
    if (nativo) {
      ui.clicar(mensagens.estudio.ensinar);
      ui.render();
    }
    ui.clicar(mensagens.estudio.gravar);
    await esperar();
    ui.render();
    const botao = ui.botao(mensagens.estudio.construir);
    assert.equal(botao.props[nativo ? 'desativado' : 'disabled'], true);
    assert.ok(ui.botao(mensagens.estudio.parar));
  });
