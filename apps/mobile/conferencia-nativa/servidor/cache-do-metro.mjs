// Cache na frente do Metro, só durante a conferência nativa.
//
// Por que existe: a cada abertura (cada fluxo de telas reabre o app), o Expo Go pede o pacote do app de novo, e o Metro o
// refaz a cada pedido. Com o bytecode do Hermes, que o Expo sempre pede fora do modo de desenvolvimento, isso levou de 7 a
// 73 s numa máquina de 3 CPUs, disputando a CPU com o simulador. Na execução 44511779137, um pedido passou do tempo do Expo
// Go: a tela vermelha "Could not connect to development server" derrubou o fluxo 35. O código não muda durante a
// conferência, então o primeiro pacote de cada endereço fica guardado em memória e volta pronto nas aberturas seguintes.
// O resto (manifesto, recursos, /status, WebSocket) passa direto.
//
// Uso: node cache-do-metro.mjs [--porta 8081] [--destino 8082]
// Sem dependências. Uma linha por pedido de pacote na saída (guardado ou do Metro, tamanho e tempo).
import http from 'node:http';
import net from 'node:net';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    porta: { type: 'string', default: '8081' },
    destino: { type: 'string', default: '8082' },
  },
});
const porta = Number(values.porta);
const destino = Number(values.destino);
// O Metro escuta em localhost; o Node escolhe o endereço (IPv4 ou IPv6) que responder.
const HOST_DO_METRO = 'localhost';

/** Cabeçalhos que valem só para uma conexão (ou que mudam ao guardar): não seguem adiante. */
const DE_UM_SALTO = new Set(['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'upgrade', 'transfer-encoding', 'content-length']);
/** O pacote do app (e o bytecode): `…/entry.bundle?platform=ios&…`. */
const ehPacote = (endereco = '') => /\.(bundle|hbc)(\?|$)/.test(endereco);
const guardados = new Map();
const agora = () => new Date().toISOString().slice(11, 19);
const curto = (endereco) => endereco.split('?')[0];

const servidor = http.createServer((pedido, resposta) => {
  const pacote = pedido.method === 'GET' && ehPacote(pedido.url);
  // O mesmo endereço volta em duas formas: com o andamento (multipart/mixed, que o app mostra enquanto baixa) e simples.
  const chave = `${pedido.url}|${/multipart\/mixed/.test(pedido.headers.accept ?? '') ? 'multipart' : 'simples'}`;
  const guardado = pacote ? guardados.get(chave) : undefined;
  if (guardado) {
    resposta.writeHead(guardado.status, { ...guardado.cabecalhos, 'content-length': guardado.corpo.length });
    resposta.end(guardado.corpo);
    console.log(`${agora()} guardado ${guardado.corpo.length} bytes ${chave.split('|')[1]} ${curto(pedido.url)}`);
    return;
  }

  const inicio = Date.now();
  const cabecalhos = Object.fromEntries(Object.entries(pedido.headers).filter(([nome]) => !DE_UM_SALTO.has(nome)));
  const ida = http.request({ host: HOST_DO_METRO, port: destino, method: pedido.method, path: pedido.url, headers: cabecalhos }, (volta) => {
    const status = volta.statusCode ?? 502;
    const deVolta = Object.fromEntries(Object.entries(volta.headers).filter(([nome]) => !DE_UM_SALTO.has(nome)));
    resposta.writeHead(status, deVolta);
    const guardar = pacote && status === 200;
    const partes = [];
    volta.on('data', (parte) => {
      if (guardar) partes.push(parte);
      resposta.write(parte);
    });
    volta.on('end', () => {
      resposta.end();
      if (!pacote) return;
      if (guardar) guardados.set(chave, { status, cabecalhos: deVolta, corpo: Buffer.concat(partes) });
      console.log(`${agora()} do Metro ${status} em ${Date.now() - inicio} ms${guardar ? `, ${Buffer.concat(partes).length} bytes guardados` : ''} ${chave.split('|')[1]} ${curto(pedido.url)}`);
    });
    volta.on('error', () => resposta.destroy());
  });
  ida.on('error', (falha) => {
    console.log(`${agora()} Metro não respondeu (${falha.code ?? falha.message}) ${curto(pedido.url ?? '')}`);
    if (!resposta.headersSent) resposta.writeHead(502);
    resposta.end();
  });
  pedido.pipe(ida);
});

// WebSocket e outros pedidos de troca de protocolo: passam direto, byte a byte.
servidor.on('upgrade', (pedido, conexao, cabeca) => {
  const metro = net.connect({ host: HOST_DO_METRO, port: destino }, () => {
    const linhas = [`${pedido.method} ${pedido.url} HTTP/${pedido.httpVersion}`];
    for (let i = 0; i < pedido.rawHeaders.length; i += 2) linhas.push(`${pedido.rawHeaders[i]}: ${pedido.rawHeaders[i + 1]}`);
    metro.write(`${linhas.join('\r\n')}\r\n\r\n`);
    if (cabeca?.length) metro.write(cabeca);
    conexao.pipe(metro).pipe(conexao);
  });
  metro.on('error', () => conexao.destroy());
  conexao.on('error', () => metro.destroy());
});

servidor.keepAliveTimeout = 65_000;
servidor.listen(porta, '127.0.0.1', () => console.log(`${agora()} cache do Metro em http://127.0.0.1:${porta}, Metro em localhost:${destino}`));
