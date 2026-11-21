import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  conferirConta,
  desenharFormulaEmLinha,
  desenharVisual,
  falarFormula,
  formulaCanonica,
  formulaLinear,
  lerFormula,
  validarResolucao,
} from "@studoo/contratos";

/*
 * Marco 9: o que a IA real escreve de um jeito que o conferidor recusava por FORMA, sem a conta estar errada (dumps do Lead em 746d84d):
 * `\quad` entre duas equações (sumia, e `x_C \quad 12` virava o produto x_C·12), `\begin{matrix}` sem moldura, o realce em volta de uma linha
 * da matriz (`\foco{2 & 3 & 1}`) e a opção do "Sua vez" com a frase e a conta juntas. O que continua recusado (Sarrus 3 × 5, três
 * determinantes numa fórmula, o produto `aei` sem espaço) vai só no pedido à IA.
 */

const copia = (valor) => JSON.parse(JSON.stringify(valor));
const ok = (fonte) => {
  const lida = lerFormula(fonte);
  assert.equal(lida.ok, true, `${fonte} devia ler: ${lida.erro}`);
  return lida;
};
const BRUTOS = JSON.parse(readFileSync(new URL("./fixtures/matematica-ia-real/brutos-746d84d.json", import.meta.url), "utf8")).casos;
const baricentro = () => copia(JSON.parse(readFileSync(new URL("./fixtures/matematica/baricentro.json", import.meta.url), "utf8")).licao.resolucao);

/* ----- \quad entre duas equações ----- */

const DUAS = String.raw`12 = 3 + (-1) + x_C \quad 12 = 1 + 5 + y_C`;

test("\\quad, \\qquad, \\; e \\, entre duas afirmações com \"=\" as separam: nunca multiplicam (a fórmula exata da IA real)", () => {
  const lida = ok(DUAS);
  // Antes: "x_C12 = 1 + 5 + y_C", um produto que nunca existiu.
  assert.equal(lida.canonica, String.raw`12 = 3 + (-1) + x_C \quad 12 = 1 + 5 + y_C`);
  assert.equal(formulaLinear(lida.arvore), "12 = 3 + (−1) + x_C; 12 = 1 + 5 + y_C");
  assert.match(falarFormula(lida.arvore), /mais x índice C, 12 é igual a 1/);
  assert.equal(lida.arvore.itens.filter((item) => item.tipo === "separador").length, 1);
  // A forma canônica é a que o servidor guarda e relê: ida e volta, a mesma.
  assert.equal(ok(lida.canonica).canonica, lida.canonica);
  for (const espaco of [String.raw`\quad`, String.raw`\qquad`, String.raw`\;`, String.raw`\,`, String.raw`\:`, String.raw`\ `, String.raw`\quad\quad`, String.raw`\; \,`]) {
    assert.equal(ok(`x_C = 10 ${espaco} y_C = 6`).canonica, String.raw`x_C = 10 \quad y_C = 6`, espaco);
  }
  assert.equal(ok(String.raw`x_G = \frac{x_A + x_B}{2} \quad y_G = \frac{y_A + y_B}{2}`).canonica, String.raw`x_G = \frac{x_A + x_B}{2} \quad y_G = \frac{y_A + y_B}{2}`, "com fração antes: não cola mais no 2");
  assert.equal(ok(String.raw`\foco{x = 1 \quad y = 2}`).canonica, String.raw`\foco{x = 1 \quad y = 2}`, "dentro de um realce também");
  assert.equal(ok(String.raw`a = 1 \quad b = 2 \quad c = 3`).arvore.itens.filter((item) => item.tipo === "separador").length, 2);
});

test("\\quad e \\, que NÃO separam duas afirmações são um vão desenhado (marco 10), e a conta não os vê", () => {
  // O espaço fica na forma canônica e vira um vão no desenho; só a conta o ignora.
  assert.equal(ok(String.raw`2\,x + 3\,y = 7`).canonica, String.raw`2 \, x + 3 \, y = 7`, "espaço fino entre fatores");
  assert.equal(ok(String.raw`1\,000 = 10^3`).canonica, String.raw`1 \, 000 = 10^3`);
  assert.equal(ok(String.raw`x \quad y = 2`).canonica, String.raw`x \quad y = 2`, "sem relação do lado esquerdo: não separa as equações, mas é um vão");
  assert.equal(ok(String.raw`x = 1 \quad y`).canonica, String.raw`x = 1 \quad y`);
  assert.equal(ok(String.raw`x = 1 \quad \to \quad y = 2`).canonica, String.raw`x = 1 \quad \to \quad y = 2`, "a seta não é relação: sem separador, com os vãos");
  assert.equal(ok(String.raw`\begin{vmatrix} a \quad & b \\ c & d \end{vmatrix} \quad = \quad ad - bc`).canonica, String.raw`\begin{vmatrix} a & b \\ c & d \end{vmatrix} \quad = \quad a d - b c`, "no fim da célula sai; em volta do = fica");
  assert.equal(lerFormula(String.raw`\quad`).ok, false, "só espaço: fórmula vazia");
  assert.equal(ok(String.raw`x_C = 10 \! y_C = 6`).canonica, "x_C = 10y_C = 6", "\\! é espaço NEGATIVO: não separa nem desenha vão");
  // A conta não os vê.
  const conta = conferirConta([ok(String.raw`x = 3`).arvore, ok(String.raw`2\,x = 6`).arvore, ok(String.raw`2 \; x \; = \; 6`).arvore, ok(String.raw`y = \; -2`).arvore]);
  assert.deepEqual({ ok: conta.ok, conferidas: conta.conferidas, declaradas: conta.declaradas }, { ok: true, conferidas: 4, declaradas: { x: "3", y: "-2" } });
});

test("a conta das duas equações é conferida uma a uma: certas, conferidas; errada de verdade, recusada e diz qual", () => {
  const duas = ok(DUAS).arvore;
  const certa = conferirConta([duas, ok("C = (10, 6)").arvore]);
  assert.equal(certa.ok, true);
  assert.equal(certa.conferidas, 2, "x_C = 10 e y_C = 6 fecham as DUAS equações");
  assert.deepEqual(certa.declaradas, { x_C: "10", y_C: "6" });
  const errada = conferirConta([duas, ok("C = (9, 6)").arvore]);
  assert.equal(errada.ok, false);
  assert.equal(errada.motivo, "12 = 11 é falso, com x_C = 9");
  assert.equal(errada.formula, "12 = 3 + (−1) + x_C; 12 = 1 + 5 + y_C");
  const segunda = conferirConta([duas, ok("C = (10, 5)").arvore]);
  assert.equal(segunda.ok, false);
  assert.match(segunda.motivo, /12 = 11 é falso, com y_C = 5/, "a segunda equação também é conferida");
});

test("a resolução da IA real com o \\quad (material-2, lição 1) vale; trocando x_C por 9, a recusa diz a conta", async () => {
  const { lerResolucaoDoModelo, lerVisuaisDoModelo } = await import("../src/servidor/ia/matematica.ts");
  const caso = BRUTOS["material-2/licao1"];
  const lida = lerResolucaoDoModelo(caso.resolucao);
  assert.ok(lida.resolucao, lida.motivo);
  assert.ok(lida.conta.conferidas >= 2, `conferidas: ${lida.conta.conferidas}`);
  assert.equal(lida.resolucao.passos[1].formula, String.raw`12 = 3 + (-1) + x_C \quad 12 = 1 + 5 + y_C`);
  // Os visuais da lição que a IA escreveu com o mesmo \quad: duas fórmulas lado a lado, e não coladas.
  const visuais = lerVisuaisDoModelo(caso.visuais);
  assert.equal(visuais.visuais.length, 2);
  assert.equal(visuais.visuais[0].latex, String.raw`x_G = \frac{x_A + x_B + x_C}{3} \quad y_G = \frac{y_A + y_B + y_C}{3}`);
  // Com x_C = 9 (e a conta do passo 3 junto) a conta não fecha, e a recusa traz a equação e a letra.
  const errada = copia(caso.resolucao);
  errada.passos[4].formula = String.raw`C = (\resposta{9}, \resposta{6})`;
  const recusada = lerResolucaoDoModelo(errada);
  assert.equal(recusada.resolucao, undefined);
  assert.match(recusada.motivo, /a conta não fecha em "(12 = 3 \+ \(−1\) \+ x_C; 12 = 1 \+ 5 \+ y_C|12 = 2 \+ x_C)": .*x_C = 9/);
});

test("o vão entre as duas equações é desenhado (lado a lado, com respiro) e não é um sinal", () => {
  const largura = (fonte) => desenharFormulaEmLinha(ok(fonte).arvore, 16, 400).largura;
  const sozinhas = largura("x_C = 10") + largura("y_C = 6");
  const juntas = largura(String.raw`x_C = 10 \quad y_C = 6`);
  // O vão é 0,7 da altura da letra (no meio da frase): 11,2 em 16.
  assert.ok(Math.abs(juntas - sozinhas - 0.7 * 16) < 0.6, `vão de ${(juntas - sozinhas).toFixed(2)}`);
  const colada = largura("x_C = 10 y_C = 6");
  assert.ok(juntas > colada + 8, "antes elas coladas (o 10 e o y_C encostavam)");
  // Em bloco: o desenho vale (com o fundo), e ainda lê as duas fórmulas.
  const bloco = desenharVisual({ tipo: "formula", latex: String.raw`x_M = \frac{x_A + x_B}{2} \quad y_M = \frac{y_A + y_B}{2}`, alt: "Ponto médio" }, { tipo: "enunciado" }, { tamanho: 22, fundo: true });
  assert.ok(bloco && bloco.largura === 320 && bloco.primitivas.length >= 2, "o fundo e o desenho das duas equações");
  assert.match(bloco.descricao, /x índice M é igual a .*, y índice M é igual a /, "o leitor de tela lê as duas, com a pausa entre elas");
});

/* ----- \begin{matrix}, sem moldura ----- */

const SARRUS = String.raw`\begin{vmatrix} 2 & 1 & 3 \\ 1 & 2 & 1 \\ 4 & 1 & 2 \end{vmatrix} \begin{matrix} 2 & 1 \\ 1 & 2 \\ 4 & 1 \end{matrix}`;

test("\\begin{matrix} sem moldura: lê, volta igual, desenha sem as hastes e se fala como matriz", () => {
  const lida = ok(String.raw`\begin{matrix} 2 & 1 \\ 1 & 2 \\ 4 & 1 \end{matrix}`);
  assert.equal(lida.arvore.moldura, "nenhuma");
  assert.equal(lida.canonica, String.raw`\begin{matrix} 2 & 1 \\ 1 & 2 \\ 4 & 1 \end{matrix}`);
  assert.equal(formulaLinear(lida.arvore), "[2, 1; 1, 2; 4, 1]");
  assert.equal(falarFormula(lida.arvore), "matriz de 3 linhas e 2 colunas: linha 1: 2, 1; linha 2: 1, 2; linha 3: 4, 1");
  assert.equal(ok(lida.canonica).canonica, lida.canonica);
  assert.equal(lerFormula(String.raw`\begin{matrix} a & b \\ c \end{matrix}`).ok, false, "linhas de tamanhos diferentes seguem recusadas");
  assert.equal(lerFormula(String.raw`\begin{matrix} a & b & c & d & e \end{matrix}`).ok, false, "5 colunas seguem fora do limite de 4");
  // Desenho: as mesmas células da matriz com colchetes, sem as hastes e sem os cantos; e mais estreita (sem a moldura).
  const linhas = (latex) => {
    const desenho = desenharVisual({ tipo: "formula", latex, alt: "Matriz" }, { tipo: "enunciado" }, { tamanho: 22 });
    return { desenho, hastes: desenho.primitivas.filter((p) => p.tipo === "linha").length };
  };
  const sem = linhas(String.raw`\begin{matrix} 2 & 1 \\ 1 & 2 \end{matrix}`);
  const com = linhas(String.raw`\begin{bmatrix} 2 & 1 \\ 1 & 2 \end{bmatrix}`);
  const barras = linhas(String.raw`\begin{vmatrix} 2 & 1 \\ 1 & 2 \end{vmatrix}`);
  assert.equal(sem.hastes, 0);
  assert.equal(barras.hastes, 2);
  assert.equal(com.hastes, 2 + 4, "duas hastes e quatro cantos");
  assert.ok(sem.desenho.primitivas.length < com.desenho.primitivas.length);
});

test("o determinante com a matriz das colunas repetidas ao lado (o Sarrus da IA real) lê e desenha; 3 × 5 em um determinante só segue recusado", () => {
  const lida = ok(SARRUS);
  assert.equal(lida.canonica, String.raw`\begin{vmatrix} 2 & 1 & 3 \\ 1 & 2 & 1 \\ 4 & 1 & 2 \end{vmatrix}\begin{matrix} 2 & 1 \\ 1 & 2 \\ 4 & 1 \end{matrix}`);
  assert.ok(desenharVisual({ tipo: "formula", latex: SARRUS, alt: "Sarrus" }, { tipo: "enunciado" }, { tamanho: 22, fundo: true }));
  const cincoColunas = lerFormula(String.raw`\begin{vmatrix} 2 & 1 & 3 & 2 & 1 \\ 1 & 4 & 2 & 1 & 4 \\ 3 & 2 & 1 & 3 & 2 \end{vmatrix}`);
  assert.equal(cincoColunas.ok, false);
  assert.match(cincoColunas.erro, /matriz maior que 4 × 4/);
});

/* ----- O realce em volta de uma linha da matriz ----- */

test("realce em volta de várias células (\\foco{2 & 3 & 1}) é desembrulhado: a linha segue, sem o destaque; uma célula só continua destacada", async () => {
  const { reescreverRealces, lerResolucaoDoModelo } = await import("../src/servidor/ia/matematica.ts");
  const regras = { resposta: false, procurado: true };
  const linha = String.raw`\begin{bmatrix} \foco{2 & 3 & 1} \\ x_Q & y_Q & 1 \\ x_R & y_R & 1 \end{bmatrix}`;
  assert.equal(lerFormula(linha).ok, false, "o analisador recusa o & solto: era a fórmula inteira que caía");
  const reparada = reescreverRealces(linha, regras);
  assert.equal(reparada.latex, String.raw`\begin{bmatrix} 2 & 3 & 1 \\ x_Q & y_Q & 1 \\ x_R & y_R & 1 \end{bmatrix}`);
  assert.deepEqual(reparada.motivos, ["em volta de várias células da matriz"]);
  assert.equal(lerFormula(reparada.latex).ok, true);
  // Uma célula, um realce: fica. Uma matriz inteira dentro do realce: fica (o & está dentro do ambiente dele).
  const uma = String.raw`\begin{bmatrix} \foco{2} & 3 & 1 \\ x_Q & y_Q & 1 \end{bmatrix}`;
  assert.deepEqual(reescreverRealces(uma, regras), { latex: uma, motivos: [] });
  const inteira = String.raw`\foco{\begin{vmatrix} a & b \\ c & d \end{vmatrix}} = \resposta{0}`;
  assert.equal(reescreverRealces(inteira, { resposta: true, procurado: true }).latex, inteira);
  // Quebra de linha dentro do realce também.
  assert.equal(reescreverRealces(String.raw`\foco{a \\ b}`, regras).latex, String.raw`a \\ b`);
  // A resolução inteira da IA real (material-2, lição 2): valia só com a nova tentativa; agora vale na primeira, e o relato conta o reparo.
  const lida = lerResolucaoDoModelo(BRUTOS["material-2/licao2"].resolucao);
  assert.ok(lida.resolucao, lida.motivo);
  assert.deepEqual(lida.reparos, ["passo 2: 1 realce desembrulhado (em volta de várias células da matriz)", "passo 3: 1 realce desembrulhado (em volta de várias células da matriz)"]);
});

/* ----- A opção do "Sua vez" com a frase e a conta juntas ----- */

test("opção com texto e fórmula juntos: a conta vai para dentro do texto, entre cifrões, e segue conferida; sem nenhum dos dois, recusada", async () => {
  const { lerResolucaoDoModelo } = await import("../src/servidor/ia/matematica.ts");
  const passoDoSuaVez = (resolucao) => resolucao.passos.findIndex((passo) => passo.tentativa);
  const base = baricentro();
  const posicao = passoDoSuaVez(base);
  // Errada, com a frase e a conta: vale, e a conta entra no texto.
  const com = copia(base);
  com.passos[posicao].tentativa.opcoes[1] = { texto: "Só soma tudo", formula: "y_C = 2 + 1 + 5", correta: false, porque: "Falta triplicar a ordenada de G." };
  const resultado = validarResolucao(com);
  assert.equal(resultado.ok, true, resultado.motivo);
  const opcao = resultado.resolucao.passos[posicao].tentativa.opcoes[1];
  assert.equal(opcao.texto, "Só soma tudo $y_C = 2 + 1 + 5$");
  assert.equal(opcao.formula, undefined, "uma opção é de texto ou de fórmula: a que veio com as duas fica de texto");
  assert.deepEqual(resultado.ajustes, [`passo ${posicao + 1}, opção 2: texto e fórmula juntos (a fórmula foi para dentro do texto)`]);
  assert.deepEqual(lerResolucaoDoModelo(com).reparos, resultado.ajustes, "o relato conta como reparo");
  // A conta continua conferida: a opção marcada como errada que na verdade dá o valor da resolução é recusada, com a frase junto.
  const enganada = copia(base);
  enganada.passos[posicao].tentativa.opcoes[1] = { texto: "Triplica e tira", formula: "y_C = 3 \\times 2 - 1 - 5", correta: false, porque: "x" };
  assert.match(validarResolucao(enganada).motivo, /opção 2 está marcada como errada, mas a conta dela dá o valor da resolução/);
  // Frase e conta que somam mais de 60 caracteres: a frase segue recusada por tamanho.
  const longa = copia(base);
  longa.passos[posicao].tentativa.opcoes[1] = { texto: "Esta frase é comprida demais para caber numa opção", formula: "y_C = 2 + 1 + 5", correta: false, porque: "x" };
  assert.match(validarResolucao(longa).motivo, /opção 2: texto: mais de 60 caracteres/);
  // Fórmula que não lê, junto com a frase: recusada pela fórmula.
  const ilegivel = copia(base);
  ilegivel.passos[posicao].tentativa.opcoes[1] = { texto: "Só soma", formula: String.raw`\input{x}`, correta: false, porque: "x" };
  assert.match(validarResolucao(ilegivel).motivo, /opção 2: fórmula/);
  // Nenhum dos dois: recusada, com o motivo certo.
  const nenhuma = copia(base);
  delete nenhuma.passos[posicao].tentativa.opcoes[1].formula;
  delete nenhuma.passos[posicao].tentativa.opcoes[1].texto;
  assert.equal(validarResolucao(nenhuma).motivo, "opção 2: precisa de texto ou de fórmula");
  // A que a IA real mandou (trilha, lição 3): a frase "triângulo de área 7" com a conta "A = 14/2".
  const real = lerResolucaoDoModelo(BRUTOS["trilha-1/licao3"].resolucao);
  assert.ok(real.resolucao, real.motivo);
  const doSuaVez = real.resolucao.passos.find((passo) => passo.tentativa).tentativa.opcoes[1];
  assert.match(doSuaVez.texto, /^Os pontos formam um triângulo de área 7\. \$A = \\frac\{14\}\{2\}\$$/);
  assert.ok(real.reparos.some((reparo) => /opção 2: texto e fórmula juntos/.test(reparo)), real.reparos.join("; "));
});

/* ----- O que segue recusado (só o pedido à IA) ----- */

test("o que segue recusado por forma vai só no pedido à IA: Sarrus 3 × 5, três determinantes numa fórmula, o produto aei sem espaço", async () => {
  const { lerResolucaoDoModelo, lerVisuaisDoModelo, instrucoesDeMatematica, instrucoesDeFigurasDoMaterial } = await import("../src/servidor/ia/matematica.ts");
  assert.match(lerResolucaoDoModelo(BRUTOS["material-2/licao3-nova-tentativa"].resolucao).motivo, /matriz maior que 4 × 4/);
  assert.match(lerResolucaoDoModelo(BRUTOS["trilha-1/licao3-tentativa2"].resolucao).motivo, /matrizes demais/);
  const visuais = lerVisuaisDoModelo(BRUTOS["material-2/licao3"].visuais);
  assert.equal(visuais.visuais.length, 1, "o determinante com a matriz ao lado (matrix) agora vale; o aei não");
  assert.match(visuais.motivos[0], /visuais\[1\]: fórmula: palavra solta/);
  // O produto escrito com espaço vale.
  assert.equal(ok("a e i + b f g").canonica, "a e i + b f g");
  for (const texto of [instrucoesDeMatematica, instrucoesDeFigurasDoMaterial]) {
    assert.match(texto, /até 4 × 4 e no máximo 2 por fórmula\. O determinante é quadrado \(2 × 2, 3 × 3 ou 4 × 4\), e o Sarrus escreve-se SÓ como a soma dos produtos das diagonais, sem repetir colunas ao lado e sem matriz 3 × 5/);
    assert.match(texto, /O & e a quebra \\\\ só existem entre as células de uma matriz: nunca dentro de \\foco\{…\}, \\procurado\{…\} ou \\resposta\{…\}, que marcam UMA célula/);
    assert.match(texto, /Duas equações lado a lado se separam com \\quad\. Produto de variáveis com espaço ou \\times \(a e i, não aei\)/);
    assert.match(texto, /uma frase com uma conta no meio vai toda em texto, a conta entre cifrões/);
  }
  assert.ok(formulaCanonica(ok(String.raw`x = 1 \quad y = 2`).arvore).includes(String.raw`\quad`));
});
