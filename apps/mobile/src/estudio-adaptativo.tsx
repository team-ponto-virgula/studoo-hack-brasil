import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  AppState,
  Platform,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from 'react-native';
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
} from '@studoo/contratos';
import { Botao, Campo, estilos } from './interface';
import { useAparecer } from './animacoes';
import { mensagens } from './mensagens';
import { cores } from './tema';
const m = mensagens.estudio;
function erroTexto(e: unknown) {
  return e instanceof ErroStudoo
    ? (mensagens.erros[e.codigo as keyof typeof mensagens.erros] ?? m.erro)
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
async function arquivo(uri: string, nome: string, tipo: string) {
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
}: {
  cliente: ClienteEstudio;
  objetivo: string;
  onProposta: (p: PropostaPlano) => void;
}) {
  const [material, setMaterial] = useState<MaterialEstudo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [erro, setErro] = useState('');
  const [detalhes, setDetalhes] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
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
        if (!p.granted) throw new Error();
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
            'application/csv',
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
      <H>{mensagens.inicio.materialTitulo}</H>
      <T>{mensagens.inicio.materialTexto}</T>
      <Text style={estilos.legenda}>{mensagens.inicio.enviarSeguro}</Text>
      <Botao variante="texto" rotulo={mensagens.inicio.detalhes} acao={()=>setDetalhes(!detalhes)}/>
      {detalhes && <View><Text style={estilos.legenda}>{m.limites}</Text><Text style={estilos.legenda}>{m.privacidade}</Text></View>}
      {!material ? (
        <>
          <Botao
            rotulo={mensagens.inicio.arquivo}
            desativado={ocupado}
            acao={() => void selecionar()}
          />
          <Botao
            rotulo={mensagens.inicio.camera}
            variante="secundario"
            desativado={ocupado}
            acao={() => void selecionar(true)}
          />
          <Botao
            rotulo={mensagens.inicio.demo}
            variante="texto"
            desativado={ocupado}
            acao={() =>
              void executar(async () => {
                const x = await cliente.materialDemo();
                if (vivo.current) setMaterial(x);
              })
            }
          />
        </>
      ) : (
        <>
          <H>{material.nome}</H>
          {material.leitura === 'demonstracao' && <T>{m.simulado}</T>}
          <T>{m.revisar}</T>
          {material.leitura === 'ocr' && <T>{m.ocr}</T>}
          {material.paginas.map((p) => (
            <View key={p.numero}>
              <Botao
                variante="texto"
                rotulo={p.rotulo ?? m.pagina(p.numero)}
                acao={() => setAberta(aberta === p.numero ? null : p.numero)}
              />
              {aberta === p.numero &&
                (p.tabela ? (
                  <ScrollView horizontal accessibilityLabel={m.tabela}>
                    <View>
                      {p.tabela.map((linha, i) => (
                        <View key={i} style={{ flexDirection: 'row' }}>
                          <Text
                            style={[estilos.texto, s.celula, { width: 60 }]}
                          >
                            {(p.numero - 1) * 40 + i + 1}
                          </Text>
                          {linha.map((c, j) => (
                            <Text
                              key={j}
                              selectable
                              style={[estilos.texto, s.celula]}
                            >
                              {c}
                            </Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <Text selectable style={estilos.texto}>
                    {p.texto}
                  </Text>
                ))}
            </View>
          ))}
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
      {!!erro && (
        <Text accessibilityRole="alert" style={estilos.texto}>
          {erro}
        </Text>
      )}
    </Card>
  );
}
function PonteDesenho() {
  const a = useAparecer(0, 500);
  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        s.ponte,
        {
          opacity: a,
          transform: [
            {
              translateY: a.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    >
      {[0, 12, 20, 12, 0].map((h, i) => (
        <View key={i} style={[s.tabua, { marginBottom: h }]} />
      ))}
    </Animated.View>
  );
}
export function ApoioDaLicao({
  cliente,
  licao,
  avaliacao,
}: {
  cliente: ClienteEstudio;
  licao: LicaoDetalhe;
  avaliacao: Avaliacao | null;
}) {
  const [apoio, setApoio] = useState<ApoioEstudo | null>(null);
  const revisaoApoio = useRef(0);
  function atualizarApoio(valor: Parameters<typeof setApoio>[0]) {
    revisaoApoio.current += 1;
    setApoio(valor);
  }
  const [texto, setTexto] = useState('');
  const [resposta, setResposta] = useState('');
  const [retorno, setRetorno] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const emExecucao = useRef(false);
  const [ensinar, setEnsinar] = useState(false);
  const [fontes, setFontes] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState('');
  const gravador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
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
      const p = await requestRecordingPermissionsAsync();
      if (!p.granted) {
        setErro(m.vozErro);
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
  const ponte = apoio?.ponte;
  const ensino = apoio?.ensino;
  return (
    <View>
      {!!licao.referencias?.length && (
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
      {(!!apoio?.erros || avaliacao?.correta === false) && (
        <Card>
          <PonteDesenho />
          <H>{ponte?.concluida ? m.pontePronta : m.ponte}</H>
          <T>{ponte?.motivo ?? m.ponteDica}</T>
          {!ponte ? (
            <Botao
              rotulo={m.construir}
              desativado={ocupado || gravando}
              acao={() =>
                void executar(async () =>
                  atualizarApoio(await cliente.criarPonte(licao.id)),
                )
              }
            />
          ) : (
            <>
              {ponte.simulado && <T>{m.simulado}</T>}
              <T>{ponte.conceito}</T>
              <View style={s.exemplo}>
                <T>{ponte.exemplo}</T>
              </View>
              <H>{ponte.exercicio.enunciado}</H>
              {ponte.exercicio.tipo !== 'lacuna' &&
                ponte.exercicio.opcoes.map((o) => (
                  <Botao
                    key={o.id}
                    rotulo={`${resposta === o.id ? '✓ ' : ''}${o.texto}`}
                    variante={resposta === o.id ? 'primario' : 'secundario'}
                    desativado={ocupado || gravando || ponte.concluida}
                    acao={() => setResposta(o.id)}
                  />
                ))}
              {!ponte.concluida && (
                <Botao
                  rotulo={m.verificar}
                  desativado={ocupado || gravando || !resposta}
                  acao={() =>
                    void executar(async () => {
                      const r = await cliente.avaliarPonte(licao.id, resposta);
                      atualizarApoio(r.apoio);
                      setRetorno(r.feedback);
                    })
                  }
                />
              )}
              <Text accessibilityLiveRegion="polite" style={estilos.texto}>
                {retorno}
              </Text>
              {ponte.concluida && <T>{m.ponteVoltar}</T>}
            </>
          )}
        </Card>
      )}
      <Card>
        <Botao
          variante="texto"
          rotulo={m.ensinar}
          desativado={gravando || ocupado}
          acao={() => setEnsinar(!ensinar)}
        />
        {ensinar && (
          <>
            <T>{m.ensinoDica}</T>
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
              <Text accessibilityLiveRegion="polite" style={estilos.texto}>
                {m.gravando} {segundos}/60 s
              </Text>
            )}
            {!!aviso && <T>{aviso}</T>}
            <Botao
              rotulo={m.enviar}
              desativado={ocupado || gravando || texto.trim().length < 20}
              acao={() =>
                void executar(async () => {
                  const r = await cliente.ensinarStu(licao.id, texto);
                  atualizarApoio((a) => ({
                    ...(a ?? { erros: 0, ponte: null }),
                    ensino: r,
                  }));
                })
              }
            />
            {ensino && (
              <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
                {ensino.simulado && <T>{m.simulado}</T>}
                <H>{m.acertos}</H>
                {ensino.acertos.map((x, i) => (
                  <T key={i}>{x}</T>
                ))}
                <H>{m.lacuna}</H>
                <T>{ensino.lacuna}</T>
                <H>{m.pergunta}</H>
                <T>{ensino.pergunta}</T>
                <H>{m.proximo}</H>
                <T>{ensino.proximoPasso}</T>
              </View>
            )}
          </>
        )}
      </Card>
      {ocupado && <T>{m.pensando}</T>}
      {!!erro && (
        <Text accessibilityRole="alert" style={estilos.texto}>
          {erro}
        </Text>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  celula: { width: 150, padding: 10, borderWidth: 1, borderColor: cores.gelo },
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
  ponte: {
    flexDirection: 'row',
    gap: 6,
    height: 65,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tabua: {
    width: 38,
    height: 18,
    borderRadius: 8,
    backgroundColor: cores.acao,
    borderBottomWidth: 4,
    borderColor: '#203487',
  },
});
