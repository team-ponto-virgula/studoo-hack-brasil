import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Geração que se acompanha (spec 04, revisão de 19/11): os tempos da spec e as regras de quando a tela acompanha, sem
// aparelho. O módulo do app é transpilado e rodado aqui, como o da entrada.
const fonte = await readFile(new URL('../apps/mobile/src/geracao-ritmo.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const m = {};
runInNewContext(outputText, { exports: m });
const { RITMO_DA_GERACAO: R, intervaloDaFila, atrasosDaLicao, rolagemDaVaga, deixouDeAcompanhar, vagaAVista, comMaisUma } = m;

test('os tempos de cada lição que nasce são os da spec 04', () => {
  assert.deepEqual(
    [R.rolagemMs, R.linhaAtrasoMs, R.linhaMs, R.noAtrasoMs, R.noQueda, R.noMs, R.anelMs, R.nomeAtrasoMs, R.nomeMs, R.cenarioAtrasoMs, R.cenarioMs, R.esperaAtrasoMs, R.stuMs],
    [320, 120, 300, 320, 26, 380, 1200, 420, 220, 560, 260, 700, 400],
  );
  assert.equal(R.posicaoDaVaga, 0.6);
  assert.deepEqual([R.marcoQueda, R.marcoMs, R.depoisDoMarcoMs, R.maisUmaMs, R.pararAcimaDe, R.esperaLongaMs, R.reduzidoMs, R.vistoPorLinhaMs],
    [12, 260, 200, 900, 40, 12000, 150, 80]);
});

test('na fila, cada lição começa quando a anterior chega ao passo 3; com marco antes, 200 ms depois', () => {
  assert.equal(intervaloDaFila(false), 320);
  assert.equal(intervaloDaFila(true), 520);
  assert.deepEqual({ ...atrasosDaLicao(false) }, { linha: 120, no: 320, nome: 420, cenario: 560, espera: 700 });
  assert.deepEqual({ ...atrasosDaLicao(true) }, { linha: 320, no: 520, nome: 620, cenario: 760, espera: 900 });
});

test('a vaga fica a 60% da altura do mapa, abaixo da faixa presa, sem rolar antes do começo', () => {
  // Mapa visível de 600 (650 de rolagem menos a faixa de 50): o centro da vaga em 1200 fica a 360 do topo do mapa.
  assert.equal(rolagemDaVaga(1200, 650, 50), 1200 - 50 - 360);
  assert.equal(rolagemDaVaga(200, 650, 50), 0);
});

test('rolar para cima mais de 40 px para de acompanhar; rolar para baixo, não', () => {
  assert.equal(deixouDeAcompanhar(960, 1000), false);
  assert.equal(deixouDeAcompanhar(959, 1000), true);
  assert.equal(deixouDeAcompanhar(1400, 1000), false);
});

test('a tela volta a acompanhar quando a lição nova entra no mapa visível', () => {
  assert.equal(vagaAVista(1200, 700, 650, 50), true);
  assert.equal(vagaAVista(1200, 400, 650, 50), false);
  // Atrás da faixa presa ainda não conta.
  assert.equal(vagaAVista(1200, 1170, 650, 50), false);
});

test('"Mais uma!" no máximo a cada três lições', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(comMaisUma), [false, false, true, false, false, true, true]);
});

// Achados da prévia (19/11): o mapa chama `acompanhar` com a vaga de cada lição nova e também no fim; a tela só trata o fim
// com a trilha pronta. A pessoa subindo no meio de uma rolagem programada conta. No fim, com o cartão do título de volta, a
// faixa sai e a placa fica no alto do mapa (não por cima do cartão).
test('geração no app: fim só com a trilha pronta, subida da pessoa durante a rolagem programada, placa fora do cartão', async () => {
  const tela = await readFile(new URL('../apps/mobile/src/estudo.tsx', import.meta.url), 'utf8');
  const corpo = tela.slice(tela.indexOf('function GeracaoAoVivo('), tela.indexOf('\nfunction PlacaDaGeracao'));
  assert.match(corpo, /function aoChegarAoFim\(_ultimo: Faixa, alvo: Faixa\) \{\n {4}if \(!pronta\) return;/);
  assert.match(corpo, /programada\.current = \{ inicio: rolado\.current, alvo: y,/);
  assert.match(corpo, /y < Math\.min\(andando\.inicio, andando\.alvo\) - RITMO_DA_GERACAO\.pararAcimaDe/);
  // Janela vencida sem chegar ao alvo (a página curta): a referência é onde a rolagem parou e o evento já conta.
  assert.match(corpo, /if \(Date\.now\(\) <= andando\.ate\) return;\n[^\n]*\n[^\n]*\n {6}programada\.current = null;\n {6}maisBaixo\.current = anterior;/);
  assert.doesNotMatch(corpo, /maisBaixo\.current = y;\n {4}rolagem\.current\?\.scrollTo/);
  // Voltar a acompanhar só descendo até a lição nova (com poucas lições ela aparece no alto).
  assert.match(corpo, /const voltou = y > anterior && \(pronta/);
  assert.match(corpo, /faixaFixa=\{cartaoDeVolta \? undefined : faixa\}/);
  assert.match(corpo, /\{cartaoDeVolta && \(/);
});

// A faixa presa (geração e mapa): o índice de stickyHeaderIndices sai da lista dos filhos de cima, sem `cond && <X/>` antes
// dela. O React Native Web conta os `false` nos índices e o aparelho não: com a faixa colada, nada grudava na prévia.
test('Tela: a faixa presa tem o índice do lugar dela numa lista sem buracos (web e aparelho contam igual)', async () => {
  const tela = await readFile(new URL('../apps/mobile/src/interface.tsx', import.meta.url), 'utf8');
  assert.match(tela, /stickyHeaderIndices=\{indiceDaFaixa !== null \? \[indiceDaFaixa\] : undefined\}/);
  assert.match(tela, /const indiceDaFaixa = faixaFixa \? filhosDeCima\.length : null;/);
  assert.doesNotMatch(tela, /\{faixaFixa && !?faixaColada && </);
});
