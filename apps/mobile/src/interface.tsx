import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';

export function Tela({ children, acoes, rodape, pagina, rolagem, aoMedir, aoRolar }: {
  children: ReactNode;
  acoes?: ReactNode;
  rodape?: ReactNode;
  pagina: string;
  /** Referência da rolagem, para a tela levar a pessoa até um ponto do conteúdo (como o nó liberado na trilha). */
  rolagem?: Ref<ComponentRef<typeof ScrollView>>;
  /** Altura visível da rolagem, para a tela saber se um ponto do conteúdo já está à vista. */
  aoMedir?: (altura: number) => void;
  /** Quanto a pessoa já rolou, para a tela acompanhar o conteúdo que chega sem tirar a pessoa do lugar. */
  aoRolar?: (y: number) => void;
}) {
  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={estilos.marcaConteudo}>
          <Image source={require('../assets/marca/logo-com-sorriso.png')} resizeMode="contain"
            accessibilityLabel={mensagens.marca} accessible style={estilos.logo} />
          {acoes && <View style={estilos.acoes}>{acoes}</View>}
        </View>
      </View>

      <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key={pagina} ref={rolagem} keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.conteudo}
          onLayout={aoMedir && ((evento) => aoMedir(evento.nativeEvent.layout.height))}
          onScroll={aoRolar && ((evento) => aoRolar(evento.nativeEvent.contentOffset.y))} scrollEventThrottle={aoRolar ? 16 : undefined}>
          {children}
        </ScrollView>
        {rodape && <View style={estilos.rodape}><View style={estilos.rodapeConteudo}>{rodape}</View></View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Preferência de movimento reduzido do aparelho; `null` enquanto a resposta não chega.
 * Quem anima espera a resposta e, com movimento reduzido, mostra o estado final com a mesma informação.
 */
export function useMovimentoReduzido() {
  const [reduzir, setReduzir] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => { if (ativo) setReduzir(valor); })
      .catch(() => { if (ativo) setReduzir(false); });
    const assinatura = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzir);
    return () => {
      ativo = false;
      assinatura.remove();
    };
  }, []);

  return reduzir;
}

export function Titulo({ children, testID, foco = false, estilo }: {
  children: ReactNode;
  testID?: string;
  foco?: boolean;
  /** Ajuste de tamanho para o título dentro de um bloco, como a faixa da trilha. */
  estilo?: StyleProp<TextStyle>;
}) {
  const titulo = useRef<ComponentRef<typeof Text>>(null);

  useEffect(() => {
    if (foco && titulo.current) AccessibilityInfo.sendAccessibilityEvent(titulo.current, 'focus');
  }, [foco]);

  return <Text ref={titulo} testID={testID} accessible accessibilityRole="header" style={[estilos.titulo, estilo]}>{children}</Text>;
}

export function Botao({ rotulo, acao, testID, dica, desativado = false, ocupado = false, variante = 'primario', compacto = false }: {
  rotulo: string;
  acao: () => void;
  testID?: string;
  /** Complemento que o leitor de tela lê depois do rótulo, como o título da lição que o botão abre. */
  dica?: string;
  desativado?: boolean;
  ocupado?: boolean;
  variante?: 'primario' | 'secundario' | 'texto';
  compacto?: boolean;
}) {
  const [focado, setFocado] = useState(false);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={dica}
      accessibilityState={{ disabled: desativado, busy: ocupado }}
      disabled={desativado}
      onPress={acao}
      onFocus={() => setFocado(true)}
      onBlur={() => setFocado(false)}
      style={({ pressed }) => [
        estilos.botao,
        variante === 'secundario' && estilos.botaoSecundario,
        variante === 'texto' && estilos.botaoTextoLivre,
        compacto && estilos.botaoCompacto,
        pressed && estilos.botaoPressionado,
        focado && estilos.foco,
        desativado && estilos.botaoDesativado,
      ]}
    >
      <Text style={[estilos.botaoTexto, variante !== 'primario' && estilos.botaoTextoSecundario,
        compacto && estilos.botaoTextoCompacto, desativado && estilos.botaoTextoDesativado]}>{rotulo}</Text>
    </Pressable>
  );
}

export function Campo({ rotulo, campoRef, ...props }: TextInputProps & { rotulo: string; campoRef?: Ref<ComponentRef<typeof TextInput>> }) {
  const [focado, setFocado] = useState(false);
  const rotuloId = props.testID ? `rotulo-${props.testID}` : undefined;

  return (
    <View style={estilos.campo}>
      <Text nativeID={rotuloId} style={estilos.rotulo}>{rotulo}</Text>
      <TextInput {...props} ref={campoRef} accessibilityLabel={rotulo} accessibilityLabelledBy={rotuloId}
        placeholderTextColor={cores.textoSecundario}
        style={[estilos.entrada, props.multiline && estilos.entradaMultilinha, focado && estilos.entradaFocada, props.style]}
        onFocus={(evento) => { setFocado(true); props.onFocus?.(evento); }}
        onBlur={(evento) => { setFocado(false); props.onBlur?.(evento); }} />
    </View>
  );
}

export function EstadoMensagem({ mensagem, titulo, tipo = 'erro', testID, foco = false }: {
  mensagem: string;
  titulo?: string;
  tipo?: 'erro' | 'correto' | 'ajuste';
  testID?: string;
  foco?: boolean;
}) {
  const area = useRef<ComponentRef<typeof View>>(null);
  const cor = tipo === 'correto' ? cores.sucesso : tipo === 'ajuste' ? cores.alerta : cores.erro;

  useEffect(() => {
    if (foco && area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, [foco]);

  return (
    <View ref={area} testID={testID} accessible accessibilityRole="alert"
      accessibilityLabel={titulo ? `${titulo}. ${mensagem}` : mensagem}
      style={[estilos.mensagem, { borderColor: cor }]}>
      <Text importantForAccessibility="no" style={[estilos.sinal, { color: cor, borderColor: cor }]}>{tipo === 'correto' ? '✓' : '!'}</Text>
      <View style={estilos.mensagemConteudo}>
        {titulo && <Text style={[estilos.mensagemTitulo, { color: cor }]}>{titulo}</Text>}
        <Text style={[estilos.texto, tipo === 'erro' && { color: cor }]}>{mensagem}</Text>
      </View>
    </View>
  );
}

export function Skeleton({ texto = mensagens.carregando }: { texto?: string }) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel={texto} accessible style={estilos.skeleton}>
      <View style={estilos.skeletonCurto} />
      <View style={estilos.skeletonLinha} />
    </View>
  );
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { borderBottomWidth: 1, borderColor: cores.gelo },
  marcaConteudo: {
    width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 60,
  },
  logo: { width: 112, height: 38 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  conteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 32, letterSpacing: -1, lineHeight: 40 },
  subtitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  tituloBloco: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26 },
  texto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  textoSecundario: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  introducao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 24, marginTop: 8 },
  legenda: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  campo: { gap: 8 },
  rotulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  entrada: {
    minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 12,
    borderColor: cores.textoSecundario, color: cores.texto, backgroundColor: cores.fundo,
    fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24,
  },
  entradaMultilinha: { minHeight: 132, textAlignVertical: 'top' },
  entradaFocada: { borderColor: cores.acao, outlineColor: cores.acao, outlineWidth: 2, outlineOffset: 1, outlineStyle: 'solid' },
  mensagem: {
    marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1,
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  mensagemConteudo: { flex: 1, gap: 4 },
  mensagemTitulo: { fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  sinal: { width: 24, height: 24, textAlign: 'center', lineHeight: 22, borderRadius: 12, borderWidth: 1, fontFamily: fontes.corpo, fontWeight: '700' },
  skeleton: { marginTop: 20, gap: 8 },
  skeletonCurto: { width: '55%', height: 24, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonLinha: { width: '100%', height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  rodape: { borderTopWidth: 1, borderColor: cores.gelo, backgroundColor: cores.fundo },
  rodapeConteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 16, gap: 8 },
  botao: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 2, borderRadius: 20, borderColor: cores.acao, backgroundColor: cores.acao },
  botaoSecundario: { backgroundColor: cores.fundo },
  botaoTextoLivre: { borderColor: 'transparent', backgroundColor: 'transparent' },
  botaoCompacto: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 8, borderRadius: 12, flexShrink: 1 },
  botaoPressionado: { opacity: 0.82 },
  foco: { outlineColor: cores.acao, outlineWidth: 2, outlineOffset: 2, outlineStyle: 'solid' },
  botaoDesativado: { borderColor: cores.gelo, backgroundColor: cores.nevoa },
  botaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  botaoTextoSecundario: { color: cores.acao },
  botaoTextoCompacto: { fontSize: 14, lineHeight: 20 },
  botaoTextoDesativado: { color: cores.textoSecundario },
});
