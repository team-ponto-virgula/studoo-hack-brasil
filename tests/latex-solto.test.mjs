import assert from "node:assert/strict";
import { test } from "node:test";
import { contemLatexSolto, falarTextoComFormulas, marcarFormulasSoltas, partirTextoComFormulas, textoSemFormulas } from "@studoo/contratos";
import { comFormulasParaOCliente, conteudoEhDeMatematica } from "../src/servidor/aprendizado/visuais.ts";

/*
 * Marco 13b: o LaTeX SOLTO (sem cifrões) que a IA escreve numa opção, numa dica ou num retorno de uma lição de matemática. Quando a gramática o lê, vira marca (`$…$`: o
 * cliente que desenha o desenha, o leitor de tela o fala); quando não lê, sai em texto legível, sem barra nem chave; e o cliente sem cabeçalho nunca recebe a barra crua.
 * O caso real: as três opções da lição 5 de matrizes da IA de verdade, "\begin{bmatrix} 2 & 8 \\ 7 & 7 \end{bmatrix}" sem um cifrão.
 */

const CRU = /[$\\{}]/;
const MATRIZES = [
  String.raw`\begin{bmatrix} 2 & 8 \\ 7 & 7 \end{bmatrix}`,
  String.raw`\begin{bmatrix} 2 & 4 \\ 7 & 7 \end{bmatrix}`,
  String.raw`\begin{bmatrix} 2 & 8 \\ 5 & 7 \end{bmatrix}`,
];

test("o caso real: as três opções de matriz, sem cifrão, viram marca (e a fala do leitor); o texto linear lê a matriz", () => {
  const lineares = ["[2, 8; 7, 7]", "[2, 4; 7, 7]", "[2, 8; 5, 7]"];
  MATRIZES.forEach((opcao, i) => {
    assert.equal(contemLatexSolto(opcao), true);
    const marcado = marcarFormulasSoltas(opcao);
    assert.equal(marcado, `$${opcao}$`, "a marca é a própria fórmula, na forma canônica");
    assert.equal(textoSemFormulas(opcao), lineares[i], "o cliente sem cabeçalho lê a matriz, sem barra");
    assert.equal(textoSemFormulas(marcado), lineares[i]);
    assert.match(falarTextoComFormulas(marcado), /^matriz de 2 linhas e 2 colunas: linha 1: /, "o leitor de tela ouve a matriz, não a barra");
    assert.doesNotMatch(falarTextoComFormulas(marcado), CRU);
    assert.equal(marcarFormulasSoltas(marcado), marcado, "idempotente");
  });
});

test("dentro da frase: só a fórmula vira marca, o resto do texto fica como está (dica, retorno, enunciado)", () => {
  const casos = [
    [String.raw`Isso! Veja \begin{bmatrix} 2 & 8 \\ 7 & 7 \end{bmatrix}.`, String.raw`Isso! Veja $\begin{bmatrix} 2 & 8 \\ 7 & 7 \end{bmatrix}$.`],
    [String.raw`Confira a conta: 2 \times 1 + 0 \times 2 = 2.`, String.raw`Confira a conta: $2 \times 1 + 0 \times 2 = 2$.`],
    [String.raw`A razão é \frac{3}{4} do total.`, String.raw`A razão é $\frac{3}{4}$ do total.`],
    [String.raw`\sqrt{2} é irracional`, String.raw`$\sqrt{2}$ é irracional`],
    [String.raw`\pi r^2 é a área`, String.raw`$\pi r^2$ é a área`],
    [String.raw`2x + \frac{1}{2} = 3`, String.raw`$2x + \frac{1}{2} = 3$`],
    [String.raw`\sin x + \cos x`, String.raw`$\sin x + \cos x$`],
    [String.raw`f(a) = \frac{1}{a}`, String.raw`$f(a) = \frac{1}{a}$`],
    [String.raw`(veja \frac{1}{2})`, String.raw`(veja $\frac{1}{2}$)`],
    [String.raw`x = 2 \cdot 3`, String.raw`$x = 2 \times 3$`],
    [String.raw`R$ 25,00 e \frac{1}{2}`, String.raw`R$ 25,00 e $\frac{1}{2}$`],
    [String.raw`\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} = -2`, String.raw`$\begin{vmatrix} 1 & 2 \\ 3 & 4 \end{vmatrix} = -2$`],
  ];
  for (const [entrada, esperado] of casos) {
    assert.equal(marcarFormulasSoltas(entrada), esperado, entrada);
    assert.equal(marcarFormulasSoltas(esperado), esperado, `idempotente: ${entrada}`);
    assert.doesNotMatch(textoSemFormulas(entrada), /[\\{}]/, `sem barra nem chave no texto linear: ${entrada}`);
  }
});

test('o "e" de frase quebra a corrida; a conta começada (`= ___`) fica fora; o espaço da ponta não se perde', () => {
  // Duas corridas, nunca uma conta só "x ≤ 5·e·y ≥ 2".
  assert.equal(marcarFormulasSoltas(String.raw`x \leq 5 e y \geq 2`), String.raw`$x \leq 5$ e $y \geq 2$`);
  assert.equal(textoSemFormulas(String.raw`x \leq 5 e y \geq 2`), "x ≤ 5 e y ≥ 2", "sem a heurística também: nunca \"5ey\"");
  assert.equal(marcarFormulasSoltas(String.raw`Calcule \frac{a}{b} e \frac{c}{d}.`), String.raw`Calcule $\frac{a}{b}$ e $\frac{c}{d}$.`);
  assert.equal(
    marcarFormulasSoltas(String.raw`A = \begin{bmatrix}1 & 2\\3 & 4\end{bmatrix} e B = \begin{bmatrix}5 & 6\\7 & 8\end{bmatrix}`),
    String.raw`$A = \begin{bmatrix} 1 & 2 \\ 3 & 4 \end{bmatrix}$ e $B = \begin{bmatrix} 5 & 6 \\ 7 & 8 \end{bmatrix}$`,
  );
  // A conta que termina em `=` e deixa a lacuna de fora: a marca vai até o último termo, e o `= ___` é texto (o caso real da IA, a lição de determinantes).
  assert.equal(
    marcarFormulasSoltas(String.raw`D = 1 \times 4 + 2 \times 6 + 1 \times 3 - 2 \times 2 - 4 \times 3 - 1 \times 6 = ___`),
    String.raw`$D = 1 \times 4 + 2 \times 6 + 1 \times 3 - 2 \times 2 - 4 \times 3 - 1 \times 6$ = ___`,
  );
  // O espaço antes da corrida e depois do que não lê fica: nada cola.
  assert.equal(marcarFormulasSoltas(String.raw`Use \foo{x} e \frac{1}{2}.`), String.raw`Use foo(x) e $\frac{1}{2}$.`);
});

test("o que a gramática não lê sai em texto legível, sem barra nem chave, e nunca vira marca", () => {
  const casos = [
    [String.raw`5 \text{ cm} de lado`, "5 cm de lado"],
    [String.raw`\foo{x} é algo desconhecido`, "foo(x) é algo desconhecido"],
    [String.raw`Use \times para multiplicar`, "Use × para multiplicar"],
    [String.raw`O ângulo é 30^\circ.`, "O ângulo é 30°."],
    [String.raw`um \begin{foo} 1 \end{foo} qualquer`, null],
    [String.raw`\begin{bmatrix} 1 & 2 sem fim`, null],
  ];
  for (const [entrada, esperado] of casos) {
    const marcado = marcarFormulasSoltas(entrada);
    assert.doesNotMatch(marcado, CRU, entrada);
    if (esperado !== null) assert.equal(marcado, esperado, entrada);
    assert.doesNotMatch(textoSemFormulas(entrada), CRU, `texto linear: ${entrada}`);
    assert.doesNotMatch(falarTextoComFormulas(entrada), CRU, `fala: ${entrada}`);
  }
});

test("sem LaTeX solto, o texto é o mesmo: com dinheiro, código, matemática simples e a heurística dos tokens de sempre", () => {
  for (const texto of ["Sem nada de LaTeX aqui, só texto e 3 + 4 = 7.", "Custa R$ 25,00; no shell, $HOME é a pasta.", "Python: x_1 = 3 e print(x_1).", "Janela C:\\Users\\ana e \\n."]) {
    if (!texto.includes("\\")) assert.equal(contemLatexSolto(texto), false, texto);
  }
  assert.equal(marcarFormulasSoltas("Sem nada de LaTeX aqui, só texto e 3 + 4 = 7."), "Sem nada de LaTeX aqui, só texto e 3 + 4 = 7.");
  assert.equal(marcarFormulasSoltas("x_A + x_B = 10"), "$x_A + x_B = 10$", "a heurística de sempre (a conta curta)");
  assert.equal(marcarFormulasSoltas(String.raw`Em $\frac{1}{2}$ e em x_A.`), String.raw`Em $\frac{1}{2}$ e em $x_A$.`, "marca que já veio e token solto, juntos");
});

test("contemLatexSolto: o comando de matemática fora de cifrões, não o dentro, nem o que sozinho não diz nada", () => {
  for (const texto of [String.raw`\frac{1}{2}`, String.raw`veja \begin{bmatrix} 1 \end{bmatrix}`, String.raw`2 \times 3`, String.raw`x \leq 5`, String.raw`\pi`, String.raw`$R\$ 5$ e \sqrt{4}`]) assert.equal(contemLatexSolto(texto), true, texto);
  for (const texto of ["sem barra", String.raw`dentro $\frac{1}{2}$ da marca`, String.raw`só \text{cm} e \quad e \left(`, String.raw`C:\Users\ana`, "R$ 5,00 e $HOME", ""]) assert.equal(contemLatexSolto(texto), false, texto);
});

/* ----- O servidor: lição de matemática por LaTeX solto e a entrega a cada cliente ----- */

/** A lição da prova real (matrizes) com o que a IA escreveu: as opções e o retorno em LaTeX solto. */
const licaoDeMatrizes = () => ({
  objetivo: "Multiplicar duas matrizes usando a regra linha por coluna.",
  conceito: "Na multiplicação A × B, cada elemento do produto vem de uma linha de A e uma coluna de B.",
  exemplo: "Com A = [1, 2; 3, 4] e B = [5, 6; 7, 8], o termo da 1ª linha com a 1ª coluna é 1 × 5 + 2 × 7 = 19.",
  origem: "teste",
  exercicio: {
    tipo: "multipla_escolha",
    enunciado: "Qual é o produto A × B para A = [2, 0; 1, 3] e B = [1, 4; 2, 1]?",
    opcoes: [{ id: "a", texto: MATRIZES[0] }, { id: "b", texto: MATRIZES[1] }, { id: "c", texto: MATRIZES[2] }],
    gabarito: ["a"],
    feedbackCorreto: String.raw`Isso! O produto é \begin{bmatrix} 2 & 8 \\ 7 & 7 \end{bmatrix}.`,
    feedbackIncorreto: String.raw`Confira a conta: 2 \times 1 + 0 \times 2 = 2.`,
  },
});
const opcoesDe = (conteudo) => conteudo.exercicio.opcoes.map(({ texto }) => texto);
const TUDO = { visuais: 2, resolucao: 1 };
const SEM_CABECALHO = { visuais: 0, resolucao: 0 };

test("a lição cujo assunto a regra de palavras não pega, mas traz LaTeX solto, é de matemática; código e prosa seguem como estavam", () => {
  const conjuntos = { objetivo: "Operar com conjuntos numéricos.", conceito: "Um conjunto reúne elementos.", exemplo: "Veja o exemplo.", origem: "t",
    exercicio: { tipo: "multipla_escolha", enunciado: "Qual é o resultado?", opcoes: [{ id: "a", texto: String.raw`\frac{1}{2}` }, { id: "b", texto: "um terço" }], gabarito: ["a"], feedbackCorreto: "Isso.", feedbackIncorreto: "Tente de novo." } };
  assert.equal(conteudoEhDeMatematica(conjuntos), true, "uma opção em LaTeX solto basta");
  const prosa = { ...conjuntos, exercicio: { ...conjuntos.exercicio, opcoes: [{ id: "a", texto: "meio" }, { id: "b", texto: "um terço" }] } };
  assert.equal(conteudoEhDeMatematica(prosa), false, "sem matemática e sem LaTeX, não");
  const codigo = { ...conjuntos, exercicio: { ...conjuntos.exercicio, trechoTipo: "codigo", trecho: "print(2 \\times 3)" } };
  assert.equal(conteudoEhDeMatematica(codigo), false, "trecho de código nunca é matemática");
  // A lição de matrizes (o caso real) já era de matemática pelo assunto, e continua.
  assert.equal(conteudoEhDeMatematica(licaoDeMatrizes()), true);
});

test("o caso real na entrega: a web recebe as opções e o retorno com marca; o cliente sem cabeçalho, em texto linear, nunca com barra", () => {
  const conteudo = licaoDeMatrizes();
  const web = comFormulasParaOCliente(conteudo, conteudo, TUDO);
  assert.deepEqual(opcoesDe(web), MATRIZES.map((opcao) => `$${opcao}$`), "cada opção é a marca da própria matriz");
  assert.equal(web.exercicio.feedbackIncorreto, String.raw`Confira a conta: $2 \times 1 + 0 \times 2 = 2$.`);
  assert.equal(web.exercicio.feedbackCorreto, String.raw`Isso! O produto é $\begin{bmatrix} 2 & 8 \\ 7 & 7 \end{bmatrix}$.`);
  // O enunciado e o texto sem LaTeX solto passam só pela heurística de sempre (a conta curta "A × B" ganha a marca), nada mais.
  assert.equal(web.exercicio.enunciado, marcarFormulasSoltas(conteudo.exercicio.enunciado));
  assert.equal(web.conceito, marcarFormulasSoltas(conteudo.conceito));

  const antigo = comFormulasParaOCliente(conteudo, conteudo, SEM_CABECALHO);
  assert.deepEqual(opcoesDe(antigo), ["[2, 8; 7, 7]", "[2, 4; 7, 7]", "[2, 8; 5, 7]"]);
  assert.equal(antigo.exercicio.feedbackIncorreto, "Confira a conta: 2 × 1 + 0 × 2 = 2.");
  assert.equal(antigo.exercicio.feedbackCorreto, "Isso! O produto é [2, 8; 7, 7].");
  for (const texto of [...opcoesDe(antigo), antigo.exercicio.feedbackIncorreto, antigo.exercicio.feedbackCorreto]) assert.doesNotMatch(texto, /[\\$]/, texto);

  // O que está guardado não muda (a entrega é uma cópia), e o texto sem LaTeX continua sendo o mesmo objeto.
  assert.deepEqual(opcoesDe(conteudo), MATRIZES);
  const lisa = { ...licaoDeMatrizes(), exercicio: { ...licaoDeMatrizes().exercicio, opcoes: [{ id: "a", texto: "[2, 8; 7, 7]" }, { id: "b", texto: "[2, 4; 7, 7]" }], feedbackCorreto: "Isso!", feedbackIncorreto: "Tente." } };
  assert.equal(comFormulasParaOCliente(lisa, lisa, SEM_CABECALHO), lisa, "nada a mudar: o mesmo objeto");
});

test("o texto marcado pelo LaTeX solto vira os segmentos que o cliente desenha: a conta é fórmula, a matriz em linha é texto linear (e fala como matriz)", () => {
  const conta = partirTextoComFormulas(marcarFormulasSoltas(String.raw`Confira a conta: 2 \times 1 + 0 \times 2 = 2.`));
  assert.deepEqual(conta.map((segmento) => segmento.tipo), ["texto", "formula", "texto"]);
  assert.equal(conta[1].latex, String.raw`2 \times 1 + 0 \times 2 = 2`);
  const matriz = partirTextoComFormulas(marcarFormulasSoltas(MATRIZES[0]));
  assert.deepEqual(matriz, [{ tipo: "texto", texto: "[2, 8; 7, 7]" }], "a matriz não cabe em linha: o texto linear, e a marca guarda a fala");
});

test("o texto estranho não prende o servidor: a conta que nunca fecha e centenas de comandos soltos saem legíveis, e depressa", () => {
  const estranhos = [
    Array.from({ length: 60 }, () => String.raw`\frac{1}{2} + +`).join(" "),
    Array.from({ length: 200 }, (_, i) => String.raw`a \times b${i % 2 ? " e" : ""}`).join(" "),
    String.raw`\frac{1}{2} + ` + "x + ".repeat(55) + String.raw`\sqrt{`,
    "palavra \\foo{x} ".repeat(300),
  ];
  const inicio = performance.now();
  for (const texto of estranhos) {
    marcarFormulasSoltas(texto);
    assert.doesNotMatch(textoSemFormulas(texto), /[\\{}]/);
  }
  assert.ok(performance.now() - inicio < 2000, "a conta de leituras tem teto (ORCAMENTO_DE_LEITURAS)");
});

