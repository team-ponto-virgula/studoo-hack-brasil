'use client';

import { useLayoutEffect } from 'react';
import { tocaSons } from '../../sons';

/** Pausa também uma faixa que já vinha tocando em outra tela do Studoo. */
export function SemMusica() {
  useLayoutEffect(() => {
    tocaSons.definirAreaPermitida(false);
    return () => tocaSons.definirAreaPermitida(true);
  }, []);
  return null;
}
