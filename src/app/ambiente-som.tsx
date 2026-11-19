'use client';

import { useEffect, useRef, useState } from 'react';
import { mensagens } from '../mensagens/pt-BR';
import { tocaSons } from './sons';
import '../ui/aviso.css';

const chaveAviso = 'studoo.sons.avisoMusica';

/** O layout conserva a fonte de áudio e o aviso durante a navegação, inclusive ao entrar como visitante. */
export function AmbienteSom() {
  const [visivel, mostrar] = useState(false);
  const [emFoco, manter] = useState(false);
  const jaMostrou = useRef(false);
  useEffect(() => {
    tocaSons.prepararFundo();
    return tocaSons.assinarEstado(estado => {
      if (estado.fundo === 'mudo') { mostrar(false); return; }
      if (estado.estadoFundo !== 'tocando' || jaMostrou.current) return;
      jaMostrou.current = true;
      try {
        if (localStorage.getItem(chaveAviso) === '1') return;
        localStorage.setItem(chaveAviso, '1');
      } catch { /* O aviso continua aparecendo só uma vez nesta sessão. */ }
      mostrar(true);
    });
  }, []);
  useEffect(() => {
    if (!visivel || emFoco) return;
    const relogio = window.setTimeout(() => mostrar(false), 8000);
    return () => window.clearTimeout(relogio);
  }, [visivel, emFoco]);
  return <div className="aviso-app aviso-musica" role="status" aria-live="polite">
    {visivel && <p>{mensagens.som.musicaAviso}<button type="button" onFocus={() => manter(true)} onBlur={() => manter(false)}
      onClick={() => void tocaSons.definirFundo('mudo')}>{mensagens.som.desligarMusica}</button></p>}
  </div>;
}
