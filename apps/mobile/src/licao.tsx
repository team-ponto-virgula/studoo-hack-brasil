import type { Avaliacao, LicaoDetalhe } from '@studoo/contratos';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone } from './icone';
import { Botao, Campo, EstadoMensagem, Tela, Titulo, estilos } from './interface';
import { mensagens } from './mensagens';
import { cores, fontes } from './tema';

export function Licao({ licao, acoes, erro, pendente, voltar, avaliar, concluir }: {
  licao: LicaoDetalhe;
  acoes: ReactNode;
  erro: string | null;
  pendente: string | null;
  voltar: () => void;
  avaliar: (resposta: string) => Promise<Avaliacao | null>;
  concluir: (comprovante: string) => Promise<boolean>;
}) {
  const [resposta, setResposta] = useState('');
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const exercicio = licao.exercicio;
  const ocupado = pendente !== null;

  async function enviar() {
    if (ocupado || !resposta.trim()) return;
    const resultado = await avaliar(resposta);
    if (resultado) setAvaliacao(resultado);
  }

  async function continuar(comprovante: string) {
    if (!await concluir(comprovante)) setAvaliacao(null);
  }

  return (
    <Tela pagina={`licao-${licao.id}`} acoes={acoes} rodape={avaliacao
      ? <Botao testID="continuar-licao" rotulo={pendente === 'concluir' ? mensagens.licao.concluindo : mensagens.licao.continuar}
        desativado={ocupado} ocupado={pendente === 'concluir'} acao={() => void continuar(avaliacao.comprovante)} />
      : <Botao testID="enviar-resposta" rotulo={pendente === 'avaliar' ? mensagens.licao.avaliando : mensagens.licao.avaliar}
        desativado={ocupado || !resposta.trim()} ocupado={pendente === 'avaliar'} acao={() => void enviar()} />}>
      <Botao rotulo={mensagens.licao.voltar} testID="voltar-plano" variante="texto" compacto desativado={ocupado} acao={voltar} />
      <Titulo testID="titulo-licao" foco>{licao.titulo}</Titulo>
      {licao.concluida && (
        <View style={licaoEstilos.revisao}>
          <Icone nome="check" tamanho={18} cor={cores.sucesso} />
          <Text style={licaoEstilos.revisaoTexto}>{mensagens.trilha.revisitando}</Text>
        </View>
      )}
      <Text style={estilos.introducao}>{licao.objetivo}</Text>

      <View style={licaoEstilos.secao}>
        <Text accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.conceito}</Text>
        <Text style={estilos.texto}>{licao.conceito}</Text>
        <Text style={estilos.legenda}>{mensagens.proposta.origem} · {licao.origem}</Text>
      </View>
      <View style={[licaoEstilos.secao, licaoEstilos.exemplo]}>
        <Text accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.exemplo}</Text>
        <Text style={estilos.texto}>{licao.exemplo}</Text>
      </View>
      <View style={licaoEstilos.secao}>
        <Text accessibilityRole="header" style={estilos.subtitulo}>{mensagens.licao.exercicio}</Text>
        <Text style={estilos.texto}>{exercicio.enunciado}</Text>
        {exercicio.contexto && <Text style={estilos.texto}>{exercicio.contexto}</Text>}
        {exercicio.trecho && <Text selectable style={licaoEstilos.codigo}>{exercicio.trecho}</Text>}
        {avaliacao ? <EstadoMensagem mensagem={avaliacao.feedback} testID="feedback-licao" foco
          titulo={avaliacao.correta ? mensagens.licao.correta : mensagens.licao.incorreta} tipo={avaliacao.correta ? 'correto' : 'ajuste'} />
          : exercicio.tipo === 'lacuna'
            ? <Campo testID="resposta-licao" rotulo={mensagens.licao.resposta} value={resposta} onChangeText={setResposta}
              editable={!ocupado} autoCorrect={false} autoCapitalize="none" returnKeyType="send" onSubmitEditing={() => void enviar()} />
            : <View accessibilityRole="radiogroup" accessibilityLabel={mensagens.licao.resposta} style={licaoEstilos.opcoes}>
              {exercicio.opcoes.map((opcao) => <Opcao key={opcao.id} id={opcao.id} texto={opcao.texto}
                selecionada={opcao.id === resposta} desativada={ocupado} acao={() => setResposta(opcao.id)} />)}
            </View>}
      </View>
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
      <Text importantForAccessibility="no" style={licaoEstilos.radio}>{selecionada ? '◉' : '○'}</Text>
      <Text style={[estilos.texto, licaoEstilos.opcaoTexto]}>{texto}</Text>
    </Pressable>
  );
}

const licaoEstilos = StyleSheet.create({
  revisao: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  revisaoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  secao: { marginTop: 24, gap: 8 },
  exemplo: { padding: 16, borderRadius: 20, backgroundColor: cores.nevoa },
  codigo: { padding: 12, borderRadius: 12, color: cores.texto, backgroundColor: cores.nevoa,
    fontFamily: 'monospace', fontSize: 15, lineHeight: 22 },
  opcoes: { gap: 8 },
  opcao: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12,
    borderWidth: 1, borderColor: cores.gelo, padding: 12 },
  opcaoSelecionada: { borderColor: cores.acao, backgroundColor: cores.nevoa },
  opcaoTexto: { flex: 1 },
  radio: { color: cores.acao, fontSize: 22 },
});
