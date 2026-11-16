import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho } from '../componentes/Aparelho.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { CURVA, mola, rampa } from '../movimento.js';
import { MOMENTOS } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';

const M = MOMENTOS.licao;
const PASSOS = [[M.explica, 'O Stu explica.'], [M.mostra, 'Mostra como é.'], [M.ouve, 'E você ouve.']];

/** As seis cordas: paradas até o toque, depois vibram uma depois da outra (como a batida) e vão parando. */
function Cordas({ quadro, largura = 800 }) {
  const aparece = rampa(quadro, M.mostra + 30, M.mostra + 60);
  return (
    <svg width={largura} height={230} style={{ overflow: 'visible', opacity: aparece }}>
      {[0, 1, 2, 3, 4, 5].map((k) => {
        const tempo = quadro - M.ouve - k * 1.5;
        const forca = tempo >= 0 ? Math.exp(-tempo / (95 - k * 9)) * (k === 0 ? 0 : 1) : 0;
        const y = 16 + k * 38;
        const amplitude = forca * (24 - k * 2);
        const fase = Math.sin(tempo * (1.25 + k * 0.33));
        const meio = y + amplitude * fase;
        const quarto = amplitude * 0.5 * Math.sin(tempo * (2.3 + k * 0.5));
        return (
          <path key={k} d={`M 0 ${y} C ${largura * 0.25} ${meio + quarto}, ${largura * 0.75} ${meio - quarto}, ${largura} ${y}`} fill="none"
            stroke={k === 0 ? 'rgba(27,42,94,0.25)' : forca > 0.04 ? CORES.acao : CORES.texto} strokeWidth={7 - k * 0.8} strokeLinecap="round" opacity={k === 0 ? 1 : 0.55 + 0.45 * Math.min(1, forca * 3)} />
        );
      })}
    </svg>
  );
}

/** A lição (6 compassos): o mapa, o toque na lição, o Stu explica, o acorde aparece e o som toca (o som é o do app). */
export function Licao() {
  const quadro = useCurrentFrame();
  const flutua = Math.sin(quadro / 46) * 8;
  const perto = rampa(quadro, M.mostra - 24, M.mostra + 36, 0, 1, CURVA.camera);
  const toque = quadro >= M.ouve ? Math.exp(-(quadro - M.ouve) / 9) : 0;
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 300} regiao="floresta" altura={0.2} />
      {[0, 1, 2].map((i) => {
        const p = rampa(quadro, M.ouve + i * 16, M.ouve + 90 + i * 16, 0, 1, CURVA.suave);
        if (p <= 0 || p >= 1) return null;
        return <div key={i} style={{ position: 'absolute', left: 540 - 300 - p * 330, top: 556 - 300 - p * 330, width: 600 + p * 660, height: 600 + p * 660, borderRadius: '50%', border: `10px solid ${CORES.acao}`, opacity: 0.4 * (1 - p) }} />;
      })}
      <Aparelho cena="licao" quadro={quadro} x={540 + perto * 16} y={556 + flutua} tela={850} escala={1 + perto * 0.035 + toque * 0.02}
        giro={[5 - perto * 2, 15 - perto * 6, -2 + perto]} cortes={[M.giro]} />

      <div style={{ position: 'absolute', left: 990, top: 196 }}>
        <Palavras quadro={quadro} inicio={M.titulo1} sai={M.explica - 34} linhas={['Uma lição', 'de cada vez.']} tamanho={118} cores={{ L1: CORES.acao }} />
      </div>
      <div style={{ position: 'absolute', left: 990, top: 150 }}>
        <Pilula quadro={quadro} inicio={M.explica - 8} tamanho={26} cor={CORES.acao} style={{ letterSpacing: '0.16em' }}>EM CADA LIÇÃO</Pilula>
      </div>
      {PASSOS.map(([de, texto], i) => {
        const e = mola(quadro, de, { damping: 14, stiffness: 150, mass: 0.8 });
        const proximo = i + 1 < PASSOS.length ? PASSOS[i + 1][0] : Infinity;
        const apaga = rampa(quadro, proximo - 6, proximo + 14);
        return (
          <div key={texto} style={{
            position: 'absolute', left: 990, top: 240 + i * 128, display: 'flex', alignItems: 'center', gap: 26, transformOrigin: '0% 50%',
            transform: `translateX(${(1 - e) * 120}px) scale(${1 - 0.14 * apaga})`, opacity: Math.min(1, e * 1.6) * (1 - 0.5 * apaga),
          }}>
            <span style={{
              width: 78, height: 78, borderRadius: '50%', background: apaga > 0.5 ? CORES.sucessoClaro : CORES.acao, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: `700 44px ${FONTE.titulo}`, boxShadow: '0 8px 0 rgba(27,42,94,0.14)', flexShrink: 0,
            }}>{apaga > 0.5 ? <svg width={40} height={40} viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7.5" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /></svg> : i + 1}</span>
            <span style={{ font: `700 88px ${FONTE.titulo}`, letterSpacing: '-0.02em', color: apaga > 0.5 ? CORES.texto : CORES.acao, whiteSpace: 'nowrap' }}>{texto}</span>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 990, top: 664 }}>
        <Cordas quadro={quadro} />
      </div>
      <div style={{ position: 'absolute', left: 990, top: 900 }}>
        <Pilula quadro={quadro} inicio={M.ouve + 4} tamanho={30} fundo={CORES.acao} cor="#fff">Som do acorde Lá menor, tocado pelo app</Pilula>
      </div>
      <Nota />
    </AbsoluteFill>
  );
}
