// A troca de tela do celular do herói da página de apresentação (spec 18, 1.4) sem quadro vazio: amostra, a cada 50 ms e por dois ciclos (2 × 3 telas × 3,5 s), as opacidades das três `.cn-tela`
// e exige que a SOMA nunca fique abaixo de 0,95 (a que sai fica inteira por baixo até a nova terminar de entrar por cima). Falha, com saída 1, no código antigo (a soma chegava a 0).
// Uso, com o site no ar (por exemplo `npm run build && npm run start`):
//   node scripts/qa/heroi-troca.mjs --base=http://localhost:3000 [--motor=chromium|webkit] [--ciclos=2] [--minimo=0.95]
// O Chromium e o `playwright-core` são os mesmos dos outros roteiros (veja o LEIA-ME); o WebKit exige as bibliotecas do sistema que o Playwright pede (`npx playwright install-deps webkit`).
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

const argumento = (nome, padrao) => process.argv.find((s) => s.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? padrao;
const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const motor = argumento("motor", "chromium");
const ciclos = Number(argumento("ciclos", "2"));
const minimo = Number(argumento("minimo", "0.95"));
const localRequire = createRequire(import.meta.url);

async function lancar() {
  const interno = resolve(".studoo-local/navegador-qa/node_modules/playwright-core");
  let pw;
  try { pw = localRequire(existsSync(interno) ? interno : "playwright-core"); } catch { throw new Error("Falta o playwright-core do roteiro; veja o LEIA-ME."); }
  if (motor === "webkit") return pw.webkit.launch();
  const cache = join(homedir(), ".cache", "ms-playwright");
  const binarios = (await readdir(cache)).filter((p) => /^chromium-\d+$/.test(p)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  const chrome = binarios.map((p) => join(cache, p, "chrome-linux64", "chrome")).find(existsSync);
  if (!chrome) throw new Error("Falta o Chromium de ensaio.");
  return pw.chromium.launch({ headless: true, executablePath: chrome });
}

const navegador = await lancar();
const pagina = await (await navegador.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" })).newPage();
await pagina.goto(`${base}/conheca`, { waitUntil: "networkidle" });
const amostras = await pagina.evaluate((ms) => new Promise((resolver) => {
  const telas = [...document.querySelectorAll(".cn-heroi__celular .cn-tela")];
  const saida = []; const inicio = performance.now();
  const passo = () => {
    const t = performance.now() - inicio;
    saida.push({ t: Math.round(t), ativa: telas.findIndex((e) => e.hasAttribute("data-ativa")), opacidades: telas.map((e) => Number(getComputedStyle(e).opacity)) });
    if (t < ms) setTimeout(passo, 50); else resolver(saida);
  };
  passo();
}), ciclos * 3 * 3500 + 1500);
await navegador.close();
const somas = amostras.map((a) => a.opacidades.reduce((x, y) => x + y, 0));
const abaixo = amostras.filter((_, i) => somas[i] < minimo);
const telasVistas = new Set(amostras.map((a) => a.ativa));
const ok = abaixo.length === 0 && telasVistas.size === 3;
console.log(`${ok ? "ok" : "FALHOU"} ${motor}: ${amostras.length} amostras em ${(amostras.at(-1).t / 1000).toFixed(1)} s, telas vistas ${[...telasVistas].join(",")}, soma mínima das opacidades ${Math.min(...somas).toFixed(3)}, abaixo de ${minimo} em ${abaixo.length}`);
for (const a of abaixo.slice(0, 8)) console.log(`  ${a.t} ms: ativa ${a.ativa}, opacidades ${a.opacidades.join("/")}`);
process.exit(ok ? 0 : 1);
