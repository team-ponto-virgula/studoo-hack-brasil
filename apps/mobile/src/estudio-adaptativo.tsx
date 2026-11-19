import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Platform,
  Text,
  TextInput,
  View,
  StyleSheet, Pressable } from 'react-native';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import {
  ErroStudoo,
  LIMITES_ESTUDIO,
  estadoInicialVozAoVivo,
  prepararExplicacaoParaAvaliacao,
  type ApoioEstudo,
  type Avaliacao,
  type ClienteEstudio,
  type EstadoSessaoVozAoVivo,
  type LicaoDetalhe,
  type MaterialEstudo,
  type PropostaPlano,
  type ProvedorIa,
} from '@studoo/contratos';
import { Botao, Campo, estilos, SeloDemonstracao, LinhaAbrir } from './interface';
import { Opcao, letras } from './opcao';
import { CadernoDoStu, CenaPonte, EtapasDoEnsino, OndasDoVolume, PaginaDoMaterial, StuAluno } from './estudio-cenas';
import { useAparecer } from './animacoes';
import { mensagens } from './mensagens';
import { avisoVozVistoAgora, lerAvisoVozVisto, marcarAvisoVozVisto } from './preferencias';
import { cores, fontes } from './tema';
import { iniciarControladorVozAoVivo, type ControladorVozAoVivo } from './voz-ao-vivo';
import { focoVisivel } from './foco';
import {
  EntradaVozAoVivo, PainelVozAoVivo, PrivacidadeVozAoVivo, provedorDaGravacao, provedorDaVozAoVivo, type ClienteElegibilidadeVoz,
  type ProvedorTexto,
} from './voz-ao-vivo-painel';
const m = mensagens.estudio;
/** A mensagem de cada código (da API, como `voz_vazia` e `voz_tempo`, ou do app, como `conexao`); fora deles, a geral. */
function erroTexto(e: unknown) {
  const codigo = e instanceof ErroStudoo ? e.codigo : (e as { codigo?: unknown } | null)?.codigo;
  return typeof codigo === 'string' && Object.hasOwn(mensagens.erros, codigo)
    ? mensagens.erros[codigo as keyof typeof mensagens.erros]
    : m.erro;
}
function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
// .estudio-card p: entrelinha de 1,6.
function T({ children }: { children: ReactNode }) {
  return <Text style={[estilos.texto, s.paragrafo]}>{children}</Text>;
}
function H({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={estilos.subtitulo}>
      {children}
    </Text>
  );
}
export async function arquivo(uri: string, nome: string, tipo: string) {
  if (Platform.OS === 'web') {
    const b = await (await fetch(uri)).blob();
    if (b.size > LIMITES_ESTUDIO.arquivoBytes)
      throw new ErroStudoo('material_invalido');
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.readAsDataURL(b);
    });
    return { nome, tipo, base64 };
  }
  const f = new File(uri);
  if (f.size > LIMITES_ESTUDIO.arquivoBytes)
    throw new ErroStudoo('material_invalido');
  return { nome, tipo, base64: await f.base64() };
}
export function MaterialParaTrilha({
  cliente,
  objetivo,
  onProposta,
  ia,
  mostrarCabeca = true,
}: {
  cliente: ClienteEstudio;
  objetivo: string;
  onProposta: (p: PropostaPlano) => void;
  /** Provedor de IA do servidor (configuracaoAcesso): o aviso de privacidade diz quem lê o material. */
  ia?: ProvedorIa;
  /** No pedido, o título já está no alto da tela: o cartão não repete (como `mostrarCabeca={false}` na web). */
  mostrarCabeca?: boolean;
}) {
  const [material, setMaterial] = useState<MaterialEstudo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [erro, setErro] = useState('');
  const [detalhes, setDetalhes] = useState(false);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  async function executar(f: () => Promise<void>) {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setOcupado(true);
    setErro('');
    try {
      await f();
    } catch (e) {
      if (vivo.current) setErro(erroTexto(e));
    } finally {
      emExecucao.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  async function selecionar(camera = false) {
    await executar(async () => {
      let uri = '',
        nome = '',
        tipo = '';
      if (camera) {
        const p = await ImagePicker.requestCameraPermissionsAsync();
        if (!p.granted) {
          // Diz como liberar, em vez do erro genérico; com "não perguntar de novo", só os ajustes do aparelho liberam.
          if (vivo.current) setErro(p.canAskAgain === false ? m.cameraBloqueada : m.cameraNegada);
          return;
        }
        const r = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
        if (r.canceled) return;
        const a = r.assets[0];
        uri = a.uri;
        nome = a.fileName ?? 'pagina.jpg';
        tipo = a.mimeType ?? 'image/jpeg';
      } else {
        const r = await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/csv',
            // O Android costuma dar estes tipos a um .csv; sem eles, o arquivo aparece apagado no seletor.
            'text/comma-separated-values',
            'application/csv',
            'application/x-csv',
            'text/x-csv',
            'text/plain',
            'application/vnd.ms-excel',
            'application/octet-stream',
          ],
          copyToCacheDirectory: true,
        });
        if (r.canceled) return;
        const a = r.assets[0];
        uri = a.uri;
        nome = a.name;
        tipo = a.mimeType ?? '';
      }
      const novo = await cliente.enviarMaterial(await arquivo(uri, nome, tipo));
      if (vivo.current) setMaterial(novo);
    });
  }
  return (
    <Card>
      {mostrarCabeca && <H>{mensagens.inicio.materialTitulo}</H>}
      {mostrarCabeca && <T>{mensagens.inicio.materialTexto}</T>}
      {/* <p class="estudio-legenda">: 13,6 na entrelinha de 1,6 e 12 de margem (dentro do respiro do cartão). */}
      <Text style={[estilos.legenda, s.legendaCartao, !mostrarCabeca && s.legendaPrimeira]}>{mensagens.inicio.enviarSeguro}</Text>
      <LinhaAbrir rotulo={mensagens.inicio.detalhes} aberto={detalhes} alternar={() => setDetalhes(!detalhes)} />
      {/* O aviso diz quem lê o material (OpenAI, DeepSeek ou ninguém, na demonstração). Antes de a configuração chegar, ou
          se ela falhar, vale o texto geral, verdadeiro em qualquer configuração. */}
      {detalhes && <View><Text style={[estilos.legenda, s.legendaCartao]}>{m.limites}</Text><Text style={[estilos.legenda, s.legendaCartao]}>{ia ? m.privacidadePorProvedor(ia) : m.privacidade}</Text></View>}
      {!material ? (
        <View style={s.acoesMaterial}>
          {/* Como .estudio-arquivo da web: contorno tracejado azul, texto à esquerda; o seletor é o do sistema. */}
          <BotaoArquivo rotulo={mensagens.inicio.arquivo} testID="escolher-arquivo" desativado={ocupado} acao={() => void selecionar()} />
          <BotaoArquivo rotulo={mensagens.inicio.camera} testID="usar-camera" desativado={ocupado} acao={() => void selecionar(true)} />
          <Botao
            rotulo={mensagens.inicio.demo}
            variante="secundario"
            desativado={ocupado}
            acao={() =>
              void executar(async () => {
                const x = await cliente.materialDemo();
                if (vivo.current) setMaterial(x);
              })
            }
          />
        </View>
      ) : (
        <>
          {/* <h3> do cartão na web: 1,1rem, entrelinha 1,3 e 20 em cima; o selo é um <p> em linha, com 12 em cima e embaixo. */}
          <Text accessibilityRole="header" style={[estilos.subtitulo, s.nomeMaterial]}>{material.nome}</Text>
          {material.leitura === 'demonstracao' && <SeloDemonstracao estilo={s.seloMaterial} />}
          <T>{m.revisar}</T>
          {material.leitura === 'ocr' && <T>{m.ocr}</T>}
          {/* Como na web (rodada 1.1): cada página num cartão, com a miniatura da foto, a tabela do CSV ou as primeiras
              linhas do texto. */}
          {material.paginas.map((p) => <PaginaDoMaterial key={p.numero} pagina={p} />)}
          <Botao
            rotulo={m.gerar}
            desativado={ocupado}
            acao={() =>
              void executar(async () => {
                const p = await cliente.proporMaterial(
                  material.id,
                  objetivo.trim() || m.objetivo,
                );
                if (vivo.current) onProposta(p);
              })
            }
          />
          <Botao
            rotulo={m.remover}
            variante="texto"
            desativado={ocupado}
            acao={() =>
              void executar(async () => {
                await cliente.excluirMaterial(material.id);
                if (vivo.current) setMaterial(null);
              })
            }
          />
        </>
      )}
      {ocupado && (
        <Text accessibilityLiveRegion="polite" style={estilos.texto}>
          {m.pensando}
        </Text>
      )}
      {/* Como na web (<p role="alert">): o erro (rede, material) é texto neutro, sem ícone; o leitor de tela vai até ele. */}
      {!!erro && <AvisoAlerta texto={erro} />}
    </Card>
  );
}
/** O aviso de erro da web (<p role="alert">): texto na cor do corpo, sem ícone, e o leitor de tela vai até ele. */
function AvisoAlerta({ texto }: { texto: string }) {
  const area = useRef<ComponentRef<typeof Text>>(null);
  useEffect(() => {
    if (area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, [texto]);
  return <Text ref={area} accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" style={estilos.texto}>{texto}</Text>;
}

function BotaoArquivo({ rotulo, testID, desativado, acao }: { rotulo: string; testID: string; desativado: boolean; acao: () => void }) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: desativado }} disabled={desativado} onPress={acao}
      onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
      style={({ pressed }) => [s.arquivo, pressed && { opacity: 0.8 }, desativado && { borderColor: cores.gelo }, focado && estilos.foco]}>
      <Text style={[s.arquivoTexto, desativado && { color: cores.textoSecundario }]}>{rotulo}</Text>
    </Pressable>
  );
}

export function ApoioDaLicao({
  cliente,
  licao,
  avaliacao,
  pedidoPonte = 0,
  ultimo = true,
  aoMostrarEnsino,
  aoConcluirPonte,
  aoMostrarRetornoPonte,
  pedidoEnsino = 0,
  aoPedirEnsino,
  aoAbrirExplique,
  aoEnsinar,
  ultimaResposta = '',
  aoMostrarCena,
  aoVoltarExercicio,
  aoMostrarProximaAcao,
  aoMostrarVoz,
}: {
  /**
   * O aviso de privacidade ou o painel da conversa ao vivo apareceu (`centro`, como o scrollIntoView center da web), ou o
   * aviso dos 30 s chegou e os controles precisam estar à vista (`perto`): onde começa e termina, a partir do topo do apoio.
   */
  aoMostrarVoz?: (topo: number, base: number, modo: 'centro' | 'perto') => void;
  /** A resposta errada em texto legível (o texto da opção, não o código): nasce como a 1ª tábua da ponte. Como na web. */
  ultimaResposta?: string;
  /** A ponte foi vencida: onde o cartão começa, a partir do topo do apoio, para a lição trazê-lo à vista antes da travessia. */
  aoMostrarCena?: (y: number) => void;
  /** "Voltar ao exercício": a ponte fecha e o exercício recolhido volta (rodada 4D da web). */
  aoVoltarExercicio?: () => void;
  /**
   * Um passo da ponte apareceu: onde ele começa e onde termina a próxima ação dele ("Ver exemplo", "Ir para o desafio",
   * "Conferir este exemplo"), a partir do topo do apoio. A lição rola para a ação ficar à vista sem a pessoa rolar.
   */
  aoMostrarProximaAcao?: (topo: number, base: number) => void;
  /** Com `configuracaoAcesso` e `sessao` (o cliente do app tem os dois), a conversa ao vivo pode aparecer, como na web. */
  cliente: ClienteEstudio & Pick<ClienteElegibilidadeVoz, 'configuracaoAcesso' | 'sessao'>;
  licao: LicaoDetalhe;
  avaliacao: Avaliacao | null;
  /** Cada vez que muda, o reforço é pedido (o "Ver outro jeito de entender" do painel de retorno), se ainda não existir. */
  pedidoPonte?: number;
  /** Último exercício da lição: só nele aparece o "Ensine ao Stu", como na web. */
  ultimo?: boolean;
  /** O retorno do "Ensine ao Stu" chegou: onde ele começa, a partir do topo do apoio (a lição rola até lá). */
  aoMostrarEnsino?: (y: number) => void;
  /** A pessoa acertou a pergunta do reforço: a lição troca o "Quase lá!" do painel. Como na web. */
  aoConcluirPonte?: () => void;
  /** O retorno da pergunta do reforço apareceu: onde ele está, a partir do topo do apoio (a lição rola até lá). */
  aoMostrarRetornoPonte?: (y: number) => void;
  /** Cada vez que muda, o "Explique" abre (o convite do painel de retorno no acerto). Como na web. */
  pedidoEnsino?: number;
  /** O "Explique" abriu pelo convite: onde o cartão começa, a partir do topo do apoio (a lição rola até lá). */
  aoPedirEnsino?: (y: number) => void;
  /** O "Explique" abriu ou fechou: a lição deixa o painel de retorno só com as ações enquanto ele está aberto. Como na web. */
  aoAbrirExplique?: (aberto: boolean) => void;
  /** A explicação foi enviada: a lição tira o convite para explicar. Como na web. */
  aoEnsinar?: () => void;
}) {
  const [apoio, setApoio] = useState<ApoioEstudo | null>(null);
  // Como na web: o retorno do "Ensine ao Stu" é o desta visita.
  const [ensino, setEnsino] = useState<ApoioEstudo['ensino']>(null);
  const cartaoEnsinoY = useRef(0);
  /** O retorno até onde a tela já rolou: rola uma vez por retorno, não a cada nova medida. */
  const ensinoRolado = useRef<ApoioEstudo['ensino']>(null);
  const revisaoApoio = useRef(0);
  function atualizarApoio(valor: Parameters<typeof setApoio>[0]) {
    revisaoApoio.current += 1;
    setApoio(valor);
  }
  const [texto, setTexto] = useState('');
  /** O rascunho mais recente, para o fim da conversa ao vivo juntar a fala com ele (como textoRef da web). */
  const textoRef = useRef('');
  textoRef.current = texto;
  const campoEnsino = useRef<ComponentRef<typeof TextInput>>(null);
  // Voz ao vivo (spec 08, parte B), como a web: a opção liberada, a etapa (entrada, aviso da primeira vez, conversa), o
  // estado que o controlador manda, o próprio controlador e o nível do microfone (-1 enquanto não há medida).
  const [vozDisponivel, setVozDisponivel] = useState(false);
  /** Quem avalia o texto (o aviso de privacidade da voz muda com a DeepSeek) e quem recebe a gravação, como na web. */
  const [provedorTextoVoz, setProvedorTextoVoz] = useState<ProvedorTexto>('openai');
  const [provedorGravacao, setProvedorGravacao] = useState<ProvedorTexto | null>(null);
  const [etapaVoz, setEtapaVoz] = useState<'inativa' | 'privacidade' | 'ativa'>('inativa');
  const [estadoVoz, setEstadoVoz] = useState<EstadoSessaoVozAoVivo>(() => estadoInicialVozAoVivo());
  const controladorVoz = useRef<ControladorVozAoVivo | null>(null);
  const [nivelVoz] = useState(() => new Animated.Value(-1));
  /** Onde o bloco da voz começa dentro do cartão do Explique, e onde os controles do painel começam e terminam nele. */
  const vozY = useRef(0);
  const controlesVoz = useRef({ topo: 0, base: 0 });
  const vozCentrada = useRef(false);
  const [resposta, setResposta] = useState('');
  const [retorno, setRetorno] = useState('');
  /** Como na web: o resultado da pergunta do reforço deixa a opção marcada verde (certa) ou âmbar (errada). */
  const [resultadoPonte, setResultadoPonte] = useState<{ id: string; correta: boolean } | null>(null);
  const cartaoPonteY = useRef(0);
  /** Onde a cena da ponte começa dentro do cartão, para a lição rolar até ela antes de o Stu atravessar. */
  const cenaY = useRef(0);
  const retornoRolado = useRef('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [ensinar, setEnsinar] = useState(false);
  const [fontes, setFontes] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState('');
  // Com o metering, as ondas da gravação sobem com o volume real do microfone (OndasDoVolume).
  const gravador = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const vivo = useRef(true);
  const ativo = useRef(false);
  useEffect(() => {
    vivo.current = true;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && ativo.current) {
        ativo.current = false;
        void gravador
          .stop()
          .catch(() => {})
          .finally(() => {
            if (vivo.current) setGravando(false);
            void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
          });
      }
    });
    return () => {
      vivo.current = false;
      sub.remove();
      if (ativo.current) {
        ativo.current = false;
        void gravador.stop().catch(() => {});
      }
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [gravador]);
  useEffect(() => {
    let ok = true;
    const revisao = revisaoApoio.current;
    cliente
      .apoioLicao(licao.id)
      .then((a) => {
        if (ok && revisao === revisaoApoio.current) setApoio(a);
      })
      .catch((e) => {
        if (ok && revisao === revisaoApoio.current) setErro(erroTexto(e));
      });
    return () => {
      ok = false;
    };
  }, [cliente, licao.id, avaliacao]);
  useEffect(() => {
    if (!gravando) return;
    const id = setInterval(() => setSegundos((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [gravando]);
  useEffect(() => {
    if (segundos >= 60 && ativo.current) void parar();
  }, [segundos]);
  async function executar(f: () => Promise<void>) {
    if (emExecucao.current) return;
    emExecucao.current = true;
    setOcupado(true);
    setErro('');
    try {
      await f();
    } catch (e) {
      if (vivo.current) setErro(erroTexto(e));
    } finally {
      emExecucao.current = false;
      if (vivo.current) setOcupado(false);
    }
  }
  async function gravar() {
    await executar(async () => {
      const p = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
      if (!p.granted) {
        // O aviso fica junto do botão Gravar, onde a pessoa está olhando.
        setAviso(m.vozErro);
        return;
      }
      const podeGravar = () =>
        vivo.current && AppState.currentState === 'active';
      if (!podeGravar()) return;
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });
        if (!podeGravar()) return;
        await gravador.prepareToRecordAsync();
        if (!podeGravar()) return;
        gravador.record();
        ativo.current = true;
        setSegundos(0);
        setGravando(true);
        // Como na web (rodada 1.3): uma gravação nova começa limpa, sem o retorno anterior nem o aviso.
        setEnsino(null);
        setAviso('');
      } catch {
        setAviso(m.vozErro);
      } finally {
        if (!ativo.current) {
          await gravador.stop().catch(() => {});
          await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        }
      }
    });
  }
  async function parar() {
    if (!ativo.current) return;
    ativo.current = false;
    await executar(async () => {
      try {
        await gravador.stop();
      } finally {
        if (vivo.current) setGravando(false);
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
      if (!gravador.uri) throw new Error();
      const web = Platform.OS === 'web';
      const r = await cliente.transcrever(
        await arquivo(
          gravador.uri,
          web ? 'explicacao.webm' : 'explicacao.m4a',
          web ? 'audio/webm' : 'audio/mp4',
        ),
      );
      if (vivo.current) {
        setTexto(r.texto);
        setAviso(m.vozRevisar);
      }
    });
  }
  useEffect(() => {
    aoAbrirExplique?.(ensinar);
    // Como o onToggle da web: fechar o Explique desliga a conversa ao vivo e volta à entrada.
    if (!ensinar) {
      controladorVoz.current?.descartar();
      controladorVoz.current = null;
      setEtapaVoz('inativa');
    }
    // Só a abertura e o fechamento avisam a lição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensinar]);
  // A opção de conversar aparece só na prévia web com a flag do servidor (e a de visitante, para visitante), como na web.
  // O aviso de privacidade já visto é lido aqui, antes do toque, para a conversa nascer dentro dele.
  useEffect(() => {
    let ligado = true;
    void provedorDaVozAoVivo(cliente).then((provedor) => {
      if (!ligado) return;
      setVozDisponivel(provedor !== null);
      if (provedor) {
        setProvedorTextoVoz(provedor);
        void lerAvisoVozVisto();
      }
    });
    void provedorDaGravacao(cliente).then((provedor) => { if (ligado) setProvedorGravacao(provedor); });
    return () => {
      ligado = false;
      controladorVoz.current?.descartar();
      controladorVoz.current = null;
    };
  }, [cliente]);
  // O foco vai para o campo depois da renderização, quando ele já voltou a ser editável (no quadro seguinte ele ainda estava
  // somente leitura e o foco se perdia).
  const [pedidoFocoCampo, setPedidoFocoCampo] = useState(0);
  useEffect(() => {
    if (pedidoFocoCampo) campoEnsino.current?.focus();
  }, [pedidoFocoCampo]);
  function focarCampoEnsino() {
    setPedidoFocoCampo((n) => n + 1);
  }
  /** Fim da conversa (Encerrar ou os 3 minutos): a fala vira a explicação e vai para o Stu, como concluirComTranscricao da web. */
  function concluirComTranscricao(bruta: string) {
    controladorVoz.current = null;
    if (!vivo.current) return;
    const rascunho = textoRef.current;
    const preparada = prepararExplicacaoParaAvaliacao(bruta, rascunho);
    setEtapaVoz('inativa');
    if (!preparada) {
      if (bruta.trim() && !rascunho.trim()) setTexto(bruta.trim());
      setAviso(m.vozAoVivo.erros.curta);
      focarCampoEnsino();
      return;
    }
    setTexto(preparada);
    void executar(async () => {
      const r = await cliente.ensinarStu(licao.id, preparada);
      atualizarApoio((a) => ({ ...(a ?? { erros: 0, ponte: null }), ensino: r }));
      setEnsino(r);
      setAviso('');
      aoEnsinar?.();
    });
  }
  function iniciarConversaAoVivo() {
    setAviso('');
    vozCentrada.current = false;
    setEtapaVoz('ativa');
    setEstadoVoz(estadoInicialVozAoVivo());
    nivelVoz.setValue(-1);
    controladorVoz.current?.descartar();
    controladorVoz.current = iniciarControladorVozAoVivo({
      licaoId: licao.id,
      cliente,
      aoMudar: (estado) => { if (vivo.current) setEstadoVoz(estado); },
      aoTempoEsgotado: concluirComTranscricao,
      aoNivelMic: (nivel) => nivelVoz.setValue(nivel),
      // A conversa caiu: o que a pessoa já disse vai para o campo, com o aviso, para completar e enviar (como a web).
      aoErroFatal: (_codigo, parcial) => {
        controladorVoz.current = null;
        if (!vivo.current || !parcial.trim()) return;
        const combinado = prepararExplicacaoParaAvaliacao(parcial, textoRef.current) ??
          [textoRef.current.trim(), parcial.trim()].filter(Boolean).join('\n\n');
        setEtapaVoz('inativa');
        setTexto(combinado);
        setAviso(m.vozAoVivo.parcialNoCampo);
        focarCampoEnsino();
      },
    });
  }
  function abrirConversaAoVivo() {
    if (!avisoVozVistoAgora()) { setEtapaVoz('privacidade'); return; }
    iniciarConversaAoVivo();
  }
  // Com o aviso dos 30 s, os controles ficam à vista (como o scrollIntoView nearest da web).
  useEffect(() => {
    if (etapaVoz !== 'ativa' || !estadoVoz.avisoTempo) return;
    const { topo, base } = controlesVoz.current;
    aoMostrarVoz?.(cartaoEnsinoY.current + 16 + vozY.current + topo, cartaoEnsinoY.current + 16 + vozY.current + base, 'perto');
    // Só a chegada do aviso move a tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapaVoz, estadoVoz.avisoTempo]);
  useEffect(() => {
    if (pedidoEnsino === 0) return;
    setEnsinar(true);
    aoPedirEnsino?.(cartaoEnsinoY.current);
    // Só o pedido do convite dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoEnsino]);
  /** A ponte em passos, como a web 4D: 1, o outro jeito de explicar; 2, o exemplo novo; 3, o desafio. */
  const [passoPonte, setPassoPonte] = useState<1 | 2 | 3>(1);
  /** O reforço deste pedido chegou: antes, o cartão diz "pensando" (e não mostra a ponte de um erro anterior). */
  const [ponteChegou, setPonteChegou] = useState(false);
  /**
   * A ponte já estava vencida quando abriu (o mesmo erro, de novo): fica para reler, com o título "Outro jeito de entender",
   * a explicação, o exemplo e "Voltar ao exercício", sem o "Entendi!" nem a travessia (defeito a da rodada 4).
   */
  const [revendo, setRevendo] = useState(false);
  /** A pessoa venceu o desafio agora, com a ponte aberta: o título vira "Entendi!" e o Stu atravessa. */
  const [venceu, setVenceu] = useState(false);
  const exemploPonte = useRef<ComponentRef<typeof View>>(null);
  const desafioPonte = useRef<ComponentRef<typeof Text>>(null);
  const exemploY = useRef(0);
  const desafioY = useRef(0);
  /** O último passo cuja próxima ação a tela já trouxe à vista (para rolar uma vez por passo, não a cada medida). */
  const passoMostrado = useRef('');
  // A ponte fechou ("Voltar ao exercício", outra etapa): a próxima abre do começo, sem a resposta nem o retorno de antes.
  useEffect(() => {
    if (pedidoPonte !== 0) return;
    setPassoPonte(1);
    setPonteChegou(false);
    setRevendo(false);
    setVenceu(false);
    setResposta('');
    setResultadoPonte(null);
    setRetorno('');
    retornoRolado.current = '';
    passoMostrado.current = '';
  }, [pedidoPonte]);
  /** Leva a próxima ação do passo para a vista (as medidas são do cartão; o cartão tem 16 de margem em cima). */
  function mostrarProximaAcao(chave: string, topo: () => number, base: () => number) {
    if (passoMostrado.current === chave) return;
    passoMostrado.current = chave;
    // As medidas dos irmãos chegam no mesmo quadro: espera um instante para ler todas.
    setTimeout(() => aoMostrarProximaAcao?.(cartaoPonteY.current + 16 + topo(), cartaoPonteY.current + 16 + base()), 30);
  }
  useEffect(() => {
    if (!venceu) return;
    aoConcluirPonte?.();
    // O alto do cartão vem para a vista antes da travessia do Stu (que começa 380 ms depois, em CenaPonte). Como na web.
    aoMostrarCena?.(cartaoPonteY.current);
    // Só a vitória dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venceu]);
  const ponte = ponteChegou ? apoio?.ponte : null;
  /** O passo à vista: tudo na vitória; explicação e exemplo para reler na ponte já vencida. */
  const etapaPonte = venceu ? 3 : revendo ? 2 : passoPonte;
  // Como na web: o título do reforço recebe o foco do leitor de tela quando o cartão aparece e quando o reforço chega.
  const tituloPonte = useRef<ComponentRef<typeof Text>>(null);
  const pontePronta = Boolean(ponte);
  useEffect(() => {
    if (pedidoPonte === 0 || !tituloPonte.current) return;
    AccessibilityInfo.sendAccessibilityEvent(tituloPonte.current, 'focus');
  }, [pedidoPonte, pontePronta]);
  // "Ver exemplo" e "Ir para o desafio": o passo novo recebe o foco (o botão tocado sai da tela). A rolagem vem da medida
  // da próxima ação de cada passo (mostrarProximaAcao).
  useEffect(() => {
    if (passoPonte === 1) return;
    const espera = setTimeout(() => {
      const alvo = passoPonte === 2 ? exemploPonte.current : desafioPonte.current;
      if (alvo) AccessibilityInfo.sendAccessibilityEvent(alvo, 'focus');
    }, 80);
    return () => clearTimeout(espera);
    // Só a mudança de passo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passoPonte]);
  // "Ver outro jeito de entender" no painel de retorno: um toque já pede o reforço (durante uma gravação, espera ela
  // acabar). O servidor devolve o guardado quando o erro é o mesmo, às vezes já vencido. Como na web.
  useEffect(() => {
    if (pedidoPonte === 0 || gravando) return;
    void executar(async () => {
      const novo = await cliente.criarPonte(licao.id);
      atualizarApoio(novo);
      setRevendo(novo.ponte?.concluida === true);
      setPonteChegou(true);
    });
    // Só o pedido e o fim da gravação disparam; o resto é lido no momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoPonte, gravando]);
  const ponteAberta = avaliacao?.correta === false && pedidoPonte > 0;
  const cartaoOrigem = !!licao.referencias?.length && (
        <Card>
          <LinhaAbrir rotulo={m.origem} aberto={fontes} alternar={() => setFontes(!fontes)} />
          {fontes &&
            licao.referencias.map((r, i) => (
              <View key={i} style={s.citacao}>
                <Text accessibilityRole="header" style={s.origemNome}>{r.nome} · {r.localizacao ?? m.pagina(r.pagina)}</Text>
                <T>{r.trecho}</T>
                {r.leitura === 'ocr' && <T>{m.ocr}</T>}
              </View>
            ))}
        </Card>
  );
  return (
    <View>
      {/* Com a ponte aberta, ela fica no alto e "De onde veio esta ideia" vem logo abaixo dela, antes do Explique (PT1). */}
      {!ponteAberta && cartaoOrigem}
      {/* Como na web: o reforço é do exercício errado agora (ou de um reforço começado e não terminado). */}
      {/* O cartão aparece quando a pessoa pede "Ver outro exemplo" no painel (ou se já há um reforço): sem botão repetido. */}
      {ponteAberta && (
        <View onLayout={(evento) => { cartaoPonteY.current = evento.nativeEvent.layout.y; }}><Card>
          <View style={s.ponteCabeca}>
            <Text ref={tituloPonte} testID="titulo-ponte" accessible accessibilityRole="header" style={[estilos.subtitulo, s.tituloPonte]}>
              {venceu ? m.pontePronta : m.ponte}
            </Text>
            <View style={s.ponteCabecaAcoes}>
              {/* Como na web (rodada 1.3): o selo de conteúdo simulado fica perto do título. */}
              {/* O selo é um <p> dentro de .estudio-card na web: 12 de margem em cima e embaixo, no meio da linha. */}
              {ponte?.simulado && <SeloDemonstracao estilo={s.seloPonte} />}
              {/* Rodada 4D: a saída da ponte fica no alto, à vista desde o começo (na vitória, ela vem embaixo da cena). */}
              {!venceu && !revendo && aoVoltarExercicio && (
                <Botao testID="ponte-voltar" variante="texto" rotulo={m.ponteVoltarExercicio} desativado={ocupado} acao={aoVoltarExercicio} estilo={s.ponteVoltar} />
              )}
            </View>
          </View>
          {/* A ponte como cena (rodada 1.2): a 1ª tábua nasce da resposta errada; as outras entram a cada passo (4D). */}
          {/* Rodada 4.2: a ponte já construída (vitória ou releitura) aparece montada, com as quatro tábuas, e a legenda sai,
              como na web no celular. Na releitura, o Stu já está do outro lado, sem travessia nova. */}
          <CenaPonte resposta={ultimaResposta} temPonte={Boolean(ponte)} exemplo={Boolean(ponte) && etapaPonte >= 2}
            desafio={Boolean(ponte) && (venceu || etapaPonte >= 3 || Boolean(resposta))}
            concluida={venceu} montada={revendo && Boolean(ponte)} semLegenda={venceu || (revendo && Boolean(ponte))}
            estilo={venceu || (revendo && Boolean(ponte)) ? s.cenaSemLegenda : s.cenaNoCartao}
            aoMedir={(y) => { cenaY.current = y; }} />
          {/* Rodada 4.3: na releitura, um aviso neutro no lugar do elogio ("Você já construiu esta ponte…"). */}
          {revendo && Boolean(ponte) && (
            <Text testID="aviso-ponte-reaberta" accessibilityLiveRegion="polite" style={[estilos.texto, s.paragrafo]}>{m.ponteReabertaAviso}</Text>
          )}
          {/* Na vitória, o retorno ("Isso!…") e a volta ao exercício ficam logo embaixo da cena, à vista com a travessia. */}
          {venceu && (
            <>
              {!!retorno && (
                <Text testID="retorno-vitoria" accessibilityLiveRegion="polite" style={[estilos.texto, s.paragrafo, { color: cores.sucesso, fontWeight: '800' }]}>{retorno}</Text>
              )}
              {aoVoltarExercicio && (
                <Botao testID="ponte-voltar-vitoria" variante="sucesso" rotulo={m.ponteVoltarExercicio} desativado={ocupado} acao={aoVoltarExercicio} />
              )}
            </>
          )}
          {/* Como na web: o retorno de uma tentativa errada aparece logo embaixo da cena (âmbar escuro, 700); a lição rola até ele. */}
          {!venceu && !!retorno && resultadoPonte && !resultadoPonte.correta && (
            <Text testID="retorno-ponte" accessibilityLiveRegion="polite" style={[estilos.texto, s.paragrafo, s.retornoPonte]}
              onLayout={(evento) => {
                if (retornoRolado.current === retorno) return;
                retornoRolado.current = retorno;
                aoMostrarRetornoPonte?.(cartaoPonteY.current + evento.nativeEvent.layout.y);
              }}>
              {retorno}
            </Text>
          )}
          {/* PT6: vencida a ponte, o cartão recolhe como na web: some a explicação, o exemplo e o desafio. */}
          {/* Como na web: o motivo some com a ponte construída (vitória e releitura). */}
          {!venceu && !(revendo && ponte) && <T>{ponte?.motivo ?? m.ponteDica}</T>}
          {venceu ? null : !ponte ? (
            <Text accessibilityLiveRegion="polite" style={estilos.texto}>{erro || m.pensando}</Text>
          ) : (
            <>
              {/* Com a ponte em foco, o painel de retorno sai da tela: a explicação nova fica sempre aqui. */}
              <T>{ponte.conceito}</T>
              {etapaPonte === 1 && (
                <View onLayout={(evento) => { const { y, height } = evento.nativeEvent.layout; mostrarProximaAcao('p1', () => 0, () => y + height); }}>
                  <Botao testID="ponte-ver-exemplo" rotulo={m.ponteVerExemplo} desativado={ocupado} acao={() => setPassoPonte(2)} />
                </View>
              )}
              {etapaPonte >= 2 && (
                <View ref={exemploPonte} accessible style={s.exemplo} onLayout={(evento) => { exemploY.current = evento.nativeEvent.layout.y; }}>
                  <Text style={[estilos.texto, s.exemploTexto]}>{ponte.exemplo}</Text>
                </View>
              )}
              {etapaPonte === 2 && !revendo && (
                <View onLayout={(evento) => { const { y, height } = evento.nativeEvent.layout; mostrarProximaAcao('p2', () => exemploY.current, () => y + height); }}>
                  <Botao testID="ponte-ir-desafio" rotulo={m.ponteIrDesafio} desativado={ocupado} acao={() => setPassoPonte(3)} />
                </View>
              )}
              {/* A ponte já vencida não repete o desafio: a pessoa relê e volta ao exercício. */}
              {revendo && aoVoltarExercicio && (
                // Como a web desde cd870b1: na releitura, "Voltar ao exercício" também é verde, a cor de acerto (W6).
                <Botao testID="ponte-voltar-revendo" variante="sucesso" rotulo={m.ponteVoltarExercicio} desativado={ocupado} acao={aoVoltarExercicio} />
              )}
              {etapaPonte >= 3 && (
                <View style={s.desafio} onLayout={(evento) => { desafioY.current = evento.nativeEvent.layout.y; }}>
                  <Text ref={desafioPonte} accessible accessibilityRole="header" style={s.perguntaDesafio}>{ponte.exercicio.enunciado}</Text>
                  {ponte.exercicio.tipo === 'multipla_escolha' && (
                    <View accessibilityRole="radiogroup" accessibilityLabel={ponte.exercicio.enunciado} style={s.opcoesDesafio}>
                      {ponte.exercicio.opcoes.map((o, posicao) => {
                        const conferida = resultadoPonte?.id === o.id ? resultadoPonte : null;
                        return (
                          <Opcao key={o.id} id={`ponte-${o.id}`} letra={letras[posicao] ?? String(posicao + 1)} texto={o.texto}
                            selecionada={resposta === o.id} retorno={conferida ? (conferida.correta ? 'certa' : 'errada') : null}
                            desativada={ocupado || gravando || venceu} apagada={venceu && !conferida}
                            acao={() => {
                              if (venceu) return;
                              setResposta(o.id);
                              setResultadoPonte(null);
                              setRetorno('');
                            }} />
                        );
                      })}
                    </View>
                  )}
                  {!venceu && (
                    <View onLayout={(evento) => { const { y, height } = evento.nativeEvent.layout; mostrarProximaAcao('p3', () => desafioY.current, () => desafioY.current + y + height); }}>
                    <Botao
                      testID="ponte-conferir"
                      // Como a web 4.2: ocupado logo no toque, com o "preparando" no lugar do rótulo.
                      rotulo={ocupado ? m.pensando : m.verificar}
                      ocupado={ocupado}
                      desativado={ocupado || gravando || !resposta}
                      acao={() =>
                        void executar(async () => {
                          const r = await cliente.avaliarPonte(licao.id, resposta);
                          atualizarApoio(r.apoio);
                          setResultadoPonte({ id: resposta, correta: r.correta });
                          setRetorno(r.feedback);
                          if (r.correta) setVenceu(true);
                        })
                      }
                    />
                    </View>
                  )}
                  {!venceu && !(resultadoPonte && !resultadoPonte.correta) && !!retorno && (
                    <Text accessibilityLiveRegion="polite" style={[estilos.texto, s.paragrafo]}>
                      {retorno}
                    </Text>
                  )}
                </View>
              )}
            </>
          )}
        </Card></View>
      )}
      {ponteAberta && cartaoOrigem}
      {ultimo && <View onLayout={(evento) => { cartaoEnsinoY.current = evento.nativeEvent.layout.y; }}><Card>
        <LinhaAbrir rotulo={m.ensinar} aberto={ensinar} desativado={gravando || ocupado} alternar={() => setEnsinar(!ensinar)} />
        {ensinar && (
          <>
            {/* O Stu como aluno (rodada 1.1): com dúvida, ouvindo enquanto grava, anotando quando o retorno chega. Na conversa
                ao vivo, ouvindo ou falando, com o estado dela no balão (como a web). */}
            <StuAluno
              estado={etapaVoz === 'ativa' ? (estadoVoz.estado === 'stu_falando' ? 'falando' : estadoVoz.estado === 'ouvindo' ? 'ouvindo' : 'aluno')
                : gravando ? 'ouvindo' : ensino ? 'anotou' : 'aluno'}
              fala={etapaVoz === 'ativa' ? m.vozAoVivo.estados[estadoVoz.estado] : undefined} />
            <EtapasDoEnsino ativa={gravando || etapaVoz === 'ativa' ? 0 : ensino ? 2 : !texto.trim() ? 0 : 1}
              primeira={vozDisponivel ? m.vozAoVivo.passoComVoz : undefined} />
            <T>{m.ensinoDica}</T>
            <Text style={[estilos.legenda, s.legendaCartao]}>{m.ensinoIdeia(licao.objetivo)}</Text>
            {(vozDisponivel || etapaVoz !== 'inativa') && (
              // As margens de 12 da web se juntam com as dos parágrafos vizinhos: aqui o vão do cartão (14) fica em 12.
              <View style={s.blocoVoz} onLayout={(evento) => { vozY.current = evento.nativeEvent.layout.y; }}>
                {vozDisponivel && etapaVoz === 'inativa' && (
                  <EntradaVozAoVivo desativado={ocupado || gravando} aoAbrir={abrirConversaAoVivo} provedor={provedorTextoVoz} />
                )}
                {etapaVoz === 'privacidade' && (
                  <PrivacidadeVozAoVivo
                    provedor={provedorTextoVoz}
                    aoAceitar={() => { void marcarAvisoVozVisto(); iniciarConversaAoVivo(); }}
                    aoCancelar={() => setEtapaVoz('inativa')}
                    aoMedir={(evento) => {
                      const { y, height } = evento.nativeEvent.layout;
                      const base = cartaoEnsinoY.current + 16 + vozY.current;
                      aoMostrarVoz?.(base + y, base + y + height, 'centro');
                    }} />
                )}
                {etapaVoz === 'ativa' && (
                  <PainelVozAoVivo
                    estado={estadoVoz}
                    nivel={nivelVoz}
                    aoAlternarMudo={() => { controladorVoz.current?.alternarMudo(); }}
                    aoEncerrar={() => {
                      const controlador = controladorVoz.current;
                      if (!controlador) return;
                      void controlador.encerrar().then(concluirComTranscricao);
                    }}
                    aoTrocar={() => {
                      controladorVoz.current?.descartar();
                      controladorVoz.current = null;
                      setEtapaVoz('inativa');
                      focarCampoEnsino();
                    }}
                    aoMedir={(evento) => {
                      // O painel vem para o centro da tela uma vez por conversa, como o scrollIntoView da web.
                      if (vozCentrada.current) return;
                      vozCentrada.current = true;
                      const { y, height } = evento.nativeEvent.layout;
                      const base = cartaoEnsinoY.current + 16 + vozY.current;
                      aoMostrarVoz?.(base + y, base + y + height, 'centro');
                    }}
                    aoMedirControles={(evento) => {
                      const { y, height } = evento.nativeEvent.layout;
                      controlesVoz.current = { topo: y, base: y + height };
                    }} />
                )}
              </View>
            )}
            <Campo
              rotulo={m.explicacao}
              estiloRotulo={s.rotuloExplicacao}
              campoRef={campoEnsino}
              multiline
              numberOfLines={5}
              maxLength={3000}
              value={texto}
              onChangeText={setTexto}
              editable={!ocupado && !gravando && etapaVoz !== 'ativa'}
              // A textarea da web (5 linhas de 24, 16 de respiro e borda de 2 em gelo, .estudio-card textarea): 156. Desligada
              // (gravando, ocupada ou com a conversa ao vivo), fica no cinza claro da textarea desativada do navegador.
              style={[s.campoEnsino, (ocupado || gravando || etapaVoz === 'ativa') && s.campoEnsinoDesligado]}
            />
            {/* Como a web (e57d54d): com a transcrição ligada, a dica diz quem recebe a gravação. */}
            {/* .estudio-acoes tem 20 em cima (o cartão põe 14). */}
            <Text style={[estilos.legenda, s.legendaCartao, { marginBottom: 6 }]}>
              {m.vozDica}{provedorGravacao ? ` ${m.vozProvedorPorProvedor(provedorGravacao)}` : ''}
            </Text>
            <Botao
              variante="secundario"
              rotulo={gravando ? m.parar : m.gravar}
              desativado={ocupado || etapaVoz === 'ativa'}
              acao={() => void (gravando ? parar() : gravar())}
            />
            {gravando && (
              <View style={s.gravando}>
                <OndasDoVolume gravador={gravador} />
                <Text accessibilityLiveRegion="polite" style={[estilos.texto, { color: cores.acao, fontWeight: '800' }]}>
                  {m.gravando} {segundos}/60 s
                </Text>
              </View>
            )}
            <Botao
              // Como a web 4.2: ocupado logo no toque.
              rotulo={ocupado ? m.pensando : m.enviar}
              ocupado={ocupado}
              desativado={ocupado || gravando || etapaVoz === 'ativa' || texto.trim().length < 20}
              acao={() =>
                void executar(async () => {
                  const r = await cliente.ensinarStu(licao.id, texto);
                  atualizarApoio((a) => ({
                    ...(a ?? { erros: 0, ponte: null }),
                    ensino: r,
                  }));
                  setEnsino(r);
                  // Como na web: o aviso da gravação sai e a lição tira o convite para explicar.
                  setAviso('');
                  aoEnsinar?.();
                })
              }
            />
            {/* Como a web (<p role="status"> depois das ações): o aviso da gravação, da permissão e da fala trazida da conversa. */}
            {!!aviso && <Text role="status" accessibilityLiveRegion="polite" style={estilos.texto}>{aviso}</Text>}
            {ensino && (
              <View
                onLayout={(evento) => {
                  if (ensinoRolado.current === ensino) return;
                  ensinoRolado.current = ensino;
                  aoMostrarEnsino?.(cartaoEnsinoY.current + evento.nativeEvent.layout.y);
                }}>
                {/* O retorno em quatro cartões, como o caderno da web; sem a IA, a nota do retorno automático no pé. */}
                <View style={s.caderno}><CadernoDoStu ensino={ensino} /></View>
              </View>
            )}
          </>
        )}
      </Card></View>}
      {ocupado && <T>{m.pensando}</T>}
      {/* Como na web (<p role="alert">): o erro (rede, voz, transcrição) é texto neutro, sem ícone; o leitor de tela vai até ele. */}
      {/* Depois do cartão, a web tem os 24 da margem dele (o cartão aqui tem 12 embaixo). */}
      {!!erro && <View style={s.depoisDoCartao}><AvisoAlerta texto={erro} /></View>}
    </View>
  );
}
const s = StyleSheet.create({
  // Depois do cartão: os 24 da margem dele na web (12 do cartão + 12). É sempre o último do bloco de apoio, que soma 12 embaixo
  // para a margem do último cartão: aqui ele devolve, e sobram os 40 da web até o rodapé (16 com a ponte aberta, como lá).
  depoisDoCartao: { marginTop: 12, marginBottom: -12 },
  // .estudio-acoes: 20 em cima (o cartão já põe 14).
  acoesMaterial: { gap: 12, marginTop: 6 },
  legendaPrimeira: { marginTop: 12, marginBottom: -2 },
  nomeMaterial: { fontSize: 17.6, lineHeight: 22.88, letterSpacing: -0.264, marginTop: 6 },
  seloMaterial: { marginTop: -2, marginBottom: 10 },
  // A pergunta do desafio da ponte como a do exercício (24 px, -1 px) e as opções no espaço da lista da aula.
  // .estudio-desafio h3 da web: 1,0625rem (17) em 800, entrelinha 1,3 e -0,015em (a regra vem depois de .estudio-card h3).
  // .estudio-retorno-ponte no erro: âmbar escuro em 700.
  retornoPonte: { color: '#7A4A00', fontWeight: '700' },
  paragrafo: { lineHeight: 25.6 },
  // O selo nunca quebra nem encolhe (bf8cf37): se não couber ao lado dele, "Voltar ao exercício" desce para a linha de baixo.
  seloPonte: { alignSelf: 'center', flexShrink: 0, marginVertical: 12 },
  // Na web, a cena vem logo depois da cabeça (10 em cima) e, sem a legenda, o parágrafo seguinte fica a 12; aqui o cartão já
  // põe 14 entre os blocos, então a cena devolve esse vão.
  cenaNoCartao: { marginTop: -14 },
  cenaSemLegenda: { marginTop: -14, marginBottom: -14 },
  perguntaDesafio: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '800', fontSize: 17, letterSpacing: -0.255, lineHeight: 22.1, marginBottom: 10 },
  // h2 do cartão (.estudio-card h2): 1,35rem (21,6), entrelinha 1,3, -0,015em e 10 embaixo.
  tituloPonte: { flexShrink: 1, fontSize: 21.6, lineHeight: 28.08, letterSpacing: -0.324, marginBottom: 10 },
  // "Voltar ao exercício" no alto da ponte: botão de texto de 16 px e 48 de altura, sem respiro lateral (bf8cf37): quando desce
  // para a linha de baixo, o texto fica alinhado à borda esquerda do selo.
  ponteVoltar: { minHeight: 48, paddingHorizontal: 0 },
  // :is(.aula-quadro, .estudio-desafio) .opcoes: vão de 12.
  opcoesDesafio: { gap: 12 },
  origemNome: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  arquivo: { minHeight: 48, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: cores.acao, borderRadius: 14 },
  arquivoTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  ponteCabeca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  // Até 600 px, .ponte-cabeca__acoes da web ocupa a linha toda: o selo à esquerda e "Voltar ao exercício" à direita; sem
  // espaço (360), o link desce (vão de 4 entre as linhas, 8 entre os dois).
  ponteCabecaAcoes: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: 4, columnGap: 8 },
  // .estudio-desafio: grade com vão de 12; o h3 tem 10 embaixo (22 até a 1ª opção) e a última opção fica a 12 do "Verificar"
  // (8 depois do degrau de 4).
  desafio: { gap: 12 },
  // .ensino-gravando: 12 em cima na web (24 do "Parar e transcrever", com o cartão pondo 14) e 12 até o "Enviar".
  gravando: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, marginBottom: -2, paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 14, backgroundColor: cores.ceu },
  campoEnsino: { minHeight: 156, textAlignVertical: 'top', borderColor: cores.gelo },
  campoEnsinoDesligado: { backgroundColor: '#FAFAFA' },
  // O campo já põe 8 entre o rótulo e a caixa; a textarea da web tem 10 em cima.
  rotuloExplicacao: { fontSize: 16, fontWeight: '400', lineHeight: 24, marginBottom: 2 },
  // <p class="estudio-legenda"> dentro de .estudio-card: 0,85rem (13,6) com entrelinha 1,6.
  legendaCartao: { fontSize: 13.6, lineHeight: 21.76 },
  blocoVoz: { marginVertical: -2 },
  // .estudio-feedback.ensino-caderno (um elemento só): 20 acima (o cartão já põe 14), a linha de 2 em gelo e 16 abaixo (o
  // padding-top de .ensino-caderno, que vem depois no CSS, vence o de 10).
  caderno: { marginTop: 6, borderTopWidth: 2, borderColor: cores.gelo, paddingTop: 16 },
  // .estudio-card: margem de 24 entre cartões (as margens se juntam na web; aqui, 12 + 12).
  card: {
    marginVertical: 12,
    padding: 18,
    gap: 14,
    borderRadius: 24,
    borderWidth: 2,
    borderBottomWidth: 5,
    borderColor: cores.gelo,
    backgroundColor: cores.fundo,
  },
  citacao: {
    borderLeftWidth: 4,
    borderColor: cores.acao,
    paddingLeft: 12,
    gap: 10,
  },
  // .estudio-exemplo: respiro de 18, raio de 16 e 16 em cima e embaixo (o cartão já põe 14); o texto com entrelinha de 24.
  exemplo: { backgroundColor: '#EEF2FF', padding: 18, borderRadius: 16, marginVertical: 2 },
  exemploTexto: { lineHeight: 24 },
});
