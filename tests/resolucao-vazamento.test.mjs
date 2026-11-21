import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { acharVazamento, alvosDoSuaVez, lerFormula, motivoDoVazamento, normalizarResolucao, resolucaoParaCliente, validarResolucao } from "@studoo/contratos";

/*
 * Marco 8: a FRASE do passo do "Sua vez" (e o nome do passo e a pergunta) não traz o resultado antes da escolha. A IA escrevia "Juntando os
 * termos, 0 − 6k = 0, e portanto k = 0." no passo em que a pessoa deveria achar k; `formula` e `visual` do passo já saíam do que vai pela
 * rede, mas o `texto` saía público. O validador recusa a resolução que o traz e o motivo (com a letra e o valor) vai à IA na nova tentativa.
 */

const copia = (valor) => JSON.parse(JSON.stringify(valor));
const arvore = (latex) => {
  const lida = lerFormula(latex);
  assert.equal(lida.ok, true, `${latex}: ${lida.erro}`);
  return lida.arvore;
};
const SEM_DADOS = { dados: new Set(), letras: [] };
const acha = (frase, alvos, contexto = SEM_DADOS) => acharVazamento(frase, alvos, contexto);
const alvosDa = (formula, extras = {}) => alvosDoSuaVez({ correta: { arvore: arvore(formula) }, declaradas: {}, ...extras });

/* ----- Os dumps reais aceitos antes do marco 8 (fixtures sem chave) ----- */

const REAIS = JSON.parse(readFileSync(new URL("./fixtures/matematica/sua-vez-reais.json", import.meta.url), "utf8")).casos;
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("dumps reais (cb532bb e bf94aed): as 9 resoluções de 31 cujo \"Sua vez\" traz o resultado são recusadas, com a letra e o valor; as outras 22 seguem aceitas", () => {
  assert.equal(REAIS.length, 31);
  assert.equal(REAIS.filter((caso) => caso.esperado === "recusada").length, 9);
  for (const caso of REAIS) {
    const resultado = validarResolucao(caso.resolucao);
    if (caso.esperado === "aceita") {
      assert.equal(resultado.ok, true, `${caso.id} (caso ${caso.caso}) devia seguir aceita: ${resultado.motivo}`);
      assert.ok(normalizarResolucao(caso.resolucao), `${caso.id}: a leitura da lição guardada também a aceita`);
      continue;
    }
    assert.equal(resultado.ok, false, `${caso.id} (caso ${caso.caso}) devia ser recusada: a frase traz ${caso.entrega}`);
    assert.match(resultado.motivo, /^o texto do passo \d \(o "Sua vez"\) traz /, caso.id);
    assert.match(resultado.motivo, new RegExp(`traz (?:o resultado ${escapar(caso.entrega)}|o valor ${escapar(caso.entrega)} do resultado) antes da escolha`), `${caso.id}: ${resultado.motivo}`);
    assert.equal(normalizarResolucao(caso.resolucao), null, `${caso.id}: a lição guardada com a frase que entrega também some`);
  }
});

test("dumps reais: os casos que o Lead e o Mobile 2 citaram", () => {
  const motivoDe = (id) => validarResolucao(REAIS.find((caso) => caso.id === id).resolucao).motivo;
  // "Juntando os termos, $0 − 6k = 0$, e portanto $k = 0$." (Mobile 2)
  assert.match(motivoDe("cb532bb/material-1/licao3"), /traz o resultado k = 0 antes da escolha/);
  // "Subtraindo 6 dos dois lados, x_C = 3."; "…chega-se a k = 1."; "Na ordenada, 9 = 5 + y_C, então y_C = 4." (Lead)
  assert.match(motivoDe("cb532bb/material-2/licao1"), /traz o resultado x_C = 3 antes da escolha/);
  assert.match(motivoDe("bf94aed/material-2/licao3"), /traz o resultado k = 1 antes da escolha/);
  assert.match(motivoDe("bf94aed/material-2/licao4"), /traz o resultado y_C = 4 antes da escolha/);
  // A conta já feita até o fim ("… = 3 × 1 − 2 − 3 = −2") e o resultado por extenso ("o determinante dá zero").
  assert.match(motivoDe("bf94aed/material-1/licao2"), /traz o resultado y_C = -2 antes da escolha/);
  assert.match(motivoDe("bf94aed/material-3/licao3"), /traz o valor 0 do resultado antes da escolha/);
});

test("dumps reais: as 22 que ficam não têm o resultado em nenhum campo público do passo do \"Sua vez\" (conferência independente, por texto)", () => {
  // A mesma classificação, sem passar pelo detector: a frase, o nome e a pergunta das aceitas não têm nenhum "= valor" da opção certa.
  for (const caso of REAIS.filter((c) => c.esperado === "aceita")) {
    const passo = caso.resolucao.passos.find((p) => p.tentativa);
    const alvo = alvosDa(passo.tentativa.opcoes.find((o) => o.correta).formula ?? "0");
    for (const campo of [passo.texto, passo.nome, passo.tentativa.pergunta]) {
      assert.equal(acha(campo, alvo, { dados: new Set(), letras: [] }), null, `${caso.id}: ${campo}`);
    }
  }
});

/* ----- O detector, frase a frase ----- */

test("a frase que traz o resultado: a letra com o valor, a conta feita até o fim, o par, o valor depois de \"vale\", \"igual a\", \"dá\", por extenso", () => {
  const k = alvosDa("k = 3");
  for (const frase of [
    "Então $k = 3$.",
    "Resolvendo, $-6k = -18$ e portanto $k = 3$.",
    "Logo k = 3.",
    "Dividindo por $-6$, $k = 3,0$.",
    "Como $3 = k$, os pontos são colineares.",
    "O valor de $k$ é igual a 3.",
    "Assim, $k$ vale 3.",
    "Isso dá 3.",
    "Obtemos 3 como valor de $k$.",
    "Chega-se a $k = \\frac{9}{3}$.",
  ]) assert.ok(acha(frase, k), frase);
  // Igualdades em cadeia até o resultado, com a letra no começo ou só números.
  const c = alvosDa("y_C = 3 \\times 1 - 2 - 3");
  assert.equal(c[0].rotulo, "y_C = -2");
  assert.ok(acha("Agora $y_C = 3y_G - y_A - y_B = 3 \\times 1 - 2 - 3 = -2$.", c));
  assert.ok(acha("Faça $3 \\times 1 - 2 - 3 = -2$ e siga.", c), "só números, a conta feita até o valor");
  assert.ok(acha("Fica y_C = 3 × 1 − 2 − 3 = −2 (sem marcas).", c));
  // Frações e decimais valem pelo valor: 20/6 é 10/3.
  const fracao = alvosDa("k = \\frac{20}{6}");
  for (const frase of ["Logo $k = \\frac{10}{3}$.", "Logo k = 20/6.", "O valor de $k$ vale 10/3", "Fica $k = 3,333$ ou melhor, 10/3."]) assert.ok(acha(frase, fracao), frase);
  assert.equal(acha("Logo $k = 3,33$.", fracao), null, "3,33 não é 10/3");
  // O ponto inteiro.
  const ponto = alvosDoSuaVez({ correta: { texto: "Não sei" }, arvoreDoUltimo: arvore("M = \\resposta{(5, 4)}"), declaradas: {} });
  assert.equal(ponto[0].rotulo, "(5, 4)");
  assert.ok(acha("Então $M = (5, 4)$.", ponto));
  assert.ok(acha("O ponto M(5, 4) é o médio.", ponto));
  assert.equal(acha("Com $A(1, 2)$ e $B(9, 6)$, faça a média.", ponto), null);
  // Por extenso, só depois de uma palavra de resultado (zero, dois… dez).
  const zero = alvosDoSuaVez({ correta: { arvore: arvore("14 - 14 = 0") }, declaradas: {} });
  assert.equal(zero[0].chave, undefined);
  for (const frase of ["Então o determinante dá zero: os pontos são colineares.", "O resultado é zero.", "Isso fica igual a zero."]) assert.ok(acha(frase, zero), frase);
});

test("a frase que só diz o que fazer não é recusada: sem valor, número solto de 1 algarismo, outra letra, equação da premissa, dado do problema", () => {
  const k = alvosDa("k = 3");
  for (const frase of [
    "Agora junte os termos e isole $k$.",
    "Divida os dois lados por 3.",
    "Some os 3 vértices e divida por 3.",
    "A média das três ordenadas é a ordenada de G.",
    "Com $x_A = 3$ e $x_B = 5$, isole $k$.",
    "A equação $3k = 9$ tem uma só incógnita, $k$.",
    "Use $x_1$, $x_2$ e $x_3$ na fórmula.",
    "Eleve ao quadrado: $x^3$.",
    "Veja o item 3 do material.",
    "Passe o $-6$ para o outro lado e divida.",
    "Resolva $k - 3 = 0$.",
    "Calcule $12 / 5$ com atenção.",
  ]) assert.equal(acha(frase, k), null, frase);
  // Mas a fração que já vale o resultado é a conta toda, e a conta feita não pode ir na frase.
  assert.ok(acha("Calcule $12 / 4$ com atenção.", k));
  assert.ok(acha("Calcule $\\frac{12}{4}$ com atenção.", k));
  // A equação com a incógnita, que o resultado anula: é a premissa, não a resposta.
  const zero = alvosDa("k = 0");
  assert.equal(acha("Juntando os termos, $0 - 6k = 0$.", zero), null);
  assert.equal(acha("Juntando os termos, $-6k = 0$; isole $k$.", zero), null);
  assert.ok(acha("Juntando os termos, $0 - 6k = 0$, e portanto $k = 0$.", zero), "o caso real");
  // Outra letra com o mesmo valor é outra grandeza.
  const yc = alvosDa("y_C = 6");
  assert.equal(acha("Com $y_A = 2$, $y_B = 4$ e $y_G = 6$, isole $y_C$.", yc), null);
  assert.ok(acha("Com $y_G = 4$, $y_C = 6$.", yc));
  // Nada de sentença sem número.
  assert.equal(acha("", k), null);
  assert.equal(acha("Agora é com você.", k), null);
  assert.equal(acha("Tudo certo.", []), null);
});

test("número solto: 1 algarismo nunca conta; 2 ou mais contam, a não ser que o problema já os traga; \"= valor\" e as palavras de resultado contam sempre", () => {
  const x = alvosDa("x_C = 12");
  assert.ok(acha("Subtraia 12 da soma.", x), "solto com 2 algarismos e sem ser dado");
  assert.equal(acha("Subtraia 12 da soma.", x, { dados: new Set(["12/1"]), letras: [] }), null, "o problema já traz o 12: é dado");
  assert.ok(acha("Então $x_C = 12$.", x, { dados: new Set(["12/1"]), letras: [] }), "a letra com o valor conta mesmo quando o 12 é dado");
  assert.ok(acha("O resultado é 12.", x, { dados: new Set(["12/1"]), letras: [] }), "depois de \"resultado\" conta sempre");
  assert.equal(acha("Some 2 e 1.", alvosDa("k = 2")), null, "1 algarismo solto");
  assert.ok(acha("Isso vale 2.", alvosDa("k = 2")), "mas depois de \"vale\" conta");
  assert.equal(acha("Use $x_{12}$ e $y_{12}$.", x), null, "índice não é valor");
  assert.equal(acha("Faça $x^{12}$.", x), null, "expoente não é valor");
  assert.equal(acha("Some $12 + 3$.", x), null, "parte de uma conta");
  assert.equal(acha("Vale 120.", x), null, "outro número");
  // Valor negativo: o sinal conta.
  assert.equal(acha("Subtraia 2 de 3 e confira.", alvosDa("y_C = 3 \\times 1 - 2 - 3")), null);
  assert.ok(acha("O valor é -2.", alvosDa("y_C = 3 \\times 1 - 2 - 3")));
});

test("o \"Sua vez\" sem letra na fórmula usa as letras da pergunta; \\resposta sem letra só vale no passo do próprio \"Sua vez\"", () => {
  const zero = alvosDoSuaVez({ correta: { arvore: arvore("14 - 14 = 0") }, declaradas: {} });
  assert.equal(acha("Então $D = 0$.", zero, { dados: new Set(), letras: ["d"] })?.alvo.rotulo, "0");
  assert.equal(acha("Então $D = 0$.", zero, { dados: new Set(), letras: ["k"] }), null, "outra letra");
  assert.equal(acha("Então $D = 0$.", zero), null, "sem letra na pergunta, só os outros jeitos valem");
  // \resposta{3} sem letra: do próprio passo, quando a opção certa não deu valor.
  const doPasso = alvosDoSuaVez({ correta: { texto: "Nenhum" }, arvoreDoPasso: arvore("k = 2 + \\resposta{3}"), declaradas: {} });
  assert.deepEqual(doPasso.map((alvo) => alvo.rotulo), ["3"]);
  // No último passo, `(\resposta{2}, \resposta{3})` traz uma coordenada que já veio antes: não vale como alvo solto.
  const doUltimo = alvosDoSuaVez({ correta: { texto: "Nenhum" }, arvoreDoUltimo: arvore("G = (\\resposta{2}, \\resposta{3})"), declaradas: {} });
  assert.deepEqual(doUltimo, []);
  // Com a letra (`\resposta{k = 3}`) ou o par, vale do passo ou do último.
  assert.deepEqual(alvosDoSuaVez({ correta: {}, arvoreDoUltimo: arvore("\\resposta{k = 3}"), declaradas: {} }).map((alvo) => alvo.rotulo), ["k = 3"]);
  assert.deepEqual(alvosDoSuaVez({ correta: {}, arvoreDoUltimo: arvore("M = \\resposta{(5, 4)}"), declaradas: {} }).map((alvo) => alvo.rotulo), ["(5, 4)"]);
  // A opção certa e o \resposta que dizem o mesmo valor viram um alvo só.
  assert.equal(alvosDoSuaVez({ correta: { arvore: arvore("k = 3") }, arvoreDoPasso: arvore("k = \\resposta{3}"), declaradas: {} }).length, 1);
  // A opção que é só texto com a letra e o número.
  assert.deepEqual(alvosDoSuaVez({ correta: { texto: "$k = 3$" }, declaradas: {} }).map((alvo) => alvo.rotulo), ["k = 3"]);
  assert.deepEqual(alvosDoSuaVez({ correta: { texto: "não existe" }, declaradas: {} }), []);
});

test("o motivo da recusa é uma frase com o campo, o passo, a letra e o valor", () => {
  const [alvo] = alvosDa("y_C = 6");
  assert.equal(
    motivoDoVazamento("texto", alvo, 4),
    'o texto do passo 4 (o "Sua vez") traz o resultado y_C = 6 antes da escolha: a frase só diz o que fazer (como "Agora junte os termos e isole k"), sem o valor nem a conta já feita',
  );
  assert.match(motivoDoVazamento("nome", alvo, 3), /^o nome do passo 3 /);
  assert.match(motivoDoVazamento("pergunta", alvo, 3), /^a pergunta do passo 3 .*a pergunta só pergunta/);
  assert.ok(motivoDoVazamento("texto", alvo, 4).length < 300, "cabe no corte de 300 caracteres da nova tentativa");
});

/* ----- No validador da resolução ----- */

const resolucaoComSuaVez = (suaVez = {}, problema = "Quanto vale $y_C$ se $y_A = 2$, $y_B = 4$ e $y_G = 4$ no baricentro $G$?") => ({
  problema,
  passos: [
    { nome: "A fórmula", texto: "A média das ordenadas dos vértices é a ordenada de $G$.", formula: "y_G = \\frac{y_A + y_B + y_C}{3}" },
    { nome: "Troque os valores", texto: "Coloque os valores conhecidos na fórmula.", formula: "4 = \\frac{2 + 4 + y_C}{3}" },
    {
      nome: "Isole y_C",
      texto: "Agora junte os termos e isole $y_C$.",
      formula: "y_C = 3 \\times 4 - 2 - 4",
      tentativa: {
        pergunta: "Quanto vale $y_C$?",
        opcoes: [
          { formula: "y_C = 3 \\times 4 - 2 - 4", correta: true, porque: "Triplique 4 e tire 2 e 4." },
          { formula: "y_C = 4 + 2 + 4", correta: false, porque: "Isso soma tudo, em vez de isolar." },
          { formula: "y_C = \\frac{2 + 4}{3}", correta: false, porque: "Falta triplicar a média." },
        ],
      },
      ...suaVez,
    },
    { nome: "A resposta", texto: "Então a ordenada procurada está achada.", formula: "y_C = \\resposta{6}" },
  ],
});

test("validarResolucao: a frase que só diz o que fazer vale; a que traz o resultado é recusada com a letra e o valor (texto, nome e pergunta)", () => {
  assert.equal(validarResolucao(resolucaoComSuaVez()).ok, true);
  const recusada = validarResolucao(resolucaoComSuaVez({ texto: "Então $y_C = 6$." }));
  assert.equal(recusada.ok, false);
  assert.equal(recusada.motivo, 'o texto do passo 3 (o "Sua vez") traz o resultado y_C = 6 antes da escolha: a frase só diz o que fazer (como "Agora junte os termos e isole k"), sem o valor nem a conta já feita');
  // A conta feita até o valor, sem a letra no começo.
  assert.match(validarResolucao(resolucaoComSuaVez({ texto: "Faça $3 \\times 4 - 2 - 4 = 6$." })).motivo, /traz o resultado y_C = 6/);
  // O nome do passo e a pergunta também são públicos antes da escolha.
  assert.match(validarResolucao(resolucaoComSuaVez({ nome: "Então y_C = 6" })).motivo, /^o nome do passo 3 \(o "Sua vez"\) traz o resultado y_C = 6/);
  const perguntando = resolucaoComSuaVez();
  perguntando.passos[2].tentativa.pergunta = "Quanto vale $y_C$, sabendo que $y_C = 6$?";
  assert.match(validarResolucao(perguntando).motivo, /^a pergunta do passo 3 \(o "Sua vez"\) traz o resultado y_C = 6/);
  // O que vem depois do "Sua vez" (a frase do passo da resposta) não é conferido: a pessoa já escolheu.
  const depois = resolucaoComSuaVez();
  depois.passos[3].texto = "Então $y_C = 6$.";
  assert.equal(validarResolucao(depois).ok, true);
  // Os outros passos antes do "Sua vez" também não: o recorte é a frase do passo da escolha.
  const antes = resolucaoComSuaVez();
  antes.passos[1].texto = "Os valores dão $y_A + y_B = 6$.";
  assert.equal(validarResolucao(antes).ok, true);
});

test("validarResolucao: o número igual a um dado do problema, a equação da premissa e a outra grandeza não recusam", () => {
  // O problema traz o 12 (um vértice B(12, 5)); a frase pode citá-lo mesmo que a resposta, x_C, valha 12 também.
  const problema = "Com $A(0, 1)$, $B(12, 5)$ e $G(8, 3)$, qual é $x_C$?";
  const base = {
    problema,
    passos: [
      { nome: "A fórmula", texto: "A abscissa do baricentro é a média das abscissas.", formula: "x_G = \\frac{x_A + x_B + x_C}{3}" },
      { nome: "Os valores", texto: "Coloque as abscissas conhecidas na fórmula.", formula: "8 = \\frac{0 + 12 + x_C}{3}" },
      {
        nome: "Isole x_C",
        texto: "Tire de 3 vezes 8 a abscissa 12 de $B$ e a de $A$.",
        formula: "x_C = 3 \\times 8 - 0 - 12",
        tentativa: {
          pergunta: "Quanto vale $x_C$?",
          opcoes: [
            { formula: "x_C = 3 \\times 8 - 0 - 12", correta: true, porque: "24 − 12 = 12." },
            { formula: "x_C = 8 - 0 - 12", correta: false, porque: "Falta triplicar." },
            { formula: "x_C = 3 \\times 8 + 12", correta: false, porque: "Os vértices se subtraem." },
          ],
        },
      },
      { nome: "A resposta", texto: "Achamos a abscissa que faltava.", formula: "x_C = \\resposta{12}" },
    ],
  };
  const lida = validarResolucao(base);
  assert.equal(lida.ok, true, lida.motivo);
  // O mesmo 12, sem o problema trazê-lo, entrega a resposta.
  const semDado = copia(base);
  semDado.problema = "Com $A(0, 1)$, $B(7, 5)$ e $G(8, 3)$, qual é $x_C$?";
  semDado.passos[1].formula = "8 = \\frac{0 + 7 + x_C}{3}";
  semDado.passos[2].formula = "x_C = 3 \\times 8 - 0 - 7";
  semDado.passos[2].tentativa.opcoes[0] = { formula: "x_C = 3 \\times 8 - 0 - 7", correta: true, porque: "24 − 7 = 17." };
  semDado.passos[2].tentativa.opcoes[1] = { formula: "x_C = 8 - 0 - 7", correta: false, porque: "Falta triplicar." };
  semDado.passos[2].tentativa.opcoes[2] = { formula: "x_C = 3 \\times 8 + 7", correta: false, porque: "Os vértices se subtraem." };
  semDado.passos[3].formula = "x_C = \\resposta{17}";
  semDado.passos[2].texto = "Tire de 24 a abscissa 17.";
  assert.equal(validarResolucao(semDado).ok, false, "17 solto, com 2 algarismos e fora do problema");
  semDado.passos[2].texto = "Tire de 3 vezes 8 as abscissas de $A$ e $B$.";
  assert.equal(validarResolucao(semDado).ok, true);
  // A equação com a incógnita, mesmo valendo 0 a resposta, é premissa.
  const zero = resolucaoComSuaVez({}, "Para que valor de $k$ vale a conta?");
  zero.passos = [
    { nome: "A condição", texto: "O determinante tem de ser nulo.", formula: "6 - 6 = 0" },
    { nome: "Junte os termos", texto: "Juntando os termos, $0 - 6k = 0$; isole $k$.", formula: "0 - 6k = 0", tentativa: { pergunta: "Qual é o valor de $k$?", opcoes: [{ formula: "k = 0", correta: true, porque: "-6k = 0 dá k = 0." }, { formula: "k = 6", correta: false, porque: "6 não anula." }, { formula: "k = -6", correta: false, porque: "-6 não anula." }] } },
    { nome: "O valor", texto: "O valor de $k$ está achado.", formula: "k = \\resposta{0}" },
  ];
  const lidaZero = validarResolucao(zero);
  assert.equal(lidaZero.ok, true, lidaZero.motivo);
});

test("o pedido à IA diz que a frase do \"Sua vez\" só apresenta o que fazer, nunca o resultado nem a conta feita", async () => {
  const { instrucoesDeMatematica, instrucoesDeFigurasDoMaterial } = await import("../src/servidor/ia/matematica.ts");
  for (const texto of [instrucoesDeMatematica, instrucoesDeFigurasDoMaterial]) {
    assert.match(texto, /A frase \(texto\) e o nome do passo que tem o "Sua vez" dizem o que fazer \("Agora junte os termos e isole k", "Faça igual com as ordenadas"\)/);
    assert.match(texto, /nunca o resultado nem a conta já feita \(nada de "k = 3", "chega-se a 3", "dá zero"\)/);
    assert.match(texto, /o valor só aparece na formula, nas opções e no porque/);
    assert.match(texto, /O Studoo RECUSA a resolução em que a frase ou o nome desse passo traz o valor/);
  }
});

test("a resolução guardada que entrega no \"Sua vez\" some na leitura (a lição fica com o exemplo em texto) e o que vai pela rede nunca leva fórmula nem desenho do passo", () => {
  const guardada = resolucaoComSuaVez({ texto: "Então $y_C = 6$." });
  assert.equal(normalizarResolucao(guardada), null);
  const boa = normalizarResolucao(resolucaoComSuaVez());
  assert.ok(boa);
  const publica = resolucaoParaCliente(boa);
  const passo = publica.passos.find((p) => p.tentativa);
  assert.equal(passo.formula, undefined);
  assert.equal(passo.texto, "Agora junte os termos e isole $y_C$.");
});
