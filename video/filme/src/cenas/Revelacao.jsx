import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Confete } from '../componentes/Confete.jsx';
import { Logo } from '../componentes/Logo.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Stu, stuVivo } from '../componentes/Stu.jsx';
import { Palavras } from '../componentes/Texto.jsx';
import { mola, rampa } from '../movimento.js';
import { MOMENTOS } from '../tempos.js';
import { CORES } from '../tema.js';

const M = MOMENTOS.revelacao;

/** Revelação (4 compassos): o mundo claro abre, o Stu pousa, o logo monta e vem o lema. */
export function Revelacao() {
  const quadro = useCurrentFrame();
  // O Stu cai, amassa no pouso e estica de volta.
  const queda = Math.min(1, Math.max(0, quadro / M.pouso));
  const altura = (1 - queda * queda) * 1500;
  const amassa = quadro < M.pouso ? 1.12 : 1 - 0.3 * Math.exp(-(quadro - M.pouso) / 5) * Math.cos((quadro - M.pouso) / 3.2);
  const pulo = quadro >= M.pronto ? Math.max(0, Math.sin(((quadro - M.pronto) / 30) * Math.PI)) * (quadro < M.pronto + 30 ? 150 : 0) : 0;
  const acena = quadro > M.pouso + 14 && quadro < M.pronto ? Math.sin((quadro - M.pouso) / 6) * 16 - 8 : quadro >= M.pronto ? -24 : 12;
  const vivo = stuVivo(quadro, 40);
  const letra = (i) => mola(quadro, M.letras[i], { damping: 9, stiffness: 190, mass: 0.6 });
  const partes = {
    s: letra(0), t: letra(1), u: letra(2), d: letra(3), o1: letra(4), o2: letra(5),
    ponte: rampa(quadro, M.letras[5] + 6, M.sorriso), sorriso: rampa(quadro, M.sorriso, M.pronto - 4),
  };
  const batida = 1 + 0.045 * Math.exp(-Math.max(0, quadro - M.pronto) / 9) * (quadro >= M.pronto ? 1 : 0);
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro} regiao="campos" altura={0.26} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', transform: `scale(${batida})` }}>
        <Logo largura={860} partes={partes} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 436, display: 'flex', justifyContent: 'center' }}>
        <Palavras quadro={quadro} inicio={M.lema1} linhas={['Aprenda qualquer coisa.']} tamanho={88} alinhar="centro" passo={4} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 540, display: 'flex', justifyContent: 'center' }}>
        <Palavras quadro={quadro} inicio={M.lema2} linhas={['Uma lição por vez.']} tamanho={88} cor={CORES.acao} alinhar="centro" passo={4} />
      </div>
      <div style={{ position: 'absolute', left: 960 - 140, top: 686 }}>
        <Stu tamanho={310} {...vivo} squash={amassa * vivo.squash} altura={altura + pulo} aceno={acena} boca={quadro >= M.pronto ? 1 : 0.2} olhar={[0, quadro < M.pronto ? -14 : 0]} />
      </div>
      <Confete quadro={quadro - M.pronto} x={960} y={300} pecas={110} forca={1.05} semente={5} />
    </AbsoluteFill>
  );
}
