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

