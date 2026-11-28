// Prévia dos e-mails do Studoo, com dados fictícios e sem enviar nada: grava o HTML e o texto simples de cada modelo e, com --capturas, fotografa cada um em 390 e 600 px,
// claro e escuro, e monta uma folha por modelo e largura (a que vai no corpo do PR).
//
//   npm run email:previa                                                    → .studoo-local/emails-previa/<modelo>.html e .txt
//   STUDOO_CHROME=/caminho/chrome-headless-shell npm run email:previa -- --capturas [--cliente-simples] [--saida=pasta]
//
// As capturas usam um Chrome sem janela, pelo protocolo de depuração, sem dependência nova. As imagens e as fontes de https://app.hellostudoo.com.br/marca/ são atendidas
// pelos arquivos de public/marca/ (as fontes, com o cabeçalho CORS que o site manda), então a captura não depende da rede.
//
// Duas leituras da mesma mensagem:
// - a padrão é a de um cliente que aplica o <style> (Apple Mail, por exemplo): fontes da marca e a versão escura dos modelos, por `prefers-color-scheme`;
// - com --cliente-simples é a de um cliente que descarta o <style> e escurece por conta própria (os apps do Gmail, por exemplo): só os estilos inline, a pilha de reserva
//   das fontes e, no escuro, a inversão automática de cores do próprio Chrome. É uma aproximação: cada cliente de e-mail tem o seu algoritmo.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { emailCodigoCadastro, emailContaExistente, emailRecuperacao } from '../src/servidor/email/modelos.ts';

const opcao = (nome) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);
const tem = (nome) => process.argv.includes(`--${nome}`);
const saida = resolve(opcao('saida') ?? '.studoo-local/emails-previa');
const ORIGEM = 'https://app.hellostudoo.com.br';
const enderecos = { recuperar: `${ORIGEM}/recuperar`, entrar: `${ORIGEM}/login`, suporte: `${ORIGEM}/suporte` };
// Códigos fictícios: nenhum código real passa por aqui.
const modelos = {
  cadastro: { nome: 'Código de cadastro', email: emailCodigoCadastro({ codigo: '482913', enderecos }) },
  recuperacao: { nome: 'Recuperação de senha', email: emailRecuperacao({ codigo: '731640', enderecos }) },
  'conta-existente': { nome: 'Aviso de conta existente', email: emailContaExistente({ enderecos }) },
};
/** O HTML como um cliente simples o entrega: sem os blocos de `<style>` e sem a declaração de que a mensagem tem versão escura. */
const semEstilo = (html) => html.replace(/<style>[\s\S]*?<\/style>\n/g, '').replace(/<meta name="(supported-)?color-schemes?"[^>]*>\n/g, '');

await mkdir(saida, { recursive: true });
for (const [id, { email }] of Object.entries(modelos)) {
  await writeFile(join(saida, `${id}.html`), email.html);
  await writeFile(join(saida, `${id}-simples.html`), semEstilo(email.html));
  await writeFile(join(saida, `${id}.txt`), `Assunto: ${email.assunto}\n\n${email.texto}`);
  console.log(`${id}: ${email.assunto} (HTML ${Buffer.byteLength(email.html)} B, texto ${Buffer.byteLength(email.texto)} B)`);
}
console.log(`Prévias em ${saida}`);
if (!tem('capturas')) process.exit(0);

// ——— Capturas ———
const chrome = process.env.STUDOO_CHROME;
if (!chrome) { console.error('Para as capturas, informe o Chrome sem janela em STUDOO_CHROME.'); process.exit(1); }
const simples = tem('cliente-simples');
const leituras = simples
  ? [{ sufixo: 'simples-claro', rotulo: 'Claro' }, { sufixo: 'simples-escuro', rotulo: 'Escurecido pelo cliente', inverter: true }]
  : [{ sufixo: 'claro', rotulo: 'Claro' }, { sufixo: 'escuro', rotulo: 'Escuro', escuro: true }];
const perfil = await mkdtemp(join(tmpdir(), 'studoo-email-previa-'));
const processo = spawn(chrome, [
  '--remote-debugging-port=0', `--user-data-dir=${perfil}`, '--hide-scrollbars', '--force-color-profile=srgb',
  ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []), 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const TIPOS = { png: 'image/png', woff2: 'font/woff2' };
async function navegador() {
  const endereco = await new Promise((ok, falha) => {
    let lido = '';
    processo.stderr.on('data', (parte) => { lido += parte; const achou = /DevTools listening on (ws:\/\/\S+)/.exec(lido); if (achou) ok(achou[1]); });
    processo.once('exit', () => falha(new Error('O Chrome fechou antes de abrir a depuração.')));
  });
  const ws = new WebSocket(endereco);
  await new Promise((ok, falha) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', falha, { once: true }); });
  let proximo = 0;
  const pendentes = new Map();
  const ouvintes = new Set();
  ws.addEventListener('message', ({ data }) => {
    const m = JSON.parse(data);
    if (!m.id) { for (const ouvinte of ouvintes) ouvinte(m); return; }
    const pedido = pendentes.get(m.id);
    pendentes.delete(m.id);
    if (m.error) pedido.falha(new Error(`${pedido.metodo}: ${m.error.message}`)); else pedido.ok(m.result);
  });
  const pedir = (metodo, params = {}, sessionId) => new Promise((ok, falha) => {
    pendentes.set(++proximo, { ok, falha, metodo });
    ws.send(JSON.stringify({ id: proximo, method: metodo, params, sessionId }));
  });
  return { pedir, ouvir: (ouvinte) => { ouvintes.add(ouvinte); return () => ouvintes.delete(ouvinte); }, fechar: () => ws.close() };
}

/** Fotografa a página inteira de um arquivo HTML local, na largura e no esquema de cores pedidos. */
async function fotografar(cdp, arquivo, { largura, escuro = false, inverter = false, densidade = 2, semFontes = false }) {
  const { targetId } = await cdp.pedir('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.pedir('Target.attachToTarget', { targetId, flatten: true });
  const pedir = (metodo, params) => cdp.pedir(metodo, params, sessionId);
  const parar = cdp.ouvir(async (m) => {
    if (m.sessionId !== sessionId || m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params;
    const caminho = new URL(request.url).pathname;
    const extensao = caminho.split('.').pop();
    try {
      if (semFontes && extensao === 'woff2') throw new Error('sem fontes');
      const corpo = await readFile(join('public', caminho));
      await pedir('Fetch.fulfillRequest', {
        requestId, responseCode: 200, body: corpo.toString('base64'),
        responseHeaders: [{ name: 'Content-Type', value: TIPOS[extensao] ?? 'application/octet-stream' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
      });
    } catch { await pedir('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {}); }
  });
  await pedir('Page.enable');
  await pedir('Fetch.enable', { patterns: [{ urlPattern: `${ORIGEM}/marca/*` }] });
  await pedir('Emulation.setDeviceMetricsOverride', { width: largura, height: 800, deviceScaleFactor: densidade, mobile: largura < 500 });
  await pedir('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: escuro ? 'dark' : 'light' }] });
  if (inverter) await pedir('Emulation.setAutoDarkModeOverride', { enabled: true });
  const carregou = new Promise((ok) => { const fim = cdp.ouvir((m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { fim(); ok(); } }); });
  await pedir('Page.navigate', { url: pathToFileURL(arquivo).href });
  await carregou;
  const { result } = await pedir('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))))
      .then(() => ({ altura: Math.ceil(document.documentElement.getBoundingClientRect().height), semImagem: [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src),
        fontes: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family) }))`,
  });
  const { altura, semImagem, fontes } = result.value;
  if (semImagem.length) throw new Error(`Imagem sem carregar em ${arquivo}: ${semImagem.join(', ')}`);
  const { data } = await pedir('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: largura, height: altura, scale: 1 } });
  parar();
  await cdp.pedir('Target.closeTarget', { targetId });
  return { png: Buffer.from(data, 'base64'), altura, fontes };
}

const cdp = await navegador();
try {
  for (const [id, { nome }] of Object.entries(modelos)) {
    for (const largura of [390, 600]) {
      const quadros = [];
      for (const leitura of leituras) {
        const arquivo = `${id}-${largura}-${leitura.sufixo}.png`;
        const { png, altura, fontes } = await fotografar(cdp, join(saida, `${id}${simples ? '-simples' : ''}.html`), { largura, ...leitura, semFontes: simples });
        await writeFile(join(saida, arquivo), png);
        quadros.push({ arquivo, rotulo: leitura.rotulo });
        console.log(`${arquivo}: ${largura} × ${altura} px, fontes carregadas: ${fontes.join(', ') || 'nenhuma (pilha de reserva)'}`);
      }
      // A folha: as duas leituras lado a lado. Paleta de 128 cores: a tela é chapada e o arquivo fica pequeno.
      const sufixo = simples ? '-simples' : '';
      const folha = join(saida, `folha-${id}-${largura}${sufixo}.html`);
      await writeFile(folha, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
        body{margin:0;padding:20px 24px 24px;background:#e6ebf7;font:16px/1.4 'Liberation Sans',Arial,sans-serif;color:#0b1b5c;width:max-content}
        h1{margin:0 0 4px;font-size:20px} p{margin:0 0 14px;font-size:14px;color:#5e6a85} .fila{display:flex;gap:20px;align-items:flex-start}
        figure{margin:0} figcaption{margin:0 0 6px;font-size:14px;font-weight:700;color:#5e6a85;text-transform:uppercase;letter-spacing:.04em}
        img{display:block;width:${largura}px;border-radius:6px;box-shadow:0 0 0 1px #c9d1ea}
      </style><h1>${nome}: ${largura} px</h1><p>${simples
    ? 'Cliente que descarta o &lt;style&gt;: estilos inline, pilha de reserva das fontes e escurecimento automático (aproximação, pelo Chrome).'
    : 'Cliente que aplica o &lt;style&gt;: fontes da marca e a versão escura dos modelos.'}</p><div class="fila">${quadros.map((q) => `<figure><figcaption>${q.rotulo}</figcaption><img src="${q.arquivo}" alt=""></figure>`).join('')}</div></html>`);
      const { png } = await fotografar(cdp, folha, { largura: largura * 2 + 20 + 48, densidade: largura < 500 ? 2 : 1 });
      const final = await sharp(png).png({ palette: true, colours: 128, effort: 10 }).toBuffer();
      await writeFile(join(saida, `folha-${id}-${largura}${sufixo}.png`), final);
      console.log(`folha-${id}-${largura}${sufixo}.png: ${Math.round(final.length / 1024)} kB`);
    }
  }
} finally {
  cdp.fechar();
  processo.kill();
  await rm(perfil, { recursive: true, force: true }).catch(() => {});
}
