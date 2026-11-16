import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho, Recorte } from '../componentes/Aparelho.jsx';
import { clipe } from '../componentes/Celular.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { CURVA, mix, mola, rampa } from '../movimento.js';
import { MOMENTOS } from '../tempos.js';
import { CORES } from '../tema.js';

const M = MOMENTOS.assuntos;
const FILA = [
  ['assunto-culinaria', 'Culinária', '#e58a1f'],
  ['assunto-historia-mapa', 'História', '#7c5fd6'],
  ['ingles-conceito', 'Inglês', CORES.acao],
  ['assunto-fracoes', 'Frações', CORES.sucessoClaro],
  ['assunto-fotografia-mapa', 'Fotografia', '#e5536c'],
];

/** Qualquer assunto (4 compassos): cinco trilhas lado a lado; depois, a resposta aberta de inglês e o que a correção procurou. */
export function Assuntos() {
  const quadro = useCurrentFrame();
  const perto = rampa(quadro, M.aproxima, M.aproxima + 46, 0, 1, CURVA.camera);
  const carta = mola(quadro, M.correcao, { damping: 13, stiffness: 150 });
  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 900} regiao="nuvens" altura={0.16} sol={false} enfeites={false} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 54, display: 'flex', justifyContent: 'center' }}>
        <Palavras quadro={quadro} inicio={M.titulo} sai={M.aproxima - 16} linhas={['Qualquer assunto.']} tamanho={124} alinhar="centro" cores={{ assunto: CORES.acao }} passo={5} />
      </div>
      {FILA.map(([nome, rotulo, cor], i) => {
        const e = mola(quadro, M.celulares[i], { damping: 12, stiffness: 140, mass: 0.8 });
        const info = clipe(nome);
        const q = Math.min(info.quadros - 1, Math.max(0, (quadro - M.celulares[i]) * 0.6));
        const centro = i === 2;
        const sai = centro ? 0 : rampa(quadro, M.aproxima - 8 + Math.abs(i - 2) * 3, M.aproxima + 30 + Math.abs(i - 2) * 3, 0, 1, CURVA.saida);
        const x = 960 + (i - 2) * 336;
        const flutua = Math.sin((quadro + i * 40) / 40) * 7;
        return (
          <React.Fragment key={nome}>
            {(!centro || quadro < M.aproxima + 4) && (
              <div style={{ position: 'absolute', left: x - 160, width: 320, top: 250 + (1 - e) * -60 - sai * 200, display: 'flex', justifyContent: 'center', opacity: (1 - sai) * (centro ? 1 - rampa(quadro, M.aproxima - 10, M.aproxima) : 1) }}>
                <Pilula quadro={quadro} inicio={M.celulares[i] + 8} tamanho={34} fundo={cor} cor="#fff">{rotulo}</Pilula>
              </div>
            )}
            {centro ? (
              <Aparelho cena={quadro >= M.aproxima ? 'assuntos' : undefined} nome={nome} q={q} quadro={quadro}
                x={mix(x, 1400, perto)} y={mix(650 + (1 - e) * 900, 556, perto) + flutua} tela={mix(560, 850, perto)}
                giro={[4, mix(0, -15, perto), mix(0, 2, perto)]} cortes={[M.aproxima]} />
            ) : (
              <Aparelho nome={nome} q={q} x={x + (i - 2) * sai * 500} y={650 + (1 - e) * 900 + flutua + sai * 900} tela={560}
                giro={[4, (2 - i) * 9, (i - 2) * 1.5 + sai * (i - 2) * 14]} toques={false} />
            )}
          </React.Fragment>
        );
      })}

      <div style={{ position: 'absolute', left: 130, top: 150 }}>
        <Palavras quadro={quadro} inicio={M.aproxima + 40} linhas={['A correção mostra', 'o que faltou.']} tamanho={96} cores={{ L1: CORES.acao }} />
      </div>
      {quadro >= M.correcao && (
        <div style={{ position: 'absolute', left: 130, top: 420, transformOrigin: '0% 0%', transform: `scale(${0.7 + 0.3 * carta}) rotate(${-2 + carta}deg)`, opacity: Math.min(1, carta * 1.5) }}>
          <Recorte nome="ingles-erro" quadro={420} area={{ x: 42, y: 152, l: 306, a: 224 }} largura={700} borda={CORES.gelo} />
        </div>
      )}
      <Nota />
    </AbsoluteFill>
  );
}
