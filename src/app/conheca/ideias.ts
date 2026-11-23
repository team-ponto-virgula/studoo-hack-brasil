import type { NomeDesenho } from '../../ui/mundo-desenhos';

/*
 * As seis ideias da tela inicial (spec 18, S3), na ordem do app, e o ícone de cada uma: o da área de onde a ideia veio, como em
 * `pedido.tsx`. Ficam aqui, e não lidas do contrato em tempo de execução, para a página não carregar `pedido.tsx` (que arrasta o
 * estúdio inteiro); `tests/conheca-pagina.test.mjs` confere que são as mesmas do contrato e que os ícones batem com os do app.
 */
export const IDEIAS_DO_S3 = [
  'Violão do zero: primeiros acordes',
  'Inglês para conversar em viagens',
  'Culinária: receitas básicas',
  'História do Brasil para a prova',
  'Frações',
  'Fotografia com o celular',
] as const;

const ICONES: Record<(typeof IDEIAS_DO_S3)[number], NomeDesenho> = {
  'Violão do zero: primeiros acordes': 'temaMusica',
  'Inglês para conversar em viagens': 'temaIdiomas',
  'Culinária: receitas básicas': 'temaDiaADia',
  'História do Brasil para a prova': 'temaPopulares',
  Frações: 'temaMatematica',
  'Fotografia com o celular': 'temaArtes',
};

export const iconeDaIdeia = (ideia: (typeof IDEIAS_DO_S3)[number]): NomeDesenho => ICONES[ideia];
