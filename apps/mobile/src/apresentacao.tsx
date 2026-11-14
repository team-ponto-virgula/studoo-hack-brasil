import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePulinho } from './animacoes';
import { tracoGrosso } from './caminho';
import { Icone } from './icone';
import { Botao, estilos, useBalanco, useMovimentoReduzido } from './interface';
import { mensagens } from './mensagens';
import type { NomeDesenho } from './mundo-desenhos';
import { Desenho, Paisagem, coresDaRegiao } from './mundo';
import { iconesDosTemas, type IdTema } from './temas';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

/*
 * Apresentação do Studoo no app, com os mesmos cinco passos da web (src/app/apresentacao.tsx): o Stu, qualquer assunto,
 * a trilha que nasce, o progresso salvo e a área de interesse. No celular, os passos são páginas que a pessoa também pode deslizar para o lado.
 */

const temasDaArte: readonly { nome: string; icone: NomeDesenho; posicao: ViewStyle }[] = [
  { nome: mensagens.apresentacao.temas[0], icone: 'temaMusica', posicao: { top: '10%', left: '6%' } },
  { nome: mensagens.apresentacao.temas[1], icone: 'temaIdiomas', posicao: { top: '22%', right: '8%' } },
  { nome: mensagens.apresentacao.temas[2], icone: 'temaMatematica', posicao: { top: '36%', left: '10%' } },
  { nome: mensagens.apresentacao.temas[3], icone: 'temaArtes', posicao: { top: '44%', right: '5%' } },
  { nome: mensagens.apresentacao.temas[4], icone: 'temaDiaADia', posicao: { top: '58%', left: '3%' } },
  { nome: mensagens.apresentacao.temas[5], icone: 'temaTecnologia', posicao: { top: '6%', left: '44%' } },
];

/** Áreas para escolher no último passo: as do pedido, menos Populares. */
const areasDaApresentacao = mensagens.pedido.temas.filter((tema) => tema.id !== 'populares');

/**
 * Passos da apresentação, em páginas, como os cinco da web; o último é a escolha da área que interessa, que já abre o
 * pedido com as ideias dela. Na primeira vez termina em "Criar minha primeira trilha"; reaberta pelo pedido, termina em
 * "Entendi". Pular encerra a qualquer momento. O título de cada passo recebe o foco e diz a posição; as páginas fora da
 * vista ficam fora do leitor de tela. As ilustrações são decorativas.
 */
export function Apresentacao({ primeiraVez, concluir }: { primeiraVez: boolean; concluir: (area?: IdTema) => void }) {
  const { width } = useWindowDimensions();
  const reduzir = useMovimentoReduzido();
  const [passo, setPasso] = useState(0);
  const [area, setArea] = useState<IdTema | undefined>();
  const paginas = useRef<ComponentRef<typeof ScrollView>>(null);
  const titulos = useRef<(ComponentRef<typeof Text> | null)[]>([]);
  const primeira = useRef(true);
  const passos = mensagens.apresentacao.passos;
  const total = passos.length;
  const ultimo = passo === total - 1;
  const largura = Math.min(width, 620) - 40;

  useEffect(() => {
    const titulo = titulos.current[passo];
    if (!titulo) return;
    // Na abertura, o foco vai ao primeiro título como em qualquer tela; depois, a cada passo.
    const espera = setTimeout(() => AccessibilityInfo.sendAccessibilityEvent(titulo, 'focus'), primeira.current ? 0 : 150);
    primeira.current = false;
    return () => clearTimeout(espera);
  }, [passo]);

  function irPara(indice: number) {
    setPasso(indice);
    paginas.current?.scrollTo({ x: indice * width, animated: reduzir === false });
  }

  let rotuloFinal: string = mensagens.apresentacao.continuar;
  if (ultimo) rotuloFinal = primeiraVez ? mensagens.apresentacao.comecar : mensagens.apresentacao.entendi;

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={estilos.marcaConteudo}>
          <View style={apresentacaoEstilos.andamento} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={apresentacaoEstilos.pontos}>
              {passos.map((item, indice) => (
                <View key={item.titulo} style={[apresentacaoEstilos.ponto, indice < passo && apresentacaoEstilos.pontoFeito,
                  indice === passo && apresentacaoEstilos.pontoAtivo]} />
              ))}
            </View>
            <Text style={apresentacaoEstilos.posicao}>{mensagens.apresentacao.posicao(passo + 1, total)}</Text>
          </View>
          {!ultimo && <Botao rotulo={mensagens.apresentacao.pular} testID="pular-apresentacao" variante="texto" compacto acao={() => concluir()} />}
        </View>
      </View>
      <ScrollView ref={paginas} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={estilos.tela}
        onMomentumScrollEnd={(evento) => {
          const indice = Math.round(evento.nativeEvent.contentOffset.x / width);
          if (indice !== passo && indice >= 0 && indice < total) setPasso(indice);
        }}>
        {passos.map((item, indice) => (
          <ScrollView key={item.titulo} style={{ width }} contentContainerStyle={[estilos.conteudo, apresentacaoEstilos.pagina]}
            importantForAccessibility={indice === passo ? 'auto' : 'no-hide-descendants'} accessibilityElementsHidden={indice !== passo}>
            {indice < 4 ? (
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {indice === 0 && <ArteStu largura={largura} />}
                {indice === 1 && <ArteTemas largura={largura} />}
                {indice === 2 && <ArteTrilha largura={largura} animar={indice === passo && reduzir === false} />}
                {indice === 3 && <ArteProgresso largura={largura} />}
              </View>
            ) : (
              <View accessibilityLabel={mensagens.apresentacao.areas} style={apresentacaoEstilos.areas}>
                {areasDaApresentacao.map((item) => (
                  <AreaDaApresentacao key={item.id} nome={item.nome} id={item.id} escolhida={area === item.id}
                    escolher={() => setArea((atual) => (atual === item.id ? undefined : item.id))} />
                ))}
              </View>
            )}
            <Text ref={(titulo) => { titulos.current[indice] = titulo; }} testID={`titulo-apresentacao-${indice}`} accessible
              accessibilityRole="header" accessibilityLabel={`${mensagens.apresentacao.posicao(indice + 1, total)}: ${item.titulo}`}
              style={[estilos.titulo, apresentacaoEstilos.titulo]}>{item.titulo}</Text>
            <Text style={[estilos.introducao, apresentacaoEstilos.texto]}>{item.texto}</Text>
          </ScrollView>
        ))}
      </ScrollView>
      <View style={estilos.rodape}>
        <View style={[estilos.rodapeConteudo, apresentacaoEstilos.acoes]}>
          {passo > 0 && (
            <View style={apresentacaoEstilos.metade}>
              <Botao rotulo={mensagens.apresentacao.voltar} testID="voltar-apresentacao" variante="secundario" acao={() => irPara(passo - 1)} />
            </View>
          )}
          <View style={[apresentacaoEstilos.metade, ultimo && apresentacaoEstilos.principalLargo]}>
            <Botao rotulo={rotuloFinal} testID="avancar-apresentacao" icone={ultimo ? undefined : 'seta'}
              acao={() => (ultimo ? concluir(area) : irPara(passo + 1))} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Área no último passo: cartão com o ícone; a escolhida fica marcada, o ícone pula e o leitor de tela ouve que está selecionada. */
function AreaDaApresentacao({ id, nome, escolhida, escolher }: { id: IdTema; nome: string; escolhida: boolean; escolher: () => void }) {
  const [focada, setFocada] = useState(false);
  const pulo = usePulinho(escolhida, 1.3);
  return (
    <Pressable testID={`area-apresentacao-${id}`} accessibilityRole="button" accessibilityState={{ selected: escolhida }}
      onPress={escolher} onFocus={() => setFocada(true)} onBlur={() => setFocada(false)}
      style={({ pressed }) => [apresentacaoEstilos.area, escolhida && apresentacaoEstilos.areaEscolhida, pressed && apresentacaoEstilos.areaAfundada,
        focada && estilos.foco]}>
      <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        style={{ transform: [{ scale: pulo }, { rotate: pulo.interpolate({ inputRange: [1, 1.3], outputRange: ['0deg', '-12deg'] }) }] }}>
        <Desenho nome={iconesDosTemas[id]} largura={36} />
      </Animated.View>
      <Text style={[apresentacaoEstilos.areaTexto, escolhida && { color: cores.acaoEscura }]}>{nome}</Text>
    </Pressable>
  );
}

/** Algo que surge com um pulinho, uma vez, depois de `atraso`; parado com movimento reduzido. */
function Surge({ atraso, animar, estilo, children }: { atraso: number; animar: boolean; estilo?: ViewStyle; children: ReactNode }) {
  const [valor] = useState(() => new Animated.Value(animar ? 0 : 1));

  useEffect(() => {
    if (!animar) {
      valor.setValue(1);
      return;
    }
    valor.setValue(0);
    const animacao = Animated.timing(valor, { toValue: 1, duration: 380, delay: atraso, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [animar, atraso, valor]);

  return (
    <Animated.View style={[estilo, { opacity: valor, transform: [{ scale: valor.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function ArteStu({ largura }: { largura: number }) {
  return (
    <Paisagem altura={largura * 0.75} estilo={apresentacaoEstilos.arte}>
      {(l) => (
        <>
          <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            style={{ position: 'absolute', bottom: '6%', left: l * 0.33, width: l * 0.34, height: l * 0.34 * 1.1 }} />
          <View style={[apresentacaoEstilos.oi, { bottom: '52%', left: '62%' }]}>
            <Text style={apresentacaoEstilos.oiTexto}>{mensagens.apresentacao.oi}</Text>
          </View>
        </>
      )}
    </Paisagem>
  );
}

function ArteTemas({ largura }: { largura: number }) {
  return (
    <Paisagem altura={largura * 0.75} estilo={apresentacaoEstilos.arte}>
      {(l) => (
        <>
          {temasDaArte.map((tema) => (
            <View key={tema.nome} style={[apresentacaoEstilos.tema, tema.posicao]}>
              <Desenho nome={tema.icone} largura={22} />
              <Text style={apresentacaoEstilos.temaTexto}>{tema.nome}</Text>
            </View>
          ))}
          <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            style={{ position: 'absolute', bottom: '5%', left: l * 0.4, width: l * 0.2, height: l * 0.2 * 1.1 }} />
        </>
      )}
    </Paisagem>
  );
}

/** Pontos da estrada da miniatura: as duas curvas da web (src/app/apresentacao.tsx), na grade de 320 × 200. */
function estradaDaMiniatura(largura: number, altura: number, passos = 14) {
  const curvas = [
    [[96, 156], [96, 120], [218, 132], [218, 100]],
    [[218, 100], [218, 68], [122, 64], [122, 40]],
  ];
  const pontos: { x: number; y: number }[] = [];
  curvas.forEach((curva, indiceCurva) => {
    for (let passo = indiceCurva === 0 ? 0 : 1; passo <= passos; passo += 1) {
      const t = passo / passos;
      const u = 1 - t;
      const [p0, p1, p2, p3] = curva;
      const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
      const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
      pontos.push({ x: (x / 320) * largura, y: (y / 200) * altura });
    }
  });
  return pontos;
}

/** Nó da miniatura, com relevo. */
function NoMini({ x, y, tamanho, face, labio, icone, corIcone }: {
  x: DimensionValue;
  y: DimensionValue;
  tamanho: number;
  face: string;
  labio: string;
  icone: NomeIcone;
  corIcone: string;
}) {
  return (
    <View style={{ position: 'absolute', left: x, top: y, marginLeft: -tamanho / 2, marginTop: -tamanho / 2, width: tamanho, height: tamanho }}>
      <View style={[apresentacaoEstilos.camada, { top: tamanho * 0.09, width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: labio }]} />
      <View style={[apresentacaoEstilos.camada, apresentacaoEstilos.noFace, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: face }]}>
        <Icone nome={icone} tamanho={Math.round(tamanho * 0.44)} cor={corIcone} />
      </View>
    </View>
  );
}

/** Pedaço de trilha: estrada em curva e três nós que surgem em sequência, com o cenário brotando ao redor. */
function ArteTrilha({ largura, animar }: { largura: number; animar: boolean }) {
  const altura = largura * (11 / 16);
  const pontos = estradaDaMiniatura(largura, altura);
  const no = largura * 0.16;
  const flutuar = useBalanco(4, 800, animar);
  return (
    <View style={[apresentacaoEstilos.arte, apresentacaoEstilos.mini, { height: altura, backgroundColor: coresDaRegiao(0).chao }]}>
      {tracoGrosso(pontos, largura * 0.07, 'rgba(255, 255, 255, 0.7)').map((estilo, indice) => (
        <View key={`e${indice}`} style={[apresentacaoEstilos.camada, estilo]} />
      ))}
      {pontos.filter((_, indice) => indice % 2 === 1).map((ponto, indice) => (
        <View key={`p${indice}`} style={[apresentacaoEstilos.camada, apresentacaoEstilos.pontinho, { left: ponto.x - 2.5, top: ponto.y - 2.5 }]} />
      ))}
      <Surge atraso={900} animar={animar} estilo={{ position: 'absolute', left: '4%', top: '8%' }}><Desenho nome="arvore" largura={largura * 0.13} /></Surge>
      <Surge atraso={500} animar={animar} estilo={{ position: 'absolute', right: '10%', top: '66%' }}><Desenho nome="flores" largura={largura * 0.09} /></Surge>
      <Surge atraso={1300} animar={animar} estilo={{ position: 'absolute', right: '12%', top: '14%' }}><Desenho nome="arbusto" largura={largura * 0.12} /></Surge>
      <Surge atraso={300} animar={animar} estilo={{ position: 'absolute', left: '3%', top: '66%' }}><Desenho nome="lagoa" largura={largura * 0.17} /></Surge>
      <Surge atraso={600} animar={animar} estilo={StyleSheet.absoluteFill}>
        <NoMini x="68%" y="50%" tamanho={no} face={cores.fundo} labio="#CDD6F2" icone="livro" corIcone={cores.acao} />
      </Surge>
      <Surge atraso={1100} animar={animar} estilo={StyleSheet.absoluteFill}>
        <NoMini x="38%" y="20%" tamanho={no} face={cores.fundo} labio="#CDD6F2" icone="revisao" corIcone={cores.acao} />
      </Surge>
      <Surge atraso={100} animar={animar} estilo={StyleSheet.absoluteFill}>
        <NoMini x="30%" y="78%" tamanho={no} face={cores.acao} labio={cores.acaoEscura} icone="livro" corIcone={cores.fundo} />
        <Animated.View style={[apresentacaoEstilos.etiqueta, { left: '30%', top: '78%', marginTop: -no / 2 - 38, transform: [{ translateX: -48 }, { translateY: flutuar }] }]}>
          <Text style={apresentacaoEstilos.etiquetaTexto}>{mensagens.trilha.comecar.toLocaleUpperCase('pt-BR')}</Text>
        </Animated.View>
      </Surge>
    </View>
  );
}

/** Trilha vencida: lições concluídas, o troféu dourado no topo da montanha e o selo de progresso salvo. */
function ArteProgresso({ largura }: { largura: number }) {
  const altura = largura * (11 / 16);
  const pontos = estradaDaMiniatura(largura, altura);
  const no = largura * 0.16;
  return (
    <View style={[apresentacaoEstilos.arte, apresentacaoEstilos.mini, { height: altura, backgroundColor: coresDaRegiao(2).chao }]}>
      {tracoGrosso(pontos, largura * 0.07, 'rgba(255, 255, 255, 0.7)').map((estilo, indice) => (
        <View key={`e${indice}`} style={[apresentacaoEstilos.camada, estilo]} />
      ))}
      {tracoGrosso(pontos, largura * 0.018, cores.sucessoClaro).map((estilo, indice) => (
        <View key={`l${indice}`} style={[apresentacaoEstilos.camada, estilo]} />
      ))}
      <Desenho nome="picos" largura={largura * 0.22} estilo={{ position: 'absolute', left: '3%', top: '10%' }} />
      <Desenho nome="pinheiro" largura={largura * 0.09} estilo={{ position: 'absolute', right: '9%', top: '50%' }} />
      <Desenho nome="estrela" largura={largura * 0.06} estilo={{ position: 'absolute', left: '27%', top: '5%' }} />
      <Desenho nome="estrela" largura={largura * 0.04} estilo={{ position: 'absolute', left: '48%', top: '4%' }} />
      <NoMini x="30%" y="78%" tamanho={no} face={cores.sucessoClaro} labio={cores.sucesso} icone="check" corIcone={cores.fundo} />
      <NoMini x="68%" y="50%" tamanho={no} face={cores.sucessoClaro} labio={cores.sucesso} icone="check" corIcone={cores.fundo} />
      <NoMini x="38%" y="20%" tamanho={largura * 0.19} face={cores.ouro} labio={cores.ouroEscuro} icone="trofeu" corIcone={cores.ouroTexto} />
      <View style={apresentacaoEstilos.selo}>
        <Icone nome="check" tamanho={18} cor={cores.sucesso} />
        <Text style={apresentacaoEstilos.seloTexto}>{mensagens.apresentacao.salvo}</Text>
      </View>
    </View>
  );
}

const apresentacaoEstilos = StyleSheet.create({
  andamento: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pontos: { flexDirection: 'row', gap: 6 },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.gelo },
  pontoFeito: { backgroundColor: '#9FB1F0' },
  pontoAtivo: { width: 28, backgroundColor: cores.acao },
  posicao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  pagina: { paddingTop: 20 },
  titulo: { marginTop: 24 },
  texto: { fontSize: 18, lineHeight: 26 },
  acoes: { flexDirection: 'row' },
  metade: { flex: 1, minWidth: 0 },
  principalLargo: { flex: 1.9 },
  arte: { borderRadius: 28, overflow: 'hidden' },
  mini: { position: 'relative' },
  camada: { position: 'absolute', left: 0, top: 0 },
  pontinho: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(27, 42, 94, 0.24)' },
  noFace: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.2)' },
  oi: { position: 'absolute', paddingHorizontal: 14, paddingVertical: 6, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderBottomRightRadius: 16, borderBottomLeftRadius: 4, backgroundColor: cores.fundo },
  oiTexto: { color: cores.acao, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  tema: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 12, paddingVertical: 5,
    borderRadius: 999, backgroundColor: cores.fundo, borderBottomWidth: 3, borderBottomColor: 'rgba(27, 42, 94, 0.08)' },
  temaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 18 },
  etiqueta: { position: 'absolute', width: 96, alignItems: 'center', paddingVertical: 4, borderRadius: 10, borderWidth: 2,
    borderColor: cores.gelo, backgroundColor: cores.fundo },
  etiquetaTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14, borderRadius: 28, backgroundColor: cores.ceu },
  area: { width: '47.5%', flexGrow: 1, minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
    borderRadius: 18, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  areaEscolhida: { borderColor: cores.acao, borderBottomColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  areaAfundada: { borderBottomWidth: 2, marginTop: 3 },
  areaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20 },
  selo: { position: 'absolute', right: '5%', bottom: '7%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10,
    paddingRight: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: cores.fundo },
  seloTexto: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20 },
});
