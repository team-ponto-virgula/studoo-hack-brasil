'use client';
import { useEffect, useState } from 'react';
import type { caixa, detalhe } from '@/servidor/compartilhar/atendimento';
import { Botao } from '../../../ui';
import { mensagens } from '../../../mensagens/pt-BR';
import { DialogoConfirmar } from '../../compartilhar';
import { pedido } from '../../suporte/formulario';

type Caixa = Awaited<ReturnType<typeof caixa>>;
type Item = Awaited<ReturnType<typeof detalhe>> & { tipo: string; alvo: string };
type Pedido = Caixa['pedidos'][number];
const data = (d: Date | null) => d ? new Date(d).toLocaleString('pt-BR') : '';
const rotuloMotivo = (m: string) => mensagens.comunidade.denuncia.motivos[m as keyof typeof mensagens.comunidade.denuncia.motivos] || m;

export function CaixaModeracao() {
  const [pagina, ir] = useState(0);
  const [versao, atualizar] = useState(0);
  const [dados, listar] = useState<Caixa | null>(null);
  const [item, mostrar] = useState<Item | null>(null);
  const [caso, abrirPedido] = useState<Pedido | null>(null);
  const [resposta, escrever] = useState('');
  const [ocupado, ocupar] = useState(false);
  const [remover, confirmar] = useState(false);
  const [erro, falhar] = useState('');
  const [status, avisar] = useState('');
  useEffect(() => {
    let ativo = true;
    listar(null);
    pedido<Caixa>('/api/equipe/moderacao?pagina='+pagina).then(c => { if(ativo) listar(c); }).catch(e => { if(ativo) falhar(e.message); });
    return () => { ativo = false; };
  },[pagina,versao]);
  async function examinar(tipo: string, alvo: string) {
    ocupar(true); falhar(''); avisar(''); abrirPedido(null); mostrar(null); escrever('');
    try { const i = await pedido<Awaited<ReturnType<typeof detalhe>>>('/api/equipe/moderacao?'+new URLSearchParams({tipo,alvo})); mostrar({...i,tipo,alvo}); }
    catch(e) { falhar((e as Error).message); } finally { ocupar(false); }
  }
  async function salvar(acao: string) {
    ocupar(true); falhar('');
    try {
      await pedido('/api/equipe/moderacao', caso ? { tipo:'atendimento',alvo:caso.id,acao,resposta } : {tipo:item?.tipo,alvo:item?.alvo,versao:item?.versao,acao,resposta});
      mostrar(null); abrirPedido(null); confirmar(false); escrever(''); avisar('Decisão registrada.'); atualizar(v=>v+1);
    } catch(e) { falhar((e as Error).message + ' Reabra o item para conferir a versão atual.'); } finally { ocupar(false); }
  }
  return <div className="atendimento"><h1>Moderação e suporte</h1>
    <p role="status">{status}</p>{erro && <p className="campo-erro" role="alert">{erro}</p>}
    {item && <section><h2>Revisar {item.tipo}</h2><p>{item.estado}</p><pre>{item.texto}</pre>
      {'imagem' in item && item.imagem && <img alt="Imagem enviada para revisão" src={item.imagem} className="atendimento-midia" />}
      <label htmlFor="moderacao-resposta">Resposta para os protocolos de denúncia</label><textarea id="moderacao-resposta" value={resposta} maxLength={2000} onChange={e=>escrever(e.target.value)} />
      <div className="folha-acoes">{item.versao > 0 ? <>
        <Botao disabled={ocupado} onClick={()=>void salvar('aprovar')}>Aprovar</Botao>
        <Botao variante="secundario" disabled={ocupado} onClick={()=>void salvar('manter')}>Manter no ar</Botao>
        <Botao variante="secundario" className="modal-confirmar--destrutivo" disabled={ocupado} onClick={()=>confirmar(true)}>Remover</Botao></> :
        <Botao disabled={ocupado} onClick={()=>void salvar('arquivar')}>Encerrar denúncias</Botao>}</div>
    </section>}
    {caso && <section><h2>Responder ao suporte</h2><code>{caso.id}</code><p>{caso.mensagem}</p>
      <label htmlFor="suporte-resposta">Resposta</label><textarea id="suporte-resposta" maxLength={2000} value={resposta} onChange={e=>escrever(e.target.value)} />
      <Botao disabled={ocupado || !resposta.trim()} onClick={()=>void salvar('responder')}>Enviar resposta</Botao></section>}
    {dados ? <>
      <section><h2>Denúncias abertas</h2>{!dados.denuncias.length && <p>Nenhuma denúncia nesta página.</p>}{dados.denuncias.map(g=><article key={g.tipo+g.alvo}>
        <strong>{g.tipo} · {g.total} denúncia(s)</strong><p>{g.motivos.map(m=>rotuloMotivo(m.motivo)+' ('+m.total+')').join(', ')}</p>
        <p>{data(g.primeira)} — {data(g.ultima)}</p><Botao disabled={ocupado} variante="secundario" onClick={()=>void examinar(g.tipo,g.alvo)}>Revisar {g.alvo}</Botao></article>)}</section>
      <section><h2>Em revisão</h2>{!dados.itens.length && <p>Nenhum conteúdo nesta página.</p>}{dados.itens.map(i=><article key={i.tipo+i.alvo}><strong>{i.titulo}</strong>
        <p>{i.tipo} · {i.dono || 'Perfil sem nome'}</p><Botao variante="secundario" disabled={ocupado} onClick={()=>void examinar(i.tipo,i.alvo)}>Examinar</Botao></article>)}</section>
      <section><h2>Pedidos de suporte</h2>{!dados.pedidos.length && <p>Nenhum pedido nesta página.</p>}{dados.pedidos.map(p=><article key={p.id}><p>{p.mensagem}</p>
        <Botao variante="secundario" disabled={ocupado} onClick={()=>{mostrar(null);abrirPedido(p);escrever('');avisar('');}}>Responder ao protocolo {p.id}</Botao></article>)}</section>
      <section><h2>Histórico de decisões</h2>{!dados.historico.length && <p>Nenhuma decisão nesta página.</p>}{dados.historico.map(d=><p key={d.id}>{data(d.criadoEm)} · {d.acao} · {d.tipo} {d.alvo} · Operador {d.operadorId}</p>)}</section>
      <nav className="folha-acoes" aria-label="Páginas da caixa"><Botao variante="secundario" disabled={pagina===0} onClick={()=>ir(p=>p-1)}>Anterior</Botao>
        <Botao variante="secundario" disabled={!dados.mais} onClick={()=>ir(p=>p+1)}>Próxima</Botao></nav></> : <p role="status">Carregando…</p>}
    {remover && <DialogoConfirmar titulo="Remover esta publicação?" texto="Ela ficará visível só para quem a enviou. Os protocolos receberão a decisão."
      confirmar="Remover" cancelar="Cancelar" ocupado={ocupado} aoCancelar={()=>confirmar(false)} aoConfirmar={()=>void salvar('remover')} />}
  </div>;
}
