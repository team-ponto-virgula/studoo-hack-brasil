import { memo, useMemo, type CSSProperties } from 'react';
import { falarFormula, formulaLinear, lerFormula, type ContextoDoDesenho, type Desenho, type OpcoesDaFigura, type OpcoesDaFormula, type Visual } from '@studoo/contratos';
import { Icone } from '../ui';
import { ajusteDoBloco, alturaDaFiguraNaTela, alturaMaximaDaFigura, desenhoDoVisual, elementoDaPrimitiva, ordenarVisuais, separarPontoResposta, temProcurado } from './desenho-svg';
import { montar } from './montar-svg';
import { TextoComFormulas } from './texto-com-formulas';

export { montar };

/*
 * Um visual da lição (spec 15) desenhado pelo motor compartilhado: a web só monta as primitivas em SVG, que escala sozinho pela largura do
 * quadro (viewBox) e não depende de medida em JavaScript. O app faz o mesmo em react-native-svg (`apps/mobile/src/desenho.tsx`); as
 * regras (o que desenha, o que some, a ordem, a caixa, o ponto que cresce) estão em `desenho-svg.ts`, o mesmo arquivo dos dois lados.
 * Para o leitor de tela é uma imagem só, com a descrição do motor (o texto falado da fórmula, o `alt` da figura). A entrada é uma classe
 * (`data-entrada`): o CSS a anima em 200 ms e, com movimento reduzido, nada anima.
 */

/** Até que ponto a fórmula em bloco cresce: 400 de largura (escala 1,25 do desenho de 320): acima disso o 22 do motor viraria 40 numa coluna de 680. */
const ESCALA_MAXIMA_DO_BLOCO = 1.25;
/** O visual da lição não passa de 480 de altura no computador (spec 15, seção 3), centralizado: a largura é limitada pela proporção. */
const ALTURA_MAXIMA_DO_VISUAL = 480;

/** O desenho pronto do motor, na largura do quadro em que ele está. */
export const DesenhoSvg = memo(function DesenhoSvg({ desenho, rotulo, testID, entrada = true, caixa, tipo = 'figura' }: {
  desenho: Desenho;
  /** O nome para o leitor de tela; sem ele, a descrição do motor. */
  rotulo?: string;
  testID?: string;
  /** Entra com uma leve subida (o passo novo do "Resolva comigo"); com caixa, só aparece no lugar. */
  entrada?: boolean;
  /**
   * Altura fixa da caixa, em unidades do desenho (a da figura do enunciado): a figura do retorno entra nela, só a escala muda, e nada pula
   * (spec 15, seção 12). Com caixa, a figura aparece no lugar em 200 ms e, depois, o ponto resposta cresce em 200 ms, já verde e com o rótulo.
   */
  caixa?: number;
  /** A fórmula em bloco tem largura máxima própria; a figura, a altura. */
  tipo?: 'formula' | 'figura';
}) {
  const camadas = useMemo(() => (caixa !== undefined ? separarPontoResposta(desenho.primitivas) : null), [desenho, caixa]);
  const base = useMemo(() => montar((camadas?.base ?? desenho.primitivas).map((primitiva) => elementoDaPrimitiva(primitiva))), [desenho, camadas]);
  const ponto = useMemo(() => (camadas ? montar(camadas.ponto.map((primitiva) => elementoDaPrimitiva(primitiva))) : null), [camadas]);
  const bloco = useMemo(() => (caixa === undefined ? ajusteDoBloco(desenho) : null), [desenho, caixa]);
  const nome = rotulo ?? desenho.descricao;

  if (bloco) {
    // O bloco da fórmula reduzido (até 85%) e centralizado, com 12 de folga de cada lado: o fundo é o do motor, e não rola.
    const [vx, vy, vw] = bloco.viewBox.split(' ').map(Number);
    const estilo: CSSProperties = { maxWidth: desenho.largura * ESCALA_MAXIMA_DO_BLOCO };
    return (
      <div className="desenho desenho--bloco" role="img" aria-label={nome} data-testid={testID} data-entrada={entrada || undefined} style={estilo}>
        <svg viewBox={`0 0 ${desenho.largura} ${desenho.altura}`} focusable="false" aria-hidden="true">
          {montar([elementoDaPrimitiva(bloco.fundo)])}
          <g transform={`scale(${desenho.largura / vw}) translate(${-vx} ${-vy})`}>{montar(bloco.conteudo.map((primitiva) => elementoDaPrimitiva(primitiva)))}</g>
        </svg>
      </div>
    );
  }

  if (caixa !== undefined) {
    return (
      // A caixa não passa de 480 de altura no computador (spec 15, seção 3): a largura é limitada pela proporção dela, e a figura fica centralizada.
      <div className="desenho desenho--caixa" role="img" aria-label={nome} data-testid={testID} data-entrada={entrada || undefined}
        style={{ aspectRatio: `${desenho.largura} / ${caixa}`, maxWidth: (ALTURA_MAXIMA_DO_VISUAL * desenho.largura) / caixa }}>
        <svg viewBox={`0 0 ${desenho.largura} ${desenho.altura}`} preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">
          {base}
          {camadas && ponto && <g className="desenho__ponto" style={{ transformOrigin: `${camadas.centro[0]}px ${camadas.centro[1]}px` }}>{ponto}</g>}
        </svg>
      </div>
    );
  }

  // A fórmula mais larga que o bloco (já encolhida a 85% pelo motor) rola para o lado; o resto escala pela largura.
  const larguraDoConteudo = desenho.larguraDoConteudo ?? desenho.largura;
  const rola = larguraDoConteudo > desenho.largura;
  const estilo: CSSProperties = tipo === 'formula'
    ? { maxWidth: desenho.largura * ESCALA_MAXIMA_DO_BLOCO }
    : { maxWidth: (ALTURA_MAXIMA_DO_VISUAL * desenho.largura) / desenho.altura };
  return (
    <div className={rola ? 'desenho desenho--rola' : 'desenho'} role="img" aria-label={nome} data-testid={testID} data-entrada={entrada || undefined}
      // A rolagem lateral precisa de foco para quem não usa o mouse.
      tabIndex={rola ? 0 : undefined} style={estilo}>
      <svg viewBox={`0 0 ${larguraDoConteudo} ${desenho.altura}`} focusable="false" aria-hidden="true"
        style={rola ? { width: `${(larguraDoConteudo / desenho.largura) * 100}%` } : undefined}>
        {base}
      </svg>
    </div>
  );
});

/**
 * Um visual do contrato no contexto dado (enunciado, passo, retorno). Se o motor não o desenha (fórmula que não lê, teto de
 * primitivas, erro), não ocupa lugar nenhum: a lição segue em texto (spec 15, seção 3).
 */
export function DesenhoDoVisual({ visual, contexto, opcoes, rotulo, testID, entrada, caixa }: {
  visual: Visual;
  contexto: ContextoDoDesenho;
  opcoes?: OpcoesDaFormula & OpcoesDaFigura;
  rotulo?: string;
  testID?: string;
  entrada?: boolean;
  /** Altura fixa da caixa, em unidades do desenho (ver `DesenhoSvg`). */
  caixa?: number;
}) {
  const chaveDoContexto = contexto.tipo === 'passo' ? `passo:${contexto.ultimo}` : contexto.tipo;
  const desenho = useMemo(() => desenhoDoVisual(visual, contexto, opcoes),
    // O visual chega da lição (mesma referência entre desenhos); o contexto e as opções valem pelo conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visual, chaveDoContexto, opcoes?.tamanho, opcoes?.fundo, opcoes?.alturaMaxima]);
  if (!desenho) return visual.tipo === 'formula' ? <FormulaEmTexto latex={visual.latex} testID={testID} /> : null;
  // O motor respeita a altura pedida e, quando nem assim cabe, avisa (`naoCabe`): no lugar da figura, a descrição dela.
  if (desenho.naoCabe && visual.tipo !== 'formula') return <FiguraEmTexto alt={visual.alt} testID={testID} />;
  return <DesenhoSvg desenho={desenho} rotulo={rotulo} testID={testID} entrada={entrada} caixa={caixa} tipo={visual.tipo === 'formula' ? 'formula' : 'figura'} />;
}

/**
 * A fórmula que se lê mas que o motor não desenha (acima do teto, erro): vira o texto linear, no mesmo bloco, e a lição segue.
 * A que nem se lê não aparece (o servidor já a tira; aqui, por garantia).
 */
function FormulaEmTexto({ latex, testID }: { latex: string; testID?: string }) {
  const lida = lerFormula(latex);
  if (!lida.ok) return null;
  return (
    <p className="desenho-formula-texto" data-testid={testID}>
      <span className="somente-leitor">{falarFormula(lida.arvore)}</span>
      <span aria-hidden="true">{formulaLinear(lida.arvore)}</span>
    </p>
  );
}

/**
 * A figura que não coube na altura (spec 15, seção 13): uma linha discreta logo abaixo do enunciado, com o ícone de gráfico de 16 e o `alt`
 * em 14/20 `#5E6A85`, sem caixa (a caixa parecia dica e repetia o enunciado). Leitor de tela: "Figura: <alt>". O `alt` do gráfico de função traz as
 * fórmulas marcadas com `$…$` (spec 15, seção 18): elas aparecem desenhadas em linha, como no texto da lição, e o leitor de tela as ouve pela árvore
 * ("f de x é igual a …"); nunca um cifrão na tela.
 */
function FiguraEmTexto({ alt, testID }: { alt: string; testID?: string }) {
  return (
    <p className="figura-em-texto" data-testid={testID ? `${testID}-texto` : undefined}>
      <Icone nome="grafico" />
      <span><span className="somente-leitor">Figura: </span><TextoComFormulas texto={alt} /></span>
    </p>
  );
}

/** Opções do bloco da fórmula na web (spec 15, seção 1): 22 de base, com o fundo `#F1F4FD` do próprio motor, como no app. */
export const OPCOES_DA_FORMULA = { tamanho: 22, fundo: true } as const;

/**
 * Os visuais da lição (conceito e exemplo), abertos e na largura do conteúdo: a fórmula em bloco antes do diagrama (spec 15, seção 3).
 * O que não desenha some sem deixar espaço.
 */
export function VisuaisDaLicao({ visuais, testID = 'visual-licao' }: { visuais: readonly Visual[] | undefined; testID?: string }) {
  const ordenados = useMemo(() => ordenarVisuais(visuais ?? []), [visuais]);
  if (!ordenados.length) return null;
  return (
    <div className="aula-visuais">
      {ordenados.map((visual, numero) => (
        <DesenhoDoVisual key={numero} visual={visual} contexto={CONTEXTO_DO_ENUNCIADO} opcoes={visual.tipo === 'formula' ? OPCOES_DA_FORMULA : undefined}
          testID={`${testID}-${visual.tipo}`} entrada={false} />
      ))}
    </div>
  );
}

export const CONTEXTO_DO_ENUNCIADO: ContextoDoDesenho = { tipo: 'enunciado' };
export const CONTEXTO_DO_RETORNO: ContextoDoDesenho = { tipo: 'retorno' };

/* ----- A figura do exercício (spec 15, seções 3, 12 e 13) ----- */

/** A largura do quadro do exercício em 390 (a janela, as margens de 16 e o respiro de 19,5 com a borda de 2) e a do computador (coluna de 672). */
const LARGURA_DO_QUADRO_EM_390 = 315;
const LARGURA_DO_QUADRO_NO_COMPUTADOR = 612;

/**
 * A altura máxima da figura do exercício na tela, em pixels: 200 em 390 (e menos numa janela baixa, como no app) e, conforme o quadro se
 * alarga, cresce até 480 no computador, em linha reta entre os dois pontos da spec (seção 3). Sem isso, o salto de 200 para 480 aconteceria
 * numa largura qualquer.
 */
export function alturaDaFiguraNaWeb(larguraDoQuadro: number, alturaDaJanela: number): number {
  const base = alturaDaFiguraNaTela(alturaDaJanela);
  const inclinacao = (ALTURA_MAXIMA_DO_VISUAL - 200) / (LARGURA_DO_QUADRO_NO_COMPUTADOR - LARGURA_DO_QUADRO_EM_390);
  return Math.min(ALTURA_MAXIMA_DO_VISUAL, Math.round(base + Math.max(0, larguraDoQuadro - LARGURA_DO_QUADRO_EM_390) * inclinacao));
}

/** A altura máxima no desenho (unidades do motor, 320 de largura) para a figura ocupar `alturaNaTela` na largura do quadro. */
export function alturaDoDesenhoDaFigura(larguraDoQuadro: number, alturaDaJanela: number): number {
  return alturaMaximaDaFigura(larguraDoQuadro > 0 ? larguraDoQuadro : LARGURA_DO_QUADRO_EM_390, alturaDaFiguraNaWeb(larguraDoQuadro, alturaDaJanela));
}

/**
 * A caixa da figura do exercício: a altura (em unidades do desenho) da figura do enunciado. A figura do retorno entra nela e só a escala
 * muda, e nem as opções nem o rodapé pulam (seção 12). `undefined` quando a figura não cabe (vira a linha de texto) ou não existe.
 */
export function caixaDaFigura(visual: Visual | undefined, alturaMaxima: number): number | undefined {
  if (!visual || visual.tipo === 'formula') return undefined;
  const desenho = desenhoDoVisual(visual, CONTEXTO_DO_ENUNCIADO, { alturaMaxima });
  return desenho && !desenho.naoCabe ? desenho.altura : undefined;
}

/** A descrição da figura revelada, para o leitor de tela ouvir junto do retorno, numa frase só; sem ponto procurado, nada novo a dizer. */
export function descricaoDaFiguraRevelada(doEnunciado: Visual | undefined, revelada: Visual | undefined, alturaMaxima: number): string | undefined {
  if (!doEnunciado || !revelada || !temProcurado(doEnunciado)) return undefined;
  return desenhoDoVisual(revelada, CONTEXTO_DO_RETORNO, { alturaMaxima })?.descricao;
}

/**
 * A figura do enunciado, e no acerto a do retorno NO LUGAR dela (o procurado vira resposta, entrando de leve; no erro, nada muda). A troca
 * remonta o desenho (chave nova), e a entrada roda uma vez só. Sem ponto procurado (só pontos dados e segmentos), o retorno é o mesmo desenho:
 * fica o do enunciado, sem troca nem animação. A descrição nova vai na fala do retorno: a figura não anuncia de novo.
 */
export function FiguraDoExercicio({ visual, revelada, alturaMaxima, caixa, descricaoDoRetorno }: {
  visual: Visual;
  /** A figura do retorno, depois do acerto. */
  revelada?: Visual;
  alturaMaxima: number;
  caixa: number | undefined;
  descricaoDoRetorno?: string;
}) {
  const opcoesDe = (alvo: Visual) => (alvo.tipo === 'formula' ? OPCOES_DA_FORMULA : { alturaMaxima });
  return (
    <div className="aula-figura">
      {revelada && temProcurado(visual) ? (
        <DesenhoDoVisual key="retorno" visual={revelada} contexto={CONTEXTO_DO_RETORNO} testID="visual-retorno" caixa={caixa} rotulo={descricaoDoRetorno} opcoes={opcoesDe(revelada)} />
      ) : (
        <DesenhoDoVisual key="enunciado" visual={visual} contexto={CONTEXTO_DO_ENUNCIADO} testID="visual-enunciado" entrada={false} caixa={caixa} opcoes={opcoesDe(visual)} />
      )}
    </div>
  );
}
