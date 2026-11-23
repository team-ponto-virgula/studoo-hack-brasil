// Refinamento da UI (spec 16), lote 1: as contas puras da aula, que a web e o app só desenham (packages/contratos/src/aula-regras.ts). Item 4: a etapa curta (Conceito e Exemplo que cabem sem rolar
// e deixam 40% ou mais da área livre sobrando). Item 8: a contagem da resposta aberta (da primeira letra até o mínimo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOBRA_MINIMA_DA_ETAPA, etapaTemFolga, mostrarContagemDaAberta } from '@studoo/contratos';

test('item 4: a etapa é curta quando o conteúdo usa no máximo 60% da área livre (sobram 40% ou mais)', () => {
  assert.equal(SOBRA_MINIMA_DA_ETAPA, 0.4);
  assert.equal(etapaTemFolga({ livre: 1000, usado: 600 }), true, 'sobram exatos 40%');
  assert.equal(etapaTemFolga({ livre: 1000, usado: 300 }), true);
  assert.equal(etapaTemFolga({ livre: 1000, usado: 600.5 }), true, 'meio pixel de tolerância: o arredondamento não desvira a decisão');
  assert.equal(etapaTemFolga({ livre: 1000, usado: 601 }), false, 'sobram menos de 40%');
  assert.equal(etapaTemFolga({ livre: 648, usado: 648 }), false, 'o conteúdo ocupa tudo');
  assert.equal(etapaTemFolga({ livre: 648, usado: 1318 }), false, 'conteúdo maior que a área: rola, não há folga');
});

test('item 4: medida inválida ou sem altura nunca é folga', () => {
  for (const medida of [{ livre: 0, usado: 100 }, { livre: -5, usado: 10 }, { livre: 500, usado: 0 }, { livre: Number.NaN, usado: 10 }, { livre: 500, usado: Number.POSITIVE_INFINITY }]) {
    assert.equal(etapaTemFolga(medida), false, JSON.stringify(medida));
  }
});

test('item 8: a contagem da resposta aberta só aparece da primeira letra até o mínimo', () => {
  assert.equal(mostrarContagemDaAberta(0, 40), false, 'antes da primeira letra só o rodapé orienta');
  assert.equal(mostrarContagemDaAberta(1, 40), true, 'a partir da primeira letra');
  assert.equal(mostrarContagemDaAberta(39, 40), true);
  assert.equal(mostrarContagemDaAberta(40, 40), false, 'some quando o mínimo é atingido');
  assert.equal(mostrarContagemDaAberta(120, 40), false);
  assert.equal(mostrarContagemDaAberta(Number.NaN, 40), false);
});

