// Publica os clipes para o filme: gera as cópias de trabalho em 2x (leves para renderizar), liga os originais em 3x
// (para os planos fechados) e escreve filme/src/clipes.js com os quadros, os toques e as marcas de cada clipe.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import ambiente from '../ambiente.cjs';

const { FFMPEG } = ambiente;
const origem = path.join(import.meta.dirname, 'clipes');
const destino = path.join(import.meta.dirname, '../filme/public/clipes');
fs.mkdirSync(destino, { recursive: true });
const manifesto = {};
for (const arquivo of fs.readdirSync(origem).filter((n) => n.endsWith('.json')).sort()) {
  const dados = JSON.parse(fs.readFileSync(path.join(origem, arquivo), 'utf8'));
  if (dados.nome.startsWith('_')) continue;
  const mp4 = path.join(origem, `${dados.nome}.mp4`);
  const leve = path.join(destino, `${dados.nome}.mp4`);
  const alta = path.join(destino, `${dados.nome}.3x.mp4`);
  const idade = fs.statSync(mp4).mtimeMs;
  if (!fs.existsSync(leve) || fs.statSync(leve).mtimeMs < idade) {
    const fator = 2 / dados.escala;
    const largura = Math.round((dados.largura * dados.escala * fator) / 2) * 2;
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `scale=${largura}:-2:flags=lanczos`, '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '13',
      '-pix_fmt', 'yuv420p', '-g', '12', '-bf', '0', '-movflags', '+faststart', leve]);
  }
  if (!fs.existsSync(alta) || fs.statSync(alta).mtimeMs < idade) fs.copyFileSync(mp4, alta);
  // Toques: junta "toque" (dedo chegando), "aperta" e "solta" num registro só.
  const toques = [];
  for (const [i, ev] of dados.eventos.entries()) {
    if (ev.tipo !== 'toque') continue;
    const aperta = dados.eventos.slice(i + 1).find((e) => e.tipo === 'aperta');
    const solta = dados.eventos.slice(i + 1).find((e) => e.tipo === 'solta');
    toques.push({ q0: ev.q, q1: aperta ? aperta.q : ev.q + 10, q2: solta ? solta.q : ev.q + 16, x: ev.x, y: ev.y, rotulo: ev.rotulo ?? '' });
  }
  manifesto[dados.nome] = {
    quadros: dados.quadros, largura: dados.largura, altura: dados.altura, escala: dados.escala, toques,
    marcas: dados.eventos.filter((e) => !['toque', 'aperta', 'solta', 'tecla', 'cursor', 'clique', 'clique-solta'].includes(e.tipo)),
    // Computador: o caminho do ponteiro, quadro a quadro, e os cliques.
    cursor: dados.eventos.filter((e) => e.tipo === 'cursor').map((e) => [e.q, e.x, e.y]),
    cliques: dados.eventos.filter((e) => e.tipo === 'clique').map((e) => ({ q0: e.q, q1: (dados.eventos.find((s) => s.tipo === 'clique-solta' && s.q >= e.q) ?? e).q, x: e.x, y: e.y })),
    teclas: dados.eventos.filter((e) => e.tipo === 'tecla').map((e) => e.q),
  };
}
// O manifesto é um módulo: as cenas (no navegador) e a trilha sonora (no Node) leem o mesmo arquivo.
fs.writeFileSync(path.join(import.meta.dirname, '../filme/src/clipes.js'), `// Gerado por captura/publicar.mjs. Não edite.\nexport default ${JSON.stringify(manifesto)};\n`);
console.log(Object.entries(manifesto).map(([n, d]) => `${n}:${d.quadros}`).join('  '));
