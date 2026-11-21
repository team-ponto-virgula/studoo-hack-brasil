/*
 * Regras puras da rolagem da prévia da trilha (spec 16, item 1): quando a trilha fica pronta, a tela rola em 600 ms, com saída suave, até o nó 1 ficar no
 * centro da área livre (entre o alto e o rodapé); com movimento reduzido, vai direto. O troféu fica a uma rolagem de distância. Sem DOM aqui: o teste confere a conta.
 */

/** A duração da rolagem até o nó 1 quando a proposta fica pronta. */
export const DURACAO_ATE_O_NO_1_MS = 600;

/** Saída suave (cúbica): começa depressa e pousa devagar. */
export function saidaSuave(fracao: number): number {
  const limitada = Math.min(1, Math.max(0, fracao));
  return 1 - (1 - limitada) ** 3;
}

/**
 * O `scrollTop` que põe o centro do nó no centro da área livre, sem passar dos limites da rolagem (mapa curto: o que der). As posições vêm do DOM:
 * `centroDoNoNaTela` e `topoDaArea` em coordenadas da janela, `rolagem` é o `scrollTop` de agora.
 */
export function rolagemParaCentrarNo(medidas: { centroDoNoNaTela: number; topoDaArea: number; alturaDaArea: number; rolagem: number; alturaDoConteudo: number }): number {
  const { centroDoNoNaTela, topoDaArea, alturaDaArea, rolagem, alturaDoConteudo } = medidas;
  const centroNoConteudo = centroDoNoNaTela - topoDaArea + rolagem;
  const alvo = centroNoConteudo - alturaDaArea / 2;
  return Math.min(Math.max(0, alvo), Math.max(0, alturaDoConteudo - alturaDaArea));
}

/** O `scrollTop` no instante `decorrido` de uma rolagem de `de` até `para` que dura `duracao` ms (movimento reduzido: `duracao` 0, já no destino). */
export function rolagemNoInstante(de: number, para: number, decorrido: number, duracao: number): number {
  if (duracao <= 0) return para;
  return de + (para - de) * saidaSuave(decorrido / duracao);
}
