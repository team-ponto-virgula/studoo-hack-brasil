// Refinamento da UI (spec 16), Explorar na web: o selo "Exemplo" (item 9), a pílula da posição no Em alta (item 16) e a capa só com o tema (item 17).
// Cada item entra com o seu teste; a primeira tela de cada um é o HTML de servidor do cartão de trilha, o mesmo que o navegador hidrata.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mensagens } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { CartaoDeTrilha } = await import('../src/app/comunidade.tsx');
const c = mensagens.comunidade;

const acoes = { ocupado: null, abrir() {}, queroEstudar() {}, valeu() {}, compartilhar() {}, logado: false };
const cartaoDe = (extra = {}) => ({
  codigo: 'abc123', titulo: 'Violão do zero: primeiros acordes', tema: 'artes', legenda: 'Três acordes e uma batida.', totalLicoes: 6, totalPartes: 3, estudando: 5, valeus: 5,
  dono: { nome: 'Marina Costa', cor: 'azul', perfilId: 'p1' }, demonstracao: true, ...extra,
});
const desenhar = (cartao, props = {}) => renderToStaticMarkup(createElement(CartaoDeTrilha, { cartao, acoes, ...props }));
const visivel = (html) => html.replace(/<span class="somente-leitor">[^<]*<\/span>/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('item 9: o contrato diz "Exemplo", com o nome inteiro para o leitor de tela, e a honestidade do aviso continua', () => {
  assert.equal(c.demonstracao, 'Exemplo');
  assert.equal(c.demonstracaoRotulo, 'Exemplo criado pelo Studoo para mostrar o app');
  assert.match(c.demonstracaoAviso, /rótulo “Exemplo”\.$/, 'a folha de compartilhar promete o mesmo selo');
  assert.match(c.demonstracaoExplica, /^“Exemplo” marca conteúdo criado pelo Studoo para mostrar o app\.$/, 'o app ainda usa esta chave até tirar o parágrafo; ela fica coerente');
  // O perfil fictício segue com o nome dele (é outro selo, de outro assunto).
  assert.equal(c.perfilDemo, 'Perfil de demonstração');
});

test('item 9: o cartão de conteúdo sintético leva o selo "Exemplo" (escondido do leitor, que ouve o nome inteiro); o de verdade não leva selo nenhum', () => {
  const html = desenhar(cartaoDe());
  assert.match(html, /<span class="cartao-trilha__demo"><span aria-hidden="true">Exemplo<\/span><span class="somente-leitor">Exemplo criado pelo Studoo para mostrar o app<\/span><\/span>/);
  assert.doesNotMatch(html, /Demonstração/);
  assert.match(visivel(html), /Artes e música/, 'o tema continua na capa');
  assert.doesNotMatch(desenhar(cartaoDe({ demonstracao: false })), /cartao-trilha__demo|Exemplo/);
});

test('item 9: o parágrafo que explicava o selo saiu do alto do Explorar, e o selo usa o estilo neutro do tema (nada de amarelo)', () => {
  const tela = ler('src/app/comunidade.tsx');
  assert.doesNotMatch(tela, /explorar__demo|comDemonstracao|demonstracaoExplica/, 'sem o parágrafo, na web');
  const css = ler('src/app/comunidade.css');
  assert.doesNotMatch(css, /explorar__demo/);
  const regraDoSelo = css.split('\n').filter((linha) => /^\.cartao-trilha__demo\s*\{/.test(linha));
  assert.equal(regraDoSelo.length, 1);
  assert.match(regraDoSelo[0], /padding: 0 10px;[^}]*background: var\(--nevoa\); color: var\(--texto2\); font-size: 0\.8125rem; font-weight: 800; line-height: 20px;/, 'o selo "Exemplo" é o neutro da spec 10 (spec 14, linha 63), igual ao do app: fundo #F1F4FD, texto #5E6A85, 13 px 800, 20 de altura, 10 de respiro');
  assert.doesNotMatch(regraDoSelo[0], /#fff1cc|#fff6ea|#704700|amarel/i, 'nada de amarelo');
});

test('item 16: a posição no Em alta tem o texto da pílula ("1º") e o do leitor de tela ("1º em alta"), no contrato, para a web e o app', () => {
  assert.equal(c.posicaoSelo(1), '1º');
  assert.equal(c.posicaoSelo(10), '10º');
  assert.equal(c.posicao(1), '1º em alta');
  assert.equal(c.posicao(3), '3º em alta');
  assert.doesNotMatch(c.posicao(2), /lugar/, 'era "2º lugar"');
  // O leitor de tela da web já usa o texto do contrato na capa do Em alta.
  assert.match(ler('src/app/comunidade.tsx'), /<p className="somente-leitor">\{c\.posicao\(posicao\)\}<\/p>/);
});

test('item 16: a posição no Em alta é uma pílula pequena no alto à direita da capa ("1º"), não mais o numeral gigante', () => {
  const html = desenhar(cartaoDe(), { posicao: 1 });
  const capa = html.slice(html.indexOf('<div class="cartao-trilha__capa">'), html.indexOf('<div class="cartao-trilha__corpo">'));
  assert.match(capa, /<span class="cartao-trilha__posicao" aria-hidden="true">1º<\/span>/, 'a pílula "1º" na capa, escondida do leitor');
  assert.match(html, /<p class="somente-leitor">1º em alta<\/p>/, 'o leitor de tela ouve "1º em alta"');
  assert.doesNotMatch(visivel(html), /\b1\b(?!º)/, 'nenhum "1" solto como numeral');
  assert.doesNotMatch(desenhar(cartaoDe()), /cartao-trilha__posicao|em alta/, 'fora do Em alta não há pílula nem texto de posição');
  const css = ler('src/app/comunidade.css');
  const pilula = css.slice(css.indexOf('.cartao-trilha__posicao {'), css.indexOf('}', css.indexOf('.cartao-trilha__posicao {')));
  assert.match(pilula, /top: 10px; right: 10px;/, 'no canto superior direito');
  assert.match(pilula, /height: 24px;/, '24 de altura');
  assert.match(pilula, /border-radius: 12px;/, 'raio 12');
  assert.match(pilula, /font-size: 0\.8125rem; font-weight: 800;/, '13 px 800');
  assert.match(pilula, /color: #0b1b5c;/);
  assert.match(pilula, /background: #fff;/, 'sobre branco');
  assert.doesNotMatch(pilula, /(?<![\d.])5rem|text-stroke|bottom:/, 'o numeral gigante (5rem) com contorno saiu');
  assert.match(css, /\.cartao-trilha__capa:has\(\.cartao-trilha__posicao\) \.cartao-trilha__tema \{ max-width: 72%; \}/, 'o selo do tema deixa a vez da pílula: até 72% da largura da capa, como no app');
});

test('item 17: a capa leva só o selo do tema; o "Exemplo" vai para a linha de informações ("6 lições · 3 partes · Exemplo"), com o nome inteiro para o leitor de tela', () => {
  const html = desenhar(cartaoDe());
  const capa = html.slice(html.indexOf('<div class="cartao-trilha__capa">'), html.indexOf('<div class="cartao-trilha__corpo">'));
  assert.match(capa, /cartao-trilha__tema/, 'o tema fica na capa');
  assert.doesNotMatch(capa, /cartao-trilha__demo|Exemplo/, 'o "Exemplo" saiu da capa');
  const meta = /<p class="cartao-trilha__meta">(.*?)<\/p>/.exec(html)?.[1] ?? '';
  assert.equal(visivel(`<p>${meta}</p>`).trim(), '6 lições · 3 partes · Exemplo', 'a linha que se vê');
  assert.match(meta, /<span class="cartao-trilha__demo"><span aria-hidden="true">Exemplo<\/span><span class="somente-leitor">Exemplo criado pelo Studoo para mostrar o app<\/span><\/span>/, 'o leitor ouve o nome inteiro (item 9)');
  assert.match(meta, /<span aria-hidden="true">·<\/span>/, 'o ponto separador não é lido');
  // O cartão de verdade, sem conteúdo sintético, fica só com a contagem.
  assert.equal(visivel(`<p>${/<p class="cartao-trilha__meta">(.*?)<\/p>/.exec(desenhar(cartaoDe({ demonstracao: false })))?.[1]}</p>`).trim(), '6 lições · 3 partes');
});
