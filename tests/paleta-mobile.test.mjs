import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

// Paleta do kit no app (spec 13, B5), como tests/paleta.test.mjs faz na web: as cores de marca vêm de tema.ts, e o azul e o
// marinho antigos não voltam escritos à mão nas telas (em hexadecimal nem em rgba). Os tons claros da opção marcada
// (#9FB1F0, #EEF2FF) continuam, iguais aos da web.
const pasta = new URL('../apps/mobile/src/', import.meta.url);
const tema = readFileSync(new URL('tema.ts', pasta), 'utf8');

test('tema.ts tem as cores do kit', () => {
  for (const [chave, valor] of [['texto', '#0B1B5C'], ['acao', '#2563FF'], ['acaoEscura', '#1D4ED8'], ['ouro', '#FBBF24'], ['ceu', '#E9E7FF']]) {
    assert.match(tema, new RegExp(`\\b${chave}: '${valor}'`, 'i'), `${chave} ${valor}`);
  }
});

test('nenhuma cor antiga escrita à mão nas telas do app', () => {
  const antigas = /#3858d6|#2a44a8|#1b2a5e|#eef3ff|#ffd166|rgba?\(\s*56,\s*88,\s*214|rgba?\(\s*27,\s*42,\s*94/i;
  const achados = [];
  for (const nome of readdirSync(pasta).filter((arquivo) => /\.(ts|tsx)$/.test(arquivo))) {
    readFileSync(new URL(nome, pasta), 'utf8').split('\n').forEach((linha, indice) => {
      if (antigas.test(linha)) achados.push(`${nome}:${indice + 1}: ${linha.trim().slice(0, 100)}`);
    });
  }
  assert.deepEqual(achados, []);
});
