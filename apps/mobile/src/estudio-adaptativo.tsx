import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Platform,
  Text,
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
  type ApoioEstudo,
  type Avaliacao,
  type ClienteEstudio,
  type LicaoDetalhe,
  type MaterialEstudo,
  type PropostaPlano,
  type ProvedorIa,
} from '@studoo/contratos';
import { Botao, Campo, EstadoMensagem, estilos, SeloDemonstracao, LinhaAbrir } from './interface';
import { CadernoDoStu, CenaPonte, EtapasDoEnsino, OndasDoVolume, PaginaDoMaterial, StuAluno } from './estudio-cenas';
import { useAparecer } from './animacoes';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
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
function T({ children }: { children: ReactNode }) {
  return <Text style={estilos.texto}>{children}</Text>;
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
      <Text style={estilos.legenda}>{mensagens.inicio.enviarSeguro}</Text>
      <LinhaAbrir rotulo={mensagens.inicio.detalhes} aberto={detalhes} alternar={() => setDetalhes(!detalhes)} />
      {/* O aviso diz quem lê o material (OpenAI, DeepSeek ou ninguém, na demonstração). Antes de a configuração chegar, ou
          se ela falhar, vale o texto geral, verdadeiro em qualquer configuração. */}
      {detalhes && <View><Text style={estilos.legenda}>{m.limites}</Text><Text style={estilos.legenda}>{ia ? m.privacidadePorProvedor(ia) : m.privacidade}</Text></View>}
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
          <H>{material.nome}</H>
          {material.leitura === 'demonstracao' && <SeloDemonstracao />}
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
      {/* O erro (rede, material, voz) é o aviso das outras telas: alerta com ícone, e o leitor de tela vai até ele. */}
      {!!erro && <EstadoMensagem mensagem={erro} foco />}
    </Card>
  );
}
function BotaoArquivo({ rotulo, testID, desativado, acao }: { rotulo: string; testID: string; desativado: boolean; acao: () => void }) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: desativado }} disabled={desativado} onPress={acao}
      onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
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
}: {
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
  cliente: ClienteEstudio;
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
    // Só a abertura e o fechamento avisam a lição.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensinar]);
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
  return (
    <View>
      {/* Com a ponte aberta, ela fica no alto da tela, sem o cartão da origem antes. */}
      {!ponteAberta && !!licao.referencias?.length && (
        <Card>
          <Botao
            variante="texto"
            rotulo={m.origem}
            acao={() => setFontes(!fontes)}
          />
          {fontes &&
            licao.referencias.map((r, i) => (
              <View key={i} style={s.citacao}>
                <H>
                  {r.nome} · {r.localizacao ?? m.pagina(r.pagina)}
                </H>
                <T>{r.trecho}</T>
                {r.leitura === 'ocr' && <T>{m.ocr}</T>}
              </View>
            ))}
        </Card>
      )}
      {/* Como na web: o reforço é do exercício errado agora (ou de um reforço começado e não terminado). */}
      {/* O cartão aparece quando a pessoa pede "Ver outro exemplo" no painel (ou se já há um reforço): sem botão repetido. */}
      {ponteAberta && (
        <View onLayout={(evento) => { cartaoPonteY.current = evento.nativeEvent.layout.y; }}><Card>
          <View style={s.ponteCabeca}>
            <Text ref={tituloPonte} testID="titulo-ponte" accessible accessibilityRole="header" style={[estilos.subtitulo, { flexShrink: 1 }]}>
              {venceu ? m.pontePronta : m.ponte}
            </Text>
            <View style={s.ponteCabecaAcoes}>
              {/* Como na web (rodada 1.3): o selo de conteúdo simulado fica perto do título. */}
              {ponte?.simulado && <SeloDemonstracao />}
              {/* Rodada 4D: a saída da ponte fica no alto, à vista desde o começo (na vitória, ela vem embaixo da cena). */}
              {!venceu && aoVoltarExercicio && (
                <Botao testID="ponte-voltar" variante="texto" compacto rotulo={m.ponteVoltarExercicio} desativado={ocupado} acao={aoVoltarExercicio} />
              )}
            </View>
          </View>
          {/* A ponte como cena (rodada 1.2): a 1ª tábua nasce da resposta errada; as outras entram a cada passo (4D). */}
          {/* Rodada 4.2: a ponte já construída (vitória ou releitura) aparece montada, com as quatro tábuas, e a legenda sai,
              como na web no celular. Na releitura, o Stu já está do outro lado, sem travessia nova. */}
          <CenaPonte resposta={ultimaResposta} temPonte={Boolean(ponte)} exemplo={Boolean(ponte) && etapaPonte >= 2}
            desafio={Boolean(ponte) && (venceu || etapaPonte >= 3 || Boolean(resposta))}
            concluida={venceu} montada={revendo && Boolean(ponte)} semLegenda={venceu || (revendo && Boolean(ponte))}
            aoMedir={(y) => { cenaY.current = y; }} />
          {/* Rodada 4.3: na releitura, um aviso neutro no lugar do elogio ("Você já construiu esta ponte…"). */}
          {revendo && Boolean(ponte) && (
            <Text testID="aviso-ponte-reaberta" accessibilityLiveRegion="polite" style={[estilos.texto, { fontWeight: '700' }]}>{m.ponteReabertaAviso}</Text>
          )}
          {/* Na vitória, o retorno ("Isso!…") e a volta ao exercício ficam logo embaixo da cena, à vista com a travessia. */}
          {venceu && (
            <>
              {!!retorno && (
                <Text testID="retorno-vitoria" accessibilityLiveRegion="polite" style={[estilos.texto, { color: cores.sucesso, fontWeight: '800' }]}>{retorno}</Text>
              )}
              {aoVoltarExercicio && (
                <Botao testID="ponte-voltar-vitoria" variante="sucesso" rotulo={m.ponteVoltarExercicio} desativado={ocupado} acao={aoVoltarExercicio} />
              )}
            </>
          )}
          <T>{ponte?.motivo ?? m.ponteDica}</T>
          {!ponte ? (
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
                  <T>{ponte.exemplo}</T>
                </View>
              )}
              {etapaPonte === 2 && !revendo && (
                <View onLayout={(evento) => { const { y, height } = evento.nativeEvent.layout; mostrarProximaAcao('p2', () => exemploY.current, () => y + height); }}>
                  <Botao testID="ponte-ir-desafio" rotulo={m.ponteIrDesafio} desativado={ocupado} acao={() => setPassoPonte(3)} />
                </View>
              )}
              {/* A ponte já vencida não repete o desafio: a pessoa relê e volta ao exercício. */}
              {revendo && aoVoltarExercicio && (
                <Botao testID="ponte-voltar-revendo" rotulo={m.ponteVoltarExercicio} desativado={ocupado} acao={aoVoltarExercicio} />
              )}
              {etapaPonte >= 3 && (
                <View style={s.desafio} onLayout={(evento) => { desafioY.current = evento.nativeEvent.layout.y; }}>
                  <Text ref={desafioPonte} accessible accessibilityRole="header" style={estilos.subtitulo}>{ponte.exercicio.enunciado}</Text>
                  {ponte.exercicio.tipo === 'multipla_escolha' &&
                    ponte.exercicio.opcoes.map((o) => {
                      const conferida = resultadoPonte?.id === o.id ? resultadoPonte : null;
                      return (
                        <Botao
                          key={o.id}
                          rotulo={`${resposta === o.id ? '✓ ' : ''}${o.texto}`}
                          variante={conferida ? (conferida.correta ? 'sucesso' : 'alerta') : resposta === o.id ? 'primario' : 'secundario'}
                          // A opção certa já conferida fica à vista (verde, sem esmaecer); as outras travam.
                          desativado={ocupado || gravando || (venceu && !conferida)}
                          acao={() => {
                            if (venceu) return;
                            setResposta(o.id);
                            setResultadoPonte(null);
                            setRetorno('');
                          }}
                        />
                      );
                    })}
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
                  {!venceu && (
                    <Text accessibilityLiveRegion="polite"
                      style={[estilos.texto, resultadoPonte && retorno ? { color: resultadoPonte.correta ? cores.sucesso : cores.alerta, fontWeight: '800' } : null]}
                      onLayout={(evento) => {
                        // Como na web: o retorno de uma tentativa errada aparece no fim do cartão; a lição rola até ele.
                        if (!retorno || retornoRolado.current === retorno) return;
                        retornoRolado.current = retorno;
                        aoMostrarRetornoPonte?.(cartaoPonteY.current + desafioY.current + evento.nativeEvent.layout.y);
                      }}>
                      {retorno}
                    </Text>
                  )}
                </View>
              )}
            </>
          )}
        </Card></View>
      )}
      {ultimo && <View onLayout={(evento) => { cartaoEnsinoY.current = evento.nativeEvent.layout.y; }}><Card>
        <Botao
          variante="texto"
          rotulo={m.ensinar}
          desativado={gravando || ocupado}
          acao={() => setEnsinar(!ensinar)}
        />
        {ensinar && (
          <>
            {/* O Stu como aluno (rodada 1.1): com dúvida, ouvindo enquanto grava, anotando quando o retorno chega. */}
            <StuAluno estado={gravando ? 'ouvindo' : ensino ? 'anotou' : 'aluno'} />
            <EtapasDoEnsino ativa={ensino ? 2 : gravando || !texto.trim() ? 0 : 1} />
            <T>{m.ensinoDica}</T>
            <Text style={estilos.legenda}>{m.ensinoIdeia(licao.objetivo)}</Text>
            <Campo
              rotulo={m.explicacao}
              multiline
              numberOfLines={5}
              maxLength={3000}
              value={texto}
              onChangeText={setTexto}
              editable={!ocupado && !gravando}
              style={{ minHeight: 140, textAlignVertical: 'top' }}
            />
            <Text style={estilos.legenda}>{m.vozDica}</Text>
            <Botao
              variante="secundario"
              rotulo={gravando ? m.parar : m.gravar}
              desativado={ocupado}
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
            {!!aviso && <T>{aviso}</T>}
            <Botao
              // Como a web 4.2: ocupado logo no toque.
              rotulo={ocupado ? m.pensando : m.enviar}
              ocupado={ocupado}
              desativado={ocupado || gravando || texto.trim().length < 20}
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
            {ensino && (
              <View
                onLayout={(evento) => {
                  if (ensinoRolado.current === ensino) return;
                  ensinoRolado.current = ensino;
                  aoMostrarEnsino?.(cartaoEnsinoY.current + evento.nativeEvent.layout.y);
                }}>
                {/* O retorno em quatro cartões, como o caderno da web; sem a IA, a nota do retorno automático no pé. */}
                <CadernoDoStu ensino={ensino} />
              </View>
            )}
          </>
        )}
      </Card></View>}
      {ocupado && <T>{m.pensando}</T>}
      {/* O erro (rede, material, voz) é o aviso das outras telas: alerta com ícone, e o leitor de tela vai até ele. */}
      {!!erro && <EstadoMensagem mensagem={erro} foco />}
    </View>
  );
}
const s = StyleSheet.create({
  acoesMaterial: { gap: 12, marginTop: 20 },
  arquivo: { minHeight: 48, justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: cores.acao, borderRadius: 14 },
  arquivoTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  ponteCabeca: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ponteCabecaAcoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  desafio: { gap: 14 },
  gravando: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#EEF3FF' },
  card: {
    marginVertical: 16,
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
  exemplo: { backgroundColor: '#EEF2FF', padding: 16, borderRadius: 16 },
});
