import { falarFormula, lerFormula, type NoFormula } from "./formula";
import { lerExpressaoDaFuncao, numeroComPiParaTela, rotuloDaFuncao, type ModeloDaFuncao } from "./funcao-expressao";
import { janelaDaFuncao, trechosDaCurva } from "./funcao-janela";
import { caixaDaFormula, caixaDaFormulaEmLinha, deslocar, pisar, semGlifoNaFormula, textoEmCaixa, type Caixa, type Comando, type Marca } from "./motor-formula";
import { arredondar, caminhoDoTexto, deslocarCaminho, larguraDoTexto, type PesoDoTexto } from "./texto-vetorial";
import {
  LARGURA_DO_DESENHO,
  PALETA_DO_DESENHO,
  PISO_DO_TEXTO,
  TETO_DE_PRIMITIVAS,
  janelaDosDados,
  pontoApareceNaPosicao,
  type ContextoDoDesenho,
  type Desenho,
  type DesenhoEmLinha,
  type PapelDeCor,
  type PapelPonto,
  type Primitiva,
  type Visual,
  type VisualFuncao,
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

/** O halo do texto sobre o gráfico: contorno branco de 3 unidades para cada lado, por baixo do texto. */
const LARGURA_DO_HALO = 6;

/**
 * As marcas na ordem em que se desenham. Textos seguidos viram caminhos (um por cor, o teto de primitivas agradece); os que levam
 * `halo` (rótulos, números e nomes dos eixos, sobre grade e traços) ganham antes dos caminhos um contorno branco só, por baixo de
 * todos, para o texto nunca se perder em cima de uma linha.
 */
export function emitir(marcas: readonly Marca[]): { primitivas: Primitiva[]; menorTexto: number; textos: string[] } {
  const primitivas: Primitiva[] = [];
  const textos: string[] = [];
  let menor = Infinity;
  let grupo: Extract<Marca, { m: "texto" }>[] = [];
  const fecharGrupo = () => {
    if (grupo.length === 0) return;
    const corridas: { cor: PapelDeCor; opacidade?: number; d: string }[] = [];
    let todos = "";
    for (const marca of grupo) {
      const d = caminhoDoTexto(marca.texto, marca.x, marca.y, marca.tamanho, marca.peso, marca.italico);
      if (!d) continue;
      todos += d;
      const ultima = corridas[corridas.length - 1];
      if (ultima && ultima.cor === marca.cor && ultima.opacidade === marca.opacidade) ultima.d += d;
      else corridas.push({ cor: marca.cor, ...(marca.opacidade !== undefined ? { opacidade: marca.opacidade } : {}), d });
    }
    if (grupo[0].halo === true && todos) primitivas.push({ tipo: "caminho", d: todos, borda: "branco", larguraDaBorda: LARGURA_DO_HALO });
    for (const corrida of corridas) {
      primitivas.push({ tipo: "caminho", d: corrida.d, preenchimento: corrida.cor, ...(corrida.opacidade !== undefined ? { opacidade: corrida.opacidade } : {}) });
    }
    grupo = [];
  };
  for (const marca of marcas) {
    if (marca.m === "texto") {
      menor = Math.min(menor, marca.tamanho);
      textos.push(marca.texto);
      if (grupo.length > 0 && (grupo[0].halo === true) !== (marca.halo === true)) fecharGrupo();
      grupo.push(marca);
      continue;
    }
    fecharGrupo();
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
  fecharGrupo();
  return { primitivas, menorTexto: Number.isFinite(menor) ? menor : PISO_DO_TEXTO, textos };
}

function desenhoDe(marcas: readonly Marca[], altura: number, descricao: string, extra: Partial<Desenho> = {}): Desenho {
  const { primitivas, menorTexto, textos } = emitir(marcas);
  return { largura: LARGURA_DO_DESENHO, altura: r2(altura), primitivas, descricao, menorTexto, textos, caixas: [], ...extra };
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
  // Com um caractere sem glifo a fórmula não é desenhada (nunca um "?" no lugar): fica o texto linear.
  if (semGlifoNaFormula(arvore).length > 0) return null;
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

/**
 * A fórmula em linha (variável, índice, expoente, número, operador, parênteses, fração simples "a/b"): uma caixa do tamanho do
 * texto ao redor (`tamanho`, 16 ou 17), com a linha de base marcada, para o cliente pôr no meio da frase (spec 15, seção 9):
 * índice e expoente a 70% (no mínimo 11), o índice desce 0,3 em e o expoente sobe 0,45 em, dentro da linha de 1,5 em, sem a
 * linha crescer; 0,2 em de cada lado dos sinais; a caixa não quebra. `peso` é o do texto ao redor: 400 (regular) na aula, 700
 * (negrito, o padrão) no enunciado e nos títulos; as variáveis seguem em itálico. A `linhaDeBase` é a distância do topo da caixa à
 * base dos algarismos e das letras (não ao fundo do índice nem da caixa). Fração composta, raiz e matriz não vêm aqui
 * (`formulaCabeNaLinha`): na frase caem em texto linear em peças (`partirTextoComFormulas`).
 */
export function desenharFormulaEmLinha(arvore: NoFormula, tamanho = 16, peso: 400 | 700 = 700): DesenhoEmLinha {
  const caixa = caixaDaFormulaEmLinha(arvore, tamanho, "texto", peso);
  const { primitivas, menorTexto } = emitir(deslocar(caixa.marcas, 0, caixa.a));
  return { largura: r2(caixa.l), altura: r2(caixa.a + caixa.p), linhaDeBase: r2(caixa.a), primitivas, falado: falarFormula(arvore), menorTexto };
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
/** A altura do traço de um dígito (a caixa de um número de eixo é a do traço, não a da linha: assim ela não invade o vizinho). */
const ALTURA_DO_DIGITO = 9.5;

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

/**
 * Rótulo que perdeu as coordenadas no desenho por falta de lugar: elas vão para a legenda, em linha própria, com o símbolo do
 * ponto antes (bolinha, losango…, na cor do papel), para nunca se perder.
 */
interface CoordenadasNaLegenda {
  texto: string;
  cor: PapelDeCor;
  simbolo: ItemDaLegenda["simbolo"];
}

/**
 * Como a legenda se compõe (a altura é o que o desenho cede quando falta lugar, nesta ordem):
 * - `completa`: as categorias ("dados", "baricentro", "C = ?") numa frase e as coordenadas perdidas em linha própria, cada uma com o símbolo;
 * - `junta`: as mesmas entradas, mas as coordenadas seguem na linha das categorias (menos linhas);
 * - `compacta`: sem as categorias (fica o "C = ?"), as coordenadas só com o texto na cor do papel, em fluxo corrido.
 */
export type ModoDaLegenda = "completa" | "junta" | "compacta";

/**
 * A legenda em linhas de até 288 de largura, a partir de (16, topo). Devolve as marcas e a altura que ocupa. No modo `compacta` as
 * categorias só saem se isso poupa uma linha; senão a legenda fica como a `junta` (tirar a informação sem ganhar altura não ajuda).
 */
function legenda(
  itens: readonly ItemDaLegenda[], escondidos: readonly string[], perdidas: readonly CoordenadasNaLegenda[], topo: number,
  modo: ModoDaLegenda = "completa",
): { marcas: Marca[]; altura: number } {
  if (modo !== "compacta") return montarLegenda(itens, escondidos, perdidas, topo, modo);
  const semCategorias = montarLegenda(itens, escondidos, perdidas, topo, "compacta");
  const junta = montarLegenda(itens, escondidos, perdidas, topo, "junta");
  return semCategorias.altura < junta.altura ? semCategorias : junta;
}

interface EntradaDaLegenda {
  largura: number;
  fazer: (x: number, y: number) => Marca[];
  /** Começa uma linha nova (as coordenadas, na legenda completa). */
  novaLinha?: boolean;
}

/** As entradas da legenda, na ordem: as categorias, o "C = ?" e as coordenadas que o rótulo perdeu (com o símbolo, ou só o texto na `compacta`). */
function entradasDaLegenda(
  itens: readonly ItemDaLegenda[], escondidos: readonly string[], perdidas: readonly CoordenadasNaLegenda[], modo: ModoDaLegenda,
): EntradaDaLegenda[] {
  const entradas: EntradaDaLegenda[] = modo === "compacta" ? [] : itens.map((item) => ({
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
  perdidas.forEach((perdida, i) => {
    const comSimbolo = modo !== "compacta";
    entradas.push({
      largura: (comSimbolo ? 17 : 0) + larguraDoTexto(perdida.texto, TAMANHO_DA_LEGENDA, 800),
      novaLinha: modo === "completa" && i === 0,
      fazer: (x, y) => [
        ...(comSimbolo ? marcasDoSimbolo(perdida.simbolo, x, y - 5) : []),
        { m: "texto", texto: perdida.texto, x: x + (comSimbolo ? 17 : 0), y, tamanho: TAMANHO_DA_LEGENDA, peso: 800, italico: false, cor: perdida.cor },
      ],
    });
  });
  return entradas;
}

function montarLegenda(
  itens: readonly ItemDaLegenda[], escondidos: readonly string[], perdidas: readonly CoordenadasNaLegenda[], topo: number, modo: ModoDaLegenda,
): { marcas: Marca[]; altura: number } {
  const entradas = entradasDaLegenda(itens, escondidos, perdidas, modo);
  if (entradas.length === 0) return { marcas: [], altura: 0 };
  const marcas: Marca[] = [];
  let x = 16;
  let linha = 0;
  for (const entrada of entradas) {
    if (x > 16 && (entrada.novaLinha === true || x + entrada.largura > LARGURA_DO_DESENHO - 16)) {
      x = 16;
      linha += 1;
    }
    marcas.push(...entrada.fazer(x, topo + 14 + linha * ALTURA_DA_LINHA_DA_LEGENDA));
    x += entrada.largura + 16;
  }
  return { marcas, altura: (linha + 1) * ALTURA_DA_LINHA_DA_LEGENDA + 2 };
}

/**
 * A legenda na lateral, ao lado do gráfico (quando a altura limita e o gráfico estreita): uma entrada por linha, numa coluna que
 * começa em `x` e em `topo`. Devolve a largura da coluna e a altura que ela ocupa.
 */
function legendaLateral(
  itens: readonly ItemDaLegenda[], escondidos: readonly string[], perdidas: readonly CoordenadasNaLegenda[], x: number, topo: number, modo: ModoDaLegenda,
): { marcas: Marca[]; largura: number; altura: number } {
  const entradas = entradasDaLegenda(itens, escondidos, perdidas, modo);
  if (entradas.length === 0) return { marcas: [], largura: 0, altura: 0 };
  const marcas = entradas.flatMap((entrada, linha) => entrada.fazer(x, topo + 14 + linha * ALTURA_DA_LINHA_DA_LEGENDA));
  return { marcas, largura: Math.max(...entradas.map((entrada) => entrada.largura)), altura: entradas.length * ALTURA_DA_LINHA_DA_LEGENDA + 2 };
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
  for (let volta = 0; passo * unidade < minimoEmUnidades && volta < 64; volta += 1) {
    // Depois de 1000 (o último da lista) o passo dobra; um passo fora da lista também dobra (nunca volta ao começo da lista).
    const posicao = PASSOS_DA_GRADE.indexOf(passo);
    passo = posicao >= 0 && posicao + 1 < PASSOS_DA_GRADE.length ? PASSOS_DA_GRADE[posicao + 1] : passo * 2;
  }
  return passo;
}

function multiplos(de: number, ate: number, passo: number): number[] {
  const valores: number[] = [];
  for (let v = Math.ceil(de / passo - 1e-9) * passo; v <= ate + 1e-9; v += passo) valores.push(Math.round(v * 1000) / 1000);
  return valores;
}

/** O rótulo inteiro fica a pelo menos isto de um número de eixo (o halo de 3 de cada lado não pode se encostar). */
const FOLGA_DO_ROTULO_DOS_NUMEROS = 4;
/** O rótulo fica a pelo menos isto do traço do eixo (e das asas da seta): o traço de 2, o halo de 3 do texto e um respiro. */
const MARGEM_DO_ROTULO_AOS_EIXOS = 4;
/** O 0 da origem fica a no máximo isto da origem (a caixa dele, em qualquer dos quatro quadrantes): mais longe se leria como número de eixo. */
export const DISTANCIA_MAXIMA_DO_ZERO = 8;
const AFASTAMENTO_LATERAL_DO_ZERO = 4.6;
const AFASTAMENTO_VERTICAL_DO_ZERO = 6.4;
/** A letra (ou o rótulo inteiro) do ponto fica a no máximo isto da borda dele, em qualquer das 8 direções: mais longe deixa de parecer dele. */
const DISTANCIA_MAXIMA_DO_ROTULO = 8;
/** O rótulo só com o nome nunca encosta em número de eixo: no mínimo uma unidade de glifo (um dígito) de folga. */
const FOLGA_DO_NOME_DOS_NUMEROS = 8;

const inflar = (ret: Ret, folga: number): Ret => ({ x: ret.x - folga, y: ret.y - folga, l: ret.l + 2 * folga, a: ret.a + 2 * folga });

interface LugarDoRotulo {
  texto: string;
  x: number;
  y: number;
  l: number;
  a: number;
}

/**
 * O rótulo de um ponto procura um lado que não cubra outro ponto, número de eixo, rótulo ou eixo: direita, esquerda, acima, abaixo
 * e depois as diagonais; entre os lados livres ganha o que cobre menos traço. Se nenhum lado couber o rótulo inteiro ("A (1, 2)"),
 * fica só o nome ("A") no lado livre mais perto, sempre a uma unidade de glifo de qualquer número de eixo; o rótulo, inteiro ou só
 * o nome, fica a no máximo 8 unidades da borda do ponto (mais longe ele deixaria de parecer do ponto). Sem lugar nem para o nome,
 * devolve `null`. Quando o rótulo perde as coordenadas, quem chama as põe na legenda (`soONome` pula direto para o nome).
 */
function acharLugarDoRotulo(
  cx: number, cy: number, raioDoPonto: number, completo: string, nome: string, obstaculos: readonly Ret[], numeros: readonly Ret[],
  limites: { esquerda: number; direita: number; topo: number; fundo: number }, moles: readonly Ret[] = [], soONome = false,
): LugarDoRotulo | null {
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
  /** A distância da caixa do rótulo à BORDA do ponto (não ao centro): é ela que não passa de `DISTANCIA_MAXIMA_DO_ROTULO`. */
  const distanciaDaBorda = (ret: Ret) => Math.hypot(Math.max(ret.x - cx, 0, cx - (ret.x + ret.l)), Math.max(ret.y - cy, 0, cy - (ret.y + ret.a))) - raioDoPonto;
  const livre = (ret: Ret, folgaDosNumeros: number) => {
    if (ret.x < limites.esquerda || ret.x + ret.l > limites.direita || ret.y < limites.topo || ret.y + ret.a > limites.fundo) return false;
    if (distanciaDaBorda(ret) > DISTANCIA_MAXIMA_DO_ROTULO + 1e-6) return false;
    return !obstaculos.some((obstaculo) => bate(ret, obstaculo)) && !numeros.some((numero) => bate(ret, inflar(numero, folgaDosNumeros)));
  };
  // 1. o rótulo inteiro em algum lado; 2. só o nome, no lado livre mais perto. Os dois a no máximo 8 unidades da borda do ponto, em
  // qualquer das 8 direções e mesmo sobre a grade (o halo resolve a leitura); sem lugar assim, o ponto fica sem letra.
  const afastamentos = [0, 1, 2, 3, 4];
  const tentativas: (readonly [string, number, number])[] = [
    ...(soONome ? [] : afastamentos.map((anel) => [completo, anel, FOLGA_DO_ROTULO_DOS_NUMEROS] as const)),
    ...afastamentos.map((anel) => [nome, anel, FOLGA_DO_NOME_DOS_NUMEROS] as const),
  ];
  for (const [texto, anel, folgaDosNumeros] of tentativas) {
    const { l, a } = caixaDoRotulo(texto);
    const livres = lugares(l, a, anel)
      .filter((lugar) => livre({ ...lugar, l, a }, folgaDosNumeros))
      .map((lugar, ordem) => ({ lugar, ordem, traco: moles.reduce((soma, mole) => soma + sobreposicao({ ...lugar, l, a }, mole), 0) }))
      .sort((x, y) => x.traco - y.traco || x.ordem - y.ordem);
    if (livres.length) return { texto, ...livres[0].lugar, l, a };
  }
  return null;
}

/** Os múltiplos exatos de `passo` entre `de` e `ate` (sem arredondar: π/2, 3π/2 conferem com o múltiplo de π/4 do rótulo). */
function multiplosExatos(de: number, ate: number, passo: number): number[] {
  const valores: number[] = [];
  for (let k = Math.ceil(de / passo - 1e-9); k * passo <= ate + 1e-9; k += 1) valores.push(k * passo);
  return valores;
}

/** O que o gráfico de função acrescenta ao plano (marco 12a): a janela, as escalas, as curvas, o passo do eixo x e a faixa de fórmulas de cima. */
export interface ExtraDaFuncao {
  janela: { x: [number, number]; y: [number, number] };
  /** Seno e cosseno: x e y com escalas independentes (a altura do gráfico em cerca de metade da largura). */
  independentes: boolean;
  /** O passo da grade e dos números do eixo x (π/2 no seno e no cosseno); sem ele, o de sempre (1, 2, 5…). */
  passoX?: number;
  rotuloDoNumeroX?: (valor: number) => string;
  curvas: CurvaParaDesenhar[];
}

export interface CurvaParaDesenhar {
  nome: string;
  /** A expressão canônica, para a faixa de cima ("f(x) = …"). */
  latex: string;
  cor: PapelDeCor;
  tracejada: boolean;
  modelo: ModeloDaFuncao;
  /** O trecho do domínio desta curva que o gráfico mostra; as pontas do domínio, sem bolinha. */
  de: number;
  ate: number;
  /** A curva aparece neste contexto? (Quando o exercício pergunta um ponto dela, no enunciado só a fórmula aparece, na faixa de cima.) */
  aparece: boolean;
}

/** 19: o expoente a 70% fica em 13,3 (o piso do texto da figura); a 85% disso (16,2) ele passaria a 11, então a faixa que não cabe em 19 ou em 18,6 tira a figura. */
const TAMANHO_DA_FORMULA_DA_FAIXA = 19;
const TAMANHO_MINIMO_DA_FORMULA_DA_FAIXA = 18.6;
const ALTURA_DA_LINHA_DA_FAIXA = 24;

/**
 * A faixa de cima: uma fórmula por curva ("f(x) = x² − 4x + 3"), na cor da curva, centralizada, e uma linha `#E1E7FA` no fim (o PNG do build 3
 * e do site é a figura inteira e precisa dela). Não cabendo em 296 de largura nem no tamanho mínimo, a figura inteira sai (`cabe`).
 */
function faixaDeFormulas(curvas: readonly CurvaParaDesenhar[]): { marcas: Marca[]; altura: number; cabe: boolean } {
  if (curvas.length === 0) return { marcas: [], altura: 0, cabe: true };
  const marcas: Marca[] = [];
  let cabe = true;
  curvas.forEach((curva, i) => {
    const lida = lerFormula(`${curva.nome}(x) = ${curva.latex}`);
    if (!lida.ok || semGlifoNaFormula(lida.arvore).length > 0) {
      cabe = false;
      return;
    }
    let caixa = caixaDaFormulaEmLinha(lida.arvore, TAMANHO_DA_FORMULA_DA_FAIXA, curva.cor, 700);
    if (caixa.l > LARGURA_DO_DESENHO - 24) caixa = caixaDaFormulaEmLinha(lida.arvore, TAMANHO_MINIMO_DA_FORMULA_DA_FAIXA, curva.cor, 700);
    if (caixa.l > LARGURA_DO_DESENHO - 24) cabe = false;
    marcas.push(...deslocar(caixa.marcas, (LARGURA_DO_DESENHO - caixa.l) / 2, 8 + i * ALTURA_DA_LINHA_DA_FAIXA + caixa.a));
  });
  const altura = 8 + curvas.length * ALTURA_DA_LINHA_DA_FAIXA + 4;
  marcas.push({ m: "linha", x1: 0, y1: altura, x2: LARGURA_DO_DESENHO, y2: altura, cor: "separador", largura: 1 });
  return { marcas, altura: altura + 1, cabe };
}

/* ----- Plano cartesiano ----- */

const GRADE_ESQUERDA = 28;
const GRADE_DIREITA = 280;
const GRADE_TOPO = 32;
const GRADE_BANDA_DE_BAIXO = 28;
/** Com esta escala (pontos de projeto por unidade) ou mais, os pontos têm o tamanho inteiro; abaixo, encolhem junto (até a metade). */
const UNIDADE_DO_PONTO_INTEIRO = 16;

interface PontoDesenhado {
  id: string;
  papel: PapelEfetivo;
  x: number;
  y: number;
  completo: string | null;
}

/**
 * O que o plano cede, nesta ordem, quando a altura que o cliente dá (`alturaMaxima`) não comporta o desenho inteiro: a faixa de baixo
 * encolhe até o que os números do eixo pedem, a legenda vai para a lateral (ao lado do gráfico, que estreita), as linhas da
 * legenda se juntam e, por fim, as categorias saem da legenda se isso poupa linhas (as coordenadas ficam, com o texto na cor do
 * papel). O gráfico nunca ganha unidades vazias: a janela é a dos dados com uma unidade de folga e a origem; quando a altura
 * limita, a escala desce, o gráfico estreita e fica centralizado. O texto nunca desce do piso. A primeira alternativa que dá uma
 * unidade de pelo menos 12 (`UNIDADE_MINIMA`) vale; se nenhuma dá, o desenho sai marcado `naoCabe`.
 */
const DEGRAUS_DO_PLANO: readonly DegrauDoPlano[] = [
  { legenda: "completa", posicao: "embaixo", banda: "normal" },
  { legenda: "completa", posicao: "embaixo", banda: "justa" },
  { legenda: "completa", posicao: "lateral", banda: "normal" },
  { legenda: "completa", posicao: "lateral", banda: "justa" },
  { legenda: "junta", posicao: "embaixo", banda: "justa" },
  { legenda: "junta", posicao: "lateral", banda: "justa" },
  { legenda: "compacta", posicao: "embaixo", banda: "justa" },
  { legenda: "compacta", posicao: "lateral", banda: "justa" },
];

interface DegrauDoPlano {
  legenda: ModoDaLegenda;
  /** Embaixo do gráfico, ou na lateral (ao lado dele). */
  posicao: "embaixo" | "lateral";
  /** A faixa de baixo do gráfico: a normal (28) ou a justa, que só leva o que os números do eixo x pedem. */
  banda: "normal" | "justa";
}

interface PlanoFeito {
  desenho: Desenho;
  /** Pontos de projeto por unidade do gráfico. */
  unidade: number;
  /** A legenda coube onde esse degrau a pôs. */
  viavel: boolean;
}

/** A altura padrão de uma figura: o enunciado, o retorno e o PNG da fase 1 a usam quando o cliente não dá outra. */
export const ALTURA_PADRAO_DA_FIGURA = 320;
/** A unidade (pontos de projeto por unidade do plano) abaixo da qual a grade vira risco e os pontos se amontoam: o desenho não cabe. */
export const UNIDADE_MINIMA_DO_PLANO = 12;
const UNIDADE_MAXIMA_DO_PLANO = 48;
/** Com a legenda embaixo e esta unidade ou mais, o desenho é o de sempre; abaixo disso o motor escolhe o degrau de maior unidade. */
const UNIDADE_CONFORTAVEL_DO_PLANO = 16;
const LARGURA_MAXIMA_DA_GRADE = GRADE_DIREITA - GRADE_ESQUERDA;
/** À direita da grade: a seta do eixo x e o nome dele. */
const DECORACAO_DA_DIREITA = LARGURA_DO_DESENHO - GRADE_DIREITA;
/** O que os números do eixo x pedem abaixo do eixo: a linha de base a 17 e um respiro. */
const NUMEROS_ABAIXO_DO_EIXO = 21;
const BANDA_MINIMA = 10;

/**
 * O plano, sempre dentro de `alturaMaxima` (padrão 320) e com a unidade de pelo menos 12 quando a altura é o que a limita; o que o
 * motor não consegue fazer caber ele marca `naoCabe`, e quem desenha (ou valida) trata como visual que não vale: o cliente mostra o
 * `alt`. O rótulo que não coube inteiro ("A (1, 2)") vira só o nome (ou some, se nem o nome cabe) e as coordenadas vão para a
 * legenda. Como a legenda ocupa lugar, e o lugar muda a escala e a escala muda onde os rótulos cabem, cada degrau se refaz até
 * estabilizar.
 */
export function desenharPlano(visual: VisualPlano, contexto: ContextoDoDesenho, opcoes: OpcoesDaFigura = {}, extra?: ExtraDaFuncao): Desenho {
  const limite = opcoes.alturaMaxima ?? ALTURA_PADRAO_DA_FIGURA;
  const aqui = escolherDegrau(visual, contexto, opcoes, limite, extra);
  if (aqui.chegouAoMinimo && aqui.feito) return aqui.feito.desenho;
  // Não chegou a 12. Dados que pedem uma escala menor mesmo na altura padrão (um intervalo de mil unidades) têm a escala que têm: só
  // é "não coube" se a ALTURA é o que impede, isto é, se a melhor escala daqui é menor que a da altura padrão (ou que 12).
  const padrao = limite >= ALTURA_PADRAO_DA_FIGURA ? aqui : escolherDegrau(visual, contexto, opcoes, ALTURA_PADRAO_DA_FIGURA, extra);
  // No gráfico de função o piso de 12 é absoluto (spec 15, seção 15): não existe "os dados pedem uma escala menor", como no plano de mil unidades.
  const unidadeMinima = extra ? UNIDADE_MINIMA_DO_PLANO : Math.min(UNIDADE_MINIMA_DO_PLANO, padrao.feito?.unidade ?? 0);
  if (aqui.feito && aqui.feito.unidade >= unidadeMinima - 1e-9) return aqui.feito.desenho;
  return { ...(aqui.feito ?? desenharPlanoEstavel(visual, contexto, opcoes, DEGRAUS_DO_PLANO[0], extra)).desenho, naoCabe: true };
}

/**
 * O degrau do plano na altura `limite`. Se o primeiro (a legenda embaixo, completa) dá uma unidade confortável, ele fica: é o
 * desenho de sempre. Senão, vale o degrau que dá a MAIOR unidade (o gráfico estreita só até onde a altura obriga, e nunca mais
 * estreito que o de uma altura maior).
 */
function escolherDegrau(
  visual: VisualPlano, contexto: ContextoDoDesenho, opcoes: OpcoesDaFigura, limite: number, extra?: ExtraDaFuncao,
): { feito: PlanoFeito | null; chegouAoMinimo: boolean } {
  let melhor: PlanoFeito | null = null;
  for (const [posicao, degrau] of DEGRAUS_DO_PLANO.entries()) {
    const feito = desenharPlanoEstavel(visual, contexto, { ...opcoes, alturaMaxima: limite }, degrau, extra);
    if (!feito.viavel || feito.desenho.altura > limite + 1e-6) continue;
    if (posicao === 0 && feito.unidade >= UNIDADE_CONFORTAVEL_DO_PLANO) return { feito, chegouAoMinimo: true };
    if (!melhor || feito.unidade > melhor.unidade + 1e-9) melhor = feito;
  }
  return { feito: melhor, chegouAoMinimo: (melhor?.unidade ?? 0) >= UNIDADE_MINIMA_DO_PLANO - 1e-9 };
}

function desenharPlanoEstavel(visual: VisualPlano, contexto: ContextoDoDesenho, opcoes: OpcoesDaFigura, degrau: DegrauDoPlano, extra?: ExtraDaFuncao): PlanoFeito {
  const naLegenda = new Set<string>();
  for (let volta = 0; volta < 6; volta += 1) {
    const feito = desenharPlanoUmaVez(visual, contexto, opcoes, naLegenda, degrau, extra);
    if (feito.novos.length === 0) return feito;
    feito.novos.forEach((id) => naLegenda.add(id));
  }
  // Não estabilizou: todos os rótulos viram só o nome, com as coordenadas na legenda (assim sempre estabiliza).
  return desenharPlanoUmaVez(visual, contexto, opcoes, new Set(visual.pontos.map((ponto) => ponto.id)), degrau, extra);
}

function desenharPlanoUmaVez(
  visual: VisualPlano, contexto: ContextoDoDesenho, opcoes: OpcoesDaFigura, forcados: ReadonlySet<string>, degrau: DegrauDoPlano, extra?: ExtraDaFuncao,
): PlanoFeito & { novos: string[] } {
  const rotuloCompleto = (ponto: VisualPlano["pontos"][number]) => (extra
    ? rotuloDaFuncao(ponto.id, ponto.x as number, ponto.y as number)
    : rotuloDoPonto(ponto.id, [ponto.x as number, ponto.y as number]));
  const doContexto = visual.pontos.flatMap((ponto) => {
    const papel = papelNoContexto(ponto.papel, contexto);
    return papel === "procurado" || ponto.x === undefined || ponto.y === undefined ? [] : [{ ponto, papel }];
  });
  const emLegenda: CoordenadasNaLegenda[] = doContexto
    .filter(({ ponto }) => ponto.rotulo !== false && forcados.has(ponto.id))
    .map(({ ponto, papel }) => ({ texto: rotuloCompleto(ponto), cor: COR_DO_ROTULO[papel], simbolo: papel as ItemDaLegenda["simbolo"] }));

  // A janela é a que o servidor guardou (a dos dados com uma unidade de folga e a origem): o motor não abre unidades vazias para
  // encher os 320 de largura. A escala é a maior que cabe na largura e na altura; sobrando largura, o gráfico estreita e centraliza.
  const legendaPrevia = itensDaLegenda(visual.pontos, contexto);
  // A janela: onde o procurado ainda não pode aparecer, a dos pontos que aparecem (a que o servidor guardou entregaria o procurado:
  // a borda do gráfico seria a coordenada dele mais 1); onde ele aparece (retorno, último passo), a guardada, que o inclui.
  const revela = contexto.tipo === "retorno" || (contexto.tipo === "passo" && contexto.ultimo);
  // O gráfico de função traz a janela já escolhida (a da conta da seção 2 da spec, que olha a curva só onde ela aparece).
  const [xMin, xMax] = extra ? extra.janela.x : revela ? visual.x : janelaDosDados(doContexto.map(({ ponto }) => ponto.x as number), true);
  const [yMin, yMax] = extra ? extra.janela.y : revela ? visual.y : janelaDosDados(doContexto.map(({ ponto }) => ponto.y as number), true);
  const intervaloX = xMax - xMin;
  const intervaloY = yMax - yMin;
  const limite = opcoes.alturaMaxima ?? ALTURA_PADRAO_DA_FIGURA;
  const lateral = degrau.posicao === "lateral";
  const embaixoDeAntes = legenda(legendaPrevia.itens, legendaPrevia.escondidos, emLegenda, 0, degrau.legenda);
  const aoLadoDeAntes = legendaLateral(legendaPrevia.itens, legendaPrevia.escondidos, emLegenda, 0, 0, degrau.legenda);
  const alturaDaLegendaEmbaixo = !lateral && embaixoDeAntes.altura > 0 ? embaixoDeAntes.altura + 8 : 0;
  const folgaDaLateral = lateral && aoLadoDeAntes.largura > 0 ? 8 + aoLadoDeAntes.largura + 8 : 0;
  const larguraMaximaDaGrade = Math.min(LARGURA_MAXIMA_DA_GRADE, LARGURA_DO_DESENHO - GRADE_ESQUERDA - DECORACAO_DA_DIREITA - folgaDaLateral);
  const abaixoDoEixo = Math.min(Math.max(0, -yMin), intervaloY);
  // A faixa de cima do gráfico de função (uma fórmula por curva) empurra o gráfico para baixo.
  const faixa = extra ? faixaDeFormulas(extra.curvas) : null;
  const topo = GRADE_TOPO + (faixa?.altura ?? 0);
  // As escalas (pontos de projeto por unidade): iguais em x e em y; no seno e no cosseno independentes, com a altura do gráfico em cerca de metade da largura.
  const escalasCom = (banda: number): { ux: number; uy: number } => {
    const alturaLivre = (limite - topo - banda - 8 - alturaDaLegendaEmbaixo) / intervaloY;
    if (!extra?.independentes) {
      const igual = Math.max(0, Math.min(UNIDADE_MAXIMA_DO_PLANO, larguraMaximaDaGrade / intervaloX, alturaLivre));
      return { ux: igual, uy: igual };
    }
    const ux = Math.max(0, larguraMaximaDaGrade / intervaloX);
    return { ux, uy: Math.max(0, Math.min((ux * intervaloX) / 2 / intervaloY, alturaLivre)) };
  };
  const bandaJusta = (uyDoGrafico: number): number => Math.max(BANDA_MINIMA, Math.ceil(NUMEROS_ABAIXO_DO_EIXO - abaixoDoEixo * uyDoGrafico));
  let { ux, uy } = escalasCom(GRADE_BANDA_DE_BAIXO);
  if (degrau.banda === "justa") {
    for (let volta = 0; volta < 4; volta += 1) ({ ux, uy } = escalasCom(bandaJusta(uy)));
  }
  const banda = degrau.banda === "justa" ? bandaJusta(uy) : GRADE_BANDA_DE_BAIXO;
  const larguraDaGrade = intervaloX * ux;
  const alturaDaGrade = intervaloY * uy;
  // A "unidade" do gráfico para quem confere o piso de 12: a de y e a do passo da grade em x (π/2 no seno e no cosseno).
  const unidade = extra?.independentes ? Math.min(uy, ux * (extra.passoX ?? 1)) : ux;
  let esquerda: number;
  if (lateral && aoLadoDeAntes.largura > 0) {
    const bloco = GRADE_ESQUERDA + larguraDaGrade + DECORACAO_DA_DIREITA + 8 + aoLadoDeAntes.largura;
    esquerda = (LARGURA_DO_DESENHO - bloco) / 2 + GRADE_ESQUERDA;
  } else {
    esquerda = GRADE_ESQUERDA + (LARGURA_MAXIMA_DA_GRADE - larguraDaGrade) / 2;
  }
  const direita = esquerda + larguraDaGrade;
  const X = (v: number) => esquerda + (v - xMin) * ux;
  const Y = (v: number) => topo + (yMax - v) * uy;
  // Numa escala pequena (a altura limita, ou os dados são largos) os pontos a uma unidade um do outro encostariam: o ponto desce junto.
  const fatorDoPonto = Math.min(ux, uy) >= UNIDADE_DO_PONTO_INTEIRO ? 1 : Math.max(0.5, Math.min(ux, uy) / UNIDADE_DO_PONTO_INTEIRO);
  const raioDoPonto = (papel: PapelEfetivo): number => (papel === "resposta" ? 8 : papel === "especial" ? 8.5 : 6) * fatorDoPonto;
  const fundo = topo + alturaDaGrade;
  const eixoX = Math.min(Math.max(X(0), esquerda), direita);
  const eixoY = Math.min(Math.max(Y(0), topo), fundo);

  const pontos: PontoDesenhado[] = doContexto.map(({ ponto, papel }) => ({
    id: ponto.id, papel, x: X(ponto.x as number), y: Y(ponto.y as number), completo: ponto.rotulo === false ? null : rotuloCompleto(ponto),
  }));
  const visiveis = new Map(pontos.map((ponto) => [ponto.id, ponto]));

  // Camadas, de baixo para cima: grade, polígonos, eixos, guias e segmentos; depois, com halo, os textos; por fim os pontos.
  const base: Marca[] = [];
  const textos: Marca[] = [];
  const caixas: Desenho["caixas"] = [];
  const caixa = (tipo: Desenho["caixas"][number]["tipo"], texto: string, ret: Ret) =>
    caixas.push({ tipo, texto, x: r2(ret.x), y: r2(ret.y), largura: r2(ret.l), altura: r2(ret.a) });
  const escrever = (texto: string, x: number, y: number, tamanho: number, peso: PesoDoTexto, cor: PapelDeCor, italico = false): Marca =>
    ({ m: "texto", texto, x, y, tamanho, peso, italico, cor, halo: true });

  // 1. Grade: uma linha por unidade até 20 unidades no eixo (no seno e no cosseno, uma linha de π/2 em π/2, em valores exatos).
  const passoX = extra?.passoX ?? passoDaGrade(xMax - xMin);
  const passoY = passoDaGrade(yMax - yMin);
  const valoresDoX = (passo: number): number[] => (extra?.passoX ? multiplosExatos(xMin, xMax, passo) : multiplos(xMin, xMax, passo));
  const rotuloDoNumeroX = extra?.rotuloDoNumeroX ?? numeroParaTela;
  for (const v of valoresDoX(passoX)) base.push({ m: "linha", x1: X(v), y1: topo, x2: X(v), y2: fundo, cor: "grade", largura: 1 });
  for (const v of multiplos(yMin, yMax, passoY)) base.push({ m: "linha", x1: esquerda, y1: Y(v), x2: direita, y2: Y(v), cor: "grade", largura: 1 });

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
    base.push({ m: "caminho", cmds: [...cmds, ["Z"]], preenchimento: "preenchimento", opacidade: 0.07 });
  }
  for (const poligono of visual.poligonos ?? []) {
    poligono.pontos.forEach((id, i) => juntarLado(id, poligono.pontos[(i + 1) % poligono.pontos.length]));
  }
  for (const segmento of visual.segmentos ?? []) juntarLado(segmento.de, segmento.ate);

  // 3. Eixos: a seta começa uma folga depois da última marca.
  const fimDoEixoX = direita + FOLGA_DA_SETA;
  const fimDoEixoY = topo - FOLGA_DA_SETA;
  base.push({ m: "linha", x1: esquerda, y1: eixoY, x2: fimDoEixoX, y2: eixoY, cor: "eixo", largura: 2 });
  base.push({ m: "linha", x1: eixoX, y1: fundo, x2: eixoX, y2: fimDoEixoY, cor: "eixo", largura: 2 });
  base.push(seta(fimDoEixoX + 8, eixoY, "direita", "eixo"), seta(eixoX, fimDoEixoY - 8, "cima", "eixo"));

  // 3b. As curvas (a ordem da spec: grade, eixos, curvas): linha contínua de 3 unidades, recortada na borda do gráfico, sem seta; a terceira tracejada.
  const nomesDasCurvas: { nome: string; cor: PapelDeCor; ponta: [number, number] }[] = [];
  const amostras = Math.min(400, Math.max(64, Math.round(2 * larguraDaGrade)));
  for (const curva of extra?.curvas ?? []) {
    // A curva que o enunciado não pode mostrar (o exercício pergunta um ponto dela) fica só na faixa de cima, como fórmula.
    if (!curva.aparece) continue;
    const de = Math.max(curva.de, xMin);
    const ate = Math.min(curva.ate, xMax);
    if (!(de < ate)) continue;
    const trechos = trechosDaCurva(curva.modelo, de, ate, [yMin, yMax], amostras, doContexto.map(({ ponto }) => ponto.x as number));
    for (const trecho of trechos) {
      base.push({
        m: "caminho", cmds: trecho.map(([vx, vy], i) => [i === 0 ? "M" : "L", X(vx), Y(vy)] as Comando),
        borda: curva.cor, larguraDaBorda: 3, ...(curva.tracejada ? { tracejado: [6, 4] as const } : {}),
      });
    }
    const ultimo = trechos.at(-1)?.at(-1);
    if (ultimo) nomesDasCurvas.push({ nome: curva.nome, cor: curva.cor, ponta: [X(ultimo[0]), Y(ultimo[1])] });
  }

  // Obstáculos dos rótulos: os eixos, os nomes dos eixos e os pontos; os números dos eixos ficam à parte (têm folga própria).
  const obstaculos: Ret[] = [
    { x: eixoX - 2, y: fimDoEixoY - 8, l: 4, a: fundo - fimDoEixoY + 8 },
    { x: esquerda, y: eixoY - 2, l: fimDoEixoX + 8 - esquerda, a: 4 },
  ];
  const nomeDoX = { x: fimDoEixoX + 4, y: eixoY + 7, l: larguraDoTexto("x", TAMANHO_DO_NOME_DO_EIXO, 700), a: 15 };
  const nomeDoY = { x: eixoX + 8, y: fimDoEixoY - 14, l: larguraDoTexto("y", TAMANHO_DO_NOME_DO_EIXO, 700), a: 15 };
  textos.push(escrever("x", nomeDoX.x, eixoY + 18, TAMANHO_DO_NOME_DO_EIXO, 700, "suave", true), escrever("y", nomeDoY.x, fimDoEixoY - 3, TAMANHO_DO_NOME_DO_EIXO, 700, "suave", true));
  caixa("eixo", "x", nomeDoX);
  caixa("eixo", "y", nomeDoY);
  obstaculos.push({ ...nomeDoX, x: nomeDoX.x - 2, l: nomeDoX.l + 4 }, { ...nomeDoY, x: nomeDoY.x - 2, l: nomeDoY.l + 4 });
  // O nome da curva ("f", "g", "h", itálico 14 em 800, na cor dela, com halo) fica perto da ponta direita, dentro do gráfico; os rótulos fogem dele.
  for (const { nome, cor, ponta } of nomesDasCurvas) {
    const l = larguraDoTexto(nome, TAMANHO_DO_ROTULO, 800);
    const ret: Ret = {
      x: Math.min(Math.max(ponta[0] - l - 8, esquerda + 2), direita - l - 2),
      y: Math.min(Math.max(ponta[1] - 20, topo + 2), fundo - 17),
      l, a: 15,
    };
    textos.push(escrever(nome, ret.x, ret.y + 11.5, TAMANHO_DO_ROTULO, 800, cor, true));
    caixa("rotulo", nome, ret);
    obstaculos.push(inflar(ret, 2));
  }
  // A legenda na lateral também é um lugar onde rótulo nenhum pode cair.
  if (lateral && aoLadoDeAntes.largura > 0) obstaculos.push({ x: direita + DECORACAO_DA_DIREITA + 4, y: topo - 2, l: aoLadoDeAntes.largura + 8, a: aoLadoDeAntes.altura + 4 });
  const caixaDoPonto = (ponto: PontoDesenhado): Ret => ({ x: ponto.x - 10 * fatorDoPonto, y: ponto.y - 10 * fatorDoPonto, l: 20 * fatorDoPonto, a: 20 * fatorDoPonto });

  // A ÚNICA exceção a "número de eixo nunca some" (spec 15, seção 12): a bolinha (ou o losango) de um ponto que cobre o número (a caixa do
  // número encosta no círculo do ponto, com a borda branca) tira só aquele número; a grade continua permitindo contar. Vale para o número
  // do eixo e para o número em foco de uma linha-guia: o ponto sobre o eixo (C = (0, 3) com a guia em y) o taparia pela metade.
  const cobertoPorPonto = (ret: Ret): boolean =>
    pontos.some((ponto) => {
      const dx = Math.max(ret.x - ponto.x, 0, ponto.x - (ret.x + ret.l));
      const dy = Math.max(ret.y - ponto.y, 0, ponto.y - (ret.y + ret.a));
      return Math.hypot(dx, dy) < raioDoPonto(ponto.papel) + 1;
    });

  // 4. Linhas-guia, com o valor do eixo em foco (o número do eixo que ele cobre sai: o foco é o próprio número).
  const emFocoNoX = new Set<number>();
  const emFocoNoY = new Set<number>();
  const focos: Marca[] = [];
  const textosDoFoco: Marca[] = [];
  for (const guia of visual.guias ?? []) {
    const ponto = visiveis.get(guia.ponto);
    const original = visual.pontos.find((outro) => outro.id === guia.ponto);
    if (!ponto || !original || original.x === undefined || original.y === undefined) continue;
    const destaque = guia.eixo === "x" ? original.x : original.y;
    const texto = numeroParaTela(destaque);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    base.push(
      guia.eixo === "x"
        ? { m: "linha", x1: ponto.x, y1: ponto.y, x2: ponto.x, y2: eixoY, cor: "suave", largura: 2, tracejado: [4, 4] }
        : { m: "linha", x1: ponto.x, y1: ponto.y, x2: eixoX, y2: ponto.y, cor: "suave", largura: 2, tracejado: [4, 4] },
    );
    const retDoFoco: Ret = guia.eixo === "x"
      ? { x: ponto.x - largura / 2 - 3, y: eixoY + 4, l: largura + 6, a: 17 }
      : { x: eixoX - largura - 9, y: ponto.y - 9, l: largura + 6, a: 17 };
    // Um ponto que cobre o número em foco (o ponto está sobre o eixo, a guia tem comprimento zero) tira o foco: o rótulo do ponto já diz o valor.
    if (cobertoPorPonto(retDoFoco)) continue;
    (guia.eixo === "x" ? emFocoNoX : emFocoNoY).add(destaque);
    focos.push({ m: "retangulo", x: retDoFoco.x, y: retDoFoco.y, largura: retDoFoco.l, altura: retDoFoco.a, raio: 4, preenchimento: "focoFundo" });
    textosDoFoco.push(escrever(texto, retDoFoco.x + 3, retDoFoco.y + 13, TAMANHO_DO_NUMERO, 700, "focoTexto"));
    caixa("foco", texto, retDoFoco);
    obstaculos.push(retDoFoco);
  }

  // 5. Segmentos.
  for (const [de, ate] of lados) {
    const a = visiveis.get(de)!;
    const b = visiveis.get(ate)!;
    base.push({ m: "linha", x1: a.x, y1: a.y, x2: b.x, y2: b.y, cor: "segmento", largura: 3 });
  }

  // 6. Números dos eixos: lugar fixo e prioridade; nenhum rótulo de ponto os apaga.
  const numerosDeEixo: Ret[] = [];
  // Os números do eixo x nunca se encostam: o espaço entre eles é a largura do mais largo mais 8 (no mínimo 24).
  const maisLargoDoX = Math.max(0, ...valoresDoX(passoX).map((v) => larguraDoTexto(rotuloDoNumeroX(v), TAMANHO_DO_NUMERO, 700)));
  const noX = passoDosNumeros(xMax - xMin, passoX, ux, Math.max(24, maisLargoDoX + 8));
  const noY = passoDosNumeros(yMax - yMin, passoY, uy, 16);
  const baseDoX = eixoY + 17;
  const numeros: Marca[] = [];
  for (const v of valoresDoX(noX)) {
    if (Math.abs(v) < 1e-9 || emFocoNoX.has(v)) continue;
    const texto = rotuloDoNumeroX(v);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    const ret: Ret = { x: X(v) - largura / 2, y: baseDoX - ALTURA_DO_DIGITO - 0.3, l: largura, a: ALTURA_DO_DIGITO + 0.7 };
    if (cobertoPorPonto(ret)) continue;
    numeros.push(escrever(texto, ret.x, baseDoX, TAMANHO_DO_NUMERO, 700, "suave"));
    numerosDeEixo.push(ret);
    caixa("numero", texto, ret);
  }
  for (const v of multiplos(yMin, yMax, noY)) {
    if (v === 0 || emFocoNoY.has(v)) continue;
    const texto = numeroParaTela(v);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    const ret: Ret = { x: eixoX - 6 - largura, y: Y(v) - ALTURA_DO_DIGITO / 2 - 0.4, l: largura, a: ALTURA_DO_DIGITO + 0.7 };
    if (cobertoPorPonto(ret)) continue;
    numeros.push(escrever(texto, ret.x, Y(v) + ALTURA_DO_DIGITO / 2, TAMANHO_DO_NUMERO, 700, "suave"));
    numerosDeEixo.push(ret);
    caixa("numero", texto, ret);
  }
  // Os traços dos segmentos (amostras de 7 × 7 a cada 5 unidades): o 0 da origem e os rótulos fogem deles.
  const tracos: Ret[] = lados.flatMap(([de, ate]) => {
    const a = visiveis.get(de)!;
    const b = visiveis.get(ate)!;
    const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 5));
    return Array.from({ length: passos + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / passos - 3.5, y: a.y + ((b.y - a.y) * i) / passos - 3.5, l: 7, a: 7 }));
  });
  // O 0 da origem é o único número que escolhe o canto (o mais folgado, longe de número, ponto e segmento, para "−1" e "0" não se
  // lerem "−10"), e só aparece se não houver ponto na origem: com um ponto lá, o rótulo "O (0, 0)" ocupa o lugar do 0. Os cantos são
  // os quatro quadrantes junto da origem, a no máximo 8 unidades dela (`DISTANCIA_MAXIMA_DO_ZERO`): um 0 solto longe do cruzamento
  // se leria como número de eixo e mentiria. Sem canto onde ele não pise em outro número, o 0 some.
  const haPontoNaOrigem = pontos.some((ponto) => Math.hypot(ponto.x - X(0), ponto.y - Y(0)) < 1);
  const larguraDoZero = larguraDoTexto("0", TAMANHO_DO_NUMERO, 700);
  // A caixa do dígito fica a 4,6 do eixo (o halo de 3 não corta o traço do eixo) e a 6,4 do outro: hipotenusa de 7,9.
  const cantos = [
    { x: eixoX + AFASTAMENTO_LATERAL_DO_ZERO, y: eixoY + AFASTAMENTO_VERTICAL_DO_ZERO - 0.4 },
    { x: eixoX - AFASTAMENTO_LATERAL_DO_ZERO - larguraDoZero, y: eixoY + AFASTAMENTO_VERTICAL_DO_ZERO - 0.4 },
    { x: eixoX - AFASTAMENTO_LATERAL_DO_ZERO - larguraDoZero, y: eixoY - AFASTAMENTO_VERTICAL_DO_ZERO - ALTURA_DO_DIGITO - 0.7 - 0.4 },
    { x: eixoX + AFASTAMENTO_LATERAL_DO_ZERO, y: eixoY - AFASTAMENTO_VERTICAL_DO_ZERO - ALTURA_DO_DIGITO - 0.7 - 0.4 },
  ];
  const vizinhos = [...obstaculos, ...numerosDeEixo, ...pontos.map((ponto) => ({ x: ponto.x - 8, y: ponto.y - 8, l: 16, a: 16 }))];
  const doZero = (c: { x: number; y: number }): Ret => ({ x: c.x, y: c.y + 0.4, l: larguraDoZero, a: ALTURA_DO_DIGITO + 0.7 });
  const distancia = (a: Ret, b: Ret) => Math.hypot(Math.max(0, a.x - (b.x + b.l), b.x - (a.x + a.l)), Math.max(0, a.y - (b.y + b.a), b.y - (a.y + a.a)));
  const folgaDoCanto = (c: { x: number; y: number }) => Math.min(...vizinhos.map((outro) => distancia(doZero(c), outro)));
  const numerosQueBatem = (c: { x: number; y: number }) => numerosDeEixo.filter((numero) => bate(doZero(c), numero)).length;
  const tracoQueBate = (c: { x: number; y: number }) => tracos.reduce((soma, traco) => soma + sobreposicao(doZero(c), traco), 0);
  const livres = cantos.filter((c) => !vizinhos.some((outro) => bate(doZero(c), outro)));
  // O canto livre de tudo, sem traço por baixo e mais folgado; senão o que não bate em número nenhum (um ponto só tapa um pedaço
  // da caixa, nunca o dígito) e cobre menos traço; senão nenhum: o 0 some.
  const canto = livres.length > 0
    ? [...livres].sort((a, b) => tracoQueBate(a) - tracoQueBate(b) || folgaDoCanto(b) - folgaDoCanto(a))[0]
    : cantos.filter((c) => numerosQueBatem(c) === 0).sort((a, b) => tracoQueBate(a) - tracoQueBate(b))[0];
  if (!haPontoNaOrigem && canto) {
    const retDoZero = doZero(canto);
    numeros.push(escrever("0", canto.x, canto.y + 10, TAMANHO_DO_NUMERO, 700, "suave"));
    numerosDeEixo.push(retDoZero);
    caixa("numero", "0", retDoZero);
  }

  // Os eixos têm prioridade sobre os rótulos, como já têm sobre os números (spec 15, seção 12): o traço, o halo do texto e um respiro de
  // cada lado, e a ponta da seta com as asas de 5. O rótulo procura outro lado, ou o ponto fica sem letra e as coordenadas vão à legenda.
  const m = MARGEM_DO_ROTULO_AOS_EIXOS;
  obstaculos.push(
    { x: eixoX - 1 - m, y: fimDoEixoY - 8 - m, l: 2 + 2 * m, a: fundo - fimDoEixoY + 8 + m },
    { x: esquerda, y: eixoY - 1 - m, l: fimDoEixoX + 8 + m - esquerda, a: 2 + 2 * m },
    { x: fimDoEixoX - m, y: eixoY - 5 - m, l: 8 + 2 * m, a: 10 + 2 * m },
    { x: eixoX - 5 - m, y: fimDoEixoY - 8 - m, l: 10 + 2 * m, a: 8 + 2 * m },
  );

  // 7. Rótulos dos pontos: quem se move é o rótulo; sem lugar para o inteiro, só o nome, e as coordenadas vão para a legenda.
  const rotulos: Marca[] = [];
  const novos: string[] = [];
  // O rótulo fica dentro do desenho: não passa da borda de baixo da faixa dos números do eixo x (embaixo dela vem a legenda).
  const limites = { esquerda: 2, direita: LARGURA_DO_DESENHO - 2, topo: 2, fundo: fundo + banda };
  for (const ponto of [...pontos].sort((a, b) => Number(b.papel === "especial") - Number(a.papel === "especial"))) {
    if (!ponto.completo) continue;
    const raio = raioDoPonto(ponto.papel);
    // O próprio ponto não é obstáculo do rótulo dele; os outros pontos são. Os segmentos só desempatam.
    const dosOutros = pontos.filter((outro) => outro !== ponto).map(caixaDoPonto);
    const forcado = forcados.has(ponto.id);
    const lugar = acharLugarDoRotulo(ponto.x, ponto.y, raio, ponto.completo, ponto.id, [...obstaculos, ...dosOutros], numerosDeEixo, limites, tracos, forcado);
    if (!forcado && lugar?.texto !== ponto.completo) novos.push(ponto.id);
    if (!lugar) continue;
    obstaculos.push({ x: lugar.x, y: lugar.y, l: lugar.l, a: lugar.a });
    caixa("rotulo", lugar.texto, lugar);
    rotulos.push(escrever(lugar.texto, lugar.x, lugar.y + 11.5, TAMANHO_DO_ROTULO, 800, COR_DO_ROTULO[ponto.papel]));
  }
  rotulos.sort((a, b) => (a.m === "texto" && b.m === "texto" ? a.cor.localeCompare(b.cor) : 0));

  // 8. Pontos, e a legenda embaixo.
  const marcasDosPontos: Marca[] = [];
  for (const ponto of pontos) {
    if (ponto.papel === "especial") marcasDosPontos.push({ m: "caminho", cmds: losango(ponto.x, ponto.y, raioDoPonto("especial")), preenchimento: "especial", borda: "branco", larguraDaBorda: 2 });
    else marcasDosPontos.push({ m: "circulo", cx: ponto.x, cy: ponto.y, raio: raioDoPonto(ponto.papel), preenchimento: ponto.papel === "resposta" ? "resposta" : "dado", borda: "branco", larguraDaBorda: 2 });
  }
  let marcasDaLegenda: Marca[];
  let altura: number;
  let viavel = true;
  if (lateral && aoLadoDeAntes.largura > 0) {
    // Ao lado do gráfico, de cima para baixo, na coluna depois da seta do eixo x.
    const aoLado = legendaLateral(legendaPrevia.itens, legendaPrevia.escondidos, emLegenda, direita + DECORACAO_DA_DIREITA + 8, topo, degrau.legenda);
    marcasDaLegenda = aoLado.marcas;
    altura = fundo + banda + 8;
    viavel = topo + aoLado.altura <= altura + 1e-6 && unidade > 0;
  } else {
    const embaixo = legenda(legendaPrevia.itens, legendaPrevia.escondidos, emLegenda, fundo + banda + 4, degrau.legenda);
    marcasDaLegenda = embaixo.marcas;
    altura = fundo + banda + (embaixo.altura ? embaixo.altura + 8 : 0) + 8;
    viavel = unidade > 0;
  }

  const marcas = [...(faixa?.marcas ?? []), ...base, ...focos, ...textos, ...numeros, ...textosDoFoco, ...rotulos, ...marcasDosPontos, ...marcasDaLegenda];
  // A faixa de fórmulas que não cabe na largura (mais de 296) tira o desenho inteiro: `naoCabe`, e o cliente mostra o `alt`.
  return { desenho: desenhoDe(marcas, altura, visual.alt, { caixas }), unidade: faixa && !faixa.cabe ? 0 : unidade, viavel: viavel && (!faixa || faixa.cabe), novos };
}

/* ----- Reta numérica ----- */

const RETA = { inicio: 14, esquerda: 24, direita: 280 };

export function desenharRetaNumerica(visual: VisualRetaNumerica, contexto: ContextoDoDesenho, opcoes: OpcoesDaFigura = {}): Desenho {
  // A janela da reta, como a do plano: sem o procurado ainda escondido, ela é a dos pontos que aparecem (a guardada o entregaria).
  const revelando = contexto.tipo === "retorno" || (contexto.tipo === "passo" && contexto.ultimo);
  const [de, ate] = revelando || visual.intervalos?.length
    ? [visual.de, visual.ate]
    : janelaDosDados(visual.pontos.flatMap((ponto) => (papelNoContexto(ponto.papel, contexto) === "procurado" || ponto.valor === undefined ? [] : [ponto.valor])), false);
  const unidade = (RETA.direita - RETA.esquerda) / (ate - de);
  const X = (v: number) => RETA.esquerda + (v - de) * unidade;
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
  const passo = passoDosNumeros(ate - de, passoDaGrade(ate - de), unidade, 24);
  const ticks = multiplos(de, ate, passo);
  for (const v of ticks) marcas.push({ m: "linha", x1: X(v), y1: y0 - 5, x2: X(v), y2: y0 + 5, cor: "eixo", largura: 2 });
  const numeros: Marca[] = [];
  const caixas: Desenho["caixas"] = [];
  for (const v of ticks) {
    const texto = numeroParaTela(v);
    const largura = larguraDoTexto(texto, TAMANHO_DO_NUMERO, 700);
    numeros.push({ m: "texto", texto, x: X(v) - largura / 2, y: y0 + 24, tamanho: TAMANHO_DO_NUMERO, peso: 700, italico: false, cor: "suave", halo: true });
    caixas.push({ tipo: "numero", texto, x: r2(X(v) - largura / 2), y: r2(y0 + 14), largura: r2(largura), altura: 13 });
  }
  numeros.push({ m: "texto", texto: "x", x: fimDaReta + 4, y: y0 + 24, tamanho: TAMANHO_DO_NOME_DO_EIXO, peso: 700, italico: true, cor: "suave", halo: true });
  caixas.push({ tipo: "eixo", texto: "x", x: r2(fimDaReta + 4), y: r2(y0 + 13), largura: r2(larguraDoTexto("x", TAMANHO_DO_NOME_DO_EIXO, 700)), altura: 15 });

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

  // Os textos (com halo) por cima da reta; depois os pontos.
  const nomes: Marca[] = [];
  for (const ponto of visiveis) {
    if (!ponto.rotulo) continue;
    const linha = linhaDoRotulo.get(ponto.id) ?? 0;
    const { l, a } = caixaDoRotulo(ponto.id);
    const base = y0 - 18 - linha * 20 - (ponto.papel === "especial" ? 3 : 0);
    nomes.push({ m: "texto", texto: ponto.id, x: ponto.x - l / 2, y: base, tamanho: TAMANHO_DO_ROTULO, peso: 800, italico: false, cor: COR_DO_ROTULO[ponto.papel], halo: true });
    caixas.push({ tipo: "rotulo", texto: ponto.id, x: r2(ponto.x - l / 2), y: r2(base - 11.5), largura: r2(l), altura: a });
  }
  nomes.sort((a, b) => (a.m === "texto" && b.m === "texto" ? a.cor.localeCompare(b.cor) : 0));
  marcas.push(...numeros, ...nomes);
  for (const ponto of visiveis) {
    if (ponto.papel === "especial") marcas.push({ m: "caminho", cmds: losango(ponto.x, y0, 9), preenchimento: "especial", borda: "branco", larguraDaBorda: 2 });
    else marcas.push({ m: "circulo", cx: ponto.x, cy: y0, raio: ponto.papel === "resposta" ? 8.5 : 7, preenchimento: ponto.papel === "resposta" ? "resposta" : "dado", borda: "branco", larguraDaBorda: 2 });
  }

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
  // A reta tem 140 de altura, centrada; se o cliente dá menos, ela desce até o que o conteúdo pede, e abaixo disso sai `naoCabe`.
  const altura = Math.max(Math.min(140, opcoes.alturaMaxima ?? 140), conteudo + 8);
  const deslocamento = Math.max(0, (altura - (conteudo + 8)) / 2);
  const desenho = desenhoDe(deslocamento ? deslocar(marcas, 0, deslocamento) : marcas, altura, visual.alt, { caixas: caixas.map((caixa) => ({ ...caixa, y: r2(caixa.y + deslocamento) })) });
  return opcoes.alturaMaxima !== undefined && altura > opcoes.alturaMaxima + 1e-6 ? { ...desenho, naoCabe: true } : desenho;
}

/* ----- Entrada geral, composição e SVG ----- */

/**
 * O desenho de um visual no contexto dado; `null` só para a fórmula que não lê ou, na faixa do PNG, que não cabe. A figura com ponto procurado que traz
 * `alturaMinimaComRetorno` (o servidor a põe no que vai pela rede) só desenha, no enunciado e no retorno, quando a caixa dá para os DOIS: se um não cabe, nenhum
 * desenha (`naoCabe` nos dois, e o cliente mostra o `alt`), para a figura não virar uma linha de texto no acerto e as opções não pularem.
 */
export function desenharVisual(visual: Visual, contexto: ContextoDoDesenho, opcoes: OpcoesDaFormula & OpcoesDaFigura = {}): Desenho | null {
  const desenho = desenharSemOPar(visual, contexto, opcoes);
  if (!desenho || desenho.naoCabe || visual.tipo === "formula" || contexto.tipo === "passo") return desenho;
  const exigida = visual.alturaMinimaComRetorno;
  if (exigida === undefined) return desenho;
  return (opcoes.alturaMaxima ?? ALTURA_PADRAO_DA_FIGURA) < exigida - 1e-9 ? { ...desenho, naoCabe: true } : desenho;
}

function desenharSemOPar(visual: Visual, contexto: ContextoDoDesenho, opcoes: OpcoesDaFormula & OpcoesDaFigura): Desenho | null {
  switch (visual.tipo) {
    case "plano":
      return desenharPlano(visual, contexto, opcoes);
    case "reta_numerica":
      return desenharRetaNumerica(visual, contexto, opcoes);
    case "funcao":
      return desenharFuncao(visual, contexto, opcoes);
    case "formula": {
      const lida = lerFormula(visual.latex);
      return lida.ok ? desenharFormula(lida.arvore, opcoes) : null;
    }
  }
}

const CORES_DAS_CURVAS: readonly PapelDeCor[] = ["segmento", "especialTexto", "texto"];

/**
 * O gráfico de função (spec 15, seção 15): o plano com a faixa de fórmulas em cima, a curva recortada e os destaques sobre ela. A janela é a conta
 * da seção 2 (`janelaDaFuncao`); no seno e no cosseno o x se marca em π/2 e as escalas são independentes. Quando o exercício pergunta um ponto da
 * curva (há um ponto procurado que ainda não pode aparecer), a curva NÃO é desenhada: o enunciado mostra a fórmula e os pontos dados, e o procurado
 * fica na legenda ("V = ?"); no retorno e no último passo a figura se reenquadra, com a curva e o procurado já como resposta.
 */
export function desenharFuncao(visual: VisualFuncao, contexto: ContextoDoDesenho, opcoes: OpcoesDaFigura = {}): Desenho {
  const pontos = visual.pontos ?? [];
  const escondido = (ponto: (typeof pontos)[number]): boolean => papelNoContexto(ponto.papel, contexto) === "procurado";
  const aparecem = pontos.filter((ponto) => !escondido(ponto) && ponto.x !== undefined && ponto.y !== undefined);
  const mostrarCurva = !pontos.some(escondido);
  const lidas = visual.curvas.flatMap((curva, i) => {
    const lida = lerExpressaoDaFuncao(curva.latex);
    return lida.ok ? [{ curva, modelo: lida.modelo, cor: CORES_DAS_CURVAS[i] ?? "texto", tracejada: i === 2 }] : [];
  });
  const janela = janelaDaFuncao(lidas.map(({ curva, modelo }) => ({ modelo, de: curva.de, ate: curva.ate })), aparecem.map((ponto) => [ponto.x as number, ponto.y as number] as const), mostrarCurva);
  const trigonometrica = janela.trigonometrica;
  const extra: ExtraDaFuncao = {
    janela: { x: janela.x, y: janela.y },
    independentes: trigonometrica,
    ...(trigonometrica ? { passoX: Math.PI / 2, rotuloDoNumeroX: numeroComPiParaTela } : {}),
    curvas: lidas.map(({ curva, modelo, cor, tracejada }, i) => ({
      nome: curva.nome, latex: curva.latex, cor, tracejada, modelo, de: janela.dominios[i][0], ate: janela.dominios[i][1], aparece: mostrarCurva,
    })),
  };
  // O plano que o motor entende: os pontos com as coordenadas que o contexto permite (o procurado do enunciado público nem as tem).
  const plano: VisualPlano = {
    tipo: "plano", alt: visual.alt, x: janela.x, y: janela.y,
    pontos: pontos.map((ponto) => ({ id: ponto.id, papel: ponto.papel, ...(ponto.x !== undefined ? { x: ponto.x } : {}), ...(ponto.y !== undefined ? { y: ponto.y } : {}), ...(ponto.rotulo === false ? { rotulo: false } : {}) })),
  };
  return desenharPlano(plano, contexto, opcoes, { ...extra, curvas: extra.curvas });
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
  return { ...desenho, altura: r2(minimo), primitivas: desenho.primitivas.map((primitiva) => moverPrimitiva(primitiva, dy)), caixas: desenho.caixas.map((caixa) => ({ ...caixa, y: r2(caixa.y + dy) })) };
}

/** Empilha desenhos de mesma largura (a faixa da fórmula em cima, a figura embaixo), com uma linha de 1 ponto entre eles. */
export function comporDesenhos(partes: readonly Desenho[], opcoes: { separador?: boolean } = {}): Desenho {
  const primitivas: Primitiva[] = [];
  const caixas: Desenho["caixas"] = [];
  let y = 0;
  partes.forEach((parte, i) => {
    if (i > 0 && opcoes.separador) primitivas.push({ tipo: "linha", x1: 0, y1: r2(y), x2: LARGURA_DO_DESENHO, y2: r2(y), cor: "separador", largura: 1 });
    primitivas.push(...parte.primitivas.map((primitiva) => moverPrimitiva(primitiva, y)));
    const dy = y;
    caixas.push(...parte.caixas.map((caixa) => ({ ...caixa, y: r2(caixa.y + dy) })));
    y += parte.altura;
  });
  return {
    largura: LARGURA_DO_DESENHO,
    altura: r2(y),
    primitivas,
    descricao: partes.map((parte) => parte.descricao).join(". "),
    menorTexto: Math.min(...partes.map((parte) => parte.menorTexto)),
    textos: partes.flatMap((parte) => parte.textos),
    caixas,
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
