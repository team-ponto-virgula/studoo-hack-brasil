import React from 'react';
import { CORES, FONTE, NOTA_DEMO } from '../tema.js';

/** A nota de transparência das cenas com gravação: o app roda no modo demonstração. */
export function Nota({ cor = CORES.texto2, centro = false, style }) {
  return (
    <div style={{
      position: 'absolute', bottom: 30, font: `700 22px ${FONTE.corpo}`, color: cor, opacity: 0.72, whiteSpace: 'nowrap',
      ...(centro ? { left: 0, right: 0, textAlign: 'center' } : { left: 56 }), ...style,
    }}>{NOTA_DEMO}</div>
  );
}
