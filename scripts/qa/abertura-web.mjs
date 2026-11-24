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
const OUT = process.env.QA_OUT || resolve(process.env.QA_OUT || '.studoo-local/abertura-qa');
const BASE = process.env.QA_BASE || 'http://localhost:3000';
const results = [];
if (!['localhost', '127.0.0.1'].includes(new URL(BASE).hostname)) throw new Error('Use somente uma bancada local sintética.');
let browser;
async function context(opts = {}) {
  const c = await browser.newContext({
    viewport: {
      width: 390,
      height: 844
    },
    ...opts
  });
  return c;
}
async function pageWithClock(opts = {}) {
  const c = await context(opts);
  const p = await c.newPage();
  await p.clock.install();
  await p.clock.pauseAt(new Date());
  await p.addInitScript(() => {
    window.__qa = {
      events: [],
      audio: 0,
      hydrated: false
    };
    const original = window.addEventListener;
    window.addEventListener = function (type, ...args) {
      if (type === 'hashchange') window.__qa.hydrated = true;
      return original.call(this, type, ...args);
    };
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      window.__qa.audio++;
      return origPlay.apply(this, args);
    };
    let ready = false;
    let resolveFonts;
    const promise = new Promise(r => {
      resolveFonts = r;
    });
    Object.defineProperty(document.fonts, 'status', {
      get: () => ready ? 'loaded' : 'loading'
    });
    Object.defineProperty(document.fonts, 'ready', {
      get: () => promise
    });
    window.__qa.fontsReady = () => {
      ready = true;
      resolveFonts(document.fonts);
    };
    new MutationObserver(() => {
      const r = document.querySelector('.abertura-raiz');
      if (!r) return;
      const phase = r.dataset.aberturaFase;
      const last = window.__qa.events.at(-1);
      if (last?.phase !== phase) window.__qa.events.push({
        phase,
        t: performance.now(),
        reason: r.dataset.aberturaMotivo || null
      });
    }).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-abertura-fase']
    });
  });
  await p.goto(BASE + '/login', {
    waitUntil: 'load'
  });
  for (let i = 0; i < 100; i++) {
    if (await p.evaluate(() => window.__qa.hydrated)) break;
    await p.waitForTimeout(50);
  }
  assert.equal(await p.evaluate(() => window.__qa.hydrated), true, 'hydration installed');
  return {
    p,
    c
  };
}
async function check(name, fn) {
  try {
    const evidence = await fn();
    results.push({
      name,
      passed: true,
      evidence
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
async function qaStyle(p, css) {
  await p.evaluate(text => {
    const s = document.createElement('style');
    s.nonce = document.querySelector('script[nonce]')?.nonce || '';
    s.textContent = text;
    document.head.append(s);
  }, css);
}
async function phase(p) {
  return p.locator('.abertura-raiz').getAttribute('data-abertura-fase');
}
(async () => {
  await fs.mkdir(OUT, {
    recursive: true
  });
  browser = await chromium.launch({
    executablePath: process.env.STUDOO_CHROMIUM || '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox']
  });
  for (const [width, height] of [[390, 844], [360, 800], [390, 667], [768, 1024], [1440, 900]]) await check('static-' + width + 'x' + height, async () => {
    const {
      p,
      c
    } = await pageWithClock({
      viewport: {
        width,
        height
      }
    });
    assert.equal(await phase(p), 'visivel');
    await qaStyle(p, '.abertura-marca {animation:none !important}');
    const box = await p.getByTestId('abertura-marca').boundingBox();
    assert.ok(Math.abs(box.width - 180) < .1);
    assert.ok(Math.abs(box.height - 180 * 184 / 560) < .1);
    assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < .1);
    assert.ok(Math.abs(box.y + box.height / 2 - height / 2) < .1);
    const ax = await p.locator('body').ariaSnapshot();
    assert.ok(!ax.includes('E-mail'), 'hidden input not exposed');
    await p.screenshot({
      path: path.join(OUT, `web-${width}x${height}.png`)
    });
    await c.close();
    return {
      box,
      decorativeAX: ax
    };
  });
  await check('ready-without-minimum-hold', async () => {
    const {
      p,
      c
    } = await pageWithClock();
    await p.evaluate(() => window.__qa.fontsReady());
    await p.clock.runFor(35);
    assert.equal(await phase(p), 'saindo');
    await p.clock.runFor(120);
    assert.equal(await phase(p), 'concluida');
    const events = await p.evaluate(() => window.__qa.events);
    await c.close();
    return events;
  });
  await check('unresponsive-fonts-cap', async () => {
    const {
      p,
      c
    } = await pageWithClock();
    await p.clock.runFor(899);
    assert.equal(await phase(p), 'visivel');
    await p.clock.runFor(1);
    assert.equal(await phase(p), 'concluida');
    assert.equal(await p.locator('.abertura-raiz').getAttribute('data-abertura-motivo'), 'limite');
    await c.close();
    return {
      elapsedControlledMs: 900
    };
  });
  await check('first-touch-only-dismisses-cover-no-audio', async () => {
    const {
      p,
      c
    } = await pageWithClock({
      hasTouch: true
    });
    await p.touchscreen.tap(195, 422);
    assert.equal(await phase(p), 'concluida');
    assert.equal(await p.evaluate(() => window.__qa.audio), 0);
    assert.ok(!(await p.locator('dialog').count()));
    await c.close();
    return {
      audioPlayCalls: 0
    };
  });
  await check('tab-reveals-and-focuses', async () => {
    const {
      p,
      c
    } = await pageWithClock();
    await p.keyboard.press('Tab');
    assert.equal(await phase(p), 'concluida');
    const active = await p.evaluate(() => ({
      tag: document.activeElement.tagName,
      text: document.activeElement.textContent,
      id: document.activeElement.id
    }));
    assert.notEqual(active.tag, 'BODY');
    await c.close();
    return active;
  });
  await check('escape-reveals', async () => {
    const {
      p,
      c
    } = await pageWithClock();
    await p.keyboard.press('Escape');
    assert.equal(await phase(p), 'concluida');
    await c.close();
    return {
      completed: true
    };
  });
  await check('visible-action-during-exit-first-click', async () => {
    const {
      p,
      c
    } = await pageWithClock();
    await p.evaluate(() => window.__qa.fontsReady());
    await p.clock.runFor(40);
    assert.equal(await phase(p), 'saindo');
    await p.getByRole('button', {
      name: 'Ver como funciona',
      exact: true
    }).click({
      timeout: 2000,
      noWaitAfter: true
    });
    await p.clock.runFor(50);
    assert.ok((await p.locator('body').innerText()).includes('Pular'));
    await c.close();
    return {
      onboardingOpened: true
    };
  });
  await check('background-and-return-no-replay', async () => {
    const {
      p,
      c
    } = await pageWithClock();
    await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => true
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await phase(p), 'concluida');
    await p.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => false
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await phase(p), 'concluida');
    await c.close();
    return {
      completed: true,
      replayed: false,
      simulation: 'visibilitychange'
    };
  });
  await check('changed-reduced-preference', async () => {
    const {
      p,
      c
    } = await pageWithClock();
    await p.emulateMedia({
      reducedMotion: 'reduce'
    });
    await p.waitForTimeout(50);
    assert.equal(await phase(p), 'concluida');
    await c.close();
    return {
      completed: true
    };
  });
  await check('reduced-motion-before-hydration', async () => {
    const c = await context({
      reducedMotion: 'reduce',
      javaScriptEnabled: false
    });
    const p = await c.newPage();
    await p.goto(BASE + '/login');
    assert.equal(await p.getByTestId('abertura-studoo').isVisible(), false);
    assert.equal(await p.getByLabel('E-mail', {
      exact: true
    }).isVisible(), true);
    await p.screenshot({
      path: path.join(OUT, 'web-reduced-motion.png')
    });
    await c.close();
    return {
      overlayVisible: false,
      contentVisible: true
    };
  });
  await check('without-javascript-css-fallback', async () => {
    const c = await context({
      javaScriptEnabled: false
    });
    const p = await c.newPage();
    await p.goto(BASE + '/login');
    await p.waitForTimeout(1050);
    assert.equal(await p.getByTestId('abertura-studoo').isVisible(), false);
    assert.equal(await p.getByLabel('E-mail', {
      exact: true
    }).isVisible(), true);
    await c.close();
    return {
      afterMs: 1050,
      contentVisible: true,
      scope: 'HTML form visible; app requires JS'
    };
  });
  await check('query-bypass-without-javascript', async () => {
    const c = await context({
      javaScriptEnabled: false
    });
    const p = await c.newPage();
    await p.goto(BASE + '/login?erro=google_invalido');
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    assert.equal(await p.getByLabel('E-mail', {
      exact: true
    }).isVisible(), true);
    await c.close();
    return {
      overlayCount: 0
    };
  });
  await check('root-query-redirect-keeps-bypass', async () => {
    const c = await context({
      javaScriptEnabled: false
    });
    const p = await c.newPage();
    await p.goto(BASE + '/?retorno=1');
    assert.equal(new URL(p.url()).pathname, '/login');
    assert.equal(new URL(p.url()).search, '?retorno=1');
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      localLogin: true,
      queryPreserved: true,
      overlayCount: 0
    };
  });
  await check('direct-route-without-javascript', async () => {
    const c = await context({
      javaScriptEnabled: false
    });
    const p = await c.newPage();
    await p.goto(BASE + '/privacidade');
    assert.equal(await p.getByTestId('abertura-studoo').count(), 0);
    await c.close();
    return {
      overlayCount: 0
    };
  });
  await check('hash-bypass-before-app-bundle', async () => {
    const c = await context();
    const p = await c.newPage();
    await p.route('**/_next/**/*.js', r => r.abort());
    await p.goto(BASE + '/login#retomar');
    assert.equal(await p.getByTestId('abertura-studoo').isVisible(), false);
    assert.equal(await p.getByLabel('E-mail', {
      exact: true
    }).isVisible(), true);
    await c.close();
    return {
      appScriptsBlocked: true,
      contentVisible: true
    };
  });
  await check('image-failure-releases', async () => {
    const c = await context();
    const p = await c.newPage();
    await p.route('**/marca/logo-com-sorriso.png', r => r.abort());
    await p.goto(BASE + '/login');
    await p.waitForFunction(() => document.querySelector('.abertura-raiz')?.dataset.aberturaFase === 'concluida');
    const reason = await p.locator('.abertura-raiz').getAttribute('data-abertura-motivo');
    assert.equal(reason, 'falha');
    await c.close();
    return {
      reason
    };
  });
  await check('font-failure-releases', async () => {
    const c = await context();
    const p = await c.newPage();
    await p.route('**/*.woff2', r => r.abort());
    await p.goto(BASE + '/login');
    await p.waitForFunction(() => document.querySelector('.abertura-raiz')?.dataset.aberturaFase === 'concluida');
    const reason = await p.locator('.abertura-raiz').getAttribute('data-abertura-motivo');
    assert.equal(reason, 'falha');
    await c.close();
    return {
      reason
    };
  });
  await check('api-delay-does-not-hold-intro', async () => {
    const c = await context();
    const {
      parseEnv
    } = require('node:util');
    const env = parseEnv(await fs.readFile(resolve('.env'), 'utf8'));
    assert.equal(env.IA, 'falsa');
    const login = await c.request.post(BASE + '/api/login', {
      headers: {
        Origin: BASE
      },
      data: {
        email: env.STUDOO_EMAIL,
        senha: env.STUDOO_SENHA
      }
    });
    assert.equal(login.status(), 200);
    const p = await c.newPage();
    let pending = false;
    await p.route('**/api/**', async r => {
      pending = true;
      await new Promise(res => setTimeout(res, 1800));
      await r.continue().catch(() => {});
    });
    await p.goto(BASE + '/');
    await p.waitForFunction(() => document.querySelector('.abertura-raiz')?.dataset.aberturaFase === 'concluida');
    const t = await p.evaluate(() => performance.now());
    assert.ok(t < 1800);
    assert.equal(pending, true);
    await c.close();
    return {
      completeAtNavigationMs: Math.round(t),
      anyApiPending: pending,
      apiDelayedMs: 1800
    };
  });
  await check('same-tab-reload-and-oauth-like-return-no-replay', async () => {
    const c = await context();
    const p = await c.newPage();
    await p.goto(BASE + '/login');
    await p.waitForFunction(() => document.querySelector('.abertura-raiz')?.dataset.aberturaFase === 'concluida');
    await p.reload();
    assert.equal(await p.getByTestId('abertura-studoo').isVisible(), false);
    await p.goto(BASE + '/privacidade');
    await p.goto(BASE + '/login');
    assert.equal(await p.getByTestId('abertura-studoo').isVisible(), false);
    await c.close();
    return {
      replayed: false,
      scope: 'hard navigation in same tab; no real OAuth provider'
    };
  });
  await check('text-200-percent', async () => {
    const c = await context({
      reducedMotion: 'reduce'
    });
    const p = await c.newPage();
    await p.goto(BASE + '/login');
    await p.evaluate(() => {
      const els = [...document.querySelectorAll('label,p,h1,h2,button,a,input')];
      const sizes = els.map(e => [e, getComputedStyle(e).fontSize, getComputedStyle(e).lineHeight]);
      for (const [e, f, l] of sizes) {
        e.style.fontSize = parseFloat(f) * 2 + 'px';
        if (l !== 'normal') e.style.lineHeight = parseFloat(l) * 2 + 'px';
      }
    });
    assert.equal(await p.getByLabel('E-mail', {
      exact: true
    }).isVisible(), true);
    assert.equal(await p.getByRole('button', {
      name: 'Entrar',
      exact: true
    }).isEnabled(), true);
    const horizontalOverflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await c.close();
    return {
      horizontalOverflow,
      entryVisible: true,
      scope: 'intro bypass and next form only'
    };
  });
  // Unmodified browser clock for actual local production timing and videos; cold cache per context.
  await check('production-cold-warm-recording', async () => {
    const c = await context({
      recordVideo: {
        dir: path.join(OUT, 'video-tmp'),
        size: {
          width: 390,
          height: 844
        }
      }
    });
    const p = await c.newPage();
    await p.addInitScript(() => {
      window.__phases = [];
      new MutationObserver(() => {
        const r = document.querySelector('.abertura-raiz');
        if (r && window.__phases.at(-1)?.phase !== r.dataset.aberturaFase) window.__phases.push({
          phase: r.dataset.aberturaFase,
          t: performance.now(),
          reason: r.dataset.aberturaMotivo
        });
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-abertura-fase']
      });
    });
    const times = [];
    for (let i = 0; i < 3; i++) {
      await p.goto(BASE + '/login');
      await p.waitForFunction(() => document.querySelector('.abertura-raiz')?.dataset.aberturaFase === 'concluida');
      times.push(await p.evaluate(() => window.__phases));
      await p.waitForTimeout(450);
    }
    const video = p.video();
    await c.close();
    await video.saveAs(path.join(OUT, 'web-abertura.webm'));
    return {
      runs: times,
      environment: 'headless Chromium; local Next production; no CPU/network throttle',
      coldContexts: 1,
      warmReloads: 2
    };
  });
  await browser.close();
  await fs.writeFile(path.join(OUT, 'browser-web.json'), JSON.stringify({
    date: new Date().toISOString(),
    base: BASE,
    results
  }, null, 2));
  console.log('TOTAL', results.filter(x => x.passed).length, '/', results.length);
  if (results.some(x => !x.passed)) process.exitCode = 1;
})().catch(async e => {
  console.error(e);
  await browser?.close();
  process.exitCode = 1;
});
