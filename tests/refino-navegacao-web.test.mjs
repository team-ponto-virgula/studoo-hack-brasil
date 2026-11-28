// Refinamento da UI (spec 16), a navegação lateral da web (a partir de 1024 px). Item 18: os quatro itens (Minhas trilhas, Nova trilha, Explorar e Perfil) eram quatro estilos (link sem ícone,
// botão com borda, pílula branca com sombra e cartão com borda azul). Agora são iguais: 48 px, ícone de 20 (livro, lâmpada, bússola e pessoa, os da cápsula do app), rótulo 16 800, raio 14;
// fora da seleção sem fundo e com o texto em #0B1B5C; selecionado com fundo #E9E7FF e texto e ícone em #1D4ED8 (a subcápsula da barra de abas; o #2563FF da spec dá 4,03:1 sobre o lavanda e a paleta exige 4,5:1). "Perfil" continua embaixo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const estudo = ler('src/app/estudo.tsx');
const css = ler('src/app/globals.css');

test('item 18: os quatro itens da lateral levam a mesma classe e os ícones da cápsula do app (livro, lâmpada, bússola e pessoa)', () => {
  const lateral = estudo.slice(estudo.indexOf('<aside className="barra-lateral"'), estudo.indexOf('</aside>'));
  assert.match(lateral, /className="navegacao-item" onClick=\{\(\) => (?:navegar|irPara)\(\{ tipo: 'planos' \}\)\}[\s\S]*?>\s*<Icone nome="livro" \/>\{mensagens\.planos\.titulo\}/);
  assert.match(lateral, /className="navegacao-item navegacao-novo"[\s\S]*?>\s*<Icone nome="lampada" \/>\{mensagens\.planos\.novo\}/);
  assert.match(lateral, /className="navegacao-item navegacao-explorar"[\s\S]*?>\s*<Icone nome="bussola" \/>\{mensagens\.comunidade\.navegacao\}/);
  assert.match(lateral, /<button type="button" className="navegacao-item navegacao-perfil"[\s\S]*?>\s*<Icone nome="pessoa" \/>\s*<span>\{mensagens\.perfil\.navegacao\}<\/span>/);
  assert.equal((lateral.match(/navegacao-item/g) ?? []).length, 4, 'quatro itens, nem mais nem menos');
  // Os ícones são os mesmos da cápsula do celular.
  const capsula = estudo.slice(estudo.indexOf('<nav className="navegacao-mobile"'), estudo.indexOf('</nav>', estudo.indexOf('<nav className="navegacao-mobile"')));
  for (const icone of ['livro', 'lampada', 'bussola', 'pessoa']) assert.match(capsula, new RegExp(`<Icone nome="${icone}" />`), `a cápsula usa ${icone}`);
  // O "+" solto e o avatar com o nome saíram: o rótulo é o da cápsula.
  assert.doesNotMatch(lateral, /<span aria-hidden="true">\+<\/span>|<Avatar /);
  // "Perfil" continua embaixo, no rodapé da lateral, depois do "Como funciona?".
  assert.ok(lateral.indexOf('className="navegacao-rodape"') < lateral.indexOf('navegacao-perfil'));
});

test('item 18: 48 px de altura, ícone de 20, rótulo 16 em 800, raio 14; sem fundo e #0B1B5C fora da seleção; #E9E7FF e #1D4ED8 selecionado', () => {
  const comum = /\.barra-lateral \.navegacao \.navegacao-item, \.barra-lateral \.navegacao-rodape \.navegacao-item \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(comum, /min-height: 48px;/);
  assert.match(comum, /border-radius: 14px;/);
  assert.match(comum, /font-size: 1rem; font-weight: 800;/);
  assert.match(comum, /background: transparent;/, 'sem fundo fora da seleção');
  assert.match(comum, /color: #0b1b5c;/);
  assert.match(comum, /border: 0;/, 'sem a borda do botão e do cartão de antes');
  assert.match(css, /\.barra-lateral \.navegacao-item \.icone \{ flex: none; width: 20px; height: 20px; \}/);
  const selecionado = /\.barra-lateral \.navegacao \.navegacao-item\[aria-current\], [^{]*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(selecionado, /background: var\(--lavanda\);/);
  assert.match(selecionado, /color: var\(--acao-escura\);/, 'a ação escura (5,53:1), como a subcápsula da barra de abas: a ação sobre o lavanda dá 4,03:1');
  assert.match(selecionado, /box-shadow: none;/, 'sem a sombra da pílula branca de antes');
  assert.match(css, /--lavanda: #e9e7ff;/);
  assert.match(css, /--acao-escura: #1d4ed8;/);
  // Como na cápsula, o ícone selecionado é cheio.
  assert.match(css, /\.barra-lateral \.navegacao-item\[aria-current\] \.icone \{ fill: currentColor; \}/);
  // Os estilos antigos dos itens saíram (o cartão do Perfil, o gap e o ícone de 18 do Explorar, o botão com borda da Nova trilha).
  assert.doesNotMatch(ler('src/app/compartilhar.css'), /\.navegacao-perfil \{/);
  assert.doesNotMatch(ler('src/app/comunidade.css'), /\.navegacao-explorar \{/);
  assert.doesNotMatch(css, /\.navegacao-novo \{ margin-top: 12px; \}/);
});
