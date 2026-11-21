import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { CABECALHO_CAPACIDADES, interpretarEventoGeracao } from "@studoo/contratos";
import { respostaCerta, respostaErrada } from "../src/dominio/aprendizado/plano.ts";
import { DEMOS } from "../src/servidor/ia/demos.ts";

/*
 * Matemática de ponta a ponta contra o servidor local (IA simulada, banco real), pela porta de cada cliente (spec 15, marco 5):
 * - sem `X-Studoo-Capacidades` (build 3, site antigo): sem visuais nem resolução, o exemplo em passos, o texto das fórmulas em texto
 *   linear e o desenho PNG no lugar da foto;
 * - com `visuais@1`: os visuais e a figura do exercício, sem a posição do procurado, e o exemplo ainda em passos;
 * - com `visuais@1,resolucao@1`: o "Resolva comigo" só até o "Sua vez";
 * e o retorno de quem acerta (`Avaliacao.visual`, com o `alt` montado dos dados) e a escolha do "Sua vez".
 * Sem servidor ligado (a etapa "Percursos HTTP" da verificação o liga), o teste é pulado, como o percurso do site publicado.
 */

const porta = process.env.STUDOO_TESTE_PORTA?.trim() || "3000";
const origem = process.env.STUDOO_TESTE_PORTA ? `http://localhost:${porta}` : process.env.STUDOO_ORIGEM || `http://localhost:${porta}`;
const servidorLigado = await fetch(`${origem}/api/saude`).then((resposta) => resposta.ok).catch(() => false);
const { banco } = await import("../src/servidor/banco/cliente.ts");
const { criarHashSenha } = await import("../src/servidor/acesso/credenciais.ts");
const { assinatura } = await import("../src/servidor/acesso/seguranca.ts");

const prefixo = "/api/aprendizado";
const OBJETIVO = "Geometria analítica: do ponto ao alinhamento";
const SEM = undefined;
const SO_VISUAIS = "visuais@1";
const TUDO = "visuais@1,resolucao@1";

const geometria = DEMOS.find(({ chave }) => chave === "geometria");
const licoesDaDemo = geometria.plano.fluxos.flatMap(({ licoes }) => licoes);

let conta = null;
let planoId = null;
after(async () => {
  if (conta) {
    const usuarioId = conta.id;
    await banco.apoioLicao.deleteMany({ where: { usuarioId } });
    await banco.registroEstudo.deleteMany({ where: { usuarioId } });
    await banco.licao.deleteMany({ where: { usuarioId } });
    await banco.fluxo.deleteMany({ where: { usuarioId } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId } });
    await banco.sessao.deleteMany({ where: { usuarioId } });
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: [`ia:geracao:${usuarioId}`, `login\0loopback\0${conta.email}`].map(assinatura) } } });
    await banco.usuario.delete({ where: { id: usuarioId } });
  }
  await banco.$disconnect();
});

function chamar(caminho, { metodo = "GET", corpo, cookie, capacidades } = {}) {
  const headers = { Origin: origem };
  if (cookie) headers.Cookie = cookie;
  if (capacidades) headers[CABECALHO_CAPACIDADES] = capacidades;
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  return fetch(new URL(caminho, origem), { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
}

async function entrar() {
  const senha = randomBytes(18).toString("base64url");
  const email = `matematica-${randomUUID()}@${process.env.STUDOO_DOMINIO_EMAIL || "example.test"}`;
  conta = { ...(await banco.usuario.create({ data: { email, senhaHash: await criarHashSenha(senha), fuso: "UTC" } })), senha };
  const resposta = await chamar("/api/login", { metodo: "POST", corpo: { email, senha } });
  assert.equal(resposta.status, 200);
  return (resposta.headers.get("set-cookie") ?? "").split(";")[0];
}

async function trilha(cookie) {
  const resposta = await chamar(`${prefixo}/propostas/ao-vivo`, { metodo: "POST", corpo: { objetivo: OBJETIVO }, cookie });
  assert.equal(resposta.status, 200);
  const eventos = (await resposta.text()).split("\n").filter(Boolean).map((linha) => {
    const evento = interpretarEventoGeracao(linha);
    assert.ok(evento, `linha fora do contrato: ${linha.slice(0, 80)}`);
    return evento;
  });
  const { proposta } = eventos.at(-1);
  assert.ok(proposta, "a proposta pronta fecha o fluxo");
  const aceite = await chamar(`${prefixo}/planos`, { metodo: "POST", corpo: { token: proposta.token }, cookie });
  assert.equal(aceite.status, 200);
  return { proposta, plano: await aceite.json() };
}

const lerLicao = async (cookie, id, capacidades) => {
  const resposta = await chamar(`${prefixo}/licoes/${id}`, { cookie, capacidades });
  assert.equal(resposta.status, 200);
  return resposta.json();
};

const textos = (licao) => [licao.objetivo, licao.conceito, licao.exemplo, licao.exercicio.enunciado, ...licao.exercicios.flatMap((e) => [e.enunciado, ...(e.opcoes ?? []).map((o) => o.texto), e.afirmacao ?? ""])];
const pontosEscondidos = (visual) => visual?.pontos?.filter((ponto) => ponto.papel === "procurado" || ponto.papel === "resposta") ?? [];

test("geometria analítica pela IA simulada, de ponta a ponta: a porta de cada cliente, o retorno e o Sua vez", { skip: !servidorLigado && "servidor local desligado" }, async (t) => {
  assert.equal(process.env.IA, "falsa");
  const cookie = await entrar();
  const { proposta, plano } = await trilha(cookie);
  assert.match(proposta.origem, /trilha pronta sobre geometria analítica/);
  planoId = plano.id;
  const ids = plano.fluxos.flatMap((fluxo) => fluxo.licoes.map((licao) => licao.id));
  assert.equal(ids.length, 6);
  assert.deepEqual(plano.fluxos.map((fluxo) => fluxo.licoes.length), [2, 2, 2]);

  await t.test("sem cabeçalho (build 3, site antigo): sem visuais nem resolução, o texto das fórmulas em texto linear, o desenho no lugar da foto", async () => {
    for (const [i, id] of ids.entries()) {
      const demo = licoesDaDemo[i];
      const licao = await lerLicao(cookie, id, SEM);
      for (const campo of ["visuais", "resolucao"]) assert.equal(campo in licao, false, `${demo.titulo}: ${campo}`);
      for (const exercicio of licao.exercicios) assert.equal("visual" in exercicio, false, `${demo.titulo}: figura do exercício`);
      const json = JSON.stringify(licao);
      assert.equal(/[$]/.test(textos(licao).join(" ")), false, `${demo.titulo}: nenhum cifrão na tela`);
      assert.equal(textos(licao).join(" ").includes("\\"), false, `${demo.titulo}: nenhum LaTeX cru`);
      // O desenho (PNG) entra no lugar da foto da lição, e a foto nunca foi guardada aqui.
      assert.equal(licao.recurso?.tipo, "imagem", `${demo.titulo}: o desenho no lugar da foto`);
      assert.match(licao.recurso.src, /^data:image\/png;base64,/);
      assert.ok(json.length > 2000);
      // O exemplo resolvido vira passos em texto (sem "Sua vez" e com a resposta), cada linha com no máximo 300 caracteres.
      if (demo.resolucao) {
        assert.equal(licao.passos.length, demo.resolucao.passos.length, `${demo.titulo}: o Resolva comigo em passos`);
        assert.ok(licao.passos.every((passo) => passo.length <= 300 && !/[\\{}$]/.test(passo)), `${demo.titulo}: linhas curtas, sem LaTeX`);
      }
    }
  });

  await t.test("com visuais@1: os visuais e a figura do exercício sem a posição do procurado; o exemplo segue em passos", async () => {
    for (const [i, id] of ids.entries()) {
      const demo = licoesDaDemo[i];
      const licao = await lerLicao(cookie, id, SO_VISUAIS);
      assert.deepEqual(licao.visuais.map((visual) => visual.tipo), demo.visuais.map((visual) => visual.tipo), demo.titulo);
      assert.equal("resolucao" in licao, false, `${demo.titulo}: sem resolucao@1 não vai o Resolva comigo`);
      assert.equal("recurso" in licao, false, `${demo.titulo}: sem foto, o desenho não substitui nada`);
      if (demo.resolucao) assert.equal(licao.passos.length, demo.resolucao.passos.length);
      // As marcas das fórmulas ficam para quem desenha.
      assert.ok(textos(licao).join(" ").includes("$") || !demo.conceito.includes("$"), `${demo.titulo}: fórmulas marcadas`);
      if (demo.exercicio.visual) {
        assert.ok(licao.exercicio.visual, `${demo.titulo}: figura do exercício`);
        const escondidos = pontosEscondidos(licao.exercicio.visual);
        assert.ok(escondidos.length >= 1, `${demo.titulo}: o procurado está na figura`);
        for (const ponto of escondidos) assert.deepEqual(Object.keys(ponto).sort(), ["id", "papel"], `${demo.titulo}: ${ponto.id} sem posição`);
        assert.equal(JSON.stringify(licao.exercicio.visual).includes("derivado"), false, `${demo.titulo}: nem a conta dos derivados`);
      }
    }
  });

  await t.test("com visuais@1 e resolucao@1: o Resolva comigo vai só até o Sua vez, sem a resposta dele nem o gabarito", async () => {
    for (const [i, id] of ids.entries()) {
      const demo = licoesDaDemo[i];
      const licao = await lerLicao(cookie, id, TUDO);
      if (!demo.resolucao) {
        assert.equal("resolucao" in licao, false, demo.titulo);
        continue;
      }
      const corteDaDemo = demo.resolucao.passos.findIndex((passo) => passo.tentativa);
      assert.equal(licao.resolucao.total, demo.resolucao.passos.length);
      assert.equal(licao.resolucao.passos.length, corteDaDemo + 1, `${demo.titulo}: nenhum passo depois do Sua vez`);
      const ultimo = licao.resolucao.passos.at(-1);
      assert.ok(ultimo.tentativa.pergunta && ultimo.tentativa.opcoes.length === 3);
      assert.equal("formula" in ultimo, false, `${demo.titulo}: a fórmula do Sua vez é a revelação`);
      const json = JSON.stringify(licao.resolucao);
      assert.equal(json.includes("correta"), false, `${demo.titulo}: sem o gabarito`);
      assert.equal(json.includes("porque"), false, `${demo.titulo}: sem o porquê das opções`);
      assert.equal("passos" in licao, false, `${demo.titulo}: o exemplo desenhado dispensa o exemplo em passos`);
      for (const visual of [licao.resolucao.visual, ...licao.resolucao.passos.map((passo) => passo.visual)]) {
        for (const ponto of pontosEscondidos(visual)) assert.deepEqual(Object.keys(ponto).sort(), ["id", "papel"], `${demo.titulo}: ${ponto.id}`);
      }
    }
  });

  await t.test("o retorno de quem acerta leva a figura revelada, com o alt montado dos dados, só com visuais@1", async () => {
    const baricentro = licoesDaDemo.findIndex(({ titulo }) => titulo.startsWith("Baricentro:"));
    const id = ids[baricentro];
    const exercicio = licoesDaDemo[baricentro].exercicio;
    assert.ok(exercicio.visual);
    const avaliar = (resposta, capacidades) => chamar(`${prefixo}/licoes/${id}/avaliar`, { metodo: "POST", corpo: { resposta }, cookie, capacidades });

    const errada = await (await avaliar(respostaErrada(exercicio), TUDO)).json();
    assert.equal(errada.correta, false);
    assert.equal("visual" in errada, false, "quem errou não vê a resposta");

    const comCabecalho = await (await avaliar(respostaCerta(exercicio), TUDO)).json();
    assert.equal(comCabecalho.correta, true);
    assert.deepEqual(comCabecalho.visual.pontos.find((ponto) => ponto.id === "C"), { id: "C", papel: "resposta", x: 4, y: 0 });
    assert.equal(comCabecalho.visual.alt, "Plano cartesiano com A (1, 2), B (−2, 7), baricentro G (1, 3) e o vértice C (4, 0).");
    assert.ok(comCabecalho.comprovante);

    const soVisuais = await (await avaliar(respostaCerta(exercicio), SO_VISUAIS)).json();
    assert.equal(soVisuais.visual.alt, comCabecalho.visual.alt);

    const semCabecalho = await (await avaliar(respostaCerta(exercicio), SEM)).json();
    assert.equal(semCabecalho.correta, true);
    assert.equal("visual" in semCabecalho, false, "o cliente que não desenha não recebe a figura");
    assert.equal(/[$\\]/.test(semCabecalho.feedback), false, "o retorno em texto linear, sem cifrão nem LaTeX");
    const comMarcas = await (await avaliar(respostaCerta(exercicio), TUDO)).json();
    assert.ok(comMarcas.feedback.includes("$"), "quem desenha recebe as fórmulas marcadas");
  });

  await t.test("o Sua vez: a primeira errada só diz o porquê; a certa revela os passos que faltam, com a figura da resposta descrita dos dados", async () => {
    const ponto = licoesDaDemo.findIndex(({ titulo }) => titulo === "Ponto médio de um segmento");
    const id = ids[ponto];
    const resolucao = licoesDaDemo[ponto].resolucao;
    const corte = resolucao.passos.findIndex((passo) => passo.tentativa);
    const opcoes = resolucao.passos[corte].tentativa.opcoes;
    const certa = opcoes.findIndex((opcao) => opcao.correta);
    const errada = opcoes.findIndex((opcao) => !opcao.correta);
    const escolher = (opcao, tentativa) => chamar(`${prefixo}/licoes/${id}/resolucao`, { metodo: "POST", corpo: { opcao, tentativa }, cookie, capacidades: TUDO });

    const primeira = await (await escolher(errada, 1)).json();
    assert.deepEqual(primeira, { correta: false, porque: opcoes[errada].porque }, "a primeira errada não revela");

    const acerto = await (await escolher(certa, 1)).json();
    assert.equal(acerto.correta, true);
    assert.equal(acerto.depois.passos.length, resolucao.passos.length - corte - 1);
    const figura = acerto.depois.passos.at(-1).visual;
    assert.equal(figura.alt, "Plano cartesiano com A (1, 2), B (5, 8) e o ponto médio M (3, 5).");
    assert.deepEqual(figura.pontos.find((candidato) => candidato.id === "M"), { id: "M", papel: "resposta", x: 3, y: 5, derivado: { tipo: "ponto_medio", de: ["A", "B"] } });

    const segundaErrada = await (await escolher(errada, 2)).json();
    assert.equal(segundaErrada.certa, certa);
    assert.deepEqual(segundaErrada.depois, acerto.depois, "depois da segunda errada segue como no acerto");

    for (const invalido of [{ opcao: 3, tentativa: 1 }, { opcao: 0, tentativa: 3 }, { opcao: "0", tentativa: 1 }]) {
      const resposta = await chamar(`${prefixo}/licoes/${id}/resolucao`, { metodo: "POST", corpo: invalido, cookie, capacidades: TUDO });
      assert.equal(resposta.status, 400, JSON.stringify(invalido));
    }
    // Lição sem Resolva comigo: não há Sua vez a responder.
    const sem = await chamar(`${prefixo}/licoes/${ids[0]}/resolucao`, { metodo: "POST", corpo: { opcao: 0, tentativa: 1 }, cookie, capacidades: TUDO });
    assert.notEqual(sem.status, 200);
  });

  await t.test("o plano criado some do banco no fim (a conta de teste é apagada com ele)", async () => {
    assert.ok(planoId);
    const apagado = await chamar(`${prefixo}/planos/${planoId}`, { metodo: "DELETE", cookie });
    assert.ok([200, 204].includes(apagado.status), `DELETE ${apagado.status}`);
  });
});
