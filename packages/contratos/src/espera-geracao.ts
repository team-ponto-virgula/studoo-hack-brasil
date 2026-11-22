/*
 * A espera da geração que se acompanha (spec 17, mudança 1). A placa do alto diz "Montando sua trilha" (`mensagens.geracao.montandoTitulo`) nos 3 primeiros segundos e
 * depois troca, a cada 5 s, entre as frases de `mensagens.geracao.dicas`, em laço, com o efeito de aparecer e sumir em 300 ms (com movimento reduzido, a troca é imediata).
 * A conta é pura e igual na web e no app: cada cliente só passa o tempo que o relógio dele mediu desde que a espera começou e desenha o que ela devolve.
 */

export const ESPERA_DA_GERACAO = {
  /** Os primeiros segundos, em que a placa ainda diz "Montando sua trilha". */
  antesDaPrimeiraMs: 3000,
  /** Cada frase fica na placa este tempo, até a troca (inclui o efeito). */
  trocaACadaMs: 5000,
  /** Aparecer e sumir: a frase some e a próxima aparece em 300 ms no total (150 ms cada metade). Com movimento reduzido, 0. */
  efeitoMs: 300,
} as const;

/**
 * Qual frase mostrar `decorridoMs` depois que a espera começou: `null` nos 3 primeiros segundos (vale "Montando sua trilha"); depois, o índice da frase (0 a `total` - 1),
 * mudando a cada 5 s e voltando à primeira depois da última. Tempo inválido ou negativo conta como o começo; sem frases, nunca há troca.
 */
export function dicaDaEspera(decorridoMs: number, total: number): number | null {
  if (!Number.isInteger(total) || total <= 0) return null;
  if (!Number.isFinite(decorridoMs) || decorridoMs < ESPERA_DA_GERACAO.antesDaPrimeiraMs) return null;
  return Math.floor((decorridoMs - ESPERA_DA_GERACAO.antesDaPrimeiraMs) / ESPERA_DA_GERACAO.trocaACadaMs) % total;
}

/** Quanto falta, em ms, para a próxima troca (da placa para a 1ª frase ou de uma frase para a seguinte): o relógio do cliente dorme exatamente isso, sem acordar a cada quadro. */
export function faltaParaTrocarADica(decorridoMs: number): number {
  const { antesDaPrimeiraMs: antes, trocaACadaMs: troca } = ESPERA_DA_GERACAO;
  const agora = Number.isFinite(decorridoMs) && decorridoMs > 0 ? decorridoMs : 0;
  if (agora < antes) return antes - agora;
  return troca - ((agora - antes) % troca);
}
