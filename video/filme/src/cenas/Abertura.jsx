import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Noite } from '../componentes/Fundo.jsx';
import { Palavras } from '../componentes/Texto.jsx';
import { CURVA, mola, rampa, sorte } from '../movimento.js';
import { MOMENTOS } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';

const M = MOMENTOS.abertura;
// Exemplos ilustrativos do excesso de conteúdo (não são dados de ninguém).
export const CARTAS = [
  ['video', 'Playlist para iniciantes', '87 vídeos'], ['doc', 'Apostila completa.pdf', '212 páginas'], ['video', 'Curso do zero ao avançado', '40 horas'],
  ['aba', '12 abas abertas', 'ler depois'], ['video', 'Aula 1 de 64', 'continuar assistindo'], ['doc', 'Resumo do resumo', 'PDF'],
  ['video', 'Live: tire suas dúvidas', '3 h 12 min'], ['salvo', 'Salvos para depois', '34 itens'], ['video', 'Tutorial, parte 3', '48 min'],
  ['doc', 'Lista de exercícios', 'sem gabarito'], ['video', 'Tudo o que você precisa saber', '2 h 47 min'], ['aba', 'Fórum: por onde começo?', '126 respostas'],
];
const ICONE = {
  video: <path d="M9 7 L18 12 L9 17 Z" fill="#fff" />,
  doc: <path d="M7 5 h7 l4 4 v10 h-11 Z M9 12 h7 M9 15 h7" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />,
  aba: <path d="M4 8 h6 l1.5 -2 h8.5 v12 h-16 Z" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />,
  salvo: <path d="M7 5 h10 v15 l-5 -4 l-5 4 Z" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinejoin="round" />,
};
const COR = { video: '#e5536c', doc: '#3858d6', aba: '#7c5fd6', salvo: '#e58a1f' };
// As 24 casas da grade (6 colunas por 4 linhas), numa ordem fixa e espalhada.
const ORDEM_DAS_CASAS = [8, 15, 3, 20, 10, 1, 17, 6, 22, 13, 4, 19, 0, 11, 23, 7, 14, 2, 21, 9, 16, 5, 18, 12];

export function Carta({ tipo, titulo, meta, largura = 400 }) {
  return (
    <div style={{
      width: largura, padding: '18px 22px', borderRadius: 26, background: '#fff', display: 'flex', alignItems: 'center', gap: 18,
      boxShadow: '0 26px 50px -22px rgba(2,6,24,0.75), 0 2px 0 rgba(255,255,255,0.6) inset',
    }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: COR[tipo], flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={38} height={38} viewBox="0 0 24 24">{ICONE[tipo]}</svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: `800 27px ${FONTE.corpo}`, color: CORES.texto, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
        <div style={{ font: `700 21px ${FONTE.corpo}`, color: CORES.texto2 }}>{meta}</div>
      </div>
    </div>
  );
}

/** Abertura (4 compassos): aprender devia ser simples; a avalanche de conteúdo; muito conteúdo, pouca prática. */
export function Abertura() {
  const quadro = useCurrentFrame();
  const rnd = sorte(41);
  const queda = rampa(quadro, M.queda, M.queda + 44, 0, 1, CURVA.saida);
  const escurece = rampa(quadro, M.muito - 8, M.muito + 10) * (1 - queda);
  const tremor = (inicio) => { const p = quadro - inicio; return p >= 0 && p < 14 ? Math.sin(p * 2.4) * (14 - p) * 0.9 : 0; };
  const recuo = 1 - 0.06 * rampa(quadro, 100, 330, 0, 1, CURVA.camera);
  return (
    <AbsoluteFill>
      <Noite quadro={quadro} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 330, display: 'flex', justifyContent: 'center', opacity: 1 - rampa(quadro, 150, 196), transform: `scale(${1 - 0.1 * rampa(quadro, 120, 196)})` }}>
        <Palavras quadro={quadro} inicio={M.frase1} linhas={['Aprender algo novo', 'devia ser simples.']} tamanho={128} cor="#fff" cores={{ L1: CORES.ouro }} alinhar="centro" passo={4} />
      </div>

      <AbsoluteFill style={{ transform: `scale(${recuo}) translate(${tremor(M.muito) + tremor(M.pouca)}px, ${tremor(M.pouca) * 0.6}px)` }}>
        {M.cartas.map((inicio, i) => {
          const [tipo, titulo, meta] = CARTAS[i % CARTAS.length];
          // Uma grade de 6 por 4 embaralhada: a pilha cobre a tela inteira, sem deixar buraco.
          const casa = ORDEM_DAS_CASAS[i];
          const x = -70 + (casa % 6) * 330 + (rnd() - 0.5) * 120;
          const y = 20 + Math.floor(casa / 6) * 262 + (rnd() - 0.5) * 90;
          const giro = (rnd() - 0.5) * 24;
          const e = mola(quadro, inicio, { damping: 11, stiffness: 130, mass: 0.8 });
          const cai = Math.max(0, quadro - M.queda - (i % 6) * 1.5);
          const peso = 0.8 + rnd() * 0.8;
          return (
            <div key={i} style={{
              position: 'absolute', left: x, top: y + (1 - e) * -1350 + cai * cai * peso * 1.7, transformOrigin: '50% 50%',
              transform: `rotate(${giro + (1 - e) * 40 + cai * (i % 2 ? 1.6 : -1.6)}deg) scale(${1.05 + 0.2 * e})`, opacity: quadro < inicio ? 0 : 1,
            }}>
              <Carta tipo={tipo} titulo={titulo} meta={meta} largura={370 + ((i * 53) % 90)} />
            </div>
          );
        })}
      </AbsoluteFill>

      <AbsoluteFill style={{ background: 'rgba(8,13,38,0.58)', opacity: escurece }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${-queda * 700}px)`, opacity: 1 - queda }}>
        <Golpe quadro={quadro} inicio={M.muito} cor="#fff">Muito conteúdo.</Golpe>
        <Golpe quadro={quadro} inicio={M.pouca} cor={CORES.ouro}>Pouca prática.</Golpe>
      </div>
    </AbsoluteFill>
  );
}

/** Frase que bate na tela: chega grande e assenta. */
function Golpe({ quadro, inicio, cor, children }) {
  const e = mola(quadro, inicio, { damping: 14, stiffness: 210, mass: 0.7 });
  if (quadro < inicio) return <div style={{ height: 190 }} />;
  return (
    <div style={{
      height: 190, font: `700 164px ${FONTE.titulo}`, letterSpacing: '-0.03em', color: cor, lineHeight: 1.1, whiteSpace: 'nowrap',
      transform: `scale(${2.2 - 1.2 * e})`, opacity: Math.min(1, e * 2), textShadow: '0 10px 0 rgba(2,6,24,0.35), 0 16px 50px rgba(2,6,24,0.9)',
    }}>{children}</div>
  );
}
