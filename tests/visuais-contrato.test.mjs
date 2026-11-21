import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CABECALHO_CAPACIDADES,
  CAPACIDADES_DESTE_CLIENTE,
  LIMITES_VISUAIS,
  cabecalhoDeCapacidades,
  conferirConta,
  formulaLinear,
  lerCapacidades,
  lerFormula,
  normalizarFigura,
  normalizarResolucao,
  normalizarVisual,
  normalizarVisuais,
  passosEmTexto,
  pontoApareceNaPosicao,
  resolucaoParaCliente,
  responderSuaVez,
  validarResolucao,
  validarVisual,
  comDescricaoDaResposta,
  descricaoDaFigura,
  visualParaEnunciado,
  visualRevelado,
} from "@studoo/contratos";
import { conteudoValido } from "../src/dominio/aprendizado/plano.ts";

const NOMES = ["baricentro", "abscissas", "colinearidade"];
const fixture = (nome) => JSON.parse(readFileSync(new URL(`./fixtures/matematica/${nome}.json`, import.meta.url), "utf8"));
const copia = (valor) => JSON.parse(JSON.stringify(valor));

const plano = (extra = {}) => ({
  tipo: "plano",
  alt: "Os pontos A e B no plano.",
  pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: -2, y: 7 }],
  ...extra,
});
const reta = (extra = {}) => ({
  tipo: "reta_numerica",
  alt: "Reta com A em 3 e B em 5.",
  pontos: [{ id: "A", valor: 3 }, { id: "B", valor: 5 }],
  ...extra,
});

const recusado = (bruto, opcoes) => {
  const resultado = validarVisual(bruto, opcoes);
  assert.equal(resultado.ok, false, `devia recusar ${JSON.stringify(bruto).slice(0, 120)}`);
  return resultado.motivo;
};

/* ----- Cabeçalho de capacidades ----- */

test("X-Studoo-Capacidades: lista com versão, desconhecidos ignorados, o servidor responde pelo menor", () => {
  assert.equal(CABECALHO_CAPACIDADES, "X-Studoo-Capacidades");
  assert.equal(CAPACIDADES_DESTE_CLIENTE, "visuais@1,resolucao@1");
  assert.deepEqual(lerCapacidades("visuais@1,resolucao@1"), { visuais: 1, resolucao: 1 });
  assert.deepEqual(lerCapacidades(" Visuais@1 , RESOLUCAO@1 "), { visuais: 1, resolucao: 1 });
  assert.deepEqual(lerCapacidades("visuais@1"), { visuais: 1, resolucao: 0 });
  assert.deepEqual(lerCapacidades("resolucao@1"), { visuais: 0, resolucao: 0 }, "a resolução só vale junto dos visuais");
  assert.deepEqual(lerCapacidades("visuais@2,resolucao@3"), { visuais: 2, resolucao: 1 }, "versão acima do que o servidor sabe vira a dele (visuais@2 é o gráfico de função)");
  assert.deepEqual(lerCapacidades("visuais@3"), { visuais: 2, resolucao: 0 }, "e acima de 2, o 2 do servidor");
  assert.deepEqual(lerCapacidades("visuais@2,resolucao@3", { visuais: 2, resolucao: 3 }), { visuais: 2, resolucao: 3 });
  assert.deepEqual(lerCapacidades("visuais@1,visuais@2", { visuais: 2, resolucao: 1 }), { visuais: 2, resolucao: 0 }, "versões cumulativas: vale a maior");
  assert.deepEqual(lerCapacidades("grafico@1,visuais@1,x,@1"), { visuais: 1, resolucao: 0 }, "entradas desconhecidas são ignoradas");
  for (const ruim of [undefined, null, "", "visuais", "visuais@", "visuais@0", "visuais@-1", "visuais@x", "@1", "visuais@1@2", "visuais@100", 4]) {
    assert.deepEqual(lerCapacidades(ruim), { visuais: 0, resolucao: 0 }, `ruim: ${String(ruim)}`);
  }
  assert.deepEqual(lerCapacidades(`visuais@1,${"x".repeat(300)}`), { visuais: 0, resolucao: 0 }, "cabeçalho enorme é ignorado");
  assert.equal(cabecalhoDeCapacidades({ visuais: 1, resolucao: 1 }), "visuais@1,resolucao@1");
  assert.equal(cabecalhoDeCapacidades({ visuais: 1 }), "visuais@1");
  assert.equal(cabecalhoDeCapacidades({ visuais: 0, resolucao: 1 }), "resolucao@1");
  assert.equal(cabecalhoDeCapacidades({}), "");
});

/* ----- Visuais ----- */

test("as três fixtures normalizam: derivados calculados pelo servidor, eixos guardados e lição que continua válida", () => {
  const { licao } = fixture("baricentro");
  const visuais = normalizarVisuais(licao.visuais);
  assert.deepEqual(visuais.map((visual) => visual.tipo), ["formula", "plano"]);
  assert.deepEqual(visuais[0], { tipo: "formula", latex: String.raw`x_G = \frac{x_A + x_B + x_C}{3}`, alt: "Fórmula do baricentro" });
  assert.deepEqual(visuais[1], {
    tipo: "plano",
    alt: "Triângulo ABC no plano, com A (1, 2), B (−2, 7) e o baricentro G (1, 3); C é o vértice procurado.",
    x: [-3, 5],
    y: [-1, 8],
    pontos: [
      { id: "A", papel: "dado", x: 1, y: 2 },
      { id: "B", papel: "dado", x: -2, y: 7 },
      { id: "C", papel: "procurado", x: 4, y: 0 },
      { id: "G", papel: "especial", x: 1, y: 3, derivado: { tipo: "baricentro", de: ["A", "B", "C"] } },
    ],
    poligonos: [{ pontos: ["A", "B", "C"] }],
  });

  const abscissas = normalizarVisuais(fixture("abscissas").licao.visuais)[1];
  assert.equal(abscissas.tipo, "reta_numerica");
  assert.deepEqual([abscissas.de, abscissas.ate], [0, 8]);
  assert.deepEqual(abscissas.pontos.map((ponto) => [ponto.id, ponto.papel, ponto.valor]), [["A", "dado", 3], ["B", "dado", 5], ["C", "procurado", 4], ["G", "especial", 4]]);

  for (const nome of NOMES) {
    const { licao: conteudo } = fixture(nome);
    assert.equal(conteudoValido(conteudo), true, `${nome}: a lição tem de continuar válida`);
    assert.equal(validarVisual(conteudo.exercicio.visual).ok, true, `${nome}: visual do exercício`);
    assert.equal(validarResolucao(conteudo.resolucao).ok, true, `${nome}: resolução`);
  }
});

test("a lição fica quando o visual é inválido: o visual some, sem derrubar nada", () => {
  const { licao } = fixture("baricentro");
  const estragado = copia(licao);
  estragado.visuais = [{ tipo: "plano", alt: "x", pontos: [] }, { tipo: "grafico_funcao" }, 7, null, licao.visuais[0]];
  estragado.exercicio.visual = { tipo: "plano", alt: "sem pontos", pontos: "A" };
  assert.deepEqual(normalizarVisuais(estragado.visuais).map((visual) => visual.tipo), ["formula"]);
  assert.equal(normalizarVisual(estragado.exercicio.visual), null);
  assert.equal(conteudoValido(estragado), true, "a lição estragada continua válida (o validador estrito está na geração)");
  assert.equal(conteudoValido({ ...licao, visuais: "lixo", resolucao: 5 }), true);
  assert.equal(normalizarVisuais([{ tipo: "plano" }]), undefined);
  assert.equal(normalizarVisuais("lixo"), undefined);
  assert.equal(normalizarVisuais(undefined), undefined);
  assert.equal(normalizarVisuais(null), undefined);
  assert.equal(normalizarVisuais(Array.from({ length: 5 }, () => licao.visuais[0])).length, LIMITES_VISUAIS.visuaisPorLicao, "no máximo 3");
  for (const lixo of [null, undefined, 5, "plano", [], {}, { tipo: "svg", d: "M0 0" }, { tipo: "plano", pontos: [{ id: "A" }] }]) {
    assert.equal(normalizarVisual(lixo), null);
  }
});

test("eixos: a janela do plano é a dos dados com uma unidade de folga e a origem (a da IA não conta); a da reta vale se couber", () => {
  const ajustado = normalizarVisual(plano());
  assert.deepEqual([ajustado.x, ajustado.y], [[-3, 2], [-1, 8]]);
  const reta1 = normalizarVisual(reta());
  assert.deepEqual([reta1.de, reta1.ate], [2, 6]);
  // A janela que a IA manda no plano não vale, boa ou ruim: sem unidade vazia o gráfico estreita em vez de encolher a escala.
  for (const mandada of [{ x: [-5, 5], y: [-5, 10] }, { x: [0, 1] }, { x: [3, -3] }, { y: [1] }, { x: [-3, "a"] }, { x: [-100, 100], y: [-100, 100] }]) {
    const visual = normalizarVisual(plano(mandada));
    assert.deepEqual([visual.x, visual.y], [[-3, 2], [-1, 8]], JSON.stringify(mandada));
  }
  // A janela guardada é a de TODOS os dados, o procurado incluído; a do enunciado, a dos pontos que aparecem (a outra entregaria o procurado).
  const comProcurado = normalizarVisual(plano({ pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: -2, y: 7 }, { id: "C", papel: "procurado", x: 9, y: -4 }] }));
  assert.deepEqual([comProcurado.x, comProcurado.y], [[-3, 10], [-5, 8]], "o guardado inclui o procurado");
  const publico = visualParaEnunciado(comProcurado);
  assert.deepEqual([publico.x, publico.y], [[-3, 2], [-1, 8]], "o do enunciado não tem o procurado");
  assert.equal(JSON.stringify(publico).includes("9"), false, "e o 9 do procurado não está em lugar nenhum do enunciado");
  const outroLugar = visualParaEnunciado(normalizarVisual(plano({ pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: -2, y: 7 }, { id: "C", papel: "procurado", x: -8, y: 15 }] })));
  assert.deepEqual(outroLugar, publico, "mudar o procurado de lugar não muda o enunciado");
  assert.match(recusado(reta({ de: 4, ate: 10 })), /fora do intervalo/);
  assert.deepEqual(normalizarVisual(reta({ de: 0, ate: 8 })).de, 0);
  // Pontos colados na origem: o intervalo ainda tem largura para desenhar.
  const colado = normalizarVisual(plano({ pontos: [{ id: "O", x: 0, y: 0 }] }));
  assert.ok(colado.x[1] - colado.x[0] >= 4 && colado.y[1] - colado.y[0] >= 4);
});

test("pontos: nome, papel, coordenada, derivados e rótulos", () => {
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 1, y: 1 }, { id: "A", x: 2, y: 2 }] })), /repetido/);
  for (const id of ["ABCD", "1A", "A B", "", "A-", 5, undefined]) {
    assert.match(recusado(plano({ pontos: [{ id, x: 1, y: 1 }] })), /nome .* inválido/);
  }
  assert.ok(normalizarVisual(plano({ pontos: [{ id: "P'", x: 1, y: 1 }, { id: "B2", x: 2, y: 2 }] })));
  assert.match(recusado(plano({ pontos: [{ id: "A", papel: "amigo", x: 1, y: 1 }] })), /papel amigo não existe/);
  for (const valor of [NaN, Infinity, "3", null, undefined, 1001, -1001, 0.001, 1.255]) {
    assert.match(recusado(plano({ pontos: [{ id: "A", x: valor, y: 1 }, { id: "B", x: 1, y: 1 }] })), /ponto A: x/);
  }
  assert.ok(normalizarVisual(plano({ pontos: [{ id: "A", x: 1.25, y: -0.5 }] })));
  assert.match(recusado(plano({ pontos: [] })), /lista vazia/);
  assert.match(recusado(plano({ pontos: [{ id: "C", papel: "procurado", x: 1, y: 1 }] })), /nenhum ponto dado ou especial/);
  const treze = Array.from({ length: 13 }, (_, i) => ({ id: `P${i}`, x: i, y: i }));
  assert.match(recusado(plano({ pontos: treze })), /mais de 12/);
  assert.ok(normalizarVisual(plano({ pontos: treze.slice(0, 12) })));
  assert.match(recusado(reta({ pontos: Array.from({ length: 9 }, (_, i) => ({ id: `P${i}`, valor: i })) })), /mais de 8/);

  // Derivados: a conta é do servidor, e ela vale mesmo que a IA mande outra.
  const derivados = normalizarVisual(plano({
    pontos: [
      { id: "A", x: 0, y: 0 },
      { id: "B", x: 4, y: 6 },
      { id: "C", x: 2, y: 6, papel: "procurado" },
      { id: "M", x: 99, y: 99, derivado: { tipo: "ponto_medio", de: ["A", "B"] } },
      { id: "G", derivado: { tipo: "baricentro", de: ["A", "B", "C"] }, papel: "resposta" },
    ],
  }));
  assert.deepEqual(derivados.pontos.slice(3).map(({ id, papel, x, y }) => [id, papel, x, y]), [["M", "especial", 2, 3], ["G", "resposta", 2, 4]]);
  const media = normalizarVisual(reta({ pontos: [{ id: "A", valor: 3 }, { id: "B", valor: 5 }, { id: "C", valor: 4, papel: "procurado" }, { id: "G", derivado: { tipo: "media", de: ["A", "B", "C"] } }] }));
  assert.equal(media.pontos[3].valor, 4);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 1, y: 0 }, { id: "C", x: 0, y: 0 }, { id: "G", derivado: { tipo: "baricentro", de: ["A", "B", "C"] } }] })), /não cai em duas casas/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "G", derivado: { tipo: "baricentro", de: ["A", "A", "A"] } }] })), /lista de pontos inválida/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "G", derivado: { tipo: "ponto_medio", de: ["A", "Z"] } }] })), /Z não existe/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 2, y: 2 }, { id: "M", derivado: { tipo: "ponto_medio", de: ["A", "B"] } }, { id: "N", derivado: { tipo: "ponto_medio", de: ["A", "M"] } }] })), /também é derivado/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "G", derivado: { tipo: "ponto_medio", de: ["A", "G"] } }] })), /não existe ou também é derivado/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 1, y: 1 }, { id: "M", derivado: { tipo: "ponto_medio", de: ["A"] } }] })), /precisa de 2/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 1, y: 1 }, { id: "M", derivado: { tipo: "media", de: ["A", "B"] } }] })), /media não existe no plano/);

  // No máximo 8 rótulos: perdem o rótulo os `dado` do fim, nunca o especial.
  const doze = Array.from({ length: 12 }, (_, i) => ({ id: `P${i}`, x: i, y: i, ...(i === 11 ? { papel: "especial" } : {}) }));
  const rotulados = normalizarVisual(plano({ pontos: doze })).pontos;
  assert.equal(rotulados.filter((ponto) => ponto.rotulo !== false).length, 8);
  assert.equal(rotulados[11].rotulo, undefined, "o especial mantém o rótulo");
  assert.equal(rotulados[10].rotulo, false);
  assert.equal(rotulados[0].rotulo, undefined);
});

test("peças soltas: referência que não existe é descartada e o visual fica; teto estourado invalida", () => {
  const visual = normalizarVisual(plano({
    pontos: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 3, y: 0 }, { id: "C", x: 0, y: 4 }],
    segmentos: [{ de: "A", ate: "B" }, { de: "B", ate: "A" }, { de: "A", ate: "Z" }, { de: "A", ate: "A" }, ["B", "C"], "lixo", { de: "C" }],
    poligonos: [{ pontos: ["A", "B", "C"] }, { pontos: ["A", "B"] }, { pontos: ["A", "B", "Z"] }, ["A", "B", "C"]],
    guias: [{ ponto: "A", eixo: "x" }, { ponto: "A", eixo: "x" }, { ponto: "Z", eixo: "y" }, { ponto: "B", eixo: "z" }, { ponto: "C", eixo: "y" }],
  }));
  assert.deepEqual(visual.segmentos, [{ de: "A", ate: "B" }, { de: "B", ate: "C" }]);
  assert.deepEqual(visual.poligonos, [{ pontos: ["A", "B", "C"] }, { pontos: ["A", "B", "C"] }]);
  assert.deepEqual(visual.guias, [{ ponto: "A", eixo: "x" }, { ponto: "C", eixo: "y" }]);
  const repetido = normalizarVisual(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 1, y: 1 }, { id: "C", x: 2, y: 0 }], poligonos: [{ pontos: ["A", "A", "B"] }, { pontos: ["A", "B", "C", "A"] }] }));
  assert.equal("poligonos" in repetido, false, "vértice repetido descarta o polígono");
  const nenhum = normalizarVisual(plano({ segmentos: [{ de: "A", ate: "Z" }], poligonos: [], guias: null }));
  assert.equal("segmentos" in nenhum, false);
  assert.equal("poligonos" in nenhum, false);
  assert.equal("guias" in nenhum, false);
  const pontos = [{ id: "A", x: 0, y: 0 }, { id: "B", x: 1, y: 1 }, { id: "C", x: 2, y: 0 }];
  const poligono = { pontos: ["A", "B", "C"] };
  assert.match(recusado(plano({ pontos, poligonos: Array(5).fill(poligono) })), /poligonos: mais de 4/);
  assert.ok(normalizarVisual(plano({ pontos, poligonos: Array(4).fill(poligono) })));
  assert.match(recusado(plano({ pontos, segmentos: Array(13).fill({ de: "A", ate: "B" }) })), /segmentos: mais de 12/);
  assert.match(recusado(plano({ pontos, guias: Array(7).fill({ ponto: "A", eixo: "x" }) })), /guias: mais de 6/);
  assert.match(recusado(plano({ pontos, segmentos: "A-B" })), /não é uma lista/);
});

test("reta numérica: intervalos abertos e fechados, até o infinito", () => {
  const visual = normalizarVisual(reta({ de: 0, ate: 10, intervalos: [{ de: 2, ate: 5, deAberto: true }, { de: 7 }, { ate: 1, ateAberto: true }] }));
  assert.deepEqual(visual.intervalos, [{ de: 2, ate: 5, deAberto: true }, { de: 7 }, { ate: 1, ateAberto: true }]);
  assert.deepEqual(normalizarVisual(reta({ de: 0, ate: 10, intervalos: [{ de: null, ate: 9, ateAberto: false }] })).intervalos, [{ ate: 9 }], "null é o infinito; fechado é o padrão");
  assert.match(recusado(reta({ intervalos: [{}] })), /sem nenhum extremo/);
  assert.match(recusado(reta({ intervalos: [{ de: 5, ate: 2 }] })), /o menor tem de vir primeiro/);
  assert.match(recusado(reta({ de: 0, ate: 10, intervalos: [{ de: 2, ate: 50 }] })), /fora do intervalo/);
  assert.match(recusado(reta({ intervalos: Array(4).fill({ de: 1, ate: 2 }) })), /intervalos: mais de 3/);
  // O ajuste automático inclui os extremos finitos dos intervalos.
  const ajustada = normalizarVisual(reta({ intervalos: [{ de: 1, ate: 9 }] }));
  assert.ok(ajustada.de <= 1 && ajustada.ate >= 9);
});

test("alt: obrigatório, em texto simples, cortado em 140 e sem entregar a resposta", () => {
  assert.match(recusado(plano({ alt: undefined })), /alt/);
  assert.match(recusado(plano({ alt: "" })), /alt/);
  assert.equal(normalizarVisual(plano({ alt: String.raw`Veja \frac{1}{2}` })).alt, "Veja 1/2", "LaTeX solto no alt vira texto linear: nunca barra na tela");
  assert.match(recusado(plano({ alt: "x".repeat(400) })), /longo demais/);
  assert.equal(normalizarVisual(plano({ alt: `A ${"palavra ".repeat(20)}fim` })).alt.length <= 140, true);
  assert.match(normalizarVisual(plano({ alt: `A ${"palavra ".repeat(20)}fim` })).alt, /…$/);
  assert.equal(normalizarVisual(plano({ alt: "Triângulo com $x_G = 1$ no meio." })).alt, "Triângulo com x_G = 1 no meio.");
  assert.equal(normalizarVisual(plano({ alt: "Triângulo com $\\input{x}$." })).alt, "Triângulo com x.", "marca inválida não derruba o visual");

  const comProcurado = (alt, extra = {}) => plano({
    alt,
    pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: -2, y: 7 }, { id: "C", papel: "procurado", x: 4, y: 0 }],
    ...extra,
  });
  assert.ok(normalizarVisual(comProcurado("Triângulo ABC com A (1, 2) e B (−2, 7); C é o vértice procurado.")));
  for (const vaza of [
    "Triângulo ABC com C (4, 0).",
    "O vértice C = (4, 0) fecha o triângulo.",
    "Os pontos A (1, 2) e (4,0).",
    "C (4,0)",
    "Aqui x_C = 4 e o resto.",
    "Aqui y_C = 0 e o resto.",
    "Com x C = 4.",
    "O ponto (4.0; 0)... ",
  ]) {
    const motivo = recusado(comProcurado(vaza));
    assert.match(motivo, /entrega a posição/, vaza);
  }
  assert.ok(normalizarVisual(comProcurado("Triângulo ABC com C (4, 0)."), { revela: true }), "o último passo pode mostrar a resposta");
  assert.ok(normalizarVisual(comProcurado("A tem x_A = 1 e y_A = 2; C fica à direita de B.")), "coordenada de ponto visível não é segredo");

  const naReta = (alt) => reta({ alt, pontos: [{ id: "A", valor: 3 }, { id: "C", papel: "procurado", valor: 4 }] });
  assert.ok(normalizarVisual(naReta("Reta com A em 3; C é o ponto procurado.")));
  for (const vaza of ["C = 4", "C (4)", "C em 4", "C vale 4", "C: 4", "x_C = 4", "C é 4"]) assert.match(recusado(naReta(`Reta com ${vaza}.`)), /entrega a posição/, vaza);
  assert.ok(normalizarVisual(naReta("Reta com C = 5."), {}), "outro valor não é a resposta");
});

test("fórmula como visual: LaTeX restrito, canônico, `\\resposta` só no último passo", () => {
  assert.deepEqual(normalizarVisual({ tipo: "formula", latex: String.raw`x_G = \frac{x_A+x_B+x_C}{3}` }), { tipo: "formula", latex: String.raw`x_G = \frac{x_A + x_B + x_C}{3}` });
  assert.equal(normalizarVisual({ tipo: "formula", formula: "a + b" }).latex, "a + b", "aceita o apelido `formula`");
  assert.match(recusado({ tipo: "formula", latex: String.raw`\input{x}` }), /fórmula: comando \\input/);
  assert.match(recusado({ tipo: "formula", latex: 4 }), /fórmula/);
  assert.match(recusado({ tipo: "formula", latex: String.raw`k = \resposta{2}` }), /resposta só vale no último passo/);
  assert.ok(normalizarVisual({ tipo: "formula", latex: String.raw`k = \resposta{2}` }, { revela: true }));
  assert.ok(normalizarVisual({ tipo: "formula", latex: String.raw`\procurado{k} = 1` }), "o procurado marca a incógnita");
  assert.equal(normalizarVisual({ tipo: "formula", latex: "a", alt: String.raw`\frac` }).alt, undefined, "alt inválido da fórmula é ignorado, não derruba");
  assert.equal(normalizarFigura({ tipo: "formula", latex: "a" }), null, "um passo só troca figura");
});

test("o enunciado público não leva a posição do procurado nem a conta dos derivados", () => {
  const completo = normalizarVisual(fixture("baricentro").licao.exercicio.visual);
  const publico = visualParaEnunciado(completo);
  const c = publico.pontos.find((ponto) => ponto.id === "C");
  assert.deepEqual(c, { id: "C", papel: "procurado" });
  assert.deepEqual(publico.pontos.find((ponto) => ponto.id === "G"), { id: "G", papel: "especial", x: 1, y: 3 });
  assert.equal(JSON.stringify(publico).includes("derivado"), false);
  assert.equal(JSON.stringify(publico).includes('"x":4'), false, "a resposta não vai pela rede");
  assert.ok(completo.pontos.find((ponto) => ponto.id === "C").x === 4, "o original não muda");
  const resposta = visualRevelado(completo);
  assert.deepEqual(resposta.pontos.find((ponto) => ponto.id === "C"), { id: "C", papel: "resposta", x: 4, y: 0 });

  const abscissas = normalizarVisual(fixture("abscissas").licao.exercicio.visual);
  assert.deepEqual(visualParaEnunciado(abscissas).pontos.find((ponto) => ponto.id === "C"), { id: "C", papel: "procurado" });
  assert.equal(visualRevelado(abscissas).pontos.find((ponto) => ponto.id === "C").valor, 4);
  const formula = normalizarVisual({ tipo: "formula", latex: "a" });
  assert.equal(visualParaEnunciado(formula), formula);
  assert.equal(visualRevelado(formula), formula);
});

test("o procurado só aparece na posição dele no último passo e no retorno", () => {
  assert.equal(pontoApareceNaPosicao("dado", { tipo: "enunciado" }), true);
  assert.equal(pontoApareceNaPosicao("especial", { tipo: "passo", ultimo: false }), true);
  for (const papel of ["procurado", "resposta"]) {
    assert.equal(pontoApareceNaPosicao(papel, { tipo: "enunciado" }), false);
    assert.equal(pontoApareceNaPosicao(papel, { tipo: "passo", ultimo: false }), false);
    assert.equal(pontoApareceNaPosicao(papel, { tipo: "passo", ultimo: true }), true);
    assert.equal(pontoApareceNaPosicao(papel, { tipo: "retorno" }), true);
  }
});

/* ----- "Resolva comigo" ----- */

test("as resoluções das fixtures valem: 3 a 5 passos, 1 'Sua vez' no fim, eixos herdados e a conta conferida", () => {
  const esperados = { baricentro: [5, 3], abscissas: [4, 2], colinearidade: [5, 3] };
  for (const nome of NOMES) {
    const resultado = validarResolucao(fixture(nome).licao.resolucao);
    assert.equal(resultado.ok, true, `${nome}: ${resultado.motivo}`);
    const { resolucao, conta } = resultado;
    assert.equal(resolucao.passos.length, esperados[nome][0]);
    assert.ok(conta.conferidas >= 3, `${nome}: contas conferidas ${conta.conferidas}`);
    const comTentativa = resolucao.passos.map((passo, i) => (passo.tentativa ? i : -1)).filter((i) => i >= 0);
    assert.equal(comTentativa.length, 1);
    assert.ok(comTentativa[0] >= resolucao.passos.length - 2);
    assert.equal(resolucao.passos.every((passo) => passo.nome.length <= 24), true);
    assert.equal(resolucao.passos[comTentativa[0]].tentativa.opcoes.filter((opcao) => opcao.correta).length, 1);
    const ultimo = resolucao.passos.at(-1);
    assert.ok(ultimo.visual, `${nome}: o último passo desenha a resposta`);
    // Os eixos do último passo são os do problema: a escala não pula.
    if (resolucao.visual.tipo === "plano") assert.deepEqual([ultimo.visual.x, ultimo.visual.y], [resolucao.visual.x, resolucao.visual.y]);
    else assert.deepEqual([ultimo.visual.de, ultimo.visual.ate], [resolucao.visual.de, resolucao.visual.ate]);
  }
  const { resolucao } = validarResolucao(fixture("baricentro").licao.resolucao);
  assert.equal(resolucao.passos[0].formula, String.raw`x_G = \foco{\frac{x_A + x_B + x_C}{3}}`);
  assert.equal(resolucao.passos[1].formula, String.raw`1 = \frac{2 + (-1) + \procurado{x_C}}{3}`);
  assert.equal(resolucao.passos[4].formula, String.raw`C = \resposta{(2, 0)}`);
  assert.equal(resolucao.passos[4].visual.pontos.find((ponto) => ponto.id === "C").papel, "resposta");
  assert.equal(resolucao.passos[3].tentativa.opcoes[0].formula, "y_C = 6 - 1 - 5");
  assert.equal(validarResolucao(fixture("colinearidade").licao.resolucao).conta.conferidas, 4);
});

const resolucaoDe = (nome = "baricentro") => copia(fixture(nome).licao.resolucao);
const motivoDa = (resolucao) => {
  const resultado = validarResolucao(resolucao);
  assert.equal(resultado.ok, false, "a resolução devia ser recusada");
  return resultado.motivo;
};

test("resolução: tudo ou nada, e o motivo diz o quê", () => {
  for (const lixo of [null, undefined, 5, "x", [], {}, { problema: "p" }, { passos: [] }]) assert.equal(validarResolucao(lixo).ok, false);
  assert.equal(normalizarResolucao(null), null);
  assert.ok(normalizarResolucao(resolucaoDe()));

  const poucos = resolucaoDe();
  poucos.passos = poucos.passos.slice(2, 4);
  assert.match(motivoDa(poucos), /3 a 5 passos/);
  const muitos = resolucaoDe();
  muitos.passos.push({ ...muitos.passos[0] }, { ...muitos.passos[0] });
  assert.match(motivoDa(muitos), /3 a 5 passos/);

  const duas = resolucaoDe();
  duas.passos[4].tentativa = copia(duas.passos[3].tentativa);
  assert.match(motivoDa(duas), /mais de um "Sua vez"/);
  const nenhuma = resolucaoDe();
  delete nenhuma.passos[3].tentativa;
  assert.match(motivoDa(nenhuma), /exatamente um "Sua vez"/);
  const cedo = resolucaoDe();
  cedo.passos[1].tentativa = cedo.passos[3].tentativa;
  delete cedo.passos[3].tentativa;
  assert.match(motivoDa(cedo), /penúltimo ou no último/);
  const noUltimo = resolucaoDe();
  noUltimo.passos[4].tentativa = noUltimo.passos[3].tentativa;
  delete noUltimo.passos[3].tentativa;
  // O texto do último passo dá a resposta ("Então C = (2, 0)…"): no passo do "Sua vez" a frase só diz o que fazer (marco 8).
  assert.match(motivoDa(noUltimo), /^o texto do passo 5 \(o "Sua vez"\) traz o resultado \(2, 0\) antes da escolha/);
  noUltimo.passos[4].texto = "Agora monte o ponto C com as duas coordenadas que você achou.";
  assert.equal(validarResolucao(noUltimo).ok, true, "o último passo também pode ser o 'Sua vez'");

  const semProblema = resolucaoDe();
  delete semProblema.problema;
  assert.match(motivoDa(semProblema), /problema/);
  const semNome = resolucaoDe();
  semNome.passos[0].nome = "";
  assert.match(motivoDa(semNome), /passo 1: nome/);
  const semTexto = resolucaoDe();
  semTexto.passos[2].texto = undefined;
  assert.match(motivoDa(semTexto), /passo 3: texto/);
  const comLatex = resolucaoDe();
  comLatex.passos[2].texto = String.raw`Use \frac{1}{2}.`;
  assert.equal(validarResolucao(comLatex).resolucao.passos[2].texto, "Use 1/2.", "LaTeX solto no texto do passo vira texto linear");
});

test("resolução: nome do passo em até 24 caracteres (corta, não derruba) e fórmula entre cifrões no texto vira linear", () => {
  const longo = resolucaoDe();
  longo.passos[2].nome = "Multiplique os dois lados por três";
  const { resolucao } = validarResolucao(longo);
  assert.ok(resolucao.passos[2].nome.length <= 24 && resolucao.passos[2].nome.endsWith("…"), resolucao.passos[2].nome);
  const enorme = resolucaoDe();
  enorme.passos[2].nome = "palavra ".repeat(20);
  assert.match(motivoDa(enorme), /longo demais/);
  const cifrao = resolucaoDe();
  cifrao.passos[1].texto = "Troque: $x_G=1$ e siga.";
  assert.equal(validarResolucao(cifrao).resolucao.passos[1].texto, "Troque: $x_G = 1$ e siga.", "a fórmula em linha fica entre cifrões, na forma canônica");
  const fracao = resolucaoDe();
  fracao.passos[1].texto = String.raw`Troque: $\frac{x_A + x_B}{2}$ e $\foo{x}$ e R$ 5,00.`;
  assert.equal(validarResolucao(fracao).resolucao.passos[1].texto, String.raw`Troque: $\frac{x_A + x_B}{2}$ e x e R$ 5,00.`, "a que lê fica marcada (inteira ou em peças, quem lê decide); a que não lê vira texto linear; o dinheiro fica");
  const solto = resolucaoDe();
  solto.passos[1].texto = "Troque x_A por 3 e deixe H_2O em paz.";
  assert.equal(validarResolucao(solto).resolucao.passos[1].texto, "Troque $x_A$ por 3 e deixe H₂O em paz.", "na resolução (só de matemática) o token solto ganha a marca");
  const nomeComMarca = resolucaoDe();
  nomeComMarca.passos[0].nome = "Isole $x_C$";
  assert.equal(validarResolucao(nomeComMarca).resolucao.passos[0].nome, "Isole x_C", "o nome do passo é texto simples");
});

test("resolução: fórmula fora da lista e conta que não fecha derrubam o exemplo (a lição fica com o texto)", () => {
  const invalida = resolucaoDe();
  invalida.passos[1].formula = String.raw`\input{x}`;
  assert.match(motivoDa(invalida), /passo 2: fórmula: comando \\input/);
  const conta = resolucaoDe();
  conta.passos[2].formula = String.raw`x_C = 3 \times 1 - 2 - (-1) = \foco{3}`;
  assert.match(motivoDa(conta), /a conta não fecha/);
  const contraditoria = resolucaoDe();
  contraditoria.passos[3].formula = "y_C = 3 \\times 2 - 1 - 4";
  assert.match(motivoDa(contraditoria), /a conta não fecha|vale 0 e também 1/);
  const colinearidade = resolucaoDe("colinearidade");
  colinearidade.passos[2].formula = "-1 + k + 5 - 3k = \\foco{4 - 3k}";
  assert.match(motivoDa(colinearidade), /a conta não fecha/);
  const abscissas = resolucaoDe("abscissas");
  abscissas.passos[3].formula = "x_C = 15 - 2 - 6 = \\resposta{8}";
  assert.match(motivoDa(abscissas), /a conta não fecha/);
});

test("'Sua vez': 3 opções, 1 certa, sem repetição, texto ou fórmula, e a conta da opção confere", () => {
  const trocar = (editar) => {
    const resolucao = resolucaoDe();
    editar(resolucao.passos[3].tentativa);
    return motivoDa(resolucao);
  };
  assert.match(trocar((t) => t.opcoes.pop()), /exatamente 3 opções/);
  assert.match(trocar((t) => t.opcoes.push({ texto: "7", correta: false, porque: "x" })), /exatamente 3 opções/);
  assert.match(trocar((t) => (t.opcoes[1].correta = true)), /exatamente 1 opção certa/);
  assert.match(trocar((t) => (t.opcoes[0].correta = false)), /exatamente 1 opção certa/);
  assert.match(trocar((t) => (t.opcoes[2] = { ...t.opcoes[0], correta: false })), /duas opções iguais/);
  // Texto e fórmula na mesma opção valem (marco 9: a conta vai para dentro do texto, e segue conferida); sem nenhum dos dois, não.
  const comAsDuas = resolucaoDe();
  comAsDuas.passos[3].tentativa.opcoes[1].texto = "7";
  assert.equal(validarResolucao(comAsDuas).ok, true);
  assert.match(trocar((t) => { delete t.opcoes[1].formula; delete t.opcoes[1].texto; }), /precisa de texto ou de fórmula/);
  assert.match(trocar((t) => (t.opcoes[1].porque = "")), /porque/);
  assert.match(trocar((t) => (t.opcoes[0].correta = "sim")), /correta precisa ser verdadeiro ou falso/);
  assert.match(trocar((t) => (t.opcoes[0].formula = String.raw`\input{x}`)), /opção 1: fórmula/);
  assert.match(trocar((t) => (t.pergunta = "")), /pergunta/);
  assert.match(trocar((t) => (t.opcoes[0].formula = "y_C = 6 - 1 - 4")), /marcada como certa, mas a conta dela não dá/);
  assert.match(trocar((t) => (t.opcoes[1].formula = "y_C = 3 \\times 2 - 1 - 5")), /marcada como errada, mas a conta dela dá/);
  const naoAvaliavel = resolucaoDe();
  naoAvaliavel.passos[3].tentativa.opcoes[1].formula = "z = 6 + 1 + 5";
  assert.equal(validarResolucao(naoAvaliavel).ok, true, "opção que não se avalia não reprova");
  const texto = resolucaoDe("abscissas");
  assert.equal(validarResolucao(texto).resolucao.passos[2].tentativa.opcoes[0].texto, "15", "opção só com texto (um número) vale");
});

test("passos com visual: o eixo é herdado, e visual que não cabe ou que entrega a resposta some sem derrubar o passo", () => {
  const resolucao = resolucaoDe();
  const viu = (editar) => {
    const copiaDaResolucao = copia(resolucao);
    editar(copiaDaResolucao);
    const resultado = validarResolucao(copiaDaResolucao);
    assert.equal(resultado.ok, true, resultado.motivo);
    return resultado.resolucao;
  };
  // Eixos diferentes no último passo: valem os do problema.
  const quadroDoProblema = validarResolucao(resolucao).resolucao.visual.x;
  assert.deepEqual(viu((r) => (r.passos[4].visual.x = [-9, 9])).passos[4].visual.x, quadroDoProblema);
  // Um ponto fora dos eixos herdados: o visual do passo some, o passo fica.
  const fora = viu((r) => r.passos[4].visual.pontos.push({ id: "D", x: 40, y: 40 }));
  assert.equal(fora.passos[4].visual, undefined);
  assert.equal(fora.passos[4].formula, String.raw`C = \resposta{(2, 0)}`);
  // Outro tipo de figura no meio: some.
  const outro = viu((r) => (r.passos[2].visual = { tipo: "reta_numerica", alt: "Uma reta qualquer.", pontos: [{ id: "A", valor: 1 }] }));
  assert.equal(outro.passos[2].visual, undefined);
  // Fórmula não é visual de passo.
  const formula = viu((r) => (r.passos[2].visual = { tipo: "formula", latex: "a" }));
  assert.equal(formula.passos[2].visual, undefined);
  // Passo que não é o último não pode dizer onde está o C; o último pode.
  const vaza = viu((r) => (r.passos[1].visual = { ...copia(r.visual), alt: "Triângulo com C (2, 0) já achado." }));
  assert.equal(vaza.passos[1].visual, undefined);
  assert.ok(vaza.passos[4].visual.alt.includes("C (2, 0)"));
  // Visual do problema inválido: a resolução fica sem ele, e o primeiro visual válido dos passos define os eixos.
  const semProblema = viu((r) => (r.visual = { tipo: "plano", alt: "x", pontos: [] }));
  assert.equal(semProblema.visual, undefined);
  assert.deepEqual(semProblema.passos[4].visual.x, [-2, 3], "o primeiro visual válido (aqui, o do último passo) define os eixos");
  // Passo que mexe no desenho: um visual novo no meio herda os mesmos eixos.
  const meio = viu((r) => (r.passos[2].visual = { tipo: "plano", alt: "Passo com a guia até o eixo.", pontos: copia(r.visual.pontos), guias: [{ ponto: "A", eixo: "x" }] }));
  assert.deepEqual(meio.passos[2].visual.guias, [{ ponto: "A", eixo: "x" }]);
  assert.deepEqual(meio.passos[2].visual.y, quadroDoProblema.length ? validarResolucao(resolucao).resolucao.visual.y : [], "o visual novo herda a janela y do problema");
});

test("o validador nunca lança, com qualquer coisa que a IA mande", () => {
  const lixos = [null, undefined, 0, 1.5, "texto", true, [], [1, 2], {}, { tipo: 5 }, { tipo: "plano", pontos: [null] }, { tipo: "plano", pontos: [[]], alt: "a" }, { tipo: "reta_numerica", pontos: [{ id: "A", valor: "a" }] }, { passos: [null, null, null] }, { problema: "p", passos: [{}, {}, {}] }];
  for (const lixo of lixos) {
    assert.doesNotThrow(() => validarVisual(lixo));
    assert.doesNotThrow(() => validarResolucao(lixo));
    assert.doesNotThrow(() => normalizarVisuais(lixo));
    assert.doesNotThrow(() => normalizarVisuais([lixo]));
  }
});

/* ----- "Sua vez" sem vazamento (parecer do Designer, item d) ----- */

const guardada = (nome) => validarResolucao(fixture(nome).licao.resolucao).resolucao;
const pontosEscondidos = (visual) => (visual ? visual.pontos.filter((ponto) => ponto.papel === "procurado" || ponto.papel === "resposta") : []);

test("o JSON que vai antes da escolha não traz a resposta do 'Sua vez' nem dos passos que vêm depois", () => {
  for (const nome of NOMES) {
    const completa = guardada(nome);
    const corte = completa.passos.findIndex((passo) => passo.tentativa);
    const passo = completa.passos[corte];
    const publica = resolucaoParaCliente(completa);
    const json = JSON.stringify(publica);

    assert.equal(publica.total, completa.passos.length, `${nome}: o total vale para a resolução inteira`);
    assert.equal(publica.passos.length, corte + 1, `${nome}: só até o passo do Sua vez`);
    const noCorte = publica.passos[corte];
    assert.equal(noCorte.formula, undefined, `${nome}: a fórmula do passo é a revelação`);
    assert.equal(noCorte.visual, undefined, `${nome}: o desenho do passo é a revelação`);
    assert.equal(noCorte.tentativa.opcoes.length, 3);
    // Nada de certo ou errado nem de porquê.
    assert.equal(json.includes('"correta"'), false, `${nome}: sem correta`);
    assert.equal(json.includes('"porque"'), false, `${nome}: sem porque`);
    for (const opcao of passo.tentativa.opcoes) assert.equal(json.includes(JSON.stringify(opcao.porque)), false);
    // A revelação e tudo o que vem depois.
    if (passo.formula) assert.equal(json.includes(JSON.stringify(passo.formula)), false, `${nome}: fórmula revelada`);
    for (const depois of completa.passos.slice(corte + 1)) {
      assert.equal(json.includes(JSON.stringify(depois.nome)), false, `${nome}: nome do passo seguinte`);
      assert.equal(json.includes(JSON.stringify(depois.texto)), false, `${nome}: texto do passo seguinte`);
      if (depois.formula) assert.equal(json.includes(JSON.stringify(depois.formula)), false, `${nome}: fórmula do passo seguinte`);
    }
    assert.equal(json.includes("\\resposta"), false, `${nome}: sem \\resposta antes do acerto`);
    // Nenhum desenho leva a posição do procurado, nem o que o derivado diz.
    for (const visual of [publica.visual, ...publica.passos.map((outro) => outro.visual)]) {
      for (const ponto of pontosEscondidos(visual)) assert.deepEqual(Object.keys(ponto).sort(), ["id", "papel"], `${nome}: ponto ${ponto.id} sem posição`);
    }
    assert.equal(json.includes("derivado"), false);
    // O que o cliente precisa para perguntar continua lá.
    assert.ok(noCorte.tentativa.pergunta && noCorte.texto);
  }
});

test("escolher no 'Sua vez': o acerto e a segunda errada revelam; a primeira errada só diz o porquê", () => {
  for (const nome of NOMES) {
    const completa = guardada(nome);
    const corte = completa.passos.findIndex((passo) => passo.tentativa);
    const { opcoes } = completa.passos[corte].tentativa;
    const certa = opcoes.findIndex((opcao) => opcao.correta);
    const errada = opcoes.findIndex((opcao) => !opcao.correta);

    const acerto = responderSuaVez(completa, { opcao: certa, tentativa: 1 });
    assert.equal(acerto.correta, true);
    assert.equal(acerto.porque, opcoes[certa].porque);
    assert.equal(acerto.certa, undefined);
    assert.equal(acerto.depois.formula, completa.passos[corte].formula);
    assert.equal(acerto.depois.passos.length, completa.passos.length - corte - 1);
    assert.equal(JSON.stringify(acerto.depois.passos).includes("correta"), false);
    if (corte < completa.passos.length - 1) assert.ok(JSON.stringify(acerto.depois.passos).includes("\\resposta") || acerto.depois.passos.at(-1).visual);

    const primeira = responderSuaVez(completa, { opcao: errada, tentativa: 1 });
    assert.deepEqual(primeira, { correta: false, porque: opcoes[errada].porque }, `${nome}: a primeira errada não revela`);

    const segunda = responderSuaVez(completa, { opcao: errada, tentativa: 2 });
    assert.equal(segunda.correta, false);
    assert.equal(segunda.certa, certa);
    assert.equal(segunda.porqueDaCerta, opcoes[certa].porque);
    assert.deepEqual(segunda.depois, acerto.depois, `${nome}: depois da segunda errada segue como no acerto`);

    for (const ruim of [-1, 3, 1.5, NaN, undefined, "0"]) assert.equal(responderSuaVez(completa, { opcao: ruim, tentativa: 1 }), null);
  }
  const colinearidade = guardada("colinearidade");
  const final = responderSuaVez(colinearidade, { opcao: 0, tentativa: 1 }).depois.passos.at(-1);
  assert.equal(final.formula, String.raw`k = \resposta{2}`);
  assert.equal(final.visual.pontos.find((ponto) => ponto.id === "C").papel, "resposta");
  assert.equal(final.visual.pontos.find((ponto) => ponto.id === "C").x, 2, "depois do acerto o desenho traz a posição");
});

test("o exemplo em texto para o cliente sem `resolucao@1`: passos com a fórmula em texto linear e sem 'Sua vez'", () => {
  const linear = (formula) => {
    const lida = lerFormula(formula);
    return lida.ok ? formulaLinear(lida.arvore) : null;
  };
  const passos = passosEmTexto(guardada("baricentro"), linear);
  assert.equal(passos.length, 5);
  assert.equal(passos[0], "1. A fórmula: A abscissa do baricentro é a média das abscissas dos vértices. x_G = (x_A + x_B + x_C) ÷ 3");
  assert.match(passos[3], /^4\. O mesmo para y_C: .* y_C = 3 × 2 − 1 − 5$/);
  assert.equal(passos[4].endsWith("C = (2, 0)"), true);
  assert.equal(passos.every((passo) => passo.length <= 300), true);
  assert.equal(passos.some((passo) => /[\\{}]/.test(passo)), false, "nunca LaTeX cru na tela");
  const abscissas = passosEmTexto(guardada("abscissas"), linear);
  assert.match(abscissas[2], /15 = 2 \+ 6 \+ x_C$/);
});

/* ----- Marco 2g: o alt revelado é montado dos dados ----- */

const DESCRICAO_REVELADA = {
  baricentro: "Plano cartesiano com A (1, 2), B (−2, 7), baricentro G (1, 3) e o vértice C (4, 0).",
  abscissas: "Reta numérica de 0 a 8 com A em 3, B em 5, baricentro G em 4 e o ponto C em 4.",
  colinearidade: "Plano cartesiano com A (−1, −1), B (2, 5) e o ponto C (0, 1).",
};

test("2g: Avaliacao.visual leva o alt montado dos dados, com a resposta; o enunciado continua com o alt da IA, sem a posição do procurado", () => {
  const posicaoDoProcurado = { baricentro: "C (4, 0)", abscissas: "C em 4", colinearidade: "C (0, 1)" };
  for (const nome of NOMES) {
    const completo = normalizarVisual(fixture(nome).licao.exercicio.visual);
    const enunciado = visualParaEnunciado(completo);
    assert.equal(enunciado.alt, completo.alt, `${nome}: o enunciado mantém o alt da IA`);
    assert.equal(enunciado.alt.includes(posicaoDoProcurado[nome]), false, `${nome}: o alt do enunciado não traz a posição do procurado`);
    const revelado = visualRevelado(completo);
    assert.equal(revelado.alt, DESCRICAO_REVELADA[nome]);
    assert.ok(revelado.alt.includes(posicaoDoProcurado[nome]), `${nome}: o alt revelado diz onde está o procurado`);
    assert.doesNotMatch(revelado.alt, /procurad/, `${nome}: já não é procurado`);
    assert.ok(revelado.alt.length <= 140, `${nome}: cabe nos 140 de sempre`);
    assert.notEqual(completo.alt, revelado.alt, `${nome}: o original não muda`);
  }
});

test("2g: o alt revelado não vem do texto da IA: um alt qualquer da IA é trocado pela frase dos dados", () => {
  const completo = normalizarVisual(fixture("baricentro").licao.exercicio.visual);
  const outro = { ...completo, alt: "Qualquer coisa que a IA escreveu, inclusive uma coordenada errada (9, 9)." };
  assert.equal(visualRevelado(outro).alt, DESCRICAO_REVELADA.baricentro);
  assert.equal(JSON.stringify(visualRevelado(outro)).includes("9, 9"), false);
});

test("2g: depois do 'Sua vez', a figura que mostra a resposta leva o alt montado dos dados; a que não mostra, o da IA", () => {
  for (const nome of NOMES) {
    const completa = guardada(nome);
    const corte = completa.passos.findIndex((passo) => passo.tentativa);
    const certa = completa.passos[corte].tentativa.opcoes.findIndex((opcao) => opcao.correta);
    const { depois } = responderSuaVez(completa, { opcao: certa, tentativa: 1 });
    const figuras = [depois.visual, ...depois.passos.map((passo) => passo.visual)].filter(Boolean);
    assert.ok(figuras.length >= 1, `${nome}: o retorno tem a figura da resposta`);
    for (const figura of figuras) {
      if (figura.pontos.some((ponto) => ponto.papel === "resposta")) {
        assert.equal(figura.alt, descricaoDaFigura(figura), `${nome}: o alt da resposta sai dos dados`);
        assert.match(figura.alt, /^(Plano cartesiano|Reta numérica)/);
      }
    }
    const ultimo = depois.passos.at(-1).visual ?? depois.visual;
    assert.match(ultimo.alt, /o (vértice|ponto) C (\(|em )/, `${nome}: a frase do último passo diz onde está C`);
    // Antes da escolha, nada disso vai pela rede: o alt dos passos é o da IA e não há descrição da resposta.
    const publica = resolucaoParaCliente(completa);
    const json = JSON.stringify(publica);
    assert.equal(json.includes(ultimo.alt), false, `${nome}: a descrição da resposta não vai antes da hora`);
    // O que o servidor guarda não muda.
    const guardadoDoUltimo = completa.passos.at(-1).visual;
    if (guardadoDoUltimo) assert.notEqual(guardadoDoUltimo.alt, ultimo.alt, `${nome}: o guardado mantém o alt da IA`);
  }
});

test("2g: a descrição dos dados: derivado achado, ponto fora de polígono, decimais, procurado ainda sem posição e frase longa", () => {
  const figura = (pontos, extra = {}) => normalizarVisual({ tipo: "plano", alt: "Os pontos no plano.", pontos, ...extra });
  const medio = figura([{ id: "A", x: 1, y: 2 }, { id: "B", x: 5, y: 8 }, { id: "M", papel: "resposta", derivado: { tipo: "ponto_medio", de: ["A", "B"] } }], { segmentos: [{ de: "A", ate: "B" }] });
  assert.equal(descricaoDaFigura(medio), "Plano cartesiano com A (1, 2), B (5, 8) e o ponto médio M (3, 5).");
  const media = normalizarVisual({ tipo: "reta_numerica", alt: "Reta com A em 2 e B em 6.", pontos: [{ id: "A", valor: 2 }, { id: "B", valor: 6 }, { id: "M", papel: "resposta", derivado: { tipo: "media", de: ["A", "B"] } }] });
  assert.equal(descricaoDaFigura(media), "Reta numérica de 1 a 7 com A em 2, B em 6 e a média M em 4.");
  const decimal = figura([{ id: "A", x: 1.5, y: 2 }, { id: "P", papel: "resposta", x: -0.5, y: 3.25 }]);
  assert.equal(descricaoDaFigura(decimal), "Plano cartesiano com A (1,5; 2) e o ponto P (−0,5; 3,25).");
  // O procurado que ainda não foi achado fica sem posição.
  const escondido = visualParaEnunciado(figura([{ id: "A", x: 1, y: 2 }, { id: "B", x: 3, y: 4 }, { id: "C", papel: "procurado", x: 5, y: 6 }], { poligonos: [{ pontos: ["A", "B", "C"] }] }));
  assert.equal(descricaoDaFigura(escondido), "Plano cartesiano com A (1, 2), B (3, 4) e o vértice procurado C.");
  // Sem resposta na figura (um passo do meio, o enunciado), o alt é o da IA: o mesmo objeto.
  assert.equal(comDescricaoDaResposta(escondido), escondido);
  assert.equal(comDescricaoDaResposta(escondido).alt, "Os pontos no plano.");
  // Muitos pontos com coordenadas compridas: a frase passaria de 200 caracteres e vira a contagem, com o que foi achado.
  const comprida = {
    tipo: "plano", alt: "", x: [-2000, 2000], y: [-2000, 2000],
    pontos: [
      ...Array.from({ length: 11 }, (_, i) => ({ id: `P${i + 1}`, papel: "dado", x: -1234.5 + i * 111.25, y: 6789.75 - i * 321.5 })),
      { id: "Q", papel: "resposta", x: 7, y: 5.5 },
    ],
  };
  const longa = descricaoDaFigura(comprida);
  assert.ok(longa.length <= 200, longa);
  assert.equal(longa, "Plano cartesiano com 12 pontos, entre eles o ponto Q (7; 5,5).");
  // Com 12 pontos curtos a frase inteira ainda cabe (183 caracteres), e é a inteira que sai.
  const curtos = figura([...Array.from({ length: 11 }, (_, i) => ({ id: `P${i + 1}`, x: i * 2 - 11, y: i * 1.5 - 8, rotulo: false })), { id: "Q", papel: "resposta", x: 8, y: 0.5 }]);
  assert.ok(curtos, "12 pontos é o teto da figura");
  assert.match(descricaoDaFigura(curtos), /^Plano cartesiano com P1 \(−11, −8\), .* e o ponto Q \(8; 0,5\)\.$/);
});

/* ----- Marco 6: o exemplo degenerado, o papel do derivado e a mensagem da conta ----- */

test("6: dois pontos no mesmo lugar recusam a figura do plano (o caso real: A(2, 3), B(4, 1) e G(3, 2) dão C = G); na reta valem", () => {
  const baricentro = (a, b, c) => plano({ pontos: [{ id: "A", x: a[0], y: a[1] }, { id: "B", x: b[0], y: b[1] }, { id: "C", papel: "procurado", x: c[0], y: c[1] }, { id: "G", papel: "especial", derivado: { tipo: "baricentro", de: ["A", "B", "C"] } }] });
  // C = 3G − A − B = (3, 2): o procurado cai em cima de G (o baricentro de um triângulo achatado, com C no meio de AB).
  assert.match(recusado(baricentro([2, 3], [4, 1], [3, 2])), /G cai em cima de C, os dois em \(3, 2\)/);
  assert.match(recusado(baricentro([1, 1], [3, 5], [2, 3])), /cai em cima de/, "o segundo caso do Lead: A(1, 1), B(3, 5) e G(2, 3)");
  // Os números da lição de baricentro das fixtures: nenhum ponto no lugar de outro.
  assert.ok(normalizarVisual(baricentro([1, 2], [-2, 7], [4, 0])));
  // Dois dados iguais, o procurado em cima de um dado e o derivado em cima do ponto de que sai.
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 1, y: 1 }, { id: "B", x: 1, y: 1 }] })), /B cai em cima de A/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: 3, y: 4 }, { id: "C", papel: "procurado", x: 3, y: 4 }] })), /C cai em cima de B/);
  assert.match(recusado(plano({ pontos: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 4, y: 0 }, { id: "M", papel: "especial", derivado: { tipo: "ponto_medio", de: ["A", "A2"] } }, { id: "A2", x: 0, y: 0 }] })), /./);
  // Pontos com a mesma abscissa ou a mesma ordenada, mas em lugares diferentes, valem.
  assert.ok(normalizarVisual(plano({ pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: 1, y: 5 }, { id: "C", x: 4, y: 2 }] })));
  // Na reta numérica o exercício do dono (abscissas 3 e 5, baricentro 4, C = 4) tem C e G no mesmo valor e se desenha bem: vale.
  assert.ok(normalizarVisual(fixture("abscissas").licao.exercicio.visual));
  assert.ok(normalizarVisual(reta({ pontos: [{ id: "A", valor: 3 }, { id: "B", valor: 5 }, { id: "C", papel: "procurado", valor: 4 }, { id: "G", papel: "especial", derivado: { tipo: "media", de: ["A", "B"] } }] })));
  // O motivo diz o que fazer, e a figura que some não leva a lição junto: o exercício fica sem figura, a resolução (outras figuras) segue.
  const motivo = recusado(baricentro([2, 3], [4, 1], [3, 2]));
  assert.match(motivo, /escolha números em que o resultado não coincide com outro ponto/);
});

test("6: baricentro, ponto médio e média são pontos de destaque mesmo quando a IA os marca como dado; o procurado e a resposta ficam como vieram", () => {
  const figura = normalizarVisual(plano({
    pontos: [
      { id: "A", papel: "dado", x: 1, y: 2 },
      { id: "B", papel: "dado", x: -2, y: 7 },
      { id: "C", papel: "procurado", x: 4, y: 0 },
      { id: "G", papel: "dado", derivado: { tipo: "baricentro", de: ["A", "B", "C"] } },
    ],
  }));
  assert.deepEqual(figura.pontos.map(({ id, papel }) => [id, papel]), [["A", "dado"], ["B", "dado"], ["C", "procurado"], ["G", "especial"]]);
  assert.deepEqual(figura.pontos[3], { id: "G", papel: "especial", x: 1, y: 3, derivado: { tipo: "baricentro", de: ["A", "B", "C"] } });
  const media = normalizarVisual(reta({ pontos: [{ id: "A", valor: 2 }, { id: "B", valor: 6 }, { id: "M", papel: "dado", derivado: { tipo: "media", de: ["A", "B"] } }] }));
  assert.equal(media.pontos[2].papel, "especial");
  // Um derivado que é a resposta continua resposta, e um ponto com as coordenadas dadas e sem derivado continua dado.
  const achado = normalizarVisual(plano({ pontos: [{ id: "A", x: 1, y: 2 }, { id: "B", x: 5, y: 8 }, { id: "M", papel: "resposta", derivado: { tipo: "ponto_medio", de: ["A", "B"] } }] }));
  assert.equal(achado.pontos[2].papel, "resposta");
  assert.equal(figura.pontos[0].papel, "dado");
});

test("6: a recusa da conta diz os valores ligados às letras dela (k = 21), e a conta certa com a letra ligada continua passando", () => {
  const f = (latex) => lerFormula(latex).arvore;
  const recusada = conferirConta([f("k = 3 \\times 7"), f("6 - 2k = 0")]);
  assert.equal(recusada.ok, false);
  assert.equal(recusada.formula, "6 − 2k = 0");
  assert.equal(recusada.motivo, "-36 = 0 é falso, com k = 21");
  // Só as letras que aparecem na conta e têm valor entram na mensagem, com o índice.
  const duas = conferirConta([f("x_A = 2"), f("x_B = 6"), f("y_A = 9"), f("x_A + x_B = 9")]);
  assert.equal(duas.motivo, "8 = 9 é falso, com x_A = 2, x_B = 6");
  // Sem letra ligada, a mensagem é a de sempre.
  assert.equal(conferirConta([f("2 + 2 = 5")]).motivo, "4 = 5 é falso");
  // `2k` é `2 × k` (a justaposição é multiplicação), e a conta certa com o valor ligado passa.
  assert.equal(conferirConta([f("k = 5"), f("6 - 2k = -4")]).ok, true);
  // Dois valores para a mesma letra reprovam, e a mensagem diz os dois.
  assert.equal(conferirConta([f("k = 3"), f("k = 21")]).motivo, "k vale 3 e também 21");
  // Pela resolução: o motivo chega inteiro.
  const motivo = validarResolucao({
    problema: "Quanto vale k?",
    passos: [
      { nome: "Um", texto: "Primeiro.", formula: "k = 3 \\times 7" },
      { nome: "Dois", texto: "Depois.", formula: "6 - 2k = 0" },
      { nome: "Três", texto: "Então.", formula: "k = \\resposta{21}", tentativa: { pergunta: "Quanto vale k?", opcoes: [{ texto: "21", correta: true, porque: "Sim." }, { texto: "3", correta: false, porque: "Não." }, { texto: "0", correta: false, porque: "Não." }] } },
    ],
  });
  assert.equal(motivo.ok, false);
  assert.match(motivo.motivo, /a conta não fecha em "6 − 2k = 0": -36 = 0 é falso, com k = 21/);
});
