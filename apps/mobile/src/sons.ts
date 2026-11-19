/**
 * Toca-sons do app Mobile (Expo) para o Studoo.
 * - Usa `expo-audio` com `playsInSilentMode: false` para respeitar a chave de silêncio do aparelho nos efeitos/fundo.
 * - Efeitos em WAV mono (0 ms de atraso de codificador).
 * - Fundos em MP3 com dois reprodutores alternados em cruzamento suave (150 ms) para evitar buraco na emenda.
 * - Convivência: abaixa o fundo em fala/áudio de lição (ducking) e pausa em gravação, voz ao vivo ou segundo plano (`AppState`).
 * - Preferências persistidas em `SecureStore`.
 */

import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import {
  CATALOGO_EFEITOS,
  CATALOGO_FUNDOS,
  PADRAO_PREFERENCIAS_SOM,
  type IdEfeitoSonoro,
  type IdSomFundo,
  type PreferenciasSom,
} from '../../../packages/contratos/src/catalogo-sons';

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

class TocaSonsMobile {
  private prefs: PreferenciasSom = { ...PADRAO_PREFERENCIAS_SOM };
  private prefsCarregadas = false;
  private ultimoDisparo = new Map<IdEfeitoSonoro, number>();

  private modoConfigurado = false;
  private appEmSegundoPlano = false;
  private listenerAppState: { remove: () => void } | null = null;

  private contFala = 0;
  private contGravacaoOuVoz = 0;

  private fundoAtualId: Exclude<IdSomFundo, 'mudo'> | null = null;
  private jogadorA: AudioPlayer | null = null;
  private jogadorB: AudioPlayer | null = null;
  private ativoEhA = true;
  private timerCruzamento: ReturnType<typeof setTimeout> | null = null;

  async carregarPreferencias(): Promise<PreferenciasSom> {
    if (this.prefsCarregadas) return { ...this.prefs };
    this.prefsCarregadas = true;
    try {
      const [e, f] = await Promise.all([
        SecureStore.getItemAsync(CHAVE_EFEITOS),
        SecureStore.getItemAsync(CHAVE_FUNDO),
      ]);
      this.prefs = {
        efeitosAtivos: e === null ? PADRAO_PREFERENCIAS_SOM.efeitosAtivos : e === '1',
        fundo: f && IDS_FUNDOS_VALIDOS.has(f as IdSomFundo) ? (f as IdSomFundo) : PADRAO_PREFERENCIAS_SOM.fundo,
      };
    } catch {
      this.prefs = { ...PADRAO_PREFERENCIAS_SOM };
    }
    this.garantirAppState();
    return { ...this.prefs };
  }

  obterPreferencias(): PreferenciasSom {
    return { ...this.prefs };
  }

  private garantirAppState(): void {
    if (this.listenerAppState || Platform.OS === 'web') return;
    this.listenerAppState = AppState.addEventListener('change', (estado) => {
      this.appEmSegundoPlano = estado !== 'active';
      void this.atualizarEstadoFundo();
    });
  }

  private async garantirModoAudio(): Promise<void> {
    if (this.modoConfigurado || Platform.OS === 'web') return;
    this.modoConfigurado = true;
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'duckOthers',
    }).catch(() => undefined);
  }

  async tocarEfeito(id: IdEfeitoSonoro): Promise<void> {
    await this.carregarPreferencias();
    if (!this.prefs.efeitosAtivos) return;
    if (this.contGravacaoOuVoz > 0 && id !== 'gravacao_fim') return;

    const def = CATALOGO_EFEITOS[id];
    const agora = Date.now();
    const ultimo = this.ultimoDisparo.get(id) ?? 0;
    if (agora - ultimo < def.cooldownMs) return;
    this.ultimoDisparo.set(id, agora);

    await this.garantirModoAudio();
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
    this.prefs.efeitosAtivos = ativos;
    this.prefsCarregadas = true;
    try {
      await SecureStore.setItemAsync(CHAVE_EFEITOS, ativos ? '1' : '0');
    } catch {
      // Sem armazenamento, vale na sessão atual.
    }
  }

  async definirFundo(fundo: IdSomFundo): Promise<void> {
    this.prefs.fundo = fundo;
    this.prefsCarregadas = true;
    try {
      await SecureStore.setItemAsync(CHAVE_FUNDO, fundo);
    } catch {
      // Sem armazenamento, vale na sessão atual.
    }
    this.garantirAppState();
    await this.atualizarEstadoFundo();
  }

  entrarEmFala(): void {
    this.contFala += 1;
    void this.atualizarEstadoFundo();
  }

  sairDeFala(): void {
    this.contFala = Math.max(0, this.contFala - 1);
    void this.atualizarEstadoFundo();
  }

  entrarEmGravacaoOuVoz(): void {
    this.contGravacaoOuVoz += 1;
    void this.atualizarEstadoFundo();
  }

  sairDeGravacaoOuVoz(): void {
    this.contGravacaoOuVoz = Math.max(0, this.contGravacaoOuVoz - 1);
    void this.atualizarEstadoFundo();
  }

  private limparFundo(): void {
    if (this.timerCruzamento) {
      clearTimeout(this.timerCruzamento);
      this.timerCruzamento = null;
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
  }

  private volumeAlvo(base: number): number {
    return this.contFala > 0 ? base * 0.2 : base;
  }

  private agendarProximoCruzamento(id: Exclude<IdSomFundo, 'mudo'>): void {
    if (this.timerCruzamento) clearTimeout(this.timerCruzamento);
    const def = CATALOGO_FUNDOS.find((f) => f.id === id);
    if (!def) return;

    // Dispara 180 ms antes do fim aparado para cruzar os dois tocadores sem buraco de MP3.
    const esperaMs = Math.max(5000, def.duracaoMs - Math.round((def.aparoInicioSeg + def.aparoFimSeg) * 1000) - 180);
    this.timerCruzamento = setTimeout(() => {
      if (this.fundoAtualId !== id || this.appEmSegundoPlano || this.contGravacaoOuVoz > 0) return;
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

      // Cruzamento de 150 ms em 5 passos
      let passo = 0;
      const passos = 5;
      const intervalo = setInterval(() => {
        passo += 1;
        const p = passo / passos;
        try {
          proximo.volume = alvo * p;
          atual.volume = alvo * (1 - p);
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

  private async atualizarEstadoFundo(): Promise<void> {
    const deveTocar =
      this.prefs.fundo !== 'mudo' &&
      !this.appEmSegundoPlano &&
      this.contGravacaoOuVoz === 0;

    if (!deveTocar || this.prefs.fundo === 'mudo') {
      this.limparFundo();
      return;
    }

    const id = this.prefs.fundo;
    const def = CATALOGO_FUNDOS.find((f) => f.id === id);
    if (!def) {
      this.limparFundo();
      return;
    }

    await this.garantirModoAudio();
    const alvo = this.volumeAlvo(def.volume);

    if (this.fundoAtualId === id && this.jogadorA && this.jogadorB) {
      const ativo = this.ativoEhA ? this.jogadorA : this.jogadorB;
      try {
        ativo.volume = alvo;
      } catch {
        // Ignora.
      }
      return;
    }

    this.limparFundo();
    this.fundoAtualId = id;
    this.ativoEhA = true;
    try {
      this.jogadorA = createAudioPlayer(FONTES_FUNDOS[id]);
      this.jogadorB = createAudioPlayer(FONTES_FUNDOS[id]);
      this.jogadorA.volume = alvo;
      void this.jogadorA.seekTo(def.aparoInicioSeg);
      this.jogadorA.play();
      this.agendarProximoCruzamento(id);
    } catch {
      this.limparFundo();
    }
  }
}

export const tocaSons = new TocaSonsMobile();
