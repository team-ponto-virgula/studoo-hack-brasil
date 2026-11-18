import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import { LIMITES_GERACAO, interpretarEventoGeracao } from "@studoo/contratos";
import pg from "pg";
import { respostaCerta, respostaErrada } from "../src/dominio/aprendizado/plano.ts";

const porta = process.env.STUDOO_TESTE_PORTA?.trim() || "3000";
const origem = process.env.STUDOO_TESTE_PORTA ? `http://localhost:${porta}` : process.env.STUDOO_ORIGEM || `http://localhost:${porta}`;
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
  assert.match(origem ?? "", /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/);
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

  // Assunto sem trilha pronta: cai na trilha genérica de 3 × 3 (Frações, violão etc. têm demo própria).
  let frações;
  await t.test("objetivo livre gera a trilha em NDJSON válido, em sequência, sem tocar no banco", async () => {
    frações = await gerar(cookie, "Astronomia para curiosos");
    const { eventos, brutas } = frações;
    assert.ok(brutas.every((linha) => !linha.includes("\n")));
    assert.deepEqual(eventos.map(({ tipo }) => tipo), [
      "plano", "fluxo", "licao", "licao", "licao", "fluxo", "licao", "licao", "licao", "fluxo", "licao", "licao", "licao", "pronto",
    ]);
    assert.equal(eventos[0].titulo, "Astronomia para curiosos");
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
    const outra = await gerar(cookie, "Astronomia para curiosos");
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
    assert.equal(plano.titulo, "Astronomia para curiosos");
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
        // Cada formato tem a sua resposta (escolha, ordem, pares, valor e justificativa, explicação…).
        const certa = respostaCerta(rows[0].conteudo.exercicio);
        const errada = respostaErrada(rows[0].conteudo.exercicio);
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

  await t.test("uma demo com assunto: exercício extra pelo índice, lacuna tolerante, recurso e prática guardada", async () => {
    const { eventos } = await gerar(cookie, "Quero aprender violão do zero");
    const aceito = await (await enviar("/planos", { token: eventos.at(-1).proposta.token })).json();
    assert.equal(aceito.titulo, "Violão do zero: primeiros acordes");
    const [primeira, segunda] = aceito.fluxos[0].licoes;
    const licao = await (await chamar(`${prefixo}/licoes/${primeira.id}`, { cookie })).json();
    assert.deepEqual(licao.exercicios.map(({ tipo }) => tipo), ["associar", "lacuna"]);
    assert.deepEqual(licao.exercicio, licao.exercicios[0], "o primeiro exercício segue em `exercicio` para clientes antigos");
    assert.ok(!JSON.stringify(licao).includes("gabarito"));
    // O exercício extra é avaliado pelo índice; a lacuna aceita um deslize de digitação, com aviso.
    const lacuna = await (await enviar(`/licoes/${primeira.id}/avaliar`, { resposta: "Taraxa", indice: 1 })).json();
    assert.equal(lacuna.correta, true);
    assert.match(lacuna.observacao, /tarraxa/);
    for (const invalido of [{ resposta: "x", indice: 5 }, { resposta: "x", indice: "1" }]) {
      assert.equal((await enviar(`/licoes/${primeira.id}/avaliar`, invalido)).status, 400);
    }
    // A lição seguinte traz o acorde e a prática; a conclusão guarda como foi a prática.
    const acorde = await (await chamar(`${prefixo}/licoes/${segunda.id}`, { cookie })).json();
    assert.equal(acorde.recurso.tipo, "acorde");
    assert.equal(acorde.exemploTipo, "demonstracao");
    assert.ok(acorde.pratica.minutos > 0);
    const { comprovante } = await (await enviar(`/licoes/${segunda.id}/avaliar`, { resposta: acorde.exercicio.opcoes[0].id })).json();
    assert.equal((await enviar(`/licoes/${segunda.id}/concluir`, { comprovante, pratica: "talvez" })).status, 400);
    const resumoInvalido = { segundos: 30, acertosDePrimeira: 3, exercicios: 2 };
    assert.equal((await enviar(`/licoes/${segunda.id}/concluir`, { comprovante, resumo: resumoInvalido })).status, 400, "acertos acima dos exercícios");
    const concluida = await enviar(`/licoes/${segunda.id}/concluir`, { comprovante, pratica: "ainda_nao", resumo: { segundos: 125, acertosDePrimeira: 0, exercicios: 2 } });
    assert.equal(concluida.status, 200);
    // O plano soma o resumo das lições concluídas (aqui, só esta trouxe o resumo).
    const { plano: planoDepois } = await concluida.json();
    assert.deepEqual(planoDepois.estatisticas, { segundos: 125, acertosDePrimeira: 0, exercicios: 2 });
    // Os dois exercícios errados antes do acerto e a prática em "ainda não": o mapa marca a lição para rever, com o motivo;
    // a que não foi concluída não ganha a marca.
    const licoesDoPlano = planoDepois.fluxos[0].licoes;
    assert.equal(licoesDoPlano.find(({ id }) => id === segunda.id).rever, "erros_e_pratica");
    assert.equal(licoesDoPlano.find(({ id }) => id === primeira.id).rever, undefined);
    const { rows } = await banco.query(
      'SELECT "pratica", "segundos", "acertosDePrimeira", "exercicios" FROM "RegistroEstudo" WHERE "usuarioId" = $1 AND "licaoId" = $2', [contas[0].id, segunda.id]);
    assert.deepEqual(rows[0], { pratica: "ainda_nao", segundos: 125, acertosDePrimeira: 0, exercicios: 2 });
    // Refez a lição sem erro e a prática saiu: fica a vez mais recente, e o mapa deixa de marcar a lição.
    const nova = await (await enviar(`/licoes/${segunda.id}/avaliar`, { resposta: acorde.exercicio.opcoes[0].id })).json();
    const refeita = await (await enviar(`/licoes/${segunda.id}/concluir`, {
      comprovante: nova.comprovante, pratica: "consegui", resumo: { segundos: 90, acertosDePrimeira: 2, exercicios: 2 },
    })).json();
    assert.equal(refeita.plano.fluxos[0].licoes.find(({ id }) => id === segunda.id).rever, undefined);
    assert.deepEqual(refeita.plano.estatisticas, { segundos: 90, acertosDePrimeira: 2, exercicios: 2 });
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

  await t.test("apagar a trilha: só a dona, com a origem do Studoo, e as lições e o progresso vão junto", async () => {
    const [plano] = await listar(outroCookie);
    assert.ok(plano, "a trilha da rota de uma vez");
    const caminho = `${prefixo}/planos/${plano.id}`;
    assert.equal((await chamar(caminho, { metodo: "DELETE", cookie: outroCookie, origemPedido: "https://outro.example" })).status, 403);
    assert.equal((await chamar(caminho, { metodo: "DELETE", cookie })).status, 404, "trilha de outra pessoa");
    // Uma lição concluída antes, para conferir que o progresso também sai.
    const detalhe = await (await chamar(caminho, { cookie: outroCookie })).json();
    const { id: licaoId } = detalhe.fluxos[0].licoes[0];
    const { rows } = await banco.query('SELECT "conteudo" FROM "Licao" WHERE "usuarioId" = $1 AND "id" = $2', [contas[1].id, licaoId]);
    const acerto = await (await enviar(`/licoes/${licaoId}/avaliar`, { resposta: respostaCerta(rows[0].conteudo.exercicio) }, outroCookie)).json();
    assert.equal((await enviar(`/licoes/${licaoId}/concluir`, { comprovante: acerto.comprovante }, outroCookie)).status, 200);

    const apagada = await chamar(caminho, { metodo: "DELETE", cookie: outroCookie });
    assert.equal(apagada.status, 200);
    assert.deepEqual(await apagada.json(), { apagado: true });
    assert.equal((await chamar(caminho, { cookie: outroCookie })).status, 404);
    assert.ok(!(await listar(outroCookie)).some(({ id }) => id === plano.id));
    const restos = await banco.query(
      `SELECT (SELECT count(*) FROM "Fluxo" WHERE "usuarioId" = $1 AND "planoId" = $2) AS fluxos,
              (SELECT count(*) FROM "Licao" WHERE "usuarioId" = $1 AND "id" = $3) AS licoes,
              (SELECT count(*) FROM "RegistroEstudo" WHERE "usuarioId" = $1 AND "licaoId" = $3) AS registros`,
      [contas[1].id, plano.id, licaoId]);
    assert.deepEqual(restos.rows[0], { fluxos: "0", licoes: "0", registros: "0" });
    assert.equal((await chamar(caminho, { metodo: "DELETE", cookie: outroCookie })).status, 404, "apagar de novo");
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
