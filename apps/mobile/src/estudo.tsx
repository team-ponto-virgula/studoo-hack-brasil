import { ESPERA_DA_GERACAO, dicaDaEspera, estadoDoCompartilhamento, falarTextoComFormulas, faltaParaTrocarADica, pedidoIdValido, type CriacaoPendente } from '@studoo/contratos';
import { AcompanharCriacao } from './acompanhar-criacao';
import { registrarToqueDaRetomada } from './registro-da-retomada';
import { MaterialParaTrilha } from './estudio-adaptativo';
import type { MaterialEstudo, ProvedorIa } from '@studoo/contratos';
import { ErroStudoo, LIMITES_GERACAO, origemDemonstracao, trilhaRepetida, mesmoDiagnostico, perfilComLink, type AutoAvaliacao, type NomeStu, type LicaoDetalhe, type LinkCompartilhado, type Perfil, type PassoDiagnostico, type PlanoDetalhe, type PlanoResumo, type Progresso, type PropostaPlano } from '@studoo/contratos';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, Animated, AppState, Platform, Easing, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { estiloDeEntrada, useAparecer, useContagem, usePulinho } from './animacoes';
import { codigoDaFalha, sessaoInvalida, type ClienteNativo } from './api-nativa';
import { Apresentacao } from './apresentacao';
import { Diagnostico, PontoDePartida, passoValido } from './diagnostico';
import { Caminho, SkeletonTrilha, type Faixa } from './caminho';
import { aplicarEvento, expiraEmDaProposta, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { Icone } from './icone';
import { guardarRascunho, tomarRascunho } from './rascunho';
import { AvisoDoApp, Botao, Campo, DeslocamentoDaRolagem, EstadoErro, RolagemDaTela, Pontinhos, SeloSincronia, Tela, Titulo, estilos, useBalanco, useMovimentoReduzido, type AcaoDoErro, type Sincronia, caixaAlta, CartaoConfirmacao, MenuDeAcoes, type AcaoDoMenu, degrauFora, degrade, quebraEquilibrada } from './interface';
import { NavegacaoContexto } from './navegacao';
import { FrasesDaLicao } from './aula-formatos';
import { TextoComFormulas } from './texto-com-formulas';
import { Licao, temAndamento, temAndamentoNoPlano, type ResumoLicao } from './licao';
import { mensagemDeErro, mensagemDoCodigo, mensagens, textoParaRever } from './mensagens';
import { regiaoDoTrecho, type NomeDesenho } from './mundo-desenhos';
import { Desenho, coresDaRegiao } from './mundo';
import { guardarRetornoDaTrilha, guardarTinhaTrilhas, lerTinhaTrilhas, lerTrilhaGuardada, marcarApresentacaoVista } from './preferencias';
import { iconeDoExemplo, iconesDosTemas, todosOsExemplos, type IdTema } from './temas';
import { cores, fontes } from './tema';
import { falaDoStu, liberadasEntre, montarTrilha, proximaDoCaminho, repeteTitulo, type NoCaminho, type NomeIcone } from './trilha';
import { focarSemRolar, focoVisivel } from './foco';
import { RITMO_DA_GERACAO, atrasosDaLicao, deixouDeAcompanhar, intervaloDaFila, raioQueCobre, rolagemDaTrilhaPronta, rolagemDaVaga, vagaAVista } from './geracao-ritmo';
import { PreCargaDoStu, Stu, TROFEU_DA_CRIACAO } from './mascote';
import { ouvirVoltar } from './voltar';
import { AbrirPerfil, AdicionarPorLink, AvisoDaTrilha, FolhaCompartilhar, MarcaCompartilhar, TrilhaRecebida, rotuloDoCompartilhamento } from './social';
import { PerfilSemSocial, TelaPerfil } from './perfil';
import { BotaoConfigurar, CapaDaTrilha, TelaConfiguracoes } from './configuracoes';
import { IrAoExplorar, ProvedorBloqueio, TelaExplorar, TelaPerfilPublico, TelaPreviaTrilha, type MemoriaExplorar } from './comunidade';
import { FolhaPostarNoPerfil, erroDePostar, estadoNoPerfil, ligadaNoPerfil, useAcoesDePostar } from './postar-perfil';
import { tocaSons } from './sons';
import { useCriacoesPendentes, type CriacaoAcompanhada } from './use-criacoes-pendentes';

/*
 * Estudo no app, com os mesmos passos da web (src/app/estudo.tsx): a pessoa escreve o que quer aprender, a trilha é montada
 * ao vivo, nó a nó, e Começar salva a trilha mostrada e abre a primeira lição (spec 03).
 */

type Etapa =
  | { tipo: 'apresentacao'; primeiraVez: boolean }
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'diagnostico' }
  | { tipo: 'geracao' }
  /** `concluida`: a lição que a pessoa acabou de concluir, para o caminho comemorar no nó dela. */
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[]; concluida?: string; aviso?: string }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; antes: Progresso; licao: LicaoDetalhe; liberadas: string[]; resumo?: ResumoLicao }
  // Perfis e compartilhar (spec 09 e 10): a tela Perfil e a tela Editar perfil, só com `compartilhar` no config.
  | { tipo: 'perfil'; focarNome?: boolean }
  // Configurações da trilha (spec 10, lote 4), só da dona: `volta` é de onde a pessoa veio (Minhas trilhas ou o mapa).
  | { tipo: 'configuracoes'; planoId: string; volta: 'planos' | 'plano' }
  // Comunidade (spec 10, B e C2), só com `comunidade` no config: o Explorar e, dentro do app, o perfil de outra pessoa (a
  // página /p da web) e a prévia de uma trilha (a página /t); `voltar` é a tela de onde a pessoa veio. `restaurar`: o
  // Explorar volta como estava (aba, tema, lista e rolagem) quando a pessoa volta de um perfil ou de uma trilha.
  | { tipo: 'explorar'; restaurar?: boolean }
  | { tipo: 'perfilPublico'; perfilId: string; voltar: Etapa }
  | { tipo: 'previaTrilha'; codigo: string; voltar: Etapa };

type PerguntaDiagnostico = Extract<PassoDiagnostico, { tipo: 'pergunta' }>;
type ModoPedido = 'ideia' | 'material';
type SessaoDiagnostico = {
  objetivo: string;
  passo: PassoDiagnostico | null;
  anteriores: { pergunta: PerguntaDiagnostico; opcaoId: string }[];
  revisando: number | null;
  pendente: boolean;
  erro: { codigo: string; opcaoId?: string } | null;
  encerrado: boolean;
  resultadoId?: string;
};

function passoVisivel(sessao: SessaoDiagnostico) {
  return sessao.revisando === null ? sessao.passo : sessao.anteriores[sessao.revisando]?.pergunta ?? sessao.passo;
}

type EtapaPlano = Extract<Etapa, { tipo: 'plano' }>;
export type DestinoPublico = Omit<Extract<Etapa, { tipo: 'perfilPublico' }>, 'voltar'> | Omit<Extract<Etapa, { tipo: 'previaTrilha' }>, 'voltar'>;
type Aba = 'planos' | 'objetivo' | 'plano' | 'perfil' | 'explorar';
const ABAS: readonly string[] = ['planos', 'objetivo', 'plano', 'perfil', 'explorar'];
/** A mesma folga posiciona a placa e reserva o espaço coberto no acompanhamento. */
const FOLGA_PLACA_GERACAO = 16;

/** A seção da barra de baixo de uma tela: o perfil de outra pessoa e a prévia ficam na seção de onde vieram. */
function abaDe(etapa: Etapa): Etapa['tipo'] {
  if (etapa.tipo === 'configuracoes') return 'planos';
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

/**
 * O toque em "Começar a lição 1" (spec 04, "Criar a trilha"): 'criando' enquanto o aceite não volta, 'erro' ou 'expirada'
 * quando ele falha (o botão volta, com a linha do motivo) e 'criada' na passagem para a aula. Sem pausa mínima: a tela
 * espera só a resposta.
 */
type FaseDaCriacao = 'criando' | 'guardando' | 'erro' | 'erro-salvar' | 'expirada' | 'criada';
type AceiteEmCurso = { pedidoId?: string; retomar: boolean; bloqueia: boolean };
/**
 * A passagem para a aula: quando o aceite voltou, de onde o círculo cresce (o centro do nó 1, na janela), se é a reduzida e
 * se a aula (ou o esqueleto dela) já está na tela, embaixo da camada.
 */
type Passagem = { inicio: number; origem: { x: number; y: number } | null; reduzida: boolean; aulaNaTela: boolean };
const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, Math.max(0, ms)));
const AVISO_DA_LICAO_NAO_ABERTA = 'Sua trilha foi salva. Ainda não conseguimos abrir a lição 1.';

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

export function Estudo({ cliente, visitante, destino, sair, expirar }: {
  cliente: ClienteNativo;
  visitante: boolean;
  destino?: DestinoPublico;
  sair: () => Promise<void>;
  expirar: () => Promise<void>;
}) {
  // `expirar` nasce de novo a cada desenho da raiz (um aviso do app já basta): fica numa referência, para a lista não
  // recarregar e reabrir a trilha em andamento quando alguém só avisou algo em Minhas trilhas.
  const expirarAtual = useRef(expirar);
  expirarAtual.current = expirar;
  // Uma consulta iniciada antes do aceite/apagamento não pode substituir a lista confirmada.
  const versaoPlanos = useRef(0);
  const montado = useRef(true);
  const criacoes = useCriacoesPendentes(cliente, montado);
  const [trilhaGuardada, setTrilhaGuardada] = useState<string | null>(null);
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
  const [etapa, setEtapa] = useState<Etapa>(() => destino ? { ...destino, voltar: { tipo: 'explorar' } } : { tipo: 'planos' });
  // O pedido guardado quando a sessão terminou no meio volta para o campo (rodada 4 da web).
  const [objetivo, setObjetivo] = useState(() => tomarRascunho());
  const objetivoAtual = useRef(objetivo);
  objetivoAtual.current = objetivo;
  const [modoPedido, setModoPedido] = useState<ModoPedido>('ideia');
  const [materialDoPedido, setMaterialDoPedido] = useState<MaterialEstudo | null>(null);
  /** Área escolhida no fim da apresentação: o pedido abre com as ideias dela. */
  const [areaInicial, setAreaInicial] = useState<IdTema | undefined>();
  const [pendente, setPendente] = useState<Acao | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  /** Código do último erro (o texto fica em `erro`): escolhe a ação do cartão de erro, como na web (3A.1). */
  const [codigoErro, setCodigoErro] = useState<string | null>(null);
  const diagnosticoAtual = useRef<SessaoDiagnostico | null>(null);
  const diagnosticoVisivel = useRef(false);
  const [diagnostico, setDiagnostico] = useState<SessaoDiagnostico | null>(null);
  const [geracao, setGeracao] = useState<TrilhaEmGeracao | null>(null);
  /** Código do erro da geração; o pedido mostra a mensagem e a ação que cabe (tentar de novo, ver os planos). */
  const [falhaGeracao, setFalhaGeracao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** A última busca real de progresso no servidor, para o selo de sincronia (Minhas trilhas e trilha aberta). */
  const [sincronia, setSincronia] = useState<Sincronia>({ estado: 'atualizando', em: null });
  const ultimaBusca = useRef(0);
  const emCurso = useRef(false);
  // A vez de cada pedido de executar() e o que está em andamento: um pedido abandonado não mexe mais na tela quando volta.
  const acaoAtual = useRef(0);
  const pendenteAgora = useRef<Acao | null>(null);
  const saidaDaLicao = useRef<(() => void) | null>(null);
  const geracaoAtiva = useRef<AbortController | null>(null);
  /** Criar a trilha: a fase do toque, a passagem para a aula e o aceite em andamento (de quem é a resposta que chegar). */
  const [criacao, setCriacao] = useState<FaseDaCriacao | null>(null);
  const [mensagemDoAceite, setMensagemDoAceite] = useState<string | null>(null);
  const criacaoAtual = useRef(criacao);
  criacaoAtual.current = criacao;
  const [passagem, setPassagem] = useState<Passagem | null>(null);
  const aceiteAtual = useRef<AceiteEmCurso | null>(null);
  const ultimaIntencaoDeAceite = useRef<object | null>(null);
  const aceitesEmCurso = useRef(new Map<string, Promise<PlanoDetalhe>>());
  const lenteDoNo1 = useRef<ComponentRef<typeof View> | null>(null);
  /** A rolagem do toque até o nó 1 (na prévia): a passagem a faz terminar até o círculo começar (t = 120 ms). */
  const rolagemDoNo1 = useRef<{ terminar: (prazoMs: number) => void } | null>(null);
  const reduzirMovimento = useMovimentoReduzido();
  const reduzirAgora = useRef(reduzirMovimento);
  reduzirAgora.current = reduzirMovimento;
  const ocupado = pendente !== null;
  /** Perfis e compartilhar (spec 09): só com `compartilhar` no /api/auth/config, como na web. */
  const [compartilhar, setCompartilhar] = useState(false);
  /** Comunidade (spec 10, etapa B): "Quem pode ver" em três níveis; só com `comunidade` no config. */
  const [comunidade, setComunidade] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  /** A trilha da folha "Compartilhar trilha" aberta, ou null. */
  const [folha, setFolha] = useState<string | null>(null);
  /** Muda quando a folha de compartilhar fecha: as configurações da trilha releem "Quem pode ver". */
  const [versaoFolha, setVersaoFolha] = useState(0);
  const guardaSaida = useRef<((continuar: () => void) => boolean) | null>(null);
  const registrarGuarda = useCallback((guarda: ((continuar: () => void) => boolean) | null) => { guardaSaida.current = guarda; }, []);
  // O aviso do próprio app (lote 4): o Valeu e a denúncia avisam numa faixa no pé da tela, nunca no sistema.
  // O aviso do app mora na raiz (sessao.tsx), para valer também na entrada (o aviso da música da primeira vez).
  const avisoDoApp = useContext(AvisoDoApp);
  /** O Explorar como a pessoa deixou ao abrir um perfil ou uma trilha dele (aba, tema, lista e rolagem). */
  const memoriaExplorar = useRef<MemoriaExplorar | null>(null);
  const guardarExplorar = useCallback((memoria: MemoriaExplorar) => { memoriaExplorar.current = memoria; }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarPlanos() {
      const vez = ++versaoPlanos.current;
      const recuperacao = criacoes.carregar().catch(() => undefined);
      setSincronia((anterior) => ({ estado: 'atualizando', em: anterior.em }));
      try {
        // Como na web: a lista e a configuração chegam juntas (o compartilhar decide a barra de baixo e o cabeçalho).
        const [lista, config, guardada] = await Promise.all([
          cliente.listarPlanos(), cliente.configuracaoAcesso().catch(() => null), lerTrilhaGuardada(),
        ]);
        // A apresentação é opcional, como na web.
        if (!ativo) return;
        const comCompartilhar = Boolean(config?.compartilhar);
        setCompartilhar(comCompartilhar);
        setComunidade(comCompartilhar && Boolean(config?.comunidade));
        if (comCompartilhar) void cliente.obterPerfil().then((dados) => { if (ativo) setPerfil(dados); }).catch(() => undefined);
        if (vez !== versaoPlanos.current) return;
        setPlanos(lista);
        marcarSincronia();
        if (guardada && lista.some(item => item.id === guardada && item.progresso.concluidas === 0)) {
          setTrilhaGuardada(guardada);
          return;
        }
        if (guardada) void guardarRetornoDaTrilha(null);
        // Na reabertura, Minhas trilhas mostra o pedido local e consulta o servidor antes de oferecer a lição.
        await recuperacao;
        if (!ativo || vez !== versaoPlanos.current || criacoes.temPendencias()) return;
        // Sem trilhas, a abertura é a "Nova trilha", com o foco no campo (regra de 19/11); o vazio de Minhas trilhas só
        // aparece quando a pessoa toca em "Minhas trilhas" (spec 05, d8df51c).
        if (lista.length === 0) setEtapa((atual) => (atual.tipo === 'planos' ? { tipo: 'objetivo' } : atual));
        // Como na web: com planos salvos, abre direto na trilha em andamento (só se a pessoa ainda está em Meus planos).
        const inicial = planoInicial(lista);
        if (inicial) {
          try {
            const plano = await cliente.obterPlano(inicial.id);
            if (!ativo || vez !== versaoPlanos.current) return;
            setEtapa((atual) => atual.tipo === 'planos' ? { tipo: 'plano', plano } : atual);
          } catch (falha) {
            // Sem o detalhe (rede lenta, servidor fora), a pessoa fica em Minhas trilhas, que funciona, mas com o erro e
            // "Tentar novamente" (busca a lista e abre a trilha de novo); antes, a lista ficava parada sem dizer nada.
            if (!ativo || vez !== versaoPlanos.current) return;
            if (sessaoInvalida(falha)) await expirarGuardando();
            else mostrarErro(falha);
          }
        }
      } catch (falha) {
        if (!ativo || vez !== versaoPlanos.current) return;
        if (sessaoInvalida(falha)) await expirarGuardando();
        else {
          mostrarErro(falha);
          setSincronia((anterior) => ({ estado: 'offline', em: anterior.em }));
        }
      }
    }

    void carregarPlanos();
    return () => { ativo = false; };
  }, [cliente, criacoes.carregar, tentativa]);

  // Sair do estudo no meio da geração interrompe o pedido; o servidor não guarda nada.
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; geracaoAtiva.current?.abort(); };
  }, []);

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
    const vez = ++versaoPlanos.current;
    setSincronia((anterior) => ({ estado: 'atualizando', em: anterior.em }));
    try {
      const lista = await cliente.listarPlanos();
      if (vez !== versaoPlanos.current) return;
      setPlanos(lista);
      if (atual.tipo === 'plano') {
        const plano = await cliente.obterPlano(atual.plano.id);
        if (vez !== versaoPlanos.current) return;
        setEtapa((agora) => (agora.tipo === 'plano' && agora.plano.id === plano.id ? { ...agora, plano } : agora));
      }
      marcarSincronia();
    } catch (falha) {
      if (vez !== versaoPlanos.current) return;
      if (sessaoInvalida(falha)) await expirarGuardando();
      else setSincronia((anterior) => ({ estado: 'offline', em: anterior.em }));
    }
  }
  const etapaAtual = useRef(etapa);
  etapaAtual.current = etapa;
  const sincronizar = useRef(sincronizarAgora);
  sincronizar.current = sincronizarAgora;
  const aoMudarEstado = useRef(observarEstadoDoAceite);
  aoMudarEstado.current = observarEstadoDoAceite;
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      aoMudarEstado.current(estado);
      if (estado === 'active') void sincronizar.current();
    });
    return () => assinatura.remove();
  }, []);

  function observarEstadoDoAceite(estado: string) {
    const vez = aceiteAtual.current;
    if (estado !== 'active') {
      if (vez?.pedidoId) vez.retomar = true;
      return;
    }
    if (vez?.pedidoId && vez.retomar && vez.bloqueia) {
      // Na volta, a tela acompanha por consulta. O POST original pode ainda estar a caminho.
      liberarAceite(vez);
      setCriacao(null);
      setPassagem(null);
    }
    for (const item of criacoes.itens) {
      if (item.estado?.estado !== 'pronto') void criacoes.consultar(item.pedido);
    }
  }

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // O mesmo voltar serve ao botão do Android e ao gesto de borda do iPhone (voltar.ts); em Minhas trilhas, o gesto não começa.
    const assinatura = ouvirVoltar(() => {
      // Voltar durante "Criando sua trilha…": sai sem cancelar no servidor; a trilha aparece em Minhas trilhas.
      if (criacaoAtual.current === 'criando' || criacaoAtual.current === 'guardando') {
        sairDaCriacao();
        return true;
      }
      // Com um pedido em andamento, o voltar espera; na lição, a correção de uma resposta pode ser abandonada (rede lenta).
      if (emCurso.current && !(etapa.tipo === 'licao' && abandonarCorrecao())) return true;
      if (etapa.tipo === 'planos') return false;
      if (etapa.tipo === 'apresentacao') {
        void concluirApresentacao();
        return true;
      }
      if (etapa.tipo === 'diagnostico') {
        navegar({ tipo: 'objetivo' });
      } else if (etapa.tipo === 'geracao') {
        if (geracao?.proposta) navegar({ tipo: 'objetivo' });
        else cancelarGeracao();
      } else if (etapa.tipo === 'licao') {
        if (saidaDaLicao.current) saidaDaLicao.current();
        else void abrirPlano(etapa.plano.id, etapa.licao.id);
      }
      else if (etapa.tipo === 'concluida') navegar(voltarATrilha(etapa));
      else if (etapa.tipo === 'perfilPublico' || etapa.tipo === 'previaTrilha') navegar(etapa.voltar);
      else if (etapa.tipo === 'configuracoes' && etapa.volta === 'plano') void abrirPlano(etapa.planoId);
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
  const expirarGuardando = useCallback(async () => {
    guardarRascunho(objetivoAtual.current);
    await expirarAtual.current();
  }, []);

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
    // Saindo do perfil com os dados abertos e alteração não salva: o editor pergunta antes ("Sair sem salvar?"), como na web.
    if (guardaSaida.current?.(() => { guardaSaida.current = null; navegar(destino); })) return;
    diagnosticoVisivel.current = destino.tipo === 'diagnostico';
    if (destino.tipo !== 'geracao') {
      if (aceiteAtual.current) terminarCriacao();
      pararGeracao();
      setCriacao(null);
    }
    setErro(null);
    setFalhaGeracao(null);
    setAviso(null);
    etapaAtual.current = destino;
    setEtapa(destino);
  }

  /** "Minhas trilhas" (aba ou botão do alto): com o vazio já na tela, o Stu dá um pulo; senão, abre a lista. */
  const [puloDoVazio, setPuloDoVazio] = useState(0);
  const mostrarVazioDosPlanos = planos?.length === 0 && criacoes.itens.length === 0;
  function tocarMinhasTrilhas() {
    if (etapa.tipo === 'planos' && mostrarVazioDosPlanos) { setPuloDoVazio((vezes) => vezes + 1); return; }
    abrir({ tipo: 'planos' });
  }

  /** Troca de etapa por um toque: espera a ação em andamento terminar. */
  function abrir(destino: Etapa) {
    if (emCurso.current) return;
    navegar(destino);
  }

  async function executar<T>(acao: Acao, operacao: () => Promise<T>): Promise<Resultado<T>> {
    if (emCurso.current) return { ok: false, codigo: 'falha' };
    emCurso.current = true;
    const vez = ++acaoAtual.current;
    pendenteAgora.current = acao;
    Keyboard.dismiss();
    setPendente(acao);
    setErro(null);
    try {
      return { ok: true, dados: await operacao() };
    } catch (falha) {
      // Pedido abandonado (a pessoa saiu da lição durante a correção): a falha que chega depois não vira erro em outra tela.
      if (vez !== acaoAtual.current) return { ok: false, codigo: codigoDaFalha(falha) };
      if (sessaoInvalida(falha)) await expirarGuardando();
      else mostrarErro(falha);
      return { ok: false, codigo: codigoDaFalha(falha) };
    } finally {
      if (vez === acaoAtual.current) {
        emCurso.current = false;
        pendenteAgora.current = null;
        setPendente(null);
      }
    }
  }

  /**
   * Rede lenta: sair da lição durante a correção de uma resposta (até ~30 s parada em "Etapa 3 de 4"). Só a correção
   * (`avaliar`) pode ser abandonada: a resposta continua no andamento guardado e é corrigida de novo na volta. A conclusão
   * não: ela grava o progresso e leva à festa, e sair no meio dela deixaria o mapa e a tela da conclusão brigando.
   */
  function abandonarCorrecao() {
    if (pendenteAgora.current !== 'avaliar') return false;
    acaoAtual.current += 1;
    pendenteAgora.current = null;
    emCurso.current = false;
    setPendente(null);
    return true;
  }

  function atualizarObjetivo(texto: string) {
    if (emCurso.current) return;
    // Sem trilhas, a lista mostra o pedido. Ao editar, torna a tela explícita para ela continuar aberta se uma trilha chegar.
    if (etapaAtual.current.tipo === 'planos') setEtapa({ tipo: 'objetivo' });
    setErro(null);
    if (texto.trim() !== objetivo.trim()) {
      setFalhaGeracao(null);
      salvarDiagnostico(null);
    }
    setObjetivo(texto);
  }

  function atualizarPlano(plano: PlanoDetalhe) {
    // Toda trilha que chega aqui veio agora do servidor (abrir, aceitar, concluir).
    marcarSincronia();
    ++versaoPlanos.current;
    const { id, titulo, progresso, tema, capa, link, recebida, diagnostico } = plano;
    const resumo = { id, titulo, progresso, tema, capa, link, recebida, diagnostico };
    setPlanos((anteriores) => anteriores?.some((item) => item.id === resumo.id)
      ? anteriores.map((item) => item.id === resumo.id ? { ...item, ...resumo } : item)
      : [resumo, ...(anteriores ?? [])]);
  }

  /**
   * Geração ao vivo: a tela troca para a trilha vazia e cada evento do fluxo entra no caminho assim que chega.
   * Um erro, antes ou durante a geração, volta ao pedido com o texto mantido e a mensagem do código.
   */
  async function gerar(texto: string, diagnosticoId?: string) {
    if (emCurso.current) return;
    geracaoAtiva.current?.abort();
    const controle = new AbortController();
    geracaoAtiva.current = controle;
    let trilha: TrilhaEmGeracao = { objetivo: texto, titulo: null, fluxos: [], proposta: null };
    Keyboard.dismiss();
    setCriacao(null);
    navegar({ tipo: 'geracao' });
    setGeracao(trilha);

    try {
      for await (const evento of cliente.gerarTrilhaAoVivo(texto, controle.signal, diagnosticoId)) {
        if (controle.signal.aborted) return;
        if (evento.tipo === 'erro') throw new ErroStudoo(evento.codigo);
        trilha = aplicarEvento(trilha, evento);
        setGeracao(trilha);
        if (evento.tipo === 'plano') anunciar(mensagens.geracao.anuncioTitulo(evento.titulo));
        // O fim é anunciado pela tela da geração, quando a última lição da fila entra ("Trilha pronta, 9 lições. Começar.").
        if (evento.tipo === 'pronto') return;
      }
      throw new ErroStudoo('falha');
    } catch (falha) {
      if (controle.signal.aborted) return;
      if (sessaoInvalida(falha)) {
        await expirarGuardando();
        return;
      }
      const codigo = codigoDaFalha(falha);
      if (codigo === 'conteudo_nocivo') salvarDiagnostico(null);
      if (diagnosticoId && codigo === 'proposta_invalida' && !trilha.titulo && trilha.fluxos.length === 0) {
        const atual = diagnosticoAtual.current;
        if (atual?.resultadoId === diagnosticoId) salvarDiagnostico({ ...atual, resultadoId: undefined });
        await gerar(texto);
        return;
      }
      navegar({ tipo: 'objetivo' });
      setFalhaGeracao(codigo);
    } finally {
      if (geracaoAtiva.current === controle) geracaoAtiva.current = null;
    }
  }

  function salvarDiagnostico(sessao: SessaoDiagnostico | null) {
    diagnosticoAtual.current = sessao;
    setDiagnostico(sessao);
  }

  async function pedirPassoDiagnostico(sessao: SessaoDiagnostico, opcaoId?: string) {
    if (sessao.pendente || sessao.encerrado) return;
    const pedido = { ...sessao, pendente: true, erro: null };
    salvarDiagnostico(pedido);
    try {
      const exibido = passoVisivel(pedido);
      const anterior = exibido?.tipo === 'pergunta' ? exibido : null;
      const passo = anterior && opcaoId
        ? await cliente.responderDiagnostico(anterior.id, anterior.pergunta.id, opcaoId)
        : await cliente.iniciarDiagnostico(pedido.objetivo);
      if (diagnosticoAtual.current !== pedido) return;
      if (!passoValido(passo, anterior)) throw new ErroStudoo('falha');
      let anteriores = pedido.anteriores;
      if (anterior && opcaoId && anteriores[anterior.numero - 1]?.opcaoId !== opcaoId) {
        anteriores = [...anteriores.slice(0, anterior.numero - 1), { pergunta: anterior, opcaoId }];
      }
      salvarDiagnostico({ ...pedido, anteriores, revisando: null, pendente: false, passo });
    } catch (falha) {
      if (diagnosticoAtual.current !== pedido) return;
      const codigo = codigoDaFalha(falha);
      if (codigo === 'conteudo_nocivo' || codigo === 'consentimento_ia' || sessaoInvalida(falha)) {
        salvarDiagnostico(codigo === 'conteudo_nocivo' ? null : { ...pedido, pendente: false });
        if (!diagnosticoVisivel.current) return;
        navegar({ tipo: 'objetivo' });
        if (sessaoInvalida(falha)) await expirarGuardando();
        else setFalhaGeracao(codigo);
        return;
      }
      // Servidor anterior à rota de diagnóstico: mantém a criação já suportada.
      if (codigo === 'nao_encontrado' && !pedido.passo && diagnosticoVisivel.current) {
        salvarDiagnostico({ ...pedido, pendente: false, encerrado: true });
        void gerar(pedido.objetivo);
        return;
      }
      salvarDiagnostico({ ...pedido, pendente: false, erro: { codigo, opcaoId } });
    }
  }

  function iniciarPedido(texto: string) {
    const anterior = diagnosticoAtual.current;
    if (anterior?.objetivo === texto && anterior.encerrado) {
      void gerar(texto, anterior.resultadoId);
      return;
    }
    if (anterior?.objetivo !== texto) salvarDiagnostico({
      objetivo: texto, passo: null, anteriores: [], revisando: null, pendente: false, erro: null, encerrado: false,
    });
    navegar({ tipo: 'diagnostico' });
  }

  function terminarDiagnostico() {
    const sessao = diagnosticoAtual.current;
    if (!sessao || !diagnosticoVisivel.current) return;
    const resultadoId = sessao.anteriores.length > 0 || sessao.passo?.tipo === 'resultado' ? sessao.passo?.id : undefined;
    salvarDiagnostico({ ...sessao, pendente: false, encerrado: true, resultadoId });
    void gerar(sessao.objetivo, resultadoId);
  }

  function voltarPergunta() {
    const atual = diagnosticoAtual.current;
    if (!atual || atual.pendente) return;
    const posicao = (atual.revisando ?? atual.anteriores.length) - 1;
    if (posicao >= 0) salvarDiagnostico({ ...atual, revisando: posicao, erro: null });
  }

  function cancelarGeracao() {
    navegar({ tipo: 'objetivo' });
    setAviso(mensagens.pedido.cancelada);
    anunciar(mensagens.pedido.cancelada);
  }

  /**
   * "Começar a lição 1" (spec 04, "Criar a trilha"): um toque salva a trilha mostrada (o aceite escreve o conteúdo das
   * lições) e abre a etapa 1 da lição 1, sem tela no meio e sem pausa mínima. Enquanto o aceite não volta, o botão diz
   * "Criando sua trilha…". Quando volta: toca o som único da criação, o nó 1 pulsa, a busca da lição começa junto com a
   * passagem e, aos 320 ms, a aula (ou o esqueleto dela, se a lição ainda não chegou) entra por cima do círculo. O mesmo
   * token numa nova tentativa devolve a trilha já criada, sem duplicar. Sair durante a criação não cancela no servidor.
   */
  function aceitarUmaVez(token: string) {
    const emAndamento = aceitesEmCurso.current.get(token);
    if (emAndamento) return emAndamento;
    const pedido = cliente.aceitarProposta(token).finally(() => aceitesEmCurso.current.delete(token));
    aceitesEmCurso.current.set(token, pedido);
    return pedido;
  }

  async function comecar(proposta: PropostaPlano | CriacaoPendente, abrirPrimeira = true) {
    if (emCurso.current || aceiteAtual.current || aceitesEmCurso.current.has(proposta.token)) return;
    const reenvio = 'versao' in proposta;
    const agora = Date.now();
    const pedido: CriacaoPendente | undefined = reenvio ? { ...proposta, enviadoEm: agora }
      : pedidoIdValido(proposta.pedidoId) ? {
        versao: 1, pedidoId: proposta.pedidoId, token: proposta.token, titulo: proposta.titulo,
        intencao: abrirPrimeira ? 'comecar' : 'salvar',
        licoes: proposta.fluxos.reduce((total, parte) => total + parte.licoes.length, 0),
        partes: proposta.fluxos.length, enviadoEm: agora, propostaExpiraEm: geracao?.propostaExpiraEm,
      } : undefined;
    const vez: AceiteEmCurso = { pedidoId: pedido?.pedidoId, retomar: reenvio, bloqueia: etapaAtual.current.tipo === 'geracao' };
    aceiteAtual.current = vez;
    ultimaIntencaoDeAceite.current = vez;
    if (vez.bloqueia) {
      emCurso.current = true;
      Keyboard.dismiss();
      setPendente('aceitar');
      setErro(null);
      setMensagemDoAceite(null);
      setCriacao(abrirPrimeira ? 'criando' : 'guardando');
      // Sem som no toque: o único som da criação é o geracao_pronta, quando a trilha passa a existir (spec 12).
      anunciar(pedido
        ? abrirPrimeira ? mensagens.geracao.anuncioPreparando : mensagens.geracao.anuncioSalvandoSuaTrilha
        : abrirPrimeira ? mensagens.geracao.anuncioCriando : mensagens.geracao.anuncioSalvando);
    }
    let guardou = false;
    let plano: PlanoDetalhe;
    try {
      if (pedido) {
        const enviar = await criacoes.guardar(pedido, reenvio);
        // Sair da prévia não desfaz o toque que já reservou o envio. Sair da conta encerra o estudo.
        if (!montado.current) return;
        if (!enviar) {
          if (aceiteAtual.current === vez) {
            terminarCriacao();
            setCriacao(null);
          }
          return;
        }
        guardou = true;
      }
      plano = await aceitarUmaVez(proposta.token);
      if (pedido && plano?.id !== pedido.pedidoId) throw new ErroStudoo('falha');
    } catch (falha) {
      // Saiu durante a criação: a resposta não é mais desta tela.
      if (aceiteAtual.current !== vez) {
        if (pedido && guardou && montado.current) void criacoes.consultar(pedido);
        return;
      }
      terminarCriacao();
      if (sessaoInvalida(falha)) {
        setCriacao(null);
        await expirarGuardando();
        return;
      }
      const codigo = codigoDaFalha(falha);
      if (codigo === 'conteudo_nocivo') {
        if (pedido) void criacoes.esquecer(pedido.pedidoId).catch(() => undefined);
        salvarDiagnostico(null);
        navegar({ tipo: 'objetivo' });
        setFalhaGeracao(codigo);
        return;
      }
      if (pedido && guardou && codigo !== 'consentimento_ia') {
        // Uma falha do POST pode ter ocorrido depois de gravar. A consulta separa ausência, preparo, gravação e falha.
        setCriacao(null);
        void criacoes.consultar(pedido);
        return;
      }
      if (pedido && codigo === 'consentimento_ia') {
        void criacoes.esquecer(pedido.pedidoId).catch(() => undefined);
        if (etapaAtual.current.tipo !== 'geracao') mostrarErro(falha);
      }
      if (pedido && !guardou && codigo !== 'consentimento_ia') {
        setCriacao(null);
        mostrarErro(falha);
        return;
      }
      const expirada = codigo === 'proposta_invalida';
      const aviso = codigo === 'ia_indisponivel' || codigo === 'consentimento_ia' ? mensagemDoCodigo(codigo) : null;
      setMensagemDoAceite(aviso);
      setCriacao(expirada ? 'expirada' : abrirPrimeira ? 'erro' : 'erro-salvar');
      const texto = aviso ?? (abrirPrimeira ? mensagens.geracao.erroCriacao : mensagens.geracao.erroSalvar);
      anunciar(expirada ? mensagens.geracao.propostaExpirada : texto);
      return;
    }
    // A trilha existe no servidor: entra em Minhas trilhas mesmo se a pessoa já saiu daqui.
    if (!montado.current) return;
    if (pedido) criacoes.confirmar(pedido, plano);
    atualizarPlano(plano);
    if (!abrirPrimeira && ultimaIntencaoDeAceite.current === vez) {
      void guardarRetornoDaTrilha(plano.id);
      setTrilhaGuardada(plano.id);
    }
    if (aceiteAtual.current !== vez) return;
    if (etapaAtual.current.tipo !== 'geracao' || vez.retomar) {
      terminarCriacao();
      setCriacao(null);
      return;
    }
    setObjetivo('');
    setMaterialDoPedido(null);
    setModoPedido('ideia');
    diagnosticoAtual.current = null;
    setDiagnostico(null);
    if (!abrirPrimeira) {
      if (pedido) void criacoes.esquecer(pedido.pedidoId).catch(() => undefined);
      terminarCriacao();
      navegar({ tipo: 'planos' });
      return;
    }
    const primeira = proximaDoCaminho(plano);
    if (!primeira) {
      if (pedido) void criacoes.esquecer(pedido.pedidoId).catch(() => undefined);
      terminarCriacao();
      navegar({ tipo: 'plano', plano });
      return;
    }
    // t = 0, no aceite (spec 04, 4140a58): o som único da criação, o pulso do nó 1, o caminho que firma e a busca da lição.
    // Se a rolagem do toque até o nó 1 ainda anda, ela termina até t = 120 ms (longe demais ou com movimento reduzido, pula).
    const inicio = Date.now();
    const reduzida = reduzirAgora.current !== false;
    let licao: LicaoDetalhe | null = null;
    let falhaLicao: unknown = null;
    const busca = cliente.obterLicao(primeira).then((dados) => { licao = dados; }, (falha: unknown) => { falhaLicao = falha ?? new ErroStudoo('falha'); });
    rolagemDoNo1.current?.terminar(reduzida ? 0 : RITMO_DA_GERACAO.circuloAtrasoMs);
    tocaSons.tocarEfeito('geracao_pronta');
    setCriacao('criada');
    setPassagem({ inicio, origem: null, reduzida, aulaNaTela: false });
    // De onde o círculo cresce: o centro do nó 1, medido no t = 120 ms, com a rolagem até ele já terminada. O círculo espera
    // essa medida.
    const medirNo1 = () => lenteDoNo1.current?.measureInWindow((x, y, largura, altura) => {
      if (largura > 0) setPassagem((atual) => (atual && atual.inicio === inicio ? { ...atual, origem: { x: x + largura / 2, y: y + altura / 2 } } : atual));
    });
    if (!reduzida) setTimeout(medirNo1, RITMO_DA_GERACAO.circuloAtrasoMs + 5);
    const aulaNaTela = () => setPassagem((atual) => (atual && atual.inicio === inicio ? { ...atual, aulaNaTela: true } : atual));
    // Aos 200 ms (com movimento reduzido, na hora), a aula monta embaixo do círculo; se a lição ainda não chegou, o esqueleto
    // dela. A camada some por cima dela a partir dos 320 ms, só depois que ela está na tela.
    await esperar(inicio + (reduzida ? 0 : RITMO_DA_GERACAO.aulaMontaMs) - Date.now());
    if (aceiteAtual.current !== vez) return;
    if (vez.retomar) {
      terminarCriacao();
      setCriacao(null);
      setPassagem(null);
      return;
    }
    if (!licao && !falhaLicao) {
      setPendente('abrir');
      aulaNaTela();
      await busca;
      if (aceiteAtual.current !== vez) return;
      if (vez.retomar) {
        terminarCriacao();
        setCriacao(null);
        setPassagem(null);
        return;
      }
    }
    terminarCriacao();
    aulaNaTela();
    const pronta = licao as LicaoDetalhe | null;
    if (pronta) {
      if (pedido) void criacoes.esquecer(pedido.pedidoId).catch(() => undefined);
      navegar({ tipo: 'licao', plano, licao: pronta });
      anunciar(mensagens.geracao.anuncioCriada(pronta.titulo));
      return;
    }
    if (sessaoInvalida(falhaLicao)) {
      await expirarGuardando();
      return;
    }
    // Se o aceite é rastreável, a prévia agora oferece abrir a lição da trilha confirmada.
    if (pedido) {
      setCriacao(null);
      setPassagem(null);
      setErro(AVISO_DA_LICAO_NAO_ABERTA);
      return;
    }
    // Servidor anterior à retomada: o mapa salvo, com o erro da leitura da lição.
    const codigo = codigoDaFalha(falhaLicao);
    navegar({ tipo: 'plano', plano });
    setErro(mensagemDoCodigo(codigo));
    setCodigoErro(codigo);
  }

  /** Fim da criação (a aula abriu, ou a pessoa foi para outra tela): libera as ações. A passagem acaba sozinha. */
  function terminarCriacao() {
    const vez = aceiteAtual.current;
    if (vez) liberarAceite(vez);
    aceiteAtual.current = null;
  }

  function liberarAceite(vez: AceiteEmCurso) {
    if (!vez.bloqueia) return;
    vez.bloqueia = false;
    emCurso.current = false;
    setPendente(null);
  }

  /** Sair durante "Criando sua trilha…" (voltar, gesto ou Minhas trilhas): o aceite segue no servidor e a resposta é ignorada. */
  function sairDaCriacao() {
    terminarCriacao();
    navegar({ tipo: 'planos' });
  }

  // A camada do círculo sai quando termina de sumir por cima da aula (PassagemDaCriacao avisa); se algo a deixar parada (a
  // aula não montou), sai sozinha depois de 3 s, para nunca tapar a tela.
  const inicioDaPassagem = passagem?.inicio;
  useEffect(() => {
    if (inicioDaPassagem === undefined) return;
    const limite = setTimeout(() => setPassagem(null), 3000);
    return () => clearTimeout(limite);
  }, [inicioDaPassagem]);

  /**
   * Confirmações (sair e apagar) no cartão da web (.modal-cartao), com "Cancelar" e a confirmação, no lugar da caixa do
   * sistema (levantamento de paridade, G7). O voltar do aparelho cancela.
   */
  const [confirmacao, setConfirmacao] = useState<{ mensagem: string; texto?: string; aviso?: string; confirmarRotulo: string; cancelarRotulo?: string; destrutivo?: boolean;
    aoConfirmar: () => void } | null>(null);

  /** Sair fica no alto, onde muita gente procura "voltar": pergunta antes de encerrar a sessão. Como na web. */
  function pedirParaSair(paraEntrar: boolean) {
    const m = mensagens.sessaoVisitante;
    setConfirmacao({
      mensagem: visitante ? (paraEntrar ? m.entrarTitulo : m.sairTitulo) : mensagens.sairPergunta,
      texto: visitante ? (paraEntrar ? m.entrarTexto : m.sairTexto) : undefined,
      confirmarRotulo: paraEntrar ? m.entrar : mensagens.sair,
      cancelarRotulo: visitante ? m.ficar : undefined,
      aoConfirmar: () => void executar('sair', sair),
    });
  }

  /**
   * Apaga uma trilha depois da confirmação do Studoo (spec 10 e 11, revisão de 19/11): o título "Apagar “X”?", o texto com as
   * lições e o progresso, o aviso do link num parágrafo à parte e "Cancelar" e "Apagar" (vermelho cheio) lado a lado.
   */
  function pedirParaApagar(plano: PlanoResumo) {
    setConfirmacao({
      mensagem: mensagens.planos.apagarTitulo(plano.titulo),
      texto: mensagens.planos.apagarTexto(plano.progresso.total, plano.progresso.concluidas),
      aviso: plano.link ? mensagens.compartilhar.apagarAviso : undefined,
      confirmarRotulo: mensagens.planos.apagar, cancelarRotulo: mensagens.planos.apagarCancelar, destrutivo: true, aoConfirmar: () => void apagarPlano(plano),
    });
  }

  async function apagarPlano(plano: PlanoResumo) {
    const resultado = await executar('apagar', () => cliente.apagarPlano(plano.id));
    if (!resultado.ok) return;
    if (criacoes.obter(plano.id)) void criacoes.esquecer(plano.id).catch(() => undefined);
    if (plano.id === trilhaGuardada) {
      setTrilhaGuardada(null);
      void guardarRetornoDaTrilha(null);
    }
    void tocaSons.tocarEfeito('apagar');
    ++versaoPlanos.current;
    setPlanos((anteriores) => anteriores?.filter((item) => item.id !== plano.id) ?? null);
    // Apagada pelas configurações dela: a tela não existe mais, e a pessoa volta a Minhas trilhas.
    setEtapa((atual) => (atual.tipo === 'configuracoes' && atual.planoId === plano.id ? { tipo: 'planos' } : atual));
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
    ++versaoPlanos.current;
    setPlanos((anteriores) => anteriores?.map((item) => (item.id === planoId ? { ...item, link: marca } : item)) ?? null);
    setEtapa((atual) => ('plano' in atual && atual.plano.id === planoId ? { ...atual, plano: { ...atual.plano, link: marca } } : atual));
  }

  /**
   * Postar no perfil (spec 10, 20/11): o atalho do "•••" faz o mesmo que a chave da folha, com os mesmos avisos e a mesma
   * confirmação. Na primeira publicação no perfil, ou sem nome, abre a folha, para a linha das regras e o nome virem antes.
   */
  const [folhaPostar, setFolhaPostar] = useState(false);
  function aplicarLinkNoPerfil(planoId: string, novo: LinkCompartilhado) {
    mudarLink(planoId, novo);
    setPerfil((atual) => atual && perfilComLink(atual, planoId, novo));
  }
  const acoesDePostar = useAcoesDePostar({ cliente, aoMudarLink: aplicarLinkNoPerfil });
  async function postarPeloMenu(plano: PlanoResumo) {
    let atual = perfil;
    try {
      if (!atual) { atual = await cliente.obterPerfil(); setPerfil(atual); }
      const link = atual.links.find((item) => item.planoId === plano.id) ?? null;
      if (!ligadaNoPerfil(estadoNoPerfil(link))) {
        if (!atual.nome?.trim() || !atual.links.some((item) => item.noPerfil)) { setFolhaPostar(true); return; }
        await acoesDePostar.ligar(plano.id, link);
      } else if (link) {
        await acoesDePostar.desligar(plano.id, link);
      }
    } catch (falha) {
      avisoDoApp.avisar(erroDePostar(falha), { icone: 'alerta' });
    }
  }
  const postarDe = (plano: PlanoResumo) => (abrirFolha && comunidade && !plano.recebida && !perfil?.visitante
    ? { noPerfil: Boolean(plano.link?.noPerfil), acao: () => void postarPeloMenu(plano) } : undefined);

  /** Trilha adicionada pelo link (ou já tinha): abre o mapa dela, com o aviso de quem compartilhou. Como na web. */
  async function aoAdicionarPorLink(planoId: string, nomeDono: string, jaTinha: boolean) {
    try {
      const vez = ++versaoPlanos.current;
      const lista = await cliente.listarPlanos();
      if (vez === versaoPlanos.current) setPlanos(lista);
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
  async function abrirLicao(plano: PlanoDetalhe, id: string, retomada = false) {
    if (emCurso.current) return false;
    setAbrindo(id);
    const resultado = await executar('abrir', () => {
      if (retomada) registrarToqueDaRetomada('obter-licao');
      return cliente.obterLicao(id);
    });
    setAbrindo(null);
    if (!resultado.ok) return false;
    if (plano.id === trilhaGuardada) {
      setTrilhaGuardada(null);
      void guardarRetornoDaTrilha(null);
    }
    navegar({ tipo: 'licao', plano, licao: resultado.dados });
    if (criacoes.obter(plano.id)) void criacoes.esquecer(plano.id).catch(() => undefined);
    return true;
  }

  async function abrirCriacaoRecuperada(pedido: CriacaoPendente, plano: PlanoDetalhe) {
    if (pedido.intencao === 'comecar') {
      registrarToqueDaRetomada(emCurso.current ? 'abertura-bloqueada' : 'iniciou-abertura');
    }
    if (emCurso.current) return;
    const etapaDeOrigem = etapaAtual.current;
    atualizarPlano(plano);
    if (pedido.intencao === 'salvar') {
      void guardarRetornoDaTrilha(plano.id);
      setTrilhaGuardada(plano.id);
      navegar({ tipo: 'planos' });
    } else {
      const primeira = plano.fluxos.find(parte => parte.licoes.length > 0)?.licoes[0];
      if (primeira) {
        const abriu = await abrirLicao(plano, primeira.id, true);
        registrarToqueDaRetomada(abriu ? 'licao-aberta' : 'falha-ao-abrir');
        if (!abriu && montado.current && etapaAtual.current === etapaDeOrigem) {
          setErro(AVISO_DA_LICAO_NAO_ABERTA);
        }
        return;
      }
      navegar({ tipo: 'plano', plano });
    }
    void criacoes.esquecer(pedido.pedidoId).catch(() => undefined);
  }

  async function ajustarCriacaoRecuperada(pedido: CriacaoPendente, editar: boolean) {
    if (emCurso.current) return;
    const etapaDeOrigem = etapaAtual.current;
    try {
      await criacoes.esquecer(pedido.pedidoId);
    } catch (falha) {
      if (etapaAtual.current === etapaDeOrigem) mostrarErro(falha);
      return;
    }
    if (etapaAtual.current !== etapaDeOrigem || emCurso.current) return;
    if (editar) salvarDiagnostico(null);
    if (!editar && etapaDeOrigem.tipo === 'geracao' && geracao && !geracao.deMaterial) {
      const sessao = diagnosticoAtual.current;
      void gerar(geracao.objetivo, sessao?.objetivo === geracao.objetivo ? sessao.resultadoId : undefined);
    } else {
      navegar({ tipo: 'objetivo' });
    }
  }

  function cartaoDaCriacao(item: CriacaoAcompanhada, mostrarTitulo = false) {
    return <AcompanharCriacao key={item.pedido.pedidoId} item={item} mostrarTitulo={mostrarTitulo} ocupado={ocupado}
      consultar={criacoes.consultar} aoExpirarSessao={expirarGuardando}
      abrir={(pedido, plano) => void abrirCriacaoRecuperada(pedido, plano)}
      reenviar={(pedido) => void comecar(pedido, pedido.intencao === 'comecar')}
      ajustar={(pedido, editar) => void ajustarCriacaoRecuperada(pedido, editar)}
      sairParaLista={mostrarTitulo ? undefined : tocarMinhasTrilhas} />;
  }

  async function concluir(plano: PlanoDetalhe, licao: LicaoDetalhe, comprovante: string, resumo?: ResumoLicao, pratica?: AutoAvaliacao) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante, pratica,
      resumo && { segundos: resumo.segundos, acertosDePrimeira: resumo.acertosDePrimeira, exercicios: resumo.exercicios }));
    if (resultado.ok) {
      const atualizado = resultado.dados.plano;
      // A última lição fecha a trilha: o som é o da trilha inteira (só na primeira vez que ela fecha), como na web.
      const fechada = (p: PlanoDetalhe['progresso']) => p.total > 0 && p.concluidas === p.total;
      void tocaSons.tocarEfeito(fechada(atualizado.progresso) && !fechada(plano.progresso) ? 'concluir_trilha' : 'concluir_licao');
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
  const aceitandoAgora = criacao === 'criando' || criacao === 'guardando';
  const idDaPrevia = etapa.tipo === 'geracao' ? geracao?.proposta?.pedidoId : undefined;
  const retomadaDaPrevia = idDaPrevia && !criacao ? criacoes.obter(idDaPrevia) : undefined;
  const saidaNoRodape = pedidoIdValido(idDaPrevia) && (aceitandoAgora || Boolean(retomadaDaPrevia));
  const aba = abaDe(etapa);
  // Spec 04 (item 5) e spec 05 (d8df51c): a barra aparece também sem trilhas, senão não há "Minhas trilhas" para tocar.
  // Com um pedido em andamento, ela continua à vista e só desliga (spec 05: "com uma ação em andamento, as abas ficam
  // desligadas", como a web): antes ela sumia, e com a rede lenta o mapa ficava segundos sem navegação.
  const comNavegacaoAgora = planos !== null && (ABAS.includes(aba) || (comunidade && aba === 'explorar'));
  const telaDaComunidade = ['explorar', 'perfilPublico', 'previaTrilha'].includes(etapa.tipo);
  const acoes = (
    <>
      {/* Durante "Criando sua trilha…", Minhas trilhas é a saída: o aceite segue no servidor e a trilha aparece na lista. */}
      {!saidaNoRodape && etapa.tipo !== 'planos' && !['objetivo', 'plano', 'perfil', 'configuracoes'].includes(etapa.tipo) && !(telaDaComunidade && comNavegacaoAgora) && <Botao rotulo={mensagens.planos.titulo} testID="meus-planos" compacto variante="texto"
        desativado={ocupado && !aceitandoAgora} acao={aceitandoAgora ? sairDaCriacao : tocarMinhasTrilhas} />}
      {/* Como a web: "Sair" fica no Perfil, que existe com ou sem o compartilhar (Som, Privacidade e dados e Conta valem
          para toda conta e visitante); no alto, "Perfil" só onde não há a barra de baixo. */}
      {!comNavegacaoAgora && <Botao rotulo={mensagens.perfil.navegacao} testID="perfil-cabecalho" compacto variante="texto" desativado={ocupado}
        acao={() => abrir({ tipo: 'perfil' })} />}
    </>
  );
  // O erro de Minhas trilhas (sem rede, sessão, servidor) recebe o foco do leitor de tela, como nas outras telas.
  const mensagem = erro && <EstadoErro mensagem={erro} foco acao={acaoDoErro(codigoErro)} />;

  // Como a web (studoo.tinhaTrilhas): na primeira carga, as abas só aparecem no esqueleto se a conta tinha trilhas.
  const carregandoInicio = !planos && !erro;
  const comNavegacao = (carregandoInicio && tinhaTrilhas) || comNavegacaoAgora;
  return <AvisoDoApp.Provider value={avisoDoApp}><ProvedorBloqueio cliente={cliente}><NavegacaoContexto.Provider value={comNavegacao ? {
    atual: aba as Aba, ocupado,
    planos: tocarMinhasTrilhas, criar: () => abrir({ tipo: 'objetivo' }),
    explorar: comunidade ? () => abrir({ tipo: 'explorar' }) : undefined,
    // O Perfil (com Privacidade e dados e "Excluir conta") nunca depende do compartilhar.
    perfil: () => abrir({ tipo: 'perfil' }),
  } : null}>
    {/* Os nomes de quem compartilhou (marcas, prévia, cartões) abrem o perfil dela dentro do app, como os links /p da web. */}
    <AbrirPerfil.Provider value={compartilhar ? abrirPerfilPublico : null}>
      {renderizarTela()}
    </AbrirPerfil.Provider>
    {folha && (
      <FolhaCompartilhar cliente={cliente} planoId={folha} visitante={Boolean(perfil?.visitante)} comunidade={comunidade}
        aoFechar={() => { setFolha(null); setVersaoFolha((versao) => versao + 1); }} aoMudarLink={mudarLink} aoMudarPerfil={setPerfil} />
    )}
    {folhaPostar && perfil && (
      <FolhaPostarNoPerfil cliente={cliente} perfil={perfil} aoFechar={() => setFolhaPostar(false)} aoMudarLink={aplicarLinkNoPerfil}
        editarPerfil={() => { setFolhaPostar(false); abrir({ tipo: 'perfil', focarNome: true }); }} novaTrilha={() => { setFolhaPostar(false); abrir({ tipo: 'objetivo' }); }} />
    )}
    {acoesDePostar.confirmacao}
    {/* A passagem da criação: o círculo da cor da aula cresce do nó 1 por cima de tudo e some quando a aula já entrou. */}
    {passagem && <PassagemDaCriacao passagem={passagem} aoTerminar={() => setPassagem(null)} />}
    {confirmacao && (
      <CartaoConfirmacao mensagem={confirmacao.mensagem} texto={confirmacao.texto} aviso={confirmacao.aviso} confirmarRotulo={confirmacao.confirmarRotulo}
        cancelarRotulo={confirmacao.cancelarRotulo} destrutivo={confirmacao.destrutivo}
        ocupado={ocupado} aoCancelar={() => setConfirmacao(null)}
        aoConfirmar={() => { const acao = confirmacao.aoConfirmar; setConfirmacao(null); acao(); }} />
    )}
  </NavegacaoContexto.Provider></ProvedorBloqueio></AvisoDoApp.Provider>;

  function renderizarTela() {
    const retomar = etapa.tipo === 'perfil' ? planos?.find(plano => plano.progresso.concluidas < plano.progresso.total &&
      (temAndamentoNoPlano(plano.id) || plano.progresso.concluidas > 0)) : undefined;
    const continuarEstudo = retomar ? () => void abrirPlano(retomar.id) : undefined;
    // Carregando, como na web: a trilha mostra o esqueleto do caminho e a lição, a forma da aula. "Começar a lição 1" fica na
    // própria prévia ("Criando sua trilha…") e, na passagem, a aula entra por cima; se ela ainda carrega, o esqueleto dela.
    if (pendente === 'plano') return <Tela pagina="carregando-trilha" acoes={acoes}><SkeletonTrilha /></Tela>;
    if (pendente === 'abrir' && etapa.tipo !== 'plano') return <SkeletonLicao texto={mensagens.licao.carregando} />;

    if (etapa.tipo === 'apresentacao') {
      return <Apresentacao primeiraVez={etapa.primeiraVez} concluir={(area) => void concluirApresentacao(area)} />;
    }

    if (etapa.tipo === 'licao') {
      return <Licao cliente={cliente} key={etapa.licao.id} licao={etapa.licao} erro={erro} pendente={pendente}
        voltar={() => { abandonarCorrecao(); void abrirPlano(etapa.plano.id, etapa.licao.id); }} saida={saidaDaLicao}
        avaliar={async (resposta, indice) => {
          const resultado = await executar('avaliar', () => cliente.avaliarLicao(etapa.licao.id, resposta, indice));
          return resultado.ok ? resultado.dados : null;
        }}
        responderSuaVez={(escolha) => cliente.responderSuaVez(etapa.licao.id, escolha)}
        concluir={(comprovante, resumo, pratica) => concluir(etapa.plano, etapa.licao, comprovante, resumo, pratica)} />;
    }

    if (etapa.tipo === 'concluida') {
      const proxima = proximaDoCaminho(etapa.plano);
      const { concluidas, total } = etapa.plano.progresso;
      const completa = total > 0 && concluidas === total;
      const paraRever = etapa.resumo?.rever ? etapa.licao.id :
        etapa.plano.fluxos.flatMap(fluxo => fluxo.licoes).find(licao => licao.rever)?.id;
      return (
        <TelaConcluida etapa={etapa} acoes={acoes} mensagem={mensagem} ocupado={ocupado} visitante={visitante}
          compartilhar={abrirFolha && !etapa.plano.recebida ? () => abrirFolha(etapa.plano.id) : undefined} rodape={<>
          {completa ? (
            <Botao plano rotulo={paraRever ? 'Rever uma lição' : 'Começar outra trilha'} testID={paraRever ? 'trilha-rever' : 'novo-assunto'}
              desativado={ocupado} estilo={estudoEstilos.acaoPiloto}
              acao={() => paraRever ? void abrirLicao(etapa.plano, paraRever) : abrir({ tipo: 'objetivo' })} />
          ) : proxima && <Botao plano rotulo={mensagens.licao.avancar} testID="proxima-licao" desativado={ocupado}
            estilo={estudoEstilos.acaoPiloto} acao={() => void abrirLicao(etapa.plano, proxima)} />}
          <Botao plano rotulo={completa ? 'Ver mapa da trilha' : mensagens.licao.voltar} testID="voltar-plano"
            variante={proxima || completa ? 'secundario' : 'primario'} desativado={ocupado}
            estilo={proxima || completa ? undefined : estudoEstilos.acaoPiloto} acao={() => abrir(voltarATrilha(etapa))} />
        </>} />
      );
    }

    if (etapa.tipo === 'plano') {
      return <TelaPlano etapa={etapa} acoes={acoes} erro={erro} acaoErro={erro ? acaoDoErro(codigoErro) : undefined} ocupado={ocupado} abrindo={abrindo} sincronia={sincronia}
        abrirLicao={(id) => void abrirLicao(etapa.plano, id)} novoPlano={() => abrir({ tipo: 'objetivo' })}
        compartilhar={abrirFolha && !etapa.plano.recebida ? () => abrirFolha(etapa.plano.id) : undefined}
        configurar={() => abrir({ tipo: 'configuracoes', planoId: etapa.plano.id, volta: 'plano' })} />;
    }
    if (etapa.tipo === 'configuracoes') {
      const resumo = planos?.find((item) => item.id === etapa.planoId);
      return <TelaConfiguracoes key={etapa.planoId} cliente={cliente} planoId={etapa.planoId} acoes={acoes} desativado={ocupado}
        compartilhar={Boolean(abrirFolha)} versao={versaoFolha} recebidaDe={resumo?.recebida ? resumo.recebida.nome ?? '' : null}
        voltar={() => (etapa.volta === 'plano' ? void abrirPlano(etapa.planoId) : abrir({ tipo: 'planos' }))}
        aoMudar={(conf) => {
          ++versaoPlanos.current;
          setPlanos((anteriores) => anteriores?.map((item) => (item.id === conf.planoId
            ? { ...item, titulo: conf.titulo, capa: conf.capa, tema: conf.tema } : item)) ?? null);
        }}
        mudarCompartilhamento={() => abrirFolha?.(etapa.planoId)}
        apagar={() => { if (resumo) pedirParaApagar(resumo); }} />;
    }

    if (etapa.tipo === 'diagnostico' && diagnostico) {
      return <Diagnostico objetivo={diagnostico.objetivo} passo={passoVisivel(diagnostico)} ocupado={diagnostico.pendente}
        erro={diagnostico.erro?.codigo ?? null} acoes={acoes} pular={terminarDiagnostico} gerar={terminarDiagnostico}
        repetir={() => {
          const atual = diagnosticoAtual.current;
          if (atual?.erro && diagnosticoVisivel.current) void pedirPassoDiagnostico(atual, atual.erro.opcaoId);
        }}
        voltar={() => navegar({ tipo: 'objetivo' })}
        perguntaAnterior={(diagnostico.revisando ?? diagnostico.anteriores.length) > 0 ? voltarPergunta : undefined}
        consultar={(opcaoId) => {
          const atual = diagnosticoAtual.current;
          if (atual && diagnosticoVisivel.current) void pedirPassoDiagnostico(atual, opcaoId);
        }} />;
    }

    if (etapa.tipo === 'geracao' && geracao) {
      return <GeracaoAoVivo geracao={geracao} erro={erro} acaoErro={erro ? acaoDoErro(codigoErro) : undefined} ocupado={ocupado} acoes={acoes} cancelar={cancelarGeracao}
        comecar={(proposta) => void comecar(proposta)} salvar={(proposta) => void comecar(proposta, false)} ajustar={() => abrir({ tipo: 'objetivo' })}
        criacao={criacao} mensagemDoAceite={mensagemDoAceite}
        retomada={retomadaDaPrevia ? cartaoDaCriacao(retomadaDaPrevia) : undefined}
        sairDuranteAceite={saidaNoRodape && aceitandoAgora ? sairDaCriacao : undefined}
        remontar={() => void gerar(geracao.objetivo, diagnosticoAtual.current?.objetivo === geracao.objetivo ? diagnosticoAtual.current.resultadoId : undefined)}
        guardarNo1={(alvo) => { lenteDoNo1.current = alvo; }}
        rolagemDoNo1={rolagemDoNo1}
        // Como a web 4.2: a mesma regra do contrato (o assunto antes dos dois-pontos, sem acento), em vez do "fraç" fixo.
        existente={geracao.proposta ? planos?.find((plano) => plano.id !== geracao.proposta?.pedidoId &&
          trilhaRepetida(plano.titulo, geracao.proposta?.titulo ?? '') &&
          mesmoDiagnostico(plano.diagnostico, geracao.proposta?.diagnostico)) : undefined}
        abrirExistente={(id) => void abrirPlano(id)} />;
    }

    if (etapa.tipo === 'perfil' && !compartilhar) {
      return <PerfilSemSocial cliente={cliente} visitante={visitante} acoes={acoes} desativado={ocupado} continuarEstudo={continuarEstudo}
        sair={() => pedirParaSair(false)} entrar={() => pedirParaSair(true)} aoSessaoTerminada={() => void expirarGuardando()} />;
    }
    if (etapa.tipo === 'perfil') {
      return <TelaPerfil continuarEstudo={continuarEstudo} cliente={cliente} perfil={perfil} comunidade={comunidade} acoes={acoes} desativado={ocupado}
        aoMudarPerfil={setPerfil} aoMudarLink={mudarLink} abrirPlano={(id) => void abrirPlano(id)}
        sair={() => pedirParaSair(false)} entradaDaConta={() => pedirParaSair(true)} registrarGuarda={registrarGuarda} irParaTrilhas={() => abrir({ tipo: 'planos' })}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfilPublico}
        aoSessaoTerminada={() => void expirarGuardando()} novaTrilha={() => abrir({ tipo: 'objetivo' })} focarNome={etapa.focarNome} />;
    }

    if (etapa.tipo === 'explorar' && comunidade) {
      return <TelaExplorar cliente={cliente} visitante={visitante} entradaDaConta={() => pedirParaSair(true)}
        acoesTela={acoes} memoria={etapa.restaurar ? memoriaExplorar.current : null} guardar={guardarExplorar}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} aoAbrir={(id) => void abrirPlano(id)}
        abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfilPublico} irParaTrilhas={() => abrir({ tipo: 'planos' })} />;
    }

    if (etapa.tipo === 'perfilPublico') {
      return <TelaPerfilPublico key={etapa.perfilId} cliente={cliente} perfilId={etapa.perfilId} visitante={visitante} entradaDaConta={() => pedirParaSair(true)}
        acoesTela={<><Botao rotulo={mensagens.voltar} testID="voltar-perfil-publico" compacto variante="texto" acao={() => abrir(etapa.voltar)} />{acoes}</>}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} aoAbrir={(id) => void abrirPlano(id)}
        abrirPrevia={abrirPrevia} abrirPerfil={abrirPerfilPublico} criarTrilha={() => abrir({ tipo: 'objetivo' })}
        irAoExplorar={() => abrir({ tipo: 'explorar' })} />;
    }

    if (etapa.tipo === 'previaTrilha') {
      return <TelaPreviaTrilha key={etapa.codigo} cliente={cliente} codigo={etapa.codigo}
        acoesTela={<><Botao rotulo={mensagens.voltar} testID="voltar-previa" compacto variante="texto" acao={() => abrir(etapa.voltar)} />{acoes}</>}
        aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} aoAbrir={(id) => void abrirPlano(id)}
        criarTrilha={() => abrir({ tipo: 'objetivo' })} irAoExplorar={() => abrir({ tipo: 'explorar' })} />;
    }

    if (etapa.tipo === 'objetivo' || etapa.tipo === 'geracao') {
      return <Pedido cliente={cliente} onProposta={p => { navegar({ tipo: 'geracao' }); setGeracao({ objetivo: p.objetivo, titulo: p.titulo, fluxos: p.fluxos.map(f => ({ titulo: f.titulo, licoes: f.licoes.map(l => l.titulo) })), proposta: p, propostaExpiraEm: expiraEmDaProposta(p), deMaterial: true }); }} objetivo={objetivo} ocupado={ocupado}
        modo={modoPedido} setModo={setModoPedido} material={materialDoPedido}
        aoMudarMaterial={novo => {
          setMaterialDoPedido(novo);
          if (modoPedido === 'material') setFalhaGeracao(null);
        }}
        aviso={aviso} falha={falhaGeracao} erro={erro} acaoErro={erro ? acaoDoErro(codigoErro) : undefined} areaInicial={areaInicial}
        temPlanos={(planos?.length ?? 0) > 0} acoes={acoes} aoMudar={atualizarObjetivo} gerar={iniciarPedido}
        verPlanos={() => abrir({ tipo: 'planos' })} comoFunciona={() => abrir({ tipo: 'apresentacao', primeiraVez: false })}
        porLink={compartilhar ? <>
          <AdicionarPorLink cliente={cliente} ocupado={ocupado} aoAdicionar={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)}
            abrirPlano={(id) => void abrirPlano(id)} />
          {/* Com a comunidade: "Ver trilhas da comunidade", logo abaixo, como na web. */}
          {comunidade && <IrAoExplorar ocupado={ocupado} acao={() => abrir({ tipo: 'explorar' })} />}
        </> : undefined} />;
    }

    // Como na web (rodada 4F): enquanto as trilhas chegam, o esqueleto do mapa (quem tem trilha cai no mapa logo depois).
    if (!planos && !erro && criacoes.itens.length === 0) return <Tela pagina="carregando-trilha" acoes={acoes}><SkeletonTrilha /></Tela>;

    // O cartão de retomada já é a entrada da trilha confirmada. Uma trilha salva ocupa um só cartão.
    const planosSemRetomada = planos?.filter(plano => criacoes.obter(plano.id)?.estado?.estado !== 'pronto');
    const guardada = planosSemRetomada?.find(item => item.id === trilhaGuardada && item.progresso.concluidas === 0);
    return (
      <Tela pagina="planos" avisoNoFluxo acoes={acoes} abaixoDoLogo={planos && planos.length > 0 ? <SeloSincronia sincronia={sincronia} /> : undefined}
        estiloConteudo={estudoEstilos.fimQuarenta}>
        {/* Como na web: o aviso de erro (sem rede, sessão) vem no alto, antes do título, sem margem em cima e a 16 dele. */}
        {erro && <EstadoErro mensagem={erro} foco acao={acaoDoErro(codigoErro)} estilo={estudoEstilos.erroNaLista} />}
        <Titulo testID="titulo-planos" foco>{mensagens.planos.titulo}</Titulo>
        {criacoes.itens.map(item => cartaoDaCriacao(item, true))}
        {/* Sem trilhas (spec 05, d8df51c): sem o subtítulo da lista, o bloco vazio com o Stu e "Criar minha primeira trilha". */}
        {mostrarVazioDosPlanos ? (
          <VazioDasTrilhas pulo={puloDoVazio} criar={() => abrir({ tipo: 'objetivo' })} />
        ) : !guardada && Boolean(planosSemRetomada?.length) && (
          /* .painel--planos: grade com vão de 12 (a introdução não tem margem própria ali). */
          <Text style={[estilos.introducao, estudoEstilos.introducaoPlanos]}>{mensagens.planos.subtitulo}</Text>
        )}
        {guardada &&
          <Text role="status" accessibilityLiveRegion="polite" testID="trilha-salva-aviso" style={[estudoEstilos.aviso, estudoEstilos.avisoTrilhaSalva]}>
            {visitante
              ? 'Trilha salva em Minhas trilhas. Disponível por até 24 h a partir da entrada neste aparelho.'
              : 'Trilha salva em Minhas trilhas. Comece quando quiser.'}
          </Text>}
        {planosSemRetomada && planosSemRetomada.length > 0 && (() => {
          // Como na web: um destaque só ("Seu próximo passo", com o único botão primário) e as outras trilhas embaixo.
          const destaque = guardada ?? planoInicial(planosSemRetomada);
          const restantes = planosSemRetomada.filter((plano) => plano.id !== destaque?.id);
          return (
            <>
              {destaque && (
                <CartaoDestaque plano={destaque} indice={planosSemRetomada.indexOf(destaque)} sincronia={sincronia} ocupado={ocupado}
                  abrir={() => void abrirPlano(destaque.id)} apagar={() => pedirParaApagar(destaque)}
                  configurar={() => abrir({ tipo: 'configuracoes', planoId: destaque.id, volta: 'planos' })}
                  compartilhar={abrirFolha && !destaque.recebida ? () => abrirFolha(destaque.id) : undefined} postar={postarDe(destaque)} />
              )}
              {restantes.length > 0 && (
                <Text accessibilityRole="header" style={[estudoEstilos.secaoTitulo, caixaAlta]}>{mensagens.planos.outrasTrilhas}</Text>
              )}
              {/* .planos-ativos: 20 em cima (mais o vão de 12 da página) e 16 entre os cartões. */}
              {restantes.length > 0 && <View style={estudoEstilos.outrasTrilhas}>
              {restantes.map((plano) => (
                <CartaoPlano key={plano.id} plano={plano} indice={planosSemRetomada.indexOf(plano)} ocupado={ocupado} secundario
                  abrir={() => void abrirPlano(plano.id)} apagar={() => pedirParaApagar(plano)}
                  configurar={() => abrir({ tipo: 'configuracoes', planoId: plano.id, volta: 'planos' })}
                  compartilhar={abrirFolha && !plano.recebida ? () => abrirFolha(plano.id) : undefined} postar={postarDe(plano)} />
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
 * Spec 04, banca da noite §3: na ordem, o Stu curioso de 72 (56, e sem o subtítulo, em janela de até 700 de altura), o título,
 * o campo e "Montar minha trilha", "Tenho um material" num cartão compacto de 64 e a fileira de ideias que rola para o lado
 * (fichas de 44, terminando em "Surpreenda-me"): tudo à vista sem rolar em 390×844 e 390×667. Sem o aviso de "sem trilhas"
 * (repetia o título). Como na web, tocar numa ideia preenche o campo.
 * Um objetivo curto demais não sai do aparelho: o campo mostra o que falta e recebe o foco.
 * O foco da tela vai ao erro, quando há um, e senão ao título; o aviso de geração cancelada é anunciado.
 */
/**
 * Spec 16, item 35: mede, dentro da rolagem, onde termina a última opção de antes de escolher o material, para o pedido mostrar a
 * pílula "Ver mais abaixo" quando ela fica abaixo da dobra (tela baixa). Mede de novo quando a área visível muda.
 */
function VigiaDaOpcao({ alvo, medida, aoMedir }: { alvo: { current: ComponentRef<typeof View> | null }; medida: number; aoMedir: (fim: number | null) => void }) {
  const rolagem = useContext(RolagemDaTela);
  useEffect(() => {
    const medirAgora = () => rolagem?.medir(alvo.current, (y, altura) => aoMedir(y + altura));
    const espera = setTimeout(medirAgora, 250);
    return () => clearTimeout(espera);
  }, [rolagem, alvo, medida, aoMedir]);
  useEffect(() => () => aoMedir(null), [aoMedir]);
  return null;
}

function Pedido({ cliente, onProposta, objetivo, modo, setModo, material, aoMudarMaterial, ocupado, aviso, falha, erro, acaoErro, temPlanos, areaInicial, acoes, aoMudar, gerar, verPlanos, comoFunciona, porLink }: {
  /** "Adicionar por link" (com o compartilhar), antes de "Ver como funciona", como na web. */
  porLink?: ReactNode;
  cliente: ClienteNativo;
  onProposta: (p: PropostaPlano) => void;
  objetivo: string;
  modo: ModoPedido;
  setModo: (modo: ModoPedido) => void;
  material: MaterialEstudo | null;
  aoMudarMaterial: (material: MaterialEstudo | null) => void;
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
  /** O aviso de privacidade do material segue o provedor informado pelo servidor. */
  const [ia, setIa] = useState<ProvedorIa | undefined>();
  useEffect(() => {
    let ativo = true;
    void cliente.configuracaoAcesso().then((configuracao) => { if (ativo) setIa(configuracao.ia); }).catch(() => undefined);
    return () => { ativo = false; };
  }, [cliente]);
  const [curto, setCurto] = useState(false);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  // Janela baixa (até 700 de altura): o Stu vai a 56 e o subtítulo sai, para o material e as ideias ficarem à vista.
  const baixa = useWindowDimensions().height <= 700;
  // Spec 16, item 35: no material, o alto da tela fica compacto (Stu de 56, título 24/30, subtítulo 15/22), para as três opções
  // de antes de escolher caberem na primeira vista em 390 × 844.
  const compacto = baixa || modo === 'material';
  const tamanhoDoStu = compacto ? 56 : 72;
  // Com o material lido, "Criar trilha deste material" é a ação presa da tela (o cartão do material entrega o botão).
  const [acaoMaterial, setAcaoMaterial] = useState<ReactNode>(null);
  // A pílula "Ver mais abaixo" (tela baixa, antes de escolher): onde termina a última opção, quanto se vê e quanto rolou.
  const ultimaOpcao = useRef<ComponentRef<typeof View>>(null);
  const rolagemDoPedido = useRef<ComponentRef<typeof ScrollView>>(null);
  const [fimDasOpcoes, setFimDasOpcoes] = useState<number | null>(null);
  const [alturaVisivel, setAlturaVisivel] = useState(0);
  const [rolado, setRolado] = useState(0);
  const antesDeEscolher = modo === 'material' && !acaoMaterial;
  const opcaoAbaixo = antesDeEscolher && fimDasOpcoes !== null && alturaVisivel > 0 && fimDasOpcoes > rolado + alturaVisivel - 4;
  const [brilho, setBrilho] = useState(0);
  // Decidido uma vez: o erro que some enquanto a pessoa digita não devolve o foco ao título.
  const [focarTitulo] = useState(() => !erro && !falha);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);
  const focarAoVoltar = useRef(false);
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
  const recusado = falha === 'conteudo_nocivo';
  // Spec 17, defeito B4: depois de "Agora não" no aceite de IA, o aviso não fica sem saída. "Permitir o uso de IA" pede a
  // trilha de novo, e a trava reabre o mesmo cartão de aceite (nenhum texto novo: privacidade.permitirAgora).
  const semAceite = falha === 'consentimento_ia';
  const mostrarVerPlanos = falha === 'limite_geracoes' && temPlanos;
  // O Stu reage ao pedido, como na web: convida, incentiva enquanto a pessoa escreve e comemora a ideia escolhida.
  let fala: string = mensagens.pedido.falas.vazio;
  // Como na web (3A.2): com o limite atingido ou outro erro da geração, o Stu não contradiz o aviso do cartão.
  if (falha === 'limite_geracoes' || falha === 'limite_estudio') fala = mensagens.pedido.falas.limite;
  else if (falha) fala = mensagens.pedido.falas.erro;
  else if (escolhida !== null && escolhida === texto) fala = mensagens.pedido.falas.escolhida;
  else if (texto.length >= 20) fala = mensagens.pedido.falas.pronto;
  else if (texto.length > 0) fala = mensagens.pedido.falas.curto;
  // Spec 13 (A2): convida curioso; escrevendo (e no erro ou no limite), encorajador; ideia aplicada, animado. Lendo o material
  // (§B4), numa espera de mais de 1 s do cartão do material: concentrado, em laço (é espera).
  const [esperaMaterial, setEsperaMaterial] = useState(false);
  const expressaoDoPedido: NomeStu = modo === 'material' && esperaMaterial ? 'stu-concentrado'
    : escolhida !== null && escolhida === texto && !falha ? 'stu-animado' : texto.length > 0 || falha ? 'stu-encorajador' : 'stu-curioso';
  const animacaoDoPedido = expressaoDoPedido === 'stu-concentrado' ? 'laco' : expressaoDoPedido === 'stu-curioso' ? 'uma-vez'
    : expressaoDoPedido === 'stu-animado' ? 'acontecimento' : undefined;

  useEffect(() => {
    if (modo !== 'ideia' || !focarAoVoltar.current) return;
    focarAoVoltar.current = false;
    campo.current?.focus();
  }, [modo]);

  function editarTema() {
    if (modo === 'ideia') campo.current?.focus();
    else {
      focarAoVoltar.current = true;
      setModo('ideia');
    }
  }

  function tentar() {
    if (ocupado || recusado || !texto) return;
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

  // A pílula leva até a última opção de material, deixando-a acima da cápsula.
  const verMaisMaterial = opcaoAbaixo ? (
    <Pressable testID="mais-abaixo-material" accessibilityRole="button" accessibilityLabel={mensagens.licao.maisAbaixo} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      onPress={() => rolagemDoPedido.current?.scrollTo({ y: Math.max(0, (fimDasOpcoes ?? 0) - alturaVisivel + 16), animated: true })}
      style={({ pressed }) => [estudoEstilos.maisAbaixo, pressed && { opacity: 0.7 }]}>
      <View style={{ transform: [{ rotate: '90deg' }] }}><Icone nome="seta" tamanho={16} cor={cores.acao} /></View>
      <Text style={estudoEstilos.maisAbaixoTexto}>{mensagens.licao.maisAbaixo}</Text>
    </Pressable>
  ) : undefined;
  const telaDoMaterial = {
    rolagem: rolagemDoPedido,
    rodape: modo === 'material' && acaoMaterial ? acaoMaterial : undefined,
    aoMedir: setAlturaVisivel,
    aoRolar: antesDeEscolher ? setRolado : undefined,
    flutuante: verMaisMaterial,
  };

  return (
    <Tela pagina="objetivo" acoes={acoes} estiloConteudo={estudoEstilos.fimQuarenta} {...telaDoMaterial}>
      {/* O troféu da criação já decodificado antes do mapa (banca P2-1: no iPhone, um disco branco nos primeiros quadros). */}
      <PreCargaDoStu arquivos={TROFEU_DA_CRIACAO} />
      {antesDeEscolher && <VigiaDaOpcao alvo={ultimaOpcao} medida={alturaVisivel} aoMedir={setFimDasOpcoes} />}
      <View style={[estudoEstilos.pedidoHeroi, compacto && estudoEstilos.pedidoHeroiBaixo]}>
        <View style={estudoEstilos.pedidoCabeca}>
          <View style={estudoEstilos.pedidoTituloLugar}>
            <Titulo testID="titulo-objetivo" foco={focarTitulo} equilibrado estilo={[estudoEstilos.pedidoTitulo, compacto && estudoEstilos.pedidoTituloBaixo]}>
              {modo === 'material' ? mensagens.inicio.materialTitulo : mensagens.pedido.titulo}
            </Titulo>
          </View>
          <View testID="stu-pedido" style={{ width: tamanhoDoStu, height: tamanhoDoStu }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Stu nome={expressaoDoPedido} tamanho={tamanhoDoStu} halo animado={animacaoDoPedido} acontecimento={expressaoDoPedido === 'stu-animado' ? texto : undefined} />
          </View>
        </View>
        {!baixa && !recusado && <Text accessibilityLiveRegion="polite" style={[estudoEstilos.pedidoFala, modo === 'material' && estudoEstilos.pedidoFalaMaterial]}>{modo === 'material' ? mensagens.inicio.materialTexto : fala}</Text>}
      </View>
      {aviso && <Text style={estudoEstilos.aviso}>{aviso}</Text>}
      {erro && <EstadoErro mensagem={erro} foco acao={acaoErro} />}
      {/* Como na web (3A.1): um cartão só, com o Stu e a ação que cabe; o que a pessoa escreveu continua no campo. */}
      {falha && <EstadoErro mensagem={mensagemDoCodigo(falha)} testID="erro-geracao" foco
        acao={recusado ? { rotulo: mensagens.pedido.editarTema, testID: 'editar-tema', acao: editarTema }
          : mostrarVerPlanos ? { rotulo: mensagens.pedido.verPlanos, testID: 'ver-planos', desativado: ocupado, acao: verPlanos }
          : semAceite ? { rotulo: mensagens.privacidade.permitirAgora, testID: 'permitir-ia-geracao', desativado: ocupado, acao: tentar }
          : repetivel ? { rotulo: mensagens.tentar, testID: 'tentar-geracao', desativado: ocupado, acao: tentar } : undefined} />}
      <View style={modo !== 'material' ? { display: 'none' } : estudoEstilos.materialNoPedido}><MaterialParaTrilha cliente={cliente} objetivo={objetivo} onProposta={onProposta} ia={ia} mostrarCabeca={false}
        material={material} aoMudarMaterial={aoMudarMaterial} ativo={modo === 'material'} editarTema={editarTema} pedidoRecusado={recusado}
        aoEsperar={setEsperaMaterial} definirAcaoPresa={setAcaoMaterial} ultimaOpcao={ultimaOpcao} /></View>
      <View style={modo !== 'ideia' && { display: 'none' }}>
        <View style={estudoEstilos.campoPedido}>
          <CampoObjetivo campoRef={campo} valor={objetivo} aoMudar={aoMudar} editavel={!ocupado} dica={dica} brilho={brilho} baixo={baixa} />
          {mostrarCurto && (
            <View style={estudoEstilos.campoErro}>
              <Text importantForAccessibility="no" style={[estilos.sinal, { color: cores.erro, borderColor: cores.erro }]}>!</Text>
              <Text style={estudoEstilos.campoErroTexto}>{mensagens.pedido.curto(minimo)}</Text>
            </View>
          )}
          {mostrarContador && <Text style={[estilos.legenda, estudoEstilos.contador]}>{contador}</Text>}
        </View>
        {/* Como na web: o botão vem logo abaixo do campo, no fluxo da página, com a seta e face de 56 px. */}
        <Botao plano rotulo={mensagens.inicio.criar} testID="gerar-trilha" icone="seta" fonte={17} estilo={estudoEstilos.criar}
          desativado={ocupado || recusado || !texto} acao={tentar} />
      </View>
      {/* Material continua acessível depois da ação principal, numa linha de 64 sem uma segunda camada de relevo. */}
      <Pressable testID="alternar-modo" accessibilityRole="button" accessibilityState={{ disabled: ocupado }} disabled={ocupado}
        onPress={() => setModo(modo === 'ideia' ? 'material' : 'ideia')}
        style={({ pressed }) => [estudoEstilos.alternarFora, pressed && { opacity: 0.85 }]}>
        <View style={estudoEstilos.alternar}>
        <View style={estudoEstilos.alternarIcone} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Icone nome={modo === 'ideia' ? 'livro' : 'lampada'} tamanho={20} cor={cores.acao} />
        </View>
        <View style={estudoEstilos.alternarTextos}>
          <Text style={estudoEstilos.alternarTitulo}>{modo === 'ideia' ? mensagens.inicio.material : mensagens.inicio.voltarIdeia}</Text>
          <Text style={estudoEstilos.alternarDica}>{modo === 'ideia' ? mensagens.inicio.materialDica : mensagens.inicio.ideiaDica}</Text>
        </View>
        <Icone nome="seta" tamanho={20} cor={cores.textoSecundario} />
        </View>
      </Pressable>
      <View style={modo !== 'ideia' && { display: 'none' }}>
        {/* As sugestões preservam seleção, ordem e anúncio; o grupo continua rolável com alvos de 44. */}
        <ScrollView key={tema.id} testID="ideias-pedido" horizontal showsHorizontalScrollIndicator={false} role="group"
          accessibilityLabel={mensagens.pedido.sugestoes} style={estudoEstilos.ideiasRolagem} contentContainerStyle={estudoEstilos.ideias}>
          {tema.exemplos.map((exemplo, indice) => (
            <Sugestao key={exemplo} texto={exemplo} icone={iconeDoExemplo(tema, exemplo)} testID={`sugestao-${indice}`} ordem={indice}
              escolhida={texto === exemplo} desativada={ocupado} acao={() => sugerir(exemplo)} />
          ))}
          <Surpresa desativada={ocupado} acao={surpreender} />
        </ScrollView>
      </View>
      {porLink}
      <LinkComoFunciona desativado={ocupado} acao={comoFunciona} />
    </Tela>
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
function CampoObjetivo({ campoRef, valor, aoMudar, editavel, dica, brilho, baixo = false }: {
  campoRef: Ref<ComponentRef<typeof TextInput>>;
  /** Janela baixa (até 700 de altura): o campo começa com 88 em vez de 112 (banca da noite §3). */
  baixo?: boolean;
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
      {/* Direção Clareza: campo de objetivo sem relevo, borda legível e foco no mesmo controle. */}
      <View style={estudoEstilos.campoSemRelevo}>
        <Campo campoRef={campoRef} testID="objetivo-estudo" rotulo={mensagens.inicio.campo} rotuloOculto value={valor}
          onChangeText={aoMudar} editable={editavel} multiline maxLength={LIMITES_GERACAO.objetivoMax} placeholderTextColor="#566382"
          placeholder={mensagens.inicio.exemplo} accessibilityHint={dica}
          style={[estudoEstilos.entradaPedido, baixo && estudoEstilos.entradaPedidoBaixa, focado && estudoEstilos.entradaPedidoFocada,
            !valor && estudoEstilos.entradaPedidoVazia]}
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
      style={({ pressed }) => [pressed && { opacity: 0.8 }, focado && estilos.foco]}>
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
        style={({ pressed }) => [pressed && { opacity: 0.8 }, focado && estilos.foco]}>
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
 * Fila das lições da geração (spec 04, revisão de 19/11): cada lição entra no mapa quando a anterior chega ao passo 3
 * (320 ms; 520 se a anterior abriu um trecho, porque o marco veio antes), então nada fica para trás nem se acumula. Devolve
 * quantas já estão no mapa e quantas a contagem mostra: o nome de cada uma entra aos 420 ms, e a contagem e o anúncio do
 * leitor de tela ("Lição 3: …") vêm junto.
 */
function useFilaDaGeracao(nos: readonly NoCaminho[]) {
  const [mostrados, setMostrados] = useState(0);
  const [contados, setContados] = useState(0);
  const ultimaEntrada = useRef(0);
  const relogios = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lista = useRef(nos);
  lista.current = nos;
  useEffect(() => () => relogios.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (mostrados >= nos.length) return;
    const abriu = (indice: number) => indice > 0 && lista.current[indice].trecho !== lista.current[indice - 1].trecho;
    const espera = mostrados === 0 ? 0 : Math.max(0, ultimaEntrada.current + intervaloDaFila(abriu(mostrados - 1)) - Date.now());
    const relogio = setTimeout(() => {
      ultimaEntrada.current = Date.now();
      const indice = mostrados;
      setMostrados(indice + 1);
      relogios.current.push(setTimeout(() => {
        setContados((atual) => Math.max(atual, indice + 1));
        const licao = lista.current[indice];
        if (licao) AccessibilityInfo.announceForAccessibility(mensagens.geracao.anuncioLicao(indice + 1, falarTextoComFormulas(licao.titulo)));
      }, atrasosDaLicao(abriu(indice)).nome));
    }, espera);
    return () => clearTimeout(relogio);
  }, [mostrados, nos.length]);
  return { mostrados, contados };
}

/**
 * Geração que se acompanha (spec 04, "Revisão do dono (19/11)" e "Criar a trilha"). O cartão do título vira uma faixa de 52
 * presa embaixo da barra da marca (pontinhos e o pedido numa linha, sem contagem), com a placa presa no alto do mapa (só o
 * que é verdade: montando, a espera longa depois de 12 s sem lição nova e a proposta pronta). Cada lição nasce em passos
 * (o caminho em rascunho, o nó que cai, o nome, o cenário e a próxima vaga) e a tela rola até ela ficar a 60% do mapa,
 * enquanto a pessoa não mexe. Rolar para cima mais de 40 px para de acompanhar e mostra a pílula "Ver a lição nova · N";
 * tocar nela, ou rolar até a lição nova, volta a acompanhar. No fim, a tela vai até o troféu (ou a pílula vira "Ver o fim
 * da trilha"), a placa diz que a proposta ficou pronta, o rodapé troca para "Ajustar pedido" e "Começar a lição 1" e o foco
 * vai para ele. O toque cria a trilha na própria prévia ("Criando sua trilha…", o nó 1 e o Stu), sem tela no meio. Ao subir
 * até o começo do mapa, o cartão do título volta embaixo da faixa. Com movimento reduzido, a tela pula em vez de rolar e
 * nada cai nem brota.
 */
function GeracaoAoVivo({ geracao, erro, acaoErro, ocupado, acoes, cancelar, comecar, salvar, ajustar, existente, abrirExistente, criacao, mensagemDoAceite, retomada, sairDuranteAceite, remontar, guardarNo1, rolagemDoNo1 }: {
  /** Para a passagem fazer a rolagem do toque até o nó 1 terminar até o círculo começar. */
  rolagemDoNo1: { current: { terminar: (prazoMs: number) => void } | null };
  /** O toque em "Começar a lição 1" (spec 04, "Criar a trilha"): criando, erro, expirada ou criada (a passagem). */
  criacao: FaseDaCriacao | null;
  mensagemDoAceite: string | null;
  retomada?: ReactNode;
  sairDuranteAceite?: () => void;
  /** "Montar de novo", com a proposta expirada: a geração de novo, com o mesmo pedido. */
  remontar: () => void;
  /** A lente do nó 1, de onde o círculo da passagem cresce. */
  guardarNo1: (alvo: ComponentRef<typeof View> | null) => void;
  geracao: TrilhaEmGeracao;
  erro: string | null;
  acaoErro?: AcaoDoErro;
  ocupado: boolean;
  acoes: ReactNode;
  cancelar: () => void;
  comecar: (proposta: PropostaPlano) => void;
  salvar: (proposta: PropostaPlano) => void;
  ajustar: () => void;
  /** Como na web: uma trilha com o mesmo nome; a tela avisa e oferece abrir a que já existe. */
  existente?: PlanoResumo;
  abrirExistente: (id: string) => void;
}) {
  const todos = useMemo(() => nosDaPrevia(geracao), [geracao]);
  const { titulo, proposta } = geracao;
  const { mostrados } = useFilaDaGeracao(todos);
  const nos = useMemo(() => todos.slice(0, mostrados), [todos, mostrados]);
  const pronta = proposta !== null && mostrados >= todos.length;
  const total = nos.length;
  const partes = new Set(nos.map((no) => no.trecho)).size;
  const ultimo = nos[total - 1];
  const { width, height } = useWindowDimensions();
  const largo = width >= 768;
  const reduzir = useMovimentoReduzido();
  const rolagem = useRef<ComponentRef<typeof ScrollView>>(null);
  const botaoComecar = useRef<ComponentRef<typeof Pressable>>(null);
  const visivel = useRef(0);
  const rolado = useRef(0);
  const coberto = useRef(52);
  const maisBaixo = useRef(0);
  const programada = useRef<{ inicio: number; alvo: number; ate: number } | null>(null);
  const ultimoAlvo = useRef<number | null>(null);
  const centros = useRef(new Map<string, number>());
  const fim = useRef<Faixa | null>(null);
  const [acompanhando, setAcompanhando] = useState(true);
  const acompanhandoAgora = useRef(true);
  const [alturaPlaca, setAlturaPlaca] = useState(0);
  const alturaPlacaAgora = useRef(0);
  alturaPlacaAgora.current = alturaPlaca;
  // A faixa do alto cresce com o nome da trilha em duas linhas (item 34): a placa e a área livre a acompanham.
  const [alturaFaixaGeracao, setAlturaFaixaGeracao] = useState(RITMO_DA_GERACAO.placaTopo - 10);
  const alturaFaixaGeracaoAgora = useRef(RITMO_DA_GERACAO.placaTopo - 10);
  alturaFaixaGeracaoAgora.current = alturaFaixaGeracao;
  const [nomeLongo, setNomeLongo] = useState(false);
  const [esperaLonga, setEsperaLonga] = useState(false);
  const [cartaoDeVolta, setCartaoDeVolta] = useState(false);
  const [trofeuAVista, setTrofeuAVista] = useState(false);
  const [deslize] = useState(() => new Animated.Value(1));
  const empilhar = pronta && width <= 600;
  const dividir = pronta && !empilhar && !largo;
  // Criar a trilha: enquanto o aceite anda (e na passagem), só o botão fica, na largura toda; no erro, "Ajustar pedido" volta.
  const iniciando = criacao === 'criando' || criacao === 'criada';
  const guardando = criacao === 'guardando';
  const salvando = iniciando || guardando;
  const falhou = criacao === 'erro' || criacao === 'erro-salvar' || criacao === 'expirada';
  const [esperaReal, setEsperaReal] = useState(false);
  const [saidaDoAjustar] = useState(() => new Animated.Value(0));
  const [ajustarFora, setAjustarFora] = useState(false);
  const [alturaDoAjuste, setAlturaDoAjuste] = useState(44);
  const criacaoAgora = useRef(criacao);
  criacaoAgora.current = criacao;

  // O erro aparece no topo, como na web; a tela sobe até ele.
  useEffect(() => {
    if (erro) rolagem.current?.scrollTo({ y: 0, animated: reduzir === false });
  }, [erro, reduzir]);

  // Sons da geração (spec 12, revisão de "Criar a trilha"): cada lição toca `geracao_licao` quando o nó pousa no mapa (o passo 3
  // da spec 04, o evento visível; com movimento reduzido, quando aparece), no máximo um a cada 400 ms, só com o nó à vista e
  // nunca depois da proposta pronta. O fim da proposta (o troféu) não tem som: o único som de conclusão, `geracao_pronta`,
  // fica para o aceite. Os dois são aquecidos ao abrir a geração. Cancelar (sair da tela) cala o que faltava.
  useEffect(() => {
    tocaSons.aquecerEfeitos(['geracao_licao', 'geracao_pronta', 'toque_opcao']);
  }, []);
  const somDasLicoes = useRef(new Set<ReturnType<typeof setTimeout>>());
  const ultimoPouso = useRef(Number.NEGATIVE_INFINITY);
  const mostradosAntes = useRef(mostrados);
  const prontaAgora = useRef(pronta);
  prontaAgora.current = pronta;
  useEffect(() => {
    const de = mostradosAntes.current;
    mostradosAntes.current = mostrados;
    if (pronta || mostrados <= de) return;
    for (let indice = de; indice < mostrados; indice += 1) {
      const abreTrecho = indice > 0 && todos[indice - 1]?.trecho !== todos[indice]?.trecho;
      const id = todos[indice]?.id;
      const relogio = setTimeout(() => {
        somDasLicoes.current.delete(relogio);
        const centro = id ? centros.current.get(id) : undefined;
        const aVista = centro === undefined || vagaAVista(centro, rolado.current, visivel.current || height, coberto.current);
        if (prontaAgora.current || !aVista || Date.now() - ultimoPouso.current < RITMO_DA_GERACAO.somDaLicaoMinimoMs) return;
        ultimoPouso.current = Date.now();
        tocaSons.tocarEfeito('geracao_licao');
      }, reduzir !== false ? 0 : atrasosDaLicao(abreTrecho).no);
      somDasLicoes.current.add(relogio);
    }
    // Só quando uma lição nova entra no mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrados]);
  useEffect(() => () => {
    for (const relogio of somDasLicoes.current) clearTimeout(relogio);
  }, []);

  // Spec 17, mudança 1: o leitor de tela ouve "Montando sua trilha" uma vez, ao abrir a espera (as frases que trocam na placa
  // não são anunciadas; a proposta pronta tem o seu anúncio).
  useEffect(() => {
    if (!pronta) AccessibilityInfo.announceForAccessibility(mensagens.geracao.montandoTitulo);
    // Só ao abrir a geração.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Espera longa: 12 s sem lição nova, a placa diz que ainda está escrevendo (sem barra de progresso inventada).
  useEffect(() => {
    setEsperaLonga(false);
    if (proposta) return;
    const relogio = setTimeout(() => setEsperaLonga(true), RITMO_DA_GERACAO.esperaLongaMs);
    return () => clearTimeout(relogio);
  }, [todos.length, proposta]);

  // O fim da proposta: o rodapé desliza 12 px em 220 ms, o leitor de tela ouve "Proposta pronta: 9 lições em 3 partes. Começar
  // a lição 1." e o foco vai para "Começar a lição 1". Sem som (a trilha ainda não existe). Se a pessoa já está no alto, o
  // cartão do título volta na hora.
  useEffect(() => {
    if (!pronta) return;
    for (const relogio of somDasLicoes.current) clearTimeout(relogio);
    somDasLicoes.current.clear();
    AccessibilityInfo.announceForAccessibility(`${mensagens.geracao.propostaPronta(total, partes)} ${mensagens.geracao.comecarLicao1}.`);
    // Com o aviso de trilha repetida (spec 16, item 1, revisão 25c75c2), a tela NÃO rola até o nó 1: abre no topo, com o
    // cartão do título e o aviso inteiros à vista (antes só o botão "Abrir a que já existe" aparecia, cortado no alto).
    const comAviso = deveAbrirNoTopo(Boolean(existente)) || proposta?.diagnostico != null;
    const noAlto = comAviso || rolado.current <= 4;
    if (noAlto) setCartaoDeVolta(true);
    // A tela deixa de seguir o fim: em vez de parar no troféu, ela rola até o nó 1, no meio da área livre (spec 16, item 1).
    // O troféu fica a uma rolagem, com a pílula "Ver o fim da trilha". Espera um quadro: o troféu e, no alto, o cartão do
    // título entram agora e mudam a página.
    mudarAcompanhar(false);
    centrarNo1NaPronta.current = !comAviso;
    const irAoNo1 = setTimeout(() => {
      if (comAviso) rolagem.current?.scrollTo({ y: 0, animated: false });
      else centrarNo1(noAlto, RITMO_DA_GERACAO.prontaAteNo1Ms);
    }, 50);
    // Depois da rolagem, a pessoa que sobe ao alto por conta própria não é puxada de volta ao nó 1.
    const fimDoCentro = setTimeout(() => { centrarNo1NaPronta.current = false; }, 50 + RITMO_DA_GERACAO.prontaAteNo1Ms + 600);
    const focar = setTimeout(() => focarSemRolar(botaoComecar.current), RITMO_DA_GERACAO.rodapeMs + 60);
    if (reduzir !== false) {
      deslize.setValue(1);
      return () => { clearTimeout(focar); clearTimeout(irAoNo1); clearTimeout(fimDoCentro); };
    }
    deslize.setValue(0);
    const entrar = Animated.timing(deslize, { toValue: 1, duration: RITMO_DA_GERACAO.rodapeMs, easing: Easing.out(Easing.quad), useNativeDriver: true });
    entrar.start();
    return () => {
      clearTimeout(focar);
      clearTimeout(irAoNo1);
      clearTimeout(fimDoCentro);
      entrar.stop();
    };
    // Só na virada para pronta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronta]);

  /** O centro do nó 1 no meio da área livre (spec 16, item 1); sem a placa quando o cartão do título voltou no alto. */
  const centrarNo1NaPronta = useRef(false);
  function centrarNo1(semPlaca: boolean, duracao: number) {
    const primeiro = todos[0]?.id;
    const centro = primeiro ? centros.current.get(primeiro) : undefined;
    if (centro === undefined) return;
    const topoLivre = semPlaca ? 0 : alturaFaixaGeracaoAgora.current + FOLGA_PLACA_GERACAO + alturaPlacaAgora.current;
    rolarAteNo1(rolagemDaTrilhaPronta(centro, visivel.current || height, topoLivre), duracao);
  }
  // A rolagem até o nó 1 pode passar pelo alto: o cartão do título volta, empurra o mapa para baixo e o nó 1 cairia atrás do
  // rodapé. Com o cartão medido, o nó 1 volta ao meio da área livre, sem animação (o movimento já aconteceu).
  useEffect(() => {
    if (!cartaoDeVolta || !pronta || !centrarNo1NaPronta.current) return;
    const relogio = setTimeout(() => centrarNo1(true, 0), 50);
    return () => clearTimeout(relogio);
    // Só quando o cartão volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartaoDeVolta]);

  // O toque em "Começar a lição 1" (spec 04, "Criar a trilha"). Se o nó 1 não está à vista, a prévia rola até ele (no app, a
  // rolagem animada do sistema; com movimento reduzido, pula), para o anel que respira e o Stu que estuda ficarem à vista.
  // A área livre é a que fica entre a base da placa presa no alto e o topo do rodapé: o nó 1, o nome dele e o Stu inteiros
  // nela, com o centro do nó a 40% da altura dela (spec 04, 917e40c).
  useEffect(() => {
    if (criacao !== 'criando') return;
    const primeiro = todos[0]?.id;
    const centro = primeiro ? centros.current.get(primeiro) : undefined;
    if (centro === undefined) return;
    const altura = visivel.current || height;
    const topoLivre = cartaoDeVolta ? 0 : alturaFaixaGeracao + FOLGA_PLACA_GERACAO + alturaPlaca;
    const naTela = centro - rolado.current;
    if (naTela - RITMO_DA_GERACAO.no1AcimaDoCentro >= topoLivre && naTela + RITMO_DA_GERACAO.no1AbaixoDoCentro <= altura) return;
    mudarAcompanhar(false);
    rolarAteNo1(Math.max(0, Math.round(centro - (topoLivre + (altura - topoLivre) * RITMO_DA_GERACAO.no1NaAreaLivre))));
    // Só no toque.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criacao]);

  // A espera real: 1,5 s sem resposta do aceite, a linha embaixo do botão diz que a IA está escrevendo as lições.
  useEffect(() => {
    setEsperaReal(false);
    if (criacao !== 'criando') return;
    const relogio = setTimeout(() => setEsperaReal(true), RITMO_DA_GERACAO.esperaRealMs);
    return () => clearTimeout(relogio);
  }, [criacao]);

  // "Ajustar pedido" sai em 200 ms durante o aceite e volta no erro. Na pilha, seu espaço fica reservado para o botão
  // principal não mudar de lugar. Com movimento reduzido, a troca é imediata.
  useEffect(() => {
    const destino = salvando ? 1 : 0;
    if (destino === 0) setAjustarFora(false);
    if (reduzir !== false) {
      saidaDoAjustar.setValue(destino);
      if (destino === 1) setAjustarFora(true);
      return;
    }
    const animacao = Animated.timing(saidaDoAjustar, { toValue: destino, duration: RITMO_DA_GERACAO.ajustarSaiMs, easing: Easing.out(Easing.quad), useNativeDriver: false });
    animacao.start(({ finished }) => { if (finished && destino === 1) setAjustarFora(true); });
    return () => animacao.stop();
  }, [salvando, reduzir, saidaDoAjustar]);

  function mudarAcompanhar(valor: boolean) {
    acompanhandoAgora.current = valor;
    setAcompanhando(valor);
  }

  /** A tela rola sozinha: enquanto a rolagem programada anda, o que ela faz não conta como a pessoa rolando. */
  function rolarPara(y: number) {
    // O ponto mais baixo passa a ser onde ela parar (aoRolar): o alvo pode estar além do fim da página enquanto ela cresce.
    programada.current = { inicio: rolado.current, alvo: y, ate: Date.now() + (reduzir === false ? RITMO_DA_GERACAO.rolagemMs + 400 : 120) };
    rolagem.current?.scrollTo({ y, animated: reduzir === false });
  }

  /**
   * A rolagem do toque até o nó 1, em 240 ms com saída suave (spec 04), quadro a quadro: a rolagem animada do sistema tem
   * duração própria (no Chromium da prévia, mais de 400 ms) e o círculo da passagem precisa saber quando ela termina.
   * Com movimento reduzido, pula.
   */
  const quadroDoNo1 = useRef<number | null>(null);
  const alvoDoNo1 = useRef<number | null>(null);
  useEffect(() => () => { if (quadroDoNo1.current !== null) cancelAnimationFrame(quadroDoNo1.current); }, []);
  function rolarAteNo1(alvo: number, duracaoPedida: number = RITMO_DA_GERACAO.rolarAteNo1Ms) {
    if (quadroDoNo1.current !== null) cancelAnimationFrame(quadroDoNo1.current);
    quadroDoNo1.current = null;
    const de = rolado.current;
    const duracao = reduzir === false && Math.abs(alvo - de) >= 2 ? duracaoPedida : 0;
    const inicio = Date.now();
    alvoDoNo1.current = alvo;
    programada.current = { inicio: de, alvo, ate: inicio + duracao + 120 };
    if (duracao === 0) {
      rolagem.current?.scrollTo({ y: alvo, animated: false });
      alvoDoNo1.current = null;
      return;
    }
    const passo = () => {
      const t = Math.min(1, (Date.now() - inicio) / duracao);
      rolagem.current?.scrollTo({ y: de + (alvo - de) * (1 - (1 - t) ** 3), animated: false });
      quadroDoNo1.current = t < 1 ? requestAnimationFrame(passo) : null;
      if (t >= 1) alvoDoNo1.current = null;
    };
    quadroDoNo1.current = requestAnimationFrame(passo);
  }
  // A passagem começou com a rolagem ainda andando (spec 04, 4140a58): o que falta termina até o prazo (t = 120 ms), com
  // saída suave; se falta mais que uma altura de tela, ou com movimento reduzido, o nó vai para o lugar na hora.
  useEffect(() => {
    rolagemDoNo1.current = {
      terminar: (prazoMs) => {
        const alvo = alvoDoNo1.current;
        if (alvo === null) return;
        const longe = Math.abs(alvo - rolado.current) > (visivel.current || height);
        rolarAteNo1(alvo, prazoMs <= 0 || longe ? 0 : prazoMs);
      },
    };
    return () => { rolagemDoNo1.current = null; };
  });

  const fimDaTrilha = () => Math.max(0, (fim.current?.base ?? 0) + 24 - (visivel.current || height));

  /** A lição nova a 60% do mapa (a parte visível abaixo da faixa presa). */
  function rolarAteLicao(id: string) {
    const centro = centros.current.get(id);
    if (centro === undefined) return;
    const alvo = rolagemDaVaga(centro, visivel.current || height, coberto.current);
    if (ultimoAlvo.current !== null && Math.abs(ultimoAlvo.current - alvo) < 2) return;
    ultimoAlvo.current = alvo;
    rolarPara(alvo);
  }

  function aoMedirNo(id: string, topo: number, base: number) {
    // A base vem 56 abaixo da lente (o nome): o centro da lente fica no meio do que sobra.
    centros.current.set(id, topo + (base - topo - 56) / 2);
    if (!pronta && acompanhandoAgora.current && id === ultimo?.id) rolarAteLicao(id);
  }

  /**
   * O fim do caminho (a chegada) entrou e foi medido: com a tela acompanhando, ela vai até o troféu. Enquanto monta, o mapa
   * chama o mesmo `acompanhar` com a vaga de cada lição nova; aqui quem segue a lição nova é rolarAteLicao (a 60%), e a vaga
   * não é o fim (tomá-la pelo fim dava o troféu por visto desde a primeira lição e uma segunda rolagem por lição).
   */
  function aoChegarAoFim(_ultimo: Faixa, alvo: Faixa) {
    if (!pronta) return;
    fim.current = alvo;
    if (acompanhandoAgora.current) rolarPara(fimDaTrilha());
    conferirTrofeu(rolado.current);
  }

  function conferirTrofeu(y: number) {
    // O troféu fica perto do alto da chegada: com ele na tela, o confete pode cair.
    if (fim.current && !trofeuAVista && fim.current.topo + 120 <= y + (visivel.current || height)) setTrofeuAVista(true);
  }

  function aoRolar(y: number) {
    const anterior = rolado.current;
    rolado.current = y;
    // Na criação, o cartão do título não volta: ele empurraria o nó 1 e o Stu para baixo do rodapé.
    if (pronta && !cartaoDeVolta && y <= 4 && criacaoAgora.current === null) setCartaoDeVolta(true);
    if (pronta) conferirTrofeu(y);
    const andando = programada.current;
    if (andando) {
      // A rolagem programada vai do início ao alvo; mais de 40 acima dos dois só pode ser a pessoa subindo.
      if (acompanhandoAgora.current && y < Math.min(andando.inicio, andando.alvo) - RITMO_DA_GERACAO.pararAcimaDe) {
        programada.current = null;
        mudarAcompanhar(false);
        return;
      }
      if (Math.abs(y - andando.alvo) < 2) {
        // Chegou: a referência é onde ela parou.
        programada.current = null;
        maisBaixo.current = y;
        return;
      }
      if (Date.now() <= andando.ate) return;
      // O tempo acabou sem chegar (a página ainda não tinha altura para o alvo): a referência é onde ela parou, e este
      // movimento já é da pessoa (a roda do mouse pode chegar num evento só).
      programada.current = null;
      maisBaixo.current = anterior;
    }
    if (acompanhandoAgora.current) {
      if (deixouDeAcompanhar(y, maisBaixo.current)) mudarAcompanhar(false);
      else maisBaixo.current = Math.max(maisBaixo.current, y);
      return;
    }
    // Rolando sozinha até a lição nova (ou, no fim, até o troféu), a tela volta a acompanhar. Só descendo: com poucas
    // lições, a nova ainda aparece no alto, e a própria subida que parou o acompanhamento o ligaria de novo.
    const centro = ultimo ? centros.current.get(ultimo.id) : undefined;
    const voltou = y > anterior && (pronta
      ? fim.current !== null && fim.current.topo + 120 <= y + (visivel.current || height)
      : centro !== undefined && vagaAVista(centro, y, visivel.current || height, coberto.current));
    if (voltou) {
      maisBaixo.current = y;
      mudarAcompanhar(true);
    }
  }

  /** A pílula: leva à lição nova (ou ao fim) em 320 ms e volta a acompanhar. */
  function verLicaoNova() {
    mudarAcompanhar(true);
    ultimoAlvo.current = null;
    if (pronta) {
      // O atalho pode ser tocado antes de a medida do troféu chegar do caminho.
      rolagem.current?.scrollToEnd({ animated: reduzir === false });
      return;
    }
    if (ultimo) rolarAteLicao(ultimo.id);
  }

  // Piloto A: voltar de 44 e título Quicksand 24/30, sem cortar nem reduzir títulos longos. A faixa mede sua altura real.
  const nomeNoAlto = titulo || geracao.objetivo;
  const faixa = (
    <View>
      <View testID="faixa-geracao" style={[estudoEstilos.faixaGeracao, largo && estudoEstilos.faixaGeracaoLarga]} onLayout={(evento) => {
        const medida = Math.round(evento.nativeEvent.layout.height);
        coberto.current = medida;
        setAlturaFaixaGeracao((anterior) => anterior === medida ? anterior : medida);
      }}>
        <Pressable testID="geracao-voltar" accessibilityRole="button" accessibilityLabel={pronta ? mensagens.geracao.ajustar : mensagens.geracao.cancelar}
          disabled={ocupado || salvando} onPress={pronta ? ajustar : cancelar} hitSlop={4}
          style={({ pressed }) => [estudoEstilos.geracaoVoltar, pressed && { opacity: 0.8 }]}>
          <View style={{ transform: [{ rotate: '180deg' }] }}><Icone nome="seta" tamanho={20} cor={cores.textoSecundario} /></View>
        </Pressable>
        {!pronta && <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden><Pontinhos cor={cores.acao} tamanho={6} vao={4} /></View>}
        <Text accessibilityRole="header" testID="geracao-nome" style={[estudoEstilos.faixaGeracaoNome, nomeLongo && estudoEstilos.faixaGeracaoNomeLongo]}
          onTextLayout={(evento) => { const longo = evento.nativeEvent.lines.length >= 3; setNomeLongo((antes) => (antes === longo ? antes : longo)); }}>
          {nomeNoAlto}
        </Text>
      </View>
      {/* A placa fica presa no alto do mapa, com a folga compartilhada abaixo da faixa. */}
      <View pointerEvents="none" style={[estudoEstilos.placaGeracaoLugar, { top: alturaFaixaGeracao + FOLGA_PLACA_GERACAO }]} onLayout={(evento) => {
        const medida = Math.round(evento.nativeEvent.layout.height);
        setAlturaPlaca((anterior) => anterior === medida ? anterior : medida);
      }}>
        <PlacaDaGeracao pronta={pronta} esperaLonga={esperaLonga} licoes={total} partes={partes} sai={criacao === 'criada'} reduzir={reduzir} />
      </View>
    </View>
  );

  const expirada = criacao === 'expirada';
  const espera = criacao === 'criando' && esperaReal && <LinhaDaEspera reduzir={reduzir} />;
  const erroDaCriacao = falhou && criacao !== 'erro-salvar' && (
    <Text testID="criacao-erro" accessibilityLiveRegion="assertive" style={estudoEstilos.criacaoErro}>
      {expirada ? mensagens.geracao.propostaExpirada : (mensagemDoAceite ?? mensagens.geracao.erroCriacao)}
    </Text>
  );
  const principal = pronta && proposta && !(expirada && geracao.deMaterial) && (
    <View style={!empilhar && (dividir || salvando) ? estudoEstilos.metade : null}>
      <Botao plano referencia={botaoComecar} testID={expirada ? 'montar-de-novo' : 'comecar-trilha'}
        rotulo={iniciando ? (proposta.pedidoId ? mensagens.geracao.preparandoTrilha : mensagens.geracao.criandoTrilha) : expirada ? mensagens.geracao.montarDeNovo : mensagens.geracao.comecarLicao1}
        ocupado={iniciando} afundado={iniciando} giro={iniciando} desativado={ocupado && !iniciando}
        acao={() => (expirada ? remontar() : comecar(proposta))} estilo={[estudoEstilos.acaoPiloto, dividir && estudoEstilos.botaoDividido]} />
    </View>
  );
  const secundaria = (empilhar || !ajustarFora) && (
    <Animated.View pointerEvents={salvando ? 'none' : undefined} accessibilityElementsHidden={salvando}
      importantForAccessibility={salvando ? 'no-hide-descendants' : 'auto'}
      onLayout={empilhar ? ({ nativeEvent: { layout } }) => setAlturaDoAjuste(Math.max(44, layout.height)) : undefined}
      style={empilhar ? { opacity: saidaDoAjustar.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
        : dividir ? [estudoEstilos.metade, salvando || falhou ? {
          flexGrow: saidaDoAjustar.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          // Ao voltar (no erro), só aparece quando a largura já voltou: numa linha, sem quebrar enquanto o outro encolhe.
          opacity: saidaDoAjustar.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0, 0] }),
          marginRight: saidaDoAjustar.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }),
        } : null] : null}>
      <Botao plano rotulo={pronta ? mensagens.geracao.ajustar : mensagens.geracao.cancelar} testID="voltar-pedido" variante="secundario"
        desativado={ocupado} acao={pronta ? ajustar : cancelar}
        estilo={empilhar ? estudoEstilos.geracaoBotaoSecundario : dividir ? estudoEstilos.botaoDividido : undefined} umaLinha />
    </Animated.View>
  );
  // Durante "Criando sua trilha…" (e na passagem), a pílula sai: ela cobria o nome do nó 1 e não serve ali (como na web).
  const pilula = !acompanhando && total > 0 && !(pronta && trofeuAVista) && !salvando && (
    <Pressable testID="ver-licao-nova" accessibilityRole="button" onPress={verLicaoNova}
      style={({ pressed }) => [estudoEstilos.pilulaSeguir, pressed && estudoEstilos.pilulaSeguirApertada]}>
      <View style={{ transform: [{ rotate: '90deg' }] }}><Icone nome="seta" tamanho={18} cor={cores.fundo} sistema /></View>
      <Text style={estudoEstilos.pilulaSeguirTexto}>{pronta ? mensagens.geracao.verFimDaTrilha : mensagens.geracao.verLicaoNova(total)}</Text>
    </Pressable>
  );
  const rodape = (
    <Animated.View style={[estudoEstilos.geracaoRodape, pronta && reduzir === false && {
      opacity: deslize, transform: [{ translateY: deslize.interpolate({ inputRange: [0, 1], outputRange: [RITMO_DA_GERACAO.rodapeDeslize, 0] }) }],
    }]}>
      {retomada ?? <>
      {pronta && !salvando && (
        <View style={estudoEstilos.estadoDaProposta}>
          <Text style={[estilos.legenda, estudoEstilos.notaDaProposta]} testID="proposta-nao-salva">Sua proposta ainda não está salva.</Text>
          {pilula}
        </View>
      )}
      <View style={empilhar ? estudoEstilos.geracaoAcoesEmpilhadas : estudoEstilos.geracaoAcoes}>
        {empilhar && principal}
        {empilhar && erroDaCriacao}
        {empilhar ? <View style={estudoEstilos.geracaoLugarSecundario}>
          {secundaria}
          {/* Usa o mesmo espaço do ajuste. Se a fonte fizer o texto ficar mais alto, a linha pode crescer. */}
          {espera && <View style={[estudoEstilos.geracaoEsperaEmpilhada, { marginTop: -alturaDoAjuste, minHeight: alturaDoAjuste }]}>{espera}</View>}
        </View> : secundaria}
        {!pronta && (
          <View testID="geracao-situacao" accessible accessibilityLabel={mensagens.geracao.montando} style={estudoEstilos.situacao}>
            <Text style={estudoEstilos.situacaoRotulo}>{mensagens.geracao.montando}</Text>
          </View>
        )}
        {!empilhar && principal}
      </View>
      {pronta && proposta && !expirada && !iniciando && (!ocupado || guardando) &&
        <>
          <Botao plano rotulo={guardando ? (proposta.pedidoId ? mensagens.geracao.salvandoSuaTrilha : mensagens.geracao.salvandoTrilha) : mensagens.geracao.salvarParaDepois}
            testID="salvar-trilha-depois" variante="secundario" ocupado={guardando} giro={guardando} acao={() => salvar(proposta)} />
          {criacao === 'erro-salvar' && <Text testID="salvar-trilha-erro" role="alert" accessibilityLiveRegion="assertive"
            style={estudoEstilos.criacaoErro}>{mensagemDoAceite ?? mensagens.geracao.erroSalvar}</Text>}
        </>}
      {!empilhar && espera}
      {!empilhar && erroDaCriacao}
      {sairDuranteAceite && <Botao compacto variante="texto" testID="criacao-sair-aceite" rotulo={mensagens.planos.titulo} acao={sairDuranteAceite} />}
      </>}
    </Animated.View>
  );

  return (
    // Com o cartão do título de volta (no fim, no alto), a faixa volta a ser o cartão: ela sai, e a placa fica no alto do mapa.
    <Tela pagina="geracao" avisoNoFluxo acoes={acoes} rodape={rodape} rolagem={rolagem} estiloConteudo={estudoEstilos.geracaoConteudo} faixaFixa={cartaoDeVolta ? undefined : faixa} faixaColada
      estiloRodapeConteudo={empilhar ? estudoEstilos.geracaoRodapeEstreito : undefined}
      flutuante={pronta ? undefined : pilula || undefined} aoMedir={(altura) => { visivel.current = altura; }} aoRolar={aoRolar}>
      {erro && <EstadoErro mensagem={erro} foco acao={acaoErro} />}
      {/* No fim, ao subir até o começo do mapa, a faixa volta a ser o cartão do título (o título, o pedido e de onde veio). */}
      {pronta && proposta && cartaoDeVolta && (
        <View testID="cartao-titulo-geracao" style={[estudoEstilos.faixa, estudoEstilos.cartaoDeVolta, largo && estudoEstilos.faixaLarga]}>
          <Text style={estudoEstilos.contexto}>{mensagens.geracao.contexto}</Text>
          <TituloGeracao titulo={titulo} foco={false} reduzir={reduzir} />
          {titulo !== null && !repeteTitulo(titulo, geracao.objetivo) && (
            <Text numberOfLines={3} accessibilityLabel={geracao.objetivo} style={[estilos.introducao, estudoEstilos.objetivoFaixa]}>
              {geracao.objetivo}
            </Text>
          )}
          <Text style={estudoEstilos.geracaoIa}>
            {origemDemonstracao(proposta.origem) ? mensagens.geracao.demonstracao : mensagens.geracao.ia}
          </Text>
          {existente && !salvando && (
            <View testID="trilha-repetida" accessibilityLiveRegion="polite" style={estudoEstilos.repetida}>
              <Text style={estudoEstilos.repetidaTexto}>{mensagens.geracao.repetida(existente.titulo)}</Text>
              <Botao rotulo={mensagens.geracao.abrirExistente} testID="abrir-existente" variante="secundario" estilo={{ alignSelf: 'flex-start' }} desativado={ocupado}
                acao={() => abrirExistente(existente.id)} />
            </View>
          )}
          {proposta.diagnostico && <PontoDePartida perfil={proposta.diagnostico} primeiroPasso={proposta.fluxos[0]?.licoes[0]?.titulo} />}
          {/* Spec 08 (c20ed0f): sem a linha "Fonte: <provedor>"; "Gerada por IA a partir do seu pedido…" continua acima. */}
        </View>
      )}
      {cartaoDeVolta && (
        // A placa no respiro que o céu reserva para ela (alturaPlaca + 20), 10 abaixo do começo do mapa: uma camada de altura
        // zero antes do mapa, por cima dele, sem mudar o lugar do que o mapa mede.
        <View style={estudoEstilos.placaNoMapa} pointerEvents="none">
          <View style={estudoEstilos.placaNoMapaLugar}>
            <PlacaDaGeracao pronta={pronta} esperaLonga={false} licoes={total} partes={partes} sai={criacao === 'criada'} reduzir={reduzir} />
          </View>
        </View>
      )}
      {/* A prévia é rascunho, sem confete no troféu; no toque, o nó 1 e o Stu contam a criação (spec 04, "Criar a trilha"). */}
      <Caminho claro nos={nos} extraChegada={44}
        chegada={pronta} montando={!pronta} acompanhar={aoChegarAoFim} semFala respiroNoAlto={alturaPlaca + 20} aoMedirNo={aoMedirNo}
        stuNoNo1={pronta} festaPermitida={false} trofeuDoZero rascunho guardarNo1={guardarNo1}
        criacao={criacao === null || criacao === 'guardando' ? null : criacao === 'criando' || criacao === 'criada' ? criacao : 'erro'} />
    </Tela>
  );
}

/**
 * A placa da geração (spec 04, revisão de "Criar a trilha"): fundo #FFF9EC, borda de 2 px #E8D3A8 e raio de 16. Diz só o que
 * é verdade, sem dicas que se revezam: "Montando sua trilha" enquanto chegam lições, "Ainda montando a próxima lição…"
 * depois de 12 s sem lição nova e a contagem da proposta no fim. Cada lição é anunciada enquanto chega, e a contagem da
 * proposta permanece disponível para leitura até a passagem.
 */
function PlacaDaGeracao({ pronta, esperaLonga, licoes, partes, sai = false, reduzir = null }: {
  pronta: boolean; esperaLonga: boolean; licoes: number; partes: number;
  /** A proposta virou trilha (t = 0 da passagem): a placa sai, com opacidade e 8 px para cima, em 150 ms (reduzido: na hora). */
  sai?: boolean;
  reduzir?: boolean | null;
}) {
  const texto = pronta ? mensagens.geracao.propostaPronta(licoes, partes) : esperaLonga ? mensagens.geracao.aguardandoLicao : mensagens.geracao.montandoTitulo;
  const [saida] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!sai) {
      saida.setValue(0);
      return;
    }
    if (reduzir !== false) {
      saida.setValue(1);
      return;
    }
    const animacao = Animated.timing(saida, { toValue: 1, duration: RITMO_DA_GERACAO.placaSaiMs, easing: Easing.out(Easing.quad), useNativeDriver: true });
    animacao.start();
    return () => animacao.stop();
  }, [sai, reduzir, saida]);
  return (
    <Animated.View testID="placa-geracao" importantForAccessibility={pronta && !sai ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!pronta || sai} style={[estudoEstilos.placaGeracao, {
      opacity: saida.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      transform: [{ translateY: saida.interpolate({ inputRange: [0, 1], outputRange: [0, -RITMO_DA_GERACAO.placaSaiDeslize] }) }],
    }]}>
      <Text style={estudoEstilos.placaGeracaoTexto}>{texto}</Text>
    </Animated.View>
  );
}

/** A proposta pronta abre no topo (sem rolar até o nó 1) quando há o aviso de trilha repetida, para ele ficar inteiro à vista. */
export function deveAbrirNoTopo(temTrilhaRepetida: boolean) {
  return temTrilhaRepetida;
}

/**
 * A espera depois de "Começar a lição 1" (spec 17, mudança 1, revisão 04fe621): a linha embaixo do botão aparece aos 1,5 s
 * com "Escrevendo suas lições…" (`geracao.escrevendoLicoes`) e, 3 s depois, troca para as frases do contrato
 * (`geracao.dicas`), uma a cada 5 s, em laço, com o efeito de 300 ms (movimento reduzido: na hora). O relógio é o do
 * contrato (`dicaDaEspera`, `faltaParaTrocarADica`), contado de quando a linha aparece. Sai com a troca de tela. Fora de
 * região viva: o leitor de tela ouve "Criando sua trilha." uma vez (o botão fica ocupado) e lê a linha só se for até ela.
 */
function LinhaDaEspera({ reduzir }: { reduzir: boolean | null }) {
  const inicio = useRef(Date.now());
  const [agora, setAgora] = useState(() => Date.now());
  const dicas = mensagens.geracao.dicas;
  useEffect(() => {
    const relogio = setTimeout(() => setAgora(Date.now()), faltaParaTrocarADica(Date.now() - inicio.current) + 5);
    return () => clearTimeout(relogio);
  }, [agora]);
  const indice = dicaDaEspera(agora - inicio.current, dicas.length);
  const texto = indice === null ? mensagens.geracao.escrevendoLicoes : dicas[indice];
  const [mostrado, setMostrado] = useState(texto);
  const [brilho] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (texto === mostrado) return;
    if (reduzir !== false) {
      brilho.setValue(1);
      setMostrado(texto);
      return;
    }
    const metade = ESPERA_DA_GERACAO.efeitoMs / 2;
    const sumir = Animated.timing(brilho, { toValue: 0, duration: metade, easing: Easing.out(Easing.quad), useNativeDriver: true });
    sumir.start(({ finished }) => {
      if (!finished) return;
      setMostrado(texto);
      Animated.timing(brilho, { toValue: 1, duration: metade, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    });
    return () => sumir.stop();
    // Só quando o texto pedido muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);
  return (
    <Animated.Text testID="criacao-espera" accessibilityLiveRegion="none" style={[estudoEstilos.criacaoEspera, { opacity: brilho }]}>
      {mostrado}
    </Animated.Text>
  );
}

/**
 * A passagem da criação (spec 04, "Criar a trilha"): por cima de tudo, um círculo da cor do fundo da aula cresce do centro do
 * nó 1 até cobrir a tela (aos 120 ms, em 300 ms, saída suave); aos 320 ms a aula já está embaixo, e a camada some em 150 ms
 * (a aula "entra por cima"). Com movimento reduzido, sem círculo: a camada cheia some em 150 ms. Não recebe toque: a aula
 * responde assim que monta.
 */
function PassagemDaCriacao({ passagem, aoTerminar }: { passagem: Passagem; aoTerminar: () => void }) {
  const { width, height } = useWindowDimensions();
  const raiz = useRef<ComponentRef<typeof View>>(null);
  const [deslocamento, setDeslocamento] = useState<{ x: number; y: number } | null>(null);
  const [crescer] = useState(() => new Animated.Value(0));
  const [presenca] = useState(() => new Animated.Value(1));
  const { inicio, reduzida, origem, aulaNaTela } = passagem;
  const terminar = useRef(aoTerminar);
  terminar.current = aoTerminar;

  // O círculo cresce aos 120 ms, em 300 ms, assim que o centro do nó 1 é conhecido (com movimento reduzido, não há círculo:
  // a camada já começa cheia).
  const temOrigem = origem !== null;
  useEffect(() => {
    if (reduzida || !temOrigem) return;
    const crescimento = Animated.timing(crescer, { toValue: 1, duration: RITMO_DA_GERACAO.circuloMs,
      delay: Math.max(0, RITMO_DA_GERACAO.circuloAtrasoMs - (Date.now() - inicio)), easing: Easing.out(Easing.cubic), useNativeDriver: true });
    crescimento.start();
    return () => crescimento.stop();
  }, [inicio, reduzida, temOrigem, crescer]);

  // A aula entra por cima: a camada some em 150 ms a partir dos 320 ms (reduzida: na hora), só com a aula já na tela.
  useEffect(() => {
    if (!aulaNaTela) return;
    const sumir = Animated.timing(presenca, { toValue: 0, duration: RITMO_DA_GERACAO.aulaOpacidadeMs,
      delay: reduzida ? 0 : Math.max(0, RITMO_DA_GERACAO.aulaEntraMs - (Date.now() - inicio)), easing: Easing.linear, useNativeDriver: true });
    sumir.start(({ finished }) => { if (finished) terminar.current(); });
    return () => sumir.stop();
  }, [aulaNaTela, inicio, reduzida, presenca]);

  // O centro do nó 1 vem em coordenadas da janela; a camada pode não começar no canto da janela.
  const ponto = origem ? { x: origem.x - (deslocamento?.x ?? 0), y: origem.y - (deslocamento?.y ?? 0) } : { x: width / 2, y: height / 2 };
  const raio = raioQueCobre(ponto.x, ponto.y, width, height);
  return (
    <Animated.View ref={raiz} testID="passagem-criacao" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      collapsable={false} style={[StyleSheet.absoluteFill, estudoEstilos.passagem, { opacity: presenca }]}
      onLayout={() => raiz.current?.measureInWindow((x, y) => setDeslocamento({ x, y }))}>
      {reduzida
        ? <View style={[StyleSheet.absoluteFill, { backgroundColor: cores.fundo }]} />
        : temOrigem && <Animated.View style={{ position: 'absolute', left: ponto.x - raio, top: ponto.y - raio, width: raio * 2, height: raio * 2, borderRadius: raio,
            backgroundColor: cores.fundo, transform: [{ scale: crescer }] }} />}
    </Animated.View>
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
function TelaPlano({ etapa, acoes, erro, acaoErro, ocupado, abrindo, abrirLicao, novoPlano, sincronia, compartilhar, configurar }: {
  /** Abre a folha "Compartilhar trilha" (só na trilha da própria pessoa, com o compartilhar ligado). */
  compartilhar?: () => void;
  /** A engrenagem leva às configurações da trilha (capa, nome, descrição, tema, quem pode ver, apagar). */
  configurar?: () => void;
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
  function rolar(topo: number, base: number, sempre = false, ceu?: { topo: number; parte: number; coberto: number }, cobertoNoAlto?: number) {
    requestAnimationFrame(() => {
      const altura = visivel.current || height;
      // O card da próxima lição flutua sobre o pé da área: o nó e o título embaixo dele precisam ficar acima do card.
      const pe = base + 48;
      const limite = altura - (proximo ? 168 : 24);
      // Spec 01 (e198866), "Mostrar a lição atual no mapa": o nó inteiro na área livre, entre o fim do cabeçalho preso (+16)
      // e o card ou a cápsula. Se já cabe, nada rola; senão, rola o mínimo; mais alto que a área, o topo tem prioridade.
      if (cobertoNoAlto !== undefined) {
        const atual = rolagemY.current;
        const cima = cobertoNoAlto + 16;
        if (topo - atual >= cima && pe - atual <= limite) return;
        let y = pe - atual > limite ? pe - limite : topo - cima;
        if (topo - y < cima) y = topo - cima;
        rolagem.current?.scrollTo({ y: Math.max(0, y), animated: reduzir === false });
        return;
      }
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
  const comCompartilhar = Boolean(!plano.recebida && compartilhar);
  // Como .trilha-topo__texto da web: na trilha recebida, "Esta trilha é de Ana" e o link original; na da própria pessoa,
  // "Compartilhar" (ou "Compartilhada", com o link ativo); depois de adicionar, o aviso verde.
  const marcaDoTopo = (
    <>
      {plano.recebida && <TrilhaRecebida recebida={plano.recebida} />}
      {/* Como .trilha-topo__acoes da web: "Compartilhar" (só na trilha da própria pessoa) e a engrenagem, com 8 entre eles. Com
          o botão, os 10 de cima ficam na fileira, e não nele: os dois, de 48, alinham pelo centro (decisão do Lead, 19/11). */}
      {(comCompartilhar || configurar) && (
        <View style={[estudoEstilos.acoesTopo, comCompartilhar && estudoEstilos.acoesTopoComCompartilhar]}>
          {!plano.recebida && compartilhar && (
            <Botao rotulo={rotuloDoCompartilhamento(estadoDoCompartilhamento(plano.link))} iconeAntes="compartilhar" variante="secundario"
              testID="plano-compartilhar" nomeAcessivel={mensagens.compartilhar.entradaRotulo(plano.titulo)} desativado={ocupado} acao={compartilhar} />
          )}
          {configurar && <BotaoConfigurar titulo={plano.titulo} desativado={ocupado} acao={configurar} />}
        </View>
      )}
      {etapa.aviso && <AvisoDaTrilha texto={etapa.aviso} />}
    </>
  );
  const passo = proximo && (
    <ProximoPasso titulo={proximo.no.titulo} detalhe={proximo.posicao} abrindo={abrindo === proximo.no.id} andamento={proximo.no.andamento}
      ocupado={ocupado} rodape={!largo} aoAbrir={() => abrirLicao(proximo.no.id)} />
  );
  // .trilha-capa da web: a capa escolhida no alto do mapa, em 4:1 (até 140 de altura) e cantos de 20. Só com capa escolhida.
  const capa = plano.capa
    ? <CapaDaTrilha semente={plano.id} tema={plano.tema ?? null} capa={plano.capa} grande estilo={estudoEstilos.capaTrilha} />
    : null;

  return (
    <Tela pagina={`plano-${plano.id}`} acoes={acoes} rodape={largo || (atualVisivel && passo) ? null : passo || novo} rolagem={rolagem}
      // A cápsula da barra de baixo flutua sobre o fim do mapa: o morro do troféu continua por baixo dela (o caminho soma o
      // espaço dela), sem a faixa vazia do fim da rolagem.
      fimSobABarra={!largo}
      // Como na web no celular (levantamento de paridade, M1): a barra da marca, com "Sair" e o selo de sincronia, rola e sai
      // de vista; o cabeçalho da trilha (rótulo, nome em até duas linhas e o anel) rola até o alto e fica parado lá.
      abaixoDoLogo={largo ? undefined : <SeloSincronia sincronia={sincronia} />}
      // No celular, a capa rola com a página e sai de vista antes do cabeçalho, que fica parado no alto. Como na web (medido
      // em 390 e 360): 28 da barra da marca até a capa (o vão de 20 do Tela e 8 aqui) e 16 da capa até a faixa.
      acimaDaFaixa={largo || !capa ? undefined : <View testID="capa-do-mapa" style={estudoEstilos.capaTrilhaFaixa}>{capa}</View>}
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
      {largo && capa && <View testID="capa-do-mapa" style={estudoEstilos.capaTrilhaLarga}>{capa}</View>}
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
  const botao = <Botao plano rotulo={abrindo ? mensagens.trilha.abrindo : andamento ? mensagens.trilha.continuarLicao : mensagens.trilha.comecarLicao} testID="comecar-licao"
    dica={titulo} desativado={ocupado} ocupado={abrindo} acao={aoAbrir} />;

  if (rodape) {
    return (
      <View style={estudoEstilos.proximoRodape}>
        <View style={estudoEstilos.proximoTextos}>
          <Text style={[estudoEstilos.proximoRotulo, estudoEstilos.proximoRotuloRodape]}>{mensagens.trilha.proxima}</Text>
          {/* .trilha-proximo__titulo no celular: 15 px em 800, entrelinha 1,25 e até 3 linhas (o nome cortado com reticências era defeito). */}
          <Text numberOfLines={3} accessibilityLabel={falarTextoComFormulas(titulo)} style={[estudoEstilos.proximoTitulo, estudoEstilos.proximoTituloRodape]}>
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
function BarraProgresso({ progresso, testID, naFaixa = false, comPercentual = false, de, discreta = false }: {
  discreta?: boolean;
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
      <View importantForAccessibility="no" style={[estudoEstilos.trilha, naFaixa && estudoEstilos.trilhaNaFaixa, discreta && { height: 8 }]}>
        <Animated.View style={[estudoEstilos.preenchimento, {
          width: enchimento.interpolate({ inputRange: [0, 1], outputRange: [`${inicial}%`, `${valor}%`] }),
        }]}>
          {!discreta && <View style={estudoEstilos.brilhoBarra} />}
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
function CartaoDestaque({ plano, indice, sincronia, ocupado, abrir, apagar, compartilhar, configurar, postar }: {
  postar?: AtalhoPostar;
  plano: PlanoResumo;
  indice: number;
  sincronia: Sincronia;
  ocupado: boolean;
  abrir: () => void;
  apagar: () => void;
  /** "Configurações" no menu "•••", antes de "Apagar". */
  configurar: () => void;
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

  return (
    // .plano-destaque: borda de 2 que fecha em volta e o degrau de 4 por fora (box-shadow 0 4px 0 #c3cdf2). A face recorta a
    // cena (overflow hidden), então o degrau é a camada de fora.
    <Animated.View testID="plano-destaque" style={[degrauFora(4, 24, cores.destaqueBorda), estudoEstilos.destaqueFora, estiloDeEntrada(entrada)]}>
    <View style={estudoEstilos.destaque}>
      <View style={[estudoEstilos.destaqueCena, { backgroundColor: chao }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {/* Como .plano-destaque__capa da web: com capa escolhida nas configurações, ela entra no lugar da ilustração. */}
        {plano.capa ? <CapaDaTrilha semente={plano.id} tema={plano.tema ?? null} capa={plano.capa} estilo={StyleSheet.absoluteFill} /> : (
          <>
            <View style={[estudoEstilos.cartaoColina, estudoEstilos.cartaoColinaDestaque, { backgroundColor: relevo }]} />
            <Desenho nome={enfeites[0]} largura={40} estilo={[estudoEstilos.cartaoEnfeite, { left: '9%' }]} />
            <Desenho nome={enfeites[2]} largura={36} estilo={[estudoEstilos.cartaoEnfeite, { right: '9%' }]} />
            {/* Spec 13: `stu-feliz` de 64, na sombra de contato, que se mexe uma vez ao abrir (emenda E1). */}
            <View style={estudoEstilos.destaqueStu}>
              <Stu nome="stu-feliz" tamanho={64} animado="uma-vez" sombra />
            </View>
          </>
        )}
      </View>
      {/* Como .plano-cartao__menu da web: o "•••" dentro da arte, 8 do topo e da direita dela (24 do cartão), com o "Apagar"
          num balão embaixo. */}
      <MenuDoCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} compartilhar={compartilhar} configurar={configurar} postar={postar} testID="apagar-destaque" estilo={estudoEstilos.menuDestaque} />
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
function CartaoPlano({ plano, indice, ocupado, abrir, apagar, compartilhar, configurar, secundario = false, postar }: {
  postar?: AtalhoPostar;
  /** "Configurações" no menu "•••", antes de "Apagar". */
  configurar: () => void;
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
        {/* Como .plano-cartao__capa da web: a capa escolhida no lugar da ilustração; o selo de concluída fica por cima. */}
        {plano.capa ? <CapaDaTrilha semente={plano.id} tema={plano.tema ?? null} capa={plano.capa} estilo={StyleSheet.absoluteFill} /> : (
          <>
            <View style={[estudoEstilos.cartaoColina, { backgroundColor: relevo }]} />
            <Desenho nome={enfeites[0]} largura={46} estilo={[estudoEstilos.cartaoEnfeite, { left: '8%' }]} />
            <Desenho nome={enfeites[1]} largura={26} estilo={[estudoEstilos.cartaoEnfeite, { left: '30%' }]} />
            <Desenho nome={enfeites[3]} largura={34} estilo={[estudoEstilos.cartaoEnfeite, { right: '26%' }]} />
            <Desenho nome={enfeites[2]} largura={44} estilo={[estudoEstilos.cartaoEnfeite, { right: '6%' }]} />
          </>
        )}
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
      <MenuDoCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} compartilhar={compartilhar} configurar={configurar} postar={postar} testID={`apagar-plano-${indice}`} />
    </View>
    </Animated.View>
  );
}

/**
 * O "•••" de cada cartão de Minhas trilhas: o menu de ações do Studoo (spec 11), igual no iPhone, no Android e na web.
 * "Compartilhar" (só nas trilhas da pessoa), "Configurações" e, por último, depois de uma linha, "Apagar" em vermelho, que
 * pede confirmação.
 */
/** O atalho "Postar no meu perfil" / "Tirar do meu perfil" do "•••" (spec 10): se a trilha já está no perfil e o que fazer. */
type AtalhoPostar = { noPerfil: boolean; acao: () => void };

function MenuDoCartao({ titulo, ocupado, apagar, compartilhar, configurar, postar, testID, estilo }: { titulo: string; ocupado: boolean; apagar: () => void; compartilhar?: () => void; configurar: () => void; postar?: AtalhoPostar; testID: string; estilo?: StyleProp<ViewStyle> }) {
  const acoes: AcaoDoMenu[] = [
    ...(compartilhar ? [{ rotulo: mensagens.compartilhar.entrada, icone: 'compartilhar' as const, aoEscolher: compartilhar, testID: `${testID}-compartilhar`,
      nomeAcessivel: mensagens.compartilhar.entradaRotulo(titulo) }] : []),
    // Spec 10: logo depois de "Compartilhar"; o menu fica com Compartilhar, este, Configurações e Apagar.
    ...(postar ? [{ rotulo: postar.noPerfil ? mensagens.perfil.postar.menuTirar : mensagens.perfil.postar.menuPostar, icone: 'pessoa' as const,
      aoEscolher: postar.acao, testID: `${testID}-postar` }] : []),
    { rotulo: mensagens.configuracoes.entrada, icone: 'engrenagem', aoEscolher: configurar, testID: `${testID}-configuracoes`,
      nomeAcessivel: mensagens.configuracoes.entradaRotulo(titulo) },
    { rotulo: mensagens.planos.apagar, icone: 'lixeira', aoEscolher: apagar, perigo: true, testID, nomeAcessivel: mensagens.planos.apagarRotulo(titulo) },
  ];
  return (
    <View style={[estudoEstilos.menu, estilo]}>
      <MenuDeAcoes rotulo={mensagens.planos.maisOpcoesRotulo(titulo)} acoes={acoes} testID={`${testID}-menu`} desativado={ocupado} estiloBotao={estudoEstilos.menuBotao} />
    </View>
  );
}

/** Tempo em minutos e segundos, como 1:05. */
function formatarTempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Conclusão Clareza: uma reação do Stu, progresso confirmado, próximo passo e objetivo;
 * os detalhes da sessão permanecem abaixo do núcleo, sem camadas decorativas em loop.
 */
function TelaConcluida({ etapa, acoes, mensagem, rodape, ocupado, visitante, compartilhar }: {
  etapa: Extract<Etapa, { tipo: 'concluida' }>;
  acoes: ReactNode;
  mensagem: ReactNode;
  rodape: ReactNode;
  ocupado: boolean;
  visitante: boolean;
  /** Com a trilha concluída, "Compartilhar esta trilha" (só na trilha da própria pessoa, com o compartilhar ligado). */
  compartilhar?: () => void;
}) {
  const { plano, antes, licao, liberadas, resumo } = etapa;
  const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);
  // A última lição fecha a trilha: a comemoração é da trilha inteira.
  const trilhaFeita = plano.progresso.total > 0 && plano.progresso.concluidas === plano.progresso.total;
  // Ficou exercício sem acerto ou a prática não saiu: a conclusão vira um lembrete gentil (sem confete nem raios).
  const comLembrete = Boolean(resumo && (resumo.acertos < resumo.exercicios || resumo.pratica === 'ainda_nao'));

  return (
    <Tela pagina="concluida" semCabecalho rodape={rodape} estiloConteudo={estudoEstilos.fimQuarenta}>
      {/* Sem chuva de confete quando ficou exercício sem acerto ou a prática não saiu: a conclusão vira um lembrete gentil. */}
      <View style={estudoEstilos.conclusaoTopo}>
        {/* Uma expressão do kit atual, em 110, sem ampliar o personagem provisório ou repetir celebrações. */}
        <CenaConclusao nome={trilhaFeita ? 'stu-celebrando' : comLembrete ? 'stu-encorajador' : 'stu-comemorando'}
          tamanho={110} />
        <Titulo testID="titulo-conclusao" foco estilo={[estudoEstilos.textoCentro, estudoEstilos.conclusaoTitulo]}>
          {trilhaFeita ? mensagens.licao.trilhaConcluida : mensagens.licao.concluida}
        </Titulo>
        <Text style={[estudoEstilos.conclusaoLicao, estudoEstilos.textoCentro]}>{trilhaFeita ? plano.titulo : licao.titulo}</Text>
      </View>
      <View style={estudoEstilos.conclusaoNucleo}>
        <View style={[estudoEstilos.bloco, estudoEstilos.blocoProgresso]}>
          <Text accessibilityRole="header" style={[estilos.tituloBloco, estudoEstilos.tituloProgresso]}>{mensagens.licao.progresso}</Text>
          <BarraProgresso progresso={plano.progresso} de={antes} testID="progresso-plano" comPercentual discreta />
        </View>
        <View style={estudoEstilos.conclusaoSincronia}>
          <Icone nome="check" tamanho={18} cor="#17684A" />
          <Text style={estudoEstilos.historiaSincronia}>
            {visitante ? mensagens.sessaoVisitante.progresso : mensagens.licao.historia.sincronia}
          </Text>
        </View>
        {liberada && <View style={estudoEstilos.liberada}>
          <Icone nome="livro" tamanho={20} cor={cores.acao} />
          <Text style={estudoEstilos.liberadaTexto}>{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</Text>
        </View>}
        <View testID="conclusao-aprendizado" style={estudoEstilos.conclusaoAprendizado}>
          <Text accessibilityRole="header" style={estudoEstilos.aprendizadoRotulo}>{mensagens.licao.historia.praticou}</Text>
          <TextoComFormulas texto={licao.objetivo} estilo={estudoEstilos.historiaTexto} />
        </View>
        {resumo?.rever && <View testID="conclusao-rever" style={estudoEstilos.rever}>
          <View style={estudoEstilos.reverIcone}><Icone nome="revisao" tamanho={20} cor={cores.alerta} /></View>
          <Text style={estudoEstilos.reverTexto}>{textoParaRever(resumo)}</Text>
        </View>}
      </View>
      {mensagem}
      <Text style={estudoEstilos.comemoracao}>
        {trilhaFeita ? mensagens.licao.trilhaConcluidaTexto(plano.titulo) : mensagens.licao.comemoracao}
      </Text>
      {trilhaFeita && <View testID="resumo-trilha" style={estudoEstilos.resumoTrilha}>
        <Icone nome="trofeu" tamanho={18} cor={cores.textoSecundario} />
        <Text style={estudoEstilos.resumoTrilhaTexto}>{mensagens.licao.trilhaResumo(plano.progresso.total, plano.fluxos.length, plano.estatisticas)}</Text>
      </View>}
      {(resumo?.ponteConstruida || resumo?.ensinouStu) && <View testID="conclusao-historia" accessibilityLabel={mensagens.licao.historia.titulo} style={estudoEstilos.historia}>
        {resumo.ponteConstruida && <CartaoHistoria tipo="ponte" titulo={mensagens.licao.historia.ponteTitulo} texto={mensagens.licao.historia.ponteTexto} ordem={0} />}
        {resumo.ensinouStu && <CartaoHistoria tipo="ensino" titulo={mensagens.licao.historia.ensinoTitulo} texto={mensagens.licao.historia.ensinoTexto}
          ordem={resumo.ponteConstruida ? 1 : 0} />}
      </View>}
      {resumo && trilhaFeita && <Text style={estudoEstilos.legendaNumeros}>{mensagens.licao.resumo.ultimaLicao}</Text>}
      {resumo && <NumerosDaLicao resumo={resumo} />}
      {licao.falas && licao.falas.length > 0 && (
        <View style={[estudoEstilos.bloco, estudoEstilos.blocoConclusao]}><FrasesDaLicao falas={licao.falas} /></View>
      )}
      {trilhaFeita && compartilhar && <Botao rotulo={mensagens.compartilhar.concluidaAcao} iconeAntes="compartilhar" variante="secundario" testID="conclusao-compartilhar"
        desativado={ocupado} acao={compartilhar} estilo={{ alignSelf: 'center', marginTop: 18 }} />}
    </Tela>
  );
}

/** Um cartão da história da lição; o da ponte traz as tábuas da travessia, o do ensino, o tom verde. Entram em sequência. */
function CartaoHistoria({ titulo, texto, tipo, ordem }: { titulo: string; texto: string; tipo?: 'ponte' | 'ensino'; ordem: number }) {
  const entrada = useAparecer(700 + ordem * 120, 420, true);
  return (
    <Animated.View testID={`historia-${tipo ?? 'praticou'}`}
      style={[estudoEstilos.historiaCartao, tipo === 'ponte' && estudoEstilos.historiaPonte, tipo === 'ensino' && estudoEstilos.historiaEnsino,
        estiloDeEntrada(entrada, 10)]}>
      <View style={estudoEstilos.historiaTopo}>
        <Text style={[estudoEstilos.historiaTitulo, { color: cores.texto }]}>{titulo}</Text>
      </View>
      <Text style={estudoEstilos.historiaTexto}>{texto}</Text>
    </Animated.View>
  );
}

/** Uma única reação do Stu, sem raios, confete ou ciclos que disputem com a retomada. */
function CenaConclusao({ nome, tamanho }: { nome: NomeStu; tamanho: number }) {
  return (
    <View style={estudoEstilos.cena} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Stu nome={nome} tamanho={tamanho} animado="acontecimento" acontecimento="conclusao" ciclos={1} sombra />
      <View style={estudoEstilos.seloAnel}>
        <View style={estudoEstilos.seloConclusao}>
          <Icone nome="check" tamanho={18} cor={cores.fundo} traco={3.2} />
        </View>
      </View>
    </View>
  );
}

/** Métricas reais em duas colunas neutras; o nome acessível usa os valores finais, não a contagem animada. */
function NumerosDaLicao({ resumo }: { resumo: ResumoLicao }) {
  const textos = mensagens.licao.resumo;
  const [largura, setLargura] = useState(0);
  const segundos = useContagem(resumo.segundos, 900, 650);
  const itens = [
    { chave: 'tempo', icone: 'relogio' as const, rotulo: textos.tempo, valor: formatarTempo(segundos) },
    { chave: 'acerto', icone: 'alvo' as const, rotulo: textos.acerto,
      valor: textos.acertos(resumo.acertosDePrimeira, resumo.exercicios) },
    { chave: 'etapas', icone: 'check' as const, rotulo: textos.etapas, valor: textos.etapasFeitas(resumo.etapas) },
    ...(resumo.pratica ? [{ chave: 'pratica', icone: 'relogio' as const, rotulo: textos.pratica, valor: mensagens.licao.pratica.opcoes[resumo.pratica] }] : []),
  ];
  return (
    <View style={estudoEstilos.numeros} onLayout={({ nativeEvent: { layout } }) => setLargura((atual) => atual === layout.width ? atual : layout.width)} accessible accessibilityLabel={`${textos.titulo}: ${itens.map((item) => `${item.rotulo} ${item.chave === 'tempo' ? formatarTempo(resumo.segundos) : item.valor}`).join(', ')}`}>
      {/* Com a prática, quatro números: dois por linha. */}
      {itens.map((item, indice) => <CartaoNumero key={item.chave} {...item} ordem={indice} base="46%" largura={largura > 0 ? (largura - 12) / 2 : undefined} />)}
    </View>
  );
}

function CartaoNumero({ icone, rotulo, valor, ordem, base, largura }: {
  largura?: number;
  icone: NomeIcone; rotulo: string; valor: string; ordem: number; base: `${number}%`;
}) {
  const entrada = useAparecer(600 + ordem * 120, 480, true);
  return (
    // A medida da coluna mantém o terceiro item com a mesma largura, como a grade web.
    <Animated.View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[{ flex: largura === undefined ? 1 : undefined, width: largura, minWidth: 0, flexBasis: largura === undefined ? base : undefined }, estiloDeEntrada(entrada, 8)]}>
      <View style={estudoEstilos.numero}>
      <View style={estudoEstilos.numeroRotulo}>
        {/* O ícone do rótulo tem 16 px com traço de 1,83 px (2,75 na grade de 24), o que a web calcula em 390 e 360. */}
        <Icone nome={icone} tamanho={16} cor={cores.textoSecundario} traco={2.25} />
        {/* Uma linha só (em 360, "DE PRIMEIRA" quebrava em duas e desalinhava os três cartões). */}
        <Text style={estudoEstilos.numeroRotuloTexto}>{rotulo}</Text>
      </View>
      <View style={estudoEstilos.numeroValor}>
        <Text style={estudoEstilos.numeroValorTexto}>{valor}</Text>
      </View>
      </View>
    </Animated.View>
  );
}

const estudoEstilos = StyleSheet.create({
  // "Minhas trilhas" sem trilhas: o mesmo bloco do vazio do Explorar (tracejado, céu, 22 de respiro, raio 20).
  semTrilhas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18, padding: 22, borderWidth: 2, borderStyle: 'dashed', borderColor: cores.gelo,
    borderRadius: 20, backgroundColor: cores.ceu, marginTop: 8, maxWidth: 560 },
  semTrilhasTexto: { flexGrow: 1, flexShrink: 1, flexBasis: 256, gap: 8, alignItems: 'flex-start' },
  semTrilhasTitulo: { color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  semTrilhasCorpo: { color: '#5E6A85', fontFamily: fontes.corpo, fontSize: 16, lineHeight: 24 },
  semTrilhasAcao: { alignSelf: 'stretch', marginTop: 8 },
  // Fim da rolagem como a web desde bf8cf37: 40 entre o último conteúdo e o rodapé ou a barra fixos (conclusão, minhas
  // trilhas, nova trilha).
  fimQuarenta: { paddingBottom: 40 },
  // Na geração e na proposta, o verde do mapa vai até a barra dos botões, sem a tira branca de 24.
  fimSemRespiro: { paddingBottom: 0 },
  // .conclusao-historia: cartões com borda de 2 em volta (sem degrau), 14 × 16 de respiro e 12 entre eles.
  historia: { marginTop: 20, gap: 0 },
  historiaCartao: { gap: 6, paddingVertical: 16, paddingHorizontal: 0, borderRadius: 0, borderTopWidth: 1,
    borderColor: cores.gelo, backgroundColor: cores.fundo },
  historiaPonte: { borderColor: cores.gelo, backgroundColor: cores.fundo },
  historiaEnsino: { borderColor: cores.gelo, backgroundColor: cores.fundo },
  historiaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  historiaTitulo: { flexShrink: 1, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21, letterSpacing: 0 },
  historiaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '400', fontSize: 17, lineHeight: 26 },
  historiaSincronia: { flex: 1, color: '#17684A', fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21, textAlign: 'left' },
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
  destaqueStu: { position: 'absolute', bottom: 8, left: '50%', marginLeft: -32 },
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
  // .trilha-capa: na largura do conteúdo, 4:1 até 140 de altura, cantos de 20.
  capaTrilha: { width: '100%', aspectRatio: 4, maxHeight: 140, borderRadius: 20 },
  // No celular, acima da faixa parada: 20 dos lados (--espaco-pagina), 8 em cima (com o vão de 20 do Tela, os 28 da web) e
  // 16 embaixo, até a faixa (na web, a faixa começa 16 abaixo da capa).
  capaTrilhaFaixa: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  // No tablet, o cabeçalho não fica parado: 20 da capa até ele (o vão de 16 da grade e os 4 da capa).
  capaTrilhaLarga: { marginBottom: 20 },
  // Pedido simplificado
  pedidoHeroi: { alignItems: 'stretch', gap: 12, paddingTop: 8, marginBottom: 4 },
  pedidoCabeca: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pedidoTituloLugar: { flex: 1, minWidth: 0 },
  pedidoHeroiBaixo: { gap: 8, paddingTop: 0 },
  // O cartão do material na web: o vão de 18 do painel mais os 24 de margem do cartão, em cima e embaixo (o cartão do app tem 12).
  materialNoPedido: { marginTop: 30, marginBottom: 12 },
  // Como .pedido-heroi h1 da web no celular: 30 px (clamp de 1,875rem), entrelinha 1,08.
  pedidoTitulo: { fontSize: 30, lineHeight: 36, textAlign: 'left', letterSpacing: -0.6 },
  // Janela baixa (até 700 de altura): o título numa linha só, como o esboço da banca da noite em 390×667.
  pedidoTituloBaixo: { fontSize: 24, lineHeight: 30 },
  // Spec 16, item 35: o subtítulo do material em 15/22.
  pedidoFalaMaterial: { minHeight: 22, fontSize: 15, lineHeight: 22 },
  // A pílula "Ver mais abaixo" do material, como a da aula (.aula-mais-abaixo).
  maisAbaixo: { alignSelf: 'center', minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 999, borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo, boxShadow: `0 2px 0 ${cores.gelo}` },
  maisAbaixoTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
  pedidoFala: { minHeight: 24, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '600', fontSize: 16, lineHeight: 24, textAlign: 'left' },
  // .pedido-alternar (regra final de pedido.css): borda lisa de 2 em #C3CDF2, raio 22, degradê e degrau de 3 por fora.
  // O cartão compacto (banca da noite §3): 64 de altura, o ícone num quadro de 40, o título 16/24 e a dica 14/20.
  alternarFora: { marginTop: 16 },
  alternar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8, paddingLeft: 12, paddingRight: 16,
    borderRadius: 18, borderWidth: 1, borderColor: cores.gelo, backgroundColor: cores.fundo },
  alternarDica: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  alternarIcone: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.superficieSutil },
  alternarTextos: { flex: 1 },
  alternarTitulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  // Topo da trilha e anel de progresso
  topoTrilha: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12, paddingTop: 4 },
  topoTrilhaTexto: { flex: 1, minWidth: 0 },
  topoTrilhaRotulo: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 12, lineHeight: 16, letterSpacing: 1 },
  tituloTopo: { fontSize: 26, lineHeight: 30 },
  // Com a sombra de 4 embaixo da web (0 4px 0 rgb(27 42 94 / 0.08)).
  anel: { alignItems: 'center', justifyContent: 'center', borderColor: cores.gelo, backgroundColor: cores.fundo, boxShadow: '0 4px 0 rgba(11, 27, 92, 0.08)' },
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
  blocoProgresso: { marginTop: 0, padding: 18, gap: 0, borderWidth: 0, borderRadius: 20, backgroundColor: '#F4F7FF', boxShadow: 'none' },
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
  // Geração que se acompanha (spec 04): a faixa de 52 presa embaixo da barra da marca, a placa do Stu por cima do mapa, o
  // cartão do título que volta no alto e a pílula "Ver a lição nova".
  // .previa-cabecalho da web: o voltar de 44 e o nome, com 8 em cima e embaixo (52 com uma linha), linha gelo embaixo.
  faixaGeracao: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.96)', borderBottomWidth: 1, borderBottomColor: cores.gelo },
  faixaGeracaoLarga: { paddingVertical: 10 },
  geracaoVoltar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.superficieSutil, flexShrink: 0 },
  faixaGeracaoNome: { flex: 1, minWidth: 0, color: cores.texto, fontFamily: fontes.titulo, fontWeight: '700', fontSize: 24, lineHeight: 30 },
  faixaGeracaoNomeLongo: { fontSize: 24, lineHeight: 30 },
  placaGeracaoLugar: { position: 'absolute', top: 68, left: 20, right: 20 },
  passagem: { zIndex: 50, elevation: 50, overflow: 'hidden' },
  placaNoMapa: { height: 0, zIndex: 3 },
  placaNoMapaLugar: { position: 'absolute', top: 16, left: 20, right: 20 },
  placaGeracao: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: cores.gelo, borderRadius: 18, backgroundColor: cores.fundo },
  placaGeracaoTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  geracaoConteudo: { paddingTop: 0, paddingBottom: 0 },
  cartaoDeVolta: { marginTop: 20 },
  pilulaSeguir: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: cores.acao,
    boxShadow: `0 4px 0 ${cores.acaoEscura}, 0 10px 20px rgba(15, 23, 42, 0.18)` },
  pilulaSeguirApertada: { transform: [{ translateY: 2 }] },
  pilulaSeguirTexto: { color: cores.fundo, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 15, lineHeight: 20 },
  faixaLarga: { padding: 24 },
  // Como o título da proposta na web (clamp(1,5rem, 4vw, 2rem) = 24 px no celular, entrelinha 1,12).
  tituloFaixa: { fontSize: 30, lineHeight: 36 },
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
    borderColor: cores.gelo, backgroundColor: cores.fundo, shadowColor: cores.texto, shadowOpacity: 0.16, shadowRadius: 18,
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
  acoesTopo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  // .trilha-compartilhar: 10 abaixo do nome da trilha. Com o botão, na fileira inteira, para a engrenagem alinhar pelo centro
  // com ele; só com a engrenagem (trilha recebida), ela fica logo abaixo da linha de cima, como na web.
  acoesTopoComCompartilhar: { marginTop: 10 },
  vazio: { gap: 16, marginTop: 24 },
  liberada: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 0 },
  liberadaTexto: { flex: 1, color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 17, lineHeight: 26 },
  // Lição concluída
  conclusaoTopo: { alignItems: 'center', gap: 8 },
  conclusaoNucleo: { gap: 16, marginTop: 24 },
  conclusaoSincronia: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  conclusaoAprendizado: { gap: 6, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F4' },
  aprendizadoRotulo: { color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21 },
  repetida: { gap: 10, marginTop: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFF6D9' },
  repetidaTexto: { color: '#7A4A00', fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  // O "•••" no canto de cima da arte (spec 11): 44 × 44, raio 12, branco com sombra leve; o balão é o menu de ações da interface.
  menu: { position: 'absolute', top: 10, right: 10, zIndex: 2, alignItems: 'flex-end' },
  menuDestaque: { top: 24, right: 24 },
  menuBotao: { backgroundColor: cores.fundo, boxShadow: '0 2px 6px rgba(15, 23, 42, 0.15)' },
  rever: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 0, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#FFF6E8' },
  reverIcone: { marginTop: 1 },
  resumoTrilha: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, marginTop: 14, paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 999, backgroundColor: cores.superficieSutil },
  resumoTrilhaTexto: { flexShrink: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  legendaNumeros: { marginTop: 24, marginBottom: -12, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21, textAlign: 'left' },
  reverTexto: { flexShrink: 1, color: cores.alerta, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24, textAlign: 'left' },
  textoCentro: { textAlign: 'center' },
  conclusaoTitulo: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  cena: { width: 110, height: 110, alignItems: 'center', justifyContent: 'flex-end', marginBottom: 0 },
  // O anel branco de 4 (box-shadow 0 0 0 4px) fica por fora do círculo de 50 (right 6 e bottom 30 na web).
  seloAnel: { position: 'absolute', right: -5, bottom: 5, padding: 3, borderRadius: 18, backgroundColor: cores.fundo },
  seloConclusao: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17684A' },
  // .conclusao-texto: 17 px em 800 (entrelinha 1,5) e .conclusao-licao: 16 px em 700 (entrelinha 1,5).
  // O resumo da conclusão usa 17/26, sem disputar com o título de 30/36.
  tituloProgresso: { fontSize: 17, lineHeight: 26, letterSpacing: 0 },
  comemoracao: { marginTop: 24, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '600', fontSize: 16, lineHeight: 24 },
  conclusaoLicao: { marginTop: 0, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 17, lineHeight: 26 },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  numero: { overflow: 'hidden', borderRadius: 16, borderWidth: 0, backgroundColor: cores.superficieSutil, padding: 14, flex: 1 },
  // Auxiliares de 14/21 podem quebrar em vez de serem cortados em células estreitas.
  numeroRotulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 6, paddingHorizontal: 0, paddingVertical: 0 },
  numeroRotuloTexto: { flexShrink: 1, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21, letterSpacing: 0 },
  numeroValor: { alignItems: 'flex-start', marginTop: 7, padding: 0 },
  // O valor 17/26 mantém o mesmo ritmo da leitura.
  numeroValorTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 17, lineHeight: 26, textAlign: 'left' },
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
  luzCampo: { position: 'absolute', left: -2, right: -2, top: -2, bottom: -2, borderRadius: 20, borderWidth: 2, borderColor: cores.acao },
  // Como .pedido-como da web: 44 px, centralizado, 800.
  // .pedido-como (bf8cf37): 26 do bloco de cima até a caixa de 44 do botão (34 depois das fichas, que têm 8 embaixo) e, no fim
  // da rolagem, 40 até a barra de baixo.
  como: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', minHeight: 44, marginTop: 16, paddingHorizontal: 10, borderRadius: 12 },
  comoPressionado: { backgroundColor: cores.nevoa },
  comoSinal: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E5EBFF' },
  comoSinalTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 13, lineHeight: 16 },
  comoTexto: { color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 24 },
  aviso: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: cores.nevoa,
    color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 16, lineHeight: 24 },
  // A confirmação na lista segue .trilha-aviso da web. O aviso de cancelamento continua usando o estilo neutro.
  avisoTrilhaSalva: { marginTop: 0, borderRadius: 14, backgroundColor: '#E3F6EA', color: '#14513B', fontWeight: '800' },
  campoPedido: { marginTop: 20, marginBottom: 16, gap: 8 },
  campoSemRelevo: { borderRadius: 18 },
  entradaPedido: { minHeight: 112, paddingVertical: 18, paddingHorizontal: 16, borderWidth: 1.5, borderRadius: 18,
    borderColor: '#7B8AAF', backgroundColor: cores.fundo, fontSize: 17, lineHeight: 26, fontWeight: '600' },
  entradaPedidoBaixa: { minHeight: 88, paddingVertical: 14 },
  entradaPedidoFocada: { borderColor: cores.acao, outlineWidth: 0 },
  entradaPedidoVazia: { fontWeight: '600' },
  // A face do "Montar minha trilha" tem 56 na web (o degrau de 4 vem por fora).
  criar: { minHeight: 52 },
  acaoPiloto: { minHeight: 52 },
  campoErro: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  campoErroTexto: { flex: 1, color: cores.erro, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  dica: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  contador: { alignSelf: 'flex-end' },
  // Como .pedido-ideias e .pedido-ideia da web: fichas de 46 px com lábio de 3, que quebram linha, centralizadas.
  // A fileira de ideias (banca da noite §3): de borda a borda (a página tem 20 nos lados), fichas de 44 com o degrau de 3 por
  // fora e vão de 10; embaixo, o respiro do degrau.
  ideiasRolagem: { marginTop: 14, marginHorizontal: -20 },
  ideias: { gap: 10, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 6 },
  surpresa: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 6, paddingLeft: 10, paddingRight: 16, borderRadius: 999,
    borderWidth: 1, borderColor: cores.gelo, backgroundColor: cores.fundo },
  surpresaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21 },
  areasRolagem: { marginHorizontal: -20 },
  areas: { gap: 8, paddingHorizontal: 20, paddingVertical: 2 },
  area: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 10, paddingRight: 14, borderRadius: 999,
    borderWidth: 2, borderColor: cores.gelo, backgroundColor: cores.fundo },
  areaEscolhida: { borderColor: cores.acao, backgroundColor: '#F0F4FF' },
  areaTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 6, paddingLeft: 10, paddingRight: 16,
    borderWidth: 1, borderColor: cores.gelo, borderRadius: 999, backgroundColor: cores.fundo },
  chipEscolhida: { borderColor: cores.acao, backgroundColor: '#F3F6FF' },
  chipDesativada: { backgroundColor: cores.nevoa },
  chipTexto: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 21 },
  // Geração ao vivo
  contexto: { marginBottom: 8, color: cores.acao, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 14, lineHeight: 21,
    letterSpacing: 0.5, textTransform: 'uppercase' },
  esqueletoTitulo: { width: '72%', maxWidth: 384, height: 28, marginVertical: 2, borderRadius: 8, backgroundColor: cores.gelo },
  geracaoIa: { marginTop: 16, color: cores.textoSecundario, fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20 },
  esqueletoOrigem: { width: '48%', maxWidth: 256, height: 12, marginTop: 10, borderRadius: 8, backgroundColor: cores.gelo },
  geracaoRodape: { gap: 8 },
  // Na proposta pronta, a pílula e o aviso dividem o espaço do rodapé sem cobrir a prévia.
  estadoDaProposta: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, rowGap: 8 },
  notaDaProposta: { flexBasis: 116, flexGrow: 1, flexShrink: 1 },
  geracaoAcoes: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  geracaoAcoesEmpilhadas: { gap: 10 },
  geracaoRodapeEstreito: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
  geracaoLugarSecundario: { minHeight: 44, justifyContent: 'center' },
  geracaoEsperaEmpilhada: { justifyContent: 'center' },
  geracaoBotaoSecundario: { minHeight: 44 },
  // Criar a trilha (spec 04): a linha da espera real (14/20 #5E6A85) e a do erro (#C23B4E), centradas embaixo do botão.
  criacaoEspera: { color: '#5E6A85', fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  criacaoErro: { color: '#C23B4E', fontFamily: fontes.corpo, fontWeight: '700', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  metade: { flex: 1, minWidth: 0 },
  situacao: { flex: 1, minWidth: 0 },
  // .geracao-situacao__rotulo: 800 na entrelinha de 1,3.
  situacaoRotulo: { color: cores.texto, fontFamily: fontes.corpo, fontWeight: '800', fontSize: 16, lineHeight: 20.8 },
  botaoDividido: { paddingHorizontal: 12 },
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
});

/**
 * "Minhas trilhas" sem trilhas (spec 05, d8df51c): o bloco vazio igual ao do Explorar, com o stu-curioso de 96 e halo,
 * "Nenhuma trilha ainda", o texto e "Criar minha primeira trilha" (abre a Nova trilha com o foco no campo e o que já foi
 * escrito). Entra subindo 8 px em 200 ms; cada `pulo` novo faz o Stu subir 8 px e voltar em 300 ms. Com movimento
 * reduzido, nada se mexe. O título fica com o foco (a Tela); a região educada anuncia "Nenhuma trilha ainda.".
 */
function VazioDasTrilhas({ pulo, criar }: { pulo: number; criar: () => void }) {
  const t = mensagens.planos;
  const reduzir = useMovimentoReduzido();
  const entrada = useAparecer(0, 200);
  const [salto] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const espera = setTimeout(() => AccessibilityInfo.announceForAccessibility(`${t.vazioTitulo}.`), 400);
    return () => clearTimeout(espera);
  }, [t.vazioTitulo]);
  useEffect(() => {
    if (!pulo || reduzir !== false) return;
    salto.setValue(0);
    const animacao = Animated.sequence([
      Animated.timing(salto, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(salto, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    animacao.start();
    return () => animacao.stop();
  }, [pulo, reduzir, salto]);
  return (
    <Animated.View testID="planos-vazio" style={[estudoEstilos.semTrilhas, estiloDeEntrada(entrada, 8, 1)]}>
      <Animated.View testID="planos-vazio-stu" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
        style={{ transform: [{ translateY: salto.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
        <Stu nome="stu-curioso" tamanho={96} halo animado="uma-vez" />
      </Animated.View>
      <View style={estudoEstilos.semTrilhasTexto}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={estudoEstilos.semTrilhasTitulo}>{t.vazioTitulo}</Text>
        <Text style={estudoEstilos.semTrilhasCorpo}>{t.vazioTexto}</Text>
        <Botao rotulo={t.vazioAcao} testID="planos-vazio-criar" acao={criar} estilo={estudoEstilos.semTrilhasAcao} />
      </View>
    </Animated.View>
  );
}
