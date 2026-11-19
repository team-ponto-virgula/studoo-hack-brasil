// Mascote oficial (spec 13, A1): o catálogo (packages/contratos/src/catalogo-mascote.ts) bate com os arquivos da web e
// do app, cada imagem tem o tamanho que o catálogo diz e fica abaixo do teto da faixa, o recorte segue a regra, e nenhum
// original é servido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { ASSINATURA_STU, CATALOGO_STU, EXTRAS_STU, FAIXAS_STU, deveAnimarStu, faixaAnimadaDoStu, faixaDoLado, faixaDoStu } from '@studoo/contratos';

const raiz = resolve(import.meta.dirname, '..');
const tabela = JSON.parse(readFileSync(join(raiz, 'assets/mascote/tabela.json'), 'utf8'));
const web = join(raiz, tabela.web.pasta);
const app = join(raiz, tabela.app.pasta);
const originais = join(raiz, 'assets/mascote/originais');

const listar = (pasta) => readdirSync(pasta).flatMap((nome) => {
  const caminho = join(pasta, nome);
  return statSync(caminho).isDirectory() ? listar(caminho) : [caminho];
});
const hash = (arquivo) => createHash('sha256').update(readFileSync(arquivo)).digest('hex');
const itens = Object.values(CATALOGO_STU);
const assinar = (pasta, nomes) => {
  const h = createHash('sha256');
  for (const nome of [...nomes].sort()) h.update(nome).update(readFileSync(join(pasta, nome)));
  return h.digest('hex');
};

test('a tabela e o catálogo têm as 17 imagens da spec, com texto alternativo que diz Stu', () => {
  assert.deepEqual(itens.map((item) => item.nome).sort(), tabela.itens.map((item) => item.nome).sort());
  assert.equal(itens.length, 17);
  for (const item of itens) {
    assert.ok(item.alt.trim().length > 0, `${item.nome} tem texto alternativo`);
    if (item.nome.startsWith('stu-')) assert.match(item.alt, /\bStu\b/, `${item.nome}: o alt diz Stu`);
  }
});

test('cada plataforma tem exatamente os arquivos do catálogo, nas densidades de cada uma', () => {
  const nomesWeb = new Set([...itens.flatMap((item) => [...item.web, ...(item.animacao?.web ?? [])].map((a) => a.arquivo)), ...EXTRAS_STU.map((e) => e.arquivo)]);
  const nomesApp = new Set(itens.flatMap((item) => [...item.app, ...(item.animacao?.app ?? [])].map((a) => a.arquivo)));
  assert.deepEqual(readdirSync(web).sort(), [...nomesWeb].sort(), 'web: só os arquivos do catálogo');
  assert.deepEqual(readdirSync(app).sort(), [...nomesApp].sort(), 'app: só os arquivos do catálogo');
  assert.equal(assinar(web, nomesWeb), ASSINATURA_STU.web, 'web: o conjunto gerado (rode npm run mascote:gerar)');
  assert.equal(assinar(app, nomesApp), ASSINATURA_STU.app, 'app: o conjunto gerado (rode npm run mascote:gerar)');
  for (const item of itens) {
    for (const faixa of item.faixas) {
      assert.deepEqual(item.web.filter((a) => a.faixa === faixa).map((a) => a.densidade), tabela.web.densidades, `${item.nome} ${faixa}: WebP 1x e 2x`);
      assert.deepEqual(item.app.filter((a) => a.faixa === faixa).map((a) => a.densidade), tabela.app.densidades, `${item.nome} ${faixa}: PNG @1x, @2x e @3x`);
    }
    assert.ok(item.web.every((a) => a.arquivo.endsWith('.webp')) && item.app.every((a) => a.arquivo.endsWith('.png')));
  }
});

test('cada arquivo tem o tamanho do catálogo, fundo transparente e fica abaixo do teto da faixa', async () => {
  for (const item of itens) {
    for (const [pasta, arquivos] of [[web, item.web], [app, item.app]]) {
      for (const arquivo of arquivos) {
        const caminho = join(pasta, arquivo.arquivo);
        const meta = await sharp(caminho).metadata();
        assert.equal(Math.max(meta.width, meta.height), arquivo.px, `${arquivo.arquivo}: maior lado`);
        assert.equal(arquivo.px, FAIXAS_STU[arquivo.faixa].lado * arquivo.densidade, `${arquivo.arquivo}: lado da faixa × densidade`);
        assert.ok(Math.abs(meta.width / meta.height - item.proporcao[0] / item.proporcao[1]) < 0.02, `${arquivo.arquivo}: proporção do recorte`);
        assert.ok(meta.hasAlpha, `${arquivo.arquivo}: fundo transparente`);
        const bytes = statSync(caminho).size;
        assert.equal(bytes, arquivo.bytes, `${arquivo.arquivo}: peso do catálogo`);
        assert.ok(bytes <= FAIXAS_STU[arquivo.faixa].tetoKB * 1024, `${arquivo.arquivo}: ${bytes} bytes passa do teto de ${FAIXAS_STU[arquivo.faixa].tetoKB} KB`);
      }
    }
  }
});

test('o recorte segue a regra: quadro comum de 908 para o personagem, justo para a ilustração solta', () => {
  for (const item of itens) {
    const daTabela = tabela.itens.find((i) => i.nome === item.nome);
    assert.equal(item.recorte, daTabela.recorte);
    if (item.recorte === 'quadro') assert.deepEqual(item.proporcao, [908, 908], `${item.nome}: quadro comum`);
  }
  // Os da spec com caixa conhecida: caixa útil + 24 px (estudando: 58, 150, 908×724 → 956×772).
  assert.deepEqual(CATALOGO_STU['stu-estudando'].proporcao, [956, 772]);
  assert.deepEqual(CATALOGO_STU['stu-acolhida'].proporcao, [955, 931]);
});

test('nenhum original é servido', () => {
  assert.ok(relative(join(raiz, 'public'), originais).startsWith('..'), 'os originais ficam fora de public/');
  const deOriginais = new Set(listar(originais).map(hash));
  assert.equal(deOriginais.size, 31, 'os 31 originais do pacote estão na fonte');
  for (const arquivo of [...listar(join(raiz, 'public')), ...listar(join(raiz, 'apps/mobile/assets'))]) {
    assert.ok(!deOriginais.has(hash(arquivo)), `${relative(raiz, arquivo)} é um original`);
  }
});

test('a faixa vem do lado na tela, e cai na mais próxima que a imagem tem', () => {
  assert.equal(faixaDoLado(48), 'P');
  assert.equal(faixaDoLado(56), 'P');
  assert.equal(faixaDoLado(57), 'M');
  assert.equal(faixaDoLado(140), 'G');
  assert.equal(faixaDoLado(240), 'XG');
  assert.equal(faixaDoLado(400), 'XG');
  assert.equal(faixaDoStu('stu-feliz', 92), 'M');
  assert.equal(faixaDoStu('stu-surpreso', 48), 'M', 'sem P, sobe para a M');
  assert.equal(faixaDoStu('stu-feliz', 240), 'G', 'sem XG, fica na maior que tem');
});

test('o componente da web reserva o lugar antes de carregar (sem salto de layout)', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Mascote } = await import('../src/ui/mascote.tsx');
  const html = renderToStaticMarkup(createElement(Mascote, { expressao: 'stu-feliz', tamanho: 92 }));
  assert.match(html, /width="92" height="92"/, 'largura e altura no img');
  assert.match(html, /aspect-ratio:908 \/ 908/, 'proporção do recorte');
  assert.match(html, /srcSet="\/marca\/stu\/stu-feliz-96\.webp 1x, \/marca\/stu\/stu-feliz-192\.webp 2x"/, 'WebP 1x e 2x da faixa M');
  assert.match(html, /alt=""/, 'decorativo por padrão');
  const largo = renderToStaticMarkup(createElement(Mascote, { expressao: 'stu-estudando', tamanho: 132, decorativo: false }));
  assert.match(largo, /width="132" height="107"/, 'pose larga: o lado é a largura');
  assert.match(largo, /alt="Stu estudando no notebook"/);
});

// ——— Animado (spec 13, emenda de 19/11) ———
const animadas = itens.filter((item) => item.animacao);
/** Caixa do conteúdo (alfa > 128) de um quadro. */
async function caixaDoQuadro(arquivo, pagina = 0) {
  const { data, info } = await sharp(arquivo, { page: pagina }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 1) {
    if (data[(y * info.width + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return { x0, y0, x1, y1, largura: info.width, altura: info.height };
}

test('animado: só o personagem, nas faixas da E1, sempre reduzindo (até 330 px), dentro do teto por lado de saída', async () => {
  assert.ok(animadas.length >= 14, 'as 14 imagens do personagem que a E1 anima');
  const tetos = tabela.animado.tetos;
  for (const item of animadas) {
    assert.ok(item.nome.startsWith('stu-'), `${item.nome}: só o personagem anima`);
    assert.deepEqual([...item.animacao.faixas], tabela.itens.find((i) => i.nome === item.nome).faixasAnimadas, `${item.nome}: faixas da E1`);
    for (const [pasta, arquivos] of [[web, item.animacao.web], [app, item.animacao.app]]) {
      for (const arquivo of arquivos) {
        assert.ok(arquivo.px <= tabela.animado.ladoMax, `${arquivo.arquivo}: até ${tabela.animado.ladoMax} px de saída`);
        const caminho = join(pasta, arquivo.arquivo);
        const meta = await sharp(caminho, { animated: true }).metadata();
        assert.equal(meta.format, 'webp');
        assert.ok(meta.pages >= 20, `${arquivo.arquivo}: animado (${meta.pages} quadros)`);
        assert.equal(meta.loop, 0, `${arquivo.arquivo}: laço infinito`);
        assert.equal(meta.width, arquivo.largura);
        assert.equal(meta.pageHeight, arquivo.altura);
        const linha = tetos.find(([lado]) => arquivo.px <= lado);
        const teto = (item.nome === 'stu-acolhida' ? linha[2] : linha[1]) * 1024;
        assert.ok(statSync(caminho).size <= teto, `${arquivo.arquivo}: ${statSync(caminho).size} bytes passa do teto de ${teto / 1024} KB`);
      }
    }
    assert.deepEqual(item.animacao.app.map((a) => a.densidade).filter((d) => !tabela.animado.densidadesApp.includes(d)), [], `${item.nome}: app só @2x e @3x`);
  }
  for (const arquivo of [...listar(join(raiz, 'public')), ...listar(join(raiz, 'apps/mobile/assets'))]) assert.ok(!arquivo.endsWith('.gif'), `${relative(raiz, arquivo)}: GIF não é servido`);
});

test('parado e animado com as mesmas medidas: a figura do primeiro quadro cai sobre a parada', async () => {
  const desvios = [];
  for (const item of animadas) {
    const animado = item.animacao.web.find((a) => a.densidade === 2);
    const parado = item.web.find((a) => a.faixa === animado.faixa && a.densidade === 2);
    const cp = await caixaDoQuadro(join(web, parado.arquivo));
    const ca = await caixaDoQuadro(join(web, animado.arquivo));
    const [esquerda, topo, largura, altura] = item.animacao.caixa;
    // A camada animada em px do parado: a proporção da caixa é a do arquivo animado.
    const k = ((largura / 100) * cp.largura) / ca.largura;
    assert.ok(Math.abs(((altura / 100) * cp.altura) / ca.altura - k) / k < 0.02, `${item.nome}: a caixa tem a proporção do arquivo animado`);
    const x = (esquerda / 100) * cp.largura;
    const y = (topo / 100) * cp.altura;
    const pe = Math.abs(y + ca.y1 * k - cp.y1) / cp.largura;
    const centro = Math.abs(x + ((ca.x0 + ca.x1) / 2) * k - (cp.x0 + cp.x1) / 2) / cp.largura;
    desvios.push(`${item.nome} pé ${(pe * 100).toFixed(1)}% centro ${(centro * 100).toFixed(1)}%`);
    assert.ok(pe <= 0.04 && centro <= 0.06, `${item.nome}: o animado pula ao trocar (pé ${(pe * 100).toFixed(1)}%, centro ${(centro * 100).toFixed(1)}%)`);
  }
  console.log(desvios.join('\n'));
});

test('movimento reduzido, economia, fora da tela e aba escondida caem no parado', () => {
  const base = { pedido: true, temAnimacao: true, reduzido: false, visivel: true, oculta: false };
  assert.equal(deveAnimarStu(base), true);
  assert.equal(deveAnimarStu({ ...base, reduzido: true }), false, 'movimento reduzido (ou economia de dados)');
  assert.equal(deveAnimarStu({ ...base, visivel: false }), false, 'fora da tela');
  assert.equal(deveAnimarStu({ ...base, oculta: true }), false, 'aba escondida');
  assert.equal(deveAnimarStu({ ...base, pedido: false }), false, 'sem modo, parado');
  assert.equal(deveAnimarStu({ ...base, temAnimacao: false }), false);
  assert.equal(faixaAnimadaDoStu('stu-acolhida', 240), 'G', 'a XG não anima: fica na maior animada');
  assert.equal(faixaAnimadaDoStu('acessorio-fone', 40), null, 'acessório não anima');
});

test('o componente anima só no cliente: a primeira pintura é a imagem parada, com o mesmo lugar reservado', async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { Mascote } = await import('../src/ui/mascote.tsx');
  const parado = renderToStaticMarkup(createElement(Mascote, { expressao: 'stu-feliz', tamanho: 92, sombra: true }));
  const animado = renderToStaticMarkup(createElement(Mascote, { expressao: 'stu-feliz', tamanho: 92, sombra: true, animado: 'laco' }));
  assert.doesNotMatch(animado, /animado\.webp/, 'o arquivo animado não vem na primeira pintura');
  assert.match(animado, /width="92" height="92"/);
  assert.equal(animado.replace(/ data-mexendo="[^"]*"/, ''), parado, 'parado e animado reservam o mesmo lugar');
});
