import assert from "node:assert/strict";
import { test } from "node:test";
import {
  desenharVisual,
  descricaoDaFigura,
  falarFormula,
  falarTextoComFormulas,
  lerFormula,
  textoSemFormulas,
  normalizarResolucao,
  normalizarVisual,
  numeroComPiParaTela,
  rotuloDaFuncao,
  validarResolucao,
  validarVisual,
  visualParaEnunciado,
  visualRevelado,
} from "@studoo/contratos";
import { readFileSync } from "node:fs";

/*
 * Marco 12a (spec 15, seção 15): o gráfico de função no contrato. A IA manda a(s) curva(s) e os pontos de destaque; o servidor refaz as contas
 * (raízes até o grau 2, vértice, intercepto, f(a)), confere o ponto que a IA deu (|f(x) − y| ≤ 0,01), tira o que não está na curva e guarda tudo
 * calculado. O procurado não vai pela rede. Os três casos da spec são o roteiro: a parábola, a reta e o seno.
 */

const parabola = (extra = {}) => ({
  tipo: "funcao",
  alt: "Parábola de f(x) = x² − 4x + 3, com as raízes A e B, o vértice V e o intercepto C.",
  curvas: [{ latex: "x^2 - 4x + 3" }],
  pontos: [{ id: "A", tipo: "raiz" }, { id: "B", tipo: "raiz" }, { id: "V", tipo: "vertice" }, { id: "C", tipo: "intercepto" }],
  ...extra,
});
const valido = (bruto, opcoes) => {
  const resultado = validarVisual(bruto, opcoes);
  assert.equal(resultado.ok, true, resultado.motivo);
  return resultado.visual;
};
const ponto = (visual, id) => visual.pontos.find((candidato) => candidato.id === id);

test("a parábola da spec: as raízes A (1, 0) e B (3, 0), o vértice V (2, −1) e o intercepto C (0, 3) saem calculados e como especial", () => {
  const visual = valido(parabola());
  assert.equal(visual.tipo, "funcao");
  assert.deepEqual(visual.curvas, [{ nome: "f", latex: "x^2 - 4x + 3" }]);
  assert.deepEqual(visual.pontos.map(({ id, papel, tipo, x, y }) => [id, papel, tipo, x, y]), [
    ["A", "especial", "raiz", 1, 0], ["B", "especial", "raiz", 3, 0], ["V", "especial", "vertice", 2, -1], ["C", "especial", "intercepto", 0, 3],
  ]);
  assert.equal("x" in visual && "y" in visual, false, "o gráfico não leva a janela: o motor a escolhe pelo que aparece");
  assert.equal(validarVisual(visual).ok, true, "o que está guardado passa de novo pelo validador");
  assert.deepEqual(normalizarVisual(visual), visual, "e volta igual");
  // A IA pode dar a raiz que quer (x) e o ponto com as coordenadas dele: o que a curva confirma fica.
  const dado = valido(parabola({ pontos: [{ id: "B", tipo: "raiz", x: 3 }, { id: "P", papel: "dado", x: 4, y: 3 }, { id: "Q", x: 2, y: -1 }] }));
  assert.deepEqual(dado.pontos.map(({ id, papel, x, y }) => [id, papel, x, y]), [["B", "especial", 3, 0], ["P", "especial", 4, 3], ["Q", "especial", 2, -1]],
    "todo ponto de um gráfico de função é especial (losango roxo), com ou sem tipo, mesmo que a IA diga \"dado\"");
});

test("todo ponto de uma função é especial por padrão (M, P, N do seno, f(a), o ponto sem tipo); só o procurado e a resposta têm outro papel", () => {
  const seno = valido({
    tipo: "funcao", alt: "A onda.", curvas: [{ latex: "\\sin x", nome: "h", de: 0, ate: "2\\pi" }],
    pontos: [{ id: "M", x: "\\frac{\\pi}{2}", y: 1 }, { id: "P", papel: "dado", x: "\\pi", y: 0 }, { id: "N", papel: "especial", x: "\\frac{3\\pi}{2}", y: -1 }, { id: "R", tipo: "valor", x: 1 }],
  });
  assert.deepEqual(seno.pontos.map(({ id, papel }) => [id, papel]), [["M", "especial"], ["P", "especial"], ["N", "especial"], ["R", "especial"]]);
  const procurado = valido(parabola({ pontos: [{ id: "A", tipo: "raiz", papel: "dado" }, { id: "V", tipo: "vertice", papel: "procurado" }, { id: "C", x: 0, y: 3, papel: "procurado" }] }));
  assert.deepEqual(procurado.pontos.map(({ id, papel }) => [id, papel]), [["A", "especial"], ["V", "procurado"], ["C", "procurado"]]);
  assert.equal(validarVisual(visualRevelado(procurado), { revela: true }).ok, true);
  assert.deepEqual(visualRevelado(procurado).pontos.map(({ papel }) => papel), ["especial", "resposta", "resposta"]);
  // O guardado volta igual do validador (a resposta, que a IA não manda, também vale).
  assert.deepEqual(normalizarVisual(seno), seno);
});

test("a reta da spec: g(x) = 2x + 1 de −2 a 2, com o intercepto C (0, 1) e a raiz R (−0,5; 0)", () => {
  const visual = valido({
    tipo: "funcao", alt: "A reta g(x) = 2x + 1 e os pontos C e R.",
    curvas: [{ latex: "g(x) = 2x+1", nome: "g", de: -2, ate: 2 }],
    pontos: [{ id: "C", tipo: "intercepto" }, { id: "R", tipo: "raiz" }],
  });
  assert.deepEqual(visual.curvas, [{ nome: "g", latex: "2x + 1", de: -2, ate: 2 }], "o `g(x) =` da frente sai e o domínio fica");
  assert.deepEqual(visual.pontos.map(({ id, x, y }) => [id, x, y]), [["C", 0, 1], ["R", -0.5, 0]]);
  assert.equal(rotuloDaFuncao("C", 0, 1), "C (0, 1)");
  assert.equal(rotuloDaFuncao("R", -0.5, 0), "R (−0,5; 0)", "o ponto e vírgula, pela vírgula decimal");
});

test("o seno da spec: h(x) = sen x em [0, 2π], com M (π/2, 1), P (π, 0) e N (3π/2, −1), rótulos com π", () => {
  const visual = valido({
    tipo: "funcao", alt: "A onda h(x) = sen x de 0 a 2π, com o máximo M, a raiz P e o mínimo N.",
    curvas: [{ latex: "\\sin x", nome: "h", de: 0, ate: "2\\pi" }],
    pontos: [{ id: "M", x: "\\frac{\\pi}{2}", y: 1 }, { id: "P", x: "\\pi", y: 0 }, { id: "N", x: "\\frac{3\\pi}{2}", y: -1 }],
  });
  assert.equal(visual.curvas[0].latex, "\\sin x");
  assert.equal(visual.curvas[0].de, 0);
  assert.equal(visual.curvas[0].ate, 6.283185);
  assert.deepEqual(visual.pontos.map(({ id, x, y }) => [id, x, y]), [["M", 1.570796, 1], ["P", 3.141593, 0], ["N", 4.712389, -1]]);
  assert.equal(numeroComPiParaTela(1.570796), "π/2");
  assert.deepEqual([rotuloDaFuncao("M", 1.570796, 1), rotuloDaFuncao("P", 3.141593, 0), rotuloDaFuncao("N", 4.712389, -1)], ["M (π/2, 1)", "P (π, 0)", "N (3π/2, −1)"]);
  assert.deepEqual([0, Math.PI / 4, -Math.PI / 4, (3 * Math.PI) / 4, 2 * Math.PI, 1.5, 0.333].map(numeroComPiParaTela), ["0", "π/4", "−π/4", "3π/4", "2π", "1,5", "0,33"]);
  // A raiz do seno o servidor não calcula: sem x e y dados, o ponto sai; com x e y e a curva confirmando, fica.
  assert.equal(valido({ ...parabola(), curvas: [{ latex: "\\sin x" }], pontos: [{ id: "P", tipo: "raiz" }] }).pontos, undefined);
});

test("o que não está na curva sai sem derrubar a figura: o \"O (0, 0)\" sem a curva passar ali, a raiz fora do domínio, a raiz que não existe, o ponto repetido", () => {
  const visual = valido(parabola({ pontos: [{ id: "O", papel: "dado", x: 0, y: 0 }, { id: "A", tipo: "raiz" }, { id: "B", tipo: "raiz" }, { id: "C", papel: "dado", x: 0, y: 3 }, { id: "D", tipo: "raiz" }, { id: "E", x: 5, y: 8.005 }, { id: "F", x: 4, y: 3.05 }] }));
  assert.deepEqual(visual.pontos.map((p) => p.id), ["A", "B", "C", "E"], "O sai (f(0) = 3), a terceira raiz não existe, F erra por 0,05 e sai, e E fica (f(5) = 8, dentro de 0,01)");
  assert.deepEqual([ponto(visual, "E").x, ponto(visual, "E").y], [5, 8], "o ponto cai na curva: o y que se guarda é o da conta");
  assert.equal(ponto(visual, "C").papel, "especial", "o ponto que a IA deu como dado também sai especial: o círculo azul é do plano de geometria");
  // Domínio mais curto: a raiz 1 fica de fora e a 3 entra.
  const curto = valido(parabola({ curvas: [{ latex: "x^2 - 4x + 3", de: 2, ate: 5 }], pontos: [{ id: "A", tipo: "raiz" }, { id: "B", tipo: "raiz" }, { id: "V", tipo: "vertice" }, { id: "C", tipo: "intercepto" }] }));
  assert.deepEqual(curto.pontos.map(({ id, x }) => [id, x]), [["B", 3], ["V", 2]], "a raiz 1 e o intercepto (0, 3) estão fora do domínio [2, 5]");
  // Raiz dupla, e a parábola sem raiz real.
  assert.deepEqual(valido({ ...parabola(), curvas: [{ latex: "x^2" }], pontos: [{ id: "A", tipo: "raiz" }, { id: "B", tipo: "raiz" }, { id: "V", tipo: "vertice" }, { id: "C", tipo: "intercepto" }] }).pontos.map((p) => p.id), ["A"], "raiz, vértice e intercepto no mesmo lugar: fica o primeiro");
  assert.equal(valido({ ...parabola(), curvas: [{ latex: "x^2 + 1" }], pontos: [{ id: "A", tipo: "raiz" }] }).pontos, undefined, "sem raiz real");
  // f(a): o valor no x dado.
  assert.deepEqual(ponto(valido(parabola({ pontos: [{ id: "P", tipo: "valor", x: 5 }] })), "P"), { id: "P", papel: "especial", tipo: "valor", x: 5, y: 8 });
});

test("a curva que não vale some e a figura segue; sem nenhuma curva, vira plano (se há pontos com x e y) ou some; de 1 a 3 curvas com nomes f, g, h", () => {
  const sem = valido({ tipo: "funcao", alt: "Duas curvas, uma que o Studoo não desenha.", curvas: [{ latex: "\\tan(x)" }, { latex: "x^2" }], pontos: [{ id: "V", tipo: "vertice" }] });
  assert.deepEqual(sem.curvas, [{ nome: "f", latex: "x^2" }], "a tangente sai, e a que fica é a primeira livre");
  assert.equal(ponto(sem, "V").y, 0);
  const plano = valido({ tipo: "funcao", alt: "Os pontos A e B no plano.", curvas: [{ latex: "\\log x" }], pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: 3, y: 1 }] });
  assert.equal(plano.tipo, "plano", "sem curva que valha, os pontos viram um plano");
  assert.equal(plano.pontos.length, 2);
  const nenhum = validarVisual({ tipo: "funcao", alt: "Nada se desenha.", curvas: [{ latex: "\\log x" }], pontos: [{ id: "V", tipo: "vertice" }] });
  assert.equal(nenhum.ok, false);
  assert.match(nenhum.motivo, /nenhuma curva que valha/);
  const tres = valido({ tipo: "funcao", alt: "Três curvas.", curvas: [{ latex: "x/2" }, { latex: "x^2/4" }, { latex: "x^3/8" }, { latex: "5" }] });
  assert.deepEqual(tres.curvas.map((curva) => curva.nome), ["f", "g", "h"], "no máximo três, com as letras na ordem");
  const nomes = valido({ tipo: "funcao", alt: "Nomes pedidos.", curvas: [{ latex: "x", nome: "h" }, { latex: "x^2", nome: "h" }] });
  assert.deepEqual(nomes.curvas.map((curva) => curva.nome), ["h", "f"], "o nome repetido cai na próxima letra livre");
  // Com mais de uma curva, cada ponto diz de qual é.
  const duas = valido({ tipo: "funcao", alt: "Duas curvas.", curvas: [{ latex: "x^2 - 1" }, { latex: "x + 1", nome: "g" }], pontos: [{ id: "A", tipo: "raiz", curva: "g" }, { id: "B", tipo: "intercepto" }] });
  assert.deepEqual(duas.pontos.map(({ id, curva, x, y }) => [id, curva, x, y]), [["A", "g", -1, 0], ["B", "f", 0, -1]]);
});

test("o procurado não vai pela rede: o enunciado sem a posição dele, o alt que a entrega é recusado, e o retorno revela e descreve pelos dados", () => {
  const completo = valido(parabola({ pontos: [{ id: "A", tipo: "raiz" }, { id: "B", tipo: "raiz" }, { id: "V", papel: "procurado", tipo: "vertice" }, { id: "C", tipo: "intercepto" }], alt: "Parábola de f(x) = x² − 4x + 3 com A, B e C; o vértice é o procurado." }));
  assert.equal(ponto(completo, "V").papel, "procurado");
  assert.deepEqual([ponto(completo, "V").x, ponto(completo, "V").y], [2, -1], "o servidor guarda a posição");
  const publico = visualParaEnunciado(completo);
  assert.deepEqual(Object.keys(ponto(publico, "V")).sort(), ["id", "papel", "tipo"], "no enunciado público, o procurado não leva x nem y");
  assert.deepEqual([ponto(publico, "C").x, ponto(publico, "C").y], [0, 3], "os outros pontos levam as coordenadas");
  assert.equal(publico.curvas[0].latex, "x^2 - 4x + 3", "a expressão é o enunciado: ela vai");
  // O alt que traz a coordenada do procurado é recusado, como no plano.
  const vaza = validarVisual(parabola({ pontos: [{ id: "V", papel: "procurado", tipo: "vertice" }], alt: "Parábola com o vértice V (2, −1)." }));
  assert.equal(vaza.ok, false);
  assert.match(vaza.motivo, /alt: entrega a posição do ponto procurado/);
  assert.equal(validarVisual(parabola({ pontos: [{ id: "V", papel: "procurado", tipo: "vertice" }], alt: "Parábola com x_V = 2." })).ok, false, "a abscissa dita por extenso também vaza");
  // Revelado: o procurado vira resposta, e o alt é a frase montada dos dados.
  const revelado = visualRevelado(completo);
  assert.equal(ponto(revelado, "V").papel, "resposta");
  assert.equal(revelado.alt, "Gráfico de $f(x) = x^2 - 4x + 3$, com a raiz $A(1, 0)$, a raiz $B(3, 0)$, o intercepto $C(0, 3)$ e o vértice $V(2, -1)$.");
  // O enunciado público leva o alt montado dos dados, com o procurado sem posição (nunca o texto solto da IA).
  assert.equal(publico.alt, "Gráfico de $f(x) = x^2 - 4x + 3$, com a raiz $A(1, 0)$, a raiz $B(3, 0)$, o intercepto $C(0, 3)$ e o vértice procurado $V$.");
  assert.equal(descricaoDaFigura(revelado), revelado.alt);
  assert.equal(visualRevelado(visualRevelado(completo)).alt, revelado.alt, "revelar de novo não muda");
  // Quem revela (o último passo, o retorno) valida o alt com a posição.
  assert.equal(validarVisual(parabola({ pontos: [{ id: "V", papel: "resposta", tipo: "vertice" }], alt: "O vértice V (2, −1)." }), { revela: true }).ok, true);
});

test("o gráfico de função ainda não vale no \"Resolva comigo\" (marco 12b): como figura do problema ele some e o exemplo segue; como passo, é recusado", () => {
  const base = JSON.parse(readFileSync(new URL("./fixtures/matematica/baricentro.json", import.meta.url), "utf8")).licao.resolucao;
  const comFuncao = { ...base, visual: parabola() };
  const lida = validarResolucao(comFuncao);
  assert.equal(lida.ok, true, lida.motivo);
  assert.equal(lida.resolucao.visual, undefined, "a figura do problema era uma função: some");
  assert.ok(normalizarResolucao(comFuncao));
  const passoComFuncao = { ...base, passos: base.passos.map((passo, posicao) => (posicao === 1 ? { ...passo, visual: parabola() } : passo)) };
  const doPasso = validarResolucao(passoComFuncao);
  assert.equal(doPasso.ok, true, doPasso.motivo);
  assert.equal(doPasso.resolucao.passos[1].visual, undefined, "a figura do passo era uma função: some");
});

test("12a, grupo 5: o alt marca a fórmula com $…$ (desenhada em linha e falada pela árvore) e a fala diz \"f de x\", \"seno de x\", \"pi sobre 2\" e \"V de coordenadas 2 e menos 1\"", () => {
  const fala = (latex) => falarFormula(lerFormula(latex).arvore);
  assert.equal(fala("f(x) = x^2 - 4x + 3"), "f de x é igual a x ao quadrado, menos 4 x, mais 3");
  assert.equal(fala("h(x) = \\sin x"), "h de x é igual a seno de x");
  assert.equal(fala("g(2) = 5"), "g de 2 é igual a 5");
  assert.equal(fala("f(x + 1)"), "f de x mais 1");
  assert.equal(fala("V(2, -1)"), "V de coordenadas 2 e menos 1");
  assert.equal(fala("M(\\frac{\\pi}{2}, 1)"), "M de coordenadas pi sobre 2 e 1");
  assert.equal(fala("N(\\frac{3\\pi}{2}, -1)"), "N de coordenadas 3 pi sobre 2 e menos 1");
  assert.equal(fala("R(-0.5; 0)"), "R de coordenadas menos 0,5 e 0");
  assert.equal(fala("A(1, 2, 3)"), "A de coordenadas 1, 2 e 3");
  // O que não é função nem ponto fica como estava: a conta com a letra e o parêntese, o produto, o par depois do "=".
  assert.equal(fala("C = (4, 0)"), "C é igual a abre parênteses 4, 0 fecha parênteses");
  assert.equal(fala("a(b + c)"), "a abre parênteses b mais c fecha parênteses");
  assert.equal(fala("2(x + 1)"), "2 abre parênteses x mais 1 fecha parênteses");
  // O seno: o alt do enunciado leva as fórmulas marcadas; sem desenhar, lê "h(x) = sen x"; falado, "seno de x".
  const seno = valido({
    tipo: "funcao", alt: "Uma onda qualquer escrita pela IA, sem fórmula.", curvas: [{ latex: "\\sin x", nome: "h", de: 0, ate: "2\\pi" }],
    pontos: [{ id: "M", x: "\\frac{\\pi}{2}", y: 1 }, { id: "N", x: "\\frac{3\\pi}{2}", y: -1 }],
  });
  const publico = visualParaEnunciado(seno);
  assert.equal(publico.alt, "Gráfico de $h(x) = \\sin x$, com o ponto $M(\\frac{\\pi}{2}, 1)$ e o ponto $N(\\frac{3\\pi}{2}, -1)$.");
  assert.equal(textoSemFormulas(publico.alt), "Gráfico de h(x) = sen x, com o ponto M(π/2, 1) e o ponto N(3π/2, −1).");
  assert.equal(falarTextoComFormulas(publico.alt), "Gráfico de h de x é igual a seno de x, com o ponto M de coordenadas pi sobre 2 e 1 e o ponto N de coordenadas 3 pi sobre 2 e menos 1.");
  // A descrição que o desenho entrega ao leitor de tela já é a fala (nenhum cifrão, nenhuma barra): os clientes que a usam não mudam nada.
  const desenho = desenharVisual(publico, { tipo: "enunciado" });
  assert.equal(desenho.descricao, falarTextoComFormulas(publico.alt));
  assert.equal(/[$\\]/.test(desenho.descricao), false);
  // O decimal leva o ponto e vírgula, e a fórmula do alt é sempre uma fórmula que lê (a que o motor e o leitor de tela entendem).
  const reta = valido({ tipo: "funcao", alt: "Reta.", curvas: [{ latex: "2x + 1", nome: "g", de: -2, ate: 2 }], pontos: [{ id: "C", tipo: "intercepto" }, { id: "R", tipo: "raiz" }] });
  assert.equal(visualParaEnunciado(reta).alt, "Gráfico de $g(x) = 2x + 1$, com o intercepto $C(0, 1)$ e a raiz $R(-0.5; 0)$.");
  assert.equal(textoSemFormulas(visualParaEnunciado(reta).alt), "Gráfico de g(x) = 2x + 1, com o intercepto C(0, 1) e a raiz R(−0,5; 0).");
  for (const visual of [seno, reta]) {
    for (const [, formula] of visualParaEnunciado(visual).alt.matchAll(/\$([^$]+)\$/g)) assert.equal(lerFormula(formula).ok, true, formula);
  }
  // O alt que o cliente sem o campo mostra (o que não desenha) nunca deixa o cifrão: a prancheta do PNG usa o alt solto da IA, sem marca.
  assert.equal(seno.alt.includes("$"), false, "o que se guarda é o alt da IA, sem marca");
});
