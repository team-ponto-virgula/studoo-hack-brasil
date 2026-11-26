// Proxy HTTPS da conferência nativa: termina o TLS numa porta do loopback e repassa ao `next start`, em HTTP, na
// mesma máquina.
//
// Por que existe: o app só aceita API em HTTPS (apps/mobile/src/api-nativa.ts) e o servidor só abre o canal do app
// atrás de HTTPS (validarCanalMobile, em src/servidor/acesso/http.ts). Com STUDOO_PROXY_HTTPS=1, o servidor confia em
// X-Forwarded-Proto e X-Forwarded-Host, como no site publicado atrás do proxy reverso. Aqui os dois cabeçalhos são
// escritos pelo proxy e nunca aceitos de quem chama.
//
// Uso: node proxy-https.mjs --cert local.crt --chave local.key [--porta 3443] [--destino http://localhost:3000]
// Sem dependências. Uma linha por pedido na saída (método, caminho sem a busca, status e tempo), sem cabeçalhos nem corpo.
import { existsSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    cert: { type: 'string' },
    chave: { type: 'string' },
    porta: { type: 'string', default: '3443' },
    destino: { type: 'string', default: 'http://localhost:3000' },
    retomada: { type: 'string' },
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

/** Cabeçalhos que valem só para uma conexão: não seguem adiante. */
const DE_UM_SALTO = new Set(['connection', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'upgrade']);
const controleDaProva = (nome) => Boolean(values.retomada && existsSync(join(values.retomada, nome)));
const registrarProva = (etapa, dados = {}) => console.log(`[retomada] ${JSON.stringify({ etapa, em: Date.now(), ...dados })}`);
let aceitesDaProva = 0;

const servidor = https.createServer({ cert: readFileSync(values.cert), key: readFileSync(values.chave) }, (pedido, resposta) => {
  const inicio = performance.now();
  const caminho = (pedido.url ?? '/').split('?')[0];
  const registrar = (status) => console.log(`${pedido.method} ${caminho} ${status} ${Math.round(performance.now() - inicio)}ms`);
  const provaAtiva = controleDaProva('armada');
  const idConsultado = provaAtiva && pedido.method === 'GET'
    ? /^\/api\/aprendizado\/pedidos\/([\da-f-]+)$/i.exec(caminho)?.[1] : undefined;
  const cortarConsulta = Boolean(idConsultado && !controleDaProva('consultas-liberadas'));
  const aceiteDaProva = provaAtiva && pedido.method === 'POST' && caminho === '/api/aprendizado/planos';
  const cortarAceite = aceiteDaProva && ++aceitesDaProva === 1;
  if (aceiteDaProva) registrarProva('post', { numero: aceitesDaProva });

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
    if (idConsultado) {
      let texto = '';
      origem.setEncoding('utf8');
      origem.on('data', parte => { texto += parte; });
      origem.once('end', () => {
        let dados;
        try { dados = JSON.parse(texto); } catch { dados = {}; }
        const plano = dados?.plano;
        registrarProva('consulta', {
          pedidoId: idConsultado, status: origem.statusCode, estado: dados?.estado,
          tentativas: dados?.tentativas, cortada: cortarConsulta,
          total: plano?.progresso?.total, partes: plano?.fluxos?.length,
          primeiraLicao: plano?.fluxos?.[0]?.licoes?.[0]?.id,
        });
      });
      if (cortarConsulta) resposta.destroy();
    }
    origem.once('end', () => {
      registrar(origem.statusCode ?? 502);
      if (aceiteDaProva) registrarProva('post-servidor', { status: origem.statusCode, cortado: cortarAceite });
    });
    if (cortarAceite || cortarConsulta) {
      origem.resume();
      return;
    }
    const deVolta = {};
    for (const [nome, valor] of Object.entries(origem.headers)) {
      if (valor !== undefined && !DE_UM_SALTO.has(nome)) deVolta[nome] = valor;
    }
    resposta.writeHead(origem.statusCode ?? 502, deVolta);
    // Sem guardar em memória: a geração ao vivo (NDJSON) chega linha a linha, como chega do servidor.
    origem.pipe(resposta);
  });

  adiante.once('error', () => {
    if (resposta.destroyed) {
      registrar('502 (servidor fora do ar)');
      return;
    }
    if (!resposta.headersSent) {
      resposta.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      resposta.end(JSON.stringify({ codigo: 'falha', mensagem: 'O servidor do Studoo não respondeu ao proxy.' }));
    } else {
      resposta.destroy();
    }
    registrar('502 (servidor fora do ar)');
  });
  if (cortarAceite) adiante.once('finish', () => {
    // O POST inteiro foi escrito para o servidor. Só o socket TLS voltado ao app cai.
    registrarProva('corte-aceite');
    resposta.destroy();
  });
  // Quem chamou desistiu (tempo limite do app, Cancelar): o pedido ao servidor também para.
  resposta.once('close', () => { if (!resposta.writableEnded && !cortarAceite && !cortarConsulta) adiante.destroy(); });
  pedido.pipe(adiante);
});

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
