import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ORDENS_DO_SUA_VEZ, normalizarResolucao, passosEmTexto, resolucaoParaCliente, responderSuaVez } from "@studoo/contratos";
import { apresentarExercicio } from "../src/dominio/aprendizado/plano.ts";
import { comVisuais } from "../src/servidor/aprendizado/visuais.ts";
import { ordemDoSuaVez } from "../src/servidor/aprendizado/ordem-sua-vez.ts";

/*
 * Marco 10: a opção certa do "Sua vez" era sempre a A (70 de 71 passos dos dumps reais: a IA escreve a certa primeiro) e nenhum cliente
 * embaralha essas opções. O servidor embaralha na saída, por (conta, lição): a lição leva as opções já na ordem mostrada e o POST
 * /resolucao recebe o índice mostrado, desfaz a permutação para achar a certa e devolve os índices na ordem mostrada.
 */

const copia = (valor) => JSON.parse(JSON.stringify(valor));
const conteudoDa = (nome) => copia(JSON.parse(readFileSync(new URL(`./fixtures/matematica/${nome}.json`, import.meta.url), "utf8")).licao);
const guardada = (nome) => normalizarResolucao(conteudoDa(nome).resolucao);
const passoDoSuaVez = (resolucao) => resolucao.passos.find((passo) => passo.tentativa);
const chave = (opcao) => opcao.formula ?? opcao.texto;

test("as seis ordens são as seis permutações das três opções, sem repetir", () => {
  assert.equal(ORDENS_DO_SUA_VEZ.length, 6);
  assert.equal(new Set(ORDENS_DO_SUA_VEZ.map((ordem) => ordem.join(""))).size, 6);
  for (const ordem of ORDENS_DO_SUA_VEZ) assert.deepEqual([...ordem].sort(), [0, 1, 2]);
});

test("a lição leva as opções na ordem mostrada, sem gabarito; o índice mostrado acerta a certa nas seis ordens", () => {
  for (const nome of ["baricentro", "abscissas", "colinearidade"]) {
    const resolucao = guardada(nome);
    const opcoes = passoDoSuaVez(resolucao).tentativa.opcoes;
    const certaGuardada = opcoes.findIndex((opcao) => opcao.correta);
    for (const ordem of ORDENS_DO_SUA_VEZ) {
      const publica = resolucaoParaCliente(resolucao, ordem);
      const mostradas = publica.passos.at(-1).tentativa.opcoes;
      assert.deepEqual(mostradas.map(chave), ordem.map((guardadaNaPosicao) => chave(opcoes[guardadaNaPosicao])), `${nome} ${ordem}: opções na ordem mostrada`);
      assert.equal(JSON.stringify(publica).includes('"correta"'), false);
      assert.equal(JSON.stringify(publica).includes('"porque"'), false);
      const certaMostrada = ordem.indexOf(certaGuardada);
      for (let mostrada = 0; mostrada < 3; mostrada += 1) {
        const resposta = responderSuaVez(resolucao, { opcao: mostrada, tentativa: 1 }, ordem);
        assert.equal(resposta.correta, mostrada === certaMostrada, `${nome} ${ordem} opção ${mostrada}`);
        assert.equal(resposta.porque, opcoes[ordem[mostrada]].porque, "o porquê é o da opção que ela VIU");
        if (mostrada !== certaMostrada) {
          assert.deepEqual(Object.keys(resposta), ["correta", "porque"], "a primeira errada só diz o porquê, sem índice");
          const segunda = responderSuaVez(resolucao, { opcao: mostrada, tentativa: 2 }, ordem);
          assert.equal(segunda.certa, certaMostrada, "a certa volta na ordem mostrada");
          assert.equal(segunda.porqueDaCerta, opcoes[certaGuardada].porque);
          assert.deepEqual(segunda.depois, responderSuaVez(resolucao, { opcao: certaMostrada, tentativa: 1 }, ordem).depois);
        }
      }
      assert.equal(responderSuaVez(resolucao, { opcao: 3, tentativa: 1 }, ordem), null);
      assert.equal(responderSuaVez(resolucao, { opcao: -1, tentativa: 1 }, ordem), null);
    }
  }
});

test("sem ordem (ou com uma que não serve) vale a ordem guardada, como sempre; o exemplo em texto e o guardado não mudam", () => {
  const resolucao = guardada("baricentro");
  const original = copia(resolucao);
  const natural = resolucaoParaCliente(resolucao);
  for (const ruim of [[0, 0, 1], [0, 1], [0, 1, 2, 3], [0, 1, 3], [-1, 0, 1], [0.5, 1, 2], "012", null]) {
    assert.deepEqual(resolucaoParaCliente(resolucao, ruim), natural, JSON.stringify(ruim));
  }
  const certa = passoDoSuaVez(resolucao).tentativa.opcoes.findIndex((opcao) => opcao.correta);
  assert.equal(responderSuaVez(resolucao, { opcao: certa, tentativa: 1 }).correta, true);
  assert.equal(responderSuaVez(resolucao, { opcao: certa, tentativa: 1 }, [0, 0, 0]).correta, true, "uma ordem inválida é ignorada");
  resolucaoParaCliente(resolucao, [2, 1, 0]);
  responderSuaVez(resolucao, { opcao: 1, tentativa: 2 }, [2, 0, 1]);
  assert.deepEqual(resolucao, original, "o que a IA guardou não é tocado");
  const linear = (formula) => formula;
  assert.deepEqual(passosEmTexto(resolucao, linear), passosEmTexto(copia(original), linear), "o exemplo para o build 3 é o mesmo");
});

test("ordemDoSuaVez: a mesma conta e a mesma lição têm sempre a mesma ordem, e ela é uma das seis", () => {
  const chaveAntes = process.env.STUDOO_CHAVE_ASSINATURA;
  process.env.STUDOO_CHAVE_ASSINATURA = "ab".repeat(32);
  try {
    const ordem = ordemDoSuaVez("conta-1", "plano-1-1-2");
    for (let vez = 0; vez < 5; vez += 1) assert.deepEqual(ordemDoSuaVez("conta-1", "plano-1-1-2"), ordem);
    assert.ok(ORDENS_DO_SUA_VEZ.some((candidata) => candidata.join() === ordem.join()));
    // Cada lição e cada conta têm a sua: nem tudo igual.
    const porLicao = new Set(Array.from({ length: 40 }, (_, i) => ordemDoSuaVez("conta-1", `licao-${i}`).join()));
    const porConta = new Set(Array.from({ length: 40 }, (_, i) => ordemDoSuaVez(`conta-${i}`, "licao-1").join()));
    assert.ok(porLicao.size >= 5 && porConta.size >= 5, `${porLicao.size} e ${porConta.size} das 6 ordens`);
    // A chave do servidor entra: com outra, o mesmo par cai em outra ordem em boa parte dos casos (o cliente não calcula a permutação).
    const emOutraChave = Array.from({ length: 40 }, (_, i) => ordemDoSuaVez("conta-1", `licao-${i}`).join());
    process.env.STUDOO_CHAVE_ASSINATURA = "cd".repeat(32);
    const diferentes = Array.from({ length: 40 }, (_, i) => ordemDoSuaVez("conta-1", `licao-${i}`).join()).filter((valor, i) => valor !== emOutraChave[i]).length;
    assert.ok(diferentes >= 20, `${diferentes} de 40 mudam com outra chave`);
  } finally {
    if (chaveAntes === undefined) delete process.env.STUDOO_CHAVE_ASSINATURA;
    else process.env.STUDOO_CHAVE_ASSINATURA = chaveAntes;
  }
});

test("distribuição: em 300 lições sintéticas a certa cai em A, B e C em proporção parecida (nenhuma posição abaixo de 20%)", () => {
  const chaveAntes = process.env.STUDOO_CHAVE_ASSINATURA;
  process.env.STUDOO_CHAVE_ASSINATURA = "5e".repeat(32);
  try {
    const resolucao = guardada("baricentro");
    const certaGuardada = passoDoSuaVez(resolucao).tentativa.opcoes.findIndex((opcao) => opcao.correta);
    const contagem = (sorteios) => {
      const posicoes = [0, 0, 0];
      for (const [conta, licao] of sorteios) {
        const mostradas = resolucaoParaCliente(resolucao, ordemDoSuaVez(conta, licao)).passos.at(-1).tentativa.opcoes;
        const certa = passoDoSuaVez(resolucao).tentativa.opcoes[certaGuardada];
        posicoes[mostradas.findIndex((opcao) => chave(opcao) === chave(certa))] += 1;
      }
      return posicoes;
    };
    const lições = contagem(Array.from({ length: 300 }, (_, i) => ["conta-unica", `plano-${Math.floor(i / 6)}-1-${i % 6}`]));
    const contas = contagem(Array.from({ length: 300 }, (_, i) => [`conta-${i}`, "plano-1-1-1"]));
    for (const [rotulo, posicoes] of [["300 lições da mesma conta", lições], ["300 contas na mesma lição", contas]]) {
      assert.equal(posicoes.reduce((soma, valor) => soma + valor, 0), 300);
      for (const [letra, quantas] of posicoes.entries()) assert.ok(quantas >= 60 && quantas <= 140, `${rotulo}: a certa em ${"ABC"[letra]} ${quantas} vezes de 300 (${posicoes})`);
    }
  } finally {
    if (chaveAntes === undefined) delete process.env.STUDOO_CHAVE_ASSINATURA;
    else process.env.STUDOO_CHAVE_ASSINATURA = chaveAntes;
  }
});

test("a lição de verdade (comVisuais) leva a ordem da conta, e o POST com o índice mostrado acerta; sem conta, a ordem guardada", async () => {
  const conteudo = conteudoDa("colinearidade");
  const exercicios = [conteudo.exercicio, ...(conteudo.extras ?? [])].map(apresentarExercicio);
  const detalhe = {
    id: "licao-77", planoId: "plano-1", fluxoId: "fluxo-1", titulo: conteudo.titulo, objetivo: conteudo.objetivo, conceito: conteudo.conceito,
    exemplo: conteudo.exemplo, origem: conteudo.origem, exercicio: exercicios[0], exercicios, concluida: false,
  };
  const capacidades = { visuais: 1, resolucao: 1 };
  const resolucao = normalizarResolucao(conteudo.resolucao);
  const opcoes = passoDoSuaVez(resolucao).tentativa.opcoes;
  const certaGuardada = opcoes.findIndex((opcao) => opcao.correta);
  const sem = await comVisuais(detalhe, conteudo, { capacidades });
  assert.deepEqual(sem.resolucao.passos.at(-1).tentativa.opcoes.map(chave), opcoes.map(chave), "sem conta, a ordem guardada");
  const chaveAntes = process.env.STUDOO_CHAVE_ASSINATURA;
  process.env.STUDOO_CHAVE_ASSINATURA = "7f".repeat(32);
  try {
    const vistos = new Set();
    for (const conta of ["ana", "bia", "caio", "dora", "edu", "fabi", "gil"]) {
      const saida = await comVisuais(detalhe, conteudo, { capacidades, usuarioId: conta });
      const ordem = ordemDoSuaVez(conta, detalhe.id);
      const mostradas = saida.resolucao.passos.at(-1).tentativa.opcoes;
      assert.deepEqual(mostradas.map(chave), ordem.map((i) => chave(opcoes[i])), `${conta}: a ordem das duas rotas é a mesma função`);
      const certaMostrada = mostradas.findIndex((opcao) => chave(opcao) === chave(opcoes[certaGuardada]));
      // O que o POST faz: o índice mostrado, com a ordem da mesma conta e da mesma lição.
      assert.equal(responderSuaVez(resolucao, { opcao: certaMostrada, tentativa: 1 }, ordemDoSuaVez(conta, detalhe.id)).correta, true, conta);
      assert.equal(JSON.stringify(saida.resolucao).includes('"correta"'), false);
      vistos.add(certaMostrada);
    }
    assert.ok(vistos.size >= 2, `a certa não é sempre a mesma letra (${[...vistos]})`);
    // Reabrir a lição não troca as opções de lugar.
    const de = (await comVisuais(detalhe, conteudo, { capacidades, usuarioId: "ana" })).resolucao.passos.at(-1).tentativa.opcoes;
    const outra = (await comVisuais(detalhe, conteudo, { capacidades, usuarioId: "ana" })).resolucao.passos.at(-1).tentativa.opcoes;
    assert.deepEqual(outra, de);
  } finally {
    if (chaveAntes === undefined) delete process.env.STUDOO_CHAVE_ASSINATURA;
    else process.env.STUDOO_CHAVE_ASSINATURA = chaveAntes;
  }
});
