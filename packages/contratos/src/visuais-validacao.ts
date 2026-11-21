import { lerFormula, percorrerFormula, type NoFormula } from "./formula";
import { marcarFormulasSoltas, normalizarTextoComFormulas } from "./formula-no-texto";
import { conferirConta, mesmoValor, valorDaOpcao } from "./formula-conta";
import { acharVazamento, alvosDoSuaVez, chaveDoValor, letrasDoTexto, lerNumero, motivoDoVazamento, numerosDoTexto } from "./resolucao-vazamento";
import { desenharVisual } from "./motor-visuais";
import { comDescricaoDaResposta } from "./visuais-descricao";
import {
  LIMITES_VISUAIS,
  PAPEIS_PONTO,
  TETO_DE_PRIMITIVAS,
  janelaDosDados,
  type Derivado,
  type IntervaloDaReta,
  type OpcaoCorrigida,
  type PapelPonto,
  type PassoGuardado,
  type PontoDaReta,
  type PontoDoPlano,
  type ResolucaoGuardada,
  type TentativaGuardada,
  type Visual,
  type VisualFigura,
  type VisualFormula,
  type VisualPlano,
  type VisualRetaNumerica,
} from "./visuais";

/*
 * Validador tolerante dos visuais e da resolução. A IA devolve dados soltos (`unknown`); aqui saem os dados limpos ou nada:
 * - visual inválido some (a lição segue, sem espaço vazio): `normalizarVisual` devolve `null`;
 * - pedaço solto (um segmento para um ponto que não existe) é descartado e o visual fica;
 * - a resolução é tudo ou nada (passos, "Sua vez" e conta): se algo falha, a lição fica com o exemplo em texto;
 * - o servidor ajusta o que dá (intervalo dos eixos, pontos derivados, no máximo 8 rótulos) e confere o que não se ajusta
 *   (coordenada fora do intervalo, mais peças que o teto, nome repetido, fórmula fora da lista, `alt` que entrega a resposta).
 * Nada daqui lança por causa de dado ruim.
 */

class Recusa extends Error {}

function recusar(motivo: string): never {
  throw new Recusa(motivo);
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

const ausente = (valor: unknown): boolean => valor === undefined || valor === null;

/** Número finito, de até 1000 em módulo e com até duas casas (para o rótulo "A (1,5; 2)" ser exato). */
function coordenada(valor: unknown, onde: string): number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return recusar(`${onde}: não é um número`);
  if (Math.abs(valor) > LIMITES_VISUAIS.coordenadaMaxima) return recusar(`${onde}: maior que ${LIMITES_VISUAIS.coordenadaMaxima}`);
  const centesimos = Math.round(valor * 100);
  if (Math.abs(valor * 100 - centesimos) > 1e-7) return recusar(`${onde}: mais de duas casas decimais`);
  return centesimos / 100;
}

function cortar(texto: string, maximo: number): string {
  if (texto.length <= maximo) return texto;
  const corte = texto.slice(0, maximo - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > maximo * 0.5 ? corte.slice(0, espaco) : corte).replace(/[\s,;:.-]+$/, "")}…`;
}

/**
 * Texto simples, sem caractere de controle e sem LaTeX cru. Com `manterMarcas`, a fórmula entre cifrões que vale (`$x_G = 1$`,
 * `$\\frac{x_A + x_B}{2}$`) fica, na forma canônica, para o cliente desenhá-la dentro da frase (inteira, ou em peças quando não
 * cabe em linha), e os tokens soltos (`x_A`, `b^2`) também ganham a marca: este texto é da resolução, que só existe em lição de
 * matemática. A que não vale (comando de fora da lista) cai em texto linear, e o texto nunca é recusado por isso. Sem `manterMarcas`
 * (legenda, `alt`, nome do passo), toda fórmula vira texto linear. LaTeX solto fora das marcas também vira texto linear.
 */
function textoSimples(valor: unknown, manterMarcas = false): string | null {
  if (typeof valor !== "string" || /[\u0000-\u001f]/.test(valor.replace(/\s/g, " "))) return null;
  const limpo = valor.replace(/\s+/g, " ").trim();
  const texto = manterMarcas ? marcarFormulasSoltas(limpo) : normalizarTextoComFormulas(limpo, false);
  return texto ? texto : null;
}

function textoAte(valor: unknown, maximo: number, onde: string, manterMarcas = false): string {
  const texto = textoSimples(valor, manterMarcas);
  if (!texto) return recusar(`${onde}: texto ausente ou com LaTeX solto`);
  if (texto.length > maximo) return recusar(`${onde}: mais de ${maximo} caracteres`);
  return texto;
}

/** Como `textoAte`, mas um texto até `tolerancia` vezes maior é cortado em vez de recusado (legenda, nome do passo). */
function textoCortado(valor: unknown, maximo: number, onde: string, tolerancia = 2): string {
  const texto = textoSimples(valor);
  if (!texto) return recusar(`${onde}: texto ausente ou com LaTeX solto`);
  if (texto.length > maximo * tolerancia) return recusar(`${onde}: texto longo demais`);
  return cortar(texto, maximo);
}

/* ----- Pontos ----- */

const ID_DO_PONTO = /^[A-Za-z][A-Za-z0-9']{0,2}$/;

interface PontoLido {
  id: string;
  papel: PapelPonto;
  rotulo?: boolean;
  derivado?: Derivado;
  /** `[x, y]` no plano, `[valor]` na reta: sempre preenchido depois de calcular os derivados. */
  coordenadas?: number[];
}

function lerDerivado(bruto: unknown, reta: boolean): Derivado | undefined {
  if (ausente(bruto)) return undefined;
  if (!objeto(bruto)) return recusar("derivado: formato inválido");
  const permitidos = reta ? ["baricentro", "ponto_medio", "media"] : ["baricentro", "ponto_medio"];
  const tipo = bruto.tipo;
  if (typeof tipo !== "string" || !permitidos.includes(tipo)) return recusar(`derivado: tipo ${String(tipo)} não existe${reta ? "" : " no plano"}`);
  const de = bruto.de;
  if (!Array.isArray(de) || !de.every((id) => typeof id === "string" && ID_DO_PONTO.test(id)) || new Set(de).size !== de.length) {
    return recusar("derivado: lista de pontos inválida");
  }
  const esperado = tipo === "baricentro" ? [3, 3] : tipo === "ponto_medio" ? [2, 2] : [2, 6];
  if (de.length < esperado[0] || de.length > esperado[1]) return recusar(`derivado: ${tipo} precisa de ${esperado[0] === esperado[1] ? esperado[0] : `${esperado[0]} a ${esperado[1]}`} pontos`);
  return { tipo: tipo as Derivado["tipo"], de: de as string[] };
}

function lerPontos(brutos: unknown, reta: boolean, maximo: number): PontoLido[] {
  if (!Array.isArray(brutos) || brutos.length < 1) return recusar("pontos: lista vazia");
  if (brutos.length > maximo) return recusar(`pontos: mais de ${maximo}`);
  const pontos: PontoLido[] = [];
  for (const bruto of brutos) {
    if (!objeto(bruto)) return recusar("ponto: formato inválido");
    const { id } = bruto;
    if (typeof id !== "string" || !ID_DO_PONTO.test(id)) return recusar(`ponto: nome ${String(id)} inválido (até 3 caracteres)`);
    if (pontos.some((ponto) => ponto.id === id)) return recusar(`ponto: nome ${id} repetido`);
    const derivado = lerDerivado(bruto.derivado, reta);
    const papelBruto = ausente(bruto.papel) ? (derivado ? "especial" : "dado") : bruto.papel;
    if (typeof papelBruto !== "string" || !(PAPEIS_PONTO as readonly string[]).includes(papelBruto)) return recusar(`ponto ${id}: papel ${String(papelBruto)} não existe`);
    if (!ausente(bruto.rotulo) && typeof bruto.rotulo !== "boolean") return recusar(`ponto ${id}: rotulo precisa ser verdadeiro ou falso`);
    // Baricentro, ponto médio e média são pontos de destaque (losango roxo, "baricentro" na legenda) mesmo quando o enunciado os informa:
    // a IA que os marca como `dado` (bolinha azul, "dados") é corrigida aqui, não recusada. O procurado e a resposta ficam como vieram.
    const papel = derivado && papelBruto === "dado" ? "especial" : papelBruto;
    const ponto: PontoLido = { id, papel: papel as PapelPonto, ...(typeof bruto.rotulo === "boolean" ? { rotulo: bruto.rotulo } : {}), ...(derivado ? { derivado } : {}) };
    if (!derivado) {
      ponto.coordenadas = reta
        ? [coordenada(bruto.valor, `ponto ${id}: valor`)]
        : [coordenada(bruto.x, `ponto ${id}: x`), coordenada(bruto.y, `ponto ${id}: y`)];
    }
    pontos.push(ponto);
  }
  for (const ponto of pontos) {
    if (!ponto.derivado) continue;
    const dimensao = reta ? 1 : 2;
    const somas = new Array<number>(dimensao).fill(0);
    for (const origem of ponto.derivado.de) {
      const fonte = pontos.find((outro) => outro.id === origem);
      if (!fonte || fonte.derivado || !fonte.coordenadas) return recusar(`ponto ${ponto.id}: ${origem} não existe ou também é derivado`);
      fonte.coordenadas.forEach((valor, eixo) => {
        somas[eixo] += Math.round(valor * 100);
      });
    }
    const total = ponto.derivado.de.length;
    if (somas.some((soma) => soma % total !== 0)) return recusar(`ponto ${ponto.id}: o ${ponto.derivado.tipo} não cai em duas casas decimais`);
    ponto.coordenadas = somas.map((soma) => soma / total / 100);
  }
  if (!pontos.some((ponto) => ponto.papel === "dado" || ponto.papel === "especial")) return recusar("pontos: nenhum ponto dado ou especial para aparecer");
  // No plano, dois pontos no mesmo lugar não se leem: quando o procurado é revelado ele cai em cima de outro (o terceiro vértice C do
  // baricentro G que é o ponto médio de AB cai em G, e o triângulo é achatado). A figura é recusada (a lição fica); na reta numérica
  // o exercício de abscissas do dono (3, 5 e G em 4, C em 4) tem C e G no mesmo valor e se desenha bem, empilhando os rótulos.
  if (!reta) {
    const ocupados = new Map<string, PontoLido>();
    for (const ponto of pontos) {
      const [x, y] = ponto.coordenadas ?? [];
      if (x === undefined || y === undefined) continue;
      const outro = ocupados.get(`${x},${y}`);
      if (outro) return recusar(`pontos: ${ponto.id} cai em cima de ${outro.id}, os dois em (${x}, ${y}): escolha números em que o resultado não coincide com outro ponto`);
      ocupados.set(`${x},${y}`, ponto);
    }
  }
  return pontos;
}

/** No máximo 8 rótulos: quem passa do limite perde o rótulo, os `dado` por último na ordem em que vieram. */
function limitarRotulos(pontos: PontoLido[]): void {
  const prioridade: Record<PapelPonto, number> = { especial: 0, resposta: 1, procurado: 2, dado: 3 };
  const rotulados = pontos.filter((ponto) => ponto.rotulo !== false);
  const sobra = rotulados.length - LIMITES_VISUAIS.pontosComRotulo;
  if (sobra <= 0) return;
  rotulados
    .map((ponto, ordem) => ({ ponto, ordem }))
    .sort((a, b) => prioridade[b.ponto.papel] - prioridade[a.ponto.papel] || b.ordem - a.ordem)
    .slice(0, sobra)
    .forEach(({ ponto }) => {
      ponto.rotulo = false;
    });
}

const SEM_ARRAY = Symbol("sem-lista");

function listaOpcional(bruto: unknown, onde: string, maximo: number): unknown[] | typeof SEM_ARRAY {
  if (ausente(bruto)) return SEM_ARRAY;
  if (!Array.isArray(bruto)) return recusar(`${onde}: não é uma lista`);
  if (bruto.length > maximo) return recusar(`${onde}: mais de ${maximo}`);
  return bruto;
}

/* ----- Intervalo dos eixos ----- */

function eixoLido(bruto: unknown, onde: string): [number, number] | undefined {
  if (ausente(bruto)) return undefined;
  if (!Array.isArray(bruto) || bruto.length !== 2) return recusar(`${onde}: precisa de dois números`);
  const minimo = coordenada(bruto[0], `${onde}[0]`);
  const maximo = coordenada(bruto[1], `${onde}[1]`);
  if (minimo >= maximo) return recusar(`${onde}: o menor tem de vir primeiro`);
  return [minimo, maximo];
}

/** Ajusta o intervalo aos valores: com margem, em inteiros, e no mínimo 4 de largura. */
function ajustarEixo(valores: readonly number[], incluirOrigem: boolean, margemRelativa: number): [number, number] {
  const baixo = Math.min(...valores, ...(incluirOrigem ? [0] : []));
  const alto = Math.max(...valores, ...(incluirOrigem ? [0] : []));
  const margem = Math.max(1, Math.ceil((alto - baixo) * margemRelativa));
  let minimo = Math.floor(baixo - margem);
  let maximo = Math.ceil(alto + margem);
  while (maximo - minimo < 4) {
    minimo -= 1;
    maximo += 1;
  }
  return [minimo, maximo];
}

function dentro(valor: number, [minimo, maximo]: readonly [number, number], onde: string): void {
  if (valor < minimo || valor > maximo) recusar(`${onde}: fora do intervalo ${minimo} a ${maximo}`);
}

/* ----- A resposta não pode vazar pela legenda ----- */

interface Oculto {
  id: string;
  valores: number[];
}

function vazaResposta(alt: string, ocultos: readonly Oculto[]): boolean {
  if (ocultos.length === 0) return false;
  const texto = alt.replace(/[−–]/g, "-");
  const numero = (valor: string) => Number(valor.replace(",", "."));
  for (const par of texto.matchAll(/\(\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g)) {
    const [a, b] = [numero(par[1]), numero(par[2])];
    if (ocultos.some((oculto) => oculto.valores.length === 2 && oculto.valores[0] === a && oculto.valores[1] === b)) return true;
  }
  for (const oculto of ocultos) {
    const id = oculto.id.replace(/[^A-Za-z0-9]/g, "\\$&");
    const padrao = new RegExp(`(?:^|[^A-Za-z0-9'])([xy])?\\s*_?\\{?${id}\\}?(?:\\s*(?:=|:|\\()\\s*|\\s+(?:em|vale|é|está em|fica em)\\s+)(-?\\d+(?:[.,]\\d+)?)`, "gi");
    for (const achado of texto.matchAll(padrao)) {
      const valor = numero(achado[2]);
      const eixo = achado[1]?.toLowerCase();
      if (oculto.valores.length === 1 && valor === oculto.valores[0]) return true;
      if (oculto.valores.length === 2 && ((eixo === "x" && valor === oculto.valores[0]) || (eixo === "y" && valor === oculto.valores[1]))) return true;
    }
  }
  return false;
}

/* ----- Figuras ----- */

/** Eixos e intervalo que o passo seguinte herda (spec 15: o desenho troca no mesmo lugar, sem pular de escala). */
export type Quadro =
  | { tipo: "plano"; x: [number, number]; y: [number, number] }
  | { tipo: "reta_numerica"; de: number; ate: number };

export interface OpcoesDoVisual {
  /** O visual pode mostrar a resposta (último passo da resolução): libera o `alt` e a fórmula com `\resposta`. */
  revela?: boolean;
  /** Os eixos do visual anterior: valem por cima do que a IA mandou, e um ponto fora deles recusa o visual. */
  quadro?: Quadro;
}

function conferirAlt(alt: string, ocultos: Oculto[], revela: boolean | undefined): void {
  if (!revela && vazaResposta(alt, ocultos)) recusar("alt: entrega a posição do ponto procurado");
}

function normalizarPlano(bruto: Record<string, unknown>, opcoes: OpcoesDoVisual): VisualPlano {
  const alt = textoCortado(bruto.alt, LIMITES_VISUAIS.alt, "alt", 1.5);
  const lidos = lerPontos(bruto.pontos, false, LIMITES_VISUAIS.pontos);
  limitarRotulos(lidos);
  const xs = lidos.map((ponto) => ponto.coordenadas![0]);
  const ys = lidos.map((ponto) => ponto.coordenadas![1]);
  let x: [number, number];
  let y: [number, number];
  if (opcoes.quadro) {
    if (opcoes.quadro.tipo !== "plano") return recusar("o visual anterior não é um plano");
    ({ x, y } = opcoes.quadro);
  } else {
    // A janela é a dos dados com uma unidade de folga, mais a origem (spec 15, seção 11): a que a IA mandar não vale, porque unidade
    // vazia encolhe o gráfico e a grade vira risco. Os passos da resolução herdam a do problema, ajustada a todos eles.
    x = janelaDosDados(xs, true);
    y = janelaDosDados(ys, true);
  }
  lidos.forEach((ponto) => {
    dentro(ponto.coordenadas![0], x, `ponto ${ponto.id}: x`);
    dentro(ponto.coordenadas![1], y, `ponto ${ponto.id}: y`);
  });
  const ids = new Set(lidos.map((ponto) => ponto.id));

  const segmentosBrutos = listaOpcional(bruto.segmentos, "segmentos", LIMITES_VISUAIS.segmentos);
  const segmentos: { de: string; ate: string }[] = [];
  if (segmentosBrutos !== SEM_ARRAY) {
    for (const item of segmentosBrutos) {
      const [de, ate] = Array.isArray(item) ? item : objeto(item) ? [item.de, item.ate] : [];
      if (typeof de !== "string" || typeof ate !== "string" || de === ate || !ids.has(de) || !ids.has(ate)) continue;
      if (segmentos.some((outro) => (outro.de === de && outro.ate === ate) || (outro.de === ate && outro.ate === de))) continue;
      segmentos.push({ de, ate });
    }
  }

  const poligonosBrutos = listaOpcional(bruto.poligonos, "poligonos", LIMITES_VISUAIS.poligonos);
  const poligonos: { pontos: string[] }[] = [];
  if (poligonosBrutos !== SEM_ARRAY) {
    for (const item of poligonosBrutos) {
      const lista = Array.isArray(item) ? item : objeto(item) ? item.pontos : undefined;
      if (!Array.isArray(lista) || !lista.every((id) => typeof id === "string" && ids.has(id)) || new Set(lista).size !== lista.length) continue;
      if (lista.length < 3 || lista.length > LIMITES_VISUAIS.verticesDoPoligono) continue;
      poligonos.push({ pontos: lista as string[] });
    }
  }

  const guiasBrutas = listaOpcional(bruto.guias, "guias", LIMITES_VISUAIS.guias);
  const guias: { ponto: string; eixo: "x" | "y" }[] = [];
  if (guiasBrutas !== SEM_ARRAY) {
    for (const item of guiasBrutas) {
      if (!objeto(item) || typeof item.ponto !== "string" || !ids.has(item.ponto) || (item.eixo !== "x" && item.eixo !== "y")) continue;
      if (guias.some((outra) => outra.ponto === item.ponto && outra.eixo === item.eixo)) continue;
      guias.push({ ponto: item.ponto, eixo: item.eixo });
    }
  }

  const ocultos = lidos
    .filter((ponto) => ponto.papel === "procurado" || ponto.papel === "resposta")
    .map((ponto) => ({ id: ponto.id, valores: ponto.coordenadas! }));
  conferirAlt(alt, ocultos, opcoes.revela);

  const pontos: PontoDoPlano[] = lidos.map((ponto) => ({
    id: ponto.id,
    papel: ponto.papel,
    x: ponto.coordenadas![0],
    y: ponto.coordenadas![1],
    ...(ponto.derivado ? { derivado: ponto.derivado } : {}),
    ...(ponto.rotulo === false ? { rotulo: false } : {}),
  }));
  return {
    tipo: "plano",
    alt,
    x,
    y,
    pontos,
    ...(segmentos.length ? { segmentos } : {}),
    ...(poligonos.length ? { poligonos } : {}),
    ...(guias.length ? { guias } : {}),
  };
}

function lerIntervalos(bruto: unknown): IntervaloDaReta[] {
  const lista = listaOpcional(bruto, "intervalos", LIMITES_VISUAIS.intervalos);
  if (lista === SEM_ARRAY) return [];
  return lista.map((item, posicao) => {
    if (!objeto(item)) return recusar(`intervalo ${posicao + 1}: formato inválido`);
    const de = ausente(item.de) ? undefined : coordenada(item.de, `intervalo ${posicao + 1}: de`);
    const ate = ausente(item.ate) ? undefined : coordenada(item.ate, `intervalo ${posicao + 1}: ate`);
    if (de === undefined && ate === undefined) return recusar(`intervalo ${posicao + 1}: sem nenhum extremo`);
    if (de !== undefined && ate !== undefined && de >= ate) return recusar(`intervalo ${posicao + 1}: o menor tem de vir primeiro`);
    for (const aberto of [item.deAberto, item.ateAberto]) {
      if (!ausente(aberto) && typeof aberto !== "boolean") return recusar(`intervalo ${posicao + 1}: aberto precisa ser verdadeiro ou falso`);
    }
    return {
      ...(de !== undefined ? { de } : {}),
      ...(ate !== undefined ? { ate } : {}),
      ...(item.deAberto === true ? { deAberto: true } : {}),
      ...(item.ateAberto === true ? { ateAberto: true } : {}),
    };
  });
}

function normalizarReta(bruto: Record<string, unknown>, opcoes: OpcoesDoVisual): VisualRetaNumerica {
  const alt = textoCortado(bruto.alt, LIMITES_VISUAIS.alt, "alt", 1.5);
  const lidos = lerPontos(bruto.pontos, true, LIMITES_VISUAIS.pontosDaReta);
  limitarRotulos(lidos);
  const intervalos = lerIntervalos(bruto.intervalos);
  const valores = lidos.map((ponto) => ponto.coordenadas![0]);
  const extremos = intervalos.flatMap((intervalo) => [intervalo.de, intervalo.ate].filter((v): v is number => v !== undefined));
  let de: number;
  let ate: number;
  if (opcoes.quadro) {
    if (opcoes.quadro.tipo !== "reta_numerica") return recusar("o visual anterior não é uma reta numérica");
    ({ de, ate } = opcoes.quadro);
  } else {
    const dado = eixoLido(ausente(bruto.de) && ausente(bruto.ate) ? undefined : [bruto.de, bruto.ate], "de/ate");
    [de, ate] = dado ?? ajustarEixo([...valores, ...extremos], false, 0.15);
  }
  const quadro: [number, number] = [de, ate];
  lidos.forEach((ponto) => dentro(ponto.coordenadas![0], quadro, `ponto ${ponto.id}: valor`));
  extremos.forEach((extremo) => dentro(extremo, quadro, "intervalo"));
  const ocultos = lidos
    .filter((ponto) => ponto.papel === "procurado" || ponto.papel === "resposta")
    .map((ponto) => ({ id: ponto.id, valores: ponto.coordenadas! }));
  conferirAlt(alt, ocultos, opcoes.revela);
  const pontos: PontoDaReta[] = lidos.map((ponto) => ({
    id: ponto.id,
    papel: ponto.papel,
    valor: ponto.coordenadas![0],
    ...(ponto.derivado ? { derivado: ponto.derivado } : {}),
    ...(ponto.rotulo === false ? { rotulo: false } : {}),
  }));
  return { tipo: "reta_numerica", alt, de, ate, pontos, ...(intervalos.length ? { intervalos } : {}) };
}

function temDestaque(no: NoFormula, papel: "foco" | "procurado" | "resposta"): boolean {
  let achou = false;
  percorrerFormula(no, (visitado) => {
    if (visitado.tipo === "destaque" && visitado.papel === papel) achou = true;
  });
  return achou;
}

function normalizarFormula(bruto: Record<string, unknown>, opcoes: OpcoesDoVisual): VisualFormula {
  const lida = lerFormula(ausente(bruto.latex) ? bruto.formula : bruto.latex);
  if (!lida.ok) return recusar(`fórmula: ${lida.erro}`);
  if (!opcoes.revela && temDestaque(lida.arvore, "resposta")) return recusar("fórmula: o destaque \\resposta só vale no último passo");
  let alt: string | undefined;
  if (!ausente(bruto.alt)) {
    try {
      alt = textoCortado(bruto.alt, LIMITES_VISUAIS.altDaFormula, "alt", 2);
    } catch (erro) {
      if (!(erro instanceof Recusa)) throw erro;
    }
  }
  return { tipo: "formula", latex: lida.canonica, ...(alt ? { alt } : {}) };
}

/**
 * O desenho depois do layout: o visual precisa sair do motor, no enunciado e na resposta (onde aparecem todos os pontos), caber na
 * altura da figura (`naoCabe`) e ter no máximo `TETO_DE_PRIMITIVAS`. Senão, ou se o motor falhar, o visual some e a lição segue.
 */
function conferirDesenho(visual: Visual): void {
  for (const contexto of [{ tipo: "enunciado" }, { tipo: "retorno" }] as const) {
    let desenho: ReturnType<typeof desenharVisual>;
    try {
      desenho = desenharVisual(visual, contexto);
    } catch {
      return recusar("o desenho não saiu");
    }
    if (desenho?.naoCabe) recusar("o desenho não cabe na altura da figura (pontos ou legenda demais)");
    const primitivas = desenho?.primitivas.length ?? 0;
    if (primitivas > TETO_DE_PRIMITIVAS) recusar(`desenho com ${primitivas} primitivas (o teto é ${TETO_DE_PRIMITIVAS})`);
  }
}

export type ResultadoVisual = { ok: true; visual: Visual } | { ok: false; motivo: string };

/** Valida e limpa um visual. `motivo` diz por que ele foi recusado (para o teste com IA real e para o registro). */
export function validarVisual(bruto: unknown, opcoes: OpcoesDoVisual = {}): ResultadoVisual {
  try {
    if (!objeto(bruto)) return recusar("o visual não é um objeto");
    if (opcoes.quadro && bruto.tipo !== opcoes.quadro.tipo) return recusar("o tipo mudou: o passo não mantém os eixos do anterior");
    let visual: Visual;
    switch (bruto.tipo) {
      case "plano":
        visual = normalizarPlano(bruto, opcoes);
        break;
      case "reta_numerica":
        visual = normalizarReta(bruto, opcoes);
        break;
      case "formula":
        visual = normalizarFormula(bruto, opcoes);
        break;
      default:
        return recusar(`tipo ${String(bruto.tipo)} não existe`);
    }
    conferirDesenho(visual);
    return { ok: true, visual };
  } catch (erro) {
    if (erro instanceof Recusa) return { ok: false, motivo: erro.message };
    throw erro;
  }
}

/** O visual limpo, ou `null` (o lugar dele some e a lição continua). */
export function normalizarVisual(bruto: unknown, opcoes: OpcoesDoVisual = {}): Visual | null {
  const resultado = validarVisual(bruto, opcoes);
  return resultado.ok ? resultado.visual : null;
}

/** Só plano e reta numérica (o que um passo da resolução pode trocar). */
export function normalizarFigura(bruto: unknown, opcoes: OpcoesDoVisual = {}): VisualFigura | null {
  const visual = normalizarVisual(bruto, opcoes);
  return visual && visual.tipo !== "formula" ? visual : null;
}

/** Os visuais da lição: até 3, cada um validado sozinho; os inválidos somem. `undefined` quando não sobra nenhum. */
export function normalizarVisuais(brutos: unknown): Visual[] | undefined {
  if (!Array.isArray(brutos)) return undefined;
  const visuais: Visual[] = [];
  for (const bruto of brutos) {
    const visual = normalizarVisual(bruto);
    if (visual) visuais.push(visual);
    if (visuais.length === LIMITES_VISUAIS.visuaisPorLicao) break;
  }
  return visuais.length ? visuais : undefined;
}

export function quadroDoVisual(visual: VisualFigura): Quadro {
  return visual.tipo === "plano"
    ? { tipo: "plano", x: visual.x, y: visual.y }
    : { tipo: "reta_numerica", de: visual.de, ate: visual.ate };
}

/* ----- O que vai pela rede ----- */

const escondido = (papel: PapelPonto): boolean => papel === "procurado" || papel === "resposta";

/**
 * O visual como o enunciado público o leva: sem a posição do ponto procurado nem a conta dos derivados, porque a resposta não
 * vai pela rede antes da hora. O que o servidor guarda tem tudo (`Avaliacao.visual` devolve o completo, com o procurado
 * virado em resposta, depois que a pessoa acerta).
 */
export function visualParaEnunciado<V extends Visual>(visual: V): V {
  if (visual.tipo === "plano") {
    const pontos = visual.pontos.map(({ derivado: _derivado, x, y, ...resto }) => (escondido(resto.papel) ? resto : { ...resto, x, y }));
    // A janela também não pode entregar o procurado (a borda do gráfico seria a coordenada dele mais 1): no enunciado ela é a dos
    // pontos que aparecem. Quem recebe a resposta (o retorno, o último passo) recebe a janela guardada, que a inclui.
    const visiveis = visual.pontos.filter((ponto) => !escondido(ponto.papel) && ponto.x !== undefined && ponto.y !== undefined);
    return { ...visual, x: janelaDosDados(visiveis.map((ponto) => ponto.x as number), true), y: janelaDosDados(visiveis.map((ponto) => ponto.y as number), true), pontos } as V;
  }
  if (visual.tipo === "reta_numerica") {
    const pontos = visual.pontos.map(({ derivado: _derivado, valor, ...resto }) => (escondido(resto.papel) ? resto : { ...resto, valor }));
    const visiveis = visual.pontos.flatMap((ponto) => (!escondido(ponto.papel) && ponto.valor !== undefined ? [ponto.valor] : []));
    // Com intervalos (trechos até o infinito) a janela guardada é a que vale; sem eles, é a dos pontos que aparecem.
    const [de, ate] = visual.intervalos?.length ? [visual.de, visual.ate] : janelaDosDados(visiveis, false);
    return { ...visual, de, ate, pontos } as V;
  }
  return visual;
}

/**
 * O visual com o procurado virado em resposta (depois do acerto): o motor passa a desenhá-lo na posição, e o `alt` passa a ser a
 * descrição montada dos DADOS ("… e o vértice C (4, 0)."), nunca o texto da IA, que no enunciado fala do procurado sem posição.
 */
export function visualRevelado<V extends Visual>(visual: V): V {
  if (visual.tipo === "plano") {
    return comDescricaoDaResposta({ ...visual, pontos: visual.pontos.map((ponto) => (ponto.papel === "procurado" ? { ...ponto, papel: "resposta" as const } : ponto)) }) as V;
  }
  if (visual.tipo === "reta_numerica") {
    return comDescricaoDaResposta({ ...visual, pontos: visual.pontos.map((ponto) => (ponto.papel === "procurado" ? { ...ponto, papel: "resposta" as const } : ponto)) }) as V;
  }
  return visual;
}

/* ----- Resolução ----- */

interface FormulaLida {
  canonica: string;
  arvore: NoFormula;
}

function formulaDoCampo(bruto: unknown, onde: string): FormulaLida {
  const lida = lerFormula(bruto);
  if (!lida.ok) return recusar(`${onde}: ${lida.erro}`);
  return { canonica: lida.canonica, arvore: lida.arvore };
}

function normalizarOpcao(bruto: unknown, posicao: number): { opcao: OpcaoCorrigida; arvore?: NoFormula; ajuste?: string } {
  const onde = `opção ${posicao + 1}`;
  if (!objeto(bruto)) return recusar(`${onde}: formato inválido`);
  if (typeof bruto.correta !== "boolean") return recusar(`${onde}: correta precisa ser verdadeiro ou falso`);
  const temTexto = !ausente(bruto.texto) && bruto.texto !== "";
  const temFormula = !ausente(bruto.formula) && bruto.formula !== "";
  if (!temTexto && !temFormula) return recusar(`${onde}: precisa de texto ou de fórmula`);
  const porque = textoAte(bruto.porque, LIMITES_VISUAIS.porque, `${onde}: porque`, true);
  if (temTexto && temFormula) {
    // A IA mandou a frase e a conta da MESMA opção: a conta entra na frase, entre cifrões (nada se perde: é só onde ela fica), e segue
    // conferida como fórmula. Uma opção com as duas continua sendo uma opção só.
    if (typeof bruto.texto !== "string") return recusar(`${onde}: texto ausente ou com LaTeX solto`);
    const lida = formulaDoCampo(bruto.formula, `${onde}: fórmula`);
    const texto = textoAte(`${bruto.texto.trim()} $${lida.canonica}$`, LIMITES_VISUAIS.textoDaOpcao, `${onde}: texto`, true);
    return { opcao: { texto, correta: bruto.correta, porque }, arvore: lida.arvore, ajuste: `${onde}: texto e fórmula juntos (a fórmula foi para dentro do texto)` };
  }
  if (temFormula) {
    const lida = formulaDoCampo(bruto.formula, `${onde}: fórmula`);
    return { opcao: { formula: lida.canonica, correta: bruto.correta, porque }, arvore: lida.arvore };
  }
  return { opcao: { texto: textoAte(bruto.texto, LIMITES_VISUAIS.textoDaOpcao, `${onde}: texto`, true), correta: bruto.correta, porque } };
}

function normalizarTentativa(bruto: unknown, declaradas: Record<string, string>): {
  tentativa: TentativaGuardada;
  correta: { arvore?: NoFormula; texto?: string };
  ajustes: string[];
} {
  if (!objeto(bruto)) return recusar("sua vez: formato inválido");
  const pergunta = textoAte(bruto.pergunta, LIMITES_VISUAIS.pergunta, "sua vez: pergunta", true);
  if (!Array.isArray(bruto.opcoes) || bruto.opcoes.length !== 3) return recusar("sua vez: precisa de exatamente 3 opções");
  const lidas = bruto.opcoes.map(normalizarOpcao);
  if (lidas.filter(({ opcao }) => opcao.correta).length !== 1) return recusar("sua vez: precisa de exatamente 1 opção certa");
  const chaves = lidas.map(({ opcao }) => opcao.formula ?? `t:${(opcao.texto ?? "").toLowerCase().replace(/\s+/g, "")}`);
  if (new Set(chaves).size !== chaves.length) return recusar("sua vez: duas opções iguais");
  lidas.forEach(({ opcao, arvore }, posicao) => {
    if (!arvore) return;
    const valor = valorDaOpcao(arvore, declaradas);
    if (!valor?.esperado) return;
    const bate = mesmoValor(valor.valor, valor.esperado);
    if (opcao.correta && !bate) recusar(`sua vez: a opção ${posicao + 1} está marcada como certa, mas a conta dela não dá o valor da resolução`);
    if (!opcao.correta && bate) recusar(`sua vez: a opção ${posicao + 1} está marcada como errada, mas a conta dela dá o valor da resolução`);
  });
  const certa = lidas.find(({ opcao }) => opcao.correta);
  return {
    tentativa: { pergunta, opcoes: lidas.map(({ opcao }) => opcao) },
    correta: { ...(certa?.arvore ? { arvore: certa.arvore } : {}), ...(certa?.opcao.texto ? { texto: certa.opcao.texto } : {}) },
    ajustes: lidas.flatMap(({ ajuste }) => (ajuste ? [ajuste] : [])),
  };
}

/** Os números que o problema informa (no enunciado e nos pontos dados da figura), para um número solto da frase que é dado não ser entrega. */
function dadosDoProblema(problema: string, figura: VisualFigura | undefined): Set<string> {
  const dados = new Set(numerosDoTexto(problema));
  const somar = (numero: number | undefined) => {
    const valor = numero === undefined ? null : lerNumero(String(numero));
    if (valor) dados.add(chaveDoValor(valor));
  };
  if (figura?.tipo === "plano") {
    for (const ponto of figura.pontos) if (ponto.papel === "dado" && !ponto.derivado) { somar(ponto.x); somar(ponto.y); }
  } else if (figura?.tipo === "reta_numerica") {
    for (const ponto of figura.pontos) if (ponto.papel === "dado" && !ponto.derivado) somar(ponto.valor);
  }
  return dados;
}

/**
 * A frase do passo do "Sua vez" (e o nome dele e a pergunta) não traz o resultado que a escolha vai achar: o cartão mostra isso ANTES da
 * escolha (`resolucao-publica.ts` tira só a fórmula e o desenho). A resolução que o traz é recusada, e o motivo diz a letra e o valor.
 */
function conferirFraseDoSuaVez(entrada: {
  passo: PassoGuardado;
  posicao: number;
  correta: { arvore?: NoFormula; texto?: string };
  declaradas: Record<string, string>;
  problema: string;
  arvoreDoPasso: NoFormula | undefined;
  arvoreDoUltimo: NoFormula | undefined;
  figura: VisualFigura | undefined;
}): void {
  const { passo, posicao, correta, declaradas, problema, arvoreDoPasso, arvoreDoUltimo, figura } = entrada;
  if (!passo.tentativa) return;
  const alvos = alvosDoSuaVez({ correta, ...(arvoreDoPasso ? { arvoreDoPasso } : {}), ...(arvoreDoUltimo ? { arvoreDoUltimo } : {}), declaradas });
  if (alvos.length === 0) return;
  const contexto = { dados: dadosDoProblema(problema, figura), letras: letrasDoTexto(passo.tentativa.pergunta) };
  const campos = [["texto", passo.texto], ["nome", passo.nome], ["pergunta", passo.tentativa.pergunta]] as const;
  for (const [onde, frase] of campos) {
    const achado = acharVazamento(frase, alvos, contexto);
    if (achado) recusar(motivoDoVazamento(onde, achado.alvo, posicao + 1));
  }
}

export type ResultadoResolucao =
  /** `ajustes`: o que o validador aceitou de um jeito um pouco diferente do que veio (`opção N: texto e fórmula juntos…`), para o relato. */
  | { ok: true; resolucao: ResolucaoGuardada; conta: { conferidas: number; puladas: number }; ajustes?: string[] }
  | { ok: false; motivo: string };

/** O nome do passo feito é texto em peso 800, onde nunca entra fórmula (spec 15, seção 14): o sublinhado, o expoente, a barra, o cifrão e a chave não podem aparecer. */
const SIMBOLO_NO_NOME = /[_^\\${}]/;

export interface OpcoesDaResolucao {
  /**
   * Na GERAÇÃO (a IA acabou de escrever): o nome do passo com símbolo (`Isole x_C`) recusa a resolução e o motivo vai na nova tentativa.
   * Na leitura do que já está guardado, não: a lição gravada antes desta regra segue com o "Resolva comigo" dela.
   */
  nomeSimples?: boolean;
}

/**
 * Valida a resolução inteira: de 3 a 5 passos, cada um com nome (até 24 caracteres), frase e, se houver, fórmula e visual;
 * exatamente 1 "Sua vez", no penúltimo ou no último passo; e a conta conferida (`formula-conta.ts`). Tudo ou nada: se algo
 * falha, `motivo` diz o quê, e a lição fica com o exemplo em texto. O que sai é a forma GUARDADA (com `correta` e `porque`);
 * `resolucaoParaCliente` faz a que vai pela rede.
 */
export function validarResolucao(bruto: unknown, opcoes: OpcoesDaResolucao = {}): ResultadoResolucao {
  try {
    if (!objeto(bruto)) return recusar("a resolução não é um objeto");
    const problema = textoAte(bruto.problema, LIMITES_VISUAIS.problema, "problema", true);
    const passosBrutos = bruto.passos;
    if (!Array.isArray(passosBrutos) || passosBrutos.length < LIMITES_VISUAIS.passosMin || passosBrutos.length > LIMITES_VISUAIS.passosMax) {
      return recusar(`a resolução precisa de ${LIMITES_VISUAIS.passosMin} a ${LIMITES_VISUAIS.passosMax} passos`);
    }
    // Todas as figuras da resolução dividem a janela da primeira que vale (a do problema, ajustada aos dados dela, o procurado incluído):
    // um ponto fora dela tira o visual do passo, em vez de abrir a janela de todos.
    let quadro: Quadro | undefined;
    const usar = (visualBruto: unknown, revela: boolean): VisualFigura | undefined => {
      if (ausente(visualBruto)) return undefined;
      const figura = normalizarFigura(visualBruto, { revela, ...(quadro ? { quadro } : {}) });
      if (figura && !quadro) quadro = quadroDoVisual(figura);
      return figura ?? undefined;
    };
    const visualDoProblema = usar(bruto.visual, false);
    const formulas: NoFormula[] = [];
    const arvoresDosPassos: (NoFormula | undefined)[] = [];
    const total = passosBrutos.length;
    let comTentativa = -1;
    const passos: PassoGuardado[] = passosBrutos.map((passoBruto, posicao) => {
      const onde = `passo ${posicao + 1}`;
      if (!objeto(passoBruto)) return recusar(`${onde}: formato inválido`);
      const nome = textoCortado(passoBruto.nome, LIMITES_VISUAIS.nomeDoPasso, `${onde}: nome`, 3);
      if (opcoes.nomeSimples && SIMBOLO_NO_NOME.test(nome)) {
        return recusar(`${onde}: o nome "${nome}" tem símbolo (_ ^ \\ $ { }); o nome do passo é só texto simples e curto, sem letra com índice nem fórmula ("Isole a abscissa de C", e não "Isole x_C")`);
      }
      const texto = textoAte(passoBruto.texto, LIMITES_VISUAIS.textoDoPasso, `${onde}: texto`, true);
      const formula = ausente(passoBruto.formula) || passoBruto.formula === "" ? undefined : formulaDoCampo(passoBruto.formula, `${onde}: fórmula`);
      if (formula) formulas.push(formula.arvore);
      arvoresDosPassos.push(formula?.arvore);
      const visual = usar(passoBruto.visual, posicao === total - 1);
      if (!ausente(passoBruto.tentativa)) {
        if (comTentativa >= 0) return recusar("a resolução tem mais de um \"Sua vez\"");
        if (posicao < total - 2) return recusar("o \"Sua vez\" precisa estar no penúltimo ou no último passo");
        comTentativa = posicao;
      }
      return { nome, texto, ...(formula ? { formula: formula.canonica } : {}), ...(visual ? { visual } : {}) };
    });
    if (comTentativa < 0) return recusar("a resolução precisa de exatamente um \"Sua vez\"");

    let conta: { conferidas: number; puladas: number } = { conferidas: 0, puladas: 0 };
    let declaradas: Record<string, string> = {};
    try {
      const resultado = conferirConta(formulas);
      if (!resultado.ok) return recusar(`a conta não fecha em "${resultado.formula}": ${resultado.motivo}`);
      conta = { conferidas: resultado.conferidas, puladas: resultado.puladas };
      declaradas = resultado.declaradas;
    } catch (erro) {
      if (erro instanceof Recusa) throw erro;
      // Um defeito do conferidor não derruba a lição: sem conferência, a conta fica para a revisão.
    }
    const passoComTentativa = passosBrutos[comTentativa] as Record<string, unknown>;
    const { tentativa, correta, ajustes } = normalizarTentativa(passoComTentativa.tentativa, declaradas);
    passos[comTentativa] = { ...passos[comTentativa], tentativa };
    conferirFraseDoSuaVez({
      passo: passos[comTentativa], posicao: comTentativa, correta, declaradas, problema,
      arvoreDoPasso: arvoresDosPassos[comTentativa], arvoreDoUltimo: arvoresDosPassos[total - 1], figura: visualDoProblema,
    });
    return {
      ok: true,
      conta,
      resolucao: { problema, ...(visualDoProblema ? { visual: visualDoProblema } : {}), passos },
      ...(ajustes.length > 0 ? { ajustes: ajustes.map((ajuste) => `passo ${comTentativa + 1}, ${ajuste}`) } : {}),
    };
  } catch (erro) {
    if (erro instanceof Recusa) return { ok: false, motivo: erro.message };
    throw erro;
  }
}

export function normalizarResolucao(bruto: unknown): ResolucaoGuardada | null {
  const resultado = validarResolucao(bruto);
  return resultado.ok ? resultado.resolucao : null;
}
