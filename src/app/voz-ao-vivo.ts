import type { ClienteEstudio, EstadoVozAoVivo, SessaoVozAoVivo } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';

export type CodigoErroVozAoVivo = 'micNegado' | 'falhaConexao' | 'rede' | 'limite' | 'visitante' | 'curta';

export type TurnoLegenda = {
  id: string;
  autor: 'usuario' | 'stu';
  texto: string;
  finalizada: boolean;
};

export type EstadoSessaoVozAoVivo = {
  estado: EstadoVozAoVivo;
  mudo: boolean;
  segundos: number;
  limiteSegundos: number;
  avisoTempo: boolean;
  legendas: TurnoLegenda[];
  ordemUsuario: string[];
  falasPorItem: Record<string, string>;
  itensPendentes: string[];
  erro: CodigoErroVozAoVivo | null;
  anuncioSr: string;
};

export function estadoInicialVozAoVivo(limiteSegundos = 180): EstadoSessaoVozAoVivo {
  return {
    estado: 'pedindo_mic',
    mudo: false,
    segundos: 0,
    limiteSegundos,
    avisoTempo: false,
    legendas: [],
    ordemUsuario: [],
    falasPorItem: {},
    itensPendentes: [],
    erro: null,
    anuncioSr: '',
  };
}

function atualizarLegenda(
  legendas: TurnoLegenda[],
  id: string,
  autor: 'usuario' | 'stu',
  texto: string,
  finalizada: boolean,
  anexar = false,
): TurnoLegenda[] {
  if (!texto.trim()) return legendas;
  const indice = legendas.findIndex((item) => item.id === id && item.autor === autor);
  if (indice === -1) {
    return [...legendas, { id, autor, texto, finalizada }];
  }
  return legendas.map((item, idx) =>
    idx === indice
      ? {
          ...item,
          texto: anexar ? `${item.texto}${texto}` : texto,
          finalizada: finalizada || item.finalizada,
        }
      : item,
  );
}

function registrarOrdem(ordem: string[], id: string): string[] {
  return ordem.includes(id) ? ordem : [...ordem, id];
}

function adicionarPendente(pendentes: string[], id: string): string[] {
  return pendentes.includes(id) ? pendentes : [...pendentes, id];
}

function removerPendente(pendentes: string[], id: string): string[] {
  return pendentes.filter((item) => item !== id);
}

const CODIGOS_NAO_FATAIS = new Set([
  'response_cancel_not_active',
  'conversation_already_has_active_response',
  'input_audio_buffer_commit_empty',
  'item_truncate_invalid_item_id',
]);

export function erroCanalEhFatal(erro?: { type?: string; code?: string } | null): boolean {
  const codigo = String(erro?.code ?? '').toLowerCase();
  if (codigo && CODIGOS_NAO_FATAIS.has(codigo)) return false;
  const tipo = String(erro?.type ?? '').toLowerCase();
  if (tipo === 'invalid_request_error' && codigo && CODIGOS_NAO_FATAIS.has(codigo)) return false;
  return true;
}

export type EventoRealtime = {
  type?: string;
  item_id?: string;
  response_id?: string;
  delta?: string;
  transcript?: string;
  item?: { id?: string; role?: string };
  error?: { type?: string; code?: string };
};

/**
 * Redutor puro dos eventos do canal `oai-events` da OpenAI Realtime API.
 * Mantém a ordem dos itens do usuário mesmo com transcrições atrasadas ou fora de ordem.
 */
export function reduzirEventoRealtime(
  atual: EstadoSessaoVozAoVivo,
  evento: EventoRealtime,
): EstadoSessaoVozAoVivo {
  const tipo = evento.type;
  if (!tipo) return atual;

  if (tipo === 'conversation.item.created' && evento.item?.role === 'user' && evento.item.id) {
    return {
      ...atual,
      ordemUsuario: registrarOrdem(atual.ordemUsuario, evento.item.id),
      itensPendentes: adicionarPendente(atual.itensPendentes, evento.item.id),
    };
  }

  if (tipo === 'input_audio_buffer.committed' && evento.item_id) {
    return {
      ...atual,
      ordemUsuario: registrarOrdem(atual.ordemUsuario, evento.item_id),
      itensPendentes: adicionarPendente(atual.itensPendentes, evento.item_id),
    };
  }

  if (tipo === 'input_audio_buffer.speech_started') {
    return atual.estado === 'stu_falando' ? { ...atual, estado: 'ouvindo' } : atual;
  }

  if (tipo === 'conversation.item.input_audio_transcription.delta' && typeof evento.delta === 'string') {
    const id = evento.item_id ?? `usr-${atual.ordemUsuario.length + 1}`;
    return {
      ...atual,
      estado: 'ouvindo',
      ordemUsuario: registrarOrdem(atual.ordemUsuario, id),
      itensPendentes: adicionarPendente(atual.itensPendentes, id),
      legendas: atualizarLegenda(atual.legendas, id, 'usuario', evento.delta, false, true),
    };
  }

  if (tipo === 'conversation.item.input_audio_transcription.completed' && typeof evento.transcript === 'string') {
    const id = evento.item_id ?? `usr-${atual.ordemUsuario.length + 1}`;
    const fala = evento.transcript.trim();
    const pendentes = removerPendente(atual.itensPendentes, id);
    if (!fala) {
      return { ...atual, itensPendentes: pendentes };
    }
    return {
      ...atual,
      ordemUsuario: registrarOrdem(atual.ordemUsuario, id),
      falasPorItem: { ...atual.falasPorItem, [id]: fala },
      itensPendentes: pendentes,
      legendas: atualizarLegenda(atual.legendas, id, 'usuario', fala, true, false),
    };
  }

  if (tipo === 'output_audio_buffer.started') {
    return atual.estado === 'encerrando' || atual.estado === 'erro'
      ? atual
      : { ...atual, estado: 'stu_falando' };
  }

  if (tipo === 'output_audio_buffer.stopped') {
    return atual.estado === 'stu_falando' ? { ...atual, estado: 'ouvindo' } : atual;
  }

  if (
    (tipo === 'response.output_audio_transcript.delta' || tipo === 'response.audio_transcript.delta') &&
    typeof evento.delta === 'string'
  ) {
    const id = evento.response_id ?? evento.item_id ?? 'stu-atual';
    return {
      ...atual,
      estado: 'stu_falando',
      legendas: atualizarLegenda(atual.legendas, id, 'stu', evento.delta, false, true),
    };
  }

  if (
    (tipo === 'response.output_audio_transcript.done' || tipo === 'response.audio_transcript.done') &&
    typeof evento.transcript === 'string'
  ) {
    const id = evento.response_id ?? evento.item_id ?? 'stu-atual';
    return {
      ...atual,
      legendas: atualizarLegenda(atual.legendas, id, 'stu', evento.transcript.trim(), true, false),
    };
  }

  if (tipo === 'response.done') {
    return atual.estado === 'stu_falando' ? { ...atual, estado: 'ouvindo' } : atual;
  }

  if (tipo === 'error') {
    if (!erroCanalEhFatal(evento.error)) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[voz-ao-vivo] aviso canal', evento.error?.type ?? '', evento.error?.code ?? '');
      }
      return atual;
    }
    return {
      ...atual,
      estado: 'erro',
      erro: 'rede',
      anuncioSr: mensagens.estudio.vozAoVivo.erros.rede,
    };
  }

  return atual;
}

/** Extrai exclusivamente as falas da pessoa, na ordem dos itens da conversa. */
export function extrairTranscricaoUsuario(estado: EstadoSessaoVozAoVivo): string {
  const partes: string[] = [];
  for (const id of estado.ordemUsuario) {
    const finalizada = estado.falasPorItem[id]?.trim();
    if (finalizada) {
      partes.push(finalizada);
      continue;
    }
    const parcial = estado.legendas.find((l) => l.id === id && l.autor === 'usuario')?.texto.trim();
    if (parcial) partes.push(parcial);
  }
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

/** Garante os limites do avaliador `ensinarStu` (20 a 3000 caracteres) após 3 minutos de conversa. */
export function prepararExplicacaoParaAvaliacao(texto: string): string | null {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length < 20) return null;
  if (limpo.length <= 3000) return limpo;
  const corte = limpo.slice(0, 3000);
  const ultimoEspaco = corte.lastIndexOf(' ');
  return (ultimoEspaco > 2400 ? corte.slice(0, ultimoEspaco) : corte).trim();
}

export function formatarTempoVoz(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

export function textoErroVozAoVivo(codigo: CodigoErroVozAoVivo): string {
  return mensagens.estudio.vozAoVivo.erros[codigo];
}

export type ControladorVozAoVivo = {
  alternarMudo: () => boolean;
  encerrar: () => Promise<string>;
  descartar: () => void;
};

type OpcoesControlador = {
  licaoId: string;
  cliente: Pick<ClienteEstudio, 'iniciarVozAoVivo' | 'encerrarVozAoVivo'>;
  aoMudar: (estado: EstadoSessaoVozAoVivo) => void;
  aoTempoEsgotado: (transcricao: string) => void;
  aoErroFatal?: (codigo: CodigoErroVozAoVivo, parcial: string) => void;
};

function classificarErroServidor(erro: unknown): CodigoErroVozAoVivo {
  const codigo = (erro as { codigo?: string } | null)?.codigo;
  if (codigo === 'limite_estudio') return 'limite';
  if (codigo === 'origem_invalida') return 'visitante';
  return 'falhaConexao';
}

export type DependenciasVoz = {
  pedirMic?: () => Promise<MediaStream>;
  criarPeer?: () => RTCPeerConnection;
  agoraMs?: () => number;
  criarAudio?: () => HTMLAudioElement;
};

/**
 * Inicia o controlador de voz ao vivo de forma síncrona para garantir cancelamento imediato
 * em qualquer etapa assíncrona, mantendo o estado sob posse exclusiva do controlador.
 */
export function iniciarControladorVozAoVivo(
  { licaoId, cliente, aoMudar, aoTempoEsgotado, aoErroFatal }: OpcoesControlador,
  deps: DependenciasVoz = {},
): ControladorVozAoVivo {
  let estadoAtual = estadoInicialVozAoVivo();
  let stream: MediaStream | null = null;
  let pc: RTCPeerConnection | null = null;
  let canal: RTCDataChannel | null = null;
  let sessao: SessaoVozAoVivo | null = null;
  let relogio: number | null = null;
  let timerConexao: number | null = null;
  let timerDesconexao: number | null = null;
  let timerGracaFim: number | null = null;
  let timerPendentes: number | null = null;
  let resolverPendentes: (() => void) | null = null;
  let inicioMs = 0;
  let avisoEnviado = false;
  let fimSolicitado = false;
  let cancelado = false;
  let encerrado = false;

  const agora = deps.agoraMs ?? (() => performance.now());

  // Criado de forma síncrona dentro do clique para respeitar a política de autoplay do Safari.
  let audioEl: HTMLAudioElement | null = null;
  if (deps.criarAudio) {
    audioEl = deps.criarAudio();
  } else if (typeof document !== 'undefined') {
    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    (audioEl as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    void audioEl.play?.().catch(() => undefined);
  }

  const aplicar = (fn: (a: EstadoSessaoVozAoVivo) => EstadoSessaoVozAoVivo) => {
    estadoAtual = fn(estadoAtual);
    if (estadoAtual.itensPendentes.length === 0 && resolverPendentes) {
      resolverPendentes();
      resolverPendentes = null;
    }
    aoMudar(estadoAtual);
  };

  const limparTemporizadores = () => {
    if (relogio !== null) { clearInterval(relogio); relogio = null; }
    if (timerConexao !== null) { clearTimeout(timerConexao); timerConexao = null; }
    if (timerDesconexao !== null) { clearTimeout(timerDesconexao); timerDesconexao = null; }
    if (timerGracaFim !== null) { clearTimeout(timerGracaFim); timerGracaFim = null; }
    if (timerPendentes !== null) { clearTimeout(timerPendentes); timerPendentes = null; }
  };

  const limparMidia = () => {
    limparTemporizadores();
    try { canal?.close(); } catch { /* ignore */ }
    canal = null;
    try { pc?.close(); } catch { /* ignore */ }
    pc = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl = null;
    }
  };

  const encerrarNoServidor = async () => {
    const chamadaId = sessao?.chamadaId;
    if (!chamadaId) return;
    sessao = null;
    if (cliente.encerrarVozAoVivo) {
      await cliente.encerrarVozAoVivo(licaoId, chamadaId).catch(() => undefined);
    }
  };

  const aoPageHide = () => {
    const chamadaId = sessao?.chamadaId;
    if (!chamadaId || typeof fetch === 'undefined') return;
    sessao = null;
    try {
      void fetch(`/api/estudio/licoes/${encodeURIComponent(licaoId)}/voz-ao-vivo/encerrar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chamadaId }),
        keepalive: true,
        credentials: 'include',
      });
    } catch { /* ignore */ }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', aoPageHide);
  }

  const removerPageHide = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', aoPageHide);
    }
  };

  const falhar = (codigo: CodigoErroVozAoVivo) => {
    if (encerrado || cancelado) return;
    encerrado = true;
    removerPageHide();
    const parcial = extrairTranscricaoUsuario(estadoAtual);
    limparMidia();
    void encerrarNoServidor();
    aplicar((a) => ({
      ...a,
      estado: 'erro',
      erro: codigo,
      anuncioSr: textoErroVozAoVivo(codigo),
    }));
    aoErroFatal?.(codigo, parcial);
  };

  const esperarTranscricoesPendentes = (): Promise<void> => {
    if (estadoAtual.itensPendentes.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      resolverPendentes = resolve;
      timerPendentes = setTimeout(() => {
        resolverPendentes = null;
        resolve();
      }, 3_000) as unknown as number;
    });
  };

  const tentarAtivarConversa = () => {
    if (cancelado || encerrado || inicioMs > 0) return;
    const estadoPc = pc?.connectionState;
    const pcPronto = estadoPc === 'connected' || estadoPc === undefined;
    const canalAberto = canal?.readyState === 'open';
    if (!pcPronto || !canalAberto) return;

    if (timerConexao !== null) { clearTimeout(timerConexao); timerConexao = null; }
    inicioMs = agora();
    aplicar((a) => ({
      ...a,
      estado: 'ouvindo',
      anuncioSr: mensagens.estudio.vozAoVivo.conectado,
    }));

    try {
      canal?.send(JSON.stringify({ type: 'response.create' }));
    } catch { /* ignore */ }

    const limite = sessao?.limiteSegundos ?? 180;
    const aviso = sessao?.avisoSegundos ?? 150;
    relogio = setInterval(() => {
      if (cancelado || encerrado) return;
      const decorridos = Math.max(0, Math.floor((agora() - inicioMs) / 1000));
      const atingiuAviso = decorridos >= aviso;

      if (atingiuAviso && !avisoEnviado) {
        avisoEnviado = true;
        try {
          canal?.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'system',
              content: [{
                type: 'input_text',
                text: `Faltam 30 segundos para encerrar a conversa. Faça o fechamento em até 2 frases dizendo o que entendeu e peça para tocar em "${mensagens.estudio.vozAoVivo.encerrar}".`,
              }],
            },
          }));
          if (estadoAtual.estado === 'ouvindo') {
            canal?.send(JSON.stringify({ type: 'response.create' }));
          }
        } catch { /* ignore */ }
      }

      aplicar((a) => ({
        ...a,
        segundos: decorridos,
        avisoTempo: a.avisoTempo || atingiuAviso,
        ...(atingiuAviso && !a.avisoTempo ? { anuncioSr: mensagens.estudio.vozAoVivo.avisoTempo } : {}),
      }));

      if (decorridos >= limite && !fimSolicitado) {
        fimSolicitado = true;
        if (estadoAtual.estado === 'stu_falando') {
          timerGracaFim = setTimeout(() => {
            void encerrar().then(aoTempoEsgotado);
          }, 10_000) as unknown as number;
        } else {
          void encerrar().then(aoTempoEsgotado);
        }
      }
    }, 500) as unknown as number;
  };

  async function conectar() {
    if (!cliente.iniciarVozAoVivo) {
      falhar('falhaConexao');
      return;
    }

    aplicar((a) => ({ ...a, estado: 'pedindo_mic', erro: null }));
    try {
      const pedirMic = deps.pedirMic ?? (() => {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem_mic');
        return navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      });
      stream = await pedirMic();
      if (cancelado) { limparMidia(); return; }
    } catch {
      falhar('micNegado');
      return;
    }

    try {
      aplicar((a) => ({
        ...a,
        estado: 'conectando',
        anuncioSr: mensagens.estudio.vozAoVivo.estados.conectando,
      }));
      timerConexao = setTimeout(() => {
        falhar('falhaConexao');
      }, 12_000) as unknown as number;

      pc = deps.criarPeer ? deps.criarPeer() : new RTCPeerConnection();
      const faixa = stream.getAudioTracks()[0];
      if (faixa) pc.addTrack(faixa, stream);

      pc.ontrack = (ev) => {
        if (audioEl && ev.streams[0]) audioEl.srcObject = ev.streams[0];
      };

      canal = pc.createDataChannel('oai-events');
      canal.onopen = () => {
        tentarAtivarConversa();
      };
      canal.onmessage = (ev) => {
        if (cancelado) return;
        try {
          const evento = JSON.parse(String(ev.data)) as EventoRealtime;
          const antes = estadoAtual;
          aplicar((a) => reduzirEventoRealtime(a, evento));
          if (estadoAtual.estado === 'erro' && antes.estado !== 'erro') {
            encerrado = true;
            removerPageHide();
            const parcial = extrairTranscricaoUsuario(estadoAtual);
            limparMidia();
            void encerrarNoServidor();
            aoErroFatal?.(estadoAtual.erro ?? 'rede', parcial);
            return;
          }
          if (fimSolicitado && antes.estado === 'stu_falando' && estadoAtual.estado === 'ouvindo' && !encerrado) {
            if (timerGracaFim !== null) { clearTimeout(timerGracaFim); timerGracaFim = null; }
            void encerrar().then(aoTempoEsgotado);
          }
        } catch { /* ignore */ }
      };

      pc.onconnectionstatechange = () => {
        if (cancelado || encerrado) return;
        const st = pc?.connectionState;
        if (st === 'connected') {
          if (timerDesconexao !== null) { clearTimeout(timerDesconexao); timerDesconexao = null; }
          tentarAtivarConversa();
          return;
        }
        if (st === 'failed') {
          falhar(inicioMs > 0 ? 'rede' : 'falhaConexao');
          return;
        }
        if (st === 'disconnected' && timerDesconexao === null) {
          timerDesconexao = setTimeout(() => {
            timerDesconexao = null;
            if (!cancelado && !encerrado && pc?.connectionState === 'disconnected') {
              falhar(inicioMs > 0 ? 'rede' : 'falhaConexao');
            }
          }, 5_000) as unknown as number;
        }
      };

      const oferta = await pc.createOffer();
      if (cancelado) { limparMidia(); return; }
      await pc.setLocalDescription(oferta);
      if (cancelado) { limparMidia(); return; }
      if (!oferta.sdp) throw new Error('sdp_vazio');

      const resposta = await cliente.iniciarVozAoVivo(licaoId, oferta.sdp);
      sessao = resposta;
      if (cancelado) {
        limparMidia();
        await encerrarNoServidor();
        return;
      }

      aplicar((a) => ({ ...a, limiteSegundos: resposta.limiteSegundos || 180 }));
      await pc.setRemoteDescription({ type: 'answer', sdp: resposta.sdpResposta });
      if (cancelado) {
        limparMidia();
        await encerrarNoServidor();
        return;
      }
      tentarAtivarConversa();
    } catch (erro) {
      if (cancelado) {
        limparMidia();
        await encerrarNoServidor();
        return;
      }
      falhar(classificarErroServidor(erro));
    }
  }

  void conectar();

  async function encerrar(): Promise<string> {
    if (encerrado) return extrairTranscricaoUsuario(estadoAtual);
    encerrado = true;
    removerPageHide();
    aplicar((a) => ({
      ...a,
      estado: 'encerrando',
      anuncioSr: mensagens.estudio.vozAoVivo.estados.encerrando,
    }));
    await esperarTranscricoesPendentes();
    const textoFinal = extrairTranscricaoUsuario(estadoAtual);
    limparMidia();
    await encerrarNoServidor();
    return textoFinal;
  }

  function alternarMudo(): boolean {
    const faixa = stream?.getAudioTracks()[0];
    if (!faixa) return estadoAtual.mudo;
    faixa.enabled = !faixa.enabled;
    const mudo = !faixa.enabled;
    aplicar((a) => ({ ...a, mudo }));
    return mudo;
  }

  function descartar() {
    if (cancelado && encerrado) return;
    cancelado = true;
    encerrado = true;
    removerPageHide();
    limparMidia();
    void encerrarNoServidor();
  }

  return { alternarMudo, encerrar, descartar };
}
