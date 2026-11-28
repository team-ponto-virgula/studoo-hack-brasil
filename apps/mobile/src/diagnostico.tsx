import { LIMITE_PERGUNTAS_DIAGNOSTICO, perfilDiagnosticoValido, type PassoDiagnostico, type PerfilDiagnostico } from '@studoo/contratos';
import type { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Botao, Tela, Titulo, estilos } from './interface';
import { Stu } from './mascote';
import { EsperaViva } from './espera-viva';
import { mensagemDoCodigo, mensagens } from './mensagens';

type Pergunta = Extract<PassoDiagnostico, { tipo: 'pergunta' }>;

export function passoValido(passo: PassoDiagnostico, anterior: Pergunta | null): boolean {
  if (!passo?.id || (anterior && passo.id !== anterior.id)) return false;
  if (passo.tipo === 'resultado') return perfilDiagnosticoValido(passo.perfil);
  if (passo.tipo !== 'pergunta' || !Number.isInteger(passo.numero) || passo.numero < 1 ||
      passo.numero >= LIMITE_PERGUNTAS_DIAGNOSTICO || (anterior && passo.numero <= anterior.numero)) return false;
  return Boolean(passo.pergunta?.id && passo.pergunta.enunciado && Array.isArray(passo.pergunta.opcoes) &&
    passo.pergunta.opcoes.some(opcao => opcao.texto === 'Ainda não sei'));
}

export function Diagnostico({ objetivo, passo, ocupado, erro, acoes, consultar, repetir, gerar, pular, voltar, perguntaAnterior }: {
  objetivo: string;
  passo: PassoDiagnostico | null;
  ocupado: boolean;
  erro: string | null;
  acoes: ReactNode;
  consultar: (opcaoId?: string) => void;
  repetir: () => void;
  gerar: () => void;
  pular: () => void;
  voltar: () => void;
  perguntaAnterior?: () => void;
}) {
  const pergunta = passo?.tipo === 'pergunta' ? passo : null;
  const resultado = passo?.tipo === 'resultado' ? passo : null;
  const { width, height } = useWindowDimensions();
  const baixa = width < 768 && height <= 700;
  const rotuloRepetir = erro === 'consentimento_ia' ? mensagens.privacidade.permitirAgora : mensagens.tentarNovamente;
  return (
    <Tela pagina="diagnostico" avisoNoFluxo acoes={acoes} rodape={<View style={{ gap: 8 }}>
      {(!passo || erro) && <Botao plano rotulo={erro ? rotuloRepetir : 'Responder perguntas'}
        testID={passo ? 'diagnostico-repetir' : 'diagnostico-iniciar'} desativado={ocupado} acao={erro ? repetir : () => consultar()} />}
      {resultado && <Botao plano rotulo="Montar minha trilha" testID="diagnostico-montar" acao={gerar} />}
      <Botao plano rotulo="Pular perguntas" testID="diagnostico-pular" variante="texto" acao={pular} />
      {perguntaAnterior && <Botao plano rotulo="Pergunta anterior" testID="diagnostico-anterior" variante="texto"
        desativado={ocupado} acao={perguntaAnterior} />}
      <Botao plano rotulo="Voltar ao pedido" testID="diagnostico-voltar" variante="texto" acao={voltar} />
    </View>}>
      <View style={{ gap: 12 }}>
        {pergunta && <Text style={estilos.legenda}>Pergunta {pergunta.numero + 1} · até {LIMITE_PERGUNTAS_DIAGNOSTICO}</Text>}
        <View style={!passo && s.abertura}>
          <Titulo key={pergunta?.pergunta.id ?? passo?.tipo ?? 'preparando'} testID="diagnostico-titulo" foco
            estilo={!passo && [s.tituloAbertura, baixa && s.tituloBaixo, width >= 768 && s.tituloLargo]}>
            {pergunta?.pergunta.enunciado ?? (resultado ? 'Seu ponto de partida' : 'Por onde começamos?')}
          </Titulo>
          {!passo && <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Stu nome="stu-curioso" tamanho={baixa ? 56 : 72} animado="uma-vez" />
          </View>}
        </View>
        <View style={s.pedido}>
          <Text style={[estilos.legenda, s.rotulo]}>{mensagens.pedido.seuPedido}</Text>
          <Text style={[estilos.texto, s.objetivo]}>{objetivo}</Text>
        </View>
        {!passo && <Text style={estilos.texto}>Responda algumas perguntas rápidas para ajustar a trilha ao que você quer aprender e ao que já sabe fazer.</Text>}
        {ocupado && <EsperaViva motivo="diagnostico" compacta testID="espera-diagnostico" />}
        {erro && <Text role="alert" accessibilityLiveRegion="assertive" style={estilos.texto}>
          {erro === 'consentimento_ia' || erro === 'ia_indisponivel' ? mensagemDoCodigo(erro) : 'Não foi possível carregar a pergunta. Tente novamente.'}
        </Text>}
        {pergunta?.pergunta.opcoes.map((opcao, indice) => (
          <Botao key={opcao.id} rotulo={opcao.texto} testID={`diagnostico-opcao-${indice}`}
            variante="secundario" desativado={ocupado} acao={() => consultar(opcao.id)} />
        ))}
        {resultado && <PontoDePartida perfil={resultado.perfil} />}
      </View>
    </Tela>
  );
}

const s = StyleSheet.create({
  abertura: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tituloAbertura: { flex: 1, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  tituloBaixo: { fontSize: 24, lineHeight: 30 },
  tituloLargo: { fontSize: 36, lineHeight: 43 },
  pedido: { gap: 2 },
  rotulo: { fontWeight: '700', lineHeight: 21 },
  objetivo: { fontWeight: '800', fontSize: 17, lineHeight: 26 },
});

export function PontoDePartida({ perfil, primeiroPasso }: { perfil: PerfilDiagnostico; primeiroPasso?: string }) {
  if (!perfilDiagnosticoValido(perfil)) return null;
  const nivel = { basico: 'básico', intermediario: 'intermediário', avancado: 'avançado' }[perfil.nivel];
  return <View testID="diagnostico-proposta" style={{ gap: 8 }}>
    <Text accessibilityRole="header" style={estilos.tituloBloco}>Ponto de partida</Text>
    <Text style={estilos.texto}>{primeiroPasso ?? (perfil.demonstrados.length ? 'Vamos partir do que você já mostrou.' : 'Vamos começar pelos fundamentos.')}</Text>
    {perfil.demonstrados.length > 0 && <Text style={estilos.texto}>Você mostrou que já sabe: {perfil.demonstrados.join(', ')}.</Text>}
    {perfil.lacunas.length > 0 && <Text style={estilos.texto}>Vamos praticar: {perfil.lacunas.join(', ')}.</Text>}
    <Text accessibilityRole="header" style={estilos.tituloBloco}>Você vai aprender</Text>
    <Text style={estilos.texto}>{perfil.escopo} · nível {nivel}</Text>
  </View>;
}
