import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LADO_ENVIO_FOTO, LIMITES_FOTO } from '@studoo/contratos';
import { Botao, BotaoIcone, useMovimentoReduzido } from './interface';
import { mensagens } from './mensagens';
import { codigoDoErro, socialEstilos, textoDoErro } from './social';
import { cores, fontes } from './tema';

/*
 * O recorte de imagem do Studoo no app, como `RecorteImagem` da web (src/app/perfil.tsx): a foto cobre sempre o quadro;
 * arrastar move, a pinça e o controle "Aproximar" aproximam. Vale para a capa da trilha (2:1) e para a foto do perfil
 * (1:1, com o círculo). No lugar do recorte do sistema (spec 07, P18): do sistema ficam só a galeria e a câmera.
 * "Usar esta foto" recorta com o expo-image-manipulator (JPEG de 256 a 1024 px de largura, até 2 MB) e envia.
 */

const p = mensagens.perfil;

/** Quanto a foto pode aproximar (o `ZOOM_MAX` da web). */
export const ZOOM_MAX = 4;
/** O maior lado da imagem de trabalho: fotos de câmera chegam com 12 MP ou mais, e o recorte não precisa de tudo isso. */
const LADO_DE_TRABALHO = 2048;

export type ImagemParaRecortar = { uri: string; largura: number; altura: number };

/** Bytes de um base64 (sem o preenchimento), para o teto de 2 MB do servidor. */
export function bytesDoBase64(base64: string) {
  return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
}

/**
 * O retângulo da imagem que o quadro mostra, em pixels da imagem, e a largura do arquivo que sai: a mesma conta do
 * "Usar esta foto" da web (a largura mostrada, entre 256 e 1024). O retângulo nunca passa das bordas da imagem.
 */
export function retanguloDoRecorte(imagem: { largura: number; altura: number }, quadro: { largura: number; proporcao: number },
  vista: { zoom: number; x: number; y: number }) {
  const altoQuadro = quadro.largura / quadro.proporcao;
  const escala = Math.max(quadro.largura / imagem.largura, altoQuadro / imagem.altura) * vista.zoom;
  const largura = Math.min(imagem.largura, quadro.largura / escala);
  const altura = Math.min(imagem.altura, largura / quadro.proporcao);
  const originX = Math.min(Math.max(0, -vista.x / escala), imagem.largura - largura);
  const originY = Math.min(Math.max(0, -vista.y / escala), imagem.altura - altura);
  return {
    originX: Math.round(originX), originY: Math.round(originY), width: Math.floor(largura), height: Math.floor(altura),
    saida: Math.max(256, Math.min(LADO_ENVIO_FOTO, Math.round(largura))),
  };
}

/** Mantém a foto cobrindo o quadro: a posição nunca deixa aparecer o fundo. */
export function limitarPosicao(x: number, y: number, tamanho: { largura: number; altura: number }, quadro: { largura: number; altura: number }) {
  return {
    x: Math.min(0, Math.max(quadro.largura - tamanho.largura, x)),
    y: Math.min(0, Math.max(quadro.altura - tamanho.altura, y)),
  };
}

/**
 * Abre a galeria ou a câmera do sistema (com a permissão da câmera), sem o recorte do sistema, e devolve a imagem de pé
 * e com no máximo 2048 px de lado, pronta para o recorte. `null`: a pessoa desistiu ou negou a permissão.
 * Lança erro quando a imagem não abre.
 */
export async function escolherImagem(camera: boolean): Promise<ImagemParaRecortar | null> {
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: false, quality: 1 };
  let resultado: ImagePicker.ImagePickerResult;
  if (camera) {
    const permissao = await ImagePicker.requestCameraPermissionsAsync();
    // Sem permissão, o próprio sistema já explicou; nada muda na tela (como o navegador na web).
    if (!permissao.granted) return null;
    resultado = await ImagePicker.launchCameraAsync(opcoes);
  } else {
    resultado = await ImagePicker.launchImageLibraryAsync(opcoes);
  }
  const escolhida = resultado.canceled ? undefined : resultado.assets[0];
  if (!escolhida) return null;
  // Uma passada pelo manipulador põe a imagem de pé (a rotação da câmera vem nos metadados) e diz o tamanho de verdade.
  let pronta = await ImageManipulator.manipulate(escolhida.uri).renderAsync();
  const maior = Math.max(pronta.width, pronta.height);
  if (maior > LADO_DE_TRABALHO) {
    const menor = pronta.width >= pronta.height ? { width: LADO_DE_TRABALHO } : { height: LADO_DE_TRABALHO };
    pronta = await ImageManipulator.manipulate(escolhida.uri).resize(menor).renderAsync();
  }
  const salva = await pronta.saveAsync({ compress: 0.92, format: SaveFormat.JPEG });
  if (!salva.width || !salva.height) throw new Error('imagem');
  return { uri: salva.uri, largura: salva.width, altura: salva.height };
}

/** Recorta e reduz a imagem; tenta as qualidades da web (0,9, 0,8 e 0,65) até caber em 2 MB. `null`: não coube. */
async function recortar(uri: string, recorte: ReturnType<typeof retanguloDoRecorte>): Promise<string | null> {
  const { saida, ...retangulo } = recorte;
  const imagem = await ImageManipulator.manipulate(uri).crop(retangulo).resize({ width: saida }).renderAsync();
  for (const qualidade of [0.9, 0.8, 0.65]) {
    const salva = await imagem.saveAsync({ compress: qualidade, format: SaveFormat.JPEG, base64: true });
    if (salva.base64 && bytesDoBase64(salva.base64) <= LIMITES_FOTO.bytes) return salva.base64;
  }
  return null;
}

/**
 * O controle "Aproximar", com a cara do Studoo (não é o controle do sistema): trilho de 8 arredondado, o trecho
 * preenchido em azul e a bolinha de 28 com borda branca, numa área de toque de 44. Tocar ou arrastar muda o valor;
 * o leitor de tela aumenta e diminui em passos de 10%.
 */
function ControleDeZoom({ zoom, aoMudar, desativado }: { zoom: number; aoMudar: (zoom: number) => void; desativado: boolean }) {
  const [largura, setLargura] = useState(0);
  const BOLINHA = 28;
  const fracao = (zoom - 1) / (ZOOM_MAX - 1);
  const paraZoom = (x: number) => 1 + Math.min(1, Math.max(0, (x - BOLINHA / 2) / Math.max(1, largura - BOLINHA))) * (ZOOM_MAX - 1);
  const gesto = usePanGesture({
    enabled: !desativado && largura > 0,
    runOnJS: true,
    disableReanimated: true,
    minDistance: 0,
    onBegin: (evento) => aoMudar(paraZoom(evento.x)),
    onUpdate: (evento) => aoMudar(paraZoom(evento.x)),
  });
  return (
    <View style={recorteEstilos.zoom}>
      <Text style={recorteEstilos.zoomRotulo} importantForAccessibility="no" accessibilityElementsHidden>{p.recorteZoom}</Text>
      <GestureDetector gesture={gesto}>
        <View testID="recorte-zoom" accessible accessibilityRole="adjustable" accessibilityLabel={p.recorteZoom}
          accessibilityValue={{ min: 100, max: ZOOM_MAX * 100, now: Math.round(zoom * 100) }} accessibilityState={{ disabled: desativado }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(evento) => aoMudar(zoom + (evento.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))}
          onLayout={(evento: LayoutChangeEvent) => setLargura(evento.nativeEvent.layout.width)}
          style={[recorteEstilos.zoomArea, desativado && { opacity: 0.5 }]}>
          <View style={recorteEstilos.zoomTrilho}>
            <View style={[recorteEstilos.zoomPreenchido, { width: `${fracao * 100}%` }]} />
          </View>
          <View style={[recorteEstilos.zoomBolinha, { left: fracao * Math.max(0, largura - BOLINHA) }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

export function RecorteImagem({ imagem, proporcao = 1, titulo = p.recorteTitulo, dica = p.recorteDicaToque, aviso = p.fotoAviso, comSelos = false,
  aoCancelar, enviar }: {
  imagem: ImagemParaRecortar;
  /** Largura ÷ altura do recorte: 1 (avatar, com o círculo) ou 2 (capa). */
  proporcao?: number;
  titulo?: string;
  dica?: string;
  aviso?: string;
  /** Na capa: a área dos selos por cima, tracejada, para a pessoa não deixar o principal da foto embaixo deles. */
  comSelos?: boolean;
  aoCancelar: () => void;
  /** Recebe o JPEG recortado, em base64; quem chama envia e fecha. Um erro lançado aqui aparece na folha. */
  enviar: (base64: string) => Promise<void>;
}) {
  const margens = useSafeAreaInsets();
  const reduzir = useMovimentoReduzido();
  const [subida] = useState(() => new Animated.Value(0));
  const [lado, setLado] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const aberta = useRef(true);
  useEffect(() => () => { aberta.current = false; }, []);
  useEffect(() => {
    const entrada = Animated.timing(subida, { toValue: 1, duration: reduzir !== false ? 120 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    entrada.start();
    return () => entrada.stop();
  }, [reduzir, subida]);

  const altoQuadro = lado / proporcao;
  const base = lado ? Math.max(lado / imagem.largura, altoQuadro / imagem.altura) : 1;
  const largura = imagem.largura * base * zoom;
  const altura = imagem.altura * base * zoom;
  // O que os gestos leem: o valor de agora, e não o da última vez que a tela foi desenhada.
  const vista = useRef({ zoom, pos, lado, altoQuadro, base });
  vista.current = { zoom, pos, lado, altoQuadro, base };

  // Ao medir o quadro (ou girar o aparelho), a foto fica no centro.
  useEffect(() => {
    if (!lado) return;
    const b = Math.max(lado / imagem.largura, lado / proporcao / imagem.altura);
    setPos({ x: (lado - imagem.largura * b * vista.current.zoom) / 2, y: (lado / proporcao - imagem.altura * b * vista.current.zoom) / 2 });
  }, [lado, proporcao, imagem.largura, imagem.altura]);

  /** Zoom em torno de um ponto do quadro (o centro, por padrão): o ponto debaixo dele fica parado. */
  function aplicarZoom(novo: number, cx?: number, cy?: number) {
    const agora = vista.current;
    if (!agora.lado) return;
    const z = Math.min(ZOOM_MAX, Math.max(1, novo));
    const fator = z / agora.zoom;
    const tamanho = { largura: imagem.largura * agora.base * z, altura: imagem.altura * agora.base * z };
    const px = cx ?? agora.lado / 2;
    const py = cy ?? agora.altoQuadro / 2;
    const novaPos = limitarPosicao(px - (px - agora.pos.x) * fator, py - (py - agora.pos.y) * fator, tamanho, { largura: agora.lado, altura: agora.altoQuadro });
    vista.current = { ...agora, zoom: z, pos: novaPos };
    setZoom(z);
    setPos(novaPos);
  }

  function mover(dx: number, dy: number) {
    const agora = vista.current;
    const tamanho = { largura: imagem.largura * agora.base * agora.zoom, altura: imagem.altura * agora.base * agora.zoom };
    const novaPos = limitarPosicao(agora.pos.x + dx, agora.pos.y + dy, tamanho, { largura: agora.lado, altura: agora.altoQuadro });
    vista.current = { ...agora, pos: novaPos };
    setPos(novaPos);
  }

  const zoomDaPinca = useRef(1);
  const arrasto = usePanGesture({
    enabled: lado > 0 && !enviando, runOnJS: true, disableReanimated: true, minDistance: 0,
    onUpdate: (evento) => mover(evento.changeX, evento.changeY),
  });
  const pinca = usePinchGesture({
    enabled: lado > 0 && !enviando, runOnJS: true, disableReanimated: true,
    onActivate: () => { zoomDaPinca.current = vista.current.zoom; },
    onUpdate: (evento) => aplicarZoom(zoomDaPinca.current * evento.scale, evento.focalX, evento.focalY),
  });
  const gestos = useSimultaneousGestures(arrasto, pinca);

  async function usar() {
    if (!lado || enviando) return;
    setEnviando(true);
    setErro(null);
    // Primeiro o recorte no aparelho (a imagem que não abre ou não cabe em 2 MB); depois o envio, com os erros do servidor.
    const base64 = await recortar(imagem.uri, retanguloDoRecorte(imagem, { largura: lado, proporcao }, { zoom, x: pos.x, y: pos.y })).catch(() => null);
    if (!aberta.current) return;
    if (!base64) {
      setErro(p.fotoIlegivel);
      setEnviando(false);
      return;
    }
    try {
      await enviar(base64);
    } catch (falha) {
      if (!aberta.current) return;
      const codigo = codigoDoErro(falha);
      // 422 (foto que o servidor recusa) e 429 (trocas demais) têm as mensagens da revisão de 19/11.
      setErro(codigo === 'foto_invalida' ? p.fotoFormato : codigo === 'limite_foto' ? p.fotoLimite : textoDoErro(codigo));
      setEnviando(false);
    }
  }

  const raio = lado / 2;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => { if (!enviando) aoCancelar(); }}>
      {/* Dentro de um Modal os gestos precisam da própria raiz (no Android, o Modal é outra janela). O véu não fecha o
          recorte: sair é pelo X ou por "Cancelar", para um toque fora não perder o ajuste. */}
      <GestureHandlerRootView style={recorteEstilos.fundo}>
        <Animated.View testID="recorte" accessibilityViewIsModal style={[recorteEstilos.folha, { paddingBottom: 20 + margens.bottom, opacity: subida,
          transform: [{ translateY: reduzir !== false ? 0 : subida.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] }]}>
          <View style={recorteEstilos.alca} />
          <View style={recorteEstilos.topo}>
            <Text accessibilityRole="header" style={recorteEstilos.titulo}>{titulo}</Text>
            <BotaoIcone icone="fechar" rotulo={p.recorteCancelar} testID="recorte-fechar" desativado={enviando} acao={aoCancelar} />
          </View>
          <Text style={recorteEstilos.dica}>{dica}</Text>

          <GestureDetector gesture={gestos}>
            <View testID="recorte-quadro" accessible accessibilityLabel={p.recorteArea} collapsable={false}
              style={[recorteEstilos.quadro, { aspectRatio: proporcao, maxWidth: proporcao === 1 ? 300 : 420 }]}
              onLayout={(evento: LayoutChangeEvent) => setLado(evento.nativeEvent.layout.width)}>
              {lado > 0 && (
                <Image source={{ uri: imagem.uri }} accessible={false} resizeMode="stretch"
                  style={{ position: 'absolute', left: pos.x, top: pos.y, width: largura, height: altura }} />
              )}
              {proporcao === 1 ? (
                // O círculo mostra como o avatar fica; o que sobra do quadrado fica escurecido.
                lado > 0 && (
                  <Svg width={lado} height={lado} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Path fillRule="evenodd" fill="rgba(16, 24, 51, 0.52)"
                      d={`M0 0H${lado}V${lado}H0Z M${raio} 0A${raio} ${raio} 0 1 0 ${raio} ${lado}A${raio} ${raio} 0 1 0 ${raio} 0Z`} />
                    <Circle cx={raio} cy={raio} r={raio - 1} fill="none" stroke="rgba(255, 255, 255, 0.9)" strokeWidth={2} />
                  </Svg>
                )
              ) : (
                <View style={recorteEstilos.moldura} pointerEvents="none">
                  {comSelos && (
                    <>
                      <View style={[recorteEstilos.selo, { top: 10, width: 96 }]} />
                      <View style={[recorteEstilos.selo, { top: 44, width: 88 }]} />
                    </>
                  )}
                </View>
              )}
            </View>
          </GestureDetector>

          <ControleDeZoom zoom={zoom} aoMudar={(novo) => aplicarZoom(novo)} desativado={lado === 0 || enviando} />
          <Text style={recorteEstilos.aviso}>{aviso}</Text>
          {erro && <Text accessibilityRole="alert" style={socialEstilos.erro}>{erro}</Text>}
          {/* A ação principal vem primeiro: no celular fica em cima, à vista. */}
          <View style={recorteEstilos.acoes}>
            <Botao rotulo={enviando ? p.fotoEnviando : p.recorteUsar} testID="recorte-usar" desativado={lado === 0 || enviando} ocupado={enviando} acao={() => void usar()} />
            <Botao rotulo={p.recorteCancelar} variante="secundario" testID="recorte-cancelar" desativado={enviando} acao={aoCancelar} />
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const recorteEstilos = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  // .folha--recorte: 12 entre os blocos; a folha sobe de baixo, com a alça e o raio de 24 (spec 11).
  folha: {
    width: '100%', maxWidth: 512, alignSelf: 'center', gap: 12, paddingTop: 10, paddingHorizontal: 16,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: cores.fundo,
  },
  alca: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: cores.bordaCampo },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  titulo: { flexShrink: 1, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 27.5, letterSpacing: -0.33 },
  // .folha-texto--miudo e .recorte__aviso: 14 px em cinza.
  dica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20.3 },
  aviso: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20.3 },
  // .recorte: fundo escuro e raio de 18; a moldura da capa, por dentro, tem raio de 14.
  quadro: { width: '100%', alignSelf: 'center', overflow: 'hidden', borderRadius: 18, backgroundColor: '#101833' },
  moldura: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.9)' },
  // A área dos selos (spec 10, revisão de 19/11): 28 de altura, brancos a 55%, tracejados, a 12 da borda da capa (10 mais
  // os 2 da moldura) e com 6 entre eles.
  selo: {
    position: 'absolute', left: 10, height: 28, borderRadius: 99, backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(11, 27, 92, 0.45)',
  },
  // .recorte__zoom: o rótulo de 14 em 800 e, a 2, o controle de 44 de altura.
  zoom: { gap: 2 },
  zoomRotulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
  zoomArea: { height: 44, justifyContent: 'center' },
  zoomTrilho: { height: 8, borderRadius: 999, backgroundColor: cores.gelo, overflow: 'hidden' },
  zoomPreenchido: { height: 8, backgroundColor: cores.acao },
  zoomBolinha: {
    position: 'absolute', top: 8, width: 28, height: 28, borderRadius: 14, borderWidth: 3, borderColor: cores.fundo, backgroundColor: cores.acao,
    shadowColor: '#0B1B5C', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  // .recorte__acoes no celular: uma por linha, com 10 entre elas.
  acoes: { gap: 10, marginTop: 4 },
});
