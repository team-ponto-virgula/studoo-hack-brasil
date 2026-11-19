'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { mensagens } from '../mensagens/pt-BR';
import { tocaSons } from './sons';
import '../ui/aviso.css';

const chaveAviso = 'studoo.sons.avisoMusica';

/** O layout conserva a fonte de áudio e o aviso durante a navegação, inclusive ao entrar como visitante. */
export function AmbienteSom() {
  const [visivel, mostrar] = useState(false);
  const [emFoco, manter] = useState(false);
  const caminho = usePathname();
  const aviso = useRef<HTMLDivElement>(null);
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
    const relogio = window.setTimeout(() => mostrar(false), 7000);
    return () => window.clearTimeout(relogio);
  }, [visivel, emFoco]);
  useLayoutEffect(() => {
    if (!visivel) return;
    function posicionar() {
      const el = aviso.current;
      if (!el) return;
      const barra = document.querySelector('.som-marca, .recuperar-topo')?.getBoundingClientRect();
      const ilha = document.querySelector('.navegacao-mobile')?.getBoundingClientRect();
      el.style.top = barra ? Math.max(8, barra.bottom + 8) + 'px' : '';
      el.style.left = barra ? barra.left + barra.width / 2 + 'px' : '';
      el.style.bottom = barra ? 'auto' : ilha?.height ? innerHeight - ilha.top + 16 + 'px' : '';
      el.style.maxWidth = barra ? Math.min(innerWidth - 32, barra.width) + 'px' : '';
    }
    posicionar();
    const mudanca = new MutationObserver(posicionar);
    mudanca.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    return () => {
      mudanca.disconnect();
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
    };
  }, [visivel, caminho]);
  return <div ref={aviso} className="aviso-app aviso-musica" role="status" aria-live="polite">
    {visivel && <p>{mensagens.som.musicaAviso}<button type="button" onFocus={() => manter(true)} onBlur={() => manter(false)}
      onClick={() => void tocaSons.definirFundo('mudo')}>{mensagens.som.desligarMusica}</button></p>}
  </div>;
}
