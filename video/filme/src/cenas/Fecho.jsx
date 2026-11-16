import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho } from '../componentes/Aparelho.jsx';
import { Confete } from '../componentes/Confete.jsx';
import { Logo } from '../componentes/Logo.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Stu, stuVivo } from '../componentes/Stu.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { CURVA, mola, rampa } from '../movimento.js';
import { MOMENTOS } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';

const M = MOMENTOS.fecho;

/** Fecho (6 compassos): a trilha concluída, o lema, o logo e os créditos. */
export function Fecho() {
  const quadro = useCurrentFrame();
  const flutua = Math.sin(quadro / 46) * 8;
  const some = rampa(quadro, M.lema1 - 44, M.lema1 - 4, 0, 1, CURVA.saida);
  const logo = mola(quadro, M.logo, { damping: 10, stiffness: 170, mass: 0.8 });
  const chegou = quadro >= M.logo;
  const pulo = chegou ? Math.max(0, Math.sin(((quadro - M.logo) / 34) * Math.PI)) * (quadro < M.logo + 34 ? 130 : 0) : 0;
  const vivo = stuVivo(quadro, 20);
  const stu = mola(quadro, M.logo + 4, { damping: 11, stiffness: 150 });
  const festa = quadro >= M.trofeu ? Math.exp(-(quadro - M.trofeu) / 10) : 0;
  const lema = rampa(quadro, M.logo + 26, M.logo + 50);
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 1500} regiao="campos" altura={0.24} />
      {some < 1 && (
        <>
          <div style={{ position: 'absolute', left: 130, top: 330 }}>
            <Palavras quadro={quadro} inicio={M.titulo + 36} sai={M.lema1 - 56} linhas={['Do primeiro', 'passo…']} tamanho={96} cores={{ L1: CORES.acao }} />
          </div>
          <div style={{ position: 'absolute', left: 1290, top: 520 }}>
            <Palavras quadro={quadro} inicio={M.titulo + 66} sai={M.lema1 - 52} linhas={['…à trilha', 'concluída.']} tamanho={96} cores={{ L1: CORES.sucessoClaro }} />
          </div>
          <Aparelho cena="fecho" quadro={quadro} x={960} y={560 + flutua + some * 1100} tela={840} escala={1 + festa * 0.03} giro={[4, Math.sin(quadro / 60) * 5, some * 14]} />
        </>
      )}
      <Confete quadro={quadro - M.trofeu} x={960} y={380} pecas={150} forca={1.2} semente={47} />

      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center' }}>
        <Palavras quadro={quadro} inicio={M.lema1} sai={M.logo - 20} linhas={['Aprenda qualquer coisa.']} tamanho={128} alinhar="centro" passo={5} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 452, display: 'flex', justifyContent: 'center' }}>
        <Palavras quadro={quadro} inicio={M.lema2} sai={M.logo - 16} linhas={['Uma lição por vez.']} tamanho={128} cor={CORES.acao} alinhar="centro" passo={5} />
      </div>

      {chegou && (
        <>
          <div style={{ position: 'absolute', left: 400, top: 236, transform: `scale(${stu})`, transformOrigin: '50% 100%' }}>
            <Stu tamanho={300} {...vivo} altura={pulo} aceno={Math.sin(quadro / 7) * 14 - 8} boca={1} />
          </div>
          <div style={{ position: 'absolute', left: 700, top: 262, transform: `scale(${logo})`, transformOrigin: '40% 60%' }}>
            <Logo largura={780} />
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 590, textAlign: 'center', font: `700 56px ${FONTE.titulo}`, letterSpacing: '-0.01em', color: CORES.texto, opacity: lema, transform: `translateY(${(1 - lema) * 30}px)` }}>
            Aprenda qualquer coisa. <span style={{ color: CORES.acao }}>Uma lição por vez.</span>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 706, display: 'flex', justifyContent: 'center' }}>
            <Pilula quadro={quadro} inicio={M.creditos} tamanho={34} fundo={CORES.acao} cor="#fff">Júlio e Miguel · HackBrasil</Pilula>
          </div>
          <Confete quadro={quadro - M.logo} x={960} y={360} pecas={120} forca={1.1} semente={53} />
        </>
      )}
      <Nota centro />
    </AbsoluteFill>
  );
}
