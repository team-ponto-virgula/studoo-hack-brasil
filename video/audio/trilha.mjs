// Trilha sonora do filme, sintetizada do zero (sem amostras de terceiros): violão de cordas dedilhadas (Karplus-Strong),
// baixo, bateria, colchão, kalimba e os efeitos de interface. Os sons que o app toca na gravação (o acorde e a batida do
// violão) são os do próprio app: o mesmo código de packages/contratos/src/som.ts gera o áudio.
// Uso (a partir do repositório, para o tsx resolver):  node --import tsx <este arquivo> [--falas]
import fs from 'node:fs';
import path from 'node:path';
import ferramentas from '../ambiente.cjs';
import { BPM, FPS, TOTAL_QUADROS } from '../filme/src/tema.js';
import { MOMENTOS, eventosDasGravacoes, inicioDe } from '../filme/src/tempos.js';

const { REPO } = ferramentas;
const { sintetizarAcorde, sintetizarBatida } = await import(path.join(REPO, 'packages/contratos/src/som.ts'));

const COM_FALAS = process.argv.includes('--falas');
const SAIDA = path.join(import.meta.dirname, '../saida');
fs.mkdirSync(SAIDA, { recursive: true });

const SR = 48000;
const POR_QUADRO = SR / FPS;
const BATIDA = (SR * 60) / BPM;
const PASSO = BATIDA / 2; // uma colcheia
const TOTAL = TOTAL_QUADROS * POR_QUADRO;

// ---------- utilidades ----------
function sorteio(semente) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = sorteio(20261115);
const ruido = () => rnd() * 2 - 1;
const novoBus = () => ({ e: new Float32Array(TOTAL), d: new Float32Array(TOTAL) });
const bus = { bateria: novoBus(), baixo: novoBus(), violao: novoBus(), colchao: novoBus(), kalimba: novoBus(), efeitos: novoBus(), app: novoBus(), interface: novoBus(), eco: novoBus(), sala: novoBus() };

/** Soma um som mono a um barramento, com ganho e posição no estéreo (-1 esquerda, 1 direita). `sala` manda para a reverberação. */
function por(destino, inicio, som, ganho = 1, pan = 0, sala = 0, eco = 0) {
  const i0 = Math.round(inicio);
  const ge = ganho * Math.cos(((pan + 1) * Math.PI) / 4);
  const gd = ganho * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < som.length; i += 1) {
    const k = i0 + i;
    if (k < 0) continue;
    if (k >= TOTAL) break;
    const v = som[i];
    destino.e[k] += v * ge;
    destino.d[k] += v * gd;
    if (sala) { bus.sala.e[k] += v * ge * sala; bus.sala.d[k] += v * gd * sala; }
    if (eco) { bus.eco.e[k] += v * ge * eco; bus.eco.d[k] += v * gd * eco; }
  }
}

function biquad(tipo, f, q = 0.707) {
  const w = (2 * Math.PI * f) / SR;
  const c = Math.cos(w);
  const a = Math.sin(w) / (2 * q);
  let b0; let b1; let b2;
  if (tipo === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; } else if (tipo === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; } else { b0 = a; b1 = 0; b2 = -a; }
  const a0 = 1 + a;
  return [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - a) / a0];
}
function filtrar(x, coef) {
  const [b0, b1, b2, a1, a2] = coef;
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const y = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y;
  }
  return x;
}
/** Filtro de estado variável com corte que varia no tempo (`corte(i)` em Hz). `saida`: 'banda', 'baixa' ou 'alta'. */
function varrer(x, corte, q = 0.6, saida = 'banda') {
  let baixa = 0; let banda = 0;
  for (let i = 0; i < x.length; i += 1) {
    const f = 2 * Math.sin((Math.PI * Math.min(9000, corte(i))) / SR);
    baixa += f * banda;
    const alta = x[i] - baixa - q * banda;
    banda += f * alta;
    x[i] = saida === 'banda' ? banda : saida === 'baixa' ? baixa : alta;
  }
  return x;
}
const seg = (s) => Math.round(s * SR);
/** Apaga o fim do som com uma rampa curta (sem estalo). */
function soltar(x, segundos = 0.02) {
  const n = Math.min(x.length, seg(segundos));
  for (let i = 0; i < n; i += 1) x[x.length - 1 - i] *= i / n;
  return x;
}
const NOTAS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
/** Frequência de uma nota ("A4" = 440). */
function nota(nome) {
  const m = /^([A-G]#?)(\d)$/.exec(nome);
  return 440 * 2 ** ((NOTAS[m[1]] - 9 + (Number(m[2]) - 4) * 12) / 12);
}

// ---------- instrumentos ----------
function bumbo(forca = 1) {
  const x = new Float32Array(seg(0.42));
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    fase += (2 * Math.PI * (45 + 125 * Math.exp(-t / 0.026))) / SR;
    x[i] = (Math.sin(fase) * Math.exp(-t / 0.15) + ruido() * 0.22 * Math.exp(-t / 0.0025)) * forca;
  }
  return soltar(x, 0.03);
}
function tom(freq, forca = 1) {
  const x = new Float32Array(seg(0.3));
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    fase += (2 * Math.PI * freq * (1 + 0.9 * Math.exp(-t / 0.04))) / SR;
    x[i] = Math.sin(fase) * Math.exp(-t / 0.11) * forca;
  }
  return soltar(x, 0.03);
}
function palma(forca = 1) {
  const x = new Float32Array(seg(0.3));
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    const estalos = Math.exp(-((t % 0.0095)) / 0.0035) * (t < 0.027 ? 1 : 0);
    x[i] = ruido() * (estalos * 0.9 + (t >= 0.024 ? Math.exp(-(t - 0.024) / 0.075) : 0)) * forca;
  }
  filtrar(x, biquad('bp', 1500, 0.8));
  filtrar(x, biquad('hp', 500));
  return soltar(x, 0.02);
}
function aro(forca = 1) {
  const x = new Float32Array(seg(0.09));
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    x[i] = (Math.sin(2 * Math.PI * 1720 * t) * 0.6 + Math.sin(2 * Math.PI * 430 * t) * 0.5 + ruido() * 0.25 * Math.exp(-t / 0.003)) * Math.exp(-t / 0.018) * forca;
  }
  return soltar(x, 0.01);
}
function chimbal(forca = 1, aberto = false) {
  const x = new Float32Array(seg(aberto ? 0.32 : 0.07));
  const cai = aberto ? 0.085 : 0.016;
  for (let i = 0; i < x.length; i += 1) x[i] = ruido() * Math.exp(-(i / SR) / cai) * forca;
  filtrar(x, biquad('hp', 7200, 0.9));
  return soltar(x, 0.01);
}
function ganza(forca = 1) {
  const x = new Float32Array(seg(0.11));
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    x[i] = ruido() * Math.min(1, t / 0.012) * Math.exp(-t / 0.03) * forca;
  }
  filtrar(x, biquad('bp', 6200, 1.1));
  return soltar(x, 0.01);
}
function prato(segundos = 1.6, forca = 1) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) x[i] = ruido() * Math.exp(-(i / SR) / (segundos * 0.28)) * forca;
  filtrar(x, biquad('hp', 4200, 0.7));
  return soltar(x, 0.08);
}
function pratoAoContrario(segundos = 1.2, forca = 1) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) x[i] = ruido() * Math.pow(i / x.length, 3) * forca;
  filtrar(x, biquad('hp', 3600, 0.7));
  return soltar(x, 0.012);
}

/**
 * Corda dedilhada (Karplus-Strong) afinada com um passa-tudo, para a nota cair na frequência certa.
 * `tau` é o tempo de queda em segundos; `brilho` (0 a 1) é a dureza do ataque.
 */
function corda(freq, segundos, { forca = 1, brilho = 0.6, tau = 1.4 } = {}) {
  const x = new Float32Array(seg(segundos));
  const atraso = SR / freq - 0.5;
  let N = Math.floor(atraso);
  let frac = atraso - N;
  if (frac < 0.12) { N -= 1; frac += 1; }
  const C = (1 - frac) / (1 + frac);
  const buf = new Float32Array(N);
  const a = 0.12 + 0.85 * brilho;
  let lp = 0; let media0 = 0;
  for (let i = 0; i < N; i += 1) { lp += a * (ruido() - lp); buf[i] = lp; media0 += lp; }
  media0 /= N;
  let pico = 0;
  for (let i = 0; i < N; i += 1) { buf[i] -= media0; pico = Math.max(pico, Math.abs(buf[i])); }
  for (let i = 0; i < N; i += 1) buf[i] /= pico || 1;
  const g = Math.exp(-1 / (tau * freq));
  let pos = 0; let ant = 0; let apx = 0; let apy = 0;
  for (let i = 0; i < x.length; i += 1) {
    const atual = buf[pos];
    const media = 0.5 * (atual + ant);
    ant = atual;
    const y = C * media + apx - C * apy;
    apx = media; apy = y;
    buf[pos] = y * g;
    x[i] = atual * forca;
    pos = pos + 1 === N ? 0 : pos + 1;
  }
  return soltar(x, 0.03);
}

const CORDAS_SOLTAS = [82.41, 110, 146.83, 196, 246.94, 329.63];
const ACORDES = {
  C: { casas: [-1, 3, 2, 0, 1, 0], baixo: 'C2', colchao: ['C4', 'E4', 'G4'] },
  G: { casas: [3, 2, 0, 0, 0, 3], baixo: 'G2', colchao: ['B3', 'D4', 'G4'] },
  Am: { casas: [-1, 0, 2, 2, 1, 0], baixo: 'A1', colchao: ['C4', 'E4', 'A4'] },
  F: { casas: [-1, -1, 3, 2, 1, 1], baixo: 'F2', colchao: ['C4', 'F4', 'A4'] },
  Dm: { casas: [-1, -1, 0, 2, 3, 1], baixo: 'D2', colchao: ['D4', 'F4', 'A4'] },
  E: { casas: [0, 2, 2, 1, 0, 0], baixo: 'E2', colchao: ['B3', 'E4', 'G#4'] },
};
/** As cordas que soam no acorde: [índice da corda (0 = 6ª), frequência]. */
const cordasDo = (acorde) => ACORDES[acorde].casas.flatMap((casa, i) => (casa < 0 ? [] : [[i, CORDAS_SOLTAS[i] * 2 ** (casa / 12)]]));

/** Uma passada da mão no violão. `sentido` 1 desce (graves primeiro), -1 sobe (agudas primeiro, só as de cima). */
function passada(inicio, acorde, { sentido = 1, forca = 1, dura = 0.4, brilho = 0.62, tau = 1.3, ganho = 0.34, sala = 0.16 } = {}) {
  let lista = cordasDo(acorde);
  if (sentido < 0) lista = lista.slice(-4).reverse();
  lista.forEach(([indice, freq], ordem) => {
    const atraso = ordem * (sentido > 0 ? 0.011 : 0.008) * (0.85 + rnd() * 0.3);
    const som = corda(freq, dura, { forca: forca * (0.85 + rnd() * 0.3), brilho: brilho * (sentido > 0 ? 1 : 0.85), tau });
    por(bus.violao, inicio + seg(atraso) + seg((rnd() - 0.5) * 0.004), som, ganho, -0.32 + indice * 0.13, sala);
  });
}

function notaDoBaixo(freq, segundos, forca = 1) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * (0.55 + 0.45 * Math.exp(-t / 0.25));
    const f = 2 * Math.PI * freq * t;
    x[i] = Math.tanh((Math.sin(f) + 0.42 * Math.sin(2 * f) + 0.16 * Math.sin(3 * f)) * 1.25) * env * forca;
  }
  return soltar(x, 0.05);
}

/** Colchão: soma de harmônicos com dois osciladores levemente desafinados, um de cada lado. Escreve direto no estéreo. */
function colchao(inicio, segundos, notas, ganho = 0.05, { ataque = 0.35, solta = 0.5, queda = 1.9, oitava = 1 } = {}) {
  const n = seg(segundos + solta);
  const i0 = Math.round(inicio);
  for (const nome of notas) {
    const f0 = nota(nome) * oitava;
    for (let h = 1; h <= 5; h += 1) {
      const amp = ganho / Math.pow(h, queda);
      const fa = 2 * Math.PI * f0 * h * 1.0016 / SR;
      const fb = 2 * Math.PI * f0 * h * 0.9984 / SR;
      const defasa = rnd() * 6.28;
      for (let i = 0; i < n; i += 1) {
        const k = i0 + i;
        if (k < 0 || k >= TOTAL) continue;
        const t = i / SR;
        const env = Math.min(1, t / ataque) * (t > segundos ? Math.max(0, 1 - (t - segundos) / solta) : 1);
        bus.colchao.e[k] += Math.sin(fa * i + defasa) * amp * env;
        bus.colchao.d[k] += Math.sin(fb * i + defasa * 1.3) * amp * env;
      }
    }
  }
}

function kalimba(freq, forca = 1, segundos = 1.3) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    const f = 2 * Math.PI * freq * t;
    x[i] = (Math.sin(f) * Math.exp(-t / 0.42) + 0.3 * Math.sin(2 * f) * Math.exp(-t / 0.2) + 0.2 * Math.sin(5.43 * f) * Math.exp(-t / 0.035)) * Math.min(1, t / 0.002) * forca;
  }
  return soltar(x, 0.05);
}
function sino(freq, forca = 1, segundos = 1.8) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    const f = 2 * Math.PI * freq * t;
    x[i] = (Math.sin(f) * Math.exp(-t / 0.6) + 0.45 * Math.sin(2.76 * f) * Math.exp(-t / 0.22) + 0.22 * Math.sin(5.4 * f) * Math.exp(-t / 0.09)) * Math.min(1, t / 0.0015) * forca;
  }
  return soltar(x, 0.08);
}

// ---------- efeitos ----------
function estouro(freq = 620, forca = 1) {
  const x = new Float32Array(seg(0.14));
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    fase += (2 * Math.PI * freq * (0.72 + 0.5 * Math.min(1, t / 0.035))) / SR;
    x[i] = Math.sin(fase) * Math.min(1, t / 0.003) * Math.exp(-t / 0.034) * forca;
  }
  return soltar(x, 0.01);
}
function toqueDeDedo(forca = 1) {
  const x = new Float32Array(seg(0.07));
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    fase += (2 * Math.PI * (1050 - 520 * Math.min(1, t / 0.02))) / SR;
    x[i] = (Math.sin(fase) * Math.exp(-t / 0.014) + ruido() * 0.2 * Math.exp(-t / 0.002)) * forca;
  }
  return soltar(x, 0.01);
}
function tecla(forca = 1) {
  const x = new Float32Array(seg(0.035));
  const tom0 = 170 + rnd() * 70;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    x[i] = (ruido() * Math.exp(-t / 0.0022) + 0.5 * Math.sin(2 * Math.PI * tom0 * t) * Math.exp(-t / 0.008)) * forca;
  }
  filtrar(x, biquad('lp', 5200 + rnd() * 1800, 0.8));
  return soltar(x, 0.005);
}
/** Sopro de transição: ruído filtrado cujo corte sobe e desce. */
function sopro(segundos = 0.42, de = 500, pico = 3200, forca = 1) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) x[i] = ruido();
  varrer(x, (i) => { const p = i / x.length; return de + (pico - de) * Math.sin(Math.PI * Math.pow(p, 0.8)); }, 0.75);
  for (let i = 0; i < x.length; i += 1) { const p = i / x.length; x[i] *= Math.pow(Math.sin(Math.PI * p), 1.6) * forca; }
  return x;
}
function subida(segundos = 1.6, forca = 1) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) x[i] = ruido();
  varrer(x, (i) => 350 + 6500 * Math.pow(i / x.length, 2.2), 0.5);
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const p = i / x.length;
    fase += (2 * Math.PI * (180 + 520 * p * p)) / SR;
    x[i] = (x[i] * 0.8 + Math.sin(fase) * 0.16) * Math.pow(p, 2.2) * forca;
  }
  return soltar(x, 0.015);
}
function descida(segundos = 0.9, forca = 1) {
  const x = new Float32Array(seg(segundos));
  for (let i = 0; i < x.length; i += 1) x[i] = ruido();
  varrer(x, (i) => 4200 * Math.pow(1 - i / x.length, 2) + 160, 0.6);
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const p = i / x.length;
    fase += (2 * Math.PI * (150 - 100 * p)) / SR;
    x[i] = (x[i] * 0.7 + Math.sin(fase) * 0.5 * (1 - p)) * Math.pow(1 - p, 1.5) * Math.min(1, p / 0.02) * forca;
  }
  return x;
}
function impacto(forca = 1) {
  const x = new Float32Array(seg(1.3));
  const chiado = new Float32Array(x.length);
  for (let i = 0; i < x.length; i += 1) chiado[i] = ruido() * Math.exp(-(i / SR) / 0.16);
  filtrar(chiado, biquad('lp', 2400, 0.7));
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    fase += (2 * Math.PI * (38 + 62 * Math.exp(-t / 0.07))) / SR;
    x[i] = (Math.sin(fase) * Math.exp(-t / 0.38) + chiado[i] * 0.55) * forca;
  }
  return soltar(x, 0.1);
}
/** Batida surda (um cartão que cai, a janela que pousa). */
function baque(freq = 130, forca = 1) {
  const x = new Float32Array(seg(0.2));
  let fase = 0;
  for (let i = 0; i < x.length; i += 1) {
    const t = i / SR;
    fase += (2 * Math.PI * freq * (0.6 + 0.9 * Math.exp(-t / 0.02))) / SR;
    x[i] = (Math.sin(fase) * Math.exp(-t / 0.05) + ruido() * 0.3 * Math.exp(-t / 0.006)) * forca;
  }
  filtrar(x, biquad('lp', 2600, 0.7));
  return soltar(x, 0.02);
}
function avisoDeErro(forca = 1, notas = ['F4', 'D4']) {
  const x = new Float32Array(seg(0.62));
  const partes = [[nota(notas[0]), 0, 0.2], [nota(notas[1]), 0.2, 0.36]];
  for (const [freq, comeca, dura] of partes) {
    for (let i = 0; i < seg(dura); i += 1) {
      const t = i / SR;
      const f = 2 * Math.PI * freq * (1 - 0.012 * t / dura) * t;
      const k = seg(comeca) + i;
      if (k < x.length) x[k] += (Math.sin(f) + 0.3 * Math.sin(3 * f)) * Math.min(1, t / 0.008) * Math.exp(-t / (dura * 0.55)) * forca;
    }
  }
  return soltar(x, 0.03);
}
function cintilar(segundos = 0.9, forca = 1) {
  const x = new Float32Array(seg(segundos + 0.4));
  for (let k = 0; k < 16; k += 1) {
    const inicio = seg(rnd() * segundos);
    const freq = 2600 + rnd() * 4200;
    for (let i = 0; i < seg(0.22) && inicio + i < x.length; i += 1) {
      const t = i / SR;
      x[inicio + i] += Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / 0.05) * Math.min(1, t / 0.002) * forca * (0.4 + rnd() * 0.6) * 0.3;
    }
  }
  return x;
}
/** Arpejo de sinos (acerto, trilha pronta). */
function arpejo(inicio, notas, intervalo = 0.07, ganho = 0.16, pan = 0) {
  notas.forEach((nome, i) => por(bus.efeitos, inicio + seg(i * intervalo), sino(nota(nome), 1 - i * 0.04), ganho, pan + (i % 2 ? 0.15 : -0.15), 0.3, 0.12));
}

// ---------- música ----------
const emPasso = (compasso, passo = 0) => (compasso * 8 + passo) * PASSO;
const emQuadro = (quadro) => quadro * POR_QUADRO;
const humano = () => seg((rnd() - 0.5) * 0.006);

function bateria(compasso, tipo, { forca = 1, puxa = false, aberto = false, palmas = true, pratos = true } = {}) {
  const b = (passo, f = 1) => por(bus.bateria, emPasso(compasso, passo), bumbo(f * forca), 0.52, 0);
  const p = (passo, f = 1) => por(bus.bateria, emPasso(compasso, passo), palma(f * forca), 0.3, 0.06, 0.22);
  const c = (passo, f = 1, abre = false) => por(bus.bateria, emPasso(compasso, passo) + humano(), chimbal(f * forca, abre), 0.105, 0.3);
  if (tipo === 'meia') {
    b(0); b(3, 0.8); if (puxa) b(7, 0.7);
    if (palmas) p(4);
    if (pratos) for (let i = 0; i < 8; i += 1) c(i, i % 2 ? 0.55 : 0.9, aberto && i === 6);
  } else if (tipo === 'dobrada') {
    b(0); b(3, 0.7); b(4, 0.95); if (puxa) b(7, 0.7);
    p(2); p(6);
    for (let i = 0; i < 8; i += 1) { c(i, i % 2 ? 0.6 : 0.95, aberto && i === 7); por(bus.bateria, emPasso(compasso, i + 0.5) + humano(), chimbal(0.32 * forca), 0.105, 0.3); }
  } else if (tipo === 'leve') {
    b(0, 0.6); if (puxa) b(3, 0.42);
    por(bus.bateria, emPasso(compasso, 4), aro(0.8 * forca), 0.2, -0.12, 0.25);
    for (let i = 0; i < 8; i += 1) por(bus.bateria, emPasso(compasso, i) + humano(), ganza((i % 2 ? 0.8 : 0.45) * forca), 0.075, 0.34);
  } else if (tipo === 'chao') {
    for (let i = 0; i < 8; i += 2) b(i, 0.8 + i * 0.03);
    for (let i = 0; i < 8; i += 1) c(i, 0.5 + i * 0.07);
  }
}
/** Virada nos dois últimos tempos do compasso, para entrar no próximo. */
function virada(compasso, forca = 1) {
  const toms = [[4, 196], [5, 165], [6, 131], [6.5, 131], [7, 98], [7.5, 98]];
  toms.forEach(([passo, freq], i) => por(bus.bateria, emPasso(compasso, passo), tom(freq, (0.6 + i * 0.08) * forca), 0.4, -0.3 + i * 0.12, 0.2));
  por(bus.bateria, emPasso(compasso, 7), palma(0.7 * forca), 0.3, 0, 0.2);
}
function rufo(compasso, deSemi = 4, forca = 1) {
  for (let i = deSemi * 2; i < 16; i += 1) {
    const p = (i - deSemi * 2) / (16 - deSemi * 2);
    por(bus.bateria, emPasso(compasso, i / 2), palma((0.25 + 0.75 * p) * forca), 0.26, 0, 0.2);
  }
}

function baixo(compasso, acorde, tipo = 'meia', forca = 1) {
  const f = nota(ACORDES[acorde].baixo);
  const n = (passo, passos, k = 1, oitava = 1) => por(bus.baixo, emPasso(compasso, passo), notaDoBaixo(f * oitava, (passos * PASSO) / SR - 0.02, k * forca), 0.26, 0);
  if (tipo === 'meia') { n(0, 2.8); n(3, 1.6, 0.85); n(6, 1.2, 0.7, 2); n(7, 0.9, 0.75); } else if (tipo === 'longo') n(0, 7.6, 0.9);
  else if (tipo === 'oitavas') for (let i = 0; i < 8; i += 1) n(i, 0.9, i % 2 ? 0.7 : 1, i === 3 || i === 6 ? 2 : 1);
  else if (tipo === 'pulso') { n(0, 3.6); n(4, 3.4, 0.8); }
}

function violao(compasso, acorde, tipo, { forca = 1, de = 0, ate = 8 } = {}) {
  const padroes = {
    batida: [[0, 1, 1], [2, 1, 0.8], [3, -1, 0.6], [5, -1, 0.62], [6, 1, 0.85], [7, -1, 0.58]],
    corrida: [[0, 1, 1], [1, -1, 0.5], [2, 1, 0.82], [3, -1, 0.6], [4, 1, 0.95], [5, -1, 0.52], [6, 1, 0.84], [7, -1, 0.62]],
    tempos: [[0, 1, 0.8], [2, 1, 0.86], [4, 1, 0.93], [6, 1, 1]],
  };
  if (tipo === 'golpe') {
    passada(emPasso(compasso, de), acorde, { forca, dura: 2.6, tau: 2.2, brilho: 0.72, ganho: 0.38, sala: 0.3 });
    return;
  }
  if (tipo === 'dedilhado') {
    const cordas = cordasDo(acorde);
    const [grave] = cordas;
    const cima = cordas.slice(-3);
    const ordem = [grave, cima[0], cima[1], cima[0], cima[2], cima[0], cima[1], cima[0]];
    ordem.forEach(([indice, freq], i) => {
      if (i < de || i >= ate) return;
      por(bus.violao, emPasso(compasso, i) + humano(), corda(freq, 1.25, { forca: (i === 0 ? 1 : 0.72) * forca, brilho: 0.42, tau: 1.1 }), 0.3, -0.3 + indice * 0.12, 0.26);
    });
    return;
  }
  if (tipo === 'abafado') {
    const cordas = cordasDo(acorde);
    for (let i = de; i < ate; i += 1) {
      const [indice, freq] = cordas[i % 4 === 2 ? 1 : 0];
      por(bus.violao, emPasso(compasso, i) + humano(), corda(freq, 0.2, { forca: (i % 2 ? 0.7 : 1) * forca, brilho: 0.3, tau: 0.09 }), 0.38, -0.2 + indice * 0.1, 0.1);
    }
    return;
  }
  const padrao = padroes[tipo].filter(([passo]) => passo >= de && passo < ate);
  padrao.forEach(([passo, sentido, f], i) => {
    const proximo = i + 1 < padrao.length ? padrao[i + 1][0] : ate;
    passada(emPasso(compasso, passo) + humano(), acorde, { sentido, forca: f * forca, dura: ((proximo - passo) * PASSO) / SR + 0.05 });
  });
}

/** Melodia da kalimba: [[passo, nota, força?], ...] dentro do compasso. */
function melodia(compasso, notas, { ganho = 0.2, oitava = 1, eco = 0.35 } = {}) {
  for (const [passo, nome, f = 1] of notas) por(bus.kalimba, emPasso(compasso, passo) + humano(), kalimba(nota(nome) * oitava, f), ganho, rnd() * 0.3 - 0.15, 0.3, eco);
}
const TEMA_CLARO = {
  C: [[0, 'E5'], [1, 'G5', 0.8], [3, 'C6'], [6, 'G5', 0.8]],
  G: [[0, 'D5'], [1, 'G5', 0.8], [3, 'B5'], [6, 'G5', 0.8]],
  Am: [[0, 'C5'], [1, 'E5', 0.8], [3, 'A5'], [6, 'E5', 0.8]],
  F: [[0, 'A5'], [2, 'G5', 0.85], [4, 'F5', 0.85], [5, 'E5', 0.8], [6, 'D5', 0.85]],
};
const TEMA_MENOR = {
  Am: [[0, 'A5'], [2, 'E5', 0.8], [4, 'C5', 0.8], [5, 'E5', 0.75]],
  F: [[0, 'A5'], [2, 'F5', 0.8], [4, 'C5', 0.8], [5, 'F5', 0.75]],
  C: [[0, 'G5'], [2, 'E5', 0.8], [4, 'C5', 0.8], [5, 'E5', 0.75]],
  G: [[0, 'G5'], [2, 'D5', 0.8], [4, 'B4', 0.8], [5, 'D5', 0.75], [7, 'G5', 0.8]],
};
const ARPEJO = {
  C: ['C5', 'E5', 'G5', 'C6', 'G5', 'E5', 'G5', 'E5'],
  G: ['B4', 'D5', 'G5', 'B5', 'G5', 'D5', 'G5', 'D5'],
  Am: ['A4', 'C5', 'E5', 'A5', 'E5', 'C5', 'E5', 'C5'],
  F: ['A4', 'C5', 'F5', 'A5', 'F5', 'C5', 'F5', 'C5'],
  Dm: ['A4', 'D5', 'F5', 'A5', 'F5', 'D5', 'F5', 'D5'],
};
const arpejar = (compasso, acorde, ganho = 0.13, de = 0, ate = 8) => melodia(compasso, ARPEJO[acorde].map((n, i) => [i, n, i % 2 ? 0.7 : 0.95]).filter(([p]) => p >= de && p < ate), { ganho });
const tapete = (compasso, acorde, ganho = 0.05, compassos = 1, opcoes) => colchao(emPasso(compasso), (compassos * 8 * PASSO) / SR, ACORDES[acorde].colchao, ganho, opcoes);
const golpeDePrato = (compasso, forca = 1, passo = 0) => por(bus.bateria, emPasso(compasso, passo), prato(1.8, forca), 0.2, 0.1, 0.3);

// A harmonia, compasso por compasso (72 compassos).
const HARMONIA = [
  'Am', 'Am', 'F', 'E', // 0  abertura
  'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', // 4  Júlio
  'C', 'G', 'Am', 'F', // 16 revelação
  'C', 'G', 'Am', 'F', 'F', 'C', // 20 pedido (o 24 divide F e G)
  'Am', 'F', 'C', 'G', 'Am', 'F', // 26 lição
  'Dm', 'E', 'Am', 'F', 'G', 'C', // 32 erro
  'Am', 'Am', 'F', 'C', 'G', 'C', // 38 prática
  'Am', 'F', 'C', 'G', // 44 assuntos
  'Am', 'F', 'C', 'G', // 48 material
  'F', 'C', // 52 web e app (o 52 divide F e G)
  'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', // 54 Miguel
  'C', 'G', 'Am', 'F', 'C', 'C', // 66 fecho
];

// --- 0 a 3: abertura (escura, esparsa) ---
colchao(emPasso(0), (16 * PASSO) / SR, ['A2', 'E3', 'A3', 'C4'], 0.045, { ataque: 1.2, solta: 0.6, queda: 1.6 });
colchao(emPasso(2), (8 * PASSO) / SR, ['F2', 'C3', 'A3', 'C4'], 0.045, { ataque: 0.5, solta: 0.5, queda: 1.6 });
colchao(emPasso(3), (8 * PASSO) / SR, ['E2', 'B2', 'G#3', 'B3'], 0.05, { ataque: 0.4, solta: 0.25, queda: 1.5 });
por(bus.baixo, emPasso(0), notaDoBaixo(nota('A1'), 3.2, 0.7), 0.3);
por(bus.baixo, emPasso(2), notaDoBaixo(nota('F1'), 1.6, 0.7), 0.3);
por(bus.baixo, emPasso(3), notaDoBaixo(nota('E1'), 1.6, 0.8), 0.32);
for (let c = 0; c < 4; c += 1) {
  for (let i = 0; i < 8; i += c >= 3 ? 1 : 2) por(bus.bateria, emPasso(c, i), aro(0.5 + c * 0.1), 0.15, i % 4 ? 0.25 : -0.25, 0.3);
}
por(bus.kalimba, emPasso(0, 2), kalimba(nota('E5'), 0.8, 1.8), 0.16, -0.2, 0.5, 0.4);
por(bus.kalimba, emPasso(1, 2), kalimba(nota('C5'), 0.8, 1.8), 0.16, 0.2, 0.5, 0.4);
por(bus.efeitos, emPasso(3), subida((8 * PASSO) / SR, 0.5), 0.34, 0, 0.2);

// --- cama de fala (Júlio, 4 a 15; Miguel, 54 a 65) ---
function cama(de, compassos, claro) {
  for (let i = 0; i < compassos; i += 1) {
    const c = de + i;
    const acorde = HARMONIA[c];
    tapete(c, acorde, 0.06);
    violao(c, acorde, 'dedilhado', { forca: 0.9 });
    baixo(c, acorde, 'longo', 0.8);
    if (i >= 2 && i < compassos - 1) bateria(c, 'leve', { forca: i >= 6 ? 1 : 0.8, puxa: i % 2 === 1 });
    if (claro && i % 4 === 0 && i > 0) melodia(c, [[0, ARPEJO[acorde][3], 0.7]], { ganho: 0.12 });
  }
  // Os dois últimos compassos crescem para a cena seguinte.
  const fim = de + compassos;
  bateria(fim - 1, 'chao', { forca: 0.75 });
  por(bus.efeitos, emPasso(fim - 2), subida((16 * PASSO) / SR, 0.55), 0.36, 0, 0.2);
  por(bus.efeitos, emPasso(fim - 1, 2), pratoAoContrario((6 * PASSO) / SR, 0.8), 0.22, 0, 0.2);
}
cama(4, 12, false);
cama(54, 12, true);

// --- 16 a 19: revelação (a banda inteira entra) ---
for (let c = 16; c < 20; c += 1) {
  const acorde = HARMONIA[c];
  bateria(c, 'meia', { puxa: c % 2 === 1, aberto: true });
  baixo(c, acorde, 'meia');
  violao(c, acorde, 'batida');
  tapete(c, acorde, 0.045);
  melodia(c, TEMA_CLARO[acorde], { ganho: 0.185 });
}
golpeDePrato(16, 1.1); golpeDePrato(18, 0.9);
virada(19);

// --- 20 a 25: o pedido ---
for (let c = 20; c < 24; c += 1) {
  const acorde = HARMONIA[c];
  bateria(c, 'meia', { puxa: c % 2 === 1, forca: 0.9 });
  baixo(c, acorde, 'meia');
  tapete(c, acorde, 0.04);
  if (c < 22) violao(c, acorde, 'abafado', { forca: 0.9 });
  else { violao(c, acorde, 'batida', { forca: 0.9 }); arpejar(c, acorde, 0.12); }
}
golpeDePrato(20, 0.8);
// 24: F e G, crescendo; 25: o acorde de chegada (trilha pronta).
bateria(24, 'chao', { forca: 0.9 });
baixo(24, 'F', 'pulso'); por(bus.baixo, emPasso(24, 4), notaDoBaixo(nota('G2'), 0.8, 0.9), 0.36);
violao(24, 'F', 'tempos', { de: 0, ate: 4 }); violao(24, 'G', 'tempos', { de: 4, ate: 8 });
tapete(24, 'F', 0.045, 0.5); colchao(emPasso(24, 4), (4 * PASSO) / SR, ACORDES.G.colchao, 0.045);
rufo(24, 4, 0.9);
por(bus.efeitos, emPasso(24), subida((8 * PASSO) / SR, 0.6), 0.36, 0, 0.2);
function chegada(compasso, { forca = 1, virar = true, acorde = 'C' } = {}) {
  golpeDePrato(compasso, forca);
  por(bus.bateria, emPasso(compasso), bumbo(forca), 0.66);
  violao(compasso, acorde, 'golpe', { forca });
  por(bus.baixo, emPasso(compasso), notaDoBaixo(nota(ACORDES[acorde].baixo), 1.5, forca), 0.38);
  tapete(compasso, acorde, 0.05);
  if (virar) virada(compasso, 0.85);
}
chegada(25);

// --- 26 a 31: a lição (no 30 a banda para e o acorde do app soa sozinho) ---
for (let c = 26; c < 30; c += 1) {
  const acorde = HARMONIA[c];
  bateria(c, 'meia', { puxa: c % 2 === 1, forca: 0.9 });
  baixo(c, acorde, 'meia');
  tapete(c, acorde, 0.045);
  violao(c, acorde, 'dedilhado', { forca: 0.85 });
  melodia(c, TEMA_MENOR[acorde], { ganho: 0.19 });
}
golpeDePrato(26, 0.8);
tapete(30, 'Am', 0.035, 1);
por(bus.baixo, emPasso(30), notaDoBaixo(nota('A1'), 1.5, 0.6), 0.3);
baixo(31, 'F', 'pulso'); tapete(31, 'F', 0.045);
por(bus.bateria, emPasso(31), bumbo(0.9), 0.62);
virada(31);
violao(31, 'F', 'tempos', { de: 4, ate: 8, forca: 0.8 });

// --- 32 a 37: errou, o Stu explica de outro jeito, você acerta ---
bateria(32, 'meia', { palmas: false, forca: 0.85 }); baixo(32, 'Dm', 'meia'); tapete(32, 'Dm', 0.05);
arpejar(32, 'Dm', 0.1);
// 33: o erro. A banda para; fica um acorde suspenso.
colchao(emPasso(33), (7 * PASSO) / SR, ['E3', 'B3', 'E4', 'G#4'], 0.055, { ataque: 0.05, solta: 0.4, queda: 1.6 });
por(bus.baixo, emPasso(33), notaDoBaixo(nota('E2'), 1.3, 0.7), 0.3);
// 34 e 35: a explicação, só kalimba, colchão e um pulso leve.
for (let c = 34; c < 36; c += 1) {
  const acorde = HARMONIA[c];
  tapete(c, acorde, 0.055); baixo(c, acorde, 'longo', 0.8); arpejar(c, acorde, 0.17);
  bateria(c, 'leve', { forca: 0.9, puxa: true });
  violao(c, acorde, 'dedilhado', { forca: 0.7 });
}
// 36: cresce; 37: o acerto.
bateria(36, 'chao', { forca: 0.95 }); baixo(36, 'G', 'pulso'); tapete(36, 'G', 0.05); violao(36, 'G', 'tempos');
rufo(36, 4, 0.95);
por(bus.efeitos, emPasso(36), subida((8 * PASSO) / SR, 0.65), 0.38, 0, 0.2);
chegada(37);
melodia(37, [[0, 'C6'], [1, 'E6', 0.9], [2, 'G6', 0.9]], { ganho: 0.2 });

// --- 38 a 43: a prática (do 39 ao 41 quem toca o violão é o app) ---
for (let c = 38; c < 42; c += 1) {
  const acorde = HARMONIA[c];
  // Do 39 ao 41 a banda abre espaço: quem toca o violão é o app.
  bateria(c, 'meia', { puxa: c % 2 === 1, forca: c === 38 ? 0.9 : 0.72, aberto: c === 41 });
  baixo(c, acorde, 'meia', c === 38 ? 1 : 0.8);
  tapete(c, acorde, 0.04);
  if (c === 38) violao(c, acorde, 'abafado', { forca: 0.85 });
}
golpeDePrato(38, 0.75);
melodia(39, [[2, 'E5', 0.7]], { ganho: 0.14 }); melodia(40, [[2, 'C5', 0.7], [6, 'A5', 0.7]], { ganho: 0.14 }); melodia(41, [[2, 'G5', 0.7], [6, 'E5', 0.7]], { ganho: 0.14 });
bateria(42, 'chao', { forca: 0.9 }); baixo(42, 'G', 'pulso'); tapete(42, 'G', 0.045); violao(42, 'G', 'tempos');
rufo(42, 4, 0.9);
por(bus.efeitos, emPasso(42), subida((8 * PASSO) / SR, 0.6), 0.36, 0, 0.2);
chegada(43);
melodia(43, [[0, 'G5'], [1, 'C6', 0.9], [2, 'E6', 0.9]], { ganho: 0.2 });

// --- 44 a 47: qualquer assunto (tempo dobrado) ---
for (let c = 44; c < 48; c += 1) {
  const acorde = HARMONIA[c];
  bateria(c, 'dobrada', { puxa: c % 2 === 1, aberto: c % 2 === 1 });
  baixo(c, acorde, 'oitavas');
  violao(c, acorde, 'corrida', { forca: 0.92 });
  tapete(c, acorde, 0.04);
  if (c < 46) melodia(c, TEMA_MENOR[acorde], { ganho: 0.2, oitava: 2 });
  else arpejar(c, acorde, 0.11);
}
golpeDePrato(44, 1); golpeDePrato(46, 0.7);

// --- 48 a 51: o seu material ---
for (let c = 48; c < 52; c += 1) {
  const acorde = HARMONIA[c];
  bateria(c, 'meia', { puxa: c % 2 === 1, forca: 0.9, aberto: c === 51 });
  baixo(c, acorde, 'meia');
  tapete(c, acorde, 0.045);
  violao(c, acorde, c < 50 ? 'dedilhado' : 'batida', { forca: 0.88 });
  melodia(c, TEMA_MENOR[acorde], { ganho: 0.17 });
}
golpeDePrato(48, 0.8);

// --- 52 e 53: na web e no app ---
bateria(52, 'chao', { forca: 0.95 });
baixo(52, 'F', 'pulso'); por(bus.baixo, emPasso(52, 4), notaDoBaixo(nota('G2'), 0.8, 0.9), 0.36);
violao(52, 'F', 'tempos', { de: 0, ate: 4 }); violao(52, 'G', 'tempos', { de: 4, ate: 8 });
tapete(52, 'F', 0.045, 0.5); colchao(emPasso(52, 4), (4 * PASSO) / SR, ACORDES.G.colchao, 0.045);
rufo(52, 4, 0.9);
por(bus.efeitos, emPasso(52), subida((8 * PASSO) / SR, 0.55), 0.34, 0, 0.2);
chegada(53, { virar: false });
melodia(53, [[0, 'E6'], [1, 'C6', 0.9], [2, 'G5', 0.85]], { ganho: 0.19 });
por(bus.efeitos, emPasso(53, 3), descida((5 * PASSO) / SR, 0.45), 0.22, 0, 0.2);

// --- 66 a 71: o fecho ---
for (let c = 66; c < 70; c += 1) {
  const acorde = HARMONIA[c];
  bateria(c, 'meia', { puxa: true, aberto: true });
  baixo(c, acorde, 'meia');
  violao(c, acorde, 'batida');
  tapete(c, acorde, 0.05);
  melodia(c, TEMA_CLARO[acorde], { ganho: 0.18 });
  melodia(c, TEMA_CLARO[acorde].filter((_, i) => i % 2 === 0), { ganho: 0.1, oitava: 2 });
}
golpeDePrato(66, 1.1); golpeDePrato(68, 0.85);
virada(69); rufo(69, 6, 0.8);
// 70: o último acorde, que soa até o fim.
golpeDePrato(70, 1.15);
por(bus.bateria, emPasso(70), bumbo(1), 0.68);
passada(emPasso(70), 'C', { forca: 1, dura: 3.3, tau: 2.8, brilho: 0.75, ganho: 0.27, sala: 0.35 });
por(bus.baixo, emPasso(70), notaDoBaixo(nota('C2'), 3, 0.95), 0.36);
colchao(emPasso(70), 2.7, ['C4', 'E4', 'G4', 'C5'], 0.05, { ataque: 0.05, solta: 0.5 });
['C5', 'E5', 'G5', 'C6'].forEach((n, i) => por(bus.kalimba, emPasso(70) + seg(i * 0.06), sino(nota(n), 0.9, 2.6), 0.14, i % 2 ? 0.2 : -0.2, 0.4));
melodia(71, [[0, 'G5', 0.8], [1, 'C6', 0.9]], { ganho: 0.17 });

// ---------- efeitos das cenas ----------
const fx = (ato, quadro, som, ganho = 0.25, pan = 0, sala = 0.15) => por(bus.efeitos, emQuadro(inicioDe(ato) + quadro), som, ganho, pan, sala);
const M = MOMENTOS;
// abertura
fx('abertura', M.abertura.frase1 - 6, sopro(0.5, 300, 1500, 0.8), 0.16);
fx('abertura', M.abertura.frase2 - 6, sopro(0.5, 300, 1800, 0.8), 0.16);
M.abertura.cartas.forEach((q, i) => fx('abertura', q, baque(150 - i * 2.5 + rnd() * 30, 0.9), 0.2 + Math.min(0.14, i * 0.008), (rnd() - 0.5) * 1.3, 0.2));
fx('abertura', M.abertura.muito, impacto(0.8), 0.42, 0, 0.3);
fx('abertura', M.abertura.pouca, impacto(1), 0.5, 0, 0.3);
fx('abertura', M.abertura.queda, descida(0.75, 0.9), 0.3, 0, 0.2);
// espaços de fala
for (const ato of ['julio', 'miguel']) {
  fx(ato, 0, baque(95, 1), 0.34, ato === 'julio' ? -0.35 : 0.35, 0.3);
  fx(ato, -8, sopro(0.45, 300, 2200, 1), 0.2, ato === 'julio' ? -0.3 : 0.3);
  for (const chave of ['tema1', 'tema2', 'tema3']) {
    fx(ato, M[ato][chave] - 6, sopro(0.38, 400, 2400, 0.8), 0.13, ato === 'julio' ? 0.35 : -0.35);
    fx(ato, M[ato][chave] + 6, estouro(520, 0.8), 0.12, ato === 'julio' ? 0.35 : -0.35);
  }
  fx(ato, M[ato].limpa, sopro(0.5, 500, 2600, 0.9), 0.16);
}
fx('julio', M.julio.erro, avisoDeErro(0.8, ['C5', 'A4']), 0.14, 0.35, 0.25);
M.miguel.pilha.forEach((q, i) => fx('miguel', q, estouro(520 * 2 ** ([0, 2, 4, 7][i] / 12), 0.8), 0.13, -0.35));
fx('miguel', -4, descida(0.8, 0.8), 0.2);
// revelação
fx('revelacao', 0, impacto(1.1), 0.55, 0, 0.35);
fx('revelacao', -6, sopro(0.6, 400, 4200, 1), 0.3);
fx('revelacao', M.revelacao.pouso, baque(110, 1), 0.3, 0, 0.25);
fx('revelacao', M.revelacao.pouso + 2, estouro(300, 1), 0.14);
M.revelacao.letras.forEach((q, i) => fx('revelacao', q, estouro(nota(['C5', 'D5', 'E5', 'G5', 'A5', 'C6'][i]), 0.9), 0.17, -0.3 + i * 0.12));
fx('revelacao', M.revelacao.sorriso, sopro(0.3, 900, 3600, 0.9), 0.15, 0.3);
arpejo(emQuadro(inicioDe('revelacao') + M.revelacao.pronto), ['C6', 'E6', 'G6', 'C7'], 0.055, 0.12);
fx('revelacao', M.revelacao.lema1 - 4, sopro(0.4, 400, 2200, 0.8), 0.13);
fx('revelacao', M.revelacao.lema2 - 4, sopro(0.4, 400, 2600, 0.8), 0.13);
// pedido
fx('pedido', M.pedido.titulo1 - 4, sopro(0.4, 400, 2200, 0.8), 0.12, -0.3);
fx('pedido', M.pedido.centro, sopro(0.5, 400, 2600, 0.9), 0.16);
fx('pedido', M.pedido.titulo2 - 4, sopro(0.4, 400, 2400, 0.8), 0.12, -0.3);
M.pedido.etiquetas.forEach((q, i) => fx('pedido', q, estouro(nota(['E5', 'G5', 'C6'][i]), 0.9), 0.17, -0.4));
fx('pedido', M.pedido.pronto, cintilar(1, 1), 0.3, 0.2, 0.3);
// lição
fx('licao', M.licao.titulo1 - 4, sopro(0.4, 400, 2200, 0.8), 0.12, 0.3);
fx('licao', M.licao.explica, estouro(nota('E5'), 0.9), 0.16, 0.35);
fx('licao', M.licao.giro - 8, sopro(0.36, 500, 3200, 1), 0.2, -0.3);
fx('licao', M.licao.mostra, estouro(nota('G5'), 0.9), 0.16, 0.35);
// erro
fx('erro', M.erro.titulo - 4, sopro(0.4, 400, 2200, 0.8), 0.12, -0.3);
fx('erro', M.erro.outroJeito - 6, sopro(0.4, 400, 2600, 0.9), 0.15, -0.3);
fx('erro', M.erro.outroJeito, estouro(nota('E5'), 0.9), 0.15, -0.35);
fx('erro', M.erro.giro - 8, sopro(0.36, 500, 3200, 1), 0.2, 0.3);
fx('erro', M.erro.acerta, cintilar(1, 1), 0.3, 0.2, 0.3);
// prática
fx('pratica', M.pratica.titulo - 4, sopro(0.4, 400, 2200, 0.8), 0.12, 0.3);
fx('pratica', M.pratica.comoFoi - 8, sopro(0.36, 500, 3200, 1), 0.2, -0.3);
fx('pratica', M.pratica.concluida, cintilar(1, 1), 0.3, -0.2, 0.3);
// assuntos
M.assuntos.celulares.forEach((q, i) => fx('assuntos', q, estouro(nota(['A4', 'C5', 'E5', 'G5', 'A5'][i]), 1), 0.2, -0.6 + i * 0.3));
fx('assuntos', M.assuntos.aproxima - 6, sopro(0.5, 400, 3600, 1), 0.2);
fx('assuntos', M.assuntos.correcao, estouro(nota('E5'), 0.9), 0.16, -0.3);
// material
fx('material', M.material.titulo - 4, sopro(0.4, 400, 2200, 0.8), 0.12, -0.3);
M.material.formatos.forEach((q, i) => fx('material', q, estouro(nota(['C5', 'E5', 'G5', 'C6'][i]), 0.85), 0.15, -0.5 + i * 0.1));
fx('material', M.material.giro - 8, sopro(0.36, 500, 3200, 1), 0.2, 0.3);
fx('material', M.material.cita, estouro(nota('G5'), 0.9), 0.16, -0.3);
arpejo(emQuadro(inicioDe('material') + M.material.cita + 4), ['E6', 'G6'], 0.07, 0.08, -0.3);
// web e app
fx('webApp', M.webApp.titulo - 4, sopro(0.4, 400, 2400, 0.9), 0.14);
arpejo(emQuadro(inicioDe('webApp') + M.webApp.mesmo), ['G5', 'C6', 'E6'], 0.06, 0.1);
// fecho
fx('fecho', 0, impacto(0.9), 0.4, 0, 0.3);
fx('fecho', M.fecho.trofeu, cintilar(1.2, 1), 0.3, 0, 0.3);
fx('fecho', M.fecho.lema1 - 4, sopro(0.45, 400, 2400, 0.9), 0.14);
fx('fecho', M.fecho.lema2 - 4, sopro(0.45, 400, 2800, 0.9), 0.14);
fx('fecho', M.fecho.logo, impacto(0.8), 0.34, 0, 0.35);
arpejo(emQuadro(inicioDe('fecho') + M.fecho.logo), ['C6', 'E6', 'G6', 'C7'], 0.06, 0.12);
fx('fecho', M.fecho.creditos, estouro(nota('G5'), 0.8), 0.1);
// As transições em faixas (os cortes entre as cenas do app).
for (const ato of ['pedido', 'licao', 'erro', 'pratica', 'assuntos', 'material', 'webApp']) fx(ato, -5, sopro(0.5, 500, 3800, 1), 0.2, 0);

// ---------- os sons das gravações (toques, teclas e o som do próprio app) ----------
function lerWav(bytes) {
  const visao = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const taxa = visao.getUint32(24, true);
  const n = (bytes.byteLength - 44) / 2;
  const origem = new Float32Array(n);
  for (let i = 0; i < n; i += 1) origem[i] = visao.getInt16(44 + i * 2, true) / 32768;
  // Reamostra para 48 kHz (interpolação cúbica).
  const saida = new Float32Array(Math.floor((n * SR) / taxa));
  for (let i = 0; i < saida.length; i += 1) {
    const p = (i * taxa) / SR;
    const k = Math.floor(p);
    const f = p - k;
    const a = origem[Math.max(0, k - 1)]; const b = origem[k] ?? 0; const c = origem[k + 1] ?? 0; const d = origem[k + 2] ?? 0;
    saida[i] = b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  }
  return saida;
}
const registro = [];
for (const ev of eventosDasGravacoes()) {
  const inicio = emQuadro(ev.quadro);
  const lento = ev.velocidade <= 1.5;
  const pan = ev.x === undefined ? 0 : (ev.x - 0.5) * 0.5;
  if (ev.tipo === 'toque' && lento) por(bus.interface, inicio, toqueDeDedo(1), 0.28, pan, 0.1);
  else if (ev.tipo === 'clique' && lento) por(bus.interface, inicio, tecla(1.4), 0.24, pan, 0.08);
  else if (ev.tipo === 'tecla' && lento) por(bus.interface, inicio, tecla(0.7 + rnd() * 0.5), 0.17, (rnd() - 0.5) * 0.3, 0.05);
  else if (ev.tipo === 'retorno') {
    if (ev.certa) arpejo(inicio, ['G5', 'C6', 'E6', 'G6'], 0.06, 0.14);
    else {
      // O aviso de erro desce uma terça dentro do acorde do compasso, para soar "ops" sem brigar com a música.
      const quedas = { C: ['G4', 'E4'], G: ['D5', 'B4'], Am: ['E5', 'C5'], F: ['C5', 'A4'], Dm: ['A4', 'F4'], E: ['B4', 'G#4'] };
      por(bus.efeitos, inicio, avisoDeErro(1, quedas[HARMONIA[Math.floor(ev.quadro / 100)]]), 0.24, 0, 0.25);
    }
  } else if (ev.tipo === 'geracao-fim' || ev.tipo === 'concluida') arpejo(inicio, ['C6', 'E6', 'G6', 'C7'], 0.055, 0.13);
  else if (ev.tipo === 'trilha-concluida') { arpejo(inicio, ['G5', 'C6', 'E6', 'G6', 'C7'], 0.07, 0.14); por(bus.efeitos, inicio, cintilar(1.2, 1), 0.26, 0, 0.3); }
  else if (ev.tipo === 'trilha-pronta' || ev.tipo === 'reforco-certo') arpejo(inicio, ['E6', 'G6'], 0.07, 0.09);
  else if (ev.tipo === 'reforco-chegou') por(bus.efeitos, inicio, estouro(nota('C5'), 0.9), 0.14, 0, 0.2);
  else if (ev.tipo === 'som' && (ev.som === 'acorde' || ev.som === 'batida')) {
    // O som do próprio app, gerado pelo mesmo código que ele usa, do tamanho que a gravação mostra.
    const wav = ev.som === 'acorde' ? sintetizarAcorde(ev.casas) : sintetizarBatida(ev.casas, { bpm: ev.bpm, compassos: ev.compassos });
    let som = lerWav(wav);
    const cabe = Math.max(0, emQuadro(ev.fim) - inicio);
    if (ev.som === 'batida' && som.length > cabe) som = soltar(som.slice(0, Math.round(cabe + seg(0.25))), 0.35);
    por(bus.app, inicio, som, ev.som === 'acorde' ? 0.8 : 0.85, 0, 0.14);
    registro.push(`${ev.som} do app em ${(ev.quadro / FPS).toFixed(2)} s (${(som.length / SR).toFixed(2)} s)`);
  }
}

// ---------- reverberação, eco e mistura ----------
function reverberar(entrada) {
  const escala = SR / 44100;
  const pentes = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const passaTudo = [556, 441, 341, 225];
  const saida = { e: new Float32Array(TOTAL), d: new Float32Array(TOTAL) };
  for (const [canal, abre] of [['e', 0], ['d', 23]]) {
    const dest = saida[canal];
    const mono = new Float32Array(TOTAL);
    for (let i = 0; i < TOTAL; i += 1) mono[i] = (entrada.e[i] + entrada.d[i]) * 0.5;
    for (const tamanho of pentes) {
      const n = Math.round((tamanho + abre) * escala);
      const buf = new Float32Array(n);
      let pos = 0; let filtro = 0;
      for (let i = 0; i < TOTAL; i += 1) {
        const y = buf[pos];
        filtro = y * 0.72 + filtro * 0.28;
        buf[pos] = mono[i] + filtro * 0.82;
        dest[i] += y;
        pos = pos + 1 === n ? 0 : pos + 1;
      }
    }
    for (const tamanho of passaTudo) {
      const n = Math.round((tamanho + abre) * escala);
      const buf = new Float32Array(n);
      let pos = 0;
      for (let i = 0; i < TOTAL; i += 1) {
        const guardado = buf[pos];
        const y = guardado - dest[i];
        buf[pos] = dest[i] + guardado * 0.5;
        dest[i] = y;
        pos = pos + 1 === n ? 0 : pos + 1;
      }
    }
    filtrar(dest, biquad('hp', 240));
    for (let i = 0; i < TOTAL; i += 1) dest[i] *= 0.1;
  }
  return saida;
}
/** Eco de colcheia pontuada, alternando os lados. */
function ecoar(entrada) {
  const saida = { e: new Float32Array(TOTAL), d: new Float32Array(TOTAL) };
  const atraso = Math.round(PASSO * 1.5);
  for (let i = atraso; i < TOTAL; i += 1) {
    saida.e[i] = (entrada.d[i - atraso] + saida.d[i - atraso] * 0.38) * 0.9;
    saida.d[i] = (entrada.e[i - atraso] + saida.e[i - atraso] * 0.38) * 0.9;
  }
  return saida;
}

/** O volume da música ao longo do filme: desce nos espaços de fala (mais quando há fala gravada) e some no fim. */
const curva = new Float32Array(TOTAL).fill(1);
function abaixar(deQuadro, ateQuadro, nivel, desce = 0.5, sobe = 0.9) {
  const a = emQuadro(deQuadro); const b = emQuadro(ateQuadro);
  for (let i = a; i < b; i += 1) {
    const entra = Math.min(1, (i - a) / (desce * SR));
    const sai = Math.min(1, (b - i) / (sobe * SR));
    const p = Math.min(entra, sai);
    curva[i] = Math.min(curva[i], 1 - (1 - nivel) * (p * p * (3 - 2 * p)));
  }
}
const nivelDaCama = COM_FALAS ? 0.3 : 0.7;
abaixar(inicioDe('julio'), inicioDe('revelacao') - 20, nivelDaCama);
abaixar(inicioDe('miguel'), inicioDe('fecho') - 20, nivelDaCama);
for (let i = 0; i < seg(0.25); i += 1) curva[TOTAL - 1 - i] *= i / seg(0.25);

if (process.env.DIAG) {
  // Nível de cada barramento por trecho (dB RMS e pico), para acertar a mistura sem ouvir.
  const trechos = [['abertura', 0, 4], ['cama', 6, 14], ['revelação', 16, 20], ['pedido', 20, 24], ['lição', 26, 30], ['acorde app', 30, 31], ['explica', 34, 36], ['prática', 39, 42], ['assuntos', 44, 48], ['fecho', 66, 70]];
  for (const [nome, de, ate] of trechos) {
    const linha = Object.entries(bus).map(([chave, b]) => {
      let soma = 0; let pico = 0;
      const a0 = Math.round(emPasso(de)); const a1 = Math.round(emPasso(ate));
      for (let i = a0; i < a1; i += 1) { const v = (b.e[i] + b.d[i]) * 0.5; soma += v * v; pico = Math.max(pico, Math.abs(b.e[i]), Math.abs(b.d[i])); }
      const rms = Math.sqrt(soma / (a1 - a0));
      return `${chave} ${rms > 1e-6 ? (20 * Math.log10(rms)).toFixed(0) : '--'}/${pico > 1e-6 ? (20 * Math.log10(pico)).toFixed(0) : '--'}`;
    }).join('  ');
    console.log(`${nome.padEnd(11)} ${linha}`);
  }
}
// A bateria passa por um arredondamento suave: os picos do bumbo não empurram o limitador, e a mistura não "bombeia".
for (const lado of ['e', 'd']) { const x = bus.bateria[lado]; for (let i = 0; i < TOTAL; i += 1) x[i] = 0.42 * Math.tanh(x[i] / 0.42); }
const sala = reverberar(bus.sala);
const eco = ecoar(bus.eco);
function misturar(nomes, comCurva) {
  const m = { e: new Float32Array(TOTAL), d: new Float32Array(TOTAL) };
  for (const [nome, ganho] of nomes) {
    const b = nome === 'sala' ? sala : nome === 'eco' ? eco : bus[nome];
    for (let i = 0; i < TOTAL; i += 1) { m.e[i] += b.e[i] * ganho; m.d[i] += b.d[i] * ganho; }
  }
  if (comCurva) for (let i = 0; i < TOTAL; i += 1) { m.e[i] *= curva[i]; m.d[i] *= curva[i]; }
  return m;
}
const musica = misturar([['bateria', 1], ['baixo', 1], ['violao', 1], ['colchao', 1], ['kalimba', 1], ['eco', 0.5]], true);
const efeitos = misturar([['efeitos', 1], ['interface', 1], ['app', 1]], false);
const ambiente = misturar([['sala', 1]], true);

const DRIVE = 1.12;
function finalizar(partes) {
  const e = new Float32Array(TOTAL); const d = new Float32Array(TOTAL);
  for (const parte of partes) for (let i = 0; i < TOTAL; i += 1) { e[i] += parte.e[i]; d[i] += parte.d[i]; }
  filtrar(e, biquad('hp', 28)); filtrar(d, biquad('hp', 28));
  // Limitador simples: segura os picos com um ganho que reage rápido e volta devagar, e arredonda o que passar.
  const alvo = 0.89;
  let ganho = 1;
  let reduzidos = 0; let menor = 1;
  const antecipa = seg(0.004);
  for (let i = 0; i < TOTAL; i += 1) {
    const k = Math.min(TOTAL - 1, i + antecipa);
    const pico = Math.max(Math.abs(e[k]), Math.abs(d[k])) * DRIVE;
    const querido = pico > alvo ? alvo / pico : 1;
    ganho = querido < ganho ? ganho + (querido - ganho) * 0.5 : ganho + (querido - ganho) * 0.00016;
    if (ganho < 0.98) reduzidos += 1;
    if (ganho < menor) menor = ganho;
    e[i] = Math.tanh(e[i] * DRIVE * ganho * 1.05) / 1.05;
    d[i] = Math.tanh(d[i] * DRIVE * ganho * 1.05) / 1.05;
  }
  if (process.env.DIAG) console.log(`limitador: ${((reduzidos / TOTAL) * 100).toFixed(1)}% do tempo abaixo de -0,2 dB; maior redução ${(20 * Math.log10(menor)).toFixed(1)} dB`);
  return { e, d };
}
function gravar(arquivo, { e, d }) {
  const bytes = Buffer.alloc(44 + TOTAL * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(36 + TOTAL * 4, 4); bytes.write('WAVE', 8); bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(SR, 24);
  bytes.writeUInt32LE(SR * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(TOTAL * 4, 40);
  let pico = 0;
  for (let i = 0; i < TOTAL; i += 1) {
    pico = Math.max(pico, Math.abs(e[i]), Math.abs(d[i]));
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, e[i])) * 32767), 44 + i * 4);
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, d[i])) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(arquivo, bytes);
  return pico;
}
const sufixo = COM_FALAS ? '-com-falas' : '';
const picoTudo = gravar(path.join(SAIDA, `trilha${sufixo}.wav`), finalizar([musica, efeitos, ambiente]));
const picoMusica = gravar(path.join(SAIDA, `so-musica${sufixo}.wav`), finalizar([musica, ambiente]));
const picoEfeitos = gravar(path.join(SAIDA, `so-efeitos${sufixo}.wav`), finalizar([efeitos]));
console.log(`trilha${sufixo}.wav: ${(TOTAL / SR).toFixed(2)} s, pico ${picoTudo.toFixed(3)} (música ${picoMusica.toFixed(3)}, efeitos ${picoEfeitos.toFixed(3)})`);
for (const linha of registro) console.log('  ' + linha);
