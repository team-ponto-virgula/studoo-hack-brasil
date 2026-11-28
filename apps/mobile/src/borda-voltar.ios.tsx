import { useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { useMovimentoReduzido } from './movimento';
import { assinarGesto, gestoLigado, voltarPeloGesto } from './voltar';

/** Faixa da borda esquerda onde o arrasto começa, em pt: a largura do gesto de voltar do próprio iOS. */
const BORDA = 20;
/** Arrasto (pt) ou velocidade (pt/s) que conta como voltar ao soltar; menos que isso, a tela volta ao lugar. */
const DISTANCIA = 64;
const VELOCIDADE = 500;

/**
 * Gesto de voltar do iPhone (P17 da spec 07): arrastar da borda esquerda para a direita faz o mesmo que o voltar do Android,
 * pela mesma função (`voltarPeloGesto`, em `voltar.ts`). Onde o voltar pede confirmação, abre a mesma confirmação; onde não
 * há para onde voltar, o gesto nem começa.
 *
 * - Só começa nos primeiros 20 pt da esquerda. O conteúdo das telas fica a 20 pt da borda, então nenhuma rolagem horizontal
 *   (como a tabela da aula) começa dentro dessa faixa; o carrossel da apresentação, que ocupa a largura toda, trava o gesto.
 * - Rolagem vertical que começa na faixa não vira voltar: o gesto falha se o dedo anda 12 pt na vertical antes de 10 pt
 *   para a direita.
 * - Enquanto o dedo anda, a tela acompanha um pouco (no máximo 42 pt), sem a tela anterior por baixo; com movimento
 *   reduzido, fica parada.
 * - Com o VoiceOver, o gesto de escape (dois dedos em "Z") chama o mesmo voltar.
 */
export function BordaDeVoltar({ children }: { children: ReactNode }) {
  const ligado = useSyncExternalStore(assinarGesto, gestoLigado, gestoLigado);
  const reduzir = useMovimentoReduzido();
  const deslocamento = useRef(new Animated.Value(0)).current;

  const gesto = usePanGesture({
    enabled: ligado,
    runOnJS: true,
    disableReanimated: true,
    hitSlop: { left: 0, width: BORDA },
    activeOffsetX: 10,
    failOffsetX: -10,
    failOffsetY: [-12, 12],
    onUpdate: (evento) => {
      if (reduzir === false) deslocamento.setValue(Math.min(Math.max(evento.translationX, 0), 120) * 0.35);
    },
    onDeactivate: (evento) => {
      const voltou = !evento.canceled && (evento.translationX > DISTANCIA || evento.velocityX > VELOCIDADE);
      if (voltou) {
        deslocamento.setValue(0);
        voltarPeloGesto();
        return;
      }
      Animated.timing(deslocamento, { toValue: 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    },
  });

  return (
    <GestureHandlerRootView style={estilos.raiz}>
      <GestureDetector gesture={gesto}>
        <Animated.View
          style={[estilos.raiz, { transform: [{ translateX: deslocamento }] }]}
          onAccessibilityEscape={ligado ? () => { voltarPeloGesto(); } : undefined}>
          {children}
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
});
