'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
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
  EstadoErro,
  EstadoVazio,
  Icone,
  Logo,
  Skeleton,
  SkeletonTrilha,
  type NoCaminho,
} from '../ui';
import './aula.css';
import './trilha.css';

type Tela =
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'proposta'; proposta: PropostaPlano }
  | { tipo: 'plano'; plano: PlanoDetalhe; origem?: string; liberadas?: string[] }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; licao: LicaoDetalhe; liberadas: string[] };

type TelaPlano = Extract<Tela, { tipo: 'plano' }>;
type Acao = 'gerar' | 'aceitar' | 'plano' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string };

export function Estudo() {
  const [inicio, setInicio] = useState<'carregando' | 'pronto' | 'falha'>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [tela, setTela] = useState<Tela>({ tipo: 'planos' });
  const [planos, setPlanos] = useState<PlanoResumo[]>([]);
  const [objetivo, setObjetivo] = useState('');
  const [pendente, setPendente] = useState<Acao | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const emExecucao = useRef(false);
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
    if (erro) principal.current?.querySelector('.estado-erro')?.scrollIntoView({ block: 'nearest' });
  }, [erro]);

  function navegar(destino: Tela) {
    setErro(null);
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

  async function gerar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const resultado = await executar('gerar', () => cliente.gerarProposta(objetivo.trim()));
    if (resultado.ok) navegar({ tipo: 'proposta', proposta: resultado.dados });
  }

  async function aceitar(proposta: PropostaPlano) {
    const resultado = await executar('aceitar', () => cliente.aceitarProposta(proposta.token));
    if (!resultado.ok) return;
    atualizarPlano(resultado.dados);
    setObjetivo('');
    navegar({ tipo: 'plano', plano: resultado.dados });
  }

  async function abrirPlano(id: string) {
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
  const carregandoLicao = pendente === 'abrir' && tela.tipo !== 'plano';
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
          {erro && <EstadoErro codigo={erro} />}
          {carregandoTrilha && <SkeletonTrilha />}
          {carregandoLicao && <Skeleton />}
          {visivel && (tela.tipo === 'objetivo' || tela.tipo === 'planos' && planos.length === 0) && (
            <section className="painel painel--objetivo">
              <h1 tabIndex={-1}>{mensagens.pedido.titulo}</h1>
              <p className="introducao">{mensagens.pedido.instrucoes}</p>
              <form className="formulario" method="post" onSubmit={gerar}>
                <div className="campo">
                  <label htmlFor="objetivo">{mensagens.pedido.objetivo}</label>
                  <textarea id="objetivo" name="objetivo" rows={5} required value={objetivo} onChange={(evento) => setObjetivo(evento.target.value)} disabled={ocupado} aria-describedby="objetivo-privacidade" />
                  <small id="objetivo-privacidade">{mensagens.pedido.privacidade}</small>
                </div>
                <div className="objetivo-exemplo">
                  <p>{mensagens.pedido.escopo}</p>
                  <Botao variante="texto" onClick={() => setObjetivo(mensagens.pedido.exemplo)} disabled={ocupado}>{mensagens.pedido.usarExemplo}</Botao>
                </div>
                {pendente === 'gerar' && <Skeleton texto={mensagens.pedido.gerando} />}
                <AcaoPrincipal><Botao type="submit" disabled={ocupado || !objetivo.trim()}>{pendente === 'gerar' ? mensagens.pedido.gerando : mensagens.pedido.gerar}</Botao></AcaoPrincipal>
              </form>
            </section>
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
          {visivel && tela.tipo === 'proposta' && (
            <Proposta proposta={tela.proposta} ocupado={ocupado} aceitar={() => void aceitar(tela.proposta)} editar={() => navegar({ tipo: 'objetivo' })} />
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

function Proposta({ proposta, ocupado, aceitar, editar }: {
  proposta: PropostaPlano;
  ocupado: boolean;
  aceitar: () => void;
  editar: () => void;
}) {
  return (
    <section className="painel">
      <p className="contexto-tela">{mensagens.proposta.tipo}</p>
      <h1 tabIndex={-1}>{proposta.titulo}</h1>
      <p className="introducao">{mensagens.proposta.instrucoes}</p>
      <dl className="proposta-dados">
        <div><dt>{mensagens.proposta.objetivo}</dt><dd>{proposta.objetivo}</dd></div>
        <div><dt>{mensagens.proposta.origem}</dt><dd>{proposta.origem}<span>{mensagens.proposta.estado}</span></dd></div>
      </dl>
      <div className="fluxos">
        {proposta.fluxos.map((fluxo) => (
          <section className="fluxo" key={fluxo.titulo}>
            <h2>{fluxo.titulo}</h2>
            <ol className="fluxo-licoes">
              {fluxo.licoes.map((licao) => <li key={licao.titulo}>{licao.titulo}</li>)}
            </ol>
          </section>
        ))}
      </div>
      <div className="acoes-tela">
        <Botao variante="secundario" disabled={ocupado} onClick={editar}>{mensagens.proposta.editar}</Botao>
        <AcaoPrincipal><Botao disabled={ocupado} onClick={aceitar}>{ocupado ? mensagens.proposta.aceitando : mensagens.proposta.aceitar}</Botao></AcaoPrincipal>
      </div>
    </section>
  );
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

  return (
    <section className="painel painel--trilha">
      <header className="trilha-cabecalho">
        <div className="trilha-resumo">
          <h1 tabIndex={-1}>{plano.titulo}</h1>
          <p className="introducao">{plano.objetivo}</p>
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
        <Caminho nos={nos} ocupado={ocupado} abrindo={abrindo} liberadas={liberadas} rolarPara={rolarPara}
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
              <p className="licao-origem">{mensagens.proposta.origem} · {licao.origem}</p>
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
