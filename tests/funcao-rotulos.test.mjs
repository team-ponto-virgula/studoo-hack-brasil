import assert from "node:assert/strict";
import { test } from "node:test";
import { desenharVisual, validarVisual } from "@studoo/contratos";

/*
 * Marco 12a, grupo 4 (spec 15, seção 17): os rótulos dos destaques do gráfico de função. Nunca se encostam (vão de pelo menos 4, ou o que sobra vai para a legenda),
 * nunca pisam num losango e, quando há lugar, fogem do traço da curva: o máximo do seno fica em cima, o mínimo embaixo, e o P que corta o eixo não senta na descida.
 */

const valido = (bruto) => {
  const lido = validarVisual(bruto);
  assert.equal(lido.ok, true, lido.motivo);
  return lido.visual;
};
const desenho = (bruto) => desenharVisual(valido(bruto), { tipo: "enunciado" });
const rotulosDe = (d) => d.caixas.filter((caixa) => caixa.tipo === "rotulo" && !/^[fgh]$/.test(caixa.texto));
const vaoEntre = (a, b) => Math.hypot(Math.max(0, a.x - (b.x + b.largura), b.x - (a.x + a.largura)), Math.max(0, a.y - (b.y + b.altura), b.y - (a.y + a.altura)));
const numerosDe = (caminho) => (caminho.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
/** O centro de cada losango (o caminho de 4 pontos, preenchido de "especial"): é onde o destaque está. */
const losangosDe = (d) => d.primitivas
  .filter((p) => p.tipo === "caminho" && p.preenchimento === "especial" && (p.d.match(/[LM]/g) ?? []).length === 4)
  .map((p) => {
    const n = numerosDe(p.d);
    const xs = n.filter((_, i) => i % 2 === 0);
    const ys = n.filter((_, i) => i % 2 === 1);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  });
/** Os vértices do traço da curva (o caminho de largura 3 que não é losango). */
const traçoDe = (d) => d.primitivas
  .filter((p) => p.tipo === "caminho" && p.borda && p.larguraDaBorda === 3 && p.borda !== "branco")
  .flatMap((p) => { const n = numerosDe(p.d); return n.reduce((pares, valor, i) => (i % 2 === 0 ? [...pares, [valor, n[i + 1]]] : pares), []); });
const bateNaCaixa = (caixa, [x, y], folga = 0) => x > caixa.x - folga && x < caixa.x + caixa.largura + folga && y > caixa.y - folga && y < caixa.y + caixa.altura + folga;

const parabola = (latex, pontos = [{ id: "A", tipo: "raiz" }, { id: "B", tipo: "raiz" }, { id: "V", tipo: "vertice" }, { id: "C", tipo: "intercepto" }]) =>
  ({ tipo: "funcao", alt: "Parábola.", curvas: [{ latex, nome: "f" }], pontos });

test("as raízes 1 e 3 da parábola: os rótulos A e B nunca se encostam (vão de pelo menos 4) nem pisam em losango", () => {
  const d = desenho(parabola("x^2 - 4x + 3"));
  const rotulos = rotulosDe(d);
  assert.deepEqual(rotulos.map((r) => r.texto), ["A (1, 0)", "B (3, 0)", "V (2, −1)", "C (0, 3)"]);
  for (let i = 0; i < rotulos.length; i += 1) for (let j = i + 1; j < rotulos.length; j += 1) assert.ok(vaoEntre(rotulos[i], rotulos[j]) >= 4 - 1e-6, `${rotulos[i].texto} e ${rotulos[j].texto}: ${vaoEntre(rotulos[i], rotulos[j]).toFixed(2)}`);
  const losangos = losangosDe(d);
  assert.equal(losangos.length, 4);
  for (const rotulo of rotulos) for (const losango of losangos) assert.equal(bateNaCaixa(rotulo, [losango.x, losango.y], 4), false, `${rotulo.texto} pisa num losango`);
});

test("a parábola x² − 3x + 2, com as raízes 1 e 2 e o vértice 1,5 apertados: nenhum rótulo toca outro nem pisa num losango", () => {
  const d = desenho(parabola("x^2 - 3x + 2"));
  const rotulos = rotulosDe(d);
  assert.ok(rotulos.length >= 4, "os quatro destaques têm letra");
  for (let i = 0; i < rotulos.length; i += 1) for (let j = i + 1; j < rotulos.length; j += 1) assert.ok(vaoEntre(rotulos[i], rotulos[j]) >= 4 - 1e-6, `${rotulos[i].texto} e ${rotulos[j].texto}`);
  for (const rotulo of rotulos) for (const losango of losangosDe(d)) assert.equal(bateNaCaixa(rotulo, [losango.x, losango.y], 5), false, `${rotulo.texto} pisa num losango`);
});

test("o seno: o máximo fica em cima, o mínimo embaixo e o P (que corta o eixo) sai da descida; nenhum rótulo toca o traço", () => {
  const d = desenho({
    tipo: "funcao", alt: "A onda h(x) = sen x.", curvas: [{ latex: "\\sin x", nome: "h", de: 0, ate: "2\\pi" }],
    pontos: [{ id: "M", x: "\\frac{\\pi}{2}", y: 1 }, { id: "P", x: "\\pi", y: 0 }, { id: "N", x: "\\frac{3\\pi}{2}", y: -1 }],
  });
  const [m, p, n] = ["M (π/2, 1)", "P (π, 0)", "N (3π/2, −1)"].map((texto) => rotulosDe(d).find((r) => r.texto === texto));
  const losangos = losangosDe(d).sort((a, b) => a.x - b.x);
  assert.ok(m.y + m.altura <= losangos[0].y, "o máximo M tem o rótulo acima do ponto");
  assert.ok(n.y >= losangos[2].y, "o mínimo N tem o rótulo abaixo do ponto");
  assert.ok(p.x >= losangos[1].x, "o P tem o rótulo à direita: a curva desce para a esquerda dele");
  const traço = traçoDe(d);
  assert.ok(traço.length > 50);
  for (const rotulo of [m, p, n]) assert.equal(traço.filter((ponto) => bateNaCaixa(rotulo, ponto, 1)).length, 0, `${rotulo.texto} tem o traço da curva por baixo`);
});

test("a reta e o cosseno: os rótulos saem do traço quando há lugar", () => {
  for (const bruto of [
    { tipo: "funcao", alt: "A reta.", curvas: [{ latex: "2x + 1", nome: "g", de: -2, ate: 2 }], pontos: [{ id: "C", tipo: "intercepto" }, { id: "R", tipo: "raiz" }] },
    { tipo: "funcao", alt: "O cosseno.", curvas: [{ latex: "\\cos x", nome: "g", de: 0, ate: "2\\pi" }], pontos: [{ id: "A", x: 0, y: 1 }, { id: "B", x: "\\pi", y: -1 }, { id: "C", x: "2\\pi", y: 1 }] },
  ]) {
    const d = desenho(bruto);
    const traço = traçoDe(d);
    for (const rotulo of rotulosDe(d)) assert.equal(traço.filter((ponto) => bateNaCaixa(rotulo, ponto, 1)).length, 0, `${rotulo.texto} tem o traço da curva por baixo`);
  }
});

test("em 60 parábolas de coeficientes variados, os rótulos nunca se encostam (vão ≥ 4) nem pisam num losango, no enunciado e no retorno", () => {
  let semente = 20251121;
  const sorteio = (de, ate) => { semente = (semente * 1664525 + 1013904223) % 4294967296; return de + Math.floor((semente / 4294967296) * (ate - de + 1)); };
  let desenhadas = 0;
  for (let i = 0; i < 60; i += 1) {
    const raiz1 = sorteio(-4, 3);
    const raiz2 = raiz1 + sorteio(1, 5);
    const a = sorteio(1, 2) * (sorteio(0, 1) === 0 ? 1 : -1);
    const latex = `${a} x^2 ${-a * (raiz1 + raiz2) >= 0 ? "+" : "-"} ${Math.abs(a * (raiz1 + raiz2))} x ${a * raiz1 * raiz2 >= 0 ? "+" : "-"} ${Math.abs(a * raiz1 * raiz2)}`;
    const lido = validarVisual(parabola(latex));
    if (!lido.ok) continue;
    for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }]) {
      const d = desenharVisual(lido.visual, contexto);
      if (!d || d.naoCabe) continue;
      desenhadas += 1;
      const rotulos = rotulosDe(d);
      const losangos = losangosDe(d);
      for (let x = 0; x < rotulos.length; x += 1) {
        for (let y = x + 1; y < rotulos.length; y += 1) assert.ok(vaoEntre(rotulos[x], rotulos[y]) >= 4 - 1e-6, `${latex}: ${rotulos[x].texto} e ${rotulos[y].texto} a ${vaoEntre(rotulos[x], rotulos[y]).toFixed(2)}`);
        for (const losango of losangos) assert.equal(bateNaCaixa(rotulos[x], [losango.x, losango.y], 3), false, `${latex}: ${rotulos[x].texto} pisa num losango`);
      }
    }
  }
  assert.ok(desenhadas >= 80, `${desenhadas} desenhos conferidos`);
});
