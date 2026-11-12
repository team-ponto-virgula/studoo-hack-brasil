'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  criarClienteStudoo,
  ErroStudoo,
  type Avaliacao,
  type LicaoDetalhe,
  type PlanoDetalhe,
  type PlanoResumo,
  type Progresso,
  type PropostaPlano,
} from '../contratos/aprendizado';
import { mensagens } from '../mensagens/pt-BR';
import { AcaoPrincipal, Botao, EstadoErro, EstadoVazio, Logo, Skeleton } from '../ui';

const cliente = criarClienteStudoo();

type Tela =
  | { tipo: 'planos' }
  | { tipo: 'objetivo' }
  | { tipo: 'proposta'; proposta: PropostaPlano }
  | { tipo: 'plano'; plano: PlanoDetalhe }
  | { tipo: 'licao'; plano: PlanoDetalhe; licao: LicaoDetalhe }
  | { tipo: 'concluida'; plano: PlanoDetalhe; licao: LicaoDetalhe };

type Acao = 'gerar' | 'aceitar' | 'abrir' | 'avaliar' | 'concluir' | 'sair';
type Resultado<T> = { ok: true; dados: T } | { ok: false; codigo: string };

export function Estudo() {
  const [inicio, setInicio] = useState<'carregando' | 'pronto' | 'falha'>('carregando');
  const [erro, setErro] = useState<string | null>(null);
  const [tela, setTela] = useState<Tela>({ tipo: 'planos' });
  const [planos, setPlanos] = useState<PlanoResumo[]>([]);
  const [objetivo, setObjetivo] = useState('');
  const [pendente, setPendente] = useState<Acao | null>(null);
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
    const resultado = await executar('abrir', () => cliente.obterPlano(id));
    if (resultado.ok) {
      atualizarPlano(resultado.dados);
      navegar({ tipo: 'plano', plano: resultado.dados });
    }
  }

  async function abrirLicao(plano: PlanoDetalhe, id: string) {
    const resultado = await executar('abrir', () => cliente.obterLicao(id));
    if (resultado.ok) navegar({ tipo: 'licao', plano, licao: resultado.dados });
  }

  async function concluir(licao: LicaoDetalhe, comprovante: string) {
    const resultado = await executar('concluir', () => cliente.concluirLicao(licao.id, comprovante));
    if (resultado.ok) {
      atualizarPlano(resultado.dados.plano);
      navegar({ tipo: 'concluida', plano: resultado.dados.plano, licao });
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
          {pendente === 'abrir' && <Skeleton />}
          {pendente !== 'abrir' && (tela.tipo === 'objetivo' || tela.tipo === 'planos' && planos.length === 0) && (
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
          {pendente !== 'abrir' && tela.tipo === 'planos' && planos.length > 0 && (
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
