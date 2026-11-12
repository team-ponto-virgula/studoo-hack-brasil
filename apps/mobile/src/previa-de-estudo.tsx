import { ErroStudoo, type PropostaPlano } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mensagens } from './mensagens';
import { clienteDaPrevia } from './previa-sql';
import { cores, fontes } from './tema';

type Estado =
  | { tipo: 'objetivo'; erro?: string }
  | { tipo: 'gerando' }
  | { tipo: 'previa'; proposta: PropostaPlano };

function mensagemErro(erro: unknown) {
  if (erro instanceof ErroStudoo && (erro.codigo === 'invalido' || erro.codigo === 'objetivo_fora_do_piloto')) {
    return mensagens.erros[erro.codigo];
  }

  return mensagens.erros.falha;
}

export function PreviaDeEstudo() {
  const [objetivo, setObjetivo] = useState('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'objetivo' });
  const [campoFocado, setCampoFocado] = useState(false);
  const emGeracao = useRef(false);
  const gerando = estado.tipo === 'gerando';

  function atualizarObjetivo(texto: string) {
    if (emGeracao.current) return;
    setObjetivo(texto);
    setEstado({ tipo: 'objetivo' });
  }

  async function gerarPrevia() {
    if (emGeracao.current || !objetivo.trim()) return;

    Keyboard.dismiss();
    emGeracao.current = true;
    setEstado({ tipo: 'gerando' });

    try {
      const proposta = await clienteDaPrevia.gerarProposta(objetivo);
      setEstado({ tipo: 'previa', proposta });
    } catch (erro) {
      setEstado({ tipo: 'objetivo', erro: mensagemErro(erro) });
    } finally {
      emGeracao.current = false;
    }
  }

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={estilos.marcaConteudo}><Logo /></View>
      </View>

      <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {estado.tipo === 'previa' ? (
          <>
            <ScrollView key="previa" contentContainerStyle={estilos.conteudo}>
              <Previa proposta={estado.proposta} />
            </ScrollView>
            <Rodape>
              <Botao rotulo={mensagens.proposta.editar} testID="editar-objetivo" secundario
                acao={() => setEstado({ tipo: 'objetivo' })} />
            </Rodape>
          </>
        ) : (
          <>
            <ScrollView key="objetivo" keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.conteudo}>
              <Text accessibilityRole="header" style={estilos.titulo}>{mensagens.objetivo.titulo}</Text>
              <Text style={estilos.introducao}>{mensagens.objetivo.instrucao}</Text>

              <View style={estilos.campo}>
                <Text nativeID="rotulo-objetivo" style={estilos.rotulo}>{mensagens.objetivo.campo}</Text>
                <TextInput
                  testID="objetivo-estudo"
                  accessibilityLabel={mensagens.objetivo.campo}
                  accessibilityLabelledBy="rotulo-objetivo"
                  style={[estilos.entrada, campoFocado && estilos.entradaFocada]}
                  placeholder={mensagens.objetivo.placeholder}
                  placeholderTextColor={cores.textoSecundario}
                  value={objetivo}
                  onChangeText={atualizarObjetivo}
                  onFocus={() => setCampoFocado(true)}
                  onBlur={() => setCampoFocado(false)}
                  multiline
                  editable={!gerando}
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>
              <Botao rotulo={mensagens.objetivo.usarExemplo} testID="usar-exemplo-sql" secundario compacto
                desativado={gerando} acao={() => atualizarObjetivo(mensagens.objetivo.exemplo)} />
              <Text style={estilos.legenda}>{mensagens.objetivo.aviso}</Text>

              {estado.tipo === 'objetivo' && estado.erro && (
                <View accessible accessibilityRole="alert" accessibilityLabel={estado.erro} style={estilos.erro}>
                  <Text importantForAccessibility="no" style={estilos.erroSinal}>!</Text>
                  <Text style={estilos.erroTexto}>{estado.erro}</Text>
                </View>
              )}
              {gerando && (
                <View accessibilityLiveRegion="polite" accessibilityLabel={mensagens.objetivo.gerando} accessible
                  style={estilos.skeleton}>
                  <View style={estilos.skeletonCurto} />
                  <View style={estilos.skeletonLinha} />
                </View>
              )}
            </ScrollView>
            <Rodape>
              <Botao
                rotulo={gerando ? mensagens.objetivo.gerando : mensagens.objetivo.gerar}
                testID="gerar-proposta"
                ocupado={gerando}
                desativado={gerando || !objetivo.trim()}
                acao={() => void gerarPrevia()}
              />
            </Rodape>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Logo() {
  return (
    <Image source={require('../assets/marca/logo-com-sorriso.png')} resizeMode="contain"
      accessibilityLabel={mensagens.marca} accessible style={estilos.logo} />
  );
}

function Rodape({ children }: { children: ReactNode }) {
  return <View style={estilos.rodape}><View style={estilos.rodapeConteudo}>{children}</View></View>;
}

function Botao({ rotulo, testID, acao, desativado = false, ocupado = false, secundario = false, compacto = false }: {
  rotulo: string;
  testID: string;
  acao: () => void;
  desativado?: boolean;
  ocupado?: boolean;
  secundario?: boolean;
  compacto?: boolean;
}) {
  const [focado, setFocado] = useState(false);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: desativado, busy: ocupado }}
      disabled={desativado}
      onPress={acao}
      onFocus={() => setFocado(true)}
      onBlur={() => setFocado(false)}
      style={({ pressed }) => [
        estilos.botao,
        secundario && estilos.botaoSecundario,
        compacto && estilos.botaoCompacto,
        pressed && estilos.botaoPressionado,
        focado && estilos.botaoFocado,
        desativado && estilos.botaoDesativado,
      ]}
    >
      <Text style={[estilos.botaoTexto, secundario && estilos.botaoTextoSecundario,
        desativado && estilos.botaoTextoDesativado]}>{rotulo}</Text>
    </Pressable>
  );
}

const idsFluxos: Record<string, string> = {
  Consultas: 'fluxo-consultas',
  Junções: 'fluxo-juncoes',
};

function Previa({ proposta }: { proposta: PropostaPlano }) {
  const titulo = useRef<ComponentRef<typeof Text>>(null);

  useEffect(() => {
    if (titulo.current) AccessibilityInfo.sendAccessibilityEvent(titulo.current, 'focus');
  }, []);

  return (
    <>
      <Text style={estilos.tipoProposta}>{mensagens.proposta.tipo}</Text>
      <Text ref={titulo} testID="titulo-proposta" accessible accessibilityRole="header" style={estilos.titulo}>
        {proposta.titulo}
      </Text>
      <Text style={estilos.introducao}>{proposta.objetivo}</Text>
      <Text style={estilos.origem}>{mensagens.proposta.origem} · {proposta.origem}</Text>

      <Text accessibilityRole="header" style={estilos.tituloFluxos}>{mensagens.proposta.fluxos}</Text>
      {proposta.fluxos.map((fluxo) => (
        <View key={fluxo.titulo} style={estilos.fluxo}>
          <Text testID={idsFluxos[fluxo.titulo]} accessibilityRole="header" style={estilos.tituloFluxo}>{fluxo.titulo}</Text>
          {fluxo.licoes.map((licao, indice) => (
            <View key={licao.titulo} style={estilos.licao}>
              <Text style={estilos.licaoOrdem}>{indice + 1}.</Text>
              <Text style={estilos.licaoTitulo}>{licao.titulo}</Text>
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { borderBottomWidth: 1, borderColor: cores.gelo },
  marcaConteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  logo: { width: 112, height: 38 },
  conteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 34, letterSpacing: -1, lineHeight: 42 },
  introducao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 17, lineHeight: 24, marginTop: 8 },
  campo: { marginTop: 28, gap: 8 },
  rotulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  entrada: { minHeight: 132, padding: 12, borderWidth: 1, borderRadius: 12, borderColor: cores.textoSecundario,
    color: cores.texto, backgroundColor: cores.fundo, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  entradaFocada: { borderWidth: 2, borderColor: cores.acao, padding: 11 },
  legenda: { marginTop: 8, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  erro: { marginTop: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: cores.erro,
    flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  erroSinal: { width: 24, height: 24, textAlign: 'center', lineHeight: 22, borderRadius: 12, borderWidth: 1,
    borderColor: cores.erro, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700' },
  erroTexto: { flex: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  skeleton: { marginTop: 20, gap: 8 },
  skeletonCurto: { width: '55%', height: 24, borderRadius: 8, backgroundColor: cores.gelo },
  skeletonLinha: { width: '100%', height: 16, borderRadius: 8, backgroundColor: cores.gelo },
  rodape: { borderTopWidth: 1, borderColor: cores.gelo, backgroundColor: cores.fundo },
  rodapeConteudo: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 16 },
  botao: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 2, borderRadius: 20, borderColor: cores.acao, backgroundColor: cores.acao },
  botaoSecundario: { backgroundColor: cores.fundo },
  botaoCompacto: { alignSelf: 'flex-start', minHeight: 44, marginTop: 12, borderRadius: 12 },
  botaoPressionado: { opacity: 0.82 },
  botaoFocado: { outlineColor: cores.acao, outlineWidth: 2, outlineOffset: 2, outlineStyle: 'solid' },
  botaoDesativado: { borderColor: cores.gelo, backgroundColor: cores.nevoa },
  botaoTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  botaoTextoSecundario: { color: cores.acao },
  botaoTextoDesativado: { color: cores.textoSecundario },
  tipoProposta: { alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    color: cores.texto, backgroundColor: cores.nevoa, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  origem: { marginTop: 12, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  tituloFluxos: { marginTop: 28, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 28 },
  fluxo: { gap: 8, marginTop: 12, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: cores.gelo },
  tituloFluxo: { marginBottom: 4, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26 },
  licao: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  licaoOrdem: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24, fontVariant: ['tabular-nums'] },
  licaoTitulo: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
});
