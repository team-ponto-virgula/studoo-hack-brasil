import { ErroStudoo, type LicaoDetalhe, type PlanoDetalhe, type PlanoResumo, type Progresso, type PropostaPlano } from '@studoo/contratos';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, Text, View } from 'react-native';
import { sessaoInvalida, type ClienteNativo } from './api-nativa';
import { Botao, Campo, EstadoMensagem, Skeleton, Tela, Titulo, estilos } from './interface';
import { mensagemDeErro, mensagens } from './mensagens';
import { cores, fontes } from './tema';

type Etapa =
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'proposta'; proposta: PropostaPlano }
  | { tipo: 'plano'; plano: PlanoDetalhe }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; licao: LicaoDetalhe };

type Acao = 'gerar' | 'aceitar' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo?: string };

export function Estudo({ cliente, sair, expirar }: {
  cliente: ClienteNativo;
  sair: () => Promise<void>;
  expirar: () => Promise<void>;
}) {
  const [planos, setPlanos] = useState<PlanoResumo[] | null>(null);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'planos' });
  const [objetivo, setObjetivo] = useState('');
  const [pendente, setPendente] = useState<Acao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const emCurso = useRef(false);
  const ocupado = pendente !== null;

  useEffect(() => {
    let ativo = true;

    async function carregarPlanos() {
      try {
        const lista = await cliente.listarPlanos();
        if (ativo) setPlanos(lista);
      } catch (falha) {
        if (!ativo) return;
        if (sessaoInvalida(falha)) await expirar();
        else setErro(mensagemDeErro(falha));
      }
    }

    void carregarPlanos();
    return () => { ativo = false; };
  }, [cliente, expirar, tentativa]);

  useEffect(() => {
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (emCurso.current) return true;
      if (etapa.tipo === 'planos') return false;
      setErro(null);
      if (etapa.tipo === 'proposta') setEtapa({ tipo: 'objetivo' });
      else if (etapa.tipo === 'licao' || etapa.tipo === 'concluida') setEtapa({ tipo: 'plano', plano: etapa.plano });
      else setEtapa({ tipo: 'planos' });
      return true;
    });
    return () => assinatura.remove();
  }, [etapa]);

  function abrir(destino: Etapa) {
    if (emCurso.current) return;
    setErro(null);
    setEtapa(destino);
  }

  async function executar<T>(acao: Acao, operacao: () => Promise<T>): Promise<Resultado<T>> {
    if (emCurso.current) return { ok: false };
    emCurso.current = true;
    Keyboard.dismiss();
    setPendente(acao);
    setErro(null);
    try {
      return { ok: true, dados: await operacao() };
    } catch (falha) {
      if (sessaoInvalida(falha)) await expirar();
      else setErro(mensagemDeErro(falha));
      return { ok: false, codigo: falha instanceof ErroStudoo ? falha.codigo : undefined };
    } finally {
      emCurso.current = false;
      setPendente(null);
    }
  }

  function atualizarObjetivo(texto: string) {
    if (emCurso.current) return;
    setErro(null);
    setObjetivo(texto);
  }

  async function gerar() {
    if (!objetivo.trim()) return;
    const resultado = await executar('gerar', () => cliente.gerarProposta(objetivo));
    if (resultado.ok) abrir({ tipo: 'proposta', proposta: resultado.dados });
  }

  function atualizarPlano(plano: PlanoDetalhe) {
    const resumo = { id: plano.id, titulo: plano.titulo, progresso: plano.progresso };
    setPlanos((anteriores) => anteriores?.some((item) => item.id === resumo.id)
      ? anteriores.map((item) => item.id === resumo.id ? resumo : item)
      : [resumo, ...(anteriores ?? [])]);
  }

  async function aceitar(proposta: PropostaPlano) {
    const resultado = await executar('aceitar', () => cliente.aceitarProposta(proposta.token));
    if (!resultado.ok) return;
    atualizarPlano(resultado.dados);
    setObjetivo('');
    abrir({ tipo: 'plano', plano: resultado.dados });
  }

  async function abrirPlano(id: string) {
    const resultado = await executar('abrir', () => cliente.obterPlano(id));
    if (!resultado.ok) return;
    atualizarPlano(resultado.dados);
    abrir({ tipo: 'plano', plano: resultado.dados });
  }

  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    const resultado = await executar('abrir', () => cliente.obterLicao(id));
    if (resultado.ok) abrir({ tipo: 'licao', plano, licao: resultado.dados });
  }

  async function concluir(licao: LicaoDetalhe, comprovante: string) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante));
    if (resultado.ok) {
      atualizarPlano(resultado.dados.plano);
      abrir({ tipo: 'concluida', plano: resultado.dados.plano, licao });
    }
    return resultado.ok || resultado.codigo !== 'avaliacao_invalida';
  }

  const acoes = (
    <>
      {etapa.tipo !== 'planos' && <Botao rotulo={mensagens.planos.titulo} testID="meus-planos" compacto variante="texto"
        desativado={ocupado} acao={() => abrir({ tipo: 'planos' })} />}
      <Botao rotulo={mensagens.sair} testID="sair" compacto variante="texto" desativado={ocupado}
        acao={() => void executar('sair', sair)} />
    </>
  );
  const mensagem = erro && <EstadoMensagem mensagem={erro} />;

  return (
    <Tela pagina="planos" acoes={acoes} rodape={planos
      ? <Botao rotulo={mensagens.planos.novo} testID="novo-plano" desativado={ocupado} acao={() => abrir({ tipo: 'objetivo' })} />
      : erro && <Botao rotulo={mensagens.tentar} testID="tentar-planos" desativado={ocupado} acao={() => {
        setErro(null);
        setTentativa((anterior) => anterior + 1);
      }} />}>
      <Titulo testID="titulo-planos" foco>{mensagens.planos.titulo}</Titulo>
      {mensagem}
      {(!planos && !erro || pendente === 'abrir') && <Skeleton />}
      {planos?.map((plano, indice) => (
        <View key={plano.id} style={estudoEstilos.bloco}>
          <Text accessibilityRole="header" style={estilos.tituloBloco}>{plano.titulo}</Text>
          <BarraProgresso progresso={plano.progresso} />
          <Botao rotulo={mensagens.planos.abrir} testID={`abrir-plano-${indice}`} variante="secundario" desativado={ocupado}
            acao={() => void abrirPlano(plano.id)} />
        </View>
      ))}
    </Tela>
  );
}

function idFluxo(titulo: string, indice: number) {
  if (titulo === 'Consultas') return 'fluxo-consultas';
  if (titulo === 'Junções') return 'fluxo-juncoes';
  return `fluxo-${indice}`;
}

function BarraProgresso({ progresso, testID }: { progresso: Progresso; testID?: string }) {
  if (progresso.percentual === null) return <Text testID={testID} style={estilos.legenda}>{mensagens.planos.semProgresso}</Text>;
  return (
    <View style={estudoEstilos.progresso}>
      <View importantForAccessibility="no" style={estudoEstilos.trilha}>
        <View style={[estudoEstilos.preenchimento, { width: `${progresso.percentual}%` }]} />
      </View>
      <Text testID={testID} style={estilos.legenda}>{mensagens.planos.progresso(progresso.concluidas, progresso.total)}</Text>
    </View>
  );
}

const estudoEstilos = StyleSheet.create({
  espaco: { marginTop: 12 },
  secao: { marginTop: 24 },
  bloco: { gap: 12, marginTop: 16, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: cores.gelo },
  progresso: { gap: 8, marginTop: 12 },
  trilha: { height: 8, borderRadius: 4, backgroundColor: cores.nevoa, overflow: 'hidden' },
  preenchimento: { height: '100%', backgroundColor: cores.acao, borderRadius: 4 },
  tipoProposta: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12,
    borderRadius: 12, backgroundColor: cores.nevoa, color: cores.texto, fontWeight: '700' },
  sinalConcluida: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: cores.sucesso,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconeConcluida: { color: cores.sucesso, fontSize: 24, fontFamily: fontes.corpo, fontWeight: '700' },
});
