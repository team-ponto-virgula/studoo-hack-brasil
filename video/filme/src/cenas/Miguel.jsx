import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Azul } from '../componentes/Fundo.jsx';
import { Orador } from '../componentes/Orador.jsx';
import { Stu, stuVivo } from '../componentes/Stu.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { CURVA, janela, mola, rampa } from '../movimento.js';
import { ROTEIRO } from '../roteiro.js';
import { MOMENTOS, duracaoDe } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';

const M = MOMENTOS.miguel;
const X = 110;

function Tema({ quadro, de, ate, linhas }) {
  if (quadro < de - 2 || quadro > ate + 20) return null;
  return (
    <div style={{ position: 'absolute', left: X, top: 208 }}>
      <Palavras quadro={quadro} inicio={de} sai={ate - 14} linhas={linhas} tamanho={82} cor="#fff" cores={{ L1: CORES.ouro }} passo={4} />
    </div>
  );
}

const DESENHO = {
  conceito: <path d="M5 6 C8 4.5 10.5 5 12 6.5 C13.5 5 16 4.5 19 6 V18 C16 16.5 13.5 17 12 18.5 C10.5 17 8 16.5 5 18 Z M12 6.5 V18.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />,
  exemplo: <><path d="M3 12 C6 6.5 18 6.5 21 12 C18 17.5 6 17.5 3 12 Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" /><circle cx={12} cy={12} r={3} fill="currentColor" /></>,
  exercicio: <path d="M5 19 L6 14.5 L15.5 5 L19 8.5 L9.5 18 Z M13.5 7 L17 10.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />,
  pratica: <><circle cx={12} cy={13} r={7.5} fill="none" stroke="currentColor" strokeWidth={2} /><path d="M12 9 V13 L15 15 M9.5 3.5 H14.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" /></>,
  certo: <path d="M5 12.5 L10 17.5 L19 7.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />,
  errado: <path d="M6.5 6.5 L17.5 17.5 M17.5 6.5 L6.5 17.5" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />,
};

// Os pontos do caminho do tema 1: descem do pedido até a primeira etapa e seguem pelas outras.
const PONTOS_DO_CAMINHO = [
  ...[590, 622, 654, 686, 718].map((y) => [100, y]),
  ...Array.from({ length: 24 }, (_, i) => [100 + ((i + 1) * 615) / 24, 800]).filter(([x]) => [100, 305, 510, 715].every((no) => Math.abs(x - no) > 66)),
];

/** Um nó do caminho, como os do mapa do app. */
function No({ x, y, raio = 54, cor = '#fff', tinta = CORES.acao, desenho, rotulo, entra = 1, pulso = 0 }) {
  return (
    <div style={{ position: 'absolute', left: x - raio, top: y - raio, width: raio * 2, transform: `scale(${entra})`, transformOrigin: `${raio}px ${raio}px` }}>
      <div style={{
        width: raio * 2, height: raio * 2, borderRadius: '50%', background: cor, color: tinta, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 ${raio * 0.16}px 0 rgba(16,26,64,0.28), 0 0 0 ${8 + pulso * 16}px rgba(255,255,255,${0.22 * (1 - pulso)})`,
      }}>
        <svg width={raio * 1.05} height={raio * 1.05} viewBox="0 0 24 24">{desenho}</svg>
      </div>
      {rotulo && <div style={{ position: 'absolute', left: -110, right: -110, top: raio * 2 + 16, textAlign: 'center', font: `800 27px ${FONTE.corpo}`, color: '#fff', whiteSpace: 'nowrap' }}>{rotulo}</div>}
    </div>
  );
}

/** Espaço de fala do Miguel (12 compassos, 20 s): como o Studoo funciona, em três tempos, e a janela à direita. */
export function Miguel() {
  const quadro = useCurrentFrame();
  const duracao = duracaoDe('miguel');
  const limpa = rampa(quadro, M.limpa, M.limpa + 40, 0, 1, CURVA.saida);
  const v1 = janela(quadro, M.tema1 + 20, M.tema2 - 4, 22);
  const v2 = janela(quadro, M.tema2 + 20, M.tema3 - 4, 22);
  const v3 = janela(quadro, M.tema3 + 20, M.limpa + 30, 22);

  // Tema 1: o pedido vira um caminho de etapas.
  const etapas = [['conceito', 'Conceito'], ['exemplo', 'Exemplo'], ['exercicio', 'Exercício'], ['pratica', 'Prática']];
  const nos1 = etapas.map((_, i) => ({ x: X + 100 + i * 205, y: 800, de: 150 + i * 50 }));
  // Tema 2: errou, o caminho desce para o reforço e volta.
  const p2 = rampa(quadro, M.tema2 + 60, M.tema2 + 300, 0, 1, CURVA.linear);
  const ponto2 = (p) => {
    // exercício (150) → erro (350) → reforço (480, +170) → acerto (690)
    if (p < 0.28) return [X + 150 + (p / 0.28) * 200, 640];
    if (p < 0.62) { const k = (p - 0.28) / 0.34; return [X + 350 + k * 130, 640 + Math.sin(k * Math.PI / 2) * 170]; }
    if (p < 0.9) { const k = (p - 0.62) / 0.28; return [X + 480 + k * 210, 810 - Math.sin(k * Math.PI / 2) * 170]; }
    return [X + 690 + ((p - 0.9) / 0.1) * 60, 640];
  };
  const [px, py] = ponto2(p2);
  // Tema 3: web e app com o mesmo progresso.
  const sincroniza = rampa(quadro, M.tema3 + 90, M.tema3 + 130);
  const feitas = sincroniza > 0.5 ? 4 : 3;
  const arco = 2 * Math.PI * 46;

  return (
    <AbsoluteFill>
      <Azul quadro={quadro} />
      <Orador quem="miguel" quadro={quadro} duracao={duracao} roteiro={ROTEIRO.miguel} x={1010} y={140} clara />

      <div style={{ position: 'absolute', left: X, top: 140, opacity: 1 - limpa }}>
        <Pilula quadro={quadro} inicio={18} tamanho={24} fundo="rgba(255,255,255,0.16)" cor="#fff" sombra={false} style={{ letterSpacing: '0.2em' }}>COMO FUNCIONA</Pilula>
      </div>
      <Tema quadro={quadro} de={M.tema1} ate={M.tema2} linhas={['Você pede.', 'A IA monta a trilha.']} />
      <Tema quadro={quadro} de={M.tema2} ate={M.tema3} linhas={['Errou?', 'O caminho muda.']} />
      <Tema quadro={quadro} de={M.tema3} ate={M.limpa + 20} linhas={['Web e app.', 'O mesmo progresso.']} />

      {v1 > 0 && (
        <AbsoluteFill style={{ opacity: v1 }}>
          <div style={{ position: 'absolute', left: X, top: 470, transform: `scale(${mola(quadro, 60, { damping: 13, stiffness: 170 })})`, transformOrigin: '0% 50%' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', height: 84, padding: '0 34px', borderRadius: 30, background: '#fff', font: `800 36px ${FONTE.corpo}`, color: CORES.texto, boxShadow: '0 10px 0 rgba(16,26,64,0.22)', whiteSpace: 'nowrap' }}>
              Quero aprender violão do zero
            </div>
          </div>
          {PONTOS_DO_CAMINHO.map(([x, y], i) => {
            const e = mola(quadro, 104 + i * 6.4, { damping: 12, stiffness: 220, mass: 0.5 });
            return <div key={i} style={{ position: 'absolute', left: X + x - 6, top: y - 6, width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', transform: `scale(${e})` }} />;
          })}
          {nos1.map((no, i) => (
            <No key={i} x={no.x} y={no.y} cor={i === 3 ? CORES.ouro : '#fff'} tinta={i === 3 ? CORES.texto : CORES.acao} entra={mola(quadro, no.de, { damping: 11, stiffness: 190, mass: 0.7 })}
              pulso={rampa(quadro, no.de, no.de + 40)} rotulo={etapas[i][1]} desenho={DESENHO[etapas[i][0]]} />
          ))}
        </AbsoluteFill>
      )}

      {v2 > 0 && (
        <AbsoluteFill style={{ opacity: v2 }}>
          <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
            <path d={`M ${X + 60} 640 H ${X + 820}`} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={9} strokeLinecap="round" strokeDasharray="2 24" />
            <path d={`M ${X + 350} 640 C ${X + 400} 640 ${X + 400} 810 ${X + 480} 810 C ${X + 580} 810 ${X + 600} 640 ${X + 690} 640`} fill="none" stroke={CORES.ouro} strokeWidth={9} strokeLinecap="round"
              strokeDasharray="1000" strokeDashoffset={1000 - 1000 * rampa(quadro, M.tema2 + 120, M.tema2 + 270, 0, 0.62, CURVA.linear)} />
          </svg>
          <No x={X + 150} y={640} raio={50} cor="#fff" desenho={DESENHO.exercicio} rotulo="Exercício" entra={mola(quadro, M.tema2 + 40, { damping: 12, stiffness: 180 })} />
          <No x={X + 350} y={640} raio={34} cor={CORES.erro} tinta="#fff" desenho={DESENHO.errado} entra={mola(quadro, M.tema2 + 125, { damping: 9, stiffness: 240, mass: 0.6 })} pulso={rampa(quadro, M.tema2 + 125, M.tema2 + 165)} />
          <No x={X + 480} y={810} raio={50} cor={CORES.ouro} tinta={CORES.texto} desenho={DESENHO.conceito} rotulo="Outro jeito de entender" entra={mola(quadro, M.tema2 + 200, { damping: 11, stiffness: 190 })} pulso={rampa(quadro, M.tema2 + 200, M.tema2 + 240)} />
          <No x={X + 690} y={640} raio={50} cor={CORES.sucessoClaro} tinta="#fff" desenho={DESENHO.certo} rotulo="Acerto" entra={mola(quadro, M.tema2 + 275, { damping: 9, stiffness: 220, mass: 0.7 })} pulso={rampa(quadro, M.tema2 + 275, M.tema2 + 320)} />
          {p2 > 0 && p2 < 1 && <div style={{ position: 'absolute', left: px - 15, top: py - 15, width: 30, height: 30, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 8px rgba(255,255,255,0.3)' }} />}
          <div style={{ position: 'absolute', left: X + 250, top: 742, transform: `scale(${mola(quadro, M.tema2 + 190, { damping: 11, stiffness: 150 })})`, transformOrigin: '50% 100%' }}>
            <Stu tamanho={150} {...stuVivo(quadro)} aceno={Math.sin(quadro / 9) * 10} sombra={false} />
          </div>
        </AbsoluteFill>
      )}

      {v3 > 0 && (
        <AbsoluteFill style={{ opacity: v3 * (1 - limpa), transform: `translateY(${limpa * 200}px)` }}>
          {[[X + 40, 300, 'Web'], [X + 470, 150, 'App']].map(([x, largura, rotulo], i) => {
            const e = mola(quadro, M.tema3 + 36 + i * 14, { damping: 13, stiffness: 160 });
            return (
              <div key={rotulo} style={{ position: 'absolute', left: x, top: 480, width: largura, transform: `translateY(${(1 - e) * 80}px)`, opacity: Math.min(1, e * 1.5) }}>
                <div style={{ height: 250, borderRadius: i ? 30 : 22, border: '8px solid #fff', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <svg width={120} height={120} viewBox="0 0 120 120">
                    <circle cx={60} cy={60} r={46} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={12} />
                    <circle cx={60} cy={60} r={46} fill="none" stroke={CORES.ouro} strokeWidth={12} strokeLinecap="round" transform="rotate(-90 60 60)"
                      strokeDasharray={`${arco * (3 + sincroniza) / 6} ${arco}`} />
                    <text x={60} y={71} textAnchor="middle" fontFamily={FONTE.titulo} fontWeight={700} fontSize={32} fill="#fff">{feitas}/6</text>
                  </svg>
                </div>
                {!i && <div style={{ margin: '0 -28px', height: 16, borderRadius: '2px 2px 14px 14px', background: '#fff' }} />}
                <div style={{ textAlign: 'center', marginTop: 12, font: `800 28px ${FONTE.corpo}`, color: '#fff' }}>{rotulo}</div>
              </div>
            );
          })}
          <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
            <path d={`M ${X + 356} 600 H ${X + 462}`} stroke="#fff" strokeWidth={7} strokeLinecap="round" strokeDasharray="2 18" opacity={0.9} strokeDashoffset={-quadro * 0.9} />
          </svg>
          <div style={{ position: 'absolute', left: X, top: 836, width: 800, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {['Next.js', 'React Native + Expo', 'PostgreSQL', 'OpenAI'].map((nome, i) => (
              <Pilula key={nome} quadro={quadro} inicio={M.pilha[i]} tamanho={30} cor={CORES.texto}>{nome}</Pilula>
            ))}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
