'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { etapaTemFolga } from '@studoo/contratos';

/** Mede o miolo da aula: a área que a etapa tem (do alto do miolo ao rodapé) e a altura do conteúdo, sem o Stu da folga (`data-folga-stu`) e sem o que sai do fluxo. */
export function medirEtapa(miolo: HTMLElement): { livre: number; usado: number } {
  const conteudo = [...miolo.children].filter((filho): filho is HTMLElement => {
    if (!(filho instanceof HTMLElement) || 'folgaStu' in filho.dataset) return false;
    const estilo = getComputedStyle(filho);
    return estilo.display !== 'none' && estilo.position !== 'absolute' && estilo.position !== 'fixed';
  });
  // As margens não entram: as automáticas, que centralizam o conjunto, valem o que sobra e inflariam a conta.
  const vao = parseFloat(getComputedStyle(miolo).rowGap) || 0;
  const usado = conteudo.reduce((soma, filho) => soma + filho.getBoundingClientRect().height, 0) + vao * Math.max(0, conteudo.length - 1);
  return { livre: miolo.clientHeight, usado };
}

/**
 * Refino 4 (spec 16): a etapa é curta (cabe sem rolar e sobram 40% ou mais da área livre)? Devolve a ref do miolo e a resposta. Confere depois de toda renderização e quando um filho muda de
 * altura (fórmula que termina de ser medida, fonte que chega, citação que abre). `ativo` é falso fora do Conceito e do Exemplo.
 */
export function useFolgaDaEtapa(ativo: boolean) {
  const miolo = useRef<HTMLDivElement>(null);
  const [folga, setFolga] = useState(false);
  useLayoutEffect(() => {
    const el = miolo.current;
    if (!ativo || !el) { setFolga(false); return; }
    const conferir = () => setFolga(etapaTemFolga(medirEtapa(el)));
    conferir();
    const observador = new ResizeObserver(conferir);
    observador.observe(el);
    for (const filho of el.children) observador.observe(filho);
    return () => observador.disconnect();
  });
  return { miolo, folga };
}
