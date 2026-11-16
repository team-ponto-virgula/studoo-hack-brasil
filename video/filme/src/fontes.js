import { continueRender, delayRender, staticFile } from 'remotion';

// Quicksand (títulos) e Nunito (texto): as fontes do Studoo, com as licenças OFL do repositório.
const FONTES = [
  ['Quicksand', 'fontes/Quicksand.ttf', '300 700'],
  ['Nunito', 'fontes/Nunito.ttf', '200 1000'],
];
let pedido = false;

/** Carrega as fontes antes do primeiro quadro (a renderização espera). */
export function carregarFontes() {
  if (pedido || typeof document === 'undefined') return;
  pedido = true;
  const espera = delayRender('fontes do Studoo');
  Promise.all(FONTES.map(([familia, arquivo, peso]) => {
    const fonte = new FontFace(familia, `url(${staticFile(arquivo)})`, { weight: peso });
    return fonte.load().then((carregada) => document.fonts.add(carregada));
  })).then(() => continueRender(espera)).catch((erro) => { console.error('fonte', erro); continueRender(espera); });
}
