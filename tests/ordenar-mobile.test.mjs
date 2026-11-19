import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Ordenar em lista única no app (spec 08, revisão do dono de 19/11): as regras da ordem (trocar, mover entre os livres com
// os travados no lugar, o destino do arrasto), rodadas aqui sem aparelho, e o que a tela e a lição precisam seguir.
const regras = await readFile(new URL('../apps/mobile/src/ordenar-regras.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(regras, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const m = {};
runInNewContext(outputText, { exports: m });
const tela = await readFile(new URL('../apps/mobile/src/ordenar.tsx', import.meta.url), 'utf8');
const licao = await readFile(new URL('../apps/mobile/src/licao.tsx', import.meta.url), 'utf8');

test('tocar em dois troca os dois de lugar', () => {
  assert.deepEqual(m.trocarDeLugar(['a', 'b', 'c', 'd'], 'a', 'c'), ['c', 'b', 'a', 'd']);
  assert.deepEqual(m.trocarDeLugar(['a', 'b'], 'b', 'a'), ['b', 'a']);
});

test('mover entre os livres: os travados (certos da tentativa anterior) não saem do lugar', () => {
  const nenhum = new Set();
  assert.deepEqual(m.moverEntreLivres(['a', 'b', 'c', 'd'], nenhum, 'a', 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(m.moverEntreLivres(['a', 'b', 'c', 'd'], nenhum, 'd', 0), ['d', 'a', 'b', 'c']);
  const travadoB = new Set(['b']);
  // "a" vai para o fim entre os livres (a, c, d): b fica na 2ª posição.
  assert.deepEqual(m.moverEntreLivres(['a', 'b', 'c', 'd'], travadoB, 'a', 2), ['c', 'b', 'd', 'a']);
  assert.deepEqual(m.moverEntreLivres(['a', 'b', 'c', 'd'], travadoB, 'd', 0), ['d', 'b', 'a', 'c']);
  assert.deepEqual(m.moverEntreLivres(['a', 'b', 'c'], nenhum, 'b', 99), ['a', 'c', 'b'], 'o destino fica dentro da lista');
});

test('o destino do arrasto conta os outros livres com o centro acima do centro do arrastado (caixas do começo)', () => {
  const caixas = { a: { y: 0, altura: 56 }, b: { y: 64, altura: 56 }, c: { y: 128, altura: 78 }, d: { y: 214, altura: 56 } };
  const nenhum = new Set();
  assert.equal(m.destinoDoArrasto(['a', 'b', 'c', 'd'], nenhum, 'a', caixas, 28), 0, 'parado: fica');
  assert.equal(m.destinoDoArrasto(['a', 'b', 'c', 'd'], nenhum, 'a', caixas, 170), 2, 'passou do meio de b e de c');
  assert.equal(m.destinoDoArrasto(['a', 'b', 'c', 'd'], new Set(['b']), 'a', caixas, 170), 1, 'o travado não conta');
});

test('a tela: arrastar com 180 ms no cartão e na hora pela alça, ações do leitor de tela, avisos e textos do contrato', () => {
  assert.match(tela, /activateAfterLongPress: Platform\.OS === 'web' \? undefined : 180/);
  assert.match(tela, /const pelaAlca = usePanGesture\(\{\n\s*enabled: podeArrastar, runOnJS: true, disableReanimated: true, minDistance: 1,/);
  // O plugin de Babel do react-native-worklets recusa espalhar objeto na configuração dos hooks do gesture-handler: o
  // bundle do app não fecha (achado no export da prévia, 19/11).
  for (const chamada of tela.match(/use[A-Z]\w*Gesture\(\{[\s\S]*?\n\s*\}\);/g) ?? []) assert.doesNotMatch(chamada, /\.\.\./, 'sem espalhar objeto na configuração do gesto');
  assert.match(tela, /name: 'moverParaCima', label: t\.moverParaCima/);
  assert.match(tela, /name: 'moverParaBaixo', label: t\.moverParaBaixo/);
  assert.match(tela, /t\.travadoRotulo\(texto, posicao\) : t\.cartaoRotulo\(posicao, total, texto\)/);
  assert.match(tela, /accessibilityState=\{\{ selected: estado === 'escolhido'/);
  // Na web, o react-native-web não lê o accessibilityState: o escolhido vai com aria-pressed (spec 08; achado na prévia, 19/11).
  assert.match(tela, /aria-pressed=\{estado === 'escolhido'\}/);
  for (const aviso of ['avisoEscolhido', 'avisoTrocaram', 'avisoPosicao']) assert.match(tela, new RegExp(`t\\.${aviso}\\(`));
  assert.match(tela, /escolhido \? t\.comoResponderEscolhido : t\.comoResponder/);
  assert.match(tela, /t\.voltarOrdemInicial/);
  assert.doesNotMatch(tela, /suaOrdem|disponiveis|t\.vaga|t\.colocar|t\.tirar|t\.recomecar/, 'nada das fichas');
  // Arrastando, a lista de verdade não muda de ordem (mover o elemento que segura o ponteiro derruba o gesto no navegador;
  // achado na prévia, 19/11): ela segue na ordem atual, sem cor, e a ordem nova aparece numa camada sem toque, por cima.
  assert.match(tela, /\{ordem\.map\(\(id, indice\) => \{/);
  assert.doesNotMatch(tela, /exibida/);
  assert.match(tela, /escondido=\{arrastado !== null\}/);
  assert.match(tela, /testID="ordenar-previa" pointerEvents="none"/);
  assert.match(tela, /\(previa \?\? ordem\)\.map\(\(id, indice\) => \(\n\s*<CartaoParado key=\{id\}/);
  // O lugar de cada cartão sai das alturas na ordem atual, não do y do onLayout (no react-native-web, o onLayout só dispara
  // quando o tamanho muda, e o y ficava velho depois de uma troca; achado na prévia, 19/11).
  assert.match(tela, /aoMedir=\{\(caixa\) => \{ alturas\.current\[id\] = caixa\.height; \}\}/);
  assert.match(tela, /const caixasDoComeco = caixasDaOrdem\(ordem\);/);
  assert.doesNotMatch(tela, /\{ y: caixa\.y, altura: caixa\.height \}/, 'sem guardar o y do onLayout');
  // Arrastando, a página não rola com o dedo; perto da borda, rola sozinha.
  assert.match(tela, /rolagem\?\.travar\(true\)/);
  assert.match(tela, /rolagem\.rolarPor\(para \* 8\)/);
});

test('a lição: o ordenar começa na ordem do servidor e a falta compara com a ordem do começo da tentativa', () => {
  assert.match(licao, /return exercicio\.tipo === 'ordenar' \? ordemInicial\(exercicio\) : '';/);
  assert.match(licao, /faltaParaVerificar\(exercicio, resposta, iniciais\[indice\]\)/);
  assert.match(licao, /respostaCompleta\(exercicio, resposta, iniciais\[indice\]\)/);
  assert.match(licao, /<Ordenar itens=\{atual\.itens\} valor=\{resposta\} inicial=\{iniciais\[indice\]\}/);
});
