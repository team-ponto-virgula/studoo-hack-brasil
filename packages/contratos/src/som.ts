/*
 * Som dos acordes sem arquivo de áudio: cada corda é sintetizada como uma corda dedilhada (algoritmo de Karplus-Strong)
 * e as cordas entram uma após a outra, de cima para baixo, como uma batida. O resultado é um WAV (PCM de 16 bits, mono):
 * a web toca como Blob e o app grava num arquivo temporário. Sem rede, sem dependência e sempre igual para o mesmo acorde.
 */

/** Frequência das cordas soltas na afinação padrão, da 6ª (mi grave) à 1ª (mi agudo), em Hz. */
export const CORDAS_SOLTAS = [82.41, 110, 146.83, 196, 246.94, 329.63] as const;

/** Frequência de cada corda tocada no acorde (casas de -1 a n, da 6ª à 1ª corda). Cordas que não tocam ficam de fora. */
export function frequenciasDoAcorde(casas: readonly number[]): number[] {
  return casas.flatMap((casa, corda) => (casa < 0 || corda >= CORDAS_SOLTAS.length ? [] : [CORDAS_SOLTAS[corda] * 2 ** (casa / 12)]));
}

function escreverTexto(visao: DataView, posicao: number, texto: string) {
  for (let indice = 0; indice < texto.length; indice += 1) visao.setUint8(posicao + indice, texto.charCodeAt(indice));
}

/** Gerador de ruído determinístico: o mesmo som sai sempre igual. */
function criarRuido() {
  let semente = 0x2f6b4c1d;
  return () => {
    semente = (Math.imul(semente, 1664525) + 1013904223) >>> 0;
    return (semente / 0xffffffff) * 2 - 1;
  };
}

/** Soma à mistura uma corda dedilhada (Karplus-Strong) que começa em `inicio` (em amostras). */
function dedilhar(mistura: Float32Array, taxa: number, frequencia: number, inicio: number, ganho: number, amortecimento: number, ruido: () => number) {
  const periodo = Math.max(2, Math.round(taxa / frequencia));
  // O ataque começa com ruído suavizado: a palheta (ou o dedo) solta todas as frequências de uma vez.
  const vibracao = new Float32Array(periodo);
  let anterior = 0;
  for (let indice = 0; indice < periodo; indice += 1) {
    anterior = 0.5 * (anterior + ruido());
    vibracao[indice] = anterior * ganho;
  }
  let posicao = 0;
  for (let amostra = Math.max(0, inicio); amostra < mistura.length; amostra += 1) {
    const atual = vibracao[posicao];
    const seguinte = vibracao[(posicao + 1) % periodo];
    vibracao[posicao] = amortecimento * 0.5 * (atual + seguinte);
    mistura[amostra] += atual;
    posicao = (posicao + 1) % periodo;
  }
}

/** Normaliza a mistura, aplica uma saída suave e escreve o WAV (PCM de 16 bits, mono). */
function paraWav(mistura: Float32Array, taxa: number): Uint8Array {
  const total = mistura.length;
  let pico = 0;
  for (const valor of mistura) pico = Math.max(pico, Math.abs(valor));
  const ganho = pico > 0 ? 0.85 / pico : 0;
  const saida = Math.round(taxa * 0.3);
  const bytes = new Uint8Array(44 + total * 2);
  const visao = new DataView(bytes.buffer);
  escreverTexto(visao, 0, 'RIFF');
  visao.setUint32(4, 36 + total * 2, true);
  escreverTexto(visao, 8, 'WAVE');
  escreverTexto(visao, 12, 'fmt ');
  visao.setUint32(16, 16, true);
  visao.setUint16(20, 1, true);
  visao.setUint16(22, 1, true);
  visao.setUint32(24, taxa, true);
  visao.setUint32(28, taxa * 2, true);
  visao.setUint16(32, 2, true);
  visao.setUint16(34, 16, true);
  escreverTexto(visao, 36, 'data');
  visao.setUint32(40, total * 2, true);
  for (let indice = 0; indice < total; indice += 1) {
    const envelope = indice > total - saida ? (total - indice) / saida : 1;
    const amostra = Math.max(-1, Math.min(1, mistura[indice] * ganho * envelope));
    visao.setInt16(44 + indice * 2, Math.round(amostra * 32767), true);
  }
  return bytes;
}

/**
 * WAV do acorde. `casas` tem 6 números, da 6ª à 1ª corda: -1 não toca, 0 solta, n é a casa apertada.
 * `taxa` é a taxa de amostragem; `segundos`, a duração; `intervalo`, o tempo entre uma corda e a próxima na batida.
 */
export function sintetizarAcorde(casas: readonly number[], { taxa = 22050, segundos = 2.6, intervalo = 0.035 } = {}): Uint8Array {
  const mistura = new Float32Array(Math.round(taxa * segundos));
  const ruido = criarRuido();
  frequenciasDoAcorde(casas).forEach((frequencia, ordem) => {
    // Cordas graves soam por mais tempo; o amortecimento cresce um pouco nas agudas.
    dedilhar(mistura, taxa, frequencia, Math.round(ordem * intervalo * taxa), 1, 0.9965 - ordem * 0.0004, ruido);
  });
  return paraWav(mistura, taxa);
}

/**
 * WAV da batida mais simples, em 4 tempos: a mão desce em cada tempo (das cordas graves para as agudas) e sobe entre
 * eles (das agudas para as graves, mais leve), com o primeiro tempo do compasso um pouco mais forte.
 */
export function sintetizarBatida(casas: readonly number[], { taxa = 22050, bpm = 72, compassos = 2 } = {}): Uint8Array {
  const tempo = 60 / bpm;
  const batidas = compassos * 4;
  const mistura = new Float32Array(Math.round(taxa * (batidas * tempo + 1.6)));
  const ruido = criarRuido();
  const frequencias = frequenciasDoAcorde(casas);
  for (let batida = 0; batida < batidas; batida += 1) {
    const descida = Math.round(batida * tempo * taxa);
    const forca = batida % 4 === 0 ? 1.15 : 1;
    frequencias.forEach((frequencia, ordem) => dedilhar(mistura, taxa, frequencia, descida + Math.round(ordem * 0.012 * taxa), forca, 0.993, ruido));
    const subida = descida + Math.round((tempo / 2) * taxa);
    [...frequencias].reverse().slice(0, 4).forEach((frequencia, ordem) =>
      dedilhar(mistura, taxa, frequencia, subida + Math.round(ordem * 0.01 * taxa), 0.55, 0.993, ruido));
  }
  return paraWav(mistura, taxa);
}

const ALFABETO_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 dos bytes, sem depender de `btoa` (que não existe em todo ambiente). */
export function paraBase64(bytes: Uint8Array): string {
  let saida = '';
  for (let indice = 0; indice < bytes.length; indice += 3) {
    const a = bytes[indice];
    const b = indice + 1 < bytes.length ? bytes[indice + 1] : 0;
    const c = indice + 2 < bytes.length ? bytes[indice + 2] : 0;
    const tripla = (a << 16) | (b << 8) | c;
    saida += ALFABETO_BASE64[(tripla >> 18) & 63] + ALFABETO_BASE64[(tripla >> 12) & 63];
    saida += indice + 1 < bytes.length ? ALFABETO_BASE64[(tripla >> 6) & 63] : '=';
    saida += indice + 2 < bytes.length ? ALFABETO_BASE64[tripla & 63] : '=';
  }
  return saida;
}
