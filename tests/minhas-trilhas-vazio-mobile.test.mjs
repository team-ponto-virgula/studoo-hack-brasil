import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// "Minhas trilhas" sem trilhas no app (spec 05, d8df51c; pedido do dono de 20/11): a abertura continua na Nova trilha;
// tocar em "Minhas trilhas" mostra o bloco vazio com o Stu, sem o pedido, com a aba marcada e a barra de abas presente.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');

test('os textos do vazio vêm do contrato (816ea30)', () => {
  assert.equal(mensagens.planos.vazioTitulo, 'Nenhuma trilha ainda');
  assert.equal(mensagens.planos.vazioTexto, 'Suas trilhas ficam aqui. Conte o que quer aprender e o Studoo monta a primeira.');
  assert.equal(mensagens.planos.vazioAcao, 'Criar minha primeira trilha');
});

test('a abertura sem trilhas vai para a Nova trilha; planos sem trilhas é o vazio, sem o pedido', async () => {
  const fonte = await ler('apps/mobile/src/estudo.tsx');
  assert.match(fonte, /if \(lista\.length === 0\) setEtapa\(\(atual\) => \(atual\.tipo === 'planos' \? \{ tipo: 'objetivo' \} : atual\)\);/);
  assert.match(fonte, /if \(etapa\.tipo === 'objetivo' \|\| etapa\.tipo === 'geracao'\) \{\s*return <Pedido/);
  assert.doesNotMatch(fonte, /etapa\.tipo === 'geracao' \|\| planos\?\.length === 0/, 'planos sem trilhas não desenha mais o pedido');
  assert.match(fonte, /\{planos && planos\.length === 0 \? \(\s*<VazioDasTrilhas pulo=\{puloDoVazio\} criar=\{\(\) => abrir\(\{ tipo: 'objetivo' \}\)\} \/>/);
});

test('a barra de abas aparece também sem trilhas, com "Minhas trilhas" marcada no vazio', async () => {
  const fonte = await ler('apps/mobile/src/estudo.tsx');
  // Com um pedido em andamento, a barra fica à vista e só desliga (spec 05; rede lenta, ver tests/rede-lenta-mobile.test.mjs).
  assert.match(fonte, /const comNavegacaoAgora = planos !== null && \(ABAS\.includes\(aba\) \|\| \(comunidade && aba === 'explorar'\)\);/);
  assert.match(fonte, /const ABAS: readonly string\[\] = \['planos',/);
  assert.match(fonte, /planos: tocarMinhasTrilhas,/);
  assert.match(fonte, /acao=\{criacao === 'criando' \? sairDaCriacao : tocarMinhasTrilhas\} \/>/, 'o meus-planos do alto leva ao mesmo estado');
});

test('o bloco: Stu curioso com halo, título anunciado, texto, "Criar minha primeira trilha"; o toque de novo faz o Stu pular', async () => {
  const fonte = await ler('apps/mobile/src/estudo.tsx');
  const bloco = fonte.slice(fonte.indexOf('function VazioDasTrilhas'));
  assert.match(bloco, /testID="planos-vazio"/);
  assert.match(bloco, /<Stu nome="stu-curioso" tamanho=\{96\} halo animado="uma-vez" \/>/);
  assert.match(bloco, /accessibilityLiveRegion="polite"[^>]*>\{t\.vazioTitulo\}/);
  assert.match(bloco, /AccessibilityInfo\.announceForAccessibility\(`\$\{t\.vazioTitulo\}\.`\)/);
  assert.match(bloco, /<Text style=\{estudoEstilos\.semTrilhasCorpo\}>\{t\.vazioTexto\}<\/Text>/);
  assert.match(bloco, /<Botao rotulo=\{t\.vazioAcao\} testID="planos-vazio-criar" acao=\{criar\}/);
  assert.match(bloco, /if \(!pulo \|\| reduzir !== false\) return;/, 'com movimento reduzido, sem pulo');
  assert.match(bloco, /outputRange: \[0, -8\]/);
  assert.match(fonte, /if \(etapa\.tipo === 'planos' && planos\?\.length === 0\) \{ setPuloDoVazio\(\(vezes\) => vezes \+ 1\); return; \}/);
});
