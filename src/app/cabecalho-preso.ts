import { useEffect, type RefObject } from 'react';

/**
 * O cabeçalho do mapa fica preso no alto (sticky, top 0) no celular. Enquanto o topo dele ainda não chegou a 0, ele está no lugar de origem e não há
 * mapa por baixo; a partir daí, a página rolou e o mapa passa sob o cabeçalho (spec 16, item 3: só então a linha de 1 px aparece).
 */
export function cabecalhoComMapaPorBaixo(topoDoCabecalho: number, rolagemDaPagina: number): boolean {
  return rolagemDaPagina > 0 && topoDoCabecalho <= 0.5;
}

/** Marca o cabeçalho com `data-preso` quando o mapa rola por baixo dele. Sem re-renderizar: só o atributo muda, a cada quadro de rolagem. */
export function useCabecalhoPreso(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const cabecalho = ref.current;
    if (!cabecalho) return;
    let quadro = 0;
    const atualizar = () => {
      quadro = 0;
      // Só o cabeçalho que está mesmo preso (no celular; no tablet e no computador ele rola com a página).
      if (getComputedStyle(cabecalho).position === 'sticky' && cabecalhoComMapaPorBaixo(cabecalho.getBoundingClientRect().top, window.scrollY)) cabecalho.setAttribute('data-preso', '');
      else cabecalho.removeAttribute('data-preso');
    };
    const aoRolar = () => { if (!quadro) quadro = requestAnimationFrame(atualizar); };
    atualizar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    window.addEventListener('resize', aoRolar);
    return () => {
      window.removeEventListener('scroll', aoRolar);
      window.removeEventListener('resize', aoRolar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [ref]);
}
