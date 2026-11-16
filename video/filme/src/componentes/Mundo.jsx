import React from 'react';
import { coresMundo, desenhosMundo } from '../mundo-desenhos.js';
import { mola, sorte } from '../movimento.js';

/* O mundo do Studoo: os mesmos desenhos de formas simples que o app usa no mapa da trilha (src/ui/mundo-desenhos.ts). */

function Forma({ forma }) {
  const cor = coresMundo[forma.cor];
  switch (forma.forma) {
    case 'circulo': return <circle cx={forma.x} cy={forma.y} r={forma.r} fill={cor} />;
    case 'elipse': return <ellipse cx={forma.x} cy={forma.y} rx={forma.rx} ry={forma.ry} fill={cor} />;
    case 'retangulo': {
      const giro = forma.giro ? `rotate(${forma.giro} ${forma.x + forma.largura / 2} ${forma.y + forma.altura / 2})` : undefined;
      return <rect x={forma.x} y={forma.y} width={forma.largura} height={forma.altura} rx={forma.raio} fill={cor} transform={giro} />;
    }
    case 'triangulo': {
      const { x, y, largura, altura } = forma;
      const pontos = forma.invertido ? `${x},${y} ${x + largura},${y} ${x + largura / 2},${y + altura}` : `${x},${y + altura} ${x + largura / 2},${y} ${x + largura},${y + altura}`;
      return <polygon points={pontos} fill={cor} />;
    }
    case 'cupula': {
      const { x, y, largura, altura } = forma;
      const raio = largura / 2;
      return <path d={`M${x} ${y + altura}V${y + raio}A${raio} ${raio} 0 0 1 ${x + largura} ${y + raio}V${y + altura}Z`} fill={cor} />;
    }
    default: return null;
  }
}

/** Um desenho do mundo, com `largura` em px (a altura acompanha a proporção). */
export function Desenho({ nome, largura = 100, style }) {
  const desenho = desenhosMundo[nome];
  return (
    <svg viewBox={`0 0 ${desenho.largura} ${desenho.altura}`} width={largura} height={(largura * desenho.altura) / desenho.largura}
      style={{ display: 'block', overflow: 'visible', ...style }}>
      {desenho.formas.map((forma, indice) => <Forma key={indice} forma={forma} />)}
    </svg>
  );
}

/** Regiões do mapa do app, com as cores do chão e do relevo. */
export const REGIOES = {
  campos: { chao: coresMundo.campo, relevo: coresMundo.campoRelevo, ceu: ['#dfe9ff', '#f3f7ff'] },
  floresta: { chao: coresMundo.floresta, relevo: coresMundo.florestaRelevo, ceu: ['#dcefe6', '#f2faf5'] },
  montanhas: { chao: coresMundo.montanha, relevo: coresMundo.montanhaRelevo, ceu: ['#e3e2fb', '#f6f5ff'] },
  lago: { chao: coresMundo.lago, relevo: coresMundo.lagoRelevo, ceu: ['#d5e9ff', '#f1f8ff'] },
  vila: { chao: coresMundo.vila, relevo: coresMundo.vilaRelevo, ceu: ['#ffe9d9', '#fff7f0'] },
  nuvens: { chao: coresMundo.nuvens, relevo: coresMundo.nuvensRelevo, ceu: ['#dfe4ff', '#f5f6ff'] },
};

const ENFEITES = {
  campos: [['arvore', 150, 0.02, 150], ['flores', 330, 0.1, 92], ['arbusto', 470, 0.03, 120], ['arvore', 1700, 0.04, 170], ['flores', 1540, 0.12, 88], ['arbusto', 1410, 0.05, 110], ['relva', 620, 0.16, 60], ['relva', 1280, 0.15, 60]],
  floresta: [['pinheiro', 130, 0.02, 150], ['pinheiro', 270, 0.06, 118], ['cogumelo', 420, 0.12, 78], ['pinheiro', 1720, 0.03, 160], ['tronco', 1520, 0.13, 110], ['pinheiro', 1590, 0.07, 120], ['relva', 660, 0.16, 60]],
  montanhas: [['picos', 90, 0.0, 330], ['pedra', 470, 0.1, 120], ['picos', 1500, 0.0, 360], ['pinheiro', 1400, 0.08, 110], ['pedra', 1260, 0.14, 96]],
  lago: [['barco', 240, 0.08, 150], ['ondas', 520, 0.14, 130], ['ondas', 1300, 0.12, 130], ['barco', 1640, 0.06, 130], ['ondas', 900, 0.17, 110]],
  vila: [['casa', 150, 0.03, 180], ['arvore', 360, 0.05, 130], ['flores', 520, 0.13, 86], ['casa', 1650, 0.03, 190], ['arbusto', 1470, 0.08, 110], ['arvore', 1330, 0.05, 120]],
  nuvens: [['balao', 210, 0.3, 120], ['estrela', 470, 0.5, 60], ['balao', 1650, 0.36, 130], ['estrela', 1400, 0.55, 54], ['estrela', 1000, 0.6, 40]],
};

/**
 * Paisagem de fundo, vista de lado: céu, sol, nuvens que passam, três colinas e os enfeites da região, que brotam do chão.
 * @param {object} p
 * @param {number} p.quadro quadro local da cena
 * @param {keyof typeof REGIOES} [p.regiao]
 * @param {number} [p.inicio] quadro em que a paisagem começa a montar
 * @param {number} [p.altura] altura das colinas (0 a 1 da tela; 0.3 é o padrão)
 * @param {boolean} [p.sol]
 */
export function Paisagem({ quadro, regiao = 'campos', inicio = 0, altura = 0.3, sol = true, enfeites = true, style }) {
  const r = REGIOES[regiao];
  const sobe = (atraso) => mola(quadro, inicio + atraso, { damping: 18, stiffness: 90, mass: 1 });
  const chao = 1080 * (1 - altura);
  const rnd = sorte(regiao.length * 97);
  const nuvens = [[180, 150, 250, 0.16], [760, 86, 190, 0.1], [1280, 190, 280, 0.13], [1660, 100, 170, 0.08]];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: `linear-gradient(180deg, ${r.ceu[0]} 0%, ${r.ceu[1]} 62%)`, ...style }}>
      {sol && (
        <div style={{ position: 'absolute', left: 1560, top: 84, transform: `scale(${sobe(4)}) rotate(${quadro * 0.12}deg)`, transformOrigin: '50% 50%' }}>
          <Desenho nome="sol" largura={170} />
        </div>
      )}
      {nuvens.map(([x, y, tam, vel], i) => (
        <div key={i} style={{ position: 'absolute', left: ((x + quadro * vel * 2.2 + 300) % 2300) - 300, top: y, opacity: 0.95 * sobe(6 + i * 5), transform: `scale(${0.6 + 0.4 * sobe(6 + i * 5)})` }}>
          <Desenho nome="nuvem" largura={tam} />
        </div>
      ))}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(0 ${(1 - sobe(0)) * 460})`}>
          <path d={`M0 ${chao - 30} C 260 ${chao - 150} 520 ${chao - 140} 800 ${chao - 60} S 1320 ${chao - 190} 1920 ${chao - 70} V1080 H0 Z`} fill={r.relevo} opacity={0.75} />
        </g>
        <g transform={`translate(0 ${(1 - sobe(5)) * 460})`}>
          <path d={`M0 ${chao + 40} C 300 ${chao - 60} 640 ${chao - 30} 960 ${chao + 30} S 1560 ${chao - 80} 1920 ${chao + 10} V1080 H0 Z`} fill={r.relevo} />
        </g>
        <g transform={`translate(0 ${(1 - sobe(10)) * 460})`}>
          <path d={`M0 ${chao + 110} C 360 ${chao + 40} 700 ${chao + 60} 1000 ${chao + 110} S 1600 ${chao + 30} 1920 ${chao + 90} V1080 H0 Z`} fill={r.chao} />
        </g>
      </svg>
      {enfeites && ENFEITES[regiao].map(([nome, x, sobeY, tam], i) => {
        const e = mola(quadro, inicio + 16 + i * 4 + Math.round(rnd() * 6), { damping: 11, stiffness: 150, mass: 0.7 });
        const desenho = desenhosMundo[nome];
        const h = (tam * desenho.altura) / desenho.largura;
        const balanca = Math.sin((quadro + i * 23) / 34) * 1.6;
        const y = regiao === 'nuvens' ? 1080 * sobeY : chao + 70 + sobeY * 520 - h;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, transformOrigin: '50% 100%', transform: `scale(${e}) rotate(${balanca}deg)` }}>
            <Desenho nome={nome} largura={tam} />
          </div>
        );
      })}
    </div>
  );
}
