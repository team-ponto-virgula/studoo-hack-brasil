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
      resposta.writeHead(200, { "Content-Type": "application/json" });
      resposta.end(JSON.stringify({
        status: "completed",
        output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(licaoDeEscolha) }] }],
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

test("a estrutura vem por streaming e vira eventos válidos, com índices calculados e sem trecho vazio", async () => {
  const eventos = await coletar(iniciarGeracao(`teste-${crypto.randomUUID()}`, "Quero aprender violão do zero"));
  for (const evento of eventos) assert.deepEqual(interpretarEventoGeracao(JSON.stringify(evento)), evento);
  assert.deepEqual(eventos.map(({ tipo }) => tipo), ["plano", "fluxo", "licao", "licao", "fluxo", "licao", "licao", "fluxo", "licao", "pronto"]);
  assert.deepEqual(eventos.filter(({ tipo }) => tipo === "licao").map(({ fluxo, licao }) => [fluxo, licao]), [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]]);
  const pronto = eventos.at(-1);
  assert.equal(pronto.proposta.titulo, "Violão do zero");
  assert.equal(pronto.proposta.origem, `IA da OpenAI (${MODELO_PADRAO})`);
  assert.ok(pronto.proposta.fluxos.flatMap(({ licoes }) => licoes).some(({ titulo }) => titulo.startsWith("Revisão")));

  const [pedido] = pedidos;
  assert.equal(pedido.caminho, "/v1/responses");
  assert.equal(pedido.autorizacao, "Bearer chave-de-teste");
  assert.equal(pedido.dados.model, MODELO_PADRAO);
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
  assert.equal("contexto" in conteudo.exercicio && conteudo.exercicio.contexto, undefined);

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

test("sem o campo de raciocínio aceito pelo modelo, o pedido é repetido sem ele", async () => {
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
  assert.match(pronto.proposta.origem, /IA falsa/);
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
