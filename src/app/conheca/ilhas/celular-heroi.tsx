'use client';

import { useEffect, useRef, useState } from 'react';
import { CapturaDaTela, Celular } from '../celular';
import type { CapturaOtimizada, Plataforma } from '../imagens';

const MS_POR_TELA = 3500;

export interface TelaDoHeroi { captura: CapturaOtimizada; alt: string }

/**
 * O celular do herói (spec 18, 1.4): três capturas nativas em laço, 3,5 s cada; a troca é uma só de sumir e aparecer, em 400 ms, com
 * a nova subindo 12 px (o CSS faz). O laço só roda com o herói na tela, a aba à vista e sem movimento reduzido; com movimento reduzido
 * fica só a proposta pronta, parada (o CSS). A primeira captura carrega já; a segunda e a terceira só entram no código quando o laço
 * começa. O conjunto tem um rótulo só, e a troca nunca é anunciada.
 */
export function CelularDoHeroi({ telas, rotulo, plataforma }: { telas: readonly TelaDoHeroi[]; rotulo: string; plataforma: Plataforma }) {
  const raiz = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [liberadas, setLiberadas] = useState(false);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
    let naTela = false;
    const atualizar = () => setRodando(naTela && !document.hidden && !reduzido.matches);
    const observador = new IntersectionObserver(([entrada]) => { naTela = entrada.isIntersecting; atualizar(); }, { threshold: 0.3 });
    observador.observe(el);
    document.addEventListener('visibilitychange', atualizar);
    reduzido.addEventListener('change', atualizar);
    return () => {
      observador.disconnect();
      document.removeEventListener('visibilitychange', atualizar);
      reduzido.removeEventListener('change', atualizar);
    };
  }, []);

  useEffect(() => {
    if (!rodando) return;
    setLiberadas(true);
    const relogio = window.setInterval(() => setAtiva((atual) => (atual + 1) % telas.length), MS_POR_TELA);
    return () => window.clearInterval(relogio);
  }, [rodando, telas.length]);

  return (
    <div ref={raiz} className="cn-heroi__celular" data-pronto={liberadas || undefined}>
      <Celular rotulo={rotulo} plataforma={plataforma}>
        {telas.map((tela, indice) => (
          <div key={tela.alt} className="cn-tela" data-ativa={indice === ativa || undefined}>
            <CapturaDaTela captura={tela.captura} alt={tela.alt} prioridade={indice === 0} escondida={indice > 0 && !liberadas} />
          </div>
        ))}
      </Celular>
    </div>
  );
}
