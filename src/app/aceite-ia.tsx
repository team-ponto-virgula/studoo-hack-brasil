'use client';

/*
 * Aceite do envio a IA de terceiros na web (App Review 5.1.2(i)). O servidor barra com `consentimento_ia` (428) toda
 * rota que mandaria dado da pessoa à DeepSeek ou à OpenAI sem aceite vigente; aqui o 428 abre a folha que diz quem
 * recebe o quê, e "Permitir" grava o aceite e refaz o pedido uma vez. "Agora não" devolve o 428 a quem pediu, que
 * mostra o erro de sempre. Nada de janela nativa: a folha é do Studoo.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { CAMINHO_POLITICA, interpretarEstadoPrivacidade, type EstadoPrivacidade } from '@studoo/contratos/privacidade';
import { mensagens, textoErro } from '../mensagens/pt-BR';
import { Botao } from '../ui';
import { useDialogo } from './compartilhar';
import './privacidade.css';

const t = mensagens.privacidade;

type Pedido = { estado: EstadoPrivacidade; responder: (aceito: boolean) => void };
let ouvinte: ((pedido: Pedido) => void) | null = null;
let pendente: Promise<boolean> | null = null;

/** Abre a folha (uma só, mesmo com vários pedidos barrados juntos) e diz se a pessoa permitiu. Sem folha montada, não. */
export function pedirAceiteIa(estado: EstadoPrivacidade): Promise<boolean> {
  if (pendente) return pendente;
  if (!ouvinte) return Promise.resolve(false);
  const abrir = ouvinte;
  pendente = new Promise<boolean>((responder) => abrir({ estado, responder })).finally(() => { pendente = null; });
  return pendente;
}

/** O estado de privacidade de uma resposta 428 `consentimento_ia`; fora disso, null. Não consome o corpo original. */
async function estadoDoBloqueio(resposta: Response): Promise<EstadoPrivacidade | null> {
  if (resposta.status !== 428) return null;
  const corpo: unknown = await resposta.clone().json().catch(() => null);
  if (typeof corpo !== 'object' || corpo === null || (corpo as { codigo?: unknown }).codigo !== 'consentimento_ia') return null;
  return interpretarEstadoPrivacidade((corpo as { privacidade?: unknown }).privacidade);
}

/** Faz o pedido; se o servidor pedir o aceite, pergunta e, com "Permitir", refaz uma vez. */
export async function comAceiteIa(fazer: () => Promise<Response>): Promise<Response> {
  const resposta = await fazer();
  const estado = await estadoDoBloqueio(resposta);
  if (!estado || !(await pedirAceiteIa(estado))) return resposta;
  return fazer();
}

/** Grava o aceite da versão vigente (fora do cliente com aceite, para não entrar em laço). */
export async function gravarAceiteIa(versao: string): Promise<EstadoPrivacidade> {
  const resposta = await fetch('/api/privacidade/consentimento-ia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versao }),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const corpo: unknown = await resposta.json().catch(() => null);
  const estado = resposta.ok ? interpretarEstadoPrivacidade(corpo) : null;
  if (!estado) throw new Error(typeof corpo === 'object' && corpo !== null && typeof (corpo as { codigo?: unknown }).codigo === 'string' ? (corpo as { codigo: string }).codigo : 'falha');
  return estado;
}

/** Quem recebe o quê, com o link da política de cada provedor e a do Studoo. Usado na folha e no Perfil. */
export function ListaProvedores({ estado }: { estado: EstadoPrivacidade }) {
  return (
    <div className="privacidade-provedores">
      <ul>
        {estado.consentimentoIa.provedores.map((provedor) => (
          <li key={provedor.id}>
            <strong>{provedor.nome}</strong>
            <ul>{provedor.usos.map((uso) => <li key={uso}>{uso}</li>)}</ul>
            <a href={provedor.politica} target="_blank" rel="noopener noreferrer">{t.politicaDe(provedor.nome)}</a>
          </li>
        ))}
      </ul>
      <a href={estado.politica || CAMINHO_POLITICA} target="_blank" rel="noopener">{t.politica}</a>
    </div>
  );
}

function FolhaAceite({ estado, aoResponder }: { estado: EstadoPrivacidade; aoResponder: (aceito: boolean) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const textoId = useId();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  useDialogo(caixa, () => { if (!ocupado) aoResponder(false); });
  useEffect(() => { caixa.current?.querySelector<HTMLButtonElement>('.folha-acoes button')?.focus(); }, []);

  async function permitir() {
    setOcupado(true);
    setErro(null);
    try {
      await gravarAceiteIa(estado.consentimentoIa.versao);
      aoResponder(true);
    } catch (falha) {
      setErro(textoErro(falha instanceof Error ? falha.message : 'falha'));
      setOcupado(false);
    }
  }

  return (
    <div className="folha-fundo folha-fundo--centro" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !ocupado) aoResponder(false); }}>
      <div className="folha folha--confirmar" role="dialog" aria-modal="true" aria-labelledby={tituloId} aria-describedby={textoId} ref={caixa}>
        <h2 id={tituloId} className="folha-titulo">{t.aceiteTitulo}</h2>
        <p id={textoId} className="folha-texto">{t.aceiteTexto}</p>
        <h3 className="privacidade-subtitulo">{t.aceiteQuem}</h3>
        <ListaProvedores estado={estado} />
        <p className="folha-texto folha-texto--miudo">{t.aceiteSemIa}</p>
        {erro && <p className="campo-erro" role="alert">{erro}</p>}
        <div className="folha-acoes folha-acoes--par">
          <Botao variante="secundario" disabled={ocupado} onClick={() => aoResponder(false)}>{t.agoraNao}</Botao>
          <Botao disabled={ocupado} onClick={() => void permitir()}>{ocupado ? t.permitindo : t.permitir}</Botao>
        </div>
      </div>
    </div>
  );
}

/** Montado uma vez no layout: escuta os pedidos de aceite e mostra a folha. */
export function AmbienteAceiteIa() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  useEffect(() => {
    ouvinte = setPedido;
    return () => { if (ouvinte === setPedido) ouvinte = null; };
  }, []);
  if (!pedido) return null;
  return <FolhaAceite estado={pedido.estado} aoResponder={(aceito) => { pedido.responder(aceito); setPedido(null); }} />;
}
