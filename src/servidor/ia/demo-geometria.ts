import type { PlanoInterno } from "@/dominio/aprendizado/plano";
import { normalizarLicao } from "./comum";
import { LICAO_ABSCISSAS, LICAO_BARICENTRO, LICAO_COLINEARIDADE } from "./demo-geometria-dados";
import type { Demo } from "./demos";

/*
 * Trilha pronta do modo demonstração sobre geometria analítica (spec 15), sem chave da IA: pontos no plano, ponto médio, baricentro
 * (na reta e no plano) e alinhamento de três pontos. É a trilha que mostra o que o Studoo faz com matemática: as fórmulas e as figuras
 * desenhadas (plano cartesiano e reta numérica, com o ponto procurado escondido até o acerto) e o "Resolva comigo", com a conta
 * conferida pelo servidor.
 *
 * O conteúdo está escrito no formato que a IA devolve (`licoes` abaixo) e passa pela MESMA normalização das lições geradas
 * (`normalizarLicao`): o que não vale some, como numa lição real. Três lições são as das fixtures de teste (`demo-geometria-dados.ts`).
 */

const ORIGEM = "Modo demonstração: trilha pronta sobre geometria analítica";

type Bruto = Record<string, unknown>;

const plano = (alt: string, pontos: Bruto[], extra: Bruto = {}): Bruto => ({ tipo: "plano", alt, pontos, ...extra });

/** O segmento de A (1, 2) a B (5, 8) com o ponto médio M (derivado: o servidor calcula). */
const figuraDoPontoMedio = (papelDoM: "especial" | "resposta"): Bruto =>
  plano("O segmento de A (1, 2) a B (5, 8) no plano, com o ponto médio M.", [
    { id: "A", papel: "dado", x: 1, y: 2 },
    { id: "B", papel: "dado", x: 5, y: 8 },
    { id: "M", papel: papelDoM, derivado: { tipo: "ponto_medio", de: ["A", "B"] } },
  ], { segmentos: [{ de: "A", ate: "B" }] });

const opcao = (id: string, texto: string) => ({ id, texto });

/** Os campos de um exercício que não se aplicam ao tipo ficam de fora (a normalização trata o que falta como nulo). */
const exercicio = (campos: Bruto): Bruto => ({ ...campos });

const licoes: { titulo: string; bruto: Bruto }[] = [
  {
    titulo: "Localizar pontos no plano",
    bruto: {
      objetivo: "Ler e marcar pontos no plano cartesiano pelas coordenadas.",
      conceito: "O plano cartesiano tem dois eixos: o horizontal, $x$ (a abscissa), e o vertical, $y$ (a ordenada). Cada ponto é um par $(x, y)$: primeiro quanto andar para o lado, depois quanto subir ou descer, a partir da origem $O(0, 0)$.",
      exemplo: "O ponto $A(3, 2)$ fica 3 unidades à direita da origem e 2 acima. O ponto $B(−2, 1)$ fica 2 à esquerda e 1 acima.",
      outroJeito: "Pense num mapa de ruas: o primeiro número diz quantos quarteirões você anda para o lado (para a direita se for positivo, para a esquerda se for negativo) e o segundo, quantos você sobe ou desce.",
      visuais: [plano("Os pontos A (3, 2) e B (−2, 1) no plano cartesiano.", [{ id: "A", papel: "dado", x: 3, y: 2 }, { id: "B", papel: "dado", x: -2, y: 1 }])],
      exercicios: [
        exercicio({
          tipo: "multipla_escolha",
          enunciado: "Em qual quadrante fica o ponto $P(−4, 3)$?",
          opcoes: [opcao("a", "Primeiro quadrante"), opcao("b", "Segundo quadrante"), opcao("c", "Terceiro quadrante")],
          gabarito: ["b"],
          feedbackCorreto: "Isso! Abscissa negativa leva para a esquerda e ordenada positiva sobe: é o segundo quadrante.",
          feedbackIncorreto: "Olhe os sinais: $x$ negativo vai para a esquerda e $y$ positivo vai para cima. Em que canto do plano isso cai?",
        }),
        exercicio({
          tipo: "lacuna",
          enunciado: "Complete a frase sobre os eixos.",
          trecho: "Todo ponto sobre o eixo y tem abscissa igual a ___.",
          trechoTipo: "frase",
          gabarito: ["0", "zero"],
          feedbackCorreto: "No eixo vertical não há deslocamento para o lado.",
          feedbackIncorreto: "Sobre o eixo vertical você não anda para a direita nem para a esquerda a partir da origem. Que deslocamento é esse?",
        }),
        exercicio({
          tipo: "verdadeiro_falso",
          enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
          afirmacao: "O ponto $(2, −5)$ fica acima do eixo $x$.",
          opcoes: [
            opcao("a", "A ordenada é negativa, então o ponto fica abaixo do eixo $x$"),
            opcao("b", "A abscissa é positiva, então o ponto sobe"),
            opcao("c", "Todo ponto com abscissa positiva fica acima do eixo $x$"),
          ],
          gabarito: ["falso", "a"],
          feedbackCorreto: "A ordenada diz se o ponto está acima (positiva) ou abaixo (negativa) do eixo horizontal.",
          feedbackIncorreto: "Compare a ordenada com zero: ela diz se o ponto sobe ou desce em relação ao eixo horizontal.",
        }),
      ],
    },
  },
  {
    titulo: "Ponto médio de um segmento",
    bruto: {
      objetivo: "Achar o ponto médio de um segmento a partir das coordenadas das pontas.",
      conceito: "O ponto médio $M$ de um segmento $AB$ tem como coordenadas a média das coordenadas das pontas: $x_M = (x_A + x_B) / 2$ e $y_M = (y_A + y_B) / 2$.",
      exemplo: "Com $A(1, 2)$ e $B(5, 8)$: $x_M = (1 + 5) / 2 = 3$ e $y_M = (2 + 8) / 2 = 5$. O ponto médio é $M(3, 5)$.",
      outroJeito: "É o ponto que fica no meio do caminho: a média de duas posições, uma para o lado e outra para cima.",
      visuais: [{ tipo: "formula", latex: "x_M = \\frac{x_A + x_B}{2}", alt: "Fórmula do ponto médio" }, figuraDoPontoMedio("especial")],
      resolucao: {
        problema: "Qual é o ponto médio do segmento de $A(1, 2)$ a $B(5, 8)$?",
        visual: figuraDoPontoMedio("especial"),
        passos: [
          { nome: "A fórmula", texto: "O ponto médio tem a média das abscissas e a média das ordenadas.", formula: "x_M = \\foco{\\frac{x_A + x_B}{2}}" },
          { nome: "Troque os valores", texto: "Coloque as abscissas de A e de B na fórmula.", formula: "x_M = \\frac{1 + 5}{2}" },
          { nome: "Calcule x", texto: "Some as abscissas e divida por 2.", formula: "x_M = \\frac{6}{2} = \\foco{3}" },
          {
            nome: "O mesmo para y",
            texto: "Faça igual com as ordenadas de A e de B.",
            formula: "y_M = \\frac{2 + 8}{2}",
            tentativa: {
              pergunta: "Quanto vale y_M?",
              opcoes: [
                { formula: "y_M = \\frac{10}{2}", correta: true, porque: "(2 + 8) ÷ 2 = 10 ÷ 2 = 5." },
                { formula: "y_M = 2 + 8", correta: false, porque: "10 é a soma das ordenadas: falta dividir por 2." },
                { formula: "y_M = \\frac{2 + 8}{4}", correta: false, porque: "Divide-se por 2, o número de pontos, e não por 4." },
              ],
            },
          },
          { nome: "O ponto M", texto: "Então M tem abscissa 3 e ordenada 5.", formula: "M = \\resposta{(3, 5)}", visual: figuraDoPontoMedio("resposta") },
        ],
      },
      exercicios: [
        exercicio({
          tipo: "multipla_escolha",
          enunciado: "Qual é o ponto médio do segmento de $A(2, 4)$ a $B(6, 10)$?",
          opcoes: [opcao("a", "$(4, 7)$"), opcao("b", "$(8, 14)$"), opcao("c", "$(4, 6)$")],
          gabarito: ["a"],
          feedbackCorreto: "Isso! $(2 + 6) / 2 = 4$ e $(4 + 10) / 2 = 7$.",
          feedbackIncorreto: "O ponto médio é a média das coordenadas: some as abscissas e divida pela quantidade de pontos; faça o mesmo com as ordenadas.",
          visual: plano("Os pontos A (2, 4) e B (6, 10) no plano; M é o ponto médio procurado.", [
            { id: "A", papel: "dado", x: 2, y: 4 },
            { id: "B", papel: "dado", x: 6, y: 10 },
            { id: "M", papel: "procurado", x: 4, y: 7 },
          ], { segmentos: [{ de: "A", ate: "B" }] }),
        }),
        exercicio({
          tipo: "lacuna",
          enunciado: "Complete o cálculo da abscissa do ponto médio de $A(2, 4)$ e $B(6, 10)$.",
          trecho: "Soma-se 2 + 6 e divide-se o resultado por ___.",
          trechoTipo: "frase",
          gabarito: ["2", "dois"],
          feedbackCorreto: "Isso! A média de dois valores divide a soma por 2.",
          feedbackIncorreto: "Pense em quantos valores você está juntando: a média divide a soma pelo total de valores.",
        }),
      ],
    },
  },
  {
    titulo: LICAO_ABSCISSAS.titulo as string,
    bruto: {
      ...LICAO_ABSCISSAS,
      exercicio: undefined,
      outroJeito: "Imagine três amigos numa fila numerada: o baricentro é o lugar onde o grupo se equilibra. Se você sabe o ponto de equilíbrio e a posição de dois amigos, o terceiro tem de estar onde fecha a conta.",
      exercicios: [
        LICAO_ABSCISSAS.exercicio,
        exercicio({
          tipo: "lacuna",
          enunciado: "Complete a conta da abscissa que falta.",
          trecho: "Com xA = 3, xB = 5 e xG = 4, vale xC = 3 · 4 − 3 − 5 = ___.",
          trechoTipo: "frase",
          gabarito: ["4"],
          feedbackCorreto: "Isso! Triplicando a abscissa do baricentro e tirando as outras duas, sobra a que faltava.",
          feedbackIncorreto: "Multiplique a abscissa do baricentro por 3 e subtraia as outras duas abscissas: o que sobra?",
        }),
      ],
    },
  },
  {
    titulo: LICAO_BARICENTRO.titulo as string,
    bruto: {
      ...LICAO_BARICENTRO,
      exercicio: undefined,
      outroJeito: "Pense numa gangorra com três pessoas: o baricentro é o ponto de apoio. Se você já sabe onde ficam o apoio e duas pessoas, a terceira tem de ficar no lugar que equilibra: some e subtraia as coordenadas até fechar a conta.",
      exercicios: [
        LICAO_BARICENTRO.exercicio,
        exercicio({
          tipo: "verdadeiro_falso",
          enunciado: "A frase é verdadeira ou falsa? Escolha também o porquê.",
          afirmacao: "O baricentro de um triângulo fica sempre dentro do triângulo.",
          opcoes: [
            opcao("a", "Ele é a média das coordenadas dos vértices, então cai no interior do triângulo"),
            opcao("b", "Ele fica sempre sobre um dos lados do triângulo"),
            opcao("c", "Ele cai fora do triângulo quando o triângulo é muito inclinado"),
          ],
          gabarito: ["verdadeiro", "a"],
          feedbackCorreto: "As medianas ficam dentro do triângulo, e o baricentro é o encontro delas.",
          feedbackIncorreto: "Lembre que o baricentro é o encontro das medianas: onde elas ficam em relação ao triângulo?",
        }),
      ],
    },
  },
  {
    titulo: LICAO_COLINEARIDADE.titulo as string,
    bruto: {
      ...LICAO_COLINEARIDADE,
      exercicio: undefined,
      outroJeito: "Três pontos alinhados cabem numa régua. O determinante mede a área do triângulo que eles formariam: se ela é nula, o triângulo achatou numa reta.",
      exercicios: [
        LICAO_COLINEARIDADE.exercicio,
        exercicio({
          tipo: "lacuna",
          enunciado: "Complete a condição de alinhamento.",
          trecho: "Se o determinante das coordenadas de três pontos vale ___, os pontos estão alinhados.",
          trechoTipo: "frase",
          gabarito: ["0", "zero"],
          feedbackCorreto: "Isso! Determinante nulo quer dizer triângulo sem área: os três pontos estão numa mesma reta.",
          feedbackIncorreto: "O alinhamento corresponde a um triângulo achatado, sem área. Que valor tem a área nesse caso?",
        }),
      ],
    },
  },
  {
    titulo: "Revisão: ponto médio, baricentro e alinhamento",
    bruto: {
      objetivo: "Juntar ponto médio, baricentro e alinhamento na resolução de um problema.",
      conceito: "Três ideias resolvem a maioria dos problemas: o ponto médio é a média de duas coordenadas, o baricentro é a média de três e três pontos estão alinhados quando o determinante é zero. Em todas, você trabalha com $x$ e $y$ separados.",
      exemplo: "Com $A(0, 0)$ e $B(4, 2)$, o ponto médio é $M(2, 1)$. Como $M$ está no segmento $AB$, os pontos $A$, $M$ e $B$ estão alinhados.",
      outroJeito: "Se travar, desenhe os pontos: ver o segmento no plano ajuda a decidir se a média cai no meio e se os pontos ficam na mesma linha.",
      visuais: [
        plano("O segmento de A (0, 0) a B (4, 2) e o ponto médio M (2, 1) sobre ele.", [
          { id: "A", papel: "dado", x: 0, y: 0 },
          { id: "B", papel: "dado", x: 4, y: 2 },
          { id: "M", papel: "especial", derivado: { tipo: "ponto_medio", de: ["A", "B"] } },
        ], { segmentos: [{ de: "A", ate: "B" }] }),
      ],
      exercicios: [
        exercicio({
          tipo: "aberta",
          enunciado: "Explique, com suas palavras, como achar o ponto médio de um segmento e como o baricentro de um triângulo se parece com ele.",
          gabarito: ["media|metade|meio", "coordenad|abscissa|ordenada", "tres|3|triangulo|vertices"],
          criterios: [{ texto: "Fala em média ou no meio do segmento", essencial: true }, { texto: "Diz que usa as coordenadas", essencial: false }, { texto: "Cita os três vértices do baricentro", essencial: false }],
          modelo: "O ponto médio é a média das coordenadas das duas pontas: soma-se as abscissas e divide-se por 2, e o mesmo com as ordenadas. O baricentro faz igual com os três vértices, somando e dividindo por 3.",
          feedbackCorreto: "Você ligou as duas ideias: as duas são médias de coordenadas.",
          feedbackIncorreto: "Faltou algo: diga que as coordenadas são somadas e divididas pelo número de pontos (dois, no ponto médio; três, no baricentro).",
        }),
        exercicio({
          tipo: "multipla_escolha",
          enunciado: "Qual é o ponto médio do segmento de $A(0, 0)$ a $B(6, 4)$?",
          opcoes: [opcao("a", "$(3, 2)$"), opcao("b", "$(6, 4)$"), opcao("c", "$(3, 4)$")],
          gabarito: ["a"],
          feedbackCorreto: "Isso! A média de 0 e 6 é 3, e a de 0 e 4 é 2.",
          feedbackIncorreto: "Calcule a média das abscissas e, separadamente, a média das ordenadas.",
        }),
        exercicio({
          tipo: "ordenar",
          enunciado: "Coloque os passos para achar o baricentro de um triângulo na ordem.",
          itens: [
            opcao("i1", "Anote as coordenadas dos três vértices"),
            opcao("i2", "Some as três abscissas e divida por 3"),
            opcao("i3", "Some as três ordenadas e divida por 3"),
            opcao("i4", "Escreva o ponto G com os dois resultados"),
          ],
          gabarito: [],
          feedbackCorreto: "Primeiro os dados, depois cada média, e só então o ponto.",
          feedbackIncorreto: "Comece pelos dados que você tem, calcule uma média de cada vez e deixe o ponto final para o fim.",
        }),
      ],
    },
  },
];

/**
 * As lições no formato interno. Cada uma passa por `normalizarLicao`, como a que a IA devolve; uma que não fechasse sairia da trilha em
 * vez de derrubar a demonstração (o teste garante que as seis fecham, com as figuras e as resoluções).
 */
function lerLicoes(): PlanoInterno["fluxos"][number]["licoes"] {
  return licoes.flatMap(({ titulo, bruto }) => {
    const { conteudo } = normalizarLicao(bruto, ORIGEM);
    return conteudo ? [{ titulo, ...conteudo }] : [];
  });
}

const prontas = lerLicoes();

export const geometria: Demo = {
  chave: "geometria",
  reconhecer: (objetivo) => /\b(?:geometria anal[ií]tica|baricentro|ponto m[eé]dio|plano cartesiano|colinear\w*)\b/i.test(objetivo),
  plano: {
    titulo: "Geometria analítica: do ponto ao alinhamento",
    objetivo: "Usar coordenadas para achar pontos médios e baricentros e decidir se três pontos estão alinhados.",
    origem: ORIGEM,
    fluxos: [
      { titulo: "Primeiros passos", licoes: prontas.slice(0, 2) },
      { titulo: "Praticando", licoes: prontas.slice(2, 4) },
      { titulo: "Desafio", licoes: prontas.slice(4) },
    ],
  },
};
