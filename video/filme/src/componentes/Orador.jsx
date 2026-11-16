import React from 'react';
import { OffthreadVideo, getInputProps, staticFile } from 'remotion';
import { CURVA, mola, rampa } from '../movimento.js';
import { CORES, FONTE, FPS, ORADORES } from '../tema.js';

export const JANELA = 800;

/**
 * A janela de quem fala. Com o vídeo gravado em public/falas, ele entra aqui (cortado no centro); sem ele, a janela
 * mostra o espaço reservado: o nome, o tempo e a sugestão de fala, que acompanha o relógio como um teleprompter.
 * @param {object} p
 * @param {'julio'|'miguel'} p.quem
 * @param {number} p.quadro quadro local da cena
 * @param {number} p.duracao quadros do espaço
 * @param {{ de: number, texto: string }[]} p.roteiro falas sugeridas, com o quadro em que cada uma começa
 */
export function Orador({ quem, quadro, duracao, roteiro, x, y, clara = false }) {
  const { nome, arquivo } = ORADORES[quem];
  const entra = mola(quadro, 0, { damping: 15, stiffness: 120, mass: 0.9 });
  const sai = rampa(quadro, duracao - 16, duracao + 6, 0, 1, CURVA.saida);
  // Quem monta o filme diz quais falas gravadas existem (montar.mjs confere a pasta public/falas).
  const temVideo = Boolean(getInputProps().falas?.[quem]);
  const atual = roteiro.reduce((achado, fala, i) => (quadro >= fala.de ? i : achado), 0);
  const segundos = Math.min(duracao / FPS, Math.max(0, quadro / FPS));
  const relogio = `0:${String(Math.floor(segundos)).padStart(2, '0')}`;
  const total = `0:${String(Math.round(duracao / FPS)).padStart(2, '0')}`;
  const traco = 2 * (JANELA - 56) * 2 + 400;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: JANELA, height: JANELA, transformOrigin: '50% 60%',
      transform: `translateY(${(1 - entra) * 260}px) scale(${(0.72 + 0.28 * entra) * (1 - sai * 0.5)}) rotate(${(1 - entra) * -5}deg)`, opacity: Math.min(1, entra * 1.6) * (1 - sai),
    }}>
      <div style={{ position: 'absolute', inset: -14, borderRadius: 78, background: clara ? 'rgba(255,255,255,0.16)' : 'rgba(84,112,220,0.2)' }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 64, overflow: 'hidden', background: 'linear-gradient(165deg, #263a8c 0%, #18245a 55%, #101a40 100%)',
        boxShadow: '0 50px 90px -40px rgba(4,8,26,0.8), inset 0 0 0 3px rgba(255,255,255,0.16)',
      }}>
        {temVideo ? (
          <OffthreadVideo src={staticFile(arquivo)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <>
            <svg width={JANELA} height={JANELA} style={{ position: 'absolute', inset: 0 }}>
              <rect x={28} y={28} width={JANELA - 56} height={JANELA - 56} rx={42} fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth={4}
                strokeDasharray="22 16" strokeDashoffset={-quadro * 0.8} />
              <rect x={28} y={28} width={JANELA - 56} height={JANELA - 56} rx={42} fill="none" stroke={CORES.ouro} strokeWidth={5} strokeLinecap="round"
                strokeDasharray={`${traco * Math.min(1, quadro / duracao)} ${traco}`} />
            </svg>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 78, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 150, height: 150 }}>
                {[0, 1].map((i) => {
                  const p = ((quadro + i * 45) % 90) / 90;
                  return <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${CORES.ouro}`, transform: `scale(${1 + p * 0.55})`, opacity: 0.5 * (1 - p) }} />;
                })}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%', background: CORES.ouro, color: CORES.texto, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: `700 84px ${FONTE.titulo}`,
                }}>{nome[0]}</div>
              </div>
              <div style={{ marginTop: 26, font: `800 24px ${FONTE.corpo}`, letterSpacing: '0.2em', color: CORES.ouro }}>ESPAÇO DE FALA</div>
              <div style={{ marginTop: 4, font: `700 62px ${FONTE.titulo}`, color: '#fff', letterSpacing: '-0.01em' }}>{nome} fala aqui</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', font: `700 26px ${FONTE.corpo}`, color: 'rgba(255,255,255,0.72)' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#ff6b6b', opacity: Math.floor(quadro / 30) % 2 ? 0.35 : 1 }} />
                <span style={{ fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{relogio}</span>
                <span>de {total}</span>
              </div>
            </div>
            <div style={{ position: 'absolute', left: 70, right: 70, bottom: 64 }}>
              <div style={{ font: `800 20px ${FONTE.corpo}`, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', marginBottom: 12 }}>SUGESTÃO DE FALA</div>
              {roteiro.map((fala, i) => {
                const p = mola(quadro, fala.de - 4, { damping: 20, stiffness: 140 });
                if (i > atual || i < atual - 1) return null;
                const passada = i < atual;
                return (
                  <div key={i} style={{
                    font: `${passada ? 600 : 800} ${passada ? 24 : 33}px ${FONTE.corpo}`, lineHeight: 1.25, color: passada ? 'rgba(255,255,255,0.4)' : '#fff', marginBottom: 12,
                    transform: `translateY(${passada ? 0 : (1 - p) * 26}px)`, opacity: passada ? 1 : Math.min(1, p * 1.5),
                  }}>{passada ? fala.texto : `“${fala.texto}”`}</div>
                );
              })}
            </div>
          </>
        )}
        {temVideo && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, background: 'linear-gradient(180deg, rgba(16,26,64,0) 0%, rgba(16,26,64,0.72) 100%)' }} />
        )}
      </div>
      {temVideo && (
        <div style={{
          position: 'absolute', left: 44, bottom: 44, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 26px 14px 16px', borderRadius: 999, background: '#fff',
          boxShadow: '0 14px 30px -12px rgba(4,8,26,0.6)', transform: `scale(${mola(quadro, 14, { damping: 13, stiffness: 170 })})`, transformOrigin: '0% 100%',
        }}>
          <span style={{ width: 46, height: 46, borderRadius: '50%', background: CORES.acao, color: '#fff', font: `700 28px ${FONTE.titulo}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{nome[0]}</span>
          <span style={{ font: `700 34px ${FONTE.titulo}`, color: CORES.texto }}>{nome}</span>
          <span style={{ font: `700 24px ${FONTE.corpo}`, color: CORES.texto2 }}>Studoo</span>
        </div>
      )}
    </div>
  );
}
