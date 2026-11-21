import { formulaCanonica, lerFormula, type NoFormula } from "./formula";

/*
 * A expressão de uma função de x (spec 15, seção 15): o que a IA escreve em `curvas[].latex`, lido, conferido e pronto para calcular.
 * A IA erra conta e o servidor não: quem calcula as raízes, o vértice, o intercepto e o valor num ponto é este arquivo, e o desenho
 * amostra a mesma função. Aceita só o que a spec lista: uma soma de termos, e cada termo é um número, número × xⁿ (n de 1 a 3), número ×
 * √(a·x + b) ou número × sin / cos (a·x + b); π vale nos coeficientes. Tangente, log, exponencial, divisão por x e x dentro de raiz não
 * linear NÃO valem: a expressão é recusada e a curva some (a figura segue sem ela). O módulo |·| e a interseção ficam para o marco 12b.
 *
 * A leitura parte do LaTeX restrito da seção 1 (`lerFormula`), com `\sin`, `\cos` e `\sen` trocados por `\text{sin}` e `\text{cos}` (a
 * gramática não tem função): o que se desenha na fórmula da figura é o mesmo texto canônico que se lê aqui. Parênteses e produtos
 * `(x − 2)^2 − 1` valem quando o resultado é um polinômio até o grau 3 (a leitura expande), e `f(x) =` ou `y =` na frente é ignorado.
 */

/** O nome do seno e do cosseno como a fórmula da figura os desenha (spec 15, seção 15: "h(x) = sin x"). */
export const NOME_DO_SENO = "sin";
export const NOME_DO_COSSENO = "cos";

export type TipoDeAtomo = "raiz" | "seno" | "cosseno";

/** `coef · √(a·x + b)`, `coef · sin(a·x + b)` ou `coef · cos(a·x + b)`. */
export interface AtomoDaFuncao {
  tipo: TipoDeAtomo;
  coef: number;
  a: number;
  b: number;
}

/** A função lida: o polinômio (coeficientes do grau 0 ao 3) mais os termos de raiz, seno e cosseno. */
export interface ModeloDaFuncao {
  poli: [number, number, number, number];
  atomos: AtomoDaFuncao[];
}

export type LeituraDaFuncao = { ok: true; modelo: ModeloDaFuncao; canonica: string } | { ok: false; erro: string };

/** A família dá a escala do gráfico: polinômio e raiz com a mesma unidade em x e y, seno e cosseno com escalas independentes. */
export type FamiliaDaFuncao = "polinomio" | "raiz" | "trigonometrica";

const TAMANHO_MAXIMO_DA_EXPRESSAO = 80;
const COEFICIENTE_MAXIMO = 1000;
const EPSILON = 1e-12;

class Invalida extends Error {}
const recusar = (motivo: string): never => {
  throw new Invalida(motivo);
};

/* ----- A álgebra: soma, produto por número, produto de polinômios e potência ----- */

const zero = (): ModeloDaFuncao => ({ poli: [0, 0, 0, 0], atomos: [] });
const constante = (valor: number): ModeloDaFuncao => ({ poli: [valor, 0, 0, 0], atomos: [] });
const ehConstante = (modelo: ModeloDaFuncao): boolean => modelo.atomos.length === 0 && modelo.poli[1] === 0 && modelo.poli[2] === 0 && modelo.poli[3] === 0;

function somar(a: ModeloDaFuncao, b: ModeloDaFuncao, sinal: 1 | -1): ModeloDaFuncao {
  return {
    poli: a.poli.map((coeficiente, grau) => coeficiente + sinal * b.poli[grau]) as ModeloDaFuncao["poli"],
    atomos: [...a.atomos, ...b.atomos.map((atomo) => ({ ...atomo, coef: sinal * atomo.coef }))],
  };
}

function escalar(a: ModeloDaFuncao, fator: number): ModeloDaFuncao {
  return { poli: a.poli.map((coeficiente) => coeficiente * fator) as ModeloDaFuncao["poli"], atomos: a.atomos.map((atomo) => ({ ...atomo, coef: atomo.coef * fator })) };
}

function multiplicar(a: ModeloDaFuncao, b: ModeloDaFuncao): ModeloDaFuncao {
  if (a.atomos.length > 0 && b.atomos.length > 0) return recusar("seno, cosseno ou raiz multiplicados entre si");
  if (a.atomos.length > 0 || b.atomos.length > 0) {
    const [com, sem] = a.atomos.length > 0 ? [a, b] : [b, a];
    if (!ehConstante(sem)) return recusar("seno, cosseno e raiz só se multiplicam por um número, não por x");
    return escalar(com, sem.poli[0]);
  }
  const poli: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      if (a.poli[i] === 0 || b.poli[j] === 0) continue;
      if (i + j > 3) return recusar("grau acima de 3");
      poli[i + j] += a.poli[i] * b.poli[j];
    }
  }
  return { poli, atomos: [] };
}

function potencia(base: ModeloDaFuncao, expoente: number): ModeloDaFuncao {
  if (expoente < 0 || expoente > 3) return recusar("expoente: inteiro de 0 a 3");
  if (expoente === 0) return constante(1);
  if (expoente > 1 && base.atomos.length > 0) return recusar("potência de seno, cosseno ou raiz");
  let resultado = base;
  for (let volta = 1; volta < expoente; volta += 1) resultado = multiplicar(resultado, base);
  return resultado;
}

/* ----- A leitura da árvore ----- */

const itensDe = (no: NoFormula): NoFormula[] => (no.tipo === "sequencia" ? no.itens : [no]);

function literal(valor: string): number {
  const limpo = valor.replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(limpo)) return recusar(`número ${valor}: no máximo duas casas decimais`);
  const numero = Number(limpo);
  if (numero > COEFICIENTE_MAXIMO) return recusar(`número ${valor}: acima de ${COEFICIENTE_MAXIMO}`);
  return numero;
}

function atomoDe(tipo: TipoDeAtomo, argumento: ModeloDaFuncao): ModeloDaFuncao {
  if (argumento.atomos.length > 0 || argumento.poli[2] !== 0 || argumento.poli[3] !== 0) return recusar("o que fica dentro de sin, cos e raiz é a·x + b");
  return { poli: [0, 0, 0, 0], atomos: [{ tipo, coef: 1, a: argumento.poli[1], b: argumento.poli[0] }] };
}

function fator(no: NoFormula): ModeloDaFuncao {
  switch (no.tipo) {
    case "numero":
      return constante(literal(no.valor));
    case "simbolo":
      return no.valor === "π" ? constante(Math.PI) : recusar("Δ não vale numa função");
    case "variavel":
      return no.valor === "x" ? { poli: [0, 1, 0, 0], atomos: [] } : recusar(`só a variável x vale (veio ${no.valor})`);
    case "parenteses":
      return soma(itensDe(no.conteudo));
    case "sequencia":
      return soma(no.itens);
    case "script": {
      if (no.indice) return recusar("índice não vale numa função");
      const base = fator(no.base);
      if (!no.expoente) return base;
      if (no.expoente.tipo !== "numero" || !/^\d+$/.test(no.expoente.valor)) return recusar("expoente: inteiro de 0 a 3 (x^2, x^3)");
      return potencia(base, Number(no.expoente.valor));
    }
    case "fracao": {
      const numerador = soma(itensDe(no.numerador));
      const denominador = soma(itensDe(no.denominador));
      if (!ehConstante(denominador) || Math.abs(denominador.poli[0]) < EPSILON) return recusar("só se divide por um número");
      return escalar(numerador, 1 / denominador.poli[0]);
    }
    case "raiz":
      return atomoDe("raiz", soma(itensDe(no.radicando)));
    default:
      return recusar(`${no.tipo} não vale numa função`);
  }
}

const NOMES_DAS_FUNCOES: Readonly<Record<string, TipoDeAtomo>> = { sin: "seno", sen: "seno", cos: "cosseno" };

/** Um termo: fatores lado a lado (produto), `×` e `÷` por número; `sin` e `cos` levam o argumento entre parênteses ou o produto que segue. */
function termo(itens: readonly NoFormula[]): ModeloDaFuncao {
  let acumulado = constante(1);
  let divide = false;
  let visto = false;
  for (let i = 0; i < itens.length; i += 1) {
    const item = itens[i];
    if (item.tipo === "operador") {
      if (item.valor === "×") divide = false;
      else if (item.valor === "÷") divide = true;
      else return recusar(`o operador ${item.valor} não vale numa função`);
      continue;
    }
    let atual: ModeloDaFuncao;
    if (item.tipo === "texto" && item.valor in NOMES_DAS_FUNCOES) {
      const proximo = itens[i + 1];
      let argumento: ModeloDaFuncao;
      if (proximo?.tipo === "parenteses") {
        argumento = soma(itensDe(proximo.conteudo));
        i += 1;
      } else {
        const resto: NoFormula[] = [];
        let j = i + 1;
        while (j < itens.length && itens[j].tipo !== "operador") {
          resto.push(itens[j]);
          j += 1;
        }
        if (resto.length === 0) return recusar("sin e cos precisam de um argumento");
        argumento = termo(resto);
        i = j - 1;
      }
      atual = atomoDe(NOMES_DAS_FUNCOES[item.valor], argumento);
    } else if (item.tipo === "texto") {
      return recusar(`a função ${item.valor} não vale (só sin e cos)`);
    } else {
      atual = fator(item);
    }
    if (divide) {
      if (!ehConstante(atual) || Math.abs(atual.poli[0]) < EPSILON) return recusar("só se divide por um número");
      acumulado = escalar(acumulado, 1 / atual.poli[0]);
      divide = false;
    } else {
      acumulado = multiplicar(acumulado, atual);
    }
    visto = true;
  }
  return visto ? acumulado : recusar("termo vazio");
}

/** Uma soma de termos separados por + e −; um sinal no começo (ou dois seguidos) vale para o termo que vem depois. */
function soma(itens: readonly NoFormula[]): ModeloDaFuncao {
  const termos: { sinal: 1 | -1; itens: NoFormula[] }[] = [];
  let sinal: 1 | -1 = 1;
  let atual: NoFormula[] = [];
  for (const item of itens) {
    if (item.tipo === "operador" && (item.valor === "+" || item.valor === "-")) {
      const anterior = atual[atual.length - 1];
      if (atual.length > 0 && anterior.tipo === "operador") return recusar("sinal depois de um operador");
      if (atual.length > 0) {
        termos.push({ sinal, itens: atual });
        atual = [];
        sinal = 1;
      }
      if (item.valor === "-") sinal = sinal === 1 ? -1 : 1;
      continue;
    }
    atual.push(item);
  }
  if (atual.length === 0) return recusar("a expressão termina num sinal");
  termos.push({ sinal, itens: atual });
  return termos.reduce((acumulado, { sinal: s, itens: lista }) => somar(acumulado, termo(lista), s), zero());
}

/** `f(x) =`, `g(x) =` ou `y =` na frente da expressão: o que vale é o que vem depois do `=`. */
function ladoDireito(itens: readonly NoFormula[]): readonly NoFormula[] {
  const igual = itens.findIndex((item) => item.tipo === "operador" && item.valor === "=");
  if (igual < 0) return itens;
  const esquerda = itens.slice(0, igual);
  const nome = esquerda[0];
  const ehNome = nome?.tipo === "variavel" && /^[fghy]$/.test(nome.valor);
  const ehChamada = esquerda.length === 2 && esquerda[1].tipo === "parenteses" && itensDe(esquerda[1].conteudo).length === 1 && itensDe(esquerda[1].conteudo)[0].tipo === "variavel";
  if (!ehNome || (esquerda.length !== 1 && !ehChamada)) return recusar("a expressão é em x, sem igualdade no meio");
  return itens.slice(igual + 1);
}

/** `\sin`, `\sen` e `\cos` viram `\text{sin}` e `\text{cos}`: a gramática da fórmula não tem função, e o texto canônico é o que se desenha. */
function prepararFonte(fonte: string): string {
  return fonte
    .replace(/\\(?:sin|sen)(?![A-Za-z])/g, `\\text{${NOME_DO_SENO}}`)
    .replace(/\\cos(?![A-Za-z])/g, `\\text{${NOME_DO_COSSENO}}`)
    .replace(/\\(?:operatorname|mathrm)\{(?:sen|sin)\}/g, `\\text{${NOME_DO_SENO}}`)
    .replace(/\\(?:operatorname|mathrm)\{cos\}/g, `\\text{${NOME_DO_COSSENO}}`)
    .replace(/\\text\{sen\}/g, `\\text{${NOME_DO_SENO}}`);
}

/** Lê a expressão de uma curva. `canonica` é o LaTeX que a figura desenha (sem o `f(x) =`), na forma canônica da fórmula. */
export function lerExpressaoDaFuncao(fonte: unknown): LeituraDaFuncao {
  if (typeof fonte !== "string") return { ok: false, erro: "a expressão não é um texto" };
  if (fonte.length === 0 || fonte.length > TAMANHO_MAXIMO_DA_EXPRESSAO) return { ok: false, erro: `a expressão precisa de 1 a ${TAMANHO_MAXIMO_DA_EXPRESSAO} caracteres` };
  const lida = lerFormula(prepararFonte(fonte));
  if (!lida.ok) return { ok: false, erro: lida.erro };
  try {
    const direita = ladoDireito(itensDe(lida.arvore));
    const modelo = soma(direita);
    for (const coeficiente of [...modelo.poli, ...modelo.atomos.flatMap((atomo) => [atomo.coef, atomo.a, atomo.b])]) {
      if (!Number.isFinite(coeficiente) || Math.abs(coeficiente) > COEFICIENTE_MAXIMO * 1000) return { ok: false, erro: "coeficiente fora de escala" };
    }
    const arvore: NoFormula = direita.length === 1 ? direita[0] : { tipo: "sequencia", itens: [...direita] };
    return { ok: true, modelo, canonica: formulaCanonica(arvore) };
  } catch (erro) {
    if (erro instanceof Invalida) return { ok: false, erro: erro.message };
    throw erro;
  }
}

/* ----- O que se calcula com a função ----- */

/** O valor da função em x; `NaN` onde ela não existe (raiz de radicando negativo). */
export function avaliarFuncao(modelo: ModeloDaFuncao, x: number): number {
  let y = modelo.poli[0] + x * (modelo.poli[1] + x * (modelo.poli[2] + x * modelo.poli[3]));
  for (const atomo of modelo.atomos) {
    const argumento = atomo.a * x + atomo.b;
    if (atomo.tipo === "raiz") {
      if (argumento < -EPSILON) return Number.NaN;
      y += atomo.coef * Math.sqrt(Math.max(0, argumento));
    } else {
      y += atomo.coef * (atomo.tipo === "seno" ? Math.sin(argumento) : Math.cos(argumento));
    }
  }
  return y;
}

/** O maior grau com coeficiente (0 para a constante). */
export function grauDoPolinomio(modelo: ModeloDaFuncao): number {
  for (let grau = 3; grau > 0; grau -= 1) if (Math.abs(modelo.poli[grau]) > EPSILON) return grau;
  return 0;
}

/** Só polinômio, sem termo de raiz, seno ou cosseno: os destaques calculados valem só aqui. */
export const soPolinomio = (modelo: ModeloDaFuncao): boolean => modelo.atomos.length === 0;

export function familiaDaFuncao(modelo: ModeloDaFuncao): FamiliaDaFuncao {
  if (modelo.atomos.some((atomo) => atomo.tipo === "seno" || atomo.tipo === "cosseno")) return "trigonometrica";
  return modelo.atomos.some((atomo) => atomo.tipo === "raiz") ? "raiz" : "polinomio";
}

/** O zero que não é "menos zero" (`-0 + 0` é `0`): o que se guarda e se mostra nunca traz o sinal de um zero. */
const semSinalDoZero = (valor: number): number => valor + 0;

/** As raízes reais, da menor para a maior, do grau 1 e do grau 2; `null` onde o servidor não calcula (grau 3, seno, raiz…). */
export function raizesDaFuncao(modelo: ModeloDaFuncao): number[] | null {
  if (!soPolinomio(modelo)) return null;
  const grau = grauDoPolinomio(modelo);
  const [c, b, a] = modelo.poli;
  if (grau === 0) return Math.abs(c) < EPSILON ? null : [];
  if (grau === 1) return [semSinalDoZero(-c / b)];
  if (grau === 2) {
    const delta = b * b - 4 * a * c;
    if (delta < -EPSILON) return [];
    if (Math.abs(delta) <= EPSILON) return [semSinalDoZero(-b / (2 * a))];
    const raiz = Math.sqrt(delta);
    return [(-b - raiz) / (2 * a), (-b + raiz) / (2 * a)].map(semSinalDoZero).sort((x, y) => x - y);
  }
  return null;
}

/** O vértice da parábola (grau 2); `null` nas outras. */
export function verticeDaFuncao(modelo: ModeloDaFuncao): [number, number] | null {
  if (!soPolinomio(modelo) || grauDoPolinomio(modelo) !== 2) return null;
  const x = semSinalDoZero(-modelo.poli[1] / (2 * modelo.poli[2]));
  return [x, semSinalDoZero(avaliarFuncao(modelo, x))];
}

/** O intercepto em y: onde a curva corta o eixo, `(0, f(0))`; `null` se ela não existe em 0 (raiz de radicando negativo). */
export function interceptoDaFuncao(modelo: ModeloDaFuncao): [number, number] | null {
  const y = avaliarFuncao(modelo, 0);
  return Number.isFinite(y) ? [0, semSinalDoZero(y)] : null;
}

/** O valor lido de um domínio ou de um `x`: um número, ou um texto com π ("\\pi", "2\\pi", "\\frac{\\pi}{2}", "3π/2"). `null` se não lê. */
export function lerNumeroComPi(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  if (typeof bruto !== "string") return null;
  const fonte = bruto.trim().replace(/π/g, "\\pi").replace(/−/g, "-");
  if (!fonte) return null;
  const lida = lerExpressaoDaFuncao(fonte);
  if (!lida.ok || !ehConstante(lida.modelo)) return null;
  return lida.modelo.poli[0];
}

/** `x` é um múltiplo de π/4 (com a folga dos arredondamentos)? Devolve o múltiplo (3 para 3π/4), ou `null`. */
export function multiploDePiSobre4(x: number): number | null {
  const multiplo = Math.round((x * 4) / Math.PI);
  return Math.abs(x - (multiplo * Math.PI) / 4) < 1e-6 ? multiplo : null;
}

/** O valor na tela: múltiplo de π/4 vira fração de π ("π/2", "3π/2", "−π/4", "2π", "π"); o resto, com vírgula decimal e duas casas. */
export function numeroComPiParaTela(valor: number): string {
  const multiplo = multiploDePiSobre4(valor);
  if (multiplo === null || multiplo === 0) return numeroDecimalParaTela(valor);
  const sinal = multiplo < 0 ? "−" : "";
  const n = Math.abs(multiplo);
  const divisor = n % 4 === 0 ? 1 : n % 2 === 0 ? 2 : 4;
  const numerador = n / (4 / divisor);
  return `${sinal}${numerador === 1 ? "" : numerador}π${divisor === 1 ? "" : `/${divisor}`}`;
}

function numeroDecimalParaTela(valor: number): string {
  const texto = String(Math.round(valor * 100) / 100).replace("-", "−").replace(".", ",");
  return texto === "−0" ? "0" : texto;
}

/** O rótulo do ponto sobre a curva: "A (1, 0)", "M (π/2, 1)", e com decimal "R (−0,5; 0)" (a vírgula decimal não se confunde com a do par). */
export function rotuloDaFuncao(id: string, x: number, y: number): string {
  const [tx, ty] = [numeroComPiParaTela(x), numeroComPiParaTela(y)];
  return `${id} (${tx}${tx.includes(",") || ty.includes(",") ? "; " : ", "}${ty})`;
}
