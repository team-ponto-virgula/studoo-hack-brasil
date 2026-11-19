/*
 * Controle de som no app (spec 12), espelho de src/app/som.tsx (web em b3424c9): a folha "Som" (Mudo e os cinco climas, mais
 * os efeitos), o botão de som do alto da aula e o bloco "Som" do Perfil. O estado vem do toca-sons (`tocaSons.obterEstado` /
 * `assinarEstado`, em sons.ts); a escolha fica no aparelho e vale na hora, sem "Salvar". Os gatilhos dos efeitos nas lições
 * são da Mobile & QA; aqui fica só a interface do controle. Nada de janela do sistema: a folha é a do Studoo (spec 11) e a
 * chave também (nunca o `Switch` nativo).
 */
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OPCOES_FUNDO_UI, type EstadoSomSnapshot, type IdSomFundo } from '../../../packages/contratos/src/catalogo-sons';
import { Icone } from './icone';
import { useMovimentoReduzido } from './interface';
import { useDepoisDeSair } from './janelas';
import { mensagens } from './mensagens';
import { tocaSons } from './sons';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

const t = mensagens.som;
const ICONES_FUNDO: Record<IdSomFundo, NomeIcone> = {
  mudo: 'somCortado', foco_calmo: 'ondas', chuva_suave: 'chuva', lofi_estudo: 'fones', biblioteca: 'livros', brisa_natural: 'folha',
};
const nomeDoFundo = (id: IdSomFundo) => OPCOES_FUNDO_UI.find((opcao) => opcao.id === id)?.rotulo ?? id;
/** A borda da marca redonda desmarcada (#8792BD da web). */
const BORDA_DA_MARCA = '#8792BD';

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
 * O ponto de novidade some quando a pessoa abre a folha uma vez ou conclui 3 lições, no aparelho. As chaves são as da web
 * (`studoo.sons.visto` e `studoo.sons.licoes`); sem armazenamento, o ponto não aparece, como na web.
 */
const CHAVE_VISTO = 'studoo.sons.visto';
const CHAVE_LICOES = 'studoo.sons.licoes';
let vistoNaMemoria = false;

async function somJaVisto() {
  if (vistoNaMemoria) return true;
  try {
    const [visto, licoes] = await Promise.all([SecureStore.getItemAsync(CHAVE_VISTO), SecureStore.getItemAsync(CHAVE_LICOES)]);
    vistoNaMemoria = visto === '1' || Number(licoes ?? 0) >= 3;
    return vistoNaMemoria;
  } catch {
    return true;
  }
}

function marcarSomVisto() {
  vistoNaMemoria = true;
  void SecureStore.setItemAsync(CHAVE_VISTO, '1').catch(() => undefined);
}

/** Chamado a cada lição concluída: na terceira, a novidade some. */
export async function contarLicaoParaNovidadeDoSom() {
  try {
    const licoes = Number((await SecureStore.getItemAsync(CHAVE_LICOES)) ?? 0) + 1;
    await SecureStore.setItemAsync(CHAVE_LICOES, String(licoes));
    if (licoes >= 3) vistoNaMemoria = true;
  } catch {
    // Sem armazenamento, a contagem recomeça na próxima abertura; o ponto também some ao abrir a folha.
  }
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
 * A folha "Som" (folha do Studoo, spec 11): sobe do pé, ocupa até 92% da altura e rola por dentro. O foco abre no título;
 * voltar, o véu e o X fecham, e quem abriu devolve o foco a quem a abriu (`aoSair`, depois que a folha saiu).
 */
export function FolhaSom({ visivel, aoFechar, aoSair }: { visivel: boolean; aoFechar: () => void; aoSair?: () => void }) {
  const estado = useEstadoSom();
  const margens = useSafeAreaInsets();
  const reduzir = useMovimentoReduzido();
  const titulo = useRef<ComponentRef<typeof Text>>(null);
  const escolhaFeita = useRef(false);
  const [subida] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visivel) return;
    escolhaFeita.current = false;
    marcarSomVisto();
    void tocaSons.definirPreviewFolha({ aberta: true });
    // Reabrir a folha tenta de novo o clima que falhou.
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

  // O leitor de tela ouve a escolha e, quando o som chega, "Tocando" (no Mudo, "Som de fundo desligado.").
  useEffect(() => {
    if (!visivel || !escolhaFeita.current) return;
    if (estado.fundo === 'mudo') AccessibilityInfo.announceForAccessibility(t.anuncioMudo);
    else if (estado.estadoFundo === 'tocando') AccessibilityInfo.announceForAccessibility(t.anuncioEscolhido(nomeDoFundo(estado.fundo)));
    else if (estado.estadoFundo === 'erro') AccessibilityInfo.announceForAccessibility(t.linhaErro(nomeDoFundo(estado.fundo)));
  }, [visivel, estado.fundo, estado.estadoFundo]);

  function escolher(id: IdSomFundo) {
    escolhaFeita.current = true;
    if (id === estado.fundo && estado.estadoFundo === 'erro') { void tocaSons.tentarNovamenteFundo(); return; }
    // Com o leitor de tela ligado, o toca-sons espera 1,5 s antes da prévia, para o anúncio vir antes do som (spec 12).
    tocaSons.definirFundoComAtraso(id);
  }

  return (
    <Modal transparent visible={visivel} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={aoFechar} onDismiss={aoSair}>
      <View style={somEstilos.fundo}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={aoFechar} />
        <Animated.View testID="folha-som" accessibilityViewIsModal style={[somEstilos.folha, { opacity: subida,
          transform: [{ translateY: reduzir !== false ? 0 : subida.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
          <ScrollView bounces={false} style={somEstilos.rolagem} contentContainerStyle={[somEstilos.folhaConteudo, { paddingBottom: 20 + margens.bottom }]}>
            <View style={somEstilos.alca} />
            <View style={somEstilos.topo}>
              <Text ref={titulo} accessibilityRole="header" style={somEstilos.titulo}>{t.titulo}</Text>
              <Pressable testID="folha-som-fechar" accessibilityRole="button" accessibilityLabel={t.fechar} onPress={aoFechar}
                style={({ pressed }) => [somEstilos.fechar, pressed && { backgroundColor: cores.nevoa }]}>
                {({ pressed }) => <Icone nome="fechar" tamanho={22} cor={pressed ? cores.texto : cores.textoSecundario} />}
              </Pressable>
            </View>
            <View style={somEstilos.bloco}>
              <Text accessibilityRole="header" style={somEstilos.subtitulo}>{t.fundoTitulo}</Text>
              <Text style={somEstilos.dica}>{t.fundoDica}</Text>
            </View>
            <View accessibilityRole="radiogroup" accessibilityLabel={t.fundoTitulo} style={somEstilos.lista}>
              {OPCOES_FUNDO_UI.map((opcao) => {
                const marcada = estado.fundo === opcao.id;
                const tocando = marcada && opcao.id !== 'mudo' && estado.estadoFundo === 'tocando';
                const carregando = marcada && opcao.id !== 'mudo' && estado.estadoFundo === 'carregando';
                const erro = marcada && opcao.id !== 'mudo' && estado.estadoFundo === 'erro';
                const rotulo = erro ? t.linhaErro(opcao.rotulo) : tocando ? t.linhaTocando(opcao.rotulo) : t.linhaRotulo(opcao.rotulo, opcao.descricao);
                return (
                  <Pressable key={opcao.id} testID={`som-${opcao.id}`} accessibilityRole="radio" accessibilityLabel={rotulo}
                    accessibilityState={{ checked: marcada }} aria-checked={marcada} onPress={() => escolher(opcao.id)}
                    style={({ pressed }) => [somEstilos.opcao, marcada ? somEstilos.opcaoMarcada : pressed && { backgroundColor: cores.nevoa }]}>
                    <View style={somEstilos.opcaoIcone}><Icone nome={ICONES_FUNDO[opcao.id]} tamanho={22} cor={cores.acao} /></View>
                    <View style={somEstilos.opcaoTexto} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                      <Text style={somEstilos.opcaoNome}>{opcao.rotulo}</Text>
                      {erro ? <Text numberOfLines={2} style={somEstilos.opcaoErro}>{t.erro}</Text>
                        : tocando ? <View style={somEstilos.opcaoEstado}><Barras cor={cores.acaoEscura} /><Text style={[somEstilos.opcaoEstadoTexto, { color: cores.acaoEscura }]}>{t.tocando}</Text></View>
                          : carregando ? <View style={somEstilos.opcaoEstado}><Giro cor={cores.textoSecundario} /><Text style={somEstilos.opcaoEstadoTexto}>{t.carregando}</Text></View>
                            : <Text numberOfLines={1} style={somEstilos.opcaoDescricao}>{opcao.descricao}</Text>}
                    </View>
                    <View style={[somEstilos.marca, marcada && { borderColor: cores.acao }]}>{marcada && <View style={somEstilos.marcaMiolo} />}</View>
                  </Pressable>
                );
              })}
            </View>
            <View style={somEstilos.linha} />
            <View style={somEstilos.efeitos}>
              <View style={somEstilos.efeitosTexto}>
                <Text style={somEstilos.efeitosTitulo}>{t.efeitosTitulo}</Text>
                <Text style={somEstilos.efeitosDica}>{t.efeitosDica}</Text>
              </View>
              {/* Ligar toca uma vez o efeito "salvo" (o toca-sons faz isso); desligar não toca nada. */}
              <ChaveStudoo testID="som-efeitos" ligada={estado.efeitosAtivos} rotulo={t.efeitosTitulo} dica={t.efeitosDica}
                aoMudar={(ligada) => void tocaSons.definirEfeitosAtivos(ligada)} />
            </View>
            <View style={somEstilos.rodape}>
              <View style={somEstilos.rodapeIcone}><Icone nome="info" tamanho={16} cor={cores.textoSecundario} /></View>
              <Text style={somEstilos.rodapeTexto}>{t.rodape}</Text>
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
 * O botão de som do alto da aula (44 × 44, raio 12, ícone de 24): o ícone segue o estado (duas ondas com fundo escolhido, uma
 * onda com fundo mudo e efeitos ligados, cortado com tudo desligado) e nunca se move. Abre a folha por cima da lição; ao
 * fechar, o foco volta ao botão. Ponto de novidade até a primeira abertura ou a terceira lição concluída.
 */
export function BotaoSom() {
  const estado = useEstadoSom();
  const [aberta, setAberta] = useState(false);
  const [novidade, setNovidade] = useState(false);
  const botao = useRef<ComponentRef<typeof Pressable>>(null);
  const { depoisDeSair, aoSair } = useDepoisDeSair();
  useEffect(() => {
    let ativo = true;
    void somJaVisto().then((visto) => { if (ativo) setNovidade(!visto); });
    return () => { ativo = false; };
  }, [aberta]);
  const clima = estado.fundo !== 'mudo' ? nomeDoFundo(estado.fundo) : null;
  const motivo = clima && (estado.motivoPausa === 'sem_gesto' || estado.motivoPausa === 'gravando') ? estado.motivoPausa : null;
  const icone: NomeIcone = clima ? 'somDuasOndas' : estado.efeitosAtivos ? 'somUmaOnda' : 'somCortado';

  function fechar() {
    setAberta(false);
    depoisDeSair(() => { if (botao.current) AccessibilityInfo.sendAccessibilityEvent(botao.current, 'focus'); });
  }

  return (
    <>
      {/* No Android, a área de toque chega a 48 (P8 da spec 07). */}
      <Pressable ref={botao} testID="aula-som" accessibilityRole="button" accessibilityLabel={t.botaoRotulo({ clima, efeitos: estado.efeitosAtivos, motivo, novidade })}
        hitSlop={Platform.OS === 'android' ? 2 : undefined} onPress={() => setAberta(true)}
        style={({ pressed }) => [somEstilos.botao, pressed && { backgroundColor: cores.nevoa }]}>
        <Icone nome={icone} tamanho={24} cor={clima ? cores.acao : cores.textoSecundario} />
        {novidade && <View testID="aula-som-novidade" style={somEstilos.novidade} />}
      </Pressable>
      <FolhaSom visivel={aberta} aoFechar={fechar} aoSair={aoSair} />
    </>
  );
}

/**
 * O bloco "Som" do Perfil (a tela põe o título da seção, antes de "Conta"): "Som de fundo", com o valor e a seta, abre a
 * folha; "Efeitos sonoros" tem a chave.
 */
export function SomNoPerfil() {
  const estado = useEstadoSom();
  const [aberta, setAberta] = useState(false);
  const linha = useRef<ComponentRef<typeof Pressable>>(null);
  const { depoisDeSair, aoSair } = useDepoisDeSair();
  const valor = nomeDoFundo(estado.fundo);

  function fechar() {
    setAberta(false);
    depoisDeSair(() => { if (linha.current) AccessibilityInfo.sendAccessibilityEvent(linha.current, 'focus'); });
  }

  return (
    <View style={somEstilos.perfil}>
      <Pressable ref={linha} testID="perfil-som-fundo" accessibilityRole="button" accessibilityLabel={t.perfilFundoRotulo(valor)} onPress={() => setAberta(true)}
        style={({ pressed }) => [somEstilos.perfilLinha, pressed && { backgroundColor: cores.nevoa }]}>
        <Text style={somEstilos.perfilTitulo}>{t.fundoTitulo}</Text>
        <Text style={somEstilos.perfilValor}>{valor}</Text>
        <Icone nome="seta" tamanho={20} cor={cores.textoSecundario} />
      </Pressable>
      <View style={[somEstilos.perfilLinha, somEstilos.perfilLinhaChave]}>
        <View style={somEstilos.efeitosTexto}>
          <Text style={somEstilos.efeitosTitulo}>{t.efeitosTitulo}</Text>
          <Text style={somEstilos.efeitosDica}>{t.efeitosDicaPerfil}</Text>
        </View>
        <ChaveStudoo testID="perfil-som-efeitos" ligada={estado.efeitosAtivos} rotulo={t.efeitosTitulo} dica={t.efeitosDicaPerfil}
          aoMudar={(ligada) => void tocaSons.definirEfeitosAtivos(ligada)} />
      </View>
      <FolhaSom visivel={aberta} aoFechar={fechar} aoSair={aoSair} />
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
  bloco: { gap: 2 },
  subtitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 18, lineHeight: 24 },
  dica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 15, lineHeight: 22 },
  // A lista: linhas de 60 no mínimo, respiro de 8 × 12, borda de 2 e raio 16, com 6 entre elas.
  lista: { gap: 6 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 2,
    borderColor: cores.gelo, borderRadius: 16, backgroundColor: cores.fundo },
  opcaoMarcada: { borderColor: cores.acao, backgroundColor: cores.ceu },
  opcaoIcone: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: cores.nevoa },
  opcaoTexto: { flex: 1, minWidth: 0 },
  opcaoNome: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 22 },
  opcaoDescricao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  opcaoEstado: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  opcaoEstadoTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  opcaoErro: { color: cores.erro, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  // A marca redonda de 24, com borda de 2; marcada, borda e miolo de 12 na cor de ação.
  marca: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BORDA_DA_MARCA, borderRadius: 12,
    backgroundColor: cores.fundo },
  marcaMiolo: { width: 12, height: 12, borderRadius: 6, backgroundColor: cores.acao },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 12 },
  barra: { width: 3, borderRadius: 2 },
  giro: { width: 14, height: 14, borderWidth: 2, borderRadius: 7 },
  linha: { height: 1, backgroundColor: cores.gelo },
  efeitos: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  efeitosTexto: { flex: 1, minWidth: 0 },
  efeitosTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  efeitosDica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  rodape: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rodapeIcone: { marginTop: 2 },
  rodapeTexto: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  // A chave do Studoo: o trilho #C9D1EA (o mesmo da borda dos campos) e o botão com a sombra 0 2px 4px.
  chave: { width: 52, height: 32, borderRadius: 16, backgroundColor: cores.bordaCampo },
  chaveBotao: { position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(11, 27, 92, 0.25)' },
  // .aula-som: 44 × 44, raio 12; o ponto de novidade de 10 com borda branca de 2, a 6 do canto, que não pulsa.
  botao: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  novidade: { position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 7,
    backgroundColor: cores.ouro },
  // .som-perfil: um bloco com borda de 2 e raio 24, com duas linhas de 64 (respiro de 10 × 16) e a linha de 1 entre elas.
  perfil: { borderWidth: 2, borderColor: cores.gelo, borderRadius: 24, overflow: 'hidden' },
  perfilLinha: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: cores.fundo },
  perfilLinhaChave: { borderTopWidth: 1, borderTopColor: cores.gelo },
  perfilTitulo: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  perfilValor: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
});
