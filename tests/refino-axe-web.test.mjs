// Banca P2-6 (#82), acessibilidade medida com o axe-core: 1 nó `color-contrast` no passo 1 de "Ver como funciona" (o selo "[1] Fonte do seu material": a ação sobre #E5EBFF dava 4,10:1) e, no Explorar,
// 40 nós `label-content-name-mismatch` (o nome acessível de 20 links de autor e de 20 botões "Curtir" não continha o texto que se vê). Junto, o vazio de Minhas trilhas (texto secundário sobre a lavanda: 4,47:1).
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

const canal = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const luminancia = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b); };
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const globais = ler('src/ui/jornada-tokens.css') + ler('src/app/globals.css');
const cor = (nome) => globais.match(new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{6})`))[1].toLowerCase();

test('o selo "[1] Fonte do seu material" usa a ação escura: a ação sobre #E5EBFF dava 4,10:1, a ação escura dá mais de 4,5:1', () => {
  const regra = /\.aula-citacao__selo \{([^}]*)\}/.exec(ler('src/app/aula.css'))?.[1] ?? '';
  assert.match(regra, /color: var\(--acao-escura\);/);
  assert.match(regra, /background: #e5ebff;/);
  assert.ok(contraste('#2563ff', '#e5ebff') < 4.5, 'a ação não bastava');
  assert.ok(contraste(cor('acao-escura'), '#e5ebff') >= 4.5, `a ação escura sobre #E5EBFF: ${contraste(cor('acao-escura'), '#e5ebff').toFixed(2)}:1`);
});

test('o vazio de Minhas trilhas usa o texto principal sobre a lavanda: o secundário dava 4,47:1', () => {
  assert.ok(contraste('#5e6a85', cor('ceu')) < 4.5, 'o secundário não bastava (4,47:1)');
  assert.match(globais, /\.planos-vazio \{[^}]*background: var\(--ceu\);/);
  assert.match(globais, /\.planos-vazio p \{ color: var\(--texto\);/);
  assert.ok(contraste(cor('texto'), cor('ceu')) >= 7, 'o texto principal sobre a lavanda passa com folga');
});

const acoes = { ocupado: null, abrir() {}, queroEstudar() {}, valeu() {}, compartilhar() {}, logado: false };
const cartaoDe = (extra = {}) => ({
  codigo: 'abc123', titulo: 'Violão do zero: primeiros acordes', tema: 'artes', legenda: 'Três acordes e uma batida.', totalLicoes: 6, totalPartes: 3, estudando: 5, valeus: 5,
  dono: { nome: 'Marina Costa', cor: 'azul', perfilId: 'p1', foto: 'cTFMq1-2MVcrecno' }, demonstracao: true, ...extra,
});
const desenhar = (cartao) => renderToStaticMarkup(createElement(CartaoDeTrilha, { cartao, acoes }));

/** O que a regra do axe confere (WCAG 2.5.3, rótulo no nome): o texto visível, sem pontuação e sem caixa, tem de estar dentro do nome acessível. */
const normal = (texto) => texto.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const decodificar = (texto) => texto.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
function rotulosDoCartao(html) {
  const achados = [];
  for (const m of html.matchAll(/<(a|button)\b([^>]*)\saria-label="([^"]*)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const visivel = decodificar(m[5].replace(/<span class="somente-leitor">[^<]*<\/span>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]*>/g, ''));
    achados.push({ tag: m[1], nome: decodificar(m[3]), visivel });
  }
  return achados;
}

test('no cartão de trilha, o nome acessível de cada link e botão com rótulo contém o texto visível (autor com e sem foto, com e sem curtidas, curtido ou não)', () => {
  for (const extra of [{}, { valeus: 0 }, { valeus: 1, valeuMeu: true }, { dono: { nome: 'Rafael Nunes', cor: 'verde', perfilId: 'p2' } }, { situacao: 'adicionada', planoId: 'x' }]) {
    const rotulos = rotulosDoCartao(desenhar(cartaoDe(extra)));
    assert.ok(rotulos.length >= 2, JSON.stringify(extra));
    for (const { tag, nome, visivel } of rotulos) {
      if (!normal(visivel)) continue; // só ícone: não há texto visível a conferir
      assert.ok(normal(nome).includes(normal(visivel)), `${tag}: o nome "${nome}" não contém o que se vê ("${visivel.trim()}") em ${JSON.stringify(extra)}`);
    }
  }
});

test('o link do autor se chama "por Fulano. Ver o perfil de Fulano" e o botão Curtir, "Curtir 5 curtidas: “Título”" (sem curtidas, o de sempre)', () => {
  const html = desenhar(cartaoDe());
  assert.match(html, /aria-label="por Marina Costa\. Ver o perfil de Marina Costa"/);
  assert.match(html, /aria-label="Curtir 5 curtidas: “Violão do zero: primeiros acordes”"/);
  assert.equal(c.por('Marina Costa'), 'por Marina Costa');
  assert.equal(c.perfilDe('Marina Costa'), 'Ver o perfil de Marina Costa');
  assert.match(desenhar(cartaoDe({ valeus: 0 })), /aria-label="Curtir “Violão do zero: primeiros acordes”"/, 'sem curtidas, o rótulo de sempre');
  // O "Curtir" e o número são dois textos separados por um espaço (sem ele a leitura do axe junta "Curtir5").
  assert.match(html, /<span aria-hidden="true">Curtir<\/span> <span class="cartao-trilha__valeu-n" aria-hidden="true">5<\/span>/);
});

test('a inicial do avatar sem foto vem do CSS (data-inicial), não de texto dentro do link ou botão que leva o avatar (o texto de enfeite fazia o nome não conter o que se vê)', () => {
  const html = renderToStaticMarkup(createElement(CartaoDeTrilha, { cartao: cartaoDe({ dono: { nome: 'Rafael Nunes', cor: 'verde', perfilId: 'p2' } }), acoes }));
  assert.match(html, /<span class="avatar" data-tamanho="p" data-inicial="R"[^>]*aria-hidden="true"><\/span>/, 'o avatar sem foto fica vazio, com a inicial no atributo');
  assert.doesNotMatch(html, /data-foto/, 'sem foto');
  const comFoto = renderToStaticMarkup(createElement(CartaoDeTrilha, { cartao: cartaoDe(), acoes }));
  assert.match(comFoto, /<span class="avatar" data-tamanho="p" data-foto="true" style="[^"]*" aria-hidden="true"><img /, 'com foto, a imagem e nenhuma inicial');
  assert.doesNotMatch(comFoto, /data-inicial/);
  assert.match(ler('src/app/compartilhar.css'), /\.avatar\[data-inicial\]::before \{ content: attr\(data-inicial\); \}/, 'e o CSS desenha a inicial');
});
