import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { test } from "node:test";
import { CARACTERES_ESPECIAIS_DO_TEXTO } from "@studoo/contratos";
import { GLIFOS_400, GLIFOS_700, GLIFOS_800, UNIDADES_POR_EM } from "../packages/contratos/src/glifos.ts";
import { caminho, caracteresDaFonte, lerFonte } from "../scripts/fonte-truetype.mjs";

const VARIAVEL = new URL("../public/marca/Nunito[wght].ttf", import.meta.url).pathname;
const WEB = new URL("../public/marca/nunito-wght.woff2", import.meta.url).pathname;
const APP = new URL("../apps/mobile/assets/fontes/Nunito.ttf", import.meta.url).pathname;
const TABELA = new URL("../packages/contratos/src/glifos.ts", import.meta.url).pathname;
const GREGO_DA_NOTO = "Δπ";

/** Área (soma com sinal, curvas achatadas) e caixa de um caminho M/L/Q/Z em unidades da fonte. */
function medir(d) {
  const re = /([MLQZ])([^MLQZ]*)/g;
  let achado;
  let atual = [0, 0];
  let inicio = [0, 0];
  let area = 0;
  let [xmin, xmax, ymin, ymax] = [Infinity, -Infinity, Infinity, -Infinity];
  const ponto = (x, y) => {
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  };
  const aresta = (x1, y1, x2, y2) => { area += (x1 * y2 - x2 * y1) / 2; };
  while ((achado = re.exec(d))) {
    const n = achado[2].trim() ? achado[2].trim().split(/\s+/).map(Number) : [];
    if (achado[1] === "M") { atual = [n[0], n[1]]; inicio = atual; ponto(...atual); }
    else if (achado[1] === "L") { aresta(...atual, n[0], n[1]); atual = [n[0], n[1]]; ponto(...atual); }
    else if (achado[1] === "Q") {
      let anterior = atual;
      for (let i = 1; i <= 12; i += 1) {
        const t = i / 12;
        const px = (1 - t) ** 2 * atual[0] + 2 * t * (1 - t) * n[0] + t * t * n[2];
        const py = (1 - t) ** 2 * atual[1] + 2 * t * (1 - t) * n[1] + t * t * n[3];
        aresta(anterior[0], anterior[1], px, py);
        anterior = [px, py];
        ponto(px, py);
      }
      atual = [n[2], n[3]];
    } else { aresta(...atual, ...inicio); atual = inicio; }
  }
  return { area: Math.abs(area), xmin, xmax, ymin, ymax };
}

test("o instanciador da fonte variável reproduz o 700 e o 800 estáticos do repositório (avanço, caixa e área)", () => {
  for (const [peso, tabela] of [[700, GLIFOS_700], [800, GLIFOS_800]]) {
    const fonte = lerFonte(VARIAVEL, peso);
    let comparados = 0;
    for (const [caractere, [avancoEstatico, dEstatico]] of Object.entries(tabela)) {
      if (GREGO_DA_NOTO.includes(caractere) || caractere === " ") continue;
      const indice = fonte.indiceDo(caractere.codePointAt(0));
      assert.ok(indice > 0, `${peso}: a variável não tem ${caractere}`);
      assert.ok(Math.abs(fonte.avanco(indice) - avancoEstatico) <= 1, `${peso} ${caractere}: avanço ${fonte.avanco(indice)} contra ${avancoEstatico}`);
      const a = medir(caminho(fonte.pontosDoGlifo(indice)));
      const b = medir(dEstatico);
      for (const lado of ["xmin", "xmax", "ymin", "ymax"]) assert.ok(Math.abs(a[lado] - b[lado]) <= 1.5, `${peso} ${caractere}: ${lado} ${a[lado]} contra ${b[lado]}`);
      assert.ok(Math.abs(a.area - b.area) / Math.max(b.area, 1) <= 0.035, `${peso} ${caractere}: área ${a.area} contra ${b.area}`);
      comparados += 1;
    }
    assert.ok(comparados >= 70, `${peso}: ${comparados} glifos comparados`);
  }
});

test("a tabela do 400 é a fonte variável instanciada em wght 400: o gerador a reproduz glifo a glifo", () => {
  const fonte = lerFonte(VARIAVEL, 400);
  for (const [caractere, [avanco, d]] of Object.entries(GLIFOS_400)) {
    if (GREGO_DA_NOTO.includes(caractere)) continue;
    const indice = fonte.indiceDo(caractere.codePointAt(0));
    assert.ok(indice > 0 || caractere === " ", `a variável não tem ${caractere}`);
    assert.equal(avanco, Math.round(fonte.avanco(indice)), `avanço de ${caractere}`);
    assert.equal(d, caminho(fonte.pontosDoGlifo(indice)), `contorno de ${caractere}`);
  }
});

test("o 400 cobre os mesmos caracteres do 700 (com Δ e π), é mais fino e mais estreito, e a tabela inteira fica abaixo de 200 KB", () => {
  assert.deepEqual(Object.keys(GLIFOS_400).sort(), Object.keys(GLIFOS_700).sort());
  assert.ok(GLIFOS_400["Δ"][1] && GLIFOS_400["π"][1], "o grego do 400 vem da Noto Sans Regular");
  for (const caractere of "xyzabcABC") {
    assert.ok(GLIFOS_400[caractere][0] <= GLIFOS_700[caractere][0], `${caractere} no 400 não é mais largo que no 700`);
    const fino = medir(GLIFOS_400[caractere][1]).area;
    const grosso = medir(GLIFOS_700[caractere][1]).area;
    assert.ok(fino < 0.82 * grosso, `${caractere}: a tinta do 400 (${Math.round(fino)}) é menos que a do 700 (${Math.round(grosso)})`);
  }
  assert.ok(GLIFOS_400["x"][0] < GLIFOS_700["x"][0]);
  assert.equal(UNIDADES_POR_EM, 1000);
  const tamanho = statSync(TABELA).size;
  assert.ok(tamanho < 200_000, `glifos.ts tem ${tamanho} bytes`);
});

test("a Nunito que a web e o app carregam tem o que o texto linear emite: U+2080 a U+2089 (CO₂), os sobrescritos, × ÷ − ≠ ≤ ≥ √ π Δ", () => {
  const web = caracteresDaFonte(WEB);
  const app = caracteresDaFonte(APP);
  assert.ok(web.size > 800 && app.size > 800, `web ${web.size}, app ${app.size}`);
  assert.deepEqual([...web].sort((a, b) => a - b), [...app].sort((a, b) => a - b), "web e app têm os mesmos caracteres");
  for (let codigo = 0x2080; codigo <= 0x2089; codigo += 1) assert.ok(web.has(codigo) && app.has(codigo), `U+${codigo.toString(16)} (subscrito) falta na Nunito`);
  for (const caractere of "⁰¹²³⁴⁵⁶⁷⁸⁹−×÷≠≤≥√Δπ±≈∞…") assert.ok(web.has(caractere.codePointAt(0)) && app.has(caractere.codePointAt(0)), `${caractere} falta na Nunito`);
  // O que a Nunito não tem é desenhado pela fonte do sistema (nenhum quadrado): a seta do operador `→`, e só no LaTeX que não lê,
  // as letras gregas e ∈ ∪ ∩. Se esta lista mudar, alguém emitiu um caractere novo.
  const ausentes = [...CARACTERES_ESPECIAIS_DO_TEXTO].filter((caractere) => !web.has(caractere.codePointAt(0)));
  assert.deepEqual(ausentes.sort().join(""), [..."→αβγδεθλρσφωΓΠ∈∪∩"].sort().join(""));
  assert.equal(/[₀-₉]/.test(ausentes.join("")), false, "nenhum subscrito falta");
});
