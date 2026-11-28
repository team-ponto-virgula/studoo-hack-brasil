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

const FICHAS: Record<(typeof IDEIAS_DO_S3)[number], { icone: NomeDesenho; nome: string }> = {
  'Violão do zero: primeiros acordes': { icone: 'temaMusica', nome: 'Violão' },
  'Inglês para conversar em viagens': { icone: 'temaIdiomas', nome: 'Inglês' },
  'Culinária: receitas básicas': { icone: 'temaDiaADia', nome: 'Culinária' },
  'História do Brasil para a prova': { icone: 'temaPopulares', nome: 'História' },
  Frações: { icone: 'temaMatematica', nome: 'Frações' },
  'Fotografia com o celular': { icone: 'temaArtes', nome: 'Fotografia' },
};

export const fichaDaIdeia = (ideia: (typeof IDEIAS_DO_S3)[number]) => FICHAS[ideia];
