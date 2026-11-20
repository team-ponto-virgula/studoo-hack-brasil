'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

/*
 * Comunidade (spec 10, etapa B) na web: a capa gerada, o cartão de trilha (o mesmo no Explorar, no perfil e na
 * prévia), a tela Explorar (no app e na página pública /explorar), o Valeu e o diálogo de Denunciar.
 * Tudo só aparece com `comunidade` no /api/auth/config.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  LIMITES_COMUNIDADE,
  TEMAS,
  ehCapaFoto,
  marcacaoCapa,
  type CartaoTrilha,
  type PaginaExplorar,
  type Tema,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone, Stu } from '../ui';
import { Avatar, CHAVE_DEPOIS_DO_LOGIN, useAbrirNoApp, codigoDoErro, guardar, urlDoLink, useDialogo } from './compartilhar';
import { tocaSons } from './sons';
import type { IdEfeitoSonoro } from '../../packages/contratos/src/catalogo-sons';
import { MenuPublicacao, useVersaoComunidade } from './seguranca-comunidade';
import './comunidade.css';

const c = mensagens.comunidade;
const temas = mensagens.temas;

/** Leva ao login e volta para `caminho` depois (um link de trilha ou o Explorar). */
function useEntrarEVoltar() {
  const router = useRouter();
  return (caminho: string) => {
    guardar(CHAVE_DEPOIS_DO_LOGIN, caminho);
    router.push('/login');
  };
}

/** A capa: cor do tema e um padrão geométrico determinístico pelo código (sem imagem enviada, sem IA). */
export function CapaTrilha({ codigo, tema, capa }: { codigo: string; tema: Tema | null; capa?: string | null }) {
  // O SVG é gerado por uma função pura do contrato: só formas, com o código já restrito a [A-Za-z0-9_-].
  return <span className="capa-trilha" aria-hidden="true" data-foto={ehCapaFoto(capa) || undefined} dangerouslySetInnerHTML={{ __html: marcacaoCapa({ codigo, tema, capa }) }} />;
}

export type AcoesCartao = {
  /** Sem sessão, cada ação leva ao login (e volta). */
  logado: boolean;
  queroEstudar: (cartao: CartaoTrilha) => void;
  abrir: (planoId: string) => void;
  valeu: (cartao: CartaoTrilha) => void;
  compartilhar: (cartao: CartaoTrilha) => void;
  /** O código do cartão em andamento ("Adicionando…", valeu indo). */
  ocupado: string | null;
};

/**
 * Cartão de trilha: capa (tema e, se for o caso, "Demonstração"), título (abre a prévia /t), quem fez (foto e nome,
 * levam ao perfil), legenda, "6 lições · 3 partes", "12 estudando · 8 valeus" e as ações: Quero estudar / Continuar /
 * Sua trilha, Valeu (liga e desliga), Compartilhar e "•••" com Denunciar.
 */
export function CartaoDeTrilha({ cartao, acoes, posicao, nivel = 'h3', semDono = false }: { cartao: CartaoTrilha; acoes: AcoesCartao; posicao?: number; nivel?: 'h2' | 'h3'; semDono?: boolean }) {
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
        <CapaTrilha codigo={cartao.codigo} tema={cartao.tema} capa={cartao.capa} />
        {posicao !== undefined && <span className="cartao-trilha__posicao" aria-hidden="true">{posicao}</span>}
        {/* O tema sempre inteiro no alto; "Demonstração" embaixo à esquerda; o numeral do Em alta embaixo à direita. */}
        {cartao.tema && <span className="cartao-trilha__tema">{temas[cartao.tema]}</span>}
        {cartao.demonstracao && <span className="cartao-trilha__demo">{c.demonstracao}</span>}
      </div>
      <div className="cartao-trilha__corpo">
        {posicao !== undefined && <p className="somente-leitor">{c.posicao(posicao)}</p>}
        <Titulo id={tituloId} className="cartao-trilha__titulo"><Link href={`/t/${cartao.codigo}`}>{cartao.titulo}</Link></Titulo>
        {!semDono && (
          <p className="cartao-trilha__dono">
            {cartao.dono.perfilId
              ? <Link href={`/p/${cartao.dono.perfilId}`} aria-label={c.perfilDe(cartao.dono.nome)}>
                <Avatar nome={cartao.dono.nome} cor={cartao.dono.cor} foto={cartao.dono.foto} />
                <span className="cartao-trilha__por">por </span><span className="cartao-trilha__nome">{cartao.dono.nome}</span>
              </Link>
              : <><Avatar nome={cartao.dono.nome} cor={cartao.dono.cor} foto={cartao.dono.foto} /><span>{c.por(cartao.dono.nome)}</span></>}
          </p>
        )}
        {cartao.legenda && <p className="cartao-trilha__legenda">{cartao.legenda}</p>}
        {/* Contagem e números ancorados logo acima dos botões: as últimas linhas batem na fileira. */}
        <div className="cartao-trilha__rodape">
          <p className="cartao-trilha__meta">{c.contagem(cartao.totalLicoes, cartao.totalPartes)}</p>
          {cartao.estudando === 0 && cartao.valeus === 0
            ? <p className="cartao-trilha__numeros"><span className="cartao-trilha__nova" aria-label={c.novaRotulo}>{c.nova}</span></p>
            // A contagem de valeus mora no próprio botão (na trilha própria, que não tem o botão, fica aqui).
            : <p className="cartao-trilha__numeros">{[cartao.estudando > 0 && c.estudando(cartao.estudando), sua && cartao.valeus > 0 && c.valeus(cartao.valeus)].filter(Boolean).join(' · ')}</p>}
        </div>
        <div className="cartao-trilha__acoes" data-sua={sua || undefined}>
          {principal}
          {!sua && (
            // Coração, "Valeu" e a contagem; marcado, o coração enche (com um pulo curto) e tocar de novo retira.
            <button type="button" className="cartao-trilha__valeu" aria-pressed={Boolean(cartao.valeuMeu)}
              aria-label={`${cartao.valeuMeu ? c.valeuMarcadoRotulo(cartao.titulo) : c.valeuRotulo(cartao.titulo)}${cartao.valeus > 0 ? ` (${c.valeus(cartao.valeus)})` : ''}`}
              disabled={ocupado} onClick={() => acoes.valeu(cartao)}>
              <Icone nome="valeu" /><span aria-hidden="true">{c.valeu}</span>
              {cartao.valeus > 0 && <span className="cartao-trilha__valeu-n" aria-hidden="true">{cartao.valeus}</span>}
            </button>
          )}
          {sua
            // Na própria trilha, o compartilhar ocupa a linha, com o ícone e a palavra.
            ? <Botao variante="secundario" className="cartao-trilha__compartilhar" aria-label={c.compartilharRotulo(cartao.titulo)} onClick={() => acoes.compartilhar(cartao)}><Icone nome="compartilhar" />{c.compartilhar}</Botao>
            : <button type="button" className="cartao-trilha__icone" aria-label={c.compartilharRotulo(cartao.titulo)} onClick={() => acoes.compartilhar(cartao)}><Icone nome="compartilhar" /></button>}
          {!sua && <MenuPublicacao tipo="trilha" alvo={cartao.codigo} nome={cartao.dono.nome} titulo={cartao.titulo} logado={acoes.logado} />}
        </div>
      </div>
    </article>
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
  const entrarEVoltar = useEntrarEVoltar();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, avisar] = useAvisoDoApp();
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
      if (ativo) void tocaSons.tocarEfeito('valeu');
      // Otimista: muda na hora e desfaz se falhar.
      setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, valeuMeu: ativo, valeus: Math.max(0, atual.valeus + (ativo ? 1 : -1)) } : atual));
      try {
        const r = await cliente.valeu(cartao.codigo, ativo);
        setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, valeuMeu: r.valeuMeu, valeus: r.valeus } : atual));
        // Toda vez, o aviso do próprio app (com papel de status: o leitor de tela também ouve).
        avisar(ativo ? c.valeuAviso(cartao.dono.nome.trim().split(/\s+/)[0] ?? cartao.dono.nome) : c.valeuRetiradoAviso, null);
      } catch (falha) {
        setCartoes((atual) => (atual.codigo === cartao.codigo ? { ...atual, valeuMeu: cartao.valeuMeu, valeus: cartao.valeus } : atual));
        const codigo = codigoDoErro(falha);
        if (codigo === 'nao_autenticado') return entrarEVoltar('/explorar');
        anunciar(textoErro(codigo));
      }
    },
    async compartilhar(cartao) {
      const url = urlDoLink(cartao.codigo);
      if (typeof navigator.share === 'function') {
        try { await navigator.share({ title: cartao.titulo, text: mensagens.compartilhar.textoCompartilhar(cartao.titulo), url }); } catch { /* fechou */ }
        return;
      }
      try { await navigator.clipboard.writeText(url); void tocaSons.tocarEfeito('link_copiado'); anunciar(c.linkCopiado); } catch { anunciar(mensagens.compartilhar.copiarFalhou); }
    },
  };
  return { acoes, dialogo: aviso };
}

/**
 * Fileira rolável (Em alta e fichas de tema): diz se rola, se está no começo ou no fim (para o esmaecimento nas bordas e
 * as setas desligadas) e rola por "páginas".
 */
function useFileira<T extends HTMLElement>(dependencia: unknown) {
  const ref = useRef<T>(null);
  const [estado, setEstado] = useState({ rola: false, inicio: true, fim: true });
  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rola = el.scrollWidth > el.clientWidth + 2;
    setEstado({ rola, inicio: el.scrollLeft <= 2, fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    el.addEventListener('scroll', medir, { passive: true });
    return () => { observador.disconnect(); el.removeEventListener('scroll', medir); };
  }, [medir, dependencia]);
  function rolar(direcao: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: direcao * el.clientWidth * 0.85, behavior: reduzido ? 'auto' : 'smooth' });
  }
  return { ref, ...estado, rolar };
}

/** As setas de uma fileira (só com ponteiro fino): a da esquerda desligada no começo, a da direita no fim. */
function Setas({ fileira, rotulo }: { fileira: { rola: boolean; inicio: boolean; fim: boolean; rolar: (d: 1 | -1) => void }; rotulo?: string }) {
  return (
    <div className="fileira__setas" hidden={!fileira.rola} role={rotulo ? 'group' : undefined} aria-label={rotulo}>
      <button type="button" className="cartao-trilha__icone" aria-label={c.anteriores} disabled={fileira.inicio} onClick={() => fileira.rolar(-1)}><Icone nome="setaVoltar" /></button>
      <button type="button" className="cartao-trilha__icone" aria-label={c.proximas} disabled={fileira.fim} onClick={() => fileira.rolar(1)}><Icone nome="seta" /></button>
    </div>
  );
}

/**
 * Aviso do próprio app (nunca do sistema): uma faixa no pé da tela, acima da barra de abas, que some sozinha em 4,5 s.
 * Tem papel de status, então o leitor de tela também anuncia.
 */
export function useAvisoDoApp(): [ReactNode, (texto: string, som?: IdEfeitoSonoro | null) => void] {
  const [texto, setTexto] = useState('');
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!texto) return;
    const relogio = window.setTimeout(() => setTexto(''), 4500);
    return () => window.clearTimeout(relogio);
  }, [texto, vez]);
  /** `som`: o efeito do aviso (`aviso`, sem dizer nada); `null` quando o gesto já tocou o seu (como o curtir). */
  const avisar = useCallback((novo: string, som: IdEfeitoSonoro | null = 'aviso') => {
    if (som) void tocaSons.tocarEfeito(som);
    setTexto(novo);
    setVez((n) => n + 1);
  }, []);
  const elemento = (
    <div className="aviso-app" role="status" aria-live="polite" data-visivel={texto ? true : undefined}>
      {texto && <p key={vez}>{texto}</p>}
    </div>
  );
  return [elemento, avisar];
}

/** Lista horizontal do "Em alta": numeral grande no canto da capa, com encaixe ao rolar e setas (com ponteiro fino). */
function EmAlta({ cartoes, acoes, titulo }: { cartoes: CartaoTrilha[]; acoes: AcoesCartao; titulo: string }) {
  const fileira = useFileira<HTMLOListElement>(cartoes.length);
  const tituloId = useId();
  return (
    <section className="em-alta" aria-labelledby={tituloId}>
      <div className="em-alta__topo">
        <div>
          <h2 id={tituloId} className="explorar__secao">{titulo}</h2>
          <p className="campo-dica">{c.emAltaDica}</p>
        </div>
        <Setas fileira={fileira} />
      </div>
      <ol className="em-alta__lista fileira" ref={fileira.ref} data-poucas={cartoes.length < 3 || undefined}
        data-rola={fileira.rola || undefined} data-inicio={fileira.inicio || undefined} data-fim={fileira.fim || undefined}>
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
  // Aba "Seguindo" (etapa C2, só com sessão): as trilhas de quem a pessoa segue, mais novas primeiro.
  const [aba, setAba] = useState<'todos' | 'seguindo'>('todos');
  const [pagina, setPagina] = useState<PaginaExplorar | null>(inicial);
  const [carregando, setCarregando] = useState(!inicial);
  const [maisCarregando, setMaisCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const titulo = useRef<HTMLHeadingElement>(null);
  const versao = useVersaoComunidade();
  const primeira = useRef(Boolean(inicial));
  const anunciar = (texto: string) => setAnuncio((anterior) => (anterior === texto ? `${texto} ` : texto));

  useEffect(() => { titulo.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    let ativo = true;
    setCarregando(true);
    setErro(null);
    cliente.explorar({ tema, seguindo: aba === 'seguindo' }).then((dados) => { if (ativo) setPagina(dados); })
      .catch((falha) => { if (ativo) setErro(textoErro(codigoDoErro(falha))); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tema, aba, versao]);

  async function verMais() {
    if (!pagina?.cursor) return;
    setMaisCarregando(true);
    try {
      const proxima = await cliente.explorar({ tema, cursor: pagina.cursor, seguindo: aba === 'seguindo' });
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
  const fichas = useFileira<HTMLDivElement>(logado);
  const comDemonstracao = Boolean(pagina && [...pagina.emAlta, ...pagina.novas].some((cartao) => cartao.demonstracao));
  // Na aba Seguindo sem ninguém seguido, as fichas de tema não têm o que filtrar.
  const semFichas = aba === 'seguindo' && pagina?.seguindoAlguem === false;

  return (
    <section className="painel painel--explorar" aria-busy={carregando || undefined}>
      <p className="somente-leitor" role="status" aria-live="polite">{anuncio}</p>
      {topo}
      <header className="explorar__topo">
        <h1 ref={titulo} tabIndex={-1}>{c.titulo}</h1>
        <p className="explorar__subtitulo">{c.subtitulo}</p>
        {comDemonstracao && <p className="explorar__demo"><span className="cartao-trilha__demo">{c.demonstracao}</span>{c.demonstracaoExplica.replace(`“${c.demonstracao}” `, '')}</p>}
      </header>

      {logado && (
        <div className="explorar__abas" role="group" aria-label={c.abasRotulo}>
          <button type="button" className="explorar__aba" aria-pressed={aba === 'todos'} onClick={() => setAba('todos')}>{c.abaTodos}</button>
          <button type="button" className="explorar__aba" aria-pressed={aba === 'seguindo'} onClick={() => setAba('seguindo')}><Icone nome="pessoa" />{c.abaSeguindo}</button>
        </div>
      )}

      {!semFichas && (
        <div className="explorar__fichas">
          {/* Uma linha só, rolável, com esmaecimento na borda que ainda tem fichas e as mesmas setas do Em alta. */}
          <div className="explorar__temas fileira" role="group" aria-label={c.temas} ref={fichas.ref}
            data-rola={fichas.rola || undefined} data-inicio={fichas.inicio || undefined} data-fim={fichas.fim || undefined}>
            <button type="button" className="ficha-tema" aria-pressed={tema === null} onClick={() => setTema(null)}>{c.todos}</button>
            {TEMAS.map((opcao) => (
              <button key={opcao} type="button" className="ficha-tema" aria-pressed={tema === opcao} onClick={() => setTema(opcao)}>{temas[opcao]}</button>
            ))}
          </div>
          <Setas fileira={fichas} />
        </div>
      )}

      {erro && <p className="campo-erro" role="alert">{erro}</p>}
      {carregando && !pagina && <div className="explorar__esqueleto" aria-hidden="true"><span /><span /><span /></div>}

      {pagina && vazio && aba === 'seguindo' && (
        <div className="explorar__vazio">
          <Stu expressao="stu-curioso" tamanho={96} animado="uma-vez" />
          <div>
            <h2 className="explorar__secao">{pagina.seguindoAlguem ? c.seguidosSemTrilhas : c.vazioSeguindoTitulo}</h2>
            {!pagina.seguindoAlguem && <p className="folha-texto">{c.vazioSeguindoTexto}</p>}
            <Botao variante="secundario" onClick={() => { setTema(null); setAba('todos'); }}>{c.vazioSeguindoAcao}</Botao>
          </div>
        </div>
      )}
      {pagina && vazio && aba === 'todos' && (
        <div className="explorar__vazio">
          <Stu expressao="stu-curioso" tamanho={96} animado="uma-vez" />
          <div>
            <h2 className="explorar__secao">{tema ? c.vazioTema(temas[tema]) : c.vazioTitulo}</h2>
            <p className="folha-texto">{tema ? c.vazioTemaTexto : c.vazioTexto}</p>
            {tema
              ? <Botao variante="secundario" onClick={() => setTema(null)}>{c.vazioTemaAcao}</Botao>
              : logado && irParaTrilhas && <Botao onClick={irParaTrilhas}>{c.vazioAcao}</Botao>}
          </div>
        </div>
      )}

      {pagina && pagina.emAlta.length > 0 && <EmAlta cartoes={pagina.emAlta} acoes={acoes} titulo={tema ? c.emAltaDoTema(temas[tema]) : c.emAlta} />}

      {pagina && pagina.novas.length > 0 && (
        <section className="explorar__novas" aria-labelledby="explorar-novas">
          <h2 id="explorar-novas" className="explorar__secao">{aba === 'seguindo' ? c.seguindoTitulo : tema ? c.novasDoTema(temas[tema]) : c.novas}</h2>
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
  const entrarEVoltar = useEntrarEVoltar();
  return (
    <div className="explorar__convite">
      <p>{c.entrarParaAgir}</p>
      <Botao onClick={() => entrarEVoltar('/explorar')}>{c.entrar}</Botao>
    </div>
  );
}

/** Grade de cartões do perfil público (/p e a prévia da dona), com as mesmas ações do Explorar. */
export function CartoesDoPerfil({ inicial, logado, aoAdicionado, aoAbrir, titulo, classeTitulo = 'perfil-publico__titulo', semDono = false }: {
  /** Na página da própria pessoa, o "por …" do cartão repete o cabeçalho: sai. */
  semDono?: boolean;
  classeTitulo?: string;
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
      <h2 id="perfil-cartoes-titulo" className={classeTitulo}>{titulo}</h2>
      <ul className="grade-cartoes">
        {cartoes.map((cartao) => <li key={cartao.codigo}><CartaoDeTrilha cartao={cartao} acoes={acoes} semDono={semDono} /></li>)}
      </ul>
      {dialogo}
    </section>
  );
}

/** /p/<id>: os cartões com as ações; sem o app aberto, adicionar e abrir levam ao app. */
export function CartoesPublicos({ inicial, logado, titulo }: { inicial: CartaoTrilha[]; logado: boolean; titulo: string }) {
  const abrirNoApp = useAbrirNoApp();
  return (
    <CartoesDoPerfil inicial={inicial} logado={logado} titulo={titulo} semDono
      aoAbrir={(planoId) => abrirNoApp(planoId)}
      aoAdicionado={(planoId, nome, jaTinha) => abrirNoApp(planoId, jaTinha ? undefined : c.adicionada(nome))} />
  );
}

/** /explorar: o mesmo Explorar do app, com o convite para entrar quando não há sessão. */
export function ExplorarPublico({ inicial, logado }: { inicial: PaginaExplorar | null; logado: boolean }) {
  const abrirNoApp = useAbrirNoApp();
  const router = useRouter();
  return (
    <Explorar logado={logado} inicial={inicial} topo={logado ? undefined : <ConviteEntrar />}
      aoAbrir={(planoId) => abrirNoApp(planoId)}
      aoAdicionado={(planoId, nome, jaTinha) => abrirNoApp(planoId, jaTinha ? undefined : c.adicionada(nome))}
      irParaTrilhas={() => router.push('/')} />
  );
}

/**
 * "← Voltar" no topo do /p e do /t para quem está com a conta aberta: volta para de onde a pessoa veio (dentro do
 * Studoo); sem histórico, vai para o Explorar (ou para o início, sem a comunidade).
 */
export function VoltarDaPagina({ destino }: { destino: string }) {
  const router = useRouter();
  function voltar() {
    const entrada = performance.getEntriesByType('navigation')[0]?.name;
    const veioDoStudoo = window.history.length > 1 && ((entrada && new URL(entrada).pathname !== location.pathname)
      || (document.referrer && new URL(document.referrer).origin === location.origin));
    if (veioDoStudoo) window.history.back();
    else router.push(destino);
  }
  return (
    <Botao variante="texto" className="voltar-pagina" onClick={voltar}>
      <Icone nome="setaVoltar" />{mensagens.compartilhar.voltar}
    </Botao>
  );
}
