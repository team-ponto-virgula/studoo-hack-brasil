import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { TextoComFormulas } from './texto-com-formulas';
import { AccessibilityInfo, AppState, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import {
  AUTOAVALIACOES,
  ErroStudoo,
  codificarResposta,
  conferirFala,
  contemMarcaDeFormula,
  falarTextoComFormulas,
  linhasDePassos,
  partesDaLacuna,
  semAspas,
  sintetizarAcorde,
  sintetizarBatida,
  tamanhoDaResposta,
  type ArquivoEstudo,
  type AutoAvaliacao,
  type Avaliacao,
  type ConferenciaDaFala,
  type Fala,
  type Opcao,
  type Pratica,
  type Recurso,
  type TipoTrecho,
} from '@studoo/contratos';
import { arquivo } from './estudio-adaptativo';
import { Icone } from './icone';
import { Botao, CaixaDoCampo, caixaAlta, degrauFora, estilos, RolagemDaTela } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import { Stu } from './mascote';
import { tocaSons } from './sons';

/*
 * Formatos da aula no app, com os mesmos dados e a mesma sequência da web (src/app/aula.tsx), adaptados ao toque:
 * trechos com o visual do conteúdo, frases para ouvir (voz do aparelho), acorde com diagrama e som sintetizado, linha
 * do tempo, foto do material, ordenar, associar, verdadeiro ou falso, resposta aberta e a prática com cronômetro.
 */

const t = mensagens.licao;

/**
 * Lê a fala em voz alta com a voz do aparelho, no idioma dela. `aoTerminar` avisa quando a voz acaba (ou é
 * interrompida), com uma reserva pelo tamanho da frase, como na web. Como na web, uma fala que falha ou acaba em menos
 * de 250 ms conta como "sem voz" (o aparelho não tem voz para o idioma): `aoTerminar(true)`.
 */
function falar(fala: Fala, devagar: boolean, aoTerminar?: (semVoz: boolean) => void) {
  let reserva: ReturnType<typeof setTimeout> | undefined;
  let terminou = false;
  // Enquanto a voz lê, o som de fundo abaixa (spec 12): uma saída por entrada, pelo fim, pela parada, pelo erro ou pela
  // reserva, como na web.
  let saiuDaFala = false;
  const sairDaFala = () => { if (!saiuDaFala) { saiuDaFala = true; tocaSons.sairDeFala(); } };
  const inicio = Date.now();
  const fim = (falhou: boolean) => {
    if (terminou) return;
    terminou = true;
    if (reserva) clearTimeout(reserva);
    sairDaFala();
    aoTerminar?.(falhou || Date.now() - inicio < 250);
  };
  try {
    void Speech.stop();
    tocaSons.entrarEmFala();
    reserva = setTimeout(() => fim(false), Math.max(1500, (fala.texto.length * 90) / (devagar ? 0.6 : 0.95)));
    Speech.speak(fala.texto, {
      language: fala.idioma, rate: devagar ? 0.6 : 0.95,
      onDone: () => fim(false),
      onStopped: () => { terminou = true; if (reserva) clearTimeout(reserva); sairDaFala(); aoTerminar?.(false); },
      onError: () => fim(true),
    });
  } catch {
    fim(true);
    AccessibilityInfo.announceForAccessibility(t.audio.semVoz);
  }
}

/** O que está tocando agora (normal ou devagar), para o chip mostrar "Tocando…", e se o aparelho ficou sem voz. */
function useTocando(fala: Fala) {
  const [tocando, setTocando] = useState<'normal' | 'devagar' | null>(null);
  const [semVoz, setSemVoz] = useState(false);
  const tocar = (devagar: boolean) => {
    setTocando(devagar ? 'devagar' : 'normal');
    setSemVoz(false);
    falar(fala, devagar, (faltou) => { setTocando(null); if (faltou) setSemVoz(true); });
  };
  return [tocando, tocar, semVoz] as const;
}

/** Para a voz (ao sair da aula ou da etapa). */
/**
 * Caixa tocável com degrau, como os cartões da web (ordenar, associar, verdadeiro ou falso, "como foi"): a face com a borda
 * de 2 que fecha em volta e o degrau de 4 por fora, na cor da sombra da web (0 4px 0), sem ocupar lugar embaixo.
 */
function CartaoDegrau({ face, corDegrau, raio = 14, estiloFora, children, ...resto }: Omit<PressableProps, 'style' | 'children'> & {
  face: StyleProp<ViewStyle>; corDegrau: string; raio?: number; estiloFora?: StyleProp<ViewStyle>; children: ReactNode;
}) {
  return (
    <Pressable {...resto} style={({ pressed }) => [degrauFora(4, raio, corDegrau, pressed), estiloFora]}>
      <View style={face}>{children}</View>
    </Pressable>
  );
}

export function pararVoz() {
  try {
    void Speech.stop();
  } catch {
    // Sem voz no aparelho: nada para parar.
  }
}

/**
 * Toca o acorde: o WAV sintetizado (o mesmo da web) vai para um arquivo temporário e toca com o expo-audio. Na prévia
 * web do app, toca direto como Blob.
 */
/** O som que está tocando: dá para parar e saber em que segundo ele está (para o guia da batida). */
type SomTocando = { parar: () => void; tempo: () => number };

/** Duração da batida (72 por minuto, quatro tempos por compasso), com o fim do som. */
const duracaoDaBatida = (compassos: number) => compassos * 4 * (60 / 72) + 1.6;

async function tocarSom(som: 'acorde' | 'batida', casas: number[], compassos = 2): Promise<SomTocando> {
  const bytes = som === 'acorde' ? sintetizarAcorde(casas) : sintetizarBatida(casas, { compassos });
  // O acorde e a batida abaixam o som de fundo enquanto tocam (spec 12, como na web): uma saída por entrada, no fim, na
  // parada ou no erro. A entrada vem antes do modo de áudio desta tela (o toca-sons não mexe no modo durante a fala).
  tocaSons.entrarEmFala();
  let saiu = false;
  const sairDaFala = () => { if (!saiu) { saiu = true; tocaSons.sairDeFala(); } };
  try {
    return await tocarArquivo(som, bytes, compassos, casas, sairDaFala);
  } catch (erro) {
    sairDaFala();
    throw erro;
  }
}

async function tocarArquivo(som: 'acorde' | 'batida', bytes: Uint8Array, compassos: number, casas: number[], aoTerminar: () => void): Promise<SomTocando> {
  if (Platform.OS === 'web') {
    const Reprodutor = (globalThis as unknown as { Audio: new (url: string) => { play: () => Promise<void>; pause: () => void; currentTime: number;
      addEventListener: (tipo: string, ouvinte: () => void, opcoes?: { once?: boolean }) => void } }).Audio;
    const audio = new Reprodutor(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/wav' })));
    for (const tipo of ['ended', 'pause', 'error']) audio.addEventListener(tipo, aoTerminar, { once: true });
    await audio.play();
    return { parar: () => audio.pause(), tempo: () => audio.currentTime };
  }
  const arquivo = new File(Paths.cache, `${som}-${som === 'batida' ? `${compassos}-` : ''}${casas.map((casa) => casa + 1).join('')}.wav`);
  if (!arquivo.exists) {
    arquivo.create({ overwrite: true });
    await arquivo.write(bytes);
  }
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  const reprodutor = createAudioPlayer({ uri: arquivo.uri });
  reprodutor.play();
  const liberar = setTimeout(() => { reprodutor.remove(); aoTerminar(); }, som === 'acorde' ? 4000 : (duracaoDaBatida(compassos) + 2) * 1000);
  return {
    parar: () => {
      clearTimeout(liberar);
      reprodutor.pause();
      reprodutor.remove();
      aoTerminar();
    },
    tempo: () => reprodutor.currentTime,
  };
}

/** Chip de ação pequeno, com relevo: ouvir, devagar, mostrar o texto. */
function Chip({ rotulo, acao, icone, destaque = false, grande = false, nomeAcessivel }: {
  rotulo: string;
  acao: () => void;
  icone?: 'som';
  destaque?: boolean;
  grande?: boolean;
  nomeAcessivel?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={nomeAcessivel ?? rotulo} onPress={acao}
      style={({ pressed }) => [formatos.chip, destaque && formatos.chipDestaque, grande && formatos.chipGrande, pressed && formatos.chipAfundado]}>
      {icone && <Icone nome={icone} tamanho={grande ? 22 : 18} cor={destaque ? cores.acaoEscura : cores.textoSecundario} />}
      <Text style={[formatos.chipTexto, destaque && { color: cores.acaoEscura }, grande && { fontSize: 16 }]}>{rotulo}</Text>
    </Pressable>
  );
}

export function BotoesOuvir({ fala }: { fala: Fala }) {
  const [tocando, tocar, semVoz] = useTocando(fala);
  return (
    <View style={{ gap: 6 }}>
      <View style={formatos.ouvir}>
        <Chip rotulo={tocando === 'normal' ? t.audio.tocando : t.audio.ouvir} icone="som" destaque nomeAcessivel={t.audio.ouvirFrase(fala.texto)}
          acao={() => tocar(false)} />
        <Chip rotulo={tocando === 'devagar' ? t.audio.tocando : t.audio.devagar} nomeAcessivel={t.audio.ouvirDevagar(fala.texto)} acao={() => tocar(true)} />
      </View>
      {/* Como na web: sem voz para a frase no aparelho, o aviso aparece no lugar do silêncio. */}
      {semVoz && <Text accessibilityLiveRegion="polite" style={formatos.avisoSemVoz}>{t.audio.semVozFrase}</Text>}
    </View>
  );
}

/** Exercício de escuta: o áudio primeiro; o texto aparece quando a pessoa pede. Depois do acerto, o texto e a tradução
 * ficam à vista (antes, a tradução entregaria a resposta), como na web. */
export function Escuta({ fala, acertou = false }: { fala: Fala; acertou?: boolean }) {
  const [mostrar, setMostrar] = useState(false);
  const [tocando, tocar, semVoz] = useTocando(fala);
  // Como na web: sem voz no aparelho, o texto da escuta aparece sozinho (a pessoa não fica sem a frase).
  const verTexto = mostrar || acertou || semVoz;
  return (
    <View style={formatos.escuta}>
      <View style={formatos.rotuloLinha}>
        <Icone nome="som" tamanho={16} cor={cores.acaoEscura} />
        <Text style={[formatos.rotuloCaixa, { color: cores.acaoEscura }, caixaAlta]}>{t.audio.escuta}</Text>
      </View>
      <View style={formatos.ouvir}>
        <Chip rotulo={tocando === 'normal' ? t.audio.tocando : t.audio.ouvirExercicio} icone="som" destaque grande acao={() => tocar(false)} />
        <Chip rotulo={tocando === 'devagar' ? t.audio.tocando : t.audio.devagar} grande acao={() => tocar(true)} />
      </View>
      {semVoz && <Text accessibilityLiveRegion="polite" style={formatos.avisoSemVoz}>{t.audio.semVozFrase}</Text>}
      {!acertou && !semVoz && (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: mostrar }} aria-expanded={mostrar} onPress={() => setMostrar((atual) => !atual)} style={formatos.linkAlvo}>
          <Text style={formatos.link}>{mostrar ? t.audio.esconderTexto : t.audio.mostrarTexto}</Text>
        </Pressable>
      )}
      {verTexto && <Text selectable style={formatos.fraseGrande}>{fala.texto}</Text>}
      {verTexto && fala.pronuncia && <Text style={formatos.pronuncia}>{fala.pronuncia}</Text>}
      {acertou && fala.traducao && <Text style={[estilos.legenda, { fontWeight: '700' }]}>{fala.traducao}</Text>}
    </View>
  );
}

/** Ouça e repita: cada frase com a tradução e os botões de ouvir. */
/** Quem transcreve a fala gravada (a rota de voz do servidor), dado pela lição; sem ela, o "Falar" não aparece. */
type Transcritor = (entrada: ArquivoEstudo & { idioma?: string }) => Promise<{ texto: string }>;
export const TranscritorContexto = createContext<Transcritor | null>(null);

/**
 * O aviso do "Falar" para cada falha da rota de voz: sem provedor de voz, não ouviu nada, demorou, falhou, limite de
 * pedidos, conexão. Demorou e falhou têm textos próprios do "Falar" (`erros.falar_voz_*`, rodada 3A.2): os `erros.voz_*`
 * mandam escrever a explicação, o que só existe no Explique.
 */
export function avisoDaFala(falha: unknown): string {
  const codigo = falha instanceof ErroStudoo ? falha.codigo : (falha as { codigo?: unknown } | null)?.codigo;
  switch (codigo) {
    case 'voz_indisponivel': return t.audio.falaPrecisaIa;
    case 'voz_vazia': return t.audio.naoOuviu;
    case 'limite_estudio': return mensagens.erros.limite_estudio;
    case 'conexao': return mensagens.erros.conexao;
    case 'voz_tempo': return mensagens.erros.falar_voz_tempo;
    case 'voz_falha': return mensagens.erros.falar_voz_falha;
    default: return t.audio.naoOuviu;
  }
}

function textoDaConferencia(conferencia: ConferenciaDaFala): string {
  const palavras = conferencia.faltaram.map((palavra) => `“${palavra}”`).join(', ');
  if (conferencia.nota === 'otima') return t.audio.falaOtima;
  return conferencia.nota === 'quase' ? t.audio.falaQuase(palavras) : t.audio.falaTente(palavras);
}

type Conferido = { dito: string; conferencia: ConferenciaDaFala } | null;

function ResultadoDaFala({ resultado, erro }: { resultado: Conferido; erro: string | null }) {
  if (!resultado && !erro) return null;
  const nota = resultado?.conferencia.nota ?? 'erro';
  return (
    <Text accessibilityLiveRegion="polite" style={[formatos.falaResultado, nota === 'otima' ? formatos.falaOtima : nota === 'quase' ? formatos.falaQuase : formatos.falaTente]}>
      {resultado
        ? `${t.audio.voceDisse(resultado.dito)} · ${t.audio.acertosFala(resultado.conferencia.acertos, resultado.conferencia.total)}. ${textoDaConferencia(resultado.conferencia)}`
        : erro}
    </Text>
  );
}

type Reconhecimento = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((evento: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((evento: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
const classeDoReconhecimento = () => {
  const janela = globalThis as unknown as { SpeechRecognition?: new () => Reconhecimento; webkitSpeechRecognition?: new () => Reconhecimento };
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
};

/** Na prévia no navegador: o reconhecimento de voz do navegador, como na web. */
function FalarNoNavegador({ fala }: { fala: Fala }) {
  const [ouvindo, setOuvindo] = useState(false);
  const [resultado, setResultado] = useState<Conferido>(null);
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimento = useRef<Reconhecimento | null>(null);
  const prazo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recebeu = useRef(false);
  useEffect(() => () => {
    reconhecimento.current?.abort();
    clearTimeout(prazo.current);
  }, []);
  const Classe = classeDoReconhecimento();
  if (!Classe) return null;
  /** Termina a escuta; sem nada ouvido, avisa (como na web). */
  function encerrar() {
    clearTimeout(prazo.current);
    setOuvindo(false);
    if (!recebeu.current) setErro((atual) => atual ?? t.audio.naoOuviu);
  }
  function ouvir() {
    if (!Classe) return;
    recebeu.current = false;
    const novo = new Classe();
    novo.lang = fala.idioma;
    novo.interimResults = false;
    novo.maxAlternatives = 3;
    novo.continuous = false;
    novo.onresult = (evento) => {
      recebeu.current = true;
      const melhor = Array.from(evento.results[0] ?? [], ({ transcript }) => transcript.trim()).filter(Boolean)
        .map((dito) => ({ dito, conferencia: conferirFala(fala.texto, dito, fala.idioma) }))
        .sort((a, b) => b.conferencia.acertos - a.conferencia.acertos)[0];
      if (melhor) setResultado(melhor);
      else setErro(t.audio.naoOuviu);
    };
    novo.onerror = (evento) => setErro(evento.error === 'not-allowed' || evento.error === 'service-not-allowed' ? t.audio.microfoneBloqueado : t.audio.naoOuviu);
    novo.onend = encerrar;
    reconhecimento.current = novo;
    setErro(null);
    setResultado(null);
    setOuvindo(true);
    prazo.current = setTimeout(() => {
      novo.abort();
      encerrar();
    }, 8000);
    try {
      novo.start();
    } catch {
      encerrar();
    }
  }
  function parar() {
    reconhecimento.current?.stop();
    clearTimeout(prazo.current);
    prazo.current = setTimeout(encerrar, 1500);
  }
  return (
    <>
      <Chip rotulo={ouvindo ? t.audio.ouvindo : t.audio.falar} nomeAcessivel={t.audio.falarFrase(fala.texto)}
        acao={() => (ouvindo ? parar() : ouvir())} />
      <ResultadoDaFala resultado={resultado} erro={erro} />
    </>
  );
}

/**
 * No aparelho: grava (até 8 s, como o reconhecimento da web), a rota de voz transcreve no idioma da frase e a frase é
 * conferida. Cada falha da voz tem o seu aviso (`avisoDaFala`). Um toque duplo não abre duas gravações; ir para o
 * segundo plano ou sair da etapa para a gravação sem enviar e devolve o modo de áudio, como no "Explique".
 */
function FalarNoAparelho({ fala, transcrever }: { fala: Fala; transcrever: Transcritor }) {
  const gravador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [estado, setEstado] = useState<'parado' | 'ouvindo' | 'conferindo'>('parado');
  const [resultado, setResultado] = useState<Conferido>(null);
  const [erro, setErro] = useState<string | null>(null);
  const limite = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Uma ação por vez: começar, terminar ou descartar (o estado só muda depois das esperas). */
  const emCurso = useRef(false);
  const gravando = useRef(false);
  const vivo = useRef(true);

  /** Para a gravação sem enviar nada (segundo plano, fim da etapa) e devolve o modo de áudio. */
  async function descartar() {
    if (limite.current) clearTimeout(limite.current);
    if (!gravando.current) return;
    gravando.current = false;
    await gravador.stop().catch(() => undefined);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    if (vivo.current) setEstado('parado');
  }

  useEffect(() => {
    vivo.current = true;
    const assinatura = AppState.addEventListener('change', (atual) => { if (atual !== 'active') void descartar(); });
    return () => {
      vivo.current = false;
      assinatura.remove();
      void descartar();
    };
    // descartar lê as referências do momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gravador]);

  async function comecar() {
    if (emCurso.current || gravando.current) return;
    emCurso.current = true;
    setErro(null);
    setResultado(null);
    try {
      const permissao = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
      if (!permissao.granted) {
        // Como na web: sem a permissão, o aviso diz onde liberar (nos ajustes do app), em vez de "confira a permissão".
        setErro(t.audio.microfoneBloqueado);
        return;
      }
      // A permissão pode chegar com o app já em segundo plano ou a etapa fechada: aí não grava.
      if (!vivo.current || AppState.currentState !== 'active') return;
      try {
        pararVoz();
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await gravador.prepareToRecordAsync();
        if (!vivo.current || AppState.currentState !== 'active') {
          await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
          return;
        }
        gravador.record();
        gravando.current = true;
        setEstado('ouvindo');
        limite.current = setTimeout(() => void terminar(), 8_000);
      } catch {
        setErro(t.audio.semMicrofone);
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
    } finally {
      emCurso.current = false;
    }
  }

  async function terminar() {
    if (limite.current) clearTimeout(limite.current);
    if (emCurso.current || !gravando.current) return;
    emCurso.current = true;
    gravando.current = false;
    setEstado('conferindo');
    try {
      await gravador.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (!gravador.uri) throw new Error();
      // O idioma da frase (BCP 47, como en-US) evita que um inglês curto volte transcrito em português.
      const { texto } = await transcrever({ ...await arquivo(gravador.uri, 'fala.m4a', 'audio/mp4'), idioma: fala.idioma });
      if (vivo.current) setResultado({ dito: texto, conferencia: conferirFala(fala.texto, texto, fala.idioma) });
    } catch (falha) {
      if (vivo.current) setErro(avisoDaFala(falha));
    } finally {
      emCurso.current = false;
      if (vivo.current) setEstado('parado');
    }
  }

  return (
    <>
      <Chip rotulo={estado === 'ouvindo' ? t.audio.ouvindo : estado === 'conferindo' ? t.avaliando : t.audio.falar}
        nomeAcessivel={t.audio.falarFrase(fala.texto)}
        acao={() => void (estado === 'ouvindo' ? terminar() : estado === 'parado' ? comecar() : undefined)} />
      <ResultadoDaFala resultado={resultado} erro={erro} />
    </>
  );
}

/** Falar e conferir a pronúncia: no navegador, pelo reconhecimento de voz; no aparelho, pela rota de voz (com a IA). */
function BotaoFalar({ fala }: { fala: Fala }) {
  const transcrever = useContext(TranscritorContexto);
  if (Platform.OS === 'web') return <FalarNoNavegador fala={fala} />;
  return transcrever ? <FalarNoAparelho fala={fala} transcrever={transcrever} /> : null;
}

export function Falas({ falas }: { falas: Fala[] }) {
  return (
    <View style={formatos.secao}>
      <Text accessibilityRole="header" style={[formatos.rotuloCaixa, caixaAlta]}>{t.audio.falasTitulo}</Text>
      {falas.some(({ pronuncia }) => pronuncia) && <Text style={estilos.legenda}>{t.audio.comoLerPronuncia}</Text>}
      {falas.map((fala, posicao) => (
        <View key={posicao} style={formatos.fala}>
          <Text selectable style={formatos.falaTexto}>{fala.texto}</Text>
          {fala.pronuncia && <Text accessibilityLabel={`${t.audio.pronuncia}: ${fala.pronuncia}`} style={formatos.pronuncia}>{fala.pronuncia}</Text>}
          {fala.traducao && <Text style={estilos.legenda}>{fala.traducao}</Text>}
          <BotoesOuvir fala={fala} />
          <View style={formatos.ouvir}><BotaoFalar fala={fala} /></View>
        </View>
      ))}
    </View>
  );
}

/**
 * Texto com as frases entre aspas no idioma da lição tocáveis: um toque e a voz do aparelho fala a frase. Como na web.
 * Numa lição em português, o texto fica como está.
 */
export function TextoComFalas({ texto, idioma, estilo }: { texto: string; idioma?: string; estilo?: object }) {
  // Em português (a matemática), a fórmula em linha no meio da frase (spec 15); as frases para ouvir são das outras línguas.
  if (!idioma || idioma.toLowerCase().startsWith('pt')) return <TextoComFormulas texto={texto} estilo={estilo as StyleProp<TextStyle>} />;
  const partes = texto.split(/“([^”]+)”/);
  const tocaveis = partes.some((parte, indice) => indice % 2 === 1 && !/[ãõçáéíóúâêôà]/i.test(parte));
  return (
    <>
    <Text style={estilo}>
      {partes.map((parte, indice) => {
        if (indice % 2 === 0) return parte;
        if (/[ãõçáéíóúâêôà]/i.test(parte)) return `“${parte}”`;
        return (
          <Text key={indice} accessibilityRole="button" accessibilityLabel={t.audio.ouvirFrase(parte)} suppressHighlighting={false}
            onPress={() => falar({ texto: parte, idioma }, false)} style={formatos.falaInline}>
            “{parte}”
          </Text>
        );
      })}
    </Text>
    {tocaveis && <Text style={estilos.legenda}>{t.audio.toqueParaOuvir}</Text>}
    </>
  );
}

/** Na conclusão: as frases da lição, com a tradução, para ouvir mais uma vez (o "Falar" fica na aula). Como na web. */
export function FrasesDaLicao({ falas }: { falas: Fala[] }) {
  return (
    <View testID="frases-da-licao" style={formatos.secao}>
      <Text accessibilityRole="header" style={[formatos.rotuloCaixa, caixaAlta]}>{t.frasesDaLicao}</Text>
      {falas.some(({ pronuncia }) => pronuncia) && <Text style={estilos.legenda}>{t.audio.comoLerPronuncia}</Text>}
      {falas.map((fala, posicao) => (
        <View key={posicao} style={formatos.fala}>
          <Text selectable style={formatos.falaTexto}>{fala.texto}</Text>
          {fala.pronuncia && <Text accessibilityLabel={`${t.audio.pronuncia}: ${fala.pronuncia}`} style={formatos.pronuncia}>{fala.pronuncia}</Text>}
          {fala.traducao && <Text style={estilos.legenda}>{fala.traducao}</Text>}
          <BotoesOuvir fala={fala} />
        </View>
      ))}
    </View>
  );
}

/** Quanto a barra da lacuna desce da linha de base: o lugar de um sublinhado (0,12 do tamanho da letra). */
export function deslocamentoDaLacuna(fonte: number) {
  return Math.round(fonte * 0.12 * 10) / 10;
}

/** Texto com as lacunas destacadas (um espaço sublinhado). */
/** `preenchimento`: o que a pessoa escreve na lacuna, no lugar do espaço, enquanto digita. Como na web. */
function ComLacunas({ texto, estilo, preenchimento, puro = false }: { texto: string; estilo?: StyleProp<TextStyle>; preenchimento?: string; puro?: boolean }) {
  const partes = partesDaLacuna(texto);
  // Fora do código, o texto em volta de cada lacuna pode trazer fórmula marcada ($…$): ela é desenhada em linha, e o leitor ouve a
  // fala dela no rótulo do trecho inteiro (as fórmulas desenhadas não têm texto para o leitor).
  const comFormula = !puro && partes.some((parte) => contemMarcaDeFormula(parte));
  const rotulo = comFormula ? partes.map((parte) => falarTextoComFormulas(parte)).join(preenchimento ? ` ${preenchimento} ` : ' lacuna ') : undefined;
  // Como .trecho-lacuna da web: a lacuna vazia é uma barra de 3,2em × 3 px na cor do texto a 70%, com 0,15em dos lados.
  // Banca P2-3: a barra fica na linha de base do texto em volta, como um sublinhado ("Excuse me, ___ is the museum?"); antes ela
  // descia meia linha e ficava abaixo das letras. A barra em linha nasce com a base na linha de base: desce só 0,12em.
  const plano = StyleSheet.flatten(estilo) ?? {};
  const fonte = typeof plano.fontSize === 'number' ? plano.fontSize : 16;
  const barra: ViewStyle = { width: fonte * 3.2, height: 3, marginHorizontal: fonte * 0.15, opacity: 0.7,
    backgroundColor: typeof plano.color === 'string' ? plano.color : cores.texto, transform: [{ translateY: deslocamentoDaLacuna(fonte) }] };
  return (
    <Text selectable style={estilo} accessibilityLabel={rotulo}>
      {partes.map((parte, posicao) => (
        <Text key={posicao}>
          {comFormula ? <TextoComFormulas texto={parte} estilo={estilo} /> : parte}
          {posicao < partes.length - 1 && (preenchimento
            ? <Text style={[formatos.lacuna, formatos.lacunaPreenchida]}>{preenchimento}</Text>
            : <View accessible accessibilityLabel="lacuna" style={barra} />)}
        </Text>
      ))}
    </Text>
  );
}

/** Trecho no visual do conteúdo: só o código usa fonte monoespaçada. */
export function Trecho({ texto, tipo = 'frase', fala, preenchimento }: { texto: string; tipo?: TipoTrecho; fala?: Fala; preenchimento?: string }) {
  switch (tipo) {
    case 'codigo':
      return <ComLacunas texto={texto} estilo={formatos.codigo} preenchimento={preenchimento} puro />;
    case 'citacao':
      return (
        <View style={formatos.citacao}>
          <Text style={formatos.aspas} importantForAccessibility="no" accessibilityElementsHidden>“</Text>
          <ComLacunas texto={semAspas(texto)} estilo={formatos.citacaoTexto} preenchimento={preenchimento} />
        </View>
      );
    case 'formula':
      return <View style={formatos.formula}><ComLacunas texto={texto} estilo={formatos.formulaTexto} preenchimento={preenchimento} /></View>;
    case 'passos':
      // Como na web: a lacuna de cada passo aparece como espaço sublinhado e recebe o que a pessoa digita.
      return <Passos passos={linhasDePassos(texto)} preenchimento={preenchimento} />;
    default:
      return (
        <View style={[formatos.frase, partesDaLacuna(texto).length > 1 && formatos.fraseComLacuna]}>
          <ComLacunas texto={texto} estilo={formatos.fraseTexto} preenchimento={preenchimento} />
          {fala && <BotoesOuvir fala={fala} />}
        </View>
      );
  }
}

/** Passo a passo numerado (demonstração e trechos em passos). */
export function Passos({ passos, titulo, preenchimento }: { passos: string[]; titulo?: string; preenchimento?: string }) {
  return (
    <View style={formatos.secao}>
      {titulo && <Text accessibilityRole="header" style={[formatos.rotuloCaixa, caixaAlta]}>{titulo}</Text>}
      {passos.map((passo, posicao) => (
        <View key={posicao} style={formatos.passo}>
          <View style={formatos.passoNumero} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text style={formatos.passoNumeroTexto}>{posicao + 1}</Text>
          </View>
          <ComLacunas texto={passo} estilo={[estilos.texto, formatos.passoTexto]} preenchimento={preenchimento} />
        </View>
      ))}
    </View>
  );
}

/** Recurso do exemplo: acorde (diagrama e som), linha do tempo ou a foto do material. `longa`: na prática, a batida toca
 * oito compassos (uns 30 s) para tocar junto, como na web. */
export function RecursoDaLicao({ recurso, longa = false, semBatida = false }: { recurso: Recurso; longa?: boolean; semBatida?: boolean }) {
  if (recurso.tipo === 'acorde') return <DiagramaAcorde recurso={semBatida ? { ...recurso, batida: false } : recurso} longa={longa} />;
  if (recurso.tipo === 'fracao') {
    const descricao = t.recursos.fracaoDescricao(recurso.numerador, recurso.denominador);
    return (
      <View style={formatos.fracao}>
        <View style={formatos.fracaoBarra} accessible accessibilityRole="image" accessibilityLabel={`${recurso.numerador}/${recurso.denominador}: ${descricao}`}>
          {Array.from({ length: recurso.denominador }, (_, posicao) => (
            <View key={posicao} style={[formatos.fracaoParte, posicao < recurso.numerador && formatos.fracaoCheia]} />
          ))}
        </View>
        <View style={formatos.fracaoLegenda}>
          <Text style={formatos.fracaoRotulo}>{recurso.rotulo ?? `${recurso.numerador}/${recurso.denominador}`}</Text>
          <Text style={estilos.legenda}>{descricao}</Text>
        </View>
      </View>
    );
  }
  if (recurso.tipo === 'linha_do_tempo') {
    return (
      <View style={formatos.secao}>
        <Text accessibilityRole="header" style={[formatos.rotuloCaixa, caixaAlta]}>{t.recursos.linhaDoTempo}</Text>
        <View style={formatos.linhaTempo}>
          <View style={formatos.linhaTempoTrilho} />
          {recurso.eventos.map((evento, posicao) => (
            <View key={posicao} style={formatos.linhaTempoEvento} accessible accessibilityLabel={`${evento.quando}: ${evento.texto}`}>
              <View style={formatos.linhaTempoPonto} />
              <Text style={formatos.linhaTempoQuando}>{evento.quando}</Text>
              <Text style={[estilos.texto, { fontWeight: '700' }]}>{evento.texto}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return <ImagemDoMaterial src={recurso.src} fonte={recurso.fonte} descricao={recurso.descricao} />;
}

/** Foto do material como .recurso-imagem da web: a largura toda na proporção da própria imagem (até 360 de altura) e a
 * legenda a 8 embaixo. Antes de a medida chegar, vale 16:10. */
function ImagemDoMaterial({ src, fonte, descricao }: { src: string; fonte?: string; descricao: string }) {
  const [proporcao, setProporcao] = useState(16 / 10);
  useEffect(() => {
    let vivo = true;
    Image.getSize(src, (largura, altura) => { if (vivo && largura > 0 && altura > 0) setProporcao(largura / altura); }, () => {});
    return () => { vivo = false; };
  }, [src]);
  return (
    <View style={formatos.imagemSecao}>
      <Image source={{ uri: src }} accessibilityLabel={`${fonte ?? t.recursos.doMaterial}: ${descricao}`} resizeMode="contain"
        style={[formatos.imagem, { aspectRatio: proporcao }]} />
      <Text style={[estilos.legenda, { lineHeight: 21 }]}><Text style={{ fontWeight: '700' }}>{fonte ?? t.recursos.doMaterial}</Text> · {descricao}</Text>
    </View>
  );
}

/** Diagrama do acorde com Views (o app não usa SVG) e o botão de ouvir o acorde. */
/**
 * O braço de um acorde (cordas, trastes, X e O, dedos numerados). `escala` encolhe o desenho por inteiro, para dois
 * acordes caberem lado a lado.
 */
function BracoDoAcorde({ nome, casas, dedos, escala = 1 }: { nome: string; casas: number[]; dedos?: number[]; escala?: number }) {
  const tocadas = casas.filter((casa) => casa > 0);
  const base = Math.max(0, ...tocadas) > 4 ? Math.min(...tocadas) : 1;
  const x = (corda: number) => 22 + corda * 26;
  const y = (casa: number) => 40 + (casa - base + 0.5) * 30;
  const descricao = casas
    .map((casa, corda) => t.recursos.corda(6 - corda, casa, t.recursos.dedos[dedos?.[corda] ?? 0] ?? ''))
    .join('; ');
  // As medidas do desenho (as de formatos.acordeDesenho), em números: o StyleSheet não garante ler de volta.
  const largura = 200;
  const altura = 214;
  return (
    <View style={{ width: largura * escala, height: altura * escala }} accessible accessibilityRole="image"
      accessibilityLabel={`${t.recursos.acorde(nome)}: ${descricao}.`}>
      <View style={[formatos.acordeDesenho, escala !== 1 && {
        transform: [{ translateX: (-largura * (1 - escala)) / 2 }, { translateY: (-altura * (1 - escala)) / 2 }, { scale: escala }],
      }]}>
        {base === 1
          ? <View style={[formatos.pestana, { left: x(0) - 3, width: x(5) - x(0) + 6 }]} />
          : <Text style={[formatos.acordeBase, { top: y(base) - 9 }]}>{base}ª</Text>}
        {[0, 1, 2, 3, 4].map((traste) => <View key={traste} style={[formatos.traste, { top: 40 + traste * 30, left: x(0), width: x(5) - x(0) }]} />)}
        {[0, 1, 2, 3, 4, 5].map((corda) => (
          // Como na web: da 6ª (a mais grossa, à esquerda) à 1ª, com a mesma diferença de espessura da ilustração.
          <View key={corda} style={[formatos.cordaVertical, { left: x(corda) - (4.4 - corda * 0.6) / 2, width: 4.4 - corda * 0.6 }]} />
        ))}
        {[6, 5, 4, 3, 2, 1].map((numero, corda) => (
          <Text key={`c${numero}`} style={[formatos.rotuloDiagrama, { left: x(corda) - 11, top: 40 + 4 * 30 + 4 }]}>{numero}ª</Text>
        ))}
        <Text style={[formatos.eixoDiagrama, { left: x(0), width: x(5) - x(0), top: 40 + 4 * 30 + 22 }]}>{t.recursos.eixoCorda}</Text>
        <Text style={[formatos.eixoDiagrama, { left: x(5) + 4, width: 34, top: 0 }]}>{t.recursos.eixoCasa}</Text>
        {[0, 1, 2, 3].map((linha) => (
          <Text key={`t${linha}`} style={[formatos.rotuloDiagrama, { left: x(5) + 10, top: 40 + (linha + 0.5) * 30 - 9 }]}>{base + linha}ª</Text>
        ))}
        {casas.map((casa, corda) => (casa <= 0 ? (
          <Text key={corda} style={[formatos.marcaCorda, { left: x(corda) - 8, color: casa < 0 ? cores.erro : cores.sucesso }]}>{casa < 0 ? 'X' : 'O'}</Text>
        ) : (
          <View key={corda} style={[formatos.dedo, { left: x(corda) - 11, top: y(casa) - 11 }]}>
            {Boolean(dedos?.[corda]) && <Text style={formatos.dedoTexto}>{dedos?.[corda]}</Text>}
          </View>
        )))}
      </View>
    </View>
  );
}

/** Diagrama do acorde com o som; com `anterior`, os dois acordes da troca lado a lado (Am → C), como na web. */
/** `soBatida`: só o botão de tocar junto e o guia dos tempos (na prática, ao lado do cronômetro). Como na web. */
function DiagramaAcorde({ recurso, longa = false, soBatida = false }: { recurso: Extract<Recurso, { tipo: 'acorde' }>; longa?: boolean; soBatida?: boolean }) {
  type Som = 'acorde' | 'batida' | 'anterior';
  const compassos = longa ? 8 : 2;
  const { width } = useWindowDimensions();
  const empilhar = width < 520;
  const [tocando, setTocando] = useState<Som | null>(null);
  const [semSom, setSemSom] = useState(false);
  /** Na batida, qual dos oito tempos do compasso (1, e, 2, e…) está soando agora. Como na web. */
  const [tempoAtual, setTempoAtual] = useState<number | null>(null);
  const controle = useRef<SomTocando | null>(null);
  const fim = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const acompanhar = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const { anterior } = recurso;

  function limpar() {
    clearTimeout(fim.current);
    clearInterval(acompanhar.current);
    setTocando(null);
    setTempoAtual(null);
  }
  function parar() {
    controle.current?.parar();
    controle.current = null;
    limpar();
  }
  useEffect(() => () => {
    controle.current?.parar();
    clearTimeout(fim.current);
    clearInterval(acompanhar.current);
  }, []);

  function tocar(som: Som) {
    parar();
    setTocando(som);
    setSemSom(false);
    const casas = som === 'anterior' && anterior ? anterior.casas : recurso.casas;
    tocarSom(som === 'batida' ? 'batida' : 'acorde', casas, compassos)
      .then((tocandoAgora) => {
        controle.current = tocandoAgora;
        fim.current = setTimeout(limpar, som === 'batida' ? duracaoDaBatida(compassos) * 1000 : 2600);
        // A batida tem uma colcheia a cada 30/72 s: o guia destaca a que soa.
        if (som === 'batida') {
          acompanhar.current = setInterval(() => {
            const indice = Math.floor(tocandoAgora.tempo() / (30 / 72));
            setTempoAtual(indice < compassos * 8 ? indice % 8 : null);
          }, 80);
        }
      })
      .catch(() => {
        limpar();
        setSemSom(true);
        AccessibilityInfo.announceForAccessibility(t.recursos.semSom);
      });
  }

  const guia = (
    <>
      <View style={formatos.batida} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {['1', 'e', '2', 'e', '3', 'e', '4', 'e'].map((rotulo, indice) => (
          <View key={indice} style={[formatos.batidaTempo, indice % 2 === 1 && formatos.batidaSobe, tempoAtual === indice && formatos.batidaAtiva]}>
            <Text style={[formatos.batidaTexto, tempoAtual === indice && { color: cores.fundo }]}>{indice % 2 ? '↑' : '↓'}</Text>
            <Text style={[formatos.batidaTexto, tempoAtual === indice && { color: cores.fundo }]}>{rotulo}</Text>
          </View>
        ))}
      </View>
      <Text style={estilos.legenda}>{t.audio.batidaGuia}</Text>
    </>
  );
  if (soBatida) {
    return (
      <View style={[formatos.acordeLegenda, formatos.soBatida]}>
        <Botao rotulo={tocando === 'batida' ? t.recursos.tocando : t.recursos.tocarJunto} variante="secundario" compacto
          desativado={tocando !== null} acao={() => tocar('batida')} />
        {tocando && <Botao rotulo={t.audio.pararSom} variante="texto" compacto acao={parar} />}
        {guia}
        {semSom && <Text style={[estilos.legenda, { color: cores.alerta, fontWeight: '700' }]}>{t.recursos.semSom}</Text>}
      </View>
    );
  }

  return (
    <View style={formatos.acorde}>
      {anterior ? (
        <View style={[formatos.comparacao, empilhar && { flexDirection: 'column' }]}>
          <View style={formatos.lado}>
            <BracoDoAcorde {...anterior} escala={empilhar ? 1 : 0.72} />
            <Text style={formatos.ladoNome}>{anterior.nome}</Text>
          </View>
          <View style={empilhar ? { transform: [{ rotate: '90deg' }] } : null}><Icone nome="seta" tamanho={20} cor={cores.textoSecundario} /></View>
          <View style={formatos.lado}>
            <BracoDoAcorde nome={recurso.nome} casas={recurso.casas} dedos={recurso.dedos} escala={empilhar ? 1 : 0.72} />
            <Text style={formatos.ladoNome}>{recurso.nome}</Text>
          </View>
        </View>
      ) : <BracoDoAcorde nome={recurso.nome} casas={recurso.casas} dedos={recurso.dedos} />}
      <View style={formatos.acordeLegenda}>
        <Text style={formatos.acordeNome}>{anterior ? t.recursos.troca(anterior.nome, recurso.nome) : t.recursos.acorde(recurso.nome)}</Text>
        <Text style={estilos.legenda}>{t.recursos.legendaAcorde}</Text>
        {anterior && (
          <Botao rotulo={tocando === 'anterior' ? t.recursos.tocando : t.recursos.ouvirNome(anterior.nome)} variante="secundario" compacto
            desativado={tocando !== null} acao={() => tocar('anterior')} />
        )}
        <Botao rotulo={tocando === 'acorde' ? t.recursos.tocando : anterior ? t.recursos.ouvirNome(recurso.nome) : t.recursos.ouvirAcorde}
          variante="secundario" compacto desativado={tocando !== null} acao={() => tocar('acorde')} />
        {recurso.batida && (
          <Botao rotulo={tocando === 'batida' ? t.recursos.tocando : longa ? t.recursos.tocarJunto : t.recursos.ouvirBatida} variante="secundario" compacto
            desativado={tocando !== null} acao={() => tocar('batida')} />
        )}
        {tocando && <Botao rotulo={t.audio.pararSom} variante="texto" compacto acao={parar} />}
        {recurso.batida && guia}
        {semSom && <Text style={[estilos.legenda, { color: cores.alerta, fontWeight: '700' }]}>{t.recursos.semSom}</Text>}
      </View>
    </View>
  );
}

/** Um som de referência para a prática (como o Mi da 6ª corda, para afinar), sintetizado como o acorde. Como na web. */
function TocarSom({ rotulo, casas }: { rotulo: string; casas: number[] }) {
  const [tocando, setTocando] = useState(false);
  const [semSom, setSemSom] = useState(false);
  const controle = useRef<SomTocando | null>(null);
  useEffect(() => () => controle.current?.parar(), []);
  function tocar() {
    setTocando(true);
    setSemSom(false);
    tocarSom('acorde', casas)
      .then((som) => {
        controle.current = som;
        setTimeout(() => setTocando(false), 2600);
      })
      .catch(() => {
        setTocando(false);
        setSemSom(true);
      });
  }
  return (
    <View style={{ gap: 6 }}>
      <Botao rotulo={tocando ? t.recursos.tocando : rotulo} variante="secundario" compacto desativado={tocando} acao={tocar} />
      {semSom && <Text style={[estilos.legenda, { color: cores.alerta, fontWeight: '700' }]}>{t.recursos.semSom}</Text>}
    </View>
  );
}

const coresDosPares = [cores.acao, '#C25A8A', '#1F8A8A', '#B7791F', '#6B3FA0', '#5E6A85'];

/** Associar tocando: um item da esquerda e depois o par na direita; cada par ganha um número e uma cor. */
export function Associar({ esquerda, direita, valor, mudar, desativado, certos, fixos }: {
  esquerda: Opcao[];
  direita: Opcao[];
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  certos?: string[];
  /** Na nova tentativa: os itens da esquerda cujo par já estava certo (o par fica travado, em verde). Como na web. */
  fixos?: string[];
}) {
  const [escolhida, setEscolhida] = useState<string | null>(null);
  /** Como na web: quem começa pela direita deixa o item escolhido, e o toque na esquerda fecha o par. */
  const [escolhidaDireita, setEscolhidaDireita] = useState<string | null>(null);
  const pares = valor.split(',').filter(Boolean).map((par) => par.split('=') as [string, string]);
  const travado = (idEsquerda?: string | null) => Boolean(idEsquerda && fixos?.includes(idEsquerda) && pares.some(([item]) => item === idEsquerda));
  const numero = (id: string) => {
    const esquerdaDoPar = pares.find(([item, outro]) => item === id || outro === id)?.[0];
    return esquerda.findIndex((item) => item.id === esquerdaDoPar) + 1;
  };
  const texto = (lista: Opcao[], id: string) => lista.find((item) => item.id === id)?.texto ?? '';
  /** O que o leitor de tela ouve de um item: a fórmula marcada ($…$) lida pela árvore ("seno de x"), nunca o cifrão (P32). */
  const fala = (lista: Opcao[], id: string) => falarTextoComFormulas(texto(lista, id));
  const salvar = (novos: [string, string][]) => mudar(codificarResposta.pares(novos));

  function tocarEsquerda(id: string) {
    if (escolhidaDireita) {
      salvar([...pares.filter(([item, outro]) => item !== id && outro !== escolhidaDireita), [id, escolhidaDireita]]);
      setEscolhidaDireita(null);
      return;
    }
    if (pares.some(([item]) => item === id)) {
      salvar(pares.filter(([item]) => item !== id));
      setEscolhida(null);
      return;
    }
    setEscolhida((atual) => {
      const nova = atual === id ? null : id;
      if (nova) AccessibilityInfo.announceForAccessibility(t.associar.escolhido(fala(esquerda, nova)));
      return nova;
    });
  }

  function tocarDireita(id: string) {
    if (!escolhida) {
      if (pares.some(([, item]) => item === id)) salvar(pares.filter(([, item]) => item !== id));
      else {
        setEscolhidaDireita((atual) => {
          const nova = atual === id ? null : id;
          if (nova) AccessibilityInfo.announceForAccessibility(t.associar.escolhidoDireita(fala(direita, nova)));
          return nova;
        });
      }
      return;
    }
    salvar([...pares.filter(([item, outro]) => item !== escolhida && outro !== id), [escolhida, id]]);
    setEscolhida(null);
  }

  function cartao(item: Opcao, lado: 'esquerda' | 'direita') {
    const par = lado === 'esquerda' ? pares.find(([id]) => id === item.id) : pares.find(([, id]) => id === item.id);
    const indice = par ? numero(item.id) : 0;
    const cor = coresDosPares[(indice - 1) % coresDosPares.length];
    const chave = par ? par[0] : null;
    const fixo = travado(chave);
    const estado = certos && chave ? (certos.includes(chave) ? 'certo' : 'errado') : fixo ? 'certo' : null;
    const falaDoItem = falarTextoComFormulas(item.texto);
    let rotulo = falaDoItem;
    if (fixo && par) rotulo = t.associar.travado(fala(esquerda, par[0]), fala(direita, par[1]));
    else if (lado === 'direita' && escolhida) rotulo = t.associar.ligar(fala(esquerda, escolhida), falaDoItem);
    else if (lado === 'esquerda' && escolhidaDireita) rotulo = t.associar.ligar(falaDoItem, fala(direita, escolhidaDireita));
    else if (par) rotulo = t.associar.desfazer(fala(esquerda, par[0]), fala(direita, par[1]));
    return (
      <CartaoDegrau key={item.id} accessibilityRole="button" accessibilityLabel={rotulo} disabled={desativado || fixo}
        accessibilityState={{ selected: escolhida === item.id || escolhidaDireita === item.id }}
        onPress={() => (lado === 'esquerda' ? tocarEsquerda(item.id) : tocarDireita(item.id))}
        // Como .associar button: a sombra tem a cor do par (ou o azul da escolhida, o verde e o âmbar da correção).
        corDegrau={estado === 'certo' ? '#9AD8B5' : estado === 'errado' ? '#F2CF96' : (escolhida === item.id || escolhidaDireita === item.id) ? cores.acao : par ? cor : cores.gelo}
        face={[formatos.cartao, formatos.cartaoPar, { overflow: 'visible' }, par && { borderColor: cor },
          (escolhida === item.id || escolhidaDireita === item.id) && formatos.cartaoEscolhidaAssociar, estado === 'certo' && formatos.cartaoCerto,
          estado === 'errado' && formatos.cartaoErrado]}>
        {par && (
          // Como na web: na coluna da direita, o número vira uma etiqueta no canto, e a definição usa a largura toda.
          <View style={[formatos.numeroPar, lado === 'direita' && formatos.numeroParCanto,
            { backgroundColor: estado === 'certo' ? cores.sucessoClaro : estado === 'errado' ? '#E3A24A' : cor }]}>
            <Text style={formatos.posicaoTexto}>{indice}</Text>
          </View>
        )}
        <TextoComFormulas texto={item.texto} estilo={[estilos.texto, formatos.cartaoTexto, formatos.cartaoParTexto]} />
      </CartaoDegrau>
    );
  }

  return (
    <View style={formatos.secaoOrdenar}>
      {/* A instrução mostra o item escolhido com a fórmula desenhada; o leitor ouve a fala dela (TextoComFormulas). */}
      <TextoComFormulas estilo={formatos.instrucao} accessibilityLiveRegion="polite"
        texto={escolhida ? t.associar.escolhido(texto(esquerda, escolhida))
          : escolhidaDireita ? t.associar.escolhidoDireita(texto(direita, escolhidaDireita)) : t.associar.instrucao} />
      <View style={formatos.colunas}>
        <View style={formatos.coluna} accessibilityLabel={t.associar.esquerda}>{esquerda.map((item) => cartao(item, 'esquerda'))}</View>
        <View style={formatos.coluna} accessibilityLabel={t.associar.direita}>{direita.map((item) => cartao(item, 'direita'))}</View>
      </View>
      {pares.some(([item]) => !travado(item)) && !desativado && (
        <Pressable accessibilityRole="button" onPress={() => { salvar(pares.filter(([item]) => travado(item))); setEscolhida(null); }} style={formatos.linkAlvo}>
          <Text style={formatos.link}>{t.associar.recomecar}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Verdadeiro ou falso com justificativa: a afirmação em destaque, os dois valores e o porquê (com `Opcao` da aula). */
export function VerdadeiroFalso({ afirmacao, valor, mudar, desativado, retorno, justificativas }: {
  /** Cor do valor depois da correção (a do porquê vem da aula, em `justificativas`). */
  afirmacao: string;
  valor: string;
  mudar: (valor: string) => void;
  desativado: boolean;
  retorno: 'certa' | 'errada' | null;
  /** As justificativas desenhadas pela aula (o mesmo cartão das opções de escolha). */
  justificativas: (escolha: string, salvar: (justificativa: string) => void) => ReactNode;
}) {
  const [escolha = '', justificativa = ''] = valor.split(':');
  return (
    <View style={formatos.vf}>
      {/* A afirmação pode trazer fórmula marcada ($…$, lição de matemática): desenhada em linha, nunca o cifrão cru. */}
      <View style={formatos.afirmacao}><TextoComFormulas texto={afirmacao} estilo={formatos.afirmacaoTexto} /></View>
      <View style={formatos.vfGrupo}>
      <Text style={[formatos.rotuloCaixa, caixaAlta]}>{t.verdadeiroFalso.valor}</Text>
      <View style={formatos.valores} accessibilityRole="radiogroup" accessibilityLabel={t.verdadeiroFalso.valor}>
        {(['verdadeiro', 'falso'] as const).map((opcao) => {
          const marcada = escolha === opcao;
          return (
            <CartaoDegrau key={opcao} accessibilityRole="radio" accessibilityState={{ checked: marcada, disabled: desativado }} aria-checked={marcada} disabled={desativado}
              testID={`vf-${opcao}`} onPress={() => { mudar(`${opcao}:${justificativa}`); void tocaSons.tocarEfeito('toque_opcao'); }} raio={16} estiloFora={[{ flex: 1 }, desativado && !marcada && { opacity: 0.55 }]}
              corDegrau={marcada && retorno === 'certa' ? '#9AD8B5' : marcada && retorno === 'errada' ? '#F2CF96' : marcada ? '#9FB1F0' : cores.gelo}
              face={[formatos.valor, marcada && formatos.cartaoEscolhido, marcada && retorno === 'certa' && formatos.cartaoCerto,
                marcada && retorno === 'errada' && formatos.cartaoErrado]}>
              {/* .vf__valores label: o texto fica azul escuro na marcada, verde na certa e âmbar na errada. */}
              <Text style={[formatos.valorTexto, marcada && { color: retorno === 'certa' ? cores.sucesso : retorno === 'errada' ? '#7A4A00' : cores.acaoEscura }]}>
                {opcao === 'verdadeiro' ? t.verdadeiroFalso.verdadeiro : t.verdadeiroFalso.falso}</Text>
            </CartaoDegrau>
          );
        })}
      </View>
      </View>
      <View style={formatos.vfGrupo}>
        <Text style={[formatos.rotuloCaixa, caixaAlta]}>{t.verdadeiroFalso.porque}</Text>
        {justificativas(justificativa, (nova) => mudar(`${escolha}:${nova}`))}
      </View>
    </View>
  );
}

/** Resposta aberta: área de texto com o contador do mínimo. */
export function CampoAberta({ valor, mudar, minimo, desativado, retorno }: {
  valor: string;
  mudar: (valor: string) => void;
  minimo: number;
  desativado: boolean;
  retorno: 'certa' | 'errada' | null;
}) {
  // Como na web: letras e números, sem os espaços (o contador diz “letras”).
  const usados = tamanhoDaResposta(valor);
  // Com o teclado aberto, a área de texto, a dica e o contador ficam inteiros acima do rodapé (lote 1 do iPhone), como os
  // campos que usam <Campo>.
  const rolagem = useContext(RolagemDaTela);
  const secao = useRef<ComponentRef<typeof View>>(null);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  return (
    <View ref={secao} style={formatos.secao}>
      <Text style={estilos.rotulo}>{t.aberta.rotulo}</Text>
      {/* No Android, a borda e o respiro ficam numa caixa em volta (banca P1-8; ver CaixaDoCampo). */}
      <CaixaDoCampo focar={() => campo.current?.focus()} estilo={[formatos.aberta, retorno === 'certa' && formatos.cartaoCerto, retorno === 'errada' && formatos.cartaoErrado]}>
        {(estilo) => (
          <TextInput ref={campo} testID="resposta-aberta" multiline value={valor} onChangeText={mudar} editable={!desativado} maxLength={1000}
            onFocus={() => rolagem?.focar(secao.current)} onBlur={() => rolagem?.focar(null)}
            accessibilityLabel={t.aberta.rotulo} accessibilityHint={t.aberta.dica} textAlignVertical="top" style={estilo} />
        )}
      </CaixaDoCampo>
      <Text style={estilos.legenda}>{t.aberta.dica}</Text>
      {/* Spec 16, item 8: antes da primeira letra, só o rodapé orienta; depois, "Faltam N letras" em cinza, até o mínimo. */}
      {usados > 0 && usados < minimo && <Text testID="aberta-contador" style={formatos.contador}>{t.aberta.contador(usados, minimo)}</Text>}
    </View>
  );
}

/** Depois da resposta aberta: o que a correção procurou, uma boa resposta e o aviso do modo demonstração. */
/** `mostrarModelo`: a resposta modelo só aparece no acerto ou na segunda tentativa errada (antes, virava copiar). Como na web. */
export function CorrecaoAberta({ avaliacao, mostrarModelo = true }: { avaliacao: Avaliacao; mostrarModelo?: boolean }) {
  return (
    <View style={formatos.correcao}>
      {avaliacao.criterios && (
        <>
          <Text accessibilityRole="header" style={[formatos.rotuloCaixa, caixaAlta]}>{t.aberta.criterios}</Text>
          {avaliacao.criterios.map((criterio, posicao) => (
            <View key={posicao} style={formatos.criterio} accessible
              accessibilityLabel={`${criterio.atendido ? t.aberta.atendido : t.aberta.faltou}: ${falarTextoComFormulas(criterio.texto)}`}>
              <View style={[formatos.criterioIcone, criterio.atendido && { backgroundColor: cores.sucessoClaro }]}>
                <Icone nome={criterio.atendido ? 'check' : 'fechar'} tamanho={14} cor={cores.fundo} />
              </View>
              <TextoComFormulas texto={criterio.texto} estilo={[estilos.texto, { flex: 1, fontWeight: '700' }]} />
            </View>
          ))}
        </>
      )}
      {avaliacao.modelo && !mostrarModelo && <Text style={estilos.legenda}>{t.aberta.modeloDepois}</Text>}
      {avaliacao.modelo && mostrarModelo && (
        <View style={formatos.modelo}>
          <Text style={[formatos.rotuloCaixa, caixaAlta]}>{t.aberta.modelo}</Text>
          <Text style={estilos.texto}>{avaliacao.modelo}</Text>
        </View>
      )}
      {avaliacao.simulado && <Text style={estilos.legenda}>{t.aberta.simulada}</Text>}
    </View>
  );
}

function formatarTempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Prática no mundo real: a tarefa, a lista para conferir, a dica e o cronômetro; na volta, a pessoa conta como foi e o
 * Stu responde. A lição só conclui depois dessa resposta (o botão de concluir fica no rodapé da aula).
 */
export function EtapaPratica({ pratica, escolha, escolher, consulta, aoMedirComoFoi, aoAcabar, recurso, reinicio = 0, restanteInicial, aoMudarRestante }: {
  /** O que faltava no cronômetro na última visita. Como na web. */
  restanteInicial?: number;
  aoMudarRestante?: (restante: number) => void;
  /** Muda a cada "Praticar mais um pouco": o cronômetro recomeça. Como na web. */
  reinicio?: number;
  /** O que a lição mostrou no exemplo (recurso, passos, frases), para consultar enquanto pratica. */
  consulta?: ReactNode;
  /** O recurso da lição: com batida, o botão de tocar junto fica logo depois do cronômetro. */
  recurso?: Recurso;
  pratica: Pratica;
  escolha: AutoAvaliacao | null;
  escolher: (valor: AutoAvaliacao) => void;
  /** Onde fica o "Como foi?", medido a partir do topo da etapa: a lição rola até ele. */
  aoMedirComoFoi?: (y: number) => void;
  /** O cronômetro chegou a zero: a lição leva até o "Como foi?". */
  aoAcabar?: () => void;
}) {
  const total = pratica.minutos * 60;
  const [restante, setRestante] = useState(() =>
    restanteInicial !== undefined && restanteInicial >= 0 && restanteInicial <= total ? restanteInicial : total);
  const [rodando, setRodando] = useState(false);
  const [praticadoTotal, setPraticadoTotal] = useState(() =>
    total - (restanteInicial !== undefined && restanteInicial >= 0 && restanteInicial <= total ? restanteInicial : total));
  const [feitos, setFeitos] = useState<number[]>([]);
  useEffect(() => {
    aoMudarRestante?.(restante);
    // Só o tempo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante]);
  const acabou = restante === 0;
  const avisado = useRef(false);
  useEffect(() => {
    if (reinicio === 0) return;
    // Como na web: "Praticar mais um pouco" continua de onde parou (ou recomeça, se tinha acabado) e já começa a contar.
    avisado.current = false;
    setRestante((atual) => (atual > 0 ? atual : total));
    setRodando(true);
  }, [reinicio, total]);

  useEffect(() => {
    if (!rodando) return;
    const intervalo = setInterval(() => {
      setPraticadoTotal((atual) => atual + 1);
      setRestante((atual) => {
        if (atual > 1) return atual - 1;
        setRodando(false);
        return 0;
      });
    }, 1000);
    return () => clearInterval(intervalo);
  }, [rodando]);
  // Sons do cronômetro (spec 12, como na web): ao começar (ou retomar) e quando chega a zero contando.
  useEffect(() => {
    if (rodando) void tocaSons.tocarEfeito('cronometro_inicio');
  }, [rodando]);
  const restanteAntes = useRef(restante);
  useEffect(() => {
    if (restante === 0 && restanteAntes.current > 0) void tocaSons.tocarEfeito('cronometro_fim');
    restanteAntes.current = restante;
  }, [restante]);

  /** A pergunta "Como foi?": recebe o foco do leitor de tela no fim do cronômetro, depois que a lição rola até ela. */
  const perguntaComoFoi = useRef<ComponentRef<typeof Text>>(null);
  useEffect(() => {
    if (!acabou || avisado.current) return;
    avisado.current = true;
    aoAcabar?.();
    // O leitor lê "acabou" na própria pergunta e segue para as opções; sem a pergunta montada, fica o anúncio.
    const espera = setTimeout(() => {
      if (perguntaComoFoi.current) AccessibilityInfo.sendAccessibilityEvent(perguntaComoFoi.current, 'focus');
      else AccessibilityInfo.announceForAccessibility(t.pratica.acabou);
    }, 400);
    return () => clearTimeout(espera);
    // Só o fim do cronômetro dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acabou]);
  const raizY = useRef(0);

  let rotuloPrincipal: string = t.pratica.comecar;
  if (rodando) rotuloPrincipal = t.pratica.pausar;
  else if (restante < total) rotuloPrincipal = t.pratica.retomar;
  const andamento = 1 - restante / total;
  // Como na web: o "Como foi?" espera um mínimo de prática (30 s, ou o cronômetro inteiro se for menor).
  const minimo = Math.min(30, total);
  const [semCronometro, setSemCronometro] = useState(false);
  // Como na web: o que já foi praticado não se perde no "Recomeçar" nem no "Praticar mais um pouco" (conta todo o tempo).
  const praticado = Math.max(praticadoTotal, total - restante);
  const praticou = semCronometro || praticado >= minimo;
  // Como a região de status da web: quando a prática mínima chega, o leitor ouve que já dá para contar como foi.
  const anunciouComoFoi = useRef(false);
  useEffect(() => {
    if (!praticou || escolha || acabou || anunciouComoFoi.current) return;
    anunciouComoFoi.current = true;
    AccessibilityInfo.announceForAccessibility(t.pratica.comoFoi);
    // Só a chegada ao mínimo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [praticou]);

  return (
    <View style={formatos.secao} onLayout={(evento) => { raizY.current = evento.nativeEvent.layout.y; }}>
      <Text style={estilos.legenda}>{t.pratica.subtitulo}</Text>
      <Text style={formatos.tarefa}>{pratica.tarefa}</Text>
      {pratica.passos && (
        <View style={{ gap: 8 }} accessibilityLabel={t.pratica.passos}>
          {pratica.passos.map((passo, posicao) => {
            const feito = feitos.includes(posicao);
            return (
              <Pressable key={posicao} accessibilityRole="checkbox" accessibilityState={{ checked: feito }} aria-checked={feito}
                onPress={() => setFeitos((atuais) => (feito ? atuais.filter((item) => item !== posicao) : [...atuais, posicao]))}
                style={formatos.conferir}>
                <View style={[formatos.caixinha, feito && formatos.caixinhaMarcada]}>{feito && <Icone nome="check" tamanho={14} cor={cores.fundo} />}</View>
                <Text style={[estilos.texto, { flex: 1, fontWeight: '700' }, feito && { color: cores.textoSecundario, textDecorationLine: 'line-through' }]}>{passo}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {pratica.dica && (
        <View style={formatos.dica}>
          <Icone nome="lampada" tamanho={20} cor="#8A5A00" />
          <Text style={[estilos.texto, { flex: 1 }]}><Text style={{ fontWeight: '800' }}>{t.pratica.dica}: </Text>{pratica.dica}</Text>
        </View>
      )}
      <View style={formatos.cronometro}>
        <View style={formatos.mostrador} accessible accessibilityRole="timer"
          accessibilityLabel={`${t.pratica.cronometro}: ${t.pratica.restante(formatarTempo(restante))}`}>
          <View style={formatos.mostradorTrilho}>
            <View style={[formatos.mostradorCheio, { width: `${Math.round(andamento * 100)}%` }]} />
          </View>
          <Text style={[formatos.tempo, acabou && { color: cores.sucesso }]}>{formatarTempo(restante)}</Text>
        </View>
        <View style={formatos.cronometroAcoes}>
          {!acabou && (
            <View style={{ flex: 1 }}>
              <Botao testID="cronometro" rotulo={rotuloPrincipal} variante={rodando ? 'secundario' : 'primario'} compacto acao={() => setRodando((atual) => !atual)} />
            </View>
          )}
          {restante < total && (
            <View style={{ flex: 1 }}>
              <Botao rotulo={t.pratica.recomecar} variante="texto" compacto acao={() => { setRodando(false); setRestante(total); }} />
            </View>
          )}
        </View>
        {/* Como na web: depois de recomeçar, o total praticado fica à vista. */}
        {praticado > total - restante && <Text style={[estilos.legenda, { textAlign: 'center' }]}>{t.pratica.jaPraticou(formatarTempo(praticado))}</Text>}
      </View>
      {/* Como na web: o som de referência (o Mi para afinar) e a batida para tocar junto ficam ao lado do cronômetro. */}
      {pratica.som && <TocarSom rotulo={pratica.som.rotulo} casas={pratica.som.casas} />}
      {recurso?.tipo === 'acorde' && recurso.batida && <DiagramaAcorde recurso={recurso} longa soBatida />}
      {/* "Como foi?" espera o cronômetro começar: a prática pede praticar. */}
      <Text ref={perguntaComoFoi} accessible accessibilityRole="header" style={formatos.comoFoi}
        onLayout={(evento) => aoMedirComoFoi?.(raizY.current + evento.nativeEvent.layout.y)}>
        {acabou ? t.pratica.acabou
          : praticou || escolha ? t.pratica.comoFoi
            : restante < total
              ? rodando ? t.pratica.continuePraticando(minimo - praticado) : t.pratica.retomeParaContar(minimo - praticado)
              : t.pratica.comeceAntes}
      </Text>
      {!praticou && !escolha && (
        <Pressable accessibilityRole="button" onPress={() => setSemCronometro(true)} hitSlop={8} style={formatos.linkAlvo}>
          <Text style={formatos.link}>{t.audio.jaPratiquei}</Text>
        </Pressable>
      )}
      <View style={formatos.opcoesComoFoi} accessibilityRole="radiogroup" accessibilityLabel={t.pratica.comoFoi}>
        {AUTOAVALIACOES.map((valor) => {
          const marcada = escolha === valor;
          const travada = !praticou && !escolha;
          return (
            <CartaoDegrau key={valor} testID={`como-foi-${valor}`} accessibilityRole="radio" accessibilityState={{ checked: marcada, disabled: travada }} aria-checked={marcada}
              disabled={travada} onPress={() => escolher(valor)} raio={16} estiloFora={[{ flex: 1 }, travada && { opacity: 0.55 }]}
              corDegrau={marcada && valor === 'consegui' ? '#9AD8B5' : marcada && valor === 'quase' ? '#F2CF96' : marcada ? '#9FB1F0' : cores.gelo}
              face={[formatos.valor, marcada && valor === 'consegui' && formatos.cartaoCerto,
                marcada && valor === 'quase' && formatos.cartaoQuase, marcada && valor === 'ainda_nao' && formatos.cartaoEscolhido]}>
              <Text style={[formatos.valorTexto, { fontSize: 15, textAlign: 'center' }]}>{t.pratica.opcoes[valor]}</Text>
            </CartaoDegrau>
          );
        })}
      </View>
      {escolha && (
        <View style={formatos.resposta} accessibilityLiveRegion="polite">
          <Stu nome="stu-encorajador" tamanho={56} estilo={formatos.stu} />
          <View style={formatos.respostaBalao}><Text style={[estilos.texto, { fontWeight: '700' }]}>{t.pratica.respostas[escolha]}</Text></View>
        </View>
      )}
      {/* A consulta (recurso, passos, frases) fica no fim: o cronômetro e o "Como foi?" vêm logo depois da tarefa. */}
      {consulta}
    </View>
  );
}

const formatos = StyleSheet.create({
  secao: { gap: 10 },
  // .ordenar e .associar: grade com vão de 12.
  secaoOrdenar: { gap: 12 },
  // .vf: vão de 14 entre a afirmação, os valores e o porquê; as legendas têm 8 embaixo.
  vf: { gap: 14 },
  vfGrupo: { gap: 8 },
  rotuloLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // .ordenar__rotulo e as legendas do V/F: 13 px em 900, 0,05em; .ordenar__instrucao: 16 px em 700.
  rotuloCaixa: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 19.5, letterSpacing: 0.65 },
  instrucao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  // .ordenar__vazio: o texto do corpo (16 px) na cor secundária.
  /** O toque de um link de texto: 48 dp de altura, mesmo com o texto numa linha só. */
  linkAlvo: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22, textDecorationLine: 'underline' },
  avisoSemVoz: { color: cores.alerta, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 14, borderRadius: 999, borderWidth: 2,
    borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: cores.fundo },
  chipDestaque: { borderColor: '#B9C6F3' },
  chipGrande: { minHeight: 50, paddingHorizontal: 18 },
  chipAfundado: { borderBottomWidth: 2, marginTop: 2 },
  chipTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 18 },
  ouvir: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  escuta: { gap: 12, padding: 14, borderRadius: 16, backgroundColor: cores.ceu },
  fraseGrande: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 19, lineHeight: 26 },
  falaInline: { color: cores.acaoEscura, fontWeight: '800', textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  pronuncia: { color: cores.acaoEscura, fontFamily: fontes.corpo, fontStyle: 'italic', fontWeight: '700', fontSize: 14, lineHeight: 20 },
  soBatida: { alignItems: 'center', padding: 12, borderRadius: 18, backgroundColor: '#FFFAF0' },
  fala: { gap: 6, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: '#FFE3A3', backgroundColor: cores.fundo },
  falaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 18, lineHeight: 24 },
  lacuna: { textDecorationLine: 'underline', textDecorationStyle: 'solid' },
  lacunaPreenchida: { color: cores.acaoEscura, fontWeight: '800' },
  codigo: { padding: 14, borderRadius: 14, color: cores.fundo, backgroundColor: cores.texto, fontFamily: 'monospace', fontSize: 15, lineHeight: 22 },
  citacao: { paddingVertical: 14, paddingRight: 14, paddingLeft: 44, borderLeftWidth: 5, borderLeftColor: '#C9A24A', borderRadius: 14,
    backgroundColor: '#FBF6EA' },
  aspas: { position: 'absolute', top: -2, left: 10, color: '#C9A24A', fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontSize: 48, lineHeight: 56 },
  citacaoTexto: { color: '#4D3A12', fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontStyle: 'italic', fontSize: 20, lineHeight: 28 },
  formula: { padding: 16, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: cores.gelo, backgroundColor: cores.fundo },
  // Como a web 4.2 (`.trecho--formula`): a fonte da interface, forte, com algarismos de largura igual (antes, serifa).
  formulaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 21, lineHeight: 28, fontVariant: ['tabular-nums'], textAlign: 'center' },
  // .trecho--frase: 16 × 18 de respiro. Na web, a lacuna é um bloco em linha com borda de 3 embaixo, que alonga a linha em
  // uns 4 px; aqui a barra desce por deslocamento (sem mudar a linha), então o quadro devolve esse espaço embaixo.
  frase: { gap: 10, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 16, backgroundColor: cores.ceu },
  fraseComLacuna: { paddingBottom: 20 },
  fraseTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 20, lineHeight: 28 },
  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  passoNumero: { width: 30, height: 30, borderRadius: 8, borderBottomWidth: 3, borderColor: '#9A6A08', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#C88A12' },
  passoNumeroTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 18 },
  passoTexto: { flex: 1, fontWeight: '700' },
  linhaTempo: { paddingLeft: 26, gap: 14 },
  linhaTempoTrilho: { position: 'absolute', left: 8, top: 8, bottom: 8, width: 4, borderRadius: 2, backgroundColor: '#FFE3A3' },
  linhaTempoEvento: { gap: 2 },
  linhaTempoPonto: { position: 'absolute', left: -25, top: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: '#FFFAF0',
    backgroundColor: '#C88A12' },
  linhaTempoQuando: { color: '#8A5A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 17, lineHeight: 22 },
  fracao: { gap: 10, padding: 14, borderRadius: 20, borderWidth: 2, borderColor: '#FFE3A3', backgroundColor: cores.fundo },
  fracaoBarra: { flexDirection: 'row', gap: 6, height: 60, padding: 8, borderRadius: 16, backgroundColor: '#F2DFC3' },
  fracaoParte: { flex: 1, borderWidth: 3, borderColor: '#5C3A1A', borderRadius: 10, backgroundColor: cores.fundo },
  fracaoCheia: { backgroundColor: '#8B5A2B' },
  fracaoLegenda: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 10 },
  fracaoRotulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 24, lineHeight: 30 },
  imagem: { width: '100%', maxHeight: 360, borderRadius: 16, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  imagemSecao: { gap: 8 },
  acorde: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, borderWidth: 2,
    borderColor: '#FFE3A3', backgroundColor: cores.fundo },
  acordeDesenho: { width: 200, height: 214 },
  rotuloDiagrama: { position: 'absolute', width: 22, textAlign: 'center', color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800',
    fontSize: 14, lineHeight: 18 },
  eixoDiagrama: { position: 'absolute', textAlign: 'center', color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700',
    fontSize: 11, lineHeight: 14 },
  batida: { flexDirection: 'row', gap: 4, width: '100%' },
  batidaTempo: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: '#EEF2FF' },
  batidaSobe: { backgroundColor: '#F6F7FB' },
  batidaAtiva: { backgroundColor: cores.acao, transform: [{ translateY: -2 }] },
  batidaTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 18 },
  falaResultado: { flexBasis: '100%', marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, overflow: 'hidden',
    fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  falaOtima: { backgroundColor: '#EEFAF3', color: cores.sucesso },
  falaQuase: { backgroundColor: '#FFF6D9', color: '#7A4A00' },
  falaTente: { backgroundColor: '#FFF1E0', color: cores.alerta },
  comparacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, width: '100%' },
  lado: { alignItems: 'center', gap: 2 },
  ladoNome: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 17 },
  pestana: { position: 'absolute', top: 36, height: 7, borderRadius: 3.5, backgroundColor: cores.texto },
  acordeBase: { position: 'absolute', left: 0, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13 },
  traste: { position: 'absolute', height: 2.5, backgroundColor: '#C9B48A' },
  cordaVertical: { position: 'absolute', top: 40, height: 120, backgroundColor: '#6B5A3C' },
  marcaCorda: { position: 'absolute', top: 10, width: 16, textAlign: 'center', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 15 },
  dedo: { position: 'absolute', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.acao },
  dedoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 16 },
  acordeLegenda: { flex: 1, minWidth: 150, gap: 8 },
  acordeNome: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 24, lineHeight: 30 },
  // .ordenar button, .associar button: face de 52 com borda de 2 em volta e 10 × 14 de respiro; o degrau de 4 vem por fora
  // (CartaoDegrau).
  cartao: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  cartaoPar: { paddingHorizontal: 10, gap: 8 },
  // .associar button até 600 px: 0,95rem (15,2) com a entrelinha de 1,5.
  cartaoParTexto: { fontSize: 15.2, lineHeight: 22.8 },
  cartaoTexto: { flex: 1, fontWeight: '700' },
  cartaoEscolhido: { borderColor: '#9FB1F0', backgroundColor: '#EEF2FF' },
  cartaoEscolhidaAssociar: { borderColor: cores.acao, backgroundColor: '#EEF2FF' },
  cartaoCerto: { borderColor: cores.sucessoClaro, backgroundColor: '#EEFAF3' },
  cartaoErrado: { borderColor: '#E3A24A', backgroundColor: '#FFF6EA' },
  cartaoQuase: { borderColor: '#E0A92E', backgroundColor: '#FFF6D9' },
  posicaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 17 },
  numeroPar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  numeroParCanto: { position: 'absolute', top: -10, left: -8, width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: cores.fundo, zIndex: 1 },
  colunas: { flexDirection: 'row', gap: 8 },
  // Até 600 px: colunas com vão de 8 e 10 entre os cartões de cada coluna (.associar__colunas > div).
  coluna: { flex: 1, gap: 10 },
  // .vf__afirmacao: 16 × 18 de respiro, cantos de 6 à esquerda e 16 à direita.
  afirmacao: { paddingVertical: 16, paddingHorizontal: 18, borderLeftWidth: 5, borderLeftColor: cores.acao, borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6, borderTopRightRadius: 16, borderBottomRightRadius: 16, backgroundColor: cores.ceu },
  afirmacaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 19.2, lineHeight: 29 },
  valores: { flexDirection: 'row', gap: 12 },
  // .vf__valores label: face de 60 com borda de 2 em volta; o degrau de 4 vem por fora (CartaoDegrau).
  valor: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 2,
    borderColor: cores.gelo, backgroundColor: cores.fundo, paddingHorizontal: 6 },
  valorTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 18, lineHeight: 27 },
  aberta: { minHeight: 140, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: cores.bordaCampo, color: cores.texto,
    backgroundColor: cores.fundo, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 24 },
  contador: { alignSelf: 'flex-end', color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  correcao: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: cores.nevoa },
  criterio: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  criterioIcone: { width: 22, height: 22, borderRadius: 11, marginTop: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E3A24A' },
  modelo: { gap: 4, padding: 12, borderLeftWidth: 4, borderLeftColor: cores.sucessoClaro, borderRadius: 12, backgroundColor: cores.fundo },
  tarefa: { padding: 14, borderRadius: 14, backgroundColor: cores.fundo, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800',
    fontSize: 18, lineHeight: 26 },
  conferir: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  caixinha: { flexShrink: 0, width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#B9A3D8', alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.fundo },
  caixinhaMarcada: { borderColor: '#6B3FA0', backgroundColor: '#6B3FA0' },
  dica: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#FFF6D9' },
  cronometro: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: cores.fundo, alignItems: 'center' },
  mostrador: { alignSelf: 'stretch', alignItems: 'center', gap: 10 },
  mostradorTrilho: { alignSelf: 'stretch', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: '#ECE3F8' },
  mostradorCheio: { height: '100%', borderRadius: 6, backgroundColor: '#6B3FA0' },
  tempo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 48, lineHeight: 56, fontVariant: ['tabular-nums'] },
  cronometroAcoes: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  comoFoi: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 19, lineHeight: 24, marginTop: 4 },
  opcoesComoFoi: { flexDirection: 'row', gap: 8 },
  resposta: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stu: { flexShrink: 0 },
  respostaBalao: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 2, borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: cores.fundo },
});
