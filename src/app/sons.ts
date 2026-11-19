/**
 * Toca-sons da Web para o Studoo.
 * - Usa Web Audio API (`AudioContext` + `AudioBuffer`) para zero latência nos efeitos (WAV)
 *   e laço sem buraco nos fundos (MP3 decodificado em memória com `loopStart` e `loopEnd` aparados).
 * - Respeita autoplay do navegador (desbloqueia no primeiro gesto do usuário).
 * - Convivência: abaixa o fundo em fala/áudio de lição (ducking) e pausa em gravação, voz ao vivo ou aba oculta.
 * - Preferências persistidas em `localStorage`.
 */

import {
  CATALOGO_EFEITOS,
  CATALOGO_FUNDOS,
  PADRAO_PREFERENCIAS_SOM,
  type IdEfeitoSonoro,
  type IdSomFundo,
  type PreferenciasSom,
} from '../../packages/contratos/src/catalogo-sons';

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

class TocaSonsWeb {
  private ctx: AudioContext | null = null;
  private cacheBuffers = new Map<string, AudioBuffer>();
  private carregando = new Map<string, Promise<AudioBuffer | null>>();
  private ultimoDisparo = new Map<IdEfeitoSonoro, number>();

  private fonteFundo: AudioBufferSourceNode | null = null;
  private ganhoFundo: GainNode | null = null;
  private fundoCarregandoId: IdSomFundo | null = null;

  private prefs: PreferenciasSom = { ...PADRAO_PREFERENCIAS_SOM };
  private prefsCarregadas = false;
  private gestosRegistrados = false;
  private desbloqueado = false;

  private contFala = 0;
  private contGravacaoOuVoz = 0;
  private abaOculta = false;

  private lerPreferencias(): PreferenciasSom {
    if (this.prefsCarregadas || typeof window === 'undefined') return this.prefs;
    this.prefsCarregadas = true;
    try {
      const e = window.localStorage.getItem(CHAVE_EFEITOS);
      const f = window.localStorage.getItem(CHAVE_FUNDO) as IdSomFundo | null;
      this.prefs = {
        efeitosAtivos: e === null ? PADRAO_PREFERENCIAS_SOM.efeitosAtivos : e === '1',
        fundo: f && IDS_FUNDOS_VALIDOS.has(f) ? f : PADRAO_PREFERENCIAS_SOM.fundo,
      };
    } catch {
      this.prefs = { ...PADRAO_PREFERENCIAS_SOM };
    }
    return this.prefs;
  }

  obterPreferencias(): PreferenciasSom {
    return { ...this.lerPreferencias() };
  }

  private garantirContexto(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.ganhoFundo = this.ctx.createGain();
      this.ganhoFundo.gain.value = 0;
      this.ganhoFundo.connect(this.ctx.destination);
    }
    if (!this.gestosRegistrados) {
      this.gestosRegistrados = true;
      const desbloquear = () => {
        this.desbloqueado = true;
        if (this.ctx && this.ctx.state === 'suspended') {
          void this.ctx.resume().then(() => this.atualizarEstadoFundo());
        } else {
          void this.atualizarEstadoFundo();
        }
      };
      window.addEventListener('pointerdown', desbloquear, { passive: true });
      window.addEventListener('keydown', desbloquear, { passive: true });
      document.addEventListener('visibilitychange', () => {
        this.abaOculta = document.visibilityState !== 'visible';
        void this.atualizarEstadoFundo();
      });
    }
    return this.ctx;
  }

  private async carregarBuffer(url: string): Promise<AudioBuffer | null> {
    const emCache = this.cacheBuffers.get(url);
    if (emCache) return emCache;
    const pendente = this.carregando.get(url);
    if (pendente) return pendente;

    const ctx = this.garantirContexto();
    if (!ctx) return null;

    const promessa = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((arr) => (arr ? ctx.decodeAudioData(arr) : null))
      .then((buf) => {
        if (buf) this.cacheBuffers.set(url, buf);
        this.carregando.delete(url);
        return buf;
      })
      .catch(() => {
        this.carregando.delete(url);
        return null;
      });

    this.carregando.set(url, promessa);
    return promessa;
  }

  /** Toca um efeito sonoro pelo ID do catálogo (respeita preferência, cooldown e prioridade). */
  async tocarEfeito(id: IdEfeitoSonoro): Promise<void> {
    const prefs = this.lerPreferencias();
    if (!prefs.efeitosAtivos) return;
    if (this.contGravacaoOuVoz > 0 && id !== 'gravacao_fim') return;

    const def = CATALOGO_EFEITOS[id];
    const agora = Date.now();
    const ultimo = this.ultimoDisparo.get(id) ?? 0;
    if (agora - ultimo < def.cooldownMs) return;
    this.ultimoDisparo.set(id, agora);

    const ctx = this.garantirContexto();
    if (!ctx) return;
    this.desbloqueado = true;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    const buf = await this.carregarBuffer(`/sons/sfx/${def.arquivo}`);
    if (!buf) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = def.volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  }

  async definirEfeitosAtivos(ativos: boolean): Promise<void> {
    this.lerPreferencias();
    this.prefs.efeitosAtivos = ativos;
    try {
      window.localStorage.setItem(CHAVE_EFEITOS, ativos ? '1' : '0');
    } catch {
      // Ignora erro de armazenamento privado.
    }
  }

  async definirFundo(fundo: IdSomFundo): Promise<void> {
    this.lerPreferencias();
    this.prefs.fundo = fundo;
    try {
      window.localStorage.setItem(CHAVE_FUNDO, fundo);
    } catch {
      // Ignora erro de armazenamento privado.
    }
    this.desbloqueado = true;
    await this.atualizarEstadoFundo();
  }

  /** Chamar ao iniciar leitura (speechSynthesis) ou áudio de lição (acorde/batida). */
  entrarEmFala(): void {
    this.contFala += 1;
    void this.atualizarEstadoFundo();
  }

  sairDeFala(): void {
    this.contFala = Math.max(0, this.contFala - 1);
    void this.atualizarEstadoFundo();
  }

  /** Chamar ao iniciar gravação de voz ou conversa ao vivo (pausa o fundo imediatamente). */
  entrarEmGravacaoOuVoz(): void {
    this.contGravacaoOuVoz += 1;
    void this.atualizarEstadoFundo();
  }

  sairDeGravacaoOuVoz(): void {
    this.contGravacaoOuVoz = Math.max(0, this.contGravacaoOuVoz - 1);
    void this.atualizarEstadoFundo();
  }

  private pararFonteFundo(): void {
    if (this.fonteFundo) {
      try {
        this.fonteFundo.stop();
        this.fonteFundo.disconnect();
      } catch {
        // Já parado.
      }
      this.fonteFundo = null;
    }
    this.fundoCarregandoId = null;
  }

  private async atualizarEstadoFundo(): Promise<void> {
    const prefs = this.lerPreferencias();
    const deveTocar =
      prefs.fundo !== 'mudo' &&
      this.desbloqueado &&
      !this.abaOculta &&
      this.contGravacaoOuVoz === 0;

    if (!deveTocar) {
      this.pararFonteFundo();
      return;
    }

    const def = CATALOGO_FUNDOS.find((f) => f.id === prefs.fundo);
    if (!def) {
      this.pararFonteFundo();
      return;
    }

    const ctx = this.garantirContexto();
    if (!ctx || !this.ganhoFundo) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }

    const alvoGanho = this.contFala > 0 ? def.volume * 0.2 : def.volume;
    const agora = ctx.currentTime;
    this.ganhoFundo.gain.cancelScheduledValues(agora);
    this.ganhoFundo.gain.setTargetAtTime(alvoGanho, agora, 0.12);

    if (this.fonteFundo && this.fundoCarregandoId === def.id) {
      return;
    }

    this.pararFonteFundo();
    this.fundoCarregandoId = def.id;

    const buf = await this.carregarBuffer(`/sons/fundos/${def.arquivo}`);
    if (!buf || this.fundoCarregandoId !== def.id) return;
    if (this.abaOculta || this.contGravacaoOuVoz > 0 || this.prefs.fundo !== def.id) return;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    // Apara o preenchimento do codificador MP3 para laço sem buraco.
    const inicio = Math.min(def.aparoInicioSeg, Math.max(0, buf.duration - 1));
    const fim = Math.max(inicio + 1, buf.duration - def.aparoFimSeg);
    src.loopStart = inicio;
    src.loopEnd = fim;
    src.connect(this.ganhoFundo);
    src.start(0, inicio);
    this.fonteFundo = src;
  }
}

export const tocaSons = new TocaSonsWeb();
