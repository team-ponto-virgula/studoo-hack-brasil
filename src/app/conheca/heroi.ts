import type { Aparelho } from './aparelho';
import { CAPTURAS } from './imagens.gerado';
import type { CapturaOtimizada, Plataforma } from './imagens';

/**
 * As três telas do começo do app (pedir, trilha pronta e acerto), nas capturas `heroi-N`. A página mostra a segunda, a trilha pronta, na parada dos
 * assuntos, e a imagem de compartilhar usa a mesma; as outras duas continuam no conjunto do Mobile & QA. Os `alt` são os da spec 18, seção 9.
 */
export const ALTS_DO_HEROI = [
  'Tela do Studoo perguntando o que você quer aprender',
  'Tela do Studoo com a trilha pronta',
  'Lição do Studoo com a resposta certa e o Stu comemorando',
] as const;

/** Uma captura nativa (de iPhone ou de Android), a que cabe numa moldura de celular. */
export type CapturaDeCelular = CapturaOtimizada & { plataforma: Plataforma };
export interface TelaDoHeroi { captura: CapturaDeCelular; alt: string }

const ehDeCelular = (captura: CapturaOtimizada | undefined): captura is CapturaDeCelular => captura !== undefined && captura.plataforma !== 'web';

/**
 * As três telas do herói para o aparelho de quem abre (spec 18, seção 9): um celular nunca mistura iPhone e Android (a hora e os ícones mudariam entre uma tela e outra).
 * Quem abre no Android vê as três do Android; os outros veem as três do iPhone. A rodada limpa do Mobile & QA traz `heroi-1-iphone`, `heroi-1-android` (e o 2 e o 3
 * do mesmo jeito) em `scripts/capturas-landing.json`; enquanto elas não existem, vale o conjunto provisório `heroi-N`, que mistura as plataformas. A troca é só de arquivo.
 */
export function escolherTelasDoHeroi(capturas: Readonly<Record<string, CapturaOtimizada>>, aparelho: Aparelho): TelaDoHeroi[] {
  const plataforma: Plataforma = aparelho === 'android' ? 'android' : 'iphone';
  return ALTS_DO_HEROI.map((alt, indice) => {
    const captura = capturas[`heroi-${indice + 1}-${plataforma}`] ?? capturas[`heroi-${indice + 1}`];
    if (!ehDeCelular(captura)) throw new Error(`Falta a captura ${indice + 1} do herói (${plataforma}) em scripts/capturas-landing.json.`);
    return { captura, alt };
  });
}

export const telasDoHeroi = (aparelho: Aparelho): TelaDoHeroi[] => escolherTelasDoHeroi(CAPTURAS, aparelho);
