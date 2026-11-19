/**
 * Regras do ordenar em lista única (spec 08, revisão do dono de 19/11), sem React Native: testadas em
 * tests/ordenar-mobile.test.mjs. A ordem é uma lista de ids; os travados (certos da tentativa anterior) não saem do lugar.
 */

/** A ordem com `id` posto na posição `destino` entre os que se movem; os travados ficam onde estão. */
export function moverEntreLivres(ordem: readonly string[], travados: ReadonlySet<string>, id: string, destino: number): string[] {
  const livres = ordem.filter((outro) => !travados.has(outro) && outro !== id);
  livres.splice(Math.max(0, Math.min(destino, livres.length)), 0, id);
  let proximo = 0;
  return ordem.map((outro) => (travados.has(outro) ? outro : livres[proximo++]));
}

/** Troca dois itens de lugar. */
export function trocarDeLugar(ordem: readonly string[], um: string, outro: string): string[] {
  return ordem.map((id) => (id === um ? outro : id === outro ? um : id));
}

/**
 * Para onde vai o arrastado: quantos dos outros que se movem têm o centro acima do centro dele, pelas caixas medidas no
 * começo do arrasto (a ordem que a pessoa vê enquanto arrasta não muda a conta).
 */
export function destinoDoArrasto(inicio: readonly string[], travados: ReadonlySet<string>, id: string,
  caixas: Readonly<Record<string, { y: number; altura: number }>>, centro: number): number {
  return inicio.filter((outro) => {
    const caixa = caixas[outro];
    return !travados.has(outro) && outro !== id && caixa !== undefined && caixa.y + caixa.altura / 2 < centro;
  }).length;
}
