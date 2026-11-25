// Proxy HTTPS da conferência nativa: termina o TLS numa porta do loopback e repassa ao `next start`, em HTTP, na
// mesma máquina.
//
// Por que existe: o app só aceita API em HTTPS (apps/mobile/src/api-nativa.ts) e o servidor só abre o canal do app
// atrás de HTTPS (validarCanalMobile, em src/servidor/acesso/http.ts). Com STUDOO_PROXY_HTTPS=1, o servidor confia em
// X-Forwarded-Proto e X-Forwarded-Host, como no site publicado atrás do proxy reverso. Aqui os dois cabeçalhos são
// escritos pelo proxy e nunca aceitos de quem chama.
//
// Uso: node proxy-https.mjs --cert local.crt --chave local.key [--porta 3443] [--destino http://localhost:3000]
// Sem dependências. O resumo traz método, caminho sem a busca, status e tempo, sem cabeçalhos nem corpo.
// CONFERENCIA_RASTREAR_API=1 acrescenta a conexão TLS e as etapas HTTP dos caminhos em rastreio-api.mjs.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { parseArgs } from 'node:util';
import { CABECALHO_RASTREIO, CAMINHOS_RASTREADOS, registrarRede } from './rastreio-api.mjs';

const { values } = parseArgs({
  options: {
    cert: { type: 'string' },
    chave: { type: 'string' },
    porta: { type: 'string', default: '3443' },
    destino: { type: 'string', default: 'http://localhost:3000' },
  },
});

if (!values.cert || !values.chave) {
  console.error('Uso: node proxy-https.mjs --cert <arquivo.crt> --chave <arquivo.key> [--porta 3443] [--destino http://localhost:3000]');
  process.exit(2);
}

const destino = new URL(values.destino);
if (destino.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(destino.hostname)) {
  console.error('O destino precisa ser HTTP no próprio computador (localhost, 127.0.0.1 ou [::1]).');
  process.exit(2);
}
const porta = Number(values.porta);
const rastrear = process.env.CONFERENCIA_RASTREAR_API === '1';
let numeroDoPedido = 0;

/** Cabeçalhos que valem só para uma conexão: não seguem adiante. */
const DE_UM_SALTO = new Set(['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'upgrade']);

const servidor = https.createServer({ cert: readFileSync(values.cert), key: readFileSync(values.chave) }, (pedido, resposta) => {
  const inicio = performance.now();
  const caminho = (pedido.url ?? '/').split('?')[0];
  const registrar = (status) => console.log(`${pedido.method} ${caminho} ${status} ${Math.round(performance.now() - inicio)}ms`);
  const id = rastrear && CAMINHOS_RASTREADOS.has(caminho) ? String(++numeroDoPedido) : undefined;
  const dados = { id, metodo: pedido.method, caminho, portaCliente: pedido.socket.remotePort };
  const rastrearPedido = (etapa, extras) => {
    if (id) registrarRede('proxy', etapa, { ...dados, ...extras });
  };
  rastrearPedido('pedido_recebido');

  const cabecalhos = {};
  for (const [nome, valor] of Object.entries(pedido.headers)) {
    if (valor === undefined || nome === CABECALHO_RASTREIO || DE_UM_SALTO.has(nome) || nome.startsWith('x-forwarded-')) continue;
    cabecalhos[nome] = valor;
  }
  if (id) cabecalhos[CABECALHO_RASTREIO] = id;
  cabecalhos['x-forwarded-proto'] = 'https';
  cabecalhos['x-forwarded-host'] = pedido.headers.host ?? `127.0.0.1:${porta}`;
  cabecalhos['x-forwarded-for'] = '127.0.0.1';

  const adiante = http.request({
    hostname: destino.hostname.replace(/^\[|\]$/g, ''),
    port: destino.port || 80,
    method: pedido.method,
    path: pedido.url,
    headers: cabecalhos,
  }, (origem) => {
    rastrearPedido('cabecalhos_da_api', { status: origem.statusCode });
    const deVolta = {};
    for (const [nome, valor] of Object.entries(origem.headers)) {
      if (valor !== undefined && !DE_UM_SALTO.has(nome)) deVolta[nome] = valor;
    }
    resposta.writeHead(origem.statusCode ?? 502, deVolta);
    // Sem guardar em memória: a geração ao vivo (NDJSON) chega linha a linha, como chega do servidor.
    origem.pipe(resposta);
    origem.once('end', () => registrar(origem.statusCode ?? 502));
  });

  adiante.once('error', (erro) => {
    if (id && resposta.destroyed) return;
    rastrearPedido('erro_ao_encaminhar', { codigo: erro.code });
    if (!resposta.headersSent) {
      resposta.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      resposta.end(JSON.stringify({ codigo: 'falha', mensagem: 'O servidor do Studoo não respondeu ao proxy.' }));
    } else {
      resposta.destroy();
    }
    registrar('502 (servidor fora do ar)');
  });
  resposta.once('finish', () => rastrearPedido('resposta_entregue_ao_socket', { status: resposta.statusCode }));
  // Quem chamou desistiu (tempo limite do app, Cancelar): o pedido ao servidor também para.
  resposta.once('close', () => {
    if (!resposta.writableFinished) rastrearPedido('conexao_encerrada_antes_da_resposta');
    if (!resposta.writableEnded) adiante.destroy();
  });
  pedido.pipe(adiante);
});

if (rastrear) {
  servidor.on('connection', (socket) => {
    const portaCliente = socket.remotePort;
    registrarRede('proxy', 'tcp_aceito', { portaCliente });
    socket.once('close', () => registrarRede('proxy', 'tcp_fechado', { portaCliente }));
  });
  servidor.on('secureConnection', (socket) => registrarRede('proxy', 'tls_negociado', { portaCliente: socket.remotePort }));
  servidor.on('tlsClientError', (erro, socket) => registrarRede('proxy', 'tls_erro', { portaCliente: socket.remotePort, codigo: erro.code }));
}

servidor.once('error', (erro) => {
  console.error(`O proxy HTTPS não subiu na porta ${porta}: ${erro.code ?? erro.message}`);
  process.exit(1);
});
servidor.listen(porta, '127.0.0.1', () => {
  console.log(`Proxy HTTPS em https://127.0.0.1:${porta} -> ${destino.origin}`);
});

for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.once(sinal, () => servidor.close(() => process.exit(0)));
}
