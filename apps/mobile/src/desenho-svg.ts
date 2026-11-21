import {
  JUNCAO_DA_LINHA,
  PALETA_DO_DESENHO,
  PONTA_DA_LINHA,
  REGRA_DE_PREENCHIMENTO,
  desenharVisual,
  dentroDoTeto,
  type ContextoDoDesenho,
  type Desenho,
  type OpcoesDaFigura,
  type OpcoesDaFormula,
  type PapelDeCor,
  type Primitiva,
  type Visual,
} from '@studoo/contratos';

/*
 * O adaptador do motor de desenho (spec 15) para react-native-svg, sem React: cada primitiva vira o nome do elemento e as
 * propriedades dele, com as regras do contrato (preenchimento nonzero, ponta butt, junção round) e as cores por papel de
 * `PALETA_DO_DESENHO`. O componente (`desenho.tsx`) só monta os elementos; aqui fica o que os testes sem servidor conferem.
 */

/** A cor de um papel; um papel desconhecido (contrato mais novo que o app) cai na cor do texto, nunca some. */
const corDoPapelOuTexto = (papel: PapelDeCor | undefined, corDoTexto?: string) => corDoPapel(papel, corDoTexto);

export function corDoPapel(papel: PapelDeCor | undefined, corDoTexto?: string): string | undefined {
  if (!papel) return undefined;
  // A fórmula em linha toma a cor da frase em volta (o verde do retorno, o âmbar da dica): fora dos destaques, ela não tem cor.
  if (papel === 'texto' && corDoTexto) return corDoTexto;
  return (PALETA_DO_DESENHO as Record<string, string>)[papel] ?? PALETA_DO_DESENHO.texto;
}

export type ElementoSvg =
  | { elemento: 'Line'; props: Record<string, string | number | undefined> }
  | { elemento: 'Rect'; props: Record<string, string | number | undefined> }
  | { elemento: 'Circle'; props: Record<string, string | number | undefined> }
  | { elemento: 'Path'; props: Record<string, string | number | undefined> };

const tracos = (p: { tracejado?: readonly [number, number]; opacidade?: number }) => ({
  strokeDasharray: p.tracejado ? `${p.tracejado[0]} ${p.tracejado[1]}` : undefined,
  opacity: p.opacidade,
});

/** Uma primitiva do motor como elemento de react-native-svg; `null` para um tipo que este app não conhece (contrato mais novo). */
export function elementoDaPrimitiva(primitiva: Primitiva, corDoTexto?: string): ElementoSvg | null {
  const corDoPapel = (papel: PapelDeCor | undefined) => corDoPapelOuTexto(papel, corDoTexto);
  switch (primitiva.tipo) {
    case 'linha':
      return { elemento: 'Line', props: {
        x1: primitiva.x1, y1: primitiva.y1, x2: primitiva.x2, y2: primitiva.y2,
        stroke: corDoPapel(primitiva.cor), strokeWidth: primitiva.largura, strokeLinecap: PONTA_DA_LINHA, ...tracos(primitiva),
      } };
    case 'retangulo':
      return { elemento: 'Rect', props: {
        x: primitiva.x, y: primitiva.y, width: primitiva.largura, height: primitiva.altura, rx: primitiva.raio,
        fill: corDoPapel(primitiva.preenchimento) ?? 'none',
        stroke: corDoPapel(primitiva.borda), strokeWidth: primitiva.borda ? primitiva.larguraDaBorda ?? 1 : undefined, ...tracos(primitiva),
      } };
    case 'circulo':
      return { elemento: 'Circle', props: {
        cx: primitiva.cx, cy: primitiva.cy, r: primitiva.raio, fill: corDoPapel(primitiva.preenchimento) ?? 'none',
        stroke: corDoPapel(primitiva.borda), strokeWidth: primitiva.borda ? primitiva.larguraDaBorda ?? 1 : undefined, ...tracos(primitiva),
      } };
    case 'caminho':
      return { elemento: 'Path', props: {
        d: primitiva.d, fill: corDoPapel(primitiva.preenchimento) ?? 'none', fillRule: REGRA_DE_PREENCHIMENTO,
        stroke: corDoPapel(primitiva.borda), strokeWidth: primitiva.borda ? primitiva.larguraDaBorda ?? 1 : undefined,
        strokeLinecap: primitiva.borda ? PONTA_DA_LINHA : undefined, strokeLinejoin: primitiva.borda ? JUNCAO_DA_LINHA : undefined,
        ...tracos(primitiva),
      } };
    default:
      return null;
  }
}

/** Escala e medidas na tela para a largura útil: o desenho só escala (o motor já cuidou do piso do texto). */
export function medidasNaTela(desenho: Desenho, larguraUtil: number) {
  const escala = larguraUtil > 0 ? larguraUtil / desenho.largura : 0;
  const larguraDoConteudo = desenho.larguraDoConteudo ?? desenho.largura;
  return {
    escala,
    largura: Math.round(larguraUtil),
    altura: Math.round(desenho.altura * escala * 100) / 100,
    /** Fórmula mais larga que o bloco (já encolhida a 85% pelo motor): o conteúdo rola para o lado. */
    rola: larguraDoConteudo > desenho.largura,
    larguraDoConteudo: Math.round(larguraDoConteudo * escala * 100) / 100,
    viewBox: `0 0 ${larguraDoConteudo} ${desenho.altura}`,
  };
}

/**
 * O desenho de um visual, ou `null` quando ele não serve (fórmula que não lê, visual que o motor recusa, acima do teto de
 * primitivas, erro inesperado): quem chama não mostra nada no lugar, e a lição segue em texto (spec 15, seção 3).
 */
export function desenhoDoVisual(visual: Visual, contexto: ContextoDoDesenho, opcoes: OpcoesDaFormula & OpcoesDaFigura = {}): Desenho | null {
  try {
    const desenho = desenharVisual(visual, contexto, opcoes);
    if (!desenho || !dentroDoTeto(desenho) || !(desenho.altura > 0)) return null;
    return desenho;
  } catch {
    return null;
  }
}

/** A fórmula em bloco vem antes do diagrama quando os dois aparecem juntos (spec 15, seção 3); entre iguais, a ordem da lição. */
export function ordenarVisuais(visuais: readonly Visual[]): Visual[] {
  return [...visuais.filter((visual) => visual.tipo === 'formula'), ...visuais.filter((visual) => visual.tipo !== 'formula')];
}

/**
 * A altura máxima da figura no desenho (unidades do motor, 320 de largura) para ela ocupar até `alturaNaTela` na largura útil:
 * no exercício, 200 em 390 (spec 15, seção 3).
 */
export function alturaMaximaDaFigura(larguraUtil: number, alturaNaTela = 200): number {
  if (!(larguraUtil > 0)) return alturaNaTela;
  return Math.round((alturaNaTela * 320) / larguraUtil);
}

/** A altura da figura do exercício na tela: 200 numa janela de 844 ou mais; abaixo disso, na proporção (158 no iPhone SE, 667). */
export function alturaDaFiguraNaTela(alturaDaJanela: number): number {
  if (!(alturaDaJanela > 0)) return 200;
  return Math.min(200, Math.round((alturaDaJanela * 200) / 844));
}

/** O primeiro ponto (x, y) de um caminho SVG ("M x y …"). */
function inicioDoCaminho(d: string): [number, number] | null {
  const numeros = /M\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d);
  return numeros ? [Number(numeros[1]), Number(numeros[2])] : null;
}

/**
 * O ponto resposta do retorno, para ele crescer depois que a figura nova aparece (spec 15, seção 12): o círculo `resposta` com o
 * anel branco e o rótulo `respostaTexto` perto dele (até 80 unidades). O resto fica na camada de baixo. `null` sem ponto resposta.
 */
export function separarPontoResposta(primitivas: readonly Primitiva[]): { base: Primitiva[]; ponto: Primitiva[]; centro: [number, number] } | null {
  const circulo = primitivas.find((p) => p.tipo === 'circulo' && p.preenchimento === 'resposta' && p.borda === 'branco');
  if (!circulo || circulo.tipo !== 'circulo') return null;
  const centro: [number, number] = [circulo.cx, circulo.cy];
  const perto = (p: Primitiva) => {
    if (p === circulo) return true;
    if (p.tipo !== 'caminho' || (p.preenchimento !== 'respostaTexto' && p.borda !== 'respostaTexto')) return false;
    const inicio = inicioDoCaminho(p.d);
    return Boolean(inicio && Math.hypot(inicio[0] - centro[0], inicio[1] - centro[1]) <= 80);
  };
  return { base: primitivas.filter((p) => !perto(p)), ponto: primitivas.filter(perto), centro };
}

/**
 * Medidas numa caixa de altura fixa (em unidades do desenho, na largura de 320): a figura do retorno fica na caixa da figura do
 * enunciado e só a escala muda, para nada pular (spec 15, seção 12). Centralizada na largura.
 */
export function medidasNaCaixa(desenho: Desenho, larguraUtil: number, caixa: number) {
  const escalaDaLargura = larguraUtil > 0 ? larguraUtil / desenho.largura : 0;
  const alturaDaCaixa = Math.round(caixa * escalaDaLargura * 100) / 100;
  const escala = Math.min(escalaDaLargura, desenho.altura > 0 ? alturaDaCaixa / desenho.altura : 0);
  return {
    alturaDaCaixa,
    escala,
    largura: Math.round(desenho.largura * escala * 100) / 100,
    altura: Math.round(desenho.altura * escala * 100) / 100,
  };
}

/**
 * A figura tem ponto procurado (ou já resposta)? Só então o retorno e o último passo revelam algo: sem procurado (só pontos dados
 * e segmentos, como a colinearidade da IA real), o enunciado e o retorno são a mesma figura, e a troca não pode piscar nem animar.
 */
export function temProcurado(visual: Visual | undefined): boolean {
  if (!visual || visual.tipo === 'formula') return false;
  return (visual.pontos ?? []).some((ponto) => ponto.papel === 'procurado' || ponto.papel === 'resposta');
}

/** As coordenadas x de uma primitiva (para a caixa do conteúdo). */
function xsDaPrimitiva(p: Primitiva): number[] {
  switch (p.tipo) {
    case 'linha': return [p.x1, p.x2];
    case 'retangulo': return [p.x, p.x + p.largura];
    case 'circulo': return [p.cx - p.raio, p.cx + p.raio];
    case 'caminho': return [...p.d.matchAll(/(-?\d*\.?\d+)[\s,]+(-?\d*\.?\d+)/g)].map((m) => Number(m[1]));
    default: return [];
  }
}

/**
 * O bloco da fórmula (spec 15, seções 1 e 13): com o fundo do motor, o conteúdo fica com 12 de folga de cada lado. Se faltar
 * folga (ou o motor mandar rolar por pouco), o conteúdo reduz até 85% e é centralizado, sem rolar; só abaixo disso rola. Devolve
 * o fundo, o resto e a `viewBox` do conteúdo, ou `null` quando não é bloco com fundo ou quando já cabe com folga.
 */
export function ajusteDoBloco(desenho: Desenho): { fundo: Extract<Primitiva, { tipo: 'retangulo' }>; conteudo: Primitiva[]; fator: number; viewBox: string } | null {
  const [primeira, ...conteudo] = desenho.primitivas;
  if (!primeira || primeira.tipo !== 'retangulo' || primeira.preenchimento !== 'fundo' || primeira.x !== 0 || primeira.largura < desenho.largura - 0.5) return null;
  const xs = conteudo.flatMap(xsDaPrimitiva).filter(Number.isFinite);
  if (!xs.length) return null;
  const minimo = Math.min(...xs), maximo = Math.max(...xs);
  const largura = maximo - minimo;
  const fator = Math.min(1, (desenho.largura - 2 * FOLGA_DO_BLOCO) / largura);
  const folgaAtual = Math.min(minimo, desenho.largura - maximo);
  if (fator >= 1 && folgaAtual >= FOLGA_DO_BLOCO - 0.01 && !((desenho.larguraDoConteudo ?? desenho.largura) > desenho.largura)) return null;
  if (fator < 0.85) return null;
  const centro = (minimo + maximo) / 2;
  const larguraDaVista = desenho.largura / fator;
  const alturaDaVista = desenho.altura / fator;
  return {
    fundo: primeira, conteudo, fator,
    viewBox: `${centro - larguraDaVista / 2} ${desenho.altura / 2 - alturaDaVista / 2} ${larguraDaVista} ${alturaDaVista}`,
  };
}

/** A folga interna mínima do bloco da fórmula, de cada lado (spec 15, seção 13). */
export const FOLGA_DO_BLOCO = 12;
