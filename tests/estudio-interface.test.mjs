import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import * as react from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
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
function montar(nativo, { carregar, permissao, preparar, voz = { liberada: false } } = {}) {
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
  const contagem = { gravar: 0, parar: 0, liberar: 0, pontes: 0, ensinos: [] };
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
    ensinarStu: async (_id, texto) => {
      contagem.ensinos.push(texto);
      return { acertos: ['Ok'], lacuna: 'Nada', pergunta: 'E agora?', proximoPasso: 'Seguir', simulado: true };
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
      estadoInicialVozAoVivo: () => ({ estado: 'pedindo_mic', mudo: false, segundos: 0, limiteSegundos: 180, avisoTempo: false, legendas: [], anuncioSr: '', erro: null }),
      formatarTempoVoz: (s) => `00:${String(s).padStart(2, '0')}`,
      prepararExplicacaoParaAvaliacao: (t) => t,
      textoErroVozAoVivo: () => 'erro',
    },
    '../contratos/cliente-web': { clienteStudooWeb: cliente },
    '../mensagens/pt-BR': { mensagens },
    './mensagens': { mensagens },
    '../ui': { Botao: 'Botao', Stu: 'Stu' },
    './estudio.css': {},
    './ponte-reforco': { PonteReforco: 'PonteReforco' },
    'react-native': {
      AccessibilityInfo: { sendAccessibilityEvent() {}, announceForAccessibility() {} },
      Animated: { View: 'View', Value: class { setValue(v) { this.valor = v; } } },
      AppState: appState,
      Platform: { OS: 'android' },
      Text: 'Text',
      TextInput: 'TextInput',
      View: 'View',
      Pressable: 'Pressable',
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
    // Movimento reduzido: a ponte clara troca o cartão do passo na hora (sem Animated.timing).
    './interface': { Botao: 'Botao', Campo: 'Campo', EstadoMensagem: 'EstadoMensagem', LinhaAbrir: 'LinhaAbrir', SeloDemonstracao: 'SeloDemonstracao', estilos: {}, useMovimentoReduzido: () => true },
    // O anel de foco dos botões do app segue :focus-visible (src/foco.ts); aqui, foco sempre visível.
    './foco': { focoVisivel: () => true },
    // Cartão de opção de múltipla escolha, o mesmo da aula (o desafio da ponte usa ele): componente de apresentação.
    './opcao': { Opcao: 'Opcao', letras: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
    // Cenas do app (ponte, Stu aluno, ondas, caderno, página do material): componentes de apresentação, sem handlers.
    './estudio-cenas': {
      FaixaDaPonte: 'FaixaDaPonte', SeloDaPonte: 'SeloDaPonte', StuAluno: 'StuAluno', EtapasDoEnsino: 'EtapasDoEnsino', OndasDoVolume: 'OndasDoVolume',
      CadernoDoStu: 'CadernoDoStu', PaginaDoMaterial: 'PaginaDoMaterial',
    },
    './animacoes': { useAparecer: () => 0, estiloDeEntrada: () => ({}) },
    './tema': { cores: {}, fontes: {} },
    // O controlador da voz ao vivo (web e app): registra a conversa aberta para o teste mandar estados, quedas e o fim.
    './voz-ao-vivo': {
      suporteVozAoVivo: () => false,
      iniciarControladorVozAoVivo: (opcoes) => {
        voz.inicios = (voz.inicios ?? 0) + 1;
        voz.opcoes = opcoes;
        return {
          alternarMudo: () => false,
          encerrar: async () => voz.transcricao ?? '',
          descartar() { voz.descartes = (voz.descartes ?? 0) + 1; },
        };
      },
    },
    // App: as peças visuais da voz ao vivo (componentes de apresentação) e a elegibilidade decidida pelo teste.
    './voz-ao-vivo-painel': {
      EntradaVozAoVivo: 'EntradaVozAoVivo', PrivacidadeVozAoVivo: 'PrivacidadeVozAoVivo', PainelVozAoVivo: 'PainelVozAoVivo',
      provedorDaVozAoVivo: async () => (voz.liberada ? 'openai' : null),
      provedorDaGravacao: async () => null,
    },
    // Web: o toca-sons (os efeitos de gravação e o fundo); aqui só conta as entradas e saídas.
    './sons': {
      tocaSons: {
        tocarEfeito: async (id) => { voz.sons = [...(voz.sons ?? []), id]; },
        entrarEmGravacaoOuVoz() { voz.emGravacao = (voz.emGravacao ?? 0) + 1; },
        sairDeGravacaoOuVoz() { voz.emGravacao = (voz.emGravacao ?? 0) - 1; },
      },
    },
    './preferencias': {
      avisoVozVistoAgora: () => Boolean(voz.avisoVisto),
      lerAvisoVozVisto: async () => Boolean(voz.avisoVisto),
      marcarAvisoVozVisto: async () => { voz.marcado = true; voz.avisoVisto = true; },
    },
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
    requestAnimationFrame: () => 1,
    Blob,
    window: { requestAnimationFrame: () => 1, cancelAnimationFrame() {}, matchMedia: () => ({ matches: true }) },
  };
  vm.runInNewContext(fontes[nativo ? 1 : 0], contexto);
  const props = {
    cliente,
    licao: { id: 'licao', objetivo: 'Entender a lição', exercicio: {} },
    avaliacao: { correta: false },
    pedidoPonte: 0,
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
    // No app, as linhas de abrir e fechar (LinhaAbrir, como o <summary> da web) também contam como botão.
    if (
      (no.type === 'Botao' || no.type === 'LinhaAbrir') &&
      (no.props.rotulo === nome || no.props.children === nome)
    )
      return no;
    return buscar(no.props?.children, nome);
  }
  function buscarTipo(no, tipo) {
    if (!no) return null;
    if (Array.isArray(no)) {
      for (const filho of no) {
        const b = buscarTipo(filho, tipo);
        if (b) return b;
      }
      return null;
    }
    if (typeof no !== 'object') return null;
    if (no.type === tipo) return no;
    return buscarTipo(no.props?.children, tipo);
  }
  function clicar(nome) {
    const b = buscar(arvore, nome);
    assert.ok(b, `Botão ${nome}`);
    return (b.props.onClick ?? b.props.acao ?? b.props.alternar)();
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
    /** O "Ver outro exemplo" do painel de retorno: um pedido novo de reforço. */
    pedirPonte() {
      props.pedidoPonte += 1;
      render();
    },
    botao: (nome) => buscar(arvore, nome),
    tipo: (nome) => buscarTipo(arvore, nome),
    texto: () => conteudo(arvore),
    documento,
    appState,
    contagem,
    modos,
    midia,
  };
}

test('web: a ponte aberta ocupa a etapa inteira e esconde o ensino opcional', async () => {
  const ui = montar(false);
  await esperar();
  ui.render();
  assert.ok(ui.tipo('summary'));
  ui.pedirPonte();
  await esperar();
  ui.render();
  assert.ok(ui.tipo('PonteReforco'));
  assert.equal(ui.tipo('summary'), null);
});

test('web: o reforço em preparação, falho, pronto ou reaberto tem um só indicador e a ação do estado', async () => {
  const componentes = { Botao: 'button', Stu: () => null, Icone: () => null };
  const imports = { react, 'react/jsx-runtime': jsx, '../ui': componentes, '../mensagens/pt-BR': { mensagens }, './sons': {} };
  const contexto = { exports: {}, require: nome => imports[nome] };
  vm.runInNewContext(await compilar('src/app/ponte-reforco.tsx'), contexto);
  const base = { ocupado: false, erro: '', feedbackOriginal: '', tentativa: 'normal' };
  const dados = { motivo: 'A palavra descreve uma reação.', conceito: 'É automática.', exemplo: 'O coração acelera.', concluida: false };
  function quadro(props) {
    const html = renderToStaticMarkup(react.createElement(contexto.exports.PonteReforco, { ...base, ...props }));
    assert.equal((html.match(/<ol[ >]/g) ?? []).length, 1);
    assert.equal((html.match(/<li[ >]/g) ?? []).length, 3);
    return html;
  }
  assert.match(quadro({}), /disabled="">Ver exemplo/);
  assert.match(quadro({ erro: 'Tente outra vez.' }), /Tentar de novo/);
  const pronto = quadro({ ponte: dados });
  assert.match(pronto, /aria-current="step"/);
  assert.match(pronto, /Você respondeu “normal”/);
  assert.match(pronto, /A palavra descreve uma reação/);
  assert.doesNotMatch(pronto, /O coração acelera/);
  const reaberta = quadro({ ponte: { ...dados, concluida: true } });
  assert.match(reaberta, /O coração acelera/);
  assert.match(reaberta, /Voltar ao exercício/);
  assert.doesNotMatch(reaberta, /aria-current="step"/);
});

for (const nativo of [false, true]) {
  const plataforma = nativo ? 'app' : 'web';
  test(`${plataforma}: resposta atrasada não apaga reforço novo; pedido duplicado só gera uma vez`, async () => {
    const carregar = adiado();
    const ui = montar(nativo, { carregar });
    assert.doesNotMatch(ui.texto(), new RegExp(mensagens.estudio.ponte), 'o cartão só aparece quando pedido');
    ui.pedirPonte();
    ui.pedirPonte();
    await esperar();
    ui.render();
    assert.equal(ui.contagem.pontes, 1);
    assert.match(nativo ? ui.texto() : ui.tipo('PonteReforco').props.ponte?.motivo, /Reforço novo/);
    carregar.resolve({ erros: 1, ponte: null, ensino: null });
    await esperar();
    ui.render();
    assert.match(nativo ? ui.texto() : ui.tipo('PonteReforco').props.ponte?.motivo, /Reforço novo/);
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
    ui.pedirPonte();
    await esperar();
    assert.equal(ui.contagem.pontes, 0, 'o reforço espera a gravação acabar');
    assert.ok(ui.botao(mensagens.estudio.parar));
  });

// ---------- Voz ao vivo no app (spec 08, parte B) ----------
const mv = mensagens.estudio.vozAoVivo;
const estadoVoz = (mudanca) => ({ estado: 'pedindo_mic', mudo: false, segundos: 0, limiteSegundos: 180, avisoTempo: false, legendas: [], anuncioSr: '', erro: null, ...mudanca });

test('app: sem a voz liberada (aparelho ou visitante sem a flag), o Explique fica como antes', async () => {
  const ui = montar(true, { voz: { liberada: false } });
  await esperar();
  ui.render();
  ui.clicar(mensagens.estudio.ensinar);
  ui.render();
  await esperar();
  ui.render();
  assert.equal(ui.tipo('EntradaVozAoVivo'), null);
  assert.equal(ui.tipo('PainelVozAoVivo'), null);
  assert.equal(ui.tipo('EtapasDoEnsino').props.primeira, undefined);
  assert.ok(ui.botao(mensagens.estudio.gravar));
});

test('app: com a voz liberada, entrada → aviso → conversa; queda leva a fala ao campo; encerrar envia ao Stu', async () => {
  const voz = { liberada: true, avisoVisto: false };
  const ui = montar(true, { voz });
  await esperar();
  ui.render();
  ui.clicar(mensagens.estudio.ensinar);
  ui.render();
  await esperar();
  ui.render();
  assert.ok(ui.tipo('EntradaVozAoVivo'), 'cartão "Conversar com o Stu"');
  assert.equal(ui.tipo('EtapasDoEnsino').props.primeira, mv.passoComVoz);

  // Primeira vez: o aviso de privacidade antes; aceitar marca como visto e abre a conversa.
  ui.tipo('EntradaVozAoVivo').props.aoAbrir();
  ui.render();
  assert.ok(ui.tipo('PrivacidadeVozAoVivo'));
  assert.equal(voz.inicios ?? 0, 0);
  ui.tipo('PrivacidadeVozAoVivo').props.aoAceitar();
  ui.render();
  assert.equal(voz.marcado, true);
  assert.equal(voz.inicios, 1);
  assert.ok(ui.tipo('PainelVozAoVivo'));
  assert.equal(ui.tipo('EntradaVozAoVivo'), null);
  // Durante a conversa, o campo, o Gravar e o Enviar esperam, como na web.
  assert.equal(ui.tipo('Campo').props.editable, false);
  assert.equal(ui.botao(mensagens.estudio.gravar).props.desativado, true);
  assert.equal(ui.botao(mensagens.estudio.enviar).props.desativado, true);

  // O estado do controlador chega ao painel e ao Stu.
  voz.opcoes.aoMudar(estadoVoz({ estado: 'ouvindo' }));
  ui.render();
  assert.equal(ui.tipo('PainelVozAoVivo').props.estado.estado, 'ouvindo');
  assert.equal(ui.tipo('StuAluno').props.estado, 'ouvindo');
  assert.equal(ui.tipo('StuAluno').props.fala, mv.estados.ouvindo);
  voz.opcoes.aoMudar(estadoVoz({ estado: 'stu_falando' }));
  ui.render();
  assert.equal(ui.tipo('StuAluno').props.estado, 'falando');

  // A conversa caiu com fala: ela vai para o campo, com o aviso, e a entrada volta.
  voz.opcoes.aoErroFatal('rede', 'O WHERE filtra somente as linhas que cumprem a condição.');
  ui.render();
  assert.equal(ui.tipo('PainelVozAoVivo'), null);
  assert.ok(ui.tipo('EntradaVozAoVivo'));
  assert.equal(ui.tipo('Campo').props.value, 'O WHERE filtra somente as linhas que cumprem a condição.');
  assert.match(ui.texto(), new RegExp(mv.parcialNoCampo));

  // Segunda vez: o aviso já visto vai direto para a conversa; "Encerrar e ver retorno" manda a fala ao Stu.
  voz.transcricao = 'Explicação dita na conversa ao vivo, longa o bastante.';
  ui.tipo('EntradaVozAoVivo').props.aoAbrir();
  ui.render();
  assert.equal(voz.inicios, 2);
  assert.equal(ui.tipo('PrivacidadeVozAoVivo'), null);
  assert.doesNotMatch(ui.texto(), new RegExp(mv.parcialNoCampo), 'o aviso anterior sai');
  ui.tipo('PainelVozAoVivo').props.aoEncerrar();
  await esperar();
  ui.render();
  assert.deepEqual(ui.contagem.ensinos, ['Explicação dita na conversa ao vivo, longa o bastante.']);
  assert.equal(ui.tipo('PainelVozAoVivo'), null);

  // "Prefiro escrever ou gravar" e fechar o Explique descartam a conversa aberta.
  ui.tipo('EntradaVozAoVivo').props.aoAbrir();
  ui.render();
  ui.tipo('PainelVozAoVivo').props.aoTrocar();
  ui.render();
  assert.equal(ui.tipo('PainelVozAoVivo'), null);
  const descartesAntes = voz.descartes ?? 0;
  ui.tipo('EntradaVozAoVivo').props.aoAbrir();
  ui.render();
  ui.clicar(mensagens.estudio.ensinar);
  ui.render();
  assert.ok((voz.descartes ?? 0) > descartesAntes, 'fechar o Explique desliga a conversa');
});

// Especificidade de um seletor (a, b, c), com :is/:has/:not pelo argumento mais forte e :where zerado.
function especificidade(seletor) {
  const soma = [0, 0, 0];
  let resto = seletor;
  const funcoes = /:(is|has|not|where)\(/g;
  let m;
  while ((m = funcoes.exec(resto))) {
    let nivel = 1;
    let i = m.index + m[0].length;
    for (; i < resto.length && nivel; i++) nivel += resto[i] === '(' ? 1 : resto[i] === ')' ? -1 : 0;
    const dentro = resto.slice(m.index + m[0].length, i - 1);
    if (m[1] !== 'where') {
      const maior = dividirLista(dentro).map(especificidade).sort(compararEspecificidade).at(-1);
      for (let k = 0; k < 3; k++) soma[k] += maior[k];
    }
    resto = `${resto.slice(0, m.index)} ${resto.slice(i)}`;
    funcoes.lastIndex = m.index;
  }
  resto = resto.replace(/\[[^\]]*\]/g, () => { soma[1] += 1; return ' '; });
  resto = resto.replace(/::[\w-]+/g, () => { soma[2] += 1; return ' '; });
  resto = resto.replace(/#[\w-]+/g, () => { soma[0] += 1; return ' '; });
  resto = resto.replace(/[.:][\w-]+/g, () => { soma[1] += 1; return ' '; });
  resto.replace(/(^|[\s>+~])([a-z][\w-]*)/gi, () => { soma[2] += 1; return ' '; });
  return soma;
}
function dividirLista(lista) {
  const partes = [];
  let nivel = 0;
  let atual = '';
  for (const ch of lista) {
    if (ch === '(') nivel++;
    if (ch === ')') nivel--;
    if (ch === ',' && nivel === 0) { partes.push(atual.trim()); atual = ''; } else atual += ch;
  }
  if (atual.trim()) partes.push(atual.trim());
  return partes;
}
const compararEspecificidade = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

test('desafio da ponte: depois de Verificar, a cor do retorno (errada e certa) vence a da seleção, também na letra', async () => {
  const css = (await readFile(new URL('../src/app/aula.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  // Regras na ordem do arquivo (as de @media entram no lugar onde aparecem).
  const regras = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const seletor of dividirLista(m[1].trim())) regras.push({ seletor, corpo: m[2], ordem: regras.length });
  }
  const valeNoDesafio = (s) => s.includes('.estudio-desafio') && /\.opcoes\s+label/.test(s);
  const maisForte = (filtro) => regras.filter((r) => valeNoDesafio(r.seletor) && filtro(r))
    .sort((x, y) => compararEspecificidade(especificidade(x.seletor), especificidade(y.seletor)) || x.ordem - y.ordem).at(-1);
  for (const naTecla of [false, true]) {
    const temTecla = (r) => r.seletor.includes('.opcao-tecla') === naTecla && /background/.test(r.corpo);
    const selecao = maisForte((r) => temTecla(r) && r.seletor.includes('input:checked') && !r.seletor.includes('data-retorno'));
    assert.ok(selecao, 'regra da seleção no desafio');
    for (const retorno of ['errada', 'certa']) {
      const regra = maisForte((r) => temTecla(r) && r.seletor.includes(`[data-retorno='${retorno}']`));
      assert.ok(regra, `regra do retorno ${retorno} no desafio${naTecla ? ' (letra)' : ''}`);
      const comparacao = compararEspecificidade(especificidade(regra.seletor), especificidade(selecao.seletor));
      assert.ok(comparacao > 0 || (comparacao === 0 && regra.ordem > selecao.ordem),
        `"${regra.seletor}" perde para "${selecao.seletor}" no desafio da ponte (${retorno}${naTecla ? ', letra' : ''})`);
    }
  }
  // O calculador em si: o :has(input:checked) pesa mais que um atributo sozinho.
  assert.deepEqual(especificidade(":is(.aula-quadro, .estudio-desafio) .opcoes label:has(input:checked)"), [0, 3, 2]);
  assert.deepEqual(especificidade(":is(.aula-quadro, .estudio-desafio) .opcoes label[data-retorno='errada']"), [0, 3, 1]);
});
