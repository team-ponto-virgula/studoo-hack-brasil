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
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) if (entrada.isIntersecting) marcar(entrada.target as HTMLElement);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    // O primeiro começa ativo; os outros assumem quando cruzam o meio.
    momentos[0].setAttribute('data-ativo', '');
    for (const momento of momentos) observador.observe(momento);
    return () => observador.disconnect();
  }, []);
  return <div ref={raiz} className="cn-s2__momentos">{children}</div>;
}
