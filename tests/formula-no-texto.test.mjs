import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import {
  contemMarcaDeFormula,
  falarTextoComFormulas,
  linearizarTolerante,
  normalizarTextoComFormulas,
  partirTextoComFormulas,
  textoSemFormulas,
} from "@studoo/contratos";

const GOLDEN = new URL("./fixtures/matematica/golden-segmentos.json", import.meta.url);

/** O segmento no formato do golden: o texto como veio, ou `[forma canônica]` para a fórmula. */
const resumo = (segmentos) => segmentos.map((segmento) => (segmento.tipo === "texto" ? segmento.texto : `[${segmento.latex}]`));

const FRASES = [
  // As frases das primeiras telas reais do app (sublinhados crus) e os casos de borda do pedido.
  "x_G = (x_A + x_B + x_C) / 3",
  "x_A = 3, x_B = 5 e x_C",
  "então x_C = 12 − 8 = 4",
  "R$ 5,00 e R$ 10,00",
  "3 · 4 = 3 + 5 + x_C",
  "4",
  "Os vértices A e B têm abscissas 3 e 5. Qual é a do terceiro?",
  // Marcadas.
  "Use $x_G = (x_A + x_B + x_C) / 3$ para achar o ponto.",
  "O valor de $x_C$ é $4$, não R$ 4,00.",
  "Com A(2, 1) e C($k$, 5): $3 · 1 = 2 + (−1) + x_C$, então $x_C = 2$.",
  "($x_A$) e [$y_B$]; “$x^2$”, $b^2 - 4ac$.",
  "$$x_G = 1$$ vale.",
  // Marcadas que não cabem ou não valem: texto linear, sem cifrão nem LaTeX cru.
  "Isso vale $\\frac{x_A + x_B}{2}$ no ponto médio.",
  "A raiz é $\\sqrt{x + 1}$ aqui.",
  "O determinante $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$ vale −2.",
  "Escreva $\\foo{x} + 1$ aqui",
  "Veja $\\alpha + \\beta$ e $\\pi r^2$.",
  // LaTeX solto fora de marca.
  "Calcule \\frac{1}{2} + \\sqrt{9} agora",
  // Cifrão de dinheiro e de código.
  "custa $5 e $10",
  "preço $ 5 e $ 6",
  "US$10 e R$5 e 5$",
  "Ganhou R$ 5,00 e gastou $x$.",
];

test("golden: os segmentos das frases do pedido e dos casos de borda", () => {
  const atual = Object.fromEntries(FRASES.map((frase) => [frase, resumo(partirTextoComFormulas(frase))]));
  if (process.env.ATUALIZAR_GOLDEN === "1" || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(atual, null, 1)}\n`);
    return;
  }
  const esperado = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(Object.keys(atual), Object.keys(esperado));
  for (const frase of Object.keys(esperado)) assert.deepEqual(atual[frase], esperado[frase], `${frase}: os segmentos mudaram (ATUALIZAR_GOLDEN=1 regrava)`);
});

test("sem marcação, os tokens soltos viram índice e expoente (as frases das telas reais)", () => {
  assert.deepEqual(resumo(partirTextoComFormulas("x_G = (x_A + x_B + x_C) / 3")), ["[x_G]", " = (", "[x_A]", " + ", "[x_B]", " + ", "[x_C]", ") / 3"]);
  assert.deepEqual(resumo(partirTextoComFormulas("x_A = 3, x_B = 5 e x_C")), ["[x_A]", " = 3, ", "[x_B]", " = 5 e ", "[x_C]"]);
  assert.deepEqual(resumo(partirTextoComFormulas("então x_C = 12 − 8 = 4")), ["então ", "[x_C]", " = 12 − 8 = 4"]);
  assert.deepEqual(resumo(partirTextoComFormulas("3 · 4 = 3 + 5 + x_C")), ["3 · 4 = 3 + 5 + ", "[x_C]"]);
  assert.deepEqual(resumo(partirTextoComFormulas("b^2 e x^2 e 10^3 e x_10 e x_AB e x_A^2 e y^n")), ["[b^2]", " e ", "[x^2]", " e ", "[10^3]", " e ", "[x_{10}]", " e ", "[x_{A B}]", " e ", "[x_A^2]", " e ", "[y^n]"]);
  // Cada segmento de fórmula traz a árvore, a forma canônica, o texto linear e o falado.
  const [formula] = partirTextoComFormulas("x_G");
  assert.equal(formula.tipo, "formula");
  assert.equal(formula.arvore.tipo, "script");
  assert.equal(formula.latex, "x_G");
  assert.equal(formula.linear, "x_G");
  assert.equal(formula.falado, "x índice G");
});

test("só o inequívoco: palavra, endereço, arquivo, código e frase comum ficam como texto", () => {
  for (const texto of [
    "snake_case e user_name e x_total e x_max", "https://exemplo.com/x_1 e www.site.com/b^2", "arquivo.x_1 e @x_1 e #x_1 e ~/x_1", "f_x(2) e g^2(3)",
    "R$ 5,00 e R$ 10,00", "4", "Os vértices A e B têm abscissas 3 e 5.", "x_1000 e x_ABC e 1234^2 e x^(n+1) e x^-1 e (x+1)^2",
    "Resposta: a_b_c", "e-mail: nome_x@dominio.com",
  ]) {
    assert.deepEqual(resumo(partirTextoComFormulas(texto)), [texto], texto);
  }
  // Sem heurística, nada é reconhecido sem marca.
  assert.deepEqual(resumo(partirTextoComFormulas("x_G = 1", { heuristica: false })), ["x_G = 1"]);
  assert.deepEqual(resumo(partirTextoComFormulas("$x_G$ e x_A", { heuristica: false })), ["[x_G]", " e x_A"]);
});

test("o cifrão do LaTeX marca; o de dinheiro não", () => {
  assert.deepEqual(resumo(partirTextoComFormulas("R$ 5,00 e R$ 10,00")), ["R$ 5,00 e R$ 10,00"]);
  assert.deepEqual(resumo(partirTextoComFormulas("US$10 e R$5 e 5$ e $ 5 e $ 6")), ["US$10 e R$5 e 5$ e $ 5 e $ 6"]);
  assert.deepEqual(resumo(partirTextoComFormulas("custa $5 e $10")), ["custa $5 e $10"], "um `$` colado em número, mas que não fecha direito");
  assert.deepEqual(resumo(partirTextoComFormulas("Ganhou R$ 5,00 e gastou $x$.")), ["Ganhou R$ 5,00 e gastou ", "[x]", "."]);
  assert.deepEqual(resumo(partirTextoComFormulas("O valor de $x_C$ é $4$, não R$ 4,00.")), ["O valor de ", "[x_C]", " é ", "[4]", ", não R$ 4,00."]);
  assert.deepEqual(resumo(partirTextoComFormulas("($x_A$), [$y_B$], “$x^2$”.")), ["(", "[x_A]", "), [", "[y_B]", "], “", "[x^2]", "”."]);
  assert.deepEqual(resumo(partirTextoComFormulas("$$x_G = 1$$ vale")), ["[x_G = 1]", " vale"]);
  // Espaço junto ao cifrão, ou letra colada depois dele, não é marca.
  assert.deepEqual(resumo(partirTextoComFormulas("$ x_G$ e $x_G $ e $x_G$a", { heuristica: false })), ["$ x_G$ e $x_G $ e $x_G$a"]);
  assert.deepEqual(resumo(partirTextoComFormulas("$ x$ e $x $")), ["$ x$ e $x $"]);
  assert.equal(contemMarcaDeFormula("R$ 5,00 e R$ 10,00"), false);
  assert.equal(contemMarcaDeFormula("custa $5 e $10"), false);
  assert.equal(contemMarcaDeFormula("vale $x_G$."), true);
  assert.equal(contemMarcaDeFormula("sem nada"), false);
  // A marca não atravessa linha nem passa de 200 caracteres.
  assert.equal(contemMarcaDeFormula("$x\ny$"), false);
  assert.equal(contemMarcaDeFormula(`$${"x + ".repeat(60)}x$`), false);
});

test("fórmula marcada que não vale ou não cabe em linha nunca derruba o texto: cai em texto linear, sem LaTeX cru", () => {
  const casos = [
    ["Isso vale $\\frac{x_A + x_B}{2}$ no ponto médio.", "Isso vale (x_A + x_B) / 2 no ponto médio."],
    ["A raiz é $\\sqrt{x + 1}$ aqui.", "A raiz é √(x + 1) aqui."],
    ["O determinante $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$ vale −2.", "O determinante det[1, 2; 3, 4] vale −2."],
    ["Escreva $\\foo{x} + 1$ aqui", "Escreva x + 1 aqui"],
    ["Veja $\\alpha + \\beta$ e $\\pi r^2$.", "Veja α + β e πr²."],
    ["Calcule \\frac{1}{2} + \\sqrt{9} agora", "Calcule 1 / 2 + √(9) agora"],
    ["$\\left( x \\right)^{2}$ e $x^{n+1}$", "(x)² e x^(n + 1)"],
  ];
  for (const [entrada, esperado] of casos) {
    const segmentos = partirTextoComFormulas(entrada);
    const texto = segmentos.filter((segmento) => segmento.tipo === "texto").map((segmento) => segmento.texto).join("");
    assert.equal(/[\\{}$]/.test(texto), false, `LaTeX cru ou cifrão sobrou em ${entrada}: ${texto}`);
    assert.equal(textoSemFormulas(entrada), esperado, entrada);
  }
  // O que lê e cabe em linha segue como fórmula, ao lado do que caiu.
  assert.deepEqual(resumo(partirTextoComFormulas("$x_A$ e $\\frac{1}{2}$ e $\\foo{y}$")), ["[x_A]", " e 1 / 2 e y"]);
  // A frase continua inteira, com a pontuação em volta.
  assert.equal(textoSemFormulas("Se $\\frac{a}{b}$, então: $a = 2b$."), "Se a / b, então: a = 2b.");
});

test("textoSemFormulas é o texto para quem não desenha; falarTextoComFormulas, o do leitor de tela", () => {
  assert.equal(textoSemFormulas("Use $x_G = (x_A + x_B + x_C) / 3$ para achar o ponto."), "Use x_G = (x_A + x_B + x_C) ÷ 3 para achar o ponto.");
  assert.equal(textoSemFormulas("O valor de $x_C$ é $4$, não R$ 4,00."), "O valor de x_C é 4, não R$ 4,00.");
  assert.equal(textoSemFormulas("sem matemática nenhuma, só R$ 5,00"), "sem matemática nenhuma, só R$ 5,00");
  assert.equal(textoSemFormulas("x_G = 1"), "x_G = 1", "token solto fica como está (já é legível)");
  assert.equal(falarTextoComFormulas("Então $x_C = 12 − 8 = 4$."), "Então x índice C é igual a 12 menos 8 é igual a 4.");
  assert.equal(falarTextoComFormulas("Com x_A = 3 e $x_B = 5$."), "Com x índice A = 3 e x índice B é igual a 5.");
  assert.equal(falarTextoComFormulas("Só texto, sem fórmula."), "Só texto, sem fórmula.");
});

test("normalizarTextoComFormulas: o texto como o servidor o guarda", () => {
  assert.equal(normalizarTextoComFormulas("Use $x_G=(x_A+x_B)/3$ e $x_{AB}^{2}$"), "Use $x_G = (x_A + x_B) \\div 3$ e $x_{A B}^2$");
  assert.equal(normalizarTextoComFormulas("Use $x_G=(x_A+x_B)/3$ aqui", false), "Use x_G = (x_A + x_B) ÷ 3 aqui");
  assert.equal(normalizarTextoComFormulas("Veja $\\frac{1}{2}$ e $\\foo{x}$ e R$ 5,00"), "Veja 1 / 2 e x e R$ 5,00");
  assert.equal(normalizarTextoComFormulas("x_G = 1 e R$ 5,00"), "x_G = 1 e R$ 5,00", "tokens soltos ficam como a IA escreveu");
  for (const texto of ["Use $x_G=(x_A+x_B)/3$ e $x_{AB}^{2}$", "R$ 5,00 e $x$", "Calcule \\frac{1}{2}", "sem nada", "$\\frac{a}{b}$ e $y_C$"]) {
    const uma = normalizarTextoComFormulas(texto);
    assert.equal(normalizarTextoComFormulas(uma), uma, `não é estável: ${texto}`);
  }
});

test("linearizarTolerante: o que a IA quis dizer, sem barra e sem chave", () => {
  assert.equal(linearizarTolerante("x_G = \\frac{x_A + x_B}{2}"), "x_G = (x_A + x_B) / 2", "o que lê sai pela árvore");
  const casos = [
    ["\\frac{1}{2}", "1 / 2"], ["\\frac{x + 1}{2}", "(x + 1) / 2"], ["\\sqrt{x + 1}", "√(x + 1)"], ["2 \\times 3 \\leq 7", "2 × 3 ≤ 7"],
    ["\\alpha + \\beta", "α + β"], ["x^{2}", "x²"], ["x^{n+1}", "x^(n + 1)"], ["\\text{área} = b \\cdot h", "área = b × h"],
    ["\\left( a + b \\right)", "(a + b)"], ["\\foo{x} + 1", "x + 1"], ["\\resposta{4}", "4"],
  ];
  for (const [entrada, esperado] of casos) {
    const saida = linearizarTolerante(entrada);
    assert.equal(/[\\{}]/.test(saida), false, `${entrada} → ${saida}`);
    assert.equal(saida.replace(/\s+/g, " "), esperado.replace(/\s+/g, " "), entrada);
  }
  // O que lê sai pela árvore.
  assert.equal(linearizarTolerante("x_C = 12 - 8"), "x_C = 12 − 8");
});

test("nunca lança, nunca deixa texto vazio, e a fórmula de cada segmento é a que o texto tinha", () => {
  let semente = 987654;
  const proximo = () => {
    semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
    return semente;
  };
  const pedacos = ["$", "$$", "x_A", "b^2", " ", "R$ 5", "\\frac{1}{2}", "\\", "{", "}", "x", "_", "^", "é", "\n", "4", "=", "+", ",", ".", "(", ")", "\u000c"];
  for (let i = 0; i < 2000; i += 1) {
    let texto = "";
    for (let j = proximo() % 12; j >= 0; j -= 1) texto += pedacos[proximo() % pedacos.length];
    let segmentos;
    assert.doesNotThrow(() => { segmentos = partirTextoComFormulas(texto); }, JSON.stringify(texto));
    assert.equal(segmentos.every((segmento) => segmento.tipo !== "texto" || segmento.texto.length > 0), true, JSON.stringify(texto));
    assert.equal(segmentos.some((segmento, k) => segmento.tipo === "texto" && segmentos[k + 1]?.tipo === "texto"), false, "textos vizinhos se juntam");
    assert.doesNotThrow(() => { textoSemFormulas(texto); falarTextoComFormulas(texto); normalizarTextoComFormulas(texto); contemMarcaDeFormula(texto); }, JSON.stringify(texto));
  }
  assert.deepEqual(partirTextoComFormulas(""), []);
  assert.deepEqual(partirTextoComFormulas(undefined), []);
  assert.deepEqual(partirTextoComFormulas(42), []);
});

test("a fórmula em linha vira uma caixa do tamanho do texto, com a linha de base para alinhar com as palavras", async () => {
  const { desenharFormulaEmLinha, lerFormula, PISO_DO_TEXTO, caminhoValido } = await import("@studoo/contratos");
  const [formula] = partirTextoComFormulas("x_G");
  for (const tamanho of [16, 17]) {
    const caixa = desenharFormulaEmLinha(formula.arvore, tamanho);
    assert.ok(caixa.largura > 0 && caixa.altura >= tamanho * 0.9 && caixa.altura <= tamanho * 1.6, `${tamanho}: altura ${caixa.altura}`);
    assert.ok(caixa.linhaDeBase > 0 && caixa.linhaDeBase < caixa.altura, "a linha de base fica dentro da caixa");
    assert.ok(caixa.menorTexto >= PISO_DO_TEXTO);
    assert.equal(caixa.falado, "x índice G");
    assert.ok(caixa.primitivas.length >= 1 && caixa.primitivas.every((primitiva) => primitiva.tipo !== "caminho" || caminhoValido(primitiva.d)));
    // Tudo dentro da caixa.
    for (const primitiva of caixa.primitivas.filter((candidata) => candidata.tipo === "caminho")) {
      const numeros = primitiva.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const xs = numeros.filter((_, i) => i % 2 === 0);
      const ys = numeros.filter((_, i) => i % 2 === 1);
      assert.ok(Math.min(...xs) >= -0.5 && Math.max(...xs) <= caixa.largura + 0.5 && Math.min(...ys) >= -0.5 && Math.max(...ys) <= caixa.altura + 0.5, `${tamanho}: fora da caixa`);
    }
  }
  const maior = desenharFormulaEmLinha(lerFormula("x_A^2 + 3").arvore, 16);
  assert.ok(maior.largura > desenharFormulaEmLinha(lerFormula("x").arvore, 16).largura);
  assert.equal(desenharFormulaEmLinha(lerFormula("x").arvore, 17).largura > desenharFormulaEmLinha(lerFormula("x").arvore, 16).largura, true, "escala com o texto");
});
