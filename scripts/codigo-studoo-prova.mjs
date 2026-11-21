// Prova de leitura do Código Studoo: rasteriza e decodifica com dois leitores independentes (jsQR e ZXing) em vários
// tamanhos e degradações. O texto lido tem que ser idêntico. Uso: node --import tsx scripts/codigo-studoo-prova.mjs
// "<texto>" [--saida <pasta>] (escreve prova.json e prova.md na pasta).
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import jsQR from 'jsqr';
import zx from '@zxing/library';
import { pngDoCartao, pngDoCodigo } from './codigo-studoo.mjs';
const { default: sharp } = await import('sharp');
const { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } = zx;

async function rgba(entrada) {
  const { data, info } = await sharp(entrada).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
}

function lerJsqr({ data, w, h }) {
  return jsQR(data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

function lerZxing({ data, w, h }) {
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  const dicas = new Map([[DecodeHintType.TRY_HARDER, true]]);
  try {
    return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h))), dicas).getText();
  } catch {
    return null;
  }
}

/** As degradações, a partir do PNG grande. */
export const CASOS = [
  ['160 px', (p) => sharp(p).resize(160, 160)],
  ['240 px', (p) => sharp(p).resize(240, 240)],
  ['600 px', (p) => sharp(p).resize(600, 600)],
  ['borrão leve (400 px, σ 1,2)', (p) => sharp(p).resize(400, 400).blur(1.2)],
  ['rotação 15° (400 px)', (p) => sharp(p).resize(400, 400).rotate(15, { background: '#ffffff' })],
  ['JPEG qualidade 40 (400 px)', async (p) => sharp(await sharp(p).resize(400, 400).jpeg({ quality: 40 }).toBuffer())],
  ['brilho reduzido a 55% (400 px)', (p) => sharp(p).resize(400, 400).modulate({ brightness: 0.55 })],
];

/** Lê o código em todos os casos; devolve uma linha por caso, com o resultado de cada leitor. */
export async function provar(texto, opcoes) {
  const png = await pngDoCodigo(texto, opcoes);
  const linhas = [];
  for (const [nome, degradar] of CASOS) {
    const imagem = await rgba(await (await degradar(png)).png().toBuffer());
    linhas.push({ caso: nome, jsqr: lerJsqr(imagem) === texto, zxing: lerZxing(imagem) === texto });
  }
  const cartao = await pngDoCartao(texto, opcoes);
  for (const [nome, largura] of [['cartão 1080×1350', 1080], ['cartão a 540 px', 540]]) {
    const imagem = await rgba(await sharp(cartao).resize(largura).png().toBuffer());
    linhas.push({ caso: nome, jsqr: lerJsqr(imagem) === texto, zxing: lerZxing(imagem) === texto });
  }
  return linhas;
}

/** O miolo dos olhos em cada uma das 6 cores do perfil, a 240 px. */
export async function provarCores(texto, estilo) {
  const { CORES_PERFIL } = await import('../packages/contratos/src/aprendizado.ts');
  const linhas = [];
  for (const cor of CORES_PERFIL) {
    const imagem = await rgba(await sharp(await pngDoCodigo(texto, { estilo, cor })).resize(240, 240).png().toBuffer());
    linhas.push({ cor, jsqr: lerJsqr(imagem) === texto, zxing: lerZxing(imagem) === texto });
  }
  return linhas;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const texto = args[0];
  const i = args.indexOf('--saida');
  const saida = i >= 0 ? args[i + 1] : null;
  const resultado = {};
  let md = `Texto: \`${texto}\`\n\n`;
  for (const estilo of ['rosto', 'trilha', 'capim']) {
    const linhas = await provar(texto, { estilo });
    const cores = await provarCores(texto, estilo);
    resultado[estilo] = { linhas, cores };
    md += `### ${estilo}\n\n| caso | jsQR | ZXing |\n|---|---|---|\n${linhas.map((l) => `| ${l.caso} | ${l.jsqr ? 'lê' : 'FALHA'} | ${l.zxing ? 'lê' : 'FALHA'} |`).join('\n')}\n`;
    md += `| miolo nas 6 cores (240 px) | ${cores.every((c) => c.jsqr) ? 'lê' : 'FALHA ' + cores.filter((c) => !c.jsqr).map((c) => c.cor)} | ${cores.every((c) => c.zxing) ? 'lê' : 'FALHA ' + cores.filter((c) => !c.zxing).map((c) => c.cor)} |\n\n`;
  }
  console.log(md);
  if (saida) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(resolve(saida, 'prova.json'), JSON.stringify(resultado, null, 2));
    writeFileSync(resolve(saida, 'prova.md'), md);
  }
}
