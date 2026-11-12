import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { LIMITES_GERACAO, interpretarEventoGeracao } from "@studoo/contratos";
import pg from "pg";

const origem = process.env.STUDOO_ORIGEM;
const prefixo = "/api/aprendizado";
const AO_VIVO = `${prefixo}/propostas/ao-vivo`;

function chamar(caminho, { metodo = "GET", corpo, cookie, origemPedido = origem, sinal } = {}) {
  const headers = {};
  if (origemPedido) headers.Origin = origemPedido;
  if (cookie) headers.Cookie = cookie;
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  return fetch(new URL(caminho, origem), {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: sinal,
  });
}

async function login(email) {
  const resposta = await chamar("/api/login", { metodo: "POST", corpo: { email, senha: process.env.STUDOO_SENHA } });
  assert.equal(resposta.status, 200);
  return (resposta.headers.get("set-cookie") ?? "").split(";")[0];
}

/** Lê o corpo NDJSON aos poucos. `linhas()` devolve cada linha bruta assim que ela chega. */
async function* linhas(resposta) {
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let resto = "";
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      resto += decodificador.decode(value, { stream: true });
      let fim;
      while ((fim = resto.indexOf("\n")) >= 0) {
        yield resto.slice(0, fim);
        resto = resto.slice(fim + 1);
      }
    }
  } finally {
    await leitor.cancel().catch(() => undefined);
  }
  assert.equal(resto, "", "toda linha termina com \\n");
}

async function gerar(cookie, objetivo) {
  const resposta = await chamar(AO_VIVO, { metodo: "POST", corpo: { objetivo }, cookie });
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get("content-type"), /^application\/x-ndjson/);
  const brutas = [];
  const eventos = [];
  for await (const linha of linhas(resposta)) {
    brutas.push(linha);
    const evento = interpretarEventoGeracao(linha);
    assert.ok(evento, `linha fora do contrato: ${linha.slice(0, 80)}`);
    eventos.push(evento);
  }
  return { brutas, eventos };
}

function estruturaDosEventos(eventos) {
  const fluxos = [];
  for (const evento of eventos) {
    if (evento.tipo === "fluxo") fluxos.push({ titulo: evento.titulo, licoes: [] });
    if (evento.tipo === "licao") fluxos[evento.fluxo].licoes.push(evento.titulo);
  }
  return fluxos;
}

async function removerContas(banco, ids) {
  const tabelas = ["RegistroEstudo", "Licao", "Fluxo", "PlanoAprendizado", "Sessao"];
  await banco.query("BEGIN");
  try {
    for (const tabela of tabelas) await banco.query(`DELETE FROM "${tabela}" WHERE "usuarioId" = ANY($1)`, [ids]);
    await banco.query('DELETE FROM "Usuario" WHERE "id" = ANY($1)', [ids]);
    await banco.query("COMMIT");
  } catch (erro) {
    await banco.query("ROLLBACK");
    throw erro;
  }
}

test("trilha gerada ao vivo via HTTP com contas sintéticas", async (t) => {
  const conexao = new URL(process.env.DATABASE_URL ?? "invalid:");
  assert.equal(conexao.hostname, "127.0.0.1");
  assert.equal(conexao.pathname, "/studoo_local");
  assert.equal(origem, "http://localhost:3000");
  assert.equal(process.env.IA, "falsa");
  assert.equal(process.env.EMAIL, "falso");

  const banco = new pg.Client({ connectionString: conexao.href });
  const contas = Array.from({ length: 3 }, () => {
    const id = randomUUID();
    return { id, email: `teste-${id}@example.test` };
  });
  await banco.connect();
  t.after(async () => {
    try {
      await removerContas(banco, contas.map(({ id }) => id));
      const chave = Buffer.from(process.env.STUDOO_CHAVE_ASSINATURA, "hex");
      const chavesLogin = contas.map(({ email }) =>
        createHmac("sha256", chave).update(`login\0loopback\0${email}`).digest("hex"));
      await banco.query('DELETE FROM "TentativaLogin" WHERE "chave" = ANY($1)', [chavesLogin]);
    } finally {
      await banco.end();
    }
  });
  for (const { id, email } of contas) {
    const insercao = await banco.query(
      `INSERT INTO "Usuario" ("id", "email", "senhaHash", "fuso")
       SELECT $1, $2, "senhaHash", "fuso" FROM "Usuario" WHERE "email" = $3`,
      [id, email, process.env.STUDOO_EMAIL],
    );
    assert.equal(insercao.rowCount, 1);
  }

  const [cookie, outroCookie, cookieLimite] = await Promise.all(contas.map(({ email }) => login(email)));
  const planosNoBanco = async (usuarioId) =>
    Number((await banco.query('SELECT count(*) FROM "PlanoAprendizado" WHERE "usuarioId" = $1', [usuarioId])).rows[0].count);
  const listar = async (sessao = cookie) => (await chamar(`${prefixo}/planos`, { cookie: sessao })).json();
  const enviar = (caminho, corpo, sessao = cookie) => chamar(`${prefixo}${caminho}`, { metodo: "POST", corpo, cookie: sessao });

  await t.test("erros antes do início seguem o JSON de erro, sem abrir o fluxo", async () => {
    const semSessao = await chamar(AO_VIVO, { metodo: "POST", corpo: { objetivo: "Frações" } });
    assert.equal(semSessao.status, 401);
    assert.match(semSessao.headers.get("content-type"), /^application\/json/);
    assert.equal((await semSessao.json()).codigo, "nao_autenticado");

    const estrangeira = await chamar(AO_VIVO, {
      metodo: "POST", corpo: { objetivo: "Frações" }, cookie, origemPedido: "https://origem.example.test",
    });
    assert.equal(estrangeira.status, 403);
    assert.equal(estrangeira.headers.get("access-control-allow-origin"), null);

    for (const corpo of [
      {}, { objetivo: 42 }, { objetivo: "" }, { objetivo: "  a " }, { objetivo: "ab" },
      { objetivo: "x".repeat(LIMITES_GERACAO.objetivoMax + 1) },
    ]) {
      const resposta = await chamar(AO_VIVO, { metodo: "POST", corpo, cookie });
      assert.equal(resposta.status, 400, JSON.stringify(corpo).slice(0, 40));
      assert.match(resposta.headers.get("content-type"), /^application\/json/);
      assert.equal((await resposta.json()).codigo, "invalido");
    }
    const naoJson = await fetch(new URL(AO_VIVO, origem), {
      method: "POST", headers: { Origin: origem, Cookie: cookie, "Content-Type": "text/plain" }, body: "Frações",
    });
    assert.equal(naoJson.status, 400);
    assert.equal((await chamar(AO_VIVO, { cookie })).status, 405);

    const nosLimites = await Promise.all(["abc", "x".repeat(LIMITES_GERACAO.objetivoMax)].map(async (objetivo) => {
      const resposta = await chamar(AO_VIVO, { metodo: "POST", corpo: { objetivo }, cookie });
      assert.equal(resposta.status, 200);
      await resposta.body.cancel();
    }));
    assert.equal(nosLimites.length, 2);
    assert.equal(await planosNoBanco(contas[0].id), 0);
  });

  let frações;
  await t.test("objetivo livre gera a trilha em NDJSON válido, em sequência, sem tocar no banco", async () => {
    frações = await gerar(cookie, "Frações");
    const { eventos, brutas } = frações;
    assert.ok(brutas.every((linha) => !linha.includes("\n")));
    assert.deepEqual(eventos.map(({ tipo }) => tipo), [
      "plano", "fluxo", "licao", "licao", "licao", "fluxo", "licao", "licao", "licao", "fluxo", "licao", "licao", "licao", "pronto",
    ]);
    assert.equal(eventos[0].titulo, "Frações");
    const estrutura = estruturaDosEventos(eventos);
    assert.equal(estrutura.length, 3);
    assert.ok(estrutura.every(({ licoes }) => licoes.length === 3));
    const { proposta } = eventos.at(-1);
    assert.deepEqual(proposta.fluxos, estrutura.map(({ titulo, licoes }) => ({ titulo, licoes: licoes.map((l) => ({ titulo: l })) })));
    assert.equal(proposta.titulo, eventos[0].titulo);
    assert.equal(typeof proposta.token, "string");
    assert.ok(!JSON.stringify(proposta).includes(contas[0].id));

    assert.deepEqual(await listar(), []);
    assert.equal(await planosNoBanco(contas[0].id), 0);
  });

  await t.test("os eventos chegam aos poucos: o primeiro é lido antes de a resposta terminar", async () => {
    const resposta = await chamar(AO_VIVO, { metodo: "POST", corpo: { objetivo: "Inglês para entrevista" }, cookie });
    const leitor = linhas(resposta);
    const primeira = await leitor.next();
    assert.equal(interpretarEventoGeracao(primeira.value)?.tipo, "plano");
    assert.equal(primeira.done, false);
    await leitor.return();
  });

  await t.test("a mesma entrada gera a mesma trilha, com outro token", async () => {
    const outra = await gerar(cookie, "Frações");
    assert.deepEqual(estruturaDosEventos(outra.eventos), estruturaDosEventos(frações.eventos));
    assert.notEqual(outra.eventos.at(-1).proposta.token, frações.eventos.at(-1).proposta.token);
  });

  await t.test("cancelar no meio não cria plano e não deixa o servidor com a geração aberta", async () => {
    const controle = new AbortController();
    const resposta = await chamar(AO_VIVO, {
      metodo: "POST", corpo: { objetivo: "Cálculo diferencial" }, cookie, sinal: controle.signal,
    });
    const vistas = [];
    for await (const linha of linhas(resposta)) {
      vistas.push(interpretarEventoGeracao(linha).tipo);
      if (vistas.length === 3) {
        controle.abort();
        break;
      }
    }
    assert.deepEqual(vistas, ["plano", "fluxo", "licao"]);
    await new Promise((resolver) => setTimeout(resolver, 300));
    assert.deepEqual(await listar(), []);
    assert.equal(await planosNoBanco(contas[0].id), 0);
  });

  let plano;
  await t.test("aceitar cria o plano com os mesmos fluxos e lições mostrados, uma única vez", async () => {
    const { token } = frações.eventos.at(-1).proposta;
    assert.equal((await enviar("/planos", { token }, outroCookie)).status, 404, "token de outra pessoa");
    const [corpo, assinatura] = token.split(".");
    const adulterado = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(corpo, "base64url")), id: "outro" })).toString("base64url");
    assert.equal((await enviar("/planos", { token: `${adulterado}.${assinatura}` })).status, 404);
    assert.equal(await planosNoBanco(contas[0].id), 0);

    const aceites = await Promise.all(Array.from({ length: 4 }, () => enviar("/planos", { token })));
    assert.ok(aceites.every((aceite) => aceite.ok));
    const planos = await Promise.all(aceites.map((aceite) => aceite.json()));
    assert.equal(new Set(planos.map(({ id }) => id)).size, 1);
    plano = planos[0];

    const mostrado = estruturaDosEventos(frações.eventos);
    assert.equal(plano.titulo, "Frações");
    assert.deepEqual(
      plano.fluxos.map(({ titulo, licoes }) => ({ titulo, licoes: licoes.map((l) => l.titulo) })),
      mostrado,
    );
    assert.deepEqual(plano.progresso, { concluidas: 0, total: 9, percentual: 0 });
    assert.equal((await listar()).length, 1);
    assert.equal(await planosNoBanco(contas[0].id), 1);
    assert.equal((await chamar(`${prefixo}/planos/${plano.id}`, { cookie: outroCookie })).status, 404);
  });

  await t.test("as 9 lições da trilha genérica abrem, avaliam e concluem", async () => {
    assert.ok(plano);
    for (const fluxo of plano.fluxos) {
      for (const { id } of fluxo.licoes) {
        assert.equal((await chamar(`${prefixo}/licoes/${id}`, { cookie: outroCookie })).status, 404);
        const licao = await (await chamar(`${prefixo}/licoes/${id}`, { cookie })).json();
        assert.ok(licao.conceito && licao.exemplo && licao.exercicio.enunciado);
        assert.ok(!Object.keys(licao.exercicio).some((chave) => /gabarito|feedback/i.test(chave)));

        const { rows } = await banco.query(
          'SELECT "conteudo" FROM "Licao" WHERE "usuarioId" = $1 AND "id" = $2', [contas[0].id, id]);
        const certa = rows[0].conteudo.exercicio.gabarito[0];
        const errada = licao.exercicio.tipo === "multipla_escolha"
          ? licao.exercicio.opcoes.find((opcao) => opcao.id !== certa).id
          : "palpite";
        const erro = await (await enviar(`/licoes/${id}/avaliar`, { resposta: errada })).json();
        assert.equal(erro.correta, false);
        assert.ok(erro.feedback.length > 0);
        const acerto = await (await enviar(`/licoes/${id}/avaliar`, { resposta: certa })).json();
        assert.equal(acerto.correta, true);
        const conclusao = await enviar(`/licoes/${id}/concluir`, { comprovante: acerto.comprovante });
        assert.equal(conclusao.status, 200);
      }
    }
    const final = await (await chamar(`${prefixo}/planos/${plano.id}`, { cookie })).json();
    assert.deepEqual(final.progresso, { concluidas: 9, total: 9, percentual: 100 });
    assert.ok(final.fluxos.every((fluxo) => fluxo.proximaLicaoId === null));
  });

  await t.test("o percurso de SQL pela rota ao vivo continua com o plano de demonstração", async () => {
    const { eventos } = await gerar(cookie, "SQL para a prova");
    assert.deepEqual(estruturaDosEventos(eventos).map(({ titulo }) => titulo), ["Primeiros passos", "Praticando", "Desafio"]);
    const aceito = await (await enviar("/planos", { token: eventos.at(-1).proposta.token })).json();
    assert.deepEqual(aceito.progresso, { concluidas: 0, total: 5, percentual: 0 });
    const licaoId = aceito.fluxos[0].proximaLicaoId;
    const licao = await (await chamar(`${prefixo}/licoes/${licaoId}`, { cookie })).json();
    assert.equal(licao.exercicio.tipo, "lacuna");
    const correta = await (await enviar(`/licoes/${licaoId}/avaliar`, { resposta: ">=" })).json();
    assert.equal(correta.correta, true);
    assert.match(correta.feedback, /Bia e Caio/);
  });

  await t.test("a rota de proposta de uma vez também aceita objetivo livre", async () => {
    const resposta = await enviar("/propostas", { objetivo: "Fotossíntese" }, outroCookie);
    assert.equal(resposta.status, 200);
    const proposta = await resposta.json();
    assert.equal(proposta.fluxos.length, 3);
    const aceito = await enviar("/planos", { token: proposta.token }, outroCookie);
    assert.equal(aceito.status, 200);
    assert.equal((await aceito.json()).progresso.total, 9);
  });

  await t.test("o teto provisório de gerações responde 429 em JSON, só para quem passou dele", async () => {
    const limite = Number(process.env.STUDOO_LIMITE_GERACOES ?? 20);
    if (!Number.isInteger(limite) || limite > 100) {
      t.skip("teto alto demais para esgotar no teste");
      return;
    }
    for (let i = 0; i < limite; i++) {
      const resposta = await chamar(AO_VIVO, { metodo: "POST", corpo: { objetivo: `Assunto ${i}` }, cookie: cookieLimite });
      assert.equal(resposta.status, 200);
      await resposta.body.cancel();
    }
    const barrada = await chamar(AO_VIVO, { metodo: "POST", corpo: { objetivo: "Mais um" }, cookie: cookieLimite });
    assert.equal(barrada.status, 429);
    assert.match(barrada.headers.get("content-type"), /^application\/json/);
    assert.equal((await barrada.json()).codigo, "limite_geracoes");
    const outra = await chamar(AO_VIVO, { metodo: "POST", corpo: { objetivo: "Mais um" }, cookie: outroCookie });
    assert.equal(outra.status, 200);
    await outra.body.cancel();
  });
});
