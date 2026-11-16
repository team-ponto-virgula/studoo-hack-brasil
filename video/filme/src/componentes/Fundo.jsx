import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CORES } from '../tema.js';

/** O mundo do problema: azul-noite com luzes lentas e uma grade de pontos que desliza. */
export function Noite({ quadro, luz = 1 }) {
  return (
    <AbsoluteFill style={{ background: CORES.noite, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: -320 + Math.sin(quadro / 210) * 140, top: -380 + Math.cos(quadro / 260) * 90, width: 1300, height: 1300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,88,214,0.5) 0%, rgba(56,88,214,0) 62%)', opacity: luz,
      }} />
      <div style={{
        position: 'absolute', left: 1050 + Math.cos(quadro / 240) * 150, top: 420 + Math.sin(quadro / 200) * 110, width: 1200, height: 1200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(132,96,224,0.34) 0%, rgba(132,96,224,0) 62%)', opacity: luz,
      }} />
      <div style={{
        position: 'absolute', inset: -60, backgroundImage: 'radial-gradient(rgba(255,255,255,0.085) 1.6px, transparent 1.6px)', backgroundSize: '46px 46px',
        transform: `translate(${(quadro * 0.14) % 46}px, ${(quadro * 0.09) % 46}px)`,
      }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(13,21,54,0) 55%, rgba(6,10,28,0.55) 100%)' }} />
    </AbsoluteFill>
  );
}

/** O mundo da solução, visto por dentro: o azul da marca, com os aros do logo passando devagar. */
export function Azul({ quadro }) {
  const aros = [[-140, 620, 520, 0.09], [1480, -200, 640, 0.08], [820, 760, 420, 0.06], [300, -260, 380, 0.07]];
  return (
    <AbsoluteFill style={{ background: `linear-gradient(140deg, ${CORES.acao} 0%, #2f4cc4 55%, ${CORES.acaoEscura} 100%)`, overflow: 'hidden' }}>
      {aros.map(([x, y, d, o], i) => (
        <div key={i} style={{
          position: 'absolute', left: x + Math.sin(quadro / (170 + i * 30) + i) * 40, top: y + Math.cos(quadro / (150 + i * 26) + i * 2) * 34, width: d, height: d, borderRadius: '50%',
          border: `${d * 0.13}px solid rgba(255,255,255,${o})`,
        }} />
      ))}
      <div style={{
        position: 'absolute', inset: -60, backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1.6px, transparent 1.6px)', backgroundSize: '46px 46px',
        transform: `translate(${(-quadro * 0.12) % 46}px, ${(quadro * 0.08) % 46}px)`,
      }} />
    </AbsoluteFill>
  );
}
