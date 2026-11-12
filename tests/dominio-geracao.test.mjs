import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMITES_GERACAO, interpretarEventoGeracao } from "@studoo/contratos";
import { avaliarResposta, conteudoValido, esqueletoValido } from "../src/dominio/aprendizado/plano.ts";
import { emitirComprovante, lerComprovante } from "../src/servidor/aprendizado/comprovantes.ts";
import { iniciarGeracao } from "../src/servidor/aprendizado/geracao.ts";
import { criarGeradorFalso } from "../src/servidor/ia/falsa.ts";
import { REGRAS_ORDEM_DA_TRILHA, instrucoesDeOrdem } from "../src/servidor/ia/ordem.ts";
import { registrarGeracao, reiniciarLimiteDeGeracoes } from "../src/servidor/ia/limite.ts";

process.env.IA = "falsa";
process.env.STUDOO_IA_FALSA_PAUSA_MS = "0";

async function coletar(geracao, sinal = new AbortController().signal) {
  const eventos = [];
  for await (const evento of geracao.eventos(sinal)) eventos.push(evento);
  return eventos;
}

const usuario = () => `teste-${crypto.randomUUID()}`;

test("objetivo qualquer gera 3 fluxos com 3 lições, em ordem, e cada evento passa pelo contrato", async () => {
  const eventos = await coletar(iniciarGeracao(usuario(), "Frações"));
  assert.deepEqual(eventos.map(({ tipo }) => tipo), [
    "plano", "fluxo", "licao", "licao", "licao", "fluxo", "licao", "licao", "licao", "fluxo", "licao", "licao", "licao", "pronto",
  ]);
  for (const evento of eventos) {
    assert.deepEqual(interpretarEventoGeracao(JSON.stringify(evento)), evento);
  }
  const licoes = eventos.filter(({ tipo }) => tipo === "licao");
  assert.deepEqual(licoes.map(({ fluxo, licao }) => [fluxo, licao]), [
    [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2],
  ]);
  const pronto = eventos.at(-1);
  assert.deepEqual(
    pronto.proposta.fluxos.map(({ titulo, licoes: itens }) => [titulo, itens.map((item) => item.titulo)]),
    [0, 1, 2].map((fluxo) => [
      eventos.find((e) => e.tipo === "fluxo" && e.fluxo === fluxo).titulo,
      licoes.filter((e) => e.fluxo === fluxo).map((e) => e.titulo),
    ]),
  );
  assert.equal(pronto.proposta.titulo, "Frações");
});

test("SQL continua com o plano de demonstração", async () => {
  const eventos = await coletar(iniciarGeracao(usuario(), "Quero praticar SQL para a prova"));
  const pronto = eventos.at(-1);
  assert.equal(pronto.tipo, "pronto");
  assert.deepEqual(pronto.proposta.fluxos.map(({ titulo }) => titulo), ["Primeiros passos", "Praticando", "Desafio"]);
  assert.equal(pronto.proposta.fluxos.flatMap(({ licoes }) => licoes).length, 5);
});

test("SQL vira uma sequência única de aprendizado, sem trechos por assunto e com revisão que mistura filtro e junção", async () => {
  const eventos = await coletar(iniciarGeracao(usuario(), "Quero praticar SQL para a prova"));
  const { proposta } = eventos.at(-1);
  const titulos = proposta.fluxos.flatMap(({ licoes }) => licoes.map(({ titulo }) => titulo));
  assert.deepEqual(titulos.map((titulo) => titulo.split(" ").slice(0, 3).join(" ")), [
    "Filtrar com WHERE", "Relacionar tabelas com", "Combinar condições com", "Revisão: filtro e", "Incluir linhas sem",
  ]);
  assert.ok(proposta.fluxos.every(({ titulo }) => !/consulta|jun[cç]|where|join|sql/i.test(titulo)));
  const gerador = criarGeradorFalso();
  const esqueleto = { gerador: "falsa-sql-v1", origem: proposta.origem, ...proposta };
  const revisao = await gerador.gerarConteudo(esqueleto, 1, 1, new AbortController().signal);
  assert.ok(conteudoValido(revisao));
  assert.match(revisao.exercicio.trecho, /INNER JOIN[\s\S]*WHERE/);
  assert.equal(avaliarResposta(revisao.exercicio, revisao.exercicio.gabarito[0])?.correta, true);
});

test("a trilha genérica tem trechos sem nome de assunto e ao menos uma lição de revisão", async () => {
  for (const objetivo of ["Frações", "Inglês para entrevista"]) {
    const { proposta } = (await coletar(iniciarGeracao(usuario(), objetivo))).at(-1);
    assert.deepEqual(proposta.fluxos.map(({ titulo }) => titulo), ["Primeiros passos", "Praticando", "Indo além"]);
    assert.ok(proposta.fluxos.every(({ titulo }) => !titulo.toLowerCase().includes(objetivo.toLowerCase())));
    assert.ok(proposta.fluxos.flatMap(({ licoes }) => licoes).some(({ titulo }) => /revis/i.test(titulo)));
  }
});

test("a trilha é determinística por objetivo e muda de um objetivo para outro", async () => {
  const estrutura = async (objetivo) =>
    (await coletar(iniciarGeracao(usuario(), objetivo))).filter(({ tipo }) => tipo !== "pronto");
  assert.deepEqual(await estrutura("Inglês para entrevista"), await estrutura("  Inglês   para entrevista "));
  const [um, outro] = [await estrutura("Frações"), await estrutura("Inglês para entrevista")];
  assert.notEqual(um[0].titulo, outro[0].titulo);
});

test("todas as lições genéricas têm conteúdo válido e passam pela aula (certa e errada)", async () => {
  const gerador = criarGeradorFalso();
  const sinal = new AbortController().signal;
  for (const objetivo of ["Frações", "Inglês para entrevista", "x".repeat(LIMITES_GERACAO.objetivoMax)]) {
    const eventos = await coletar(iniciarGeracao(usuario(), objetivo));
    const { token, ...proposta } = eventos.at(-1).proposta;
    const lido = lerComprovante("proposta", "nao-importa", token);
    assert.equal(lido, null);
    const esqueleto = { gerador: "falsa-generica-v1", origem: proposta.origem, ...proposta };
    assert.ok(esqueletoValido(esqueleto));
    for (let fluxo = 0; fluxo < 3; fluxo++) {
      for (let licao = 0; licao < 3; licao++) {
        const conteudo = await gerador.gerarConteudo(esqueleto, fluxo, licao, sinal);
        assert.ok(conteudoValido(conteudo), `${objetivo.slice(0, 10)} ${fluxo}.${licao}`);
        const { exercicio } = conteudo;
        const certa = exercicio.gabarito[0];
        assert.equal(avaliarResposta(exercicio, certa)?.correta, true);
        if (exercicio.tipo === "lacuna") assert.equal(avaliarResposta(exercicio, certa.toUpperCase())?.correta, true);
        else assert.equal(avaliarResposta(exercicio, "z"), null);
        if (exercicio.tipo === "multipla_escolha") {
          const errada = exercicio.opcoes.find(({ id }) => id !== certa).id;
          assert.equal(avaliarResposta(exercicio, errada)?.correta, false);
        }
      }
    }
    assert.equal(await gerador.gerarConteudo(esqueleto, 3, 0, sinal).catch(() => "recusado"), "recusado");
  }
});

test("a posição da opção certa varia entre as lições", async () => {
  const gerador = criarGeradorFalso();
  const sinal = new AbortController().signal;
  const esqueleto = { gerador: "falsa-generica-v1", origem: "o", titulo: "t", objetivo: "Frações", fluxos: [] };
  const posicoes = new Set();
  for (const [fluxo, licao] of [[0, 1], [1, 0], [1, 2], [2, 0], [2, 2]]) {
    const { exercicio } = await gerador.gerarConteudo(esqueleto, fluxo, licao, sinal);
    posicoes.add(exercicio.opcoes.findIndex(({ id }) => id === exercicio.gabarito[0]));
  }
  assert.ok(posicoes.size > 1);
});

test("abortar no meio para a geração: sem mais eventos, sem pronto, sem erro", async () => {
  process.env.STUDOO_IA_FALSA_PAUSA_MS = "20";
  try {
    const controle = new AbortController();
    const recebidos = [];
    for await (const evento of iniciarGeracao(usuario(), "Frações").eventos(controle.signal)) {
      recebidos.push(evento.tipo);
      if (recebidos.length === 3) controle.abort();
    }
    assert.deepEqual(recebidos, ["plano", "fluxo", "licao"]);
  } finally {
    process.env.STUDOO_IA_FALSA_PAUSA_MS = "0";
  }
});

test("sinal já abortado não emite nada", async () => {
  const controle = new AbortController();
  controle.abort();
  assert.deepEqual(await coletar(iniciarGeracao(usuario(), "Frações"), controle.signal), []);
});

test("erros antes do início: objetivo fora dos limites e IA indisponível", () => {
  for (const objetivo of ["", "  a ", "ab", "x".repeat(LIMITES_GERACAO.objetivoMax + 1)]) {
    assert.throws(() => iniciarGeracao(usuario(), objetivo), { codigo: "invalido" });
  }
  assert.doesNotThrow(() => iniciarGeracao(usuario(), "abc"));
  assert.doesNotThrow(() => iniciarGeracao(usuario(), "x".repeat(LIMITES_GERACAO.objetivoMax)));
  process.env.IA = "real";
  try {
    assert.throws(() => iniciarGeracao(usuario(), "Frações"), { codigo: "ia_indisponivel" });
  } finally {
    process.env.IA = "falsa";
  }
});

test("teto de gerações por pessoa, configurável por variável, e janela deslizante", () => {
  reiniciarLimiteDeGeracoes();
  process.env.STUDOO_LIMITE_GERACOES = "2";
  process.env.STUDOO_JANELA_GERACOES_MIN = "10";
  try {
    const ana = usuario();
    const bia = usuario();
    const t0 = 1_000_000;
    assert.equal(registrarGeracao(ana, t0), true);
    assert.equal(registrarGeracao(ana, t0 + 1), true);
    assert.equal(registrarGeracao(ana, t0 + 2), false);
    assert.equal(registrarGeracao(bia, t0 + 2), true, "o teto é por pessoa");
    assert.equal(registrarGeracao(ana, t0 + 9 * 60_000), false);
    assert.equal(registrarGeracao(ana, t0 + 10 * 60_000 + 2), true, "a janela libera depois de passar");

    const caio = usuario();
    iniciarGeracao(caio, "Frações");
    iniciarGeracao(caio, "Frações");
    assert.throws(() => iniciarGeracao(caio, "Frações"), { codigo: "limite_geracoes" });
    assert.equal(registrarGeracao(usuario(), t0), true);
    process.env.STUDOO_LIMITE_GERACOES = "lixo";
    assert.equal(registrarGeracao(usuario()), true, "valor inválido volta ao padrão");
  } finally {
    delete process.env.STUDOO_LIMITE_GERACOES;
    delete process.env.STUDOO_JANELA_GERACOES_MIN;
    reiniciarLimiteDeGeracoes();
  }
});

test("o token da proposta é assinado, ligado à pessoa e rejeita esqueleto adulterado", async () => {
  const eventos = await coletar(iniciarGeracao(usuario(), "Frações"));
  const { token } = eventos.at(-1).proposta;
  assert.ok(token.length < 6000);
  const ana = "ana";
  const esqueleto = { gerador: "falsa-generica-v1", titulo: "t", objetivo: "o", origem: "x", fluxos: [{ titulo: "f", licoes: [{ titulo: "l" }] }] };
  const emitido = emitirComprovante("proposta", ana, { id: "1", expiraEm: Date.now() + 1000, plano: esqueleto });
  assert.deepEqual(lerComprovante("proposta", ana, emitido)?.plano, esqueleto);
  assert.equal(lerComprovante("proposta", "bia", emitido), null);
  assert.equal(lerComprovante("avaliacao", ana, emitido), null);
  const [corpo, assinatura] = emitido.split(".");
  const adulterado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(corpo, "base64url")), plano: { ...esqueleto, titulo: "outro" } })).toString("base64url");
  assert.equal(lerComprovante("proposta", ana, `${adulterado}.${assinatura}`), null);
  const invalido = emitirComprovante("proposta", ana, { id: "1", expiraEm: Date.now() + 1000, plano: { ...esqueleto, fluxos: [] } });
  assert.equal(lerComprovante("proposta", ana, invalido), null, "esqueleto inválido não vale mesmo assinado");
});

test("as regras de ordenação da trilha ficam registradas para o prompt da IA real", () => {
  assert.equal(REGRAS_ORDEM_DA_TRILHA.length, 6);
  const texto = instrucoesDeOrdem();
  for (const trecho of ["pré-requisitos", "conceito novo", "dificuldade cresce", "Intercale", "revisão", "Não agrupe"]) {
    assert.ok(texto.includes(trecho), trecho);
  }
});
