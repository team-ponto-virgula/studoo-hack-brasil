'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ErroStudoo,
  origemDemonstracao,
  origemLegivel,
  trilhaRepetida,
  type AutoAvaliacao,
  type LicaoDetalhe,
  type PlanoDetalhe,
  type PlanoResumo,
  type Progresso,
  type PropostaPlano,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
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
  Skeleton,
  SkeletonTrilha,
  Stu,
  coresDaRegiao,
  regiaoDoTrecho,
  type NoCaminho,
} from '../ui';
import { Apresentacao, marcarApresentacaoVista } from './apresentacao';
import { aplicarEvento, gerarTrilhaAoVivo, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { FrasesDaLicao, Licao, formatarTempo, temAndamento, temAndamentoNoPlano, type ResumoLicao } from './aula';
import { Pedido, type IdTema } from './pedido';
import './aula.css';
import './trilha.css';

type Tela =
  | { tipo: 'apresentacao'; primeiraVez: boolean }
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'geracao' }
  /** `concluida`: a lição que a pessoa acabou de concluir, para o caminho comemorar no nó dela. */
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[]; concluida?: string }
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
  const [erro, setErro] = useState<string | null>(null);
  const [tela, setTela] = useState<Tela>({ tipo: 'planos' });
  const [planos, setPlanos] = useState<PlanoResumo[]>([]);
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

  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem('studoo.rascunho.objetivo');
      if (salvo) {
        setObjetivo(salvo);
        sessionStorage.removeItem('studoo.rascunho.objetivo');
      }
    } catch { /* Sem armazenamento local: segue sem rascunho. */ }
  }, []);

  const irParaLogin = useCallback((expirada = false) => {
    setInicio('carregando');
    if (expirada) {
      try {
        if (objetivoRef.current.trim()) sessionStorage.setItem('studoo.rascunho.objetivo', objetivoRef.current);
      } catch { /* Sem armazenamento local: segue sem rascunho. */ }
    }
    window.location.replace(expirada ? '/login?erro=nao_autenticado' : '/login');
  }, []);

  const carregar = useCallback(async (cancelado: () => boolean) => {
    setSincronia((anterior) => ({ estado: 'atualizando', em: anterior.em }));
    try {
      await cliente.sessao();
      const ativos = await cliente.listarPlanos();
      if (cancelado()) return;
      setPlanos(ativos);
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
      // Com planos salvos, abre direto na trilha em andamento, como os apps de estudo; senão, começa pelo pedido.
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
    if (inicio === 'pronto' && document.activeElement?.id !== 'objetivo') {
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
  function apagarPlano(plano: PlanoResumo) {
    origemConfirmacao.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmacao({
      mensagem: mensagens.planos.apagarPergunta(plano.titulo, mensagens.planos.contagem(plano.progresso.concluidas, plano.progresso.total)),
      confirmarRotulo: mensagens.planos.apagar,
      destrutivo: true,
      aoConfirmar: async () => {
        const resultado = await executar('apagar', () => cliente.apagarPlano(plano.id));
        if (!resultado.ok) return;
        setPlanos((anteriores) => anteriores.filter((item) => item.id !== plano.id));
        anunciar(mensagens.planos.apagada(plano.titulo));
      },
    });
  }

  function atualizarPlano(plano: PlanoDetalhe) {
    setPlanos((anteriores) => {
      const resumo = { id: plano.id, titulo: plano.titulo, progresso: plano.progresso };
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
        if (evento.tipo === 'pronto') {
          anunciar(mensagens.geracao.anuncioPronta(nosDaPrevia(trilha).length));
          return;
        }
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

  async function abrirPlano(id: string, origem?: string) {
    if (emExecucao.current) return;
    if (tela.tipo === 'geracao') navegar({ tipo: 'planos' });
    const resultado = await executar('plano', () => cliente.obterPlano(id));
    if (resultado.ok) {
      atualizarPlano(resultado.dados);
      navegar({ tipo: 'plano', plano: resultado.dados, origem });
    }
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
      atualizarPlano(atualizado);
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
  const comNavegacao = planos.length > 0 && ['planos', 'objetivo', 'plano'].includes(tela.tipo) && visivel;

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
        </nav>
        <div className="navegacao-rodape">
          <Botao variante="texto" onClick={() => navegar({ tipo: 'apresentacao', primeiraVez: false })} disabled={ocupado}>
            {mensagens.pedido.comoFunciona}
          </Botao>
        </div>
      </aside>

      <div className="estudo-pagina">
        <header className="estudo-cabecalho">
          <span className="estudo-identificacao">
            <span className="estudo-identificacao__contexto">
              {tela.tipo === 'objetivo' ? mensagens.planos.novo : tela.tipo === 'plano' ? tela.plano.titulo : mensagens.planos.titulo}
            </span>
            {inicio === 'pronto' && ((tela.tipo === 'planos' && planos.length > 0) || tela.tipo === 'plano') && (
              <SeloSincronia sincronia={sincronia} agora={agora} temProgresso={planos.length > 0} />
            )}
          </span>
          <div className="estudo-marca"><Logo /></div>
          <div className="estudo-conta">
            <Botao variante="texto" className="planos-movel" onClick={() => navegar({ tipo: 'planos' })} disabled={ocupado}>{mensagens.planos.titulo}</Botao>
            <Botao variante="texto" onClick={() => void sair()} disabled={ocupado}>{mensagens.sair}</Botao>
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
              comoFunciona={() => navegar({ tipo: 'apresentacao', primeiraVez: false })} />
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
                    ocupado={ocupado} abrir={() => void abrirPlano(destaque.id)} apagar={() => apagarPlano(destaque)} />
                )}
                {restantes.length > 0 && (
                  <>
                    <p className="planos-secao-titulo">{mensagens.planos.outrasTrilhas}</p>
                    <ul className="planos-ativos">
                      {restantes.map((plano, indice) => (
                        <li key={plano.id} style={{ '--ordem': indice } as CSSProperties}>
                          <CartaoPlano plano={plano} regiao={planos.findIndex((p) => p.id === plano.id)} ocupado={ocupado}
                            secundario abrir={() => void abrirPlano(plano.id)} apagar={() => apagarPlano(plano)} />
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
            <Plano tela={tela} ocupado={ocupado} abrindo={abrindo}
              precarregarLicao={(id) => { void obterLicaoComCache(id).catch(() => undefined); }}
              abrirLicao={(id) => void abrirLicao(tela.plano, id)}
              novoPlano={() => navegar({ tipo: 'objetivo' })} />
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
              novoAssunto={() => navegar({ tipo: 'objetivo' })} />
          )}
        </main>
        {comNavegacao && <nav className="navegacao-mobile" aria-label={mensagens.navegacao}>
          <button type="button" disabled={ocupado} aria-current={tela.tipo !== 'objetivo' ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'planos' })}><Icone nome="livro" />{mensagens.planos.titulo}</button>
          <button type="button" disabled={ocupado} aria-current={tela.tipo === 'objetivo' ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'objetivo' })}><Icone nome="lampada" />{mensagens.planos.novo}</button>
        </nav>}
      </div>
      {confirmacao && (
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
function CartaoDestaque({ plano, regiao, ocupado, abrir, apagar }: {
  plano: PlanoResumo;
  regiao: number;
  ocupado: boolean;
  abrir: () => void;
  apagar: () => void;
}) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0 && !temAndamentoNoPlano(plano.id)) acao = mensagens.planos.comecar;
  const enfeites = regiaoDoTrecho(Math.max(0, regiao)).enfeites;

  return (
    <article className="plano-destaque">
      <div className="plano-destaque__cena" style={coresDaRegiao(Math.max(0, regiao))} aria-hidden="true">
        <span className="plano-cartao__colina" />
        <Desenho nome={enfeites[0]} />
        <Desenho nome={enfeites[2]} />
        <Stu />
      </div>
      <div className="plano-destaque__corpo">
        <div className="plano-destaque__topo">
          <span className="plano-destaque__rotulo">{concluido ? mensagens.retomada.concluido : mensagens.retomada.titulo}</span>
        </div>
        <h2>{plano.titulo}</h2>
        <BarraProgresso progresso={plano.progresso} comPercentual />
      </div>
      <div className="plano-destaque__acoes">
        <Botao variante="primario" aria-label={`${acao}: ${plano.titulo}`} disabled={ocupado} onClick={abrir}>
          {acao}<Icone nome="seta" />
        </Botao>
        <MenuCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} />
      </div>
    </article>
  );
}

/** Menu discreto no cartão de trilha: fecha com Esc ou clique fora. */
function MenuCartao({ titulo, ocupado, apagar }: { titulo: string; ocupado: boolean; apagar: () => void }) {
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
      <button type="button" className="plano-cartao__apagar" aria-label={mensagens.planos.apagarRotulo(titulo)} disabled={ocupado}
        onClick={() => { if (detailsRef.current) detailsRef.current.open = false; apagar(); }}>
        {mensagens.planos.apagar}
      </button>
    </details>
  );
}

function CartaoPlano({ plano, regiao, ocupado, secundario = false, abrir, apagar }: {
  plano: PlanoResumo;
  regiao: number;
  ocupado: boolean;
  secundario?: boolean;
  abrir: () => void;
  apagar: () => void;
}) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0 && !temAndamentoNoPlano(plano.id)) acao = mensagens.planos.comecar;
  const enfeites = regiaoDoTrecho(Math.max(0, regiao)).enfeites;

  return (
    <article className="plano-cartao">
      <div className="plano-cartao__cena" style={coresDaRegiao(Math.max(0, regiao))} aria-hidden="true">
        <span className="plano-cartao__colina" />
        <Desenho nome={enfeites[0]} />
        <Desenho nome={enfeites[1]} />
        <Desenho nome={enfeites[3]} />
        <Desenho nome={enfeites[2]} />
        {concluido && <span className="plano-cartao__selo"><Icone nome="trofeu" />{mensagens.planos.concluido}</span>}
      </div>
      <div className="plano-cartao__corpo">
        <div>
          <h2>{plano.titulo}</h2>
          <BarraProgresso progresso={plano.progresso} />
        </div>
        <Botao variante={concluido || secundario ? 'secundario' : 'primario'} aria-label={`${acao}: ${plano.titulo}`} disabled={ocupado} onClick={abrir}>
          {acao}<Icone nome="seta" />
        </Botao>
        {/* Apagar fica em menu discreto para não competir com a ação principal do cartão. */}
        <MenuCartao titulo={plano.titulo} ocupado={ocupado} apagar={apagar} />
      </div>
    </article>
  );
}

/**
 * Geração ao vivo: a trilha vazia recebe primeiro o título e depois cada lição como nó do caminho, na ordem em que chegam.
 * O botão da esquerda é o mesmo do começo ao fim: Cancelar enquanto a IA monta e Ajustar pedido no fim; os dois voltam
 * ao pedido sem salvar nada. Começar aparece em outro lugar, então um toque atrasado em Cancelar não aceita a trilha.
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
  const nos = useMemo(() => nosDaPrevia(geracao), [geracao]);
  const { titulo, proposta } = geracao;
  const total = nos.length;

  return (
    <section className="painel painel--trilha painel--geracao">
      <header className="trilha-cabecalho">
        <div className="trilha-resumo">
          <p className="contexto-tela">{mensagens.geracao.contexto}</p>
          <h1 tabIndex={-1}>
            {titulo ? <span className="geracao-titulo" key={titulo}>{titulo}</span> : (
              <>
                <span className="somente-leitor">{mensagens.geracao.montandoTitulo}</span>
                <span className="geracao-esqueleto geracao-esqueleto--titulo" aria-hidden="true" />
              </>
            )}
          </h1>
          {titulo !== null && !repeteTitulo(titulo, geracao.objetivo) && <p className="introducao">{geracao.objetivo}</p>}
          {/* Quem montou: a IA ou o modo demonstração (trilha pronta). Enquanto não se sabe, um texto neutro. */}
          <p className="geracao-ia">
            {!proposta ? mensagens.geracao.montadaDoPedido : origemDemonstracao(proposta.origem) ? mensagens.geracao.demonstracao : mensagens.geracao.ia}
          </p>
          {/* A origem só aparece quando acrescenta algo: na trilha pronta, o aviso acima já diz de onde ela vem. */}
          {proposta
            ? !origemDemonstracao(proposta.origem) && <p className="geracao-origem">{mensagens.geracao.origem(origemLegivel(proposta.origem))}</p>
            : <span className="geracao-esqueleto geracao-esqueleto--origem" aria-hidden="true" />}
          {proposta && existente && (
            <div className="geracao-repetida" role="status">
              <p>{mensagens.geracao.repetida(existente.titulo)}</p>
              <Botao variante="secundario" disabled={ocupado} onClick={() => abrirExistente(existente.id)}>{mensagens.geracao.abrirExistente}</Botao>
            </div>
          )}
        </div>
      </header>
      <Caminho nos={nos} stu={proposta ? mensagens.geracao.stuPronta : mensagens.geracao.stuMontando} dicas={mensagens.geracao.dicas}
        chegada={proposta !== null} montando={proposta === null} />
      <div className="geracao-acoes" data-pronta={proposta ? true : undefined}>
        <Botao key="voltar" variante="secundario" disabled={ocupado} onClick={proposta ? ajustar : cancelar}>
          {proposta ? mensagens.geracao.ajustar : mensagens.geracao.cancelar}
        </Botao>
        <p className="geracao-situacao">
          <span className="geracao-situacao__rotulo">{proposta ? mensagens.geracao.pronta : mensagens.geracao.montando}</span>{' '}
          <span className="geracao-situacao__contagem">
            {proposta ? mensagens.geracao.contagemFinal(total) : mensagens.geracao.contagem(total)}
          </span>
        </p>
        {proposta && <Botao key="comecar" disabled={ocupado} onClick={() => comecar(proposta)}>{mensagens.geracao.comecar}</Botao>}
      </div>
    </section>
  );
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

  return (
    <section className="painel painel--preparo" data-prontas={prontas || undefined}>
      <div className="preparo-cena" style={coresDaRegiao(0)} aria-hidden="true">
        <span className="preparo-cena__colina" />
        <Desenho nome="arvore" />
        <Desenho nome="flores" />
        <Desenho nome="arbusto" />
        <span className="preparo-folha" />
        <span className="preparo-folha" />
        <span className="preparo-folha" />
        <Stu />
        <span className="preparo-lapis" />
      </div>
      <p className="contexto-tela">{proposta.titulo}</p>
      <h1 ref={titulo} tabIndex={-1}>{prontas ? mensagens.preparo.prontas : mensagens.preparo.titulo}</h1>
      <p className="introducao">{prontas ? mensagens.preparo.textoProntas : mensagens.preparo.texto}</p>
      <ol className="preparo-lista" aria-label={mensagens.preparo.lista}>
        {licoes.map((nome, indice) => (
          <li key={indice} style={{ '--ordem': indice } as CSSProperties}>
            <span className="preparo-lista__icone">
              <Icone nome={nome.trim().toLocaleLowerCase('pt-BR').startsWith('revis') ? 'revisao' : 'livro'} />
            </span>
            <span className="preparo-lista__titulo">{nome}</span>
          </li>
        ))}
      </ol>
      {!prontas && <p key={dica} className="preparo-dica" aria-hidden="true"><Icone nome="lampada" />{dicas[dica]}</p>}
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

function Plano({ tela, ocupado, abrindo, precarregarLicao, abrirLicao, novoPlano }: {
  tela: TelaPlano;
  ocupado: boolean;
  abrindo: string | null;
  precarregarLicao: (id: string) => void;
  abrirLicao: (id: string) => void;
  novoPlano: () => void;
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
      <header className="trilha-topo">
        <div className="trilha-topo__texto">
          <p className="trilha-topo__rotulo">{mensagens.trilha.suaTrilha}</p>
          <h1 tabIndex={-1}>{plano.titulo}</h1>
        </div>
        <AnelProgresso progresso={plano.progresso} />
      </header>
      {nos.length > 0 && !proximo && (
        <div className="trilha-concluida">
          <p className="trilha-concluida__titulo"><Icone nome="trofeu" />{mensagens.trilha.concluido}</p>
          <p>{mensagens.trilha.concluidoTexto}</p>
          <Botao disabled={ocupado} onClick={novoPlano}>{mensagens.planos.novo}</Botao>
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
function LicaoConcluida({ plano, antes, licao, liberadas, resumo, ocupado, abrirLicao, voltar, novoAssunto }: {
  plano: PlanoDetalhe;
  antes: Progresso;
  licao: LicaoDetalhe;
  liberadas: string[];
  resumo?: ResumoLicao;
  ocupado: boolean;
  abrirLicao: (id: string) => void;
  voltar: () => void;
  novoAssunto: () => void;
}) {
  const proxima = proximaDoCaminho(plano);
  const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);
  const textos = mensagens.licao.resumo;
  // A última lição fecha a trilha: a comemoração é da trilha inteira.
  const trilhaFeita = plano.progresso.total > 0 && plano.progresso.concluidas === plano.progresso.total;

  return (
    <section className="painel painel--concluida">
      {/* Sem chuva de confete quando ficou exercício sem acerto ou a prática não saiu: a conclusão vira um lembrete gentil. */}
      {!(resumo && (resumo.acertos < resumo.exercicios || resumo.pratica === 'ainda_nao')) && <Confete chuva quantidade={44} />}
      <div className="conclusao-cena" aria-hidden="true">
        <span className="conclusao-raios" />
        <Stu />
        <span className="conclusao-selo"><Icone nome="check" /></span>
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
      <p className="conclusao-sincronia">{mensagens.licao.historia.sincronia}</p>
      {/* Lição de idioma: as frases que a pessoa aprendeu, logo depois do resumo (no fim, ficavam atrás dos botões fixos). */}
      {licao.falas && licao.falas.length > 0 && <FrasesDaLicao falas={licao.falas} />}
      {liberada && <p className="conclusao-liberada"><Icone nome="livro" />{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</p>}
      <div className="conclusao-progresso">
        <h2>{mensagens.planos.progressoPlano}</h2>
        <BarraProgresso progresso={plano.progresso} de={antes} comPercentual />
      </div>
      <div className="acoes-tela">
        <AcaoPrincipal>
          {/* Com uma próxima lição, seguir é a ação principal; voltar à trilha fica como alternativa. */}
          {trilhaFeita && <Botao variante="secundario" disabled={ocupado} onClick={novoAssunto}>{mensagens.licao.novoAssunto}</Botao>}
          <Botao variante={proxima ? 'secundario' : 'primario'} disabled={ocupado} onClick={voltar}>{mensagens.licao.voltar}</Botao>
          {proxima && <Botao disabled={ocupado} onClick={() => abrirLicao(proxima)}>{mensagens.licao.avancar}</Botao>}
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
