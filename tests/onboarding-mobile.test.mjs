import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Spec 17 (onboarding e primeira vez), no app: mudança 1 (a espera da geração ensina o produto), 2 (a faixa da proposta e o
// tour com os textos do contrato) e 4 (o tour sem selo de demonstração). Os textos vêm do contrato; o app não os escreve.
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const ritmo = await ler('geracao-ritmo.ts');
const { outputText } = ts.transpileModule(ritmo, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const m = {};
runInNewContext(outputText, { exports: m });
const { RITMO_DA_GERACAO: R, fraseDaEspera } = m;
const estudo = await ler('estudo.tsx');
const apresentacao = await ler('apresentacao.tsx');

test('mudança 1: "Montando sua trilha" por 3 s e, depois, uma frase a cada 5 s, em laço', () => {
  assert.deepEqual([R.esperaMontandoMs, R.esperaFraseMs, R.esperaEfeitoMs], [3000, 5000, 300]);
  assert.equal(fraseDaEspera(0, 4), -1);
  assert.equal(fraseDaEspera(2999, 4), -1);
  assert.equal(fraseDaEspera(3000, 4), 0);
  assert.equal(fraseDaEspera(7999, 4), 0);
  assert.equal(fraseDaEspera(8000, 4), 1);
  assert.equal(fraseDaEspera(3000 + 4 * 5000, 4), 0, 'volta à primeira');
  assert.equal(fraseDaEspera(60000, 0), -1, 'sem frases no contrato, fica "Montando sua trilha"');
});

test('mudança 1: a placa usa as frases do contrato (geracao.dicas), a espera longa por cima e a proposta no fim', () => {
  const placa = estudo.slice(estudo.indexOf('function PlacaDaGeracao('), estudo.indexOf('function PassagemDaCriacao('));
  assert.match(placa, /const dicas = mensagens\.geracao\.dicas;/);
  assert.match(placa, /pronta \? mensagens\.geracao\.propostaPronta\(licoes, partes\) : esperaLonga \? mensagens\.geracao\.aguardandoLicao\n\s*: indice < 0 \? mensagens\.geracao\.montandoTitulo : dicas\[indice\]/);
  // Nenhuma frase da espera escrita no app.
  for (const frase of ['Lições curtas', 'Errou? O Stu', 'Você confere a trilha', 'fica marcada no mapa', "'Dica: "]) assert.doesNotMatch(estudo, new RegExp(frase.replace('?', '\\?')));
  // A troca em 300 ms (150 + 150); com movimento reduzido, na hora.
  assert.match(placa, /if \(reduzir !== false \|\| !espera\) \{\n\s*brilho\.setValue\(1\);\n\s*setMostrado\(texto\);/);
  assert.match(placa, /const metade = RITMO_DA_GERACAO\.esperaEfeitoMs \/ 2;/);
  // A linha da espera: 15/20 600 #0B1B5C, centralizada.
  assert.match(estudo, /placaGeracaoEspera: \{ fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center' \}/);
  assert.match(estudo, /placaGeracaoTexto: \{ color: cores\.texto,/);
  // O leitor de tela: a placa fica fora dele; ouve "Montando sua trilha" uma vez e a proposta pronta.
  assert.match(placa, /<Animated\.View testID="placa-geracao" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
  assert.match(estudo, /if \(!pronta\) AccessibilityInfo\.announceForAccessibility\(mensagens\.geracao\.montandoTitulo\);/);
  assert.match(estudo, /AccessibilityInfo\.announceForAccessibility\(`\$\{mensagens\.geracao\.propostaPronta\(total, partes\)\} \$\{mensagens\.geracao\.comecarLicao1\}\.`\);/);
});

test('mudança 2: o tour usa apresentacao.passos do contrato (título em cima, texto embaixo)', () => {
  assert.match(apresentacao, /const passos = semSessao \? mensagens\.apresentacao\.passos\.slice\(0, 4\) : mensagens\.apresentacao\.passos;/);
});

test('mudança 4: o tour do app sem selo de demonstração e sem a legenda "Retorno automático"', () => {
  assert.doesNotMatch(apresentacao, /SeloDemonstracao|leitura: 'demonstracao'|simulado: true/);
  assert.match(apresentacao, /proximoPasso: ex\.ensinoProximo, simulado: false \}\} \/>/);
});
