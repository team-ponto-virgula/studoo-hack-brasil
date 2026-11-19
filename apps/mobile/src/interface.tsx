import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { NavegacaoContexto } from './navegacao';
import { useDepoisDeSair } from './janelas';
import { useMovimentoReduzido } from './movimento';
export { useMovimentoReduzido } from './movimento';

import { Icone } from './icone';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';
import { focarSemRolar, focoVisivel } from './foco';
import { Stu } from './mascote';

/**
 * Quanto o conteúdo da tela começa abaixo do topo da rolagem por causa da barra da marca, que rola junto (como na web).
 * Quem mede posições para rolar até um ponto (o caminho na geração) soma este valor; com a faixa parada no alto, é 0.
 */
export const DeslocamentoDaRolagem = createContext<number | null>(0);
/**
 * Rola a tela até um elemento dela (medido dentro da rolagem), com uma folga no alto: o `scrollIntoView` da web, para
 * quem abre um bloco no fim da tela ("Adicionar por link") e precisa trazê-lo para cima do teclado e da barra de baixo.
 */
export const RolagemDaTela = createContext<{
  rolarAte: (no: ComponentRef<typeof View> | null, folga?: number) => void;
  /** Traz o elemento inteiro para a parte visível, abaixo da faixa parada e acima do rodapé e da barra (o campo em foco). */
  mostrar: (no: ComponentRef<typeof View> | null, margem?: number) => void;
  /** O campo em foco (ou null): a tela o mantém inteiro à vista quando o teclado abre e quando a área visível encolhe. */
  focar: (no: ComponentRef<typeof View> | null) => void;
} | null>(null);
/** O teclado está aberto: a entrada recolhe a parte de cima, e o rodapé deixa de somar a área segura de baixo. */
export const TecladoAberto = createContext(false);
/** Altura ocupada no pé da janela (barra de abas, rodapé ou área segura): o menu "•••" abre em cima quando não cabe acima dela. */
export const BaixoOcupado = createContext(0);

/**
 * Aviso do próprio app (spec 11, nunca do sistema): uma faixa no pé da tela, 16 acima do rodapé e da barra de abas, que
 * some sozinha ("Perfil salvo.", o aviso da primeira curtida, "Não deu para curtir agora…"). Ícone de 20 à esquerda
 * (visto, alerta ou coração) e, no máximo, uma ação em texto à direita ("Entrar", "Tentar de novo"). Some em 4,5 s, ou em
 * 7 s com ação. O estado mora na raiz do app (uma tela por vez): quem avisa pega `avisar` do contexto, e a `Tela` desenha a
 * faixa onde ela sabe a altura das barras. Nunca leva o foco; o leitor de tela ouve o texto.
 */
export type OpcoesDoAviso = { icone?: 'check' | 'alerta' | 'valeu'; acao?: { rotulo: string; aoTocar: () => void }; duracaoMs?: number };
export type AvisoAtual = OpcoesDoAviso & { texto: string; vez: number };
export const AvisoDoApp = createContext<{ aviso: AvisoAtual | null; avisar: (texto: string, opcoes?: OpcoesDoAviso) => void; dispensar: () => void }>({
  aviso: null, avisar: () => undefined, dispensar: () => undefined,
});
export const DURACAO_DO_AVISO_MS = 4500;
export const DURACAO_DO_AVISO_COM_ACAO_MS = 7000;

/** O estado do aviso na raiz do app: cada `avisar` entra no lugar do anterior na hora e recomeça o tempo. */
export function useAvisoDoAppRaiz() {
  const [aviso, setAviso] = useState<AvisoAtual | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const relogio = setTimeout(() => setAviso(null), aviso.duracaoMs ?? (aviso.acao ? DURACAO_DO_AVISO_COM_ACAO_MS : DURACAO_DO_AVISO_MS));
    return () => clearTimeout(relogio);
  }, [aviso]);
  const avisar = useCallback((texto: string, opcoes: OpcoesDoAviso = {}) => {
    setAviso((anterior) => ({ ...opcoes, texto, vez: (anterior?.vez ?? 0) + 1 }));
    // Papel de status, como o role="status" da web: o leitor de tela também ouve.
    setTimeout(() => AccessibilityInfo.announceForAccessibility(texto), 0);
  }, []);
  const dispensar = useCallback(() => setAviso(null), []);
  return { aviso, avisar, dispensar };
}

/** A faixa do aviso: até 480 de largura, fundo #0B1B5C, texto branco 800 de 15/22, cantos de 16; sobe 10 com a opacidade em 220 ms. */
function FaixaDoAviso({ aviso, baixo }: { aviso: AvisoAtual; baixo: number }) {
  const reduzir = useMovimentoReduzido();
  const { dispensar } = useContext(AvisoDoApp);
  const [entrada] = useState(() => new Animated.Value(0));
  useEffect(() => {
    entrada.setValue(0);
    const animacao = Animated.timing(entrada, { toValue: 1, duration: reduzir !== false ? 120 : 220, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [aviso.vez, reduzir, entrada]);
  return (
    <View pointerEvents="box-none" style={[estilos.avisoLugar, { bottom: baixo }]}>
      <Animated.View testID="aviso-app" accessibilityLiveRegion="polite" style={[estilos.aviso, {
        opacity: entrada,
        transform: [{ translateY: reduzir !== false ? 0 : entrada.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }]}>
        {aviso.icone && <View style={estilos.avisoIcone}><Icone nome={aviso.icone} tamanho={20} cor="#FFFFFF" cheio={aviso.icone === 'valeu'} /></View>}
        <Text style={estilos.avisoTexto}>{aviso.texto}</Text>
        {aviso.acao && (
          <Pressable testID="aviso-acao" accessibilityRole="button" hitSlop={8} onPress={() => { const acao = aviso.acao; dispensar(); acao?.aoTocar(); }}
            style={({ pressed }) => [estilos.avisoAcao, pressed && { opacity: 0.7 }]}>
            <Text style={estilos.avisoAcaoTexto}>{aviso.acao.rotulo}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}
/** Altura da faixa que fica presa no alto da tela (o cabeçalho da trilha), para quem rola descontar o que ela cobre. */
export const AlturaDaFaixaFixa = createContext(0);

export function Tela({ children, acoes, topo, rodape, pagina, semCabecalho = false, semLinha = false, abaixoDoLogo, faixaFixa, rolagem, aoMedir, aoRolar, aoMedirConteudo, aoMedirNatural, estiloConteudo, estiloRodape, estiloRodapeConteudo }: {
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
  /**
   * Altura natural do conteúdo (a barra da marca, a faixa e o conteúdo da tela), sem o que sobra até o fim da rolagem: a
   * rolagem estica o conteúdo até a altura da janela (`flexGrow: 1`), então a medida de cima nunca fica abaixo dela.
   */
  aoMedirNatural?: (altura: number) => void;
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
  const [alturaRodape, setAlturaRodape] = useState(0);
  const [alturaBarra, setAlturaBarra] = useState(0);
  const cabecalhoNaRolagem = !topo && !semCabecalho;
  const insets = useSafeAreaInsets();
  const comBarra = Boolean(navegacao) && !teclado;
  // iPhone com iOS 26 ou mais novo: o rodapé neutro e a barra de baixo ficam por cima do conteúdo, para o vidro mostrar o
  // que rola por baixo (abaixo do conteúdo, só havia o branco da tela atrás deles). No Android, no iOS anterior e na
  // prévia web, as barras seguem no fluxo, como antes.
  const rodapeSobreposto = VIDRO && Boolean(rodape) && !estiloRodape;
  const barraSobreposta = VIDRO && comBarra && (!rodape || rodapeSobreposto);
  // A área segura de baixo (barra de início do iPhone, barra de gestos do Android) fica dentro da barra que encosta na
  // borda: o fundo dela vai até a borda, sem linha nem faixa solta embaixo. Com o teclado aberto, ele cobre essa área.
  const fundoSeguro = teclado ? 0 : insets.bottom;
  const sobreposicao = (rodapeSobreposto ? alturaRodape : 0) + (barraSobreposta ? alturaBarra : 0);
  // Sem barra embaixo, o fim da rolagem ganha a área segura (nada fica atrás da barra de início).
  const fimDaRolagem = sobreposicao + (!rodape && !comBarra ? fundoSeguro : 0);
  const rolado = useRef(0);
  const alturaRolagem = useRef(0);
  const sobreposicaoAtual = useRef(0);
  sobreposicaoAtual.current = sobreposicao;
  const campoEmFoco = useRef<ComponentRef<typeof View> | null>(null);
  const alturaDoConteudo = useRef(0);
  const informarNatural = () => {
    if (!aoMedirNatural || !alturaDoConteudo.current) return;
    aoMedirNatural((cabecalhoNaRolagem ? alturaCabecalho : 0) + (faixaFixa ? 20 + alturaFaixa : 0) + alturaDoConteudo.current);
  };
  // A barra da marca e a faixa entram na conta assim que são medidas.
  useEffect(informarNatural, [alturaCabecalho, alturaFaixa]);
  /** Leva o elemento para a parte visível, se ele não estiver inteiro lá (sem mexer quando já está). */
  const mostrar = (no: ComponentRef<typeof View> | null, margem = 16) => {
    const tela = rolagemInterna.current;
    const conteudo = tela?.getInnerViewRef?.();
    if (!tela || !conteudo || !no) return;
    no.measureLayout(conteudo as never, (_x, y, _largura, altura) => {
      const coberto = faixaFixa ? alturaFaixa : 0;
      const visivel = alturaRolagem.current - sobreposicaoAtual.current;
      if (y + altura + margem > rolado.current + visivel) tela.scrollTo({ y: Math.max(0, y + altura + margem - visivel), animated: reduzirMovimento === false });
      else if (y - margem - coberto < rolado.current) tela.scrollTo({ y: Math.max(0, y - margem - coberto), animated: reduzirMovimento === false });
    }, () => undefined);
  };
  const mostrarCampoEmFoco = () => setTimeout(() => { if (campoEmFoco.current) mostrar(campoEmFoco.current); }, 80);
  const focar = (no: ComponentRef<typeof View> | null) => {
    campoEmFoco.current = no;
    if (no) mostrarCampoEmFoco();
  };
  useEffect(() => {
    // Com o teclado aberto, o campo em foco sobe para cima do rodapé (a área visível acabou de encolher).
    const abriu = Keyboard.addListener('keyboardDidShow', () => { setTeclado(true); mostrarCampoEmFoco(); });
    const fechou = Keyboard.addListener('keyboardDidHide', () => setTeclado(false));
    return () => { abriu.remove(); fechou.remove(); };
    // O campo e a rolagem vêm de referências: o efeito só liga os ouvintes uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A área visível muda quando as barras por cima do conteúdo são medidas: quem acompanha recebe a medida nova.
  useEffect(() => {
    if (alturaRolagem.current) aoMedir?.(alturaRolagem.current - sobreposicao);
    // Só quando a parte coberta muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sobreposicao]);
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
  const { aviso } = useContext(AvisoDoApp);
  // O aviso fica 16 acima do que estiver embaixo: o rodapé, a barra de abas ou, sem nenhum, a área segura de baixo.
  const baixoDoAviso = 16 + (comBarra ? alturaBarra : 0) + (rodape ? alturaRodape : 0) + (!comBarra && !rodape ? fundoSeguro : 0);
  return (
    <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
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
          onLayout={(evento) => {
            alturaRolagem.current = evento.nativeEvent.layout.height;
            aoMedir?.(evento.nativeEvent.layout.height - sobreposicao);
            if (campoEmFoco.current) mostrarCampoEmFoco();
          }}
          onScroll={(evento) => { rolado.current = evento.nativeEvent.contentOffset.y; aoRolar?.(evento.nativeEvent.contentOffset.y); }}
          scrollEventThrottle={16}
          onContentSizeChange={aoMedirConteudo && ((_largura, altura) => aoMedirConteudo(altura - fimDaRolagem))}>
          {cabecalhoNaRolagem && <View onLayout={(evento) => setAlturaCabecalho(evento.nativeEvent.layout.height)}>{cabecalho}</View>}
          {faixaFixa && <View style={estilos.faixaVao} />}
          {faixaFixa && <FundoDeBarra estilo={estilos.faixaFixa} estiloVidro={estilos.faixaFixaVidro} onLayout={(evento) => setAlturaFaixa(evento.nativeEvent.layout.height)}>{faixaFixa}</FundoDeBarra>}
          {/* .estudo-principal no celular: 28 em cima, também com o selo de sincronia (a barra tem a altura da da web). */}
          <View style={[estilos.conteudo, !topo && !paginaDeAcesso && estilos.conteudoEstudo, estiloConteudo]}
            onLayout={(evento) => { alturaDoConteudo.current = evento.nativeEvent.layout.height; informarNatural(); }}>
            {/* null enquanto a barra da marca ou a faixa parada ainda não foram medidas: quem rola até um ponto espera. */}
            <DeslocamentoDaRolagem.Provider value={(cabecalhoNaRolagem && !alturaCabecalho) || (faixaFixa && !alturaFaixa) ? null
              : (cabecalhoNaRolagem ? alturaCabecalho : 0) + (faixaFixa ? 20 + alturaFaixa : 0)}>
              <AlturaDaFaixaFixa.Provider value={faixaFixa ? alturaFaixa : 0}>
                <RolagemDaTela.Provider value={{ rolarAte, mostrar, focar }}>
                  <TecladoAberto.Provider value={teclado}>
                    <BaixoOcupado.Provider value={baixoDoAviso - 16}>
                      <Entrada>{children}</Entrada>
                    </BaixoOcupado.Provider>
                  </TecladoAberto.Provider>
                </RolagemDaTela.Provider>
              </AlturaDaFaixaFixa.Provider>
            </DeslocamentoDaRolagem.Provider>
          </View>
          {/* O fim da rolagem passa por baixo das barras sobrepostas e da área segura de baixo, sem esconder o último item. */}
          {fimDaRolagem > 0 && <View style={{ height: fimDaRolagem }} />}
        </ScrollView>
        {/* O rodapé de feedback (verde ou laranja) é conteúdo e fica com a cor de hoje; o neutro vira vidro no iOS 26. */}
        {rodape && (() => {
          const base = StyleSheet.flatten([estilos.rodapeConteudo, estiloRodapeConteudo])?.paddingBottom;
          const fundo = comBarra ? 0 : fundoSeguro;
          const posicao = rodapeSobreposto ? [estilos.sobreposto, { bottom: barraSobreposta ? alturaBarra : 0 }] : null;
          return (
            <FundoDeBarra testID="rodape" estilo={[estilos.rodape, estiloRodape, posicao]} estiloVidro={estiloRodape ? undefined : [estilos.rodapeVidro, posicao]}
              onLayout={(evento) => setAlturaRodape(evento.nativeEvent.layout.height)}>
              <View style={[estilos.rodapeConteudo, estiloRodapeConteudo, fundo > 0 && { paddingBottom: (typeof base === 'number' ? base : 14) + fundo }]}>{rodape}</View>
            </FundoDeBarra>
          );
        })()}
      </KeyboardAvoidingView>
      {comBarra && <NavegacaoInferior fundo={fundoSeguro} sobreposta={barraSobreposta} aoMedir={setAlturaBarra} />}
      {aviso && <FaixaDoAviso key={aviso.vez} aviso={aviso} baixo={baixoDoAviso} />}
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
  variante?: 'primario' | 'sucesso' | 'alerta' | 'secundario' | 'texto' | 'destrutivo' | 'perigo';
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
  let corTexto: string = variante === 'primario' || variante === 'sucesso' || variante === 'alerta' || variante === 'perigo' ? cores.fundo : variante === 'destrutivo' ? '#B3261E' : cores.acao;
  if (desativado || esmaecido) corTexto = cores.textoSecundario;
  // Como .botao da web: a face de 48 com borda de 2 que fecha em volta e o degrau de 4 por fora, na cor do lábio
  // (--labio); nos botões claros, a borda e o degrau somam a faixa de 6 da web. O botão de texto não tem degrau.
  const comDegrau = variante !== 'texto';
  const apagado = desativado || esmaecido;
  const labio = apagado ? cores.gelo : variante === 'primario' ? cores.acaoEscura : variante === 'sucesso' ? '#145A42' : variante === 'alerta' ? '#6E4100' : variante === 'perigo' ? '#8F2A39' : cores.gelo;
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
          variante === 'alerta' && estilos.botaoFaceAlerta, variante === 'destrutivo' && estilos.botaoFaceDestrutiva, variante === 'perigo' && estilos.botaoFacePerigo,
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

export function Campo({ rotulo, campoRef, erro, erroComAlerta = false, acessorio, rotuloOculto = false, estiloRotulo, ...props }: TextInputProps & {
  rotulo: string;
  /** O erro como no perfil (`.campo-erro--colado` da web): ícone de alerta de 16, 6 até o texto, 800 de 14/20, colado no campo. */
  erroComAlerta?: boolean;
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
  // Em foco, o campo inteiro (rótulo, caixa e erro) fica acima do rodapé e do teclado: a tela rola até ele.
  const rolagem = useContext(RolagemDaTela);
  const caixa = useRef<ComponentRef<typeof View>>(null);
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
    <View ref={caixa} style={estilos.campo}>
      {/* Como o <label> da web: tocar no rótulo leva o foco ao campo. Não é mais uma parada do leitor de tela: o campo já tem
          o rótulo como nome. */}
      {!rotuloOculto && (
        <Text nativeID={rotuloId} style={[estilos.rotulo, estiloRotulo]} accessible={false} suppressHighlighting
          onPress={() => interno.current?.focus()}>{rotulo}</Text>
      )}
      <View>
        <TextInput {...props} ref={referencia} accessibilityLabel={rotulo} accessibilityLabelledBy={rotuloOculto ? undefined : rotuloId} accessibilityHint={dica}
          placeholderTextColor={props.placeholderTextColor ?? '#7A84A0'}
          // Com erro, a borda vermelha vale também em foco, com o anel vermelho claro ([aria-invalid='true']:focus da web).
          style={[estilos.entrada, props.multiline && estilos.entradaMultilinha, focado && estilos.entradaFocada, !!erro && estilos.entradaErro,
            !!erro && focado && estilos.entradaErroFocada, !!acessorio && estilos.entradaComAcessorio, props.style]}
          onFocus={(evento) => { setFocado(true); rolagem?.focar(caixa.current); props.onFocus?.(evento); }}
          onBlur={(evento) => { setFocado(false); rolagem?.focar(null); props.onBlur?.(evento); }} />
        {acessorio && <View style={estilos.acessorio}>{acessorio}</View>}
      </View>
      {erro && (
        <View style={[estilos.campoErro, erroComAlerta && estilos.campoErroColado]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {erroComAlerta ? <View style={estilos.campoErroIcone}><Icone nome="alerta" tamanho={16} cor={cores.erro} /></View>
            : <Text style={[estilos.sinal, { color: cores.erro, borderColor: cores.erro }]}>!</Text>}
          <Text style={[estilos.campoErroTexto, erroComAlerta && estilos.campoErroTextoColado]}>{erro}</Text>
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
      {/* Spec 13: `stu-encorajador` de 48, que se mexe uma vez ao abrir. */}
      <Stu nome="stu-encorajador" tamanho={48} animado="uma-vez" estilo={estilos.estadoErroStu} />
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
 * Confirmação (spec 11, a mesma nas três plataformas): véu escuro, cartão no centro com o título (a pergunta, Quicksand 20/26),
 * o texto (Nunito 16/24 em cinza), o aviso a mais num parágrafo à parte e as ações lado a lado, metade cada: "Cancelar" à
 * esquerda e a ação à direita, vermelha cheia quando destrói algo. Se um rótulo não cabe na metade, uma por linha, com a ação
 * em cima. Tocar no véu ou o voltar do aparelho cancelam, menos enquanto a ação é enviada; o erro fica no cartão, acima das
 * ações. Entra com a opacidade e a escala de 0,96 a 1 (220 ms); com movimento reduzido, só a opacidade.
 */
type PropsConfirmacao = {
  /** O título: a pergunta, curta. */
  mensagem: string;
  confirmarRotulo: string;
  /** O que acontece, em uma ou duas frases. */
  texto?: string;
  /** Um aviso a mais, num parágrafo à parte (o link de compartilhamento que deixa de funcionar). */
  aviso?: string;
  /** Rótulo da ação segura quando não é "Cancelar" ("Continuar compartilhando", "Manter foto", "Continuar editando"). */
  cancelarRotulo?: string;
  destrutivo?: boolean;
  ocupado?: boolean;
  /** O erro do envio, acima das ações (o cartão continua aberto). */
  erro?: string | null;
  aoCancelar: () => void;
  aoConfirmar: () => void;
};

/** Largura média de um caractere em Nunito 800 de 16 px (para saber se o rótulo cabe na metade). */
const LARGURA_MEDIA_DO_CARACTERE = 9.2;

export function CartaoConfirmacao({ mensagem, confirmarRotulo, texto, aviso, cancelarRotulo = mensagens.geracao.cancelar, destrutivo = false, ocupado = false, erro,
  aoCancelar, aoConfirmar }: PropsConfirmacao) {
  const { width } = useWindowDimensions();
  const reduzir = useMovimentoReduzido();
  const [entrada] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animacao = Animated.timing(entrada, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [entrada]);
  // Cartão de min(100% − 32, 400) com respiro de 24: cada ação fica com metade do miolo, menos os 8 entre elas.
  const metade = (Math.min(width - 32, 400) - 48 - 8) / 2;
  const cabe = (rotulo: string) => rotulo.length * LARGURA_MEDIA_DO_CARACTERE + 36 + 4 <= metade;
  const empilhar = !cabe(confirmarRotulo) || !cabe(cancelarRotulo);
  const cancelar = <Botao rotulo={cancelarRotulo} testID="confirmacao-cancelar" variante="secundario" desativado={ocupado} acao={aoCancelar} estilo={empilhar ? null : estilos.confirmacaoMetade} />;
  const confirmar = <Botao rotulo={confirmarRotulo} testID="confirmacao-confirmar" variante={destrutivo ? 'perigo' : 'primario'} desativado={ocupado} carregando={ocupado}
    acao={aoConfirmar} estilo={empilhar ? null : estilos.confirmacaoMetade} />;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => { if (!ocupado) aoCancelar(); }}>
      <Pressable testID="confirmacao-fundo" accessible={false} style={estilos.modalFundo} onPress={() => { if (!ocupado) aoCancelar(); }}>
        <Animated.View style={{ width: '100%', maxWidth: 400, alignItems: 'center', opacity: entrada,
          transform: [{ scale: reduzir !== false ? 1 : entrada.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
          <Pressable testID="confirmacao" accessible={false} accessibilityViewIsModal role="alertdialog" aria-modal style={estilos.confirmacaoCartao} onPress={() => {}}>
            <Text accessibilityRole="header" style={estilos.confirmacaoTitulo}>{mensagem}</Text>
            {texto && <Text style={estilos.confirmacaoTexto}>{texto}</Text>}
            {aviso && <Text testID="confirmacao-aviso" style={estilos.confirmacaoTexto}>{aviso}</Text>}
            {erro && <Text accessibilityRole="alert" style={estilos.confirmacaoErro}>{erro}</Text>}
            {/* Lado a lado: "Cancelar" à esquerda e a ação à direita; uma por linha: a ação em cima. */}
            <View style={[estilos.confirmacaoAcoes, empilhar && estilos.confirmacaoAcoesEmpilhadas]}>
              {empilhar ? <>{confirmar}{cancelar}</> : <>{cancelar}{confirmar}</>}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** Uma opção da folha de ações: ícone de 20, texto 800 de 17; a de perigo (Remover foto) em vermelho, por último. */
export type AcaoDaFolha = { rotulo: string; icone: NomeIcone; aoEscolher: () => void; perigo?: boolean; testID?: string };

/**
 * Folha de ações do Studoo (spec 11, "Folha"; esboço "Foto do perfil"): sobe de baixo com a alça de 40 × 5, o título, as
 * opções de 56 de altura e "Cancelar" na largura toda. Tocar no véu ou o voltar do aparelho fecham. Escolher fecha a folha e
 * só depois roda a ação: no iPhone, a galeria, a câmera ou a confirmação só abrem depois que a folha saiu (janelas.ts).
 */
export function FolhaDeAcoes({ visivel, titulo, acoes, cancelarRotulo, aoFechar, testID }: {
  visivel: boolean; titulo: string; acoes: AcaoDaFolha[]; cancelarRotulo: string; aoFechar: () => void; testID?: string;
}) {
  const margens = useSafeAreaInsets();
  const reduzir = useMovimentoReduzido();
  const { depoisDeSair, aoSair } = useDepoisDeSair();
  const [subida] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!visivel) return;
    subida.setValue(0);
    const animacao = Animated.timing(subida, { toValue: 1, duration: reduzir !== false ? 120 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [visivel, reduzir, subida]);
  return (
    <Modal transparent visible={visivel} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={aoFechar} onDismiss={aoSair}>
      <View style={estilos.folhaAcoesFundo}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={aoFechar} />
        <Animated.View testID={testID} accessibilityViewIsModal style={[estilos.folhaAcoes, { paddingBottom: 28 + margens.bottom, opacity: subida,
          transform: [{ translateY: reduzir !== false ? 0 : subida.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
          <View style={estilos.folhaAcoesAlca} />
          <Text accessibilityRole="header" style={estilos.folhaAcoesTitulo}>{titulo}</Text>
          {acoes.map((acao) => (
            <Pressable key={acao.rotulo} testID={acao.testID} accessibilityRole="button" onPress={() => { aoFechar(); depoisDeSair(acao.aoEscolher); }}
              style={({ pressed }) => [estilos.folhaAcoesOpcao, pressed && { backgroundColor: cores.nevoa }]}>
              <Icone nome={acao.icone} tamanho={20} cor={acao.perigo ? cores.erro : cores.texto} />
              <Text style={[estilos.folhaAcoesOpcaoTexto, acao.perigo && { color: cores.erro }]}>{acao.rotulo}</Text>
            </Pressable>
          ))}
          <Botao rotulo={cancelarRotulo} variante="secundario" testID={testID ? `${testID}-cancelar` : undefined} acao={aoFechar} estilo={{ marginTop: 10 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Uma ação do menu "•••": ícone de 20 e texto 800 de 16; a de perigo (Apagar, Denunciar) vem por último, em vermelho. */
export type AcaoDoMenu = { rotulo: string; icone: NomeIcone; aoEscolher: () => void; perigo?: boolean; testID?: string; nomeAcessivel?: string };

/** Medidas do balão (spec 11): itens de 48, respiro de 6, borda de 1 e a linha antes do perigo (1 px, com 6 acima e abaixo). */
const ITEM_DO_MENU = 48;
const RESPIRO_DO_MENU = 6;
const LINHA_DO_MENU = 13;
const CURVA_DO_MENU = Easing.bezier(0.2, 0.9, 0.3, 1);

/**
 * Menu de ações do Studoo (spec 11), o mesmo no iPhone, no Android e na web: o "•••" de 44 × 44 e o balão de 200 a 280,
 * embaixo do botão, alinhado pela direita, a 6 (em cima quando falta espaço até a borda ou até a barra de baixo; sempre a 8
 * das bordas). Entra em 160 ms (opacidade e escala de 0,96 a partir do canto do botão) e sai em 120 ms; com movimento
 * reduzido, só a opacidade. Tocar fora fecha sem acionar o que estiver embaixo; voltar, Esc ou o gesto de escapar do
 * VoiceOver fecham e devolvem o foco ao "•••". Escolher fecha o balão e só depois abre o destino (no iPhone, depois que o
 * balão saiu, como em janelas.ts). Leitor de tela (spec 11, 19/11): no app, o balão é um contêiner com o rótulo "Menu, N
 * opções" (`componentes.menuRotulo`), que recebe o foco ao abrir (`accessibilityViewIsModal` no iOS), e cada item é um botão
 * com o próprio texto. O mesmo na prévia web (os papéis `menu` e `menuitem` são da web, não do app).
 */
export function MenuDeAcoes({ rotulo, acoes, testID, desativado = false, estiloBotao, corDosPontos = cores.textoSecundario }: {
  /** Nome acessível do "•••" ("Mais opções de “<título>”"). */
  rotulo: string;
  acoes: AcaoDoMenu[];
  testID: string;
  desativado?: boolean;
  /** Estilo do botão onde ele mora (no alto da capa, com sombra; na fileira do cartão do Explorar, com contorno). */
  estiloBotao?: StyleProp<ViewStyle>;
  corDosPontos?: string;
}) {
  const [lugar, setLugar] = useState<{ direita: number; topo?: number; baixo?: number } | null>(null);
  const botao = useRef<ComponentRef<typeof Pressable>>(null);
  const rotuloDoBalao = useRef<ComponentRef<typeof View>>(null);
  const janela = useWindowDimensions();
  const baixoOcupado = useContext(BaixoOcupado);
  const reduzir = useMovimentoReduzido() !== false;
  const [opacidade] = useState(() => new Animated.Value(0));
  const [escala] = useState(() => new Animated.Value(1));
  const fechando = useRef(false);
  const { depoisDeSair, aoSair } = useDepoisDeSair();
  // O perigo vem sempre por último, depois de uma linha; num menu só com ele, não há linha.
  const comuns = acoes.filter((acao) => !acao.perigo);
  const perigos = acoes.filter((acao) => acao.perigo);
  const comLinha = comuns.length > 0 && perigos.length > 0;
  const altura = 2 + 2 * RESPIRO_DO_MENU + ITEM_DO_MENU * acoes.length + (comLinha ? LINHA_DO_MENU : 0);

  function abrir() {
    botao.current?.measureInWindow((x, y, largura, alturaBotao) => {
      const direita = Math.max(8, janela.width - (x + largura));
      const cabeEmbaixo = y + alturaBotao + 6 + altura <= janela.height - baixoOcupado - 8;
      fechando.current = false;
      opacidade.setValue(0);
      escala.setValue(reduzir ? 1 : 0.96);
      setLugar(cabeEmbaixo ? { direita, topo: y + alturaBotao + 6 } : { direita, baixo: Math.max(8, janela.height - y + 6) });
      Animated.parallel([
        Animated.timing(opacidade, { toValue: 1, duration: reduzir ? 120 : 160, easing: CURVA_DO_MENU, useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1, duration: reduzir ? 0 : 160, easing: CURVA_DO_MENU, useNativeDriver: true }),
      ]).start();
    });
  }
  function fechar(depois?: () => void, devolverFoco = false) {
    if (fechando.current) return;
    fechando.current = true;
    Animated.timing(opacidade, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setLugar(null);
      if (depois) depoisDeSair(depois);
      if (devolverFoco) setTimeout(() => focarSemRolar(botao.current), 50);
    });
  }
  const item = (acao: AcaoDoMenu, indice: number) => (
    // Botão, não `menuitem`: no iPhone esse papel não tem o traço de botão, e o VoiceOver deixaria de dizer "botão".
    <Pressable key={acao.rotulo} testID={acao.testID} accessibilityRole="button"
      accessibilityLabel={acao.nomeAcessivel ?? acao.rotulo} onPress={() => fechar(acao.aoEscolher)}
      style={({ pressed }) => [estilos.menuItem, pressed && { backgroundColor: cores.nevoa }]}>
      <Icone nome={acao.icone} tamanho={20} cor={acao.perigo ? cores.erro : cores.texto} />
      <Text numberOfLines={1} style={[estilos.menuItemTexto, acao.perigo && { color: cores.erro }]}>{acao.rotulo}</Text>
    </Pressable>
  );

  return (
    <>
      <Pressable ref={botao} testID={testID} accessibilityRole="button" accessibilityLabel={rotulo} hitSlop={2}
        accessibilityState={{ expanded: Boolean(lugar), disabled: desativado }} aria-expanded={Boolean(lugar)} aria-haspopup="menu" disabled={desativado}
        onPress={() => (lugar ? fechar() : abrir())}
        style={({ pressed }) => [estilos.menuBotao, estiloBotao, (Boolean(lugar) || pressed) && estilos.menuBotaoAberto, desativado && { opacity: 0.6 }]}>
        <View style={estilos.menuPontos} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {[0, 1, 2].map((ponto) => <View key={ponto} style={[estilos.menuPonto, { backgroundColor: corDosPontos }]} />)}
        </View>
      </Pressable>
      {/* Montado sempre (visible liga e desliga): o onDismiss avisa quando o balão saiu, para o destino abrir depois. */}
      <Modal transparent visible={Boolean(lugar)} animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => fechar(undefined, true)}
        onShow={() => focarSemRolar(rotuloDoBalao.current)} onDismiss={aoSair}>
        {lugar && (
          <>
            <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={() => fechar()} />
            <Animated.View testID={`${testID}-balao`} accessibilityViewIsModal onAccessibilityEscape={() => fechar(undefined, true)}
              style={[estilos.menuBalao, { right: lugar.direita, top: lugar.topo, bottom: lugar.baixo, maxWidth: Math.min(280, janela.width - 16), opacity: opacidade,
                transform: [{ scale: escala }], transformOrigin: lugar.topo !== undefined ? 'right top' : 'right bottom' }]}>
              {/* O rótulo do contêiner, do tamanho do balão e por baixo dos itens (o toque passa para eles): é ele que o leitor de
                  tela anuncia e foca ao abrir. Um contêiner `accessible` esconderia os itens do VoiceOver; por isso um elemento à parte. */}
              <View ref={rotuloDoBalao} testID={`${testID}-rotulo`} accessible accessibilityLabel={mensagens.componentes.menuRotulo(acoes.length)}
                pointerEvents="none" style={StyleSheet.absoluteFill} />

              {comuns.map(item)}
              {comLinha && <View style={estilos.menuLinha} />}
              {perigos.map((acao, indice) => item(acao, comuns.length + indice))}
            </Animated.View>
          </>
        )}
      </Modal>
    </>
  );
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
  entradaFocada: { borderColor: cores.acao, outlineColor: 'rgba(37, 99, 255, 0.18)', outlineWidth: 4, outlineOffset: 0, outlineStyle: 'solid' },
  entradaErroFocada: { outlineColor: 'rgba(194, 59, 78, 0.14)' },
  entradaComAcessorio: { paddingRight: 52 },
  acessorio: { position: 'absolute', right: 4, top: 0, bottom: 0, justifyContent: 'center' },
  campoErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campoErroTexto: { flex: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  campoErroColado: { gap: 6, marginTop: -2 },
  campoErroIcone: { marginTop: 2 },
  campoErroTextoColado: { fontWeight: '800' },
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
  estadoErroStu: { flexShrink: 0 },
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
  // Barra por cima do conteúdo (com o vidro): encostada embaixo, de ponta a ponta.
  sobreposto: { position: 'absolute', left: 0, right: 0, bottom: 0 },
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
  modalFundo: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  // Confirmação (spec 11): cartão de até 400 com respiro de 24, cantos de 24, borda de 2 e 12 entre os blocos.
  confirmacaoCartao: { width: '100%', maxWidth: 400, gap: 12, padding: 24, borderWidth: 2, borderColor: cores.gelo, borderRadius: 24, backgroundColor: cores.fundo,
    shadowColor: '#0F172A', shadowOpacity: 0.24, shadowRadius: 48, shadowOffset: { width: 0, height: 20 }, elevation: 12 },
  confirmacaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26 },
  confirmacaoTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '400', fontSize: 16, lineHeight: 24 },
  confirmacaoErro: { color: cores.erro, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22 },
  confirmacaoAcoes: { flexDirection: 'row', gap: 8, marginTop: 4 },
  confirmacaoAcoesEmpilhadas: { flexDirection: 'column', gap: 10 },
  confirmacaoMetade: { flex: 1 },
  // Folha de ações (esboço "Foto do perfil"): cantos de 24 em cima, respiro de 10 × 16 (28 embaixo, mais a área segura).
  // Menu de ações (spec 11): botão de 44 × 44 e raio 12 com três pontos de 4 (4 entre eles); aberto, fundo névoa.
  menuBotao: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  menuBotaoAberto: { backgroundColor: cores.nevoa },
  menuPontos: { flexDirection: 'row', gap: 4 },
  menuPonto: { width: 4, height: 4, borderRadius: 2 },
  menuBalao: { position: 'absolute', minWidth: 200, padding: RESPIRO_DO_MENU, borderWidth: 1, borderColor: cores.gelo, borderRadius: 16,
    backgroundColor: cores.fundo, boxShadow: '0 12px 28px rgba(15, 23, 42, 0.18)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, height: ITEM_DO_MENU, paddingHorizontal: 12, borderRadius: 10 },
  menuItemTexto: { flexShrink: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 22 },
  menuLinha: { height: 1, marginVertical: 6, marginHorizontal: 4, backgroundColor: cores.gelo },
  folhaAcoesFundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  folhaAcoes: { gap: 4, paddingTop: 10, paddingHorizontal: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: cores.fundo },
  folhaAcoesAlca: { alignSelf: 'center', width: 40, height: 5, marginBottom: 8, borderRadius: 3, backgroundColor: cores.gelo },
  folhaAcoesTitulo: { marginTop: 4, marginHorizontal: 4, marginBottom: 8, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26 },
  folhaAcoesOpcao: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 12, borderRadius: 14 },
  folhaAcoesOpcaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 17, lineHeight: 22 },
  // Aviso (spec 11): centrado, até 480, 16 das bordas; ícone de 20 a 10 do texto branco 800 de 15/22; ação em #AFC2FF.
  avisoLugar: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 70 },
  aviso: { width: '100%', maxWidth: 480, flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: cores.texto, shadowColor: '#0F172A', shadowOpacity: 0.28, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  avisoIcone: { marginTop: 1 },
  avisoTexto: { flex: 1, color: '#FFFFFF', fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, fontWeight: '800' },
  avisoAcao: { minHeight: 44, marginVertical: -11, justifyContent: 'center', paddingLeft: 4 },
  avisoAcaoTexto: { color: '#AFC2FF', fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22, fontWeight: '800' },
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
  // Spec 11: a ação que destrói, vermelha cheia (#C23B4E), texto branco e degrau #8F2A39.
  botaoFacePerigo: { borderColor: cores.erro, backgroundColor: cores.erro },
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
function NavegacaoInferior({ fundo, sobreposta, aoMedir }: {
  /** A área segura de baixo, dentro da barra (o fundo dela vai até a borda da tela). */
  fundo: number;
  /** Com o vidro (iOS 26+), a barra fica por cima do conteúdo, encostada na borda de baixo. */
  sobreposta: boolean;
  aoMedir: (altura: number) => void;
}) {
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
  const borda = [fundo > 0 && { paddingBottom: 8 + fundo }, sobreposta && estilos.sobreposto];
  return <FundoDeBarra testID="barra-de-baixo" accessibilityRole="tablist" estilo={[navegacaoEstilos.faixa, vao, ...borda]} estiloVidro={[navegacaoEstilos.faixaVidro, vao, ...borda]}
    onLayout={(evento) => aoMedir(evento.nativeEvent.layout.height)}>
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
