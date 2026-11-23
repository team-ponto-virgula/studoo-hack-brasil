// Banca P2-7 (#82), proposta da trilha: o nome da última lição ("Revisão: ponto médio, baricentro e alinhamento") era cortado pelo cenário da chegada: a estrada pontilhada passava POR CIMA do texto e, em 320 px,
// o chão da chegada cortava a última linha. Causa: o percurso (a lista de nós) era uma pilha de camadas isolada (`isolation: isolate`), e a chegada, que vem depois dele no documento (fora da lista), pintava
// por cima de tudo o que a lista tinha, inclusive do nome que desce do último nó para dentro da chegada. Sem o isolamento, os nós e a chegada dividem a pilha do mapa: o nome (z 2) fica por cima da estrada (z 1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const css = ler('src/app/previa-trilha.css');
const regra = (seletor) => new RegExp(`(?:^|\\n)${seletor.replace(/[.()[\]*+?^$|\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

test('o percurso da proposta não isola a pilha de camadas: nada que crie pilha (isolation, z-index, transform, opacity, filter, will-change, contain)', () => {
  const percurso = regra('.previa-percurso');
  assert.match(percurso, /position: relative;/);
  assert.doesNotMatch(percurso, /isolation|z-index|transform|opacity|filter|will-change|contain|mix-blend-mode|perspective/);
  assert.doesNotMatch(css, /\.previa-percurso \{[^}]*isolation: isolate/);
});

test('a chegada (o troféu e a estrada do último nó) vem DEPOIS da lista, fora dela: por isso a lista não pode ser uma pilha à parte', () => {
  const tela = ler('src/app/previa-trilha.tsx');
  const fimDaLista = tela.indexOf('</ol>');
  const chegada = tela.indexOf('className="previa-chegada"');
  assert.ok(fimDaLista > 0 && chegada > fimDaLista, 'a chegada está depois do fim da lista de nós');
  // O mapa é a pilha de todos eles (container-type: size cria a pilha), então o isolamento do percurso era redundante e só atrapalhava.
  assert.match(regra('.previa-mapa'), /container-type: size;/);
});

test('as camadas, na mesma pilha: o chão dos nós (auto) < a estrada (1) < o nome e o selo de parte (2), e o chão da chegada não tem z-index', () => {
  assert.match(regra('.previa-ligacao'), /z-index: 1;/, 'a estrada (de cada nó e a da chegada)');
  assert.match(css, /\.previa-no__alvo \{\s*--ladono: 68px; position: absolute; z-index: 2;/, 'o nó, com o nome dentro');
  assert.match(regra('.previa-marco'), /z-index: 2;/, 'o selo de parte');
  const chegada = regra('.previa-chegada');
  assert.ok(chegada.length > 0);
  assert.doesNotMatch(chegada, /z-index/, 'o chão da chegada fica no nível de baixo, em ordem de documento');
  assert.match(regra('.previa-no'), /position: relative; height: var\(--passo\); background: var\(--chao\);/, 'cada linha com o chão da região, sem z-index');
});
