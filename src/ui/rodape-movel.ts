/** Refs da ilha e da ação acima dela. A rolagem da página usa a medida inclusive quando o texto quebra linha. */
function medirRodape(altura: string, largura?: string) {
  return (elemento: HTMLElement | null) => {
    if (!elemento) return;
    const raiz = document.documentElement;
    const observador = new ResizeObserver(() => {
      const caixa = elemento.getBoundingClientRect();
      if (!caixa.height) return;
      raiz.style.setProperty(altura, `${caixa.height}px`);
      if (largura) raiz.style.setProperty(largura, `${caixa.width}px`);
    });
    observador.observe(elemento, { box: 'border-box' });
    return () => {
      observador.disconnect();
      raiz.style.removeProperty(altura);
      if (largura) raiz.style.removeProperty(largura);
    };
  };
}

export const medirIlha = medirRodape('--altura-ilha', '--largura-ilha');
export const medirAcaoFixa = medirRodape('--altura-acao-fixa');
