import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { comCaixaDoPar, lerCapacidades, normalizarVisual, visualParaEnunciado } from "@studoo/contratos";
import { apresentarExercicio, conteudoValido, recursoValido } from "../src/dominio/aprendizado/plano.ts";
import { SEM_CAPACIDADES, comFormulasMarcadas, comFormulasParaOCliente, comTextoLinear, comVisuais, conteudoEhDeMatematica, descricaoDaPrancheta, limparVisuais, pranchetaDosVisuais, recursoDoDesenho, temVisual, visualDoRetorno } from "../src/servidor/aprendizado/visuais.ts";
import { ehAssuntoDeMatematica } from "../src/servidor/ia/matematica.ts";

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
    // A figura do exercício com procurado leva a caixa que o enunciado e o retorno dividem (12a, grupo 6): se um não cabe, nenhum desenha.
    assert.equal(typeof saida.exercicio.visual.alturaMinimaComRetorno, "number", `${nome}: a caixa do par`);
    assert.deepEqual(saida.exercicio.visual, visualParaEnunciado(comCaixaDoPar(normalizarVisual(conteudo.exercicio.visual))));
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
  // Marco 2g: o alt do retorno é montado dos dados e diz onde está a resposta (o app o anuncia).
  assert.equal(visual.alt, "Plano cartesiano com A (1, 2), B (−2, 7), baricentro G (1, 3) e o vértice C (4, 0).");
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

/* ----- Fórmula em linha: o texto linear para quem não desenha ----- */

const textosDe = (valor, achados = []) => {
  if (typeof valor === "string") achados.push(valor);
  else if (Array.isArray(valor)) valor.forEach((item) => textosDe(item, achados));
  else if (valor && typeof valor === "object") Object.values(valor).forEach((item) => textosDe(item, achados));
  return achados;
};

test("sem visuais@1 as fórmulas marcadas dos textos chegam em texto linear, sem cifrão; o resto fica", () => {
  for (const nome of NOMES) {
    const conteudo = conteudoDa(nome);
    assert.equal(conteudoEhDeMatematica(conteudo), true, nome);
    const detalhe = detalheDe(conteudo, FOTO);
    const legado = comTextoLinear(detalhe);
    for (const texto of textosDe(legado)) {
      assert.equal(/\$[^\s$]/.test(texto) && /[^\s$]\$/.test(texto) && texto.includes("$x_") , false, `cifrão de fórmula sobrou: ${texto.slice(0, 80)}`);
      assert.equal(/\\(?:frac|times|div|begin|foco)/.test(texto), false, `LaTeX cru: ${texto.slice(0, 80)}`);
    }
    assert.deepEqual(legado.recurso, detalhe.recurso, "o recurso não é texto");
    assert.deepEqual(legado.exercicio.opcoes.map(({ id }) => id), detalhe.exercicio.opcoes.map(({ id }) => id), "os ids ficam");
    assert.equal(legado.id, detalhe.id);
  }
  const baricentro = comTextoLinear(detalheDe(conteudoDa("baricentro"), FOTO));
  assert.equal(baricentro.conceito, "O baricentro G é o ponto onde as três medianas do triângulo se cruzam. Cada coordenada dele é a média das coordenadas dos vértices: x_G = (x_A + x_B + x_C) ÷ 3 e y_G = (y_A + y_B + y_C) ÷ 3.");
  const abscissas = comTextoLinear(detalheDe(conteudoDa("abscissas"), FOTO));
  assert.equal(abscissas.exercicio.enunciado, "Três vértices têm abscissas x_A = 3, x_B = 5 e x_C. A abscissa do baricentro é 4. Qual é x_C?");
  assert.equal(abscissas.exercicio.opcoes[2].texto, "4", "opção só com número");
  const colinearidade = comTextoLinear(detalheDe(conteudoDa("colinearidade"), FOTO));
  assert.match(colinearidade.conceito, /det\[x_A, y_A, 1; x_B, y_B, 1; x_C, y_C, 1\] = 0\.$/, "o determinante, que só vai em bloco, vira texto linear dentro da frase");
  assert.deepEqual(colinearidade.exercicio.opcoes.map(({ texto }) => texto), ["k = 0", "k = 6", "k = −6"]);
});

test("com visuais@1 o texto chega com as marcas, para o cliente desenhar a fórmula na frase", async () => {
  const conteudo = conteudoDa("abscissas");
  const saida = await comVisuais(detalheDe(conteudo, FOTO), conteudo, { capacidades: SO_VISUAIS, desenharPng: true });
  assert.match(saida.conceito, /\$x_G = \(x_A \+ x_B \+ x_C\) ÷ 3\$|\$x_G = \(x_A \+ x_B \+ x_C\) \/ 3\$/);
  assert.ok(saida.exercicio.enunciado.includes("$x_A = 3$"));
  assert.ok(saida.exercicio.opcoes.every((opcao) => !opcao.texto.includes("$")));
});

test("o texto linear só entra em lição de matemática e só onde há marca de fórmula (código e dinheiro ficam)", () => {
  const codigo = {
    objetivo: "Usar variáveis no shell", conceito: "Em shell, $HOME e ${a}+${b} guardam valores. Custa R$ 5,00.", exemplo: "echo $HOME/$USER", origem: "x",
    exercicio: { tipo: "lacuna", enunciado: "Complete.", trecho: "echo ${a}+${b}", trechoTipo: "codigo", gabarito: ["x"], feedbackCorreto: "ok", feedbackIncorreto: "não" },
  };
  // Lição que não é de matemática nunca passa pela conversão (o servidor só chama `comTextoLinear` nas de matemática).
  assert.equal(conteudoEhDeMatematica(codigo), false);
  // E texto sem marca de fórmula volta como veio: o mesmo objeto.
  const semMarca = detalheDe({ ...codigo, conceito: "Custa R$ 5,00 e R$ 10,00.", exemplo: "echo $HOME" });
  assert.equal(comTextoLinear(semMarca), semMarca, "o mesmo objeto: nada mudou");
  // Mesmo numa lição de matemática, um trecho de código não é tocado, e dinheiro não é fórmula.
  const mista = conteudoDa("baricentro");
  mista.exercicio.trecho = "x = ${a}+${b}";
  mista.exercicio.trechoTipo = "codigo";
  mista.exemplo = "Custa R$ 5,00 e R$ 10,00.";
  const legado = comTextoLinear(detalheDe(mista));
  assert.equal(legado.exercicio.trecho, "x = ${a}+${b}");
  assert.equal(legado.exemplo, "Custa R$ 5,00 e R$ 10,00.");
  // O retorno do exercício também.
  const avaliacao = { correta: true, feedback: "Isso! $x_C = 12 − 8 = 4$.", comprovante: "abc.$def$", certos: ["$a$"], visual: { tipo: "formula", latex: "a" } };
  const linear = comTextoLinear(avaliacao);
  assert.equal(linear.feedback, "Isso! x_C = 12 − 8 = 4.");
  assert.equal(linear.comprovante, "abc.$def$", "o comprovante nunca se mexe");
  assert.deepEqual(linear.certos, ["$a$"]);
  assert.equal(linear.visual, avaliacao.visual);
  assert.equal(comTextoLinear({ correta: false, feedback: "Veja R$ 5,00." }).feedback, "Veja R$ 5,00.");
});

test("o assunto de matemática vem das palavras do título, do objetivo e do conceito", () => {
  for (const texto of ["Baricentro: achando o terceiro vértice", "Pontos colineares e o determinante", "Resolver equações do 2º grau (Bhaskara)", "Geometria analítica: ponto médio", "Frações e porcentagem", "Função afim e quadrática", "Plano cartesiano"]) {
    assert.equal(ehAssuntoDeMatematica(texto), true, texto);
  }
  for (const texto of ["Acordes de violão", "Inglês: pedir um café", "SQL para a prova: JOIN", "Revolução Francesa", "Receita de bolo", "Programar uma função em JavaScript", "Variáveis no shell"]) {
    assert.equal(ehAssuntoDeMatematica(texto), false, texto);
  }
  assert.equal(ehAssuntoDeMatematica(undefined, "", "A equação da reta"), true);
  assert.equal(ehAssuntoDeMatematica(), false);
});

test("3c: a heurística dos tokens soltos só liga em lição de matemática e NUNCA em lição com código", () => {
  const FRASE = "Em Python, use x_1 = 3 e print(x_1).";
  const base = {
    objetivo: "Usar variáveis em Python", conceito: FRASE, exemplo: FRASE, origem: "x",
    exercicio: { tipo: "lacuna", enunciado: FRASE, gabarito: ["3"], feedbackCorreto: "ok", feedbackIncorreto: "não" },
  };
  // 1) Lição de programação, sem nenhum sinal de matemática: nada muda, com ou sem o cabeçalho.
  assert.equal(conteudoEhDeMatematica(base), false);
  for (const capacidades of [SEM_CAPACIDADES, SO_VISUAIS, TUDO]) {
    const detalhe = detalheDe(base);
    assert.equal(comFormulasParaOCliente(detalhe, base, capacidades), detalhe, "o mesmo objeto");
  }
  // 2) Com um trecho de código, nunca é matemática: nem com assunto de matemática, nem com `$x$` no texto.
  const comCodigo = { ...base, objetivo: "Equação do 2º grau em Python", conceito: "Calcule $x_A$ e use x_1 = 3.", exercicio: { ...base.exercicio, trecho: "x_1 = 3\nprint(x_1)", trechoTipo: "codigo" } };
  assert.equal(conteudoEhDeMatematica(comCodigo), false);
  const detalheDoCodigo = detalheDe(comCodigo);
  assert.equal(comFormulasParaOCliente(detalheDoCodigo, comCodigo, TUDO), detalheDoCodigo);
  // 3) Matemática: o assunto, um visual, um trecho de fórmula ou uma fórmula marcada que lê.
  assert.equal(conteudoEhDeMatematica({ ...base, objetivo: "Baricentro de um triângulo" }), true, "assunto");
  assert.equal(conteudoEhDeMatematica({ ...base, exercicio: { ...base.exercicio, trecho: "x^2 + 1", trechoTipo: "formula" } }), true, "trecho de fórmula");
  assert.equal(conteudoEhDeMatematica({ ...base, conceito: "Use $x_A + 1$ aqui." }), true, "fórmula marcada que lê");
  assert.equal(conteudoEhDeMatematica({ ...base, conceito: "Em shell, $HOME e ${a}+${b} guardam valores." }), false, "cifrão de shell não é fórmula");
  assert.equal(conteudoEhDeMatematica({ ...base, conceito: "Custa R$ 5,00 e R$ 10,00." }), false, "dinheiro não é fórmula");
  for (const nome of NOMES) assert.equal(conteudoEhDeMatematica(conteudoDa(nome)), true, nome);
  // 4) Na lição de matemática, quem desenha recebe os tokens soltos já marcados; quem não desenha, texto linear sem cifrão.
  const soltos = { ...base, objetivo: "Baricentro de um triângulo", conceito: "Veja x_A e x_B, b^2 e a água H_2O. Custa R$ 5,00.", exemplo: "x_G = (x_A + x_B)/2" };
  const marcado = comFormulasParaOCliente(detalheDe(soltos), soltos, SO_VISUAIS);
  assert.equal(marcado.conceito, "Veja $x_A$ e $x_B$, $b^2$ e a água H₂O. Custa R$ 5,00.");
  assert.equal(marcado.exemplo, "$x_G$ = ($x_A + x_B$)/2", "a conta curta entre parênteses é uma fórmula só");
  const linear = comFormulasParaOCliente(detalheDe(soltos), soltos, SEM_CAPACIDADES);
  assert.equal(linear.conceito, "Veja x_A e x_B, b^2 e a água H_2O. Custa R$ 5,00.", "sem o cabeçalho nada é marcado: o texto já é legível");
  // O que não é texto das pessoas fica: gabarito, comprovante, visuais, resolução, trecho de código.
  const exercicio = { ...base.exercicio, gabarito: ["x_1"], trecho: "x_1 = 3", trechoTipo: "codigo" };
  assert.deepEqual(comFormulasMarcadas({ gabarito: ["x_1"], feedback: "Use x_1.", comprovante: "x_1.$a$" }), { gabarito: ["x_1"], feedback: "Use $x_1$.", comprovante: "x_1.$a$" });
  assert.deepEqual(comFormulasMarcadas({ trecho: "x_1 = 3", trechoTipo: "codigo", enunciado: "x_1" }), { trecho: "x_1 = 3", trechoTipo: "codigo", enunciado: "$x_1$" });
  assert.equal(exercicio.gabarito[0], "x_1");
  // Idempotente: o que já está marcado não muda.
  const outra = comFormulasParaOCliente(marcado, soltos, SO_VISUAIS);
  assert.deepEqual(outra, marcado);
});

test("o PNG da fase 1: a prancheta 320×352 leva a faixa da fórmula e o plano inteiro, nunca passa de 352 e nunca leva figura que não coube", async () => {
  for (const nome of NOMES) {
    const conteudo = conteudoDa(nome);
    const visuais = limparVisuais(conteudo).visuais;
    const prancheta = pranchetaDosVisuais(visuais);
    assert.ok(prancheta, nome);
    assert.equal(prancheta.desenho.largura, 320);
    assert.ok(prancheta.desenho.altura <= 352 + 1e-9, `${nome}: prancheta de ${prancheta.desenho.altura}`);
    assert.equal(prancheta.desenho.naoCabe, undefined, nome);
    assert.ok(prancheta.figura, `${nome}: a figura está na prancheta`);
    assert.ok(prancheta.formulas.length >= 1, `${nome}: e a faixa da fórmula também`);
    assert.ok(prancheta.desenho.menorTexto >= 13);
    // O plano da prancheta tem a unidade de pelo menos 12 (a janela é a dos dados, o gráfico estreita e centraliza em vez de encolher).
    if (prancheta.figura.tipo === "plano") {
      const verticais = prancheta.desenho.primitivas.filter((primitiva) => primitiva.tipo === "linha" && primitiva.cor === "grade" && primitiva.x1 === primitiva.x2).map((primitiva) => primitiva.x1).sort((a, b) => a - b);
      assert.ok(verticais[1] - verticais[0] >= 12, `${nome}: unidade ${verticais[1] - verticais[0]} na prancheta`);
      assert.ok(verticais.at(-1) - verticais[0] < 252, `${nome}: o gráfico da prancheta estreitou`);
    }
    // Na prancheta, a figura é o plano com a legenda das coordenadas (nada some): cada rótulo está no desenho ou na legenda.
    const visual = prancheta.figura;
    if (visual.tipo === "plano") {
      for (const ponto of visual.pontos.filter((candidato) => candidato.rotulo !== false && candidato.papel !== "procurado")) {
        const inteiro = `${ponto.id} (${String(ponto.x).replace("-", "−")}, ${String(ponto.y).replace("-", "−")})`;
        assert.ok(prancheta.desenho.textos.some((texto) => texto === inteiro || texto === ponto.id), `${nome}: ${inteiro}`);
      }
    }
    const imagem = await recursoDoDesenho(visuais);
    const { height } = await sharp(Buffer.from(imagem.src.split(",")[1], "base64")).metadata();
    assert.ok(height <= 352 * 4, `${nome}: PNG de ${height} px`);
  }
});
