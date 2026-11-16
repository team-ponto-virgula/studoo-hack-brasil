import React from 'react';
import { CORES, FONTE } from '../tema.js';

/*
 * O logo do Studoo em vetor (560x184): "stud" em Quicksand Bold, os dois "o" como óculos, a ponte e o sorriso.
 * As medidas vêm do PNG da marca. Cada parte tem o seu avanço (0 a 1), para o logo montar na tela.
 */
const TAMANHO = 159.65;
const BASE = 125.6;
const LETRAS = [['s', 11.61], ['t', 88.56], ['u', 153.86], ['d', 247.57]];
const AROS = [400.5, 505.5];
const COMPRIMENTO_SORRISO = 104;

const tudo = { s: 1, t: 1, u: 1, d: 1, o1: 1, o2: 1, ponte: 1, sorriso: 1 };

/**
 * @param {object} p
 * @param {number} [p.largura] largura em px
 * @param {Partial<typeof tudo>} [p.partes] avanço de cada parte (0 a 1; passa de 1 no quique)
 * @param {string} [p.corTexto] cor do "stud"
 * @param {string} [p.corOlhos] cor dos óculos e do sorriso
 */
export function Logo({ largura = 560, partes = tudo, corTexto = CORES.texto, corOlhos = CORES.acao, style }) {
  const p = { ...tudo, ...partes };
  const letra = (chave) => {
    const v = p[chave];
    return { opacity: Math.min(1, Math.max(0, v * 2.4)), transform: `translateY(${(1 - Math.min(v, 1.2)) * 46}px) scale(${0.5 + 0.5 * v})` };
  };
  return (
    <svg width={largura} height={(largura * 184) / 560} viewBox="0 0 560 184" style={{ overflow: 'visible', display: 'block', ...style }}>
      {LETRAS.map(([l, x]) => (
        <text key={l} x={x} y={BASE} fontFamily={FONTE.titulo} fontWeight={700} fontSize={TAMANHO} fill={corTexto}
          style={{ ...letra(l), transformBox: 'fill-box', transformOrigin: '50% 100%' }}>{l}</text>
      ))}
      {AROS.map((cx, i) => {
        const v = p[i === 0 ? 'o1' : 'o2'];
        return (
          <circle key={cx} cx={cx} cy={84} r={34.5} fill="none" stroke={corOlhos} strokeWidth={19}
            style={{ transformBox: 'fill-box', transformOrigin: '50% 50%', transform: `scale(${v})`, opacity: Math.min(1, v * 3) }} />
        );
      })}
      <path d="M 437 70 Q 453 51 469 70" fill="none" stroke={corOlhos} strokeWidth={12.5} strokeLinecap="round"
        strokeDasharray={40} strokeDashoffset={40 * (1 - Math.min(1, p.ponte))} opacity={p.ponte > 0.01 ? 1 : 0} />
      <path d="M 410 148.5 Q 453 186 496 148.5" fill="none" stroke={corOlhos} strokeWidth={14} strokeLinecap="round"
        strokeDasharray={COMPRIMENTO_SORRISO} strokeDashoffset={COMPRIMENTO_SORRISO * (1 - Math.min(1, p.sorriso))} opacity={p.sorriso > 0.01 ? 1 : 0} />
    </svg>
  );
}
