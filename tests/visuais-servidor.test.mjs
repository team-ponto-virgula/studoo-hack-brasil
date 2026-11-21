import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { lerCapacidades, normalizarVisual, visualParaEnunciado } from "@studoo/contratos";
import { apresentarExercicio, conteudoValido, recursoValido } from "../src/dominio/aprendizado/plano.ts";
import { SEM_CAPACIDADES, comVisuais, descricaoDaPrancheta, limparVisuais, pranchetaDosVisuais, recursoDoDesenho, temVisual, visualDoRetorno } from "../src/servidor/aprendizado/visuais.ts";

const NOMES = ["baricentro", "abscissas", "colinearidade"];
const copia = (valor) => JSON.parse(JSON.stringify(valor));
const conteudoDa = (nome) => copia(JSON.parse(readFileSync(new URL(`./fixtures/matematica/${nome}.json`, import.meta.url), "utf8")).licao);

/** A lição como `buscarLicao` a monta antes das portas de capacidade (o mesmo mapeamento, campo a campo). */
function detalheDe(conteudo, recurso) {
  const exercicios = [conteudo.exercicio, ...(conteudo.extras ?? [])].map(apresentarExercicio);
  return {
    id: "licao-1", planoId: "plano-1", fluxoId: "fluxo-1", titulo: conteudo.titulo, objetivo: conteudo.objetivo, conceito: conteudo.conceito,
    exemplo: conteudo.exemplo, ...(conteudo.passos ? { passos: conteudo.passos } : {}), ...(recurso ? { recurso } : {}),
    origem: conteudo.origem, exercicio: exercicios[0], exercicios, concluida: false,
  };
}

const FOTO = { tipo: "imagem", src: `data:image/jpeg;base64,${Buffer.from("foto da folha").toString("base64")}`, descricao: "Foto da folha de exercícios" };
const TUDO = { visuais: 1, resolucao: 1 };
const SO_VISUAIS = { visuais: 1, resolucao: 0 };

test("lição sem visual sai exatamente como antes, com ou sem cabeçalho", async () => {
  const comum = { ...conteudoDa("baricentro") };
  delete comum.visuais;
  delete comum.resolucao;
  delete comum.exercicio.visual;
  assert.equal(temVisual(comum), false);
  const detalhe = detalheDe(comum, FOTO);
  for (const capacidades of [SEM_CAPACIDADES, SO_VISUAIS, TUDO]) {
    const saida = await comVisuais(detalhe, comum, { capacidades, desenharPng: true });
    assert.equal(saida, detalhe, "o mesmo objeto: nada muda");
  }
});

test("sem o cabeçalho (build 3, site antigo): nenhum campo novo; o PNG toma o lugar da foto e o exemplo vira passos de texto", async () => {
  for (const nome of NOMES) {
    const conteudo = conteudoDa(nome);
    const saida = await comVisuais(detalheDe(conteudo, FOTO), conteudo, { capacidades: SEM_CAPACIDADES, desenharPng: true });
    assert.equal("visuais" in saida, false, nome);
    assert.equal("resolucao" in saida, false, nome);
    assert.equal(saida.exercicios.some((exercicio) => "visual" in exercicio), false, nome);
    assert.equal(JSON.stringify(saida).includes("tentativa"), false, nome);

    assert.equal(saida.recurso.tipo, "imagem");
    assert.equal(saida.recurso.fonte, "Desenho do Studoo", "nunca 'Do seu material'");
    assert.ok(saida.recurso.descricao.length <= 140, `${nome}: ${saida.recurso.descricao}`);
    assert.equal(recursoValido(saida.recurso), true, `${nome}: passa no validador de recurso que a lição já usa`);
    assert.ok(saida.recurso.src.length <= 700_000 && /^data:image\/png;base64,/.test(saida.recurso.src));
    assert.notEqual(saida.recurso.src, FOTO.src, "no lugar da foto");

    assert.equal(saida.passos.length, conteudo.resolucao.passos.length, `${nome}: o exemplo em passos de texto`);
    assert.equal(saida.passos.every((passo) => passo.length <= 300 && !/[\\{}]/.test(passo)), true, `${nome}: nunca LaTeX cru`);
    // A lição continua sendo a lição: o resto não muda.
    for (const campo of ["id", "titulo", "objetivo", "conceito", "exemplo", "origem", "exercicio", "concluida"]) assert.deepEqual(saida[campo], detalheDe(conteudo, FOTO)[campo], campo);
  }
});

test("o PNG do build 3: 1280 px de largura, até 352 pontos de altura, legenda do desenho e o que não cabe fica fora", async () => {
  for (const nome of NOMES) {
    const conteudo = conteudoDa(nome);
    const imagem = await recursoDoDesenho(limparVisuais(conteudo).visuais);
    const png = Buffer.from(imagem.src.split(",")[1], "base64");
    const { width, height, format } = await sharp(png).metadata();
    assert.equal(format, "png");
    assert.equal(width, 1280);
    assert.ok(height <= 352 * 4 && height >= 100 * 4, `${nome}: ${height}`);
    assert.ok(width / height >= 1 / 1.1 - 1e-6 && width / height <= 3.2 + 1e-6, `${nome}: proporção`);
    // Fundo branco liso, sem transparência.
    const { channels } = await sharp(png).metadata();
    const pixel = await sharp(png).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    assert.deepEqual([...pixel.subarray(0, 3)], [255, 255, 255], `${nome}: fundo branco (${channels} canais)`);
  }
  const { visuais } = limparVisuais(conteudoDa("baricentro"));
  assert.equal(descricaoDaPrancheta([visuais[0]], visuais[1]), "Fórmula do baricentro. Triângulo ABC no plano, com A (1, 2), B (−2, 7) e o baricentro G (1, 3); C é o vértice procurado.");
  assert.ok(descricaoDaPrancheta([visuais[0]], visuais[1]).length <= 140);
  // Descrição maior que 140 é cortada, sem romper no meio da palavra.
  const comprida = descricaoDaPrancheta([{ tipo: "formula", latex: "a", alt: "Fórmula do baricentro de um triângulo qualquer" }], { ...visuais[1], alt: `Triângulo com ${"vértice ".repeat(20)}fim.` });
  assert.ok(comprida.length <= 140 && comprida.endsWith("…"), comprida);
  // Uma fórmula que não cabe na faixa (nem a 85%) não entra no PNG; a figura entra sozinha.
  const larga = { tipo: "formula", latex: `1${" + 1".repeat(40)}` };
  const prancheta = pranchetaDosVisuais([normalizarVisual({ ...larga, latex: `1${" + 1".repeat(20)}` }) ?? larga, visuais[1]]);
  assert.ok(prancheta.desenho.altura <= 352);
  assert.equal(pranchetaDosVisuais([{ tipo: "formula", latex: `1${" + 1".repeat(40)}` }]), null, "só uma fórmula que não cabe: sem PNG");
});

test("o PNG não mostra a resposta: o mesmo desenho com o procurado em outro lugar dá a mesma imagem", async () => {
  const aqui = conteudoDa("baricentro");
  const ali = conteudoDa("baricentro");
  const procurado = (conteudo) => conteudo.visuais[1].pontos.find((ponto) => ponto.id === "C");
  // O baricentro é derivado de A, B e C: fixa o G e muda só o C.
  for (const conteudo of [aqui, ali]) {
    const g = conteudo.visuais[1].pontos.find((ponto) => ponto.id === "G");
    delete g.derivado;
    g.x = 1;
    g.y = 3;
  }
  Object.assign(procurado(ali), { x: -2, y: 4 });
  const [pngAqui, pngAli] = await Promise.all([aqui, ali].map((conteudo) => recursoDoDesenho(limparVisuais(conteudo).visuais)));
  assert.equal(pngAqui.src, pngAli.src);
});

test("PNG em cache por conteúdo e foto mantida onde o desenho não pode entrar", async () => {
  const conteudo = conteudoDa("abscissas");
  const visuais = limparVisuais(conteudo).visuais;
  assert.equal(recursoDoDesenho(visuais), recursoDoDesenho(visuais), "a mesma promessa: não desenha duas vezes");
  const saida = await comVisuais(detalheDe(conteudo, FOTO), conteudo, { capacidades: SEM_CAPACIDADES, desenharPng: false });
  assert.deepEqual(saida.recurso, FOTO, "reforço e voz não pedem o PNG: a foto fica");
  assert.ok(saida.passos, "mas o exemplo em texto vale");
  const acorde = { tipo: "acorde", nome: "Am", casas: [-1, 0, 2, 2, 1, 0] };
  assert.deepEqual((await comVisuais(detalheDe(conteudo, acorde), conteudo, { capacidades: SEM_CAPACIDADES, desenharPng: true })).recurso, acorde, "acorde, fração e linha do tempo não se trocam");
  const semRecurso = await comVisuais(detalheDe(conteudo, undefined), conteudo, { capacidades: SEM_CAPACIDADES, desenharPng: true });
  assert.equal(semRecurso.recurso.fonte, "Desenho do Studoo", "sem foto, o desenho entra no recurso vazio");
  // Lição só com um visual inválido: o recurso de antes (a foto), sem caixa vazia.
  const invalido = conteudoDa("abscissas");
  invalido.visuais = [{ tipo: "plano", alt: "x", pontos: [] }];
  delete invalido.resolucao;
  invalido.exercicio.visual = { tipo: "grafico" };
  const igual = await comVisuais(detalheDe(invalido, FOTO), invalido, { capacidades: SEM_CAPACIDADES, desenharPng: true });
  assert.deepEqual(igual.recurso, FOTO);
  assert.equal(conteudoValido(invalido), true, "e a lição continua válida");
});

test("com visuais@1: os visuais e a figura dos exercícios, sem a posição do procurado, e o recurso não muda", async () => {
  for (const nome of NOMES) {
    const conteudo = conteudoDa(nome);
    const saida = await comVisuais(detalheDe(conteudo, FOTO), conteudo, { capacidades: SO_VISUAIS, desenharPng: true });
    assert.deepEqual(saida.recurso, FOTO, `${nome}: a foto volta a ser só a foto`);
    assert.equal(saida.visuais.length, conteudo.visuais.length);
    assert.equal("resolucao" in saida, false, `${nome}: sem resolucao@1 não vai o Resolva comigo`);
    assert.equal(saida.passos.length, conteudo.resolucao.passos.length, `${nome}: quem não desenha o Resolva comigo lê o exemplo em passos`);
    const figura = saida.visuais.find((visual) => visual.tipo !== "formula");
    const escondido = figura.pontos.find((ponto) => ponto.papel === "procurado");
    assert.deepEqual(Object.keys(escondido).sort(), ["id", "papel"], `${nome}: o procurado sem posição`);
    assert.equal(JSON.stringify(saida).includes("derivado"), false);
    assert.deepEqual(saida.exercicio.visual, visualParaEnunciado(normalizarVisual(conteudo.exercicio.visual)));
    assert.deepEqual(saida.exercicios[0].visual, saida.exercicio.visual);
  }
});

test("com visuais@1 e resolucao@1: a resolução vai só até o 'Sua vez', sem a resposta dele", async () => {
  for (const nome of NOMES) {
    const conteudo = conteudoDa(nome);
    const saida = await comVisuais(detalheDe(conteudo, FOTO), conteudo, { capacidades: TUDO, desenharPng: true });
    const json = JSON.stringify(saida);
    const corte = conteudo.resolucao.passos.findIndex((passo) => passo.tentativa);
    assert.equal(saida.resolucao.total, conteudo.resolucao.passos.length);
    assert.equal(saida.resolucao.passos.length, corte + 1);
    assert.equal(json.includes('"correta"'), false, `${nome}: sem correta`);
    assert.equal(json.includes('"porque"'), false, `${nome}: sem porque`);
    for (const passo of conteudo.resolucao.passos.slice(corte)) assert.equal(json.includes(JSON.stringify(passo.nome)), passo === conteudo.resolucao.passos[corte], `${nome}: ${passo.nome}`);
    assert.equal(json.includes("\\\\resposta{"), false, `${nome}: sem \\resposta antes do acerto`);
    for (const opcao of conteudo.resolucao.passos[corte].tentativa.opcoes) assert.equal(json.includes(JSON.stringify(opcao.porque)), false);
    assert.equal(saida.resolucao.passos[corte].formula, undefined);
    assert.equal(saida.resolucao.passos[corte].visual, undefined);
    assert.deepEqual(saida.recurso, FOTO);
    assert.equal("passos" in saida, false, `${nome}: com Resolva comigo, nada de passos de texto no lugar`);
    for (const visual of [saida.resolucao.visual, ...saida.resolucao.passos.map((passo) => passo.visual)]) {
      for (const ponto of visual?.pontos.filter((candidato) => candidato.papel !== "dado" && candidato.papel !== "especial") ?? []) assert.deepEqual(Object.keys(ponto).sort(), ["id", "papel"]);
    }
  }
});

test("lição com `passos` gravados fica com eles (o exemplo em texto não os troca)", async () => {
  const conteudo = conteudoDa("colinearidade");
  conteudo.passos = ["1. O que já vinha gravado."];
  const saida = await comVisuais(detalheDe(conteudo, undefined), conteudo, { capacidades: SEM_CAPACIDADES, desenharPng: false });
  assert.deepEqual(saida.passos, ["1. O que já vinha gravado."]);
});

test("o retorno de quem acerta leva o procurado virado em resposta, só com visuais@1", () => {
  const conteudo = conteudoDa("baricentro");
  assert.equal(visualDoRetorno(conteudo, 0, SEM_CAPACIDADES), undefined);
  const visual = visualDoRetorno(conteudo, 0, SO_VISUAIS);
  assert.deepEqual(visual.pontos.find((ponto) => ponto.id === "C"), { id: "C", papel: "resposta", x: 4, y: 0 });
  assert.equal(visualDoRetorno(conteudo, 1, SO_VISUAIS), undefined, "exercício sem figura");
  const semVisual = conteudoDa("baricentro");
  delete semVisual.exercicio.visual;
  assert.equal(visualDoRetorno(semVisual, 0, TUDO), undefined);
  const soFormula = conteudoDa("baricentro");
  soFormula.exercicio.visual = { tipo: "formula", latex: "a = b" };
  assert.equal(visualDoRetorno(soFormula, 0, TUDO), undefined, "fórmula não tem procurado a revelar");
});

test("o que está gravado é validado de novo na leitura: visual ou resolução que não valem somem e a lição fica", async () => {
  const conteudo = conteudoDa("baricentro");
  conteudo.visuais = [{ tipo: "plano", alt: "lixo", pontos: [] }, conteudo.visuais[0]];
  conteudo.resolucao.passos[2].formula = "x_C = 3 \\times 1 - 2 - (-1) = \\foco{3}";
  const saida = await comVisuais(detalheDe(conteudo, FOTO), conteudo, { capacidades: TUDO, desenharPng: true });
  assert.deepEqual(saida.visuais.map((visual) => visual.tipo), ["formula"]);
  assert.equal("resolucao" in saida, false, "a conta não fecha: o Resolva comigo some");
  assert.equal("passos" in saida, false);
  assert.equal(saida.titulo, conteudo.titulo);
  assert.deepEqual(limparVisuais(conteudo), limparVisuais(conteudo));
  assert.deepEqual(lerCapacidades("visuais@1,resolucao@1"), TUDO);
});
