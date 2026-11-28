import assert from "node:assert/strict";
import { test } from "node:test";
import { desenharVisual, larguraDoTexto, lerFormula, semGlifoNaFormula, validarVisual } from "@studoo/contratos";
import { caixaDaFormula, caixaDaFormulaEmLinha } from "../packages/contratos/src/motor-formula.ts";

/*
 * Funções (sen, cos, tg, ln, log), letras gregas e grau na fórmula (marco 12a, spec 15, seção 18): o que a tela desenha. O leitor, a forma canônica, o
 * texto linear e a fala estão em formula-latex.test.mjs; a peça desconhecida que nunca some, em formula-no-texto.test.mjs.
 */

const arvore = (fonte) => {
  const lida = lerFormula(fonte);
  assert.equal(lida.ok, true, `${fonte}: ${lida.erro}`);
  return lida.arvore;
};
const caixa = (fonte, tamanho = 22) => caixaDaFormula(arvore(fonte), tamanho);
const emLinha = (fonte, tamanho = 16, peso = 400) => caixaDaFormulaEmLinha(arvore(fonte), tamanho, "texto", peso);
const textos = (c) => c.marcas.filter((marca) => marca.m === "texto");
const perto = (a, b, folga = 0.01) => assert.ok(Math.abs(a - b) <= folga, `${a} devia ser ${b}`);

test("o nome da função é reto, no peso do texto, e leva um vão fino de 0,17 em antes do argumento", () => {
  // No bloco (22, peso 700): "sen" reto e o x em itálico, com 3/18 de 22 entre os dois.
  const bloco = textos(caixa("\\sin x"));
  assert.deepEqual(bloco.map((marca) => marca.texto), ["sen", "x"]);
  assert.equal(bloco[0].italico, false, "o nome da função nunca é itálico");
  assert.equal(bloco[0].peso, 700);
  assert.equal(bloco[1].italico, true, "a variável segue em itálico");
  perto(bloco[1].x - (bloco[0].x + larguraDoTexto("sen", 22, 700)), (3 / 18) * 22);
  // No meio da frase, no peso do texto (400 na aula) e no tamanho dele.
  const linha = textos(emLinha("\\cos x", 16, 400));
  assert.equal(linha[0].texto, "cos");
  assert.equal(linha[0].peso, 400);
  assert.equal(linha[0].tamanho, 16);
  perto(linha[1].x - (linha[0].x + larguraDoTexto("cos", 16, 400)), (3 / 18) * 16);
  // Argumento composto entre parênteses: nada entre o nome e o parêntese ("sen(2x + 1)").
  const composto = textos(caixa("\\sin(2x + 1)"));
  assert.deepEqual(composto.map((marca) => marca.texto).slice(0, 2), ["sen", "("]);
  perto(composto[1].x, composto[0].x + larguraDoTexto("sen", 22, 700));
  // O número que multiplica a função também se afasta dela com o vão fino ("2 sen x"), e um sinal antes dela leva só o respiro do sinal.
  const produto = textos(caixa("2\\sin x"));
  assert.deepEqual(produto.map((marca) => marca.texto), ["2", "sen", "x"]);
  perto(produto[1].x - (produto[0].x + larguraDoTexto("2", 22, 700)), (3 / 18) * 22);
  // O expoente sobe e o índice desce, como em qualquer base; o argumento vem depois, com o vão fino.
  const quadrado = textos(caixa("\\sin^2 x"));
  assert.deepEqual(quadrado.map((marca) => marca.texto), ["sen", "2", "x"]);
  assert.ok(quadrado[1].y < quadrado[0].y, "o 2 sobe");
  assert.ok(quadrado[1].tamanho < quadrado[0].tamanho, "o 2 encolhe");
  const base = textos(caixa("\\log_2 8"));
  assert.deepEqual(base.map((marca) => marca.texto), ["log", "2", "8"]);
  assert.ok(base[1].y > base[0].y, "a base desce: log₂");
});

test("a tela nunca mostra \"sin\" nem \"tan\": todas as funções saem com o nome brasileiro, em qualquer forma de escrever", () => {
  const nomes = { "\\sin x": "sen", "\\cos x": "cos", "\\tan x": "tg", "\\cot x": "cotg", "\\ln x": "ln", "\\log x": "log", "\\arcsin x": "arcsen", "\\arccos x": "arccos", "\\arctan x": "arctg", "sen x": "sen", "sin x": "sen", "tg x": "tg", "tan x": "tg", "\\operatorname{sen} x": "sen" };
  for (const [fonte, nome] of Object.entries(nomes)) {
    const escritos = textos(caixa(fonte)).map((marca) => marca.texto);
    assert.equal(escritos[0], nome, fonte);
    assert.equal(escritos.some((texto) => /sin|tan/.test(texto)), false, fonte);
    assert.deepEqual(semGlifoNaFormula(arvore(fonte)), [], `${fonte}: todo caractere tem glifo`);
  }
});

test("o grau vem colado no número, no tamanho do texto e na linha de base; as letras gregas são retas e têm glifo", () => {
  const grau = textos(caixa("30^\\circ"));
  assert.deepEqual(grau.map((marca) => marca.texto), ["30", "°"]);
  assert.equal(grau[1].tamanho, grau[0].tamanho, "o grau não encolhe como um expoente");
  assert.equal(grau[1].y, grau[0].y, "nem sobe: o glifo já fica no alto da linha");
  perto(grau[1].x, grau[0].x + larguraDoTexto("30", 22, 700));
  assert.deepEqual(textos(caixa("30°")), grau, "30° e 30^\\circ são a mesma coisa");
  for (const letra of "αβγδθλμσφωΣΩ") {
    const escritos = textos(caixa(`${letra} + 1`));
    assert.equal(escritos[0].texto, letra);
    assert.equal(escritos[0].italico, false, `${letra} é reta como o π e o Δ`);
    assert.deepEqual(semGlifoNaFormula(arvore(letra)), [], `${letra} tem glifo`);
  }
  // O ≈ é relação, com o respiro de 5 de cada lado, e tem glifo nos dois pesos.
  const aproximado = textos(caixa("\\pi \\approx 3.14"));
  assert.deepEqual(aproximado.map((marca) => marca.texto), ["π", "≈", "3,14"]);
  const emFrase = textos(emLinha("\\pi \\approx 3.14", 16, 400));
  assert.equal(emFrase[1].peso, 400);
});

test("a faixa do gráfico do seno diz \"h(x) = sen x\" (spec 15, seção 18): o nome reto, nunca \"sin\"", () => {
  const seno = validarVisual({
    tipo: "funcao", alt: "A onda h(x) = sen x de 0 a 2π.",
    curvas: [{ latex: "\\sin x", nome: "h", de: 0, ate: "2\\pi" }, { latex: "\\cos x", nome: "g", de: 0, ate: "2\\pi" }],
    pontos: [{ id: "M", x: "\\frac{\\pi}{2}", y: 1 }],
  });
  assert.equal(seno.ok, true, seno.motivo);
  assert.equal(seno.visual.curvas[0].latex, "\\sin x");
  assert.equal(seno.visual.curvas[1].latex, "\\cos x");
  const desenho = desenharVisual(seno.visual, { tipo: "enunciado" });
  assert.equal(desenho.naoCabe, undefined);
  assert.deepEqual(desenho.textos.slice(0, 7), ["h", "(", "x", ")", "=", "sen", "x"], "primeira linha da faixa");
  assert.deepEqual(desenho.textos.slice(7, 14), ["g", "(", "x", ")", "=", "cos", "x"], "segunda linha da faixa");
  assert.equal(desenho.textos.some((texto) => /sin|tan/.test(texto)), false);
});

test("a tangente e o logaritmo valem na fórmula, mas a curva só sabe seno e cosseno: a figura com elas some, a lição segue", () => {
  for (const latex of ["\\tan x", "\\ln x", "\\log_2 x", "\\arcsin x"]) {
    const visual = validarVisual({ tipo: "funcao", alt: "Uma curva.", curvas: [{ latex }] });
    assert.equal(visual.ok, false, latex);
    assert.match(visual.motivo, /curva|função|índice/, latex);
  }
  // Como fórmula avulsa elas valem (e desenham): "tg x = sen x ÷ cos x".
  const formula = validarVisual({ tipo: "formula", latex: "\\tan x = \\frac{\\sin x}{\\cos x}", alt: "A tangente" });
  assert.equal(formula.ok, true, formula.motivo);
  assert.equal(formula.visual.latex, "\\tan x = \\frac{\\sin x}{\\cos x}");
});
