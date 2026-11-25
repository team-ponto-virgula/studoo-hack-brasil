import { LIMITE_PERGUNTAS_DIAGNOSTICO, perfilDiagnosticoValido, type PassoDiagnostico, type PerfilDiagnostico } from '@studoo/contratos';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Botao, Tela, Titulo, estilos } from './interface';

type Pergunta = Extract<PassoDiagnostico, { tipo: 'pergunta' }>;

export function passoValido(passo: PassoDiagnostico, anterior: Pergunta | null): boolean {
  if (!passo?.id || (anterior && passo.id !== anterior.id)) return false;
  if (passo.tipo === 'resultado') return perfilDiagnosticoValido(passo.perfil);
  if (passo.tipo !== 'pergunta' || !Number.isInteger(passo.numero) || passo.numero < 1 ||
      passo.numero >= LIMITE_PERGUNTAS_DIAGNOSTICO || (anterior && passo.numero <= anterior.numero)) return false;
  return Boolean(passo.pergunta?.id && passo.pergunta.enunciado && Array.isArray(passo.pergunta.opcoes) &&
    passo.pergunta.opcoes.some(opcao => opcao.texto === 'Ainda não sei'));
}

export function Diagnostico({ objetivo, passo, ocupado, erro, acoes, consultar, gerar, pular, voltar, perguntaAnterior }: {
  objetivo: string;
  passo: PassoDiagnostico | null;
  ocupado: boolean;
  erro: boolean;
  acoes: ReactNode;
  consultar: (opcaoId?: string) => void;
  gerar: () => void;
  pular: () => void;
  voltar: () => void;
  perguntaAnterior?: () => void;
}) {
  const pergunta = passo?.tipo === 'pergunta' ? passo : null;
  const resultado = passo?.tipo === 'resultado' ? passo : null;
  return (
    <Tela pagina="diagnostico" avisoNoFluxo acoes={acoes} rodape={<View style={{ gap: 8 }}>
      {!passo && <Botao plano rotulo={erro ? 'Tentar novamente' : 'Responder perguntas'} testID="diagnostico-iniciar"
        desativado={ocupado} acao={() => consultar()} />}
      {resultado && <Botao plano rotulo="Montar minha trilha" testID="diagnostico-montar" acao={gerar} />}
      <Botao plano rotulo="Pular perguntas" testID="diagnostico-pular" variante="texto" acao={pular} />
      {perguntaAnterior && <Botao plano rotulo="Pergunta anterior" testID="diagnostico-anterior" variante="texto"
        desativado={ocupado} acao={perguntaAnterior} />}
      <Botao plano rotulo="Voltar ao pedido" testID="diagnostico-voltar" variante="texto" acao={voltar} />
    </View>}>
      <View style={{ gap: 12 }}>
        {pergunta && <Text style={estilos.legenda}>Pergunta {pergunta.numero + 1} · até {LIMITE_PERGUNTAS_DIAGNOSTICO}</Text>}
        <Titulo key={pergunta?.pergunta.id ?? passo?.tipo ?? 'preparando'} testID="diagnostico-titulo" foco>
          {pergunta?.pergunta.enunciado ?? (resultado ? 'Seu ponto de partida' : 'Por onde começamos?')}
        </Titulo>
        <Text style={estilos.texto}>{objetivo}</Text>
        {!passo && <Text style={estilos.texto}>Responda algumas perguntas rápidas para ajustar a trilha ao que você quer aprender e ao que já sabe fazer.</Text>}
        {ocupado && <Text role="status" accessibilityLiveRegion="polite" style={estilos.legenda}>Preparando o próximo passo…</Text>}
        {erro && <Text role="alert" style={estilos.texto}>Não foi possível carregar a pergunta. Você pode tentar novamente ou montar a trilha direto.</Text>}
        {pergunta?.pergunta.opcoes.map((opcao, indice) => (
          <Botao key={opcao.id} rotulo={opcao.texto} testID={`diagnostico-opcao-${indice}`}
            variante="secundario" desativado={ocupado} acao={() => consultar(opcao.id)} />
        ))}
        {resultado && <PontoDePartida perfil={resultado.perfil} />}
      </View>
    </Tela>
  );
}

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
