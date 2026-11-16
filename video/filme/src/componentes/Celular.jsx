import React from 'react';
import { Freeze, OffthreadVideo, staticFile } from 'remotion';
import clipes from '../clipes.js';
import { CURVA, rampa } from '../movimento.js';

/** Um quadro de um clipe gravado do app. `quadro` é o quadro do clipe (não o da cena); `alta` usa o original em 3x. */
export function Clipe({ nome, quadro, alta = false, style }) {
  const info = clipes[nome];
  if (!info) throw new Error(`clipe desconhecido: ${nome}`);
  const q = Math.max(0, Math.min(info.quadros - 1, Math.round(quadro)));
  return (
    <Freeze frame={q}>
      <OffthreadVideo src={staticFile(`clipes/${nome}${alta ? '.3x' : ''}.mp4`)} muted style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', ...style }} />
    </Freeze>
  );
}

/** Os toques do clipe, desenhados por cima: o dedo chega, aperta e solta com uma onda. */
export function Toques({ nome, quadro, escala }) {
  const info = clipes[nome];
  return info.toques.map((tq, i) => {
    if (quadro < tq.q0 - 1 || quadro > tq.q2 + 28) return null;
    const chegando = rampa(quadro, tq.q0, tq.q1, 0, 1);
    const apertado = quadro >= tq.q1 && quadro <= tq.q2;
    const solto = rampa(quadro, tq.q2, tq.q2 + 26, 0, 1, CURVA.suave);
    const d = 50 * escala;
    const tamanho = quadro < tq.q1 ? 1.55 - 0.55 * chegando : apertado ? 0.82 : 0.82 + 1.5 * solto;
    const opacidade = quadro < tq.q1 ? 0.75 * chegando : apertado ? 0.85 : 0.7 * (1 - solto);
    return (
      <div key={i} style={{
        position: 'absolute', left: tq.x * escala - d / 2, top: tq.y * escala - d / 2, width: d, height: d, borderRadius: '50%',
        background: 'rgba(27, 42, 94, 0.24)', border: `${Math.max(2, 2.6 * escala)}px solid rgba(255, 255, 255, 0.95)`,
        boxShadow: '0 3px 14px rgba(27, 42, 94, 0.35)', transform: `scale(${tamanho})`, opacity: opacidade,
      }} />
    );
  });
}

/**
 * Celular com a gravação do app na tela. `tela` é a altura da tela em px (a proporção é a do aparelho gravado, 390x844).
 * Sem `nome`, desenha `children` na tela.
 */
export function Celular({ nome, quadro = 0, tela = 860, toques = true, alta = false, children, brilho = true, sombra = true, style }) {
  const info = nome ? clipes[nome] : { largura: 390, altura: 844 };
  const escala = tela / info.altura;
  const larguraTela = info.largura * escala;
  const moldura = 13 * escala;
  const raio = 52 * escala;
  const botao = { position: 'absolute', width: 4 * escala, background: '#0c1230', borderRadius: 2 * escala };
  return (
    <div style={{ position: 'relative', width: larguraTela + moldura * 2, height: tela + moldura * 2, ...style }}>
      <div style={{ ...botao, left: -3 * escala, top: 170 * escala, height: 34 * escala }} />
      <div style={{ ...botao, left: -3 * escala, top: 226 * escala, height: 62 * escala }} />
      <div style={{ ...botao, left: -3 * escala, top: 300 * escala, height: 62 * escala }} />
      <div style={{ ...botao, right: -3 * escala, top: 250 * escala, height: 96 * escala }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: raio + moldura, background: 'linear-gradient(145deg, #1d2756 0%, #0b1029 55%, #161d44 100%)',
        boxShadow: sombra
          ? `0 ${70 * escala}px ${110 * escala}px ${-36 * escala}px rgba(16, 26, 64, 0.55), 0 ${26 * escala}px ${46 * escala}px ${-18 * escala}px rgba(16, 26, 64, 0.4), inset 0 0 0 ${1.5 * escala}px rgba(255,255,255,0.16), inset 0 0 0 ${4 * escala}px #0a0f26`
          : `inset 0 0 0 ${1.5 * escala}px rgba(255,255,255,0.16), inset 0 0 0 ${4 * escala}px #0a0f26`,
      }} />
      <div style={{ position: 'absolute', left: moldura, top: moldura, width: larguraTela, height: tela, borderRadius: raio, overflow: 'hidden', background: '#fff' }}>
        {nome ? <Clipe nome={nome} quadro={quadro} alta={alta} /> : children}
        {nome && toques && <Toques nome={nome} quadro={quadro} escala={escala} />}
        {brilho && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(118deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 24%, rgba(255,255,255,0) 38%)', pointerEvents: 'none' }} />}
      </div>
    </div>
  );
}

/** Dados de um clipe (quadros, toques e marcas), para as cenas sincronizarem com a gravação. */
export const clipe = (nome) => clipes[nome];

/** Primeira marca de um tipo no clipe (por exemplo, `marca('pedido', 'geracao-inicio').q`). */
export function marca(nome, tipo, n = 0) {
  const achadas = clipes[nome].marcas.filter((m) => m.tipo === tipo);
  if (!achadas[n]) throw new Error(`marca ${tipo}#${n} não existe em ${nome}`);
  return achadas[n];
}
