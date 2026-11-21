import { EIXO_MATEMATICO, UNIDADES_POR_EM } from "./glifos";
import { LARGURA_DO_ESPACO_EM_EM, ehSinal, formulaCabeEmLinha, numeroNaTela, percorrerFormula, vaoAutomatico, vaoDaPalavra, type NoFormula, type PapelDestaque } from "./formula";
import { caixaDoGlifo, larguraDoTexto, semGlifo, type PesoDoTexto } from "./texto-vetorial";
import { PISO_DO_TEXTO, type PapelDeCor, type Tracejado } from "./visuais";

/*
 * Layout da fórmula (spec 15, seção 1): cada nó vira uma caixa com largura, altura acima da linha de base, profundidade abaixo
 * dela e as marcas que a desenham, em coordenadas locais (x para a direita, y para baixo, linha de base em y = 0). As caixas se
 * encaixam por medidas, nunca por tentativa e erro, e é a mesma conta na web, no app e no PNG do servidor.
 */

export type Comando =
  | readonly ["M", number, number]
  | readonly ["L", number, number]
  | readonly ["Q", number, number, number, number]
  | readonly ["Z"];

export type Marca =
  | { m: "texto"; texto: string; x: number; y: number; tamanho: number; peso: PesoDoTexto; italico: boolean; cor: PapelDeCor; opacidade?: number; halo?: boolean }
  | { m: "linha"; x1: number; y1: number; x2: number; y2: number; cor: PapelDeCor; largura: number; tracejado?: Tracejado; opacidade?: number }
  | { m: "retangulo"; x: number; y: number; largura: number; altura: number; raio?: number; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; opacidade?: number }
  | { m: "circulo"; cx: number; cy: number; raio: number; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; tracejado?: Tracejado; opacidade?: number }
  | { m: "caminho"; cmds: readonly Comando[]; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; tracejado?: Tracejado; opacidade?: number };

export interface Caixa {
  l: number;
  a: number;
  p: number;
  marcas: Marca[];
}

export interface Estilo {
  tamanho: number;
  cor: PapelDeCor;
  /** As variáveis vão em itálico; no índice e no expoente ficam retas. */
  italico: boolean;
  /** 1 no corpo da fórmula; 0,5 dentro do índice e do expoente ("n+1", não "n + 1"). */
  respiro: number;
  /**
   * No meio de uma frase (spec 15, seção 9): índice e expoente a 70% do texto (no mínimo 11), 0,2 em de cada lado dos sinais,
   * parênteses do tamanho do texto, a fração simples como "a/b", tudo dentro de uma linha de 1,5 em.
   */
  linha?: boolean;
  /** O peso do texto: o do texto ao redor, em linha (400 na aula, 700 no enunciado); 700 no resto. As variáveis seguem em itálico. */
  peso?: PesoDoTexto;
}

export const A_DO_TEXTO = 0.74;
export const P_DO_TEXTO = 0.22;
/** Respiro de cada lado: 5 nas relações, 4 em + − × ÷, 6 ao lado de colchete ou de barra de determinante (spec 15, seção 8). */
const ESPACO_DA_RELACAO = 5;
const ESPACO_DO_SINAL = 4;
const ESPACO_DA_MOLDURA = 6;
const RELACOES: ReadonlySet<string> = new Set(["=", "≠", "<", ">", "≤", "≥", "→"]);
const RESPIRO = 1;
const BARRA_DA_FRACAO = 2;
const FOLGA_DA_FRACAO = 4;

export const pisar = (tamanho: number): number => Math.max(PISO_DO_TEXTO, tamanho);
/** Em linha o índice e o expoente podem ir a 11 (70% de 16): o piso de 13 é do desenho avulso, não do texto corrido. */
export const PISO_EM_LINHA = 11;
const pisoDo = (estilo: Estilo): number => (estilo.linha ? PISO_EM_LINHA : PISO_DO_TEXTO);
const tamanhoDo = (estilo: Estilo): number => Math.max(pisoDo(estilo), estilo.tamanho);
/** Escala do índice e do expoente: 65% no desenho avulso, 70% em linha. */
const escalaDoScript = (estilo: Estilo): number => (estilo.linha ? 0.7 : 0.65);
/** O respiro de cada lado de um sinal, em linha: 0,2 em. */
const RESPIRO_EM_LINHA_EM_EM = 0.2;
export const eixoDe = (tamanho: number): number => (EIXO_MATEMATICO / UNIDADES_POR_EM) * tamanho;

function moverComando(comando: Comando, dx: number, dy: number): Comando {
  switch (comando[0]) {
    case "M":
    case "L":
      return [comando[0], comando[1] + dx, comando[2] + dy];
    case "Q":
      return ["Q", comando[1] + dx, comando[2] + dy, comando[3] + dx, comando[4] + dy];
    default:
      return comando;
  }
}

export function deslocar(marcas: readonly Marca[], dx: number, dy: number): Marca[] {
  return marcas.map((marca): Marca => {
    switch (marca.m) {
      case "texto":
        return { ...marca, x: marca.x + dx, y: marca.y + dy };
      case "linha":
        return { ...marca, x1: marca.x1 + dx, x2: marca.x2 + dx, y1: marca.y1 + dy, y2: marca.y2 + dy };
      case "retangulo":
        return { ...marca, x: marca.x + dx, y: marca.y + dy };
      case "circulo":
        return { ...marca, cx: marca.cx + dx, cy: marca.cy + dy };
      case "caminho":
        return { ...marca, cmds: marca.cmds.map((comando) => moverComando(comando, dx, dy)) };
    }
  });
}

export function textoEmCaixa(valor: string, estilo: Estilo, opcoes: { peso?: PesoDoTexto; italico?: boolean } = {}): Caixa {
  const tamanho = tamanhoDo(estilo);
  const peso = opcoes.peso ?? estilo.peso ?? 700;
  return {
    l: larguraDoTexto(valor, tamanho, peso),
    a: A_DO_TEXTO * tamanho,
    p: P_DO_TEXTO * tamanho,
    marcas: [{ m: "texto", texto: valor, x: 0, y: 0, tamanho, peso, italico: opcoes.italico ?? false, cor: estilo.cor }],
  };
}

interface Parte {
  caixa: Caixa;
  /** Espaço antes desta caixa. */
  antes?: number;
}

export function juntar(partes: readonly Parte[]): Caixa {
  let x = 0;
  let a = 0;
  let p = 0;
  const marcas: Marca[] = [];
  for (const { caixa, antes = 0 } of partes) {
    x += antes;
    marcas.push(...deslocar(caixa.marcas, x, 0));
    x += caixa.l;
    a = Math.max(a, caixa.a);
    p = Math.max(p, caixa.p);
  }
  return { l: x, a, p, marcas };
}

/* ----- Operadores ----- */

const GLIFO_DO_OPERADOR: Readonly<Record<string, string>> = { "+": "+", "-": "−", "×": "×", "÷": "÷", "=": "=", "<": "<", ">": ">" };

/** A espessura dos traços que o motor desenha no lugar de um glifo (≤ ≥ ≠ →): a da barra do "=" no peso do texto. */
const TRACO_EM_EM: Readonly<Record<PesoDoTexto, number>> = { 400: 0.07, 700: 0.09, 800: 0.1 };

function operador(valor: string, estilo: Estilo): Caixa {
  const tamanho = tamanhoDo(estilo);
  const eixo = eixoDe(tamanho);
  const traco = Math.max(estilo.peso === 400 ? 1.2 : 1.5, tamanho * TRACO_EM_EM[estilo.peso ?? 700]);
  if (valor === "≤" || valor === "≥") {
    const caixa = textoEmCaixa(valor === "≤" ? "<" : ">", estilo);
    const base = caixaDoGlifo(valor === "≤" ? "<" : ">", estilo.peso ?? 700);
    const y = -((base?.ymin ?? 100) / UNIDADES_POR_EM) * tamanho + 0.15 * tamanho;
    caixa.marcas.push({ m: "linha", x1: 0.14 * caixa.l, x2: 0.86 * caixa.l, y1: y, y2: y, cor: estilo.cor, largura: traco });
    caixa.p = Math.max(caixa.p, y + traco);
    return caixa;
  }
  if (valor === "≠") {
    const caixa = textoEmCaixa("=", estilo);
    caixa.marcas.push({ m: "linha", x1: 0.22 * caixa.l, y1: -eixo + 0.34 * tamanho, x2: 0.78 * caixa.l, y2: -eixo - 0.34 * tamanho, cor: estilo.cor, largura: traco });
    caixa.a = Math.max(caixa.a, eixo + 0.34 * tamanho + traco);
    return caixa;
  }
  if (valor === "→") {
    const comprimento = 1.05 * tamanho;
    const ponta = 0.3 * tamanho;
    const meia = 0.17 * tamanho;
    return {
      l: comprimento,
      a: A_DO_TEXTO * tamanho,
      p: P_DO_TEXTO * tamanho,
      marcas: [
        { m: "linha", x1: 0.04 * tamanho, y1: -eixo, x2: comprimento - ponta, y2: -eixo, cor: estilo.cor, largura: traco },
        { m: "caminho", cmds: [["M", comprimento - 0.02 * tamanho, -eixo], ["L", comprimento - ponta, -eixo - meia], ["L", comprimento - ponta, -eixo + meia], ["Z"]], preenchimento: estilo.cor },
      ],
    };
  }
  return textoEmCaixa(GLIFO_DO_OPERADOR[valor] ?? valor, estilo);
}

/* ----- Nós ----- */

const CORES_DO_DESTAQUE: Readonly<Record<PapelDestaque, { texto: PapelDeCor; fundo: PapelDeCor }>> = {
  foco: { texto: "focoTexto", fundo: "focoFundo" },
  procurado: { texto: "procuradoTexto", fundo: "procuradoFundo" },
  resposta: { texto: "respostaTexto", fundo: "respostaFundo" },
};

const folga = (largura: number): Caixa => ({ l: largura, a: 0, p: 0, marcas: [] });

/**
 * O vão entre uma palavra (`\text{…}`) e a matemática que encosta nela: o automático (0,22 em) quando nada separa os dois, e o espaço de uma
 * palavra (0,28 em) quando o `\text{ palavra }` já traz espaço na ponta, UM vão só, nunca os dois somados. O espaço explícito
 * (`\quad`, `\;`) é um nó à parte e vale sozinho.
 */
const VAO_AUTOMATICO_EM_EM = 0.22;
const VAO_DA_PALAVRA_EM_EM = 0.28;
const vaoDaPalavraEntre = (anterior: NoFormula | undefined, atual: NoFormula, estilo: Estilo): number => {
  if (vaoDaPalavra(anterior, atual)) return VAO_DA_PALAVRA_EM_EM * tamanhoDo(estilo);
  return vaoAutomatico(anterior, atual) ? VAO_AUTOMATICO_EM_EM * tamanhoDo(estilo) : 0;
};

const eLetra = (no: NoFormula): boolean => no.tipo === "variavel" || no.tipo === "simbolo" || (no.tipo === "script" && eLetra(no.base));

/**
 * O espaço entre dois fatores sem sinal (spec 15, seção 11): "4ac" e "2x" leem coladas, como no caderno. O número encosta na
 * variável e a variável na variável (o oblíquo da variável já se afasta um pouco do número que vem antes, e a margem do glifo faz
 * o resto: sem sinal não há vão); nos outros casos fica o respiro de 1.
 */
function espacoEntreFatores(anterior: NoFormula, atual: NoFormula, estilo: Estilo): number {
  if (anterior.tipo === "numero" && eLetra(atual)) return -0.06 * tamanhoDo(estilo);
  if (eLetra(anterior) && eLetra(atual)) return 0;
  return RESPIRO;
}

function sequencia(itens: readonly NoFormula[], estilo: Estilo): Caixa {
  const partes: Parte[] = [];
  itens.forEach((item, posicao) => {
    const anterior = itens[posicao - 1];
    const seguinte = itens[posicao + 1];
    if (item.tipo === "operador") {
      if (ehSinal(itens, posicao)) {
        partes.push({ caixa: operador(item.valor, estilo) });
        return;
      }
      const lado = (estilo.linha ? RESPIRO_EM_LINHA_EM_EM * tamanhoDo(estilo) : RELACOES.has(item.valor) ? ESPACO_DA_RELACAO : ESPACO_DO_SINAL) * estilo.respiro;
      const antes = anterior?.tipo === "matriz" ? ESPACO_DA_MOLDURA * estilo.respiro : lado;
      const depois = seguinte?.tipo === "matriz" ? ESPACO_DA_MOLDURA * estilo.respiro : lado;
      partes.push({ caixa: operador(item.valor, estilo), antes });
      partes.push({ caixa: folga(depois) });
      return;
    }
    if (item.tipo === "espaco") {
      // `\quad`, `\qquad`, `\;`, `\,`: sempre um vão, em fração da altura da letra (1, 2, 0,28 e 0,17), com ou sem "=".
      partes.push({ caixa: caixaDe(item, estilo) });
      return;
    }
    if (item.tipo === "separador" && item.valor === "espaco") {
      // O `\quad` entre duas equações lado a lado: um vão de uma altura de letra (menos no meio da frase), sem sinal.
      partes.push({ caixa: folga((estilo.linha ? 0.7 : 1.1) * tamanhoDo(estilo) * estilo.respiro) });
      return;
    }
    if (item.tipo === "separador") {
      partes.push({ caixa: caixaDe(item, estilo) });
      partes.push({ caixa: folga((estilo.linha ? 0.25 * tamanhoDo(estilo) : ESPACO_DO_SINAL) * estilo.respiro) });
      return;
    }
    const vaoDaPalavra = vaoDaPalavraEntre(anterior, item, estilo);
    partes.push({
      caixa: caixaDe(item, estilo),
      antes: vaoDaPalavra > 0 ? vaoDaPalavra : anterior && anterior.tipo !== "operador" && anterior.tipo !== "separador" && anterior.tipo !== "espaco" ? espacoEntreFatores(anterior, item, estilo) : 0,
    });
  });
  return juntar(partes);
}

function fracao(no: Extract<NoFormula, { tipo: "fracao" }>, estilo: Estilo): Caixa {
  // No meio da frase só a fração simples cabe, e vai como "a/b", no tamanho do texto (nunca empilhada: a linha não cresce).
  if (estilo.linha) return juntar([{ caixa: caixaDe(no.numerador, estilo) }, { caixa: textoEmCaixa("/", estilo) }, { caixa: caixaDe(no.denominador, estilo) }]);
  const menor: Estilo = { ...estilo, tamanho: pisar(estilo.tamanho * 0.85) };
  const numerador = caixaDe(no.numerador, menor);
  const denominador = caixaDe(no.denominador, menor);
  const eixo = eixoDe(estilo.tamanho);
  const l = Math.max(numerador.l, denominador.l) + 8;
  const baseDoNumerador = -eixo - BARRA_DA_FRACAO / 2 - FOLGA_DA_FRACAO - numerador.p;
  const baseDoDenominador = -eixo + BARRA_DA_FRACAO / 2 + FOLGA_DA_FRACAO + denominador.a;
  return {
    l,
    a: -baseDoNumerador + numerador.a,
    p: baseDoDenominador + denominador.p,
    marcas: [
      { m: "linha", x1: 0, y1: -eixo, x2: l, y2: -eixo, cor: estilo.cor, largura: BARRA_DA_FRACAO },
      ...deslocar(numerador.marcas, (l - numerador.l) / 2, baseDoNumerador),
      ...deslocar(denominador.marcas, (l - denominador.l) / 2, baseDoDenominador),
    ],
  };
}

function script(no: Extract<NoFormula, { tipo: "script" }>, estilo: Estilo): Caixa {
  const base = caixaDe(no.base, estilo);
  const menor: Estilo = { ...estilo, tamanho: Math.max(pisoDo(estilo), estilo.tamanho * escalaDoScript(estilo)), italico: false, respiro: 0.5 };
  const indice = no.indice ? caixaDe(no.indice, menor) : null;
  const expoente = no.expoente ? caixaDe(no.expoente, menor) : null;
  const tamanho = tamanhoDo(estilo);
  const descida = 0.3 * tamanho;
  const subida = base.a > 0.9 * tamanho ? base.a - 0.3 * menor.tamanho : 0.45 * tamanho;
  const largura = Math.max(indice?.l ?? 0, expoente?.l ?? 0);
  const marcas = [...base.marcas];
  if (indice) marcas.push(...deslocar(indice.marcas, base.l + RESPIRO, descida));
  if (expoente) marcas.push(...deslocar(expoente.marcas, base.l + RESPIRO, -subida));
  return {
    l: base.l + RESPIRO + largura,
    a: Math.max(base.a, expoente ? subida + expoente.a : 0),
    p: Math.max(base.p, indice ? descida + indice.p : 0),
    marcas,
  };
}

function raiz(no: Extract<NoFormula, { tipo: "raiz" }>, estilo: Estilo): Caixa {
  const radicando = caixaDe(no.radicando, estilo);
  const tamanho = tamanhoDo(estilo);
  const folga = 3;
  const topo = -(radicando.a + folga);
  const fundo = radicando.p + 1;
  const largura = 0.62 * tamanho;
  const altura = fundo - topo;
  return {
    l: largura + radicando.l + 3,
    a: radicando.a + folga + 1,
    p: radicando.p,
    marcas: [
      {
        m: "caminho",
        cmds: [
          ["M", 0, topo + altura * 0.55],
          ["L", 0.2 * largura, topo + altura * 0.5],
          ["L", 0.5 * largura, fundo],
          ["L", largura, topo],
          ["L", largura + radicando.l + 3, topo],
        ],
        borda: estilo.cor,
        larguraDaBorda: 2,
      },
      ...deslocar(radicando.marcas, largura + 1, 0),
    ],
  };
}

function parenteses(no: Extract<NoFormula, { tipo: "parenteses" }>, estilo: Estilo): Caixa {
  const conteudo = caixaDe(no.conteudo, estilo);
  const tamanho = tamanhoDo(estilo);
  if (estilo.linha || (conteudo.a <= 0.9 * tamanho && conteudo.p <= 0.3 * tamanho)) {
    return juntar([{ caixa: textoEmCaixa("(", estilo) }, { caixa: conteudo }, { caixa: textoEmCaixa(")", estilo) }]);
  }
  const topo = -conteudo.a - 2;
  const fundo = conteudo.p + 2;
  const meio = (topo + fundo) / 2;
  const largura = 0.26 * tamanho + 2;
  const folga = 2;
  const direita = largura + folga + conteudo.l + folga;
  return {
    l: direita + largura,
    a: conteudo.a + 2,
    p: conteudo.p + 2,
    marcas: [
      { m: "caminho", cmds: [["M", largura, topo], ["Q", 0, meio, largura, fundo]], borda: estilo.cor, larguraDaBorda: 2 },
      ...deslocar(conteudo.marcas, largura + folga, 0),
      { m: "caminho", cmds: [["M", direita, topo], ["Q", direita + largura, meio, direita, fundo]], borda: estilo.cor, larguraDaBorda: 2 },
    ],
  };
}

const COLUNA_ENTRE = 16;
const LINHA_ENTRE = 8;
const FOLGA_DA_MOLDURA = 6;

function matriz(no: Extract<NoFormula, { tipo: "matriz" }>, estilo: Estilo): Caixa {
  const celulas = no.linhas.map((linha) => linha.map((celula) => caixaDe(celula, estilo)));
  const colunas = no.linhas[0].length;
  const larguras = Array.from({ length: colunas }, (_, coluna) => Math.max(...celulas.map((linha) => linha[coluna].l)));
  const alturas = celulas.map((linha) => ({ a: Math.max(...linha.map((c) => c.a)), p: Math.max(...linha.map((c) => c.p)) }));
  const altura = alturas.reduce((soma, linha) => soma + linha.a + linha.p, 0) + LINHA_ENTRE * (alturas.length - 1);
  const larguraDaGrade = larguras.reduce((soma, valor) => soma + valor, 0) + COLUNA_ENTRE * (colunas - 1);
  const tamanho = tamanhoDo(estilo);
  const topo = -(eixoDe(tamanho) + altura / 2);
  const moldura = no.moldura === "barras" ? 2 : no.moldura === "nenhuma" ? 0 : 6;
  const marcas: Marca[] = [];
  let y = topo;
  celulas.forEach((linha, i) => {
    const base = y + alturas[i].a;
    let x = moldura + FOLGA_DA_MOLDURA;
    linha.forEach((celula, j) => {
      marcas.push(...deslocar(celula.marcas, x + (larguras[j] - celula.l) / 2, base));
      x += larguras[j] + COLUNA_ENTRE;
    });
    y += alturas[i].a + alturas[i].p + LINHA_ENTRE;
  });
  const l = 2 * moldura + 2 * FOLGA_DA_MOLDURA + larguraDaGrade;
  const de = topo - 2;
  const ate = topo + altura + 2;
  const haste = (x: number): Marca => ({ m: "linha", x1: x, y1: de, x2: x, y2: ate, cor: estilo.cor, largura: 2 });
  if (no.moldura !== "nenhuma") marcas.push(haste(1), haste(l - 1));
  if (no.moldura === "colchetes") {
    for (const [y1, x0, x1] of [[de + 1, 1, 6], [ate - 1, 1, 6], [de + 1, l - 6, l - 1], [ate - 1, l - 6, l - 1]] as const) {
      marcas.push({ m: "linha", x1: x0, y1, x2: x1, y2: y1, cor: estilo.cor, largura: 2 });
    }
  }
  return { l, a: -de, p: ate, marcas };
}

function destaque(no: Extract<NoFormula, { tipo: "destaque" }>, estilo: Estilo): Caixa {
  const cores = CORES_DO_DESTAQUE[no.papel];
  const conteudo = caixaDe(no.conteudo, { ...estilo, cor: cores.texto });
  const lado = 3;
  const folga = estilo.linha ? 1 : 2;
  return {
    l: conteudo.l + 2 * lado,
    a: conteudo.a + folga,
    p: conteudo.p + folga,
    marcas: [
      { m: "retangulo", x: 0, y: -(conteudo.a + folga), largura: conteudo.l + 2 * lado, altura: conteudo.a + conteudo.p + 2 * folga, raio: 6, preenchimento: cores.fundo },
      ...deslocar(conteudo.marcas, lado, 0),
    ],
  };
}

export function caixaDe(no: NoFormula, estilo: Estilo): Caixa {
  switch (no.tipo) {
    case "numero":
      return textoEmCaixa(numeroNaTela(no.valor), estilo);
    case "variavel":
      return textoEmCaixa(no.valor, estilo, { italico: estilo.italico });
    case "simbolo":
      return textoEmCaixa(no.valor, estilo);
    case "texto":
      return textoEmCaixa(no.valor, estilo);
    case "porcento":
      return textoEmCaixa("%", estilo);
    case "separador":
      return no.valor === "espaco" ? folga(tamanhoDo(estilo)) : textoEmCaixa(no.valor, estilo);
    case "espaco":
      return folga(LARGURA_DO_ESPACO_EM_EM[no.comando] * tamanhoDo(estilo) * estilo.respiro);
    case "operador":
      return operador(no.valor, estilo);
    case "fracao":
      return fracao(no, estilo);
    case "script":
      return script(no, estilo);
    case "raiz":
      return raiz(no, estilo);
    case "parenteses":
      return parenteses(no, estilo);
    case "sequencia":
      return sequencia(no.itens, estilo);
    case "matriz":
      return matriz(no, estilo);
    case "destaque":
      return destaque(no, estilo);
  }
}

/** A fórmula inteira no tamanho pedido: linha de base em y = 0. */
export function caixaDaFormula(arvore: NoFormula, tamanho: number, cor: PapelDeCor = "texto"): Caixa {
  return caixaDe(arvore, { tamanho: pisar(tamanho), cor, italico: true, respiro: 1 });
}

/** A fórmula no meio da frase, com `tamanho` o do texto ao redor (16, ou 17): linha de base em y = 0. */
export function caixaDaFormulaEmLinha(arvore: NoFormula, tamanho: number, cor: PapelDeCor = "texto", peso: PesoDoTexto = 700): Caixa {
  return caixaDe(arvore, { tamanho: Math.max(PISO_EM_LINHA, tamanho), cor, italico: true, respiro: 1, linha: true, peso });
}

/**
 * Os caracteres que a fórmula escreve e a tabela de glifos não tem (só um `\text{…}` montado à mão, sem passar pelo leitor, pode
 * trazê-los: o leitor só deixa passar o que tem glifo). Com algum, o motor NÃO desenha a fórmula e não põe "?" no lugar: ela fica
 * em texto linear.
 */
export function semGlifoNaFormula(arvore: NoFormula): string[] {
  const faltam = new Set<string>();
  percorrerFormula(arvore, (no) => {
    const texto = no.tipo === "texto" || no.tipo === "variavel" || no.tipo === "simbolo" ? no.valor : no.tipo === "numero" ? numeroNaTela(no.valor) : "";
    for (const caractere of semGlifo(texto)) faltam.add(caractere);
  });
  return [...faltam];
}

/** A linha de texto tem 1,5 em: a fórmula em linha cabe nela sem fazer a linha crescer. */
export const ALTURA_DA_LINHA_EM_EM = 1.5;
/** Largura máxima de uma fórmula em linha, com o texto a 16 (escala com ele): mais larga que isto quebra em peças, que quebram como palavras. */
export const LARGURA_MAXIMA_EM_LINHA = 280;

/**
 * A fórmula cabe no meio da frase? Pelo tipo de nó (`formulaCabeEmLinha`) e pela medida: a caixa não passa de 1,5 vezes o
 * tamanho do texto de altura (índice e expoente ficam dentro da linha) nem de `LARGURA_MAXIMA_EM_LINHA` de largura. Senão, cai
 * no texto linear em peças (`formulaEmPecas`).
 */
export function formulaCabeNaLinha(arvore: NoFormula, tamanho = 16): boolean {
  if (!formulaCabeEmLinha(arvore) || semGlifoNaFormula(arvore).length > 0) return false;
  const caixa = caixaDaFormulaEmLinha(arvore, tamanho);
  return caixa.a + caixa.p <= ALTURA_DA_LINHA_EM_EM * tamanho + 1e-9 && caixa.l <= (LARGURA_MAXIMA_EM_LINHA * tamanho) / 16 + 1e-9;
}
