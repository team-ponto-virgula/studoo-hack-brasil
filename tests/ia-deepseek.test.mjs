import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import { interpretarEventoGeracao } from "@studoo/contratos";
import { mensagens } from "../src/mensagens/pt-BR.ts";
import { conteudoValido, esqueletoValido } from "../src/dominio/aprendizado/plano.ts";
import { reiniciarLimiteDeGeracoes } from "../src/servidor/ia/limite.ts";

process.env.DATABASE_URL ??= "postgresql://teste:teste@127.0.0.1:5432/teste";
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);

const { iniciarGeracao } = await import("../src/servidor/aprendizado/geracao.ts");
const { obterGerador } = await import("../src/servidor/ia/gerador.ts");
const { GERADOR_DEEPSEEK, MODELO_PADRAO } = await import("../src/servidor/ia/deepseek.ts");
const { refinarAvaliacao } = await import("../src/servidor/aprendizado/correcao.ts");
const { pedirJson } = await import("../src/servidor/estudio/ia.ts");
const { transcrever } = await import("../src/servidor/estudio/voz.ts");
const { gerarConteudos } = await import("../src/servidor/aprendizado/servico.ts");
const { banco } = await import("../src/servidor/banco/cliente.ts");
const { GET: getAuthConfig } = await import("../src/app/api/auth/config/route.ts");

const linhasDaTrilha = [
  '{"tipo":"plano","titulo":"Violão do zero","objetivo":"Tocar as primeiras músicas no violão."}',
  '{"tipo":"fluxo","titulo":"Primeiros passos"}',
  '{"tipo":"licao","titulo":"Conhecer as partes do violão","resumo":"Reconhecer a cabeça, o braço e o corpo do violão."}',
  '{"tipo":"licao","titulo":"Afinar as cordas"}',
  '{"tipo":"fluxo","titulo":"Praticando"}',
  '{"tipo":"licao","titulo":"Primeiros acordes"}',
  '{"tipo":"licao","titulo":"Revisão: acordes e afinação"}',
];

const licaoValida = {
  objetivo: "Reconhecer as partes do violão.",
  conceito: "O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete, no corpo.",
  exemplo: "Ao afinar, você gira as tarraxas, que ficam na cabeça do violão.",
  exemploTipo: "exemplo",
  passos: null,
  outroJeito: "Pense no violão como uma ponte entre a cabeça e o cavalete.",
  recurso: null,
  falas: null,
  pratica: null,
  exercicios: [
    {
      tipo: "multipla_escolha",
      enunciado: "Onde ficam as tarraxas?",
      contexto: null,
      trecho: null,
      trechoTipo: null,
      fala: null,
      opcoes: [{ id: "a", texto: "Na cabeça" }, { id: "b", texto: "No corpo" }, { id: "c", texto: "No braço" }],
      itens: null,
      esquerda: null,
      direita: null,
      afirmacao: null,
      gabarito: ["a"],
      exata: null,
      criterios: null,
      modelo: null,
      armadilhas: null,
      feedbackCorreto: "Isso: as tarraxas ficam na cabeça do violão.",
      feedbackIncorreto: "As tarraxas ficam na cabeça, a ponta do braço.",
    },
  ],
};

let servidorDeepSeek;
let servidorOpenAiArmadilha;
let pedidosDeepSeek = [];
let pedidosOpenAi = [];
let modo = "normal";
let tentativaConteudo = 0;
let emAndamento = 0;
let picoParalelo = 0;

function responderSseChat(resposta, linhas) {
  resposta.writeHead(200, { "Content-Type": "text/event-stream" });
  const texto = `${linhas.join("\n")}\n`;
  for (let i = 0; i < texto.length; i += 24) {
    resposta.write(`data: ${JSON.stringify({ choices: [{ delta: { content: texto.slice(i, i + 24) } }] })}\n\n`);
  }
  resposta.write("data: [DONE]\n\n");
  resposta.end();
}

function responderJsonChat(resposta, objeto) {
  resposta.writeHead(200, { "Content-Type": "application/json" });
  resposta.end(JSON.stringify({
    choices: [{ message: { content: typeof objeto === "string" ? objeto : JSON.stringify(objeto) } }],
  }));
}

async function coletar(geracao, sinal = new AbortController().signal) {
  const eventos = [];
  for await (const evento of geracao.eventos(sinal, { aoVivo: true })) {
    interpretarEventoGeracao(JSON.stringify(evento));
    eventos.push(evento);
  }
  return eventos;
}

async function gerarEsqueletoDireto(objetivo, sinal = new AbortController().signal) {
  const gerador = obterGerador();
  const estrutura = gerador.gerarEstrutura(objetivo, sinal, { aoVivo: true });
  const esqueleto = { gerador: "", titulo: "", objetivo, origem: "", fluxos: [] };
  while (true) {
    const passo = await estrutura.next();
    if (passo.done) {
      esqueleto.gerador = passo.value.gerador;
      esqueleto.origem = passo.value.origem;
      break;
    }
    const ev = passo.value;
    if (ev.tipo === "plano") {
      esqueleto.titulo = ev.titulo;
      esqueleto.objetivo = ev.objetivo;
    } else if (ev.tipo === "fluxo") {
      esqueleto.fluxos.push({ titulo: ev.titulo, licoes: [] });
    } else {
      esqueleto.fluxos[ev.fluxo].licoes.push({ titulo: ev.titulo });
    }
  }
  return { gerador, esqueleto };
}

before(async () => {
  servidorDeepSeek = createServer(async (req, res) => {
    const pedacos = [];
    for await (const p of req) pedacos.push(p);
    const corpo = JSON.parse(Buffer.concat(pedacos).toString("utf8"));
    pedidosDeepSeek.push({ url: req.url, auth: req.headers.authorization, corpo });

    if (req.url !== "/chat/completions") {
      res.writeHead(404);
      res.end();
      return;
    }
    if (modo === "erro-500") {
      res.writeHead(500);
      res.end("erro interno");
      return;
    }
    if (modo === "erro-401") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Authentication Fails" } }));
      return;
    }
    if (modo === "medir-paralelo" && !corpo.stream) {
      emAndamento += 1;
      picoParalelo = Math.max(picoParalelo, emAndamento);
      await new Promise((r) => setTimeout(r, 25));
      emAndamento -= 1;
      responderJsonChat(res, licaoValida);
      return;
    }
    if (modo === "429-depois-ok" && pedidosDeepSeek.length === 1) {
      res.writeHead(429, { "Content-Type": "application/json", "retry-after": "0" });
      res.end(JSON.stringify({ error: { message: "Rate limit exceeded" } }));
      return;
    }
    if (modo === "429-espera-longa") {
      res.writeHead(429, { "Content-Type": "application/json", "retry-after": "30" });
      res.end(JSON.stringify({ error: { message: "Rate limit exceeded" } }));
      return;
    }
    if (modo === "erro-429") {
      res.writeHead(429, { "Content-Type": "application/json", "retry-after": "0" });
      res.end(JSON.stringify({ error: { message: "Rate limit exceeded" } }));
      return;
    }
    if (modo === "erro-404-modelo") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Model Not Exist" } }));
      return;
    }
    if (modo === "erro-meio-stream" && corpo.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `${linhasDaTrilha[0]}\n` } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ error: { message: "stream failed" } })}\n\n`);
      res.end();
      return;
    }
    if (modo === "recusa-thinking" && corpo.thinking) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Unknown parameter: thinking" } }));
      return;
    }
    if (corpo.stream) {
      if (modo === "lento") {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: `${linhasDaTrilha[0]}\n` } }] })}\n\n`);
        setTimeout(() => {
          if (!res.writableEnded) res.end();
        }, 400);
        return;
      }
      responderSseChat(res, linhasDaTrilha);
      return;
    }

    const sistema = String(corpo.messages?.[0]?.content ?? "");
    if (sistema.includes("corrige a resposta aberta")) {
      responderJsonChat(res, {
        criterios: [{ atendido: true }, { atendido: true }],
        correta: true,
        feedback: "Boa explicação com suas próprias palavras.",
      });
      return;
    }
    if (sistema.includes("confere a resposta de uma lacuna")) {
      responderJsonChat(res, { equivalente: true });
      return;
    }
    if (sistema.includes("Transcreva fielmente")) {
      responderJsonChat(res, { paginas: [{ numero: 1, texto: "Texto lido da imagem com frações 1/2." }] });
      return;
    }
    if (modo === "branco-depois-valido") {
      tentativaConteudo += 1;
      if (tentativaConteudo === 1) {
        responderJsonChat(res, "   \n  ");
        return;
      }
      responderJsonChat(res, licaoValida);
      return;
    }
    if (modo === "json-invalido-depois-valido") {
      tentativaConteudo += 1;
      if (tentativaConteudo === 1) {
        responderJsonChat(res, "{invalido");
        return;
      }
      responderJsonChat(res, licaoValida);
      return;
    }
    responderJsonChat(res, licaoValida);
  });

  servidorOpenAiArmadilha = createServer((req, res) => {
    pedidosOpenAi.push(req.url);
    // Modo misto: só a transcrição da gravação pode ir para a OpenAI. Texto (/responses) nunca.
    if (req.method === "POST" && req.url === "/audio/transcriptions") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ text: "O violão tem corpo, braço e cabeça." }));
      return;
    }
    res.writeHead(500);
    res.end("OpenAI não deve ser chamada para texto quando IA=deepseek");
  });

  await Promise.all([
    new Promise((resolve) => servidorDeepSeek.listen(0, "127.0.0.1", resolve)),
    new Promise((resolve) => servidorOpenAiArmadilha.listen(0, "127.0.0.1", resolve)),
  ]);

  const { port: portaDs } = servidorDeepSeek.address();
  const { port: portaOa } = servidorOpenAiArmadilha.address();

  process.env.IA = "deepseek";
  process.env.DEEPSEEK_API_KEY = "sk-deepseek-teste";
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${portaDs}`;
  delete process.env.DEEPSEEK_MODELO;
  delete process.env.DEEPSEEK_RACIOCINIO;
  process.env.STUDOO_IA_RESERVA = "falsa";
  process.env.STUDOO_IA_FALSA_PAUSA_MS = "0";

  // Garante que mesmo com OPENAI_API_KEY presente, nada vai para a OpenAI quando IA=deepseek.
  process.env.OPENAI_API_KEY = "sk-openai-armadilha";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${portaOa}`;
});

beforeEach(() => {
  pedidosDeepSeek = [];
  pedidosOpenAi = [];
  modo = "normal";
  tentativaConteudo = 0;
  process.env.IA = "deepseek";
  process.env.DEEPSEEK_API_KEY = "sk-deepseek-teste";
  delete process.env.DEEPSEEK_MODELO;
  delete process.env.DEEPSEEK_RACIOCINIO;
  process.env.STUDOO_IA_RESERVA = "falsa";
  process.env.STUDOO_IA_FALSA_PAUSA_MS = "0";
  reiniciarLimiteDeGeracoes();
});

after(async () => {
  servidorDeepSeek?.closeAllConnections();
  servidorOpenAiArmadilha?.closeAllConnections();
  await Promise.all([
    new Promise((resolve) => servidorDeepSeek?.close(resolve)),
    new Promise((resolve) => servidorOpenAiArmadilha?.close(resolve)),
  ]);
});

test("gera trilha via SSE e conteúdo via json_object com origem e gerador da DeepSeek", async () => {
  assert.equal(MODELO_PADRAO, "deepseek-flash");
  const eventos = await coletar(iniciarGeracao("u-ds-1", "Aprender violão"));
  const pronto = eventos.at(-1);
  assert.equal(pronto?.tipo, "pronto");
  assert.equal(pronto.proposta.origem, `IA da DeepSeek (${MODELO_PADRAO})`);
  assert.equal(pedidosDeepSeek[0].auth, "Bearer sk-deepseek-teste");
  assert.equal(pedidosDeepSeek[0].corpo.model, "deepseek-flash");
  assert.deepEqual(pedidosDeepSeek[0].corpo.thinking, { type: "disabled" });
  assert.equal(pedidosDeepSeek[0].corpo.stream, true);

  const { gerador, esqueleto } = await gerarEsqueletoDireto("Aprender violão");
  assert.equal(esqueleto.gerador, GERADOR_DEEPSEEK);
  assert.equal(esqueletoValido(esqueleto), true);

  const conteudo = await gerador.gerarConteudo(esqueleto, 0, 0, new AbortController().signal);
  assert.equal(conteudoValido(conteudo), true);
  assert.equal(conteudo.origem, esqueleto.origem);

  const pedidoConteudo = pedidosDeepSeek.at(-1).corpo;
  assert.deepEqual(pedidoConteudo.response_format, { type: "json_object" });
  assert.equal(pedidoConteudo.max_tokens, 8192);
  assert.match(pedidoConteudo.messages[0].content, /json/i);
  assert.equal(pedidosOpenAi.length, 0);
});

test("repete uma vez quando DeepSeek retorna conteúdo só com espaços ou JSON inválido", async () => {
  const { gerador, esqueleto } = await gerarEsqueletoDireto("Aprender violão");

  modo = "branco-depois-valido";
  tentativaConteudo = 0;
  const c1 = await gerador.gerarConteudo(esqueleto, 0, 0, new AbortController().signal);
  assert.equal(conteudoValido(c1), true);
  assert.equal(tentativaConteudo, 2);

  modo = "json-invalido-depois-valido";
  tentativaConteudo = 0;
  const c2 = await gerador.gerarConteudo(esqueleto, 0, 0, new AbortController().signal);
  assert.equal(conteudoValido(c2), true);
  assert.equal(tentativaConteudo, 2);
});

test("correção aberta e desempate de lacuna funcionam com IA=deepseek sem tocar na OpenAI", async () => {
  const aberta = {
    tipo: "aberta",
    enunciado: "Explique o que são frações.",
    minimo: 30,
    gabarito: ["partes", "inteiro"],
    criterios: ["Cita partes iguais", "Relaciona ao inteiro"],
    feedbackCorreto: "Muito bem!",
    feedbackIncorreto: "Revise o conceito.",
  };
  const rAberta = await refinarAvaliacao(
    { titulo: "Frações", conceito: "Partes iguais de um inteiro." },
    aberta,
    "Fração mostra partes iguais de um todo inteiro.",
    { correta: false, feedback: "local", simulado: true },
  );
  assert.equal(rAberta.correta, true);
  assert.equal(rAberta.simulado, false);

  const lacuna = {
    tipo: "lacuna",
    enunciado: "Complete",
    trecho: "O violão tem ___ cordas.",
    gabarito: ["6"],
    feedbackCorreto: "Certo!",
    feedbackIncorreto: "São seis cordas.",
  };
  const rLacuna = await refinarAvaliacao(
    { titulo: "Violão", conceito: "Seis cordas." },
    lacuna,
    "seis",
    { correta: false, feedback: "São seis cordas.", simulado: true },
  );
  assert.equal(rLacuna.correta, true);
  assert.equal(pedidosOpenAi.length, 0);
});

test("Estúdio leitura de imagem funciona em deepseek-flash e recusa em modelo sem visão", async () => {
  process.env.DEEPSEEK_MODELO = "deepseek-flash";
  const anexo = [{ type: "input_image", image_url: "data:image/jpeg;base64,AAAA" }];
  const ok = await pedirJson("leitura_material", { type: "object" }, "Transcreva fielmente.", {}, anexo);
  assert.equal(ok.paginas[0].texto, "Texto lido da imagem com frações 1/2.");
  assert.equal(pedidosDeepSeek[0].corpo.messages[1].content[1].type, "image_url");
  assert.equal(pedidosDeepSeek[0].corpo.messages[1].content[1].image_url.url, "data:image/jpeg;base64,AAAA");

  process.env.DEEPSEEK_MODELO = "deepseek-v4-pro";
  await assert.rejects(
    () => pedirJson("leitura_material", { type: "object" }, "Transcreva fielmente.", {}, anexo),
    (erro) => erro?.codigo === "ia_indisponivel",
  );
  assert.equal(pedidosOpenAi.length, 0);
});

test("gravação com IA=deepseek: sem a chave da OpenAI fica indisponível; com a chave (modo misto) transcreve pela OpenAI", async () => {
  const originalTx = banco.$transaction;
  banco.$transaction = async () => true;
  const chave = process.env.OPENAI_API_KEY;
  const wavFake = Buffer.from("RIFF\x00\x00\x00\x00WAVEfmt ");
  const arquivo = { nome: "explicacao.wav", tipo: "audio/wav", base64: wavFake.toString("base64") };
  try {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(() => transcrever("u-ds-voz", arquivo), (erro) => erro?.codigo === "voz_indisponivel");
    assert.equal(pedidosOpenAi.length, 0);

    process.env.OPENAI_API_KEY = chave;
    const { texto } = await transcrever("u-ds-voz", arquivo);
    assert.equal(texto, "O violão tem corpo, braço e cabeça.");
    assert.deepEqual(pedidosOpenAi, ["/audio/transcriptions"]);
    assert.equal(pedidosDeepSeek.length, 0);

    // Com a IA simulada, a gravação continua indisponível mesmo com a chave.
    pedidosOpenAi = [];
    process.env.IA = "falsa";
    await assert.rejects(() => transcrever("u-ds-voz", arquivo), (erro) => erro?.codigo === "voz_indisponivel");
    assert.equal(pedidosOpenAi.length, 0);
  } finally {
    process.env.OPENAI_API_KEY = chave;
    banco.$transaction = originalTx;
  }
});

test("429 da DeepSeek: espera o retry-after e tenta de novo uma vez com sucesso; espera longa desiste sem repetir", async () => {
  const logs = [];
  const origErr = console.error;
  console.error = (msg) => logs.push(String(msg));
  try {
    modo = "429-depois-ok";
    const dado = await pedirJson("teste", { type: "object" }, "Responda em json.", { pergunta: "x" });
    assert.equal(dado.objetivo, licaoValida.objetivo, "resposta normal depois do 429");
    assert.equal(pedidosDeepSeek.length, 2, "uma nova tentativa");
    const registro = logs.map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .find((o) => o?.codigo === "limite_do_provedor");
    assert.deepEqual(
      { rota: registro?.rota, motivo: registro?.motivo, tentativa: registro?.tentativa, espera: registro?.espera_ms },
      { rota: "ia-deepseek", motivo: "nova_tentativa", tentativa: 1, espera: 0 },
    );

    pedidosDeepSeek = [];
    logs.length = 0;
    modo = "429-espera-longa";
    const inicio = Date.now();
    await assert.rejects(() => pedirJson("teste", { type: "object" }, "Responda em json.", { pergunta: "x" }), (e) => e?.codigo === "ia_indisponivel");
    assert.equal(pedidosDeepSeek.length, 1, "retry-after de 30 s passa do orçamento de 8 s: não repete");
    assert.ok(Date.now() - inicio < 2_000, "não espera os 30 s");
    assert.ok(logs.some((l) => l.includes('"motivo":"espera_longa"')));
    assert.equal(pedidosOpenAi.length, 0);
  } finally {
    console.error = origErr;
  }
});

test("reserva falsa e sem reserva funcionam com IA=deepseek; raciocínio configurável e fallback de thinking", async () => {
  modo = "erro-500";
  const evReserva = await coletar(iniciarGeracao("u-ds-res", "Aprender violão"));
  assert.equal(evReserva.at(-1)?.tipo, "pronto");
  assert.match(evReserva.at(-1)?.proposta.origem, /demonstração|simulada/i);

  process.env.STUDOO_IA_RESERVA = "nenhuma";
  const evErro = await coletar(iniciarGeracao("u-ds-err", "Aprender violão"));
  assert.equal(evErro.at(-1)?.tipo, "erro");
  assert.equal(evErro.at(-1)?.codigo, "ia_indisponivel");

  delete process.env.DEEPSEEK_API_KEY;
  assert.throws(() => obterGerador(), (erro) => erro?.codigo === "ia_indisponivel");

  process.env.DEEPSEEK_API_KEY = "sk-deepseek-teste";
  process.env.DEEPSEEK_RACIOCINIO = "true";
  modo = "recusa-thinking";
  pedidosDeepSeek = [];
  const evThinking = await coletar(iniciarGeracao("u-ds-think", "Aprender violão"));
  assert.equal(evThinking.at(-1)?.tipo, "pronto");
  assert.deepEqual(pedidosDeepSeek[0].corpo.thinking, { type: "enabled" });
  assert.equal(pedidosDeepSeek[1].corpo.thinking, undefined);
});

test("cancelar no meio para a leitura sem pronto e sem erro", async () => {
  modo = "lento";
  const controlador = new AbortController();
  const eventos = [];
  for await (const evento of iniciarGeracao("u-ds-abort", "Aprender violão").eventos(controlador.signal, { aoVivo: true })) {
    eventos.push(evento);
    if (eventos.length === 1) controlador.abort();
  }
  assert.equal(eventos.some((e) => e.tipo === "pronto" || e.tipo === "erro"), false);
});

test("401, 429, 404 (modelo inexistente) e 5xx registram log e falham sem repetição em laço (429: no máximo 2 novas tentativas)", async () => {
  process.env.STUDOO_IA_RESERVA = "nenhuma";
  const logs = [];
  const origErr = console.error;
  console.error = (msg) => logs.push(String(msg));

  try {
    for (const [caso, statusEsperado] of [["erro-401", 401], ["erro-429", 429], ["erro-500", 500], ["erro-404-modelo", 404]]) {
      pedidosDeepSeek = [];
      logs.length = 0;
      modo = caso;
      const ev = await coletar(iniciarGeracao(`u-ds-${caso}`, "Aprender violão"));
      assert.equal(ev.at(-1)?.tipo, "erro");
      assert.equal(ev.at(-1)?.codigo, "ia_indisponivel");
      assert.equal(pedidosDeepSeek.length, statusEsperado === 429 ? 3 : 1);

      const registroDs = logs.map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      }).find((o) => o?.rota === "ia-deepseek" && o?.codigo === "ia_indisponivel");
      assert.equal(registroDs?.codigo, "ia_indisponivel");
      assert.equal(registroDs?.status, statusEsperado);
      if (statusEsperado === 404) {
        assert.equal(registroDs?.motivo, "modelo_inexistente");
      }
    }
  } finally {
    console.error = origErr;
  }
});

test("erro no meio do streaming após o primeiro evento não usa reserva e emite erro na tela", async () => {
  process.env.STUDOO_IA_RESERVA = "falsa";
  modo = "erro-meio-stream";
  const eventos = await coletar(iniciarGeracao("u-ds-meio", "Aprender violão"));
  assert.equal(eventos[0]?.tipo, "plano");
  assert.equal(eventos.at(-1)?.tipo, "erro");
  assert.equal(eventos.at(-1)?.codigo, "ia_indisponivel");
  assert.equal(eventos.some((e) => e.tipo === "pronto"), false);
});

test("/api/auth/config expõe o provedor ativo e privacidadePorProvedor identifica OpenAI, DeepSeek ou demonstração", async () => {
  process.env.IA = "deepseek";
  const resDs = await getAuthConfig(new Request("http://127.0.0.1:3000/api/auth/config"));
  const bodyDs = await resDs.json();
  assert.equal(bodyDs.ia, "deepseek");
  assert.match(mensagens.estudio.privacidadePorProvedor(bodyDs.ia), /pela DeepSeek/);

  process.env.IA = "openai";
  const resOa = await getAuthConfig(new Request("http://127.0.0.1:3000/api/auth/config"));
  const bodyOa = await resOa.json();
  assert.equal(bodyOa.ia, "openai");
  assert.match(mensagens.estudio.privacidadePorProvedor(bodyOa.ia), /pela OpenAI/);

  process.env.IA = "falsa";
  const resFalsa = await getAuthConfig(new Request("http://127.0.0.1:3000/api/auth/config"));
  const bodyFalsa = await resFalsa.json();
  assert.equal(bodyFalsa.ia, "falsa");
  assert.doesNotMatch(mensagens.estudio.privacidadePorProvedor(bodyFalsa.ia), /OpenAI|DeepSeek/);
});

test("avisos da voz ao vivo citam só quem recebe o dado: voz pela OpenAI e, no modo misto, texto pela DeepSeek", () => {
  const voz = mensagens.estudio.vozAoVivo;
  for (const f of [voz.notaPrivacidadePorProvedor, voz.privacidadeTextoPorProvedor]) {
    assert.match(f("openai"), /OpenAI/);
    assert.doesNotMatch(f("openai"), /DeepSeek/);
    assert.match(f("deepseek"), /voz vai para a OpenAI/);
    assert.match(f("deepseek"), /avaliado pela DeepSeek/);
  }
  // O aviso do material com DeepSeek continua citando só a DeepSeek.
  assert.doesNotMatch(mensagens.estudio.privacidadePorProvedor("deepseek"), /OpenAI/);
});

test("aceite: as lições são escritas uma por vez (uma chamada por lição, nunca em paralelo)", async () => {
  const { esqueleto } = await gerarEsqueletoDireto("Aprender violão");
  const licoes = esqueleto.fluxos.reduce((n, f) => n + f.licoes.length, 0);
  pedidosDeepSeek = [];
  modo = "medir-paralelo";
  picoParalelo = 0;
  const conteudos = await gerarConteudos("u-ds-aceite", esqueleto);
  assert.equal(conteudos.flat().length, licoes);
  assert.equal(pedidosDeepSeek.length, licoes, "uma chamada por lição");
  assert.equal(picoParalelo, 1, "nenhuma chamada em paralelo");
  assert.equal(pedidosOpenAi.length, 0);
});
