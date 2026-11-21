import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { normalizarResolucao, normalizarVisual } from "@studoo/contratos";
import { conteudoValido, esqueletoValido } from "../src/dominio/aprendizado/plano.ts";
import { reiniciarLimiteDeGeracoes } from "../src/servidor/ia/limite.ts";

// Os erros HTTP carregam o cliente do banco ao importar; este teste não toca no banco, então um endereço fictício basta.
process.env.DATABASE_URL ??= "postgresql://teste:teste@127.0.0.1:5432/teste";
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);

const { analisarJson, esquemaDaLicao, esquemaDaLicaoDeMatematica, instrucoesDaLicao, normalizarLicao } = await import("../src/servidor/ia/comum.ts");
const { GERADOR_OPENAI, configuracaoOpenAi, corpoDaLicao, criarGeradorOpenAi } = await import("../src/servidor/ia/openai.ts");
const { GERADOR_DEEPSEEK, configuracaoDeepSeek, criarGeradorDeepSeek, instrucoesLicaoJsonDeMatematica } = await import("../src/servidor/ia/deepseek.ts");
const {
  ehAssuntoDeMatematica, esquemaDasFigurasDoMaterial, exemploDeMatematica, instrucoesDeFigurasDoMaterial, instrucoesDeNotacaoDoMaterial,
  licaoEhDeMatematica, materialEhDeMatematica,
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
      resposta.writeHead(status, { "Content-Type": "application/json" });
      if (status !== 200) return resposta.end(JSON.stringify(saida));
      resposta.end(JSON.stringify(pedido.url.endsWith("/responses") ? saidaDaOpenAi(saida) : saidaDaDeepSeek(saida)));
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
  assert.equal(pedidos.length, 1, "um pedido só: o que não vale some, não se pede de novo");
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
