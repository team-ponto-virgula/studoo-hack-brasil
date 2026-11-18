// Percurso automático do site (scripts/verificar-publicado.mjs): a resposta errada de cada tipo de exercício, o limite
// de tempo por pedido e, com o servidor local ligado (etapa "Percursos HTTP" da verificação), o percurso inteiro com
// cada tipo de exercício forçado como o primeiro da lição.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { after, test } from "node:test";
import { candidatasErradas, verificar } from "../scripts/verificar-publicado.mjs";
import { apresentarExercicio, avaliarResposta, respostaCerta } from "../src/dominio/aprendizado/plano.ts";
import { DEMOS } from "../src/servidor/ia/demos.ts";

const TIPOS = ["multipla_escolha", "lacuna", "ordenar", "associar", "verdadeiro_falso", "aberta"];
const exerciciosDasDemos = DEMOS.flatMap((demo) => demo.plano.fluxos.flatMap((fluxo) =>
  fluxo.licoes.flatMap((licao) => [licao.exercicio, ...(licao.extras ?? [])].filter(Boolean))));
const umDoTipo = (tipo) => exerciciosDasDemos.find((e) => e.tipo === tipo);

/** O que o percurso faz com um exercício: tenta as candidatas até o servidor dizer que errou. */
function errar(interno, publico = apresentarExercicio(interno)) {
  for (const [tentativa, resposta] of candidatasErradas(publico).entries()) {
    const resultado = avaliarResposta(interno, resposta);
    if (resultado && !resultado.correta) return { resposta, tentativa: tentativa + 1 };
  }
  return null;
}

test("todos os tipos aparecem nas demos e cada exercício de demo tem uma resposta errada válida", () => {
  for (const tipo of TIPOS) assert.ok(umDoTipo(tipo), `há exercício ${tipo} nas demos`);
  for (const exercicio of exerciciosDasDemos) {
    assert.ok(TIPOS.includes(exercicio.tipo), `tipo conhecido: ${exercicio.tipo}`);
    const erro = errar(exercicio);
    assert.ok(erro, `${exercicio.tipo} "${exercicio.enunciado}" tem resposta errada válida`);
    assert.notEqual(erro.resposta, respostaCerta(exercicio));
  }
});

test("quando a primeira candidata acerta (ordem, pares ou valor mostrados certos), a segunda erra", () => {
  const ordenar = umDoTipo("ordenar");
  const ordemCerta = { ...apresentarExercicio(ordenar), itens: ordenar.gabarito.map((id) => ordenar.itens.find((i) => i.id === id)) };
  assert.equal(avaliarResposta(ordenar, candidatasErradas(ordemCerta)[0]).correta, true);
  assert.deepEqual(errar(ordenar, ordemCerta)?.tentativa, 2);

  const associar = umDoTipo("associar");
  const pares = new Map(associar.gabarito.map((par) => par.replace(/\s+/g, "").split("=")));
  const paresCertos = { ...apresentarExercicio(associar), direita: associar.esquerda.map((e) => associar.direita.find((d) => d.id === pares.get(e.id))) };
  assert.equal(avaliarResposta(associar, candidatasErradas(paresCertos)[0]).correta, true);
  assert.deepEqual(errar(associar, paresCertos)?.tentativa, 2);

  for (const valor of ["verdadeiro", "falso"]) {
    const vf = umDoTipo("verdadeiro_falso");
    const primeira = vf.justificativas[0].id;
    const forcado = { ...vf, gabarito: [valor, primeira] };
    assert.equal(errar(forcado)?.tentativa, valor === "verdadeiro" ? 2 : 1);
  }

  const multipla = umDoTipo("multipla_escolha");
  const primeiraCerta = { ...multipla, gabarito: [multipla.opcoes[0].id] };
  assert.deepEqual(errar(primeiraCerta)?.tentativa, 2);
});

test("tipo sem resposta errada possível ou desconhecido não tem candidatas (o percurso passa ao exercício seguinte)", () => {
  assert.deepEqual(candidatasErradas({ tipo: "ordenar", itens: [{ id: "a", texto: "A" }] }), []);
  assert.deepEqual(candidatasErradas({ tipo: "tipo_novo" }), []);
  assert.deepEqual(candidatasErradas(undefined), []);
  const aberta = candidatasErradas({ tipo: "aberta", minimo: 120 });
  for (const texto of aberta) {
    assert.ok(texto.replace(/\s+/gu, "").length >= 120 && texto.length <= 1000, "aberta respeita o mínimo e o teto");
  }
});

test("aceite que estoura o limite: a etapa diz o tempo, a saída falha e a trilha que aparecer depois é apagada", async () => {
  const apagadas = [];
  let aceitou = false;
  const servidor = createServer((req, res) => {
    const json = (status, corpo, extra = {}) => { res.writeHead(status, { "content-type": "application/json", ...extra }); res.end(JSON.stringify(corpo)); };
    if (req.url === "/api/login") return json(200, { autenticado: true }, { "set-cookie": "studoo-sessao=abc; Path=/; HttpOnly" });
    if (req.url === "/api/aprendizado/propostas") return json(200, { token: "t" });
    if (req.url === "/api/aprendizado/planos" && req.method === "POST") { setTimeout(() => { aceitou = true; }, 250); return; }
    if (req.url === "/api/aprendizado/planos") return json(200, aceitou ? [{ id: "antigo" }, { id: "novo" }] : [{ id: "antigo" }]);
    if (req.method === "DELETE") { apagadas.push(req.url); return json(200, { apagado: true }); }
    json(404, {});
  });
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  try {
    const linhas = [];
    const resultado = await verificar({
      base: `http://127.0.0.1:${servidor.address().port}`, email: "x@example.test", senha: "x",
      limites: { aceite: 200, padrao: 2000 }, esperaLimpezaMs: 2000, intervaloLimpezaMs: 100, escrever: (l) => linhas.push(l),
    });
    assert.equal(resultado.falhou, true);
    assert.deepEqual(linhas, [
      "login: HTTP 200 ok",
      "proposta: HTTP 200 ok",
      "criar_trilha: HTTP 0 falhou (tempo esgotado: 0.2 s)",
      "apagar_trilha: HTTP 200 ok (trilha do aceite que estourou o limite)",
    ]);
    assert.deepEqual(apagadas, ["/api/aprendizado/planos/novo"]);
  } finally {
    servidor.closeAllConnections();
    servidor.close();
  }
});

// --- Percurso inteiro contra o servidor local (IA simulada), com cada tipo forçado como primeiro exercício. ---
const porta = process.env.STUDOO_TESTE_PORTA?.trim() || "3000";
const base = process.env.STUDOO_TESTE_PORTA ? `http://localhost:${porta}` : process.env.STUDOO_ORIGEM || `http://localhost:${porta}`;
const servidorLigado = await fetch(`${base}/api/saude`).then((r) => r.ok).catch(() => false);
const { banco } = await import("../src/servidor/banco/cliente.ts");
const { criarHashSenha } = await import("../src/servidor/acesso/credenciais.ts");
const { assinatura } = await import("../src/servidor/acesso/seguranca.ts");
let conta = null;
after(async () => {
  if (conta) {
    const usuarioId = conta.id;
    await banco.apoioLicao.deleteMany({ where: { usuarioId } });
    await banco.registroEstudo.deleteMany({ where: { usuarioId } });
    await banco.licao.deleteMany({ where: { usuarioId } });
    await banco.fluxo.deleteMany({ where: { usuarioId } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId } });
    await banco.sessao.deleteMany({ where: { usuarioId } });
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: [`ia:geracao:${usuarioId}`, `estudio:ponte:${usuarioId}`].map(assinatura) } } });
    await banco.usuario.delete({ where: { id: usuarioId } });
  }
  await banco.$disconnect();
});

async function percursoCom(exercicio, extras = []) {
  if (!conta) {
    const senha = randomBytes(18).toString("base64url");
    const email = `verificar-${randomUUID()}@${process.env.STUDOO_DOMINIO_EMAIL || "example.test"}`;
    conta = { ...(await banco.usuario.create({ data: { email, senhaHash: await criarHashSenha(senha), fuso: "UTC" } })), senha };
  }
  let planoCriado = "";
  const linhas = [];
  const resultado = await verificar({
    base, origem: base, email: conta.email, senha: conta.senha, escrever: (l) => linhas.push(l),
    aposCriarTrilha: async ({ planoId, licaoId }) => {
      planoCriado = planoId;
      const licao = await banco.licao.findFirst({ where: { id: licaoId, usuarioId: conta.id } });
      await banco.licao.update({
        where: { usuarioId_id: { usuarioId: conta.id, id: licaoId } },
        data: { conteudo: { ...licao.conteudo, exercicio, extras } },
      });
    },
  });
  const sobrou = await banco.planoAprendizado.findFirst({ where: { id: planoCriado, usuarioId: conta.id } });
  return { ...resultado, linhas, sobrou };
}

/** Exercício válido em que todas as candidatas do percurso estão certas (o gabarito aceita as duas). */
function lacunaQueAceitaTudo() {
  const lacuna = umDoTipo("lacuna");
  return { ...lacuna, gabarito: [...lacuna.gabarito, ...candidatasErradas({ tipo: "lacuna" })] };
}

for (const tipo of TIPOS) {
  test(`percurso local: ${tipo} como primeiro exercício passa em todas as etapas e apaga a trilha`, { skip: !servidorLigado && "servidor local desligado" }, async () => {
    const { falhou, linhas, sobrou } = await percursoCom(umDoTipo(tipo));
    assert.equal(falhou, false, linhas.join("\n"));
    assert.equal(linhas.length, 7);
    assert.match(linhas[3], new RegExp(`^errar_exercicio: HTTP 200 ok \\(exercício 1, ${tipo}, [12] tentativa`));
    assert.equal(sobrou, null, "trilha apagada");
  });
}

test("percurso local: sem como errar o primeiro exercício, erra o segundo", { skip: !servidorLigado && "servidor local desligado" }, async () => {
  const { falhou, linhas, sobrou } = await percursoCom(lacunaQueAceitaTudo(), [umDoTipo("verdadeiro_falso")]);
  assert.equal(falhou, false, linhas.join("\n"));
  assert.match(linhas[3], /^errar_exercicio: HTTP 200 ok \(exercício 2, verdadeiro_falso, [12] tentativa/);
  assert.equal(sobrou, null);
});

test("percurso local: lição sem exercício que dê para errar falha a etapa e ainda apaga a trilha", { skip: !servidorLigado && "servidor local desligado" }, async () => {
  const { falhou, linhas, sobrou } = await percursoCom(lacunaQueAceitaTudo());
  assert.equal(falhou, true);
  assert.match(linhas.at(-2), /^errar_exercicio: HTTP 200 falhou \(nenhum exercício deu para errar \(lacuna\)\)$/);
  assert.equal(linhas.at(-1), "apagar_trilha: HTTP 200 ok");
  assert.equal(sobrou, null);
});
