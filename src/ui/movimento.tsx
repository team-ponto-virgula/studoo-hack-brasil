'use client';

import { useEffect } from 'react';

/** Interrompe animações CSS em abas ocultas e evita navegação sobre o teclado. */
export function AmbienteMovimento() {
  useEffect(() => {
    const raiz = document.documentElement;
    const visibilidade = () => { raiz.dataset.pausado = String(document.hidden); };
    // Só campo de digitar abre o teclado (caixa de seleção, rádio, arquivo e controle deslizante não).
    const digita = (campo: EventTarget | null) => campo instanceof HTMLTextAreaElement
      || (campo instanceof HTMLInputElement && !['checkbox', 'radio', 'file', 'range', 'button', 'submit', 'reset', 'color'].includes(campo.type));
    let adiado: number | undefined;
    const teclado = (evento?: FocusEvent) => {
      const campo = evento?.type === 'focusout' ? evento.relatedTarget : document.activeElement;
      window.clearTimeout(adiado);
      if (digita(campo)) { raiz.dataset.teclado = 'true'; return; }
      // Tanto o focusout do campo como o focusin do botão chegam antes do clique. Se a ilha voltar entre eles,
      // a ação de salvar muda de posição antes de a pessoa soltar o botão.
      if (evento && raiz.dataset.teclado === 'true') adiado = window.setTimeout(() => { raiz.dataset.teclado = 'false'; }, 350);
      else raiz.dataset.teclado = 'false';
    };
    visibilidade();
    teclado();
    document.addEventListener('visibilitychange', visibilidade);
    document.addEventListener('focusin', teclado);
    document.addEventListener('focusout', teclado);
    return () => {
      document.removeEventListener('visibilitychange', visibilidade);
      document.removeEventListener('focusin', teclado);
      document.removeEventListener('focusout', teclado);
      window.clearTimeout(adiado);
      delete raiz.dataset.pausado;
      delete raiz.dataset.teclado;
    };
  }, []);
  return null;
}
