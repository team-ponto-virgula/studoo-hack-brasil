'use client';

/*
 * Comunidade (spec 10, etapa B) na web: a capa gerada, o cartão de trilha (o mesmo no Explorar, no perfil e na
 * prévia), a tela Explorar (no app e na página pública /explorar), o Valeu e o diálogo de Denunciar.
 * Tudo só aparece com `comunidade` no /api/auth/config.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  LIMITES_COMUNIDADE,
  MOTIVOS_DENUNCIA,
  TEMAS,
  svgCapaTrilha,
  type CartaoTrilha,
  type MotivoDenuncia,
  type PaginaExplorar,
  type Tema,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone, Stu } from '../ui';
import { Avatar, CHAVE_DEPOIS_DO_LOGIN, abrirNoApp, codigoDoErro, guardar, urlDoLink, useDialogo } from './compartilhar';
import './comunidade.css';

const c = mensagens.comunidade;
const temas = mensagens.temas;

/** Leva ao login e volta para `caminho` depois (um link de trilha ou o Explorar). */
export function entrarEVoltar(caminho: string) {
  guardar(CHAVE_DEPOIS_DO_LOGIN, caminho);
  window.location.assign('/login');
}

/** A capa: cor do tema e um padrão geométrico determinístico pelo código (sem imagem enviada, sem IA). */
export function CapaTrilha({ codigo, tema }: { codigo: string; tema: Tema | null }) {
  // O SVG é gerado por uma função pura do contrato: só formas, com o código já restrito a [A-Za-z0-9_-].
  return <span className="capa-trilha" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgCapaTrilha(codigo, tema) }} />;
}

export type AcoesCartao = {
  /** Sem sessão, cada ação leva ao login (e volta). */
  logado: boolean;
  queroEstudar: (cartao: CartaoTrilha) => void;
  abrir: (planoId: string) => void;
  valeu: (cartao: CartaoTrilha) => void;
  denunciar: (cartao: CartaoTrilha) => void;
  compartilhar: (cartao: CartaoTrilha) => void;
  /** O código do cartão em andamento ("Adicionando…", valeu indo). */
  ocupado: string | null;
};

/** Menu "•••" com Denunciar: abre num botão, fecha com Esc, clique fora ou ao escolher. */
function MenuCartao({ titulo, aoDenunciar }: { titulo: string; aoDenunciar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idMenu = useId();
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => { if (!caixa.current?.contains(evento.target as Node)) setAberto(false); };
    const tecla = (evento: KeyboardEvent) => { if (evento.key === 'Escape') { setAberto(false); botao.current?.focus(); } };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    caixa.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  return (
    <div className="cartao-trilha__menu" ref={caixa}>
      <button ref={botao} type="button" className="cartao-trilha__icone" aria-label={c.mais(titulo)} aria-haspopup="menu" aria-expanded={aberto} aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((valor) => !valor)}><Icone nome="mais" /></button>
      {aberto && (
        <div className="cartao-trilha__opcoes" role="menu" id={idMenu}>
          <button type="button" role="menuitem" onClick={() => { setAberto(false); aoDenunciar(); }}><Icone nome="bandeirinha" />{c.denunciar}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Cartão de trilha: capa (tema e, se for o caso, "Demonstração"), título (abre a prévia /t), quem fez (foto e nome,
 * levam ao perfil), legenda, "6 lições · 3 partes", "12 estudando · 8 valeus" e as ações: Quero estudar / Continuar /
 * Sua trilha, Valeu (liga e desliga), Compartilhar e "•••" com Denunciar.
 */
export function CartaoDeTrilha({ cartao, acoes, posicao, nivel = 'h3' }: { cartao: CartaoTrilha; acoes: AcoesCartao; posicao?: number; nivel?: 'h2' | 'h3' }) {
  const Titulo = nivel;
  const tituloId = useId();
  const sua = cartao.situacao === 'sua';
  const ocupado = acoes.ocupado === cartao.codigo;
  const principal = sua
    ? <Botao variante="secundario" onClick={() => cartao.planoId && acoes.abrir(cartao.planoId)}>{c.sua}</Botao>
    : cartao.situacao === 'adicionada'
      ? <Botao variante="secundario" onClick={() => cartao.planoId && acoes.abrir(cartao.planoId)}>{c.continuar}</Botao>
      : <Botao disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => acoes.queroEstudar(cartao)}>{ocupado ? c.adicionando : c.queroEstudar}</Botao>;
  return (
    <article className="cartao-trilha" aria-labelledby={tituloId} data-situacao={cartao.situacao}>
      <div className="cartao-trilha__capa">
        <CapaTrilha codigo={cartao.codigo} tema={cartao.tema} />
        {posicao !== undefined && <span className="cartao-trilha__posicao" aria-hidden="true">{posicao}</span>}
        <div className="cartao-trilha__selos">
          {cartao.tema && <span className="cartao-trilha__tema">{temas[cartao.tema]}</span>}
          {cartao.demonstracao && <span className="cartao-trilha__demo" title={c.demonstracaoDica}>{c.demonstracao}</span>}
        </div>
      </div>
      <div className="cartao-trilha__corpo">
        {posicao !== undefined && <p className="somente-leitor">{c.posicao(posicao)}</p>}
        <Titulo id={tituloId} className="cartao-trilha__titulo"><a href={`/t/${cartao.codigo}`}>{cartao.titulo}</a></Titulo>
        <p className="cartao-trilha__dono">
          <Avatar nome={cartao.dono.nome} cor={cartao.dono.cor} foto={cartao.dono.foto} />
          {cartao.dono.perfilId
            ? <a href={`/p/${cartao.dono.perfilId}`} aria-label={c.perfilDe(cartao.dono.nome)}>{c.por(cartao.dono.nome)}</a>
            : <span>{c.por(cartao.dono.nome)}</span>}
        </p>
        {cartao.legenda && <p className="cartao-trilha__legenda">{cartao.legenda}</p>}
        <p className="cartao-trilha__meta">{c.contagem(cartao.totalLicoes, cartao.totalPartes)}</p>
        <p className="cartao-trilha__numeros">{c.estudando(cartao.estudando)} · {c.valeus(cartao.valeus)}</p>
        <div className="cartao-trilha__acoes">
          {principal}
          {!sua && (
            <button type="button" className="cartao-trilha__valeu" aria-pressed={Boolean(cartao.valeuMeu)} aria-label={c.valeuRotulo(cartao.titulo)}
              disabled={ocupado} onClick={() => acoes.valeu(cartao)}>
              <Icone nome="valeu" /><span aria-hidden="true">{c.valeu}</span>
            </button>
          )}
          <button type="button" className="cartao-trilha__icone" aria-label={c.compartilharRotulo(cartao.titulo)} onClick={() => acoes.compartilhar(cartao)}><Icone nome="compartilhar" /></button>
          {!sua && <MenuCartao titulo={cartao.titulo} aoDenunciar={() => acoes.denunciar(cartao)} />}
        </div>
      </div>
    </article>
  );
}

/** Denunciar trilha ou perfil: motivo (rádio), enviar; foco preso, Esc fecha e devolve o foco. */
export function DialogoDenuncia({ alvoTipo, alvo, aoFechar, aoEnviar }: { alvoTipo: 'trilha' | 'perfil'; alvo: string; aoFechar: () => void; aoEnviar: (texto: string) => void }) {
  const [motivo, setMotivo] = useState<MotivoDenuncia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const textoId = useId();
  useDialogo(caixa, () => { if (!enviando) aoFechar(); });
  useEffect(() => { caixa.current?.querySelector<HTMLInputElement>('input')?.focus(); }, []);

  async function enviar() {
    if (!motivo) { setErro(c.denuncia.escolha); caixa.current?.querySelector<HTMLInputElement>('input')?.focus(); return; }
    setEnviando(true);
    setErro(null);
    try {
      await cliente.denunciar(alvoTipo, alvo, motivo);
      aoEnviar(c.denuncia.enviada);
    } catch (falha) {
      setErro(textoErro(codigoDoErro(falha)));
      setEnviando(false);
    }
  }

  return (
    <div className="folha-fundo folha-fundo--centro" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !enviando) aoFechar(); }}>
      <div className="folha folha--confirmar folha--denuncia" role="dialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={textoId} ref={caixa}>
        <h2 id={tituloId} className="folha-titulo">{alvoTipo === 'trilha' ? c.denuncia.tituloTrilha : c.denuncia.tituloPerfil}</h2>
        <p id={textoId} className="folha-texto">{c.denuncia.texto}</p>
        <fieldset className="denuncia__motivos">
          <legend className="somente-leitor">{c.denuncia.escolha}</legend>
          {MOTIVOS_DENUNCIA.map((opcao) => (
            <label key={opcao} className="denuncia__motivo">
              <input type="radio" name="motivo-denuncia" value={opcao} checked={motivo === opcao} onChange={() => { setMotivo(opcao); setErro(null); }} />
              <span>{c.denuncia.motivos[opcao]}</span>
            </label>
          ))}
        </fieldset>
        {erro && <p className="campo-erro" role="alert">{erro}</p>}
        <div className="folha-acoes recorte__acoes">
          <Botao variante="secundario" className="modal-confirmar--destrutivo" disabled={enviando} aria-busy={enviando || undefined} onClick={() => void enviar()}>{enviando ? c.denuncia.enviando : c.denuncia.enviar}</Botao>
          <Botao variante="secundario" disabled={enviando} onClick={aoFechar}>{c.denuncia.cancelar}</Botao>
        </div>
      </div>
    </div>
  );
}

/**
 * As ações dos cartões (Quero estudar, Valeu, Compartilhar, Denunciar) com o estado da lista: um só lugar para o
 * Explorar e o perfil. `aoAdicionado` decide o que fazer depois (no app abre a trilha; na página pública vai ao app).
 */
export function useAcoesDeCartao({ logado, setCartoes, aoAdicionado, aoAbrir, anunciar }: {
  logado: boolean;
  setCartoes: (mudar: (cartao: CartaoTrilha) => CartaoTrilha) => void;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  anunciar: (texto: string) => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [denuncia, setDenuncia] = useState<CartaoTrilha | null>(null);
  const acoes: AcoesCartao = {
    logado,
    ocupado,
    abrir: aoAbrir,
    async queroEstudar(cartao) {
      if (!logado) return entrarEVoltar(`/t/${cartao.codigo}?adicionar=1`);
      setOcupado(cartao.codigo);
      try {
        const feito = await cliente.adicionarTrilha(cartao.codigo);
        setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, situacao: 'adicionada', planoId: feito.planoId, estudando: atual.estudando + (feito.jaTinha ? 0 : 1) } : atual));
        aoAdicionado(feito.planoId, feito.dono.nome, feito.jaTinha);
      } catch (falha) {
        const codigo = codigoDoErro(falha);
        if (codigo === 'nao_autenticado') return entrarEVoltar(`/t/${cartao.codigo}?adicionar=1`);
        anunciar(textoErro(codigo));
      } finally {
        setOcupado(null);
      }
    },
    async valeu(cartao) {
      if (!logado) return entrarEVoltar('/explorar');
      const ativo = !cartao.valeuMeu;
      // Otimista: muda na hora e desfaz se falhar.
      setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, valeuMeu: ativo, valeus: Math.max(0, atual.valeus + (ativo ? 1 : -1)) } : atual));
      try {
        const r = await cliente.valeu(cartao.codigo, ativo);
        setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, valeuMeu: r.valeuMeu, valeus: r.valeus } : atual));
        anunciar(ativo ? c.valeuEnviado(cartao.titulo) : c.valeuRetirado(cartao.titulo));
      } catch (falha) {
        setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, valeuMeu: cartao.valeuMeu, valeus: cartao.valeus } : atual));
        const codigo = codigoDoErro(falha);
        if (codigo === 'nao_autenticado') return entrarEVoltar('/explorar');
        anunciar(textoErro(codigo));
      }
    },
    denunciar(cartao) {
      if (!logado) return entrarEVoltar('/explorar');
      setDenuncia(cartao);
    },
    async compartilhar(cartao) {
      const url = urlDoLink(cartao.codigo);
      if (typeof navigator.share === 'function') {
        try { await navigator.share({ title: cartao.titulo, text: mensagens.compartilhar.textoCompartilhar(cartao.titulo), url }); } catch { /* fechou */ }
        return;
      }
      try { await navigator.clipboard.writeText(url); anunciar(c.linkCopiado); } catch { anunciar(mensagens.compartilhar.copiarFalhou); }
    },
  };
  const dialogo = denuncia ? (
    <DialogoDenuncia alvoTipo="trilha" alvo={denuncia.codigo} aoFechar={() => setDenuncia(null)}
      aoEnviar={(texto) => { setDenuncia(null); anunciar(texto); }} />
  ) : null;
  return { acoes, dialogo };
}

/** Lista horizontal do "Em alta": numeral grande ao lado de cada cartão, com encaixe ao rolar e setas (com ponteiro fino). */
function EmAlta({ cartoes, acoes, titulo }: { cartoes: CartaoTrilha[]; acoes: AcoesCartao; titulo: string }) {
  const lista = useRef<HTMLOListElement>(null);
  const tituloId = useId();
  function rolar(direcao: 1 | -1) {
    const el = lista.current;
    if (!el) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direcao * el.clientWidth * 0.85, behavior: reduzido ? 'auto' : 'smooth' });
  }
  return (
    <section className="em-alta" aria-labelledby={tituloId}>
      <div className="em-alta__topo">
        <div>
          <h2 id={tituloId} className="explorar__secao">{titulo}</h2>
          <p className="campo-dica">{c.emAltaDica}</p>
        </div>
        <div className="em-alta__setas">
          <button type="button" className="cartao-trilha__icone" aria-label={c.anteriores} onClick={() => rolar(-1)}><span aria-hidden="true">←</span></button>
          <button type="button" className="cartao-trilha__icone" aria-label={c.proximas} onClick={() => rolar(1)}><span aria-hidden="true">→</span></button>
        </div>
      </div>
      <ol className="em-alta__lista" ref={lista}>
        {cartoes.map((cartao, indice) => (
          <li key={cartao.codigo} className="em-alta__item">
            <CartaoDeTrilha cartao={cartao} acoes={acoes} posicao={indice + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Tela Explorar: título, "Em alta esta semana" (Top 10), fichas de tema, "Novas" (20 por página, "Ver mais"), vazios
 * com o Stu. Igual no app e na página pública /explorar (ver não pede conta; agir pede).
 */
export function Explorar({ logado, inicial = null, aoAdicionado, aoAbrir, irParaTrilhas, topo }: {
  logado: boolean;
  inicial?: PaginaExplorar | null;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  irParaTrilhas?: () => void;
  /** Conteúdo acima do título (na página pública, o convite para entrar). */
  topo?: ReactNode;
}) {
  const [tema, setTema] = useState<Tema | null>(null);
  const [pagina, setPagina] = useState<PaginaExplorar | null>(inicial);
  const [carregando, setCarregando] = useState(!inicial);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeira = useRef(Boolean(inicial));
  const anunciar = (texto: string) => setAnuncio((anterior) => (anterior === texto ? `${texto} ` : texto));

  useEffect(() => { titulo.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    let ativo = true;
    setCarregando(true);
    setErro(null);
    cliente.explorar({ tema }).then((dados) => { if (ativo) setPagina(dados); })
      .catch((falha) => { if (ativo) setErro(textoErro(codigoDoErro(falha))); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tema]);

  async function verMais() {
    if (!pagina?.cursor) return;
    setMaisCarregando(true);
    try {
      const proxima = await cliente.explorar({ tema, cursor: pagina.cursor });
      setPagina((atual) => atual && { ...atual, novas: [...atual.novas, ...proxima.novas], cursor: proxima.cursor });
    } catch (falha) {
      anunciar(textoErro(codigoDoErro(falha)));
    } finally {
      setMaisCarregando(false);
    }
  }

  const setCartoes = (mudar: (cartao: CartaoTrilha) => CartaoTrilha) =>
    setPagina((atual) => atual && { ...atual, emAlta: atual.emAlta.map(mudar), novas: atual.novas.map(mudar) });
  const { acoes, dialogo } = useAcoesDeCartao({ logado, setCartoes, aoAdicionado, aoAbrir, anunciar });
  const vazio = pagina && pagina.emAlta.length === 0 && pagina.novas.length === 0;

  return (
    <section className="painel painel--explorar" aria-busy={carregando || undefined}>
      <p className="somente-leitor" role="status" aria-live="polite">{anuncio}</p>
      {topo}
      <header className="explorar__topo">
        <h1 ref={titulo} tabIndex={-1}>{c.titulo}</h1>
        <p className="explorar__subtitulo">{c.subtitulo}</p>
      </header>

      <div className="explorar__temas" role="group" aria-label={c.temas}>
        <button type="button" className="ficha-tema" aria-pressed={tema === null} onClick={() => setTema(null)}>{c.todos}</button>
        {TEMAS.map((opcao) => (
          <button key={opcao} type="button" className="ficha-tema" aria-pressed={tema === opcao} onClick={() => setTema(opcao)}>{temas[opcao]}</button>
        ))}
      </div>

      {erro && <p className="campo-erro" role="alert">{erro}</p>}
      {carregando && !pagina && <div className="explorar__esqueleto" aria-hidden="true"><span /><span /><span /></div>}

      {pagina && vazio && (
        <div className="explorar__vazio">
          <Stu />
          <div>
            <h2 className="explorar__secao">{tema ? c.vazioTema(temas[tema]) : c.vazioTitulo}</h2>
            <p className="folha-texto">{tema ? c.vazioTemaTexto : c.vazioTexto}</p>
            {tema
              ? <Botao variante="secundario" onClick={() => setTema(null)}>{c.vazioTemaAcao}</Botao>
              : logado && irParaTrilhas && <Botao onClick={irParaTrilhas}>{c.vazioAcao}</Botao>}
          </div>
        </div>
      )}

      {pagina && pagina.emAlta.length > 0 && <EmAlta cartoes={pagina.emAlta} acoes={acoes} titulo={c.emAlta} />}

      {pagina && pagina.novas.length > 0 && (
        <section className="explorar__novas" aria-labelledby="explorar-novas">
          <h2 id="explorar-novas" className="explorar__secao">{tema ? c.novasDoTema(temas[tema]) : c.novas}</h2>
          <ul className="grade-cartoes">
            {pagina.novas.map((cartao) => <li key={cartao.codigo}><CartaoDeTrilha cartao={cartao} acoes={acoes} /></li>)}
          </ul>
          {pagina.cursor
            ? <Botao variante="secundario" className="explorar__mais" disabled={maisCarregando} aria-busy={maisCarregando || undefined} onClick={() => void verMais()}>{maisCarregando ? c.carregando : c.carregarMais}</Botao>
            : pagina.novas.length >= LIMITES_COMUNIDADE.porPagina && <p className="campo-dica">{c.fim}</p>}
        </section>
      )}
      {dialogo}
    </section>
  );
}

/** Na página pública sem conta: o convite para entrar (ver não pede conta; agir pede). */
export function ConviteEntrar() {
  return (
    <div className="explorar__convite">
      <p>{c.entrarParaAgir}</p>
      <Botao onClick={() => entrarEVoltar('/explorar')}>{c.entrar}</Botao>
    </div>
  );
}

/** Grade de cartões do perfil público (/p e a prévia da dona), com as mesmas ações do Explorar. */
export function CartoesDoPerfil({ inicial, logado, aoAdicionado, aoAbrir, titulo }: {
  inicial: CartaoTrilha[];
  logado: boolean;
  aoAdicionado: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoAbrir: (planoId: string) => void;
  titulo: string;
}) {
  const [cartoes, setLista] = useState(inicial);
  const [anuncio, setAnuncio] = useState('');
  const anunciar = (texto: string) => setAnuncio((anterior) => (anterior === texto ? `${texto} ` : texto));
  const { acoes, dialogo } = useAcoesDeCartao({
    logado, aoAdicionado, aoAbrir, anunciar,
    setCartoes: (mudar) => setLista((atual) => atual.map(mudar)),
  });
  return (
    <section className="perfil-cartoes" aria-labelledby="perfil-cartoes-titulo">
      <p className="somente-leitor" role="status" aria-live="polite">{anuncio}</p>
      <h2 id="perfil-cartoes-titulo" className="perfil-publico__titulo">{titulo}</h2>
      <ul className="grade-cartoes">
        {cartoes.map((cartao) => <li key={cartao.codigo}><CartaoDeTrilha cartao={cartao} acoes={acoes} /></li>)}
      </ul>
      {dialogo}
    </section>
  );
}

/** /p/<id>: os cartões com as ações; sem o app aberto, adicionar e abrir levam ao app. */
export function CartoesPublicos({ inicial, logado, titulo }: { inicial: CartaoTrilha[]; logado: boolean; titulo: string }) {
  return (
    <CartoesDoPerfil inicial={inicial} logado={logado} titulo={titulo}
      aoAbrir={(planoId) => abrirNoApp(planoId)}
      aoAdicionado={(planoId, nome, jaTinha) => abrirNoApp(planoId, jaTinha ? undefined : c.adicionada(nome))} />
  );
}

/** /explorar: o mesmo Explorar do app, com o convite para entrar quando não há sessão. */
export function ExplorarPublico({ inicial, logado }: { inicial: PaginaExplorar | null; logado: boolean }) {
  return (
    <Explorar logado={logado} inicial={inicial} topo={logado ? undefined : <ConviteEntrar />}
      aoAbrir={(planoId) => abrirNoApp(planoId)}
      aoAdicionado={(planoId, nome, jaTinha) => abrirNoApp(planoId, jaTinha ? undefined : c.adicionada(nome))}
      irParaTrilhas={() => window.location.assign('/')} />
  );
}

/** "Denunciar perfil", discreto, no fim da página /p (sem sessão, leva ao login). */
export function DenunciarPerfil({ perfilId, logado }: { perfilId: string; logado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <div className="denunciar-perfil">
      <Botao variante="texto" className="folha-parar" onClick={() => (logado ? setAberto(true) : entrarEVoltar('/explorar'))}>
        <Icone nome="bandeirinha" />{c.denuncia.tituloPerfil}
      </Botao>
      <p className="folha-status" role="status" aria-live="polite">{status}</p>
      {aberto && <DialogoDenuncia alvoTipo="perfil" alvo={perfilId} aoFechar={() => setAberto(false)} aoEnviar={(texto) => { setAberto(false); setStatus(texto); }} />}
    </div>
  );
}
