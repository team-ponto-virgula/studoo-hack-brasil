/** Servidor de leitura para as propostas isoladas; não expõe a raiz do repositório. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const proposals = fileURLToPath(new URL('../../docs/ux/propostas/', import.meta.url));
const brand = fileURLToPath(new URL('../../public/marca/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json'
};
const port = Number(process.env.QA_DIRECOES_PORT || 8084);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Porta inválida.');
createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const isBrand = route.startsWith('/marca/');
    const root = isBrand ? brand : proposals;
    const relative = isBrand ? route.slice('/marca/'.length) : route === '/' ? 'index.html' : route.slice(1);
    const file = resolve(root, relative);
    const mime = types[extname(file)];
    if (!file.startsWith(resolve(root) + sep) || !mime) throw new Error('caminho inválido');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': mime,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8'
    });
    res.end('Não encontrado.');
  }
}).listen(port, '0.0.0.0', () => console.log(`Propostas de UI: http://localhost:${port}`));
