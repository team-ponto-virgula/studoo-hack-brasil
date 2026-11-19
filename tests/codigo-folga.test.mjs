// Código Studoo com folga garantida por link (rodada de banca, parte 2): o desenho do rosto (clareira do centro e ponte
// dos óculos) nunca gasta mais de 60% da correção de nenhum bloco, e o código lê nos dois leitores, limpo e com 8
// módulos sujos. Determinístico: semente fixa, sem sorteio. A prova com 5.000 links por formato fica fora do CI.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import jsQR from 'jsqr';
import zx from '@zxing/library';
import {
  CORES_PERFIL, FUNDO_DA_COR, LEITURA_MINIMA_COM_SUJOS, SUJOS_GARANTIDOS, USO_MAXIMO_CORRECAO,
  blocosRs, candidatasDoCodigo, escolherConfiguracao, geometriaCodigoStudoo, mapaDaVersao, matrizComMascaraParaTeste, svgCodigoDoLink,
} from '@studoo/contratos';

const { BinaryBitmap, DecodeHintType, HybridBinarizer, QRCodeReader, RGBLuminanceSource } = zx;
const POR_FORMATO = Number(process.env.STUDOO_CODIGO_POR_FORMATO || 200);
const LIDOS_POR_FORMATO = Number(process.env.STUDOO_CODIGO_LIDOS_POR_FORMATO || 60);

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const alfa = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** Um link de `n` caracteres no formato do site: domínio + /t/ ou /p/ + 16 caracteres aleatórios (base64url). */
function link(n, tipo, rnd) {
  let cod = '';
  for (let i = 0; i < 16; i++) cod += alfa[Math.floor(rnd() * 64)];
  return `https://${'studoo-previa-hackbrasil-2026-ui-web-integracao.exemplo.com.br'.padEnd(200, 'x')}`.slice(0, n - 19) + `/${tipo}/${cod}`;
}
const FORMATOS = [40, 75, 90, 120].flatMap((n) => ['t', 'p'].map((tipo) => ({ n, tipo })));
const linksDo = ({ n, tipo }, quantos) => { const rnd = mulberry32(n * 7 + (tipo === 't' ? 1 : 2)); return Array.from({ length: quantos }, () => link(n, tipo, rnd)); };

// Reed-Solomon do QR (GF(256), polinômio 0x11d), para conferir o mapa módulo → palavra-código.
const EXP = new Array(512);
const LOG = new Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
const MASCARAS = [(i, j) => (i + j) % 2 === 0, (i) => i % 2 === 0, (_, j) => j % 3 === 0, (i, j) => (i + j) % 3 === 0, (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0, (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0, (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0, (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0];

/** As palavras-código de cada bloco, lidas da matriz pelo mapa (sem a máscara), já desintercaladas. */
function palavrasPorBloco(matriz, nivel, mascara) {
  const n = matriz.length;
  const versao = (n - 17) / 4;
  const { palavra, bitNaPalavra } = mapaDaVersao(versao);
  const blocos = blocosRs(versao, nivel);
  const bytes = new Array(blocos.reduce((s, b) => s + b.dados + b.correcao, 0)).fill(0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const p = palavra[r * n + c];
    if (p >= 0 && matriz[r][c] !== MASCARAS[mascara](r, c)) bytes[p] |= 0x80 >> bitNaPalavra[r * n + c];
  }
  const porBloco = blocos.map(() => []);
  let i = 0;
  for (let d = 0; d < Math.max(...blocos.map((b) => b.dados)); d++) blocos.forEach((b, x) => { if (d < b.dados) porBloco[x].push(bytes[i++]); });
  for (let e = 0; e < blocos[0].correcao; e++) blocos.forEach((_, x) => { porBloco[x].push(bytes[i++]); });
  return { blocos, porBloco };
}

/** Conta independente do gerador: que palavras o desenho estraga (todo módulo de dados na clareira redonda; na ponte cheia, os claros da linha 3). */
function errosDoDesenho(texto, centro = 'sorriso') {
  const g = geometriaCodigoStudoo(texto, { centro });
  const { config, matriz } = escolherConfiguracao(texto, 'rosto', centro);
  const n = matriz.length;
  const { palavra, funcao } = mapaDaVersao(g.versao);
  const indiceDoBloco = [];
  const blocos = blocosRs(g.versao, g.nivel);
  for (let d = 0; d < Math.max(...blocos.map((b) => b.dados)); d++) blocos.forEach((b, x) => { if (d < b.dados) indiceDoBloco.push(x); });
  for (let e = 0; e < blocos[0].correcao; e++) blocos.forEach((_, x) => indiceDoBloco.push(x));
  const estragadas = new Set();
  if (g.clareira) {
    const ini = g.clareira.x - 4;
    const meio = (n - 1) / 2;
    for (let r = ini; r < ini + g.clareira.lado; r++) for (let c = ini; c < ini + g.clareira.lado; c++) {
      if ((r - meio) ** 2 + (c - meio) ** 2 <= (g.clareira.lado / 2) ** 2 && palavra[r * n + c] >= 0) estragadas.add(palavra[r * n + c]);
    }
  }
  if (config.ponte === 'normal') for (let c = 8; c < n - 8; c++) {
    if (matriz[3][c]) continue;
    assert.ok(!funcao[3][c], 'a ponte cheia não pinta formato nem versão');
    estragadas.add(palavra[3 * n + c]);
  }
  const erros = blocos.map(() => 0);
  for (const p of estragadas) erros[indiceDoBloco[p]]++;
  return { g, config, erros, corrige: blocos.map((b) => Math.floor(b.correcao / 2)) };
}

test('mapa módulo → palavra-código, blocos e troca de máscara conferem com o Reed-Solomon (síndrome zero em todos os blocos)', () => {
  const rnd = mulberry32(42);
  for (const n of [40, 75, 120]) {
    const texto = link(n, 't', rnd);
    for (const nivel of ['H', 'Q', 'M']) for (let mascara = 0; mascara < 8; mascara++) {
      const matriz = matrizComMascaraParaTeste(texto, nivel, mascara);
      if (!matriz) continue;
      const { blocos, porBloco } = palavrasPorBloco(matriz, nivel, mascara);
      porBloco.forEach((cw, x) => {
        for (let s = 0; s < blocos[x].correcao; s++) { let v = 0; for (const b of cw) v = mul(v, EXP[s]) ^ b; assert.equal(v, 0, `${n} ${nivel} máscara ${mascara} bloco ${x}`); }
      });
    }
  }
});

test(`regra da folga em ${POR_FORMATO} links por formato (40, 75, 90 e 120; trilha e perfil): nenhum bloco gasta mais de 60%, com centro`, () => {
  const distribuicao = {};
  for (const formato of FORMATOS) for (const texto of linksDo(formato, POR_FORMATO)) {
    // Trilha: o sorriso no centro; perfil: um disco (foto ou inicial), só com clareira de 7 ou mais.
    const centro = formato.tipo === 't' ? 'sorriso' : 'disco';
    const { g, config, erros, corrige } = errosDoDesenho(texto, centro);
    assert.deepEqual(erros, config.erros, `a conta do gerador bate com a conta independente: ${texto}`);
    for (let b = 0; b < erros.length; b++) assert.ok(erros[b] <= USO_MAXIMO_CORRECAO * corrige[b], `${texto}: bloco ${b} gasta ${erros[b]} de ${corrige[b]}`);
    assert.ok(config.leituraCom8 >= LEITURA_MINIMA_COM_SUJOS, `${texto}: com ${SUJOS_GARANTIDOS} sujos, ${config.leituraCom8}`);
    assert.ok(g.clareira && g.clareira.lado >= (centro === 'disco' ? 7 : 5), `${texto}: com centro`);
    assert.ok(g.versao <= 7, `${texto}: versão ${g.versao}`);
    // Nenhuma candidata com centro numa versão menor passa na folga (o módulo maior vem antes do rosto).
    const k = `${formato.n}/${formato.tipo} ${config.nivel} v${config.versao} ${config.ponte} ${config.clareira}`;
    distribuicao[k] = (distribuicao[k] ?? 0) + 1;
  }
  // A escolha é a melhor pela regra: nenhuma candidata que passa tem versão menor com centro, nem rosto mais completo na mesma versão.
  for (const formato of FORMATOS) for (const texto of linksDo(formato, 5)) {
    const centro = formato.tipo === 't' ? 'sorriso' : 'disco';
    const { config } = escolherConfiguracao(texto, 'rosto', centro);
    const passam = candidatasDoCodigo(texto, 'rosto', centro).filter((c) => c.uso <= USO_MAXIMO_CORRECAO && c.leituraCom8 >= LEITURA_MINIMA_COM_SUJOS && c.clareira > 0);
    assert.ok(!passam.some((c) => c.versao < config.versao), `${texto}: versão menor com centro`);
    const ponte = { normal: 2, fina: 1, nenhuma: 0 };
    assert.ok(!passam.some((c) => c.versao === config.versao && (c.clareira > config.clareira || (c.clareira === config.clareira && ponte[c.ponte] > ponte[config.ponte]))), `${texto}: rosto mais completo na mesma versão`);
  }
  // Mesmo link, mesmo código (web e app desenham igual).
  const t = linksDo(FORMATOS[2], 1)[0];
  assert.equal(svgCodigoDoLink(t), svgCodigoDoLink(t));
  console.log('configurações escolhidas:', distribuicao);
});

async function rgba(svg, lado) {
  const { data, info } = await sharp(Buffer.from(svg)).resize(lado, lado).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height };
}
const lerJsqr = ({ data, w, h }) => jsQR(data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
function lerZxing({ data, w, h }) {
  const lum = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  try { return new QRCodeReader().decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h))), new Map([[DecodeHintType.TRY_HARDER, true]])).getText(); } catch { return null; }
}
/** Pinta `quantos` módulos de dados (fora do centro e da ponte cheia) com a cor oposta, escolhidos pela semente. */
function sujar(svg, texto, quantos, rnd, centro) {
  const { config, matriz } = escolherConfiguracao(texto, 'rosto', centro);
  const n = matriz.length;
  const { palavra } = mapaDaVersao(config.versao);
  const ini = (n - config.clareira) / 2;
  const livres = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (palavra[r * n + c] < 0) continue;
    if (config.clareira && r >= ini && r < ini + config.clareira && c >= ini && c < ini + config.clareira) continue;
    if (config.ponte === 'normal' && r === 3 && c >= 8 && c < n - 8) continue;
    livres.push([r, c]);
  }
  let extra = '';
  for (let k = 0; k < quantos; k++) {
    const [r, c] = livres.splice(Math.floor(rnd() * livres.length), 1)[0];
    extra += `<rect x="${c + 4}" y="${r + 4}" width="1" height="1" fill="${matriz[r][c] ? '#ffffff' : '#1b2a5e'}"/>`;
  }
  return svg.replace(/<\/svg>$/, `${extra}</svg>`);
}

test(`leitura por jsQR e ZXing em ${LIDOS_POR_FORMATO} links por formato: 100% limpos e no máximo 1 falha com 8 módulos sujos`, async () => {
  const foto = `data:image/png;base64,${(await sharp({ create: { width: 64, height: 64, channels: 3, background: '#2b1d16' } }).png().toBuffer()).toString('base64')}`;
  for (const formato of FORMATOS) {
    const sujeira = mulberry32(formato.n * 13 + (formato.tipo === 't' ? 5 : 9));
    let sujosLidos = 0;
    const links = linksDo(formato, LIDOS_POR_FORMATO);
    for (const [i, texto] of links.entries()) {
      const cor = FUNDO_DA_COR[CORES_PERFIL[i % CORES_PERFIL.length]];
      const centro = formato.tipo === 't' ? {} : i % 2 ? { inicial: 'A' } : { fotoHref: foto };
      const svg = svgCodigoDoLink(texto, { mioloCor: cor, tamanho: 480, ...centro });
      const limpo = await rgba(svg, 480);
      assert.equal(lerJsqr(limpo), texto, `jsQR limpo ${texto}`);
      assert.equal(lerZxing(limpo), texto, `ZXing limpo ${texto}`);
      const sujo = await rgba(sujar(svg, texto, SUJOS_GARANTIDOS, sujeira, formato.tipo === 't' ? 'sorriso' : 'disco'), 480);
      if (lerJsqr(sujo) === texto && lerZxing(sujo) === texto) sujosLidos++;
    }
    // Os 99% com 8 sujos vêm da conta (leituraCom8) e da prova com 5.000 links por formato; numa amostra de 60, no máximo 1 falha.
    assert.ok(sujosLidos >= links.length - 1, `${formato.n}/${formato.tipo}: ${sujosLidos} de ${links.length} com 8 sujos`);
  }
});
