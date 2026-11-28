// Conferência local da assinatura. Veja ABERTURA.md para dependências e limites.
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
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const OUT = resolve(process.env.QA_OUT || '.studoo-local/abertura-qa');
const motion = JSON.parse(await fs.readFile(resolve('packages/contratos/src/abertura-motion.json'), 'utf8'));
const largura = motion.largura;
const altura = largura * motion.fonte.altura / motion.fonte.largura;
let b;
let results = [];
let activePage;
const pageErrors = new WeakMap();
function trackPage(page) {
  activePage = page;
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function saveResults() {
  await fs.writeFile(path.join(OUT, 'browser-app-preview.json'), JSON.stringify({
    date: new Date().toISOString(), surface: 'app_previa_web', motionContract: motion, results
  }, null, 2));
}
async function check(name, fn) {
  try {
    results.push({
      name,
      passed: true,
      evidence: await fn()
    });
    console.log('PASS', name);
  } catch (e) {
    let diagnostic;
    try {
      diagnostic = await activePage?.evaluate(() => ({
        atMs: performance.now(), path: location.pathname, body: document.body.innerText.slice(0, 500),
        overlayCount: document.querySelectorAll('[data-testid="abertura-studoo"]').length,
        fonts: document.fonts?.status, visibility: document.visibilityState,
      }));
    } catch (error) { diagnostic = { readError: error.message }; }
    results.push({
      name,
      passed: false,
      error: e.message,
      diagnostic,
      pageErrors: pageErrors.get(activePage) ?? [],
    });
    console.log('FAIL', name, e.message);
  } finally {
    await saveResults();
  }
}
async function controlled(width = 390, height = 844, advanceMs = 32) {
  const c = await b.newContext({
    viewport: {
      width,
      height
    }
  });
  const p = trackPage(await c.newPage());
  await p.clock.install();
  await p.clock.pauseAt(new Date());
  const requests = [];
  await p.route(/\.(ttf|otf)(\?|$)/, async r => {
    requests.push(r);
    await new Promise(() => {});
  });
  await p.goto(process.env.QA_APP_BASE || 'http://localhost:8090', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });
  await p.waitForTimeout(1200);
  if (advanceMs) await p.clock.runFor(advanceMs);
  await p.getByTestId('abertura-studoo').waitFor({
    timeout: 10000
  });
  return {
    p,
    c,
    requests
  };
}
(async () => {
  await fs.mkdir(OUT, {
    recursive: true
  });
  b = await chromium.launch({
    executablePath: process.env.STUDOO_CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox']
  });
  for (const [w, h] of [[390, 844], [360, 800], [390, 667]]) await check('app-preview-static-' + w + 'x' + h, async () => {
    const {
      p,
      c
    } = await controlled(w, h, 0);
    const img = p.getByTestId('abertura-marca');
    const box = await img.boundingBox();
    assert.ok(Math.abs(box.width - largura) < .2);
    assert.ok(Math.abs(box.height - altura) < .2);
    assert.ok(Math.abs(box.x + box.width / 2 - w / 2) < .2);
    assert.ok(Math.abs(box.y + box.height / 2 - h / 2) < .2);
    assert.equal(await img.evaluate(element => getComputedStyle(element).opacity), '1');
    const capture = await (await c.newCDPSession(p)).send('Page.captureScreenshot', {
      format: 'png'
    });
    await fs.writeFile(path.join(OUT, `app-preview-${w}x${h}.png`), Buffer.from(capture.data, 'base64'));
    const ax = await p.getByTestId('abertura-studoo').locator('..').ariaSnapshot();
    assert.ok(!ax.includes('Tentar'));
    assert.ok(!ax.includes('img'));
    let finalRest;
    if (w === 390 && h === 844) {
      await p.clock.runFor(motion.sequenciaMs + motion.margemQuadroMs);
      assert.equal(await img.evaluate(element => getComputedStyle(element).opacity), '1');
      const final = await (await c.newCDPSession(p)).send('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(path.join(OUT, 'app-preview-repouso-final.png'), Buffer.from(final.data, 'base64'));
      finalRest = { controlledAdvanceMs: motion.sequenciaMs + motion.margemQuadroMs, fullBitmapOpacity: 1 };
    }
    await c.close();
    return {
      box,
      scope: 'React Native Web; local Expo dev; fonts held; clock controlled; AX scoped to app root, excluding Expo dev toolbar',
      decorativeAX: ax,
      finalRest,
    };
  });
  await check('app-preview-timeout', async () => {
    const {
      p,
      c
    } = await controlled();
    await p.clock.runFor(motion.limiteMs);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      afterControlledMs: 32 + motion.limiteMs
    };
  });
  await check('app-preview-touch-dismiss', async () => {
    const {
      p,
      c
    } = await controlled();
    await p.mouse.click(195, 422);
    await p.clock.runFor(16);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      completed: true
    };
  });
  await check('app-preview-escape-dismiss', async () => {
    const {
      p,
      c
    } = await controlled();
    await p.keyboard.press('Escape');
    await p.clock.runFor(16);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      completed: true
    };
  });
  await check('app-preview-tab-focus', async () => {
    const {
      p,
      c
    } = await controlled();
    await p.keyboard.press('Tab');
    await p.clock.runFor(32);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    const focus = await p.evaluate(() => ({
      tag: document.activeElement.tagName,
      text: document.activeElement.textContent
    }));
    assert.notEqual(focus.tag, 'BODY');
    await c.close();
    return focus;
  });
  await check('app-preview-reduced-motion', async () => {
    const c = await b.newContext({
      viewport: {
        width: 390,
        height: 844
      },
      reducedMotion: 'reduce'
    });
    const p = trackPage(await c.newPage());
    await p.goto(process.env.QA_APP_BASE || 'http://localhost:8090', {
      waitUntil: 'domcontentloaded'
    });
    await p.waitForTimeout(500);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      overlayCount: 0
    };
  });
  await check('app-preview-query-bypass', async () => {
    const c = await b.newContext({
      viewport: {
        width: 390,
        height: 844
      }
    });
    const p = trackPage(await c.newPage());
    await p.goto((process.env.QA_APP_BASE || 'http://localhost:8090') + '/?erro=teste', {
      waitUntil: 'domcontentloaded'
    });
    await p.waitForTimeout(500);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      overlayCount: 0
    };
  });
  await check('app-preview-normal-recording', async () => {
    const c = await b.newContext({
      viewport: {
        width: 390,
        height: 844
      },
      recordVideo: {
        dir: path.join(OUT, 'video-app-tmp'),
        size: {
          width: 390,
          height: 844
        }
      }
    });
    const p = trackPage(await c.newPage());
    const errors = pageErrors.get(p);
    await p.goto(process.env.QA_APP_BASE || 'http://localhost:8090', {
      waitUntil: 'domcontentloaded'
    });
    // Registra a abertura natural: não avança relógio nem depende de um sleep fixo após navegar.
    await p.getByTestId('abertura-studoo').waitFor({ state: 'attached', timeout: 10000 });
    await p.getByTestId('abertura-studoo').waitFor({ state: 'detached', timeout: motion.limiteMs });
    await p.waitForTimeout(motion.saidaMs);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    assert.deepEqual(errors, []);
    await p.screenshot({
      path: path.join(OUT, 'app-preview-destino.png')
    });
    const destination = (await p.locator('body').innerText()).slice(0, 250);
    const video = p.video();
    await c.close();
    await video.saveAs(path.join(OUT, 'app-preview-abertura.webm'));
    return {
      errors,
      destination,
      scope: 'RNWeb; does not validate authentication or native behavior'
    };
  });
  await b.close();
  await saveResults();
  console.log('TOTAL', results.filter(r => r.passed).length, '/', results.length);
  if (results.some(r => !r.passed)) process.exitCode = 1;
})().catch(async e => {
  console.error(e);
  await fs.writeFile(path.join(OUT, 'fatal.json'), JSON.stringify({ error: e.message, stack: e.stack }, null, 2)).catch(() => {});
  await b?.close();
  process.exitCode = 1;
});
