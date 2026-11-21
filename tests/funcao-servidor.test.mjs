import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { lerCapacidades } from "@studoo/contratos";
import { apresentarExercicio } from "../src/dominio/aprendizado/plano.ts";
import { SEM_CAPACIDADES, comVisuais, semFormulaRepetida, visualDoRetorno } from "../src/servidor/aprendizado/visuais.ts";

/*
 * Marco 12a, o servidor do gráfico de função (spec 15, seção 15): `funcao` é `visuais@2`. Quem anuncia `visuais@2` o recebe (sem a posição do
 * procurado e sem repetir a fórmula que ele já traz na faixa de cima); quem anuncia só `visuais@1` não o recebe e a lição segue; quem não anuncia
 * nada (build 3, site antigo) recebe o PNG da figura inteira, com a faixa de fórmulas, no lugar da foto.
 */

const copia = (valor) => JSON.parse(JSON.stringify(valor));
const fixture = (nome) => JSON.parse(readFileSync(new URL(`./fixtures/matematica-funcao/${nome}.json`, import.meta.url), "utf8"));
const base = JSON.parse(readFileSync(new URL("./fixtures/matematica/baricentro.json", import.meta.url), "utf8")).licao;

const parabola = fixture("parabola");
const FORMULA_REPETIDA = { tipo: "formula", latex: "f(x) = x^2 - 4x + 3", alt: "A função" };
const FORMULA_DA_LICAO = { tipo: "formula", latex: "x_V = -\\frac{b}{2a}", alt: "A abscissa do vértice" };

/** Uma lição de função: a fórmula repetida, a outra fórmula e o gráfico; o exercício "Qual é o vértice?" com o V procurado. */
function licaoDeFuncao() {
  const conteudo = copia(base);
  delete conteudo.resolucao;
  conteudo.visuais = [FORMULA_REPETIDA, FORMULA_DA_LICAO, parabola.guardado];
  conteudo.exercicio.visual = parabola.exercicioDoVertice.guardado;
  delete conteudo.extras;
  return conteudo;
}

function detalheDe(conteudo) {
  const exercicios = [conteudo.exercicio, ...(conteudo.extras ?? [])].map(apresentarExercicio);
  return {
    id: "licao-1", planoId: "plano-1", fluxoId: "fluxo-1", titulo: conteudo.titulo, objetivo: conteudo.objetivo, conceito: conteudo.conceito,
    exemplo: conteudo.exemplo, origem: conteudo.origem, exercicio: exercicios[0], exercicios, concluida: false,
  };
}

const COM_FUNCAO = { visuais: 2, resolucao: 1 };
const SO_UM = { visuais: 1, resolucao: 1 };

test("o servidor anuncia visuais@2 e lê o cabeçalho: visuais@1 continua valendo, visuais@2 vem inteiro", () => {
  assert.deepEqual(lerCapacidades("visuais@2,resolucao@1"), COM_FUNCAO);
  assert.deepEqual(lerCapacidades("visuais@1,resolucao@1"), SO_UM);
  assert.deepEqual(lerCapacidades(null), SEM_CAPACIDADES);
});

test("com visuais@2: o gráfico vai, sem repetir a fórmula que ele já traz; o exercício leva o gráfico sem a posição do procurado", async () => {
  const conteudo = licaoDeFuncao();
  const saida = await comVisuais(detalheDe(conteudo), conteudo, { capacidades: COM_FUNCAO });
  assert.deepEqual(saida.visuais.map((visual) => visual.tipo), ["formula", "funcao"], "a fórmula igual saiu, a outra ficou, na ordem");
  assert.equal(saida.visuais[0].latex, FORMULA_DA_LICAO.latex);
  const publico = saida.exercicio.visual;
  assert.equal(publico.tipo, "funcao");
  const ponto = publico.pontos.find((candidato) => candidato.id === "V");
  assert.deepEqual(Object.keys(ponto).sort(), ["id", "papel", "tipo"], "o V procurado não leva x nem y");
  assert.equal(JSON.stringify(saida.exercicio).includes('"y":-1'), false, "a posição do vértice não vai pela rede no exercício (na figura da lição, o V é só um exemplo)");
  // O retorno de quem acertou revela o V.
  const retorno = visualDoRetorno(conteudo, 0, COM_FUNCAO);
  assert.equal(retorno.pontos.find((candidato) => candidato.id === "V").papel, "resposta");
  assert.deepEqual([retorno.pontos.find((candidato) => candidato.id === "V").x, retorno.pontos.find((candidato) => candidato.id === "V").y], [2, -1]);
});

test("com visuais@1: o gráfico de função não vai (o lugar dele some e a lição segue), as outras figuras e fórmulas ficam, e o retorno não leva o gráfico", async () => {
  const conteudo = licaoDeFuncao();
  const saida = await comVisuais(detalheDe(conteudo), conteudo, { capacidades: SO_UM });
  assert.deepEqual(saida.visuais.map((visual) => visual.tipo), ["formula", "formula"], "sem o gráfico, as duas fórmulas ficam (a repetida já não se repete)");
  assert.equal("visual" in saida.exercicio, false, "o exercício segue sem figura");
  assert.equal(visualDoRetorno(conteudo, 0, SO_UM), undefined);
  // Uma lição só com o gráfico: nenhum campo `visuais`.
  const so = licaoDeFuncao();
  so.visuais = [parabola.guardado];
  assert.equal("visuais" in (await comVisuais(detalheDe(so), so, { capacidades: SO_UM })), false);
});

test("sem o cabeçalho (build 3, site antigo): nenhum campo novo e o PNG da figura inteira no lugar da foto, com a faixa de fórmulas e sem a fórmula repetida", async () => {
  const conteudo = licaoDeFuncao();
  const saida = await comVisuais(detalheDe(conteudo), conteudo, { capacidades: SEM_CAPACIDADES, desenharPng: true });
  assert.equal("visuais" in saida, false); assert.equal("visual" in saida.exercicio, false);
  assert.equal(saida.recurso.tipo, "imagem");
  assert.match(saida.recurso.src, /^data:image\/png;base64,/);
  assert.ok(saida.recurso.src.length <= 700_000);
  const meta = await sharp(Buffer.from(saida.recurso.src.split(",")[1], "base64")).metadata();
  assert.equal(meta.width, 1280);
  assert.ok(meta.height <= 352 * 4 && meta.height >= 600, `${meta.height}`);
  assert.match(saida.recurso.descricao, /Parábola de f\(x\)/, "a legenda traz o alt do gráfico");
  assert.doesNotMatch(saida.recurso.descricao, /A função/, "a fórmula igual que o gráfico já traz não entra na legenda");
  assert.match(saida.recurso.descricao, /A abscissa do vértice/, "a outra fórmula entra");
});

test("a fórmula repetida: f(x) = …, y = … e a expressão sozinha saem; a outra fica; sem gráfico de função, a lista volta como veio", () => {
  const grafico = parabola.guardado;
  for (const latex of ["f(x) = x^2 - 4x + 3", "y = x^2 - 4x + 3", "x^2 - 4x + 3", "f(x)=x^2-4x+3"]) {
    assert.deepEqual(semFormulaRepetida([{ tipo: "formula", latex }, grafico]), [grafico], latex);
  }
  assert.deepEqual(semFormulaRepetida([{ tipo: "formula", latex: "f(x) = x^2 - 4x + 4" }, grafico]).length, 2, "outra expressão fica");
  assert.deepEqual(semFormulaRepetida([{ tipo: "formula", latex: "g(x) = x^2 - 4x + 3" }, grafico]).length, 2, "outra letra fica");
  const sem = [FORMULA_REPETIDA, FORMULA_DA_LICAO];
  assert.deepEqual(semFormulaRepetida(sem), sem);
});
