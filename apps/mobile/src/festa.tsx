import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useMovimentoReduzido } from './interface';

/*
 * Confete das comemorações, como na web (src/ui/festa.tsx): um estouro curto em volta do centro da caixa onde fica
 * (acerto, nó concluído) ou uma chuva que cai pela tela (lição concluída). As peças têm posição fixa, calculada pelo
 * índice. É decorativo: fica fora do leitor de tela e não aparece com movimento reduzido.
 */

export const coresFesta = ['#3858D6', '#FFD166', '#F38FB0', '#78C88B', '#86C1F4', '#EF8467'] as const;

const duracaoDaChuva = 4600;

function Peca({ indice, quantidade, chuva, progresso, larguraTela, alturaTela }: {
  indice: number;
  quantidade: number;
  chuva: boolean;
  progresso: Animated.Value;
  larguraTela: number;
  alturaTela: number;
}) {
  const largura = 6 + (indice % 3) * 2;
  const altura = 9 + (indice % 4) * 2;
  const cor = coresFesta[indice % coresFesta.length];

  if (chuva) {
    const comeco = ((indice * 97) % 1100) / duracaoDaChuva;
    const fim = Math.min(1, comeco + (2000 + ((indice * 131) % 1400)) / duracaoDaChuva);
    const deriva = ((indice * 29) % 80) - 40;
    const giro = 200 + ((indice * 67) % 520);
    return (
      <Animated.View style={{
        position: 'absolute', top: -24, left: ((indice * 53 + 7) % 100) / 100 * larguraTela, width: largura, height: altura,
        borderRadius: 2, backgroundColor: cor,
        opacity: progresso.interpolate({ inputRange: [0, comeco, comeco + 0.001, fim - 0.04, fim], outputRange: [0, 0, 1, 1, 0], extrapolate: 'clamp' }),
        transform: [
          { translateY: progresso.interpolate({ inputRange: [comeco, fim], outputRange: [0, alturaTela + 48], extrapolate: 'clamp' }) },
          { translateX: progresso.interpolate({ inputRange: [comeco, fim], outputRange: [0, deriva], extrapolate: 'clamp' }) },
          { rotate: progresso.interpolate({ inputRange: [comeco, fim], outputRange: ['0deg', `${giro}deg`], extrapolate: 'clamp' }) },
        ],
      }} />
    );
  }

  const angulo = (indice / quantidade) * Math.PI * 2 + (indice % 3) * 0.35;
  const distancia = 46 + ((indice * 37) % 46);
  return (
    <Animated.View style={{
      position: 'absolute', left: '50%', top: '50%', marginLeft: -largura / 2, marginTop: -altura / 2, width: largura, height: altura,
      borderRadius: 2, backgroundColor: cor,
      opacity: progresso.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
      transform: [
        { translateX: progresso.interpolate({ inputRange: [0, 1], outputRange: [0, Math.round(Math.cos(angulo) * distancia)] }) },
        { translateY: progresso.interpolate({ inputRange: [0, 1], outputRange: [0, Math.round(Math.sin(angulo) * distancia)] }) },
        { rotate: progresso.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(indice * 83) % 360}deg`] }) },
        { scale: progresso.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
      ],
    }} />
  );
}

export function Confete({ quantidade = 16, chuva = false }: { quantidade?: number; chuva?: boolean }) {
  const reduzir = useMovimentoReduzido();
  const { width, height } = useWindowDimensions();
  const [progresso] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduzir !== false) return;
    progresso.setValue(0);
    const animacao = Animated.timing(progresso, {
      toValue: 1, duration: chuva ? duracaoDaChuva : 900, easing: chuva ? Easing.linear : Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animacao.start();
    return () => animacao.stop();
  }, [reduzir, chuva, progresso]);

  if (reduzir !== false) return null;
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={festaEstilos.camada}>
      {Array.from({ length: quantidade }, (_, indice) => (
        <Peca key={indice} indice={indice} quantidade={quantidade} chuva={chuva} progresso={progresso} larguraTela={width} alturaTela={height} />
      ))}
    </View>
  );
}

const festaEstilos = StyleSheet.create({
  camada: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 3, overflow: 'visible' },
});
