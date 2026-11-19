// Mascote oficial: o catálogo (packages/contratos/src/catalogo-mascote.ts) bate com os arquivos da web e do app, cada
// imagem tem o tamanho que o catálogo diz e fica abaixo do teto de peso, e nenhum original é servido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { ASSINATURA_MASCOTE, CATALOGO_MASCOTE, arquivoDoMascote } from '@studoo/contratos';

const raiz = resolve(import.meta.dirname, '..');
const web = join(raiz, 'public/mascote');
const app = join(raiz, 'apps/mobile/assets/mascote');
const originais = join(raiz, 'assets/mascote/originais');
const tabela = JSON.parse(readFileSync(join(raiz, 'assets/mascote/tabela.json'), 'utf8'));
/** Teto de peso por imagem gerada (o maior 3x de hoje fica bem abaixo). */
const TETO = { webp: 60 * 1024, png: 90 * 1024 };

const listar = (pasta) => readdirSync(pasta).flatMap((nome) => {
  const caminho = join(pasta, nome);
  return statSync(caminho).isDirectory() ? listar(caminho) : [caminho];
});
const hash = (arquivo) => createHash('sha256').update(readFileSync(arquivo)).digest('hex');
const itens = Object.values(CATALOGO_MASCOTE);
const nomes = itens.flatMap((item) => item.arquivos.flatMap((arquivo) => [arquivo.webp, arquivo.png]));

test('a tabela e o catálogo têm os mesmos itens, com texto alternativo', () => {
  assert.deepEqual(itens.map((item) => item.id).sort(), tabela.itens.map((item) => item.id).sort());
  for (const item of itens) {
    assert.ok(item.alt.trim().length > 0, `${item.id} tem texto alternativo`);
    assert.ok(item.arquivos.length >= tabela.densidades.length, `${item.id} tem arquivos`);
    for (const densidade of tabela.densidades) assert.ok(item.arquivos.some((arquivo) => arquivo.densidade === densidade), `${item.id} em ${densidade}x`);
  }
});

test('web e app têm exatamente os arquivos do catálogo, com os mesmos bytes', () => {
  for (const pasta of [web, app]) {
    assert.deepEqual(readdirSync(pasta).sort(), [...nomes].sort(), `${relative(raiz, pasta)} tem só os arquivos do catálogo`);
  }
  const assinatura = createHash('sha256');
  for (const nome of [...nomes].sort()) {
    const bytes = readFileSync(join(web, nome));
    assert.ok(bytes.equals(readFileSync(join(app, nome))), `${nome} igual na web e no app`);
    assinatura.update(nome).update(bytes);
  }
  assert.equal(assinatura.digest('hex'), ASSINATURA_MASCOTE, 'o catálogo é o do conjunto gerado (rode npm run mascote:gerar)');
});

test('cada imagem tem o tamanho e o peso do catálogo, abaixo do teto', async () => {
  for (const item of itens) {
    for (const arquivo of item.arquivos) {
      for (const formato of ['webp', 'png']) {
        const caminho = join(web, arquivo[formato]);
        const meta = await sharp(caminho).metadata();
        assert.equal(meta.format, formato, `${arquivo[formato]} é ${formato}`);
        assert.equal(meta.width, arquivo.largura * arquivo.densidade, `${arquivo[formato]}: largura`);
        assert.ok(Math.abs(meta.height - arquivo.altura * arquivo.densidade) <= arquivo.densidade, `${arquivo[formato]}: altura`);
        assert.ok(meta.hasAlpha, `${arquivo[formato]} tem fundo transparente`);
        const bytes = statSync(caminho).size;
        assert.equal(bytes, formato === 'webp' ? arquivo.bytesWebp : arquivo.bytesPng, `${arquivo[formato]}: peso do catálogo`);
        assert.ok(bytes <= TETO[formato], `${arquivo[formato]}: ${bytes} bytes passa do teto de ${TETO[formato]}`);
      }
    }
  }
});

test('nenhum original é servido', () => {
  assert.ok(relative(join(raiz, 'public'), originais).startsWith('..'), 'os originais ficam fora de public/');
  const deOriginais = new Set(listar(originais).map(hash));
  assert.equal(deOriginais.size, 31, 'os 31 originais do pacote estão na fonte');
  for (const arquivo of [...listar(join(raiz, 'public')), ...listar(join(raiz, 'apps/mobile/assets'))]) {
    assert.ok(!deOriginais.has(hash(arquivo)), `${relative(raiz, arquivo)} é um original`);
  }
});

test('a escolha do arquivo pega o menor que cobre a largura pedida', () => {
  const id = itens[0].id;
  const larguras = [...new Set(CATALOGO_MASCOTE[id].arquivos.map((arquivo) => arquivo.largura))].sort((a, b) => a - b);
  const menor = larguras[0];
  assert.equal(arquivoDoMascote(id, menor, 1).largura * arquivoDoMascote(id, menor, 1).densidade, menor);
  const enorme = arquivoDoMascote(id, 10_000, 3);
  assert.equal(enorme.largura, larguras[larguras.length - 1], 'acima de tudo, o maior que existe');
  assert.ok(existsSync(join(web, arquivoDoMascote(id, menor + 1, 2).webp)));
});

test('o componente da web reserva o lugar antes de carregar (sem salto de layout)', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Mascote } = await import('../src/ui/mascote.tsx');
  const html = renderToStaticMarkup(createElement(Mascote, { id: 'feliz', largura: 120 }));
  const [w, h] = CATALOGO_MASCOTE.feliz.proporcao;
  assert.match(html, new RegExp(`width="120" height="${Math.round((120 * h) / w)}"`), 'largura e altura no img');
  assert.match(html, new RegExp(`aspect-ratio:${w} / ${h}`), 'proporção do recorte no estilo');
  assert.match(html, /<source type="image\/webp" srcSet="\/mascote\/feliz-160@1x\.webp 1x, \/mascote\/feliz-160@2x\.webp 2x, \/mascote\/feliz-160@3x\.webp 3x"/, 'WebP em 1x, 2x e 3x');
  assert.match(html, /alt="Studoo feliz"/);
  assert.match(renderToStaticMarkup(createElement(Mascote, { id: 'feliz', largura: 64, decorativo: true })), /alt=""/, 'decorativo: alt vazio');
});
