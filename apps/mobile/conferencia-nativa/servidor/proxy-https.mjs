// Proxy HTTPS da conferência nativa: termina o TLS numa porta do loopback e repassa ao `next start`, em HTTP, na
// mesma máquina.
//
// Por que existe: o app só aceita API em HTTPS (apps/mobile/src/api-nativa.ts) e o servidor só abre o canal do app
// atrás de HTTPS (validarCanalMobile, em src/servidor/acesso/http.ts). Com STUDOO_PROXY_HTTPS=1, o servidor confia em
// X-Forwarded-Proto e X-Forwarded-Host, como no site publicado atrás do proxy reverso. Aqui os dois cabeçalhos são
// escritos pelo proxy e nunca aceitos de quem chama.
//
// Uso: node proxy-https.mjs --cert local.crt --chave local.key [--porta 3443] [--destino http://localhost:3000]
// Sem dependências. Uma linha por pedido na saída (hora UTC do fim, método, caminho sem a busca, status e tempo), sem
// cabeçalhos nem corpo: "01:23:45.678 GET /api/sessao 200 12ms". Quem chamou desistir antes da resposta (o app fechado
// pelo stopApp de cada fluxo, o tempo limite do app, Cancelar) sai como "499 (quem chamou desistiu)", e não como 502: até
// a execução 45092395865 esse caso aparecia como "502 (servidor fora do ar)" e inflava a conta de quedas do servidor.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { parseArgs } from 'node:util';

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

/** Cabeçalhos que valem só para uma conexão: não seguem adiante. `alt-svc` também não volta: o proxy só fala HTTP/1.1
 *  sobre TLS e não deve anunciar outro protocolo (HTTP/3) ao app. */
const DE_UM_SALTO = new Set(['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'upgrade', 'alt-svc']);
const hora = () => new Date().toISOString().slice(11, 23);

const servidor = https.createServer({ cert: readFileSync(values.cert), key: readFileSync(values.chave) }, (pedido, resposta) => {
  const inicio = performance.now();
  const caminho = (pedido.url ?? '/').split('?')[0];
  const registrar = (status) => console.log(`${hora()} ${pedido.method} ${caminho} ${status} ${Math.round(performance.now() - inicio)}ms`);
  if (pedido.socket.studoo) pedido.socket.studoo.pedidos += 1;
  let desistiu = false;

  const cabecalhos = {};
  for (const [nome, valor] of Object.entries(pedido.headers)) {
    if (valor === undefined || DE_UM_SALTO.has(nome) || nome.startsWith('x-forwarded-')) continue;
    cabecalhos[nome] = valor;
  }
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
    const deVolta = {};
    for (const [nome, valor] of Object.entries(origem.headers)) {
      if (valor !== undefined && !DE_UM_SALTO.has(nome)) deVolta[nome] = valor;
    }
    resposta.writeHead(origem.statusCode ?? 502, deVolta);
    // Sem guardar em memória: a geração ao vivo (NDJSON) chega linha a linha, como chega do servidor.
    origem.pipe(resposta);
    origem.once('end', () => registrar(origem.statusCode ?? 502));
  });

  adiante.once('error', () => {
    if (!resposta.headersSent) {
      resposta.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      resposta.end(JSON.stringify({ codigo: 'falha', mensagem: 'O servidor do Studoo não respondeu ao proxy.' }));
    } else {
      resposta.destroy();
    }
    registrar(desistiu ? '499 (quem chamou desistiu)' : '502 (servidor fora do ar)');
  });
  // Quem chamou desistiu (tempo limite do app, Cancelar, o app fechado): o pedido ao servidor também para.
  resposta.once('close', () => { if (!resposta.writableEnded) { desistiu = true; adiante.destroy(); } });
  pedido.pipe(adiante);
});

// As conexões, para separar "o pedido não chegou" de "o servidor demorou" (Lead, 23/11; execuções 45081962231 e
// 45098802867: o login do iPhone pendurou 15 s e o POST não apareceu aqui). Uma linha quando a conexão TCP chega, quando
// o TLS fecha o aperto de mão e quando ela fecha, com a hora UTC: "conexão #7 fechada depois de 15.2 s, sem TLS concluído,
// 0 pedidos" diz que o app parou antes de mandar o pedido (no caso acima, a avaliação de confiança do certificado no
// simulador não voltou). O resumo da coleta conta as conexões sem TLS concluído.
let conexoes = 0;
servidor.on('connection', (socket) => {
  conexoes += 1;
  const dados = { n: conexoes, inicio: performance.now(), tls: false, pedidos: 0 };
  socket.studooTcp = dados;
  console.log(`${hora()} conexão #${dados.n} aberta (tcp)`);
  socket.once('close', () => console.log(`${hora()} conexão #${dados.n} fechada depois de ${((performance.now() - dados.inicio) / 1000).toFixed(1)} s, ${dados.tls ? 'com TLS' : 'sem TLS concluído'}, ${dados.pedidos} pedido(s)`));
});
servidor.on('secureConnection', (tls) => {
  const dados = tls._parent?.studooTcp ?? tls.studooTcp;
  if (!dados) return;
  dados.tls = true;
  tls.studoo = dados;
  console.log(`${hora()} conexão #${dados.n} com TLS em ${Math.round(performance.now() - dados.inicio)} ms (${tls.alpnProtocol || 'http/1.1'})`);
});
servidor.on('tlsClientError', (erro, tls) => {
  const dados = tls?._parent?.studooTcp ?? tls?.studooTcp;
  console.log(`${hora()} conexão #${dados?.n ?? '?'} com erro no TLS: ${erro.code ?? erro.message}`);
});
// Conexão ociosa aberta por mais tempo que o padrão do Node (5 s): o iOS reaproveita conexões paradas por mais tempo, e um
// POST mandado numa conexão que o servidor acabou de fechar não é repetido pelo sistema.
servidor.keepAliveTimeout = 75_000;
servidor.headersTimeout = 80_000;

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
