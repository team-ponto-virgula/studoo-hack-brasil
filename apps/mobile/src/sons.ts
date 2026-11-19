/**
 * Toca-sons do app Mobile (Expo) para o Studoo (alinhado à docs/specs/12-som.md).
 * - Usa `expo-audio` com `playsInSilentMode: false` para respeitar a chave de silêncio do iPhone.
 * - Efeitos em WAV mono 44.1 kHz (0 ms de atraso de codificador).
 * - Fundos em MP3 com dois reprodutores alternados em cruzamento suave (150 ms) para evitar buraco na emenda.
 * - Começa apenas após o primeiro gesto (`registrarGesto()` ou toque em controle), com rampas de 600/300/400 ms.
 * - Posse do modo de áudio delegada a `MaquinaEstadoSom` (`packages/contratos/src/som-estado.ts`):
 *   nunca chama `setAudioModeAsync` durante gravação/voz ao vivo ou fala de lição, e reaplica o modo normal
 *   em `sairDeFala()` e `sairDeGravacaoOuVoz()`.
 * - Preferências persistidas em `SecureStore`.
 */

import { AccessibilityInfo, AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
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

class TocaSonsMobile {
  private estado = new MaquinaEstadoSom();
  private prefsCarregadas = false;
  private desbloqueado = false;
  private ultimoDisparo = new Map<IdEfeitoSonoro, number>();

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

  async carregarPreferencias(): Promise<PreferenciasSom> {
    if (this.prefsCarregadas) return this.obterPreferencias();
    this.prefsCarregadas = true;
    try {
      const [e, f] = await Promise.all([
        SecureStore.getItemAsync(CHAVE_EFEITOS),
        SecureStore.getItemAsync(CHAVE_FUNDO),
      ]);
      this.estado.definirEfeitosAtivos(e === null ? PADRAO_PREFERENCIAS_SOM.efeitosAtivos : e === '1');
      this.estado.definirFundo(
        f && IDS_FUNDOS_VALIDOS.has(f as IdSomFundo) ? (f as IdSomFundo) : PADRAO_PREFERENCIAS_SOM.fundo,
      );
    } catch {
      this.estado.definirEfeitosAtivos(PADRAO_PREFERENCIAS_SOM.efeitosAtivos);
      this.estado.definirFundo(PADRAO_PREFERENCIAS_SOM.fundo);
    }
    this.garantirAppState();
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

  async tocarEfeito(id: IdEfeitoSonoro): Promise<void> {
    await this.carregarPreferencias();
    this.desbloqueado = true;
    if (!this.estado.podeTocarEfeito(id)) return;

    const def = CATALOGO_EFEITOS[id];
    const agora = Date.now();
    const ultimo = this.ultimoDisparo.get(id) ?? 0;
    if (agora - ultimo < def.cooldownMs) return;
    this.ultimoDisparo.set(id, agora);

    await this.aplicarModoNormalSePermitido();

    try {
      const player = createAudioPlayer(FONTES_SFX[id]);
      player.volume = def.volume;
      player.play();
      setTimeout(() => {
        try {
          player.remove();
        } catch {
          // Já liberado.
        }
      }, def.duracaoMs + 600);
    } catch {
      // Falha silenciosa: som nunca bloqueia a interface.
    }
  }

  async definirEfeitosAtivos(ativos: boolean): Promise<void> {
    const mudouParaLigado = !this.estado.efeitosAtivos && ativos;
    this.estado.definirEfeitosAtivos(ativos);
    this.prefsCarregadas = true;
    this.desbloqueado = true;
    try {
      await SecureStore.setItemAsync(CHAVE_EFEITOS, ativos ? '1' : '0');
    } catch {
      // Sem armazenamento, vale na sessão atual.
    }
    this.notificar();
    if (mudouParaLigado) {
      await this.tocarEfeito('salvo');
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
    this.prefsCarregadas = true;
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
    this.prefsCarregadas = true;
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
        void proximo.seekTo(def.aparoInicioSeg);
        proximo.volume = 0;
        proximo.play();
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
          } catch {
            // Ignora.
          }
          this.ativoEhA = !this.ativoEhA;
          this.agendarProximoCruzamento(id);
        }
      }, 30);
    }, esperaMs);
  }

  private async atualizarEstadoFundo(rampaMs = 600): Promise<void> {
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
      this.jogadorA = createAudioPlayer(FONTES_FUNDOS[id]);
      this.jogadorB = createAudioPlayer(FONTES_FUNDOS[id]);
      this.jogadorA.volume = 0;
      void this.jogadorA.seekTo(def.aparoInicioSeg);
      this.jogadorA.play();
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
