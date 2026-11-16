// foto.mjs <composição>:<quadro,quadro,...> [...]: renderiza quadros soltos para conferência e junta cada composição
// numa folha de contato (saida-fotos/<composição>-folha.jpg). COLUNAS e LARGURA ajustam a folha.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { FFMPEG, browserExecutable, falasGravadas, prepararFilme, raiz } from './preparo.mjs';

prepararFilme();
const destino = path.join(raiz, 'saida-fotos');
fs.mkdirSync(destino, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(raiz, 'src/index.jsx'), publicDir: path.join(raiz, 'public') });
for (const pedido of process.argv.slice(2)) {
  const [id, quadros = '0'] = pedido.split(':');
  const composition = await selectComposition({ serveUrl, id, browserExecutable, inputProps: { falas: falasGravadas() } });
  const arquivos = [];
  for (const q of quadros.split(',').map(Number)) {
    const saida = path.join(destino, `${id}-${String(q).padStart(5, '0')}.jpg`);
    await renderStill({ composition, serveUrl, output: saida, frame: q, browserExecutable, imageFormat: 'jpeg', jpegQuality: 88, scale: Number(process.env.ESCALA || 1), inputProps: { falas: falasGravadas() } });
    arquivos.push(saida);
  }
  const colunas = Math.min(arquivos.length, Number(process.env.COLUNAS || 3));
  const largura = Number(process.env.LARGURA || 640);
  const altura = Math.round((largura * 9) / 16);
  const folha = path.join(destino, `${id}-folha.jpg`);
  if (arquivos.length === 1) { fs.copyFileSync(arquivos[0], folha); console.log(folha); continue; }
  const filtro = `${arquivos.map((_, i) => `[${i}:v]scale=${largura}:${altura}[v${i}]`).join(';')};${arquivos.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${arquivos.length}:layout=${arquivos.map((_, i) => `${(i % colunas) * largura}_${Math.floor(i / colunas) * altura}`).join('|')}:fill=white`;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...arquivos.flatMap((a) => ['-i', a]), '-filter_complex', filtro, '-frames:v', '1', '-q:v', '3', folha]);
  console.log(folha, `(${arquivos.length} quadros)`);
}
