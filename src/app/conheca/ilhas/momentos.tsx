'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Os quatro momentos do S2 (spec 18, seção 4): marca qual texto cruza o meio da tela (faixa fina no meio da janela). No computador,
 * o CSS prende o celular à direita e a tela dentro dele troca (300 ms, sumir e aparecer, com a moldura parada) conforme o momento que
 * se lê; no celular e no tablet cada momento tem a sua captura e a marca só dispara o selo. O selo "Progresso salvo agora" do momento 4
 * acende uma vez, quando o momento chega ao meio. Sem JavaScript ou com movimento reduzido, nada troca: cada momento mostra a sua captura.
 */
export function Momentos({ children }: { children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const momentos = Array.from(el.querySelectorAll<HTMLElement>('[data-momento]'));
    if (momentos.length === 0) return;
    const marcar = (alvo: HTMLElement) => {
      for (const momento of momentos) momento.toggleAttribute('data-ativo', momento === alvo);
      if (alvo.dataset.momento === '4') alvo.setAttribute('data-sincronizou', 'true');
    };
    // Observa o texto de cada momento: no computador o artigo é `display: contents` (sem caixa), e só o que tem caixa cruza o meio.
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        const momento = (entrada.target as HTMLElement).closest<HTMLElement>('[data-momento]');
        if (entrada.isIntersecting && momento) marcar(momento);
      }
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    // O primeiro começa ativo; os outros assumem quando o texto cruza o meio.
    momentos[0].setAttribute('data-ativo', '');
    for (const momento of momentos) { const texto = momento.querySelector('.cn-momento__texto'); if (texto) observador.observe(texto); }
    return () => observador.disconnect();
  }, []);
  return <div ref={raiz} className="cn-s2__momentos">{children}</div>;
}
