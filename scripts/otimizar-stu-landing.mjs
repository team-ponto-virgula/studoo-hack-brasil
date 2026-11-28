// Gera o Stu nos tamanhos grandes da página de apresentação, a partir dos originais do kit (assets/mascote/originais).
// Uso: node scripts/otimizar-stu-landing.mjs
// O kit do produto (npm run mascote:gerar, spec 13) vai até 480 px, o bastante para as telas do app. Na página, o Stu aparece
// maior (o do alto, o da chegada e o de cada parada), e uma tela de 2x pedia mais do que o kit tem. Este script NÃO muda o kit
// nem o catálogo do contrato: usa a mesma tabela (assets/mascote/tabela.json) para o recorte de cada imagem (`quadro` ou
// `justo`) e a mesma qualidade de WebP, e escreve em public/landing/ com um trecho do hash no nome (o arquivo nunca muda sob o
// mesmo nome). Depois escreve src/app/conheca/stu.gerado.ts com os endereços e as medidas. Determinístico.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const raiz = resolve(import.meta.dirname, '..');
const tabela = JSON.parse(readFileSync(join(raiz, 'assets/mascote/tabela.json'), 'utf8'));
const pastaOriginais = join(raiz, 'assets/mascote/originais');
const saida = join(raiz, 'public/landing');
const TETO_BYTES = 90 * 1024;

/** O que a página usa e em que larguras (px do arquivo). A maior cobre o maior tamanho na tela em 2x. */
const PEDIDOS = [
  { nome: 'stu-acolhida', larguras: [320, 480, 720] },
  { nome: 'stu-celebrando', larguras: [320, 480, 720] },
  { nome: 'stu-estudando', larguras: [240, 400] },
  { nome: 'stu-curioso', larguras: [200, 400] },
  { nome: 'stu-concentrado', larguras: [200, 400] },
  { nome: 'stu-animado', larguras: [200, 400] },
  { nome: 'stu-encorajador', larguras: [200, 400] },
  { nome: 'stu-tres-quartos', larguras: [160, 320] },
  { nome: 'stu-perfil', larguras: [96, 192] },
];

sharp.cache(false);
sharp.concurrency(1);

/** A caixa útil (alfa acima do limiar) de uma imagem: a mesma conta de scripts/mascote.mjs. */
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
  if (item.recorte === 'quadro') {
    const { x, y, lado } = tabela.quadro;
    return { left: x, top: y, width: lado, height: lado };
  }
  const caixa = await caixaUtil(join(pastaOriginais, item.origem));
  const folga = tabela.justo.folga;
  const left = Math.max(0, caixa.x0 - folga);
  const top = Math.max(0, caixa.y0 - folga);
  const right = Math.min(caixa.largura - 1, caixa.x1 + folga);
  const bottom = Math.min(caixa.altura - 1, caixa.y1 + folga);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

mkdirSync(saida, { recursive: true });
const gerados = {};
for (const pedido of PEDIDOS) {
  const item = tabela.itens.find((i) => i.nome === pedido.nome);
  if (!item) throw new Error(`${pedido.nome} não está na tabela do mascote`);
  const recorte = await recorteDe(item);
  const fontes = [];
  for (const largura of pedido.larguras) {
    const altura = Math.round((largura * recorte.height) / recorte.width);
    const dados = await sharp(join(pastaOriginais, item.origem)).ensureAlpha().extract(recorte)
      .resize(largura, altura, { kernel: 'lanczos3' }).webp({ ...tabela.web.webp, effort: 6 }).toBuffer();
    if (dados.length > TETO_BYTES) throw new Error(`${pedido.nome} em ${largura} px: ${dados.length} bytes, acima de ${TETO_BYTES}`);
    const hash = createHash('sha256').update(dados).digest('hex').slice(0, 8);
    const arquivo = `${pedido.nome}-${largura}w.${hash}.webp`;
    writeFileSync(join(saida, arquivo), dados);
    fontes.push({ src: `/landing/${arquivo}`, largura, bytes: dados.length });
  }
  const menor = pedido.larguras[0];
  gerados[pedido.nome] = { largura: menor, altura: Math.round((menor * recorte.height) / recorte.width), fontes };
  console.log(`${pedido.nome.padEnd(18)} ${recorte.width}x${recorte.height} → ${fontes.map((f) => `${f.largura}w ${f.bytes} B`).join(', ')}`);
}

// Tira da pasta os arquivos de rodadas antigas (os que a lista de pedidos não gera mais).
const vivos = new Set(Object.values(gerados).flatMap((g) => g.fontes.map((f) => f.src.split('/').pop())));
for (const arquivo of readdirSync(saida)) {
  if (/^stu-[\w-]+-\d+w\.[0-9a-f]{8}\.webp$/.test(arquivo) && !vivos.has(arquivo)) rmSync(join(saida, arquivo));
}

const linhas = Object.entries(gerados).map(([nome, g]) => `  '${nome}': { largura: ${g.largura}, altura: ${g.altura}, fontes: [${g.fontes.map((f) => `{ src: '${f.src}', largura: ${f.largura} }`).join(', ')}] },`);
writeFileSync(join(raiz, 'src/app/conheca/stu.gerado.ts'), `// Escrito por scripts/otimizar-stu-landing.mjs. Não editar à mão: rode o script de novo.
export interface StuDaPagina {
  /** Largura e altura do menor arquivo: reservam o lugar antes de carregar (a proporção é a mesma em todos). */
  largura: number;
  altura: number;
  /** WebP em mais de uma largura; o navegador escolhe pelo \`sizes\` do lugar e pela densidade da tela. */
  fontes: readonly { src: string; largura: number }[];
}

export const STU_DA_PAGINA = {
${linhas.join('\n')}
} as const satisfies Record<string, StuDaPagina>;

export type NomeDoStuDaPagina = keyof typeof STU_DA_PAGINA;
`);
