import type { EstadoOnboarding, MetaLicoesDia, ResumoRetencao } from '@studoo/contratos/onboarding';
import { LIMITES_GERACAO } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Image, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Campo, Tela, Titulo } from './interface';
import { Stu } from './mascote';
import { mensagemDeErro } from './mensagens';
import { ouvirVoltar } from './voltar';

export const OBJETIVO_MATERIAL_ONBOARDING = 'Quero estudar a partir de um material';
export type ModoPrimeiroEstudo = 'assunto' | 'material';
const METAS = [
  { valor: 1 as const, titulo: 'Leve', texto: '1 lição por dia' },
  { valor: 2 as const, titulo: 'Constante', texto: '2 lições por dia' },
  { valor: 3 as const, titulo: 'Intenso', texto: '3 lições por dia' },
];

function Acao({ children, acao, testID, secundaria = false, discreta = false, desativada = false }: {
  children: ReactNode; acao: () => void; testID: string; secundaria?: boolean; discreta?: boolean; desativada?: boolean;
}) {
  return <Pressable accessibilityRole="button" disabled={desativada} accessibilityState={{ disabled: desativada }}
    testID={testID} onPress={acao} style={({ pressed }) => [s.acao, secundaria && s.acaoSecundaria, pressed && !desativada && s.pressionada, desativada && s.desativada]}>
    <Text style={[s.acaoTexto, secundaria && s.acaoTextoSecundaria, discreta && s.acaoTextoDiscreta]}>{children}</Text>
  </Pressable>;
}

/** Duas escolhas úteis, salvas na conta antes de iniciar o pipeline real de estudo. */
export function PrepararPrimeiroEstudo({ estado, ocupado, erro, preparar, adiar }: {
  estado: EstadoOnboarding;
  ocupado: boolean;
  erro: string | null;
  preparar: (objetivo: string, meta: MetaLicoesDia, modo: ModoPrimeiroEstudo) => Promise<void>;
  adiar: () => Promise<void>;
}) {
  const [passo, setPasso] = useState<'objetivo' | 'meta'>('objetivo');
  const [objetivo, setObjetivo] = useState(estado.objetivo ?? '');
  const [meta, setMeta] = useState<MetaLicoesDia>(estado.metaLicoesDia);
  const [modo, setModo] = useState<ModoPrimeiroEstudo>(estado.modo);
  const [validacao, setValidacao] = useState<string | null>(null);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const emCurso = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const registro = ouvirVoltar(() => {
      if (ocupado || emCurso.current) return true;
      if (passo === 'meta') { setPasso('objetivo'); return true; }
      return false;
    }, passo === 'meta');
    return () => registro.remove();
  }, [passo, ocupado]);

  function continuar(material = false) {
    if (ocupado) return;
    if (!material && objetivo.trim().length < LIMITES_GERACAO.objetivoMin) {
      setValidacao('Conte um pouco mais sobre o que quer aprender.');
      AccessibilityInfo.announceForAccessibility('Conte um pouco mais sobre o que quer aprender.');
      campo.current?.focus();
      return;
    }
    setModo(material ? 'material' : 'assunto');
    setValidacao(null);
    Keyboard.dismiss();
    setPasso('meta');
  }

  async function concluir() {
    if (ocupado || emCurso.current) return;
    emCurso.current = true;
    try {
      await preparar(modo === 'material' ? objetivo.trim() || OBJETIVO_MATERIAL_ONBOARDING : objetivo.trim(), meta, modo);
    } finally { emCurso.current = false; }
  }

  return <Tela pagina={`onboarding-${passo}`} semCabecalho estiloConteudo={s.pagina}>
    <View style={s.topo}>
      <Image source={require('../assets/marca/logo-com-sorriso.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Studoo" />
    </View>
    <View style={s.introducao}>
      <View style={s.stu} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Stu nome={passo === 'objetivo' ? 'stu-curioso' : 'stu-encorajador'} tamanho={96} /></View>
      <Text style={s.contexto}>Seu primeiro estudo · {passo === 'objetivo' ? '1' : '2'} de 2</Text>
      <Titulo foco key={passo} testID={`titulo-onboarding-${passo}`} estilo={s.titulo}>
        {passo === 'objetivo' ? 'O que você quer aprender?' : 'Um passo por dia.'}
      </Titulo>
      <Text style={s.descricao}>{passo === 'objetivo'
        ? 'Conte seu objetivo. O Stu transforma esse começo em uma trilha.'
        : 'Escolha uma meta que caiba na sua rotina. Você pode mudar depois.'}</Text>
    </View>

    {passo === 'objetivo' ? <View style={s.conteudo}>
      <Campo campoRef={campo} rotulo="Seu objetivo" testID="onboarding-objetivo" value={objetivo}
        onChangeText={(valor) => { setObjetivo(valor); setValidacao(null); }} placeholder="Quero aprender SQL para…"
        multiline maxLength={LIMITES_GERACAO.objetivoMax} editable={!ocupado} style={s.campo} estiloRotulo={s.rotulo}
        erro={validacao ?? undefined} textAlignVertical="top" />
    </View> : <View style={s.conteudo} accessibilityRole="radiogroup" accessibilityLabel="Meta diária de lições">
      {METAS.map((item) => <Pressable key={item.valor} testID={`onboarding-meta-${item.valor}`} accessibilityRole="radio"
        accessibilityLabel={`${item.titulo}, ${item.texto}`} accessibilityState={{ checked: meta === item.valor, disabled: ocupado }} disabled={ocupado}
        onPress={() => setMeta(item.valor)} style={({ pressed }) => [s.opcao, meta === item.valor && s.opcaoSelecionada, pressed && s.pressionada]}>
        <View style={[s.radio, meta === item.valor && s.radioSelecionado]}>{meta === item.valor && <View style={s.radioCentro} />}</View>
        <View style={s.opcaoTextos}><Text style={s.opcaoTitulo}>{item.titulo}</Text><Text style={s.opcaoTexto}>{item.texto}</Text></View>
      </Pressable>)}
    </View>}
    {erro && <Text accessibilityRole="alert" testID="onboarding-erro" style={s.erro}>{erro}</Text>}
    <View style={s.acoes}>
      <Acao testID={passo === 'objetivo' ? 'onboarding-continuar' : 'onboarding-preparar'} desativada={ocupado}
        acao={passo === 'objetivo' ? () => continuar() : () => void concluir()}>
        {ocupado ? 'Salvando seu começo…' : passo === 'objetivo' ? 'Continuar' : 'Preparar meu estudo'}
      </Acao>
      {passo === 'objetivo'
        ? <Acao testID="onboarding-material" secundaria desativada={ocupado} acao={() => continuar(true)}>Tenho um material</Acao>
        : <Acao testID="onboarding-voltar" secundaria desativada={ocupado} acao={() => setPasso('objetivo')}>Voltar</Acao>}
      <Acao testID="onboarding-adiar" secundaria discreta desativada={ocupado} acao={() => void adiar()}>Mais tarde</Acao>
    </View>
  </Tela>;
}

/** Integra-se ao próximo passo existente; não cria outra ação primária. */
export function MetaDoDiaMobile({ resumo, mudarMeta, compacto = false }: {
  resumo: ResumoRetencao;
  mudarMeta?: (meta: MetaLicoesDia) => Promise<void>;
  compacto?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [meta, setMeta] = useState<MetaLicoesDia>(resumo.metaLicoesDia);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);
  useEffect(() => { if (!editando) setMeta(resumo.metaLicoesDia); }, [resumo.metaLicoesDia, editando]);
  async function salvar() {
    if (!mudarMeta || enviando.current) return;
    enviando.current = true; setOcupado(true); setErro(null);
    try { await mudarMeta(meta); setEditando(false); }
    catch (falha) { setErro(mensagemDeErro(falha)); }
    finally { enviando.current = false; setOcupado(false); }
  }
  return <View testID="meta-hoje" style={[s.meta, compacto && s.metaCompacta]}>
    <View style={s.metaCabeca}>
      <Text style={s.metaTitulo}>{resumo.metaAtingida
        ? `Meta atingida · ${resumo.licoesHoje} ${resumo.licoesHoje === 1 ? 'lição' : 'lições'} hoje`
        : `Hoje: ${resumo.licoesHoje} de ${resumo.metaLicoesDia} ${resumo.metaLicoesDia === 1 ? 'lição' : 'lições'}`}</Text>
      {mudarMeta && !compacto && <Pressable testID="mudar-meta" accessibilityRole="button" onPress={() => { setEditando(!editando); setErro(null); }} disabled={ocupado} style={s.link}>
        <Text style={s.metaLink}>{editando ? 'Cancelar' : 'Mudar meta'}</Text>
      </Pressable>}
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Meta diária de estudo"
      accessibilityValue={{ min: 0, max: resumo.metaLicoesDia, now: Math.min(resumo.licoesHoje, resumo.metaLicoesDia) }} style={s.trilho}>
      <View style={[s.preenchimento, { width: `${Math.min(1, resumo.licoesHoje / resumo.metaLicoesDia) * 100}%` }]} />
    </View>
    {!compacto && resumo.metaAtingida && <Text style={s.metaTexto}>Meta de hoje concluída. Você pode descansar ou seguir.</Text>}
    {editando && <View style={s.editor}>
      <View style={s.conteudo} accessibilityRole="radiogroup" accessibilityLabel="Meta diária de lições">
        {METAS.map((item) => <Pressable key={item.valor} accessibilityRole="radio" testID={`editar-meta-${item.valor}`}
          accessibilityLabel={`${item.titulo}, ${item.texto}`} accessibilityState={{ checked: meta === item.valor, disabled: ocupado }} disabled={ocupado}
          onPress={() => setMeta(item.valor)} style={[s.opcao, meta === item.valor && s.opcaoSelecionada]}>
          <View style={[s.radio, meta === item.valor && s.radioSelecionado]}>{meta === item.valor && <View style={s.radioCentro} />}</View>
          <View style={s.opcaoTextos}><Text style={s.opcaoTitulo}>{item.titulo}</Text><Text style={s.opcaoTexto}>{item.texto}</Text></View>
        </Pressable>)}
      </View>
      <Acao testID="salvar-meta" desativada={ocupado} acao={() => void salvar()}>{ocupado ? 'Salvando…' : 'Salvar meta'}</Acao>
      {erro && <Text accessibilityRole="alert" style={s.erro}>{erro}</Text>}
    </View>}
  </View>;
}

const s = StyleSheet.create({
  pagina: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 24, gap: 0, maxWidth: 620 },
  topo: { flexDirection: 'row', alignItems: 'center', minHeight: 47, marginBottom: 20 },
  logo: { width: 144, height: 47 },
  introducao: { alignItems: 'flex-start' }, stu: { alignSelf: 'center', height: 96 },
  contexto: { fontFamily: 'Inter', fontSize: 13, lineHeight: 19.5, color: '#626b7e', marginTop: 16, marginBottom: 10 },
  titulo: { fontFamily: 'Inter', fontSize: 30, lineHeight: 36, fontWeight: '600', letterSpacing: -1, color: '#17213d', marginTop: 0 },
  descricao: { fontFamily: 'Inter', fontSize: 16, lineHeight: 24, color: '#626b7e', marginTop: 12, marginBottom: 24 },
  conteudo: { gap: 10 },
  rotulo: { fontFamily: 'Inter', fontWeight: '600', fontSize: 14, lineHeight: 21, color: '#17213d' },
  campo: { fontFamily: 'Inter', fontSize: 16, lineHeight: 24, minHeight: 88, borderWidth: 1, borderRadius: 12, borderColor: '#8590a6', color: '#17213d', backgroundColor: '#fafbfe', padding: 16 },
  acoes: { gap: 10, marginTop: 14 },
  acao: { minHeight: 56, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2854f4' },
  acaoTexto: { fontFamily: 'Inter', fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#fff', textAlign: 'center' },
  acaoSecundaria: { backgroundColor: 'transparent', minHeight: 44, paddingVertical: 10 },
  acaoTextoSecundaria: { color: '#2854f4', fontWeight: '600', fontSize: 14, lineHeight: 21 },
  acaoTextoDiscreta: { color: '#626b7e', fontWeight: '400' },
  pressionada: { opacity: .78 }, desativada: { opacity: .55 },
  erro: { color: '#b32735', fontFamily: 'Inter', fontSize: 14, lineHeight: 22, marginTop: 8 },
  opcao: { minHeight: 70, paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderColor: '#dce0e8', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  opcaoSelecionada: { borderColor: '#2854f4', backgroundColor: '#f6f8ff' },
  opcaoTextos: { flex: 1, gap: 2 },
  opcaoTitulo: { fontFamily: 'Inter', fontSize: 15, lineHeight: 22.5, fontWeight: '600', color: '#17213d' },
  opcaoTexto: { fontFamily: 'Inter', fontSize: 14, lineHeight: 21, color: '#626b7e' },
  radio: { width: 18, height: 18, borderWidth: 1, borderRadius: 9, borderColor: '#8590a6', alignItems: 'center', justifyContent: 'center' },
  radioSelecionado: { borderColor: '#2854f4' }, radioCentro: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2854f4' },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  linkTexto: { fontFamily: 'Inter', fontSize: 14, lineHeight: 22, color: '#2854f4', fontWeight: '500' },
  meta: { gap: 4 }, metaCompacta: { paddingVertical: 4 },
  metaCabeca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  metaTitulo: { fontFamily: 'Inter', fontSize: 14, lineHeight: 22, color: '#17213d', fontWeight: '600', flexShrink: 1 },
  metaTexto: { fontFamily: 'Inter', fontSize: 13, lineHeight: 20, color: '#626b7e' },
  metaLink: { fontFamily: 'Inter', fontSize: 13, lineHeight: 20, color: '#2854f4', fontWeight: '500' },
  trilho: { height: 5, borderRadius: 4, overflow: 'hidden', backgroundColor: '#e3e9f6' },
  preenchimento: { height: 5, borderRadius: 4, backgroundColor: '#2854f4' },
  editor: { gap: 12, marginVertical: 8 },
  opcoesCompactas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcaoCompacta: { flex: 1, minWidth: 78, minHeight: 68, borderWidth: 1, borderColor: '#b5bdcf', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 3 },
  metaOpcaoNumero: { fontFamily: 'Inter', fontSize: 18, lineHeight: 24, fontWeight: '600', color: '#17213d' },
  metaOpcaoNome: { fontFamily: 'Inter', fontSize: 12, lineHeight: 18, color: '#626b7e' },
});
