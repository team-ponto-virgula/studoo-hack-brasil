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
