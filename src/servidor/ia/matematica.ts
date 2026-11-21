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
  /** O que o servidor consertou na COR das fórmulas antes de validar (realces a mais, `\resposta` fora do último passo). Só apresentação. */
  reparos: string[];
  /** A segunda tentativa do pedido de figuras e resolução, quando a resolução da primeira foi recusada: o motivo que foi dito à IA e se a segunda valeu. */
  novaTentativa?: NovaTentativaDaResolucao;
};

/** A segunda tentativa: o motivo que foi dito à IA, se a segunda resolução valeu e, se não, por que foi recusada de novo. */
export type NovaTentativaDaResolucao = { motivo: string; aceita: boolean; motivoDaSegunda?: string };

/** Junta o que os três validadores disseram num relato, ou `undefined` quando o modelo não mandou nada de matemática. */
export function relatoDaMatematica(
  visuais: ReturnType<typeof lerVisuaisDoModelo>,
  figuras: { onde: string; enviada: boolean; aceita: boolean; motivo?: string }[],
  resolucao: ReturnType<typeof lerResolucaoDoModelo>,
  novaTentativa?: NovaTentativaDaResolucao,
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
    reparos: [...visuais.reparos, ...resolucao.reparos],
    ...(novaTentativa ? { novaTentativa } : {}),
  };
}

/**
 * A frase que volta à IA quando a resolução foi recusada (estrutura, formato ou conta): o motivo do validador, que já traz as letras e os
 * valores quando é conta (`com k = 3/2`), e o que fazer. É a ÚNICA nova tentativa: se a segunda também for recusada, fica o tudo ou nada.
 */
export function correcaoDaResolucao(motivo: string): string {
  const dito = motivo.length > 300 ? `${motivo.slice(0, 299)}…` : motivo;
  return `O "Resolva comigo" da sua resposta anterior foi RECUSADO: ${dito}. Refaça a resolução corrigindo exatamente isso e conferindo cada conta, com OUTROS números que os da pergunta.`;
}

/** O motivo da recusa da resolução no relato (`resolucao: <motivo>`), ou `undefined` se ela não foi recusada. */
export function motivoDaResolucao(relato: RelatoDaMatematica | undefined): string | undefined {
  if (!relato?.resolucao.enviada || relato.resolucao.aceita) return undefined;
  return relato.motivos.find((motivo) => motivo.startsWith("resolucao: "))?.slice("resolucao: ".length);
}

/** Quanto a matemática de uma lição vale, para escolher entre duas respostas: cada visual e figura aceitos conta 1, a resolução aceita conta 2. */
export function valorDaMatematica(relato: RelatoDaMatematica | undefined): number {
  return relato ? relato.visuais.aceitos + relato.figuras.aceitas + (relato.resolucao.aceita ? 2 : 0) : 0;
}

/** O relato em contagens, para o registro do servidor (sem os motivos, que citam fórmulas). */
export function contagensDoRelato(relato: RelatoDaMatematica): { visuais: string; figuras: string; resolucao: "aceita" | "recusada" | "sem"; reparos?: number } {
  return {
    visuais: `${relato.visuais.aceitos}/${relato.visuais.enviados}`,
    figuras: `${relato.figuras.aceitas}/${relato.figuras.enviadas}`,
    resolucao: relato.resolucao.enviada ? (relato.resolucao.aceita ? "aceita" : "recusada") : "sem",
    ...(relato.reparos.length > 0 ? { reparos: relato.reparos.length } : {}),
  };
}

/* ----- Reparo de apresentação: a COR da fórmula, e só ela ----- */

/*
 * A IA erra a cor da fórmula com frequência: três realces onde o limite é dois, `\resposta` num passo que não é o último ou num visual da
 * lição. O validador recusa a fórmula (e, num passo, a resolução inteira) por isso, e a conta estava certa. Antes dele, o realce que não vale
 * é desembrulhado: saem o comando e as chaves, o texto de dentro fica e a conta é a mesma. É SÓ isso: o `alt` que entrega o procurado, a
 * conta que não fecha, o papel de um ponto e a estrutura (o "Sua vez" que falta) continuam recusados, e o relato conta o que foi consertado.
 */

const MAXIMO_DE_REALCES = 2;

interface RegrasDeRealce {
  /** `\resposta` vale só na fórmula do último passo (nunca nos visuais da lição nem nas opções). */
  resposta: boolean;
  /** `\procurado` não vale no último passo: o valor já foi achado. */
  procurado: boolean;
}

/** O `}` que fecha a `{` de `abertura`, contando chaves e pulando o que vem depois de uma barra; -1 se não fecha. */
function fechamento(texto: string, abertura: number): number {
  let nivel = 0;
  for (let i = abertura; i < texto.length; i += 1) {
    if (texto[i] === "\\") i += 1;
    else if (texto[i] === "{") nivel += 1;
    else if (texto[i] === "}") {
      nivel -= 1;
      if (nivel === 0) return i;
    }
  }
  return -1;
}

/**
 * O conteúdo de um realce atravessa células de matriz (`\foco{2 & 3 & 1}`: a linha inteira)? Há `&` ou `\\` fora de qualquer
 * ambiente aberto dentro dele. O realce marca UMA célula; em volta de várias o analisador recusa o `&` solto, e a fórmula inteira caía.
 */
function atravessaCelulas(conteudo: string): boolean {
  let ambientes = 0;
  for (let i = 0; i < conteudo.length; i += 1) {
    if (conteudo.startsWith("\\begin{", i)) {
      ambientes += 1;
      i += 6;
    } else if (conteudo.startsWith("\\end{", i)) {
      ambientes = Math.max(0, ambientes - 1);
      i += 4;
    } else if (conteudo.startsWith("\\\\", i)) {
      if (ambientes === 0) return true;
      i += 1;
    } else if (conteudo[i] === "\\") {
      i += 1;
    } else if (conteudo[i] === "&" && ambientes === 0) {
      return true;
    }
  }
  return false;
}

/**
 * A fórmula com os realces que não valem desembrulhados: dentro de outro realce, `\resposta` onde não vale, `\procurado` no passo da resposta,
 * em volta de células de matriz e, passando de 2, os que vêm depois dos dois primeiros (o texto de dentro fica). Devolve os motivos, um por
 * realce desembrulhado.
 */
export function reescreverRealces(latex: string, regras: RegrasDeRealce): { latex: string; motivos: string[] } {
  const motivos: string[] = [];
  let mantidos = 0;
  const rever = (texto: string, dentro: boolean): string => {
    let saida = "";
    let i = 0;
    while (i < texto.length) {
      if (texto[i] !== "\\") {
        saida += texto[i];
        i += 1;
        continue;
      }
      const achado = /^\\(foco|procurado|resposta)\s*\{/.exec(texto.slice(i, i + 40));
      const abre = achado ? i + achado[0].length - 1 : -1;
      const fecha = achado ? fechamento(texto, abre) : -1;
      if (!achado || fecha < 0) {
        // Outro comando (ou um realce sem fechar, que o validador recusa por si): passa como está.
        saida += texto.slice(i, i + 2);
        i += 2;
        continue;
      }
      const nome = achado[1];
      const conteudo = texto.slice(abre + 1, fecha);
      const motivo = dentro
        ? "dentro de outro realce"
        : nome === "resposta" && !regras.resposta
          ? "\\resposta fora do último passo"
          : nome === "procurado" && !regras.procurado
            ? "\\procurado no passo da resposta"
            : atravessaCelulas(conteudo)
              ? "em volta de várias células da matriz"
              : mantidos >= MAXIMO_DE_REALCES
                ? `mais de ${MAXIMO_DE_REALCES} realces`
                : null;
      if (motivo) {
        motivos.push(motivo);
        saida += rever(conteudo, dentro);
      } else {
        mantidos += 1;
        saida += `\\${nome}{${rever(conteudo, true)}}`;
      }
      i = fecha + 1;
    }
    return saida;
  };
  return { latex: rever(latex, false), motivos };
}

/** Os motivos juntos por tipo: "passo 2: 1 realce desembrulhado (mais de 2 realces)". */
function reparoDe(onde: string, motivos: readonly string[]): string[] {
  const contagem = new Map<string, number>();
  for (const motivo of motivos) contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
  return [...contagem].map(([motivo, vezes]) => `${onde}: ${vezes} realce${vezes === 1 ? "" : "s"} desembrulhado${vezes === 1 ? "" : "s"} (${motivo})`);
}

const ehObjeto = (valor: unknown): valor is Record<string, unknown> => valor !== null && typeof valor === "object" && !Array.isArray(valor);

/** A fórmula de um campo (`latex` ou `formula`), reparada; o resto do objeto não muda. */
function repararCampo(objeto: Record<string, unknown>, campo: string, regras: RegrasDeRealce, onde: string, reparos: string[]): Record<string, unknown> {
  const fonte = objeto[campo];
  if (typeof fonte !== "string" || !fonte.includes("\\")) return objeto;
  const { latex, motivos } = reescreverRealces(fonte, regras);
  if (motivos.length === 0) return objeto;
  reparos.push(...reparoDe(onde, motivos));
  return { ...objeto, [campo]: latex };
}

/** A resolução que a IA mandou, com a cor das fórmulas dos passos e das opções consertada. Nada além disso muda. */
export function repararResolucao(valor: unknown): { valor: unknown; reparos: string[] } {
  if (!ehObjeto(valor) || !Array.isArray(valor.passos)) return { valor, reparos: [] };
  const reparos: string[] = [];
  const total = valor.passos.length;
  const passos = valor.passos.map((passo, posicao) => {
    if (!ehObjeto(passo)) return passo;
    const ultimo = posicao === total - 1;
    const onde = `passo ${posicao + 1}`;
    let novo = repararCampo(passo, "formula", { resposta: ultimo, procurado: !ultimo }, onde, reparos);
    const tentativa = novo.tentativa;
    if (ehObjeto(tentativa) && Array.isArray(tentativa.opcoes)) {
      const opcoes = tentativa.opcoes.map((opcao, indice) => (ehObjeto(opcao) ? repararCampo(opcao, "formula", { resposta: false, procurado: true }, `${onde}, opção ${indice + 1}`, reparos) : opcao));
      if (opcoes.some((opcao, indice) => opcao !== (tentativa.opcoes as unknown[])[indice])) novo = { ...novo, tentativa: { ...tentativa, opcoes } };
    }
    return novo;
  });
  return reparos.length > 0 ? { valor: { ...valor, passos }, reparos } : { valor, reparos };
}

/** Os visuais da lição, com a cor das fórmulas consertada: num visual da lição `\resposta` não vale. As figuras não têm fórmula. */
export function repararVisuais(valor: unknown): { valor: unknown; reparos: string[] } {
  if (!Array.isArray(valor)) return { valor, reparos: [] };
  const reparos: string[] = [];
  const visuais = valor.map((visual, posicao) => {
    if (!ehObjeto(visual) || visual.tipo !== "formula") return visual;
    const campo = typeof visual.latex === "string" ? "latex" : "formula";
    return repararCampo(visual, campo, { resposta: false, procurado: true }, `visuais[${posicao}]`, reparos);
  });
  return reparos.length > 0 ? { valor: visuais, reparos } : { valor, reparos };
}

/** Os visuais da lição (até 3: fórmula, plano, reta numérica), cada um validado sozinho: o que não vale some e a lição fica. */
export function lerVisuaisDoModelo(valor: unknown): { visuais: Visual[] | undefined; enviados: number; motivos: string[]; reparos: string[] } {
  if (!Array.isArray(valor)) return { visuais: undefined, enviados: 0, motivos: [], reparos: [] };
  const { valor: reparados, reparos } = repararVisuais(semNulos(valor));
  const brutos = reparados as unknown[];
  const visuais: Visual[] = [];
  const motivos: string[] = [];
  brutos.forEach((bruto, posicao) => {
    const lido = validarVisual(bruto);
    if (!lido.ok) motivos.push(`visuais[${posicao}]: ${lido.motivo}`);
    else if (visuais.length < LIMITES_VISUAIS.visuaisPorLicao) visuais.push(lido.visual);
    else motivos.push(`visuais[${posicao}]: passa de ${LIMITES_VISUAIS.visuaisPorLicao} visuais por lição`);
  });
  return { visuais: visuais.length > 0 ? visuais : undefined, enviados: brutos.length, motivos, reparos };
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
  reparos: string[];
} {
  if (valor === null || valor === undefined) return { resolucao: undefined, enviada: false, reparos: [] };
  const { valor: reparada, reparos } = repararResolucao(semNulos(valor));
  const lida = validarResolucao(reparada, { nomeSimples: true });
  if (!lida.ok) return { resolucao: undefined, enviada: true, motivo: lida.motivo, reparos };
  // O que o validador aceitou de um jeito um pouco diferente (a conta da opção que veio junto da frase) conta como reparo no relato.
  return { resolucao: lida.resolucao, enviada: true, conta: lida.conta, reparos: [...reparos, ...(lida.ajustes ?? [])] };
}

/* ----- O esquema do que o modelo devolve (Structured Outputs: todos os campos, `null` onde não se aplica) ----- */

const texto = { type: "string" } as const;
const textoOuNulo = { type: ["string", "null"] } as const;
const numeroOuNulo = { type: ["number", "null"] } as const;
/** O x e o y do ponto do gráfico de função podem trazer π ("\\frac{\\pi}{2}"), e o domínio da curva também. */
const numeroOuTextoOuNulo = { type: ["number", "string", "null"] } as const;
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
  x: numeroOuTextoOuNulo,
  y: numeroOuTextoOuNulo,
  valor: numeroOuNulo,
  /** Só no gráfico de função: o que o Studoo calcula sobre a curva (raiz, vértice, intercepto, valor f(a)); a curva do ponto, se há mais de uma. */
  tipo: { type: ["string", "null"], enum: ["raiz", "vertice", "intercepto", "intersecao", "valor", null] },
  curva: textoOuNulo,
  rotulo: booleanoOuNulo,
  derivado: {
    anyOf: [objeto({ tipo: { type: "string", enum: ["baricentro", "ponto_medio", "media"] }, de: { type: "array", items: texto } }), nulo],
  },
});

/** Um visual: fórmula (`tipo` "formula" e `latex`), plano (`pontos` com `x` e `y`, segmentos, polígonos, guias), reta numérica (`de`, `ate`, `pontos` com `valor`, intervalos) ou gráfico de função (`curvas` e `pontos` sobre elas). */
export const esquemaDoVisual = objeto({
  tipo: { type: "string", enum: ["plano", "reta_numerica", "funcao", "formula"] },
  alt: textoOuNulo,
  latex: textoOuNulo,
  de: numeroOuNulo,
  ate: numeroOuNulo,
  /** Só no gráfico de função: de 1 a 3 curvas, cada uma com a expressão em x, a letra (f, g, h) e o domínio, que pode trazer π. */
  curvas: { type: ["array", "null"], items: objeto({ latex: texto, nome: textoOuNulo, de: numeroOuTextoOuNulo, ate: numeroOuTextoOuNulo }) },
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
  "LaTeX restrito: dentro de $…$ e nos campos `latex` e `formula`, só vale isto: números (ponto decimal: 3.5), variáveis de uma letra (x, a, k), índices (x_A, x_{AB}), expoentes (x^2, x^{n+1}), frações (\\frac{a}{b}), raiz quadrada (\\sqrt{x}), os sinais + - \\times \\div = \\neq < > \\leq \\geq \\to, parênteses, \\text{…} (letras, números e pontuação simples), \\%, as letras gregas \\Delta, \\pi, \\alpha, \\beta, \\gamma, \\theta, \\lambda, \\mu, \\sigma, \\phi e \\omega, o grau (30^\\circ), \\approx, as funções \\sin, \\cos, \\tan, \\cot, \\ln, \\log (com base: \\log_2 8), \\arcsin, \\arccos e \\arctan, matrizes (\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}) e determinantes (\\begin{vmatrix} … \\end{vmatrix}), até 4 × 4 e no máximo 2 por fórmula. O determinante é quadrado (2 × 2, 3 × 3 ou 4 × 4), e o Sarrus escreve-se SÓ como a soma dos produtos das diagonais, sem repetir colunas ao lado e sem matriz 3 × 5. O & e a quebra \\\\ só existem entre as células de uma matriz: nunca dentro de \\foco{…}, \\procurado{…} ou \\resposta{…}, que marcam UMA célula. Duas equações lado a lado se separam com \\quad. Produto de variáveis com espaço ou \\times (a e i, não aei). As funções se escrevem com a barra (\\sin x, \\sin^2 x, \\ln x, \\log_2 8) e o argumento composto vai entre parênteses (\\sin(2x + 1), nunca \\sin 2x + 1 querendo dizer o seno de tudo): o Studoo as mostra e lê na notação brasileira (sen, cos, tg, cotg, ln, log), sem você escrever \"sen\" à mão. Nada fora desta lista (nem \\int, nem \\sum, nem \\left, nem \\vec). Na resposta em JSON, cada barra invertida é dobrada: \"\\\\frac{1}{2}\".",
  "Realces numa fórmula: \\foco{…} no que mudou no passo, \\procurado{…} no valor que ainda se procura e \\resposta{…} no valor achado; no máximo 2 por fórmula (3 realces é recusado: conte antes de escrever e fique nos 2 mais importantes) e um dentro do outro nunca. \\resposta só na fórmula do ÚLTIMO passo (nunca nos visuais da lição, nas opções do \"Sua vez\" nem nos outros passos), e \\procurado nunca nesse último passo.",
];

const REGRAS_DE_PONTOS = [
  "Pontos: id de até 3 caracteres (A, B, C, G, M, P1), com x e y (no plano) ou valor (na reta numérica), no máximo 12 por figura. O rótulo \"A (1, 2)\" o Studoo monta: você dá só o id e as coordenadas. papel é \"dado\" (o que o enunciado informa, com as coordenadas), \"especial\" (um ponto de destaque: o baricentro G, o ponto médio M e a média SEMPRE são especiais e levam derivado, mesmo quando o enunciado os informa; num exercício com G dado e C procurado, G é especial, com derivado de A, B e C) ou \"procurado\" (o que o exercício pede). Do procurado dê as coordenadas REAIS: o Studoo o esconde no enunciado e só o mostra depois do acerto. Em \"resolucao\", o ponto que já foi achado aparece no último passo com papel \"resposta\". Para o baricentro (3 pontos), o ponto médio (2) e a média na reta numérica, não calcule: dê derivado = {tipo: \"baricentro\" | \"ponto_medio\" | \"media\", de: [ids]} e o Studoo calcula (x, y e valor ficam null). rotulo false tira o nome de um ponto (até 8 com nome por figura).",
  "Escolha números em que nenhum ponto cai em cima de outro. Num exercício de baricentro, ponto médio ou triângulo, o resultado NÃO coincide com outro ponto (o procurado C não é igual a G, a A nem a B) e os três vértices não ficam alinhados; só a lição de pontos colineares usa pontos alinhados. Confira antes de escrever: C = 3·G − A − B em cada coordenada (se G é o ponto médio de AB, C cai em G e o triângulo é achatado: troque os números). No plano, o Studoo DESCARTA a figura que tem dois pontos no mesmo lugar.",
  "Não informe a janela (x e y do plano, de e ate da reta quando há pontos): o Studoo a ajusta aos pontos. Segmentos {de, ate}, polígonos {pontos: [ids]} (3 a 8 vértices), guias {ponto, eixo} (linha tracejada até o eixo): só entre pontos que existem. Um segmento que toca o ponto procurado não é desenhado no enunciado.",
  "alt (até 140 caracteres, texto simples, sem LaTeX e sem $) descreve a figura para quem não a vê. Ele NUNCA diz onde está o ponto procurado, nem a coordenada dele, nem o valor da resposta (\"C é o vértice procurado\"); os pontos dados podem ter as coordenadas no alt.",
];

/**
 * O gráfico de função (spec 15, seção 15, marco 12a): quando a lição fala de uma função de x e o desenho ajuda. O Studoo calcula raízes, vértice,
 * intercepto e f(a), confere o ponto que a IA dá contra a curva e tira o que não está nela; a curva do exercício que PERGUNTA um ponto dela não
 * aparece no enunciado.
 */
const REGRAS_DE_FUNCAO = [
  "Gráfico de função, para a lição que fala de uma função de x (reta, parábola, seno, cosseno) quando o desenho ajuda: {tipo: \"funcao\", alt, curvas, pontos}, no lugar do plano. curvas tem de 1 a 3 itens {latex, nome (\"f\", \"g\" ou \"h\"), de, ate}: latex é a expressão em x, só uma soma de termos: um número, um polinômio até o grau 3 (x^2 - 4x + 3), um número vezes \\sin(a x + b) ou \\cos(a x + b) (2\\cos(\\pi x)) ou um número vezes \\sqrt{a x + b}; \\pi vale nos coeficientes. Tangente, log, exponencial, divisão por x e módulo NÃO valem (a curva some). Expanda os parênteses: x^2 - 4x + 3, e não (x - 2)^2 - 1. de e ate (o domínio, com \\pi se quiser: \"2\\pi\") só quando o texto fala de um intervalo; no seno e no cosseno, sem domínio, vale de 0 a 2π.",
  "Os pontos do gráfico ficam SOBRE a curva: {id, papel, tipo, curva, x, y}. Para a raiz, o vértice (só na parábola), o intercepto com o eixo y e o valor f(a), dê só o tipo (\"raiz\", \"vertice\", \"intercepto\", \"valor\" com o x): o Studoo calcula a posição, e duas raízes são dois pontos \"raiz\"; NÃO escreva x e y desses. O ponto sem tipo leva x e y (o x pode ter \\pi: \"\\frac{\\pi}{2}\") e só fica se a curva passa por ele; nunca ponha a origem (0, 0) nem outro ponto que a curva não cruza. Raiz, vértice e intercepto saem como pontos especiais.",
  "Se o exercício PERGUNTA um ponto da curva (as raízes, o vértice, o valor de f em a), esse ponto leva papel \"procurado\" e o seu tipo: o gráfico do enunciado fica SEM a curva (só a fórmula e os pontos dados) e a curva aparece no retorno. O alt (até 140 caracteres) diz o tipo da curva e a fórmula e NUNCA a posição do procurado: \"Parábola de f(x) = x² − 4x + 3, com o ponto C (0, 3). O vértice é o procurado.\".",
  "Exemplos do gráfico de função (os campos que não se aplicam ficam null): a parábola {tipo: \"funcao\", alt: \"Parábola de f(x) = x² − 4x + 3, com as raízes A e B, o vértice V e o intercepto C.\", curvas: [{latex: \"x^2 - 4x + 3\", nome: \"f\", de: null, ate: null}], pontos: [{id: \"A\", papel: \"especial\", tipo: \"raiz\"}, {id: \"B\", papel: \"especial\", tipo: \"raiz\"}, {id: \"V\", papel: \"especial\", tipo: \"vertice\"}, {id: \"C\", papel: \"especial\", tipo: \"intercepto\"}]}; a reta {tipo: \"funcao\", alt: \"A reta g(x) = 2x + 1.\", curvas: [{latex: \"2x + 1\", nome: \"g\", de: -2, ate: 2}], pontos: [{id: \"C\", papel: \"especial\", tipo: \"intercepto\"}, {id: \"R\", papel: \"especial\", tipo: \"raiz\"}]}; o seno {tipo: \"funcao\", alt: \"A onda h(x) = sen x de 0 a 2π.\", curvas: [{latex: \"\\sin x\", nome: \"h\", de: 0, ate: \"2\\pi\"}], pontos: [{id: \"M\", papel: \"especial\", x: \"\\frac{\\pi}{2}\", y: 1}, {id: \"N\", papel: \"especial\", x: \"\\frac{3\\pi}{2}\", y: -1}]}.",
  "O gráfico de função ainda não vale no \"Resolva comigo\" (a figura do problema e a dos passos são plano ou reta numérica): use-o só em visuais e no visual do exercício.",
];

const REGRAS_DE_RESOLUCAO = [
  "resolucao (ou null): o \"Resolva comigo\", um exemplo resolvido com OUTROS números que os do exercício: {problema, visual, passos}. problema é a pergunta, com as fórmulas entre $…$; visual é a figura do problema (plano ou reta numérica, com o procurado nas coordenadas reais). passos tem de 3 a 5 passos, cada um com nome (até 24 caracteres, como \"A condição\": só texto simples e curto, sem letra com índice, sem expoente e sem fórmula; \"Isole a abscissa de C\", e não \"Isole x_C\"), texto (uma frase de até 300 caracteres), formula (LaTeX restrito, ou null; com \\foco{…} no que mudou e, no último passo, \\resposta{…} no valor achado) e visual (a figura inteira do passo, ou null: os pontos e a janela seguem os do problema; só o último passo traz o ponto como \"resposta\").",
  "O \"Sua vez\": exatamente UM passo, o penúltimo ou o último, tem tentativa = {pergunta, opcoes}: 3 opções, exatamente 1 com correta true, cada uma com porque (uma frase que explica por que está certa ou errada). A pergunta é por um valor que a resolução revela adiante (o do último passo, em \\resposta{…}). Cada opção tem formula (a conta que dá o valor, como \"y_M = \\frac{10}{2}\") OU texto (só quando a opção não é uma conta; uma frase com uma conta no meio vai toda em texto, a conta entre cifrões), nunca os dois: o Studoo refaz a conta das opções em fórmula e compara com o valor da resposta, então prefira formula. A formula e o visual do passo que tem a tentativa são o que a pessoa vê depois da escolha: o app só os mostra depois. A frase (texto) e o nome do passo que tem o \"Sua vez\" dizem o que fazer (\"Agora junte os termos e isole k\", \"Faça igual com as ordenadas\"), nunca o resultado nem a conta já feita (nada de \"k = 3\", \"chega-se a 3\", \"dá zero\"): o valor só aparece na formula, nas opções e no porque. O Studoo RECUSA a resolução em que a frase ou o nome desse passo traz o valor. Nos outros passos, tentativa é null.",
  "Confira cada conta, passo a passo e nas opções: o Studoo refaz as contas das fórmulas e das opções e DESCARTA a resolução inteira que errar (a lição fica sem o \"Resolva comigo\").",
];

const REGRAS_DE_MARCAS = [
  "Em todo texto que a pessoa lê (objetivo, conceito, exemplo, passos, enunciado, opções, feedbacks, problema, texto dos passos, pergunta e opções do \"Sua vez\"), marque com cifrões cada variável, cada expressão e cada conta curta: $x = 3$, $a + b$, $x^2 = 9$, $x_A$, $\\frac{1}{2}$, $(x_A + x_B) / 2$. O resto fica em texto comum, sem barras. Sem cifrão, nada de LaTeX. Dinheiro se escreve \"R$ 5,00\", sem marcar. Marque só a fórmula COMPLETA, que fecha antes da lacuna: \"$h = 12$\" está certo e \"$h = $ ___\" está errado; na lacuna (___), a conta que fica pela metade vai em texto comum, sem cifrões (\"h = ___\"). Nunca ponha $, \\, ^ ou _ fora de uma marca, nem dentro de alt, de nome de passo, de trecho ou de gabarito.",
];

/** O bloco de matemática da lição do plano (Structured Outputs da OpenAI e o json da DeepSeek). Só vai quando a lição é de matemática. */
export const instrucoesDeMatematica = [
  "",
  "Esta lição é de MATEMÁTICA. Além do que está acima, ela leva fórmulas e figuras em dados (você não desenha nada), e os campos novos do formato são:",
  "- visuais (ou null): até 3 visuais da lição. Uma fórmula: {tipo: \"formula\", latex, alt (até 60 caracteres)}. Na geometria e na reta numérica, uma figura: {tipo: \"plano\", alt, pontos, segmentos, poligonos, guias} ou {tipo: \"reta_numerica\", alt, de, ate, pontos, intervalos}; numa função de x, o gráfico {tipo: \"funcao\", alt, curvas, pontos} (regras abaixo). Os campos que não se aplicam ao tipo ficam null.",
  "- visual, em cada exercício (ou null): a figura do enunciado, no mesmo formato.",
  "- resolucao (ou null): o \"Resolva comigo\".",
  ...REGRAS_DE_MARCAS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_LATEX.map((regra) => `- ${regra}`),
  ...REGRAS_DE_PONTOS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_FUNCAO.map((regra) => `- ${regra}`),
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
  "- Em todo texto que a pessoa lê (objetivo, conceito, exemplo, pergunta, alternativas e feedbacks), marque com cifrões cada variável, cada expressão e cada conta curta: $x = 3$, $a + b$, $x^2 = 9$, $x_A$, $\\frac{1}{2}$, $(x_A + x_B) / 2$. O resto fica em texto comum, sem barras. Sem cifrão, nada de LaTeX. Dinheiro se escreve \"R$ 5,00\", sem marcar. Marque só a fórmula COMPLETA, que fecha antes da lacuna: \"$h = 12$\" está certo e \"$h = $ ___\" está errado; na lacuna (___), a conta que fica pela metade vai em texto comum, sem cifrões (\"h = ___\"). O trecho literal do material NUNCA leva cifrão nem LaTeX: é copiado como está na página.",
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
  "- visuais (ou null): até 3 visuais da explicação. Uma fórmula: {tipo: \"formula\", latex, alt (até 60 caracteres)}. Na geometria e na reta numérica, uma figura: {tipo: \"plano\", alt, pontos, segmentos, poligonos, guias} ou {tipo: \"reta_numerica\", alt, de, ate, pontos, intervalos}; numa função de x, o gráfico {tipo: \"funcao\", alt, curvas, pontos} (regras abaixo). Os campos que não se aplicam ao tipo ficam null. Reproduza só o que o material mostra ou diz (coordenadas, valores); nada inventado.",
  "- visual (ou null): a figura da pergunta da lição, no mesmo formato. O ponto que a pergunta procura leva as coordenadas da alternativa certa (papel \"procurado\").",
  "- resolucao (ou null): o \"Resolva comigo\", um exemplo resolvido da MESMA ideia com OUTROS números que os da pergunta e do material.",
  ...REGRAS_DE_MARCAS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_LATEX.map((regra) => `- ${regra}`),
  ...REGRAS_DE_PONTOS.map((regra) => `- ${regra}`),
  ...REGRAS_DE_FUNCAO.map((regra) => `- ${regra}`),
  ...REGRAS_DE_RESOLUCAO.map((regra) => `- ${regra}`),
  "- Sem figura nem fórmula que ajudem de verdade, visuais, visual e resolucao são null.",
  "- Se os dados trouxerem `correcao`, a sua resposta anterior para esta lição teve o \"Resolva comigo\" RECUSADO pelo motivo dito (com as letras e os valores usados, quando é conta): refaça visuais, visual e resolucao corrigindo exatamente isso e conferindo cada conta.",
].join("\n");

/* ----- O exemplo do json (DeepSeek): o mesmo formato do esquema, com um exemplo de verdade ----- */

const visualVazio = { alt: null, latex: null, de: null, ate: null, curvas: null, pontos: null, segmentos: null, poligonos: null, guias: null, intervalos: null };
const pontoVazio = { x: null, y: null, valor: null, tipo: null, curva: null, rotulo: null, derivado: null };

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
      { nome: "Troque os valores", texto: "Coloque as abscissas de A e de B na fórmula.", formula: "x_M = \\frac{1 + 5}{2}", visual: null, tentativa: null },
      { nome: "Calcule x", texto: "Some as abscissas e divida por 2.", formula: "x_M = \\frac{6}{2} = \\foco{3}", visual: null, tentativa: null },
      {
        nome: "O mesmo para y",
        texto: "Faça igual com as ordenadas de A e de B.",
        formula: "y_M = \\frac{2 + 8}{2}",
        visual: null,
        tentativa: {
          pergunta: "Quanto vale y_M?",
          opcoes: [
            { texto: null, formula: "y_M = \\frac{10}{2}", correta: true, porque: "(2 + 8) ÷ 2 = 10 ÷ 2 = 5." },
            { texto: null, formula: "y_M = 2 + 8", correta: false, porque: "10 é a soma das ordenadas: falta dividir por 2." },
            { texto: null, formula: "y_M = \\frac{2 + 8}{4}", correta: false, porque: "Divide-se por 2, o número de pontos, e não por 4." },
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
