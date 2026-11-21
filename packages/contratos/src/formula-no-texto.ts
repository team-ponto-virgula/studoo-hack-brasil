import {
  falarFormula,
  formulaCabeEmLinha,
  formulaLinear,
  lerFormula,
  repararComandosDeControle,
  type NoFormula,
} from "./formula";

/*
 * Fórmula dentro da frase (spec 15, seção 1, "Em linha"): conceito, exemplo, enunciado, opções, feedback, passos e opções do "Sua
 * vez" são texto corrido, e a fórmula simples (variável, índice, expoente, número, operador e parênteses) é desenhada no meio dele.
 * Fração, raiz, matriz e determinante vão em bloco, nunca numa frase: dentro de uma frase eles caem em texto linear.
 *
 * A MARCAÇÃO é o cifrão do LaTeX: `$x_G = (x_A + x_B + x_C) / 3$`. A fórmula de dentro usa a mesma gramática do LaTeX restrito
 * (`lerFormula`). Escolhido porque:
 * - não usa a barra invertida como marcador, então não cai nas armadilhas do JSON (`\f`, `\t`, `\n`);
 * - os modelos já escrevem assim, e reproduzem com um exemplo curto no prompt;
 * - não colide com o texto em português: um `$` só abre fórmula se não vier colado numa letra ou número ("R$ 5,00", "US$10") e
 *   se o próximo caractere não for espaço, e só fecha se o anterior não for espaço e o seguinte não for letra ou número. "R$ 5,00 e
 *   R$ 10,00", "$ 5" e "custa $5 e $10" não formam par.
 *
 * Quando a IA esquece a marcação, uma heurística determinística reconhece os tokens soltos e inequívocos: `x_A`, `y_C`, `x_G`, `b^2`,
 * `x^2`, `10^3` (uma letra, ou um número só no expoente, mais `_` ou `^` e um a três caracteres). Palavras, endereços e código não
 * entram (`snake_case`, `a/b_c`, `arquivo.x_1`, `f_x(`). Não use em `trecho` de código.
 */

export type SegmentoDeTexto =
  | { tipo: "texto"; texto: string }
  /**
   * Uma fórmula que cabe em linha, já lida. `latex` é a forma canônica (a mesma que o servidor guarda entre cifrões), `linear` o
   * texto de uma linha para quem não desenha e `falado` o texto para o leitor de tela.
   */
  | { tipo: "formula"; arvore: NoFormula; latex: string; linear: string; falado: string };

export interface OpcoesDoTexto {
  /** Reconhece `x_A`, `b^2` etc. soltos no texto. Padrão: sim. */
  heuristica?: boolean;
}

const ehDePalavra = (caractere: string | undefined): boolean => caractere !== undefined && /[\p{L}\p{N}_]/u.test(caractere);
const ehEspaco = (caractere: string | undefined): boolean => caractere !== undefined && /\s/.test(caractere);

/* ----- LaTeX que veio sem estar certo: texto linear de melhor esforço ----- */

const GREGAS: Readonly<Record<string, string>> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ",
  phi: "φ", omega: "ω", Delta: "Δ", Gamma: "Γ", Sigma: "Σ", Omega: "Ω", Pi: "Π",
};
const SIMBOLOS: Readonly<Record<string, string>> = {
  times: "×", cdot: "×", div: "÷", pm: "±", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", to: "→",
  rightarrow: "→", infty: "∞", in: "∈", cup: "∪", cap: "∩", ldots: "…", cdots: "…",
};
const SOBRESCRITO: Readonly<Record<string, string>> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/**
 * O texto de uma linha para um LaTeX que a gramática não aceita (comando de fora da lista, chave sem fechar): o que a IA quis dizer,
 * sem barra e sem chave na tela. Se a fórmula lê, é a árvore que escreve (`formulaLinear`); senão, uma troca comando por comando.
 */
export function linearizarTolerante(fonte: string): string {
  const arrumada = repararComandosDeControle(fonte).trim();
  const lida = lerFormula(arrumada);
  if (lida.ok) return formulaLinear(lida.arvore);
  let texto = arrumada.replace(/^\$+|\$+$/g, "").replace(/\\left|\\right/g, "").replace(/\\[,;:! ]|\\q?quad/g, " ");
  for (let volta = 0; volta < 5; volta += 1) {
    const antes = texto;
    texto = texto
      .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_inteiro, a: string, b: string) => `${/^[\w.,−-]+$/u.test(a.trim()) ? a.trim() : `(${a.trim()})`} / ${/^[\w.,−-]+$/u.test(b.trim()) ? b.trim() : `(${b.trim()})`}`)
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_inteiro, a: string) => `√(${a.trim()})`)
      .replace(/\\(?:text|mathrm|textbf|mathbf|operatorname)\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\(?:foco|procurado|resposta|overline|vec|hat|bar)\s*\{([^{}]*)\}/g, "$1")
      .replace(/\^\{([^{}]*)\}/g, (_inteiro, a: string) => (a.length === 1 && SOBRESCRITO[a] ? SOBRESCRITO[a] : `^(${a})`))
      .replace(/_\{([^{}]*)\}/g, (_inteiro, a: string) => `_${a}`);
    if (texto === antes) break;
  }
  texto = texto
    .replace(/\^([0-9])(?![0-9])/g, (_inteiro, a: string) => SOBRESCRITO[a] ?? `^${a}`)
    .replace(/\\([A-Za-z]+)/g, (inteiro, nome: string) => GREGAS[nome] ?? SIMBOLOS[nome] ?? (nome.length > 1 ? "" : inteiro))
    .replace(/[\\{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return texto;
}

/** O texto com o LaTeX que ficou solto (sem cifrões) trocado pelo texto linear: nunca barra, nunca chave na tela. */
function semLatexCru(texto: string): string {
  return /[\\{}]/.test(texto) ? linearizarTolerante(texto.replace(/\s+/g, " ")) : texto;
}

/* ----- A marcação com cifrões ----- */

const TAMANHO_MAXIMO_DA_MARCA = 200;

interface Marca {
  conteudo: string;
  fim: number;
}

/** Lê a marca que abre no `$` da posição `inicio`, ou null se ele é cifrão de dinheiro (ou não fecha). */
function lerMarca(texto: string, inicio: number): Marca | null {
  const comprimento = texto[inicio + 1] === "$" ? 2 : 1;
  const anterior = texto[inicio - 1];
  if (anterior !== undefined && (ehDePalavra(anterior) || anterior === "\\")) return null;
  const primeiro = texto[inicio + comprimento];
  if (primeiro === undefined || ehEspaco(primeiro) || primeiro === "$") return null;
  const limite = Math.min(texto.length, inicio + comprimento + TAMANHO_MAXIMO_DA_MARCA);
  for (let j = inicio + comprimento + 1; j < limite; j += 1) {
    if (texto[j] === "\n") return null;
    if (texto[j] !== "$" || (comprimento === 2 && texto[j + 1] !== "$")) continue;
    if (ehEspaco(texto[j - 1]) || ehDePalavra(texto[j + comprimento])) continue;
    return { conteudo: texto.slice(inicio + comprimento, j), fim: j + comprimento };
  }
  return null;
}

function segmentosDaMarca(conteudo: string): SegmentoDeTexto[] {
  const lida = lerFormula(conteudo);
  if (!lida.ok) return [{ tipo: "texto", texto: linearizarTolerante(conteudo) }];
  // Fração, raiz, matriz e determinante só em bloco: dentro da frase viram texto linear.
  if (!formulaCabeEmLinha(lida.arvore)) return [{ tipo: "texto", texto: formulaLinear(lida.arvore) }];
  return [{ tipo: "formula", arvore: lida.arvore, latex: lida.canonica, linear: formulaLinear(lida.arvore), falado: falarFormula(lida.arvore) }];
}

/* ----- A heurística dos tokens soltos ----- */

const INDICE = String.raw`(?:_(?:\{[A-Za-z0-9]{1,3}\}|[A-Za-z]{1,2}|\d{1,3}|[A-Za-z]\d{1,2}))`;
const EXPOENTE = String.raw`(?:\^(?:\{[A-Za-z0-9]{1,3}\}|\d{1,3}|[A-Za-z]))`;
const TOKEN_DE_LETRA = new RegExp(`^[A-Za-z](?:${INDICE}${EXPOENTE}?|${EXPOENTE})$`);
const TOKEN_DE_NUMERO = new RegExp(`^\\d{1,3}${EXPOENTE}$`);
const CORRIDA = /[A-Za-z0-9_^{}]+/g;
/** Antes de um token assim, estes caracteres dizem endereço, caminho, usuário, etiqueta ou código. */
const ANTES_DE_CODIGO = /[/.:@#\\~]/;

/** `x_AB` vira `x_{AB}`, que é o que a gramática lê. */
function paraLatex(token: string): string {
  return token.replace(/_([A-Za-z0-9]{2,3})(?![A-Za-z0-9}])/g, "_{$1}");
}

function partirPeloQueSePareceFormula(texto: string): SegmentoDeTexto[] {
  const saida: SegmentoDeTexto[] = [];
  let cursor = 0;
  for (const achado of texto.matchAll(CORRIDA)) {
    const token = achado[0];
    const inicio = achado.index ?? 0;
    const fim = inicio + token.length;
    if (!(token.includes("_") || token.includes("^")) || !(TOKEN_DE_LETRA.test(token) || TOKEN_DE_NUMERO.test(token))) continue;
    if (ANTES_DE_CODIGO.test(texto[inicio - 1] ?? "") || /^[(/@.]\S|^\.[A-Za-z]/.test(texto.slice(fim, fim + 2))) continue;
    const lida = lerFormula(paraLatex(token));
    if (!lida.ok || !formulaCabeEmLinha(lida.arvore)) continue;
    if (inicio > cursor) saida.push({ tipo: "texto", texto: texto.slice(cursor, inicio) });
    saida.push({ tipo: "formula", arvore: lida.arvore, latex: lida.canonica, linear: formulaLinear(lida.arvore), falado: falarFormula(lida.arvore) });
    cursor = fim;
  }
  if (cursor < texto.length) saida.push({ tipo: "texto", texto: texto.slice(cursor) });
  return saida;
}

/* ----- A função ----- */

function juntarVizinhos(segmentos: SegmentoDeTexto[]): SegmentoDeTexto[] {
  const saida: SegmentoDeTexto[] = [];
  for (const segmento of segmentos) {
    const ultimo = saida[saida.length - 1];
    if (segmento.tipo === "texto" && segmento.texto === "") continue;
    if (segmento.tipo === "texto" && ultimo?.tipo === "texto") saida[saida.length - 1] = { tipo: "texto", texto: ultimo.texto + segmento.texto };
    else saida.push(segmento);
  }
  return saida;
}

/**
 * Parte um texto em pedaços de texto e fórmulas em linha, na ordem. Fórmula marcada com `$…$` que lê e cabe em linha vira um
 * segmento `formula`; marcada que não lê (comando de fora da lista) ou que não cabe em linha (fração, raiz, matriz) cai em texto
 * linear, com a mesma pontuação em volta, e nunca derruba o texto. Sem marcação, os tokens soltos e inequívocos (`x_A`, `b^2`) também
 * viram fórmula. O texto que sobra passa intacto; LaTeX cru fora das marcas vira texto linear (sem barra e sem chave).
 * Nenhum segmento de texto sai vazio; texto sem matemática volta como um segmento só, igual ao de entrada.
 */
export function partirTextoComFormulas(texto: string, opcoes: OpcoesDoTexto = {}): SegmentoDeTexto[] {
  if (typeof texto !== "string" || texto === "") return [];
  const heuristica = opcoes.heuristica ?? true;
  const segmentos: SegmentoDeTexto[] = [];
  let corrente = "";
  const fecharTexto = () => {
    if (!corrente) return;
    const limpo = semLatexCru(corrente);
    segmentos.push(...(heuristica ? partirPeloQueSePareceFormula(limpo) : [{ tipo: "texto" as const, texto: limpo }]));
    corrente = "";
  };
  let i = 0;
  while (i < texto.length) {
    if (texto[i] === "$") {
      const marca = lerMarca(texto, i);
      if (marca) {
        fecharTexto();
        segmentos.push(...segmentosDaMarca(marca.conteudo));
        i = marca.fim;
        continue;
      }
    }
    corrente += texto[i];
    i += 1;
  }
  fecharTexto();
  return juntarVizinhos(segmentos);
}

/** O texto para quem não desenha fórmula (cliente antigo): cada fórmula marcada em texto linear, sem cifrão nem LaTeX cru. */
export function textoSemFormulas(texto: string): string {
  return partirTextoComFormulas(texto, { heuristica: false }).map((segmento) => (segmento.tipo === "texto" ? segmento.texto : segmento.linear)).join("");
}

/** O texto que o leitor de tela lê: as frases como estão e cada fórmula pelo texto falado ("x índice G é igual a …"). */
export function falarTextoComFormulas(texto: string): string {
  const partes = partirTextoComFormulas(texto).map((segmento) => (segmento.tipo === "texto" ? segmento.texto : ` ${segmento.falado} `));
  return partes.join("").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

/** Há uma marca `$…$` de fórmula no texto (a que vale, por inteiro: "R$ 5,00" não conta)? */
export function contemMarcaDeFormula(texto: string): boolean {
  if (typeof texto !== "string" || !texto.includes("$")) return false;
  for (let i = texto.indexOf("$"); i >= 0 && i < texto.length; i = texto.indexOf("$", i + 1)) {
    const marca = lerMarca(texto, i);
    if (marca) return true;
  }
  return false;
}

/** Tem alguma fórmula marcada ou reconhecida no texto? */
export function temFormulaNoTexto(texto: string): boolean {
  return partirTextoComFormulas(texto).some((segmento) => segmento.tipo === "formula");
}

/**
 * O texto como o servidor o guarda: as fórmulas marcadas que valem ficam entre cifrões, na forma canônica; as que não valem (ou não
 * cabem em linha) viram texto linear; LaTeX cru fora de marca vira texto linear. Com `manterMarcas` falso (legenda, `alt`), tudo
 * vira texto linear. Os tokens soltos (`x_A`) ficam como a IA escreveu: quem lê decide desenhá-los.
 */
export function normalizarTextoComFormulas(texto: string, manterMarcas = true): string {
  return partirTextoComFormulas(texto, { heuristica: false })
    .map((segmento) => (segmento.tipo === "texto" ? segmento.texto : manterMarcas ? `$${segmento.latex}$` : segmento.linear))
    .join("");
}
