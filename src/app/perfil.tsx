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
  type Tema,
} from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone, Stu } from '../ui';
import { Avatar, DialogoConfirmar, FolhaCompartilhar, codigoDoErro, dataCurta, urlDoLink, useDialogo } from './compartilhar';
import { CartoesDoPerfil } from './comunidade';
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
export function CabecalhoPerfil({ nome, cor, foto, resumo, interesses, alcance, nivel = 'h1', acoes, semResumo, tituloRef }: {
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
  return (
    <div className="cabeca-perfil" style={{ '--cor-perfil': FUNDO_DA_COR[cor] } as CSSProperties}>
      <div className="cabeca-perfil__faixa"><DesenhoFaixa /></div>
      <div className="cabeca-perfil__corpo">
        <div className="cabeca-perfil__topo">
          <Avatar nome={nome} cor={cor} foto={foto} tamanho="g" />
          {acoes && <div className="cabeca-perfil__acoes">{acoes}</div>}
        </div>
        <Nome className="cabeca-perfil__nome" ref={nivel === 'p' ? undefined : (tituloRef as RefObject<HTMLHeadingElement>)} tabIndex={tituloRef ? -1 : undefined}>{nome}</Nome>
        {resumo ? <p className="cabeca-perfil__resumo">{resumo}</p> : semResumo}
        {interesses.length > 0 && (
          <ul className="cabeca-perfil__interesses" aria-label={p.interessesRotulo}>
            {interesses.map((tema) => <li key={tema}>{temas[tema]}</li>)}
          </ul>
        )}
        <p className="cabeca-perfil__alcance"><span className="somente-leitor">{p.alcanceRotulo}: </span>{p.alcance(alcance.trilhas, alcance.pessoas)}</p>
      </div>
    </div>
  );
}

/** "Compartilhar perfil": a folha do sistema quando existe; senão, copia o endereço de /p. */
export function BotaoCompartilharPerfil({ perfilId, nome, variante = 'secundario' }: { perfilId: string; nome: string; variante?: 'primario' | 'secundario' }) {
  const [status, setStatus] = useState('');
  async function compartilhar() {
    const url = `${window.location.origin}/p/${perfilId}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: p.paginaTitulo(nome), text: p.textoCompartilharPerfil(nome), url }); } catch { /* fechou a folha */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus((anterior) => (anterior === p.linkPerfilCopiado ? `${p.linkPerfilCopiado} ` : p.linkPerfilCopiado));
    } catch {
      setStatus(m.copiarFalhou);
    }
  }
  return (
    <>
      <Botao variante={variante} onClick={() => void compartilhar()}><Icone nome="compartilhar" />{p.compartilharPerfil}</Botao>
      <span className="cabeca-perfil__status" role="status" aria-live="polite">{status}</span>
    </>
  );
}

/** Tela Perfil: o cabeçalho novo; as trilhas que a pessoa compartilha; o perfil público; a conta e Sair. */
export function TelaPerfil({ perfil: inicial, aoMudarPerfil, aoMudarLink, abrirPlano, editar, sair, anunciar, comunidade = false, aoAdicionado }: {
  perfil: Perfil | null;
  /** Com a comunidade: o nível de cada trilha, "Visibilidade" (abre a folha) e os cartões como aparecem na página. */
  comunidade?: boolean;
  aoAdicionado?: (planoId: string, nomeDono: string, jaTinha: boolean) => void;
  aoMudarPerfil: (perfil: Perfil) => void;
  aoMudarLink: (planoId: string, link: LinkCompartilhado | null) => void;
  abrirPlano: (id: string) => void;
  editar: () => void;
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
  const titulo = useRef<HTMLHeadingElement>(null);
  const assinaturaLinks = perfil?.links.map((link) => `${link.codigo}:${link.visibilidade ?? link.noPerfil}:${link.tema ?? ''}:${link.legenda ?? ''}`).join('|') ?? '';

  // Os cartões como aparecem na página pública (com a comunidade e perfil público); recarrega quando os links mudam.
  useEffect(() => {
    if (!comunidade || !perfil?.publico || !perfil.perfilId) { setCartoes(null); return; }
    let ativo = true;
    cliente.perfilPublico(perfil.perfilId).then((dados) => { if (ativo) setCartoes(dados.cartoes ?? null); }).catch(() => { if (ativo) setCartoes(null); });
    return () => { ativo = false; };
  }, [comunidade, perfil?.publico, perfil?.perfilId, assinaturaLinks]);

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
      return { ...atual, links, publico: links.some((item) => item.noPerfil), alcance: { trilhas: links.length, pessoas: links.reduce((t, l) => t + l.adicoes, 0) } };
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
      <h1 ref={titulo} tabIndex={-1} className="painel--perfil__titulo">{p.titulo}</h1>
      {erro && <p className="campo-erro" role="alert">{textoErro(erro)}</p>}
      {!perfil && !erro && <div className="cabeca-perfil cabeca-perfil--esqueleto" aria-hidden="true"><div className="cabeca-perfil__faixa" /><div className="folha-esqueleto"><span /><span /><span /></div></div>}
      {perfil && (
        <>
          {perfil.visitante ? (
            <div className="perfil-cartao"><p className="perfil-cartao__visitante">{p.visitante}</p></div>
          ) : !perfil.nome ? (
            <div className="perfil-completar">
              <Stu />
              <div>
                <h2 className="perfil-secao__titulo">{m.comoAparecer}</h2>
                <p className="folha-texto">{p.convitePerfil}</p>
                <Botao onClick={editar}><Icone nome="lapis" />{p.completar}</Botao>
              </div>
            </div>
          ) : (
            <CabecalhoPerfil nome={perfil.nome} cor={perfil.cor ?? 'azul'} foto={perfil.foto} resumo={perfil.resumo} interesses={perfil.interesses}
              alcance={perfil.alcance} nivel="h2"
              semResumo={<button type="button" className="cabeca-perfil__convite" onClick={editar}>{p.semResumoDona}</button>}
              acoes={<>
                <Botao variante="secundario" onClick={editar}><Icone nome="lapis" />{p.editarPerfil}</Botao>
                {perfil.publico && perfil.perfilId && <BotaoCompartilharPerfil perfilId={perfil.perfilId} nome={perfil.nome} />}
              </>} />
          )}

          {!perfil.visitante && (
            <section className="perfil-secao" aria-labelledby="perfil-compartilhadas">
              <h2 id="perfil-compartilhadas" className="perfil-secao__titulo">{p.compartilhadas}</h2>
              {perfil.links.length === 0 ? <p className="folha-texto">{p.nenhuma}</p> : (
                <ul className="perfil-links">
                  {perfil.links.map((link) => (
                    <li key={link.codigo} className="perfil-link">
                      <button type="button" className="perfil-link__titulo" onClick={() => abrirPlano(link.planoId)}>{link.titulo}</button>
                      <p className="perfil-link__meta">
                        {p.desde(dataCurta(link.criadoEm))} · {p.adicoes(link.adicoes)}{comunidade && link.valeus !== undefined ? ` · ${mensagens.comunidade.valeus(link.valeus)}` : ''}
                      </p>
                      {comunidade && link.visibilidade ? (
                        <p className="selo-visibilidade" data-nivel={link.visibilidade}>
                          <Icone nome={link.visibilidade === 'explorar' ? 'bussola' : link.visibilidade === 'perfil' ? 'pessoa' : 'copiar'} />
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
                        {comunidade && <Botao variante="secundario" aria-label={mensagens.comunidade.ajustarRotulo(link.titulo)} onClick={() => setFolha(link.planoId)}><Icone nome="bussola" />{mensagens.comunidade.ajustar}</Botao>}
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
            <CartoesDoPerfil key={assinaturaLinks} inicial={cartoes} logado titulo={mensagens.comunidade.naSuaPagina}
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

          <section className="perfil-secao" aria-labelledby="perfil-conta">
            <h2 id="perfil-conta" className="perfil-secao__titulo">{p.conta}</h2>
            {!perfil.visitante && <p className="perfil-conta__email"><span>{p.email}</span> {perfil.email}</p>}
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
      {parando && (
        <DialogoConfirmar titulo={m.pararTitulo} texto={m.pararTexto} confirmar={m.pararConfirmar} cancelar={m.pararCancelar}
          ocupado={ocupado} aoConfirmar={() => void confirmarParada()} aoCancelar={() => setParando(null)} />
      )}
    </section>
  );
}

type ErrosCampos = { nome?: string; resumo?: string };

/**
 * Tela "Editar perfil": foto (escolher, tirar, recortar, remover), nome, cor, resumo com contador e interesses (até 5),
 * com a prévia ao vivo do cabeçalho público. A foto salva na hora (é um envio à parte); o resto salva no botão, com o
 * estado sempre à vista ("Alterações não salvas", "Salvando…", "Tudo salvo") e o erro no próprio campo.
 */
export function TelaEditarPerfil({ perfil, aoMudarPerfil, voltar, anunciar, registrarGuarda }: {
  perfil: Perfil;
  aoMudarPerfil: (perfil: Perfil) => void;
  voltar: () => void;
  anunciar: (texto: string) => void;
  /**
   * A tela registra uma guarda de saída: qualquer navegação (Voltar, lateral, barra de baixo) passa por ela e, com
   * alteração não salva, recebe a mesma confirmação. A guarda devolve true quando segurou a saída.
   */
  registrarGuarda?: (guarda: ((continuar: () => void) => boolean) | null) => void;
}) {
  const [salvo, setSalvo] = useState(perfil);
  const [nome, setNome] = useState(perfil.nome ?? '');
  const [cor, setCor] = useState<CorPerfil>(perfil.cor ?? 'azul');
  const [resumo, setResumo] = useState(perfil.resumo ?? '');
  const [interesses, setInteresses] = useState<Tema[]>(perfil.interesses);
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [estado, setEstado] = useState<'livre' | 'salvando' | 'salvo'>('livre');
  const [avisoInteresses, setAvisoInteresses] = useState('');
  const [arquivo, setArquivo] = useState<string | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [statusFoto, setStatusFoto] = useState('');
  const [removendo, setRemovendo] = useState<'perguntar' | 'removendo' | null>(null);
  const [sair, setSair] = useState<(() => void) | null>(null);
  const [toque, setToque] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const campoNome = useRef<HTMLInputElement>(null);
  const campoResumo = useRef<HTMLTextAreaElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const ids = { nome: useId(), nomeDica: useId(), nomeErro: useId(), resumo: useId(), resumoDica: useId(), resumoErro: useId(), resumoContador: useId(), interesses: useId(), foto: useId() };

  const nomeNormal = normalizarNomePerfil(nome);
  const resumoNormal = normalizarResumoPerfil(resumo);
  const usados = [...resumoNormal].length;
  const alterado = nomeNormal !== (salvo.nome ?? '') || cor !== (salvo.cor ?? 'azul') || resumoNormal !== (salvo.resumo ?? '')
    || interesses.join() !== salvo.interesses.join();

  useEffect(() => { titulo.current?.focus(); }, []);
  useEffect(() => { setToque(window.matchMedia('(pointer: coarse)').matches); }, []);
  useEffect(() => { if (alterado && estado === 'salvo') setEstado('livre'); }, [alterado, estado]);

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

  /** Sem a guarda registrada (uso isolado), o Voltar confere sozinho. */
  function sairDaTela() {
    if (!registrarGuarda && alterado) setSair(() => voltar);
    else voltar();
  }

  // Fechar a aba com alterações não salvas pede confirmação do navegador.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (evento: BeforeUnloadEvent) => { evento.preventDefault(); };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [alterado]);

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
    setInteresses((atual) => TEMAS.filter((t) => (t === tema ? marcado : atual.includes(t))));
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    const motivoNome = motivoNomeInvalido(nomeNormal);
    const motivoResumo = motivoResumoInvalido(resumoNormal);
    const novos: ErrosCampos = {
      ...(motivoNome ? { nome: p.nomeErros[motivoNome] } : {}),
      ...(motivoResumo ? { resumo: p.resumoErros[motivoResumo] } : {}),
    };
    setErros(novos);
    setErroGeral(null);
    if (novos.nome || novos.resumo) {
      (novos.nome ? campoNome : campoResumo).current?.focus();
      anunciar(p.corrigirCampos);
      return;
    }
    setEstado('salvando');
    try {
      const novo = await cliente.salvarPerfil(nomeNormal, cor, { resumo: resumoNormal, interesses });
      atualizarPerfil(novo);
      setNome(novo.nome ?? '');
      setResumo(novo.resumo ?? '');
      setInteresses(novo.interesses);
      setEstado('salvo');
      anunciar(p.salvo);
    } catch (falha) {
      setErroGeral(textoErro(codigoDoErro(falha)));
      setEstado('livre');
    }
  }

  function escolherArquivo(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (galeria.current) galeria.current.value = '';
    if (camera.current) camera.current.value = '';
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

  const estadoTexto = estado === 'salvando' ? p.salvando : alterado ? p.alteracoesNaoSalvas : p.tudoSalvo;

  return (
    <section className="painel painel--editar-perfil" aria-labelledby="editar-perfil-titulo">
      <div className="editar-perfil__topo">
        <Botao variante="texto" className="editar-perfil__voltar" onClick={sairDaTela}>
          <span aria-hidden="true">←</span> {p.voltarPerfil}
        </Botao>
        <h1 id="editar-perfil-titulo" ref={titulo} tabIndex={-1}>{p.editarPerfil}</h1>
      </div>

      <div className="editar-perfil__grade">
        <form className="editar-perfil__form" onSubmit={salvar} noValidate aria-describedby={erroGeral ? 'editar-perfil-erro' : undefined}>
          <section className="editar-foto" aria-labelledby={ids.foto}>
            <Avatar nome={nomeNormal || '?'} cor={cor} foto={salvo.foto} tamanho="g" />
            <div className="editar-foto__corpo">
              <h2 id={ids.foto} className="editar-perfil__rotulo">{p.fotoRotulo}</h2>
              <div className="editar-foto__acoes">
                <Botao variante="secundario" onClick={() => galeria.current?.click()}><Icone nome="imagem" />{salvo.foto ? p.fotoTrocar : p.fotoEscolher}</Botao>
                {toque && <Botao variante="secundario" onClick={() => camera.current?.click()}><Icone nome="camera" />{p.fotoCamera}</Botao>}
                {salvo.foto && <Botao variante="texto" className="folha-parar" disabled={removendo !== null} onClick={() => setRemovendo('perguntar')}><Icone nome="lixeira" />{p.fotoRemover}</Botao>}
              </div>
              <p className="campo-dica">{p.fotoDica}</p>
              {erroFoto && !arquivo && <p className="campo-erro" role="alert">{erroFoto}</p>}
              <p className="folha-status" role="status" aria-live="polite">{statusFoto}</p>
              <input ref={galeria} type="file" accept="image/*" hidden onChange={(e) => escolherArquivo(e.target.files)} />
              <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={(e) => escolherArquivo(e.target.files)} />
            </div>
          </section>

          <div className="campo">
            <label htmlFor={ids.nome}>{m.nomeRotulo}</label>
            <input id={ids.nome} ref={campoNome} value={nome} maxLength={60} autoComplete="nickname" autoCapitalize="words"
              aria-invalid={erros.nome ? true : undefined} aria-describedby={`${ids.nomeDica}${erros.nome ? ` ${ids.nomeErro}` : ''}`}
              onChange={(e) => { setNome(e.target.value); if (erros.nome) setErros((atual) => ({ ...atual, nome: undefined })); }} />
            <p className="campo-dica" id={ids.nomeDica}>{m.comoAparecerDica}</p>
            {erros.nome && <p className="campo-erro" id={ids.nomeErro}>{erros.nome}</p>}
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

          <div className="campo campo--resumo">
            <div className="campo__linha">
              <label htmlFor={ids.resumo}>{p.resumoRotulo}</label>
              <span className="campo__contador" id={ids.resumoContador} data-acima={usados > LIMITES_PERFIL.resumoMax || undefined}>
                <span aria-hidden="true">{p.resumoContador(usados, LIMITES_PERFIL.resumoMax)}</span>
                <span className="somente-leitor">{p.resumoContadorLeitor(LIMITES_PERFIL.resumoMax - usados)}</span>
              </span>
            </div>
            <textarea id={ids.resumo} ref={campoResumo} value={resumo} rows={3} maxLength={240}
              aria-invalid={erros.resumo ? true : undefined} aria-describedby={`${ids.resumoDica} ${ids.resumoContador}${erros.resumo ? ` ${ids.resumoErro}` : ''}`}
              onChange={(e) => { setResumo(e.target.value.replace(/[\r\n]+/g, ' ')); if (erros.resumo) setErros((atual) => ({ ...atual, resumo: undefined })); }} />
            <p className="campo-dica" id={ids.resumoDica}>{p.resumoDica}</p>
            {erros.resumo && <p className="campo-erro" id={ids.resumoErro}>{erros.resumo}</p>}
          </div>

          <fieldset className="interesses" aria-describedby={`${ids.interesses}-dica`}>
            <legend>{p.interessesRotulo}</legend>
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

          <div className="editar-perfil__barra">
            <p className="editar-perfil__estado" data-estado={estado === 'salvando' ? 'salvando' : alterado ? 'pendente' : 'salvo'} role="status" aria-live="polite">
              {!alterado && estado !== 'salvando' && <Icone nome="check" />}{estadoTexto}
            </p>
            {erroGeral && <p className="campo-erro" id="editar-perfil-erro" role="alert">{erroGeral}</p>}
            <Botao type="submit" disabled={estado === 'salvando' || !alterado} aria-busy={estado === 'salvando' || undefined}>
              {estado === 'salvando' ? p.salvando : p.salvar}
            </Botao>
          </div>
        </form>

        <aside className="editar-perfil__previa" aria-labelledby="editar-perfil-previa">
          <h2 id="editar-perfil-previa" className="editar-perfil__rotulo">{p.previaTitulo}</h2>
          <div aria-live="off">
            <CabecalhoPerfil nome={nomeNormal || '…'} cor={cor} foto={salvo.foto} resumo={resumoNormal || null} interesses={interesses}
              alcance={salvo.alcance} nivel="p" />
          </div>
          <p className="campo-dica">{p.fotoAviso}</p>
        </aside>
      </div>

      {arquivo && (
        <RecorteFoto origem={arquivo} aoCancelar={() => setArquivo(null)}
          aoSalvar={(novo) => { atualizarPerfil(novo); setArquivo(null); setStatusFoto(p.fotoSalva); anunciar(p.fotoSalva); }} />
      )}
      {removendo && (
        <DialogoConfirmar titulo={p.fotoRemoverTitulo} texto={p.fotoRemoverTexto} confirmar={p.fotoRemover} cancelar={p.fotoRemoverCancelar}
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

  const base = natural && lado ? lado / Math.min(natural.w, natural.h) : 1;
  const escala = base * zoom;
  const largura = (natural?.w ?? 0) * escala;
  const altura = (natural?.h ?? 0) * escala;

  /** Mantém a foto cobrindo o quadro. */
  const limitar = useMemo(() => (x: number, y: number, l = largura, a = altura) => ({
    x: Math.min(0, Math.max(lado - l, x)),
    y: Math.min(0, Math.max(lado - a, y)),
  }), [lado, largura, altura]);

  // Ao carregar (ou mudar o tamanho do quadro), centraliza.
  useEffect(() => {
    if (!natural || !lado) return;
    const b = lado / Math.min(natural.w, natural.h);
    setPos({ x: (lado - natural.w * b * zoom) / 2, y: (lado - natural.h * b * zoom) / 2 });
    // Só quando a foto ou o quadro mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, lado]);

  /** Zoom em torno de um ponto do quadro (o centro, por padrão): o ponto debaixo dele fica parado. */
  function aplicarZoom(novo: number, cx = lado / 2, cy = lado / 2) {
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
      const canvas = document.createElement('canvas');
      canvas.width = saida;
      canvas.height = saida;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, saida, saida);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -pos.x / escala, -pos.y / escala, lFonte, lFonte, 0, 0, saida, saida);
      let blob: Blob | null = null;
      for (const qualidade of [0.9, 0.8, 0.65]) {
        blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, 'image/jpeg', qualidade));
        if (blob && blob.size <= LIMITES_FOTO.bytes) break;
      }
      if (!blob || blob.size > LIMITES_FOTO.bytes) throw new Error('grande');
      aoSalvar(await cliente.enviarFoto(await base64DoBlob(blob)));
    } catch (falha) {
      setErro(falha instanceof Error && ['canvas', 'grande'].includes(falha.message) ? p.fotoIlegivel : textoErro(codigoDoErro(falha)));
      setEnviando(false);
    }
  }

  return (
    <div className="folha-fundo folha-fundo--centro" role="presentation">
      <div className="folha folha--recorte" role="dialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={dicaId} aria-busy={enviando || undefined} ref={caixa}>
        <div className="folha-topo">
          <p className="folha-contexto">{p.fotoRotulo}</p>
          <button type="button" className="folha-fechar" aria-label={p.recorteCancelar} disabled={enviando} onClick={aoCancelar}><Icone nome="fechar" /></button>
        </div>
        <h2 id={tituloId} className="folha-titulo">{p.recorteTitulo}</h2>
        <p id={dicaId} className="folha-texto folha-texto--miudo">{p.recorteDica}</p>
        <div ref={quadro} className="recorte" tabIndex={0} role="group" aria-label={p.recorteArea} aria-describedby={tecladoId}
          onPointerDown={aoPressionar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar} onKeyDown={aoTeclar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imagem} src={origem} alt="" draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setErro(p.fotoIlegivel)}
            style={natural ? { width: largura, height: altura, transform: `translate(${pos.x}px, ${pos.y}px)` } : { opacity: 0 }} />
          <span className="recorte__circulo" aria-hidden="true" />
        </div>
        <p id={tecladoId} className="somente-leitor">{p.recorteTeclado}</p>
        <label className="recorte__zoom">
          <span>{p.recorteZoom}</span>
          <input type="range" min={100} max={ZOOM_MAX * 100} step={1} value={Math.round(zoom * 100)} disabled={!natural}
            onChange={(e) => aplicarZoom(Number(e.target.value) / 100)} />
        </label>
        <p className="folha-aviso recorte__aviso" role="note">{p.fotoAviso}</p>
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
