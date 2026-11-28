/*
 * As capturas do app que a página usa (spec 18, seção 9), em AVIF (e WebP de reserva) com largura e altura declaradas (nada pula na carga). O arquivo
 * `imagens.gerado.ts` é escrito por `scripts/otimizar-capturas-landing.mjs` a partir das capturas nativas do build 4 (Mobile & QA);
 * aqui só estão o tipo e o jeito de desenhar.
 */
export type Plataforma = 'iphone' | 'android';
/** `web`: a captura REAL do site no computador, para a janela de navegador do momento 4 (nunca dentro de uma moldura de celular). */
export type OrigemDaCaptura = Plataforma | 'web';

export interface CapturaOtimizada {
  /** De que sistema é a captura: a moldura do celular segue (ilha no iPhone, ponto de câmera no Android); `web` vai na janela do navegador. */
  plataforma: OrigemDaCaptura;
  /** Provisória até a rodada limpa do Mobile & QA; a troca é só de arquivo. */
  provisoria: boolean;
  /** WebP de 1x (`largura` de largura) e de 2x (o dobro), para quem não lê AVIF; também a foto da imagem de compartilhar. */
  src1x: string;
  src2x: string;
  /** AVIF em três larguras (o navegador escolhe pelo `sizes` do lugar e pela densidade da tela): o que os navegadores de hoje baixam, cerca de 40% menor que o WebP. */
  avif: readonly { src: string; largura: number }[];
  /** Largura e altura do arquivo 1x: reservam o lugar antes de carregar. A altura segue a proporção da própria captura (nada é esticado). */
  largura: number;
  altura: number;
  /** De onde veio a captura (aparelho e build), para a conferência. */
  origem: string;
}
