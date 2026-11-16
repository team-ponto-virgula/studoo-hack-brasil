import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Noite } from '../componentes/Fundo.jsx';
import { Orador } from '../componentes/Orador.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { CURVA, janela, mola, rampa } from '../movimento.js';
import { ROTEIRO } from '../roteiro.js';
import { MOMENTOS, duracaoDe, inicioDe } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';
import { CARTAS, Carta } from './Abertura.jsx';

const M = MOMENTOS.julio;
const X = 1010;

/** Título de um tema do espaço de fala: entra no começo do tema e sai antes do próximo. */
function Tema({ quadro, de, ate, linhas, cor = CORES.ouro }) {
  if (quadro < de - 2 || quadro > ate + 20) return null;
  return (
    <div style={{ position: 'absolute', left: X, top: 208 }}>
      <Palavras quadro={quadro} inicio={de} sai={ate - 14} linhas={linhas} tamanho={92} cor="#fff" cores={{ L1: cor }} passo={4} />
    </div>
  );
}

/** Espaço de fala do Júlio (12 compassos, 20 s): a janela à esquerda e o problema, em três tempos, à direita. */
export function Julio() {
  const quadro = useCurrentFrame();
  const duracao = duracaoDe('julio');
  const limpa = rampa(quadro, M.limpa, M.limpa + 40, 0, 1, CURVA.saida);

  // Tema 1: o conteúdo que não acaba (duas colunas de cartões subindo sem parar).
  const v1 = janela(quadro, M.tema1 + 30, M.tema2 - 4, 22);
  // Tema 2: horas assistindo, nada praticado.
  const v2 = janela(quadro, M.tema2 + 24, M.tema3 - 4, 22);
  const assistido = rampa(quadro, M.tema2 + 40, M.tema3 - 30, 0, 1, CURVA.linear);
  const minutos = Math.round(assistido * 167);
  // Tema 3: errou, e ninguém explica.
  const v3 = janela(quadro, M.tema3 + 24, M.limpa + 30, 22);
  const carimbo = mola(quadro, M.erro, { damping: 10, stiffness: 240, mass: 0.6 });
  const treme = quadro >= M.erro && quadro < M.erro + 16 ? Math.sin((quadro - M.erro) * 2.2) * (16 - (quadro - M.erro)) * 0.8 : 0;

  return (
    <AbsoluteFill>
      <Noite quadro={quadro + inicioDe('julio')} />
      <Orador quem="julio" quadro={quadro} duracao={duracao} roteiro={ROTEIRO.julio} x={110} y={140} />

      <div style={{ position: 'absolute', left: X, top: 140, opacity: 1 - limpa }}>
        <Pilula quadro={quadro} inicio={18} tamanho={24} fundo="rgba(255,255,255,0.1)" cor={CORES.ouro} sombra={false} style={{ letterSpacing: '0.2em' }}>O PROBLEMA</Pilula>
      </div>
      <Tema quadro={quadro} de={M.tema1} ate={M.tema2} linhas={['Conteúdo', 'não falta.']} />
      <Tema quadro={quadro} de={M.tema2} ate={M.tema3} linhas={['Falta', 'praticar.']} />
      <Tema quadro={quadro} de={M.tema3} ate={M.limpa + 20} linhas={['Errou?', 'Ninguém explica.']} cor="#ff8fa3" />

      {v1 > 0 && (
        <div style={{
          position: 'absolute', left: X, top: 470, width: 810, height: 500, overflow: 'hidden', opacity: v1,
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 16%, #000 80%, transparent 100%)', maskImage: 'linear-gradient(180deg, transparent 0%, #000 16%, #000 80%, transparent 100%)',
        }}>
          {[0, 1].map((coluna) => CARTAS.map((carta, i) => {
            const passo = 132;
            const total = CARTAS.length * passo;
            const y = ((i * passo + coluna * 66 - quadro * (coluna ? 1.05 : 1.6)) % total + total) % total - passo;
            return (
              <div key={`${coluna}-${i}`} style={{ position: 'absolute', left: coluna * 412, top: y, transform: `scale(${0.96}) rotate(${coluna ? 1.2 : -1.2}deg)` }}>
                <Carta tipo={carta[0]} titulo={carta[1]} meta={carta[2]} largura={390} />
              </div>
            );
          }))}
        </div>
      )}

      {v2 > 0 && (
        <div style={{ position: 'absolute', left: X, top: 480, opacity: v2, transform: `translateY(${(1 - v2) * 40}px)` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 392, height: 400, borderRadius: 34, background: '#fff', overflow: 'hidden', boxShadow: '0 30px 60px -26px rgba(2,6,24,0.8)' }}>
            <div style={{ height: 248, background: 'linear-gradient(135deg, #6c7fd8 0%, #3858d6 60%, #2a44a8 100%)', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 156, top: 84, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={34} height={34} viewBox="0 0 24 24"><path d="M8 5 L20 12 L8 19 Z" fill={CORES.acao} /></svg>
              </div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: 'rgba(255,255,255,0.3)' }}>
                <div style={{ width: `${assistido * 100}%`, height: '100%', background: '#ff6b6b' }} />
              </div>
            </div>
            <div style={{ padding: '20px 26px' }}>
              <div style={{ font: `800 22px ${FONTE.corpo}`, color: CORES.texto2, letterSpacing: '0.14em' }}>ASSISTINDO</div>
              <div style={{ font: `700 58px ${FONTE.titulo}`, color: CORES.texto, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
                {Math.floor(minutos / 60)} h {String(minutos % 60).padStart(2, '0')} min
              </div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 416, top: 0, width: 394, height: 400, borderRadius: 34, background: 'rgba(255,255,255,0.08)', border: '3px dashed rgba(255,255,255,0.4)', padding: '26px 28px', boxSizing: 'border-box' }}>
            <div style={{ font: `800 22px ${FONTE.corpo}`, color: CORES.ouro, letterSpacing: '0.14em' }}>PRATICANDO</div>
            {['Tocar o acorde', 'Fazer o exercício', 'Rever o que errou'].map((linha, i) => {
              const e = mola(quadro, M.tema2 + 60 + i * 25, { damping: 14, stiffness: 160 });
              return (
                <div key={linha} style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28, transform: `translateX(${(1 - e) * 60}px)`, opacity: Math.min(1, e * 1.5) }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, border: '4px solid rgba(255,255,255,0.75)', flexShrink: 0 }} />
                  <span style={{ font: `800 29px ${FONTE.corpo}`, color: '#fff', whiteSpace: 'nowrap' }}>{linha}</span>
                </div>
              );
            })}
            <div style={{ marginTop: 34, font: `800 30px ${FONTE.corpo}`, color: 'rgba(255,255,255,0.6)' }}>0 de 3</div>
          </div>
        </div>
      )}

      {v3 > 0 && (
        <div style={{ position: 'absolute', left: X, top: 490, width: 800, opacity: v3 * (1 - limpa), transform: `translate(${treme}px, ${(1 - v3) * 40 + limpa * 300}px) rotate(${limpa * 6}deg)` }}>
          <div style={{ borderRadius: 34, background: '#fff', padding: '30px 36px 34px', boxShadow: '0 30px 60px -26px rgba(2,6,24,0.8)' }}>
            <div style={{ font: `800 22px ${FONTE.corpo}`, color: CORES.texto2, letterSpacing: '0.14em' }}>EXERCÍCIO</div>
            <div style={{ font: `700 44px ${FONTE.titulo}`, color: CORES.texto, marginTop: 6 }}>Qual é este acorde?</div>
            <div style={{
              marginTop: 22, padding: '18px 24px', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: `4px solid ${quadro >= M.erro ? CORES.erro : CORES.gelo}`, background: quadro >= M.erro ? '#fdecef' : '#fff',
            }}>
              <span style={{ font: `800 34px ${FONTE.corpo}`, color: CORES.texto }}>Dó maior</span>
              <span style={{ width: 54, height: 54, borderRadius: '50%', background: CORES.erro, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${quadro >= M.erro ? 2 - carimbo : 0})` }}>
                <svg width={30} height={30} viewBox="0 0 24 24"><path d="M6 6 L18 18 M18 6 L6 18" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" /></svg>
              </span>
            </div>
            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, opacity: rampa(quadro, M.erro + 8, M.erro + 24) }}>
              <span style={{ font: `800 32px ${FONTE.corpo}`, color: CORES.erro }}>Resposta errada.</span>
              <span style={{ font: `700 32px ${FONTE.corpo}`, color: CORES.texto2 }}>Por quê?</span>
              <span style={{ width: 4, height: 36, background: CORES.texto2, opacity: Math.floor(quadro / 20) % 2 ? 0.2 : 0.9 }} />
            </div>
          </div>
          {[0, 1, 2].map((i) => {
            const p = rampa(quadro, M.erro + 30 + i * 22, M.erro + 150 + i * 22, 0, 1, CURVA.linear);
            if (p <= 0 || p >= 1) return null;
            return <div key={i} style={{ position: 'absolute', left: 560 + i * 80, top: 250 - p * 260, font: `700 ${70 + i * 14}px ${FONTE.titulo}`, color: '#ff8fa3', opacity: Math.sin(p * Math.PI), transform: `rotate(${(i - 1) * 14 + Math.sin(p * 6) * 8}deg)` }}>?</div>;
          })}
        </div>
      )}
    </AbsoluteFill>
  );
}
