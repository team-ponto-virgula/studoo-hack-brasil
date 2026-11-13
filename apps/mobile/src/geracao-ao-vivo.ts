import { interpretarEventoGeracao, type EventoGeracao, type PropostaPlano } from '@studoo/contratos';
import type { NoCaminho } from './trilha';

/*
 * Geração ao vivo da trilha (spec 03), igual à da web (src/app/geracao-ao-vivo.ts).
 * O pedido em si fica em api-nativa.ts, com o token do aparelho; aqui ficam a leitura do NDJSON e a montagem da prévia.
 */

/** Trilha que está sendo montada na tela: o que já chegou do fluxo e, no fim, a proposta para o aceite. */
export type TrilhaEmGeracao = {
  objetivo: string;
  titulo: string | null;
  fluxos: { titulo: string; licoes: string[] }[];
  proposta: PropostaPlano | null;
};

/** Código de erro de uma resposta JSON, validado pelo contrato; fora dele, `falha`. */
export function codigoDaResposta(corpo: unknown) {
  const codigo = typeof corpo === 'object' && corpo !== null && 'codigo' in corpo ? corpo.codigo : undefined;
  const evento = interpretarEventoGeracao(JSON.stringify({ tipo: 'erro', codigo }));
  return evento?.tipo === 'erro' ? evento.codigo : 'falha';
}

/**
 * Lê o corpo NDJSON e entrega os eventos na ordem em que chegam, cada linha validada por `interpretarEventoGeracao`;
 * linha vazia ou inválida é ignorada. Parar de ler (fim da tela, Cancelar) cancela o corpo, e o servidor para a geração.
 */
export async function* lerEventos(corpo: ReadableStream<Uint8Array>): AsyncGenerator<EventoGeracao> {
  const leitor = corpo.getReader();
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
