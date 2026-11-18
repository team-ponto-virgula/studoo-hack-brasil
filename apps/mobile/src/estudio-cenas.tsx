import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioRecorderState, type AudioRecorder } from 'expo-audio';
import type { ApoioEstudo, PaginaMaterial } from '@studoo/contratos';
import { Icone } from './icone';
import { estilos, useMovimentoReduzido } from './interface';
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
/** Durações da direção: tábua que entra (mola curta), escalonamento de 120 ms e a travessia, um momento raro. */
const ENTRADA_TABUA_MS = 360;
const ESCALONAMENTO_MS = 120;
const ESPERA_TRAVESSIA_MS = 380;
const TRAVESSIA_MS = 700;

/** Uma tábua da ponte: tracejada enquanto falta; ao entrar, cai no lugar com uma mola curta. */
function Tabua({ ativa, erro, vencida, ordem, reduzir }: { ativa: boolean; erro?: boolean; vencida: boolean; ordem: number; reduzir: boolean | null }) {
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
  return (
    <View style={cena.tabuaLugar}>
      {!ativa && <View style={cena.tabuaFalta} />}
      {ativa && (
        <Animated.View style={[cena.tabua, { backgroundColor: cor.face, borderColor: cor.borda }, {
          opacity: entrada.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
        }]}>
          <View style={cena.tabuaVeio} />
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
export function CenaPonte({ resposta, temPonte, desafio, concluida, aoMedir }: {
  /** A resposta errada em texto legível (o texto da opção, não o código). */
  resposta: string;
  temPonte: boolean;
  desafio: boolean;
  concluida: boolean;
  /** Onde a cena fica, a partir do topo do cartão, para a lição rolar até ela antes da travessia. */
  aoMedir?: (y: number, altura: number) => void;
}) {
  const reduzir = useMovimentoReduzido();
  const [largura, setLargura] = useState(0);
  const [travessia] = useState(() => new Animated.Value(concluida ? 1 : 0));
  useEffect(() => {
    if (!concluida) { travessia.setValue(0); return; }
    if (reduzir !== false) { travessia.setValue(1); return; }
    const animacao = Animated.timing(travessia, {
      toValue: 1, duration: TRAVESSIA_MS, delay: ESPERA_TRAVESSIA_MS, easing: Easing.bezier(0.2, 0.9, 0.3, 1.2), useNativeDriver: true,
    });
    animacao.start();
    return () => animacao.stop();
  }, [concluida, reduzir, travessia]);
  const tentativa = resposta.length > 24 ? `${resposta.slice(0, 23).trimEnd()}…` : resposta;
  const passos = [
    { texto: tentativa ? m.pontePassoErro(tentativa) : m.ponteMargemErro, ativa: true, erro: true },
    { texto: m.pontePassoExplicacao, ativa: temPonte },
    { texto: m.pontePassoExemplo, ativa: temPonte },
    { texto: m.pontePassoDesafio, ativa: desafio || concluida },
  ];
  // O Stu sai do centro da margem esquerda e para no centro da direita (as margens têm 74 de largura).
  const distancia = Math.max(0, largura - MARGEM);

  return (
    <View onLayout={(evento) => aoMedir?.(evento.nativeEvent.layout.y, evento.nativeEvent.layout.height)}>
      <View testID="cena-ponte" style={cena.cena} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={cena.agua}>
          <View style={[cena.onda, { left: '8%' }]} /><View style={[cena.onda, { left: '42%' }]} /><View style={[cena.onda, { left: '74%' }]} />
        </View>
        <View style={cena.linha} onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}>
          <View style={cena.margem}>
            <View style={cena.margemTopo} />
            <View style={cena.lugarStu} />
            <Text style={cena.margemTexto}>{m.ponteMargemErro}</Text>
          </View>
          <View style={cena.vao}>
            <View style={[cena.corda, { top: 6 }]} />
            <View style={cena.tabuas}>
              {passos.map((passo, indice) => (
                <Tabua key={indice} ativa={passo.ativa} erro={passo.erro} vencida={concluida} reduzir={reduzir}
                  ordem={indice === 0 ? 0 : indice === 3 ? 0 : indice - 1} />
              ))}
            </View>
            <View style={[cena.corda, { bottom: 18 }]} />
          </View>
          <View style={[cena.margem, cena.margemDireita]}>
            <View style={[cena.margemTopo, cena.margemTopoDireita]} />
            <View style={cena.lugarStu} />
            <Text style={[cena.margemTexto, { color: '#184A10' }]}>{m.ponteMargemVolta}</Text>
          </View>
          {/* O Stu atravessa por cima da ponte, com um pulinho no meio do caminho. */}
          <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            style={[cena.stu, { transform: [
              { translateX: travessia.interpolate({ inputRange: [0, 1], outputRange: [0, distancia] }) },
              { translateY: travessia.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -12, 0] }) },
            ] }]} />
        </View>
      </View>
      <View style={cena.legenda} accessible accessibilityLabel={passos.filter((passo) => passo.ativa).map((passo) => passo.texto).join('. ')}>
        {passos.map((passo, indice) => {
          const cor = concluida && passo.ativa ? madeiraVencida : passo.erro ? madeiraErro : madeira;
          return (
            <View key={indice} style={[cena.passo, passo.ativa ? { backgroundColor: cor.face, borderColor: cor.borda } : cena.passoFalta]}>
              <Text style={[cena.passoNumero, !passo.ativa && { color: '#9D7349' }]}>{indice + 1}</Text>
              <Text numberOfLines={2} style={[cena.passoTexto, !passo.ativa && { color: '#7A5A3A' }]}>{passo.texto}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const MARGEM = 74;

/** O Stu como aluno no "Ensine ao Stu": com dúvida, ouvindo (balança devagar enquanto grava) ou anotando o retorno. */
export function StuAluno({ estado }: { estado: 'aluno' | 'ouvindo' | 'anotou' }) {
  const reduzir = useMovimentoReduzido();
  const [balanco] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (estado !== 'ouvindo' || reduzir !== false) { balanco.setValue(0); return; }
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(balanco, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(balanco, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => { ciclo.stop(); balanco.setValue(0); };
  }, [estado, reduzir, balanco]);
  const fala = estado === 'ouvindo' ? m.ensinoStuOuvindo : estado === 'anotou' ? m.ensinoStuAnotou : m.ensinoStuAluno;
  return (
    <View style={aluno.linha}>
      <View style={aluno.avatar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
          style={[aluno.stu, { transform: [{ rotate: balanco.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) }] }]} />
        <View style={[aluno.adereco, estado === 'anotou' && { backgroundColor: cores.sucesso }, estado === 'ouvindo' && { backgroundColor: cores.acao }]}>
          {estado === 'anotou' ? <Icone nome="check" tamanho={12} cor={cores.fundo} />
            : estado === 'ouvindo' ? <Icone nome="som" tamanho={12} cor={cores.fundo} />
              : <Text style={aluno.aderecoTexto}>?</Text>}
        </View>
      </View>
      <View style={aluno.balao}>
        <View style={aluno.balaoSeta} />
        <Text accessibilityLiveRegion="polite" style={aluno.balaoTexto}>{fala}</Text>
      </View>
    </View>
  );
}

/** As três etapas do "Ensine ao Stu": a atual em destaque (1. gravar ou escrever, 2. revisar, 3. ver o retorno). */
export function EtapasDoEnsino({ ativa }: { ativa: 0 | 1 | 2 }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={`${m.ensinoEtapasLabel}: ${m.ensinoEtapas[ativa]}`} style={aluno.etapas}>
      {m.ensinoEtapas.map((etapa, indice) => (
        <View key={etapa} style={[aluno.etapa, indice === ativa && aluno.etapaAtiva, indice < ativa && aluno.etapaFeita]}>
          <Text style={[aluno.etapaTexto, indice === ativa && { color: cores.fundo }, indice < ativa && { color: cores.sucesso }]}>{etapa}</Text>
        </View>
      ))}
    </View>
  );
}

const PESOS_ONDA = [0.55, 0.85, 1, 0.8, 0.5];
/**
 * Cinco barras que sobem com o volume real do microfone: o metering do expo-audio (dBFS, de cerca de -60 a 0) vira de
 * 0 a 1. Sem metering (aparelho que não informa), as barras ficam na altura de repouso. Com movimento reduzido, paradas.
 */
export function OndasDoVolume({ gravador }: { gravador: AudioRecorder }) {
  const reduzir = useMovimentoReduzido();
  const estado = useAudioRecorderState(gravador, 100);
  const nivel = reduzir === false && typeof estado.metering === 'number' ? Math.max(0, Math.min(1, (estado.metering + 60) / 60)) : null;
  return (
    <View testID="ondas-volume" style={aluno.ondas} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {PESOS_ONDA.map((peso, indice) => (
        <View key={indice} style={[aluno.barra, { height: nivel === null ? 12 : 8 + Math.round(30 * nivel * peso) }]} />
      ))}
    </View>
  );
}

/**
 * O retorno do "Ensine ao Stu" em quatro cartões, como o caderno da web: o que fez sentido (com o visto), o que revisar,
 * a pergunta do Stu para outra situação, em destaque, e o próximo passo. Sem a IA, a nota do retorno automático no pé.
 */
export function CadernoDoStu({ ensino }: { ensino: NonNullable<ApoioEstudo['ensino']> }) {
  return (
    <View testID="caderno-do-stu" style={caderno.lista} accessibilityLiveRegion="polite">
      <View style={[caderno.cartao, caderno.acertos]}>
        <Text accessibilityRole="header" style={caderno.titulo}>{m.acertos}</Text>
        {ensino.acertos.map((acerto, indice) => (
          <View key={indice} style={caderno.item}>
            <Text style={caderno.visto} importantForAccessibility="no">✓</Text>
            <Text style={[estilos.texto, { flex: 1 }]}>{acerto}</Text>
          </View>
        ))}
      </View>
      <View style={[caderno.cartao, caderno.lacuna]}>
        <Text accessibilityRole="header" style={caderno.titulo}>{m.lacuna}</Text>
        <Text style={estilos.texto}>{ensino.lacuna}</Text>
      </View>
      <View style={[caderno.cartao, caderno.pergunta]}>
        <View style={caderno.perguntaStu} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" style={caderno.stu} />
          <View style={caderno.duvida}><Text style={caderno.duvidaTexto}>?</Text></View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text accessibilityRole="header" style={[caderno.titulo, { color: cores.acao }]}>{m.pergunta}</Text>
          <Text style={caderno.perguntaTexto}>{ensino.pergunta}</Text>
        </View>
      </View>
      <View style={[caderno.cartao, caderno.proximo]}>
        <Text accessibilityRole="header" style={[caderno.titulo, { color: cores.sucesso }]}>{m.proximo}</Text>
        <Text style={estilos.texto}>{ensino.proximoPasso}</Text>
      </View>
      {ensino.simulado && <Text style={estilos.legenda}>{m.ensinoAutomatico}</Text>}
    </View>
  );
}

/**
 * Uma página do material em cartão, como na web: o rótulo (página, parágrafos ou linhas), a miniatura da foto, a tabela
 * do CSV (que rola para o lado) ou as primeiras linhas do texto, com "Ver texto completo".
 */
export function PaginaDoMaterial({ pagina }: { pagina: PaginaMaterial }) {
  const [aberta, setAberta] = useState(false);
  const rotulo = pagina.rotulo ?? m.pagina(pagina.numero);
  const longa = pagina.texto.length > 220;
  return (
    <View testID={`pagina-material-${pagina.numero}`} style={paginas.cartao}>
      <Text accessibilityRole="header" style={paginas.rotulo}>{rotulo}</Text>
      {pagina.imagem && (
        <Image source={{ uri: pagina.imagem }} resizeMode="contain" accessibilityLabel={rotulo} style={paginas.miniatura} />
      )}
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
          <Text selectable numberOfLines={aberta ? undefined : 4} style={estilos.texto}>{pagina.texto}</Text>
          {longa && (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberta }} hitSlop={8} onPress={() => setAberta((atual) => !atual)}
              style={paginas.expandir}>
              <View style={{ transform: [{ rotate: aberta ? '-90deg' : '90deg' }] }}><Icone nome="seta" tamanho={14} cor={cores.acao} /></View>
              <Text style={paginas.expandirTexto}>{aberta ? mensagens.licao.recursos.esconder : m.paginaExpandir}</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const cena = StyleSheet.create({
  cena: { position: 'relative', marginTop: 14, paddingTop: 16, paddingBottom: 30, paddingHorizontal: 10, borderRadius: 20, borderWidth: 2,
    borderColor: '#B8D7F5', backgroundColor: '#EAF4FF', overflow: 'hidden' },
  agua: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 48, backgroundColor: '#9ED3FA' },
  onda: { position: 'absolute', top: 14, width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.55)' },
  linha: { position: 'relative', flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  margem: { width: MARGEM, minHeight: 92, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 6, paddingBottom: 8, borderRadius: 12,
    borderWidth: 2, borderBottomWidth: 4, borderColor: '#76BF43', borderBottomColor: '#5B9A30', backgroundColor: '#F6FBF1', overflow: 'hidden' },
  margemDireita: { borderColor: '#46A302', borderBottomColor: '#3B8A02', backgroundColor: '#ECF9E3' },
  margemTopo: { position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: '#58CC02' },
  margemTopoDireita: { backgroundColor: '#58CC02' },
  lugarStu: { height: 46 },
  margemTexto: { color: '#1F3D14', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 11, lineHeight: 14, textAlign: 'center' },
  vao: { flex: 1, height: 70, justifyContent: 'flex-end', paddingBottom: 22 },
  corda: { position: 'absolute', left: -8, right: -8, height: 3, borderRadius: 2, backgroundColor: '#8D5C2C' },
  tabuas: { flexDirection: 'row', gap: 4 },
  tabuaLugar: { flex: 1, height: 20 },
  tabuaFalta: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#9D7349', borderRadius: 6, backgroundColor: 'rgba(255,250,242,0.7)' },
  tabua: { flex: 1, borderWidth: 2, borderBottomWidth: 4, borderRadius: 6, justifyContent: 'center' },
  tabuaVeio: { marginHorizontal: 4, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  stu: { position: 'absolute', left: (MARGEM - 40) / 2, bottom: 36, width: 40, height: 44 },
  legenda: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  passo: { flexBasis: '48%', flexGrow: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, borderWidth: 2, borderBottomWidth: 4 },
  passoFalta: { borderStyle: 'dashed', borderColor: '#9D7349', borderBottomWidth: 2, backgroundColor: '#FFFAF2' },
  passoNumero: { color: 'rgba(255,255,255,0.85)', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18 },
  passoTexto: { flex: 1, color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 17 },
});

const aluno = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 56, height: 60, alignItems: 'center', justifyContent: 'center' },
  stu: { width: 50, height: 56 },
  adereco: { position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.ouroEscuro, borderWidth: 2, borderColor: cores.fundo },
  aderecoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 16 },
  balao: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoSeta: { position: 'absolute', left: -7, top: '50%', marginTop: -6, width: 12, height: 12, backgroundColor: cores.fundo, borderLeftWidth: 2,
    borderBottomWidth: 2, borderColor: cores.gelo, transform: [{ rotate: '45deg' }] },
  balaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 21 },
  etapas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  etapa: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  etapaAtiva: { borderColor: cores.acao, backgroundColor: cores.acao },
  etapaFeita: { borderColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  etapaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16 },
  ondas: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40 },
  barra: { width: 6, borderRadius: 3, backgroundColor: cores.acao },
});

const caderno = StyleSheet.create({
  lista: { gap: 12 },
  cartao: { padding: 14, gap: 6, borderRadius: 18, borderWidth: 2, borderBottomWidth: 4 },
  acertos: { borderColor: cores.gelo, backgroundColor: '#F1F4FD' },
  lacuna: { borderColor: '#F2CF96', backgroundColor: '#FFFAF0' },
  pergunta: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderColor: '#C3CDF2', backgroundColor: '#EEF3FF' },
  proximo: { borderColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  visto: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 16, lineHeight: 24 },
  perguntaStu: { width: 44, height: 48 },
  stu: { width: 40, height: 44 },
  duvida: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.acao, borderWidth: 2, borderColor: cores.fundo },
  duvidaTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 15 },
  perguntaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 17, lineHeight: 25 },
});

const paginas = StyleSheet.create({
  cartao: { gap: 10, padding: 14, borderRadius: 18, borderWidth: 2, borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: cores.fundo },
  rotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18 },
  miniatura: { width: '100%', height: 132, borderRadius: 12, backgroundColor: '#FFF8E8' },
  linha: { flexDirection: 'row' },
  cabecalho: { backgroundColor: cores.nevoa },
  celula: { width: 132, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: cores.gelo, color: cores.texto, fontFamily: fontes.corpo,
    fontSize: 14, lineHeight: 20 },
  numero: { width: 48, textAlign: 'center', color: cores.textoSecundario, fontWeight: '800' },
  expandir: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },
  expandirTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
});
