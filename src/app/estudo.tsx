'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ErroStudoo,
  type Avaliacao,
  type LicaoDetalhe,
  type PlanoDetalhe,
  type PlanoResumo,
  type Progresso,
  type PropostaPlano,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens } from '../mensagens/pt-BR';
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
  type NomeIcone,
} from '../ui';
import { Apresentacao, marcarApresentacaoVista } from './apresentacao';
import { aplicarEvento, gerarTrilhaAoVivo, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import { ApoioDaLicao } from './estudio';
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
type Acao = 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string };

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
  const emExecucao = useRef(false);
  const geracaoAtiva = useRef<AbortController | null>(null);
  const principal = useRef<HTMLElement>(null);

  const irParaLogin = useCallback(() => {
    setInicio('carregando');
    window.location.replace('/login');
  }, []);

  const carregar = useCallback(async (cancelado: () => boolean) => {
    try {
      await cliente.sessao();
      const ativos = await cliente.listarPlanos();
      if (cancelado()) return;
      setPlanos(ativos);
      // Começa pela ação; a apresentação continua disponível em Ver como funciona.
      setInicio('pronto');
    } catch (falha) {
      if (cancelado()) return;
      const codigo = falha instanceof ErroStudoo ? falha.codigo : 'rede';
      if (codigo === 'nao_autenticado') {
        irParaLogin();
        return;
      }
      setErro(codigo);
      setInicio('falha');
    }
  }, [irParaLogin]);

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
    if (inicio === 'pronto') principal.current?.querySelector('h1')?.focus();
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
      if (codigo === 'nao_autenticado') irParaLogin();
      else setErro(codigo);
      return { ok: false, codigo };
    } finally {
      setPendente(null);
      emExecucao.current = false;
    }
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
        irParaLogin();
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

  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    if (emExecucao.current) return;
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

  async function sair() {
    const resultado = await executar('sair', () => cliente.logout());
    if (resultado.ok) irParaLogin();
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

  if (inicio !== 'pronto') {
    return (
      <main className="inicializacao" id="conteudo-principal">
        <Logo />
        {inicio === 'falha' && erro ? (
          <EstadoErro codigo={erro}>
            <Botao variante="secundario" onClick={() => {
              setInicio('carregando');
              setErro(null);
              void carregar(() => false);
            }}>{mensagens.tentarNovamente}</Botao>
          </EstadoErro>
        ) : <Skeleton />}
      </main>
    );
  }

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
            {planos.map((plano) => (
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
          <span className="estudo-identificacao">{mensagens.estudos}</span>
          <div className="estudo-marca"><Logo /></div>
          <div className="estudo-conta">
            <Botao variante="texto" className="planos-movel" onClick={() => navegar({ tipo: 'planos' })} disabled={ocupado}>{mensagens.planos.titulo}</Botao>
            <Botao variante="texto" onClick={() => void sair()} disabled={ocupado}>{mensagens.sair}</Botao>
          </div>
        </header>

        <main id="conteudo-principal" className="estudo-principal" tabIndex={-1} ref={principal} aria-busy={ocupado}>
          <p className="somente-leitor" role="status">{anuncio}</p>
          {erro && <EstadoErro codigo={erro} />}
          {carregandoTrilha && <SkeletonTrilha />}
          {carregandoLicao && (tela.tipo === 'geracao' && geracao?.proposta
            ? <PreparandoLicoes proposta={geracao.proposta} prontas={pendente === 'abrir'} />
            : <SkeletonLicao texto={mensagens.licao.carregando} />)}
          {visivel && tela.tipo === 'apresentacao' && (
            <Apresentacao primeiraVez={tela.primeiraVez} concluir={concluirApresentacao} />
          )}
          {visivel && (tela.tipo === 'objetivo' || tela.tipo === 'planos' && planos.length === 0) && (
            <Pedido onProposta={p => { navegar({ tipo: 'geracao' }); setGeracao({ objetivo: p.objetivo, titulo: p.titulo, fluxos: p.fluxos.map(f => ({ titulo: f.titulo, licoes: f.licoes.map(l => l.titulo) })), proposta: p }); }} objetivo={objetivo} ocupado={ocupado} aviso={aviso} falha={falhaGeracao} temPlanos={planos.length > 0} areaInicial={areaInicial}
              aoMudar={setObjetivo} anunciar={anunciar} gerar={(texto) => void gerar(texto)}
              verPlanos={() => navegar({ tipo: 'planos' })}
              comoFunciona={() => navegar({ tipo: 'apresentacao', primeiraVez: false })} />
          )}
          {visivel && tela.tipo === 'planos' && planos.length > 0 && (
            <section className="painel painel--planos">
              <h1 tabIndex={-1}>{mensagens.planos.titulo}</h1>
              <p className="introducao">{mensagens.planos.subtitulo}</p>
              <Retomada planos={planos} ocupado={ocupado} abrir={(id) => void abrirPlano(id)} />
              <ul className="planos-ativos">
                {planos.map((plano, indice) => (
                  <li key={plano.id} style={{ '--ordem': indice } as CSSProperties}>
                    <CartaoPlano plano={plano} regiao={indice} ocupado={ocupado} abrir={() => void abrirPlano(plano.id)} />
                  </li>
                ))}
              </ul>
              <AcaoPrincipal><Botao disabled={ocupado} onClick={() => navegar({ tipo: 'objetivo' })}>{mensagens.planos.novo}</Botao></AcaoPrincipal>
            </section>
          )}
          {visivel && tela.tipo === 'geracao' && geracao && (
            <GeracaoAoVivo geracao={geracao} ocupado={ocupado}
              cancelar={cancelarGeracao} comecar={(proposta) => void comecar(proposta)} ajustar={() => navegar({ tipo: 'objetivo' })} />
          )}
          {visivel && tela.tipo === 'plano' && (
            <Plano tela={tela} ocupado={ocupado} abrindo={abrindo}
              abrirLicao={(id) => void abrirLicao(tela.plano, id)}
              novoPlano={() => navegar({ tipo: 'objetivo' })} />
          )}
          {visivel && tela.tipo === 'licao' && (
            <Licao key={tela.licao.id} licao={tela.licao} pendente={pendente}
              avaliar={(resposta) => executar('avaliar', () => cliente.avaliarLicao(tela.licao.id, resposta))}
              concluir={(comprovante, resumo) => concluir(tela.plano, tela.licao, comprovante, resumo)}
              voltar={() => void abrirPlano(tela.plano.id, tela.licao.id)} />
          )}
          {visivel && tela.tipo === 'concluida' && (
            <LicaoConcluida plano={tela.plano} antes={tela.antes} licao={tela.licao} liberadas={tela.liberadas} resumo={tela.resumo} ocupado={ocupado}
              abrirLicao={(id) => void abrirLicao(tela.plano, id)}
              voltar={() => navegar({ tipo: 'plano', plano: tela.plano, origem: tela.licao.id, liberadas: tela.liberadas, concluida: tela.licao.id })} />
          )}
        </main>
        {comNavegacao && <nav className="navegacao-mobile" aria-label={mensagens.navegacao}>
          <button type="button" disabled={ocupado} aria-current={tela.tipo !== 'objetivo' ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'planos' })}><Icone nome="livro" />{mensagens.planos.titulo}</button>
          <button type="button" disabled={ocupado} aria-current={tela.tipo === 'objetivo' ? 'page' : undefined}
            onClick={() => navegar({ tipo: 'objetivo' })}><Icone nome="lampada" />{mensagens.planos.novo}</button>
        </nav>}
      </div>
    </div>
  );
}

/** Destaca uma trilha em andamento e o progresso real já salvo. */
function Retomada({ planos, ocupado, abrir }: { planos: PlanoResumo[]; ocupado: boolean; abrir: (id: string) => void }) {
  const emAndamento = planos.find(({ progresso: p }) => p.concluidas > 0 && p.concluidas < p.total)
    ?? planos.find(({ progresso: p }) => p.concluidas < p.total);
  const concluidas = planos.reduce((soma, plano) => soma + plano.progresso.concluidas, 0);
  return <section className="retomada" aria-label={mensagens.retomada.titulo}>
    <div className="retomada__simbolo" aria-hidden="true"><Icone nome={emAndamento ? 'bandeira' : 'trofeu'} /></div>
    <div className="retomada__texto">
      <p className="retomada__etiqueta">{emAndamento ? mensagens.retomada.titulo : mensagens.retomada.concluido}</p>
      {emAndamento && <h2>{emAndamento.titulo}</h2>}
      <p>{emAndamento ? mensagens.retomada.texto : mensagens.retomada.revisar}</p>
      <span className="retomada__conquista"><Icone nome="check" />{mensagens.retomada.licoes(concluidas)}</span>
    </div>
    {emAndamento && <Botao disabled={ocupado} onClick={() => abrir(emAndamento.id)}>{mensagens.retomada.acao}<Icone nome="seta" /></Botao>}
  </section>;
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
function CartaoPlano({ plano, regiao, ocupado, abrir }: { plano: PlanoResumo; regiao: number; ocupado: boolean; abrir: () => void }) {
  const { concluidas, total } = plano.progresso;
  const concluido = total > 0 && concluidas === total;
  let acao: string = mensagens.planos.continuar;
  if (concluido) acao = mensagens.planos.rever;
  else if (concluidas === 0) acao = mensagens.planos.comecar;
  const enfeites = regiaoDoTrecho(regiao).enfeites;

  return (
    <article className="plano-cartao">
      <div className="plano-cartao__cena" style={coresDaRegiao(regiao)} aria-hidden="true">
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
        <Botao variante={concluido ? 'secundario' : 'primario'} aria-label={`${acao}: ${plano.titulo}`} disabled={ocupado} onClick={abrir}>
          {acao}<Icone nome="seta" />
        </Botao>
      </div>
    </article>
  );
}

/**
 * Geração ao vivo: a trilha vazia recebe primeiro o título e depois cada lição como nó do caminho, na ordem em que chegam.
 * O botão da esquerda é o mesmo do começo ao fim: Cancelar enquanto a IA monta e Ajustar pedido no fim; os dois voltam
 * ao pedido sem salvar nada. Começar aparece em outro lugar, então um toque atrasado em Cancelar não aceita a trilha.
 */
function GeracaoAoVivo({ geracao, ocupado, cancelar, comecar, ajustar }: {
  geracao: TrilhaEmGeracao;
  ocupado: boolean;
  cancelar: () => void;
  comecar: (proposta: PropostaPlano) => void;
  ajustar: () => void;
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
          <p className="geracao-ia">{mensagens.geracao.ia}</p>
          {proposta
            ? <p className="geracao-origem">{mensagens.geracao.origem(proposta.origem)}</p>
            : <span className="geracao-esqueleto geracao-esqueleto--origem" aria-hidden="true" />}
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
              <Icone nome={prontas ? 'check' : nome.trim().toLocaleLowerCase('pt-BR').startsWith('revis') ? 'revisao' : 'livro'} />
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
    return { id: licao.id, titulo: licao.titulo, estado, trecho, ponte: licao.ponte };
  }));
  const indice = nos.findIndex((no) => no.estado === 'atual');
  const proximo = indice >= 0 ? { no: nos[indice], posicao: mensagens.trilha.posicao(indice + 1, nos.length) } : null;
  return { nos, proximo };
}

function Plano({ tela, ocupado, abrindo, abrirLicao, novoPlano }: {
  tela: TelaPlano;
  ocupado: boolean;
  abrindo: string | null;
  abrirLicao: (id: string) => void;
  novoPlano: () => void;
}) {
  const { plano, origem, liberadas = [] } = tela;
  const { nos, proximo } = useMemo(() => montarTrilha(plano), [plano]);
  const rolarPara = origem ? liberadas[0] ?? proximo?.no.id ?? origem : null;
  const concluidas = nos.filter((no) => no.estado === 'concluida').length;
  let falaStu: string = mensagens.trilha.stuMeio;
  if (!proximo) falaStu = mensagens.trilha.stuFim;
  else if (concluidas === 0) falaStu = mensagens.trilha.stuInicio;

  return (
    <section className="painel painel--trilha">
      <header className="trilha-cabecalho">
        <div className="trilha-resumo">
          <h1 tabIndex={-1}>{plano.titulo}</h1>
          {!repeteTitulo(plano.titulo, plano.objetivo) && <p className="introducao">{plano.objetivo}</p>}
          <div className="plano-progresso"><BarraProgresso progresso={plano.progresso} comPercentual /></div>
        </div>
        {proximo && (
          <ProximoPasso titulo={proximo.no.titulo} detalhe={proximo.posicao} abrindo={abrindo === proximo.no.id}
            ocupado={ocupado} aoAbrir={() => abrirLicao(proximo.no.id)} />
        )}
        {nos.length > 0 && !proximo && (
          <div className="trilha-concluida">
            <p className="trilha-concluida__titulo"><Icone nome="check" />{mensagens.trilha.concluido}</p>
            <p>{mensagens.trilha.concluidoTexto}</p>
            <AcaoPrincipal><Botao disabled={ocupado} onClick={novoPlano}>{mensagens.planos.novo}</Botao></AcaoPrincipal>
          </div>
        )}
      </header>
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
    </section>
  );
}

/** Próxima lição do plano; no celular vira o rodapé fixo da tela. */
function ProximoPasso({ titulo, detalhe, abrindo, ocupado, aoAbrir }: {
  titulo: string;
  detalhe: string;
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
        {abrindo ? mensagens.trilha.abrindo : mensagens.trilha.comecarLicao}
      </Botao>
    </div>
  );
}

const posicoesAula = { conceito: 1, exemplo: 2, exercicio: 3, feedback: 4 } as const;
type EtapaAula = 'conceito' | 'exemplo' | 'exercicio';
/** O que a pessoa fez na lição, para o resumo da conclusão: tempo, tentativas e se acertou de primeira. */
export type ResumoLicao = { segundos: number; tentativas: number; dePrimeira: boolean };

const iconesDaEtapa: Record<EtapaAula, NomeIcone> = { conceito: 'livro', exemplo: 'lampada', exercicio: 'alvo' };

/** Título do acerto: varia entre as lições, sem sorteio (a mesma lição tem sempre o mesmo). */
function tituloDoAcerto(id: string) {
  let soma = 0;
  for (const caractere of id) soma = (soma * 31 + caractere.charCodeAt(0)) >>> 0;
  return mensagens.licao.certas[soma % mensagens.licao.certas.length];
}

/**
 * Aula por etapas (spec 02): conceito, exemplo e exercício, uma de cada vez, com a barra de andamento no topo.
 * O conceito vem num balão do Stu. No exercício de escolha, as teclas 1, 2, 3… marcam a opção e Enter verifica.
 * Depois da resposta, o rodapé vira o painel de retorno, que sobe verde no acerto (com confete) ou âmbar no erro
 * (o exercício treme). No erro, dá para tentar de novo ou continuar; Continuar registra a conclusão.
 * O título de cada etapa e o do retorno recebem o foco. Se a confirmação expirar, a aula volta ao exercício.
 */
function Licao({ licao, pendente, avaliar, concluir, voltar }: {
  licao: LicaoDetalhe;
  pendente: Acao | null;
  avaliar: (resposta: string) => Promise<Resultado<Avaliacao>>;
  concluir: (comprovante: string, resumo: ResumoLicao) => Promise<boolean>;
  voltar: () => void;
}) {
  const [etapa, setEtapa] = useState<EtapaAula>('conceito');
  const [resposta, setResposta] = useState('');
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const [tentativas, setTentativas] = useState(0);
  const [dePrimeira, setDePrimeira] = useState<boolean | null>(null);
  const [inicio] = useState(() => Date.now());
  const tituloEtapa = useRef<HTMLHeadingElement>(null);
  const tituloRetorno = useRef<HTMLHeadingElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const continuarAgora = useRef<() => void>(() => undefined);
  const { exercicio } = licao;
  const ocupado = pendente !== null;
  const posicao = avaliacao?.correta ? posicoesAula.feedback : posicoesAula[etapa];
  const andamento = mensagens.licao.posicao(posicao, posicoesAula.feedback);
  const retorno = avaliacao ? (avaliacao.correta ? 'certa' : 'errada') : undefined;
  const nomeEtapa = { conceito: mensagens.licao.conceito, exemplo: mensagens.licao.exemplo, exercicio: mensagens.licao.exercicio }[etapa];

  useEffect(() => {
    if (etapa !== 'conceito') tituloEtapa.current?.focus();
  }, [etapa]);

  useEffect(() => {
    if (avaliacao) tituloRetorno.current?.focus();
  }, [avaliacao]);

  // Atalhos: no exercício de escolha, 1, 2, 3… marcam a opção; depois do retorno, Enter continua.
  useEffect(() => {
    function teclas(evento: KeyboardEvent) {
      if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
      const alvo = evento.target instanceof HTMLElement ? evento.target : null;
      if (alvo?.closest('.estudio-apoio')) return;
      if (avaliacao) {
        if (evento.key === 'Enter' && !alvo?.closest('button, a')) {
          evento.preventDefault();
          continuarAgora.current();
        }
        return;
      }
      if (etapa !== 'exercicio' || exercicio.tipo !== 'multipla_escolha' || alvo?.matches('input[type="text"], textarea')) return;
      const indice = Number.parseInt(evento.key, 10) - 1;
      if (indice >= 0 && indice < exercicio.opcoes.length) {
        evento.preventDefault();
        setResposta(exercicio.opcoes[indice].id);
      }
    }
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [etapa, avaliacao, exercicio]);

  async function responder(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || avaliacao || !resposta.trim()) return;
    const resultado = await avaliar(resposta);
    if (!resultado.ok) return;
    setTentativas((total) => total + 1);
    setDePrimeira((anterior) => anterior ?? resultado.dados.correta);
    setAvaliacao(resultado.dados);
  }

  function tentarDeNovo() {
    setAvaliacao(null);
    setResposta('');
    window.requestAnimationFrame(() => {
      const campo = formulario.current?.querySelector<HTMLInputElement>('input[type="text"], input:checked, input');
      campo?.focus();
    });
  }

  async function continuar(comprovante: string) {
    if (ocupado) return;
    const resumo = { segundos: Math.max(1, Math.round((Date.now() - inicio) / 1000)), tentativas, dePrimeira: dePrimeira === true };
    if (!await concluir(comprovante, resumo)) setAvaliacao(null);
  }

  continuarAgora.current = () => {
    if (avaliacao) void continuar(avaliacao.comprovante);
  };

  let acao;
  if (avaliacao) {
    acao = (
      <Botao variante={avaliacao.correta ? 'sucesso' : 'texto'} disabled={ocupado} onClick={() => void continuar(avaliacao.comprovante)}>
        {pendente === 'concluir' ? mensagens.licao.concluindo : mensagens.licao.continuar}
      </Botao>
    );
  } else if (etapa === 'exercicio') {
    acao = <Botao type="submit" form="resposta-licao" disabled={ocupado || !resposta.trim()}>{pendente === 'avaliar' ? mensagens.licao.avaliando : mensagens.licao.avaliar}</Botao>;
  } else {
    acao = (
      <Botao disabled={ocupado} onClick={() => setEtapa(etapa === 'conceito' ? 'exemplo' : 'exercicio')}>
        {mensagens.licao.seguir}<Icone nome="seta" />
      </Botao>
    );
  }

  return (
    <article className="painel painel--aula" data-retorno={retorno}>
      <header className="aula-topo">
        <button type="button" className="aula-fechar" aria-label={mensagens.licao.voltar} disabled={ocupado} onClick={voltar}>
          <Icone nome="fechar" />
        </button>
        <div className="aula-andamento">
          <div className="aula-barra" role="progressbar" aria-label={andamento} aria-valuemin={0} aria-valuemax={posicoesAula.feedback}
            aria-valuenow={posicao}>
            <span className="aula-barra__preenchimento" style={{ '--progresso': posicao / posicoesAula.feedback } as CSSProperties} />
          </div>
          <span className="aula-posicao" aria-hidden="true">{andamento}</span>
        </div>
      </header>
      <div className="aula-miolo" key={etapa}>
        <p className="aula-etapa" data-etapa={etapa}><Icone nome={iconesDaEtapa[etapa]} />{nomeEtapa}</p>
        <h1 tabIndex={-1}>{licao.titulo}</h1>
        {etapa === 'conceito' && (
          <>
            {licao.concluida && <p className="aula-revisao"><Icone nome="check" />{mensagens.trilha.revisitando}</p>}
            <p className="introducao">{licao.objetivo}</p>
            <div className="aula-explicacao">
              <Stu />
              <section className="aula-balao" aria-labelledby="etapa-aula">
                <h2 id="etapa-aula">{mensagens.licao.conceito}</h2>
                <p>{licao.conceito}</p>
                <p className="licao-origem">{mensagens.licao.origem} · {licao.origem}</p>
              </section>
            </div>
          </>
        )}
        {etapa === 'exemplo' && (
          <section className="aula-quadro" data-etapa="exemplo" aria-labelledby="etapa-aula">
            <h2 id="etapa-aula" ref={tituloEtapa} tabIndex={-1}>{mensagens.licao.exemplo}</h2>
            <p>{licao.exemplo}</p>
          </section>
        )}
        {etapa === 'exercicio' && (
          <section className="aula-quadro" data-etapa="exercicio" aria-labelledby="etapa-aula">
            <h2 id="etapa-aula" ref={tituloEtapa} tabIndex={-1}>{mensagens.licao.exercicio}</h2>
            <p>{exercicio.enunciado}</p>
            {exercicio.contexto && <p>{exercicio.contexto}</p>}
            {exercicio.trecho && <pre className="licao-codigo"><code>{exercicio.trecho}</code></pre>}
            <form id="resposta-licao" ref={formulario} className="formulario" method="post" onSubmit={responder}>
              {exercicio.tipo === 'lacuna' ? (
                <div className="campo campo--resposta">
                  <label htmlFor="resposta">{mensagens.licao.resposta}</label>
                  <input id="resposta" name="resposta" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
                    value={resposta} onChange={(evento) => setResposta(evento.target.value)} required disabled={ocupado}
                    readOnly={avaliacao !== null} data-retorno={retorno} />
                </div>
              ) : (
                <fieldset className="opcoes" disabled={ocupado || avaliacao !== null}>
                  <legend>{mensagens.licao.resposta}</legend>
                  {exercicio.opcoes.map((opcao, indice) => (
                    <label key={opcao.id} data-retorno={resposta === opcao.id ? retorno : undefined}>
                      <input type="radio" name="resposta" value={opcao.id} required checked={resposta === opcao.id}
                        onChange={() => setResposta(opcao.id)} />
                      <span className="opcao-tecla" aria-hidden="true">{indice + 1}</span>
                      <span>{opcao.texto}</span>
                    </label>
                  ))}
                  <p className="opcoes-atalho">{mensagens.licao.atalho(exercicio.opcoes.length)}</p>
                </fieldset>
              )}
            </form>
          </section>
        )}
      </div>
      {(etapa === 'exercicio' || avaliacao) && <ApoioDaLicao licao={licao} avaliacao={avaliacao} />}
      <footer className="aula-rodape" data-retorno={retorno}>
        <div className="aula-rodape__conteudo">
          {avaliacao && (
            <section className="aula-retorno" aria-labelledby="aula-retorno-titulo">
              <span className="aula-retorno__icone" aria-hidden="true">
                <Icone nome={avaliacao.correta ? 'check' : 'fechar'} />
                {avaliacao.correta && <Confete quantidade={14} />}
              </span>
              <div>
                <h2 id="aula-retorno-titulo" ref={tituloRetorno} tabIndex={-1}>
                  {avaliacao.correta ? tituloDoAcerto(licao.id) : mensagens.licao.errada}
                  <span className="somente-leitor"> {avaliacao.correta ? mensagens.licao.correta : mensagens.licao.incorreta}.</span>
                </h2>
                <p>{avaliacao.feedback}</p>
              </div>
            </section>
          )}
          <div className="aula-rodape__acoes">
            {avaliacao && !avaliacao.correta && (
              <><Botao disabled={ocupado} onClick={tentarDeNovo}>{mensagens.licao.tentarDeNovo}</Botao><Botao variante="texto" disabled={ocupado} onClick={() => { const alvo = document.querySelector<HTMLElement>('.estudio-ponte'); alvo?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); alvo?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true }); }}>{mensagens.estudio.verPonte}</Botao></>
            )}
            {acao}
          </div>
        </div>
      </footer>
    </article>
  );
}

/** Tempo em minutos e segundos, como 1:05. */
function formatarTempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
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
function LicaoConcluida({ plano, antes, licao, liberadas, resumo, ocupado, abrirLicao, voltar }: {
  plano: PlanoDetalhe;
  antes: Progresso;
  licao: LicaoDetalhe;
  liberadas: string[];
  resumo?: ResumoLicao;
  ocupado: boolean;
  abrirLicao: (id: string) => void;
  voltar: () => void;
}) {
  const proxima = proximaDoCaminho(plano);
  const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);
  const textos = mensagens.licao.resumo;

  return (
    <section className="painel painel--concluida">
      <Confete chuva quantidade={44} />
      <div className="conclusao-cena" aria-hidden="true">
        <span className="conclusao-raios" />
        <Stu />
        <span className="conclusao-selo"><Icone nome="check" /></span>
      </div>
      <h1 tabIndex={-1}>{mensagens.licao.concluida}</h1>
      <p className="conclusao-texto">{mensagens.licao.comemoracao}</p>
      <p className="conclusao-licao">{licao.titulo}</p>
      {resumo && (
        <ul className="conclusao-numeros" aria-label={textos.titulo}>
          <li data-tipo="tempo">
            <span className="conclusao-numeros__rotulo"><Icone nome="relogio" />{textos.tempo}</span>
            <span className="conclusao-numeros__valor"><Contador valor={resumo.segundos} formatar={formatarTempo} /></span>
          </li>
          <li data-tipo="acerto" data-primeira={resumo.dePrimeira || undefined}>
            <span className="conclusao-numeros__rotulo"><Icone nome="alvo" />{textos.acerto}</span>
            <span className="conclusao-numeros__valor">{resumo.dePrimeira ? textos.dePrimeira : textos.tentativas(resumo.tentativas)}</span>
          </li>
          <li data-tipo="etapas">
            <span className="conclusao-numeros__rotulo"><Icone nome="check" />{textos.etapas}</span>
            <span className="conclusao-numeros__valor">{textos.etapasFeitas}</span>
          </li>
        </ul>
      )}
      {liberada && <p className="conclusao-liberada"><Icone nome="livro" />{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</p>}
      <div className="conclusao-progresso">
        <h2>{mensagens.planos.progressoPlano}</h2>
        <BarraProgresso progresso={plano.progresso} de={antes} comPercentual />
      </div>
      <div className="acoes-tela">
        <AcaoPrincipal>
          {proxima && <Botao variante="secundario" disabled={ocupado} onClick={() => abrirLicao(proxima)}>{mensagens.licao.avancar}</Botao>}
          <Botao disabled={ocupado} onClick={voltar}>{mensagens.licao.voltar}</Botao>
        </AcaoPrincipal>
      </div>
    </section>
  );
}
