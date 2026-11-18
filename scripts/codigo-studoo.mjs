// Código Studoo: gera o PNG do código (com a margem de silêncio) ou o cartão 1080×1350.
// Uso: npm run codigo:studoo -- "<texto>" --saida <arquivo.png> [--estilo rosto|trilha|capim] [--cor azul] [--cartao]
//   (ou: node --import tsx scripts/codigo-studoo.mjs ...)
// Tudo local: nenhum serviço externo de QR (links de trilha são privados).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// As fontes da marca (Quicksand e Nunito, em public/marca) entram no fontconfig antes de o sharp carregar.
process.env.FONTCONFIG_FILE ??= resolve(raiz, 'scripts/fontes-studoo.conf');
const { default: sharp } = await import('sharp');
const { geometriaCodigoStudoo, svgCodigoStudoo, CORES_CODIGO_PADRAO, FUNDO_DA_COR } = await import('../packages/contratos/src/aprendizado.ts');

const TITULO = 'Studoo no seu iPhone';
const DICA = 'Aponte a câmera e toque em Abrir no Expo Go';
const logo = /href="(data:image\/png;base64,[^"]+)"/.exec(readFileSync(resolve(raiz, 'public/marca/logo-com-sorriso.svg'), 'utf8'))[1];

/** Cores do código: dados e anéis escuros; o miolo dos olhos na cor do perfil (azul por padrão). */
export function coresDoCodigo(cor = 'azul') {
  return { ...CORES_CODIGO_PADRAO, miolo: FUNDO_DA_COR[cor] ?? FUNDO_DA_COR.azul };
}

/** SVG do código sozinho, `tamanho` px, fundo branco com a margem de silêncio. */
export function svgDoCodigo(texto, { estilo = 'rosto', cor = 'azul', tamanho = 1200 } = {}) {
  return svgCodigoStudoo(geometriaCodigoStudoo(texto, { estilo }), { tamanho, cores: coresDoCodigo(cor) });
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Cartão 1080×1350: título, o código num quadro com a cara de cada direção, a dica e a marca. */
export function svgDoCartao(texto, { estilo = 'rosto', cor = 'azul' } = {}) {
  const L = 1080;
  const A = 1350;
  const lado = 720;
  const x = (L - lado) / 2;
  const y = 300;
  const codigo = svgDoCodigo(texto, { estilo, cor, tamanho: lado }).replace('<svg ', `<svg x="${x}" y="${y}" `);
  const titulo = `<text x="${L / 2}" y="190" text-anchor="middle" font-family="Quicksand" font-weight="700" font-size="68" fill="#1b2a5e">${esc(TITULO)}</text>`;
  const dica = `<text x="${L / 2}" y="${y + lado + 120}" text-anchor="middle" font-family="Nunito" font-weight="700" font-size="36" fill="#1b2a5e">${esc(DICA)}</text>`;
  const marca = `<image href="${logo}" x="${L / 2 - 140}" y="${A - 150}" width="280" height="92"/>`;
  let fundo = '';
  let quadro = '';
  if (estilo === 'rosto') {
    // O código dentro do ícone do app: quadrado arredondado azul, com o branco do código como "rosto".
    fundo = `<rect width="${L}" height="${A}" fill="#eef3ff"/>`;
    // O branco interno é maior que o código: os cantos do fundo dele nunca encostam no azul.
    quadro = `<rect x="${x - 80}" y="${y - 80}" width="${lado + 160}" height="${lado + 160}" rx="150" fill="#3858d6"/>`
      + `<rect x="${x - 44}" y="${y - 44}" width="${lado + 88}" height="${lado + 88}" rx="112" fill="#fff"/>`
      + `<circle cx="${x + lado + 62}" cy="${y - 62}" r="20" fill="#ffd166"/>`;
  } else if (estilo === 'trilha') {
    // Clima do mapa: céu, nuvens discretas e o caminho pontilhado que chega à bandeira.
    const nuvem = (cx, cy, s) => `<g fill="#fff" opacity="0.95"><ellipse cx="${cx}" cy="${cy}" rx="${70 * s}" ry="${26 * s}"/><ellipse cx="${cx - 36 * s}" cy="${cy - 14 * s}" rx="${34 * s}" ry="${28 * s}"/><ellipse cx="${cx + 22 * s}" cy="${cy - 24 * s}" rx="${40 * s}" ry="${34 * s}"/></g>`;
    fundo = `<defs><linearGradient id="ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dce8ff"/><stop offset="1" stop-color="#eef3ff"/></linearGradient></defs><rect width="${L}" height="${A}" fill="url(#ceu)"/>`
      + nuvem(150, 300, 1) + nuvem(930, 250, 0.8) + nuvem(960, 1120, 0.9)
      // A trilha desce pela esquerda do cartão, passa por baixo dele e chega à bandeira.
      + `<path d="M108 330 C 62 560, 132 800, 100 990 S 150 1068 300 1068 L 900 1068 L 906 1018" fill="none" stroke="#3858d6" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 22"/>`;
    quadro = `<rect x="${x - 34}" y="${y - 34}" width="${lado + 68}" height="${lado + 68}" rx="56" fill="#fff" stroke="#c9d6f7" stroke-width="4"/>`
      + `<g transform="translate(${x + lado + 6} ${y + lado - 10})"><path d="M0 0V-96" stroke="#1b2a5e" stroke-width="8" stroke-linecap="round"/><path d="M4 -96h58l-16 22 16 22H4z" fill="#ffd166" stroke="#1b2a5e" stroke-width="6" stroke-linejoin="round"/></g>`;
  } else {
    // Capim: o código como um campo de folhas, num cartão sobre colinas.
    fundo = `<rect width="${L}" height="${A}" fill="#eef3ff"/>`
      + `<path d="M0 1060 C 260 960, 520 1040, 760 980 S 1000 960, 1080 1000 V${A} H0Z" fill="#cfe8c4"/>`
      + `<path d="M0 1150 C 300 1080, 600 1170, 1080 1100 V${A} H0Z" fill="#b5dca6"/>`
      + `<circle cx="1000" cy="80" r="44" fill="#ffd166"/>`;
    quadro = `<rect x="${x - 34}" y="${y - 34}" width="${lado + 68}" height="${lado + 68}" rx="48" fill="#fff"/>`
      + `<rect x="${x - 34}" y="${y + lado + 20}" width="${lado + 68}" height="14" rx="7" fill="#3858d6" opacity="0.18"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${A}" viewBox="0 0 ${L} ${A}">${fundo}${quadro}${codigo}${titulo}${dica}${marca}</svg>`;
}

export async function pngDoCodigo(texto, opcoes = {}) {
  return sharp(Buffer.from(svgDoCodigo(texto, opcoes))).png().toBuffer();
}

export async function pngDoCartao(texto, opcoes = {}) {
  return sharp(Buffer.from(svgDoCartao(texto, opcoes))).png().toBuffer();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const valor = (nome, padrao) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : padrao; };
  const texto = args.find((a, i) => !a.startsWith('--') && !['--saida', '--estilo', '--cor'].includes(args[i - 1]));
  const saida = valor('--saida');
  if (!texto || !saida) {
    console.error('Uso: npm run codigo:studoo -- "<texto>" --saida <arquivo.png> [--estilo rosto|trilha|capim] [--cor azul] [--cartao]');
    process.exit(1);
  }
  const opcoes = { estilo: valor('--estilo', 'rosto'), cor: valor('--cor', 'azul') };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(saida, args.includes('--cartao') ? await pngDoCartao(texto, opcoes) : await pngDoCodigo(texto, opcoes));
  console.log(saida);
}
