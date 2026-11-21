import { percorrerFormula, type NoFormula } from "./formula";
import { mesmoValor, racional, racionalNaTela, resultadoDaFormula, type Racional, type ResultadoDaFormula } from "./formula-conta";
import { textoSemFormulas } from "./formula-no-texto";

/*
 * O "Sua vez" não entrega a resposta antes da escolha (spec 15, seção 4). A `formula` e o `visual` do passo saem do que vai pela rede
 * (`resolucao-publica.ts`), mas a FRASE do passo é texto da IA, e ela escreve "Juntando os termos, 0 − 6k = 0, e portanto k = 0." no
 * passo em que a pessoa deveria achar k. Aqui o servidor lê a frase (o nome do passo e a pergunta também) e a compara com o valor
 * certo; a resolução que o traz é recusada (`visuais-validacao.ts`), e o motivo, com a letra e o valor, volta à IA na nova tentativa.
 *
 * A comparação é pelo VALOR (racional exato: 20/6, 10/3 e 3,333… de conta não se confundem com 3,33), nunca pela grafia, em quatro
 * situações (cada uma evita um falso positivo conhecido: o "2" solto que é dado do problema, o "x_B = 3" que é outra grandeza):
 *   1. a cadeia de igualdades da frase: `k = 3`, `3 = k`, `y_C = 3 × 1 − 2 − 3 = −2`, `6 ÷ 2 = 3`. Vale quando começa pela letra do
 *      resultado (ou por uma conta só de números); outra letra (`y_B = 3`) é outra grandeza, e uma equação com a incógnita
 *      (`−6k = 0`) é a premissa, não o resultado;
 *   2. o valor logo depois de uma palavra de resultado ("igual a", "vale", "dá", "obtemos", "chega-se a", "então", "portanto"…), com
 *      dígitos ou por extenso até dez ("dá zero"); "é 3" só no fim da oração;
 *   3. o valor solto com 2 ou mais caracteres (−2, 12, 3,5, 10/3), a não ser que o problema já o traga como dado;
 *   4. o par ordenado inteiro (5, 4) quando o resultado é um ponto.
 * Um algarismo só, solto, não conta (o "2" de "divida por 2" pode ser qualquer coisa); índice (x_1) e expoente (x^2) não são valor.
 */

export interface AlvoDoSuaVez {
  /** A letra do resultado (`y_c`, `k`), em minúsculas e sem chaves; sem ela, só o valor conta. */
  chave?: string;
  valor?: Racional;
  par?: readonly [Racional, Racional];
  /** Como o motivo da recusa o escreve: `y_C = 6`, `0`, `(5, 4)`. */
  rotulo: string;
}

export interface ContextoDoVazamento {
  /** Os números que o problema já informa (chave de `chaveDoValor`): um número solto igual a um deles não é entrega. */
  dados: ReadonlySet<string>;
  /** As letras da pergunta, para o resultado que não vem com letra (o determinante `D`). */
  letras: readonly string[];
}

export interface Vazamento {
  alvo: AlvoDoSuaVez;
  /** O pedaço da frase (já linear) que traz o resultado. */
  trecho: string;
}

const LETRA = String.raw`[A-Za-z](?:_\(?[A-Za-z0-9]+\)?)?`;

export function normalizarLetra(letra: string): string {
  return letra.replace(/[(){}\s]/g, "").toLowerCase();
}

export const chaveDoValor = (valor: Racional): string => `${valor.n}/${valor.d}`;

/** A frase como o leitor a vê, sem cifrão nem LaTeX, com os sinais e operadores num só jeito: `−`→`-`, `×`→`*`, `÷`→`/`, `→`→`->`. */
function linearizar(frase: string): string {
  return textoSemFormulas(frase)
    .replace(/[−–]/g, "-")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/→/g, "->")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ");
}

function decimalExato(texto: string): Racional | null {
  const [inteira, fracionaria = ""] = texto.replace(",", ".").split(".");
  if (inteira.length + fracionaria.length > 12) return null;
  try {
    return racional(Number(inteira + fracionaria), 10 ** fracionaria.length);
  } catch {
    return null;
  }
}

/** Um número escrito (`3`, `-2`, `3,5`, `20/6`) como racional exato; `null` se não for um número. */
export function lerNumero(texto: string): Racional | null {
  const achado = /^([+-]?)(\d+(?:[.,]\d+)?)(?:\/(\d+(?:[.,]\d+)?))?$/.exec(texto.trim());
  if (!achado) return null;
  try {
    let valor = decimalExato(achado[2]);
    if (!valor) return null;
    if (achado[3] !== undefined) {
      const divisor = decimalExato(achado[3]);
      if (!divisor || divisor.n === 0) return null;
      valor = racional(valor.n * divisor.d, valor.d * divisor.n);
    }
    return achado[1] === "-" ? racional(-valor.n, valor.d) : valor;
  } catch {
    return null;
  }
}

/* ----- O que a frase não pode trazer ----- */

function alvoDoResultado(resultado: ResultadoDaFormula): AlvoDoSuaVez | null {
  const letra = resultado.chave ? { chave: normalizarLetra(resultado.chave) } : {};
  const prefixo = resultado.chave ? `${resultado.chave} = ` : "";
  if (resultado.par) {
    return { ...letra, par: resultado.par, rotulo: `${prefixo}(${racionalNaTela(resultado.par[0])}, ${racionalNaTela(resultado.par[1])})` };
  }
  if (resultado.valor) return { ...letra, valor: resultado.valor, rotulo: `${prefixo}${racionalNaTela(resultado.valor)}` };
  return null;
}

/** A opção que é só texto (`k = 3`, `3`): vale quando é uma letra opcional e um número; outro texto ("não existe") não diz valor. */
export function alvoDoTextoDaOpcao(texto: string): AlvoDoSuaVez | null {
  const achado = new RegExp(String.raw`^\s*(?:(${LETRA})\s*=\s*)?([+-]?\d+(?:[.,]\d+)?(?:/\d+(?:[.,]\d+)?)?)\s*\.?\s*$`).exec(linearizar(texto));
  const valor = achado ? lerNumero(achado[2]) : null;
  if (!achado || !valor) return null;
  return alvoDoResultado({ ...(achado[1] ? { chave: achado[1] } : {}), valor });
}

function respostasDaFormula(arvore: NoFormula | undefined, declaradas: Record<string, string>): AlvoDoSuaVez[] {
  const alvos: AlvoDoSuaVez[] = [];
  if (!arvore) return alvos;
  percorrerFormula(arvore, (no) => {
    if (no.tipo !== "destaque" || no.papel !== "resposta") return;
    const resultado = resultadoDaFormula(no.conteudo, declaradas);
    const alvo = resultado ? alvoDoResultado(resultado) : null;
    if (alvo) alvos.push(alvo);
  });
  return alvos;
}

const mesmoAlvo = (a: AlvoDoSuaVez, b: AlvoDoSuaVez): boolean =>
  a.chave === b.chave &&
  Boolean(a.valor && b.valor && mesmoValor(a.valor, b.valor)) === Boolean(a.valor || b.valor) &&
  Boolean(a.par && b.par && mesmoValor(a.par[0], b.par[0]) && mesmoValor(a.par[1], b.par[1])) === Boolean(a.par || b.par);

/**
 * O que a pessoa ainda não pode ver no passo do "Sua vez": o valor da opção certa (a letra vem da fórmula dela) e o que `\resposta{…}`
 * destaca. Um `\resposta{3}` sem letra só vale quando a opção certa não deu valor, e só no passo do próprio "Sua vez" (no último passo
 * ele pode ser a coordenada que já veio de um passo anterior); o par `\resposta{(5, 4)}` vale no passo ou no último.
 */
export function alvosDoSuaVez(entrada: {
  correta: { arvore?: NoFormula; texto?: string };
  arvoreDoPasso?: NoFormula;
  arvoreDoUltimo?: NoFormula;
  declaradas: Record<string, string>;
}): AlvoDoSuaVez[] {
  const { correta, arvoreDoPasso, arvoreDoUltimo, declaradas } = entrada;
  const alvos: AlvoDoSuaVez[] = [];
  const resultado = correta.arvore ? resultadoDaFormula(correta.arvore, declaradas) : null;
  const principal = (resultado ? alvoDoResultado(resultado) : null) ?? (correta.texto ? alvoDoTextoDaOpcao(correta.texto) : null);
  if (principal) alvos.push(principal);
  const doPasso = respostasDaFormula(arvoreDoPasso, declaradas);
  const doUltimo = arvoreDoUltimo === arvoreDoPasso ? [] : respostasDaFormula(arvoreDoUltimo, declaradas);
  for (const alvo of [...doPasso, ...doUltimo]) {
    const valeSolto = alvo.par !== undefined || alvo.chave !== undefined || (!principal && doPasso.includes(alvo));
    if (valeSolto && !alvos.some((outro) => mesmoAlvo(outro, alvo))) alvos.push(alvo);
  }
  return alvos;
}

/* ----- A frase em fichas ----- */

type Ficha =
  | { t: "num"; texto: string; valor: Racional | null; ini: number; fim: number; colado: boolean }
  | { t: "id" | "palavra" | "op"; texto: string; ini: number; fim: number };

const UMA_LETRA_DE_PALAVRA = new Set(["a", "e", "o", "é", "à", "ó"]);
const PADRAO_DE_FICHAS = /(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?)|([A-Za-zÀ-ÿ]+(?:_\(?[A-Za-z0-9]+\)?)?)|(->|[=+\-*/^(),;:.!?<>≠≤≥])/g;

function fichasDe(linear: string): Ficha[] {
  const brutas: Ficha[] = [];
  for (const achado of linear.matchAll(PADRAO_DE_FICHAS)) {
    const ini = achado.index ?? 0;
    const fim = ini + achado[0].length;
    if (achado[1] !== undefined) {
      brutas.push({ t: "num", texto: achado[1], valor: lerNumero(achado[1]), ini, fim, colado: /[A-Za-z(º°ª]/.test(linear[fim] ?? "") });
    } else if (achado[2] !== undefined) {
      const letras = achado[2].split("_")[0];
      const seguinte = /^\s*(.)/.exec(linear.slice(fim))?.[1];
      const palavraDeUmaLetra = letras.length === 1 && !achado[2].includes("_") && UMA_LETRA_DE_PALAVRA.has(letras) && seguinte !== "=";
      brutas.push({ t: letras.length === 1 && !palavraDeUmaLetra ? "id" : "palavra", texto: achado[2], ini, fim });
    } else {
      brutas.push({ t: "op", texto: achado[0], ini, fim });
    }
  }
  // O sinal colado ao número, depois de um operador, de um abre-parênteses, de uma vírgula ou de uma palavra, é do número (`= -2`, `(-1, 3)`).
  const fichas: Ficha[] = [];
  for (let i = 0; i < brutas.length; i += 1) {
    const ficha = brutas[i];
    const proxima = brutas[i + 1];
    const anterior = fichas[fichas.length - 1];
    const binario = anterior && (anterior.t === "id" || anterior.t === "num" || (anterior.t === "op" && anterior.texto === ")"));
    if (ficha.t === "op" && (ficha.texto === "-" || ficha.texto === "+") && proxima?.t === "num" && proxima.ini === ficha.fim && !binario) {
      const texto = `${ficha.texto === "-" ? "-" : ""}${proxima.texto}`;
      fichas.push({ ...proxima, texto, valor: lerNumero(texto), ini: ficha.ini });
      i += 1;
    } else {
      fichas.push(ficha);
    }
  }
  return fichas;
}

const ehOp = (ficha: Ficha | undefined, ...textos: string[]): boolean => ficha?.t === "op" && textos.includes(ficha.texto);

/** As partes da cadeia de igualdades que termina na ficha `fim` (inclusive): de trás para o começo até uma palavra, vírgula, ponto, seta ou abre-parênteses. */
function cadeiaAte(fichas: readonly Ficha[], fim: number): Ficha[][] {
  let inicio = fim;
  let profundidade = 0;
  for (let j = fim - 1; j >= 0; j -= 1) {
    const ficha = fichas[j];
    if (ficha.t === "palavra") break;
    if (ficha.t === "op") {
      if (ficha.texto === ")") profundidade += 1;
      else if (ficha.texto === "(") {
        if (profundidade === 0) break;
        profundidade -= 1;
      } else if (profundidade === 0 && [",", ";", ":", ".", "!", "?", "->"].includes(ficha.texto)) break;
    }
    inicio = j;
  }
  const partes: Ficha[][] = [[]];
  let nivel = 0;
  for (let j = inicio; j <= fim; j += 1) {
    const ficha = fichas[j];
    if (ehOp(ficha, "(")) nivel += 1;
    if (ehOp(ficha, ")")) nivel -= 1;
    if (nivel === 0 && ehOp(ficha, "=")) partes.push([]);
    else partes[partes.length - 1].push(ficha);
  }
  return partes;
}

/** A parte logo depois do `=` na ficha `igual`, até o próximo `=` ou uma palavra/pontuação de fora. */
function parteDepois(fichas: readonly Ficha[], igual: number): Ficha[] {
  const parte: Ficha[] = [];
  let profundidade = 0;
  for (let j = igual + 1; j < fichas.length; j += 1) {
    const ficha = fichas[j];
    if (ficha.t === "palavra") break;
    if (ehOp(ficha, "(")) profundidade += 1;
    if (ehOp(ficha, ")")) {
      if (profundidade === 0) break;
      profundidade -= 1;
    }
    if (profundidade === 0 && ficha.t === "op" && ["=", ",", ";", ":", ".", "!", "?", "->"].includes(ficha.texto)) break;
    parte.push(ficha);
  }
  return parte;
}

const ANTES = "(?:^|[^A-Za-zÀ-ÿ])";
const GATILHO_DE_RESULTADO = new RegExp(
  `${ANTES}(?:igual a|vale|valendo|d[áa]|dando|resulta(?:ndo)?(?: em)?|resultado(?: [ée]| de)?|obtemos|obt[ée]m|obtendo(?:-se)?|encontramos|achamos|chegamos a|chega-se a|conclui-se(?: que)?|ent[ãa]o|portanto|logo)\\s*:?\\s*(?:o valor\\s*)?(?:de\\s+)?$`,
  "i",
);
const GATILHO_DE_E = new RegExp(`${ANTES}(?:[ée]|s[ãa]o|ser[áa])\\s*(?:o valor\\s*)?$`, "i");

const NUMERO_POR_EXTENSO: Readonly<Record<string, number>> = {
  zero: 0, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

/** Os números de um texto (do enunciado do problema) como chaves de `chaveDoValor`. */
export function numerosDoTexto(texto: string): string[] {
  const chaves: string[] = [];
  for (const ficha of fichasDe(linearizar(texto))) {
    if (ficha.t === "num" && ficha.valor && !ficha.colado) chaves.push(chaveDoValor(ficha.valor));
  }
  return chaves;
}

/** As letras de um texto (da pergunta): `y_C`, `D`, `k`, em minúsculas. */
export function letrasDoTexto(texto: string): string[] {
  return fichasDe(linearizar(texto)).filter((ficha) => ficha.t === "id").map((ficha) => normalizarLetra(ficha.texto));
}

/**
 * A frase traz o resultado? O primeiro pedaço que traz, ou `null`. Veja o comentário do arquivo para o que conta e o que não conta.
 */
export function acharVazamento(frase: string, alvos: readonly AlvoDoSuaVez[], contexto: ContextoDoVazamento): Vazamento | null {
  if (alvos.length === 0) return null;
  const linear = linearizar(frase);
  const fichas = fichasDe(linear);
  const trechoAte = (ficha: Ficha, desde = ficha.ini) => linear.slice(Math.max(0, desde), ficha.fim).trim();

  const letraDe = (alvo: AlvoDoSuaVez, letra: string): boolean => (alvo.chave ? letra === alvo.chave : contexto.letras.includes(letra));
  /** A parte é só uma letra (e não `3y_G` nem `x + y`)? Devolve a letra normalizada. */
  const soUmaLetra = (parte: readonly Ficha[]): string | null => (parte.length === 1 && parte[0].t === "id" ? normalizarLetra(parte[0].texto) : null);

  for (let t = 0; t < fichas.length; t += 1) {
    const ficha = fichas[t];

    // O ponto inteiro: `(5, 4)`.
    if (ehOp(ficha, "(")) {
      const [a, virgula, b, fecha] = [fichas[t + 1], fichas[t + 2], fichas[t + 3], fichas[t + 4]];
      if (a?.t === "num" && b?.t === "num" && ehOp(virgula, ",", ";") && ehOp(fecha, ")") && a.valor && b.valor) {
        const achado = alvos.find((alvo) => alvo.par && mesmoValor(alvo.par[0], a.valor as Racional) && mesmoValor(alvo.par[1], b.valor as Racional));
        if (achado) return { alvo: achado, trecho: trechoAte(fecha, ficha.ini) };
      }
      continue;
    }

    const porExtenso = ficha.t === "palavra" ? NUMERO_POR_EXTENSO[ficha.texto.toLowerCase()] : undefined;
    const valor = ficha.t === "num" ? ficha.valor : porExtenso !== undefined ? racional(porExtenso) : null;
    if (!valor || (ficha.t === "num" && ficha.colado)) continue;
    const candidatos = alvos.filter((alvo) => alvo.valor && mesmoValor(alvo.valor, valor));
    if (candidatos.length === 0) continue;

    const anterior = fichas[t - 1];
    const seguinte = fichas[t + 1];
    // Parte de uma conta (`3 - 2`, `2 × 5`): não é o valor sozinho.
    const operando = ehOp(seguinte, "+", "-", "*", "/", "^") || ehOp(anterior, "+", "-", "*", "/", "^");
    if (operando) continue;

    const igualAntes = ehOp(anterior, "=") && !ehOp(fichas[t - 2], "<", ">", "!");
    const igualDepois = ehOp(seguinte, "=") && !ehOp(fichas[t + 2], "=");

    if (igualAntes && ficha.t === "num") {
      const partes = cadeiaAte(fichas, t);
      const primeira = partes[0];
      const letra = soUmaLetra(primeira);
      for (const alvo of candidatos) {
        // Começa pela letra do resultado: é a resposta. Começa por outra letra: é outra grandeza. Tem letra no meio de uma conta
        // (`−6k = 0`): é a equação, a premissa. Só números (`6 ÷ 2 = 3`): é a conta feita.
        const entrega = letra !== null ? letraDe(alvo, letra) : !primeira.some((outra) => outra.t === "id");
        if (entrega) return { alvo, trecho: trechoAte(ficha, primeira[0]?.ini) };
      }
      continue;
    }

    if (igualDepois && ficha.t === "num") {
      // `3 = k`: o valor antes do `=` e a letra do resultado depois dele.
      const letra = soUmaLetra(parteDepois(fichas, t + 1));
      const achado = letra !== null ? candidatos.find((alvo) => letraDe(alvo, letra)) : undefined;
      if (achado) return { alvo: achado, trecho: trechoAte(fichas[t + 2] ?? ficha, ficha.ini) };
      continue;
    }

    const antes = linear.slice(Math.max(0, ficha.ini - 48), ficha.ini);
    const fimDeOracao = !seguinte || ehOp(seguinte, ".", ",", ";", ":", "!", "?");
    if (GATILHO_DE_RESULTADO.test(antes) || (fimDeOracao && GATILHO_DE_E.test(antes))) return { alvo: candidatos[0], trecho: trechoAte(ficha, ficha.ini - 24) };
    if (ficha.t === "num" && ficha.texto.length >= 2 && ficha.valor && !contexto.dados.has(chaveDoValor(ficha.valor))) {
      return { alvo: candidatos[0], trecho: trechoAte(ficha, ficha.ini - 24) };
    }
  }
  return null;
}

/** O motivo da recusa em uma frase, com a letra e o valor, para ir à IA na nova tentativa. */
export function motivoDoVazamento(onde: "texto" | "nome" | "pergunta", alvo: AlvoDoSuaVez, passo: number): string {
  const campo = onde === "texto" ? "o texto" : onde === "nome" ? "o nome" : "a pergunta";
  const dever = onde === "pergunta" ? "a pergunta só pergunta" : "a frase só diz o que fazer";
  // Com a letra ou o ponto, "o resultado y_C = 6"; só o número (o determinante `D` sem letra na fórmula), "o valor 0 do resultado".
  const traz = alvo.chave === undefined && alvo.par === undefined ? `o valor ${alvo.rotulo} do resultado` : `o resultado ${alvo.rotulo}`;
  return `${campo} do passo ${passo} (o "Sua vez") traz ${traz} antes da escolha: ${dever} (como "Agora junte os termos e isole k"), sem o valor nem a conta já feita`;
}
