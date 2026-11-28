'use client';

import { useState } from 'react';
import { Mascote } from '../../../ui/mascote';
import { textos } from '../textos';

const t = textos.material;

/**
 * Parada 1: a anotação de exemplo vira uma lição, e a lição mostra de onde tirou a ideia. A marca [1] da lição é um botão: ao tocar, a frase citada
 * acende na anotação e o cartão da fonte abre, como no app ("Baseado no seu material [1]"). A anotação e a lição são um exemplo pronto desta página
 * (dito na legenda de cada uma); a tela de verdade, com um PDF, fica ao lado. Sem JavaScript, a fonte já vem aberta (o CSS cuida).
 */
export function MaterialVivo() {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="cn-material" data-fonte-aberta={aberta || undefined}>
      <figure className="cn-anotacao" data-revelar>
        <figcaption>{t.anotacao.legenda}</figcaption>
        <blockquote>
          <strong>{t.anotacao.titulo}</strong>
          <p><mark className="cn-marca" id="cn-trecho-1">{t.anotacao.marcada}</mark> {t.anotacao.resto}</p>
        </blockquote>
      </figure>

      <p className="cn-vira" aria-hidden="true">
        <svg viewBox="0 0 120 44" width="120" height="44" fill="none" focusable="false">
          <path d="M4 30C30 6 70 4 108 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 9" />
          <path d="M96 12l13 10-15 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{t.vira}</span>
      </p>

      <article className="cn-licao-exemplo" aria-labelledby="cn-licao-exemplo-titulo" data-revelar>
        <p className="cn-selo">{t.licao.selo}</p>
        <h3 id="cn-licao-exemplo-titulo">{t.licao.titulo}</h3>
        <div className="cn-explica">
          <Mascote expressao="stu-feliz" tamanho={56} className="cn-explica__stu" />
          <div className="cn-explica__balao">
            <p className="cn-explica__quem">{t.licao.quem}</p>
            <p>{t.licao.texto}</p>
            <button type="button" className="cn-citar" aria-expanded={aberta} aria-controls="cn-fonte-1" onClick={() => setAberta(!aberta)}>
              {t.licao.baseado}<span className="cn-citar__numero"><span className="somente-leitor">, fonte </span><span aria-hidden="true">[</span>1<span aria-hidden="true">]</span></span>
            </button>
          </div>
        </div>
        <div className="cn-fonte" id="cn-fonte-1" hidden={!aberta}>
          <p className="cn-fonte__origem"><span className="cn-citar__numero" aria-hidden="true">[1]</span>{t.licao.fonte} · {t.licao.origem}</p>
          <blockquote>“{t.anotacao.marcada}”</blockquote>
        </div>
        <p className="cn-legenda">{t.licao.legenda}</p>
      </article>
    </div>
  );
}
