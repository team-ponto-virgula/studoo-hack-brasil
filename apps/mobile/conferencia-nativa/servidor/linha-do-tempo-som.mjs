// A linha do tempo da prova da criação de trilha: os comandos do Maestro (o gesto, a tela que apareceu, a captura) e os
// eventos de áudio registrados enquanto o fluxo rodava, numa escala só, com o zero no toque em "Montar minha trilha".
// Três origens que não se confundem:
//   - comando: o gesto do Maestro (commands.json) e, se o app registrar, a chamada de som no app ("[som] comando <id> <ms>");
//   - reprodução: o que o sistema de áudio registrou (iPhone: log stream do simulador; Android: logcat) e, se o app
//     registrar, o player dizendo que tocou ("[som] reproducao <id> <ms>");
//   - saída gravada: indisponível no CI (o simulador e o emulador não têm saída de áudio que se possa gravar; o emulador
//     roda com -noaudio). Não se mede latência física.
// Uso: node linha-do-tempo-som.mjs --comandos <commands.json> --audio <registro> --plataforma iphone|android
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: opcoes } = parseArgs({
  options: { comandos: { type: 'string' }, audio: { type: 'string' }, plataforma: { type: 'string', default: 'iphone' } },
});

const eventos = [];
let ano = new Date().getUTCFullYear();

// --- Comandos do Maestro (relógio da máquina do CI, em ms desde 1970).
if (opcoes.comandos && existsSync(opcoes.comandos)) {
  for (const item of JSON.parse(readFileSync(opcoes.comandos, 'utf8'))) {
    const meta = item.metadata ?? {};
    if (!meta.timestamp) continue;
    ano = new Date(meta.timestamp).getUTCFullYear();
    const [tipo, corpo] = Object.entries(item.command ?? {})[0] ?? ['?', {}];
    const seletor = corpo?.selector ?? corpo?.condition?.visible ?? {};
    const alvo = seletor.idRegex ? `id ${seletor.idRegex}` : seletor.textRegex ? `"${seletor.textRegex}"` : '';
    const fim = meta.timestamp + (meta.duration ?? 0);
    if (tipo === 'tapOnElementCommand') {
      eventos.push({ t: meta.timestamp, origem: 'comando (Maestro)', texto: `toque em ${alvo}: começo do comando (${meta.status})`, alvo: seletor.idRegex });
    } else if (tipo === 'assertConditionCommand' && corpo?.condition?.visible) {
      eventos.push({ t: fim, origem: 'tela (Maestro)', texto: `${alvo} à vista (${meta.status})` });
    } else if (tipo === 'takeScreenshotCommand') {
      eventos.push({ t: meta.timestamp, origem: 'captura (Maestro)', texto: corpo.path });
    } else if (tipo === 'startRecordingCommand' || tipo === 'stopRecordingCommand') {
      eventos.push({ t: meta.timestamp, origem: 'vídeo (Maestro)', texto: tipo === 'startRecordingCommand' ? `começa ${corpo.path}.mp4` : 'para o vídeo' });
    }
  }
}

// --- Registro de áudio. iPhone (log stream, estilo padrão): "2026-11-19 18:13:34.291123+0000  0x… Default … texto", com o
// fuso; sem ele (estilo compact), vale UTC, o fuso das máquinas do CI. Android (logcat -v threadtime -v epoch):
// "1795107142.588  436  512 D Etiqueta: texto", em segundos desde 1970; sem o epoch (só threadtime), vale UTC, com o ano
// dos comandos.
let doSistema = 0;
let doApp = 0;
if (opcoes.audio && existsSync(opcoes.audio)) {
  for (const linha of readFileSync(opcoes.audio, 'utf8').split('\n')) {
    const app = linha.match(/\[som\] (comando|reproducao) ([a-z0-9_]+) (\d{13})/);
    if (app) {
      doApp += 1;
      eventos.push({ t: Number(app[3]), origem: app[1] === 'comando' ? 'comando (app)' : 'reprodução (player do app)', texto: app[2] });
      continue;
    }
    let t = null;
    let texto = '';
    const ios = linha.match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)(\.\d+)?([+-]\d\d)?:?(\d\d)?\s+(.*)$/);
    const epoch = linha.match(/^\s*(\d{10})\.(\d{3})\s+\d+\s+\d+\s+[VDIWEF]\s+(.*)$/);
    const android = linha.match(/^(\d\d)-(\d\d) (\d\d:\d\d:\d\d\.\d{3})\s+\d+\s+\d+\s+[VDIWEF]\s+(.*)$/);
    if (ios) {
      const fracao = (ios[3] ?? '.000').slice(0, 4).padEnd(4, '0');
      const fuso = ios[4] ? `${ios[4]}:${ios[5] ?? '00'}` : 'Z';
      t = Date.parse(`${ios[1]}T${ios[2]}${fracao}${fuso}`);
      texto = ios[6];
    } else if (epoch) {
      t = Number(epoch[1]) * 1000 + Number(epoch[2]);
      texto = epoch[3];
    } else if (android) {
      t = Date.parse(`${ano}-${android[1]}-${android[2]}T${android[3]}Z`);
      texto = android[4];
    }
    if (t === null || Number.isNaN(t)) continue;
    doSistema += 1;
    eventos.push({ t, origem: 'reprodução (sistema)', texto: texto.replace(/\s+/g, ' ').slice(0, 150) });
  }
}

eventos.sort((a, b) => a.t - b.t);
const zero = eventos.find((evento) => evento.alvo === 'gerar-trilha')?.t ?? eventos[0]?.t ?? 0;
const comecar = eventos.find((evento) => evento.alvo === 'comecar-trilha')?.t ?? null;
const plataforma = opcoes.plataforma === 'android' ? 'Android' : 'iPhone';

console.log(`Linha do tempo da criação de trilha e do som, ${plataforma}`);
console.log('Zero: o começo do toque em gerar-trilha ("Montar minha trilha"). Comandos do Maestro no relógio da máquina do CI;');
console.log(plataforma === 'iPhone'
  ? 'registro de áudio no relógio do simulador, que é o da máquina (UTC).'
  : 'registro de áudio no relógio do emulador, acertado com o da máquina ao ligar (pode diferir em frações de segundo).');
console.log('Saída gravada: indisponível no CI (sem saída de áudio que se possa gravar no simulador nem no emulador, que roda com');
console.log('-noaudio). Latência física: não medida.');
console.log('');
for (const evento of eventos) {
  const segundos = ((evento.t - zero) / 1000).toFixed(3).padStart(9);
  console.log(`${segundos} s  ${evento.origem.padEnd(27)} ${evento.texto}`);
}
console.log('');
console.log(`Eventos de áudio do sistema: ${doSistema}. Registros de som do app: ${doApp}${doApp ? '' : ' (o app não registra os sons que toca; ver LEIA-ME)'}.`);
if (comecar !== null) {
  const antes = eventos.filter((evento) => evento.t < comecar && evento.origem.startsWith('reprodução')).length;
  const depois = eventos.filter((evento) => evento.t >= comecar && evento.origem.startsWith('reprodução')).length;
  console.log(`Reprodução antes do toque em comecar-trilha: ${antes}; depois: ${depois}.`);
}
