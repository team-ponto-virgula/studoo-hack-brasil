import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Image, Keyboard, PixelRatio, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image as ImagemAnimada } from 'expo-image';
import { CATALOGO_STU, faixaAnimadaDoStu, faixaDoStu, type NomeStu } from '@studoo/contratos';
import { useMovimentoReduzido } from './movimento';
import { ANIMADO_STU, PARADO_STU } from './stu-arquivos';

/**
 * Modos da animação (spec 13, emenda E1), os mesmos da web (`src/ui/mascote.tsx`): `laco` repete enquanto está na tela
 * (com as pausas da E4); `uma-vez` faz um ciclo quando aparece; `acontecimento` fica parado até `acontecimento` mudar e faz
 * `ciclos` ciclos; `periodico` faz um ciclo a cada 8 s. Sem modo, só a imagem parada.
 */
export type ModoAnimacaoStu = 'laco' | 'uma-vez' | 'acontecimento' | 'periodico';

const INTERVALO_PERIODICO_MS = 8000;
const OCIOSO_MS = 20_000;
const ESPERA_CARGA_MS = 3000;
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
 * O mascote oficial (spec 13) pela imagem e pelo tamanho (`tamanho`: o maior lado na tela, em dp). Escolhe a faixa (P, M,
 * G, XG) e deixa o React Native pegar o PNG @2x ou @3x; a largura e a altura fixas reservam o lugar. Sempre enfeite para o
 * leitor de tela (B8): a mensagem está no texto ao lado.
 *
 * `animado` (um modo da E1): a imagem parada aparece primeiro; quando a tela fica interativa (o primeiro momento
 * ocioso, `requestIdleCallback`; o `InteractionManager` saiu do React Native), o WebP animado entra por cima, pelo expo-image, na caixa da animação
 * (`animacao.caixa`, maior que o recorte quando ele pula para fora do quadro), com 120 ms de opacidade; a parada some
 * embaixo. Se não carregar em 3 s, fica a parada. Nunca com movimento reduzido (o arquivo nem é pedido), acima do teto da
 * E2, com o app em segundo plano, com o teclado aberto (um campo de texto em foco), com `pausado` e, no laço, depois de
 * 20 s sem toque nem rolagem. Um Stu se mexe por vez.
 */
export function Stu({ nome, tamanho, animado, acontecimento, ciclos = 1, sombra = false, pausado = false, espelhado = false, estilo }: {
  nome: NomeStu;
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
  const temAnimacao = Boolean(animado && fonteAnimada && item.animacao && tamanho * PixelRatio.get() <= TETO_ANIMADO_PX);
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
  const [carregado, setCarregado] = useState(false);
  const [desistiu, setDesistiu] = useState(false);
  const [entrada] = useState(() => new Animated.Value(0));

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

  // Um ciclo (ou `ciclos`) depois de carregar, nos modos que não são laço; a desistência se não carregar em 3 s.
  useEffect(() => {
    if (!mostrar) {
      setCarregado(false);
      entrada.setValue(0);
      return;
    }
    if (carregado) {
      const aparecer = Animated.timing(entrada, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true });
      aparecer.start();
      if (animado === 'laco') return () => aparecer.stop();
      const fim = setTimeout(() => setQuer(false), duracao);
      return () => { aparecer.stop(); clearTimeout(fim); };
    }
    const espera = setTimeout(() => setDesistiu(true), ESPERA_CARGA_MS);
    return () => clearTimeout(espera);
  }, [mostrar, carregado, animado, duracao, rodada, entrada]);

  const [esquerda, topo, larguraAnimada, alturaAnimada] = item.animacao?.caixa ?? [0, 0, 100, 100];
  const virar = espelhado ? [{ scaleX: -1 }] : [];
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[{ width: largura, height: altura }, estilo]}>
      {sombra && <SombraDeContato largura={largura} altura={altura} />}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: mostrar ? entrada.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) : 1, transform: virar }]}>
        <Image source={parado} resizeMode="contain" accessible={false} style={{ width: largura, height: altura }} />
      </Animated.View>
      {mostrar && fonteAnimada && (
        <Animated.View style={{ position: 'absolute', left: (largura * esquerda) / 100, top: (altura * topo) / 100,
          width: (largura * larguraAnimada) / 100, height: (altura * alturaAnimada) / 100, opacity: entrada, transform: virar }}>
          <ImagemAnimada key={rodada} source={fonteAnimada} contentFit="contain" autoplay accessible={false} style={StyleSheet.absoluteFill}
            onLoad={() => setCarregado(true)} onError={() => setDesistiu(true)} />
        </Animated.View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  sombra: { position: 'absolute' },
});
