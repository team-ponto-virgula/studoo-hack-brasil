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
  /** 320 ms: o nó cai 26 px e pula (0,7 → 1,08 → 1 em 380 ms), com o contorno do rascunho; o anel fica azul por 1,2 s. */
  noAtrasoMs: 320,
  noQueda: 26,
  noMs: 380,
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
  /** Rolar para cima mais que isto para de acompanhar. */
  pararAcimaDe: 40,
  /** A pílula "Ver a lição nova" fica 16 px acima do rodapé. */
  pilulaAcimaDoRodape: 16,
  /** O fim da proposta: troféu (0 → 1,1 → 1 em 420 ms), sem confete e sem som, e o rodapé que desliza 12 px em 220 ms. */
  trofeuMs: 420,
  rodapeDeslize: 12,
  rodapeMs: 220,
  /** Sem lição nova por 12 s, a placa diz que ainda está escrevendo. */
  esperaLongaMs: 12000,
  /** Movimento reduzido: nó, nome e cenário aparecem juntos, com 150 ms de opacidade. */
  reduzidoMs: 150,
  /** O rascunho da prévia: traços de 8 com vãos de 8 (pontas redondas de 5 px, como o stroke-linecap da web). */
  tracejadoPx: 8,
  tracejadoEspessura: 5,
  /** `geracao_licao` no pouso do nó, no máximo um a cada 400 ms (spec 12). */
  somDaLicaoMinimoMs: 400,
  /**
   * Criar a trilha (spec 04): o toque muda o botão na hora; "Ajustar pedido" sai em 200 ms; se o nó 1 não está à vista, a
   * prévia rola até ele em 240 ms; a linha da espera aparece depois de 1,5 s sem resposta do aceite.
   */
  ajustarSaiMs: 200,
  rolarAteNo1Ms: 240,
  esperaRealMs: 1500,
  /** O anel do nó 1 respira enquanto a trilha é criada (1,1 s por volta). */
  respiroMs: 1100,
  /**
   * A passagem (o aceite voltou): t = 0, o som e o pulso do nó 1 (1 → 1,12 → 1, 180 ms), e o caminho firma (180 ms); t = 120,
   * o círculo cresce do nó 1 até cobrir a tela (300 ms); t = 320, a aula entra por cima (150 ms). Total: 470 ms.
   */
  pulsoMs: 180,
  firmarMs: 180,
  circuloAtrasoMs: 120,
  circuloMs: 300,
  aulaEntraMs: 320,
  aulaOpacidadeMs: 150,
  /**
   * A aula monta embaixo do círculo aos 200 ms (ele já cobre quase toda a tela aos 300), para estar pronta quando entra por
   * cima, aos 320: a camada só some depois que a aula (ou o esqueleto) está na tela, e a prévia nunca reaparece por baixo.
   */
  aulaMontaMs: 200,
  /** No t = 0 da passagem, a placa "Proposta pronta" sai (opacidade e 8 px para cima, 150 ms): a proposta virou trilha. */
  placaSaiMs: 150,
  placaSaiDeslize: 8,
  /**
   * A rolagem do toque mira a área livre, entre a base da placa presa (62 px do alto da rolagem, mais a altura dela) e o topo
   * do rodapé: o centro do nó 1 a 40% dela, com a lente e o Stu (até 52 px acima do centro) e o nome (até 112 abaixo) inteiros.
   */
  placaTopo: 62,
  no1NaAreaLivre: 0.4,
  no1AcimaDoCentro: 52,
  no1AbaixoDoCentro: 112,
  /**
   * A proposta ficou pronta (spec 16, item 1): a tela rola em 600 ms, com saída suave, até o centro do nó 1 ficar no meio da
   * área livre (entre a base da placa presa e o topo do rodapé), com o Stu feliz ao lado. O troféu fica a uma rolagem.
   */
  prontaAteNo1Ms: 600,
} as const;

/** Onde a rolagem para na proposta pronta: o centro do nó 1 no meio da área livre, sem rolar antes do começo. */
export function rolagemDaTrilhaPronta(centro: number, visivel: number, topoLivre: number) {
  return Math.max(0, Math.round(centro - (topoLivre + (visivel - topoLivre) / 2)));
}

/** Quando a passagem termina (a aula já está por inteiro na tela): 470 ms; com movimento reduzido, só a opacidade (150 ms). */
export function fimDaPassagem(reduzir: boolean) {
  return reduzir ? RITMO_DA_GERACAO.aulaOpacidadeMs : RITMO_DA_GERACAO.aulaEntraMs + RITMO_DA_GERACAO.aulaOpacidadeMs;
}

/** O raio que cobre a tela inteira a partir do ponto (x, y): até o canto mais longe. */
export function raioQueCobre(x: number, y: number, largura: number, altura: number) {
  return Math.ceil(Math.hypot(Math.max(x, largura - x), Math.max(y, altura - y)));
}

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
