import { falarFormula, lerFormula, type NoFormula } from "./formula";
import { caixaDaFormula, deslocar, pisar, textoEmCaixa, type Caixa, type Comando, type Marca } from "./motor-formula";
import { arredondar, caminhoDoTexto, deslocarCaminho, larguraDoTexto } from "./texto-vetorial";
import {
  LARGURA_DO_DESENHO,
  PALETA_DO_DESENHO,
  PISO_DO_TEXTO,
  TETO_DE_PRIMITIVAS,
  pontoApareceNaPosicao,
  type ContextoDoDesenho,
  type Desenho,
  type PapelDeCor,
  type PapelPonto,
  type Primitiva,
  type Visual,
  type VisualPlano,
  type VisualRetaNumerica,
} from "./visuais";

/*
 * Motor de desenho (spec 15): uma função pura que transforma um visual em primitivas, na largura de projeto 320. A web as desenha
 * em SVG, o app em react-native-svg e o servidor em PNG (`desenhoParaSvg`); o desenho é o mesmo nos três. O texto já sai como
 * contorno de glifos, a ponta de seta é um caminho preenchido, e nada daqui vem da IA além dos números e dos nomes dos pontos.
 *
 * O ponto procurado só é desenhado na posição dele no último passo e no retorno (`pontoApareceNaPosicao`); no enunciado, no
 * exemplo e no PNG ele fica só na legenda ("C = ?"), e o que o toca (segmento, polígono, linha-guia) também não é desenhado.
 */

const r2 = (valor: number): number => Math.round(valor * 100) / 100;

/* ----- Marcas → primitivas ----- */

function comandosParaD(comandos: readonly Comando[]): string {
  let d = "";
  for (const comando of comandos) {
    if (comando[0] === "Z") d += "Z";
    else if (comando[0] === "Q") d += `Q${arredondar(comando[1])} ${arredondar(comando[2])} ${arredondar(comando[3])} ${arredondar(comando[4])}`;
    else d += `${comando[0]}${arredondar(comando[1])} ${arredondar(comando[2])}`;
  }
  return d;
}

/** As marcas na ordem em que se desenham; textos seguidos da mesma cor viram um caminho só (o teto de primitivas agradece). */
export function emitir(marcas: readonly Marca[]): { primitivas: Primitiva[]; menorTexto: number; textos: string[] } {
  const primitivas: Primitiva[] = [];
  const textos: string[] = [];
  let menor = Infinity;
  let corrida: { cor: PapelDeCor; opacidade?: number; d: string } | null = null;
  const fechar = () => {
    if (corrida?.d) {
      primitivas.push({ tipo: "caminho", d: corrida.d, preenchimento: corrida.cor, ...(corrida.opacidade !== undefined ? { opacidade: corrida.opacidade } : {}) });
    }
    corrida = null;
  };
  for (const marca of marcas) {
    if (marca.m === "texto") {
      menor = Math.min(menor, marca.tamanho);
      textos.push(marca.texto);
      if (corrida && (corrida.cor !== marca.cor || corrida.opacidade !== marca.opacidade)) fechar();
      const d = caminhoDoTexto(marca.texto, marca.x, marca.y, marca.tamanho, marca.peso, marca.italico);
      if (!d) continue;
      corrida = corrida ?? { cor: marca.cor, ...(marca.opacidade !== undefined ? { opacidade: marca.opacidade } : {}), d: "" };
      corrida.d += d;
      continue;
    }
    fechar();
    switch (marca.m) {
      case "linha":
        primitivas.push({
          tipo: "linha", x1: r2(marca.x1), y1: r2(marca.y1), x2: r2(marca.x2), y2: r2(marca.y2), cor: marca.cor, largura: marca.largura,
          ...(marca.tracejado ? { tracejado: marca.tracejado } : {}), ...(marca.opacidade !== undefined ? { opacidade: marca.opacidade } : {}),
        });
        break;
      case "retangulo":
        primitivas.push({
          tipo: "retangulo", x: r2(marca.x), y: r2(marca.y), largura: r2(marca.largura), altura: r2(marca.altura),
          ...(marca.raio ? { raio: marca.raio } : {}), ...(marca.preenchimento ? { preenchimento: marca.preenchimento } : {}),
          ...(marca.borda ? { borda: marca.borda, larguraDaBorda: marca.larguraDaBorda ?? 1 } : {}),
          ...(marca.opacidade !== undefined ? { opacidade: marca.opacidade } : {}),
        });
        break;
      case "circulo":
        primitivas.push({
          tipo: "circulo", cx: r2(marca.cx), cy: r2(marca.cy), raio: r2(marca.raio),
          ...(marca.preenchimento ? { preenchimento: marca.preenchimento } : {}),
          ...(marca.borda ? { borda: marca.borda, larguraDaBorda: marca.larguraDaBorda ?? 1 } : {}),
          ...(marca.tracejado ? { tracejado: marca.tracejado } : {}), ...(marca.opacidade !== undefined ? { opacidade: marca.opacidade } : {}),
        });
        break;
      case "caminho":
        primitivas.push({
          tipo: "caminho", d: comandosParaD(marca.cmds),
          ...(marca.preenchimento ? { preenchimento: marca.preenchimento } : {}),
          ...(marca.borda ? { borda: marca.borda, larguraDaBorda: marca.larguraDaBorda ?? 1 } : {}),
          ...(marca.tracejado ? { tracejado: marca.tracejado } : {}), ...(marca.opacidade !== undefined ? { opacidade: marca.opacidade } : {}),
        });
        break;
    }
  }
  fechar();
  return { primitivas, menorTexto: Number.isFinite(menor) ? menor : PISO_DO_TEXTO, textos };
}

function desenhoDe(marcas: readonly Marca[], altura: number, descricao: string, extra: Partial<Desenho> = {}): Desenho {
  const { primitivas, menorTexto, textos } = emitir(marcas);
  return { largura: LARGURA_DO_DESENHO, altura: r2(altura), primitivas, descricao, menorTexto, textos, ...extra };
}

/* ----- Números e rótulos ----- */

/** `−2`, `3,5`: o sinal de menos de verdade e a vírgula decimal. */
export function numeroParaTela(valor: number): string {
  const texto = String(r2(valor)).replace("-", "−").replace(".", ",");
  return texto === "−0" ? "0" : texto;
}

/** O rótulo do ponto, montado pelo Studoo: "A (1, 2)", e com decimal "A (1,5; 2)" (a vírgula decimal não se confunde com a do par). */
export function rotuloDoPonto(id: string, coordenadas: readonly number[]): string {
  const decimal = coordenadas.some((valor) => !Number.isInteger(valor));
  return `${id} (${coordenadas.map(numeroParaTela).join(decimal ? "; " : ", ")})`;
}

/* ----- Fórmula ----- */

export interface OpcoesDaFormula {
  /** Tamanho base: 22, no bloco do app e na faixa do PNG. */
  tamanho?: number;
  /** Com o fundo `#F1F4FD` do bloco (o app); sem ele, uma faixa para o PNG, que a separa da figura por uma linha. */
  fundo?: boolean;
}

export interface OpcoesDaFigura {
  /** Altura máxima do desenho da figura (o PNG com a fórmula em cima cabe em 352: a figura leva o que sobra). Padrão 320. */
  alturaMaxima?: number;
}

const PADDING_DO_BLOCO = 10;

/**
 * A fórmula em bloco, centralizada. Não cabendo, diminui até 85% (no bloco do app, no mínimo 18); ainda não cabendo, o bloco
 * rola para o lado (`larguraDoConteudo`); na faixa do PNG, que não rola, devolve `null`: a fórmula fica só no texto linear.
 */
export function desenharFormula(arvore: NoFormula, opcoes: OpcoesDaFormula = {}): Desenho | null {
  const bloco = opcoes.fundo ?? true;
  const base = opcoes.tamanho ?? 22;
  const lateral = bloco ? 12 : 16;
  const util = LARGURA_DO_DESENHO - 2 * lateral;
  let tamanho = base;
  let caixa = caixaDaFormula(arvore, tamanho);
  if (caixa.l > util) {
    tamanho = Math.max(bloco ? 18 : PISO_DO_TEXTO, base * 0.85);
    caixa = caixaDaFormula(arvore, tamanho);
  }
  const cabe = caixa.l <= util;
  if (!cabe && !bloco) return null;
  const altura = caixa.a + caixa.p + 2 * PADDING_DO_BLOCO;
  const x = cabe ? (LARGURA_DO_DESENHO - caixa.l) / 2 : lateral;
  const marcas: Marca[] = [
    ...(bloco ? [{ m: "retangulo", x: 0, y: 0, largura: LARGURA_DO_DESENHO, altura, raio: 14, preenchimento: "fundo" } as Marca] : []),
    ...deslocar(caixa.marcas, x, PADDING_DO_BLOCO + caixa.a),
  ];
  return desenhoDe(marcas, altura, falarFormula(arvore), cabe ? {} : { larguraDoConteudo: r2(caixa.l + 2 * lateral) });
}

/* ----- Pontos: papel efetivo, legenda e rótulos ----- */

type PapelEfetivo = "dado" | "especial" | "procurado" | "resposta";

/** O que o ponto é neste contexto: o procurado (ou o resposta) que ainda não pode aparecer fica `procurado`; quando pode, vira resposta. */
function papelNoContexto(papel: PapelPonto, contexto: ContextoDoDesenho): PapelEfetivo {
  if (papel === "procurado" || papel === "resposta") return pontoApareceNaPosicao(papel, contexto) ? "resposta" : "procurado";
  return papel;
}

interface Ret {
  x: number;
  y: number;
  l: number;
  a: number;
}

const bate = (a: Ret, b: Ret): boolean => a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.a && b.y < a.y + a.a;
const sobreposicao = (a: Ret, b: Ret): number =>
  Math.max(0, Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.a, b.y + b.a) - Math.max(a.y, b.y));

/* Tamanhos do texto (spec 15, seção 8): nenhum abaixo do piso de 13. */
const TAMANHO_DO_ROTULO = 14;
const TAMANHO_DA_LEGENDA = 14;
const TAMANHO_DO_NUMERO = 13;
const TAMANHO_DO_NOME_DO_EIXO = 14;
const FOLGA_DA_SETA = 16;

const COR_DO_ROTULO: Readonly<Record<PapelEfetivo, PapelDeCor>> = { dado: "texto", especial: "especialTexto", procurado: "procuradoTexto", resposta: "respostaTexto" };

function caixaDoRotulo(texto: string): { l: number; a: number } {
  return { l: larguraDoTexto(texto, TAMANHO_DO_ROTULO, 800), a: 15 };
}

interface ItemDaLegenda {
  simbolo: "dado" | "especial" | "procurado" | "resposta";
  palavra: string;
}

const PALAVRA_DO_DERIVADO = { baricentro: "baricentro", ponto_medio: "ponto médio", media: "média" } as const;

interface PontoParaLegenda {
  id: string;
  papel: PapelPonto;
  derivado?: { tipo: keyof typeof PALAVRA_DO_DERIVADO };
}

/** A legenda só aparece quando há pontos de mais de um papel; o procurado entra como "C = ?" e nunca com a posição. */
function itensDaLegenda(pontos: readonly PontoParaLegenda[], contexto: ContextoDoDesenho): { itens: ItemDaLegenda[]; escondidos: string[] } {
  const itens: ItemDaLegenda[] = [];
  const escondidos: string[] = [];
  const tem = (item: ItemDaLegenda) => itens.some((outro) => outro.simbolo === item.simbolo && outro.palavra === item.palavra);
  for (const ponto of pontos) {
    const papel = papelNoContexto(ponto.papel, contexto);
    const item: ItemDaLegenda =
      papel === "dado" ? { simbolo: "dado", palavra: "dados" }
        : papel === "especial" ? { simbolo: "especial", palavra: ponto.derivado ? PALAVRA_DO_DERIVADO[ponto.derivado.tipo] : "especial" }
          : papel === "resposta" ? { simbolo: "resposta", palavra: "resposta" }
            : { simbolo: "procurado", palavra: "procurado" };
    if (!tem(item)) itens.push(item);
    if (papel === "procurado") escondidos.push(ponto.id);
  }
  const ordem = ["dado", "especial", "resposta", "procurado"];
  itens.sort((a, b) => ordem.indexOf(a.simbolo) - ordem.indexOf(b.simbolo));
  const papeis = new Set(itens.map((item) => item.simbolo));
  return papeis.size >= 2 ? { itens, escondidos } : { itens: [], escondidos: [] };
}

const ALTURA_DA_LINHA_DA_LEGENDA = 22;

function marcasDoSimbolo(simbolo: ItemDaLegenda["simbolo"], x: number, y: number): Marca[] {
  switch (simbolo) {
    case "dado":
      return [{ m: "circulo", cx: x + 6, cy: y, raio: 5, preenchimento: "dado" }];
    case "especial":
      return [{ m: "caminho", cmds: losango(x + 6, y, 6.5), preenchimento: "especial" }];
    case "resposta":
      return [{ m: "circulo", cx: x + 6, cy: y, raio: 5.5, preenchimento: "resposta" }];
    default:
      return [{ m: "circulo", cx: x + 6, cy: y, raio: 5, preenchimento: "procuradoFundo", borda: "procurado", larguraDaBorda: 1.5, tracejado: [3, 2.5] }];
  }
}

function losango(cx: number, cy: number, meia: number): readonly Comando[] {
  return [["M", cx, cy - meia], ["L", cx + meia, cy], ["L", cx, cy + meia], ["L", cx - meia, cy], ["Z"]];
}

/** A legenda em linhas de até 288 de largura, a partir de (16, topo). Devolve as marcas e a altura que ocupa. */
function legenda(itens: readonly ItemDaLegenda[], escondidos: readonly string[], topo: number): { marcas: Marca[]; altura: number } {
  if (itens.length === 0) return { marcas: [], altura: 0 };
  const marcas: Marca[] = [];
  const entradas: { largura: number; fazer: (x: number, y: number) => Marca[] }[] = itens.map((item) => ({
    largura: 12 + 5 + larguraDoTexto(item.palavra, TAMANHO_DA_LEGENDA, 700),
    fazer: (x, y) => [
      ...marcasDoSimbolo(item.simbolo, x, y - 5),
      { m: "texto", texto: item.palavra, x: x + 17, y, tamanho: TAMANHO_DA_LEGENDA, peso: 700, italico: false, cor: "suave" },
    ],
  }));
  for (const id of escondidos) {
    const texto = `${id} = ?`;
    entradas.push({
      largura: larguraDoTexto(texto, TAMANHO_DA_LEGENDA, 800),
      fazer: (x, y) => [{ m: "texto", texto, x, y, tamanho: TAMANHO_DA_LEGENDA, peso: 800, italico: false, cor: "procuradoTexto" }],
    });
  }
  let x = 16;
  let linha = 0;
  for (const entrada of entradas) {
    if (x > 16 && x + entrada.largura > LARGURA_DO_DESENHO - 16) {
      x = 16;
      linha += 1;
    }
    marcas.push(...entrada.fazer(x, topo + 14 + linha * ALTURA_DA_LINHA_DA_LEGENDA));
    x += entrada.largura + 16;
  }
  return { marcas, altura: (linha + 1) * ALTURA_DA_LINHA_DA_LEGENDA + 2 };
}

/* ----- Eixos, grade, setas ----- */

function seta(xPonta: number, yPonta: number, direcao: "direita" | "esquerda" | "cima" | "baixo", cor: PapelDeCor): Marca {
  const c = 8;
  const m = 5;
  const [bx, by] = direcao === "direita" ? [-c, 0] : direcao === "esquerda" ? [c, 0] : direcao === "cima" ? [0, c] : [0, -c];
  const [px, py] = direcao === "direita" || direcao === "esquerda" ? [0, m] : [m, 0];
  return { m: "caminho", cmds: [["M", xPonta, yPonta], ["L", xPonta + bx + px, yPonta + by + py], ["L", xPonta + bx - px, yPonta + by - py], ["Z"]], preenchimento: cor };
}

const PASSOS_DA_GRADE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** A grade vai de 1 em 1 até 20 unidades no eixo (para contar quadradinhos); acima disso, de 2, 5, 10… com até 12 linhas. */
function passoDaGrade(extensao: number): number {
  if (extensao <= 20) return 1;
  return PASSOS_DA_GRADE.find((passo) => passo >= 2 && extensao / passo <= 12) ?? 1000;
}

/** Os números vão de 1 em 1 até 12 unidades e de 2 em 2 até 20; nunca mais juntos que `minimoEmUnidades` de projeto. */
function passoDosNumeros(extensao: number, passoDaGradeAtual: number, unidade: number, minimoEmUnidades: number): number {
  let passo = passoDaGradeAtual === 1 && extensao > 12 ? 2 : passoDaGradeAtual;
  while (passo * unidade < minimoEmUnidades) {
    const proximo = PASSOS_DA_GRADE[PASSOS_DA_GRADE.indexOf(passo) + 1];
    passo = proximo ?? passo * 2;
  }
  return passo;
}

function multiplos(de: number, ate: number, passo: number): number[] {
  const valores: number[] = [];
  for (let v = Math.ceil(de / passo - 1e-9) * passo; v <= ate + 1e-9; v += passo) valores.push(Math.round(v * 1000) / 1000);
  return valores;
}

/**
 * O rótulo de um ponto procura um lado que não cubra outro ponto, número de eixo, rótulo ou eixo: direita, esquerda, acima, abaixo
 * e depois as diagonais. Se nenhum lado couber o rótulo inteiro ("A (1, 2)"), fica só o nome ("A") no primeiro lado livre; sem
 * nenhum livre, o nome no lado em que bate menos.
 */
function acharLugarDoRotulo(
  cx: number, cy: number, raioDoPonto: number, completo: string, nome: string, obstaculos: readonly Ret[], limites: { esquerda: number; direita: number; topo: number },
  moles: readonly Ret[] = [],
): { texto: string; x: number; y: number; l: number; a: number } {
  const lugares = (l: number, a: number, anel = 0) => {
    const folga = raioDoPonto + 4 + anel;
    return [
    { x: cx + folga, y: cy - a / 2 },
    { x: cx - folga - l, y: cy - a / 2 },
    { x: cx - l / 2, y: cy - folga - a },
    { x: cx - l / 2, y: cy + folga },
    { x: cx + folga - 3, y: cy - folga - a + 2 },
    { x: cx - folga - l + 3, y: cy - folga - a + 2 },
    { x: cx + folga - 3, y: cy + folga - 2 },
    { x: cx - folga - l + 3, y: cy + folga - 2 },
    ];
  };
  const custo = (ret: Ret) => {
    const fora = ret.x < limites.esquerda || ret.x + ret.l > limites.direita || ret.y < limites.topo ? 1e6 : 0;
    return fora + obstaculos.reduce((soma, obstaculo) => soma + sobreposicao(ret, obstaculo), 0);
  };
  // 1. o rótulo inteiro em algum lado; 2. só o nome, no lado livre mais perto (afastando de 2 em 2); 3. o nome onde bate menos.
  // Entre os lados livres, o que cobre menos dos traços (segmentos) ganha; o que não cobre nenhum, mais ainda.
  const tentativas: (readonly [string, number])[] = [[completo, 0], [nome, 0], ...Array.from({ length: 10 }, (_, i) => [nome, 2 * (i + 1)] as const)];
  for (const [texto, anel] of tentativas) {
    const { l, a } = caixaDoRotulo(texto);
    const livres = lugares(l, a, anel)
      .filter((lugar) => custo({ ...lugar, l, a }) === 0)
      .map((lugar, ordem) => ({ lugar, ordem, traco: moles.reduce((soma, mole) => soma + sobreposicao({ ...lugar, l, a }, mole), 0) }))
      .sort((x, y) => x.traco - y.traco || x.ordem - y.ordem);
    if (livres.length) return { texto, ...livres[0].lugar, l, a };
  }
  const { l, a } = caixaDoRotulo(nome);
  const melhor = lugares(l, a).map((lugar) => ({ lugar, custo: custo({ ...lugar, l, a }) })).sort((x, y) => x.custo - y.custo)[0].lugar;
  return { texto: nome, ...melhor, l, a };
}

/* ----- Plano cartesiano ----- */

const GRADE = { esquerda: 28, direita: 280, topo: 32, bandaDeBaixo: 28 };

interface PontoDesenhado {
  id: string;
  papel: PapelEfetivo;
  x: number;
  y: number;
  completo: string | null;
}

export function desenharPlano(visual: VisualPlano, contexto: ContextoDoDesenho, opcoes: OpcoesDaFigura = {}): Desenho {
  const legendaPrevia = itensDaLegenda(visual.pontos, contexto);
  const alturaDaLegenda = legendaPrevia.itens.length ? legenda(legendaPrevia.itens, legendaPrevia.escondidos, 0).altura + 8 : 0;
  const larguraDaGrade = GRADE.direita - GRADE.esquerda;
  const reservado = GRADE.topo + GRADE.bandaDeBaixo + alturaDaLegenda + 8;
  const maximo = Math.max(80, (opcoes.alturaMaxima ?? 320) - reservado);
  const minimo = Math.min(maximo, Math.max(90, 200 - reservado));

  let [xMin, xMax] = visual.x;
  let [yMin, yMax] = visual.y;
  let unidade = larguraDaGrade / (xMax - xMin);
  let alturaDaGrade = (yMax - yMin) * unidade;
  if (alturaDaGrade > maximo) {
    unidade = maximo / (yMax - yMin);
    alturaDaGrade = maximo;
    const extra = (larguraDaGrade / unidade - (xMax - xMin)) / 2;
    xMin -= extra;
    xMax += extra;
  } else if (alturaDaGrade < minimo) {
    alturaDaGrade = minimo;
    const extra = (minimo / unidade - (yMax - yMin)) / 2;
    yMin -= extra;
    yMax += extra;
  }
  const X = (v: number) => GRADE.esquerda + (v - xMin) * unidade;
  const Y = (v: number) => GRADE.topo + (yMax - v) * unidade;
  const { esquerda, direita, topo } = GRADE;
  const fundo = GRADE.topo + alturaDaGrade;
  const eixoX = Math.min(Math.max(X(0), esquerda), direita);
  const eixoY = Math.min(Math.max(Y(0), topo), fundo);

  const pontos: PontoDesenhado[] = [];
  for (const ponto of visual.pontos) {
    const papel = papelNoContexto(ponto.papel, contexto);
    if (papel === "procurado" || ponto.x === undefined || ponto.y === undefined) continue;
    pontos.push({ id: ponto.id, papel, x: X(ponto.x), y: Y(ponto.y), completo: ponto.rotulo === false ? null : rotuloDoPonto(ponto.id, [ponto.x, ponto.y]) });
  }
  const visiveis = new Map(pontos.map((ponto) => [ponto.id, ponto]));

  const marcas: Marca[] = [];
  // 1. Grade: uma linha por unidade até 20 unidades no eixo.
  const passoX = passoDaGrade(xMax - xMin);
  const passoY = passoDaGrade(yMax - yMin);
  for (const v of multiplos(xMin, xMax, passoX)) marcas.push({ m: "linha", x1: X(v), y1: topo, x2: X(v), y2: fundo, cor: "grade", largura: 1 });
  for (const v of multiplos(yMin, yMax, passoY)) marcas.push({ m: "linha", x1: esquerda, y1: Y(v), x2: direita, y2: Y(v), cor: "grade", largura: 1 });

  // 2. Polígonos (preenchimento) e o contorno de cada lado.
  const lados: [string, string][] = [];
  const chave = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const vistos = new Set<string>();
  const juntarLado = (de: string, ate: string) => {
    if (vistos.has(chave(de, ate)) || !visiveis.has(de) || !visiveis.has(ate)) return;
    vistos.add(chave(de, ate));
    lados.push([de, ate]);
  };
  for (const poligono of visual.poligonos ?? []) {
    const vertices = poligono.pontos.map((id) => visiveis.get(id));
    if (vertices.some((vertice) => !vertice)) continue;
    const cmds: Comando[] = vertices.map((vertice, i) => [i === 0 ? "M" : "L", vertice!.x, vertice!.y] as Comando);
    marcas.push({ m: "caminho", cmds: [...cmds, ["Z"]], preenchimento: "preenchimento", opacidade: 0.07 });
  }
  for (const poligono of visual.poligonos ?? []) {
    poligono.pontos.forEach((id, i) => juntarLado(id, poligono.pontos[(i + 1) % poligono.pontos.length]));
  }
  for (const segmento of visual.segmentos ?? []) juntarLado(segmento.de, segmento.ate);

  // 3. Eixos: a seta começa uma folga depois da última marca.
  const fimDoEixoX = direita + FOLGA_DA_SETA;
  const fimDoEixoY = topo - FOLGA_DA_SETA;
  marcas.push({ m: "linha", x1: esquerda, y1: eixoY, x2: fimDoEixoX, y2: eixoY, cor: "eixo", largura: 2 });
  marcas.push({ m: "linha", x1: eixoX, y1: fundo, x2: eixoX, y2: fimDoEixoY, cor: "eixo", largura: 2 });
  marcas.push(seta(fimDoEixoX + 8, eixoY, "direita", "eixo"), seta(eixoX, fimDoEixoY - 8, "cima", "eixo"));
  marcas.push({ m: "texto", texto: "x", x: fimDoEixoX + 4, y: eixoY + 18, tamanho: TAMANHO_DO_NOME_DO_EIXO, peso: 700, italico: true, cor: "suave" });
  marcas.push({ m: "texto", texto: "y", x: eixoX + 8, y: fimDoEixoY - 3, tamanho: TAMANHO_DO_NOME_DO_EIXO, peso: 700, italico: true, cor: "suave" });

  // Obstáculos dos rótulos: os eixos, os nomes dos eixos, os pontos e, com prioridade, os números dos eixos (que não se movem).
  const obstaculos: Ret[] = [
    { x: eixoX - 2, y: fimDoEixoY - 8, l: 4, a: fundo - fimDoEixoY + 8 },
    { x: esquerda, y: eixoY - 2, l: fimDoEixoX + 8 - esquerda, a: 4 },
    { x: fimDoEixoX + 2, y: eixoY + 5, l: 14, a: 17 },
    { x: eixoX + 6, y: fimDoEixoY - 14, l: 12, a: 16 },
  ];
  const caixaDoPonto = (ponto: PontoDesenhado): Ret => ({ x: ponto.x - 10, y: ponto.y - 10, l: 20, a: 20 });

  // 4. Linhas-guia, com o valor do eixo em foco (e o número do eixo que ele cobre sai: o foco é o próprio número).
  const guias: Marca[] = [];
  const valoresEmFoco: Marca[] = [];
  const emFocoNoX = new Set<number>();
  const emFocoNoY = new Set<number>();
  for (const guia of visual.guias ?? []) {
    const ponto = visiveis.get(guia.ponto);
    const original = visual.pontos.find((outro) => outro.id === guia.ponto);
    if (!ponto || !original || original.x === undefined || original.y === undefined) continue;
    const destaque = guia.eixo === "x" ? original.x : original.y;
    (guia.eixo === "x" ? emFocoNoX : emFocoNoY).add(destaque);
    const texto = numeroParaTela(destaque);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    guias.push(
      guia.eixo === "x"
        ? { m: "linha", x1: ponto.x, y1: ponto.y, x2: ponto.x, y2: eixoY, cor: "suave", largura: 2, tracejado: [4, 4] }
        : { m: "linha", x1: ponto.x, y1: ponto.y, x2: eixoX, y2: ponto.y, cor: "suave", largura: 2, tracejado: [4, 4] },
    );
    const caixa: Ret = guia.eixo === "x"
      ? { x: ponto.x - largura / 2 - 3, y: eixoY + 4, l: largura + 6, a: 17 }
      : { x: eixoX - largura - 9, y: ponto.y - 9, l: largura + 6, a: 17 };
    valoresEmFoco.push(
      { m: "retangulo", x: caixa.x, y: caixa.y, largura: caixa.l, altura: caixa.a, raio: 4, preenchimento: "focoFundo" },
      { m: "texto", texto, x: caixa.x + 3, y: caixa.y + 13, tamanho: TAMANHO_DO_NUMERO, peso: 700, italico: false, cor: "focoTexto" },
    );
  }
  marcas.push(...guias);

  // 5. Segmentos.
  for (const [de, ate] of lados) {
    const a = visiveis.get(de)!;
    const b = visiveis.get(ate)!;
    marcas.push({ m: "linha", x1: a.x, y1: a.y, x2: b.x, y2: b.y, cor: "segmento", largura: 3 });
  }

  // 6. Números dos eixos: lugar fixo e prioridade; nenhum rótulo de ponto os apaga.
  const numeros: Marca[] = [];
  const noX = passoDosNumeros(xMax - xMin, passoX, unidade, 24);
  const noY = passoDosNumeros(yMax - yMin, passoY, unidade, 16);
  const baseDoX = eixoY + 17;
  for (const v of multiplos(xMin, xMax, noX)) {
    if (v === 0 || emFocoNoX.has(v)) continue;
    const texto = numeroParaTela(v);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    const caixa: Ret = { x: X(v) - largura / 2, y: baseDoX - 10, l: largura, a: 13 };
    numeros.push({ m: "texto", texto, x: caixa.x, y: baseDoX, tamanho: TAMANHO_DO_NUMERO, peso: 700, italico: false, cor: "suave" });
    obstaculos.push(caixa);
  }
  for (const v of multiplos(yMin, yMax, noY)) {
    if (v === 0 || emFocoNoY.has(v)) continue;
    const texto = numeroParaTela(v);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    const caixa: Ret = { x: eixoX - 6 - largura, y: Y(v) - 5.5, l: largura, a: 13 };
    numeros.push({ m: "texto", texto, x: caixa.x, y: Y(v) + 4.5, tamanho: TAMANHO_DO_NUMERO, peso: 700, italico: false, cor: "suave" });
    obstaculos.push(caixa);
  }
  // O 0 da origem é o único que escolhe o canto, para não bater nos vizinhos.
  const larguraDoZero = larguraDoTexto("0", TAMANHO_DO_NUMERO, 700);
  const cantos = [
    { x: eixoX - 6 - larguraDoZero, y: eixoY + 7 },
    { x: eixoX + 6, y: eixoY + 7 },
    { x: eixoX - 6 - larguraDoZero, y: eixoY - 20 },
    { x: eixoX + 6, y: eixoY - 20 },
  ];
  const vizinhos = [...obstaculos, ...pontos.map(caixaDoPonto)];
  const canto = cantos.find((c) => !vizinhos.some((outro) => bate({ x: c.x, y: c.y, l: larguraDoZero, a: 13 }, outro))) ?? cantos[0];
  numeros.push({ m: "texto", texto: "0", x: canto.x, y: canto.y + 10, tamanho: TAMANHO_DO_NUMERO, peso: 700, italico: false, cor: "suave" });
  obstaculos.push({ x: canto.x, y: canto.y, l: larguraDoZero, a: 13 }, ...valoresEmFoco.flatMap((marca) => (marca.m === "retangulo" ? [{ x: marca.x, y: marca.y, l: marca.largura, a: marca.altura }] : [])));
  marcas.push(...numeros, ...valoresEmFoco);

  // 7. Pontos.
  for (const ponto of pontos) {
    if (ponto.papel === "especial") marcas.push({ m: "caminho", cmds: losango(ponto.x, ponto.y, 8.5), preenchimento: "especial", borda: "branco", larguraDaBorda: 2 });
    else marcas.push({ m: "circulo", cx: ponto.x, cy: ponto.y, raio: ponto.papel === "resposta" ? 8 : 6, preenchimento: ponto.papel === "resposta" ? "resposta" : "dado", borda: "branco", larguraDaBorda: 2 });
  }

  // 8. Rótulos dos pontos: quem se move é o rótulo.
  const tracos: Ret[] = lados.flatMap(([de, ate]) => {
    const a = visiveis.get(de)!;
    const b = visiveis.get(ate)!;
    const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    return Array.from({ length: passos + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / passos - 3.5, y: a.y + ((b.y - a.y) * i) / passos - 3.5, l: 7, a: 7 }));
  });
  const rotulos: Marca[] = [];
  const limites = { esquerda: 2, direita: LARGURA_DO_DESENHO - 2, topo: 2 };
  for (const ponto of [...pontos].sort((a, b) => Number(b.papel === "especial") - Number(a.papel === "especial"))) {
    if (!ponto.completo) continue;
    const raio = ponto.papel === "resposta" ? 8 : ponto.papel === "especial" ? 8.5 : 6;
    // O próprio ponto não é obstáculo do rótulo dele; os outros pontos são. Os segmentos só desempatam.
    const dosOutros = pontos.filter((outro) => outro !== ponto).map(caixaDoPonto);
    const lugar = acharLugarDoRotulo(ponto.x, ponto.y, raio, ponto.completo, ponto.id, [...obstaculos, ...dosOutros], limites, tracos);
    obstaculos.push({ x: lugar.x, y: lugar.y, l: lugar.l, a: lugar.a });
    rotulos.push({ m: "texto", texto: lugar.texto, x: lugar.x, y: lugar.y + 11.5, tamanho: TAMANHO_DO_ROTULO, peso: 800, italico: false, cor: COR_DO_ROTULO[ponto.papel] });
  }
  marcas.push(...rotulos.sort((a, b) => (a.m === "texto" && b.m === "texto" ? a.cor.localeCompare(b.cor) : 0)));

  // 9. Legenda.
  const topoDaLegenda = fundo + GRADE.bandaDeBaixo + 4;
  const feita = legenda(legendaPrevia.itens, legendaPrevia.escondidos, topoDaLegenda);
  marcas.push(...feita.marcas);

  const altura = fundo + GRADE.bandaDeBaixo + (feita.altura ? feita.altura + 8 : 0) + 8;
  return desenhoDe(marcas, altura, visual.alt);
}

/* ----- Reta numérica ----- */

const RETA = { inicio: 14, esquerda: 24, direita: 280 };

export function desenharRetaNumerica(visual: VisualRetaNumerica, contexto: ContextoDoDesenho, _opcoes: OpcoesDaFigura = {}): Desenho {
  const unidade = (RETA.direita - RETA.esquerda) / (visual.ate - visual.de);
  const X = (v: number) => RETA.esquerda + (v - visual.de) * unidade;
  const fimDaReta = RETA.direita + FOLGA_DA_SETA;

  interface PontoDaRetaDesenhado {
    id: string;
    papel: PapelEfetivo;
    x: number;
    valor: number;
    derivado?: string;
    rotulo: boolean;
  }
  const visiveis: PontoDaRetaDesenhado[] = [];
  for (const ponto of visual.pontos) {
    const papel = papelNoContexto(ponto.papel, contexto);
    if (papel === "procurado" || ponto.valor === undefined) continue;
    visiveis.push({
      id: ponto.id, papel, x: X(ponto.valor), valor: ponto.valor, rotulo: ponto.rotulo !== false,
      ...(ponto.derivado ? { derivado: PALAVRA_DO_DERIVADO[ponto.derivado.tipo] } : {}),
    });
  }

  // Linhas de rótulos: o nome sobe para outra linha quando bate no vizinho.
  const linhasDeRotulo: Ret[][] = [];
  const linhaDoRotulo = new Map<string, number>();
  for (const ponto of [...visiveis].filter((p) => p.rotulo).sort((a, b) => a.x - b.x)) {
    const { l } = caixaDoRotulo(ponto.id);
    const ret: Ret = { x: ponto.x - l / 2, y: 0, l: l + 4, a: 14 };
    let linha = 0;
    while (linha < 3 && (linhasDeRotulo[linha] ?? []).some((outro) => bate(ret, outro))) linha += 1;
    linha = Math.min(linha, 2);
    (linhasDeRotulo[linha] ??= []).push(ret);
    linhaDoRotulo.set(ponto.id, linha);
  }
  const linhasUsadas = Math.max(1, linhasDeRotulo.length);
  const y0 = 22 + 20 * linhasUsadas + 12;

  const marcas: Marca[] = [];
  // Intervalos: o trecho grosso, com bolinha cheia (fechado) ou vazia (aberto) e seta quando segue ao infinito.
  for (const intervalo of visual.intervalos ?? []) {
    const x1 = intervalo.de === undefined ? RETA.inicio : X(intervalo.de);
    const x2 = intervalo.ate === undefined ? fimDaReta : X(intervalo.ate);
    marcas.push({ m: "linha", x1, y1: y0, x2, y2: y0, cor: "segmento", largura: 6 });
    if (intervalo.de === undefined) marcas.push(seta(RETA.inicio - 8, y0, "esquerda", "segmento"));
  }

  // A reta (a seta começa uma folga depois da última marca), as marcas e os números.
  marcas.push({ m: "linha", x1: RETA.inicio, y1: y0, x2: fimDaReta, y2: y0, cor: "eixo", largura: 2 });
  marcas.push(seta(fimDaReta + 8, y0, "direita", "eixo"));
  const passo = passoDosNumeros(visual.ate - visual.de, passoDaGrade(visual.ate - visual.de), unidade, 24);
  const ticks = multiplos(visual.de, visual.ate, passo);
  for (const v of ticks) marcas.push({ m: "linha", x1: X(v), y1: y0 - 5, x2: X(v), y2: y0 + 5, cor: "eixo", largura: 2 });
  const numeros: Marca[] = [];
  for (const v of ticks) {
    const texto = numeroParaTela(v);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    numeros.push({ m: "texto", texto, x: X(v) - largura / 2, y: y0 + 24, tamanho: TAMANHO_DO_NUMERO, peso: 700, italico: false, cor: "suave" });
  }
  numeros.push({ m: "texto", texto: "x", x: fimDaReta + 4, y: y0 + 24, tamanho: TAMANHO_DO_NOME_DO_EIXO, peso: 700, italico: true, cor: "suave" });

  // Extremos dos intervalos.
  for (const intervalo of visual.intervalos ?? []) {
    const extremos: [number | undefined, boolean | undefined][] = [[intervalo.de, intervalo.deAberto], [intervalo.ate, intervalo.ateAberto]];
    for (const [valor, aberto] of extremos) {
      if (valor === undefined) continue;
      marcas.push(aberto
        ? { m: "circulo", cx: X(valor), cy: y0, raio: 6, preenchimento: "branco", borda: "segmento", larguraDaBorda: 3 }
        : { m: "circulo", cx: X(valor), cy: y0, raio: 6, preenchimento: "segmento", borda: "branco", larguraDaBorda: 2 });
    }
  }

  // Pontos e os nomes deles acima.
  marcas.push(...numeros);
  for (const ponto of visiveis) {
    if (ponto.papel === "especial") marcas.push({ m: "caminho", cmds: losango(ponto.x, y0, 9), preenchimento: "especial", borda: "branco", larguraDaBorda: 2 });
    else marcas.push({ m: "circulo", cx: ponto.x, cy: y0, raio: ponto.papel === "resposta" ? 8.5 : 7, preenchimento: ponto.papel === "resposta" ? "resposta" : "dado", borda: "branco", larguraDaBorda: 2 });
  }
  const nomes: Marca[] = [];
  for (const ponto of visiveis) {
    if (!ponto.rotulo) continue;
    const linha = linhaDoRotulo.get(ponto.id) ?? 0;
    const { l } = caixaDoRotulo(ponto.id);
    nomes.push({ m: "texto", texto: ponto.id, x: ponto.x - l / 2, y: y0 - 18 - linha * 20 - (ponto.papel === "especial" ? 3 : 0), tamanho: TAMANHO_DO_ROTULO, peso: 800, italico: false, cor: COR_DO_ROTULO[ponto.papel] });
  }
  nomes.sort((a, b) => (a.m === "texto" && b.m === "texto" ? a.cor.localeCompare(b.cor) : 0));
  marcas.push(...nomes);

  // Legenda em uma frase: A = 3 · B = 5 · G = 4 (baricentro) · C = ?
  const itens: { texto: string; cor: PapelDeCor; peso: 700 | 800 }[] = [];
  const naOrdem = [...visual.pontos].sort((a, b) => Number(papelNoContexto(a.papel, contexto) === "procurado") - Number(papelNoContexto(b.papel, contexto) === "procurado"));
  for (const ponto of naOrdem) {
    const papel = papelNoContexto(ponto.papel, contexto);
    const desenhado = visiveis.find((outro) => outro.id === ponto.id);
    if (papel === "procurado" || !desenhado) itens.push({ texto: `${ponto.id} = ?`, cor: "procuradoTexto", peso: 800 });
    else {
      const sufixo = papel === "especial" && desenhado.derivado ? ` (${desenhado.derivado})` : "";
      itens.push({ texto: `${ponto.id} = ${numeroParaTela(desenhado.valor)}${sufixo}`, cor: papel === "resposta" ? "respostaTexto" : "suave", peso: papel === "resposta" ? 800 : 700 });
    }
  }
  const frase: Marca[] = [];
  let x = 16;
  let linha = 0;
  const topoDaLegenda = y0 + 24 + 22;
  itens.forEach((item, i) => {
    const largura = larguraDoTexto(item.texto, TAMANHO_DA_LEGENDA, item.peso);
    const separador = i > 0 ? larguraDoTexto(" · ", TAMANHO_DA_LEGENDA, 700) : 0;
    if (x > 16 && x + separador + largura > LARGURA_DO_DESENHO - 16) {
      x = 16;
      linha += 1;
    } else if (i > 0) {
      frase.push({ m: "texto", texto: " · ", x, y: topoDaLegenda + linha * ALTURA_DA_LINHA_DA_LEGENDA, tamanho: TAMANHO_DA_LEGENDA, peso: 700, italico: false, cor: "suave" });
      x += separador;
    }
    frase.push({ m: "texto", texto: item.texto, x, y: topoDaLegenda + linha * ALTURA_DA_LINHA_DA_LEGENDA, tamanho: TAMANHO_DA_LEGENDA, peso: item.peso, italico: false, cor: item.cor });
    x += largura;
  });
  marcas.push(...frase);
  const conteudo = topoDaLegenda + (itens.length ? linha * ALTURA_DA_LINHA_DA_LEGENDA + 14 : 0);
  const altura = Math.max(140, conteudo + 8);
  const deslocamento = Math.max(0, (altura - (conteudo + 8)) / 2);
  return desenhoDe(deslocamento ? deslocar(marcas, 0, deslocamento) : marcas, altura, visual.alt);
}

/* ----- Entrada geral, composição e SVG ----- */

/** O desenho de um visual no contexto dado; `null` só para a fórmula que não lê ou, na faixa do PNG, que não cabe. */
export function desenharVisual(visual: Visual, contexto: ContextoDoDesenho, opcoes: OpcoesDaFormula & OpcoesDaFigura = {}): Desenho | null {
  switch (visual.tipo) {
    case "plano":
      return desenharPlano(visual, contexto, opcoes);
    case "reta_numerica":
      return desenharRetaNumerica(visual, contexto, opcoes);
    case "formula": {
      const lida = lerFormula(visual.latex);
      return lida.ok ? desenharFormula(lida.arvore, opcoes) : null;
    }
  }
}

/** O teto de primitivas depois do layout (o validador o confere nos contextos que mais desenham). */
export function dentroDoTeto(desenho: Desenho): boolean {
  return desenho.primitivas.length <= TETO_DE_PRIMITIVAS;
}

function moverPrimitiva(primitiva: Primitiva, dy: number): Primitiva {
  switch (primitiva.tipo) {
    case "linha":
      return { ...primitiva, y1: r2(primitiva.y1 + dy), y2: r2(primitiva.y2 + dy) };
    case "retangulo":
      return { ...primitiva, y: r2(primitiva.y + dy) };
    case "circulo":
      return { ...primitiva, cy: r2(primitiva.cy + dy) };
    case "caminho":
      return { ...primitiva, d: deslocarCaminho(primitiva.d, 0, dy) };
  }
}

/** Centraliza o desenho numa altura mínima (o PNG só com fórmula tem pelo menos 100 de altura). */
export function comAlturaMinima(desenho: Desenho, minimo: number): Desenho {
  if (desenho.altura >= minimo) return desenho;
  const dy = (minimo - desenho.altura) / 2;
  return { ...desenho, altura: r2(minimo), primitivas: desenho.primitivas.map((primitiva) => moverPrimitiva(primitiva, dy)) };
}

/** Empilha desenhos de mesma largura (a faixa da fórmula em cima, a figura embaixo), com uma linha de 1 ponto entre eles. */
export function comporDesenhos(partes: readonly Desenho[], opcoes: { separador?: boolean } = {}): Desenho {
  const primitivas: Primitiva[] = [];
  let y = 0;
  partes.forEach((parte, i) => {
    if (i > 0 && opcoes.separador) primitivas.push({ tipo: "linha", x1: 0, y1: r2(y), x2: LARGURA_DO_DESENHO, y2: r2(y), cor: "separador", largura: 1 });
    primitivas.push(...parte.primitivas.map((primitiva) => moverPrimitiva(primitiva, y)));
    y += parte.altura;
  });
  return {
    largura: LARGURA_DO_DESENHO,
    altura: r2(y),
    primitivas,
    descricao: partes.map((parte) => parte.descricao).join(". "),
    menorTexto: Math.min(...partes.map((parte) => parte.menorTexto)),
    textos: partes.flatMap((parte) => parte.textos),
  };
}

export interface OpcoesDoSvg {
  /** Cor de fundo (o PNG usa branco). Sem ela, o fundo fica transparente. */
  fundo?: PapelDeCor | string;
  /** Largura em pixels do SVG (a altura segue); o `viewBox` é sempre o do desenho. */
  larguraEmPixels?: number;
}

const COR_HEX = /^#[0-9A-Fa-f]{6}$/;

function cor(papel: PapelDeCor | string): string {
  return COR_HEX.test(papel) ? papel : (PALETA_DO_DESENHO as Record<string, string>)[papel] ?? PALETA_DO_DESENHO.texto;
}

function tracos(primitiva: { tracejado?: readonly [number, number]; opacidade?: number }): string {
  return `${primitiva.tracejado ? ` stroke-dasharray="${primitiva.tracejado[0]} ${primitiva.tracejado[1]}"` : ""}${primitiva.opacidade !== undefined ? ` opacity="${primitiva.opacidade}"` : ""}`;
}

/**
 * O desenho como texto SVG, com as regras do contrato: preenchimento `nonzero`, ponta `butt` e junção `round`. É o que o servidor
 * entrega ao `sharp` para o PNG; a web e o app desenham as mesmas primitivas por conta própria.
 */
export function desenhoParaSvg(desenho: Desenho, opcoes: OpcoesDoSvg = {}): string {
  const pixels = opcoes.larguraEmPixels ?? desenho.largura;
  const altura = (desenho.altura * pixels) / desenho.largura;
  const partes: string[] = [];
  if (opcoes.fundo) partes.push(`<rect width="${desenho.largura}" height="${desenho.altura}" fill="${cor(opcoes.fundo)}"/>`);
  for (const primitiva of desenho.primitivas) {
    switch (primitiva.tipo) {
      case "linha":
        partes.push(`<line x1="${primitiva.x1}" y1="${primitiva.y1}" x2="${primitiva.x2}" y2="${primitiva.y2}" stroke="${cor(primitiva.cor)}" stroke-width="${primitiva.largura}" stroke-linecap="butt"${tracos(primitiva)}/>`);
        break;
      case "retangulo":
        partes.push(`<rect x="${primitiva.x}" y="${primitiva.y}" width="${primitiva.largura}" height="${primitiva.altura}"${primitiva.raio ? ` rx="${primitiva.raio}"` : ""} fill="${primitiva.preenchimento ? cor(primitiva.preenchimento) : "none"}"${primitiva.borda ? ` stroke="${cor(primitiva.borda)}" stroke-width="${primitiva.larguraDaBorda ?? 1}"` : ""}${tracos(primitiva)}/>`);
        break;
      case "circulo":
        partes.push(`<circle cx="${primitiva.cx}" cy="${primitiva.cy}" r="${primitiva.raio}" fill="${primitiva.preenchimento ? cor(primitiva.preenchimento) : "none"}"${primitiva.borda ? ` stroke="${cor(primitiva.borda)}" stroke-width="${primitiva.larguraDaBorda ?? 1}"` : ""}${tracos(primitiva)}/>`);
        break;
      case "caminho":
        partes.push(`<path d="${primitiva.d}" fill="${primitiva.preenchimento ? cor(primitiva.preenchimento) : "none"}" fill-rule="nonzero"${primitiva.borda ? ` stroke="${cor(primitiva.borda)}" stroke-width="${primitiva.larguraDaBorda ?? 1}" stroke-linecap="butt" stroke-linejoin="round"` : ""}${tracos(primitiva)}/>`);
        break;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${desenho.largura} ${desenho.altura}" width="${pixels}" height="${r2(altura)}">${partes.join("")}</svg>`;
}

/** O texto de uma caixa solta (para quem monta rótulos próprios com o mesmo motor). */
export function caixaDeTexto(texto: string, tamanho: number): Caixa {
  return textoEmCaixa(texto, { tamanho: pisar(tamanho), cor: "texto", italico: false, respiro: 1 });
}
