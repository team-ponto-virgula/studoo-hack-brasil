import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAudioRecorderState, type AudioRecorder } from 'expo-audio';
import type { ApoioEstudo, PaginaMaterial } from '@studoo/contratos';
import { Icone } from './icone';
import { estilos, useMovimentoReduzido, LinhaAbrir, degrauFora } from './interface';
import { mensagens } from './mensagens';
import { Stu } from './mascote';
import { cores, fontes } from './tema';

/*
 * Cenas do estúdio no app, espelhando as rodadas 1.1–1.3 da web (docs/ui/DIRECAO-UI.md, Momentos 1–3): a ponte de
 * reforço como cena (margens, tábuas, cordas, água e a travessia do Stu), o Stu como aluno no "Ensine ao Stu", as ondas
 * pelo volume real do microfone, o caderno do retorno e o cartão de cada página do material. Só Views e Animated, sem
 * dependência nova. Com movimento reduzido, tudo aparece no estado final, parado.
 */

const m = mensagens.estudio;
const madeira = { face: '#9C5619', borda: '#703B10' };

/**
 * O Stu como aluno no "Ensine ao Stu": com dúvida, ouvindo (balança devagar enquanto grava ou na conversa ao vivo), falando
 * (na conversa ao vivo, sobe e desce de leve, como .ensino-stu[data-falando] da web) ou anotando o retorno. Na conversa ao
 * vivo, o balão diz o estado dela (`fala`), como a web.
 */
export function StuAluno({ estado, fala: falaDaConversa }: { estado: 'aluno' | 'ouvindo' | 'falando' | 'anotou'; fala?: string }) {
  const fala = falaDaConversa ?? (estado === 'ouvindo' ? m.ensinoStuOuvindo : estado === 'anotou' ? m.ensinoStuAnotou : m.ensinoStuAluno);
  // Spec 13: aluno curioso (parado); ouvindo concentrado e falando animado, em laço enquanto o estado dura (mostra que ele
  // ouve ou fala); anotou encorajador, um ciclo no acontecimento. A troca de expressão dá o pop da §B7.
  const nome = estado === 'ouvindo' ? 'stu-concentrado' : estado === 'falando' ? 'stu-animado' : estado === 'anotou' ? 'stu-encorajador' : 'stu-curioso';
  // Como .ensino-stu da web: uma caixa com borda e fundo névoa, o Stu e a fala em 16 px/800 ao lado; ouvindo (gravação
  // ou conversa), a borda fica azul e o fundo lavanda (data-gravando).
  const ouvindo = estado === 'ouvindo';
  return (
    <View style={[aluno.caixa, ouvindo && aluno.caixaOuvindo]}>
      <View style={aluno.avatar} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Stu nome={nome} tamanho={56} animado={estado === 'ouvindo' || estado === 'falando' ? 'laco' : estado === 'anotou' ? 'acontecimento' : undefined}
          acontecimento={estado === 'anotou' ? 'anotou' : undefined} />
      </View>
      <Text accessibilityLiveRegion="polite" style={aluno.fala}>{fala}</Text>
    </View>
  );
}

/** O nome da etapa sem o número da lista antiga ("1. Gravar ou escrever" → "Gravar ou escrever"). */
export function nomeDaEtapaDoEnsino(etapa: string) {
  return etapa.replace(/^\d+\.\s*/, '');
}

/**
 * As três etapas do "Ensine ao Stu" numa linha só de indicador, como a da ponte (spec 16, item 25): "Passo 1 de 3 · Gravar
 * ou escrever", em 14/20 800 #5E6A85, sem nada tocável (antes eram pílulas com borda, que pareciam filtros). O leitor de tela
 * ouve "Passo 1 de 3: Gravar ou escrever". Com a voz ao vivo liberada, a primeira vira "Conversar, gravar ou escrever"
 * (`primeira`), como na web.
 */
export function EtapasDoEnsino({ ativa, primeira }: { ativa: 0 | 1 | 2; primeira?: string }) {
  const etapas = (primeira ? [primeira, m.ensinoEtapas[1], m.ensinoEtapas[2]] : [...m.ensinoEtapas]).map(nomeDaEtapaDoEnsino);
  const passo = m.ponteIndicador(ativa + 1);
  return (
    <Text testID="ensino-passo" accessible accessibilityRole="text" accessibilityLabel={`${passo}: ${etapas[ativa]}`} accessibilityLiveRegion="polite"
      style={aluno.etapaLinha}>
      {`${passo} · ${etapas[ativa]}`}
    </Text>
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
  // Como a web: com movimento reduzido, ela nem liga o analisador e as cinco barras ficam paradas na altura cheia.
  const reduzir = useMovimentoReduzido();
  const nivel = reduzir || typeof estado.metering !== 'number' ? null : Math.max(0, Math.min(1, (estado.metering + 60) / 60));
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
            {/* Os acertos são <li> na web: entrelinha do corpo (1,5), não a de parágrafo do cartão (1,6). */}
            <Text style={[texto, { flex: 1 }, !compacto && { lineHeight: 24 }]}>{acerto}</Text>
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
          <Stu nome="stu-concentrado" tamanho={compacto ? 32 : 48} />
          <View style={caderno.duvida}><Text style={caderno.duvidaTexto}>?</Text></View>
        </View>
        {/* Título e pergunta sem vão entre eles, como .ensino-caderno__pergunta da web (h3 e p sem margem). */}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={titulo}>{m.pergunta}</Text>
          <Text style={[caderno.perguntaTexto, compacto && caderno.textoCompacto]}>{ensino.pergunta}</Text>
        </View>
      </View>
      </View>
      <View style={[cartao, caderno.proximo]}>
        <Text accessibilityRole="header" style={titulo}>{m.proximo}</Text>
        <Text style={texto}>{ensino.proximoPasso}</Text>
      </View>
      {/* .estudio-legenda: 0,85rem com entrelinha 1,6 no cartão; na apresentação, 1,5. */}
      {ensino.simulado && <Text style={[estilos.legenda, { marginTop: compacto ? 0 : 12, fontSize: 13.6, lineHeight: compacto ? 20.4 : 21.76 }, compacto && { textAlign: 'center' }]}>{m.ensinoAutomatico}</Text>}
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
  // .ponte-margem: borda de 2 (o filete verde-claro embaixo), 6 em cima e o degrau de 3 por fora (box-shadow 0 3px 0 #5b9a30).
  margem: { position: 'relative', zIndex: 1, minWidth: 58, alignItems: 'center', gap: 4, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 5,
    borderRadius: 12, borderWidth: 2, borderTopWidth: 6, borderColor: '#76BF43', borderTopColor: '#58CC02',
    backgroundColor: '#F6FBF1', boxShadow: '0 3px 0 #5B9A30' },
  margemEsquerda: { zIndex: 2 },
  margemDireita: { borderColor: '#46A302', borderTopColor: '#58CC02', backgroundColor: '#ECF9E3' },
  lugarStu: { width: 32, height: 32 },
  // .ponte-margem no celular: 0,6875rem com a entrelinha do corpo (1,5): 16,5.
  margemTexto: { color: '#1F3D14', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 11, lineHeight: 16.5, textAlign: 'center' },
  vao: { position: 'relative', flex: 1, alignSelf: 'center', flexDirection: 'row', gap: 4, paddingVertical: 6 },
  trilho: { position: 'absolute', left: -8, right: -8, height: 3, borderRadius: 2, backgroundColor: '#8D5C2C' },
  tabuaLugar: { flex: 1, minHeight: 32 },
  // A faixa da ponte clara (spec 05, 62b964b): 88 de altura, o Stu em cima e a fileira de margens e tábuas embaixo.
  seloPonte: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seloPonteIcone: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7ECFF' },
  seloPonteTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18, letterSpacing: 0.8 },
  // A faixa da web (b75134a): água azul-clara com raio 16, as margens como texto e as três tábuas no meio.
  faixaPonte: { height: 88, justifyContent: 'flex-end', maxWidth: 560, paddingHorizontal: 8, paddingBottom: 8, borderRadius: 16, backgroundColor: '#E4F1FF', overflow: 'hidden' },
  faixaStu: { position: 'absolute', top: 0, left: 0, width: 36, height: 40, alignItems: 'center', justifyContent: 'flex-end' },
  faixaLinha: { flexDirection: 'row', alignItems: 'stretch', gap: 6, height: 44 },
  faixaMargem: { width: 58, minWidth: 58, alignItems: 'center', justifyContent: 'center' },
  faixaMargemTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 16, textAlign: 'center' },
  faixaLugar: { flex: 1, justifyContent: 'center' },
  // O anel da tábua atual: a spec cita o azul antigo; aqui é a cor de ação do tema (a paleta da web, #2563FF).
  faixaAtual: { borderWidth: 3, borderColor: cores.acao },
  faixaPasso: { marginTop: 8, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  tabuaFalta: { flex: 1, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: '#9D7349',
    borderRadius: 10, backgroundColor: 'rgba(255,250,242,0.88)', opacity: 0.85 },
  tabua: { minHeight: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 10 },
  tabuaNumero: { color: '#4B2F15', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 15 },
  stu: { zIndex: 3 },
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
  caixaOuvindo: { borderColor: cores.acao, backgroundColor: cores.ceu },
  fala: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 25.6 },
  avatar: { width: 52, alignItems: 'center', justifyContent: 'center' },
  stu: { width: 56, height: 56 },
  adereco: { position: 'absolute', top: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.ouroEscuro, borderWidth: 2, borderColor: cores.fundo },
  aderecoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 16 },
  balao: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoSeta: { position: 'absolute', left: -7, top: '50%', marginTop: -6, width: 12, height: 12, backgroundColor: cores.fundo, borderLeftWidth: 2,
    borderBottomWidth: 2, borderColor: cores.gelo, transform: [{ rotate: '45deg' }] },
  balaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 21 },
  // A linha do indicador, como "Passo n de 3 · …" da ponte (cena.faixaPasso).
  etapaLinha: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
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
  pergunta: { flexDirection: 'row', alignItems: 'center', gap: 14, borderColor: '#C3CDF2', backgroundColor: cores.ceu },
  proximo: { borderColor: '#9AD8B5', backgroundColor: cores.sucessoFundo },
  // .ensino-caderno__cartao h3: 0,9375rem com a entrelinha de 1,3 dos títulos do cartão (19,5).
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 15, lineHeight: 19.5 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // .ensino-caderno__visto: círculo de 22 em #EEFAF3 com o visto de 13 px em 900.
  visto: { width: 22, height: 22, borderRadius: 11, overflow: 'hidden', textAlign: 'center', backgroundColor: cores.sucessoFundo, color: cores.sucesso,
    fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 22 },
  // .ensino-caderno__stu: 48 de largura com o Stu de 44; o "?" é um círculo de 20 sem aro.
  perguntaStu: { width: 48, height: 50, justifyContent: 'center' },
  stu: { width: 44, height: 50 },
  duvida: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: cores.acao },
  duvidaTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 18 },
  perguntaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 25.6 },
  textoCartao: { lineHeight: 25.6 },
  // Compacto (apresentação): como a web no celular, 8 × 10 de respiro, título de 12 e texto de 14.
  // .apresentacao-caderno .ensino-caderno__cartao no celular: 8 × 10 de respiro e o vão de 6 do cartão; h3 de 0,75rem com
  // entrelinha 1,3 (15,6) e texto de 0,875rem com 1,35 (18,9).
  cartaoCompacto: { paddingVertical: 8, paddingHorizontal: 10, gap: 6, borderRadius: 16 },
  tituloCompacto: { fontSize: 12, lineHeight: 15.6 },
  textoCompacto: { fontSize: 14, lineHeight: 18.9 },
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

/**
 * Ponte clara (spec 05, 62b964b): o indicador único dos três passos. Uma faixa de 88 com a margem "Onde travou", as
 * tábuas 1 a 3 (feita cheia, atual com o anel de 3 na cor de ação, futura tracejada) e a margem "Exercício", com o stu-perfil de 36
 * sobre a tábua atual (na margem "Onde travou" carregando; na margem "Exercício" vencida ou reaberta). Embaixo, "Passo n
 * de 3 · <nome>" ou "Ponte construída!". Não é tocável. O Stu pula de uma posição à outra em 320 ms; com movimento
 * reduzido, aparece no lugar novo.
 */
export function FaixaDaPonte({ passo, construida, carregando, comemorar = false, semLinha = false }: {
  passo: 1 | 2 | 3; construida: boolean; carregando: boolean;
  /** Vencida agora: o Stu na margem "Exercício" vira o stu-animado (uma vez, spec 13). */
  comemorar?: boolean;
  /** Sem a linha "Passo n de 3" embaixo (a apresentação inicial). */
  semLinha?: boolean;
}) {
  const reduzir = useMovimentoReduzido();
  const alvo = carregando ? 0 : construida ? 4 : passo;
  const [largura, setLargura] = useState(0);
  const [posicao] = useState(() => new Animated.Value(alvo));
  const [salto] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduzir !== false) { posicao.setValue(alvo); salto.setValue(0); return; }
    const animacao = Animated.parallel([
      Animated.timing(posicao, { toValue: alvo, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(salto, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(salto, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]);
    animacao.start();
    return () => animacao.stop();
  }, [alvo, reduzir, posicao, salto]);
  // O centro de cada lugar: as margens têm 58 (com 6 de vão), as três tábuas dividem o meio.
  // A faixa tem 8 de respiro dos lados (o fundo de água): os lugares contam a partir dele.
  const MARGEM = 58, VAO = 6, RESPIRO = 8;
  const util = Math.max(0, largura - 2 * RESPIRO);
  const meio = Math.max(0, util - 2 * (MARGEM + VAO));
  const centros = [MARGEM / 2, ...[1, 2, 3].map((k) => MARGEM + VAO + (k - 0.5) * (meio / 3)), util - MARGEM / 2].map((x) => RESPIRO + x - 18);
  const nomes = [m.pontePassoExplicacao, m.pontePassoExemplo, m.pontePassoDesafio];
  return (
    <View testID="faixa-ponte">
      <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={cena.faixaPonte}
        onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}>
        {largura > 0 && (
          <Animated.View testID="faixa-ponte-stu" style={[cena.faixaStu, { transform: [
            { translateX: posicao.interpolate({ inputRange: [0, 1, 2, 3, 4], outputRange: centros }) },
            { translateY: salto.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
          ] }]}>
            {comemorar ? <Stu nome="stu-animado" tamanho={36} animado="uma-vez" /> : <Stu nome="stu-perfil" tamanho={36} />}
          </Animated.View>
        )}
        <View style={cena.faixaLinha}>
          <View style={cena.faixaMargem}><Text style={cena.faixaMargemTexto}>{m.ponteMargemErro}</Text></View>
          {[1, 2, 3].map((numero) => {
            const feita = !carregando && (construida || numero < passo);
            const atual = !carregando && !construida && numero === passo;
            return (
              <View key={numero} testID={feita ? 'faixa-tabua-feita' : atual ? 'faixa-tabua-atual' : 'faixa-tabua-futura'} style={cena.faixaLugar}>
                {feita || atual ? (
                  <View style={[cena.tabua, { backgroundColor: madeira.face, borderColor: madeira.borda }, atual && cena.faixaAtual]}>
                    <Text style={[cena.tabuaNumero, { color: cores.fundo }]}>{numero}</Text>
                  </View>
                ) : (
                  <View style={cena.tabuaFalta}><Text style={cena.tabuaNumero}>{numero}</Text></View>
                )}
              </View>
            );
          })}
          <View style={cena.faixaMargem}><Text style={cena.faixaMargemTexto}>{m.ponteMargemVolta}</Text></View>
        </View>
      </View>
      {!semLinha && (
        <Text testID="faixa-ponte-passo" accessibilityLiveRegion="polite" style={cena.faixaPasso}>
          {construida ? m.ponteConstruida : `${m.ponteIndicador(passo)} · ${nomes[passo - 1]}`}
        </Text>
      )}
    </View>
  );
}

/** O selo "REFORÇO" da ponte clara, no formato do "CONCEITO" da aula, com o laço (`revisao`), o mesmo do selo "Reforço" do mapa. */
export function SeloDaPonte({ depois }: { depois?: ReactNode }) {
  return (
    <View style={cena.seloPonte}>
      <View style={cena.seloPonteIcone}><Icone nome="revisao" tamanho={20} cor={cores.acao} /></View>
      <Text style={cena.seloPonteTexto}>{m.ponteMapa.toLocaleUpperCase('pt-BR')}</Text>
      {depois}
    </View>
  );
}
