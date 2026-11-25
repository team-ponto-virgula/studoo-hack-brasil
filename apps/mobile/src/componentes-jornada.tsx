import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icone } from './icone';
import { cores, fontes, medidas, raios } from './tema';
import type { NomeIcone } from './trilha';

/** Superfície de conteúdo: o relevo fica nas ações, não em todos os blocos da página. */
export function CartaoStudoo({ children, tom = 'padrao', estilo, testID }: {
  children: ReactNode;
  tom?: 'padrao' | 'destaque' | 'sucesso' | 'alerta';
  estilo?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return <View testID={testID} style={[estilos.cartao, estilos[tom], estilo]}>{children}</View>;
}

/** Contexto, título e descrição constituem um grupo; a ação secundária fica ao lado quando cabe. */
export function CabecalhoSecao({ titulo, contexto, descricao, acao, children, testID, tituloId }: {
  titulo: ReactNode;
  tituloId?: string;
  contexto?: string;
  descricao?: string;
  acao?: ReactNode;
  children?: ReactNode;
  testID?: string;
}) {
  return <View testID={testID} style={estilos.cabecalho}>
    <View style={estilos.cabecalhoLinha}>
      <View style={estilos.cabecalhoTexto}>
        {contexto && <Text style={estilos.contexto}>{contexto}</Text>}
        <Text nativeID={tituloId} accessibilityRole="header" style={estilos.titulo}>{titulo}</Text>
      </View>
      {acao && <View style={estilos.cabecalhoAcao}>{acao}</View>}
    </View>
    {descricao && <Text style={estilos.descricao}>{descricao}</Text>}
    {children}
  </View>;
}

export type EstadoDaTrilha = 'atual' | 'concluida' | 'bloqueada' | 'disponivel';
const estados: Record<EstadoDaTrilha, { texto: string; icone: NomeIcone; cor: string; fundo: string }> = {
  atual: { texto: 'Próximo passo', icone: 'livro', cor: cores.acaoEscura, fundo: cores.nevoa },
  concluida: { texto: 'Concluída', icone: 'check', cor: cores.sucesso, fundo: cores.sucessoFundo },
  bloqueada: { texto: 'Ainda bloqueada', icone: 'cadeado', cor: cores.textoSecundario, fundo: cores.superficieSutil },
  disponivel: { texto: 'Disponível', icone: 'livro', cor: cores.acaoEscura, fundo: cores.nevoa },
};

/** O estado sempre tem palavras e ícone; nunca depende apenas de cor ou animação. */
export function EstadoTrilha({ estado, rotulo, testID }: { estado: EstadoDaTrilha; rotulo?: string; testID?: string }) {
  const atual = estados[estado];
  return <View testID={testID} style={[estilos.estado, { backgroundColor: atual.fundo }]}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Icone nome={atual.icone} tamanho={16} cor={atual.cor} />
    </View>
    <Text style={[estilos.metadado, { color: atual.cor }]}>{rotulo ?? atual.texto}</Text>
  </View>;
}

/** Apresenta somente a contagem recebida; não inventa XP, sequência de dias ou percentuais estimados. */
export function ProgressoStudoo({ concluidas, total, rotulo = 'Lições concluídas', testID }: {
  concluidas: number;
  total: number;
  rotulo?: string;
  testID?: string;
}) {
  const maximo = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const feitas = Number.isFinite(concluidas) ? Math.min(maximo, Math.max(0, Math.floor(concluidas))) : 0;
  const fracao = maximo > 0 ? feitas / maximo : 0;
  return <View testID={testID} style={estilos.progresso}>
    <View style={estilos.progressoRotulo}>
      <Text style={[estilos.metadado, estilos.progressoNome]}>{rotulo}</Text>
      <Text style={estilos.metadado}>{feitas} de {maximo}</Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: maximo || 1, now: feitas, text: `${feitas} de ${maximo}` }}
      style={estilos.progressoTrilho}>
      <View style={[estilos.progressoCheio, { width: `${fracao * 100}%` }]} />
    </View>
  </View>;
}

const estilos = StyleSheet.create({
  cartao: { padding: 20, gap: 12, borderWidth: 1.5, borderRadius: raios.bloco, minWidth: 0 },
  padrao: { backgroundColor: cores.fundo, borderColor: cores.gelo },
  destaque: { backgroundColor: cores.nevoa, borderColor: cores.destaqueBorda },
  sucesso: { backgroundColor: cores.sucessoFundo, borderColor: '#B8DDC9' },
  alerta: { backgroundColor: cores.alertaFundo, borderColor: cores.alertaBorda },
  cabecalho: { gap: 8, minWidth: 0 },
  cabecalhoLinha: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', columnGap: 16, rowGap: 8 },
  cabecalhoTexto: { flex: 1, minWidth: 180, gap: 8 },
  cabecalhoAcao: { minHeight: medidas.alvo, justifyContent: 'center', flexShrink: 1 },
  contexto: { color: cores.acao, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 20, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.65 },
  titulo: { color: cores.texto, fontFamily: fontes.titulo, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
  descricao: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  estado: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 4, minHeight: 28, borderRadius: raios.pilula, maxWidth: '100%' },
  metadado: { flexShrink: 1, color: cores.texto, fontFamily: fontes.corpo, fontSize: 13, lineHeight: 20, fontWeight: '800' },
  progresso: { gap: 8, minWidth: 0 },
  progressoRotulo: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 16, rowGap: 4 },
  progressoNome: { flexGrow: 1 },
  progressoTrilho: { height: medidas.progresso, borderRadius: medidas.progresso / 2, backgroundColor: cores.gelo, overflow: 'hidden' },
  progressoCheio: { height: '100%', borderRadius: medidas.progresso / 2, backgroundColor: cores.acao },
});
