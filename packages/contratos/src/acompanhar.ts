/**
 * Geração que se acompanha (spec 03, lote 2 do dono, 19/11): os tempos e as posições do mapa enquanto a trilha nasce, iguais
 * na web e no app. A regra está na spec 03 ("A tela acompanha a geração"); aqui ficam só os números, para as duas
 * plataformas usarem os mesmos.
 */
export const ACOMPANHAR_GERACAO = {
  /** Nós que chegam juntos entram em fila, um de cada vez, com este intervalo (dá para ver a sequência). */
  intervaloEntreNosMs: 450,
  /** Onde o nó mais novo fica na parte visível do mapa: o centro dele a 58% da altura (um pouco abaixo do meio). */
  posicaoDoNo: 0.58,
  /** Folga mínima entre o nome do nó mais novo e o rodapé (ou a barra de baixo). */
  folgaDoRodape: 24,
  /** A rolagem suave até o nó mais novo. */
  rolagemMs: 520,
  /** O trecho do caminho se desenha até o nó novo; depois o nó entra e, por último, o nome aparece. */
  desenhoMs: 240,
  entradaMs: 320,
  nomeAtrasoMs: 200,
  /** O Stu vai para perto do nó mais novo. */
  stuMs: 420,
  /** No aceite, a tela passeia pela trilha, um nó por vez, enquanto as lições são escritas. */
  passeioPorNoMs: 1600,
  /** O "lápis" de cada nó enquanto a lição é escrita: um ciclo de ida e volta. */
  escrevendoCicloMs: 900,
  /** "Trilha pronta" fica na tela antes de a tela voltar ao começo. */
  prontaMs: 1400,
  /** A volta devagar até a primeira lição, onde está o "Começar". */
  voltaMs: 1100,
  /** O leitor de tela ouve o progresso a cada tantos nós (e no fim), não a cada um. */
  anunciarACada: 3,
} as const;

/** Onde rolar para o centro de um elemento ficar na posição pedida da parte visível, sem passar do começo. */
export function rolagemParaAcompanhar(centro: number, visivel: number, posicao: number = ACOMPANHAR_GERACAO.posicaoDoNo): number {
  return Math.max(0, Math.round(centro - visivel * posicao));
}
