import type { EstadoVozAoVivo } from './estudio';
import { mensagens } from './experiencia';

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
  pessoaFalando: boolean;
  respostaEmCurso: boolean;
  usouBufferAudio: boolean;
  respostasFalhasSeguidas: number;
  legendas: TurnoLegenda[];
  ordemUsuario: string[];
  falasPorItem: Record<string, string>;
  itensPendentes: string[];
  erro: CodigoErroVozAoVivo | null;
  anuncioSr: string;
};

export const TEXTO_AVISO_FECHAMENTO_VOZ = mensagens.estudio.vozAoVivo.avisoFechamentoStu;

export function estadoInicialVozAoVivo(limiteSegundos = 180): EstadoSessaoVozAoVivo {
  return {
    estado: 'pedindo_mic',
    mudo: false,
    segundos: 0,
    limiteSegundos,
    avisoTempo: false,
    pessoaFalando: false,
    respostaEmCurso: false,
    usouBufferAudio: false,
    respostasFalhasSeguidas: 0,
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

const CODIGOS_FATAIS = new Set([
  'session_expired',
  'rate_limit_exceeded',
  'insufficient_quota',
  'invalid_api_key',
  'authentication_error',
]);

/**
 * Na Realtime API, eventos `error` mantêm a sessão aberta por padrão;
 * apenas códigos fatais confirmados encerram a conversa.
 */
export function erroCanalEhFatal(erro?: { type?: string; code?: string } | null): boolean {
  const codigo = String(erro?.code ?? '').toLowerCase();
  const tipo = String(erro?.type ?? '').toLowerCase();
  return CODIGOS_FATAIS.has(codigo) || CODIGOS_FATAIS.has(tipo);
}

export function classificarErroServidorVoz(erro: unknown): CodigoErroVozAoVivo {
  const codigo = (erro as { codigo?: string } | null)?.codigo;
  if (codigo === 'limite_estudio') return 'limite';
  if (codigo === 'origem_invalida') return 'visitante';
  return 'falhaConexao';
}

export type EventoRealtime = {
  type?: string;
  item_id?: string;
  response_id?: string;
  delta?: string;
  transcript?: string;
  item?: { id?: string; role?: string };
  error?: { type?: string; code?: string };
  response?: {
    status?: string;
    status_details?: {
      type?: string;
      reason?: string;
      error?: { type?: string; code?: string | null };
    };
  };
};

function estadoFinal(estado: EstadoVozAoVivo): boolean {
  return estado === 'encerrando' || estado === 'erro';
}

/**
 * Redutor puro dos eventos do canal `oai-events` da OpenAI Realtime API.
 * Estados finais (`encerrando`, `erro`) aceitam apenas dados (legendas/falas) e nunca mudam de estado.
 */
export function reduzirEventoRealtime(
  atual: EstadoSessaoVozAoVivo,
  evento: EventoRealtime,
): EstadoSessaoVozAoVivo {
  const tipo = evento.type;
  if (!tipo) return atual;
  const travado = estadoFinal(atual.estado);

  if ((tipo === 'conversation.item.created' || tipo === 'conversation.item.added') && evento.item?.role === 'user' && evento.item.id) {
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
    return {
      ...atual,
      pessoaFalando: true,
      estado: !travado && atual.estado === 'stu_falando' ? 'ouvindo' : atual.estado,
    };
  }

  if (tipo === 'input_audio_buffer.speech_stopped') {
    return { ...atual, pessoaFalando: false };
  }

  if (tipo === 'conversation.item.input_audio_transcription.delta' && typeof evento.delta === 'string') {
    const id = evento.item_id ?? `usr-${atual.ordemUsuario.length + 1}`;
    return {
      ...atual,
      estado: travado ? atual.estado : 'ouvindo',
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
    return {
      ...atual,
      usouBufferAudio: true,
      estado: travado ? atual.estado : 'stu_falando',
    };
  }

  // `cleared` chega no lugar de `stopped` quando a pessoa interrompe o Stu (confirmado com chave real em 18/11).
  if (tipo === 'output_audio_buffer.stopped' || tipo === 'output_audio_buffer.cleared') {
    return {
      ...atual,
      estado: !travado && atual.estado === 'stu_falando' ? 'ouvindo' : atual.estado,
    };
  }

  if (tipo === 'response.created') {
    return { ...atual, respostaEmCurso: true };
  }

  if (
    (tipo === 'response.output_audio_transcript.delta' || tipo === 'response.audio_transcript.delta') &&
    typeof evento.delta === 'string'
  ) {
    const id = evento.response_id ?? evento.item_id ?? 'stu-atual';
    return {
      ...atual,
      estado: travado ? atual.estado : 'stu_falando',
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
    const statusResp = evento.response?.status;
    const falhou = statusResp === 'failed' || statusResp === 'incomplete';
    if (falhou) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        const detalhe = evento.response?.status_details;
        console.debug(
          '[voz-ao-vivo] resposta',
          statusResp,
          detalhe?.reason ?? detalhe?.error?.code ?? detalhe?.error?.type ?? '',
        );
      }
      const seguidas = atual.respostasFalhasSeguidas + 1;
      if (seguidas >= 2 && !travado) {
        return {
          ...atual,
          respostaEmCurso: false,
          respostasFalhasSeguidas: seguidas,
          estado: 'erro',
          erro: 'rede',
          anuncioSr: mensagens.estudio.vozAoVivo.erros.rede,
        };
      }
      const deveVoltar = !travado && !atual.usouBufferAudio && atual.estado === 'stu_falando';
      return {
        ...atual,
        respostaEmCurso: false,
        respostasFalhasSeguidas: seguidas,
        estado: deveVoltar ? 'ouvindo' : atual.estado,
      };
    }

    const deveVoltar = !travado && !atual.usouBufferAudio && atual.estado === 'stu_falando';
    return {
      ...atual,
      respostaEmCurso: false,
      respostasFalhasSeguidas: 0,
      estado: deveVoltar ? 'ouvindo' : atual.estado,
    };
  }

  if (tipo === 'error') {
    if (!erroCanalEhFatal(evento.error)) {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
        console.debug('[voz-ao-vivo] aviso canal', evento.error?.type ?? '', evento.error?.code ?? '');
      }
      return atual;
    }
    if (travado) return atual;
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

/**
 * Junta eventual rascunho pré-existente com a transcrição da conversa,
 * respeitando os limites do avaliador `ensinarStu` (20 a 3000 caracteres).
 */
export function prepararExplicacaoParaAvaliacao(transcricao: string, rascunhoExistente = ''): string | null {
  const base = rascunhoExistente.replace(/\s+/g, ' ').trim();
  const fala = transcricao.replace(/\s+/g, ' ').trim();
  const combinado = base && fala ? `${base}\n\n${fala}` : fala || base;
  if (combinado.length < 20) return null;
  if (combinado.length <= 3000) return combinado;
  const corte = combinado.slice(0, 3000);
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
