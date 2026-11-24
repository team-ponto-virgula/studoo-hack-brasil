// Capturas e verificações dos estudos HTML; não exerce serviços do produto.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require(resolve('.studoo-local/navegador-qa/node_modules/playwright-core'));
} catch {
  try {
    pw = require('playwright');
  } catch {
    pw = require('playwright-core');
  }
}
const {
  chromium
} = pw;
const BASE = process.env.QA_DIRECOES_BASE || 'http://localhost:8084';
const fs = require('fs/promises');
const assert = require('assert/strict');
const OUT = resolve(process.env.QA_OUT || '.studoo-local/propostas-qa');
(async () => {
  await fs.mkdir(OUT, {
    recursive: true
  });
  const b = await chromium.launch({
    executablePath: process.env.STUDOO_CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  const results = [];
  for (const direction of ['a', 'b', 'c']) for (const [w, h] of [[390, 844], [360, 800]]) {
    const c = await b.newContext({
      viewport: {
        width: w,
        height: h
      },
      reducedMotion: 'reduce'
    });
    const p = await c.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('response', r => {
      if (r.status() >= 400) errors.push('HTTP' + r.status() + ' ' + new URL(r.url()).pathname);
    });
    for (const state of ['pedido', 'geracao', 'proposta', 'conclusao']) {
      await p.goto(`${BASE}/direcao-${direction}.html?estado=${state}`);
      await p.waitForTimeout(100);
      const metrics = await p.evaluate(() => ({
        state: document.body.dataset.estado,
        overflow: document.documentElement.scrollWidth > innerWidth,
        primaries: [...document.querySelectorAll('.primary')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => {
          const r = e.getBoundingClientRect();
          return {
            label: e.textContent.trim(),
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom
          };
        })
      }));
      const item = {
        direction,
        state,
        viewport: {
          width: w,
          height: h
        },
        metrics,
        errors: [...errors]
      };
      try {
        assert.equal(metrics.state, state);
        assert.equal(metrics.overflow, false);
        assert.equal(errors.length, 0);
        if (state !== 'geracao') assert.ok(metrics.primaries.length > 0);
        for (const button of metrics.primaries) {
          assert.ok(button.height >= 48);
          assert.ok(button.bottom <= h + 1);
          assert.ok(button.y >= 0);
        }
        item.passed = true;
      } catch (e) {
        item.passed = false;
        item.error = e.message;
      }
      results.push(item);
      console.log(item.passed ? 'PASS' : 'FAIL', direction, state, w, item.error || '');
      await p.screenshot({
        path: `${OUT}/${direction}-${state}-${w}.png`
      });
    }
    await c.close();
  }
  for (const state of ['proposta', 'conclusao']) {
    const p = await b.newPage({
      viewport: {
        width: 1380,
        height: 1600
      },
      reducedMotion: 'reduce'
    });
    await p.goto(`${BASE}/?estado=${state}`);
    await p.waitForTimeout(600);
    await p.screenshot({
      path: `${OUT}/comparativo-${state}.png`,
      fullPage: true
    });
    await p.close();
  }
  await b.close();
  await fs.writeFile(OUT + '/verificacoes.json', JSON.stringify({
    scope: 'Propostas HTML locais; não valida produto web/app nem serviços reais',
    date: new Date().toISOString(),
    results
  }, null, 2));
  console.log('TOTAL', results.filter(x => x.passed).length, '/', results.length);
  if (results.some(x => !x.passed)) process.exitCode = 1;
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
