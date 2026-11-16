import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho, Recorte } from '../componentes/Aparelho.jsx';
import { Confete } from '../componentes/Confete.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { janela, mola } from '../movimento.js';
import { MOMENTOS, trechoAtivo } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';

const M = MOMENTOS.pratica;

/** A prática (6 compassos): cronômetro, a batida do app para tocar junto (em tempo real, com o som do app) e "como foi". */
export function Pratica() {
  const quadro = useCurrentFrame();
  const flutua = Math.sin(quadro / 46) * 8;
  const ativo = trechoAtivo('pratica', quadro);
  const tocando = quadro >= M.batida && quadro < M.comoFoi;
  // O app marca um tempo a cada 50 quadros (72 BPM): desce no tempo, sobe no meio.
  const noTempo = tocando ? (quadro - M.batida) % 25 : 99;
  const pulso = tocando ? Math.exp(-noTempo / 6) : 0;
  const desce = tocando && Math.floor((quadro - M.batida) / 25) % 2 === 0;
  const planos = janela(quadro, M.batida - 6, M.comoFoi - 6, 16);
  const festa = quadro >= M.concluida ? Math.exp(-(quadro - M.concluida) / 10) : 0;
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 700} regiao="vila" altura={0.2} />
      <Aparelho cena="pratica" quadro={quadro} x={540} y={556 + flutua} tela={850} escala={1 + pulso * 0.012 + festa * 0.03} giro={[5, 15, -2]} cortes={[M.comoFoi]} />

      <div style={{ position: 'absolute', left: 990, top: 150 }}>
        <Palavras quadro={quadro} inicio={M.titulo} sai={M.comoFoi - 18} linhas={['Depois, é', 'na vida real.']} tamanho={112} cores={{ L1: CORES.acao }} />
      </div>
      <div style={{ position: 'absolute', left: 992, top: 430, display: 'flex', gap: 16, opacity: quadro < M.comoFoi - 10 ? 1 : 0 }}>
        <Pilula quadro={quadro} inicio={M.cronometro} sai={M.comoFoi - 22} tamanho={34}>Cronômetro</Pilula>
        <Pilula quadro={quadro} inicio={M.batida} sai={M.comoFoi - 20} tamanho={34} fundo={CORES.acao} cor="#fff">Batida para tocar junto</Pilula>
      </div>
      {planos > 0 && ativo.clipe === 'pratica' && (
        <div style={{ position: 'absolute', left: 990, top: 536, opacity: planos, transform: `translateY(${(1 - planos) * 40}px)` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, transform: 'rotate(-2deg)' }}>
            <Recorte nome="pratica" quadro={ativo.q} area={{ x: 97, y: 262, l: 196, a: 182 }} largura={250} raio={40} borda={CORES.gelo} />
          </div>
          <div style={{ position: 'absolute', left: 286, top: 26, transform: `rotate(1deg) scale(${1 + pulso * 0.02})`, transformOrigin: '50% 50%' }}>
            <Recorte nome="pratica" quadro={ativo.q} area={{ x: 52, y: 598, l: 288, a: 80 }} largura={540} raio={30} borda={CORES.ouro} />
          </div>
          <div style={{ position: 'absolute', left: 290, top: 208, display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 76, height: 76, borderRadius: '50%', background: desce ? CORES.acao : '#fff', border: `5px solid ${CORES.acao}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: `scale(${1 + pulso * 0.22})`,
            }}>
              <svg width={44} height={44} viewBox="0 0 24 24" style={{ transform: `rotate(${desce ? 0 : 180}deg)` }}>
                <path d="M12 4 V19 M5.5 13 L12 19.5 L18.5 13" fill="none" stroke={desce ? '#fff' : CORES.acao} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ font: `800 36px ${FONTE.corpo}`, color: CORES.texto, lineHeight: 1.2, whiteSpace: 'nowrap' }}>O app toca.<br /><span style={{ color: CORES.acao }}>Você toca junto.</span></div>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', left: 990, top: 190 }}>
        <Palavras quadro={quadro} inicio={M.comoFoi + 6} sai={M.concluida - 16} linhas={['E você conta', 'como foi.']} tamanho={112} cores={{ L1: CORES.acao }} />
      </div>
      <div style={{ position: 'absolute', left: 990, top: 190 }}>
        <Palavras quadro={quadro} inicio={M.concluida} linhas={['Lição', 'concluída!']} tamanho={150} cores={{ L1: CORES.sucessoClaro }} passo={4} />
      </div>
      <div style={{ position: 'absolute', left: 994, top: 560 }}>
        <Pilula quadro={quadro} inicio={M.concluida + 22} tamanho={38} fundo={CORES.sucessoClaro} cor="#fff">Mais um passo na trilha</Pilula>
      </div>
      <Confete quadro={quadro - M.concluida} x={540} y={400} pecas={130} forca={1.1} semente={31} />
      <Nota />
    </AbsoluteFill>
  );
}
