'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { mensagens } from '../mensagens/pt-BR';
import { tocaSons } from './sons';
import { BALAO_DO_NO, CABECALHOS_DO_ALTO, cabecalhoDoAlto, lugarDoAviso } from './aviso-musica-regras';
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
      // Se a pessoa toca num nó e o balão abre com o aviso à vista, o aviso fecha na hora, sem animação (spec 16, item 14).
      if (document.querySelector(BALAO_DO_NO)) { mostrar(false); return; }
      const cabecalhos = [...document.querySelectorAll(CABECALHOS_DO_ALTO)].map((cabecalho) => cabecalho.getBoundingClientRect());
      const lugar = lugarDoAviso(cabecalhoDoAlto(cabecalhos, innerHeight), innerWidth);
      el.style.top = lugar.top;
      el.style.left = lugar.left;
      el.style.maxWidth = lugar.maxWidth;
    }
    posicionar();
    const mudanca = new MutationObserver(posicionar);
    mudanca.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', posicionar);
    window.addEventListener('scroll', posicionar, true);
    // Um cabeçalho que ainda se mexe (entrada animada da placa da geração) muda de lugar sem mudar o DOM: o aviso confere de novo quando a animação acaba.
    document.addEventListener('animationend', posicionar, true);
    document.addEventListener('transitionend', posicionar, true);
    return () => {
      mudanca.disconnect();
      window.removeEventListener('resize', posicionar);
      window.removeEventListener('scroll', posicionar, true);
      document.removeEventListener('animationend', posicionar, true);
      document.removeEventListener('transitionend', posicionar, true);
    };
  }, [visivel, caminho]);
  return <div ref={aviso} className="aviso-app aviso-musica" role="status" aria-live="polite">
    {visivel && <p>{mensagens.som.musicaAviso}<button type="button" onFocus={() => manter(true)} onBlur={() => manter(false)}
      onClick={() => void tocaSons.definirFundo('mudo')}>{mensagens.som.desligarMusica}</button></p>}
  </div>;
}
