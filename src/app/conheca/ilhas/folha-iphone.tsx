'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { textos } from '../textos';
import { AbrirAppNoSafari, PassosDoIphone } from './passos';
import '../../compartilhar.css'; // `.folha-fundo` e `.folha`: a mesma folha do resto do site (spec 11); só carrega quando a pessoa abre a folha.

const t = textos.folhaIphone;

/** No iPhone, só o Safari adiciona à Tela de Início: os outros navegadores e os de dentro de aplicativos pedem para abrir no Safari. */
export function foraDoSafariNoIphone(userAgent: string): boolean {
  if (!/iPhone|iPad|iPod/.test(userAgent)) return false;
  return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|LinkedInApp/.test(userAgent) || !/Safari\//.test(userAgent);
}

/**
 * Instruções da Tela de Início para iPad e iPhone sem convite do TestFlight. A folha recebe foco no título e mantém Tab dentro dela.
 * Esc e toque fora fecham, e o foco volta ao botão que a abriu. Sai do herói e entra na raiz da página (portal): lá dentro o contexto de empilhamento do texto
 * do herói (z-index 1) deixava o celular do herói, que vem depois, passar por cima da folha e do escurecimento.
 */
export default function FolhaIphone({ aoFechar, appParaInstalar, ipad = false }: { aoFechar: () => void; appParaInstalar: string; ipad?: boolean }) {
  const caixa = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const idTitulo = useId();
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  const [foraDoSafari] = useState(() => foraDoSafariNoIphone(window.navigator.userAgent));

  // O botão que abriu a folha (guardado uma vez) e a devolução do foco (adiada: um novo desenho no desenvolvimento a cancela).
  const origemDoFoco = useRef<HTMLElement | null | undefined>(undefined);
  const devolucao = useRef(0);
  useEffect(() => {
    window.cancelAnimationFrame(devolucao.current);
    if (origemDoFoco.current === undefined) origemDoFoco.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    titulo.current?.focus();
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') { evento.preventDefault(); fechar.current(); return; }
      if (evento.key !== 'Tab' || !caixa.current) return;
      const focaveis = Array.from(caixa.current.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (evento.shiftKey && (document.activeElement === primeiro || !caixa.current.contains(document.activeElement))) { evento.preventDefault(); ultimo.focus(); }
      else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagem;
      devolucao.current = window.requestAnimationFrame(() => { const origem = origemDoFoco.current; if (origem?.isConnected) origem.focus(); });
    };
  }, []);

  const raiz = document.querySelector<HTMLElement>('.cn-pagina') ?? document.body;
  return createPortal(
    <div className="folha-fundo" role="presentation" onClick={(evento) => { if (evento.target === evento.currentTarget) aoFechar(); }}>
      <div className="folha cn-folha" role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={caixa}>
        <div className="folha-topo">
          <span aria-hidden="true" />
          <button type="button" className="folha-fechar" aria-label={t.fechar} onClick={aoFechar}>
            <svg className="cn-icone" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <h2 id={idTitulo} ref={titulo} tabIndex={-1} className="folha-titulo">{ipad ? t.tituloIpad : t.titulo}</h2>
        <p className="folha-texto">{t.texto}</p>
        {foraDoSafari && <p className="folha-texto cn-folha__aviso" role="note">{t.foraDoSafari}</p>}
        <PassosDoIphone />
        <div className="folha-acoes folha-acoes--empilhadas cn-folha__acoes">
          <AbrirAppNoSafari href={appParaInstalar} />
          <button type="button" className="botao botao--texto" onClick={aoFechar}>{t.entendi}</button>
        </div>
      </div>
    </div>,
    raiz,
  );
}
