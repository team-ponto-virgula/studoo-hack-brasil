/*
 * Troca de tela com direção, igual na web e no app. A tela nova entra pelo lado de quem avança: abrir uma trilha, uma lição
 * ou a conclusão desliza da direita; voltar ao mapa ou a Minhas trilhas desliza da esquerda; entre as abas, o lado segue a
 * ordem da barra (Minhas trilhas, Nova trilha, Explorar, Perfil). A web anima com View Transitions e o app, com a entrada da
 * Tela. A geração ao vivo e a passagem da trilha criada para a lição 1 têm animações próprias: nelas não há troca animada.
 * Com movimento reduzido, nenhuma das duas plataformas anima.
 */

export type DirecaoDaTroca = 'avancar' | 'voltar' | 'trocar';

/** As abas, na ordem da barra de baixo e do menu lateral. */
export const ABAS_DA_TROCA = ['planos', 'objetivo', 'explorar', 'perfil'] as const;

/**
 * Quão "fundo" cada tela fica na navegação: as abas no 0, o que se abre a partir delas no 1 e assim por diante. A tela nova
 * mais funda avança; a mais rasa volta.
 */
const PROFUNDIDADE: Record<string, number> = {
  planos: 0,
  objetivo: 0,
  explorar: 0,
  perfil: 0,
  apresentacao: 1,
  diagnostico: 1,
  plano: 1,
  perfilPublico: 1,
  previaTrilha: 1,
  configuracoes: 2,
  licao: 2,
  concluida: 3,
};

/** Telas com animação própria na entrada ou na saída: a troca para elas, ou a partir delas, não ganha outra animação. */
const COM_ANIMACAO_PROPRIA = new Set(['geracao', 'abrindo-criada']);

/**
 * A direção da troca da tela `de` para a tela `para` (os tipos de tela da web e do app). `null` quando não há troca animada:
 * a mesma tela, uma tela desconhecida ou uma das que têm animação própria. A lição seguinte, aberta da conclusão, avança.
 */
export function direcaoDaTroca(de: string | null | undefined, para: string): DirecaoDaTroca | null {
  if (!de || de === para || COM_ANIMACAO_PROPRIA.has(de) || COM_ANIMACAO_PROPRIA.has(para)) return null;
  const origem = PROFUNDIDADE[de];
  const destino = PROFUNDIDADE[para];
  if (origem === undefined || destino === undefined) return null;
  if (de === 'concluida' && para === 'licao') return 'avancar';
  if (destino > origem) return 'avancar';
  if (destino < origem) return 'voltar';
  const abaDe = (ABAS_DA_TROCA as readonly string[]).indexOf(de);
  const abaPara = (ABAS_DA_TROCA as readonly string[]).indexOf(para);
  if (abaDe >= 0 && abaPara >= 0) return abaPara > abaDe ? 'avancar' : 'voltar';
  return 'trocar';
}

/** Tempos da troca, iguais nas duas plataformas: a tela que sai some rápido e a que entra chega com calma. */
export const TEMPOS_DA_TROCA = {
  saidaMs: 180,
  entradaMs: 300,
  /** Quanto a tela anda na horizontal ao entrar ou sair, em px. */
  deslocamento: 28,
} as const;
