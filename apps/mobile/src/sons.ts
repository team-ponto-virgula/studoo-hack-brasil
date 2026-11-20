/**
 * Toca-sons do app Mobile (Expo) para o Studoo (alinhado à docs/specs/12-som.md).
 * - Usa `expo-audio` com `playsInSilentMode: false` para respeitar a chave de silêncio do iPhone.
 * - Efeitos em WAV mono 44.1 kHz (0 ms de atraso de codificador; o sinal passa de −20 dBFS nos primeiros 3 ms).
 * - Efeitos sem espera no toque: um reprodutor por efeito, criado uma vez (logo que as preferências chegam), carregado de
 *   um arquivo local e rebobinado ao terminar. O toque só chama `play()`, na mesma volta do evento, sem `await`, sem
 *   trocar o modo de áudio e sem criar reprodutor. Um efeito que não consegue tocar em até 120 ms do pedido (arquivo
 *   ainda carregando, preferências ainda chegando) fica calado: um som atrasado engana mais que nenhum.
 * - Uma música só (decisão do dono, 19/11): o Lo-fi de Estudo (`lofi_estudo`, o arquivo de d5bf5aa), em laço no app inteiro,
 *   ligada por padrão; "Mudo" escolhido continua em silêncio e os climas antigos viram o Lo-fi (`fundoUnicoDaPreferencia`).
 *   Os efeitos tocam por cima, sem parar, reiniciar nem baixar a música; a fala do Studoo baixa a 20% e a gravação e a voz
 *   ao vivo pausam. Pausar (gravação, voz, segundo plano) guarda a posição: a música volta do mesmo ponto, nunca do começo.
 * - Dois reprodutores alternados em cruzamento suave (150 ms) para não haver buraco na emenda do laço; o próximo já fica
 *   posicionado no começo do trecho (no iPhone, `play()` é imediato e `seekTo()` chega depois), e o cruzamento é agendado
 *   pela posição real do reprodutor, não por um relógio desde o começo. No iPhone o `play()` leva alguns centésimos para
 *   soar: o próximo começa 480 ms antes do fim (180 nos outros) e o volume só sobe quando ele diz que está tocando, para o
 *   cruzamento acontecer de verdade, sem respiro na volta do laço (conferência nativa 44809026116).
 * - Começa no primeiro gesto em qualquer tela, já na entrada (login ou visitante), com rampas de 600/300/400 ms.
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
  fundoUnicoDaPreferencia,
  type EstadoReproducaoFundo,
  type EstadoSomSnapshot,
  type IdEfeitoSonoro,
  type IdSomFundo,
  type PreferenciasSom,
} from '../../../packages/contratos/src/catalogo-sons';
import { MaquinaEstadoSom } from '../../../packages/contratos/src/som-estado';

const CHAVE_EFEITOS = 'studoo.sons.efeitos';
const CHAVE_FUNDO = 'studoo.sons.fundo';


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

/** A única música do app: o Lo-fi de Estudo (os outros quatro climas saíram do pacote do app). */
type IdMusica = 'lofi_estudo';
const ID_DA_MUSICA: IdMusica = 'lofi_estudo';
const FONTES_FUNDOS: Record<IdMusica, AudioSource> = {
  lofi_estudo: require('../assets/sons/fundos/lofi-estudo.mp3'),
};

type OuvinteEstado = (estado: EstadoSomSnapshot) => void;

/** Até quanto depois do pedido um efeito ainda toca (arquivo carregando, preferências chegando); depois, calado. */
export const ATRASO_MAXIMO_EFEITO_MS = 120;
/** A música que não toca em 8 s (ou falha) mostra o erro na folha; a chave continua ligada (spec 12). */
export const ESPERA_MAXIMA_DO_FUNDO_MS = 8000;

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

/** Quanto antes do fim do trecho o próximo reprodutor do laço começa: no iPhone o play() demora alguns centésimos para soar. */
const ANTECEDENCIA_DO_CRUZAMENTO_MS = Platform.OS === 'ios' ? 480 : 180;
/** Quanto o cruzamento espera o próximo reprodutor dizer que está tocando antes de subir o volume mesmo assim. */
const ESPERA_MAXIMA_PARA_SOAR_MS = 400;

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
  private fundoAtualId: IdMusica | null = null;
  /** A música está pausada pelo momento (gravação, voz, segundo plano), com os reprodutores guardados na posição. */
  private fundoPausado = false;
  private esperaDoFundo: ReturnType<typeof setTimeout> | null = null;
  private nomeDoJogador = new WeakMap<AudioPlayer, 'A' | 'B'>();
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
      // Uma música só: "mudo" escolhido continua; qualquer outro valor (os climas antigos) e a instalação nova, o Lo-fi.
      fundo = fundoUnicoDaPreferencia(f);
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
      if (REGISTRAR_SOM) {
        // A posição do fundo logo depois do efeito: ele toca por cima, e a música segue (fora do caminho do toque).
        setTimeout(() => this.registrarFundo(), 0);
        setTimeout(() => this.registrarFundo(), 200);
      }
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
   * Aquece os efeitos: cria o reprodutor de cada um, só com os efeitos ligados. Sem lista (ao ler as preferências e ao ligar
   * os efeitos), todos, aos poucos (um a cada 40 ms, para não disputar com a tela que abre); com lista (a tela que vai
   * precisar deles, como a geração com `geracao_pronta`), esses na hora. Montar uma tela de novo não duplica.
   */
  aquecerEfeitos(ids?: readonly IdEfeitoSonoro[]): void {
    if (!this.prefsProntas) {
      void this.carregarPreferencias().then(() => this.aquecerEfeitos(ids));
      return;
    }
    if (!this.estado.efeitosAtivos) return;
    if (ids) {
      for (const id of ids) if (!this.efeitos.has(id)) this.criarJogadorDeEfeito(id);
      return;
    }
    if (this.aquecimento) return;
    const faltam = ORDEM_DE_AQUECIMENTO.filter((id) => !this.efeitos.has(id));
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

  /** A chave "Música de fundo": ligada é o Lo-fi de Estudo; desligada, o silêncio escolhido ("mudo"). */
  definirMusicaLigada(ligada: boolean): Promise<void> {
    return this.definirFundo(ligada ? ID_DA_MUSICA : 'mudo');
  }

  async definirFundo(escolha: IdSomFundo): Promise<void> {
    const fundo = fundoUnicoDaPreferencia(escolha);
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

  private jogadorAtivo(): AudioPlayer | null {
    return this.ativoEhA ? this.jogadorA : this.jogadorB;
  }

  private pararCruzamento(): void {
    if (this.timerCruzamento) {
      clearTimeout(this.timerCruzamento);
      this.timerCruzamento = null;
    }
  }

  /** Solta os dois reprodutores (a pessoa desligou a música): a próxima vez começa do compasso 1. */
  private limparFundo(): void {
    this.pararCruzamento();
    this.pararEsperaDoFundo();
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
    this.fundoPausado = false;
    this.volumeAtual = 0;
  }

  /** Pausa onde está (gravação, voz ao vivo, segundo plano): os reprodutores ficam, e a música volta do mesmo ponto. */
  private pausarFundo(): void {
    this.pararCruzamento();
    if (this.timerRampa) {
      clearInterval(this.timerRampa);
      this.timerRampa = null;
    }
    const ativo = this.jogadorAtivo();
    try {
      ativo?.pause();
    } catch {
      // Ignora.
    }
    this.fundoPausado = true;
    this.volumeAtual = 0;
    this.registrarFundo();
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

  /** Quanto falta para o fim do trecho do laço, pela posição real do reprodutor ativo. */
  private faltaParaOFim(def: { duracaoMs: number; aparoInicioSeg: number; aparoFimSeg: number }): number {
    let posicao = def.aparoInicioSeg;
    try {
      const atual = this.jogadorAtivo()?.currentTime;
      if (typeof atual === 'number' && Number.isFinite(atual)) posicao = Math.max(def.aparoInicioSeg, atual);
    } catch {
      // Sem a posição: conta do começo do trecho.
    }
    return Math.round((def.duracaoMs / 1000 - def.aparoFimSeg - posicao) * 1000);
  }

  /** O próximo cruzamento, ANTECEDENCIA_DO_CRUZAMENTO_MS antes do fim do trecho, pela posição real (vale também ao retomar do meio). */
  private agendarProximoCruzamento(id: IdMusica): void {
    this.pararCruzamento();
    const def = CATALOGO_FUNDOS.find((f) => f.id === id);
    if (!def) return;
    const esperaMs = Math.max(0, this.faltaParaOFim(def) - ANTECEDENCIA_DO_CRUZAMENTO_MS);
    this.timerCruzamento = setTimeout(() => this.cruzar(id), esperaMs);
  }

  private cruzar(id: IdMusica): void {
    this.timerCruzamento = null;
    const def = CATALOGO_FUNDOS.find((f) => f.id === id);
    if (!def || this.fundoAtualId !== id || this.fundoPausado || this.estado.estadoFundo() === 'parado') return;
    // O relógio do JS pode adiantar: se ainda falta bastante (o reprodutor atrasou), espera mais um pouco.
    if (this.faltaParaOFim(def) > ANTECEDENCIA_DO_CRUZAMENTO_MS + 220) {
      this.agendarProximoCruzamento(id);
      return;
    }
    const atual = this.jogadorAtivo();
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

    // O volume só sobe quando o próximo já soa (no iPhone o play() demora alguns centésimos); até lá, o atual segue cheio.
    const inicioDaEspera = Date.now();
    const esperarSoar = () => {
      if (this.fundoAtualId !== id || this.fundoPausado) return;
      let soando = false;
      try { soando = proximo.playing; } catch { soando = true; }
      if (!soando && Date.now() - inicioDaEspera < ESPERA_MAXIMA_PARA_SOAR_MS) { this.timerCruzamento = setTimeout(esperarSoar, 15); return; }
      this.timerCruzamento = null;
      this.rampaDoCruzamento(id, def, atual, proximo, alvo);
    };
    esperarSoar();
  }

  /** A rampa de 150 ms (5 passos de 30): o próximo sobe, o atual desce e, no fim, para e volta ao começo do trecho. */
  private rampaDoCruzamento(id: IdMusica, def: (typeof CATALOGO_FUNDOS)[number], atual: AudioPlayer, proximo: AudioPlayer, alvo: number): void {
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
  }

  private criarJogadorDeFundo(id: IdMusica, nome: 'A' | 'B'): AudioPlayer {
    const jogador = createAudioPlayer(FONTES_FUNDOS[id]);
    this.nomeDoJogador.set(jogador, nome);
    jogador.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      // "Carregando…" até o som chegar de verdade (a primeira vez baixa o arquivo); então "Tocando".
      if (status.playing && this.estadoFundo === 'carregando' && jogador === this.jogadorAtivo()) {
        this.pararEsperaDoFundo();
        this.estadoFundo = 'tocando';
        this.notificar();
      }
      if (!REGISTRAR_SOM) return;
      this.registrarFundo(jogador, status);
      const esperado = this.fundoEsperandoReproducao.get(jogador);
      if (!status.playing || !esperado) return;
      this.fundoEsperandoReproducao.delete(jogador);
      registrarSom('reproducao', esperado);
    });
    return jogador;
  }

  private pararEsperaDoFundo(): void {
    if (this.esperaDoFundo) {
      clearTimeout(this.esperaDoFundo);
      this.esperaDoFundo = null;
    }
  }

  private tocarFundo(jogador: AudioPlayer, id: IdMusica): void {
    registrarSom('comando', id);
    if (REGISTRAR_SOM) this.fundoEsperandoReproducao.set(jogador, id);
    jogador.play();
  }

  /**
   * O marcador do fundo para a conferência nativa (Mobile 2), só com `EXPO_PUBLIC_STUDOO_REGISTRO_SOM=1`:
   * "[som] fundo <id> <A|B> <tocando|parado> <pos_ms>/<dur_ms> <volume> <Date.now()>", a cada aviso do reprodutor (no play,
   * no pause e a cada 500 ms tocando) e 0 e 200 ms depois de cada efeito, para mostrar que a música não para nem recomeça.
   */
  private registrarFundo(jogador: AudioPlayer | null = this.jogadorAtivo(), status?: Partial<AudioStatus>): void {
    if (!REGISTRAR_SOM || !jogador || !this.fundoAtualId) return;
    try {
      const tocando = status?.playing ?? jogador.playing;
      const posicao = status?.currentTime ?? jogador.currentTime;
      const duracao = status?.duration ?? jogador.duration;
      console.info(`[som] fundo ${this.fundoAtualId} ${this.nomeDoJogador.get(jogador) ?? '?'} ${tocando ? 'tocando' : 'parado'} `
        + `${Math.round((posicao || 0) * 1000)}/${Math.round((duracao || 0) * 1000)} ${Number(jogador.volume ?? 0).toFixed(3)} ${Date.now()}`);
    } catch {
      // O registro nunca atrapalha o som.
    }
  }

  private async atualizarEstadoFundo(rampaMs = 600): Promise<void> {
    const versao = ++this.versaoFundo;
    const estadoDesejado = this.estado.estadoFundo();
    const ligada = this.estado.fundo !== 'mudo';

    // Desligada pela pessoa (ou antes do primeiro gesto): desce em 400 ms e solta os reprodutores.
    if (!ligada || !this.desbloqueado) {
      const ativo = this.jogadorAtivo();
      if (ativo && this.desbloqueado && !this.fundoPausado) {
        this.ramparVolume(ativo, this.volumeAtual, 0, 400, () => this.limparFundo());
      } else {
        this.limparFundo();
      }
      this.estadoFundo = this.erroFundo && ligada ? 'erro' : 'parado';
      this.notificar();
      return;
    }

    // Ligada, mas o momento pede silêncio (gravação, voz ao vivo, segundo plano): pausa onde está, para voltar do mesmo ponto.
    if (estadoDesejado === 'parado') {
      if (this.jogadorA && this.jogadorB && !this.fundoPausado) this.pausarFundo();
      this.estadoFundo = 'parado';
      this.notificar();
      return;
    }

    const def = CATALOGO_FUNDOS.find((f) => f.id === ID_DA_MUSICA);
    if (!def) {
      this.limparFundo();
      this.estadoFundo = 'parado';
      this.notificar();
      return;
    }

    await this.aplicarModoNormalSePermitido();
    // Enquanto o modo de áudio era aplicado, veio um pedido mais novo (parar, desligar, ir para o fundo do aparelho): ele
    // decide, e este não cria um segundo par de reprodutores.
    if (versao !== this.versaoFundo) return;
    const alvo = this.volumeAlvo(def.volume);

    if (this.fundoAtualId === ID_DA_MUSICA && this.jogadorA && this.jogadorB) {
      const ativo = this.jogadorA && this.ativoEhA ? this.jogadorA : this.jogadorB;
      if (this.fundoPausado) {
        // Volta do ponto em que parou, subindo do zero em 600 ms; o cruzamento é reagendado pela posição.
        this.fundoPausado = false;
        try {
          ativo.volume = 0;
          this.tocarFundo(ativo, ID_DA_MUSICA);
        } catch {
          // Segue para o erro abaixo, se o reprodutor sumiu.
        }
        this.ramparVolume(ativo, 0, alvo, 600);
        this.agendarProximoCruzamento(ID_DA_MUSICA);
      } else {
        // Só o volume muda (a fala, a folha com o leitor de tela): nunca recomeça.
        this.ramparVolume(ativo, this.volumeAtual, alvo, rampaMs);
      }
      this.estadoFundo = 'tocando';
      this.notificar();
      return;
    }

    this.limparFundo();
    this.estadoFundo = 'carregando';
    this.notificar();

    this.fundoAtualId = ID_DA_MUSICA;
    this.ativoEhA = true;
    try {
      this.jogadorA = this.criarJogadorDeFundo(ID_DA_MUSICA, 'A');
      this.jogadorB = this.criarJogadorDeFundo(ID_DA_MUSICA, 'B');
      this.jogadorA.volume = 0;
      this.jogadorB.volume = 0;
      // A entra pelo começo do trecho (o volume sobe do zero, então o instante antes do seekTo não se ouve); B já fica lá.
      void this.jogadorA.seekTo(def.aparoInicioSeg).catch(() => undefined);
      void this.jogadorB.seekTo(def.aparoInicioSeg).catch(() => undefined);
      this.tocarFundo(this.jogadorA, ID_DA_MUSICA);
      this.ramparVolume(this.jogadorA, 0, alvo, 600);
      this.agendarProximoCruzamento(ID_DA_MUSICA);
      // Fica "Carregando…" até o reprodutor avisar que tocou; sem som em 8 s, o erro da folha (spec 12).
      this.erroFundo = null;
      this.pararEsperaDoFundo();
      this.esperaDoFundo = setTimeout(() => {
        this.esperaDoFundo = null;
        if (this.estadoFundo !== 'carregando') return;
        this.limparFundo();
        this.erroFundo = MENSAGEM_ERRO_FUNDO;
        this.estadoFundo = 'erro';
        this.notificar();
      }, ESPERA_MAXIMA_DO_FUNDO_MS);
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
