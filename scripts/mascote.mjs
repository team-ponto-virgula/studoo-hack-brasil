// Gera as versões leves do mascote a partir dos originais (assets/mascote/originais) e da tabela
// (assets/mascote/tabela.json): recorte da margem transparente com a mesma caixa por grupo, larguras da tabela em
// 1x/2x/3x, WebP e PNG. Os arquivos vão iguais para public/mascote e apps/mobile/assets/mascote, e o catálogo tipado
// para packages/contratos/src/catalogo-mascote.ts. Determinístico: rodar de novo com a mesma tabela dá os mesmos bytes.
// Uso: npm run mascote:gerar
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const raiz = resolve(import.meta.dirname, '..');
const pastaOriginais = join(raiz, 'assets/mascote/originais');
const tabela = JSON.parse(readFileSync(join(raiz, 'assets/mascote/tabela.json'), 'utf8'));
const destinos = [join(raiz, 'public/mascote'), join(raiz, 'apps/mobile/assets/mascote')];
const arquivoCatalogo = join(raiz, 'packages/contratos/src/catalogo-mascote.ts');
/** Margem transparente que sobra em volta do recorte (fração do lado maior), para sombra e antisserrilhado. */
const FOLGA = 0.02;

sharp.cache(false);
sharp.concurrency(1);

const ids = new Set();
for (const item of tabela.itens) {
  if (!/^[a-z0-9-]+$/.test(item.id)) throw new Error(`id inválido: ${item.id}`);
  if (ids.has(item.id)) throw new Error(`id repetido: ${item.id}`);
  ids.add(item.id);
  if (!tabela.grupos[item.grupo]) throw new Error(`grupo desconhecido em ${item.id}: ${item.grupo}`);
  if (!item.alt?.trim()) throw new Error(`sem texto alternativo: ${item.id}`);
}

/** A caixa do conteúdo (alfa > 0) de uma imagem. */
async function caixaDoConteudo(arquivo) {
  const { data, info } = await sharp(arquivo).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[y * info.width + x] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) throw new Error(`imagem vazia: ${arquivo}`);
  return { x0, y0, x1, y1, largura: info.width, altura: info.height };
}

// A mesma caixa para todo o grupo (a união das caixas), com folga, dentro da imagem.
const caixas = new Map();
for (const item of tabela.itens) caixas.set(item.id, await caixaDoConteudo(join(pastaOriginais, item.origem)));
const recortes = {};
for (const grupo of Object.keys(tabela.grupos)) {
  const doGrupo = tabela.itens.filter((item) => item.grupo === grupo).map((item) => caixas.get(item.id));
  if (doGrupo.length === 0) continue;
  const larguraMax = Math.max(...doGrupo.map((c) => c.largura));
  const alturaMax = Math.max(...doGrupo.map((c) => c.altura));
  const folga = Math.round(FOLGA * Math.max(larguraMax, alturaMax));
  const left = Math.max(0, Math.min(...doGrupo.map((c) => c.x0)) - folga);
  const top = Math.max(0, Math.min(...doGrupo.map((c) => c.y0)) - folga);
  const right = Math.min(larguraMax - 1, Math.max(...doGrupo.map((c) => c.x1)) + folga);
  const bottom = Math.min(alturaMax - 1, Math.max(...doGrupo.map((c) => c.y1)) + folga);
  recortes[grupo] = { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const gerados = new Map();
const catalogo = [];
for (const item of tabela.itens) {
  const recorte = recortes[item.grupo];
  const tamanhos = item.tamanhos ?? tabela.grupos[item.grupo].tamanhos;
  const base = await sharp(join(pastaOriginais, item.origem)).ensureAlpha().extract(recorte).png().toBuffer();
  const arquivos = [];
  for (const largura of tamanhos) {
    const altura = Math.round((largura * recorte.height) / recorte.width);
    for (const densidade of tabela.densidades) {
      const w = largura * densidade;
      const h = Math.round((w * recorte.height) / recorte.width);
      if (w > recorte.width) throw new Error(`${item.id}: ${largura}px em ${densidade}x passa do original (${recorte.width}px)`);
      const redim = sharp(base).resize(w, h, { kernel: 'lanczos3' });
      const nome = `${item.id}-${largura}@${densidade}x`;
      const webp = await redim.clone().webp({ quality: 86, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
      const png = await redim.clone().png({ palette: true, quality: 92, effort: 10, compressionLevel: 9 }).toBuffer();
      gerados.set(`${nome}.webp`, webp);
      gerados.set(`${nome}.png`, png);
      arquivos.push({ largura, altura, densidade, webp: `${nome}.webp`, png: `${nome}.png`, bytesWebp: webp.length, bytesPng: png.length });
    }
  }
  catalogo.push({ id: item.id, grupo: item.grupo, alt: item.alt, proporcao: [recorte.width, recorte.height], arquivos });
}

for (const destino of destinos) {
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });
  for (const [nome, bytes] of gerados) writeFileSync(join(destino, nome), bytes);
}

const assinatura = createHash('sha256');
for (const nome of [...gerados.keys()].sort()) assinatura.update(nome).update(gerados.get(nome));
const tipoIds = catalogo.map((item) => `  | '${item.id}'`).join('\n');
const codigo = `// Gerado por scripts/mascote.mjs a partir de assets/mascote/tabela.json (npm run mascote:gerar). Não edite à mão.
/** O mascote oficial do Studoo: os mesmos arquivos em public/mascote (web) e apps/mobile/assets/mascote (app). */

export type IdMascote =
${tipoIds};

export type GrupoMascote = ${Object.keys(tabela.grupos).map((grupo) => `'${grupo}'`).join(' | ')};

export interface ArquivoMascote {
  /** Largura em px de CSS (ou dp no app) e a altura que ela dá. */
  readonly largura: number;
  readonly altura: number;
  readonly densidade: number;
  /** Nomes dentro da pasta \`mascote\` de cada plataforma. */
  readonly webp: string;
  readonly png: string;
  readonly bytesWebp: number;
  readonly bytesPng: number;
}

export interface ItemMascote {
  readonly id: IdMascote;
  readonly grupo: GrupoMascote;
  /** Texto alternativo (quando a imagem não é só decoração). */
  readonly alt: string;
  /** Largura e altura do recorte: a proporção que reserva o lugar antes de carregar. */
  readonly proporcao: readonly [number, number];
  readonly arquivos: readonly ArquivoMascote[];
}

/** Assinatura do conjunto gerado (nomes e bytes): o teste confere que as duas plataformas têm este conjunto. */
export const ASSINATURA_MASCOTE = '${assinatura.digest('hex')}';

/** As cores da paleta oficial do mascote. */
export const CORES_MASCOTE = ${JSON.stringify(tabela.cores, null, 2).replace(/"([a-z-]+)":/g, "'$1':").replace(/"/g, "'")} as const;

export const CATALOGO_MASCOTE: Readonly<Record<IdMascote, ItemMascote>> = {
${catalogo.map((item) => `  '${item.id}': ${JSON.stringify(item).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'")},`).join('\n')}
};

/** O arquivo de um item para uma largura de CSS e uma densidade: o menor gerado que cobre, ou o maior que existe. */
export function arquivoDoMascote(id: IdMascote, largura: number, densidade = 1): ArquivoMascote {
  const arquivos = CATALOGO_MASCOTE[id].arquivos;
  const alvo = largura * densidade;
  const ordenados = [...arquivos].sort((a, b) => a.largura * a.densidade - b.largura * b.densidade);
  return ordenados.find((a) => a.largura * a.densidade >= alvo) ?? ordenados[ordenados.length - 1];
}
`;
writeFileSync(arquivoCatalogo, codigo);

const peso = [...gerados.values()].reduce((soma, b) => soma + b.length, 0);
console.log(`${catalogo.length} itens, ${gerados.size} arquivos (${(peso / 1024).toFixed(0)} KB) em ${destinos.length} pastas; catálogo em ${arquivoCatalogo.replace(`${raiz}/`, '')}`);
console.log('recortes:', JSON.stringify(recortes));
const maiores = [...gerados.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([n, b]) => `${n} ${(b.length / 1024).toFixed(0)} KB`);
console.log('maiores:', maiores.join(', '));
