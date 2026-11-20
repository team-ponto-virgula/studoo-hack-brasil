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
