import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";
import pg from "pg";

const origem = process.env.STUDOO_ORIGEM;
const prefixo = "/api/aprendizado";
const objetivo = "Já sei usar SELECT e quero praticar filtros e junções para uma prova de SQL.";

function chamar(caminho, { metodo = "GET", corpo, cookie, origemPedido = origem } = {}) {
  const headers = { Origin: origemPedido };
  if (cookie) headers.Cookie = cookie;
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  return fetch(new URL(caminho, origem), {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

async function login(email) {
  const resposta = await chamar("/api/login", {
    metodo: "POST",
    corpo: { email, senha: process.env.STUDOO_SENHA },
  });
  assert.equal(resposta.status, 200);
  const cabecalho = resposta.headers.get("set-cookie") ?? "";
  assert.ok(cabecalho.includes("; HttpOnly; SameSite=Lax; Max-Age=28800"));
  assert.deepEqual(await resposta.json(), { autenticado: true });
  return cabecalho.split(";")[0];
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

test("primeiro marco via HTTP com contas sintéticas", async (t) => {
  const conexao = new URL(process.env.DATABASE_URL ?? "invalid:");
  assert.equal(conexao.hostname, "127.0.0.1");
  assert.equal(conexao.pathname, "/studoo_local");
  assert.equal(origem, "http://localhost:3000");
  assert.equal(process.env.IA, "falsa");
  assert.equal(process.env.EMAIL, "falso");

  const banco = new pg.Client({ connectionString: conexao.href });
  const contas = Array.from({ length: 2 }, () => {
    const id = randomUUID();
    return { id, email: `teste-${id}@example.test` };
  });
  const emailInexistente = `teste-${randomUUID()}@example.test`;
  const emailExterno = `teste-${randomUUID()}@fora.test`;
  await banco.connect();
  t.after(async () => {
    try {
      await removerContas(banco, contas.map(({ id }) => id));
      const chaveAssinatura = Buffer.from(process.env.STUDOO_CHAVE_ASSINATURA, "hex");
      const chavesLogin = [...contas.map(({ email }) => email), emailInexistente, emailExterno].map((email) =>
        createHmac("sha256", chaveAssinatura).update(`login\0loopback\0${email}`).digest("hex"),
      );
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

  await t.test("sessão obrigatória, saúde mínima e origem estrangeira recusada", async () => {
    const semSessao = await chamar(`${prefixo}/planos`);
    assert.equal(semSessao.status, 401);
    assert.equal(semSessao.headers.get("cache-control"), "no-store");
    const saude = await chamar("/api/saude");
    assert.deepEqual(await saude.json(), { ok: true, status: "ok" });
    const estrangeira = await chamar("/api/login", {
      metodo: "POST", corpo: {}, origemPedido: "https://origem.example.test",
    });
    assert.equal(estrangeira.status, 403);
    assert.equal(estrangeira.headers.get("access-control-allow-origin"), null);
    const curinga = await chamar("/api/login", { metodo: "POST", corpo: {}, origemPedido: "*" });
    assert.equal(curinga.status, 403);
  });

  await t.test("login rejeita corpo inválido, domínio externo e senha errada com a mesma mensagem", async () => {
    const mensagem = "E-mail ou senha inválidos.";
    for (const corpo of [
      { email: contas[1].email, senha: 42 },
      { email: contas[1].email, senha: "senha-errada" },
      { email: emailExterno, senha: "senha-errada" },
    ]) {
      const resposta = await chamar("/api/login", { metodo: "POST", corpo });
      assert.equal(resposta.status, 401);
      assert.equal((await resposta.json()).mensagem, mensagem);
    }
    for (let tentativa = 1; tentativa <= 6; tentativa++) {
      const resposta = await chamar("/api/login", { metodo: "POST", corpo: { email: emailInexistente, senha: "senha-errada" } });
      assert.equal(resposta.status, tentativa === 6 ? 429 : 401);
      assert.equal((await resposta.json()).mensagem, mensagem);
    }
  });

  const cookie = await login(contas[0].email);
  const outroCookie = await login(contas[1].email);
  const listar = () => chamar(`${prefixo}/planos`, { cookie });
  const enviar = (caminho, corpo, sessao = cookie) => chamar(`${prefixo}${caminho}`, {
    metodo: "POST", corpo, cookie: sessao,
  });

  let plano;
  await t.test("prévia de SQL privada, objetivo livre e aceite atômico com reenvio", async () => {
    const vago = await enviar("/propostas", { objetivo: "Tenho uma prova amanhã." });
    assert.equal(vago.status, 200);
    assert.equal((await vago.json()).fluxos.length, 3);
    assert.equal((await enviar("/propostas", { objetivo: "ab" })).status, 400);
    const resposta = await enviar("/propostas", { objetivo });
    assert.equal(resposta.status, 200);
    const proposta = await resposta.json();
    assert.deepEqual(proposta.fluxos.map(({ titulo }) => titulo), ["Consultas", "Junções"]);
    assert.deepEqual(await (await listar()).json(), []);

    assert.equal((await enviar("/planos", { token: proposta.token }, outroCookie)).status, 404);
    const aceites = await Promise.all(Array.from({ length: 4 }, () => enviar("/planos", { token: proposta.token })));
    assert.ok(aceites.every((aceite) => aceite.ok));
    const planos = await Promise.all(aceites.map((aceite) => aceite.json()));
    assert.equal(new Set(planos.map(({ id }) => id)).size, 1);
    plano = planos[0];
    assert.deepEqual(plano.progresso, { concluidas: 0, total: 4, percentual: 0 });
    assert.equal((await (await listar()).json()).length, 1);
    assert.equal((await chamar(`${prefixo}/planos/${plano.id}`, { cookie: outroCookie })).status, 404);
  });

  await t.test("feedback, conclusão idempotente e retomada pela próxima lição", async () => {
    assert.ok(plano);
    const consultas = plano.fluxos[0];
    const licaoId = consultas.proximaLicaoId;
    assert.ok(licaoId);
    const caminho = `/licoes/${licaoId}`;
    assert.equal((await chamar(`${prefixo}${caminho}`, { cookie: outroCookie })).status, 404);
    const licao = await (await chamar(`${prefixo}${caminho}`, { cookie })).json();
    assert.equal(licao.exercicio.tipo, "lacuna");
    assert.ok(!Object.keys(licao.exercicio).some((chave) => /gabarito|respostas|feedback/i.test(chave)));
    assert.equal((await enviar(`${caminho}/avaliar`, { resposta: " " })).status, 400);
    assert.equal((await enviar(`${caminho}/concluir`, { comprovante: "forjado" })).status, 400);

    const correta = await (await enviar(`${caminho}/avaliar`, { resposta: ">=" })).json();
    assert.equal(correta.correta, true);
    assert.match(correta.feedback, /Bia e Caio/);
    const incorreta = await (await enviar(`${caminho}/avaliar`, { resposta: ">" })).json();
    assert.equal(incorreta.correta, false);
    assert.match(incorreta.feedback, /Bia/);
    assert.equal((await (await listar()).json())[0].progresso.concluidas, 0);

    const conclusoes = await Promise.all(Array.from({ length: 4 }, () => enviar(`${caminho}/concluir`, {
      comprovante: incorreta.comprovante,
    })));
    assert.ok(conclusoes.every((conclusao) => conclusao.ok));
    const registros = await Promise.all(conclusoes.map((conclusao) => conclusao.json()));
    assert.equal(new Set(registros.map(({ concluidaEm }) => concluidaEm)).size, 1);
    const atualizado = await (await chamar(`${prefixo}/planos/${plano.id}`, { cookie })).json();
    assert.deepEqual(atualizado.progresso, { concluidas: 1, total: 4, percentual: 25 });
    assert.equal(atualizado.fluxos[0].progresso.percentual, 50);
    assert.equal(atualizado.fluxos[0].proximaLicaoId, consultas.licoes[1].id);
  });

  await t.test("logout revoga o cookie e novo login preserva o progresso", async () => {
    assert.equal((await chamar("/api/sessao", { metodo: "DELETE", cookie })).status, 204);
    assert.equal((await listar()).status, 401);
    const novaSessao = await login(contas[0].email);
    const ativos = await (await chamar(`${prefixo}/planos`, { cookie: novaSessao })).json();
    assert.equal(ativos[0].progresso.concluidas, 1);
  });
});
