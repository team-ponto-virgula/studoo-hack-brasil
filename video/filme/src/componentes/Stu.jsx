import React from 'react';
import { CORES } from '../tema.js';

/*
 * O Stu em vetor, redesenhado em cima do PNG da marca (800x880; a diferença para o original fica abaixo de 2%).
 * Cada parte é separada para animar: braços, antena, olhos (piscar e olhar), boca e o corpo inteiro (achatar e esticar).
 */
const AZUL = CORES.acao;
const MARINHO = CORES.texto;
const OLHOS = [279.5, 519.5];

/**
 * @param {object} p
 * @param {number} [p.tamanho] altura em px
 * @param {number} [p.piscar] 0 (aberto) a 1 (fechado)
 * @param {[number, number]} [p.olhar] deslocamento das pupilas em px do desenho (até uns 24)
 * @param {number} [p.aceno] giro do braço direito, em graus (0 é a pose do aceno; positivo desce o braço)
 * @param {number} [p.bracoEsq] giro do braço esquerdo, em graus (negativo levanta)
 * @param {number} [p.boca] 0 (sorriso fechado) a 1 (sorriso aberto)
 * @param {number} [p.squash] escala vertical do corpo (1 normal; 0.9 achata, 1.1 estica), com o volume preservado
 * @param {number} [p.inclina] giro do corpo inteiro, em graus, com o pivô nos pés
 * @param {number} [p.antena] giro da antena, em graus
 * @param {boolean} [p.sombra] sombra no chão
 * @param {number} [p.altura] altura do pulo, em px do desenho (a sombra encolhe)
 */
export function Stu({ tamanho = 400, piscar = 0, olhar = [0, 0], aceno = 0, bracoEsq = 0, boca = 0, squash = 1, inclina = 0, antena = 0, sombra = true, altura = 0, style }) {
  const sx = 1 / Math.sqrt(Math.max(0.2, squash));
  const aberto = Math.max(0.06, 1 - piscar);
  const [ox, oy] = olhar;
  const sombraEscala = 1 - Math.min(0.5, altura / 500);
  return (
    <svg width={(tamanho * 800) / 880} height={tamanho} viewBox="0 0 800 880" style={{ overflow: 'visible', display: 'block', ...style }}>
      <defs>
        {OLHOS.map((cx, i) => <clipPath key={i} id={`stu-olho-${i}`}><circle cx={cx} cy={399.5} r={86} /></clipPath>)}
      </defs>
      {sombra && <ellipse cx={400} cy={852} rx={236 * sombraEscala} ry={20 * sombraEscala} fill={MARINHO} opacity={0.13 * sombraEscala} />}
      <g transform={`translate(0 ${-altura}) translate(400 848) rotate(${inclina}) scale(${sx} ${squash}) translate(-400 -848)`}>
        <ellipse cx={303.5} cy={817} rx={68} ry={30.5} fill={MARINHO} />
        <ellipse cx={495.5} cy={817} rx={68} ry={30.5} fill={MARINHO} />
        <g transform={`rotate(${bracoEsq} 128 482)`}>
          <path d="M 132 486 C 98 512 68 560 70 610 C 71 630 75 645 79.5 655" stroke={AZUL} strokeWidth={64} strokeLinecap="round" fill="none" />
        </g>
        <g transform={`rotate(${aceno} 684 420)`}>
          <path d="M 684 420 C 724 390 752 330 748.5 270 C 747.5 250 745 232 743.5 218" stroke={AZUL} strokeWidth={64} strokeLinecap="round" fill="none" />
        </g>
        <g transform={`rotate(${antena} 400 100)`}>
          <path d="M 400 104 C 400 80 399 40 441 33.5 C 463 30 478 38 479.5 50" stroke={AZUL} strokeWidth={38} strokeLinecap="round" fill="none" />
        </g>
        <path d="M 399.5 79.6 C 600 79.6 719 242 719 468 C 719 646 609 806.5 399.5 806.5 C 190 806.5 80 646 80 468 C 80 242 199 79.6 399.5 79.6 Z" fill={AZUL} />
        <ellipse cx={271.5} cy={199.5} rx={77} ry={41} transform="rotate(-21 271.5 199.5)" fill={CORES.acaoClara} />
        <ellipse cx={167.5} cy={559.5} rx={44} ry={26} fill={CORES.bochecha} />
        <ellipse cx={631.5} cy={559.5} rx={44} ry={26} fill={CORES.bochecha} />
        <path d="M 382 357 Q 399.5 353 417 357" stroke={MARINHO} strokeWidth={23} fill="none" />
        {OLHOS.map((cx, i) => (
          <g key={i}>
            <circle cx={cx} cy={399.5} r={99.75} fill={AZUL} stroke={MARINHO} strokeWidth={27.5} />
            <g transform={`translate(${cx} 399.5) scale(1 ${aberto}) translate(${-cx} -399.5)`} clipPath={`url(#stu-olho-${i})`}>
              <circle cx={cx} cy={399.5} r={86} fill="#fff" />
              <circle cx={cx + 12 + ox} cy={395.5 + oy} r={36} fill={MARINHO} />
              <circle cx={cx + 24 + ox} cy={379.5 + oy} r={10} fill="#fff" />
            </g>
            {piscar > 0.6 && <path d={`M ${cx - 70} 399.5 Q ${cx} ${399.5 + 26} ${cx + 70} 399.5`} stroke={MARINHO} strokeWidth={13} strokeLinecap="round" fill="none" opacity={(piscar - 0.6) / 0.4} />}
          </g>
        ))}
        <path d="M 311 583 Q 399.5 671 488 583" stroke="#fff" strokeWidth={34} strokeLinecap="round" fill="none" opacity={1 - Math.min(1, boca * 1.6)} />
        {boca > 0.02 && (
          <path d={`M 296 574 Q 399.5 ${596 - 10 * boca} 503 574 Q ${474} ${640 + 46 * boca} 399.5 ${642 + 48 * boca} Q ${325} ${640 + 46 * boca} 296 574 Z`}
            fill="#fff" stroke="#fff" strokeWidth={12} strokeLinejoin="round" opacity={Math.min(1, boca * 1.6)} />
        )}
      </g>
    </svg>
  );
}

/** Vida do Stu parado: pisca de tempos em tempos, respira e balança a antena. `fase` desloca o ritmo de cada Stu. */
export function stuVivo(quadro, fase = 0) {
  const f = quadro + fase;
  const ciclo = ((f % 168) + 168) % 168;
  const piscar = ciclo < 5 ? ciclo / 5 : ciclo < 12 ? 1 - (ciclo - 5) / 7 : 0;
  return {
    piscar,
    squash: 1 + 0.012 * Math.sin((f / 84) * Math.PI * 2),
    antena: 4 * Math.sin((f / 66) * Math.PI * 2),
  };
}
