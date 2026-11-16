import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Cortina, Iris } from './componentes/Transicao.jsx';
import { Abertura } from './cenas/Abertura.jsx';
import { Assuntos } from './cenas/Assuntos.jsx';
import { Erro } from './cenas/Erro.jsx';
import { Fecho } from './cenas/Fecho.jsx';
import { Julio } from './cenas/Julio.jsx';
import { Licao } from './cenas/Licao.jsx';
import { Material } from './cenas/Material.jsx';
import { Miguel } from './cenas/Miguel.jsx';
import { Pedido } from './cenas/Pedido.jsx';
import { Pratica } from './cenas/Pratica.jsx';
import { Revelacao } from './cenas/Revelacao.jsx';
import { WebApp } from './cenas/WebApp.jsx';
import { duracaoDe, inicioDe } from './tempos.js';
import { CORES, ORDEM, SOBRA } from './tema.js';

/** Cada cena, com a transição que a traz. */
export const CENAS = {
  abertura: { cena: Abertura },
  julio: { cena: Julio },
  revelacao: { cena: Revelacao, entra: (filhos) => <Iris x={960} y={600} cor={CORES.ouro} dura={34}>{filhos}</Iris> },
  pedido: { cena: Pedido, entra: (filhos) => <Cortina cores={[CORES.acao, CORES.ouro]} sentido={1}>{filhos}</Cortina> },
  licao: { cena: Licao, entra: (filhos) => <Cortina cores={[CORES.sucessoClaro, '#fff']} sentido={-1}>{filhos}</Cortina> },
  erro: { cena: Erro, entra: (filhos) => <Cortina cores={[CORES.acao, '#b6b3df']} sentido={1}>{filhos}</Cortina> },
  pratica: { cena: Pratica, entra: (filhos) => <Cortina cores={[CORES.ouro, '#fff']} sentido={-1}>{filhos}</Cortina> },
  assuntos: { cena: Assuntos, entra: (filhos) => <Cortina cores={[CORES.acao, CORES.ouro]} sentido={1}>{filhos}</Cortina> },
  material: { cena: Material, entra: (filhos) => <Cortina cores={['#86c1f4', '#fff']} sentido={-1}>{filhos}</Cortina> },
  webApp: { cena: WebApp, entra: (filhos) => <Cortina cores={[CORES.acao, CORES.ouro]} sentido={1}>{filhos}</Cortina> },
  miguel: { cena: Miguel, entra: (filhos) => <Iris x={1410} y={540} cor={CORES.ouro} dura={30}>{filhos}</Iris> },
  fecho: { cena: Fecho, entra: (filhos) => <Iris x={960} y={560} cor={CORES.ouro} dura={34}>{filhos}</Iris> },
};

/** O filme inteiro: as cenas em sequência; cada uma continua um instante por baixo da transição da próxima. */
export function Filme() {
  return (
    <AbsoluteFill style={{ background: CORES.noite }}>
      {ORDEM.map((ato) => {
        const { cena: Cena, entra } = CENAS[ato];
        const conteudo = <Cena />;
        return (
          <Sequence key={ato} name={ato} from={inicioDe(ato)} durationInFrames={duracaoDe(ato) + SOBRA}>
            {entra ? entra(conteudo) : conteudo}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
