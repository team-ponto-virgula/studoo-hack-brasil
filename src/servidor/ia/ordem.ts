/**
 * Regras de ordenação da trilha (spec 03, "Ordem da trilha"). A IA falsa já as segue nos planos fixos.
 * Um adaptador de IA real deve incluí-las no prompt de sistema quando o provedor for escolhido (D5),
 * ao lado das instruções de formato dos eventos. O pedido continua levando só o objetivo (SEGURANCA.md §5).
 */
export const REGRAS_ORDEM_DA_TRILHA = [
  "Coloque os pré-requisitos antes do que depende deles.",
  "Cada lição ensina um único conceito novo.",
  "A dificuldade cresce ao longo da trilha.",
  "Intercale assuntos quando isso ajudar a fixar, por exemplo uma junção simples logo depois dos filtros, antes de filtros mais difíceis.",
  "De tempos em tempos, inclua uma lição de revisão que mistura o que já foi visto.",
  "Não agrupe lições por assunto. Os trechos (fluxos) são partes da mesma sequência de aprendizado, e o título de um trecho nunca é um assunto, como 'Consultas' ou 'Junções'. Use títulos como 'Primeiros passos', 'Praticando' e 'Desafio'.",
] as const;

/** Texto das regras para o prompt de sistema, uma por linha. */
export function instrucoesDeOrdem(): string {
  return ["Ordene as lições pela melhor sequência de aprendizado:", ...REGRAS_ORDEM_DA_TRILHA.map((regra) => `- ${regra}`)].join("\n");
}
