import assert from "node:assert/strict";
import { test } from "node:test";

// Os erros HTTP carregam o cliente do banco ao importar; este teste não toca no banco, então um endereço fictício basta.
process.env.DATABASE_URL ??= "postgresql://teste:teste@127.0.0.1:5432/teste";
process.env.STUDOO_CHAVE_ASSINATURA ??= "0123456789abcdef".repeat(4);

const { comTextoSimples } = await import("../src/servidor/aprendizado/formulas-na-licao.ts");
const { PEDIDO_DE_TEXTO_SIMPLES } = await import("../src/servidor/estudio/apoio.ts");

/*
 * Marco 13d: o texto que a IA escreve FORA da lição (a ponte do reforço e o retorno do "Ensine o Stu") chega a todos os clientes em texto linear, porque nenhum
 * deles desenha fórmula nessas duas telas. A marca `$…$` vira texto legível, o `$` solto da lição de matemática sai, e o dinheiro e o `$HOME` ficam.
 */

const copia = (valor) => JSON.parse(JSON.stringify(valor));
const textos = (valor) => (typeof valor === "string" ? [valor] : Array.isArray(valor) ? valor.flatMap(textos) : valor && typeof valor === "object" ? Object.values(valor).flatMap(textos) : []);
/** O que nunca pode aparecer: o cifrão da marca, a barra do LaTeX, as chaves e o circunflexo. (O `_` das lacunas "___" e dos índices `x_V` é o do texto linear; "R$ 25,00" é dinheiro.) */
const CRU = /[$\\{}^]/;
const semDinheiro = (texto) => texto.replace(/R\$ ?\d[\d.,]*/g, "");
const semCru = (texto) => assert.doesNotMatch(semDinheiro(texto), CRU, texto);

/** A ponte como `buscarApoio` a devolve, com o que a IA escreve de matemática (e o dinheiro de um exemplo). */
const ponteDaIa = () => ({
  erros: 1,
  ponte: {
    motivo: "Você respondeu $\\cos x$, mas $\\sin x$ varia entre $-1$ e $1$. Vamos ver de outro jeito.",
    conceito: "A razão $\\frac{a}{b}$ só existe se $b \\neq 0$, e o vértice tem $x_V = \\frac{-b}{2a}$.",
    exemplo: "Complete: $h = $ ___ . Se um lanche custa R$ 25,00 e outro $A custa mais, some os dois.",
    exercicio: {
      tipo: "multipla_escolha",
      enunciado: "Quanto vale $\\sin 0$ e quanto é $\\frac{6}{3}$?",
      opcoes: [{ id: "0", texto: "$0$ e $2$" }, { id: "1", texto: "$1$ e $\\frac{1}{2}$" }, { id: "2", texto: "R$ 25,00" }],
    },
    concluida: false,
    simulado: false,
  },
  ensino: {
    acertos: ["Você disse que $\\sin x$ vai de $-1$ a $1$.", "E que $\\frac{a}{b}$ pede $b \\neq 0$."],
    lacuna: "Faltou dizer quanto vale $h = $ ___ no ponto zero.",
    pergunta: "E se fosse $\\cos x$? Custa R$ 25,00 aprender isso? Diga com $\\pi$.",
    proximoPasso: "Escreva o gráfico de $y = x^2$ e confira.",
    simulado: false,
  },
});

test("lição de matemática: a ponte e o Ensine o Stu chegam em texto linear, sem símbolo cru, e o dinheiro fica", () => {
  const apoio = comTextoSimples(ponteDaIa(), true);
  for (const texto of textos(apoio)) semCru(texto);
  assert.equal(apoio.ponte.motivo, "Você respondeu cos x, mas sen x varia entre −1 e 1. Vamos ver de outro jeito.");
  assert.equal(apoio.ponte.conceito, "A razão a/b só existe se b ≠ 0, e o vértice tem x_V = (−b) ÷ (2a).");
  assert.equal(apoio.ponte.exemplo, "Complete: h = ___ . Se um lanche custa R$ 25,00 e outro A custa mais, some os dois.", "a conta de lacuna sem o cifrão, o dinheiro intacto, o $ solto fora");
  assert.equal(apoio.ponte.exercicio.enunciado, "Quanto vale sen 0 e quanto é 6/3?");
  assert.deepEqual(apoio.ponte.exercicio.opcoes.map(({ texto }) => texto), ["0 e 2", "1 e 1/2", "R$ 25,00"]);
  assert.deepEqual(apoio.ensino.acertos, ["Você disse que sen x vai de −1 a 1.", "E que a/b pede b ≠ 0."]);
  assert.equal(apoio.ensino.lacuna, "Faltou dizer quanto vale h = ___ no ponto zero.");
  assert.equal(apoio.ensino.pergunta, "E se fosse cos x? Custa R$ 25,00 aprender isso? Diga com π.");
  assert.equal(apoio.ensino.proximoPasso, "Escreva o gráfico de y = x² e confira.");
  // O que não é texto (ids, o gabarito que não vai, os números e os booleanos) fica como está.
  assert.deepEqual(apoio.ponte.exercicio.opcoes.map(({ id }) => id), ["0", "1", "2"]);
  assert.equal(apoio.erros, 1);
  assert.equal(apoio.ponte.concluida, false);
  assert.equal(apoio.ensino.simulado, false);
});

test("o retorno da ponte (feedback) e o resto do objeto também: nada de IA chega com marca", () => {
  const retorno = comTextoSimples({ correta: false, feedback: "Quase: $\\sin x$ nunca passa de $1$; confira $\\frac{a}{b}$.", certos: ["valor"], apoio: ponteDaIa() }, true);
  assert.equal(retorno.feedback, "Quase: sen x nunca passa de 1; confira a/b.");
  for (const texto of textos(retorno)) semCru(texto);
  assert.deepEqual(retorno.certos, ["valor"], "os termos de correção (certos) ficam");
});

test("fora da matemática: só a marca que LÊ vira texto; \"R$ 25,00\" e $HOME ficam, e o `$` solto não sai", () => {
  const apoio = {
    ponte: { motivo: "Use $HOME no script e R$ 25,00 na conta; copie $PATH e ${a}+${b}.", conceito: "Em shell, $1 é o primeiro argumento." },
    ensino: { acertos: ["Você citou $HOME."], lacuna: "A velocidade vale $v = \\frac{d}{t}$ e custa R$ 5,00.", pergunta: "E $HOME?", proximoPasso: "Releia.", simulado: false },
  };
  const saida = comTextoSimples(copia(apoio), false);
  assert.equal(saida.ponte.motivo, apoio.ponte.motivo, "shell e dinheiro intactos");
  assert.equal(saida.ponte.conceito, apoio.ponte.conceito);
  assert.deepEqual(saida.ensino.acertos, apoio.ensino.acertos);
  assert.equal(saida.ensino.lacuna, "A velocidade vale v = d/t e custa R$ 5,00.", "a marca que lê vira texto linear mesmo numa lição que não é de matemática");
  assert.equal(saida.ensino.pergunta, "E $HOME?");
  // Sem marca nenhuma, é o mesmo objeto (nada é copiado nem reescrito).
  const sem = { ponte: { motivo: "Use $HOME.", conceito: "Preço: R$ 25,00." }, ensino: null };
  assert.equal(comTextoSimples(sem, false), sem);
  assert.equal(comTextoSimples({ erros: 0, ponte: null, ensino: null }, true).ponte, null);
});

test("idempotente: o que já está linear (e guardado assim) não muda de novo", () => {
  const uma = comTextoSimples(ponteDaIa(), true);
  const duas = comTextoSimples(copia(uma), true);
  assert.deepEqual(duas, uma);
  assert.equal(comTextoSimples(uma, true), uma, "nada a mudar: o mesmo objeto");
});

test("o pedido à IA da ponte e do Ensine o Stu diz para escrever a matemática em texto simples, sem $ nem LaTeX", async () => {
  assert.equal(PEDIDO_DE_TEXTO_SIMPLES, "Escreva a matemática em texto simples, sem $ nem LaTeX (x², a/b, raiz de x).");
  // As duas funções de IA levam a frase (o fonte é a fonte da verdade: as instruções vão para o `pedirJson`).
  const { readFileSync } = await import("node:fs");
  const fonte = readFileSync(new URL("../src/servidor/estudio/apoio.ts", import.meta.url), "utf8");
  for (const funcao of ["ponte_reforco", "ensine_ao_stu"]) {
    const inicio = fonte.indexOf(`'${funcao}'`);
    assert.ok(inicio > 0, funcao);
    const ate = fonte.indexOf("PEDIDO_DE_TEXTO_SIMPLES", inicio);
    assert.ok(ate > inicio && ate - inicio < 1800, `${funcao}: o pedido vai nas instruções dela`);
  }
  // A linearização vale para as quatro portas: GET do apoio, criar a ponte, avaliar a ponte e ensinar.
  assert.equal((fonte.match(/comTextoSimples\(/g) ?? []).length, 3, "apoio (que a criação e o GET usam), avaliação da ponte e retorno do ensino");
});
