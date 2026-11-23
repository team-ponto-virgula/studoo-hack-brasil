// O 500 do aceite (Lead, 23/11): o registro de um erro de servidor só trazia {correlationId, codigo, status, duracaoMs}, sem dizer a causa. Agora traz o nome do erro, o `code` curto (Prisma), o primeiro
// quadro da pilha e um motivo curto ("banco", "formato"…), e NADA de conteúdo (SEGURANCA.md §8): nem a mensagem do erro (a do Prisma carrega a chamada com os dados), nem as propriedades dele, nem o
// objetivo, a resposta da IA, o e-mail ou o token.
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://teste:teste@127.0.0.1:5432/teste";
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);
const { FalhaApi, rotaPublica } = await import("../src/servidor/acesso/http.ts");
const { descreverErroInterno } = await import("../src/servidor/acesso/erro-interno.ts");

const SEGREDOS = ["SEGREDO-OBJETIVO", "segredo@exemplo.com", "SEGREDO-TOKEN", "SEGREDO-META", "SEGREDO-RESPOSTA-DA-IA"];

/** A rota pública (sem sessão, sem banco) lançando o que `lancar` mandar: devolve a resposta e o que foi para o registro do servidor. */
async function rotaQueLanca(lancar) {
  const logs = [];
  const original = console.error;
  console.error = (mensagem) => logs.push(String(mensagem));
  try {
    const resposta = await rotaPublica(new Request("http://localhost/api/teste"), async () => { lancar(); return new Response("ok"); });
    return { resposta, corpo: await resposta.json(), logs };
  } finally {
    console.error = original;
  }
}
const semConteudo = (logs) => { for (const segredo of SEGREDOS) assert.ok(!logs.join("\n").includes(segredo), `o registro não pode trazer "${segredo}"`); };

test("500 por exceção de código: o registro diz o nome do erro e o quadro da pilha, e não a mensagem", async () => {
  const { resposta, corpo, logs } = await rotaQueLanca(() => { throw new TypeError(`Cannot read properties of undefined (reading 'opcoes') ${SEGREDOS[0]} ${SEGREDOS[1]} ${SEGREDOS[2]}`); });
  assert.equal(resposta.status, 500);
  assert.deepEqual(Object.keys(corpo).sort(), ["codigo", "mensagem"], "a resposta não ganha campo nenhum: só o registro do servidor sabe a causa");
  assert.equal(corpo.codigo, "falha");
  assert.equal(logs.length, 1);
  const registro = JSON.parse(logs[0]);
  assert.equal(registro.codigo, "falha");
  assert.equal(registro.status, 500);
  assert.equal(registro.nomeDoErro, "TypeError");
  assert.match(registro.quadro, /erro-500-registro\.test\.mjs:\d+:\d+/, "o primeiro quadro da pilha: o arquivo e a linha de onde saiu");
  assert.ok(typeof registro.correlationId === "string" && typeof registro.duracaoMs === "number", "o que já havia continua");
  assert.equal(resposta.headers.get("X-Correlation-Id"), registro.correlationId, "o cabeçalho da resposta casa com a linha do registro");
  semConteudo(logs);
  assert.ok(!("mensagem" in registro) && !("stack" in registro) && !("message" in registro), "nem mensagem nem pilha inteira");
});

test("500 do banco (Prisma): nome, code e motivo \"banco\"; a mensagem e o `meta` (com os dados da chamada) ficam de fora", async () => {
  const erroDoPrisma = Object.assign(new Error(`Invalid \`prisma.licao.createMany()\` invocation:\n{ data: [{ conteudo: "${SEGREDOS[4]}", objetivo: "${SEGREDOS[0]}", email: "${SEGREDOS[1]}" }] }`), {
    name: "PrismaClientKnownRequestError", code: "P2024", clientVersion: "7.0.0", meta: { corpo: SEGREDOS[3] },
  });
  const { resposta, logs } = await rotaQueLanca(() => { throw erroDoPrisma; });
  assert.equal(resposta.status, 500);
  const registro = JSON.parse(logs[0]);
  assert.equal(registro.nomeDoErro, "PrismaClientKnownRequestError");
  assert.equal(registro.codigoDoErro, "P2024");
  assert.equal(registro.motivo, "banco");
  semConteudo(logs);
});

test("503 da IA com motivo (FalhaApi): o motivo curto vai para o registro e não para a resposta", async () => {
  const { resposta, corpo, logs } = await rotaQueLanca(() => { throw new FalhaApi("ia_indisponivel", undefined, "formato"); });
  assert.equal(resposta.status, 503);
  assert.deepEqual(Object.keys(corpo).sort(), ["codigo", "mensagem"], "o motivo não vai na resposta");
  const registro = JSON.parse(logs[0]);
  assert.deepEqual({ codigo: registro.codigo, status: registro.status, nomeDoErro: registro.nomeDoErro, motivo: registro.motivo }, { codigo: "ia_indisponivel", status: 503, nomeDoErro: "FalhaApi", motivo: "formato" });
  assert.match(registro.quadro, /erro-500-registro\.test\.mjs:\d+:\d+/);
});

test("o que não é erro (texto, objeto) e o que vem malformado do erro (nome, code e motivo com conteúdo) não entram no registro", async () => {
  for (const lancado of [SEGREDOS[0], { message: SEGREDOS[4], email: SEGREDOS[1] }, null, undefined, 42]) {
    const { resposta, logs } = await rotaQueLanca(() => { throw lancado; });
    assert.equal(resposta.status, 500);
    const registro = JSON.parse(logs[0]);
    assert.ok(["NaoErro", "Objeto"].includes(registro.nomeDoErro), registro.nomeDoErro);
    assert.deepEqual(Object.keys(registro).sort(), ["codigo", "correlationId", "duracaoMs", "nomeDoErro", "status"], "só os campos de sempre e o nome genérico");
    semConteudo(logs);
  }
  const malformado = Object.assign(new Error(SEGREDOS[0]), { name: `${SEGREDOS[0]} com espaço`, code: SEGREDOS[1], motivo: `${SEGREDOS[2]} com espaço`, meta: { x: SEGREDOS[3] } });
  const { logs } = await rotaQueLanca(() => { throw malformado; });
  const registro = JSON.parse(logs[0]);
  assert.equal(registro.nomeDoErro, "Error", "nome fora do padrão vira o genérico");
  assert.equal(registro.codigoDoErro, undefined, "code fora do padrão sai");
  assert.equal(registro.motivo, undefined, "motivo fora do padrão sai");
  semConteudo(logs);
});

test("a pilha com conteúdo na mensagem (várias linhas) só contribui com o primeiro quadro, que é código", () => {
  const erro = new Error(`linha 1 ${SEGREDOS[0]}\nlinha 2 ${SEGREDOS[1]}\n    at fingido (${SEGREDOS[2]}.ts:1:1)`);
  const causa = descreverErroInterno(erro);
  assert.match(causa.quadro, /erro-500-registro\.test\.mjs:\d+:\d+/, "o quadro real da pilha, não o que a mensagem imitou");
  assert.ok(!JSON.stringify(causa).includes("SEGREDO"));
  // Sem pilha, sem quadro (e sem erro).
  const semPilha = Object.assign(new Error("x"), { stack: undefined });
  assert.deepEqual(descreverErroInterno(semPilha), { nomeDoErro: "Error" });
});

test("erro abaixo de 500 não vai para o registro do servidor (nada mudou ali)", async () => {
  const { resposta, logs } = await rotaQueLanca(() => { throw new FalhaApi("invalido"); });
  assert.equal(resposta.status, 400);
  assert.deepEqual(logs, []);
});
