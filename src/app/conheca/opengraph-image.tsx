import { TAMANHO_OG } from '@/servidor/og/base';
import { imagemDaApresentacao } from '@/servidor/og/apresentacao';
import { telasDoHeroi } from './heroi';
import { linhasDoTitulo, textos } from './textos';

/** A prévia do link da página de apresentação (spec 18, seção 3): o herói. A mesma imagem para todo mundo, gerada uma vez no build, sem banco e sem limitador. */
export const runtime = 'nodejs';
export const size = TAMANHO_OG;
export const contentType = 'image/png';
export const alt = textos.pagina.titulo;

/** O cartão usa a mesma quebra de título e uma frase completa da apresentação. */
const LINHA = textos.heroi.subtitulo.split('. ').slice(-1)[0];

export default async function Imagem() {
  // A trilha pronta (a segunda tela do herói) do conjunto do iPhone, que é o dos aparelhos que não são Android.
  const tela = telasDoHeroi('computador')[1].captura;
  return imagemDaApresentacao({ linhasDoTitulo, linha: LINHA, telaDoCelular: tela.src2x, plataforma: tela.plataforma, larguraDaTela: tela.largura, alturaDaTela: tela.altura });
}
