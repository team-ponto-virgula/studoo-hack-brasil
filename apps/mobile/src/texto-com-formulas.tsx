import { createContext, memo, useContext, useMemo, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { desenharFormulaEmLinha, falarTextoComFormulas, partirTextoComFormulas, type SegmentoDeTexto } from '@studoo/contratos';
import { elementoDaPrimitiva } from './desenho-svg';

/*
 * Fórmula dentro da frase (spec 15, seção 1, "Em linha"; contrato 3b): o texto é partido em trechos de texto e de fórmula, e cada
 * fórmula é desenhada pelo MOTOR (`desenharFormulaEmLinha`), num Svg do tamanho da caixa, como View em linha dentro do Text: o
 * mesmo desenho da web e do PNG. A View em linha se apoia pela base dela na linha de base das palavras (iPhone, Android e a prévia
 * web); por isso ela mede só a parte acima da linha de base (`linhaDeBase`), e o resto do desenho sai por baixo. Para o leitor de tela, o trecho
 * inteiro tem o texto falado (`falarTextoComFormulas`); o toque passa pela fórmula e chega ao Text.
 */

/**
 * Se o texto solto (`x_A`, `b^2`, sem cifrão) também vira fórmula. Só na lição de matemática (a `Licao` diz); fora dela, só a
 * marcação `$…$` vale, e um "snake_case" de outra matéria fica como está.
 */
export const FormulasNoTexto = createContext<{ heuristica: boolean }>({ heuristica: false });

const COMPONENTES = { Line, Rect, Circle, Path } as const;
/** Fórmula mais larga que isto (em pontos) não cabe numa linha de 390: vai em texto linear, que quebra. */
const LARGURA_MAXIMA = 260;

const FormulaEmLinha = memo(function FormulaEmLinha({ segmento, tamanho, cor }: {
  segmento: Extract<SegmentoDeTexto, { tipo: 'formula' }>; tamanho: number; cor?: string;
}) {
  // O texto em volta cresce com o tamanho de letra do sistema; a fórmula cresce junto.
  const { fontScale } = useWindowDimensions();
  const desenho = useMemo(() => {
    try { return desenharFormulaEmLinha(segmento.arvore, tamanho); } catch { return null; }
  }, [segmento.arvore, tamanho]);
  const elementos = useMemo(() => desenho?.primitivas.map((primitiva, indice) => {
    const item = elementoDaPrimitiva(primitiva, cor);
    if (!item) return null;
    const Componente = COMPONENTES[item.elemento] as unknown as (props: Record<string, unknown>) => ReactNode;
    return <Componente key={indice} {...item.props} />;
  }), [desenho, cor]);
  const escala = fontScale > 0 ? fontScale : 1;
  if (!desenho || !(desenho.largura > 0) || desenho.largura * escala > LARGURA_MAXIMA) return <Text>{segmento.linear}</Text>;
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

/**
 * A pontuação colada na fórmula não vai sozinha para a outra linha (", qual é" no começo da linha): o texto que vem depois de uma
 * fórmula e começa com pontuação de fechar, e o que vem antes e termina com pontuação de abrir, ganham o "word joiner" na junta.
 */
export function colarPontuacao(trechos: readonly SegmentoDeTexto[], indice: number): string {
  const trecho = trechos[indice];
  if (trecho.tipo !== 'texto') return '';
  let texto = trecho.texto;
  if (trechos[indice - 1]?.tipo === 'formula' && /^[.,;:!?)\]}…»”%]/u.test(texto)) texto = SEM_QUEBRA + texto;
  if (trechos[indice + 1]?.tipo === 'formula' && /[(\[{«“]$/u.test(texto)) texto += SEM_QUEBRA;
  return texto;
}

/**
 * Os trechos na ordem. A pontuação de fechar logo depois da fórmula vai junto com ela num trecho sem quebra: no aparelho, a regra
 * de quebra do Unicode já não separa os dois (e o "word joiner" reforça); na prévia web, o navegador quebra depois de qualquer
 * elemento em linha, e o `nowrap` do trecho segura.
 */
function montarTrechos(trechos: readonly SegmentoDeTexto[], tamanho: number, cor: string | undefined): ReactNode[] {
  const saida: ReactNode[] = [];
  for (let indice = 0; indice < trechos.length; indice++) {
    const trecho = trechos[indice];
    if (trecho.tipo === 'texto') { saida.push(colarPontuacao(trechos, indice)); continue; }
    const formula = <FormulaEmLinha key={indice} segmento={trecho} tamanho={tamanho} cor={cor} />;
    const seguinte = trechos[indice + 1];
    const pontuacao = seguinte?.tipo === 'texto' ? /^[.,;:!?)\]}…»”%]+/u.exec(seguinte.texto)?.[0] : undefined;
    if (!pontuacao || Platform.OS !== 'web') { saida.push(formula); continue; }
    saida.push(<Text key={`j${indice}`} style={{ whiteSpace: 'nowrap' } as TextStyle}>{formula}{pontuacao}</Text>);
    const resto = (seguinte as Extract<SegmentoDeTexto, { tipo: 'texto' }>).texto.slice(pontuacao.length);
    if (resto) saida.push(resto);
    indice++;
  }
  return saida;
}

/** Os trechos já partidos de um texto (para quem precisa saber se há fórmula). */
export function useTrechos(texto: string, heuristica?: boolean): SegmentoDeTexto[] {
  const contexto = useContext(FormulasNoTexto);
  const usar = heuristica ?? contexto.heuristica;
  return useMemo(() => partirTextoComFormulas(texto ?? '', { heuristica: usar }), [texto, usar]);
}

/**
 * Um texto com as fórmulas desenhadas no meio. Sem fórmula, é o Text de sempre (com o texto linear do que veio em LaTeX solto:
 * nunca um `$` ou uma barra crua na tela).
 */
export function TextoComFormulas({ texto, estilo, heuristica, accessibilityLabel, referencia, ...resto }: {
  texto: string;
  referencia?: Ref<ComponentRef<typeof Text>>;
  estilo?: StyleProp<TextStyle>;
  heuristica?: boolean;
} & Omit<TextProps, 'style' | 'children'>) {
  const trechos = useTrechos(texto, heuristica);
  const temFormula = trechos.some((trecho) => trecho.tipo === 'formula');
  if (!temFormula) return <Text ref={referencia} style={estilo} accessibilityLabel={accessibilityLabel} {...resto}>{trechos.map((trecho) => (trecho.tipo === 'texto' ? trecho.texto : '')).join('')}</Text>;
  const plano = StyleSheet.flatten(estilo) ?? {};
  const tamanho = typeof plano.fontSize === 'number' ? plano.fontSize : 16;
  const cor = typeof plano.color === 'string' ? plano.color : undefined;
  return (
    <Text ref={referencia} style={estilo} accessibilityLabel={accessibilityLabel ?? falarTextoComFormulas(texto)} {...resto}>
      {montarTrechos(trechos, tamanho, cor)}
    </Text>
  );
}
