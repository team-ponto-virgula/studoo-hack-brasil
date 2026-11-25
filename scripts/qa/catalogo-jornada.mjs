/** Catálogo dos componentes reais: apenas a rota de desenvolvimento, sem credenciais ou serviços de produto. */
import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.QA_BASE || 'http://localhost:3020';
const out = resolve(process.env.QA_OUT || '.studoo-local/qa/catalogo-jornada');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.STUDOO_CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox'] });
const evidence = { scope: 'web real / bancada de desenvolvimento', generatedAt: new Date().toISOString(), results: [], files: [] };
try {
  for (const [width, height] of [[390, 844], [360, 800]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/sistema-ui');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const percent of [100, 200]) {
      await page.evaluate(p => { document.documentElement.style.fontSize = `${p}%`; }, percent);
      const metrics = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('.botao')].map(button => {
          const box = button.getBoundingClientRect();
          return { label: button.textContent.trim(), height: box.height, width: box.width, clipped: button.scrollWidth > button.clientWidth + 1 };
        });
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, font: getComputedStyle(document.querySelector('h1')).fontSize, buttons };
      });
      assert.equal(metrics.scrollWidth, width, 'Sem transbordamento horizontal');
      assert.ok(metrics.buttons.every(b => b.height >= 44 && !b.clipped), 'Ações legíveis e com alvo mínimo');
      assert.deepEqual(errors, [], 'Nenhum erro JavaScript');
      const file = `catalogo-${width}-${percent}.png`;
      await page.screenshot({ path: resolve(out, file), fullPage: true });
      evidence.results.push({ width, height, percent, passed: true, metrics, file });
      evidence.files.push(file);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
    const opener = page.getByRole('button', { name: 'Ver confirmação de recomeço', exact: true });
    await opener.click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    assert.equal(await dialog.evaluate(e => e.contains(document.activeElement)), true, 'Foco dentro da confirmação');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.textContent === 'Ver confirmação de recomeço');
    evidence.results.push({ width, check: 'confirmacao / Escape / foco no acionador', passed: true });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 1120, height: 1000 }, reducedMotion: 'reduce' });
  await page.goto(base + '/sistema-ui');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(out, 'catalogo-componentes.png'), fullPage: true });
  await page.pdf({ path: resolve(out, 'studoo-jornada-azul-componentes.pdf'), format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '8mm', right: '8mm' }, tagged: true });
  evidence.files.push('catalogo-componentes.png', 'studoo-jornada-azul-componentes.pdf');
  evidence.artifacts = await Promise.all(evidence.files.map(async file => {
    const bytes = await readFile(resolve(out, file));
    return { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  await page.close();
  await writeFile(resolve(out, 'resultado.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, views: 4, focusChecks: 2, artifacts: evidence.artifacts.length, out }));
} finally {
  await browser.close();
}
