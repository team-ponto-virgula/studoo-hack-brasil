'use strict';
// Servidor simples para assistir ao filme pelo túnel: arquivos estáticos com suporte a Range (para o vídeo avançar e voltar).
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(process.argv[2] || __dirname);
const PORTA = Number(process.env.PORT || 4123);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8',
};

http.createServer((req, res) => {
  let caminho;
  try { caminho = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  const arquivo = path.resolve(RAIZ, `.${caminho === '/' ? '/assistir.html' : caminho}`);
  if (arquivo !== RAIZ && !arquivo.startsWith(RAIZ + path.sep)) { res.writeHead(403); return res.end('Proibido'); }
  let info;
  try { info = fs.statSync(arquivo); } catch { info = null; }
  if (!info || !info.isFile()) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
  const cabecalhos = {
    'content-type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream', 'accept-ranges': 'bytes',
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
  };
  const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (req.headers.range && !faixa) { res.writeHead(416, { 'content-range': `bytes */${info.size}` }); return res.end(); }
  if (faixa) {
    let inicio = faixa[1] ? Number(faixa[1]) : Math.max(0, info.size - Number(faixa[2] || 0));
    let fim = faixa[1] && faixa[2] ? Math.min(Number(faixa[2]), info.size - 1) : info.size - 1;
    if (!faixa[1]) fim = info.size - 1;
    if (inicio > fim || inicio >= info.size) { res.writeHead(416, { 'content-range': `bytes */${info.size}` }); return res.end(); }
    res.writeHead(206, { ...cabecalhos, 'content-range': `bytes ${inicio}-${fim}/${info.size}`, 'content-length': fim - inicio + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(arquivo, { start: inicio, end: fim }).pipe(res);
  }
  res.writeHead(200, { ...cabecalhos, 'content-length': info.size });
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(arquivo).pipe(res);
}).listen(PORTA, '127.0.0.1', () => console.log(`servindo ${RAIZ} em http://127.0.0.1:${PORTA}`));
