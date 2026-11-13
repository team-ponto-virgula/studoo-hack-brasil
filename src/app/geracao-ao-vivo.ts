import { ErroStudoo, interpretarEventoGeracao, type EventoGeracao, type PropostaPlano } from '@studoo/contratos';
import type { NoCaminho } from '../ui';

const rota = '/api/aprendizado/propostas/ao-vivo';

/** Trilha que está sendo montada na tela: o que já chegou do fluxo e, no fim, a proposta para o aceite. */
export type TrilhaEmGeracao = {
  objetivo: string;
  titulo: string | null;
  fluxos: { titulo: string; licoes: string[] }[];
  proposta: PropostaPlano | null;
};

/** Código de erro de uma resposta JSON, validado pelo contrato; fora dele, `falha`. */
function codigoDaResposta(corpo: unknown) {
  const codigo = typeof corpo === 'object' && corpo !== null && 'codigo' in corpo ? corpo.codigo : undefined;
  const evento = interpretarEventoGeracao(JSON.stringify({ tipo: 'erro', codigo }));
  return evento?.tipo === 'erro' ? evento.codigo : 'falha';
}

/**
 * Pede a trilha ao vivo e entrega os eventos na ordem em que chegam, cada linha validada por `interpretarEventoGeracao`.
 * Um erro antes do início (JSON, como `limite_geracoes`) vira `ErroStudoo` com o código da API.
 * Abortar o sinal interrompe a leitura, e o servidor para a geração sem guardar nada.
 */
export async function* gerarTrilhaAoVivo(objetivo: string, sinal: AbortSignal): AsyncGenerator<EventoGeracao> {
  const resposta = await fetch(rota, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify({ objetivo }),
    credentials: 'same-origin',
    cache: 'no-store',
    signal: sinal,
  });

  if (!resposta.ok || !resposta.body || !resposta.headers.get('content-type')?.includes('application/x-ndjson')) {
    const corpo: unknown = await resposta.json().catch(() => null);
    throw new ErroStudoo(codigoDaResposta(corpo));
  }

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let resto = '';

  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      resto += decodificador.decode(value, { stream: true });
      const linhas = resto.split('\n');
      resto = linhas.pop() ?? '';
      for (const linha of linhas) {
        const evento = interpretarEventoGeracao(linha);
        if (evento) yield evento;
      }
    }
    const ultimo = interpretarEventoGeracao(resto + decodificador.decode());
    if (ultimo) yield ultimo;
  } finally {
    leitor.cancel().catch(() => undefined);
  }
}

/** Aplica um evento à trilha em montagem. No `pronto`, a trilha passa a ser exatamente a proposta que será aceita. */
export function aplicarEvento(trilha: TrilhaEmGeracao, evento: EventoGeracao): TrilhaEmGeracao {
  switch (evento.tipo) {
    case 'plano':
      return { ...trilha, titulo: evento.titulo, objetivo: evento.objetivo };
    case 'fluxo': {
      const fluxos = [...trilha.fluxos];
      fluxos[evento.fluxo] = { titulo: evento.titulo, licoes: fluxos[evento.fluxo]?.licoes ?? [] };
      return { ...trilha, fluxos };
    }
    case 'licao': {
      const fluxos = [...trilha.fluxos];
      const fluxo = fluxos[evento.fluxo] ?? { titulo: '', licoes: [] };
      const licoes = [...fluxo.licoes];
      licoes[evento.licao] = evento.titulo;
      fluxos[evento.fluxo] = { ...fluxo, licoes };
      return { ...trilha, fluxos };
    }
    case 'pronto': {
      const { proposta } = evento;
      return {
        objetivo: proposta.objetivo,
        titulo: proposta.titulo,
        fluxos: proposta.fluxos.map((fluxo) => ({ titulo: fluxo.titulo, licoes: fluxo.licoes.map((licao) => licao.titulo) })),
        proposta,
      };
    }
    case 'erro':
      return trilha;
  }
}

/** Nós da prévia, num caminho único na ordem da trilha; o trecho só posiciona o marco. */
export function nosDaPrevia(trilha: TrilhaEmGeracao): NoCaminho[] {
  return trilha.fluxos.flatMap((fluxo, trecho) => fluxo.licoes.map((titulo, licao): NoCaminho => ({
    id: `previa-${trecho}-${licao}`,
    titulo,
    estado: 'previa',
    trecho,
  })));
}
