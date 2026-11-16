import React from 'react';
import clipes from '../clipes.js';
import { CURVA, rampa } from '../movimento.js';
import { trechoAtivo } from '../tempos.js';
import { Celular, Clipe } from './Celular.jsx';

/** Giro de corte: o aparelho vira de lado até sumir, troca o que mostra e volta. Devolve graus para somar ao giro Y. */
export function giroDeCorte(quadro, corte) {
  if (quadro < corte - 9 || quadro > corte + 13) return 0;
  if (quadro < corte) return rampa(quadro, corte - 9, corte, 0, -90, CURVA.saida);
  return rampa(quadro, corte, corte + 13, 90, 0, CURVA.suave);
}

/**
 * Celular em 3D, posicionado pelo centro. Com `cena`, mostra o trecho de gravação ativo daquela cena (tempos.js);
 * com `nome` e `q`, um clipe e um quadro escolhidos. `cortes` são os quadros da cena em que o aparelho gira para trocar de clipe.
 */
export function Aparelho({ cena, quadro = 0, nome, q = 0, x = 960, y = 540, tela = 850, giro = [0, 0, 0], escala = 1, cortes = [], opacidade = 1, toques = true, children }) {
  let clipe = nome;
  let quadroDoClipe = q;
  if (cena) {
    const ativo = trechoAtivo(cena, quadro);
    clipe = ativo.clipe;
    quadroDoClipe = ativo.q;
  }
  const fator = tela / 844;
  const largura = 390 * fator + 26 * fator;
  const altura = tela + 26 * fator;
  const virada = cortes.reduce((soma, corte) => soma + giroDeCorte(quadro, corte), 0);
  return (
    <div style={{ position: 'absolute', left: x - largura / 2, top: y - altura / 2, perspective: 2600, opacity: opacidade }}>
      <div style={{ transform: `rotateY(${giro[1] + virada}deg) rotateX(${giro[0]}deg) rotateZ(${giro[2]}deg) scale(${escala})`, transformOrigin: '50% 50%' }}>
        <Celular nome={clipe} quadro={quadroDoClipe} tela={tela} toques={toques}>{children}</Celular>
      </div>
    </div>
  );
}

/**
 * Plano fechado de uma parte da tela gravada, num cartão. `area` é o retângulo em px da tela do app ({ x, y, l, a });
 * `largura` é a largura do cartão no filme. Usa a gravação original em 3x, para a ampliação ficar nítida.
 */
export function Recorte({ nome, quadro, area, largura, raio = 30, borda = '#fff', style, children }) {
  const info = clipes[nome];
  const k = largura / area.l;
  return (
    <div style={{
      position: 'relative', width: largura, height: area.a * k, borderRadius: raio, overflow: 'hidden', background: '#fff',
      boxShadow: `0 0 0 6px ${borda}, 0 34px 70px -26px rgba(16,26,64,0.55), 0 12px 26px -12px rgba(16,26,64,0.35)`, ...style,
    }}>
      <div style={{ position: 'absolute', left: -area.x * k, top: -area.y * k, width: info.largura * k, height: info.altura * k }}>
        <Clipe nome={nome} quadro={quadro} alta />
      </div>
      {children}
    </div>
  );
}

/** Notebook com a gravação do site no computador: o ponteiro e os cliques são desenhados por cima, a partir da gravação. */
export function Notebook({ nome, quadro, largura = 1000 }) {
  const info = clipes[nome];
  const k = largura / info.largura;
  const altura = info.altura * k;
  const moldura = largura * 0.018;
  let ponto = info.cursor[0] ?? [0, info.largura / 2, info.altura / 2];
  for (const p of info.cursor) { if (p[0] <= quadro) ponto = p; else break; }
  const clique = info.cliques.find((c) => quadro >= c.q0 && quadro <= c.q1 + 26);
  const onda = clique ? rampa(quadro, clique.q1, clique.q1 + 26) : 0;
  return (
    <div style={{ position: 'relative', width: largura + moldura * 2, height: altura + moldura * 2 + largura * 0.034 }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, width: largura + moldura * 2, height: altura + moldura * 2, borderRadius: moldura * 1.5,
        background: 'linear-gradient(150deg, #1d2756 0%, #0b1029 60%, #161d44 100%)',
        boxShadow: '0 60px 90px -40px rgba(16,26,64,0.6), 0 20px 40px -20px rgba(16,26,64,0.4), inset 0 0 0 2px rgba(255,255,255,0.14)',
      }} />
      <div style={{ position: 'absolute', left: moldura, top: moldura, width: largura, height: altura, borderRadius: moldura * 0.55, overflow: 'hidden', background: '#fff' }}>
        <Clipe nome={nome} quadro={quadro} />
        {clique && (
          <div style={{
            position: 'absolute', left: clique.x * k - 30, top: clique.y * k - 30, width: 60, height: 60, borderRadius: '50%', border: '4px solid rgba(56,88,214,0.9)',
            transform: `scale(${0.4 + onda * 1.3})`, opacity: quadro < clique.q1 ? 0.9 : 0.9 * (1 - onda),
          }} />
        )}
        <svg width={34} height={34} viewBox="0 0 24 24" style={{ position: 'absolute', left: ponto[1] * k - 5, top: ponto[2] * k - 3, filter: 'drop-shadow(0 3px 4px rgba(16,26,64,0.4))', transform: `scale(${clique && quadro <= clique.q1 ? 0.86 : 1})`, transformOrigin: '20% 15%' }}>
          <path d="M5 3 L5 19.5 L9.4 15.6 L12.3 22 L15 20.8 L12.1 14.5 L18 14.2 Z" fill="#fff" stroke="#101a40" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(118deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 30%)' }} />
      </div>
      <div style={{
        position: 'absolute', left: -largura * 0.07, top: altura + moldura * 2 - 2, width: largura * 1.14 + moldura * 2, height: largura * 0.034,
        borderRadius: `4px 4px ${largura * 0.03}px ${largura * 0.03}px`, background: 'linear-gradient(180deg, #dfe4f6 0%, #b7bfdc 55%, #8f98bd 100%)',
        boxShadow: '0 30px 40px -18px rgba(16,26,64,0.5)',
      }}>
        <div style={{ position: 'absolute', left: '42%', top: 0, width: '16%', height: '36%', borderRadius: '0 0 12px 12px', background: 'rgba(27,42,94,0.2)' }} />
      </div>
    </div>
  );
}
