import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho, Notebook } from '../componentes/Aparelho.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Palavras } from '../componentes/Texto.jsx';
import { molaFirme } from '../movimento.js';
import { MOMENTOS, trechoAtivo } from '../tempos.js';
import { CORES } from '../tema.js';

const M = MOMENTOS.webApp;

/** Na web e no app (2 compassos): o site no computador e o app no celular, na mesma lição. */
export function WebApp() {
  const quadro = useCurrentFrame();
  const entra = molaFirme(quadro, M.entra + 4, { damping: 19, stiffness: 120 });
  const flutua = Math.sin(quadro / 40) * 6;
  const web = trechoAtivo('webApp', quadro);
  const batida = quadro >= M.mesmo ? 0.03 * Math.exp(-(quadro - M.mesmo) / 9) : 0;
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 1300} regiao="campos" altura={0.16} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 44, display: 'flex', justifyContent: 'center' }}>
        <Palavras quadro={quadro} inicio={M.titulo} linhas={['Na web e no app.']} tamanho={100} alinhar="centro" passo={4} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 158, display: 'flex', justifyContent: 'center' }}>
        <Palavras quadro={quadro} inicio={M.mesmo} linhas={['O mesmo progresso.']} tamanho={100} cor={CORES.acao} alinhar="centro" passo={4} />
      </div>
      <div style={{ position: 'absolute', left: 130 - (1 - entra) * 1200, top: 322 - flutua, perspective: 2800 }}>
        <div style={{ transform: `rotateY(9deg) rotateX(3deg) scale(${1 + batida})`, transformOrigin: '50% 50%' }}>
          <Notebook nome="desktop" quadro={web.q} largura={980} />
        </div>
      </div>
      <Aparelho cena="webAppCelular" quadro={quadro} x={1540 + (1 - entra) * 900} y={664 + flutua} tela={640} escala={1 + batida} giro={[4, -15, 2]} />
      <Nota />
    </AbsoluteFill>
  );
}
