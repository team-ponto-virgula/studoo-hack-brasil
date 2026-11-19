'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ErroStudoo,
  origemDemonstracao,
  origemLegivel,
  trilhaRepetida,
  type AutoAvaliacao,
  type LicaoDetalhe,
  type LinkCompartilhado,
  type Perfil,
  type PlanoDetalhe,
  type PlanoResumo,
  type Progresso,
  type PropostaPlano,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { invalidarElegibilidadeVozAoVivo } from './estudio';
import { mensagens, textoParaRever } from '../mensagens/pt-BR';
import {
  AcaoPrincipal,
  Botao,
  Caminho,
  Confete,
  Desenho,
  EstadoErro,
  EstadoVazio,
  Icone,
  Logo,
  Mascote,
  Skeleton,
  SkeletonTrilha,
  Stu,
  coresDaRegiao,
  regiaoDoTrecho,
  type NoCaminho,
} from '../ui';
import { Apresentacao, marcarApresentacaoVista } from './apresentacao';
import { aplicarEvento, gerarTrilhaAoVivo, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { RITMO_DA_GERACAO, atrasosDaLicao, comMaisUma, deixouDeAcompanhar, intervaloDaFila, rolagemDaVaga, vagaAVista } from './geracao-ritmo';
import { FrasesDaLicao, Licao, formatarTempo, temAndamento, temAndamentoNoPlano, type ResumoLicao } from './aula';
import { Pedido, type IdTema } from './pedido';
import { AdicionarPorLink, Avatar, DialogoConfirmar, FolhaCompartilhar, caminhoDepoisDoLogin, planoParaAbrir } from './compartilhar';
import { TelaPerfil } from './perfil';
import { CapaDaTrilha, TelaConfiguracoes } from './configuracoes';
import { CurtirTrilhaRecebida, Explorar } from './comunidade';
import { contarLicaoParaNovidadeDoSom, useAreaDoSom } from './som';
import { tocaSons } from './sons';
import './aula.css';
import './trilha.css';

type Tela =
  | { tipo: 'apresentacao'; primeiraVez: boolean }
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'geracao' }
  /** `concluida`: a lição que a pessoa acabou de concluir, para o caminho comemorar no nó dela. */
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[]; concluida?: string; aviso?: string }
  | { tipo: 'perfil' }
  | { tipo: 'explorar' }
  /** Configurações da trilha (lote 4): `volta` é de onde a pessoa veio (o mapa ou Minhas trilhas). */
  | { tipo: 'configuracoes'; planoId: string; volta: 'planos' | 'plano' }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; antes: Progresso; licao: LicaoDetalhe; liberadas: string[]; resumo?: ResumoLicao };

type TelaPlano = Extract<Tela, { tipo: 'plano' }>;
type Acao = 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair' | 'apagar';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string };
type Sincronia = { estado: 'atualizando' | 'atualizado' | 'offline'; em: number | null };

function textoSincronia(s: Sincronia, agora: number, temProgresso: boolean) {
  if (s.estado === 'atualizando') return mensagens.sincronia.atualizando;
  if (s.estado === 'offline') return temProgresso ? mensagens.sincronia.offline : mensagens.sincronia.offlineCurto;
  if (!s.em) return mensagens.sincronia.salvo;
  const min = Math.floor((agora - s.em) / 60_000);
  if (min < 1) return mensagens.sincronia.agora;
  return mensagens.sincronia.minutos(min);
}

function SeloSincronia({ sincronia, agora, temProgresso }: { sincronia: Sincronia; agora: number; temProgresso: boolean }) {
  return (
    <span className="selo-sincronia" data-estado={sincronia.estado} role="status" aria-live="polite">
      <span className="selo-sincronia__ponto" aria-hidden="true" />
      <span>{textoSincronia(sincronia, agora, temProgresso)}</span>
    </span>
  );
}

/** Quanto "Escrevendo suas lições" fica na tela, no mínimo: com a IA falsa, o aceite volta rápido e o título piscaria. */
const ESCRITA_MINIMA_MS = 1200;
/** Quanto "Lições prontas!" fica na tela, no mínimo, para o visto passar por todas as lições. */
const PAUSA_LICOES_PRONTAS_MS = 900;
const pausa = (ms: number) => new Promise<void>((resolver) => window.setTimeout(resolver, ms));

/**
 * Volta ao topo da página. Repete no quadro seguinte porque uma rolagem suave ainda em curso (o caminho mostrando a
 * chegada quando a trilha fica pronta) dá mais um passo depois da primeira volta e deixaria a tela nova rolada.
 */
function voltarAoTopo() {
  window.scrollTo(0, 0);
  window.requestAnimationFrame(() => window.scrollTo(0, 0));
}

export function Estudo() {
  const [inicio, setInicio] = useState<'carregando' | 'pronto' | 'falha'>('carregando');
  // O som de fundo toca no app inteiro depois da entrada (spec 12); ao sair do app (ou da conta), para.
  useAreaDoSom(inicio === 'pronto');
  const [erro, setErro] = useState<string | null>(null);
  const [tela, setTela] = useState<Tela>({ tipo: 'planos' });
  const [planos, setPlanos] = useState<PlanoResumo[]>([]);
  const [tinhaTrilhas, setTinhaTrilhas] = useState(false);
  const [objetivo, setObjetivo] = useState('');
  /** Área escolhida no fim da apresentação: o pedido abre com as ideias dela. */
  const [areaInicial, setAreaInicial] = useState<IdTema | undefined>();
  const [pendente, setPendente] = useState<Acao | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [geracao, setGeracao] = useState<TrilhaEmGeracao | null>(null);
  const [falhaGeracao, setFalhaGeracao] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const [sincronia, setSincronia] = useState<Sincronia>({ estado: 'atualizando', em: null });
  const [agora, setAgora] = useState(() => Date.now());
  const [confirmacao, setConfirmacao] = useState<{
    mensagem: string;
    /** Com título: a confirmação do Studoo com título, texto e aviso separados (apagar trilha). */
    titulo?: string;
    aviso?: string | null;
    confirmarRotulo: string;
    destrutivo?: boolean;
    aoConfirmar: () => Promise<void>;
  } | null>(null);
  const origemConfirmacao = useRef<HTMLElement | null>(null);
  const emExecucao = useRef(false);
  const ultimaBusca = useRef(0);
  const geracaoAtiva = useRef<AbortController | null>(null);
  const cacheLicoes = useRef<Map<string, Promise<LicaoDetalhe>>>(new Map());
  const principal = useRef<HTMLElement>(null);
  const objetivoRef = useRef(objetivo);
  objetivoRef.current = objetivo;
  const abriuComRascunho = useRef(false);
  /** Perfis e compartilhar (spec 09): só com `compartilhar` no /api/auth/config. */
  const [compartilhar, setCompartilhar] = useState(false);
  /** Comunidade (spec 10, etapa B): Explorar, publicar, Valeu e Denunciar; só com `comunidade` no config. */
  const [comunidade, setComunidade] = useState(false);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [folha, setFolha] = useState<string | null>(null);
  // Muda quando a folha de compartilhar fecha: a tela de configurações relê "Quem pode ver".
  const [versaoFolha, setVersaoFolha] = useState(0);
  const guardaSaida = useRef<((continuar: () => void) => boolean) | null>(null);
  const registrarGuarda = useCallback((guarda: ((continuar: () => void) => boolean) | null) => { guardaSaida.current = guarda; }, []);

  useEffect(() => {
    try {
      setTinhaTrilhas(localStorage.getItem('studoo.tinhaTrilhas') === '1');
      const salvo = sessionStorage.getItem('studoo.rascunho.objetivo');
      if (salvo) {
        abriuComRascunho.current = true;
        setObjetivo(salvo);
        sessionStorage.removeItem('studoo.rascunho.objetivo');
      }
    } catch { /* Sem armazenamento local: segue sem rascunho. */ }
  }, []);

  useEffect(() => {
    if (inicio !== 'pronto') return;
    const tem = planos.length > 0;
    setTinhaTrilhas(tem);
    try {
      localStorage.setItem('studoo.tinhaTrilhas', tem ? '1' : '0');
    } catch { /* Sem armazenamento local. */ }
  }, [inicio, planos.length]);

  const irParaLogin = useCallback((expirada = false) => {
    invalidarElegibilidadeVozAoVivo();
    setInicio('carregando');
    setTinhaTrilhas(false);
    try { localStorage.removeItem('studoo.tinhaTrilhas'); } catch {}
    if (expirada) {
      try {
        if (objetivoRef.current.trim()) sessionStorage.setItem('studoo.rascunho.objetivo', objetivoRef.current);
      } catch { /* Sem armazenamento local: segue sem rascunho. */ }
    }
    window.location.replace(expirada ? '/login?erro=nao_autenticado' : '/login');
  }, []);

  const carregar = useCallback(async (cancelado: () => boolean) => {
    invalidarElegibilidadeVozAoVivo();
    setSincronia((anterior) => ({ estado: 'atualizando', em: anterior.em }));
    try {
      await cliente.sessao();
      // Voltou do login para concluir um link de trilha (adicionar): segue para a página dele.
      const depois = caminhoDepoisDoLogin();
      if (depois) {
        window.location.replace(depois);
        return;
      }
      const [ativos, config] = await Promise.all([cliente.listarPlanos(), cliente.configuracaoAcesso().catch(() => null)]);
      if (cancelado()) return;
      setPlanos(ativos);
      const comCompartilhar = Boolean(config?.compartilhar);
      setCompartilhar(comCompartilhar);
      setComunidade(comCompartilhar && Boolean(config?.comunidade));
      if (comCompartilhar) void cliente.obterPerfil().then((dados) => { if (!cancelado()) setPerfil(dados); }).catch(() => undefined);
      const momento = Date.now();
      ultimaBusca.current = momento;
      setAgora(momento);
      setSincronia({ estado: 'atualizado', em: momento });
      // Recarregou no meio de uma aula (o histórico guarda a marca da lição aberta): reabre a lição, e o andamento salvo
      // a retoma na etapa em que estava, em vez de voltar ao mapa e perder a etapa.
      const marcada = (window.history.state as { studooLicao?: string } | null)?.studooLicao;
      if (marcada) {
        try {
          const licao = await cliente.obterLicao(marcada);
          const plano = await cliente.obterPlano(licao.planoId);
          if (cancelado()) return;
          setTela({ tipo: 'licao', plano, licao });
          setInicio('pronto');
          return;
        } catch {
          // A lição não existe mais (trilha apagada): segue para a trilha em andamento.
        }
      }
      // Chegou da página de um link (adicionou ou já tinha a trilha): abre essa trilha, com o aviso.
      const pedido = planoParaAbrir();
      if (pedido) {
        try {
          const plano = await cliente.obterPlano(pedido.id);
          if (cancelado()) return;
          setTela({ tipo: 'plano', plano, ...(pedido.aviso ? { aviso: pedido.aviso } : {}) });
          if (pedido.aviso) setAnuncio(pedido.aviso);
          setInicio('pronto');
          return;
        } catch {
          // A trilha não existe mais: segue o caminho de sempre.
        }
      }
      // Com planos salvos, abre direto na trilha em andamento, exceto se voltou com um rascunho de pedido salvo.
      if (abriuComRascunho.current) {
        setTela({ tipo: 'objetivo' });
      } else {
        const inicial = planoInicial(ativos);
        if (inicial) {
          try {
            const plano = await cliente.obterPlano(inicial.id);
            if (cancelado()) return;
            setTela({ tipo: 'plano', plano });
          } catch {
            // Sem o detalhe do plano, a pessoa cai em Meus planos e escolhe de lá.
          }
        }
      }
      setInicio('pronto');
    } catch (falha) {
      if (cancelado()) return;
      const codigo = falha instanceof ErroStudoo ? falha.codigo : 'rede';
      if (codigo === 'nao_autenticado') {
        irParaLogin(true);
        return;
      }
      setErro(codigo);
      setSincronia((anterior) => ({ estado: 'offline', em: anterior.em }));
      setInicio('falha');
    }
  }, [irParaLogin]);

  const sincronizarAgora = useCallback(async () => {
    if (emExecucao.current || inicio !== 'pronto') return;
    if (tela.tipo !== 'planos' && tela.tipo !== 'plano') return;
    if (Date.now() - ultimaBusca.current < 5_000) return;
    setSincronia((anterior) => ({ estado: 'atualizando', em: anterior.em }));
    try {
      const ativos = await cliente.listarPlanos();
      setPlanos(ativos);
      if (tela.tipo === 'plano') {
        const atualizado = await cliente.obterPlano(tela.plano.id);
        setTela((atual) => (atual.tipo === 'plano' && atual.plano.id === atualizado.id ? { ...atual, plano: atualizado } : atual));
      }
      const momento = Date.now();
      ultimaBusca.current = momento;
      setAgora(momento);
      setSincronia({ estado: 'atualizado', em: momento });
    } catch {
      setSincronia((anterior) => ({ estado: 'offline', em: anterior.em }));
    }
  }, [inicio, tela]);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const aoFocar = () => {
      if (document.visibilityState === 'visible') void sincronizarAgora();
    };
    window.addEventListener('focus', aoFocar);
    document.addEventListener('visibilitychange', aoFocar);
    return () => {
      window.removeEventListener('focus', aoFocar);
      document.removeEventListener('visibilitychange', aoFocar);
    };
  }, [sincronizarAgora]);

  useEffect(() => {
    let cancelado = false;
    void carregar(() => cancelado);

    function aoExibir(evento: PageTransitionEvent) {
      if (!evento.persisted) return;
      geracaoAtiva.current?.abort();
      geracaoAtiva.current = null;
      setGeracao(null);
      setFalhaGeracao(null);
      setAviso(null);
      setInicio('carregando');
      setTela({ tipo: 'planos' });
      setObjetivo('');
      setPlanos([]);
      setErro(null);
      void carregar(() => cancelado);
    }

    window.addEventListener('pageshow', aoExibir);
    return () => {
      cancelado = true;
      window.removeEventListener('pageshow', aoExibir);
    };
  }, [carregar]);

  useEffect(() => {
    const vaiFocarCampo = tela.tipo === 'objetivo' && (window.innerWidth >= 1024 || Boolean(objetivoRef.current.trim()));
    if (inicio === 'pronto' && !vaiFocarCampo && document.activeElement?.id !== 'objetivo') {
      principal.current?.querySelector('h1')?.focus();
    }
  }, [inicio, tela]);

  useEffect(() => {
    if (erro || falhaGeracao) principal.current?.querySelector('.estado-erro')?.scrollIntoView({ block: 'nearest' });
  }, [erro, falhaGeracao]);

  // Sair do Studoo no meio da geração interrompe o pedido; o servidor não guarda nada.
  useEffect(() => () => geracaoAtiva.current?.abort(), []);

  /** Texto para o leitor de tela; repetir o mesmo texto ainda é anunciado. */
  function anunciar(texto: string) {
    setAnuncio((anterior) => anterior === texto ? `${texto}\u00a0` : texto);
  }

  function pararGeracao() {
    geracaoAtiva.current?.abort();
    geracaoAtiva.current = null;
    setGeracao(null);
  }

  /**
   * Troca de tela. Sair da geração ao vivo cancela o pedido em andamento. Uma tela nova começa do topo (no celular,
   * cancelar no fim da trilha não deixa o pedido rolado); o caminho ainda rola até a lição certa depois de desenhar.
   */
  function navegar(destino: Tela) {
    // Saindo do Perfil com os dados abertos e alteração não salva: a confirmação do app pergunta antes.
    if (guardaSaida.current?.(() => { guardaSaida.current = null; navegar(destino); })) return;
    if (destino.tipo !== 'geracao') pararGeracao();
    if (destino.tipo !== tela.tipo) voltarAoTopo();
    setErro(null);
    setFalhaGeracao(null);
    setAviso(null);
    setAnuncio('');
    setTela(destino);
  }

  async function executar<T>(acao: Acao, operacao: () => Promise<T>): Promise<Resultado<T>> {
    if (emExecucao.current) return { ok: false, codigo: 'falha' };
    emExecucao.current = true;
    setPendente(acao);
    setErro(null);

    try {
      return { ok: true, dados: await operacao() };
    } catch (falha) {
      const codigo = falha instanceof ErroStudoo ? falha.codigo : 'rede';
      if (codigo === 'nao_autenticado') irParaLogin(true);
      else setErro(codigo);
      return { ok: false, codigo };
    } finally {
      setPendente(null);
      emExecucao.current = false;
    }
  }

  /** Apaga uma trilha depois da confirmação; o cartão sai da lista (sem trilhas, a tela volta ao pedido). */
  function apagarPlano(plano: PlanoResumo, depois?: () => void) {
    origemConfirmacao.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmacao({
      titulo: mensagens.planos.apagarTitulo(plano.titulo),
      mensagem: mensagens.planos.apagarTexto(plano.progresso.total, plano.progresso.concluidas),
      aviso: plano.link ? mensagens.compartilhar.apagarAviso : null,
      confirmarRotulo: mensagens.planos.apagar,
      destrutivo: true,
      aoConfirmar: async () => {
        const resultado = await executar('apagar', () => cliente.apagarPlano(plano.id));
        if (!resultado.ok) return;
        void tocaSons.tocarEfeito('apagar');
        setPlanos((anteriores) => anteriores.filter((item) => item.id !== plano.id));
        anunciar(mensagens.planos.apagada(plano.titulo));
        depois?.();
      },
    });
  }

  function atualizarPlano(plano: PlanoDetalhe) {
    setPlanos((anteriores) => {
      const resumo: PlanoResumo = {
        id: plano.id, titulo: plano.titulo, progresso: plano.progresso,
        ...(plano.capa ? { capa: plano.capa } : {}), ...(plano.tema ? { tema: plano.tema } : {}),
        ...(plano.link ? { link: plano.link } : {}), ...(plano.recebida ? { recebida: plano.recebida } : {}),
      };
      return anteriores.some((item) => item.id === plano.id)
        ? anteriores.map((item) => item.id === plano.id ? resumo : item)
        : [resumo, ...anteriores];
    });
  }

  /**
   * Geração ao vivo: a tela troca para a trilha vazia e cada evento do fluxo entra no caminho assim que chega.
   * Um erro, antes ou durante a geração, volta ao pedido com o texto mantido e a mensagem do código.
   */
  async function gerar(texto: string) {
    if (emExecucao.current) return;
    geracaoAtiva.current?.abort();
    const controle = new AbortController();
    geracaoAtiva.current = controle;
    let trilha: TrilhaEmGeracao = { objetivo: texto, titulo: null, fluxos: [], proposta: null };
    navegar({ tipo: 'geracao' });
    setGeracao(trilha);

    try {
      for await (const evento of gerarTrilhaAoVivo(texto, controle.signal)) {
        if (controle.signal.aborted) return;
        if (evento.tipo === 'erro') throw new ErroStudoo(evento.codigo);
        trilha = aplicarEvento(trilha, evento);
        setGeracao(trilha);
        if (evento.tipo === 'plano') anunciar(mensagens.geracao.anuncioTitulo(evento.titulo));
        // Os sons e os anúncios de cada lição e do fim vêm da tela, no ritmo em que as lições aparecem (não da rede).
        if (evento.tipo === 'pronto') return;
      }
      throw new ErroStudoo('falha');
    } catch (falha) {
      if (controle.signal.aborted) return;
      const codigo = falha instanceof ErroStudoo ? falha.codigo : 'rede';
      if (codigo === 'nao_autenticado') {
        irParaLogin(true);
        return;
      }
      navegar({ tipo: 'objetivo' });
      setFalhaGeracao(codigo);
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
    if (!aceite.ok) {
      // Volta à trilha gerada (nova tela, mesmo estado): o foco vai ao título e o erro fica no topo.
      if (aceite.codigo !== 'nao_autenticado') setTela({ tipo: 'geracao' });
      return;
    }
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
    setErro(licao.codigo);
  }

  async function abrirPlano(id: string, origem?: string, aviso?: string) {
    if (emExecucao.current) return;
    if (tela.tipo === 'geracao') navegar({ tipo: 'planos' });
    const resultado = await executar('plano', () => cliente.obterPlano(id));
    if (resultado.ok) {
      atualizarPlano(resultado.dados);
      navegar({ tipo: 'plano', plano: resultado.dados, origem, ...(aviso ? { aviso } : {}) });
      if (aviso) anunciar(aviso);
    }
  }

  /** O link de uma trilha mudou (criado, alterado ou encerrado): a lista e o mapa mostram o selo certo. */
  function mudarLink(planoId: string, link: LinkCompartilhado | null) {
    const marca = link ? { codigo: link.codigo, noPerfil: link.noPerfil } : undefined;
    setPlanos((anteriores) => anteriores.map((item) => (item.id === planoId ? { ...item, link: marca } : item)));
    setTela((atual) => ('plano' in atual && atual.plano.id === planoId ? { ...atual, plano: { ...atual.plano, link: marca } } : atual));
  }

  /** Trilha adicionada pelo link (ou já tinha): abre o mapa dela, com o aviso de quem compartilhou. */
  async function aoAdicionarPorLink(planoId: string, nomeDono: string, jaTinha: boolean) {
    try {
      setPlanos(await cliente.listarPlanos());
    } catch { /* A lista se atualiza na próxima sincronia. */ }
    void abrirPlano(planoId, undefined, jaTinha ? undefined : mensagens.compartilhar.adicionada(nomeDono));
  }

  function obterLicaoComCache(id: string) {
    const existente = cacheLicoes.current.get(id);
    if (existente) return existente;
    const promessa = cliente.obterLicao(id).catch((erro) => {
      cacheLicoes.current.delete(id);
      throw erro;
    });
    cacheLicoes.current.set(id, promessa);
    return promessa;
  }

  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    if (emExecucao.current) return;
    setAbrindo(id);
    const resultado = await executar('abrir', () => obterLicaoComCache(id));
    setAbrindo(null);
    if (resultado.ok) navegar({ tipo: 'licao', plano, licao: resultado.dados });
  }

  async function concluir(plano: PlanoDetalhe, licao: LicaoDetalhe, comprovante: string, resumo?: ResumoLicao, pratica?: AutoAvaliacao) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante, pratica,
      resumo && { segundos: resumo.segundos, acertosDePrimeira: resumo.acertosDePrimeira, exercicios: resumo.exercicios }));
    if (resultado.ok) {
      cacheLicoes.current.delete(licao.id);
      const atualizado = resultado.dados.plano;
      // A última lição fecha a trilha: o som é o da trilha inteira (só na primeira vez que ela fecha).
      contarLicaoParaNovidadeDoSom();
      const fechada = (p: PlanoDetalhe['progresso']) => p.total > 0 && p.concluidas === p.total;
      void tocaSons.tocarEfeito(fechada(atualizado.progresso) && !fechada(plano.progresso) ? 'concluir_trilha' : 'concluir_licao');
      atualizarPlano(atualizado);
      const momento = Date.now();
      ultimaBusca.current = momento;
      setAgora(momento);
      setSincronia({ estado: 'atualizado', em: momento });
      navegar({ tipo: 'concluida', plano: atualizado, antes: plano.progresso, licao, liberadas: liberadasEntre(plano, atualizado), resumo });
      return true;
    }
    return false;
  }

  function sair() {
    // Sair fica no alto, onde muita gente procura "voltar": pergunta antes de encerrar a sessão.
    origemConfirmacao.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmacao({
      mensagem: mensagens.sairPergunta,
      confirmarRotulo: mensagens.sair,
      aoConfirmar: async () => {
        const resultado = await executar('sair', () => cliente.logout());
        if (resultado.ok) irParaLogin();
      },
    });
  }

  /** Fim da apresentação (concluída ou pulada): não aparece mais neste navegador e o pedido abre. */
  function concluirApresentacao(area?: IdTema) {
    marcarApresentacaoVista();
    if (area) setAreaInicial(area);
    navegar({ tipo: 'objetivo' });
  }

  const ocupado = pendente !== null;
  const planoAtual = 'plano' in tela ? tela.plano.id : null;
  const carregandoTrilha = pendente === 'plano';
  // Começar, na trilha gerada, já mostra a forma da lição: salvar o plano e abrir a primeira lição é uma espera só.
  const carregandoLicao = (pendente === 'abrir' && tela.tipo !== 'plano') || (pendente === 'aceitar' && tela.tipo === 'geracao');
  const visivel = !carregandoTrilha && !carregandoLicao;
  // Banca da noite §5: nas telas de topo, a barra de abas aparece sempre, também sem trilhas (com "Nova trilha" marcada),
  // e no celular o cabeçalho fica só com a marca e o selo, como no app.
  const comNavegacao = ((inicio === 'carregando' && tinhaTrilhas) || (inicio === 'pronto' && ['planos', 'objetivo', 'plano', 'perfil', 'explorar', 'configuracoes'].includes(tela.tipo))) && visivel;
  // Sem trilhas, "Minhas trilhas" mostra o pedido: a aba marcada é "Nova trilha".
  const abaNovaTrilha = tela.tipo === 'objetivo' || (tela.tipo === 'planos' && planos.length === 0);
  const abrirFolha = compartilhar ? (planoId: string) => setFolha(planoId) : undefined;

  const acaoDoErro = (codigoErro: string) =>
    codigoErro === 'limite_geracoes' || codigoErro === 'limite_estudio' ? (
      <Botao variante="secundario" onClick={() => { setErro(null); setInicio('pronto'); navegar({ tipo: 'planos' }); }}>
        {mensagens.pedido.verPlanos}
      </Botao>
    ) : (
      <Botao variante="secundario" onClick={() => {
        if (inicio === 'falha') setInicio('carregando');
        setErro(null);
        void carregar(() => false);
      }}>
        {mensagens.tentarNovamente}
      </Botao>
    );

  return (
    <div className="estudo" data-navegacao={comNavegacao || undefined}>
      <a className="pular" href="#conteudo-principal">{mensagens.pular}</a>
      <aside className="barra-lateral">
        <div className="barra-marca"><Logo /></div>
        <nav className="navegacao" aria-label={mensagens.navegacao}>
          <Botao variante="texto" className="navegacao-item" onClick={() => navegar({ tipo: 'planos' })} disabled={ocupado} aria-current={tela.tipo === 'planos' ? 'page' : undefined}>
            {mensagens.planos.titulo}
          </Botao>
          {planos.length > 0 && <ul className="navegacao-planos">
            {planos.slice(0, 5).map((plano) => (
              <li key={plano.id}>
                <Botao variante="texto" className="navegacao-plano" onClick={() => void abrirPlano(plano.id)} disabled={ocupado} aria-current={plano.id === planoAtual ? 'page' : undefined}>
                  {plano.titulo}
                </Botao>
              </li>
            ))}
          </ul>}
          <Botao variante="secundario" className="navegacao-novo" onClick={() => navegar({ tipo: 'objetivo' })} disabled={ocupado}>
            <span aria-hidden="true">+</span> {mensagens.planos.novo}
          </Botao>
          {comunidade && (
            <Botao variante="texto" className="navegacao-item navegacao-explorar" onClick={() => navegar({ tipo: 'explorar' })} disabled={ocupado} aria-current={tela.tipo === 'explorar' ? 'page' : undefined}>
              <Icone nome="bussola" />{mensagens.comunidade.navegacao}
            </Botao>
          )}
        </nav>
        <div className="navegacao-rodape">
          <Botao variante="texto" onClick={() => navegar({ tipo: 'apresentacao', primeiraVez: false })} disabled={ocupado}>
            {mensagens.pedido.comoFunciona}
          </Botao>
          {compartilhar && (
            <button type="button" className="navegacao-perfil" disabled={ocupado} aria-current={tela.tipo === 'perfil' ? 'page' : undefined}
              onClick={() => navegar({ tipo: 'perfil' })}>
              {perfil?.nome ? <Avatar nome={perfil.nome} cor={perfil.cor ?? 'azul'} foto={perfil.foto} /> : <Icone nome="pessoa" />}
              <span>{perfil?.nome ?? mensagens.perfil.navegacao}</span>
            </button>
          )}
        </div>
      </aside>

      <div className="estudo-pagina">
        {/* No computador, com o perfil ligado, a faixa do topo só tem o selo "Progresso salvo" (Minhas trilhas e dentro da
            trilha); nas outras telas fica vazia e some. Sem o perfil, ela leva o "Sair". No celular fica sempre. */}
        <header className="estudo-cabecalho" data-tela={tela.tipo} data-vazia-no-computador={(compartilhar && !(inicio === 'pronto' && ((tela.tipo === 'planos' && planos.length > 0) || tela.tipo === 'plano'))) || undefined}>
          <span className="estudo-identificacao">
            <span className="estudo-identificacao__contexto">
              {tela.tipo === 'objetivo' ? mensagens.planos.novo : tela.tipo === 'explorar' ? mensagens.comunidade.titulo : tela.tipo === 'plano' ? tela.plano.titulo : mensagens.planos.titulo}
            </span>
            {inicio === 'pronto' && ((tela.tipo === 'planos' && planos.length > 0) || tela.tipo === 'plano') && (
              <SeloSincronia sincronia={sincronia} agora={agora} temProgresso={planos.length > 0} />
            )}
          </span>
          <div className="estudo-marca"><Logo /></div>
          <div className="estudo-conta">
            {inicio === 'pronto' && (
              <Botao variante="texto" className="planos-movel" onClick={() => navegar({ tipo: 'planos' })} disabled={ocupado}>{mensagens.planos.titulo}</Botao>
            )}
            {compartilhar ? (
              <Botao variante="texto" className="perfil-cabecalho" onClick={() => navegar({ tipo: 'perfil' })} disabled={ocupado}>{mensagens.perfil.navegacao}</Botao>
            ) : (
              <Botao variante="texto" onClick={() => void sair()} disabled={ocupado}>{mensagens.sair}</Botao>
            )}
          </div>
        </header>

        <main id="conteudo-principal" className="estudo-principal" tabIndex={-1} ref={principal} aria-busy={ocupado}>
          <p className="somente-leitor" role="status">{anuncio}</p>
          {erro && <EstadoErro codigo={erro}>{acaoDoErro(erro)}</EstadoErro>}
          {inicio === 'carregando' && <SkeletonTrilha />}
          {inicio === 'pronto' && carregandoTrilha && <SkeletonTrilha />}
          {inicio === 'pronto' && carregandoLicao && (tela.tipo === 'geracao' && geracao?.proposta
            ? <PreparandoLicoes proposta={geracao.proposta} prontas={pendente === 'abrir'} />
            : <SkeletonLicao texto={mensagens.licao.carregando} />)}
          {visivel && tela.tipo === 'apresentacao' && (
            <Apresentacao primeiraVez={tela.primeiraVez} concluir={concluirApresentacao} />
          )}
          {visivel && (tela.tipo === 'objetivo' || tela.tipo === 'planos' && planos.length === 0) && (
            <Pedido onProposta={p => { navegar({ tipo: 'geracao' }); setGeracao({ objetivo: p.objetivo, titulo: p.titulo, fluxos: p.fluxos.map(f => ({ titulo: f.titulo, licoes: f.licoes.map(l => l.titulo) })), proposta: p }); }} objetivo={objetivo} ocupado={ocupado} aviso={aviso} falha={falhaGeracao} temPlanos={planos.length > 0} areaInicial={areaInicial}
              avisoSemTrilhas={tela.tipo === 'planos' && planos.length === 0 && inicio === 'pronto'}
              aoMudar={setObjetivo} anunciar={anunciar} gerar={(texto) => void gerar(texto)}
              verPlanos={() => navegar({ tipo: 'planos' })}
              comoFunciona={() => navegar({ tipo: 'apresentacao', primeiraVez: false })}
              porLink={compartilhar ? <>
                <AdicionarPorLink ocupado={ocupado} aoAdicionar={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} abrirPlano={(id) => void abrirPlano(id)} />
                {comunidade && <button type="button" className="por-link__abrir" disabled={ocupado} onClick={() => navegar({ tipo: 'explorar' })}><Icone nome="bussola" />{mensagens.comunidade.irAoExplorar}</button>}
              </> : undefined} />
          )}
          {visivel && tela.tipo === 'planos' && planos.length > 0 && (() => {
            const destaque = planoInicial(planos);
            const restantes = destaque ? planos.filter((item) => item.id !== destaque.id) : planos;
            return (
              <section className="painel painel--planos">
                <div className="planos-cabeca">
                  <h1 tabIndex={-1}>{mensagens.planos.titulo}</h1>
                  <Botao variante="secundario" disabled={ocupado} onClick={() => navegar({ tipo: 'objetivo' })}>
                    <span aria-hidden="true">+</span> {mensagens.planos.novo}
                  </Botao>
                </div>
                <p className="introducao">{mensagens.planos.subtitulo}</p>
                {destaque && (
                  <CartaoDestaque plano={destaque} regiao={planos.findIndex((p) => p.id === destaque.id)}
                    ocupado={ocupado} abrir={() => void abrirPlano(destaque.id)} apagar={() => apagarPlano(destaque)}
                    compartilhar={abrirFolha && !destaque.recebida ? () => abrirFolha(destaque.id) : undefined}
                    configurar={() => navegar({ tipo: 'configuracoes', planoId: destaque.id, volta: 'planos' })} />
                )}
                {restantes.length > 0 && (
                  <>
                    <p className="planos-secao-titulo">{mensagens.planos.outrasTrilhas}</p>
                    <ul className="planos-ativos">
                      {restantes.map((plano, indice) => (
                        <li key={plano.id} style={{ '--ordem': indice } as CSSProperties}>
                          <CartaoPlano plano={plano} regiao={planos.findIndex((p) => p.id === plano.id)} ocupado={ocupado}
                            secundario abrir={() => void abrirPlano(plano.id)} apagar={() => apagarPlano(plano)}
                            compartilhar={abrirFolha && !plano.recebida ? () => abrirFolha(plano.id) : undefined}
                            configurar={() => navegar({ tipo: 'configuracoes', planoId: plano.id, volta: 'planos' })} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            );
          })()}
          {visivel && tela.tipo === 'geracao' && geracao && (
            <GeracaoAoVivo geracao={geracao} ocupado={ocupado}
              cancelar={cancelarGeracao} comecar={(proposta) => void comecar(proposta)} ajustar={() => navegar({ tipo: 'objetivo' })}
              existente={geracao.proposta
                ? planos.find((plano) => trilhaRepetida(plano.titulo, geracao.proposta?.titulo ?? ''))
                : undefined}
              abrirExistente={(id) => void abrirPlano(id)} />
          )}
          {visivel && tela.tipo === 'plano' && (
            <Plano tela={tela} ocupado={ocupado} abrindo={abrindo} anunciar={anunciar}
              precarregarLicao={(id) => { void obterLicaoComCache(id).catch(() => undefined); }}
              abrirLicao={(id) => void abrirLicao(tela.plano, id)}
              novoPlano={() => navegar({ tipo: 'objetivo' })}
              compartilhar={abrirFolha && !tela.plano.recebida ? () => abrirFolha(tela.plano.id) : undefined}
              configurar={() => navegar({ tipo: 'configuracoes', planoId: tela.plano.id, volta: 'plano' })} />
          )}
          {visivel && tela.tipo === 'configuracoes' && (() => {
            const resumo = planos.find((item) => item.id === tela.planoId);
            const voltarDaqui = () => (tela.volta === 'plano' ? void abrirPlano(tela.planoId) : navegar({ tipo: 'planos' }));
            return (
              <TelaConfiguracoes key={tela.planoId} planoId={tela.planoId} compartilhar={Boolean(abrirFolha)} versao={versaoFolha}
                recebidaDe={resumo?.recebida?.nome ?? null}
                voltar={voltarDaqui}
                aoMudar={(conf) => setPlanos((anteriores) => anteriores.map((item) => (item.id === conf.planoId
                  ? { ...item, titulo: conf.titulo, capa: conf.capa, tema: conf.tema }
                  : item)))}
                mudarCompartilhamento={() => abrirFolha?.(tela.planoId)}
                apagar={() => { if (resumo) apagarPlano(resumo, () => navegar({ tipo: 'planos' })); }} />
            );
          })()}
          {visivel && tela.tipo === 'perfil' && (
            <TelaPerfil perfil={perfil} aoMudarPerfil={setPerfil} aoMudarLink={mudarLink} anunciar={anunciar}
              abrirPlano={(id) => void abrirPlano(id)} registrarGuarda={registrarGuarda} sair={() => void sair()}
              comunidade={comunidade} aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} irParaTrilhas={() => navegar({ tipo: 'planos' })} />
          )}
          {visivel && tela.tipo === 'explorar' && comunidade && (
            <Explorar logado aoAbrir={(id) => void abrirPlano(id)} irParaTrilhas={() => navegar({ tipo: 'planos' })}
              aoAdicionado={(id, nome, ja) => void aoAdicionarPorLink(id, nome, ja)} />
          )}
          {visivel && tela.tipo === 'licao' && (
            <Licao key={tela.licao.id} licao={tela.licao} pendente={pendente}
              avaliar={async (resposta, indice) => {
                const resultado = await executar('avaliar', () => cliente.avaliarLicao(tela.licao.id, resposta, indice));
                return resultado.ok ? resultado.dados : null;
              }}
              concluir={(comprovante, resumo, pratica) => concluir(tela.plano, tela.licao, comprovante, resumo, pratica)}
              voltar={() => void abrirPlano(tela.plano.id, tela.licao.id)} />
          )}
          {visivel && tela.tipo === 'concluida' && (
            <LicaoConcluida plano={tela.plano} antes={tela.antes} licao={tela.licao} liberadas={tela.liberadas} resumo={tela.resumo} ocupado={ocupado}
              abrirLicao={(id) => void abrirLicao(tela.plano, id)}
              voltar={() => navegar({ tipo: 'plano', plano: tela.plano, origem: tela.licao.id, liberadas: tela.liberadas, concluida: tela.licao.id })}
              novoAssunto={() => navegar({ tipo: 'objetivo' })}
              compartilhar={abrirFolha && !tela.plano.recebida ? () => abrirFolha(tela.plano.id) : undefined} />
          )}
        </main>
        {comNavegacao && <nav className="navegacao-mobile" aria-label={mensagens.navegacao} data-itens={(compartilhar ? 3 : 2) + (comunidade ? 1 : 0)}>
          <button type="button" disabled={ocupado} aria-current={!abaNovaTrilha && !['perfil', 'explorar'].includes(tela.tipo) ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'planos' })}><Icone nome="livro" />{mensagens.planos.titulo}</button>
          <button type="button" disabled={ocupado} aria-current={abaNovaTrilha ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'objetivo' })}><Icone nome="lampada" />{mensagens.planos.novo}</button>
          {comunidade && <button type="button" disabled={ocupado} aria-current={tela.tipo === 'explorar' ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'explorar' })}><Icone nome="bussola" />{mensagens.comunidade.navegacao}</button>}
          {compartilhar && <button type="button" disabled={ocupado} aria-current={tela.tipo === 'perfil' ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'perfil' })}><Icone nome="pessoa" />{mensagens.perfil.navegacao}</button>}
        </nav>}
      </div>
      {folha && (
        <FolhaCompartilhar planoId={folha} visitante={Boolean(perfil?.visitante)} comunidade={comunidade} anunciar={anunciar}
          aoFechar={() => { setFolha(null); setVersaoFolha((n) => n + 1); }} aoMudarLink={mudarLink} aoMudarPerfil={setPerfil} />
      )}
      {confirmacao?.titulo && (
        <DialogoConfirmar titulo={confirmacao.titulo} texto={confirmacao.mensagem} aviso={confirmacao.aviso} perigo
          confirmar={confirmacao.confirmarRotulo} cancelar={mensagens.planos.apagarCancelar} ocupado={ocupado}
          aoCancelar={() => setConfirmacao(null)}
          aoConfirmar={() => { const acao = confirmacao.aoConfirmar; setConfirmacao(null); void acao(); }} />
      )}
      {confirmacao && !confirmacao.titulo && (
        <ConfirmacaoModal
          mensagem={confirmacao.mensagem}
          confirmarRotulo={confirmacao.confirmarRotulo}
          destrutivo={confirmacao.destrutivo}
          ocupado={ocupado}
          aoCancelar={() => {
            setConfirmacao(null);
            window.requestAnimationFrame(() => origemConfirmacao.current?.focus());
          }}
          aoConfirmar={() => {
            const acao = confirmacao.aoConfirmar;
            setConfirmacao(null);
            void acao();
          }}
        />
      )}
    </div>
  );
}

/**
 * Barra de progresso do plano. Enche com uma animação curta ao aparecer: do zero ou, com `de`, a partir do progresso
 * anterior (na lição concluída). O leitor de tela ouve a contagem ("1 de 5 lições concluídas").
 */
function BarraProgresso({ progresso, comPercentual = false, de }: { progresso: Progresso; comPercentual?: boolean; de?: Progresso }) {
  if (progresso.percentual === null) return <span className="progresso-vazio">{mensagens.planos.semProgresso}</span>;

  const texto = mensagens.planos.contagem(progresso.concluidas, progresso.total);
  const estilo = { '--valor': `${progresso.percentual}%`, '--de': `${de?.percentual ?? 0}%` } as CSSProperties;

  return (
    <div className="progresso">
      <div className="barra" role="progressbar" aria-label={texto} aria-valuemin={0} aria-valuemax={progresso.total}
        aria-valuenow={progresso.concluidas} style={estilo}>
        <span className="barra__preenchimento" />
      </div>
      <span className="progresso__legenda">
        <span>{texto}</span>
        {comPercentual && <span className="progresso__percentual" aria-hidden="true">{mensagens.trilha.percentual(progresso.percentual)}</span>}
      </span>
    </div>
  );
}

/**
 * Cartão de um plano em Meus planos: uma faixa do mundo (cada plano numa região, para os cartões não ficarem iguais),
 * o título, o progresso e a ação que cabe: começar, continuar ou rever a trilha concluída.
 */
/** "Compartilhada" (selo da dona) ou "Compartilhada por Ana" (trilha recebida; o nome abre o perfil público). */
function MarcaCompartilhar({ plano }: { plano: PlanoResumo }) {
  if (plano.recebida) {
    const { nome, perfilId, foto } = plano.recebida;
    const texto = mensagens.compartilhar.compartilhadaPor(nome);
    return (
      <p className="marca-recebida">
        {foto && <Avatar nome={nome} cor="azul" foto={foto} />}
        {perfilId ? <>{texto.slice(0, texto.length - nome.length)}<a href={`/p/${perfilId}`}>{nome}</a></> : texto}
      </p>
    );
  }
  if (plano.link) return <p className="selo-compartilhada"><Icone nome="compartilhar" />{mensagens.compartilhar.selo}</p>;
  return null;
}

function CartaoDestaque({ plano, regiao, ocupado, abrir, apagar, compartilhar, configurar }: {
  plano: PlanoResumo;
  regiao: number;
  ocupado: boolean;
  abrir: () => void;
  apagar: () => void;
  compartilhar?: () => void;
  configurar?: () => void;
}) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0 && !temAndamentoNoPlano(plano.id)) acao = mensagens.planos.comecar;
  const enfeites = regiaoDoTrecho(Math.max(0, regiao)).enfeites;

  return (
    <article className="plano-destaque">
      <MenuCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} compartilhar={compartilhar} configurar={configurar} />
      <div className="plano-destaque__cena" style={coresDaRegiao(Math.max(0, regiao))} aria-hidden="true">
        {/* Com capa escolhida nas configurações, ela entra no lugar da ilustração; sem capa, tudo como sempre. */}
        {plano.capa ? <CapaDaTrilha semente={plano.id} tema={plano.tema ?? null} capa={plano.capa} className="plano-destaque__capa" /> : <>
          <span className="plano-cartao__colina" />
          <Desenho nome={enfeites[0]} />
          <Desenho nome={enfeites[2]} />
          <Mascote expressao="stu-feliz" tamanho={64} sombra animado="uma-vez" className="stu" />
        </>}
      </div>
      <div className="plano-destaque__corpo">
        <div className="plano-destaque__topo">
          <span className="plano-destaque__rotulo">{concluido ? mensagens.retomada.concluido : mensagens.retomada.titulo}</span>
        </div>
        <h2>{plano.titulo}</h2>
        <MarcaCompartilhar plano={plano} />
        <BarraProgresso progresso={plano.progresso} comPercentual />
      </div>
      <div className="plano-destaque__acoes">
        <Botao variante="primario" aria-label={`${acao}: ${plano.titulo}`} disabled={ocupado} onClick={abrir}>
          {acao}<Icone nome="seta" />
        </Botao>
      </div>
    </article>
  );
}

/** Menu discreto no cartão de trilha: fecha com Esc ou clique fora. */
function MenuCartao({ titulo, ocupado, apagar, compartilhar, configurar }: { titulo: string; ocupado: boolean; apagar: () => void; compartilhar?: () => void; configurar?: () => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function aoClicarFora(evento: PointerEvent) {
      const el = detailsRef.current;
      if (el?.open && evento.target instanceof Node && !el.contains(evento.target)) el.open = false;
    }
    function aoTeclar(evento: KeyboardEvent) {
      const el = detailsRef.current;
      if (el?.open && evento.key === 'Escape') {
        evento.preventDefault();
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', aoClicarFora);
    window.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('pointerdown', aoClicarFora);
      window.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  return (
    <details className="plano-cartao__menu" ref={detailsRef}>
      <summary aria-label={mensagens.planos.maisOpcoesRotulo(titulo)}>•••</summary>
      {/* Compartilhar, Configurações e Apagar, num menu do próprio app (sem folha do sistema). */}
      <div className="plano-cartao__opcoes" role="group" aria-label={mensagens.componentes.menuRotulo(1 + (compartilhar ? 1 : 0) + (configurar ? 1 : 0))}>
        {compartilhar && (
          <button type="button" className="plano-cartao__compartilhar" aria-label={mensagens.compartilhar.entradaRotulo(titulo)} disabled={ocupado}
            onClick={() => { if (detailsRef.current) detailsRef.current.open = false; compartilhar(); }}>
            {mensagens.compartilhar.entrada}
          </button>
        )}
        {configurar && (
          <button type="button" className="plano-cartao__compartilhar" aria-label={mensagens.configuracoes.entradaRotulo(titulo)} disabled={ocupado}
            onClick={() => { if (detailsRef.current) detailsRef.current.open = false; configurar(); }}>
            {mensagens.configuracoes.entrada}
          </button>
        )}
        <button type="button" className="plano-cartao__apagar" aria-label={mensagens.planos.apagarRotulo(titulo)} disabled={ocupado}
          onClick={() => { if (detailsRef.current) detailsRef.current.open = false; apagar(); }}>
          {mensagens.planos.apagar}
        </button>
      </div>
    </details>
  );
}

function CartaoPlano({ plano, regiao, ocupado, secundario = false, abrir, apagar, compartilhar, configurar }: {
  plano: PlanoResumo;
  regiao: number;
  ocupado: boolean;
  secundario?: boolean;
  abrir: () => void;
  apagar: () => void;
  compartilhar?: () => void;
  configurar?: () => void;
}) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0 && !temAndamentoNoPlano(plano.id)) acao = mensagens.planos.comecar;
  const enfeites = regiaoDoTrecho(Math.max(0, regiao)).enfeites;

  return (
    <article className="plano-cartao">
      <MenuCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} compartilhar={compartilhar} configurar={configurar} />
      <div className="plano-cartao__cena" style={coresDaRegiao(Math.max(0, regiao))} aria-hidden="true">
        {plano.capa ? <CapaDaTrilha semente={plano.id} tema={plano.tema ?? null} capa={plano.capa} className="plano-cartao__capa" /> : <>
          <span className="plano-cartao__colina" />
          <Desenho nome={enfeites[0]} />
          <Desenho nome={enfeites[1]} />
          <Desenho nome={enfeites[3]} />
          <Desenho nome={enfeites[2]} />
        </>}
        {concluido && <span className="plano-cartao__selo"><Icone nome="trofeu" />{mensagens.planos.concluido}</span>}
      </div>
      <div className="plano-cartao__corpo">
        <div>
          <h2>{plano.titulo}</h2>
          <MarcaCompartilhar plano={plano} />
          <BarraProgresso progresso={plano.progresso} />
        </div>
        <Botao variante={concluido || secundario ? 'secundario' : 'primario'} aria-label={`${acao}: ${plano.titulo}`} disabled={ocupado} onClick={abrir}>
          {acao}<Icone nome="seta" />
        </Botao>
      </div>
    </article>
  );
}

/**
 * A fila da geração (spec 04, revisão do dono de 19/11; como o app): cada lição entra quando a anterior chega ao passo 3
 * (o nó cai), então nada fica para trás nem se acumula quando os eventos chegam rápido. A contagem sobe e o leitor de tela
 * ouve "Lição 3: …" no passo 4, quando o nome aparece.
 */
function useFilaDaGeracao(nos: readonly NoCaminho[], anunciar: (texto: string) => void) {
  const [mostrados, setMostrados] = useState(0);
  const [contados, setContados] = useState(0);
  const ultimaEntrada = useRef(0);
  const relogios = useRef<number[]>([]);
  const lista = useRef(nos);
  lista.current = nos;
  useEffect(() => () => relogios.current.forEach((relogio) => window.clearTimeout(relogio)), []);
  useEffect(() => {
    if (mostrados >= nos.length) return;
    const abriu = (indice: number) => indice > 0 && lista.current[indice].trecho !== lista.current[indice - 1].trecho;
    const espera = mostrados === 0 ? 0 : Math.max(0, ultimaEntrada.current + intervaloDaFila(abriu(mostrados - 1)) - Date.now());
    const relogio = window.setTimeout(() => {
      ultimaEntrada.current = Date.now();
      const indice = mostrados;
      setMostrados(indice + 1);
      relogios.current.push(window.setTimeout(() => {
        setContados((atual) => Math.max(atual, indice + 1));
        const licao = lista.current[indice];
        if (licao) anunciar(mensagens.geracao.anuncioLicao(indice + 1, licao.titulo));
      }, atrasosDaLicao(abriu(indice)).nome));
    }, espera);
    return () => window.clearTimeout(relogio);
  }, [mostrados, nos.length, anunciar]);
  return { mostrados, contados };
}

const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Geração que se acompanha (spec 04, "Revisão do dono (19/11)"; paridade com o app, 4652078). O cartão do título vira
 * uma faixa de 52 px presa no alto (o pedido numa linha e a contagem; sem os pontinhos, banca da noite, item 6), com a
 * placa do Stu presa logo abaixo, por cima do mapa (a frase, as dicas que se revezam e, depois de 12 s sem lição nova, a
 * espera longa). Cada lição nasce em passos e a página rola até ela ficar a 60% do mapa, enquanto a pessoa não mexe.
 * Rolar para cima mais de 40 px (ou pôr o foco num nó) para de acompanhar e mostra a pílula "Ver a lição nova · N";
 * tocar nela, ou rolar até a lição nova, volta a acompanhar. No fim, a página vai até o troféu (ou a pílula vira "Ver o
 * fim da trilha"), a placa diz que a trilha ficou pronta, o rodapé troca para "Ajustar pedido" e "Começar" e o foco vai
 * para "Começar". Ao subir até o começo, o cartão do título volta. Cancelar e Ajustar voltam ao pedido sem salvar nada.
 */
function GeracaoAoVivo({ geracao, ocupado, cancelar, comecar, ajustar, existente, abrirExistente }: {
  geracao: TrilhaEmGeracao;
  ocupado: boolean;
  cancelar: () => void;
  comecar: (proposta: PropostaPlano) => void;
  ajustar: () => void;
  /** Uma trilha da pessoa com o mesmo nome: a tela avisa e oferece abrir a que já existe, em vez de duplicar. */
  existente?: PlanoResumo;
  abrirExistente: (id: string) => void;
}) {
  const todos = useMemo(() => nosDaPrevia(geracao), [geracao]);
  const { titulo, proposta } = geracao;
  const [anuncio, setAnuncio] = useState('');
  const anunciar = useCallback((texto: string) => setAnuncio((antes) => (antes === texto ? `${texto}\u00a0` : texto)), []);
  const { mostrados, contados } = useFilaDaGeracao(todos, anunciar);
  const nos = useMemo(() => todos.slice(0, mostrados), [todos, mostrados]);
  const pronta = proposta !== null && mostrados >= todos.length;
  const total = nos.length;
  const partes = new Set(nos.map((no) => no.trecho)).size;
  const ultimo = nos[total - 1];
  const raiz = useRef<HTMLElement>(null);
  const faixa = useRef<HTMLDivElement>(null);
  const placa = useRef<HTMLDivElement>(null);
  const rodape = useRef<HTMLDivElement>(null);
  const botaoComecar = useRef<HTMLButtonElement>(null);
  const [acompanhando, setAcompanhando] = useState(true);
  const acompanhandoAgora = useRef(true);
  const maisBaixo = useRef(0);
  const programada = useRef<{ inicio: number; alvo: number; ate: number } | null>(null);
  const animacao = useRef(0);
  const [esperaLonga, setEsperaLonga] = useState(false);
  const [cartaoDeVolta, setCartaoDeVolta] = useState(false);
  const [trofeuAVista, setTrofeuAVista] = useState(false);
  const [maisUma, setMaisUma] = useState(0);
  const [medidas, setMedidas] = useState({ rodape: 88, placa: 72 });
  const prontaAgora = useRef(pronta);
  prontaAgora.current = pronta;
  const contagem = pronta ? mensagens.geracao.contagemFinal(total) : mensagens.geracao.contagem(contados);
  const contagemDaFaixa = pronta ? mensagens.geracao.contagemFinal(total) : contados === 0 ? mensagens.geracao.faixaGerando : mensagens.geracao.contagemFinal(contados);

  // A faixa, a placa e o rodapé cobrem parte da janela: a vaga fica a 60% do que sobra entre eles.
  const coberto = () => faixa.current?.offsetHeight ?? 0;
  const visivel = () => Math.min(window.innerHeight, rodape.current?.getBoundingClientRect().top ?? window.innerHeight);
  const alturaMaxima = () => document.documentElement.scrollHeight - window.innerHeight;

  useEffect(() => {
    const medir = () => setMedidas({ rodape: rodape.current?.offsetHeight ?? 88, placa: placa.current?.offsetHeight ?? 72 });
    medir();
    const observador = new ResizeObserver(medir);
    [rodape.current, placa.current].forEach((alvo) => { if (alvo) observador.observe(alvo); });
    return () => observador.disconnect();
  }, [cartaoDeVolta]);

  function mudarAcompanhar(valor: boolean) {
    acompanhandoAgora.current = valor;
    setAcompanhando(valor);
  }

  /** A página rola sozinha (320 ms, saída suave; com movimento reduzido, pula): o que ela faz não conta como a pessoa. */
  function rolarPara(destino: number) {
    const alvo = Math.max(0, Math.round(destino));
    const inicio = window.scrollY;
    const reduzido = movimentoReduzido();
    window.cancelAnimationFrame(animacao.current);
    programada.current = { inicio, alvo, ate: Date.now() + (reduzido ? 120 : RITMO_DA_GERACAO.rolagemMs + 400) };
    if (reduzido) { window.scrollTo(0, alvo); return; }
    const comeco = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - comeco) / RITMO_DA_GERACAO.rolagemMs);
      const suave = 1 - (1 - t) ** 3;
      window.scrollTo(0, inicio + (alvo - inicio) * suave);
      if (t < 1) animacao.current = window.requestAnimationFrame(passo);
    };
    animacao.current = window.requestAnimationFrame(passo);
  }
  useEffect(() => () => window.cancelAnimationFrame(animacao.current), []);

  /** O centro da lente da lição mais nova, na página. */
  function centroDaMaisNova() {
    const lentes = raiz.current?.querySelectorAll('.caminho-no:not(.caminho-no--vindo) .caminho-no__lente');
    const lente = lentes?.[lentes.length - 1];
    if (!lente) return null;
    const caixa = lente.getBoundingClientRect();
    return caixa.top + caixa.height / 2 + window.scrollY;
  }
  function rolarAteLicao() {
    const centro = centroDaMaisNova();
    if (centro !== null) rolarPara(Math.min(alturaMaxima(), rolagemDaVaga(centro, visivel(), coberto())));
  }
  function fimDaTrilha() {
    const chegada = raiz.current?.querySelector('.caminho-chegada');
    if (!chegada) return alturaMaxima();
    return Math.min(alturaMaxima(), chegada.getBoundingClientRect().bottom + window.scrollY + 24 - visivel());
  }

  // Cada lição nova: a página vai até ela (passo 0), se está acompanhando; "Mais uma!" a cada três lições, aos 700 ms.
  useEffect(() => {
    if (mostrados === 0 || prontaAgora.current) return;
    if (acompanhandoAgora.current) window.requestAnimationFrame(rolarAteLicao);
    if (!comMaisUma(mostrados) || movimentoReduzido()) return;
    const relogio = window.setTimeout(() => setMaisUma(mostrados), RITMO_DA_GERACAO.esperaAtrasoMs);
    return () => window.clearTimeout(relogio);
    // Só quando uma lição nova entra no mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrados]);

  // Sons (spec 12, momentos novos de 19/11): cada lição toca `geracao_licao` quando o nó cai (passo 3; com movimento
  // reduzido, quando aparece); rajadas dentro de 180 ms o toca-sons descarta. O fim toca `geracao_pronta` uma vez e cala as
  // lições que ainda cairiam. "Mais uma!", o troféu e o foco em "Começar" não têm som; sair da tela cala o que faltava.
  const somDasLicoes = useRef(new Set<number>());
  const mostradosAntes = useRef(mostrados);
  useEffect(() => {
    const de = mostradosAntes.current;
    mostradosAntes.current = mostrados;
    if (pronta || mostrados <= de) return;
    for (let indice = de; indice < mostrados; indice += 1) {
      const abreTrecho = indice > 0 && todos[indice - 1]?.trecho !== todos[indice]?.trecho;
      const relogio = window.setTimeout(() => {
        somDasLicoes.current.delete(relogio);
        void tocaSons.tocarEfeito('geracao_licao');
      }, movimentoReduzido() ? 0 : atrasosDaLicao(abreTrecho).no);
      somDasLicoes.current.add(relogio);
    }
    // Só quando uma lição nova entra no mapa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrados]);
  useEffect(() => () => somDasLicoes.current.forEach((relogio) => window.clearTimeout(relogio)), []);

  // Espera longa: 12 s sem lição nova, a placa diz que ainda está escrevendo (sem barra de progresso inventada).
  useEffect(() => {
    setEsperaLonga(false);
    if (proposta) return;
    const relogio = window.setTimeout(() => setEsperaLonga(true), RITMO_DA_GERACAO.esperaLongaMs);
    return () => window.clearTimeout(relogio);
  }, [todos.length, proposta]);

  // O fim: o som e o anúncio uma vez, a página até o troféu (se acompanhando) e o foco em "Começar" depois do rodapé.
  useEffect(() => {
    if (!pronta) return;
    somDasLicoes.current.forEach((relogio) => window.clearTimeout(relogio));
    somDasLicoes.current.clear();
    void tocaSons.tocarEfeito('geracao_pronta');
    anunciar(mensagens.geracao.anuncioFim(total));
    if (window.scrollY <= 4 && !acompanhandoAgora.current) setCartaoDeVolta(true);
    const quadro = window.requestAnimationFrame(() => { if (acompanhandoAgora.current) rolarPara(fimDaTrilha()); });
    const focar = window.setTimeout(() => botaoComecar.current?.focus({ preventScroll: true }), RITMO_DA_GERACAO.rodapeMs + 60);
    return () => { window.cancelAnimationFrame(quadro); window.clearTimeout(focar); };
    // Só na virada para pronta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronta]);

  // O troféu à vista libera o confete (sem acompanhar, ele só cai quando o troféu entra na tela).
  useEffect(() => {
    if (!pronta) return;
    const lente = raiz.current?.querySelector('.caminho-chegada__lente');
    if (!lente) return;
    const observador = new IntersectionObserver(([entrada]) => { if (entrada.isIntersecting) setTrofeuAVista(true); }, { threshold: 0.6 });
    observador.observe(lente);
    return () => observador.disconnect();
  }, [pronta]);

  // Quem manda na rolagem: subir mais de 40 px (ou o foco num nó) para de acompanhar; descer até a lição nova volta.
  useEffect(() => {
    let anterior = window.scrollY;
    maisBaixo.current = anterior;
    function aoRolar() {
      const y = window.scrollY;
      const antes = anterior;
      anterior = y;
      if (prontaAgora.current && y <= 4) setCartaoDeVolta(true);
      const andando = programada.current;
      if (andando) {
        if (acompanhandoAgora.current && y < Math.min(andando.inicio, andando.alvo) - RITMO_DA_GERACAO.pararAcimaDe) {
          programada.current = null;
          window.cancelAnimationFrame(animacao.current);
          mudarAcompanhar(false);
          return;
        }
        if (Math.abs(y - andando.alvo) < 2) { programada.current = null; maisBaixo.current = y; return; }
        if (Date.now() <= andando.ate) return;
        programada.current = null;
        maisBaixo.current = antes;
      }
      if (acompanhandoAgora.current) {
        if (deixouDeAcompanhar(y, maisBaixo.current)) mudarAcompanhar(false);
        else maisBaixo.current = Math.max(maisBaixo.current, y);
        return;
      }
      if (y <= antes) return;
      const chegada = raiz.current?.querySelector('.caminho-chegada__lente');
      const centro = centroDaMaisNova();
      const voltou = prontaAgora.current
        ? chegada !== null && chegada !== undefined && chegada.getBoundingClientRect().bottom <= visivel()
        : centro !== null && vagaAVista(centro, y, visivel(), coberto());
      if (voltou) { maisBaixo.current = y; mudarAcompanhar(true); }
    }
    function aoFocar(evento: FocusEvent) {
      if (evento.target instanceof Element && evento.target.closest('.caminho-nos')) mudarAcompanhar(false);
    }
    window.addEventListener('scroll', aoRolar, { passive: true });
    const area = raiz.current;
    area?.addEventListener('focusin', aoFocar);
    return () => { window.removeEventListener('scroll', aoRolar); area?.removeEventListener('focusin', aoFocar); };
    // Liga uma vez; as referências guardam o estado atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A pílula: leva à lição nova (ou ao fim) e volta a acompanhar. */
  function verLicaoNova() {
    mudarAcompanhar(true);
    if (pronta) rolarPara(fimDaTrilha());
    else rolarAteLicao();
  }

  const pilula = !acompanhando && total > 0 && !(pronta && trofeuAVista);
  const placaTexto = pronta ? mensagens.geracao.placaPronta(total, partes) : esperaLonga ? mensagens.geracao.esperaLonga : mensagens.geracao.stuMontando;

  return (
    <section ref={raiz} className="painel painel--trilha painel--geracao" data-acompanhada data-pronta={pronta || undefined}
      style={{ '--rodape-geracao': `${medidas.rodape}px`, '--respiro-placa': `${medidas.placa + 20}px` } as CSSProperties}>
      {pronta && proposta && cartaoDeVolta ? (
        <header className="trilha-cabecalho geracao-cartao">
          <div className="trilha-resumo">
            <p className="contexto-tela">{mensagens.geracao.contexto}</p>
            <h1 tabIndex={-1}>{titulo ? <span className="geracao-titulo" key={titulo}>{titulo}</span> : geracao.objetivo}</h1>
            {titulo !== null && !repeteTitulo(titulo, geracao.objetivo) && <p className="introducao">{geracao.objetivo}</p>}
            <p className="geracao-ia">{origemDemonstracao(proposta.origem) ? mensagens.geracao.demonstracao : mensagens.geracao.ia}</p>
            {!origemDemonstracao(proposta.origem) && <p className="geracao-origem">{mensagens.geracao.origem(origemLegivel(proposta.origem))}</p>}
            {existente && (
              <div className="geracao-repetida" role="status">
                <p>{mensagens.geracao.repetida(existente.titulo)}</p>
                <Botao variante="secundario" disabled={ocupado} onClick={() => abrirExistente(existente.id)}>{mensagens.geracao.abrirExistente}</Botao>
              </div>
            )}
          </div>
        </header>
      ) : (
        // A faixa de 52 presa no alto: o pedido numa linha e a contagem (o título e de onde veio voltam no cartão, no alto).
        <div className="geracao-faixa" ref={faixa}>
          <h1 className="geracao-faixa__nome" tabIndex={-1}>{geracao.objetivo}</h1>
          <span className="geracao-faixa__contagem" aria-hidden="true">{contagemDaFaixa}</span>
        </div>
      )}
      {/* A placa do Stu, presa logo abaixo da faixa, por cima do mapa (o leitor de tela já ouve cada lição e o fim). */}
      <div className="geracao-placa-lugar" data-sem-faixa={(pronta && cartaoDeVolta) || undefined} aria-hidden="true">
        <div className="geracao-placa" ref={placa}>
          <p className="geracao-placa__texto">{placaTexto}</p>
          {pronta ? <p className="geracao-placa__linha">{mensagens.geracao.placaProntaTexto}</p>
            : !esperaLonga && <DicaDaPlaca />}
        </div>
      </div>
      <Caminho nos={nos} stu={pronta ? mensagens.geracao.stuPronta : mensagens.geracao.stuMontando}
        chegada={pronta} montando={!pronta} acompanhada maisUma={maisUma} stuNoFim={pronta} festaPermitida={acompanhando || trofeuAVista} />
      {pilula && (
        <button type="button" className="geracao-pilula" onClick={verLicaoNova}>
          <Icone nome="seta" />{pronta ? mensagens.geracao.verFimDaTrilha : mensagens.geracao.verLicaoNova(total)}
        </button>
      )}
      <div className="geracao-acoes" ref={rodape} data-pronta={pronta || undefined}>
        <Botao key="voltar" variante="secundario" disabled={ocupado} onClick={pronta ? ajustar : cancelar}>
          {pronta ? mensagens.geracao.ajustar : mensagens.geracao.cancelar}
        </Botao>
        <p className="geracao-situacao">
          <span className="geracao-situacao__rotulo">{pronta ? mensagens.geracao.pronta : mensagens.geracao.montando}</span>{' '}
          <span className="geracao-situacao__contagem">{contagem}</span>
        </p>
        {pronta && proposta && <Botao key="comecar" ref={botaoComecar} disabled={ocupado} onClick={() => comecar(proposta)}>{mensagens.geracao.comecar}</Botao>}
      </div>
      <p className="somente-leitor" role="status" aria-live="polite">{anuncio}</p>
    </section>
  );
}

/** As dicas da placa, que se revezam a cada 3,6 s (14/20 em #0B1B5C, banca da noite, item 6). */
function DicaDaPlaca() {
  const dicas = mensagens.geracao.dicas;
  const [indice, setIndice] = useState(0);
  useEffect(() => {
    if (dicas.length < 2) return;
    const intervalo = window.setInterval(() => setIndice((atual) => (atual + 1) % dicas.length), 3600);
    return () => window.clearInterval(intervalo);
  }, [dicas.length]);
  return <p className="geracao-placa__linha" key={indice}>{dicas[indice]}</p>;
}

/**
 * Começar: o aceite salva a trilha e a IA escreve a explicação, o exemplo e o exercício de cada lição, o que leva alguns
 * segundos com a IA real. No lugar de um esqueleto, o Stu escreve as lições da trilha da pessoa e dicas se revezam.
 * O aceite é um pedido só, sem andamento por lição, então nenhuma lição ganha o visto antes da hora: o brilho que desce
 * pela lista só diz que a escrita está acontecendo. Quando o aceite volta (`prontas`), o visto passa por todas.
 */
function PreparandoLicoes({ proposta, prontas }: { proposta: PropostaPlano; prontas: boolean }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const [dica, setDica] = useState(0);
  const dicas = mensagens.geracao.dicas;
  const licoes = proposta.fluxos.flatMap((fluxo) => fluxo.licoes.map((licao) => licao.titulo));

  // A tela começa do topo (a trilha gerada podia estar rolada até o fim) e, como o botão Começar sai da tela, o foco vem
  // para o título, que diz o que está acontecendo.
  useEffect(() => {
    voltarAoTopo();
    titulo.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (prontas) return;
    const intervalo = window.setInterval(() => setDica((atual) => (atual + 1) % dicas.length), 3600);
    return () => window.clearInterval(intervalo);
  }, [prontas, dicas.length]);

  // Quando as lições não cabem na tela, a lista acompanha (spec 04, revisão de 19/11): o brilho que desce leva a rolagem,
  // com a linha do brilho a 60% da altura; quando o aceite volta, o visto passa de linha em linha a cada 80 ms, até a última.
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const itens = lista.current ? Array.from(lista.current.children) as HTMLElement[] : [];
    if (itens.length === 0) return;
    const naoCabe = () => (itens[itens.length - 1].getBoundingClientRect().bottom > window.innerHeight);
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const levar = (indice: number) => {
      const item = itens[Math.min(indice, itens.length - 1)];
      const caixa = item.getBoundingClientRect();
      const alvo = caixa.top + caixa.height / 2 + window.scrollY - window.innerHeight * RITMO_DA_GERACAO.linhaDoBrilho;
      window.scrollTo({ top: Math.max(0, alvo), behavior: reduzido ? 'auto' : 'smooth' });
    };
    if (!naoCabe()) return;
    let linha = 0;
    const passo = prontas ? RITMO_DA_GERACAO.vistoPorLinhaMs : 200;
    const comeco = window.setTimeout(() => {
      levar(0);
      const intervalo = window.setInterval(() => {
        linha += 1;
        if (linha >= itens.length) { window.clearInterval(intervalo); return; }
        levar(linha);
      }, passo);
      relogio.current = intervalo;
    }, prontas ? 0 : 600);
    const relogio = { current: 0 };
    return () => { window.clearTimeout(comeco); window.clearInterval(relogio.current); };
  }, [prontas]);

  return (
    <section className="painel painel--preparo" data-prontas={prontas || undefined}>
      <div className="preparo-cena" style={coresDaRegiao(0)} aria-hidden="true">
        <span className="preparo-cena__colina" />
        <Desenho nome="arvore" />
        <Desenho nome="flores" />
        <Desenho nome="arbusto" />
        {/* O notebook da pose conta a história (o lápis e as folhas desenhados saíram, spec 13 §A2). Escrevendo: laço; em
            "Lições prontas!", comemora com o pulo. */}
        {prontas
          ? <Stu expressao="stu-comemorando" tamanho={110} animado="acontecimento" acontecimento="prontas" sombra />
          : <Stu expressao="stu-estudando" tamanho={132} animado="laco" sombra />}
      </div>
      <p className="contexto-tela">{proposta.titulo}</p>
      <h1 ref={titulo} tabIndex={-1}>{prontas ? mensagens.preparo.prontas : mensagens.preparo.titulo}</h1>
      <p className="introducao">{prontas ? mensagens.preparo.textoProntas : mensagens.preparo.texto}</p>
      <ol className="preparo-lista" ref={lista} aria-label={mensagens.preparo.lista}>
        {licoes.map((nome, indice) => (
          <li key={indice} style={{ '--ordem': indice } as CSSProperties}>
            <span className="preparo-lista__icone">
              <Icone nome={nome.trim().toLocaleLowerCase('pt-BR').startsWith('revis') ? 'revisao' : 'livro'} />
            </span>
            <span className="preparo-lista__titulo">{nome}</span>
          </li>
        ))}
      </ol>
      <p key={dica} className="preparo-dica" aria-hidden="true" style={prontas ? { visibility: 'hidden' } : undefined}><Icone nome="lampada" />{dicas[dica]}</p>
      <p className="somente-leitor" role="status">{prontas ? mensagens.preparo.anuncioProntas : mensagens.preparo.anuncio}</p>
    </section>
  );
}

/** Carregando a lição: a forma da aula (topo, título, quadro e rodapé), sem spinner (DESIGN §7). */
function SkeletonLicao({ texto }: { texto: string }) {
  return (
    <div className="painel painel--aula skeleton-licao" role="status">
      <p className="somente-leitor">{texto}</p>
      <div className="aula-topo" aria-hidden="true">
        <span className="skeleton-licao__fechar" />
        <span className="skeleton-licao__progresso" />
      </div>
      <div className="aula-miolo" aria-hidden="true">
        <span className="skeleton-licao__titulo" />
        <span className="skeleton-licao__linha" />
        <div className="aula-quadro skeleton-licao__quadro">
          <span /><span /><span /><span />
        </div>
      </div>
      <div className="aula-rodape" aria-hidden="true">
        <div className="aula-rodape__conteudo"><span className="skeleton-licao__botao" /></div>
      </div>
    </div>
  );
}

/** O pedido aparece sob o título só quando acrescenta algo: num objetivo curto, o título pode ser o próprio pedido. */
function repeteTitulo(titulo: string | null, objetivo: string) {
  const comparavel = (texto: string) => texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  return titulo !== null && comparavel(titulo) === comparavel(objetivo);
}

/**
 * Próxima lição do caminho: a `proximaLicaoId` do primeiro trecho que ainda tem lição pendente.
 * Como cada trecho aponta a sua primeira lição não concluída, é a primeira pendente na ordem da trilha.
 */
function proximaDoCaminho(plano: PlanoDetalhe) {
  return plano.fluxos.find((fluxo) => fluxo.proximaLicaoId)?.proximaLicaoId ?? null;
}

/** Lição que a conclusão liberou no caminho, para o nó animar quando a pessoa volta à trilha. */
function liberadasEntre(antes: PlanoDetalhe, depois: PlanoDetalhe) {
  const proxima = proximaDoCaminho(depois);
  return proxima && proxima !== proximaDoCaminho(antes) ? [proxima] : [];
}

/**
 * Achata os trechos num caminho único, na ordem da trilha. Só a próxima lição fica disponível (atual);
 * as pendentes depois dela ficam bloqueadas e as concluídas podem ser refeitas.
 */
function montarTrilha(plano: PlanoDetalhe) {
  const atual = proximaDoCaminho(plano);
  const nos = plano.fluxos.flatMap((fluxo, trecho) => fluxo.licoes.map((licao): NoCaminho => {
    let estado: NoCaminho['estado'] = 'bloqueada';
    if (licao.concluida) estado = 'concluida';
    else if (licao.id === atual) estado = 'atual';
    return {
      id: licao.id, titulo: licao.titulo, estado, trecho, ponte: licao.ponte,
      ...(estado === 'atual' && temAndamento(licao.id) ? { andamento: true } : {}),
      ...(licao.rever ? { rever: licao.rever } : {}),
    };
  }));
  const indice = nos.findIndex((no) => no.estado === 'atual');
  const proximo = indice >= 0 ? { no: nos[indice], posicao: mensagens.trilha.posicao(indice + 1, nos.length) } : null;
  return { nos, proximo };
}

function Plano({ tela, ocupado, abrindo, precarregarLicao, abrirLicao, novoPlano, compartilhar, configurar, anunciar }: {
  tela: TelaPlano;
  anunciar: (texto: string) => void;
  ocupado: boolean;
  abrindo: string | null;
  precarregarLicao: (id: string) => void;
  abrirLicao: (id: string) => void;
  novoPlano: () => void;
  compartilhar?: () => void;
  configurar?: () => void;
}) {
  const { plano, origem, liberadas = [] } = tela;
  const { nos, proximo } = useMemo(() => montarTrilha(plano), [plano]);
  // Ao abrir (ou recarregar), a tela vai até a lição atual; na volta de uma lição, até a liberada.
  const rolarPara = origem ? liberadas[0] ?? proximo?.no.id ?? origem : proximo?.no.id ?? null;
  const concluidas = nos.filter((no) => no.estado === 'concluida').length;
  let falaStu: string = mensagens.trilha.stuMeio;
  if (!proximo) falaStu = mensagens.trilha.stuFim;
  else if (concluidas === 0 && proximo.no.andamento) falaStu = mensagens.trilha.stuInicioEmAndamento;
  else if (concluidas === 0) falaStu = mensagens.trilha.stuInicio;

  useEffect(() => {
    if (proximo?.no.id) precarregarLicao(proximo.no.id);
  }, [proximo?.no.id, precarregarLicao]);

  return (
    <section className="painel painel--trilha">
      {plano.capa && <CapaDaTrilha semente={plano.id} tema={plano.tema ?? null} capa={plano.capa} className="trilha-capa" grande />}
      <header className="trilha-topo">
        <div className="trilha-topo__texto">
          <p className="trilha-topo__rotulo">{mensagens.trilha.suaTrilha}</p>
          <h1 tabIndex={-1}>{plano.titulo}</h1>
          {plano.recebida ? (
            <div className="trilha-recebida">
              {plano.recebida.foto && <Avatar nome={plano.recebida.nome} cor="azul" foto={plano.recebida.foto} />}
              <span>{plano.recebida.perfilId
                ? <>{mensagens.compartilhar.recebidaDe(plano.recebida.nome).slice(0, -plano.recebida.nome.length)}<a href={`/p/${plano.recebida.perfilId}`}>{plano.recebida.nome}</a></>
                : mensagens.compartilhar.recebidaDe(plano.recebida.nome)}</span>
              {plano.recebida.codigoAtivo && <a href={`/t/${plano.recebida.codigoAtivo}`}>{mensagens.compartilhar.verOriginal}</a>}
              {/* Com a comunidade e o link original ativo, o botão de curtir mora aqui também. */}
              {plano.recebida.codigoAtivo && plano.recebida.valeus !== undefined && (
                <CurtirTrilhaRecebida codigo={plano.recebida.codigoAtivo} titulo={plano.titulo} donoNome={plano.recebida.nome}
                  curtido={Boolean(plano.recebida.valeuMeu)} curtidas={plano.recebida.valeus} anunciar={anunciar} />
              )}
            </div>
          ) : null}
          <div className="trilha-topo__acoes">
            {!plano.recebida && compartilhar && (
              <Botao variante="secundario" className="trilha-compartilhar" disabled={ocupado} aria-label={mensagens.compartilhar.entradaRotulo(plano.titulo)} onClick={compartilhar}>
                <Icone nome="compartilhar" />{plano.link ? mensagens.compartilhar.selo : mensagens.compartilhar.entrada}
              </Botao>
            )}
            {/* A engrenagem leva às configurações da trilha (capa, nome, descrição, tema, quem pode ver, apagar). */}
            {configurar && (
              <Botao variante="secundario" className="trilha-configurar" disabled={ocupado} aria-label={mensagens.configuracoes.entradaRotulo(plano.titulo)} onClick={configurar}>
                <Icone nome="engrenagem" />
              </Botao>
            )}
          </div>
          {tela.aviso && <p className="trilha-aviso" role="status">{tela.aviso}</p>}
        </div>
        <AnelProgresso progresso={plano.progresso} />
      </header>
      {nos.length > 0 && !proximo && (
        <div className="trilha-concluida">
          <p className="trilha-concluida__titulo"><Icone nome="trofeu" />{mensagens.trilha.concluido}</p>
          <p>{mensagens.trilha.concluidoTexto}</p>
          <Botao disabled={ocupado} onClick={novoPlano}>{mensagens.planos.novo}</Botao>
          {compartilhar && <Botao variante="secundario" disabled={ocupado} onClick={compartilhar}><Icone nome="compartilhar" />{mensagens.compartilhar.concluidaAcao}</Botao>}
        </div>
      )}
      {nos.length > 0 ? (
        <Caminho nos={nos} stu={falaStu} ocupado={ocupado} abrindo={abrindo} liberadas={liberadas} rolarPara={rolarPara}
          recemConcluida={tela.concluida ?? null}
          aoAbrir={(no) => abrirLicao(no.id)} />
      ) : (
        <div className="trilha-vazia">
          <EstadoVazio>{mensagens.trilha.semLicoes}</EstadoVazio>
          <AcaoPrincipal><Botao disabled={ocupado} onClick={novoPlano}>{mensagens.planos.novo}</Botao></AcaoPrincipal>
        </div>
      )}
      {proximo && (
        <ProximoPasso titulo={proximo.no.titulo} detalhe={proximo.posicao} abrindo={abrindo === proximo.no.id} andamento={proximo.no.andamento}
          ocupado={ocupado} aoAbrir={() => abrirLicao(proximo.no.id)} />
      )}
    </section>
  );
}

/** Anel de progresso do plano: enche em volta do número de lições concluídas. */
function AnelProgresso({ progresso }: { progresso: Progresso }) {
  const texto = mensagens.planos.contagem(progresso.concluidas, progresso.total);
  const valor = progresso.percentual ?? 0;
  return (
    <div className="anel" role="progressbar" aria-label={texto} aria-valuemin={0} aria-valuemax={progresso.total}
      aria-valuenow={progresso.concluidas} style={{ '--valor': `${valor}%` } as CSSProperties}>
      <span className="anel__numero" aria-hidden="true">{progresso.concluidas}<small>/{progresso.total}</small></span>
    </div>
  );
}

/** Plano para abrir ao entrar: o que está em andamento, senão o primeiro ainda não concluído, senão o mais recente. */
function planoInicial(planos: PlanoResumo[]) {
  return planos.find(({ progresso: p }) => p.concluidas > 0 && p.concluidas < p.total)
    ?? planos.find(({ progresso: p }) => p.concluidas < p.total)
    ?? planos[0] ?? null;
}

/** Próxima lição do plano; no celular vira o rodapé fixo da tela. */
function ProximoPasso({ titulo, detalhe, abrindo, ocupado, aoAbrir, andamento = false }: {
  titulo: string;
  detalhe: string;
  andamento?: boolean;
  abrindo: boolean;
  ocupado: boolean;
  aoAbrir: () => void;
}) {
  const idTitulo = useId();

  return (
    <div className="trilha-proximo">
      <p className="trilha-proximo__rotulo">{mensagens.trilha.proxima}</p>
      <p className="trilha-proximo__titulo" id={idTitulo}>{titulo}</p>
      <p className="trilha-proximo__detalhe">{detalhe}</p>
      <Botao disabled={ocupado} aria-describedby={idTitulo} onClick={aoAbrir}>
        {abrindo ? mensagens.trilha.abrindo : andamento ? mensagens.trilha.continuarLicao : mensagens.trilha.comecarLicao}
      </Botao>
    </div>
  );
}

/** Número que conta de zero até o valor, uma vez; com movimento reduzido, já mostra o valor. */
function Contador({ valor, formatar }: { valor: number; formatar: (valor: number) => string }) {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAtual(valor);
      return;
    }
    const comeco = performance.now();
    let quadro = 0;
    function passo(agora: number) {
      const fracao = Math.min(1, (agora - comeco) / 900);
      setAtual(Math.round(valor * (1 - (1 - fracao) ** 3)));
      if (fracao < 1) quadro = window.requestAnimationFrame(passo);
    }
    quadro = window.requestAnimationFrame(passo);
    return () => window.cancelAnimationFrame(quadro);
  }, [valor]);

  return <>{formatar(atual)}</>;
}

/**
 * Lição concluída: chuva de confete, o Stu pulando, o resumo da lição (tempo, acerto e etapas), a lição liberada e o
 * progresso do plano, que enche a partir de onde estava. Tela inteira, como a aula.
 */
function LicaoConcluida({ plano, antes, licao, liberadas, resumo, ocupado, abrirLicao, voltar, novoAssunto, compartilhar }: {
  plano: PlanoDetalhe;
  antes: Progresso;
  licao: LicaoDetalhe;
  liberadas: string[];
  resumo?: ResumoLicao;
  ocupado: boolean;
  abrirLicao: (id: string) => void;
  voltar: () => void;
  novoAssunto: () => void;
  compartilhar?: () => void;
}) {
  const proxima = proximaDoCaminho(plano);
  const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);
  const textos = mensagens.licao.resumo;
  // A última lição fecha a trilha: a comemoração é da trilha inteira.
  const trilhaFeita = plano.progresso.total > 0 && plano.progresso.concluidas === plano.progresso.total;
  // Banca da noite, item 4: "O que você praticou" e as frases ficam recolhidos atrás de um botão de texto, que abre no lugar.
  const [praticouAberto, setPraticouAberto] = useState(false);
  const temFrases = Boolean(licao.falas && licao.falas.length > 0);
  const praticou = useRef<HTMLDivElement>(null);
  // O botão some ao abrir: o foco vai para o que abriu, no lugar dele.
  useEffect(() => { if (praticouAberto) praticou.current?.focus({ preventScroll: true }); }, [praticouAberto]);

  return (
    <section className="painel painel--concluida" data-trilha={trilhaFeita || undefined}>
      {/* Sem chuva de confete quando ficou exercício sem acerto ou a prática não saiu: a conclusão vira um lembrete gentil. */}
      {!(resumo && (resumo.acertos < resumo.exercicios || resumo.pratica === 'ainda_nao')) && <Confete chuva quantidade={44} />}
      <div className="conclusao-cena" aria-hidden="true" data-trilha={trilhaFeita || undefined}>
        <span className="conclusao-raios" />
        {/* Trilha concluída: o Stu com o troféu; lição: comemora ou, com exercício sem acerto ou prática que não saiu,
            encoraja. Dois ciclos no acontecimento (spec 13, E1); depois, a imagem parada. */}
        <Mascote expressao={trilhaFeita ? 'stu-celebrando' : resumo && (resumo.acertos < resumo.exercicios || resumo.pratica === 'ainda_nao') ? 'stu-encorajador' : 'stu-comemorando'}
          tamanho={trilhaFeita ? 165 : 140} sombra prioridade animado="acontecimento" acontecimento={licao.id} ciclos={2} className="stu" />
        {/* Sem o selo de visto sobre o Stu (banca da noite, item 4): a expressão e o título já dizem. */}
      </div>
      <h1 tabIndex={-1}>{trilhaFeita ? mensagens.licao.trilhaConcluida : mensagens.licao.concluida}</h1>
      <p className="conclusao-texto">{trilhaFeita ? mensagens.licao.trilhaConcluidaTexto(plano.titulo) : mensagens.licao.comemoracao}</p>
      <p className="conclusao-licao">{licao.titulo}</p>
      {trilhaFeita && <p className="conclusao-trilha"><Icone nome="trofeu" />{mensagens.licao.trilhaResumo(plano.progresso.total, plano.fluxos.length, plano.estatisticas)}</p>}
      {resumo && trilhaFeita && <p className="conclusao-numeros__legenda">{textos.ultimaLicao}</p>}
      {resumo && (
        <ul className="conclusao-numeros" aria-label={trilhaFeita ? `${textos.titulo}: ${textos.ultimaLicao}` : textos.titulo}>
          <li data-tipo="tempo">
            <span className="conclusao-numeros__rotulo"><Icone nome="relogio" />{textos.tempo}</span>
            <span className="conclusao-numeros__valor"><Contador valor={resumo.segundos} formatar={formatarTempo} /></span>
          </li>
          <li data-tipo="acerto" data-primeira={resumo.dePrimeira || undefined}>
            <span className="conclusao-numeros__rotulo"><Icone nome="alvo" />{textos.acerto}</span>
            <span className="conclusao-numeros__valor">{textos.acertos(resumo.acertosDePrimeira, resumo.exercicios)}</span>
          </li>
          <li data-tipo="etapas">
            <span className="conclusao-numeros__rotulo"><Icone nome="check" />{textos.etapas}</span>
            <span className="conclusao-numeros__valor">{textos.etapasFeitas(resumo.etapas)}</span>
          </li>
          {resumo.pratica && (
            <li data-tipo="pratica" data-valor={resumo.pratica}>
              <span className="conclusao-numeros__rotulo"><Icone nome="relogio" />{textos.pratica}</span>
              <span className="conclusao-numeros__valor">{mensagens.licao.pratica.opcoes[resumo.pratica]}</span>
            </li>
          )}
        </ul>
      )}
      {resumo?.rever && (
        <p className="conclusao-rever">
          <Icone nome="revisao" />
          {textoParaRever(resumo)}
        </p>
      )}
      {!praticouAberto && (
        <button type="button" className="conclusao-ver-praticou" onClick={() => setPraticouAberto(true)}>{mensagens.licao.historia.verPraticou}</button>
      )}
      {praticouAberto && (
        <div className="conclusao-praticou" ref={praticou} tabIndex={-1}>
          <ul className="conclusao-historia" aria-label={mensagens.licao.historia.titulo}>
            <li>
              <strong>{mensagens.licao.historia.praticou}</strong>
              <p>{licao.objetivo}</p>
            </li>
            {resumo?.ponteConstruida && (
              <li data-tipo="ponte">
                <strong>{mensagens.licao.historia.ponteTitulo}</strong>
                <p>{mensagens.licao.historia.ponteTexto}</p>
              </li>
            )}
            {resumo?.ensinouStu && (
              <li data-tipo="ensino">
                <strong>{mensagens.licao.historia.ensinoTitulo}</strong>
                <p>{mensagens.licao.historia.ensinoTexto}</p>
              </li>
            )}
          </ul>
          {/* Lição de idioma: as frases que a pessoa aprendeu, logo depois do resumo (no fim, ficavam atrás dos botões fixos). */}
          {temFrases && licao.falas && <FrasesDaLicao falas={licao.falas} />}
        </div>
      )}
      <p className="conclusao-sincronia">{mensagens.licao.historia.sincronia}</p>
      {liberada && <p className="conclusao-liberada"><Icone nome="livro" />{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</p>}
      <div className="conclusao-progresso">
        <h2>{mensagens.planos.progressoPlano}</h2>
        <BarraProgresso progresso={plano.progresso} de={antes} comPercentual />
      </div>
      <div className="acoes-tela" data-tres={trilhaFeita || undefined}>
        <AcaoPrincipal>
          {trilhaFeita ? (
            // Trilha concluída (banca da noite, item 4): compartilhar é o principal (quando a pessoa pode), o assunto novo o
            // secundário (ou o principal, sem compartilhar) e voltar à trilha um botão de texto.
            <>
              {compartilhar && <Botao disabled={ocupado} onClick={compartilhar}><Icone nome="compartilhar" />{mensagens.compartilhar.concluidaAcao}</Botao>}
              <Botao variante={compartilhar ? 'secundario' : 'primario'} disabled={ocupado} onClick={novoAssunto}>{mensagens.licao.novoAssunto}</Botao>
              <Botao variante="texto" disabled={ocupado} onClick={voltar}>{mensagens.licao.voltar}</Botao>
            </>
          ) : (
            // Lição concluída: como antes; com uma próxima lição, seguir é a ação principal e voltar à trilha a alternativa.
            <>
              <Botao variante={proxima ? 'secundario' : 'primario'} disabled={ocupado} onClick={voltar}>{mensagens.licao.voltar}</Botao>
              {proxima && <Botao disabled={ocupado} onClick={() => abrirLicao(proxima)}>{mensagens.licao.avancar}</Botao>}
            </>
          )}
        </AcaoPrincipal>
      </div>
    </section>
  );
}

/** Diálogo de confirmação no próprio produto: foco preso, Esc cancela e devolve o foco ao botão de origem. */
function ConfirmacaoModal({ mensagem, confirmarRotulo, destrutivo = false, ocupado, aoCancelar, aoConfirmar }: {
  mensagem: string;
  confirmarRotulo: string;
  destrutivo?: boolean;
  ocupado: boolean;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}) {
  const tituloId = useId();
  const acoesRef = useRef<HTMLDivElement>(null);
  const aoCancelarRef = useRef(aoCancelar);
  aoCancelarRef.current = aoCancelar;

  useEffect(() => {
    const botoesIniciais = Array.from(acoesRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    botoesIniciais[0]?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        aoCancelarRef.current();
        return;
      }
      if (evento.key !== 'Tab') return;
      const botoes = Array.from(acoesRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (botoes.length < 2) return;
      const atual = document.activeElement;
      if (evento.shiftKey && atual === botoes[0]) {
        evento.preventDefault();
        botoes[botoes.length - 1].focus();
      } else if (!evento.shiftKey && atual === botoes[botoes.length - 1]) {
        evento.preventDefault();
        botoes[0].focus();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  return (
    <div className="modal-fundo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) aoCancelar(); }}>
      <div className="modal-cartao" role="dialog" aria-modal="true" aria-labelledby={tituloId}>
        <p id={tituloId} className="modal-mensagem">{mensagem}</p>
        <div className="modal-acoes" ref={acoesRef}>
          <Botao variante="secundario" disabled={ocupado} onClick={aoCancelar}>
            {mensagens.geracao.cancelar}
          </Botao>
          <Botao variante={destrutivo ? 'secundario' : 'primario'} className={destrutivo ? 'modal-confirmar--destrutivo' : undefined} disabled={ocupado} onClick={aoConfirmar}>
            {confirmarRotulo}
          </Botao>
        </div>
      </div>
    </div>
  );
}
