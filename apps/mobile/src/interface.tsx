import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icone } from './icone';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

export function Tela({ children, acoes, topo, rodape, pagina, rolagem, aoMedir, aoRolar, estiloConteudo }: {
  children: ReactNode;
  acoes?: ReactNode;
  /** Troca a faixa do topo (marca e ações) por outra, como a barra de andamento da lição. */
  topo?: ReactNode;
  rodape?: ReactNode;
  pagina: string;
  /** Referência da rolagem, para a tela levar a pessoa até um ponto do conteúdo (como o nó liberado na trilha). */
  rolagem?: Ref<ComponentRef<typeof ScrollView>>;
  /** Altura visível da rolagem, para a tela saber se um ponto do conteúdo já está à vista. */
  aoMedir?: (altura: number) => void;
  /** Quanto a pessoa já rolou, para a tela acompanhar o conteúdo que chega sem tirar a pessoa do lugar. */
  aoRolar?: (y: number) => void;
  estiloConteudo?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={estilos.marcaConteudo}>
          {topo ?? (
            <>
              <Logo />
              {acoes && <View style={estilos.acoes}>{acoes}</View>}
            </>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key={pagina} ref={rolagem} keyboardShouldPersistTaps="handled" contentContainerStyle={[estilos.conteudo, estiloConteudo]}
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

/**
 * Movimento que vai e volta sem parar (um balanço de -`amplitude` a 0), para o que precisa chamar a atenção enquanto
 * o estado dura, como o rótulo "Começar". Com movimento reduzido, fica parado.
 */
export function useBalanco(amplitude: number, duracao: number, ativo = true) {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduzir !== false || !ativo) {
      valor.setValue(0);
      return;
    }
    const movimento = { duration: duracao, easing: Easing.inOut(Easing.ease), isInteraction: false, useNativeDriver: true };
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(valor, { ...movimento, toValue: -amplitude }),
      Animated.timing(valor, { ...movimento, toValue: 0 }),
    ]));
    ciclo.start();
    return () => {
      ciclo.stop();
      valor.setValue(0);
    };
  }, [reduzir, ativo, amplitude, duracao, valor]);

  return valor;
}

export function Logo({ decorativo = false, estilo }: { decorativo?: boolean; estilo?: StyleProp<ImageStyle> }) {
  const subida = useBalanco(2, 1500);

  return (
    <Animated.Image source={require('../assets/marca/logo-com-sorriso.png')} resizeMode="contain"
      accessible={!decorativo} accessibilityLabel={decorativo ? undefined : mensagens.marca}
      importantForAccessibility={decorativo ? 'no' : 'auto'} accessibilityElementsHidden={decorativo}
      style={[estilos.logo, estilo, { transform: [{ translateY: subida }] }]} />
  );
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

/**
 * Botão com relevo, como na web: a face e um lábio mais escuro embaixo; no toque, a face desce até o lábio
 * (a altura total não muda, então nada pula na tela). O botão de texto não tem relevo.
 */
export function Botao({ rotulo, acao, testID, dica, icone, desativado = false, ocupado = false, variante = 'primario', compacto = false }: {
  rotulo: string;
  acao: () => void;
  testID?: string;
  /** Complemento que o leitor de tela lê depois do rótulo, como o título da lição que o botão abre. */
  dica?: string;
  /** Ícone depois do rótulo, como a seta de "Continuar". */
  icone?: NomeIcone;
  desativado?: boolean;
  ocupado?: boolean;
  /** `sucesso` é o primário verde, como o Continuar depois de uma resposta certa. */
  variante?: 'primario' | 'sucesso' | 'secundario' | 'texto';
  compacto?: boolean;
}) {
  const [focado, setFocado] = useState(false);
  let corTexto: string = variante === 'primario' || variante === 'sucesso' ? cores.fundo : cores.acao;
  if (desativado) corTexto = cores.textoSecundario;

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
        variante === 'sucesso' && estilos.botaoSucesso,
        variante === 'texto' && estilos.botaoTextoLivre,
        compacto && estilos.botaoCompacto,
        pressed && variante !== 'texto' && estilos.botaoAfundado,
        pressed && variante === 'texto' && estilos.botaoPressionado,
        focado && estilos.foco,
        desativado && variante !== 'texto' && estilos.botaoDesativado,
      ]}
    >
      <Text style={[estilos.botaoTexto, { color: corTexto }, compacto && estilos.botaoTextoCompacto]}>{rotulo}</Text>
      {icone && <Icone nome={icone} tamanho={18} cor={corTexto} />}
    </Pressable>
  );
}

export function Campo({ rotulo, campoRef, erro, acessorio, ...props }: TextInputProps & {
  rotulo: string;
  campoRef?: Ref<ComponentRef<typeof TextInput>>;
  /** Erro do campo, mostrado embaixo dele e lido pelo leitor de tela junto com a dica. */
  erro?: string;
  /** Algo dentro do campo, à direita, como o botão de mostrar a senha. */
  acessorio?: ReactNode;
}) {
  const [focado, setFocado] = useState(false);
  const rotuloId = props.testID ? `rotulo-${props.testID}` : undefined;
  const dica = [erro, props.accessibilityHint].filter(Boolean).join(' ') || undefined;

  return (
    <View style={estilos.campo}>
      <Text nativeID={rotuloId} style={estilos.rotulo}>{rotulo}</Text>
      <View>
        <TextInput {...props} ref={campoRef} accessibilityLabel={rotulo} accessibilityLabelledBy={rotuloId} accessibilityHint={dica}
          placeholderTextColor="#7A84A0"
          style={[estilos.entrada, props.multiline && estilos.entradaMultilinha, !!erro && estilos.entradaErro,
            focado && estilos.entradaFocada, !!acessorio && estilos.entradaComAcessorio, props.style]}
          onFocus={(evento) => { setFocado(true); props.onFocus?.(evento); }}
          onBlur={(evento) => { setFocado(false); props.onBlur?.(evento); }} />
        {acessorio && <View style={estilos.acessorio}>{acessorio}</View>}
      </View>
      {erro && (
        <View style={estilos.campoErro} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text style={[estilos.sinal, { color: cores.erro, borderColor: cores.erro }]}>!</Text>
          <Text style={estilos.campoErroTexto}>{erro}</Text>
        </View>
      )}
    </View>
  );
}

/** Botão só com ícone, de 44 pontos, como o de mostrar a senha ou o de fechar. */
export function BotaoIcone({ icone, rotulo, acao, selecionado, desativado = false, testID, cor = cores.textoSecundario }: {
  icone: NomeIcone;
  rotulo: string;
  acao: () => void;
  selecionado?: boolean;
  desativado?: boolean;
  testID?: string;
  cor?: string;
}) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desativado, ...(selecionado === undefined ? null : { selected: selecionado }) }}
      disabled={desativado} onPress={acao} onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
      style={({ pressed }) => [estilos.botaoIcone, pressed && estilos.botaoIconePressionado, focado && estilos.foco]}>
      <Icone nome={icone} tamanho={22} cor={cor} />
    </Pressable>
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
  const fundo = tipo === 'correto' ? '#E9F7EE' : tipo === 'ajuste' ? '#FFF3DE' : '#FFF5F6';

  useEffect(() => {
    if (foco && area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, [foco]);

  return (
    <View ref={area} testID={testID} accessible accessibilityRole="alert"
      accessibilityLabel={titulo ? `${titulo}. ${mensagem}` : mensagem}
      style={[estilos.mensagem, { borderColor: cor, backgroundColor: fundo }]}>
      <Text importantForAccessibility="no" style={[estilos.sinal, { color: cor, borderColor: cor, backgroundColor: cores.fundo }]}>{tipo === 'correto' ? '✓' : '!'}</Text>
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
  cabecalho: { borderBottomWidth: 2, borderColor: cores.nevoa },
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
    minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderRadius: 14,
    borderColor: cores.bordaCampo, color: cores.texto, backgroundColor: cores.fundo,
    fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24,
  },
  entradaMultilinha: { minHeight: 132, textAlignVertical: 'top' },
  entradaErro: { borderColor: cores.erro },
  entradaFocada: { borderColor: cores.acao, outlineColor: 'rgba(56, 88, 214, 0.18)', outlineWidth: 4, outlineOffset: 0, outlineStyle: 'solid' },
  entradaComAcessorio: { paddingRight: 52 },
  acessorio: { position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center' },
  campoErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campoErroTexto: { flex: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  mensagem: {
    marginTop: 16, padding: 12, borderRadius: 14, borderWidth: 2,
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
  },
  mensagemConteudo: { flex: 1, gap: 4 },
  mensagemTitulo: { fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  sinal: { width: 24, height: 24, textAlign: 'center', lineHeight: 22, borderRadius: 12, borderWidth: 1, fontFamily: fontes.corpo, fontWeight: '700' },
  skeleton: { marginTop: 20, gap: 8 },
  skeletonCurto: { width: '55%', height: 24, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonLinha: { width: '100%', height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  rodape: { borderTopWidth: 2, borderColor: cores.nevoa, backgroundColor: cores.fundo },
  rodapeConteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 16, gap: 10 },
  botao: {
    minHeight: 50, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 8,
    borderWidth: 2, borderBottomWidth: 5, borderRadius: 16, borderColor: cores.acao, borderBottomColor: cores.acaoEscura, backgroundColor: cores.acao,
  },
  botaoSecundario: { borderColor: cores.gelo, borderBottomColor: cores.gelo, backgroundColor: cores.fundo },
  botaoSucesso: { borderColor: cores.sucessoClaro, borderBottomColor: cores.sucesso, backgroundColor: cores.sucessoClaro },
  botaoTextoLivre: { borderColor: 'transparent', borderBottomColor: 'transparent', borderBottomWidth: 2, backgroundColor: 'transparent' },
  botaoCompacto: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 8, borderRadius: 12, flexShrink: 1 },
  botaoAfundado: { borderBottomWidth: 2, marginTop: 3 },
  botaoPressionado: { opacity: 0.82 },
  foco: { outlineColor: cores.acao, outlineWidth: 2, outlineOffset: 2, outlineStyle: 'solid' },
  botaoDesativado: { borderColor: cores.gelo, borderBottomColor: cores.gelo, backgroundColor: cores.nevoa },
  botaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24, textAlign: 'center', flexShrink: 1 },
  botaoTextoCompacto: { fontSize: 14, lineHeight: 20 },
  botaoIcone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  botaoIconePressionado: { backgroundColor: cores.nevoa },
});
