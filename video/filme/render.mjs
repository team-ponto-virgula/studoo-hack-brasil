// render.mjs [--de N] [--ate N] [--saida arquivo] [--escala 1] [--crf 16]: renderiza o filme (só a imagem, sem som).
// Antes de renderizar, confere quais falas gravadas existem em public/falas e avisa as cenas.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { browserExecutable, falasGravadas, prepararFilme, raiz } from './preparo.mjs';

prepararFilme();
const opcao = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };

const falas = falasGravadas();
console.log('falas gravadas:', falas);

const id = opcao('composicao', 'Filme');
const saida = path.resolve(opcao('saida', path.join(raiz, '../saida/filme-sem-som.mp4')));
fs.mkdirSync(path.dirname(saida), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(raiz, 'src/index.jsx'), publicDir: path.join(raiz, 'public') });
const composition = await selectComposition({ serveUrl, id, browserExecutable, inputProps: { falas } });
const de = Number(opcao('de', 0));
const ate = Number(opcao('ate', composition.durationInFrames - 1));
const inicio = Date.now();
let ultimo = 0;
await renderMedia({
  composition, serveUrl, codec: 'h264', outputLocation: saida, browserExecutable, frameRange: [de, ate], inputProps: { falas },
  crf: Number(opcao('crf', 16)), pixelFormat: 'yuv420p', imageFormat: 'jpeg', jpegQuality: 95, scale: Number(opcao('escala', 1)),
  concurrency: Number(opcao('paralelo', Math.max(1, os.cpus().length - 1))), muted: true, x264Preset: 'medium', colorSpace: 'bt709',
  chromiumOptions: { gl: 'swangle' },
  onProgress: ({ renderedFrames, encodedFrames }) => {
    if (Date.now() - ultimo < 20000) return;
    ultimo = Date.now();
    const s = (Date.now() - inicio) / 1000;
    console.log(`${renderedFrames}/${ate - de + 1} quadros desenhados, ${encodedFrames} codificados, ${s.toFixed(0)} s (${(renderedFrames / s).toFixed(1)} q/s)`);
  },
});
console.log(`pronto: ${saida} em ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
