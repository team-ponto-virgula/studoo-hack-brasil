import { mensagens } from './mensagens';
import type { NomeDesenho } from './mundo-desenhos';

/*
 * Áreas de interesse do pedido (idiomas, música, matemática…) e os ícones delas, como na web (src/app/pedido.tsx).
 * Ficam aqui para o pedido e a apresentação usarem os mesmos.
 */

export type Tema = (typeof mensagens.pedido.temas)[number];
export type IdTema = Tema['id'];

/** Ícone de cada área de interesse, com os mesmos desenhos da web. */
export const iconesDosTemas: Record<IdTema, NomeDesenho> = {
  populares: 'temaPopulares',
  idiomas: 'temaIdiomas',
  musica: 'temaMusica',
  matematica: 'temaMatematica',
  ciencias: 'temaCiencias',
  tecnologia: 'temaTecnologia',
  artes: 'temaArtes',
  carreira: 'temaCarreira',
  'dia-a-dia': 'temaDiaADia',
};

/** Área de um exemplo: em Populares, cada exemplo mostra o ícone da área de onde veio. */
export function iconeDoExemplo(tema: Tema, exemplo: string): NomeDesenho {
  if (tema.id !== 'populares') return iconesDosTemas[tema.id];
  const origem = mensagens.pedido.temas.find((item) => item.id !== 'populares' && (item.exemplos as readonly string[]).includes(exemplo));
  return iconesDosTemas[origem?.id ?? 'populares'];
}

export const todosOsExemplos = Array.from(new Set(mensagens.pedido.temas.flatMap((tema) => tema.exemplos as readonly string[])));
