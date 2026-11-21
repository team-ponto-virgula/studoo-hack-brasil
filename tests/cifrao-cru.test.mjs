import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contemMarcaDeFormula,
  desenharVisual,
  falarTextoComFormulas,
  marcarFormulasSoltas,
  normalizarTextoComFormulas,
  normalizarVisual,
  partirTextoComFormulas,
  textoSemFormulas,
} from "@studoo/contratos";
import { comFormulasMarcadas, comFormulasParaOCliente, comTextoLinear, conteudoEhDeMatematica } from "../src/servidor/aprendizado/visuais.ts";

/*
 * Marco 11: cifrão cru na tela. A IA abriu a fórmula, deixou a lacuna de fora e pôs o espaço dentro (`$h = $ ___`): o cifrão que fecha vinha
 * depois de um espaço, não pareava, e os dois `$` iam crus para o site e para o build 3 (lição 9 da trilha "Trigonometria", prova real
 * d77bfe1). Agora o fecho depois de espaço vale quando o que está dentro é uma conta (lê e tem sinal) ou uma conta começada (termina num
 * sinal); a começada vira texto ("h = ___"), a que lê continua desenhada; dinheiro, `$` solto e `$HOME e $PATH` não pareiam.
 * O mesmo marco tira do motor o número em foco que o ponto sobre o eixo tapava pela metade (o "3" atrás do C).
 */

/** O enunciado da lacuna como a IA real o escreveu (lição 9, exercício 2 da trilha 4 da prova real d77bfe1). */
const ENUNCIADO_REAL = "Uma escada de 13 m está apoiada numa parede e o pé fica a 5 m dela. A altura alcançada é o cateto que falta: 5² + h² = 13², então h² = 144 e $h = $ ___.";
const SEM_CIFRAO = "Uma escada de 13 m está apoiada numa parede e o pé fica a 5 m dela. A altura alcançada é o cateto que falta: 5² + h² = 13², então h² = 144 e h = ___.";

/** Todo caminho que um texto de lição percorre até a tela, e o que sai de cada um. */
const CAMINHOS = {
  "texto linear (cliente antigo)": textoSemFormulas,
  "texto guardado (o servidor ao gerar)": normalizarTextoComFormulas,
  "texto marcado (cliente que desenha)": marcarFormulasSoltas,
  "partes do cliente, só o texto": (texto) => partirTextoComFormulas(texto).map((parte) => (parte.tipo === "texto" ? parte.texto : parte.linear)).join(""),
};

test("o enunciado da prova real: `$h = $ ___` vira \"h = ___\", sem cifrão, em todo caminho até a tela", () => {
  for (const [nome, caminho] of Object.entries(CAMINHOS)) {
    assert.equal(caminho(ENUNCIADO_REAL), SEM_CIFRAO, nome);
  }
  assert.equal(contemMarcaDeFormula(ENUNCIADO_REAL), true, "o par é reconhecido (é o que faz o servidor converter o texto)");
  assert.equal(falarTextoComFormulas(ENUNCIADO_REAL).includes("$"), false, "o leitor de tela também não lê cifrão");
  // O espaço dentro não vira espaço duplo, e a lacuna fica onde estava.
  assert.equal(textoSemFormulas("e $h = $ ___."), "e h = ___.");
  assert.equal(textoSemFormulas("$h =$ ___"), "h = ___", "e sem o espaço dentro, que já fechava (antes virava uma fórmula \"h =\" solta no meio do texto)");
  assert.equal(textoSemFormulas(String.raw`$3 \times $ ___ = 12`), "3 × ___ = 12", "o comando de multiplicar também termina em sinal");
});

test("a lição de matemática do servidor: o enunciado, as opções, a dica e o retorno saem sem cifrão cru para quem desenha e para quem não desenha", () => {
  const lacuna = {
    tipo: "lacuna",
    enunciado: ENUNCIADO_REAL,
    contexto: "Complete: $x + $ ___",
    opcoes: [{ id: "a", texto: "$h = $ 12" }, { id: "b", texto: "$h = 12$" }],
    dica: "Isole $h = $ ___ primeiro.",
  };
  const conteudo = { titulo: "Revisão: aplicações em problemas", objetivo: "Resolver problemas com Pitágoras, seno, cosseno e tangente.", conceito: "No triângulo retângulo, a hipotenusa é a maior.", exemplo: "Com $a = 3$ e $b = 4$, $c = 5$.", exercicio: lacuna };
  assert.equal(conteudoEhDeMatematica(conteudo), true);
  const retorno = { correta: false, feedback: "Quase: a conta é $h = $ ___ e depois a raiz.", observacao: "Veja $h^2 = $ 144." };
  for (const [nome, converter] of Object.entries({ "sem cabeçalho": (valor) => comTextoLinear(valor), "com visuais@1": (valor) => comFormulasMarcadas(valor) })) {
    const saida = JSON.stringify(converter(lacuna)) + JSON.stringify(converter(retorno));
    assert.equal(saida.includes("$h = $"), false, `${nome}: o cifrão da lacuna sobrou`);
    assert.equal(/\$[hx]\b/.test(saida.replace(/\$\{/g, "")) && !/\$(?:a|h) = (?:12|3)\$/.test(saida), false, `${nome}: cifrão aberto sobrou: ${saida.slice(0, 160)}`);
    assert.match(saida, /h = ___/, `${nome}: o texto segue legível`);
    assert.match(saida, /x \+ ___/, `${nome}: a conta começada do contexto também vira texto`);
  }
  // A mesma conversão que o servidor faz na hora de entregar (buscarLicao e avaliar): só em lição de matemática, e o retorno também.
  const entregue = comFormulasParaOCliente(retorno, conteudo, { visuais: 0, resolucao: 0 });
  assert.equal(entregue.feedback, "Quase: a conta é h = ___ e depois a raiz.");
  assert.equal(entregue.observacao, "Veja h² = 144.", "a conta começada ($h^2 = $ 144) também sai em texto, sem cifrão");
  // O resto do texto da lição fica como estava: a fórmula que vale segue marcada para quem desenha.
  assert.match(comFormulasMarcadas(conteudo).exemplo, /\$a = 3\$ e \$b = 4\$, \$c = 5\$/);
});

test("dinheiro não é marcador e fica: R$ 25,00, US$10, `$ 5`, \"custa $5 e $10\" e \"$500 e o capacete $ 80\"", () => {
  for (const texto of [
    "A reforma custa R$ 25,00 mil e a tinta, R$ 3,50.",
    "Gastei R$ 5,00 e depois R$ 10,00.",
    "O livro custa US$10 e o outro $ 5 hoje.",
    "custa $5 e $10 por kg",
    "A bicicleta custa $500 e o capacete $ 80.",
    "Pague R$25 ou 2x de R$ 13.",
  ]) {
    for (const [nome, caminho] of Object.entries(CAMINHOS)) assert.equal(caminho(texto), texto, `${nome}: ${texto}`);
    assert.equal(contemMarcaDeFormula(texto), false, texto);
  }
});

test("`$` solto sem par não vira marcador: fica no texto e não pareia com o cifrão de uma fórmula depois dele", () => {
  const texto = "O símbolo $ aparece sozinho e depois vale $x_G = 1$ para o baricentro.";
  assert.equal(textoSemFormulas(texto), "O símbolo $ aparece sozinho e depois vale x_G = 1 para o baricentro.");
  const partes = partirTextoComFormulas(texto);
  assert.deepEqual(partes.map((parte) => parte.tipo), ["texto", "formula", "texto"]);
  assert.equal(partes[0].texto, "O símbolo $ aparece sozinho e depois vale ", "o cifrão solto fica no texto");
  assert.equal(partes[1].latex, "x_G = 1");
  // Um só cifrão, sem nenhum par.
  assert.equal(textoSemFormulas("Só um $ aqui."), "Só um $ aqui.");
  assert.equal(textoSemFormulas("Só um $h aqui."), "Só um $h aqui.");
});

test("a fórmula válida continua desenhada, e dois pares na mesma frase valem cada um por si; a completa com espaço antes do fecho segue sem par, como sempre foi", () => {
  const formula = partirTextoComFormulas("Vale $x_G = (x_A + x_B + x_C) / 3$ aqui.").find((parte) => parte.tipo === "formula");
  assert.ok(formula, "a fórmula marcada normalmente");
  assert.equal(formula.latex, String.raw`x_G = (x_A + x_B + x_C) \div 3`, "a forma canônica da fórmula");
  // Dois pares: a conta começada vira texto e a completa segue fórmula.
  const dois = partirTextoComFormulas("Então $x = $ ___ e $y = 2$ no fim.");
  assert.deepEqual(dois.map((parte) => parte.tipo), ["texto", "formula", "texto"]);
  assert.equal(dois[0].texto, "Então x = ___ e ");
  assert.equal(dois[1].latex, "y = 2");
  assert.equal(normalizarTextoComFormulas("Então $x = $ ___ e $y = 2$ no fim."), "Então x = ___ e $y = 2$ no fim.");
  // Dois pares começados na mesma frase, e um completo no meio.
  assert.equal(normalizarTextoComFormulas("De $a + $ ___ e $b = 2$ sai $c \\times $ ___."), "De a + ___ e $b = 2$ sai c × ___.");
  // A fórmula completa com espaço antes do fecho não é par (nem antes do marco 11): o texto passa como estava.
  assert.equal(textoSemFormulas("$x_G $ e $x_G$a"), "$x_G $ e $x_G$a");
  assert.equal(textoSemFormulas("$ x$ e $x $"), "$ x$ e $x $");
});

test("o cifrão de um comando de shell não pareia (`$HOME e $PATH`): depois de espaço, só fecha a conta começada", () => {
  for (const texto of ["Em shell, use $HOME e $PATH.", "O arquivo fica em $HOME/bin e em $PATH depois.", "echo $a e $ b"]) {
    assert.equal(textoSemFormulas(texto), texto, texto);
    assert.equal(contemMarcaDeFormula(texto), false, texto);
  }
});

test("o ponto sobre o eixo não tapa o número em foco da guia (o \"3\" atrás do C da prova real): o foco sai, o ponto e o rótulo dele ficam", () => {
  const plano = (c) => normalizarVisual({
    tipo: "plano", alt: "A parábola com A, B, V e o ponto C.",
    pontos: [
      { id: "A", papel: "dado", x: 1, y: 0 }, { id: "B", papel: "dado", x: 3, y: 0 }, { id: "V", papel: "dado", x: 2, y: -1 }, { id: "C", papel: "especial", x: c[0], y: c[1] },
    ],
    guias: [{ ponto: "C", eixo: "y" }],
  });
  const caixasDoNumero = (desenho, texto) => desenho.caixas.filter((caixa) => (caixa.tipo === "foco" || caixa.tipo === "numero") && caixa.texto === texto);
  // C (0, 3) está sobre o eixo y: o losango cobre o número 3 que a guia poria em foco (e o número 3 do eixo, que já saía por cobrir).
  const sobreOEixo = desenharVisual(plano([0, 3]), { tipo: "enunciado" });
  const tres = caixasDoNumero(sobreOEixo, "3");
  assert.equal(tres.length, 1, "só o 3 do eixo x (debaixo de B): o do eixo y e o foco da guia, tapados pelo losango de C, saíram");
  assert.equal(tres[0].tipo, "numero");
  assert.equal(sobreOEixo.caixas.some((caixa) => caixa.tipo === "foco"), false, "nenhuma caixa de foco solta");
  assert.ok(sobreOEixo.caixas.some((caixa) => caixa.tipo === "rotulo" && caixa.texto.includes("C (0, 3)")), "o rótulo do ponto diz o valor");
  // C (2, 3), longe do eixo: o foco continua onde estava, e o número em foco não é coberto por nada.
  const longe = desenharVisual(plano([2, 3]), { tipo: "enunciado" });
  assert.equal(caixasDoNumero(longe, "3").filter((caixa) => caixa.tipo === "foco").length, 1, "o foco da guia segue");
  // Em nenhuma figura, o círculo de um ponto cobre a caixa de um número (de eixo ou em foco).
  for (const desenho of [sobreOEixo, longe]) {
    const pontos = desenho.primitivas.filter((primitiva) => primitiva.m === "circulo" && primitiva.preenchimento !== undefined);
    for (const caixa of desenho.caixas.filter((item) => item.tipo === "numero" || item.tipo === "foco")) {
      for (const ponto of pontos) {
        const dx = Math.max(caixa.x - ponto.cx, 0, ponto.cx - (caixa.x + caixa.largura));
        const dy = Math.max(caixa.y - ponto.cy, 0, ponto.cy - (caixa.y + caixa.altura));
        assert.ok(Math.hypot(dx, dy) >= ponto.raio, `o número ${caixa.texto} fica fora da bolinha em (${ponto.cx}, ${ponto.cy})`);
      }
    }
  }
});
