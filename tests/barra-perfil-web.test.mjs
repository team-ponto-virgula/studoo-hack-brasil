import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('o Perfil só fixa a única ação quando há alteração, sem teclado e fora da área visível', () => {
  const tela = readFileSync('src/app/perfil.tsx', 'utf8');
  const css = readFileSync('src/app/perfil.css', 'utf8');
  assert.doesNotMatch(tela, /p\.tudoSalvo/);
  assert.match(tela, /presa = alterado && foraDaVista/);
  assert.match(tela, /raiz\.dataset\.teclado !== 'true'/);
  assert.match(tela, /caixa\.top < topo \|\| caixa\.bottom > base/);
  assert.match(css, /\.editor-perfil__barra\[data-presa\]\s*\{\s*position: fixed/);
  assert.equal(tela.match(/<Botao type="submit"/g).length, 1);
});
