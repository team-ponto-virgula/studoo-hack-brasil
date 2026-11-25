// Refinamento da UI (spec 16), a entrada larga na web (a partir de 1024 px). Item 2: a frase da ilustração fica num cartão (contraste) e o Stu da acolhida
// aparece inteiro na primeira dobra, com a base no alto da colina da frente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { elementos, renderizarCadastro, renderizarEntrada, visivel } from './auxiliares/render-acesso.mjs';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const css = ler('src/app/globals.css');
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
  assert.match(regra(css, '.entrada-mensagem__titulo'), /color: #0b1b5c;/);
  assert.match(css, /\.entrada-mensagem p:not\(\.entrada-mensagem__titulo\) \{[^}]*color: #5e6a85;/);
});

test('item 2: o texto cinza passa de 4,5:1 sobre o cartão, mesmo com o verde mais escuro da ilustração por baixo', () => {
  const [cartaoA] = [0.92];
  const sobre = (fundo) => fundo.map((canal) => Math.round(255 * cartaoA + canal * (1 - cartaoA)));
  for (const cenario of [[79, 157, 105], [196, 112, 77], [255, 255, 255], [214, 228, 255]]) {
    const fundo = sobre(cenario);
    assert.ok(contraste(hex('#5e6a85'), fundo) >= 4.5, `texto sobre ${cenario}: ${contraste(hex('#5e6a85'), fundo).toFixed(2)}`);
    assert.ok(contraste(hex('#0b1b5c'), fundo) >= 7, `título sobre ${cenario}`);
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

test('a entrada real usa uma saudação curta e a marca acessível, reservando o Stu para as boas-vindas', () => {
  const documento = renderizarEntrada();
  assert.equal(elementos(documento, 'h1')[0].textContent, 'Olá de novo.');
  assert.ok(elementos(documento, '*').some(e => e.getAttribute('role') === 'img' && e.getAttribute('aria-label') === 'Studoo'));
  assert.equal(elementos(documento, 'img').some(e => /stu-/.test(e.getAttribute('src') || '')), false);
  assert.ok(elementos(documento, 'a').some(e => e.getAttribute('href') === '/boas-vindas'));
});

test('as capacidades mantêm e-mail disponível e permitem criar por Google sem habilitar cadastro por senha', () => {
  const semAlternativas = renderizarEntrada({ google: false, cadastro: false, visitante: false, recuperacao: false });
  assert.ok(elementos(semAlternativas, 'input').some(e => e.getAttribute('id') === 'email' && visivel(e)));
  assert.equal(elementos(semAlternativas, 'a').some(e => e.getAttribute('href') === '/cadastro'), false);
  assert.equal(elementos(semAlternativas, 'button').some(e => e.textContent.includes('Continuar com Google')), false);
  assert.equal(elementos(semAlternativas, 'button').some(e => e.textContent === 'Experimentar sem conta' && visivel(e)), false);
  const googleSemEmail = renderizarCadastro({ googleDisponivel: true, emailDisponivel: false });
  assert.equal(elementos(googleSemEmail, 'input').length, 0, 'e-mail não aparece sem o provedor configurado');
  assert.ok(elementos(googleSemEmail, 'button').some(e => e.textContent.includes('Continuar com Google')));
  assert.ok(elementos(googleSemEmail, 'a').some(e => e.getAttribute('href') === '/login'));
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
