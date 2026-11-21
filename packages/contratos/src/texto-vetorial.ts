import { GLIFOS_400, GLIFOS_700, GLIFOS_800, UNIDADES_POR_EM } from "./glifos";

/*
 * Texto como contorno: o motor de desenho não depende de nenhuma fonte do aparelho (o servidor nem tem fontes). Cada caractere
 * vira o caminho do glifo da tabela `glifos.ts` (Nunito 400, 700 e 800; Δ e π da Noto Sans), posto na linha de base, na escala
 * do tamanho pedido. Sem kerning. Caractere que não está na tabela cai no "?" (o validador não deixa chegar aqui nada fora do
 * português do Brasil, dos números e da pontuação simples).
 */

/** 400 é o texto corrido da aula (a fórmula em linha o usa ao lado dele); 700, o enunciado, os títulos e os gráficos; 800, os rótulos. */
export type PesoDoTexto = 400 | 700 | 800;

const TABELAS: Readonly<Record<PesoDoTexto, Readonly<Record<string, readonly [number, string]>>>> = { 400: GLIFOS_400, 700: GLIFOS_700, 800: GLIFOS_800 };

/** O itálico das variáveis: o Nunito não tem itálico no pacote, e o dele é um oblíquo de uns 11°; aqui o glifo reto é inclinado. */
export const INCLINACAO_DO_ITALICO = 0.2;

/**
 * O glifo de um caractere: [avanço, contorno]. O que a tabela não tem NUNCA vira "?" (que mentiria sobre o que está escrito): vira um
 * vão do tamanho de um espaço, sem contorno. Quem desenha confere antes com `semGlifo` e, se falta algum, não desenha (a fórmula fica
 * em texto linear e o cliente escreve com a fonte do sistema); o validador não deixa chegar aqui nada fora da tabela.
 */
export function glifoDe(caractere: string, peso: PesoDoTexto = 700): readonly [number, string] {
  return TABELAS[peso][caractere] ?? GLIFOS_700[caractere] ?? [(GLIFOS_700[" "] ?? [250, ""])[0], ""];
}

export function temGlifo(caractere: string, peso: PesoDoTexto = 700): boolean {
  return TABELAS[peso][caractere] !== undefined || GLIFOS_700[caractere] !== undefined;
}

/** Os caracteres do texto que não têm glifo na tabela (sem repetir), na ordem em que aparecem. */
export function semGlifo(texto: string, peso: PesoDoTexto = 700): string[] {
  return [...new Set([...texto].filter((caractere) => !temGlifo(caractere, peso)))];
}

export function larguraDoTexto(texto: string, tamanho: number, peso: PesoDoTexto = 700): number {
  let total = 0;
  for (const caractere of texto) total += glifoDe(caractere, peso)[0];
  return (total * tamanho) / UNIDADES_POR_EM;
}

/** Até duas casas, sem "-0": coordenadas curtas deixam o desenho (e o golden) estável. */
export function arredondar(valor: number): string {
  const arredondado = Math.round(valor * 100) / 100;
  return String(arredondado === 0 ? 0 : arredondado);
}

const PEDACOS = /[MLQZ]|-?\d+(?:\.\d+)?/g;

function transformar(caminho: string, dx: number, linhaDeBase: number, escala: number, inclinacao: number): string {
  const pedacos = caminho.match(PEDACOS) ?? [];
  let saida = "";
  let depoisDeNumero = false;
  for (let i = 0; i < pedacos.length; i += 1) {
    const pedaco = pedacos[i];
    if (pedaco === "M" || pedaco === "L" || pedaco === "Q" || pedaco === "Z") {
      saida += pedaco;
      depoisDeNumero = false;
      continue;
    }
    const gx = Number(pedaco);
    const gy = Number(pedacos[i + 1]);
    i += 1;
    saida += `${depoisDeNumero ? " " : ""}${arredondar(dx + (gx + gy * inclinacao) * escala)} ${arredondar(linhaDeBase - gy * escala)}`;
    depoisDeNumero = true;
  }
  return saida;
}

/**
 * O caminho (`d`, só com M, L, Q e Z, coordenadas absolutas) de um texto com a linha de base em `linhaDeBase` e o começo em `x`.
 * `italico` inclina o glifo (as variáveis das fórmulas).
 */
export function caminhoDoTexto(texto: string, x: number, linhaDeBase: number, tamanho: number, peso: PesoDoTexto = 700, italico = false): string {
  const escala = tamanho / UNIDADES_POR_EM;
  let cursor = x;
  let d = "";
  for (const caractere of texto) {
    const [avanco, caminho] = glifoDe(caractere, peso);
    if (caminho) d += transformar(caminho, cursor, linhaDeBase, escala, italico ? INCLINACAO_DO_ITALICO : 0);
    cursor += avanco * escala;
  }
  return d;
}

export interface CaixaDoGlifo {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}

const caixas = new Map<string, CaixaDoGlifo | null>();

/** A caixa do contorno de um glifo, em unidades da fonte (y para cima): para o motor encaixar os sinais que ele completa. */
export function caixaDoGlifo(caractere: string, peso: PesoDoTexto = 700): CaixaDoGlifo | null {
  const chave = `${peso}:${caractere}`;
  if (caixas.has(chave)) return caixas.get(chave) ?? null;
  const pedacos = (glifoDe(caractere, peso)[1].match(PEDACOS) ?? []).filter((pedaco) => !/[A-Z]/.test(pedaco)).map(Number);
  let caixa: CaixaDoGlifo | null = null;
  if (pedacos.length >= 2) {
    const xs = pedacos.filter((_, i) => i % 2 === 0);
    const ys = pedacos.filter((_, i) => i % 2 === 1);
    caixa = { xmin: Math.min(...xs), xmax: Math.max(...xs), ymin: Math.min(...ys), ymax: Math.max(...ys) };
  }
  caixas.set(chave, caixa);
  return caixa;
}

/** Desloca e escala um `d` gerado pelo motor (só M, L, Q e Z, coordenadas absolutas): para compor desenhos um sobre o outro. */
export function deslocarCaminho(d: string, dx: number, dy: number): string {
  const pedacos = d.match(PEDACOS) ?? [];
  let saida = "";
  let depoisDeNumero = false;
  for (let i = 0; i < pedacos.length; i += 1) {
    const pedaco = pedacos[i];
    if (/[A-Z]/.test(pedaco)) {
      saida += pedaco;
      depoisDeNumero = false;
      continue;
    }
    saida += `${depoisDeNumero ? " " : ""}${arredondar(Number(pedaco) + dx)} ${arredondar(Number(pedacos[i + 1]) + dy)}`;
    i += 1;
    depoisDeNumero = true;
  }
  return saida;
}

/** Só M, L, Q e Z com números: a regra para um `d` que chega a um cliente (o motor é o único que o gera). */
export function caminhoValido(d: string): boolean {
  return /^(?:[MLQ]-?\d+(?:\.\d+)?(?: -?\d+(?:\.\d+)?)*|Z)+$/.test(d) && !/[^MLQZ\d. -]/.test(d);
}
