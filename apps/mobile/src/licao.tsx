import { ApoioDaLicao } from './estudio-adaptativo';
import type { ClienteEstudio } from '@studoo/contratos';
import type { Avaliacao, LicaoDetalhe } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { estiloDeEntrada, useAparecer, usePulinho, useTremor } from './animacoes';
import { Confete } from './festa';
import { Icone } from './icone';
import { Botao, BotaoIcone, Campo, EstadoMensagem, Tela, Titulo, estilos, useBalanco, useMovimentoReduzido } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import type { NomeIcone } from './trilha';

type Etapa = 'conceito' | 'exemplo' | 'exercicio';
// Como na web: três etapas de verdade; o retorno acontece na etapa do exercício.
const posicoes = { conceito: 1, exemplo: 2, exercicio: 3, feedback: 3 } as const;
/** O que a pessoa fez na lição, para o resumo da conclusão: tempo, tentativas e se acertou de primeira. */
export type ResumoLicao = { segundos: number; tentativas: number; dePrimeira: boolean };

const iconesDaEtapa: Record<Etapa, NomeIcone> = { conceito: 'livro', exemplo: 'lampada', exercicio: 'alvo' };
const coresDaEtapa: Record<Etapa, { texto: string; fundo: string }> = {
  conceito: { texto: cores.acao, fundo: '#E7ECFF' },
  exemplo: { texto: '#8A5A00', fundo: '#FFF1CC' },
  exercicio: { texto: cores.sucesso, fundo: '#E3F6EA' },
};
const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/** Título do acerto: varia entre as lições, sem sorteio (a mesma lição tem sempre o mesmo), como na web. */
function tituloDoAcerto(id: string) {
  let soma = 0;
  for (const caractere of id) soma = (soma * 31 + caractere.charCodeAt(0)) >>> 0;
  return mensagens.licao.certas[soma % mensagens.licao.certas.length];
}

/**
 * Aula por etapas, como na web (spec 02): conceito, exemplo e exercício, uma de cada vez, com a barra de andamento no
 * topo e o botão de fechar, que volta à trilha. O conceito vem num balão do Stu. Depois da resposta, o rodapé vira o
 * painel de retorno, que sobe verde no acerto (com confete) ou âmbar no erro (o exercício treme); no erro, dá para tentar
 * de novo ou continuar. Continuar registra a conclusão; se a confirmação expirar, a aula volta ao exercício.
 * O título de cada etapa e o do retorno recebem o foco do leitor de tela.
 */
export function Licao({ cliente, licao, erro, pendente, voltar, avaliar, concluir }: {
  cliente: ClienteEstudio;
  licao: LicaoDetalhe;
  erro: string | null;
  pendente: string | null;
  voltar: () => void;
  avaliar: (resposta: string) => Promise<Avaliacao | null>;
  concluir: (comprovante: string, resumo: ResumoLicao) => Promise<boolean>;
}) {
  const [etapa, setEtapa] = useState<Etapa>('conceito');
  const [resposta, setResposta] = useState('');
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [tentativas, setTentativas] = useState(0);
  const [dePrimeira, setDePrimeira] = useState<boolean | null>(null);
  const [errosSeguidos, setErrosSeguidos] = useState(0);
  const [inicio] = useState(() => Date.now());
  const tituloEtapa = useRef<ComponentRef<typeof Text>>(null);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const apoioPosicao = useRef(0);
  const reduzir = useMovimentoReduzido();
  const tremor = useTremor(errosSeguidos);
  const exercicio = licao.exercicio;
  const ocupado = pendente !== null;
  const posicao = avaliacao?.correta ? posicoes.feedback : posicoes[etapa];
  const andamento = mensagens.licao.posicao(posicao, posicoes.feedback);
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : null;
  const nomeEtapa = { conceito: mensagens.licao.conceito, exemplo: mensagens.licao.exemplo, exercicio: mensagens.licao.exercicio }[etapa];

  useEffect(() => {
    // Cada etapa começa do topo, como uma tela nova.
    rolagem.current?.scrollTo({ y: 0, animated: false });
    if (etapa === 'conceito') return;
    const espera = setTimeout(() => {
      if (tituloEtapa.current) AccessibilityInfo.sendAccessibilityEvent(tituloEtapa.current, 'focus');
    }, 120);
    return () => clearTimeout(espera);
  }, [etapa]);

  async function enviar() {
    if (ocupado || avaliacao || !resposta.trim()) return;
    const resultado = await avaliar(resposta);
    if (!resultado) return;
    setTentativas((total) => total + 1);
    setDePrimeira((anterior) => anterior ?? resultado.correta);
    if (!resultado.correta) setErrosSeguidos((total) => total + 1);
    setAvaliacao(resultado);
  }

  async function continuar(comprovante: string) {
    if (ocupado) return;
    const resumo = { segundos: Math.max(1, Math.round((Date.now() - inicio) / 1000)), tentativas, dePrimeira: dePrimeira === true };
    if (!await concluir(comprovante, resumo)) setAvaliacao(null);
  }

  const topo = (
    <View style={licaoEstilos.topo}>
      <BotaoIcone icone="fechar" rotulo={mensagens.licao.voltar} testID="voltar-plano" desativado={ocupado} acao={voltar} />
      <View style={licaoEstilos.andamento} accessible accessibilityRole="progressbar" accessibilityLabel={andamento}
        accessibilityValue={{ min: 0, max: posicoes.feedback, now: posicao }}>
        <BarraDaAula fracao={posicao / posicoes.feedback} certa={avaliacao?.correta === true} />
        <Text style={licaoEstilos.posicao}>{andamento}</Text>
      </View>
    </View>
  );

  let rodape: ReactNode;
  if (avaliacao) {
    rodape = (
      <PainelRetorno avaliacao={avaliacao} titulo={avaliacao.correta ? tituloDoAcerto(licao.id) : mensagens.licao.errada}
        ocupado={ocupado} concluindo={pendente === 'concluir'} tentarDeNovo={() => { setAvaliacao(null); setResposta(""); }}
        verReforco={() => rolagem.current?.scrollTo({ y: apoioPosicao.current, animated: reduzir === false })}
        continuar={() => void continuar(avaliacao.comprovante)} />
    );
  } else if (etapa === 'exercicio') {
    rodape = <Botao testID="enviar-resposta" rotulo={pendente === 'avaliar' ? mensagens.licao.avaliando : mensagens.licao.avaliar}
      desativado={ocupado || !resposta.trim()} ocupado={pendente === 'avaliar'} carregando={pendente === 'avaliar'} acao={() => void enviar()} />;
  } else {
    rodape = <Botao testID="avancar-licao" rotulo={mensagens.licao.seguir} icone="seta" desativado={ocupado}
      acao={() => setEtapa(etapa === 'conceito' ? 'exemplo' : 'exercicio')} />;
  }

  return (
    <Tela pagina={`licao-${licao.id}`} topo={topo} rodape={rodape} rolagem={rolagem}
      estiloRodape={retorno === 'certa' ? licaoEstilos.rodapeCerto : retorno === 'errada' ? licaoEstilos.rodapeErrado : undefined}>
      <EntradaDaEtapa key={etapa}>
        <View style={licaoEstilos.etapa}>
          <View style={[licaoEstilos.etapaIcone, { backgroundColor: coresDaEtapa[etapa].fundo }]}>
            <Icone nome={iconesDaEtapa[etapa]} tamanho={18} cor={coresDaEtapa[etapa].texto} />
          </View>
          <Text style={[licaoEstilos.etapaTexto, { color: coresDaEtapa[etapa].texto }]}>{nomeEtapa.toLocaleUpperCase('pt-BR')}</Text>
        </View>
        <Titulo testID="titulo-licao" foco={etapa === 'conceito'}>{licao.titulo}</Titulo>
        {etapa === 'conceito' && (
          <>
            {licao.concluida && (
              <View style={licaoEstilos.revisao}>
                <Icone nome="check" tamanho={18} cor={cores.sucesso} />
                <Text style={licaoEstilos.revisaoTexto}>{mensagens.trilha.revisitando}</Text>
              </View>
            )}
            <Text style={estilos.introducao}>{licao.objetivo}</Text>
            <ExplicacaoDoStu>
              <Text accessibilityRole="header" style={licaoEstilos.balaoTitulo}>{mensagens.licao.conceito}</Text>
              <Text style={estilos.texto}>{licao.conceito}</Text>
              <Text style={estilos.legenda}>{mensagens.licao.origem} · {licao.origem}</Text>
            </ExplicacaoDoStu>
          </>
        )}
        {etapa === 'exemplo' && (
          <View style={[licaoEstilos.quadro, licaoEstilos.quadroExemplo]}>
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.exemplo}</Text>
            <Text style={estilos.texto}>{licao.exemplo}</Text>
          </View>
        )}
        {etapa === 'exercicio' && (
          <Animated.View style={[licaoEstilos.quadro, { transform: [{ translateX: tremor }] }]}>
            <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.exercicio}</Text>
            <Text style={estilos.texto}>{exercicio.enunciado}</Text>
            {exercicio.contexto && <Text style={estilos.texto}>{exercicio.contexto}</Text>}
            {exercicio.trecho && <Text selectable style={licaoEstilos.codigo}>{exercicio.trecho}</Text>}
            {exercicio.tipo === 'lacuna'
              ? <Campo testID="resposta-licao" rotulo={mensagens.licao.resposta} value={resposta} onChangeText={setResposta}
                editable={!ocupado && !avaliacao} autoCorrect={false} autoCapitalize="none" returnKeyType="send"
                onSubmitEditing={() => void enviar()}
                style={[licaoEstilos.respostaCampo, retorno === 'certa' && licaoEstilos.respostaCerta, retorno === 'errada' && licaoEstilos.respostaErrada]} />
              : <View accessibilityRole="radiogroup" accessibilityLabel={mensagens.licao.resposta} style={licaoEstilos.opcoes}>
                <Text style={estilos.rotulo}>{mensagens.licao.resposta}</Text>
                {exercicio.opcoes.map((opcao, indice) => (
                  <Opcao key={opcao.id} id={opcao.id} letra={letras[indice] ?? String(indice + 1)} texto={opcao.texto}
                    selecionada={opcao.id === resposta} retorno={opcao.id === resposta ? retorno : null}
                    desativada={ocupado || avaliacao !== null} apagada={avaliacao !== null && opcao.id !== resposta}
                    acao={() => setResposta(opcao.id)} />
                ))}
              </View>}
          </Animated.View>
        )}
        {erro && <EstadoMensagem mensagem={erro} />}
      </EntradaDaEtapa>
      {(etapa === 'exercicio' || avaliacao) && <View onLayout={e => { apoioPosicao.current = e.nativeEvent.layout.y; }}><ApoioDaLicao cliente={cliente} licao={licao} avaliacao={avaliacao} /></View>}
    </Tela>
  );
}

/** Cada etapa entra deslizando da direita, como na web; com movimento reduzido, já aparece pronta. */
function EntradaDaEtapa({ children }: { children: ReactNode }) {
  const entrada = useAparecer(0, 380);
  return (
    <Animated.View style={{
      opacity: entrada, transform: [{ translateX: entrada.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
    }}>
      {children}
    </Animated.View>
  );
}

/** Barra de andamento grossa, com brilho na faixa cheia, que avança com uma mola curta; verde depois do acerto. */
function BarraDaAula({ fracao, certa }: { fracao: number; certa: boolean }) {
  const reduzir = useMovimentoReduzido();
  const [largura] = useState(() => new Animated.Value(fracao));

  useEffect(() => {
    if (reduzir !== false) {
      largura.setValue(fracao);
      return;
    }
    const animacao = Animated.spring(largura, { toValue: fracao, friction: 7, tension: 70, useNativeDriver: false });
    animacao.start();
    return () => animacao.stop();
  }, [fracao, reduzir, largura]);

  return (
    <View style={licaoEstilos.trilha}>
      <Animated.View style={[licaoEstilos.preenchimento, certa && licaoEstilos.preenchimentoCerto, {
        width: largura.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]}>
        <View style={licaoEstilos.brilho} />
      </Animated.View>
    </View>
  );
}

/** O Stu explica o conceito num balão; ele sobe e desce devagar. */
function ExplicacaoDoStu({ children }: { children: ReactNode }) {
  const balanco = useBalanco(5, 1600);
  const balao = useAparecer(120, 420, true);
  return (
    <View style={licaoEstilos.explicacao}>
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        importantForAccessibility="no" style={[licaoEstilos.stu, { transform: [{ translateY: balanco }] }]} />
      <Animated.View style={[licaoEstilos.balao, {
        opacity: balao, transform: [{ scale: balao.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }]}>
        <View style={licaoEstilos.balaoSeta} />
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Painel de retorno no rodapé: sobe com a cor do resultado; o ícone entra com um giro e, no acerto, solta confete.
 * No erro, "Tentar de novo" volta ao exercício e Continuar segue, como na web.
 */
function PainelRetorno({ avaliacao, titulo, ocupado, concluindo, tentarDeNovo, continuar, verReforco }: {
  avaliacao: Avaliacao;
  titulo: string;
  ocupado: boolean;
  concluindo: boolean;
  tentarDeNovo: () => void;
  verReforco: () => void;
  continuar: () => void;
}) {
  const certa = avaliacao.correta;
  const subida = useAparecer(0, 320, true);
  const icone = useAparecer(80, 460, true);
  const area = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, []);

  return (
    <Animated.View style={{ gap: 14, opacity: subida, transform: [{ translateY: subida.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
      <View ref={area} testID="feedback-licao" accessible accessibilityRole="alert"
        accessibilityLabel={`${titulo} ${certa ? mensagens.licao.correta : mensagens.licao.incorreta}. ${avaliacao.feedback}`}
        style={licaoEstilos.retorno}>
        <Animated.View style={[licaoEstilos.retornoIcone, !certa && licaoEstilos.retornoIconeErrado, {
          transform: [
            { scale: icone.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            { rotate: icone.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
          ],
        }]}>
          <Icone nome={certa ? 'check' : 'fechar'} tamanho={28} cor={cores.fundo} />
          {certa && <Confete quantidade={14} />}
        </Animated.View>
        <View style={licaoEstilos.retornoTextos}>
          <Text style={[licaoEstilos.retornoTitulo, !certa && licaoEstilos.retornoTituloErrado]}>{titulo}</Text>
          <Text style={estilos.texto}>{avaliacao.feedback}</Text>
        </View>
      </View>
      {!certa && <Botao variante="texto" rotulo={mensagens.estudio.verPonte} desativado={ocupado} acao={verReforco} />}
      <View style={licaoEstilos.retornoAcoes}>
        {!certa && (
          <View style={licaoEstilos.metade}>
            <Botao testID="tentar-de-novo" rotulo={mensagens.licao.tentarDeNovo} desativado={ocupado} acao={tentarDeNovo} />
          </View>
        )}
        <View style={licaoEstilos.metade}>
          <Botao testID="continuar-licao" rotulo={concluindo ? mensagens.licao.concluindo : mensagens.licao.continuar}
            variante={certa ? 'sucesso' : 'texto'} desativado={ocupado} ocupado={concluindo} carregando={concluindo} acao={continuar} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Opção do exercício: cartão com relevo e a letra; depois da resposta, a escolhida fica verde (pula) ou âmbar. */
function Opcao({ id, letra, texto, selecionada, retorno, desativada, apagada, acao }: {
  id: string;
  letra: string;
  texto: string;
  selecionada: boolean;
  retorno: 'certa' | 'errada' | null;
  desativada: boolean;
  apagada: boolean;
  acao: () => void;
}) {
  const [focada, setFocada] = useState(false);
  const pulo = usePulinho(retorno === 'certa', 1.04);
  let estado = null;
  if (retorno === 'certa') estado = licaoEstilos.opcaoCerta;
  else if (retorno === 'errada') estado = licaoEstilos.opcaoErrada;
  else if (selecionada) estado = licaoEstilos.opcaoSelecionada;

  return (
    <Animated.View style={{ transform: [{ scale: pulo }], opacity: apagada ? 0.55 : 1 }}>
      <Pressable testID={`opcao-${id}`} accessibilityRole="radio" accessibilityState={{ checked: selecionada, disabled: desativada }}
        accessibilityLabel={texto} disabled={desativada} onPress={acao} onFocus={() => setFocada(true)} onBlur={() => setFocada(false)}
        style={({ pressed }) => [licaoEstilos.opcao, estado, pressed && licaoEstilos.opcaoAfundada, focada && estilos.foco]}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
          style={[licaoEstilos.letra, selecionada && licaoEstilos.letraSelecionada, retorno === 'certa' && licaoEstilos.letraCerta,
            retorno === 'errada' && licaoEstilos.letraErrada]}>
          <Text style={[licaoEstilos.letraTexto, (selecionada || retorno) && { color: cores.fundo }]}>{letra}</Text>
        </View>
        <Text style={[estilos.texto, licaoEstilos.opcaoTexto]}>{texto}</Text>
      </Pressable>
    </Animated.View>
  );
}

const licaoEstilos = StyleSheet.create({
  topo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  andamento: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trilha: { flex: 1, height: 18, borderRadius: 9, backgroundColor: cores.gelo, overflow: 'hidden' },
  preenchimento: { height: '100%', minWidth: 18, borderRadius: 9, backgroundColor: cores.acao, overflow: 'hidden' },
  preenchimentoCerto: { backgroundColor: cores.sucessoClaro },
  brilho: { position: 'absolute', top: 4, left: 10, right: 10, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.34)' },
  posicao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  etapa: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  etapaIcone: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  etapaTexto: { fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18, letterSpacing: 0.6 },
  revisao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  revisaoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  explicacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20 },
  stu: { width: 58, height: 64, marginTop: 6 },
  balao: { flex: 1, gap: 10, padding: 16, borderRadius: 22, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoSeta: { position: 'absolute', top: 24, left: -10, width: 16, height: 16, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: cores.gelo,
    borderBottomLeftRadius: 3, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  balaoTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 19, lineHeight: 24 },
  quadro: { marginTop: 20, gap: 12, padding: 18, borderRadius: 24, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  quadroExemplo: { borderColor: '#FFE3A3', backgroundColor: '#FFFAF0' },
  codigo: { padding: 14, borderRadius: 14, color: cores.fundo, backgroundColor: cores.texto, fontFamily: 'monospace', fontSize: 15, lineHeight: 22 },
  respostaCampo: { minHeight: 58, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  respostaCerta: { borderColor: cores.sucessoClaro, color: cores.sucesso, backgroundColor: '#EEFAF3' },
  respostaErrada: { borderColor: '#E3A24A', backgroundColor: '#FFF6EA' },
  opcoes: { gap: 10 },
  opcao: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, borderWidth: 2, borderBottomWidth: 5,
    borderColor: cores.gelo, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: cores.fundo },
  opcaoAfundada: { borderBottomWidth: 2, marginTop: 3 },
  opcaoSelecionada: { borderColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  opcaoCerta: { borderColor: cores.sucessoClaro, borderBottomColor: '#9AD8B5', backgroundColor: '#EEFAF3' },
  opcaoErrada: { borderColor: '#E3A24A', borderBottomColor: '#F2CF96', backgroundColor: '#FFF6EA' },
  opcaoTexto: { flex: 1, fontWeight: '700' },
  letra: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: cores.gelo, alignItems: 'center', justifyContent: 'center' },
  letraSelecionada: { borderColor: cores.acao, backgroundColor: cores.acao },
  letraCerta: { borderColor: cores.sucessoClaro, backgroundColor: cores.sucessoClaro },
  letraErrada: { borderColor: '#E3A24A', backgroundColor: '#E3A24A' },
  letraTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  rodapeCerto: { borderTopColor: 'transparent', backgroundColor: '#E3F6EA' },
  rodapeErrado: { borderTopColor: 'transparent', backgroundColor: '#FFF1E0' },
  retorno: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  retornoIcone: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4,
    borderColor: cores.sucesso, backgroundColor: cores.sucessoClaro },
  retornoIconeErrado: { borderColor: '#B4650D', backgroundColor: '#E58A1F' },
  retornoTextos: { flex: 1, minWidth: 0, gap: 2 },
  retornoTitulo: { color: cores.sucesso, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  retornoTituloErrado: { color: '#8A4B00' },
  retornoAcoes: { flexDirection: 'row', gap: 10 },
  metade: { flex: 1, minWidth: 0 },
});
