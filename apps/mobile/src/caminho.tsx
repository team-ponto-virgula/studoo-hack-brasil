import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icone } from './icone';
import { Botao, estilos, useBalanco, useMovimentoReduzido } from './interface';
import { mensagens } from './mensagens';
import { enfeitesDaLinha } from './mundo-desenhos';
import { Desenho, Fronteira, Onda, coresDaRegiao } from './mundo';
import { cores, fontes } from './tema';
import { explicar, iconeDoNo, nomeDoNo, posicaoDoNo, type EstadoNo, type NoCaminho } from './trilha';

/*
 * Caminho da trilha no app: a mesma lógica e o mesmo mundo da web (src/ui/caminho.tsx), com componentes nativos.
 * Um só caminho contínuo sobre um mapa ilustrado: cada trecho é uma região (campos, floresta, montanhas…), os nós têm
 * relevo e alternam de lado, a estrada liga um nó ao outro e o marco fica na fronteira entre regiões. O Stu abre o mapa e
 * o troféu fecha o caminho no topo. No toque, a explicação do nó abre numa folha que sobe do rodapé.
 */

type Lado = 'esquerda' | 'direita';
type Medidas = { lente: number; linhas: number; etiqueta: number; marco: number; enfeite: number; miudo: number };
type Ponto = { x: number; y: number };
type Caixa = { y: number; altura: number };
/** Topo e base de um trecho do caminho na rolagem da tela. */
export type Faixa = { topo: number; base: number };

const corEstrada = 'rgba(255, 255, 255, 0.66)';
const corPontilhado = 'rgba(27, 42, 94, 0.24)';

/** Mesmas medidas da web: celular, tablet e telas a partir de 1024 px. */
function useMedidas(): Medidas {
  const { width } = useWindowDimensions();
  if (width >= 1024) return { lente: 76, linhas: 60, etiqueta: 56, marco: 84, enfeite: 60, miudo: 28 };
  if (width >= 768) return { lente: 72, linhas: 56, etiqueta: 56, marco: 76, enfeite: 54, miudo: 28 };
  return { lente: 64, linhas: 52, etiqueta: 56, marco: 76, enfeite: 44, miudo: 24 };
}

/** Cores da lente por estado: a face, o lábio embaixo (o relevo) e o ícone. */
const coresDaLente: Record<EstadoNo, { face: string; labio: string; icone: string }> = {
  concluida: { face: cores.sucessoClaro, labio: cores.sucesso, icone: cores.fundo },
  atual: { face: cores.acao, labio: cores.acaoEscura, icone: cores.fundo },
  bloqueada: { face: cores.faceNeutra, labio: cores.labioNeutro, icone: cores.tintaNeutra },
  previa: { face: cores.fundo, labio: '#CDD6F2', icone: cores.acao },
};

const corDoEstado: Record<EstadoNo, string> = {
  concluida: cores.sucesso,
  atual: cores.acao,
  bloqueada: cores.textoSecundario,
  previa: cores.textoSecundario,
};

/** Um trecho está vencido quando todas as suas lições estão concluídas: o marco que o fecha fica dourado. */
function trechoVencido(nos: readonly NoCaminho[], trecho: number) {
  return nos.every((no) => no.trecho !== trecho || no.estado === 'concluida');
}

/**
 * Caminho único e contínuo de lições, na ordem de aprendizado, sobre o mundo ilustrado.
 * Não agrupa por assunto: entre um trecho e outro aparece só o marco, sem nome, sobre a fronteira das regiões.
 * O leitor de tela ouve o marco como "Marco 1", "Marco 2"…, logo depois do último nó do trecho; o cenário fica de fora.
 * O nó atual abre a lição; concluído ou bloqueado abre a folha que explica o estado.
 * Com `rolarPara`, avisa por `aoRolar` o topo e a base da lente desse nó na rolagem da tela (o caminho deve ser filho direto dela).
 * Com `montando`, a trilha ainda está sendo gerada: cada nó novo entra com um movimento curto e o cenário brota junto,
 * a posição não tem total e um nó em esqueleto marca onde a próxima lição vai aparecer. A cada nó, e quando a chegada
 * entra no fim, `acompanhar` recebe o último nó e o ponto que deve ficar à vista, para a tela rolar só se a pessoa estava
 * olhando o fim do caminho, como na web.
 */
export function Caminho({ nos, stu, chegada = true, montando = false, ocupado = false, abrindo = null, liberadas = [], rolarPara = null,
  aoRolar, acompanhar, aoAbrir }: {
  nos: readonly NoCaminho[];
  stu?: string;
  chegada?: boolean;
  montando?: boolean;
  ocupado?: boolean;
  abrindo?: string | null;
  liberadas?: readonly string[];
  rolarPara?: string | null;
  aoRolar?: (topo: number, base: number) => void;
  acompanhar?: (ultimo: Faixa, alvo: Faixa) => void;
  aoAbrir?: (no: NoCaminho) => void;
}) {
  const medidas = useMedidas();
  const reduzir = useMovimentoReduzido();
  const { width } = useWindowDimensions();
  const largo = width >= 768;
  const [aberto, setAberto] = useState<string | null>(null);
  const alvos = useRef(new Map<string, ComponentRef<typeof View>>());
  const posicoes = useRef<{ caminho: number | null; lista: number | null; linhas: Map<string, Caixa>; vindo: Caixa | null; chegada: Caixa | null }>(
    { caminho: null, lista: null, linhas: new Map(), vindo: null, chegada: null });
  const rolado = useRef<string | null>(null);
  const acompanhando = useRef<'novo' | 'fim' | null>(null);
  const estavaMontando = useRef(montando);
  const total = nos.length;
  const comChegada = chegada && total > 0;
  const trechos = Array.from(new Set(nos.map((no) => no.trecho)));
  const tudoFeito = total > 0 && nos.every((no) => no.estado === 'concluida');
  const indiceAberto = aberto ? nos.findIndex((no) => no.id === aberto) : -1;
  const tituloLiberada = nos.find((no) => no.id === liberadas[0])?.titulo ?? null;
  const primeiroTrecho = nos[0]?.trecho ?? 0;
  const ultimoTrecho = nos[total - 1]?.trecho ?? 0;

  useEffect(() => {
    if (!tituloLiberada) return;
    const espera = setTimeout(() => AccessibilityInfo.announceForAccessibility(mensagens.trilha.liberada(tituloLiberada)), 900);
    return () => clearTimeout(espera);
  }, [tituloLiberada]);

  useEffect(() => {
    if (ocupado) setAberto(null);
  }, [ocupado]);

  // Enquanto a trilha é montada, o nó em esqueleto fica à vista se a pessoa estava vendo o último nó que chegou.
  useEffect(() => {
    if (!montando || total === 0) return;
    acompanhando.current = 'novo';
    tentarAcompanhar();
  }, [montando, total]);

  // Quando a montagem termina, a chegada entra no lugar do esqueleto e fica à vista pela mesma regra.
  useEffect(() => {
    const acabouDeMontar = estavaMontando.current && !montando;
    estavaMontando.current = montando;
    if (!acabouDeMontar) return;
    acompanhando.current = 'fim';
    tentarAcompanhar();
  }, [montando]);

  function tentarRolar() {
    if (!rolarPara || !aoRolar || rolado.current === rolarPara) return;
    const { caminho, lista, linhas } = posicoes.current;
    const linha = linhas.get(rolarPara);
    if (caminho === null || lista === null || linha === undefined) return;
    rolado.current = rolarPara;
    const topo = caminho + lista + linha.y;
    aoRolar(topo, topo + medidas.lente);
  }

  /**
   * Acompanha o fim do caminho depois que as medidas chegam: o nó novo e o esqueleto (ou a chegada) só têm posição
   * depois do layout, que vem depois do efeito. Quem chegar por último completa o pedido.
   */
  function tentarAcompanhar() {
    const modo = acompanhando.current;
    const ultimo = nos[total - 1];
    if (!modo || !acompanhar || !ultimo) return;
    const { caminho, lista, linhas, vindo, chegada: fim } = posicoes.current;
    const linha = linhas.get(ultimo.id);
    const alvo = modo === 'novo' ? vindo : fim;
    if (caminho === null || lista === null || !linha || !alvo) return;
    // O esqueleto ainda na posição antiga (antes do nó novo) não serve: espera a medida nova.
    if (modo === 'novo' && alvo.y < linha.y + linha.altura - 1) return;
    acompanhando.current = null;
    const topoLinha = caminho + lista + linha.y;
    const topoAlvo = modo === 'novo' ? caminho + lista + alvo.y : caminho + alvo.y;
    acompanhar({ topo: topoLinha, base: topoLinha + linha.altura }, { topo: topoAlvo, base: topoAlvo + alvo.altura });
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
    <View style={[caminhoEstilos.caminho, largo ? caminhoEstilos.caminhoLargo : caminhoEstilos.caminhoTela]} onLayout={(evento) => {
      posicoes.current.caminho = evento.nativeEvent.layout.y;
      tentarRolar();
    }}>
      <Inicio texto={stu} trecho={primeiroTrecho} lente={medidas.lente} pensando={montando} />
      <View accessibilityRole="list" accessibilityLabel={mensagens.trilha.licoes}
        onLayout={(evento) => {
          posicoes.current.lista = evento.nativeEvent.layout.y;
          tentarRolar();
        }}>
        {nos.map((no, indice) => {
          const seguinte = nos[indice + 1];
          const fimDoTrecho = seguinte !== undefined && seguinte.trecho !== no.trecho;
          const vaiAteChegada = seguinte === undefined && comChegada;
          const vaiAteVindo = seguinte === undefined && montando;
          const lado: Lado = indice % 2 === 0 ? 'esquerda' : 'direita';
          let depois = 0;
          if (seguinte?.estado === 'atual') depois += medidas.etiqueta;
          if (fimDoTrecho) depois += medidas.marco;
          const espaco = seguinte || vaiAteChegada || vaiAteVindo ? medidas.linhas + depois : 32;
          const surgir = montando && no.estado === 'previa' && reduzir === false;
          const marcoVencido = fimDoTrecho && trechoVencido(nos, no.trecho);

          // O espaço até o próximo nó fica dentro da linha (padding), para o chão da região não ter falhas e o marco anunciado caber nela.
          return (
            <Linha key={no.id} espaco={espaco} chao={coresDaRegiao(no.trecho).chao}
              aoMedir={(caixa) => {
                posicoes.current.linhas.set(no.id, caixa);
                tentarRolar();
                tentarAcompanhar();
              }}>
              <Terreno lado={lado} trecho={no.trecho} indice={indice} medidas={medidas} brotar={surgir} />
              {fimDoTrecho && <Fronteira trechoSeguinte={seguinte.trecho} topo={medidas.lente} />}
              {(seguinte || vaiAteChegada || vaiAteVindo) && (
                <Ligacao lado={lado} ateChegada={vaiAteChegada} feita={no.estado === 'concluida'} topo={medidas.lente} />
              )}
              <Surgir ativo={surgir}>
                <No no={no} posicao={posicaoDoNo(indice, total, montando)} lado={lado} medidas={medidas} reduzir={reduzir}
                  ocupado={ocupado} abrindo={abrindo === no.id} liberada={liberadas.includes(no.id)}
                  guardar={(alvo) => guardarAlvo(no.id, alvo)} tocar={() => tocar(no)} />
              </Surgir>
              {fimDoTrecho && <Marco numero={trechos.indexOf(no.trecho) + 1} vencido={marcoVencido} topo={medidas.lente} />}
            </Linha>
          );
        })}
        {montando && (
          <Vindo lado={total % 2 === 0 ? 'esquerda' : 'direita'} medidas={medidas} chao={coresDaRegiao(ultimoTrecho).chao}
            aoMedir={(caixa) => {
              posicoes.current.vindo = caixa;
              tentarAcompanhar();
            }} />
        )}
      </View>
      {comChegada && (
        <Chegada trecho={ultimoTrecho} lente={medidas.lente} feita={tudoFeito} aoMedir={(caixa) => {
          posicoes.current.chegada = caixa;
          tentarAcompanhar();
        }} />
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

/**
 * Começo do mapa: céu, colinas da primeira região e o Stu com a frase num balão. Enquanto a IA monta a trilha, o Stu
 * "pensa": sobe e desce devagar. A frase diz o mesmo para quem não vê o movimento.
 */
function Inicio({ texto, trecho, lente, pensando }: { texto?: string; trecho: number; lente: number; pensando: boolean }) {
  const { chao, relevo } = coresDaRegiao(trecho);
  const subida = useBalanco(4, 1400, pensando);
  const stu = Math.round(lente * 1.28);

  return (
    <View style={caminhoEstilos.inicio}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
        <View style={caminhoEstilos.inicioCeuBaixo} />
        <Desenho nome="sol" largura={44} estilo={{ position: 'absolute', top: 14, left: 18 }} />
        <Desenho nome="nuvem" largura={64} estilo={{ position: 'absolute', top: 18, left: '30%' }} />
        <Desenho nome="nuvem" largura={46} estilo={{ position: 'absolute', top: 58, left: '4%' }} />
        <View style={caminhoEstilos.inicioColinas}>
          <Onda chao={chao} relevo={relevo} estilo={{ top: 6 }} />
          <View style={[caminhoEstilos.inicioChao, { backgroundColor: chao }]} />
        </View>
      </View>
      {texto && (
        <View style={caminhoEstilos.inicioConteudo}>
          <View style={caminhoEstilos.fala}>
            <Text style={caminhoEstilos.falaTexto}>{texto}</Text>
            <View style={caminhoEstilos.falaSeta} />
          </View>
          <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            importantForAccessibility="no"
            style={{ width: stu, height: Math.round(stu * 1.1), transform: [{ translateY: subida }] }} />
        </View>
      )}
    </View>
  );
}

/** Linha do caminho: a faixa da região, da altura do nó até o próximo, com o nó, a ligação, a fronteira e o marco. */
function Linha({ espaco, chao, aoMedir, children }: {
  espaco: number;
  chao: string;
  aoMedir: (caixa: Caixa) => void;
  children: ReactNode;
}) {
  return (
    <View style={{ paddingBottom: espaco, backgroundColor: chao }}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      {children}
    </View>
  );
}

/** Na montagem, o nó novo entra uma vez com um movimento curto (opacidade, subida e escala, como a web). */
function Surgir({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  const [entrada] = useState(() => ativo ? new Animated.Value(0) : null);

  useEffect(() => {
    if (!entrada) return;
    const animacao = Animated.timing(entrada, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [entrada]);

  if (!entrada) return <>{children}</>;
  return (
    <Animated.View style={{
      opacity: entrada,
      transform: [
        { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
        { scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
    }}>
      {children}
    </Animated.View>
  );
}

/** Cenário da linha: um enfeite grande e um miúdo no lado livre do nó. Na montagem, brotam logo depois do nó. */
function Terreno({ lado, trecho, indice, medidas, brotar }: { lado: Lado; trecho: number; indice: number; medidas: Medidas; brotar: boolean }) {
  const { grande, miudo } = enfeitesDaLinha(trecho, indice);
  const [crescer] = useState(() => brotar ? new Animated.Value(0) : null);
  const direita = lado === 'direita';
  const { lente, enfeite, miudo: tamMiudo } = medidas;

  useEffect(() => {
    if (!crescer) return;
    const animacao = Animated.timing(crescer, { toValue: 1, duration: 420, delay: 160, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [crescer]);

  const posicaoGrande: ViewStyle = direita
    ? { right: '12.5%', marginRight: -(lente / 4 + enfeite / 2) }
    : { left: '12.5%', marginLeft: -(lente / 4 + enfeite / 2) };
  const posicaoMiuda: ViewStyle = direita
    ? { right: '25%', marginRight: -(lente / 2 + tamMiudo + 6) }
    : { left: '25%', marginLeft: -(lente / 2 + tamMiudo + 6) };
  const animacao = crescer ? { opacity: crescer, transform: [{ scale: crescer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] } : null;

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
      <Animated.View style={[{ position: 'absolute', top: 4 }, posicaoGrande, animacao]}>
        <Desenho nome={grande} largura={enfeite} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', top: lente + 16 }, posicaoMiuda, animacao]}>
        <Desenho nome={miudo} largura={tamMiudo} />
      </Animated.View>
    </View>
  );
}

/** Onde a próxima lição vai aparecer: lente tracejada e placa em esqueleto, fora do leitor de tela (a contagem diz o mesmo). */
function Vindo({ lado, medidas, chao, aoMedir }: { lado: Lado; medidas: Medidas; chao: string; aoMedir: (caixa: Caixa) => void }) {
  const direita = lado === 'direita';
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[caminhoEstilos.alvo, direita && caminhoEstilos.alvoDireita, { paddingBottom: 32, backgroundColor: chao }]}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      <View style={caminhoEstilos.margem} />
      <View style={direita ? { marginRight: -medidas.lente / 2 } : { marginLeft: -medidas.lente / 2 }}>
        <View style={[circulo(medidas.lente), caminhoEstilos.vindoLente]} />
      </View>
      <View style={[caminhoEstilos.texto, direita ? caminhoEstilos.textoDireita : caminhoEstilos.textoEsquerda, { minHeight: medidas.lente }]}>
        <View style={[caminhoEstilos.placa, caminhoEstilos.vindoPlaca, direita && caminhoEstilos.vindoPlacaDireita]}>
          <View style={caminhoEstilos.vindoTitulo} />
          <View style={caminhoEstilos.vindoEstado} />
        </View>
      </View>
    </View>
  );
}

function No({ no, posicao, lado, medidas, reduzir, ocupado, abrindo, liberada, guardar, tocar }: {
  no: NoCaminho;
  /** "Lição 3 de 9", ou só "Lição 3" enquanto a trilha é montada. */
  posicao: string;
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
  const nome = nomeDoNo(no, posicao);
  let linha: string = no.estado === 'previa' ? posicao : mensagens.trilha.estados[no.estado];
  if (abrindo) linha = mensagens.trilha.abrindo;
  const direita = lado === 'direita';

  const conteudo = (pressionado: boolean) => (
    <>
      <View style={caminhoEstilos.margem} />
      <View style={direita ? { marginRight: -medidas.lente / 2 } : { marginLeft: -medidas.lente / 2 }}>
        <Lente no={no} medidas={medidas} reduzir={reduzir} liberada={liberada} pressionado={pressionado} focado={focado} />
      </View>
      <View style={[caminhoEstilos.texto, direita ? caminhoEstilos.textoDireita : caminhoEstilos.textoEsquerda, { minHeight: medidas.lente }]}>
        <View style={[caminhoEstilos.placa, no.estado === 'bloqueada' && caminhoEstilos.placaApagada, no.estado === 'atual' && caminhoEstilos.placaAtual]}>
          <Text style={[caminhoEstilos.titulo, no.estado === 'bloqueada' && caminhoEstilos.tituloBloqueado,
            direita && caminhoEstilos.alinharFim, focado && caminhoEstilos.tituloFocado]}>{no.titulo}</Text>
          <Text style={[caminhoEstilos.estado, { color: corDoEstado[no.estado] }, direita && caminhoEstilos.alinharFim]}>{linha}</Text>
        </View>
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
 * Lente do nó, com relevo: a face e o lábio embaixo; no toque, a face desce até o lábio. A atual ganha o anel, que entra
 * uma vez e depois respira devagar, e a etiqueta "Começar", que flutua. A recém-liberada mostra o cadeado se abrindo.
 * Com movimento reduzido, tudo já aparece no estado final, parado.
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
  const respiro = useRef(new Animated.Value(0)).current;
  const etiqueta = useRef(new Animated.Value(0)).current;
  const cadeado = useRef(new Animated.Value(1)).current;
  const escala = useRef(new Animated.Value(liberada ? 0.84 : 1)).current;
  const flutuar = useBalanco(4, 800, atual);

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

  // O anel do nó atual respira devagar enquanto ele é o próximo passo.
  useEffect(() => {
    if (!atual || reduzir !== false) {
      respiro.setValue(0);
      return;
    }
    const balanco = { duration: 1100, easing: Easing.inOut(Easing.ease), isInteraction: false, useNativeDriver: true };
    const ciclo = Animated.loop(Animated.sequence([
      Animated.delay(400),
      Animated.timing(respiro, { ...balanco, toValue: 1 }),
      Animated.timing(respiro, { ...balanco, toValue: 0 }),
    ]));
    ciclo.start();
    return () => {
      ciclo.stop();
      respiro.setValue(0);
    };
  }, [atual, reduzir, respiro]);

  const tamanhoIcone = Math.round(lente * 0.44);
  const anel = atual ? 18 : 8;
  const afundar = pressionado ? 4 : 0;

  return (
    <View style={{ width: lente, height: lente }}>
      {atual && (
        <Animated.View style={[caminhoEstilos.halo, circulo(lente + 24), {
          opacity: Animated.multiply(halo, respiro.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] })),
          transform: [
            { scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            { scale: respiro.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
          ],
        }]} />
      )}
      <View style={[caminhoEstilos.camada, circulo(lente), { top: 6, backgroundColor: visual.labio }]} />
      <Animated.View style={[caminhoEstilos.camada, caminhoEstilos.face, circulo(lente), {
        top: afundar, backgroundColor: visual.face, transform: [{ scale: escala }],
      }]}>
        <Icone nome={iconeDoNo(no)} tamanho={tamanhoIcone} cor={visual.icone} />
        {liberada && (
          <Animated.View style={[caminhoEstilos.cadeado, { borderRadius: lente / 2, opacity: cadeado }]}>
            <Icone nome="cadeado" tamanho={tamanhoIcone} cor={cores.tintaNeutra} />
          </Animated.View>
        )}
      </Animated.View>
      {focado && <View style={[caminhoEstilos.anelFoco, circulo(lente + anel * 2), { left: -anel, top: -anel }]} />}
      {atual && (
        <Animated.View style={[caminhoEstilos.etiquetaCaixa, { bottom: lente + 22 }, {
          opacity: etiqueta,
          transform: [{ translateY: etiqueta.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }, { translateY: flutuar }],
        }]}>
          <View style={caminhoEstilos.etiqueta}>
            <View style={caminhoEstilos.etiquetaSeta} />
            <Text style={caminhoEstilos.etiquetaTexto}>{mensagens.trilha.comecar.toLocaleUpperCase('pt-BR')}</Text>
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

/** Traço grosso ao longo dos pontos: cada pedaço é uma cápsula girada, que cobre a emenda com a seguinte. */
export function tracoGrosso(pontos: readonly Ponto[], espessura: number, cor: string): ViewStyle[] {
  return pontos.slice(1).map((ate, indice) => {
    const de = pontos[indice];
    const comprimento = Math.hypot(ate.x - de.x, ate.y - de.y) + espessura;
    return {
      left: (de.x + ate.x) / 2 - comprimento / 2, top: (de.y + ate.y) / 2 - espessura / 2, width: comprimento, height: espessura,
      borderRadius: espessura / 2, backgroundColor: cor, transform: [{ rotate: `${Math.atan2(ate.y - de.y, ate.x - de.x)}rad` }],
    };
  });
}

/**
 * Ligação até o próximo nó: a estrada clara e, por cima, a linha pontilhada adiante e contínua depois de concluída.
 * Vai do pé da lente até o fim da linha.
 */
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
    const estrada = tracoGrosso(tracado(caixa.largura, caixa.altura, de, ate, 12), 26, corEstrada);
    const linha = feita
      ? tracoGrosso(tracado(caixa.largura, caixa.altura, de, ate, 12), 6, cores.sucessoClaro)
      : pontilhar(tracado(caixa.largura, caixa.altura, de, ate, 48), 13).map((ponto): ViewStyle => ({
        left: ponto.x - 2.5, top: ponto.y - 2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: corPontilhado,
      }));
    return [...estrada, ...linha];
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
 * Marco entre um trecho e outro: o sinal com relevo sobre a fronteira das regiões, sem nome de assunto; dourado quando
 * o trecho foi vencido. Vem depois do nó na árvore, então o leitor de tela lê "Marco 1", "Marco 2"… logo depois do
 * último nó do trecho.
 */
function Marco({ numero, vencido, topo }: { numero: number; vencido: boolean; topo: number }) {
  return (
    <View pointerEvents="box-none" style={[caminhoEstilos.ligacao, { top: topo }]}>
      <View accessible accessibilityRole="text" accessibilityLabel={vencido ? mensagens.trilha.marcoVencido(numero) : mensagens.trilha.marco(numero)}
        style={[caminhoEstilos.marco, vencido && caminhoEstilos.marcoVencido]}>
        <Icone nome="bandeira" tamanho={20} cor={vencido ? cores.ouroTexto : cores.textoSecundario} />
      </View>
    </View>
  );
}

/** Chegada: o topo do caminho, com o troféu numa colina e bandeiras; fica dourada quando todas as lições estão concluídas. */
function Chegada({ trecho, lente, feita, aoMedir }: { trecho: number; lente: number; feita: boolean; aoMedir: (caixa: Caixa) => void }) {
  const { chao, relevo } = coresDaRegiao(trecho);
  const tamanho = lente + 16;
  return (
    <View style={[caminhoEstilos.chegada, { backgroundColor: chao }]}
      onLayout={(evento) => aoMedir({ y: evento.nativeEvent.layout.y, altura: evento.nativeEvent.layout.height })}>
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
        <View style={caminhoEstilos.chegadaEstrada} />
        <View style={[caminhoEstilos.chegadaColina, { backgroundColor: relevo }]} />
        <Desenho nome="bandeira" largura={30} estilo={[caminhoEstilos.chegadaBandeira, { left: '50%', marginLeft: -104 }]} />
        <Desenho nome="bandeira" largura={30} estilo={[caminhoEstilos.chegadaBandeira, { right: '50%', marginRight: -104, transform: [{ scaleX: -1 }] }]} />
        {feita && (
          <>
            <Desenho nome="estrela" largura={22} estilo={{ position: 'absolute', bottom: 150, left: '50%', marginLeft: -72 }} />
            <Desenho nome="estrela" largura={16} estilo={{ position: 'absolute', bottom: 172, right: '50%', marginRight: -66 }} />
            <Desenho nome="estrela" largura={14} estilo={{ position: 'absolute', bottom: 118, right: '50%', marginRight: -98 }} />
          </>
        )}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: tamanho, height: tamanho + 7 }}>
        <View style={[caminhoEstilos.camada, circulo(tamanho), { top: 7, backgroundColor: feita ? cores.ouroEscuro : '#CDD6F2' }]} />
        <View style={[caminhoEstilos.camada, caminhoEstilos.face, circulo(tamanho), { backgroundColor: feita ? cores.ouro : cores.fundo }]}>
          <Icone nome="trofeu" tamanho={Math.round(tamanho * 0.46)} cor={feita ? cores.ouroTexto : cores.textoSecundario} />
        </View>
      </View>
      <View style={caminhoEstilos.chegadaPlaca}>
        <Text style={[caminhoEstilos.chegadaTexto, feita && { color: cores.sucesso }]}>
          {feita ? mensagens.trilha.chegadaFeita : mensagens.trilha.chegada}
        </Text>
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
          <View style={caminhoEstilos.folhaPuxador} />
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

/** Carregando a trilha: esqueleto com a forma da faixa do topo e do mapa, nas cores dos campos. */
export function SkeletonTrilha() {
  const { lente, linhas } = useMedidas();
  const { width } = useWindowDimensions();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={mensagens.trilha.carregando} accessibilityLiveRegion="polite"
      style={caminhoEstilos.skeleton}>
      <View style={caminhoEstilos.skeletonCabecalho}>
        <View style={[caminhoEstilos.skeletonLinha, { width: '72%', height: 32 }]} />
        <View style={caminhoEstilos.skeletonLinha} />
        <View style={[caminhoEstilos.skeletonLinha, { width: '48%', height: 12, marginTop: 12 }]} />
      </View>
      <View style={[{ gap: linhas, paddingVertical: 56, backgroundColor: coresDaRegiao(0).chao },
        width >= 768 ? caminhoEstilos.caminhoLargo : caminhoEstilos.caminhoTela]}>
        {(['esquerda', 'direita', 'esquerda', 'direita'] as const).map((lado, indice) => (
          <View key={indice} style={[circulo(lente), caminhoEstilos.skeletonNo,
            { marginLeft: (lado === 'esquerda' ? '25%' : '75%') as DimensionValue, transform: [{ translateX: -lente / 2 }] }]} />
        ))}
      </View>
    </View>
  );
}

const caminhoEstilos = StyleSheet.create({
  caminho: { marginTop: 8 },
  caminhoTela: { marginHorizontal: -20 },
  caminhoLargo: { borderRadius: 28, overflow: 'hidden' },
  // Começo do mapa
  inicio: { minHeight: 176, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', paddingHorizontal: 16,
    paddingTop: 24, paddingBottom: 26, overflow: 'hidden', backgroundColor: '#DCE8FF' },
  inicioCeuBaixo: { position: 'absolute', left: 0, right: 0, top: '55%', bottom: 0, backgroundColor: '#EAF1FF' },
  inicioColinas: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 76 },
  inicioChao: { position: 'absolute', left: 0, right: 0, top: 52, bottom: 0 },
  inicioConteudo: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, flexShrink: 1 },
  fala: { flexShrink: 1, maxWidth: 272, marginBottom: 46, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18,
    backgroundColor: cores.fundo, borderBottomWidth: 3, borderBottomColor: 'rgba(27, 42, 94, 0.08)' },
  falaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  falaSeta: { position: 'absolute', right: -6, bottom: 18, width: 16, height: 16, borderRadius: 3, backgroundColor: cores.fundo,
    transform: [{ rotate: '45deg' }] },
  // Nó e placa
  alvo: { flexDirection: 'row', alignItems: 'flex-start', minWidth: 0 },
  alvoDireita: { flexDirection: 'row-reverse' },
  margem: { width: '25%' },
  texto: { flex: 1, minWidth: 0, justifyContent: 'center' },
  textoEsquerda: { alignItems: 'flex-start', paddingLeft: 14, paddingRight: 12 },
  textoDireita: { alignItems: 'flex-end', paddingRight: 14, paddingLeft: 12 },
  placa: { maxWidth: '100%', gap: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)', borderBottomWidth: 2, borderBottomColor: 'rgba(27, 42, 94, 0.07)' },
  placaApagada: { backgroundColor: 'rgba(255, 255, 255, 0.74)' },
  placaAtual: { borderWidth: 2, borderColor: 'rgba(56, 88, 214, 0.18)', borderBottomColor: 'rgba(56, 88, 214, 0.18)' },
  titulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 21 },
  tituloBloqueado: { color: cores.textoSecundario },
  tituloFocado: { textDecorationLine: 'underline' },
  estado: { fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  alinharFim: { textAlign: 'right' },
  camada: { position: 'absolute', left: 0, top: 0 },
  face: { alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255, 255, 255, 0.2)' },
  halo: { position: 'absolute', left: -12, top: -12, borderWidth: 5, borderColor: 'rgba(56, 88, 214, 0.24)' },
  cadeado: { position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.faceNeutra },
  anelFoco: { position: 'absolute', borderWidth: 3, borderColor: cores.acao },
  etiquetaCaixa: { position: 'absolute', left: -60, right: -60, alignItems: 'center' },
  etiqueta: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4,
    borderColor: cores.gelo, backgroundColor: cores.fundo },
  etiquetaSeta: { position: 'absolute', bottom: -8, left: '50%', marginLeft: -6, width: 12, height: 12, borderRadius: 2,
    borderRightWidth: 2, borderBottomWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  etiquetaTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18, letterSpacing: 0.6 },
  // Ligação, marco e chegada
  ligacao: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  marco: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -22, width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderColor: cores.labioNeutro, backgroundColor: cores.fundo },
  marcoVencido: { borderColor: cores.ouroEscuro, backgroundColor: cores.ouro },
  chegada: { minHeight: 220, alignItems: 'center', justifyContent: 'flex-end', gap: 14, paddingTop: 36, paddingBottom: 30, overflow: 'hidden' },
  chegadaEstrada: { position: 'absolute', top: 0, left: '50%', marginLeft: -13, width: 26, height: 64,
    borderBottomLeftRadius: 13, borderBottomRightRadius: 13, backgroundColor: corEstrada },
  chegadaColina: { position: 'absolute', bottom: -48, left: '50%', marginLeft: -200, width: 400, height: 190,
    borderTopLeftRadius: 200, borderTopRightRadius: 200 },
  chegadaBandeira: { position: 'absolute', bottom: 96 },
  chegadaPlaca: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  chegadaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  // Folha
  fundoFolha: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(27, 42, 94, 0.32)' },
  folha: { width: '100%', maxWidth: 620, alignSelf: 'center', gap: 12, paddingTop: 10, paddingLeft: 20, paddingRight: 12,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: cores.fundo },
  folhaPuxador: { alignSelf: 'center', width: 40, height: 5, marginLeft: 8, borderRadius: 3, backgroundColor: cores.gelo },
  folhaTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  folhaTitulo: { flex: 1, paddingTop: 9 },
  folhaAcao: { paddingRight: 8, paddingTop: 4 },
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  fecharPressionado: { backgroundColor: cores.nevoa },
  // Esqueletos
  skeleton: { marginTop: 24, gap: 28 },
  skeletonCabecalho: { gap: 12, padding: 24, borderRadius: 24, borderWidth: 2, borderColor: cores.gelo },
  skeletonLinha: { height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonNo: { backgroundColor: 'rgba(255, 255, 255, 0.75)' },
  vindoLente: { borderWidth: 3, borderStyle: 'dashed', borderColor: '#C3CDEE', backgroundColor: 'rgba(255, 255, 255, 0.7)' },
  vindoPlaca: { width: '70%', gap: 8 },
  vindoPlacaDireita: { alignItems: 'flex-end' },
  vindoTitulo: { width: '80%', height: 14, borderRadius: 8, backgroundColor: cores.gelo },
  vindoEstado: { width: '45%', height: 10, borderRadius: 8, backgroundColor: cores.gelo },
});

