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
  assert.doesNotMatch(regraDoSelo[0], /background|color/, 'o selo "Exemplo" herda o fundo branco e o texto do selo neutro do tema');
  assert.match(css, /\.cartao-trilha__tema, \.cartao-trilha__demo \{[^}]*background: #fff;[^}]*color: var\(--texto\)/s, 'o selo neutro, comum aos dois');
});
