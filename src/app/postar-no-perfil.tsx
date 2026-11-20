'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { LinkCompartilhado, Perfil, PlanoResumo } from '@studoo/contratos';
import { clienteStudooWeb as cliente } from '../contratos/cliente-web';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao, Icone } from '../ui';
import { DialogoConfirmar, codigoDoErro, useDialogo } from './compartilhar';
import { CapaDaTrilha } from './configuracoes';
import { FaixaComunidade } from './seguranca-comunidade';
import { ChaveStudoo } from './som';
import { salvarPostagem } from './postar-estado';

const p = mensagens.perfil.postar;
const s = mensagens.seguranca;
type AcaoMenu = { texto: string; executar: () => void };
type Aviso = { texto: string; desfazer?: LinkCompartilhado };
type Progresso = { ligar?: boolean; erro?: string };
const Contexto = createContext<{ abrir: () => void; menu: (plano: PlanoResumo) => AcaoMenu | undefined } | null>(null);
export const usePostarNoPerfil = () => useContext(Contexto);

function jaPostou(perfil: Perfil) {
  if (perfil.links.some(link => link.noPerfil)) return true;
  try { return !!perfil.perfilId && localStorage.getItem('studoo.postouNoPerfil.' + perfil.perfilId) === '1'; }
  catch { return false; }
}

export function PostarNoPerfil({ ativo, planos, perfil, atualizarPerfil, mudarLink, editarNome, novaTrilha, children }: {
  ativo: boolean; planos: PlanoResumo[]; perfil: Perfil | null; atualizarPerfil: (p: Perfil) => void;
  mudarLink: (id: string, link: LinkCompartilhado) => void; editarNome: () => void; novaTrilha: () => void; children: ReactNode;
}) {
  const [aberta, mostrar] = useState(false);
  const [retirar, confirmar] = useState<LinkCompartilhado | null>(null);
  const [progresso, marcar] = useState<Record<string, Progresso>>({});
  const [aviso, avisar] = useState<Aviso | null>(null);
  const ocupadas = useRef(new Set<string>());
  const revisao = useRef(0);
  const limparAviso = useCallback(() => avisar(null), []);

  useEffect(() => {
    if (!perfil?.perfilId || !perfil.links.some(link => link.noPerfil)) return;
    try { localStorage.setItem('studoo.postouNoPerfil.' + perfil.perfilId, '1'); } catch {}
  }, [perfil]);

  function abrir() {
    mostrar(true);
    const inicio = revisao.current;
    // Uma aprovação pode ter vindo da equipe. Uma leitura anterior nunca substitui uma escrita local mais nova.
    if (ocupadas.current.size === 0) void cliente.obterPerfil().then(novo => {
      if (inicio === revisao.current) atualizarPerfil(novo);
    }).catch(() => undefined);
  }

  async function salvar(id: string, ligar: boolean, anterior?: LinkCompartilhado, restaurar?: LinkCompartilhado) {
    if (ocupadas.current.has(id)) return;
    ocupadas.current.add(id);
    revisao.current++;
    marcar(outros => ({ ...outros, [id]: { ligar } }));
    limparAviso();
    try {
      const novo = await salvarPostagem(cliente, id, anterior, ligar, link => mudarLink(id, link), restaurar);
      if (!ligar) avisar({ texto: p.avisoTirada, desfazer: anterior });
      else if (novo.moderacao === 'pendente') avisar({ texto: s.enviadaParaRevisao });
      else avisar({ texto: novo.moderacao === 'recusado' ? s.naoPublicada : p.aviso });
      marcar(outros => ({ ...outros, [id]: {} }));
    } catch (e) {
      const codigo = codigoDoErro(e);
      const erro = codigo === 'limite_compartilhar' || codigo === 'conteudo_recusado' ? textoErro(codigo) : p.erro;
      marcar(outros => ({ ...outros, [id]: { erro } }));
      if (!aberta) avisar({ texto: erro });
    } finally {
      ocupadas.current.delete(id);
    }
  }

  function alterar(plano: PlanoResumo, ligar: boolean) {
    if (!perfil?.nome || plano.recebida || ocupadas.current.has(plano.id)) return;
    const link = perfil.links.find(item => item.planoId === plano.id);
    if (!ligar && link?.visibilidade === 'explorar') { confirmar(link); return; }
    void salvar(plano.id, ligar, link);
  }

  function menu(plano: PlanoResumo): AcaoMenu | undefined {
    if (!perfil || plano.recebida) return;
    const ligada = !!perfil.links.find(link => link.planoId === plano.id)?.noPerfil;
    return { texto: ligada ? p.menuTirar : p.menuPostar, executar: () => {
      if (!perfil.nome || (!ligada && !jaPostou(perfil))) abrir();
      else alterar(plano, !ligada);
    } };
  }

  const faixa = aviso && <FaixaComunidade texto={aviso.texto} acao={aviso.desfazer ? s.desfazer : undefined} aoFechar={limparAviso} aoAgir={() => {
    const anterior = aviso.desfazer;
    if (!anterior) return;
    const atual = perfil?.links.find(link => link.planoId === anterior.planoId);
    if (atual && !atual.noPerfil) void salvar(anterior.planoId, true, atual, anterior);
    else limparAviso();
  }} />;
  return <Contexto.Provider value={ativo && perfil && !perfil.visitante ? { abrir, menu } : null}>
    {children}
    {ativo && perfil && aberta && <FolhaPostar planos={planos} perfil={perfil} progresso={progresso} alterar={alterar}
      fechar={() => mostrar(false)} editar={() => { mostrar(false); editarNome(); }} criar={() => { mostrar(false); novaTrilha(); }}>{faixa}</FolhaPostar>}
    {ativo && !aberta && faixa}
    {ativo && retirar && <DialogoConfirmar titulo={p.confirmarTitulo} texto={p.confirmarTexto} confirmar={p.confirmarAcao}
      cancelar={s.cancelar} destrutivo={false} aoCancelar={() => confirmar(null)} aoConfirmar={() => {
        confirmar(null);
        void salvar(retirar.planoId, false, retirar);
      }} />}
  </Contexto.Provider>;
}

function FolhaPostar({ planos, perfil, progresso, alterar, fechar, editar, criar, children }: {
  planos: PlanoResumo[]; perfil: Perfil; progresso: Record<string, Progresso>; alterar: (plano: PlanoResumo, ligar: boolean) => void;
  fechar: () => void; editar: () => void; criar: () => void; children: ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const tituloId = useId(), textoId = useId();
  useDialogo(caixa, fechar);
  useEffect(() => { titulo.current?.focus(); }, []);
  const proprias = planos.filter(plano => !plano.recebida);
  return <div ref={caixa} className="folha-fundo" role="dialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={textoId}
    onClick={e => { if (e.target === e.currentTarget) fechar(); }}>
    <div className="folha folha-postar">
      <div className="folha-topo"><h2 className="folha-titulo" id={tituloId} ref={titulo} tabIndex={-1}>{p.titulo}</h2>
        <button className="folha-fechar" type="button" aria-label={mensagens.compartilhar.fechar} onClick={fechar}><Icone nome="fechar" /></button></div>
      <p id={textoId} className="folha-texto">{p.texto}</p>
      <p className="campo-dica regras-publicacao">{s.regrasAoPublicar.antes}<Link href={s.rotas.regras}>{s.regrasAoPublicar.link}</Link>{s.regrasAoPublicar.depois}</p>
      {!perfil.nome ? <>
        <p className="folha-texto">{p.semNome}</p><Botao variante="secundario" onClick={editar}>{p.editarPerfil}</Botao>
      </> : proprias.length === 0 ? <>
        <p className="folha-texto">{p.semTrilhas}</p><Botao onClick={criar}>{mensagens.planos.novo}</Botao>
      </> : <ul className="postar-lista">{proprias.map(plano => <Linha key={plano.id} plano={plano} link={perfil.links.find(item => item.planoId === plano.id)}
        progresso={progresso[plano.id]} alterar={ligar => alterar(plano, ligar)} />)}</ul>}
    </div>
    {children}
  </div>;
}

function Linha({ plano, link, progresso, alterar }: { plano: PlanoResumo; link?: LinkCompartilhado; progresso?: Progresso; alterar: (ligar: boolean) => void }) {
  const tituloId = useId(), estadoId = useId();
  const ligada = progresso?.ligar ?? Boolean(link?.noPerfil);
  const salvando = progresso?.ligar !== undefined;
  const revisao = ligada ? link?.moderacao : undefined;
  let estado = '';
  if (progresso?.erro) estado = progresso.erro;
  else if (salvando) estado = p.salvando;
  else if (revisao === 'pendente') estado = s.seloEmRevisao;
  else if (revisao === 'recusado') estado = s.seloNaoPublicada;
  else if (ligada) estado = link?.visibilidade === 'explorar' ? p.estadoPerfilExplorar : p.estadoPerfil;

  return <li className="postar-linha" aria-busy={salvando || undefined}>
    <CapaDaTrilha semente={plano.id} tema={plano.tema ?? null} capa={plano.capa} className="postar-capa" />
    <div className="postar-linha__texto">
      <strong id={tituloId}>{plano.titulo}</strong>
      <span id={estadoId} role="status" className="postar-estado" data-revisao={salvando ? undefined : revisao} data-erro={!!progresso?.erro || undefined}>{estado}</span>
      {ligada && revisao === 'recusado' && !salvando && <Link href={s.rotas.suporte}>{s.falarComSuporte}</Link>}
    </div>
    <ChaveStudoo ligada={ligada} aoMudar={alterar} desabilitada={salvando} rotuloId={tituloId} descricaoId={estadoId} />
  </li>;
}
