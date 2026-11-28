'use client';

import { useEffect } from 'react';

/**
 * A entrada de cada seção (spec 18, seção 4): com 20% da seção na tela, uma vez, 400 ms, sumir e aparecer subindo 16 px. Só esconde o
 * que ainda está fora da janela quando a página abre: o que já está à vista nunca pisca, e sem JavaScript ou com movimento reduzido
 * tudo já está à vista. Só mexe em opacidade e posição: nenhum salto de layout. `data-revelar-itens` marca uma lista cujos itens entram um a um (as fichas do S3): a ilha põe
 * `data-oculto` e depois `data-revelado` nela, e o CSS anima os filhos, não a lista.
 */
export function Revelar() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const alvos = Array.from(document.querySelectorAll<HTMLElement>('[data-revelar], [data-revelar-itens]'));
    const altura = window.innerHeight;
    const observador = new IntersectionObserver((entradas) => {
      for (const entrada of entradas) {
        // 20% da seção; numa seção mais alta que cinco janelas, metade da janela já basta.
        if (!entrada.isIntersecting || (entrada.intersectionRatio < 0.2 && entrada.intersectionRect.height < altura * 0.5)) continue;
        (entrada.target as HTMLElement).dataset.revelado = 'true';
        observador.unobserve(entrada.target);
      }
    }, { threshold: [0, 0.2] });
    for (const alvo of alvos) {
      if (alvo.getBoundingClientRect().top < altura * 0.85) { alvo.dataset.revelado = 'true'; continue; }
      alvo.dataset.oculto = 'true';
      observador.observe(alvo);
    }
    return () => observador.disconnect();
  }, []);
  return null;
}
