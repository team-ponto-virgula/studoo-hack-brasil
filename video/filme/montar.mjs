// montar.mjs [--cenas a,b,...] [--forcar] [--so-som] [--nome base] [--rapido]: monta o filme inteiro.
//   1. Confere se há falas gravadas em public/falas (julio.mp4, miguel.mp4) e avisa as cenas.
//   2. Renderiza cada cena num arquivo próprio (saida/partes); só refaz as que faltam, as pedidas em --cenas ou todas com --forcar.
//   3. Gera a trilha sonora (audio/trilha.mjs), com a música mais baixa nos espaços de fala quando há fala gravada.
//   4. Junta imagem e som no arquivo final (saida/studoo-lancamento.mp4) e numa versão leve para a web.
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import { FFMPEG, NODE, REPO, browserExecutable, falasGravadas, prepararFilme, raiz } from './preparo.mjs';
import { ATOS, COMPASSO, FPS, ORDEM } from './src/tema.js';

prepararFilme();
const saida = path.join(raiz, '../saida');
const partes = path.join(saida, 'partes');
fs.mkdirSync(partes, { recursive: true });
const tem = (nome) => process.argv.includes(`--${nome}`);
const opcao = (nome, padrao) => { const i = process.argv.indexOf(`--${nome}`); return i > 0 ? process.argv[i + 1] : padrao; };
const pedidas = opcao('cenas', '').split(',').filter(Boolean);

const falas = falasGravadas();
const anterior = fs.existsSync(path.join(saida, 'falas.json')) ? JSON.parse(fs.readFileSync(path.join(saida, 'falas.json'), 'utf8')) : { julio: false, miguel: false };
console.log('falas gravadas:', falas);
// Uma fala que chegou (ou saiu) muda a cena daquele espaço.
for (const quem of ['julio', 'miguel']) if (falas[quem] !== anterior[quem] && !pedidas.includes(quem)) pedidas.push(quem);

const arquivoDa = (ato) => path.join(partes, `${String(ORDEM.indexOf(ato) + 1).padStart(2, '0')}-${ato}.mp4`);
if (!tem('so-som')) {
  const refazer = ORDEM.filter((ato) => tem('forcar') || pedidas.includes(ato) || !fs.existsSync(arquivoDa(ato)));
  if (refazer.length) {
    const serveUrl = await bundle({ entryPoint: path.join(raiz, 'src/index.jsx'), publicDir: path.join(raiz, 'public') });
    const composition = await selectComposition({ serveUrl, id: 'Filme', browserExecutable, inputProps: { falas } });
    const navegador = await openBrowser('chrome', { browserExecutable, chromiumOptions: { gl: 'swangle' } });
    const comeco = Date.now();
    for (const ato of refazer) {
      const de = ATOS[ato][0] * COMPASSO;
      const ate = de + ATOS[ato][1] * COMPASSO - 1;
      const inicio = Date.now();
      const temporario = `${arquivoDa(ato)}.parcial.mp4`;
      await renderMedia({
        composition, serveUrl, codec: 'h264', outputLocation: temporario, browserExecutable, puppeteerInstance: navegador, frameRange: [de, ate], inputProps: { falas },
        crf: 12, pixelFormat: 'yuv420p', imageFormat: 'jpeg', jpegQuality: 96, muted: true, x264Preset: 'veryfast', colorSpace: 'bt709',
        concurrency: Number(opcao('paralelo', Math.max(1, os.cpus().length - 1))), chromiumOptions: { gl: 'swangle' },
      });
      fs.renameSync(temporario, arquivoDa(ato));
      console.log(`cena ${ato}: quadros ${de} a ${ate} em ${((Date.now() - inicio) / 1000).toFixed(0)} s (total ${((Date.now() - comeco) / 60000).toFixed(1)} min)`);
    }
    await navegador.close({ silent: true });
  }
}
fs.writeFileSync(path.join(saida, 'falas.json'), JSON.stringify(falas));

// A trilha: o gerador roda a partir do repositório, porque usa o código de som do próprio app.
const comFalas = falas.julio || falas.miguel;
execFileSync(NODE, ['--import', 'tsx', path.join(raiz, '../audio/trilha.mjs'), ...(comFalas ? ['--falas'] : [])], { cwd: REPO, stdio: 'inherit', env: { ...process.env, STUDOO_REPO: REPO } });
const trilha = path.join(saida, comFalas ? 'trilha-com-falas.wav' : 'trilha.wav');

// Junta as cenas (sem recodificar) e codifica o arquivo final com o som.
const lista = path.join(partes, 'lista.txt');
fs.writeFileSync(lista, ORDEM.map((ato) => `file '${arquivoDa(ato)}'`).join('\n'));
const entradas = ['-f', 'concat', '-safe', '0', '-i', lista, '-i', trilha];
let filtro = '[1:a]anull[som]';
let mapaDeFalas = 0;
const vozes = [];
for (const quem of ['julio', 'miguel']) {
  if (!falas[quem]) continue;
  const comecoMs = Math.round((ATOS[quem][0] * COMPASSO * 1000) / FPS);
  const dura = (ATOS[quem][1] * COMPASSO) / FPS;
  entradas.push('-i', path.join(raiz, 'public/falas', `${quem}.mp4`));
  const n = 2 + mapaDeFalas;
  vozes.push(`[${n}:a]atrim=0:${dura},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-16:TP=-2:LRA=9,afade=t=in:d=0.08,afade=t=out:st=${dura - 0.35}:d=0.35,adelay=${comecoMs}|${comecoMs}[voz${mapaDeFalas}]`);
  mapaDeFalas += 1;
}
if (vozes.length) filtro = `${vozes.join(';')};[1:a]${vozes.map((_, i) => `[voz${i}]`).join('')}amix=inputs=${vozes.length + 1}:normalize=0:duration=first,alimiter=limit=0.94[som]`;
const codificar = (arquivo, crf, preset, audio) => {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...entradas, '-filter_complex', filtro, '-map', '0:v', '-map', '[som]', '-c:v', 'libx264', '-preset', preset, '-crf', String(crf),
    '-pix_fmt', 'yuv420p', '-g', '120', '-bf', '2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', audio, '-ar', '48000',
    '-t', String((ORDEM.reduce((soma, ato) => soma + ATOS[ato][1], 0) * COMPASSO) / FPS), arquivo], { stdio: 'inherit' });
  console.log(`${path.basename(arquivo)}: ${(fs.statSync(arquivo).size / 1e6).toFixed(1)} MB`);
};
// --nome muda o nome do arquivo (para testes); --rapido faz só uma versão leve, depressa.
const nome = opcao('nome', 'studoo-lancamento');
if (tem('rapido')) codificar(path.join(saida, `${nome}.mp4`), 26, 'veryfast', '160k');
else {
  codificar(path.join(saida, `${nome}.mp4`), 17, 'slow', '256k');
  codificar(path.join(saida, `${nome}-web.mp4`), 23, 'medium', '160k');
}
console.log('pronto.');
