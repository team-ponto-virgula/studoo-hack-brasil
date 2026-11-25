import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { jornadaAzul } from '../packages/contratos/src/jornada-azul.ts';

// Jornada Azul mantém o Stu e centraliza a interface. O app deve consumir os tokens,
// em vez de declarar uma segunda paleta que possa divergir da web.
const pasta = new URL('../apps/mobile/src/', import.meta.url);
const tema = readFileSync(new URL('tema.ts', pasta), 'utf8');

test('tema.ts usa a paleta compartilhada da Jornada Azul e preserva as cores do Stu', () => {
  assert.match(tema, /import \{ jornadaAzul \} from '\.\.\/\.\.\/\.\.\/packages\/contratos\/src\/jornada-azul';/);
  assert.match(tema, /export const cores = jornadaAzul\.cores;/);
  for (const [chave, valor] of [['texto', '#15275B'], ['acao', '#2457DD'], ['acaoEscura', '#173B9C'], ['ouro', '#FBBF24'], ['ceu', '#E9E7FF']]) {
    assert.equal(jornadaAzul.cores[chave], valor, `${chave} ${valor}`);
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
