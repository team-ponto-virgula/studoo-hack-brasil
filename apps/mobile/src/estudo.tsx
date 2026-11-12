import { ErroStudoo, type LicaoDetalhe, type PlanoDetalhe, type PlanoResumo, type Progresso, type PropostaPlano } from '@studoo/contratos';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { BackHandler, Keyboard, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { sessaoInvalida, type ClienteNativo } from './api-nativa';
import { Caminho, SkeletonTrilha } from './caminho';
import { Icone } from './icone';
import { Botao, Campo, EstadoMensagem, Skeleton, Tela, Titulo, estilos, useMovimentoReduzido } from './interface';
import { Licao } from './licao';
import { mensagemDeErro, mensagens } from './mensagens';
import { cores, fontes } from './tema';
import { falaDoStu, liberadasEntre, montarTrilha, proximaDoCaminho } from './trilha';

type Etapa =
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'proposta'; proposta: PropostaPlano }
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[] }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; licao: LicaoDetalhe; liberadas: string[] };

type EtapaPlano = Extract<Etapa, { tipo: 'plano' }>;
type Acao = 'gerar' | 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo?: string };

/** Volta da lição ou da conclusão para a trilha, que rola até o nó liberado, o próximo ou a lição de origem, como na web. */
function voltarATrilha(etapa: Extract<Etapa, { tipo: 'licao' | 'concluida' }>): EtapaPlano {
  if (etapa.tipo === 'concluida') return { tipo: 'plano', plano: etapa.plano, origem: etapa.licao.id, liberadas: etapa.liberadas };
  return { tipo: 'plano', plano: etapa.plano, origem: etapa.licao.id };
}

export function Estudo({ cliente, sair, expirar }: {
  cliente: ClienteNativo;
  sair: () => Promise<void>;
  expirar: () => Promise<void>;
}) {
  const [planos, setPlanos] = useState<PlanoResumo[] | null>(null);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'planos' });
  const [objetivo, setObjetivo] = useState('');
  const [pendente, setPendente] = useState<Acao | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
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
      else if (etapa.tipo === 'licao' || etapa.tipo === 'concluida') setEtapa(voltarATrilha(etapa));
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
    const resultado = await executar('plano', () => cliente.obterPlano(id));
    if (!resultado.ok) return;
    atualizarPlano(resultado.dados);
    abrir({ tipo: 'plano', plano: resultado.dados });
  }

  /** Abre a lição guardando qual nó está abrindo, para o caminho e o próximo passo mostrarem "Abrindo…". */
  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    if (emCurso.current) return;
    setAbrindo(id);
    const resultado = await executar('abrir', () => cliente.obterLicao(id));
    setAbrindo(null);
    if (resultado.ok) abrir({ tipo: 'licao', plano, licao: resultado.dados });
  }

  async function concluir(plano: PlanoDetalhe, licao: LicaoDetalhe, comprovante: string) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante));
    if (resultado.ok) {
      const atualizado = resultado.dados.plano;
      atualizarPlano(atualizado);
      abrir({ tipo: 'concluida', plano: atualizado, licao, liberadas: liberadasEntre(plano, atualizado) });
      return true;
    }
    return resultado.codigo !== 'avaliacao_invalida';
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

  // Carregando, como na web: a trilha mostra o esqueleto do caminho; a lição aberta fora da trilha, o esqueleto simples.
  if (pendente === 'plano') return <Tela pagina="carregando-trilha" acoes={acoes}><SkeletonTrilha /></Tela>;
  if (pendente === 'abrir' && etapa.tipo !== 'plano') return <Tela pagina="carregando-licao" acoes={acoes}><Skeleton /></Tela>;

  if (etapa.tipo === 'licao') {
    return <Licao key={etapa.licao.id} licao={etapa.licao} acoes={acoes} erro={erro} pendente={pendente}
      voltar={() => abrir(voltarATrilha(etapa))}
      avaliar={async (resposta) => {
        const resultado = await executar('avaliar', () => cliente.avaliarLicao(etapa.licao.id, resposta));
        return resultado.ok ? resultado.dados : null;
      }}
      concluir={(comprovante) => concluir(etapa.plano, etapa.licao, comprovante)} />;
  }

  if (etapa.tipo === 'concluida') {
    const { plano, licao, liberadas } = etapa;
    const proxima = proximaDoCaminho(plano);
    const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);
    return (
      <Tela pagina="concluida" acoes={acoes} rodape={<>
        {proxima && <Botao rotulo={mensagens.licao.avancar} testID="proxima-licao" variante="secundario" desativado={ocupado}
          acao={() => void abrirLicao(plano, proxima)} />}
        <Botao rotulo={mensagens.licao.voltar} testID="voltar-plano" desativado={ocupado} acao={() => abrir(voltarATrilha(etapa))} />
      </>}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={estudoEstilos.sinalConcluida}>
          <Icone nome="check" tamanho={24} cor={cores.sucesso} />
        </View>
        <Titulo testID="titulo-conclusao" foco>{mensagens.licao.concluida}</Titulo>
        <Text style={estilos.introducao}>{licao.titulo}</Text>
        {liberada && (
          <View style={estudoEstilos.liberada}>
            <Icone nome="livro" tamanho={20} cor={cores.acao} />
            <Text style={estudoEstilos.liberadaTexto}>{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</Text>
          </View>
        )}
        <View style={[estudoEstilos.bloco, estudoEstilos.blocoConclusao]}>
          <Text accessibilityRole="header" style={estilos.tituloBloco}>{mensagens.licao.progresso}</Text>
          <BarraProgresso progresso={plano.progresso} testID="progresso-plano" />
        </View>
        {mensagem}
      </Tela>
    );
  }

  if (etapa.tipo === 'plano') {
    return <TelaPlano etapa={etapa} acoes={acoes} erro={erro} ocupado={ocupado} abrindo={abrindo}
      abrirLicao={(id) => void abrirLicao(etapa.plano, id)} novoPlano={() => abrir({ tipo: 'objetivo' })} />;
  }

  if (etapa.tipo === 'proposta') {
    const { proposta } = etapa;
    return (
      <Tela pagina="proposta" acoes={acoes} rodape={<>
        <Botao rotulo={pendente === 'aceitar' ? mensagens.proposta.aceitando : mensagens.proposta.aceitar} testID="aceitar-plano"
          desativado={ocupado} ocupado={pendente === 'aceitar'} acao={() => void aceitar(proposta)} />
        <Botao rotulo={mensagens.proposta.editar} testID="editar-objetivo" variante="texto" desativado={ocupado} acao={() => abrir({ tipo: 'objetivo' })} />
      </>}>
        <Text style={[estilos.legenda, estudoEstilos.tipoProposta]}>{mensagens.proposta.tipo}</Text>
        <Titulo testID="titulo-proposta" foco>{proposta.titulo}</Titulo>
        <Text style={estilos.introducao}>{proposta.objetivo}</Text>
        <Text style={[estilos.legenda, estudoEstilos.espaco]}>{mensagens.proposta.origem} · {proposta.origem}</Text>
        {mensagem}
        <Text accessibilityRole="header" style={[estilos.subtitulo, estudoEstilos.secao]}>{mensagens.proposta.fluxos}</Text>
        {proposta.fluxos.map((fluxo, indice) => (
          <View key={fluxo.titulo} style={estudoEstilos.bloco}>
            <Text testID={idFluxo(fluxo.titulo, indice)} accessibilityRole="header" style={estilos.tituloBloco}>{fluxo.titulo}</Text>
            {fluxo.licoes.map((licao, ordem) => <Text key={licao.titulo} style={estilos.textoSecundario}>{ordem + 1}. {licao.titulo}</Text>)}
          </View>
        ))}
      </Tela>
    );
  }

  if (etapa.tipo === 'objetivo' || (etapa.tipo === 'planos' && planos?.length === 0)) {
    return (
      <Tela pagina="objetivo" acoes={acoes} rodape={<Botao rotulo={pendente === 'gerar' ? mensagens.objetivo.gerando : mensagens.objetivo.gerar}
        testID="gerar-proposta" desativado={ocupado || !objetivo.trim()} ocupado={pendente === 'gerar'} acao={() => void gerar()} />}>
        <Titulo testID="titulo-objetivo" foco>{mensagens.objetivo.titulo}</Titulo>
        <Text style={estilos.introducao}>{mensagens.objetivo.instrucao}</Text>
        <View style={estudoEstilos.secao}>
          <Campo testID="objetivo-estudo" rotulo={mensagens.objetivo.campo} placeholder={mensagens.objetivo.placeholder}
            value={objetivo} onChangeText={atualizarObjetivo} editable={!ocupado} multiline maxLength={1000} />
        </View>
        <View style={estudoEstilos.espaco}>
          <Botao rotulo={mensagens.objetivo.usarExemplo} testID="usar-exemplo-sql" variante="secundario" compacto
            desativado={ocupado} acao={() => atualizarObjetivo(mensagens.objetivo.exemplo)} />
        </View>
        <Text style={[estilos.legenda, estudoEstilos.espaco]}>{mensagens.objetivo.aviso}</Text>
        {mensagem}
        {pendente === 'gerar' && <Skeleton texto={mensagens.objetivo.gerando} />}
      </Tela>
    );
  }

  return (
    <Tela pagina="planos" acoes={acoes} rodape={planos
      ? <Botao rotulo={mensagens.planos.novo} testID="novo-plano" desativado={ocupado} acao={() => abrir({ tipo: 'objetivo' })} />
      : erro && <Botao rotulo={mensagens.tentar} testID="tentar-planos" desativado={ocupado} acao={() => {
        setErro(null);
        setTentativa((anterior) => anterior + 1);
      }} />}>
      <Titulo testID="titulo-planos" foco>{mensagens.planos.titulo}</Titulo>
      {mensagem}
      {!planos && !erro && <Skeleton />}
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

/**
 * Tela do plano: faixa com título, objetivo, progresso e próximo passo; abaixo, o caminho da trilha.
 * Como na web, no celular o próximo passo vira o rodapé fixo e, a partir de 768 px, fica dentro da faixa.
 * Voltando de uma lição, a trilha rola até o nó liberado, o próximo ou a lição de origem, se ele estiver fora da vista.
 */
function TelaPlano({ etapa, acoes, erro, ocupado, abrindo, abrirLicao, novoPlano }: {
  etapa: EtapaPlano;
  acoes: ReactNode;
  erro: string | null;
  ocupado: boolean;
  abrindo: string | null;
  abrirLicao: (id: string) => void;
  novoPlano: () => void;
}) {
  const { plano, origem, liberadas = [] } = etapa;
  const { nos, proximo } = useMemo(() => montarTrilha(plano), [plano]);
  const rolarPara = origem ? liberadas[0] ?? proximo?.no.id ?? origem : null;
  const { width, height } = useWindowDimensions();
  const largo = width >= 768;
  const reduzir = useMovimentoReduzido();
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const visivel = useRef(0);

  // O erro aparece no topo, como na web; a tela sobe até ele.
  useEffect(() => {
    if (erro) rolagem.current?.scrollTo({ y: 0, animated: reduzir === false });
  }, [erro, reduzir]);

  /** Centraliza o nó só quando ele está fora da vista, como o scrollIntoView da web. Com movimento reduzido, salta direto. */
  function rolar(topo: number, base: number) {
    requestAnimationFrame(() => {
      const altura = visivel.current || height;
      if (base <= altura) return;
      rolagem.current?.scrollTo({ y: Math.max(0, (topo + base - altura) / 2), animated: reduzir === false });
    });
  }

  const novo = <Botao rotulo={mensagens.planos.novo} testID="novo-plano" desativado={ocupado} acao={novoPlano} />;
  const passo = proximo && (
    <ProximoPasso titulo={proximo.no.titulo} detalhe={proximo.posicao} abrindo={abrindo === proximo.no.id}
      ocupado={ocupado} rodape={!largo} aoAbrir={() => abrirLicao(proximo.no.id)} />
  );

  return (
    <Tela pagina={`plano-${plano.id}`} acoes={acoes} rodape={largo ? null : passo || novo} rolagem={rolagem}
      aoMedir={(altura) => { visivel.current = altura; }}>
      {erro && <EstadoMensagem mensagem={erro} foco />}
      <View style={[estudoEstilos.faixa, largo && estudoEstilos.faixaLarga]}>
        <Titulo testID="titulo-plano" foco estilo={estudoEstilos.tituloFaixa}>{plano.titulo}</Titulo>
        {/* Na faixa ficam três linhas do objetivo; o leitor de tela lê o texto inteiro. */}
        <Text numberOfLines={3} accessibilityLabel={plano.objetivo} style={[estilos.introducao, estudoEstilos.objetivoFaixa]}>
          {plano.objetivo}
        </Text>
        <BarraProgresso progresso={plano.progresso} testID="progresso-plano" naFaixa />
        {largo && passo}
        {nos.length > 0 && !proximo && (
          <View style={[estudoEstilos.divisao, estudoEstilos.concluido]}>
            <View style={estudoEstilos.concluidoTitulo}>
              <Icone nome="check" tamanho={20} cor={cores.sucesso} />
              <Text style={estudoEstilos.concluidoTexto}>{mensagens.trilha.concluido}</Text>
            </View>
            <Text style={estilos.textoSecundario}>{mensagens.trilha.concluidoTexto}</Text>
            {largo && <View style={estudoEstilos.acaoNaTela}>{novo}</View>}
          </View>
        )}
      </View>
      {nos.length > 0 ? (
        <Caminho nos={nos} stu={falaDoStu(nos)} ocupado={ocupado} abrindo={abrindo} liberadas={liberadas}
          rolarPara={rolarPara} aoRolar={rolar} aoAbrir={(no) => abrirLicao(no.id)} />
      ) : (
        <View style={estudoEstilos.vazio}>
          <Text style={estilos.textoSecundario}>{mensagens.trilha.semLicoes}</Text>
          {largo && <View style={estudoEstilos.acaoNaTela}>{novo}</View>}
        </View>
      )}
    </Tela>
  );
}

/**
 * Próxima lição do plano. No rodapé do celular, ao alcance do polegar, mostra só o rótulo e o título numa linha;
 * o leitor de tela lê o título inteiro e ouve o título também como dica do botão, como o aria-describedby da web.
 */
function ProximoPasso({ titulo, detalhe, abrindo, ocupado, rodape, aoAbrir }: {
  titulo: string;
  detalhe: string;
  abrindo: boolean;
  ocupado: boolean;
  rodape: boolean;
  aoAbrir: () => void;
}) {
  const botao = <Botao rotulo={abrindo ? mensagens.trilha.abrindo : mensagens.trilha.comecarLicao} testID="comecar-licao"
    dica={titulo} desativado={ocupado} ocupado={abrindo} acao={aoAbrir} />;

  if (rodape) {
    return (
      <View style={estudoEstilos.proximoRodape}>
        <View style={estudoEstilos.proximoTextos}>
          <Text style={[estudoEstilos.proximoRotulo, estudoEstilos.proximoRotuloRodape]}>{mensagens.trilha.proxima}</Text>
          <Text numberOfLines={1} accessibilityLabel={titulo} style={[estudoEstilos.proximoTitulo, estudoEstilos.proximoTituloRodape]}>
            {titulo}
          </Text>
        </View>
        {botao}
      </View>
    );
  }

  return (
    <View style={[estudoEstilos.divisao, estudoEstilos.proximo]}>
      <Text style={estudoEstilos.proximoRotulo}>{mensagens.trilha.proxima}</Text>
      <Text style={estudoEstilos.proximoTitulo}>{titulo}</Text>
      <Text style={estudoEstilos.proximoRotulo}>{detalhe}</Text>
      <View style={estudoEstilos.proximoAcao}>{botao}</View>
    </View>
  );
}

function idFluxo(titulo: string, indice: number) {
  if (titulo === 'Consultas') return 'fluxo-consultas';
  if (titulo === 'Junções') return 'fluxo-juncoes';
  return `fluxo-${indice}`;
}

/** Barra de progresso; na faixa da trilha, o fundo da barra é branco para contrastar com a névoa, como na web. */
function BarraProgresso({ progresso, testID, naFaixa = false }: { progresso: Progresso; testID?: string; naFaixa?: boolean }) {
  if (progresso.percentual === null) {
    return <Text testID={testID} style={[estilos.legenda, naFaixa && estudoEstilos.progressoNaFaixa]}>{mensagens.planos.semProgresso}</Text>;
  }
  return (
    <View style={[estudoEstilos.progresso, naFaixa && estudoEstilos.progressoNaFaixa]}>
      <View importantForAccessibility="no" style={[estudoEstilos.trilha, naFaixa && estudoEstilos.trilhaNaFaixa]}>
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
  blocoConclusao: { marginTop: 24, padding: 20 },
  progresso: { gap: 8, marginTop: 12 },
  progressoNaFaixa: { marginTop: 20 },
  trilha: { height: 8, borderRadius: 4, backgroundColor: cores.nevoa, overflow: 'hidden' },
  trilhaNaFaixa: { backgroundColor: cores.fundo },
  preenchimento: { height: '100%', backgroundColor: cores.acao, borderRadius: 4 },
  tipoProposta: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12,
    borderRadius: 12, backgroundColor: cores.nevoa, color: cores.texto, fontWeight: '700' },
  faixa: { marginBottom: 8, padding: 20, borderRadius: 20, backgroundColor: cores.nevoa },
  faixaLarga: { padding: 24 },
  tituloFaixa: { fontSize: 28, lineHeight: 32 },
  objetivoFaixa: { fontSize: 16 },
  divisao: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderColor: cores.gelo },
  proximo: { gap: 2 },
  proximoRotulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  proximoTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 17, lineHeight: 24 },
  proximoAcao: { alignItems: 'flex-start', marginTop: 12 },
  proximoRodape: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proximoTextos: { flex: 1, minWidth: 0 },
  proximoRotuloRodape: { fontSize: 13, lineHeight: 18 },
  proximoTituloRodape: { fontSize: 16, lineHeight: 22 },
  concluido: { gap: 8 },
  concluidoTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  concluidoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  acaoNaTela: { alignItems: 'flex-start', marginTop: 8 },
  vazio: { gap: 16, marginTop: 24 },
  sinalConcluida: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: cores.sucesso,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  liberada: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  liberadaTexto: { flex: 1, color: cores.acao, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
});
