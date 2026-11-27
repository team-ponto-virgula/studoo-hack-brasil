/*
 * Controle de som no app (spec 12, revisão "uma música só" de 19/11, fbab44c), com a web: a folha "Som" com duas chaves
 * independentes, "Música de fundo" (sempre o Lo-fi de Estudo, em laço) e "Efeitos sonoros", o botão de som do alto da aula
 * e o bloco "Som" do Perfil com as mesmas chaves. O estado vem do toca-sons (`tocaSons.obterEstado` / `assinarEstado`, em
 * sons.ts); a escolha fica no aparelho e vale na hora, sem "Salvar". Nada de janela do sistema: a folha é a do Studoo
 * (spec 11) e a chave também (nunca o `Switch` nativo).
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EstadoSomSnapshot } from '../../../packages/contratos/src/catalogo-sons';
import { Icone } from './icone';
import { useMovimentoReduzido, type OpcoesDoAviso } from './interface';
import { useDepoisDeSair } from './janelas';
import { Stu } from './mascote';
import { mensagens } from './mensagens';
import { tocaSons } from './sons';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

const t = mensagens.som;

/** O estado do toca-sons, atualizado a cada mudança. As preferências guardadas carregam na primeira leitura. */
export function useEstadoSom(): EstadoSomSnapshot {
  const [estado, setEstado] = useState<EstadoSomSnapshot>(() => tocaSons.obterEstado());
  useEffect(() => {
    void tocaSons.carregarPreferencias();
    return tocaSons.assinarEstado(setEstado);
  }, []);
  return estado;
}

/*
 * O aviso da primeira vez (spec 12): quando a música toca pela primeira vez no aparelho, o aviso do app "Música de fundo
 * ligada." com "Desligar", que desliga na hora. Uma vez por aparelho (`studoo.sons.avisoMusica`, como a web); sem
 * armazenamento, não aparece (a pessoa ainda tem o botão de som e o Perfil).
 */
const CHAVE_AVISO_MUSICA = 'studoo.sons.avisoMusica';
export function useAvisoDaMusica(avisar: (texto: string, opcoes?: OpcoesDoAviso) => void) {
  useEffect(() => {
    let avisado: boolean | null = null;
    const conferir = (estado: EstadoSomSnapshot) => {
      if (avisado !== false || estado.fundo === 'mudo' || estado.estadoFundo !== 'tocando') return;
      avisado = true;
      void SecureStore.setItemAsync(CHAVE_AVISO_MUSICA, '1').catch(() => undefined);
      // Sem o som do aviso: a própria música que entra é o sinal.
      // No alto, em todas as telas (spec 16, item 14): nunca cobre o balão do mapa, o rodapé, links nem a barra de abas.
      avisar(t.musicaAviso, { som: null, noAlto: true, duracaoMs: 30000, acao: { rotulo: t.desligarMusica, aoTocar: () => void tocaSons.definirMusicaLigada(false) } });
    };
    void SecureStore.getItemAsync(CHAVE_AVISO_MUSICA)
      .then((valor) => { avisado = valor === '1'; conferir(tocaSons.obterEstado()); })
      .catch(() => { avisado = true; });
    return tocaSons.assinarEstado(conferir);
  }, [avisar]);
}

/** Música ligada (o Lo-fi) e, ligada mas parada, o motivo que o nome do botão e a linha da folha dizem. */
function situacaoDaMusica(estado: EstadoSomSnapshot) {
  const ligada = estado.fundo !== 'mudo';
  const motivo = ligada && (estado.motivoPausa === 'sem_gesto' || estado.motivoPausa === 'gravando') ? estado.motivoPausa : undefined;
  return { ligada, motivo };
}

/** A chave do Studoo (spec 12): 52 × 32, raio 16; trilho #C9D1EA ou na cor de ação; o botão branco de 26 anda 20 em 160 ms. */
export function ChaveStudoo({ ligada, aoMudar, rotulo, dica, testID }: {
  ligada: boolean;
  aoMudar: (ligada: boolean) => void;
  /** O nome que o leitor de tela diz ("Efeitos sonoros"). */
  rotulo: string;
  dica?: string;
  testID?: string;
}) {
  const reduzir = useMovimentoReduzido();
  const [posicao] = useState(() => new Animated.Value(ligada ? 1 : 0));
  useEffect(() => {
    const animacao = Animated.timing(posicao, { toValue: ligada ? 1 : 0, duration: reduzir !== false ? 0 : 160, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [ligada, reduzir, posicao]);
  return (
    // Área de toque de 44 em volta da chave, como o ::before da web.
    <Pressable testID={testID} accessibilityRole="switch" accessibilityLabel={rotulo} accessibilityHint={dica} accessibilityState={{ checked: ligada }}
      aria-checked={ligada} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }} onPress={() => aoMudar(!ligada)}
      style={[somEstilos.chave, ligada && { backgroundColor: cores.acao }]}>
      <Animated.View style={[somEstilos.chaveBotao, { transform: [{ translateX: posicao.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
    </Pressable>
  );
}

/** "Tocando": três barras de 3 px (vão de 2) que sobem e descem entre 4 e 12 em 900 ms, 150 ms uma depois da outra. */
function Barras({ cor }: { cor: string }) {
  const reduzir = useMovimentoReduzido();
  const [alturas] = useState(() => [new Animated.Value(6), new Animated.Value(12), new Animated.Value(8)]);
  useEffect(() => {
    if (reduzir !== false) {
      [6, 12, 8].forEach((altura, indice) => alturas[indice].setValue(altura));
      return;
    }
    const ciclos = alturas.map((altura, indice) => {
      altura.setValue(4);
      return Animated.sequence([
        Animated.delay(indice * 150),
        Animated.loop(Animated.sequence([
          Animated.timing(altura, { toValue: 12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(altura, { toValue: 4, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ])),
      ]);
    });
    ciclos.forEach((ciclo) => ciclo.start());
    return () => ciclos.forEach((ciclo) => ciclo.stop());
  }, [reduzir, alturas]);
  return (
    <View style={somEstilos.barras} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {alturas.map((altura, indice) => <Animated.View key={indice} style={[somEstilos.barra, { height: altura, backgroundColor: cor }]} />)}
    </View>
  );
}

/** "Carregando…": o giro de 14 px; parado com movimento reduzido. */
function Giro({ cor }: { cor: string }) {
  const reduzir = useMovimentoReduzido();
  const [volta] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduzir !== false) return;
    const ciclo = Animated.loop(Animated.timing(volta, { toValue: 1, duration: 800, easing: Easing.linear, isInteraction: false, useNativeDriver: true }));
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzir, volta]);
  return (
    <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[somEstilos.giro, { borderColor: cor, borderRightColor: 'transparent', transform: [{ rotate: volta.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
  );
}

/**
 * A linha de estado da música, embaixo de "Lo-fi de Estudo, em laço": tocando (as barras), carregando (o giro), antes do
 * primeiro toque, pausada enquanto grava, ou o erro. Desligada, nada.
 */
function EstadoDaMusica({ estado }: { estado: EstadoSomSnapshot }) {
  const { ligada, motivo } = situacaoDaMusica(estado);
  if (!ligada) return null;
  if (estado.estadoFundo === 'erro') return <Text testID="som-musica-estado" numberOfLines={2} style={somEstilos.estadoErro}>{t.musicaErro}</Text>;
  if (motivo === 'sem_gesto') return <Text testID="som-musica-estado" style={somEstilos.estadoTexto}>{t.musicaComeca}</Text>;
  if (motivo === 'gravando') return <Text testID="som-musica-estado" style={somEstilos.estadoTexto}>{t.musicaPausada}</Text>;
  if (estado.estadoFundo === 'carregando') {
    return <View testID="som-musica-estado" style={somEstilos.estado}><Giro cor={cores.textoSecundario} /><Text style={somEstilos.estadoTexto}>{t.carregando}</Text></View>;
  }
  if (estado.estadoFundo === 'tocando') {
    return <View testID="som-musica-estado" style={somEstilos.estado}><Barras cor={cores.acaoEscura} /><Text style={[somEstilos.estadoTexto, { color: cores.acaoEscura }]}>{t.tocando}</Text></View>;
  }
  return null;
}

/** As duas chaves, iguais na folha e no Perfil: "Música de fundo" (o Lo-fi, em laço) e "Efeitos sonoros". */
function ChavesDoSom({ estado, noPerfil = false }: { estado: EstadoSomSnapshot; noPerfil?: boolean }) {
  const { ligada } = situacaoDaMusica(estado);
  const prefixo = noPerfil ? 'perfil-som' : 'som';
  return (
    <>
      <View style={[somEstilos.linhaChave, noPerfil && somEstilos.perfilLinha]}>
        <View style={somEstilos.chaveTexto}>
          <Text style={somEstilos.chaveTitulo}>{t.musicaTitulo}</Text>
          <Text style={somEstilos.chaveDica}>{t.musicaEmLaco}</Text>
          {!noPerfil && <EstadoDaMusica estado={estado} />}
        </View>
        {/* Ligar a música não toca efeito: a própria música entra, subindo em 600 ms. */}
        <ChaveStudoo testID={`${prefixo}-musica`} ligada={ligada} rotulo={t.musicaTitulo} dica={t.musicaEmLaco}
          aoMudar={(valor) => void tocaSons.definirMusicaLigada(valor)} />
      </View>
      <View style={noPerfil ? [somEstilos.perfilLinha, somEstilos.perfilLinhaChave] : null}>
        {!noPerfil && <View style={somEstilos.linha} />}
        {/* No Perfil, esta linha fica dentro da faixa com borda (outra linha em fila): ocupa a largura toda, para a chave ficar
            na borda direita como a da música. */}
        <View style={[somEstilos.linhaChave, noPerfil ? somEstilos.linhaInteira : somEstilos.linhaEfeitos]}>
          <View style={somEstilos.chaveTexto}>
            <Text style={somEstilos.chaveTitulo}>{t.efeitosTitulo}</Text>
            <Text style={somEstilos.chaveDica}>{noPerfil ? t.efeitosDicaPerfil : t.efeitosDica}</Text>
          </View>
          {/* Ligar toca uma vez o efeito "salvo" (o toca-sons faz isso); desligar não toca nada. */}
          <ChaveStudoo testID={`${prefixo}-efeitos`} ligada={estado.efeitosAtivos} rotulo={t.efeitosTitulo} dica={noPerfil ? t.efeitosDicaPerfil : t.efeitosDica}
            aoMudar={(valor) => void tocaSons.definirEfeitosAtivos(valor)} />
        </View>
      </View>
    </>
  );
}

/**
 * A folha "Som" (folha do Studoo, spec 11): sobe do pé, ocupa até 92% da altura e rola por dentro. O foco abre no título;
 * voltar, o véu e o X fecham, e quem abriu devolve o foco a quem a abriu (`aoSair`, depois que a folha saiu). Enquanto ela
 * está aberta com o leitor de tela, a música fica a 60% (o toca-sons cuida disso).
 */
export function FolhaSom({ visivel, aoFechar, aoSair }: { visivel: boolean; aoFechar: () => void; aoSair?: () => void }) {
  const estado = useEstadoSom();
  const margens = useSafeAreaInsets();
  const reduzir = useMovimentoReduzido();
  const titulo = useRef<ComponentRef<typeof Text>>(null);
  const [subida] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visivel) return;
    void tocaSons.definirPreviewFolha({ aberta: true });
    // Reabrir a folha tenta de novo a música que falhou.
    if (tocaSons.obterEstado().estadoFundo === 'erro') void tocaSons.tentarNovamenteFundo();
    // O leitor de tela começa pelo título "Som".
    const foco = setTimeout(() => { if (titulo.current) AccessibilityInfo.sendAccessibilityEvent(titulo.current, 'focus'); }, 300);
    return () => {
      clearTimeout(foco);
      void tocaSons.definirPreviewFolha({ aberta: false });
    };
  }, [visivel]);

  // Sobe 24 e aparece em 260 ms (folha-subir da web); com movimento reduzido, só a opacidade.
  useEffect(() => {
    if (!visivel) return;
    subida.setValue(0);
    const animacao = Animated.timing(subida, { toValue: 1, duration: reduzir !== false ? 120 : 260, easing: Easing.bezier(0.2, 0.9, 0.3, 1), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [visivel, reduzir, subida]);

  return (
    <Modal transparent visible={visivel} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={aoFechar} onDismiss={aoSair}>
      <View style={somEstilos.fundo}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={aoFechar} />
        <Animated.View testID="folha-som" accessibilityViewIsModal style={[somEstilos.folha, { opacity: subida,
          transform: [{ translateY: reduzir !== false ? 0 : subida.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
          <ScrollView bounces={false} style={somEstilos.rolagem} contentContainerStyle={[somEstilos.folhaConteudo, { paddingBottom: 20 + margens.bottom }]}>
            <View style={somEstilos.alca} />
            <View style={somEstilos.topo}>
              <View style={somEstilos.topoTitulo}>
                <Stu nome="acessorio-fone" tamanho={40} />
                <Text ref={titulo} accessibilityRole="header" style={somEstilos.titulo}>{t.titulo}</Text>
              </View>
              <Pressable testID="folha-som-fechar" accessibilityRole="button" accessibilityLabel={t.fechar} onPress={aoFechar}
                style={({ pressed }) => [somEstilos.fechar, pressed && { backgroundColor: cores.nevoa }]}>
                {({ pressed }) => <Icone nome="fechar" tamanho={22} cor={pressed ? cores.texto : cores.textoSecundario} />}
              </Pressable>
            </View>
            <ChavesDoSom estado={estado} />
            <View style={somEstilos.rodape}>
              <View style={somEstilos.rodapeIcone}><Icone nome="info" tamanho={16} cor={cores.textoSecundario} /></View>
              <Text style={somEstilos.rodapeTexto}>{t.rodapeMusica}</Text>
            </View>
            {/* P24 da spec 07: no iPhone, o modo silencioso cala os sons do Studoo (o toca-sons usa playsInSilentMode: false). */}
            {Platform.OS === 'ios' && (
              <View style={somEstilos.rodape}>
                <View style={somEstilos.rodapeIcone}><Icone nome="info" tamanho={16} cor={cores.textoSecundario} /></View>
                <Text style={somEstilos.rodapeTexto}>{t.rodapeIphone}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * O botão de som do alto da aula (44 × 44, raio 12, ícone de 24): duas ondas com a música ligada, uma onda com a música
 * desligada e os efeitos ligados, cortado com tudo desligado; nunca se move e não tem o ponto de aviso (o aviso da primeira
 * vez diz onde desligar). Abre a folha por cima da lição; ao fechar, o foco volta ao botão.
 */
export function BotaoSom() {
  const estado = useEstadoSom();
  const [aberta, setAberta] = useState(false);
  const botao = useRef<ComponentRef<typeof Pressable>>(null);
  const { depoisDeSair, aoSair } = useDepoisDeSair();
  const { ligada, motivo } = situacaoDaMusica(estado);
  const icone: NomeIcone = ligada ? 'somDuasOndas' : estado.efeitosAtivos ? 'somUmaOnda' : 'somCortado';

  function fechar() {
    setAberta(false);
    depoisDeSair(() => { if (botao.current) AccessibilityInfo.sendAccessibilityEvent(botao.current, 'focus'); });
  }

  return (
    <>
      {/* No Android, a área de toque chega a 48 (P8 da spec 07). */}
      <Pressable ref={botao} testID="aula-som" accessibilityRole="button" accessibilityLabel={t.botaoMusicaRotulo(ligada, estado.efeitosAtivos, motivo)}
        hitSlop={Platform.OS === 'android' ? 2 : undefined} onPress={() => setAberta(true)}
        style={({ pressed }) => [somEstilos.botao, pressed && { backgroundColor: cores.nevoa }]}>
        <Icone nome={icone} tamanho={24} cor={ligada ? cores.acao : cores.textoSecundario} />
      </Pressable>
      <FolhaSom visivel={aberta} aoFechar={fechar} aoSair={aoSair} />
    </>
  );
}

/** O bloco "Som" do Perfil (a tela põe o título da seção, antes de "Conta"): as duas chaves, sem seta nem folha. */
export function SomNoPerfil() {
  const estado = useEstadoSom();
  return (
    <View style={somEstilos.perfil}>
      <ChavesDoSom estado={estado} noPerfil />
    </View>
  );
}

const somEstilos = StyleSheet.create({
  // .folha-fundo e .folha da web (spec 11): o véu, a folha de até 480 com borda de 2 (sem a de baixo), cantos de 24 em cima.
  fundo: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
  folha: { width: '100%', maxWidth: 480, maxHeight: '92%', borderWidth: 2, borderBottomWidth: 0, borderColor: cores.gelo, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, backgroundColor: cores.fundo, boxShadow: '0 -12px 40px rgba(15, 23, 42, 0.2)' },
  // A rolagem fica do tamanho do conteúdo e só rola quando ele passa dos 92% da altura.
  rolagem: { flexGrow: 0 },
  // .folha--som: 20 de respiro e 12 entre os blocos.
  folhaConteudo: { gap: 12, paddingTop: 20, paddingHorizontal: 20 },
  // A alça: 40 × 4, 8 acima do respiro, sem ocupar lugar na coluna (na grade da web, a margem de -8 zera a faixa dela): o
  // título fica 12 abaixo do respiro, como na web.
  alca: { alignSelf: 'center', width: 40, height: 4, marginTop: -8, marginBottom: 4, borderRadius: 2, backgroundColor: cores.gelo },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titulo: { flexShrink: 1, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26 },
  // .folha-fechar: 44 × 44, raio 14, ícone de 22.
  fechar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12 },
  barra: { width: 3, borderRadius: 2 },
  giro: { width: 14, height: 14, borderWidth: 2, borderRadius: 7 },
  linha: { height: 1, backgroundColor: cores.gelo },
  topoTitulo: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  // As linhas das duas chaves: o texto (título 800 de 16/22 e a linha 400 de 14/20) e a chave à direita.
  linhaChave: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  linhaEfeitos: { marginTop: 12 },
  linhaInteira: { flex: 1 },
  chaveTexto: { flex: 1, minWidth: 0, gap: 2 },
  chaveTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 22 },
  chaveDica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  // A linha de estado da música: barras ou giro com a palavra (800 de 14), ou o erro em vermelho, em até duas linhas.
  estado: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  estadoTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  estadoErro: { marginTop: 2, color: '#C23B4E', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  rodape: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rodapeIcone: { marginTop: 2 },
  rodapeTexto: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  // A chave do Studoo: o trilho #C9D1EA (o mesmo da borda dos campos) e o botão com a sombra 0 2px 4px.
  chave: { width: 52, height: 32, borderRadius: 16, backgroundColor: cores.bordaCampo },
  chaveBotao: { position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(11, 27, 92, 0.25)' },
  // .aula-som: 44 × 44, raio 12, sem o ponto de aviso.
  botao: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  // .som-perfil: um bloco com borda de 2 e raio 24, com duas linhas de 64 (respiro de 10 × 16) e a linha de 1 entre elas.
  perfil: { borderWidth: 2, borderColor: cores.gelo, borderRadius: 24, overflow: 'hidden' },
  perfilLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: cores.fundo },
  perfilLinhaChave: { borderTopWidth: 1, borderTopColor: cores.gelo },
});
