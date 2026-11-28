/*
 * Esperas vivas: o que a pessoa vê enquanto o Stu trabalha numa ação que leva alguns segundos (ler o material, montar a
 * ponte, comentar a explicação, transcrever a gravação, conferir a resposta, preparar a pergunta do diagnóstico). Igual na
 * web e no app: depois de um instante (para uma resposta rápida não piscar nada), o Stu concentrado aparece com uma frase
 * que diz o que ele está fazendo; a frase avança a cada poucos segundos e para na última. Se passar de 15 s, a linha avisa
 * que está levando mais que o normal. As frases descrevem o trabalho de verdade, sem número nem promessa de tempo.
 * Com movimento reduzido, o Stu fica parado e a frase troca sem efeito. O leitor de tela ouve só a primeira frase, uma vez.
 */

export type MotivoDaEspera = 'material' | 'proposta' | 'ponte' | 'ensino' | 'transcricao' | 'correcao' | 'diagnostico';

export const ESPERA_VIVA = {
  /** Uma resposta mais rápida que isso não mostra nada. */
  aparecerMs: 400,
  /** Cada frase fica na linha este tempo. */
  trocaACadaMs: 3500,
  /** Depois disso, a linha diz que está levando mais que o normal. */
  demoradaMs: 15000,
  /** A frase some e a próxima aparece em 300 ms no total. Com movimento reduzido, 0. */
  efeitoMs: 300,
} as const;

/**
 * O que mostrar `decorridoMs` depois que a espera começou (o toque, não a aparição): `null` antes de `aparecerMs`; o índice
 * da frase da vez, que avança a cada `trocaACadaMs` e para na última; `'demorada'` depois de `demoradaMs`.
 * Tempo inválido ou negativo conta como o começo.
 */
export function estadoDaEsperaViva(decorridoMs: number, totalDeFrases: number): number | 'demorada' | null {
  const agora = Number.isFinite(decorridoMs) && decorridoMs > 0 ? decorridoMs : 0;
  if (agora < ESPERA_VIVA.aparecerMs) return null;
  if (agora >= ESPERA_VIVA.demoradaMs) return 'demorada';
  if (!Number.isInteger(totalDeFrases) || totalDeFrases <= 0) return 0;
  const vez = Math.floor((agora - ESPERA_VIVA.aparecerMs) / ESPERA_VIVA.trocaACadaMs);
  return Math.min(vez, totalDeFrases - 1);
}

/** Quanto falta, em ms, para o estado mudar (aparecer, a próxima frase ou o aviso de demora); `null` quando não muda mais. */
export function faltaParaMudarAEspera(decorridoMs: number, totalDeFrases: number): number | null {
  const agora = Number.isFinite(decorridoMs) && decorridoMs > 0 ? decorridoMs : 0;
  const { aparecerMs, trocaACadaMs, demoradaMs } = ESPERA_VIVA;
  if (agora < aparecerMs) return aparecerMs - agora;
  if (agora >= demoradaMs) return null;
  const total = Number.isInteger(totalDeFrases) && totalDeFrases > 0 ? totalDeFrases : 1;
  const vez = Math.floor((agora - aparecerMs) / trocaACadaMs);
  // Na última frase, a próxima mudança é o aviso de demora.
  if (vez >= total - 1) return demoradaMs - agora;
  return Math.min(aparecerMs + (vez + 1) * trocaACadaMs, demoradaMs) - agora;
}
