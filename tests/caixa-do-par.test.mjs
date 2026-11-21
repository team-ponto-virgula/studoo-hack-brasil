import assert from "node:assert/strict";
import { test } from "node:test";
import { comCaixaDoPar, desenharVisual, normalizarVisual, validarVisual, visualParaEnunciado, visualRevelado } from "@studoo/contratos";
import { comVisuais, visualDoRetorno } from "../src/servidor/aprendizado/visuais.ts";
import { apresentarExercicio } from "../src/dominio/aprendizado/plano.ts";
import { DEMOS } from "../src/servidor/ia/demos.ts";

/*
 * Marco 12a, grupo 6 (pedido do Mobile 2 e do Designer, spec 15, seção 17): na figura com ponto procurado, o enunciado e o retorno usam a MESMA caixa. No iPhone SE
 * (caixa de 158) o enunciado do vértice cabia e o retorno, com a curva e o procurado no lugar, não: no acerto a figura virava a linha "Figura: alt" e as opções pulavam.
 * Agora, se qualquer um dos dois não cabe, nenhum desenha (`naoCabe` nos dois). Vale para plano, reta numérica e função.
 */

const valido = (bruto) => {
  const lido = validarVisual(bruto);
  assert.equal(lido.ok, true, lido.motivo);
  return lido.visual;
};
const enunciado = { tipo: "enunciado" };
const retorno = { tipo: "retorno" };
const naoCabe = (visual, contexto, alturaMaxima) => desenharVisual(visual, contexto, { alturaMaxima })?.naoCabe === true;

const parabolaDoVertice = () => valido({
  tipo: "funcao", alt: "Parábola de f(x) = x² − 4x + 3, com as raízes A e B e o intercepto C. O vértice é o procurado.",
  curvas: [{ latex: "x^2 - 4x + 3", nome: "f" }],
  pontos: [{ id: "A", tipo: "raiz" }, { id: "B", tipo: "raiz" }, { id: "V", tipo: "vertice", papel: "procurado" }, { id: "C", tipo: "intercepto" }],
});
const planoComProcurado = () => valido({
  tipo: "plano", alt: "Os pontos A e B; C é o procurado.",
  pontos: [{ id: "A", papel: "dado", x: 1, y: 1 }, { id: "B", papel: "dado", x: 5, y: 3 }, { id: "C", papel: "procurado", x: 12, y: 14 }],
});
const retaComProcurado = () => valido({
  tipo: "reta_numerica", alt: "A reta numérica com A e B; M é o procurado.", de: 0, ate: 20,
  pontos: [{ id: "A", papel: "dado", valor: 2 }, { id: "B", papel: "dado", valor: 10 }, { id: "M", papel: "procurado", valor: 18 }],
});

test("a parábola do vértice: sem a caixa do par o enunciado cabe em 158 e o retorno não; com ela, nenhum dos dois desenha em 158 e os dois desenham em 315", () => {
  const visual = parabolaDoVertice();
  // O defeito: cada um por si.
  assert.equal(naoCabe(visualParaEnunciado(visual), enunciado, 158), false, "o enunciado (sem a curva) cabe em 158");
  assert.equal(naoCabe(visualRevelado(visual), retorno, 158), true, "o retorno (com a curva e o procurado) não cabe em 158");
  // A caixa do par: o mesmo número nos dois, e a regra "um não cabe, nenhum desenha".
  const publico = visualParaEnunciado(comCaixaDoPar(visual));
  const revelado = visualRevelado(comCaixaDoPar(visual));
  assert.equal(typeof publico.alturaMinimaComRetorno, "number");
  assert.equal(publico.alturaMinimaComRetorno, revelado.alturaMinimaComRetorno, "o enunciado e o retorno levam o mesmo número");
  assert.ok(publico.alturaMinimaComRetorno > 158 && publico.alturaMinimaComRetorno < 200, `a caixa do par: ${publico.alturaMinimaComRetorno}`);
  assert.equal(naoCabe(publico, enunciado, 158), true, "no enunciado também, com o alt");
  assert.equal(naoCabe(revelado, retorno, 158), true);
  assert.equal(naoCabe(publico, enunciado, 315), false);
  assert.equal(naoCabe(revelado, retorno, 315), false);
  assert.equal(desenharVisual(publico, enunciado)?.naoCabe, undefined, "na altura padrão (320) os dois desenham");
  assert.equal(desenharVisual(revelado, retorno)?.naoCabe, undefined);
  // A fronteira é o número: a ele os dois desenham, abaixo dele (mais de uma folga de 2) nenhum.
  const limite = publico.alturaMinimaComRetorno;
  assert.equal(naoCabe(publico, enunciado, limite), false);
  assert.equal(naoCabe(revelado, retorno, limite), false);
  assert.equal(naoCabe(publico, enunciado, limite - 4), true);
  assert.equal(naoCabe(revelado, retorno, limite - 4), true);
  // O que desenha cabe na caixa que o cliente deu.
  assert.ok(desenharVisual(publico, enunciado, { alturaMaxima: 200 }).altura <= 200);
  assert.ok(desenharVisual(revelado, retorno, { alturaMaxima: 200 }).altura <= 200);
});

test("em toda caixa de 90 a 320, o enunciado e o retorno da figura com procurado decidem igual (função, plano e reta numérica)", () => {
  for (const [nome, visual] of [["parábola", parabolaDoVertice()], ["plano", planoComProcurado()], ["reta numérica", retaComProcurado()]]) {
    const comCaixa = comCaixaDoPar(visual);
    assert.equal(typeof comCaixa.alturaMinimaComRetorno, "number", nome);
    const publico = visualParaEnunciado(comCaixa);
    const revelado = visualRevelado(comCaixa);
    let desenhou = 0;
    for (let caixa = 90; caixa <= 320; caixa += 5) {
      const doEnunciado = naoCabe(publico, enunciado, caixa);
      assert.equal(doEnunciado, naoCabe(revelado, retorno, caixa), `${nome} em ${caixa}: um desenha e o outro não`);
      if (!doEnunciado) {
        desenhou += 1;
        assert.ok(desenharVisual(publico, enunciado, { alturaMaxima: caixa }).altura <= caixa + 1e-6, `${nome} em ${caixa}`);
        assert.ok(desenharVisual(revelado, retorno, { alturaMaxima: caixa }).altura <= caixa + 1e-6, `${nome} em ${caixa}`);
      }
    }
    assert.ok(desenhou > 5 && desenhou < 47, `${nome}: desenha em algumas caixas e em outras não (${desenhou})`);
  }
  // O plano com o procurado longe dos dados: o enunciado (sem ele) cabe em 200 sozinho, o retorno pede 242 ou mais.
  const plano = planoComProcurado();
  assert.equal(naoCabe(visualParaEnunciado(plano), enunciado, 200), false);
  assert.equal(naoCabe(visualRevelado(plano), retorno, 200), true);
  assert.equal(naoCabe(visualParaEnunciado(comCaixaDoPar(plano)), enunciado, 200), true);
});

test("a figura sem ponto procurado volta como veio, e o campo nunca é guardado: o validador o descarta e ele é idempotente", () => {
  const semProcurado = valido({ tipo: "funcao", alt: "Parábola de f(x) = x² − 4x + 3.", curvas: [{ latex: "x^2 - 4x + 3" }], pontos: [{ id: "A", tipo: "raiz" }, { id: "V", tipo: "vertice" }] });
  assert.equal(comCaixaDoPar(semProcurado), semProcurado, "o mesmo objeto");
  assert.equal("alturaMinimaComRetorno" in semProcurado, false);
  assert.equal(naoCabe(visualParaEnunciado(semProcurado), enunciado, 158), false, "cada um decide sozinho");
  const visual = parabolaDoVertice();
  const comCaixa = comCaixaDoPar(visual);
  assert.equal(comCaixaDoPar(visual), comCaixa, "guardado em memória por figura");
  assert.deepEqual(comCaixaDoPar(comCaixa), comCaixa, "idempotente");
  assert.deepEqual(normalizarVisual(comCaixa), visual, "o validador devolve a figura sem o campo");
  assert.equal("alturaMinimaComRetorno" in normalizarVisual(comCaixa), false);
  // O passo do "Resolva comigo" não usa a caixa do par (ele troca de figura por passo, não no lugar do enunciado).
  const comNumero = { ...planoComProcurado(), alturaMinimaComRetorno: 999 };
  assert.equal(desenharVisual(comNumero, { tipo: "passo", ultimo: false }, { alturaMaxima: 320 })?.naoCabe, undefined);
  assert.equal(desenharVisual(comNumero, enunciado, { alturaMaxima: 320 })?.naoCabe, true, "mas o enunciado e o retorno obedecem");
});

test("o servidor leva a caixa do par no enunciado e no retorno dos exercícios com procurado (demonstrações de funções e de geometria), e só neles", async () => {
  let comProcurado = 0;
  for (const chave of ["funcoes", "geometria"]) {
    const demo = DEMOS.find((item) => item.chave === chave);
    for (const licao of demo.plano.fluxos.flatMap(({ licoes }) => licoes)) {
      const exercicios = [licao.exercicio, ...(licao.extras ?? [])];
      const detalhe = {
        id: "licao-1", planoId: "plano-1", fluxoId: "fluxo-1", titulo: licao.titulo, objetivo: licao.objetivo, conceito: licao.conceito, exemplo: licao.exemplo,
        origem: licao.origem, exercicio: apresentarExercicio(exercicios[0]), exercicios: exercicios.map(apresentarExercicio), concluida: false,
      };
      const capacidades = { visuais: 2, resolucao: 1 };
      const saida = await comVisuais(detalhe, licao, { capacidades });
      for (const [indice, exercicio] of exercicios.entries()) {
        const figura = exercicio.visual;
        const publica = saida.exercicios[indice].visual;
        const temProcurado = Boolean(figura && figura.tipo !== "formula" && (figura.pontos ?? []).some((ponto) => ponto.papel === "procurado"));
        if (!temProcurado) {
          assert.equal(publica?.alturaMinimaComRetorno, undefined, `${licao.titulo} ${indice}: sem procurado, sem caixa do par`);
          continue;
        }
        comProcurado += 1;
        assert.equal(typeof publica.alturaMinimaComRetorno, "number", `${licao.titulo} ${indice}`);
        const doRetorno = visualDoRetorno(licao, indice, capacidades);
        assert.equal(doRetorno.alturaMinimaComRetorno, publica.alturaMinimaComRetorno, `${licao.titulo} ${indice}: o mesmo número no retorno`);
        assert.ok(doRetorno.pontos.some((ponto) => ponto.papel === "resposta"), "o retorno revela o procurado");
        assert.equal((publica.pontos ?? []).some((ponto) => ponto.papel === "procurado" && ("x" in ponto || "y" in ponto || "valor" in ponto)), false, "o público segue sem a posição");
        for (let caixa = 100; caixa <= 320; caixa += 10) {
          assert.equal(naoCabe(publica, enunciado, caixa), naoCabe(doRetorno, retorno, caixa), `${licao.titulo} ${indice} em ${caixa}`);
        }
      }
    }
  }
  assert.ok(comProcurado >= 6, `${comProcurado} exercícios com procurado nas demonstrações`);
});
