/**
 * Toca-sons do app Mobile (Expo) para o Studoo (alinhado à docs/specs/12-som.md).
 * - Usa `expo-audio` com `playsInSilentMode: false` para respeitar a chave de silêncio do iPhone.
 * - Efeitos em WAV mono 44.1 kHz (0 ms de atraso de codificador; o sinal passa de −20 dBFS nos primeiros 3 ms).
 * - Efeitos sem espera no toque: um reprodutor por efeito, criado uma vez (logo que as preferências chegam), carregado de
 *   um arquivo local e rebobinado ao terminar. O toque só chama `play()`, na mesma volta do evento, sem `await`, sem
 *   trocar o modo de áudio e sem criar reprodutor. Um efeito que não consegue tocar em até 120 ms do pedido (arquivo
 *   ainda carregando, preferências ainda chegando) fica calado: um som atrasado engana mais que nenhum.
 * - Fundos em MP3 com dois reprodutores alternados em cruzamento suave (150 ms) para evitar buraco na emenda; o próximo
 *   já fica posicionado no começo do trecho, porque no iPhone `play()` é imediato e `seekTo()` chega depois.
 * - Começa apenas após o primeiro gesto (`registrarGesto()` ou toque em controle), com rampas de 600/300/400 ms.
 * - Posse do modo de áudio delegada a `MaquinaEstadoSom` (`packages/contratos/src/som-estado.ts`):
 *   nunca chama `setAudioModeAsync` durante gravação/voz ao vivo ou fala de lição; aplica o modo normal ao carregar as
 *   preferências, antes do fundo e de novo em `sairDeFala()` e `sairDeGravacaoOuVoz()` (não a cada efeito).
 * - Preferências persistidas em `SecureStore`.
 */

import { AccessibilityInfo, AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource, type AudioStatus } from 'expo-audio';
import {
  CATALOGO_EFEITOS,
  CATALOGO_FUNDOS,
  MENSAGEM_ERRO_FUNDO,
  PADRAO_PREFERENCIAS_SOM,
  type EstadoReproducaoFundo,
  type EstadoSomSnapshot,
  type IdEfeitoSonoro,
  type IdSomFundo,
  type PreferenciasSom,
} from '../../../packages/contratos/src/catalogo-sons';
import { MaquinaEstadoSom } from '../../../packages/contratos/src/som-estado';

const CHAVE_EFEITOS = 'studoo.sons.efeitos';
const CHAVE_FUNDO = 'studoo.sons.fundo';

const IDS_FUNDOS_VALIDOS = new Set<IdSomFundo>([
  'mudo',
  'foco_calmo',
  'chuva_suave',
  'lofi_estudo',
  'biblioteca',
  'brisa_natural',
]);

const FONTES_SFX: Record<IdEfeitoSonoro, AudioSource> = {
  toque_opcao: require('../assets/sons/sfx/toque-opcao.wav'),
  ordenar_soltar: require('../assets/sons/sfx/ordenar-soltar.wav'),
  acerto: require('../assets/sons/sfx/acerto.wav'),
  erro: require('../assets/sons/sfx/erro.wav'),
  ponte_abrir: require('../assets/sons/sfx/ponte-abrir.wav'),
  concluir_licao: require('../assets/sons/sfx/concluir-licao.wav'),
  concluir_trilha: require('../assets/sons/sfx/concluir-trilha.wav'),
  conta_criada: require('../assets/sons/sfx/conta-criada.wav'),
  entrar: require('../assets/sons/sfx/entrar.wav'),
  geracao_licao: require('../assets/sons/sfx/geracao-licao.wav'),
  geracao_pronta: require('../assets/sons/sfx/geracao-pronta.wav'),
  valeu: require('../assets/sons/sfx/valeu.wav'),
  seguir: require('../assets/sons/sfx/seguir.wav'),
  link_copiado: require('../assets/sons/sfx/link-copiado.wav'),
  salvo: require('../assets/sons/sfx/salvo.wav'),
  aviso: require('../assets/sons/sfx/aviso.wav'),
  erro_rede: require('../assets/sons/sfx/erro-rede.wav'),
  apagar: require('../assets/sons/sfx/apagar.wav'),
  gravacao_inicio: require('../assets/sons/sfx/gravacao-inicio.wav'),
  gravacao_fim: require('../assets/sons/sfx/gravacao-fim.wav'),
  cronometro_inicio: require('../assets/sons/sfx/cronometro-inicio.wav'),
  cronometro_fim: require('../assets/sons/sfx/cronometro-fim.wav'),
};

const FONTES_FUNDOS: Record<Exclude<IdSomFundo, 'mudo'>, AudioSource> = {
  foco_calmo: require('../assets/sons/fundos/foco-calmo.mp3'),
  chuva_suave: require('../assets/sons/fundos/chuva-suave.mp3'),
  lofi_estudo: require('../assets/sons/fundos/lofi-estudo.mp3'),
  biblioteca: require('../assets/sons/fundos/biblioteca.mp3'),
  brisa_natural: require('../assets/sons/fundos/brisa-natural.mp3'),
};

type OuvinteEstado = (estado: EstadoSomSnapshot) => void;

/** Até quanto depois do pedido um efeito ainda toca (arquivo carregando, preferências chegando); depois, calado. */
export const ATRASO_MAXIMO_EFEITO_MS = 120;

/**
 * Registro do som para a conferência nativa (Mobile 2, linha do tempo de apps/mobile/conferencia-nativa): só com
 * `EXPO_PUBLIC_STUDOO_REGISTRO_SOM=1` no Metro. "comando" sai quando o app manda tocar (depois do intervalo mínimo, antes do
 * `play()`) e "reproducao" quando o reprodutor avisa pela primeira vez que está tocando; o fundo usa o id do fundo.
 */
const REGISTRAR_SOM = process.env.EXPO_PUBLIC_STUDOO_REGISTRO_SOM === '1';
function registrarSom(tipo: 'comando' | 'reproducao', id: string): void {
  if (REGISTRAR_SOM) console.info(`[som] ${tipo} ${id} ${Date.now()}`);
}

/** Os efeitos que o app aquece quando as preferências chegam, na ordem: os do toque e da aula primeiro. */
const ORDEM_DE_AQUECIMENTO = Object.keys(FONTES_SFX) as IdEfeitoSonoro[];

/** Um reprodutor por efeito, reaproveitado: carregado, e parado no começo do arquivo entre um toque e outro. */
type JogadorDeEfeito = {
  player: AudioPlayer;
  /** O arquivo carregou (status `isLoaded`): o toque pode chamar `play()` direto. */
  pronto: boolean;
  /** Parado no começo do arquivo (novo ou rebobinado ao terminar): o toque é só `play()`. */
  noInicio: boolean;
  /** Pedido feito antes de o arquivo carregar: toca se carregar até este instante (Date.now). */
  pendenteAte: number | null;
  /** Mandou tocar e ainda não ouviu do reprodutor que está tocando (para o registro "reproducao"). */
  esperandoReproducao: boolean;
  assinatura: { remove: () => void } | null;
};

/** O que cada toque fez, para a medida no aparelho e nos testes (só os últimos 40). */
export type MedidaDeEfeito = { id: IdEfeitoSonoro; pedidoEm: number; playEm: number | null; resultado: 'tocou' | 'carregando' | 'atrasado' | 'calado' };

class TocaSonsMobile {
  private estado = new MaquinaEstadoSom();
  /** As preferências salvas já foram lidas (ou a pessoa já escolheu algo nesta sessão). */
  private prefsProntas = false;
  private lendoPrefs: Promise<PreferenciasSom> | null = null;
  private desbloqueado = false;
  private ultimoDisparo = new Map<IdEfeitoSonoro, number>();
  private efeitos = new Map<IdEfeitoSonoro, JogadorDeEfeito>();
  private aquecimento: ReturnType<typeof setTimeout> | null = null;
  readonly medidas: MedidaDeEfeito[] = [];
  /** A versão do pedido de fundo: um pedido que espera o modo de áudio não passa por cima de um mais novo. */
  private versaoFundo = 0;
  /** Reprodutor de fundo que mandou tocar e ainda não avisou que está tocando (registro "reproducao"). */
  private fundoEsperandoReproducao = new WeakMap<AudioPlayer, string>();

  private listenerAppState: { remove: () => void } | null = null;
  private fundoAtualId: Exclude<IdSomFundo, 'mudo'> | null = null;
  private jogadorA: AudioPlayer | null = null;
  private jogadorB: AudioPlayer | null = null;
  private ativoEhA = true;
  private volumeAtual = 0;
  private timerCruzamento: ReturnType<typeof setTimeout> | null = null;
  private timerRampa: ReturnType<typeof setInterval> | null = null;
  private timerPreview: ReturnType<typeof setTimeout> | null = null;

  private estadoFundo: EstadoReproducaoFundo = 'parado';
  private erroFundo: string | null = null;
  private ouvintes = new Set<OuvinteEstado>();

  private folhaAberta = false;
  private leitorDeTela = false;

  /**
   * Lê as preferências salvas uma vez (as chamadas seguintes reaproveitam a mesma leitura), aplica o modo normal de áudio e
   * aquece os efeitos. Chamado ao abrir a sessão e o controle de som, antes do primeiro toque.
   */
  carregarPreferencias(): Promise<PreferenciasSom> {
    if (this.prefsProntas) return Promise.resolve(this.obterPreferencias());
    this.lendoPrefs ??= this.lerPreferencias();
    return this.lendoPrefs;
  }

  private async lerPreferencias(): Promise<PreferenciasSom> {
    let efeitos: boolean = PADRAO_PREFERENCIAS_SOM.efeitosAtivos;
    let fundo: IdSomFundo = PADRAO_PREFERENCIAS_SOM.fundo;
    try {
      const [e, f] = await Promise.all([
        SecureStore.getItemAsync(CHAVE_EFEITOS),
        SecureStore.getItemAsync(CHAVE_FUNDO),
      ]);
      if (e !== null) efeitos = e === '1';
      if (f && IDS_FUNDOS_VALIDOS.has(f as IdSomFundo)) fundo = f as IdSomFundo;
    } catch {
      // Sem armazenamento: o padrão.
    }
    // A pessoa mudou algo enquanto a leitura andava: vale a escolha dela, não o que estava salvo.
    if (!this.prefsProntas) {
      this.estado.definirEfeitosAtivos(efeitos);
      this.estado.definirFundo(fundo);
      this.prefsProntas = true;
    }
    this.garantirAppState();
    void this.aplicarModoNormalSePermitido();
    this.aquecerEfeitos();
    this.notificar();
    return this.obterPreferencias();
  }

  obterPreferencias(): PreferenciasSom {
    return {
      efeitosAtivos: this.estado.efeitosAtivos,
      fundo: this.estado.fundo,
    };
  }

  obterEstado(): EstadoSomSnapshot {
    return {
      efeitosAtivos: this.estado.efeitosAtivos,
      fundo: this.estado.fundo,
      estadoFundo: this.estadoFundo,
      motivoPausa: this.estado.motivoPausa(this.desbloqueado),
      desbloqueado: this.desbloqueado,
      erroFundo: this.erroFundo,
    };
  }

  assinarEstado(ouvinte: OuvinteEstado): () => void {
    this.ouvintes.add(ouvinte);
    ouvinte(this.obterEstado());
    return () => {
      this.ouvintes.delete(ouvinte);
    };
  }

  private notificar(): void {
    const snap = this.obterEstado();
    for (const o of this.ouvintes) o(snap);
  }

  /** Registra o primeiro gesto no app para liberar o som de fundo salvo (paridade com a web). */
  registrarGesto(): void {
    if (this.desbloqueado) return;
    this.desbloqueado = true;
    void this.atualizarEstadoFundo(600);
    this.notificar();
  }

  private garantirAppState(): void {
    if (this.listenerAppState || Platform.OS === 'web') return;
    this.listenerAppState = AppState.addEventListener('change', (estado) => {
      this.estado.definirSegundoPlano(estado !== 'active');
      void this.atualizarEstadoFundo(this.estado.emSegundoPlano ? 0 : 600);
    });
  }

  /**
   * Aplica o modo normal do toca-sons (`playsInSilentMode: false`).
   * Só executa quando `MaquinaEstadoSom.podeConfigurarModoAgora()` é verdadeiro.
   */
  private async aplicarModoNormalSePermitido(): Promise<void> {
    if (Platform.OS === 'web' || !this.estado.podeConfigurarModoAgora()) return;
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'duckOthers',
    }).catch(() => undefined);
  }

  /**
   * Toca um efeito na hora, na mesma volta do evento que o pediu: sem `await`, sem trocar o modo de áudio e sem criar
   * reprodutor (o do efeito já está carregado e no começo do arquivo). Respeita a preferência, a gravação e a voz ao vivo
   * (`MaquinaEstadoSom`) e o intervalo mínimo do catálogo. Se o arquivo ainda carrega, toca quando carregar, desde que
   * dentro de 120 ms do pedido; depois disso fica calado, para nenhum som chegar atrasado ou empilhado.
   */
  tocarEfeito(id: IdEfeitoSonoro): void {
    const pedidoEm = Date.now();
    if (!this.prefsProntas) {
      void this.carregarPreferencias().then(() => this.disparar(id, pedidoEm));
      return;
    }
    this.disparar(id, pedidoEm);
  }

  private disparar(id: IdEfeitoSonoro, pedidoEm: number): void {
    this.desbloqueado = true;
    if (!this.estado.podeTocarEfeito(id)) return this.medir(id, pedidoEm, null, 'calado');
    if (Date.now() - pedidoEm > ATRASO_MAXIMO_EFEITO_MS) return this.medir(id, pedidoEm, null, 'atrasado');
    const def = CATALOGO_EFEITOS[id];
    if (pedidoEm - (this.ultimoDisparo.get(id) ?? Number.NEGATIVE_INFINITY) < def.cooldownMs) return this.medir(id, pedidoEm, null, 'calado');
    const jogador = this.efeitos.get(id) ?? this.criarJogadorDeEfeito(id);
    if (!jogador) return this.medir(id, pedidoEm, null, 'calado');
    this.ultimoDisparo.set(id, pedidoEm);
    if (!jogador.pronto) {
      jogador.pendenteAte = pedidoEm + ATRASO_MAXIMO_EFEITO_MS;
      return this.medir(id, pedidoEm, null, 'carregando');
    }
    this.tocarJa(id, jogador, pedidoEm);
  }

  private tocarJa(id: IdEfeitoSonoro, jogador: JogadorDeEfeito, pedidoEm: number): void {
    const { player } = jogador;
    try {
      registrarSom('comando', id);
      jogador.esperandoReproducao = true;
      player.volume = CATALOGO_EFEITOS[id].volume;
      if (player.playing) {
        // Ainda tocando o anterior: recomeça do início, no mesmo reprodutor (sem empilhar dois).
        void player.seekTo(0).catch(() => undefined);
      } else if (jogador.noInicio) {
        jogador.noInicio = false;
        player.play();
      } else {
        // Parado no meio (interrompido): volta ao começo antes de tocar (no iPhone, `seekTo` chega depois do `play`).
        void player.seekTo(0).then(() => player.play()).catch(() => undefined);
      }
      this.medir(id, pedidoEm, Date.now(), 'tocou');
    } catch {
      // Falha silenciosa: som nunca bloqueia a interface.
    }
  }

  /** Cria o reprodutor de um efeito (uma vez por efeito), de um arquivo local, e o mantém rebobinado ao terminar. */
  private criarJogadorDeEfeito(id: IdEfeitoSonoro): JogadorDeEfeito | null {
    let player: AudioPlayer;
    try {
      // No Expo Go o arquivo vem do Metro: baixado uma vez para o aparelho, o reprodutor carrega de um arquivo local.
      player = createAudioPlayer(FONTES_SFX[id], { downloadFirst: Platform.OS !== 'web' });
    } catch {
      return null;
    }
    const jogador: JogadorDeEfeito = { player, pronto: false, noInicio: true, pendenteAte: null, esperandoReproducao: false, assinatura: null };
    try {
      player.volume = CATALOGO_EFEITOS[id].volume;
      jogador.pronto = player.isLoaded;
      jogador.assinatura = player.addListener('playbackStatusUpdate', (status: AudioStatus) => this.aoMudarEfeito(id, jogador, status));
    } catch {
      // Sem eventos: o reprodutor ainda toca, só não rebobina sozinho.
    }
    this.efeitos.set(id, jogador);
    return jogador;
  }

  private aoMudarEfeito(id: IdEfeitoSonoro, jogador: JogadorDeEfeito, status: AudioStatus): void {
    if (status.playing && jogador.esperandoReproducao) {
      jogador.esperandoReproducao = false;
      registrarSom('reproducao', id);
    }
    if (status.isLoaded && !jogador.pronto) {
      jogador.pronto = true;
      const prazo = jogador.pendenteAte;
      jogador.pendenteAte = null;
      if (prazo !== null && Date.now() <= prazo && this.estado.podeTocarEfeito(id)) this.tocarJa(id, jogador, prazo - ATRASO_MAXIMO_EFEITO_MS);
    }
    if (status.didJustFinish) {
      jogador.noInicio = false;
      void jogador.player.seekTo(0).then(() => {
        if (!jogador.player.playing) jogador.noInicio = true;
      }).catch(() => undefined);
    }
  }

  /**
   * Aquece os efeitos: cria o reprodutor de cada um, aos poucos (um a cada 40 ms, para não disputar com a tela que abre),
   * só com os efeitos ligados. Chamado ao ler as preferências e ao ligar os efeitos; montar uma tela de novo não duplica.
   */
  aquecerEfeitos(ids: readonly IdEfeitoSonoro[] = ORDEM_DE_AQUECIMENTO): void {
    if (!this.estado.efeitosAtivos || this.aquecimento) return;
    const faltam = ids.filter((id) => !this.efeitos.has(id));
    const proximo = () => {
      this.aquecimento = null;
      if (!this.estado.efeitosAtivos) return;
      const id = faltam.shift();
      if (!id) return;
      if (!this.efeitos.has(id)) this.criarJogadorDeEfeito(id);
      if (faltam.length) this.aquecimento = setTimeout(proximo, 40);
    };
    proximo();
  }

  private medir(id: IdEfeitoSonoro, pedidoEm: number, playEm: number | null, resultado: MedidaDeEfeito['resultado']): void {
    this.medidas.push({ id, pedidoEm, playEm, resultado });
    if (this.medidas.length > 40) this.medidas.shift();
  }

  async definirEfeitosAtivos(ativos: boolean): Promise<void> {
    const mudouParaLigado = !this.estado.efeitosAtivos && ativos;
    this.estado.definirEfeitosAtivos(ativos);
    this.prefsProntas = true;
    this.desbloqueado = true;
    if (ativos) this.aquecerEfeitos();
    try {
      await SecureStore.setItemAsync(CHAVE_EFEITOS, ativos ? '1' : '0');
    } catch {
      // Sem armazenamento, vale na sessão atual.
    }
    this.notificar();
    if (mudouParaLigado) {
      this.tocarEfeito('salvo');
    }
  }

  definirAreaPermitida(permitida: boolean): void {
    this.estado.definirAreaPermitida(permitida);
    void this.atualizarEstadoFundo(permitida ? 600 : 400);
  }

  async definirPreviewFolha(opcoes: { aberta: boolean; leitorDeTela?: boolean }): Promise<void> {
    this.folhaAberta = opcoes.aberta;
    if (opcoes.leitorDeTela !== undefined) {
      this.leitorDeTela = opcoes.leitorDeTela;
    } else if (opcoes.aberta) {
      this.leitorDeTela = await AccessibilityInfo.isScreenReaderEnabled().catch(() => false);
    }
    if (!opcoes.aberta) this.cancelarPreviewFundo();
    await this.atualizarEstadoFundo(300);
  }

  cancelarPreviewFundo(): void {
    if (this.timerPreview) {
      clearTimeout(this.timerPreview);
      this.timerPreview = null;
    }
  }

  /** No app com leitor de tela ligado, espera 1,5 s antes da prévia para não atropelar o anúncio. */
  definirFundoComAtraso(fundo: IdSomFundo, atrasoMs?: number): void {
    this.cancelarPreviewFundo();
    const espera = atrasoMs ?? (this.leitorDeTela ? 1500 : 0);
    if (espera <= 0) {
      void this.definirFundo(fundo);
      return;
    }
    this.estado.definirFundo(fundo);
    this.prefsProntas = true;
    this.desbloqueado = true;
    void SecureStore.setItemAsync(CHAVE_FUNDO, fundo).catch(() => undefined);
    this.notificar();
    this.timerPreview = setTimeout(() => {
      this.timerPreview = null;
      void this.atualizarEstadoFundo(600);
    }, espera);
  }

  async definirFundo(fundo: IdSomFundo): Promise<void> {
    this.cancelarPreviewFundo();
    this.estado.definirFundo(fundo);
    this.prefsProntas = true;
    this.desbloqueado = true;
    this.erroFundo = null;
    try {
      await SecureStore.setItemAsync(CHAVE_FUNDO, fundo);
    } catch {
      // Sem armazenamento, vale na sessão atual.
    }
    this.garantirAppState();
    await this.atualizarEstadoFundo(fundo === 'mudo' ? 400 : 600);
  }

  async tentarNovamenteFundo(): Promise<void> {
    this.erroFundo = null;
    await this.atualizarEstadoFundo(600);
  }

  entrarEmFala(): void {
    this.estado.entrarEmFala();
    void this.atualizarEstadoFundo(400);
  }

  sairDeFala(): void {
    const deveReaplicar = this.estado.sairDeFala();
    if (deveReaplicar) {
      void this.aplicarModoNormalSePermitido().then(() => this.atualizarEstadoFundo(600));
    } else {
      void this.atualizarEstadoFundo(600);
    }
  }

  entrarEmGravacaoOuVoz(): void {
    this.estado.entrarEmGravacaoOuVoz();
    void this.atualizarEstadoFundo(0);
  }

  sairDeGravacaoOuVoz(): void {
    const deveReaplicar = this.estado.sairDeGravacaoOuVoz();
    if (deveReaplicar) {
      void this.aplicarModoNormalSePermitido().then(() => this.atualizarEstadoFundo(600));
    } else {
      void this.atualizarEstadoFundo(600);
    }
  }

  private limparFundo(): void {
    if (this.timerCruzamento) {
      clearTimeout(this.timerCruzamento);
      this.timerCruzamento = null;
    }
    if (this.timerRampa) {
      clearInterval(this.timerRampa);
      this.timerRampa = null;
    }
    for (const j of [this.jogadorA, this.jogadorB]) {
      if (j) {
        try {
          j.pause();
          j.remove();
        } catch {
          // Já liberado.
        }
      }
    }
    this.jogadorA = null;
    this.jogadorB = null;
    this.fundoAtualId = null;
    this.volumeAtual = 0;
  }

  private volumeAlvo(base: number): number {
    const fatorFala = this.estado.estadoFundo() === 'atenuado' ? 0.2 : 1;
    const fatorLeitor = this.folhaAberta && this.leitorDeTela ? 0.6 : 1;
    return base * fatorFala * fatorLeitor;
  }

  private ramparVolume(jogador: AudioPlayer, de: number, para: number, duracaoMs: number, aoTerminar?: () => void): void {
    if (this.timerRampa) {
      clearInterval(this.timerRampa);
      this.timerRampa = null;
    }
    if (duracaoMs <= 0) {
      try {
        jogador.volume = para;
      } catch {
        // Ignora.
      }
      this.volumeAtual = para;
      aoTerminar?.();
      return;
    }
    const passos = Math.max(2, Math.round(duracaoMs / 40));
    let passo = 0;
    this.timerRampa = setInterval(() => {
      passo += 1;
      const p = passo / passos;
      const v = de + (para - de) * p;
      try {
        jogador.volume = v;
        this.volumeAtual = v;
      } catch {
        if (this.timerRampa) clearInterval(this.timerRampa);
        this.timerRampa = null;
        return;
      }
      if (passo >= passos) {
        if (this.timerRampa) clearInterval(this.timerRampa);
        this.timerRampa = null;
        aoTerminar?.();
      }
    }, 40);
  }

  private agendarProximoCruzamento(id: Exclude<IdSomFundo, 'mudo'>): void {
    if (this.timerCruzamento) clearTimeout(this.timerCruzamento);
    const def = CATALOGO_FUNDOS.find((f) => f.id === id);
    if (!def) return;

    const esperaMs = Math.max(5000, def.duracaoMs - Math.round((def.aparoInicioSeg + def.aparoFimSeg) * 1000) - 180);
    this.timerCruzamento = setTimeout(() => {
      if (this.fundoAtualId !== id || this.estado.estadoFundo() === 'parado') return;
      const atual = this.ativoEhA ? this.jogadorA : this.jogadorB;
      const proximo = this.ativoEhA ? this.jogadorB : this.jogadorA;
      if (!atual || !proximo) return;

      const alvo = this.volumeAlvo(def.volume);
      try {
        // O próximo já está no começo do trecho (posicionado ao ser criado e ao sair do cruzamento anterior): no iPhone,
        // `play()` vale na hora e `seekTo()` chega depois, e o reprodutor parado perto do fim do arquivo terminaria antes.
        proximo.volume = 0;
        this.tocarFundo(proximo, id);
      } catch {
        return;
      }

      let passo = 0;
      const passos = 5;
      const intervalo = setInterval(() => {
        passo += 1;
        const p = passo / passos;
        try {
          proximo.volume = alvo * p;
          atual.volume = alvo * (1 - p);
          this.volumeAtual = alvo;
        } catch {
          clearInterval(intervalo);
          return;
        }
        if (passo >= passos) {
          clearInterval(intervalo);
          try {
            atual.pause();
            // Pronto para a próxima volta: parado no começo do trecho.
            void atual.seekTo(def.aparoInicioSeg).catch(() => undefined);
          } catch {
            // Ignora.
          }
          this.ativoEhA = !this.ativoEhA;
          this.agendarProximoCruzamento(id);
        }
      }, 30);
    }, esperaMs);
  }

  private criarJogadorDeFundo(id: Exclude<IdSomFundo, 'mudo'>): AudioPlayer {
    const jogador = createAudioPlayer(FONTES_FUNDOS[id]);
    if (REGISTRAR_SOM) {
      jogador.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        const esperado = this.fundoEsperandoReproducao.get(jogador);
        if (!status.playing || !esperado) return;
        this.fundoEsperandoReproducao.delete(jogador);
        registrarSom('reproducao', esperado);
      });
    }
    return jogador;
  }

  private tocarFundo(jogador: AudioPlayer, id: Exclude<IdSomFundo, 'mudo'>): void {
    registrarSom('comando', id);
    if (REGISTRAR_SOM) this.fundoEsperandoReproducao.set(jogador, id);
    jogador.play();
  }

  private async atualizarEstadoFundo(rampaMs = 600): Promise<void> {
    const versao = ++this.versaoFundo;
    const estadoDesejado = this.estado.estadoFundo();
    const id = this.estado.fundo;

    if (estadoDesejado === 'parado' || id === 'mudo' || !this.desbloqueado) {
      const ativo = this.ativoEhA ? this.jogadorA : this.jogadorB;
      const pararMs = !this.desbloqueado || this.estado.contGravacaoOuVoz > 0 || this.estado.emSegundoPlano ? 0 : 400;
      if (ativo && pararMs > 0) {
        this.ramparVolume(ativo, this.volumeAtual, 0, pararMs, () => this.limparFundo());
      } else {
        this.limparFundo();
      }
      this.estadoFundo = this.erroFundo && id !== 'mudo' ? 'erro' : 'parado';
      this.notificar();
      return;
    }

    const def = CATALOGO_FUNDOS.find((f) => f.id === id);
    if (!def) {
      this.limparFundo();
      this.estadoFundo = 'parado';
      this.notificar();
      return;
    }

    await this.aplicarModoNormalSePermitido();
    // Enquanto o modo de áudio era aplicado, veio um pedido mais novo (parar, trocar de fundo, ir para o fundo do aparelho):
    // ele decide, e este não cria um segundo par de reprodutores.
    if (versao !== this.versaoFundo) return;
    const alvo = this.volumeAlvo(def.volume);

    if (this.fundoAtualId === id && this.jogadorA && this.jogadorB) {
      const ativo = this.ativoEhA ? this.jogadorA : this.jogadorB;
      this.ramparVolume(ativo, this.volumeAtual, alvo, rampaMs);
      this.estadoFundo = 'tocando';
      this.notificar();
      return;
    }

    this.limparFundo();
    this.estadoFundo = 'carregando';
    this.notificar();

    this.fundoAtualId = id;
    this.ativoEhA = true;
    try {
      this.jogadorA = this.criarJogadorDeFundo(id);
      this.jogadorB = this.criarJogadorDeFundo(id);
      this.jogadorA.volume = 0;
      this.jogadorB.volume = 0;
      // A entra pelo começo do trecho (o volume sobe do zero, então o instante antes do seekTo não se ouve); B já fica lá.
      void this.jogadorA.seekTo(def.aparoInicioSeg).catch(() => undefined);
      void this.jogadorB.seekTo(def.aparoInicioSeg).catch(() => undefined);
      this.tocarFundo(this.jogadorA, id);
      this.ramparVolume(this.jogadorA, 0, alvo, 600);
      this.agendarProximoCruzamento(id);
      this.estadoFundo = 'tocando';
      this.erroFundo = null;
      this.notificar();
    } catch {
      this.limparFundo();
      this.estadoFundo = 'erro';
      this.erroFundo = MENSAGEM_ERRO_FUNDO;
      this.notificar();
    }
  }
}

export const tocaSons = new TocaSonsMobile();
