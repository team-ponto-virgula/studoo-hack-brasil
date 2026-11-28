'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { STU_DA_PAGINA, type NomeDoStuDaPagina } from '../stu.gerado';
import { textos } from '../textos';

const t = textos.ensinar;
const ESPERA_OUVINDO_MS = 900;

export type FaseDoEnsino = 'vazio' | 'ouvindo' | 'retorno';

/** A expressão do Stu em cada fase, como no "Ensine ao Stu" do app: curioso de aluno, concentrado ouvindo, animado ou dando força no retorno. */
export function stuDoEnsino(fase: FaseDoEnsino, temOQueRevisar: boolean): NomeDoStuDaPagina {
  if (fase === 'vazio') return 'stu-curioso';
  if (fase === 'ouvindo') return 'stu-concentrado';
  return temOQueRevisar ? 'stu-encorajador' : 'stu-animado';
}

const EXPRESSOES = ['stu-curioso', 'stu-concentrado', 'stu-animado', 'stu-encorajador'] as const satisfies readonly NomeDoStuDaPagina[];

/**
 * Parada 3: explicar com as próprias palavras. A pessoa escolhe uma de duas explicações de exemplo e vê o retorno do Stu para cada uma, com os mesmos
 * dois blocos do app ("O que fez sentido" e "O que revisar"). É um retorno pronto, dito ali mesmo: no app, o Stu responde ao que a pessoa escrever.
 * A escolha é um grupo de rádio nativo (toque e setas). Com movimento reduzido, o retorno aparece sem a pausa do "ouvindo".
 */
export function EnsinarVivo({ fala }: { /** O que o Stu diz antes de ouvir: fica junto dele. */ fala?: ReactNode }) {
  const [indice, setIndice] = useState<number | null>(null);
  const [fase, setFase] = useState<FaseDoEnsino>('vazio');
  const relogio = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  function escolher(novo: number) {
    window.clearTimeout(relogio.current);
    setIndice(novo);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setFase('retorno'); return; }
    setFase('ouvindo');
    relogio.current = window.setTimeout(() => setFase('retorno'), ESPERA_OUVINDO_MS);
  }

  const explicacao = indice === null ? null : t.explicacoes[indice];
  // "Nenhuma ideia importante ficou de fora" é o retorno sem o que revisar: só a segunda explicação pede revisão.
  const stu = stuDoEnsino(fase, indice === 1);

  return (
    <div className="cn-ensinar" data-fase={fase}>
      <div className="cn-ensinar__aluno">
        {fala}
        <div className="cn-ensinar__stu" aria-hidden="true">
        {EXPRESSOES.map((nome) => {
          const imagem = STU_DA_PAGINA[nome];
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={nome} data-visivel={nome === stu || undefined} src={imagem.fontes[0].src} srcSet={imagem.fontes.map((fonte) => `${fonte.src} ${fonte.largura}w`).join(', ')}
              sizes="(min-width: 900px) 200px, 120px" width={imagem.largura} height={imagem.altura} alt="" loading="lazy" decoding="async" draggable={false} />
          );
        })}
        </div>
      </div>

      <div className="cn-caderno-stu" data-revelar>
        <fieldset className="cn-explicacoes">
          <legend>{t.legenda}</legend>
          <div className="cn-explicacoes__lista">
            {t.explicacoes.map((opcao, i) => (
              <label key={opcao.rotulo} className="cn-explicacao">
                <input type="radio" name="cn-explicacao" value={i} checked={indice === i} onChange={() => escolher(i)} />
                <span className="cn-explicacao__cartao">
                  <span className="cn-explicacao__rotulo">{opcao.rotulo}</span>
                  <span className="cn-explicacao__texto">“{opcao.texto}”</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="cn-retorno-stu" role="status" aria-atomic="true">
          {fase === 'vazio' && <p className="cn-retorno-stu__espera">{t.vazio}</p>}
          {fase === 'ouvindo' && <p className="cn-retorno-stu__espera">{t.ouvindo}</p>}
          {fase === 'retorno' && explicacao && (
            <>
              <div className="cn-retorno-stu__bloco" data-tipo="sentido">
                <p className="cn-retorno-stu__titulo">{t.fezSentido}</p>
                <ul>{explicacao.fezSentido.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="cn-retorno-stu__bloco" data-tipo="revisar">
                <p className="cn-retorno-stu__titulo">{t.revisar}</p>
                <ul>{explicacao.revisar.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </>
          )}
        </div>
        <p className="cn-legenda">{t.aviso}</p>
      </div>
    </div>
  );
}
