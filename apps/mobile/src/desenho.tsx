import { memo, useMemo, useState, type ReactNode } from 'react';
import { Animated, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { ContextoDoDesenho, Desenho, OpcoesDaFigura, OpcoesDaFormula, Visual } from '@studoo/contratos';
import { useAparecer } from './animacoes';
import { desenhoDoVisual, elementoDaPrimitiva, medidasNaTela, type ElementoSvg } from './desenho-svg';

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
export const DesenhoSvg = memo(function DesenhoSvg({ desenho, rotulo, testID, estilo, entrada = true }: {
  desenho: Desenho;
  /** O nome para o leitor de tela; sem ele, a descrição do motor. */
  rotulo?: string;
  testID?: string;
  estilo?: StyleProp<ViewStyle>;
  /** Entra subindo de leve (o ponto procurado virando resposta, o passo novo do "Resolva comigo"). */
  entrada?: boolean;
}) {
  const [largura, setLargura] = useState(0);
  const elementos = useMemo(() => montar(desenho.primitivas.map(elementoDaPrimitiva)), [desenho]);
  const medidas = medidasNaTela(desenho, largura);
  const aparecer = useAparecer(0, 200);
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
export function DesenhoDoVisual({ visual, contexto, opcoes, rotulo, testID, estilo, entrada }: {
  visual: Visual;
  contexto: ContextoDoDesenho;
  opcoes?: OpcoesDaFormula & OpcoesDaFigura;
  rotulo?: string;
  testID?: string;
  estilo?: StyleProp<ViewStyle>;
  entrada?: boolean;
}) {
  const chaveDoContexto = contexto.tipo === 'passo' ? `passo:${contexto.ultimo}` : contexto.tipo;
  const desenho = useMemo(() => desenhoDoVisual(visual, contexto, opcoes),
    // O visual chega da lição (mesma referência entre desenhos); o contexto e as opções valem pelo conteúdo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visual, chaveDoContexto, opcoes?.tamanho, opcoes?.fundo, opcoes?.alturaMaxima]);
  if (!desenho) return null;
  return <DesenhoSvg desenho={desenho} rotulo={rotulo} testID={testID} estilo={estilo} entrada={entrada} />;
}
