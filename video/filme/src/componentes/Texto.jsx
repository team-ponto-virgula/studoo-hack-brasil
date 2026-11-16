import React from 'react';
import { CORES, FONTE } from '../tema.js';
import { CURVA, mola, rampa } from '../movimento.js';

/**
 * Texto cinético: cada palavra sobe de trás de uma máscara, uma depois da outra.
 * @param {object} p
 * @param {string[]} p.linhas uma string por linha
 * @param {number} p.quadro quadro local
 * @param {number} [p.inicio] quadro em que a primeira palavra entra
 * @param {number} [p.passo] quadros entre uma palavra e a próxima
 * @param {number} [p.sai] quadro em que o texto sai (as palavras sobem e somem)
 * @param {number} [p.tamanho] tamanho da fonte, em px
 * @param {Record<string, string>} [p.cores] cor por palavra (sem pontuação) ou por índice de linha ("L0", "L1")
 * @param {'esquerda'|'centro'|'direita'} [p.alinhar]
 */
export function Palavras({ linhas, quadro, inicio = 0, passo = 3, sai, tamanho = 120, peso = 700, cor = CORES.texto, cores = {}, alinhar = 'esquerda', fonte = FONTE.titulo, entrelinha = 1.08, espaco = -0.02, style }) {
  let k = 0;
  const justifica = alinhar === 'centro' ? 'center' : alinhar === 'direita' ? 'flex-end' : 'flex-start';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: justifica, fontFamily: fonte, fontWeight: peso, fontSize: tamanho, lineHeight: entrelinha, letterSpacing: `${espaco}em`, color: cor, ...style }}>
      {linhas.map((linha, li) => (
        <div key={li} style={{ display: 'flex', gap: '0.25em', overflow: 'hidden', padding: '0.06em 0.06em 0.2em', margin: '-0.06em -0.06em -0.2em', whiteSpace: 'nowrap' }}>
          {linha.split(' ').map((palavra, pi) => {
            const i = k;
            k += 1;
            const entra = mola(quadro, inicio + i * passo, { damping: 17, stiffness: 150, mass: 0.85 });
            const vai = sai === undefined ? 0 : rampa(quadro, sai + i * 1.5, sai + i * 1.5 + 16, 0, 1, CURVA.saida);
            const chave = palavra.replace(/[.,!?…:;]/g, '');
            return (
              <span key={pi} style={{
                display: 'inline-block', color: cores[chave] ?? cores[`L${li}`] ?? undefined, willChange: 'transform',
                transform: `translateY(${(1 - entra) * 112 - vai * 118}%) rotate(${(1 - entra) * 6}deg)`, transformOrigin: '0% 100%',
              }}>{palavra}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Etiqueta em pílula que pula para dentro (para rótulos de seção e destaques curtos). */
export function Pilula({ children, quadro, inicio = 0, sai, cor = CORES.acao, fundo = '#fff', tamanho = 34, borda, sombra = true, style }) {
  const e = mola(quadro, inicio, { damping: 12, stiffness: 190, mass: 0.7 });
  const s = sai === undefined ? 0 : rampa(quadro, sai, sai + 12, 0, 1, CURVA.saida);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5em', padding: '0.5em 0.95em', borderRadius: 999, background: fundo, color: cor,
      border: borda ? `3px solid ${borda}` : undefined, fontFamily: FONTE.corpo, fontWeight: 800, fontSize: tamanho, lineHeight: 1.1, whiteSpace: 'nowrap',
      boxShadow: sombra ? '0 10px 28px -10px rgba(27,42,94,0.35), 0 3px 0 rgba(27,42,94,0.08)' : undefined,
      transform: `scale(${e * (1 - s)}) translateY(${(1 - e) * 20}px)`, opacity: Math.min(1, e * 2) * (1 - s), transformOrigin: '50% 60%', ...style,
    }}>{children}</div>
  );
}

/** Marca-texto: uma faixa de cor que varre por trás da palavra. */
export function Marca({ children, quadro, inicio = 0, cor = CORES.ouro, altura = 0.42 }) {
  const p = rampa(quadro, inicio, inicio + 22);
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <span style={{ position: 'absolute', left: '-0.08em', right: '-0.08em', bottom: '0.08em', height: `${altura}em`, background: cor, borderRadius: '0.12em', transform: `scaleX(${p}) skewX(-6deg)`, transformOrigin: '0% 50%' }} />
      <span style={{ position: 'relative' }}>{children}</span>
    </span>
  );
}

/** Texto que se escreve letra a letra, com cursor. */
export function Digitado({ texto, quadro, inicio = 0, porLetra = 2.2, cursor = true, style }) {
  const n = Math.max(0, Math.min(texto.length, Math.floor((quadro - inicio) / porLetra)));
  const pisca = Math.floor(quadro / 18) % 2 === 0 || n < texto.length;
  return <span style={style}>{texto.slice(0, n)}{cursor && <span style={{ opacity: pisca ? 1 : 0, fontWeight: 400, marginLeft: '0.02em' }}>|</span>}</span>;
}
