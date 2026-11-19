'use client';

/*
 * Perfis e compartilhar trilha (spec 09) na web: avatar, folha "Compartilhar trilha", confirmação, formulário do perfil,
 * tela Perfil, prévia da trilha compartilhada (página /t e "Adicionar por link") e as ações da página pública.
 * Tudo só aparece com `compartilhar` no /api/auth/config.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from 'react';
import {
  CORES_PERFIL,
  LIMITES_COMUNIDADE,
  TEMAS,
  VISIBILIDADES,
  motivoLegendaInvalida,
  normalizarResumoPerfil,
  marcacaoCapa,
  type Tema,
  type Visibilidade,
  ErroStudoo,
  FUNDO_DA_COR,
  codigoDoLink,
  enderecoFoto,
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
import { PainelCodigo } from './codigo';
import { BotaoSeguir } from './seguir';
import './compartilhar.css';
import './comunidade.css';

const m = mensagens.compartilhar;
const p = mensagens.perfil;

/** Depois do login (senha ou Google), o app volta para este caminho e conclui o que a pessoa começou. */
export const CHAVE_DEPOIS_DO_LOGIN = 'studoo.depoisDoLogin';
/** Abrir uma trilha ao chegar no app, com um aviso ("Trilha adicionada. Compartilhada por Ana."). */
export const CHAVE_ABRIR_PLANO = 'studoo.abrirPlano';
/** Para onde o login pode voltar: um link de trilha (com ou sem adicionar) ou o Explorar. Nada fora do site. */
const CAMINHO_SEGURO = /^(?:\/t\/[A-Za-z0-9_-]{16}(?:\?adicionar=1)?|\/p\/[A-Za-z0-9_-]{16}|\/explorar)$/;

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

export function guardar(chave: string, valor: string) {
  try { sessionStorage.setItem(chave, valor); } catch { /* Sem armazenamento: a pessoa refaz o passo. */ }
}

export const urlDoLink = (codigo: string) => `${window.location.origin}/t/${codigo}`;
export const codigoDoErro = (erro: unknown) => (erro instanceof ErroStudoo ? erro.codigo : 'rede');

/**
 * A foto da pessoa (token da foto, em 128 px; 512 nos tamanhos grandes) ou a inicial na cor. Decorativo: o nome sempre
 * está escrito ao lado. Tamanhos: p (32), m (56), g (96 no celular, 112 no computador) e livre (`--lado`).
 */
export function Avatar({ nome, cor, foto = null, grande = false, tamanho }: { nome: string; cor: CorPerfil; foto?: string | null; grande?: boolean; tamanho?: 'p' | 'm' | 'g' }) {
  const t = tamanho ?? (grande ? 'm' : 'p');
  return (
    <span className="avatar" data-tamanho={t} data-grande={t !== 'p' || undefined} data-foto={foto ? true : undefined} style={{ background: FUNDO_DA_COR[cor] }} aria-hidden="true">
      {foto
        ? <img src={enderecoFoto(foto, t === 'g' ? 512 : 128)} alt="" width={t === 'g' ? 112 : t === 'm' ? 56 : 32} height={t === 'g' ? 112 : t === 'm' ? 56 : 32} decoding="async" draggable={false} />
        : inicialDoNome(nome)}
    </span>
  );
}

/** Foco preso no diálogo, Esc fecha (ou volta um passo) e, ao fechar, o foco volta para quem abriu. */
/** Diálogos abertos, do mais antigo ao mais novo: só o de cima responde ao teclado (Esc e Tab). */
const pilhaDeDialogos: symbol[] = [];

export function useDialogo(caixa: RefObject<HTMLElement | null>, aoEsc: () => void) {
  const aoEscRef = useRef(aoEsc);
  aoEscRef.current = aoEsc;
  useEffect(() => {
    const origem = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const eu = Symbol('dialogo');
    pilhaDeDialogos.push(eu);
    function aoTeclar(evento: KeyboardEvent) {
      if (pilhaDeDialogos[pilhaDeDialogos.length - 1] !== eu) return;
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
      pilhaDeDialogos.splice(pilhaDeDialogos.indexOf(eu), 1);
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
  inicial?: { nome: string | null; cor: CorPerfil | null; foto?: string | null };
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
        <Avatar nome={normalizado || '?'} cor={cor} foto={inicial?.foto} />
        <span>{m.compartilhadaPor(normalizado || '…')}</span>
      </p>
      <div className="folha-acoes">
        {aoCancelar && <Botao variante="secundario" disabled={enviando} onClick={aoCancelar}>{p.cancelar}</Botao>}
        <Botao type="submit" disabled={enviando} aria-busy={enviando || undefined}>{enviando ? p.salvando : enviarRotulo}</Botao>
      </div>
    </form>
  );
}

/**
 * "Quem pode ver" (com a comunidade): Só com o link, No meu perfil, No Explorar. Os dois primeiros salvam na hora;
 * o Explorar abre a publicação (tema sugerido pelo título, que a pessoa confirma, e legenda opcional de até 140).
 * Trilha feita de material não vai para o Explorar.
 */
export function VisibilidadeDaTrilha({ link, temaSugerido, deMaterial, demonstracao, aoMudar }: {
  link: LinkCompartilhado;
  temaSugerido: Tema;
  deMaterial: boolean;
  demonstracao: boolean;
  aoMudar: (link: LinkCompartilhado) => void;
}) {
  const atual: Visibilidade = link.visibilidade ?? (link.noPerfil ? 'perfil' : 'link');
  const [escolhido, setEscolhido] = useState<Visibilidade>(atual);
  const [tema, setTema] = useState<Tema>(link.tema ?? temaSugerido);
  const [legenda, setLegenda] = useState(link.legenda ?? '');
  const [erroLegenda, setErroLegenda] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // No começo só o tema sugerido (ou o salvo) aparece; "Trocar tema" abre os 12, e a legenda e o botão ficam à vista.
  const [todosTemas, setTodosTemas] = useState(false);
  const campoLegenda = useRef<HTMLTextAreaElement>(null);
  const ids = { legenda: useId(), dica: useId(), contador: useId(), erro: useId(), tema: useId() };
  const cm = mensagens.comunidade;
  const legendaNormal = normalizarResumoPerfil(legenda);
  const usados = [...legendaNormal].length;
  const publicada = atual === 'explorar';
  const mudouPublicacao = publicada && (tema !== (link.tema ?? temaSugerido) || legendaNormal !== (link.legenda ?? ''));

  async function salvar(nivel: Visibilidade) {
    setOcupado(true);
    setErro(null);
    try {
      let novo: LinkCompartilhado;
      if (nivel === 'explorar') {
        const motivo = motivoLegendaInvalida(legendaNormal);
        if (motivo) {
          setErroLegenda(cm.legendaErros[motivo]);
          campoLegenda.current?.focus();
          return;
        }
        novo = await cliente.definirVisibilidade(link.codigo, 'explorar', { tema, legenda: legendaNormal });
        setStatus(publicada ? cm.publicacaoSalva : cm.publicada);
      } else {
        novo = await cliente.definirVisibilidade(link.codigo, nivel);
        setStatus(cm.nivelSalvo(cm.niveis[nivel].titulo));
      }
      aoMudar(novo);
      setLegenda(novo.legenda ?? '');
    } catch (falha) {
      setErro(textoErro(codigoDoErro(falha)));
      setEscolhido(atual);
    } finally {
      setOcupado(false);
    }
  }

  function escolher(nivel: Visibilidade) {
    setEscolhido(nivel);
    setStatus('');
    if (nivel !== 'explorar') void salvar(nivel);
  }

  return (
    <div className="visibilidade">
      <fieldset className="niveis" disabled={ocupado}>
        <legend>{cm.visibilidadeTitulo}</legend>
        {VISIBILIDADES.map((nivel) => {
          const bloqueado = nivel === 'explorar' && deMaterial;
          return (
            <label key={nivel} className="nivel" data-vale={nivel === atual || undefined}>
              <input type="radio" name={`visibilidade-${link.codigo}`} value={nivel} checked={escolhido === nivel} disabled={bloqueado}
                onChange={() => escolher(nivel)} />
              {/* "Agora" dentro do cartão do nível que vale de fato (antes de publicar, o Explorar ainda não vale). */}
              <strong>{cm.niveis[nivel].titulo}{nivel === atual && <span className="nivel__agora">{cm.agora}</span>}</strong>
              <span>{bloqueado ? cm.materialFora : cm.niveis[nivel].texto}</span>
            </label>
          );
        })}
      </fieldset>
      {escolhido === 'explorar' && !deMaterial && (
        <div className="publicacao">
          {!publicada && <p className="publicacao__ainda" role="note">{cm.aindaNaoNoExplorar(cm.niveis[atual].titulo)}</p>}
          <fieldset className="interesses" aria-describedby={ids.tema}>
            <legend>{cm.temaRotulo}</legend>
            <p className="campo-dica" id={ids.tema}>{cm.temaDica}</p>
            <div className="interesses__lista">
              {(todosTemas ? TEMAS : [tema]).map((opcao) => (
                <label key={opcao} className="interesse">
                  <input type="radio" name={`tema-${link.codigo}`} checked={tema === opcao} onChange={() => setTema(opcao)} />
                  <span>{mensagens.temas[opcao]}{opcao === temaSugerido && <em className="publicacao__sugerido"> · {cm.temaSugerido}</em>}</span>
                </label>
              ))}
              {!todosTemas && (
                <button type="button" className="publicacao__trocar" aria-label={cm.trocarTemaRotulo(mensagens.temas[tema])} aria-expanded={false}
                  onClick={() => setTodosTemas(true)}>{cm.trocarTema}</button>
              )}
            </div>
          </fieldset>
          <div className="campo">
            <div className="campo__linha">
              <label htmlFor={ids.legenda}>{cm.legendaRotulo}</label>
              <span className="campo__contador" id={ids.contador} data-acima={usados > LIMITES_COMUNIDADE.legendaMax || undefined}>
                <span aria-hidden="true">{p.resumoContador(usados, LIMITES_COMUNIDADE.legendaMax)}</span>
                <span className="somente-leitor">{p.resumoContadorLeitor(LIMITES_COMUNIDADE.legendaMax - usados)}</span>
              </span>
            </div>
            <textarea id={ids.legenda} ref={campoLegenda} rows={2} maxLength={220} value={legenda}
              aria-invalid={erroLegenda ? true : undefined} aria-describedby={`${ids.dica} ${ids.contador}${erroLegenda ? ` ${ids.erro}` : ''}`}
              onChange={(e) => { setLegenda(e.target.value.replace(/[\r\n]+/g, ' ')); setErroLegenda(null); }} />
            <p className="campo-dica" id={ids.dica}>{cm.legendaDica}</p>
            {erroLegenda && <p className="campo-erro" id={ids.erro}>{erroLegenda}</p>}
          </div>
          {demonstracao && <p className="folha-aviso" role="note">{cm.demonstracaoAviso}</p>}
          {/* Publicar e Cancelar ficam presos no rodapé da folha enquanto a pessoa preenche tema e legenda. */}
          <div className="folha-acoes recorte__acoes publicacao__acoes">
            {publicada
              ? <Botao disabled={ocupado || !mudouPublicacao} aria-busy={ocupado || undefined} onClick={() => void salvar('explorar')}>{ocupado ? p.salvando : cm.salvarPublicacao}</Botao>
              : <Botao disabled={ocupado} aria-busy={ocupado || undefined} onClick={() => void salvar('explorar')}>{ocupado ? cm.publicando : cm.publicar}</Botao>}
            {!publicada && <Botao variante="secundario" disabled={ocupado} onClick={() => setEscolhido(atual)}>{p.cancelar}</Botao>}
          </div>
        </div>
      )}
      {erro && <p className="campo-erro" role="alert">{erro}</p>}
      <p className="folha-status somente-leitor" role="status" aria-live="polite">{status}</p>
    </div>
  );
}

type Etapa = 'carregando' | 'perfil' | 'resumo' | 'pronto' | 'parar' | 'visitante' | 'erro';

/**
 * A folha "Compartilhar trilha": (a) sem nome, "Como você quer aparecer?"; (b) o que vai; (c) "Criar link"; (d) link
 * pronto, com Compartilhar (Web Share quando existe), Copiar link, "Mostrar no meu perfil" e "Parar de compartilhar"
 * (com confirmação própria). No celular sobe de baixo; no computador fica no centro.
 */
export function FolhaCompartilhar({ planoId, visitante, comunidade = false, aoFechar, aoMudarLink, aoMudarPerfil, anunciar }: {
  planoId: string;
  visitante: boolean;
  /** Com a comunidade, "Mostrar no meu perfil" vira "Quem pode ver" (três níveis). */
  comunidade?: boolean;
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
        {/* Cabeçalho preso no topo ao rolar: "Compartilhar trilha", o nome da trilha e o fechar. */}
        <div className="folha-topo folha-topo--preso">
          <div className="folha-topo__texto">
            <p className="folha-contexto" aria-hidden={tituloDaEtapa === m.folhaTitulo || undefined}>{tituloDaEtapa === m.folhaTitulo ? '' : m.folhaTitulo}</p>
            {previa && etapa === 'pronto' && <p className="folha-topo__trilha" aria-hidden="true">{previa.titulo}</p>}
          </div>
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
            setPrevia((anterior) => anterior && { ...anterior, perfil: perfil.nome && perfil.cor ? { nome: perfil.nome, cor: perfil.cor, foto: perfil.foto } : anterior.perfil });
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
                <p className="folha-trilha__por"><Avatar nome={previa.perfil.nome} cor={previa.perfil.cor} foto={previa.perfil.foto} />{m.compartilhadaPor(previa.perfil.nome)}</p>
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
            <PainelCodigo url={urlDoLink(link.codigo)} titulo={previa.titulo} dica={mensagens.codigo.dicaTrilha} rotulo={mensagens.codigo.rotuloTrilha(previa.titulo)}
              cor={previa.perfil?.cor} comLink={false} nomeArquivo={`studoo-trilha-${link.codigo}`} demonstracao={Boolean(previa.demonstracao)} />
            {comunidade && previa.temaSugerido ? (
              <VisibilidadeDaTrilha link={link} temaSugerido={previa.temaSugerido} deMaterial={previa.deMaterial} demonstracao={Boolean(previa.demonstracao)}
                aoMudar={(novo) => { setLink(novo); aoMudarLink(planoId, novo); }} />
            ) : (
              <>
                <label className="chave">
                  <input type="checkbox" role="switch" checked={link.noPerfil} disabled={ocupado} aria-describedby={dicaPerfilId}
                    onChange={(e) => void alterarPerfil(e.target.checked)} />
                  <span className="chave__trilho" aria-hidden="true" />
                  <span className="chave__texto">{m.noPerfil}</span>
                </label>
                <p className="campo-dica" id={dicaPerfilId}>{m.noPerfilDica}</p>
              </>
            )}
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

export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * A prévia de uma trilha compartilhada, igual na página /t e no "Adicionar por link": de quem é, título, contagem e
 * origem, as ações logo abaixo (visíveis sem rolar) e as lições por parte.
 */
export function PreviaTrilha({ trilha, nivel = 'h1', acoes, tituloRef, calor = false, logado = false, comunidade = false }: {
  /** Com a comunidade: o botão Seguir no cartão "Quem compartilhou" (sem sessão, leva ao login). */
  logado?: boolean;
  comunidade?: boolean;
  trilha: TrilhaCompartilhada;
  nivel?: 'h1' | 'h2';
  acoes: ReactNode;
  tituloRef?: RefObject<HTMLHeadingElement | null>;
  /** Página /t: o Stu dá as boas-vindas e o cartão de quem compartilhou (foto e resumo) vem antes das lições. */
  calor?: boolean;
}) {
  const Titulo = nivel;
  const Parte = nivel === 'h1' ? 'h2' : 'h3';
  const nome = trilha.dono.nome;
  // A dona vendo o próprio link: "Compartilhada por Ana", sem "com você" nem "você começa do zero".
  const sua = trilha.situacao === 'sua';
  const frase = sua ? m.compartilhadaPor(nome) : m.publicoTitulo(nome);
  const antes = sua ? frase.slice(0, frase.length - nome.length) : '';
  const depois = sua ? '' : frase.slice(nome.length);
  const comCalor = calor && !sua;
  const jaTem = trilha.situacao === 'adicionada';
  return (
    <article className="previa-trilha" data-calor={comCalor || undefined}>
      {/* A capa da trilha (a escolhida nas configurações ou a padrão do tema), no alto da página do link. */}
      {calor && <span className="previa-trilha__capa" aria-hidden="true" data-foto={trilha.capa?.startsWith('foto:') || undefined} dangerouslySetInnerHTML={{ __html: marcacaoCapa({ codigo: trilha.codigo, tema: trilha.tema ?? null, capa: trilha.capa, tamanho: 1024 }) }} />}
      {comCalor && (
        <div className="previa-trilha__stu">
          <img className="stu" src="/marca/stu-oi.svg" alt="" width={72} height={79} />
          <p className="previa-trilha__balao">{jaTem ? m.stuDeNovo : m.stuConvite}</p>
        </div>
      )}
      <p className="previa-trilha__de">
        <Avatar nome={nome} cor={trilha.dono.cor} foto={trilha.dono.foto} />
        <span>{trilha.dono.perfilId ? <>{antes}<a href={`/p/${trilha.dono.perfilId}`}>{nome}</a>{depois}</> : frase}</span>
      </p>
      <Titulo className="previa-trilha__titulo" ref={tituloRef} tabIndex={-1}>{trilha.titulo}</Titulo>
      <p className="previa-trilha__meta">{m.totalLicoes(trilha.totalLicoes)} · {origemLegivel(trilha.origem)}</p>
      <div className="previa-trilha__acoes">{acoes}</div>
      {!sua && <p className="previa-trilha__zero">{jaTem ? m.jaAdicionadaTexto : m.comecaDoZero}</p>}
      <ol className="previa-trilha__partes">
        {trilha.partes.map((parte, indice) => (
          <li key={indice}>
            <Parte className="previa-trilha__parte">{m.parte(indice + 1)} · {parte.titulo}</Parte>
            <ol>{parte.licoes.map((licao, i) => <li key={i}><Icone nome="livro" />{licao}</li>)}</ol>
          </li>
        ))}
      </ol>
      {/* Quem compartilhou vem depois das lições: no alto fica só a linha com a foto e o nome. */}
      {comCalor && (
        <section className="quem-compartilhou" aria-label={m.quemCompartilhou}>
          <Avatar nome={nome} cor={trilha.dono.cor} foto={trilha.dono.foto} tamanho="m" />
          <div className="quem-compartilhou__texto">
            <p className="quem-compartilhou__rotulo">{m.quemCompartilhou}</p>
            <p className="quem-compartilhou__nome">{nome}</p>
            {trilha.dono.demo && <p className="selo-demo">{mensagens.comunidade.perfilDemo}</p>}
            {trilha.dono.resumo && <p className="quem-compartilhou__resumo">{trilha.dono.resumo}</p>}
            {trilha.dono.perfilId && <a className="quem-compartilhou__link" href={`/p/${trilha.dono.perfilId}`}>{m.verPerfil(nome)}</a>}
            {comunidade && trilha.dono.perfilId && (
              <div className="quem-compartilhou__seguir"><BotaoSeguir perfilId={trilha.dono.perfilId} nome={nome} estado={trilha.seguirDono} logado={logado} /></div>
            )}
          </div>
        </section>
      )}
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
export function abrirNoApp(planoId: string, aviso?: string) {
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
