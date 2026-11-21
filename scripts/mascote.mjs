// Gera as versões leves do mascote (spec 13, A1) a partir dos originais (assets/mascote/originais) e da tabela
// (assets/mascote/tabela.json):
// - recorte `quadro` (a caixa comum do personagem) ou `justo` (a caixa útil, alfa > limiar, com folga);
// - cada imagem só nas faixas dela; o lado da faixa é o maior lado da imagem na tela;
// - web: WebP em 1x e 2x, `public/marca/stu/<nome>-<px>.webp`; app: PNG de paleta @1x/@2x/@3x,
//   `apps/mobile/assets/marca/stu/<nome>-<faixa>.png` (o React Native escolhe a densidade);
// - extras da tabela (como o PNG do cartão de prévia do link);
// - o catálogo tipado em packages/contratos/src/catalogo-mascote.ts.
// Determinístico: a mesma tabela dá os mesmos bytes. Uso: npm run mascote:gerar
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const raiz = resolve(import.meta.dirname, '..');
const pastaOriginais = join(raiz, 'assets/mascote/originais');
const tabela = JSON.parse(readFileSync(join(raiz, 'assets/mascote/tabela.json'), 'utf8'));
const arquivoCatalogo = join(raiz, 'packages/contratos/src/catalogo-mascote.ts');
const pastaWeb = join(raiz, tabela.web.pasta);
const pastaApp = join(raiz, tabela.app.pasta);

sharp.cache(false);
sharp.concurrency(1);

const faixas = Object.keys(tabela.faixas);
const nomes = new Set();
for (const item of tabela.itens) {
  if (!/^[a-z0-9-]+$/.test(item.nome)) throw new Error(`nome inválido: ${item.nome}`);
  if (nomes.has(item.nome)) throw new Error(`nome repetido: ${item.nome}`);
  nomes.add(item.nome);
  if (!['quadro', 'justo'].includes(item.recorte)) throw new Error(`${item.nome}: recorte ${item.recorte}`);
  if (!item.faixas?.length || item.faixas.some((faixa) => !faixas.includes(faixa))) throw new Error(`${item.nome}: faixas ${item.faixas}`);
  if (!item.alt?.trim() || /['\\]/.test(item.alt)) throw new Error(`${item.nome}: texto alternativo vazio ou com aspas simples`);
}

/** A caixa útil (alfa acima do limiar) de uma imagem. */
async function caixaUtil(arquivo) {
  const { data, info } = await sharp(arquivo).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y += 1) {
    const linha = y * info.width;
    for (let x = 0; x < info.width; x += 1) {
      if (data[linha + x] > tabela.justo.limiarAlfa) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) throw new Error(`imagem vazia: ${arquivo}`);
  return { x0, y0, x1, y1, largura: info.width, altura: info.height };
}

async function recorteDe(item) {
  const caixa = await caixaUtil(join(pastaOriginais, item.origem));
  if (item.recorte === 'quadro') {
    const { x, y, lado } = tabela.quadro;
    if (caixa.x0 < x || caixa.y0 < y || caixa.x1 >= x + lado || caixa.y1 >= y + lado) throw new Error(`${item.nome}: passa do quadro comum`);
    return { left: x, top: y, width: lado, height: lado };
  }
  const folga = tabela.justo.folga;
  const left = Math.max(0, caixa.x0 - folga);
  const top = Math.max(0, caixa.y0 - folga);
  const right = Math.min(caixa.largura - 1, caixa.x1 + folga);
  const bottom = Math.min(caixa.altura - 1, caixa.y1 + folga);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Largura e altura para o maior lado `px`. */
const medidas = (recorte, px) => (recorte.width >= recorte.height
  ? { w: px, h: Math.round((px * recorte.height) / recorte.width) }
  : { w: Math.round((px * recorte.width) / recorte.height), h: px });

// Animado: a transformação comum que leva o GIF (352 px) ao quadro do PNG (1024), medida pela mediana entre as imagens
// do personagem (a caixa do primeiro quadro do GIF contra a caixa útil do PNG).
const animado = tabela.animado;
const gifDe = (item) => join(raiz, animado.origem, item.origem.replace(/\.png$/, '.gif'));
const comAnimacao = tabela.itens.filter((item) => item.faixasAnimadas?.length);
/** As caixas (alfa acima do limiar) de cada quadro de um GIF, os quadros em RGBA e os tempos. */
async function quadrosDoGif(arquivo) {
  const meta = await sharp(arquivo).metadata();
  const quadros = [];
  const caixas = [];
  for (let pagina = 0; pagina < meta.pages; pagina += 1) {
    const { data, info } = await sharp(arquivo, { page: pagina }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > tabela.justo.limiarAlfa) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    quadros.push({ data, largura: info.width, altura: info.height });
    caixas.push({ x0, y0, x1, y1 });
  }
  return { quadros, caixas, atrasos: meta.delay, lado: meta.width };
}
const gifs = new Map();
const amostras = [];
for (const item of comAnimacao) {
  const gif = await quadrosDoGif(gifDe(item));
  gifs.set(item.nome, gif);
  const png = await caixaUtil(join(pastaOriginais, item.origem));
  const q = gif.caixas[0];
  const escala = (png.y1 - png.y0 + 1) / (q.y1 - q.y0 + 1);
  amostras.push({ escala, dx: png.x0 - escala * q.x0, dy: png.y0 - escala * q.y0 });
}
const mediana = (valores) => { const v = [...valores].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const transformacao = { escala: mediana(amostras.map((a) => a.escala)), dx: mediana(amostras.map((a) => a.dx)), dy: mediana(amostras.map((a) => a.dy)) };

const web = new Map();
const app = new Map();
const catalogo = [];
for (const item of tabela.itens) {
  const recorte = await recorteDe(item);
  const base = await sharp(join(pastaOriginais, item.origem)).ensureAlpha().extract(recorte).png().toBuffer();
  const redimensionar = (px) => { const { w, h } = medidas(recorte, px); return sharp(base).resize(w, h, { kernel: 'lanczos3' }); };
  const arquivosWeb = [];
  const arquivosApp = [];
  for (const faixa of item.faixas) {
    const lado = tabela.faixas[faixa].lado;
    for (const densidade of tabela.web.densidades) {
      const px = lado * densidade;
      const nome = `${item.nome}-${px}.webp`;
      if (!web.has(nome)) web.set(nome, await redimensionar(px).webp({ ...tabela.web.webp, effort: 6 }).toBuffer());
      arquivosWeb.push({ faixa, densidade, px, arquivo: nome, bytes: web.get(nome).length });
    }
    for (const densidade of tabela.app.densidades) {
      const nome = `${item.nome}-${faixa.toLowerCase()}${densidade > 1 ? `@${densidade}x` : ''}.png`;
      const px = lado * densidade;
      app.set(nome, await redimensionar(px).png({ palette: true, effort: 10, ...tabela.app.png }).toBuffer());
      arquivosApp.push({ faixa, densidade, px, arquivo: nome, bytes: app.get(nome).length });
    }
  }
  const entrada = { nome: item.nome, alt: item.alt, recorte: item.recorte, proporcao: [recorte.width, recorte.height], faixas: item.faixas, web: arquivosWeb, app: arquivosApp };
  if (gifs.has(item.nome)) entrada.animacao = await gerarAnimacao(item, recorte);
  catalogo.push(entrada);
}

/**
 * A versão animada de uma imagem: a caixa (em coordenadas do PNG de 1024) cobre o recorte parado e todos os quadros, com
 * folga, dentro do GIF; a camada animada fica por cima da parada, na mesma escala e posição, em `caixa` (% do recorte).
 */
async function gerarAnimacao(item, recorte) {
  const gif = gifs.get(item.nome);
  const { escala, dx, dy } = transformacao;
  const para1024 = (x, y) => [dx + escala * x, dy + escala * y];
  const uniao = gif.caixas.reduce((u, c) => ({ x0: Math.min(u.x0, c.x0), y0: Math.min(u.y0, c.y0), x1: Math.max(u.x1, c.x1), y1: Math.max(u.y1, c.y1) }));
  const [ux0, uy0] = para1024(uniao.x0, uniao.y0);
  const [ux1, uy1] = para1024(uniao.x1 + 1, uniao.y1 + 1);
  const [gx0, gy0] = para1024(0, 0);
  const [gx1, gy1] = para1024(gif.lado, gif.lado);
  const folga = animado.folga;
  // Em px do GIF, inteiros, dentro dele.
  const ax0 = Math.max(0, Math.floor((Math.max(gx0, Math.min(recorte.left, ux0 - folga)) - dx) / escala));
  const ay0 = Math.max(0, Math.floor((Math.max(gy0, Math.min(recorte.top, uy0 - folga)) - dy) / escala));
  const ax1 = Math.min(gif.lado, Math.ceil((Math.min(gx1, Math.max(recorte.left + recorte.width, ux1 + folga)) - dx) / escala));
  const ay1 = Math.min(gif.lado, Math.ceil((Math.min(gy1, Math.max(recorte.top + recorte.height, uy1 + folga)) - dy) / escala));
  const [cx0, cy0] = para1024(ax0, ay0);
  const [cx1, cy1] = para1024(ax1, ay1);
  const caixa = [(cx0 - recorte.left) / recorte.width, (cy0 - recorte.top) / recorte.height, (cx1 - cx0) / recorte.width, (cy1 - cy0) / recorte.height]
    .map((v) => Math.round(v * 100000) / 1000);
  // Os quadros recortados, na resolução do GIF.
  const largura = ax1 - ax0;
  const altura = ay1 - ay0;
  const quadros = [];
  for (const quadro of gif.quadros) {
    quadros.push(await sharp(quadro.data, { raw: { width: quadro.largura, height: quadro.altura, channels: 4 } })
      .extract({ left: ax0, top: ay0, width: largura, height: altura }).png().toBuffer());
  }
  const maiorLado = Math.max(recorte.width, recorte.height);
  // Só até `ladoMax` px de saída (spec 13, E2): acima disso o GIF teria de ser ampliado e borra.
  const alcanca = (px) => px <= animado.ladoMax;
  const codificar = async (px) => {
    const k = px / maiorLado;
    const w = Math.round((cx1 - cx0) * k);
    const h = Math.round((cy1 - cy0) * k);
    const redimensionados = [];
    for (const q of quadros) redimensionados.push(await sharp(q).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer());
    // Teto por lado de saída (E6); passou, a qualidade desce um degrau (o peso vem dos quadros, então desce pouco).
    const linha = animado.tetos.find(([ladoTeto]) => px <= ladoTeto);
    const teto = (item.nome === 'stu-acolhida' ? linha[2] : linha[1]) * 1024;
    for (const qualidade of [animado.webp.quality, 50, 40, 30]) {
      const bytes = await sharp(redimensionados, { join: { animated: true } })
        .webp({ ...animado.webp, quality: qualidade, alphaQuality: Math.min(animado.webp.alphaQuality, qualidade), loop: 0, delay: gif.atrasos }).toBuffer();
      if (bytes.length <= teto) return { bytes, w, h };
    }
    throw new Error(`${item.nome} em ${px} px não cabe no teto de ${teto / 1024} KB`);
  };
  const arquivosWeb = [];
  const arquivosApp = [];
  const faixasAnimadas = [];
  for (const faixa of item.faixasAnimadas) {
    const lado = tabela.faixas[faixa].lado;
    if (!tabela.web.densidades.every((d) => alcanca(lado * d))) continue;
    faixasAnimadas.push(faixa);
    for (const densidade of tabela.web.densidades) {
      const px = lado * densidade;
      const nome = `${item.nome}-${px}-animado.webp`;
      if (!web.has(nome)) { const r = await codificar(px); web.set(nome, r.bytes); web.set(`#${nome}`, Buffer.from(`${r.w}x${r.h}`)); }
      const [w, h] = web.get(`#${nome}`).toString().split('x').map(Number);
      arquivosWeb.push({ faixa, densidade, px, largura: w, altura: h, arquivo: nome, bytes: web.get(nome).length });
    }
    for (const densidade of animado.densidadesApp ?? tabela.app.densidades) {
      const px = lado * densidade;
      if (!alcanca(px)) continue;
      const nome = `${item.nome}-${faixa.toLowerCase()}-animado${densidade > 1 ? `@${densidade}x` : ''}.webp`;
      const r = await codificar(px);
      app.set(nome, r.bytes);
      arquivosApp.push({ faixa, densidade, px, largura: r.w, altura: r.h, arquivo: nome, bytes: r.bytes.length });
    }
  }
  if (faixasAnimadas.length === 0) return undefined;
  const duracaoMs = gif.atrasos.reduce((soma, atraso) => soma + atraso, 0);
  return { caixa, quadros: gif.quadros.length, duracaoMs, faixas: faixasAnimadas, web: arquivosWeb, app: arquivosApp };
}
const extras = [];
for (const extra of tabela.extras ?? []) {
  const item = tabela.itens.find((i) => i.nome === extra.nome);
  const recorte = await recorteDe(item);
  const { w, h } = medidas(recorte, extra.px);
  const bytes = await sharp(join(pastaOriginais, item.origem)).ensureAlpha().extract(recorte).resize(w, h, { kernel: 'lanczos3' })
    .png({ palette: true, effort: 10, ...tabela.app.png }).toBuffer();
  const nome = `${extra.nome}-${extra.px}.${extra.formato}`;
  if (extra.pasta !== tabela.web.pasta) throw new Error('extras só na pasta da web');
  web.set(nome, bytes);
  extras.push({ nome: extra.nome, px: extra.px, arquivo: nome, bytes: bytes.length });
}

// As pastas do M1 (public/mascote e apps/mobile/assets/mascote) saem: os nomes e lugares finais são os da spec 13.
for (const antiga of ['public/mascote', 'apps/mobile/assets/mascote']) rmSync(join(raiz, antiga), { recursive: true, force: true });
for (const chave of [...web.keys()]) if (chave.startsWith('#')) web.delete(chave);
for (const [pasta, arquivos] of [[pastaWeb, web], [pastaApp, app]]) {
  rmSync(pasta, { recursive: true, force: true });
  mkdirSync(pasta, { recursive: true });
  for (const [nome, bytes] of arquivos) writeFileSync(join(pasta, nome), bytes);
}

const assinar = (arquivos) => {
  const h = createHash('sha256');
  for (const nome of [...arquivos.keys()].sort()) h.update(nome).update(arquivos.get(nome));
  return h.digest('hex');
};
const literal = (valor) => JSON.stringify(valor).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'");
const codigo = `// Gerado por scripts/mascote.mjs a partir de assets/mascote/tabela.json (npm run mascote:gerar). Não edite à mão.
/** O mascote oficial (spec 13): as imagens do Stu e dos acessórios, os nomes finais e os arquivos de cada plataforma. */

export type NomeStu =
${catalogo.map((item) => `  | '${item.nome}'`).join('\n')};

export type FaixaStu = ${faixas.map((faixa) => `'${faixa}'`).join(' | ')};

/** Faixas de tamanho: o lado gerado, até que lado na tela ela vale e o teto de peso por arquivo. */
export const FAIXAS_STU: Readonly<Record<FaixaStu, { readonly lado: number; readonly ate: number; readonly tetoKB: number }>> = ${literal(tabela.faixas)};

export interface ArquivoStu {
  readonly faixa: FaixaStu;
  readonly densidade: number;
  /** O maior lado do arquivo, em pixels. */
  readonly px: number;
  readonly arquivo: string;
  readonly bytes: number;
}

export interface ItemStu {
  readonly nome: NomeStu;
  /** Texto alternativo (quando a imagem não é só decoração). */
  readonly alt: string;
  readonly recorte: 'quadro' | 'justo';
  /** Largura e altura do recorte: a proporção que reserva o lugar antes de carregar. */
  readonly proporcao: readonly [number, number];
  readonly faixas: readonly FaixaStu[];
  /** Web: WebP em \`${tabela.web.pasta.replace(/^public/, '')}\`. */
  readonly web: readonly ArquivoStu[];
  /** App: PNG em \`${tabela.app.pasta.replace(/^apps\/mobile\//, '')}\` (@2x e @3x ao lado). */
  readonly app: readonly ArquivoStu[];
  /** Versão animada (só o personagem, nas faixas que o GIF alcança). */
  readonly animacao?: AnimacaoStu;
}

export interface ArquivoAnimadoStu extends ArquivoStu {
  /** Pixels do arquivo animado (a caixa dele, maior que o recorte parado quando a animação sai do quadro). */
  readonly largura: number;
  readonly altura: number;
}

export interface AnimacaoStu {
  /** Onde a camada animada fica, em % do recorte parado: esquerda, topo, largura e altura (pode passar de 0–100). */
  readonly caixa: readonly [number, number, number, number];
  readonly quadros: number;
  readonly duracaoMs: number;
  readonly faixas: readonly FaixaStu[];
  /** Web: WebP animado 1x e 2x. App: WebP animado nas densidades que o GIF alcança. */
  readonly web: readonly ArquivoAnimadoStu[];
  readonly app: readonly ArquivoAnimadoStu[];
}

/** A transformação comum do GIF (352 px) para o PNG de 1024: x1024 = escala × x + dx. */
export const TRANSFORMACAO_GIF_STU = ${literal(transformacao)} as const;

/** Onde cada plataforma guarda os arquivos (a web serve a partir de \`public\`). */
export const PASTA_STU = { web: '${tabela.web.pasta.replace(/^public/, '')}', app: '${tabela.app.pasta}' } as const;

/** Assinaturas dos conjuntos gerados (nomes e bytes): o teste confere que as pastas têm exatamente estes arquivos. */
export const ASSINATURA_STU = { web: '${assinar(web)}', app: '${assinar(app)}' } as const;

/** As cores da paleta oficial do mascote. */
export const CORES_MASCOTE = ${literal(tabela.cores)} as const;

export const CATALOGO_STU: Readonly<Record<NomeStu, ItemStu>> = {
${catalogo.map((item) => `  '${item.nome}': ${literal(item)},`).join('\n')}
};

/** Arquivos fora das faixas (como o PNG do cartão de prévia do link, que não lê WebP). */
export const EXTRAS_STU = ${literal(extras)} as const;

/** A faixa para um lado na tela (px de CSS ou dp). */
export function faixaDoLado(lado: number): FaixaStu {
  const ordem = (Object.keys(FAIXAS_STU) as FaixaStu[]).sort((a, b) => FAIXAS_STU[a].ate - FAIXAS_STU[b].ate);
  return ordem.find((faixa) => lado <= FAIXAS_STU[faixa].ate) ?? ordem[ordem.length - 1];
}

/** A faixa animada de uma imagem para um lado (a mais próxima acima, ou a maior que existe), ou null sem animação. */
export function faixaAnimadaDoStu(nome: NomeStu, lado: number): FaixaStu | null {
  const animacao = CATALOGO_STU[nome].animacao;
  if (!animacao) return null;
  const desejada = FAIXAS_STU[faixaDoLado(lado)].lado;
  const tem = [...animacao.faixas].sort((a, b) => FAIXAS_STU[a].lado - FAIXAS_STU[b].lado);
  return tem.find((faixa) => FAIXAS_STU[faixa].lado >= desejada) ?? tem[tem.length - 1];
}

/** Anima só quando foi pedido, existe animação, a pessoa não pediu movimento reduzido, está na tela e a aba está à vista. */
export function deveAnimarStu(estado: { pedido: boolean; temAnimacao: boolean; reduzido: boolean; visivel: boolean; oculta: boolean }): boolean {
  return estado.pedido && estado.temAnimacao && !estado.reduzido && estado.visivel && !estado.oculta;
}

/** A faixa gerada de uma imagem para um lado: a da tabela, ou a mais próxima acima (ou a maior) entre as que ela tem. */
export function faixaDoStu(nome: NomeStu, lado: number): FaixaStu {
  const desejada = FAIXAS_STU[faixaDoLado(lado)].lado;
  const tem = [...CATALOGO_STU[nome].faixas].sort((a, b) => FAIXAS_STU[a].lado - FAIXAS_STU[b].lado);
  return tem.find((faixa) => FAIXAS_STU[faixa].lado >= desejada) ?? tem[tem.length - 1];
}
`;
writeFileSync(arquivoCatalogo, codigo);

const kb = (mapa) => ([...mapa.values()].reduce((s, b) => s + b.length, 0) / 1024).toFixed(0);
console.log(`${catalogo.length} imagens; web: ${web.size} arquivos (${kb(web)} KB) em ${tabela.web.pasta}; app: ${app.size} arquivos (${kb(app)} KB) em ${tabela.app.pasta}`);
