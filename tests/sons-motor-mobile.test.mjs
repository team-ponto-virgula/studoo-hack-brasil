import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// O motor do som do app (apps/mobile/src/sons.ts) com o expo-audio, o SecureStore e o relógio simulados, sem aparelho:
// o efeito toca na mesma volta do toque (sem `await`, sem modo de áudio e sem reprodutor novo), nada chega atrasado nem
// empilhado, a preferência e a gravação mandam, e o fundo passa de um reprodutor ao outro já posicionado.
const transpilar = async (caminho) => ts.transpileModule(await readFile(new URL(caminho, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const fonteSons = await transpilar('../apps/mobile/src/sons.ts');
const fonteCatalogo = await transpilar('../packages/contratos/src/catalogo-sons.ts');
const fonteEstado = await transpilar('../packages/contratos/src/som-estado.ts');

function modulo(fonte, requerer = () => ({})) {
  const exports = {};
  runInNewContext(fonte, { exports, require: requerer });
  return exports;
}
const catalogo = modulo(fonteCatalogo);
const estado = modulo(fonteEstado);

function ambiente({ salvo = {}, plataforma = 'ios', registro = false } = {}) {
  let relogio = 1000;
  const temporizadores = new Map();
  let proximoId = 1;
  const chamadas = [];
  const jogadores = [];
  const armazenado = new Map(Object.entries(salvo));
  let leituras = [];

  class Reprodutor {
    constructor(fonte, opcoes) {
      this.fonte = fonte;
      this.opcoes = opcoes;
      this.isLoaded = false;
      this.playing = false;
      this.volume = 1;
      this.base = 0;
      this.desde = 0;
      this.duration = fonte.endsWith('.mp3') ? 89.328 : 0.3;
      this.ouvintes = new Set();
      jogadores.push(this);
      chamadas.push(['criar', fonte]);
    }
    /** A posição anda com o relógio enquanto toca, como no aparelho. */
    get currentTime() { return this.playing ? this.base + (relogio - this.desde) / 1000 : this.base; }
    addListener(_evento, ouvinte) { this.ouvintes.add(ouvinte); return { remove: () => this.ouvintes.delete(ouvinte) }; }
    avisar(status) { for (const ouvinte of this.ouvintes) ouvinte({ isLoaded: this.isLoaded, playing: this.playing, didJustFinish: false, ...status }); }
    carregar() { this.isLoaded = true; this.avisar({}); }
    play() { chamadas.push(['play', this.fonte, relogio]); this.desde = relogio; this.playing = true; this.avisar({ playing: true }); }
    pause() { chamadas.push(['pause', this.fonte, relogio]); this.base = this.currentTime; this.playing = false; }
    seekTo(segundos) { chamadas.push(['seek', this.fonte, segundos]); this.base = segundos; this.desde = relogio; return Promise.resolve(); }
    terminar() { this.playing = false; this.avisar({ didJustFinish: true, playing: false }); }
    remove() { chamadas.push(['remove', this.fonte]); }
  }

  const registros = [];
  const contexto = {
    exports: {},
    process: { env: registro ? { EXPO_PUBLIC_STUDOO_REGISTRO_SOM: '1' } : {} },
    console: { info: (linha) => registros.push(linha), warn() {}, error() {}, log() {} },
    Date: { now: () => relogio },
    setTimeout: (funcao, atraso = 0) => { const id = proximoId++; temporizadores.set(id, { funcao, quando: relogio + atraso, intervalo: null }); return id; },
    clearTimeout: (id) => temporizadores.delete(id),
    setInterval: (funcao, atraso) => { const id = proximoId++; temporizadores.set(id, { funcao, quando: relogio + atraso, intervalo: atraso }); return id; },
    clearInterval: (id) => temporizadores.delete(id),
    require: (nome) => {
      if (nome === 'react-native') {
        return {
          Platform: { OS: plataforma },
          AppState: { addEventListener: () => ({ remove() {} }) },
          AccessibilityInfo: { isScreenReaderEnabled: () => Promise.resolve(false) },
        };
      }
      if (nome === 'expo-secure-store') {
        return {
          getItemAsync: (chave) => new Promise((resolve) => leituras.push(() => resolve(armazenado.get(chave) ?? null))),
          setItemAsync: (chave, valor) => { armazenado.set(chave, valor); return Promise.resolve(); },
        };
      }
      if (nome === 'expo-audio') {
        return {
          createAudioPlayer: (fonte, opcoes) => new Reprodutor(fonte, opcoes),
          setAudioModeAsync: (modo) => { chamadas.push(['modo', modo]); return Promise.resolve(); },
        };
      }
      if (nome.endsWith('catalogo-sons')) return catalogo;
      if (nome.endsWith('som-estado')) return estado;
      // Os arquivos de som (`require('../assets/sons/sfx/acerto.wav')`) viram o próprio nome.
      return nome.split('/').pop();
    },
  };
  runInNewContext(fonteSons, contexto);
  const { tocaSons, ATRASO_MAXIMO_EFEITO_MS } = contexto.exports;

  const avancar = (ms) => {
    const fim = relogio + ms;
    for (;;) {
      const [id, proximo] = [...temporizadores].filter(([, t]) => t.quando <= fim).sort((a, b) => a[1].quando - b[1].quando)[0] ?? [];
      if (!proximo) break;
      relogio = Math.max(relogio, proximo.quando);
      if (proximo.intervalo) proximo.quando += proximo.intervalo; else temporizadores.delete(id);
      proximo.funcao();
    }
    relogio = fim;
  };
  const microtarefas = () => new Promise((resolve) => setImmediate(resolve));
  /** Responde as leituras do SecureStore e deixa as promessas andarem. */
  const lerArmazenamento = async () => {
    while (leituras.length) { const pendentes = leituras; leituras = []; pendentes.forEach((r) => r()); await microtarefas(); }
    await microtarefas();
  };
  const jogador = (arquivo) => jogadores.find((j) => j.fonte === arquivo);
  const contar = (tipo, arquivo) => chamadas.filter(([t, f]) => t === tipo && (arquivo === undefined || f === arquivo)).length;
  /** Abre a sessão: lê as preferências, aquece todos os efeitos (um a cada 40 ms) e carrega os arquivos. */
  const abrir = async () => {
    const lendo = tocaSons.carregarPreferencias();
    await lerArmazenamento();
    await lendo;
    avancar(40 * 30);
    for (const j of jogadores) if (!j.isLoaded) j.carregar();
  };
  return { tocaSons, ATRASO_MAXIMO_EFEITO_MS, avancar, microtarefas, lerArmazenamento, jogador, jogadores, chamadas, contar, abrir, registros,
    armazenado, agora: () => relogio };
}

test('o toque toca na mesma volta: play() antes de qualquer espera, sem modo de áudio e sem reprodutor novo', async () => {
  const a = ambiente();
  await a.abrir();
  assert.equal(a.jogadores.length, 22, 'um reprodutor por efeito, aquecido ao abrir');
  assert.equal(a.contar('modo'), 1, 'o modo normal sai uma vez, ao ler as preferências');
  const antes = { criar: a.contar('criar'), modo: a.contar('modo') };
  a.tocaSons.tocarEfeito('toque_opcao');
  // Nenhuma microtarefa rodou ainda: o play() saiu dentro do próprio toque.
  assert.equal(a.contar('play', 'toque-opcao.wav'), 1);
  assert.equal(a.contar('criar'), antes.criar, 'nenhum reprodutor novo');
  assert.equal(a.contar('modo'), antes.modo, 'nenhum setAudioModeAsync no toque');
  assert.deepEqual({ ...a.tocaSons.medidas.at(-1) }, { id: 'toque_opcao', pedidoEm: a.agora(), playEm: a.agora(), resultado: 'tocou' });
  assert.equal(a.jogador('toque-opcao.wav').opcoes.downloadFirst, true, 'no aparelho, do arquivo baixado (Expo Go: uma vez, do Metro)');
});

test('ao terminar, o reprodutor volta ao começo: o próximo toque é só play(); tocando ainda, recomeça sem empilhar', async () => {
  const a = ambiente();
  await a.abrir();
  const acerto = a.jogador('acerto.wav');
  a.tocaSons.tocarEfeito('acerto');
  acerto.terminar();
  await a.microtarefas();
  assert.equal(a.contar('seek', 'acerto.wav'), 1, 'rebobinado ao terminar');
  a.avancar(500);
  a.tocaSons.tocarEfeito('acerto');
  assert.equal(a.contar('play', 'acerto.wav'), 2, 'o segundo toque também sai na hora');
  // Ainda tocando (passou o intervalo mínimo de 120 ms): recomeça do início no mesmo reprodutor, sem um segundo play().
  a.avancar(200);
  a.tocaSons.tocarEfeito('acerto');
  assert.equal(a.contar('play', 'acerto.wav'), 2);
  assert.equal(a.contar('seek', 'acerto.wav'), 2);
  assert.equal(a.jogadores.filter((j) => j.fonte === 'acerto.wav').length, 1, 'um reprodutor só para o acerto');
});

test('intervalo mínimo do catálogo: dois toques juntos tocam uma vez', async () => {
  const a = ambiente();
  await a.abrir();
  a.tocaSons.tocarEfeito('erro');
  a.avancar(50);
  a.tocaSons.tocarEfeito('erro');
  assert.equal(a.contar('play', 'erro.wav'), 1);
  assert.equal(a.tocaSons.medidas.at(-1).resultado, 'calado');
});

test('arquivo ainda carregando: toca se carregar em até 120 ms do pedido; depois, fica calado (nada atrasado)', async () => {
  const a = ambiente();
  const lendo = a.tocaSons.carregarPreferencias();
  await a.lerArmazenamento();
  await lendo;
  a.avancar(40 * 30);
  const pronta = a.jogador('geracao-pronta.wav');
  a.tocaSons.tocarEfeito('geracao_pronta');
  assert.equal(a.contar('play', 'geracao-pronta.wav'), 0);
  a.avancar(a.ATRASO_MAXIMO_EFEITO_MS - 20);
  pronta.carregar();
  assert.equal(a.contar('play', 'geracao-pronta.wav'), 1, 'carregou a tempo: toca');
  const licao = a.jogador('geracao-licao.wav');
  a.tocaSons.tocarEfeito('geracao_licao');
  a.avancar(a.ATRASO_MAXIMO_EFEITO_MS + 1);
  licao.carregar();
  assert.equal(a.contar('play', 'geracao-licao.wav'), 0, 'carregou tarde: calado');
});

test('preferências ainda chegando: o toque espera a leitura e respeita o que estava salvo', async () => {
  const desligado = ambiente({ salvo: { 'studoo.sons.efeitos': '0' } });
  desligado.tocaSons.tocarEfeito('toque_opcao');
  await desligado.lerArmazenamento();
  assert.equal(desligado.contar('play'), 0, 'efeitos desligados no aparelho: nada toca');
  assert.equal(desligado.jogadores.length, 0, 'e nada é aquecido');

  const lento = ambiente();
  lento.tocaSons.tocarEfeito('toque_opcao');
  lento.avancar(lento.ATRASO_MAXIMO_EFEITO_MS + 50);
  await lento.lerArmazenamento();
  assert.equal(lento.contar('play'), 0, 'a leitura passou do prazo: o toque não sai atrasado');
});

test('efeitos desligados não tocam; ligar de novo aquece e confirma com "salvo"', async () => {
  const a = ambiente({ salvo: { 'studoo.sons.efeitos': '0' } });
  await a.abrir();
  a.tocaSons.tocarEfeito('acerto');
  assert.equal(a.contar('play'), 0);
  await a.tocaSons.definirEfeitosAtivos(true);
  assert.ok(a.jogador('salvo.wav'), 'o reprodutor do "salvo" foi criado ao ligar');
  a.jogador('salvo.wav').carregar();
  assert.equal(a.contar('play', 'salvo.wav'), 1);
});

test('gravação e voz ao vivo: só os dois bipes, sem mexer no modo de áudio; ao sair, o modo normal volta uma vez', async () => {
  const a = ambiente({ salvo: { 'studoo.sons.fundo': 'mudo' } });
  await a.abrir();
  const modoAntes = a.contar('modo');
  a.tocaSons.entrarEmGravacaoOuVoz();
  a.tocaSons.tocarEfeito('gravacao_inicio');
  a.tocaSons.tocarEfeito('acerto');
  a.tocaSons.tocarEfeito('toque_opcao');
  assert.equal(a.contar('play', 'gravacao-inicio.wav'), 1);
  assert.equal(a.contar('play', 'acerto.wav') + a.contar('play', 'toque-opcao.wav'), 0);
  assert.equal(a.contar('modo'), modoAntes, 'nenhum setAudioModeAsync durante a gravação');
  a.tocaSons.sairDeGravacaoOuVoz();
  await a.microtarefas();
  assert.equal(a.contar('modo'), modoAntes + 1);
});

test('aquecer de novo (outra tela montada, a sessão aberta outra vez) não duplica reprodutores', async () => {
  const a = ambiente();
  await a.abrir();
  a.tocaSons.aquecerEfeitos();
  await a.tocaSons.carregarPreferencias();
  a.avancar(2000);
  assert.equal(a.jogadores.length, 22);
});

test('registro para a conferência nativa: comando antes do play e reprodução quando o reprodutor avisa, só com a variável', async () => {
  const a = ambiente({ registro: true });
  await a.abrir();
  a.tocaSons.tocarEfeito('aviso');
  assert.deepEqual(a.registros.map((linha) => linha.replace(/\d+$/, 'T')), ['[som] comando aviso T', '[som] reproducao aviso T']);
  const b = ambiente();
  await b.abrir();
  b.tocaSons.tocarEfeito('aviso');
  assert.equal(b.registros.length, 0, 'sem a variável, nada no log');
});

test('virada do laço: B já fica no começo do trecho; no cruzamento (180 ms antes do fim, pela posição), play() sem seek', async () => {
  const a = ambiente();
  await a.abrir();
  a.tocaSons.registrarGesto();
  for (let i = 0; i < 4; i += 1) await a.microtarefas();
  const fundos = a.jogadores.filter((j) => j.fonte === 'lofi-estudo.mp3');
  assert.equal(fundos.length, 2, 'dois reprodutores, um par só');
  const def = catalogo.CATALOGO_FUNDOS.find((f) => f.id === 'lofi_estudo');
  assert.deepEqual([def.duracaoMs, def.volume, def.aparoInicioSeg, def.aparoFimSeg], [89328, 0.24, 0.026, 0], 'o catálogo de d5bf5aa');
  const [jA, jB] = fundos;
  assert.equal(a.chamadas.filter(([t, f, s]) => t === 'seek' && f === 'lofi-estudo.mp3' && s === def.aparoInicioSeg).length, 2,
    'A e B posicionados no começo do trecho ao nascer');
  const seeksAntes = a.contar('seek', 'lofi-estudo.mp3');
  a.avancar(def.duracaoMs - Math.round((def.aparoInicioSeg + def.aparoFimSeg) * 1000) - 180);
  assert.ok(jB.playing, 'B entrou no cruzamento');
  assert.equal(a.contar('seek', 'lofi-estudo.mp3'), seeksAntes, 'sem seek no instante do play (no iPhone ele chegaria depois)');
  a.avancar(200);
  assert.equal(jA.playing, false, 'A saiu');
  assert.equal(a.contar('seek', 'lofi-estudo.mp3'), seeksAntes + 1, 'e já voltou ao começo para a próxima volta');
  // A segunda volta também cruza (agora de B para A), pela posição de B.
  a.avancar(def.duracaoMs - 26 - 180);
  assert.ok(jA.playing && !jB.playing, 'a volta seguinte cruzou de novo');
});

test('fundo: dois pedidos seguidos (ligar e desligar enquanto o modo de áudio é aplicado) não deixam reprodutor sobrando', async () => {
  const a = ambiente({ salvo: { 'studoo.sons.fundo': 'mudo' } });
  await a.abrir();
  a.tocaSons.registrarGesto();
  void a.tocaSons.definirMusicaLigada(true);
  void a.tocaSons.definirMusicaLigada(false);
  for (let i = 0; i < 6; i += 1) await a.microtarefas();
  a.avancar(1000);
  const vivos = a.jogadores.filter((j) => j.fonte.endsWith('.mp3') && !a.chamadas.some(([t, f]) => t === 'remove' && f === j.fonte));
  assert.equal(vivos.length, 0, 'mudo no fim: nenhum fundo vivo');
});

test('uma música só: instalação nova liga o Lo-fi, "mudo" escolhido continua e os climas antigos viram o Lo-fi', async () => {
  const nova = ambiente();
  await nova.abrir();
  assert.equal(nova.tocaSons.obterPreferencias().fundo, 'lofi_estudo', 'ligada por padrão');
  const mudo = ambiente({ salvo: { 'studoo.sons.fundo': 'mudo' } });
  await mudo.abrir();
  assert.equal(mudo.tocaSons.obterPreferencias().fundo, 'mudo', 'o silêncio escolhido fica');
  const antigo = ambiente({ salvo: { 'studoo.sons.fundo': 'chuva_suave' } });
  await antigo.abrir();
  assert.equal(antigo.tocaSons.obterPreferencias().fundo, 'lofi_estudo');
  await antigo.tocaSons.definirFundo('biblioteca');
  assert.equal(antigo.tocaSons.obterPreferencias().fundo, 'lofi_estudo', 'nenhum outro clima entra');
  await antigo.tocaSons.definirMusicaLigada(false);
  assert.equal(antigo.armazenado.get('studoo.sons.fundo'), 'mudo');
});

test('a música começa no primeiro gesto, segue por cima dos efeitos (mesmo volume, sem pausa nem recomeço)', async () => {
  const a = ambiente();
  await a.abrir();
  assert.equal(a.jogadores.filter((j) => j.fonte === 'lofi-estudo.mp3').length, 0, 'nada antes do primeiro gesto');
  a.tocaSons.registrarGesto();
  for (let i = 0; i < 4; i += 1) await a.microtarefas();
  const [musicaA] = a.jogadores.filter((j) => j.fonte === 'lofi-estudo.mp3');
  assert.ok(musicaA?.playing, 'tocando');
  a.avancar(1000);
  const volume = musicaA.volume;
  const pausasAntes = a.contar('pause', 'lofi-estudo.mp3');
  const playsAntes = a.contar('play', 'lofi-estudo.mp3');
  for (const id of ['acerto', 'erro', 'toque_opcao', 'concluir_licao']) { a.tocaSons.tocarEfeito(id); a.avancar(150); }
  assert.equal(musicaA.volume, volume, 'os efeitos não baixam a música');
  assert.equal(a.contar('pause', 'lofi-estudo.mp3'), pausasAntes, 'nem pausam');
  assert.equal(a.contar('play', 'lofi-estudo.mp3'), playsAntes, 'nem recomeçam');
  assert.equal(a.tocaSons.obterEstado().estadoFundo, 'tocando');
});

test('gravação e segundo plano pausam onde estava; a música volta do mesmo ponto, sem voltar ao começo', async () => {
  const a = ambiente();
  await a.abrir();
  a.tocaSons.registrarGesto();
  for (let i = 0; i < 4; i += 1) await a.microtarefas();
  const [musicaA] = a.jogadores.filter((j) => j.fonte === 'lofi-estudo.mp3');
  a.avancar(30000);
  const antes = musicaA.currentTime;
  a.tocaSons.entrarEmGravacaoOuVoz();
  await a.microtarefas();
  assert.equal(musicaA.playing, false, 'pausada na gravação');
  const seeks = a.contar('seek', 'lofi-estudo.mp3');
  a.avancar(5000);
  a.tocaSons.sairDeGravacaoOuVoz();
  for (let i = 0; i < 4; i += 1) await a.microtarefas();
  assert.equal(musicaA.playing, true, 'voltou');
  assert.equal(a.contar('seek', 'lofi-estudo.mp3'), seeks, 'sem seek ao começo');
  assert.ok(Math.abs(musicaA.currentTime - antes) < 0.05, `do mesmo ponto (${antes.toFixed(2)} s)`);
  assert.equal(a.jogadores.filter((j) => j.fonte === 'lofi-estudo.mp3').length, 2, 'os mesmos dois reprodutores');
});

test('registro do fundo para a conferência nativa: posição, volume e qual reprodutor, 0 e 200 ms depois de cada efeito', async () => {
  const a = ambiente({ registro: true });
  await a.abrir();
  a.tocaSons.registrarGesto();
  for (let i = 0; i < 4; i += 1) await a.microtarefas();
  a.avancar(1000);
  a.registros.length = 0;
  a.tocaSons.tocarEfeito('acerto');
  a.avancar(250);
  const fundo = a.registros.filter((linha) => linha.startsWith('[som] fundo '));
  assert.ok(fundo.length >= 2, 'duas linhas depois do efeito');
  assert.match(fundo[0], /^\[som\] fundo lofi_estudo A tocando \d+\/89328 \d\.\d{3} \d+$/);
});
