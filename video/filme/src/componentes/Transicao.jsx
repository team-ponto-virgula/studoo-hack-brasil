import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { CURVA, rampa } from '../movimento.js';
import { CORES } from '../tema.js';

const DURA = 24;
const VAO = 5;
const INCLINA = 300;

/** A área já varrida por uma borda diagonal que cruza a tela (p de 0 a 1). `sentido` 1 vai para a direita; -1, para a esquerda. */
function varrido(p, sentido) {
  if (sentido > 0) {
    const x = -INCLINA + p * (1920 + 2 * INCLINA);
    return `polygon(-20px -20px, ${x + INCLINA / 2}px -20px, ${x - INCLINA / 2}px 1100px, -20px 1100px)`;
  }
  const x = 1920 + INCLINA - p * (1920 + 2 * INCLINA);
  return `polygon(${x + INCLINA / 2}px -20px, 1940px -20px, 1940px 1100px, ${x - INCLINA / 2}px 1100px)`;
}

/** Cortina de faixas diagonais: a cena entra atrás de duas faixas de cor que varrem a tela. */
export function Cortina({ cores = [CORES.acao, CORES.ouro], sentido = 1, children }) {
  const quadro = useCurrentFrame();
  if (quadro >= 2 * VAO + DURA) return <AbsoluteFill>{children}</AbsoluteFill>;
  const borda = (k) => rampa(quadro, k * VAO, k * VAO + DURA, 0, 1, CURVA.camera);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: cores[0], clipPath: varrido(borda(0), sentido) }} />
      <AbsoluteFill style={{ background: cores[1], clipPath: varrido(borda(1), sentido) }} />
      <AbsoluteFill style={{ clipPath: varrido(borda(2), sentido) }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Íris: a cena entra por um círculo que cresce a partir de um ponto, com um aro de cor na borda. */
export function Iris({ x = 960, y = 540, cor = CORES.ouro, dura = 30, children }) {
  const quadro = useCurrentFrame();
  if (quadro >= dura) return <AbsoluteFill>{children}</AbsoluteFill>;
  const alcance = Math.hypot(Math.max(x, 1920 - x), Math.max(y, 1080 - y)) + 60;
  const raio = rampa(quadro, 0, dura, 0, alcance, CURVA.camera);
  const aro = 26 * (1 - rampa(quadro, dura * 0.5, dura));
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: x - raio - aro, top: y - raio - aro, width: (raio + aro) * 2, height: (raio + aro) * 2, borderRadius: '50%', background: cor }} />
      <AbsoluteFill style={{ clipPath: `circle(${raio}px at ${x}px ${y}px)` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}
