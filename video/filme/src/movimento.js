import { Easing, interpolate, spring } from 'remotion';
import { FPS } from './tema.js';

/** Curvas de tempo do filme. */
export const CURVA = {
  /** Chega rápido e assenta devagar (o "ease out" forte dos filmes de lançamento). */
  suave: Easing.bezier(0.16, 1, 0.3, 1),
  /** Acelera e freia: para movimentos de câmera. */
  camera: Easing.bezier(0.65, 0, 0.35, 1),
  /** Sai acelerando: para o que vai embora. */
  saida: Easing.bezier(0.7, 0, 0.84, 0),
  /** Passa um pouco do ponto e volta. */
  elastica: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: (x) => x,
};

/** Interpola `quadro` de [de, ate] para [a, b], travando nas pontas. */
export function rampa(quadro, de, ate, a = 0, b = 1, curva = CURVA.suave) {
  if (ate <= de) return quadro >= ate ? b : a;
  return interpolate(quadro, [de, ate], [a, b], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: curva });
}

/** Mola (0 → 1) que começa em `inicio`. `cfg` afina o quique. */
export function mola(quadro, inicio = 0, cfg = {}) {
  return spring({ frame: quadro - inicio, fps: FPS, config: { damping: 13, stiffness: 150, mass: 0.8, ...cfg } });
}

/** Mola sem quique: assenta firme. */
export const molaFirme = (quadro, inicio = 0, cfg = {}) => mola(quadro, inicio, { damping: 22, stiffness: 190, mass: 0.9, ...cfg });

/** Entra e sai: 0 → 1 em [entra, entra+dur] e 1 → 0 em [sai-dur, sai]. */
export function janela(quadro, entra, sai, dur = 18) {
  return Math.min(rampa(quadro, entra, entra + dur), 1 - rampa(quadro, sai - dur, sai, 0, 1, CURVA.saida));
}

/** Aleatório estável por semente (para confete, partículas e tremores sempre iguais em toda renderização). */
export function sorte(semente) {
  let estado = (Math.imul(semente | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let x = estado;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mistura linear. */
export const mix = (a, b, p) => a + (b - a) * p;

export { remapear } from './tempos.js';
