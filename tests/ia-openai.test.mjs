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
const { lerComprovante } = await import("../src/servidor/aprendizado/comprovantes.ts");
const { obterGerador } = await import("../src/servidor/ia/gerador.ts");
const { GERADOR_OPENAI, MODELO_PADRAO, normalizarConteudo } = await import("../src/servidor/ia/openai.ts");
const { refinarAvaliacao } = await import("../src/servidor/aprendizado/correcao.ts");
const { FalhaApi } = await import("../src/servidor/acesso/http.ts");

/*
 * Adaptador da OpenAI (Responses API) contra um servidor local que imita a API: streaming SSE para a estrutura e
 * Structured Outputs para o conteúdo. Nenhum teste chama a OpenAI de verdade.
 */

const linhasDaTrilha = [
  '```json',
  '{"tipo":"plano","titulo":"Violão do zero","objetivo":"Tocar as primeiras músicas no violão."}',
  '{"tipo":"fluxo","titulo":"Primeiros passos"}',
  '{"tipo":"licao","titulo":"Conhecer as partes do violão","resumo":"Reconhecer a cabeça, o braço e o corpo do violão."}',
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
const desafioDaEquacao = 'Escolher a equação que representa uma taxa fixa mais um preço por unidade.';
const licaoComDiagnostico = {
  objetivo: desafioDaEquacao,
  conceito: 'Uma taxa fixa é somada ao custo por unidade multiplicado pela quantidade.',
  exemplo: 'Um total de R$ 18 com entrada de R$ 8 e R$ 2 por quilo se escreve como 8 + 2k = 18.',
  exercicio: {
    ...licaoDeEscolha.exercicio,
    enunciado: 'Uma corrida custa R$ 5 fixos e R$ 3 por quilômetro. Qual equação representa o total de R$ 20?',
    opcoes: [{ id: 'a', texto: '5 + 3k = 20' }, { id: 'b', texto: '3 + 5k = 20' }, { id: 'c', texto: '5k + 3k = 20' }],
    gabarito: ['a'], feedbackCorreto: 'Some a taxa fixa ao preço por quilômetro vezes a distância.',
    feedbackIncorreto: 'Separe o valor inicial do valor por quilômetro.',
  },
};

let servidor;
let pedidos = [];
let modo = "normal";
/** Quantos pedidos de lição o servidor falso já recebeu (o modo "leitura-estoura-*" muda a resposta pela ordem). */
let pedidosDeLicao = 0;

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
    resposta.shouldKeepAlive = false; // cada resposta fecha a conexão: nada de socket velho reaproveitado (ECONNRESET ao acaso)
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
      if (dados.text?.format?.name === "triagem_trilha") {
        const dadosDaTriagem = JSON.parse(dados.input[0].content[0].text);
        const saida = modo === "triagem-invalida" ? { decisao: true }
          : { decisao: modo === "recusar-objetivo" || (modo === "recusar-estrutura" && dadosDaTriagem.estrutura) ? "recusar" : "permitir" };
        resposta.writeHead(200, { "Content-Type": "application/json" });
        resposta.end(JSON.stringify({ status: "completed", output_text: JSON.stringify(saida) }));
        return;
      }
      if (dados.stream) {
        responderStreaming(resposta, linhasDaTrilha);
        return;
      }
      // O JSON da lição aninhado a ponto de estourar a pilha na leitura (RangeError dentro de normalizarLicao): na primeira vez (ou sempre), e depois a lição boa.
      if (modo === "leitura-estoura-depois-ok" || modo === "leitura-estoura-sempre") {
        pedidosDeLicao += 1;
        const texto = modo === "leitura-estoura-sempre" || pedidosDeLicao === 1 ? licaoQueEstouraALeitura : JSON.stringify(licaoDeEscolha);
        resposta.writeHead(200, { "Content-Type": "application/json" });
        resposta.end(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: texto }] }] }));
        return;
      }
      // Correções durante a aula: cada pedido diz o seu formato pelo nome do esquema.
      const formato = dados.text?.format?.name;
      let saida = licaoDeEscolha;
      if (modo === 'diagnostico') {
        if (formato === 'diagnostico_curriculo') saida = { fluxos: [{ titulo: 'Aplicações', licoes: [
          { titulo: 'Traduzir uma situação em equação', resumo: desafioDaEquacao },
          { titulo: 'Conferir uma solução', resumo: 'Verificar se a solução faz sentido no contexto.' },
        ] }] };
        else if (formato === 'diagnostico_verificar_curriculo') saida = { avaliacoes: [{ numero: 1, resultado: 'avanca', motivo: '' }, { numero: 2, resultado: 'avanca', motivo: '' }] };
        else saida = licaoComDiagnostico;
      }
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
  pedidosDeLicao = 0;
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
  process.env.OPENAI_MODELO = "modelo-antigo";
  const eventos = await coletar(iniciarGeracao(`teste-${crypto.randomUUID()}`, "Quero aprender violão do zero"));
  for (const evento of eventos) assert.deepEqual(interpretarEventoGeracao(JSON.stringify(evento)), evento);
  assert.deepEqual(eventos.map(({ tipo }) => tipo), ["plano", "fluxo", "licao", "licao", "fluxo", "licao", "licao", "fluxo", "licao", "pronto"]);
  assert.deepEqual(eventos.filter(({ tipo }) => tipo === "licao").map(({ fluxo, licao }) => [fluxo, licao]), [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]]);
  const pronto = eventos.at(-1);
  assert.equal(pronto.proposta.titulo, "Violão do zero");
  assert.equal(pronto.proposta.origem, "Conteúdo gerado pelo Studoo");
  assert.ok(pronto.proposta.fluxos.flatMap(({ licoes }) => licoes).some(({ titulo }) => titulo.startsWith("Revisão")));
  // O resumo que o modelo escreve para a prévia vai junto, no evento e na proposta; sem ele, a lição vem só com o título.
  const [primeira, segunda] = eventos.filter(({ tipo }) => tipo === "licao");
  assert.equal(primeira.resumo, "Reconhecer a cabeça, o braço e o corpo do violão.");
  assert.equal("resumo" in segunda, false);
  assert.equal(pronto.proposta.fluxos[0].licoes[0].resumo, primeira.resumo);

  const pedido = pedidos.find(p => p.dados.stream);
  assert.equal(pedido.caminho, "/v1/responses");
  assert.equal(pedido.autorizacao, "Bearer chave-de-teste");
  assert.equal(pedido.dados.model, MODELO_PADRAO);
  assert.equal(pedido.dados.stream, true);
  assert.deepEqual(pedido.dados.reasoning, { effort: "max" });
  // Só o objetivo vai para a IA, com as regras de ordem no prompt de sistema.
  assert.match(pedido.dados.input[0].content, /pré-requisitos/);
  assert.match(pedido.dados.input[0].content, /"resumo"/);
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
  assert.equal(conteudo.origem, "Conteúdo gerado pelo Studoo");
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
  for (const campo of ["recurso", "falas", "pratica", "exemploTipo", "passos", "outroJeito"]) assert.ok(campo in esquema.properties, campo);
  // O que antes só as trilhas prontas tinham agora também vem da IA: pronúncia, armadilhas, critérios essenciais e som.
  const exercicio = esquema.properties.exercicios.items.properties;
  assert.ok("armadilhas" in exercicio);
  assert.deepEqual(Object.keys(exercicio.criterios.items.properties).sort(), ["essencial", "texto"]);
  assert.ok("pronuncia" in exercicio.fala.anyOf[0].properties, "a fala do exercício de escuta também tem pronúncia");
  assert.ok("pronuncia" in esquema.properties.falas.items.properties);
  assert.ok("som" in esquema.properties.pratica.anyOf[0].properties);
  const instrucoes = dados.input[0].content;
  for (const trecho of ["ordenar", "associar", "verdadeiro_falso", "aberta", "acorde", "linha_do_tempo", "falas", "pratica", "codigo (só para código",
    "pronuncia", "MAIÚSCULAS", "armadilhas", "essencial", "outroJeito", "som só existe em lições de violão",
    "2 ou 3 exercícios", "produza a resposta"]) {
    assert.ok(instrucoes.includes(trecho), trecho);
  }
});

test("a IA também escreve a pronúncia, as armadilhas, os critérios essenciais, o outro jeito e o som da prática", () => {
  const retornos = { feedbackCorreto: "Isso.", feedbackIncorreto: "Ainda não." };
  const nulos = { contexto: null, trecho: null, trechoTipo: null, fala: null, opcoes: null, itens: null, esquerda: null, direita: null, afirmacao: null, exata: null, criterios: null, modelo: null, armadilhas: null };
  const base = { objetivo: "Pedir um café.", conceito: "Para pedir com educação, use I'd like.", exemplo: "I'd like a coffee, please.", exemploTipo: "exemplo", passos: null, recurso: null };
  const conteudo = normalizarConteudo({
    ...base,
    outroJeito: "Pense no I'd like como o “eu gostaria” de um pedido educado.",
    falas: [
      { texto: "I'd like a coffee, please.", idioma: "en-US", traducao: "Eu gostaria de um café, por favor.", pronuncia: "áid LÁIK a KÓ-fi, PLÍZ" },
      { texto: "Thank you!", idioma: "en-US", traducao: "Obrigado!", pronuncia: "x".repeat(161) },
    ],
    pratica: { tarefa: "Peça um café em voz alta.", minutos: 2, passos: ["Diga a frase.", "y".repeat(201)], dica: null, som: { rotulo: "Mi", casas: [0, 1, 2] } },
    exercicios: [
      {
        ...nulos, tipo: "aberta", enunciado: "Peça um café com educação.", gabarito: ["i'd like|i would like", "coffee", "please"],
        criterios: [{ texto: "Usa I'd like", essencial: true }, { texto: "Pede o café", essencial: false }, { texto: "Diz please", essencial: false }],
        modelo: "I'd like a coffee, please.",
        armadilhas: [
          { termos: "i want|i wanna", aviso: "“I want” soa brusco num pedido." },
          { termos: "coffee", aviso: "Está na resposta certa, então não é armadilha." },
          { termos: "i like", aviso: "“I like” quer dizer “eu gosto”." },
        ],
        ...retornos,
      },
      {
        ...nulos, tipo: "lacuna", enunciado: "Complete o pedido.", trecho: "I'd ___ a coffee.", gabarito: ["like"], exata: true,
        fala: { texto: "I'd like a coffee.", idioma: "en-US", pronuncia: "áid LÁIK a KÓ-fi" },
        armadilhas: [{ termos: "want", aviso: "“Want” soa brusco num pedido." }, { termos: "Like", aviso: "É a resposta certa." }],
        ...retornos,
      },
      { ...nulos, tipo: "multipla_escolha", enunciado: "Qual é o educado?", opcoes: [{ id: "a", texto: "I'd like" }, { id: "b", texto: "Give me" }], gabarito: ["a"], armadilhas: [{ termos: "give me", aviso: "Soa como ordem." }], ...retornos },
    ],
  }, "IA");
  assert.ok(conteudo);
  assert.equal(conteudo.outroJeito, "Pense no I'd like como o “eu gostaria” de um pedido educado.");
  assert.equal(conteudo.falas[0].pronuncia, "áid LÁIK a KÓ-fi, PLÍZ");
  assert.deepEqual(conteudo.falas[1], { texto: "Thank you!", idioma: "en-US", traducao: "Obrigado!" }, "pronúncia longa demais sai; a fala fica");
  assert.deepEqual(conteudo.pratica, { tarefa: "Peça um café em voz alta.", minutos: 2, passos: ["Diga a frase."] }, "o som e o passo fora do formato saem; a prática fica");
  const aberta = conteudo.exercicio;
  assert.deepEqual(aberta.criterios, ["Usa I'd like", "Pede o café", "Diz please"]);
  assert.deepEqual(aberta.essenciais, [0]);
  assert.deepEqual(aberta.armadilhas.map(({ termos }) => termos), ["i want|i wanna", "i like"], "o que está na resposta certa não vira armadilha");
  const [lacuna, escolha] = conteudo.extras;
  assert.deepEqual(lacuna.armadilhas, [{ termos: "want", aviso: "“Want” soa brusco num pedido." }]);
  assert.equal(lacuna.fala.pronuncia, "áid LÁIK a KÓ-fi");
  assert.equal("armadilhas" in escolha, false, "armadilha só na lacuna e na aberta");
  assert.ok(conteudoValido({ ...conteudo }));

  // Essencial só quando se destaca: todos marcados, ou critérios que não casam com o gabarito, não viram essenciais.
  const comCriterios = (criterios) => normalizarConteudo({ ...base, exercicios: [{ ...nulos, tipo: "aberta", enunciado: "Explique.", gabarito: ["a", "b", "c"], criterios, ...retornos }] }, "IA").exercicio;
  assert.equal(comCriterios([{ texto: "A", essencial: true }, { texto: "B", essencial: true }, { texto: "C", essencial: true }]).essenciais, undefined);
  assert.equal(comCriterios([{ texto: "A", essencial: true }, { texto: "B", essencial: false }]).criterios, undefined);
  assert.deepEqual(comCriterios(["A", "B", "C"]).criterios, ["A", "B", "C"], "o formato antigo, só com o texto, continua valendo");

  // Um som certo fica; um exercício extra fora do formato sai sozinho, sem levar o resto da lição junto.
  const violao = normalizarConteudo({
    ...base,
    falas: [{ texto: "Hello!", idioma: "en-US", traducao: "Olá!", pronuncia: null }],
    pratica: { tarefa: "Afine a 6ª corda.", minutos: 3, passos: null, dica: null, som: { rotulo: "Ouvir o Mi (6ª corda solta)", casas: [0, -1, -1, -1, -1, -1] } },
    outroJeito: "z".repeat(601),
    exercicios: [
      { ...nulos, tipo: "lacuna", enunciado: "Complete.", trecho: "Gire a ___.", gabarito: ["tarraxa"], ...retornos },
      { ...nulos, tipo: "multipla_escolha", enunciado: "x".repeat(700), opcoes: [{ id: "a", texto: "Sim" }, { id: "b", texto: "Não" }], gabarito: ["a"], ...retornos },
    ],
  }, "IA");
  assert.deepEqual(violao.pratica.som, { rotulo: "Ouvir o Mi (6ª corda solta)", casas: [0, -1, -1, -1, -1, -1] });
  assert.equal(violao.extras, undefined);
  assert.equal(violao.outroJeito, undefined, "o outro jeito longo demais sai");
  assert.deepEqual(violao.falas, [{ texto: "Hello!", idioma: "en-US", traducao: "Olá!" }], "as falas continuam");
});

test("a troca de acordes vem com o acorde anterior, e as frases de idioma ficam entre aspas curvas para tocar", () => {
  const retornos = { feedbackCorreto: "Isso.", feedbackIncorreto: "Ainda não." };
  const nulos = { contexto: null, trecho: null, trechoTipo: null, fala: null, opcoes: null, itens: null, esquerda: null, direita: null, afirmacao: null, exata: null, criterios: null, modelo: null, armadilhas: null };
  const exercicios = [{ ...nulos, tipo: "lacuna", enunciado: "Complete.", trecho: "Gire a ___.", gabarito: ["tarraxa"], ...retornos }];
  const acorde = (anterior) => ({ tipo: "acorde", nome: "C", casas: [-1, 3, 2, 0, 1, 0], dedos: [0, 3, 2, 0, 1, 0], batida: null, anterior, eventos: null, numerador: null, denominador: null });
  const troca = normalizarConteudo({
    objetivo: "Trocar de acorde.", conceito: "Do Am para o C, dois dedos ficam.", exemplo: "Am → C.",
    recurso: acorde({ nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] }), exercicios,
  }, "IA");
  assert.deepEqual(troca.recurso.anterior, { nome: "Am", casas: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] });
  const semAnterior = normalizarConteudo({ objetivo: "Trocar.", conceito: "Dois dedos ficam.", exemplo: "Am → C.", recurso: acorde({ nome: "Am", casas: [0, 2], dedos: null }), exercicios }, "IA");
  assert.equal(semAnterior.recurso.nome, "C", "o acorde da lição fica");
  assert.equal("anterior" in semAnterior.recurso, false, "o anterior fora do formato sai");

  const idioma = normalizarConteudo({
    objetivo: "Pedir licença.", conceito: 'Para chamar alguém, diga "Excuse me".', exemplo: 'Na rua: "Excuse me, where is the bank?"',
    falas: [{ texto: "Excuse me.", idioma: "en-US", traducao: "Com licença.", pronuncia: null }], exercicios,
  }, "IA");
  assert.equal(idioma.conceito, "Para chamar alguém, diga “Excuse me”.");
  assert.equal(idioma.exemplo, "Na rua: “Excuse me, where is the bank?”");
  const codigo = normalizarConteudo({ objetivo: "Filtrar.", conceito: 'Use WHERE nome = "Ana".', exemplo: "SELECT 1;", exercicios }, "IA");
  assert.equal(codigo.conceito, 'Use WHERE nome = "Ana".', "fora dos idiomas, as aspas ficam como vieram");
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

test("com a IA, o critério essencial continua obrigatório, o erro comum vai junto e a armadilha da lacuna não tem desempate", async () => {
  const contexto = { titulo: "Pedir no café", conceito: "Use I'd like." };
  const aberta = {
    tipo: "aberta", enunciado: "Peça um café.", minimo: 20, gabarito: ["coffee", "i'd like|i would like"], criterios: ["Pede o café", "Usa I'd like."],
    essenciais: [1], armadilhas: [{ termos: "i want|i wanna", aviso: "“I want” soa brusco num pedido." }],
    feedbackCorreto: "Isso.", feedbackIncorreto: "Ainda não.",
  };
  const local = { correta: false, feedback: "Ainda não.", observacao: "“I want” soa brusco num pedido.", simulado: true };
  // O servidor de teste aprova, mas diz que o segundo critério (o essencial) não foi atendido.
  const corrigida = await refinarAvaliacao(contexto, aberta, "I want a coffee, please, thank you very much.", local);
  assert.equal(corrigida.correta, false);
  assert.equal(corrigida.feedback, "Falta o ponto principal desta resposta: usa I'd like.");
  assert.equal(corrigida.observacao, "“I want” soa brusco num pedido.", "o aviso do erro comum continua");
  assert.equal(corrigida.simulado, false);
  const enviado = JSON.parse(pedidos.at(-1).dados.input[1].content);
  assert.deepEqual(enviado.criterios, [{ texto: "Pede o café", essencial: false }, { texto: "Usa I'd like.", essencial: true }]);
  assert.deepEqual(enviado.errosComuns, [{ quando: "i want ou i wanna", aviso: "“I want” soa brusco num pedido." }]);
  assert.match(pedidos.at(-1).dados.input[0].content, /essencial true/);

  const lacuna = {
    tipo: "lacuna", enunciado: "Complete.", trecho: "Gire a ___ para afinar.", gabarito: ["tarraxa"],
    armadilhas: [{ termos: "chave|cravelha", aviso: "Muita gente chama essa peça assim!" }], feedbackCorreto: "Isso.", feedbackIncorreto: "Não.",
  };
  const antes = pedidos.length;
  const armadilha = { correta: false, feedback: "Não.", observacao: "Muita gente chama essa peça assim!" };
  assert.equal(await refinarAvaliacao(contexto, lacuna, "chave", armadilha), armadilha);
  assert.equal(pedidos.length, antes, "a armadilha conhecida não vai ao desempate");

  // Quando a grafia é a lição (idioma), o desempate sabe disso: escrever errado não vira sinônimo.
  const exata = { tipo: "lacuna", enunciado: "Complete.", trecho: "How ___ is it?", gabarito: ["much"], exata: true, feedbackCorreto: "Isso.", feedbackIncorreto: "Não." };
  await refinarAvaliacao(contexto, exata, "mutch", { correta: false, feedback: "Não." });
  assert.equal(JSON.parse(pedidos.at(-1).dados.input[1].content).grafiaImporta, true);
  assert.match(pedidos.at(-1).dados.input[0].content, /grafiaImporta/);
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

test("Luna Max e store false são enviados na triagem e na geração, mesmo com overrides antigos", async () => {
  process.env.OPENAI_MODELO = "modelo-antigo";
  process.env.OPENAI_ESFORCO = "low";
  process.env.OPENAI_MODELO_ESTUDIO = "modelo-antigo";
  const eventos = await coletar(iniciarGeracao("luna-max", "Estudar a história dos assaltos a banco"));
  assert.equal(eventos.at(-1).tipo, "pronto");
  assert.deepEqual(pedidos.map(p => p.dados.text?.format?.name ?? "estrutura"),
    ["triagem_trilha", "estrutura", "triagem_trilha"]);
  for (const { dados } of pedidos) {
    assert.equal(dados.model, "gpt-6-luna");
    assert.deepEqual(dados.reasoning, { effort: "max" });
    assert.equal(dados.store, false);
  }
});

test("OpenAI rejeitando o esforço não faz outro pedido, nem usa a demonstração", async () => {
  modo = "sem-raciocinio";
  const eventos = await coletar(iniciarGeracao("sem-raciocinio", "Frações"));
  assert.deepEqual(eventos, [{ tipo: "erro", codigo: "ia_indisponivel" }]);
  assert.equal(pedidos.length, 1);
  assert.deepEqual(pedidos[0].dados.reasoning, { effort: "max" });
});

test("recusa do pedido, da estrutura ou resposta inválida emite só o erro", async () => {
  for (const [cenario, codigo, esperados] of [
    ["recusar-objetivo", "conteudo_nocivo", 1],
    ["recusar-estrutura", "conteudo_nocivo", 3],
    ["triagem-invalida", "ia_indisponivel", 1],
    ["falha", "ia_indisponivel", 1],
  ]) {
    pedidos = [];
    modo = cenario;
    const eventos = await coletar(iniciarGeracao(cenario, "Aprender um assunto"));
    assert.deepEqual(eventos, [{ tipo: "erro", codigo }]);
    assert.equal(pedidos.length, esperados);
  }
});

test("seleção legada e valor ausente usam OpenAI, e falta de chave impede a geração", async () => {
  process.env.IA = "provedor-legado";
  const eventos = await coletar(iniciarGeracao("legado", "Aprender frações"));
  assert.equal(eventos.at(-1).tipo, "pronto");
  delete process.env.IA;
  assert.doesNotThrow(() => obterGerador());
  delete process.env.OPENAI_API_KEY;
  assert.throws(() => obterGerador(), { codigo: "ia_indisponivel" });
  process.env.OPENAI_API_KEY = "chave-de-teste";
  const base = process.env.OPENAI_BASE_URL;
  process.env.OPENAI_BASE_URL = "http://exemplo.test/v1";
  assert.throws(() => obterGerador(), { codigo: "ia_indisponivel" });
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

test("429 da OpenAI: retry-after respeitado, uma nova tentativa e resposta normal; leitura do retry-after", async () => {
  const { comNovasTentativas, esperaPedida } = await import("../src/servidor/ia/novas-tentativas.ts");
  assert.equal(esperaPedida(new Headers({ "retry-after": "2" })), 2000);
  assert.equal(esperaPedida(new Headers({ "retry-after-ms": "350", "retry-after": "9" })), 350);
  assert.equal(esperaPedida(new Headers({ "retry-after": new Date(10_000 + 3_000).toUTCString() }), 10_000), 3000);
  assert.equal(esperaPedida(new Headers({})), null);

  const original = console.error;
  console.error = () => {};
  try {
    let chamadas = 0;
    const resposta = await comNovasTentativas(async () => {
      chamadas += 1;
      return chamadas === 1
        ? new Response("{}", { status: 429, headers: { "retry-after-ms": "20" } })
        : Response.json({ ok: true });
    }, { rota: "ia-openai" });
    assert.equal(resposta.status, 200);
    assert.deepEqual(await resposta.json(), { ok: true });
    assert.equal(chamadas, 2);

    // Sempre 429: 1 pedido + no máximo 2 novas tentativas.
    chamadas = 0;
    const limite = await comNovasTentativas(async () => {
      chamadas += 1;
      return new Response("{}", { status: 429, headers: { "retry-after": "0" } });
    }, { rota: "ia-openai" });
    assert.equal(limite.status, 429);
    assert.equal(chamadas, 3);
  } finally {
    console.error = original;
  }
});

// O 500 do aceite (Lead, 23/11): uma exceção de dentro de normalizarLicao subia crua até o tratarRota e virava HTTP 500, sem a segunda tentativa de formato. Um campo aninhado demais no JSON do modelo
// estoura a pilha da leitura (RangeError, medido a partir de 2 000 níveis). Agora vale como formato inválido: pede de novo e, falhando de novo, é ia_indisponivel (503).
const aninhado = (niveis) => {
  let texto = "1";
  for (let i = 0; i < niveis; i += 1) texto = `{"a":${texto}}`;
  return texto;
};
const licaoQueEstouraALeitura = JSON.stringify({ ...licaoDeEscolha, resolucao: "@@" }).replace('"@@"', aninhado(20_000));
const esqueletoDeViolao = () => ({
  gerador: GERADOR_OPENAI,
  titulo: "Violão do zero",
  objetivo: "Tocar as primeiras músicas no violão.",
  origem: "IA da OpenAI (teste)",
  fluxos: [{ titulo: "Primeiros passos", licoes: [{ titulo: "Conhecer as partes do violão" }, { titulo: "Afinar as cordas" }] }],
});

test("OpenAI: JSON que estoura a pilha na leitura da lição vale como formato inválido: pede de novo e a lição sai (nada de 500)", async () => {
  modo = "leitura-estoura-depois-ok";
  const conteudo = await obterGerador().gerarConteudo(esqueletoDeViolao(), 0, 0, new AbortController().signal);
  assert.ok(conteudoValido(conteudo));
  assert.equal(pedidosDeLicao, 2, "a segunda tentativa, de formato");
});

test("OpenAI: se a leitura estoura nas duas tentativas, o erro é ia_indisponivel (503, motivo formato), nunca uma exceção crua (500)", async () => {
  modo = "leitura-estoura-sempre";
  const erro = await obterGerador().gerarConteudo(esqueletoDeViolao(), 0, 0, new AbortController().signal).catch((falha) => falha);
  assert.ok(erro instanceof FalhaApi, `veio ${erro instanceof Error ? erro.name : typeof erro}`);
  assert.equal(erro.codigo, "ia_indisponivel");
  assert.equal(erro.motivo, "formato");
  assert.equal(pedidosDeLicao, 2);
});

test('o diagnóstico separa evidência e intenção, encurta a estrutura e chega ao prompt da lição', async () => {
  modo = 'diagnostico';
  const diagnostico = {
    nivel: 'basico', escopo: 'Equação do primeiro grau',
    demonstrados: ['Isolar a incógnita', 'Resolver equações com x dos dois lados'],
    lacunas: [],
  };
  const eventos = await coletar(iniciarGeracao('teste-diagnostico', 'Equação do primeiro grau', { diagnostico }));
  const p = eventos.at(-1).proposta;
  assert.equal(p.objetivo, 'Equação do primeiro grau');
  assert.deepEqual(p.diagnostico, diagnostico);
  assert.equal(p.fluxos.flatMap(f => f.licoes).length, 2);
  const estrutura = pedidos.find(p => p.dados.stream).dados;
  assert.match(estrutura.input[0].content, /até 2 lições/);
  assert.match(estrutura.input[1].content, /Isolar a incógnita/);

  const plano = lerComprovante('proposta', 'teste-diagnostico', p.token).plano;
  assert.equal(plano.curriculoAdaptado, true);
  assert.equal(plano.fluxos[0].licoes[0].resumo, desafioDaEquacao);
  const gerador = obterGerador();
  const sinal = new AbortController().signal;
  const conteudo = await gerador.gerarConteudo(plano, 0, 0, sinal);
  assert.ok(conteudoValido(conteudo));
  await gerador.revisarConteudos(plano, [[conteudo, conteudo]], sinal);
  const pedidoDaLicao = pedidos.find(pedido => pedido.dados.input[1]?.content.includes('Decisão a praticar nesta lição'));
  assert.match(pedidoDaLicao.dados.input[1].content, /Use apenas demonstrados como evidência/);
  assert.match(pedidoDaLicao.dados.input[1].content, /Resolver equações com x dos dois lados/);
  const verificacao = pedidos.at(-1).dados;
  assert.equal(verificacao.text.format.name, 'diagnostico_verificar_curriculo');
  assert.match(JSON.parse(verificacao.input[0].content[0].text).licoes[0].exercicios[0].enunciado, /Qual equação representa/);
});

test('uma falha do provedor não substitui uma adaptação com evidência por uma trilha de reserva', async () => {
  modo = 'falha';
  const diagnostico = { nivel: 'intermediario', escopo: 'Exposição', demonstrados: ['Ajustar o obturador'], lacunas: [] };
  for (const chaveAusente of [false, true]) {
    if (chaveAusente) delete process.env.OPENAI_API_KEY;
    const iniciar = () => iniciarGeracao(`falha-adaptacao-${chaveAusente}`, 'Compensar a exposição com o obturador', { diagnostico });
    if (chaveAusente) assert.throws(iniciar, { codigo: 'ia_indisponivel' });
    else assert.deepEqual(await coletar(iniciar()), [{ tipo: 'erro', codigo: 'ia_indisponivel' }]);
  }
});
