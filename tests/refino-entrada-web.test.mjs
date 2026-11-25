// Refinamento da UI (spec 16), a entrada larga na web (a partir de 1024 px). Item 2: a frase da ilustração fica num cartão (contraste) e o Stu da acolhida
// aparece inteiro na primeira dobra, com a base no alto da colina da frente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const css = ler('src/app/globals.css').replace(/((?:font-size|line-height):\s*)([\d.]+)rem/g, (_, nome, valor) => `${nome}${Number(valor) * 16}px`);
/** O corpo da primeira regra com este seletor exato. */
const regra = (folha, seletor) => {
  const inicio = folha.indexOf(`${seletor} {`);
  assert.ok(inicio >= 0, `regra ${seletor}`);
  return folha.slice(inicio, folha.indexOf('}', inicio));
};
const luminancia = ([r, g, b]) => {
  const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};
const contraste = (a, b) => { const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x); return (claro + 0.05) / (escuro + 0.05); };
const hex = (cor) => [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16));

test('item 2: a frase da ilustração vai para um cartão no alto à esquerda, branco a 92%, raio 24, respiro 24, até 480 px', () => {
  const cartao = regra(css, '.entrada-mensagem');
  assert.match(cartao, /position: absolute;/);
  assert.match(cartao, /top: 24px; right: 24px; left: 24px; max-width: 480px;/, 'no alto à esquerda, com o respiro da borda e a largura máxima');
  assert.match(cartao, /padding: 24px; border-radius: 24px;/);
  assert.match(cartao, /background: rgb\(255 255 255 \/ 0\.92\);/);
  assert.match(cartao, /z-index: 1;/, 'acima dos temas da ilustração, que ficam atrás');
  assert.match(cartao, /backdrop-filter: blur\(8px\);/, 'com letra grande o cartão cresce e um tema não pode aparecer fantasma sob o texto');
  assert.match(regra(css, '.entrada-mensagem__titulo'), /color: var\(--texto\);/);
  assert.match(css, /\.entrada-mensagem p:not\(\.entrada-mensagem__titulo\) \{[^}]*color: var\(--texto2\);/);
});

test('item 2: o texto cinza passa de 4,5:1 sobre o cartão, mesmo com o verde mais escuro da ilustração por baixo', () => {
  const [cartaoA] = [0.92];
  const sobre = (fundo) => fundo.map((canal) => Math.round(255 * cartaoA + canal * (1 - cartaoA)));
  for (const cenario of [[79, 157, 105], [196, 112, 77], [255, 255, 255], [214, 228, 255]]) {
    const fundo = sobre(cenario);
    assert.ok(contraste(hex('#50607a'), fundo) >= 4.5, `texto sobre ${cenario}: ${contraste(hex('#50607a'), fundo).toFixed(2)}`);
    assert.ok(contraste(hex('#15275b'), fundo) >= 7, `título sobre ${cenario}`);
  }
});

test('item 2: a ilustração tem a altura da janela e fica presa no alto, então o Stu fica inteiro na primeira dobra, com a base no alto da colina', () => {
  const arte = regra(css, '.entrada-arte');
  assert.match(arte, /position: sticky; top: 0; align-self: start; height: 100vh; height: 100svh;/);
  const stu = regra(css, '.entrada-paisagem .stu');
  assert.match(stu, /width: 26cqw;/, 'o tamanho da spec 13');
  // A base do Stu é o alto da colina da frente: a colina começa 6% abaixo do pé e tem 24% de altura.
  const colina = regra(ler('src/ui/mundo.css'), '.paisagem__colina--frente');
  const embaixo = Number(/bottom: (-?\d+)%/.exec(colina)[1]);
  const altura = Number(/height: (\d+)%/.exec(colina)[1]);
  const base = Number(/bottom: (\d+)%/.exec(stu)[1]);
  assert.equal(base, embaixo + altura, `o Stu pisa a ${embaixo + altura}% do pé, onde a colina da frente termina`);
});

test('item 2: a entrada continua com o título e o texto na mensagem da ilustração e com o Stu da acolhida', () => {
  const tela = ler('src/app/login/entrada.tsx');
  assert.match(tela, /<div className="entrada-mensagem">\s*<p className="entrada-mensagem__titulo">\{mensagens\.login\.arteTitulo\}<\/p>\s*<p>\{mensagens\.login\.arteTexto\}<\/p>\s*<\/div>/);
  assert.match(tela, /<Mascote expressao="stu-acolhida" tamanho=\{240\} sombra className="stu" \/>/);
  // Até 1023 px a ilustração larga some (a faixa do celular tem o Stu dela): o sticky não pesa nas telas estreitas.
  assert.match(css, /@media \(max-width: 1023px\) \{[^@]*\.entrada-arte \{ display: none; \}/);
});

test('item 10: até 767 px o stu-acolhida de 72, acenando, fica à direita do título, alinhado ao topo; a faixa de paisagem sai em qualquer altura', () => {
  const tela = ler('src/app/login/entrada.tsx');
  assert.match(tela, /<div className="entrada-titulo-faixa">\s*<h1>\{mensagens\.login\.titulo\}<\/h1>\s*<Mascote expressao="stu-acolhida" tamanho=\{72\} prioridade animado="laco" className="entrada-stu-celular" \/>\s*<\/div>/);
  // De 768 px em diante a faixa some e o Stu do celular também: o Stu da ilustração larga (≥1024) e o da faixa de 768 a 1023 seguem como eram.
  assert.match(css, /\.entrada-titulo-faixa \{ display: contents; \}\s*\.entrada-stu-celular \{ display: none; \}/);
  const celular = css.slice(css.indexOf('.entrada-titulo-faixa { display: contents; }'));
  assert.match(celular, /@media \(max-width: 767px\) \{\s*\.entrada-banner \{ display: none; \}/, 'a faixa de paisagem sai em qualquer altura (antes só até 860 px)');
  assert.match(celular, /\.entrada-titulo-faixa \{ display: grid; grid-template-columns: minmax\(0, 1fr\) 72px; align-items: start; column-gap: 12px; \}/, 'o título e o Stu lado a lado, o Stu alinhado ao topo do título');
  assert.match(celular, /\.entrada-stu-celular \{ display: block; width: 72px;/);
});

test('item 10: o título encolhe para dar lugar ao Stu e não passa de 3 linhas em 360 px (e em 320 px a letra desce mais um pouco)', () => {
  const celular = css.slice(css.indexOf('.entrada-titulo-faixa { display: contents; }'));
  assert.match(celular, /\.entrada-titulo-faixa h1 \{ font-size: 26px; line-height: 32px; letter-spacing: -0\.5px; \}/);
  assert.match(celular, /@media \(max-width: 340px\) \{ \.entrada-titulo-faixa h1 \{ font-size: 22px; line-height: 28px; \} \}/);
  // As regras antigas de 28/34 seguem para as outras telas do cabeçalho (o título da entrada é o único com o Stu ao lado).
  assert.match(css, /\.entrada-cabecalho h1 \{ font-size: 28px; line-height: 34px; letter-spacing: -0\.5px; \}/);
});

test('item 10: com movimento reduzido o Stu fica parado (o Mascote nem pede a animação)', () => {
  const mascote = ler('src/ui/mascote.tsx');
  assert.match(mascote, /movimento reduzido ou economia de dados \(o arquivo nem é pedido\)/);
  assert.match(mascote, /prefers-reduced-motion: reduce/);
});
