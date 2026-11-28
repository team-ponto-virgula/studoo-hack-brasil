'use client';

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';

/** Os links continuam abrindo os arquivos sem JavaScript ou ao usar Ctrl/Cmd e clique. */
export function VisualizadorDeCapturas({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDialogElement>(null);
  const origem = useRef<HTMLAnchorElement | null>(null);
  const idTitulo = useId();
  const [foto, setFoto] = useState<{ src: string; titulo: string; alt: string; largura: number; altura: number } | null>(null);
  const [original, setOriginal] = useState(false);

  function abrir(evento: MouseEvent<HTMLDivElement>) {
    if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.altKey || evento.shiftKey) return;
    const link = evento.target instanceof Element ? evento.target.closest<HTMLAnchorElement>('a[data-ampliar]') : null;
    if (!link?.dataset.ampliar || !link.dataset.descricao || typeof caixa.current?.showModal !== 'function') return;
    evento.preventDefault();
    origem.current = link;
    setOriginal(false);
    setFoto({ src: link.href, titulo: link.dataset.ampliar, alt: link.dataset.descricao,
      largura: Number(link.dataset.largura), altura: Number(link.dataset.altura) });
  }

  useEffect(() => {
    const dialogo = caixa.current;
    if (!foto || !dialogo) return;
    const rolagem = document.body.style.overflow;
    dialogo.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialogo.open) dialogo.close();
      document.body.style.overflow = rolagem;
      origem.current?.focus({ preventScroll: true });
    };
  }, [foto]);

  return (
    <>
      <div onClick={abrir}>{children}</div>
      <dialog ref={caixa} className="cn-visor" aria-labelledby={foto ? idTitulo : undefined} data-retrato={foto && foto.altura > foto.largura || undefined}
        onClose={(e) => { if (!e.currentTarget.open) setFoto(null); }}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close();
        }}>
        {foto && <>
          <div className="cn-visor__barra">
            <h2 id={idTitulo}>{foto.titulo}</h2>
            <button type="button" className="cn-visor__fechar" onClick={() => caixa.current?.close()}>Fechar <span aria-hidden="true">×</span></button>
          </div>
          <div className="cn-visor__ferramentas">
            <button type="button" aria-pressed={original} onClick={() => setOriginal(!original)}>Tamanho original</button>
          </div>
          <div className="cn-visor__imagem" role="region" aria-label="Imagem ampliada" tabIndex={0} data-original={original || undefined}>
            <img src={foto.src} alt={foto.alt} width={foto.largura} height={foto.altura} />
          </div>
        </>}
      </dialog>
    </>
  );
}
