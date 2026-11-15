import type { ExercicioPublico, LicaoDetalhe, TipoTrecho } from './aprendizado';

/*
 * Regras da aula compartilhadas pela web e pelo app: as etapas de cada lição, o formato das respostas e o visual do
 * trecho quando o conteúdo não diz. Cada cliente desenha do seu jeito; a sequência e os dados são os mesmos.
 */

/** Uma etapa da aula: conceito e exemplo, de um a três exercícios e, quando a lição pede, a prática no mundo real. */
export type EtapaAula =
  | { tipo: 'conceito' }
  | { tipo: 'exemplo' }
  | { tipo: 'exercicio'; indice: number }
  | { tipo: 'pratica' };

/** Os exercícios da lição; uma lição salva antes dos exercícios extras tem só o principal. */
export function exerciciosDaLicao(licao: Pick<LicaoDetalhe, 'exercicio'> & Partial<Pick<LicaoDetalhe, 'exercicios'>>): ExercicioPublico[] {
  return Array.isArray(licao.exercicios) && licao.exercicios.length > 0 ? licao.exercicios : [licao.exercicio];
}

/** As etapas da lição, em ordem. O número de etapas muda de uma lição para outra. */
export function etapasDaLicao(licao: Pick<LicaoDetalhe, 'exercicio'> & Partial<Pick<LicaoDetalhe, 'exercicios' | 'pratica'>>): EtapaAula[] {
  return [
    { tipo: 'conceito' },
    { tipo: 'exemplo' },
    ...exerciciosDaLicao(licao).map((_, indice): EtapaAula => ({ tipo: 'exercicio', indice })),
    ...(licao.pratica ? [{ tipo: 'pratica' } as const] : []),
  ];
}

/** Monta a resposta de cada formato do jeito que o servidor confere. */
export const codificarResposta = {
  /** Ordenar: os ids na ordem escolhida. */
  ordem: (ids: readonly string[]) => ids.join(','),
  /** Associar: cada item da esquerda com o par escolhido na direita. */
  pares: (pares: readonly (readonly [string, string])[]) => pares.map(([esquerda, direita]) => `${esquerda}=${direita}`).join(','),
  /** Verdadeiro ou falso: o valor e a justificativa escolhida. */
  verdadeiroFalso: (verdadeiro: boolean, justificativa: string) => `${verdadeiro ? 'verdadeiro' : 'falso'}:${justificativa}`,
};

/** Tamanho máximo da resposta: a aberta é uma explicação; as outras são curtas. */
export const LIMITES_RESPOSTA = { curta: 300, aberta: 1000 } as const;

/**
 * Visual do trecho quando o conteúdo não informa (lições salvas antes dos tipos de trecho). Só vira código o que parece
 * código, como uma consulta SQL; o resto aparece como frase.
 */
export function inferirTipoTrecho(trecho: string): TipoTrecho {
  const texto = trecho.trim();
  const linhas = texto.split('\n').filter((linha) => linha.trim());
  if (linhas.length > 1 && linhas.every((linha) => /^\s*(?:\d+[.)]|[-•])\s+/.test(linha))) return 'passos';
  if (/;\s*$|\b(?:SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|CREATE|def|function|return|const|console|print)\b|[{}]|=>|==|<=|>=|!=/.test(texto)) {
    return 'codigo';
  }
  if (/^[“"«].*[”"»]$/s.test(texto)) return 'citacao';
  if (/^[\d\s+\-×*/÷=().,²³√π^xyabc_]+$/i.test(texto) && /[=+×*/÷^²³√]/.test(texto)) return 'formula';
  return 'frase';
}

/** Divide o texto nas lacunas (três ou mais sublinhados), para o app destacar o espaço da resposta. */
export function partesDaLacuna(texto: string): string[] {
  return texto.split(/_{3,}/);
}

/** Passos de um texto em linhas, sem a numeração que já vier nele (o app numera). */
export function linhasDePassos(texto: string): string[] {
  return texto
    .split('\n')
    .map((linha) => linha.replace(/^\s*(?:\d+[.)]|[-•])\s*/, '').trim())
    .filter(Boolean);
}
