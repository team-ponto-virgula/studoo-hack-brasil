// O que os scripts do filme dividem: as ferramentas (ambiente.cjs), o navegador do Remotion e o que vem do app
// (as fontes e os desenhos do mapa).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ambiente from '../ambiente.cjs';

export const { FFMPEG, NODE, REPO } = ambiente;
/** O Chrome do Remotion: o do ambiente, se houver; sem ele, o Remotion baixa o seu. */
export const browserExecutable = ambiente.CHROME || undefined;
if (ambiente.CHROME_LIBS) process.env.LD_LIBRARY_PATH = [ambiente.CHROME_LIBS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

export const raiz = import.meta.dirname;

/** Quais falas gravadas existem em public/falas. Sem o arquivo, a cena mostra o espaço reservado, com a sugestão de fala. */
export function falasGravadas() {
  return { julio: fs.existsSync(path.join(raiz, 'public/falas/julio.mp4')), miguel: fs.existsSync(path.join(raiz, 'public/falas/miguel.mp4')) };
}

/** As fontes do filme são as do app (Quicksand e Nunito, licença OFL): copia do repositório se ainda não estiverem aqui. */
export function garantirFontes() {
  const destino = path.join(raiz, 'public/fontes');
  fs.mkdirSync(destino, { recursive: true });
  for (const nome of ['Quicksand.ttf', 'Nunito.ttf']) {
    const arquivo = path.join(destino, nome);
    if (!fs.existsSync(arquivo)) fs.copyFileSync(path.join(REPO, 'apps/mobile/assets/fontes', nome), arquivo);
  }
}

/**
 * Os desenhos do cenário (árvores, casas, nuvens) são os do mapa do app: src/ui/mundo-desenhos.ts, convertido para
 * JavaScript sem os tipos. Refaz a cópia quando ela falta ou quando o original mudou.
 */
export function garantirDesenhos() {
  const origem = path.join(REPO, 'src/ui/mundo-desenhos.ts');
  const destino = path.join(raiz, 'src/mundo-desenhos.js');
  if (fs.existsSync(destino) && fs.statSync(destino).mtimeMs >= fs.statSync(origem).mtimeMs) return;
  execFileSync(path.join(REPO, 'node_modules/.bin/esbuild'), [origem, '--format=esm', `--outfile=${destino}`, '--log-level=warning'], { stdio: 'inherit' });
}

/** Tudo o que o filme pega do repositório do app, de uma vez. */
export function prepararFilme() {
  conferirClipes();
  garantirFontes();
  garantirDesenhos();
}

/** Confere que os clipes gravados estão publicados (captura/publicar.mjs) antes de montar o filme. */
export function conferirClipes() {
  if (!fs.existsSync(path.join(raiz, 'src/clipes.js'))) {
    throw new Error('Faltam as gravações do app. Rode os roteiros de captura (captura/fila.sh) e depois captura/publicar.mjs.');
  }
}
