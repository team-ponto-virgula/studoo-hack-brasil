import type { Avaliacao, LicaoDetalhe } from '@studoo/contratos';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone } from './icone';
import { Botao, BotaoIcone, Campo, EstadoMensagem, Tela, Titulo, estilos } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';

type Etapa = 'conceito' | 'exemplo' | 'exercicio';
const posicoes = { conceito: 1, exemplo: 2, exercicio: 3, feedback: 4 } as const;

/**
 * Aula por etapas, como na web (spec 02): conceito, exemplo, exercício e feedback, uma de cada vez. A barra do topo mostra
 * a posição e o botão de fechar volta à trilha; o rodapé avança, envia a resposta e, depois do feedback, registra a
 * conclusão. O título de cada etapa recebe o foco do leitor de tela. Se a confirmação expirar, a aula volta ao exercício.
 */
export function Licao({ licao, erro, pendente, voltar, avaliar, concluir }: {
  licao: LicaoDetalhe;
  erro: string | null;
  pendente: string | null;
  voltar: () => void;
  avaliar: (resposta: string) => Promise<Avaliacao | null>;
  concluir: (comprovante: string) => Promise<boolean>;
}) {
  const [etapa, setEtapa] = useState<Etapa>('conceito');
  const [resposta, setResposta] = useState('');
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const tituloEtapa = useRef<ComponentRef<typeof Text>>(null);
  const exercicio = licao.exercicio;
  const ocupado = pendente !== null;
  const etapaAtual = avaliacao ? 'feedback' : etapa;
  const posicao = posicoes[etapaAtual];
  const andamento = mensagens.licao.posicao(posicao, posicoes.feedback);

  useEffect(() => {
    if (etapaAtual === 'conceito' || etapaAtual === 'feedback') return;
    const espera = setTimeout(() => {
      if (tituloEtapa.current) AccessibilityInfo.sendAccessibilityEvent(tituloEtapa.current, 'focus');
    }, 100);
    return () => clearTimeout(espera);
  }, [etapaAtual]);

  async function enviar() {
    if (ocupado || !resposta.trim()) return;
    const resultado = await avaliar(resposta);
    if (resultado) setAvaliacao(resultado);
  }

  async function continuar(comprovante: string) {
    if (!await concluir(comprovante)) setAvaliacao(null);
  }

  let acao;
  if (avaliacao) {
    acao = <Botao testID="continuar-licao" rotulo={pendente === 'concluir' ? mensagens.licao.concluindo : mensagens.licao.continuar}
      variante={avaliacao.correta ? 'sucesso' : 'primario'} desativado={ocupado} ocupado={pendente === 'concluir'}
      acao={() => void continuar(avaliacao.comprovante)} />;
  } else if (etapa === 'exercicio') {
    acao = <Botao testID="enviar-resposta" rotulo={pendente === 'avaliar' ? mensagens.licao.avaliando : mensagens.licao.avaliar}
      desativado={ocupado || !resposta.trim()} ocupado={pendente === 'avaliar'} acao={() => void enviar()} />;
  } else {
    acao = <Botao testID="avancar-licao" rotulo={mensagens.licao.seguir} icone="seta" desativado={ocupado}
      acao={() => setEtapa(etapa === 'conceito' ? 'exemplo' : 'exercicio')} />;
  }

  const topo = (
    <View style={licaoEstilos.topo}>
      <BotaoIcone icone="fechar" rotulo={mensagens.licao.voltar} testID="voltar-plano" desativado={ocupado} acao={voltar} />
      <View style={licaoEstilos.andamento} accessible accessibilityRole="progressbar" accessibilityLabel={andamento}
        accessibilityValue={{ min: 0, max: posicoes.feedback, now: posicao }}>
        <View style={licaoEstilos.trilha}>
          <View style={[licaoEstilos.preenchimento, avaliacao?.correta && licaoEstilos.preenchimentoCerto,
            { width: `${(posicao / posicoes.feedback) * 100}%` }]} />
        </View>
        <Text style={licaoEstilos.posicao}>{andamento}</Text>
      </View>
    </View>
  );

  return (
    <Tela pagina={`licao-${licao.id}-${etapaAtual}`} topo={topo} rodape={acao}>
      <Titulo testID="titulo-licao" foco={etapaAtual === 'conceito'}>{licao.titulo}</Titulo>
      {etapaAtual === 'conceito' && (
        <>
          {licao.concluida && (
            <View style={licaoEstilos.revisao}>
              <Icone nome="check" tamanho={18} cor={cores.sucesso} />
              <Text style={licaoEstilos.revisaoTexto}>{mensagens.trilha.revisitando}</Text>
            </View>
          )}
          <Text style={estilos.introducao}>{licao.objetivo}</Text>
          <View style={[licaoEstilos.quadro, licaoEstilos.quadroSuave]}>
            <Text accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.conceito}</Text>
            <Text style={estilos.texto}>{licao.conceito}</Text>
            <Text style={estilos.legenda}>{mensagens.licao.origem} · {licao.origem}</Text>
          </View>
        </>
      )}
      {etapaAtual === 'exemplo' && (
        <View style={[licaoEstilos.quadro, licaoEstilos.quadroSuave]}>
          <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.exemplo}</Text>
          <Text style={estilos.texto}>{licao.exemplo}</Text>
        </View>
      )}
      {etapaAtual === 'exercicio' && (
        <View style={licaoEstilos.quadro}>
          <Text ref={tituloEtapa} accessible accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.exercicio}</Text>
          <Text style={estilos.texto}>{exercicio.enunciado}</Text>
          {exercicio.contexto && <Text style={estilos.texto}>{exercicio.contexto}</Text>}
          {exercicio.trecho && <Text selectable style={licaoEstilos.codigo}>{exercicio.trecho}</Text>}
          {exercicio.tipo === 'lacuna'
            ? <Campo testID="resposta-licao" rotulo={mensagens.licao.resposta} value={resposta} onChangeText={setResposta}
              editable={!ocupado} autoCorrect={false} autoCapitalize="none" returnKeyType="send" onSubmitEditing={() => void enviar()} />
            : <View accessibilityRole="radiogroup" accessibilityLabel={mensagens.licao.resposta} style={licaoEstilos.opcoes}>
              <Text style={estilos.rotulo}>{mensagens.licao.resposta}</Text>
              {exercicio.opcoes.map((opcao) => <Opcao key={opcao.id} id={opcao.id} texto={opcao.texto}
                selecionada={opcao.id === resposta} desativada={ocupado} acao={() => setResposta(opcao.id)} />)}
            </View>}
        </View>
      )}
      {avaliacao && (
        <EstadoMensagem mensagem={avaliacao.feedback} testID="feedback-licao" foco
          titulo={avaliacao.correta ? mensagens.licao.correta : mensagens.licao.incorreta} tipo={avaliacao.correta ? 'correto' : 'ajuste'} />
      )}
      {erro && <EstadoMensagem mensagem={erro} />}
    </Tela>
  );
}

function Opcao({ id, texto, selecionada, desativada, acao }: {
  id: string;
  texto: string;
  selecionada: boolean;
  desativada: boolean;
  acao: () => void;
}) {
  const [focada, setFocada] = useState(false);
  return (
    <Pressable testID={`opcao-${id}`} accessibilityRole="radio" accessibilityState={{ checked: selecionada, disabled: desativada }}
      accessibilityLabel={texto} disabled={desativada} onPress={acao} onFocus={() => setFocada(true)} onBlur={() => setFocada(false)}
      style={[licaoEstilos.opcao, selecionada && licaoEstilos.opcaoSelecionada, focada && estilos.foco]}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        style={[licaoEstilos.radio, selecionada && licaoEstilos.radioSelecionado]}>
        {selecionada && <View style={licaoEstilos.radioPonto} />}
      </View>
      <Text style={[estilos.texto, licaoEstilos.opcaoTexto]}>{texto}</Text>
    </Pressable>
  );
}

const licaoEstilos = StyleSheet.create({
  topo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  andamento: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trilha: { flex: 1, height: 14, borderRadius: 7, backgroundColor: cores.gelo, overflow: 'hidden' },
  preenchimento: { height: '100%', borderRadius: 7, backgroundColor: cores.acao },
  preenchimentoCerto: { backgroundColor: cores.sucessoClaro },
  posicao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  revisao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  revisaoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  quadro: { marginTop: 24, gap: 12, padding: 18, borderRadius: 24, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  quadroSuave: { borderColor: 'transparent', backgroundColor: cores.nevoa },
  codigo: { padding: 14, borderRadius: 14, color: cores.fundo, backgroundColor: cores.texto,
    fontFamily: 'monospace', fontSize: 15, lineHeight: 22 },
  opcoes: { gap: 10 },
  opcao: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14,
    borderWidth: 2, borderBottomWidth: 4, borderColor: cores.gelo, paddingHorizontal: 14, paddingVertical: 10 },
  opcaoSelecionada: { borderColor: cores.acao, borderBottomColor: '#B9C7F5', backgroundColor: '#F3F6FF' },
  opcaoTexto: { flex: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: cores.bordaCampo, alignItems: 'center', justifyContent: 'center' },
  radioSelecionado: { borderColor: cores.acao },
  radioPonto: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.acao },
});
