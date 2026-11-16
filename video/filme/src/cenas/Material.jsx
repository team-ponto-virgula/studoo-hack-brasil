import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho, Recorte } from '../componentes/Aparelho.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { mola, rampa } from '../movimento.js';
import { MOMENTOS } from '../tempos.js';
import { CORES } from '../tema.js';

const M = MOMENTOS.material;

/** O seu material (4 compassos): o material de demonstração vira trilha, e a lição diz de que página veio. */
export function Material() {
  const quadro = useCurrentFrame();
  const flutua = Math.sin(quadro / 46) * 8;
  const carta = mola(quadro, M.cita, { damping: 13, stiffness: 150 });
  const anel = mola(quadro, M.cita + 22, { damping: 10, stiffness: 180, mass: 0.7 });
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 1100} regiao="lago" altura={0.2} />
      <Aparelho cena="material" quadro={quadro} x={1400} y={556 + flutua} tela={850} giro={[5, -15, 2]} cortes={[M.giro]} />

      <div style={{ position: 'absolute', left: 130, top: 190 }}>
        <Palavras quadro={quadro} inicio={M.titulo} sai={M.giro - 18} linhas={['Ou comece pelo', 'seu material.']} tamanho={108} cores={{ L1: CORES.acao }} />
      </div>
      <div style={{ position: 'absolute', left: 134, top: 470, display: 'flex', gap: 16 }}>
        {['Foto', 'PDF', 'DOCX', 'CSV'].map((formato, i) => (
          <Pilula key={formato} quadro={quadro} inicio={M.formatos[i]} sai={M.giro - 24 + i * 2} tamanho={42} cor={CORES.acao}>{formato}</Pilula>
        ))}
      </div>

      <div style={{ position: 'absolute', left: 130, top: 150 }}>
        <Palavras quadro={quadro} inicio={M.giro + 8} linhas={['E a lição cita', 'a página.']} tamanho={108} cores={{ L1: CORES.acao }} />
      </div>
      {quadro >= M.cita && (
        <div style={{ position: 'absolute', left: 130, top: 440, transformOrigin: '0% 0%', transform: `scale(${0.7 + 0.3 * carta}) rotate(${-2 + carta}deg)`, opacity: Math.min(1, carta * 1.5) }}>
          <Recorte nome="material-licao" quadro={380} area={{ x: 12, y: 508, l: 366, a: 250 }} largura={690} borda={CORES.gelo}>
            <div style={{
              position: 'absolute', left: 6, top: 396, width: 330, height: 52, borderRadius: 18, border: `6px solid ${CORES.ouroEscuro}`, boxSizing: 'border-box',
              transform: `scale(${1.5 - 0.5 * anel})`, opacity: Math.min(1, anel * 1.4) * rampa(quadro, M.cita + 20, M.cita + 26),
            }} />
          </Recorte>
        </div>
      )}
      <Nota />
    </AbsoluteFill>
  );
}
