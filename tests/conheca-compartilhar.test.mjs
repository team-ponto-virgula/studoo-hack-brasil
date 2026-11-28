// A prévia do link da página de apresentação (spec 18, seção 3): título e descrição da spec, endereço da imagem completo (a base é a origem pública
// configurada) e a imagem do herói (1200 × 630, PNG, leve, com o texto da própria página). Sem rede e sem banco.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'next/navigation') return { url: 'data:text/javascript,' + encodeURIComponent('export const useRouter = () => ({ replace() {}, push() {}, refresh() {}, back() {}, prefetch() {} }); export const usePathname = () => "/conheca"; export const useSearchParams = () => new URLSearchParams(); export const useParams = () => ({}); export const redirect = () => {}; export const notFound = () => {};'), shortCircuit: true };
  return proximo(especificador, contexto);
}
export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { generateMetadata } = await import('../src/app/conheca/page.tsx');
const imagem = await import('../src/app/conheca/opengraph-image.tsx');
const { textos, linhasDoTitulo } = await import('../src/app/conheca/textos.ts');

const comOrigem = (valor, corpo) => {
  const antes = process.env.STUDOO_ORIGEM;
  if (valor === undefined) delete process.env.STUDOO_ORIGEM; else process.env.STUDOO_ORIGEM = valor;
  try { return corpo(); } finally { if (antes === undefined) delete process.env.STUDOO_ORIGEM; else process.env.STUDOO_ORIGEM = antes; }
};

test('metadados: o título e a descrição da spec, o cartão grande do Twitter e a base absoluta da origem pública (https), nunca inventada', () => {
  const m = comOrigem('https://studoo.exemplo.test', () => generateMetadata());
  assert.equal(m.title, 'Studoo — Seu caderno vira lição.');
  assert.equal(m.description, textos.pagina.descricao);
  assert.equal(m.openGraph.title, m.title);
  assert.equal(m.openGraph.description, m.description);
  assert.equal(m.openGraph.locale, 'pt_BR');
  assert.equal(m.twitter.card, 'summary_large_image');
  assert.equal(m.metadataBase.origin, 'https://studoo.exemplo.test');
  assert.equal(m.robots, undefined, 'o noindex do site fica no layout raiz');
  for (const invalida of [undefined, '', 'studoo.exemplo.test', 'http://studoo.exemplo.test', 'https://studoo.exemplo.test/caminho']) {
    assert.equal('metadataBase' in comOrigem(invalida, () => generateMetadata()), false, `sem base para "${invalida}"`);
  }
});

test('a imagem de compartilhar: 1200 × 630, PNG, a mesma para todo mundo, e o texto vem da própria página', async () => {
  assert.deepEqual(imagem.size, { width: 1200, height: 630 });
  assert.equal(imagem.contentType, 'image/png');
  assert.equal(imagem.alt, textos.pagina.titulo);
  const fonte = ler('src/app/conheca/opengraph-image.tsx');
  assert.match(fonte, /imagemDaApresentacao\(\{ linhasDoTitulo,/);
  assert.match(fonte, /textos\.heroi\.subtitulo/);
  assert.match(fonte, /telasDoHeroi\('computador'\)\[1\]\.captura/, 'o celular mostra a trilha pronta do herói (a troca das capturas vale para a imagem)');
  for (const arquivo of ['src/servidor/og/base.tsx', 'src/servidor/og/apresentacao.tsx', 'src/servidor/og/cartao.tsx']) assert.ok(!/stu-oi/.test(ler(arquivo)), `nunca o stu-oi (${arquivo})`);
  // Não lê o banco nem conta no limitador, e por isso nem o teste nem o build precisam do cliente do banco (DATABASE_URL): a imagem, a base dela e a página não o importam.
  for (const arquivo of ['src/app/conheca/opengraph-image.tsx', 'src/servidor/og/base.tsx', 'src/servidor/og/apresentacao.tsx']) {
    assert.doesNotMatch(ler(arquivo), /from ["'][^"']*(banco|compartilhar\/|acesso\/visitante|\.\/cartao|og\/cartao)[^"']*["']/, `${arquivo} não importa o banco`);
  }
  assert.match(ler('src/servidor/og/cartao.tsx'), /from "\.\/base"/, 'os cartões de /t e /p usam a mesma base');
});

test('a imagem sai do gerador do servidor como PNG de paleta, leve e do tamanho certo', async () => {
  const resposta = await imagem.default();
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get('content-type'), 'image/png');
  const bytes = Buffer.from(await resposta.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'assinatura PNG');
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 1200);
  assert.equal(meta.height, 630);
  assert.equal(bytes[25], 3, 'PNG de paleta (tipo de cor 3 no cabeçalho): o desenho é chapado');
  assert.ok(bytes.length < 150 * 1024, `leve para os aplicativos de mensagem: ${bytes.length} bytes`);
  // O herói de verdade: o fundo claro do céu no alto e o azul da marca (o celular e o título) presentes.
  const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => { const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
  const [r, g, b] = pixel(8, 8);
  assert.ok(r > 225 && g > 232 && b > 245, `o céu claro no canto: ${[r, g, b]}`);
});

test('o cartão usa o título e uma frase inteira que a pessoa encontra ao abrir a página', () => {
  const fonte = ler('src/app/conheca/opengraph-image.tsx');
  assert.match(fonte, /textos\.heroi\.subtitulo\.split\('\. '\)\.slice\(-1\)\[0\]/);
  assert.equal(textos.heroi.subtitulo.split('. ').slice(-1)[0], 'O Stu cria lições curtas e explica de outro jeito quando você erra.');
  assert.equal(linhasDoTitulo.join(' '), textos.heroi.titulo);
});
