import test from 'node:test';
import assert from 'node:assert/strict';
import { deslocamentoDaLicao } from '../src/ui/enquadrar-licao.ts';

for (const cabecalho of [92, 260]) {
  test(`o nó e o balão respeitam o cabeçalho de ${cabecalho}px e a cápsula`, () => {
    const area = { top: cabecalho, bottom: 750 };
    for (const y of [-100, 360, 710]) {
      const no = { top: y, bottom: y + 72 };
      const balao = { top: y + 80, bottom: y + 255 };
      const delta = deslocamentoDaLicao(area, no, balao);
      assert.ok(no.top - delta >= cabecalho + 16);
      assert.ok(balao.bottom - delta <= area.bottom - 16);
      if (y === 360) assert.equal(delta, 0);
    }
    const alto = { top: 100, bottom: 1100 };
    assert.equal(alto.top - deslocamentoDaLicao(area, { top: 20, bottom: 92 }, alto), cabecalho + 16);
  });
}

test('ao voltar à lição atual a medida inclui o halo ampliado além da área clicável', async (t) => {
  const { enquadrarLicao } = await import('../src/ui/enquadrar-licao.ts');
  const elemento = (top, bottom) => ({ getBoundingClientRect: () => ({ top, bottom, height: bottom - top }) });
  const no = elemento(183, 255);
  no.querySelectorAll = (seletor) => seletor.includes('.caminho-no__halo') ? [elemento(164.5, 273.5)] : [];
  const movimentos = [];
  const cabecalho = elemento(0, 167);
  const simulados = {
    window: { innerHeight: 844, scrollBy: (opcoes) => movimentos.push(opcoes) },
    document: { querySelector: (seletor) => seletor === '.trilha-topo' ? cabecalho : elemento(766, 828) },
    getComputedStyle: () => ({ position: 'sticky' }),
    matchMedia: () => ({ matches: true }),
  };
  for (const [chave, valor] of Object.entries(simulados)) {
    const anterior = Object.getOwnPropertyDescriptor(globalThis, chave);
    Object.defineProperty(globalThis, chave, { configurable: true, value: valor });
    t.after(() => anterior ? Object.defineProperty(globalThis, chave, anterior) : Reflect.deleteProperty(globalThis, chave));
  }
  enquadrarLicao(no);
  assert.deepEqual(movimentos, [{ top: -19, behavior: 'instant' }]);
});
