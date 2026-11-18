import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAudioRecorderState, type AudioRecorder } from 'expo-audio';
import type { ApoioEstudo, PaginaMaterial } from '@studoo/contratos';
import { Icone } from './icone';
import { estilos, useMovimentoReduzido, LinhaAbrir, degrauFora } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';

/*
 * Cenas do estúdio no app, espelhando as rodadas 1.1–1.3 da web (docs/ui/DIRECAO-UI.md, Momentos 1–3): a ponte de
 * reforço como cena (margens, tábuas, cordas, água e a travessia do Stu), o Stu como aluno no "Ensine ao Stu", as ondas
 * pelo volume real do microfone, o caderno do retorno e o cartão de cada página do material. Só Views e Animated, sem
 * dependência nova. Com movimento reduzido, tudo aparece no estado final, parado.
 */

const m = mensagens.estudio;
const madeira = { face: '#9C5619', borda: '#703B10' };
const madeiraErro = { face: '#B54B14', borda: '#7D310A' };
const madeiraVencida = { face: '#2F7D22', borda: '#1E5916' };
const legendaPosta = { borda: '#9C5619', fundo: '#FFF7EE', texto: '#4B2809' };
const legendaErro = { borda: '#B54B14', fundo: '#FFF4EC', texto: '#4B2809' };
const legendaVencida = { borda: '#2F7D22', fundo: '#EEFAF0', texto: '#184A10' };
/** Durações da direção: tábua que entra (mola curta), escalonamento de 120 ms e a travessia, um momento raro. */
const ENTRADA_TABUA_MS = 360;
const ESCALONAMENTO_MS = 120;
const ESPERA_TRAVESSIA_MS = 380;
const TRAVESSIA_MS = 700;

/** Uma tábua da ponte: tracejada enquanto falta; ao entrar, cai no lugar com uma mola curta. */
function Tabua({ numero, ativa, erro, vencida, ordem, reduzir }: { numero: number; ativa: boolean; erro?: boolean; vencida: boolean; ordem: number; reduzir: boolean | null }) {
  const [entrada] = useState(() => new Animated.Value(ativa ? 1 : 0));
  useEffect(() => {
    if (!ativa) { entrada.setValue(0); return; }
    if (reduzir !== false) { entrada.setValue(1); return; }
    const animacao = Animated.timing(entrada, {
      toValue: 1, duration: ENTRADA_TABUA_MS, delay: ordem * ESCALONAMENTO_MS, easing: Easing.bezier(0.2, 0.9, 0.3, 1.3), useNativeDriver: true,
    });
    animacao.start();
    return () => animacao.stop();
  }, [ativa, reduzir, entrada, ordem]);
  const cor = vencida ? madeiraVencida : erro ? madeiraErro : madeira;
  // Como .ponte-tabua da web no celular: em pé, com o número; a que falta fica tracejada e meio apagada.
  return (
    <View testID={ativa ? (vencida ? 'tabua-vencida' : 'tabua-posta') : 'tabua-falta'} style={cena.tabuaLugar}>
      {!ativa && <View style={cena.tabuaFalta}><Text style={cena.tabuaNumero}>{numero}</Text></View>}
      {/* A tábua posta: face de 32 com borda de 2 que fecha em volta e o degrau de 4 por fora (box-shadow 0 4px 0 da web),
          que cobre a corda de baixo como no site (36 px à vista). */}
      {ativa && (
        <Animated.View style={[degrauFora(4, 10, cor.borda), {
          opacity: entrada.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        }]}>
          <View style={[cena.tabua, { backgroundColor: cor.face, borderColor: cor.borda }]}>
            <Text style={[cena.tabuaNumero, { color: cores.fundo }]}>{numero}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * A ponte de reforço como cena: a margem "Onde travou" (com o Stu), o vão com as cordas e quatro tábuas que entram
 * conforme a pessoa avança (a 1ª nasce da resposta errada; a 2ª e a 3ª chegam com o outro caminho e o novo exemplo; a 4ª
 * com o desafio) e a margem "De volta ao desafio". Ao vencer, as tábuas ficam verdes e o Stu atravessa, depois de a lição
 * trazer a cena para a vista (`aoMedir`). Embaixo, a legenda das tábuas com o texto de cada uma, legível no celular.
 */
export function CenaPonte({ resposta, primeiraTabua, temPonte, exemplo = temPonte, desafio, concluida, montada = false, semLegenda = false, aoMedir, estilo }: {
  /** Margens de fora (o cartão da ponte tira o vão do cartão, que a web não tem entre a cabeça e a cena). */
  estilo?: StyleProp<ViewStyle>;
  /** A resposta errada em texto legível (o texto da opção, não o código). */
  resposta: string;
  /** Texto da 1ª tábua sem resposta (a ilustração da apresentação usa "Sua tentativa", como as tábuas da web). */
  primeiraTabua?: string;
  temPonte: boolean;
  /** A 3ª tábua (o novo exemplo): na ponte em passos (rodada 4D da web), só entra com o "Ver exemplo". */
  exemplo?: boolean;
  desafio: boolean;
  concluida: boolean;
  /** A ponte já construída antes (releitura): as quatro tábuas verdes e o Stu do outro lado, sem travessia nova. */
  montada?: boolean;
  /** Sem a legenda das tábuas (a ponte construída, como a web no celular): a ação fica mais perto da cena. */
  semLegenda?: boolean;
  /** Onde a cena fica, a partir do topo do cartão, para a lição rolar até ela antes da travessia. */
  aoMedir?: (y: number, altura: number) => void;
}) {
  const reduzir = useMovimentoReduzido();
  const vencida = concluida || montada;
  const [travessia] = useState(() => new Animated.Value(vencida ? 1 : 0));
  useEffect(() => {
    if (montada) { travessia.setValue(1); return; }
    if (!concluida) { travessia.setValue(0); return; }
    if (reduzir !== false) { travessia.setValue(1); return; }
    const animacao = Animated.timing(travessia, {
      toValue: 1, duration: TRAVESSIA_MS, delay: ESPERA_TRAVESSIA_MS, easing: Easing.bezier(0.2, 0.9, 0.3, 1.2), useNativeDriver: true,
    });
    animacao.start();
    return () => animacao.stop();
  }, [concluida, montada, reduzir, travessia]);
  // Como a legenda da web (rodada 3A): a tentativa inteira, cortada só depois de 80 caracteres.
  const tentativa = resposta.length > 80 ? `${resposta.slice(0, 79).trimEnd()}…` : resposta;
  const passos = [
    { texto: tentativa ? m.pontePassoErro(tentativa) : (primeiraTabua ?? m.ponteMargemErro), ativa: true, erro: true },
    { texto: m.pontePassoExplicacao, ativa: temPonte || montada },
    { texto: m.pontePassoExemplo, ativa: (temPonte && exemplo) || montada },
    { texto: m.pontePassoDesafio, ativa: desafio || vencida },
  ];
  // O Stu sai do centro da margem esquerda e para no centro da direita (as margens têm a largura do texto, como na web).
  const [margens, setMargens] = useState<{ esquerda: { x: number; largura: number } | null; direita: { x: number; largura: number } | null }>({ esquerda: null, direita: null });
  const distancia = margens.esquerda && margens.direita
    ? Math.max(0, margens.direita.x + margens.direita.largura / 2 - (margens.esquerda.x + margens.esquerda.largura / 2)) : 0;

  return (
    <View style={estilo} onLayout={(evento) => aoMedir?.(evento.nativeEvent.layout.y, evento.nativeEvent.layout.height)}>
      {/* Como .ponte-cena da web no celular: céu, água a partir de 66% com as faixas claras no pé, margens e o vão. */}
      <View testID="cena-ponte" style={cena.cena} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={cena.agua} />
        <View style={cena.faixas}>{Array.from({ length: 14 }, (_, indice) => <View key={indice} style={cena.faixa} />)}</View>
        <View style={cena.linha}>
          <View style={[cena.margem, cena.margemEsquerda]}
            onLayout={(evento) => { const { x, width } = evento.nativeEvent.layout; setMargens((antes) => ({ ...antes, esquerda: { x, largura: width } })); }}>
            <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
              style={[cena.stu, { transform: [
                { translateX: travessia.interpolate({ inputRange: [0, 1], outputRange: [0, distancia] }) },
                { translateY: travessia.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -12, 0] }) },
              ] }]} />
            <Text style={cena.margemTexto}>{m.ponteMargemErro}</Text>
          </View>
          <View style={cena.vao}>
            {/* As cordas vêm antes das tábuas: as tábuas (z-index 1 na web) passam por cima delas. */}
            <View style={[cena.trilho, { top: 2 }]} />
            <View style={[cena.trilho, { bottom: 2 }]} />
            {passos.map((passo, indice) => (
              <Tabua key={indice} numero={indice + 1} ativa={passo.ativa} erro={passo.erro} vencida={vencida} reduzir={reduzir}
                ordem={indice === 0 ? 0 : indice === 3 ? 0 : indice - 1} />
            ))}
          </View>
          <View style={[cena.margem, cena.margemDireita]}
            onLayout={(evento) => { const { x, width } = evento.nativeEvent.layout; setMargens((antes) => ({ ...antes, direita: { x, largura: width } })); }}>
            <View style={cena.lugarStu} />
            <Text style={[cena.margemTexto, { color: '#184A10' }]}>{m.ponteMargemVolta}</Text>
          </View>
        </View>
      </View>
      {/* Como .ponte-legenda da web: duas colunas; o número num círculo; a tábua posta com borda cheia, a que falta tracejada. */}
      {!semLegenda && <View style={cena.legenda} accessible accessibilityLabel={passos.filter((passo) => passo.ativa).map((passo) => passo.texto).join('. ')}>
        {passos.map((passo, indice) => {
          const cor = vencida && passo.ativa ? legendaVencida : passo.erro ? legendaErro : legendaPosta;
          return (
            <View key={indice} style={[cena.passo, passo.ativa ? { borderStyle: 'solid', borderColor: cor.borda, backgroundColor: cor.fundo } : null]}>
              <View style={[cena.passoNumero, passo.ativa && { backgroundColor: cor.borda }]}>
                <Text style={[cena.passoNumeroTexto, passo.ativa && { color: cores.fundo }]}>{indice + 1}</Text>
              </View>
              <Text style={[cena.passoTexto, passo.ativa && { color: cor.texto }]}>{passo.texto}</Text>
            </View>
          );
        })}
      </View>}
    </View>
  );
}

/**
 * O Stu como aluno no "Ensine ao Stu": com dúvida, ouvindo (balança devagar enquanto grava ou na conversa ao vivo), falando
 * (na conversa ao vivo, sobe e desce de leve, como .ensino-stu[data-falando] da web) ou anotando o retorno. Na conversa ao
 * vivo, o balão diz o estado dela (`fala`), como a web.
 */
export function StuAluno({ estado, fala: falaDaConversa }: { estado: 'aluno' | 'ouvindo' | 'falando' | 'anotou'; fala?: string }) {
  const reduzir = useMovimentoReduzido();
  const [balanco] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if ((estado !== 'ouvindo' && estado !== 'falando') || reduzir !== false) { balanco.setValue(0); return; }
    // 700 ms para cada lado nos dois casos (o balanço da gravação e o stuFalando da web, 0,7 s com alternate).
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(balanco, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(balanco, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => { ciclo.stop(); balanco.setValue(0); };
  }, [estado, reduzir, balanco]);
  const fala = falaDaConversa ?? (estado === 'ouvindo' ? m.ensinoStuOuvindo : estado === 'anotou' ? m.ensinoStuAnotou : m.ensinoStuAluno);
  const movimento = estado === 'falando'
    // @keyframes stuFalando: de translateY(0) scale(1) a translateY(-2px) scale(1.04), 0,7 s, ida e volta.
    ? [{ translateY: balanco.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }, { scale: balanco.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }]
    : [{ rotate: balanco.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) }];
  // Como .ensino-stu da web: uma caixa com borda e fundo névoa, o Stu de 52 px e a fala em 16 px/800 ao lado; ouvindo (gravação
  // ou conversa), a borda fica azul e o fundo azul-claro (data-gravando).
  const ouvindo = estado === 'ouvindo';
  return (
    <View style={[aluno.caixa, ouvindo && aluno.caixaOuvindo]}>
      <View style={aluno.avatar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
          style={[aluno.stu, { transform: movimento }]} />
      </View>
      <Text accessibilityLiveRegion="polite" style={aluno.fala}>{fala}</Text>
    </View>
  );
}

/**
 * As três etapas do "Ensine ao Stu": a atual em destaque (1. gravar ou escrever, 2. revisar, 3. ver o retorno). Com a voz
 * ao vivo liberada, a primeira vira "1. Conversar, gravar ou escrever" (`primeira`), como na web.
 */
export function EtapasDoEnsino({ ativa, primeira }: { ativa: 0 | 1 | 2; primeira?: string }) {
  const etapas = primeira ? [primeira, m.ensinoEtapas[1], m.ensinoEtapas[2]] : [...m.ensinoEtapas];
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${m.ensinoEtapasLabel}: ${etapas[ativa]}`} style={aluno.etapas}>
      {etapas.map((etapa, indice) => (
        <View key={etapa} style={[aluno.etapa, indice === ativa && aluno.etapaAtiva]}>
          <Text style={[aluno.etapaTexto, indice === ativa && { color: cores.acao }]}>{etapa}</Text>
        </View>
      ))}
    </View>
  );
}

const PESOS_ONDA = [0.55, 0.85, 1, 0.8, 0.5];
/**
 * Cinco barras que sobem com o volume real do microfone: o metering do expo-audio (dBFS, de cerca de -60 a 0) vira de
 * 0 a 1 e cada barra fica entre 28% e 100% dos 32 px, como o scaleY da web (max(0,28, min(1, nível))). Sem metering
 * (aparelho que não informa), as barras ficam cheias, como a web sem Web Audio. Como na web, o movimento reduzido só tira a
 * transição: as barras continuam seguindo a voz (aqui não há transição, a altura muda a cada leitura).
 */
export function OndasDoVolume({ gravador }: { gravador: AudioRecorder }) {
  const estado = useAudioRecorderState(gravador, 100);
  const nivel = typeof estado.metering === 'number' ? Math.max(0, Math.min(1, (estado.metering + 60) / 60)) : null;
  return (
    <View testID="ondas-volume" style={aluno.ondas} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {PESOS_ONDA.map((peso, indice) => (
        <View key={indice} style={[aluno.barra, { height: nivel === null ? 32 : Math.round(32 * Math.max(0.28, Math.min(1, nivel * peso))) }]} />
      ))}
    </View>
  );
}

/**
 * O retorno do "Ensine ao Stu" em quatro cartões, como o caderno da web: o que fez sentido (com o visto), o que revisar,
 * a pergunta do Stu para outra situação, em destaque, e o próximo passo. Sem a IA, a nota do retorno automático no pé.
 */
export function CadernoDoStu({ ensino, compacto = false }: {
  ensino: NonNullable<ApoioEstudo['ensino']>;
  /** Cartões menores, para a ilustração da apresentação (como `.apresentacao-caderno` da web no celular). */
  compacto?: boolean;
}) {
  // Os parágrafos do caderno estão dentro de .estudio-card na web: entrelinha de 1,6.
  const texto = [estilos.texto, caderno.textoCartao, compacto && caderno.textoCompacto];
  const cartao = [caderno.cartao, compacto && caderno.cartaoCompacto];
  const titulo = [caderno.titulo, compacto && caderno.tituloCompacto];
  return (
    <View testID="caderno-do-stu" style={[caderno.lista, compacto && { gap: 8 }]} accessibilityLiveRegion="polite">
      <View style={[cartao, caderno.acertos]}>
        <Text accessibilityRole="header" style={titulo}>{m.acertos}</Text>
        {ensino.acertos.map((acerto, indice) => (
          <View key={indice} style={caderno.item}>
            {/* O visto fica em 13 px também no compacto, como .ensino-caderno__visto na apresentação da web. */}
            <Text style={caderno.visto} importantForAccessibility="no">✓</Text>
            <Text style={[texto, { flex: 1 }]}>{acerto}</Text>
          </View>
        ))}
      </View>
      <View style={[cartao, caderno.lacuna]}>
        <Text accessibilityRole="header" style={titulo}>{m.lacuna}</Text>
        <Text style={texto}>{ensino.lacuna}</Text>
      </View>
      {/* .ensino-caderno__pergunta: o único com degrau (0 4px 0 gelo, por fora); o Stu fica no meio da altura do cartão. */}
      <View style={degrauFora(4, compacto ? 16 : 16, cores.gelo)}>
      <View style={[cartao, caderno.pergunta]}>
        <View style={[caderno.perguntaStu, compacto && caderno.perguntaStuCompacto]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" style={[caderno.stu, compacto && caderno.stuCompacto]} />
          <View style={caderno.duvida}><Text style={caderno.duvidaTexto}>?</Text></View>
        </View>
        <View style={{ flex: 1, gap: compacto ? 2 : 6 }}>
          <Text accessibilityRole="header" style={titulo}>{m.pergunta}</Text>
          <Text style={[caderno.perguntaTexto, compacto && caderno.textoCompacto]}>{ensino.pergunta}</Text>
        </View>
      </View>
      </View>
      <View style={[cartao, caderno.proximo]}>
        <Text accessibilityRole="header" style={titulo}>{m.proximo}</Text>
        <Text style={texto}>{ensino.proximoPasso}</Text>
      </View>
      {ensino.simulado && <Text style={[estilos.legenda, { marginTop: compacto ? 0 : 12 }, compacto && { textAlign: 'center' }]}>{m.ensinoAutomatico}</Text>}
    </View>
  );
}

/**
 * A miniatura da página como .estudio-pagina-thumb da web: até 140 de altura, a largura que a proporção da imagem pede (sem
 * esticar até a borda do cartão), borda de 1 em gelo e raio de 10; se a largura não couber, a imagem é cortada (cover).
 */
function MiniaturaDaPagina({ uri, rotulo }: { uri: string; rotulo: string }) {
  const [tamanho, setTamanho] = useState<{ largura: number; altura: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    Image.getSize(uri, (largura, altura) => { if (vivo && largura > 0 && altura > 0) setTamanho({ largura, altura }); }, () => {});
    return () => { vivo = false; };
  }, [uri]);
  const altura = tamanho ? Math.min(140, tamanho.altura) : 140;
  const proporcao = tamanho ? tamanho.largura / tamanho.altura : 16 / 9;
  return <Image source={{ uri }} resizeMode="cover" accessibilityLabel={rotulo} style={[paginas.miniatura, { height: altura, aspectRatio: proporcao }]} />;
}

/**
 * Uma página do material em cartão, como na web: o rótulo (página, parágrafos ou linhas), a miniatura da foto, a tabela
 * do CSV (que rola para o lado) ou as primeiras linhas do texto, com "Ver texto completo".
 */
export function PaginaDoMaterial({ pagina }: { pagina: PaginaMaterial }) {
  const [aberta, setAberta] = useState(false);
  const rotulo = pagina.rotulo ?? m.pagina(pagina.numero);
  const longa = pagina.texto.length > 180;
  return (
    <View testID={`pagina-material-${pagina.numero}`} style={paginas.cartao}>
      <Text accessibilityRole="header" style={paginas.rotulo}>{rotulo}</Text>
      {pagina.imagem && <MiniaturaDaPagina uri={pagina.imagem} rotulo={rotulo} />}
      {pagina.tabela ? (
        <ScrollView horizontal accessibilityLabel={`${m.tabela} · ${rotulo}`} contentContainerStyle={{ paddingBottom: 4 }}>
          <View>
            {pagina.tabela.map((linha, indice) => (
              <View key={indice} style={[paginas.linha, indice === 0 && paginas.cabecalho]}>
                <Text style={[paginas.celula, paginas.numero]}>{(pagina.numero - 1) * 40 + indice + 1}</Text>
                {linha.map((celula, coluna) => <Text key={coluna} selectable style={paginas.celula}>{celula}</Text>)}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <>
          <Text selectable numberOfLines={aberta ? undefined : 3} style={paginas.previa}>{pagina.texto}</Text>
          {longa && <LinhaAbrir rotulo={m.paginaExpandir} aberto={aberta} alternar={() => setAberta((atual) => !atual)} />}
        </>
      )}
    </View>
  );
}

const cena = StyleSheet.create({
  // Medidas de .ponte-cena, .ponte-margem, .ponte-vao, .ponte-tabua e .ponte-legenda da web até 600 px.
  cena: { position: 'relative', marginTop: 10, marginBottom: 12, paddingTop: 10, paddingHorizontal: 8, paddingBottom: 12, borderRadius: 20,
    borderWidth: 2, borderColor: '#B8D7F5', backgroundColor: '#EAF4FF', overflow: 'hidden' },
  agua: { position: 'absolute', left: 0, right: 0, top: '66%', bottom: 0, backgroundColor: '#9ED3FA' },
  faixas: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, flexDirection: 'row', gap: 18 },
  faixa: { width: 18, height: 12, backgroundColor: 'rgba(255,255,255,0.35)' },
  linha: { position: 'relative', flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  margem: { position: 'relative', zIndex: 1, minWidth: 58, alignItems: 'center', gap: 4, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 5,
    borderRadius: 12, borderWidth: 2, borderTopWidth: 6, borderBottomWidth: 5, borderColor: '#76BF43', borderTopColor: '#58CC02',
    borderBottomColor: '#5B9A30', backgroundColor: '#F6FBF1' },
  margemEsquerda: { zIndex: 2 },
  margemDireita: { borderColor: '#46A302', borderTopColor: '#58CC02', borderBottomColor: '#3B8A02', backgroundColor: '#ECF9E3' },
  lugarStu: { width: 32, height: 32 },
  margemTexto: { color: '#1F3D14', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 11, lineHeight: 14, textAlign: 'center' },
  vao: { position: 'relative', flex: 1, alignSelf: 'center', flexDirection: 'row', gap: 4, paddingVertical: 6 },
  trilho: { position: 'absolute', left: -8, right: -8, height: 3, borderRadius: 2, backgroundColor: '#8D5C2C' },
  tabuaLugar: { flex: 1, minHeight: 32 },
  tabuaFalta: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: '#9D7349',
    borderRadius: 10, backgroundColor: 'rgba(255,250,242,0.88)', opacity: 0.85 },
  tabua: { minHeight: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 10 },
  tabuaNumero: { color: '#4B2F15', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 15 },
  stu: { zIndex: 3, width: 32, height: 32 },
  // A legenda no tamanho base em qualquer largura (bf8cf37): grade 2×2 com vão de 8 e 16 embaixo (o cartão já põe 14).
  legenda: { marginBottom: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // .ponte-legenda li e __num da web: 13 px, respiro de 8 × 10, número de 22 px em 12 px.
  passo: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#C8B69F', backgroundColor: '#FBF8F3' },
  passoNumero: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5D8C8' },
  passoNumeroTexto: { color: '#4B2F15', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 18 },
  passoTexto: { flex: 1, color: '#5A432C', fontFamily: fontes.corpo, fontWeight: '700', fontSize: 13, lineHeight: 19.5 },
});

const aluno = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // .ensino-stu: flex, gap 14, respiro 12 × 16, borda 2 #E1E7FA, raio 18, fundo névoa; .ensino-stu .stu: 52 px de largura.
  caixa: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderColor: cores.gelo,
    borderRadius: 18, backgroundColor: cores.nevoa },
  caixaOuvindo: { borderColor: cores.acao, backgroundColor: '#EEF3FF' },
  fala: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 25.6 },
  avatar: { width: 52, alignItems: 'center', justifyContent: 'center' },
  stu: { width: 52, height: 58 },
  adereco: { position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.ouroEscuro, borderWidth: 2, borderColor: cores.fundo },
  aderecoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 16 },
  balao: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoSeta: { position: 'absolute', left: -7, top: '50%', marginTop: -6, width: 12, height: 12, backgroundColor: cores.fundo, borderLeftWidth: 2,
    borderBottomWidth: 2, borderColor: cores.gelo, transform: [{ rotate: '45deg' }] },
  balaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 21 },
  etapas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  etapa: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1.5, borderColor: cores.gelo },
  etapaAtiva: { borderColor: cores.acao, backgroundColor: '#EEF3FF' },
  etapaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 19 },
  // Como .ensino-ondas da web: cinco barras de 6 × 32 com vão de 5; sem o volume (aparelho que não informa), cheias.
  ondas: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36 },
  barra: { width: 6, borderRadius: 3, backgroundColor: cores.acao },
});

const caderno = StyleSheet.create({
  lista: { gap: 12 },
  // .ensino-caderno__cartao: 14 × 16 de respiro, borda de 2 em volta (sem degrau) e raio de 16.
  cartao: { paddingVertical: 14, paddingHorizontal: 16, gap: 6, borderRadius: 16, borderWidth: 2 },
  acertos: { borderColor: cores.gelo, backgroundColor: '#F1F4FD' },
  lacuna: { borderColor: '#F2CF96', backgroundColor: '#FFFAF0' },
  pergunta: { flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: '#C3CDF2', backgroundColor: '#EEF3FF' },
  proximo: { borderColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // .ensino-caderno__visto: círculo de 22 em #EEFAF3 com o visto de 13 px em 900.
  visto: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', backgroundColor: '#EEFAF3', color: cores.sucesso,
    fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 22 },
  // .ensino-caderno__stu: 48 de largura com o Stu de 44; o "?" é um círculo de 20 sem aro.
  perguntaStu: { width: 48, height: 50, justifyContent: 'center' },
  stu: { width: 44, height: 50 },
  duvida: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.acao },
  duvidaTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 15 },
  perguntaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 25.6 },
  textoCartao: { lineHeight: 25.6 },
  // Compacto (apresentação): como a web no celular, 8 × 10 de respiro, título de 12 e texto de 14.
  cartaoCompacto: { paddingVertical: 8, paddingHorizontal: 10, gap: 2, borderRadius: 16 },
  tituloCompacto: { fontSize: 12, lineHeight: 16 },
  textoCompacto: { fontSize: 14, lineHeight: 19 },
  perguntaStuCompacto: { width: 32, height: 36 },
  stuCompacto: { width: 30, height: 33 },
});

const paginas = StyleSheet.create({
  cartao: { gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2, borderColor: cores.gelo, backgroundColor: '#F8FAFF' },
  rotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21 },
  previa: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 24 },
  // .estudio-pagina-thumb: até 140 de altura, cantos de 10 e borda de 1.
  miniatura: { alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 10, borderWidth: 1, borderColor: cores.gelo },
  linha: { flexDirection: 'row' },
  cabecalho: { backgroundColor: cores.nevoa },
  celula: { width: 132, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: cores.gelo, color: cores.texto, fontFamily: fontes.corpo,
    fontSize: 14, lineHeight: 20 },
  numero: { width: 48, textAlign: 'center', color: cores.textoSecundario, fontWeight: '800' },
});
