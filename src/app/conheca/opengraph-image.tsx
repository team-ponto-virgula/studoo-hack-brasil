import { TAMANHO_OG } from '@/servidor/og/base';
import { imagemDaApresentacao } from '@/servidor/og/apresentacao';
import { CAPTURAS } from './imagens.gerado';
import { textos } from './textos';

/** A prévia do link da página de apresentação (spec 18, seção 3): o herói. A mesma imagem para todo mundo, gerada uma vez no build, sem banco e sem limitador. */
export const runtime = 'nodejs';
export const size = TAMANHO_OG;
export const contentType = 'image/png';
export const alt = 'Studoo: aprenda qualquer coisa, uma lição por vez';

/** A frase do subtítulo do herói (spec 18) que cabe na imagem: a segunda, inteira. O título, em duas linhas, uma por frase. */
const LINHA = textos.heroi.subtitulo.split('. ').slice(-1)[0];
const LINHAS_DO_TITULO = textos.heroi.titulo.split('. ').map((parte, i, todas) => (i < todas.length - 1 ? `${parte}.` : parte));

export default async function Imagem() {
  const tela = CAPTURAS['heroi-2'];
  return imagemDaApresentacao({ linhasDoTitulo: LINHAS_DO_TITULO, linha: LINHA, telaDoCelular: tela.src2x, plataforma: tela.plataforma, larguraDaTela: tela.largura, alturaDaTela: tela.altura });
}
