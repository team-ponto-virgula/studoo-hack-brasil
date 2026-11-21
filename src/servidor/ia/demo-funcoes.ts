import type { PlanoInterno } from "@/dominio/aprendizado/plano";
import { normalizarLicao } from "./comum";
import type { Demo } from "./demos";

/*
 * Trilha pronta do modo demonstração sobre funções (spec 15, seção 15), sem chave da IA: o gráfico da reta, da parábola e do seno, com os pontos de
 * destaque que o servidor calcula (raízes, vértice, intercepto) e o exercício que pergunta um ponto da curva, em que a curva não aparece no enunciado.
 * É a trilha que mostra o gráfico de função de ponta a ponta: o servidor entrega `funcao` a quem anuncia `visuais@2`, o PNG a quem não anuncia nada.
 *
 * O conteúdo está escrito no formato que a IA devolve e passa pela MESMA normalização das lições geradas (`normalizarLicao`): o que não vale some.
 */

const ORIGEM = "Modo demonstração: trilha pronta sobre funções";

type Bruto = Record<string, unknown>;

const opcao = (id: string, texto: string) => ({ id, texto });
const funcao = (alt: string, curvas: Bruto[], pontos: Bruto[]): Bruto => ({ tipo: "funcao", alt, curvas, pontos });

/** A reta g(x) = 2x + 1 de −2 a 2, com o intercepto C e a raiz R (o servidor calcula as posições). */
const reta = (papelDoC: "especial" | "procurado" = "especial"): Bruto =>
  funcao(
    papelDoC === "procurado" ? "A reta g(x) = 2x + 1 e a raiz R. O intercepto é o procurado." : "A reta g(x) = 2x + 1, com o intercepto C e a raiz R.",
    [{ latex: "2x + 1", nome: "g", de: -2, ate: 2 }],
    [{ id: "C", papel: papelDoC, tipo: "intercepto" }, { id: "R", papel: "especial", tipo: "raiz" }],
  );

/** A parábola f(x) = x² − 4x + 3 com as raízes A e B, o vértice V e o intercepto C. */
const parabola = (procurado?: "V" | "C"): Bruto =>
  funcao(
    procurado === "V"
      ? "Parábola de f(x) = x² − 4x + 3, com as raízes A e B e o intercepto C. O vértice é o procurado."
      : procurado === "C"
        ? "Parábola de f(x) = x² − 4x + 3, com as raízes A e B e o vértice V. O intercepto é o procurado."
        : "Parábola de f(x) = x² − 4x + 3, com as raízes A e B, o vértice V e o intercepto C.",
    [{ latex: "x^2 - 4x + 3", nome: "f" }],
    [
      { id: "A", papel: "especial", tipo: "raiz" },
      { id: "B", papel: "especial", tipo: "raiz" },
      { id: "V", papel: procurado === "V" ? "procurado" : "especial", tipo: "vertice" },
      { id: "C", papel: procurado === "C" ? "procurado" : "especial", tipo: "intercepto" },
    ],
  );

/** O seno de 0 a 2π com o máximo M, a raiz P e o mínimo N. */
const seno = (procurado?: "M"): Bruto =>
  funcao(
    procurado === "M" ? "A onda h(x) = sin x de 0 a 2π, com a raiz P e o mínimo N. O máximo é o procurado." : "A onda h(x) = sin x de 0 a 2π, com o máximo M, a raiz P e o mínimo N.",
    [{ latex: "\\sin x", nome: "h", de: 0, ate: "2\\pi" }],
    [
      { id: "M", papel: procurado === "M" ? "procurado" : "especial", x: "\\frac{\\pi}{2}", y: 1 },
      { id: "P", papel: "especial", x: "\\pi", y: 0 },
      { id: "N", papel: "especial", x: "\\frac{3\\pi}{2}", y: -1 },
    ],
  );

const licoes: { titulo: string; bruto: Bruto }[] = [
  {
    titulo: "O gráfico de uma reta",
    bruto: {
      objetivo: "Ler no gráfico de uma reta onde ela corta os eixos.",
      conceito: "A função $g(x) = 2x + 1$ liga cada $x$ a um valor $g(x)$, e o gráfico de todos esses pares é uma reta. Ela corta o eixo $y$ onde $x$ vale 0, e corta o eixo $x$ onde $g(x)$ vale 0.",
      exemplo: "Em $g(x) = 2x + 1$: com $x = 0$, $g(0) = 1$, então a reta corta o eixo $y$ no ponto $C(0, 1)$. Com $g(x) = 0$, $2x + 1 = 0$ e $x = −0{,}5$: ela corta o eixo $x$ no ponto $R(−0{,}5; 0)$.",
      outroJeito: "Pense numa rampa: o número que multiplica o $x$ diz o quanto ela sobe a cada passo para o lado, e o número somado diz de que altura ela sai, em cima do eixo vertical.",
      visuais: [reta()],
      exercicios: [
        {
          tipo: "multipla_escolha",
          enunciado: "Em qual ponto a reta $g(x) = 2x + 1$ corta o eixo $y$?",
          opcoes: [opcao("a", "$(0, 1)$"), opcao("b", "$(1, 0)$"), opcao("c", "$(0, −1)$")],
          gabarito: ["a"],
          feedbackCorreto: "Isso! No eixo $y$ o $x$ vale 0, e $g(0) = 1$.",
          feedbackIncorreto: "O eixo $y$ é onde $x$ vale 0. Calcule $g(0)$ e junte os dois números num par.",
          visual: reta("procurado"),
        },
        {
          tipo: "lacuna",
          enunciado: "Complete a conta da função $g(x) = 2x + 1$.",
          trecho: "O valor de g(3) é ___.",
          trechoTipo: "frase",
          gabarito: ["7"],
          feedbackCorreto: "Isso! $g(3) = 2 \\times 3 + 1 = 7$.",
          feedbackIncorreto: "Troque o $x$ por 3 na expressão e faça a conta: primeiro a multiplicação, depois a soma.",
        },
      ],
    },
  },
  {
    titulo: "A parábola e os seus pontos",
    bruto: {
      objetivo: "Achar no gráfico de uma parábola as raízes, o vértice e o intercepto.",
      conceito: "O gráfico de $f(x) = x^2 − 4x + 3$ é uma parábola. As raízes são os pontos em que ela corta o eixo $x$; o vértice é a ponta, o ponto mais baixo (ou o mais alto); e o intercepto é onde ela corta o eixo $y$.",
      exemplo: "Em $f(x) = x^2 − 4x + 3$: as raízes são $A(1, 0)$ e $B(3, 0)$, porque $1^2 − 4 \\times 1 + 3 = 0$ e $3^2 − 4 \\times 3 + 3 = 0$. O vértice está no meio das raízes, em $V(2, −1)$, e o intercepto é $C(0, 3)$.",
      outroJeito: "Imagine uma tigela vista de frente: ela encosta no chão (o eixo $x$) em dois pontos, as raízes, o fundo da tigela é o vértice, e o intercepto é onde ela cruza a parede vertical.",
      visuais: [{ tipo: "formula", latex: "f(x) = x^2 - 4x + 3", alt: "A função" }, parabola()],
      exercicios: [
        {
          tipo: "multipla_escolha",
          enunciado: "Qual é o vértice da parábola $f(x) = x^2 − 4x + 3$?",
          opcoes: [opcao("a", "$V(2, −1)$"), opcao("b", "$V(−2, 1)$"), opcao("c", "$V(1, 2)$")],
          gabarito: ["a"],
          feedbackCorreto: "Isso! O vértice fica no meio das raízes, em $x = 2$, e $f(2) = −1$.",
          feedbackIncorreto: "O vértice fica no meio das duas raízes. Ache o $x$ do meio e calcule $f$ nele.",
          visual: parabola("V"),
        },
        {
          tipo: "lacuna",
          enunciado: "As raízes de $f(x) = x^2 − 4x + 3$ são 1 e outro número.",
          trecho: "A outra raiz é ___.",
          trechoTipo: "frase",
          gabarito: ["3"],
          feedbackCorreto: "Isso! $f(3) = 9 − 12 + 3 = 0$.",
          feedbackIncorreto: "A raiz é o valor de $x$ que zera a função. Numa parábola assim, as duas raízes somam 4: se uma é 1, quanto falta para 4?",
        },
      ],
    },
  },
  {
    titulo: "Lendo a onda do seno",
    bruto: {
      objetivo: "Ler no gráfico do seno o máximo, o mínimo e onde ele vale zero.",
      conceito: "O gráfico de $h(x) = \\sin x$ é uma onda que sobe e desce entre −1 e 1. Entre 0 e $2\\pi$ ela tem um máximo, um mínimo e vale zero em $0$, $\\pi$ e $2\\pi$. O eixo $x$ se marca de meio em meio $\\pi$.",
      exemplo: "No primeiro ciclo, a onda chega ao máximo $M(π/2, 1)$, volta a zero em $P(π, 0)$ e chega ao mínimo $N(3π/2, −1)$.",
      outroJeito: "Pense numa roda-gigante vista de lado: a altura de uma cabine sobe até o topo, desce até o ponto mais baixo e volta ao meio, sempre no mesmo ritmo.",
      visuais: [seno()],
      exercicios: [
        {
          tipo: "multipla_escolha",
          enunciado: "Qual é o ponto de máximo $M$ da onda $h(x) = \\sin x$ no primeiro ciclo?",
          opcoes: [opcao("a", "$M(π/2, 1)$"), opcao("b", "$M(π, 1)$"), opcao("c", "$M(π/2, 0)$")],
          gabarito: ["a"],
          feedbackCorreto: "Isso! O seno vale 1 quando $x$ é $π/2$.",
          feedbackIncorreto: "O máximo do seno vale 1. Em que ponto do eixo $x$, de meio em meio $π$, a onda chega lá?",
          visual: seno("M"),
        },
        {
          tipo: "verdadeiro_falso",
          enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
          afirmacao: "A onda $h(x) = \\sin x$ passa de 1 em algum ponto.",
          opcoes: [
            opcao("a", "Ela nunca passa de 1: o valor máximo do seno é 1"),
            opcao("b", "Ela passa de 1 perto de $π$"),
            opcao("c", "Ela passa de 1 quando $x$ é grande"),
          ],
          gabarito: ["falso", "a"],
          feedbackCorreto: "O seno sobe e desce entre −1 e 1, por maior que seja o $x$.",
          feedbackIncorreto: "Olhe a altura da onda no gráfico: ela encosta em 1 e volta, sem passar.",
        },
      ],
    },
  },
  {
    titulo: "Revisão: reta, parábola e seno",
    bruto: {
      objetivo: "Reconhecer a reta, a parábola e o seno e ler o que cada gráfico mostra.",
      conceito: "A reta tem a forma $2x + 1$, a parábola leva $x^2$ e o seno é uma onda entre −1 e 1. Em qualquer um deles, o intercepto é onde o gráfico corta o eixo $y$, e as raízes são onde ele corta o eixo $x$.",
      exemplo: "Em $f(x) = x^2 − 4x + 3$, o intercepto é $C(0, 3)$, porque $f(0) = 3$. Na reta $g(x) = 2x + 1$ o intercepto é $(0, 1)$.",
      outroJeito: "Se travar, faça uma tabela com três valores de $x$ e some o que a expressão pede: com esses três pontos, dá para ver se o gráfico é reto, curvo ou uma onda.",
      visuais: [parabola()],
      exercicios: [
        {
          tipo: "multipla_escolha",
          enunciado: "Qual é o intercepto da parábola $f(x) = x^2 − 4x + 3$, o ponto em que ela corta o eixo $y$?",
          opcoes: [opcao("a", "$C(0, 3)$"), opcao("b", "$C(3, 0)$"), opcao("c", "$C(0, −1)$")],
          gabarito: ["a"],
          feedbackCorreto: "Isso! No eixo $y$ o $x$ vale 0, e $f(0) = 3$.",
          feedbackIncorreto: "O eixo $y$ é onde $x$ vale 0. Calcule $f(0)$ e junte os dois números num par.",
          visual: parabola("C"),
        },
      ],
    },
  },
];

function lerLicoes(): PlanoInterno["fluxos"][number]["licoes"] {
  return licoes.flatMap(({ titulo, bruto }) => {
    const { conteudo } = normalizarLicao(bruto, ORIGEM);
    return conteudo ? [{ titulo, ...conteudo }] : [];
  });
}

const prontas = lerLicoes();

export const funcoes: Demo = {
  chave: "funcoes",
  reconhecer: (objetivo) => /\b(?:fun[cç][aã]o|fun[cç][oõ]es|par[aá]bolas?|gr[aá]fico d[aeo]s? (?:fun\w*|reta|par[aá]bola|seno|cosseno)|seno|cosseno)\b/i.test(objetivo),
  plano: {
    titulo: "Funções: o gráfico da reta, da parábola e do seno",
    objetivo: "Ler no gráfico de uma função onde ela corta os eixos, onde fica o vértice e o que a onda do seno mostra.",
    origem: ORIGEM,
    fluxos: [
      { titulo: "Primeiros passos", licoes: prontas.slice(0, 2) },
      { titulo: "Praticando", licoes: prontas.slice(2, 3) },
      { titulo: "Desafio", licoes: prontas.slice(3) },
    ],
  },
};
