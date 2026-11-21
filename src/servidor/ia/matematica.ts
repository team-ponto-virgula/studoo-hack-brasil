import {
  LIMITES_VISUAIS,
  validarResolucao,
  validarVisual,
  type ResolucaoGuardada,
  type Visual,
  type VisualFigura,
} from "@studoo/contratos";
import type { EsqueletoPlano } from "@/dominio/aprendizado/plano";

/*
 * Matemática nos geradores (spec 15): só as lições de matemática ganham o bloco de notação, o esquema com visuais e o exemplo de
 * resolução; as outras usam exatamente o prompt e o esquema de sempre. O assunto vem do título, do objetivo e do conceito: uma
 * regra de palavras, sem chamada extra à IA.
 *
 * A IA nunca desenha: ela devolve os DADOS (pontos, segmentos, fórmulas em LaTeX restrito, a resolução em passos) e o Studoo valida
 * (`@studoo/contratos`: `normalizarVisuais`, `normalizarResolucao`, a conta conferida), ajusta o que dá, calcula os pontos derivados
 * e desenha. O que não vale some e a lição fica. Aqui ficam o assunto, o bloco de instruções, o esquema do que o modelo devolve (um
 * objeto "achatado", com todos os campos e `null` onde não se aplica, como o Structured Outputs da OpenAI pede) e o caminho de volta
 * para o formato do contrato.
 */

const PALAVRAS_DE_MATEMATICA = [
  "matematica", "geometria", "algebra", "aritmetica", "trigonometria", "calculo", "equacao", "equacoes", "inequacao", "inequacoes",
  "fracao", "fracoes", "porcentagem", "probabilidade", "estatistica", "derivada", "derivadas", "integral", "integrais", "logaritmo",
  "logaritmos", "polinomio", "polinomios", "matriz", "matrizes", "determinante", "determinantes", "vetor", "vetores", "baricentro",
  "plano cartesiano", "coordenada", "coordenadas", "reta numerica", "bhaskara", "pitagoras", "seno", "cosseno", "tangente",
  "raiz quadrada", "potenciacao", "ponto medio", "colinear", "colineares", "colinearidade", "circunferencia", "parabola",
  "funcao afim", "funcao quadratica", "funcao linear", "funcao exponencial", "funcao logaritmica", "funcao polinomial",
  "funcoes afins", "funcoes quadraticas", "funcoes lineares", "funcoes exponenciais", "funcoes logaritmicas", "funcoes polinomiais",
  "funcao do 1", "funcao do 2", "funcoes do 1", "funcoes do 2", "funcao do primeiro grau", "funcao do segundo grau",
  "funcoes do primeiro grau", "funcoes do segundo grau", "sistema linear", "sistemas lineares",
];

const SEM_ACENTO = (texto: string) => texto.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
const REGRA = new RegExp(`(?<![a-z0-9])(?:${PALAVRAS_DE_MATEMATICA.join("|")})(?![a-z0-9])`);

/** O texto (título, objetivo, conceito, o material lido) fala de matemática? */
export function ehAssuntoDeMatematica(...textos: (string | undefined)[]): boolean {
  return REGRA.test(SEM_ACENTO(textos.filter(Boolean).join(" ")));
}

/** Quantas vezes o texto cita um termo de matemática (para decidir se um material inteiro, de muitas páginas, é de matemática). */
export function citacoesDeMatematica(...textos: (string | undefined)[]): number {
  return SEM_ACENTO(textos.filter(Boolean).join(" ")).match(new RegExp(REGRA.source, "g"))?.length ?? 0;
}

/** A lição do plano é de matemática? O título e o objetivo da trilha e o título e o resumo da lição dizem; é uma regra de palavras, sem IA. */
export function licaoEhDeMatematica(esqueleto: EsqueletoPlano, fluxo: number, licao: number): boolean {
  const alvo = esqueleto.fluxos[fluxo]?.licoes[licao];
  return ehAssuntoDeMatematica(esqueleto.titulo, esqueleto.objetivo, alvo?.titulo, alvo?.resumo);
}

/**
 * O material (folha de exercícios, caderno) é de matemática? O objetivo e o nome dizem, ou o texto das páginas cita termos da área
 * ao menos 3 vezes (um "seno" solto numa apostila de outra coisa não basta).
 */
export function materialEhDeMatematica(objetivo: string, nome: string, paginas: { texto: string }[]): boolean {
  return ehAssuntoDeMatematica(objetivo, nome) || citacoesDeMatematica(...paginas.map((pagina) => pagina.texto)) >= 3;
}

/* ----- O que o modelo devolve → o formato do contrato ----- */

/** O valor sem os campos `null` (o modelo manda `null` onde o campo não se aplica): o contrato lê "ausente", não "nulo". */
export function semNulos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(semNulos);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(Object.entries(valor as Record<string, unknown>).flatMap(([campo, item]) => (item === null || item === undefined ? [] : [[campo, semNulos(item)]])));
  }
  return valor;
}

/** O que a matemática de uma lição deu, para o registro (só contagens: os motivos citam fórmulas) e para o teste com IA real. */
export type RelatoDaMatematica = {
  visuais: { enviados: number; aceitos: number };
  /** A figura do enunciado de cada exercício. */
  figuras: { enviadas: number; aceitas: number };
  resolucao: { enviada: boolean; aceita: boolean; conferidas?: number; puladas?: number };
  /** Por que cada coisa recusada foi recusada (o texto do validador). Não vai para o registro do servidor. */
  motivos: string[];
};

/** Junta o que os três validadores disseram num relato, ou `undefined` quando o modelo não mandou nada de matemática. */
export function relatoDaMatematica(
  visuais: ReturnType<typeof lerVisuaisDoModelo>,
  figuras: { onde: string; enviada: boolean; aceita: boolean; motivo?: string }[],
  resolucao: ReturnType<typeof lerResolucaoDoModelo>,
): RelatoDaMatematica | undefined {
  const enviadas = figuras.filter((figura) => figura.enviada);
  if (visuais.enviados === 0 && enviadas.length === 0 && !resolucao.enviada) return undefined;
  return {
    visuais: { enviados: visuais.enviados, aceitos: visuais.visuais?.length ?? 0 },
    figuras: { enviadas: enviadas.length, aceitas: enviadas.filter((figura) => figura.aceita).length },
    resolucao: { enviada: resolucao.enviada, aceita: resolucao.resolucao !== undefined, ...(resolucao.conta ?? {}) },
    motivos: [
      ...visuais.motivos,
      ...enviadas.flatMap((figura) => (figura.motivo ? [`${figura.onde}.visual: ${figura.motivo}`] : [])),
      ...(resolucao.motivo ? [`resolucao: ${resolucao.motivo}`] : []),
    ],
  };
}

/** O relato em contagens, para o registro do servidor (sem os motivos, que citam fórmulas). */
export function contagensDoRelato(relato: RelatoDaMatematica): { visuais: string; figuras: string; resolucao: "aceita" | "recusada" | "sem" } {
  return {
    visuais: `${relato.visuais.aceitos}/${relato.visuais.enviados}`,
    figuras: `${relato.figuras.aceitas}/${relato.figuras.enviadas}`,
    resolucao: relato.resolucao.enviada ? (relato.resolucao.aceita ? "aceita" : "recusada") : "sem",
  };
}

/** Os visuais da lição (até 3: fórmula, plano, reta numérica), cada um validado sozinho: o que não vale some e a lição fica. */
export function lerVisuaisDoModelo(valor: unknown): { visuais: Visual[] | undefined; enviados: number; motivos: string[] } {
  if (!Array.isArray(valor)) return { visuais: undefined, enviados: 0, motivos: [] };
  const brutos = semNulos(valor) as unknown[];
  const visuais: Visual[] = [];
  const motivos: string[] = [];
  brutos.forEach((bruto, posicao) => {
    const lido = validarVisual(bruto);
    if (!lido.ok) motivos.push(`visuais[${posicao}]: ${lido.motivo}`);
    else if (visuais.length < LIMITES_VISUAIS.visuaisPorLicao) visuais.push(lido.visual);
    else motivos.push(`visuais[${posicao}]: passa de ${LIMITES_VISUAIS.visuaisPorLicao} visuais por lição`);
  });
  return { visuais: visuais.length > 0 ? visuais : undefined, enviados: brutos.length, motivos };
}

/** A figura do enunciado de um exercício (plano ou reta numérica). */
export function lerFiguraDoModelo(valor: unknown): { figura: VisualFigura | undefined; enviada: boolean; motivo?: string } {
  if (valor === null || valor === undefined) return { figura: undefined, enviada: false };
  const lido = validarVisual(semNulos(valor));
  if (!lido.ok) return { figura: undefined, enviada: true, motivo: lido.motivo };
  if (lido.visual.tipo === "formula") return { figura: undefined, enviada: true, motivo: "a figura do enunciado é um plano ou uma reta numérica, não uma fórmula" };
  return { figura: lido.visual, enviada: true };
}

/** A resolução "Resolva comigo" como o servidor a guarda (3 a 5 passos, 1 "Sua vez", a conta conferida): tudo ou nada. */
export function lerResolucaoDoModelo(valor: unknown): {
  resolucao: ResolucaoGuardada | undefined;
  enviada: boolean;
  conta?: { conferidas: number; puladas: number };
  motivo?: string;
} {
  if (valor === null || valor === undefined) return { resolucao: undefined, enviada: false };
  const lida = validarResolucao(semNulos(valor));
  if (!lida.ok) return { resolucao: undefined, enviada: true, motivo: lida.motivo };
  return { resolucao: lida.resolucao, enviada: true, conta: lida.conta };
}

/* ----- O esquema do que o modelo devolve (Structured Outputs: todos os campos, `null` onde não se aplica) ----- */

const texto = { type: "string" } as const;
const textoOuNulo = { type: ["string", "null"] } as const;
const numeroOuNulo = { type: ["number", "null"] } as const;
const booleanoOuNulo = { type: ["boolean", "null"] } as const;
const nulo = { type: "null" } as const;
const objeto = (propriedades: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(propriedades),
  properties: propriedades,
});

const esquemaDoPonto = objeto({
  id: texto,
  papel: { type: "string", enum: ["dado", "especial", "procurado", "resposta"] },
  x: numeroOuNulo,
  y: numeroOuNulo,
  valor: numeroOuNulo,
  rotulo: booleanoOuNulo,
  derivado: {
    anyOf: [objeto({ tipo: { type: "string", enum: ["baricentro", "ponto_medio", "media"] }, de: { type: "array", items: texto } }), nulo],
  },
});

/** Um visual: fórmula (`tipo` "formula" e `latex`), plano (`pontos` com `x` e `y`, segmentos, polígonos, guias) ou reta numérica (`de`, `ate`, `pontos` com `valor`, intervalos). */
export const esquemaDoVisual = objeto({
  tipo: { type: "string", enum: ["plano", "reta_numerica", "formula"] },
  alt: textoOuNulo,
  latex: textoOuNulo,
  de: numeroOuNulo,
  ate: numeroOuNulo,
  pontos: { type: ["array", "null"], items: esquemaDoPonto },
  segmentos: { type: ["array", "null"], items: objeto({ de: texto, ate: texto }) },
  poligonos: { type: ["array", "null"], items: objeto({ pontos: { type: "array", items: texto } }) },
  guias: { type: ["array", "null"], items: objeto({ ponto: texto, eixo: { type: "string", enum: ["x", "y"] } }) },
  intervalos: {
    type: ["array", "null"],
    items: objeto({ de: numeroOuNulo, ate: numeroOuNulo, deAberto: booleanoOuNulo, ateAberto: booleanoOuNulo }),
  },
});
export const esquemaDoVisualOuNulo = { anyOf: [esquemaDoVisual, nulo] } as const;

const esquemaDoPasso = objeto({
  nome: texto,
  texto,
  formula: textoOuNulo,
  visual: esquemaDoVisualOuNulo,
  tentativa: {
    anyOf: [
      objeto({
        pergunta: texto,
        opcoes: { type: "array", items: objeto({ texto: textoOuNulo, formula: textoOuNulo, correta: { type: "boolean" }, porque: texto }) },
      }),
      nulo,
    ],
  },
});

/** A resolução "Resolva comigo": o problema, a figura dele e de 3 a 5 passos, com um único "Sua vez" no penúltimo ou no último. */
export const esquemaDaResolucaoOuNula = {
  anyOf: [objeto({ problema: texto, visual: esquemaDoVisualOuNulo, passos: { type: "array", items: esquemaDoPasso } }), nulo],
} as const;

/* ----- As instruções (só nas lições de matemática) ----- */

const REGRAS_DE_LATEX = [
  "LaTeX restrito: dentro de $…$ e nos campos `latex` e `formula`, só vale isto: números (ponto decimal: 3.5), variáveis de uma letra (x, a, k), índices (x_A, x_{AB}), expoentes (x^2, x^{n+1}), frações (\\frac{a}{b}), raiz quadrada (\\sqrt{x}), os sinais + - \\times \\div = \\neq < > \\leq \\geq \\to, parênteses, \\text{…} (letras, números e pontuação simples), \\%, \\Delta e \\pi, matrizes (\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}) e determinantes (\\begin{vmatrix} … \\end{vmatrix}), até 4 × 4. Nada fora desta lista (nem \\alpha, nem \\int, nem \\left). Na resposta em JSON, cada barra invertida é dobrada: \"\\\\frac{1}{2}\".",
  "Realces numa fórmula: \\foco{…} no que mudou no passo, \\procurado{…} no valor que ainda se procura e \\resposta{…} no valor achado; no máximo 2 por fórmula e um dentro do outro nunca.",
];

const REGRAS_DE_PONTOS = [
  "Pontos: id de até 3 caracteres (A, B, C, G, M, P1), com x e y (no plano) ou valor (na reta numérica), no máximo 12 por figura. O rótulo \"A (1, 2)\" o Studoo monta: você dá só o id e as coordenadas. papel é \"dado\" (o que o enunciado informa), \"especial\" (um ponto de destaque, como o baricentro G ou o ponto médio M) ou \"procurado\" (o que o exercício pede). Do procurado dê as coordenadas REAIS: o Studoo o esconde no enunciado e só o mostra depois do acerto. Em \"resolucao\", o ponto que já foi achado aparece no último passo com papel \"resposta\". Para o baricentro (3 pontos), o ponto médio (2) e a média na reta numérica, não calcule: dê derivado = {tipo: \"baricentro\" | \"ponto_medio\" | \"media\", de: [ids]} e o Studoo calcula (x, y e valor ficam null). rotulo false tira o nome de um ponto (até 8 com nome por figura).",
  "Não informe a janela (x e y do plano, de e ate da reta quando há pontos): o Studoo a ajusta aos pontos. Segmentos {de, ate}, polígonos {pontos: [ids]} (3 a 8 vértices), guias {ponto, eixo} (linha tracejada até o eixo): só entre pontos que existem. Um segmento que toca o ponto procurado não é desenhado no enunciado.",
  "alt (até 140 caracteres, texto simples, sem LaTeX e sem $) descreve a figura para quem não a vê. Ele NUNCA diz onde está o ponto procurado, nem a coordenada dele, nem o valor da resposta (\"C é o vértice procurado\"); os pontos dados podem ter as coordenadas no alt.",
];

const REGRAS_DE_RESOLUCAO = [
  "resolucao (ou null): o \"Resolva comigo\", um exemplo resolvido com OUTROS números que os do exercício: {problema, visual, passos}. problema é a pergunta, com as fórmulas entre $…$; visual é a figura do problema (plano ou reta numérica, com o procurado nas coordenadas reais). passos tem de 3 a 5 passos, cada um com nome (até 24 caracteres, como \"A condição\"), texto (uma frase de até 300 caracteres), formula (LaTeX restrito, ou null; com \\foco{…} no que mudou e, no último passo, \\resposta{…} no valor achado) e visual (a figura inteira do passo, ou null: os pontos e a janela seguem os do problema; só o último passo traz o ponto como \"resposta\").",
  "O \"Sua vez\": exatamente UM passo, o penúltimo ou o último, tem tentativa = {pergunta, opcoes}: 3 opções, exatamente 1 com correta true, cada uma com porque (uma frase que explica por que está certa ou errada). Cada opção tem texto (um número, como \"15\") OU formula (LaTeX), nunca os dois. A formula e o visual do passo que tem a tentativa são o RESULTADO que a pessoa vai escolher: o app só os mostra depois da escolha. Nos outros passos, tentativa é null.",
  "Confira cada conta, passo a passo e nas opções: o Studoo refaz as contas das fórmulas e das opções e DESCARTA a resolução inteira que errar (a lição fica sem o \"Resolva comigo\").",
];

const REGRAS_DE_MARCAS = [
  "Em todo texto que a pessoa lê (objetivo, conceito, exemplo, passos, enunciado, opções, feedbacks, problema, texto dos passos, pergunta e opções do \"Sua vez\"), marque com cifrões cada variável, cada expressão e cada conta curta: $x = 3$, $a + b$, $x^2 = 9$, $x_A$, $\\frac{1}{2}$, $(x_A + x_B) / 2$. O resto fica em texto comum, sem barras. Sem cifrão, nada de LaTeX. Dinheiro se escreve \"R$ 5,00\", sem marcar. Nunca ponha $, \\, ^ ou _ fora de uma marca, nem dentro de alt, de nome de passo, de trecho ou de gabarito.",
];

/** O bloco de matemática da lição do plano (Structured Outputs da OpenAI e o json da DeepSeek). Só vai quando a lição é de matemática. */
export const instrucoesDeMatematica = [
  "",
  "Esta lição é de MATEMÁTICA. Além do que está acima, ela leva fórmulas e figuras em dados (você não desenha nada), e os campos novos do formato são:",
  "- visuais (ou null): até 3 visuais da lição. Uma fórmula: {tipo: \"formula\", latex, alt (até 60 caracteres)}. Na geometria e na reta numérica, uma figura: {tipo: \"plano\", alt, pontos, segmentos, poligonos, guias} ou {tipo: \"reta_numerica\", alt, de, ate, pontos, intervalos}. Os campos que não se aplicam ao tipo ficam null.",
  "- visual, em cada exercício (ou null): a figura do enunciado, no mesmo formato.",
  "- resolucao (ou null): o \"Resolva comigo\".",
  ...REGRAS_DE_MARCAS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_LATEX.map((regra) => `- ${regra}`),
  ...REGRAS_DE_PONTOS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_RESOLUCAO.map((regra) => `- ${regra}`),
  "- Sem figura nem fórmula que ajudem de verdade, visuais, visual e resolucao são null: a lição continua valendo só com o texto.",
].join("\n");

/**
 * Material de matemática (folha de exercícios, caderno), no pedido que propõe as lições: só a notação, as marcas `$…$` e o LaTeX restrito.
 * As figuras e o exemplo resolvido vêm num segundo pedido, uma lição por vez (`instrucoesDeFigurasDoMaterial`): uma resposta só com as
 * 3 a 5 lições e as figuras de todas não cabe nos prazos do aceite.
 */
export const instrucoesDeNotacaoDoMaterial = [
  "",
  "O material é de MATEMÁTICA. Escreva as fórmulas em LaTeX restrito, marcadas com cifrões:",
  "- Em todo texto que a pessoa lê (objetivo, conceito, exemplo, pergunta, alternativas e feedbacks), marque com cifrões cada variável, cada expressão e cada conta curta: $x = 3$, $a + b$, $x^2 = 9$, $x_A$, $\\frac{1}{2}$, $(x_A + x_B) / 2$. O resto fica em texto comum, sem barras. Sem cifrão, nada de LaTeX. Dinheiro se escreve \"R$ 5,00\", sem marcar. O trecho literal do material NUNCA leva cifrão nem LaTeX: é copiado como está na página.",
  `- ${REGRAS_DE_LATEX[0]}`,
].join("\n");

/** O esquema do segundo pedido do material de matemática: as figuras e o exemplo resolvido de UMA lição. */
export const esquemaDasFigurasDoMaterial = objeto({
  visuais: { type: ["array", "null"], items: esquemaDoVisual },
  visual: esquemaDoVisualOuNulo,
  resolucao: esquemaDaResolucaoOuNula,
});

/** As instruções do segundo pedido: dada uma lição de matemática já escrita, devolver os dados das figuras e da resolução. */
export const instrucoesDeFigurasDoMaterial = [
  "Você recebe UMA lição de matemática, já escrita a partir de um material de estudo (título, objetivo, conceito, exemplo, a pergunta com as alternativas e o índice da certa) e a página do material de onde ela veio. Devolva só os dados das figuras e do exemplo resolvido que acompanham a lição: visuais, visual e resolucao. Você não desenha nada: o Studoo valida os dados e desenha. Campos que não se aplicam ficam null.",
  "- visuais (ou null): até 3 visuais da explicação. Uma fórmula: {tipo: \"formula\", latex, alt (até 60 caracteres)}. Na geometria e na reta numérica, uma figura: {tipo: \"plano\", alt, pontos, segmentos, poligonos, guias} ou {tipo: \"reta_numerica\", alt, de, ate, pontos, intervalos}. Os campos que não se aplicam ao tipo ficam null. Reproduza só o que o material mostra ou diz (coordenadas, valores); nada inventado.",
  "- visual (ou null): a figura da pergunta da lição, no mesmo formato. O ponto que a pergunta procura leva as coordenadas da alternativa certa (papel \"procurado\").",
  "- resolucao (ou null): o \"Resolva comigo\", um exemplo resolvido da MESMA ideia com OUTROS números que os da pergunta e do material.",
  ...REGRAS_DE_MARCAS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_LATEX.map((regra) => `- ${regra}`),
  ...REGRAS_DE_PONTOS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_RESOLUCAO.map((regra) => `- ${regra}`),
  "- Sem figura nem fórmula que ajudem de verdade, visuais, visual e resolucao são null.",
].join("\n");

/* ----- O exemplo do json (DeepSeek): o mesmo formato do esquema, com um exemplo de verdade ----- */

const visualVazio = { alt: null, latex: null, de: null, ate: null, pontos: null, segmentos: null, poligonos: null, guias: null, intervalos: null };
const pontoVazio = { x: null, y: null, valor: null, rotulo: null, derivado: null };

/** A figura do ponto médio de A (1, 2) e B (5, 8): dado, dado e especial (derivado). */
const figuraDoExemploResolvido = (papelDoM: "especial" | "resposta") => ({
  ...visualVazio,
  tipo: "plano",
  alt: "O segmento de A (1, 2) a B (5, 8) no plano, com o ponto médio M.",
  pontos: [
    { ...pontoVazio, id: "A", papel: "dado", x: 1, y: 2 },
    { ...pontoVazio, id: "B", papel: "dado", x: 5, y: 8 },
    { ...pontoVazio, id: "M", papel: papelDoM, derivado: { tipo: "ponto_medio", de: ["A", "B"] } },
  ],
  segmentos: [{ de: "A", ate: "B" }],
});

/** Uma lição de matemática inteira, no formato do esquema (o ponto médio), com os campos novos preenchidos. */
export const exemploDeMatematica = {
  objetivo: "Achar o ponto médio de um segmento a partir das coordenadas das pontas.",
  conceito: "O ponto médio $M$ de um segmento $AB$ tem como coordenadas a média das coordenadas das pontas: $x_M = (x_A + x_B) / 2$ e $y_M = (y_A + y_B) / 2$.",
  exemplo: "Com $A(1, 2)$ e $B(5, 8)$: $x_M = (1 + 5) / 2 = 3$ e $y_M = (2 + 8) / 2 = 5$. O ponto médio é $M(3, 5)$.",
  exemploTipo: "exemplo",
  passos: null,
  outroJeito: "É o ponto que fica no meio do caminho: a média de duas posições.",
  recurso: null,
  falas: null,
  pratica: null,
  visuais: [
    { ...visualVazio, tipo: "formula", latex: "x_M = \\frac{x_A + x_B}{2}", alt: "Fórmula do ponto médio" },
    figuraDoExemploResolvido("especial"),
  ],
  resolucao: {
    problema: "Qual é o ponto médio do segmento de $A(1, 2)$ a $B(5, 8)$?",
    visual: figuraDoExemploResolvido("especial"),
    passos: [
      { nome: "A fórmula", texto: "O ponto médio tem a média das abscissas e a média das ordenadas.", formula: "x_M = \\foco{\\frac{x_A + x_B}{2}}", visual: null, tentativa: null },
      { nome: "Troque os valores", texto: "Coloque as coordenadas de A e de B na fórmula.", formula: "x_M = \\frac{1 + 5}{2}", visual: null, tentativa: null },
      {
        nome: "Calcule x",
        texto: "Some as abscissas e divida por 2.",
        formula: "x_M = \\frac{6}{2} = \\foco{3}",
        visual: null,
        tentativa: {
          pergunta: "Quanto vale a ordenada y_M, a média de 2 e 8?",
          opcoes: [
            { texto: "5", formula: null, correta: true, porque: "(2 + 8) ÷ 2 = 10 ÷ 2 = 5." },
            { texto: "6", formula: null, correta: false, porque: "6 é a média das abscissas (1 e 5), não a das ordenadas." },
            { texto: "10", formula: null, correta: false, porque: "10 é a soma 2 + 8: falta dividir por 2." },
          ],
        },
      },
      {
        nome: "O ponto M",
        texto: "Então M tem abscissa 3 e ordenada 5.",
        formula: "M = \\resposta{(3, 5)}",
        visual: figuraDoExemploResolvido("resposta"),
        tentativa: null,
      },
    ],
  },
  exercicios: [
    {
      tipo: "multipla_escolha",
      enunciado: "Qual é o ponto médio do segmento de $A(2, 4)$ a $B(6, 10)$?",
      contexto: null,
      trecho: null,
      trechoTipo: null,
      fala: null,
      opcoes: [{ id: "a", texto: "$(4, 7)$" }, { id: "b", texto: "$(8, 14)$" }, { id: "c", texto: "$(4, 6)$" }],
      itens: null,
      esquerda: null,
      direita: null,
      afirmacao: null,
      gabarito: ["a"],
      exata: null,
      criterios: null,
      modelo: null,
      armadilhas: null,
      feedbackCorreto: "Isso! $(2 + 6) / 2 = 4$ e $(4 + 10) / 2 = 7$.",
      feedbackIncorreto: "O ponto médio é a média das coordenadas: $(2 + 6) / 2 = 4$ e $(4 + 10) / 2 = 7$.",
      visual: {
        ...visualVazio,
        tipo: "plano",
        alt: "Os pontos A (2, 4) e B (6, 10) no plano; M é o ponto médio procurado.",
        pontos: [
          { ...pontoVazio, id: "A", papel: "dado", x: 2, y: 4 },
          { ...pontoVazio, id: "B", papel: "dado", x: 6, y: 10 },
          { ...pontoVazio, id: "M", papel: "procurado", x: 4, y: 7 },
        ],
        segmentos: [{ de: "A", ate: "B" }],
      },
    },
    {
      tipo: "lacuna",
      enunciado: "Complete o cálculo da abscissa do ponto médio de $A(2, 4)$ e $B(6, 10)$.",
      contexto: null,
      trecho: "Soma-se 2 + 6 e divide-se o resultado por ___.",
      trechoTipo: "frase",
      fala: null,
      opcoes: null,
      itens: null,
      esquerda: null,
      direita: null,
      afirmacao: null,
      gabarito: ["2"],
      exata: false,
      criterios: null,
      modelo: null,
      armadilhas: null,
      feedbackCorreto: "Isso! Divide-se por 2 porque a média é de dois valores.",
      feedbackIncorreto: "A média de dois valores divide a soma por 2: $(2 + 6) / 2 = 4$.",
      visual: null,
    },
  ],
};
