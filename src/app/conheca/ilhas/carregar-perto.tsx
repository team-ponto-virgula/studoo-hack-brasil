'use client';

import { useEffect } from 'react';

/**
 * As capturas dos momentos do S2 e a da janela do navegador ficam abaixo da dobra. Com `loading="lazy"` o navegador as buscava logo (a folga dele é de uns 1250 px), junto com a primeira
 * do herói, que é o LCP: no Lighthouse do celular, uns 300 kB de imagem na mesma banda. Aqui elas só são buscadas DEPOIS de a página carregar (mais 300 ms) e quando chegam a uns 700 px da
 * tela (uma janela de celular e um pouco): o `CapturaDaTela` com `sobDemanda` manda um pixel transparente no `src` e o endereço de verdade em `data-src` e `data-srcset`, que esta ilha
 * passa para os atributos de verdade (e o `<source>` do AVIF). Sem JavaScript, o <noscript> de cada uma traz a captura de verdade.
 */
const MARGEM = '700px 0px';
const ESPERA_DEPOIS_DA_CARGA_MS = 300;

export function CarregarPerto() {
  useEffect(() => {
    const imagens = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-srcset]'));
    if (imagens.length === 0) return;
    let observador: IntersectionObserver | undefined;
    let relogio = 0;
    const carregar = (imagem: HTMLImageElement) => {
      const figura = imagem.parentElement;
      for (const fonte of figura?.querySelectorAll<HTMLSourceElement>('source[data-srcset]') ?? []) {
        fonte.srcset = fonte.dataset.srcset ?? '';
        fonte.removeAttribute('data-srcset');
      }
      imagem.srcset = imagem.dataset.srcset ?? '';
      imagem.src = imagem.dataset.src ?? imagem.src;
      imagem.removeAttribute('data-srcset');
      imagem.removeAttribute('data-src');
    };
    const iniciar = () => {
      observador = new IntersectionObserver((entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          carregar(entrada.target as HTMLImageElement);
          observador?.unobserve(entrada.target);
        }
      }, { rootMargin: MARGEM });
      for (const imagem of imagens) observador.observe(imagem);
    };
    const depoisDaCarga = () => { relogio = window.setTimeout(iniciar, ESPERA_DEPOIS_DA_CARGA_MS); };
    if (document.readyState === 'complete') depoisDaCarga();
    else window.addEventListener('load', depoisDaCarga, { once: true });
    return () => {
      window.removeEventListener('load', depoisDaCarga);
      window.clearTimeout(relogio);
      observador?.disconnect();
    };
  }, []);
  return null;
}
