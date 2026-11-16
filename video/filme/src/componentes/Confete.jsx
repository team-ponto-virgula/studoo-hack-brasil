import React from 'react';
import { CORES } from '../tema.js';
import { sorte } from '../movimento.js';

const PALETA = [CORES.acao, CORES.ouro, CORES.sucessoClaro, CORES.rosa, '#8da2f2', '#ffffff', CORES.ambar];

/**
 * Explosão de confete a partir de um ponto. Cada peça tem ângulo, força, giro e cor sorteados com semente fixa, e cai
 * com gravidade. `quadro` é o tempo desde o estouro.
 */
export function Confete({ quadro, x = 960, y = 540, pecas = 90, forca = 1, semente = 7, abertura = Math.PI * 2, direcao = -Math.PI / 2, paleta = PALETA, dura = 150 }) {
  if (quadro < 0 || quadro > dura) return null;
  const rnd = sorte(semente);
  const t = quadro / 60;
  const some = quadro > dura - 30 ? (dura - quadro) / 30 : 1;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
      {Array.from({ length: pecas }, (_, i) => {
        const ang = direcao + (rnd() - 0.5) * abertura;
        const vel = (520 + rnd() * 980) * forca;
        const arrasto = 1.6 + rnd() * 1.4;
        const giro0 = rnd() * 360;
        const giroVel = (rnd() - 0.5) * 900;
        const larg = 12 + rnd() * 16;
        const alt = larg * (0.35 + rnd() * 0.55);
        const cor = paleta[Math.floor(rnd() * paleta.length)];
        const redondo = rnd() < 0.22;
        const flip = rnd() * 6;
        // Velocidade que decai com o arrasto do ar, mais a gravidade.
        const k = (1 - Math.exp(-arrasto * t)) / arrasto;
        const px = x + Math.cos(ang) * vel * k;
        const py = y + Math.sin(ang) * vel * k + 620 * t * t;
        return (
          <div key={i} style={{
            position: 'absolute', left: px, top: py, width: larg, height: redondo ? larg : alt, marginLeft: -larg / 2, marginTop: -alt / 2,
            background: cor, borderRadius: redondo ? '50%' : 3, opacity: some,
            transform: `rotate(${giro0 + giroVel * t}deg) scaleY(${Math.cos(flip + t * 9)})`,
          }} />
        );
      })}
    </div>
  );
}
