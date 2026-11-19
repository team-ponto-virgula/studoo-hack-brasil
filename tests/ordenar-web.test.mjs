// Ordenar em lista única na web (spec 08, revisão de 19/11): as regras iguais às do app, a primeira pintura na ordem do
// servidor, os nomes acessíveis, os estados e a ligação com a aula.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { faltaParaVerificar, respostaCompleta, respostaParaTentarDeNovo } from '@studoo/contratos';
import { mensagens, textoDaFalta } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const t = mensagens.licao.ordenar;
const { Ordenar } = await import('../src/app/ordenar.tsx');
const { moverEntreLivres, trocarDeLugar, destinoDoArrasto } = await import('../src/app/ordenar-regras.ts');
const itens = [{ id: 'a', texto: 'Mostrar o passaporte' }, { id: 'b', texto: 'Despachar a mala' }, { id: 'c', texto: 'Pegar o cartão' }, { id: 'd', texto: 'Embarcar' }];
const desenhar = (props) => renderToStaticMarkup(createElement(Ordenar, { itens, valor: 'a,b,c,d', inicial: 'a,b,c,d', mudar() {}, desativado: false, ...props }));
const rotulos = (html) => [...html.matchAll(/aria-label="([^"]+)"/g)].map(([, r]) => r);

test('as regras puras são as mesmas do app (arquivo idêntico)', () => {
  assert.equal(readFileSync(join(raiz, 'src/app/ordenar-regras.ts'), 'utf8'), readFileSync(join(raiz, 'apps/mobile/src/ordenar-regras.ts'), 'utf8'));
  assert.deepEqual(trocarDeLugar(['a', 'b', 'c'], 'a', 'c'), ['c', 'b', 'a']);
  assert.deepEqual(moverEntreLivres(['a', 'b', 'c', 'd'], new Set(['b']), 'd', 0), ['d', 'b', 'a', 'c'], 'o travado não sai do lugar');
  assert.equal(destinoDoArrasto(['a', 'b', 'c'], new Set(), 'a', { a: { y: 0, altura: 50 }, b: { y: 58, altura: 50 }, c: { y: 116, altura: 50 } }, 120), 1);
});

test('começa na ordem do servidor, numerada, com a linha de como responder e sem "Voltar à ordem inicial"', () => {
  const html = desenhar();
  assert.match(html, new RegExp(t.comoResponder));
  assert.deepEqual(rotulos(html), itens.map((item, i) => t.cartaoRotulo(i + 1, 4, item.texto)));
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 4, 'nenhum escolhido');
  assert.doesNotMatch(html, new RegExp(t.voltarOrdemInicial));
  assert.doesNotMatch(html, /type="checkbox"|draggable="true"/, 'nada do sistema');
});

test('depois de mudar: a ordem da lista é a resposta e aparece "Voltar à ordem inicial"', () => {
  const html = desenhar({ valor: 'b,a,c,d' });
  assert.deepEqual(rotulos(html).slice(0, 2), [t.cartaoRotulo(1, 4, 'Despachar a mala'), t.cartaoRotulo(2, 4, 'Mostrar o passaporte')]);
  assert.match(html, new RegExp(t.voltarOrdemInicial));
});

test('depois de verificar, certo em verde e errado em âmbar; na nova tentativa, o certo fica travado', () => {
  const verificado = desenhar({ valor: 'a,c,b,d', certos: ['a', 'd'], desativado: true });
  assert.deepEqual([...verificado.matchAll(/data-estado="(\w+)"/g)].map(([, e]) => e), ['certo', 'errado', 'errado', 'certo']);
  assert.doesNotMatch(verificado, new RegExp(t.voltarOrdemInicial), 'verificado não volta');
  const nova = desenhar({ valor: 'a,c,b,d', inicial: 'a,c,b,d', fixos: ['a', 'd'] });
  assert.equal(rotulos(nova)[0], t.travadoRotulo('Mostrar o passaporte', 1));
  assert.equal(rotulos(nova)[3], t.travadoRotulo('Embarcar', 4));
  assert.equal(t.travadoRotulo('Mostrar o passaporte no balcão', 1), '“Mostrar o passaporte no balcão”, na posição 1: já está certo.');
});

test('a aula: começa completa mas só verifica depois de mudar; nova tentativa compara com a ordem dela', () => {
  const exercicio = { tipo: 'ordenar', enunciado: 'Ordene', itens };
  assert.equal(respostaCompleta(exercicio, 'a,b,c,d', 'a,b,c,d'), false);
  assert.equal(textoDaFalta(faltaParaVerificar(exercicio, 'a,b,c,d', 'a,b,c,d')), 'Mude a ordem para verificar.');
  assert.equal(respostaCompleta(exercicio, 'b,a,c,d', 'a,b,c,d'), true);
  const nova = respostaParaTentarDeNovo(exercicio, 'a,c,b,d', { correta: false, feedback: '', comprovante: '', certos: ['a', 'd'] });
  assert.equal(nova, 'a,c,b,d', 'a ordem inteira, sem vagas');
  assert.equal(respostaCompleta(exercicio, nova, nova), false);
  const aula = readFileSync(join(raiz, 'src/app/aula.tsx'), 'utf8');
  assert.match(aula, /respostaCompleta\(exercicio, resposta, iniciais\[indice\]\)/);
  assert.match(aula, /faltaParaVerificar\(exercicio, resposta, iniciais\[indice\]\)/);
  assert.doesNotMatch(aula, /t\.ordenar\.(suaOrdem|disponiveis|vazio|vaga|colocar|tirar)/, 'as fichas saíram');
});
