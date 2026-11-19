import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// "Reduzir transparência" e o vidro da barra de abas (spec 05): o ciclo de vida da preferência com o módulo nativo simulado,
// sem aparelho e sem temporizadores reais. O vidro só vale com a preferência confirmada desligada.
const fonte = await readFile(new URL('../apps/mobile/src/transparencia.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS } });

function ambiente({ plataforma = 'ios' } = {}) {
  const eventos = new Map();
  const consultas = [];
  let relogio = 0;
  const temporizadores = new Map();
  let proximo = 1;
  const adicionar = (nome, callback) => {
    assert.ok(!eventos.has(nome), 'não deve duplicar o ouvinte');
    eventos.set(nome, callback);
    return { remove: () => eventos.delete(nome) };
  };
  const nativo = {
    Platform: { OS: plataforma },
    AccessibilityInfo: {
      addEventListener: adicionar,
      isReduceTransparencyEnabled: () => new Promise((resolve, reject) => consultas.push({ resolve, reject })),
    },
  };
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (nome) => (nome === 'react-native' ? nativo : { useSyncExternalStore: (assinar, ler, servidor) => ({ assinar, ler, servidor }) }),
    setTimeout: (funcao, atraso) => { const id = proximo++; temporizadores.set(id, { funcao, quando: relogio + atraso }); return id; },
    clearTimeout: (id) => temporizadores.delete(id),
  });
  const avancar = (ms) => {
    relogio += ms;
    for (const [id, { funcao, quando }] of [...temporizadores]) if (quando <= relogio) { temporizadores.delete(id); funcao(); }
  };
  return { store: exports.useVidroPermitido(), espera: exports.ESPERA_SEM_OUVINTES_MS, eventos, consultas, avancar,
    evento: (valor) => eventos.get('reduceTransparencyChanged')(valor) };
}
const microtarefas = () => new Promise((resolve) => setImmediate(resolve));

test('consulta atrasada: opaca até a resposta; desligada libera o vidro, ligada mantém a superfície opaca', async () => {
  const a = ambiente();
  const sair = a.store.assinar(() => {});
  assert.equal(a.consultas.length, 1);
  assert.equal(a.store.ler(), false, 'antes da resposta, nada de vidro');
  assert.equal(a.store.servidor(), false);
  a.consultas[0].resolve(false);
  await microtarefas();
  assert.equal(a.store.ler(), true);
  sair();
  const b = ambiente();
  b.store.assinar(() => {});
  b.consultas[0].resolve(true);
  await microtarefas();
  assert.equal(b.store.ler(), false);
});

test('consulta que falha: continua opaca; o evento que chega depois decide', async () => {
  const a = ambiente();
  let avisos = 0;
  a.store.assinar(() => avisos++);
  a.consultas[0].reject(new Error('indisponível'));
  await microtarefas();
  assert.equal(a.store.ler(), false, 'a falha não libera o vidro');
  a.evento(false);
  assert.equal(a.store.ler(), true);
  assert.equal(avisos, 1);
});

test('troca ao vivo pelo evento, para os dois lados, avisando quem ouve', async () => {
  const a = ambiente();
  let avisos = 0;
  a.store.assinar(() => avisos++);
  a.consultas[0].resolve(false);
  await microtarefas();
  assert.equal(a.store.ler(), true);
  a.evento(true);
  assert.equal(a.store.ler(), false);
  a.evento(false);
  assert.equal(a.store.ler(), true);
  assert.equal(avisos, 3);
});

test('vale a resposta mais recente: a consulta que volta depois de um evento não muda nada', async () => {
  const a = ambiente();
  a.store.assinar(() => {});
  a.evento(true);
  a.consultas[0].resolve(false);
  await microtarefas();
  assert.equal(a.store.ler(), false, 'o evento (ligada) é mais novo que a consulta (desligada)');
});

test('troca de tela: desmontar e montar no mesmo instante não pergunta de novo nem pisca', async () => {
  const a = ambiente();
  const sairA = a.store.assinar(() => {});
  a.consultas[0].resolve(false);
  await microtarefas();
  sairA();
  const sairB = a.store.assinar(() => {});
  assert.equal(a.store.ler(), true, 'continua vidro: o ouvinte não saiu');
  assert.equal(a.consultas.length, 1);
  assert.equal(a.eventos.size, 1);
  a.avancar(a.espera * 2);
  assert.equal(a.eventos.size, 1, 'com alguém ouvindo, o ouvinte fica');
  sairB();
});

test('sem ninguém por 1,5 s, o ouvinte sai e a confirmação antiga não é reaproveitada', async () => {
  const a = ambiente();
  const sair = a.store.assinar(() => {});
  a.consultas[0].resolve(false);
  await microtarefas();
  sair();
  a.avancar(a.espera - 1);
  assert.equal(a.eventos.size, 1, 'antes da espera, ainda ouvindo (e viva)');
  assert.equal(a.store.ler(), true);
  a.avancar(1);
  assert.equal(a.eventos.size, 0, 'o ouvinte saiu');
  assert.equal(a.store.ler(), false, 'sem ouvir, a confirmação deixou de valer');
  a.store.assinar(() => {});
  assert.equal(a.consultas.length, 2, 'a próxima assinatura pergunta de novo');
  assert.equal(a.store.ler(), false, 'e começa opaca');
  a.consultas[1].resolve(false);
  await microtarefas();
  assert.equal(a.store.ler(), true);
});

test('a resposta atrasada de um ciclo encerrado não vale no ciclo novo', async () => {
  const a = ambiente();
  const sair = a.store.assinar(() => {});
  sair();
  a.avancar(a.espera);
  a.store.assinar(() => {});
  assert.equal(a.consultas.length, 2);
  a.consultas[0].resolve(false);
  await microtarefas();
  assert.equal(a.store.ler(), false, 'a resposta do ciclo antigo não libera o vidro');
  a.consultas[1].resolve(true);
  await microtarefas();
  assert.equal(a.store.ler(), false);
});

test('fora do iPhone não pergunta nem ouve: a barra é sempre opaca', () => {
  for (const plataforma of ['android', 'web']) {
    const a = ambiente({ plataforma });
    const sair = a.store.assinar(() => {});
    assert.equal(a.consultas.length, 0);
    assert.equal(a.eventos.size, 0);
    assert.equal(a.store.ler(), false);
    sair();
  }
});
