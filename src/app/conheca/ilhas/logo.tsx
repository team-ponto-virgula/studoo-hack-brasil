'use client';

import { useEffect, useState } from 'react';

/**
 * O logo do cabeçalho (spec 18, seção 4): o `logo-animado.svg` "acorda" uma vez ao abrir a página (um ciclo de 3 s) e então fica
 * parado, igual ao logo estático (mesmo tamanho: nada pula). Com movimento reduzido, é o logo parado desde o começo.
 */
export function LogoDaPagina() {
  const [parado, setParado] = useState(false);
  useEffect(() => {
    const relogio = window.setTimeout(() => setParado(true), 3200);
    return () => window.clearTimeout(relogio);
  }, []);
  return (
    <picture className="logo-quadro cn-logo">
      <source media="(prefers-reduced-motion: reduce)" srcSet="/marca/logo-com-sorriso.svg" />
      <img src={parado ? '/marca/logo-com-sorriso.svg' : '/marca/logo-animado.svg'} width={140} height={46} alt="Studoo" />
    </picture>
  );
}
