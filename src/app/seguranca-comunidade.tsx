'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MOTIVOS_DENUNCIA, type MotivoDenuncia } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone } from '../ui';
import { DialogoConfirmar, codigoDoErro, useDialogo } from './compartilhar';
import './comunidade.css';

const c = mensagens.comunidade;
const seg = mensagens.seguranca;
type Alvo = { tipo: 'perfil' | 'trilha'; alvo: string; nome: string; titulo: string };
type Acao = 'bloquear' | 'denunciar';
const Contexto = createContext({ versao: 0, confirmarLeitura: (_versao: number) => {}, abrir: (_alvo: Alvo, _acao: Acao) => {} });
export const useAtualizacaoComunidade = () => useContext(Contexto);

export function MenuPublicacao({ tipo, alvo, nome, titulo, logado }: Alvo & { logado: boolean }) {
  const central = useContext(Contexto);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idMenu = useId();
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: PointerEvent) => { if (!caixa.current?.contains(evento.target as Node)) setAberto(false); };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') { setAberto(false); botao.current?.focus(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) return;
      const itens = Array.from(caixa.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const atual = itens.indexOf(document.activeElement as HTMLElement);
      if (atual < 0) return;
      evento.preventDefault();
      const indice = evento.key === 'Home' ? 0 : evento.key === 'End' ? itens.length - 1 :
        (atual + (evento.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
      itens[indice].focus();
    };
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', tecla);
    caixa.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', tecla); };
  }, [aberto]);
  function escolher(acao: Acao) {
    botao.current?.focus();
    setAberto(false);
    central.abrir({ tipo, alvo, nome, titulo }, acao);
  }
  return (
    <div className="cartao-trilha__menu" ref={caixa}>
      <button ref={botao} type="button" className="cartao-trilha__icone" aria-label={c.mais(titulo)} aria-haspopup="menu" aria-expanded={aberto} aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((valor) => !valor)}><Icone nome="mais" /></button>
      {aberto && (
        <div className="cartao-trilha__opcoes" role="menu" id={idMenu}>
          {logado ? <>
            <button type="button" role="menuitem" onClick={() => escolher('denunciar')}><Icone nome="bandeirinha" />{c.denunciar}</button>
            <button type="button" role="menuitem" onClick={() => escolher('bloquear')}>{seg.bloquear(nome)}</button>
          </> : <Link role="menuitem" href={seg.rotaDenunciaSemSessao(tipo, alvo)}>{c.denunciar}</Link>}
        </div>
      )}
    </div>
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
      const { protocolo } = await cliente.denunciar(alvoTipo, alvo, motivo);
      aoEnviar(protocolo);
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



type Aviso = { texto: string; bloqueio?: string; alvo?: Alvo };
function FaixaComunidade({ aviso, aoFechar, aoAgir }: { aviso: Aviso; aoFechar: () => void; aoAgir: () => void }) {
  const [pausado, pausar] = useState(false);
  const inicioToque = useRef<number | null>(null);
  const acao = aviso.alvo ? seg.bloquearAcao : aviso.bloqueio ? seg.desfazer : null;
  useEffect(() => {
    if (pausado) return;
    const id = window.setTimeout(aoFechar, acao ? 7000 : 4500);
    return () => window.clearTimeout(id);
  }, [aviso, acao, pausado, aoFechar]);
  return <aside className="aviso-app seguranca-faixa" onMouseEnter={() => pausar(true)} onMouseLeave={() => pausar(false)}
    onFocus={() => pausar(true)} onBlur={() => pausar(false)}
    onTouchStart={e => { inicioToque.current = e.touches[0].clientY; }}
    onTouchEnd={e => { if (inicioToque.current !== null && e.changedTouches[0].clientY - inicioToque.current > 40) aoFechar(); inicioToque.current = null; }}>
    <p><Icone nome="check" /><span role="status" aria-live="polite">{aviso.texto}</span>
      {acao && <button type="button" onClick={aoAgir}>{acao}</button>}</p>
  </aside>;
}
export function SegurancaComunidade({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [versao, mudar] = useState(0);
  const [lida, confirmarLeitura] = useState(0);
  const caminho = usePathname();
  const fecharAviso = useCallback(() => avisar(null), []);
  const [dialogo, abrir] = useState<{ alvo: Alvo; acao: Acao } | null>(null);
  const [aviso, avisar] = useState<Aviso | null>(null);
  const [ocupado, ocupar] = useState(false);
  const [erro, falhar] = useState('');
  const abrirAcao = (alvo: Alvo, acao: Acao) => { falhar(''); abrir({ alvo, acao }); };
  function atualizar() {
    abrir(null);
    mudar(v => v + 1);
    router.replace('/explorar');
    router.refresh();
  }
  async function confirmar() {
    if (!dialogo || ocupado) return;
    ocupar(true);
    try {
      const { id } = await cliente.bloquear(dialogo.alvo.tipo, dialogo.alvo.alvo);
      avisar({ texto: seg.bloqueada, bloqueio: id });
      atualizar();
    } catch(e) { falhar(textoErro(codigoDoErro(e))); }
    finally { ocupar(false); }
  }
  async function desfazer(id: string) {
    ocupar(true);
    try { await cliente.desbloquear(id); avisar({ texto: seg.desbloqueada }); atualizar(); }
    catch(e) { falhar(textoErro(codigoDoErro(e))); } finally { ocupar(false); }
  }
  return <Contexto.Provider value={{versao, confirmarLeitura, abrir: abrirAcao}}>
    {children}
    {dialogo?.acao === 'bloquear' && <DialogoConfirmar titulo={seg.bloquearTitulo(dialogo.alvo.nome)} texto={seg.bloquearTexto}
      confirmar={seg.bloquearAcao} cancelar={seg.cancelar} ocupado={ocupado} aoConfirmar={() => void confirmar()} aoCancelar={() => { if (!ocupado) abrir(null); }} />}
    {dialogo?.acao === 'denunciar' && <DialogoDenuncia alvoTipo={dialogo.alvo.tipo} alvo={dialogo.alvo.alvo}
      alvoNome={dialogo.alvo.tipo === 'trilha' ? c.denuncia.alvoTrilha(dialogo.alvo.titulo, dialogo.alvo.nome) : dialogo.alvo.nome}
      aoFechar={() => abrir(null)} aoEnviar={protocolo => { avisar({ texto: seg.denunciaEnviada(protocolo), alvo: dialogo.alvo }); atualizar(); }} />}
    {erro && <p className="seguranca-aviso" role="alert">{erro}<button onClick={() => falhar('')}>Fechar</button></p>}
    {aviso && !dialogo && caminho === '/explorar' && lida === versao &&
      <FaixaComunidade aviso={aviso} aoFechar={fecharAviso} aoAgir={() => {
        if (aviso.alvo) abrirAcao(aviso.alvo, 'bloquear');
        if (aviso.bloqueio && !ocupado) void desfazer(aviso.bloqueio);
      }} />}
  </Contexto.Provider>;
}

export function RegrasDaRecusa({ erro }: { erro?: string | null }) {
  if (erro !== seg.recusadaNaHora) return null;
  return <> <Link href={seg.rotas.regras}>{seg.regras}</Link></>;
}

export function EstadoModeracao({ estado }: { estado?: string | null }) {
  if (estado !== 'pendente' && estado !== 'recusado') return null;
  const recusado = estado === 'recusado';
  return <div className="seguranca-estado" data-recusado={recusado || undefined}><strong>{recusado ? seg.seloNaoPublicada : seg.seloEmRevisao}</strong>
    <p>{recusado ? seg.naoPublicada : seg.emRevisao}</p>{recusado && <Link href={seg.rotas.suporte}>{seg.falarComSuporte}</Link>}</div>;
}

export function BloqueadasPerfil() {
  const [itens, listar] = useState<Awaited<ReturnType<typeof cliente.bloqueados>>['itens'] | null>(null);
  const [status, avisar] = useState('');
  const [ocupado, ocupar] = useState<string | null>(null);
  useEffect(() => { let ativo=true; cliente.bloqueados().then(r => {if(ativo) listar(r.itens);}).catch(e => {if(ativo) avisar(textoErro(codigoDoErro(e)));}); return () => {ativo=false;}; },[]);
  async function remover(id: string) {
    ocupar(id);
    try { await cliente.desbloquear(id); listar(antes => antes?.filter(b => b.id !== id) ?? []); avisar(seg.desbloqueada); }
    catch(e) { avisar(textoErro(codigoDoErro(e))); } finally { ocupar(null); }
  }
  return <section className="perfil-secao"><h2 className="perfil-secao__titulo">{seg.bloqueadasTitulo}</h2>
    {itens?.length === 0 && <p>{seg.bloqueadasVazia}</p>}
    {!!itens?.length && <div className="seguranca-lista">{itens.map(b => <div className="seguranca-linha" key={b.id}><span>{b.nome}</span><Botao variante="secundario" aria-label={seg.desbloquearRotulo(b.nome)} disabled={ocupado !== null} onClick={() => void remover(b.id)}>{seg.desbloquear}</Botao></div>)}</div>}
    <p role="status">{status}</p></section>;
}

export function PerfilBloqueado({ id }: { id: string }) {
  const router = useRouter();
  const [erro, falhar] = useState('');
  const [pronto, concluir] = useState(false);
  return <section className="pagina-publica__vazio"><h1>{pronto ? seg.desbloqueada : seg.perfilBloqueado}</h1>
    {!pronto && <Botao onClick={async () => { try { await cliente.desbloquear(id); concluir(true); router.refresh(); } catch(e) { falhar(textoErro(codigoDoErro(e))); } }}>{seg.desbloquear}</Botao>}
    <p role="status">{erro}</p></section>;
}
