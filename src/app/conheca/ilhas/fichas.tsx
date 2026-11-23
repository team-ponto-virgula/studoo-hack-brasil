'use client';

import { useEffect, useRef } from 'react';
import { Desenho } from '../../../ui/mundo';
import { textos } from '../textos';
import { BotaoVisitante } from './visitante';
import { IDEIAS_DO_S3, iconeDaIdeia } from '../ideias';

/**
 * As seis ideias da tela inicial em fichas (spec 18, S3). Tocar numa ficha começa a sessão de visitante já com aquela ideia no campo.
 * Com movimento permitido, a fileira corre devagar para a esquerda (40 s por volta, linear) e para com o ponteiro em cima, com foco ou
 * com toque; sem movimento, ou sem JavaScript, as fichas ficam em grade, quebrando linha. A lista está UMA vez no código que o
 * leitor de tela lê: o desenho do laço só acrescenta, no navegador, uma cópia escondida (aria-hidden e inerte) para a volta não ter emenda.
 */
export function Fichas({ visitanteAtivo }: { visitanteAtivo: boolean }) {
  const trilho = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const lista = trilho.current;
    if (!lista || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const copia = lista.cloneNode(true) as HTMLUListElement;
    copia.removeAttribute('id');
    copia.setAttribute('aria-hidden', 'true');
    copia.setAttribute('inert', '');
    copia.classList.add('cn-fichas__copia');
    for (const botao of Array.from(copia.querySelectorAll('button, a'))) botao.setAttribute('tabindex', '-1');
    lista.parentElement?.appendChild(copia);
    lista.closest<HTMLElement>('.cn-fichas')?.setAttribute('data-correndo', 'true');
    return () => { copia.remove(); lista.closest<HTMLElement>('.cn-fichas')?.removeAttribute('data-correndo'); };
  }, []);

  return (
    <div className="cn-fichas">
      <div className="cn-fichas__pista">
        <ul ref={trilho} className="cn-fichas__lista" aria-label={textos.s3.lista}>
          {IDEIAS_DO_S3.map((ideia) => (
            <li key={ideia} className="cn-ficha-item">
              <FichaDeIdeia ideia={ideia} ativo={visitanteAtivo} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FichaDeIdeia({ ideia, ativo }: { ideia: (typeof IDEIAS_DO_S3)[number]; ativo: boolean }) {
  return (
    <BotaoVisitante ativo={ativo} variante="secundario" className="cn-ficha" ideia={ideia} rotulo={ideia} icone={<Desenho nome={iconeDaIdeia(ideia)} />} />
  );
}
