import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import {
  contemCifraoDeLatex,
  contemFormulaMarcada,
  contemMarcaDeFormula,
  falarFormula,
  falarTextoComFormulas,
  formulaCabeNaLinha,
  lerFormula,
  larguraDoTexto,
  linearizarTolerante,
  marcarFormulasSoltas,
  normalizarTextoComFormulas,
  partirTextoComFormulas,
  textoSemFormulas,
  tirarCifraoSolto,
} from "@studoo/contratos";
import { caixaDaFormula, caixaDaFormulaEmLinha } from "../packages/contratos/src/motor-formula.ts";

const GOLDEN = new URL("./fixtures/matematica/golden-segmentos.json", import.meta.url);

/** O segmento no formato do golden: o texto como veio, ou `[forma canônica]` para a fórmula. */
const resumo = (segmentos) => segmentos.map((segmento) => (segmento.tipo === "texto" ? segmento.texto : `[${segmento.latex}]`));

/** Como o cliente lê o texto de uma lição de matemática: o servidor marca os tokens soltos (`marcarFormulasSoltas`) e o cliente parte. */
const lido = (texto) => partirTextoComFormulas(marcarFormulasSoltas(texto));

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
  // Marcadas que não cabem em linha: peças (variáveis e índices desenhados, o resto em texto); que não valem: texto linear.
  "Isso vale $\\frac{x_A + x_B}{2}$ no ponto médio.",
  "A raiz é $\\sqrt{x + 1}$ aqui e $\\sqrt{x_A + 1}$ ali.",
  "O determinante $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$ vale −2.",
  // A fração simples vai desenhada "a/b" e se fala "1 sobre 2"; as outras barras continuam ÷.
  "Metade: $1/2$ da pizza, ou $\\frac{1}{2}$, ou $x_A/2$, ou $x = 1/2$.",
  "Mas $(x_A + x_B)/2$, $2x/3$, $6 \\div 3$ e $a/b/c$ ficam com ÷.",
  "Se $\\frac{x_A + x_B + x_C}{3} = \\frac{3 + 5 + 4}{3}$, então $x_G = 4$.",
  // Fórmula química em lição de matemática: sem sublinhado.
  "A água é H_2O e o gás é CO_2.",
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
  const atual = Object.fromEntries(FRASES.map((frase) => [frase, resumo(lido(frase))]));
  if (process.env.ATUALIZAR_GOLDEN === "1" || !existsSync(GOLDEN)) {
    writeFileSync(GOLDEN, `${JSON.stringify(atual, null, 1)}\n`);
    return;
  }
  const esperado = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(Object.keys(atual), Object.keys(esperado));
  for (const frase of Object.keys(esperado)) assert.deepEqual(atual[frase], esperado[frase], `${frase}: os segmentos mudaram (ATUALIZAR_GOLDEN=1 regrava)`);
});

test("sem marcação, os tokens soltos viram índice e expoente quando a lição é de matemática (as frases das telas reais)", () => {
  const solto = (texto) => partirTextoComFormulas(texto, { heuristica: true });
  assert.deepEqual(resumo(solto("x_G = (x_A + x_B + x_C) / 3")), ["[x_G]", " = (", "[x_A + x_B + x_C]", ") / 3"], "a conta curta entre parênteses é uma fórmula só");
  assert.deepEqual(resumo(solto("x_A = 3, x_B = 5 e x_C")), ["[x_A = 3]", ", ", "[x_B = 5]", " e ", "[x_C]"]);
  assert.deepEqual(resumo(solto("então x_C = 12 − 8 = 4")), ["então ", "[x_C = 12 - 8 = 4]"]);
  assert.deepEqual(resumo(solto("3 · 4 = 3 + 5 + x_C")), ["[3 \\times 4 = 3 + 5 + x_C]"]);
  assert.deepEqual(resumo(solto("b^2 e x^2 e 10^3 e x_10 e x_AB e x_A^2 e y^n")), ["[b^2]", " e ", "[x^2]", " e ", "[10^3]", " e ", "[x_{10}]", " e ", "[x_{A B}]", " e ", "[x_A^2]", " e ", "[y^n]"]);
  // O cliente lê o texto que o servidor marcou: o mesmo resultado, sem ligar a heurística por conta própria.
  for (const frase of ["x_G = (x_A + x_B + x_C) / 3", "então x_C = 12 − 8 = 4", "b^2 e x^2 e 10^3 e x_10 e x_AB e x_A^2 e y^n", "A água é H_2O e $x_A$."]) {
    assert.deepEqual(resumo(lido(frase)), resumo(solto(frase)), frase);
  }
  assert.equal(marcarFormulasSoltas("x_A = 3, x_B = 5 e x_C"), "$x_A = 3$, $x_B = 5$ e $x_C$");
  // Cada segmento de fórmula traz a árvore, a forma canônica, o texto linear e o falado.
  const [formula] = partirTextoComFormulas("$x_G$");
  assert.equal(formula.tipo, "formula");
  assert.equal(formula.arvore.tipo, "script");
  assert.equal(formula.latex, "x_G");
  assert.equal(formula.linear, "x_G");
  assert.equal(formula.falado, "x índice G");
});

test("só o inequívoco: palavra, endereço, arquivo, código e frase comum ficam como texto", () => {
  for (const texto of [
    "snake_case e user_name e x_total e x_max", "https://exemplo.com/x_1 e www.site.com/b^2", "arquivo.x_1 e @x_1 e #x_1 e ~/x_1", "f_x(2) e g^2(3)",
    "R$ 5,00 e R$ 10,00", "4", "Os vértices A e B têm abscissas 3 e 5.", "x_1000 e x_ABC e 1234^2 e x^-1 e f_x(2)",
    "Resposta: a_b_c", "e-mail: nome_x@dominio.com",
  ]) {
    assert.deepEqual(resumo(partirTextoComFormulas(texto, { heuristica: true })), [texto], texto);
    assert.equal(marcarFormulasSoltas(texto), texto, `marcar não mexe: ${texto}`);
  }
  // Sem heurística (o padrão), nada é reconhecido sem marca.
  assert.deepEqual(resumo(partirTextoComFormulas("x_G = 1")), ["x_G = 1"]);
  assert.deepEqual(resumo(partirTextoComFormulas("x_G = 1", { heuristica: false })), ["x_G = 1"]);
  assert.deepEqual(resumo(partirTextoComFormulas("$x_G$ e x_A")), ["[x_G]", " e x_A"]);
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
  // Token solto colado em dinheiro, em letra acentuada ou em outro cifrão não vira marca (a marca não reabriria).
  assert.equal(marcarFormulasSoltas("R$x_A e x_Aé e $x_A e 2x_A"), "R$x_A e x_Aé e $x_A e 2x_A");
  // (Na lição de matemática o servidor tira antes o `$` único colado numa letra, `tirarCifraoSolto`; então o token ganha a marca: "… e $x_A$ e …".)
  assert.equal(marcarFormulasSoltas(tirarCifraoSolto("R$x_A e x_Aé e $x_A e 2x_A")), "R$x_A e x_Aé e $x_A$ e 2x_A");
  assert.equal(contemMarcaDeFormula("R$ 5,00 e R$ 10,00"), false);
  assert.equal(contemMarcaDeFormula("custa $5 e $10"), false);
  assert.equal(contemMarcaDeFormula("vale $x_G$."), true);
  assert.equal(contemMarcaDeFormula("sem nada"), false);
  // A marca não atravessa linha nem passa de 320 caracteres (a fórmula lê até 300; a conta de 201 caracteres da lição 8 era "cifrão cru" com o limite de 200).
  assert.equal(contemMarcaDeFormula("$x\ny$"), false);
  assert.equal(contemMarcaDeFormula(`$${"x + ".repeat(60)}x$`), true);
  assert.equal(contemMarcaDeFormula(`$${"x + ".repeat(90)}x$`), false);
});

test("fórmula marcada que não vale nunca derruba o texto: cai em texto linear, e a que não cabe em linha vira peças; sem LaTeX cru", () => {
  const casos = [
    ["Isso vale $\\frac{x_A + x_B}{2}$ no ponto médio.", "Isso vale (x_A + x_B) ÷ 2 no ponto médio."],
    ["A raiz é $\\sqrt{x + 1}$ aqui.", "A raiz é √(x + 1) aqui."],
    ["O determinante $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}$ vale −2.", "O determinante det[1, 2; 3, 4] vale −2."],
    ["Escreva $\\foo{x} + 1$ aqui", "Escreva foo(x) + 1 aqui"],
    ["Veja $\\alpha + \\beta$ e $\\pi r^2$.", "Veja α + β e πr²."],
    ["Calcule \\frac{1}{2} + \\sqrt{9} agora", "Calcule 1/2 + √9 agora"],
    ["$\\left( x \\right)^{2}$ e $x^{n+1}$", "(x)² e x^(n + 1)"],
  ];
  for (const [entrada, esperado] of casos) {
    const segmentos = partirTextoComFormulas(entrada);
    const texto = segmentos.filter((segmento) => segmento.tipo === "texto").map((segmento) => segmento.texto).join("");
    assert.equal(/[\\{}$_^]/.test(texto), false, `LaTeX cru, cifrão ou sublinhado sobrou em ${entrada}: ${texto}`);
    assert.equal(textoSemFormulas(entrada), esperado, entrada);
  }
  // O que lê e cabe em linha segue como fórmula, ao lado do que caiu; a fração simples também é fórmula.
  assert.deepEqual(resumo(partirTextoComFormulas("$x_A$ e $\\frac{1}{2}$ e $\\foo{y}$")), ["[x_A]", " e ", "[\\frac{1}{2}]", " e foo(y)"]);
  // A frase continua inteira, com a pontuação em volta.
  assert.equal(textoSemFormulas("Se $\\frac{a}{b}$, então: $a = 2b$."), "Se a/b, então: a = 2b.");
});

test("textoSemFormulas é o texto para quem não desenha; falarTextoComFormulas, o do leitor de tela", () => {
  assert.equal(textoSemFormulas("Use $x_G = (x_A + x_B + x_C) / 3$ para achar o ponto."), "Use x_G = (x_A + x_B + x_C) ÷ 3 para achar o ponto.");
  assert.equal(textoSemFormulas("O valor de $x_C$ é $4$, não R$ 4,00."), "O valor de x_C é 4, não R$ 4,00.");
  assert.equal(textoSemFormulas("sem matemática nenhuma, só R$ 5,00"), "sem matemática nenhuma, só R$ 5,00");
  assert.equal(textoSemFormulas("x_G = 1"), "x_G = 1", "token solto fica como está (já é legível)");
  assert.equal(falarTextoComFormulas("Então $x_C = 12 − 8 = 4$."), "Então x índice C é igual a 12 menos 8 é igual a 4.");
  assert.equal(falarTextoComFormulas("Com $x_A = 3$ e $x_B = 5$."), "Com x índice A é igual a 3 e x índice B é igual a 5.");
  assert.equal(falarTextoComFormulas(marcarFormulasSoltas("Com x_A = 3 e $x_B = 5$.")), "Com x índice A é igual a 3 e x índice B é igual a 5.", "o servidor marca a conta solta e a fala sai da árvore");
  assert.equal(falarTextoComFormulas("Só texto, sem fórmula."), "Só texto, sem fórmula.");
});

test("normalizarTextoComFormulas: o texto como o servidor o guarda", () => {
  assert.equal(normalizarTextoComFormulas("Use $x_G=(x_A+x_B)/3$ e $x_{AB}^{2}$"), "Use $x_G = (x_A + x_B) \\div 3$ e $x_{A B}^2$");
  assert.equal(normalizarTextoComFormulas("Use $x_G=(x_A+x_B)/3$ aqui", false), "Use x_G = (x_A + x_B) ÷ 3 aqui");
  // A que lê fica marcada, cabendo ou não em linha (a fala sai da árvore inteira); a que não lê vira texto linear.
  assert.equal(normalizarTextoComFormulas("Veja $1/2$ e $\\frac{x_A + x_B}{2}$ e $\\foo{x}$ e R$ 5,00"), "Veja $\\frac{1}{2}$ e $\\frac{x_A + x_B}{2}$ e foo(x) e R$ 5,00");
  assert.equal(normalizarTextoComFormulas("Veja $\\frac{x_A + x_B}{2}$ e $1/2$", false), "Veja (x_A + x_B) ÷ 2 e 1/2");
  assert.equal(normalizarTextoComFormulas("x_G = 1 e R$ 5,00"), "x_G = 1 e R$ 5,00", "tokens soltos ficam como a IA escreveu");
  assert.equal(marcarFormulasSoltas("x_G = 1 e R$ 5,00 e H_2O"), "$x_G = 1$ e R$ 5,00 e H₂O", "e nas lições de matemática o servidor os marca");
  for (const texto of ["Use $x_G=(x_A+x_B)/3$ e $x_{AB}^{2}$", "R$ 5,00 e $x$", "Calcule \\frac{1}{2}", "sem nada", "$\\frac{a}{b}$ e $y_C$", "$1/2$ e $\\frac{x_A + x_B}{2}$", "x_A e H_2O e b^2 e $a/b$"]) {
    const uma = normalizarTextoComFormulas(texto);
    assert.equal(normalizarTextoComFormulas(uma), uma, `não é estável: ${texto}`);
    const marcada = marcarFormulasSoltas(texto);
    assert.equal(marcarFormulasSoltas(marcada), marcada, `marcar não é estável: ${texto}`);
    assert.deepEqual(resumo(partirTextoComFormulas(marcada)), resumo(partirTextoComFormulas(texto, { heuristica: true })), `marcar e ler dão o mesmo: ${texto}`);
  }
});

test("linearizarTolerante: o que a IA quis dizer, sem barra e sem chave", () => {
  assert.equal(linearizarTolerante("x_G = \\frac{x_A + x_B}{2}"), "x_G = (x_A + x_B) ÷ 2", "o que lê sai pela árvore");
  const casos = [
    ["\\frac{1}{2}", "1/2"], ["\\frac{x + 1}{2}", "(x + 1) ÷ 2"], ["\\sqrt{x + 1}", "√(x + 1)"], ["2 \\times 3 \\leq 7", "2 × 3 ≤ 7"],
    ["\\alpha + \\beta", "α + β"], ["x^{2}", "x²"], ["x^{n+1}", "x^(n + 1)"], ["\\text{área} = b \\cdot h", "área = b × h"],
    ["\\left( a + b \\right)", "(a + b)"], ["\\foo{x} + 1", "foo(x) + 1"], ["\\resposta{4}", "4"],
    // Uma peça desconhecida NUNCA some (spec 15, seção 18): o nome fica, sem a barra; a função e o símbolo viram o que a tela mostra.
    ["\\foo x + 1", "foo x + 1"], ["\\sin x + \\unknown{y}", "sen x + unknown(y)"], ["\\vec{v} + \\mathbb{R}", "v + R"],
    ["\\theta = 30^{\\circ} + \\vec{v}", "θ = 30° + v"], ["\\lim_{x \\to 0} \\sin{x}", "lim_x → 0 sen x"], ["\\angle ABC = 90^\\circ", "∠ ABC = 90°"],
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
  const { desenharFormulaEmLinha, lerFormula, PISO_DO_TEXTO, PISO_EM_LINHA, caminhoValido } = await import("@studoo/contratos");
  const [formula] = partirTextoComFormulas("$x_G$");
  for (const tamanho of [16, 17]) {
    const caixa = desenharFormulaEmLinha(formula.arvore, tamanho);
    assert.ok(caixa.largura > 0 && caixa.altura >= tamanho * 0.9 && caixa.altura <= tamanho * 1.6, `${tamanho}: altura ${caixa.altura}`);
    assert.ok(caixa.linhaDeBase > 0 && caixa.linhaDeBase < caixa.altura, "a linha de base fica dentro da caixa");
    assert.ok(caixa.menorTexto >= PISO_EM_LINHA && caixa.menorTexto < PISO_DO_TEXTO, "índice a 70%, com mínimo 11 (o piso de 13 é do desenho avulso)");
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

/* ----- Marco 3c (parecer do Designer sobre o 3b, spec 15, seção 9) ----- */

const CORPUS = [
  "x_G = (x_A + x_B + x_C) / 3", "x_A^2 + y_B^2 = r^2", String.raw`\frac{x_A + x_B}{2}`, String.raw`\frac{1}{2}`, String.raw`\frac{x_A}{x_B}`,
  String.raw`\sqrt{x_A + 1}`, String.raw`\sqrt{9}`, "b^2 - 4ac", String.raw`\frac{-b + \sqrt{\Delta}}{2a}`, String.raw`\Delta = b^2 - 4ac`, String.raw`\pi r^2`,
  "C = (4, 0)", String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix}`, String.raw`\begin{bmatrix} x_A & y_A \\ x_B & y_B \end{bmatrix}`,
  String.raw`\foco{x_C} = 4`, String.raw`\foco{x_A^2}`, String.raw`x_{AB}^2`, "(x_A + x_B)^2", "e^{x^2}", "3 \\times 4 - 3 - 5",
  String.raw`x_G = \frac{x_A + x_B + x_C}{3} = \frac{3 + 5 + 4}{3}`,
  String.raw`\frac{x_A + x_B + x_C + x_D}{4} = \frac{3 + 5 + 4 + 2}{4} = \frac{14}{4}`, String.raw`\frac{y_B - y_A}{x_B - x_A}`,
  String.raw`\frac{1}{3} + \frac{1}{6}`, String.raw`\left( \frac{x_A + x_B}{2}, \frac{y_A + y_B}{2} \right)`, String.raw`x^{\frac{a + b}{2}}`,
  String.raw`\frac{1}{2x}`, "x_A / 2 + 1", "2x / 3",
];

test("3c (1): o que não cabe em linha vira peças desenhadas, sem sublinhado cru, e a fala sai da árvore inteira", () => {
  // O exemplo do Designer, peça por peça.
  const segmentos = partirTextoComFormulas("Isso vale $\\frac{x_A + x_B}{2}$.");
  assert.deepEqual(resumo(segmentos), ["Isso vale (", "x_A", " + ", "x_B", ") ÷ 2.",].map((peça, i) => (i === 1 || i === 3 ? `[${peça}]` : peça)));
  assert.deepEqual(segmentos.filter((segmento) => segmento.tipo === "formula").map((segmento) => segmento.falado), ["x índice A", "x índice B"]);
  // A fala é a da árvore inteira, nunca a do texto linear (que tem o sublinhado) e nunca "sublinhado".
  const falado = falarTextoComFormulas("Isso vale $\\frac{x_A + x_B}{2}$.");
  assert.equal(falado, "Isso vale fração: numerador x índice A mais x índice B, denominador 2.");
  assert.equal(/_|sublinhado/.test(falado), false);
  // Raiz e determinante também, com as variáveis desenhadas; sem variável, só texto.
  assert.deepEqual(resumo(partirTextoComFormulas("$\\sqrt{x_A + 1}$")), ["√(", "[x_A]", " + 1)"]);
  assert.deepEqual(resumo(partirTextoComFormulas("$\\sqrt{x}$ e $\\sqrt{9}$")), ["√", "[x]", " e √9"]);
  assert.deepEqual(resumo(partirTextoComFormulas("$\\begin{vmatrix} x_1 & 2 \\\\ 3 & 4 \\end{vmatrix}$")), ["det[", "[x_1]", ", 2; 3, 4]"]);
  assert.deepEqual(resumo(partirTextoComFormulas("$\\frac{x_A}{x_B + 1}$")), ["[x_A]", " ÷ (", "[x_B]", " + 1)"]);
  // Em todo o corpus: nada de sublinhado, expoente, barra ou chave em texto; cada peça desenhada cabe na linha; o texto linear é o de sempre.
  for (const formula of CORPUS) {
    const marca = `$${formula}$`;
    assert.equal(lerFormula(formula).ok, true, formula);
    const partes = partirTextoComFormulas(marca);
    for (const parte of partes) {
      if (parte.tipo === "texto") assert.equal(/[_^\\{}$]/.test(parte.texto), false, `${formula}: texto cru "${parte.texto}"`);
      else {
        assert.equal(formulaCabeNaLinha(parte.arvore, 16), true, `${formula}: peça que não cabe na linha`);
        for (const tamanho of [16, 17]) {
          const caixa = caixaDaFormulaEmLinha(parte.arvore, tamanho);
          assert.ok(caixa.a + caixa.p <= 1.5 * tamanho + 1e-9, `${formula} a ${tamanho}: altura ${caixa.a + caixa.p}`);
        }
      }
    }
    const lidaInteira = lerFormula(formula);
    // (A barra com termos simples vira a fração "a/b" só dentro de marca de texto, e a fala dela é "sobre": ver o item 1a.)
    if (!/\s\/\s/.test(formula)) assert.equal(falarTextoComFormulas(marca), falarFormula(lidaInteira.arvore), `${formula}: a fala vem da árvore inteira`);
    assert.equal(/[_]|sublinhado/.test(falarTextoComFormulas(marca)), false, `${formula}: a fala leu um sublinhado`);
    // (Só o expoente que é uma fração composta troca o `^` por palavras nas peças: "x elevado a …", sem caractere cru.)
    if (!formula.startsWith("x^{\\frac")) assert.equal(partes.map((parte) => (parte.tipo === "texto" ? parte.texto : parte.linear)).join(""), textoSemFormulas(marca), `${formula}: as peças formam o texto linear`);
    assert.equal(partes.every((parte, k) => parte.tipo !== "texto" || partes[k + 1]?.tipo !== "texto"), true, "textos vizinhos se juntam");
  }
  assert.deepEqual(resumo(partirTextoComFormulas("$x^{\\frac{a + b}{2}}$")), ["[x]", " elevado a ((", "[a]", " + ", "[b]", ") ÷ 2)"]);
  // A que cabe fica uma peça só; a larga demais ou alta demais quebra em peças que quebram como palavras.
  assert.equal(partirTextoComFormulas("$x_G = (x_A + x_B + x_C) / 3$").length, 1);
  assert.ok(partirTextoComFormulas(`$${CORPUS[21]}$`).length > 8, "larga demais: peças");
  assert.deepEqual(resumo(partirTextoComFormulas("$\\foco{x_A^2}$")), ["[x_A^2]"], "o destaque some, mas o expoente e o índice seguem desenhados");
});

test("3c (1a): a fração simples é desenhada a/b em linha e lida 'a sobre b'; as outras barras continuam ÷", async () => {
  const { desenharFormulaEmLinha } = await import("@studoo/contratos");
  for (const marca of ["$1/2$", "$1 / 2$", "$\\frac{1}{2}$"]) {
    const [um, ...resto] = partirTextoComFormulas(`Metade: ${marca}`).slice(1);
    assert.equal(resto.length, 0, marca);
    assert.equal(um.tipo, "formula");
    assert.equal(um.latex, "\\frac{1}{2}");
    assert.equal(um.linear, "1/2");
    assert.equal(um.falado, "1 sobre 2", "numa frase, meio é um número: não 'dividido por'");
    assert.equal(falarTextoComFormulas(`Metade: ${marca}.`), "Metade: 1 sobre 2.");
    const caixa = desenharFormulaEmLinha(um.arvore, 16);
    assert.equal(caixa.primitivas.some((primitiva) => primitiva.tipo === "linha"), false, "nenhuma barra de fração empilhada");
    assert.ok(caixa.altura <= 1.5 * 16 && caixa.largura > 12 && caixa.largura < 30, `1/2 em linha: ${caixa.largura} × ${caixa.altura}`);
  }
  for (const [marca, latex, falado] of [
    ["$x_A/2$", "\\frac{x_A}{2}", "x índice A sobre 2"], ["$x = 1/2$", "x = \\frac{1}{2}", "x é igual a 1 sobre 2"], ["$x/2 + 1$", "\\frac{x}{2} + 1", "x sobre 2 mais 1"],
    ["$-1/2$", "-\\frac{1}{2}", "menos 1 sobre 2"], ["$\\frac{x_A}{x_B}$", "\\frac{x_A}{x_B}", "x índice A sobre x índice B"], ["$3/4 + 1/4$", "\\frac{3}{4} + \\frac{1}{4}", "3 sobre 4 mais 1 sobre 4"],
  ]) {
    const [formula, ...resto] = partirTextoComFormulas(marca);
    assert.equal(resto.length, 0, marca);
    assert.equal(formula.latex, latex, marca);
    assert.equal(formula.falado, falado, marca);
  }
  // Barra com termo composto, ou outra barra em volta, continua ÷ e se fala "dividido por".
  for (const [marca, latex] of [
    ["$(x_A + x_B + x_C) / 3$", "(x_A + x_B + x_C) \\div 3"], ["$2x/3$", "2x \\div 3"], ["$6 \\div 3$", "6 \\div 3"], ["$a/b/c$", "a \\div b \\div c"],
    ["$x^2/3$", "x^2 \\div 3"], ["$1/2x$", "1 \\div 2x"], ["$\\text{km/h}$", "\\text{km/h}"],
  ]) {
    const [formula, ...resto] = partirTextoComFormulas(marca);
    assert.equal(resto.length, 0, marca);
    assert.equal(formula.latex, latex, marca);
  }
  assert.match(partirTextoComFormulas("$6 \\div 3$")[0].falado, /dividido por/);
  // Fora de marca, a barra é do texto.
  assert.deepEqual(resumo(partirTextoComFormulas("1/2 e a/b")), ["1/2 e a/b"]);
  // Em bloco (a fórmula da lição), a fração segue empilhada: a regra é do texto corrido.
  assert.equal(lerFormula("1/2").arvore.itens[1].valor, "÷");
});

test("3c (2): a heurística não liga sozinha; o servidor a liga na lição de matemática; química sem sublinhado", () => {
  // O perigo real: código numa lição de programação.
  const python = "Em Python, use x_1 = 3 e print(x_1).";
  assert.deepEqual(resumo(partirTextoComFormulas(python)), [python], "o cliente que parte o texto não lê o que não está marcado");
  assert.equal(textoSemFormulas(python), python);
  assert.equal(falarTextoComFormulas(python), python);
  assert.equal(normalizarTextoComFormulas(python), python);
  // Quem decide se a lição é de matemática é o servidor; só ele chama `marcarFormulasSoltas` (ver visuais-servidor.test.mjs).
  assert.equal(marcarFormulasSoltas("Em Python, use x_1 = 3."), "Em Python, use $x_1 = 3$.", "na lição de matemática x_1 é índice");
  // Química: o índice é uma contagem de átomos, em algarismo subscrito, sem sublinhado e sem desenho.
  for (const [entrada, esperado] of [
    ["H_2O", "H₂O"], ["CO_2", "CO₂"], ["C_6H_12O_6", "C₆H₁₂O₆"], ["H_2SO_4", "H₂SO₄"], ["Na_2CO_3", "Na₂CO₃"], ["A água é H_2O.", "A água é H₂O."],
    ["o CO_2 e o O_2", "o CO₂ e o $O_2$"],
  ]) {
    assert.equal(marcarFormulasSoltas(entrada), esperado, entrada);
  }
  assert.equal(/_/.test(marcarFormulasSoltas("H_2O e CO_2")), false);
  // Tokens com código ou nome de variável longo seguem como estão.
  for (const texto of ["use meu_valor_1 e snake_case", "x_total + y_total", "CO_2x", "H_2O_ e (CO_2)x"]) assert.equal(marcarFormulasSoltas(texto).includes("$"), false, texto);
});

test("3c (3): a regra de desenho em linha: 70% com mínimo 11, índice desce 0,3 em, expoente sobe 0,45 em, dentro da linha de 1,5 em", () => {
  for (const tamanho of [16, 17]) {
    // Índice e expoente: tamanho, posição e altura da caixa.
    const indice = caixaDaFormulaEmLinha(lerFormula("x_A").arvore, tamanho);
    const [base, filho] = indice.marcas;
    assert.equal(base.y, 0, "a base fica na linha de base");
    assert.equal(base.tamanho, tamanho);
    assert.ok(Math.abs(filho.tamanho - Math.max(11, 0.7 * tamanho)) < 1e-9, `${tamanho}: índice a ${filho.tamanho}`);
    assert.ok(Math.abs(filho.y - 0.3 * tamanho) < 1e-9, "o índice desce 0,3 em");
    const expoente = caixaDaFormulaEmLinha(lerFormula("x^2").arvore, tamanho);
    assert.ok(Math.abs(expoente.marcas[1].y + 0.45 * tamanho) < 1e-9, "o expoente sobe 0,45 em");
    assert.ok(Math.abs(expoente.marcas[1].tamanho - Math.max(11, 0.7 * tamanho)) < 1e-9);
    // Dentro da linha, sem a linha crescer: nenhuma fórmula em linha passa de 1,5 em, nem com índice e expoente juntos.
    for (const formula of ["x_A", "x^2", "x_A^2", "x_{AB}^{2}", "e^{x^2}", "x_G = (x_A + x_B + x_C) \\div 3", "(x_A + x_B)^2", "x_A^2 + y_B^2 = r^2", "\\frac{x_A^2}{y_B}", "\\pi r^2", "\\foco{x_C} = 4"]) {
      const caixa = caixaDaFormulaEmLinha(lerFormula(formula).arvore, tamanho);
      assert.ok(caixa.a + caixa.p <= 1.5 * tamanho + 1e-9, `${formula} a ${tamanho}: ${caixa.a + caixa.p} > ${1.5 * tamanho}`);
    }
    // Sinais com 0,2 em de cada lado; parênteses do tamanho do texto (nunca esticados); fração simples "a/b" sem barra.
    const soma = caixaDaFormulaEmLinha(lerFormula("x + y").arvore, tamanho);
    const [x, mais, y] = soma.marcas;
    const larguraDoX = caixaDaFormulaEmLinha(lerFormula("x").arvore, tamanho).l;
    const larguraDoMais = caixaDaFormulaEmLinha(lerFormula("x + y").arvore, tamanho).l - larguraDoX - caixaDaFormulaEmLinha(lerFormula("y").arvore, tamanho).l - 2 * 0.2 * tamanho;
    assert.ok(Math.abs(mais.x - (x.x + larguraDoX + 0.2 * tamanho)) < 1e-6, "0,2 em antes do sinal");
    assert.ok(Math.abs(y.x - (mais.x + larguraDoMais + 0.2 * tamanho)) < 1e-6, "0,2 em depois do sinal");
    const parenteses = caixaDaFormulaEmLinha(lerFormula("(x_A + x_B)").arvore, tamanho);
    assert.equal(parenteses.marcas.some((marca) => marca.m === "caminho"), false, "parênteses são texto do tamanho do texto, não curvas esticadas");
    assert.equal(parenteses.marcas.filter((marca) => marca.m === "texto" && (marca.texto === "(" || marca.texto === ")")).every((marca) => marca.tamanho === tamanho), true);
    const meio = caixaDaFormulaEmLinha(lerFormula("\\frac{x_A}{2}").arvore, tamanho);
    assert.equal(meio.marcas.some((marca) => marca.m === "linha"), false);
    assert.ok(meio.marcas.some((marca) => marca.m === "texto" && marca.texto === "/"));
  }
  // O mínimo de 11: texto pequeno não afunda o índice.
  assert.equal(caixaDaFormulaEmLinha(lerFormula("x_A").arvore, 12).marcas[1].tamanho, 11);
  // O que não cabe na linha (altura de 1,5 em, ou largura) cai nas peças do item (1).
  assert.equal(formulaCabeNaLinha(lerFormula("\\foco{x_A^2}").arvore, 16), false);
  assert.equal(formulaCabeNaLinha(lerFormula("\\frac{x_A + x_B}{2}").arvore, 16), false);
  assert.equal(formulaCabeNaLinha(lerFormula("x_A").arvore, 16), true);
  assert.equal(formulaCabeNaLinha(lerFormula(CORPUS[21]).arvore, 16), false, "larga demais");
});

test("3d: a conta curta solta ('x = 3', 'a + b', 'y − 2') vira fórmula; letra no meio da frase só com marca", () => {
  // Os casos do Designer.
  assert.equal(marcarFormulasSoltas("x = 3"), "$x = 3$");
  assert.equal(marcarFormulasSoltas("a + b"), "$a + b$");
  assert.equal(marcarFormulasSoltas("y − 2"), "$y - 2$");
  assert.equal(marcarFormulasSoltas("lado x"), "lado x", "uma letra solta no meio da frase só vira fórmula com marca");
  assert.equal(marcarFormulasSoltas("lado $x$"), "lado $x$");
  assert.equal(marcarFormulasSoltas("a casa"), "a casa");
  assert.equal(marcarFormulasSoltas("x = 3 reais"), "$x = 3$ reais", "a conta acaba onde a palavra começa");
  // Em frase, com a pontuação em volta, vírgula decimal e sinal.
  assert.equal(marcarFormulasSoltas("Se x = 3, então y = x + 2."), "Se $x = 3$, então $y = x + 2$.");
  assert.equal(marcarFormulasSoltas("Com x=3,5 e y = -2."), "Com $x = 3.5$ e $y = -2$.");
  assert.equal(marcarFormulasSoltas("R$ 5,00 e x = 3"), "R$ 5,00 e $x = 3$", "dinheiro não é conta");
  assert.equal(marcarFormulasSoltas("A razão é a / b."), "A razão é $\\frac{a}{b}$.", "a / b com termos simples é a fração a/b");
  assert.equal(marcarFormulasSoltas("(x + 1) e [a − b]"), "($x + 1$) e [$a - b$]");
  // O que não é conta curta fica como está: sem letra, produto, potência em Unicode, palavra, lista, hífen de palavra.
  for (const texto of [
    "3 + 4 = 7", "2x = 6", "4ac", "x² = 9", "Plano A + plano B", "Passo 1 - escolha x", "e-mail x-3.txt", "O ponto A e o ponto B", "1, 2 e 3", "5 - 3 - 1",
    "Opção A: x", "a) b) c)", "pág. 3 - 5", "https://exemplo.com/a=3", "arquivo_x = 3", "x == 3",
  ]) {
    assert.equal(marcarFormulasSoltas(texto).replace(/\$/g, "").length > 0, true);
    assert.equal(/\$[^$]*\b[a-z]\s?[=+−-]\s?\d/.test(marcarFormulasSoltas(texto)) && !/\$/.test(texto), false, `virou fórmula: ${texto}`);
  }
  assert.equal(marcarFormulasSoltas("3 + 4 = 7 e 2x = 6 e x² = 9 e Plano A + plano B"), "3 + 4 = 7 e 2x = 6 e x² = 9 e Plano A + plano B");
  assert.equal(marcarFormulasSoltas("Passo 1 - escolha x e e-mail x-3.txt e O ponto A e o ponto B"), "Passo 1 - escolha x e e-mail x-3.txt e O ponto A e o ponto B");
  // Idempotente, e o cliente lê o mesmo que a heurística leria (sem ligar nada por conta própria).
  for (const texto of ["x = 3", "Se x = 3, então y = x + 2.", "x_A = 3, x_B = 5 e x_C", "a + b e lado x e $x^2 = 9$"]) {
    const marcado = marcarFormulasSoltas(texto);
    assert.equal(marcarFormulasSoltas(marcado), marcado, texto);
    assert.deepEqual(resumo(partirTextoComFormulas(marcado)), resumo(partirTextoComFormulas(texto, { heuristica: true })), texto);
  }
  // Cada conta é UMA fórmula em linha, falada pela árvore; nada de sublinhado.
  const [conta] = partirTextoComFormulas("x = 3", { heuristica: true });
  assert.equal(conta.tipo, "formula");
  assert.equal(conta.falado, "x é igual a 3");
  assert.equal(conta.linear, "x = 3");
  assert.equal(falarTextoComFormulas(marcarFormulasSoltas("a + b")), "a mais b");
});

/* ----- Marco 2d: o peso do texto ao redor e a linha de base ----- */

/** A tinta de um desenho: a soma da área dos contornos de texto (caminhos preenchidos), com as curvas achatadas. */
function tinta(desenho) {
  let total = 0;
  for (const primitiva of desenho.primitivas) {
    if (primitiva.tipo !== "caminho" || !primitiva.preenchimento) continue;
    const re = /([MLQZ])([^MLQZ]*)/g;
    let achado;
    let atual = [0, 0];
    let inicio = [0, 0];
    let area = 0;
    const aresta = (x1, y1, x2, y2) => { area += (x1 * y2 - x2 * y1) / 2; };
    while ((achado = re.exec(primitiva.d))) {
      const n = achado[2].trim() ? achado[2].trim().split(/\s+/).map(Number) : [];
      if (achado[1] === "M") { atual = [n[0], n[1]]; inicio = atual; }
      else if (achado[1] === "L") { aresta(...atual, n[0], n[1]); atual = [n[0], n[1]]; }
      else if (achado[1] === "Q") {
        let anterior = atual;
        for (let i = 1; i <= 8; i += 1) {
          const t = i / 8;
          const px = (1 - t) ** 2 * atual[0] + 2 * t * (1 - t) * n[0] + t * t * n[2];
          const py = (1 - t) ** 2 * atual[1] + 2 * t * (1 - t) * n[1] + t * t * n[3];
          aresta(anterior[0], anterior[1], px, py);
          anterior = [px, py];
        }
        atual = [n[2], n[3]];
      } else { aresta(...atual, ...inicio); atual = inicio; }
    }
    total += Math.abs(area);
  }
  return total;
}

test("2d (a): a fórmula em linha usa o peso do texto ao redor, 400 na aula e 700 (o padrão) no enunciado; as variáveis seguem em itálico", async () => {
  const { desenharFormulaEmLinha } = await import("@studoo/contratos");
  for (const formula of ["x = 3", "x_A + y_B", "x^2 = 9", "\\frac{x}{2} + 1", "\\pi r^2", "\\Delta = b^2 - 4ac", "a \\leq b", "(x + 1)^2 \\neq 0"]) {
    const arvore = lerFormula(formula).arvore;
    const padrao = desenharFormulaEmLinha(arvore, 16);
    const negrito = desenharFormulaEmLinha(arvore, 16, 700);
    const regular = desenharFormulaEmLinha(arvore, 16, 400);
    assert.deepEqual(padrao, negrito, `${formula}: 700 é o padrão, quem já chama não muda`);
    assert.notDeepEqual(regular.primitivas, negrito.primitivas, `${formula}: o 400 desenha outros contornos`);
    assert.ok(regular.largura <= negrito.largura + 1e-9, `${formula}: o regular não é mais largo (${regular.largura} contra ${negrito.largura})`);
    assert.ok(tinta(regular) < 0.88 * tinta(negrito), `${formula}: o regular é mais fino (${Math.round(tinta(regular))} contra ${Math.round(tinta(negrito))})`);
    // A caixa (altura e linha de base) não depende do peso: a fórmula entra na mesma linha do texto.
    assert.equal(regular.altura, negrito.altura);
    assert.equal(regular.linhaDeBase, negrito.linhaDeBase);
    assert.equal(regular.falado, negrito.falado);
    assert.ok(regular.menorTexto >= 11 && regular.menorTexto <= 16, `${formula}: menor texto ${regular.menorTexto}`);
  }
  // Cada marca de texto leva o peso pedido, e a variável sozinha continua em itálico (o número não).
  const marcas = (formula, peso) => caixaDaFormulaEmLinha(lerFormula(formula).arvore, 16, "texto", peso).marcas.filter((marca) => marca.m === "texto");
  for (const peso of [400, 700]) {
    const todas = marcas("x_A = 3 + y^2", peso);
    assert.ok(todas.length >= 6 && todas.every((marca) => marca.peso === peso), `todas as marcas em ${peso}`);
    assert.equal(todas.find((marca) => marca.texto === "x").italico, true, "a variável é itálica");
    assert.equal(todas.find((marca) => marca.texto === "3").italico, false, "o número é reto");
    assert.equal(todas.find((marca) => marca.texto === "A").italico, false, "o índice é reto");
  }
  // O 400 é o peso do texto regular da aula e o 700 o do enunciado: as duas palavras "x" e "3" têm a mesma altura de letra.
  assert.equal(marcas("x", 400)[0].tamanho, marcas("x", 700)[0].tamanho);
  // Os traços que o motor desenha no lugar de ≤ ≥ ≠ → ficam mais finos no 400.
  const traco = (formula, peso) => caixaDaFormulaEmLinha(lerFormula(formula).arvore, 16, "texto", peso).marcas.find((marca) => marca.m === "linha").largura;
  assert.ok(traco("a \\leq b", 400) < traco("a \\leq b", 700));
});

test("2d (c): a linhaDeBase fica na base dos algarismos e das letras, não no fundo da caixa nem no do índice", async () => {
  const { desenharFormulaEmLinha } = await import("@studoo/contratos");
  const fundoDoTexto = (desenho) => {
    const numeros = desenho.primitivas.filter((primitiva) => primitiva.tipo === "caminho").flatMap((primitiva) => primitiva.d.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 1));
    return Math.max(...numeros);
  };
  for (const tamanho of [16, 17]) {
    for (const peso of [400, 700]) {
      // Sem índice nem barra, a base das letras e dos algarismos é o ponto mais baixo do desenho (e a `linhaDeBase`).
      // (Sem "y", "g", "p" nem "q": a perna dessas letras desce da base, como deve.)
      for (const formula of ["x", "x + 1", "x = 3", "a = 12", "x^2", "a^2 + x^2 = 9"]) {
        const desenho = desenharFormulaEmLinha(lerFormula(formula).arvore, tamanho, peso);
        assert.ok(Math.abs(fundoDoTexto(desenho) - desenho.linhaDeBase) <= 0.6, `${formula} ${tamanho}/${peso}: base em ${fundoDoTexto(desenho)}, linhaDeBase ${desenho.linhaDeBase}`);
        assert.ok(desenho.linhaDeBase < desenho.altura);
      }
      // Com índice ou fração "a/b" o fundo da caixa desce, mas a linhaDeBase continua na base do algarismo: é a mesma da fórmula sem eles.
      const simples = desenharFormulaEmLinha(lerFormula("x").arvore, tamanho, peso).linhaDeBase;
      assert.equal(desenharFormulaEmLinha(lerFormula("x_A").arvore, tamanho, peso).linhaDeBase, simples, "o índice não muda a linha de base");
      assert.equal(desenharFormulaEmLinha(lerFormula("\\frac{1}{2}").arvore, tamanho, peso).linhaDeBase, simples, "1/2 fica na linha de base das letras e dos algarismos");
      const comIndice = desenharFormulaEmLinha(lerFormula("x_A").arvore, tamanho, peso);
      assert.ok(comIndice.altura > comIndice.linhaDeBase + 0.25 * tamanho, "o fundo da caixa vai além da base (o índice desce)");
      // A base do algarismo de "1/2" cai na linha de base: o 1 e o 2 estão sobre ela (o contorno do "/" é que passa um pouco abaixo).
      const meio = desenharFormulaEmLinha(lerFormula("\\frac{1}{2}").arvore, tamanho, peso);
      assert.ok(fundoDoTexto(meio) >= meio.linhaDeBase && fundoDoTexto(meio) <= meio.linhaDeBase + 0.15 * tamanho + 0.6, "só a barra inclinada passa da base");
    }
  }
  // Com expoente, a caixa cresce para cima e a linhaDeBase com ela: a base do "x" é a mesma distância do topo.
  const expoente = desenharFormulaEmLinha(lerFormula("x^2").arvore, 16, 700);
  assert.ok(expoente.linhaDeBase > desenharFormulaEmLinha(lerFormula("x").arvore, 16, 700).linhaDeBase + 0.2 * 16, "o topo da caixa sobe com o expoente");
});

test("2e: fatores sem sinal leem colados ('4ac', '2x', 'xy'), no desenho em linha e no bloco; com sinal, o respiro fica", () => {
  // O vão entre o fim do avanço de uma marca e o começo da seguinte: positivo é um espaço entre os fatores.
  const vaos = (formula, tamanho = 16) => {
    const marcas = caixaDaFormulaEmLinha(lerFormula(formula).arvore, tamanho, "texto", 700).marcas.filter((marca) => marca.m === "texto");
    return marcas.slice(1).map((marca, i) => marca.x - (marcas[i].x + larguraDoTexto(marcas[i].texto, tamanho, 700)));
  };
  for (const tamanho of [16, 17, 22]) {
    // número → variável e variável → variável: colados, sem vão (no máximo um pixel de encaixe para dentro).
    for (const formula of ["4ac", "2x", "xy", "a b c", "3 x y"]) {
      for (const vao of vaos(formula, tamanho)) assert.ok(vao <= 0.01 && vao >= -0.07 * tamanho - 0.01, `${formula} a ${tamanho}: vão de ${vao}`);
    }
    // Com sinal, o respiro de sempre (0,2 em de cada lado) fica.
    for (const vao of vaos("4 + a", tamanho)) assert.ok(vao >= 0.19 * tamanho, `4 + a a ${tamanho}: vão de ${vao}`);
  }
  // Letra com índice depois de um número também cola: "2x_A".
  assert.ok(vaos("2x_A")[0] <= 0.01);
  // Número seguido de número não existe sem sinal; número seguido de parênteses mantém o respiro de 1.
  assert.ok(vaos("2(x + 1)")[0] >= 0.9);
  // O desenho em bloco usa a mesma regra.
  const bloco = caixaDaFormula(lerFormula("4ac").arvore, 22).marcas.filter((marca) => marca.m === "texto");
  assert.ok(bloco[1].x - (bloco[0].x + larguraDoTexto("4", 22, 700)) <= 0.01);
});

test("2e: 'Δ ≠ 0', 'Δ ≥ 0' e 'π = 3,14' no meio da frase são fórmula em linha (letra grega, sinal e número)", () => {
  assert.equal(marcarFormulasSoltas("Se Δ ≠ 0, há duas raízes."), "Se $\\Delta \\neq 0$, há duas raízes.");
  assert.equal(marcarFormulasSoltas("Com Δ ≥ 0 e Δ > 0"), "Com $\\Delta \\geq 0$ e $\\Delta > 0$");
  assert.equal(marcarFormulasSoltas("Use π = 3,14."), "Use $\\pi = 3.14$.");
  assert.equal(marcarFormulasSoltas("Δ = b^2 - 4ac vale 25"), "$\\Delta = b^2$ - 4ac vale 25", "o produto 4ac não é termo da conta curta: fica texto");
  const [formula] = partirTextoComFormulas("Δ ≠ 0", { heuristica: true });
  assert.equal(formula.tipo, "formula");
  assert.equal(formula.falado, "delta é diferente de 0");
  // Letra grega no meio de uma palavra não é conta.
  assert.equal(marcarFormulasSoltas("O Δ do problema e o π da roda"), "O Δ do problema e o π da roda");
});

test("12a: \\sin, \\cos, \\tan, \\ln e \\log no texto em linha não somem: a frase do pedido, a notação brasileira e a peça desconhecida que sai como veio", () => {
  const frase = "A onda $h(x) = \\sin x$ vai de −1 a 1.";
  assert.equal(textoSemFormulas(frase), "A onda h(x) = sen x vai de −1 a 1.", "nunca \"h(x) = x\": a função fica, com o nome da tela");
  assert.equal(falarTextoComFormulas(frase).includes("seno de x"), true);
  const segmentos = partirTextoComFormulas(frase);
  assert.equal(segmentos.some((segmento) => segmento.tipo === "formula" && segmento.latex === "h(x) = \\sin x"), true, "é fórmula em linha, com a forma canônica");
  // Notação brasileira na tela, em qualquer ordem de escrita; nunca "sin" nem "tan".
  for (const [entrada, esperado] of [
    ["$\\sin^2 x + \\cos^2 x = 1$", "sen² x + cos² x = 1"],
    ["$\\theta = 30^\\circ$", "θ = 30°"],
    ["$\\log_2 8 = 3$", "log_2 8 = 3"],
    ["$\\tan \\theta = \\frac{\\sin \\theta}{\\cos \\theta}$", "tg θ = (sen θ) ÷ (cos θ)"],
    ["$\\ln x$ e $\\sin(2x + 1)$ e $2\\cos x$", "ln x e sen(2x + 1) e 2 cos x"],
    ["$sen x$ e $tg x$ e $\\operatorname{sen} x$", "sen x e tg x e sen x"],
  ]) {
    const linear = textoSemFormulas(entrada);
    assert.equal(linear, esperado, entrada);
    assert.equal(/sin|tan|\\|\$/.test(linear), false, `sin, tan, barra ou cifrão na tela: ${linear}`);
  }
  // A fórmula que o leitor não conhece sai COMO VEIO (legível, sem barra, sem cifrão), nunca com o comando apagado.
  assert.equal(textoSemFormulas("Use $\\foo x + 1$ aqui"), "Use foo x + 1 aqui");
  assert.equal(textoSemFormulas("Use $\\sin x + \\unknown{y}$ aqui"), "Use sen x + unknown(y) aqui");
  assert.equal(textoSemFormulas("Use $\\sum_{i=1} a_i + \\sin x$ aqui").includes("sen x"), true);
  assert.equal(normalizarTextoComFormulas("Veja $\\tan x$ e $\\foo x$"), "Veja $\\tan x$ e foo x");
  // A matriz que o leitor recusa (um determinante 2 × 3 não é quadrado) lê como a conta escreve, sem "begin", "vmatrix", "end" nem "&" na tela.
  const naoQuadrado = "O determinante $\\begin{vmatrix} 1 & 2 & 5 \\\\ 3 & 4 & k \\end{vmatrix} = 0$ vale zero.";
  assert.equal(textoSemFormulas(naoQuadrado), "O determinante det[1, 2, 5; 3, 4, k] = 0 vale zero.");
  assert.equal(/begin|end|vmatrix|&|\$/.test(textoSemFormulas(naoQuadrado)), false);
  assert.equal(linearizarTolerante("\\begin{bmatrix} 1 & \\frac{1}{2} \\\\ 3 & 4 \\\\ 5 & 6 \\end{bmatrix}"), "[1, 1/2; 3, 4; 5, 6]");
  assert.equal(linearizarTolerante("\\begin{vmatrix} a & b \\ c & d \\end{vmatrix}"), "det[a, b; c, d]", "o `\\\\` que o JSON comeu separa as linhas do mesmo jeito");
});

test("12a, grupo 2: a fórmula em linha com matriz no cliente sem cabeçalho nunca deixa cifrão, vmatrix, begin, end nem & (o caso da lição 8 da IA real)", () => {
  const matriz = String.raw`\begin{vmatrix} 1 & 2 & 1 \\ 3 & 4 & 1 \\ 5 & 6 & 1 \end{vmatrix}`;
  const conta = ["1 X 4 X 1", "2 X 1 X 5", "1 X 3 X 6"].join(" + ") + " - " + ["5 X 4 X 1", "6 X 1 X 1", "1 X 3 X 2"].join(" - ");
  const limpo = (linear) => !/[$&\\{}]|vmatrix|begin|end\b/.test(linear);
  // Com `\times` a marca tem 201 caracteres (o limite era 200: a marca não se formava, e o cifrão e o "vmatrix" iam para a tela).
  for (const operador of ["×", String.raw`\times`, String.raw` \times `, String.raw`\cdot`]) {
    const conteudo = `${matriz} = ${conta.replaceAll("X", operador)} = 0`;
    const texto = `Com A(1, 2), B(3, 4) e C(5, 6): o determinante é $${conteudo}$. Como deu zero, os três pontos estão alinhados.`;
    assert.equal(contemMarcaDeFormula(texto), true, `marca com ${conteudo.length} caracteres`);
    const linear = textoSemFormulas(texto);
    assert.equal(limpo(linear), true, linear);
    assert.match(linear, /o determinante é det\[1, 2, 1; 3, 4, 1; 5, 6, 1\] = 1 × 4 × 1 \+ 2 × 1 × 5/);
    assert.equal(limpo(falarTextoComFormulas(texto)), true);
    assert.equal(limpo(normalizarTextoComFormulas(texto, false)), true);
  }
  // A marca que passa de 320 caracteres, a que ficou sem o par (texto cortado) e a que tem espaço colado no cifrão também saem sem cifrão: o cifrão que
  // cerca LaTeX vai embora com ele. O de dinheiro fica.
  const enorme = `Veja $${matriz} = ${conta.replaceAll("X", String.raw` \times `)} = ${"0 + ".repeat(40)}0$ pronto.`;
  assert.equal(limpo(textoSemFormulas(enorme)), true, textoSemFormulas(enorme));
  assert.equal(textoSemFormulas("Aberta: $\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix} = 1 \\times 4 − 2 \\times 3 ou…"), "Aberta: det[1, 2; 3, 4] = 1 × 4 − 2 × 3 ou…");
  assert.equal(textoSemFormulas("Use $ \\sin x $ agora"), "Use sen x agora");
  assert.equal(textoSemFormulas("$$\\sin x$$ duplo"), "sen x duplo");
  assert.equal(textoSemFormulas("Dinheiro R$ 5,00 e $ 80 e US$10, e \\alpha solto"), "Dinheiro R$ 5,00 e $ 80 e US$10, e α solto");
  // O cifrão de dinheiro antes de 5 não rouba o par da marca que vem depois.
  assert.equal(textoSemFormulas("custa $5 e a conta $x \\times 2$ fecha"), "custa $5 e a conta x × 2 fecha");
  assert.equal(contemCifraoDeLatex("$\\begin{vmatrix}"), true);
  assert.equal(contemCifraoDeLatex("R$ 5,00 e US$10"), false);
});
