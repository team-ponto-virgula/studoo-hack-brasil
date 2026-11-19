import { MaterialParaTrilha } from './estudio-adaptativo';
import type { ProvedorIa } from '@studoo/contratos';
import { ErroStudoo, LIMITES_GERACAO, origemDemonstracao, origemLegivel, trilhaRepetida, type AutoAvaliacao, type LicaoDetalhe, type LinkCompartilhado, type Perfil, type PlanoDetalhe, type PlanoResumo, type Progresso, type PropostaPlano } from '@studoo/contratos';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Easing, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { estiloDeEntrada, useAparecer, useContagem, usePulinho } from './animacoes';
import { codigoDaFalha, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { Apresentacao } from './apresentacao';
import { Caminho, SkeletonTrilha, type Faixa } from './caminho';
import { aplicarEvento, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { Icone } from './icone';
import { Confete } from './festa';
import { guardarRascunho, tomarRascunho } from './rascunho';
import { Botao, Campo, EstadoErro, SeloSincronia, Tela, Titulo, estilos, useBalanco, useMovimentoReduzido, type AcaoDoErro, type Sincronia, caixaAlta, CartaoConfirmacao, degrauFora, degrade, quebraEquilibrada } from './interface';
import { NavegacaoContexto } from './navegacao';
import { FrasesDaLicao } from './aula-formatos';
import { Licao, temAndamento, temAndamentoNoPlano, type ResumoLicao } from './licao';
import { mensagemDeErro, mensagemDoCodigo, mensagens, textoParaRever } from './mensagens';
import { regiaoDoTrecho, type NomeDesenho } from './mundo-desenhos';
import { Desenho, coresDaRegiao } from './mundo';
import { guardarTinhaTrilhas, lerTinhaTrilhas, marcarApresentacaoVista } from './preferencias';
import { iconeDoExemplo, iconesDosTemas, todosOsExemplos, type IdTema } from './temas';
import { cores, fontes } from './tema';
import { falaDoStu, liberadasEntre, montarTrilha, proximaDoCaminho, repeteTitulo, type NomeIcone } from './trilha';
import { focoVisivel } from './foco';
import { ouvirVoltar } from './voltar';
import { AbrirPerfil, AdicionarPorLink, AvisoDaTrilha, FolhaCompartilhar, MarcaCompartilhar, TrilhaRecebida } from './social';
import { TelaEditarPerfil, TelaPerfil } from './perfil';
import { IrAoExplorar, TelaExplorar, TelaPerfilPublico, TelaPreviaTrilha, type MemoriaExplorar } from './comunidade';

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
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[]; concluida?: string; aviso?: string }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; antes: Progresso; licao: LicaoDetalhe; liberadas: string[]; resumo?: ResumoLicao }
  // Perfis e compartilhar (spec 09 e 10): a tela Perfil e a tela Editar perfil, só com `compartilhar` no config.
  | { tipo: 'perfil' }
  | { tipo: 'editarPerfil' }
  // Comunidade (spec 10, B e C2), só com `comunidade` no config: o Explorar e, dentro do app, o perfil de outra pessoa (a
  // página /p da web) e a prévia de uma trilha (a página /t); `voltar` é a tela de onde a pessoa veio. `restaurar`: o
  // Explorar volta como estava (aba, tema, lista e rolagem) quando a pessoa volta de um perfil ou de uma trilha.
  | { tipo: 'explorar'; restaurar?: boolean }
  | { tipo: 'perfilPublico'; perfilId: string; voltar: Etapa }
  | { tipo: 'previaTrilha'; codigo: string; voltar: Etapa };

type EtapaPlano = Extract<Etapa, { tipo: 'plano' }>;
type Aba = 'planos' | 'objetivo' | 'plano' | 'perfil' | 'explorar';
const ABAS: readonly string[] = ['planos', 'objetivo', 'plano', 'perfil', 'explorar'];

/** A seção da barra de baixo de uma tela: o perfil de outra pessoa e a prévia ficam na seção de onde vieram. */
function abaDe(etapa: Etapa): Etapa['tipo'] {
  return etapa.tipo === 'perfilPublico' || etapa.tipo === 'previaTrilha' ? abaDe(etapa.voltar) : etapa.tipo;
}

/** Para onde o voltar leva de um perfil ou de uma prévia: o Explorar como estava; a trilha, sem repetir a festa nem o aviso. */
function pontoDeVolta(origem: Etapa): Etapa {
  if (origem.tipo === 'explorar') return { tipo: 'explorar', restaurar: true };
  if (origem.tipo === 'plano') return { tipo: 'plano', plano: origem.plano };
  return origem;
}
type Acao = 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair' | 'apagar';
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
  const [tinhaTrilhas, setTinhaTrilhas] = useState(false);
  useEffect(() => {
    let ativo = true;
    void lerTinhaTrilhas().then((tem) => { if (ativo) setTinhaTrilhas(tem); });
    return () => { ativo = false; };
  }, []);
  // A lista chegou (ou mudou): guarda se há trilhas para o esqueleto da próxima abertura, como a web.
  useEffect(() => {
    if (planos) void guardarTinhaTrilhas(planos.length > 0);
  }, [planos]);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'planos' });
  // O pedido guardado quando a sessão terminou no meio volta para o campo (rodada 4 da web).
  const [objetivo, setObjetivo] = useState(() => tomarRascunho());
  const objetivoAtual = useRef(objetivo);
  objetivoAtual.current = objetivo;
  /** Área escolhida no fim da apresentação: o pedido abre com as ideias dela. */
  const [areaInicial, setAreaInicial] = useState<IdTema | undefined>();
  const [pendente, setPendente] = useState<Acao | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  /** Código do último erro (o texto fica em `erro`): escolhe a ação do cartão de erro, como na web (3A.1). */
  const [codigoErro, setCodigoErro] = useState<string | null>(null);
  const [geracao, setGeracao] = useState<TrilhaEmGeracao | null>(null);
  /** Código do erro da geração; o pedido mostra a mensagem e a ação que cabe (tentar de novo, ver os planos). */
  const [falhaGeracao, setFalhaGeracao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** A última busca real de progresso no servidor, para o selo de sincronia (Minhas trilhas e trilha aberta). */
  const [sincronia, setSincronia] = useState<Sincronia>({ estado: 'atualizando', em: null });
  const ultimaBusca = useRef(0);
  const emCurso = useRef(false);
  const saidaDaLicao = useRef<(() => void) | null>(null);
  const geracaoAtiva = useRef<AbortController | null>(null);
  const ocupado = pendente !== null;
  /** Perfis e compartilhar (spec 09): só com `compartilhar` no /api/auth/config, como na web. */
  const [compartilhar, setCompartilhar] = useState(false);
  /** Comunidade (spec 10, etapa B): "Quem pode ver" em três níveis; só com `comunidade` no config. */
  const [comunidade, setComunidade] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  /** A trilha da folha "Compartilhar trilha" aberta, ou null. */
  const [folha, setFolha] = useState<string | null>(null);
  const guardaSaida = useRef<((continuar: () => void) => boolean) | null>(null);
  const registrarGuarda = useCallback((guarda: ((continuar: () => void) => boolean) | null) => { guardaSaida.current = guarda; }, []);
  /** O Explorar como a pessoa deixou ao abrir um perfil ou uma trilha dele (aba, tema, lista e rolagem). */
  const memoriaExplorar = useRef<MemoriaExplorar | null>(null);
  const guardarExplorar = useCallback((memoria: MemoriaExplorar) => { memoriaExplorar.current = memoria; }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarPlanos() {
      setSincronia((anterior) => ({ estado: 'atualizando', em: anterior.em }));
      try {
        // Como na web: a lista e a configuração chegam juntas (o compartilhar decide a barra de baixo e o cabeçalho).
        const [lista, config] = await Promise.all([cliente.listarPlanos(), cliente.configuracaoAcesso().catch(() => null)]);
        // A apresentação é opcional, como na web.
        if (!ativo) return;
        const comCompartilhar = Boolean(config?.compartilhar);
        setCompartilhar(comCompartilhar);
        setComunidade(comCompartilhar && Boolean(config?.comunidade));
        if (comCompartilhar) void cliente.obterPerfil().then((dados) => { if (ativo) setPerfil(dados); }).catch(() => undefined);
        setPlanos(lista);
        marcarSincronia();
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
        if (sessaoInvalida(falha)) await expirarGuardando();
        else {
          mostrarErro(falha);
          setSincronia((anterior) => ({ estado: 'offline', em: anterior.em }));
        }
      }
    }

    void carregarPlanos();
    return () => { ativo = false; };
  }, [cliente, expirar, tentativa]);

  // Sair do estudo no meio da geração interrompe o pedido; o servidor não guarda nada.
  useEffect(() => () => geracaoAtiva.current?.abort(), []);

  /** O progresso acabou de vir do servidor: o selo diz "Atualizado agora". */
  function marcarSincronia() {
    ultimaBusca.current = Date.now();
    setSincronia({ estado: 'atualizado', em: ultimaBusca.current });
  }

  /**
   * Busca de novo o progresso quando o app volta ao primeiro plano (em Minhas trilhas ou na trilha aberta), para o
   * segundo aparelho se atualizar sozinho na demonstração. Como a web no foco da aba, com intervalo mínimo de 5 s.
   */
  async function sincronizarAgora() {
    const atual = etapaAtual.current;
    if (emCurso.current || (atual.tipo !== 'planos' && atual.tipo !== 'plano')) return;
    if (Date.now() - ultimaBusca.current < 5_000) return;
    setSincronia((anterior) => ({ estado: 'atualizando', em: anterior.em }));
    try {
      const lista = await cliente.listarPlanos();
      setPlanos(lista);
      if (atual.tipo === 'plano') {
        const plano = await cliente.obterPlano(atual.plano.id);
        setEtapa((agora) => (agora.tipo === 'plano' && agora.plano.id === plano.id ? { ...agora, plano } : agora));
      }
      marcarSincronia();
    } catch (falha) {
      if (sessaoInvalida(falha)) await expirarGuardando();
      else setSincronia((anterior) => ({ estado: 'offline', em: anterior.em }));
    }
  }
  const etapaAtual = useRef(etapa);
  etapaAtual.current = etapa;
  const sincronizar = useRef(sincronizarAgora);
  sincronizar.current = sincronizarAgora;
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => { if (estado === 'active') void sincronizar.current(); });
    return () => assinatura.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // O mesmo voltar serve ao botão do Android e ao gesto de borda do iPhone (voltar.ts); em Minhas trilhas, o gesto não começa.
    const assinatura = ouvirVoltar(() => {
      if (emCurso.current) return true;
      if (etapa.tipo === 'planos') return false;
      if (etapa.tipo === 'apresentacao') {
        void concluirApresentacao();
        return true;
      }
      if (etapa.tipo === 'geracao') {
        if (geracao?.proposta) navegar({ tipo: 'objetivo' });
        else cancelarGeracao();
      } else if (etapa.tipo === 'licao') {
        if (saidaDaLicao.current) saidaDaLicao.current();
        else void abrirPlano(etapa.plano.id, etapa.licao.id);
      }
      else if (etapa.tipo === 'concluida') navegar(voltarATrilha(etapa));
      else if (etapa.tipo === 'editarPerfil') navegar({ tipo: 'perfil' });
      else if (etapa.tipo === 'perfilPublico' || etapa.tipo === 'previaTrilha') navegar(etapa.voltar);
      else navegar({ tipo: 'planos' });
      return true;
    }, etapa.tipo !== 'planos');
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

  /** A sessão terminou: guarda o pedido em andamento antes de voltar à entrada (o aviso da entrada diz o motivo). */
  async function expirarGuardando() {
    guardarRascunho(objetivoAtual.current);
    await expirar();
  }

  /** Mostra o erro de uma falha: o texto para o cartão e o código para a ação que cabe. */
  function mostrarErro(falha: unknown) {
    setErro(mensagemDeErro(falha));
    setCodigoErro(codigoDaFalha(falha));
  }

  /**
   * A ação do cartão de erro, como na web (3A.1): com o limite de gerações (ou de pedidos do estúdio) atingido, "Ver minhas
   * trilhas"; nos outros (servidor, rede), "Tentar novamente", que limpa o erro e busca as trilhas de novo.
   */
  function acaoDoErro(codigo: string | null): AcaoDoErro {
    if (codigo === 'limite_geracoes' || codigo === 'limite_estudio') {
      return { rotulo: mensagens.pedido.verPlanos, testID: 'ver-planos-erro', acao: () => abrir({ tipo: 'planos' }) };
    }
    return {
      rotulo: mensagens.tentar, testID: 'tentar-planos', desativado: ocupado,
      acao: () => {
        setErro(null);
        setTentativa((anterior) => anterior + 1);
      },
    };
  }

  /** Troca de etapa. Sair da geração ao vivo cancela o pedido em andamento; cada tela nova começa do topo. */
  function navegar(destino: Etapa) {
    // Saindo de "Editar perfil" com alteração não salva: a tela pergunta antes (a mesma confirmação do Voltar), como na web.
    if (destino.tipo !== 'editarPerfil' && guardaSaida.current?.(() => { guardaSaida.current = null; navegar(destino); })) return;
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
      if (sessaoInvalida(falha)) await expirarGuardando();
      else mostrarErro(falha);
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
    // Toda trilha que chega aqui veio agora do servidor (abrir, aceitar, concluir).
    marcarSincronia();
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
        await expirarGuardando();
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
    setCodigoErro(licao.codigo);
  }

  /**
   * Confirmações (sair e apagar) no cartão da web (.modal-cartao), com "Cancelar" e a confirmação, no lugar da caixa do
   * sistema (levantamento de paridade, G7). O voltar do aparelho cancela.
   */
  const [confirmacao, setConfirmacao] = useState<{ mensagem: string; confirmarRotulo: string; destrutivo?: boolean; aoConfirmar: () => void } | null>(null);

  /** Sair fica no alto, onde muita gente procura "voltar": pergunta antes de encerrar a sessão. Como na web. */
  function pedirParaSair() {
    setConfirmacao({ mensagem: mensagens.sairPergunta, confirmarRotulo: mensagens.sair, aoConfirmar: () => void executar('sair', sair) });
  }

  /** Apaga uma trilha depois da confirmação no cartão (com o progresso, duas trilhas de mesmo nome não se confundem). */
  function pedirParaApagar(plano: PlanoResumo) {
    setConfirmacao({
      mensagem: `${mensagens.planos.apagarPergunta(plano.titulo, mensagens.planos.contagem(plano.progresso.concluidas, plano.progresso.total))}${plano.link ? ` ${mensagens.compartilhar.apagarAviso}` : ''}`,
      confirmarRotulo: mensagens.planos.apagar, destrutivo: true, aoConfirmar: () => void apagarPlano(plano),
    });
  }

  async function apagarPlano(plano: PlanoResumo) {
    const resultado = await executar('apagar', () => cliente.apagarPlano(plano.id));
    if (!resultado.ok) return;
    setPlanos((anteriores) => anteriores?.filter((item) => item.id !== plano.id) ?? null);
    anunciar(mensagens.planos.apagada(plano.titulo));
  }

  async function abrirPlano(id: string, origem?: string, aviso?: string) {
    const resultado = await executar('plano', () => cliente.obterPlano(id));
    if (!resultado.ok) return;
    atualizarPlano(resultado.dados);
    navegar({ tipo: 'plano', plano: resultado.dados, origem, ...(aviso ? { aviso } : {}) });
  }

  /** O link de uma trilha mudou (criado, alterado ou encerrado): a lista e o mapa mostram o selo certo. Como na web. */
  function mudarLink(planoId: string, link: LinkCompartilhado | null) {
    const marca = link ? { codigo: link.codigo, noPerfil: link.noPerfil } : undefined;
    setPlanos((anteriores) => anteriores?.map((item) => (item.id === planoId ? { ...item, link: marca } : item)) ?? null);
    setEtapa((atual) => ('plano' in atual && atual.plano.id === planoId ? { ...atual, plano: { ...atual.plano, link: marca } } : atual));
  }

  /** Trilha adicionada pelo link (ou já tinha): abre o mapa dela, com o aviso de quem compartilhou. Como na web. */
  async function aoAdicionarPorLink(planoId: string, nomeDono: string, jaTinha: boolean) {
    try {
      setPlanos(await cliente.listarPlanos());
    } catch { /* A lista se atualiza na próxima sincronia. */ }
    void abrirPlano(planoId, undefined, jaTinha ? undefined : mensagens.compartilhar.adicionada(nomeDono));
  }
  const abrirFolha = compartilhar ? (planoId: string) => setFolha(planoId) : undefined;

  /** O perfil de outra pessoa dentro do app (o /p da web): pela foto e nome do cartão, "Ver o perfil de" e "Compartilhada por". */
  function abrirPerfilPublico(perfilId: string) {
    abrir({ tipo: 'perfilPublico', perfilId, voltar: pontoDeVolta(etapaAtual.current) });
  }
  /** A prévia de uma trilha dentro do app (o /t da web): pelo título do cartão. */
  function abrirPrevia(codigo: string) {
    abrir({ tipo: 'previaTrilha', codigo, voltar: pontoDeVolta(etapaAtual.current) });
  }

  /** Abre a lição guardando qual nó está abrindo, para o caminho e o próximo passo mostrarem "Abrindo…". */
  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    if (emCurso.current) return;
    setAbrindo(id);
    const resultado = await executar('abrir', () => cliente.obterLicao(id));
    setAbrindo(null);
    if (resultado.ok) navegar({ tipo: 'licao', plano, licao: resultado.dados });
  }

  async function concluir(plano: PlanoDetalhe, licao: LicaoDetalhe, comprovante: string, resumo?: ResumoLicao, pratica?: AutoAvaliacao) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante, pratica,
      resumo && { segundos: resumo.segundos, acertosDePrimeira: resumo.acertosDePrimeira, exercicios: resumo.exercicios }));
    if (resultado.ok) {
      const atualizado = resultado.dados.plano;
      atualizarPlano(atualizado);
      navegar({ tipo: 'concluida', plano: atualizado, antes: plano.progresso, licao, liberadas: liberadasEntre(plano, atualizado), resumo });
      return true;
    }
    // Como na web: sem a conclusão registrada (rede, confirmação expirada), a aula guarda o andamento e volta ao último
    // exercício; antes, uma falha de rede contava como sucesso e o andamento era apagado sem a lição ter sido concluída.
    return false;
  }

  // Como a web: a barra de baixo nas telas de seção com trilhas salvas e, com a comunidade, sempre no Explorar (e no perfil ou
  // na prévia abertos dele).
  const aba = abaDe(etapa);
  const comNavegacaoAgora = planos !== null && !pendente && ((planos.length > 0 && ABAS.includes(aba)) || (comunidade && aba === 'explorar'));
  const telaDaComunidade = ['explorar', 'perfilPublico', 'previaTrilha'].includes(etapa.tipo);
  const acoes = (
    <>
      {etapa.tipo !== 'planos' && !['objetivo', 'plano', 'perfil'].includes(etapa.tipo) && !(telaDaComunidade && comNavegacaoAgora) && <Botao rotulo={mensagens.planos.titulo} testID="meus-planos" compacto variante="texto"
        desativado={ocupado} acao={() => abrir({ tipo: 'planos' })} />}
      {/* Com o compartilhar (como a web): "Sair" fica no Perfil; no alto, "Perfil" só onde não há a barra de baixo. */}
      {compartilhar
        ? !comNavegacaoAgora && <Botao rotulo={mensagens.perfil.navegacao} testID="perfil-cabecalho" compacto variante="texto" desativado={ocupado}
            acao={() => abrir({ tipo: 'perfil' })} />
        : <Botao rotulo={mensagens.sair} testID="sair" compacto variante="texto" desativado={ocupado} acao={pedirParaSair} />}
    </>
  );
  // O erro de Minhas trilhas (sem rede, sessão, servidor) recebe o foco do leitor de tela, como nas outras telas.
  const mensagem = erro && <EstadoErro mensagem={erro} foco acao={acaoDoErro(codigoErro)} />;

  // Como a web (studoo.tinhaTrilhas): na primeira carga, as abas só aparecem no esqueleto se a conta tinha trilhas.
  const carregandoInicio = !planos && !erro;
  const comNavegacao = (carregandoInicio && tinhaTrilhas) || comNavegacaoAgora;
  return <NavegacaoContexto.Provider value={comNavegacao ? {
    atual: aba as Aba, ocupado,
    planos: () => abrir({ tipo: 'planos' }), criar: () => abrir({ tipo: 'objetivo' }),
    explorar: comunidade ? () => abrir({ tipo: 'explorar' }) : undefined,
    perfil: compartilhar ? () => abrir({ tipo: 'perfil' }) : undefined,
  } : null}>
    {/* Os nomes de quem compartilhou (marcas, prévia, cartões) abrem o perfil dela dentro do app, como os links /p da web. */}
    <AbrirPerfil.Provider value={compartilhar ? abrirPerfilPublico : null}>
      {renderizarTela()}
    </AbrirPerfil.Provider>
    {folha && (
      <FolhaCompartilhar cliente={cliente} planoId={folha} visitante={Boolean(perfil?.visitante)} comunidade={comunidade}
        aoFechar={() => setFolha(null)} aoMudarLink={mudarLink} aoMudarPerfil={setPerfil} />
    )}
    {confirmacao && (
      <CartaoConfirmacao mensagem={confirmacao.mensagem} confirmarRotulo={confirmacao.confirmarRotulo} destrutivo={confirmacao.destrutivo}
        ocupado={ocupado} aoCancelar={() => setConfirmacao(null)}
        aoConfirmar={() => { const acao = confirmacao.aoConfirmar; setConfirmacao(null); acao(); }} />
    )}
  </NavegacaoContexto.Provider>;

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
        voltar={() => void abrirPlano(etapa.plano.id, etapa.licao.id)} saida={saidaDaLicao}
        avaliar={async (resposta, indice) => {
          const resultado = await executar('avaliar', () => cliente.avaliarLicao(etapa.licao.id, resposta, indice));
          return resultado.ok ? resultado.dados : null;
        }}
        concluir={(comprovante, resumo, pratica) => concluir(etapa.plano, etapa.licao, comprovante, resumo, pratica)} />;
    }

    if (etapa.tipo === 'concluida') {
      const proxima = proximaDoCaminho(etapa.plano);
      const { concluidas, total } = etapa.plano.progresso;
      return (
        <TelaConcluida etapa={etapa} acoes={acoes} mensagem={mensagem} ocupado={ocupado}
          compartilhar={abrirFolha && !etapa.plano.recebida ? () => abrirFolha(etapa.plano.id) : undefined} rodape={<>
          {/* Com uma próxima lição, seguir é a ação principal; voltar à trilha fica como alternativa. */}
          {total > 0 && concluidas === total && <Botao rotulo={mensagens.licao.novoAssunto} testID="novo-assunto" variante="secundario"
            desativado={ocupado} acao={() => abrir({ tipo: 'objetivo' })} />}
          <Botao rotulo={mensagens.licao.voltar} testID="voltar-plano" variante={proxima ? 'secundario' : 'primario'} desativado={ocupado}
            acao={() => abrir(voltarATrilha(etapa))} />
          {proxima && <Botao rotulo={mensagens.licao.avancar} testID="proxima-licao" desativado={ocupado}
            acao={() => void abrirLicao(etapa.plano, proxima)} />}
        </>} />
      );
    }

    if (etapa.tipo === 'plano') {
      return <TelaPlano etapa={etapa} acoes={acoes} erro={erro} acaoErro={erro ? acaoDoErro(codigoErro) : undefined} ocupado={ocupado} abrindo={abrindo} sincronia={sincronia}
        abrirLicao={(id) => void abrirLicao(etapa.plano, id)} novoPlano={() => abrir({ tipo: 'objetivo' })}
        compartilhar={abrirFolha && !etapa.plano.recebida ? () => abrirFolha(etapa.plano.id) : undefined} />;
    }

    if (etapa.tipo === 'geracao' && geracao) {
      return <GeracaoAoVivo geracao={geracao} erro={erro} acaoErro={erro ? acaoDoErro(codigoErro) : undefined} ocupado={ocupado} acoes={acoes} cancelar={cancelarGeracao}
        comecar={(proposta) => void comecar(proposta)} ajustar={() => abrir({ tipo: 'objetivo' })}
        // Como a web 4.2: a mesma regra do contrato (o assunto antes dos dois-pontos, sem acento), em vez do "fraç" fixo.
        existente={geracao.proposta ? planos?.find((plano) => trilhaRepetida(plano.titulo, geracao.proposta?.titulo ?? '')) : undefined}
        abrirExistente={(id) => void abrirPlano(id)} />;
    }

    if (etapa.tipo === 'perfil') {
      return <TelaPerfil cliente={cliente} perfil={perfil} comunidade={comunidade} acoes={acoes} desativado={ocupado}
        aoMudarPerfil={setPerfil} aoMudarLink={mudarLink} abrirPlano={(id) => void abrirPlano(id)}
        editar={() => abrir({ tipo: 'editarPerfil' })} sair={pedirParaSair}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfilPublico} />;
    }

    if (etapa.tipo === 'explorar' && comunidade) {
      return <TelaExplorar cliente={cliente} acoesTela={acoes} memoria={etapa.restaurar ? memoriaExplorar.current : null} guardar={guardarExplorar}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} aoAbrir={(id) => void abrirPlano(id)}
        abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfilPublico} irParaTrilhas={() => abrir({ tipo: 'planos' })} />;
    }

    if (etapa.tipo === 'perfilPublico') {
      return <TelaPerfilPublico key={etapa.perfilId} cliente={cliente} perfilId={etapa.perfilId} acoesTela={acoes}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} aoAbrir={(id) => void abrirPlano(id)}
        abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfilPublico} criarTrilha={() => abrir({ tipo: 'objetivo' })} />;
    }

    if (etapa.tipo === 'previaTrilha') {
      return <TelaPreviaTrilha key={etapa.codigo} cliente={cliente} codigo={etapa.codigo} acoesTela={acoes}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} aoAbrir={(id) => void abrirPlano(id)}
        criarTrilha={() => abrir({ tipo: 'objetivo' })} />;
    }

    if (etapa.tipo === 'editarPerfil' && perfil && !perfil.visitante) {
      return <TelaEditarPerfil cliente={cliente} perfil={perfil} acoes={acoes} aoMudarPerfil={setPerfil}
        voltar={() => navegar({ tipo: 'perfil' })} registrarGuarda={registrarGuarda} />;
    }

    if (etapa.tipo === 'objetivo' || etapa.tipo === 'geracao' || planos?.length === 0) {
      return <Pedido cliente={cliente} onProposta={p => { navegar({ tipo: 'geracao' }); setGeracao({ objetivo: p.objetivo, titulo: p.titulo, fluxos: p.fluxos.map(f => ({ titulo: f.titulo, licoes: f.licoes.map(l => l.titulo) })), proposta: p }); }} objetivo={objetivo} ocupado={ocupado}
        aviso={etapa.tipo === 'planos' && planos?.length === 0 ? mensagens.planos.semTrilhas : aviso} falha={falhaGeracao} erro={erro} acaoErro={erro ? acaoDoErro(codigoErro) : undefined} areaInicial={areaInicial}
        temPlanos={(planos?.length ?? 0) > 0} acoes={acoes} aoMudar={atualizarObjetivo} gerar={(texto) => void gerar(texto)}
        verPlanos={() => abrir({ tipo: 'planos' })} comoFunciona={() => abrir({ tipo: 'apresentacao', primeiraVez: false })}
        porLink={compartilhar ? <>
          <AdicionarPorLink cliente={cliente} ocupado={ocupado} aoAdicionar={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)}
            abrirPlano={(id) => void abrirPlano(id)} />
          {/* Com a comunidade: "Ver trilhas da comunidade", logo abaixo, como na web. */}
          {comunidade && <IrAoExplorar ocupado={ocupado} acao={() => abrir({ tipo: 'explorar' })} />}
        </> : undefined} />;
    }

    // Como na web (rodada 4F): enquanto as trilhas chegam, o esqueleto do mapa (quem tem trilha cai no mapa logo depois).
    if (!planos && !erro) return <Tela pagina="carregando-trilha" acoes={acoes}><SkeletonTrilha /></Tela>;

    return (
      <Tela pagina="planos" acoes={acoes} abaixoDoLogo={planos && planos.length > 0 ? <SeloSincronia sincronia={sincronia} /> : undefined}
        estiloConteudo={estudoEstilos.fimQuarenta}>
        {/* Como na web: o aviso de erro (sem rede, sessão) vem no alto, antes do título, sem margem em cima e a 16 dele. */}
        {erro && <EstadoErro mensagem={erro} foco acao={acaoDoErro(codigoErro)} estilo={estudoEstilos.erroNaLista} />}
        <Titulo testID="titulo-planos" foco>{mensagens.planos.titulo}</Titulo>
        {/* .painel--planos: grade com vão de 12 (a introdução não tem margem própria ali). */}
        <Text style={[estilos.introducao, estudoEstilos.introducaoPlanos]}>{mensagens.planos.subtitulo}</Text>
        {planos && planos.length > 0 && (() => {
          // Como na web: um destaque só ("Seu próximo passo", com o único botão primário) e as outras trilhas embaixo.
          const destaque = planoInicial(planos);
          const restantes = planos.filter((plano) => plano.id !== destaque?.id);
          return (
            <>
              {destaque && (
                <CartaoDestaque plano={destaque} indice={planos.indexOf(destaque)} sincronia={sincronia} ocupado={ocupado}
                  abrir={() => void abrirPlano(destaque.id)} apagar={() => pedirParaApagar(destaque)}
                  compartilhar={abrirFolha && !destaque.recebida ? () => abrirFolha(destaque.id) : undefined} />
              )}
              {restantes.length > 0 && (
                <Text accessibilityRole="header" style={[estudoEstilos.secaoTitulo, caixaAlta]}>{mensagens.planos.outrasTrilhas}</Text>
              )}
              {/* .planos-ativos: 20 em cima (mais o vão de 12 da página) e 16 entre os cartões. */}
              {restantes.length > 0 && <View style={estudoEstilos.outrasTrilhas}>
              {restantes.map((plano) => (
                <CartaoPlano key={plano.id} plano={plano} indice={planos.indexOf(plano)} ocupado={ocupado} secundario
                  abrir={() => void abrirPlano(plano.id)} apagar={() => pedirParaApagar(plano)}
                  compartilhar={abrirFolha && !plano.recebida ? () => abrirFolha(plano.id) : undefined} />
              ))}
              </View>}
            </>
          );
        })()}
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
function Pedido({ cliente, onProposta, objetivo, ocupado, aviso, falha, erro, acaoErro, temPlanos, areaInicial, acoes, aoMudar, gerar, verPlanos, comoFunciona, porLink }: {
  /** "Adicionar por link" (com o compartilhar), antes de "Ver como funciona", como na web. */
  porLink?: ReactNode;
  cliente: ClienteNativo;
  onProposta: (p: PropostaPlano) => void;
  objetivo: string;
  ocupado: boolean;
  aviso: string | null;
  falha: string | null;
  erro: string | null;
  /** A ação do cartão de um erro geral (rede, servidor, limite), escolhida pelo código. */
  acaoErro?: AcaoDoErro;
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
  /** Provedor de IA do servidor: o aviso de privacidade do material diz quem lê (OpenAI, DeepSeek ou ninguém). */
  const [ia, setIa] = useState<ProvedorIa | undefined>();
  useEffect(() => {
    let ativo = true;
    void cliente.configuracaoAcesso().then((configuracao) => { if (ativo) setIa(configuracao.ia); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [cliente]);
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
  // Como na web (3A.2): com o limite atingido ou outro erro da geração, o Stu não contradiz o aviso do cartão.
  if (falha === 'limite_geracoes' || falha === 'limite_estudio') fala = mensagens.pedido.falas.limite;
  else if (falha) fala = mensagens.pedido.falas.erro;
  else if (escolhida !== null && escolhida === texto) fala = mensagens.pedido.falas.escolhida;
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
    <Tela pagina="objetivo" acoes={acoes} estiloConteudo={estudoEstilos.fimQuarenta}>
      <View style={estudoEstilos.pedidoHeroi}>
        <View style={estudoEstilos.pedidoStu} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <View style={estudoEstilos.pedidoHalo}><View style={estudoEstilos.pedidoHaloMiolo} /></View>
          <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
            style={{ width: 96, height: 110, transform: [{ translateY: balancoInicio }] }} />
          <Text style={[estudoEstilos.pedidoEstrela, { fontFamily: fontes.corpo }]}>✦</Text>
        </View>
        <Titulo testID="titulo-objetivo" foco={focarTitulo} equilibrado estilo={estudoEstilos.pedidoTitulo}>
          {modo === 'material' ? mensagens.inicio.materialTitulo : mensagens.pedido.titulo}
        </Titulo>
        <Text accessibilityLiveRegion="polite" style={estudoEstilos.pedidoFala}>{modo === 'material' ? mensagens.inicio.materialTexto : fala}</Text>
      </View>
      {aviso && <Text style={estudoEstilos.aviso}>{aviso}</Text>}
      {erro && <EstadoErro mensagem={erro} foco acao={acaoErro} />}
      {/* Como na web (3A.1): um cartão só, com o Stu e a ação que cabe; o que a pessoa escreveu continua no campo. */}
      {falha && <EstadoErro mensagem={mensagemDoCodigo(falha)} testID="erro-geracao" foco
        acao={mostrarVerPlanos ? { rotulo: mensagens.pedido.verPlanos, testID: 'ver-planos', desativado: ocupado, acao: verPlanos }
          : repetivel ? { rotulo: mensagens.tentar, testID: 'tentar-geracao', desativado: ocupado, acao: tentar } : undefined} />}
      <View style={modo !== 'material' ? { display: 'none' } : estudoEstilos.materialNoPedido}><MaterialParaTrilha cliente={cliente} objetivo={objetivo} onProposta={onProposta} ia={ia} mostrarCabeca={false} /></View>
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
        {/* Como na web: o botão vem logo abaixo do campo, no fluxo da página, com a seta e face de 56 px. */}
        <Botao rotulo={mensagens.inicio.criar} testID="gerar-trilha" icone="seta" fonte={17} estilo={estudoEstilos.criar}
          desativado={ocupado || !texto} acao={tentar} />
      </View>
      {/* Como na web (rodada 1): a entrada do material próprio, 1º passo da demonstração, fica logo abaixo do campo, à vista
          sem rolar, com o selo "Seu material". */}
      {/* .pedido-alternar (a regra que vale no fim de pedido.css): borda lisa #c3cdf2, degradê de 135° e degrau de 3 por fora. */}
      <Pressable testID="alternar-modo" accessibilityRole="button" accessibilityState={{ disabled: ocupado }} disabled={ocupado}
        onPress={() => setModo(modo === 'ideia' ? 'material' : 'ideia')}
        style={({ pressed }) => [degrauFora(3, 22, cores.gelo), estudoEstilos.alternarFora, pressed && { opacity: 0.85 }]}>
        <View style={[estudoEstilos.alternar, degrade('linear-gradient(135deg, #f4f7ff 0%, #ffffff 70%)')]}>
        <View style={estudoEstilos.alternarIcone} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icone nome={modo === 'ideia' ? 'livro' : 'lampada'} tamanho={22} cor={cores.acao} />
        </View>
        <View style={estudoEstilos.alternarTextos}>
          <View style={estudoEstilos.alternarLinha}>
            <Text style={estudoEstilos.alternarTitulo}>{modo === 'ideia' ? mensagens.inicio.material : mensagens.inicio.voltarIdeia}</Text>
            {modo === 'ideia' && <Text style={estudoEstilos.alternarSelo}>{mensagens.pedido.seuMaterial}</Text>}
          </View>
          <Text style={estudoEstilos.alternarDica}>{modo === 'ideia' ? mensagens.inicio.materialDica : mensagens.inicio.ideiaDica}</Text>
        </View>
        <Icone nome="seta" tamanho={20} cor={cores.textoSecundario} />
        </View>
      </Pressable>
      <View style={modo !== 'ideia' && { display: 'none' }}>
        {/* Como .pedido-ideias da web: o nome do grupo é só para o leitor de tela; as fichas quebram linha, centralizadas. */}
        <View key={tema.id} role="group" accessibilityLabel={mensagens.pedido.sugestoes} style={estudoEstilos.sugestoes}>
            <Surpresa desativada={ocupado} acao={surpreender} />
            {tema.exemplos.map((exemplo, indice) => (
              <Sugestao key={exemplo} texto={exemplo} icone={iconeDoExemplo(tema, exemplo)} testID={`sugestao-${indice}`} ordem={indice}
                escolhida={texto === exemplo} desativada={ocupado} acao={() => sugerir(exemplo)} />
            ))}
        </View>
      </View>
      {porLink}
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
      {/* .pedido-novo .pedido-campo textarea: borda de 3 que fecha em volta e o degrau de 5 por fora (0 5px 0 gelo; #b9c7f5 com
          o foco). O texto de exemplo vem em #9aa3bf e 600 (o texto digitado é 700): vazio, só o exemplo aparece. */}
      <View style={degrauFora(5, 24, focado ? '#B9C7F5' : cores.gelo)}>
        <Campo campoRef={campoRef} testID="objetivo-estudo" rotulo={mensagens.inicio.campo} rotuloOculto value={valor}
          onChangeText={aoMudar} editable={editavel} multiline maxLength={LIMITES_GERACAO.objetivoMax} placeholderTextColor="#9AA3BF"
          placeholder={mensagens.inicio.exemplo} accessibilityHint={dica}
          style={[estudoEstilos.entradaPedido, focado && estudoEstilos.entradaPedidoFocada, !valor && estudoEstilos.entradaPedidoVazia]}
          onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)} />
      </View>
      <Animated.View pointerEvents="none" style={[estudoEstilos.luzCampo, { opacity: luz }]} />
    </View>
  );
}

/** "Como funciona?": reabre a apresentação. */
function LinkComoFunciona({ desativado, acao }: { desativado: boolean; acao: () => void }) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID="como-funciona" accessibilityRole="button" accessibilityState={{ disabled: desativado }} disabled={desativado}
      onPress={acao} onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
      style={({ pressed }) => [estudoEstilos.como, pressed && estudoEstilos.comoPressionado, focado && estilos.foco]}>
      <Text style={[estudoEstilos.comoTexto, desativado && { color: cores.textoSecundario }]}>{mensagens.inicio.saberMais}</Text>
    </Pressable>
  );
}

/** "Surpreenda-me": sorteia uma ideia de qualquer área. */
function Surpresa({ desativada, acao }: { desativada: boolean; acao: () => void }) {
  const [focado, setFocado] = useState(false);
  return (
    <Pressable testID="surpreenda-me" accessibilityRole="button" accessibilityState={{ disabled: desativada }} disabled={desativada}
      onPress={acao} onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
      style={({ pressed }) => [degrauFora(3, 999, '#FFE08A', pressed), focado && estilos.foco]}>
      <View style={[estudoEstilos.surpresa, desativada && estudoEstilos.chipDesativada]}>
        {/* .pedido-ideia .desenho: 24 px. */}
        <Desenho nome="estrela" largura={24} />
        <Text style={[estudoEstilos.surpresaTexto, desativada && { color: cores.textoSecundario }]}>{mensagens.pedido.surpresa}</Text>
      </View>
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
      disabled={desativada} onPress={acao} onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
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
        disabled={desativada} onPress={acao} onFocus={() => setFocado(focoVisivel())} onBlur={() => setFocado(false)}
        // Como .pedido-ideia[aria-pressed='true']: a ideia escolhida fica com a borda, o texto e o fundo azuis.
        style={({ pressed }) => [degrauFora(3, 999, escolhida ? '#B9C7F5' : cores.gelo, pressed), focado && estilos.foco]}>
        <View style={[estudoEstilos.chip, escolhida && estudoEstilos.chipEscolhida, desativada && estudoEstilos.chipDesativada]}>
          <Animated.View style={{ transform: [{ scale: pulo }] }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Desenho nome={icone} largura={24} />
          </Animated.View>
          <Text numberOfLines={1} style={[estudoEstilos.chipTexto, escolhida && { color: cores.acao }, desativada && { color: cores.textoSecundario }]}>{texto}</Text>
        </View>
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
function GeracaoAoVivo({ geracao, erro, acaoErro, ocupado, acoes, cancelar, comecar, ajustar, existente, abrirExistente }: {
  geracao: TrilhaEmGeracao;
  erro: string | null;
  acaoErro?: AcaoDoErro;
  ocupado: boolean;
  acoes: ReactNode;
  cancelar: () => void;
  comecar: (proposta: PropostaPlano) => void;
  ajustar: () => void;
  /** Como na web: uma trilha com o mesmo nome; a tela avisa e oferece abrir a que já existe. */
  existente?: PlanoResumo;
  abrirExistente: (id: string) => void;
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
        {/* .geracao-acoes[data-pronta] > .botao: lado a lado, com 12 nos lados (em 360, "Ajustar pedido" cabe numa linha). */}
        <Botao rotulo={proposta ? mensagens.geracao.ajustar : mensagens.geracao.cancelar} testID="voltar-pedido" variante="secundario"
          desativado={ocupado} acao={proposta ? ajustar : cancelar} estilo={dividir ? estudoEstilos.botaoDividido : undefined} />
      </View>
      {!dividir && (
        <View accessible accessibilityLabel={`${rotulo}. ${contagem}`} style={estudoEstilos.situacao}>
          <Text style={estudoEstilos.situacaoRotulo}>{rotulo}</Text>
          <Text style={estudoEstilos.situacaoContagem}>{contagem}</Text>
        </View>
      )}
      {proposta && (
        <View style={dividir ? estudoEstilos.metade : null}>
          <Botao rotulo={mensagens.geracao.comecar} testID="comecar-trilha" desativado={ocupado} acao={() => comecar(proposta)}
            estilo={dividir ? estudoEstilos.botaoDividido : undefined} />
        </View>
      )}
    </View>
  );

  return (
    <Tela pagina="geracao" acoes={acoes} rodape={rodape} rolagem={rolagem} estiloConteudo={estudoEstilos.fimSemRespiro}
      aoMedir={(altura) => { visivel.current = altura; }} aoRolar={(y) => { rolado.current = y; }}>
      {erro && <EstadoErro mensagem={erro} foco acao={acaoErro} />}
      <View style={[estudoEstilos.faixa, largo && estudoEstilos.faixaLarga]}>
        <Text style={estudoEstilos.contexto}>{mensagens.geracao.contexto}</Text>
        <TituloGeracao titulo={titulo} foco={focarTitulo} reduzir={reduzir} />
        {/* Na faixa ficam três linhas do pedido; o leitor de tela lê o texto inteiro. */}
        {titulo !== null && !repeteTitulo(titulo, geracao.objetivo) && (
          <Text numberOfLines={3} accessibilityLabel={geracao.objetivo} style={[estilos.introducao, estudoEstilos.objetivoFaixa]}>
            {geracao.objetivo}
          </Text>
        )}
        {/* Como na web: quem montou a trilha (a IA ou o modo demonstração); enquanto não se sabe, um texto neutro. */}
        <Text style={estudoEstilos.geracaoIa}>
          {!proposta ? mensagens.geracao.montadaDoPedido : origemDemonstracao(proposta.origem) ? mensagens.geracao.demonstracao : mensagens.geracao.ia}
        </Text>
        {proposta && existente && (
          <View testID="trilha-repetida" accessibilityLiveRegion="polite" style={estudoEstilos.repetida}>
            <Text style={estudoEstilos.repetidaTexto}>{mensagens.geracao.repetida(existente.titulo)}</Text>
            <Botao rotulo={mensagens.geracao.abrirExistente} testID="abrir-existente" variante="secundario" estilo={{ alignSelf: 'flex-start' }} desativado={ocupado}
              acao={() => abrirExistente(existente.id)} />
          </View>
        )}
        {/* A origem só aparece quando acrescenta algo: na trilha pronta, o aviso acima já diz de onde ela vem. */}
        {proposta
          ? !origemDemonstracao(proposta.origem) && <Text style={estudoEstilos.geracaoOrigem}>{mensagens.geracao.origem(origemLegivel(proposta.origem))}</Text>
          : <View importantForAccessibility="no" accessibilityElementsHidden style={estudoEstilos.esqueletoOrigem} />}
      </View>
      <Caminho nos={nos} stu={proposta ? mensagens.geracao.stuPronta : mensagens.geracao.stuMontando} dicas={mensagens.geracao.dicas} extraChegada={44}
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
    <Animated.Text textBreakStrategy="balanced" style={[estilos.titulo, quebraEquilibrada, estudoEstilos.tituloFaixa, entrada && {
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
    <Animated.View style={[estudoEstilos.preparoIcone, {
      transform: [
        { scale: visto.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
        { rotate: visto.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) },
      ],
    }]}>
      <Icone nome={nome} tamanho={20} cor={cores.acao} />
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
    <Tela pagina="carregando-licao" topo={topo} semLinha rodape={<View importantForAccessibility="no-hide-descendants"
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
function TelaPlano({ etapa, acoes, erro, acaoErro, ocupado, abrindo, abrirLicao, novoPlano, sincronia, compartilhar }: {
  /** Abre a folha "Compartilhar trilha" (só na trilha da própria pessoa, com o compartilhar ligado). */
  compartilhar?: () => void;
  /** O selo da tela: a trilha aberta também se atualiza quando o app volta ao primeiro plano. */
  sincronia: Sincronia;
  etapa: EtapaPlano;
  acoes: ReactNode;
  erro: string | null;
  acaoErro?: AcaoDoErro;
  ocupado: boolean;
  abrindo: string | null;
  abrirLicao: (id: string) => void;
  novoPlano: () => void;
}) {
  const { plano, origem, liberadas = [] } = etapa;
  const { nos, proximo } = useMemo(() => montarTrilha(plano, temAndamento), [plano]);
  // Ao abrir (ou recarregar), a tela vai até a lição atual; na volta de uma lição, até a liberada, como na web.
  const rolarPara = origem ? liberadas[0] ?? proximo?.no.id ?? origem : proximo?.no.id ?? null;
  const { width, height } = useWindowDimensions();
  const largo = width >= 768;
  const reduzir = useMovimentoReduzido();
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const visivel = useRef(0);
  // Com o nó atual (e o balão "Começar") à vista, o cartão fixo sai: uma ação só por vez, como na web.
  const atualNaRolagem = useRef<{ topo: number; base: number } | null>(null);
  const alturaComCartao = useRef(0);
  const rolagemY = useRef(0);
  const [atualVisivel, setAtualVisivel] = useState(false);
  function avaliarAtual() {
    const atual = atualNaRolagem.current;
    const altura = alturaComCartao.current;
    if (!atual || !altura) return;
    // Como a web (src/ui/caminho.tsx, IntersectionObserver na lente e no balão "Começar", com rootMargin de -40 px em cima e
    // -170 px embaixo, sobre a tela inteira: o cartão flutuante não encolhe a área observada): basta a lente ou o balão (uns
    // 110 pontos acima dela) aparecer nessa faixa para o cartão sair.
    const topoVisivel = rolagemY.current + 40;
    const peVisivel = rolagemY.current + height - 170;
    const visto = atual.base > topoVisivel && atual.topo - 110 < peVisivel;
    setAtualVisivel((antes) => (antes === visto ? antes : visto));
  }

  // O erro aparece no topo, como na web; a tela sobe até ele.
  useEffect(() => {
    if (erro) rolagem.current?.scrollTo({ y: 0, animated: reduzir === false });
  }, [erro, reduzir]);

  /** Centraliza o nó só quando ele está fora da vista, como o scrollIntoView da web. Com movimento reduzido, salta direto. */
  function rolar(topo: number, base: number, sempre = false, ceu?: { topo: number; parte: number; coberto: number }) {
    requestAnimationFrame(() => {
      const altura = visivel.current || height;
      // O card da próxima lição flutua sobre o pé da área: o nó e o título embaixo dele precisam ficar acima do card.
      const pe = base + 48;
      const limite = altura - (proximo ? 168 : 24);
      if (!sempre && pe <= limite) return;
      // Rola só o necessário: o nó fica logo acima do card (o topo da trilha tende a continuar à vista).
      let y = Math.max(0, pe - limite);
      // Como a web: se a rolagem parou com o céu cortado no alto (a placa pela metade), segue até a faixa da Parte 1 ficar 12
      // abaixo da faixa presa no alto, desde que o nó continue bem à vista (72 abaixo dela).
      if (ceu) {
        const resto = ceu.parte - y - 12 - ceu.coberto;
        if (ceu.topo - y < 0 && resto > 0 && topo - y - resto > 72) y += resto;
      }
      rolagem.current?.scrollTo({ y, animated: reduzir === false });
    });
  }

  const novo = <Botao rotulo={mensagens.planos.novo} testID="novo-plano" desativado={ocupado} acao={novoPlano} />;
  // Como .trilha-topo__texto da web: na trilha recebida, "Esta trilha é de Ana" e o link original; na da própria pessoa,
  // "Compartilhar" (ou "Compartilhada", com o link ativo); depois de adicionar, o aviso verde.
  const marcaDoTopo = (
    <>
      {plano.recebida ? <TrilhaRecebida recebida={plano.recebida} /> : compartilhar && (
        <Botao rotulo={plano.link ? mensagens.compartilhar.selo : mensagens.compartilhar.entrada} iconeAntes="compartilhar" variante="secundario"
          testID="plano-compartilhar" nomeAcessivel={mensagens.compartilhar.entradaRotulo(plano.titulo)} desativado={ocupado} acao={compartilhar}
          estilo={estudoEstilos.compartilharTopo} />
      )}
      {etapa.aviso && <AvisoDaTrilha texto={etapa.aviso} />}
    </>
  );
  const passo = proximo && (
    <ProximoPasso titulo={proximo.no.titulo} detalhe={proximo.posicao} abrindo={abrindo === proximo.no.id} andamento={proximo.no.andamento}
      ocupado={ocupado} rodape={!largo} aoAbrir={() => abrirLicao(proximo.no.id)} />
  );

  return (
    <Tela pagina={`plano-${plano.id}`} acoes={acoes} rodape={largo || (atualVisivel && passo) ? null : passo || novo} rolagem={rolagem}
      // Como na web no celular (levantamento de paridade, M1): a barra da marca, com "Sair" e o selo de sincronia, rola e sai
      // de vista; o cabeçalho da trilha (rótulo, nome em até duas linhas e o anel) rola até o alto e fica parado lá.
      abaixoDoLogo={largo ? undefined : <SeloSincronia sincronia={sincronia} />}
      faixaFixa={largo ? undefined : (
        <View style={estudoEstilos.barraPlano}>
          <View style={estudoEstilos.barraPlanoTexto}>
            <Text style={[estudoEstilos.barraPlanoRotulo, caixaAlta]}>{mensagens.trilha.suaTrilha}</Text>
            <Titulo testID="titulo-plano" foco linhas={2} equilibrado estilo={estudoEstilos.barraPlanoTitulo}>{plano.titulo}</Titulo>
            {marcaDoTopo}
          </View>
          <AnelProgresso progresso={plano.progresso} tamanho={44} />
        </View>
      )}
      // No celular, o cartão da próxima lição flutua sobre o mapa, como na web; o conteúdo ganha folga para passar por baixo.
      estiloRodape={largo ? undefined : estudoEstilos.rodapeFlutuante} estiloConteudo={largo ? undefined : estudoEstilos.conteudoComFlutuante}
      estiloRodapeConteudo={largo ? undefined : estudoEstilos.rodapeFlutuanteConteudo}
      aoMedir={(altura) => {
        visivel.current = altura;
        if (!atualVisivel || !alturaComCartao.current) alturaComCartao.current = altura;
        avaliarAtual();
      }}
      aoRolar={(y) => {
        rolagemY.current = y;
        avaliarAtual();
      }}>
      {erro && <EstadoErro mensagem={erro} foco acao={acaoErro} />}
      {largo && <View style={estudoEstilos.seloTrilha}><SeloSincronia sincronia={sincronia} /></View>}
      {largo && (
        <View style={estudoEstilos.topoTrilha}>
          <View style={estudoEstilos.topoTrilhaTexto}>
            <Text style={[estudoEstilos.topoTrilhaRotulo, caixaAlta]}>{mensagens.trilha.suaTrilha}</Text>
            <Titulo testID="titulo-plano" foco equilibrado estilo={estudoEstilos.tituloTopo}>{plano.titulo}</Titulo>
            {marcaDoTopo}
          </View>
          <AnelProgresso progresso={plano.progresso} />
        </View>
      )}
      {largo && passo}
      {nos.length > 0 && !proximo && (
        <View style={estudoEstilos.concluidoCartao}>
          <View style={estudoEstilos.concluidoTitulo}>
            <Icone nome="trofeu" tamanho={22} cor={cores.alerta} />
            <Text style={[estudoEstilos.concluidoTexto, { color: cores.alerta }]}>{mensagens.trilha.concluido}</Text>
          </View>
          <Text style={estilos.textoSecundario}>{mensagens.trilha.concluidoTexto}</Text>
          {largo && <View style={estudoEstilos.acaoNaTela}>{novo}</View>}
          {compartilhar && (
            <Botao rotulo={mensagens.compartilhar.concluidaAcao} iconeAntes="compartilhar" variante="secundario" testID="trofeu-compartilhar"
              desativado={ocupado} acao={compartilhar} estilo={{ alignSelf: 'flex-start', marginTop: 8 }} />
          )}
        </View>
      )}
      {nos.length > 0 ? (
        <Caminho nos={nos} stu={falaDoStu(nos)} ocupado={ocupado} abrindo={abrindo} liberadas={liberadas} recemConcluida={etapa.concluida ?? null}
          rolarPara={rolarPara} aoRolar={rolar} aoAbrir={(no) => abrirLicao(no.id)} estilo={largo ? undefined : estudoEstilos.caminhoNaTrilha} extraChegada={120}
          aoMedirAtual={(topo, base) => {
            atualNaRolagem.current = { topo, base };
            avaliarAtual();
          }} />
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
function AnelProgresso({ progresso, tamanho = 68 }: { progresso: Progresso; tamanho?: number }) {
  // .anel da web: o miolo branco fica a 8 da borda em qualquer tamanho (inset 8px), também no anel de 44 do alto da trilha.
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
      <Text style={[estudoEstilos.anelNumero, tamanho < 60 && estudoEstilos.anelNumeroPequeno]}>{progresso.concluidas}<Text style={estudoEstilos.anelTotal}>/{progresso.total}</Text></Text>
    </View>
  );
}

/**
 * Próxima lição do plano. No rodapé do celular, ao alcance do polegar, mostra só o rótulo e o título numa linha;
 * o leitor de tela lê o título inteiro e ouve o título também como dica do botão, como o aria-describedby da web.
 */
function ProximoPasso({ titulo, detalhe, abrindo, ocupado, rodape, aoAbrir, andamento = false }: {
  titulo: string;
  detalhe: string;
  andamento?: boolean;
  abrindo: boolean;
  ocupado: boolean;
  rodape: boolean;
  aoAbrir: () => void;
}) {
  const botao = <Botao rotulo={abrindo ? mensagens.trilha.abrindo : andamento ? mensagens.trilha.continuarLicao : mensagens.trilha.comecarLicao} testID="comecar-licao"
    dica={titulo} desativado={ocupado} ocupado={abrindo} acao={aoAbrir} />;

  if (rodape) {
    return (
      <View style={estudoEstilos.proximoRodape}>
        <View style={estudoEstilos.proximoTextos}>
          <Text style={[estudoEstilos.proximoRotulo, estudoEstilos.proximoRotuloRodape]}>{mensagens.trilha.proxima}</Text>
          {/* .trilha-proximo__titulo no celular: 15 px em 800, entrelinha 1,25 e até 3 linhas (o nome cortado com reticências era defeito). */}
          <Text numberOfLines={3} accessibilityLabel={titulo} style={[estudoEstilos.proximoTitulo, estudoEstilos.proximoTituloRodape]}>
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
 * "Seu próximo passo" (Minhas trilhas), como o `.plano-destaque` da web: a cena da região com o Stu, o rótulo, o selo de
 * sincronia, o título, o progresso com a porcentagem e o único botão primário da tela. Com tudo concluído, o rótulo vira
 * "Você concluiu suas trilhas!" e a ação, rever. O "Apagar" continua discreto, como nos outros cartões.
 */
function CartaoDestaque({ plano, indice, sincronia, ocupado, abrir, apagar, compartilhar }: {
  plano: PlanoResumo;
  indice: number;
  sincronia: Sincronia;
  ocupado: boolean;
  abrir: () => void;
  apagar: () => void;
  /** "Compartilhar" no menu "•••", acima de "Apagar" (só na trilha da própria pessoa, com o compartilhar ligado). */
  compartilhar?: () => void;
}) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0 && !temAndamentoNoPlano(plano.id)) acao = mensagens.planos.comecar;
  const { chao, relevo } = coresDaRegiao(Math.max(0, indice));
  const enfeites = regiaoDoTrecho(Math.max(0, indice)).enfeites;
  const entrada = useAparecer(80, 420, true);
  const balanco = useBalanco(3, 1600);

  return (
    // .plano-destaque: borda de 2 que fecha em volta e o degrau de 4 por fora (box-shadow 0 4px 0 #c3cdf2). A face recorta a
    // cena (overflow hidden), então o degrau é a camada de fora.
    <Animated.View testID="plano-destaque" style={[degrauFora(4, 24, cores.destaqueBorda), estudoEstilos.destaqueFora, estiloDeEntrada(entrada)]}>
    <View style={estudoEstilos.destaque}>
      <View style={[estudoEstilos.destaqueCena, { backgroundColor: chao }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[estudoEstilos.cartaoColina, estudoEstilos.cartaoColinaDestaque, { backgroundColor: relevo }]} />
        <Desenho nome={enfeites[0]} largura={40} estilo={[estudoEstilos.cartaoEnfeite, { left: '9%' }]} />
        <Desenho nome={enfeites[2]} largura={36} estilo={[estudoEstilos.cartaoEnfeite, { right: '9%' }]} />
        <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
          style={[estudoEstilos.destaqueStu, { transform: [{ translateY: balanco }] }]} />
      </View>
      {/* Como .plano-cartao__menu da web: o "•••" dentro da arte, 8 do topo e da direita dela (24 do cartão), com o "Apagar"
          num balão embaixo. */}
      <MenuDoCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} compartilhar={compartilhar} testID="apagar-destaque" estilo={estudoEstilos.menuDestaque} />
      <View style={estudoEstilos.destaqueCorpo}>
        <View style={estudoEstilos.destaqueTopo}>
          <Text style={[estudoEstilos.destaqueRotulo, caixaAlta]}>{(concluido ? mensagens.retomada.concluido : mensagens.retomada.titulo)}</Text>
        </View>
        <Text accessibilityRole="header" style={[estilos.subtitulo, estudoEstilos.destaqueTitulo, estudoEstilos.destaqueTituloTamanho]}>{plano.titulo}</Text>
        <MarcaCompartilhar marcas={plano} />
        <BarraProgresso progresso={plano.progresso} comPercentual />
        {/* 14 da linha do progresso (21) até o botão, como .plano-destaque na web (o corpo tem vão de 8). */}
        <Botao rotulo={acao} testID="abrir-destaque" icone="seta" nomeAcessivel={`${acao}: ${plano.titulo}`} desativado={ocupado} acao={abrir}
          estilo={{ marginTop: 6 }} />
      </View>
    </View>
    </Animated.View>
  );
}

/**
 * Cartão de um plano em Meus planos, como na web: uma faixa do mundo (cada plano numa região), o título, o progresso e a
 * ação que cabe: começar, continuar ou rever a trilha concluída.
 */
function CartaoPlano({ plano, indice, ocupado, abrir, apagar, compartilhar, secundario = false }: {
  /** "Compartilhar" no menu "•••", acima de "Apagar" (só na trilha da própria pessoa, com o compartilhar ligado). */
  compartilhar?: () => void;
  /** Abaixo do destaque, a ação é secundária: o único botão azul da tela fica no "Seu próximo passo". Como na web. */
  secundario?: boolean;
  plano: PlanoResumo;
  indice: number;
  ocupado: boolean;
  abrir: () => void;
  apagar: () => void;
}) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0 && !temAndamentoNoPlano(plano.id)) acao = mensagens.planos.comecar;
  const { chao, relevo } = coresDaRegiao(indice);
  const enfeites = regiaoDoTrecho(indice).enfeites;
  const entrada = useAparecer(120 + indice * 80, 420);

  return (
    // .plano-cartao: borda de 2 em volta e o degrau de 4 por fora (box-shadow 0 4px 0 gelo); a face recorta a cena.
    <Animated.View style={[degrauFora(4, 24, cores.gelo), estudoEstilos.cartaoFora, estiloDeEntrada(entrada)]}>
    <View style={estudoEstilos.cartao}>
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
        <Text accessibilityRole="header" style={[estilos.tituloBloco, estudoEstilos.cartaoTitulo]}>{plano.titulo}</Text>
        <MarcaCompartilhar marcas={plano} />
        <BarraProgresso progresso={plano.progresso} />
        <View style={estudoEstilos.cartaoAcao}>
          <Botao rotulo={acao} testID={`abrir-plano-${indice}`} icone="seta" variante={concluido || secundario ? 'secundario' : 'primario'}
            nomeAcessivel={`${acao}: ${plano.titulo}`} desativado={ocupado} acao={abrir} />
        </View>
      </View>
      <MenuDoCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} compartilhar={compartilhar} testID={`apagar-plano-${indice}`} />
    </View>
    </Animated.View>
  );
}

/**
 * Rodada 4.2 da web: o "Apagar" sai de baixo de cada cartão e vai para um menu discreto ("•••", "Mais opções de …"), para
 * não competir com Começar/Continuar. Tocar no menu mostra "Apagar" ao lado; tocar nele de novo fecha. Apagar ainda pede
 * confirmação.
 */
function MenuDoCartao({ titulo, ocupado, apagar, compartilhar, testID, estilo }: { titulo: string; ocupado: boolean; apagar: () => void; compartilhar?: () => void; testID: string; estilo?: StyleProp<ViewStyle> }) {
  const [aberto, setAberto] = useState(false);
  // O balão do Studoo, o mesmo no iPhone, no Android e na web (regra do dono, lote 4: nada de folha de ações do sistema).
  const alternar = () => setAberto((atual) => !atual);
  return (
    <View style={[estudoEstilos.menu, estilo]}>
      <Pressable testID={`${testID}-menu`} accessibilityRole="button" accessibilityLabel={mensagens.planos.maisOpcoesRotulo(titulo)} hitSlop={4}
        accessibilityState={{ expanded: aberto, disabled: ocupado }} aria-expanded={aberto} disabled={ocupado}
        onPress={alternar}
        style={({ pressed }) => [estudoEstilos.menuBotao, (aberto || pressed) && estudoEstilos.menuBotaoAberto]}>
        {/* Aberto, o "•••" fica na cor do texto (.plano-cartao__menu[open] > summary). */}
        <Text importantForAccessibility="no" style={[estudoEstilos.menuBotaoTexto, aberto && { color: cores.texto }]}>•••</Text>
      </Pressable>
      {aberto && !compartilhar && (
        <View style={estudoEstilos.menuBalao}>
          {/* O próprio botão é o balão (.plano-cartao__menu[open] > .plano-cartao__apagar): 6 × 12, borda de 1 e cantos de 12. */}
          <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={mensagens.planos.apagarRotulo(titulo)} disabled={ocupado}
            onPress={() => { setAberto(false); apagar(); }} style={[estudoEstilos.cartaoApagar, estudoEstilos.cartaoApagarBalao]}>
            <Text style={estudoEstilos.cartaoApagarTexto}>{mensagens.planos.apagar}</Text>
          </Pressable>
        </View>
      )}
      {aberto && compartilhar && (
        // Com o compartilhar, como .plano-cartao__opcoes da web: uma caixa só, "Compartilhar" acima de "Apagar".
        <View style={[estudoEstilos.menuBalao, estudoEstilos.menuOpcoes]}>
          <Pressable testID={`${testID}-compartilhar`} accessibilityRole="button" accessibilityLabel={mensagens.compartilhar.entradaRotulo(titulo)} disabled={ocupado}
            onPress={() => { setAberto(false); compartilhar(); }} style={({ pressed }) => [estudoEstilos.menuOpcao, pressed && { backgroundColor: cores.nevoa }]}>
            <Text style={estudoEstilos.menuOpcaoTexto}>{mensagens.compartilhar.entrada}</Text>
          </Pressable>
          <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={mensagens.planos.apagarRotulo(titulo)} disabled={ocupado}
            onPress={() => { setAberto(false); apagar(); }} style={estudoEstilos.menuOpcao}>
            <Text style={estudoEstilos.cartaoApagarTexto}>{mensagens.planos.apagar}</Text>
          </Pressable>
        </View>
      )}
    </View>
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
function TelaConcluida({ etapa, acoes, mensagem, rodape, ocupado, compartilhar }: {
  etapa: Extract<Etapa, { tipo: 'concluida' }>;
  acoes: ReactNode;
  mensagem: ReactNode;
  rodape: ReactNode;
  ocupado: boolean;
  /** Com a trilha concluída, "Compartilhar esta trilha" (só na trilha da própria pessoa, com o compartilhar ligado). */
  compartilhar?: () => void;
}) {
  const { plano, antes, licao, liberadas, resumo } = etapa;
  const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);
  const entradaLiberada = useAparecer(1000, 420, true);
  // A última lição fecha a trilha: a comemoração é da trilha inteira.
  const trilhaFeita = plano.progresso.total > 0 && plano.progresso.concluidas === plano.progresso.total;

  return (
    <Tela pagina="concluida" semCabecalho rodape={rodape} estiloConteudo={estudoEstilos.fimQuarenta}>
      {/* Sem chuva de confete quando ficou exercício sem acerto ou a prática não saiu: a conclusão vira um lembrete gentil. */}
      {!(resumo && (resumo.acertos < resumo.exercicios || resumo.pratica === 'ainda_nao')) && <Confete chuva quantidade={44} />}
      <View style={estudoEstilos.conclusaoTopo}>
        <CenaConclusao />
        <Titulo testID="titulo-conclusao" foco estilo={estudoEstilos.textoCentro}>
          {trilhaFeita ? mensagens.licao.trilhaConcluida : mensagens.licao.concluida}
        </Titulo>
        <Text style={[estudoEstilos.comemoracao, estudoEstilos.textoCentro]}>
          {trilhaFeita ? mensagens.licao.trilhaConcluidaTexto(plano.titulo) : mensagens.licao.comemoracao}
        </Text>
        <Text style={[estudoEstilos.conclusaoLicao, estudoEstilos.textoCentro]}>{licao.titulo}</Text>
      </View>
      {trilhaFeita && (
        <View testID="resumo-trilha" style={estudoEstilos.resumoTrilha}>
          <Icone nome="trofeu" tamanho={18} cor="#7A4A00" />
          <Text style={estudoEstilos.resumoTrilhaTexto}>{mensagens.licao.trilhaResumo(plano.progresso.total, plano.fluxos.length, plano.estatisticas)}</Text>
        </View>
      )}
      {trilhaFeita && compartilhar && (
        // .conclusao-compartilhar: centralizado, 10 abaixo do resumo da trilha.
        <Botao rotulo={mensagens.compartilhar.concluidaAcao} iconeAntes="compartilhar" variante="secundario" testID="conclusao-compartilhar"
          desativado={ocupado} acao={compartilhar} estilo={{ alignSelf: 'center', marginTop: 10 }} />
      )}
      {resumo && trilhaFeita && <Text style={[estudoEstilos.legendaNumeros, caixaAlta]}>{mensagens.licao.resumo.ultimaLicao}</Text>}
      {resumo && <NumerosDaLicao resumo={resumo} />}
      {resumo?.rever && (
        // Como na web 4.2: o ícone fica junto da primeira linha e o texto alinhado à esquerda, num bloco centralizado.
        <View testID="conclusao-rever" style={estudoEstilos.rever}>
          <View style={estudoEstilos.reverIcone}><Icone nome="revisao" tamanho={20} cor={cores.alerta} /></View>
          <Text style={estudoEstilos.reverTexto}>
            {textoParaRever(resumo)}
          </Text>
        </View>
      )}
      {/* Como na web (rodada 1.2): a história da lição em cartões, só com o que aconteceu de verdade (sem ponte, não há
          cartão de ponte; sem explicação, não há cartão de ensino), e a confirmação de que o progresso ficou na conta. */}
      <View testID="conclusao-historia" accessibilityLabel={mensagens.licao.historia.titulo} style={estudoEstilos.historia}>
        <CartaoHistoria titulo={mensagens.licao.historia.praticou} texto={licao.objetivo} ordem={0} />
        {resumo?.ponteConstruida && <CartaoHistoria tipo="ponte" titulo={mensagens.licao.historia.ponteTitulo} texto={mensagens.licao.historia.ponteTexto} ordem={1} />}
        {resumo?.ensinouStu && (
          <CartaoHistoria tipo="ensino" titulo={mensagens.licao.historia.ensinoTitulo} texto={mensagens.licao.historia.ensinoTexto}
            ordem={resumo.ponteConstruida ? 2 : 1} />
        )}
        <Text style={estudoEstilos.historiaSincronia}>{mensagens.licao.historia.sincronia}</Text>
      </View>
      {/* Lição de idioma: as frases que a pessoa aprendeu, logo depois do resumo. Como na web. */}
      {licao.falas && licao.falas.length > 0 && (
        <View style={[estudoEstilos.bloco, estudoEstilos.blocoConclusao]}><FrasesDaLicao falas={licao.falas} /></View>
      )}
      {liberada && (
        <Animated.View style={[estudoEstilos.liberada, estiloDeEntrada(entradaLiberada, 12)]}>
          <Icone nome="livro" tamanho={20} cor={cores.acao} />
          <Text style={estudoEstilos.liberadaTexto}>{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</Text>
        </Animated.View>
      )}
      <View style={[estudoEstilos.bloco, estudoEstilos.blocoProgresso]}>
        <Text accessibilityRole="header" style={[estilos.tituloBloco, estudoEstilos.tituloProgresso]}>{mensagens.licao.progresso}</Text>
        <BarraProgresso progresso={plano.progresso} de={antes} testID="progresso-plano" comPercentual />
      </View>
      {mensagem}
    </Tela>
  );
}

/** Um cartão da história da lição; o da ponte traz as tábuas da travessia, o do ensino, o tom verde. Entram em sequência. */
function CartaoHistoria({ titulo, texto, tipo, ordem }: { titulo: string; texto: string; tipo?: 'ponte' | 'ensino'; ordem: number }) {
  const entrada = useAparecer(700 + ordem * 120, 420, true);
  const cor = tipo === 'ponte' ? cores.acao : tipo === 'ensino' ? cores.sucesso : cores.acao;
  return (
    <Animated.View testID={`historia-${tipo ?? 'praticou'}`}
      style={[estudoEstilos.historiaCartao, tipo === 'ponte' && estudoEstilos.historiaPonte, tipo === 'ensino' && estudoEstilos.historiaEnsino,
        estiloDeEntrada(entrada, 10)]}>
      <View style={estudoEstilos.historiaTopo}>
        <Text style={[estudoEstilos.historiaTitulo, { color: cor }, caixaAlta]}>{titulo}</Text>
      </View>
      <Text style={estudoEstilos.historiaTexto}>{texto}</Text>
    </Animated.View>
  );
}

/** Raios dourados que giram devagar, o Stu que pula algumas vezes e depois flutua, e o selo de concluída. */
/** Faixas de cada raio da conclusão, da ponta (raio 104) ao centro: a largura acompanha a cunha de 11° e o alfa, a máscara. */
/** Escurece uma cor #RRGGBB (como o color-mix com preto da web no degrau dos números). */
function escurecer(cor: string, fator: number): string {
  const n = parseInt(cor.replace('#', ''), 16);
  const canal = (deslocamento: number) => Math.round(((n >> deslocamento) & 255) * fator).toString(16).padStart(2, '0');
  return `#${canal(16)}${canal(8)}${canal(0)}`;
}

// Cunha de 11° do centro (104) até a borda: a largura cresce para fora e a opacidade cai de 0,42 (até 30% do raio) a 0 (70%).
const FAIXAS_DO_RAIO = Array.from({ length: 13 }, (_, indice) => {
  const topo = indice * 8; const meio = 104 - (topo + 4); // distância do centro
  const alfa = meio <= 31 ? 0.42 : meio >= 73 ? 0 : 0.42 * (73 - meio) / 42;
  return { topo, altura: 8, largura: Math.max(2, 2 * meio * Math.tan((5.5 * Math.PI) / 180)), alfa: Math.round(alfa * 100) / 100 };
});
const RAIOS_WEB = {
  borderRadius: 999,
  backgroundImage: 'repeating-conic-gradient(from 0deg, rgb(255 209 102 / 0.42) 0deg 11deg, transparent 11deg 30deg)',
  maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
  WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
} as unknown as ViewStyle;

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
        {/* Como .conclusao-raios: cunhas de 11° a cada 30°, em amarelo a 42%, sob a máscara radial (cheias até 30% do raio e
            sumindo até 70%). No navegador vale o mesmo CSS da web; no aparelho, sem gradiente cônico nem máscara, cada cunha é
            feita de faixas finas que esmaecem aos poucos. */}
        {Platform.OS === 'web' ? <View style={[estudoEstilos.raio, RAIOS_WEB]} /> : Array.from({ length: 12 }, (_, indice) => (
          <View key={indice} style={[estudoEstilos.raio, { transform: [{ rotate: `${indice * 30}deg` }] }]}>
            {FAIXAS_DO_RAIO.map((faixa) => (
              <View key={faixa.topo} style={{ position: 'absolute', top: faixa.topo, height: faixa.altura, left: 104 - faixa.largura / 2, width: faixa.largura,
                backgroundColor: `rgba(255, 209, 102, ${faixa.alfa})` }} />
            ))}
          </View>
        ))}
      </Animated.View>
      <Animated.Image source={require('../assets/marca/stu-oi.png')} resizeMode="contain" accessible={false}
        style={{ width: 130, height: 143, transform: [{ translateY: pulo }] }} />
      {/* .conclusao-selo: círculo de 50 com o degrau escuro de 4 por fora e o anel branco de 4 em volta (0 0 0 4px). */}
      <Animated.View style={[estudoEstilos.seloAnel, {
        opacity: selo,
        transform: [
          { scale: selo.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
          { rotate: selo.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) },
        ],
      }]}>
        <View style={degrauFora(4, 25, cores.sucesso)}>
          <View style={estudoEstilos.seloConclusao}>
            <Icone nome="check" tamanho={28} cor={cores.fundo} traco={3.2} />
          </View>
        </View>
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
      valor: textos.acertos(resumo.acertosDePrimeira, resumo.exercicios), cor: resumo.dePrimeira ? cores.sucesso : cores.alerta },
    { chave: 'etapas', icone: 'check' as const, rotulo: textos.etapas, valor: textos.etapasFeitas(resumo.etapas), cor: '#5B4BB7' },
    ...(resumo.pratica ? [{ chave: 'pratica', icone: 'relogio' as const, rotulo: textos.pratica, valor: mensagens.licao.pratica.opcoes[resumo.pratica], cor: '#6B3FA0' }] : []),
  ];
  return (
    <View style={estudoEstilos.numeros} accessible accessibilityLabel={`${textos.titulo}: ${itens.map((item) => `${item.rotulo} ${item.chave === 'tempo' ? formatarTempo(resumo.segundos) : item.valor}`).join(', ')}`}>
      {/* Com a prática, quatro números: dois por linha. */}
      {itens.map((item, indice) => <CartaoNumero key={item.chave} {...item} ordem={indice} base={itens.length > 3 ? '46%' : '30%'} />)}
    </View>
  );
}

function CartaoNumero({ icone, rotulo, valor, cor, ordem, base }: {
  icone: NomeIcone; rotulo: string; valor: string; cor: string; ordem: number; base: `${number}%`;
}) {
  const entrada = useAparecer(600 + ordem * 120, 480, true);
  return (
    // .conclusao-numeros li: a face na cor do número e o degrau de 4 por fora, no mesmo tom escurecido a 70%.
    <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[degrauFora(4, 16, escurecer(cor, 0.7)), { flex: 1, minWidth: 0, flexBasis: base }, estiloDeEntrada(entrada, 14, 0.9)]}>
      <View style={[estudoEstilos.numero, { backgroundColor: cor, borderColor: cor }]}>
      <View style={estudoEstilos.numeroRotulo}>
        {/* O ícone do rótulo tem 16 px com traço de 1,83 px (2,75 na grade de 24), o que a web calcula em 390 e 360. */}
        <Icone nome={icone} tamanho={16} cor={cores.fundo} traco={2.75} />
        {/* Uma linha só (em 360, "DE PRIMEIRA" quebrava em duas e desalinhava os três cartões). */}
        <Text numberOfLines={1} style={[estudoEstilos.numeroRotuloTexto, caixaAlta]}>{rotulo}</Text>
      </View>
      <View style={estudoEstilos.numeroValor}>
        <Text style={estudoEstilos.numeroValorTexto}>{valor}</Text>
      </View>
      </View>
    </Animated.View>
  );
}

const estudoEstilos = StyleSheet.create({
  // Fim da rolagem como a web desde bf8cf37: 40 entre o último conteúdo e o rodapé ou a barra fixos (conclusão, minhas
  // trilhas, nova trilha).
  fimQuarenta: { paddingBottom: 40 },
  // Na geração e na proposta, o verde do mapa vai até a barra dos botões, sem a tira branca de 24.
  fimSemRespiro: { paddingBottom: 0 },
  // .conclusao-historia: cartões com borda de 2 em volta (sem degrau), 14 × 16 de respiro e 12 entre eles.
  historia: { marginTop: 18, gap: 12 },
  historiaCartao: { gap: 4, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, borderWidth: 2,
    borderColor: cores.gelo, backgroundColor: cores.nevoa },
  historiaPonte: { borderColor: cores.destaqueBorda, backgroundColor: cores.ceu },
  historiaEnsino: { borderColor: '#9AD8B5', backgroundColor: cores.sucessoFundo },
  historiaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historiaTitulo: { flexShrink: 1, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 19.5, letterSpacing: 0.52 },
  historiaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 22.5 },
  historiaSincronia: { marginTop: 2, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  // .plano-destaque no celular: 16 de respiro, a cena de 96 com cantos de 18 dentro do cartão, 14 entre a cena e o corpo e o
  // fundo em degradê (135°, #f6f8ff até o branco aos 62%).
  destaqueFora: { marginTop: 24 },
  destaque: {
    padding: 16, gap: 14, borderWidth: 2, borderRadius: 24, borderColor: cores.destaqueBorda,
    backgroundColor: cores.fundo, overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ backgroundImage: 'linear-gradient(135deg, #f6f8ff 0%, #ffffff 62%)' } as object)
      : { experimental_backgroundImage: 'linear-gradient(135deg, #F6F8FF 0%, #FFFFFF 62%)' }),
  },
  destaqueCena: { height: 96, borderRadius: 18, overflow: 'hidden' },
  destaqueStu: { position: 'absolute', bottom: 6, left: '50%', marginLeft: -30, width: 60, height: 66 },
  destaqueCorpo: { gap: 8 },
  introducaoPlanos: { marginTop: 12 },
  erroNaLista: { marginTop: 0, marginBottom: 16 },
  outrasTrilhas: { marginTop: 16 },
  destaqueTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  destaqueRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 12, lineHeight: 16, letterSpacing: 0.7 },
  destaqueTitulo: { marginTop: 2 },
  // O título do cartão de destaque tem 22 px na web; o dos outros cartões, 19.
  destaqueTituloTamanho: { fontSize: 22, lineHeight: 28.6, letterSpacing: -0.33 },
  cartaoTitulo: { fontSize: 19, lineHeight: 24.7, letterSpacing: -0.285 },
  secaoTitulo: {
    marginTop: 24, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18, letterSpacing: 0.8,
  },
  seloTrilha: { marginBottom: 12 },
  // Pedido simplificado
  pedidoHeroi: { alignItems: 'center', gap: 8, paddingTop: 8 },
  // O cartão do material na web: o vão de 18 do painel mais os 24 de margem do cartão, em cima e embaixo (o cartão do app tem 12).
  materialNoPedido: { marginTop: 30, marginBottom: 12 },
  // Como .pedido-heroi__stu e o halo da web: 120 px, o miolo claro e o anel amarelo do gradiente, com o Stu de 96 por cima.
  pedidoStu: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  pedidoHalo: { position: 'absolute', width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE08A' },
  pedidoHaloMiolo: { width: 69, height: 69, borderRadius: 35, backgroundColor: '#FFF3C4' },
  // .pedido-heroi__estrela: 1,5rem na entrelinha do corpo (1,5 → 36).
  pedidoEstrela: { position: 'absolute', top: 6, right: 8, color: '#FFB703', fontSize: 24, lineHeight: 36 },
  // Como .pedido-heroi h1 da web no celular: 30 px (clamp de 1,875rem), entrelinha 1,08.
  pedidoTitulo: { fontSize: 30, lineHeight: 32, textAlign: 'center' },
  pedidoFala: { minHeight: 24, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 17, lineHeight: 24, textAlign: 'center' },
  // .pedido-alternar (regra final de pedido.css): borda lisa de 2 em #C3CDF2, raio 22, degradê e degrau de 3 por fora.
  alternarFora: { marginTop: 18 },
  alternar: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingLeft: 14, paddingRight: 18,
    borderRadius: 22, borderWidth: 2, borderColor: '#C3CDF2', backgroundColor: cores.fundo },
  // .pedido-alternar__texto: strong e small na entrelinha do corpo (1,5): 24 e 21.
  alternarDica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21 },
  // .pedido-alternar__selo: em linha depois do título, com 8 à esquerda (também quando desce para a linha de baixo, como o
  // inline-block da web), 12/18 com 2 × 8 de respiro (22 de altura) no meio da linha de 24.
  alternarLinha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  alternarSelo: { marginLeft: 8, marginVertical: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', backgroundColor: '#E5EBFF',
    color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 18 },
  alternarIcone: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.nevoa },
  alternarTextos: { flex: 1, gap: 2 },
  alternarTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  // Topo da trilha e anel de progresso
  topoTrilha: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12, paddingTop: 4 },
  topoTrilhaTexto: { flex: 1, minWidth: 0 },
  topoTrilhaRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  tituloTopo: { fontSize: 26, lineHeight: 30 },
  // Com a sombra de 4 embaixo da web (0 4px 0 rgb(27 42 94 / 0.08)).
  anel: { alignItems: 'center', justifyContent: 'center', borderColor: cores.gelo, backgroundColor: cores.fundo, boxShadow: '0 4px 0 rgba(27, 42, 94, 0.08)' },
  anelMetade: { position: 'absolute', overflow: 'hidden' },
  // .anel__numero: Quicksand 700, -0,03em; no alto da trilha, 1rem (.trilha-topo .anel__numero) com entrelinha 1,5.
  anelNumero: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 22, lineHeight: 26, letterSpacing: -0.66 },
  anelTotal: { color: cores.textoSecundario, fontSize: 13 },
  anelNumeroPequeno: { fontSize: 16, lineHeight: 24, letterSpacing: -0.48 },
  // Como .trilha-topo da web no celular: 10 px de respiro, rótulo 11 px/900, nome em 18 px (até duas linhas) e anel de 44.
  barraPlano: { width: '100%', maxWidth: 620, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20,
    paddingVertical: 10 },
  barraPlanoTexto: { flex: 1, minWidth: 0 },
  // .trilha-topo no celular: rótulo de 0,6875rem e h1 de 1,125rem na entrelinha de 1,12.
  barraPlanoRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 11, lineHeight: 16.5, letterSpacing: 0.9 },
  barraPlanoTitulo: { marginTop: 2, fontSize: 18, lineHeight: 20.16 },
  // .painel--trilha: 20 entre a faixa do nome e o mapa (o conteúdo já tem 24 em cima).
  // .painel--trilha: 20 da faixa "SUA TRILHA" até o mapa (o conteúdo das telas de estudo começa a 28).
  caminhoNaTrilha: { marginTop: -8 },
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
  // Borda de 2 que fecha em volta e o degrau de 4 por fora, na mesma cor (gelo), como na web (box-shadow 0 4px 0).
  bloco: { gap: 12, marginTop: 16, padding: 16, borderRadius: 24, borderWidth: 2, borderColor: cores.gelo, boxShadow: `0 4px 0 ${cores.gelo}` },
  blocoConclusao: { marginTop: 24, padding: 20, gap: 2 },
  // .conclusao-progresso: 20 depois de "Liberada na trilha", 20 de respiro e o título colado no .progresso (que tem 12 em cima).
  blocoProgresso: { marginTop: 20, padding: 20, gap: 0 },
  progresso: { gap: 8, marginTop: 12 },
  progressoNaFaixa: { marginTop: 18 },
  progressoLegenda: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  // .progresso span: 0,875rem com a entrelinha de 1,5 do corpo (21).
  progressoTexto: { flexShrink: 1, fontWeight: '700', lineHeight: 21 },
  percentual: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 14, lineHeight: 21 },
  // .barra da web: 12 de altura (nos cartões de Minhas trilhas e no destaque).
  trilha: { height: 12, borderRadius: 6, backgroundColor: cores.nevoa, overflow: 'hidden' },
  trilhaNaFaixa: { height: 14, borderRadius: 7 },
  preenchimento: { height: '100%', backgroundColor: cores.acao, borderRadius: 7, overflow: 'hidden' },
  brilhoBarra: { position: 'absolute', top: 3, left: 6, right: 6, height: 3, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.3)' },
  // Faixa do topo da trilha: cartão branco com relevo, como na web.
  // Como o cabeçalho da proposta na web: solto na página, sem cartão (o título, a origem e o aviso de trilha repetida).
  // .trilha-cabecalho: 4 em cima e nos lados (o texto começa em 24 no celular, não em 20).
  faixa: { marginBottom: 12, paddingTop: 4, paddingHorizontal: 4 },
  faixaLarga: { padding: 24 },
  // Como o título da proposta na web (clamp(1,5rem, 4vw, 2rem) = 24 px no celular, entrelinha 1,12).
  tituloFaixa: { fontSize: 24, lineHeight: 27 },
  objetivoFaixa: { fontSize: 16 },
  divisao: { marginTop: 20, paddingTop: 20, borderTopWidth: 2, borderColor: cores.nevoa },
  proximo: { gap: 2 },
  proximoRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18, letterSpacing: 0.5,
    textTransform: 'uppercase' },
  proximoTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 17, lineHeight: 24 },
  proximoAcao: { alignItems: 'flex-start', marginTop: 12 },
  proximoRodape: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // .trilha-proximo no celular: 10 acima da navegação, borda de 2 e degrau de 5 (0 5px 0 gelo, fora da caixa): aqui a faixa de
  // baixo soma os 7 e o cartão fica 5 acima da barra, como o pé do degrau na web.
  rodapeFlutuante: { position: 'absolute', left: 12, right: 12, bottom: 5, borderRadius: 24, borderWidth: 2, borderBottomWidth: 7,
    borderColor: cores.gelo, backgroundColor: cores.fundo, shadowColor: '#1B2A5E', shadowOpacity: 0.16, shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  // .trilha-proximo: 14 × 14 × 14 × 20 de respiro.
  rodapeFlutuanteConteudo: { paddingTop: 14, paddingBottom: 14, paddingLeft: 20, paddingRight: 14 },
  // O morro do troféu já desce por baixo do cartão flutuante; sem folga branca no fim.
  conteudoComFlutuante: { paddingBottom: 0 },
  proximoTextos: { flex: 1, minWidth: 0 },
  // .trilha-proximo__rotulo: 12 px em 900, 0,06em, entrelinha do corpo (18).
  proximoRotuloRodape: { fontSize: 12, lineHeight: 18, fontWeight: '900', letterSpacing: 0.72 },
  proximoTituloRodape: { fontSize: 15, lineHeight: 18.75, fontWeight: '800' },
  concluido: { gap: 8 },
  concluidoTitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  concluidoTexto: { flex: 1, color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  acaoNaTela: { alignItems: 'flex-start', marginTop: 8 },
  // .trilha-compartilhar: 10 abaixo do nome da trilha.
  compartilharTopo: { alignSelf: 'flex-start', marginTop: 10 },
  vazio: { gap: 16, marginTop: 24 },
  liberada: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  liberadaTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  // Lição concluída
  conclusaoTopo: { alignItems: 'center' },
  repetida: { gap: 10, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFF6D9' },
  repetidaTexto: { color: '#7A4A00', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  cartaoApagar: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  // Como .plano-cartao__menu: no canto de cima da arte, botão de 44 × 44 sobre branco translúcido.
  menu: { position: 'absolute', top: 10, right: 10, zIndex: 2, alignItems: 'flex-end' },
  menuDestaque: { top: 24, right: 24 },
  menuBotao: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.88)' },
  menuBalao: { marginTop: 4 },
  // .plano-cartao__opcoes: no mínimo 11 rem, 6 de respiro, borda de 1, cantos de 12 e a sombra do balão.
  menuOpcoes: { minWidth: 176, padding: 6, borderWidth: 1, borderColor: cores.gelo, borderRadius: 12, backgroundColor: cores.fundo,
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  menuOpcao: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8 },
  menuOpcaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14 },
  cartaoApagarBalao: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: cores.gelo, borderRadius: 12, backgroundColor: cores.fundo,
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  menuBotaoAberto: { backgroundColor: cores.nevoa },
  menuBotaoTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16 },
  cartaoApagarTexto: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, textDecorationLine: 'underline' },
  rever: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16, alignSelf: 'center', maxWidth: 448 },
  reverIcone: { marginTop: 1 },
  resumoTrilha: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 14, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: '#FFF6D9' },
  resumoTrilhaTexto: { flexShrink: 1, color: '#7A4A00', fontFamily: fontes.corpo, fontWeight: '900', fontSize: 15, textAlign: 'center' },
  legendaNumeros: { marginTop: 18, marginBottom: -6, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, letterSpacing: 0.8, textAlign: 'center' },
  reverTexto: { flexShrink: 1, color: cores.alerta, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24, textAlign: 'left' },
  textoCentro: { textAlign: 'center' },
  cena: { width: 190, height: 172, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 },
  // O centro dos raios é o centro da cena (95, 86), como o inset de -14 da web; o círculo tem 104 de raio (o fim da máscara).
  raios: { position: 'absolute', left: -9, top: -18, width: 208, height: 208 },
  raio: { position: 'absolute', left: 0, top: 0, width: 208, height: 208 },
  // O anel branco de 4 (box-shadow 0 0 0 4px) fica por fora do círculo de 50 (right 6 e bottom 30 na web).
  seloAnel: { position: 'absolute', right: 2, bottom: 26, padding: 4, borderRadius: 29, backgroundColor: cores.fundo },
  seloConclusao: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.sucessoClaro },
  // .conclusao-texto: 17 px em 800 (entrelinha 1,5) e .conclusao-licao: 16 px em 700 (entrelinha 1,5).
  // "Progresso na trilha" na conclusão: h2 de 1,25rem (20 px), entrelinha 1,3, -0,015em.
  tituloProgresso: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  comemoracao: { marginTop: 6, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 17, lineHeight: 25.5 },
  conclusaoLicao: { marginTop: 2, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  numero: { overflow: 'hidden', borderRadius: 16, borderWidth: 2 },
  // O rótulo ocupa a largura toda do bloco (97 em 360) e o conteúdo fica centrado, como na web: "DE PRIMEIRA" com o ícone
  // mede 95 e cabe inteiro em 360 (com respiro de 4 dos lados, era cortado com reticências).
  numeroRotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 0, paddingVertical: 6 },
  numeroRotuloTexto: { flexShrink: 1, color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 11, lineHeight: 16.5, letterSpacing: 0.22 },
  numeroValor: { alignItems: 'center', marginHorizontal: 2, marginBottom: 2, paddingHorizontal: 4, paddingVertical: 10, borderRadius: 13,
    backgroundColor: cores.fundo },
  // .conclusao-numeros__valor: 16 px na entrelinha de 1,2 (a caixa tem 39 de altura).
  numeroValorTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 16, lineHeight: 19.2, textAlign: 'center' },
  // Meus planos
  cartaoFora: { marginTop: 16 },
  cartao: { overflow: 'hidden', borderRadius: 24, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  cartaoCena: { height: 92, overflow: 'hidden' },
  // .plano-cartao__colina: meia elipse de 120% da largura com raio vertical de 72 (topo 36 acima do pé da cena). Sem raio
  // elíptico no React Native: um círculo de 440 achatado na vertical, com o centro 36 abaixo do pé.
  cartaoColina: { position: 'absolute', left: '50%', marginLeft: -220, width: 440, height: 440, borderRadius: 220, bottom: -256,
    transform: [{ scaleY: 144 / 440 }] },
  // .plano-destaque__cena .plano-cartao__colina: raio vertical de 68, centro 32 abaixo do pé.
  cartaoColinaDestaque: { bottom: -252, transform: [{ scaleY: 136 / 440 }] },
  cartaoEnfeite: { position: 'absolute', bottom: 10 },
  cartaoSelo: { position: 'absolute', top: 12, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  cartaoSeloTexto: { color: cores.sucesso, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 18 },
  // .plano-cartao__corpo: 18 20 20 de respiro; o título e o .progresso (12 em cima) num bloco e o botão 16 abaixo dele.
  cartaoCorpo: { gap: 0, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  cartaoAcao: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 16 },
  // Pedido
  stuReage: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 20, marginBottom: -6 },
  balaoFala: { flexShrink: 1, maxWidth: 320, marginBottom: 22, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    borderWidth: 2, borderBottomWidth: 4, borderColor: cores.gelo, backgroundColor: cores.fundo },
  balaoFalaSeta: { position: 'absolute', left: -9, bottom: 12, width: 14, height: 14, borderLeftWidth: 2, borderBottomWidth: 2,
    borderColor: cores.gelo, borderBottomLeftRadius: 3, backgroundColor: cores.fundo, transform: [{ rotate: '45deg' }] },
  balaoFalaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  luzCampo: { position: 'absolute', left: -3, right: -3, top: -3, bottom: -3, borderRadius: 27, borderWidth: 3, borderColor: '#F0B429' },
  // Como .pedido-como da web: 44 px, centralizado, 800.
  // .pedido-como (bf8cf37): 26 do bloco de cima até a caixa de 44 do botão (34 depois das fichas, que têm 8 embaixo) e, no fim
  // da rolagem, 40 até a barra de baixo.
  como: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', minHeight: 44, marginTop: 26, paddingHorizontal: 10, borderRadius: 12 },
  comoPressionado: { backgroundColor: cores.nevoa },
  comoSinal: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EBFF' },
  comoSinalTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 16 },
  comoTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  aviso: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: cores.nevoa,
    color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  campoPedido: { marginTop: 18, marginBottom: 14, gap: 8 },
  entradaPedido: { minHeight: 112, paddingVertical: 18, paddingHorizontal: 20, borderWidth: 3, borderRadius: 24,
    borderColor: cores.gelo, backgroundColor: cores.fundo, fontSize: 19, lineHeight: 27, fontWeight: '700' },
  entradaPedidoFocada: { borderColor: cores.acao, outlineWidth: 0 },
  entradaPedidoVazia: { fontWeight: '600' },
  // A face do "Montar minha trilha" tem 56 na web (o degrau de 4 vem por fora).
  criar: { minHeight: 56 },
  campoErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campoErroTexto: { flex: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  dica: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  contador: { alignSelf: 'flex-end' },
  // Como .pedido-ideias e .pedido-ideia da web: fichas de 46 px com lábio de 3, que quebram linha, centralizadas.
  // Fichas de 46 com o degrau de 3 por fora (sem ocupar lugar, como a sombra da web): vão de 10, passo de 56.
  // Em cima, o vão de 18 de .painel--pedido mais a margem de 2 e o respiro de 4 de .pedido-ideias.
  sugestoes: { marginTop: 24, marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  surpresa: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingVertical: 8, paddingLeft: 10, paddingRight: 16, borderRadius: 999,
    borderWidth: 2, borderColor: '#FFE08A', backgroundColor: '#FFF8E1' },
  surpresaTexto: { color: '#7A4A00', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22 },
  areasRolagem: { marginHorizontal: -20 },
  areas: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  area: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 10, paddingRight: 14, borderRadius: 999,
    borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  areaEscolhida: { borderColor: cores.acao, backgroundColor: '#F0F4FF' },
  areaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingVertical: 8, paddingLeft: 10, paddingRight: 16,
    borderWidth: 2, borderColor: cores.gelo, borderRadius: 999, backgroundColor: cores.fundo },
  chipEscolhida: { borderColor: cores.acao, backgroundColor: '#F3F6FF' },
  chipDesativada: { backgroundColor: cores.nevoa },
  chipTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 22 },
  // Geração ao vivo
  contexto: { marginBottom: 8, color: cores.acao, fontFamily: fontes.corpo, fontWeight: '900', fontSize: 13, lineHeight: 18,
    letterSpacing: 0.5, textTransform: 'uppercase' },
  esqueletoTitulo: { width: '72%', maxWidth: 384, height: 28, marginVertical: 2, borderRadius: 8, backgroundColor: cores.gelo },
  geracaoIa: { marginTop: 16, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  geracaoOrigem: { marginTop: 4, color: cores.textoSecundario, fontFamily: fontes.corpo, fontSize: 14, lineHeight: 20 },
  esqueletoOrigem: { width: '48%', maxWidth: 256, height: 12, marginTop: 10, borderRadius: 8, backgroundColor: cores.gelo },
  geracaoAcoes: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metade: { flex: 1, minWidth: 0 },
  situacao: { flex: 1, minWidth: 0 },
  // .geracao-situacao__rotulo: 800 na entrelinha de 1,3.
  situacaoRotulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 20.8 },
  botaoDividido: { paddingHorizontal: 12 },
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
