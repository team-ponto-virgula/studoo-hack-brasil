'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ErroStudoo,
  LIMITES_GERACAO,
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
  EstadoErro,
  EstadoVazio,
  Icone,
  Logo,
  Skeleton,
  SkeletonTrilha,
  Stu,
  type NoCaminho,
} from '../ui';
import { aplicarEvento, gerarTrilhaAoVivo, nosDaPrevia, type TrilhaEmGeracao } from './geracao-ao-vivo';
import './aula.css';
import './pedido.css';
import './trilha.css';

type Tela =
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'geracao' }
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[] }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; licao: LicaoDetalhe; liberadas: string[] };

type TelaPlano = Extract<Tela, { tipo: 'plano' }>;
type Acao = 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string };

export function Estudo() {
  const [inicio, setInicio] = useState<'carregando' | 'pronto' | 'falha'>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [tela, setTela] = useState<Tela>({ tipo: 'planos' });
  const [planos, setPlanos] = useState<PlanoResumo[]>([]);
  const [objetivo, setObjetivo] = useState('');
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
    if (destino.tipo !== tela.tipo) window.scrollTo(0, 0);
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
    const aceite = await executar('aceitar', () => cliente.aceitarProposta(proposta.token));
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
    const licao = await executar('abrir', () => cliente.obterLicao(primeira));
    if (licao.ok) {
      navegar({ tipo: 'licao', plano, licao: licao.dados });
      return;
    }
    if (licao.codigo === 'nao_autenticado') return;
    navegar({ tipo: 'plano', plano });
    setErro(licao.codigo);
  }

  async function abrirPlano(id: string) {
    if (emExecucao.current) return;
    if (tela.tipo === 'geracao') navegar({ tipo: 'planos' });
    const resultado = await executar('plano', () => cliente.obterPlano(id));
    if (resultado.ok) {
      atualizarPlano(resultado.dados);
      navegar({ tipo: 'plano', plano: resultado.dados });
    }
  }

  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    if (emExecucao.current) return;
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

  async function sair() {
    const resultado = await executar('sair', () => cliente.logout());
    if (resultado.ok) irParaLogin();
  }

  const ocupado = pendente !== null;
  const planoAtual = 'plano' in tela ? tela.plano.id : null;
  const carregandoTrilha = pendente === 'plano';
  // Começar, na trilha gerada, já mostra a forma da lição: salvar o plano e abrir a primeira lição é uma espera só.
  const carregandoLicao = (pendente === 'abrir' && tela.tipo !== 'plano') || (pendente === 'aceitar' && tela.tipo === 'geracao');
  const visivel = !carregandoTrilha && !carregandoLicao;

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
    <div className="estudo">
      <a className="pular" href="#conteudo-principal">{mensagens.pular}</a>
      <aside className="barra-lateral">
        <div className="barra-marca"><Logo animado={tela.tipo === 'concluida'} /></div>
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
      </aside>

      <div className="estudo-pagina">
        <header className="estudo-cabecalho">
          <span className="estudo-identificacao">{mensagens.estudos}</span>
          <div className="estudo-marca"><Logo animado={tela.tipo === 'concluida'} /></div>
          <div className="estudo-conta">
            <Botao variante="texto" className="planos-movel" onClick={() => navegar({ tipo: 'planos' })} disabled={ocupado}>{mensagens.planos.titulo}</Botao>
            <Botao variante="texto" onClick={() => void sair()} disabled={ocupado}>{mensagens.sair}</Botao>
          </div>
        </header>

        <main id="conteudo-principal" className="estudo-principal" tabIndex={-1} ref={principal} aria-busy={ocupado}>
          <p className="somente-leitor" role="status">{anuncio}</p>
          {erro && <EstadoErro codigo={erro} />}
          {carregandoTrilha && <SkeletonTrilha />}
          {carregandoLicao && <SkeletonLicao texto={pendente === 'aceitar' ? mensagens.geracao.comecando : mensagens.licao.carregando} />}
          {visivel && (tela.tipo === 'objetivo' || tela.tipo === 'planos' && planos.length === 0) && (
            <Pedido objetivo={objetivo} ocupado={ocupado} aviso={aviso} falha={falhaGeracao} temPlanos={planos.length > 0}
              aoMudar={setObjetivo} anunciar={anunciar} gerar={(texto) => void gerar(texto)}
              verPlanos={() => navegar({ tipo: 'planos' })} />
          )}
          {visivel && tela.tipo === 'planos' && planos.length > 0 && (
            <section className="painel">
              <h1 tabIndex={-1}>{mensagens.planos.titulo}</h1>
              <ul className="planos-ativos">
                {planos.map((plano) => (
                  <li key={plano.id}>
                    <div>
                      <h2>{plano.titulo}</h2>
                      <BarraProgresso progresso={plano.progresso} />
                    </div>
                    <Botao variante="secundario" aria-label={`${mensagens.planos.abrir} ${plano.titulo}`} disabled={ocupado} onClick={() => void abrirPlano(plano.id)}>{mensagens.planos.abrir}</Botao>
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
              concluir={(comprovante) => concluir(tela.plano, tela.licao, comprovante)}
              voltar={() => navegar({ tipo: 'plano', plano: tela.plano, origem: tela.licao.id })} />
          )}
          {visivel && tela.tipo === 'concluida' && (
            <LicaoConcluida plano={tela.plano} licao={tela.licao} liberadas={tela.liberadas} ocupado={ocupado}
              abrirLicao={(id) => void abrirLicao(tela.plano, id)}
              voltar={() => navegar({ tipo: 'plano', plano: tela.plano, origem: tela.licao.id, liberadas: tela.liberadas })} />
          )}
        </main>
      </div>
    </div>
  );
}

function BarraProgresso({ progresso }: { progresso: Progresso }) {
  if (progresso.percentual === null) return <span className="progresso-vazio">{mensagens.planos.semProgresso}</span>;

  const texto = mensagens.planos.contagem(progresso.concluidas, progresso.total);

  return (
    <div className="progresso">
      <progress aria-label={texto} value={progresso.concluidas} max={progresso.total} />
      <span>{texto}</span>
    </div>
  );
}

/** Pedido da trilha: a pessoa escreve o que quer aprender, ou toca numa sugestão, e gera a trilha ao vivo. */
function Pedido({ objetivo, ocupado, aviso, falha, temPlanos, aoMudar, anunciar, gerar, verPlanos }: {
  objetivo: string;
  ocupado: boolean;
  aviso: string | null;
  falha: string | null;
  temPlanos: boolean;
  aoMudar: (texto: string) => void;
  anunciar: (texto: string) => void;
  gerar: (texto: string) => void;
  verPlanos: () => void;
}) {
  const [curto, setCurto] = useState(false);
  const campo = useRef<HTMLTextAreaElement>(null);
  const texto = objetivo.trim();
  const mostrarCurto = curto && texto.length < LIMITES_GERACAO.objetivoMin;
  const mostrarContador = objetivo.length >= LIMITES_GERACAO.objetivoMax - 100;
  const descricao = [mostrarCurto && 'objetivo-erro', 'objetivo-privacidade', mostrarContador && 'objetivo-contador']
    .filter(Boolean).join(' ');
  const repetivel = falha === 'ia_indisponivel' || falha === 'falha' || falha === 'rede';

  function tentar() {
    if (ocupado || !texto) return;
    if (texto.length < LIMITES_GERACAO.objetivoMin) {
      setCurto(true);
      campo.current?.focus();
      return;
    }
    gerar(texto);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    tentar();
  }

  function sugerir(exemplo: string) {
    aoMudar(exemplo);
    setCurto(false);
    anunciar(mensagens.pedido.sugestaoAplicada(exemplo));
  }

  return (
    <section className="painel painel--pedido">
      <div className="pedido-topo">
        <div>
          <h1 tabIndex={-1}>{mensagens.pedido.titulo}</h1>
          <p className="introducao">{mensagens.pedido.instrucoes}</p>
        </div>
        <Stu />
      </div>
      {aviso && <p className="pedido-aviso">{aviso}</p>}
      {falha && (
        <EstadoErro codigo={falha}>
          {repetivel && <Botao variante="secundario" disabled={ocupado} onClick={tentar}>{mensagens.tentarNovamente}</Botao>}
          {falha === 'limite_geracoes' && temPlanos && <Botao variante="secundario" disabled={ocupado} onClick={verPlanos}>{mensagens.pedido.verPlanos}</Botao>}
        </EstadoErro>
      )}
      <form className="formulario pedido-formulario" method="post" noValidate onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="objetivo">{mensagens.pedido.objetivo}</label>
          <textarea ref={campo} id="objetivo" name="objetivo" rows={4} maxLength={LIMITES_GERACAO.objetivoMax} required
            value={objetivo} disabled={ocupado} aria-invalid={mostrarCurto || undefined} aria-describedby={descricao}
            onChange={(evento) => aoMudar(evento.target.value)} />
          {mostrarCurto && (
            <p className="campo-erro" id="objetivo-erro">
              <span className="sinal" aria-hidden="true">!</span>{mensagens.pedido.curto(LIMITES_GERACAO.objetivoMin)}
            </p>
          )}
          <small id="objetivo-privacidade">{mensagens.pedido.privacidade}</small>
          {mostrarContador && (
            <small className="pedido-contador" id="objetivo-contador">
              {mensagens.pedido.contador(objetivo.length, LIMITES_GERACAO.objetivoMax)}
            </small>
          )}
        </div>
        <div className="pedido-sugestoes" role="group" aria-labelledby="pedido-sugestoes">
          <p className="pedido-sugestoes__titulo" id="pedido-sugestoes">{mensagens.pedido.sugestoes}</p>
          <div className="pedido-chips">
            {mensagens.pedido.exemplos.map((exemplo) => {
              const escolhida = texto === exemplo;
              return (
                <button key={exemplo} type="button" className="pedido-chip" data-escolhida={escolhida || undefined}
                  disabled={ocupado} onClick={() => sugerir(exemplo)}>
                  {escolhida && <Icone nome="check" />}
                  {exemplo}
                </button>
              );
            })}
          </div>
        </div>
        <AcaoPrincipal><Botao type="submit" disabled={ocupado || !texto}>{mensagens.pedido.gerar}</Botao></AcaoPrincipal>
      </form>
    </section>
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
      <Caminho nos={nos} stu={proposta ? mensagens.geracao.stuPronta : mensagens.geracao.stuMontando}
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
    return { id: licao.id, titulo: licao.titulo, estado, trecho };
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
          <div className="plano-progresso"><BarraProgresso progresso={plano.progresso} /></div>
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

function Licao({ licao, pendente, avaliar, concluir, voltar }: {
  licao: LicaoDetalhe;
  pendente: Acao | null;
  avaliar: (resposta: string) => Promise<Resultado<Avaliacao>>;
  concluir: (comprovante: string) => Promise<boolean>;
  voltar: () => void;
}) {
  const [etapa, setEtapa] = useState<'conceito' | 'exemplo' | 'exercicio'>('conceito');
  const [resposta, setResposta] = useState('');
  const [avaliacao, setAvaliacao] = useState<Avaliacao | null>(null);
  const tituloEtapa = useRef<HTMLHeadingElement>(null);
  const { exercicio } = licao;
  const ocupado = pendente !== null;
  const etapaAtual = avaliacao ? 'feedback' : etapa;
  const posicao = posicoesAula[etapaAtual];
  const andamento = mensagens.licao.posicao(posicao, posicoesAula.feedback);

  useEffect(() => {
    if (etapaAtual !== 'conceito') tituloEtapa.current?.focus();
  }, [etapaAtual]);

  async function responder(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado || !resposta.trim()) return;
    const resultado = await avaliar(resposta);
    if (resultado.ok) setAvaliacao(resultado.dados);
  }

  async function continuar(comprovante: string) {
    if (!await concluir(comprovante)) setAvaliacao(null);
  }

  let acao;
  if (avaliacao) {
    acao = <Botao disabled={ocupado} onClick={() => void continuar(avaliacao.comprovante)}>{pendente === 'concluir' ? mensagens.licao.concluindo : mensagens.licao.continuar}</Botao>;
  } else if (etapa === 'exercicio') {
    acao = <Botao type="submit" form="resposta-licao" disabled={ocupado || !resposta.trim()}>{pendente === 'avaliar' ? mensagens.licao.avaliando : mensagens.licao.avaliar}</Botao>;
  } else {
    acao = <Botao disabled={ocupado} onClick={() => setEtapa(etapa === 'conceito' ? 'exemplo' : 'exercicio')}>{mensagens.licao.seguir}</Botao>;
  }

  return (
    <article className="painel painel--aula">
      <header className="aula-topo">
        <button type="button" className="aula-fechar" aria-label={mensagens.licao.voltar} disabled={ocupado} onClick={voltar}>
          <span aria-hidden="true">×</span>
        </button>
        <div className="aula-andamento">
          <progress className="aula-progresso" aria-label={andamento} value={posicao} max={posicoesAula.feedback} />
          <span className="aula-posicao" aria-hidden="true">{andamento}</span>
        </div>
      </header>
      <div className="aula-miolo">
        <h1 tabIndex={-1}>{licao.titulo}</h1>
        {etapaAtual === 'conceito' && (
          <>
            {licao.concluida && <p className="aula-revisao"><Icone nome="check" />{mensagens.trilha.revisitando}</p>}
            <p className="introducao">{licao.objetivo}</p>
            <section className="aula-quadro" data-etapa="conceito" aria-labelledby="etapa-aula">
              <h2 id="etapa-aula">{mensagens.licao.conceito}</h2>
              <p>{licao.conceito}</p>
              <p className="licao-origem">{mensagens.licao.origem} · {licao.origem}</p>
            </section>
          </>
        )}
        {etapaAtual === 'exemplo' && (
          <section className="aula-quadro" data-etapa="exemplo" aria-labelledby="etapa-aula">
            <h2 id="etapa-aula" ref={tituloEtapa} tabIndex={-1}>{mensagens.licao.exemplo}</h2>
            <p>{licao.exemplo}</p>
          </section>
        )}
        {etapaAtual === 'exercicio' && (
          <section className="aula-quadro" data-etapa="exercicio" aria-labelledby="etapa-aula">
            <h2 id="etapa-aula" ref={tituloEtapa} tabIndex={-1}>{mensagens.licao.exercicio}</h2>
            <p>{exercicio.enunciado}</p>
            {exercicio.contexto && <p>{exercicio.contexto}</p>}
            {exercicio.trecho && <pre className="licao-codigo"><code>{exercicio.trecho}</code></pre>}
            <form id="resposta-licao" className="formulario" method="post" onSubmit={responder}>
              {exercicio.tipo === 'lacuna' ? (
                <div className="campo campo--resposta">
                  <label htmlFor="resposta">{mensagens.licao.resposta}</label>
                  <input id="resposta" name="resposta" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false}
                    value={resposta} onChange={(evento) => setResposta(evento.target.value)} required disabled={ocupado} />
                </div>
              ) : (
                <fieldset className="opcoes" disabled={ocupado}>
                  <legend>{mensagens.licao.resposta}</legend>
                  {exercicio.opcoes.map((opcao) => (
                    <label key={opcao.id}>
                      <input type="radio" name="resposta" value={opcao.id} required checked={resposta === opcao.id}
                        onChange={() => setResposta(opcao.id)} />
                      <span>{opcao.texto}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </form>
          </section>
        )}
        {avaliacao && (
          <section className="aula-feedback" data-correta={avaliacao.correta} aria-labelledby="etapa-aula">
            <span className="aula-feedback__icone" aria-hidden="true">{avaliacao.correta ? '✓' : '!'}</span>
            <div>
              <h2 id="etapa-aula" ref={tituloEtapa} tabIndex={-1}>{avaliacao.correta ? mensagens.licao.correta : mensagens.licao.incorreta}</h2>
              <p>{avaliacao.feedback}</p>
            </div>
          </section>
        )}
      </div>
      <footer className="aula-rodape"><div className="aula-rodape__conteudo">{acao}</div></footer>
    </article>
  );
}

function LicaoConcluida({ plano, licao, liberadas, ocupado, abrirLicao, voltar }: {
  plano: PlanoDetalhe;
  licao: LicaoDetalhe;
  liberadas: string[];
  ocupado: boolean;
  abrirLicao: (id: string) => void;
  voltar: () => void;
}) {
  const proxima = proximaDoCaminho(plano);
  const liberada = plano.fluxos.flatMap((fluxo) => fluxo.licoes).find((item) => item.id === liberadas[0]);

  return (
    <section className="painel painel--concluida">
      <div className="conclusao-sinal" aria-hidden="true"><Icone nome="check" /></div>
      <h1 tabIndex={-1}>{mensagens.licao.concluida}</h1>
      <p className="introducao">{licao.titulo}</p>
      {liberada && <p className="conclusao-liberada"><Icone nome="livro" />{mensagens.trilha.liberadaNaTrilha(liberada.titulo)}</p>}
      <div className="conclusao-progresso">
        <h2>{mensagens.planos.progressoPlano}</h2>
        <BarraProgresso progresso={plano.progresso} />
      </div>
      <div className="acoes-tela">
        {proxima && <Botao variante="secundario" disabled={ocupado} onClick={() => abrirLicao(proxima)}>{mensagens.licao.avancar}</Botao>}
        <AcaoPrincipal><Botao disabled={ocupado} onClick={voltar}>{mensagens.licao.voltar}</Botao></AcaoPrincipal>
      </div>
    </section>
  );
}
