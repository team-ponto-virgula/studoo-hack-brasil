import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { ESPERA_VIVA, estadoDaEsperaViva, faltaParaMudarAEspera, type MotivoDaEspera } from '@studoo/contratos';
import { mensagens } from './mensagens';
import { Stu } from './mascote';
import { useMovimentoReduzido } from './movimento';
import { cores, fontes } from './tema';

/*
 * A espera viva do app, igual à da web (contrato `espera-viva.ts`, web `src/ui/espera-viva.tsx`). Depois de 400 ms, o Stu
 * concentrado aparece com a frase do que ele está fazendo, que avança a cada 3,5 s e para na última; depois de 15 s, a
 * linha avisa que está levando mais que o normal. Uma barra fina corre embaixo, sem prometer quanto falta. O leitor de tela
 * ouve a primeira frase uma vez; as trocas seguintes ficam só na tela. Com movimento reduzido, o Stu e a barra ficam
 * parados e a frase troca sem efeito.
 */

export function EsperaViva({ motivo, compacta = false, testID = 'espera-viva' }: { motivo: MotivoDaEspera; compacta?: boolean; testID?: string }) {
  const frases = mensagens.esperaViva;
  const lista = frases[motivo];
  const reduzir = useMovimentoReduzido();
  const [inicio] = useState(() => Date.now());
  const [estado, setEstado] = useState<number | 'demorada' | null>(null);
  const mostrado = useRef<number | 'demorada' | null>(null);
  const [opacidade] = useState(() => new Animated.Value(1));
  const [corrida] = useState(() => new Animated.Value(0));
  const [entrada] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let relogio: ReturnType<typeof setTimeout> | undefined;
    let vivo = true;
    const agendar = () => {
      const falta = faltaParaMudarAEspera(Date.now() - inicio, lista.length);
      if (falta === null) return;
      relogio = setTimeout(() => {
        if (!vivo) return;
        const proximo = estadoDaEsperaViva(Date.now() - inicio, lista.length);
        const atual = mostrado.current;
        if (proximo !== atual) {
          mostrado.current = proximo;
          if (atual === null || reduzir !== false) setEstado(proximo);
          else {
            // A frase some (150 ms) e a seguinte aparece (150 ms).
            const metade = Math.round(ESPERA_VIVA.efeitoMs / 2);
            Animated.timing(opacidade, { toValue: 0, duration: metade, useNativeDriver: true }).start(() => {
              if (!vivo) return;
              setEstado(proximo);
              Animated.timing(opacidade, { toValue: 1, duration: metade, useNativeDriver: true }).start();
            });
          }
        }
        agendar();
      }, falta + 5);
    };
    agendar();
    return () => {
      vivo = false;
      if (relogio) clearTimeout(relogio);
    };
  }, [inicio, lista.length, opacidade, reduzir]);

  // A entrada do cartão e a barra que corre (paradas com movimento reduzido).
  const visivel = estado !== null;
  useEffect(() => {
    if (!visivel) return;
    if (reduzir !== false) { entrada.setValue(1); return; }
    const animacao = Animated.timing(entrada, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [visivel, reduzir, entrada]);
  useEffect(() => {
    if (!visivel || reduzir !== false) return;
    const laco = Animated.loop(Animated.timing(corrida, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    laco.start();
    return () => laco.stop();
  }, [visivel, reduzir, corrida]);

  const [larguraBarra, setLarguraBarra] = useState(0);
  const frase = estado === null ? '' : estado === 'demorada' ? frases.demorada : lista[estado];
  return (
    <View testID={testID}>
      {/* A região viva existe desde o começo: a primeira frase entra nela quando a espera aparece, e é anunciada uma vez. */}
      <Text accessibilityLiveRegion="polite" role="status" style={s.somenteLeitor}>{visivel ? lista[0] : ''}</Text>
      {visivel && (
        <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[s.cartao, compacta && s.cartaoCompacto, {
            opacity: entrada,
            transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          }]}>
          {compacta ? <Stu nome="stu-concentrado" tamanho={48} animado="laco" /> : <Stu nome="stu-concentrado" tamanho={72} animado="laco" />}
          <View style={s.corpo}>
            <Animated.Text testID={`${testID}-frase`} style={[s.frase, compacta && s.fraseCompacta, estado === 'demorada' && s.fraseDemorada, { opacity: opacidade }]}>
              {frase}
            </Animated.Text>
            <View style={s.barra} onLayout={(evento) => setLarguraBarra(evento.nativeEvent.layout.width)}>
              <Animated.View style={[s.barraCorre, reduzir !== false ? s.barraParada : {
                transform: [{ translateX: corrida.interpolate({ inputRange: [0, 1], outputRange: [-larguraBarra * 0.4, larguraBarra] }) }],
              }]} />
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  somenteLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  cartao: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2,
    borderColor: cores.nevoa, borderRadius: 18, backgroundColor: cores.superficieSutil },
  cartaoCompacto: { gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  corpo: { flex: 1, gap: 10, minWidth: 0 },
  frase: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  fraseCompacta: { fontSize: 15, lineHeight: 22 },
  fraseDemorada: { color: cores.textoSecundario, fontWeight: '600' },
  barra: { height: 4, overflow: 'hidden', borderRadius: 999, backgroundColor: cores.gelo },
  barraCorre: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', borderRadius: 999, backgroundColor: cores.acao },
  barraParada: { width: '100%', opacity: 0.35 },
});
