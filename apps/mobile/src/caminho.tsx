import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone } from './icone';
import { Botao, estilos, useMovimentoReduzido } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import { explicar, iconeDoNo, nomeDoNo, type EstadoNo, type NoCaminho } from './trilha';

/*
 * Caminho da trilha no app: a mesma lógica da web (src/ui/caminho.tsx), com componentes nativos.
 * Um só caminho contínuo, nós que alternam de lado, um marco discreto entre trechos,
 * o Stu no começo e a chegada no fim. No toque, a explicação do nó abre numa folha que sobe do rodapé.
 */

type Lado = 'esquerda' | 'direita';
type Medidas = { lente: number; linhas: number; etiqueta: number; marco: number };
type Ponto = { x: number; y: number };

/** Mesmas medidas da web: celular, tablet e telas a partir de 1024 px (DESIGN §11). */
function useMedidas(): Medidas {
  const { width } = useWindowDimensions();
  if (width >= 1024) return { lente: 76, linhas: 56, etiqueta: 56, marco: 56 };
  if (width >= 768) return { lente: 72, linhas: 52, etiqueta: 56, marco: 48 };
  return { lente: 64, linhas: 48, etiqueta: 56, marco: 48 };
}

/** Cores da lente por estado. A lente é plana: sem relevo nem sombra, porque só o que flutua tem sombra (DESIGN §4). */
const coresDaLente: Record<EstadoNo, { fundo: string; borda: string; icone: string }> = {
  concluida: { fundo: cores.sucesso, borda: cores.sucesso, icone: cores.fundo },
  atual: { fundo: cores.acao, borda: cores.acao, icone: cores.fundo },
  bloqueada: { fundo: cores.nevoa, borda: cores.gelo, icone: cores.textoSecundario },
  previa: { fundo: cores.fundo, borda: cores.gelo, icone: cores.acao },
};

const corDoEstado: Record<EstadoNo, string> = {
  concluida: cores.sucesso,
  atual: cores.acao,
  bloqueada: cores.textoSecundario,
  previa: cores.textoSecundario,
};

/**
 * Caminho único e contínuo de lições, na ordem de aprendizado.
 * Não agrupa por assunto: entre um trecho e outro aparece só um marco, sem nome.
 * O leitor de tela ouve o marco como "Marco 1", "Marco 2"…, logo depois do último nó do trecho.
 * O nó atual abre a lição; concluído ou bloqueado abre a folha que explica o estado.
 * Com `rolarPara`, avisa por `aoRolar` o topo e a base da lente desse nó na rolagem da tela (o caminho deve ser filho direto dela).
 */
export function Caminho({ nos, stu, chegada = true, ocupado = false, abrindo = null, liberadas = [], rolarPara = null, aoRolar, aoAbrir }: {
  nos: readonly NoCaminho[];
  stu?: string;
  chegada?: boolean;
  ocupado?: boolean;
  abrindo?: string | null;
  liberadas?: readonly string[];
  rolarPara?: string | null;
  aoRolar?: (topo: number, base: number) => void;
  aoAbrir?: (no: NoCaminho) => void;
}) {
  const medidas = useMedidas();
  const reduzir = useMovimentoReduzido();
  const [aberto, setAberto] = useState<string | null>(null);
  const alvos = useRef(new Map<string, ComponentRef<typeof View>>());
  const posicoes = useRef<{ caminho: number | null; lista: number | null; linhas: Map<string, number> }>(
    { caminho: null, lista: null, linhas: new Map() });
  const rolado = useRef<string | null>(null);
  const total = nos.length;
  const comChegada = chegada && total > 0;
  const trechos = Array.from(new Set(nos.map((no) => no.trecho)));
  const tudoFeito = total > 0 && nos.every((no) => no.estado === 'concluida');
  const indiceAberto = aberto ? nos.findIndex((no) => no.id === aberto) : -1;
  const tituloLiberada = nos.find((no) => no.id === liberadas[0])?.titulo ?? null;

  useEffect(() => {
    if (!tituloLiberada) return;
    const espera = setTimeout(() => AccessibilityInfo.announceForAccessibility(mensagens.trilha.liberada(tituloLiberada)), 900);
    return () => clearTimeout(espera);
  }, [tituloLiberada]);

  useEffect(() => {
    if (ocupado) setAberto(null);
  }, [ocupado]);

  function tentarRolar() {
    if (!rolarPara || !aoRolar || rolado.current === rolarPara) return;
    const { caminho, lista, linhas } = posicoes.current;
    const linha = linhas.get(rolarPara);
    if (caminho === null || lista === null || linha === undefined) return;
    rolado.current = rolarPara;
    const topo = caminho + lista + linha;
    aoRolar(topo, topo + medidas.lente);
  }

  function tocar(no: NoCaminho) {
    if (no.estado === 'atual') {
      setAberto(null);
      aoAbrir?.(no);
      return;
    }
    setAberto(no.id);
  }

  function fechar(devolverFoco = true) {
    const id = aberto;
    setAberto(null);
    if (!devolverFoco || !id) return;
    setTimeout(() => {
      const alvo = alvos.current.get(id);
      if (alvo) AccessibilityInfo.sendAccessibilityEvent(alvo, 'focus');
    }, 150);
  }

  function guardarAlvo(id: string, alvo: ComponentRef<typeof View> | null) {
    if (alvo) alvos.current.set(id, alvo);
    else alvos.current.delete(id);
  }

  return (
    <View style={caminhoEstilos.caminho} onLayout={(evento) => {
      posicoes.current.caminho = evento.nativeEvent.layout.y;
      tentarRolar();
    }}>
      {stu && (
        <View style={caminhoEstilos.stu}>
          <Text style={caminhoEstilos.stuTexto}>{stu}</Text>
          <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            importantForAccessibility="no" style={{ width: medidas.lente, height: Math.round(medidas.lente * 1.1) }} />
        </View>
      )}
      <View accessibilityRole="list" accessibilityLabel={mensagens.trilha.licoes}
        style={{ paddingTop: nos[0]?.estado === 'atual' ? medidas.etiqueta + 8 : 32 }}
        onLayout={(evento) => {
          posicoes.current.lista = evento.nativeEvent.layout.y;
          tentarRolar();
        }}>
        {nos.map((no, indice) => {
          const seguinte = nos[indice + 1];
          const fimDoTrecho = seguinte !== undefined && seguinte.trecho !== no.trecho;
          const vaiAteChegada = seguinte === undefined && comChegada;
          const lado: Lado = indice % 2 === 0 ? 'esquerda' : 'direita';
          let depois = 0;
          if (seguinte?.estado === 'atual') depois += medidas.etiqueta;
          if (fimDoTrecho) depois += medidas.marco;
          const espaco = seguinte || vaiAteChegada ? medidas.linhas + depois : 0;

          // O espaço até o próximo nó fica dentro da linha (padding), para o marco anunciado caber nos limites dela.
          return (
            <View key={no.id} style={{ paddingBottom: espaco }} onLayout={(evento) => {
              posicoes.current.linhas.set(no.id, evento.nativeEvent.layout.y);
              tentarRolar();
            }}>
              {espaco > 0 && <Ligacao lado={lado} ateChegada={vaiAteChegada} feita={no.estado === 'concluida'} topo={medidas.lente} />}
              <No no={no} indice={indice} total={total} lado={lado} medidas={medidas} reduzir={reduzir}
                ocupado={ocupado} abrindo={abrindo === no.id} liberada={liberadas.includes(no.id)}
                guardar={(alvo) => guardarAlvo(no.id, alvo)} tocar={() => tocar(no)} />
              {fimDoTrecho && <Marco numero={trechos.indexOf(no.trecho) + 1} topo={medidas.lente} />}
            </View>
          );
        })}
      </View>
      {comChegada && (
        <View style={caminhoEstilos.chegada}>
          <View style={[caminhoEstilos.chegadaLente, circulo(medidas.lente), tudoFeito && caminhoEstilos.chegadaFeita]}>
            <Icone nome="trofeu" tamanho={Math.round(medidas.lente * 0.44)} cor={tudoFeito ? cores.fundo : cores.textoSecundario} />
          </View>
          <Text style={[caminhoEstilos.chegadaTexto, tudoFeito && { color: cores.sucesso }]}>
            {tudoFeito ? mensagens.trilha.chegadaFeita : mensagens.trilha.chegada}
          </Text>
        </View>
      )}
      {indiceAberto >= 0 && (
        <Folha titulo={nos[indiceAberto].titulo} texto={explicar(nos, indiceAberto)} reduzir={reduzir}
          refazer={nos[indiceAberto].estado === 'concluida' && aoAbrir ? () => {
            const no = nos[indiceAberto];
            fechar(false);
            aoAbrir(no);
          } : undefined}
          fechar={() => fechar()} />
      )}
    </View>
  );
}

function circulo(tamanho: number) {
  return { width: tamanho, height: tamanho, borderRadius: tamanho / 2 };
}

function No({ no, indice, total, lado, medidas, reduzir, ocupado, abrindo, liberada, guardar, tocar }: {
  no: NoCaminho;
  indice: number;
  total: number;
  lado: Lado;
  medidas: Medidas;
  reduzir: boolean | null;
  ocupado: boolean;
  abrindo: boolean;
  liberada: boolean;
  guardar: (alvo: ComponentRef<typeof View> | null) => void;
  tocar: () => void;
}) {
  const [focado, setFocado] = useState(false);
  const nome = nomeDoNo(no, indice, total);
  let linha: string = no.estado === 'previa' ? mensagens.trilha.posicao(indice + 1, total) : mensagens.trilha.estados[no.estado];
  if (abrindo) linha = mensagens.trilha.abrindo;
  const direita = lado === 'direita';

  const conteudo = (pressionado: boolean) => (
    <>
      <View style={caminhoEstilos.margem} />
      <View style={direita ? { marginRight: -medidas.lente / 2 } : { marginLeft: -medidas.lente / 2 }}>
        <Lente no={no} medidas={medidas} reduzir={reduzir} liberada={liberada} pressionado={pressionado} focado={focado} />
      </View>
      <View style={[caminhoEstilos.texto, { minHeight: medidas.lente }]}>
        <Text style={[caminhoEstilos.titulo, no.estado === 'bloqueada' && caminhoEstilos.tituloBloqueado,
          direita && caminhoEstilos.alinharFim, focado && caminhoEstilos.tituloFocado]}>{no.titulo}</Text>
        <Text style={[caminhoEstilos.estado, { color: corDoEstado[no.estado] }, direita && caminhoEstilos.alinharFim]}>{linha}</Text>
      </View>
    </>
  );

  if (no.estado === 'previa') {
    return (
      <View accessible accessibilityLabel={nome} style={[caminhoEstilos.alvo, direita && caminhoEstilos.alvoDireita]}>
        {conteudo(false)}
      </View>
    );
  }

  return (
    <Pressable ref={guardar} accessibilityRole="button" accessibilityLabel={nome}
      accessibilityState={{ disabled: ocupado, busy: abrindo }} disabled={ocupado} onPress={tocar}
      onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
      style={[caminhoEstilos.alvo, direita && caminhoEstilos.alvoDireita]}>
      {({ pressed }) => conteudo(pressed)}
    </Pressable>
  );
}

/**
 * Lente do nó. A atual ganha o halo e a etiqueta "Começar", que entram uma vez.
 * A recém-liberada mostra o cadeado se abrindo. Com movimento reduzido, tudo já aparece no estado final.
 * No toque, usa a mesma opacidade de pressionado do botão, como a web.
 */
function Lente({ no, medidas, reduzir, liberada, pressionado, focado }: {
  no: NoCaminho;
  medidas: Medidas;
  reduzir: boolean | null;
  liberada: boolean;
  pressionado: boolean;
  focado: boolean;
}) {
  const { lente } = medidas;
  const atual = no.estado === 'atual';
  const visual = coresDaLente[no.estado];
  const halo = useRef(new Animated.Value(0)).current;
  const etiqueta = useRef(new Animated.Value(0)).current;
  const cadeado = useRef(new Animated.Value(1)).current;
  const escala = useRef(new Animated.Value(liberada ? 0.84 : 1)).current;

  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir) {
      halo.setValue(1);
      etiqueta.setValue(1);
      cadeado.setValue(0);
      escala.setValue(1);
      return;
    }
    const saida = Easing.out(Easing.ease);
    const animacoes: Animated.CompositeAnimation[] = [];
    if (atual) {
      animacoes.push(Animated.timing(halo, { toValue: 1, duration: 240, delay: liberada ? 560 : 0, easing: saida, useNativeDriver: true }));
      animacoes.push(Animated.timing(etiqueta, { toValue: 1, duration: 200, delay: liberada ? 640 : 120, easing: saida, useNativeDriver: true }));
    }
    if (liberada) {
      animacoes.push(Animated.timing(cadeado, { toValue: 0, duration: 200, delay: 160, easing: saida, useNativeDriver: true }));
      animacoes.push(Animated.sequence([
        Animated.delay(340),
        Animated.timing(escala, { toValue: 1.08, duration: 144, easing: saida, useNativeDriver: true }),
        Animated.timing(escala, { toValue: 1, duration: 96, easing: saida, useNativeDriver: true }),
      ]));
    }
    const grupo = Animated.parallel(animacoes);
    grupo.start();
    return () => grupo.stop();
  }, [reduzir, atual, liberada, halo, etiqueta, cadeado, escala]);

  const tamanhoIcone = Math.round(lente * 0.44);
  const anel = atual ? 17 : 7;

  return (
    <View style={[{ width: lente, height: lente }, pressionado && estilos.botaoPressionado]}>
      {atual && (
        <Animated.View style={[caminhoEstilos.halo, circulo(lente + 24), {
          opacity: halo, transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
        }]} />
      )}
      <Animated.View style={[caminhoEstilos.camada, caminhoEstilos.face, circulo(lente), {
        backgroundColor: visual.fundo, borderColor: visual.borda, transform: [{ scale: escala }],
      }]}>
        <Icone nome={iconeDoNo(no)} tamanho={tamanhoIcone} cor={visual.icone} />
        {liberada && (
          <Animated.View style={[caminhoEstilos.cadeado, { borderRadius: lente / 2, opacity: cadeado }]}>
            <Icone nome="cadeado" tamanho={tamanhoIcone} cor={cores.textoSecundario} />
          </Animated.View>
        )}
      </Animated.View>
      {focado && <View style={[caminhoEstilos.anelFoco, circulo(lente + anel * 2), { left: -anel, top: -anel }]} />}
      {atual && (
        <Animated.View style={[caminhoEstilos.etiquetaCaixa, { bottom: lente + 20 }, {
          opacity: etiqueta, transform: [{ translateY: etiqueta.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        }]}>
          <View style={caminhoEstilos.etiqueta}>
            <View style={caminhoEstilos.etiquetaSeta} />
            <Text style={caminhoEstilos.etiquetaTexto}>{mensagens.trilha.comecar}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/** Ponto de uma curva de Bézier cúbica numa coordenada. */
function bezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/** A mesma curva da web: de um lado ao outro, ou do último nó até a chegada, no centro. */
function tracado(largura: number, altura: number, de: number, ate: number, passos: number): Ponto[] {
  const x0 = de * largura;
  const x3 = ate * largura;
  return Array.from({ length: passos + 1 }, (_, passo) => {
    const t = passo / passos;
    return { x: bezier(t, x0, x0, x3, x3), y: bezier(t, 0, altura / 2, altura / 2, altura) };
  });
}

/** Pontos a cada `intervalo` pixels ao longo do traçado, como o pontilhado da web. */
function pontilhar(amostras: Ponto[], intervalo: number) {
  const pontos: Ponto[] = [];
  let percorrido = 0;
  let proximo = intervalo / 2;
  for (let indice = 1; indice < amostras.length; indice += 1) {
    const de = amostras[indice - 1];
    const ate = amostras[indice];
    const trecho = Math.hypot(ate.x - de.x, ate.y - de.y);
    while (trecho > 0 && percorrido + trecho >= proximo) {
      const fracao = (proximo - percorrido) / trecho;
      pontos.push({ x: de.x + (ate.x - de.x) * fracao, y: de.y + (ate.y - de.y) * fracao });
      proximo += intervalo;
    }
    percorrido += trecho;
  }
  return pontos;
}

/** Ligação até o próximo nó: pontilhada adiante, contínua depois de concluída. Vai do pé da lente até o fim da linha. */
function Ligacao({ lado, ateChegada, feita, topo }: {
  lado: Lado;
  ateChegada: boolean;
  feita: boolean;
  topo: number;
}) {
  const [caixa, setCaixa] = useState<{ largura: number; altura: number } | null>(null);
  const de = lado === 'esquerda' ? 0.25 : 0.75;
  const ate = ateChegada ? 0.5 : 1 - de;
  const desenho = useMemo(() => {
    if (!caixa) return [];
    if (!feita) return pontilhar(tracado(caixa.largura, caixa.altura, de, ate, 48), 12).map((ponto) => ({
      left: ponto.x - 2, top: ponto.y - 2, width: 4, height: 4, borderRadius: 2, backgroundColor: cores.gelo,
    }));
    const pontos = tracado(caixa.largura, caixa.altura, de, ate, 12);
    return pontos.slice(1).map((ate, indice) => {
      const de = pontos[indice];
      const comprimento = Math.hypot(ate.x - de.x, ate.y - de.y) + 4;
      return {
        left: (de.x + ate.x) / 2 - comprimento / 2, top: (de.y + ate.y) / 2 - 2, width: comprimento, height: 4, borderRadius: 2,
        backgroundColor: cores.sucesso, transform: [{ rotate: `${Math.atan2(ate.y - de.y, ate.x - de.x)}rad` }],
      };
    });
  }, [caixa, feita, de, ate]);

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[caminhoEstilos.ligacao, { top: topo }]}
      onLayout={(evento) => {
        const { width, height } = evento.nativeEvent.layout;
        setCaixa((anterior) => anterior?.largura === width && anterior.altura === height ? anterior : { largura: width, altura: height });
      }}>
      {desenho.map((estilo, indice) => <View key={indice} style={[caminhoEstilos.camada, estilo]} />)}
    </View>
  );
}

/**
 * Marco entre um trecho e outro: a bandeira no meio da ligação, sem nome de assunto.
 * Vem depois do nó na árvore, então o leitor de tela lê "Marco 1", "Marco 2"… logo depois do último nó do trecho.
 */
function Marco({ numero, topo }: { numero: number; topo: number }) {
  return (
    <View pointerEvents="box-none" style={[caminhoEstilos.ligacao, { top: topo }]}>
      <View accessible accessibilityRole="text" accessibilityLabel={mensagens.trilha.marco(numero)} style={caminhoEstilos.marco}>
        <Icone nome="bandeira" tamanho={16} cor={cores.textoSecundario} />
      </View>
    </View>
  );
}

/** Explicação do nó concluído ou bloqueado, numa folha que sobe do rodapé, com área segura. */
function Folha({ titulo, texto, reduzir, refazer, fechar }: {
  titulo: string;
  texto: string;
  reduzir: boolean | null;
  refazer?: () => void;
  fechar: () => void;
}) {
  const margens = useSafeAreaInsets();
  const cabecalho = useRef<ComponentRef<typeof Text>>(null);
  const [focado, setFocado] = useState(false);

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType={reduzir === false ? 'fade' : 'none'}
      onRequestClose={fechar} onShow={() => {
        if (cabecalho.current) AccessibilityInfo.sendAccessibilityEvent(cabecalho.current, 'focus');
      }}>
      <View style={caminhoEstilos.fundoFolha}>
        <Pressable accessible={false} importantForAccessibility="no" onPress={fechar} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[caminhoEstilos.folha, { paddingBottom: 20 + margens.bottom }]}>
          <View style={caminhoEstilos.folhaTopo}>
            <Text ref={cabecalho} accessible accessibilityRole="header" style={[estilos.tituloBloco, caminhoEstilos.folhaTitulo]}>{titulo}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={mensagens.trilha.fechar} onPress={fechar}
              onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
              style={({ pressed }) => [caminhoEstilos.fechar, pressed && caminhoEstilos.fecharPressionado, focado && estilos.foco]}>
              <Icone nome="fechar" tamanho={20} cor={cores.textoSecundario} />
            </Pressable>
          </View>
          <Text style={estilos.textoSecundario}>{texto}</Text>
          {refazer && <View style={caminhoEstilos.folhaAcao}><Botao rotulo={mensagens.trilha.refazer} variante="secundario" acao={refazer} /></View>}
        </View>
      </View>
    </Modal>
  );
}

/** Carregando a trilha: esqueleto com a forma do caminho. */
export function SkeletonTrilha() {
  const { lente, linhas } = useMedidas();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={mensagens.trilha.carregando} accessibilityLiveRegion="polite"
      style={caminhoEstilos.skeleton}>
      <View style={caminhoEstilos.skeletonCabecalho}>
        <View style={[caminhoEstilos.skeletonLinha, { width: '72%', height: 32 }]} />
        <View style={caminhoEstilos.skeletonLinha} />
        <View style={[caminhoEstilos.skeletonLinha, { width: '48%', height: 8, marginTop: 12 }]} />
      </View>
      <View style={{ gap: linhas - 8, paddingTop: 8 }}>
        {(['esquerda', 'direita', 'esquerda', 'direita'] as const).map((lado, indice) => (
          <View key={indice} style={[circulo(lente), caminhoEstilos.skeletonNo,
            { marginLeft: lado === 'esquerda' ? '25%' : '75%', transform: [{ translateX: -lente / 2 }] }]} />
        ))}
      </View>
    </View>
  );
}

const caminhoEstilos = StyleSheet.create({
  caminho: { marginTop: 8 },
  stu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 16 },
  stuTexto: { flexShrink: 1, maxWidth: 320, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700',
    fontSize: 15, lineHeight: 21, textAlign: 'right' },
  alvo: { flexDirection: 'row', alignItems: 'flex-start', minWidth: 0 },
  alvoDireita: { flexDirection: 'row-reverse' },
  margem: { width: '25%' },
  texto: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 2, paddingHorizontal: 16 },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 21 },
  tituloBloqueado: { color: cores.textoSecundario },
  tituloFocado: { textDecorationLine: 'underline' },
  estado: { fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  alinharFim: { textAlign: 'right' },
  camada: { position: 'absolute', left: 0, top: 0 },
  face: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  halo: { position: 'absolute', left: -12, top: -12, borderWidth: 6, borderColor: cores.gelo },
  cadeado: { position: 'absolute', left: -3, top: -3, right: -3, bottom: -3, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: cores.gelo, backgroundColor: cores.nevoa },
  anelFoco: { position: 'absolute', borderWidth: 3, borderColor: cores.acao },
  etiquetaCaixa: { position: 'absolute', left: -48, right: -48, alignItems: 'center' },
  etiqueta: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: cores.texto },
  etiquetaSeta: { position: 'absolute', bottom: -5, left: '50%', marginLeft: -6, width: 12, height: 12, borderRadius: 2,
    backgroundColor: cores.texto, transform: [{ rotate: '45deg' }] },
  etiquetaTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 18 },
  ligacao: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  marco: { position: 'absolute', left: '50%', top: '50%', marginLeft: -16, marginTop: -16, width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  chegada: { alignItems: 'center', gap: 8, paddingBottom: 8 },
  chegadaLente: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: cores.gelo, backgroundColor: cores.nevoa },
  chegadaFeita: { borderColor: cores.sucesso, backgroundColor: cores.sucesso },
  chegadaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  fundoFolha: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(27, 42, 94, 0.32)' },
  folha: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 12, paddingTop: 12, paddingLeft: 20, paddingRight: 12,
    borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: cores.fundo },
  folhaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  folhaTitulo: { flex: 1, paddingTop: 9 },
  folhaAcao: { paddingRight: 8, paddingTop: 4 },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  fecharPressionado: { backgroundColor: cores.nevoa },
  skeleton: { marginTop: 24, gap: 32 },
  skeletonCabecalho: { gap: 12, padding: 24, borderRadius: 20, backgroundColor: cores.nevoa },
  skeletonLinha: { height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonNo: { backgroundColor: cores.gelo },
});
