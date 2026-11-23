/*
 * As capturas do app que a página usa (spec 18, seção 9), em WebP com largura e altura declaradas (nada pula na carga). O arquivo
 * `imagens.gerado.ts` é escrito por `scripts/otimizar-capturas-landing.mjs` a partir das capturas nativas do build 4 (Mobile & QA);
 * aqui só estão o tipo e o jeito de desenhar.
 */
export type Plataforma = 'iphone' | 'android';

export interface CapturaOtimizada {
  /** De que sistema é a captura: a moldura do celular segue (ilha no iPhone, ponto de câmera no Android). */
  plataforma: Plataforma;
  /** Provisória até a rodada limpa do Mobile & QA; a troca é só de arquivo. */
  provisoria: boolean;
  /** WebP em 1x e em 2x (o navegador escolhe pela densidade da tela). */
  src1x: string;
  src2x: string;
  /** Largura e altura do arquivo 1x: reservam o lugar antes de carregar. */
  largura: number;
  altura: number;
  /** De onde veio a captura (aparelho e build), para a conferência. */
  origem: string;
}
