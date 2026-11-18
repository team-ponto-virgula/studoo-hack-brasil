import type { ClienteEstudio, EstadoVozAoVivo, SessaoVozAoVivo } from '@studoo/contratos';
import { mensagens } from '../mensagens/pt-BR';

export type CodigoErroVozAoVivo = 'micNegado' | 'rede' | 'limite' | 'visitante' | 'curta';

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
  avisoTempo: boolean;
  legendas: TurnoLegenda[];
  falasUsuario: string[];
  erro: CodigoErroVozAoVivo | null;
};

export function estadoInicialVozAoVivo(): EstadoSessaoVozAoVivo {
  return {
    estado: 'pedindo_mic',
    mudo: false,
    segundos: 0,
    avisoTempo: false,
    legendas: [],
    falasUsuario: [],
    erro: null,
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
  const limpo = texto;
  if (!limpo.trim()) return legendas;
  const indice = legendas.findIndex((item) => item.id === id && item.autor === autor);
  if (indice === -1) {
    return [...legendas, { id, autor, texto: limpo, finalizada }];
  }
  return legendas.map((item, idx) =>
    idx === indice
      ? {
          ...item,
          texto: anexar ? `${item.texto}${limpo}` : limpo,
          finalizada: finalizada || item.finalizada,
        }
      : item,
  );
}

export type EventoRealtime = {
  type?: string;
  item_id?: string;
  response_id?: string;
  delta?: string;
  transcript?: string;
};

/**
 * Redutor puro dos eventos do canal `oai-events` da OpenAI Realtime API.
 * Separa legendas do Stu e da pessoa, mantendo `falasUsuario` isolado para avaliação.
 */
export function reduzirEventoRealtime(
  atual: EstadoSessaoVozAoVivo,
  evento: EventoRealtime,
): EstadoSessaoVozAoVivo {
  const tipo = evento.type;
  if (!tipo) return atual;

  if (tipo === 'input_audio_buffer.speech_started') {
    return atual.estado === 'stu_falando' ? { ...atual, estado: 'ouvindo' } : atual;
  }

  if (tipo === 'conversation.item.input_audio_transcription.delta' && typeof evento.delta === 'string') {
    const id = evento.item_id ?? `usr-${atual.falasUsuario.length + 1}`;
    return {
      ...atual,
      estado: 'ouvindo',
      legendas: atualizarLegenda(atual.legendas, id, 'usuario', evento.delta, false, true),
    };
  }

  if (tipo === 'conversation.item.input_audio_transcription.completed' && typeof evento.transcript === 'string') {
    const fala = evento.transcript.trim();
    if (!fala) return atual;
    const id = evento.item_id ?? `usr-${atual.falasUsuario.length + 1}`;
    return {
      ...atual,
      legendas: atualizarLegenda(atual.legendas, id, 'usuario', fala, true, false),
      falasUsuario: [...atual.falasUsuario, fala],
    };
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
    return { ...atual, estado: 'erro', erro: 'rede' };
  }

  return atual;
}

/** Extrai exclusivamente as falas da pessoa para enviar ao avaliador `ensinarStu`. */
export function extrairTranscricaoUsuario(estado: EstadoSessaoVozAoVivo): string {
  if (estado.falasUsuario.length > 0) {
    return estado.falasUsuario.join(' ').replace(/\s+/g, ' ').trim();
  }
  return estado.legendas
    .filter((item) => item.autor === 'usuario')
    .map((item) => item.texto.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
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
  aoMudar: (proximo: EstadoSessaoVozAoVivo | ((anterior: EstadoSessaoVozAoVivo) => EstadoSessaoVozAoVivo)) => void;
  aoTempoEsgotado: (transcricao: string) => void;
};

function classificarErroServidor(erro: unknown): CodigoErroVozAoVivo {
  const codigo = (erro as { codigo?: string } | null)?.codigo;
  if (codigo === 'limite_estudio') return 'limite';
  if (codigo === 'origem_invalida') return 'visitante';
  return 'rede';
}

export async function iniciarControladorVozAoVivo({
  licaoId,
  cliente,
  aoMudar,
  aoTempoEsgotado,
}: OpcoesControlador): Promise<ControladorVozAoVivo> {
  if (!cliente.iniciarVozAoVivo || !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
    aoMudar((a) => ({ ...a, estado: 'erro', erro: 'rede' }));
    return { alternarMudo: () => false, encerrar: async () => '', descartar: () => undefined };
  }

  let stream: MediaStream | null = null;
  let pc: RTCPeerConnection | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let sessao: SessaoVozAoVivo | null = null;
  let relogio: number | null = null;
  let estadoMaisRecente = estadoInicialVozAoVivo();
  let encerrado = false;

  const atualizar = (fn: (a: EstadoSessaoVozAoVivo) => EstadoSessaoVozAoVivo) => {
    aoMudar((anterior) => {
      const proximo = fn(anterior);
      estadoMaisRecente = proximo;
      return proximo;
    });
  };

  const limparRecursos = () => {
    if (relogio !== null) {
      window.clearInterval(relogio);
      relogio = null;
    }
    try {
      pc?.close();
    } catch { /* ignore */ }
    pc = null;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl = null;
    }
  };

  try {
    atualizar((a) => ({ ...a, estado: 'pedindo_mic', erro: null }));
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    atualizar((a) => ({ ...a, estado: 'erro', erro: 'micNegado' }));
    return { alternarMudo: () => false, encerrar: async () => '', descartar: limparRecursos };
  }

  try {
    atualizar((a) => ({ ...a, estado: 'conectando' }));
    pc = new RTCPeerConnection();
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) pc.addTrack(audioTrack, stream);

    audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    pc.ontrack = (ev) => {
      if (audioEl && ev.streams[0]) audioEl.srcObject = ev.streams[0];
    };

    const canal = pc.createDataChannel('oai-events');
    canal.onopen = () => {
      try {
        canal.send(JSON.stringify({ type: 'response.create' }));
      } catch { /* ignore */ }
    };
    canal.onmessage = (ev) => {
      try {
        const evento = JSON.parse(String(ev.data)) as EventoRealtime;
        atualizar((a) => reduzirEventoRealtime(a, evento));
      } catch { /* ignore */ }
    };

    pc.onconnectionstatechange = () => {
      if (encerrado) return;
      if (pc?.connectionState === 'failed' || pc?.connectionState === 'disconnected') {
        atualizar((a) => (a.estado === 'encerrando' ? a : { ...a, estado: 'erro', erro: 'rede' }));
        limparRecursos();
      }
    };

    const oferta = await pc.createOffer();
    await pc.setLocalDescription(oferta);
    if (!oferta.sdp) throw new Error('sdp_vazio');

    sessao = await cliente.iniciarVozAoVivo(licaoId, oferta.sdp);
    await pc.setRemoteDescription({ type: 'answer', sdp: sessao.sdpResposta });

    atualizar((a) => ({ ...a, estado: 'ouvindo' }));

    const limiteSegundos = sessao.limiteSegundos || 180;
    const avisoSegundos = sessao.avisoSegundos || 150;
    relogio = window.setInterval(() => {
      if (encerrado) return;
      let atingiuLimite = false;
      atualizar((a) => {
        const proximoSeg = a.segundos + 1;
        if (proximoSeg >= limiteSegundos) atingiuLimite = true;
        return {
          ...a,
          segundos: proximoSeg,
          avisoTempo: a.avisoTempo || proximoSeg >= avisoSegundos,
        };
      });
      if (atingiuLimite) {
        void encerrar().then(aoTempoEsgotado);
      }
    }, 1000);
  } catch (erro) {
    limparRecursos();
    atualizar((a) => ({ ...a, estado: 'erro', erro: classificarErroServidor(erro) }));
    return { alternarMudo: () => false, encerrar: async () => '', descartar: limparRecursos };
  }

  async function encerrar(): Promise<string> {
    if (encerrado) return extrairTranscricaoUsuario(estadoMaisRecente);
    encerrado = true;
    atualizar((a) => ({ ...a, estado: 'encerrando' }));
    const chamadaId = sessao?.chamadaId;
    limparRecursos();
    if (chamadaId && cliente.encerrarVozAoVivo) {
      await cliente.encerrarVozAoVivo(licaoId, chamadaId).catch(() => undefined);
    }
    return extrairTranscricaoUsuario(estadoMaisRecente);
  }

  function alternarMudo(): boolean {
    const faixa = stream?.getAudioTracks()[0];
    if (!faixa) return estadoMaisRecente.mudo;
    faixa.enabled = !faixa.enabled;
    const mudo = !faixa.enabled;
    atualizar((a) => ({ ...a, mudo }));
    return mudo;
  }

  return {
    alternarMudo,
    encerrar,
    descartar: () => {
      encerrado = true;
      limparRecursos();
    },
  };
}
