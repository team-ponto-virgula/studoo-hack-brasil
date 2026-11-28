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
  rightarrow: "→", infty: "∞", in: "∈", cup: "∪", cap: "∩", ldots: "…", cdots: "…", circ: "°", degree: "°", angle: "∠", perp: "⊥", parallel: "∥",
  triangle: "△", sum: "∑", prod: "∏", int: "∫", partial: "∂", nabla: "∇", subset: "⊂", supset: "⊃", notin: "∉", forall: "∀", exists: "∃", Rightarrow: "⇒",
  Leftrightarrow: "⇔", leftrightarrow: "↔", sim: "∼", equiv: "≡", propto: "∝", mp: "∓",
};
/** O nome de função que a tela mostra (notação brasileira): "sen", nunca "sin"; "tg", nunca "tan". */
const FUNCOES: Readonly<Record<string, string>> = {
  sin: "sen", sen: "sen", cos: "cos", tan: "tg", tg: "tg", cot: "cotg", cotg: "cotg", sec: "sec", csc: "cossec", cosec: "cossec", ln: "ln", log: "log",
  arcsin: "arcsen", arcsen: "arcsen", arccos: "arccos", arctan: "arctg", arctg: "arctg", lim: "lim",
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
  // A matriz que o leitor recusou (um determinante que não é quadrado, uma célula vazia) lê como a conta escreve: "det[1, 2; 3, 4]", nunca com "vmatrix",
  // "begin", "end" nem "&" na tela. O `\\` que separa as linhas pode ter vindo com uma barra só (o JSON a come) antes de um espaço.
  texto = texto.replace(/\\begin\s*\{([bpv]?)matrix\}([\s\S]*?)\\end\s*\{\1matrix\}/g, (_inteiro, tipo: string, miolo: string) => {
    const linhas = miolo.split(/\\\\|\\(?=\s)/).map((linha) => linha.trim()).filter((linha) => linha !== "");
    const escritas = linhas.map((linha) => linha.split("&").map((celula) => linearizarTolerante(celula)).join(", "));
    return `${tipo === "v" ? "det" : ""}[${escritas.join("; ")}]`;
  });
  // O grau (`30^\circ`, `30^{\circ}`) vira "30°" já: depois, o `^{…}` o faria "30^(°)".
  texto = texto.replace(/\^\s*(?:\{\s*\\circ\s*\}|\\circ(?![A-Za-z]))/g, "°");
  for (let volta = 0; volta < 5; volta += 1) {
    const antes = texto;
    texto = texto
      .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_inteiro, a: string, b: string) => {
        const simples = (termo: string): boolean => /^[\w.,−-]+$/u.test(termo.trim());
        if (simples(a) && simples(b)) return `${a.trim()}/${b.trim()}`;
        return `${simples(a) ? a.trim() : `(${a.trim()})`} ÷ ${simples(b) ? b.trim() : `(${b.trim()})`}`;
      })
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (_inteiro, a: string) => (/^[\w.,−-]+$/u.test(a.trim()) ? `√${a.trim()}` : `√(${a.trim()})`))
      .replace(/\\(?:text|textit|mathrm|mathbb|mathcal|mathit|mathsf|mathtt|textbf|mathbf|boldsymbol|underline|cancel|operatorname)\s*\{([^{}]*)\}/g, "$1")
      .replace(/\\(?:foco|procurado|resposta|overline|vec|hat|bar)\s*\{([^{}]*)\}/g, "$1")
      // Um comando desconhecido com argumento (`\unknown{y}`) lê "unknown(y)", e a função com chaves (`\sin{x}`) lê "sen x": nada cola nem some.
      .replace(/\\([A-Za-z]+)\s*\{([^{}]*)\}/g, (inteiro, nome: string, argumento: string) => {
        if (/^(?:d?frac|sqrt|begin|end|left|right)$/.test(nome) || GREGAS[nome] || SIMBOLOS[nome]) return inteiro;
        if (FUNCOES[nome]) return `${FUNCOES[nome]} ${argumento}`;
        return nome.length > 1 ? `${nome}(${argumento})` : inteiro;
      })
      .replace(/\^\{([^{}]*)\}/g, (_inteiro, a: string) => (a.length === 1 && SOBRESCRITO[a] ? SOBRESCRITO[a] : `^(${a})`))
      .replace(/_\{([^{}]*)\}/g, (_inteiro, a: string) => `_${a}`);
    if (texto === antes) break;
  }
  // Uma peça desconhecida NUNCA some: a função vira o nome da tela ("\sin x" lê "sen x"), o símbolo conhecido vira o símbolo e qualquer outro comando
  // fica com o nome, sem a barra ("\foo x" lê "foo x"). Apagar o comando mudava o sentido ("h(x) = \sin x" lia "h(x) = x").
  texto = texto
    .replace(/\^([0-9])(?![0-9])/g, (_inteiro, a: string) => SOBRESCRITO[a] ?? `^${a}`)
    .replace(/\\([A-Za-z]+)/g, (inteiro, nome: string) => GREGAS[nome] ?? SIMBOLOS[nome] ?? FUNCOES[nome] ?? (nome.length > 1 ? nome : inteiro))
    .replace(/[\\{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return texto;
}

/**
 * O cifrão que abre LaTeX (`$\begin{vmatrix}…`, `$ \sin x $`, uma marca que passou do limite): num texto de matemática, é cifrão de fórmula, não de
 * dinheiro. Serve a quem decide se a lição é de matemática e se há cifrão cru para tirar.
 */
export function contemCifraoDeLatex(texto: string): boolean {
  return typeof texto === "string" && texto.includes("$") && /\$[^$\n]{0,400}?\\[A-Za-z]/.test(texto);
}

/**
 * O texto com o LaTeX que ficou solto (sem cifrões) trocado pelo texto linear: nunca barra, nunca chave na tela, e nunca o cifrão de uma fórmula que
 * não virou marca (comprida demais, com espaço colado no cifrão, sem o par): os cifrões que cercam LaTeX saem junto com ele. O de dinheiro
 * ("R$ 5,00", "$ 80") não tem LaTeX dentro e fica.
 */
function semLatexCru(texto: string): string {
  if (!/[\\{}]/.test(texto)) return texto;
  // O espaço das pontas fica (um só): o trecho vizinha de uma marca ou de uma corrida ("e " antes de `$…$`) não pode colar nela.
  const inicio = /^\s/.test(texto) ? " " : "";
  const fim = /\s$/.test(texto) ? " " : "";
  return inicio + linearizarTolerante(semCifraoDeLatex(texto).replace(/\s+/g, " ")) + fim;
}

/** Os cifrões que cercam LaTeX e não formaram marca saem junto com ele; os de dinheiro ficam. Idempotente. */
function semCifraoDeLatex(texto: string): string {
  if (!texto.includes("$")) return texto;
  return texto
    .replace(/\${1,2}([^$\n]*\\[A-Za-z][^$\n]*)\${1,2}/g, " $1 ")
    .replace(/\${1,2}(?=\\[A-Za-z])/g, "");
}

/* ----- A marcação com cifrões ----- */

/** A fórmula lê até 300 caracteres (`LIMITES_FORMULA`); a marca que a cerca ganha uma folga de espaços e de `\\left`: uma conta de 201 caracteres era "cifrão cru". */
const TAMANHO_MAXIMO_DA_MARCA = 320;

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
  // Um cifrão no meio que não fechou (`custa $5 e a conta $x \\times 2$`): ele é o começo de outra marca, não parte desta; o primeiro era dinheiro.
  let passouPorOutroCifrao = false;
  for (let j = inicio + comprimento + 1; j < limite; j += 1) {
    if (texto[j] === "\n") return null;
    if (texto[j] !== "$" || (comprimento === 2 && texto[j + 1] !== "$")) continue;
    const conteudo = texto.slice(inicio + comprimento, j);
    if (ehDePalavra(texto[j + comprimento]) || (ehEspaco(texto[j - 1]) && !fechaDepoisDeEspaco(conteudo))) {
      passouPorOutroCifrao = true;
      continue;
    }
    return passouPorOutroCifrao ? null : { conteudo, fim: j + comprimento };
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

/* ----- O LaTeX solto, fora de $…$ (marco 13b) ----- */

/**
 * Os comandos que dizem "isto é matemática" quando aparecem SEM cifrão: o que a IA escreve solto numa opção, numa dica ou num retorno (`\begin{bmatrix}…`,
 * `2 \times 3 = 6`, `\frac{1}{2}`). São a âncora de uma corrida de LaTeX solto e o sinal de lição de matemática (`contemLatexSolto`).
 */
const COMANDOS_ANCORA = "begin|d?frac|tfrac|sqrt|times|cdot|div|leq?|geq?|neq?|approx|pm|mp|sin|cos|tan|tg|cot|cotg|sec|csc|cosec|ln|log|lim|arcsin|arccos|arctan|arcsen|arctg|pi|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|rho|sigma|phi|omega|Delta|Gamma|Sigma|Omega|Pi|infty|to|rightarrow|circ|degree|sum|prod|int|cdots|ldots|in|cup|cap|subset|angle|perp|parallel|triangle";
const ANCORA = new RegExp(`^(?:${COMANDOS_ANCORA})$`);
const COMANDO_SOLTO = new RegExp(String.raw`\\(?:${COMANDOS_ANCORA})(?![A-Za-z])`);
/** Os comandos que são um sinal entre dois termos: um `e` solto colado neles não é "e" de frase, é letra da conta. */
const COMANDO_DE_SINAL = new Set(["times", "cdot", "div", "le", "leq", "ge", "geq", "ne", "neq", "approx", "pm", "mp", "to", "rightarrow", "in"]);
/** Quantas chaves cada comando de argumento leva (`\frac{a}{b}`: duas; `\sqrt{x}` e `\text{…}`: uma). */
const ARGUMENTOS_DO_COMANDO: Readonly<Record<string, number>> = {
  frac: 2, dfrac: 2, tfrac: 2, binom: 2, sqrt: 1, text: 1, textit: 1, textbf: 1, mathrm: 1, mathbb: 1, mathit: 1, operatorname: 1, vec: 1, overline: 1, hat: 1, bar: 1, underline: 1,
};
const LIMITE_DA_CORRIDA = 60;
/** Quantas leituras da gramática uma corrida de LaTeX solto pode custar por texto: o texto estranho (uma conta que nunca fecha) não prende o servidor. */
const ORCAMENTO_DE_LEITURAS = 300;

type TipoDeFicha = "ancora" | "comando" | "numero" | "variavel" | "operador" | "espaco" | "quebra";
interface Ficha {
  tipo: TipoDeFicha;
  inicio: number;
  fim: number;
  /** A letra solta que pode ser a conjunção ou o artigo ("a", "e", "o"), sozinha entre espaços. */
  talvezPalavra?: boolean;
}

/** O índice depois do grupo balanceado que abre em `texto[i]` (`{…}` ou `[…]`), ou -1 se não fecha. */
function fimDoGrupo(texto: string, i: number, abre: string, fecha: string): number {
  let nivel = 0;
  for (let j = i; j < texto.length; j += 1) {
    if (texto[j] === "\\") { j += 1; continue; }
    if (texto[j] === abre) nivel += 1;
    else if (texto[j] === fecha) {
      nivel -= 1;
      if (nivel === 0) return j + 1;
    }
  }
  return -1;
}

/** Os expoentes e índices que vêm colados num termo (`x^2`, `a_{n+1}`, `10^{-3}`, `x_1^2`): onde terminam. */
function fimDosScripts(texto: string, inicio: number): number {
  let i = inicio;
  for (;;) {
    if (texto[i] !== "^" && texto[i] !== "_") return i;
    const proximo = texto[i + 1];
    if (proximo === "{") {
      const fim = fimDoGrupo(texto, i + 1, "{", "}");
      if (fim < 0) return i;
      i = fim;
    } else if (proximo !== undefined && /[A-Za-z0-9]/.test(proximo)) i += 2;
    else if (proximo === "-" && /\d/.test(texto[i + 2] ?? "")) i += 3;
    else if (proximo === "\\") {
      const nome = /^\\[A-Za-z]+/.exec(texto.slice(i + 1))?.[0];
      if (!nome) return i;
      i += 1 + nome.length;
    } else return i;
  }
}

const escaparParaRegex = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Lê o comando que começa na barra de `texto[i]`: o ambiente `\begin…\end` inteiro, o comando com os argumentos e os scripts, ou nada (null: comando que não fecha). */
function lerComandoSolto(texto: string, i: number): { fim: number; nome: string } | null {
  const nome = /^\\([A-Za-z]+)/.exec(texto.slice(i, i + 40))?.[1];
  if (!nome) return null;
  let fim = i + 1 + nome.length;
  if (nome === "begin") {
    const ambiente = /^\s*\{([A-Za-z*]+)\}/.exec(texto.slice(fim));
    if (!ambiente) return null;
    const marcador = new RegExp(String.raw`\\begin\s*\{${escaparParaRegex(ambiente[1])}\}|\\end\s*\{${escaparParaRegex(ambiente[1])}\}`, "g");
    marcador.lastIndex = fim + ambiente[0].length;
    let nivel = 1;
    for (let achado = marcador.exec(texto); achado; achado = marcador.exec(texto)) {
      nivel += achado[0].startsWith("\\begin") ? 1 : -1;
      if (nivel === 0) return { fim: achado.index + achado[0].length, nome };
    }
    return null;
  }
  if (nome === "left" || nome === "right") {
    const delimitador = /^\s*(?:\\[{}|]|\\\||[()[\]|.])/.exec(texto.slice(fim));
    return delimitador ? { fim: fim + delimitador[0].length, nome } : null;
  }
  if (nome === "sqrt" && texto[fim] === "[") {
    const raiz = fimDoGrupo(texto, fim, "[", "]");
    if (raiz < 0) return null;
    fim = raiz;
  }
  for (let argumento = 0; argumento < (ARGUMENTOS_DO_COMANDO[nome] ?? 0); argumento += 1) {
    const espacos = /^\s*/.exec(texto.slice(fim))?.[0].length ?? 0;
    if (texto[fim + espacos] !== "{") return null;
    const depois = fimDoGrupo(texto, fim + espacos, "{", "}");
    if (depois < 0) return null;
    fim = depois;
  }
  return { fim: fimDosScripts(texto, fim), nome };
}

/** O texto cortado em fichas de matemática (comandos, números, letras soltas, sinais) e de quebra (palavra, pontuação, o que não é conta). */
function fichasDeMatematica(texto: string): Ficha[] {
  const fichas: Ficha[] = [];
  let profundidade = 0;
  let i = 0;
  const por = (tipo: TipoDeFicha, fim: number, extra: Partial<Ficha> = {}) => {
    fichas.push({ tipo, inicio: i, fim, ...extra });
    i = fim;
  };
  while (i < texto.length) {
    const c = texto[i];
    if (/\s/.test(c)) {
      let fim = i + 1;
      while (fim < texto.length && /\s/.test(texto[fim])) fim += 1;
      por("espaco", fim);
    } else if (c === "\\") {
      const proximo = texto[i + 1];
      if (proximo !== undefined && /[,;:! ]/.test(proximo)) por("espaco", i + 2);
      else if (proximo === "{" || proximo === "}") por("operador", i + 2);
      else {
        const comando = lerComandoSolto(texto, i);
        if (!comando) por("quebra", Math.min(texto.length, i + 1 + (/^\\[A-Za-z]+/.exec(texto.slice(i))?.[0].length ?? 1) - 1));
        else if (/^q?quad$/.test(comando.nome)) por("espaco", comando.fim);
        else por(ANCORA.test(comando.nome) ? "ancora" : "comando", comando.fim, COMANDO_DE_SINAL.has(comando.nome) ? { talvezPalavra: false } : {});
      }
    } else if (/\d/.test(c)) {
      let fim = i + 1;
      while (fim < texto.length && (/\d/.test(texto[fim]) || (/[.,]/.test(texto[fim]) && /\d/.test(texto[fim + 1] ?? "")))) fim += 1;
      por("numero", fimDosScripts(texto, fim));
    } else if (/[A-Za-z]/.test(c)) {
      let fim = i + 1;
      while (fim < texto.length && /[A-Za-z]/.test(texto[fim])) fim += 1;
      if (fim - i > 1 || /[A-Za-z]/.test(texto[fim] ?? "")) por("quebra", fim);
      else {
        const depois = fimDosScripts(texto, fim);
        const isolada = depois === fim && /[aeo]/.test(c) && (i === 0 || /\s/.test(texto[i - 1])) && (fim >= texto.length || /\s/.test(texto[fim]));
        por("variavel", depois, isolada ? { talvezPalavra: true } : {});
      }
    } else if (/[+\-−=<>×÷·*/|]/.test(c)) por("operador", i + 1);
    else if (c === "(" || c === "[") { profundidade += 1; por("operador", i + 1); }
    else if (c === ")" || c === "]") { profundidade = Math.max(0, profundidade - 1); por("operador", i + 1); }
    else if ((c === "," || c === ";") && profundidade > 0) por("operador", i + 1);
    else por("quebra", i + 1);
  }
  return fichas;
}

/** O pedaço de texto de um grupo de fichas `[de, ate]`. */
const textoDasFichas = (texto: string, fichas: readonly Ficha[], de: number, ate: number): string => texto.slice(fichas[de].inicio, fichas[ate].fim);

/**
 * As corridas de LaTeX solto de um texto: pedaços `[inicio, fim)` que são uma fórmula escrita sem cifrão e que a gramática lê, com os termos em volta que fazem parte
 * da conta (`2 \times 3 = 6`, `x \leq 5`, `A = \begin{bmatrix}…\end{bmatrix}`, `\pi r^2`). A palavra, a pontuação e o "e" de frase param a corrida; o `\begin` sem `\end`
 * e o comando de fora da lista ficam de fora (esses saem em texto linear, como sempre).
 */
function corridasDeLatexSolto(texto: string): { inicio: number; fim: number }[] {
  const fichas = fichasDeMatematica(texto);
  const grupos: Ficha[][] = [];
  let atual: Ficha[] = [];
  const vizinho = (posicao: number, passo: -1 | 1): Ficha | undefined => {
    for (let j = posicao + passo; j >= 0 && j < fichas.length; j += passo) if (fichas[j].tipo !== "espaco") return fichas[j];
    return undefined;
  };
  const sinalDoComando = (ficha: Ficha): boolean => ficha.tipo === "ancora" && COMANDO_DE_SINAL.has(/^\\([A-Za-z]+)/.exec(texto.slice(ficha.inicio))?.[1] ?? "");
  const ehSinal = (ficha: Ficha | undefined): boolean => ficha !== undefined && (ficha.tipo === "operador" || sinalDoComando(ficha));
  /** A corrida não abre com um sinal que pede o termo da esquerda (`=`, `+`, `×`, `\leq`…) nem fecha com um que pede o da direita (`=`, `+`, `−`, `(`…): a conta começada, `… = ___`, fica de fora. */
  const abrePor = (ficha: Ficha): boolean => !(sinalDoComando(ficha) || (ficha.tipo === "operador" && /[+=<>×÷·*/)\],;]/.test(texto[ficha.inicio])));
  const fechaPor = (ficha: Ficha): boolean => !(sinalDoComando(ficha) || (ficha.tipo === "operador" && /[+\-−=<>×÷·*/(\[,;]/.test(texto[ficha.inicio])));
  fichas.forEach((ficha, posicao) => {
    const quebra = ficha.tipo === "quebra" || (ficha.talvezPalavra === true && ficha.tipo === "variavel" && !ehSinal(vizinho(posicao, -1)) && !ehSinal(vizinho(posicao, 1)));
    if (quebra) {
      if (atual.length > 0) grupos.push(atual);
      atual = [];
    } else atual.push(ficha);
  });
  if (atual.length > 0) grupos.push(atual);
  const corridas: { inicio: number; fim: number }[] = [];
  let leituras = 0;
  for (const grupo of grupos) {
    // Sem espaço nas pontas: a corrida começa e termina numa ficha de matemática.
    const util = grupo.filter((ficha) => ficha.tipo !== "espaco");
    if (!util.some((ficha) => ficha.tipo === "ancora") || grupo.length > LIMITE_DA_CORRIDA) continue;
    let cursor = 0;
    while (cursor < grupo.length) {
      let achada: [number, number] | null = null;
      for (let de = cursor; de < grupo.length && !achada; de += 1) {
        if (grupo[de].tipo === "espaco" || !abrePor(grupo[de])) continue;
        for (let ate = grupo.length - 1; ate >= de; ate -= 1) {
          if (grupo[ate].tipo === "espaco" || !fechaPor(grupo[ate])) continue;
          if (!grupo.slice(de, ate + 1).some((ficha) => ficha.tipo === "ancora")) break;
          if (leituras >= ORCAMENTO_DE_LEITURAS) return corridas;
          leituras += 1;
          if (lerFormula(barraSimplesEmFracao(textoDasFichas(texto, grupo, de, ate))).ok) { achada = [de, ate]; break; }
        }
      }
      if (!achada) break;
      corridas.push({ inicio: grupo[achada[0]].inicio, fim: grupo[achada[1]].fim });
      cursor = achada[1] + 1;
    }
  }
  return corridas;
}

/**
 * O texto de uma lição de matemática com o LaTeX SOLTO (sem cifrão) que a gramática lê já como marca: `\begin{bmatrix} 2 & 8 \\ 7 & 7 \end{bmatrix}` numa opção vira uma fórmula
 * desenhada, e `Confira 2 \times 1 + 0 \times 2 = 2.` marca só a conta. O que não lê (comando de fora da lista, `\begin` sem `\end`) segue para o texto linear, sem barra.
 */
function partirPeloLatexSolto(texto: string): Parte[] {
  const corridas = texto.includes("\\") ? corridasDeLatexSolto(texto) : [];
  if (corridas.length === 0) return [{ tipo: "texto", texto }];
  const saida: Parte[] = [];
  let cursor = 0;
  for (const { inicio, fim } of corridas) {
    if (inicio > cursor) saida.push({ tipo: "texto", texto: texto.slice(cursor, inicio) });
    saida.push(marcaDe(texto.slice(inicio, fim)));
    cursor = fim;
  }
  if (cursor < texto.length) saida.push({ tipo: "texto", texto: texto.slice(cursor) });
  return saida;
}

/**
 * Há LaTeX solto (um comando de matemática fora de `$…$`) no texto? É o sinal de lição de matemática quando as palavras do assunto não bastam, e de texto que o cliente sem
 * cabeçalho precisa receber linear. `\text`, `\left`, `\quad` e os comandos de fora da lista não contam: sozinhos não dizem nada.
 */
export function contemLatexSolto(texto: string): boolean {
  if (typeof texto !== "string" || !texto.includes("\\")) return false;
  let fora = "";
  let i = 0;
  while (i < texto.length) {
    if (texto[i] === "$") {
      const marca = lerMarca(texto, i);
      if (marca) {
        fora += " ";
        i = marca.fim;
        continue;
      }
    }
    fora += texto[i];
    i += 1;
  }
  return COMANDO_SOLTO.test(fora);
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

/** Dinheiro sem "R": `$5`, `$25,00`, `$1.250,50` (o número fecha com espaço, pontuação ou o fim). */
const DINHEIRO_COLADO = /^\$\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?(?![\p{L}\p{N}^_{(\\])/u;

/**
 * Num texto de MATEMÁTICA, o `$` único que não formou par e vem colado na letra, no número ou na barra que o segue ("uma linha de $A com uma coluna de B": a
 * IA abriu `$A$` e perdeu o par) é marcador solto, não dinheiro: sai do texto. Ficam o de dinheiro ("R$ 25,00" e "US$10" têm letra antes; "$ 5" tem espaço
 * depois; "$5" e "$25,00" são preço) e o que está depois de letra ou número ("5$"). Fora de matemática ninguém chama isto ("$HOME" é de shell).
 */
function ehCifraoSolto(texto: string, posicao: number): boolean {
  const anterior = texto[posicao - 1];
  if (anterior !== undefined && ehDePalavra(anterior)) return false;
  const proximo = texto[posicao + 1];
  if (proximo === undefined || ehEspaco(proximo) || proximo === "$") return false;
  return !DINHEIRO_COLADO.test(texto.slice(posicao));
}

/** O texto em partes: o que fica entre marcas é texto (sem LaTeX cru), e cada marca vem lida. Com `heuristica`, os tokens soltos também. */
function partirEmPartes(texto: string, heuristica: boolean): Parte[] {
  if (typeof texto !== "string" || texto === "") return [];
  const partes: Parte[] = [];
  let corrente = "";
  const fecharTexto = () => {
    if (!corrente) return;
    // Com LaTeX (ou chaves) no trecho, os cifrões que o cercam saem e o espaço é um só, como o texto linear sempre fez.
    const solto = /[\\{}]/.test(corrente) ? semCifraoDeLatex(corrente).replace(/\s+/g, " ") : corrente;
    if (heuristica) {
      // O LaTeX solto que a gramática lê vira marca (desenhada); o resto do texto vai para o texto linear e para os tokens soltos, como sempre.
      for (const pedaco of partirPeloLatexSolto(solto)) {
        if (pedaco.tipo === "texto") partes.push(...partirPeloQueSePareceFormula(semLatexCru(pedaco.texto)));
        else partes.push(pedaco);
      }
    } else {
      // Sem a heurística o LaTeX solto vira texto linear, corrida por corrida: a frase inteira nunca é lida como uma conta ("x \\leq 5 e y \\geq 2" não vira "x ≤ 5ey ≥ 2").
      for (const pedaco of partirPeloLatexSolto(solto)) partes.push({ tipo: "texto" as const, texto: pedaco.tipo === "texto" ? semLatexCru(pedaco.texto) : pedaco.linear });
    }
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
 * O texto de uma lição de MATEMÁTICA sem o `$` solto: as marcas ficam como estão e o `$` único que não formou par e vem colado na letra ou no número que o
 * segue sai ("uma linha de $A com uma coluna de B" vira "uma linha de A com uma coluna de B"). Quem chama é o servidor, e só na lição de matemática: numa lição
 * de shell, "$HOME" é de shell. Idempotente.
 */
export function tirarCifraoSolto(texto: string): string {
  if (typeof texto !== "string" || !texto.includes("$")) return texto;
  let saida = "";
  let i = 0;
  while (i < texto.length) {
    if (texto[i] === "$") {
      const marca = lerMarca(texto, i);
      if (marca) {
        saida += texto.slice(i, marca.fim);
        i = marca.fim;
        continue;
      }
      if (ehCifraoSolto(texto, i)) {
        i += 1;
        continue;
      }
    }
    saida += texto[i];
    i += 1;
  }
  return saida;
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
