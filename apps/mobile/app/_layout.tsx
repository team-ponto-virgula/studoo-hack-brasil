import { mensagens } from '@studoo/contratos/experiencia';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cores, fontes } from '../src/tema';
import { BordaDeVoltar } from '../src/borda-voltar';

export default function Layout() {
  const [carregadas, erro] = useFonts({
    [fontes.titulo]: require('../assets/fontes/Quicksand.ttf'),
    [fontes.corpo]: require('../assets/fontes/Nunito.ttf'),
  });

  if (!carregadas && !erro) return <View style={estilos.inicio} />;

  // No iPhone, o gesto de voltar da borda esquerda envolve o app todo (borda-voltar.ios.tsx); no Android e na web, nada muda.
  return (
    <BordaDeVoltar>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: estilos.inicio }} />
    </BordaDeVoltar>
  );
}

/**
 * Uma falha inesperada de tela não fecha o app: o Stu avisa e a pessoa tenta de novo (a sessão e o progresso ficam no
 * servidor e no SecureStore). Só componentes básicos aqui, para a própria tela de erro não depender do que falhou.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={[estilos.inicio, estilos.falha]}>
      <StatusBar style="dark" />
      {/* Spec 13: `stu-surpreso` de 96, a imagem parada (só componentes básicos aqui, sem o mascote animado). */}
      <Image source={require('../assets/marca/stu/stu-surpreso-m.png')} resizeMode="contain" accessible={false} style={estilos.stu} />
      <Text accessibilityRole="alert" style={estilos.texto}>{mensagens.erros.falha}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={mensagens.tentar} onPress={() => void retry()}
        style={({ pressed }) => [estilos.botao, pressed && estilos.botaoPressionado]}>
        <Text style={estilos.botaoTexto}>{mensagens.tentar}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  inicio: { flex: 1, backgroundColor: cores.fundo },
  falha: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  stu: { width: 96, height: 96 },
  texto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 24, textAlign: 'center', maxWidth: 360 },
  botao: {
    minHeight: 50, minWidth: 220, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18,
    borderWidth: 2, borderBottomWidth: 5, borderRadius: 16, borderColor: cores.acao, borderBottomColor: cores.acaoEscura, backgroundColor: cores.acao,
  },
  botaoPressionado: { opacity: 0.82 },
  botaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
});
