/*
 * Regras puras da aula que a web e o app só desenham (spec 16, lote 1). O contrato guarda a conta, para as duas plataformas mostrarem o mesmo na mesma tela.
 */

/**
 * Etapas curtas (item 4): quando o Conceito ou o Exemplo cabe sem rolar e sobram 40% ou mais da área livre, o conjunto (Stu e cartão) fica centralizado na vertical, entre o alto da aula e
 * o rodapé, e no Exemplo o Stu (stu-feliz, 72, decorativo) entra acima do cartão. Com mais conteúdo, tudo continua alinhado em cima, como sempre foi. Cada plataforma só mede as alturas.
 */
export const SOBRA_MINIMA_DA_ETAPA = 0.4;

/** O que a plataforma mede no miolo da aula: a altura que a etapa tem e a que o conteúdo usa (sem o Stu da folga, que entra só quando há sobra). */
export interface MedidaDaEtapa {
  /** Do alto do miolo ao rodapé: a área que a etapa tem. */
  livre: number;
  /** A soma das alturas do conteúdo e dos vãos entre eles. */
  usado: number;
}

/**
 * O conteúdo cabe sem rolar e sobram 40% ou mais da área livre? (usado ≤ 60% do livre). Medida inválida, sem altura ou com o conteúdo maior que a área, não é folga. A tolerância de meio
 * pixel evita que o arredondamento da altura vire e desvire a decisão.
 */
export function etapaTemFolga({ livre, usado }: MedidaDaEtapa): boolean {
  if (!Number.isFinite(livre) || !Number.isFinite(usado) || livre <= 0 || usado <= 0) return false;
  return usado <= livre * (1 - SOBRA_MINIMA_DA_ETAPA) + 0.5;
}

/**
 * A contagem de letras da resposta aberta (item 8): antes da primeira letra só o texto do rodapé orienta ("Escreva mais um pouco: faltam 40 letras."); a contagem do cartão entra com a
 * primeira letra, em cinza (#5E6A85, sem o laranja), e some quando o mínimo é atingido. `usados` são as letras e números sem os espaços (como o contador da tela).
 */
export function mostrarContagemDaAberta(usados: number, minimo: number): boolean {
  return Number.isFinite(usados) && Number.isFinite(minimo) && usados > 0 && usados < minimo;
}
