import { ErroStudoo, LIMITES_GERACAO, type LicaoDetalhe, type PlanoDetalhe, type PlanoResumo, type Progresso, type PropostaPlano } from '@studoo/contratos';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Image,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { codigoDaFalha, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { Caminho, SkeletonTrilha, type Faixa } from './caminho';
import { aplicarEvento, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { Icone } from './icone';
import { Botao, Campo, EstadoMensagem, Skeleton, Tela, Titulo, estilos, useMovimentoReduzido } from './interface';
import { Licao } from './licao';
import { mensagemDeErro, mensagemDoCodigo, mensagens } from './mensagens';
import { cores, fontes } from './tema';
import { falaDoStu, liberadasEntre, montarTrilha, proximaDoCaminho, repeteTitulo } from './trilha';

/*
 * Estudo no app, com os mesmos passos da web (src/app/estudo.tsx): a pessoa escreve o que quer aprender, a trilha é montada
 * ao vivo, nó a nó, e Começar salva a trilha mostrada e abre a primeira lição (spec 03).
 */

type Etapa =
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'geracao' }
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[] }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; licao: LicaoDetalhe; liberadas: string[] };

type EtapaPlano = Extract<Etapa, { tipo: 'plano' }>;
type Acao = 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string };

/** Volta da lição ou da conclusão para a trilha, que rola até o nó liberado, o próximo ou a lição de origem, como na web. */
function voltarATrilha(etapa: Extract<Etapa, { tipo: 'licao' | 'concluida' }>): EtapaPlano {
  if (etapa.tipo === 'concluida') return { tipo: 'plano', plano: etapa.plano, origem: etapa.licao.id, liberadas: etapa.liberadas };
  return { tipo: 'plano', plano: etapa.plano, origem: etapa.licao.id };
}

/** Texto para o leitor de tela, como a região de status da web; espera a tela nova pegar o foco para não ser cortado por ele. */
function anunciar(texto: string) {
  setTimeout(() => AccessibilityInfo.announceForAccessibility(texto), 0);
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
  const [geracao, setGeracao] = useState<TrilhaEmGeracao | null>(null);
  /** Código do erro da geração; o pedido mostra a mensagem e a ação que cabe (tentar de novo, ver os planos). */
  const [falhaGeracao, setFalhaGeracao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const emCurso = useRef(false);
  const geracaoAtiva = useRef<AbortController | null>(null);
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

  // Sair do estudo no meio da geração interrompe o pedido; o servidor não guarda nada.
  useEffect(() => () => geracaoAtiva.current?.abort(), []);

  useEffect(() => {
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (emCurso.current) return true;
      if (etapa.tipo === 'planos') return false;
      if (etapa.tipo === 'geracao') {
        if (geracao?.proposta) navegar({ tipo: 'objetivo' });
        else cancelarGeracao();
      } else if (etapa.tipo === 'licao' || etapa.tipo === 'concluida') navegar(voltarATrilha(etapa));
      else navegar({ tipo: 'planos' });
      return true;
    });
    return () => assinatura.remove();
  }, [etapa, geracao]);

  function pararGeracao() {
    geracaoAtiva.current?.abort();
    geracaoAtiva.current = null;
    setGeracao(null);
  }

  /** Troca de etapa. Sair da geração ao vivo cancela o pedido em andamento; cada tela nova começa do topo. */
  function navegar(destino: Etapa) {
    if (destino.tipo !== 'geracao') pararGeracao();
    setErro(null);
    setFalhaGeracao(null);
    setAviso(null);
    setEtapa(destino);
  }

  /** Troca de etapa por um toque: espera a ação em andamento terminar. */
  function abrir(destino: Etapa) {
    if (emCurso.current) return;
    navegar(destino);
  }

  async function executar<T>(acao: Acao, operacao: () => Promise<T>): Promise<Resultado<T>> {
    if (emCurso.current) return { ok: false, codigo: 'falha' };
    emCurso.current = true;
    Keyboard.dismiss();
    setPendente(acao);
    setErro(null);
    try {
      return { ok: true, dados: await operacao() };
    } catch (falha) {
      if (sessaoInvalida(falha)) await expirar();
      else setErro(mensagemDeErro(falha));
      return { ok: false, codigo: codigoDaFalha(falha) };
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

  function atualizarPlano(plano: PlanoDetalhe) {
    const resumo = { id: plano.id, titulo: plano.titulo, progresso: plano.progresso };
    setPlanos((anteriores) => anteriores?.some((item) => item.id === resumo.id)
      ? anteriores.map((item) => item.id === resumo.id ? resumo : item)
      : [resumo, ...(anteriores ?? [])]);
  }

  /**
   * Geração ao vivo: a tela troca para a trilha vazia e cada evento do fluxo entra no caminho assim que chega.
   * Um erro, antes ou durante a geração, volta ao pedido com o texto mantido e a mensagem do código.
   */
  async function gerar(texto: string) {
    if (emCurso.current) return;
    geracaoAtiva.current?.abort();
    const controle = new AbortController();
    geracaoAtiva.current = controle;
    let trilha: TrilhaEmGeracao = { objetivo: texto, titulo: null, fluxos: [], proposta: null };
    Keyboard.dismiss();
    navegar({ tipo: 'geracao' });
    setGeracao(trilha);

    try {
      for await (const evento of cliente.gerarTrilhaAoVivo(texto, controle.signal)) {
        if (controle.signal.aborted) return;
        if (evento.tipo === 'erro') throw new ErroStudoo(evento.codigo);
        trilha = aplicarEvento(trilha, evento);
        setGeracao(trilha);
        if (evento.tipo === 'plano') anunciar(mensagens.geracao.anuncioTitulo(evento.titulo));
        if (evento.tipo === 'pronto') {
          anunciar(mensagens.geracao.anuncioPronta(nosDaPrevia(trilha).length));
          return;
        }
      }
      throw new ErroStudoo('falha');
    } catch (falha) {
      if (controle.signal.aborted) return;
      if (sessaoInvalida(falha)) {
        await expirar();
        return;
      }
      navegar({ tipo: 'objetivo' });
      setFalhaGeracao(codigoDaFalha(falha));
    } finally {
      if (geracaoAtiva.current === controle) geracaoAtiva.current = null;
    }
  }

  function cancelarGeracao() {
    navegar({ tipo: 'objetivo' });
    setAviso(mensagens.pedido.cancelada);
    anunciar(mensagens.pedido.cancelada);
  }

  /** Começar: salva a trilha mostrada (o aceite gera o conteúdo das lições) e abre a primeira lição. */
  async function comecar(proposta: PropostaPlano) {
    const aceite = await executar('aceitar', () => cliente.aceitarProposta(proposta.token));
    // Sem o aceite, a trilha gerada volta (nova tela, mesmo estado), com o erro no topo e em foco.
    if (!aceite.ok) return;
    const plano = aceite.dados;
    atualizarPlano(plano);
    setObjetivo('');
    const primeira = proximaDoCaminho(plano);
    if (!primeira) {
      navegar({ tipo: 'plano', plano });
      return;
    }
    const licao = await executar('abrir', () => cliente.obterLicao(primeira));
    if (licao.ok) {
      navegar({ tipo: 'licao', plano, licao: licao.dados });
      return;
    }
    if (licao.codigo === 'nao_autenticado') return;
    navegar({ tipo: 'plano', plano });
    setErro(mensagemDoCodigo(licao.codigo));
  }

  async function abrirPlano(id: string) {
    const resultado = await executar('plano', () => cliente.obterPlano(id));
    if (!resultado.ok) return;
    atualizarPlano(resultado.dados);
    navegar({ tipo: 'plano', plano: resultado.dados });
  }

  /** Abre a lição guardando qual nó está abrindo, para o caminho e o próximo passo mostrarem "Abrindo…". */
  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    if (emCurso.current) return;
    setAbrindo(id);
    const resultado = await executar('abrir', () => cliente.obterLicao(id));
    setAbrindo(null);
    if (resultado.ok) navegar({ tipo: 'licao', plano, licao: resultado.dados });
  }

  async function concluir(plano: PlanoDetalhe, licao: LicaoDetalhe, comprovante: string) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante));
    if (resultado.ok) {
      const atualizado = resultado.dados.plano;
      atualizarPlano(atualizado);
      navegar({ tipo: 'concluida', plano: atualizado, licao, liberadas: liberadasEntre(plano, atualizado) });
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

  // Carregando, como na web: a trilha mostra o esqueleto do caminho e a lição, a forma da aula. Começar, na trilha gerada,
  // já mostra a forma da lição: salvar o plano e abrir a primeira lição é uma espera só, no mesmo esqueleto.
  if (pendente === 'plano') return <Tela pagina="carregando-trilha" acoes={acoes}><SkeletonTrilha /></Tela>;
  if ((pendente === 'abrir' && etapa.tipo !== 'plano') || (pendente === 'aceitar' && etapa.tipo === 'geracao')) {
    return <SkeletonLicao texto={pendente === 'aceitar' ? mensagens.geracao.comecando : mensagens.licao.carregando} acoes={acoes} />;
  }

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

  if (etapa.tipo === 'geracao' && geracao) {
    return <GeracaoAoVivo geracao={geracao} erro={erro} ocupado={ocupado} acoes={acoes} cancelar={cancelarGeracao}
      comecar={(proposta) => void comecar(proposta)} ajustar={() => abrir({ tipo: 'objetivo' })} />;
  }

  if (etapa.tipo === 'objetivo' || etapa.tipo === 'geracao' || planos?.length === 0) {
    return <Pedido objetivo={objetivo} ocupado={ocupado} aviso={aviso} falha={falhaGeracao} erro={erro}
      temPlanos={(planos?.length ?? 0) > 0} acoes={acoes} aoMudar={atualizarObjetivo} gerar={(texto) => void gerar(texto)}
      verPlanos={() => abrir({ tipo: 'planos' })} />;
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
 * Pedido da trilha: a pessoa escreve o que quer aprender, ou toca numa sugestão, e gera a trilha ao vivo.
 * Um objetivo curto demais não sai do aparelho: o campo mostra o que falta e recebe o foco, como na web.
 * O foco da tela vai ao erro, quando há um, e senão ao título; o aviso de geração cancelada é anunciado.
 */
function Pedido({ objetivo, ocupado, aviso, falha, erro, temPlanos, acoes, aoMudar, gerar, verPlanos }: {
  objetivo: string;
  ocupado: boolean;
  aviso: string | null;
  falha: string | null;
  erro: string | null;
  temPlanos: boolean;
  acoes: ReactNode;
  aoMudar: (texto: string) => void;
  gerar: (texto: string) => void;
  verPlanos: () => void;
}) {
  const [curto, setCurto] = useState(false);
  // Decidido uma vez: o erro que some enquanto a pessoa digita não devolve o foco ao título.
  const [focarTitulo] = useState(() => !erro && !falha);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const { width } = useWindowDimensions();
  const texto = objetivo.trim();
  const minimo = LIMITES_GERACAO.objetivoMin;
  const mostrarCurto = curto && texto.length < minimo;
  const mostrarContador = objetivo.length >= LIMITES_GERACAO.objetivoMax - 100;
  const contador = mensagens.pedido.contador(objetivo.length, LIMITES_GERACAO.objetivoMax);
  // O que a web liga ao campo por aria-describedby: o erro, o aviso de privacidade e, perto do limite, o contador.
  const dica = [mostrarCurto && mensagens.pedido.curto(minimo), mensagens.pedido.privacidade, mostrarContador && contador]
    .filter(Boolean).join(' ');
  const repetivel = falha === 'ia_indisponivel' || falha === 'falha' || falha === 'conexao';
  const mostrarVerPlanos = falha === 'limite_geracoes' && temPlanos;
  const stu = width >= 1024 ? 112 : width >= 768 ? 96 : 72;

  function tentar() {
    if (ocupado || !texto) return;
    if (texto.length < minimo) {
      setCurto(true);
      campo.current?.focus();
      // O campo já pode estar em foco; o anúncio garante que a pessoa ouça o que falta.
      anunciar(mensagens.pedido.curto(minimo));
      return;
    }
    gerar(texto);
  }

  function sugerir(exemplo: string) {
    aoMudar(exemplo);
    setCurto(false);
    anunciar(mensagens.pedido.sugestaoAplicada(exemplo));
  }

  return (
    <Tela pagina="objetivo" acoes={acoes} rodape={<Botao rotulo={mensagens.pedido.gerar} testID="gerar-trilha"
      desativado={ocupado || !texto} acao={tentar} />}>
      <View style={[estudoEstilos.pedidoTopo, width >= 768 && estudoEstilos.pedidoTopoLargo]}>
        <View style={estudoEstilos.pedidoTextos}>
          <Titulo testID="titulo-objetivo" foco={focarTitulo}>{mensagens.pedido.titulo}</Titulo>
          <Text style={estilos.introducao}>{mensagens.pedido.instrucoes}</Text>
        </View>
        <Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
          importantForAccessibility="no" style={{ width: stu, height: Math.round(stu * 1.1) }} />
      </View>
      {aviso && <Text style={estudoEstilos.aviso}>{aviso}</Text>}
      {erro && <EstadoMensagem mensagem={erro} foco />}
      {falha && <EstadoMensagem mensagem={mensagemDoCodigo(falha)} testID="erro-geracao" foco />}
      {falha && (repetivel || mostrarVerPlanos) && (
        <View style={estudoEstilos.acoesErro}>
          {repetivel && <Botao rotulo={mensagens.tentar} testID="tentar-geracao" variante="secundario" desativado={ocupado} acao={tentar} />}
          {mostrarVerPlanos && <Botao rotulo={mensagens.pedido.verPlanos} testID="ver-planos" variante="secundario"
            desativado={ocupado} acao={verPlanos} />}
        </View>
      )}
      <View style={estudoEstilos.campoPedido}>
        <Campo campoRef={campo} testID="objetivo-estudo" rotulo={mensagens.pedido.objetivo} value={objetivo}
          onChangeText={aoMudar} editable={!ocupado} multiline maxLength={LIMITES_GERACAO.objetivoMax}
          accessibilityHint={dica} style={estudoEstilos.entradaPedido} />
        {mostrarCurto && (
          <View style={estudoEstilos.campoErro}>
            <Text importantForAccessibility="no" style={[estilos.sinal, { color: cores.erro, borderColor: cores.erro }]}>!</Text>
            <Text style={estudoEstilos.campoErroTexto}>{mensagens.pedido.curto(minimo)}</Text>
          </View>
        )}
        <Text style={estilos.legenda}>{mensagens.pedido.privacidade}</Text>
        {mostrarContador && <Text style={[estilos.legenda, estudoEstilos.contador]}>{contador}</Text>}
      </View>
      <View style={estudoEstilos.sugestoes}>
        <Text style={estudoEstilos.sugestoesTitulo}>{mensagens.pedido.sugestoes}</Text>
        <View style={estudoEstilos.chips}>
          {mensagens.pedido.exemplos.map((exemplo, indice) => (
            <Sugestao key={exemplo} texto={exemplo} testID={`sugestao-${indice}`} escolhida={texto === exemplo}
              desativada={ocupado} acao={() => sugerir(exemplo)} />
          ))}
        </View>
      </View>
    </Tela>
  );
}

/** Sugestão de objetivo: preenche o campo. A escolhida mostra o visto e o leitor de tela ouve que está selecionada. */
function Sugestao({ texto, testID, escolhida, desativada, acao }: {
  texto: string;
  testID: string;
  escolhida: boolean;
  desativada: boolean;
  acao: () => void;
}) {
  const [focado, setFocado] = useState(false);

  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: escolhida, disabled: desativada }}
      disabled={desativada} onPress={acao} onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
      style={({ pressed }) => [estudoEstilos.chip, escolhida && estudoEstilos.chipEscolhida, desativada && estudoEstilos.chipDesativada,
        pressed && estilos.botaoPressionado, focado && estilos.foco]}>
      {escolhida && <Icone nome="check" tamanho={18} cor={cores.acao} />}
      <Text style={[estudoEstilos.chipTexto, escolhida && { color: cores.acao }, desativada && { color: cores.textoSecundario }]}>
        {texto}
      </Text>
    </Pressable>
  );
}

/**
 * Geração ao vivo: a trilha vazia recebe primeiro o título e depois cada lição como nó do caminho, na ordem em que chegam.
 * O botão da esquerda do rodapé é o mesmo do começo ao fim: Cancelar enquanto a IA monta e Ajustar pedido no fim; os dois
 * voltam ao pedido sem salvar nada. Começar aparece em outro lugar, então um toque atrasado em Cancelar não aceita a trilha.
 * No celular, com a trilha pronta, os dois botões dividem o rodapé e a contagem sai, como na web.
 * Se a pessoa está vendo o fim do caminho, a tela acompanha cada nó que chega; se rolou para cima, fica onde está.
 */
function GeracaoAoVivo({ geracao, erro, ocupado, acoes, cancelar, comecar, ajustar }: {
  geracao: TrilhaEmGeracao;
  erro: string | null;
  ocupado: boolean;
  acoes: ReactNode;
  cancelar: () => void;
  comecar: (proposta: PropostaPlano) => void;
  ajustar: () => void;
}) {
  const nos = useMemo(() => nosDaPrevia(geracao), [geracao]);
  const { titulo, proposta } = geracao;
  const total = nos.length;
  const { width, height } = useWindowDimensions();
  const largo = width >= 768;
  const reduzir = useMovimentoReduzido();
  const [focarTitulo] = useState(() => !erro);
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const visivel = useRef(0);
  const rolado = useRef(0);
  const dividir = proposta !== null && !largo;
  const rotulo = proposta ? mensagens.geracao.pronta : mensagens.geracao.montando;
  const contagem = proposta ? mensagens.geracao.contagemFinal(total) : mensagens.geracao.contagem(total);

  // O erro aparece no topo, como na web; a tela sobe até ele.
  useEffect(() => {
    if (erro) rolagem.current?.scrollTo({ y: 0, animated: reduzir === false });
  }, [erro, reduzir]);

  /**
   * A mesma regra da web: se o último nó estava à vista, rola só o necessário para o alvo (o próximo nó ou a chegada)
   * também ficar à vista. O rodapé fica fora da rolagem, então basta uma folga pequena embaixo.
   */
  function acompanhar(ultimo: Faixa, alvo: Faixa) {
    requestAnimationFrame(() => {
      const altura = visivel.current || height;
      const topo = rolado.current;
      const limite = topo + altura - 24;
      if (ultimo.topo > limite || ultimo.base < topo) return;
      if (alvo.base <= limite) return;
      rolagem.current?.scrollTo({ y: alvo.base + 24 - altura, animated: reduzir === false });
    });
  }

  const rodape = (
    <View style={estudoEstilos.geracaoAcoes}>
      <View style={dividir ? estudoEstilos.metade : null}>
        <Botao rotulo={proposta ? mensagens.geracao.ajustar : mensagens.geracao.cancelar} testID="voltar-pedido" variante="secundario"
          desativado={ocupado} acao={proposta ? ajustar : cancelar} />
      </View>
      {!dividir && (
        <View accessible accessibilityLabel={`${rotulo}. ${contagem}`} style={estudoEstilos.situacao}>
          <Text style={estudoEstilos.situacaoRotulo}>{rotulo}</Text>
          <Text style={estudoEstilos.situacaoContagem}>{contagem}</Text>
        </View>
      )}
      {proposta && (
        <View style={dividir ? estudoEstilos.metade : null}>
          <Botao rotulo={mensagens.geracao.comecar} testID="comecar-trilha" desativado={ocupado} acao={() => comecar(proposta)} />
        </View>
      )}
    </View>
  );

  return (
    <Tela pagina="geracao" acoes={acoes} rodape={rodape} rolagem={rolagem}
      aoMedir={(altura) => { visivel.current = altura; }} aoRolar={(y) => { rolado.current = y; }}>
      {erro && <EstadoMensagem mensagem={erro} foco />}
      <View style={[estudoEstilos.faixa, largo && estudoEstilos.faixaLarga]}>
        <Text style={estudoEstilos.contexto}>{mensagens.geracao.contexto}</Text>
        <TituloGeracao titulo={titulo} foco={focarTitulo} reduzir={reduzir} />
        {/* Na faixa ficam três linhas do pedido; o leitor de tela lê o texto inteiro. */}
        {titulo !== null && !repeteTitulo(titulo, geracao.objetivo) && (
          <Text numberOfLines={3} accessibilityLabel={geracao.objetivo} style={[estilos.introducao, estudoEstilos.objetivoFaixa]}>
            {geracao.objetivo}
          </Text>
        )}
        <Text style={estudoEstilos.geracaoIa}>{mensagens.geracao.ia}</Text>
        {proposta
          ? <Text style={estudoEstilos.geracaoOrigem}>{mensagens.geracao.origem(proposta.origem)}</Text>
          : <View importantForAccessibility="no" accessibilityElementsHidden style={estudoEstilos.esqueletoOrigem} />}
      </View>
      <Caminho nos={nos} stu={proposta ? mensagens.geracao.stuPronta : mensagens.geracao.stuMontando}
        chegada={proposta !== null} montando={proposta === null} acompanhar={acompanhar} />
    </Tela>
  );
}

/**
 * Título da trilha em geração: um esqueleto até o título chegar, e então o título entra uma vez (com movimento reduzido,
 * já aparece pronto). O leitor de tela ouve "Montando sua trilha" e depois o título; o anúncio do título diz o mesmo.
 */
function TituloGeracao({ titulo, foco, reduzir }: { titulo: string | null; foco: boolean; reduzir: boolean | null }) {
  const area = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (foco && area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, [foco]);

  return (
    <View ref={area} testID="titulo-geracao" accessible accessibilityRole="header"
      accessibilityLabel={titulo ?? mensagens.geracao.montandoTitulo}>
      {titulo !== null
        ? <TextoQueChega key={titulo} texto={titulo} surgir={reduzir === false} />
        : <View style={estudoEstilos.esqueletoTitulo} />}
    </View>
  );
}

/** O título que chega: opacidade e uma subida curta, uma vez, como a web. */
function TextoQueChega({ texto, surgir }: { texto: string; surgir: boolean }) {
  const [entrada] = useState(() => surgir ? new Animated.Value(0) : null);

  useEffect(() => {
    if (!entrada) return;
    const animacao = Animated.timing(entrada, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [entrada]);

  return (
    <Animated.Text style={[estilos.titulo, estudoEstilos.tituloFaixa, entrada && {
      opacity: entrada,
      transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
    }]}>
      {texto}
    </Animated.Text>
  );
}

/**
 * Carregando a lição: a forma da aula (voltar, título, quadro e botão), sem spinner (DESIGN §7).
 * Recebe o foco, porque o botão tocado sai da tela; ao trocar de "Preparando sua trilha…" para "Abrindo a lição",
 * o leitor de tela ouve o texto novo.
 */
function SkeletonLicao({ texto, acoes }: { texto: string; acoes: ReactNode }) {
  const area = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, []);

  return (
    <Tela pagina="carregando-licao" acoes={acoes} rodape={<View importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden style={estudoEstilos.esqueletoBotao} />}>
      <View ref={area} testID="carregando-licao" accessible accessibilityLabel={texto} accessibilityLiveRegion="polite">
        <View style={estudoEstilos.esqueletoVoltar} />
        <View style={estudoEstilos.esqueletoTituloLicao} />
        <View style={estudoEstilos.esqueletoLinha} />
        <View style={estudoEstilos.esqueletoQuadro}>
          <View style={[estudoEstilos.esqueletoBarra, estudoEstilos.esqueletoBarraPrimeira]} />
          <View style={estudoEstilos.esqueletoBarra} />
          <View style={estudoEstilos.esqueletoBarra} />
          <View style={[estudoEstilos.esqueletoBarra, estudoEstilos.esqueletoBarraUltima]} />
        </View>
      </View>
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
        {/* Na faixa ficam três linhas do objetivo, só quando ele acrescenta algo ao título; o leitor de tela lê o texto inteiro. */}
        {!repeteTitulo(plano.titulo, plano.objetivo) && (
          <Text numberOfLines={3} accessibilityLabel={plano.objetivo} style={[estilos.introducao, estudoEstilos.objetivoFaixa]}>
            {plano.objetivo}
          </Text>
        )}
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
  bloco: { gap: 12, marginTop: 16, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: cores.gelo },
  blocoConclusao: { marginTop: 24, padding: 20 },
  progresso: { gap: 8, marginTop: 12 },
  progressoNaFaixa: { marginTop: 20 },
  trilha: { height: 8, borderRadius: 4, backgroundColor: cores.nevoa, overflow: 'hidden' },
  trilhaNaFaixa: { backgroundColor: cores.fundo },
  preenchimento: { height: '100%', backgroundColor: cores.acao, borderRadius: 4 },
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
  // Pedido
  pedidoTopo: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pedidoTopoLargo: { gap: 24 },
  pedidoTextos: { flex: 1, minWidth: 0 },
  aviso: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: cores.nevoa,
    color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  acoesErro: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  campoPedido: { marginTop: 24, gap: 8 },
  entradaPedido: { minHeight: 152, fontSize: 18, lineHeight: 26 },
  campoErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campoErroTexto: { flex: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  contador: { alignSelf: 'flex-end' },
  sugestoes: { marginTop: 24, gap: 12 },
  sugestoesTitulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, maxWidth: '100%', paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: cores.gelo, borderRadius: 12, backgroundColor: cores.fundo },
  chipEscolhida: { borderColor: cores.acao, backgroundColor: cores.nevoa },
  chipDesativada: { backgroundColor: cores.nevoa },
  chipTexto: { flexShrink: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  // Geração ao vivo
  contexto: { marginBottom: 8, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  esqueletoTitulo: { width: '72%', maxWidth: 384, height: 28, marginVertical: 2, borderRadius: 8, backgroundColor: cores.gelo },
  geracaoIa: { marginTop: 16, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  geracaoOrigem: { marginTop: 4, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  esqueletoOrigem: { width: '48%', maxWidth: 256, height: 12, marginTop: 10, borderRadius: 8, backgroundColor: cores.gelo },
  geracaoAcoes: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metade: { flex: 1, minWidth: 0 },
  situacao: { flex: 1, minWidth: 0 },
  situacaoRotulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 21 },
  situacaoContagem: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  // Carregando a lição
  esqueletoVoltar: { width: 136, height: 44, borderRadius: 12, backgroundColor: cores.gelo },
  esqueletoTituloLicao: { width: '72%', height: 36, marginTop: 8, borderRadius: 8, backgroundColor: cores.gelo },
  esqueletoLinha: { width: '56%', height: 16, marginTop: 16, borderRadius: 8, backgroundColor: cores.gelo },
  esqueletoQuadro: { marginTop: 24, padding: 16, gap: 12, borderRadius: 20, backgroundColor: cores.nevoa },
  esqueletoBarra: { width: '100%', height: 16, borderRadius: 8, backgroundColor: cores.fundo },
  esqueletoBarraPrimeira: { width: '32%', height: 20 },
  esqueletoBarraUltima: { width: '64%' },
  esqueletoBotao: { width: '100%', height: 48, borderRadius: 20, backgroundColor: cores.gelo },
});
