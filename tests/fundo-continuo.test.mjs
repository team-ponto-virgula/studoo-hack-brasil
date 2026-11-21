import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analisarFundo } from '../apps/mobile/conferencia-nativa/servidor/fundo-continuo.mjs';

// A continuidade do fundo na conferência nativa (linha-do-tempo-som.mjs): a volta do laço com dois reprodutores (A/B) não é
// reinício nem pausa; uma parada ou um recomeço no meio da faixa continuam sendo. As amostras imitam o registro
// "[som] fundo <id> <A|B> <tocando|parado> <pos>/<dur> <volume> <ms>" do app.

const DUR = 89_302;
const amostra = (t, jogador, tocando, pos, vol = 0.35) => ({ t, jogador, tocando, pos, dur: DUR, vol });
// A toca do começo, de 500 em 500 ms, até `ate` ms de posição.
function tocando(jogador, t0, pos0, ate) {
  const lista = [];
  for (let pos = pos0, t = t0; pos <= ate; pos += 500, t += 500) lista.push(amostra(t, jogador, true, pos));
  return lista;
}

test('volta do laço como no iPhone (execução 44809026116): A pausa e volta a 26 ms antes de B entrar; não é reinício nem pausa', () => {
  const a = tocando('A', 10_000, 80_000, 89_000);
  const tFim = a.at(-1).t;
  const lista = [
    ...a,
    amostra(tFim + 480, 'A', false, 26), // o que sai: pausado e já reposicionado no começo (seek)
    ...tocando('B', tFim + 550, 40, 6_000), // o que entra
  ];
  const r = analisarFundo(lista);
  assert.equal(r.voltas.length, 1, 'uma volta do laço');
  assert.deepEqual(r.voltas[0].de + r.voltas[0].para, 'AB');
  assert.deepEqual(r.ocorrencias.filter((o) => o.tipo === 'reinício' || o.tipo === 'pausa'), []);
});

test('o outro reprodutor entrando no meio da faixa continua sendo reinício', () => {
  const a = tocando('A', 10_000, 20_000, 30_000);
  const lista = [...a, ...tocando('B', a.at(-1).t + 300, 0, 5_000)];
  const r = analisarFundo(lista);
  assert.equal(r.voltas.length, 0);
  assert.ok(r.ocorrencias.some((o) => o.tipo === 'reinício'), 'reinício acusado');
});

test('parar no meio da faixa continua sendo pausa', () => {
  const a = tocando('A', 10_000, 20_000, 30_000);
  const lista = [...a, amostra(a.at(-1).t + 400, 'A', false, 30_200), ...tocando('A', a.at(-1).t + 4_000, 30_200, 34_000)];
  const r = analisarFundo(lista);
  assert.ok(r.ocorrencias.some((o) => o.tipo === 'pausa'), 'pausa acusada');
});
