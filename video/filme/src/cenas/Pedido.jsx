import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { Aparelho } from '../componentes/Aparelho.jsx';
import { clipe } from '../componentes/Celular.jsx';
import { Confete } from '../componentes/Confete.jsx';
import { Paisagem } from '../componentes/Mundo.jsx';
import { Nota } from '../componentes/Nota.jsx';
import { Palavras, Pilula } from '../componentes/Texto.jsx';
import { CURVA, mola, molaFirme, rampa } from '../movimento.js';
import { MOMENTOS, trechoAtivo } from '../tempos.js';
import { CORES, FONTE } from '../tema.js';

const M = MOMENTOS.pedido;
const PEDIDO = 'Quero aprender violão do zero';
const Ponto = ({ cor }) => <span style={{ width: '0.5em', height: '0.5em', borderRadius: '50%', background: cor, display: 'inline-block' }} />;

/** O pedido (6 compassos): você diz o que quer aprender, e a trilha aparece. A gravação passa em tempo real. */
export function Pedido() {
  const quadro = useCurrentFrame();
  const info = clipe('pedido');
  const { q } = trechoAtivo('pedido', quadro);
  const letras = info.teclas.filter((tecla) => tecla <= q).length;

  const entra = molaFirme(quadro, 2, { damping: 20, stiffness: 120 });
  const paraOCentro = rampa(quadro, M.centro, M.centro + 54, 0, 1, CURVA.camera);
  const flutua = Math.sin(quadro / 46) * 8;
  const x = 1490 - paraOCentro * 90;
  const pilula = mola(quadro, 66, { damping: 14, stiffness: 170 });
  const pilulaSai = rampa(quadro, M.centro - 12, M.centro + 14, 0, 1, CURVA.camera);
  const batida = quadro >= M.pronto ? 0.03 * Math.exp(-(quadro - M.pronto) / 10) : 0;

  return (
    <AbsoluteFill>
      <Paisagem quadro={quadro + 400} regiao="campos" altura={0.2} />
      <div style={{ position: 'absolute', left: 130, top: 190 }}>
        <Palavras quadro={quadro} inicio={M.titulo1} sai={M.centro - 16} linhas={['Você diz', 'o que quer aprender.']} tamanho={104} cores={{ L1: CORES.acao }} />
      </div>
      <div style={{ position: 'absolute', left: 130, top: 190 }}>
        <Palavras quadro={quadro} inicio={M.titulo2} linhas={['E a trilha', 'se monta.']} tamanho={124} cores={{ L1: CORES.acao }} />
      </div>

      {/* O pedido, grande, se escrevendo junto com o campo do celular; depois vai para dentro dele. */}
      <div style={{
        position: 'absolute', left: 130 + pilulaSai * 1010, top: 478 - pilulaSai * 70, transformOrigin: '0% 50%',
        transform: `scale(${pilula * (1 - pilulaSai * 0.72)})`, opacity: Math.min(1, pilula * 2) * (1 - rampa(quadro, M.centro, M.centro + 14)),
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', minWidth: 300, height: 124, padding: '0 44px', borderRadius: 40, background: '#fff',
          border: `6px solid ${CORES.acao}`, boxShadow: `0 12px 0 ${CORES.gelo}, 0 34px 60px -24px rgba(27,42,94,0.45)`,
          font: `800 52px ${FONTE.corpo}`, color: CORES.texto, whiteSpace: 'nowrap',
        }}>
          {PEDIDO.slice(0, letras)}
          <span style={{ width: 5, height: 62, marginLeft: 4, borderRadius: 3, background: CORES.acao, opacity: Math.floor(quadro / 16) % 2 || letras < PEDIDO.length ? 1 : 0 }} />
        </div>
      </div>

      <div style={{ position: 'absolute', left: 134, top: 520, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20 }}>
        <Pilula quadro={quadro} inicio={M.etiquetas[0]} tamanho={40}><Ponto cor={CORES.acao} />Lições curtas</Pilula>
        <Pilula quadro={quadro} inicio={M.etiquetas[1]} tamanho={40}><Ponto cor={CORES.sucessoClaro} />Na ordem certa</Pilula>
        <Pilula quadro={quadro} inicio={M.etiquetas[2]} tamanho={40}><Ponto cor={CORES.ouroEscuro} />Com revisão no caminho</Pilula>
      </div>
      <div style={{ position: 'absolute', left: 134, top: 846 }}>
        <Pilula quadro={quadro} inicio={M.pronto} tamanho={48} fundo={CORES.acao} cor="#fff">Trilha pronta: 6 lições</Pilula>
      </div>

      <Aparelho cena="pedido" quadro={quadro} x={x} y={540 + (1 - entra) * 700 + flutua} tela={850} escala={1 + paraOCentro * 0.04 + batida}
        giro={[6 - paraOCentro * 5 + (1 - entra) * 20, -16 + paraOCentro * 14, 3 - paraOCentro * 3]} />
      <Confete quadro={quadro - M.pronto} x={x} y={360} pecas={90} forca={0.95} semente={11} />
      <Nota />
    </AbsoluteFill>
  );
}
