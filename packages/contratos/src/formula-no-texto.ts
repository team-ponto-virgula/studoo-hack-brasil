import {
  CARACTERES_ESPECIAIS_DO_LINEAR,
  falarFormula,
  formulaCanonica,
  formulaEmPecas,
  formulaLinear,
  lerFormula,
  percorrerFormula,
  repararComandosDeControle,
  type NoFormula,
} from "./formula";
import { formulaCabeNaLinha } from "./motor-formula";

/*
 * Fórmula dentro da frase (spec 15, seção 1, "Em linha"): conceito, exemplo, enunciado, opções, feedback, passos e opções do "Sua
 * vez" são texto corrido, e a fórmula simples (variável, índice, expoente, número, operador, parênteses e a fração de dois termos
 * simples, "a/b") é desenhada no meio dele. Fração composta, raiz, matriz e determinante vão em bloco, nunca numa frase: dentro
 * de uma frase eles caem no texto linear EM PEÇAS (`formulaEmPecas`): cada variável com índice e cada expoente continuam
 * desenhados, e só o que sobra (parênteses, sinais, o ÷ da fração composta) é texto. O sublinhado cru nunca aparece.
 *
 * A MARCAÇÃO é o cifrão do LaTeX: `$x_G = (x_A + x_B + x_C) / 3$`. A fórmula de dentro usa a mesma gramática do LaTeX restrito
 * (`lerFormula`). Escolhido porque:
 * - não usa a barra invertida como marcador, então não cai nas armadilhas do JSON (`\f`, `\t`, `\n`);
 * - os modelos já escrevem assim, e reproduzem com um exemplo curto no prompt;
 * - não colide com o texto em português: um `$` só abre fórmula se não vier colado numa letra ou número ("R$ 5,00", "US$10") e
 *   se o próximo caractere não for espaço, e só fecha se o seguinte não for letra ou número e, vindo depois de um espaço, só se o que está
 *   dentro é uma conta começada (`$h = $ ___`: termina em `=`, `+`, `×`…, e a lacuna ficou fora da marca). "R$ 5,00 e R$ 10,00", "$ 5",
 *   "custa $5 e $10", "$5 e o capacete $ 80" e "$x_G $" não formam par. A conta começada não é fórmula: vira texto ("h = ___"), sem cifrão.
 *
 * Dentro da marca, `a/b` com dois termos simples (número, variável, variável com índice) é a fração "a/b" desenhada em linha e
 * lida "a sobre b" ("$1/2$": numa frase, meio é um número); as outras barras continuam ÷ (`x_G = (x_A + x_B) / 3`).
 *
 * Quando a IA esquece a marcação, uma heurística determinística reconhece os tokens soltos e inequívocos: `x_A`, `y_C`, `x_G`, `b^2`,
 * `x^2`, `10^3` (uma letra, ou um número só no expoente, mais `_` ou `^` e um a três caracteres) e a conta curta ("letra sozinha,
 * sinal, número ou letra": `x = 3`, `a + b`, `y − 2`, `então x_C = 12 − 8 = 4`). Palavras, endereços e código não entram
 * (`snake_case`, `a/b_c`, `arquivo.x_1`, `f_x(`); uma letra solta no meio de uma frase ("lado x", "a casa") só vira fórmula com marca. A heurística NÃO liga sozinha: só em lição que já tem matemática, e quem
 * sabe isso é o servidor (`marcarFormulasSoltas`, que põe as marcas antes de o texto chegar ao cliente). `partirTextoComFormulas`,
 * por padrão, só lê o que está marcado: "Em Python, use x_1 = 3 e print(x_1)." continua texto.
 */

export type SegmentoDeTexto =
  | { tipo: "texto"; texto: string }
  /**
   * Uma fórmula que cabe em linha, já lida. `latex` é a forma canônica (a mesma que o servidor guarda entre cifrões), `linear` o
   * texto de uma linha para quem não desenha e `falado` o texto para o leitor de tela.
   */
  | { tipo: "formula"; arvore: NoFormula; latex: string; linear: string; falado: string };

export interface OpcoesDoTexto {
  /**
   * Reconhece `x_A`, `b^2` etc. soltos no texto. Padrão: NÃO (spec 15, seção 9): só a lição que já tem matemática pode ligar isto,
   * e quem a reconhece é o servidor, que põe as marcas antes de o texto chegar ao cliente (`marcarFormulasSoltas`).
   */
  heuristica?: boolean;
}

/** O que o texto tem, na ordem: texto corrido, ou uma marca já lida (com a fala e o texto linear da fórmula INTEIRA). */
type Parte =
  | { tipo: "texto"; texto: string }
  | { tipo: "marca"; segmentos: SegmentoDeTexto[]; falado: string; linear: string; latex: string | null };

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
      .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_inteiro, a: string, b: string) => {
        const simples = (termo: string): boolean => /^[\w.,−-]+$/u.test(termo.trim());
        if (simples(a) && simples(b)) return `${a.trim()}/${b.trim()}`;
        return `${simples(a) ? a.trim() : `(${a.trim()})`} ÷ ${simples(b) ? b.trim() : `(${b.trim()})`}`;
      })
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_inteiro, a: string) => (/^[\w.,−-]+$/u.test(a.trim()) ? `√${a.trim()}` : `√(${a.trim()})`))
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

/** O que a fórmula `h = ` deixa sem fechar: termina num sinal que pede mais (`=`, `+`, `−`, `×`, `<`, `(`…, ou o comando dele: `\\times`). */
const TERMINA_EM_SINAL = /(?:[=+\-−×÷·*/<>≤≥≠^_(,;]|\\(?:times|cdot|div|le|leq|ge|geq|ne|neq|pm|mp))\s*$/;

/**
 * O cifrão que fecha depois de um espaço (`$h = $ ___`: a IA abre a fórmula, deixa a lacuna de fora e põe o espaço dentro). Vale SÓ quando o
 * que está entre os cifrões é uma conta começada (termina num sinal): um cifrão depois de espaço e de um sinal não pode ser o começo de outra
 * marca. A fórmula completa com espaço antes do fecho (`$x_G $`, `$5 e o capacete $ 80`, `$HOME e $PATH`) continua sem par, como sempre foi.
 */
function fechaDepoisDeEspaco(conteudo: string): boolean {
  return TERMINA_EM_SINAL.test(conteudo);
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
    if (ehDePalavra(texto[j + comprimento])) continue;
    const conteudo = texto.slice(inicio + comprimento, j);
    if (ehEspaco(texto[j - 1]) && !fechaDepoisDeEspaco(conteudo)) continue;
    return { conteudo, fim: j + comprimento };
  }
  return null;
}

function segmentoDeFormula(arvore: NoFormula, latex: string = formulaCanonica(arvore)): SegmentoDeTexto {
  return { tipo: "formula", arvore, latex, linear: formulaLinear(arvore), falado: falarFormula(arvore) };
}

/** `a/b` com dois termos simples, dentro da marca, é a fração "a/b": `\frac{a}{b}`. Não mexe no que está em `\text{…}`. */
const ATOMO_DA_BARRA = String.raw`(?:\d+(?:\.\d+)?|[A-Za-z](?:_(?:[A-Za-z0-9]|\{[A-Za-z0-9]{1,3}\}))?)`;
const BARRA_SIMPLES = new RegExp(String.raw`(?<![\w}\])^_.\\/])(${ATOMO_DA_BARRA})[ \t]*\/[ \t]*(${ATOMO_DA_BARRA})(?![\w{(^_.\\/])`, "g");

function barraSimplesEmFracao(fonte: string): string {
  if (!fonte.includes("/")) return fonte;
  return fonte
    .split(/(\\text\s*\{[^{}]*\})/)
    .map((pedaco, posicao) => (posicao % 2 === 1 ? pedaco : pedaco.replace(BARRA_SIMPLES, (_inteiro, a: string, b: string) => `\\frac{${a}}{${b}}`)))
    .join("");
}

/**
 * Uma marca `$…$` já lida. Cabendo na linha (pelo tipo e pela medida, `formulaCabeNaLinha`), é UMA fórmula em linha; senão, o texto
 * linear em PEÇAS: variáveis, índices e expoentes desenhados, o resto em texto ("(" + x_A + " + " + x_B + ") ÷ 2"). A fala vem da
 * árvore inteira, nunca do texto linear. Que não lê (comando de fora da lista): texto linear de melhor esforço, sem LaTeX cru.
 */
function marcaDe(conteudo: string): Parte {
  // A fórmula começada que ficou sem o resto (`h =`, `x +`, `3 \\times`: o resto, a lacuna, está fora da marca) não é fórmula: é texto, sem
  // cifrão e sem desenho (o resto da frase está em texto, e uma só fórmula desenhada no meio dela destoaria).
  if (TERMINA_EM_SINAL.test(conteudo)) {
    const linear = linearizarTolerante(conteudo);
    return { tipo: "marca", segmentos: [{ tipo: "texto", texto: linear }], falado: linear, linear, latex: null };
  }
  const lida = lerFormula(barraSimplesEmFracao(conteudo));
  if (!lida.ok) {
    const linear = linearizarTolerante(conteudo);
    return { tipo: "marca", segmentos: [{ tipo: "texto", texto: linear }], falado: linear, linear, latex: null };
  }
  const { arvore, canonica } = lida;
  const segmentos: SegmentoDeTexto[] = formulaCabeNaLinha(arvore)
    ? [segmentoDeFormula(arvore, canonica)]
    : formulaEmPecas(arvore, (peca) => formulaCabeNaLinha(peca)).map((peca): SegmentoDeTexto => (typeof peca === "string" ? { tipo: "texto", texto: peca } : segmentoDeFormula(peca)));
  return { tipo: "marca", segmentos, falado: falarFormula(arvore), linear: formulaLinear(arvore), latex: canonica };
}

/* ----- A heurística dos tokens soltos ----- */

const INDICE = String.raw`(?:_(?:\{[A-Za-z0-9]{1,3}\}|[A-Za-z]{1,2}|\d{1,3}|[A-Za-z]\d{1,2}))`;
const EXPOENTE = String.raw`(?:\^(?:\{[A-Za-z0-9]{1,3}\}|\d{1,3}|[A-Za-z]))`;
const TOKEN_DE_LETRA = new RegExp(`^[A-Za-z](?:${INDICE}${EXPOENTE}?|${EXPOENTE})$`);
const TOKEN_DE_NUMERO = new RegExp(`^\\d{1,3}${EXPOENTE}$`);
/** Fórmula química: elementos (`H`, `Na`) com índice numérico, ao menos um (`H_2O`, `CO_2`, `C_6H_12O_6`). */
const TOKEN_QUIMICO = /^(?:[A-Z][a-z]?(?:_\d{1,2})?)+$/;
const CORRIDA = /[A-Za-z0-9_^{}]+/g;
/** Antes de um token assim, estes caracteres dizem endereço, caminho, usuário, etiqueta, dinheiro ou código. */
const ANTES_DE_CODIGO = /[/.:@#\\~$]/;
const SUBSCRITO: Readonly<Record<string, string>> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };

/**
 * Todos os caracteres fora do ASCII que o texto das fórmulas pode escrever na tela fora do desenho (texto linear, "H₂O", o grego e
 * os símbolos do LaTeX que não lê). O teste `glifos-nunito` confere cada um contra a Nunito que a web e o app carregam.
 */
export const CARACTERES_ESPECIAIS_DO_TEXTO: string = [
  ...new Set([CARACTERES_ESPECIAIS_DO_LINEAR, ...Object.values(SUBSCRITO), ...Object.values(GREGAS), ...Object.values(SIMBOLOS)].join("")),
].join("");

/** `x_AB` vira `x_{AB}`, que é o que a gramática lê. */
function paraLatex(token: string): string {
  return token.replace(/_([A-Za-z0-9]{2,3})(?![A-Za-z0-9}])/g, "_{$1}");
}

/** `H_2O` vira "H₂O": o índice da química é um número de átomos, escrito com o algarismo subscrito, sem sublinhado. */
function quimicaEmTexto(token: string): string {
  return token.replace(/_(\d{1,2})/g, (_inteiro, digitos: string) => [...digitos].map((digito) => SUBSCRITO[digito]).join(""));
}

/** O token solto numa lição de matemática: fórmula (`x_A`, `b^2`), fórmula química em texto (`H₂O`) ou nada (null). */
function lerTokenSolto(texto: string, inicio: number, fim: number): Parte | string | null {
  const token = texto.slice(inicio, fim);
  if (!(token.includes("_") || token.includes("^"))) return null;
  // Precisa ser uma palavra inteira, sem endereço, caminho, e-mail, código ou dinheiro em volta: `$x_A$` só reabre se nada colar.
  if (ehDePalavra(texto[inicio - 1]) || ehDePalavra(texto[fim]) || ANTES_DE_CODIGO.test(texto[inicio - 1] ?? "")) return null;
  if (/^[(/@.]\S|^\.[A-Za-z]/.test(texto.slice(fim, fim + 2))) return null;
  if (TOKEN_DE_LETRA.test(token) || TOKEN_DE_NUMERO.test(token)) {
    const lida = lerFormula(paraLatex(token));
    if (!lida.ok || !formulaCabeNaLinha(lida.arvore)) return null;
    return { tipo: "marca", segmentos: [segmentoDeFormula(lida.arvore, lida.canonica)], falado: falarFormula(lida.arvore), linear: formulaLinear(lida.arvore), latex: lida.canonica };
  }
  if (token.includes("_") && !token.includes("^") && TOKEN_QUIMICO.test(token)) return quimicaEmTexto(token);
  return null;
}

/* ----- A conta curta solta: "x = 3", "a + b", "y − 2" (letra sozinha, sinal, número ou letra) ----- */

const PEDACO_DO_EXPOENTE = String.raw`(?:\^(?:\{[A-Za-z0-9]{1,3}\}|\d{1,3}|[A-Za-z]))`;
/** Um termo da conta curta: uma letra sozinha (com índice e expoente, se tiver) ou um número, com sinal e vírgula decimal: `x`, `x_A`, `b^2`, `-3`, `3,5`. */
const TERMO_DA_CONTA = String.raw`(?:[A-Za-zΔπ](?:_(?:\{[A-Za-z0-9]{1,3}\}|[A-Za-z]{1,2}|\d{1,3}))?${PEDACO_DO_EXPOENTE}?|[−-]?\d+(?:[.,]\d+)?${PEDACO_DO_EXPOENTE}?)`;
/** Entre dois termos: `=`, `+`, `×`, `÷`, `−`, `<`, `>`, `≤`, `≥`, `≠`, `*` (com espaço ou sem) ou ` - `, ` · `, ` / ` (espaço dos dois lados). */
const SINAL_DA_CONTA = String.raw`(?:\s?(?:=|\+|×|÷|−|<|>|≤|≥|≠|\*)\s?|\s(?:-|·|/)\s)`;
const CONTA_CURTA = new RegExp(String.raw`(?<![\p{L}\p{N}_.\\/$@#~:-])${TERMO_DA_CONTA}(?:${SINAL_DA_CONTA}${TERMO_DA_CONTA})+(?![\p{L}\p{N}_])`, "gu");

/**
 * A conta curta como fórmula, ou null: precisa ler e ter ao menos uma variável ou um símbolo grego (Δ, π): "Δ ≠ 0" é conta,
 * "3 + 4 = 7" fica texto (o que não tem letra não mistura peso nem itálico com o resto). Uma letra solta no meio de uma palavra ("lado x", "a casa") não é conta: só vira fórmula
 * com marca. "2x", "4ac" e "x²" em Unicode também ficam texto.
 */
function lerContaCurta(trecho: string): Parte | null {
  const fonte = paraLatex(trecho.replace(/(\d),(\d)/g, "$1.$2"));
  const lida = lerFormula(barraSimplesEmFracao(fonte));
  if (!lida.ok) return null;
  let temVariavel = false;
  percorrerFormula(lida.arvore, (no) => {
    if (no.tipo === "variavel" || no.tipo === "simbolo") temVariavel = true;
  });
  if (!temVariavel) return null;
  const parte = marcaDe(fonte);
  return parte.tipo === "marca" && parte.latex !== null ? parte : null;
}

function partirPeloQueSePareceFormula(texto: string): Parte[] {
  const saida: Parte[] = [];
  let cursor = 0;
  for (const achado of texto.matchAll(CONTA_CURTA)) {
    const inicio = achado.index ?? 0;
    const conta = lerContaCurta(achado[0]);
    if (!conta) continue;
    saida.push(...partirPelosTokens(texto.slice(cursor, inicio)));
    saida.push(conta);
    cursor = inicio + achado[0].length;
  }
  saida.push(...partirPelosTokens(texto.slice(cursor)));
  return saida;
}

function partirPelosTokens(texto: string): Parte[] {
  const saida: Parte[] = [];
  let cursor = 0;
  const textoAte = (fim: number): void => {
    if (fim > cursor) saida.push({ tipo: "texto", texto: texto.slice(cursor, fim) });
  };
  for (const achado of texto.matchAll(CORRIDA)) {
    const inicio = achado.index ?? 0;
    const fim = inicio + achado[0].length;
    const lido = lerTokenSolto(texto, inicio, fim);
    if (lido === null) continue;
    textoAte(inicio);
    saida.push(typeof lido === "string" ? { tipo: "texto", texto: lido } : lido);
    cursor = fim;
  }
  textoAte(texto.length);
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

/** O texto em partes: o que fica entre marcas é texto (sem LaTeX cru), e cada marca vem lida. Com `heuristica`, os tokens soltos também. */
function partirEmPartes(texto: string, heuristica: boolean): Parte[] {
  if (typeof texto !== "string" || texto === "") return [];
  const partes: Parte[] = [];
  let corrente = "";
  const fecharTexto = () => {
    if (!corrente) return;
    const limpo = semLatexCru(corrente);
    partes.push(...(heuristica ? partirPeloQueSePareceFormula(limpo) : [{ tipo: "texto" as const, texto: limpo }]));
    corrente = "";
  };
  let i = 0;
  while (i < texto.length) {
    if (texto[i] === "$") {
      const marca = lerMarca(texto, i);
      if (marca) {
        fecharTexto();
        partes.push(marcaDe(marca.conteudo));
        i = marca.fim;
        continue;
      }
    }
    corrente += texto[i];
    i += 1;
  }
  fecharTexto();
  return partes;
}

/**
 * Parte um texto em pedaços de texto e fórmulas em linha, na ordem. Fórmula marcada com `$…$` que lê e cabe na linha vira um
 * segmento `formula`; a que lê mas não cabe (fração composta, raiz, matriz, ou larga demais) vira uma SEQUÊNCIA de segmentos
 * `texto` e `formula`, com cada variável, índice e expoente desenhados e só o resto em texto ("(" + x_A + " + " + x_B + ") ÷ 2");
 * a fração simples (`$1/2$`, `\frac{a}{b}`) é uma fórmula "a/b". A marca que não lê (comando de fora da lista) cai em texto
 * linear, com a mesma pontuação em volta, e nunca derruba o texto. O texto que sobra passa intacto; LaTeX cru fora das marcas vira
 * texto linear (sem barra e sem chave). Por padrão só o que está marcado é fórmula: com `heuristica`, os tokens soltos e
 * inequívocos (`x_A`, `b^2`) também. Nenhum segmento de texto sai vazio; texto sem matemática volta como um segmento só.
 */
export function partirTextoComFormulas(texto: string, opcoes: OpcoesDoTexto = {}): SegmentoDeTexto[] {
  const segmentos: SegmentoDeTexto[] = [];
  for (const parte of partirEmPartes(texto, opcoes.heuristica ?? false)) {
    if (parte.tipo === "texto") segmentos.push({ tipo: "texto", texto: parte.texto });
    else segmentos.push(...parte.segmentos);
  }
  return juntarVizinhos(segmentos);
}

/** O texto para quem não desenha fórmula (cliente antigo): cada fórmula marcada em texto linear, sem cifrão nem LaTeX cru. */
export function textoSemFormulas(texto: string): string {
  return partirEmPartes(texto, false).map((parte) => (parte.tipo === "texto" ? parte.texto : parte.linear)).join("");
}

/**
 * O texto que o leitor de tela lê: as frases como estão e cada fórmula marcada pelo texto falado da ÁRVORE INTEIRA ("x índice G é
 * igual a …"), mesmo quando ela vai desenhada em peças. Nunca lê um sublinhado. É o rótulo de acessibilidade do parágrafo.
 */
export function falarTextoComFormulas(texto: string): string {
  const partes = partirEmPartes(texto, false).map((parte) => (parte.tipo === "texto" ? parte.texto : ` ${parte.falado} `));
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

/** Há no texto uma marca `$…$` cuja fórmula LÊ (`$HOME e ${a}+${b}$` de um script de shell não conta)? É o sinal de lição de matemática. */
export function contemFormulaMarcada(texto: string): boolean {
  return partirEmPartes(texto, false).some((parte) => parte.tipo === "marca" && parte.latex !== null);
}

/** Tem alguma fórmula marcada no texto (ou reconhecida, com `heuristica`)? */
export function temFormulaNoTexto(texto: string, opcoes: OpcoesDoTexto = {}): boolean {
  return partirTextoComFormulas(texto, opcoes).some((segmento) => segmento.tipo === "formula");
}

function guardado(partes: readonly Parte[], manterMarcas: boolean): string {
  return partes.map((parte) => (parte.tipo === "texto" ? parte.texto : manterMarcas && parte.latex !== null ? `$${parte.latex}$` : parte.linear)).join("");
}

/**
 * O texto como o servidor o guarda: as fórmulas marcadas que leem ficam entre cifrões, na forma canônica (cabendo ou não em linha:
 * quem lê decide desenhá-las inteiras ou em peças, e a fala sai da árvore); as que não leem viram texto linear; LaTeX cru fora de
 * marca vira texto linear. Com `manterMarcas` falso (legenda, `alt`), tudo vira texto linear. Os tokens soltos (`x_A`) ficam como
 * a IA escreveu (`marcarFormulasSoltas` os marca, nas lições de matemática).
 */
export function normalizarTextoComFormulas(texto: string, manterMarcas = true): string {
  return guardado(partirEmPartes(texto, false), manterMarcas);
}

/**
 * Como `normalizarTextoComFormulas`, e os tokens soltos e inequívocos (`x_A`, `b^2`) também ganham a marca (`$x_A$`); a fórmula
 * química (`H_2O`) vira "H₂O". É o que o servidor faz no texto das lições de matemática, e só nelas (spec 15, seção 9): numa lição
 * de programação, "x_1 = 3 e print(x_1)" não é fórmula. Idempotente.
 */
export function marcarFormulasSoltas(texto: string): string {
  return guardado(partirEmPartes(texto, true), true);
}
