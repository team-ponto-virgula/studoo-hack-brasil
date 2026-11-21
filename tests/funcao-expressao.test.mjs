import assert from "node:assert/strict";
import { test } from "node:test";
import {
  avaliarFuncao,
  familiaDaFuncao,
  grauDoPolinomio,
  interceptoDaFuncao,
  lerExpressaoDaFuncao,
  lerNumeroComPi,
  multiploDePiSobre4,
  raizesDaFuncao,
  verticeDaFuncao,
} from "../packages/contratos/src/funcao-expressao.ts";

/*
 * Marco 12a (spec 15, seção 15): a expressão de uma curva. O servidor refaz as contas (a IA erra, o servidor não): lê o LaTeX restrito da
 * seção 1, expande o que for polinômio até o grau 3 e acha raízes (até o grau 2), vértice, intercepto e valor; seno, cosseno e raiz entram
 * como termo de número × função(a·x + b); qualquer outra coisa invalida a curva.
 */

const ok = (fonte) => {
  const lida = lerExpressaoDaFuncao(fonte);
  assert.equal(lida.ok, true, `${JSON.stringify(fonte)} devia ler: ${lida.erro}`);
  return lida;
};
const recusada = (fonte) => {
  const lida = lerExpressaoDaFuncao(fonte);
  assert.equal(lida.ok, false, `${JSON.stringify(fonte)} devia ser recusada`);
  return lida.erro;
};
const perto = (valor, esperado, mensagem = "") => assert.ok(Math.abs(valor - esperado) < 1e-9, `${mensagem} ${valor} ≠ ${esperado}`);

test("os três casos da spec: a parábola x² − 4x + 3, a reta 2x + 1 e o seno", () => {
  const parabola = ok("x^2 - 4x + 3");
  assert.deepEqual(parabola.modelo.poli, [3, -4, 1, 0]);
  assert.equal(parabola.canonica, "x^2 - 4x + 3");
  assert.equal(grauDoPolinomio(parabola.modelo), 2);
  assert.deepEqual(raizesDaFuncao(parabola.modelo), [1, 3], "as raízes A (1, 0) e B (3, 0), da menor para a maior");
  assert.deepEqual(verticeDaFuncao(parabola.modelo), [2, -1], "o vértice V (2, −1)");
  assert.deepEqual(interceptoDaFuncao(parabola.modelo), [0, 3], "o intercepto C (0, 3)");
  assert.equal(avaliarFuncao(parabola.modelo, -1), 8, "f(−1) = 8, o que a janela recorta em 6");

  const reta = ok("2x+1");
  assert.deepEqual(reta.modelo.poli, [1, 2, 0, 0]);
  assert.deepEqual(raizesDaFuncao(reta.modelo), [-0.5], "a raiz R (−0,5; 0)");
  assert.deepEqual(interceptoDaFuncao(reta.modelo), [0, 1]);
  assert.equal(verticeDaFuncao(reta.modelo), null, "reta não tem vértice");

  const seno = ok("\\sin(x)");
  assert.equal(seno.canonica, "\\sin (x)", "a fórmula da figura é a função reta: a tela mostra \"h(x) = sen x\" (spec 15, seção 18)");
  assert.deepEqual(seno.modelo.atomos, [{ tipo: "seno", coef: 1, a: 1, b: 0 }]);
  perto(avaliarFuncao(seno.modelo, Math.PI / 2), 1);
  perto(avaliarFuncao(seno.modelo, Math.PI), 0);
  perto(avaliarFuncao(seno.modelo, (3 * Math.PI) / 2), -1);
  assert.equal(familiaDaFuncao(seno.modelo), "trigonometrica");
  assert.equal(raizesDaFuncao(seno.modelo), null, "o servidor não calcula raiz de seno");
  assert.equal(familiaDaFuncao(parabola.modelo), "polinomio");
});

test("o que vale: número, polinômio até o grau 3, produto e potência que expandem, fração por número, π nos coeficientes, f(x) = na frente", () => {
  assert.deepEqual(ok("5").modelo.poli, [5, 0, 0, 0], "uma constante");
  assert.deepEqual(ok("-x^2+4").modelo.poli, [4, 0, -1, 0]);
  assert.deepEqual(ok("x^3 - x").modelo.poli, [0, -1, 0, 1]);
  assert.deepEqual(ok("0.5x^2 - 3.25x").modelo.poli, [0, -3.25, 0.5, 0]);
  assert.deepEqual(ok("\\frac{1}{2}x^2 - 3").modelo.poli, [-3, 0, 0.5, 0]);
  assert.deepEqual(ok("\\frac{x^2}{4}").modelo.poli, [0, 0, 0.25, 0]);
  assert.deepEqual(ok("(x-2)^2-1").modelo.poli, [3, -4, 1, 0], "(x − 2)² − 1 é a mesma parábola, expandida");
  assert.deepEqual(ok("(x-1)(x-3)").modelo.poli, [3, -4, 1, 0], "produto de dois parênteses");
  assert.deepEqual(ok("2 \\times x").modelo.poli, [0, 2, 0, 0]);
  assert.deepEqual(ok("x^{2}").modelo.poli, [0, 0, 1, 0]);
  assert.deepEqual(ok("f(x) = x^2 - 4x + 3").modelo.poli, [3, -4, 1, 0], "o `f(x) =` da frente não conta");
  assert.equal(ok("f(x) = x^2 - 4x + 3").canonica, "x^2 - 4x + 3");
  assert.deepEqual(ok("y = 2x + 1").modelo.poli, [1, 2, 0, 0]);
  perto(ok("2\\pi x").modelo.poli[1], 2 * Math.PI, "π nos coeficientes");
  perto(ok("\\frac{\\pi}{2}").modelo.poli[0], Math.PI / 2);
  // Seno e cosseno com argumento a·x + b, com número na frente e soma com polinômio.
  const cosseno = ok("2\\cos(\\pi x + 1)");
  assert.equal(cosseno.modelo.atomos[0].tipo, "cosseno");
  assert.equal(cosseno.modelo.atomos[0].coef, 2);
  perto(cosseno.modelo.atomos[0].a, Math.PI);
  assert.equal(cosseno.modelo.atomos[0].b, 1);
  const mista = ok("x + \\sin x");
  assert.deepEqual(mista.modelo.poli, [0, 1, 0, 0]);
  assert.equal(mista.modelo.atomos.length, 1);
  perto(avaliarFuncao(mista.modelo, Math.PI / 2), Math.PI / 2 + 1);
  assert.equal(ok("\\sin 2x").modelo.atomos[0].a, 2, "sin 2x é sin(2x)");
  assert.equal(ok("\\text{sen}(x)").canonica, "\\sin (x)", "o que se guardava como texto (\\text{sen}) vale como a função");
  assert.equal(ok("sen(x)").canonica, "\\sin (x)", "sen em português também vale, e a figura o desenha como sen");
  assert.equal(ok("\\cos x + \\sin x").modelo.atomos.length, 2);
  // A raiz entra no 12a como termo de número × √(a·x + b) (os destaques calculados dela ficam para o 12b).
  const raiz = ok("2\\sqrt{x+1}");
  assert.equal(familiaDaFuncao(raiz.modelo), "raiz");
  assert.equal(avaliarFuncao(raiz.modelo, 3), 4);
  assert.ok(Number.isNaN(avaliarFuncao(raiz.modelo, -2)), "onde o radicando é negativo a curva não existe");
});

test("o que invalida a curva: tangente, log, exponencial, divisão por x, grau acima de 3, outra variável, produto de funções, mais de duas casas", () => {
  for (const [fonte, motivo] of [
    ["\\tan(x)", /tg não vale na curva/],
    ["\\ln(x)", /ln não vale na curva/],
    ["\\log x", /log não vale na curva/],
    ["\\log(x)", /\\log fora da lista|log/],
    ["2^x", /expoente/],
    ["\\frac{1}{x}", /só se divide por um número/],
    ["1/x", /só se divide por um número/],
    ["x^4", /grau acima de 3|expoente/],
    ["x^2 \\cdot x^2", /grau acima de 3/],
    ["x^{-1}", /expoente/],
    ["t^2", /só a variável x/],
    ["y + 1", /só a variável x|igualdade/],
    ["x \\sin x", /só se multiplicam por um número/],
    ["\\sin(x^2)", /a·x \+ b/],
    ["\\sqrt{x^2}", /a·x \+ b/],
    ["\\sin(x)\\cos(x)", /multiplicados entre si/],
    ["3.141x", /duas casas/],
    ["2000x", /acima de 1000/],
    ["\\Delta x", /Δ/],
    ["x = 1", /igualdade|sem igualdade/],
    ["", /1 a 80 caracteres/],
    ["x +", /termina num sinal/],
    ["\\text{abs}(x)", /o texto abs não vale numa função/],
  ]) assert.match(recusada(fonte), motivo, fonte);
  assert.equal(lerExpressaoDaFuncao(42).ok, false);
  assert.equal(lerExpressaoDaFuncao("x".repeat(81)).ok, false, "até 80 caracteres");
});

test("raízes até o grau 2: duas, uma só (discriminante zero), nenhuma; grau 3 e seno o servidor não calcula; vértice só no grau 2", () => {
  assert.deepEqual(raizesDaFuncao(ok("x^2 - 4").modelo), [-2, 2]);
  assert.deepEqual(raizesDaFuncao(ok("x^2 - 2x + 1").modelo), [1], "raiz dupla vira uma só");
  assert.deepEqual(raizesDaFuncao(ok("x^2 + 1").modelo), [], "sem raiz real");
  assert.deepEqual(raizesDaFuncao(ok("-x^2 + 4x").modelo), [0, 4], "da menor para a maior, também com a parábola para baixo");
  assert.equal(raizesDaFuncao(ok("x^3 - x").modelo), null, "grau 3: o servidor não calcula");
  assert.equal(raizesDaFuncao(ok("x^2 + \\sin x").modelo), null);
  assert.deepEqual(raizesDaFuncao(ok("5").modelo), [], "a constante não corta o eixo");
  assert.equal(raizesDaFuncao(ok("0").modelo), null, "a constante zero é o próprio eixo: não há raiz para apontar");
  assert.deepEqual(verticeDaFuncao(ok("-x^2 + 4x").modelo), [2, 4]);
  assert.equal(verticeDaFuncao(ok("x^3").modelo), null);
  assert.deepEqual(interceptoDaFuncao(ok("x^3 - x + 7").modelo), [0, 7], "o intercepto em y vale para qualquer curva");
  assert.equal(interceptoDaFuncao(ok("\\sqrt{x - 1}").modelo), null, "a raiz não existe em 0");
});

test("o domínio e o x com π: números, \"\\pi\", \"2\\pi\", \"\\frac{\\pi}{2}\", \"3π/2\"; e o múltiplo de π/4 do rótulo", () => {
  assert.equal(lerNumeroComPi(3), 3);
  assert.equal(lerNumeroComPi(-0.5), -0.5);
  perto(lerNumeroComPi("\\pi"), Math.PI);
  perto(lerNumeroComPi("2\\pi"), 2 * Math.PI);
  perto(lerNumeroComPi("\\frac{\\pi}{2}"), Math.PI / 2);
  perto(lerNumeroComPi("3π/2"), (3 * Math.PI) / 2);
  perto(lerNumeroComPi("-\\pi"), -Math.PI);
  assert.equal(lerNumeroComPi("x"), null, "x não é número");
  assert.equal(lerNumeroComPi("abc"), null);
  assert.equal(lerNumeroComPi(Number.NaN), null);
  assert.equal(lerNumeroComPi(null), null);
  assert.equal(multiploDePiSobre4(Math.PI / 2), 2, "π/2 = 2 · π/4");
  assert.equal(multiploDePiSobre4((3 * Math.PI) / 2), 6);
  assert.equal(multiploDePiSobre4(0), 0);
  assert.equal(multiploDePiSobre4(Math.PI / 4), 1);
  assert.equal(multiploDePiSobre4(1.5), null, "1,5 não é múltiplo de π/4");
  assert.equal(multiploDePiSobre4(3), null);
});
