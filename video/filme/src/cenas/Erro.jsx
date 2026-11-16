import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho, Recorte } from '../componentes/Aparelho.jsx';
import { Confete } from '../componentes/Confete.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Stu, stuVivo } from '../componentes/Stu.jsx';
import { Palavras } from '../componentes/Texto.jsx';
import { CURVA, janela, mola, rampa } from '../movimento.js';
import { MOMENTOS } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';

const M = MOMENTOS.erro;

/** Errou, o Stu explica de outro jeito, você acerta (6 compassos). O erro cai no compasso 33 e o acerto, no 37. */
export function Erro() {
  const quadro = useCurrentFrame();
  const flutua = Math.sin(quadro / 46) * 8;
  const desde = quadro - M.errou;
  const treme = desde >= 0 && desde < 18 ? Math.sin(desde * 2.3) * (18 - desde) * 1.1 : 0;
  const acertou = quadro >= M.acerta;
  const festa = acertou ? Math.exp(-(quadro - M.acerta) / 10) : 0;
  const golpe = mola(quadro, M.errou, { damping: 11, stiffness: 230, mass: 0.6 });
  const cartaErro = janela(quadro, M.errou + 10, M.outroJeito - 4, 16);
  const cartaReforco = janela(quadro, M.outroJeito + 16, M.acerta - 8, 18);
  const selo = mola(quadro, M.acerta + 2, { damping: 9, stiffness: 200, mass: 0.7 });
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 500} regiao="montanhas" altura={0.2} />
      <Aparelho cena="erro" quadro={quadro} x={1400 + treme} y={556 + flutua} tela={850} escala={1 + festa * 0.03} giro={[5, -15 + treme * 0.2, 2]} />

      <div style={{ position: 'absolute', left: 130, top: 190 }}>
        <Palavras quadro={quadro} inicio={M.titulo} sai={M.errou - 16} linhas={['Você pratica', 'em cada lição.']} tamanho={108} cores={{ L1: CORES.acao }} />
      </div>

      {quadro >= M.errou && quadro < M.outroJeito + 12 && (
        <div style={{
          position: 'absolute', left: 124, top: 150, font: `700 220px ${FONTE.titulo}`, letterSpacing: '-0.03em', color: CORES.erro, transformOrigin: '0% 60%',
          transform: `translateX(${treme}px) scale(${2 - golpe}) rotate(${(1 - golpe) * -6}deg)`, opacity: Math.min(1, golpe * 2) * (1 - rampa(quadro, M.outroJeito - 14, M.outroJeito + 4)),
        }}>Errou?</div>
      )}
      {cartaErro > 0 && (
        <div style={{ position: 'absolute', left: 130, top: 470, transformOrigin: '0% 0%', transform: `scale(${0.8 + 0.2 * cartaErro}) rotate(${-2 + cartaErro * 0.5}deg)`, opacity: cartaErro }}>
          <Recorte nome="pares-erro" quadro={470} area={{ x: 0, y: 540, l: 390, a: 166 }} largura={700} borda="#f6d9a8" />
        </div>
      )}

      <div style={{ position: 'absolute', left: 130, top: 150 }}>
        <Palavras quadro={quadro} inicio={M.outroJeito} sai={M.acerta - 16} linhas={['O Stu explica', 'de outro jeito.']} tamanho={104} cores={{ L1: CORES.acao }} />
      </div>
      {cartaReforco > 0 && (
        <div style={{ position: 'absolute', left: 130, top: 432, transformOrigin: '0% 0%', transform: `translateY(${(1 - cartaReforco) * 50}px) rotate(${-1.5 + cartaReforco * 0.5}deg)`, opacity: cartaReforco }}>
          <Recorte nome="reforco" quadro={150} area={{ x: 22, y: 86, l: 346, a: 262 }} largura={620} borda={CORES.gelo} />
          <div style={{ position: 'absolute', left: 566, top: 300, transform: `scale(${mola(quadro, M.outroJeito + 34, { damping: 11, stiffness: 150 })})`, transformOrigin: '50% 100%' }}>
            <Stu tamanho={210} {...stuVivo(quadro, 60)} aceno={Math.sin(quadro / 8) * 12 - 6} boca={0.7} olhar={[-14, 4]} />
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', left: 130, top: 210 }}>
        <Palavras quadro={quadro} inicio={M.acerta} linhas={['Aí você', 'acerta.']} tamanho={170} cores={{ L1: CORES.sucessoClaro }} passo={4} />
      </div>
      {acertou && (
        <div style={{
          position: 'absolute', left: 140, top: 640, width: 170, height: 170, borderRadius: '50%', background: CORES.sucessoClaro, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `scale(${selo}) rotate(${(1 - selo) * -40}deg)`, boxShadow: '0 14px 0 rgba(31,122,90,0.3), 0 30px 50px -20px rgba(31,122,90,0.6)',
        }}>
          <svg width={100} height={100} viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7.5" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
      <Confete quadro={quadro - M.acerta} x={1400} y={420} pecas={130} forca={1.1} semente={23} />
      <Nota />
    </AbsoluteFill>
  );
}
