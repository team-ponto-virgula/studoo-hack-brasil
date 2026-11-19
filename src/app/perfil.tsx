'use client';

/*
 * Perfil rico (spec 10, etapa A) na web: o cabeçalho do perfil (igual na tela Perfil e em /p), "Compartilhar perfil",
 * a tela Perfil, a tela "Editar perfil" com prévia ao vivo e o recorte da foto (arrastar, zoom, teclado).
 */
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as TeclaReact, type PointerEvent as PonteiroReact, type ReactNode, type RefObject } from 'react';
import {
  CORES_PERFIL,
  FUNDO_DA_COR,
  LADO_ENVIO_FOTO,
  LIMITES_FOTO,
  LIMITES_PERFIL,
  TEMAS,
  motivoNomeInvalido,
  motivoResumoInvalido,
  normalizarNomePerfil,
  normalizarResumoPerfil,
  type AlcancePerfil,
  type CorPerfil,
  type LinkCompartilhado,
  type Perfil,
  type CartaoTrilha,
  type PerfilPublico,
  type Tema,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone } from '../ui';
import { Avatar, DialogoConfirmar, FolhaCompartilhar, FolhaDeAcoes, codigoDoErro, dataCurta, urlDoLink, useDialogo, type OpcaoDeAcao } from './compartilhar';
import { CartoesDoPerfil, useAvisoDoApp } from './comunidade';
import { FolhaCompartilharPerfil } from './codigo';
import { BotaoSeguir, NovidadesDoPerfil } from './seguir';
import { SecaoSomPerfil } from './som';
import { tocaSons } from './sons';
import './perfil.css';

const m = mensagens.compartilhar;
const p = mensagens.perfil;
const temas = mensagens.temas;

/** O desenho da faixa: uma trilha pontilhada com marcos, em branco translúcido sobre a cor do perfil. */
function DesenhoFaixa() {
  return (
    <svg className="cabeca-perfil__desenho" viewBox="0 0 720 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <path d="M-20 108 C 90 40, 170 128, 280 74 S 470 20, 560 70 S 700 120, 760 46" fill="none" stroke="#fff" strokeOpacity="0.32" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 18" />
      <g fill="#fff" fillOpacity="0.22">
        <circle cx="280" cy="74" r="11" /><circle cx="560" cy="70" r="11" /><circle cx="96" cy="70" r="7" />
        <path d="M640 24l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" />
        <path d="M410 104l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />
      </g>
      <g fill="#fff" fillOpacity="0.14"><circle cx="180" cy="26" r="22" /><circle cx="690" cy="122" r="30" /></g>
    </svg>
  );
}

/**
 * O cabeçalho do perfil, o mesmo na tela Perfil, na prévia da edição e na página /p: faixa na cor do perfil, foto grande
 * sobreposta, nome, resumo, interesses e a linha de alcance. `acoes`: "Editar perfil" para a dona, "Compartilhar perfil".
 */
export function CabecalhoPerfil({ nome, cor, foto, resumo, interesses, alcance, nivel = 'h1', acoes, acoesRodape, semResumo, tituloRef, demo = false }: {
  /** Ações da dona numa fileira no fim do cartão ("Editar" e "Compartilhar", metade cada). */
  acoesRodape?: ReactNode;
  /** Perfil de demonstração: selo ao lado do nome. */
  demo?: boolean;
  nome: string;
  cor: CorPerfil;
  foto: string | null;
  resumo: string | null;
  interesses: Tema[];
  alcance: AlcancePerfil;
  nivel?: 'h1' | 'h2' | 'p';
  acoes?: ReactNode;
  semResumo?: ReactNode;
  tituloRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const Nome = nivel;
  // Fileira de números (na dona e na página pública): só os itens acima de zero; tudo zero, a fileira não aparece.
  const seguidores = alcance.seguidores ?? 0;
  const numeros = [
    alcance.trilhas > 0 && { n: alcance.trilhas, rotulo: p.numeroTrilhas(alcance.trilhas) },
    alcance.pessoas > 0 && { n: alcance.pessoas, rotulo: p.numeroEstudando },
    seguidores > 0 && { n: seguidores, rotulo: p.numeroSeguidores(seguidores) },
  ].filter((item): item is { n: number; rotulo: string } => Boolean(item));
  return (
    <div className="cabeca-perfil" style={{ '--cor-perfil': FUNDO_DA_COR[cor] } as CSSProperties}>
      <div className="cabeca-perfil__faixa"><DesenhoFaixa /></div>
      <div className="cabeca-perfil__corpo">
        <div className="cabeca-perfil__topo">
          <Avatar nome={nome} cor={cor} foto={foto} tamanho="g" />
          {acoes && <div className="cabeca-perfil__acoes">{acoes}</div>}
        </div>
        <Nome className="cabeca-perfil__nome" ref={nivel === 'p' ? undefined : (tituloRef as RefObject<HTMLHeadingElement>)} tabIndex={tituloRef ? -1 : undefined}>{nome}</Nome>
        {demo && <p className="selo-demo">{mensagens.comunidade.perfilDemo}</p>}
        {resumo ? <p className="cabeca-perfil__resumo">{resumo}</p> : semResumo}
        {interesses.length > 0 && (
          <ul className="cabeca-perfil__interesses" aria-label={p.interessesRotulo}>
            {interesses.map((tema) => <li key={tema}>{temas[tema]}</li>)}
          </ul>
        )}
        {numeros.length > 0 && (
          <div className="cabeca-perfil__numeros">
            {/* O leitor de tela ouve uma frase só; as colunas são só visuais. */}
            <p className="somente-leitor">{p.numerosLeitor(alcance.trilhas, alcance.pessoas, seguidores)}</p>
            <dl aria-hidden="true">
              {numeros.map((item) => <div key={item.rotulo}><dt>{item.rotulo}</dt><dd>{item.n}</dd></div>)}
            </dl>
          </div>
        )}
        {acoesRodape && <div className="cabeca-perfil__acoes-rodape">{acoesRodape}</div>}
      </div>
    </div>
  );
}

/** "Compartilhar perfil": abre a folha com o Código Studoo do perfil (foto no centro), copiar, compartilhar e baixar. */
export function BotaoCompartilharPerfil({ perfilId, nome, cor, foto, variante = 'secundario', curto = false }: { perfilId: string; nome: string; cor: CorPerfil; foto: string | null; variante?: 'primario' | 'secundario'; curto?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante={variante} aria-label={curto ? p.compartilharPerfil : undefined} onClick={() => setAberto(true)}><Icone nome="compartilhar" />{curto ? p.compartilhar : p.compartilharPerfil}</Botao>
      {aberto && <FolhaCompartilharPerfil perfilId={perfilId} nome={nome} cor={cor} fotoToken={foto} aoFechar={() => setAberto(false)} />}
    </>
  );
}

/**
 * O cabeçalho do /p com Seguir (com a comunidade) e "Compartilhar perfil": a contagem de seguidores muda na hora ao
 * seguir ou deixar de seguir. Sem lista de quem segue.
 */
export function CabecalhoPublico({ perfil, perfilId, logado }: { perfil: PerfilPublico; perfilId: string; logado: boolean }) {
  const [seguidores, setSeguidores] = useState(perfil.alcance.seguidores);
  const comunidade = perfil.alcance.seguidores !== undefined;
  return (
    <CabecalhoPerfil demo={Boolean(perfil.demo)} nome={perfil.nome} cor={perfil.cor} foto={perfil.foto} resumo={perfil.resumo} interesses={perfil.interesses}
      alcance={{ ...perfil.alcance, ...(seguidores !== undefined ? { seguidores } : {}) }}
      acoes={<>
        {comunidade && <BotaoSeguir perfilId={perfilId} nome={perfil.nome} estado={perfil.seguir} logado={logado} aoMudar={setSeguidores} />}
        <BotaoCompartilharPerfil perfilId={perfilId} nome={perfil.nome} cor={perfil.cor} foto={perfil.foto} />
      </>} />
  );
}

/** Tela Perfil: o cabeçalho novo; as trilhas que a pessoa compartilha; o perfil público; a conta e Sair. */
export function TelaPerfil({ perfil: inicial, aoMudarPerfil, aoMudarLink, abrirPlano, sair, anunciar, comunidade = false, aoAdicionado, irParaTrilhas, registrarGuarda }: {
  /** Guarda de saída do editor (alteração não salva pede a confirmação do app ao navegar). */
  registrarGuarda?: (guarda: ((continuar: () => void) => boolean) | null) => void;
  perfil: Perfil | null;
  /** O vazio de "Trilhas que você compartilha" leva a Minhas trilhas. */
  irParaTrilhas?: () => void;
  /** Com a comunidade: o nível de cada trilha, "Visibilidade" (abre a folha) e os cartões como aparecem na página. */
  comunidade?: boolean;
  aoAdicionado?: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoMudarPerfil: (perfil: Perfil) => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado | null) => void;
  abrirPlano: (id: string) => void;
  sair: () => void;
  anunciar: (texto: string) => void;
}) {
  const [perfil, setPerfil] = useState<Perfil | null>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [parando, setParando] = useState<LinkCompartilhado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState('');
  const [folha, setFolha] = useState<string | null>(null);
  const [cartoes, setCartoes] = useState<CartaoTrilha[] | null>(null);
  // Com dados, o bloco mostra o perfil como os outros veem; "Editar" abre os campos ali mesmo.
  const [editando, setEditando] = useState<boolean | 'resumo'>(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const botaoEditar = useRef<HTMLButtonElement>(null);
  const focarEditar = useRef(false);
  const [aviso, avisar] = useAvisoDoApp();
  const [toque, setToque] = useState(false);
  useEffect(() => { setToque(window.matchMedia('(pointer: coarse)').matches); }, []);
  const assinaturaLinks = perfil?.links.map((link) => `${link.codigo}:${link.visibilidade ?? link.noPerfil}:${link.tema ?? ''}:${link.legenda ?? ''}`).join('|') ?? '';

  // Os cartões como aparecem na página pública (com a comunidade e perfil público); recarrega quando os links mudam.
  useEffect(() => {
    if (!comunidade || !perfil?.publico || !perfil.perfilId) { setCartoes(null); return; }
    let ativo = true;
    cliente.perfilPublico(perfil.perfilId).then((dados) => { if (ativo) setCartoes(dados.cartoes ?? null); }).catch(() => { if (ativo) setCartoes(null); });
    return () => { ativo = false; };
  }, [comunidade, perfil?.publico, perfil?.perfilId, assinaturaLinks]);

  // Depois de salvar, os campos fecham e o foco vai para "Editar".
  useEffect(() => {
    if (!focarEditar.current || editando || !perfil?.nome) return;
    focarEditar.current = false;
    botaoEditar.current?.focus();
  }, [editando, perfil?.nome]);

  useEffect(() => {
    let ativo = true;
    cliente.obterPerfil().then((dados) => { if (ativo) { setPerfil(dados); aoMudarPerfil(dados); } })
      .catch((falha) => { if (ativo) setErro(codigoDoErro(falha)); });
    return () => { ativo = false; };
    // Recarrega ao abrir a tela (as adições e os links podem ter mudado).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarLink(antigo: LinkCompartilhado, novo: LinkCompartilhado | null) {
    setPerfil((atual) => {
      if (!atual) return atual;
      const links = novo ? atual.links.map((item) => (item.codigo === antigo.codigo ? novo : item)) : atual.links.filter((item) => item.codigo !== antigo.codigo);
      // O alcance do cartão é o da página pública: só as trilhas no perfil.
      const noPerfil = links.filter((item) => item.noPerfil);
      return { ...atual, links, publico: noPerfil.length > 0, alcance: { ...atual.alcance, trilhas: noPerfil.length, pessoas: noPerfil.reduce((t, l) => t + l.adicoes, 0) } };
    });
    aoMudarLink(antigo.planoId, novo);
  }

  async function alterar(link: LinkCompartilhado, noPerfil: boolean) {
    setOcupado(true);
    try { trocarLink(link, await cliente.alterarLink(link.codigo, noPerfil)); } catch (falha) { setErro(codigoDoErro(falha)); } finally { setOcupado(false); }
  }

  async function copiar(link: LinkCompartilhado) {
    try {
      await navigator.clipboard.writeText(urlDoLink(link.codigo));
      void tocaSons.tocarEfeito('link_copiado');
      setCopiado((anterior) => (anterior === m.copiado ? `${m.copiado} ` : m.copiado));
    } catch {
      setCopiado(m.copiarFalhou);
    }
  }

  async function confirmarParada() {
    if (!parando) return;
    setOcupado(true);
    try {
      await cliente.encerrarLink(parando.codigo);
      trocarLink(parando, null);
      anunciar(m.parado);
      setParando(null);
    } catch (falha) {
      setErro(codigoDoErro(falha));
      setParando(null);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="painel painel--perfil">
      <h1 ref={titulo} tabIndex={-1} className="titulo-pagina painel--perfil__titulo">{p.titulo}</h1>
      {erro && <p className="campo-erro" role="alert">{textoErro(erro)}</p>}
      {!perfil && !erro && <div className="cabeca-perfil cabeca-perfil--esqueleto" aria-hidden="true"><div className="cabeca-perfil__faixa" /><div className="folha-esqueleto"><span /><span /><span /></div></div>}
      {perfil && (
        <>
          {perfil.visitante ? (
            <div className="perfil-cartao"><p className="perfil-cartao__visitante">{p.visitante}</p></div>
          ) : (
            <div className="perfil-topo">
              {!perfil.nome || editando ? (
                // Sem tela de convite: sem nome, os campos já vêm abertos; com nome, "Editar" abre os mesmos campos aqui.
                <EditorPerfil perfil={perfil} anunciar={anunciar} registrarGuarda={registrarGuarda} focarResumo={editando === 'resumo'}
                  aoMudarPerfil={(novo) => { setPerfil(novo); aoMudarPerfil(novo); }}
                  aoSalvo={() => { avisar(p.salvo, { som: 'salvo' }); focarEditar.current = true; setEditando(false); }}
                  aoFechar={perfil.nome ? () => { setEditando(false); focarEditar.current = true; } : undefined} />
              ) : (
                <CabecalhoPerfil nome={perfil.nome} cor={perfil.cor ?? 'azul'} foto={perfil.foto} resumo={perfil.resumo} interesses={perfil.interesses}
                  alcance={perfil.alcance} nivel="h2"
                  semResumo={<button type="button" className="cabeca-perfil__convite" onClick={() => setEditando('resumo')}>{p.semResumoDona}</button>}
                  acoesRodape={<>
                    <Botao ref={botaoEditar} variante="secundario" aria-label={p.editarPerfil} onClick={() => setEditando(true)}><Icone nome="lapis" />{p.editar}</Botao>
                    {perfil.publico && perfil.perfilId && <BotaoCompartilharPerfil curto perfilId={perfil.perfilId} nome={perfil.nome} cor={perfil.cor ?? 'azul'} foto={perfil.foto} />}
                  </>} />
              )}
              {/* Novidades logo abaixo do cartão (no computador, na coluna da direita, também editando): é a recompensa do social. */}
              {comunidade && perfil.nome && <NovidadesDoPerfil abrirPlano={abrirPlano} />}
            </div>
          )}

          {!perfil.visitante && (
            <section className="perfil-secao" aria-labelledby="perfil-compartilhadas">
              <h2 id="perfil-compartilhadas" className="perfil-secao__titulo">{perfil.links.length > 0 ? p.compartilhadasTotal(perfil.links.length) : p.compartilhadas}</h2>
              {perfil.links.length === 0 ? (
                <p className="folha-texto">
                  {p.nenhumaAntes} {irParaTrilhas ? <button type="button" className="link-texto" onClick={irParaTrilhas}>{p.nenhumaLink}</button> : p.nenhumaLink}{p.nenhumaDepois(toque)}
                </p>
              ) : (
                <ul className="perfil-links">
                  {perfil.links.map((link) => (
                    <li key={link.codigo} className="perfil-link">
                      <button type="button" className="perfil-link__titulo" onClick={() => abrirPlano(link.planoId)}>{link.titulo}</button>
                      <p className="perfil-link__meta">
                        {p.desde(dataCurta(link.criadoEm))} · {link.adicoes === 0 && !link.valeus
                          ? (comunidade ? p.semNinguem : p.adicoes(0))
                          : [link.adicoes > 0 && p.adicoes(link.adicoes), comunidade && link.valeus ? mensagens.comunidade.valeus(link.valeus) : null].filter(Boolean).join(' · ')}
                      </p>
                      {comunidade && link.visibilidade ? (
                        <p className="selo-visibilidade" data-nivel={link.visibilidade}>
                          <Icone nome={link.visibilidade === 'explorar' ? 'bussola' : link.visibilidade === 'perfil' ? 'pessoa' : 'elo'} />
                          {mensagens.comunidade.niveis[link.visibilidade].titulo}
                          {link.visibilidade === 'explorar' && link.tema ? ` · ${temas[link.tema]}` : ''}
                        </p>
                      ) : (
                        <label className="chave">
                          <input type="checkbox" role="switch" checked={link.noPerfil} disabled={ocupado} onChange={(e) => void alterar(link, e.target.checked)} />
                          <span className="chave__trilho" aria-hidden="true" />
                          <span className="chave__texto">{m.noPerfil}<span className="somente-leitor">: {link.titulo}</span></span>
                        </label>
                      )}
                      <div className="perfil-link__acoes">
                        {comunidade && <Botao variante="secundario" aria-label={mensagens.comunidade.ajustarRotulo(link.titulo)} onClick={() => setFolha(link.planoId)}><Icone nome="olho" />{mensagens.comunidade.ajustar}</Botao>}
                        <Botao variante="secundario" onClick={() => void copiar(link)}><Icone nome="copiar" />{m.copiar}<span className="somente-leitor">: {link.titulo}</span></Botao>
                        <Botao variante="texto" className="folha-parar" disabled={ocupado} onClick={() => setParando(link)}>{m.parar}<span className="somente-leitor">: {link.titulo}</span></Botao>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="folha-status" role="status" aria-live="polite">{copiado}</p>
            </section>
          )}


          {cartoes && cartoes.length > 0 && (
            <CartoesDoPerfil key={assinaturaLinks} inicial={cartoes} logado titulo={mensagens.comunidade.naSuaPagina} classeTitulo="perfil-secao__titulo" semDono
              aoAbrir={abrirPlano} aoAdicionado={(id, nome, ja) => aoAdicionado?.(id, nome, ja)} />
          )}

          {!perfil.visitante && perfil.nome && (
            <section className="perfil-secao" aria-labelledby="perfil-publico">
              <h2 id="perfil-publico" className="perfil-secao__titulo">{p.publicoTitulo}</h2>
              <p className="folha-texto">{perfil.publico ? p.publico(perfil.links.filter((link) => link.noPerfil).length) : `${p.privado} ${p.perfilPrivadoDica}`}</p>
              {perfil.publico && perfil.perfilId && (
                <a className="botao botao--secundario perfil-ver" href={`/p/${perfil.perfilId}`} target="_blank" rel="noopener">{p.verComoOutros}</a>
              )}
            </section>
          )}

          {/* Som, logo antes de Conta, para quem tem conta e para visitante (spec 12). */}
          <SecaoSomPerfil />

          <section className="perfil-secao" aria-labelledby="perfil-conta">
            <h2 id="perfil-conta" className="perfil-secao__titulo">{p.conta}</h2>
            {!perfil.visitante && <p className="perfil-conta__email"><span>{p.email}</span> {perfil.email} <span className="selo-so-voce">{p.soVoceVe}</span></p>}
            <Botao variante="secundario" onClick={sair}>{mensagens.sair}</Botao>
          </section>
        </>
      )}
      {folha && (
        <FolhaCompartilhar planoId={folha} visitante={false} comunidade={comunidade} anunciar={anunciar} aoFechar={() => setFolha(null)}
          aoMudarPerfil={(novo) => { setPerfil(novo); aoMudarPerfil(novo); }}
          aoMudarLink={(planoId, novo) => {
            const antigo = perfil?.links.find((item) => item.planoId === planoId);
            if (antigo) trocarLink(antigo, novo); else aoMudarLink(planoId, novo);
          }} />
      )}
      {aviso}
      {parando && (
        <DialogoConfirmar titulo={m.pararTitulo} texto={m.pararTexto} confirmar={m.pararConfirmar} cancelar={m.pararCancelar}
          ocupado={ocupado} aoConfirmar={() => void confirmarParada()} aoCancelar={() => setParando(null)} />
      )}
    </section>
  );
}

type ErrosCampos = { nome?: string; resumo?: string };
/** O estado da barra de salvar: nada (sem mudança), pendente, salvando ou um erro (campo ou rede). */
type EstadoBarra = { tipo: 'livre' } | { tipo: 'salvando' } | { tipo: 'erroCampo' } | { tipo: 'erro'; texto: string };

/**
 * Os dados do perfil, abertos ali mesmo na aba Perfil (sem outra tela nem diálogo), na ordem do cabeçalho público:
 * privacidade, foto, nome, resumo, interesses e cor. A foto salva na hora (é um envio à parte, pelo menu da foto); o
 * resto salva no botão da barra presa no pé da tela, que só liga quando algo muda. `aoFechar` (perfil com dados): o
 * "Cancelar" volta para o perfil como os outros veem (com alteração, pergunta antes).
 */
export function EditorPerfil({ perfil, aoMudarPerfil, anunciar, registrarGuarda, aoFechar, aoSalvo, focarResumo = false }: {
  perfil: Perfil;
  aoMudarPerfil: (perfil: Perfil) => void;
  anunciar: (texto: string) => void;
  /** Qualquer navegação passa pela guarda; com alteração não salva, recebe a confirmação do app. */
  registrarGuarda?: (guarda: ((continuar: () => void) => boolean) | null) => void;
  aoFechar?: () => void;
  /** Salvo: quem abriu fecha os campos e mostra o aviso do app. */
  aoSalvo?: () => void;
  /** Aberto pelo convite "Conte em uma frase…": o foco vai para o resumo. */
  focarResumo?: boolean;
}) {
  const [salvo, setSalvo] = useState(perfil);
  const [nome, setNome] = useState(perfil.nome ?? '');
  const [cor, setCor] = useState<CorPerfil>(perfil.cor ?? 'azul');
  const [resumo, setResumo] = useState(perfil.resumo ?? '');
  const [interesses, setInteresses] = useState<Tema[]>(perfil.interesses);
  const [erros, setErros] = useState<ErrosCampos>({});
  const [estado, setEstado] = useState<EstadoBarra>({ tipo: 'livre' });
  const [avisoInteresses, setAvisoInteresses] = useState('');
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [statusFoto, setStatusFoto] = useState('');
  const [menuFoto, setMenuFoto] = useState(false);
  const [removendo, setRemovendo] = useState<'perguntar' | 'removendo' | null>(null);
  const [sair, setSair] = useState<(() => void) | null>(null);
  const [toque, setToque] = useState(false);
  useEffect(() => { setToque(window.matchMedia('(pointer: coarse)').matches); }, []);
  const campoNome = useRef<HTMLInputElement>(null);
  const campoResumo = useRef<HTMLTextAreaElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const ids = { titulo: useId(), nome: useId(), nomeDica: useId(), nomeErro: useId(), resumo: useId(), resumoDica: useId(), resumoErro: useId(), resumoContador: useId(), interesses: useId(), foto: useId(), fotoDica: useId(), cor: useId() };

  const nomeNormal = normalizarNomePerfil(nome);
  const resumoNormal = normalizarResumoPerfil(resumo);
  const usados = [...resumoNormal].length;
  const alterado = nomeNormal !== (salvo.nome ?? '') || cor !== (salvo.cor ?? 'azul') || resumoNormal !== (salvo.resumo ?? '')
    || interesses.join() !== salvo.interesses.join();
  const salvando = estado.tipo === 'salvando';

  // Abrindo pelo "Editar", o foco vai para o título do bloco (o leitor de tela anuncia), uma vez só e sem abrir o teclado;
  // pelo convite do resumo, vai para o resumo.
  const abertoPeloEditar = useRef(Boolean(aoFechar));
  const tituloBloco = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focarResumo) campoResumo.current?.focus();
    else if (abertoPeloEditar.current) tituloBloco.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alteradoRef = useRef(alterado);
  alteradoRef.current = alterado;
  useEffect(() => {
    if (!registrarGuarda) return;
    registrarGuarda((continuar) => {
      if (!alteradoRef.current) return false;
      setSair(() => continuar);
      return true;
    });
    return () => registrarGuarda(null);
  }, [registrarGuarda]);

  /** Qualquer mudança num campo tira o erro da barra (o erro do próprio campo some ao corrigir). */
  function mexeu() { if (estado.tipo === 'erroCampo' || estado.tipo === 'erro') setEstado({ tipo: 'livre' }); }

  function atualizarPerfil(novo: Perfil) {
    setSalvo(novo);
    aoMudarPerfil(novo);
  }

  function alternarTema(tema: Tema, marcado: boolean) {
    if (marcado && interesses.length >= LIMITES_PERFIL.interessesMax) {
      setAvisoInteresses((anterior) => (anterior === p.interessesCheio(LIMITES_PERFIL.interessesMax) ? `${anterior} ` : p.interessesCheio(LIMITES_PERFIL.interessesMax)));
      return;
    }
    setAvisoInteresses('');
    mexeu();
    setInteresses((atual) => TEMAS.filter((t) => (t === tema ? marcado : atual.includes(t))));
  }

  function descartar() {
    setNome(salvo.nome ?? '');
    setCor(salvo.cor ?? 'azul');
    setResumo(salvo.resumo ?? '');
    setInteresses(salvo.interesses);
    setErros({});
    setEstado({ tipo: 'livre' });
    registrarGuarda?.(null);
    aoFechar?.();
  }

  /** "Cancelar": com alteração, a mesma confirmação "Sair sem salvar?"; sem, fecha. */
  function cancelar() {
    if (alterado) setSair(() => descartar);
    else descartar();
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (salvando) return;
    const motivoNome = nomeNormal ? motivoNomeInvalido(nomeNormal) : null;
    const motivoResumo = motivoResumoInvalido(resumoNormal);
    const novos: ErrosCampos = {
      ...(!nomeNormal ? { nome: p.nomeErros.vazio } : motivoNome ? { nome: p.nomeErros[motivoNome] } : {}),
      ...(motivoResumo ? { resumo: p.resumoErros[motivoResumo] } : {}),
    };
    setErros(novos);
    if (novos.nome || novos.resumo) {
      setEstado({ tipo: 'erroCampo' });
      (novos.nome ? campoNome : campoResumo).current?.focus();
      anunciar(p.corrigirCampos);
      return;
    }
    setEstado({ tipo: 'salvando' });
    try {
      const novo = await cliente.salvarPerfil(nomeNormal, cor, { resumo: resumoNormal, interesses });
      setEstado({ tipo: 'livre' });
      registrarGuarda?.(null);
      atualizarPerfil(novo);
      setNome(novo.nome ?? '');
      setResumo(novo.resumo ?? '');
      setInteresses(novo.interesses);
      aoSalvo?.();
    } catch (falha) {
      const codigo = codigoDoErro(falha);
      // Os campos guardam o que foi digitado; a barra diz o que houve.
      setEstado({ tipo: 'erro', texto: codigo === 'rede' ? p.salvarErroRede : textoErro(codigo) });
    }
  }

  function escolherArquivo(lista: FileList | null, origem: HTMLInputElement | null) {
    const escolhido = lista?.[0];
    if (origem) origem.value = '';
    if (!escolhido) return;
    setErroFoto(null);
    // Antes do recorte, qualquer imagem que o navegador abra serve (o recorte regrava em JPEG); só um teto de memória.
    if (!escolhido.type.startsWith('image/') || escolhido.size > 30 * 1024 * 1024) {
      setErroFoto(p.fotoIlegivel);
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setArquivo(typeof leitor.result === 'string' ? leitor.result : null);
    leitor.onerror = () => setErroFoto(p.fotoIlegivel);
    leitor.readAsDataURL(escolhido);
  }

  async function removerFoto() {
    setRemovendo('removendo');
    try {
      atualizarPerfil(await cliente.removerFoto());
      setStatusFoto(p.fotoRemovida);
      anunciar(p.fotoRemovida);
    } catch (falha) {
      setErroFoto(textoErro(codigoDoErro(falha)));
    } finally {
      setRemovendo(null);
    }
  }

  // O menu da foto: galeria, câmera (só em tela de toque), remover (só com foto) e cancelar. Com uma opção só
  // (computador, sem foto), o seletor de arquivo abre direto.
  const opcoesFoto: OpcaoDeAcao[] = [
    { chave: 'galeria', rotulo: p.fotoGaleria, icone: 'imagem', aoEscolher: () => { setMenuFoto(false); galeria.current?.click(); } },
    ...(toque ? [{ chave: 'camera', rotulo: p.fotoCamera, icone: 'camera' as const, aoEscolher: () => { setMenuFoto(false); camera.current?.click(); } }] : []),
    ...(salvo.foto ? [{ chave: 'remover', rotulo: p.fotoRemover, icone: 'lixeira' as const, perigo: true, aoEscolher: () => { setMenuFoto(false); setRemovendo('perguntar'); } }] : []),
  ];
  function abrirFoto() {
    if (opcoesFoto.length === 1) galeria.current?.click();
    else setMenuFoto(true);
  }

  const textoFoto = salvo.foto ? p.fotoTrocar : p.fotoAdicionar;
  const barra = salvando
    ? { tipo: 'salvando', texto: p.salvando }
    : estado.tipo === 'erroCampo' ? { tipo: 'erro', texto: p.corrigirCampos, icone: true }
      : estado.tipo === 'erro' ? { tipo: 'erro', texto: estado.texto }
        : alterado ? { tipo: 'pendente', texto: p.alteracoesNaoSalvas } : null;

  return (
    <section className="editor-perfil" aria-labelledby={ids.titulo}>
      <h2 id={ids.titulo} ref={tituloBloco} tabIndex={-1} className="somente-leitor">{aoFechar ? p.editarPerfil : p.seusDados}</h2>
      <p className="editor-perfil__privacidade"><Icone nome="cadeado" /><span>{p.privacidade}</span></p>
      <form className="editar-perfil__form" onSubmit={salvar} noValidate aria-busy={salvando || undefined}>
        <section className="editar-foto" aria-labelledby={ids.foto}>
          <h3 id={ids.foto} className="somente-leitor">{p.fotoRotulo}</h3>
          {/* A foto (ou a inicial na cor, ou o desenho de pessoa sem nome) com o selo de câmera: tocar abre o menu da foto. */}
          <button type="button" className="editar-foto__circulo" aria-label={textoFoto} aria-describedby={ids.fotoDica} aria-haspopup={opcoesFoto.length > 1 ? 'dialog' : undefined} onClick={abrirFoto}>
            <Avatar nome={nomeNormal || '?'} cor={cor} foto={salvo.foto} tamanho="g" vazio={!nomeNormal} />
            <span className="editar-foto__selo" aria-hidden="true"><Icone nome="camera" /></span>
          </button>
          <div className="editar-foto__corpo">
            {/* Mesmo destino do círculo; fora da ordem de Tab para não repetir a parada. */}
            <button type="button" className="editar-foto__link" tabIndex={-1} aria-hidden="true" onClick={abrirFoto}>{textoFoto}</button>
            <p className="campo-dica" id={ids.fotoDica}>{p.fotoDica}</p>
            {erroFoto && !arquivo && <p className="campo-erro campo-erro--colado" role="alert"><Icone nome="alerta" />{erroFoto}</p>}
            <p className="folha-status" role="status" aria-live="polite">{statusFoto}</p>
            <input ref={galeria} type="file" accept="image/*" hidden onChange={(e) => escolherArquivo(e.target.files, galeria.current)} />
            <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => escolherArquivo(e.target.files, camera.current)} />
          </div>
        </section>

        <div className="campo" data-erro={erros.nome ? true : undefined}>
          <label htmlFor={ids.nome}>{m.nomeRotulo}</label>
          <input id={ids.nome} ref={campoNome} value={nome} maxLength={60} autoComplete="nickname" autoCapitalize="words" disabled={salvando}
            aria-invalid={erros.nome ? true : undefined} aria-describedby={erros.nome ? ids.nomeErro : ids.nomeDica}
            onChange={(e) => { setNome(e.target.value); mexeu(); if (erros.nome) setErros((atual) => ({ ...atual, nome: undefined })); }} />
          {erros.nome && <p className="campo-erro campo-erro--colado" id={ids.nomeErro}><Icone nome="alerta" />{erros.nome}</p>}
          <p className="campo-dica" id={ids.nomeDica} hidden={Boolean(erros.nome)}>{p.nomeDica}</p>
        </div>

        <div className="campo campo--resumo" data-erro={erros.resumo ? true : undefined}>
          <div className="campo__linha">
            <label htmlFor={ids.resumo}>{p.resumoRotulo}</label>
            <span className="campo__contador" id={ids.resumoContador} data-acima={usados > LIMITES_PERFIL.resumoMax || undefined}>
              <span aria-hidden="true">{p.resumoContador(usados, LIMITES_PERFIL.resumoMax)}</span>
              <span className="somente-leitor">{p.resumoContadorLeitor(LIMITES_PERFIL.resumoMax - usados)}</span>
            </span>
          </div>
          <textarea id={ids.resumo} ref={campoResumo} value={resumo} rows={3} maxLength={240} disabled={salvando}
            aria-invalid={erros.resumo ? true : undefined} aria-describedby={`${erros.resumo ? ids.resumoErro : ids.resumoDica} ${ids.resumoContador}`}
            onChange={(e) => { setResumo(e.target.value.replace(/[\r\n]+/g, ' ')); mexeu(); if (erros.resumo) setErros((atual) => ({ ...atual, resumo: undefined })); }} />
          {erros.resumo && <p className="campo-erro campo-erro--colado" id={ids.resumoErro}><Icone nome="alerta" />{erros.resumo}</p>}
          <p className="campo-dica" id={ids.resumoDica} hidden={Boolean(erros.resumo)}>{p.resumoDica}</p>
        </div>

        <fieldset className="interesses" aria-describedby={`${ids.interesses}-dica`} disabled={salvando}>
          <legend>{p.interessesCampoRotulo}</legend>
          <p className="campo-dica" id={`${ids.interesses}-dica`}>
            {p.interessesDica(LIMITES_PERFIL.interessesMax)} <span>{p.interessesContador(interesses.length, LIMITES_PERFIL.interessesMax)}</span>
          </p>
          <div className="interesses__lista">
            {TEMAS.map((tema) => (
              <label key={tema} className="interesse">
                <input type="checkbox" checked={interesses.includes(tema)} onChange={(e) => alternarTema(tema, e.target.checked)} />
                <span>{temas[tema]}</span>
              </label>
            ))}
          </div>
          <p className="campo-erro interesses__aviso" role="status" aria-live="polite">{avisoInteresses}</p>
        </fieldset>

        <fieldset className="cores-perfil" aria-describedby={ids.cor} disabled={salvando}>
          <legend>{m.corRotulo}</legend>
          <p className="campo-dica" id={ids.cor}>{p.corDica}</p>
          <div className="cores-perfil__lista">
            {CORES_PERFIL.map((opcao) => (
              <label key={opcao} className="cor-perfil" style={{ '--cor': FUNDO_DA_COR[opcao] } as CSSProperties}>
                <input type="radio" name="cor-perfil" value={opcao} checked={cor === opcao} onChange={() => { setCor(opcao); mexeu(); }} />
                <span className="cor-perfil__amostra" aria-hidden="true" />
                <span className="somente-leitor">{m.cores[opcao]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Barra presa no pé da tela, acima da barra de abas: o estado à esquerda (nenhum, sem mudança) e os botões à direita. */}
        <div className="barra-salvar" data-com-cancelar={aoFechar ? true : undefined}>
          <p className="barra-salvar__estado" data-estado={barra?.tipo} role="status" aria-live="polite">
            {barra && barra.tipo === 'erro' && 'icone' in barra && <Icone nome="alerta" />}{barra?.texto ?? ''}
          </p>
          <div className="barra-salvar__botoes">
            {aoFechar && <Botao variante="secundario" disabled={salvando} onClick={cancelar}>{p.cancelar}</Botao>}
            <Botao type="submit" disabled={salvando || !alterado} aria-busy={salvando || undefined}>{salvando ? p.salvando : p.salvar}</Botao>
          </div>
        </div>
      </form>

      {menuFoto && <FolhaDeAcoes titulo={p.fotoMenuTitulo} opcoes={opcoesFoto} cancelar={p.fotoMenuCancelar} aoFechar={() => setMenuFoto(false)} />}
      {arquivo && (
        <RecorteFoto origem={arquivo} aoCancelar={() => setArquivo(null)}
          aoSalvar={(novo) => { atualizarPerfil(novo); setArquivo(null); setStatusFoto(p.fotoSalva); anunciar(p.fotoSalva); }} />
      )}
      {removendo && (
        <DialogoConfirmar titulo={p.fotoRemoverTitulo} texto={p.fotoRemoverTexto} confirmar={p.fotoRemover} cancelar={p.fotoRemoverCancelar} perigo
          ocupado={removendo === 'removendo'} aoConfirmar={() => void removerFoto()} aoCancelar={() => setRemovendo(null)} />
      )}
      {sair && (
        <DialogoConfirmar titulo={p.sairSemSalvarTitulo} texto={p.sairSemSalvarTexto} confirmar={p.sairSemSalvarConfirmar} cancelar={p.sairSemSalvarCancelar}
          aoConfirmar={() => { const continuar = sair; registrarGuarda?.(null); setSair(null); continuar(); }} aoCancelar={() => setSair(null)} />
      )}
    </section>
  );
}

const ZOOM_MAX = 4;

/** Base64 de um Blob, em pedaços (sem estourar a pilha com fotos grandes). */
async function base64DoBlob(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

/**
 * Recorte quadrado: a foto cobre sempre o quadro; arrastar (mouse, toque ou caneta) move, pinça e roda do mouse
 * aproximam, o controle deslizante também; pelo teclado, setas movem e + / − aproximam. O círculo mostra como o avatar
 * fica. "Usar esta foto" recorta num canvas (até 1024 px, JPEG) e envia.
 */
function RecorteFoto({ origem, aoCancelar, aoSalvar }: { origem: string; aoCancelar: () => void; aoSalvar: (perfil: Perfil) => void }) {
  return <RecorteImagem origem={origem} aoCancelar={aoCancelar} enviar={async (base64) => aoSalvar(await cliente.enviarFoto(base64))} />;
}

/**
 * O recorte de imagem do app (foto do perfil, quadrada; capa da trilha, 2:1): a imagem cobre sempre o quadro; arrastar
 * move, pinça, roda do mouse e o controle aproximam; setas movem e + / − aproximam. `enviar` recebe o JPEG em base64.
 */
export function RecorteImagem({ origem, aoCancelar, enviar, proporcao = 1, titulo = p.recorteTitulo, dica, aviso = p.fotoAviso, comSelos = false }: {
  origem: string;
  aoCancelar: () => void;
  enviar: (base64: string) => Promise<void>;
  /** Largura ÷ altura do recorte: 1 (avatar, com o círculo) ou 2 (capa). */
  proporcao?: number;
  titulo?: string;
  /** O texto de como ajustar; sem ele, o do perfil (com toque ou com mouse). */
  dica?: string;
  aviso?: string;
  /** Na capa: a área dos selos por cima, tracejada, para a pessoa não deixar o principal da foto embaixo deles. */
  comSelos?: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const quadro = useRef<HTMLDivElement>(null);
  const imagem = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [lado, setLado] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tituloId = useId();
  const dicaId = useId();
  const tecladoId = useId();
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const [toque, setToque] = useState(false);
  useEffect(() => { setToque(window.matchMedia('(pointer: coarse)').matches); }, []);
  const pinca = useRef<{ distancia: number; zoom: number } | null>(null);
  useDialogo(caixa, () => { if (!enviando) aoCancelar(); });

  useEffect(() => { quadro.current?.focus(); }, [natural]);
  useEffect(() => {
    const el = quadro.current;
    if (!el) return;
    const medir = () => setLado(el.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const altoQuadro = lado / proporcao;
  const base = natural && lado ? Math.max(lado / natural.w, altoQuadro / natural.h) : 1;
  const escala = base * zoom;
  const largura = (natural?.w ?? 0) * escala;
  const altura = (natural?.h ?? 0) * escala;

  /** Mantém a foto cobrindo o quadro. */
  const limitar = useMemo(() => (x: number, y: number, l = largura, a = altura) => ({
    x: Math.min(0, Math.max(lado - l, x)),
    y: Math.min(0, Math.max(altoQuadro - a, y)),
  }), [lado, altoQuadro, largura, altura]);

  // Ao carregar (ou mudar o tamanho do quadro), centraliza.
  useEffect(() => {
    if (!natural || !lado) return;
    const b = Math.max(lado / natural.w, lado / proporcao / natural.h);
    setPos({ x: (lado - natural.w * b * zoom) / 2, y: (lado / proporcao - natural.h * b * zoom) / 2 });
    // Só quando a foto ou o quadro mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, lado]);

  /** Zoom em torno de um ponto do quadro (o centro, por padrão): o ponto debaixo dele fica parado. */
  function aplicarZoom(novo: number, cx = lado / 2, cy = altoQuadro / 2) {
    if (!natural) return;
    const z = Math.min(ZOOM_MAX, Math.max(1, novo));
    const fator = z / zoom;
    const l = natural.w * base * z;
    const a = natural.h * base * z;
    setZoom(z);
    setPos((atual) => limitar(cx - (cx - atual.x) * fator, cy - (cy - atual.y) * fator, l, a));
  }

  // Roda do mouse: precisa de ouvinte não passivo para não rolar a página.
  useEffect(() => {
    const el = quadro.current;
    if (!el) return;
    const aoRolar = (evento: WheelEvent) => {
      evento.preventDefault();
      const r = el.getBoundingClientRect();
      aplicarZoom(zoom * (evento.deltaY < 0 ? 1.08 : 1 / 1.08), evento.clientX - r.left, evento.clientY - r.top);
    };
    el.addEventListener('wheel', aoRolar, { passive: false });
    return () => el.removeEventListener('wheel', aoRolar);
  });

  function aoPressionar(evento: PonteiroReact<HTMLDivElement>) {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    toques.current.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
    if (toques.current.size === 2) {
      const [a, b] = [...toques.current.values()];
      pinca.current = { distancia: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }
  function aoMover(evento: PonteiroReact<HTMLDivElement>) {
    const anterior = toques.current.get(evento.pointerId);
    if (!anterior) return;
    const atual = { x: evento.clientX, y: evento.clientY };
    toques.current.set(evento.pointerId, atual);
    if (toques.current.size === 2 && pinca.current) {
      const [a, b] = [...toques.current.values()];
      const r = evento.currentTarget.getBoundingClientRect();
      aplicarZoom(pinca.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinca.current.distancia), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    setPos((p0) => limitar(p0.x + atual.x - anterior.x, p0.y + atual.y - anterior.y));
  }
  function aoSoltar(evento: PonteiroReact<HTMLDivElement>) {
    toques.current.delete(evento.pointerId);
    if (toques.current.size < 2) pinca.current = null;
  }

  function aoTeclar(evento: TeclaReact<HTMLDivElement>) {
    const passo = evento.shiftKey ? 32 : 8;
    const movimentos: Record<string, [number, number]> = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
    if (movimentos[evento.key]) {
      evento.preventDefault();
      const [dx, dy] = movimentos[evento.key];
      setPos((p0) => limitar(p0.x + dx, p0.y + dy));
    } else if (evento.key === '+' || evento.key === '=') {
      evento.preventDefault();
      aplicarZoom(zoom + 0.1);
    } else if (evento.key === '-' || evento.key === '_') {
      evento.preventDefault();
      aplicarZoom(zoom - 0.1);
    }
  }

  async function usar() {
    const img = imagem.current;
    if (!img || !natural || !lado) return;
    setEnviando(true);
    setErro(null);
    try {
      const lFonte = lado / escala;
      const saida = Math.max(256, Math.min(LADO_ENVIO_FOTO, Math.round(lFonte)));
      const saidaAlta = Math.round(saida / proporcao);
      const canvas = document.createElement('canvas');
      canvas.width = saida;
      canvas.height = saidaAlta;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, saida, saidaAlta);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -pos.x / escala, -pos.y / escala, lFonte, lFonte / proporcao, 0, 0, saida, saidaAlta);
      let blob: Blob | null = null;
      for (const qualidade of [0.9, 0.8, 0.65]) {
        blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/jpeg', qualidade));
        if (blob && blob.size <= LIMITES_FOTO.bytes) break;
      }
      if (!blob || blob.size > LIMITES_FOTO.bytes) throw new Error('grande');
      await enviar(await base64DoBlob(blob));
    } catch (falha) {
      setErro(falha instanceof Error && ['canvas', 'grande'].includes(falha.message) ? p.fotoIlegivel : textoErro(codigoDoErro(falha)));
      setEnviando(false);
    }
  }

  // A folha sobe de baixo no celular, como no app (spec 11 e P18); no computador, fica no centro.
  return (
    <div className="folha-fundo" role="presentation">
      <div className="folha folha--recorte" role="dialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={dicaId} aria-busy={enviando || undefined} ref={caixa}>
        <div className="folha-topo">
          <span />
          <button type="button" className="folha-fechar" aria-label={p.recorteCancelar} disabled={enviando} onClick={aoCancelar}><Icone nome="fechar" /></button>
        </div>
        <h2 id={tituloId} className="folha-titulo">{titulo}</h2>
        <p id={dicaId} className="folha-texto folha-texto--miudo">{dica ?? (toque ? p.recorteDicaToque : p.recorteDica)}</p>
        <div ref={quadro} className="recorte" data-proporcao={proporcao} style={{ aspectRatio: String(proporcao) }} tabIndex={0} role="group" aria-label={p.recorteArea} aria-describedby={tecladoId}
          onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} onKeyDown={aoTeclar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imagem} src={origem} alt="" draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setErro(p.fotoIlegivel)}
            style={natural ? { width: largura, height: altura, transform: `translate(${pos.x}px, ${pos.y}px)` } : { opacity: 0 }} />
          <span className={proporcao === 1 ? 'recorte__circulo' : 'recorte__moldura'} aria-hidden="true">
            {proporcao !== 1 && comSelos && <><span className="recorte__selo" /><span className="recorte__selo recorte__selo--2" /></>}
          </span>
        </div>
        <p id={tecladoId} className="somente-leitor">{p.recorteTeclado}</p>
        <label className="recorte__zoom">
          <span>{p.recorteZoom}</span>
          <input type="range" min={100} max={ZOOM_MAX * 100} step={1} value={Math.round(zoom * 100)} disabled={!natural}
            style={{ '--preenchido': `${((zoom - 1) / (ZOOM_MAX - 1)) * 100}%` } as CSSProperties}
            onChange={(e) => aplicarZoom(Number(e.target.value) / 100)} />
        </label>
        <p className="campo-dica recorte__aviso">{aviso}</p>
        {erro && <p className="campo-erro" role="alert">{erro}</p>}
        {/* A ação principal vem primeiro (no celular fica em cima, à vista); no computador, à direita. */}
        <div className="folha-acoes recorte__acoes">
          <Botao disabled={!natural || enviando} aria-busy={enviando || undefined} onClick={() => void usar()}>{enviando ? p.fotoEnviando : p.recorteUsar}</Botao>
          <Botao variante="secundario" disabled={enviando} onClick={aoCancelar}>{p.recorteCancelar}</Botao>
        </div>
      </div>
    </div>
  );
}
