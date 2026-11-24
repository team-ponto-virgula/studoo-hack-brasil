'use client';

import { useRef, useState } from 'react';

const respostas = [
  { fracao: '3/5', nome: 'três quintos', pista: 'O número de baixo conta o retângulo inteiro. Inclua as partes pintadas e as partes em branco.' },
  { fracao: '3/8', nome: 'três oitavos', pista: 'Três das oito partes iguais estão pintadas. Essa parte do retângulo é três oitavos.' },
  { fracao: '5/8', nome: 'cinco oitavos', pista: 'Você encontrou a parte em branco. Para achar a parte pintada, conte só os pedaços com listras.' },
] as const;
type Resposta = (typeof respostas)[number];

/** Uma questão pronta da apresentação. A resposta e as pistas ficam apenas nesta página. */
export function LicaoDeExemplo() {
  const [escolhida, escolher] = useState<Resposta | null>(null);
  const primeira = useRef<HTMLButtonElement>(null);
  const acertou = escolhida?.fracao === '3/8';
  const resultado = escolhida ? (acertou ? 'acerto' : 'pista') : undefined;

  return (
    <section id="licao-de-exemplo" className="cn-licao" aria-labelledby="cn-titulo-licao">
      <div className="cn-secao cn-licao__miolo">
        <div className="cn-licao__origem">
          <h2 className="cn-secao__titulo" id="cn-titulo-licao">Resolva uma com o Stu.</h2>
          <figure className="cn-anotacao">
            <figcaption>Anotação de exemplo</figcaption>
            <blockquote>
              <strong>Frações</strong>
              <p>O número de baixo conta todas as partes iguais. O de cima conta as partes que escolhemos.</p>
            </blockquote>
          </figure>
        </div>
        <div className="cn-questao">
          <h3 id="cn-pergunta">Que fração do retângulo está pintada?</h3>
          <div className="cn-fracao" role="img" aria-label="Retângulo dividido em oito partes iguais. Três estão pintadas com listras.">
            {Array.from({ length: 8 }, (_, i) => <span key={i} data-pintada={i < 3 || undefined} />)}
          </div>
          <div className="cn-respostas" role="group" aria-labelledby="cn-pergunta">
            {respostas.map((opcao, i) => (
              <button key={opcao.fracao} ref={i === 0 ? primeira : undefined} type="button"
                aria-label={`${opcao.fracao}, ${opcao.nome}`} aria-pressed={escolhida === opcao} aria-disabled={acertou || undefined}
                data-resultado={escolhida === opcao ? resultado : undefined}
                onClick={() => { if (!acertou) escolher(opcao); }}>{opcao.fracao}</button>
            ))}
          </div>
          <p className="cn-retorno" role="status" aria-atomic="true" data-resultado={resultado}>
            {escolhida ? <><strong>{acertou ? 'Acertou! ' : 'Uma pista do Stu. '}</strong>{escolhida.pista}</> : 'Escolha uma resposta.'}
          </p>
          {acertou && (
            <div className="cn-questao__fim">
              <a href="#assuntos">Escolher meu assunto <span aria-hidden="true">↓</span></a>
              <button type="button" onClick={() => { escolher(null); primeira.current?.focus(); }}>Refazer</button>
            </div>
          )}
          <noscript><details><summary>Ver a resposta</summary>Três das oito partes estão pintadas. A resposta é 3/8.</details></noscript>
        </div>
      </div>
    </section>
  );
}
