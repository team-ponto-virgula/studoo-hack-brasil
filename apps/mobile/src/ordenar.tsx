import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo, Animated, Easing, LayoutAnimation, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions,
  type AccessibilityActionEvent, type LayoutRectangle,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { focoVisivel } from './foco';
import { Icone } from './icone';
import { RolagemDaTela, estilos } from './interface';
import { mensagens } from './mensagens';
import { useMovimentoReduzido } from './movimento';
import { cores, fontes } from './tema';
import { destinoDoArrasto, moverEntreLivres, trocarDeLugar } from './ordenar-regras';
import { tocaSons } from './sons';

const t = mensagens.licao.ordenar;

/** Um item do ordenar (o id e o texto). */
type Item = { id: string; texto: string };
type Caixa = { y: number; altura: number };
type Estado = 'normal' | 'escolhido' | 'certo' | 'errado';

/** 8 entre os cartões; 64 da borda da tela faz a página rolar sozinha durante o arrasto. */
const VAO = 8;
const BORDA = 64;
/** Altura aproximada do rodapé da aula (Verificar): a borda de baixo do arrasto fica acima dele. */
const RODAPE = 140;
const MOLA = Easing.bezier(0.2, 0.9, 0.3, 1.2);
/**
 * Cores da spec 08 com a paleta do kit (spec 13, B5): os três azuis antigos da spec viram a ação, a ação escura e o claro
 * #EEF2FF do kit; o resto como na spec.
 */
const COR = {
  borda: '#C9D1EA', alca: '#8A94B3', claro: '#EEF2FF',
  certo: cores.sucessoClaro, certoFundo: '#EEFAF3', certoDegrau: '#9AD8B5',
  errado: '#E3A24A', erradoFundo: '#FFF6EA', erradoDegrau: '#F2CF96',
};

/**
 * Ordenar em lista única (spec 08, revisão do dono de 19/11): todos os itens numa lista, na ordem do servidor (que nunca é a
 * resposta); a ordem da lista é a resposta. Tocar num cartão escolhe ele; tocar noutro troca os dois; tocar de novo, ou
 * fora da lista, desfaz. Arrastar: segurar 180 ms e mover (a rolagem da página continua livre), ou pela alça, na hora; perto
 * da borda da tela, a página rola sozinha. Durante o arrasto, a lista de verdade não muda de ordem (no navegador, mover o
 * elemento que segura o ponteiro derruba o gesto; achado na prévia, 19/11): ela fica no lugar, sem cor, e uma camada por
 * cima, sem toque, mostra a ordem nova, com o vão onde o cartão vai cair; ao soltar, a ordem nova entra de uma vez. Na nova
 * tentativa, os certos ficam travados no lugar, em verde, e os outros andam por cima deles. Depois de verificar, certo em
 * verde e errado em âmbar. Com movimento reduzido, nada sobe, escala ou desliza, e os cartões que mudaram ficam com o
 * brilho por 600 ms. Leitor de tela: "2º de 4: texto", o escolhido como selecionado, as ações "Mover para cima" e "Mover
 * para baixo" e os avisos da escolha, da troca e da posição nova.
 */
export function Ordenar({ itens, valor, inicial, mudar, desativado, certos, fixos }: {
  itens: Item[];
  valor: string;
  /** A ordem com que a tentativa começou: "Voltar à ordem inicial" volta a ela. */
  inicial: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  /** Depois de verificar: os ids na posição certa (verde); os outros ficam em âmbar. */
  certos?: string[];
  /** Na nova tentativa: os que já estavam certos ficam travados no lugar. */
  fixos?: string[];
}) {
  const reduzir = useMovimentoReduzido() !== false;
  const rolagem = useContext(RolagemDaTela);
  const janela = useWindowDimensions();
  const margens = useSafeAreaInsets();
  const ids = itens.map((item) => item.id);
  const lida = valor.split(',').filter((id) => ids.includes(id));
  const ordem = lida.length === ids.length && new Set(lida).size === ids.length ? lida : (inicial || ids.join(',')).split(',');
  const travados = new Set(certos ? [] : fixos ?? []);
  const total = ordem.length;
  const inativo = desativado || Boolean(certos);
  const textoDe = (id: string) => itens.find((item) => item.id === id)?.texto ?? '';

  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [previa, setPrevia] = useState<string[] | null>(null);
  const [arrastado, setArrastado] = useState<string | null>(null);
  const [brilhos, setBrilhos] = useState<Record<string, number>>({});
  // Só a altura de cada cartão: o lugar sai da ordem (alturas e vãos de quem vem antes). O onLayout do react-native-web só
  // dispara quando o tamanho muda, e o y guardado ficava velho depois de uma troca (achado na prévia, 19/11).
  const alturas = useRef<Record<string, number>>({});
  const arrasto = useRef<{ id: string; inicio: string[]; caixas: Record<string, Caixa>; translacao: number; rolado: number; destino: number; dedo: number } | null>(null);
  const [ySobreposto] = useState(() => new Animated.Value(0));
  const relogioDaBorda = useRef<ReturnType<typeof setInterval> | null>(null);
  const soltouEm = useRef(0);

  // Verificado, enviando ou outra tentativa: a escolha some.
  useEffect(() => {
    if (inativo) setEscolhido(null);
  }, [inativo]);
  useEffect(() => () => {
    if (relogioDaBorda.current) clearInterval(relogioDaBorda.current);
    rolagem?.travar(false);
    // Só ao desmontar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anunciar = (texto: string) => AccessibilityInfo.announceForAccessibility(texto);
  const brilhar = (...quais: string[]) => setBrilhos((atuais) => {
    const novos = { ...atuais };
    for (const id of quais) novos[id] = (novos[id] ?? 0) + 1;
    return novos;
  });
  const aplicar = (nova: string[]) => mudar(nova.join(','));
  /** A troca e o soltar deslizam com uma mola curta; com movimento reduzido, na hora. */
  const animarLugares = (duracao: number, mola: boolean) => {
    if (reduzir) return;
    LayoutAnimation.configureNext(mola
      ? { duration: duracao, update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 } }
      : { duration: duracao, update: { type: LayoutAnimation.Types.easeInEaseOut } });
  };

  function tocar(id: string) {
    // O soltar de um arrasto não vira toque.
    if (inativo || travados.has(id) || Date.now() - soltouEm.current < 300) return;
    // Sons da spec 12: escolher toca o toque; a troca toca só o soltar (sem somar o toque).
    if (escolhido === null) {
      setEscolhido(id);
      void tocaSons.tocarEfeito('toque_opcao');
      anunciar(t.avisoEscolhido(textoDe(id)));
      return;
    }
    if (escolhido === id) {
      setEscolhido(null);
      return;
    }
    animarLugares(240, true);
    aplicar(trocarDeLugar(ordem, escolhido, id));
    void tocaSons.tocarEfeito('ordenar_soltar');
    brilhar(escolhido, id);
    anunciar(t.avisoTrocaram(textoDe(escolhido), textoDe(id)));
    setEscolhido(null);
  }

  /** "Mover para cima" e "Mover para baixo" (leitor de tela): uma posição entre os que se movem. */
  function moverUmaPosicao(id: string, sentido: -1 | 1) {
    const livres = ordem.filter((outro) => !travados.has(outro));
    const indice = livres.indexOf(id);
    if (indice < 0 || indice + sentido < 0 || indice + sentido >= livres.length) return;
    const nova = moverEntreLivres(ordem, travados, id, indice + sentido);
    animarLugares(240, true);
    aplicar(nova);
    void tocaSons.tocarEfeito('ordenar_soltar');
    brilhar(id);
    anunciar(t.avisoPosicao(textoDe(id), nova.indexOf(id) + 1, total));
  }

  /** As caixas de uma ordem, relativas ao topo da lista: cada cartão começa depois das alturas e dos vãos dos anteriores. */
  function caixasDaOrdem(lista: string[]): Record<string, Caixa> {
    const resultado: Record<string, Caixa> = {};
    let y = 0;
    for (const outro of lista) {
      const altura = alturas.current[outro] ?? 0;
      resultado[outro] = { y, altura };
      y += altura + VAO;
    }
    return resultado;
  }

  function comecarArrasto(id: string) {
    if (inativo || travados.has(id) || alturas.current[id] === undefined) return;
    const caixasDoComeco = caixasDaOrdem(ordem);
    arrasto.current = { id, inicio: [...ordem], caixas: caixasDoComeco, translacao: 0, rolado: 0,
      destino: ordem.filter((outro) => !travados.has(outro)).indexOf(id), dedo: 0 };
    ySobreposto.setValue(caixasDoComeco[id].y);
    setEscolhido(null);
    setArrastado(id);
    setPrevia([...ordem]);
    rolagem?.travar(true);
  }

  /** O cartão segue o dedo (e a rolagem que a borda fez); quem passa do meio dele troca de lado, e os outros abrem espaço. */
  function seguirDedo() {
    const atual = arrasto.current;
    if (!atual) return;
    const caixa = atual.caixas[atual.id];
    const y = caixa.y + atual.translacao + atual.rolado;
    ySobreposto.setValue(y);
    const centro = y + caixa.altura / 2;
    const destino = destinoDoArrasto(atual.inicio, travados, atual.id, atual.caixas, centro);
    if (destino === atual.destino) return;
    atual.destino = destino;
    animarLugares(180, false);
    setPrevia(moverEntreLivres(atual.inicio, travados, atual.id, destino));
  }

  /** Perto da borda de cima ou de baixo da tela (64), a página rola sozinha enquanto o dedo fica ali. */
  function vigiarBorda() {
    const sentido = () => {
      const atual = arrasto.current;
      if (!atual) return 0;
      if (atual.dedo < margens.top + BORDA) return -1;
      if (atual.dedo > janela.height - margens.bottom - RODAPE - BORDA) return 1;
      return 0;
    };
    if (!rolagem || sentido() === 0) {
      if (relogioDaBorda.current) clearInterval(relogioDaBorda.current);
      relogioDaBorda.current = null;
      return;
    }
    if (relogioDaBorda.current) return;
    relogioDaBorda.current = setInterval(() => {
      const atual = arrasto.current;
      const para = sentido();
      if (!atual || para === 0) {
        if (relogioDaBorda.current) clearInterval(relogioDaBorda.current);
        relogioDaBorda.current = null;
        return;
      }
      atual.rolado += rolagem.rolarPor(para * 8);
      seguirDedo();
    }, 16);
  }

  function arrastar(translacao: number, dedo: number) {
    const atual = arrasto.current;
    if (!atual) return;
    atual.translacao = translacao;
    atual.dedo = dedo;
    seguirDedo();
    vigiarBorda();
  }

  function soltar() {
    if (relogioDaBorda.current) clearInterval(relogioDaBorda.current);
    relogioDaBorda.current = null;
    rolagem?.travar(false);
    const atual = arrasto.current;
    if (!atual) return;
    soltouEm.current = Date.now();
    const final = moverEntreLivres(atual.inicio, travados, atual.id, atual.destino);
    // O som de soltar só numa posição nova (no mesmo lugar, nada).
    if (final.join(',') !== atual.inicio.join(',')) void tocaSons.tocarEfeito('ordenar_soltar');
    // Onde ele fica: o topo da lista mais as alturas (e os vãos) de quem vem antes na ordem nova.
    let destinoY = Math.min(...atual.inicio.map((outro) => atual.caixas[outro]?.y ?? 0));
    for (const outro of final) {
      if (outro === atual.id) break;
      destinoY += (atual.caixas[outro]?.altura ?? 0) + VAO;
    }
    const terminar = () => {
      arrasto.current = null;
      setArrastado(null);
      setPrevia(null);
      if (final.join(',') === atual.inicio.join(',')) return;
      aplicar(final);
      if (reduzir) brilhar(atual.id);
      anunciar(t.avisoPosicao(textoDe(atual.id), final.indexOf(atual.id) + 1, total));
    };
    if (reduzir) {
      terminar();
      return;
    }
    Animated.timing(ySobreposto, { toValue: destinoY, duration: 200, easing: MOLA, useNativeDriver: true }).start(terminar);
  }

  const estadoDe = (id: string): Estado => {
    if (certos) return certos.includes(id) ? 'certo' : 'errado';
    if (travados.has(id)) return 'certo';
    return escolhido === id ? 'escolhido' : 'normal';
  };
  const mudou = ordem.join(',') !== (inicial || ids.join(','));

  return (
    <Pressable accessible={false} onPress={() => setEscolhido(null)} style={estilosOrdenar.secao}>
      <View style={estilosOrdenar.comoResponder}>
        <View style={estilosOrdenar.comoResponderIcone} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Pontos cor={cores.acao} />
        </View>
        <Text testID="ordenar-como-responder" accessibilityLiveRegion="polite" style={estilosOrdenar.comoResponderTexto}>
          {escolhido ? t.comoResponderEscolhido : t.comoResponder}
        </Text>
      </View>
      {/* Raiz própria dos gestos (o app só tem a do gesto de voltar, no iPhone); sem o estilo, ela viria com flex: 1. */}
      <GestureHandlerRootView style={estilosOrdenar.raizDosGestos}>
        <View testID="ordenar-lista" style={estilosOrdenar.lista}>
          {ordem.map((id, indice) => {
            const estado = estadoDe(id);
            const travado = travados.has(id);
            const livres = ordem.filter((outro) => !travados.has(outro));
            const naLista = livres.indexOf(id);
            const acoes = inativo || travado ? undefined : [
              ...(naLista > 0 ? [{ name: 'moverParaCima', label: t.moverParaCima }] : []),
              ...(naLista < livres.length - 1 ? [{ name: 'moverParaBaixo', label: t.moverParaBaixo }] : []),
            ];
            return (
              <CartaoDaOrdem key={id} id={id} texto={textoDe(id)} posicao={indice + 1} total={total} estado={estado} travado={travado}
                escondido={arrastado !== null} brilho={brilhos[id] ?? 0} reduzir={reduzir} podeArrastar={!inativo && !travado && total > 1}
                acoes={acoes} aoTocar={() => tocar(id)}
                aoAcao={(evento) => moverUmaPosicao(id, evento.nativeEvent.actionName === 'moverParaCima' ? -1 : 1)}
                aoMedir={(caixa) => { alturas.current[id] = caixa.height; }}
                aoComecar={() => comecarArrasto(id)} aoArrastar={arrastar} aoSoltar={soltar} />
            );
          })}
          {arrastado && (
            // A ordem nova enquanto o dedo anda: cópias paradas, sem toque, com o vão onde o arrastado vai cair. Os outros
            // abrem espaço (LayoutAnimation de 180 ms no aparelho); a lista de verdade, embaixo, segue com o gesto.
            <View testID="ordenar-previa" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
              style={estilosOrdenar.camadaDaPrevia}>
              {(previa ?? ordem).map((id, indice) => (
                <CartaoParado key={id} texto={textoDe(id)} posicao={indice + 1} estado={estadoDe(id)} vao={id === arrastado} />
              ))}
            </View>
          )}
          {arrastado && (
            // A cópia que segue o dedo, por cima de tudo.
            <Animated.View testID="ordenar-arrastado" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
              style={[estilosOrdenar.sobreposto, { transform: [{ translateY: ySobreposto }, { scale: reduzir ? 1 : 1.03 }] }]}>
              <Face texto={textoDe(arrastado)} posicao={(previa ?? ordem).indexOf(arrastado) + 1} estado="normal" arrastando />
            </Animated.View>
          )}
        </View>
      </GestureHandlerRootView>
      {mudou && !inativo && (
        <Pressable testID="voltar-ordem-inicial" accessibilityRole="button" style={estilosOrdenar.linkAlvo}
          onPress={() => {
            setEscolhido(null);
            animarLugares(240, true);
            mudar(inicial || ids.join(','));
            // Um toque só para a ação inteira (nunca um por item que voltou).
            void tocaSons.tocarEfeito('toque_opcao');
          }}>
          <Text style={estilosOrdenar.link}>{t.voltarOrdemInicial}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

/** Um cartão da lista: o toque (escolher e trocar), os dois arrastos (180 ms no cartão e na hora pela alça) e o leitor de tela. */
function CartaoDaOrdem({ id, texto, posicao, total, estado, travado, escondido, brilho, reduzir, podeArrastar, acoes, aoTocar, aoAcao, aoMedir,
  aoComecar, aoArrastar, aoSoltar }: {
  id: string;
  texto: string;
  posicao: number;
  total: number;
  estado: Estado;
  travado: boolean;
  /** Arrastando (qualquer cartão): a lista de verdade fica no lugar, sem cor e com o gesto vivo, embaixo da camada da prévia. */
  escondido: boolean;
  brilho: number;
  reduzir: boolean;
  podeArrastar: boolean;
  acoes?: { name: string; label: string }[];
  aoTocar: () => void;
  aoAcao: (evento: AccessibilityActionEvent) => void;
  aoMedir: (caixa: LayoutRectangle) => void;
  aoComecar: () => void;
  aoArrastar: (translacao: number, dedo: number) => void;
  aoSoltar: () => void;
}) {
  const [subida] = useState(() => new Animated.Value(0));
  const [focado, setFocado] = useState(false);
  // Os dois arrastos, com a configuração escrita por extenso: o plugin de Babel do react-native-worklets (que vem com o Expo)
  // recusa espalhar (`...`) um objeto na configuração dos hooks do gesture-handler, e o bundle do app nem fecha.
  // No toque, segurar 180 ms (a rolagem da página continua livre); com o mouse (prévia web), 4 px já arrastam.
  const peloCartao = usePanGesture({
    enabled: podeArrastar, runOnJS: true, disableReanimated: true,
    activateAfterLongPress: Platform.OS === 'web' ? undefined : 180,
    minDistance: Platform.OS === 'web' ? 4 : undefined,
    onActivate: () => aoComecar(),
    onUpdate: (evento) => aoArrastar(evento.translationY, evento.absoluteY),
    onDeactivate: () => aoSoltar(),
  });
  // Pela alça, o arrasto começa na hora.
  const pelaAlca = usePanGesture({
    enabled: podeArrastar, runOnJS: true, disableReanimated: true, minDistance: 1,
    onActivate: () => aoComecar(),
    onUpdate: (evento) => aoArrastar(evento.translationY, evento.absoluteY),
    onDeactivate: () => aoSoltar(),
  });

  // Escolhido: sobe 2 px em 120 ms (com movimento reduzido, nada sobe).
  useEffect(() => {
    const animacao = Animated.timing(subida, { toValue: estado === 'escolhido' && !reduzir ? -2 : 0, duration: reduzir ? 0 : 120,
      easing: Easing.out(Easing.quad), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [estado, reduzir, subida]);

  const rotulo = travado ? t.travadoRotulo(texto, posicao) : t.cartaoRotulo(posicao, total, texto);
  const degrau = estado === 'escolhido' ? 6 : 4;
  const corDegrau = estado === 'escolhido' ? cores.acaoEscura : estado === 'certo' ? COR.certoDegrau : estado === 'errado' ? COR.erradoDegrau : COR.borda;
  const tocavel = podeArrastar;
  return (
    <Animated.View testID={`ordenar-item-${id}`} onLayout={(evento) => aoMedir(evento.nativeEvent.layout)}
      style={{ opacity: escondido ? 0 : 1, transform: [{ translateY: subida }] }}>
      <GestureDetector gesture={peloCartao}>
        {/* O escolhido: accessibilityState.selected no aparelho e aria-pressed na web (spec 08); o react-native-web não lê o accessibilityState. */}
        <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityState={{ selected: estado === 'escolhido', disabled: !tocavel }}
          aria-pressed={estado === 'escolhido'} accessibilityActions={acoes} onAccessibilityAction={aoAcao} onPress={aoTocar}
          onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
          style={({ pressed }) => [estilosOrdenar.fora, { backgroundColor: corDegrau, paddingBottom: pressed && tocavel ? 0 : degrau,
            marginTop: pressed && tocavel ? degrau : 0 }, focado && estilos.foco]}>
          <Face texto={texto} posicao={posicao} estado={estado} brilho={brilho} reduzir={reduzir}
            alca={
              estado === 'certo' || estado === 'errado' ? null : (
                <GestureDetector gesture={pelaAlca}>
                  <View style={estilosOrdenar.alca} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Pontos cor={COR.alca} />
                  </View>
                </GestureDetector>
              )
            } />
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
}

/** Um cartão parado da camada da prévia (o mesmo tamanho do de verdade): o vão é o lugar onde o arrastado vai cair. */
function CartaoParado({ texto, posicao, estado, vao }: { texto: string; posicao: number; estado: Estado; vao: boolean }) {
  const corDegrau = estado === 'certo' ? COR.certoDegrau : estado === 'errado' ? COR.erradoDegrau : COR.borda;
  return (
    <View style={[estilosOrdenar.fora, { backgroundColor: corDegrau, paddingBottom: 4 }, vao && estilosOrdenar.vao]}>
      <Face texto={texto} posicao={posicao} estado={estado} />
    </View>
  );
}

/** A face do cartão: o número num círculo de 28, o texto (até três linhas, sem cortar) e a alça, o visto ou o X à direita. */
function Face({ texto, posicao, estado, brilho = 0, reduzir = false, arrastando = false, alca }: {
  texto: string;
  posicao: number;
  estado: Estado;
  brilho?: number;
  reduzir?: boolean;
  arrastando?: boolean;
  alca?: ReactNode;
}) {
  // O brilho #EEF2FF depois da troca: some em 400 ms; com movimento reduzido, fica 600 ms e sai de uma vez (só cor).
  const [luz] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!brilho) return;
    luz.setValue(1);
    if (reduzir) {
      const espera = setTimeout(() => luz.setValue(0), 600);
      return () => clearTimeout(espera);
    }
    const animacao = Animated.timing(luz, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [brilho, reduzir, luz]);

  const face = estado === 'escolhido' ? estilosOrdenar.faceEscolhida : estado === 'certo' ? estilosOrdenar.faceCerta
    : estado === 'errado' ? estilosOrdenar.faceErrada : null;
  const numero = estado === 'escolhido' ? { backgroundColor: cores.acao } : estado === 'certo' ? { backgroundColor: COR.certo }
    : estado === 'errado' ? { backgroundColor: COR.errado } : null;
  const numeroBranco = estado !== 'normal';
  return (
    <View style={[estilosOrdenar.face, face, arrastando && estilosOrdenar.sombra]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estilosOrdenar.luz, { opacity: luz }]} />
      <View style={[estilosOrdenar.numero, numero]}>
        <Text style={[estilosOrdenar.numeroTexto, numeroBranco && { color: cores.fundo }]}>{posicao}</Text>
      </View>
      <Text numberOfLines={3} style={estilosOrdenar.texto}>{texto}</Text>
      {estado === 'certo' ? (
        <View style={estilosOrdenar.alca}><Icone nome="check" tamanho={20} cor={COR.certo} traco={3} /></View>
      ) : estado === 'errado' ? (
        <View style={estilosOrdenar.alca}><Icone nome="fechar" tamanho={20} cor={COR.errado} traco={3} /></View>
      ) : alca === undefined ? (
        <View style={estilosOrdenar.alca}><Pontos cor={COR.alca} /></View>
      ) : alca}
    </View>
  );
}

/** Seis pontos (a alça de arrastar), em 20 px. */
function Pontos({ cor }: { cor: string }) {
  return (
    <View style={estilosOrdenar.pontos}>
      {[0, 1, 2, 3, 4, 5].map((ponto) => <View key={ponto} style={[estilosOrdenar.ponto, { backgroundColor: cor }]} />)}
    </View>
  );
}

const estilosOrdenar = StyleSheet.create({
  secao: { gap: 12 },
  // A linha de como responder: ícone de 20 em ação e texto de 16 em 700, na cor secundária.
  comoResponder: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  comoResponderIcone: { width: 20, height: 22, alignItems: 'center', justifyContent: 'center' },
  comoResponderTexto: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  lista: { gap: VAO },
  fora: { borderRadius: 16 },
  raizDosGestos: { alignSelf: 'stretch' },
  face: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingLeft: 12, borderRadius: 16, borderWidth: 2,
    borderColor: COR.borda, backgroundColor: cores.fundo, overflow: 'hidden' },
  faceEscolhida: { borderColor: cores.acao, backgroundColor: COR.claro },
  faceCerta: { borderColor: COR.certo, backgroundColor: COR.certoFundo },
  faceErrada: { borderColor: COR.errado, backgroundColor: COR.erradoFundo },
  luz: { backgroundColor: COR.claro },
  sombra: { boxShadow: '0 12px 24px rgba(11, 27, 92, 0.18)' },
  numero: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.claro },
  numeroTexto: { color: cores.acaoEscura, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 15, lineHeight: 18 },
  // Sem flex fixo: encolhe e quebra em até três linhas, sem cortar.
  texto: { flexGrow: 1, flexShrink: 1, flexBasis: 0, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  alca: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pontos: { width: 12, height: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'space-between' },
  ponto: { width: 4, height: 4, borderRadius: 2 },
  // A camada da prévia cobre a lista de verdade (mesma largura, cartões do mesmo tamanho); a cópia arrastada vem por cima.
  camadaDaPrevia: { position: 'absolute', left: 0, right: 0, top: 0, gap: VAO, zIndex: 4 },
  vao: { opacity: 0 },
  sobreposto: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 5 },
  linkAlvo: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22, textDecorationLine: 'underline' },
});
