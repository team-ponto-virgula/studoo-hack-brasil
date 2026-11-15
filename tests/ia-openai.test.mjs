import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { interpretarEventoGeracao } from "@studoo/contratos";
import { conteudoValido, esqueletoValido } from "../src/dominio/aprendizado/plano.ts";
import { reiniciarLimiteDeGeracoes } from "../src/servidor/ia/limite.ts";

// Os erros HTTP carregam o cliente do banco ao importar; este teste não toca no banco, então um endereço fictício basta.
process.env.DATABASE_URL ??= "postgresql://teste:teste@127.0.0.1:5432/teste";
// A proposta pronta sai com um token assinado; sem o .env, uma chave fictícia de teste.
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);
const { iniciarGeracao } = await import("../src/servidor/aprendizado/geracao.ts");
const { obterGerador } = await import("../src/servidor/ia/gerador.ts");
const { GERADOR_OPENAI, MODELO_PADRAO, normalizarConteudo } = await import("../src/servidor/ia/openai.ts");
const { refinarAvaliacao } = await import("../src/servidor/aprendizado/correcao.ts");

/*
 * Adaptador da OpenAI (Responses API) contra um servidor local que imita a API: streaming SSE para a estrutura e
 * Structured Outputs para o conteúdo. Nenhum teste chama a OpenAI de verdade.
 */

const linhasDaTrilha = [
  '```json',
  '{"tipo":"plano","titulo":"Violão do zero","objetivo":"Tocar as primeiras músicas no violão."}',
  '{"tipo":"fluxo","titulo":"Primeiros passos"}',
  '{"tipo":"licao","titulo":"Conhecer as partes do violão"}',
  '{"tipo":"licao","titulo":"Afinar as cordas"}',
  '{"tipo":"fluxo","titulo":"Praticando"}',
  '- {"tipo":"licao","titulo":"Primeiros acordes: Mi menor e Lá menor"},',
  '{"tipo":"licao","titulo":"Revisão: acordes e afinação"}',
  'texto solto que não é JSON',
  '{"tipo":"fluxo","titulo":"Desafio"}',
  '{"tipo":"licao","titulo":"Tocar uma música com dois acordes"}',
  '```',
];

const licaoDeEscolha = {
  objetivo: "Reconhecer as partes do violão.",
  conceito: "O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete, no corpo.",
  exemplo: "Ao afinar, você gira as tarraxas, que ficam na cabeça do violão.",
  exercicio: {
    tipo: "multipla_escolha",
    enunciado: "Onde ficam as tarraxas?",
    contexto: null,
    trecho: null,
    // Ids repetidos e o gabarito pelo texto da opção: o adaptador refaz os ids e acha a certa.
    opcoes: [{ id: "x", texto: "Na cabeça" }, { id: "x", texto: "No corpo" }, { id: "x", texto: "No braço" }],
    gabarito: ["Na cabeça"],
    feedbackCorreto: "Isso: as tarraxas ficam na cabeça do violão.",
    feedbackIncorreto: "As tarraxas ficam na cabeça, a ponta do braço.",
  },
};

let servidor;
let pedidos = [];
let modo = "normal";

function responderStreaming(resposta, linhas) {
  resposta.writeHead(200, { "Content-Type": "text/event-stream" });
  const texto = `${linhas.join("\n")}\n`;
  const pedacos = texto.match(/[\s\S]{1,23}/g);
  resposta.write(`event: response.created\ndata: ${JSON.stringify({ type: "response.created" })}\n\n`);
  let indice = 0;
  // Se o cliente cancelar (teste de cancelamento), o servidor para de escrever.
  let fechado = false;
  resposta.on("close", () => { fechado = true; });
  const enviar = () => {
    if (fechado) return;
    if (indice < pedacos.length) {
      resposta.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: pedacos[indice] })}\n\n`);
      indice += 1;
      setTimeout(enviar, 2);
      return;
    }
    resposta.end(`event: response.completed\ndata: ${JSON.stringify({ type: "response.completed" })}\n\n`);
  };
  enviar();
}

before(async () => {
  servidor = createServer((pedido, resposta) => {
    // Conexões cortadas pelo cliente (cancelamento) não derrubam o servidor de teste.
    pedido.on("error", () => undefined);
    resposta.on("error", () => undefined);
    let corpo = "";
    pedido.on("data", (parte) => { corpo += parte; });
    pedido.on("end", () => {
      if (!pedido.complete || !corpo) { resposta.writeHead(400); resposta.end(); return; }
      const dados = JSON.parse(corpo);
      pedidos.push({ caminho: pedido.url, autorizacao: pedido.headers.authorization, dados });
      if (modo === "falha") {
        resposta.writeHead(500, { "Content-Type": "application/json" });
        resposta.end(JSON.stringify({ error: { message: "indisponível" } }));
        return;
      }
      if (modo === "sem-raciocinio" && dados.reasoning) {
        resposta.writeHead(400, { "Content-Type": "application/json" });
        resposta.end(JSON.stringify({ error: { message: "Unsupported parameter: 'reasoning.effort' is not supported with this model." } }));
        return;
      }
      if (dados.stream) {
        responderStreaming(resposta, linhasDaTrilha);
        return;
      }
      // Correções durante a aula: cada pedido diz o seu formato pelo nome do esquema.
      const formato = dados.text?.format?.name;
      let saida = licaoDeEscolha;
      if (formato === "correcao_aberta") saida = { criterios: [{ atendido: true }, { atendido: false }], correta: true, feedback: "Boa ideia, faltou o exemplo." };
      if (formato === "desempate_lacuna") saida = { equivalente: dados.input[1].content.includes("dois") };
      resposta.writeHead(200, { "Content-Type": "application/json" });
      resposta.end(JSON.stringify({
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(saida) }] }],
      }));
    });
  });
  await new Promise((resolver) => servidor.listen(0, "127.0.0.1", resolver));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${servidor.address().port}/v1`;
});

after(async () => {
  servidor.closeAllConnections();
  await new Promise((resolver) => servidor.close(resolver));
});

beforeEach(() => {
  process.env.IA = "openai";
  process.env.OPENAI_API_KEY = "chave-de-teste";
  delete process.env.OPENAI_MODELO;
  delete process.env.OPENAI_ESFORCO;
  delete process.env.STUDOO_IA_RESERVA;
  process.env.STUDOO_IA_FALSA_PAUSA_MS = "0";
  pedidos = [];
  modo = "normal";
  reiniciarLimiteDeGeracoes();
});

async function coletar(geracao, sinal = new AbortController().signal) {
  const eventos = [];
  for await (const evento of geracao.eventos(sinal, { aoVivo: true })) eventos.push(evento);
  return eventos;
}

const MODELO_RACIOCINIO = "gpt-5.6-luna";

test("a estrutura vem por streaming e vira eventos válidos, com índices calculados e sem trecho vazio", async () => {
  process.env.OPENAI_MODELO = MODELO_RACIOCINIO;
  const eventos = await coletar(iniciarGeracao(`teste-${crypto.randomUUID()}`, "Quero aprender violão do zero"));
  for (const evento of eventos) assert.deepEqual(interpretarEventoGeracao(JSON.stringify(evento)), evento);
  assert.deepEqual(eventos.map(({ tipo }) => tipo), ["plano", "fluxo", "licao", "licao", "fluxo", "licao", "licao", "fluxo", "licao", "pronto"]);
  assert.deepEqual(eventos.filter(({ tipo }) => tipo === "licao").map(({ fluxo, licao }) => [fluxo, licao]), [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]]);
  const pronto = eventos.at(-1);
  assert.equal(pronto.proposta.titulo, "Violão do zero");
  assert.equal(pronto.proposta.origem, `IA da OpenAI (${MODELO_RACIOCINIO})`);
  assert.ok(pronto.proposta.fluxos.flatMap(({ licoes }) => licoes).some(({ titulo }) => titulo.startsWith("Revisão")));

  const [pedido] = pedidos;
  assert.equal(pedido.caminho, "/v1/responses");
  assert.equal(pedido.autorizacao, "Bearer chave-de-teste");
  assert.equal(pedido.dados.model, MODELO_RACIOCINIO);
  assert.equal(pedido.dados.stream, true);
  assert.deepEqual(pedido.dados.reasoning, { effort: "low" });
  // Só o objetivo vai para a IA, com as regras de ordem no prompt de sistema.
  assert.match(pedido.dados.input[0].content, /pré-requisitos/);
  assert.equal(pedido.dados.input[1].content, "Objetivo de estudo: Quero aprender violão do zero");
});

test("o conteúdo da lição vem com Structured Outputs e é normalizado para o formato interno", async () => {
  const gerador = obterGerador();
  const esqueleto = {
    gerador: GERADOR_OPENAI,
    titulo: "Violão do zero",
    objetivo: "Tocar as primeiras músicas no violão.",
    origem: "IA da OpenAI (teste)",
    fluxos: [{ titulo: "Primeiros passos", licoes: [{ titulo: "Conhecer as partes do violão" }, { titulo: "Afinar as cordas" }] }],
  };
  assert.ok(esqueletoValido(esqueleto));
  const conteudo = await gerador.gerarConteudo(esqueleto, 0, 0, new AbortController().signal);
  assert.ok(conteudoValido(conteudo));
  assert.equal(conteudo.origem, "IA da OpenAI (teste)");
  assert.deepEqual(conteudo.exercicio.opcoes.map(({ id }) => id), ["a", "b", "c"]);
  assert.deepEqual(conteudo.exercicio.gabarito, ["a"]);
  assert.equal("contexto" in conteudo.exercicio, false, "campo nulo sai do conteúdo");

  const { dados } = pedidos.at(-1);
  assert.equal(dados.text.format.type, "json_schema");
  assert.equal(dados.text.format.strict, true);
  assert.match(dados.input[1].content, /1\. Conhecer as partes do violão {2}<- esta lição/);
  await assert.rejects(gerador.gerarConteudo({ ...esqueleto, gerador: "outro" }, 0, 0, new AbortController().signal),
    (erro) => erro.codigo === "proposta_invalida");
});

test("a lacuna mantém as respostas aceitas e a normalização recusa o que não fecha", () => {
  const lacuna = normalizarConteudo({
    ...licaoDeEscolha,
    exercicio: { ...licaoDeEscolha.exercicio, tipo: "lacuna", opcoes: null, trecho: "Gire a ___ para afinar.", gabarito: ["tarraxa", "tarraxa", " Tarraxa "] },
  }, "IA");
  assert.equal(lacuna.exercicio.tipo, "lacuna");
  assert.deepEqual(lacuna.exercicio.gabarito, ["tarraxa", "Tarraxa"]);
  assert.equal(normalizarConteudo({ ...licaoDeEscolha, exercicio: { ...licaoDeEscolha.exercicio, gabarito: ["nenhuma"] } }, "IA"), null);
  assert.equal(normalizarConteudo({ ...licaoDeEscolha, conceito: "" }, "IA"), null);
});

/** Confere o JSON Schema estrito: todo objeto lista todas as propriedades em required e fecha additionalProperties. */
function conferirEstrito(esquema, caminho = "raiz") {
  if (!esquema || typeof esquema !== "object") return;
  if (esquema.anyOf) return esquema.anyOf.forEach((opcao, indice) => conferirEstrito(opcao, `${caminho}|${indice}`));
  if (esquema.type === "object") {
    assert.equal(esquema.additionalProperties, false, caminho);
    assert.deepEqual([...esquema.required].sort(), Object.keys(esquema.properties).sort(), caminho);
    for (const [nome, valor] of Object.entries(esquema.properties)) conferirEstrito(valor, `${caminho}.${nome}`);
  }
  if (esquema.items) conferirEstrito(esquema.items, `${caminho}[]`);
}

test("a lição pede formatos variados num esquema estrito: exercícios, recurso, falas e prática", async () => {
  const gerador = obterGerador();
  const esqueleto = {
    gerador: GERADOR_OPENAI, titulo: "Violão", objetivo: "Tocar.", origem: "IA da OpenAI (teste)",
    fluxos: [{ titulo: "Primeiros passos", licoes: [{ titulo: "Montar o Lá menor" }] }],
  };
  await gerador.gerarConteudo(esqueleto, 0, 0, new AbortController().signal);
  const { dados } = pedidos.at(-1);
  const esquema = dados.text.format.schema;
  conferirEstrito(esquema);
  assert.deepEqual(esquema.properties.exercicios.items.properties.tipo.enum,
    ["lacuna", "multipla_escolha", "ordenar", "associar", "verdadeiro_falso", "aberta"]);
  for (const campo of ["recurso", "falas", "pratica", "exemploTipo", "passos"]) assert.ok(campo in esquema.properties, campo);
  const instrucoes = dados.input[0].content;
  for (const trecho of ["ordenar", "associar", "verdadeiro_falso", "aberta", "acorde", "linha_do_tempo", "falas", "pratica", "codigo (só para código"]) {
    assert.ok(instrucoes.includes(trecho), trecho);
  }
});

test("a normalização aceita os formatos novos, refaz ids e descarta o opcional que não fecha", () => {
  const base = { objetivo: "Trocar de acorde.", conceito: "Dois dedos ficam.", exemplo: "Do Am para o C.", exemploTipo: "demonstracao" };
  const retornos = { feedbackCorreto: "Isso.", feedbackIncorreto: "Ainda não." };
  const nulos = { contexto: null, trecho: null, trechoTipo: null, fala: null, opcoes: null, itens: null, esquerda: null, direita: null, afirmacao: null, exata: null, criterios: null, modelo: null };
  const conteudo = normalizarConteudo({
    ...base,
    passos: ["Monte o Am.", "Leve o anelar.", "Toque."],
    recurso: { tipo: "acorde", nome: "C", casas: [-1, 3, 2, 0, 1, 0], dedos: [0, 3, 2, 0, 1, 0], eventos: null },
    falas: [{ texto: "Hello!", idioma: "en-US", traducao: "Olá!" }, { texto: "Oi", idioma: "português", traducao: null }],
    pratica: { tarefa: "Alterne Am e C.", minutos: 45, passos: null, dica: null },
    exercicios: [
      { ...nulos, tipo: "ordenar", enunciado: "Ordene.", itens: [{ id: "x", texto: "Um" }, { id: "x", texto: "Dois" }, { id: "x", texto: "Três" }], gabarito: [], ...retornos },
      { ...nulos, tipo: "associar", enunciado: "Ligue.", esquerda: [{ id: "a", texto: "Am" }, { id: "b", texto: "C" }], direita: [{ id: "a", texto: "Lá menor" }, { id: "b", texto: "Dó" }], gabarito: [], ...retornos },
      { ...nulos, tipo: "verdadeiro_falso", enunciado: "Julgue.", afirmacao: "O braço para.", opcoes: [{ id: "a", texto: "Pêndulo" }, { id: "b", texto: "Força" }], gabarito: ["Falso", "Pêndulo"], ...retornos },
      { ...nulos, tipo: "aberta", enunciado: "Explique.", gabarito: ["anelar", "batida"], criterios: ["Fala do anelar"], modelo: "Movo o anelar sem parar a batida.", ...retornos },
    ],
  }, "IA");
  assert.ok(conteudo);
  assert.equal(conteudo.exemploTipo, "demonstracao");
  assert.equal(conteudo.recurso.nome, "C");
  assert.deepEqual(conteudo.falas, [{ texto: "Hello!", idioma: "en-US", traducao: "Olá!" }], "a fala com idioma inválido sai");
  assert.equal(conteudo.pratica.minutos, 20, "o cronômetro fica entre 1 e 20 minutos");
  assert.deepEqual(conteudo.exercicio.gabarito, ["ia", "ib", "ic"], "ordenar: os itens chegam na ordem certa e os ids são refeitos");
  assert.equal(conteudo.extras.length, 2, "até 3 exercícios no total");
  const [associar, vf] = conteudo.extras;
  assert.deepEqual(associar.gabarito, ["a=da", "b=db"], "ids da direita que repetem os da esquerda são refeitos");
  assert.deepEqual(vf.gabarito, ["falso", "a"], "o gabarito aponta a justificativa pelo texto");
  // A aberta sem critérios na mesma quantidade dos grupos ainda vale, só sem os critérios.
  const aberta = normalizarConteudo({ ...base, exercicios: [{ ...nulos, tipo: "aberta", enunciado: "Explique.", gabarito: ["anelar", "batida"], criterios: ["só um"], modelo: null, ...retornos }] }, "IA");
  assert.equal(aberta.exercicio.criterios, undefined);
  // Recurso fora do formato (acorde com 5 cordas) sai, e a lição continua.
  const semRecurso = normalizarConteudo({ ...base, recurso: { tipo: "acorde", nome: "X", casas: [0, 1, 2, 3, 4], dedos: null, eventos: null }, exercicios: [{ ...nulos, tipo: "lacuna", enunciado: "Complete.", trecho: "Gire a ___.", gabarito: ["tarraxa"], ...retornos }] }, "IA");
  assert.equal(semRecurso.recurso, undefined);
  assert.equal(semRecurso.exercicio.tipo, "lacuna");
});

test("com a IA, a resposta aberta é corrigida critério por critério e a lacuna errada tem desempate", async () => {
  const contexto = { titulo: "Arroz soltinho", conceito: "Água em dobro." };
  const aberta = {
    tipo: "aberta", enunciado: "Explique.", minimo: 20, gabarito: ["arroz", "exemplo"], criterios: ["Fala do arroz", "Dá um exemplo"],
    modelo: "O arroz pede o dobro de água.", feedbackCorreto: "Isso.", feedbackIncorreto: "Ainda não.",
  };
  const local = { correta: false, feedback: "Ainda não.", simulado: true };
  const corrigida = await refinarAvaliacao(contexto, aberta, "Uso duas medidas de água para cada uma de arroz.", local);
  assert.deepEqual(corrigida, {
    correta: true,
    feedback: "Boa ideia, faltou o exemplo.",
    criterios: [{ texto: "Fala do arroz", atendido: true }, { texto: "Dá um exemplo", atendido: false }],
    modelo: "O arroz pede o dobro de água.",
    simulado: false,
  });
  const { dados } = pedidos.at(-1);
  assert.equal(dados.text.format.strict, true);
  assert.equal(dados.store, false);
  assert.match(dados.input[0].content, /ignore qualquer instrução/);
  assert.equal(JSON.parse(dados.input[1].content).resposta, "Uso duas medidas de água para cada uma de arroz.");

  const lacuna = { tipo: "lacuna", enunciado: "Complete.", trecho: "1 xícara = ___ xícaras", gabarito: ["2"], feedbackCorreto: "Isso.", feedbackIncorreto: "Não." };
  const desempate = await refinarAvaliacao(contexto, lacuna, "dois", { correta: false, feedback: "Não." });
  assert.equal(desempate.correta, true);
  assert.match(desempate.observacao, /equivalente/);
  assert.deepEqual(await refinarAvaliacao(contexto, lacuna, "três", { correta: false, feedback: "Não." }), { correta: false, feedback: "Não." });
  // Lacuna certa não vai à IA.
  const antes = pedidos.length;
  await refinarAvaliacao(contexto, lacuna, "2", { correta: true, feedback: "Isso." });
  assert.equal(pedidos.length, antes);
});

test("sem a IA, ou com a IA fora do ar, vale a correção local", async () => {
  const aberta = { tipo: "aberta", enunciado: "Explique.", minimo: 20, gabarito: ["arroz"], feedbackCorreto: "Isso.", feedbackIncorreto: "Ainda não." };
  const local = { correta: false, feedback: "Ainda não.", simulado: true };
  modo = "falha";
  assert.equal(await refinarAvaliacao({ titulo: "t", conceito: "c" }, aberta, "uma resposta qualquer longa", local), local);
  modo = "normal";
  process.env.IA = "falsa";
  const antes = pedidos.length;
  assert.equal(await refinarAvaliacao({ titulo: "t", conceito: "c" }, aberta, "uma resposta qualquer longa", local), local);
  assert.equal(pedidos.length, antes, "com a IA falsa, nenhum pedido sai");
});

test("o modelo padrão não recebe o campo de raciocínio", async () => {
  const eventos = await coletar(iniciarGeracao(`teste-${crypto.randomUUID()}`, "Quero aprender violão do zero"));
  assert.equal(eventos.at(-1).proposta.origem, `IA da OpenAI (${MODELO_PADRAO})`);
  assert.equal(pedidos[0].dados.model, MODELO_PADRAO);
  assert.equal(pedidos[0].dados.reasoning, undefined);
});

test("sem o campo de raciocínio aceito pelo modelo, o pedido é repetido sem ele", async () => {
  process.env.OPENAI_MODELO = MODELO_RACIOCINIO;
  modo = "sem-raciocinio";
  const eventos = await coletar(iniciarGeracao(`teste-${crypto.randomUUID()}`, "Quero aprender violão do zero"));
  assert.equal(eventos.at(-1).tipo, "pronto");
  assert.ok(pedidos[0].dados.reasoning);
  assert.equal(pedidos[1].dados.reasoning, undefined);
});

test("se a OpenAI falha antes do primeiro evento, a IA falsa monta a trilha (reserva padrão)", async () => {
  modo = "falha";
  const eventos = await coletar(iniciarGeracao(`teste-${crypto.randomUUID()}`, "Frações"));
  const pronto = eventos.at(-1);
  assert.equal(pronto.tipo, "pronto");
  assert.match(pronto.proposta.origem, /Modo demonstração/);
});

test("sem reserva, a falha da OpenAI vira o evento de erro ia_indisponivel", async () => {
  modo = "falha";
  process.env.STUDOO_IA_RESERVA = "nenhuma";
  const eventos = await coletar(iniciarGeracao(`teste-${crypto.randomUUID()}`, "Frações"));
  assert.deepEqual(eventos, [{ tipo: "erro", codigo: "ia_indisponivel" }]);
});

test("sem chave, a reserva assume; sem chave e sem reserva, a geração nem começa", () => {
  delete process.env.OPENAI_API_KEY;
  assert.doesNotThrow(() => iniciarGeracao(`teste-${crypto.randomUUID()}`, "Frações"));
  process.env.STUDOO_IA_RESERVA = "nenhuma";
  assert.throws(() => iniciarGeracao(`teste-${crypto.randomUUID()}`, "Frações"), (erro) => erro.codigo === "ia_indisponivel");
  // Endereço sem HTTPS fora do próprio computador também não serve.
  process.env.OPENAI_API_KEY = "chave-de-teste";
  const base = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = "http://exemplo.test/v1";
  assert.throws(() => obterGerador(), (erro) => erro.codigo === "ia_indisponivel");
  process.env.OPENAI_BASE_URL = base;
});

test("cancelar no meio para a leitura, sem pronto e sem erro", async () => {
  const controle = new AbortController();
  const eventos = [];
  for await (const evento of iniciarGeracao(`teste-${crypto.randomUUID()}`, "Violão").eventos(controle.signal)) {
    eventos.push(evento);
    if (evento.tipo === "licao") controle.abort();
  }
  assert.ok(eventos.length >= 3);
  assert.ok(!eventos.some(({ tipo }) => tipo === "pronto" || tipo === "erro"));
});
