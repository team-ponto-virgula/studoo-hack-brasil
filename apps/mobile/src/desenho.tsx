import { memo, useMemo, useState, type ReactNode } from 'react';
import { Animated, ScrollView, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { falarFormula, formulaLinear, lerFormula, type ContextoDoDesenho, type Desenho, type OpcoesDaFigura, type OpcoesDaFormula, type Visual } from '@studoo/contratos';
import { useAparecer } from './animacoes';
import { ajusteDoBloco, corDoPapel, desenhoDoVisual, elementoDaPrimitiva, medidasNaCaixa, medidasNaTela, ordenarVisuais, separarPontoResposta, type ElementoSvg } from './desenho-svg';
import { Icone } from './icone';
import { cores, fontes } from './tema';

/*
 * Um visual da lição (spec 15) desenhado pelo motor compartilhado: o app só escala as primitivas para a largura útil e as
 * monta em react-native-svg. Para o leitor de tela é uma imagem só, com a descrição do motor (o texto falado da fórmula, o alt
 * da figura). A entrada suave fica num Animated.View por fora do Svg (nada de animar propriedade de SVG, que engasga no Android);
 * com movimento reduzido, aparece na hora.
 */

const COMPONENTES = { Line, Rect, Circle, Path } as const;

function montar(elementos: (ElementoSvg | null)[]): ReactNode[] {
  return elementos.map((item, indice) => {
    if (!item) return null;
    const Componente = COMPONENTES[item.elemento] as unknown as (props: Record<string, unknown>) => ReactNode;
    return <Componente key={indice} {...item.props} />;
  });
}

/** O desenho pronto do motor, na largura útil de quem o recebe. */
export const DesenhoSvg = memo(function DesenhoSvg({ desenho, rotulo, testID, estilo, entrada = true, caixa }: {
  desenho: Desenho;
  /** O nome para o leitor de tela; sem ele, a descrição do motor. */
  rotulo?: string;
  testID?: string;
  estilo?: StyleProp<ViewStyle>;
  /** Entra subindo de leve (o ponto procurado virando resposta, o passo novo do "Resolva comigo"). */
  entrada?: boolean;
  /**
   * Altura fixa da caixa, em unidades do desenho (a da figura do enunciado): a figura do retorno entra nela, só a escala muda, e
   * nada pula (spec 15, seção 12). Com caixa, a entrada é a figura aparecendo no lugar em 200 ms e, depois, o ponto resposta
   * crescendo em 200 ms, já verde e com o rótulo (camada própria, por fora do Svg); com movimento reduzido, tudo na hora.
   */
  caixa?: number;
}) {
  const [largura, setLargura] = useState(0);
  const camadas = useMemo(() => (caixa !== undefined ? separarPontoResposta(desenho.primitivas) : null), [desenho, caixa]);
  const elementos = useMemo(() => montar((camadas?.base ?? desenho.primitivas).map((primitiva) => elementoDaPrimitiva(primitiva))), [desenho, camadas]);
  const elementosDoPonto = useMemo(() => (camadas ? montar(camadas.ponto.map((primitiva) => elementoDaPrimitiva(primitiva))) : null), [camadas]);
  const medidas = medidasNaTela(desenho, largura);
  const aparecer = useAparecer(0, 200);
  const crescer = useAparecer(200, 200);
  const bloco = useMemo(() => (caixa === undefined ? ajusteDoBloco(desenho) : null), [desenho, caixa]);
  const elementosDoBloco = useMemo(() => (bloco ? montar(bloco.conteudo.map((primitiva) => elementoDaPrimitiva(primitiva))) : null), [bloco]);
  if (bloco) {
    // O bloco da fórmula reduzido (até 85%) e centralizado, com 12 de folga de cada lado: o fundo é o do motor, e não rola.
    const altura = medidas.altura;
    return (
      <Animated.View testID={testID} accessible accessibilityRole="image" accessibilityLabel={rotulo ?? desenho.descricao}
        onLayout={(evento) => { const w = evento.nativeEvent.layout.width; if (Math.abs(w - largura) > 0.5) setLargura(w); }}
        style={[{ width: '100%', aspectRatio: desenho.largura / desenho.altura, borderRadius: (bloco.fundo.raio ?? 0) * (medidas.escala || 1),
          backgroundColor: corDoPapel(bloco.fundo.preenchimento) }, entrada && { opacity: aparecer }, estilo]}>
        {largura > 0 && (
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Svg width={medidas.largura} height={altura} viewBox={bloco.viewBox}>{elementosDoBloco}</Svg>
          </View>
        )}
      </Animated.View>
    );
  }
  if (caixa !== undefined) {
    const naCaixa = medidasNaCaixa(desenho, largura, caixa);
    const viewBox = `0 0 ${desenho.largura} ${desenho.altura}`;
    return (
      <Animated.View testID={testID} accessible accessibilityRole="image" accessibilityLabel={rotulo ?? desenho.descricao}
        onLayout={(evento) => { const w = evento.nativeEvent.layout.width; if (Math.abs(w - largura) > 0.5) setLargura(w); }}
        style={[{ width: '100%', aspectRatio: desenho.largura / caixa, alignItems: 'center' }, entrada && { opacity: aparecer }, estilo]}>
        {largura > 0 && (
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: naCaixa.largura, height: naCaixa.altura }}>
            <Svg width={naCaixa.largura} height={naCaixa.altura} viewBox={viewBox}>{elementos}</Svg>
            {camadas && elementosDoPonto && (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: naCaixa.largura, height: naCaixa.altura,
                transformOrigin: `${camadas.centro[0] * naCaixa.escala}px ${camadas.centro[1] * naCaixa.escala}px`,
                transform: [{ scale: entrada ? crescer : 1 }] }}>
                <Svg width={naCaixa.largura} height={naCaixa.altura} viewBox={viewBox}>{elementosDoPonto}</Svg>
              </Animated.View>
            )}
          </View>
        )}
      </Animated.View>
    );
  }
  const svg = largura > 0 && (
    <Svg width={medidas.rola ? medidas.larguraDoConteudo : medidas.largura} height={medidas.altura} viewBox={medidas.viewBox}>
      {elementos}
    </Svg>
  );
  return (
    <Animated.View testID={testID} accessible accessibilityRole="image" accessibilityLabel={rotulo ?? desenho.descricao}
      onLayout={(evento) => { const w = evento.nativeEvent.layout.width; if (Math.abs(w - largura) > 0.5) setLargura(w); }}
      // A altura fica reservada pela proporção antes da primeira medida: a lição não pula quando o desenho chega.
      style={[{ width: '100%', aspectRatio: desenho.largura / desenho.altura },
        entrada && { opacity: aparecer, transform: [{ translateY: aparecer.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }, estilo]}>
      {medidas.rola ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} importantForAccessibility="no-hide-descendants">{svg}</ScrollView>
      ) : (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{svg}</View>
      )}
    </Animated.View>
  );
});

/**
 * Um visual do contrato no contexto dado (enunciado, passo, retorno). Se o motor não o desenha (fórmula que não lê, teto de
 * primitivas, erro), não ocupa lugar nenhum: a lição segue em texto (spec 15, seção 3).
 */
export function DesenhoDoVisual({ visual, contexto, opcoes, rotulo, testID, estilo, entrada, caixa }: {
  visual: Visual;
  contexto: ContextoDoDesenho;
  opcoes?: OpcoesDaFormula & OpcoesDaFigura;
  rotulo?: string;
  testID?: string;
  estilo?: StyleProp<ViewStyle>;
  entrada?: boolean;
  /** Altura fixa da caixa, em unidades do desenho (ver `DesenhoSvg`). */
  caixa?: number;
}) {
  const chaveDoContexto = contexto.tipo === 'passo' ? `passo:${contexto.ultimo}` : contexto.tipo;
  // A fórmula em bloco cresce com o tamanho de letra do sistema, como o texto em volta (spec 15, seção 16; WCAG 1.4.4), até 2×;
  // larga demais, o motor a reduz até 85% e ela rola. As figuras não mudam (a altura delas é a da caixa).
  const { fontScale } = useWindowDimensions();
  const tamanho = visual.tipo === 'formula' && opcoes?.tamanho ? Math.round(opcoes.tamanho * Math.min(2, Math.max(1, fontScale || 1)) * 10) / 10 : opcoes?.tamanho;
  const desenho = useMemo(() => desenhoDoVisual(visual, contexto, { ...opcoes, ...(tamanho ? { tamanho } : {}) }),
    // O visual chega da lição (mesma referência entre desenhos); o contexto e as opções valem pelo conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visual, chaveDoContexto, tamanho, opcoes?.fundo, opcoes?.alturaMaxima]);
  if (!desenho) return visual.tipo === 'formula' ? <FormulaEmTexto latex={visual.latex} testID={testID} /> : null;
  // O motor respeita a altura pedida e, quando nem assim cabe, avisa (`naoCabe`): no lugar da figura, a descrição dela.
  if (desenho.naoCabe && visual.tipo !== 'formula') return <FiguraEmTexto alt={visual.alt} testID={testID} />;
  return <DesenhoSvg desenho={desenho} rotulo={rotulo} testID={testID} estilo={estilo} entrada={entrada} caixa={caixa} />;
}

/**
 * A fórmula que se lê mas que o motor não desenha (acima do teto, erro): vira o texto linear, no mesmo bloco, e a lição segue.
 * A que nem se lê não aparece (o servidor já a tira; aqui, por garantia).
 */
function FormulaEmTexto({ latex, testID }: { latex: string; testID?: string }) {
  const lida = lerFormula(latex);
  if (!lida.ok) return null;
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={falarFormula(lida.arvore)} style={blocoDaFormula}>
      <Text style={{ color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 18, lineHeight: 26, textAlign: 'center' }}>
        {formulaLinear(lida.arvore)}
      </Text>
    </View>
  );
}

/**
 * A figura que não coube na altura (spec 15, seção 13): uma linha discreta logo abaixo do enunciado, com o ícone de gráfico de
 * 16 e o `alt` em 14/20 `#5E6A85`, sem caixa (a caixa parecia dica e repetia o enunciado). Leitor de tela: "Figura: <alt>".
 */
function FiguraEmTexto({ alt, testID }: { alt: string; testID?: string }) {
  return (
    <View testID={testID ? `${testID}-texto` : undefined} accessible accessibilityRole="text" accessibilityLabel={`Figura: ${alt}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
      <View style={{ paddingTop: 2 }}><Icone nome="grafico" tamanho={16} cor={cores.textoSecundario} traco={2} /></View>
      <Text style={{ flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 }}>{alt}</Text>
    </View>
  );
}

const blocoDaFormula: ViewStyle = { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F1F4FD' };

/** Opções do bloco da fórmula no app (spec 15, seção 1): 22 de base, com o fundo `#F1F4FD` do próprio motor. */
export const OPCOES_DA_FORMULA = { tamanho: 22, fundo: true } as const;

/**
 * Os visuais da lição (conceito e exemplo), abertos e na largura do conteúdo: a fórmula em bloco antes do diagrama (spec 15,
 * seção 3). O que não desenha some sem deixar espaço.
 */
export function VisuaisDaLicao({ visuais, testID = 'visual-licao' }: { visuais: readonly Visual[] | undefined; testID?: string }) {
  const ordenados = useMemo(() => ordenarVisuais(visuais ?? []), [visuais]);
  if (!ordenados.length) return null;
  return (
    <View style={{ gap: 12 }}>
      {ordenados.map((visual, numero) => (
        <DesenhoDoVisual key={numero} visual={visual} contexto={CONTEXTO_DO_ENUNCIADO} opcoes={visual.tipo === 'formula' ? OPCOES_DA_FORMULA : undefined}
          testID={`${testID}-${visual.tipo}`} entrada={false} />
      ))}
    </View>
  );
}

export const CONTEXTO_DO_ENUNCIADO: ContextoDoDesenho = { tipo: 'enunciado' };
export const CONTEXTO_DO_RETORNO: ContextoDoDesenho = { tipo: 'retorno' };
