import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image, Keyboard, PixelRatio, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { Image as ImagemAnimada } from 'expo-image';
import { CATALOGO_STU, faixaAnimadaDoStu, faixaDoStu, type NomeStu } from '@studoo/contratos';
import { useMovimentoReduzido } from './movimento';
import { ESPERA_DESENHO_MS, GARANTIA_DO_POP_MS, camadasDoStu } from './mascote-regras';
import { ANIMADO_STU, PARADO_STU } from './stu-arquivos';

/**
 * Modos da animação (spec 13, emenda E1), os mesmos da web (`src/ui/mascote.tsx`): `laco` repete enquanto está na tela
 * (com as pausas da E4); `uma-vez` faz um ciclo quando aparece; `acontecimento` fica parado até `acontecimento` mudar e faz
 * `ciclos` ciclos; `periodico` faz um ciclo a cada 8 s. Sem modo, só a imagem parada.
 */
export type ModoAnimacaoStu = 'laco' | 'uma-vez' | 'acontecimento' | 'periodico';

const INTERVALO_PERIODICO_MS = 8000;
const OCIOSO_MS = 20_000;
/** E2: a animação só entra com lado na tela × densidade até 330 px (110 pt numa tela 3x); acima disso, borraria. */
export const TETO_ANIMADO_PX = 330;

/* Um Stu se mexendo por vez (E1): o do acontecimento mais recente ganha; os outros voltam à imagem parada. */
let ultimoId = 0;
let donoDaVez = 0;
const ouvintesDaVez = new Set<() => void>();
const pedirVez = (id: number) => { donoDaVez = id; ouvintesDaVez.forEach((ouvir) => ouvir()); };
const largarVez = (id: number) => { if (donoDaVez === id) { donoDaVez = 0; ouvintesDaVez.forEach((ouvir) => ouvir()); } };

/* E4: o laço pausa depois de 20 s sem toque nem rolagem. A tela avisa cada toque e cada rolagem por `acordarMascote`. */
const ouvintesDoToque = new Set<() => void>();
/** Um toque ou uma rolagem na tela: o laço que tinha parado por ociosidade volta a se mexer. */
export function acordarMascote() {
  ouvintesDoToque.forEach((ouvir) => ouvir());
}

/**
 * A fonte do WebP animado para o expo-image. No aparelho, o número do recurso basta: o React Native escolhe @2x ou @3x
 * para a tela. Na prévia web, tanto o expo-image quanto o expo-asset montam o endereço da versão 1x, que não existe para o
 * animado (só @2x e @3x, e a faixa G só @2x): lá o endereço aponta para o @2x, que toda faixa animada tem.
 */
function fonteDaAnimacao(modulo: number) {
  if (Platform.OS !== 'web') return modulo;
  return { uri: Asset.fromModule(modulo).uri.replace(/\.webp(?=$|\?)/, '@2x.webp') };
}

/** Lado do quadro na tela e a altura pela proporção do recorte (para nada pular ao carregar). */
export function medidasDoStu(nome: NomeStu, tamanho: number) {
  const [w, h] = CATALOGO_STU[nome].proporcao;
  return w >= h ? { largura: tamanho, altura: Math.round((tamanho * h) / w) } : { largura: Math.round((tamanho * w) / h), altura: tamanho };
}

/**
 * Sombra de contato (spec 13, A2), onde ele pisa no cenário chapado: sem desfoque nativo, duas elipses marinho sobrepostas
 * (14% e 7%, a segunda 20% maior), com 70% da largura e 10% da altura do mascote.
 */
function SombraDeContato({ largura, altura }: { largura: number; altura: number }) {
  const w = largura * 0.7;
  const h = Math.max(4, altura * 0.1);
  return (
    <>
      <View style={[estilos.sombra, { width: w * 1.2, height: h * 1.2, left: (largura - w * 1.2) / 2, top: altura - (h * 1.2) / 2, borderRadius: (w * 1.2) / 2,
        backgroundColor: 'rgba(11, 27, 92, 0.07)' }]} />
      <View style={[estilos.sombra, { width: w, height: h, left: (largura - w) / 2, top: altura - h / 2, borderRadius: w / 2, backgroundColor: 'rgba(11, 27, 92, 0.14)' }]} />
    </>
  );
}

/**
 * Halo (spec 13, A2) onde o Stu fica solto sobre branco (aula, vazio, erro): um radial lavanda #E9E7FF de 1,3× o mascote,
 * indo a transparente. No navegador, o background-image da web; no aparelho, o experimental_backgroundImage do React Native.
 */
function Halo({ largura, altura }: { largura: number; altura: number }) {
  const lado = Math.round(Math.max(largura, altura) * 1.3);
  const fundo = 'radial-gradient(circle, rgba(233, 231, 255, 1) 0%, rgba(233, 231, 255, 0.85) 38%, rgba(233, 231, 255, 0) 70%)';
  return (
    <View style={[estilos.halo, { width: lado, height: lado, left: (largura - lado) / 2, top: (altura - lado) / 2, borderRadius: lado / 2 },
      (Platform.OS === 'web' ? { backgroundImage: fundo } : { experimental_backgroundImage: fundo }) as ViewStyle]} />
  );
}

/**
 * O mascote oficial (spec 13) pela imagem e pelo tamanho (`tamanho`: o maior lado na tela, em dp). Escolhe a faixa (P, M,
 * G, XG) e deixa o React Native pegar o PNG @2x ou @3x; a largura e a altura fixas reservam o lugar. Sempre enfeite para o
 * leitor de tela (B8): a mensagem está no texto ao lado.
 *
 * `animado` (um modo da E1): a imagem parada aparece primeiro; quando a tela fica interativa (o primeiro momento
 * ocioso, `requestIdleCallback`; o `InteractionManager` saiu do React Native), o WebP animado é pedido por cima, pelo
 * expo-image, na caixa da animação (`animacao.caixa`, maior que o recorte quando ele pula para fora do quadro), ainda
 * invisível. A parada só sai quando a animada já desenhou na tela (`onDisplay`); se ela falhar ou não desenhar em 3 s, fica a
 * parada (correção do iPhone, 20/11: o `onLoad` chegava sem nada desenhado e o Stu sumia). No iPhone, o WebP passa pelo
 * libwebp (`useAppleWebpCodec={false}`): o codec da Apple não compõe os quadros parciais dos nossos WebP. Nunca com
 * movimento reduzido (o arquivo nem é pedido), acima do teto da E2, com o app em segundo plano, com o teclado aberto (um
 * campo de texto em foco), com `pausado` e, no laço, depois de 20 s sem toque nem rolagem. Um Stu se mexe por vez.
 */
export function Stu({ nome, tamanho, animado, acontecimento, ciclos = 1, sombra = false, halo = false, pausado = false, espelhado = false, silhueta, pop, popAoMontar, estilo }: {
  nome: NomeStu;
  /**
   * Entra ao montar com o pop da §B7 depois de tantos ms (a reação no painel de retorno entra aos 160 ms, spec 13); até lá,
   * fica invisível. Com movimento reduzido, aparece parado na hora.
   */
  popAoMontar?: number;
  /** Silhueta: a imagem parada pintada desta cor (tintColor), sem animação (o troféu do fim do mapa antes da conquista). */
  silhueta?: string;
  /** Cada valor novo (definido) dá o pop da §B7, como a troca de expressão (a entrada num passo da apresentação). */
  pop?: string | number;
  /** Halo lavanda atrás, onde ele fica solto sobre branco (aula, vazio, erro). */
  halo?: boolean;
  tamanho: number;
  animado?: ModoAnimacaoStu;
  /** No modo `acontecimento`: cada valor novo (definido) dispara os ciclos. */
  acontecimento?: string | number;
  /** Quantos ciclos por acontecimento (dois nas conclusões). */
  ciclos?: number;
  sombra?: boolean;
  /** A tela pede pausa (por exemplo, a entrada com um campo em foco). */
  pausado?: boolean;
  /** Olhando para o outro lado (o guia do mapa quando o caminho vira à esquerda). */
  espelhado?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const item = CATALOGO_STU[nome];
  const { largura, altura } = medidasDoStu(nome, tamanho);
  const parado = PARADO_STU[`${nome}-${faixaDoStu(nome, tamanho).toLowerCase()}`];
  const faixaAnimada = animado ? faixaAnimadaDoStu(nome, tamanho) : null;
  const fonteAnimada = faixaAnimada ? ANIMADO_STU[`${nome}-${faixaAnimada.toLowerCase()}`] : undefined;
  const temAnimacao = Boolean(animado && !silhueta && fonteAnimada && item.animacao && tamanho * PixelRatio.get() <= TETO_ANIMADO_PX);
  const duracao = (item.animacao?.duracaoMs ?? 0) * Math.max(1, ciclos);
  const reduzir = useMovimentoReduzido();

  const [id] = useState(() => { ultimoId += 1; return ultimoId; });
  const [interativa, setInterativa] = useState(false);
  const [emPrimeiroPlano, setEmPrimeiroPlano] = useState(AppState.currentState !== 'background');
  const [teclado, setTeclado] = useState(false);
  const [ocioso, setOcioso] = useState(false);
  const [quer, setQuer] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [comVez, setComVez] = useState(true);
  // A animada já desenhou na tela (onDisplay do expo-image): só então a parada sai.
  const [desenhada, setDesenhada] = useState(false);
  const [desistiu, setDesistiu] = useState(false);
  // §B7: a expressão nova entra em 120 ms de opacidade com um pop de 0,92 → 1,06 → 1 em 240 ms (com movimento reduzido, na hora).
  const [troca] = useState(() => new Animated.Value(popAoMontar !== undefined ? 0 : 1));
  // A expressão nova ou um `pop` novo: a mesma entrada.
  const chaveDoPop = `${nome}|${pop ?? ''}`;
  const popAnterior = useRef(chaveDoPop);
  useEffect(() => {
    if (popAnterior.current === chaveDoPop) return;
    popAnterior.current = chaveDoPop;
    if (reduzir !== false) { troca.setValue(1); return; }
    troca.setValue(0);
    const entrar = Animated.timing(troca, { toValue: 1, duration: 240, easing: Easing.bezier(0.2, 0.9, 0.3, 1.3), useNativeDriver: true });
    // O Stu nunca fica escondido: no fim do pop (ou se o fim não chegar), o valor volta a 1 inteiro.
    entrar.start(({ finished }) => { if (finished) troca.setValue(1); });
    const garantia = setTimeout(() => troca.setValue(1), GARANTIA_DO_POP_MS);
    return () => { entrar.stop(); clearTimeout(garantia); };
  }, [chaveDoPop, reduzir, troca]);
  // A entrada ao montar (popAoMontar): o mesmo pop, depois da espera.
  const comEntrada = popAoMontar !== undefined;
  useEffect(() => {
    if (!comEntrada) return;
    if (reduzir !== false) { troca.setValue(1); return; }
    const entrar = Animated.sequence([
      Animated.delay(popAoMontar ?? 0),
      Animated.timing(troca, { toValue: 1, duration: 240, easing: Easing.bezier(0.2, 0.9, 0.3, 1.3), useNativeDriver: true }),
    ]);
    entrar.start(({ finished }) => { if (finished) troca.setValue(1); });
    const garantia = setTimeout(() => troca.setValue(1), (popAoMontar ?? 0) + GARANTIA_DO_POP_MS);
    return () => { entrar.stop(); clearTimeout(garantia); };
    // Só ao montar (e de novo se o movimento reduzido mudar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comEntrada, reduzir, troca]);

  // Permissões da E4: a tela interativa, o app à vista, sem teclado aberto e, no laço, sem 20 s ociosos.
  useEffect(() => {
    if (!temAnimacao || reduzir !== false) return;
    // A tela interativa: o primeiro momento ocioso depois de montar (requestIdleCallback; sem ele, um instante depois).
    const ocioso1 = typeof requestIdleCallback === 'function' ? requestIdleCallback(() => setInterativa(true), { timeout: 1500 }) : null;
    const instante = ocioso1 === null ? setTimeout(() => setInterativa(true), 200) : null;
    const estado = AppState.addEventListener('change', (agora) => setEmPrimeiroPlano(agora === 'active'));
    const abriu = Keyboard.addListener('keyboardDidShow', () => setTeclado(true));
    const fechou = Keyboard.addListener('keyboardDidHide', () => setTeclado(false));
    let relogio: ReturnType<typeof setTimeout> | undefined;
    const acordar = () => {
      if (relogio) clearTimeout(relogio);
      setOcioso(false);
      if (animado === 'laco') relogio = setTimeout(() => setOcioso(true), OCIOSO_MS);
    };
    ouvintesDoToque.add(acordar);
    acordar();
    return () => {
      if (ocioso1 !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(ocioso1);
      if (instante !== null) clearTimeout(instante);
      estado.remove();
      abriu.remove();
      fechou.remove();
      if (relogio) clearTimeout(relogio);
      ouvintesDoToque.delete(acordar);
    };
  }, [temAnimacao, reduzir, animado]);

  // O que o modo quer: laço sempre; uma vez ao aparecer; de tempos em tempos; no acontecimento a cada valor novo.
  useEffect(() => {
    if (!temAnimacao || !animado) return;
    if (animado === 'laco') { setQuer(true); return; }
    if (animado === 'uma-vez') { setQuer(true); setRodada((n) => n + 1); return; }
    if (animado === 'periodico') {
      const relogio = setInterval(() => { setQuer(true); setRodada((n) => n + 1); }, INTERVALO_PERIODICO_MS);
      return () => clearInterval(relogio);
    }
  }, [temAnimacao, animado]);
  useEffect(() => {
    if (!temAnimacao || animado !== 'acontecimento' || acontecimento === undefined) return;
    setQuer(true);
    setRodada((n) => n + 1);
  }, [temAnimacao, animado, acontecimento]);

  // Um por vez: quem começa a se mexer pede a vez; ao parar, devolve.
  const permitido = interativa && reduzir === false && emPrimeiroPlano && !teclado && !pausado && !ocioso;
  const mover = temAnimacao && quer && permitido && !desistiu;
  useEffect(() => {
    if (!temAnimacao) return;
    const ouvir = () => setComVez(donoDaVez === 0 || donoDaVez === id);
    ouvintesDaVez.add(ouvir);
    return () => { ouvintesDaVez.delete(ouvir); largarVez(id); };
  }, [temAnimacao, id]);
  useEffect(() => {
    if (!mover) { largarVez(id); return; }
    pedirVez(id);
  }, [mover, id, rodada]);
  const mostrar = mover && comVez;

  // Cada rodada nova remonta a animada (key): até ela desenhar de novo, a parada volta.
  useEffect(() => { setDesenhada(false); }, [rodada]);
  // Um ciclo (ou `ciclos`) depois de desenhar, nos modos que não são laço; sem desenhar em 3 s, desiste e fica a parada.
  useEffect(() => {
    if (!mostrar) {
      setDesenhada(false);
      return;
    }
    if (desenhada) {
      if (animado === 'laco') return;
      const fim = setTimeout(() => setQuer(false), duracao);
      return () => clearTimeout(fim);
    }
    const espera = setTimeout(() => setDesistiu(true), ESPERA_DESENHO_MS);
    return () => clearTimeout(espera);
  }, [mostrar, desenhada, animado, duracao, rodada]);
  const camadas = camadasDoStu(mostrar, desenhada);

  const [esquerda, topo, larguraAnimada, alturaAnimada] = item.animacao?.caixa ?? [0, 0, 100, 100];
  const virar = espelhado ? [{ scaleX: -1 }] : [];
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[{ width: largura, height: altura }, estilo]}>
      {halo && <Halo largura={largura} altura={altura} />}
      {sombra && <SombraDeContato largura={largura} altura={altura} />}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: troca.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
        transform: [{ scale: troca.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.92, 1.06, 1] }) }] }]}>
      {/* As duas camadas com opacidade comum (sem valor animado nativo, que podia ficar preso em 0 no aparelho): a parada fica
          até a animada ter desenhado; a animada, pedida por cima, fica invisível até lá. */}
      <View testID="stu-parado" style={[StyleSheet.absoluteFill, { opacity: camadas.parada, transform: virar }]}>
        <Image source={parado} resizeMode="contain" accessible={false} style={[{ width: largura, height: altura }, silhueta ? { tintColor: silhueta } : null]} />
      </View>
      {mostrar && fonteAnimada && (
        <View testID="stu-animado" style={{ position: 'absolute', left: (largura * esquerda) / 100, top: (altura * topo) / 100,
          width: (largura * larguraAnimada) / 100, height: (altura * alturaAnimada) / 100, opacity: camadas.animada, transform: virar }}>
          <ImagemAnimada key={rodada} source={fonteDaAnimacao(fonteAnimada)} contentFit="contain" autoplay accessible={false} style={StyleSheet.absoluteFill}
            useAppleWebpCodec={false} onDisplay={() => setDesenhada(true)} onError={() => setDesistiu(true)} />
        </View>
      )}
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  sombra: { position: 'absolute' },
  halo: { position: 'absolute' },
});
