// Prova do Código Studoo com links do tamanho dos de produção: escolha automática da correção de erro, a clareira
// sempre presente (sorriso, foto ou inicial) e leitura por jsQR e ZXing na matriz de degradações, nas 6 cores.
// Uso: node --import tsx scripts/codigo-studoo-links.mjs [--saida <pasta>] [--rapida]
import { writeFileSync, mkdirSync } from 'node:fs';
import jsQR from 'jsqr';
import zx from '@zxing/library';
const { default: sharp } = await import('sharp');
const { CORES_PERFIL, FUNDO_DA_COR, geometriaCodigoStudoo, svgCodigoDoLink } = await import('../packages/contratos/src/aprendizado.ts');
const { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } = zx;

/** Um link de exatamente `n` caracteres, no formato do site (domínio longo + /t/ ou /p/ + código de 16). */
export function linkDe(n, tipo = 't') {
  const fim = `/${tipo}/AbCdEfGhIjKlMn_-`;
  const inicio = 'https://';
  const dominio = 'studoo-previa-hackbrasil-2026-ui-web-integracao.exemplo.com.br'.padEnd(200, 'x');
  const meio = n - inicio.length - fim.length - 7;
  return `${inicio}${dominio.slice(0, Math.max(1, meio))}.com.br${fim}`.slice(0, n);
}

async function rgba(entrada) {
  const { data, info } = await sharp(entrada).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
}
const lerJsqr = ({ data, w, h }) => jsQR(data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
function lerZxing({ data, w, h }) {
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  try { return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h))), new Map([[DecodeHintType.TRY_HARDER, true]])).getText(); } catch { return null; }
}

export const CASOS = [
  ['160 px', (p) => sharp(p).resize(160, 160)],
  ['240 px', (p) => sharp(p).resize(240, 240)],
  ['600 px', (p) => sharp(p).resize(600, 600)],
  ['borrão (400 px, σ 1,2)', (p) => sharp(p).resize(400, 400).blur(1.2)],
  ['rotação 15° (400 px)', (p) => sharp(p).resize(400, 400).rotate(15, { background: '#ffffff' })],
  ['JPEG 40 (400 px)', async (p) => sharp(await sharp(p).resize(400, 400).jpeg({ quality: 40 }).toBuffer())],
  ['brilho 55% (400 px)', (p) => sharp(p).resize(400, 400).modulate({ brightness: 0.55 })],
];

const fotoTeste = `data:image/png;base64,${(await sharp({ create: { width: 96, height: 96, channels: 3, background: '#2b1d16' } }).png().toBuffer()).toString('base64')}`;
export const CENTROS = {
  sorriso: (texto, cor) => svgCodigoDoLink(texto, { mioloCor: FUNDO_DA_COR[cor], tamanho: 1200 }),
  foto: (texto, cor) => svgCodigoDoLink(texto, { mioloCor: FUNDO_DA_COR[cor], fotoHref: fotoTeste, tamanho: 1200 }),
  inicial: (texto, cor) => svgCodigoDoLink(texto, { mioloCor: FUNDO_DA_COR[cor], inicial: 'A', tamanho: 1200 }),
};

/** Prova um texto: geometria (nível, versão, clareira) e leitura em todos os casos, cores e centros. */
export async function provarLink(texto, { cores = CORES_PERFIL, casos = CASOS, centros = Object.keys(CENTROS) } = {}) {
  const g = geometriaCodigoStudoo(texto);
  const falhas = [];
  let leituras = 0;
  for (const centro of centros) for (const cor of cores) {
    const png = await sharp(Buffer.from(CENTROS[centro](texto, cor))).png().toBuffer();
    for (const [nome, fazer] of casos) {
      const img = await rgba(await (await fazer(png)).png().toBuffer());
      const j = lerJsqr(img) === texto;
      const z = lerZxing(img) === texto;
      leituras += 2;
      if (!j || !z) falhas.push({ centro, cor, caso: nome, jsqr: j, zxing: z });
    }
  }
  return { tamanho: texto.length, nivel: g.nivel, versao: g.versao, modulos: g.modulos, clareira: g.clareira?.lado ?? 0, alinhamentos: g.alinhamentos.length, leituras, falhas };
}

if (process.argv[1]?.endsWith('codigo-studoo-links.mjs')) {
  const args = process.argv.slice(2);
  const saida = args.includes('--saida') ? args[args.indexOf('--saida') + 1] : null;
  const rapida = args.includes('--rapida');
  const resultados = [];
  for (const n of [40, 75, 90, 120]) for (const tipo of ['t', 'p']) {
    const r = await provarLink(linkDe(n, tipo));
    resultados.push({ ...r, tipo });
    console.log(`${String(n).padStart(3)} /${tipo}  ${r.nivel} v${r.versao} (${r.modulos} mód.) clareira ${r.clareira} · ${r.leituras - r.falhas.length * 2}/${r.leituras} leituras · falhas ${r.falhas.length}`);
  }
  // Varredura de 20 a 120 caracteres (6 cores × sorriso, só 240 px e 160 px) para ver a escolha do nível.
  const varredura = [];
  for (let n = 20; n <= 120; n += rapida ? 10 : 5) {
    const r = await provarLink(linkDe(n), { centros: ['sorriso', 'foto'], casos: CASOS.slice(0, 2) });
    varredura.push(r);
    if (r.falhas.length || !r.clareira) console.log('VARREDURA FALHA', n, r.nivel, r.versao, r.clareira, r.falhas.slice(0, 3));
  }
  console.log('varredura', varredura.map((r) => `${r.tamanho}:${r.nivel}v${r.versao}/c${r.clareira}${r.falhas.length ? '!' : ''}`).join(' '));
  if (saida) {
    mkdirSync(saida, { recursive: true });
    writeFileSync(`${saida}/prova-links.json`, JSON.stringify({ resultados, varredura }, null, 2));
    const linhas = ['| link | nível | versão | módulos | clareira | leituras (jsQR + ZXing) | falhas |', '|---|---|---|---|---|---|---|'];
    for (const r of resultados) linhas.push(`| ${r.tamanho} car. /${r.tipo} | ${r.nivel} | ${r.versao} | ${r.modulos} | ${r.clareira}×${r.clareira} | ${r.leituras - r.falhas.length * 2}/${r.leituras} | ${r.falhas.length} |`);
    linhas.push('', 'Matriz por link: 3 centros (sorriso, foto, inicial) × 6 cores × 7 casos (160, 240, 600 px, borrão, rotação 15°, JPEG 40, brilho 55%) × 2 leitores.');
    linhas.push('', `Varredura de 20 a 120 caracteres: ${varredura.map((r) => `${r.tamanho}→${r.nivel} v${r.versao}`).join(', ')}.`);
    writeFileSync(`${saida}/prova-links.md`, linhas.join('\n'));
  }
  process.exitCode = resultados.some((r) => r.falhas.length || !r.clareira) ? 1 : 0;
}
