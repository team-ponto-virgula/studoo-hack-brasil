import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conferirConta,
  ehSinal,
  falarFormula,
  formulaCabeEmLinha,
  formulaCanonica,
  formulaLinear,
  lerFormula,
  repararBarrasDoJson,
  repararComandosDeControle,
} from "@studoo/contratos";

const ok = (fonte) => {
  const lida = lerFormula(fonte);
  assert.equal(lida.ok, true, `${JSON.stringify(fonte)} devia ler: ${lida.erro}`);
  return lida;
};
const falha = (fonte) => {
  const lida = lerFormula(fonte);
  assert.equal(lida.ok, false, `${JSON.stringify(fonte)} devia ser recusada`);
  return lida.erro;
};

const DA_FOLHA = [
  String.raw`x_G = \frac{x_A + x_B + x_C}{3}`,
  String.raw`1 = \frac{1 + (-2) + x_C}{3}`,
  String.raw`3 \cdot 1 = 1 + (-2) + x_C`,
  String.raw`3 = -1 + x_C`,
  String.raw`3 + 1 = x_C`,
  String.raw`x_C = 4`,
  String.raw`y_G = \frac{y_A + y_B + y_C}{3}`,
  String.raw`C = (4, 0)`,
  String.raw`A = (-1, -1) ; B = (2, 5) ; C = (k, 1)`,
  String.raw`\begin{vmatrix} -1 & -1 & 1 \\ 2 & 5 & 1 \\ k & 1 & 1 \end{vmatrix} = 0`,
  String.raw`-1 \cdot 5 \cdot 1 = -5`,
  String.raw`(-5) + (-k) + 2 - 5k - (-1) - (-2) = 0`,
  String.raw`-k - 5k = -6k`,
  String.raw`k = \frac{0}{-6} = 0`,
  String.raw`\begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}`,
  String.raw`\foco{x_C} = \resposta{4}`,
  String.raw`x^2 + y_A^{n + 1} \leq \sqrt{x + 1}`,
  String.raw`\text{área} = \frac{1}{2} \times \text{base} \times h`,
];

test("as fórmulas da folha leem, e a forma canônica é estável (ler de novo dá a mesma árvore)", () => {
  for (const fonte of DA_FOLHA) {
    const lida = ok(fonte);
    const outra = ok(lida.canonica);
    assert.equal(outra.canonica, lida.canonica, `canônica instável: ${fonte}`);
    assert.deepEqual(outra.arvore, lida.arvore, `árvore diferente ao reler: ${fonte}`);
    assert.equal(formulaCanonica(lida.arvore), lida.canonica);
  }
});

test("a forma canônica junta os apelidos num operador só", () => {
  assert.equal(ok(String.raw`3 \cdot 4`).canonica, String.raw`3 \times 4`);
  assert.equal(ok("3 * 4 / 2").canonica, String.raw`3 \times 4 \div 2`);
  assert.equal(ok("3 × 4 ÷ 2 − 1").canonica, String.raw`3 \times 4 \div 2 - 1`);
  assert.equal(ok("a <= b").canonica, String.raw`a \leq b`);
  assert.equal(ok("a >= b").canonica, String.raw`a \geq b`);
  assert.equal(ok("a != b").canonica, String.raw`a \neq b`);
  assert.equal(ok("a -> b").canonica, String.raw`a \to b`);
  assert.equal(ok("a ≤ b ≥ c ≠ d → e").canonica, String.raw`a \leq b \geq c \neq d \to e`);
  assert.equal(ok(String.raw`\left( x + 1 \right)^2`).canonica, "(x + 1)^2");
  assert.equal(ok("x²").canonica, "x^2");
  assert.equal(ok(String.raw`x_{A}`).canonica, "x_A");
  assert.equal(ok(String.raw`x_{A B}^{2}`).canonica, String.raw`x_{A B}^2`);
  assert.equal(ok("a b c").canonica, "a b c", "três letras separadas não viram uma palavra solta");
  assert.equal(ok("xy").canonica, "x y");
  assert.equal(ok(String.raw`{x}`).canonica, "x");
  // Os espaços de LaTeX ficam (são desenhados como vão, marco 10); `\ ` vale `\;`.
  assert.equal(ok(String.raw`x\,+\;y\ z`).canonica, String.raw`x \, + \; y \; z`);
});

test("texto linear: o que um cliente que não desenha mostra", () => {
  assert.equal(formulaLinear(ok(DA_FOLHA[0]).arvore), "x_G = (x_A + x_B + x_C) ÷ 3", "fração composta: (…) ÷ 3, sem barra que se confunda com endereço");
  assert.equal(formulaLinear(ok(DA_FOLHA[1]).arvore), "1 = (1 + (−2) + x_C) ÷ 3");
  assert.equal(formulaLinear(ok(String.raw`x_C = 3 \times 4 - 3 - 5`).arvore), "x_C = 3 × 4 − 3 − 5");
  assert.equal(formulaLinear(ok(String.raw`3.5 \div 2 \geq -1.25`).arvore), "3,5 ÷ 2 ≥ −1,25");
  assert.equal(formulaLinear(ok(String.raw`x^2 + y^{n+1}`).arvore), "x² + y^(n + 1)");
  assert.equal(formulaLinear(ok(String.raw`\sqrt{x + 1} + \sqrt{9}`).arvore), "√(x + 1) + √9");
  assert.equal(formulaLinear(ok(String.raw`\frac{1}{2}`).arvore), "1/2", "fração de dois termos simples: a/b");
  assert.equal(formulaLinear(ok(String.raw`\frac{x_A}{2}`).arvore), "x_A/2");
  assert.equal(formulaLinear(ok(String.raw`\frac{-b}{2a}`).arvore), "(−b) ÷ (2a)");
  assert.equal(formulaLinear(ok(DA_FOLHA[9]).arvore), "det[−1, −1, 1; 2, 5, 1; k, 1, 1] = 0");
  assert.equal(formulaLinear(ok(DA_FOLHA[14]).arvore), "[1, 2; 3, 4]");
  assert.equal(formulaLinear(ok(String.raw`\foco{x_C} = \resposta{4}`).arvore), "x_C = 4");
  assert.equal(formulaLinear(ok(String.raw`C = (4, 0)`).arvore), "C = (4, 0)");
  assert.equal(formulaLinear(ok(String.raw`50\%`).arvore), "50%");
});

test("texto falado sai da árvore (spec 15, seção 1)", () => {
  // O exemplo da spec, palavra por palavra.
  assert.equal(falarFormula(ok(String.raw`x_C = 3 \times 4 - 3 - 5`).arvore), "x índice C é igual a 3 vezes 4, menos 3, menos 5");
  assert.equal(
    falarFormula(ok(String.raw`x_G = \frac{x_A + x_B + x_C}{3}`).arvore),
    "x índice G é igual a fração: numerador x índice A, mais x índice B, mais x índice C, denominador 3",
  );
  // A fração do exemplo da spec, com o número negativo falado sem parênteses.
  assert.equal(
    falarFormula(ok(String.raw`\frac{1 + (-2) + x_C}{3}`).arvore),
    "fração: numerador 1, mais menos 2, mais x índice C, denominador 3",
  );
  assert.equal(falarFormula(ok(String.raw`x^2 + y^3 + z^n`).arvore), "x ao quadrado, mais y ao cubo, mais z elevado a n");
  assert.equal(falarFormula(ok(String.raw`2(x + 1)`).arvore), "2 abre parênteses x mais 1 fecha parênteses");
  assert.equal(falarFormula(ok(String.raw`\sqrt{x}`).arvore), "raiz quadrada de x");
  assert.equal(falarFormula(ok(String.raw`\sqrt{x + 1}`).arvore), "raiz quadrada de x mais 1, fim da raiz");
  assert.equal(falarFormula(ok(String.raw`a \neq b`).arvore), "a é diferente de b");
  assert.equal(falarFormula(ok(String.raw`a \leq b`).arvore), "a é menor ou igual a b");
  assert.equal(falarFormula(ok(String.raw`3,5`).arvore), "3, 5");
  assert.equal(falarFormula(ok(String.raw`3.5 + 0.25`).arvore), "3,5 mais 0,25");
  assert.equal(falarFormula(ok(String.raw`k = \resposta{2}`).arvore), "k é igual a 2");
  assert.equal(falarFormula(ok(String.raw`C = (4, 0)`).arvore), "C é igual a abre parênteses 4, 0 fecha parênteses");
  assert.equal(
    falarFormula(ok(String.raw`\begin{vmatrix} -1 & 1 \\ k & 1 \end{vmatrix} = 0`).arvore),
    "determinante de ordem 2: linha 1: menos 1, 1; linha 2: k, 1 é igual a 0",
  );
  assert.equal(
    falarFormula(ok(String.raw`\begin{bmatrix} 1 & 2 \end{bmatrix}`).arvore),
    "matriz de 1 linha e 2 colunas: linha 1: 1, 2",
  );
  assert.equal(falarFormula(ok(String.raw`50\%`).arvore), "50 por cento");
});

test("só o que está na lista entra: o resto invalida a fórmula (que cai para o texto linear)", () => {
  for (const fonte of [
    String.raw`\input{arquivo}`,
    String.raw`\href{http://x}{y}`,
    String.raw`\write18{ls}`,
    String.raw`\begin{align} x \end{align}`,
    String.raw`\begin{array}{c} x \end{array}`,
    String.raw`\sqrt[3]{8}`,
    String.raw`|x|`,
    String.raw`\alpha + \beta`,
    String.raw`\pm 1`,
    String.raw`\overline{AB}`,
    String.raw`\sum_{i=1}^{n} i`,
    String.raw`\left[ x \right]`,
    String.raw`\left( x`,
    String.raw`x \right)`,
    String.raw`\text{a_b}`,
    String.raw`\text{a\b}`,
    String.raw`\text{}`,
    String.raw`\text{sem fechar`,
    String.raw`\foco x`,
    "sin x",
    "log x",
    String.raw`x^23`,
    String.raw`x_10`,
    String.raw`x^-1`,
    String.raw`^2`,
    String.raw`3 + ^2`,
    String.raw`x^2^3`,
    String.raw`x_a_b`,
    String.raw`\frac{1}{`,
    String.raw`\frac{}{2}`,
    String.raw`\frac{1}`,
    "{x",
    "x}",
    ")",
    "()",
    "{}",
    "3.",
    "3..5",
    "x $ y",
    "x # y",
    "x & y",
    String.raw`x \\ y`,
    "x ~ y",
    "'",
    "<script>alert(1)</script>",
    "",
    "   ",
  ]) {
    falha(fonte);
  }
  for (const entrada of [undefined, null, 4, {}, [], true]) assert.equal(lerFormula(entrada).ok, false);
});

test("limites: tamanho, profundidade, matriz e destaques", () => {
  falha(`1${" + 1".repeat(80)}`); // 301 caracteres
  ok(`1${" + 1".repeat(70)}`);
  falha(String.raw`\frac{\frac{\frac{\frac{\frac{\frac{\frac{1}{2}}{2}}{2}}{2}}{2}}{2}}{2}`);
  ok(String.raw`\frac{\frac{\frac{1}{2}}{2}}{2}`);
  falha(String.raw`\begin{bmatrix} 1 & 2 & 3 & 4 & 5 \end{bmatrix}`);
  falha(String.raw`\begin{bmatrix} 1 \\ 2 \\ 3 \\ 4 \\ 5 \end{bmatrix}`);
  ok(String.raw`\begin{bmatrix} 1 & 2 & 3 & 4 \\ 1 & 2 & 3 & 4 \\ 1 & 2 & 3 & 4 \\ 1 & 2 & 3 & 4 \end{bmatrix}`);
  falha(String.raw`\begin{bmatrix} 1 & 2 \\ 3 \end{bmatrix}`);
  falha(String.raw`\begin{bmatrix} 1 & & 2 \end{bmatrix}`);
  falha(String.raw`\begin{vmatrix} 1 & 2 & 3 \\ 4 & 5 & 6 \end{vmatrix}`);
  falha(String.raw`\begin{vmatrix} 1 \end{vmatrix}`);
  falha(String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}`);
  falha(String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} \begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} \begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix}`);
  ok(String.raw`\foco{a} + \procurado{b}`);
  falha(String.raw`\foco{a} + \procurado{b} + \resposta{c}`);
  falha(String.raw`\foco{a + \procurado{b}}`);
  falha("1".repeat(13));
  ok("1".repeat(12));
});

test("o JSON come a barra: avanço de página, tabulação, quebra de linha, retorno de carro e backspace voltam a ser comandos", () => {
  // O que um JSON.parse devolve quando o modelo escreve a barra uma vez só dentro do texto (\\f, \\t, \\n, \\r e \\b são escapes válidos).
  const comido = (texto) => JSON.parse(`"${texto}"`);
  assert.equal(comido("\\frac{1}{2}").charCodeAt(0), 12);
  assert.equal(ok(comido("\\frac{1}{2}")).canonica, String.raw`\frac{1}{2}`);
  assert.equal(ok(comido("3 \\times 4")).canonica, String.raw`3 \times 4`);
  assert.equal(ok(comido("1 \\neq 2")).canonica, String.raw`1 \neq 2`);
  assert.equal(ok(comido("\\foco{x} = \\resposta{4}")).canonica, String.raw`\foco{x} = \resposta{4}`);
  // `\begin` vira backspace + `egin`; o `\\` das linhas vira uma barra só (que numa matriz volta a separar as linhas).
  assert.equal(ok(`${String.fromCharCode(8)}egin{vmatrix} 1 & 2 \\ 3 & 4 \\end{vmatrix}`).arvore.linhas.length, 2);
  // `\left( x \right)` não parseia como JSON (\l); com o retorno de carro de `\r` o comando também volta.
  assert.equal(ok(`\\left( x ${String.fromCharCode(13)}ight)`).canonica, "(x)");
  // Um comando que não é da lista continua recusado, com ou sem barra comida.
  assert.equal(lerFormula(comido("\\tabela")).ok, false);
});

test("reparar comandos de controle só age quando o resto forma um comando da lista", () => {
  assert.equal(repararComandosDeControle("\u000crac{1}{2}"), String.raw`\frac{1}{2}`);
  assert.equal(repararComandosDeControle("\u000coco{x}"), String.raw`\foco{x}`);
  assert.equal(repararComandosDeControle("3 \times 4"), String.raw`3 \times 4`);
  assert.equal(repararComandosDeControle("\text{cm}"), String.raw`\text{cm}`);
  assert.equal(repararComandosDeControle("a\to b"), String.raw`a\to b`);
  assert.equal(repararComandosDeControle("\tabela"), "\tabela", "tab + abela não é comando");
  assert.equal(repararComandosDeControle("a\teq b"), "a\teq b", "tab + eq não é comando de tab");
  assert.equal(repararComandosDeControle("a\neq b"), String.raw`a\neq b`);
  assert.equal(repararComandosDeControle("a\nequivale"), "a\nequivale", "quebra de linha de verdade seguida de palavra");
  assert.equal(repararComandosDeControle("\\left( x \right)"), "\\left( x \\right)");
  assert.equal(repararComandosDeControle("\resposta{4}"), String.raw`\resposta{4}`);
  assert.equal(repararComandosDeControle("\bbegin{vmatrix}"), "\bbegin{vmatrix}");
  assert.equal(repararComandosDeControle("\u0008egin{vmatrix}"), String.raw`\begin{vmatrix}`);
  assert.equal(repararComandosDeControle("x\t+\ny"), "x\t+\ny", "tab e quebra de linha comuns ficam");
  assert.equal(repararComandosDeControle("sem controle"), "sem controle");
});

test("repararBarrasDoJson: o texto do modelo vira JSON válido sem estragar o texto comum", () => {
  const cru = String.raw`{"formula":"x_G = \frac{x_A + \left( x_B \right)}{3} \times 2 \div 4 \neq 5 \leq 6 \sqrt{2}","foco":"\foco{x} \procurado{k} \resposta{4}","m":"\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \end{vmatrix}","t":"\text{cm}","comum":"linha\nequivale, aspas \" e barra \\ e é e \/ e \t tab"}`;
  assert.throws(() => JSON.parse(cru), "o JSON cru não parseia (\\l, \\d, \\s...)");
  const reparado = JSON.parse(repararBarrasDoJson(cru));
  assert.equal(reparado.formula, String.raw`x_G = \frac{x_A + \left( x_B \right)}{3} \times 2 \div 4 \neq 5 \leq 6 \sqrt{2}`);
  assert.equal(reparado.foco, String.raw`\foco{x} \procurado{k} \resposta{4}`);
  assert.equal(reparado.m, String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix}`);
  assert.equal(reparado.t, String.raw`\text{cm}`);
  assert.equal(reparado.comum, "linha\nequivale, aspas \" e barra \\ e é e / e \t tab");
  assert.equal(ok(reparado.formula.replace("\\left( x_B \\right)", "(x_B)").replace("\\sqrt{2}", "2")).ok, true);
  // JSON que já estava certo não muda.
  const certo = JSON.stringify({ a: String.raw`\frac{1}{2}`, b: "linha\nnova", c: "é" });
  assert.equal(repararBarrasDoJson(certo), certo);
  // Fora de texto (chaves, números) nada muda, e uma barra no fim é dobrada em vez de quebrar.
  assert.equal(repararBarrasDoJson('{"a":1}'), '{"a":1}');
  assert.doesNotThrow(() => repararBarrasDoJson('{"a":"x\\'));
});

test("a IA que escreve `\\\\` uma vez só dentro de uma matriz não funde as linhas", () => {
  // JSON "\\" vira uma barra só; numa matriz ela volta a ser o separador de linhas.
  const lida = ok("\\begin{vmatrix} 1 & 2 \\ 3 & 4 \\end{vmatrix}");
  assert.equal(lida.arvore.linhas.length, 2);
  // Fora da matriz, `\\frac` (barra dobrada demais) vale como `\frac`.
  assert.equal(ok("\\\\frac{1}{2}").canonica, String.raw`\frac{1}{2}`);
});

test("cifrões e parênteses de LaTeX em volta da fórmula são tirados", () => {
  assert.equal(ok("$x_G = 1$").canonica, "x_G = 1");
  assert.equal(ok("$$x_G = 1$$").canonica, "x_G = 1");
  assert.equal(ok(String.raw`\( x_G = 1 \)`).canonica, "x_G = 1");
  assert.equal(ok(String.raw`\[ x_G = 1 \]`).canonica, "x_G = 1");
  falha("$x_G = 1");
});

test("cabe em linha só o simples; ehSinal separa sinal de operador", () => {
  assert.equal(formulaCabeEmLinha(ok("x_A + 2y^2 = 3").arvore), true);
  assert.equal(formulaCabeEmLinha(ok(String.raw`\frac{1}{2}`).arvore), true, "a fração de dois termos simples cabe: vai como a/b");
  assert.equal(formulaCabeEmLinha(ok(String.raw`\frac{x_A}{2} + \frac{-1}{3}`).arvore), true);
  assert.equal(formulaCabeEmLinha(ok(String.raw`\frac{x_A + x_B}{2}`).arvore), false, "fração composta vai em bloco");
  assert.equal(formulaCabeEmLinha(ok(String.raw`\frac{1}{2x}`).arvore), false);
  assert.equal(formulaCabeEmLinha(ok(String.raw`\sqrt{2} + 1`).arvore), false);
  assert.equal(formulaCabeEmLinha(ok(DA_FOLHA[9]).arvore), false);
  assert.equal(formulaCabeEmLinha(ok(String.raw`\foco{x_C} = 4`).arvore), true);
  const { arvore } = ok("-2 + 3 - -4");
  const sinais = arvore.itens.map((_, posicao) => ehSinal(arvore.itens, posicao));
  assert.deepEqual(sinais, [true, false, false, false, false, true, false]);
});

test("nunca lança, com qualquer texto", () => {
  let semente = 12345;
  const proximo = () => {
    semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
    return semente;
  };
  const pedacos = ["\\frac", "{", "}", "(", ")", "x", "_", "^", "1", "2.5", "+", "-", "=", "\\begin{vmatrix}", "\\end{vmatrix}", "&", "\\\\", "\\foco", "\\left", "\\right", "\\sqrt", "\\text{a}", " ", "$", "\u000c", "\t", "é", "√", "\\"];
  for (let i = 0; i < 3000; i += 1) {
    let fonte = "";
    for (let j = proximo() % 14; j >= 0; j -= 1) fonte += pedacos[proximo() % pedacos.length];
    assert.doesNotThrow(() => lerFormula(fonte), fonte);
  }
});

/* ----- Conferência da conta ----- */

const arvores = (formulas) => formulas.map((formula) => ok(formula).arvore);

test("conferência da conta: as contas certas da folha passam", () => {
  const baricentro = conferirConta(arvores([
    String.raw`x_G = \frac{x_A + x_B + x_C}{3}`,
    String.raw`1 = \frac{2 + (-1) + x_C}{3}`,
    String.raw`3 = 2 + (-1) + x_C`,
    String.raw`x_C = 3 - 2 + 1`,
    String.raw`C = (2, 0)`,
  ]));
  assert.equal(baricentro.ok, true);
  assert.deepEqual(baricentro.declaradas, { x_C: "2", y_C: "0" });
  assert.equal(baricentro.conferidas, 3);

  const colinearidade = conferirConta(arvores([
    String.raw`\begin{vmatrix} -1 & -1 & 1 \\ 2 & 5 & 1 \\ k & 1 & 1 \end{vmatrix} = -6k`,
    String.raw`(-5) + (-k) + 2 - 5k - (-1) - (-2) = 0`,
    String.raw`-k - 5k = -6k`,
    String.raw`k = 0`,
  ]));
  assert.equal(colinearidade.ok, true);
  assert.equal(colinearidade.conferidas, 4);
});

test("conferência da conta: conta errada, valor contraditório e desigualdade falsa reprovam", () => {
  assert.equal(conferirConta(arvores([String.raw`3 \times 4 - 3 - 5 = 4`])).ok, true);
  assert.equal(conferirConta(arvores([String.raw`3 \times 4 - 3 - 5 = 5`])).ok, false);
  assert.equal(conferirConta(arvores([String.raw`x_C = 2`, String.raw`x_C = 3`])).ok, false);
  assert.equal(conferirConta(arvores([String.raw`4 = \frac{3 + 5 + x_C}{3}`, String.raw`x_C = 5`])).ok, false);
  assert.equal(conferirConta(arvores([String.raw`2x + 1 < 7`, String.raw`x = 2`])).ok, true);
  assert.equal(conferirConta(arvores([String.raw`2x + 1 > 7`, String.raw`x = 2`])).ok, false);
  assert.equal(conferirConta(arvores([String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} = -2`])).ok, true);
  assert.equal(conferirConta(arvores([String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} = 2`])).ok, false);
  const errada = conferirConta(arvores([String.raw`3 \times 4 - 3 - 5 = 5`]));
  assert.match(errada.motivo, /4 = 5 é falso/);
});

test("conferência da conta: o que não dá para avaliar é pulado, não reprovado", () => {
  const pulada = conferirConta(arvores([
    String.raw`x_G = \frac{x_A + x_B + x_C}{3}`,
    String.raw`\text{área} = \frac{1}{2} \times b \times h`,
    String.raw`\sqrt{2} = 1.41`,
    String.raw`1 \div 0 = 5`,
    String.raw`y = (1, 2)`,
  ]));
  assert.equal(pulada.ok, true);
  assert.equal(pulada.conferidas, 0);
  // Racionais exatos: 1/2 + 1/3 = 5/6 e 0,1 + 0,2 = 0,3 sem erro de ponto flutuante.
  assert.equal(conferirConta(arvores([String.raw`\frac{1}{2} + \frac{1}{3} = \frac{5}{6}`, String.raw`0.1 + 0.2 = 0.3`, String.raw`\sqrt{16} = 4`, String.raw`2^3 = 8`, String.raw`2^{-1} = 0.5`])).conferidas, 5);
  // Número grande demais para inteiro seguro: pula em vez de errar.
  assert.equal(conferirConta(arvores(["999999999999 \\times 999999999999 = 1"])).ok, true);
  // Dois números seguidos não são uma conta.
  assert.equal(conferirConta(arvores(["2 3 = 6"])).conferidas, 0);
});

/* ----- Parecer do Designer e adendo 3: grego, pares com decimal, falado ----- */

test("Δ e π entram (os outros gregos continuam recusados e caem no texto linear)", () => {
  assert.equal(ok(String.raw`\pi r^2`).canonica, String.raw`\pi r^2`);
  assert.equal(ok("π r²").canonica, String.raw`\pi r^2`);
  assert.equal(ok(String.raw`\Delta = b^2 - 4ac`).canonica, String.raw`\Delta = b^2 - 4a c`);
  assert.equal(ok(String.raw`\pi\,r`).canonica, String.raw`\pi \, r`, "\\pi r não vira \\pir (e o espaço fino fica)");
  assert.equal(ok(String.raw`2\pi r`).canonica, String.raw`2\pi r`);
  assert.equal(ok(String.raw`(\pi)`).canonica, String.raw`(\pi)`);
  for (const fonte of [String.raw`\pi r^2`, String.raw`\Delta = \sqrt{b^2 - 4ac}`, String.raw`x_{\pi} + \Delta^2`, String.raw`\frac{\pi}{2}`, String.raw`2\pi`]) {
    const lida = ok(fonte);
    assert.deepEqual(ok(lida.canonica).arvore, lida.arvore, `canônica instável: ${fonte}`);
  }
  assert.equal(formulaLinear(ok(String.raw`\pi r^2`).arvore), "πr²");
  assert.equal(formulaLinear(ok(String.raw`\Delta = b^2 - 4ac`).arvore), "Δ = b² − 4ac");
  assert.equal(falarFormula(ok(String.raw`\pi r^2`).arvore), "pi r ao quadrado");
  assert.equal(falarFormula(ok(String.raw`\Delta = 0`).arvore), "delta é igual a 0");
  assert.equal(formulaCabeEmLinha(ok(String.raw`\pi r^2`).arvore), true);
  for (const fonte of [String.raw`\alpha`, String.raw`\beta + 1`, String.raw`\theta`, String.raw`\lambda`, String.raw`\mu`, String.raw`\sigma`, String.raw`\omega`, String.raw`\phi`, String.raw`\pir`, "α", "θ", "Σ"]) falha(fonte);
});

test("Δ conta como incógnita; π é número que não cabe em racional e a conta pula", () => {
  assert.equal(conferirConta(arvores([String.raw`\Delta = 5^2 - 4 \times 1 \times 6`, String.raw`\Delta = 1`])).ok, true);
  assert.equal(conferirConta(arvores([String.raw`\Delta = 5^2 - 4 \times 1 \times 6`, String.raw`\Delta = 2`])).ok, false);
  const comPi = conferirConta(arvores([String.raw`A = \pi r^2`, String.raw`r = 2`]));
  assert.equal(comPi.ok, true);
  assert.equal(comPi.conferidas, 1, "só o `r = 2`; a conta com π é pulada");
});

test("par com decimal usa ponto e vírgula: (1,5; 2); com inteiros continua (1, 2)", () => {
  const decimal = ok(String.raw`A = (1.5, 2)`);
  assert.equal(decimal.canonica, "A = (1.5; 2)");
  assert.equal(formulaLinear(decimal.arvore), "A = (1,5; 2)");
  assert.equal(falarFormula(decimal.arvore), "A é igual a abre parênteses 1,5; 2 fecha parênteses");
  assert.equal(ok(decimal.canonica).canonica, decimal.canonica, "estável");
  assert.equal(formulaLinear(ok(String.raw`(-0.5, 2, 3)`).arvore), "(−0,5; 2; 3)");
  assert.equal(formulaLinear(ok(String.raw`(1, 2.5 + x)`).arvore), "(1; 2,5 + x)");
  assert.equal(formulaLinear(ok(String.raw`A = (1, 2)`).arvore), "A = (1, 2)");
  assert.equal(formulaLinear(ok(String.raw`f(x) = 2.5, g(x) = 1`).arvore), "f(x) = 2,5, g(x) = 1", "vírgula fora de par não muda");
});

test("falado: '→' é 'então'; fração simples é 'sobre'; 'fim da fração' quando vem algo depois", () => {
  assert.equal(falarFormula(ok(String.raw`a \to b`).arvore), "a então b");
  assert.equal(falarFormula(ok(String.raw`\frac{1}{3}`).arvore), "1 sobre 3");
  assert.equal(falarFormula(ok(String.raw`\frac{x}{2}`).arvore), "x sobre 2");
  assert.equal(falarFormula(ok(String.raw`\frac{x_A}{x_B}`).arvore), "x índice A sobre x índice B");
  assert.equal(falarFormula(ok(String.raw`\frac{-1}{2}`).arvore), "menos 1 sobre 2");
  assert.equal(falarFormula(ok(String.raw`\frac{a}{b} + c`).arvore), "a sobre b mais c");
  assert.equal(falarFormula(ok(String.raw`\frac{x + 1}{2}`).arvore), "fração: numerador x mais 1, denominador 2");
  assert.equal(falarFormula(ok(String.raw`\frac{x + 1}{2} + c`).arvore), "fração: numerador x mais 1, denominador 2, fim da fração mais c");
  assert.equal(falarFormula(ok(String.raw`\foco{\frac{x + 1}{2}} = 4`).arvore), "fração: numerador x mais 1, denominador 2, fim da fração é igual a 4");
  assert.equal(falarFormula(ok(String.raw`x = \frac{x + 1}{2}`).arvore), "x é igual a fração: numerador x mais 1, denominador 2", "sem nada depois, sem 'fim da fração'");
  assert.equal(falarFormula(ok(String.raw`\frac{x_{A B}}{2}`).arvore), "fração: numerador x índice A B, denominador 2");
});
