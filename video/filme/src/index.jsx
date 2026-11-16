import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { carregarFontes } from './fontes.js';
import { CENAS, Filme } from './Filme.jsx';
import { duracaoDe } from './tempos.js';
import { ALTURA, FPS, LARGURA, ORDEM, SOBRA, TOTAL_QUADROS } from './tema.js';

carregarFontes();

const Raiz = () => (
  <>
    <Composition id="Filme" component={Filme} durationInFrames={TOTAL_QUADROS} fps={FPS} width={LARGURA} height={ALTURA} />
    {ORDEM.map((ato) => (
      <Composition key={ato} id={`cena-${ato}`} component={CENAS[ato].cena} durationInFrames={duracaoDe(ato) + SOBRA} fps={FPS} width={LARGURA} height={ALTURA} />
    ))}
  </>
);
registerRoot(Raiz);
