import { abertura, criarControleAbertura, permiteAbertura, type FaseAbertura, type MotivoDaAbertura } from '@studoo/contratos/abertura';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import {
  AccessibilityInfo, Animated, AppState, BackHandler, Easing, Image, Platform, StyleSheet, View,
  type GestureResponderEvent, type ViewStyle,
} from 'react-native';
import { useMovimentoReduzido } from './movimento';

// A identidade visual já existe antes das fontes. Expo Go usa a própria launch screen;
// a composição nativa abaixo depende de um novo build com o plugin configurado.
let splashOculto = Platform.OS === 'web';
let ocultandoSplash = false;
let segurancaNativa: ReturnType<typeof setTimeout> | undefined;

export function ocultarSplashNativo() {
  if (splashOculto || ocultandoSplash) return;
  ocultandoSplash = true;
  void SplashScreen.hideAsync().then(() => {
    splashOculto = true;
    clearTimeout(segurancaNativa);
  }).catch(() => {
    // No Expo Go ou em um erro de inicialização, não transformar o fallback em outra falha de tela.
  }).finally(() => { ocultandoSplash = false; });
}

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  // A tela do Expo Go pertence a ele; ajustar suas opções geraria só um aviso, sem provar a tela nativa do Studoo.
  if (!isRunningInExpoGo()) {
    try { SplashScreen.setOptions({ fade: false, duration: 0 }); } catch { /* O fallback visual continua disponível. */ }
  }
  // Proteção também se a raiz falhar antes de instalar seus efeitos.
  segurancaNativa = setTimeout(ocultarSplashNativo, abertura.limiteMs);
}

let aberturaConsumida = false;
type Controle = ReturnType<typeof criarControleAbertura>;

/** Camada de abertura; seus filhos continuam montados e restaurando sessão em paralelo. */
export function Abertura({ pronta, falha = false, children }: { pronta: boolean; falha?: boolean; children: ReactNode }) {
  const caminho = usePathname();
  const parametros = useGlobalSearchParams();
  const consulta = Object.keys(parametros).length ? '?' : '';
  const fragmento = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hash : '';
  const consultaWeb = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.search : consulta;
  const permitida = permiteAbertura(caminho, consultaWeb, fragmento);
  // Só lê no render. O mesmo mount do StrictMode conserva esta decisão nos dois setups de efeito.
  const [iniciar] = useState(() => !aberturaConsumida && permitida);
  const [fase, setFase] = useState<FaseAbertura>(iniciar ? 'visivel' : 'concluida');
  const [layoutPronto, setLayoutPronto] = useState(false);
  const [imagemPronta, setImagemPronta] = useState(false);
  const controle = useRef<Controle | null>(null);
  const conteudo = useRef<ComponentRef<typeof View>>(null);
  const progresso = useRef(new Animated.Value(0)).current;
  const opacidade = useRef(new Animated.Value(1)).current;
  const movimentoReduzido = useMovimentoReduzido();
  const ativa = fase !== 'concluida';

  function pular(motivo: Exclude<MotivoDaAbertura, 'pronto'> = 'interacao') {
    controle.current?.pular(motivo);
  }

  useEffect(() => {
    aberturaConsumida = true;
    if (!iniciar) return;
    // A ocultação nativa acontece no efeito de layout/imagem, depois de este estado chegar à árvore visual.
    const atual = criarControleAbertura((proximaFase) => setFase(proximaFase));
    controle.current = atual;
    return () => { atual.destruir(); if (controle.current === atual) controle.current = null; };
  }, [iniciar]);

  useEffect(() => {
    if (!permitida) pular('contexto');
  }, [permitida]);

  useEffect(() => {
    if (layoutPronto && (imagemPronta || !ativa)) ocultarSplashNativo();
  }, [layoutPronto, imagemPronta, ativa]);

  useEffect(() => {
    if (falha) { pular('falha'); return; }
    if (movimentoReduzido === true) { pular('preferencia'); return; }
    if (!pronta || !layoutPronto || !imagemPronta) return;
    let segundaMoldura: number | undefined;
    // Confirma o primeiro quadro local pintado, como na web; nunca aguarda a API ou o fim da acomodação.
    const primeiraMoldura = requestAnimationFrame(() => {
      segundaMoldura = requestAnimationFrame(() => controle.current?.pronto(movimentoReduzido === false));
    });
    return () => {
      cancelAnimationFrame(primeiraMoldura);
      if (segundaMoldura !== undefined) cancelAnimationFrame(segundaMoldura);
    };
  }, [pronta, falha, layoutPronto, imagemPronta, movimentoReduzido]);

  useEffect(() => {
    if (!ativa) return;
    let presente = true;
    // O navegador não informa leitor de tela; o RN Web retorna true fixo nessa API.
    if (Platform.OS !== 'web') {
      void AccessibilityInfo.isScreenReaderEnabled().then((ligado) => {
        if (presente && ligado) pular('preferencia');
      }).catch(() => { if (presente) pular('preferencia'); });
    }
    const leitor = Platform.OS !== 'web'
      ? AccessibilityInfo.addEventListener('screenReaderChanged', (ligado) => { if (ligado) pular('preferencia'); })
      : null;
    const app = AppState.addEventListener('change', (estado) => { if (estado !== 'active') pular('contexto'); });
    const voltar = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => {
      if (fase !== 'visivel') return false;
      pular(); return true;
    }) : null;
    if (AppState.currentState && AppState.currentState !== 'active') pular('contexto');
    return () => { presente = false; leitor?.remove(); app.remove(); voltar?.remove(); };
  }, [ativa, fase]);

  useEffect(() => {
    if (fase !== 'visivel' || movimentoReduzido !== false || !layoutPronto || !imagemPronta) return;
    const trecho = (toValue: number) => Animated.timing(progresso, {
      toValue, duration: abertura.acomodacaoMs / 2,
      easing: Easing.bezier(...abertura.curva), useNativeDriver: Platform.OS !== 'web',
    });
    // A curva se aplica a cada metade, como os keyframes 0/50/100 da web.
    const animacao = Animated.sequence([trecho(0.5), trecho(1)]);
    animacao.start();
    return () => animacao.stop();
  }, [fase, movimentoReduzido, layoutPronto, imagemPronta, progresso]);

  useEffect(() => {
    if (fase !== 'saindo') return;
    const animacao = Animated.timing(opacidade, {
      toValue: 0, duration: abertura.saidaMs,
      easing: Easing.bezier(...abertura.curva), useNativeDriver: Platform.OS !== 'web',
    });
    animacao.start();
    return () => animacao.stop();
  }, [fase, opacidade]);

  useEffect(() => {
    if (Platform.OS !== 'web' || fase !== 'visivel' || typeof document === 'undefined') return;
    let focoAdiado: number | undefined;
    const teclado = (evento: KeyboardEvent) => {
      if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.key === 'Shift') return;
      pular();
      // O primeiro Tab abre a interface e continua a navegação por teclado, sem acionar nada oculto.
      if (evento.key === 'Tab') {
        evento.preventDefault();
        focoAdiado = requestAnimationFrame(() => {
          if (document.activeElement && document.activeElement !== document.body) return;
          const no = conteudo.current as unknown as HTMLElement | null;
          const candidatos = Array.from(no?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') ?? []);
          const visiveis = candidatos.filter((item) => item.getClientRects().length && getComputedStyle(item).visibility !== 'hidden');
          (evento.shiftKey ? visiveis.at(-1) : visiveis[0])?.focus();
        });
      } else { evento.preventDefault(); evento.stopPropagation(); }
    };
    const ocultada = () => { if (document.hidden) pular('contexto'); };
    document.addEventListener('keydown', teclado, true);
    document.addEventListener('visibilitychange', ocultada);
    return () => {
      document.removeEventListener('keydown', teclado, true);
      document.removeEventListener('visibilitychange', ocultada);
      // O frame pertence ao gesto de Tab que acabou de concluir a intro; deixa-o terminar uma única vez.
      if (controle.current?.fase() !== 'concluida' && focoAdiado !== undefined) cancelAnimationFrame(focoAdiado);
    };
  }, [fase]);

  function dispensarToque(evento: GestureResponderEvent) {
    evento.preventDefault();
    evento.stopPropagation();
    pular();
  }

  const ocultaConteudo = fase === 'visivel';
  return <View style={estilos.raiz} onLayout={() => setLayoutPronto(true)}>
    <View ref={conteudo} style={[estilos.conteudo, ocultaConteudo && estilos.conteudoOculto,
      Platform.OS === 'web' && ocultaConteudo && ({ visibility: 'hidden' } as ViewStyle)]}
      pointerEvents={ocultaConteudo ? 'none' : 'auto'} accessibilityElementsHidden={ocultaConteudo} aria-hidden={ocultaConteudo}
      importantForAccessibility={ocultaConteudo ? 'no-hide-descendants' : 'auto'}>
      {children}
    </View>
    {ativa && <Animated.View testID="abertura-studoo" style={[estilos.camada, { opacity: opacidade }]}
      pointerEvents={ocultaConteudo ? 'auto' : 'none'}
      accessible={false} accessibilityElementsHidden aria-hidden importantForAccessibility="no-hide-descendants"
      onStartShouldSetResponder={() => ocultaConteudo} onResponderGrant={dispensarToque}>
      <Animated.View style={{ transform: [
        { translateY: progresso.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -abertura.deslocamentoMaximo, 0] }) },
        { scale: progresso.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, abertura.escalaMaxima, 1] }) },
      ] }}>
        <Image testID="abertura-marca" source={require('../assets/marca/logo-com-sorriso.png')} style={estilos.marca}
          resizeMode="contain" fadeDuration={0} accessible={false}
          onLoad={() => setImagemPronta(true)} onError={() => pular('falha')} />
      </Animated.View>
    </Animated.View>}
  </View>;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: abertura.fundo },
  conteudo: { flex: 1 },
  conteudoOculto: { opacity: 0 },
  camada: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: abertura.fundo },
  marca: { width: abertura.largura, height: abertura.altura },
});
