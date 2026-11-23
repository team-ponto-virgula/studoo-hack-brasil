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
let b;
let results = [];
async function check(name, fn) {
  try {
    results.push({
      name,
      passed: true,
      evidence: await fn()
    });
    console.log('PASS', name);
  } catch (e) {
    results.push({
      name,
      passed: false,
      error: e.message
    });
    console.log('FAIL', name, e.message);
  }
}
async function controlled(width = 390, height = 844) {
  const c = await b.newContext({
    viewport: {
      width,
      height
    }
  });
  const p = await c.newPage();
  await p.clock.install();
  await p.clock.pauseAt(new Date());
  const requests = [];
  await p.route(/\.(ttf|otf)(\?|$)/, async r => {
    requests.push(r);
    await new Promise(() => {});
  });
  await p.goto(process.env.QA_APP_BASE || 'http://localhost:8082', {
    waitUntil: 'domcontentloaded',
    timeout: 90000
  });
  await p.waitForTimeout(1200);
  await p.clock.runFor(32);
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
    } = await controlled(w, h);
    await p.addStyleTag({
      content: '[data-testid="abertura-studoo"] > div { transform:none !important }'
    });
    const img = p.getByTestId('abertura-marca');
    const box = await img.boundingBox();
    assert.ok(Math.abs(box.width - 180) < .2);
    assert.ok(Math.abs(box.height - 180 * 184 / 560) < .2);
    assert.ok(Math.abs(box.x + box.width / 2 - w / 2) < .2);
    assert.ok(Math.abs(box.y + box.height / 2 - h / 2) < .2);
    const capture = await (await c.newCDPSession(p)).send('Page.captureScreenshot', {
      format: 'png'
    });
    await fs.writeFile(path.join(OUT, `app-preview-${w}x${h}.png`), Buffer.from(capture.data, 'base64'));
    const ax = await p.getByTestId('abertura-studoo').locator('..').ariaSnapshot();
    assert.ok(!ax.includes('Tentar'));
    assert.ok(!ax.includes('img'));
    await c.close();
    return {
      box,
      scope: 'React Native Web; local Expo dev; fonts held; clock controlled; AX scoped to app root, excluding Expo dev toolbar',
      decorativeAX: ax
    };
  });
  await check('app-preview-timeout', async () => {
    const {
      p,
      c
    } = await controlled();
    await p.clock.runFor(900);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      afterControlledMs: 932
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
    const p = await c.newPage();
    await p.goto(process.env.QA_APP_BASE || 'http://localhost:8082', {
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
    const p = await c.newPage();
    await p.goto((process.env.QA_APP_BASE || 'http://localhost:8082') + '/?erro=teste', {
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
    const p = await c.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(process.env.QA_APP_BASE || 'http://localhost:8082', {
      waitUntil: 'domcontentloaded'
    });
    await p.waitForTimeout(1500);
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
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
  await fs.writeFile(path.join(OUT, 'browser-app-preview.json'), JSON.stringify({
    date: new Date().toISOString(),
    surface: 'app_previa_web',
    results
  }, null, 2));
  console.log('TOTAL', results.filter(r => r.passed).length, '/', results.length);
  if (results.some(r => !r.passed)) process.exitCode = 1;
})().catch(async e => {
  console.error(e);
  await b?.close();
  process.exitCode = 1;
});
