'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MOTIVOS_DENUNCIA, type MotivoDenuncia } from '@studoo/contratos';
import { mensagens } from '../../mensagens/pt-BR';
import { Botao } from '../../ui';

export async function pedido<T>(url: string, corpo?: unknown): Promise<T> {
  const r = await fetch(url, corpo === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const dados = await r.json();
  if (!r.ok) throw new Error(dados.mensagem || 'Não foi possível concluir o pedido.');
  return dados as T;
}

export function FormularioSuporte({ tipo, alvo, nomeAlvo, inicial = '' }: { tipo?: 'perfil' | 'trilha'; alvo?: string; nomeAlvo?: string; inicial?: string }) {
  const [mensagem, escrever] = useState('');
  const [motivo, escolher] = useState<MotivoDenuncia | ''>('');
  const [protocolo, digitar] = useState(inicial);
  const [recibo, receber] = useState('');
  const [caso, mostrar] = useState<{ estado: string; resposta: string | null } | null>(null);
  const [erro, falhar] = useState('');
  const [ocupado, ocupar] = useState(false);
  const campoProtocolo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = new URLSearchParams(location.hash.slice(1)).get('protocolo');
    if (id) { digitar(id); campoProtocolo.current?.focus(); }
  }, []);
  async function enviar(e: FormEvent) {
    e.preventDefault(); if (ocupado) return;
    ocupar(true); falhar('');
    try {
      const r = tipo && alvo ? await pedido<{ protocolo: string }>('/api/denuncias', { alvoTipo: tipo, alvo, motivo })
        : await pedido<{ protocolo: string }>('/api/suporte', { mensagem });
      receber(r.protocolo); digitar(r.protocolo); escrever(''); mostrar(null);
    } catch(e) { falhar((e as Error).message); } finally { ocupar(false); }
  }
  async function consultar(e: FormEvent) {
    e.preventDefault(); ocupar(true); falhar(''); mostrar(null);
    try { mostrar(await pedido('/api/suporte/protocolo', { protocolo: protocolo.trim() })); }
    catch(e) { falhar((e as Error).message); } finally { ocupar(false); }
  }
  return <div className="atendimento">
    {tipo && alvo && <Link className="voltar-pagina" href={`/${tipo === 'trilha' ? 't' : 'p'}/${alvo}`}>Voltar</Link>}
    <h1>{tipo ? mensagens.comunidade.denuncia[tipo === 'trilha' ? 'tituloTrilha' : 'tituloPerfil'] : 'Suporte do Studoo'}</h1>
    {tipo && <><p className="denuncia__alvo">{nomeAlvo || <code>{alvo}</code>}</p>
      <p>{tipo === 'trilha' ? mensagens.comunidade.denuncia.texto : mensagens.comunidade.denuncia.textoPerfil}</p></>}
    {recibo ? <section aria-live="polite"><h2>{tipo ? 'Denúncia enviada' : 'Mensagem recebida'}</h2><p>Guarde seu protocolo para acompanhar a resposta da equipe.</p><code>{recibo}</code></section> :
    <form onSubmit={enviar} noValidate>
      {tipo && alvo ? <><fieldset><legend>Motivo da denúncia</legend>{MOTIVOS_DENUNCIA.map(m => <label className="denuncia__motivo" key={m}><input type="radio" name="motivo" checked={motivo === m} onChange={() => escolher(m)} />{mensagens.comunidade.denuncia.motivos[m]}</label>)}</fieldset></>
        : <><label htmlFor="ajuda-mensagem">Como podemos ajudar?</label><textarea id="ajuda-mensagem" rows={4} maxLength={2000} value={mensagem} onChange={e => escrever(e.target.value)} /><p className="campo-dica">Evite incluir senhas ou códigos de acesso.</p></>}
      <Botao type="submit" disabled={ocupado || (tipo ? !motivo : mensagem.trim().length < 5)}>{tipo ? 'Enviar denúncia' : 'Enviar mensagem'}</Botao>
    </form>}
    <section><h2>Acompanhar protocolo</h2><form onSubmit={consultar} noValidate><label htmlFor="ajuda-protocolo">Seu protocolo</label>
      <input ref={campoProtocolo} autoCapitalize="none" spellCheck={false} id="ajuda-protocolo" value={protocolo} onChange={e => digitar(e.target.value)} />
      <Botao type="submit" variante="secundario" disabled={ocupado || !protocolo.trim()}>Consultar</Botao></form>
      {caso && <div role="status"><strong>{caso.estado}</strong>{caso.resposta && <p>{caso.resposta}</p>}</div>}
    </section>{erro && <p className="campo-erro" role="alert">{erro}</p>}
  </div>;
}
