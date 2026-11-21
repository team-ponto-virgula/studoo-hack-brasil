import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { desenharVisual, formulaLinear, lerFormula, normalizarResolucao, normalizarVisual } from "@studoo/contratos";
import { conteudoValido, esqueletoValido } from "../src/dominio/aprendizado/plano.ts";
import { reiniciarLimiteDeGeracoes } from "../src/servidor/ia/limite.ts";

// Os erros HTTP carregam o cliente do banco ao importar; este teste não toca no banco, então um endereço fictício basta.
process.env.DATABASE_URL ??= "postgresql://teste:teste@127.0.0.1:5432/teste";
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);

const { analisarJson, esquemaDaLicao, esquemaDaLicaoDeMatematica, instrucoesDaLicao, normalizarLicao } = await import("../src/servidor/ia/comum.ts");
const { GERADOR_OPENAI, configuracaoOpenAi, corpoDaLicao, criarGeradorOpenAi } = await import("../src/servidor/ia/openai.ts");
const { GERADOR_DEEPSEEK, configuracaoDeepSeek, criarGeradorDeepSeek, instrucoesLicaoJsonDeMatematica } = await import("../src/servidor/ia/deepseek.ts");
const {
  contagensDoRelato, correcaoDaResolucao, ehAssuntoDeMatematica, esquemaDasFigurasDoMaterial, exemploDeMatematica, figuraQueEntregaARespostaDoExercicio, instrucoesDeFigurasDoMaterial,
  motivoDaFiguraQueEntrega, paresDeCoordenadasDoTexto, esquemaDoVisual, instrucoesDeMatematica, instrucoesDeNotacaoDoMaterial, lerResolucaoDoModelo, lerVisuaisDoModelo, licaoEhDeMatematica, materialEhDeMatematica, reescreverRealces,
  repararResolucao, repararVisuais,
} = await import("../src/servidor/ia/matematica.ts");
const {
  INSTRUCOES_DAS_LICOES_DO_MATERIAL, TRECHO_DA_PAGINA_INTEIRA, TRECHO_MAXIMO, TRECHO_MINIMO, conteudosDasLicoes, gerarLicoesDoMaterial, localizarCitacao,
} = await import("../src/servidor/estudio/licoes-do-material.ts");
const { DEMOS, demoDoObjetivo } = await import("../src/servidor/ia/demos.ts");
const { comVisuais } = await import("../src/servidor/aprendizado/visuais.ts");
const { apresentarExercicio } = await import("../src/dominio/aprendizado/plano.ts");

/*
 * Matemática nos geradores (spec 15, marco 4): o prompt, o esquema e o exemplo só entram nas lições de matemática; a IA devolve DADOS
 * (visuais, resolução, figura do exercício) e o servidor valida; o que não vale some e a lição fica; e se o pedido de matemática não
 * fecha, a segunda tentativa volta ao pedido de sempre. Nenhum teste chama um provedor de verdade: um servidor local imita a
 * OpenAI (Responses API) e a DeepSeek (Chat Completions).
 */

const copia = (valor) => JSON.parse(JSON.stringify(valor));
const ORIGEM = "Conteúdo gerado pelo Studoo";

let servidor;
let pedidos = [];
/** Quem responde: (dados, caminho) => { status?, corpo } com `corpo` o objeto (ou texto) que o modelo devolve. Sem isso, 500. */
let responder = () => ({ status: 500, corpo: { error: { message: "sem resposta programada" } } });
/** Quanto o servidor demora para responder a um pedido (ms), para os testes de prazo. */
let atraso = () => 0;
let registros = [];
let consoleErro;

const saidaDaOpenAi = (corpo) => ({
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: typeof corpo === "string" ? corpo : JSON.stringify(corpo) }] }],
});
const saidaDaDeepSeek = (corpo) => ({ choices: [{ message: { content: typeof corpo === "string" ? corpo : JSON.stringify(corpo) } }] });

before(async () => {
  servidor = createServer((pedido, resposta) => {
    pedido.on("error", () => undefined);
    resposta.on("error", () => undefined);
    let corpo = "";
    pedido.on("data", (parte) => { corpo += parte; });
    pedido.on("end", () => {
      const dados = corpo ? JSON.parse(corpo) : {};
      pedidos.push({ caminho: pedido.url, dados });
      const { status = 200, corpo: saida } = responder(dados, pedido.url, pedidos.length);
      const enviar = () => {
        resposta.writeHead(status, { "Content-Type": "application/json" });
        if (status !== 200) return resposta.end(JSON.stringify(saida));
        return resposta.end(JSON.stringify(pedido.url.endsWith("/responses") ? saidaDaOpenAi(saida) : saidaDaDeepSeek(saida)));
      };
      const espera = atraso(dados);
      if (espera > 0) setTimeout(enviar, espera);
      else enviar();
    });
  });
  await new Promise((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  const porta = servidor.address().port;
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${porta}/v1`;
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${porta}`;
});

after(async () => {
  servidor.closeAllConnections();
  await new Promise((resolver) => servidor.close(resolver));
});

beforeEach(() => {
  process.env.IA = "openai";
  process.env.OPENAI_API_KEY = "chave-de-teste";
  process.env.DEEPSEEK_API_KEY = "sk-deepseek-teste";
  delete process.env.OPENAI_MODELO;
  delete process.env.OPENAI_ESFORCO;
  delete process.env.DEEPSEEK_MODELO;
  delete process.env.DEEPSEEK_RACIOCINIO;
  process.env.STUDOO_IA_RESERVA = "nenhuma";
  pedidos = [];
  registros = [];
  responder = () => ({ status: 500, corpo: { error: { message: "sem resposta programada" } } });
  atraso = () => 0;
  reiniciarLimiteDeGeracoes();
  consoleErro = console.error;
  console.error = (...partes) => { registros.push(partes.join(" ")); };
});

afterEach(() => {
  console.error = consoleErro;
});

const registrosDe = (codigo) => registros.flatMap((linha) => { try { const dado = JSON.parse(linha); return dado.codigo === codigo ? [dado] : []; } catch { return []; } });

const esqueleto = (gerador, titulo, objetivo, licoes) => ({ gerador, titulo, objetivo, origem: "IA da OpenAI (teste)", fluxos: [{ titulo: "Primeiros passos", licoes: licoes.map((licao) => ({ titulo: licao })) }] });
const esqueletoDeMatematica = (gerador) => esqueleto(gerador, "Geometria analítica", "Usar coordenadas para achar pontos médios e baricentros.", ["Ponto médio de um segmento", "Baricentro de um triângulo"]);
const esqueletoDeViolao = (gerador) => esqueleto(gerador, "Violão do zero", "Tocar as primeiras músicas no violão.", ["Conhecer as partes do violão", "Afinar as cordas"]);

/** Uma lição comum, no formato do esquema (nenhum campo de matemática). */
const licaoComum = {
  objetivo: "Reconhecer as partes do violão.",
  conceito: "O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete, no corpo.",
  exemplo: "Ao afinar, você gira as tarraxas, que ficam na cabeça do violão.",
  exercicios: [{
    tipo: "multipla_escolha",
    enunciado: "Onde ficam as tarraxas?",
    opcoes: [{ id: "a", texto: "Na cabeça" }, { id: "b", texto: "No corpo" }, { id: "c", texto: "No braço" }],
    gabarito: ["a"],
    feedbackCorreto: "Isso: as tarraxas ficam na cabeça do violão.",
    feedbackIncorreto: "As tarraxas ficam na cabeça, a ponta do braço.",
  }],
};

/* ----- O assunto: uma regra de palavras ----- */

test("o assunto de matemática: palavras da área, sem acento e sem confundir com outros assuntos", () => {
  for (const texto of ["Geometria analítica", "Baricentro de um triângulo", "Equações do 2º grau", "Pontos colineares", "Funções do 1º grau", "trigonometria", "Teorema de Pitágoras", "Plano cartesiano"]) {
    assert.equal(ehAssuntoDeMatematica(texto), true, texto);
  }
  for (const texto of ["Violão do zero", "SQL para a prova", "Culinária: receitas básicas", "Fotografia com o celular", "História do Brasil", "Inglês para viagem", "Excel: fórmulas essenciais", ""]) {
    assert.equal(ehAssuntoDeMatematica(texto), false, texto);
  }
  assert.equal(ehAssuntoDeMatematica(undefined, "equacao"), true);
  assert.equal(licaoEhDeMatematica(esqueletoDeMatematica(GERADOR_OPENAI), 0, 0), true);
  assert.equal(licaoEhDeMatematica(esqueletoDeViolao(GERADOR_OPENAI), 0, 0), false);
  // Numa trilha de assuntos misturados, vale o título da lição: a de matemática ganha o bloco, a outra não.
  const mista = esqueleto(GERADOR_OPENAI, "Preparar para o vestibular", "Estudar para a prova.", ["Fotossíntese", "Baricentro e ponto médio"]);
  assert.deepEqual([licaoEhDeMatematica(mista, 0, 0), licaoEhDeMatematica(mista, 0, 1)], [false, true]);
});

test("o material é de matemática pelo objetivo, pelo nome ou por citar a área ao menos 3 vezes (um termo solto não basta)", () => {
  const paginas = (...textos) => textos.map((texto, i) => ({ numero: i + 1, texto }));
  assert.equal(materialEhDeMatematica("Estudar para a prova de geometria", "caderno.pdf", paginas("texto qualquer")), true);
  assert.equal(materialEhDeMatematica("Entender a matéria", "lista de equações.pdf", paginas("texto qualquer")), true);
  assert.equal(materialEhDeMatematica("Entender a matéria", "folha.pdf", paginas("Calcule o baricentro do triângulo. Depois o ponto médio e a colinearidade dos pontos.")), true);
  assert.equal(materialEhDeMatematica("Entender a matéria", "folha.pdf", paginas("Na música, o seno de um som é raro. Fale com o professor.")), false);
  assert.equal(materialEhDeMatematica("Entender a matéria", "frações.pdf", paginas("Frações: partes de um inteiro.")), true);
  assert.equal(materialEhDeMatematica("Entender a matéria", "aula.pdf", paginas("A Revolução Francesa começou em 1789.")), false);
});

/* ----- O esquema e o prompt ----- */

function medir(esquema) {
  let profundidade = 0;
  let objetos = 0;
  let propriedades = 0;
  const erros = [];
  const visitar = (no, nivel, caminho) => {
    if (Array.isArray(no)) { no.forEach((item, i) => visitar(item, nivel, `${caminho}[${i}]`)); return; }
    if (!no || typeof no !== "object") return;
    const ehObjeto = no.type === "object" || (Array.isArray(no.type) && no.type.includes("object"));
    if (ehObjeto) {
      objetos += 1;
      const chaves = Object.keys(no.properties ?? {});
      propriedades += chaves.length;
      if (no.additionalProperties !== false) erros.push(`${caminho}: additionalProperties precisa ser false`);
      if (JSON.stringify([...(no.required ?? [])].sort()) !== JSON.stringify([...chaves].sort())) erros.push(`${caminho}: todos os campos são obrigatórios`);
      profundidade = Math.max(profundidade, nivel + 1);
      for (const [chave, filho] of Object.entries(no.properties ?? {})) visitar(filho, nivel + 1, `${caminho}.${chave}`);
      return;
    }
    for (const [chave, filho] of Object.entries(no)) visitar(filho, nivel, `${caminho}.${chave}`);
  };
  visitar(esquema, 0, "$");
  return { profundidade, objetos, propriedades, erros };
}

test("o esquema de matemática segue o modo estrito (todos os campos, null onde não se aplica) e cabe nos limites do Structured Outputs", () => {
  for (const [nome, esquema] of [["lição", esquemaDaLicaoDeMatematica], ["figuras do material", esquemaDasFigurasDoMaterial]]) {
    const { erros, profundidade, propriedades } = medir(esquema);
    assert.deepEqual(erros, [], nome);
    // Limites documentados da OpenAI: até 5000 propriedades e 10 níveis de objeto; o de matemática fica bem abaixo.
    assert.ok(profundidade <= 8, `${nome}: ${profundidade} níveis`);
    assert.ok(propriedades <= 500, `${nome}: ${propriedades} propriedades`);
  }
  const comum = medir(esquemaDaLicao);
  assert.deepEqual(comum.erros, []);
  // O de sempre não ganhou nada: a lição que não é de matemática pede exatamente o que pedia.
  assert.equal(JSON.stringify(esquemaDaLicao).includes("visuais"), false);
  assert.equal(JSON.stringify(esquemaDaLicao).includes("resolucao"), false);
  assert.equal(comum.propriedades, 68);
  // O de matemática é o de sempre mais os campos novos, com a figura e a resolução antes dos exercícios e a figura do exercício logo
  // depois do enunciado (o modelo decide a figura antes de escrever as alternativas).
  const chaves = Object.keys(esquemaDaLicaoDeMatematica.properties);
  assert.deepEqual(chaves.filter((chave) => !["visuais", "resolucao"].includes(chave)), Object.keys(esquemaDaLicao.properties));
  assert.ok(chaves.indexOf("visuais") < chaves.indexOf("exercicios") && chaves.indexOf("resolucao") < chaves.indexOf("exercicios"));
  const exercicio = esquemaDaLicaoDeMatematica.properties.exercicios.items.properties;
  const [primeiras, depois] = [Object.keys(exercicio).slice(0, 3), Object.keys(exercicio).slice(3)];
  assert.deepEqual(primeiras, ["tipo", "enunciado", "visual"]);
  assert.deepEqual(depois, Object.keys(esquemaDaLicao.properties.exercicios.items.properties).filter((chave) => !["tipo", "enunciado"].includes(chave)));
});

test("o pedido da OpenAI: matemática leva o bloco, o esquema e mais espaço; qualquer outra lição, exatamente o de sempre", () => {
  const comum = corpoDaLicao(esqueletoDeViolao(GERADOR_OPENAI), 0, 0);
  assert.equal(comum.input[0].content, instrucoesDaLicao);
  assert.equal(comum.text.format.name, "licao_studoo");
  assert.equal(comum.text.format.schema, esquemaDaLicao);
  assert.equal(comum.max_output_tokens, 6000);
  const matematica = corpoDaLicao(esqueletoDeMatematica(GERADOR_OPENAI), 0, 0, "", true);
  assert.ok(matematica.input[0].content.startsWith(instrucoesDaLicao), "as instruções de sempre continuam");
  assert.match(matematica.input[0].content, /Esta lição é de MATEMÁTICA/);
  assert.match(matematica.input[0].content, /LaTeX restrito/);
  assert.match(matematica.input[0].content, /\\\\frac\{1\}\{2\}/, "a barra dobrada no JSON está dita");
  assert.equal(matematica.text.format.name, "licao_studoo_matematica");
  assert.equal(matematica.text.format.schema, esquemaDaLicaoDeMatematica);
  assert.equal(matematica.text.format.strict, true);
  assert.equal(matematica.max_output_tokens, 10_000);
  assert.equal(comum.input[0].content.includes("LaTeX"), false);
});

test("o prompt de matemática dita o contrato: cada campo, o ponto procurado, o Sua vez, a conta conferida e o cifrão só para fórmula", () => {
  const { content } = corpoDaLicao(esqueletoDeMatematica(GERADOR_OPENAI), 0, 0, "", true).input[0];
  for (const trecho of [
    /visuais \(ou null\)/, /visual, em cada exercício/, /resolucao \(ou null\)/, /\$x = 3\$/, /R\$ 5,00/, /papel é "dado"/, /derivado = \{tipo:/,
    /Do procurado dê as coordenadas REAIS/, /NUNCA diz onde está o ponto procurado/, /exatamente UM passo, o penúltimo ou o último/, /3 opções, exatamente 1 com correta true/,
    /DESCARTA a resolução inteira que errar/, /\\foco\{…\}/, /até 4 × 4/,
  ]) assert.match(content, trecho);
  assert.equal(content.includes("heuristica"), false);
});

/* ----- O exemplo: o mesmo formato do esquema, e uma lição que fecha ----- */

test("o exemplo de matemática da DeepSeek é uma lição que fecha: visuais, figura do exercício e resolução com a conta conferida", () => {
  const lida = normalizarLicao(copia(exemploDeMatematica), ORIGEM);
  assert.ok(lida.conteudo && conteudoValido(lida.conteudo));
  assert.deepEqual(lida.descartados, []);
  assert.deepEqual(lida.conteudo.visuais.map((visual) => visual.tipo), ["formula", "plano"]);
  assert.equal(lida.conteudo.exercicio.visual.tipo, "plano");
  assert.deepEqual([lida.conteudo.exercicio.tipo, ...lida.conteudo.extras.map((extra) => extra.tipo)], ["multipla_escolha", "lacuna"]);
  assert.equal(lida.conteudo.resolucao.passos.length, 5);
  assert.deepEqual(lida.matematica.visuais, { enviados: 2, aceitos: 2 });
  assert.deepEqual(lida.matematica.figuras, { enviadas: 1, aceitas: 1 });
  assert.equal(lida.matematica.resolucao.aceita, true);
  assert.ok(lida.matematica.resolucao.conferidas >= 4, `${lida.matematica.resolucao.conferidas} contas conferidas`);
  assert.deepEqual(lida.matematica.motivos, []);
  // O exemplo mostrado ao modelo é este: o pedido da DeepSeek o leva inteiro, depois das instruções.
  assert.ok(instrucoesLicaoJsonDeMatematica.endsWith(JSON.stringify(exemploDeMatematica)));
  assert.match(instrucoesLicaoJsonDeMatematica, /Esta lição é de MATEMÁTICA/);
  // Os pontos que o servidor guarda completos: o procurado com a posição e o derivado calculado (o enunciado público os esconde).
  const figura = lida.conteudo.exercicio.visual;
  assert.deepEqual(figura.pontos.find((ponto) => ponto.id === "M"), { id: "M", papel: "procurado", x: 4, y: 7 });
  assert.deepEqual(lida.conteudo.visuais[1].pontos.find((ponto) => ponto.id === "M"), { id: "M", papel: "especial", x: 3, y: 5, derivado: { tipo: "ponto_medio", de: ["A", "B"] } });
});

test("uma lição sem nada de matemática sai exatamente como sempre saiu: nenhum campo novo, sem relato", () => {
  const lida = normalizarLicao(copia(licaoComum), ORIGEM);
  assert.ok(lida.conteudo && conteudoValido(lida.conteudo));
  for (const campo of ["visuais", "resolucao"]) assert.equal(campo in lida.conteudo, false, campo);
  assert.equal("visual" in lida.conteudo.exercicio, false);
  assert.equal("matematica" in lida, false);
  assert.deepEqual(lida.descartados, []);
  // Com os campos novos todos nulos (o modelo os manda assim quando não há figura), também.
  const nulos = { ...copia(licaoComum), visuais: null, resolucao: null };
  nulos.exercicios[0].visual = null;
  const comNulos = normalizarLicao(nulos, ORIGEM);
  assert.deepEqual(comNulos.conteudo, lida.conteudo);
  assert.equal("matematica" in comNulos, false);
});

test("o que o validador recusa some e a lição fica: visual inválido, resolução com a conta errada, figura do exercício inválida", () => {
  const base = () => copia(exemploDeMatematica);
  // 1) Um visual de tipo que não existe sai; o outro fica.
  const visualRuim = base();
  visualRuim.visuais.unshift({ tipo: "grafico", alt: "x" });
  const a = normalizarLicao(visualRuim, ORIGEM);
  assert.deepEqual(a.conteudo.visuais.map((visual) => visual.tipo), ["formula", "plano"]);
  assert.deepEqual(a.descartados, ["visuais:recusados"]);
  assert.match(a.matematica.motivos[0], /^visuais\[0\]: .*grafico/);
  // 2) A conta que não fecha derruba a resolução inteira, não a lição.
  const contaErrada = base();
  contaErrada.resolucao.passos[2].formula = "x_M = \\frac{6}{2} = \\foco{4}";
  const b = normalizarLicao(contaErrada, ORIGEM);
  assert.equal("resolucao" in b.conteudo, false);
  assert.ok(b.conteudo.visuais.length === 2 && conteudoValido(b.conteudo));
  assert.deepEqual(b.descartados, ["resolucao:recusada"]);
  assert.match(b.matematica.motivos[0], /^resolucao: a conta não fecha/);
  assert.deepEqual(b.matematica.resolucao, { enviada: true, aceita: false });
  // 3) Um "Sua vez" cuja opção marcada como certa, em fórmula, não dá o valor que a resolução revela adiante, também derruba a resolução.
  const opcaoErrada = base();
  opcaoErrada.resolucao.passos[3].tentativa.opcoes[0].formula = "y_M = \\frac{12}{2}";
  const e = normalizarLicao(opcaoErrada, ORIGEM);
  assert.equal("resolucao" in e.conteudo, false);
  assert.match(e.matematica.motivos[0], /marcada como certa, mas a conta dela não dá o valor/);
  // E a opção errada que dá o valor certo (duas contas com o mesmo resultado) também.
  const duasCertas = base();
  duasCertas.resolucao.passos[3].tentativa.opcoes[1].formula = "y_M = \\frac{20}{4}";
  assert.match(normalizarLicao(duasCertas, ORIGEM).matematica.motivos[0], /marcada como errada, mas a conta dela dá o valor/);
  // A resposta final errada (a conta do último passo não fecha com a das opções e dos passos) derruba a resolução.
  const respostaErrada = base();
  respostaErrada.resolucao.passos[4].formula = "M = \\resposta{(3, 6)}";
  assert.match(normalizarLicao(respostaErrada, ORIGEM).matematica.motivos[0], /a conta não fecha/);
  // Opção em texto (um nome, uma palavra) não tem conta para conferir: vale como está, sem derrubar a resolução.
  const emTexto = base();
  emTexto.resolucao.passos[3].tentativa.opcoes = [
    { texto: "5", formula: null, correta: true, porque: "(2 + 8) ÷ 2 = 5." },
    { texto: "10", formula: null, correta: false, porque: "10 é a soma." },
    { texto: "4", formula: null, correta: false, porque: "Não é a média." },
  ];
  assert.equal(normalizarLicao(emTexto, ORIGEM).conteudo.resolucao.passos.length, 5, "a opção em texto não é conferida (por isso o prompt pede fórmula)");
  // 4) Figura do exercício que não vale: o exercício fica sem figura (e o código do descarte diz qual).
  const figuraRuim = base();
  figuraRuim.exercicios[0].visual = { tipo: "plano", alt: "x", pontos: [] };
  const c = normalizarLicao(figuraRuim, ORIGEM);
  assert.equal("visual" in c.conteudo.exercicio, false);
  assert.ok(conteudoValido(c.conteudo));
  assert.deepEqual(c.descartados, ["principal:visual"]);
  assert.deepEqual(c.matematica.figuras, { enviadas: 1, aceitas: 0 });
  // 5) Uma fórmula como figura do exercício não vale (a figura é plano ou reta).
  const formulaComoFigura = base();
  formulaComoFigura.exercicios[0].visual = { tipo: "formula", latex: "a = b" };
  assert.deepEqual(normalizarLicao(formulaComoFigura, ORIGEM).descartados, ["principal:visual"]);
  // 6) Mais de 3 visuais: ficam os 3 primeiros, e o excesso entra nos motivos.
  const muitos = base();
  muitos.visuais = Array.from({ length: 5 }, (_, i) => ({ tipo: "formula", latex: `a_${i + 1} = b`, alt: "f" }));
  const d = normalizarLicao(muitos, ORIGEM);
  assert.equal(d.conteudo.visuais.length, 3);
  assert.equal(d.matematica.motivos.length, 2);
  // 7) O descarte nunca leva conteúdo: só o código (o registro do servidor não pode citar fórmula).
  for (const lida of [a, b, c, d]) for (const codigo of lida.descartados) assert.match(codigo, /^[a-z0-9]+(?::[a-z0-9]+)?$/);
});

test("se o exercício principal não fecha, a figura do que sobe no lugar dele vai junto; a figura do descartado não conta", () => {
  const bruto = copia(exemploDeMatematica);
  bruto.exercicios.unshift({ ...bruto.exercicios[0], gabarito: ["z"], visual: bruto.exercicios[0].visual });
  const lida = normalizarLicao(bruto, ORIGEM);
  assert.deepEqual(lida.descartados, ["principal:multipla_escolha:gabarito"]);
  assert.equal(lida.conteudo.exercicio.tipo, "multipla_escolha");
  assert.equal(lida.conteudo.exercicio.visual.tipo, "plano");
  assert.deepEqual(lida.matematica.figuras, { enviadas: 1, aceitas: 1 }, "só a do exercício que ficou");
});

/* ----- As barras do LaTeX no JSON ----- */

test("a barra do LaTeX que o modelo não dobrou no JSON é consertada na matemática: \\frac, \\foco, \\resposta e os escapes inválidos", () => {
  const dobrado = JSON.stringify(exemploDeMatematica);
  const simples = dobrado.replaceAll("\\\\", "\\");
  assert.notEqual(simples, dobrado);
  const consertado = analisarJson(simples, true);
  assert.deepEqual(consertado, exemploDeMatematica);
  // Sem o conserto, `\frac` vira uma quebra de página no meio do texto (e o resto, quebra de linha e tabulação).
  const sem = analisarJson(simples, false);
  assert.notDeepEqual(sem, exemploDeMatematica);
  assert.ok(sem.visuais[0].latex.includes("\f"));
  // Os escapes que o JSON não aceita derrubam o parse comum, e o conserto os salva.
  const invalidos = String.raw`{"f": "x \div y \sqrt{2} \leq 3 \geq \Delta \pi"}`;
  assert.throws(() => analisarJson(invalidos, false));
  assert.deepEqual(analisarJson(invalidos, true), { f: String.raw`x \div y \sqrt{2} \leq 3 \geq \Delta \pi` });
  // O JSON certo passa sem mudar, com o texto comum (`\n`, `\"`) intacto.
  assert.deepEqual(analisarJson(String.raw`{"t": "linha\nnova \"aspas\" \\frac"}`, true), { t: 'linha\nnova "aspas" \\frac' });
  // E a lição que sai do JSON consertado é a mesma do JSON certo.
  assert.deepEqual(normalizarLicao(consertado, ORIGEM).conteudo, normalizarLicao(copia(exemploDeMatematica), ORIGEM).conteudo);
});

/* ----- Os geradores, com um servidor local no lugar do provedor ----- */

const ok = (corpo) => ({ corpo });
const erro = (status = 500) => ({ status, corpo: { error: { message: "indisponível" } } });
const instrucaoDe = (pedido) => pedido.dados.input?.[0]?.content ?? pedido.dados.messages?.[0]?.content ?? pedido.dados.instructions;

async function conteudoDaOpenAi(esq, licao = 0) {
  const gerador = criarGeradorOpenAi(configuracaoOpenAi());
  assert.ok(esqueletoValido(esq));
  return gerador.gerarConteudo(esq, 0, licao, new AbortController().signal);
}

test("OpenAI, lição de matemática: um pedido com o esquema e o bloco de matemática, e a lição volta com figuras e resolução", async () => {
  responder = () => ok(exemploDeMatematica);
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 1);
  const { dados } = pedidos[0];
  assert.equal(dados.text.format.name, "licao_studoo_matematica");
  assert.deepEqual(dados.text.format.schema, esquemaDaLicaoDeMatematica);
  assert.equal(dados.max_output_tokens, 10_000);
  assert.match(instrucaoDe(pedidos[0]), /Esta lição é de MATEMÁTICA/);
  assert.ok(conteudoValido(conteudo));
  assert.equal(conteudo.origem, ORIGEM);
  assert.deepEqual(conteudo.visuais.map((visual) => visual.tipo), ["formula", "plano"]);
  assert.equal(conteudo.resolucao.passos.length, 5);
  assert.equal(conteudo.exercicio.visual.tipo, "plano");
  // O registro leva só contagens, sem fórmula nem texto da lição.
  const [registro] = registrosDe("licao_matematica");
  assert.deepEqual(registro, { rota: "ia-openai", codigo: "licao_matematica", visuais: "2/2", figuras: "1/1", resolucao: "aceita", tentativa: 0 });
  assert.equal(registros.join("\n").includes("ponto médio"), false);
  assert.equal(registros.join("\n").includes("frac"), false);
});

test("OpenAI, qualquer outra lição: o pedido é o de sempre, com o esquema e as instruções de sempre", async () => {
  responder = () => ok(licaoComum);
  const conteudo = await conteudoDaOpenAi(esqueletoDeViolao(GERADOR_OPENAI));
  assert.equal(pedidos.length, 1);
  const { dados } = pedidos[0];
  assert.equal(dados.text.format.name, "licao_studoo");
  assert.deepEqual(dados.text.format.schema, esquemaDaLicao);
  assert.equal(dados.max_output_tokens, 6000);
  assert.equal(instrucaoDe(pedidos[0]), instrucoesDaLicao);
  assert.ok(conteudoValido(conteudo));
  assert.equal(registrosDe("licao_matematica").length, 0);
  assert.equal(registrosDe("matematica_desligada").length, 0);
});

test("OpenAI: se o pedido de matemática falha (erro do provedor), a segunda tentativa volta ao pedido de sempre e a lição sai sem figuras", async () => {
  let chamadas = 0;
  responder = () => { chamadas += 1; return chamadas === 1 ? erro(400) : ok(licaoComum); };
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[0].dados.text.format.name, "licao_studoo_matematica");
  assert.equal(pedidos[1].dados.text.format.name, "licao_studoo", "a volta é o pedido de sempre");
  assert.equal(instrucaoDe(pedidos[1]), instrucoesDaLicao);
  assert.ok(conteudoValido(conteudo));
  assert.equal("visuais" in conteudo, false);
  assert.deepEqual(registrosDe("matematica_desligada"), [{ rota: "ia-openai", codigo: "matematica_desligada", motivo: "http" }]);
});

test("OpenAI: se a lição de matemática vem fora do formato (nenhum exercício fecha), a segunda tentativa é a de sempre, com o aviso do formato", async () => {
  let chamadas = 0;
  responder = () => { chamadas += 1; return chamadas === 1 ? ok({ ...copia(exemploDeMatematica), exercicios: [] }) : ok(licaoComum); };
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.text.format.name, "licao_studoo");
  assert.match(pedidos[1].dados.input.at(-1).content, /A resposta anterior veio fora do formato/);
  assert.ok(conteudoValido(conteudo));
  assert.deepEqual(registrosDe("matematica_desligada"), [{ rota: "ia-openai", codigo: "matematica_desligada", motivo: "formato" }]);
});

test("OpenAI: resolução com a conta errada e visual inválido não derrubam nem repetem o pedido: a lição vem sem eles, de uma vez só", async () => {
  const bruto = copia(exemploDeMatematica);
  bruto.resolucao.passos[2].formula = "x_M = \\frac{6}{2} = \\foco{4}";
  bruto.exercicios[0].visual = { tipo: "plano", alt: "x", pontos: [] };
  responder = () => ok(bruto);
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  // O visual e a figura que não valem somem sem pedir de novo; a resolução com a conta errada ganha UMA nova tentativa (marco 7). Aqui a IA
  // repete o mesmo erro: fica o tudo ou nada, com o que a primeira trouxe, e nunca há terceiro pedido.
  assert.equal(pedidos.length, 2, "a resolução recusada por conta é pedida uma vez de novo, e só uma");
  assert.ok(conteudoValido(conteudo));
  assert.equal("resolucao" in conteudo, false);
  assert.equal("visual" in conteudo.exercicio, false);
  assert.equal(conteudo.visuais.length, 2);
  assert.deepEqual(registrosDe("licao_ajustada")[0].detalhe, "principal:visual;resolucao:recusada");
  assert.deepEqual(registrosDe("licao_matematica")[0], { rota: "ia-openai", codigo: "licao_matematica", visuais: "2/2", figuras: "0/1", resolucao: "recusada", tentativa: 0 });
});

function conteudoDaDeepSeek(esq, licao = 0) {
  const gerador = criarGeradorDeepSeek(configuracaoDeepSeek());
  assert.ok(esqueletoValido(esq));
  return gerador.gerarConteudo(esq, 0, licao, new AbortController().signal);
}

test("DeepSeek, lição de matemática: o prompt leva o bloco e o exemplo de matemática, e a barra única do LaTeX é consertada", async () => {
  process.env.IA = "deepseek";
  responder = () => ok(JSON.stringify(exemploDeMatematica).replaceAll("\\\\", "\\"));
  const conteudo = await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].caminho, "/chat/completions");
  assert.equal(pedidos[0].dados.max_tokens, 8192);
  assert.equal(instrucaoDe(pedidos[0]), instrucoesLicaoJsonDeMatematica);
  assert.deepEqual(pedidos[0].dados.response_format, { type: "json_object" });
  assert.ok(conteudoValido(conteudo));
  assert.equal(conteudo.visuais[0].latex, "x_M = \\frac{x_A + x_B}{2}", "a fórmula chegou inteira, sem quebra de página no lugar do \\f");
  assert.equal(conteudo.resolucao.passos.length, 5);
  assert.equal(conteudo.exercicio.visual.tipo, "plano");
  assert.equal(registrosDe("licao_matematica")[0].resolucao, "aceita");
});

test("DeepSeek, qualquer outra lição: o prompt e o conserto de sempre, sem o bloco de matemática", async () => {
  process.env.IA = "deepseek";
  responder = () => ok(licaoComum);
  const conteudo = await conteudoDaDeepSeek(esqueletoDeViolao(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 1);
  assert.equal(instrucaoDe(pedidos[0]).includes("MATEMÁTICA"), false);
  assert.ok(instrucaoDe(pedidos[0]).startsWith(instrucoesDaLicao));
  assert.ok(conteudoValido(conteudo));
});

test("DeepSeek: JSON quebrado no pedido de matemática, a segunda tentativa é a de sempre; vazio e erro do provedor também", async () => {
  process.env.IA = "deepseek";
  for (const [primeira, motivo] of [["isto não é json", "formato"], ["", "vazio"], [null, "http"]]) {
    pedidos = [];
    registros = [];
    let chamadas = 0;
    responder = () => { chamadas += 1; return chamadas === 1 ? (primeira === null ? erro(500) : ok(primeira)) : ok(licaoComum); };
    const conteudo = await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
    assert.equal(pedidos.length >= 2, true, motivo);
    assert.equal(instrucaoDe(pedidos[0]), instrucoesLicaoJsonDeMatematica, motivo);
    assert.equal(instrucaoDe(pedidos.at(-1)).includes("MATEMÁTICA"), false, `${motivo}: a volta é a de sempre`);
    assert.ok(conteudoValido(conteudo), motivo);
    assert.equal("visuais" in conteudo, false, motivo);
    assert.equal(registrosDe("matematica_desligada").length, 1, motivo);
    assert.equal(registrosDe("matematica_desligada")[0].motivo, motivo);
  }
});

/* ----- O material (foto, PDF, caderno) ----- */

const PAGINA = [
  "c) qual o 3º vértice do Δ a seguir?",
  "A=(1, 2)  B (-2, 7)  G (1, 3)  C = ?",
  "c) XG = (XA + XB + XC) / 3 => 1 = 1 + (-2) + XC / 3 -> 3 . 1 = 1 + (-2) + XC => XC = 4",
  "yG = (YA + YB + YC) / 3 = 3 = 2 + 7 + YC / 3 -> 9 = 9 - 9 = YC = 0   -> C = (4, 0)",
].join("\n");
const PAGINAS_DE_MATEMATICA = [{ numero: 1, texto: PAGINA }];
const PAGINAS_DE_FRACOES = [{
  numero: 1,
  texto: "Frações: partes de um inteiro. O denominador indica em quantas partes iguais o inteiro foi dividido. O numerador indica quantas partes foram consideradas.",
}];

const licaoDoMaterial = (n, trecho, pagina = 1) => ({
  titulo: `Lição ${n}: o vértice que falta`,
  objetivo: "Achar o terceiro vértice a partir do baricentro.",
  conceito: "O baricentro tem como coordenadas a média das coordenadas dos vértices: $x_G = (x_A + x_B + x_C) / 3$.",
  exemplo: "Com $x_A = 1$, $x_B = −2$ e $x_G = 1$, vale $x_C = 3 · 1 − 1 − (−2) = 4$.",
  pergunta: `Qual é o terceiro vértice, C? (${n})`,
  opcoes: ["C(4, 0)", "C(0, 4)", "C(2, 6)"],
  correta: 0,
  feedbackCorreto: "Isso! $x_C = 4$ e $y_C = 0$.",
  feedbackIncorreto: "Triplique a coordenada do baricentro e subtraia as dos outros dois vértices.",
  pagina,
  trecho,
});
const TRECHO = "XG = (XA + XB + XC) / 3 => 1 = 1 + (-2) + XC / 3";
const propostaDoMaterial = (n = 3) => ({ titulo: "Baricentro: o vértice que falta", licoes: Array.from({ length: n }, (_, i) => licaoDoMaterial(i + 1, TRECHO)) });
const figurasDoModelo = () => {
  const exemplo = copia(exemploDeMatematica);
  return { visuais: exemplo.visuais, visual: exemplo.exercicios[0].visual, resolucao: exemplo.resolucao };
};

test("material de matemática: o pedido das lições leva só a notação e CADA lição tem um segundo pedido, com a lição e a página", async () => {
  responder = (dados) => (dados.text.format.name === "trilha_material" ? ok(propostaDoMaterial()) : ok(figurasDoModelo()));
  const gerado = await gerarLicoesDoMaterial({ objetivo: "Estudar baricentro", nome: "Folha de exercícios", paginas: PAGINAS_DE_MATEMATICA });
  assert.equal(gerado.matematica, true);
  assert.equal(pedidos.length, 4, "1 pedido das lições e 3 de figuras");
  const [base, ...figuras] = pedidos;
  assert.equal(base.dados.text.format.name, "trilha_material");
  assert.ok(base.dados.instructions.endsWith(`${INSTRUCOES_DAS_LICOES_DO_MATERIAL}\n${instrucoesDeNotacaoDoMaterial}`));
  assert.match(base.dados.instructions, /marque com cifrões/);
  assert.match(base.dados.instructions, /O trecho literal do material NUNCA leva cifrão/);
  for (const [i, pedido] of figuras.entries()) {
    assert.equal(pedido.dados.text.format.name, "figuras_licao");
    assert.deepEqual(pedido.dados.text.format.schema, esquemaDasFigurasDoMaterial);
    assert.ok(pedido.dados.instructions.endsWith(instrucoesDeFigurasDoMaterial));
    const dados = JSON.parse(pedido.dados.input[0].content[0].text);
    assert.equal(dados.licao.titulo, `Lição ${i + 1}: o vértice que falta`);
    assert.deepEqual(dados.licao.alternativas, ["C(4, 0)", "C(0, 4)", "C(2, 6)"]);
    assert.equal(dados.licao.correta, 0);
    assert.equal(dados.pagina.texto, PAGINA, "a página de onde a lição veio, para ler os dados do material");
  }
  assert.equal(gerado.figuras.length, 3);
  assert.ok(gerado.tempos.licoes >= 0 && gerado.tempos.figuras.length === 3);

  const { conteudos, relatos } = conteudosDasLicoes({
    licoes: gerado.licoes, figuras: gerado.figuras, paginas: PAGINAS_DE_MATEMATICA, materialId: "mat-1", nome: "Folha de exercícios", leitura: "ocr", origem: "Material enviado · Folha",
  });
  assert.equal(conteudos.length, 3);
  for (const [i, conteudo] of conteudos.entries()) {
    assert.ok(conteudoValido(conteudo));
    assert.deepEqual(conteudo.visuais.map((visual) => visual.tipo), ["formula", "plano"]);
    assert.equal(conteudo.resolucao.passos.length, 5);
    assert.equal(conteudo.exercicio.visual.tipo, "plano");
    assert.equal(conteudo.exercicio.tipo, "multipla_escolha");
    assert.equal(conteudo.referencias[0].trecho, TRECHO);
    assert.equal(relatos[i].resolucao.aceita, true);
  }
});

test("material de matemática: figuras que não voltam ou não valem deixam a lição como ela era; as outras seguem com as delas", async () => {
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    const titulo = JSON.parse(dados.input[0].content[0].text).licao.titulo;
    if (titulo.startsWith("Lição 2")) return erro(500);
    if (titulo.startsWith("Lição 3")) return ok({ visuais: [{ tipo: "grafico" }], visual: null, resolucao: null });
    return ok(figurasDoModelo());
  };
  const gerado = await gerarLicoesDoMaterial({ objetivo: "Estudar baricentro", nome: "Folha", paginas: PAGINAS_DE_MATEMATICA });
  assert.equal(gerado.figuras[1], undefined, "o pedido que falhou não derruba a proposta");
  assert.equal(registrosDe("figuras_indisponiveis").length >= 1, true);
  const { conteudos, relatos } = conteudosDasLicoes({ licoes: gerado.licoes, figuras: gerado.figuras, paginas: PAGINAS_DE_MATEMATICA, materialId: "m", nome: "Folha", leitura: "ocr", origem: "Material enviado · Folha" });
  assert.equal(conteudos[0].resolucao.passos.length, 5);
  assert.equal("visuais" in conteudos[1], false);
  assert.equal("resolucao" in conteudos[1], false);
  assert.equal(relatos[1], undefined);
  assert.equal("visuais" in conteudos[2], false, "o visual inválido some");
  assert.deepEqual(relatos[2].visuais, { enviados: 1, aceitos: 0 });
  for (const conteudo of conteudos) assert.ok(conteudoValido(conteudo));
});

test("material de matemática: sem tempo para as figuras (o orçamento da proposta acabou), as lições seguem sem elas e sem pedido a mais", async () => {
  responder = () => ok(propostaDoMaterial());
  const gerado = await gerarLicoesDoMaterial({ objetivo: "Estudar baricentro", nome: "Folha", paginas: PAGINAS_DE_MATEMATICA }, { orcamentoMs: 2000 });
  assert.equal(pedidos.length, 1);
  assert.deepEqual(gerado.figuras, [undefined, undefined, undefined]);
  assert.equal(registrosDe("figuras_sem_tempo").length, 1);
});

test("material que não é de matemática: um pedido só, com as instruções de sempre, palavra por palavra", async () => {
  const fracoes = { titulo: "Frações do começo ao fim", licoes: Array.from({ length: 3 }, (_, i) => ({
    ...licaoDoMaterial(i + 1, "O denominador indica em quantas partes iguais o inteiro foi dividido."),
    titulo: `Fração ${i + 1}`,
  })) };
  responder = () => ok(fracoes);
  const gerado = await gerarLicoesDoMaterial({ objetivo: "Entender o assunto", nome: "caderno.pdf", paginas: [{ numero: 1, texto: "O denominador indica em quantas partes iguais o inteiro foi dividido." }] });
  assert.equal(gerado.matematica, false);
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0].dados.text.format.name, "trilha_material");
  assert.ok(pedidos[0].dados.instructions.endsWith(INSTRUCOES_DAS_LICOES_DO_MATERIAL));
  assert.equal(pedidos[0].dados.instructions.includes("MATEMÁTICA"), false);
  assert.equal(INSTRUCOES_DAS_LICOES_DO_MATERIAL.length, 670);
  assert.deepEqual(gerado.figuras, [undefined, undefined, undefined]);
  const { conteudos, relatos } = conteudosDasLicoes({
    licoes: gerado.licoes, paginas: [{ numero: 1, texto: "O denominador indica em quantas partes iguais o inteiro foi dividido." }], materialId: "m", nome: "caderno.pdf", leitura: "texto", origem: "Material enviado · caderno",
  });
  for (const conteudo of conteudos) {
    assert.deepEqual(Object.keys(conteudo).sort(), ["conceito", "exemplo", "exercicio", "objetivo", "origem", "referencias", "titulo"], "a lição do material é a de sempre");
    assert.ok(conteudoValido(conteudo));
  }
  assert.deepEqual(relatos, [undefined, undefined, undefined]);
});

test("material: só a página que não existe (ou sem texto) derruba a proposta; o trecho inventado cai na página inteira", () => {
  const licoes = propostaDoMaterial(3).licoes;
  const base = { paginas: PAGINAS_DE_MATEMATICA, materialId: "m", nome: "Folha", leitura: "ocr", origem: "Material enviado · Folha" };
  assert.throws(() => conteudosDasLicoes({ ...base, licoes: [{ ...licoes[0], pagina: 9 }, licoes[1], licoes[2]] }), (e) => e.codigo === "ia_indisponivel");
  assert.throws(() => conteudosDasLicoes({ ...base, paginas: [{ numero: 1, texto: "curta" }], licoes }), (e) => e.codigo === "ia_indisponivel", "página sem o que citar");
  const inventada = conteudosDasLicoes({ ...base, licoes: [{ ...licoes[0], trecho: "um trecho inventado que não está na página" }, licoes[1], licoes[2]] });
  assert.deepEqual(inventada.citacoes, ["pagina-inteira", "literal", "literal"]);
  assert.equal(inventada.conteudos[0].referencias[0].trecho, PAGINA.trim().slice(0, TRECHO_DA_PAGINA_INTEIRA).trim(), "a referência é o começo da página");
  assert.ok(conteudoValido(inventada.conteudos[0]));
});

test("material com a DeepSeek: a barra única do LaTeX nas lições e nas figuras é consertada", async () => {
  process.env.IA = "deepseek";
  const proposta = propostaDoMaterial();
  proposta.licoes[0].conceito = "O baricentro: $x_G = \\frac{x_A + x_B + x_C}{3}$.";
  responder = (dados) => {
    const base = dados.messages[0].content.includes("trilha_material") || dados.messages[0].content.includes("Crie de 3 a 5 lições");
    return ok((base ? JSON.stringify(proposta) : JSON.stringify(figurasDoModelo())).replaceAll("\\\\", "\\"));
  };
  const gerado = await gerarLicoesDoMaterial({ objetivo: "Estudar baricentro", nome: "Folha", paginas: PAGINAS_DE_MATEMATICA });
  assert.equal(gerado.licoes[0].conceito, "O baricentro: $x_G = \\frac{x_A + x_B + x_C}{3}$.", "o \\frac chegou inteiro");
  assert.equal(gerado.figuras.every((figuras) => figuras?.resolucao), true);
  const { conteudos } = conteudosDasLicoes({ licoes: gerado.licoes, figuras: gerado.figuras, paginas: PAGINAS_DE_MATEMATICA, materialId: "m", nome: "Folha", leitura: "ocr", origem: "Material enviado · Folha" });
  assert.equal(conteudos[0].resolucao.passos.length, 5);
});

/* ----- A citação do material (marco 6): a IA reescreve o trecho, o servidor guarda o LITERAL da página ----- */

/** A folha do dono como o app a leu (a página que a validação recusava em metade das rodadas). */
const FOLHA =
  "c) qual o 3º vértice do Δ a seguir?\n" +
  "\n" +
  "A=(1, 2)\n" +
  "B (-2, 7)\n" +
  "G (1, 3)\n" +
  "C = ?\n" +
  "\n" +
  "c) XG = (XA + XB + XC) / 3 => 1 = 1 + (-2) + XC / 3 -> 3 . 1 = 1 + (-2) + XC\n" +
  "\n" +
  "=> 3 = -1 + XC => 3 + 1 = XC -> XC = 4\n" +
  "\n" +
  "yG = (YA + YB + YC) / 3 = 3 = 2 + 7 + YC / 3 -> 9 = 9 - 9 = YC = 0\n" +
  "\n" +
  "-> C = (4, 0)\n" +
  "\n" +
  "D) Qual o valor de k para que os pontos A, B e C sejam colineares?\n" +
  "A = (-1, -1) ; B = (2, 5) ; C = (k, 1)\n" +
  "\n" +
  "A = -1  -1  1  -1  -1\n" +
  "    2    5  1   2   5\n" +
  "    k    1  1   k   1\n" +
  "\n" +
  "-1 . 5 . 1 = 5 ;\n" +
  "-1 . 1 . k = -1 ;\n" +
  "1 . 2 . 1 = 2 ;\n" +
  "1 . 5 . k = 5k ;\n" +
  "1 . 1 . -1 = -1 ;\n" +
  "1 . 2 . -1 = -2 ;\n" +
  "\n" +
  "(-5) + (-k) + 2 - 5k - (-1) - (-2) = 0\n" +
  "-5 + 2 + 1 + 2 = 0\n" +
  "-k - 5k - 6k\n" +
  "\n" +
  "0 - 6k = 0\n" +
  "k = 0 / -6 -> k = 0";

const dentroDaPagina = (pagina, citacao) => {
  assert.ok(citacao, "a citação existe");
  assert.ok(pagina.includes(citacao.trecho), `o trecho é literal da página: ${JSON.stringify(citacao.trecho)}`);
  assert.ok(citacao.trecho.length >= TRECHO_MINIMO && citacao.trecho.length <= TRECHO_MAXIMO, `${citacao.trecho.length} caracteres`);
  assert.equal(citacao.trecho, citacao.trecho.trim());
};

test("citação: as duas da folha do dono, como a IA as reescreve (quebra de linha em ' / ', seta, espaços), voltam como trecho literal", () => {
  const casos = [
    // As duas que a validação antiga recusava (o trecho é curto: cresce, em linhas inteiras, até ter 20 caracteres).
    ["k = 0 / -6 -> k = 0", "literal", /k = 0 \/ -6 -> k = 0$/],
    ["-> C = (4, 0)", "literal", /-> C = \(4, 0\)$/],
    // A quebra de linha da folha trocada por " / ", por espaço, por "|" ou por " -> ".
    ["0 - 6k = 0 / k = 0 / -6 -> k = 0", "normalizada", /0 - 6k = 0\nk = 0 \/ -6 -> k = 0$/],
    ["0 - 6k = 0 k = 0 / -6 -> k = 0", "normalizada", /k = 0 \/ -6 -> k = 0$/],
    ["0 - 6k = 0 | k = 0 / -6 -> k = 0", "normalizada", /k = 0 \/ -6 -> k = 0$/],
    ["yG = (YA + YB + YC) / 3 = 3 = 2 + 7 + YC / 3 -> 9 = 9 - 9 = YC = 0 -> C = (4, 0)", "normalizada", /YC = 0\n\n-> C = \(4, 0\)$/],
    ["yG = (YA + YB + YC) / 3 = 3 = 2 + 7 + YC / 3 -> 9 = 9 - 9 = YC = 0 / -> C = (4, 0)", "normalizada", /YC = 0\n\n-> C = \(4, 0\)$/],
    // Seta e menos de outro caractere, caixa e aspas.
    ["yG = (YA + YB + YC) / 3 = 3 = 2 + 7 + YC / 3 → 9 = 9 − 9 = YC = 0 → C = (4, 0)", "normalizada", /-> C = \(4, 0\)$/],
    ["“K = 0 / −6 → k = 0”", "normalizada", /k = 0 \/ -6 -> k = 0$/],
    // As linhas da matriz, com os espaços da foto colapsados.
    ["A = -1 -1 1 -1 -1 2 5 1 2 5 k 1 1 k 1", "normalizada", /k {4}1 {2}1 {3}k {3}1$/],
    // O ponto final que a IA acrescenta.
    ["D) Qual o valor de k para que os pontos A, B e C sejam colineares?.", "normalizada", /sejam colineares/],
  ];
  for (const [citacao, como, termina] of casos) {
    const achada = localizarCitacao(FOLHA, citacao);
    dentroDaPagina(FOLHA, achada);
    assert.equal(achada.como, como, citacao);
    assert.match(achada.trecho, termina, citacao);
  }
});

test("citação: o literal que já valia continua valendo, sem mudar uma letra", () => {
  for (const trecho of ["XG = (XA + XB + XC) / 3 => 1 = 1 + (-2) + XC / 3", "D) Qual o valor de k para que os pontos A, B e C sejam colineares?", "(-5) + (-k) + 2 - 5k - (-1) - (-2) = 0"]) {
    assert.deepEqual(localizarCitacao(FOLHA, trecho), { trecho, como: "literal" });
  }
  // Com espaços nas pontas, o literal é o mesmo sem eles.
  assert.deepEqual(localizarCitacao(FOLHA, "  (-5) + (-k) + 2 - 5k - (-1) - (-2) = 0\n"), { trecho: "(-5) + (-k) + 2 - 5k - (-1) - (-2) = 0", como: "literal" });
});

test("citação: a quebra de linha trocada por ' / ', por espaço ou por '|' em qualquer página; acento e aspas não derrubam", () => {
  const pagina = "Frações: partes de um inteiro.\nO denominador indica em quantas partes iguais o inteiro foi dividido.\nO numerador indica quantas foram consideradas.";
  for (const citacao of [
    "O denominador indica em quantas partes iguais o inteiro foi dividido. / O numerador indica quantas foram consideradas.",
    "O denominador indica em quantas partes iguais o inteiro foi dividido. O numerador indica quantas foram consideradas.",
    "o denominador indica em quantas partes iguais o inteiro foi dividido. | o numerador indica quantas foram consideradas.",
    "“O denominador indica em quantas partes iguais o inteiro foi dividido.”",
    "O  denominador   indica em quantas partes iguais o inteiro foi dividido.",
  ]) {
    const achada = localizarCitacao(pagina, citacao);
    dentroDaPagina(pagina, achada);
    assert.equal(achada.como, "normalizada", citacao);
    assert.ok(achada.trecho.includes("O denominador indica em quantas partes iguais o inteiro foi dividido."));
  }
  // Sem acento só se for preciso: a primeira tentativa já acha, e a de sem acento fica para o resto.
  const sem = localizarCitacao(pagina, "Fracoes: partes de um inteiro.");
  dentroDaPagina(pagina, sem);
  assert.equal(sem.como, "sem-acento");
  assert.equal(sem.trecho, "Frações: partes de um inteiro.");
});

test("citação: sem trecho que case, a janela de linhas inteiras com mais de 80% das palavras; abaixo disso, a página inteira", () => {
  // Um número trocado na reescrita (8 das 9 palavras iguais): a linha da folha.
  const quase = localizarCitacao(FOLHA, "A = (-1, -1) ; B = (2, 5) ; C = (k, 2)");
  dentroDaPagina(FOLHA, quase);
  assert.equal(quase.como, "melhor-janela");
  assert.equal(quase.trecho, "A = (-1, -1) ; B = (2, 5) ; C = (k, 1)");
  // Reescrita em palavras suas, com a maior parte do vocabulário da linha: a janela da linha, inteira.
  const parafrase = localizarCitacao(FOLHA, "Qual o valor de k para que os pontos A, B e C fiquem colineares? D)");
  dentroDaPagina(FOLHA, parafrase);
  assert.equal(parafrase.como, "melhor-janela");
  assert.match(parafrase.trecho, /^D\) Qual o valor de k/);
  // Outro assunto: nenhuma janela chega perto, e a lição segue com a referência à página (os primeiros 200 caracteres), sem recusa.
  const inventada = localizarCitacao(FOLHA, "A Revolução Francesa começou em 1789 e mudou a Europa inteira para sempre");
  assert.equal(inventada.como, "pagina-inteira");
  assert.equal(inventada.trecho, FOLHA.trim().slice(0, TRECHO_DA_PAGINA_INTEIRA).trim());
  dentroDaPagina(FOLHA, inventada);
  // Citação vazia, só reticências ou com menos de 3 palavras que não casam: também a página inteira.
  for (const citacao of ["", "   ", "...", "banana"]) {
    assert.equal(localizarCitacao(FOLHA, citacao).como, "pagina-inteira", JSON.stringify(citacao));
  }
});

test("citação: trecho curto (menos de 20) cresce, em linhas inteiras, até 20; página sem texto não tem o que citar", () => {
  const curta = localizarCitacao(FOLHA, "XC = 4");
  dentroDaPagina(FOLHA, curta);
  assert.equal(curta.como, "literal");
  assert.equal(curta.trecho, "=> 3 = -1 + XC => 3 + 1 = XC -> XC = 4", "a linha inteira onde ele está");
  const aindaCurta = localizarCitacao("Título\nk = 0\nfim da folha de exercícios resolvidos", "k = 0");
  assert.equal(aindaCurta.trecho, "Título\nk = 0\nfim da folha de exercícios resolvidos");
  assert.ok(aindaCurta.trecho.length >= TRECHO_MINIMO);
  // Página com menos de 20 caracteres de texto: nada literal a citar.
  assert.equal(localizarCitacao("oi", "oi"), null);
  assert.equal(localizarCitacao("   \n  ok  \n ", "ok"), null);
});

test("citação: o literal tem no máximo 400 caracteres, cortado na última palavra inteira", () => {
  const linha = Array.from({ length: 70 }, (_, i) => `palavra${i + 1}`).join("  ");
  const pagina = `Cabeçalho da página\n${linha}\nRodapé`;
  assert.ok(linha.length > TRECHO_MAXIMO);
  // A IA copia o começo da linha (até 400 caracteres) com os espaços colapsados; o literal tem os espaços duplos e passaria de 400.
  const copia = linha.replace(/ {2}/g, " ").slice(0, 380).replace(/\s\S*$/, "");
  const achada = localizarCitacao(pagina, copia);
  dentroDaPagina(pagina, achada);
  assert.equal(achada.como, "normalizada");
  assert.ok(achada.trecho.length <= TRECHO_MAXIMO);
  assert.ok(achada.trecho.startsWith("palavra1  palavra2"));
  assert.match(achada.trecho, /palavra\d+$/, "termina numa palavra inteira");
});

test("a proposta com a folha real: a citação reescrita não derruba mais; o trecho de cada lição fica literal e o relato diz como casou", () => {
  const paginas = [{ numero: 1, texto: FOLHA }];
  const reescritas = [
    "0 - 6k = 0 / k = 0 / -6 -> k = 0",
    "yG = (YA + YB + YC) / 3 = 3 = 2 + 7 + YC / 3 -> 9 = 9 - 9 = YC = 0 → C = (4, 0)",
    "XG = (XA + XB + XC) / 3 => 1 = 1 + (-2) + XC / 3",
    "Uma frase que a IA inventou e não está na folha",
  ];
  const licoes = reescritas.map((trecho, i) => licaoDoMaterial(i + 1, trecho));
  const { conteudos, citacoes } = conteudosDasLicoes({ licoes, paginas, materialId: "m", nome: "Folha", leitura: "ocr", origem: "Material enviado · Folha" });
  assert.deepEqual(citacoes, ["normalizada", "normalizada", "literal", "pagina-inteira"]);
  for (const conteudo of conteudos) {
    assert.ok(conteudoValido(conteudo));
    const { trecho } = conteudo.referencias[0];
    assert.ok(FOLHA.includes(trecho) && trecho.length >= TRECHO_MINIMO && trecho.length <= TRECHO_MAXIMO, trecho);
    assert.equal(conteudo.referencias[0].leitura, "ocr");
  }
  // O que aconteceu fica no registro, sem o texto da página: só o jeito como a citação casou.
  assert.deepEqual(registrosDe("citacao_ajustada").map((registro) => registro.como), ["normalizada", "normalizada", "pagina-inteira"]);
  assert.equal(registros.join("\n").includes("Revolução"), false);
});

test("a proposta não cai por citação nem por trecho comprido demais ou página escrita como texto: a lição sai com a referência certa", async () => {
  const proposta = propostaDoMaterial(3);
  proposta.licoes[0].trecho = `${TRECHO} ${"e mais texto copiado da página ".repeat(20)}`;
  proposta.licoes[1].pagina = "1";
  proposta.licoes[2].trecho = "0 - 6k = 0 / k = 0";
  responder = () => ok(proposta);
  const gerado = await gerarLicoesDoMaterial({ objetivo: "Estudar para a prova", nome: "caderno.pdf", paginas: PAGINAS_DE_FRACOES });
  assert.equal(gerado.licoes.length, 3, "nenhuma das três derruba a proposta");
  assert.ok(gerado.licoes[0].trecho.length <= TRECHO_MAXIMO);
  assert.equal(gerado.licoes[1].pagina, 1);
  assert.equal(typeof gerado.licoes[1].pagina, "number");
  const folha = [{ numero: 1, texto: FOLHA }];
  const { conteudos, citacoes } = conteudosDasLicoes({ licoes: gerado.licoes, paginas: folha, materialId: "m", nome: "Folha", leitura: "ocr", origem: "Material enviado · Folha" });
  assert.equal(conteudos.length, 3);
  for (const conteudo of conteudos) assert.ok(FOLHA.includes(conteudo.referencias[0].trecho));
  assert.equal(citacoes[2], "normalizada");
});

/* ----- Marco 6: o exemplo degenerado e o papel do derivado ----- */

const ponto = (id, papel, x, y, derivado) => ({ id, papel, x: x ?? null, y: y ?? null, valor: null, rotulo: null, derivado: derivado ?? null });

test("o prompt de matemática, da trilha e do material, pede números sem ponto em cima de outro e o derivado como especial", () => {
  const trilha = corpoDaLicao(esqueletoDeMatematica(GERADOR_OPENAI), 0, 0, "", true).input[0].content;
  for (const [onde, texto] of [["trilha", trilha], ["material", instrucoesDeFigurasDoMaterial]]) {
    assert.match(texto, /Escolha números em que nenhum ponto cai em cima de outro/, onde);
    assert.match(texto, /o procurado C não é igual a G, a A nem a B/, onde);
    assert.match(texto, /os três vértices não ficam alinhados; só a lição de pontos colineares usa pontos alinhados/, onde);
    assert.match(texto, /C = 3·G − A − B em cada coordenada/, onde);
    assert.match(texto, /DESCARTA a figura que tem dois pontos no mesmo lugar/, onde);
    assert.match(texto, /o baricentro G, o ponto médio M e a média SEMPRE são especiais e levam derivado, mesmo quando o enunciado os informa/, onde);
  }
});

test("6: o exercício degenerado (A(2, 3), B(4, 1), G(3, 2): C = G) perde só a figura; a lição, os visuais e a resolução ficam", () => {
  const bruto = copia(exemploDeMatematica);
  bruto.exercicios[0].visual.pontos = [
    ponto("A", "dado", 2, 3), ponto("B", "dado", 4, 1), ponto("C", "procurado", 3, 2), ponto("G", "especial", null, null, { tipo: "baricentro", de: ["A", "B", "C"] }),
  ];
  const lida = normalizarLicao(bruto, ORIGEM);
  assert.ok(lida.conteudo && conteudoValido(lida.conteudo));
  assert.equal("visual" in lida.conteudo.exercicio, false);
  assert.deepEqual(lida.descartados, ["principal:visual"]);
  assert.match(lida.matematica.motivos[0], /^principal\.visual: pontos: G cai em cima de C, os dois em \(3, 2\): escolha números em que o resultado não coincide/);
  assert.deepEqual(lida.matematica.figuras, { enviadas: 1, aceitas: 0 });
  assert.equal(lida.conteudo.visuais.length, 2);
  assert.equal(lida.conteudo.resolucao.passos.length, 5);
  // Com números que não coincidem, a mesma figura vale: C = (4, 0) com A(1, 2), B(−2, 7) e G(1, 3).
  const bom = copia(exemploDeMatematica);
  bom.exercicios[0].visual.pontos = [
    ponto("A", "dado", 1, 2), ponto("B", "dado", -2, 7), ponto("C", "procurado", 4, 0), ponto("G", "especial", null, null, { tipo: "baricentro", de: ["A", "B", "C"] }),
  ];
  assert.equal(normalizarLicao(bom, ORIGEM).conteudo.exercicio.visual.pontos.find((p) => p.id === "G").x, 1);
});

test("6: a figura de um passo da resolução que tem dois pontos no mesmo lugar some do passo; a resolução fica", () => {
  const bruto = copia(exemploDeMatematica);
  // O último passo mostra a resposta M em cima de A (os números da IA estavam errados): a figura do passo some, a conta e o texto ficam.
  bruto.resolucao.passos[4].visual.pontos = [ponto("A", "dado", 1, 2), ponto("B", "dado", 5, 8), ponto("M", "resposta", 1, 2)];
  const lida = normalizarLicao(bruto, ORIGEM);
  assert.equal(lida.conteudo.resolucao.passos.length, 5);
  assert.equal("visual" in lida.conteudo.resolucao.passos[4], false);
  assert.ok(lida.conteudo.resolucao.visual, "a figura do problema continua");
  assert.deepEqual(lida.matematica.resolucao, { enviada: true, aceita: true, conferidas: 4, puladas: 2 });
});

test("6: o baricentro que a IA marca como dado, com derivado, é um ponto de destaque na figura guardada (losango, 'baricentro' na legenda)", () => {
  const bruto = copia(exemploDeMatematica);
  bruto.exercicios[0].visual.pontos = [
    ponto("A", "dado", 1, 2), ponto("B", "dado", -2, 7), ponto("C", "procurado", 4, 0), ponto("G", "dado", null, null, { tipo: "baricentro", de: ["A", "B", "C"] }),
  ];
  const lida = normalizarLicao(bruto, ORIGEM);
  assert.deepEqual(lida.descartados, []);
  const g = lida.conteudo.exercicio.visual.pontos.find((p) => p.id === "G");
  assert.deepEqual(g, { id: "G", papel: "especial", x: 1, y: 3, derivado: { tipo: "baricentro", de: ["A", "B", "C"] } });
  // E com um ponto de coordenadas dadas e sem derivado, o papel dado fica.
  assert.equal(lida.conteudo.exercicio.visual.pontos.find((p) => p.id === "A").papel, "dado");
});

/* ----- Marco 7: o reparo da cor das fórmulas e a única nova tentativa da resolução ----- */

const copiaDe = (valor) => JSON.parse(JSON.stringify(valor));
const semSuaVez = (resolucao) => {
  const sem = copiaDe(resolucao);
  for (const passo of sem.passos) passo.tentativa = null;
  return sem;
};

test("reparo: três realces numa fórmula (o caso real da IA) ficam dois; o texto de dentro e a conta ficam", () => {
  const { latex, motivos } = reescreverRealces("\\foco{3} = \\frac{\\foco{1} + \\foco{5} + y_C}{3}", { resposta: false, procurado: true });
  assert.equal(latex, "\\foco{3} = \\frac{\\foco{1} + 5 + y_C}{3}", "ficam os dois primeiros, e o terceiro perde só o comando e as chaves");
  assert.deepEqual(motivos, ["mais de 2 realces"]);
  // A fórmula que o validador recusava agora lê, e a conta é a mesma.
  assert.equal(lerFormula("\\foco{3} = \\frac{\\foco{1} + \\foco{5} + y_C}{3}").ok, false);
  const lida = lerFormula(latex);
  assert.equal(lida.ok, true);
  assert.equal(formulaLinear(lida.arvore), "3 = (1 + 5 + y_C) ÷ 3");
  // Quatro realces: ficam os dois primeiros e os outros dois saem; com 2 ou menos, nada muda.
  assert.equal(reescreverRealces("\\foco{a} + \\procurado{b} + \\foco{c} + \\foco{d}", { resposta: true, procurado: true }).latex, "\\foco{a} + \\procurado{b} + c + d");
  const intacta = "\\foco{x_C} = \\frac{\\resposta{6}}{2}";
  assert.deepEqual(reescreverRealces(intacta, { resposta: true, procurado: true }), { latex: intacta, motivos: [] });
  // Chaves dentro do realce (fração, matriz) não confundem o fim dele, e o que não é realce passa como está.
  assert.equal(reescreverRealces("\\foco{\\frac{a}{b}} + \\foco{\\sqrt{2}} + \\foco{\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}}", { resposta: true, procurado: true }).latex, "\\foco{\\frac{a}{b}} + \\foco{\\sqrt{2}} + \\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix}");
});

test("reparo: \\resposta só fica no último passo, \\procurado sai do último, e realce dentro de realce perde o de dentro", () => {
  const passos = (formulas) => ({ problema: "Quanto vale k?", passos: formulas.map((formula, i) => ({ nome: `Passo ${i + 1}`, texto: "Texto do passo.", formula })) });
  const { valor, reparos } = repararResolucao(passos([
    "2k = \\resposta{6}",
    "\\foco{\\resposta{k}} = 3",
    "\\procurado{k} = \\resposta{3}",
  ]));
  assert.deepEqual(valor.passos.map((passo) => passo.formula), ["2k = 6", "\\foco{k} = 3", "k = \\resposta{3}"]);
  assert.deepEqual(reparos, [
    "passo 1: 1 realce desembrulhado (\\resposta fora do último passo)",
    "passo 2: 1 realce desembrulhado (dentro de outro realce)",
    "passo 3: 1 realce desembrulhado (\\procurado no passo da resposta)",
  ]);
  // Nas opções do "Sua vez" o \resposta entregaria a certa: sai.
  const comOpcoes = passos(["k = 3"]);
  comOpcoes.passos[0].tentativa = { pergunta: "?", opcoes: [{ formula: "k = \\resposta{3}", correta: true, porque: "a" }, { formula: "k = 4", correta: false, porque: "b" }] };
  const { valor: semEntrega, reparos: reparosDasOpcoes } = repararResolucao(comOpcoes);
  assert.equal(semEntrega.passos[0].tentativa.opcoes[0].formula, "k = 3");
  assert.deepEqual(reparosDasOpcoes, ["passo 1, opção 1: 1 realce desembrulhado (\\resposta fora do último passo)"]);
  // Os visuais da lição não têm último passo: \resposta sai; \foco e \procurado ficam.
  const visuais = repararVisuais([{ tipo: "formula", latex: "x_G = \\foco{\\frac{a}{3}} \\to \\resposta{4}" }, { tipo: "formula", latex: "\\procurado{k} = 2" }, { tipo: "plano", alt: "Os pontos A e B.", pontos: [{ id: "A", x: 1, y: 1 }] }]);
  assert.equal(visuais.valor[0].latex, "x_G = \\foco{\\frac{a}{3}} \\to 4");
  assert.equal(visuais.valor[1].latex, "\\procurado{k} = 2");
  assert.deepEqual(visuais.valor[2], { tipo: "plano", alt: "Os pontos A e B.", pontos: [{ id: "A", x: 1, y: 1 }] }, "a figura não é tocada");
  assert.deepEqual(visuais.reparos, ["visuais[0]: 1 realce desembrulhado (\\resposta fora do último passo)"]);
  // O objeto que a IA mandou não muda (o reparo devolve uma cópia).
  const original = passos(["\\foco{a} + \\foco{b} + \\foco{c}"]);
  const antes = copiaDe(original);
  repararResolucao(original);
  assert.deepEqual(original, antes);
});

test("reparo: o realce a mais numa resolução vale; a conta errada, a resposta final errada e o 'Sua vez' que falta continuam recusados", () => {
  const bom = copiaDe(exemploDeMatematica);
  // 1) O caso real: o passo da substituição com 3 realces (a conta estava certa).
  const tres = copiaDe(bom.resolucao);
  tres.passos[1].formula = "x_M = \\frac{\\foco{1} + \\foco{5}}{\\foco{2}}";
  const lida = lerResolucaoDoModelo(tres);
  assert.ok(lida.resolucao, lida.motivo);
  assert.deepEqual(lida.reparos, ["passo 2: 1 realce desembrulhado (mais de 2 realces)"]);
  assert.equal(lida.resolucao.passos[1].formula, "x_M = \\frac{\\foco{1} + \\foco{5}}{2}");
  // 2) A conta errada com realce a mais: o realce é consertado, a conta continua recusada, com o motivo da conta.
  const contaErrada = copiaDe(bom.resolucao);
  contaErrada.passos[0].formula = "k = 3 \\times 7";
  contaErrada.passos[1].formula = "\\foco{6} - \\foco{2}k = \\foco{0}";
  const errada = lerResolucaoDoModelo(contaErrada);
  assert.equal(errada.resolucao, undefined);
  assert.match(errada.motivo, /a conta não fecha em "6 − 2k = 0": -36 = 0 é falso, com k = 21/);
  assert.deepEqual(errada.reparos, ["passo 2: 1 realce desembrulhado (mais de 2 realces)"]);
  // 3) O "Sua vez" que falta é estrutura: nada a consertar, e a resolução continua recusada.
  const sem = lerResolucaoDoModelo(semSuaVez(bom.resolucao));
  assert.equal(sem.resolucao, undefined);
  assert.equal(sem.motivo, 'a resolução precisa de exatamente um "Sua vez"');
  assert.deepEqual(sem.reparos, []);
  // 4) A resposta final errada com realces a mais: recusada pela conta, não pela cor.
  const finalErrada = copiaDe(bom.resolucao);
  finalErrada.passos[4].formula = "M = \\resposta{(3, 6)}";
  assert.match(lerResolucaoDoModelo(finalErrada).motivo, /a conta não fecha/);
});

test("reparo: não mexe em vazamento nem em papel de ponto: o alt que entrega o procurado e o ponto em cima de outro continuam recusados", () => {
  const vazando = { tipo: "plano", alt: "O triângulo ABC, com C em (4, 0).", pontos: [{ id: "A", papel: "dado", x: 1, y: 2 }, { id: "B", papel: "dado", x: -2, y: 7 }, { id: "C", papel: "procurado", x: 4, y: 0 }] };
  const emCima = { tipo: "plano", alt: "Dois pontos.", pontos: [{ id: "A", papel: "dado", x: 1, y: 2 }, { id: "B", papel: "dado", x: 1, y: 2 }] };
  const formula = { tipo: "formula", latex: "\\foco{a} + \\foco{b} + \\foco{c} = \\resposta{d}", alt: "Fórmula" };
  const lidos = lerVisuaisDoModelo([vazando, emCima, formula]);
  assert.equal(lidos.visuais.length, 1, "só a fórmula, consertada, vale");
  assert.equal(lidos.visuais[0].tipo, "formula");
  assert.equal(lidos.visuais[0].latex, "\\foco{a} + \\foco{b} + c = d");
  assert.match(lidos.motivos[0], /^visuais\[0\]: alt: entrega a posição do ponto procurado/);
  assert.match(lidos.motivos[1], /^visuais\[1\]: pontos: B cai em cima de A/);
  assert.deepEqual(lidos.reparos, ["visuais[2]: 1 realce desembrulhado (mais de 2 realces)", "visuais[2]: 1 realce desembrulhado (\\resposta fora do último passo)"]);
  // Os dados da figura que vazou não foram tocados pelo reparo.
  assert.equal(vazando.alt, "O triângulo ABC, com C em (4, 0).");
});

test("reparo: o relato conta o que foi consertado, o registro leva só a contagem e a lição segue", async () => {
  const bruto = copiaDe(exemploDeMatematica);
  bruto.resolucao.passos[1].formula = "x_M = \\frac{\\foco{1} + \\foco{5}}{\\foco{2}}";
  bruto.visuais.push({ ...bruto.visuais[0], tipo: "formula", latex: "x_M = \\foco{a} \\to \\resposta{b}", alt: "Outra" });
  const lida = normalizarLicao(bruto, ORIGEM);
  assert.ok(lida.conteudo.resolucao);
  assert.deepEqual(lida.matematica.reparos, ["visuais[2]: 1 realce desembrulhado (\\resposta fora do último passo)", "passo 2: 1 realce desembrulhado (mais de 2 realces)"]);
  assert.deepEqual(lida.descartados, []);
  assert.equal(contagensDoRelato(lida.matematica).reparos, 2);
  assert.equal("reparos" in contagensDoRelato(normalizarLicao(copiaDe(exemploDeMatematica), ORIGEM).matematica), false, "sem reparo, o registro é o de sempre");
  responder = () => ok(bruto);
  await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.deepEqual(registrosDe("licao_matematica")[0], { rota: "ia-openai", codigo: "licao_matematica", visuais: "3/3", figuras: "1/1", resolucao: "aceita", reparos: 2, tentativa: 0 });
});

test("o prompt reforça o limite de realces e onde \\resposta e \\procurado valem", () => {
  const { content } = corpoDaLicao(esqueletoDeMatematica(GERADOR_OPENAI), 0, 0, "", true).input[0];
  for (const texto of [content, instrucoesDeFigurasDoMaterial]) {
    assert.match(texto, /3 realces é recusado: conte antes de escrever e fique nos 2 mais importantes/);
    assert.match(texto, /\\resposta só na fórmula do ÚLTIMO passo \(nunca nos visuais da lição, nas opções do "Sua vez" nem nos outros passos\), e \\procurado nunca nesse último passo/);
  }
  assert.match(instrucoesDeFigurasDoMaterial, /Se os dados trouxerem `correcao`/);
});

test("a frase da nova tentativa leva o motivo e, quando é conta, as letras e os valores; passa de 300 caracteres, é cortada", () => {
  assert.equal(
    correcaoDaResolucao('a conta não fecha em "6 − 2k = 0": -36 = 0 é falso, com k = 21'),
    'O "Resolva comigo" da sua resposta anterior foi RECUSADO: a conta não fecha em "6 − 2k = 0": -36 = 0 é falso, com k = 21. Refaça a resolução corrigindo exatamente isso e conferindo cada conta, com OUTROS números que os da pergunta.',
  );
  assert.ok(correcaoDaResolucao("x".repeat(900)).includes(`${"x".repeat(299)}…`));
});

const figurasSemSuaVez = () => ({ ...figurasDoModelo(), resolucao: semSuaVez(figurasDoModelo().resolucao) });
const dadosDoPedido = (pedido) => JSON.parse(pedido.dados.input[0].content[0].text);
const pedidosDeFiguras = () => pedidos.filter((pedido) => pedido.dados.text?.format?.name === "figuras_licao");
const MOTIVO_SEM_SUA_VEZ = 'a resolução precisa de exatamente um "Sua vez"';
const gerarOMaterialDeMatematica = (opcoes) => gerarLicoesDoMaterial({ objetivo: "Estudar baricentro", nome: "Folha", paginas: PAGINAS_DE_MATEMATICA }, opcoes);
const conteudosDoGerado = (gerado) => conteudosDasLicoes({ licoes: gerado.licoes, figuras: gerado.figuras, paginas: PAGINAS_DE_MATEMATICA, materialId: "m", nome: "Folha", leitura: "ocr", origem: "Material enviado · Folha" });

test("material: a resolução recusada por estrutura ganha UMA nova tentativa, com o motivo em uma frase; aceita na segunda, vale", async () => {
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    const { licao, correcao } = dadosDoPedido({ dados });
    return ok(licao.titulo.startsWith("Lição 2") && !correcao ? figurasSemSuaVez() : figurasDoModelo());
  };
  const gerado = await gerarOMaterialDeMatematica();
  assert.equal(pedidos.length, 5, "1 das lições, 3 de figuras e 1 nova tentativa");
  const [nova] = pedidosDeFiguras().filter((pedido) => dadosDoPedido(pedido).correcao);
  assert.equal(pedidosDeFiguras().filter((pedido) => dadosDoPedido(pedido).correcao).length, 1);
  assert.equal(dadosDoPedido(nova).licao.titulo, "Lição 2: o vértice que falta");
  assert.equal(dadosDoPedido(nova).correcao, correcaoDaResolucao(MOTIVO_SEM_SUA_VEZ));
  assert.match(dadosDoPedido(nova).correcao, /RECUSADO: a resolução precisa de exatamente um "Sua vez"\./);
  const { conteudos, relatos } = conteudosDoGerado(gerado);
  assert.equal(conteudos[1].resolucao.passos.length, 5, "a resolução da segunda resposta");
  assert.deepEqual(relatos[1].novaTentativa, { motivo: MOTIVO_SEM_SUA_VEZ, aceita: true });
  assert.equal(relatos[0].novaTentativa, undefined);
  assert.equal(conteudos[1].visuais.length, 2, "os visuais e a figura do exercício seguem");
  assert.deepEqual(registrosDe("resolucao_nova_tentativa"), [{ rota: "estudio-material", codigo: "resolucao_nova_tentativa", aceita: true }]);
});

test("material: a recusa por CONTA volta com as letras e os valores já usados; recusada na segunda, fica o tudo ou nada, sem terceira", async () => {
  const contaErrada = () => {
    const figuras = figurasDoModelo();
    figuras.resolucao.passos[0].formula = "k = 3 \\times 7";
    figuras.resolucao.passos[1].formula = "6 - 2k = 0";
    return figuras;
  };
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    return ok(dadosDoPedido({ dados }).licao.titulo.startsWith("Lição 3") ? contaErrada() : figurasDoModelo());
  };
  const gerado = await gerarOMaterialDeMatematica();
  assert.equal(pedidos.length, 5, "a lição 3 é pedida duas vezes e nenhuma terceira");
  const [nova] = pedidosDeFiguras().filter((pedido) => dadosDoPedido(pedido).correcao);
  assert.match(dadosDoPedido(nova).correcao, /a conta não fecha em "6 − 2k = 0": -36 = 0 é falso, com k = 21\./);
  const { conteudos, relatos } = conteudosDoGerado(gerado);
  assert.equal("resolucao" in conteudos[2], false, "recusada de novo: o tudo ou nada de hoje");
  assert.equal(relatos[2].novaTentativa.aceita, false);
  assert.match(relatos[2].novaTentativa.motivoDaSegunda, /a conta não fecha em "6 − 2k = 0"/);
  assert.equal(relatos[2].resolucao.aceita, false);
  assert.ok(conteudos[2].visuais.length === 2 && conteudoValido(conteudos[2]), "a lição fica com o que a primeira já tinha");
  assert.deepEqual(registrosDe("resolucao_nova_tentativa"), [{ rota: "estudio-material", codigo: "resolucao_nova_tentativa", aceita: false }]);
});

test("material: a segunda que falha (erro do provedor) deixa a lição como a primeira a deixaria; a que vale traz só a resolução melhor", async () => {
  let chamadasDaLicao2 = 0;
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    const { licao } = dadosDoPedido({ dados });
    if (!licao.titulo.startsWith("Lição 2")) return ok(figurasDoModelo());
    chamadasDaLicao2 += 1;
    return chamadasDaLicao2 === 1 ? ok(figurasSemSuaVez()) : erro(500);
  };
  const gerado = await gerarOMaterialDeMatematica();
  assert.equal(chamadasDaLicao2, 2);
  const { conteudos, relatos } = conteudosDoGerado(gerado);
  assert.equal("resolucao" in conteudos[1], false);
  assert.deepEqual(relatos[1].novaTentativa, { motivo: MOTIVO_SEM_SUA_VEZ, aceita: false });
  assert.equal(registrosDe("nova_tentativa_indisponivel").length, 1);
  // A segunda aceita, mas com visuais piores: a resolução é a da segunda, e os visuais ficam os da primeira (mais aceitos).
  pedidos = [];
  registros = [];
  chamadasDaLicao2 = 0;
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    const { licao } = dadosDoPedido({ dados });
    if (!licao.titulo.startsWith("Lição 2")) return ok(figurasDoModelo());
    chamadasDaLicao2 += 1;
    return ok(chamadasDaLicao2 === 1 ? figurasSemSuaVez() : { ...figurasDoModelo(), visuais: [{ tipo: "grafico" }], visual: null });
  };
  const outro = conteudosDoGerado(await gerarOMaterialDeMatematica());
  assert.equal(outro.conteudos[1].resolucao.passos.length, 5);
  assert.equal(outro.conteudos[1].visuais.length, 2, "os visuais da primeira resposta, que eram melhores");
  assert.ok(outro.conteudos[1].exercicio.visual, "e a figura do exercício também");
});

test("material: sem nova tentativa quando a resolução vale, não veio ou só tinha realce a mais (o reparo basta)", async () => {
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    const { licao } = dadosDoPedido({ dados });
    if (licao.titulo.startsWith("Lição 2")) return ok({ ...figurasDoModelo(), resolucao: null });
    if (licao.titulo.startsWith("Lição 3")) {
      const figuras = figurasDoModelo();
      figuras.resolucao.passos[1].formula = "x_M = \\frac{\\foco{1} + \\foco{5}}{\\foco{2}}";
      return ok(figuras);
    }
    return ok(figurasDoModelo());
  };
  const gerado = await gerarOMaterialDeMatematica();
  assert.equal(pedidos.length, 4, "uma lição só de pedido e três de figuras: nenhuma repetição");
  const { conteudos, relatos } = conteudosDoGerado(gerado);
  assert.equal("resolucao" in conteudos[1], false);
  assert.equal(conteudos[2].resolucao.passos.length, 5, "o realce a mais foi consertado e a resolução vale");
  assert.deepEqual(relatos[2].reparos, ["passo 2: 1 realce desembrulhado (mais de 2 realces)"]);
  for (const relato of relatos) assert.equal(relato.novaTentativa, undefined);
  assert.equal(registrosDe("resolucao_nova_tentativa").length, 0);
});

test("material: a nova tentativa respeita a janela da proposta: sem tempo para ela (menos de 12 s), a lição fica como está", async () => {
  responder = (dados) => (dados.text.format.name === "trilha_material" ? ok(propostaDoMaterial()) : ok(dadosDoPedido({ dados }).licao.titulo.startsWith("Lição 2") ? figurasSemSuaVez() : figurasDoModelo()));
  atraso = (dados) => (dados.text?.format?.name === "figuras_licao" ? 400 : 0);
  // O orçamento deixa 12 s e um pouco para as figuras; depois de 400 ms de resposta, sobra menos de 12 s: não repete.
  const gerado = await gerarOMaterialDeMatematica({ orcamentoMs: 12_250 });
  assert.equal(pedidos.length, 4, "nenhuma nova tentativa");
  assert.equal(registrosDe("nova_tentativa_sem_tempo").length, 1);
  const { conteudos, relatos } = conteudosDoGerado(gerado);
  assert.equal("resolucao" in conteudos[1], false);
  assert.equal(relatos[1].novaTentativa, undefined);
  // Com folga, a mesma lição ganha a nova tentativa.
  pedidos = [];
  registros = [];
  await gerarOMaterialDeMatematica({ orcamentoMs: 30_000 });
  assert.equal(pedidos.length, 5);
});

const licaoSemSuaVez = () => {
  const bruto = copiaDe(exemploDeMatematica);
  bruto.resolucao = semSuaVez(bruto.resolucao);
  return bruto;
};

test("trilha (OpenAI): a lição com a resolução recusada é pedida UMA vez de novo, com o motivo; a segunda, melhor, substitui a primeira", async () => {
  let chamadas = 0;
  responder = () => { chamadas += 1; return ok(chamadas === 1 ? licaoSemSuaVez() : exemploDeMatematica); };
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.text.format.name, "licao_studoo_matematica", "a nova tentativa é o mesmo pedido de matemática");
  assert.equal(pedidos[1].dados.input.at(-1).content, correcaoDaResolucao(MOTIVO_SEM_SUA_VEZ));
  assert.equal(conteudo.resolucao.passos.length, 5);
  assert.ok(conteudoValido(conteudo));
  assert.deepEqual(registrosDe("resolucao_nova_tentativa"), [{ rota: "ia-openai", codigo: "resolucao_nova_tentativa", aceita: true, melhor: true }]);
  assert.equal(registrosDe("matematica_desligada").length, 0, "a matemática segue ligada");
});

test("trilha (OpenAI): recusada de novo, falha ou pior que a primeira: fica a primeira lição (o tudo ou nada), e nunca há terceira", async () => {
  // Recusada de novo.
  responder = () => ok(licaoSemSuaVez());
  const igual = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2, "uma nova tentativa só");
  assert.equal("resolucao" in igual, false);
  assert.ok(conteudoValido(igual));
  assert.equal(igual.visuais.length, 2, "a lição fica com o que a primeira trouxe");
  // Erro do provedor na segunda: devolve a primeira, sem lançar.
  pedidos = [];
  let chamadas = 0;
  responder = () => { chamadas += 1; return chamadas === 1 ? ok(licaoSemSuaVez()) : erro(500); };
  const comErro = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal("resolucao" in comErro, false);
  // JSON quebrado na segunda: também a primeira.
  pedidos = [];
  chamadas = 0;
  responder = () => { chamadas += 1; return chamadas === 1 ? ok(licaoSemSuaVez()) : ok("isto não é json"); };
  assert.equal("resolucao" in (await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI))), false);
  assert.equal(pedidos.length, 2);
  // A segunda traz a resolução aceita, mas perdeu todos os visuais e a figura do exercício: vale mais a primeira (resolução conta 2).
  pedidos = [];
  chamadas = 0;
  const pior = copiaDe(exemploDeMatematica);
  pior.visuais = [{ tipo: "grafico" }, { tipo: "grafico" }, { tipo: "grafico" }];
  pior.exercicios[0].visual = { tipo: "grafico" };
  responder = () => { chamadas += 1; return ok(chamadas === 1 ? licaoSemSuaVez() : pior); };
  const mantida = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal("resolucao" in mantida, false, "a segunda vale 2 (a resolução) e a primeira vale 3 (dois visuais e a figura): fica a primeira");
  assert.equal(mantida.visuais.length, 2);
  assert.ok(mantida.exercicio.visual);
  assert.equal(registrosDe("resolucao_nova_tentativa").at(-1).melhor, false);
  // A segunda perde só UM visual e traz a resolução (vale 4 contra 3): a segunda substitui a primeira.
  pedidos = [];
  chamadas = 0;
  const quaseIgual = copiaDe(exemploDeMatematica);
  quaseIgual.visuais = [quaseIgual.visuais[0], { tipo: "grafico" }];
  responder = () => { chamadas += 1; return ok(chamadas === 1 ? licaoSemSuaVez() : quaseIgual); };
  const trocada = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal(trocada.resolucao.passos.length, 5);
  assert.equal(trocada.visuais.length, 1);
});

test("trilha: a lição de resolução aceita é pedida uma vez só, e sem matemática (o pedido de sempre) não há nova tentativa", async () => {
  responder = () => ok(exemploDeMatematica);
  await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 1);
  pedidos = [];
  responder = () => ok(licaoComum);
  await conteudoDaOpenAi(esqueletoDeViolao(GERADOR_OPENAI));
  assert.equal(pedidos.length, 1);
  // Matemática desligada pelo primeiro erro (HTTP): a segunda tentativa é a de sempre, e uma lição comum não tem resolução a refazer.
  pedidos = [];
  let chamadas = 0;
  responder = () => { chamadas += 1; return chamadas === 1 ? erro(400) : ok(licaoComum); };
  await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
});

test("trilha (DeepSeek): a mesma nova tentativa, com o motivo numa mensagem, e a primeira lição volta se a segunda falhar", async () => {
  process.env.IA = "deepseek";
  let chamadas = 0;
  responder = () => { chamadas += 1; return ok(JSON.stringify(chamadas === 1 ? licaoSemSuaVez() : exemploDeMatematica)); };
  const conteudo = await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.messages.at(-1).content, correcaoDaResolucao(MOTIVO_SEM_SUA_VEZ));
  assert.equal(instrucaoDe(pedidos[1]), instrucoesLicaoJsonDeMatematica);
  assert.equal(conteudo.resolucao.passos.length, 5);
  // A segunda falha: a primeira.
  pedidos = [];
  chamadas = 0;
  responder = () => { chamadas += 1; return chamadas === 1 ? ok(JSON.stringify(licaoSemSuaVez())) : erro(500); };
  const mantida = await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 2);
  assert.equal("resolucao" in mantida, false);
  assert.ok(conteudoValido(mantida));
  // Recusada de novo: duas chamadas, nunca três.
  pedidos = [];
  responder = () => ok(JSON.stringify(licaoSemSuaVez()));
  await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 2);
});

/* ----- Marco 8: a frase do "Sua vez" que traz o resultado é recusada, e o motivo (a letra e o valor) vai à nova tentativa ----- */

const comFraseQueEntrega = (resolucao) => {
  const nova = copiaDe(resolucao);
  nova.passos.find((passo) => passo.tentativa).texto = "Faça igual: $y_M = (2 + 8) / 2 = 5$.";
  return nova;
};
const figurasQueEntregam = () => ({ ...figurasDoModelo(), resolucao: comFraseQueEntrega(figurasDoModelo().resolucao) });
const MOTIVO_DA_FRASE = 'o texto do passo 4 (o "Sua vez") traz o resultado y_M = 5 antes da escolha: a frase só diz o que fazer (como "Agora junte os termos e isole k"), sem o valor nem a conta já feita';

test("a frase do \"Sua vez\" que traz o resultado: o motivo, com a letra e o valor, é o da recusa e o da frase da nova tentativa", () => {
  const recusada = lerResolucaoDoModelo(comFraseQueEntrega(exemploDeMatematica.resolucao));
  assert.equal(recusada.resolucao, undefined);
  assert.equal(recusada.motivo, MOTIVO_DA_FRASE);
  assert.equal(
    correcaoDaResolucao(recusada.motivo),
    `O "Resolva comigo" da sua resposta anterior foi RECUSADO: ${MOTIVO_DA_FRASE}. Refaça a resolução corrigindo exatamente isso e conferindo cada conta, com OUTROS números que os da pergunta.`,
  );
  // A frase do exemplo (só diz o que fazer) vale, e o reparo de cor não mexe nisso.
  assert.ok(lerResolucaoDoModelo(exemploDeMatematica.resolucao).resolucao);
});

test("material: a frase do \"Sua vez\" que traz o resultado ganha UMA nova tentativa, com a letra e o valor no motivo; a segunda, sem o vazamento, vale", async () => {
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    const { licao, correcao } = dadosDoPedido({ dados });
    return ok(licao.titulo.startsWith("Lição 2") && !correcao ? figurasQueEntregam() : figurasDoModelo());
  };
  const gerado = await gerarOMaterialDeMatematica();
  assert.equal(pedidos.length, 5, "1 das lições, 3 de figuras e 1 nova tentativa");
  const [nova] = pedidosDeFiguras().filter((pedido) => dadosDoPedido(pedido).correcao);
  assert.equal(dadosDoPedido(nova).licao.titulo, "Lição 2: o vértice que falta");
  assert.equal(dadosDoPedido(nova).correcao, correcaoDaResolucao(MOTIVO_DA_FRASE));
  assert.match(dadosDoPedido(nova).correcao, /RECUSADO: o texto do passo 4 \(o "Sua vez"\) traz o resultado y_M = 5 antes da escolha/);
  const { conteudos, relatos } = conteudosDoGerado(gerado);
  assert.equal(conteudos[1].resolucao.passos[3].texto, "Faça igual com as ordenadas de A e de B.", "a resolução da segunda resposta");
  assert.deepEqual(relatos[1].novaTentativa, { motivo: MOTIVO_DA_FRASE, aceita: true });
  assert.deepEqual(registrosDe("resolucao_nova_tentativa"), [{ rota: "estudio-material", codigo: "resolucao_nova_tentativa", aceita: true }]);
  // Nenhuma resolução que fica entrega o resultado no texto público do passo do "Sua vez".
  for (const conteudo of conteudos) {
    const passo = conteudo.resolucao.passos.find((candidato) => candidato.tentativa);
    assert.doesNotMatch(passo.texto, /= ?5|\b5\b/);
  }
});

test("material: a segunda que entrega de novo deixa a lição sem o \"Resolva comigo\" (tudo ou nada), com o resto, e nunca há terceira", async () => {
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    return ok(dadosDoPedido({ dados }).licao.titulo.startsWith("Lição 3") ? figurasQueEntregam() : figurasDoModelo());
  };
  const gerado = await gerarOMaterialDeMatematica();
  assert.equal(pedidos.length, 5, "a lição 3 é pedida duas vezes e nenhuma terceira");
  const { conteudos, relatos } = conteudosDoGerado(gerado);
  assert.equal("resolucao" in conteudos[2], false);
  assert.equal(relatos[2].novaTentativa.aceita, false);
  assert.equal(relatos[2].novaTentativa.motivoDaSegunda, MOTIVO_DA_FRASE);
  assert.ok(conteudos[2].visuais.length === 2 && conteudoValido(conteudos[2]), "os visuais e a figura do exercício seguem");
});

test("trilha (OpenAI e DeepSeek): a lição cuja frase do \"Sua vez\" entrega é pedida UMA vez de novo, com o motivo; a segunda, sem vazamento, substitui a primeira", async () => {
  const entrega = () => {
    const bruto = copiaDe(exemploDeMatematica);
    bruto.resolucao = comFraseQueEntrega(bruto.resolucao);
    return bruto;
  };
  let chamadas = 0;
  responder = () => { chamadas += 1; return ok(chamadas === 1 ? entrega() : exemploDeMatematica); };
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.input.at(-1).content, correcaoDaResolucao(MOTIVO_DA_FRASE));
  assert.equal(conteudo.resolucao.passos[3].texto, "Faça igual com as ordenadas de A e de B.");
  assert.deepEqual(registrosDe("resolucao_nova_tentativa"), [{ rota: "ia-openai", codigo: "resolucao_nova_tentativa", aceita: true, melhor: true }]);
  // DeepSeek: a mesma coisa, o motivo vai numa mensagem.
  process.env.IA = "deepseek";
  pedidos = [];
  chamadas = 0;
  responder = () => { chamadas += 1; return ok(JSON.stringify(chamadas === 1 ? entrega() : exemploDeMatematica)); };
  const deSeek = await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.messages.at(-1).content, correcaoDaResolucao(MOTIVO_DA_FRASE));
  assert.equal(deSeek.resolucao.passos[3].texto, "Faça igual com as ordenadas de A e de B.");
  // Entrega de novo: a lição fica sem o "Resolva comigo", com o resto, e são só duas chamadas.
  pedidos = [];
  responder = () => ok(JSON.stringify(entrega()));
  const igual = await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 2);
  assert.equal("resolucao" in igual, false);
  assert.ok(conteudoValido(igual));
});

/* ----- A IA falsa de geometria analítica (demonstração, sem chave) ----- */

const geometria = DEMOS.find(({ chave }) => chave === "geometria");
const licoesDaGeometria = geometria.plano.fluxos.flatMap(({ licoes }) => licoes);

test("a demonstração de geometria analítica: seis lições na ordem de sempre, reconhecida pelo assunto, sem tirar a vez das outras", () => {
  assert.equal(licoesDaGeometria.length, 6);
  assert.deepEqual(geometria.plano.fluxos.map(({ titulo }) => titulo), ["Primeiros passos", "Praticando", "Desafio"]);
  assert.ok(licoesDaGeometria.at(-1).titulo.startsWith("Revisão"));
  for (const objetivo of ["Geometria analítica: do ponto ao alinhamento", "Quero entender o baricentro de um triângulo", "pontos colineares", "ponto médio de um segmento", "Plano cartesiano para a prova"]) {
    assert.equal(demoDoObjetivo(objetivo)?.chave, "geometria", objetivo);
  }
  for (const [objetivo, chave] of [["Frações para a prova do 6º ano", "fracoes"], ["Violão do zero: primeiros acordes", "violao"], ["Fotografia com o celular", "fotografia"]]) {
    assert.equal(demoDoObjetivo(objetivo)?.chave, chave, objetivo);
  }
  assert.equal(geometria.plano.origem, "Modo demonstração: trilha pronta sobre geometria analítica");
});

test("a demonstração de geometria: toda lição fecha, com figura, fórmula e a resolução conferida onde ela existe", () => {
  const esperado = {
    "Localizar pontos no plano": { visuais: ["plano"], resolucao: false },
    "Ponto médio de um segmento": { visuais: ["formula", "plano"], resolucao: true },
    "Abscissas e o baricentro": { visuais: ["formula", "reta_numerica"], resolucao: true },
    "Baricentro: achando o terceiro vértice": { visuais: ["formula", "plano"], resolucao: true },
    "Pontos colineares e o determinante": { visuais: ["formula", "plano"], resolucao: true },
    "Revisão: ponto médio, baricentro e alinhamento": { visuais: ["plano"], resolucao: false },
  };
  assert.deepEqual(licoesDaGeometria.map(({ titulo }) => titulo), Object.keys(esperado));
  for (const licao of licoesDaGeometria) {
    const { visuais, resolucao } = esperado[licao.titulo];
    assert.ok(conteudoValido(licao), licao.titulo);
    assert.deepEqual(licao.visuais.map((visual) => visual.tipo), visuais, licao.titulo);
    assert.equal(Boolean(licao.resolucao), resolucao, licao.titulo);
    assert.ok(licao.outroJeito && licao.outroJeito !== licao.conceito && licao.outroJeito !== licao.exemplo, licao.titulo);
    // O que está guardado é a forma que o validador devolve: validar de novo não muda nada.
    for (const visual of licao.visuais) assert.deepEqual(normalizarVisual(visual), visual, `${licao.titulo}: visual`);
    if (licao.resolucao) assert.deepEqual(normalizarResolucao(licao.resolucao), licao.resolucao, `${licao.titulo}: resolução`);
    for (const exercicio of [licao.exercicio, ...(licao.extras ?? [])]) {
      if (exercicio.visual) assert.deepEqual(normalizarVisual(exercicio.visual), exercicio.visual, `${licao.titulo}: figura do exercício`);
    }
  }
  const comResolucao = licoesDaGeometria.filter(({ resolucao }) => resolucao);
  assert.equal(comResolucao.length, 4);
  assert.equal(licoesDaGeometria.filter(({ exercicio }) => exercicio.visual).length, 4, "quatro exercícios com a figura do enunciado");
});

test("a demonstração de geometria não vaza o ponto procurado: no JSON público dele nenhuma posição, e a resolução vai só até o Sua vez", async () => {
  const TUDO = { visuais: 1, resolucao: 1 };
  for (const licao of licoesDaGeometria) {
    const exercicios = [licao.exercicio, ...(licao.extras ?? [])].map(apresentarExercicio);
    const detalhe = {
      id: "licao-1", planoId: "plano-1", fluxoId: "fluxo-1", titulo: licao.titulo, objetivo: licao.objetivo, conceito: licao.conceito, exemplo: licao.exemplo,
      origem: licao.origem, exercicio: exercicios[0], exercicios, concluida: false,
    };
    const saida = await comVisuais(detalhe, licao, { capacidades: TUDO, desenharPng: false });
    const escondidos = [saida.exercicio.visual, ...(saida.resolucao?.passos.map((passo) => passo.visual) ?? []), saida.resolucao?.visual]
      .flatMap((visual) => visual?.pontos?.filter((ponto) => ponto.papel === "procurado" || ponto.papel === "resposta") ?? []);
    for (const ponto of escondidos) assert.deepEqual(Object.keys(ponto).sort(), ["id", "papel"], `${licao.titulo}: ${ponto.id}`);
    if (saida.resolucao) {
      const corte = saida.resolucao.passos.findIndex((passo) => passo.tentativa);
      assert.equal(corte, saida.resolucao.passos.length - 1, `${licao.titulo}: nenhum passo depois do Sua vez`);
      assert.equal(JSON.stringify(saida.resolucao).includes("correta"), false, `${licao.titulo}: sem o gabarito do Sua vez`);
    }
  }
});

test("marco 11: o pedido manda marcar só a fórmula completa e deixar a conta que fica pela metade da lacuna em texto comum, na lição e no material", () => {
  for (const [nome, instrucoes] of [["lição", instrucoesDeMatematica], ["material", instrucoesDeNotacaoDoMaterial]]) {
    assert.match(instrucoes, /Marque só a fórmula COMPLETA, que fecha antes da lacuna/, nome);
    assert.match(instrucoes, /"\$h = 12\$" está certo e "\$h = \$ ___" está errado/, `${nome}: o exemplo certo e o errado`);
    assert.match(instrucoes, /sem cifrões \("h = ___"\)/, `${nome}: a conta pela metade vai em texto comum`);
  }
});

/* ----- Marco 11b: o nome do passo é só texto (peso 800: nunca entra fórmula, spec 15, seção 14) ----- */

test("marco 11b: o nome do passo com símbolo recusa a resolução da IA, com o motivo na nova tentativa; o já gravado segue lendo; a IA falsa não escreve assim", () => {
  const base = JSON.parse(JSON.stringify(licoesDaGeometria.find(({ titulo }) => titulo.startsWith("Baricentro")).resolucao));
  const comNome = (nome) => ({ ...base, passos: base.passos.map((passo, posicao) => (posicao === 2 ? { ...passo, nome } : passo)) });
  for (const nome of ["Isole x_C", "Isole $x_C$", "Eleve a x^2", "Valor em $y_{AB}$"]) {
    const lida = lerResolucaoDoModelo(comNome(nome));
    assert.equal(lida.resolucao, undefined, `${nome} devia ser recusado`);
    assert.match(lida.motivo, /passo 3: o nome ".*" tem símbolo \(_ \^ \\ \$ \{ \}\)/, nome);
    assert.ok(correcaoDaResolucao(lida.motivo).includes('"Isole a abscissa de C", e não "Isole x_C"'), `${nome}: a nova tentativa recebe o motivo e o exemplo`);
  }
  for (const nome of ["Isole a abscissa de C", "Isole k", "A fórmula", "O vértice C", "O mesmo para a ordenada"]) {
    const lida = lerResolucaoDoModelo(comNome(nome));
    assert.ok(lida.resolucao, `${nome}: ${lida.motivo}`);
  }
  // A barra e a chave soltas o texto simples já limpa antes (viram a letra grega ou somem): o nome sai limpo, e não recusado.
  assert.equal(lerResolucaoDoModelo(comNome("Troque \\alpha")).resolucao?.passos[2].nome, "Troque α");
  assert.equal(lerResolucaoDoModelo(comNome("Isole {C}")).resolucao?.passos[2].nome, "Isole C");
  // A lição gravada antes da regra segue com o "Resolva comigo" dela: a leitura não é a geração.
  assert.ok(normalizarResolucao(comNome("Isole x_C")), "o gravado com x_C segue lendo");
  assert.match(instrucoesDeMatematica, /sem letra com índice, sem expoente e sem fórmula; "Isole a abscissa de C", e não "Isole x_C"/, "o pedido à IA diz como é o nome");
  // A IA falsa (as demonstrações) já não escreve nome de passo com símbolo, e o que ela escreve passa pela geração.
  for (const licao of licoesDaGeometria) {
    for (const passo of licao.resolucao?.passos ?? []) assert.doesNotMatch(passo.nome, /[_^\\${}]/, `${licao.titulo}: ${passo.nome}`);
    if (licao.resolucao) assert.ok(lerResolucaoDoModelo(licao.resolucao).resolucao, `${licao.titulo}: a demonstração passa pela geração`);
  }
  assert.deepEqual(licoesDaGeometria.flatMap((licao) => licao.resolucao?.passos.map((passo) => passo.nome) ?? []).filter((nome) => /^(Isole a abscissa de C|O mesmo para a ordenada)$/.test(nome)), ["Isole a abscissa de C", "O mesmo para a ordenada"]);
});

/* ----- Marco 12a: o pedido à IA do gráfico de função, o esquema e a IA falsa de funções ----- */

test("12a: o pedido à IA traz o gráfico de função (regras, a curva escondida do procurado e os três exemplos) e o esquema aceita o que ele pede", () => {
  for (const [nome, instrucoes] of [["lição", instrucoesDeMatematica], ["figuras do material", instrucoesDeFigurasDoMaterial]]) {
    assert.match(instrucoes, /Gráfico de função, para a lição que fala de uma função de x/, nome);
    assert.match(instrucoes, /{tipo: "funcao", alt, curvas, pontos}/, `${nome}: o formato`);
    assert.match(instrucoes, /Tangente, log, exponencial, divisão por x e módulo NÃO valem/, `${nome}: o que invalida a curva`);
    assert.match(instrucoes, /dê só o tipo \("raiz", "vertice", "intercepto", "valor" com o x\).*NÃO escreva x e y desses/, `${nome}: o servidor calcula os destaques`);
    assert.match(instrucoes, /esse ponto leva papel "procurado" e o seu tipo: o gráfico do enunciado fica SEM a curva/, `${nome}: o procurado`);
    for (const exemplo of ['latex: "x^2 - 4x + 3"', 'latex: "2x + 1", nome: "g"', 'latex: "\\sin x", nome: "h"']) assert.ok(instrucoes.includes(exemplo), `${nome}: o exemplo ${exemplo}`);
    assert.match(instrucoes, /ainda não vale no "Resolva comigo"/, `${nome}: fora da resolução`);
  }
  // O esquema (Structured Outputs: todos os campos, null onde não se aplica) aceita o gráfico e o ponto com tipo.
  assert.ok(esquemaDoVisual.properties.tipo.enum.includes("funcao"));
  assert.deepEqual(Object.keys(esquemaDoVisual.properties.curvas.items.properties), ["latex", "nome", "de", "ate"]);
  const ponto = esquemaDoVisual.properties.pontos.items.properties;
  assert.deepEqual(ponto.tipo.enum, ["raiz", "vertice", "intercepto", "intersecao", "valor", null]);
  assert.deepEqual(ponto.x.type, ["number", "string", "null"], "o x pode trazer π");
  assert.equal(esquemaDoVisual.required.length, Object.keys(esquemaDoVisual.properties).length, "todos os campos obrigatórios (nulos onde não se aplicam)");
  // O que o modelo devolve nesse esquema, com os nulos, vira o gráfico validado.
  const doModelo = {
    tipo: "funcao", alt: "Parábola de f(x) = x² − 4x + 3, com as raízes A e B e o vértice V.", latex: null, de: null, ate: null,
    curvas: [{ latex: "x^2 - 4x + 3", nome: "f", de: null, ate: null }],
    pontos: ["A", "B"].map((id) => ({ id, papel: "especial", x: null, y: null, valor: null, tipo: "raiz", curva: null, rotulo: null, derivado: null }))
      .concat([{ id: "V", papel: "especial", x: null, y: null, valor: null, tipo: "vertice", curva: null, rotulo: null, derivado: null }]),
    segmentos: null, poligonos: null, guias: null, intervalos: null,
  };
  const lido = lerVisuaisDoModelo([doModelo]);
  assert.equal(lido.visuais?.[0].tipo, "funcao", lido.motivos.join("; "));
  assert.deepEqual(lido.visuais[0].pontos.map(({ id, x, y }) => [id, x, y]), [["A", 1, 0], ["B", 3, 0], ["V", 2, -1]]);
});

const funcoes = DEMOS.find(({ chave }) => chave === "funcoes");
const licoesDeFuncoes = funcoes.plano.fluxos.flatMap(({ licoes }) => licoes);

test("12a: a demonstração de funções reconhece o objetivo sem tirar a vez da geometria, e toda lição fecha com o gráfico que desenha", () => {
  for (const objetivo of ["Funções do segundo grau e parábolas", "gráfico do seno e do cosseno", "Como é o gráfico de uma função afim"]) {
    assert.equal(demoDoObjetivo(objetivo)?.chave, "funcoes", objetivo);
  }
  for (const objetivo of ["Geometria analítica: do ponto ao alinhamento", "Quero entender o baricentro de um triângulo", "plano cartesiano"]) {
    assert.equal(demoDoObjetivo(objetivo)?.chave, "geometria", objetivo);
  }
  assert.deepEqual(licoesDeFuncoes.map(({ titulo }) => titulo), ["O gráfico de uma reta", "A parábola e os seus pontos", "Lendo a onda do seno", "Revisão: reta, parábola e seno"]);
  assert.deepEqual(funcoes.plano.fluxos.map(({ titulo }) => titulo), ["Primeiros passos", "Praticando", "Desafio"]);
  for (const licao of licoesDeFuncoes) {
    assert.ok(conteudoValido(licao), licao.titulo);
    assert.ok(licao.visuais.some((visual) => visual.tipo === "funcao"), `${licao.titulo}: o gráfico da lição`);
    assert.ok(licao.outroJeito && licao.outroJeito !== licao.conceito && licao.outroJeito !== licao.exemplo, licao.titulo);
    for (const visual of licao.visuais) assert.deepEqual(normalizarVisual(visual), visual, `${licao.titulo}: o guardado é o que o validador devolve`);
    for (const exercicio of [licao.exercicio, ...(licao.extras ?? [])]) {
      if (exercicio.visual) assert.deepEqual(normalizarVisual(exercicio.visual), exercicio.visual, `${licao.titulo}: figura do exercício`);
    }
    // Cada gráfico se desenha no enunciado e no retorno, sem faltar lugar.
    for (const visual of [...licao.visuais, ...[licao.exercicio, ...(licao.extras ?? [])].flatMap((exercicio) => (exercicio.visual ? [exercicio.visual] : []))]) {
      if (visual.tipo !== "funcao") continue;
      for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }]) {
        const desenho = desenharVisual(visual, contexto);
        assert.ok(desenho && !desenho.naoCabe, `${licao.titulo}: ${contexto.tipo}`);
      }
    }
  }
  // A lição da parábola leva a fórmula igual à da faixa de cima como visual `formula`: o servidor não a repete.
  assert.deepEqual(licoesDeFuncoes[1].visuais.map((visual) => visual.tipo), ["formula", "funcao"]);
  // Os quatro exercícios com figura perguntam um ponto da curva: o enunciado esconde a curva, e o retorno a mostra.
  const comFigura = licoesDeFuncoes.flatMap((licao) => [licao.exercicio, ...(licao.extras ?? [])]).filter((exercicio) => exercicio.visual);
  assert.equal(comFigura.length, 4);
  for (const exercicio of comFigura) {
    const procurados = exercicio.visual.pontos.filter((ponto) => ponto.papel === "procurado");
    assert.equal(procurados.length, 1, exercicio.enunciado);
  }
});

test("12a: a demonstração de funções não vaza o ponto procurado (o JSON público dele sem a posição) e a curva do enunciado fica escondida", async () => {
  for (const licao of licoesDeFuncoes) {
    const exercicios = [licao.exercicio, ...(licao.extras ?? [])].map(apresentarExercicio);
    const detalhe = {
      id: "licao-1", planoId: "plano-1", fluxoId: "fluxo-1", titulo: licao.titulo, objetivo: licao.objetivo, conceito: licao.conceito, exemplo: licao.exemplo,
      origem: licao.origem, exercicio: exercicios[0], exercicios, concluida: false,
    };
    const saida = await comVisuais(detalhe, licao, { capacidades: { visuais: 2, resolucao: 1 }, desenharPng: false });
    const escondidos = saida.exercicios.flatMap((exercicio) => exercicio.visual?.pontos?.filter((ponto) => ponto.papel === "procurado" || ponto.papel === "resposta") ?? []);
    assert.ok(escondidos.length >= 1, licao.titulo);
    for (const ponto of escondidos) assert.deepEqual(Object.keys(ponto).sort(), ["id", "papel", "tipo"].filter((chave) => chave in ponto), `${licao.titulo}: ${ponto.id}`);
    for (const exercicio of saida.exercicios.filter((item) => item.visual)) {
      const enunciado = desenharVisual(exercicio.visual, { tipo: "enunciado" });
      assert.equal(enunciado.primitivas.filter((primitiva) => primitiva.tipo === "caminho" && primitiva.larguraDaBorda === 3 && primitiva.borda !== "branco").length, 0, `${licao.titulo}: sem a curva no enunciado`);
    }
    // Com só visuais@1 nenhum gráfico de função vai; sem cabeçalho, nenhum campo novo e o PNG.
    const so1 = await comVisuais(detalhe, licao, { capacidades: { visuais: 1, resolucao: 1 } });
    assert.ok(!(so1.visuais ?? []).some((visual) => visual.tipo === "funcao"), `${licao.titulo}: visuais@1`);
    assert.ok(so1.exercicios.every((exercicio) => !exercicio.visual), `${licao.titulo}: o exercício sem figura`);
  }
});

/* ----- Marco 13a: a figura do exercício que entrega a resposta ----- */

/** O exemplo de matemática com o exercício principal trocado: o que a IA mandaria (a opção "a" é a certa, a menos que o gabarito diga outra). */
function licaoComFigura({ enunciado, opcoes, visual, gabarito = ["a"], tipo = "multipla_escolha" }) {
  const bruto = copia(exemploDeMatematica);
  const exercicio = bruto.exercicios[0];
  exercicio.tipo = tipo;
  exercicio.enunciado = enunciado;
  exercicio.opcoes = tipo === "multipla_escolha" ? opcoes.map((texto, indice) => ({ id: "abc"[indice], texto })) : null;
  exercicio.gabarito = gabarito;
  exercicio.visual = visual;
  return bruto;
}

const planoDe = (alt, pontos, extra = {}) => ({ tipo: "plano", alt, pontos, ...extra });

test("13a: os pares de coordenadas de um texto: (0, 1) e (1, 3), com $, \\left, decimal com ponto e vírgula, fração; o que não é par fica de fora", () => {
  assert.deepEqual(paresDeCoordenadasDoTexto("(0, 1) e (1, 3)"), [[0, 1], [1, 3]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("$(0, 1)$ e $(1, 3)$"), [[0, 1], [1, 3]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("Q(3, 2)"), [[3, 2]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("$C(−1, 2)$"), [[-1, 2]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("$\\left(0, 1\\right)$"), [[0, 1]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("(0,1)"), [[0, 1]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("A(1,5; −2)"), [[1.5, -2]], "com ponto e vírgula, a vírgula é decimal");
  assert.deepEqual(paresDeCoordenadasDoTexto("(1.5, 2)"), [[1.5, 2]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("$(1/2, 3)$"), [[0.5, 3]]);
  assert.deepEqual(paresDeCoordenadasDoTexto("$\\left(\\frac{1}{2}, 3\\right)$"), [[0.5, 3]]);
  for (const nao of ["(x + 1)", "(2, 3, 4)", "f(2)", "(a, b)", "x = 3", "(1,5, 2)", "(2 + 3)", ""]) assert.deepEqual(paresDeCoordenadasDoTexto(nao), [], nao);
});

test("13a: o caso real 1 (f(x) = 2x + 1): os pontos A (0, 1) e B (1, 3) estão na figura e são a opção certa; a figura sai, o exercício e a lição ficam", () => {
  const lida = normalizarLicao(licaoComFigura({
    enunciado: "Na função $f(x) = 2x + 1$, quais pontos pertencem ao gráfico?",
    opcoes: ["$(0, 1)$ e $(1, 3)$", "$(0, 2)$ e $(1, 4)$", "$(1, 0)$ e $(3, 1)$"],
    visual: planoDe("Os pontos A (0, 1) e B (1, 3) no plano, por onde passa a reta de f.", [
      { id: "A", papel: "dado", x: 0, y: 1 }, { id: "B", papel: "dado", x: 1, y: 3 },
    ], { segmentos: [{ de: "A", ate: "B" }] }),
  }), ORIGEM);
  assert.equal("visual" in lida.conteudo.exercicio, false, "o exercício segue sem figura");
  assert.ok(conteudoValido(lida.conteudo));
  assert.equal(lida.conteudo.exercicio.enunciado, "Na função $f(x) = 2x + 1$, quais pontos pertencem ao gráfico?");
  assert.deepEqual(lida.descartados, ["principal:visual"]);
  assert.deepEqual(lida.matematica.figuras, { enviadas: 1, aceitas: 0 });
  assert.equal(lida.matematica.motivos.length, 1);
  assert.match(lida.matematica.motivos[0], /^principal\.visual: figura entrega a resposta: o ponto A \(0, 1\) da figura é um dos pares da opção certa$/);
  assert.ok(lida.conteudo.visuais.length >= 1 && lida.conteudo.resolucao, "os visuais e a resolução da lição não mudam");
});

test("13a: o caso real 2: a opção certa (3, 2) é o ponto Q que a figura rotula; em múltipla escolha e em lacuna", () => {
  const visual = planoDe("Os pontos P (1, 1) e Q (3, 2) no plano.", [{ id: "P", papel: "dado", x: 1, y: 1 }, { id: "Q", papel: "dado", x: 3, y: 2 }]);
  const emEscolha = normalizarLicao(licaoComFigura({
    enunciado: "O ponto Q é o ponto P deslocado 2 para a direita e 1 para cima. Quais são as coordenadas de Q?",
    opcoes: ["$(3, 2)$", "$(2, 3)$", "$(3, 1)$"], visual,
  }), ORIGEM);
  assert.equal("visual" in emEscolha.conteudo.exercicio, false);
  assert.match(emEscolha.matematica.motivos[0], /figura entrega a resposta: o ponto Q \(3, 2\) da figura é o par da opção certa/);
  const emLacuna = normalizarLicao(licaoComFigura({
    enunciado: "Q é o ponto P deslocado 2 para a direita e 1 para cima. Então Q = ___.", tipo: "lacuna", opcoes: [], gabarito: ["(3, 2)"], visual,
  }), ORIGEM);
  assert.equal(emLacuna.conteudo.exercicio.tipo, "lacuna");
  assert.equal("visual" in emLacuna.conteudo.exercicio, false);
  assert.match(emLacuna.matematica.motivos[0], /^principal\.visual: figura entrega a resposta: o ponto Q/);
});

test("13a: o exercício que NÃO entrega fica com a figura: o procurado escondido, os pontos dados diferentes da resposta e a leitura da grade sem rótulo", () => {
  // O exemplo de sempre: a opção certa é o ponto médio M, que a figura marca como PROCURADO (nem aparece no enunciado).
  const exemplo = normalizarLicao(copia(exemploDeMatematica), ORIGEM);
  assert.equal(exemplo.conteudo.exercicio.visual.tipo, "plano");
  assert.deepEqual(exemplo.descartados, []);
  assert.deepEqual(exemplo.matematica.figuras, { enviadas: 1, aceitas: 1 });
  // Os pontos dados A e B são rotulados e a resposta é outro par.
  const outroPar = normalizarLicao(licaoComFigura({
    enunciado: "O ponto $C$ é o simétrico de $A(2, 4)$ em relação à origem. Quais as coordenadas de $C$?",
    opcoes: ["$(−2, −4)$", "$(2, −4)$", "$(−2, 4)$"],
    visual: planoDe("Os pontos A (2, 4) e B (6, 10) no plano.", [{ id: "A", papel: "dado", x: 2, y: 4 }, { id: "B", papel: "dado", x: 6, y: 10 }]),
  }), ORIGEM);
  assert.equal(outroPar.conteudo.exercicio.visual.tipo, "plano");
  assert.deepEqual(outroPar.descartados, []);
  // A leitura da coordenada na grade: o ponto Q SEM rótulo (nem letra, nem par) é a pergunta legítima, e o alt não diz o par.
  const lerNaGrade = normalizarLicao(licaoComFigura({
    enunciado: "Quais são as coordenadas do ponto marcado no plano?",
    opcoes: ["$(3, 2)$", "$(2, 3)$", "$(3, −2)$"],
    visual: planoDe("Um ponto marcado no primeiro quadrante.", [{ id: "Q", papel: "dado", x: 3, y: 2, rotulo: false }]),
  }), ORIGEM);
  assert.equal(lerNaGrade.conteudo.exercicio.visual.tipo, "plano");
  assert.deepEqual(lerNaGrade.descartados, []);
  // O mesmo ponto COM o rótulo "Q (3, 2)" entrega: a figura sai.
  const comRotulo = normalizarLicao(licaoComFigura({
    enunciado: "Quais são as coordenadas do ponto marcado no plano?",
    opcoes: ["$(3, 2)$", "$(2, 3)$", "$(3, −2)$"],
    visual: planoDe("Um ponto marcado no primeiro quadrante.", [{ id: "Q", papel: "dado", x: 3, y: 2 }]),
  }), ORIGEM);
  assert.equal("visual" in comRotulo.conteudo.exercicio, false);
  assert.match(comRotulo.matematica.motivos[0], /figura entrega a resposta: o ponto Q \(3, 2\)/);
  // Resposta que não é par (distância, área) nunca é afetada; o par numa opção ERRADA também não.
  const distancia = normalizarLicao(licaoComFigura({
    enunciado: "Qual é a distância entre $A(0, 0)$ e $B(3, 4)$?",
    opcoes: ["$5$", "$7$", "$(3, 4)$"],
    visual: planoDe("Os pontos A (0, 0) e B (3, 4) no plano.", [{ id: "A", papel: "dado", x: 0, y: 0 }, { id: "B", papel: "dado", x: 3, y: 4 }]),
  }), ORIGEM);
  assert.equal(distancia.conteudo.exercicio.visual.tipo, "plano", "o (3, 4) está numa opção errada: não é a resposta");
});

test("13a: o ponto derivado visível (ponto médio dado) e o que o alt diz também contam; a reta numérica e o procurado, não", () => {
  const medio = normalizarLicao(licaoComFigura({
    enunciado: "Qual é o ponto médio de $A(0, 0)$ e $B(4, 2)$?",
    opcoes: ["$(2, 1)$", "$(4, 2)$", "$(1, 2)$"],
    visual: planoDe("Os pontos A, B e M no plano.", [
      { id: "A", papel: "dado", x: 0, y: 0 }, { id: "B", papel: "dado", x: 4, y: 2 }, { id: "M", papel: "especial", derivado: { tipo: "ponto_medio", de: ["A", "B"] } },
    ]),
  }), ORIGEM);
  assert.equal("visual" in medio.conteudo.exercicio, false, "o M calculado pelo servidor aparece rotulado: (2, 1) é a resposta");
  assert.match(medio.matematica.motivos[0], /o ponto M \(2, 1\)/);
  // O ponto sem rótulo, mas o alt diz o par: o leitor de tela e a figura que não cabe entregam a resposta.
  const noAlt = normalizarLicao(licaoComFigura({
    enunciado: "Quais são as coordenadas do ponto marcado no plano?",
    opcoes: ["$(3, 2)$", "$(2, 3)$", "$(3, −2)$"],
    visual: planoDe("O ponto Q (3, 2) marcado no plano.", [{ id: "Q", papel: "dado", x: 3, y: 2, rotulo: false }]),
  }), ORIGEM);
  assert.equal("visual" in noAlt.conteudo.exercicio, false);
  assert.match(noAlt.matematica.motivos[0], /figura entrega a resposta: o alt da figura traz o par \(3, 2\) da opção certa/);
  // Reta numérica não tem par; o procurado (escondido) e a resposta (só no retorno) não entregam nada.
  const certo = { tipo: "multipla_escolha", gabarito: ["a"], opcoes: [{ id: "a", texto: "$(3, 2)$" }, { id: "b", texto: "$(2, 3)$" }] };
  assert.equal(figuraQueEntregaARespostaDoExercicio(certo, normalizarVisual({ tipo: "reta_numerica", alt: "x", de: 0, ate: 5, pontos: [{ id: "A", papel: "dado", valor: 3 }] })), null);
  for (const papel of ["procurado", "resposta"]) {
    const figura = normalizarVisual(planoDe("Um ponto.", [{ id: "A", papel: "dado", x: 1, y: 1 }, { id: "Q", papel, x: 3, y: 2 }]));
    assert.equal(figuraQueEntregaARespostaDoExercicio(certo, figura), null, papel);
  }
  // Sem par na resposta, sem entrega (e os outros tipos de exercício nem olham).
  const sem = { tipo: "multipla_escolha", gabarito: ["a"], opcoes: [{ id: "a", texto: "$5$" }] };
  assert.equal(figuraQueEntregaARespostaDoExercicio(sem, normalizarVisual(planoDe("x", [{ id: "A", papel: "dado", x: 5, y: 5 }]))), null);
  assert.equal(figuraQueEntregaARespostaDoExercicio({ tipo: "verdadeiro_falso", gabarito: ["v"] }, normalizarVisual(planoDe("x", [{ id: "A", papel: "dado", x: 3, y: 2 }]))), null);
});

test("13a: o gráfico de função com o ponto especial (intercepto) que é a opção certa também perde a figura", () => {
  const funcao = {
    tipo: "funcao", alt: "x", curvas: [{ nome: "f", latex: "2x + 1" }],
    pontos: [{ id: "A", papel: "especial", tipo: "intercepto", curva: "f" }],
  };
  const lida = normalizarLicao(licaoComFigura({
    enunciado: "Onde a reta $f(x) = 2x + 1$ corta o eixo $y$?",
    opcoes: ["$(0, 1)$", "$(1, 0)$", "$(0, 2)$"], visual: funcao,
  }), ORIGEM);
  assert.equal("visual" in lida.conteudo.exercicio, false);
  assert.match(lida.matematica.motivos[0], /^principal\.visual: figura entrega a resposta: o ponto A \(0, 1\) da figura é o par da opção certa/);
  // O mesmo ponto como PROCURADO fica escondido: a figura vale (o motor nem desenha a curva no enunciado).
  const escondido = copia(funcao);
  escondido.pontos[0].papel = "procurado";
  const guardada = normalizarLicao(licaoComFigura({ enunciado: "Onde a reta $f(x) = 2x + 1$ corta o eixo $y$?", opcoes: ["$(0, 1)$", "$(1, 0)$", "$(0, 2)$"], visual: escondido }), ORIGEM);
  assert.equal(guardada.conteudo.exercicio.visual.tipo, "funcao");
});

test("13a: o pedido à IA diz que a figura nunca mostra como ponto o que a pergunta pede, e que o Studoo a descarta", () => {
  for (const [nome, instrucoes] of [["lição", instrucoesDeMatematica], ["figuras do material", instrucoesDeFigurasDoMaterial]]) {
    assert.match(instrucoes, /A figura do exercício nunca mostra como ponto o que a pergunta pede/, nome);
    assert.match(instrucoes, /DESCARTA a figura que traz a resposta/, nome);
  }
});

test("13a, material: a pergunta cuja opção certa é um ponto rotulado da figura perde a figura, e o relato diz por quê", async () => {
  const { conteudoDaGeradaComRelato } = await import("../src/servidor/estudio/ia.ts");
  const gerada = {
    objetivo: "Reconhecer pontos da reta.", conceito: "Um ponto pertence ao gráfico quando as coordenadas dele satisfazem a função.",
    exemplo: "Em $f(x) = 2x + 1$, o ponto $(0, 1)$ pertence ao gráfico porque $f(0) = 1$.",
    pergunta: "Na função $f(x) = 2x + 1$, qual ponto pertence ao gráfico?", opcoes: ["$(0, 1)$", "$(0, 2)$", "$(1, 0)$"], correta: 0,
    feedbackCorreto: "Isso! $f(0) = 1$.", feedbackIncorreto: "Troque x pelo valor e confira o y.",
  };
  const entrega = conteudoDaGeradaComRelato(gerada, "Do seu material", { visual: planoDe("O ponto A (0, 1) no plano.", [{ id: "A", papel: "dado", x: 0, y: 1 }]) });
  assert.equal("visual" in entrega.conteudo.exercicio, false);
  assert.match(entrega.matematica.motivos[0], /^pergunta\.visual: figura entrega a resposta: o ponto A \(0, 1\)/);
  assert.deepEqual(entrega.matematica.figuras, { enviadas: 1, aceitas: 0 });
  const nao = conteudoDaGeradaComRelato(gerada, "Do seu material", { visual: planoDe("O ponto B (1, 3) no plano.", [{ id: "B", papel: "dado", x: 1, y: 3 }]) });
  assert.equal(nao.conteudo.exercicio.visual.tipo, "plano");
  assert.deepEqual(nao.matematica.figuras, { enviadas: 1, aceitas: 1 });
});

const AVISO_DO_PONTO_M = "figura entrega a resposta: o ponto M (4, 7) da figura é o par da opção certa";
/** A lição do exemplo cuja resolução vem sem "Sua vez" (recusada) E cuja figura do exercício traz o M (4, 7), a opção certa, como ponto dado. */
const licaoQueEntregaERecusada = () => {
  const bruto = licaoSemSuaVez();
  bruto.exercicios[0].visual.pontos.find((ponto) => ponto.id === "M").papel = "dado";
  return bruto;
};

test("13a: a frase da nova tentativa leva o aviso da figura descartada, e sem o aviso é exatamente a de sempre", () => {
  const motivo = 'a resolução precisa de exatamente um "Sua vez"';
  assert.equal(correcaoDaResolucao(motivo), correcaoDaResolucao(motivo, undefined));
  const com = correcaoDaResolucao(motivo, AVISO_DO_PONTO_M);
  assert.ok(com.startsWith(correcaoDaResolucao(motivo)), "o aviso vem DEPOIS do pedido da resolução");
  assert.match(com, /A figura do exercício também foi DESCARTADA \(figura entrega a resposta: o ponto M \(4, 7\) da figura é o par da opção certa\): a figura nunca mostra como ponto o que a pergunta pede\.$/);
  const lida = normalizarLicao(licaoQueEntregaERecusada(), ORIGEM);
  assert.equal(motivoDaFiguraQueEntrega(lida.matematica), AVISO_DO_PONTO_M);
  assert.equal(motivoDaFiguraQueEntrega(normalizarLicao(copia(exemploDeMatematica), ORIGEM).matematica), undefined);
  assert.equal(motivoDaFiguraQueEntrega(undefined), undefined);
});

test("13a, trilha (OpenAI e DeepSeek): a nova tentativa que já acontece (resolução recusada) leva o aviso da figura; a figura boa da segunda vale", async () => {
  let chamadas = 0;
  responder = () => { chamadas += 1; return ok(chamadas === 1 ? licaoQueEntregaERecusada() : exemploDeMatematica); };
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.input.at(-1).content, correcaoDaResolucao(MOTIVO_SEM_SUA_VEZ, AVISO_DO_PONTO_M));
  assert.equal(conteudo.exercicio.visual.pontos.find((ponto) => ponto.id === "M").papel, "procurado", "a figura da segunda (o M escondido) é a que fica");
  // A DeepSeek faz o mesmo na mensagem.
  process.env.IA = "deepseek";
  pedidos = [];
  chamadas = 0;
  responder = () => { chamadas += 1; return ok(JSON.stringify(chamadas === 1 ? licaoQueEntregaERecusada() : exemploDeMatematica)); };
  await conteudoDaDeepSeek(esqueletoDeMatematica(GERADOR_DEEPSEEK));
  assert.equal(pedidos.length, 2);
  assert.equal(pedidos[1].dados.messages.at(-1).content, correcaoDaResolucao(MOTIVO_SEM_SUA_VEZ, AVISO_DO_PONTO_M));
});

test("13a, trilha: a figura que entrega sozinha NÃO gera uma segunda chamada (a lição vem sem a figura, de uma vez só)", async () => {
  const entrega = copiaDe(exemploDeMatematica);
  entrega.exercicios[0].visual.pontos.find((ponto) => ponto.id === "M").papel = "dado";
  responder = () => ok(entrega);
  const conteudo = await conteudoDaOpenAi(esqueletoDeMatematica(GERADOR_OPENAI));
  assert.equal(pedidos.length, 1, "uma figura decorativa não vale outra chamada à IA");
  assert.equal("visual" in conteudo.exercicio, false);
  assert.ok(conteudo.resolucao && conteudo.visuais.length >= 1, "o resto da lição segue");
  assert.deepEqual(registrosDe("licao_matematica").map((registro) => registro.figuras), ["0/1"]);
  assert.equal(JSON.stringify(registros).includes("figura entrega"), false, "o registro leva só a contagem, nunca o motivo");
});

test("13a, material: a nova tentativa que já acontece leva o aviso da figura; a figura boa da segunda (e não a da primeira, que entregava) é a que fica", async () => {
  const entrega = () => {
    const figuras = figurasSemSuaVez();
    figuras.visual.pontos.push({ id: "C", papel: "dado", x: 4, y: 0 });
    return figuras;
  };
  responder = (dados) => {
    if (dados.text.format.name === "trilha_material") return ok(propostaDoMaterial());
    const { licao, correcao } = dadosDoPedido({ dados });
    return ok(licao.titulo.startsWith("Lição 2") && !correcao ? entrega() : figurasDoModelo());
  };
  const gerado = await gerarOMaterialDeMatematica();
  const [nova] = pedidosDeFiguras().filter((pedido) => dadosDoPedido(pedido).correcao);
  assert.equal(dadosDoPedido(nova).correcao, correcaoDaResolucao(MOTIVO_SEM_SUA_VEZ, "figura entrega a resposta: o ponto C (4, 0) da figura é o par da opção certa"));
  const { conteudos } = conteudosDoGerado(gerado);
  assert.equal(conteudos[1].exercicio.visual.tipo, "plano");
  assert.equal(conteudos[1].exercicio.visual.pontos.some((ponto) => ponto.id === "C"), false, "a figura da segunda, sem o ponto que entregava");
  assert.equal(conteudos[1].resolucao.passos.length, 5);
});

