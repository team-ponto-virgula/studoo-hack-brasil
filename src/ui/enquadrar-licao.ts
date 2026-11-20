type Faixa = { top: number; bottom: number };

export function deslocamentoDaLicao(area: Faixa, no: Faixa, balao?: Faixa): number {
  const inicio = area.top + 16;
  const fim = area.bottom - 16;
  const topo = Math.min(no.top, balao?.top ?? no.top);
  const base = Math.max(no.bottom, balao?.bottom ?? no.bottom);
  if (base - topo > fim - inicio) return (balao?.top ?? topo) - inicio;
  if (topo < inicio) return topo - inicio;
  return Math.max(0, base - fim);
}

export function enquadrarLicao(no: HTMLElement, balao?: HTMLElement | null) {
  const viewport = window.visualViewport;
  const topo = viewport?.offsetTop ?? 0;
  const base = topo + (viewport?.height ?? window.innerHeight);
  const cabecalho = document.querySelector<HTMLElement>('.trilha-topo');
  const preso = cabecalho && ['sticky', 'fixed'].includes(getComputedStyle(cabecalho).position);
  const capsula = document.querySelector<HTMLElement>('.navegacao-mobile');
  const abas = capsula?.getBoundingClientRect();
  const area = {
    top: preso ? Math.max(topo, cabecalho.getBoundingClientRect().bottom) : topo,
    bottom: abas?.height ? Math.min(base, abas.top) : base,
  };
  const caixa = no.getBoundingClientRect();
  const etiqueta = no.querySelector('.caminho-no__etiqueta')?.getBoundingClientRect();
  const alvo = etiqueta?.height ? { top: Math.min(caixa.top, etiqueta.top), bottom: Math.max(caixa.bottom, etiqueta.bottom) } : caixa;
  // A animação de abertura escala o balão. A posição de layout já tem o tamanho final.
  const pai = balao?.offsetParent;
  const inicio = balao && pai instanceof HTMLElement ? pai.getBoundingClientRect().top + pai.clientTop + balao.offsetTop : 0;
  const dialogo = balao ? { top: inicio, bottom: inicio + balao.offsetHeight } : undefined;
  const top = deslocamentoDaLicao(area, alvo, dialogo);
  if (Math.abs(top) > 0.5) window.scrollBy({ top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
