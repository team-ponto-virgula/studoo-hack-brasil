/*
 * Matemática nos geradores (spec 15): só as lições de matemática ganham o bloco de notação, o esquema com visuais e o exemplo de
 * resolução; as outras usam exatamente o prompt e o esquema de sempre. O assunto vem do título, do objetivo e do conceito: uma
 * regra de palavras, sem chamada extra à IA.
 */

const PALAVRAS_DE_MATEMATICA = [
  "matematica", "geometria", "algebra", "aritmetica", "trigonometria", "calculo", "equacao", "equacoes", "inequacao", "inequacoes",
  "fracao", "fracoes", "porcentagem", "probabilidade", "estatistica", "derivada", "derivadas", "integral", "integrais", "logaritmo",
  "logaritmos", "polinomio", "polinomios", "matriz", "matrizes", "determinante", "determinantes", "vetor", "vetores", "baricentro",
  "plano cartesiano", "coordenada", "coordenadas", "reta numerica", "bhaskara", "pitagoras", "seno", "cosseno", "tangente",
  "raiz quadrada", "potenciacao", "ponto medio", "colinear", "colineares", "colinearidade", "circunferencia", "parabola",
  "funcao afim", "funcao quadratica", "funcao linear", "funcao exponencial", "funcao logaritmica", "funcao polinomial",
  "funcao do 1", "funcao do 2", "funcao do primeiro grau", "funcao do segundo grau", "sistema linear", "sistemas lineares",
];

const SEM_ACENTO = (texto: string) => texto.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
const REGRA = new RegExp(`(?<![a-z0-9])(?:${PALAVRAS_DE_MATEMATICA.join("|")})(?![a-z0-9])`);

/** O texto (título, objetivo, conceito, o material lido) fala de matemática? */
export function ehAssuntoDeMatematica(...textos: (string | undefined)[]): boolean {
  return REGRA.test(SEM_ACENTO(textos.filter(Boolean).join(" ")));
}
