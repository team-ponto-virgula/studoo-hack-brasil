/*
 * Fórmulas (spec 15, seção 1): LaTeX restrito → árvore fechada.
 *
 * A IA escreve a fórmula num LaTeX pequeno; o Studoo a lê com este parser (sem `eval`, sem biblioteca), valida e desenha a
 * árvore. Tudo o que está fora da lista abaixo invalida a fórmula, que cai para o texto linear, e a lição continua.
 *
 * O que vale:
 * - números (`3`, `3.5`: o ponto decimal vem na fonte e a vírgula aparece na tela), variáveis de uma letra e vírgula ou
 *   ponto e vírgula como separador (`C = (4, 0)`); um par com decimal usa ponto e vírgula, para não confundir com a vírgula
 *   decimal: `(1.5, 2)` fica `(1.5; 2)` e aparece "(1,5; 2)";
 * - operadores `+ - \times \div = \neq < > \leq \geq \to` (e os apelidos `\cdot * / \ne \le \ge \rightarrow` e os
 *   caracteres `− × ÷ · ≠ ≤ ≥ →`, que viram o operador de sempre) e parênteses (`\left( … \right)` vale);
 * - `\frac{a}{b}`, `x^2`, `x_A`, `x_A^2`, `\sqrt{x}` (só a raiz quadrada), `\text{…}`, `\%`, e os dois símbolos gregos da fase 1,
 *   `\Delta` (discriminante) e `\pi` (círculo); os outros gregos (α, β, θ…) ficam para a fase 2 e invalidam a fórmula;
 * - `\begin{bmatrix|pmatrix|vmatrix} a & b \\ c & d \end{…}`, até 4 × 4 (`vmatrix` é o determinante e é quadrado);
 * - os três destaques `\foco{…}`, `\procurado{…}` e `\resposta{…}`, no máximo dois por fórmula e sem um dentro do outro.
 * Espaços (`\,`, `\;`, `\:`, `\!`, `\ `, `\quad`, `\qquad`) são aceitos e ignorados: quem decide o respiro é o motor.
 */

export const LIMITES_FORMULA = {
  caracteres: 300,
  profundidade: 6,
  nos: 200,
  destaques: 2,
  matrizes: 2,
  linhasDaMatriz: 4,
  colunasDaMatriz: 4,
  digitosDoNumero: 12,
  texto: 40,
} as const;

export type PapelDestaque = "foco" | "procurado" | "resposta";
export const PAPEIS_DESTAQUE: readonly PapelDestaque[] = ["foco", "procurado", "resposta"];

/** O menos fica como hífen na árvore; quem mostra usa o sinal de menos de verdade (`−`, U+2212). */
export type OperadorFormula = "+" | "-" | "×" | "÷" | "=" | "≠" | "<" | ">" | "≤" | "≥" | "→";

export type NoFormula =
  | { tipo: "numero"; valor: string }
  | { tipo: "variavel"; valor: string }
  /** O grego da fase 1: Δ (discriminante) e π. Reto, como número, com o contorno da Noto Sans Bold. */
  | { tipo: "simbolo"; valor: "Δ" | "π" }
  | { tipo: "operador"; valor: OperadorFormula }
  | { tipo: "separador"; valor: "," | ";" }
  | { tipo: "texto"; valor: string }
  | { tipo: "porcento" }
  | { tipo: "fracao"; numerador: NoFormula; denominador: NoFormula }
  /** Índice (`x_A`) e expoente (`x^2`) da mesma base: o índice desce e o expoente sobe, os dois retos. */
  | { tipo: "script"; base: NoFormula; indice?: NoFormula; expoente?: NoFormula }
  | { tipo: "raiz"; radicando: NoFormula }
  | { tipo: "parenteses"; conteudo: NoFormula }
  | { tipo: "sequencia"; itens: NoFormula[] }
  /** `barras` é o determinante; `colchetes`, a matriz (`pmatrix` também vira colchetes). */
  | { tipo: "matriz"; moldura: "colchetes" | "barras"; linhas: NoFormula[][] }
  | { tipo: "destaque"; papel: PapelDestaque; conteudo: NoFormula };

export type ResultadoFormula =
  | { ok: true; arvore: NoFormula; canonica: string }
  | { ok: false; erro: string };

class ErroFormula extends Error {}

function falhar(mensagem: string, posicao: number): never {
  throw new ErroFormula(`${mensagem} (posição ${posicao})`);
}

const OPERADORES_POR_COMANDO: Readonly<Record<string, OperadorFormula>> = {
  times: "×", cdot: "×", div: "÷", neq: "≠", ne: "≠", leq: "≤", le: "≤", geq: "≥", ge: "≥", to: "→", rightarrow: "→",
};

const OPERADORES_POR_CARACTERE: Readonly<Record<string, OperadorFormula>> = {
  "+": "+", "-": "-", "−": "-", "–": "-", "=": "=", "<": "<", ">": ">", "×": "×", "·": "×", "*": "×", "÷": "÷", "/": "÷",
  "≠": "≠", "≤": "≤", "≥": "≥", "→": "→",
};

const COMANDOS_DE_ESPACO = new Set([",", ";", ":", "!", " ", "quad", "qquad"]);
const MOLDURAS: Readonly<Record<string, "colchetes" | "barras">> = { bmatrix: "colchetes", pmatrix: "colchetes", vmatrix: "barras" };
const SOBRESCRITOS: Readonly<Record<string, string>> = { "²": "2", "³": "3" };

const ehDigito = (c: string | undefined): c is string => c !== undefined && c >= "0" && c <= "9";
const ehLetra = (c: string | undefined): c is string => c !== undefined && /^[A-Za-z]$/.test(c);

/** Só estas coisas entram dentro de `\text{…}`: letras (com os acentos do português), números, espaço e pontuação simples; todas têm glifo em `glifos.ts`. */
const TEXTO_PERMITIDO = /^[A-Za-zÀÁÂÃÇÉÊÍÓÔÕÚÜàáâãçéêíóôõúü0-9 .,;:!?()'’/%+=<>-]*$/u;

function podeTerScript(no: NoFormula): boolean {
  return no.tipo === "numero" || no.tipo === "variavel" || no.tipo === "simbolo" || no.tipo === "parenteses" || no.tipo === "sequencia" ||
    no.tipo === "fracao" || no.tipo === "raiz";
}

class Analisador {
  private i = 0;
  private nos = 0;
  private destaques = 0;
  private matrizes = 0;
  private dentroDeDestaque = false;

  constructor(private readonly s: string) {}

  raiz(): NoFormula {
    const no = this.sequencia(0, "raiz");
    if (no.tipo === "sequencia" && no.itens.length === 0) falhar("fórmula vazia", 0);
    return no;
  }

  private fim(): boolean {
    return this.i >= this.s.length;
  }

  private espacos(): void {
    while (!this.fim() && /\s/.test(this.s[this.i])) this.i += 1;
  }

  private adiante(texto: string): boolean {
    return this.s.startsWith(texto, this.i);
  }

  private contar(): void {
    this.nos += 1;
    if (this.nos > LIMITES_FORMULA.nos) falhar("fórmula grande demais", this.i);
  }

  private esperar(caractere: string): void {
    this.espacos();
    if (this.s[this.i] !== caractere) falhar(`esperava "${caractere}"`, this.i);
    this.i += 1;
  }

  private sequencia(profundidade: number, modo: "raiz" | "grupo" | "parenteses" | "celula" | "esquerda"): NoFormula {
    if (profundidade > LIMITES_FORMULA.profundidade) falhar("fórmula funda demais", this.i);
    const itens: NoFormula[] = [];
    for (;;) {
      this.espacos();
      if (this.fim()) {
        if (modo === "raiz") break;
        falhar("fórmula incompleta", this.i);
      }
      const c = this.s[this.i];
      if (c === "}") {
        if (modo === "grupo") break;
        falhar("chave sobrando", this.i);
      }
      if (c === ")") {
        if (modo === "parenteses") break;
        falhar("parêntese sobrando", this.i);
      }
      if (modo === "celula" && (c === "&" || this.adiante("\\\\") || this.adiante("\\end"))) break;
      if (modo === "esquerda" && this.adiante("\\right")) break;
      const item = this.item(profundidade);
      if (item) itens.push(item);
    }
    return itens.length === 1 ? itens[0] : { tipo: "sequencia", itens };
  }

  /** Um átomo e, se ele aceita, o índice e o expoente que vêm logo depois. Devolve null para o que só ocupa espaço. */
  private item(profundidade: number): NoFormula | null {
    const atomo = this.atomo(profundidade);
    if (!atomo) return null;
    this.contar();
    if (!podeTerScript(atomo)) {
      const proximo = this.s[this.i];
      if (proximo === "^" || proximo === "_") falhar("índice ou expoente sem base", this.i);
      return atomo;
    }
    let indice: NoFormula | undefined;
    let expoente: NoFormula | undefined;
    for (;;) {
      const antes = this.i;
      this.espacos();
      const c = this.s[this.i];
      if (c === "_" || c === "^") {
        this.i += 1;
        const argumento = this.argumentoDeScript(profundidade);
        if (c === "_") {
          if (indice) falhar("dois índices na mesma base", this.i);
          indice = argumento;
        } else {
          if (expoente) falhar("dois expoentes na mesma base", this.i);
          expoente = argumento;
        }
      } else if (c && c in SOBRESCRITOS) {
        if (expoente) falhar("dois expoentes na mesma base", this.i);
        expoente = { tipo: "numero", valor: SOBRESCRITOS[c] };
        this.i += 1;
      } else {
        this.i = antes;
        break;
      }
    }
    if (!indice && !expoente) return atomo;
    return { tipo: "script", base: atomo, ...(indice ? { indice } : {}), ...(expoente ? { expoente } : {}) };
  }

  /** O que vem depois de `_` ou `^`: um dígito, uma letra ou um grupo entre chaves (como no LaTeX). */
  private argumentoDeScript(profundidade: number): NoFormula {
    this.espacos();
    const c = this.s[this.i];
    if (c === "{") {
      this.i += 1;
      const conteudo = this.sequencia(profundidade + 1, "grupo");
      this.esperar("}");
      if (conteudo.tipo === "sequencia" && conteudo.itens.length === 0) falhar("grupo vazio", this.i);
      return conteudo;
    }
    if (ehDigito(c)) {
      if (ehDigito(this.s[this.i + 1])) falhar("use chaves quando o índice ou o expoente tem mais de um dígito", this.i);
      this.i += 1;
      return { tipo: "numero", valor: c };
    }
    if (ehLetra(c)) {
      this.i += 1;
      return { tipo: "variavel", valor: c };
    }
    return falhar("índice ou expoente inválido", this.i);
  }

  private grupo(profundidade: number): NoFormula {
    this.esperar("{");
    const conteudo = this.sequencia(profundidade + 1, "grupo");
    this.esperar("}");
    if (conteudo.tipo === "sequencia" && conteudo.itens.length === 0) falhar("grupo vazio", this.i);
    return conteudo;
  }

  private atomo(profundidade: number): NoFormula | null {
    const c = this.s[this.i];
    if (ehDigito(c)) return this.numero();
    if (ehLetra(c)) return this.letra();
    if (c === "Δ" || c === "π") {
      this.i += 1;
      return { tipo: "simbolo", valor: c };
    }
    if (c === "\\") return this.comando(profundidade);
    if (c === "(") {
      this.i += 1;
      const conteudo = this.sequencia(profundidade + 1, "parenteses");
      this.esperar(")");
      if (conteudo.tipo === "sequencia" && conteudo.itens.length === 0) falhar("parênteses vazios", this.i);
      return { tipo: "parenteses", conteudo };
    }
    if (c === "{") return this.grupo(profundidade);
    if (c === ",") { this.i += 1; return { tipo: "separador", valor: "," }; }
    if (c === ";") { this.i += 1; return { tipo: "separador", valor: ";" }; }
    if (c === "%") { this.i += 1; return { tipo: "porcento" }; }
    const duplo = this.s.slice(this.i, this.i + 2);
    const composto: Readonly<Record<string, OperadorFormula>> = { "<=": "≤", ">=": "≥", "!=": "≠", "->": "→" };
    if (duplo in composto) { this.i += 2; return { tipo: "operador", valor: composto[duplo] }; }
    if (c !== undefined && c in OPERADORES_POR_CARACTERE) {
      this.i += 1;
      return { tipo: "operador", valor: OPERADORES_POR_CARACTERE[c] };
    }
    return falhar(`símbolo "${c}" fora da lista`, this.i);
  }

  private numero(): NoFormula {
    const inicio = this.i;
    while (ehDigito(this.s[this.i])) this.i += 1;
    if (this.s[this.i] === ".") {
      if (!ehDigito(this.s[this.i + 1])) falhar("ponto solto depois do número", this.i);
      this.i += 1;
      while (ehDigito(this.s[this.i])) this.i += 1;
    }
    const valor = this.s.slice(inicio, this.i);
    if (valor.replace(".", "").length > LIMITES_FORMULA.digitosDoNumero) falhar("número com dígitos demais", inicio);
    return { tipo: "numero", valor };
  }

  private letra(): NoFormula {
    // Uma palavra solta (sin, cos, log) viraria o produto das letras: peça `\text{…}` ou escreva em texto linear.
    let fim = this.i;
    while (ehLetra(this.s[fim])) fim += 1;
    if (fim - this.i >= 3) falhar("palavra solta (use \\text{…})", this.i);
    const valor = this.s[this.i];
    this.i += 1;
    return { tipo: "variavel", valor };
  }

  private nomeDoComando(): string {
    const inicio = this.i + 1;
    let fim = inicio;
    while (ehLetra(this.s[fim])) fim += 1;
    if (fim === inicio) {
      if (inicio >= this.s.length) falhar("barra no fim da fórmula", this.i);
      fim = inicio + 1;
    }
    const nome = this.s.slice(inicio, fim);
    this.i = fim;
    return nome;
  }

  private comando(profundidade: number): NoFormula | null {
    const posicao = this.i;
    const nome = this.nomeDoComando();
    if (nome in OPERADORES_POR_COMANDO) return { tipo: "operador", valor: OPERADORES_POR_COMANDO[nome] };
    if (COMANDOS_DE_ESPACO.has(nome)) return null;
    switch (nome) {
      case "%":
        return { tipo: "porcento" };
      case "Delta":
        return { tipo: "simbolo", valor: "Δ" };
      case "pi":
        return { tipo: "simbolo", valor: "π" };
      case "frac": {
        const numerador = this.grupo(profundidade);
        const denominador = this.grupo(profundidade);
        return { tipo: "fracao", numerador, denominador };
      }
      case "sqrt": {
        this.espacos();
        if (this.s[this.i] === "[") falhar("raiz com índice ainda não existe (só a raiz quadrada)", this.i);
        return { tipo: "raiz", radicando: this.grupo(profundidade) };
      }
      case "text":
        return this.textoLivre();
      case "foco":
      case "procurado":
      case "resposta": {
        if (this.dentroDeDestaque) falhar("destaque dentro de destaque", posicao);
        this.destaques += 1;
        if (this.destaques > LIMITES_FORMULA.destaques) falhar("destaques demais (no máximo dois)", posicao);
        this.dentroDeDestaque = true;
        const conteudo = this.grupo(profundidade);
        this.dentroDeDestaque = false;
        return { tipo: "destaque", papel: nome, conteudo };
      }
      case "left": {
        this.espacos();
        if (this.s[this.i] !== "(") falhar("só parênteses em \\left e \\right", this.i);
        this.i += 1;
        const conteudo = this.sequencia(profundidade + 1, "esquerda");
        if (!this.adiante("\\right")) falhar("\\left sem \\right", this.i);
        this.i += "\\right".length;
        this.espacos();
        if (this.s[this.i] !== ")") falhar("só parênteses em \\left e \\right", this.i);
        this.i += 1;
        if (conteudo.tipo === "sequencia" && conteudo.itens.length === 0) falhar("parênteses vazios", this.i);
        return { tipo: "parenteses", conteudo };
      }
      case "begin":
        return this.matriz(profundidade);
      case "\\":
        return falhar("quebra de linha fora de matriz", posicao);
      default:
        return falhar(`comando \\${nome} fora da lista`, posicao);
    }
  }

  private textoLivre(): NoFormula {
    this.espacos();
    if (this.s[this.i] !== "{") falhar("esperava { depois de \\text", this.i);
    const inicio = this.i + 1;
    const fim = this.s.indexOf("}", inicio);
    if (fim < 0) falhar("\\text sem fechar", this.i);
    const valor = this.s.slice(inicio, fim);
    if (!valor.trim() || valor.length > LIMITES_FORMULA.texto || !TEXTO_PERMITIDO.test(valor)) falhar("texto não permitido em \\text", inicio);
    this.i = fim + 1;
    return { tipo: "texto", valor: valor.replace(/\s+/g, " ").trim() };
  }

  private matriz(profundidade: number): NoFormula {
    const posicao = this.i;
    this.esperar("{");
    const inicio = this.i;
    while (ehLetra(this.s[this.i])) this.i += 1;
    const nome = this.s.slice(inicio, this.i);
    this.esperar("}");
    if (!(nome in MOLDURAS)) falhar(`ambiente ${nome} fora da lista`, posicao);
    this.matrizes += 1;
    if (this.matrizes > LIMITES_FORMULA.matrizes) falhar("matrizes demais", posicao);
    const linhas: NoFormula[][] = [[]];
    for (;;) {
      const celula = this.sequencia(profundidade + 1, "celula");
      if (celula.tipo === "sequencia" && celula.itens.length === 0) falhar("célula vazia", this.i);
      linhas[linhas.length - 1].push(celula);
      this.espacos();
      if (this.s[this.i] === "&") {
        this.i += 1;
        continue;
      }
      if (this.adiante("\\\\")) {
        this.i += 2;
        this.espacos();
        if (this.adiante("\\end")) break;
        linhas.push([]);
        continue;
      }
      if (this.adiante("\\end")) break;
      falhar("matriz mal fechada", this.i);
    }
    this.i += "\\end".length;
    this.esperar("{");
    const inicioFim = this.i;
    while (ehLetra(this.s[this.i])) this.i += 1;
    if (this.s.slice(inicioFim, this.i) !== nome) falhar("\\end diferente do \\begin", inicioFim);
    this.esperar("}");
    const colunas = linhas[0].length;
    if (linhas.length > LIMITES_FORMULA.linhasDaMatriz || colunas > LIMITES_FORMULA.colunasDaMatriz) falhar("matriz maior que 4 × 4", posicao);
    if (linhas.some((linha) => linha.length !== colunas)) falhar("linhas da matriz com tamanhos diferentes", posicao);
    const moldura = MOLDURAS[nome];
    if (moldura === "barras" && (linhas.length !== colunas || colunas < 2)) falhar("determinante precisa ser quadrado (de 2 × 2 a 4 × 4)", posicao);
    this.contar();
    return { tipo: "matriz", moldura, linhas };
  }
}

/* ----- Reparo de barras ----- */

/**
 * Num JSON, `"\frac"` chega como avanço de página + `rac`, `"\times"` como tabulação + `imes`, `"\neq"` como quebra de
 * linha + `eq`, `"\right"` como retorno de carro + `ight` e `"\begin"` como backspace + `egin`. Devolve a barra a esses
 * caracteres de controle, mas só quando o resto forma um comando da lista (um tab ou uma quebra de linha de verdade, no meio de
 * uma fórmula, continuam sendo espaço).
 */
export function repararComandosDeControle(fonte: string): string {
  if (!/[\u0008\t\n\r\u000c]/.test(fonte)) return fonte;
  return fonte
    .replace(/\u000c(?=rac|oco)/g, "\\f")
    .replace(/\t(?=imes|ext|o(?![A-Za-z]))/g, "\\t")
    .replace(/\n(?=eq(?![A-Za-z]))/g, "\\n")
    .replace(/\r(?=ight|esposta)/g, "\\r")
    .replace(/\u0008(?=egin)/g, "\\b");
}

/**
 * Antes do `JSON.parse`: dentro de cada texto do JSON, dobra a barra que não forma um escape válido (`\l` de `\left`,
 * `\d` de `\div`: o parse falharia) e a que forma um escape válido mas é, na verdade, o começo de um comando da lista
 * (`\frac`, `\times`, `\neq`, `\right`, `\resposta`, `\begin`, `\text`). Quem já dobrou (`\\frac`) fica como está. O texto
 * comum (`\n` de uma linha nova, `\"`, `\\`, `é`) não muda.
 */
export function repararBarrasDoJson(texto: string): string {
  let saida = "";
  let dentro = false;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto[i];
    if (!dentro) {
      if (c === "\"") dentro = true;
      saida += c;
      continue;
    }
    if (c === "\"") {
      dentro = false;
      saida += c;
      continue;
    }
    if (c !== "\\") {
      saida += c;
      continue;
    }
    const proximo = texto[i + 1];
    if (proximo === undefined) {
      saida += "\\\\";
      continue;
    }
    if (proximo === "\\" || proximo === "\"" || proximo === "/") {
      saida += c + proximo;
      i += 1;
      continue;
    }
    if (proximo === "u" && /^[0-9a-fA-F]{4}$/.test(texto.slice(i + 2, i + 6))) {
      saida += texto.slice(i, i + 6);
      i += 5;
      continue;
    }
    const resto = texto.slice(i + 1);
    const comandoDaLista = /^(?:frac|foco|times(?![A-Za-z])|text(?![A-Za-z])|neq(?![A-Za-z])|right(?![A-Za-z])|resposta|begin\{)/.test(resto);
    if ("bfnrt".includes(proximo) && !comandoDaLista) {
      saida += c + proximo;
      i += 1;
      continue;
    }
    saida += "\\\\";
  }
  return saida;
}

/**
 * Prepara a fonte antes de ler: devolve a barra aos caracteres de controle, tira `$…$`, `\(…\)` e `\[…\]` que a IA põe em
 * volta e troca `\\` seguido de letra (barra dobrada demais) por uma barra só, fora das matrizes (onde `\\` separa linhas).
 */
function prepararFonte(entrada: string): string {
  let fonte = repararComandosDeControle(entrada).trim();
  const envolturas: [string, string][] = [["$$", "$$"], ["$", "$"], ["\\(", "\\)"], ["\\[", "\\]"]];
  for (const [abre, fecha] of envolturas) {
    if (fonte.length > abre.length + fecha.length && fonte.startsWith(abre) && fonte.endsWith(fecha)) {
      fonte = fonte.slice(abre.length, fonte.length - fecha.length).trim();
      break;
    }
  }
  let saida = "";
  let ambientes = 0;
  for (let i = 0; i < fonte.length; i += 1) {
    if (fonte.startsWith("\\begin{", i)) ambientes += 1;
    else if (fonte.startsWith("\\end{", i)) ambientes = Math.max(0, ambientes - 1);
    if (fonte.startsWith("\\\\", i)) {
      if (ambientes === 0 && ehLetra(fonte[i + 2])) {
        saida += "\\";
      } else {
        saida += "\\\\";
      }
      i += 1;
      continue;
    }
    // Numa matriz, uma barra só seguida de espaço é o `\\` que o JSON comeu: separa as linhas.
    if (ambientes > 0 && fonte[i] === "\\" && /\s/.test(fonte[i + 1] ?? "")) {
      saida += "\\\\";
      continue;
    }
    saida += fonte[i];
  }
  return saida;
}

function mapearFilhos(no: NoFormula, f: (filho: NoFormula) => NoFormula): NoFormula {
  switch (no.tipo) {
    case "fracao":
      return { ...no, numerador: f(no.numerador), denominador: f(no.denominador) };
    case "script":
      return { tipo: "script", base: f(no.base), ...(no.indice ? { indice: f(no.indice) } : {}), ...(no.expoente ? { expoente: f(no.expoente) } : {}) };
    case "raiz":
      return { ...no, radicando: f(no.radicando) };
    case "parenteses":
    case "destaque":
      return { ...no, conteudo: f(no.conteudo) };
    case "sequencia":
      return { ...no, itens: no.itens.map(f) };
    case "matriz":
      return { ...no, linhas: no.linhas.map((linha) => linha.map(f)) };
    default:
      return no;
  }
}

/** Par com casa decimal: o separador vira ponto e vírgula, para "(1,5, 2)" não ficar ambíguo: "(1,5; 2)". */
function ajustarSeparadores(no: NoFormula): NoFormula {
  const novo = mapearFilhos(no, ajustarSeparadores);
  if (novo.tipo !== "parenteses" || novo.conteudo.tipo !== "sequencia") return novo;
  let decimal = false;
  percorrerFormula(novo.conteudo, (visitado) => {
    if (visitado.tipo === "numero" && visitado.valor.includes(".")) decimal = true;
  });
  if (!decimal) return novo;
  return {
    tipo: "parenteses",
    conteudo: {
      tipo: "sequencia",
      itens: novo.conteudo.itens.map((item): NoFormula => (item.tipo === "separador" && item.valor === "," ? { tipo: "separador", valor: ";" } : item)),
    },
  };
}

/** Lê uma fórmula. Fora da lista, devolve `ok: false` com o motivo, e nunca lança. */
export function lerFormula(fonte: unknown): ResultadoFormula {
  if (typeof fonte !== "string") return { ok: false, erro: "a fórmula não é texto" };
  const preparada = prepararFonte(fonte);
  if (!preparada) return { ok: false, erro: "fórmula vazia" };
  if (preparada.length > LIMITES_FORMULA.caracteres) return { ok: false, erro: `fórmula com mais de ${LIMITES_FORMULA.caracteres} caracteres` };
  try {
    const arvore = ajustarSeparadores(new Analisador(preparada).raiz());
    return { ok: true, arvore, canonica: formulaCanonica(arvore) };
  } catch (erro) {
    if (erro instanceof ErroFormula) return { ok: false, erro: erro.message };
    throw erro;
  }
}

/* ----- Forma canônica ----- */

const OPERADOR_LATEX: Readonly<Record<OperadorFormula, string>> = {
  "+": "+", "-": "-", "×": "\\times", "÷": "\\div", "=": "=", "≠": "\\neq", "<": "<", ">": ">", "≤": "\\leq", "≥": "\\geq", "→": "\\to",
};

/** O operador `+` ou `-` que abre uma sequência ou vem depois de outro operador (ou de uma vírgula) é o sinal do número. */
export function ehSinal(itens: readonly NoFormula[], posicao: number): boolean {
  const no = itens[posicao];
  if (no.tipo !== "operador" || (no.valor !== "+" && no.valor !== "-")) return false;
  if (posicao === 0) return true;
  const anterior = itens[posicao - 1];
  return anterior.tipo === "operador" || anterior.tipo === "separador";
}

function argumentoCanonico(no: NoFormula): string {
  const simples = no.tipo === "variavel" || (no.tipo === "numero" && no.valor.length === 1);
  return simples ? formulaCanonica(no) : `{${formulaCanonica(no)}}`;
}

function sequenciaCanonica(itens: readonly NoFormula[]): string {
  let saida = "";
  itens.forEach((item, posicao) => {
    if (item.tipo === "operador" && !ehSinal(itens, posicao)) {
      saida += ` ${OPERADOR_LATEX[item.valor]} `;
    } else if (item.tipo === "operador") {
      saida += item.valor;
    } else if (item.tipo === "separador") {
      saida += `${item.valor} `;
    } else {
      // Duas variáveis seguidas ficam separadas: `a b c` não pode virar `abc`, que seria uma palavra solta ao reler.
      if (item.tipo === "variavel" && itens[posicao - 1]?.tipo === "variavel") saida += " ";
      saida += formulaCanonica(item);
      // `\pi r` não pode virar `\pir`, um comando que não existe.
      if (item.tipo === "simbolo") saida += " ";
    }
  });
  return saida.replace(/\s+/g, " ").trim();
}

/** A fórmula como a IA devia ter escrito: operadores e barras de um jeito só. É o que o servidor guarda. */
export function formulaCanonica(no: NoFormula): string {
  switch (no.tipo) {
    case "numero":
    case "variavel":
      return no.valor;
    case "simbolo":
      return no.valor === "Δ" ? "\\Delta" : "\\pi";
    case "operador":
      return OPERADOR_LATEX[no.valor];
    case "separador":
      return no.valor;
    case "texto":
      return `\\text{${no.valor}}`;
    case "porcento":
      return "\\%";
    case "fracao":
      return `\\frac{${formulaCanonica(no.numerador)}}{${formulaCanonica(no.denominador)}}`;
    case "script": {
      const base = no.base.tipo === "sequencia" ? `{${formulaCanonica(no.base)}}` : formulaCanonica(no.base);
      return `${base}${no.indice ? `_${argumentoCanonico(no.indice)}` : ""}${no.expoente ? `^${argumentoCanonico(no.expoente)}` : ""}`;
    }
    case "raiz":
      return `\\sqrt{${formulaCanonica(no.radicando)}}`;
    case "parenteses":
      return `(${formulaCanonica(no.conteudo)})`;
    case "sequencia":
      return sequenciaCanonica(no.itens);
    case "matriz": {
      const ambiente = no.moldura === "barras" ? "vmatrix" : "bmatrix";
      const linhas = no.linhas.map((linha) => linha.map(formulaCanonica).join(" & ")).join(" \\\\ ");
      return `\\begin{${ambiente}} ${linhas} \\end{${ambiente}}`;
    }
    case "destaque":
      return `\\${no.papel}{${formulaCanonica(no.conteudo)}}`;
  }
}

/* ----- Texto linear ----- */

const SINAL_DE_MENOS = "−";
const OPERADOR_LINEAR: Readonly<Record<OperadorFormula, string>> = {
  "+": "+", "-": SINAL_DE_MENOS, "×": "×", "÷": "÷", "=": "=", "≠": "≠", "<": "<", ">": ">", "≤": "≤", "≥": "≥", "→": "→",
};
const SOBRESCRITO_LINEAR: Readonly<Record<string, string>> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

export function numeroNaTela(valor: string): string {
  return valor.replace(".", ",");
}

function atomico(no: NoFormula): boolean {
  switch (no.tipo) {
    case "numero":
    case "variavel":
    case "simbolo":
    case "texto":
    case "parenteses":
    case "raiz":
    case "porcento":
    case "matriz":
      return true;
    case "script":
      return atomico(no.base);
    case "destaque":
      return atomico(no.conteudo);
    default:
      return false;
  }
}

function seEnvolve(no: NoFormula, texto: string): string {
  return atomico(no) ? texto : `(${texto})`;
}

function linearDoScript(no: NoFormula): string {
  const simples = no.tipo === "numero" || no.tipo === "variavel" || (no.tipo === "sequencia" && no.itens.every((i) => i.tipo === "numero" || i.tipo === "variavel"));
  const texto = formulaLinear(no);
  return simples ? texto : `(${texto})`;
}

/**
 * A fórmula em texto de uma linha, para quem não desenha (cliente antigo, fórmula que não coube): `x_G = (x_A + x_B +
 * x_C) / 3`. Vírgula decimal, sinal de menos de verdade, `×`, `÷`, `≤`.
 */
export function formulaLinear(no: NoFormula): string {
  switch (no.tipo) {
    case "numero":
      return numeroNaTela(no.valor);
    case "variavel":
    case "simbolo":
      return no.valor;
    case "operador":
      return OPERADOR_LINEAR[no.valor];
    case "separador":
      return no.valor;
    case "texto":
      return no.valor;
    case "porcento":
      return "%";
    case "fracao":
      // Dois termos simples: "1/2", como se escreve numa frase. As outras: "(x + 1) ÷ 2", sem barra que se confunda com endereço.
      if (fracaoSimples(no)) return `${formulaLinear(no.numerador)}/${formulaLinear(no.denominador)}`;
      return `${seEnvolve(no.numerador, formulaLinear(no.numerador))} ÷ ${seEnvolve(no.denominador, formulaLinear(no.denominador))}`;
    case "script": {
      const base = no.base.tipo === "sequencia" ? `(${formulaLinear(no.base)})` : formulaLinear(no.base);
      const indice = no.indice ? `_${linearDoScript(no.indice)}` : "";
      let expoente = "";
      if (no.expoente) {
        const unico = no.expoente.tipo === "numero" && no.expoente.valor.length === 1 ? SOBRESCRITO_LINEAR[no.expoente.valor] : undefined;
        expoente = unico ?? `^${linearDoScript(no.expoente)}`;
      }
      return `${base}${indice}${expoente}`;
    }
    case "raiz": {
      const dentro = formulaLinear(no.radicando);
      return atomico(no.radicando) && no.radicando.tipo !== "parenteses" ? `√${dentro}` : `√(${dentro})`;
    }
    case "parenteses":
      return `(${formulaLinear(no.conteudo)})`;
    case "sequencia": {
      let saida = "";
      no.itens.forEach((item, posicao) => {
        if (item.tipo === "operador" && !ehSinal(no.itens, posicao)) saida += ` ${OPERADOR_LINEAR[item.valor]} `;
        else if (item.tipo === "operador") saida += OPERADOR_LINEAR[item.valor];
        else if (item.tipo === "separador") saida += `${item.valor} `;
        else saida += formulaLinear(item);
      });
      return saida.replace(/\s+/g, " ").trim();
    }
    case "matriz": {
      const linhas = no.linhas.map((linha) => linha.map(formulaLinear).join(", ")).join("; ");
      return `${no.moldura === "barras" ? "det" : ""}[${linhas}]`;
    }
    case "destaque":
      return formulaLinear(no.conteudo);
  }
}

/* ----- Texto falado ----- */

const OPERADOR_FALADO: Readonly<Record<OperadorFormula, string>> = {
  "+": "mais", "-": "menos", "×": "vezes", "÷": "dividido por", "=": "é igual a", "≠": "é diferente de", "<": "é menor que",
  ">": "é maior que", "≤": "é menor ou igual a", "≥": "é maior ou igual a", "→": "então",
};

function ehNumeroComSinal(no: NoFormula): boolean {
  if (no.tipo !== "sequencia" || no.itens.length !== 2) return false;
  const [sinal, valor] = no.itens;
  return sinal.tipo === "operador" && (sinal.valor === "-" || sinal.valor === "+") && (valor.tipo === "numero" || valor.tipo === "variavel" || valor.tipo === "script");
}

function falarMatriz(no: Extract<NoFormula, { tipo: "matriz" }>): string {
  const linhas = no.linhas.map((linha, i) => `linha ${i + 1}: ${linha.map(falarFormula).join(", ")}`).join("; ");
  if (no.moldura === "barras") return `determinante de ordem ${no.linhas.length}: ${linhas}`;
  return `matriz de ${no.linhas.length} ${no.linhas.length === 1 ? "linha" : "linhas"} e ${no.linhas[0].length} ${no.linhas[0].length === 1 ? "coluna" : "colunas"}: ${linhas}`;
}

function termoSimples(no: NoFormula): boolean {
  switch (no.tipo) {
    case "numero":
    case "variavel":
    case "simbolo":
      return true;
    case "script":
      return no.base.tipo !== "sequencia" && termoSimples(no.base) && (!no.indice || termoSimples(no.indice)) && (!no.expoente || termoSimples(no.expoente));
    default:
      return ehNumeroComSinal(no);
  }
}

/** Fração de dois termos simples (um número, uma variável, um índice): lida "1 sobre 3". */
function fracaoSimples(no: Extract<NoFormula, { tipo: "fracao" }>): boolean {
  return termoSimples(no.numerador) && termoSimples(no.denominador);
}

function terminaEmFracaoLonga(no: NoFormula): boolean {
  if (no.tipo === "destaque") return terminaEmFracaoLonga(no.conteudo);
  return no.tipo === "fracao" && !fracaoSimples(no);
}

/**
 * O texto que o leitor de tela lê, gerado da árvore (a IA não escreve isto): "x índice C é igual a 3 vezes 4, menos 3,
 * menos 5". Fração de dois termos simples: "1 sobre 3"; as outras: "fração: numerador …, denominador …" (e "fim da fração"
 * quando vem algo depois). Em soma e subtração de três ou mais termos, uma vírgula marca a pausa. "→" é "então".
 */
export function falarFormula(no: NoFormula): string {
  switch (no.tipo) {
    case "numero":
      return numeroNaTela(no.valor);
    case "variavel":
      return no.valor;
    case "simbolo":
      return no.valor === "Δ" ? "delta" : "pi";
    case "operador":
      return OPERADOR_FALADO[no.valor];
    case "separador":
      return no.valor;
    case "texto":
      return no.valor;
    case "porcento":
      return "por cento";
    case "fracao":
      if (fracaoSimples(no)) return `${falarFormula(no.numerador)} sobre ${falarFormula(no.denominador)}`;
      return `fração: numerador ${falarFormula(no.numerador)}, denominador ${falarFormula(no.denominador)}`;
    case "script": {
      let saida = no.base.tipo === "sequencia" ? `abre parênteses ${falarFormula(no.base)} fecha parênteses` : falarFormula(no.base);
      if (no.indice) saida += ` índice ${falarFormula(no.indice)}`;
      if (no.expoente) {
        const valor = no.expoente.tipo === "numero" ? no.expoente.valor : "";
        saida += valor === "2" ? " ao quadrado" : valor === "3" ? " ao cubo" : ` elevado a ${falarFormula(no.expoente)}`;
      }
      return saida;
    }
    case "raiz": {
      const dentro = falarFormula(no.radicando);
      return atomico(no.radicando) ? `raiz quadrada de ${dentro}` : `raiz quadrada de ${dentro}, fim da raiz`;
    }
    case "parenteses":
      return ehNumeroComSinal(no.conteudo) ? falarFormula(no.conteudo) : `abre parênteses ${falarFormula(no.conteudo)} fecha parênteses`;
    case "sequencia": {
      const aditivos = no.itens.filter((item, posicao) => item.tipo === "operador" && (item.valor === "+" || item.valor === "-") && !ehSinal(no.itens, posicao)).length;
      let saida = "";
      no.itens.forEach((item, posicao) => {
        if (item.tipo === "operador") {
          const aditivo = (item.valor === "+" || item.valor === "-") && !ehSinal(no.itens, posicao);
          if (ehSinal(no.itens, posicao)) saida += `${OPERADOR_FALADO[item.valor]} `;
          else saida += `${aditivo && aditivos >= 2 ? "," : ""} ${OPERADOR_FALADO[item.valor]} `;
        } else if (item.tipo === "separador") {
          saida += `${item.valor} `;
        } else {
          const anterior = no.itens[posicao - 1];
          if (saida && !/\s$/.test(saida) && anterior && anterior.tipo !== "operador" && anterior.tipo !== "separador") saida += " ";
          saida += falarFormula(item);
          // "a/b + c" lido como "fração: numerador a, denominador b, mais c" não diz onde a fração acaba.
          if (terminaEmFracaoLonga(item) && posicao < no.itens.length - 1) saida += ", fim da fração";
        }
      });
      return saida.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
    }
    case "matriz":
      return falarMatriz(no);
    case "destaque":
      return falarFormula(no.conteudo);
  }
}

/**
 * Cabe no meio de uma frase? Número, variável, índice, expoente, operador e parênteses, e a fração de dois termos simples, que vai
 * como "a/b" (spec 15, seção 9). Fração composta, raiz e matriz vão em bloco; dentro da frase, o texto linear em peças
 * (`formulaEmPecas`). Esta é a regra pelo TIPO de nó: o motor ainda confere a altura e a largura (`formulaCabeNaLinha`).
 */
export function formulaCabeEmLinha(no: NoFormula): boolean {
  switch (no.tipo) {
    case "fracao":
      return fracaoSimples(no);
    case "raiz":
    case "matriz":
      return false;
    case "script":
      return formulaCabeEmLinha(no.base) && (!no.indice || formulaCabeEmLinha(no.indice)) && (!no.expoente || formulaCabeEmLinha(no.expoente));
    case "parenteses":
    case "destaque":
      return formulaCabeEmLinha(no.conteudo);
    case "sequencia":
      return no.itens.every(formulaCabeEmLinha);
    default:
      return true;
  }
}

/**
 * Uma peça do texto linear: o texto que se escreve como está, ou a árvore que se DESENHA em linha (variável, símbolo, índice,
 * expoente, fração simples). Nada de sublinhado cru na tela: o índice é desenhado, não escrito.
 */
export type PecaDeFormula = string | NoFormula;

/** Quem desenha mede a peça (largura e altura de 1,5 em, `formulaCabeNaLinha`); sem medida, vale o tipo de nó. */
export type PodeDesenharEmLinha = (no: NoFormula) => boolean;

/**
 * O texto linear de uma fórmula em peças (spec 15, seção 9): cada variável, símbolo, índice e expoente como árvore para desenhar
 * em linha, e o resto como texto, que quebra de linha como qualquer palavra. `(x_A + x_B) / 2` vira "(" + x_A + " + " + x_B + ")
 * ÷ 2": só a fração composta vira ÷ em texto, e o sublinhado nunca aparece. Quem fala a fórmula inteira lê a árvore
 * (`falarFormula`), não estas peças. Peças de texto vizinhas se juntam.
 */
export function formulaEmPecas(no: NoFormula, podeDesenhar: PodeDesenharEmLinha = formulaCabeEmLinha): PecaDeFormula[] {
  const desenhavel = (candidato: NoFormula): boolean =>
    (candidato.tipo === "variavel" || candidato.tipo === "simbolo" || candidato.tipo === "script" || candidato.tipo === "fracao") && podeDesenhar(candidato);
  const saida: PecaDeFormula[] = [];
  const texto = (valor: string): void => {
    if (valor === "") return;
    if (typeof saida[saida.length - 1] === "string") saida[saida.length - 1] = `${saida[saida.length - 1] as string}${valor}`;
    else saida.push(valor);
  };
  const envolvido = (filho: NoFormula): void => {
    if (atomico(filho)) {
      andar(filho);
      return;
    }
    texto("(");
    andar(filho);
    texto(")");
  };
  const andar = (atual: NoFormula): void => {
    switch (atual.tipo) {
      case "numero":
        texto(numeroNaTela(atual.valor));
        return;
      case "variavel":
      case "simbolo":
        saida.push(atual);
        return;
      case "operador":
        texto(OPERADOR_LINEAR[atual.valor]);
        return;
      case "separador":
      case "texto":
        texto(atual.valor);
        return;
      case "porcento":
        texto("%");
        return;
      case "fracao":
        if (desenhavel(atual)) {
          saida.push(atual);
          return;
        }
        envolvido(atual.numerador);
        texto(" ÷ ");
        envolvido(atual.denominador);
        return;
      case "script":
        if (desenhavel(atual)) {
          saida.push(atual);
          return;
        }
        // Índice ou expoente que não cabe em linha (uma fração composta dentro dele): a base e o resto, em palavras, sem `_` nem `^`.
        andar(atual.base);
        if (atual.indice) {
          texto(" índice ");
          envolvido(atual.indice);
        }
        if (atual.expoente) {
          texto(" elevado a ");
          envolvido(atual.expoente);
        }
        return;
      case "raiz":
        texto("√");
        if (atomico(atual.radicando) && atual.radicando.tipo !== "parenteses") andar(atual.radicando);
        else {
          texto("(");
          andar(atual.radicando);
          texto(")");
        }
        return;
      case "parenteses":
        texto("(");
        andar(atual.conteudo);
        texto(")");
        return;
      case "sequencia":
        atual.itens.forEach((item, posicao) => {
          if (item.tipo === "operador" && !ehSinal(atual.itens, posicao)) texto(` ${OPERADOR_LINEAR[item.valor]} `);
          else if (item.tipo === "operador") texto(OPERADOR_LINEAR[item.valor]);
          else if (item.tipo === "separador") texto(`${item.valor} `);
          else andar(item);
        });
        return;
      case "matriz":
        texto(atual.moldura === "barras" ? "det[" : "[");
        atual.linhas.forEach((linha, i) => {
          if (i > 0) texto("; ");
          linha.forEach((celula, j) => {
            if (j > 0) texto(", ");
            andar(celula);
          });
        });
        texto("]");
        return;
      case "destaque":
        andar(atual.conteudo);
        return;
    }
  };
  andar(no);
  return saida.map((peca) => (typeof peca === "string" ? peca.replace(/ {2,}/g, " ") : peca));
}

/** Todos os nós da árvore, em ordem de leitura (para quem confere, mede ou desenha). */
export function percorrerFormula(no: NoFormula, visitar: (no: NoFormula) => void): void {
  visitar(no);
  switch (no.tipo) {
    case "fracao":
      percorrerFormula(no.numerador, visitar);
      percorrerFormula(no.denominador, visitar);
      break;
    case "script":
      percorrerFormula(no.base, visitar);
      if (no.indice) percorrerFormula(no.indice, visitar);
      if (no.expoente) percorrerFormula(no.expoente, visitar);
      break;
    case "raiz":
      percorrerFormula(no.radicando, visitar);
      break;
    case "parenteses":
    case "destaque":
      percorrerFormula(no.conteudo, visitar);
      break;
    case "sequencia":
      no.itens.forEach((item) => percorrerFormula(item, visitar));
      break;
    case "matriz":
      no.linhas.forEach((linha) => linha.forEach((celula) => percorrerFormula(celula, visitar)));
      break;
    default:
      break;
  }
}
