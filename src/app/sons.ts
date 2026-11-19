/**
 * Toca-sons da Web para o Studoo (alinhado à docs/specs/12-som.md).
 * - Usa Web Audio API (`AudioContext` + `AudioBuffer`) para preparar os efeitos (WAV)
 *   e laço sem buraco nos fundos (MP3 decodificado em memória com `loopStart` e `loopEnd` aparados).
 * - Só desbloqueia no primeiro gesto do usuário (sem enfileirar sons disparados antes do gesto).
 * - Pré-carrega `erro_rede` e `aviso` no primeiro gesto para tocarem mesmo offline.
 * - Rampas de volume: entrada em 600 ms, troca 300 ms / 600 ms, Mudo em 400 ms, fala 20% em 400 ms / volta em 600 ms.
 * - Expõe estados (`parado`, `carregando`, `tocando`, `erro`) com timeout de 8 s para a folha "Som".
 */

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
} from '../../packages/contratos/src/catalogo-sons';
import { MaquinaEstadoSom } from '../../packages/contratos/src/som-estado';

const CHAVE_EFEITOS = 'studoo.sons.efeitos';
// Pré-carga, cache decodificado e reprodução compartilham a revisão publicada dos arquivos.
const REVISAO_DOS_SONS = '24498ec';
const arquivoSonoro = (pasta: 'sfx' | 'fundos', nome: string) => `/sons/${pasta}/${nome}?v=${REVISAO_DOS_SONS}`;

const CHAVE_FUNDO = 'studoo.sons.fundo';
const TIMEOUT_CARREGAMENTO_MS = 8000;
// Um arquivo frio continua no cache para o próximo gesto. Depois desse limite o gesto já passou.
const VALIDADE_EFEITO_MS = 80;

const IDS_FUNDOS_VALIDOS = new Set<IdSomFundo>([
  'mudo',
  'foco_calmo',
  'chuva_suave',
  'lofi_estudo',
  'biblioteca',
  'brisa_natural',
]);

type OuvinteEstado = (estado: EstadoSomSnapshot) => void;

class TocaSonsWeb {
  private estado = new MaquinaEstadoSom();
  private ctx: AudioContext | null = null;
  private cacheBuffers = new Map<string, AudioBuffer>();
  private carregando = new Map<string, Promise<AudioBuffer | null>>();
  private ultimoDisparo = new Map<IdEfeitoSonoro, number>();
  private versaoEfeitos = 0;
  private efeitosDaTela = new Set<IdEfeitoSonoro>();
  private efeitosTocando = new Map<AudioBufferSourceNode, IdEfeitoSonoro>();

  private fonteFundo: AudioBufferSourceNode | null = null;
  private ganhoFundo: GainNode | null = null;
  private fundoTocandoId: IdSomFundo | null = null;
  private timerParada: ReturnType<typeof setTimeout> | null = null;
  private timerPreview: ReturnType<typeof setTimeout> | null = null;
  private sequenciaFundo = 0;

  private prefsCarregadas = false;
  private gestosRegistrados = false;
  private desbloqueado = false;
  private preCarregouEssenciais = false;

  private estadoFundo: EstadoReproducaoFundo = 'parado';
  private erroFundo: string | null = null;
  private ouvintes = new Set<OuvinteEstado>();

  private folhaAberta = false;
  private leitorDeTela = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.registrarGestos();
    }
  }

  private lerPreferencias(): PreferenciasSom {
    if (this.prefsCarregadas || typeof window === 'undefined') return this.obterPreferencias();
    this.prefsCarregadas = true;
    try {
      const e = window.localStorage.getItem(CHAVE_EFEITOS);
      const f = window.localStorage.getItem(CHAVE_FUNDO) as IdSomFundo | null;
      this.estado.definirEfeitosAtivos(e === null ? PADRAO_PREFERENCIAS_SOM.efeitosAtivos : e === '1');
      this.estado.definirFundo(
        f && IDS_FUNDOS_VALIDOS.has(f) ? f : PADRAO_PREFERENCIAS_SOM.fundo,
      );
    } catch {
      this.estado.definirEfeitosAtivos(PADRAO_PREFERENCIAS_SOM.efeitosAtivos);
      this.estado.definirFundo(PADRAO_PREFERENCIAS_SOM.fundo);
    }
    this.registrarGestos();
    return this.obterPreferencias();
  }

  obterPreferencias(): PreferenciasSom {
    if (!this.prefsCarregadas && typeof window !== 'undefined') this.lerPreferencias();
    return {
      efeitosAtivos: this.estado.efeitosAtivos,
      fundo: this.estado.fundo,
    };
  }

  obterEstado(): EstadoSomSnapshot {
    this.lerPreferencias();
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

  private registrarGestos(): void {
    if (this.gestosRegistrados || typeof window === 'undefined') return;
    this.gestosRegistrados = true;
    const desbloquear = () => {
      const eraBloqueado = !this.desbloqueado;
      this.desbloqueado = true;
      const ctx = this.garantirContexto();
      if (ctx && ctx.state !== 'running') {
        void ctx.resume().then(() => {
          this.preCarregarEssenciais();
          void this.atualizarEstadoFundo(600);
        }).catch(() => { /* No iOS, a próxima soltura do toque pode liberar o contexto. */ });
      } else if (eraBloqueado || this.estadoFundo === 'erro') {
        this.preCarregarEssenciais();
        void this.atualizarEstadoFundo(600);
      }
      if (eraBloqueado) this.notificar();
    };
    // O gesto que libera áudio pode ser o início, a soltura do toque ou a ativação por teclado.
    for (const evento of ['pointerdown', 'touchend', 'click', 'keydown']) {
      window.addEventListener(evento, desbloquear, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      this.estado.definirSegundoPlano(document.visibilityState !== 'visible');
      if (this.estado.emSegundoPlano) this.silenciarEfeitos();
      else this.prepararEfeitos(...this.efeitosDaTela);
      void this.atualizarEstadoFundo(this.estado.emSegundoPlano ? 0 : 600);
    });
  }

  private preCarregarEssenciais(): void {
    if (this.preCarregouEssenciais || !this.lerPreferencias().efeitosAtivos) return;
    this.preCarregouEssenciais = true;
    this.prepararEfeitos('erro_rede', 'aviso');
  }

  /** O download e a decodificação podem acontecer antes do gesto; a preparação nunca toca um som. */
  prepararEfeitos(...ids: IdEfeitoSonoro[]): void {
    if (typeof window === 'undefined') return;
    for (const id of ids) this.efeitosDaTela.add(id);
    if (!this.lerPreferencias().efeitosAtivos || document.visibilityState === 'hidden') return;
    for (const id of ids) void this.carregarBuffer(arquivoSonoro('sfx', CATALOGO_EFEITOS[id].arquivo));
  }

  private escopo = new AbortController();
  get sinalDosEfeitos(): AbortSignal { return this.escopo.signal; }

  descartarEfeitosPendentes(): void {
    this.escopo.abort();
    this.escopo = new AbortController();
    this.versaoEfeitos++;
  }

  private silenciarEfeitos(preservarBipes = false): void {
    this.descartarEfeitosPendentes();
    for (const [fonte, id] of this.efeitosTocando) {
      if (preservarBipes && this.estado.podeTocarEfeito(id)) continue;
      fonte.stop();
      this.efeitosTocando.delete(fonte);
    }
  }

  private garantirContexto(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      try {
        this.ctx = new Ctx({ latencyHint: 'interactive' });
      } catch {
        return null;
      }
      this.ganhoFundo = this.ctx.createGain();
      this.ganhoFundo.gain.value = 0;
      this.ganhoFundo.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private async carregarBuffer(url: string, timeoutMs?: number): Promise<AudioBuffer | null> {
    const emCache = this.cacheBuffers.get(url);
    if (emCache) return emCache;
    const pendente = this.carregando.get(url);
    if (pendente) return pendente;

    const ctx = this.garantirContexto();
    if (!ctx) return null;

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = timeoutMs && controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const promessa = fetch(url, controller ? { signal: controller.signal } : undefined)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((arr) => (arr ? ctx.decodeAudioData(arr) : null))
      .then((buf) => {
        if (timer) clearTimeout(timer);
        if (buf) this.cacheBuffers.set(url, buf);
        this.carregando.delete(url);
        return buf;
      })
      .catch(() => {
        if (timer) clearTimeout(timer);
        this.carregando.delete(url);
        return null;
      });

    this.carregando.set(url, promessa);
    return promessa;
  }

  /**
   * Toca um efeito sonoro pelo ID do catálogo.
   * Sem gesto prévio do usuário, descarta o som imediatamente (não enfileira para tocar atrasado).
   */
  async tocarEfeito(id: IdEfeitoSonoro, escopo?: AbortSignal): Promise<void> {
    if (escopo?.aborted) return;
    this.lerPreferencias();
    if (!this.desbloqueado) return;
    if (!this.estado.podeTocarEfeito(id) || document.visibilityState === 'hidden') return;

    const def = CATALOGO_EFEITOS[id];
    const agora = performance.now();
    const ultimo = this.ultimoDisparo.get(id) ?? -Infinity;
    if (agora - ultimo < def.cooldownMs) return;
    const versao = ++this.versaoEfeitos;

    const ctx = this.garantirContexto();
    if (!ctx) return;
    const url = arquivoSonoro('sfx', def.arquivo);
    let buf = this.cacheBuffers.get(url);
    if (!buf || ctx.state !== 'running') {
      try {
        const [carregado] = await Promise.all([
          buf ?? this.carregarBuffer(url),
          ctx.state === 'running' ? undefined : ctx.resume(),
        ]);
        if (!carregado || ctx.state !== 'running' || versao !== this.versaoEfeitos ||
          performance.now() - agora > VALIDADE_EFEITO_MS || !this.estado.podeTocarEfeito(id) ||
          document.visibilityState !== 'visible') return;
        buf = carregado;
      } catch {
        return;
      }
    }
    this.ultimoDisparo.set(id, performance.now());
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = def.volume;
    src.connect(gain);
    gain.connect(ctx.destination);
    this.efeitosTocando.set(src, id);
    src.onended = () => {
      this.efeitosTocando.delete(src);
      src.disconnect();
      gain.disconnect();
    };
    src.start(0);
  }

  async definirEfeitosAtivos(ativos: boolean): Promise<void> {
    this.lerPreferencias();
    const mudouParaLigado = !this.estado.efeitosAtivos && ativos;
    this.estado.definirEfeitosAtivos(ativos);
    if (!ativos) this.silenciarEfeitos();
    try {
      window.localStorage.setItem(CHAVE_EFEITOS, ativos ? '1' : '0');
    } catch {
      // Ignora erro de armazenamento privado.
    }
    this.notificar();
    if (mudouParaLigado) {
      this.preCarregarEssenciais();
      this.prepararEfeitos(...this.efeitosDaTela);
      await this.tocarEfeito('salvo');
    }
  }

  definirAreaPermitida(permitida: boolean): void {
    this.lerPreferencias();
    this.estado.definirAreaPermitida(permitida);
    void this.atualizarEstadoFundo(permitida ? 600 : 400);
  }

  definirPreviewFolha(opcoes: { aberta: boolean; leitorDeTela?: boolean }): void {
    this.folhaAberta = opcoes.aberta;
    if (opcoes.leitorDeTela !== undefined) this.leitorDeTela = opcoes.leitorDeTela;
    if (!opcoes.aberta) this.cancelarPreviewFundo();
    void this.atualizarEstadoFundo(300);
  }

  cancelarPreviewFundo(): void {
    if (this.timerPreview) {
      clearTimeout(this.timerPreview);
      this.timerPreview = null;
    }
  }

  /** Agenda a troca de fundo (usado para setas no teclado: 600 ms de permanência na opção). */
  definirFundoComAtraso(fundo: IdSomFundo, atrasoMs = 600): void {
    this.cancelarPreviewFundo();
    this.lerPreferencias();
    this.estado.definirFundo(fundo);
    try {
      window.localStorage.setItem(CHAVE_FUNDO, fundo);
    } catch {
      // Ignora.
    }
    this.notificar();
    this.timerPreview = setTimeout(() => {
      this.timerPreview = null;
      void this.atualizarEstadoFundo();
    }, atrasoMs);
  }

  async definirFundo(fundo: IdSomFundo): Promise<void> {
    this.cancelarPreviewFundo();
    this.lerPreferencias();
    const anterior = this.estado.fundo;
    this.estado.definirFundo(fundo);
    try {
      window.localStorage.setItem(CHAVE_FUNDO, fundo);
    } catch {
      // Ignora erro de armazenamento privado.
    }
    this.erroFundo = null;
    const rampaMs = fundo === 'mudo' ? 400 : anterior !== 'mudo' && anterior !== fundo ? 600 : 600;
    await this.atualizarEstadoFundo(rampaMs);
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
    this.estado.sairDeFala();
    void this.atualizarEstadoFundo(600);
  }

  entrarEmGravacaoOuVoz(): void {
    this.estado.entrarEmGravacaoOuVoz();
    this.silenciarEfeitos(true);
    void this.atualizarEstadoFundo(0);
  }

  sairDeGravacaoOuVoz(): void {
    this.estado.sairDeGravacaoOuVoz();
    void this.atualizarEstadoFundo(600);
  }

  private limparFonteImediatamente(): void {
    if (this.timerParada) {
      clearTimeout(this.timerParada);
      this.timerParada = null;
    }
    if (this.fonteFundo) {
      try {
        this.fonteFundo.stop();
        this.fonteFundo.disconnect();
      } catch {
        // Já parado.
      }
      this.fonteFundo = null;
    }
    this.fundoTocandoId = null;
  }

  private rampaGanho(alvo: number, duracaoMs: number): void {
    if (!this.ctx || !this.ganhoFundo) return;
    const agora = this.ctx.currentTime;
    const g = this.ganhoFundo.gain;
    g.cancelScheduledValues(agora);
    g.setValueAtTime(g.value, agora);
    if (duracaoMs <= 0) {
      g.setValueAtTime(alvo, agora);
    } else {
      g.linearRampToValueAtTime(alvo, agora + duracaoMs / 1000);
    }
  }

  private pararComRampa(duracaoMs: number): void {
    if (duracaoMs <= 0 || !this.fonteFundo) {
      this.limparFonteImediatamente();
      return;
    }
    this.rampaGanho(0, duracaoMs);
    if (this.timerParada) clearTimeout(this.timerParada);
    this.timerParada = setTimeout(() => {
      this.limparFonteImediatamente();
    }, duracaoMs + 30);
  }

  private async atualizarEstadoFundo(rampaMs = 600): Promise<void> {
    const estadoDesejado = this.estado.estadoFundo();
    const id = this.estado.fundo;

    if (estadoDesejado === 'parado' || id === 'mudo' || !this.desbloqueado) {
      const pararMs = !this.desbloqueado || this.estado.contGravacaoOuVoz > 0 || this.estado.emSegundoPlano ? 0 : 400;
      this.pararComRampa(pararMs);
      this.estadoFundo = this.erroFundo && id !== 'mudo' ? 'erro' : 'parado';
      this.notificar();
      return;
    }

    const def = CATALOGO_FUNDOS.find((f) => f.id === id);
    if (!def) {
      this.limparFonteImediatamente();
      this.estadoFundo = 'parado';
      this.notificar();
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

    const fatorFala = estadoDesejado === 'atenuado' ? 0.2 : 1;
    const fatorLeitor = this.folhaAberta && this.leitorDeTela ? 0.6 : 1;
    const alvoGanho = def.volume * fatorFala * fatorLeitor;

    if (this.fonteFundo && this.fundoTocandoId === id) {
      this.rampaGanho(alvoGanho, rampaMs);
      this.estadoFundo = 'tocando';
      this.notificar();
      return;
    }

    const seq = ++this.sequenciaFundo;
    // Se havia outro clima tocando, desce o anterior em 300 ms antes de subir o novo em 600 ms.
    if (this.fonteFundo) {
      this.pararComRampa(300);
    }

    if (!this.cacheBuffers.has(arquivoSonoro('fundos', def.arquivo))) {
      this.estadoFundo = 'carregando';
      this.erroFundo = null;
      this.notificar();
    }

    const buf = await this.carregarBuffer(arquivoSonoro('fundos', def.arquivo), TIMEOUT_CARREGAMENTO_MS);
    if (seq !== this.sequenciaFundo) return;

    if (!buf) {
      this.limparFonteImediatamente();
      this.estadoFundo = 'erro';
      this.erroFundo = MENSAGEM_ERRO_FUNDO;
      this.notificar();
      return;
    }

    if (this.estado.estadoFundo() === 'parado' || this.estado.fundo !== id || !this.desbloqueado) {
      return;
    }

    this.limparFonteImediatamente();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const inicio = Math.min(def.aparoInicioSeg, Math.max(0, buf.duration - 1));
    const fim = Math.max(inicio + 1, buf.duration - def.aparoFimSeg);
    src.loopStart = inicio;
    src.loopEnd = fim;
    src.connect(this.ganhoFundo);
    this.ganhoFundo.gain.setValueAtTime(0, ctx.currentTime);
    src.start(0, inicio);
    this.fonteFundo = src;
    this.fundoTocandoId = id;
    this.rampaGanho(alvoGanho, 600);
    this.estadoFundo = 'tocando';
    this.erroFundo = null;
    this.notificar();
  }
}

export const tocaSons = new TocaSonsWeb();
