'use strict';
/*
 * Gravador determinístico do Studoo: grava o app de verdade quadro a quadro, a 60 fps exatos.
 *
 * Como funciona:
 * - O Chrome headless roda com o controle de quadros ligado: nada é desenhado até o gravador pedir o próximo quadro, e
 *   cada quadro avança o relógio das animações exatamente 1/60 s (animações CSS, rolagem suave, SVG).
 * - O tempo do JavaScript (setTimeout, setInterval, Date, performance.now) é o tempo virtual do próprio Chrome
 *   (Emulation.setVirtualTimePolicy): fica parado e só anda 1/60 s antes de cada quadro. Assim cronômetros, pausas e
 *   animações do app ficam todos no tempo do vídeo, por mais lenta que seja a captura.
 * - A tela sai em alta resolução (--force-device-scale-factor) e vai direto para o ffmpeg, sem arquivos intermediários.
 * - Cada toque, tecla e marca fica em eventos.json, com o número do quadro: o filme desenha o toque e sincroniza o som.
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const ambiente = require('../ambiente.cjs');
const { chromium } = require(ambiente.PLAYWRIGHT);

const { CHROME, FFMPEG, REPO, NODE, WEB, APP } = ambiente;
const FPS = 60;
const DT = 1000 / FPS;

/** Rolagem suave própria (curva ease-in-out), no tempo do vídeo: o gravador chama `window.__rolar`. */
function rolagemSuave() {
  window.__rolar = (alvo, dy, ms) => {
    const el = alvo || document.scrollingElement;
    const de = el.scrollTop;
    const t0 = performance.now();
    const passo = () => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      el.scrollTop = de + dy * e;
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  };
}

/**
 * Som e voz no relógio virtual. O navegador de gravação não tem alto-falante nem voz: o áudio do app tocaria no relógio
 * real (o guia da batida correria mais que o vídeo) e as frases apareceriam como "aparelho sem voz". Aqui o `Audio` e a
 * `speechSynthesis` só marcam o tempo, no relógio do vídeo; o som de verdade entra depois, na trilha do filme.
 */
function somVirtual() {
  window.__sons = [];
  // A duração de cada som vem do próprio WAV, lido quando o app cria o endereço do blob (a política de segurança do app
  // não deixa buscar um blob: por fetch).
  const duracoes = new Map();
  const criarEndereco = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (objeto) => {
    const endereco = criarEndereco(objeto);
    if (objeto instanceof Blob && /audio/.test(objeto.type)) {
      duracoes.set(endereco, objeto.arrayBuffer().then((b) => {
        const v = new DataView(b);
        let pos = 12;
        let taxa = 44100;
        let bloco = 2;
        while (pos + 8 <= v.byteLength) {
          const id = String.fromCharCode(v.getUint8(pos), v.getUint8(pos + 1), v.getUint8(pos + 2), v.getUint8(pos + 3));
          const tam = v.getUint32(pos + 4, true);
          if (id === 'fmt ') { taxa = v.getUint32(pos + 12, true); bloco = v.getUint16(pos + 20, true); }
          if (id === 'data') return Math.min(tam, v.byteLength - pos - 8) / bloco / taxa;
          pos += 8 + tam + (tam % 2);
        }
        return 2;
      }).catch(() => 2));
    }
    return endereco;
  };
  class AudioVirtual {
    constructor(src) {
      this.src = src || '';
      this.paused = true;
      this.ended = false;
      this.onended = null;
      this.volume = 1;
      this._t = 0;
      this._ini = 0;
      this._dur = 2;
      this._id = 0;
      this._pronto = Promise.resolve(duracoes.get(this.src) ?? 2).then((d) => { this._dur = d; });
    }
    get duration() { return this._dur; }
    get currentTime() { return this.paused ? this._t : Math.min(this._dur, this._t + (performance.now() - this._ini) / 1000); }
    set currentTime(v) { this._t = v; this._ini = performance.now(); }
    async play() {
      await this._pronto;
      this.paused = false;
      this.ended = false;
      this._ini = performance.now();
      window.__sons.push({ src: this.src, em: performance.now(), dur: this._dur });
      this._id = setTimeout(() => {
        this._t = this._dur;
        this.paused = true;
        this.ended = true;
        if (this.onended) this.onended(new Event('ended'));
      }, Math.max(0, (this._dur - this._t) * 1000));
    }
    pause() {
      if (this.paused) return;
      this._t = this.currentTime;
      this.paused = true;
      clearTimeout(this._id);
    }
    load() {}
    addEventListener(tipo, fn) { if (tipo === 'ended') this.onended = fn; }
    removeEventListener() {}
  }
  window.Audio = AudioVirtual;

  let atual = null;
  const voz = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices: () => [],
    speak(frase) {
      voz.cancel();
      atual = frase;
      voz.speaking = true;
      const ms = Math.max(900, ((frase.text || '').length * 68) / (frase.rate || 1));
      frase.__id = setTimeout(() => {
        if (atual !== frase) return;
        atual = null;
        voz.speaking = false;
        if (frase.onend) frase.onend(new Event('end'));
      }, ms);
      if (frase.onstart) setTimeout(() => frase.onstart(new Event('start')), 20);
    },
    cancel() {
      if (!atual) return;
      const frase = atual;
      atual = null;
      voz.speaking = false;
      clearTimeout(frase.__id);
      if (frase.onerror) frase.onerror({ error: 'canceled' });
    },
    pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
  };
  try { Object.defineProperty(window, 'speechSynthesis', { value: voz, configurable: true }); } catch { /* fica a do navegador */ }
}

/** A geração ao vivo chega no ritmo do vídeo (um evento a cada `window.__ritmoGeracao` ms virtuais), não no do servidor. */
function ritmoDaGeracao() {
  const original = window.fetch;
  window.fetch = async (entrada, opcoes) => {
    const url = typeof entrada === 'string' ? entrada : entrada && entrada.url ? entrada.url : String(entrada);
    const resposta = await original(entrada, opcoes);
    if (!url.includes('/api/aprendizado/propostas/ao-vivo') || !resposta.body || !resposta.ok) return resposta;
    const leitor = resposta.body.getReader();
    const dec = new TextDecoder();
    const enc = new TextEncoder();
    const fila = [];
    let resto = '';
    let fim = false;
    (async () => {
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const linhas = resto.split('\n');
        resto = linhas.pop();
        for (const linha of linhas) if (linha.trim()) fila.push(linha);
      }
      if (resto.trim()) fila.push(resto);
      fim = true;
    })();
    const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const corpo = new ReadableStream({
      async pull(controle) {
        for (;;) {
          if (fila.length) {
            const linha = fila.shift();
            const ritmo = window.__ritmoGeracao || 260;
            // O título da trilha e o fecho ("pronto") chegam mais devagar; as lições, no ritmo.
            await dormir(/"tipo":"(plano|pronto)"/.test(linha) ? ritmo * 1.6 : ritmo);
            controle.enqueue(enc.encode(`${linha}\n`));
            return;
          }
          if (fim) { controle.close(); return; }
          await dormir(16);
        }
      },
    });
    return new Response(corpo, { status: resposta.status, headers: resposta.headers });
  };
}

/** Cria uma conta sintética nova e devolve o token da sessão web. */
function novaSessao() {
  const arquivo = path.join(require('os').tmpdir(), `studoo-sessao-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  const codigo = `
    import { banco } from './src/servidor/banco/cliente.ts';
    import { criarSessao } from './src/servidor/acesso/sessao.ts';
    import { writeFileSync } from 'node:fs';
    const u = await banco.usuario.create({ data: { email: 'filme-' + crypto.randomUUID() + '@example.test', fuso: 'America/Sao_Paulo' } });
    const s = await criarSessao(u.id, 'WEB');
    writeFileSync(process.env.SAIDA, s.token, { mode: 0o600 });
    await banco.$disconnect();`;
  execFileSync(NODE, ['--env-file=.env', '--import', 'tsx', '--input-type=module', '-e', codigo], { cwd: REPO, env: { ...process.env, SAIDA: arquivo }, stdio: ['ignore', 'ignore', 'inherit'] });
  const token = fs.readFileSync(arquivo, 'utf8').trim();
  fs.unlinkSync(arquivo);
  return token;
}

/**
 * Prepara uma conta pelo serviço (sem tela): trilhas aceitas e lições concluídas.
 * @param {{ trilhas: { objetivo: string, concluir?: number, pratica?: string }[] }} pedido
 * @returns {{ token: string, trilhas: { id: string, titulo: string, licoes: { id: string, titulo: string, concluida: boolean }[] }[] }}
 */
function preparar(pedido) {
  const saida = execFileSync(NODE, ['--env-file=.env', '--import', 'tsx', path.join(__dirname, 'preparar.mjs'), JSON.stringify(pedido)],
    { cwd: REPO, stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024 }).toString().trim().split('\n').at(-1);
  return JSON.parse(saida);
}

/** Gerador pseudoaleatório com semente (mulberry32): a digitação tem o mesmo ritmo em toda gravação. */
function aleatorio(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Abre o navegador de gravação.
 * @param {{ largura: number, altura: number, escala?: number, toque?: boolean, token?: string, app?: boolean, saida: string, ritmoGeracao?: number }} opcoes
 */
async function abrir(opcoes) {
  const { largura, altura, escala = 3, toque = true, token, app = false, saida, ritmoGeracao = 260 } = opcoes;
  fs.mkdirSync(saida, { recursive: true });
  const browser = await chromium.launch({
    ...(CHROME ? { executablePath: CHROME } : { channel: 'chromium-headless-shell' }),
    args: ['--no-sandbox', '--enable-begin-frame-control', '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout',
      '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging', '--disable-image-animation-resync',
      `--force-device-scale-factor=${escala}`, '--hide-scrollbars', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    env: ambiente.envDoChrome(),
  });
  const context = await browser.newContext({ viewport: null, hasTouch: toque, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  if (token) await context.addCookies([{ name: 'studoo-sessao', value: token, url: WEB, httpOnly: true, sameSite: 'Lax' }]);
  await context.addInitScript(rolagemSuave);
  await context.addInitScript(ritmoDaGeracao);
  await context.addInitScript(somVirtual);
  await context.addInitScript((ritmo) => {
    window.__ritmoGeracao = ritmo;
    try { localStorage.setItem('studoo.apresentacao', 'vista'); } catch { /* sem armazenamento */ }
    // Sem o selo de desenvolvimento do Next na gravação.
    const estilo = document.createElement('style');
    estilo.textContent = 'nextjs-portal{display:none!important}';
    const por = () => document.head && document.head.appendChild(estilo);
    if (document.head) por(); else document.addEventListener('DOMContentLoaded', por);
  }, ritmoGeracao);
  if (app) await context.addInitScript(() => { window.STUDOO_REAL = true; });

  const bs = await browser.newBrowserCDPSession();
  const contextoId = (await bs.send('Target.getBrowserContexts')).browserContextIds.at(-1);
  const nova = context.waitForEvent('page');
  await bs.send('Target.createTarget', { url: 'about:blank', browserContextId: contextoId, enableBeginFrameControl: true, width: largura, height: altura });
  const page = await nova;
  const cdp = await context.newCDPSession(page);
  if (app && token) {
    // O app (prévia web do Expo) fala com a API de verdade: as chamadas /api vão para o servidor web, com a sessão.
    await page.route('**/api/**', async (rota) => {
      const url = new URL(rota.request().url());
      if (url.port !== '8097') return rota.continue();
      const resposta = await rota.fetch({ url: `${WEB}${url.pathname}${url.search}`, headers: { ...rota.request().headers(), origin: WEB, cookie: `studoo-sessao=${token}` } });
      await rota.fulfill({ response: resposta });
    });
  }
  const errosDaPagina = [];
  page.on('pageerror', (erro) => errosDaPagina.push(erro.message));

  // O tempo virtual começa parado. `base` é o instante (no relógio do Chrome) em que ele foi ligado; cada quadro libera
  // 1/60 s de tempo virtual e é desenhado exatamente nesse instante, então animações e JavaScript andam juntos.
  let { virtualTimeTicksBase: base } = await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });
  let vt = 0;
  let ultimo = null;
  /** Nome do passo em andamento, para os erros dizerem onde a gravação parou. */
  let passoAtual = 'início';
  /** Clipe em gravação: { nome, ffmpeg, quadros, eventos }. */
  let clipe = null;
  const clipes = [];
  const sorte = aleatorio(20261115);

  /** Espera a promessa com um limite de tempo real; o temporizador é limpo quando ela termina. */
  function comLimite(promessa, ms, oque) {
    let id;
    const limite = new Promise((_, falha) => { id = setTimeout(() => falha(new Error(`${oque} travou (passo: ${passoAtual})`)), ms); });
    return Promise.race([promessa, limite]).finally(() => clearTimeout(id));
  }

  /** Libera 1/60 s de tempo virtual e desenha o quadro (com captura, se pedida). */
  async function avancarQuadro(captura) {
    let avisar;
    const expirou = new Promise((ok) => { avisar = ok; cdp.once('Emulation.virtualTimeBudgetExpired', ok); });
    await comLimite(cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: DT }), 30000, 'tempo virtual');
    // Numa troca de página o aviso pode não vir: segue depois de um instante.
    let id;
    await Promise.race([expirou, new Promise((ok) => { id = setTimeout(ok, 1500); })]);
    clearTimeout(id);
    cdp.off('Emulation.virtualTimeBudgetExpired', avisar);
    vt += DT;
    return comLimite(cdp.send('HeadlessExperimental.beginFrame', { frameTimeTicks: base + vt, interval: DT, ...(captura ? { screenshot: { format: 'jpeg', quality: 95 } } : {}) }), 30000, 'beginFrame');
  }

  async function quadro(gravar) {
    const r = await avancarQuadro(gravar);
    if (!gravar) { ultimo = null; return; }
    if (r.screenshotData) ultimo = Buffer.from(r.screenshotData, 'base64');
    if (!ultimo) return;
    if (!clipe.ffmpeg.stdin.write(ultimo)) await new Promise((ok) => clipe.ffmpeg.stdin.once('drain', ok));
    clipe.quadros += 1;
  }

  /**
   * Acerta o relógio dos quadros com o tempo virtual da página. Depois de uma navegação que troca de processo, o tempo
   * virtual recomeça de outra base; se os quadros ficassem atrás dele, as animações novas esperariam paradas.
   */
  async function sincronizar() {
    for (let i = 0; i < 3; i += 1) {
      await avancarQuadro(false);
      const atraso = await page.evaluate(() => (document.timeline && document.timeline.currentTime != null ? performance.now() - document.timeline.currentTime : 0)).catch(() => 0);
      if (Math.abs(atraso) < 0.6) return;
      base += atraso;
    }
  }

  /** Garante uma primeira imagem: um quadro parado não devolve captura, então força um redesenho imperceptível. */
  async function primeiraImagem() {
    for (let i = 0; i < 12 && !ultimo; i += 1) {
      await page.evaluate((k) => { document.documentElement.style.opacity = k % 2 ? '1' : '0.999'; }, i);
      const r = await avancarQuadro(true);
      if (r.screenshotData) ultimo = Buffer.from(r.screenshotData, 'base64');
    }
    await page.evaluate(() => { document.documentElement.style.opacity = ''; });
    if (!ultimo) throw new Error('sem imagem inicial');
  }

  /** Bombeia quadros até a promessa terminar. Fora de um clipe, os quadros não são gravados. */
  async function durante(promessa, limiteMs = 120000) {
    let fim = false;
    let erro = null;
    let valor;
    Promise.resolve(promessa).then((v) => { fim = true; valor = v; }, (e) => { fim = true; erro = e; });
    const inicio = Date.now();
    while (!fim) {
      await quadro(Boolean(clipe));
      if (Date.now() - inicio > limiteMs) throw new Error(`a página não respondeu em ${limiteMs / 1000} s (passo: ${passoAtual})`);
      // Fora da gravação não há pressa de quadro: dá tempo ao Node de tratar a rede.
      if (!clipe) await new Promise((ok) => setImmediate(ok));
    }
    if (erro) throw erro;
    return valor;
  }

  /** Deixa o tempo passar (no vídeo, se houver clipe em gravação). */
  async function segurar(ms) {
    const n = Math.max(1, Math.round(ms / DT));
    for (let i = 0; i < n; i += 1) await quadro(Boolean(clipe));
  }

  const g = {
    page, context, cdp, FPS, DT, largura, altura, escala, errosDaPagina,
    durante, segurar, sincronizar,
    /** Foto do estado atual (para sondas e conferência), fora de qualquer clipe. */
    async foto(arquivo) {
      await page.evaluate(() => { document.documentElement.style.opacity = '0.999'; });
      let imagem = null;
      for (let i = 0; i < 6 && !imagem; i += 1) {
        const r = await avancarQuadro(true);
        if (r.screenshotData) imagem = Buffer.from(r.screenshotData, 'base64');
      }
      await page.evaluate(() => { document.documentElement.style.opacity = ''; });
      if (imagem) fs.writeFileSync(arquivo, imagem);
      return Boolean(imagem);
    },
    /** Começa um clipe: os quadros passam a ser gravados em `<saida>/<nome>.mp4`. */
    async gravar(nome) {
      if (clipe) throw new Error(`clipe ${clipe.nome} ainda aberto`);
      const arquivo = path.join(saida, `${nome}.mp4`);
      const ffmpeg = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '11', '-pix_fmt', 'yuv420p', '-g', '20', '-bf', '0', '-movflags', '+faststart', arquivo],
      { stdio: ['pipe', 'inherit', 'inherit'] });
      clipe = { nome, arquivo, ffmpeg, quadros: 0, eventos: [] };
      ultimo = null;
      await primeiraImagem();
    },
    /** Fecha o clipe e grava os eventos ao lado do vídeo. */
    async cortar() {
      if (!clipe) return null;
      const atual = clipe;
      clipe = null;
      await new Promise((ok) => { atual.ffmpeg.on('close', ok); atual.ffmpeg.stdin.end(); });
      const dados = { nome: atual.nome, fps: FPS, largura, altura, escala, quadros: atual.quadros, segundos: +(atual.quadros / FPS).toFixed(3), eventos: atual.eventos };
      fs.writeFileSync(path.join(saida, `${atual.nome}.json`), JSON.stringify(dados, null, 1));
      clipes.push(dados);
      console.log(`  clipe ${atual.nome}: ${atual.quadros} quadros (${dados.segundos} s), ${atual.eventos.length} eventos`);
      return dados;
    },
    /** Dá nome ao passo atual (aparece nos erros e, com STUDOO_VERBOSO=1, no terminal). */
    passo(nome) { passoAtual = nome; if (process.env.STUDOO_VERBOSO) console.log(`  · ${nome} (quadro ${clipe ? clipe.quadros : '-'})`); },
    /** Marca um evento no quadro atual do clipe (o filme usa para sincronizar som e destaques). */
    marcar(tipo, dados = {}) {
      if (clipe) clipe.eventos.push({ q: clipe.quadros, tipo, ...dados });
    },
    quadroAtual: () => (clipe ? clipe.quadros : 0),
    /** Abre uma página e espera um seletor, bombeando quadros. */
    async ir(url, seletor, opcoes = {}) {
      g.passo(`ir ${url}`);
      await durante(page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }));
      await sincronizar();
      if (seletor) await durante(page.waitForSelector(seletor, { timeout: 120000, ...opcoes }));
      await sincronizar();
    },
    async esperar(alvo, opcoes = {}) {
      const loc = typeof alvo === 'string' ? page.locator(alvo).first() : alvo;
      g.passo(`esperar ${String(loc).slice(0, 70)}`);
      await durante(loc.waitFor({ state: 'visible', timeout: 120000, ...opcoes }));
      return loc;
    },
    /** Espera uma condição da página (função avaliada a cada quadro). */
    async ate(fn, arg, limite = 3600) {
      for (let i = 0; i < limite; i += 1) {
        if (await page.evaluate(fn, arg).catch(() => false)) return true;
        await quadro(Boolean(clipe));
      }
      throw new Error('condição não chegou');
    },
    /** Centro do elemento na tela (px CSS), ou null se estiver fora da área visível. */
    async centro(loc) {
      const caixa = await loc.boundingBox({ timeout: 4000 });
      if (!caixa) return null;
      return { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2, caixa };
    },
    /**
     * Toque de dedo: marca o evento, espera o "dedo chegar", pressiona por alguns quadros (o botão afunda) e solta.
     * Se o alvo estiver fora da tela, rola suavemente até ele antes.
     */
    async tocar(alvo, opcoes = {}) {
      const loc = typeof alvo === 'string' ? page.locator(alvo).first() : alvo;
      const { antes = 170, pressao = 90, depois = 0, rotulo, deslocar } = opcoes;
      g.passo(`tocar ${rotulo || String(loc).slice(0, 60)}`);
      await durante(loc.waitFor({ state: 'visible', timeout: 60000 }));
      await g.trazer(loc);
      const c = await g.centro(loc);
      if (!c) throw new Error('alvo sem caixa');
      const x = c.x + (deslocar ? deslocar.x : 0);
      const y = c.y + (deslocar ? deslocar.y : 0);
      g.marcar('toque', { x: +x.toFixed(1), y: +y.toFixed(1), pressao, ...(rotulo ? { rotulo } : {}) });
      await segurar(antes);
      g.marcar('aperta', { x: +x.toFixed(1), y: +y.toFixed(1) });
      if (toque) {
        await durante(cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }));
        await segurar(pressao);
        const fim = cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await durante(fim);
      } else {
        await durante(page.mouse.move(x, y));
        await durante(page.mouse.down());
        await segurar(pressao);
        await durante(page.mouse.up());
      }
      g.marcar('solta', { x: +x.toFixed(1), y: +y.toFixed(1) });
      if (depois) await segurar(depois);
    },
    /** Onde o ponteiro do mouse está (computador). */
    ponteiro: { x: largura * 0.62, y: altura * 0.58 },
    /** Move o ponteiro até (x, y) com curva suave; cada quadro registra a posição, e o filme desenha o cursor. */
    async mover(x, y, ms = 620) {
      const n = Math.max(2, Math.round(ms / DT));
      const de = { ...g.ponteiro };
      // Um arco leve no caminho, como a mão faz.
      const arco = Math.min(46, Math.hypot(x - de.x, y - de.y) * 0.12);
      for (let i = 1; i <= n; i += 1) {
        const p = i / n;
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        g.ponteiro = { x: de.x + (x - de.x) * e, y: de.y + (y - de.y) * e - Math.sin(Math.PI * e) * arco };
        await durante(page.mouse.move(g.ponteiro.x, g.ponteiro.y));
        g.marcar('cursor', { x: +g.ponteiro.x.toFixed(1), y: +g.ponteiro.y.toFixed(1) });
      }
    },
    /** Clique de mouse: leva o ponteiro até o alvo, aperta por alguns quadros e solta. */
    async clicar(alvo, opcoes = {}) {
      const loc = typeof alvo === 'string' ? page.locator(alvo).first() : alvo;
      const { viagem = 640, pressao = 90, depois = 0, rotulo } = opcoes;
      g.passo(`clicar ${rotulo || String(loc).slice(0, 60)}`);
      await durante(loc.waitFor({ state: 'visible', timeout: 60000 }));
      await g.trazer(loc);
      const c = await g.centro(loc);
      if (!c) throw new Error('alvo sem caixa');
      await g.mover(c.x, c.y, viagem);
      await segurar(90);
      g.marcar('clique', { x: +c.x.toFixed(1), y: +c.y.toFixed(1), ...(rotulo ? { rotulo } : {}) });
      await durante(page.mouse.down());
      await segurar(pressao);
      await durante(page.mouse.up());
      g.marcar('clique-solta', { x: +c.x.toFixed(1), y: +c.y.toFixed(1) });
      if (depois) await segurar(depois);
    },
    /** Rola suavemente até o elemento ficar confortável na tela (com `margem` do topo e do rodapé). */
    async trazer(loc, opcoes = {}) {
      const { topo = 90, rodape = 150, ms = 520 } = opcoes;
      const caixa = await loc.boundingBox({ timeout: 4000 });
      if (!caixa) return;
      const alturaTela = altura;
      let dy = 0;
      if (caixa.y < topo) dy = caixa.y - topo;
      else if (caixa.y + caixa.height > alturaTela - rodape) dy = caixa.y + caixa.height - (alturaTela - rodape);
      if (Math.abs(dy) < 6) return;
      await g.rolar(dy, ms, loc);
    },
    /** Rolagem suave de `dy` px. Com `perto`, rola o contêiner rolável daquele elemento (o app usa ScrollView). */
    async rolar(dy, ms = 600, perto) {
      g.marcar('rolagem', { dy: Math.round(dy), ms });
      if (perto) {
        await perto.evaluate((el, [d, t]) => {
          let no = el.parentElement;
          while (no && no !== document.body) {
            const estilo = getComputedStyle(no);
            if (/(auto|scroll)/.test(estilo.overflowY) && no.scrollHeight > no.clientHeight + 4) break;
            no = no.parentElement;
          }
          window.__rolar(no && no !== document.body ? no : null, d, t);
        }, [dy, ms]);
      } else {
        await page.evaluate(([d, t]) => window.__rolar(null, d, t), [dy, ms]);
      }
      await segurar(ms + 50);
    },
    /** Digita com ritmo de gente: pausas curtas e irregulares, um pouco maiores depois de espaço. */
    async digitar(texto, opcoes = {}) {
      const { ritmo = 62, variacao = 0.55 } = opcoes;
      g.passo(`digitar "${texto.slice(0, 30)}"`);
      g.marcar('digita-inicio', { texto });
      for (const letra of texto) {
        await durante(page.keyboard.type(letra));
        g.marcar('tecla', { letra });
        const fator = 1 + (sorte() - 0.5) * 2 * variacao;
        await segurar(Math.max(24, ritmo * fator * (letra === ' ' ? 1.5 : 1)));
      }
      g.marcar('digita-fim');
    },
    async fechar() {
      if (clipe) await g.cortar();
      await browser.close();
      if (errosDaPagina.length) console.log('  erros da página:', errosDaPagina.slice(0, 5));
      return clipes;
    },
  };
  return g;
}

module.exports = { abrir, novaSessao, preparar, WEB, APP, FPS, DT, FFMPEG, NODE, REPO };
