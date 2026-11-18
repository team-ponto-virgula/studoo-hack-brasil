'use client';

/*
 * Perfis e compartilhar trilha (spec 09) na web: avatar, folha "Compartilhar trilha", confirmação, formulário do perfil,
 * tela Perfil, prévia da trilha compartilhada (página /t e "Adicionar por link") e as ações da página pública.
 * Tudo só aparece com `compartilhar` no /api/auth/config.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import {
  CORES_PERFIL,
  ErroStudoo,
  FUNDO_DA_COR,
  codigoDoLink,
  inicialDoNome,
  motivoNomeInvalido,
  normalizarNomePerfil,
  origemLegivel,
  type CorPerfil,
  type LinkCompartilhado,
  type Perfil,
  type PreviaCompartilhar,
  type TrilhaCompartilhada,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone } from '../ui';
import './compartilhar.css';

const m = mensagens.compartilhar;
const p = mensagens.perfil;

/** Depois do login (senha ou Google), o app volta para este caminho e conclui o que a pessoa começou. */
export const CHAVE_DEPOIS_DO_LOGIN = 'studoo.depoisDoLogin';
/** Abrir uma trilha ao chegar no app, com um aviso ("Trilha adicionada. Compartilhada por Ana."). */
export const CHAVE_ABRIR_PLANO = 'studoo.abrirPlano';
const CAMINHO_SEGURO = /^\/t\/[A-Za-z0-9_-]{16}(?:\?adicionar=1)?$/;

/** O caminho guardado para depois do login, só se for o de um link de trilha (nada de redirecionar para fora). */
export function caminhoDepoisDoLogin(): string | null {
  try {
    const caminho = sessionStorage.getItem(CHAVE_DEPOIS_DO_LOGIN);
    sessionStorage.removeItem(CHAVE_DEPOIS_DO_LOGIN);
    return caminho && CAMINHO_SEGURO.test(caminho) ? caminho : null;
  } catch {
    return null;
  }
}

export function planoParaAbrir(): { id: string; aviso?: string } | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_ABRIR_PLANO);
    sessionStorage.removeItem(CHAVE_ABRIR_PLANO);
    const dado = bruto ? (JSON.parse(bruto) as { id?: unknown; aviso?: unknown }) : null;
    return dado && typeof dado.id === 'string' ? { id: dado.id, ...(typeof dado.aviso === 'string' ? { aviso: dado.aviso } : {}) } : null;
  } catch {
    return null;
  }
}

function guardar(chave: string, valor: string) {
  try { sessionStorage.setItem(chave, valor); } catch { /* Sem armazenamento: a pessoa refaz o passo. */ }
}

export const urlDoLink = (codigo: string) => `${window.location.origin}/t/${codigo}`;
const codigoDoErro = (erro: unknown) => (erro instanceof ErroStudoo ? erro.codigo : 'rede');

export function Avatar({ nome, cor, grande = false }: { nome: string; cor: CorPerfil; grande?: boolean }) {
  return (
    <span className="avatar" data-grande={grande || undefined} style={{ background: FUNDO_DA_COR[cor] }} aria-hidden="true">
      {inicialDoNome(nome)}
    </span>
  );
}

/** Foco preso no diálogo, Esc fecha (ou volta um passo) e, ao fechar, o foco volta para quem abriu. */
function useDialogo(caixa: RefObject<HTMLElement | null>, aoEsc: () => void) {
  const aoEscRef = useRef(aoEsc);
  aoEscRef.current = aoEsc;
  useEffect(() => {
    const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        aoEscRef.current();
        return;
      }
      if (evento.key !== 'Tab' || !caixa.current) return;
      const focaveis = Array.from(caixa.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((el) => el.offsetParent !== null);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && (document.activeElement === primeiro || !caixa.current.contains(document.activeElement))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      window.requestAnimationFrame(() => origem?.isConnected && origem.focus());
    };
  }, [caixa]);
}

/** Confirmação no próprio produto (nunca `window.confirm`): título, texto e duas ações; a segura recebe o foco. */
export function DialogoConfirmar({ titulo, texto, confirmar, cancelar, ocupado = false, aoConfirmar, aoCancelar }: {
  titulo: string;
  texto: string;
  confirmar: string;
  cancelar: string;
  ocupado?: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const textoId = useId();
  useDialogo(caixa, aoCancelar);
  // A ação segura (cancelar) recebe o foco.
  useEffect(() => { caixa.current?.querySelector<HTMLButtonElement>('.folha-acoes button')?.focus(); }, []);
  return (
    <div className="folha-fundo folha-fundo--centro" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) aoCancelar(); }}>
      <div className="folha folha--confirmar" role="alertdialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={textoId} ref={caixa}>
        <h2 id={tituloId} className="folha-titulo">{titulo}</h2>
        <p id={textoId} className="folha-texto">{texto}</p>
        <div className="folha-acoes folha-acoes--par">
          <Botao variante="secundario" disabled={ocupado} onClick={aoCancelar}>{cancelar}</Botao>
          <Botao variante="secundario" className="modal-confirmar--destrutivo" disabled={ocupado} onClick={aoConfirmar}>{confirmar}</Botao>
        </div>
      </div>
    </div>
  );
}

/** Nome e cor do avatar, com a prévia "Compartilhada por Ana". Valida como o servidor (`motivoNomeInvalido`). */
export function FormPerfil({ inicial, enviarRotulo, aoSalvar, aoCancelar, tituloId }: {
  inicial?: { nome: string | null; cor: CorPerfil | null };
  enviarRotulo: string;
  aoSalvar: (perfil: Perfil) => void;
  aoCancelar?: () => void;
  tituloId?: string;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [cor, setCor] = useState<CorPerfil>(inicial?.cor ?? 'azul');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const idCampo = useId();
  const idDica = useId();
  const idErro = useId();
  const normalizado = normalizarNomePerfil(nome);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    const motivo = motivoNomeInvalido(normalizado);
    if (motivo) {
      setErro(p.nomeErros[motivo]);
      campo.current?.focus();
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      aoSalvar(await cliente.salvarPerfil(normalizado, cor));
    } catch (falha) {
      setErro(textoErro(codigoDoErro(falha)));
      setEnviando(false);
    }
  }

  return (
    <form className="form-perfil" onSubmit={salvar} noValidate aria-labelledby={tituloId}>
      <div className="campo">
        <label htmlFor={idCampo}>{m.nomeRotulo}</label>
        <input id={idCampo} ref={campo} value={nome} maxLength={60} autoComplete="nickname" autoCapitalize="words"
          aria-invalid={erro ? true : undefined} aria-describedby={`${idDica}${erro ? ` ${idErro}` : ''}`}
          onChange={(e) => { setNome(e.target.value); if (erro) setErro(null); }} />
        <p className="campo-dica" id={idDica}>{m.comoAparecerDica}</p>
        {erro && <p className="campo-erro" id={idErro} role="alert">{erro}</p>}
      </div>
      <fieldset className="cores-perfil">
        <legend>{m.corRotulo}</legend>
        <div className="cores-perfil__lista">
          {CORES_PERFIL.map((opcao) => (
            <label key={opcao} className="cor-perfil" style={{ '--cor': FUNDO_DA_COR[opcao] } as CSSProperties}>
              <input type="radio" name="cor-perfil" value={opcao} checked={cor === opcao} onChange={() => setCor(opcao)} />
              <span className="cor-perfil__amostra" aria-hidden="true" />
              <span className="somente-leitor">{m.cores[opcao]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="form-perfil__previa" aria-live="polite">
        <Avatar nome={normalizado || '?'} cor={cor} />
        <span>{m.compartilhadaPor(normalizado || '…')}</span>
      </p>
      <div className="folha-acoes">
        {aoCancelar && <Botao variante="secundario" disabled={enviando} onClick={aoCancelar}>{p.cancelar}</Botao>}
        <Botao type="submit" disabled={enviando} aria-busy={enviando || undefined}>{enviando ? p.salvando : enviarRotulo}</Botao>
      </div>
    </form>
  );
}

type Etapa = 'carregando' | 'perfil' | 'resumo' | 'pronto' | 'parar' | 'visitante' | 'erro';

/**
 * A folha "Compartilhar trilha": (a) sem nome, "Como você quer aparecer?"; (b) o que vai; (c) "Criar link"; (d) link
 * pronto, com Compartilhar (Web Share quando existe), Copiar link, "Mostrar no meu perfil" e "Parar de compartilhar"
 * (com confirmação própria). No celular sobe de baixo; no computador fica no centro.
 */
export function FolhaCompartilhar({ planoId, visitante, aoFechar, aoMudarLink, aoMudarPerfil, anunciar }: {
  planoId: string;
  visitante: boolean;
  aoFechar: () => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado | null) => void;
  aoMudarPerfil: (perfil: Perfil) => void;
  anunciar: (texto: string) => void;
}) {
  const [etapa, setEtapa] = useState<Etapa>(visitante ? 'visitante' : 'carregando');
  const [previa, setPrevia] = useState<PreviaCompartilhar | null>(null);
  const [link, setLink] = useState<LinkCompartilhado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const campoLink = useRef<HTMLInputElement>(null);
  const tituloId = useId();
  const dicaPerfilId = useId();
  const podeCompartilhar = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useDialogo(caixa, () => {
    if (etapa === 'parar') setEtapa('pronto');
    else if (!ocupado) aoFechar();
  });

  useEffect(() => {
    if (visitante) return;
    let ativo = true;
    cliente.previaCompartilhar(planoId).then((dados) => {
      if (!ativo) return;
      setPrevia(dados);
      setLink(dados.link);
      setEtapa(dados.link ? 'pronto' : dados.perfil ? 'resumo' : 'perfil');
    }).catch((falha) => {
      if (!ativo) return;
      setErro(codigoDoErro(falha));
      setEtapa('erro');
    });
    return () => { ativo = false; };
  }, [planoId, visitante]);

  // A cada passo, o foco vai ao título do passo (o leitor de tela anuncia onde a pessoa está).
  useEffect(() => {
    if (etapa === 'carregando') return;
    titulo.current?.focus();
  }, [etapa]);

  async function criarLink() {
    setOcupado(true);
    setErro(null);
    try {
      const novo = await cliente.criarLink(planoId);
      setLink(novo);
      aoMudarLink(planoId, novo);
      setEtapa('pronto');
      anunciar(m.linkPronto);
    } catch (falha) {
      setErro(codigoDoErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(urlDoLink(link.codigo));
      setStatus((anterior) => (anterior === m.copiado ? `${m.copiado} ` : m.copiado));
    } catch {
      campoLink.current?.select();
      setStatus(m.copiarFalhou);
    }
  }

  async function compartilhar() {
    if (!link || !previa) return;
    try {
      await navigator.share({ title: previa.titulo, text: m.textoCompartilhar(previa.titulo), url: urlDoLink(link.codigo) });
    } catch { /* A pessoa fechou a folha do sistema: nada a fazer. */ }
  }

  async function alterarPerfil(noPerfil: boolean) {
    if (!link) return;
    setOcupado(true);
    setErro(null);
    try {
      const alterado = await cliente.alterarLink(link.codigo, noPerfil);
      setLink(alterado);
      aoMudarLink(planoId, alterado);
    } catch (falha) {
      setErro(codigoDoErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  async function parar() {
    if (!link) return;
    setOcupado(true);
    setErro(null);
    try {
      await cliente.encerrarLink(link.codigo);
      setLink(null);
      aoMudarLink(planoId, null);
      anunciar(m.parado);
      aoFechar();
    } catch (falha) {
      setErro(codigoDoErro(falha));
      setEtapa('pronto');
      setOcupado(false);
    }
  }

  const tituloDaEtapa = etapa === 'perfil' ? m.comoAparecer : etapa === 'pronto' ? m.linkPronto : etapa === 'parar' ? m.pararTitulo : m.folhaTitulo;

  return (
    <div className="folha-fundo" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !ocupado && etapa !== 'parar') aoFechar(); }}>
      <div className="folha" role="dialog" aria-modal="true" aria-labelledby={tituloId} aria-busy={etapa === 'carregando' || ocupado || undefined} ref={caixa}>
        <div className="folha-topo">
          <p className="folha-contexto" aria-hidden={tituloDaEtapa === m.folhaTitulo || undefined}>{tituloDaEtapa === m.folhaTitulo ? '' : m.folhaTitulo}</p>
          {etapa !== 'parar' && (
            <button type="button" className="folha-fechar" aria-label={m.fechar} disabled={ocupado} onClick={aoFechar}><Icone nome="fechar" /></button>
          )}
        </div>
        <h2 id={tituloId} ref={titulo} tabIndex={-1} className="folha-titulo">{tituloDaEtapa}</h2>

        {etapa === 'carregando' && <div className="folha-esqueleto" aria-hidden="true"><span /><span /><span /></div>}
        {etapa === 'visitante' && (
          <>
            <p className="folha-texto">{m.visitante}</p>
            <div className="folha-acoes"><Botao onClick={aoFechar}>{m.fechar}</Botao></div>
          </>
        )}
        {etapa === 'erro' && (
          <>
            <p className="folha-texto" role="alert">{textoErro(erro ?? 'falha')}</p>
            <div className="folha-acoes"><Botao onClick={aoFechar}>{m.fechar}</Botao></div>
          </>
        )}
        {etapa === 'perfil' && (
          <FormPerfil enviarRotulo={m.continuar} tituloId={tituloId} aoSalvar={(perfil) => {
            aoMudarPerfil(perfil);
            setPrevia((anterior) => anterior && { ...anterior, perfil: perfil.nome && perfil.cor ? { nome: perfil.nome, cor: perfil.cor } : anterior.perfil });
            setEtapa('resumo');
          }} />
        )}
        {etapa === 'resumo' && previa && (
          <>
            <div className="folha-trilha">
              <p className="folha-trilha__rotulo">{m.oQueVai}</p>
              <p className="folha-trilha__titulo">{previa.titulo}</p>
              <p className="folha-trilha__contagem">{m.contagem(previa.totalLicoes, previa.totalPartes)}</p>
              {previa.perfil && (
                <p className="folha-trilha__por"><Avatar nome={previa.perfil.nome} cor={previa.perfil.cor} />{m.compartilhadaPor(previa.perfil.nome)}</p>
              )}
            </div>
            <p className="folha-texto">{m.doZero}</p>
            {previa.deMaterial && (
              <div className="folha-aviso" role="note">
                <p>{previa.tituloTemNomeDoArquivo ? m.avisoMaterialComTitulo : m.avisoMaterial}</p>
                {previa.tituloTemNomeDoArquivo && <p className="folha-aviso__titulo">{m.tituloComArquivo}</p>}
              </div>
            )}
            {erro && <p className="campo-erro" role="alert">{textoErro(erro)}</p>}
            <div className="folha-acoes">
              <Botao disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void criarLink()}>{ocupado ? m.criando : m.criarLink}</Botao>
            </div>
          </>
        )}
        {etapa === 'pronto' && link && previa && (
          <>
            <p className="folha-trilha__titulo">{previa.titulo}</p>
            <label className="folha-link">
              <span className="somente-leitor">{m.linkRotulo}</span>
              <input ref={campoLink} readOnly value={urlDoLink(link.codigo)} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <div className="folha-acoes folha-acoes--empilhadas">
              {podeCompartilhar && <Botao onClick={() => void compartilhar()}><Icone nome="compartilhar" />{m.compartilhar}</Botao>}
              <Botao variante={podeCompartilhar ? 'secundario' : 'primario'} onClick={() => void copiar()}><Icone nome="copiar" />{m.copiar}</Botao>
            </div>
            <p className="folha-status" role="status" aria-live="polite">{status}</p>
            <label className="chave">
              <input type="checkbox" role="switch" checked={link.noPerfil} disabled={ocupado} aria-describedby={dicaPerfilId}
                onChange={(e) => void alterarPerfil(e.target.checked)} />
              <span className="chave__trilho" aria-hidden="true" />
              <span className="chave__texto">{m.noPerfil}</span>
            </label>
            <p className="campo-dica" id={dicaPerfilId}>{m.noPerfilDica}</p>
            <p className="folha-texto folha-texto--miudo">{m.doZero}</p>
            {erro && <p className="campo-erro" role="alert">{textoErro(erro)}</p>}
            <Botao variante="texto" className="folha-parar" disabled={ocupado} onClick={() => setEtapa('parar')}>{m.parar}</Botao>
          </>
        )}
        {etapa === 'parar' && (
          <>
            <p className="folha-texto">{m.pararTexto}</p>
            <div className="folha-acoes folha-acoes--par">
              <Botao variante="secundario" disabled={ocupado} onClick={() => setEtapa('pronto')}>{m.pararCancelar}</Botao>
              <Botao variante="secundario" className="modal-confirmar--destrutivo" disabled={ocupado} onClick={() => void parar()}>{m.pararConfirmar}</Botao>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

/** Tela Perfil: avatar, nome e Editar; as trilhas que a pessoa compartilha; o perfil público; a conta e Sair. */
export function TelaPerfil({ perfil: inicial, aoMudarPerfil, aoMudarLink, abrirPlano, sair, anunciar }: {
  perfil: Perfil | null;
  aoMudarPerfil: (perfil: Perfil) => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado | null) => void;
  abrirPlano: (id: string) => void;
  sair: () => void;
  anunciar: (texto: string) => void;
}) {
  const [perfil, setPerfil] = useState<Perfil | null>(inicial);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [parando, setParando] = useState<LinkCompartilhado | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState('');
  const tituloEdicao = useId();
  const titulo = useRef<HTMLHeadingElement>(null);

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
      return { ...atual, links, publico: links.some((item) => item.noPerfil) };
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
      setCopiado((anterior) => (anterior === mensagens.compartilhar.copiado ? `${mensagens.compartilhar.copiado} ` : mensagens.compartilhar.copiado));
    } catch {
      setCopiado(mensagens.compartilhar.copiarFalhou);
    }
  }

  async function confirmarParada() {
    if (!parando) return;
    setOcupado(true);
    try {
      await cliente.encerrarLink(parando.codigo);
      trocarLink(parando, null);
      anunciar(mensagens.compartilhar.parado);
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
      <h1 ref={titulo} tabIndex={-1}>{p.titulo}</h1>
      {erro && <p className="campo-erro" role="alert">{textoErro(erro)}</p>}
      {!perfil && !erro && <div className="folha-esqueleto" aria-hidden="true"><span /><span /><span /></div>}
      {perfil && (
        <>
          <div className="perfil-cartao">
            {perfil.visitante ? (
              <p className="perfil-cartao__visitante">{p.visitante}</p>
            ) : editando || !perfil.nome ? (
              <>
                <h2 id={tituloEdicao} className="perfil-secao__titulo">{perfil.nome ? p.editar : m.comoAparecer}</h2>
                {!perfil.nome && <p className="folha-texto">{p.semNome}</p>}
                <FormPerfil inicial={{ nome: perfil.nome, cor: perfil.cor }} enviarRotulo={p.salvar} tituloId={tituloEdicao}
                  aoCancelar={perfil.nome ? () => setEditando(false) : undefined}
                  aoSalvar={(novo) => { setPerfil(novo); aoMudarPerfil(novo); setEditando(false); anunciar(p.salvo); }} />
              </>
            ) : (
              <div className="perfil-cartao__linha">
                <Avatar nome={perfil.nome} cor={perfil.cor ?? 'azul'} grande />
                <p className="perfil-cartao__nome">{perfil.nome}</p>
                <Botao variante="secundario" onClick={() => setEditando(true)}>{p.editar}</Botao>
              </div>
            )}
          </div>

          {!perfil.visitante && (
            <section className="perfil-secao" aria-labelledby="perfil-compartilhadas">
              <h2 id="perfil-compartilhadas" className="perfil-secao__titulo">{p.compartilhadas}</h2>
              {perfil.links.length === 0 ? <p className="folha-texto">{p.nenhuma}</p> : (
                <ul className="perfil-links">
                  {perfil.links.map((link) => (
                    <li key={link.codigo} className="perfil-link">
                      <button type="button" className="perfil-link__titulo" onClick={() => abrirPlano(link.planoId)}>{link.titulo}</button>
                      <p className="perfil-link__meta">{p.desde(dataCurta(link.criadoEm))} · {p.adicoes(link.adicoes)}</p>
                      <label className="chave">
                        <input type="checkbox" role="switch" checked={link.noPerfil} disabled={ocupado} onChange={(e) => void alterar(link, e.target.checked)} />
                        <span className="chave__trilho" aria-hidden="true" />
                        <span className="chave__texto">{m.noPerfil}<span className="somente-leitor">: {link.titulo}</span></span>
                      </label>
                      <div className="perfil-link__acoes">
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

          {!perfil.visitante && perfil.nome && (
            <section className="perfil-secao" aria-labelledby="perfil-publico">
              <h2 id="perfil-publico" className="perfil-secao__titulo">{p.publicoTitulo}</h2>
              <p className="folha-texto">{perfil.publico ? p.publico(perfil.links.filter((link) => link.noPerfil).length) : p.privado}</p>
              {perfil.publico && perfil.perfilId && (
                <a className="botao botao--secundario perfil-ver" href={`/p/${perfil.perfilId}`} target="_blank" rel="noopener">{p.verComoOutros}</a>
              )}
            </section>
          )}

          <section className="perfil-secao" aria-labelledby="perfil-conta">
            <h2 id="perfil-conta" className="perfil-secao__titulo">{p.conta}</h2>
            {!perfil.visitante && <p className="perfil-conta__email"><span>{p.email}</span> {perfil.email}</p>}
            <Botao variante="secundario" onClick={sair}>{mensagens.sair}</Botao>
          </section>
        </>
      )}
      {parando && (
        <DialogoConfirmar titulo={m.pararTitulo} texto={m.pararTexto} confirmar={m.pararConfirmar} cancelar={m.pararCancelar}
          ocupado={ocupado} aoConfirmar={() => void confirmarParada()} aoCancelar={() => setParando(null)} />
      )}
    </section>
  );
}

/**
 * A prévia de uma trilha compartilhada, igual na página /t e no "Adicionar por link": de quem é, título, contagem e
 * origem, as ações logo abaixo (visíveis sem rolar) e as lições por parte.
 */
export function PreviaTrilha({ trilha, nivel = 'h1', acoes, tituloRef }: {
  trilha: TrilhaCompartilhada;
  nivel?: 'h1' | 'h2';
  acoes: ReactNode;
  tituloRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const Titulo = nivel;
  const Parte = nivel === 'h1' ? 'h2' : 'h3';
  const nome = trilha.dono.nome;
  // A dona vendo o próprio link: "Compartilhada por Ana", sem "com você" nem "você começa do zero".
  const sua = trilha.situacao === 'sua';
  const frase = sua ? m.compartilhadaPor(nome) : m.publicoTitulo(nome);
  const antes = sua ? frase.slice(0, frase.length - nome.length) : '';
  const depois = sua ? '' : frase.slice(nome.length);
  return (
    <article className="previa-trilha">
      <p className="previa-trilha__de">
        <Avatar nome={nome} cor={trilha.dono.cor} />
        <span>{trilha.dono.perfilId ? <>{antes}<a href={`/p/${trilha.dono.perfilId}`}>{nome}</a>{depois}</> : frase}</span>
      </p>
      <Titulo className="previa-trilha__titulo" ref={tituloRef} tabIndex={-1}>{trilha.titulo}</Titulo>
      <p className="previa-trilha__meta">{m.totalLicoes(trilha.totalLicoes)} · {origemLegivel(trilha.origem)}</p>
      <div className="previa-trilha__acoes">{acoes}</div>
      {!sua && <p className="previa-trilha__zero">{m.comecaDoZero}</p>}
      <ol className="previa-trilha__partes">
        {trilha.partes.map((parte, indice) => (
          <li key={indice}>
            <Parte className="previa-trilha__parte">{m.parte(indice + 1)} · {parte.titulo}</Parte>
            <ol>{parte.licoes.map((licao, i) => <li key={i}><Icone nome="livro" />{licao}</li>)}</ol>
          </li>
        ))}
      </ol>
    </article>
  );
}

/** As ações de quem recebe, conforme a situação: adicionar, entrar para adicionar, abrir a já adicionada, ou é sua. */
function AcoesDeQuemRecebe({ trilha, logado, adicionar, abrir, ocupado }: {
  trilha: TrilhaCompartilhada;
  logado: boolean;
  adicionar: () => void;
  abrir: (planoId: string) => void;
  ocupado: boolean;
}) {
  if (!logado) {
    return <Botao onClick={() => {
      guardar(CHAVE_DEPOIS_DO_LOGIN, `/t/${trilha.codigo}?adicionar=1`);
      window.location.assign('/login');
    }}>{m.entrarParaAdicionar}</Botao>;
  }
  if (trilha.situacao === 'sua' && trilha.planoId) {
    return <><p className="previa-trilha__situacao" role="status">{m.sua}</p><Botao variante="secundario" onClick={() => abrir(trilha.planoId!)}>{m.abrirSua}</Botao></>;
  }
  if (trilha.situacao === 'adicionada' && trilha.planoId) {
    return <><p className="previa-trilha__situacao" role="status">{m.jaAdicionada}</p><Botao onClick={() => abrir(trilha.planoId!)}>{m.abrirMinhas}</Botao></>;
  }
  return <Botao disabled={ocupado} aria-busy={ocupado || undefined} onClick={adicionar}>{ocupado ? m.adicionando : m.adicionar}</Botao>;
}

/** Abre a trilha no app (a página /t está fora dele): guarda o pedido e vai para o início. */
function abrirNoApp(planoId: string, aviso?: string) {
  guardar(CHAVE_ABRIR_PLANO, JSON.stringify({ id: planoId, ...(aviso ? { aviso } : {}) }));
  window.location.assign('/');
}

/** As ações da página pública /t/<código>; com `?adicionar=1` (volta do login), adiciona sozinha uma vez. */
export function AcoesDaPaginaPublica({ trilha, logado }: { trilha: TrilhaCompartilhada; logado: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const tentou = useRef(false);

  async function adicionar() {
    setOcupado(true);
    setErro(null);
    try {
      const feito = await cliente.adicionarTrilha(trilha.codigo);
      abrirNoApp(feito.planoId, feito.jaTinha ? undefined : m.adicionada(feito.dono.nome));
    } catch (falha) {
      const codigo = codigoDoErro(falha);
      if (codigo === 'nao_autenticado') {
        guardar(CHAVE_DEPOIS_DO_LOGIN, `/t/${trilha.codigo}?adicionar=1`);
        window.location.assign('/login');
        return;
      }
      setErro(codigo);
      setOcupado(false);
    }
  }

  useEffect(() => {
    if (tentou.current || !logado || trilha.situacao !== 'nova') return;
    if (new URLSearchParams(window.location.search).get('adicionar') !== '1') return;
    tentou.current = true;
    window.history.replaceState(null, '', `/t/${trilha.codigo}`);
    void adicionar();
    // Só na chegada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AcoesDeQuemRecebe trilha={trilha} logado={logado} ocupado={ocupado} adicionar={() => void adicionar()} abrir={(id) => abrirNoApp(id)} />
      {erro && <p className="campo-erro" role="alert">{textoErro(erro)}</p>}
    </>
  );
}

/**
 * "Adicionar por link", na tela de nova trilha: aceita o endereço inteiro ou só o código e mostra a mesma prévia da
 * página pública. É o caminho que o app usa.
 */
export function AdicionarPorLink({ ocupado: ocupadoFora, aoAdicionar, abrirPlano }: {
  ocupado: boolean;
  aoAdicionar: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  abrirPlano: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [trilha, setTrilha] = useState<TrilhaCompartilhada | null>(null);
  const [inativo, setInativo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const tituloPrevia = useRef<HTMLHeadingElement>(null);
  const idCampo = useId();
  const idDica = useId();
  const idErro = useId();

  const secao = useRef<HTMLElement>(null);
  // Ao abrir, a seção sobe para cima da barra fixa de baixo (no celular) e o campo recebe o foco.
  useEffect(() => {
    if (!aberto) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    secao.current?.scrollIntoView({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' });
    campo.current?.focus({ preventScroll: true });
  }, [aberto]);
  useEffect(() => { if (trilha) tituloPrevia.current?.focus(); }, [trilha]);

  async function ver(evento: FormEvent) {
    evento.preventDefault();
    const codigo = codigoDoLink(texto);
    setTrilha(null);
    setInativo(false);
    if (!codigo) {
      setErroCampo(m.porLinkInvalido);
      campo.current?.focus();
      return;
    }
    setErroCampo(null);
    setCarregando(true);
    try {
      setTrilha(await cliente.trilhaCompartilhada(codigo));
    } catch (falha) {
      const cod = codigoDoErro(falha);
      if (cod === 'link_inativo') setInativo(true);
      else setErroCampo(textoErro(cod));
    } finally {
      setCarregando(false);
    }
  }

  async function adicionar() {
    if (!trilha) return;
    setAdicionando(true);
    try {
      const feito = await cliente.adicionarTrilha(trilha.codigo);
      aoAdicionar(feito.planoId, feito.dono.nome, feito.jaTinha);
    } catch (falha) {
      const cod = codigoDoErro(falha);
      if (cod === 'link_inativo') { setTrilha(null); setInativo(true); } else setErroCampo(textoErro(cod));
      setAdicionando(false);
    }
  }

  if (!aberto) {
    return (
      <button type="button" className="por-link__abrir" disabled={ocupadoFora} onClick={() => setAberto(true)}>
        <Icone nome="compartilhar" />{m.porLink}
      </button>
    );
  }
  return (
    <section className="por-link" ref={secao} aria-labelledby={`${idCampo}-titulo`}>
      <h2 id={`${idCampo}-titulo`} className="por-link__titulo">{m.porLink}</h2>
      <form className="por-link__form" onSubmit={ver} noValidate>
        <label htmlFor={idCampo}>{m.porLinkRotulo}</label>
        <p className="campo-dica" id={idDica}>{m.porLinkDica}</p>
        <div className="por-link__linha">
          <input id={idCampo} ref={campo} value={texto} inputMode="url" autoComplete="off" spellCheck={false}
            aria-invalid={erroCampo ? true : undefined} aria-describedby={`${idDica}${erroCampo ? ` ${idErro}` : ''}`}
            onChange={(e) => { setTexto(e.target.value); if (erroCampo) setErroCampo(null); }} />
          <Botao type="submit" variante="secundario" disabled={carregando || !texto.trim()} aria-busy={carregando || undefined}>{m.porLinkVer}</Botao>
        </div>
        {erroCampo && <p className="campo-erro" id={idErro} role="alert">{erroCampo}</p>}
      </form>
      {inativo && (
        <div className="por-link__inativo" role="status">
          <p className="previa-trilha__situacao">{m.inativo}</p>
          <p className="folha-texto">{m.inativoTexto}</p>
        </div>
      )}
      {trilha && (
        <PreviaTrilha trilha={trilha} nivel="h2" tituloRef={tituloPrevia}
          acoes={<AcoesDeQuemRecebe trilha={trilha} logado ocupado={adicionando} adicionar={() => void adicionar()} abrir={abrirPlano} />} />
      )}
    </section>
  );
}
