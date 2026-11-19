'use client';

/*
 * Comunidade (spec 10, etapa B) na web: a capa gerada, o cartão de trilha (o mesmo no Explorar, no perfil e na
 * prévia), a tela Explorar (no app e na página pública /explorar), o Valeu e o diálogo de Denunciar.
 * Tudo só aparece com `comunidade` no /api/auth/config.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  LIMITES_COMUNIDADE,
  MOTIVOS_DENUNCIA,
  TEMAS,
  ehCapaFoto,
  marcacaoCapa,
  type CartaoTrilha,
  type MotivoDenuncia,
  type PaginaExplorar,
  type Tema,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone, Stu } from '../ui';
import { Avatar, CHAVE_DEPOIS_DO_LOGIN, abrirNoApp, codigoDoErro, guardar, urlDoLink, useDialogo } from './compartilhar';
import { tocaSons } from './sons';
import type { IdEfeitoSonoro } from '../../packages/contratos/src/catalogo-sons';
import './comunidade.css';

const c = mensagens.comunidade;
const temas = mensagens.temas;

/** Leva ao login e volta para `caminho` depois (um link de trilha ou o Explorar). */
export function entrarEVoltar(caminho: string) {
  guardar(CHAVE_DEPOIS_DO_LOGIN, caminho);
  window.location.assign('/login');
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
export function CartaoDeTrilha({ cartao, acoes, posicao, nivel = 'h3', semDono = false }: { cartao: CartaoTrilha; acoes: AcoesCartao; posicao?: number; nivel?: 'h2' | 'h3'; semDono?: boolean }) {
  const Titulo = nivel;
  const tituloId = useId();
  const sua = cartao.situacao === 'sua';
  const ocupado = acoes.ocupado === cartao.codigo;
  const numeros = [cartao.estudando > 0 && c.estudando(cartao.estudando), sua && cartao.valeus > 0 && c.valeus(cartao.valeus)].filter((item): item is string => Boolean(item));
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
        <Titulo id={tituloId} className="cartao-trilha__titulo"><a href={`/t/${cartao.codigo}`}>{cartao.titulo}</a></Titulo>
        {!semDono && (
          <p className="cartao-trilha__dono">
            {cartao.dono.perfilId
              ? <a href={`/p/${cartao.dono.perfilId}`} aria-label={c.perfilDe(cartao.dono.nome)}>
                <Avatar nome={cartao.dono.nome} cor={cartao.dono.cor} foto={cartao.dono.foto} />
                <span className="cartao-trilha__por">por </span><span className="cartao-trilha__nome">{cartao.dono.nome}</span>
              </a>
              : <><Avatar nome={cartao.dono.nome} cor={cartao.dono.cor} foto={cartao.dono.foto} /><span>{c.por(cartao.dono.nome)}</span></>}
          </p>
        )}
        {cartao.legenda && <p className="cartao-trilha__legenda">{cartao.legenda}</p>}
        {/* Contagem e números ancorados logo acima dos botões: as últimas linhas batem na fileira. */}
        <div className="cartao-trilha__rodape">
          <p className="cartao-trilha__meta">{c.contagem(cartao.totalLicoes, cartao.totalPartes)}</p>
          {/* Altura fixa: "N estudando" ou "Nova". A curtida mora no botão e não mexe nesta linha (na trilha própria,
              que não tem o botão, a contagem vem aqui: "5 estudando · 6 curtidas"). */}
          {numeros.length > 0
            ? <p className="cartao-trilha__numeros">{numeros.join(' · ')}</p>
            : <p className="cartao-trilha__numeros"><span className="cartao-trilha__nova" aria-label={c.novaRotulo}>{c.nova}</span></p>}
        </div>
        <div className="cartao-trilha__acoes" data-sua={sua || undefined}>
          {principal}
          {!sua && <BotaoCurtir titulo={cartao.titulo} curtido={Boolean(cartao.valeuMeu)} curtidas={cartao.valeus} aoTocar={() => acoes.valeu(cartao)} />}
          {sua
            // Na própria trilha, o compartilhar ocupa a linha, com o ícone e a palavra.
            ? <Botao variante="secundario" className="cartao-trilha__compartilhar" aria-label={c.compartilharRotulo(cartao.titulo)} onClick={() => acoes.compartilhar(cartao)}><Icone nome="compartilhar" />{c.compartilhar}</Botao>
            : <button type="button" className="cartao-trilha__icone" aria-label={c.compartilharRotulo(cartao.titulo)} onClick={() => acoes.compartilhar(cartao)}><Icone nome="compartilhar" /></button>}
          {!sua && <MenuCartao titulo={cartao.titulo} aoDenunciar={() => acoes.denunciar(cartao)} />}
        </div>
      </div>
    </article>
  );
}

/**
 * O número da curtida que rola: ao subir, o antigo sai para cima e o novo entra por baixo (ao descer, o contrário), em
 * 180 ms. Com movimento reduzido, a troca é na hora.
 */
function NumeroRolante({ n }: { n: number }) {
  const anterior = useRef(n);
  const [saindo, setSaindo] = useState<{ valor: number; direcao: 'sobe' | 'desce' } | null>(null);
  useEffect(() => {
    if (anterior.current === n) return;
    setSaindo({ valor: anterior.current, direcao: n > anterior.current ? 'sobe' : 'desce' });
    anterior.current = n;
    const relogio = window.setTimeout(() => setSaindo(null), 200);
    return () => window.clearTimeout(relogio);
  }, [n]);
  return (
    <span className="numero-rolante" data-direcao={saindo?.direcao} aria-hidden="true">
      {saindo && <span key={`s${saindo.valor}`} className="numero-rolante__saindo">{saindo.valor}</span>}
      <span key={n} className="numero-rolante__atual">{n}</span>
    </span>
  );
}

/**
 * O botão de curtir (cartão de trilha e mapa da trilha recebida): coração, "Curtir" e, com 1 ou mais, o número.
 * Nome acessível fixo ("Curtir “X”"), estado em `aria-pressed` e a contagem na descrição. Nunca desliga: o estado novo
 * aparece na hora e o envio corre por trás.
 */
export function BotaoCurtir({ titulo, curtido, curtidas, aoTocar, className = '' }: { titulo: string; curtido: boolean; curtidas: number; aoTocar: () => void; className?: string }) {
  const idContagem = useId();
  // Só o toque anima (curtiu: enche e pula; descurtiu: esvazia); o estado que já vem da lista não pula ao aparecer.
  const [gesto, setGesto] = useState<'curtiu' | 'descurtiu' | null>(null);
  return (
    <button type="button" className={`botao-curtir cartao-trilha__valeu ${className}`} aria-pressed={curtido} data-gesto={gesto ?? undefined}
      aria-label={c.valeuRotulo(titulo)} aria-describedby={curtidas > 0 ? idContagem : undefined}
      onClick={() => { setGesto(curtido ? 'descurtiu' : 'curtiu'); aoTocar(); }}>
      <Icone nome="valeu" /><span className="botao-curtir__palavra" aria-hidden="true">{c.valeu}</span>
      {curtidas > 0 && <NumeroRolante n={curtidas} />}
      {curtidas > 0 && <span id={idContagem} hidden>{c.valeus(curtidas)}</span>}
    </button>
  );
}

const CHAVE_GESTO_EXPLICADO = 'studoo.gestoExplicado';
/** O código de `?curtir=` já aplicado nesta página (uma vez só, mesmo com várias listas na tela). */
let curtirDaVoltaAplicado = false;

/** Para onde o login volta depois de um toque em Curtir sem sessão: a mesma página, com `?curtir=<código>`. */
function voltaComCurtir(codigo: string) {
  const caminho = window.location.pathname;
  const base = /^\/(?:t|p)\/[A-Za-z0-9_-]{16}$/.test(caminho) || caminho === '/explorar' ? caminho : '/explorar';
  return `${base}?curtir=${codigo}`;
}

export type EstadoCurtida = { valeuMeu: boolean; valeus: number };
export type AlvoCurtida = EstadoCurtida & { codigo: string; titulo: string; donoNome: string };

/**
 * A lógica de curtir, a mesma no cartão e no mapa: muda na hora (otimista); com um envio em andamento, guarda o estado
 * desejado e, quando a resposta chega, manda de novo só se ainda for diferente (vale o último toque). Erro: volta ao
 * último estado confirmado e o aviso do app diz o que houve. O aviso que explica o gesto aparece só na primeira curtida
 * da pessoa neste aparelho. Sem sessão, leva à entrada e volta já curtindo (`?curtir=`, uma vez).
 */
export function useCurtir({ logado, aplicar, anunciar, avisar }: {
  logado: boolean;
  aplicar: (codigo: string, estado: EstadoCurtida) => void;
  anunciar: (texto: string) => void;
  avisar: AvisarApp;
}) {
  const desejado = useRef(new Map<string, boolean>());
  const confirmado = useRef(new Map<string, EstadoCurtida>());
  const emVoo = useRef(new Set<string>());
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;

  async function enviar(codigo: string) {
    emVoo.current.add(codigo);
    try {
      for (;;) {
        const alvo = desejado.current.get(codigo)!;
        const r = await cliente.valeu(codigo, alvo);
        confirmado.current.set(codigo, { valeuMeu: r.valeuMeu, valeus: r.valeus });
        if (desejado.current.get(codigo) === r.valeuMeu) { aplicarRef.current(codigo, { valeuMeu: r.valeuMeu, valeus: r.valeus }); break; }
      }
    } catch (falha) {
      const anterior = confirmado.current.get(codigo);
      if (anterior) aplicarRef.current(codigo, anterior);
      desejado.current.delete(codigo);
      const erro = codigoDoErro(falha);
      if (erro === 'nao_autenticado') { entrarEVoltar(voltaComCurtir(codigo)); return; }
      if (erro === 'compartilhar_visitante') {
        avisar(c.valeuContaTemporaria, { duracao: 8000, acao: { rotulo: c.entrar, aoTocar: () => { void cliente.logout().catch(() => null).finally(() => entrarEVoltar(voltaComCurtir(codigo))); } } });
        return;
      }
      // Sem rede, o cliente já tocou `erro_rede`.
      avisar(erro === 'rede' ? c.valeuErroRede : erro === 'limite_comunidade' ? c.valeuLimite : textoErro(erro), { som: erro === 'rede' ? null : 'aviso' });
    } finally {
      emVoo.current.delete(codigo);
    }
  }

  function curtir(alvo: AlvoCurtida) {
    if (!logado) { entrarEVoltar(voltaComCurtir(alvo.codigo)); return; }
    const novo = !alvo.valeuMeu;
    if (novo) void tocaSons.tocarEfeito('valeu');
    if (!emVoo.current.has(alvo.codigo)) confirmado.current.set(alvo.codigo, { valeuMeu: alvo.valeuMeu, valeus: alvo.valeus });
    desejado.current.set(alvo.codigo, novo);
    aplicarRef.current(alvo.codigo, { valeuMeu: novo, valeus: Math.max(0, alvo.valeus + (novo ? 1 : -1)) });
    anunciar(novo ? c.valeuEnviado(alvo.titulo) : c.valeuRetirado(alvo.titulo));
    if (novo) {
      let explicado = true;
      try { explicado = localStorage.getItem(CHAVE_GESTO_EXPLICADO) === '1'; if (!explicado) localStorage.setItem(CHAVE_GESTO_EXPLICADO, '1'); } catch { /* sem armazenamento: não explica */ }
      if (!explicado) avisar(c.valeuAviso(alvo.donoNome.trim().split(/\s+/)[0] || alvo.donoNome), { coracao: true, duracao: 5000, som: null });
    }
    if (!emVoo.current.has(alvo.codigo)) void enviar(alvo.codigo);
  }

  // Volta da entrada com `?curtir=<código>`: curte uma vez e limpa o endereço.
  useEffect(() => {
    if (!logado || curtirDaVoltaAplicado) return;
    const parametros = new URLSearchParams(window.location.search);
    const codigo = parametros.get('curtir');
    if (!codigo || !/^[A-Za-z0-9_-]{16}$/.test(codigo)) return;
    curtirDaVoltaAplicado = true;
    parametros.delete('curtir');
    const resto = parametros.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${resto ? `?${resto}` : ''}`);
    cliente.valeu(codigo, true).then((r) => aplicarRef.current(codigo, { valeuMeu: r.valeuMeu, valeus: r.valeus })).catch(() => null);
  }, [logado]);

  return curtir;
}

/**
 * Curtir no mapa da trilha recebida (bloco "Esta trilha é de <nome>"), com o link original ativo: quem chega ao fim de
 * uma trilha é quem mais tem motivo para agradecer. Mesmo botão e mesma lógica do cartão.
 */
export function CurtirTrilhaRecebida({ codigo, titulo, donoNome, curtido, curtidas, anunciar }: {
  codigo: string; titulo: string; donoNome: string; curtido: boolean; curtidas: number; anunciar: (texto: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoCurtida>({ valeuMeu: curtido, valeus: curtidas });
  // A trilha recarregada traz o número de agora.
  useEffect(() => { setEstado({ valeuMeu: curtido, valeus: curtidas }); }, [curtido, curtidas]);
  const [aviso, avisar] = useAvisoDoApp();
  const curtir = useCurtir({ logado: true, anunciar, avisar, aplicar: (_codigo, novo) => setEstado(novo) });
  return (
    <>
      <BotaoCurtir className="trilha-recebida__curtir" titulo={titulo} curtido={estado.valeuMeu} curtidas={estado.valeus}
        aoTocar={() => curtir({ codigo, titulo, donoNome, ...estado })} />
      {aviso}
    </>
  );
}

/** Denunciar trilha ou perfil: motivo (rádio), enviar; foco preso, Esc fecha e devolve o foco. */
export function DialogoDenuncia({ alvoTipo, alvo, alvoNome, aoFechar, aoEnviar }: {
  alvoTipo: 'trilha' | 'perfil';
  alvo: string;
  /** O que está sendo denunciado, por extenso: «"Redação para o ENEM", de Caio Prado» ou o nome da pessoa. */
  alvoNome: string;
  aoFechar: () => void;
  aoEnviar: (texto: string) => void;
}) {
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
        <p className="denuncia__alvo">{alvoNome}</p>
        <p id={textoId} className="folha-texto">{alvoTipo === 'trilha' ? c.denuncia.texto : c.denuncia.textoPerfil}</p>
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
          {/* Nenhum motivo vem marcado: "Enviar" só liga depois que a pessoa escolhe. */}
          <Botao variante="secundario" className="modal-confirmar--destrutivo" disabled={enviando || !motivo} aria-busy={enviando || undefined} onClick={() => void enviar()}>{enviando ? c.denuncia.enviando : c.denuncia.enviar}</Botao>
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
  const [aviso, avisar] = useAvisoDoApp();
  const curtir = useCurtir({
    logado, anunciar, avisar,
    aplicar: (codigo, estado) => setCartoes((atual) => (atual.codigo === codigo ? { ...atual, ...estado } : atual)),
  });
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
    valeu(cartao) {
      curtir({ codigo: cartao.codigo, titulo: cartao.titulo, donoNome: cartao.dono.nome, valeuMeu: Boolean(cartao.valeuMeu), valeus: cartao.valeus });
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
      try { await navigator.clipboard.writeText(url); void tocaSons.tocarEfeito('link_copiado'); anunciar(c.linkCopiado); } catch { anunciar(mensagens.compartilhar.copiarFalhou); }
    },
  };
  const dialogo = denuncia ? (
    <DialogoDenuncia alvoTipo="trilha" alvo={denuncia.codigo} alvoNome={c.denuncia.alvoTrilha(denuncia.titulo, denuncia.dono.nome)} aoFechar={() => setDenuncia(null)}
      aoEnviar={(texto) => { setDenuncia(null); avisar(texto); }} />
  ) : null;
  return { acoes, dialogo: <>{dialogo}{aviso}</> };
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

export type OpcoesAviso = {
  /** Coração cheio à esquerda (o aviso que explica o Curtir). */
  coracao?: boolean;
  /** Em milissegundos (4,5 s sem nada). */
  duracao?: number;
  /** Um botão no aviso (ex.: "Entrar" da conta temporária); só aí o aviso recebe toque. */
  acao?: { rotulo: string; aoTocar: () => void };
  /** O efeito do aviso (`aviso`, sem dizer nada); `null` quando o gesto já tocou o seu (curtir, erro de rede). */
  som?: IdEfeitoSonoro | null;
};
export type AvisarApp = (texto: string, opcoes?: OpcoesAviso) => void;

/**
 * Aviso do próprio app (nunca do sistema): uma faixa no pé da tela, acima da barra de abas, que some sozinha. Um por
 * vez; tem papel de status, então o leitor de tela também anuncia, e não recebe foco.
 */
export function useAvisoDoApp(): [ReactNode, AvisarApp] {
  const [aviso, setAviso] = useState<{ texto: string; opcoes: OpcoesAviso; vez: number } | null>(null);
  useEffect(() => {
    if (!aviso) return;
    const relogio = window.setTimeout(() => setAviso(null), aviso.opcoes.duracao ?? 4500);
    return () => window.clearTimeout(relogio);
  }, [aviso]);
  const avisar = useCallback<AvisarApp>((texto, opcoes = {}) => {
    const som = opcoes.som === undefined ? 'aviso' : opcoes.som;
    if (som) void tocaSons.tocarEfeito(som);
    setAviso((atual) => ({ texto, opcoes, vez: (atual?.vez ?? 0) + 1 }));
  }, []);
  const elemento = (
    <div className="aviso-app" role="status" aria-live="polite" data-visivel={aviso ? true : undefined}>
      {aviso && (
        <p key={aviso.vez} data-acao={aviso.opcoes.acao ? true : undefined}>
          {aviso.opcoes.coracao && <span className="aviso-app__coracao" aria-hidden="true"><Icone nome="valeu" /></span>}
          <span className="aviso-app__texto">{aviso.texto}</span>
          {aviso.opcoes.acao && <button type="button" className="aviso-app__acao" onClick={() => { const acao = aviso.opcoes.acao!; setAviso(null); acao.aoTocar(); }}>{aviso.opcoes.acao.rotulo}</button>}
        </p>
      )}
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
  }, [tema, aba]);

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
  return (
    <CartoesDoPerfil inicial={inicial} logado={logado} titulo={titulo} semDono
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
export function DenunciarPerfil({ perfilId, logado, nome }: { perfilId: string; logado: boolean; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [status, setStatus] = useState('');
  return (
    <div className="denunciar-perfil">
      <Botao variante="texto" className="folha-parar" onClick={() => (logado ? setAberto(true) : entrarEVoltar('/explorar'))}>
        <Icone nome="bandeirinha" />{c.denuncia.tituloPerfil}
      </Botao>
      <p className="folha-status" role="status" aria-live="polite">{status}</p>
      {aberto && <DialogoDenuncia alvoTipo="perfil" alvo={perfilId} alvoNome={nome} aoFechar={() => setAberto(false)} aoEnviar={(texto) => { setAberto(false); setStatus(texto); }} />}
    </div>
  );
}

/**
 * "← Voltar" no topo do /p e do /t para quem está com a conta aberta: volta para de onde a pessoa veio (dentro do
 * Studoo); sem histórico, vai para o Explorar (ou para o início, sem a comunidade).
 */
export function VoltarDaPagina({ destino }: { destino: string }) {
  function voltar() {
    const veioDoStudoo = document.referrer.startsWith(window.location.origin) && window.history.length > 1;
    if (veioDoStudoo) window.history.back();
    else window.location.assign(destino);
  }
  return (
    <Botao variante="texto" className="voltar-pagina" onClick={voltar}>
      <Icone nome="setaVoltar" />{mensagens.compartilhar.voltar}
    </Botao>
  );
}
