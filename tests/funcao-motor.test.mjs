import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PISO_DO_TEXTO,
  TETO_DE_PRIMITIVAS,
  desenharVisual,
  desenhoParaSvg,
  validarVisual,
  visualParaEnunciado,
  visualRevelado,
} from "@studoo/contratos";
import { lerExpressaoDaFuncao } from "../packages/contratos/src/funcao-expressao.ts";
import { janelaDaFuncao, trechosDaCurva } from "../packages/contratos/src/funcao-janela.ts";

/*
 * Marco 12a, o motor do gráfico de função (spec 15, seção 15): a janela é a conta exata da seção 2, a curva é amostrada e recortada na borda, o
 * seno e o cosseno marcam o x em π/2 com escalas independentes, a faixa de cima leva uma fórmula por curva e a curva NÃO aparece no enunciado de
 * um exercício que pergunta um ponto dela. Os três casos da spec vêm das fixtures `tests/fixtures/matematica-funcao`.
 */

const fixture = (nome) => JSON.parse(readFileSync(new URL(`./fixtures/matematica-funcao/${nome}.json`, import.meta.url), "utf8"));
const caso = (nome) => fixture(nome).guardado;
const modeloDe = (latex) => {
  const lida = lerExpressaoDaFuncao(latex);
  assert.equal(lida.ok, true, lida.erro);
  return lida.modelo;
};
const perto = (valor, esperado, mensagem = "") => assert.ok(Math.abs(valor - esperado) < 1e-6, `${mensagem} ${valor} ≠ ${esperado}`);
const caminhosDaCurva = (desenho) => desenho.primitivas.filter((primitiva) => primitiva.tipo === "caminho" && primitiva.larguraDaBorda === 3 && primitiva.borda !== "branco");
const textosDas = (desenho, tipo) => desenho.caixas.filter((caixa) => caixa.tipo === tipo).map((caixa) => caixa.texto);

test("as fixtures dos três casos são o que o validador guarda (e o Mobile 2 as usa para capturar)", () => {
  for (const nome of ["parabola", "reta", "seno"]) {
    const { bruto, guardado } = fixture(nome);
    assert.deepEqual(validarVisual(bruto).visual, guardado, nome);
  }
  const { exercicioDoVertice } = fixture("parabola");
  assert.deepEqual(validarVisual(exercicioDoVertice.bruto).visual, exercicioDoVertice.guardado);
  assert.equal(exercicioDoVertice.guardado.pontos.find((ponto) => ponto.id === "V").papel, "procurado");
});

test("a janela é a conta da seção 2: x é o domínio ± 0,5, y é máx(mín(C, D) − f; mín(D) − 3) até mín(máx(C, D) + f; máx(D) + 3)", () => {
  // Parábola: domínio [−1, 4] (os destaques com uma unidade de folga), y de −2 a 6, e o 8 de f(−1) fica recortado em 6.
  const parabola = janelaDaFuncao([{ modelo: modeloDe("x^2 - 4x + 3") }], [[1, 0], [3, 0], [2, -1], [0, 3]], true);
  assert.deepEqual(parabola.x, [-1.5, 4.5]); assert.deepEqual(parabola.y, [-2, 6]); assert.equal(parabola.trigonometrica, false);
  assert.deepEqual(parabola.dominios, [[-1, 4]]);
  // Reta g de −2 a 2, com C (0, 1) e R (−0,5; 0): a conta exata dá −3 a 4 (o exemplo antigo da spec dizia −4 a 6; o Designer corrigiu).
  const reta = janelaDaFuncao([{ modelo: modeloDe("2x+1"), de: -2, ate: 2 }], [[0, 1], [-0.5, 0]], true);
  assert.deepEqual(reta.x, [-2.5, 2.5]); assert.deepEqual(reta.y, [-3, 4]);
  // Seno em [0, 2π] com M, P e N: f é metade da amplitude (0,5), y de −1,5 a 1,5, e as escalas são independentes.
  const seno = janelaDaFuncao([{ modelo: modeloDe("\\sin x"), de: 0, ate: 2 * Math.PI }], [[Math.PI / 2, 1], [Math.PI, 0], [(3 * Math.PI) / 2, -1]], true);
  perto(seno.x[0], -0.5); perto(seno.x[1], 2 * Math.PI + 0.5); perto(seno.y[0], -1.5); perto(seno.y[1], 1.5);
  assert.equal(seno.trigonometrica, true);
  // Sem domínio: o seno vale [0, 2π]; a parábola, dos destaques com folga e no mínimo 4 de largura.
  assert.deepEqual(janelaDaFuncao([{ modelo: modeloDe("\\cos x") }], [], true).dominios, [[0, 2 * Math.PI]]);
  assert.deepEqual(janelaDaFuncao([{ modelo: modeloDe("x^2") }], [[0, 0]], true).dominios, [[-2, 2]], "um ponto só: o mínimo de 4 de largura");
  assert.deepEqual(janelaDaFuncao([{ modelo: modeloDe("x^2") }], [], true).dominios, [[-2, 2]]);
  // Curva escondida (o exercício pergunta um ponto dela): a janela é a dos pontos que aparecem, nunca a da curva (a curva iria até 8).
  const escondida = janelaDaFuncao([{ modelo: modeloDe("x^2 - 4x + 3") }], [[1, 0], [3, 0], [0, 3]], false);
  assert.deepEqual(escondida.y, [-1, 4]);
  // Sem destaques: a curva com uma unidade de folga.
  assert.deepEqual(janelaDaFuncao([{ modelo: modeloDe("2x+1"), de: -1, ate: 1 }], [], true).y, [-2, 4]);
});

test("a curva: no mínimo 64 pontos, recortada na borda (sem seta), a raiz nasce onde o radicando é zero, o domínio mais curto acaba nas pontas", () => {
  const modelo = modeloDe("x^2 - 4x + 3");
  const trechos = trechosDaCurva(modelo, -1, 4, [-2, 6], 100);
  assert.equal(trechos.length, 1, "um só traço: a curva sai pela borda de cima na ponta esquerda e não volta a sair");
  const [primeiro, ...resto] = trechos[0];
  perto(primeiro[1], 6, "começa na borda, em y = 6");
  perto(primeiro[0], (4 - Math.sqrt(28)) / 2, "no x em que f vale 6");
  assert.deepEqual(trechos[0].at(-1), [4, 3], "e acaba na ponta do domínio, sem bolinha");
  assert.ok(trechos[0].length >= 64, `${trechos[0].length} pontos`);
  assert.ok(trechos[0].every(([, y]) => y >= -2 - 1e-9 && y <= 6 + 1e-9), "nada passa da borda");
  assert.ok(resto.length > 60);
  // Pelo menos 64 pontos mesmo com poucos pedidos, e as abscissas dos destaques entram.
  assert.ok(trechosDaCurva(modeloDe("x"), -3, 3, [-4, 4], 2)[0].length >= 2);
  assert.ok(trechosDaCurva(modelo, -1, 4, [-2, 9], 100, [1, 3]).flat().some(([x]) => x === 1), "o destaque em x = 1 é uma amostra");
  // A raiz começa onde o radicando é zero (x = 1) e não existe antes: nem traço, nem ponto.
  const raiz = trechosDaCurva(modeloDe("\\sqrt{x - 1}"), -2, 5, [-5, 5], 80);
  assert.equal(raiz.length, 1);
  assert.deepEqual(raiz[0][0], [1, 0], "nasce em (1, 0)");
  assert.ok(raiz[0].every(([x]) => x >= 1));
  // Dentro e fora da janela: a curva que passa duas vezes pela borda dá dois traços.
  assert.equal(trechosDaCurva(modeloDe("\\sin x"), 0, 4 * Math.PI, [-0.5, 0.5], 200).length, 5, "a onda recortada em ±0,5 tem um trecho por passagem pelo zero: 0, π, 2π, 3π e 4π");
});

test("a parábola: a curva em azul, os destaques em losango, o nome f perto da ponta direita, a faixa de cima com f(x) = x² − 4x + 3", () => {
  const desenho = desenharVisual(caso("parabola"), { tipo: "enunciado" });
  assert.ok(desenho && !desenho.naoCabe);
  const curva = caminhosDaCurva(desenho);
  assert.equal(curva.length, 1, "uma curva em um traço só (recortada em 6 na ponta esquerda)");
  assert.equal(curva[0].borda, "segmento", "a curva 1 é o azul #2563FF");
  assert.equal(curva[0].tracejado, undefined);
  assert.ok(desenho.menorTexto >= PISO_DO_TEXTO, `o texto nunca desce do piso de 13: ${desenho.menorTexto}`);
  assert.ok(desenho.primitivas.length <= TETO_DE_PRIMITIVAS);
  assert.deepEqual(textosDas(desenho, "rotulo").sort(), ["A (1, 0)", "B (3, 0)", "C (0, 3)", "V (2, −1)", "f"].sort());
  assert.ok(["−1", "4"].every((numero) => textosDas(desenho, "numero").includes(numero)), "os números das pontas do eixo x (os do meio, sob um losango, saem pela regra do ponto sobre o número)");
  // A faixa de cima: a fórmula na cor da curva e a linha #E1E7FA que a separa do gráfico.
  assert.ok(desenho.primitivas.some((primitiva) => primitiva.tipo === "caminho" && primitiva.preenchimento === "segmento"), "a fórmula da faixa, na cor da curva");
  assert.ok(desenho.primitivas.some((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "separador" && primitiva.x1 === 0 && primitiva.x2 === 320));
  assert.match(desenhoParaSvg(desenho), /<svg/);
});

test("o exercício que pergunta o vértice: o enunciado SEM a curva (a fórmula, os pontos dados e \"V = ?\"), o retorno com a curva e o V como resposta", () => {
  const { exercicioDoVertice } = fixture("parabola");
  const publico = visualParaEnunciado(exercicioDoVertice.guardado);
  const enunciado = desenharVisual(publico, { tipo: "enunciado" });
  assert.equal(caminhosDaCurva(enunciado).length, 0, "no enunciado a curva não aparece: ler a ponta da parábola entregaria a resposta");
  assert.ok(enunciado.primitivas.some((primitiva) => primitiva.tipo === "caminho" && primitiva.preenchimento === "segmento"), "mas a fórmula aparece, na faixa de cima");
  assert.deepEqual(textosDas(enunciado, "rotulo").sort(), ["A (1, 0)", "B (3, 0)", "C (0, 3)"], "nem o rótulo do V, nem o nome da curva");
  assert.ok(enunciado.textos.includes("V = ?"), "o procurado fica só na legenda");
  assert.equal(desenhoParaSvg(enunciado).includes("V (2"), false);
  const retorno = desenharVisual(visualRevelado(exercicioDoVertice.guardado), { tipo: "retorno" });
  assert.equal(caminhosDaCurva(retorno).length, 1, "no retorno a curva entra, reenquadrada");
  assert.ok(textosDas(retorno, "rotulo").some((texto) => texto.startsWith("V (2")), "e o V já é a resposta, com a posição");
  assert.ok(retorno.primitivas.some((primitiva) => primitiva.tipo === "circulo" && primitiva.preenchimento === "resposta"));
  // O desenho do enunciado de um servidor que mandou o gráfico COMPLETO (guardado) esconde a mesma curva: o motor não depende do cliente ter tirado a posição.
  assert.equal(caminhosDaCurva(desenharVisual(exercicioDoVertice.guardado, { tipo: "enunciado" })).length, 0);
});

test("a reta: o nome g, o intercepto C (0, 1) e a raiz R (−0,5; 0); a escala é igual em x e em y", () => {
  const desenho = desenharVisual(caso("reta"), { tipo: "enunciado" });
  assert.ok(!desenho.naoCabe);
  assert.deepEqual(textosDas(desenho, "rotulo").sort(), ["C (0, 1)", "R (−0,5; 0)", "g"].sort());
  // Escala igual: as linhas da grade têm o mesmo passo na horizontal e na vertical.
  const grade = desenho.primitivas.filter((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "grade");
  const verticais = grade.filter((linha) => linha.x1 === linha.x2).map((linha) => linha.x1).sort((a, b) => a - b);
  const horizontais = grade.filter((linha) => linha.y1 === linha.y2).map((linha) => linha.y1).sort((a, b) => a - b);
  assert.ok(Math.abs(verticais[1] - verticais[0] - (horizontais[1] - horizontais[0])) < 0.05, "o passo da grade é o mesmo em x e em y");
});

test("o seno: x marcado em 0, π/2, π, 3π/2 e 2π, y em −1, 0 e 1, escalas independentes (altura ≈ metade da largura) e rótulos com π", () => {
  const desenho = desenharVisual(caso("seno"), { tipo: "enunciado" });
  assert.ok(!desenho.naoCabe);
  assert.deepEqual(textosDas(desenho, "numero").sort(), ["−1", "1", "0", "π/2", "π", "3π/2", "2π"].sort());
  assert.deepEqual(textosDas(desenho, "rotulo").sort(), ["M (π/2, 1)", "N (3π/2, −1)", "P (π, 0)", "h"].sort());
  const grade = desenho.primitivas.filter((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "grade");
  const verticais = grade.filter((linha) => linha.x1 === linha.x2);
  const horizontais = grade.filter((linha) => linha.y1 === linha.y2);
  assert.equal(verticais.length, 5, "uma linha de π/2 em π/2 (0, π/2, π, 3π/2, 2π)");
  const largura = Math.max(...horizontais.map((linha) => linha.x2)) - Math.min(...horizontais.map((linha) => linha.x1));
  const altura = Math.max(...verticais.map((linha) => linha.y2)) - Math.min(...verticais.map((linha) => linha.y1));
  assert.ok(altura / largura > 0.35 && altura / largura < 0.65, `a altura do gráfico é cerca de metade da largura: ${altura.toFixed(1)} / ${largura.toFixed(1)}`);
  assert.ok(desenho.altura < 280, "o desenho é mais baixo que o plano de sempre (320)");
});

test("até três curvas, em azul, roxo e azul-marinho tracejado (6 e 4), cada uma com o nome e a fórmula dela na faixa de cima", () => {
  const validado = validarVisual({
    tipo: "funcao", alt: "Uma parábola e duas retas.", curvas: [{ latex: "x^2 - 2" }, { latex: "x", nome: "g" }, { latex: "-x + 2", nome: "h" }],
    pontos: [{ id: "V", tipo: "vertice", curva: "f" }],
  });
  assert.equal(validado.ok, true, validado.motivo);
  const desenho = desenharVisual(validado.visual, { tipo: "enunciado" });
  const curvas = caminhosDaCurva(desenho);
  assert.deepEqual([...new Set(curvas.map((curva) => curva.borda))], ["segmento", "especialTexto", "texto"]);
  assert.deepEqual(curvas.filter((curva) => curva.tracejado).map((curva) => [curva.borda, curva.tracejado]), [["texto", [6, 4]]], "só a terceira é tracejada");
  assert.deepEqual(textosDas(desenho, "rotulo").filter((texto) => ["f", "g", "h"].includes(texto)).sort(), ["f", "g", "h"]);
  for (const cor of ["segmento", "especialTexto", "texto"]) {
    assert.ok(desenho.primitivas.some((primitiva) => primitiva.tipo === "caminho" && primitiva.preenchimento === cor), `a fórmula na cor ${cor}`);
  }
});

test("o que não cabe: a faixa com fórmula larga demais e a grade de π/2 abaixo de 12 de passo tiram a figura inteira (o validador a recusa)", () => {
  const larga = validarVisual({ tipo: "funcao", alt: "Uma fórmula comprida.", curvas: [{ latex: "123.45x^3 + 123.45x^2 + 123.45x + 123.45" }] });
  assert.equal(larga.ok, false);
  assert.match(larga.motivo, /não cabe na altura da figura/);
  const seno = validarVisual({ tipo: "funcao", alt: "Uma onda comprida.", curvas: [{ latex: "\\sin x", de: 0, ate: 40 }] });
  assert.equal(seno.ok, false, "a grade de π/2 em 40 unidades de x fica abaixo de 12 de passo");
});

test("o desenho é puro e estável: o mesmo gráfico dá o mesmo desenho, sem a posição do procurado escapar pelas primitivas", () => {
  const visual = caso("seno");
  const a = JSON.stringify(desenharVisual(visual, { tipo: "enunciado" }));
  const b = JSON.stringify(desenharVisual(visual, { tipo: "enunciado" }));
  assert.equal(a, b);
  const { exercicioDoVertice } = fixture("parabola");
  const sem = JSON.stringify(desenharVisual(visualParaEnunciado(exercicioDoVertice.guardado), { tipo: "enunciado" }).primitivas);
  const com = JSON.stringify(desenharVisual(exercicioDoVertice.guardado, { tipo: "enunciado" }).primitivas);
  assert.equal(sem, com, "o enunciado é o mesmo com a posição do procurado ou sem ela");
});
