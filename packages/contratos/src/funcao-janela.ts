import { avaliarFuncao, familiaDaFuncao, type ModeloDaFuncao } from "./funcao-expressao";
import { janelaDosDados } from "./visuais";

/*
 * A janela e a curva do gráfico de função (spec 15, seção 15), em coordenadas dos DADOS (o motor as leva para o desenho):
 * - a janela: x é o domínio com meia unidade de folga; y é a conta exata da seção 2, com C a curva no domínio e D os pontos de destaque que
 *   aparecem: y mín = máx(mín(C, D) − f; mín(D) − 3) e y máx = mín(máx(C, D) + f; máx(D) + 3), com f = 1 (no seno e no cosseno, metade da
 *   amplitude). Os destaques nunca ficam fora; a curva que passa de 3 unidades além deles é recortada na borda. Quando a curva não aparece
 *   (o exercício pergunta um ponto dela), C não entra: a janela é a dos pontos que aparecem e do domínio que o enunciado cita, nunca a da curva;
 * - a curva: no mínimo 64 pontos e 2 por unidade de projeto da largura (até 400), mais as abscissas dos destaques e as pontas do domínio,
 *   ligados como linha contínua e recortados na borda da janela (sem seta); onde a função não existe (raiz de radicando negativo) não há traço.
 */

export const FOLGA_DE_X_DA_FUNCAO = 0.5;
const SOBRA_MAXIMA_DOS_DESTAQUES = 3;
const AMOSTRAS_PARA_A_FAIXA = 240;

export interface CurvaDaJanela {
  modelo: ModeloDaFuncao;
  de?: number;
  ate?: number;
}

export interface JanelaDaFuncao {
  x: [number, number];
  y: [number, number];
  /** Seno e cosseno: as escalas de x e de y são independentes (a altura do gráfico é cerca de metade da largura), e o x se marca em π/2. */
  trigonometrica: boolean;
  /** O domínio de cada curva, na ordem em que vieram (o dela, ou o padrão). */
  dominios: [number, number][];
}

/** O domínio de uma curva sem `de` e `ate`: [0, 2π] no seno e no cosseno; senão, dos destaques com uma unidade de folga e no mínimo 4 de largura. */
export function dominioPadraoDaFuncao(modelo: ModeloDaFuncao, abscissasDosDestaques: readonly number[]): [number, number] {
  if (familiaDaFuncao(modelo) === "trigonometrica") return [0, 2 * Math.PI];
  return janelaDosDados(abscissasDosDestaques, false, 1);
}

/** As abscissas da amostragem: `n` pontos igualmente espaçados de `de` a `ate`, mais as extras que cabem no domínio (o começo da raiz, os destaques). */
export function abscissasDaCurva(de: number, ate: number, n: number, extras: readonly number[] = []): number[] {
  const total = Math.max(2, Math.round(n));
  const xs = Array.from({ length: total }, (_, i) => de + ((ate - de) * i) / (total - 1));
  for (const extra of extras) if (Number.isFinite(extra) && extra > de && extra < ate) xs.push(extra);
  return [...new Set(xs.sort((a, b) => a - b))];
}

/**
 * As abscissas que a amostragem não pode perder: o começo de cada raiz (o radicando é zero), o vértice da parábola, os pontos de derivada nula da
 * cúbica e os picos do seno e do cosseno. Com elas entre as amostras, o extremo que a janela mede e o traço que se desenha são exatos.
 */
export function pontosCriticosDoModelo(modelo: ModeloDaFuncao, de: number, ate: number): number[] {
  const xs: number[] = [];
  if (modelo.atomos.length === 0) {
    const [, c1, c2, c3] = modelo.poli;
    if (Math.abs(c3) > 1e-12) {
      // 3·c3·x² + 2·c2·x + c1 = 0
      const delta = 4 * c2 * c2 - 12 * c3 * c1;
      if (delta >= 0) xs.push((-2 * c2 + Math.sqrt(delta)) / (6 * c3), (-2 * c2 - Math.sqrt(delta)) / (6 * c3));
    } else if (Math.abs(c2) > 1e-12) {
      xs.push(-c1 / (2 * c2));
    }
  }
  for (const atomo of modelo.atomos) {
    if (Math.abs(atomo.a) < 1e-12) continue;
    if (atomo.tipo === "raiz") {
      xs.push(-atomo.b / atomo.a);
      continue;
    }
    // O seno tem pico quando a·x + b = π/2 + kπ; o cosseno, quando a·x + b = kπ.
    const base = atomo.tipo === "seno" ? Math.PI / 2 : 0;
    const [u0, u1] = [atomo.a * de + atomo.b, atomo.a * ate + atomo.b].sort((x, y) => x - y);
    const primeiro = Math.ceil((u0 - base) / Math.PI);
    for (let k = primeiro; base + k * Math.PI <= u1 && k < primeiro + 400; k += 1) xs.push((base + k * Math.PI - atomo.b) / atomo.a);
  }
  return xs.filter((x) => Number.isFinite(x) && x > de && x < ate);
}

/** A faixa de valores da curva no domínio (os extremos das amostras); `null` se ela não existe em nenhum ponto. */
export function faixaDaCurva(modelo: ModeloDaFuncao, de: number, ate: number): [number, number] | null {
  let minimo = Infinity;
  let maximo = -Infinity;
  for (const x of abscissasDaCurva(de, ate, AMOSTRAS_PARA_A_FAIXA, pontosCriticosDoModelo(modelo, de, ate))) {
    const y = avaliarFuncao(modelo, x);
    if (!Number.isFinite(y)) continue;
    minimo = Math.min(minimo, y);
    maximo = Math.max(maximo, y);
  }
  return minimo <= maximo ? [minimo, maximo] : null;
}

/**
 * A janela do gráfico. `pontos` são os destaques que aparecem neste contexto (`[x, y]`); `mostrarCurva` é falso quando o exercício pergunta um
 * ponto da curva e o enunciado não pode desenhá-la: aí nem a janela olha para ela.
 */
export function janelaDaFuncao(curvas: readonly CurvaDaJanela[], pontos: readonly (readonly [number, number])[], mostrarCurva: boolean): JanelaDaFuncao {
  const abscissas = pontos.map(([x]) => x);
  const dominios = curvas.map((curva): [number, number] => {
    const padrao = dominioPadraoDaFuncao(curva.modelo, abscissas);
    const de = curva.de ?? padrao[0];
    const ate = curva.ate ?? padrao[1];
    return de < ate ? [de, ate] : padrao;
  });
  const trigonometrica = curvas.some((curva) => familiaDaFuncao(curva.modelo) === "trigonometrica");
  const [xMin, xMax] = dominios.length > 0
    ? [Math.min(...dominios.map(([de]) => de)) - FOLGA_DE_X_DA_FUNCAO, Math.max(...dominios.map(([, ate]) => ate)) + FOLGA_DE_X_DA_FUNCAO]
    : [janelaDosDados(abscissas, false, 1)[0] - FOLGA_DE_X_DA_FUNCAO, janelaDosDados(abscissas, false, 1)[1] + FOLGA_DE_X_DA_FUNCAO];

  const ys = pontos.map(([, y]) => y);
  const faixas = mostrarCurva
    ? curvas.flatMap((curva, i) => {
      const faixa = faixaDaCurva(curva.modelo, dominios[i][0], dominios[i][1]);
      return faixa ? [faixa] : [];
    })
    : [];
  const [cMin, cMax] = faixas.length > 0 ? [Math.min(...faixas.map(([menor]) => menor)), Math.max(...faixas.map(([, maior]) => maior))] : [Infinity, -Infinity];
  // f: uma unidade; no seno e no cosseno, metade da amplitude (a janela do seno com amplitude 1 vai de −1,5 a 1,5).
  const amplitude = faixas.length > 0 && trigonometrica ? (cMax - cMin) / 2 : 1;
  const folga = trigonometrica && faixas.length > 0 ? amplitude / 2 : 1;
  let yMin: number;
  let yMax: number;
  if (ys.length > 0) {
    const [dMin, dMax] = [Math.min(...ys), Math.max(...ys)];
    yMin = Math.max(Math.min(cMin, dMin) - folga, dMin - SOBRA_MAXIMA_DOS_DESTAQUES);
    yMax = Math.min(Math.max(cMax, dMax) + folga, dMax + SOBRA_MAXIMA_DOS_DESTAQUES);
  } else if (faixas.length > 0) {
    [yMin, yMax] = [cMin - folga, cMax + folga];
  } else {
    [yMin, yMax] = [-2, 2];
  }
  if (!(yMax - yMin > 1e-9)) [yMin, yMax] = [yMin - 1, yMax + 1];
  return { x: [xMin, xMax], y: [yMin, yMax], trigonometrica, dominios };
}

export type TrechoDaCurva = [number, number][];

/** O ponto da curva entre `a` e `b` (um dentro da faixa, o outro fora) onde ela cruza a borda `alvo`: bisseção na função, não na corda. */
function cruzamento(modelo: ModeloDaFuncao, a: readonly [number, number], b: readonly [number, number], alvo: number): [number, number] {
  let [pouco, muito] = [a, b];
  for (let volta = 0; volta < 40; volta += 1) {
    const x = (pouco[0] + muito[0]) / 2;
    const y = avaliarFuncao(modelo, x);
    if (!Number.isFinite(y)) break;
    if ((y - alvo) * (pouco[1] - alvo) <= 0) muito = [x, y];
    else pouco = [x, y];
  }
  return [(pouco[0] + muito[0]) / 2, alvo];
}

/**
 * A curva em trechos de linha contínua (coordenadas dos dados), recortada na borda da faixa de y (o ponto de corte é onde a função cruza a borda);
 * cada trecho tem ao menos dois pontos. Onde a função não existe, o trecho acaba. As amostras são `n` mais os pontos críticos e as extras (os destaques).
 */
export function trechosDaCurva(modelo: ModeloDaFuncao, de: number, ate: number, y: readonly [number, number], n: number, extras: readonly number[] = []): TrechoDaCurva[] {
  const [y0, y1] = y;
  const dentro = (valor: number): boolean => valor >= y0 && valor <= y1;
  const pontos = abscissasDaCurva(de, ate, n, [...pontosCriticosDoModelo(modelo, de, ate), ...extras]).map((x): [number, number] | null => {
    const valor = avaliarFuncao(modelo, x);
    return Number.isFinite(valor) ? [x, valor] : null;
  });
  const trechos: TrechoDaCurva[] = [];
  let atual: TrechoDaCurva = [];
  const fechar = () => {
    if (atual.length >= 2) trechos.push(atual);
    atual = [];
  };
  for (let i = 1; i < pontos.length; i += 1) {
    const [a, b] = [pontos[i - 1], pontos[i]];
    if (!a || !b) {
      fechar();
      continue;
    }
    const [dentroA, dentroB] = [dentro(a[1]), dentro(b[1])];
    if (dentroA && atual.length === 0) atual = [a];
    if (dentroA && dentroB) {
      atual.push(b);
    } else if (dentroA) {
      atual.push(cruzamento(modelo, a, b, b[1] > y1 ? y1 : y0));
      fechar();
    } else if (dentroB) {
      fechar();
      atual = [cruzamento(modelo, a, b, a[1] > y1 ? y1 : y0), b];
    } else if ((a[1] > y1 && b[1] < y0) || (a[1] < y0 && b[1] > y1)) {
      // Atravessa a faixa inteira entre duas amostras (uma subida muito íngreme): entra por uma borda e sai pela outra.
      fechar();
      atual = [cruzamento(modelo, a, b, a[1] > y1 ? y1 : y0), cruzamento(modelo, a, b, b[1] > y1 ? y1 : y0)];
      fechar();
    } else {
      fechar();
    }
  }
  fechar();
  return trechos;
}
