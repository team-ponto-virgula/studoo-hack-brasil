import { useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Keyboard,
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
import { NavegacaoContexto } from './navegacao';
import { useMovimentoReduzido } from './movimento';
export { useMovimentoReduzido } from './movimento';

import { Icone } from './icone';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

export function Tela({ children, acoes, topo, rodape, pagina, rolagem, aoMedir, aoRolar, estiloConteudo, estiloRodape }: {
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
  /** Fundo do rodapé, como o verde ou o âmbar do retorno da aula. */
  estiloRodape?: StyleProp<ViewStyle>;
}) {
  const navegacao = useContext(NavegacaoContexto);
  const [teclado, setTeclado] = useState(false);
  useEffect(() => {
    const abriu = Keyboard.addListener('keyboardDidShow', () => setTeclado(true));
    const fechou = Keyboard.addListener('keyboardDidHide', () => setTeclado(false));
    return () => { abriu.remove(); fechou.remove(); };
  }, []);
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
        <ScrollView key={pagina} ref={rolagem} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[estilos.conteudo, estiloConteudo]}
          onLayout={aoMedir && ((evento) => aoMedir(evento.nativeEvent.layout.height))}
          onScroll={aoRolar && ((evento) => aoRolar(evento.nativeEvent.contentOffset.y))} scrollEventThrottle={aoRolar ? 16 : undefined}>
          <Entrada>{children}</Entrada>
        </ScrollView>
        {rodape && <View style={[estilos.rodape, estiloRodape]}><View style={estilos.rodapeConteudo}>{rodape}</View></View>}
      </KeyboardAvoidingView>
      {navegacao && !teclado && <NavegacaoInferior />}
    </SafeAreaView>
  );
}

/** Cada tela entra com uma subida curta, como na web; com movimento reduzido, já aparece pronta. */
function Entrada({ children }: { children: ReactNode }) {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir) {
      valor.setValue(1);
      return;
    }
    const animacao = Animated.timing(valor, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [reduzir, valor]);

  return (
    <Animated.View style={{ opacity: valor, transform: [{ translateY: valor.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {children}
    </Animated.View>
  );
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
export function Botao({ rotulo, acao, testID, dica, icone, desativado = false, ocupado = false, carregando = false, variante = 'primario',
  compacto = false }: {
  rotulo: string;
  acao: () => void;
  testID?: string;
  /** Complemento que o leitor de tela lê depois do rótulo, como o título da lição que o botão abre. */
  dica?: string;
  /** Ícone depois do rótulo, como a seta de "Continuar". */
  icone?: NomeIcone;
  desativado?: boolean;
  ocupado?: boolean;
  /** Mostra pontinhos pulando no lugar do rótulo, que segue como nome do botão para o leitor de tela. */
  carregando?: boolean;
  /** `sucesso` e `alerta` são o verde e o âmbar do retorno da aula, com contraste para o texto branco. */
  variante?: 'primario' | 'sucesso' | 'alerta' | 'secundario' | 'texto';
  compacto?: boolean;
}) {
  const [focado, setFocado] = useState(false);
  const reduzir = useMovimentoReduzido();
  const [pressao] = useState(() => new Animated.Value(1));
  const bloqueado = desativado || ocupado || carregando;
  function pressionar(destino: number) {
    pressao.stopAnimation();
    if (reduzir !== false) { pressao.setValue(1); return; }
    Animated.spring(pressao, { toValue: destino, speed: 36, bounciness: 2, useNativeDriver: true }).start();
  }
  useEffect(() => {
    if (bloqueado || reduzir !== false) { pressao.stopAnimation(); pressao.setValue(1); }
    return () => pressao.stopAnimation();
  }, [bloqueado, reduzir, pressao]);
  let corTexto: string = variante === 'primario' || variante === 'sucesso' || variante === 'alerta' ? cores.fundo : cores.acao;
  if (desativado) corTexto = cores.textoSecundario;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: bloqueado, busy: ocupado || carregando }}
      disabled={bloqueado}
      onPressIn={() => pressionar(0.97)}
      onPressOut={() => pressionar(1)}
      onPress={acao}
      onFocus={() => setFocado(true)}
      onBlur={() => setFocado(false)}
      style={({ pressed }) => [
        estilos.botao,
        variante === 'secundario' && estilos.botaoSecundario,
        variante === 'sucesso' && estilos.botaoSucesso,
        variante === 'alerta' && estilos.botaoAlerta,
        variante === 'texto' && estilos.botaoTextoLivre,
        compacto && estilos.botaoCompacto,
        pressed && variante !== 'texto' && estilos.botaoPressionado,
        pressed && variante === 'texto' && estilos.botaoPressionado,
        focado && estilos.foco,
        desativado && variante !== 'texto' && estilos.botaoDesativado,
      ]}
    >
      <Animated.View style={[estilos.botaoConteudo, { transform: [{ scale: pressao }] }]} pointerEvents="none">
      {carregando ? <Pontinhos cor={corTexto} /> : (
        <>
          <Text style={[estilos.botaoTexto, { color: corTexto }, compacto && estilos.botaoTextoCompacto]}>{rotulo}</Text>
          {icone && <Icone nome={icone} tamanho={18} cor={corTexto} />}
        </>
      )}
      </Animated.View>
    </Pressable>
  );
}

/** Três pontinhos que pulam em sequência, enquanto uma ação acontece; parados com movimento reduzido. */
export function Pontinhos({ cor }: { cor: string }) {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduzir !== false) return;
    const ciclo = Animated.loop(Animated.timing(valor, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    ciclo.start();
    return () => {
      ciclo.stop();
      valor.setValue(0);
    };
  }, [reduzir, valor]);

  return (
    <View style={estilos.pontinhos} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[0, 1, 2].map((indice) => {
        const comeco = indice * 0.16;
        return (
          <Animated.View key={indice} style={[estilos.pontinho, { backgroundColor: cor, transform: [{
            translateY: valor.interpolate({ inputRange: [0, comeco, comeco + 0.2, comeco + 0.4, 1], outputRange: [0, 0, -6, 0, 0], extrapolate: 'clamp' }),
          }] }]} />
        );
      })}
    </View>
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

/** Esqueleto que pulsa devagar enquanto o conteúdo carrega, como o brilho da web; parado com movimento reduzido. */
export function usePulso() {
  const reduzir = useMovimentoReduzido();
  const [valor] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reduzir !== false) return;
    const movimento = { duration: 750, easing: Easing.inOut(Easing.ease), isInteraction: false, useNativeDriver: true };
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(valor, { ...movimento, toValue: 0.55 }),
      Animated.timing(valor, { ...movimento, toValue: 1 }),
    ]));
    ciclo.start();
    return () => {
      ciclo.stop();
      valor.setValue(1);
    };
  }, [reduzir, valor]);

  return valor;
}

export function Skeleton({ texto = mensagens.carregando }: { texto?: string }) {
  const pulso = usePulso();
  return (
    <Animated.View accessibilityLiveRegion="polite" accessibilityLabel={texto} accessible style={[estilos.skeleton, { opacity: pulso }]}>
      <View style={estilos.skeletonCurto} />
      <View style={estilos.skeletonLinha} />
    </Animated.View>
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
  botaoSucesso: { borderColor: cores.sucesso, borderBottomColor: '#145A42', backgroundColor: cores.sucesso },
  botaoAlerta: { borderColor: cores.alerta, borderBottomColor: '#6E4100', backgroundColor: cores.alerta },
  pontinhos: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pontinho: { width: 8, height: 8, borderRadius: 4 },
  botaoTextoLivre: { borderColor: 'transparent', borderBottomColor: 'transparent', borderBottomWidth: 2, backgroundColor: 'transparent' },
  botaoCompacto: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 8, borderRadius: 12, flexShrink: 1 },
  botaoConteudo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  botaoPressionado: { opacity: 0.82 },
  foco: { outlineColor: cores.acao, outlineWidth: 2, outlineOffset: 2, outlineStyle: 'solid' },
  botaoDesativado: { borderColor: cores.gelo, borderBottomColor: cores.gelo, backgroundColor: cores.nevoa },
  botaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24, textAlign: 'center', flexShrink: 1 },
  botaoTextoCompacto: { fontSize: 14, lineHeight: 20 },
  botaoIcone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  botaoIconePressionado: { backgroundColor: cores.nevoa },
});

/** Dois destinos persistentes, fora das aulas e da geração para preservar o foco. */
function NavegacaoInferior() {
  const nav = useContext(NavegacaoContexto);
  if (!nav) return null;
  return <View style={navegacaoEstilos.faixa}>
    {([
      { id: 'planos', rotulo: mensagens.planos.titulo, icone: 'livro', acao: nav.planos },
      { id: 'objetivo', rotulo: mensagens.planos.novo, icone: 'lampada', acao: nav.criar },
    ] as const).map((item) => {
      const selecionado = item.id === nav.atual || item.id === 'planos' && nav.atual === 'plano';
      return <Pressable key={item.id} testID={`nav-${item.id}`} accessibilityRole="tab" accessibilityState={{ selected: selecionado, disabled: nav.ocupado }}
        aria-selected={selecionado} aria-disabled={nav.ocupado}
        accessibilityLabel={item.rotulo} disabled={nav.ocupado} onPress={item.acao}
        style={({ pressed }) => [navegacaoEstilos.item, selecionado && navegacaoEstilos.ativo, pressed && { opacity: 0.7 }]}>
        <IndicadorNavegacao icone={item.icone} selecionado={selecionado} />
        <Text style={[navegacaoEstilos.rotulo, selecionado && { color: cores.acao }]}>{item.rotulo}</Text>
      </Pressable>;
    })}
  </View>;
}
function IndicadorNavegacao({ icone, selecionado }: { icone: NomeIcone; selecionado: boolean }) {
  const reduzir = useMovimentoReduzido();
  const [escala] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!selecionado || reduzir !== false) { escala.setValue(1); return; }
    escala.setValue(0.85);
    const animacao = Animated.spring(escala, { toValue: 1, speed: 24, bounciness: 5, useNativeDriver: true });
    animacao.start();
    return () => { animacao.stop(); escala.setValue(1); };
  }, [selecionado, reduzir, escala]);
  return <Animated.View style={{ transform: [{ scale: escala }] }}>
    <Icone nome={icone} tamanho={22} cor={selecionado ? cores.acao : cores.textoSecundario} />
  </Animated.View>;
}
const navegacaoEstilos = StyleSheet.create({
  faixa: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: 1, borderColor: cores.gelo, backgroundColor: cores.fundo },
  item: { flex: 1, minHeight: 56, borderRadius: 18, padding: 6, alignItems: 'center', justifyContent: 'center', gap: 3 },
  ativo: { backgroundColor: cores.nevoa },
  rotulo: { fontFamily: fontes.corpo, fontSize: 12, fontWeight: '700', color: cores.textoSecundario, textAlign: 'center' },
});
