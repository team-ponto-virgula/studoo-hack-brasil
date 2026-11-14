'use client';

import { useEffect } from 'react';

/** Interrompe animações CSS em abas ocultas e evita navegação sobre o teclado. */
export function AmbienteMovimento() {
  useEffect(() => {
    const raiz = document.documentElement;
    const visibilidade = () => { raiz.dataset.pausado = String(document.hidden); };
    const teclado = (evento?: FocusEvent) => {
      const campo = evento?.type === 'focusout' ? evento.relatedTarget : document.activeElement;
      raiz.dataset.teclado = String(campo instanceof HTMLTextAreaElement || campo instanceof HTMLInputElement);
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
      delete raiz.dataset.pausado;
      delete raiz.dataset.teclado;
    };
  }, []);
  return null;
}
