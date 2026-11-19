import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ImageStyle,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { NavegacaoContexto } from './navegacao';
import { useMovimentoReduzido } from './movimento';
export { useMovimentoReduzido } from './movimento';

import { Icone } from './icone';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';
import { focoVisivel } from './foco';

/**
 * Quanto o conteúdo da tela começa abaixo do topo da rolagem por causa da barra da marca, que rola junto (como na web).
 * Quem mede posições para rolar até um ponto (o caminho na geração) soma este valor; com a faixa parada no alto, é 0.
 */
export const DeslocamentoDaRolagem = createContext<number | null>(0);
/**
 * Rola a tela até um elemento dela (medido dentro da rolagem), com uma folga no alto: o `scrollIntoView` da web, para
 * quem abre um bloco no fim da tela ("Adicionar por link") e precisa trazê-lo para cima do teclado e da barra de baixo.
 */
export const RolagemDaTela = createContext<{ rolarAte: (no: ComponentRef<typeof View> | null, folga?: number) => void } | null>(null);
/** Altura da faixa que fica presa no alto da tela (o cabeçalho da trilha), para quem rola descontar o que ela cobre. */
export const AlturaDaFaixaFixa = createContext(0);

export function Tela({ children, acoes, topo, rodape, pagina, semCabecalho = false, semLinha = false, abaixoDoLogo, faixaFixa, rolagem, aoMedir, aoRolar, aoMedirConteudo, estiloConteudo, estiloRodape, estiloRodapeConteudo }: {
  children: ReactNode;
  acoes?: ReactNode;
  /** Troca a faixa do topo (marca e ações) por outra, como a barra de andamento da lição. */
  topo?: ReactNode;
  rodape?: ReactNode;
  pagina: string;
  semCabecalho?: boolean;
  /** Sem a linha embaixo da faixa do alto, como a barra da aula na web. */
  semLinha?: boolean;
  /** Linha a mais na barra da marca, embaixo do logo (o selo "Progresso salvo agora" de Minhas trilhas e do mapa, como na web). */
  abaixoDoLogo?: ReactNode;
  /** Faixa que rola com a página até o alto e fica parada lá (o cabeçalho da trilha, como o .trilha-topo da web no celular). */
  faixaFixa?: ReactNode;
  /** Referência da rolagem, para a tela levar a pessoa até um ponto do conteúdo (como o nó liberado na trilha). */
  rolagem?: Ref<ComponentRef<typeof ScrollView>>;
  /** Altura visível da rolagem, para a tela saber se um ponto do conteúdo já está à vista. */
  aoMedir?: (altura: number) => void;
  /** Quanto a pessoa já rolou, para a tela acompanhar o conteúdo que chega sem tirar a pessoa do lugar. */
  aoRolar?: (y: number) => void;
  /** Altura de todo o conteúdo, para a tela saber se ainda tem coisa abaixo da parte visível. */
  aoMedirConteudo?: (altura: number) => void;
  estiloConteudo?: StyleProp<ViewStyle>;
  /** Fundo do rodapé, como o verde ou o âmbar do retorno da aula. */
  estiloRodape?: StyleProp<ViewStyle>;
  /** Margens do rodapé quando a tela da web usa outras (a aula usa 16; a entrada, 24). */
  estiloRodapeConteudo?: StyleProp<ViewStyle>;
}) {
  const navegacao = useContext(NavegacaoContexto);
  const reduzirMovimento = useMovimentoReduzido();
  const rolagemInterna = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const referenciaDaRolagem = (no: ComponentRef<typeof ScrollView> | null) => {
    rolagemInterna.current = no;
    if (typeof rolagem === 'function') rolagem(no);
    else if (rolagem) (rolagem as { current: ComponentRef<typeof ScrollView> | null }).current = no;
  };
  const rolarAte = (no: ComponentRef<typeof View> | null, folga = 16) => {
    const tela = rolagemInterna.current;
    const conteudo = tela?.getInnerViewRef?.();
    if (!tela || !conteudo || !no) return;
    no.measureLayout(conteudo as never, (_x, y) => tela.scrollTo({ y: Math.max(0, y - folga), animated: reduzirMovimento === false }), () => undefined);
  };
  const [teclado, setTeclado] = useState(false);
  const [alturaCabecalho, setAlturaCabecalho] = useState(0);
  const [alturaFaixa, setAlturaFaixa] = useState(0);
  const cabecalhoNaRolagem = !topo && !semCabecalho;
  useEffect(() => {
    const abriu = Keyboard.addListener('keyboardDidShow', () => setTeclado(true));
    const fechou = Keyboard.addListener('keyboardDidHide', () => setTeclado(false));
    return () => { abriu.remove(); fechou.remove(); };
  }, []);
  // Como na web, a barra da marca rola junto com a página e sai de vista; só a faixa própria da tela (a barra da aula, o
  // nome da trilha) fica parada no alto.
  // Entrada e recuperação usam o logo de 112 da web (.entrada-cabecalho, .recuperar-topo); as telas de estudo, o de 102
  // (.estudo-cabecalho até 767 px, com 64 de altura e 16 nos lados).
  const paginaDeAcesso = pagina === 'entrada' || Boolean(pagina?.startsWith('recuperar'));
  const cabecalho = !semCabecalho && (
    <View style={[estilos.cabecalho, semLinha && { borderBottomWidth: 0 }]}>
      <View style={[estilos.marcaConteudo, !topo && paginaDeAcesso && estilos.marcaAcesso, !topo && !paginaDeAcesso && estilos.marcaEstudo, !topo && !paginaDeAcesso && Boolean(abaixoDoLogo) && estilos.marcaComSelo]}>
        {topo ?? (
          <>
            <Logo estilo={paginaDeAcesso ? undefined : estilos.logoEstudo} />
            {acoes && <View style={estilos.acoes}>{acoes}</View>}
          </>
        )}
      </View>
      {!topo && abaixoDoLogo && <View style={[estilos.abaixoDoLogo, !paginaDeAcesso && estilos.abaixoDoLogoEstudo]}>{abaixoDoLogo}</View>}
    </View>
  );
  return (
    <SafeAreaView style={estilos.tela}>
      {topo && cabecalho}

      {/* No Android com edge-to-edge (padrão do build), a janela não encolhe com o teclado: sem o padding, o rodapé e os
          campos de baixo ficavam atrás dele. Se a janela encolher, a sobreposição medida é zero e nada muda. */}
      <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        {/* No navegador, o "on-drag" do React Native Web tira o foco do campo a cada rolagem, até a que a própria tela faz
            (o campo do Explique perdia o foco depois da queda da conversa ao vivo); lá, como na web, rolar não tira o foco. */}
        <ScrollView key={pagina} ref={referenciaDaRolagem} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
          contentContainerStyle={estilos.rolagemConteudo}
          // O vão de 20 acima da faixa é um filho à parte: a faixa gruda colada no topo (com margem, ela parava 20 abaixo).
          stickyHeaderIndices={faixaFixa ? [(cabecalhoNaRolagem ? 1 : 0) + 1] : undefined}
          onLayout={aoMedir && ((evento) => aoMedir(evento.nativeEvent.layout.height))}
          onScroll={aoRolar && ((evento) => aoRolar(evento.nativeEvent.contentOffset.y))} scrollEventThrottle={aoRolar ? 16 : undefined}
          onContentSizeChange={aoMedirConteudo && ((_largura, altura) => aoMedirConteudo(altura))}>
          {cabecalhoNaRolagem && <View onLayout={(evento) => setAlturaCabecalho(evento.nativeEvent.layout.height)}>{cabecalho}</View>}
          {faixaFixa && <View style={estilos.faixaVao} />}
          {faixaFixa && <FundoDeBarra estilo={estilos.faixaFixa} estiloVidro={estilos.faixaFixaVidro} onLayout={(evento) => setAlturaFaixa(evento.nativeEvent.layout.height)}>{faixaFixa}</FundoDeBarra>}
          {/* .estudo-principal no celular: 28 em cima, também com o selo de sincronia (a barra tem a altura da da web). */}
          <View style={[estilos.conteudo, !topo && !paginaDeAcesso && estilos.conteudoEstudo, estiloConteudo]}>
            {/* null enquanto a barra da marca ou a faixa parada ainda não foram medidas: quem rola até um ponto espera. */}
            <DeslocamentoDaRolagem.Provider value={(cabecalhoNaRolagem && !alturaCabecalho) || (faixaFixa && !alturaFaixa) ? null
              : (cabecalhoNaRolagem ? alturaCabecalho : 0) + (faixaFixa ? 20 + alturaFaixa : 0)}>
              <AlturaDaFaixaFixa.Provider value={faixaFixa ? alturaFaixa : 0}>
                <RolagemDaTela.Provider value={{ rolarAte }}>
                  <Entrada>{children}</Entrada>
                </RolagemDaTela.Provider>
              </AlturaDaFaixaFixa.Provider>
            </DeslocamentoDaRolagem.Provider>
          </View>
        </ScrollView>
        {/* O rodapé de feedback (verde ou laranja) é conteúdo e fica com a cor de hoje; o neutro vira vidro no iOS 26. */}
        {rodape && <FundoDeBarra estilo={[estilos.rodape, estiloRodape]} estiloVidro={estiloRodape ? undefined : estilos.rodapeVidro}>
          <View style={[estilos.rodapeConteudo, estiloRodapeConteudo]}>{rodape}</View>
        </FundoDeBarra>}
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

/**
 * Linhas de tamanho parecido, como o `text-wrap: balance` da web. No Android vem do textBreakStrategy="balanced"; na prévia
 * web, o React Native Web repassa o `textWrap` ao CSS. No iOS, quebra como sempre.
 */
export const quebraEquilibrada = (Platform.OS === 'web' ? { textWrap: 'balance' } : {}) as TextStyle;
/** `text-wrap: pretty` da web (sem palavra sozinha na última linha), só na prévia web. */
export const quebraSemViuva = (Platform.OS === 'web' ? { textWrap: 'pretty' } : {}) as TextStyle;

export function Titulo({ children, testID, foco = false, estilo, linhas, equilibrado = false }: {
  /** Corta o título em tantas linhas (a barra do plano usa uma). */
  linhas?: number;
  /** Linhas de tamanho parecido, como o `text-wrap: balance` da web (no Android; o iOS e a prévia web quebram como sempre). */
  equilibrado?: boolean;
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

  return <Text ref={titulo} testID={testID} accessible accessibilityRole="header" numberOfLines={linhas} textBreakStrategy={equilibrado ? 'balanced' : undefined}
    style={[estilos.titulo, equilibrado && quebraEquilibrada, estilo]}>{children}</Text>;
}

/**
 * Botão com relevo, como na web: a face e um lábio mais escuro embaixo; no toque, a face desce até o lábio
 * (a altura total não muda, então nada pula na tela). O botão de texto não tem relevo.
 */
export function Botao({ rotulo, acao, testID, dica, icone, iconeAntes, desativado = false, ocupado = false, carregando = false, variante = 'primario',
  compacto = false, esmaecido = false, fonte, estilo, nomeAcessivel, peso, giroIcone }: {
  /** Ícone antes do rótulo, como `<Icone />{texto}` nos botões da web (Compartilhar, Copiar link, Editar perfil): 18 px. */
  iconeAntes?: NomeIcone;
  /** Giro do ícone (a seta de "Continuar lendo" aponta para baixo, como .botao--ler-mais .icone da web). */
  giroIcone?: '90deg' | '180deg';
  /** Peso do texto quando a web usa outro (os botões do rodapé da aula têm 900, .aula-rodape__acoes > .botao). */
  peso?: '800' | '900';
  /** Nome para o leitor de tela quando o texto visível sozinho fica ambíguo ("Começar: <título>", como na web). */
  nomeAcessivel?: string;
  /** Tamanho do texto quando a web usa outro (o "Pular" da apresentação tem 16 px mesmo compacto). */
  fonte?: number;
  /** Ajuste de caixa quando a web usa outro tamanho (o "Montar minha trilha" tem face de 56 px). */
  estilo?: StyleProp<ViewStyle>;
  /** Parece desativado, mas responde ao toque e leva ao que falta (como contar como foi a prática). Como na web. */
  esmaecido?: boolean;
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
  variante?: 'primario' | 'sucesso' | 'alerta' | 'secundario' | 'texto' | 'destrutivo';
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
  let corTexto: string = variante === 'primario' || variante === 'sucesso' || variante === 'alerta' ? cores.fundo : variante === 'destrutivo' ? '#B3261E' : cores.acao;
  if (desativado || esmaecido) corTexto = cores.textoSecundario;
  // Como .botao da web: a face de 48 com borda de 2 que fecha em volta e o degrau de 4 por fora, na cor do lábio
  // (--labio); nos botões claros, a borda e o degrau somam a faixa de 6 da web. O botão de texto não tem degrau.
  const comDegrau = variante !== 'texto';
  const apagado = desativado || esmaecido;
  const labio = apagado ? cores.gelo : variante === 'primario' ? cores.acaoEscura : variante === 'sucesso' ? '#145A42' : variante === 'alerta' ? '#6E4100' : cores.gelo;
  const { fora, face } = separarEstilo(estilo);
  const conteudo = (
    <Animated.View style={[estilos.botaoConteudo, { transform: [{ scale: pressao }] }]} pointerEvents="none">
      {carregando ? <Pontinhos cor={corTexto} /> : (
        <>
          {iconeAntes && <Icone nome={iconeAntes} tamanho={18} cor={corTexto} />}
          <Text style={[estilos.botaoTexto, { color: corTexto }, compacto && estilos.botaoTextoCompacto, fonte !== undefined && { fontSize: fonte, lineHeight: Math.round(fonte * 1.5) },
            peso !== undefined && { fontWeight: peso }]}>{rotulo}</Text>
          {icone && <View style={giroIcone ? { transform: [{ rotate: giroIcone }] } : undefined}><Icone nome={icone} tamanho={20} cor={corTexto} sistema /></View>}
        </>
      )}
    </Animated.View>
  );

  if (comDegrau) {
    return (
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={nomeAcessivel ?? rotulo} accessibilityHint={dica}
        accessibilityState={{ disabled: bloqueado, busy: ocupado || carregando }} disabled={bloqueado}
        onPressIn={() => pressionar(0.97)} onPressOut={() => pressionar(1)} onPress={acao}
        onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
        // A caixa ocupa os 48 da face, como na web; o degrau desce por fora, no vão de baixo (como a sombra de .botao).
        style={({ pressed }) => [degrauFora(4, 16, labio, pressed), compacto && estilos.botaoDegrauCompacto, fora, focado && estilos.foco]}>
        <View style={[estilos.botaoFace, variante === 'secundario' && estilos.botaoFaceSecundaria, variante === 'sucesso' && estilos.botaoFaceSucesso,
          variante === 'alerta' && estilos.botaoFaceAlerta, variante === 'destrutivo' && estilos.botaoFaceDestrutiva,
          compacto && estilos.botaoFaceCompacta, face, apagado && estilos.botaoFaceApagada]}>
          {conteudo}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={nomeAcessivel ?? rotulo}
      accessibilityHint={dica}
      accessibilityState={{ disabled: bloqueado, busy: ocupado || carregando }}
      disabled={bloqueado}
      onPressIn={() => pressionar(0.97)}
      onPressOut={() => pressionar(1)}
      onPress={acao}
      onFocus={() => setFocado(focoVisivel())}
      onBlur={() => setFocado(false)}
      style={({ pressed }) => [estilos.botao, estilos.botaoTextoLivre, compacto && estilos.botaoCompacto, estilo,
        pressed && estilos.botaoPressionado, focado && estilos.foco]}
    >
      {conteudo}
    </Pressable>
  );
}

/** Separa o estilo de quem chama: o que posiciona vai para fora (o degrau); o resto, para a face. */
const CHAVES_DE_FORA = new Set(['alignSelf', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'maxWidth', 'minWidth', 'position', 'top', 'left',
  'right', 'bottom', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'zIndex']);
function separarEstilo(estilo?: StyleProp<ViewStyle>): { fora: ViewStyle; face: ViewStyle } {
  const plano = (StyleSheet.flatten(estilo) ?? {}) as Record<string, unknown>;
  const fora: Record<string, unknown> = {}; const face: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(plano)) (CHAVES_DE_FORA.has(chave) ? fora : face)[chave] = valor;
  return { fora: fora as ViewStyle, face: face as ViewStyle };
}

/** Fundo em degradê como o background da web (linear-gradient em CSS): no navegador, background-image; no aparelho, o
 * experimental_backgroundImage do React Native. */
export function degrade(css: string): ViewStyle {
  return (Platform.OS === 'web' ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;
}

/**
 * O degrau de baixo das caixas da web (box-shadow: 0 <altura>px 0 <cor>): o pai pinta o degrau embaixo da face e não ocupa
 * lugar (a margem negativa devolve a altura), como a sombra da web. Afundado (:active), a face desce e sobra 1 px.
 */
export function degrauFora(altura: number, raio: number, cor: string, afundado = false): ViewStyle {
  return afundado
    ? { borderRadius: raio, backgroundColor: cor, paddingBottom: 1, marginTop: altura - 1, marginBottom: -altura }
    : { borderRadius: raio, backgroundColor: cor, paddingBottom: altura, marginBottom: -altura };
}

/** Três pontinhos que pulam em sequência, enquanto uma ação acontece; parados com movimento reduzido. */
export function Pontinhos({ cor, tamanho = 8, vao = 5 }: { cor: string; tamanho?: number; vao?: number }) {
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
    <View style={[estilos.pontinhos, { gap: vao }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {[0, 1, 2].map((indice) => {
        const comeco = indice * 0.16;
        return (
          <Animated.View key={indice} style={[estilos.pontinho, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor, transform: [{
            translateY: valor.interpolate({ inputRange: [0, comeco, comeco + 0.2, comeco + 0.4, 1], outputRange: [0, 0, -6, 0, 0], extrapolate: 'clamp' }),
          }] }]} />
        );
      })}
    </View>
  );
}

export function Campo({ rotulo, campoRef, erro, acessorio, rotuloOculto = false, estiloRotulo, ...props }: TextInputProps & {
  rotulo: string;
  /** Estilo do rótulo quando a web usa outro (o "Sua explicação" do Explique tem 16 px e peso normal). */
  estiloRotulo?: StyleProp<TextStyle>;
  /** Rótulo só para o leitor de tela (a web usa .somente-leitor quando o título da tela já faz a pergunta). */
  rotuloOculto?: boolean;
  campoRef?: Ref<ComponentRef<typeof TextInput>>;
  /** Erro do campo, mostrado embaixo dele e lido pelo leitor de tela junto com a dica. */
  erro?: string;
  /** Algo dentro do campo, à direita, como o botão de mostrar a senha. */
  acessorio?: ReactNode;
}) {
  const [focado, setFocado] = useState(false);
  const rotuloId = props.testID ? `rotulo-${props.testID}` : undefined;
  const dica = [erro, props.accessibilityHint].filter(Boolean).join(' ') || undefined;
  // O campo guarda a própria referência e repassa a de fora (quem usa o Campo também foca o campo).
  const interno = useRef<ComponentRef<typeof TextInput> | null>(null);
  const referencia = (no: ComponentRef<typeof TextInput> | null) => {
    interno.current = no;
    if (typeof campoRef === 'function') campoRef(no);
    else if (campoRef) (campoRef as { current: ComponentRef<typeof TextInput> | null }).current = no;
  };

  return (
    <View style={estilos.campo}>
      {/* Como o <label> da web: tocar no rótulo leva o foco ao campo. Não é mais uma parada do leitor de tela: o campo já tem
          o rótulo como nome. */}
      {!rotuloOculto && (
        <Text nativeID={rotuloId} style={[estilos.rotulo, estiloRotulo]} accessible={false} suppressHighlighting
          onPress={() => interno.current?.focus()}>{rotulo}</Text>
      )}
      <View>
        <TextInput {...props} ref={referencia} accessibilityLabel={rotulo} accessibilityLabelledBy={rotuloOculto ? undefined : rotuloId} accessibilityHint={dica}
          placeholderTextColor={props.placeholderTextColor ?? '#7A84A0'}
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

/** Botão só com ícone, de 48 dp (o alvo mínimo de toque do Android), como o de mostrar a senha ou o de fechar. */
export function BotaoIcone({ icone, rotulo, acao, selecionado, desativado = false, testID, cor = cores.textoSecundario, tamanho = 22, traco }: {
  /** Tamanho do ícone (o X da aula tem 26 px, como .aula-fechar da web). */
  tamanho?: number;
  /** Traço do ícone na grade de 24 (o X da aula tem 3, como o stroke-width de .aula-fechar .icone). */
  traco?: number;
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
      disabled={desativado} onPress={acao} onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)} hitSlop={2}
      style={({ pressed }) => [estilos.botaoIcone, pressed && estilos.botaoIconePressionado, focado && estilos.foco]}>
      <Icone nome={icone} tamanho={tamanho} cor={cor} traco={traco} sistema />
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

/** A ação de um estado de erro: "Tentar novamente" ou "Ver minhas trilhas" (uma só por cartão, como na web). */
export type AcaoDoErro = { rotulo: string; acao: () => void; testID?: string; desativado?: boolean };

/**
 * Estado de erro como o da web (rodadas 3A e 3A.1): um cartão só, com o Stu, o texto do erro e no máximo uma ação. O texto
 * é um alerta e, com `foco`, recebe o foco do leitor de tela; a ação fica logo embaixo, dentro do cartão.
 */
export function EstadoErro({ mensagem, acao, testID, foco = false, estilo }: {
  /** Margens de fora (nas listas, a web põe o cartão colado no respiro da página e 16 antes do título). */
  estilo?: StyleProp<ViewStyle>;
  mensagem: string;
  acao?: AcaoDoErro;
  testID?: string;
  foco?: boolean;
}) {
  const area = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (foco && area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, [foco]);

  return (
    <View testID={testID} style={[estilos.estadoErro, estilo]}>
      <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false} importantForAccessibility="no"
        style={estilos.estadoErroStu} />
      <View style={estilos.estadoErroCorpo}>
        <View ref={area} accessible accessibilityRole="alert" accessibilityLabel={mensagem} style={estilos.estadoErroTexto}>
          {/* O "!" da web só tem a borda (fundo transparente, sobre a cor do cartão de erro). */}
          <Text importantForAccessibility="no" style={[estilos.sinal, { color: cores.erro, borderColor: cores.erro }]}>!</Text>
          <Text style={[estilos.texto, { flex: 1, color: cores.erro }]}>{mensagem}</Text>
        </View>
        {acao && <Botao rotulo={acao.rotulo} testID={acao.testID} variante="secundario" desativado={acao.desativado} acao={acao.acao}
          estilo={{ alignSelf: 'flex-start' }} />}
      </View>
    </View>
  );
}

/**
 * A seta de abrir e fechar da web (`summary::before`): um canto de 8 px com traço de 2,5 px, que aponta para a direita
 * fechado (›) e para baixo aberto.
 */
export function Chevron({ aberto = false, cor = cores.texto }: { aberto?: boolean; cor?: string }) {
  return (
    <View importantForAccessibility="no" accessibilityElementsHidden
      style={[estilos.chevron, { borderColor: cor, transform: [{ rotate: aberto ? '45deg' : '-45deg' }] }]} />
  );
}

/** Linha de abrir e fechar como `details > summary` da web: a seta e o texto 16 px/800, alinhados à esquerda. */
export function LinhaAbrir({ rotulo, aberto, alternar, testID, cor = cores.texto, desativado = false }: {
  rotulo: string;
  aberto: boolean;
  alternar: () => void;
  testID?: string;
  cor?: string;
  desativado?: boolean;
}) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ expanded: aberto, disabled: desativado }} aria-expanded={aberto}
      disabled={desativado} hitSlop={6} onPress={alternar} onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
      style={({ pressed }) => [estilos.linhaAbrir, pressed && { opacity: 0.7 }, focado && estilos.foco]}>
      <Chevron aberto={aberto} cor={cor} />
      <Text style={[estilos.linhaAbrirTexto, { color: cor }]}>{rotulo}</Text>
    </Pressable>
  );
}

/** Selo "Modo demonstração", como `.estudio-selo` da web: pílula amarela cheia (#FFF1CC), sem borda, texto 0,8rem/800. */
/** `emLinha`: o selo como <span> numa linha flexível (entrelinha de 1,5 → 19,2), e não como <p> do cartão (1,6 → 20,48). */
export function SeloDemonstracao({ estilo, emLinha = false }: { estilo?: StyleProp<ViewStyle>; emLinha?: boolean }) {
  return <View style={[estilos.seloDemo, estilo]}><Text style={[estilos.seloDemoTexto, emLinha && { lineHeight: 19.2 }]}>{mensagens.estudio.simulado}</Text></View>;
}

/**
 * Caixa alta pelo estilo, como o `text-transform: uppercase` da web: a tela mostra maiúsculas e o leitor de tela lê o texto
 * original (com o texto já em maiúsculas, o TalkBack pode soletrar a palavra).
 */
export const caixaAlta = { textTransform: 'uppercase' } as const;

/**
 * Cartão de confirmação como .modal-cartao da web: o fundo escurece, a pergunta vem em 1,05rem/800 e as ações ficam à
 * direita, "Cancelar" (secundário) e a confirmação (vermelha quando apaga). Tocar fora ou no voltar do aparelho cancela.
 */
type PropsConfirmacao = {
  mensagem: string;
  confirmarRotulo: string;
  /** Texto embaixo da pergunta, como o DialogoConfirmar da web (título, texto e duas ações). */
  texto?: string;
  /** Rótulo da ação segura quando não é "Cancelar" ("Continuar compartilhando", "Manter foto", "Continuar editando"). */
  cancelarRotulo?: string;
  destrutivo?: boolean;
  ocupado?: boolean;
  aoCancelar: () => void;
  aoConfirmar: () => void;
};

export function CartaoConfirmacao(props: PropsConfirmacao) {
  if (Platform.OS === 'ios') return <ConfirmacaoDoSistema {...props} />;
  const { mensagem, confirmarRotulo, texto, cancelarRotulo = mensagens.geracao.cancelar, destrutivo = false, ocupado = false, aoCancelar, aoConfirmar } = props;
  const estreito = useWindowDimensions().width <= 420;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => { if (!ocupado) aoCancelar(); }}>
      <Pressable testID="confirmacao-fundo" accessible={false} style={estilos.modalFundo} onPress={() => { if (!ocupado) aoCancelar(); }}>
        {texto ? (
          // Com título e texto, como o DialogoConfirmar da web (.folha--confirmar): título de 22, texto e as duas ações, a
          // segura primeiro; até 420 de largura, uma embaixo da outra e na largura toda (.folha-acoes--par no celular).
          <Pressable testID="confirmacao" accessible={false} accessibilityViewIsModal role="alertdialog" aria-modal style={estilos.dialogoCartao} onPress={() => {}}>
            <Text accessibilityRole="header" style={estilos.dialogoTitulo}>{mensagem}</Text>
            <Text style={estilos.dialogoTexto}>{texto}</Text>
            <View style={[estilos.dialogoAcoes, estreito && estilos.dialogoAcoesEmpilhadas]}>
              <Botao rotulo={cancelarRotulo} testID="confirmacao-cancelar" variante="secundario" desativado={ocupado} acao={aoCancelar} />
              <Botao rotulo={confirmarRotulo} testID="confirmacao-confirmar" variante={destrutivo ? 'destrutivo' : 'primario'} desativado={ocupado} acao={aoConfirmar} />
            </View>
          </Pressable>
        ) : (
          <Pressable testID="confirmacao" accessible={false} accessibilityViewIsModal role="dialog" aria-modal style={estilos.modalCartao} onPress={() => {}}>
            <Text accessibilityRole="header" style={estilos.modalMensagem}>{mensagem}</Text>
            <View style={estilos.modalAcoes}>
              <Botao rotulo={cancelarRotulo} testID="confirmacao-cancelar" variante="secundario" desativado={ocupado} acao={aoCancelar} />
              <Botao rotulo={confirmarRotulo} testID="confirmacao-confirmar" variante={destrutivo ? 'destrutivo' : 'primario'} desativado={ocupado} acao={aoConfirmar} />
            </View>
          </Pressable>
        )}
      </Pressable>
    </Modal>
  );
}

/**
 * No iPhone, a confirmação é o alerta do sistema (UIAlertController), com o mesmo texto e as mesmas duas ações: "Cancelar"
 * e a confirmação, em vermelho quando apaga. Quem usa já tira a confirmação da tela antes de rodar a ação.
 */
function ConfirmacaoDoSistema({ mensagem, confirmarRotulo, texto, cancelarRotulo = mensagens.geracao.cancelar, destrutivo = false, aoCancelar, aoConfirmar }: PropsConfirmacao) {
  const acoes = useRef({ aoCancelar, aoConfirmar });
  acoes.current = { aoCancelar, aoConfirmar };
  useEffect(() => {
    Alert.alert(mensagem, texto, [
      { text: cancelarRotulo, style: 'cancel', onPress: () => acoes.current.aoCancelar() },
      { text: confirmarRotulo, style: destrutivo ? 'destructive' : 'default', onPress: () => acoes.current.aoConfirmar() },
    ]);
  }, [mensagem, texto, cancelarRotulo, confirmarRotulo, destrutivo]);
  return null;
}

/** Liquid Glass só no iPhone com iOS 26 ou mais novo (expo-glass-effect); no iOS anterior, no Android e na prévia web, o fundo de hoje. */
const VIDRO = Platform.OS === 'ios' && (() => {
  try { return isLiquidGlassAvailable(); } catch { return false; }
})();

/**
 * Fundo das barras que ficam por cima do conteúdo (rodapé, barra de baixo, faixa fixa do mapa). Com vidro, `estiloVidro`
 * substitui o estilo de hoje (sem fundo branco nem linha: o vidro é o fundo); sem `estiloVidro`, a barra fica como hoje.
 */
function FundoDeBarra({ estilo, estiloVidro, children, ...resto }: ViewProps & { estilo: StyleProp<ViewStyle>; estiloVidro?: StyleProp<ViewStyle> }) {
  // O app é sempre claro (userInterfaceStyle "light"): o vidro também.
  if (VIDRO && estiloVidro) return <GlassView glassEffectStyle="regular" colorScheme="light" style={estiloVidro} {...resto}>{children}</GlassView>;
  return <View style={estilo} {...resto}>{children}</View>;
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

/** Busca de progresso no servidor: atualizando, atualizada (quando) ou sem conexão. Só cliente, sem mudança de API. */
export type Sincronia = { estado: 'atualizando' | 'atualizado' | 'offline'; em: number | null };

/** Texto do selo, como na web: "Atualizando…", "Atualizado agora / há N min" ou "Sem conexão: …". */
export function textoSincronia(sincronia: Sincronia, agora: number) {
  const m = mensagens.sincronia;
  if (sincronia.estado === 'atualizando') return m.atualizando;
  if (sincronia.estado === 'offline') return m.offline;
  if (!sincronia.em) return m.salvo;
  const minutos = Math.floor((agora - sincronia.em) / 60_000);
  return minutos < 1 ? m.agora : m.minutos(minutos);
}

/**
 * Selo discreto de sincronia (um por tela): reflete a última busca real no servidor. O ponto pulsa enquanto atualiza
 * (parado com movimento reduzido) e o selo fica âmbar sem conexão. O "há N min" se atualiza sozinho.
 */
export function SeloSincronia({ sincronia }: { sincronia: Sincronia }) {
  const [agora, setAgora] = useState(() => Date.now());
  const pulso = usePulso();
  useEffect(() => {
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [sincronia]);
  const texto = textoSincronia(sincronia, agora);
  const offline = sincronia.estado === 'offline';
  const atualizando = sincronia.estado === 'atualizando';
  return (
    <View testID="selo-sincronia" accessible accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={texto}
      style={[estilos.selo, offline && estilos.seloOffline]}>
      <Animated.View style={[estilos.seloPonto, { backgroundColor: offline ? '#E58A1F' : atualizando ? cores.acao : cores.sucessoClaro },
        atualizando && { opacity: pulso }]} />
      <Text numberOfLines={1} style={[estilos.seloTexto, offline && { color: cores.ouroTexto }]}>{texto}</Text>
    </View>
  );
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
  // .entrada-cabecalho .logo-quadro e .recuperar-topo: 60 de altura contando a linha de 2 de baixo (box-sizing: border-box).
  marcaAcesso: { minHeight: 58 },
  logo: { width: 112, height: 38 },
  logoEstudo: { width: 102, height: 34.6 },
  // .estudo-cabecalho no celular: 64 contando a linha de 2 (box-sizing: border-box). Sem o selo, a linha do logo e do "Sair"
  // fica no alto (4 em cima; a web estica a linha vazia do selo embaixo): 4 + 48 + 10 = 62 mais a linha.
  marcaEstudo: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, minHeight: 62 },
  conteudoEstudo: { paddingTop: 28 },
  // Com o selo de sincronia, a web quebra a barra em duas linhas (até 480 px): 4 em cima, a linha do logo (44), 7 até o selo e
  // 4 embaixo (selo em y=55, divisória em 82); os 64 de altura mínima valem para a barra inteira. A linha do logo do app tem
  // 48 (o toque do "Sair"), então o selo fica a 3 dela.
  marcaComSelo: { minHeight: 0, paddingBottom: 0 },
  abaixoDoLogoEstudo: { paddingHorizontal: 16, marginTop: 3, paddingBottom: 4 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  rolagemConteudo: { flexGrow: 1 },
  conteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  // Paridade (levantamento de 18/11, G2): o h1 da web no celular tem 32/40 e -1px (globals.css, até 767 px). As telas em
  // que a web usa outro tamanho (pedido 30, aula e proposta 24) passam o próprio estilo. h2/h3 seguem com -0,015em.
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 32, letterSpacing: -1, lineHeight: 40 },
  subtitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, letterSpacing: -0.3, lineHeight: 26 },
  tituloBloco: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, letterSpacing: -0.27, lineHeight: 24 },
  texto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  textoSecundario: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  introducao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 24, marginTop: 8 },
  legenda: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  campo: { gap: 8 },
  rotulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
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
  // Cartão de erro da web (.estado-erro): borda do erro a 40%, fundo rosado, o Stu de 48 à esquerda e o corpo ao lado.
  // Como na web, o corpo pede pelo menos 220 de largura: em 360, ele desce para baixo do Stu (flex-wrap, vão de 14 entre as linhas).
  estadoErro: {
    marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 14, columnGap: 16, paddingVertical: 16, paddingHorizontal: 18,
    borderWidth: 2, borderRadius: 20, borderColor: 'rgba(194, 59, 78, 0.4)', backgroundColor: cores.erroFundo,
  },
  estadoErroStu: { width: 48, height: 56, flexShrink: 0 },
  estadoErroCorpo: { flex: 1, minWidth: 220, gap: 10 },
  estadoErroTexto: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  mensagemTitulo: { fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  // .sinal da web: 800 em 0,875rem.
  sinal: { width: 24, height: 24, textAlign: 'center', fontSize: 14, lineHeight: 22, borderRadius: 12, borderWidth: 1, fontFamily: fontes.corpo, fontWeight: '800' },
  skeleton: { marginTop: 20, gap: 8 },
  skeletonCurto: { width: '55%', height: 24, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonLinha: { width: '100%', height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  rodape: { borderTopWidth: 2, borderColor: cores.nevoa, backgroundColor: cores.fundo },
  // iOS 26: o vidro é o fundo do rodapé (sem o branco e sem a linha de cima).
  rodapeVidro: {},
  // A web deixa 20 px nas laterais do rodapé (350 px de botão em 390); a aula e a entrada passam as delas.
  // .acao-principal e .aula-rodape no celular: 12 em cima e 14 embaixo (o degrau do botão desce por fora, no respiro de baixo).
  rodapeConteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 10 },
  // Como .botao da web: face de 48 px com o lábio de 4 px embaixo (aqui, a borda de baixo) e texto 16 px/800.
  botao: {
    minHeight: 52, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 8,
    // Como .botao: borda de 2 transparente (o fundo aparece por baixo); o lábio é a borda de baixo, mais escura.
    borderWidth: 2, borderBottomWidth: 4, borderRadius: 16, borderColor: 'transparent', borderBottomColor: cores.acaoEscura, backgroundColor: cores.acao,
  },
  botaoSecundario: { borderColor: cores.gelo, borderBottomColor: cores.gelo, backgroundColor: cores.fundo },
  botaoSucesso: { borderColor: 'transparent', borderBottomColor: '#145A42', backgroundColor: cores.sucesso },
  botaoAlerta: { borderColor: 'transparent', borderBottomColor: '#6E4100', backgroundColor: cores.alerta },
  pontinhos: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 5 },
  pontinho: { width: 8, height: 8, borderRadius: 4 },
  botaoDestrutivo: { borderColor: '#F3C4C0', borderBottomColor: '#F3C4C0', backgroundColor: cores.fundo },
  // .trilha-topo no celular: 20 abaixo da barra da marca (28 do respiro da página menos 8), colada no topo ao rolar.
  faixaVao: { height: 20 },
  // .trilha-topo no celular: a linha de baixo é sombra por fora (box-shadow 0 2px 0 gelo), não borda.
  faixaFixa: { zIndex: 6, backgroundColor: 'rgba(255, 255, 255, 0.96)', boxShadow: `0 2px 0 ${cores.gelo}` },
  // iOS 26: a faixa vira vidro sobre o mapa que rola por baixo (sem o branco e sem a linha de baixo).
  faixaFixaVidro: { zIndex: 6 },
  abaixoDoLogo: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 10, marginTop: -4 },
  modalFundo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  modalCartao: { width: '100%', maxWidth: 440, padding: 24, borderWidth: 2, borderColor: cores.gelo, borderRadius: 24, backgroundColor: cores.fundo,
    shadowColor: '#0F172A', shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 20 }, elevation: 12 },
  modalMensagem: { marginBottom: 20, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16.8, lineHeight: 25 },
  modalAcoes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
  // .folha.folha--confirmar da web: 20 de respiro, vão de 14, cantos de 24 e borda de 2.
  dialogoCartao: { width: '100%', maxWidth: 480, padding: 20, gap: 14, borderWidth: 2, borderColor: cores.gelo, borderRadius: 24, backgroundColor: cores.fundo,
    shadowColor: '#0F172A', shadowOpacity: 0.24, shadowRadius: 24, shadowOffset: { width: 0, height: 20 }, elevation: 12 },
  dialogoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 27.5 },
  dialogoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  dialogoAcoes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  dialogoAcoesEmpilhadas: { flexDirection: 'column', alignItems: 'stretch' },
  botaoTextoLivre: { borderColor: 'transparent', borderBottomColor: 'transparent', borderBottomWidth: 2, backgroundColor: 'transparent' },
  // Botão com degrau: fora, o lábio (degrauFora, 4 por fora); dentro, a face de 48 com a borda de 2 que fecha em volta.
  botaoDegrauCompacto: { alignSelf: 'flex-start', flexShrink: 1 },
  botaoFace: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 6,
    borderWidth: 2, borderRadius: 16, borderColor: 'transparent', backgroundColor: cores.acao },
  botaoFaceSecundaria: { borderColor: cores.gelo, backgroundColor: cores.fundo },
  botaoFaceSucesso: { backgroundColor: cores.sucesso },
  botaoFaceAlerta: { backgroundColor: cores.alerta },
  botaoFaceDestrutiva: { borderColor: '#F3C4C0', backgroundColor: cores.fundo },
  botaoFaceApagada: { borderColor: cores.gelo, backgroundColor: cores.nevoa },
  botaoFaceCompacta: { minHeight: 44, minWidth: 44, paddingHorizontal: 8 },
  // O raio do botão da web é 16 também no botão pequeno ("Sair", "Pular").
  botaoCompacto: { alignSelf: 'flex-start', minHeight: 48, minWidth: 48, paddingHorizontal: 8, borderRadius: 16, flexShrink: 1 },
  botaoConteudo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  botaoPressionado: { opacity: 0.82 },
  foco: { outlineColor: cores.acao, outlineWidth: 2, outlineOffset: 2, outlineStyle: 'solid' },
  botaoDesativado: { borderColor: cores.gelo, borderBottomColor: cores.gelo, backgroundColor: cores.nevoa },
  botaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24, textAlign: 'center', flexShrink: 1 },
  botaoTextoCompacto: { fontSize: 14, lineHeight: 20 },
  // .aula-fechar e .campo-senha__alternar da web: 44 × 44. O toque chega a 48 dp por fora (hitSlop de 2), sem mudar o
  // desenho (P8 da spec 07).
  botaoIcone: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  botaoIconePressionado: { backgroundColor: cores.nevoa },
  selo: {
    // .selo-sincronia no celular (até 767 px): 3 × 8 de respiro e o texto de 12 na entrelinha normal (15): 23 × 159.
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: cores.gelo, borderRadius: 999, backgroundColor: cores.nevoa, maxWidth: '100%',
  },
  seloOffline: { borderColor: cores.alertaBorda, backgroundColor: cores.alertaFundo },
  seloPonto: { width: 8, height: 8, borderRadius: 4 },
  seloTexto: { flexShrink: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 15 },
  // summary::before da web: caixa de 8 (box-sizing: border-box, com as bordas de 2,5) girada, sem margem; o texto vem 8 depois.
  chevron: { width: 8, height: 8, borderRightWidth: 2.5, borderBottomWidth: 2.5 },
  linhaAbrir: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, paddingVertical: 10, borderRadius: 8 },
  linhaAbrirTexto: { fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  seloDemo: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#FFF1CC' },
  // .estudio-selo: 0,8rem na entrelinha dos parágrafos do cartão (1,6 → 20,48).
  seloDemoTexto: { color: '#704700', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12.8, lineHeight: 20.48 },
});

/** Dois destinos persistentes, fora das aulas e da geração para preservar o foco. */
function NavegacaoInferior() {
  const nav = useContext(NavegacaoContexto);
  if (!nav) return null;
  // As duas abas ficam dentro de uma lista de abas, como pede o papel "tab" (axe: aria-required-parent).
  const itens: { id: 'planos' | 'objetivo' | 'explorar' | 'perfil'; rotulo: string; icone: NomeIcone; acao: () => void }[] = [
    { id: 'planos', rotulo: mensagens.planos.titulo, icone: 'livro', acao: nav.planos },
    { id: 'objetivo', rotulo: mensagens.planos.novo, icone: 'lampada', acao: nav.criar },
  ];
  if (nav.explorar) itens.push({ id: 'explorar', rotulo: mensagens.comunidade.navegacao, icone: 'bussola', acao: nav.explorar });
  if (nav.perfil) itens.push({ id: 'perfil', rotulo: mensagens.perfil.navegacao, icone: 'pessoa', acao: nav.perfil });
  // Com três itens, o vão entre eles cai de 12 para 8, como .navegacao-mobile[data-itens='3'] da web; com quatro, 4 de vão,
  // 8 nos lados, 6 × 2 dentro do item e o rótulo de 11/1,15 (.navegacao-mobile[data-itens='4']), para caber em 360.
  const quatro = itens.length > 3;
  const vao = quatro ? navegacaoEstilos.faixaQuatro : itens.length > 2 ? { gap: 8 } : null;
  return <FundoDeBarra accessibilityRole="tablist" estilo={[navegacaoEstilos.faixa, vao]} estiloVidro={[navegacaoEstilos.faixaVidro, vao]}>
    {itens.map((item) => {
      const selecionado = item.id === nav.atual || item.id === 'planos' && nav.atual === 'plano';
      return <Pressable key={item.id} testID={`nav-${item.id}`} accessibilityRole="tab" accessibilityState={{ selected: selecionado, disabled: nav.ocupado }}
        aria-selected={selecionado} aria-disabled={nav.ocupado}
        accessibilityLabel={item.rotulo} disabled={nav.ocupado} onPress={item.acao}
        style={({ pressed }) => [navegacaoEstilos.item, quatro && navegacaoEstilos.itemQuatro, selecionado && navegacaoEstilos.ativo, pressed && { opacity: 0.7 }]}>
        <IndicadorNavegacao icone={item.icone} selecionado={selecionado} />
        <Text style={[navegacaoEstilos.rotulo, quatro && navegacaoEstilos.rotuloQuatro, selecionado && { color: cores.acao }]}>{item.rotulo}</Text>
      </Pressable>;
    })}
  </FundoDeBarra>;
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
    <Icone nome={icone} tamanho={22} cor={selecionado ? cores.acao : cores.textoSecundario} sistema={selecionado ? 'cheio' : true} />
  </Animated.View>;
}
const navegacaoEstilos = StyleSheet.create({
  faixa: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: 1, borderColor: cores.gelo, backgroundColor: cores.fundo },
  // iOS 26: a mesma barra sobre vidro, sem o fundo branco e sem a linha de cima.
  faixaVidro: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  faixaQuatro: { gap: 4, paddingHorizontal: 8 },
  item: { flex: 1, minHeight: 56, borderRadius: 18, padding: 6, alignItems: 'center', justifyContent: 'center', gap: 3 },
  itemQuatro: { paddingHorizontal: 2 },
  ativo: { backgroundColor: cores.nevoa },
  rotulo: { fontFamily: fontes.corpo, fontSize: 12, fontWeight: '800', color: cores.textoSecundario, textAlign: 'center' },
  rotuloQuatro: { fontSize: 11, lineHeight: 12.65 },
});
