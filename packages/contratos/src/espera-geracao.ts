/*
 * A espera da criação da trilha (spec 17, mudança 1, revista em 23/11). Depois de "Começar a lição 1", a criação leva de 12 a 21 s: o botão fica afundado, com o giro e "Criando sua trilha…"
 * (`mensagens.geracao.criandoTrilha`), e 1,5 s depois do toque entra embaixo dele a linha "Escrevendo suas lições…" (`mensagens.geracao.escrevendoLicoes`). Três segundos depois de aparecer,
 * a MESMA linha troca para as frases de `mensagens.geracao.dicas` e, a cada 5 s, para a seguinte, em laço, com o efeito de aparecer e sumir em 300 ms (com movimento reduzido, a troca é
 * imediata). A placa "Montando sua trilha" da geração da proposta (uns 3 s) não usa as frases.
 * A conta é pura e igual na web e no app: cada cliente passa o tempo que o relógio dele mediu desde que a LINHA apareceu (1,5 s depois do toque, não desde o toque) e desenha o que ela devolve.
 */

export const ESPERA_DA_GERACAO = {
  /** Os primeiros segundos da linha, em que ela ainda diz "Escrevendo suas lições…". */
  antesDaPrimeiraMs: 3000,
  /** Cada frase fica na linha este tempo, até a troca (inclui o efeito). */
  trocaACadaMs: 5000,
  /** Aparecer e sumir: a frase some e a próxima aparece em 300 ms no total (150 ms cada metade). Com movimento reduzido, 0. */
  efeitoMs: 300,
} as const;

/**
 * Qual frase mostrar `decorridoMs` depois que a linha apareceu: `null` nos 3 primeiros segundos (vale "Escrevendo suas lições…"); depois, o índice da frase (0 a `total` - 1),
 * mudando a cada 5 s e voltando à primeira depois da última. Tempo inválido ou negativo conta como o começo; sem frases, nunca há troca.
 */
export function dicaDaEspera(decorridoMs: number, total: number): number | null {
  if (!Number.isInteger(total) || total <= 0) return null;
  if (!Number.isFinite(decorridoMs) || decorridoMs < ESPERA_DA_GERACAO.antesDaPrimeiraMs) return null;
  return Math.floor((decorridoMs - ESPERA_DA_GERACAO.antesDaPrimeiraMs) / ESPERA_DA_GERACAO.trocaACadaMs) % total;
}

/** Quanto falta, em ms, para a próxima troca (do texto de sempre para a 1ª frase ou de uma frase para a seguinte): o relógio do cliente dorme exatamente isso, sem acordar a cada quadro. */
export function faltaParaTrocarADica(decorridoMs: number): number {
  const { antesDaPrimeiraMs: antes, trocaACadaMs: troca } = ESPERA_DA_GERACAO;
  const agora = Number.isFinite(decorridoMs) && decorridoMs > 0 ? decorridoMs : 0;
  if (agora < antes) return antes - agora;
  return troca - ((agora - antes) % troca);
}

/*
 * Obsoletos (revisão de 23/11). Na versão de 22/11 a criação da trilha tinha uma lista própria de frases, porque a "Você confere a trilha antes de começar." ficava de fora dela. Essa frase
 * saiu de `mensagens.geracao.dicas`, que agora só tem as três que valem, e a criação usa `dicaDaEspera` e `faltaParaTrocarADica` como a espera de qualquer outra tela. Os três nomes abaixo
 * continuam exportados, com os índices das três frases, só para as versões do app que ainda os leem não quebrarem.
 */

/** @deprecated Use `dicaDaEspera(decorridoMs, mensagens.geracao.dicas.length)`. Agora são os três índices das três frases. */
export const DICAS_DA_ESPERA_LONGA = [0, 1, 2] as const;

/** @deprecated Use `dicaDaEspera(decorridoMs, mensagens.geracao.dicas.length)`, contando o tempo desde que a linha "Escrevendo suas lições…" aparece. */
export function dicaDaEsperaLonga(decorridoMs: number): number | null {
  const posicao = dicaDaEspera(decorridoMs, DICAS_DA_ESPERA_LONGA.length);
  return posicao === null ? null : DICAS_DA_ESPERA_LONGA[posicao];
}

/** @deprecated Use `faltaParaTrocarADica`. */
export const faltaParaTrocarADicaLonga = faltaParaTrocarADica;
