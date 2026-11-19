/**
 * Ritmo da geração que se acompanha (spec 04, "Revisão do dono (19/11)"): os tempos de cada lição que nasce, a fila, onde a
 * lição nova fica na tela e quando a tela para e volta a acompanhar. Os números são os da spec, os mesmos da web.
 */
export const RITMO_DA_GERACAO = {
  /** 0 ms: a tela rola até a vaga ficar a 60% da altura do mapa (320 ms, com saída suave). */
  rolagemMs: 320,
  posicaoDaVaga: 0.6,
  /** 120 ms: o caminho se desenha do nó anterior até a vaga (300 ms). */
  linhaAtrasoMs: 120,
  linhaMs: 300,
  /** 320 ms: o nó cai 26 px e pula (0,7 → 1,08 → 1 em 380 ms); cinco estrelinhas em 300 ms; o anel fica azul por 1,2 s. */
  noAtrasoMs: 320,
  noQueda: 26,
  noMs: 380,
  estrelasMs: 300,
  anelMs: 1200,
  /** 420 ms: o nome entra do lado (opacidade e 12 px, 220 ms) e a contagem sobe. */
  nomeAtrasoMs: 420,
  nomeMs: 220,
  nomeDeslize: 12,
  /** 560 ms: árvores e flores perto do nó brotam (260 ms). */
  cenarioAtrasoMs: 560,
  cenarioMs: 260,
  /** 700 ms: o esqueleto da próxima vaga gira e o Stu anda até a lição nova (400 ms). */
  esperaAtrasoMs: 700,
  stuMs: 400,
  /** Primeira lição de um trecho novo: o marco cai 12 px em 260 ms e a lição chega 200 ms depois. */
  marcoQueda: 12,
  marcoMs: 260,
  depoisDoMarcoMs: 200,
  /** "Mais uma!" fica 900 ms, no máximo a cada três lições. */
  maisUmaMs: 900,
  maisUmaACada: 3,
  /** Rolar para cima mais que isto para de acompanhar. */
  pararAcimaDe: 40,
  /** A pílula "Ver a lição nova" fica 16 px acima do rodapé. */
  pilulaAcimaDoRodape: 16,
  /** O fim: troféu (0 → 1,1 → 1 em 420 ms), confete por 1,2 s e o rodapé que desliza 12 px em 220 ms. */
  trofeuMs: 420,
  confeteMs: 1200,
  rodapeDeslize: 12,
  rodapeMs: 220,
  /** Sem lição nova por 12 s, a placa diz que ainda está escrevendo. */
  esperaLongaMs: 12000,
  /** Movimento reduzido: nó, nome e cenário aparecem juntos, com 150 ms de opacidade. */
  reduzidoMs: 150,
  /** "Escrevendo suas lições": a linha do brilho a 60% da altura e o visto que passa a cada 80 ms. */
  linhaDoBrilho: 0.6,
  vistoPorLinhaMs: 80,
} as const;

/**
 * Quanto a próxima lição espera depois que a anterior começou: ela começa quando a anterior chega ao passo 3 (o nó cai). Se a
 * anterior abriu um trecho, o marco veio antes dela e o passo 3 dela chegou 200 ms mais tarde.
 */
export function intervaloDaFila(anteriorAbriuTrecho: boolean) {
  return RITMO_DA_GERACAO.noAtrasoMs + (anteriorAbriuTrecho ? RITMO_DA_GERACAO.depoisDoMarcoMs : 0);
}

/** Atraso de cada passo de uma lição: na primeira de um trecho novo, tudo vem 200 ms depois do marco. */
export function atrasosDaLicao(abreTrecho: boolean) {
  const extra = abreTrecho ? RITMO_DA_GERACAO.depoisDoMarcoMs : 0;
  return {
    linha: RITMO_DA_GERACAO.linhaAtrasoMs + extra,
    no: RITMO_DA_GERACAO.noAtrasoMs + extra,
    nome: RITMO_DA_GERACAO.nomeAtrasoMs + extra,
    cenario: RITMO_DA_GERACAO.cenarioAtrasoMs + extra,
    espera: RITMO_DA_GERACAO.esperaAtrasoMs + extra,
  };
}

/** A rolagem que deixa o centro da vaga a 60% da altura do mapa (a parte visível abaixo da faixa presa no alto). */
export function rolagemDaVaga(centro: number, visivel: number, coberto: number) {
  const mapa = Math.max(0, visivel - coberto);
  return Math.max(0, Math.round(centro - coberto - mapa * RITMO_DA_GERACAO.posicaoDaVaga));
}

/**
 * A pessoa rolou para cima mais de 40 px desde o ponto mais baixo em que a tela acompanhava: a tela para de acompanhar.
 * Rolar para baixo nunca para.
 */
export function deixouDeAcompanhar(rolado: number, maisBaixo: number) {
  return rolado < maisBaixo - RITMO_DA_GERACAO.pararAcimaDe;
}

/** O centro da lição nova está no mapa visível (abaixo da faixa e acima do rodapé): rolando até ela, a tela volta a acompanhar. */
export function vagaAVista(centro: number, rolado: number, visivel: number, coberto: number) {
  return centro >= rolado + coberto && centro <= rolado + visivel;
}

/** "Mais uma!" aparece no máximo a cada três lições: na 3ª, na 6ª, na 9ª… */
export function comMaisUma(numero: number) {
  return numero > 0 && numero % RITMO_DA_GERACAO.maisUmaACada === 0;
}
