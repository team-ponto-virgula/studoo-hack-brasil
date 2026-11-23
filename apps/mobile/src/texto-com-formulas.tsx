import { memo, useMemo, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { falarTextoComFormulas, partirTextoComFormulas, type DesenhoEmLinha, type SegmentoDeTexto } from '@studoo/contratos';
import { itensDaFrase, pesoDoTexto, type ItemDaFrase } from './formula-em-linha';
import { elementoDaPrimitiva } from './desenho-svg';

/*
 * Fórmula dentro da frase (spec 15, seção 1, "Em linha"; contrato 3b): o texto é partido em trechos de texto e de fórmula, e cada
 * fórmula é desenhada pelo MOTOR (`desenharFormulaEmLinha`), num Svg do tamanho da caixa, como View em linha dentro do Text: o
 * mesmo desenho da web e do PNG. A View em linha se apoia pela base dela na linha de base das palavras (iPhone, Android e a prévia
 * web); por isso ela mede só a parte acima da linha de base (`linhaDeBase`), e o resto do desenho sai por baixo. Para o leitor de tela, o trecho
 * inteiro tem o texto falado (`falarTextoComFormulas`); o toque passa pela fórmula e chega ao Text.
 */


const COMPONENTES = { Line, Rect, Circle, Path } as const;
/** Teto da fórmula inteira em linha (pontos), antes de medir o parágrafo; acima do limite, ela vai em peças. */
const LARGURA_MAXIMA = 260;

const FormulaEmLinha = memo(function FormulaEmLinha({ desenho, escala, cor }: { desenho: DesenhoEmLinha; escala: number; cor?: string }) {
  const elementos = useMemo(() => desenho.primitivas.map((primitiva, indice) => {
    const item = elementoDaPrimitiva(primitiva, cor);
    if (!item) return null;
    const Componente = COMPONENTES[item.elemento] as unknown as (props: Record<string, unknown>) => ReactNode;
    return <Componente key={indice} {...item.props} />;
  }), [desenho, cor]);
  const largura = desenho.largura * escala;
  const altura = desenho.altura * escala;
  return (
    // A caixa em linha tem só a altura ACIMA da linha de base (a base dela fica na base das palavras) e o desenho desce por fora
    // dela: o índice não empurra a linha (spec 15, seção 9: "sem a linha crescer").
    <View testID="formula-em-linha" pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ width: largura, height: desenho.linhaDeBase * escala, overflow: 'visible' }}>
      <Svg width={largura} height={altura} viewBox={`0 0 ${desenho.largura} ${desenho.altura}`} style={{ position: 'absolute', top: 0, left: 0 }}>{elementos}</Svg>
    </View>
  );
});

/** O "word joiner" (U+2060): invisível, impede a quebra de linha onde está. */
const SEM_QUEBRA = '\u2060';
const FECHA = /^[.,;:!?)\]}…»”%]+/u;
const ABRE = /[(\[{«“]$/u;

/**
 * Os itens na ordem, com a pontuação colada na fórmula: o texto depois de uma fórmula que começa com pontuação de fechar, e o
 * que vem antes e termina com pontuação de abrir, ganham o "word joiner" na junta (no aparelho, a regra de quebra do Unicode já
 * não separa os dois). Na prévia web, o navegador quebra depois de qualquer elemento em linha: lá a fórmula e a pontuação de fechar
 * vão num trecho sem quebra.
 */
function montarItens(itens: readonly ItemDaFrase[], escala: number, cor: string | undefined): ReactNode[] {
  const saida: ReactNode[] = [];
  for (let indice = 0; indice < itens.length; indice++) {
    const item = itens[indice];
    if (item.tipo === 'texto') {
      let texto = item.texto;
      if (itens[indice - 1]?.tipo === 'desenho' && FECHA.test(texto)) texto = SEM_QUEBRA + texto;
      if (itens[indice + 1]?.tipo === 'desenho' && ABRE.test(texto)) texto += SEM_QUEBRA;
      saida.push(texto);
      continue;
    }
    const formula = <FormulaEmLinha key={indice} desenho={item.desenho} escala={escala} cor={cor} />;
    const seguinte = itens[indice + 1];
    const pontuacao = seguinte?.tipo === 'texto' ? FECHA.exec(seguinte.texto)?.[0] : undefined;
    if (!pontuacao || Platform.OS !== 'web') { saida.push(formula); continue; }
    saida.push(<Text key={`j${indice}`} style={{ whiteSpace: 'nowrap' } as TextStyle}>{formula}{pontuacao}</Text>);
    const resto = (seguinte as Extract<ItemDaFrase, { tipo: 'texto' }>).texto.slice(pontuacao.length);
    if (resto) saida.push(itens[indice + 2]?.tipo === 'desenho' && ABRE.test(resto) ? resto + SEM_QUEBRA : resto);
    indice++;
  }
  return saida;
}

/** Os trechos já partidos de um texto (para quem precisa saber se há fórmula). */
export function useTrechos(texto: string): SegmentoDeTexto[] {
  // Só o que está marcado (`$…$`) é fórmula: quem marca os tokens soltos (`x_A`, `b^2`) é o servidor, na lição de matemática (3c).
  return useMemo(() => partirTextoComFormulas(texto ?? ''), [texto]);
}

/**
 * Um texto com as fórmulas desenhadas no meio. Sem fórmula, é o Text de sempre (com o texto linear do que veio em LaTeX solto:
 * nunca um `$` ou uma barra crua na tela).
 */
export function TextoComFormulas({ texto, estilo, accessibilityLabel, referencia, onLayout, ...resto }: {
  texto: string;
  referencia?: Ref<ComponentRef<typeof Text>>;
  estilo?: StyleProp<TextStyle>;
} & Omit<TextProps, 'style' | 'children'>) {
  const trechos = useTrechos(texto);
  // O texto em volta cresce com o tamanho de letra do sistema; a fórmula cresce junto.
  const { fontScale } = useWindowDimensions();
  const escala = fontScale > 0 ? fontScale : 1;
  // A largura do próprio parágrafo é o limite da fórmula inteira (no balão do Stu, ela é menor que a da tela).
  const [largura, setLargura] = useState(0);
  const limite = largura > 0 ? Math.min(largura, LARGURA_MAXIMA) : LARGURA_MAXIMA;
  const temFormula = trechos.some((trecho) => trecho.tipo === 'formula');
  if (!temFormula) return <Text ref={referencia} style={estilo} accessibilityLabel={accessibilityLabel} onLayout={onLayout} {...resto}>{trechos.map((trecho) => (trecho.tipo === 'texto' ? trecho.texto : '')).join('')}</Text>;
  const plano = StyleSheet.flatten(estilo) ?? {};
  const tamanho = typeof plano.fontSize === 'number' ? plano.fontSize : 16;
  const cor = typeof plano.color === 'string' ? plano.color : undefined;
  return (
    <Text ref={referencia} style={estilo} accessibilityLabel={accessibilityLabel ?? falarTextoComFormulas(texto)} {...resto}
      onLayout={(evento) => { const w = evento.nativeEvent.layout.width; if (Math.abs(w - largura) > 0.5) setLargura(w); onLayout?.(evento); }}>
      {montarItens(itensDaFrase(trechos, tamanho, escala, limite, pesoDoTexto(plano.fontWeight)), escala, cor)}
    </Text>
  );
}
