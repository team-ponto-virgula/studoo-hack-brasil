'use client';

import { useEffect, useRef, useState } from 'react';
import { ESPERA_VIVA, estadoDaEsperaViva, faltaParaMudarAEspera, type MotivoDaEspera } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';
import { Stu } from './componentes';

/*
 * A espera viva da web (contrato `espera-viva.ts`). Enquanto o Stu trabalha, aparece (depois de 400 ms) o Stu concentrado
 * com a frase do que ele está fazendo, que avança a cada 3,5 s e para na última; depois de 15 s, a linha avisa que está
 * levando mais que o normal. Uma barra fina corre embaixo, sem prometer quanto falta. O leitor de tela ouve a primeira
 * frase uma vez (`role="status"`); as trocas seguintes ficam só na tela. Com movimento reduzido, o Stu fica parado, a
 * barra para e a frase troca sem efeito (globals.css, a regra geral de movimento reduzido).
 */

const reduzido = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export function EsperaViva({ motivo, compacta = false }: { motivo: MotivoDaEspera; compacta?: boolean }) {
  const frases = mensagens.esperaViva[motivo];
  const [inicio] = useState(() => Date.now());
  const [estado, setEstado] = useState<number | 'demorada' | null>(null);
  const [saindo, setSaindo] = useState(false);
  const mostrado = useRef<number | 'demorada' | null>(null);

  useEffect(() => {
    let relogio = 0;
    let efeito = 0;
    let vivo = true;
    const metade = Math.round(ESPERA_VIVA.efeitoMs / 2);
    const agendar = () => {
      const falta = faltaParaMudarAEspera(Date.now() - inicio, frases.length);
      if (falta === null) return;
      relogio = window.setTimeout(() => {
        if (!vivo) return;
        const proximo = estadoDaEsperaViva(Date.now() - inicio, frases.length);
        const atual = mostrado.current;
        if (proximo !== atual) {
          mostrado.current = proximo;
          if (atual === null || reduzido()) setEstado(proximo);
          else {
            // A frase some (150 ms) e a seguinte aparece (150 ms).
            setSaindo(true);
            window.clearTimeout(efeito);
            efeito = window.setTimeout(() => { if (vivo) { setSaindo(false); setEstado(proximo); } }, metade);
          }
        }
        agendar();
      }, falta + 5);
    };
    agendar();
    return () => {
      vivo = false;
      window.clearTimeout(relogio);
      window.clearTimeout(efeito);
    };
  }, [inicio, frases.length]);

  const frase = estado === null ? '' : estado === 'demorada' ? mensagens.esperaViva.demorada : frases[estado];
  return <>
    {/* A região viva existe desde o começo: a primeira frase entra nela quando a espera aparece, e é anunciada uma vez. */}
    <p className="somente-leitor" role="status">{estado === null ? '' : frases[0]}</p>
    {estado !== null && (
      <div className="espera-viva" data-compacta={compacta || undefined} data-demorada={estado === 'demorada' || undefined} aria-hidden="true">
        <span className="espera-viva__stu">
          {compacta ? <Stu expressao="stu-concentrado" tamanho={48} animado="laco" /> : <Stu expressao="stu-concentrado" tamanho={72} animado="laco" />}
        </span>
        <span className="espera-viva__corpo">
          <span className="espera-viva__frase" data-saindo={saindo || undefined}>{frase}</span>
          <span className="espera-viva__barra"><span /></span>
        </span>
      </div>
    )}
  </>;
}
