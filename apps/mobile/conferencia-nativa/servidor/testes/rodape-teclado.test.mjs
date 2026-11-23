// O verificador do rodapé acima do teclado (servidor/rodape-teclado.mjs) sobre árvores reais, reduzidas ao que ele lê:
// - iphone-regressao-45105021514: o teclado do iPhone de uma árvore real (fluxo 55, execução 45077874039: inputView em
//   y 566) com o Verificar onde ele estava na execução 45105021514, com o teclado aberto e o app sem o conserto
//   (enviar-resposta em [16,812][386,864], do maestro.log): tem de dar NÃO;
// - iphone-corrigido: o mesmo teclado com o Verificar acima dele: sim;
// - android-explique-45105021514: o rodapé, o painel e o teclado reais do Android (fluxo 98, Explique aberto): sim.
// Uso: node --test apps/mobile/conferencia-nativa/servidor/testes/rodape-teclado.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { medirAcimaDoTeclado, topoDoTeclado, linhaDaMedicao, MEDICOES } from '../rodape-teclado.mjs';

const arvore = (nome) => JSON.parse(readFileSync(new URL(`./${nome}.json`, import.meta.url), 'utf8'));

test('iPhone sem o conserto (45105021514): Verificar atrás do teclado dá NÃO', () => {
  const r = medirAcimaDoTeclado(arvore('iphone-regressao-45105021514'), 'enviar-resposta');
  assert.deepEqual(r, { estado: 'NÃO', base: 864, topo: 566 });
  assert.match(linhaDaMedicao(MEDICOES[0], r), /❌ Rodapé acima do teclado .*: NÃO \(base do enviar-resposta y=864, topo do teclado y=566\)/);
});

test('iPhone com o Verificar acima do teclado dá sim', () => {
  assert.deepEqual(medirAcimaDoTeclado(arvore('iphone-corrigido'), 'enviar-resposta'), { estado: 'sim', base: 546, topo: 566 });
});

test('Android real (Explique aberto): o rodapé acaba no topo do teclado, sim', () => {
  const a = arvore('android-explique-45105021514');
  assert.equal(topoDoTeclado(a), 962);
  assert.deepEqual(medirAcimaDoTeclado(a, 'rodape'), { estado: 'sim', base: 962, topo: 962 });
  assert.equal(medirAcimaDoTeclado(a, 'continuar-licao').estado, 'sim');
});

test('sem teclado na árvore e sem o alvo: não afirma nada', () => {
  const semTeclado = { attributes: { bounds: '[0,0][402,874]' }, children: [{ attributes: { 'resource-id': 'enviar-resposta', bounds: '[16,778][386,830]' } }] };
  assert.equal(medirAcimaDoTeclado(semTeclado, 'enviar-resposta').estado, 'sem teclado');
  assert.equal(medirAcimaDoTeclado(arvore('iphone-corrigido'), 'gerar-trilha').estado, 'sem alvo');
});

test('sem o inputView, o topo vem das teclas do iPhone', () => {
  const a = arvore('iphone-regressao-45105021514');
  a.children = a.children.filter((no) => no.attributes['resource-id'] !== 'inputView');
  assert.equal(topoDoTeclado(a), 590); // a primeira fila de letras (Q…P)
  assert.equal(medirAcimaDoTeclado(a, 'enviar-resposta').estado, 'NÃO');
});
