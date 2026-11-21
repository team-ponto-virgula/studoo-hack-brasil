import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Voz ao vivo no app (spec 08, parte B): no aparelho a opção fica escondida; na prévia web, o transporte é o WebRTC do
// navegador, no mesmo fluxo da web. Sem navegador, sem React Native e sem rede: os módulos rodam transpilados, com dublês.

async function compilar(caminho) {
  const fonte = await readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
  return ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
}

function carregar(codigo, modulos, globais = {}) {
  const exports = {};
  runInNewContext(codigo, {
    exports,
    require: (nome) => {
      assert.ok(nome in modulos, `módulo sem dublê: ${nome}`);
      return modulos[nome];
    },
    setTimeout, clearTimeout, setInterval, clearInterval, Promise, JSON, Math, Uint8Array, console,
    ...globais,
  });
  return exports;
}

// O contrato de verdade (estados, redutor, transcrição, textos), não uma cópia: é ele que o app usa.
const experiencia = carregar(await compilar('packages/contratos/src/experiencia.ts'), {});
const { mensagens } = experiencia;
const contratos = carregar(await compilar('packages/contratos/src/voz-ao-vivo.ts'), { './experiencia': experiencia, './estudio': {} }, { process: { env: {} } });
const m = mensagens.estudio.vozAoVivo;

const codigoNativo = await compilar('apps/mobile/src/voz-ao-vivo.ts');
const codigoWeb = await compilar('apps/mobile/src/voz-ao-vivo.web.ts');
const codigoPainel = await compilar('apps/mobile/src/voz-ao-vivo-painel.tsx');
const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

function painel({ suporte = false } = {}) {
  const jsx = (type, props) => ({ type, props });
  return carregar(codigoPainel, {
    react: { useEffect() {}, useRef: (v) => ({ current: v }), useState: (v) => [typeof v === 'function' ? v() : v, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { Animated: { View: 'Animated.View', Value: class { constructor(v) { this.v = v; } interpolate(c) { return c; } } },
      Easing: { inOut: () => 0, ease: 0 }, ScrollView: 'ScrollView', StyleSheet: { create: (x) => x }, Text: 'Text', View: 'View' },
    '@studoo/contratos': contratos,
    './interface': { Botao: 'Botao', useMovimentoReduzido: () => true },
    './icone': { Icone: 'Icone' },
    './mensagens': { mensagens },
    './tema': { cores: { acao: '#3858D6', fundo: '#FFFFFF', texto: '#1B2A5E', textoSecundario: '#5E6A85' }, fontes: {} },
    './voz-ao-vivo': { suporteVozAoVivo: () => suporte },
  });
}

/** Percorre a árvore devolvida pelo componente (sem montar filhos que são componentes). */
function nos(arvore) {
  const lista = [];
  const visitar = (no) => {
    if (Array.isArray(no)) { no.forEach(visitar); return; }
    if (!no || typeof no !== 'object') return;
    lista.push(no);
    visitar(no.props?.children);
  };
  visitar(arvore);
  return lista;
}
function textoDe(arvore) {
  if (Array.isArray(arvore)) return arvore.map(textoDe).join('');
  if (typeof arvore === 'string' || typeof arvore === 'number') return String(arvore);
  if (!arvore || typeof arvore !== 'object') return '';
  return textoDe(arvore.props?.children);
}
const botoes = (arvore) => nos(arvore).filter((no) => no.type === 'Botao').map((no) => ({ rotulo: no.props.rotulo, desativado: Boolean(no.props.desativado) }));
const componente = (arvore, nome) => nos(arvore).find((no) => typeof no.type === 'function' && no.type.name === nome);

test('aparelho: sem módulo WebRTC nativo, a opção fica escondida e o controlador só devolve "não conectou"', async () => {
  const mudancas = [];
  const fatais = [];
  const nativo = carregar(codigoNativo, { '@studoo/contratos': contratos });
  assert.equal(nativo.suporteVozAoVivo(), false);
  nativo.iniciarControladorVozAoVivo({ licaoId: 'l', cliente: {}, aoMudar: (e) => mudancas.push(e), aoTempoEsgotado() {}, aoErroFatal: (c, p) => fatais.push([c, p]) });
  await esperar();
  assert.equal(mudancas.at(-1).estado, 'erro');
  assert.equal(mudancas.at(-1).erro, 'falhaConexao');
  assert.deepEqual(fatais, [['falhaConexao', '']]);
  // Descartado na hora, não avisa nada.
  const depois = [];
  nativo.iniciarControladorVozAoVivo({ licaoId: 'l', cliente: {}, aoMudar: (e) => depois.push(e), aoTempoEsgotado() {} }).descartar();
  await esperar();
  assert.equal(depois.length, 0);
});

test('elegibilidade: no aparelho a opção não aparece nem consulta o servidor', async () => {
  let consultas = 0;
  const cliente = {
    iniciarVozAoVivo: async () => ({}),
    configuracaoAcesso: async () => { consultas += 1; return { ia: 'openai', vozAoVivo: true, vozAoVivoVisitante: true }; },
    sessao: async () => ({ autenticado: true }),
  };
  // Sem suporte (o padrão vem de voz-ao-vivo.ts, o do aparelho).
  assert.equal(await painel().provedorDaVozAoVivo(cliente), null);
  assert.equal(await painel({ suporte: true }).provedorDaVozAoVivo(cliente, false), null);
  assert.equal(consultas, 0);
});

test('elegibilidade: visitante só com a flag de visitante; conta comum com a flag geral; provedor de texto real; erro esconde', async () => {
  const { provedorDaVozAoVivo, provedorDaGravacao } = painel({ suporte: true });
  const cliente = (cfg, sessao, extra = {}) => ({ iniciarVozAoVivo: async () => ({}), configuracaoAcesso: async () => ({ ia: 'openai', ...cfg }), sessao: async () => sessao, ...extra });
  assert.equal(await provedorDaVozAoVivo(cliente({ vozAoVivo: true }, { autenticado: true, visitante: true })), null, 'visitante sem a flag');
  assert.equal(await provedorDaVozAoVivo(cliente({ vozAoVivo: true, vozAoVivoVisitante: true }, { autenticado: true, visitante: true })), 'openai', 'visitante com a flag');
  assert.equal(await provedorDaVozAoVivo(cliente({ vozAoVivo: true }, { autenticado: true })), 'openai', 'conta comum');
  assert.equal(await provedorDaVozAoVivo(cliente({ ia: 'deepseek', vozAoVivo: true }, { autenticado: true })), 'deepseek', 'modo misto: texto pela DeepSeek');
  assert.equal(await provedorDaVozAoVivo(cliente({ ia: 'falsa', vozAoVivo: true }, { autenticado: true })), null, 'IA falsa');
  assert.equal(await provedorDaVozAoVivo(cliente({ vozAoVivo: false, vozAoVivoVisitante: true }, { autenticado: true })), null, 'servidor desligado');
  assert.equal(await provedorDaVozAoVivo(cliente({ vozAoVivo: true }, { autenticado: true }, { iniciarVozAoVivo: undefined })), null, 'cliente sem a rota');
  assert.equal(await provedorDaVozAoVivo({ iniciarVozAoVivo: async () => ({}), configuracaoAcesso: async () => { throw new Error('rede'); }, sessao: async () => ({}) }), null, 'falha na consulta');
  // Uma consulta por cliente (sessão), como a promessa guardada da web.
  let consultas = 0;
  const unico = cliente({ vozAoVivo: true }, { autenticado: true }, { configuracaoAcesso: async () => { consultas += 1; return { ia: 'openai', vozAoVivo: true }; } });
  await provedorDaVozAoVivo(unico);
  await provedorDaVozAoVivo(unico);
  assert.equal(consultas, 1);
  // A gravação diz quem recebe o áudio só com `transcricao` e um provedor real (e57d54d), também no aparelho.
  assert.equal(await provedorDaGravacao(cliente({ transcricao: true }, {})), 'openai');
  assert.equal(await provedorDaGravacao(cliente({ ia: 'deepseek', transcricao: true }, {})), 'deepseek');
  assert.equal(await provedorDaGravacao(cliente({ transcricao: false }, {})), null);
  assert.equal(await provedorDaGravacao(cliente({ ia: 'falsa', transcricao: true }, {})), null);
});

test('painel: estados da conversa iguais aos da web (textos, ondas, aviso, erro e controles)', () => {
  const { PainelVozAoVivo, EntradaVozAoVivo, PrivacidadeVozAoVivo } = painel();
  const base = contratos.estadoInicialVozAoVivo();
  const render = (mudanca) => PainelVozAoVivo({ estado: { ...base, ...mudanca }, nivel: {}, aoAlternarMudo() {}, aoEncerrar() {}, aoTrocar() {} });

  // Entrada e aviso da primeira vez.
  const entrada = EntradaVozAoVivo({ desativado: false, aoAbrir() {} });
  assert.match(textoDe(entrada), new RegExp(m.abrirBeneficio));
  assert.match(textoDe(entrada), new RegExp(m.notaPrivacidade));
  // Modo misto: com a DeepSeek, a nota e o aviso dizem que o texto é avaliado por ela.
  assert.match(textoDe(EntradaVozAoVivo({ desativado: false, aoAbrir() {}, provedor: 'deepseek' })), /avaliado pela DeepSeek/);
  assert.match(textoDe(PrivacidadeVozAoVivo({ aoAceitar() {}, aoCancelar() {}, provedor: 'deepseek' })), /avaliado pela DeepSeek/);
  assert.deepEqual(botoes(entrada), [{ rotulo: m.abrir, desativado: false }]);
  const aviso = PrivacidadeVozAoVivo({ aoAceitar() {}, aoCancelar() {} });
  assert.match(textoDe(aviso), new RegExp(m.privacidadeTitulo));
  assert.deepEqual(botoes(aviso).map((b) => b.rotulo), [m.privacidadeAceitar, m.privacidadeCancelar]);

  // Pedindo o microfone e conectando: progresso, controles esperando, a saída para o texto sempre livre.
  for (const estado of ['pedindo_mic', 'conectando']) {
    const arvore = render({ estado });
    assert.match(textoDe(arvore), new RegExp(m.estados[estado]));
    assert.match(textoDe(arvore), /00:00 \/ 03:00/);
    assert.ok(componente(arvore, 'Progresso'), `progresso em ${estado}`);
    assert.ok(!componente(arvore, 'OndasDaVoz'));
    assert.deepEqual(botoes(arvore), [{ rotulo: m.mudo, desativado: true }, { rotulo: m.encerrar, desativado: true }, { rotulo: m.alternativaTexto, desativado: false }]);
  }

  // Ouvindo: dica, ondas e controles livres; mudo esconde as ondas e troca o rótulo.
  const ouvindo = render({ estado: 'ouvindo', segundos: 12 });
  assert.match(textoDe(ouvindo), new RegExp(m.dicaOuvindo));
  assert.match(textoDe(ouvindo), /00:12 \/ 03:00/);
  assert.ok(componente(ouvindo, 'OndasDaVoz'));
  assert.ok(componente(ouvindo, 'Legendas'));
  assert.deepEqual(botoes(ouvindo).map((b) => b.desativado), [false, false, false]);
  const mudo = render({ estado: 'ouvindo', mudo: true });
  assert.ok(!componente(mudo, 'OndasDaVoz'));
  assert.equal(botoes(mudo)[0].rotulo, m.ativarMic);

  // Stu falando: a dica de interromper, sem ondas.
  const falando = render({ estado: 'stu_falando' });
  assert.match(textoDe(falando), new RegExp(m.dicaInterromper));
  assert.ok(!componente(falando, 'OndasDaVoz'));

  // Aviso dos 30 s: o aviso no lugar da dica, legendas mais baixas.
  const tempo = render({ estado: 'stu_falando', segundos: 152, avisoTempo: true });
  assert.match(textoDe(tempo), new RegExp(m.avisoTempo));
  assert.match(textoDe(tempo), /02:32 \/ 03:00/);
  assert.doesNotMatch(textoDe(tempo), new RegExp(m.dicaInterromper));
  assert.equal(componente(tempo, 'Legendas').props.avisoTempo, true);

  // Encerrando: controles esperando, o aviso continua.
  const encerrando = render({ estado: 'encerrando', avisoTempo: true });
  assert.match(textoDe(encerrando), new RegExp(m.estados.encerrando));
  assert.deepEqual(botoes(encerrando).map((b) => b.desativado), [true, true, false]);

  // Erro sem fala: "Conversa encerrada", o texto do erro e só a saída para o texto, sem legendas nem aviso.
  const erro = render({ estado: 'erro', erro: 'micNegado', avisoTempo: true });
  assert.match(textoDe(erro), new RegExp(m.estados.erro));
  assert.match(textoDe(erro), new RegExp(m.erros.micNegado));
  assert.doesNotMatch(textoDe(erro), new RegExp(m.avisoTempo));
  assert.ok(!componente(erro, 'Legendas'));
  assert.deepEqual(botoes(erro), [{ rotulo: m.alternativaTexto, desativado: false }]);
});

// ---------- Transporte da prévia web (voz-ao-vivo.web.ts) ----------

const SDP = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\n';

function dubles() {
  const faixa = { enabled: true, parada: false, stop() { this.parada = true; } };
  const stream = { getTracks: () => [faixa], getAudioTracks: () => [faixa] };
  const canal = { readyState: 'connecting', enviados: [], send(msg) { this.enviados.push(JSON.parse(msg)); }, close() { this.readyState = 'closed'; } };
  const pc = {
    connectionState: 'new', fechado: false, faixas: 0, canalNome: null,
    addTrack() { this.faixas += 1; },
    createDataChannel(nome) { this.canalNome = nome; return canal; },
    async createOffer() { return { type: 'offer', sdp: SDP }; },
    async setLocalDescription() {},
    async setRemoteDescription(d) { this.remota = d; },
    close() { this.fechado = true; },
  };
  return { faixa, stream, canal, pc };
}

function controladorWeb({ cliente, d, mic, relogio, ouvintes }) {
  const janela = { addEventListener: (n, f) => { ouvintes[n] = f; }, removeEventListener: (n) => { delete ouvintes[n]; } };
  const modulo = carregar(codigoWeb, { '@studoo/contratos': contratos, './mensagens': { mensagens } }, {
    window: janela, document: undefined, navigator: {}, performance: { now: () => relogio.agora },
  });
  const estados = [];
  const fim = [];
  const fatais = [];
  const ctrl = modulo.iniciarControladorVozAoVivo(
    { licaoId: 'licao-1', cliente, aoMudar: (e) => estados.push(e), aoTempoEsgotado: (t) => fim.push(t), aoErroFatal: (c, p) => fatais.push([c, p]) },
    { pedirMic: mic ?? (async () => d.stream), criarPeer: () => d.pc, criarAudio: () => ({ autoplay: true, srcObject: null, muted: false }), agoraMs: () => relogio.agora },
  );
  return { modulo, ctrl, estados, fim, fatais, ultimo: () => estados.at(-1) };
}

function clienteFalso(registro, resposta = {}) {
  return {
    iniciarVozAoVivo: async (id, sdp) => { registro.inicios.push([id, sdp]); return { chamadaId: 'rtc_1', sdpResposta: SDP, modelo: 'm', voz: 'v', limiteSegundos: 180, avisoSegundos: 150, ...resposta }; },
    encerrarVozAoVivo: async (id, chamadaId) => { registro.encerradas.push([id, chamadaId]); return null; },
  };
}

function abrirConexao(d) {
  d.pc.connectionState = 'connected';
  d.pc.onconnectionstatechange?.();
  d.canal.readyState = 'open';
  d.canal.onopen?.();
}
const evento = (d, dados) => d.canal.onmessage?.({ data: JSON.stringify(dados) });

test('prévia web: oferta para iniciarVozAoVivo, canal oai-events, estados pelo redutor e encerrar com a fala da pessoa', async () => {
  const registro = { inicios: [], encerradas: [] };
  const d = dubles();
  const relogio = { agora: 1000 };
  const ouvintes = {};
  const c = controladorWeb({ cliente: clienteFalso(registro), d, relogio, ouvintes });
  assert.equal(typeof c.modulo.suporteVozAoVivo, 'function');
  assert.equal(c.modulo.suporteVozAoVivo(), false, 'sem RTCPeerConnection, sem suporte');
  await esperar(10);
  assert.equal(c.ultimo().estado, 'conectando');
  assert.equal(d.pc.canalNome, 'oai-events');
  assert.equal(d.pc.faixas, 1);
  assert.deepEqual(registro.inicios, [['licao-1', SDP]]);
  assert.equal(d.pc.remota.type, 'answer');
  assert.ok(ouvintes.pagehide, 'encerra no servidor ao sair da página');

  abrirConexao(d);
  assert.equal(c.ultimo().estado, 'ouvindo');
  assert.deepEqual(d.canal.enviados[0], { type: 'response.create' });

  // O Stu fala pelo buffer de áudio e volta a ouvir quando ele para.
  evento(d, { type: 'response.created' });
  evento(d, { type: 'output_audio_buffer.started' });
  evento(d, { type: 'response.output_audio_transcript.delta', response_id: 'r1', delta: 'Oi! Me explica como funciona o WHERE?' });
  assert.equal(c.ultimo().estado, 'stu_falando');
  evento(d, { type: 'output_audio_buffer.stopped' });
  assert.equal(c.ultimo().estado, 'ouvindo');
  // Quando a pessoa interrompe, a OpenAI manda `cleared` (e não `stopped`): o Stu também para de falar (b391588).
  evento(d, { type: 'output_audio_buffer.started' });
  assert.equal(c.ultimo().estado, 'stu_falando');
  evento(d, { type: 'output_audio_buffer.cleared' });
  assert.equal(c.ultimo().estado, 'ouvindo');

  // Item da pessoa criado (conversation.item.added) e a transcrição que chega depois do toque em Encerrar.
  evento(d, { type: 'conversation.item.added', item: { id: 'u1', role: 'user' } });
  const promessa = c.ctrl.encerrar();
  assert.equal(c.ultimo().estado, 'encerrando');
  setTimeout(() => evento(d, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'O WHERE filtra as linhas que cumprem a condição.' }), 20);
  assert.equal(await promessa, 'O WHERE filtra as linhas que cumprem a condição.');
  assert.deepEqual(registro.encerradas, [['licao-1', 'rtc_1']]);
  assert.equal(d.faixa.parada, true);
  assert.equal(d.pc.fechado, true);
  assert.equal(ouvintes.pagehide, undefined);
});

test('prévia web: aviso aos 150 s com o item de sistema e fim aos 180 s (com folga se o Stu estiver falando)', async () => {
  const registro = { inicios: [], encerradas: [] };
  const d = dubles();
  // O relógio começa depois do zero, como o performance.now() de verdade (o controlador usa o início > 0 como "conectou").
  const relogio = { agora: 1000 };
  const c = controladorWeb({ cliente: clienteFalso(registro), d, relogio, ouvintes: {} });
  await esperar(10);
  abrirConexao(d);
  relogio.agora = 151_500;
  await esperar(560);
  assert.equal(c.ultimo().avisoTempo, true);
  assert.equal(c.ultimo().segundos, 150);
  const sistema = d.canal.enviados.find((e) => e.type === 'conversation.item.create');
  assert.equal(sistema.item.role, 'system');
  assert.equal(sistema.item.content[0].text, contratos.TEXTO_AVISO_FECHAMENTO_VOZ);
  evento(d, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'Filtra as linhas da tabela.' });
  evento(d, { type: 'output_audio_buffer.started' });
  relogio.agora = 181_200;
  await esperar(560);
  assert.equal(c.fim.length, 0, 'o Stu falando ganha a folga');
  evento(d, { type: 'output_audio_buffer.stopped' });
  await esperar(20);
  assert.deepEqual(c.fim, ['Filtra as linhas da tabela.']);
  assert.deepEqual(registro.encerradas, [['licao-1', 'rtc_1']]);
});

test('prévia web: microfone negado vira erro sem fala; queda no meio leva a fala parcial para o campo', async () => {
  const registro = { inicios: [], encerradas: [] };
  const negado = controladorWeb({ cliente: clienteFalso(registro), d: dubles(), relogio: { agora: 0 }, ouvintes: {}, mic: async () => { throw new Error('NotAllowedError'); } });
  await esperar(10);
  assert.equal(negado.ultimo().estado, 'erro');
  assert.equal(negado.ultimo().erro, 'micNegado');
  assert.deepEqual(negado.fatais, [['micNegado', '']]);
  assert.equal(registro.inicios.length, 0);

  const d = dubles();
  const caiu = controladorWeb({ cliente: clienteFalso(registro), d, relogio: { agora: 1000 }, ouvintes: {} });
  await esperar(10);
  abrirConexao(d);
  evento(d, { type: 'conversation.item.input_audio_transcription.completed', item_id: 'u1', transcript: 'O WHERE filtra somente as linhas que cumprem a condição.' });
  d.pc.connectionState = 'failed';
  d.pc.onconnectionstatechange?.();
  assert.equal(caiu.ultimo().estado, 'erro');
  assert.equal(caiu.ultimo().erro, 'rede');
  assert.deepEqual(caiu.fatais, [['rede', 'O WHERE filtra somente as linhas que cumprem a condição.']]);
  await esperar(5);
  assert.deepEqual(registro.encerradas, [['licao-1', 'rtc_1']]);
});

test('prévia web: cancelar enquanto o microfone abre não chama o servidor; limite do servidor vira o erro "limite"', async () => {
  const registro = { inicios: [], encerradas: [] };
  let liberarMic;
  const d = dubles();
  const c = controladorWeb({ cliente: clienteFalso(registro), d, relogio: { agora: 0 }, ouvintes: {}, mic: () => new Promise((r) => { liberarMic = r; }) });
  c.ctrl.descartar();
  liberarMic(d.stream);
  await esperar(10);
  assert.equal(d.faixa.parada, true);
  assert.equal(registro.inicios.length, 0);

  const cliente = { iniciarVozAoVivo: async () => { const e = new Error('limite'); e.codigo = 'limite_estudio'; throw e; }, encerrarVozAoVivo: async () => null };
  const limite = controladorWeb({ cliente, d: dubles(), relogio: { agora: 0 }, ouvintes: {} });
  await esperar(10);
  assert.equal(limite.ultimo().erro, 'limite');
  assert.match(contratos.textoErroVozAoVivo('limite'), /limite de conversas ao vivo/);
});
