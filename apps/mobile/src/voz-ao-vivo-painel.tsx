import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { formatarTempoVoz, textoErroVozAoVivo, type EstadoSessaoVozAoVivo, type TurnoLegenda } from '@studoo/contratos';
import { Botao, useMovimentoReduzido } from './interface';
import { Icone } from './icone';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';
import { suporteVozAoVivo } from './voz-ao-vivo';

/*
 * Voz ao vivo no "Explique com suas palavras" (spec 08, parte B), igual à web em src/app/estudio.tsx e estudio.css
 * (.voz-ao-vivo-*): o cartão de entrada, o aviso de privacidade da primeira vez e o painel da conversa (estado e tempo,
 * dica, progresso, ondas, aviso dos 30 s, erro, legendas e controles). Só a prévia web mostra a opção (WebRTC do
 * navegador); no aparelho ela fica escondida. Os textos vêm de mensagens.estudio.vozAoVivo.
 */

const m = mensagens.estudio.vozAoVivo;
/** As cores que a web usa nas variáveis sem valor no :root (--borda, --superficie) e nos avisos do painel. */
const borda = '#D8E1D9';
const superficie = '#F6F8F6';

export type ProvedorTexto = 'openai' | 'deepseek';

/** O que a elegibilidade usa do cliente: o mesmo que a web consulta (configuração do servidor e sessão). */
export type ClienteElegibilidadeVoz = {
  iniciarVozAoVivo?: unknown;
  configuracaoAcesso?: () => Promise<{ ia?: string; vozAoVivo?: boolean; vozAoVivoVisitante?: boolean; transcricao?: boolean }>;
  sessao?: () => Promise<{ visitante?: boolean }>;
};

const consultas = new WeakMap<object, Promise<ProvedorTexto | null>>();
const ehProvedorReal = (ia?: string): ia is ProvedorTexto => ia === 'openai' || ia === 'deepseek';

/**
 * Como `consultarElegibilidadeVozAoVivo` da web: a opção aparece com o WebRTC do navegador, a flag `vozAoVivo` do
 * servidor, um provedor de texto real e, para visitante, também `vozAoVivoVisitante`. Devolve o provedor de texto (para o
 * aviso de privacidade dizer quem avalia a explicação) ou null. Uma consulta por cliente (cada sessão tem o seu).
 */
export function provedorDaVozAoVivo(cliente: ClienteElegibilidadeVoz, suporte = suporteVozAoVivo()): Promise<ProvedorTexto | null> {
  const { configuracaoAcesso, sessao } = cliente;
  if (!suporte || !cliente.iniciarVozAoVivo || !configuracaoAcesso || !sessao) return Promise.resolve(null);
  let consulta = consultas.get(cliente);
  if (!consulta) {
    consulta = configuracaoAcesso()
      .then(async (cfg) => {
        if (!cfg.vozAoVivo || !ehProvedorReal(cfg.ia)) return null;
        const atual = await sessao();
        return !atual.visitante || Boolean(cfg.vozAoVivoVisitante) ? cfg.ia : null;
      })
      .catch(() => null);
    consultas.set(cliente, consulta);
  }
  return consulta;
}

/** Como `consultarGravacao` da web: o provedor de texto quando a gravação vira texto (`transcricao`), ou null. */
export function provedorDaGravacao(cliente: ClienteElegibilidadeVoz): Promise<ProvedorTexto | null> {
  if (!cliente.configuracaoAcesso) return Promise.resolve(null);
  return cliente.configuracaoAcesso()
    .then((cfg) => (cfg.transcricao && ehProvedorReal(cfg.ia) ? cfg.ia : null))
    .catch(() => null);
}

/** O cartão "Conversar com o Stu" (.voz-ao-vivo-entrada): o microfone, o benefício, o botão e a nota de privacidade. */
export function EntradaVozAoVivo({ desativado, aoAbrir, provedor = 'openai' }: { desativado: boolean; aoAbrir: () => void; provedor?: ProvedorTexto }) {
  return (
    <View testID="voz-entrada" style={v.entrada}>
      <View style={v.entradaCabeca}>
        <View style={v.entradaIcone}><Icone nome="microfone" tamanho={20} cor={cores.acao} /></View>
        <Text style={v.beneficio}>{m.abrirBeneficio}</Text>
      </View>
      <Botao variante="secundario" rotulo={m.abrir} desativado={desativado} acao={aoAbrir} estilo={v.labioFora} />
      <Text style={v.nota}>{m.notaPrivacidadePorProvedor(provedor)}</Text>
    </View>
  );
}

/** O aviso da primeira vez (.voz-ao-vivo-privacidade): a voz vai para a OpenAI; "Começar conversa" ou "Agora não". */
export function PrivacidadeVozAoVivo({ aoAceitar, aoCancelar, aoMedir, provedor = 'openai' }: {
  /** Provedor de texto: com a DeepSeek, o aviso diz que a voz vai para a OpenAI e o texto é avaliado pela DeepSeek. */
  provedor?: ProvedorTexto;
  aoAceitar: () => void;
  aoCancelar: () => void;
  aoMedir?: (evento: LayoutChangeEvent) => void;
}) {
  return (
    <View testID="voz-privacidade" role="region" aria-label={m.privacidadeTitulo} style={v.painel} onLayout={aoMedir}>
      <Text role="heading" aria-level={3} style={v.titulo}>{m.privacidadeTitulo}</Text>
      <Text style={v.texto}>{m.privacidadeTextoPorProvedor(provedor)}</Text>
      <View style={v.controles}>
        <Botao rotulo={m.privacidadeAceitar} acao={aoAceitar} />
        <Botao variante="secundario" rotulo={m.privacidadeCancelar} acao={aoCancelar} />
      </View>
    </View>
  );
}

/** A faixa de "Conectando…" (.voz-ao-vivo-progresso): um trecho de 40% que corre da esquerda para a direita. */
function Progresso() {
  const reduzir = useMovimentoReduzido();
  const [largura, setLargura] = useState(0);
  const [corrida] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduzir !== false || !largura) { corrida.setValue(0.25); return; }
    corrida.setValue(0);
    const laco = Animated.loop(Animated.timing(corrida, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    laco.start();
    return () => laco.stop();
  }, [reduzir, largura, corrida]);
  // translateX de -100% a 300% do próprio trecho (40% da faixa), como @keyframes vozProgresso.
  const trecho = largura * 0.4;
  return (
    <View style={v.progresso} onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}
      importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[v.progressoTrecho, { width: trecho, transform: [{ translateX: corrida.interpolate({ inputRange: [0, 1], outputRange: [-trecho, trecho * 3] }) }] }]} />
    </View>
  );
}

const PESOS_VOZ = [0.6, 0.9, 1, 0.85, 0.65];
/**
 * As cinco barras do "Ouvindo você" (.ensino-ondas.voz-ao-vivo-ondas): sobem com o nível do microfone (0 a 1), como a web
 * (escala de 0,28 a 1). Sem nível medido (-1, navegador sem Web Audio), ficam cheias, como as barras da web sem o medidor.
 */
export function OndasDaVoz({ nivel }: { nivel: Animated.Value }) {
  return (
    <View testID="voz-ondas" style={v.ondas} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {PESOS_VOZ.map((peso, indice) => {
        const cheia = 0.72 / peso;
        const escala = cheia < 1
          ? nivel.interpolate({ inputRange: [-1, 0, cheia, 1], outputRange: [1, 0.28, 1, 1], extrapolate: 'clamp' })
          : nivel.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0.28, 0.28 + peso], extrapolate: 'clamp' });
        return <Animated.View key={indice} style={[v.onda, { transform: [{ scaleY: escala }] }]} />;
      })}
    </View>
  );
}

/** As legendas da conversa (.voz-ao-vivo-legendas): descem sozinhas a cada fala, a menos que a pessoa tenha subido. */
function Legendas({ legendas, avisoTempo }: { legendas: TurnoLegenda[]; avisoTempo: boolean }) {
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const subiu = useRef(false);
  return (
    <ScrollView ref={rolagem} testID="voz-legendas" nestedScrollEnabled style={[v.legendas, avisoTempo && v.legendasComAviso]}
      contentContainerStyle={v.legendasConteudo} scrollEventThrottle={64}
      onScroll={(evento) => {
        const { contentOffset, layoutMeasurement, contentSize } = evento.nativeEvent;
        subiu.current = contentOffset.y + layoutMeasurement.height < contentSize.height - 24;
      }}
      onContentSizeChange={() => { if (!subiu.current) rolagem.current?.scrollToEnd({ animated: false }); }}>
      {legendas.map((turno) => (
        <Text key={`${turno.autor}-${turno.id}`} style={v.turno}>
          <Text style={[v.autor, turno.autor === 'stu' && { color: cores.acao }]}>{turno.autor === 'stu' ? m.stuDisse : m.voceDisse}:</Text>{' '}
          {turno.texto}
        </Text>
      ))}
    </ScrollView>
  );
}

/** O painel da conversa (.voz-ao-vivo-painel), estado por estado, como a web. */
export function PainelVozAoVivo({ estado, nivel, aoAlternarMudo, aoEncerrar, aoTrocar, aoMedir, aoMedirControles }: {
  estado: EstadoSessaoVozAoVivo;
  nivel: Animated.Value;
  aoAlternarMudo: () => void;
  aoEncerrar: () => void;
  aoTrocar: () => void;
  aoMedir?: (evento: LayoutChangeEvent) => void;
  aoMedirControles?: (evento: LayoutChangeEvent) => void;
}) {
  const esperando = estado.estado === 'pedindo_mic' || estado.estado === 'conectando' || estado.estado === 'encerrando';
  const conversando = estado.estado === 'ouvindo' || estado.estado === 'stu_falando';
  return (
    <View testID="voz-painel" style={v.painel} onLayout={aoMedir}>
      {/* Como .somente-leitor com aria-live: o leitor de tela ouve a mudança de estado sem ela aparecer duas vezes. */}
      <Text accessibilityLiveRegion="polite" aria-live="polite" style={v.somenteLeitor}>{estado.anuncioSr}</Text>
      <View style={v.cabeca}>
        <Text style={v.estado}>{m.estados[estado.estado]}</Text>
        <Text style={v.tempo}>{formatarTempoVoz(estado.segundos)} / {formatarTempoVoz(estado.limiteSegundos)}</Text>
      </View>
      {!estado.avisoTempo && conversando && (
        <Text style={v.dica}>{estado.estado === 'stu_falando' ? m.dicaInterromper : m.dicaOuvindo}</Text>
      )}
      {(estado.estado === 'pedindo_mic' || estado.estado === 'conectando') && <Progresso />}
      {estado.estado === 'ouvindo' && !estado.mudo && <OndasDaVoz nivel={nivel} />}
      {estado.avisoTempo && estado.estado !== 'erro' && (
        <Text testID="voz-aviso-tempo" role="status" accessibilityLiveRegion="polite" style={v.aviso}>{m.avisoTempo}</Text>
      )}
      {estado.estado === 'erro' && estado.erro
        ? <Text testID="voz-erro" accessibilityRole="alert" style={v.erro}>{textoErroVozAoVivo(estado.erro)}</Text>
        : <Legendas legendas={estado.legendas} avisoTempo={estado.avisoTempo} />}
      <View style={v.controles} onLayout={aoMedirControles}>
        {estado.estado !== 'erro' && (
          <>
            <Botao variante="secundario" rotulo={estado.mudo ? m.ativarMic : m.mudo} desativado={esperando} acao={aoAlternarMudo} />
            <Botao rotulo={m.encerrar} desativado={esperando} acao={aoEncerrar} />
          </>
        )}
        <Botao variante="texto" rotulo={m.alternativaTexto} acao={aoTrocar} estilo={v.botaoTexto} />
      </View>
    </View>
  );
}

const v = StyleSheet.create({
  // .voz-ao-vivo-entrada: grade com vão de 10, 14 × 16 de respiro, borda de 1 e raio de 14; no celular, o botão na largura toda.
  entrada: { gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: borda, borderRadius: 14, backgroundColor: superficie },
  entradaCabeca: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entradaIcone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
  beneficio: { flex: 1, color: cores.texto, opacity: 0.85, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5 },
  // <p class="estudio-legenda voz-ao-vivo-nota">: .estudio-card p dá margem de 12 e entrelinha 1,6.
  nota: { marginVertical: 12, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 13.6, lineHeight: 21.76 },
  // Na web, o lábio de 4 é sombra (fora da caixa); no app, fica dentro: o que vem depois começa 4 antes.
  labioFora: { marginBottom: -4 },
  // .botao--texto: 48 de altura (sem lábio) e 12 de respiro nos lados, para "Prefiro escrever ou gravar" caber numa linha.
  botaoTexto: { minHeight: 48, paddingHorizontal: 12 },
  painel: { gap: 12, padding: 16, borderWidth: 1, borderColor: borda, borderRadius: 14, backgroundColor: cores.fundo },
  // h3 dentro de .estudio-card: 1,1rem (17,6), entrelinha 1,3, -0,015em, 20 acima; o peso 600 vem de .voz-ao-vivo-titulo.
  titulo: { marginTop: 20, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '600', fontSize: 17.6, lineHeight: 22.88, letterSpacing: -0.264 },
  texto: { marginVertical: 12, color: cores.texto, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 22.4 },
  // Vão de 8 na web, com o lábio fora da caixa; aqui o lábio está dentro do botão, então o vão fica em 4.
  controles: { gap: 4 },
  somenteLeitor: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  cabeca: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  estado: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '600', fontSize: 14, lineHeight: 21 },
  tempo: { color: cores.texto, opacity: 0.8, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 19.5, fontVariant: ['tabular-nums'] },
  dica: { marginVertical: 12, color: cores.texto, opacity: 0.8, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 20.8 },
  progresso: { height: 4, borderRadius: 999, backgroundColor: borda, overflow: 'hidden' },
  progressoTrecho: { height: '100%', borderRadius: 999, backgroundColor: cores.acao },
  // 36 de altura com o respiro de 4 dentro (box-sizing: border-box): as barras de 32 ficam centradas.
  ondas: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, height: 36 },
  onda: { width: 6, height: 32, borderRadius: 3, backgroundColor: cores.acao },
  aviso: { marginVertical: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FFF6DB', color: '#5A4300',
    fontFamily: fontes.corpo, fontSize: 13, lineHeight: 20.8, overflow: 'hidden' },
  erro: { marginVertical: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#FDECEC', color: '#7C1D1D',
    fontFamily: fontes.corpo, fontSize: 14, lineHeight: 22.4, overflow: 'hidden' },
  // No celular (≤ 600 px na web): de 96 a 160 de altura; com o aviso dos 30 s, de 76 a 120, para os controles caberem.
  legendas: { flexGrow: 0, minHeight: 96, maxHeight: 160, borderRadius: 10, backgroundColor: superficie },
  legendasComAviso: { minHeight: 76, maxHeight: 120 },
  legendasConteudo: { gap: 8, paddingVertical: 10, paddingHorizontal: 12 },
  // Cada fala é um <p> dentro de .estudio-card: margem de 12 e entrelinha 1,6, além do vão de 8 entre elas.
  turno: { marginVertical: 12, color: cores.texto, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 22.4 },
  autor: { fontWeight: '700' },
});
