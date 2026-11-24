// Ensaio local: veja ABERTURA.md. Não instrumenta o código de produção.
const { resolve, dirname } = require('node:path');
const { execFileSync } = require('node:child_process');
let pw;
try { pw = require(resolve('.studoo-local/navegador-qa/node_modules/playwright-core')); }
catch { try { pw = require('playwright'); } catch { pw = require('playwright-core'); } }
const { chromium } = pw;
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

const OUT = resolve(process.env.QA_OUT || '.studoo-local/abertura-app', 'browser-app-motion-independent.json');
const BASE = process.env.QA_APP_BASE || 'http://localhost:8090';

function observeIntro() {
  const evidence = window.__introEvidence = { events: [], resources: [], timeOrigin: performance.timeOrigin };
  let prior = 'absent-before-mount';
  let seen = false;
  let markLoaded = false;
  let readyScheduled = false;
  const stamp = (name, extra = {}) => evidence.events.push({ name, atMs: performance.now(), ...extra });
  const nameOf = (url) => { try { return new URL(url, location.href).pathname.replace(/\/$/, '').split('/').at(-1); } catch { return 'unknown'; } };
  const seenImages = new WeakSet();
  const watchImage = (img) => {
    if (seenImages.has(img)) return;
    seenImages.add(img);
    const loaded = () => { if (!markLoaded) { markLoaded = true; stamp('brand-image-loaded', { complete: img.complete }); } sample(); };
    img.addEventListener('load', loaded, { once: true });
    img.addEventListener('error', () => stamp('brand-image-error'), { once: true });
    if (img.complete && img.naturalWidth > 0) loaded();
  };
  function sample() {
    const layer = document.querySelector('[data-testid="abertura-studoo"]');
    const state = layer ? (getComputedStyle(layer).pointerEvents === 'none' ? 'saindo' : 'visivel') : (seen ? 'concluida' : 'absent-before-mount');
    if (layer) seen = true;
    if (state !== prior) { prior = state; stamp(state); }
    const mark = document.querySelector('[data-testid="abertura-marca"]');
    if (mark) {
      if (mark.tagName === 'IMG') watchImage(mark);
      for (const img of mark.querySelectorAll('img')) watchImage(img);
    }
    // This is an external DOM estimate, not instrumentation of React's pronta prop.
    if (!readyScheduled && layer && markLoaded && document.fonts?.status === 'loaded' && document.fonts.size > 0) {
      readyScheduled = true;
      stamp('local-dom-assets-ready-estimate', { fontFaces: [...document.fonts].map(f => ({ family: f.family, status: f.status })) });
      requestAnimationFrame(() => requestAnimationFrame(() => stamp('local-dom-two-raf-estimate')));
    }
  }
  new MutationObserver(sample).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-testid'] });
  document.fonts?.addEventListener('loading', () => stamp('fonts-loading'));
  document.fonts?.addEventListener('loadingdone', () => { stamp('fonts-loadingdone', { faceCount: document.fonts.size }); sample(); });
  document.fonts?.addEventListener('loadingerror', () => stamp('fonts-loadingerror'));
  document.fonts?.ready.then(() => stamp('document-fonts-ready-initial', { faceCount: document.fonts.size }));
  document.addEventListener('DOMContentLoaded', sample);
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (/\.(ttf|otf|png)(\?|$)/i.test(e.name)) evidence.resources.push({ name: nameOf(e.name), startAtMs: e.startTime, endAtMs: e.responseEnd, transferSize: e.transferSize });
    }
  }).observe({ type: 'resource', buffered: true });
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.STUDOO_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox'] });
  const results = [];
  const check = async (name, fn) => {
    try { results.push({ name, passed: true, evidence: await fn() }); console.log('PASS', name); }
    catch (e) { results.push({ name, passed: false, error: e.message, evidence: e.evidence ?? null }); console.log('FAIL', name, e.message); }
  };
  try {
    const context = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    await context.addInitScript(observeIntro);
    const page = await context.newPage();
    for (let i = 0; i < 3; i++) {
      await check(i === 0 ? 'cold-browser-cache-boot' : `same-context-reload-${i}`, async () => {
        if (i === 0) await page.goto(BASE, { waitUntil: 'domcontentloaded' });
        else await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__introEvidence.events.some(e => e.name === 'concluida'), null, { timeout: 15000 });
        await page.waitForTimeout(80);
        const e = await page.evaluate(() => window.__introEvidence);
        const visible = e.events.find(e => e.name === 'visivel');
        const exit = e.events.find(e => e.name === 'saindo');
        const done = e.events.find(e => e.name === 'concluida');
        try {
          assert.ok(visible && exit && done, 'Expected all three DOM phases');
          assert.ok(done.atMs - visible.atMs < 900, 'Observed layer lifetime must stay below 900ms on normal boot');
        } catch (error) { error.evidence = e; throw error; }
        e.measured = { visibleToExitMs: exit.atMs - visible.atMs, exitToRemovedMs: done.atMs - exit.atMs, visibleToRemovedMs: done.atMs - visible.atMs };
        e.destination = (await page.locator('body').innerText()).slice(0, 220);
        return e;
      });
    }
    await check('same-document-query-return-no-replay', async () => {
      const before = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, eventCount: window.__introEvidence.events.filter(e => e.name === 'visivel').length }));
      await page.evaluate(() => { history.pushState({}, '', '/?origem=qa-intro'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForTimeout(100);
      await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
      await page.waitForTimeout(150);
      const after = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, eventCount: window.__introEvidence.events.filter(e => e.name === 'visivel').length, overlayCount: document.querySelectorAll('[data-testid="abertura-studoo"]').length }));
      assert.equal(after.timeOrigin, before.timeOrigin); assert.equal(after.eventCount, before.eventCount); assert.equal(after.overlayCount, 0);
      return { before, after, scope: 'Synthetic History API + popstate query change/return in same document, not real native navigation' };
    });
    await context.close();
    await check('background-return-interrupts-without-replay', async () => {
      const c = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
      await c.addInitScript(observeIntro);
      const p = await c.newPage();
      await p.route(/\.(ttf|otf)(\?|$)/, r => new Promise(() => {}));
      await p.goto(BASE, { waitUntil: 'domcontentloaded' });
      await p.getByTestId('abertura-studoo').waitFor({ state: 'attached' });
      await p.evaluate(() => {
        window.__introEvidence.events.push({ name: 'simulated-background', atMs: performance.now() });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await p.getByTestId('abertura-studoo').waitFor({ state: 'detached' });
      await p.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
        window.__introEvidence.events.push({ name: 'simulated-foreground', atMs: performance.now() });
      });
      await p.waitForTimeout(200);
      const e = await p.evaluate(() => ({ ...window.__introEvidence, overlayCount: document.querySelectorAll('[data-testid="abertura-studoo"]').length }));
      assert.equal(e.overlayCount, 0); assert.equal(e.events.filter(x => x.name === 'visivel').length, 1);
      const hidden = e.events.find(x => x.name === 'simulated-background'); const done = e.events.find(x => x.name === 'concluida');
      assert.ok(done.atMs - hidden.atMs < 120, 'Background should skip instead of dissolving');
      e.backgroundToRemovalMs = done.atMs - hidden.atMs;
      e.scope = 'Synthetic document.hidden/visibilityState and visibilitychange; does not prove real native AppState';
      await c.close(); return e;
    });
    await fs.mkdir(dirname(OUT), { recursive: true });
    await fs.writeFile(OUT, JSON.stringify({ date: new Date().toISOString(), surface: 'app_previa_web', base: BASE, sourceCommit: process.env.QA_SOURCE_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), productionInstrumented: false, cacheScope: 'Fresh browser context then two reloads in the same context. Expo dev can transfer assets again; this does not assert cache hits', environment: 'Headless Chromium; local Expo development server; no CPU/network throttle; 390x844', observation: 'MutationObserver DOM phases; external font/image/two-RAF estimates are not exact React pronta callbacks', results }, null, 2));
    console.log('TOTAL', results.filter(r => r.passed).length, '/', results.length);
    if (results.some(r => !r.passed)) process.exitCode = 1;
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
