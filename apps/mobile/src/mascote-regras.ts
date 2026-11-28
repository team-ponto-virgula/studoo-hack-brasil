/**
 * Regras do Stu que não dependem de tela (spec 13; correção do iPhone, 20/11). Na primeira execução nativa, o WebP animado
 * "carregou" (`onLoad`) mas não desenhou nada no Expo Go do iPhone, e a imagem parada, que saía no `onLoad`, sumiu junto: só
 * a sombra ficava. A regra agora: a parada só sai quando a animada já desenhou na tela (`onDisplay`); até lá, e se a animada
 * falhar ou não desenhar a tempo, a parada fica. Nunca as duas escondidas.
 */

/** Quanto a animada tem para desenhar depois de pedida; passou disso, o Stu fica com a imagem parada. */
export const ESPERA_DESENHO_MS = 3000;

/**
 * A opacidade de cada camada: a parada fica (1) até a animada estar na tela e já ter desenhado; aí troca, de uma vez, sem
 * animação (os dois começam na mesma pose).
 */
export function camadasDoStu(mostrar: boolean, desenhada: boolean): { parada: 0 | 1; animada: 0 | 1 } {
  const animadaNaTela = mostrar && desenhada;
  return { parada: animadaNaTela ? 0 : 1, animada: animadaNaTela ? 1 : 0 };
}

/** O pop da §B7 dura 240 ms; se o fim dele não chegar (a animação nativa perdida), o Stu aparece inteiro mesmo assim. */
export const GARANTIA_DO_POP_MS = 240 + 400;
