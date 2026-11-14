import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/*
 * Paridade entre web e mobile no que não depende de tela: os desenhos do mundo da trilha e as ideias do pedido.
 * Não precisa de servidor nem de banco.
 */

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), "utf8");

test("os desenhos do mundo são o mesmo arquivo na web e no app", async () => {
  const [web, app] = await Promise.all([ler("src/ui/mundo-desenhos.ts"), ler("apps/mobile/src/mundo-desenhos.ts")]);
  assert.equal(app, web);
});

/** Lista de várias linhas num objeto de mensagens, do rótulo até o colchete que fecha a lista. */
function lista(texto, rotulo) {
  const inicio = texto.indexOf(`    ${rotulo}: [\n`);
  assert.ok(inicio >= 0, `lista ${rotulo} não encontrada`);
  const fim = texto.indexOf("\n    ],", inicio);
  return texto.slice(inicio, fim);
}

/** Bloco de primeiro nível do objeto de mensagens, do rótulo até a chave que fecha o bloco. */
function bloco(texto, rotulo) {
  const inicio = texto.indexOf(`  ${rotulo}: {\n`);
  assert.ok(inicio >= 0, `bloco ${rotulo} não encontrado`);
  const fim = texto.indexOf("\n  },", inicio);
  return texto.slice(inicio, fim);
}

test("as áreas e ideias do pedido e os passos da apresentação são os mesmos na web e no app", async () => {
  const [web, app] = await Promise.all([ler("src/mensagens/pt-BR.ts"), ler("apps/mobile/src/mensagens.ts")]);
  for (const rotulo of ["temas", "passos"]) assert.equal(lista(app, rotulo), lista(web, rotulo), rotulo);
  assert.match(lista(web, "temas"), /id: 'idiomas'.*id: 'musica'.*id: 'matematica'/s);
  assert.match(lista(web, "temas"), /'SQL para a prova'/);
});

test("a tela que escreve as lições e as dicas da geração dizem o mesmo na web e no app", async () => {
  const [web, app] = await Promise.all([ler("src/mensagens/pt-BR.ts"), ler("apps/mobile/src/mensagens.ts")]);
  assert.equal(bloco(app, "preparo"), bloco(web, "preparo"));
  assert.equal(lista(app, "dicas"), lista(web, "dicas"));
});


test("o resumo de retomada diz o mesmo na web e no app", async () => {
  const [web, app] = await Promise.all([ler("src/mensagens/pt-BR.ts"), ler("apps/mobile/src/mensagens.ts")]);
  assert.equal(bloco(app, "retomada"), bloco(web, "retomada"));
});


test("login Google e recuperação têm os mesmos textos na web e no app", async () => {
  const [web, app] = await Promise.all([ler("src/mensagens/pt-BR.ts"), ler("apps/mobile/src/mensagens.ts")]);
  assert.equal(bloco(app, "acesso"), bloco(web, "acesso"));
});
