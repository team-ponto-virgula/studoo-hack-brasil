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
      // Ao sair do campo com um toque, a barra de abas só volta depois do toque terminar: voltando na hora, ela empurrava
      // o botão tocado (o "Salvar" ou o "Cancelar" no pé da tela) e o clique caía em outro lugar. Vale também para o
      // `focusin` do botão tocado, que chega logo depois do `focusout` do campo: antes ele cancelava a espera e a barra
      // voltava na hora (no celular, o "Salvar" do perfil subia 73 px e o erro de campo nunca aparecia na barra).
      if (evento) adiado = window.setTimeout(() => { raiz.dataset.teclado = 'false'; }, 350);
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
