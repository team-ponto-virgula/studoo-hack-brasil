import { ehSinal, formulaCanonica, formulaLinear, percorrerFormula, type NoFormula, type OperadorFormula } from "./formula";

/*
 * Conferência da conta (spec 15, seção 4; decisão 6 do Lead): o servidor avalia, com racionais exatos, o que dá para avaliar
 * nas fórmulas de uma resolução e descarta o exemplo quando a conta não fecha.
 *
 * O recorte (feito para nunca reprovar uma conta certa; o que ele não pega fica para o teste com IA real e a revisão humana):
 * - valores declarados: `x_C = 4`, `x_C = 3 - 2 + 1`, `C = (4, 0)` (que declara `x_C` e `y_C`), `k = 0`;
 * - cada fórmula com `=`, `≠`, `<`, `>`, `≤` ou `≥` cujos dois lados se resolvem (números, variáveis declaradas, as quatro
 *   operações, multiplicação por justaposição como em `5k`, potência inteira, raiz exata, fração, determinante até 4 × 4)
 *   é conferida; o que ainda tem incógnita, texto, par ordenado ou raiz que não fecha é pulado, não reprovado;
 * - duas declarações diferentes para a mesma variável reprovam.
 * Aritmética de inteiros seguros (sem BigInt): se um número estourar, a conta é pulada.
 */

export interface Racional {
  n: number;
  d: number;
}

class NaoAvaliavel extends Error {}

function seguro(valor: number): number {
  if (!Number.isSafeInteger(valor)) throw new NaoAvaliavel("número grande demais");
  return valor;
}

function mdc(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export function racional(n: number, d = 1): Racional {
  if (d === 0) throw new NaoAvaliavel("divisão por zero");
  const sinal = d < 0 ? -1 : 1;
  const divisor = mdc(n, d);
  return { n: seguro((sinal * n) / divisor), d: seguro((sinal * d) / divisor) };
}

const somar = (a: Racional, b: Racional) => racional(seguro(a.n * b.d + b.n * a.d), seguro(a.d * b.d));
const subtrair = (a: Racional, b: Racional) => racional(seguro(a.n * b.d - b.n * a.d), seguro(a.d * b.d));
const multiplicar = (a: Racional, b: Racional) => racional(seguro(a.n * b.n), seguro(a.d * b.d));
const dividir = (a: Racional, b: Racional) => racional(seguro(a.n * b.d), seguro(a.d * b.n));
const negar = (a: Racional) => racional(-a.n, a.d);
const igual = (a: Racional, b: Racional) => a.n === b.n && a.d === b.d;
const comparar = (a: Racional, b: Racional) => Math.sign(seguro(a.n * b.d) - seguro(b.n * a.d));

function potencia(base: Racional, expoente: Racional): Racional {
  if (expoente.d !== 1 || Math.abs(expoente.n) > 8) throw new NaoAvaliavel("expoente fora do que dá para conferir");
  let resultado = racional(1);
  for (let i = 0; i < Math.abs(expoente.n); i += 1) resultado = multiplicar(resultado, base);
  return expoente.n < 0 ? dividir(racional(1), resultado) : resultado;
}

function raizExata(valor: Racional): Racional {
  if (valor.n < 0) throw new NaoAvaliavel("raiz de negativo");
  const n = Math.round(Math.sqrt(valor.n));
  const d = Math.round(Math.sqrt(valor.d));
  if (n * n !== valor.n || d * d !== valor.d) throw new NaoAvaliavel("raiz que não fecha");
  return racional(n, d);
}

function decimal(valor: string): Racional {
  const [inteira, fracionaria = ""] = valor.split(".");
  return racional(Number(inteira + fracionaria), 10 ** fracionaria.length);
}

export function racionalNaTela(valor: Racional): string {
  return valor.d === 1 ? String(valor.n) : `${valor.n}/${valor.d}`;
}

export type Declaracoes = Map<string, Racional>;

/** O nome com que a variável entra na conta: `k`, `x_C`, `x_AB`. */
export function chaveDaVariavel(no: NoFormula): string | null {
  // O Δ é incógnita como qualquer letra (`Δ = b² − 4ac`); o π não é: é um número que não cabe em racional.
  if (no.tipo === "variavel" || (no.tipo === "simbolo" && no.valor === "Δ")) return no.valor;
  if (no.tipo === "script" && no.base.tipo === "variavel" && no.indice && !no.expoente) {
    return `${no.base.valor}_${formulaCanonica(no.indice).replace(/[{}\s]/g, "")}`;
  }
  return null;
}

function determinante(linhas: Racional[][]): Racional {
  const ordem = linhas.length;
  if (ordem === 1) return linhas[0][0];
  let soma = racional(0);
  for (let coluna = 0; coluna < ordem; coluna += 1) {
    const menor = linhas.slice(1).map((linha) => linha.filter((_, c) => c !== coluna));
    const termo = multiplicar(linhas[0][coluna], determinante(menor));
    soma = coluna % 2 === 0 ? somar(soma, termo) : subtrair(soma, termo);
  }
  return soma;
}

function ehInicioDeFator(no: NoFormula): boolean {
  return no.tipo === "numero" || no.tipo === "variavel" || no.tipo === "simbolo" || no.tipo === "script" || no.tipo === "parenteses" ||
    no.tipo === "fracao" || no.tipo === "raiz" || no.tipo === "destaque" || no.tipo === "sequencia" ||
    (no.tipo === "matriz" && no.moldura === "barras");
}

function avaliarNo(no: NoFormula, valores: Declaracoes): Racional {
  return avaliarItens(no.tipo === "sequencia" ? no.itens : [no], valores);
}

function avaliarFator(no: NoFormula, valores: Declaracoes): Racional {
  switch (no.tipo) {
    case "numero":
      return decimal(no.valor);
    case "variavel":
    case "simbolo": {
      const valor = valores.get(no.valor);
      if (!valor) throw new NaoAvaliavel(`${no.valor} sem valor`);
      return valor;
    }
    case "script": {
      let base: Racional;
      if (no.indice) {
        const chave = chaveDaVariavel({ ...no, expoente: undefined });
        const valor = chave ? valores.get(chave) : undefined;
        if (!valor) throw new NaoAvaliavel("variável com índice sem valor");
        base = valor;
      } else {
        base = avaliarNo(no.base, valores);
      }
      return no.expoente ? potencia(base, avaliarNo(no.expoente, valores)) : base;
    }
    case "parenteses":
      return avaliarNo(no.conteudo, valores);
    case "destaque":
      return avaliarNo(no.conteudo, valores);
    case "sequencia":
      return avaliarItens(no.itens, valores);
    case "fracao":
      return dividir(avaliarNo(no.numerador, valores), avaliarNo(no.denominador, valores));
    case "raiz":
      return raizExata(avaliarNo(no.radicando, valores));
    case "matriz":
      if (no.moldura !== "barras") throw new NaoAvaliavel("matriz não é número");
      return determinante(no.linhas.map((linha) => linha.map((celula) => avaliarNo(celula, valores))));
    default:
      throw new NaoAvaliavel(`${no.tipo} não se avalia`);
  }
}

/** Precedência: soma e subtração, depois vezes, dividido e justaposição (`5k`). O sinal no começo vale para o termo. */
function avaliarItens(itens: readonly NoFormula[], valores: Declaracoes): Racional {
  let posicao = 0;
  const olhar = () => itens[posicao] as NoFormula | undefined;

  function fatorComSinal(): Racional {
    let negativo = false;
    for (let item = olhar(); item?.tipo === "operador" && (item.valor === "+" || item.valor === "-"); item = olhar()) {
      if (item.valor === "-") negativo = !negativo;
      posicao += 1;
    }
    const item = olhar();
    if (!item) throw new NaoAvaliavel("faltou um valor");
    posicao += 1;
    const valor = avaliarFator(item, valores);
    return negativo ? negar(valor) : valor;
  }

  function produto(): Racional {
    let valor = fatorComSinal();
    let anteriorEraNumero = itens[posicao - 1]?.tipo === "numero";
    for (;;) {
      const proximo = olhar();
      if (!proximo) break;
      if (proximo.tipo === "operador" && (proximo.valor === "×" || proximo.valor === "÷")) {
        posicao += 1;
        const outro = fatorComSinal();
        valor = proximo.valor === "×" ? multiplicar(valor, outro) : dividir(valor, outro);
        anteriorEraNumero = itens[posicao - 1]?.tipo === "numero";
      } else if (ehInicioDeFator(proximo)) {
        if (anteriorEraNumero && proximo.tipo === "numero") throw new NaoAvaliavel("dois números seguidos");
        posicao += 1;
        valor = multiplicar(valor, avaliarFator(proximo, valores));
        anteriorEraNumero = proximo.tipo === "numero";
      } else break;
    }
    return valor;
  }

  let valor = produto();
  for (;;) {
    const proximo = olhar();
    if (proximo?.tipo === "operador" && (proximo.valor === "+" || proximo.valor === "-")) {
      posicao += 1;
      const outro = produto();
      valor = proximo.valor === "+" ? somar(valor, outro) : subtrair(valor, outro);
    } else break;
  }
  if (posicao !== itens.length) throw new NaoAvaliavel("sobrou algo que não é conta");
  return valor;
}

/* ----- Cláusulas e relações ----- */

const RELACOES: ReadonlySet<OperadorFormula> = new Set(["=", "≠", "<", ">", "≤", "≥"]);

/** Parte a fórmula nas vírgulas e pontos e vírgulas de cima: `x_G = 1, x_A = 2` são duas cláusulas. */
function clausulasDe(no: NoFormula): NoFormula[][] {
  // `\resposta{k = 2}`: o destaque em volta da fórmula inteira não muda a conta.
  while (no.tipo === "destaque") no = no.conteudo;
  const itens = no.tipo === "sequencia" ? no.itens : [no];
  const clausulas: NoFormula[][] = [[]];
  for (const item of itens) {
    if (item.tipo === "separador") clausulas.push([]);
    else clausulas[clausulas.length - 1].push(item);
  }
  return clausulas.filter((clausula) => clausula.length > 0);
}

function partirNasRelacoes(itens: readonly NoFormula[]): { partes: NoFormula[][]; relacoes: OperadorFormula[] } {
  const partes: NoFormula[][] = [[]];
  const relacoes: OperadorFormula[] = [];
  itens.forEach((item, posicao) => {
    if (item.tipo === "operador" && RELACOES.has(item.valor) && !ehSinal(itens, posicao)) {
      relacoes.push(item.valor);
      partes.push([]);
    } else partes[partes.length - 1].push(item);
  });
  return { partes, relacoes };
}

function seTem(relacao: OperadorFormula, a: Racional, b: Racional): boolean {
  const c = comparar(a, b);
  switch (relacao) {
    case "=": return c === 0;
    case "≠": return c !== 0;
    case "<": return c < 0;
    case ">": return c > 0;
    case "≤": return c <= 0;
    default: return c >= 0;
  }
}

function tentar(itens: readonly NoFormula[], valores: Declaracoes): Racional | null {
  try {
    return avaliarItens(itens, valores);
  } catch (erro) {
    if (erro instanceof NaoAvaliavel) return null;
    throw erro;
  }
}

/** `C = (4, 0)`: o ponto com duas coordenadas avaliáveis. */
function parOrdenado(itens: readonly NoFormula[], valores: Declaracoes): [Racional, Racional] | null {
  if (itens.length !== 1) return null;
  let par = itens[0];
  while (par.tipo === "destaque") par = par.conteudo;
  if (par.tipo !== "parenteses") return null;
  const dentro = par.conteudo;
  if (dentro.tipo !== "sequencia") return null;
  const partes: NoFormula[][] = [[]];
  for (const item of dentro.itens) {
    if (item.tipo === "separador" && item.valor === ",") partes.push([]);
    else partes[partes.length - 1].push(item);
  }
  if (partes.length !== 2) return null;
  const x = tentar(partes[0], valores);
  const y = tentar(partes[1], valores);
  return x && y ? [x, y] : null;
}

/** Os valores que estavam ligados às letras da conta, para a mensagem de recusa: `k = 21`. Só as letras que aparecem nela e têm valor. */
function ligadasEm(partes: readonly (readonly NoFormula[])[], valores: Declaracoes): string {
  const vistas = new Set<string>();
  for (const itens of partes) {
    for (const item of itens) {
      percorrerFormula(item, (no) => {
        const chave = chaveDaVariavel(no);
        if (chave && valores.has(chave)) vistas.add(chave);
      });
    }
  }
  return [...vistas].map((chave) => `${chave} = ${racionalNaTela(valores.get(chave) as Racional)}`).join(", ");
}

export type ResultadoConta =
  | { ok: true; conferidas: number; puladas: number; declaradas: Record<string, string> }
  | { ok: false; formula: string; motivo: string };

function declarar(clausula: readonly NoFormula[], valores: Declaracoes): { chave: string; valor: Racional }[] | { conflito: string } {
  const { partes, relacoes } = partirNasRelacoes(clausula);
  if (relacoes.length === 0 || relacoes[0] !== "=") return [];
  const achados: { chave: string; valor: Racional }[] = [];
  const esquerda = partes[0];
  const direita = partes[1];
  if (esquerda.length === 1) {
    const chave = chaveDaVariavel(esquerda[0]);
    if (chave) {
      const valor = tentar(direita, valores);
      if (valor) achados.push({ chave, valor });
      else if (esquerda[0].tipo === "variavel") {
        const par = parOrdenado(direita, valores);
        if (par) achados.push({ chave: `x_${chave}`, valor: par[0] }, { chave: `y_${chave}`, valor: par[1] });
      }
    }
  }
  if (achados.length === 0 && direita.length === 1 && relacoes.length === 1) {
    const chave = chaveDaVariavel(direita[0]);
    const valor = chave ? tentar(esquerda, valores) : null;
    if (chave && valor) achados.push({ chave, valor });
  }
  for (const { chave, valor } of achados) {
    const antes = valores.get(chave);
    if (antes && !igual(antes, valor)) return { conflito: `${chave} vale ${racionalNaTela(antes)} e também ${racionalNaTela(valor)}` };
  }
  return achados;
}

/**
 * Confere as fórmulas de uma resolução (na ordem dos passos). Reprova só quando uma conta que se resolve por inteiro não fecha
 * ou quando a mesma variável recebe dois valores. `declaradas` traz o que ficou valendo (para conferir as opções do "Sua vez").
 */
export function conferirConta(formulas: readonly NoFormula[]): ResultadoConta {
  const valores: Declaracoes = new Map();
  for (let volta = 0; volta < 3; volta += 1) {
    for (const formula of formulas) {
      for (const clausula of clausulasDe(formula)) {
        const achados = declarar(clausula, valores);
        if ("conflito" in achados) return { ok: false, formula: formulaLinear(formula), motivo: achados.conflito };
        for (const { chave, valor } of achados) valores.set(chave, valor);
      }
    }
  }
  let conferidas = 0;
  let puladas = 0;
  for (const formula of formulas) {
    for (const clausula of clausulasDe(formula)) {
      const { partes, relacoes } = partirNasRelacoes(clausula);
      if (relacoes.length === 0) {
        puladas += 1;
        continue;
      }
      for (let i = 0; i < relacoes.length; i += 1) {
        const esquerda = tentar(partes[i], valores);
        const direita = tentar(partes[i + 1], valores);
        if (!esquerda || !direita) {
          puladas += 1;
          continue;
        }
        conferidas += 1;
        if (!seTem(relacoes[i], esquerda, direita)) {
          const ligadas = ligadasEm([partes[i], partes[i + 1]], valores);
          return {
            ok: false,
            formula: formulaLinear(formula),
            motivo: `${racionalNaTela(esquerda)} ${relacoes[i]} ${racionalNaTela(direita)} é falso${ligadas ? `, com ${ligadas}` : ""}`,
          };
        }
      }
    }
  }
  return { ok: true, conferidas, puladas, declaradas: Object.fromEntries([...valores].map(([chave, valor]) => [chave, racionalNaTela(valor)])) };
}

/** Os valores já declarados (`x_C: "4"`, `k: "3/2"`) como a conta os usa. */
function declaracoesDe(declaradas: Record<string, string>): Declaracoes {
  return new Map(Object.entries(declaradas).map(([chave, texto]) => {
    const [n, d = "1"] = texto.split("/");
    return [chave, racional(Number(n), Number(d))];
  }));
}

function semDestaque(no: NoFormula): NoFormula {
  let atual = no;
  while (atual.tipo === "destaque") atual = atual.conteudo;
  return atual;
}

export interface ResultadoDaFormula {
  /** A letra do começo (`y_C`, `k`), quando a fórmula começa por uma só. */
  chave?: string;
  valor?: Racional;
  /** O ponto, quando o resultado é um par ordenado (`M = (5, 4)`). */
  par?: [Racional, Racional];
}

/**
 * O que uma fórmula de resposta diz (`y_G = \frac{9}{3} = 3`, `14 - 14 = 0`, `M = (5, 4)`, `k = \frac{20}{6}`): a letra do começo, quando é
 * uma só, e o valor (ou o par) do primeiro lado que se avalia, do fim para o começo. `null` quando nada se avalia (incógnita, texto,
 * desigualdade). Serve ao "Sua vez": é o que a pessoa ainda não pode ver antes de escolher.
 */
export function resultadoDaFormula(no: NoFormula, declaradas: Record<string, string>): ResultadoDaFormula | null {
  const valores = declaracoesDe(declaradas);
  const topo = semDestaque(no);
  const itens = topo.tipo === "sequencia" ? topo.itens : [topo];
  const { partes, relacoes } = partirNasRelacoes(itens);
  if (relacoes.some((relacao) => relacao !== "=")) return null;
  const chave = partes.length > 1 && partes[0].length === 1 ? chaveDaVariavel(semDestaque(partes[0][0])) : null;
  for (let posicao = partes.length - 1; posicao >= (chave ? 1 : 0); posicao -= 1) {
    const valor = tentar(partes[posicao], valores);
    if (valor) return { ...(chave ? { chave } : {}), valor };
    const par = parOrdenado(partes[posicao], valores);
    if (par) return { ...(chave ? { chave } : {}), par };
  }
  const declarado = chave ? valores.get(chave) : undefined;
  return chave && declarado ? { chave, valor: declarado } : null;
}

/** Para as opções do "Sua vez": a fórmula `y_C = 6 - 1 - 5` dá `{ chave: "y_C", valor: 0 }`; sem `=`, só o valor. */
export function valorDaOpcao(no: NoFormula, declaradas: Record<string, string>): { chave?: string; valor: Racional; esperado?: Racional } | null {
  const valores = declaracoesDe(declaradas);
  const itens = no.tipo === "sequencia" ? no.itens : [no];
  const { partes, relacoes } = partirNasRelacoes(itens);
  if (relacoes.length === 0) {
    const valor = tentar(itens, valores);
    return valor ? { valor } : null;
  }
  if (relacoes.length === 1 && relacoes[0] === "=" && partes[0].length === 1) {
    const chave = chaveDaVariavel(partes[0][0]);
    const valor = tentar(partes[1], valores);
    if (chave && valor) return { chave, valor, ...(valores.get(chave) ? { esperado: valores.get(chave) } : {}) };
  }
  return null;
}

export function mesmoValor(a: Racional, b: Racional): boolean {
  return igual(a, b);
}
