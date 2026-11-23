// Refinamento da UI (spec 16), lote 1, a aula na web: item 4 (Conceito e Exemplo curtos), 5 (a dica das teclas), 6 (o quadrinho da letra), 8 (a contagem da resposta aberta) e 11 (a frase
// sobre pular). As contas (itens 4 e 8) são puras e vivem no contrato, para o app usar a mesma (tests/refino-aula-contrato.test.mjs); aqui o fonte e o CSS da tela conferem o resto. A prova no navegador está nas capturas antes e depois da entrega.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const css = ler('src/app/aula.css');
const aula = ler('src/app/aula.tsx');
/** O corpo da primeira regra com este seletor exato. */
const regra = (folha, seletor) => {
  const inicio = folha.indexOf(`${seletor} {`);
  assert.ok(inicio >= 0, `regra ${seletor}`);
  return folha.slice(inicio, folha.indexOf('}', inicio));
};

test('item 5: a dica "use as teclas de A a C" só aparece com teclado e ponteiro fino (hover: hover e pointer: fine) e nunca no app', () => {
  assert.match(css, /\.opcoes-atalho \{ display: none;/, 'escondida por padrão (toque)');
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\) \{\s*\.opcoes-atalho \{ display: block; \}/);
  assert.match(aula, /<p className="opcoes-atalho">\{t\.atalho\(exercicio\.opcoes\.length\)\}<\/p>/);
  for (const arquivo of ['apps/mobile/src/licao.tsx', 'apps/mobile/src/estudo.tsx']) assert.doesNotMatch(ler(arquivo), /licao\.atalho|\bt\.atalho\(/, `${arquivo}: o app não tem a dica`);
});

test('item 6: o quadrinho da letra cresce com o texto (1,75 × a letra, mínimo 30, quadrado, raio 9) e o texto da opção quebra ao lado', () => {
  const tecla = regra(css, '.opcao-tecla');
  assert.match(tecla, /width: max\(30px, 1\.75em\);/, 'lado de 1,75 × o tamanho da letra (em), no mínimo 30 px');
  assert.match(tecla, /aspect-ratio: 1;/, 'sempre quadrado');
  assert.match(tecla, /border-radius: 9px;/);
  assert.match(tecla, /place-items: center;/, 'a letra no centro');
  assert.match(tecla, /flex: none;/, 'o quadrinho não encolhe nem estica');
  assert.match(tecla, /font-size: 0\.875rem;/, 'a letra é rem: com o texto ampliado ela e o quadrinho crescem juntos');
  assert.doesNotMatch(tecla, /height: 30px/, 'sem altura fixa');
  assert.match(css, /:is\(\.aula-quadro, \.estudio-desafio, \.resolva\) \.opcoes label > :not\(input, \.opcao-tecla\) \{ flex: 1 1 0; min-width: 0; overflow-wrap: anywhere; \}/, 'o texto ocupa o resto da largura e quebra sem passar por baixo do quadrinho');
});

test('item 8: o contador é cinza #5E6A85 (sem laranja), guarda o espaço quando escondido e o leitor só o ouve enquanto aparece', () => {
  assert.match(aula, /const contando = mostrarContagemDaAberta\(usados, exercicio\.minimo\);/);
  assert.match(aula, /aria-describedby=\{contando \? 'aberta-dica aberta-contador' : 'aberta-dica'\}/);
  assert.match(aula, /<p id="aberta-contador" className="campo__contador" data-oculto=\{contando \? undefined : ''\}>/);
  assert.doesNotMatch(aula, /data-pronto=\{tamanhoDaResposta/, 'o verde de "N letras" saiu');
  assert.match(css, /\.campo--aberta \.campo__contador \{ color: var\(--texto2\); \}/);
  assert.match(ler('src/app/globals.css'), /--texto2: #5e6a85;/, 'a cor do contador é a #5E6A85 da spec');
  assert.match(css, /\.campo--aberta \.campo__contador\[data-oculto\] \{ visibility: hidden; \}/, 'escondido, o espaço fica (o campo não pula)');
  assert.doesNotMatch(css, /\.campo__contador\[data-pronto\]/);
});

