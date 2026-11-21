import { createHmac } from "node:crypto";
import { ORDENS_DO_SUA_VEZ } from "@studoo/contratos";

/*
 * A ordem das opções do "Sua vez" (spec 15, seção 4). A IA escreve a opção certa PRIMEIRA (A em 70 de 71 passos dos dumps reais) e nenhum
 * cliente embaralha essas opções (o embaralhar do app e da web é só dos exercícios comuns): quem clicasse em A acertaria sempre. O
 * servidor embaralha na saída, com uma das seis permutações escolhida por (conta, lição):
 * - determinística: a mesma conta e a mesma lição têm sempre a mesma ordem, e as DUAS rotas (a lição e o POST /resolucao) usam esta função,
 *   então o índice que o cliente viu é o índice que ele manda;
 * - da conta e da lição, não do tempo nem de um sorteio: reabrir a lição não troca as opções de lugar (e um aluno não "tenta de novo" até
 *   cair na certa pela ordem);
 * - com a chave do servidor (HMAC de `STUDOO_CHAVE_ASSINATURA`), para o cliente não calcular a permutação sozinho a partir dos ids.
 * O que a IA guardou e o exemplo em passos de texto do build 3 não mudam.
 */

/** A ordem das opções (`ordem[mostrada] = guardada`) para esta conta nesta lição. */
export function ordemDoSuaVez(usuarioId: string, licaoId: string): readonly [number, number, number] {
  const chave = process.env.STUDOO_CHAVE_ASSINATURA ?? "";
  const resumo = createHmac("sha256", chave).update(`sua-vez\0${usuarioId}\0${licaoId}`).digest();
  return ORDENS_DO_SUA_VEZ[resumo.readUInt32BE(0) % ORDENS_DO_SUA_VEZ.length];
}
