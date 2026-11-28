// A carga da página de apresentação (spec 18) no celular: o que ela busca de imagem na carga e quando. A primeira captura do herói é o LCP e não pode disputar a banda com mais nada de imagem: as
// telas 2 e 3 do herói só são liberadas depois da carga (mais 1 s) e as capturas dos momentos do S2 e a da janela só são buscadas quando a página já carregou e elas chegam a uns 700 px da tela.
// Falha, com saída 1, no código em que o `loading="lazy"` do navegador buscava tudo isso junto com a primeira (uns 300 kB a mais na mesma banda; as telas 2 e 3 do herói, "escondidas" com
// `hidden`, eram buscadas na carga porque o `display: block` da captura passava por cima do atributo).
// Uso, com o site de produção no ar (veja o LEIA-ME): node scripts/qa/carga-da-pagina.mjs --base=http://localhost:3000 [--aparelho=android|iphone]
// Confere, em Chromium emulando um celular de 390 px e tela de 2x, o INÍCIO de cada pedido de imagem: (1) até o `load` e mais 250 ms só a primeira tela do herói; (2) as telas 2 e 3 só ≥ 900 ms
// depois do `load`; (3) as do S2 e a da janela só depois do `load` (mais 250 ms), e ao rolar chegam em AVIF e aparecem (naturalWidth > 0); (4) sem JavaScript, o <noscript> traz as capturas;
// (5) o peso das imagens buscadas até o `load` (mais 250 ms) é só o da primeira tela, abaixo de 30 kB.
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

const argumento = (nome, padrao) => process.argv.find((s) => s.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? padrao;
const base = argumento("base", "http://localhost:3000").replace(/\/$/, "");
const aparelho = argumento("aparelho", "android");
const AGENTES = {
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
};
const localRequire = createRequire(import.meta.url);

async function lancar() {
  const interno = resolve(".studoo-local/navegador-qa/node_modules/playwright-core");
  let pw;
  try { pw = localRequire(existsSync(interno) ? interno : "playwright-core"); } catch { throw new Error("Falta o playwright-core do roteiro; veja o LEIA-ME."); }
  const cache = join(homedir(), ".cache", "ms-playwright");
  const binarios = (await readdir(cache)).filter((p) => /^chromium-\d+$/.test(p)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  const chrome = binarios.map((p) => join(cache, p, "chrome-linux64", "chrome")).find(existsSync);
  if (!chrome) throw new Error("Falta o Chromium de ensaio.");
  return pw.chromium.launch({ headless: true, executablePath: chrome });
}

const resultados = [];
const conferir = (nome, ok, detalhe = "") => { resultados.push(ok); console.log(`${ok ? "ok    " : "FALHOU"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`); };
const imagensDaPagina = (url) => /\/landing\/.+\.(avif|webp)(\?|$)/.test(url);
const tipoDe = (url) => (url.endsWith(".avif") ? "avif" : "webp");
const rotuloDe = (url) => new URL(url).pathname.replace("/landing/", "").replace(/\.[0-9a-f]{8}\.(avif|webp)$/, "");

const navegador = await lancar();

// 1) A carga e a primeira rolagem, com JavaScript.
{
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: AGENTES[aparelho], reducedMotion: "no-preference" });
  const pagina = await contexto.newPage();
  const pedidos = [];
  const inicio = Date.now();
  pagina.on("request", (pedido) => { if (imagensDaPagina(pedido.url())) pedidos.push({ url: pedido.url(), t: Date.now() - inicio, bytes: 0 }); });
  pagina.on("response", async (resposta) => {
    const pedido = pedidos.find((p) => p.url === resposta.url());
    if (pedido) pedido.bytes = (await resposta.body().catch(() => Buffer.alloc(0))).length;
  });
  let aoCarregar = 0;
  pagina.on("load", () => { aoCarregar = Date.now() - inicio; });
  await pagina.goto(`${base}/conheca`, { waitUntil: "load" });
  await pagina.waitForTimeout(3200);
  const todos = pedidos.map((p) => ({ ...p, rotulo: rotuloDe(p.url) }));
  const ateACarga = todos.filter((p) => p.t < aoCarregar + 250);
  conferir("até o `load` (mais 250 ms) só a primeira tela do herói é buscada", ateACarga.length === 1 && /^heroi-1-/.test(ateACarga[0].rotulo) && tipoDe(ateACarga[0].url) === "avif", `${ateACarga.map((p) => `${p.rotulo} em ${p.t} ms`).join(" | ") || "nenhuma"} (carga em ${aoCarregar} ms)`);
  const doHeroi = todos.filter((p) => /^heroi-/.test(p.rotulo));
  const outras = doHeroi.filter((p) => !/^heroi-1-/.test(p.rotulo));
  conferir("o herói busca as três telas, em AVIF", doHeroi.length === 3 && doHeroi.every((p) => tipoDe(p.url) === "avif"), doHeroi.map((p) => `${p.rotulo} ${p.bytes} B`).join(" | "));
  conferir("as telas 2 e 3 só são buscadas ≥ 900 ms depois da carga", outras.length === 2 && outras.every((p) => p.t >= aoCarregar + 900), `carga em ${aoCarregar} ms; as outras em ${outras.map((p) => p.t).join(" e ")} ms`);
  const doS2Cedo = todos.filter((p) => /^(momento|janela)-/.test(p.rotulo) && p.t < aoCarregar + 250);
  conferir("nenhuma captura do S2 nem a da janela é buscada antes do `load` (mais 250 ms)", doS2Cedo.length === 0, doS2Cedo.map((p) => `${p.rotulo} em ${p.t} ms`).join(", "));
  const bytesAteACarga = ateACarga.reduce((soma, p) => soma + p.bytes, 0);
  conferir("o peso das imagens buscadas até a carga é só o da primeira tela (abaixo de 30 kB)", bytesAteACarga > 0 && bytesAteACarga < 30_000, `${bytesAteACarga} B`);

  // Rolar até o S2: as capturas chegam perto da tela e aparecem.
  await pagina.locator(".cn-s2").scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(1500);
  await pagina.evaluate(() => window.scrollBy(0, 2600));
  await pagina.waitForTimeout(1800);
  const doS2 = pedidos.map((p) => ({ ...p, rotulo: rotuloDe(p.url) })).filter((p) => /^(momento|janela)-/.test(p.rotulo));
  const esperadas = ["momento-1", "momento-2", "momento-3", "momento-4", "janela-4"];
  conferir("ao rolar, as cinco capturas do S2 são buscadas (uma vez cada), em AVIF", esperadas.every((id) => doS2.filter((p) => p.rotulo.startsWith(`${id}-`)).length === 1) && doS2.every((p) => tipoDe(p.url) === "avif"), doS2.map((p) => `${p.rotulo} ${p.bytes} B`).join(" | "));
  const estado = await pagina.evaluate(() => [...document.querySelectorAll(".cn-s2 img.cn-captura")].map((img) => ({ visivel: img.naturalWidth > 0 && !img.currentSrc.startsWith("data:"), atual: img.currentSrc.split("/").pop(), pendente: img.hasAttribute("data-srcset") })));
  conferir("depois de rolar, cada captura do S2 está carregada (não é mais o pixel) e sem atributo pendente", estado.length === 5 && estado.every((e) => e.visivel && !e.pendente), JSON.stringify(estado.map((e) => e.atual)));
  await contexto.close();
}

// 2) Sem JavaScript: o <noscript> traz as capturas de verdade e o pixel some.
{
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, userAgent: AGENTES[aparelho], javaScriptEnabled: false });
  const pagina = await contexto.newPage();
  await pagina.goto(`${base}/conheca`, { waitUntil: "load" });
  await pagina.locator(".cn-s2").scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(1500);
  const sem = await pagina.evaluate(() => {
    const imagens = [...document.querySelectorAll(".cn-s2 img.cn-captura")].filter((img) => img.getBoundingClientRect().width > 0);
    return { total: imagens.length, carregadas: imagens.filter((img) => img.complete && img.naturalWidth > 0 && !img.currentSrc.startsWith("data:")).length };
  });
  conferir("sem JavaScript o <noscript> traz as cinco capturas do S2 (e só elas aparecem)", sem.total === 5 && sem.carregadas === 5, `${sem.carregadas} carregadas de ${sem.total} visíveis`);
  await contexto.close();
}

await navegador.close();
process.exit(resultados.every(Boolean) ? 0 : 1);
