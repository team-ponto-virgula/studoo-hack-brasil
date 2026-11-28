/*
 * Os passos do "Explique com suas palavras" (spec 16, item 25). Eram três pílulas com borda ("1. Gravar ou escrever", "2. Revisar texto", "3. Ver retorno do Stu"), iguais a filtros, que
 * convidavam ao toque. Agora é uma linha só de indicador, como a da ponte: "Passo 1 de 3 · Gravar ou escrever", em 14/20 800 #5E6A85, sem nada tocável; o leitor de tela ouve
 * "Passo 1 de 3: Gravar ou escrever". As contas são as mesmas do app (estudio-cenas.tsx e estudio-adaptativo.tsx).
 */

/** O nome da etapa sem o número da lista antiga ("1. Gravar ou escrever" vira "Gravar ou escrever"). */
export function nomeDaEtapaDoEnsino(etapa: string): string {
  return etapa.replace(/^\d+\.\s*/, '');
}

/**
 * Qual passo está valendo (0, 1 ou 2): enquanto grava ou conversa ao vivo, o 1º; com o retorno do Stu na tela, o 3º; com texto pronto para revisar, o 2º; sem texto, o 1º.
 */
export function passoAtivoDoEnsino({ gravando, vozAtiva, temRetorno, temTexto }: { gravando: boolean; vozAtiva: boolean; temRetorno: boolean; temTexto: boolean }): 0 | 1 | 2 {
  if (gravando || vozAtiva) return 0;
  if (temRetorno) return 2;
  return temTexto ? 1 : 0;
}

/**
 * A linha do indicador: o que se vê ("Passo 1 de 3 · Gravar ou escrever") e o que o leitor de tela ouve ("Passo 1 de 3: Gravar ou escrever"). `etapas` são os três textos do
 * contrato, ainda com o número ("1. …"); `passoDe` é o `ponteIndicador` do contrato ("Passo n de 3"), o mesmo da ponte.
 */
export function linhaDoPassoDoEnsino(ativo: 0 | 1 | 2, etapas: readonly [string, string, string], passoDe: (n: number) => string): { visivel: string; leitor: string } {
  const passo = passoDe(ativo + 1);
  const nome = nomeDaEtapaDoEnsino(etapas[ativo]);
  return { visivel: `${passo} · ${nome}`, leitor: `${passo}: ${nome}` };
}
