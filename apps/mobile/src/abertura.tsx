import { abertura, criarControleAbertura, criarJanelaVisualAbertura, decidirInicioAbertura, dispensarAberturaPorContexto, duracaoDaCoreografia, permiteAbertura, progressoDaCoreografia, type EstadoAppAbertura, type FaseAbertura, type MotivoDaAbertura } from '@studoo/contratos/abertura';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { useGlobalSearchParams, usePathname } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import {
  AccessibilityInfo, Animated, AppState, BackHandler, Easing, Image, Platform, StyleSheet, View,
  type GestureResponderEvent, type ViewStyle,
} from 'react-native';
import { usePreferenciaMovimentoReduzido } from './movimento';
import { cores } from './tema';

const agoraMonotono = typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now.bind(performance) : Date.now;
function estadoDoApp(estado: string | null | undefined): EstadoAppAbertura {
  if (estado == null) return null;
  if (estado === 'active' || estado === 'inactive' || estado === 'background' || estado === 'extension') return estado;
  return 'unknown';
}

// A identidade visual já existe antes das fontes. Expo Go usa a própria launch screen;
// a composição nativa abaixo depende de um novo build com o plugin configurado.
let splashOculto = Platform.OS === 'web';
let ocultandoSplash: Promise<boolean> | undefined;
let segurancaNativa: ReturnType<typeof setTimeout> | undefined;

export function ocultarSplashNativo(): Promise<boolean> {
  if (splashOculto) return Promise.resolve(true);
  if (ocultandoSplash) return ocultandoSplash;
  ocultandoSplash = SplashScreen.hideAsync().then(() => {
    splashOculto = true;
    clearTimeout(segurancaNativa);
    return true;
  }).catch(() => {
    // No Expo Go ou em um erro de inicialização, não transformar o fallback em outra falha de tela.
    return false;
  }).finally(() => { ocultandoSplash = undefined; });
  return ocultandoSplash;
}

if (Platform.OS !== 'web') {
  void SplashScreen.preventAutoHideAsync().catch(() => undefined);
  // A tela do Expo Go pertence a ele; ajustar suas opções geraria só um aviso, sem provar a tela nativa do Studoo.
  if (!isRunningInExpoGo()) {
    try { SplashScreen.setOptions({ fade: false, duration: 0 }); } catch { /* O fallback visual continua disponível. */ }
  }
  // Proteção também se a raiz falhar antes de instalar seus efeitos.
  segurancaNativa = setTimeout(ocultarSplashNativo, abertura.limiteNativoMs);
}

let aberturaConsumida = false;
type Controle = ReturnType<typeof criarControleAbertura>;
type ParteDaMarca = 'inteira' | 'palavra' | 'oculos' | 'sorriso';
const fonteDaMarca = require('../assets/marca/logo-com-sorriso.png');
const fonteDosOculos = require('../assets/marca/abertura-oculos-hd.png');
const escalaDaFonte = abertura.largura / abertura.fonte.largura;
const larguraDaPalavra = abertura.fonte.divisao * escalaDaFonte;
const larguraDosOculos = abertura.largura - larguraDaPalavra;
const alturaDosOculos = abertura.fonte.linhaSorriso * escalaDaFonte;
const centroDosOculos = larguraDaPalavra + larguraDosOculos / 2 - abertura.largura / 2;

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
  const [imagensProntas, setImagensProntas] = useState(false);
  const partesProntas = useRef(new Set<ParteDaMarca>());
  const [splashLiberado, setSplashLiberado] = useState(splashOculto);
  const controle = useRef<Controle | null>(null);
  const encerrada = useRef(!iniciar);
  const preparacao = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prazoDaPreparacao = useRef<number | null>(null);
  const janela = useMemo(() => criarJanelaVisualAbertura(agoraMonotono), []);
  const [janelaAtiva, setJanelaAtiva] = useState(false);
  const [estadoApp, setEstadoApp] = useState<EstadoAppAbertura>(() => estadoDoApp(AppState.currentState));
  const jaEsteveAtivo = useRef(AppState.currentState === 'active');
  const [leitorDeTela, setLeitorDeTela] = useState<boolean | null>(Platform.OS === 'web' ? false : null);
  const conteudo = useRef<ComponentRef<typeof View>>(null);
  const progresso = useRef(new Animated.Value(0)).current;
  const opacidade = useRef(new Animated.Value(1)).current;
  const movimentoReduzido = usePreferenciaMovimentoReduzido();
  const ativa = fase !== 'concluida';

  function pular(motivo: Exclude<MotivoDaAbertura, 'pronto'> = 'interacao') {
    if (encerrada.current) return;
    encerrada.current = true;
    clearTimeout(preparacao.current);
    if (controle.current) controle.current.pular(motivo);
    else setFase('concluida');
  }

  function carregouImagem(parte: ParteDaMarca) {
    partesProntas.current.add(parte);
    if (partesProntas.current.size === 4) setImagensProntas(true);
  }

  useEffect(() => {
    aberturaConsumida = true;
    if (!iniciar || encerrada.current) return;
    // Preparação limitada, sem gastar a assinatura enquanto o iOS ainda está
    // inactive/unknown ou responde às consultas nativas de acessibilidade.
    if (prazoDaPreparacao.current === null) prazoDaPreparacao.current = agoraMonotono() + abertura.limitePreparacaoMs;
    preparacao.current = setTimeout(() => pular('limite'), Math.max(0, prazoDaPreparacao.current - agoraMonotono()));
    return () => {
      clearTimeout(preparacao.current);
      controle.current?.destruir();
      controle.current = null;
    };
  }, [iniciar]);

  useEffect(() => {
    if (!permitida) pular('contexto');
  }, [permitida]);

  useEffect(() => {
    if (!layoutPronto || (!imagensProntas && ativa)) return;
    let presente = true;
    void ocultarSplashNativo().then((oculto) => { if (presente && oculto) setSplashLiberado(true); });
    return () => { presente = false; };
  }, [layoutPronto, imagensProntas, ativa]);

  useEffect(() => {
    if (falha) { pular('falha'); return; }
    const decisao = decidirInicioAbertura({
      estadoApp, jaEsteveAtivo: jaEsteveAtivo.current, movimentoReduzido, leitorDeTela,
      layoutPronto, imagensProntas, splashLiberado,
    });
    if (decisao === 'preferencia' || decisao === 'contexto') { pular(decisao); return; }
    if (decisao !== 'iniciar' || encerrada.current || controle.current) return;
    clearTimeout(preparacao.current);
    janela.iniciar();
    controle.current = criarControleAbertura((proximaFase) => {
      if (proximaFase === 'concluida') encerrada.current = true;
      setFase(proximaFase);
    }, undefined, janela.restante());
    setJanelaAtiva(true);
  }, [falha, estadoApp, movimentoReduzido, leitorDeTela, layoutPronto, imagensProntas, splashLiberado, janela]);

  useEffect(() => {
    // Preferência desconhecida nunca é convertida em pronto(false), que
    // encerrava o controlador antes de o iOS responder reduceMotion=false.
    if (!janelaAtiva || !pronta || encerrada.current) return;
    let segundaMoldura: number | undefined;
    // A prontidão local é independente da coreografia; o controlador junta os dois sinais sem esperar a API.
    const primeiraMoldura = requestAnimationFrame(() => {
      segundaMoldura = requestAnimationFrame(() => controle.current?.pronto(true));
    });
    return () => {
      cancelAnimationFrame(primeiraMoldura);
      if (segundaMoldura !== undefined) cancelAnimationFrame(segundaMoldura);
    };
  }, [pronta, janelaAtiva]);

  useEffect(() => {
    if (!ativa) return;
    let presente = true;
    // O navegador não informa leitor de tela; o RN Web retorna true fixo nessa API.
    if (Platform.OS !== 'web') {
      void AccessibilityInfo.isScreenReaderEnabled().then((ligado) => {
        if (!presente) return;
        setLeitorDeTela(ligado);
        if (ligado) pular('preferencia');
      }).catch(() => { if (presente) pular('preferencia'); });
    }
    const leitor = Platform.OS !== 'web'
      ? AccessibilityInfo.addEventListener('screenReaderChanged', (ligado) => { setLeitorDeTela(ligado); if (ligado) pular('preferencia'); })
      : null;
    const observarEstado = (estadoNativo: string | null | undefined) => {
      const estado = estadoDoApp(estadoNativo);
      if (dispensarAberturaPorContexto(estado, jaEsteveAtivo.current)) pular('contexto');
      if (estado === 'active') jaEsteveAtivo.current = true;
      setEstadoApp(estado);
    };
    const app = AppState.addEventListener('change', observarEstado);
    const voltar = Platform.OS === 'android' ? BackHandler.addEventListener('hardwareBackPress', () => {
      if (fase !== 'visivel') return false;
      pular(); return true;
    }) : null;
    observarEstado(AppState.currentState);
    return () => { presente = false; leitor?.remove(); app.remove(); voltar?.remove(); };
  }, [ativa, fase]);

  useEffect(() => {
    if (fase !== 'visivel' || !janelaAtiva) return;
    const atual = controle.current;
    let presente = true;
    let animacao: ReturnType<typeof Animated.timing> | undefined;
    progresso.setValue(0);
    // O easing conserva os trechos em um único timing, sem voltar ao JS a cada marco da coreografia.
    const primeiraMoldura = requestAnimationFrame(() => {
      if (!presente || encerrada.current) return;
      const duracao = duracaoDaCoreografia(janela.restante());
      // Decide antes do primeiro movimento: se o saldo não comporta a assinatura, dispensa o PNG inteiro.
      if (duracao === 0) { atual?.pular('limite'); return; }
      animacao = Animated.timing(progresso, {
        toValue: 1, duration: duracao,
        easing: progressoDaCoreografia, useNativeDriver: Platform.OS !== 'web',
      });
      animacao.start(({ finished }) => {
        if (presente && finished) atual?.animacaoConcluida();
      });
    });
    return () => {
      presente = false;
      cancelAnimationFrame(primeiraMoldura);
      animacao?.stop();
    };
  }, [fase, janelaAtiva, janela, progresso]);

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

  const { marcaOpacidade, fatiasOpacidade, oculosX, oculosY, oculosEscala, oculosRotacao, palavraOpacidade, palavraX,
    sorrisoOpacidade, sorrisoEscala, lenteOpacidade, reflexoOpacidade, reflexoX } = useMemo(() => {
    // Prontidão e troca entre PNG/fatias não recriam o grafo que está rodando no driver nativo.
    const interpolar = (valores: number[]) => progresso.interpolate({ inputRange: abertura.marcos, outputRange: valores, extrapolate: 'clamp' });
    const retornoDaMarcaInteira = abertura.marcos[abertura.marcos.length - 2];
    const marcosDoBitmap = [0, 0.001, retornoDaMarcaInteira - 0.001, retornoDaMarcaInteira, 1];
    return {
      // O bitmap integral coincide com a launch screen; as fatias só aparecem enquanto ele se move.
      marcaOpacidade: progresso.interpolate({ inputRange: marcosDoBitmap, outputRange: [1, 0, 0, 1, 1], extrapolate: 'clamp' }),
      fatiasOpacidade: progresso.interpolate({ inputRange: marcosDoBitmap, outputRange: [0, 1, 1, 0, 0], extrapolate: 'clamp' }),
      oculosX: interpolar(abertura.oculosX.map((valor) => valor * centroDosOculos)),
      oculosY: interpolar(abertura.oculosY),
      oculosEscala: interpolar(abertura.oculosEscala),
      oculosRotacao: progresso.interpolate({
        inputRange: abertura.marcos, outputRange: abertura.oculosRotacao.map((valor) => `${valor}deg`), extrapolate: 'clamp',
      }),
      palavraOpacidade: interpolar(abertura.palavraOpacidade), palavraX: interpolar(abertura.palavraX),
      sorrisoOpacidade: interpolar(abertura.sorrisoOpacidade), sorrisoEscala: interpolar(abertura.sorrisoEscala),
      lenteOpacidade: interpolar(abertura.lenteOpacidade), reflexoOpacidade: interpolar(abertura.reflexoOpacidade),
      reflexoX: interpolar(abertura.reflexoX),
    };
  }, [progresso]);
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
      <View style={estilos.palco}>
        <Animated.Image testID="abertura-marca" source={fonteDaMarca} style={[estilos.marca, { opacity: marcaOpacidade }]}
          resizeMode="contain" fadeDuration={0} accessible={false}
          onLoad={() => carregouImagem('inteira')} onError={() => pular('falha')} />
        <Animated.View style={[estilos.fatias, { opacity: fatiasOpacidade }]} pointerEvents="none">
          <Animated.View testID="abertura-palavra" style={[estilos.palavra, { opacity: palavraOpacidade, transform: [{ translateX: palavraX }] }]}>
            <Image source={fonteDaMarca} style={estilos.imagemDaPalavra} resizeMode="contain" fadeDuration={0} accessible={false}
              onLoad={() => carregouImagem('palavra')} onError={() => pular('falha')} />
          </Animated.View>
          <Animated.View testID="abertura-oculos" style={[estilos.oculos, { transform: [
            { translateX: oculosX }, { translateY: oculosY }, { rotate: oculosRotacao }, { scale: oculosEscala },
          ] }]}>
            <View style={estilos.aros}>
              {abertura.lentes.map((lente, indice) => {
                const diametro = lente.diametro * escalaDaFonte;
                return <View key={indice} style={[estilos.lente, {
                  left: (lente.x - lente.diametro / 2 - abertura.fonte.divisao) * escalaDaFonte,
                  top: (lente.y - lente.diametro / 2) * escalaDaFonte,
                  width: diametro, height: diametro, borderRadius: diametro / 2,
                }]}>
                  <Animated.View style={[estilos.vidro, { opacity: lenteOpacidade }]} />
                  <Animated.View style={[estilos.reflexo, {
                    left: diametro / 2 - 2, top: -diametro / 2, height: diametro * 2,
                    opacity: reflexoOpacidade, transform: [{ translateX: reflexoX }, { rotate: '-24deg' }],
                  }]} />
                </View>;
              })}
              <Image source={fonteDosOculos} style={estilos.imagemDosOculos} resizeMode="contain" fadeDuration={0} accessible={false}
                onLoad={() => carregouImagem('oculos')} onError={() => pular('falha')} />
            </View>
            <Animated.View testID="abertura-sorriso" style={[estilos.sorriso, { opacity: sorrisoOpacidade, transform: [{ scaleX: sorrisoEscala }] }]}>
              <Image source={fonteDosOculos} style={estilos.imagemDoSorriso} resizeMode="contain" fadeDuration={0} accessible={false}
                onLoad={() => carregouImagem('sorriso')} onError={() => pular('falha')} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>}
  </View>;
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: abertura.fundo },
  conteudo: { flex: 1 },
  conteudoOculto: { opacity: 0 },
  camada: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: abertura.fundo },
  palco: { width: abertura.largura, height: abertura.altura },
  marca: { position: 'absolute', width: abertura.largura, height: abertura.altura },
  fatias: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  palavra: { position: 'absolute', left: 0, top: 0, width: larguraDaPalavra, height: abertura.altura, overflow: 'hidden' },
  imagemDaPalavra: { position: 'absolute', left: 0, top: 0, width: abertura.largura, height: abertura.altura },
  oculos: { position: 'absolute', left: larguraDaPalavra, top: 0, width: larguraDosOculos, height: abertura.altura },
  aros: { position: 'absolute', left: 0, top: 0, width: larguraDosOculos, height: alturaDosOculos, overflow: 'hidden' },
  imagemDosOculos: { position: 'absolute', left: -larguraDaPalavra, top: 0, width: abertura.largura, height: abertura.altura },
  sorriso: { position: 'absolute', left: 0, top: alturaDosOculos, width: larguraDosOculos, height: abertura.altura - alturaDosOculos, overflow: 'hidden' },
  imagemDoSorriso: { position: 'absolute', left: -larguraDaPalavra, top: -alturaDosOculos, width: abertura.largura, height: abertura.altura },
  lente: { position: 'absolute', overflow: 'hidden' },
  vidro: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: cores.acao },
  reflexo: { position: 'absolute', width: 4, backgroundColor: '#FFFFFF' },
});
