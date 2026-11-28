import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercita o ciclo de vida das assinaturas nativas, sem emulador ou temporizadores reais.
const fonte = await readFile(new URL('../apps/mobile/src/movimento.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
function ambiente(estadoInicial = 'active') {
  const eventos = new Map();
  let resolver, rejeitar;
  let consultas = 0;
  const adicionar = (nome, callback) => {
    assert.ok(!eventos.has(nome), 'não deve duplicar assinaturas');
    eventos.set(nome, callback);
    return { remove: () => eventos.delete(nome) };
  };
  const nativo = {
    AppState: { currentState: estadoInicial, addEventListener: adicionar },
    AccessibilityInfo: {
      addEventListener: adicionar,
      isReduceMotionEnabled: () => {
        consultas++;
        return new Promise((resolve, reject) => { resolver = resolve; rejeitar = reject; });
      },
    },
  };
  const exports = {};
  runInNewContext(outputText, { exports, require: (nome) => nome === 'react-native' ? nativo : {
    useSyncExternalStore: (assinar, ler, servidor) => ({ assinar, ler, servidor }),
  } });
  return { store: exports.useMovimentoReduzido(), preferencia: exports.usePreferenciaMovimentoReduzido(), eventos, consultas: () => consultas,
    resolver: (valor) => resolver(valor), rejeitar: () => rejeitar(new Error('indisponível')) };
}

test('cem animações compartilham uma consulta e duas assinaturas, removidas ao desmontar', async () => {
  const a = ambiente();
  const limpezas = Array.from({ length: 100 }, () => a.store.assinar(() => {}));
  assert.equal(a.consultas(), 1);
  assert.equal(a.eventos.size, 2);
  assert.equal(a.store.ler(), null);
  a.resolver(false);
  await Promise.resolve();
  assert.equal(a.store.ler(), false);
  limpezas.slice(0, 99).forEach((limpar) => limpar());
  assert.equal(a.eventos.size, 2);
  limpezas[99]();
  assert.equal(a.eventos.size, 0);
});

test('segundo plano suspende movimento e voltar respeita a preferência', async () => {
  const a = ambiente();
  let avisos = 0;
  const limpar = a.store.assinar(() => avisos++);
  a.resolver(false);
  await Promise.resolve();
  a.eventos.get('change')('background');
  assert.equal(a.store.ler(), true);
  a.eventos.get('change')('active');
  assert.equal(a.store.ler(), false);
  a.eventos.get('reduceMotionChanged')(true);
  a.eventos.get('change')('background');
  a.eventos.get('change')('active');
  assert.equal(a.store.ler(), true);
  assert.ok(avisos >= 5);
  limpar();
});

test('resposta antiga não sobrescreve uma mudança de acessibilidade', async () => {
  const a = ambiente();
  const limpar = a.store.assinar(() => {});
  a.eventos.get('reduceMotionChanged')(true);
  a.resolver(false);
  await Promise.resolve();
  assert.equal(a.store.ler(), true);
  limpar();
});

test('falha ao consultar a preferência conserva a tela estática', async () => {
  const a = ambiente();
  const limpar = a.store.assinar(() => {});
  a.rejeitar();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(a.store.ler(), true);
  assert.equal(a.store.servidor(), true);
  limpar();
});

test('boot inactive/null não se passa por preferência de movimento reduzido', async () => {
  for (const estadoInicial of [null, 'unknown', 'inactive']) {
    const a = ambiente(estadoInicial);
    const limpar = a.preferencia.assinar(() => {});
    assert.equal(a.store.ler(), true, 'decorativo continua suspenso antes de active');
    assert.equal(a.preferencia.ler(), null, 'consulta nativa ainda não respondeu');
    a.resolver(false);
    await Promise.resolve();
    assert.equal(a.preferencia.ler(), false, 'preferência real é false mesmo durante o boot');
    assert.equal(a.store.ler(), true, 'o hook decorativo não começa em segundo plano');
    a.eventos.get('change')('active');
    assert.equal(a.store.ler(), false);
    assert.equal(a.preferencia.ler(), false);
    limpar();
  }
});

test('a abertura e animações decorativas compartilham a consulta sem confluir seus snapshots', async () => {
  const a = ambiente('inactive');
  const limparDecorativo = a.store.assinar(() => {});
  const limparPreferencia = a.preferencia.assinar(() => {});
  assert.equal(a.consultas(), 1);
  assert.equal(a.eventos.size, 2);
  a.resolver(false); await Promise.resolve();
  assert.equal(a.store.ler(), true);
  assert.equal(a.preferencia.ler(), false);
  a.eventos.get('reduceMotionChanged')(true);
  assert.equal(a.preferencia.ler(), true);
  a.eventos.get('change')('active');
  assert.equal(a.store.ler(), true);
  limparDecorativo(); assert.equal(a.eventos.size, 2);
  limparPreferencia(); assert.equal(a.eventos.size, 0);
});
