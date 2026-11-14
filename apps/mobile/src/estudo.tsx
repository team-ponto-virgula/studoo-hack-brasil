import { MaterialParaTrilha } from './estudio-adaptativo';
import type { ClienteEstudio } from '@studoo/contratos';
import { ErroStudoo, LIMITES_GERACAO, type LicaoDetalhe, type PlanoDetalhe, type PlanoResumo, type Progresso, type PropostaPlano } from '@studoo/contratos';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Platform,
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
  type ViewStyle,
} from 'react-native';
import { estiloDeEntrada, useAparecer, useContagem, usePulinho } from './animacoes';
import { codigoDaFalha, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { Apresentacao } from './apresentacao';
import { Caminho, SkeletonTrilha, type Faixa } from './caminho';
import { aplicarEvento, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { Icone } from './icone';
import { Confete } from './festa';
import { Botao, Campo, EstadoMensagem, Skeleton, Tela, Titulo, estilos, useBalanco, useMovimentoReduzido } from './interface';
import { NavegacaoContexto } from './navegacao';
import { Licao, type ResumoLicao } from './licao';
import { mensagemDeErro, mensagemDoCodigo, mensagens } from './mensagens';
import { regiaoDoTrecho, type NomeDesenho } from './mundo-desenhos';
import { Desenho, coresDaRegiao } from './mundo';
import { marcarApresentacaoVista } from './preferencias';
import { iconeDoExemplo, iconesDosTemas, todosOsExemplos, type IdTema } from './temas';
import { cores, fontes } from './tema';
import { falaDoStu, liberadasEntre, montarTrilha, proximaDoCaminho, repeteTitulo, type NomeIcone } from './trilha';

/*
 * Estudo no app, com os mesmos passos da web (src/app/estudo.tsx): a pessoa escreve o que quer aprender, a trilha é montada
 * ao vivo, nó a nó, e Começar salva a trilha mostrada e abre a primeira lição (spec 03).
 */

type Etapa =
  | { tipo: 'apresentacao'; primeiraVez: boolean }
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'geracao' }
  /** `concluida`: a lição que a pessoa acabou de concluir, para o caminho comemorar no nó dela. */
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[]; concluida?: string }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; antes: Progresso; licao: LicaoDetalhe; liberadas: string[]; resumo?: ResumoLicao };

type EtapaPlano = Extract<Etapa, { tipo: 'plano' }>;
type Acao = 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string };

/** Quanto "Escrevendo suas lições" fica na tela, no mínimo: com a IA falsa, o aceite volta rápido e o título piscaria. */
const ESCRITA_MINIMA_MS = 1200;
/** Quanto "Lições prontas!" fica na tela, no mínimo, para o visto passar por todas as lições (como na web). */
const PAUSA_LICOES_PRONTAS_MS = 900;
const pausa = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

/** Volta da lição ou da conclusão para a trilha, que rola até o nó liberado, o próximo ou a lição de origem, como na web. */
function voltarATrilha(etapa: Extract<Etapa, { tipo: 'licao' | 'concluida' }>): EtapaPlano {
  if (etapa.tipo === 'concluida') {
    return { tipo: 'plano', plano: etapa.plano, origem: etapa.licao.id, liberadas: etapa.liberadas, concluida: etapa.licao.id };
  }
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
  /** Área escolhida no fim da apresentação: o pedido abre com as ideias dela. */
  const [areaInicial, setAreaInicial] = useState<IdTema | undefined>();
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
        // A apresentação é opcional, como na web.
        if (!ativo) return;
        setPlanos(lista);
        // Como na web: com planos salvos, abre direto na trilha em andamento (só se a pessoa ainda está em Meus planos).
        const inicial = planoInicial(lista);
        if (inicial) {
          try {
            const plano = await cliente.obterPlano(inicial.id);
            if (!ativo) return;
            setEtapa((atual) => atual.tipo === 'planos' ? { tipo: 'plano', plano } : atual);
          } catch {
            // Sem o detalhe, a pessoa fica em Meus planos e escolhe de lá.
          }
        }
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
    if (Platform.OS === 'web') return;
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => {
      if (emCurso.current) return true;
      if (etapa.tipo === 'planos') return false;
      if (etapa.tipo === 'apresentacao') {
        void concluirApresentacao();
        return true;
      }
      if (etapa.tipo === 'geracao') {
        if (geracao?.proposta) navegar({ tipo: 'objetivo' });
        else cancelarGeracao();
      } else if (etapa.tipo === 'licao') void abrirPlano(etapa.plano.id, etapa.licao.id);
      else if (etapa.tipo === 'concluida') navegar(voltarATrilha(etapa));
      else navegar({ tipo: 'planos' });
      return true;
    });
    return () => assinatura.remove();
  }, [etapa, geracao]);

  /** Fim da apresentação (concluída, pulada ou com o voltar do aparelho): não aparece mais neste aparelho e o pedido abre. */
  async function concluirApresentacao(area?: IdTema) {
    if (area) setAreaInicial(area);
    navegar({ tipo: 'objetivo' });
    await marcarApresentacaoVista();
  }

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
    const aceite = await executar('aceitar', async () => {
      const [plano] = await Promise.all([cliente.aceitarProposta(proposta.token), pausa(ESCRITA_MINIMA_MS)]);
      return plano;
    });
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
    // As lições acabaram de ficar prontas: o visto passa por elas enquanto a primeira abre.
    const licao = await executar('abrir', async () => {
      const [dados] = await Promise.all([cliente.obterLicao(primeira), pausa(PAUSA_LICOES_PRONTAS_MS)]);
      return dados;
    });
    if (licao.ok) {
      navegar({ tipo: 'licao', plano, licao: licao.dados });
      return;
    }
    if (licao.codigo === 'nao_autenticado') return;
    navegar({ tipo: 'plano', plano });
    setErro(mensagemDoCodigo(licao.codigo));
  }

  async function abrirPlano(id: string, origem?: string) {
    const resultado = await executar('plano', () => cliente.obterPlano(id));
    if (!resultado.ok) return;
    atualizarPlano(resultado.dados);
    navegar({ tipo: 'plano', plano: resultado.dados, origem });
  }

  /** Abre a lição guardando qual nó está abrindo, para o caminho e o próximo passo mostrarem "Abrindo…". */
  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    if (emCurso.current) return;
    setAbrindo(id);
    const resultado = await executar('abrir', () => cliente.obterLicao(id));
    setAbrindo(null);
    if (resultado.ok) navegar({ tipo: 'licao', plano, licao: resultado.dados });
  }

  async function concluir(plano: PlanoDetalhe, licao: LicaoDetalhe, comprovante: string, resumo?: ResumoLicao) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante));
    if (resultado.ok) {
      const atualizado = resultado.dados.plano;
      atualizarPlano(atualizado);
      navegar({ tipo: 'concluida', plano: atualizado, antes: plano.progresso, licao, liberadas: liberadasEntre(plano, atualizado), resumo });
      return true;
    }
    return resultado.codigo !== 'avaliacao_invalida';
  }

  const acoes = (
    <>
      {etapa.tipo !== 'planos' && !['objetivo', 'plano'].includes(etapa.tipo) && <Botao rotulo={mensagens.planos.titulo} testID="meus-planos" compacto variante="texto"
        desativado={ocupado} acao={() => abrir({ tipo: 'planos' })} />}
      <Botao rotulo={mensagens.sair} testID="sair" compacto variante="texto" desativado={ocupado}
        acao={() => void executar('sair', sair)} />
    </>
  );
  const mensagem = erro && <EstadoMensagem mensagem={erro} />;

  const comNavegacao = planos !== null && planos.length > 0 && ['planos', 'objetivo', 'plano'].includes(etapa.tipo) && !pendente;
  return <NavegacaoContexto.Provider value={comNavegacao ? {
    atual: etapa.tipo as 'planos' | 'objetivo' | 'plano', ocupado,
    planos: () => abrir({ tipo: 'planos' }), criar: () => abrir({ tipo: 'objetivo' }),
  } : null}>{renderizarTela()}</NavegacaoContexto.Provider>;

  function renderizarTela() {
    // Carregando, como na web: a trilha mostra o esqueleto do caminho e a lição, a forma da aula. Começar, na trilha gerada,
    // mostra o Stu escrevendo as lições até a primeira abrir: salvar o plano e abrir a lição é uma espera só.
    if (pendente === 'plano') return <Tela pagina="carregando-trilha" acoes={acoes}><SkeletonTrilha /></Tela>;
    if (etapa.tipo === 'geracao' && geracao?.proposta && (pendente === 'aceitar' || pendente === 'abrir')) {
      return <PreparandoLicoes proposta={geracao.proposta} prontas={pendente === 'abrir'} />;
    }
    if (pendente === 'abrir' && etapa.tipo !== 'plano') return <SkeletonLicao texto={mensagens.licao.carregando} />;

    if (etapa.tipo === 'apresentacao') {
      return <Apresentacao primeiraVez={etapa.primeiraVez} concluir={(area) => void concluirApresentacao(area)} />;
    }

    if (etapa.tipo === 'licao') {
      return <Licao cliente={cliente} key={etapa.licao.id} licao={etapa.licao} erro={erro} pendente={pendente}
        voltar={() => void abrirPlano(etapa.plano.id, etapa.licao.id)}
        avaliar={async (resposta) => {
          const resultado = await executar('avaliar', () => cliente.avaliarLicao(etapa.licao.id, resposta));
          return resultado.ok ? resultado.dados : null;
        }}
        concluir={(comprovante, resumo) => concluir(etapa.plano, etapa.licao, comprovante, resumo)} />;
    }

    if (etapa.tipo === 'concluida') {
      const proxima = proximaDoCaminho(etapa.plano);
      return (
        <TelaConcluida etapa={etapa} acoes={acoes} mensagem={mensagem} rodape={<>
          {proxima && <Botao rotulo={mensagens.licao.avancar} testID="proxima-licao" variante="secundario" desativado={ocupado}
            acao={() => void abrirLicao(etapa.plano, proxima)} />}
          <Botao rotulo={mensagens.licao.voltar} testID="voltar-plano" desativado={ocupado} acao={() => abrir(voltarATrilha(etapa))} />
        </>} />
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
      return <Pedido cliente={cliente} onProposta={p => { navegar({ tipo: 'geracao' }); setGeracao({ objetivo: p.objetivo, titulo: p.titulo, fluxos: p.fluxos.map(f => ({ titulo: f.titulo, licoes: f.licoes.map(l => l.titulo) })), proposta: p }); }} objetivo={objetivo} ocupado={ocupado} aviso={aviso} falha={falhaGeracao} erro={erro} areaInicial={areaInicial}
        temPlanos={(planos?.length ?? 0) > 0} acoes={acoes} aoMudar={atualizarObjetivo} gerar={(texto) => void gerar(texto)}
        verPlanos={() => abrir({ tipo: 'planos' })} comoFunciona={() => abrir({ tipo: 'apresentacao', primeiraVez: false })} />;
    }

    return (
      <Tela pagina="planos" acoes={acoes} rodape={!planos && erro && <Botao rotulo={mensagens.tentar} testID="tentar-planos" desativado={ocupado} acao={() => {
          setErro(null);
          setTentativa((anterior) => anterior + 1);
        }} />}>
        <Titulo testID="titulo-planos" foco>{mensagens.planos.titulo}</Titulo>
        <Text style={estilos.introducao}>{mensagens.planos.subtitulo}</Text>
        {mensagem}
        {!planos && !erro && <Skeleton />}
        {planos?.map((plano, indice) => (
          <CartaoPlano key={plano.id} plano={plano} indice={indice} ocupado={ocupado} abrir={() => void abrirPlano(plano.id)} />
        ))}
      </Tela>
    );
  }
}

/** Plano para abrir ao entrar, como na web: o que está em andamento, senão o primeiro não concluído, senão o mais recente. */
function planoInicial(planos: PlanoResumo[]) {
  return planos.find(({ progresso: p }) => p.concluidas > 0 && p.concluidas < p.total)
    ?? planos.find(({ progresso: p }) => p.concluidas < p.total)
    ?? planos[0] ?? null;
}

/**
 * Pedido da trilha: a pessoa escreve o que quer aprender, ou escolhe uma ideia, e gera a trilha ao vivo.
 * As ideias vêm por área de interesse (idiomas, música, matemática…), numa fileira que desliza para o lado, para mostrar
 * que vale qualquer assunto; "Surpreenda-me" sorteia uma. Como na web, tocar numa ideia preenche o campo.
 * Um objetivo curto demais não sai do aparelho: o campo mostra o que falta e recebe o foco.
 * O foco da tela vai ao erro, quando há um, e senão ao título; o aviso de geração cancelada é anunciado.
 */
function Pedido({ cliente, onProposta, objetivo, ocupado, aviso, falha, erro, temPlanos, areaInicial, acoes, aoMudar, gerar, verPlanos, comoFunciona }: {
  cliente: ClienteEstudio;
  onProposta: (p: PropostaPlano) => void;
  objetivo: string;
  ocupado: boolean;
  aviso: string | null;
  falha: string | null;
  erro: string | null;
  temPlanos: boolean;
  /** Área que abre primeiro, como a escolhida no fim da apresentação; sem ela, Populares. */
  areaInicial?: IdTema;
  acoes: ReactNode;
  aoMudar: (texto: string) => void;
  gerar: (texto: string) => void;
  verPlanos: () => void;
  comoFunciona: () => void;
}) {
  const [modo, setModo] = useState<'ideia' | 'material'>('ideia');
  const balancoInicio = useBalanco(3, 1800);
  const [curto, setCurto] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [brilho, setBrilho] = useState(0);
  // Decidido uma vez: o erro que some enquanto a pessoa digita não devolve o foco ao título.
  const [focarTitulo] = useState(() => !erro && !falha);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const texto = objetivo.trim();
  // As ideias vêm da área escolhida na apresentação; sem ela, das mais populares (como na web).
  const tema = mensagens.pedido.temas.find((item) => item.id === (areaInicial ?? 'populares')) ?? mensagens.pedido.temas[0];
  const minimo = LIMITES_GERACAO.objetivoMin;
  const mostrarCurto = curto && texto.length < minimo;
  const mostrarContador = objetivo.length >= LIMITES_GERACAO.objetivoMax - 100;
  const contador = mensagens.pedido.contador(objetivo.length, LIMITES_GERACAO.objetivoMax);
  // O que a web liga ao campo por aria-describedby: o erro, a dica, o aviso de privacidade e, perto do limite, o contador.
  const dica = [mostrarCurto && mensagens.pedido.curto(minimo), mensagens.pedido.dica, mensagens.pedido.privacidade, mostrarContador && contador]
    .filter(Boolean).join(' ');
  const repetivel = falha === 'ia_indisponivel' || falha === 'falha' || falha === 'conexao';
  const mostrarVerPlanos = falha === 'limite_geracoes' && temPlanos;
  // O Stu reage ao pedido, como na web: convida, incentiva enquanto a pessoa escreve e comemora a ideia escolhida.
  let fala: string = mensagens.pedido.falas.vazio;
  if (escolhida !== null && escolhida === texto) fala = mensagens.pedido.falas.escolhida;
  else if (texto.length >= 20) fala = mensagens.pedido.falas.pronto;
  else if (texto.length > 0) fala = mensagens.pedido.falas.curto;

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

  function sugerir(ideia: string) {
    aoMudar(ideia);
    setCurto(false);
    setEscolhida(ideia);
    setBrilho((anterior) => anterior + 1);
    anunciar(mensagens.pedido.sugestaoAplicada(ideia));
  }

  function surpreender() {
    const opcoes = todosOsExemplos.filter((ideia) => ideia !== texto);
    sugerir(opcoes[Math.floor(Math.random() * opcoes.length)]);
  }

  return (
    <Tela pagina="objetivo" acoes={acoes} rodape={modo === 'ideia' ? <Botao rotulo={mensagens.inicio.criar} testID="gerar-trilha"
      desativado={ocupado || !texto} acao={tentar} /> : undefined}>
      <View style={estudoEstilos.pedidoHeroi}>
        <View style={estudoEstilos.pedidoHalo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            style={{ width: 92, height: 104, transform: [{ translateY: balancoInicio }] }} />
          <Text style={estudoEstilos.pedidoEstrela}>✦</Text>
        </View>
        <Titulo testID="titulo-objetivo" foco={focarTitulo} estilo={estudoEstilos.pedidoTitulo}>
          {modo === 'material' ? mensagens.inicio.materialTitulo : mensagens.pedido.titulo}
        </Titulo>
        <Text accessibilityLiveRegion="polite" style={estudoEstilos.pedidoFala}>{modo === 'material' ? mensagens.inicio.materialTexto : fala}</Text>
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
      <View style={modo !== 'material' && { display: 'none' }}><MaterialParaTrilha cliente={cliente} objetivo={objetivo} onProposta={onProposta} /></View>
      <View style={modo !== 'ideia' && { display: 'none' }}>
        <View style={estudoEstilos.campoPedido}>
          <CampoObjetivo campoRef={campo} valor={objetivo} aoMudar={aoMudar} editavel={!ocupado} dica={dica} brilho={brilho} />
          {mostrarCurto && (
            <View style={estudoEstilos.campoErro}>
              <Text importantForAccessibility="no" style={[estilos.sinal, { color: cores.erro, borderColor: cores.erro }]}>!</Text>
              <Text style={estudoEstilos.campoErroTexto}>{mensagens.pedido.curto(minimo)}</Text>
            </View>
          )}
          {mostrarContador && <Text style={[estilos.legenda, estudoEstilos.contador]}>{contador}</Text>}
        </View>
        <View style={estudoEstilos.sugestoes}>
          <View style={estudoEstilos.sugestoesTopo}>
            <Text accessibilityRole="header" style={estudoEstilos.sugestoesTitulo}>{mensagens.pedido.sugestoes}</Text>
            <Surpresa desativada={ocupado} acao={surpreender} />
          </View>
          <View key={tema.id} style={estudoEstilos.exemplos}>
            {tema.exemplos.slice(0, 4).map((exemplo, indice) => (
              <Sugestao key={exemplo} texto={exemplo} icone={iconeDoExemplo(tema, exemplo)} testID={`sugestao-${indice}`} ordem={indice}
                escolhida={texto === exemplo} desativada={ocupado} acao={() => sugerir(exemplo)} />
            ))}
          </View>
        </View>
      </View>
      <Pressable testID="alternar-modo" accessibilityRole="button" accessibilityState={{ disabled: ocupado }} disabled={ocupado}
        onPress={() => setModo(modo === 'ideia' ? 'material' : 'ideia')}
        style={({ pressed }) => [estudoEstilos.alternar, pressed && { opacity: 0.85 }]}>
        <View style={estudoEstilos.alternarIcone} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icone nome={modo === 'ideia' ? 'livro' : 'lampada'} tamanho={22} cor={cores.acao} />
        </View>
        <View style={estudoEstilos.alternarTextos}>
          <Text style={estudoEstilos.alternarTitulo}>{modo === 'ideia' ? mensagens.inicio.material : mensagens.inicio.voltarIdeia}</Text>
          <Text style={estilos.legenda}>{modo === 'ideia' ? mensagens.inicio.materialDica : mensagens.inicio.ideiaDica}</Text>
        </View>
        <Icone nome="seta" tamanho={20} cor={cores.textoSecundario} />
      </Pressable>
      <LinkComoFunciona desativado={ocupado} acao={comoFunciona} />
    </Tela>
  );
}

/** O Stu acima do campo, que sobe e desce devagar, com um balão que reage ao pedido, como na web. */
function StuQueReage({ fala }: { fala: string }) {
  const balanco = useBalanco(4, 1500);
  return (
    <View style={estudoEstilos.stuReage} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        style={{ width: 62, height: 68, transform: [{ translateY: balanco }] }} />
      <BalaoFala key={fala} texto={fala} />
    </View>
  );
}

/** Balão de fala que entra com um pulinho a cada frase nova. */
function BalaoFala({ texto }: { texto: string }) {
  const entrada = useAparecer(0, 380, true);
  return (
    <Animated.View style={[estudoEstilos.balaoFala, {
      opacity: entrada, transform: [{ scale: entrada.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
    }]}>
      <View style={estudoEstilos.balaoFalaSeta} />
      <Text style={estudoEstilos.balaoFalaTexto}>{texto}</Text>
    </Animated.View>
  );
}

/**
 * Exemplo que se escreve sozinho no campo vazio, letra por letra, e se apaga para dar lugar ao próximo, como na web.
 * Para quando a pessoa escreve ou o campo está em foco (o leitor de tela não ouve o exemplo mudando);
 * com movimento reduzido, fica o primeiro exemplo, parado.
 */
function useExemploDigitado(ativo: boolean) {
  const reduzir = useMovimentoReduzido();
  const exemplos = mensagens.pedido.exemplosDigitados;
  const [texto, setTexto] = useState<string>(exemplos[0]);

  useEffect(() => {
    if (!ativo || reduzir !== false) {
      setTexto(exemplos[0]);
      return;
    }
    let indice = 0;
    let letras = 0;
    let apagando = false;
    let espera: ReturnType<typeof setTimeout>;
    function passo() {
      const atual = exemplos[indice];
      if (!apagando && letras < atual.length) {
        letras += 1;
        espera = setTimeout(passo, 55);
      } else if (!apagando) {
        apagando = true;
        espera = setTimeout(passo, 1700);
      } else if (letras > 0) {
        letras -= 1;
        espera = setTimeout(passo, 22);
      } else {
        apagando = false;
        indice = (indice + 1) % exemplos.length;
        espera = setTimeout(passo, 350);
      }
      setTexto(exemplos[indice].slice(0, letras));
    }
    setTexto('');
    espera = setTimeout(passo, 600);
    return () => clearTimeout(espera);
  }, [ativo, reduzir, exemplos]);

  return texto;
}

/** Campo do objetivo: só ele redesenha a cada letra do exemplo; brilha em dourado quando uma ideia é aplicada. */
function CampoObjetivo({ campoRef, valor, aoMudar, editavel, dica, brilho }: {
  campoRef: Ref<ComponentRef<typeof TextInput>>;
  valor: string;
  aoMudar: (texto: string) => void;
  editavel: boolean;
  dica: string;
  brilho: number;
}) {
  const [focado, setFocado] = useState(false);
  const reduzir = useMovimentoReduzido();
  const [luz] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!brilho || reduzir !== false) return;
    luz.setValue(1);
    const animacao = Animated.timing(luz, { toValue: 0, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [brilho, reduzir, luz]);

  return (
    <View>
      <Campo campoRef={campoRef} testID="objetivo-estudo" rotulo={mensagens.inicio.campo} value={valor}
        onChangeText={aoMudar} editable={editavel} multiline maxLength={LIMITES_GERACAO.objetivoMax}
        placeholder={mensagens.inicio.exemplo} accessibilityHint={dica} style={estudoEstilos.entradaPedido}
        onFocus={() => setFocado(true)} onBlur={() => setFocado(false)} />
      <Animated.View pointerEvents="none" style={[estudoEstilos.luzCampo, { opacity: luz }]} />
    </View>
  );
}

/** "Como funciona?": reabre a apresentação. */
function LinkComoFunciona({ desativado, acao }: { desativado: boolean; acao: () => void }) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID="como-funciona" accessibilityRole="button" accessibilityState={{ disabled: desativado }} disabled={desativado}
      onPress={acao} onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
      style={({ pressed }) => [estudoEstilos.como, pressed && estudoEstilos.comoPressionado, focado && estilos.foco]}>
      <View style={estudoEstilos.comoSinal} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={estudoEstilos.comoSinalTexto}>?</Text>
      </View>
      <Text style={[estudoEstilos.comoTexto, desativado && { color: cores.textoSecundario }]}>{mensagens.pedido.comoFunciona}</Text>
    </Pressable>
  );
}

/** "Surpreenda-me": sorteia uma ideia de qualquer área. */
function Surpresa({ desativada, acao }: { desativada: boolean; acao: () => void }) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID="surpreenda-me" accessibilityRole="button" accessibilityState={{ disabled: desativada }} disabled={desativada}
      onPress={acao} onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
      style={({ pressed }) => [estudoEstilos.surpresa, pressed && estudoEstilos.surpresaAfundada, desativada && estudoEstilos.chipDesativada,
        focado && estilos.foco]}>
      <Desenho nome="estrela" largura={18} />
      <Text style={[estudoEstilos.surpresaTexto, desativada && { color: cores.textoSecundario }]}>{mensagens.pedido.surpresa}</Text>
    </Pressable>
  );
}

/** Área de interesse: mostra as ideias dela. A escolhida fica marcada, o ícone pula e o leitor de tela ouve que está selecionada. */
function Area({ nome, icone, testID, escolhida, desativada, acao }: {
  nome: string;
  icone: NomeDesenho;
  testID: string;
  escolhida: boolean;
  desativada: boolean;
  acao: () => void;
}) {
  const [focado, setFocado] = useState(false);
  const pulo = usePulinho(escolhida, 1.3);
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: escolhida, disabled: desativada }}
      disabled={desativada} onPress={acao} onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
      style={({ pressed }) => [estudoEstilos.area, escolhida && estudoEstilos.areaEscolhida, desativada && estudoEstilos.chipDesativada,
        pressed && estilos.botaoPressionado, focado && estilos.foco]}>
      <Animated.View style={{ transform: [{ scale: pulo }, { rotate: pulo.interpolate({ inputRange: [1, 1.3], outputRange: ['0deg', '-12deg'] }) }] }}>
        <Desenho nome={icone} largura={22} />
      </Animated.View>
      <Text style={[estudoEstilos.areaTexto, escolhida && { color: cores.acao }, desativada && { color: cores.textoSecundario }]}>{nome}</Text>
    </Pressable>
  );
}

/** Ideia de objetivo: preenche o campo. Entra em sequência; a escolhida mostra o visto, que pula, e o leitor de tela ouve que está selecionada. */
function Sugestao({ texto, icone, testID, ordem, escolhida, desativada, acao }: {
  texto: string;
  icone: NomeDesenho;
  testID: string;
  ordem: number;
  escolhida: boolean;
  desativada: boolean;
  acao: () => void;
}) {
  const [focado, setFocado] = useState(false);
  const entrada = useAparecer(ordem * 50, 360);
  const pulo = usePulinho(escolhida, 1.35);

  return (
    <Animated.View style={estiloDeEntrada(entrada, 8, 1)}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ selected: escolhida, disabled: desativada }}
        disabled={desativada} onPress={acao} onFocus={() => setFocado(true)} onBlur={() => setFocado(false)}
        style={({ pressed }) => [estudoEstilos.chip, escolhida && estudoEstilos.chipEscolhida, desativada && estudoEstilos.chipDesativada,
          pressed && estudoEstilos.chipAfundado, focado && estilos.foco]}>
        <View style={estudoEstilos.chipIcone} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Desenho nome={icone} largura={26} />
        </View>
        <Text style={[estudoEstilos.chipTexto, desativada && { color: cores.textoSecundario }]}>{texto}</Text>
        <Animated.View style={[estudoEstilos.chipAcao, escolhida && estudoEstilos.chipAcaoEscolhida, { transform: [{ scale: pulo }] }]}
          importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icone nome={escolhida ? 'check' : 'seta'} tamanho={18} cor={escolhida ? cores.fundo : cores.textoSecundario} />
        </Animated.View>
      </Pressable>
    </Animated.View>
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
      <Caminho nos={nos} stu={proposta ? mensagens.geracao.stuPronta : mensagens.geracao.stuMontando} dicas={mensagens.geracao.dicas}
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
 * Começar, como na web: o aceite salva a trilha e a IA escreve a explicação, o exemplo e o exercício de cada lição.
 * Enquanto isso, o Stu escreve com o lápis, as folhas voam, um brilho desce pela lista das lições e dicas se revezam.
 * O aceite é um pedido só, sem andamento por lição, então nenhuma lição ganha o visto antes da hora; com `prontas`
 * (o aceite voltou), o visto passa por todas enquanto a primeira lição abre.
 */
function PreparandoLicoes({ proposta, prontas }: { proposta: PropostaPlano; prontas: boolean }) {
  const licoes = proposta.fluxos.flatMap((fluxo) => fluxo.licoes.map((licao) => licao.titulo));

  useEffect(() => {
    if (prontas) AccessibilityInfo.announceForAccessibility(mensagens.preparo.anuncioProntas);
  }, [prontas]);

  return (
    <Tela pagina="preparando-licoes">
      <CenaPreparo prontas={prontas} />
      <Text style={estudoEstilos.contexto}>{proposta.titulo}</Text>
      <Titulo testID="titulo-preparo" foco>{prontas ? mensagens.preparo.prontas : mensagens.preparo.titulo}</Titulo>
      <Text style={estilos.introducao}>{prontas ? mensagens.preparo.textoProntas : mensagens.preparo.texto}</Text>
      <View style={estudoEstilos.preparoLista} accessibilityLabel={mensagens.preparo.lista}>
        {licoes.map((nome, indice) => (
          <LinhaPreparo key={indice} nome={nome} indice={indice} total={licoes.length} prontas={prontas} />
        ))}
      </View>
      {!prontas && <DicaPreparo />}
    </Tela>
  );
}

/** A cena do Stu escrevendo: o céu, a colina da primeira região, o lápis que risca e as folhas que voam. */
function CenaPreparo({ prontas }: { prontas: boolean }) {
  const reduzir = useMovimentoReduzido();
  const { chao, relevo } = coresDaRegiao(0);
  const subida = useBalanco(6, 1200, !prontas);
  const [risco] = useState(() => new Animated.Value(0));
  const [pulo] = useState(() => new Animated.Value(0));
  const [folhas] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

  useEffect(() => {
    if (reduzir !== false || prontas) return;
    const movimento = { duration: 520, easing: Easing.inOut(Easing.ease), isInteraction: false, useNativeDriver: true };
    const lapis = Animated.loop(Animated.sequence([
      Animated.timing(risco, { ...movimento, toValue: 1 }),
      Animated.timing(risco, { ...movimento, toValue: 0 }),
    ]));
    const voar = folhas.map((folha, indice) => Animated.loop(Animated.sequence([
      Animated.delay(indice * 1100),
      Animated.timing(folha, { toValue: 1, duration: 3300, easing: Easing.out(Easing.quad), isInteraction: false, useNativeDriver: true }),
      Animated.timing(folha, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay((2 - indice) * 1100),
    ])));
    lapis.start();
    voar.forEach((animacao) => animacao.start());
    return () => {
      lapis.stop();
      voar.forEach((animacao) => animacao.stop());
      folhas.forEach((folha) => folha.setValue(0));
    };
  }, [reduzir, prontas, risco, folhas]);

  // Lições prontas: o Stu dá dois pulinhos.
  useEffect(() => {
    if (!prontas || reduzir !== false) return;
    const subir = Animated.timing(pulo, { toValue: -14, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const descer = Animated.timing(pulo, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true });
    const pular = Animated.sequence([subir, descer]);
    pular.start();
    return () => pular.stop();
  }, [prontas, reduzir, pulo]);

  const destinos = [{ x: 104, y: -96, giro: '24deg' }, { x: -118, y: -96, giro: '-28deg' }, { x: 70, y: -128, giro: '14deg' }];

  return (
    <View style={estudoEstilos.preparoCena} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[estudoEstilos.preparoColina, { backgroundColor: chao, borderTopColor: relevo }]} />
      <Desenho nome="arvore" largura={52} estilo={[estudoEstilos.cartaoEnfeite, { left: '9%', bottom: 16 }]} />
      <Desenho nome="flores" largura={30} estilo={[estudoEstilos.cartaoEnfeite, { right: '25%', bottom: 12 }]} />
      <Desenho nome="arbusto" largura={46} estilo={[estudoEstilos.cartaoEnfeite, { right: '7%', bottom: 16 }]} />
      {!prontas && reduzir === false && folhas.map((folha, indice) => (
        <Animated.View key={indice} style={[estudoEstilos.preparoFolha, {
          opacity: folha.interpolate({ inputRange: [0, 0.12, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: folha.interpolate({ inputRange: [0, 1], outputRange: [0, destinos[indice].x] }) },
            { translateY: folha.interpolate({ inputRange: [0, 1], outputRange: [0, destinos[indice].y] }) },
            { rotate: folha.interpolate({ inputRange: [0, 1], outputRange: ['0deg', destinos[indice].giro] }) },
            { scale: folha.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
          ],
        }]}>
          <View style={[estudoEstilos.preparoFolhaLinha, { width: 16 }]} />
          <View style={[estudoEstilos.preparoFolhaLinha, { width: 12 }]} />
          <View style={[estudoEstilos.preparoFolhaLinha, { width: 14 }]} />
        </Animated.View>
      ))}
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        style={[estudoEstilos.preparoStu, { transform: [{ translateY: prontas ? pulo : subida }] }]} />
      {!prontas && (
        <Animated.View style={[estudoEstilos.preparoLapis, {
          transform: [
            { translateX: risco.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) },
            { rotate: risco.interpolate({ inputRange: [0, 1], outputRange: ['16deg', '32deg'] }) },
          ],
        }]}>
          <View style={estudoEstilos.preparoLapisBorracha} />
          <View style={estudoEstilos.preparoLapisPonteira} />
          <View style={estudoEstilos.preparoLapisCorpo} />
          <View style={estudoEstilos.preparoLapisPonta} />
          <View style={estudoEstilos.preparoLapisGrafite} />
        </Animated.View>
      )}
    </View>
  );
}

/** Uma lição da lista: entra em sequência; enquanto a IA escreve, um brilho passa por ela; pronta, ganha o visto. */
function LinhaPreparo({ nome, indice, total, prontas }: { nome: string; indice: number; total: number; prontas: boolean }) {
  const reduzir = useMovimentoReduzido();
  const entrada = useAparecer(100 + indice * 60, 380);
  const [brilho] = useState(() => new Animated.Value(0));
  const revisao = nome.trim().toLocaleLowerCase('pt-BR').startsWith('revis');

  useEffect(() => {
    if (reduzir !== false || prontas) {
      brilho.setValue(0);
      return;
    }
    // Todas as linhas têm o mesmo ciclo; o atraso de cada uma faz o brilho descer pela lista.
    const movimento = { duration: 500, easing: Easing.inOut(Easing.ease), isInteraction: false, useNativeDriver: true };
    const ciclo = Animated.loop(Animated.sequence([
      Animated.delay(600 + indice * 200),
      Animated.timing(brilho, { ...movimento, toValue: 1 }),
      Animated.timing(brilho, { ...movimento, toValue: 0 }),
      Animated.delay(Math.max(0, total - indice - 1) * 200),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzir, prontas, brilho, indice, total]);

  return (
    <Animated.View style={[estudoEstilos.preparoLinha, prontas && estudoEstilos.preparoLinhaPronta, estiloDeEntrada(entrada)]}>
      <Animated.View pointerEvents="none" style={[estudoEstilos.preparoBrilho, { opacity: brilho }]} />
      <IconePreparo key={prontas ? 'pronta' : 'escrevendo'} pronta={prontas} atraso={indice * 45} nome={revisao ? 'revisao' : 'livro'} />
      <Text style={estudoEstilos.preparoTitulo}>{nome}</Text>
    </Animated.View>
  );
}

function IconePreparo({ pronta, atraso, nome }: { pronta: boolean; atraso: number; nome: NomeIcone }) {
  const visto = useAparecer(atraso, 420, true);
  if (!pronta) {
    return <View style={estudoEstilos.preparoIcone}><Icone nome={nome} tamanho={20} cor={cores.acao} /></View>;
  }
  return (
    <Animated.View style={[estudoEstilos.preparoIcone, estudoEstilos.preparoIconePronto, {
      transform: [
        { scale: visto.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
        { rotate: visto.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
      ],
    }]}>
      <Icone nome="check" tamanho={20} cor={cores.fundo} />
    </Animated.View>
  );
}

/** Dicas de estudo que se revezam embaixo da lista, como na geração ao vivo. */
function DicaPreparo() {
  const dicas = mensagens.geracao.dicas;
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => setIndice((atual) => (atual + 1) % dicas.length), 3600);
    return () => clearInterval(intervalo);
  }, [dicas.length]);

  return <TextoDaDica key={indice} texto={dicas[indice]} />;
}

function TextoDaDica({ texto }: { texto: string }) {
  const entrada = useAparecer(0, 420);
  return (
    <Animated.View style={[estudoEstilos.preparoDica, {
      opacity: entrada, transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
    }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Icone nome="lampada" tamanho={22} cor={cores.ouroEscuro} />
      <Text style={estudoEstilos.preparoDicaTexto}>{texto}</Text>
    </Animated.View>
  );
}

/**
 * Carregando a lição: a forma da aula (fechar e andamento no topo, título, quadro e botão), sem spinner (DESIGN §7).
 * Recebe o foco, porque o botão tocado sai da tela, e o leitor de tela ouve "Abrindo a lição".
 */
function SkeletonLicao({ texto }: { texto: string }) {
  const area = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (area.current) AccessibilityInfo.sendAccessibilityEvent(area.current, 'focus');
  }, []);

  const topo = (
    <View style={estudoEstilos.esqueletoTopo} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={estudoEstilos.esqueletoFechar} />
      <View style={estudoEstilos.esqueletoAndamento} />
    </View>
  );

  return (
    <Tela pagina="carregando-licao" topo={topo} rodape={<View importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden style={estudoEstilos.esqueletoBotao} />}>
      <View ref={area} testID="carregando-licao" accessible accessibilityLabel={texto} accessibilityLiveRegion="polite">
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
  // Ao abrir (ou recarregar), a tela vai até a lição atual; na volta de uma lição, até a liberada, como na web.
  const rolarPara = origem ? liberadas[0] ?? proximo?.no.id ?? origem : proximo?.no.id ?? null;
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
  function rolar(topo: number, base: number, sempre = false) {
    requestAnimationFrame(() => {
      const altura = visivel.current || height;
      if (!sempre && base <= altura) return;
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
      <View style={estudoEstilos.topoTrilha}>
        <View style={estudoEstilos.topoTrilhaTexto}>
          <Text style={estudoEstilos.topoTrilhaRotulo}>{mensagens.trilha.suaTrilha.toLocaleUpperCase('pt-BR')}</Text>
          <Titulo testID="titulo-plano" foco estilo={estudoEstilos.tituloTopo}>{plano.titulo}</Titulo>
        </View>
        <AnelProgresso progresso={plano.progresso} />
      </View>
      {largo && passo}
      {nos.length > 0 && !proximo && (
        <View style={estudoEstilos.concluidoCartao}>
          <View style={estudoEstilos.concluidoTitulo}>
            <Icone nome="trofeu" tamanho={22} cor={cores.alerta} />
            <Text style={[estudoEstilos.concluidoTexto, { color: cores.alerta }]}>{mensagens.trilha.concluido}</Text>
          </View>
          <Text style={estilos.textoSecundario}>{mensagens.trilha.concluidoTexto}</Text>
          {largo && <View style={estudoEstilos.acaoNaTela}>{novo}</View>}
        </View>
      )}
      {nos.length > 0 ? (
        <Caminho nos={nos} stu={falaDoStu(nos)} ocupado={ocupado} abrindo={abrindo} liberadas={liberadas} recemConcluida={etapa.concluida ?? null}
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
 * Anel de progresso do plano, como na web: enche em volta do número de lições concluídas. Sem gradiente cônico no
 * React Native, o arco é feito de duas metades recortadas, cada uma girando até a sua parte do progresso.
 */
function AnelProgresso({ progresso }: { progresso: Progresso }) {
  const tamanho = 68;
  const espessura = 8;
  const fracao = progresso.total > 0 ? Math.min(1, progresso.concluidas / progresso.total) : 0;
  const arco = (rotacao: number): ViewStyle => ({
    position: 'absolute', top: 0, width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderWidth: espessura,
    borderColor: 'transparent', borderTopColor: cores.ouroEscuro, borderRightColor: cores.ouroEscuro, transform: [{ rotate: `${rotacao}deg` }],
  });
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={mensagens.planos.contagem(progresso.concluidas, progresso.total)}
      accessibilityValue={{ min: 0, max: progresso.total, now: progresso.concluidas }}
      style={[estudoEstilos.anel, { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderWidth: espessura }]}>
      <View style={[estudoEstilos.anelMetade, { left: tamanho / 2 - espessura, width: tamanho / 2, height: tamanho, top: -espessura }]}>
        <View style={[arco(-135 + Math.min(fracao, 0.5) * 360), { left: -tamanho / 2 }]} />
      </View>
      <View style={[estudoEstilos.anelMetade, { left: -espessura, width: tamanho / 2, height: tamanho, top: -espessura }]}>
        {fracao > 0.5 && <View style={[arco(45 + (fracao - 0.5) * 360), { left: 0 }]} />}
      </View>
      <Text style={estudoEstilos.anelNumero}>{progresso.concluidas}<Text style={estudoEstilos.anelTotal}>/{progresso.total}</Text></Text>
    </View>
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
          <Text numberOfLines={2} accessibilityLabel={titulo} style={[estudoEstilos.proximoTitulo, estudoEstilos.proximoTituloRodape]}>
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

/**
 * Barra de progresso; com `comPercentual`, mostra também a porcentagem, como a faixa da trilha na web. Enche com uma
 * animação curta ao aparecer: do zero ou, com `de`, a partir do progresso anterior (na lição concluída).
 */
function BarraProgresso({ progresso, testID, naFaixa = false, comPercentual = false, de }: {
  progresso: Progresso;
  testID?: string;
  naFaixa?: boolean;
  comPercentual?: boolean;
  de?: Progresso;
}) {
  const reduzir = useMovimentoReduzido();
  const [enchimento] = useState(() => new Animated.Value(0));
  const valor = progresso.percentual ?? 0;
  const inicial = de?.percentual ?? 0;

  useEffect(() => {
    if (reduzir === null) return;
    if (reduzir) {
      enchimento.setValue(1);
      return;
    }
    const animacao = Animated.timing(enchimento, { toValue: 1, duration: 900, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animacao.start();
    return () => animacao.stop();
  }, [reduzir, enchimento]);

  if (progresso.percentual === null) {
    return <Text testID={testID} style={[estilos.legenda, naFaixa && estudoEstilos.progressoNaFaixa]}>{mensagens.planos.semProgresso}</Text>;
  }
  return (
    <View style={[estudoEstilos.progresso, naFaixa && estudoEstilos.progressoNaFaixa]}>
      <View importantForAccessibility="no" style={[estudoEstilos.trilha, naFaixa && estudoEstilos.trilhaNaFaixa]}>
        <Animated.View style={[estudoEstilos.preenchimento, {
          width: enchimento.interpolate({ inputRange: [0, 1], outputRange: [`${inicial}%`, `${valor}%`] }),
        }]}>
          <View style={estudoEstilos.brilhoBarra} />
        </Animated.View>
      </View>
      <View style={estudoEstilos.progressoLegenda}>
        <Text testID={testID} style={[estilos.legenda, estudoEstilos.progressoTexto]}>{mensagens.planos.progresso(progresso.concluidas, progresso.total)}</Text>
        {comPercentual && (
          <Text importantForAccessibility="no" accessibilityElementsHidden style={estudoEstilos.percentual}>
            {mensagens.trilha.percentual(progresso.percentual)}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Cartão de um plano em Meus planos, como na web: uma faixa do mundo (cada plano numa região), o título, o progresso e a
 * ação que cabe: começar, continuar ou rever a trilha concluída.
 */
function CartaoPlano({ plano, indice, ocupado, abrir }: { plano: PlanoResumo; indice: number; ocupado: boolean; abrir: () => void }) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0) acao = mensagens.planos.comecar;
  const { chao, relevo } = coresDaRegiao(indice);
  const enfeites = regiaoDoTrecho(indice).enfeites;
  const entrada = useAparecer(120 + indice * 80, 420);

  return (
    <Animated.View style={[estudoEstilos.cartao, estiloDeEntrada(entrada)]}>
      <View style={[estudoEstilos.cartaoCena, { backgroundColor: chao }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[estudoEstilos.cartaoColina, { backgroundColor: relevo }]} />
        <Desenho nome={enfeites[0]} largura={46} estilo={[estudoEstilos.cartaoEnfeite, { left: '8%' }]} />
        <Desenho nome={enfeites[1]} largura={26} estilo={[estudoEstilos.cartaoEnfeite, { left: '30%' }]} />
        <Desenho nome={enfeites[3]} largura={34} estilo={[estudoEstilos.cartaoEnfeite, { right: '26%' }]} />
        <Desenho nome={enfeites[2]} largura={44} estilo={[estudoEstilos.cartaoEnfeite, { right: '6%' }]} />
        {concluido && (
          <View style={estudoEstilos.cartaoSelo}>
            <Icone nome="trofeu" tamanho={16} cor={cores.sucesso} />
            <Text style={estudoEstilos.cartaoSeloTexto}>{mensagens.planos.concluido}</Text>
          </View>
        )}
      </View>
      <View style={estudoEstilos.cartaoCorpo}>
        <Text accessibilityRole="header" style={estilos.tituloBloco}>{plano.titulo}</Text>
        <BarraProgresso progresso={plano.progresso} />
        <View style={estudoEstilos.cartaoAcao}>
          <Botao rotulo={acao} testID={`abrir-plano-${indice}`} icone="seta" variante={concluido ? 'secundario' : 'primario'}
            dica={plano.titulo} desativado={ocupado} acao={abrir} />
        </View>
      </View>
    </Animated.View>
  );
}

/** Tempo em minutos e segundos, como 1:05. */
function formatarTempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Lição concluída, como na web: chuva de confete, raios girando atrás do Stu, que pula, o resumo da lição (tempo,
 * acerto e etapas), a lição liberada e o progresso do plano, que enche a partir de onde estava.
 */
function TelaConcluida({ etapa, acoes, mensagem, rodape }: {
  etapa: Extract<Etapa, { tipo: 'concluida' }>;
  acoes: ReactNode;
  mensagem: ReactNode;
  rodape: ReactNode;
}) {
  const { plano, antes, licao, liberadas, resumo } = etapa;
  const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);
  const entradaLiberada = useAparecer(1000, 420, true);

  return (
    <Tela pagina="concluida" semCabecalho rodape={rodape}>
      <Confete chuva quantidade={44} />
      <View style={estudoEstilos.conclusaoTopo}>
        <CenaConclusao />
        <Titulo testID="titulo-conclusao" foco estilo={estudoEstilos.textoCentro}>{mensagens.licao.concluida}</Titulo>
        <Text style={[estudoEstilos.comemoracao, estudoEstilos.textoCentro]}>{mensagens.licao.comemoracao}</Text>
        <Text style={[estudoEstilos.conclusaoLicao, estudoEstilos.textoCentro]}>{licao.titulo}</Text>
      </View>
      {resumo && <NumerosDaLicao resumo={resumo} />}
      {liberada && (
        <Animated.View style={[estudoEstilos.liberada, estiloDeEntrada(entradaLiberada, 12)]}>
          <Icone nome="livro" tamanho={20} cor={cores.acao} />
          <Text style={estudoEstilos.liberadaTexto}>{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</Text>
        </Animated.View>
      )}
      <View style={[estudoEstilos.bloco, estudoEstilos.blocoConclusao]}>
        <Text accessibilityRole="header" style={estilos.tituloBloco}>{mensagens.licao.progresso}</Text>
        <BarraProgresso progresso={plano.progresso} de={antes} testID="progresso-plano" comPercentual />
      </View>
      {mensagem}
    </Tela>
  );
}

/** Raios dourados que giram devagar, o Stu que pula algumas vezes e depois flutua, e o selo de concluída. */
function CenaConclusao() {
  const reduzir = useMovimentoReduzido();
  const [giro] = useState(() => new Animated.Value(0));
  const [pulo] = useState(() => new Animated.Value(0));
  const raios = useAparecer(0, 700);
  const selo = useAparecer(700, 520, true);

  useEffect(() => {
    if (reduzir !== false) return;
    const girar = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 16000, easing: Easing.linear, isInteraction: false, useNativeDriver: true }));
    const subir = (duracao: number, altura: number) => Animated.timing(pulo, { toValue: altura, duration: duracao, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const descer = (duracao: number) => Animated.timing(pulo, { toValue: 0, duration: duracao, easing: Easing.in(Easing.quad), useNativeDriver: true });
    const pular = Animated.sequence([
      Animated.delay(250), subir(240, -26), descer(240), subir(240, -26), descer(240),
      Animated.loop(Animated.sequence([subir(1300, -6), descer(1300)])),
    ]);
    girar.start();
    pular.start();
    return () => {
      girar.stop();
      pular.stop();
    };
  }, [reduzir, giro, pulo]);

  return (
    <View style={estudoEstilos.cena} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Animated.View style={[estudoEstilos.raios, {
        opacity: raios,
        transform: [
          { scale: raios.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
          { rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }]}>
        {Array.from({ length: 12 }, (_, indice) => (
          <View key={indice} style={[estudoEstilos.raio, { transform: [{ rotate: `${indice * 30}deg` }] }]} />
        ))}
      </Animated.View>
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        style={{ width: 130, height: 143, transform: [{ translateY: pulo }] }} />
      <Animated.View style={[estudoEstilos.seloConclusao, {
        opacity: selo,
        transform: [
          { scale: selo.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          { rotate: selo.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) },
        ],
      }]}>
        <Icone nome="check" tamanho={28} cor={cores.fundo} />
      </Animated.View>
    </View>
  );
}

/** Resumo da lição em três cartões que entram em sequência; o tempo conta de zero até o valor. */
function NumerosDaLicao({ resumo }: { resumo: ResumoLicao }) {
  const textos = mensagens.licao.resumo;
  const segundos = useContagem(resumo.segundos, 900, 650);
  const itens = [
    { chave: 'tempo', icone: 'relogio' as const, rotulo: textos.tempo, valor: formatarTempo(segundos), cor: cores.acao },
    { chave: 'acerto', icone: 'alvo' as const, rotulo: textos.acerto,
      valor: resumo.dePrimeira ? textos.dePrimeira : textos.tentativas(resumo.tentativas), cor: resumo.dePrimeira ? cores.sucesso : cores.alerta },
    { chave: 'etapas', icone: 'check' as const, rotulo: textos.etapas, valor: textos.etapasFeitas, cor: '#5B4BB7' },
  ];
  return (
    <View style={estudoEstilos.numeros} accessible accessibilityLabel={`${textos.titulo}: ${itens.map((item) => `${item.rotulo} ${item.chave === 'tempo' ? formatarTempo(resumo.segundos) : item.valor}`).join(', ')}`}>
      {itens.map((item, indice) => <CartaoNumero key={item.chave} {...item} ordem={indice} />)}
    </View>
  );
}

function CartaoNumero({ icone, rotulo, valor, cor, ordem }: { icone: NomeIcone; rotulo: string; valor: string; cor: string; ordem: number }) {
  const entrada = useAparecer(600 + ordem * 120, 480, true);
  return (
    <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[estudoEstilos.numero, { backgroundColor: cor, borderColor: cor }, estiloDeEntrada(entrada, 14, 0.9)]}>
      <View style={estudoEstilos.numeroRotulo}>
        <Icone nome={icone} tamanho={14} cor={cores.fundo} />
        <Text style={estudoEstilos.numeroRotuloTexto}>{rotulo.toLocaleUpperCase('pt-BR')}</Text>
      </View>
      <View style={estudoEstilos.numeroValor}>
        <Text style={estudoEstilos.numeroValorTexto}>{valor}</Text>
      </View>
    </Animated.View>
  );
}

const estudoEstilos = StyleSheet.create({
  // Pedido simplificado
  pedidoHeroi: { alignItems: 'center', gap: 6, marginBottom: 4, paddingTop: 4 },
  pedidoHalo: { width: 124, height: 124, alignItems: 'center', justifyContent: 'center', borderRadius: 62, borderWidth: 10,
    borderColor: '#FFE08A', backgroundColor: '#FFF3C4' },
  pedidoEstrela: { position: 'absolute', top: -2, right: 4, color: '#FFB703', fontSize: 24, lineHeight: 28 },
  pedidoTitulo: { fontSize: 30, lineHeight: 34, textAlign: 'center' },
  pedidoFala: { minHeight: 24, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 17, lineHeight: 24, textAlign: 'center' },
  alternar: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, paddingVertical: 14, paddingLeft: 14, paddingRight: 18,
    borderRadius: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: cores.bordaCampo },
  alternarIcone: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.nevoa },
  alternarTextos: { flex: 1, gap: 2 },
  alternarTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 21 },
  // Topo da trilha e anel de progresso
  topoTrilha: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12, paddingTop: 4 },
  topoTrilhaTexto: { flex: 1, minWidth: 0 },
  topoTrilhaRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  tituloTopo: { fontSize: 26, lineHeight: 30 },
  anel: { alignItems: 'center', justifyContent: 'center', borderColor: cores.gelo, backgroundColor: cores.fundo },
  anelMetade: { position: 'absolute', overflow: 'hidden' },
  anelNumero: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 26 },
  anelTotal: { color: cores.textoSecundario, fontSize: 13 },
  concluidoCartao: { gap: 8, marginBottom: 12, padding: 18, borderRadius: 22, borderWidth: 2, borderBottomWidth: 5,
    borderColor: '#FFE08A', backgroundColor: '#FFF8E1' },
  descobertaHero:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:20},
  descobertaSelo:{fontSize:10,fontWeight:'800',color:cores.acao,letterSpacing:1,marginBottom:8},
  descobertaMascote:{backgroundColor:'#fff1c9',borderRadius:45},
  descobertaModos:{flexDirection:'row',gap:8,marginBottom:16},
  descobertaModo:{flex:1,padding:12,gap:5,borderWidth:2,borderColor:cores.gelo,borderRadius:18},
  descobertaModoAtivo:{borderColor:cores.acao,backgroundColor:'#f0f3ff'},
  descobertaCaderno:{padding:16,backgroundColor:'#fffcf6',borderWidth:1,borderColor:'#e8dfcf',borderRadius:20},
  descobertaPassos:{flexDirection:'row',justifyContent:'space-between',marginTop:24,paddingTop:20,borderTopWidth:1,borderColor:cores.gelo},
  bloco: { gap: 12, marginTop: 16, padding: 16, borderRadius: 24, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo },
  blocoConclusao: { marginTop: 24, padding: 20 },
  progresso: { gap: 8, marginTop: 12 },
  progressoNaFaixa: { marginTop: 18 },
  progressoLegenda: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  progressoTexto: { flexShrink: 1, fontWeight: '700' },
  percentual: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 },
  trilha: { height: 10, borderRadius: 5, backgroundColor: cores.nevoa, overflow: 'hidden' },
  trilhaNaFaixa: { height: 14, borderRadius: 7 },
  preenchimento: { height: '100%', backgroundColor: cores.acao, borderRadius: 7, overflow: 'hidden' },
  brilhoBarra: { position: 'absolute', top: 3, left: 6, right: 6, height: 3, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  // Faixa do topo da trilha: cartão branco com relevo, como na web.
  faixa: { marginBottom: 12, padding: 20, borderRadius: 24, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  faixaLarga: { padding: 24 },
  tituloFaixa: { fontSize: 28, lineHeight: 32 },
  objetivoFaixa: { fontSize: 16 },
  divisao: { marginTop: 20, paddingTop: 20, borderTopWidth: 2, borderColor: cores.nevoa },
  proximo: { gap: 2 },
  proximoRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18, letterSpacing: 0.5,
    textTransform: 'uppercase' },
  proximoTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 17, lineHeight: 24 },
  proximoAcao: { alignItems: 'flex-start', marginTop: 12 },
  proximoRodape: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proximoTextos: { flex: 1, minWidth: 0 },
  proximoRotuloRodape: { fontSize: 12, lineHeight: 16 },
  proximoTituloRodape: { fontSize: 16, lineHeight: 22 },
  concluido: { gap: 8 },
  concluidoTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  concluidoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  acaoNaTela: { alignItems: 'flex-start', marginTop: 8 },
  vazio: { gap: 16, marginTop: 24 },
  liberada: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  liberadaTexto: { flex: 1, color: cores.acao, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  // Lição concluída
  conclusaoTopo: { alignItems: 'center' },
  textoCentro: { textAlign: 'center' },
  cena: { width: 190, height: 172, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 },
  raios: { position: 'absolute', left: -6, top: -12, width: 202, height: 202, alignItems: 'center', justifyContent: 'center' },
  raio: { position: 'absolute', width: 18, height: 202, borderRadius: 9, backgroundColor: 'rgba(255, 209, 102, 0.28)' },
  seloConclusao: { position: 'absolute', right: 6, bottom: 28, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: cores.fundo, backgroundColor: cores.sucessoClaro },
  comemoracao: { marginTop: 6, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  conclusaoLicao: { marginTop: 2, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  numeros: { flexDirection: 'row', gap: 8, marginTop: 24 },
  numero: { flex: 1, minWidth: 0, overflow: 'hidden', borderRadius: 16, borderWidth: 2 },
  numeroRotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6, paddingVertical: 6 },
  numeroRotuloTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 10, lineHeight: 14, letterSpacing: 0.2 },
  numeroValor: { alignItems: 'center', marginHorizontal: 2, marginBottom: 2, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 13,
    backgroundColor: cores.fundo },
  numeroValorTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  // Meus planos
  cartao: { marginTop: 16, overflow: 'hidden', borderRadius: 24, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo,
    backgroundColor: cores.fundo },
  cartaoCena: { height: 92, overflow: 'hidden' },
  cartaoColina: { position: 'absolute', left: '-10%', right: '-10%', bottom: -36, height: 72, borderTopLeftRadius: 400, borderTopRightRadius: 400 },
  cartaoEnfeite: { position: 'absolute', bottom: 10 },
  cartaoSelo: { position: 'absolute', top: 12, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  cartaoSeloTexto: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  cartaoCorpo: { gap: 4, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  cartaoAcao: { alignItems: 'flex-start', marginTop: 14 },
  // Pedido
  stuReage: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 20, marginBottom: -6 },
  balaoFala: { flexShrink: 1, maxWidth: 320, marginBottom: 22, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    borderWidth: 2, borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoFalaSeta: { position: 'absolute', left: -9, bottom: 12, width: 14, height: 14, borderLeftWidth: 2, borderBottomWidth: 2,
    borderColor: cores.gelo, borderBottomLeftRadius: 3, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  balaoFalaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  luzCampo: { position: 'absolute', left: -3, right: -3, top: 25, bottom: -3, borderRadius: 17, borderWidth: 3, borderColor: '#F0B429' },
  como: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, marginTop: 6, marginLeft: -8,
    paddingHorizontal: 8, borderRadius: 12 },
  comoPressionado: { backgroundColor: cores.nevoa },
  comoSinal: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EBFF' },
  comoSinalTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 16 },
  comoTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  aviso: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: cores.nevoa,
    color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  acoesErro: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  campoPedido: { marginTop: 20, gap: 8 },
  entradaPedido: { minHeight: 100, fontSize: 18, lineHeight: 26, backgroundColor: '#FBFCFF' },
  campoErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campoErroTexto: { flex: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  dica: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  contador: { alignSelf: 'flex-end' },
  sugestoes: { marginTop: 28, gap: 14 },
  sugestoesTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sugestoesTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 19, lineHeight: 24 },
  surpresa: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 2, borderBottomWidth: 4, borderColor: '#FFE3A3', backgroundColor: '#FFF7E0' },
  surpresaAfundada: { borderBottomWidth: 2, marginTop: 2 },
  surpresaTexto: { color: cores.ouroTexto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  areasRolagem: { marginHorizontal: -20 },
  areas: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  area: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingLeft: 10, paddingRight: 14, borderRadius: 999,
    borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  areaEscolhida: { borderColor: cores.acao, backgroundColor: '#F0F4FF' },
  areaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  exemplos: { gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingLeft: 8, paddingRight: 10, paddingVertical: 8,
    borderWidth: 2, borderBottomWidth: 4, borderColor: cores.gelo, borderRadius: 18, backgroundColor: cores.fundo },
  chipEscolhida: { borderColor: cores.acao, borderBottomColor: '#B9C7F5', backgroundColor: '#F3F6FF' },
  chipDesativada: { backgroundColor: cores.nevoa },
  chipAfundado: { borderBottomWidth: 2, marginTop: 2 },
  chipIcone: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.nevoa },
  chipTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  chipAcao: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipAcaoEscolhida: { backgroundColor: cores.acao },
  // Geração ao vivo
  contexto: { marginBottom: 8, color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18,
    letterSpacing: 0.5, textTransform: 'uppercase' },
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
  esqueletoTopo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  esqueletoFechar: { width: 44, height: 44, borderRadius: 12, backgroundColor: cores.gelo },
  esqueletoAndamento: { flex: 1, height: 14, borderRadius: 7, backgroundColor: cores.gelo },
  esqueletoTituloLicao: { width: '72%', height: 36, marginTop: 8, borderRadius: 8, backgroundColor: cores.gelo },
  esqueletoLinha: { width: '56%', height: 16, marginTop: 16, borderRadius: 8, backgroundColor: cores.gelo },
  esqueletoQuadro: { marginTop: 24, padding: 16, gap: 12, borderRadius: 20, backgroundColor: cores.nevoa },
  esqueletoBarra: { width: '100%', height: 16, borderRadius: 8, backgroundColor: cores.fundo },
  esqueletoBarraPrimeira: { width: '32%', height: 20 },
  esqueletoBarraUltima: { width: '64%' },
  esqueletoBotao: { width: '100%', height: 50, borderRadius: 16, backgroundColor: cores.gelo },
  // Escrevendo as lições (aceite)
  preparoCena: { height: 164, marginBottom: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', borderRadius: 24,
    borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: '#E4ECFF' },
  preparoColina: { position: 'absolute', left: '-12%', right: '-12%', bottom: -64, height: 124, borderTopWidth: 7,
    borderTopLeftRadius: 400, borderTopRightRadius: 400 },
  preparoStu: { width: 98, height: 108, marginBottom: 12 },
  preparoLapis: { position: 'absolute', bottom: 56, left: '50%', marginLeft: 30, width: 13, height: 63, transformOrigin: '50% 100%' },
  preparoLapisBorracha: { height: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: '#FF8FA3' },
  preparoLapisPonteira: { height: 5, backgroundColor: cores.bordaCampo },
  preparoLapisCorpo: { height: 38, backgroundColor: cores.ouro },
  preparoLapisPonta: { width: 0, height: 0, borderTopWidth: 11, borderTopColor: '#E9B880', borderLeftWidth: 6.5, borderRightWidth: 6.5,
    borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  preparoLapisGrafite: { position: 'absolute', bottom: 0, left: 4.5, width: 0, height: 0, borderTopWidth: 4, borderTopColor: cores.texto,
    borderLeftWidth: 2, borderRightWidth: 2, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  preparoFolha: { position: 'absolute', bottom: 74, left: '50%', marginLeft: -13, width: 26, height: 32, gap: 3, paddingTop: 8, paddingLeft: 5,
    borderRadius: 5, borderBottomWidth: 2, borderColor: cores.bordaCampo, backgroundColor: cores.fundo },
  preparoFolhaLinha: { height: 3, borderRadius: 2, backgroundColor: cores.gelo },
  preparoLista: { gap: 10, marginTop: 22 },
  preparoLinha: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden', paddingVertical: 9, paddingLeft: 10,
    paddingRight: 16, borderRadius: 16, borderWidth: 2, borderBottomWidth: 5, borderColor: cores.gelo, backgroundColor: cores.fundo },
  preparoLinhaPronta: { borderColor: '#BFE5D2' },
  preparoBrilho: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(56, 88, 214, 0.08)' },
  preparoIcone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.nevoa },
  preparoIconePronto: { borderBottomWidth: 3, borderColor: cores.sucesso, backgroundColor: cores.sucessoClaro },
  preparoTitulo: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 21 },
  preparoDica: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16,
    backgroundColor: cores.nevoa },
  preparoDicaTexto: { flex: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 21 },
});
