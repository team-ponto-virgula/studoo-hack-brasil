import assert from "node:assert/strict";
import { test } from "node:test";
import { LARGURA_DO_ESPACO_EM_EM, conferirConta, desenharFormulaEmLinha, desenharVisual, falarFormula, formulaLinear, lerFormula, partirTextoComFormulas } from "@studoo/contratos";

/*
 * Marco 10b: o espaço que a IA escreve (`\quad`, `\qquad`, `\;`, `\,`) é SEMPRE um vão desenhado, com ou sem "=", e a palavra (`\text{…}`)
 * que encosta na matemática ganha um vão fino automático. Antes o espaço sumia na leitura e o PNG saía "m₂paralelas" e "−1perpendiculares".
 * Separar duas equações para a conta (marco 9) segue valendo. O motor é um só: web, app e PNG desenham o mesmo.
 */

const ok = (fonte) => {
  const lida = lerFormula(fonte);
  assert.equal(lida.ok, true, `${fonte}: ${lida.erro}`);
  return lida;
};
const largura = (fonte, tamanho = 16) => desenharFormulaEmLinha(ok(fonte).arvore, tamanho, 400).largura;
const PERTO = 0.06;
const perto = (valor, esperado, mensagem) => assert.ok(Math.abs(valor - esperado) < PERTO, `${mensagem}: ${valor.toFixed(3)} (esperado ${esperado.toFixed(3)})`);

test("as larguras dos espaços são as do LaTeX: quad 1 em, qquad 2 em, \\; 5/18, \\: 4/18 e \\, 3/18", () => {
  assert.deepEqual(LARGURA_DO_ESPACO_EM_EM, { ",": 3 / 18, ":": 4 / 18, ";": 5 / 18, quad: 1, qquad: 2 });
  assert.ok(Math.abs(LARGURA_DO_ESPACO_EM_EM[";"] - 0.28) < 0.005 && Math.abs(LARGURA_DO_ESPACO_EM_EM[","] - 0.17) < 0.005, "o pedido: ≈ 0,28 e ≈ 0,17 em");
});

test("os quatro comandos desenham o vão, entre símbolos e sem \"=\": a diferença para o sem espaço é a largura do comando (em 16 e em 22)", () => {
  for (const tamanho of [16, 22]) {
    const sem = largura("x y", tamanho);
    for (const [comando, em] of [[String.raw`\quad`, 1], [String.raw`\qquad`, 2], [String.raw`\;`, 5 / 18], [String.raw`\,`, 3 / 18], [String.raw`\:`, 4 / 18], [String.raw`\ `, 5 / 18]]) {
      perto(largura(`x ${comando} y`, tamanho) - sem, em * tamanho, `${comando} em ${tamanho}`);
    }
  }
  // Também entre números e dentro de uma fração, onde antes não deixava vestígio.
  perto(largura(String.raw`2 \quad 3`) - largura("2") - largura("3"), 16, "entre números");
  perto(largura(String.raw`\frac{a \qquad b}{c}`) - largura(String.raw`\frac{a b}{c}`), 32, "dentro de uma fração (em linha, a/b lado a lado)");
  // O espaço no começo e no fim não desloca a fórmula centralizada.
  perto(largura(String.raw`\quad x = 1 \qquad`), largura("x = 1"), "sem vão nas pontas");
  // O \! (espaço negativo) não desenha vão.
  perto(largura(String.raw`x \! y`), largura("x y"), "\\! não desenha");
});

test("o espaço entre as duas equações é o vão do separador (1,1 em no bloco, 0,7 na frase), e a conta continua lendo duas cláusulas", () => {
  const duas = largura(String.raw`x_C = 10 \quad y_C = 6`);
  perto(duas - largura("x_C = 10") - largura("y_C = 6"), 0.7 * 16, "o vão entre as equações em linha");
  const conta = conferirConta([ok(String.raw`12 = 3 + (-1) + x_C \quad 12 = 1 + 5 + y_C`).arvore, ok("C = (10, 6)").arvore]);
  assert.equal(conta.ok, true);
  assert.equal(conta.conferidas, 2);
});

test("as duas fórmulas da IA real (lição 7, retas paralelas e perpendiculares): a palavra tem vão, e o do \\quad vale por si", () => {
  const palavraParalelas = largura(String.raw`\text{paralelas}`);
  const antes = largura("m_1 = m_2");
  const paralelas = largura(String.raw`m_1 = m_2 \quad \text{paralelas}`);
  perto(paralelas - antes - palavraParalelas, 16, "\\quad: 1 em entre a fórmula e a palavra (e nenhum vão automático por cima)");
  const palavraPerpendiculares = largura(String.raw`\text{perpendiculares}`);
  const antesPerp = largura(String.raw`m_1 \times m_2 = -1`);
  const perpendiculares = largura(String.raw`m_1 \times m_2 = -1 \;\text{perpendiculares}`);
  perto(perpendiculares - antesPerp - palavraPerpendiculares, (5 / 18) * 16, "\\;: 5/18 em, sem vão automático por cima");
  // Era assim que saía: colado, sem vão nenhum (o desenho com \text{…} logo depois do símbolo e do número).
  const colada = largura(String.raw`m_1 = m_2\text{paralelas}`);
  assert.ok(colada - antes - palavraParalelas > 3, "mesmo sem o comando, a palavra colada já não encosta");
  // O desenho de bloco (o que o site, o app e o PNG recebem) existe e lê a palavra.
  const bloco = desenharVisual({ tipo: "formula", latex: String.raw`m_1 = m_2 \quad \text{paralelas}`, alt: "Retas paralelas" }, { tipo: "enunciado" }, { tamanho: 22, fundo: true });
  assert.ok(bloco && bloco.descricao.includes("paralelas") && bloco.descricao.includes("m índice 1 é igual a m índice 2"), bloco?.descricao);
});

test("o \\text colado na matemática ganha um vão fino (0,22 em); o que já traz espaço ganha UM vão (0,28 em), nunca os dois; ao lado do operador, nenhum", () => {
  const palavra = largura(String.raw`\text{paralelas}`);
  const m2 = largura("m_2");
  perto(largura(String.raw`m_2\text{paralelas}`) - m2 - palavra, 0.22 * 16, "a palavra depois do símbolo");
  perto(largura(String.raw`m_2\text{ paralelas}`) - m2 - palavra, 0.28 * 16, "o espaço que o \\text já traz, sozinho");
  perto(largura(String.raw`\text{paralelas}m_2`) - m2 - palavra, 0.22 * 16, "a palavra antes do símbolo");
  perto(largura(String.raw`\text{paralelas }m_2`) - m2 - palavra, 0.28 * 16, "o espaço do fim da palavra, sozinho");
  perto(largura(String.raw`\text{ paralelas }m_2`) - m2 - palavra, 0.28 * 16, "a palavra com espaço dos dois lados, só o do fim (o do começo não tem o que afastar)");
  // O espaço explícito vale sozinho: nem o automático nem o espaço do \text se somam a ele.
  perto(largura(String.raw`m_2 \; \text{ paralelas}`) - m2 - palavra, (5 / 18) * 16, "\\; e o espaço do \\text: só o \\;");
  perto(largura(String.raw`m_2 \; \text{paralelas}`) - m2 - palavra, (5 / 18) * 16, "\\; e a palavra colada: só o \\;");
  // Ao lado de um operador, o respiro do operador basta.
  // (A largura de "m_2 =" já leva o respiro de depois do "=": a palavra encosta nele e não ganha vão por cima.)
  perto(largura(String.raw`m_2 = \text{paralelas}`) - largura("m_2 =") - palavra, 0, "depois do =, só o respiro do operador");
  perto(largura(String.raw`\text{paralelas} = m_2`) - largura("= m_2") - palavra, 0, "antes do =, idem");
  // Duas palavras coladas não ganham vão; com espaço, sim.
  perto(largura(String.raw`\text{a}\text{b}`) - largura(String.raw`\text{a}`) - largura(String.raw`\text{b}`), 1, "duas palavras coladas: só o respiro de 1 de sempre, nenhum vão");
  perto(largura(String.raw`\text{a }\text{b}`) - largura(String.raw`\text{a}`) - largura(String.raw`\text{b}`), 0.28 * 16, "uma palavra com espaço antes da outra");
});

test("o que o espaço vira em texto: linear com um espaço só, falado com pausa no \\quad, canônico que lê de volta igual", () => {
  for (const fonte of [
    String.raw`m_1 = m_2 \quad \text{paralelas}`,
    String.raw`m_1 \times m_2 = -1 \;\text{perpendiculares}`,
    String.raw`a \qquad b`,
    String.raw`2 \, x \: y`,
    String.raw`\text{se } x = 1`,
    String.raw`m_2\text{paralelas}`,
    String.raw`\text{ paralelas }`,
    String.raw`x = \; -2`,
  ]) {
    const lida = ok(fonte);
    assert.equal(ok(lida.canonica).canonica, lida.canonica, `ida e volta: ${fonte}`);
    assert.doesNotMatch(formulaLinear(lida.arvore), /\\|  /, `o linear sem barra nem espaço duplo: ${formulaLinear(lida.arvore)}`);
  }
  assert.equal(ok(String.raw`m_1 = m_2 \quad \text{paralelas}`).canonica, String.raw`m_1 = m_2 \quad \text{paralelas}`);
  assert.equal(formulaLinear(ok(String.raw`m_1 = m_2 \quad \text{paralelas}`).arvore), "m_1 = m_2 paralelas");
  assert.equal(formulaLinear(ok(String.raw`m_1 \times m_2 = -1 \;\text{perpendiculares}`).arvore), "m_1 × m_2 = −1 perpendiculares");
  assert.equal(formulaLinear(ok(String.raw`m_2\text{paralelas}`).arvore), "m_2 paralelas", "a palavra colada ganha o espaço também no texto");
  assert.equal(falarFormula(ok(String.raw`m_1 = m_2 \quad \text{paralelas}`).arvore), "m índice 1 é igual a m índice 2, paralelas", "pausa no \\quad");
  assert.equal(falarFormula(ok(String.raw`2 \, x`).arvore), "2 x", "o espaço fino não fala nada");
  // A palavra com espaço na ponta guarda a marca (e o canônico a devolve).
  const texto = ok(String.raw`\text{ paralelas }`).arvore;
  assert.deepEqual(texto, { tipo: "texto", valor: "paralelas", espacoAntes: true, espacoDepois: true });
  assert.equal(ok(String.raw`\text{paralelas}`).arvore.espacoAntes, undefined);
});

test("separar equações (marco 9) segue valendo, e o espaço que não separa não tira a conta de lugar", () => {
  assert.equal(ok(String.raw`x_C = 10 \quad y_C = 6`).arvore.itens.filter((item) => item.tipo === "separador").length, 1);
  assert.equal(ok(String.raw`m_1 = m_2 \quad \text{paralelas}`).arvore.itens.filter((item) => item.tipo === "separador").length, 0, "o texto não é afirmação");
  assert.equal(ok(String.raw`m_1 = m_2 \quad \text{paralelas}`).arvore.itens.filter((item) => item.tipo === "espaco").length, 1);
  // O sinal depois do espaço continua sendo sinal (`= \; -2`), e a conta lê `3 \, \times \, 4`.
  const conta = conferirConta([ok(String.raw`y = \; -2`).arvore, ok(String.raw`3 \, \times \, 4 \; = \; 12`).arvore, ok(String.raw`2\,y = -4`).arvore]);
  assert.deepEqual({ ok: conta.ok, conferidas: conta.conferidas }, { ok: true, conferidas: 3 });
  // Uma conta errada com espaços ainda é recusada, e diz qual.
  assert.equal(conferirConta([ok(String.raw`x = 3`).arvore, ok(String.raw`2 \; x = 7`).arvore]).ok, false);
});

test("no texto da lição ($…$) o espaço também é um vão, e a frase não ganha cifrão nem barra", () => {
  const trechos = partirTextoComFormulas(String.raw`Vale $m_1 = m_2 \quad \text{paralelas}$ e $m_1 \times m_2 = -1 \;\text{perpendiculares}$.`);
  const formulas = trechos.filter((trecho) => trecho.tipo === "formula");
  assert.equal(formulas.length, 2);
  assert.equal(trechos.map((trecho) => (trecho.tipo === "texto" ? trecho.texto : "")).join("").includes("$"), false);
});
