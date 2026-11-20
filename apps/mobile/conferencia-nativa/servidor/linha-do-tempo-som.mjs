// A linha do tempo da prova da criação de trilha e das respostas (fluxos 90 e 95): os comandos do Maestro (o gesto, a tela
// que apareceu, a captura) e os eventos de áudio registrados enquanto os fluxos rodavam, numa escala só, com o zero no toque
// em "Montar minha trilha".
// Três origens que não se confundem:
//   - comando: o gesto do Maestro (commands.json) e, se o app registrar, a chamada de som no app ("[som] comando <id> <ms>");
//   - reprodução: o que o sistema de áudio registrou (iPhone: log stream do simulador; Android: logcat) e, se o app
//     registrar, o player dizendo que tocou ("[som] reproducao <id> <ms>");
//   - saída gravada: indisponível no CI (o simulador e o emulador não têm saída de áudio que se possa gravar; o emulador
//     roda com -noaudio). Não se mede latência física.
// O registro do app vem de apps/mobile/src/sons.ts, com EXPO_PUBLIC_STUDOO_REGISTRO_SOM=1: "[som] <tipo> <id> <Date.now()>",
// com tipo comando ou reproducao e o id do efeito ou do fundo. A mesma linha pode chegar por mais de um registro (o log do
// sistema e o do Metro): conta uma vez só.
//
// O fundo (o Lo-fi de Estudo, lofi_estudo, que toca por baixo de tudo) manda amostras do que o expo-audio expõe do
// reprodutor: "[som] fundo <id> <A|B> <tocando|parado> <pos_ms>/<dur_ms> <volume> <ms>", a cada atualização de estado
// (500 ms enquanto toca, e no play e no pause) e logo depois do comando de cada efeito e 200 ms depois; A e B são os dois
// reprodutores que se alternam na volta do laço. Só contam as amostras da janela dos fluxos: da última reabertura do app
// (stopApp, openLink ou launchApp, no começo do fluxo 90) ao fim do último comando. O veredito é a linha "Fundo: ..." do fim,
// que vai para o sumário:
//   - FALHA: outra faixa tocando de fato (tocando e com volume), ou o lofi_estudo com pausa (o reprodutor parado, ou a
//     posição atrás do relógio), reinício (a posição voltando, ou o outro reprodutor entrando fora do fim da faixa) ou
//     volume abaixo do de referência fora da subida e das voltas do laço, em qualquer ponto da janela;
//   - CONTÍNUO: só sem falha, com o lofi_estudo identificado e cada ponto coberto: cada troca de tela observada (toque
//     concluído) com o lofi_estudo tocando antes e depois dela, a posição andando com o relógio e o volume mantido, e o erro
//     e o acerto do fluxo 95 do mesmo jeito, com amostra também durante o efeito;
//   - INCONCLUSIVO: o resto, que é dado ausente: sem amostras, registro que acaba antes, ponto sem amostra, o fluxo 95 que
//     não rodou ou não chegou ao "Verificar", o comando do erro ou do acerto fora do registro.
// É o estado do reprodutor, não a mistura nem a saída no alto-falante, que o CI não tem.
// Uso: node linha-do-tempo-som.mjs --comandos <commands.json> [--comandos <outro>] --audio <registro> [--audio <outro>]
//        --plataforma iphone|android [--fundo lofi_estudo]
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { analisarFundo } from './fundo-continuo.mjs';

const { values: opcoes } = parseArgs({
  options: {
    comandos: { type: 'string', multiple: true },
    audio: { type: 'string', multiple: true },
    plataforma: { type: 'string', default: 'iphone' },
    fundo: { type: 'string', default: 'lofi_estudo' },
  },
});
const FUNDO = opcoes.fundo;
const segundos = (ms) => `${(ms / 1000).toFixed(2)} s`;

const eventos = [];
let ano = new Date().getUTCFullYear();
let reabertura = null;
let ultimoComando = null;

// --- Comandos do Maestro (relógio da máquina do CI, em ms desde 1970): os do fluxo 90 e, se houver, os do 95. Vale o
// comando como rodou (evaluatedCommand: os parâmetros já trocados, como opcao-a), senão o do fluxo. No commands.json do
// Maestro 2.12, o toque é "tapOnElement" (o nome do campo em MaestroCommand), não "tapOnElementCommand".
const TOQUES = new Set(['tapOnElement', 'tapOnElementCommand']);
for (const arquivo of (opcoes.comandos ?? []).filter((caminho) => caminho && existsSync(caminho))) {
  for (const item of JSON.parse(readFileSync(arquivo, 'utf8'))) {
    const meta = item.metadata ?? {};
    if (!meta.timestamp) continue;
    ano = new Date(meta.timestamp).getUTCFullYear();
    const [tipo, corpo] = Object.entries(meta.evaluatedCommand ?? item.command ?? {})[0] ?? ['?', {}];
    const seletor = corpo?.selector ?? corpo?.condition?.visible ?? {};
    const alvo = seletor.idRegex ? `id ${seletor.idRegex}` : seletor.textRegex ? `"${seletor.textRegex}"` : '';
    const fim = meta.timestamp + (meta.duration ?? 0);
    ultimoComando = Math.max(ultimoComando ?? fim, fim);
    if (TOQUES.has(tipo)) {
      eventos.push({ t: meta.timestamp, fim, origem: 'comando (Maestro)', texto: `toque em ${alvo}: começo do comando (${meta.status})`,
        alvo: seletor.idRegex, alvoTexto: seletor.textRegex, status: meta.status });
    } else if (tipo === 'assertConditionCommand' && corpo?.condition?.visible) {
      eventos.push({ t: fim, origem: 'tela (Maestro)', texto: `${alvo} à vista (${meta.status})`, alvo: seletor.idRegex });
    } else if (tipo === 'takeScreenshotCommand') {
      eventos.push({ t: meta.timestamp, origem: 'captura (Maestro)', texto: corpo.path });
    } else if (tipo === 'startRecordingCommand' || tipo === 'stopRecordingCommand') {
      eventos.push({ t: meta.timestamp, origem: 'vídeo (Maestro)', texto: tipo === 'startRecordingCommand' ? `começa ${corpo.path}.mp4` : 'para o vídeo' });
    } else if (tipo === 'stopAppCommand' || tipo === 'openLinkCommand' || tipo === 'launchAppCommand') {
      reabertura = Math.max(reabertura ?? meta.timestamp, meta.timestamp);
      eventos.push({ t: meta.timestamp, origem: 'app (Maestro)', texto: tipo === 'stopAppCommand' ? 'fecha o app' : 'abre o app' });
    }
  }
}

// --- Registro de áudio. iPhone (log stream, estilo padrão): "2026-11-19 18:13:34.291123+0000  0x… Default … texto", com o
// fuso; sem ele (estilo compact), vale UTC, o fuso das máquinas do CI. Android (logcat -v threadtime -v epoch):
// "1795107142.588  436  512 D Etiqueta: texto", em segundos desde 1970; sem o epoch (só threadtime), vale UTC, com o ano
// dos comandos.
let doSistema = 0;
let doApp = 0;
const vistas = new Set();
const amostras = [];
for (const arquivo of (opcoes.audio ?? []).filter((caminho) => caminho && existsSync(caminho))) {
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    const fundo = linha.match(/\[som\] fundo ([a-z0-9_]+) ([AB?]) (tocando|parado) (\d+)\/(\d+) (\d+(?:\.\d+)?) (\d{13})/);
    if (fundo) {
      if (vistas.has(fundo[0])) continue;
      vistas.add(fundo[0]);
      amostras.push({ t: Number(fundo[7]), id: fundo[1], jogador: fundo[2], tocando: fundo[3] === 'tocando', pos: Number(fundo[4]), dur: Number(fundo[5]), vol: Number(fundo[6]) });
      continue;
    }
    const app = linha.match(/\[som\] (comando|reproducao) ([a-z0-9_]+) (\d{13})/);
    if (app) {
      if (vistas.has(app[0])) continue;
      vistas.add(app[0]);
      doApp += 1;
      eventos.push({ t: Number(app[3]), origem: app[1] === 'comando' ? 'comando (app)' : 'reprodução (player do app)', texto: app[2], som: app[2], tipo: app[1] });
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

// --- A janela do fundo: da última reabertura do app ao fim do último comando, com 2 s de folga. O que veio antes é de outra
// execução do app (fechar e abrir de novo recomeça a música, e isso não é reinício), e o Metro registra o job todo.
const inicioJanela = reabertura ?? -Infinity;
const fimJanela = ultimoComando === null ? Infinity : ultimoComando + 2000;
const naJanela = (t) => t >= inicioJanela && t <= fimJanela;
// Uma amostra sem o nome do reprodutor ("?" no lugar de A ou B) não entra na conta da continuidade: é dado incompleto.
const semNome = amostras.filter((amostra) => naJanela(amostra.t) && amostra.jogador === '?').length;
const daJanela = amostras.filter((amostra) => naJanela(amostra.t) && amostra.jogador !== '?').sort((a, b) => a.t - b.t);
const tocandoDeFato = (amostra) => amostra.tocando && amostra.vol > 0.001;
const outrasFaixas = [...new Set(daJanela.filter((amostra) => amostra.id !== FUNDO && tocandoDeFato(amostra)).map((amostra) => amostra.id))];
const doFundo = daJanela.filter((amostra) => amostra.id === FUNDO);
const idsDeFundo = new Set(amostras.map((amostra) => amostra.id));
const efeitosDoApp = eventos.filter((evento) => evento.tipo === 'comando' && evento.som !== FUNDO && !idsDeFundo.has(evento.som));

const analise = analisarFundo(doFundo, efeitosDoApp);
if (analise) {
  const { inicio } = analise;
  eventos.push({ t: inicio.t, origem: 'fundo (player do app)', texto: `${inicio.id} tocando (reprodutor ${inicio.jogador}, posição ${segundos(inicio.pos)}, volume ${inicio.vol.toFixed(3)})` });
  for (const volta of analise.voltas) eventos.push({ t: volta.t, origem: 'fundo (player do app)', texto: `volta do laço: o reprodutor ${volta.para} entra no fim da faixa do ${volta.de}` });
  for (const ocorrencia of analise.ocorrencias) eventos.push({ t: ocorrencia.t, origem: 'fundo (player do app)', texto: `${ocorrencia.tipo.toUpperCase()}: ${ocorrencia.texto}` });
}
for (const id of outrasFaixas) {
  const primeira = daJanela.find((amostra) => amostra.id === id && tocandoDeFato(amostra));
  eventos.push({ t: primeira.t, origem: 'fundo (player do app)', texto: `OUTRA FAIXA: ${id} tocando (reprodutor ${primeira.jogador}, volume ${primeira.vol.toFixed(3)})` });
}

eventos.sort((a, b) => a.t - b.t);
const zero = eventos.find((evento) => evento.alvo === 'gerar-trilha')?.t ?? eventos[0]?.t ?? 0;
const quando = (t) => `${((t - zero) / 1000).toFixed(3)} s`;
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
for (const evento of eventos) console.log(`${quando(evento.t).padStart(11)}  ${evento.origem.padEnd(27)} ${evento.texto}`);
console.log('');
console.log(`Eventos de áudio do sistema: ${doSistema}. Registros de som do app: ${doApp}${doApp ? '' : ' (o app não registra os sons que toca; ver LEIA-ME)'}. `
  + `Amostras do fundo: ${amostras.length}, ${daJanela.length} na janela dos fluxos.`);
if (comecar !== null) {
  const antes = eventos.filter((evento) => evento.t < comecar && evento.origem.startsWith('reprodução')).length;
  const depois = eventos.filter((evento) => evento.t >= comecar && evento.origem.startsWith('reprodução')).length;
  console.log(`Reprodução antes do toque em comecar-trilha: ${antes}; depois: ${depois}.`);
}

// --- As respostas do fluxo 95: para cada toque em "Verificar" (enviar-resposta), o retorno à vista, o comando do som do
// resultado no app (acerto ou erro: o app o manda tocar quando a avaliação volta do servidor, o instante da resposta
// confirmada) e o início que o player relata. A saída no alto-falante não é medida.
const toques = eventos.filter((evento) => evento.alvo === 'enviar-resposta');
if (toques.length) {
  console.log('');
  console.log('Respostas (fluxo 95), contadas a partir de cada toque em "Verificar":');
  toques.forEach((toque, posicao) => {
    const limite = toques[posicao + 1]?.t ?? Infinity;
    const depoisDoToque = (evento) => evento.t >= toque.t && evento.t < limite;
    const retorno = eventos.find((evento) => depoisDoToque(evento) && evento.origem === 'tela (Maestro)' && /tentar-de-novo|continuar-licao/.test(evento.alvo ?? ''));
    const comando = eventos.find((evento) => depoisDoToque(evento) && evento.tipo === 'comando' && /^(acerto|erro)$/.test(evento.som));
    const reproducao = comando ? eventos.find((evento) => evento.t >= comando.t && evento.t < limite && evento.tipo === 'reproducao' && evento.som === comando.som) : null;
    const s = (de, ate) => `${((ate - de) / 1000).toFixed(3)} s`;
    const noFundo = (de, ate) => {
      const amostra = comando ? daJanela.find((item) => item.t >= comando.t + de && item.t <= comando.t + ate) : null;
      return amostra ? `${amostra.id} ${amostra.tocando ? 'tocando' : 'PARADO'} em ${segundos(amostra.pos)}, volume ${amostra.vol.toFixed(3)}` : 'sem amostra';
    };
    const partes = [
      comando ? `resposta confirmada (o app manda tocar ${comando.som}) ${s(toque.t, comando.t)} depois do toque` : 'sem registro do som do resultado no app',
      reproducao ? `início relatado pelo player ${s(comando.t, reproducao.t)} depois do comando` : comando ? 'sem início relatado pelo player' : null,
      retorno ? `retorno à vista no Maestro ${s(toque.t, retorno.t)} depois do toque (pelo ritmo das leituras de tela)` : 'retorno não visto pelo Maestro',
      comando && daJanela.length ? `fundo no comando: ${noFundo(0, 150)}; 200 ms depois: ${noFundo(150, 400)}` : null,
      'saída no alto-falante: não medida (CI sem saída de áudio)',
    ].filter(Boolean);
    console.log(`  ${posicao + 1}. toque em Verificar em ${quando(toque.t)}: ${partes.join('; ')}.`);
  });
}

// --- Os pontos do fundo. Troca de tela: o lofi_estudo tocando de 3 s antes do toque até 300 ms depois do começo dele e do
// fim do toque (com a espera da tela) a 3 s depois, a posição andando com o relógio entre os dois lados (o piso de
// t - posição, como acima) e o volume mantido. Erro e acerto: o mesmo em volta do comando do som, com amostra também
// durante o efeito (até 400 ms depois do comando).
const LIMITE_POSICAO_MS = 400;
function conferirPonto({ antes, depois, durante = null, volume }) {
  if (!analise) return { estado: 'inconclusivo', texto: `sem o ${FUNDO} tocando nas amostras` };
  const tocandoEm = ([de, ate]) => analise.ordem.filter((amostra) => amostra.tocando && amostra.t >= de && amostra.t <= ate);
  const a = tocandoEm(antes);
  const d = tocandoEm(depois);
  const u = durante ? tocandoEm(durante) : null;
  const de = Math.min(antes[0], volume[0]);
  const ate = Math.max(depois[1], volume[1]);
  const problemas = [];
  const outras = daJanela.filter((amostra) => amostra.id !== FUNDO && tocandoDeFato(amostra) && amostra.t >= de && amostra.t <= ate);
  if (outras.length) problemas.push(`outra faixa tocando (${[...new Set(outras.map((amostra) => amostra.id))].join(', ')})`);
  for (const ocorrencia of analise.ocorrencias.filter((item) => item.t >= de && item.t <= ate)) problemas.push(`${ocorrencia.tipo}: ${ocorrencia.texto}`);
  const fora = analise.referencia === null ? []
    : tocandoEm(volume).filter((amostra) => amostra.t > analise.subidaAte && !analise.naTroca(amostra.t) && Math.abs(amostra.vol - analise.referencia) > 0.01);
  if (fora.length && !problemas.some((problema) => problema.startsWith('redução'))) {
    problemas.push(`volume ${Math.min(...fora.map((amostra) => amostra.vol)).toFixed(3)}, fora da referência ${analise.referencia.toFixed(3)}`);
  }
  let posicao = '';
  if (a.length && d.length) {
    const ultimaAntes = a[a.length - 1];
    const primeiraDepois = d[0];
    const volta = analise.voltas.some((item) => item.t > ultimaAntes.t && item.t <= primeiraDepois.t);
    if (volta) {
      posicao = 'a posição seguiu, com a volta do laço no meio';
    } else if (ultimaAntes.jogador !== primeiraDepois.jogador) {
      problemas.push(`o reprodutor trocou de ${ultimaAntes.jogador} para ${primeiraDepois.jogador} fora do fim da faixa`);
    } else {
      const piso = (lista) => Math.min(...lista.filter((amostra) => amostra.jogador === ultimaAntes.jogador).map((amostra) => amostra.t - amostra.pos));
      const diferenca = piso(d) - piso(a);
      if (diferenca > LIMITE_POSICAO_MS) problemas.push(`a posição ficou ${diferenca} ms atrás do relógio`);
      else if (diferenca < -LIMITE_POSICAO_MS) problemas.push(`a posição pulou ${-diferenca} ms à frente do relógio`);
      posicao = `posição ${segundos(ultimaAntes.pos)} → ${segundos(primeiraDepois.pos)} em ${segundos(primeiraDepois.t - ultimaAntes.t)} de relógio`;
    }
  }
  if (problemas.length) return { estado: 'falha', texto: [...new Set(problemas)].join('; ') };
  const faltam = [!a.length && 'antes', u !== null && !u.length && 'durante o efeito', !d.length && 'depois'].filter(Boolean);
  if (faltam.length) return { estado: 'inconclusivo', texto: `sem amostra do ${FUNDO} tocando ${faltam.join(', ')}` };
  return { estado: 'coberto', texto: `tocando antes${u ? ', durante' : ''} e depois; ${posicao}; volume ${analise.referencia.toFixed(3)}` };
}

const TELAS = [
  [/^nav-objetivo$/, 'aba Objetivo'], [/^gerar-trilha$/, 'geração da trilha'], [/^comecar-trilha$/, 'etapa 1 da primeira lição'],
  [/^voltar-plano$/, 'mapa da trilha'], [/^comecar-licao$/, 'lição pelo mapa'], [/Começar\|Continuar/, 'lição pelo mapa'],
  [/^ler-mais\|avancar-licao$/, 'próxima etapa da lição'], [/^enviar-resposta$/, 'retorno da resposta'], [/^tentar-de-novo$/, 'nova tentativa'],
];
const pontos = [];
for (const evento of eventos.filter((item) => item.origem === 'comando (Maestro)' && item.status === 'COMPLETED' && naJanela(item.t))) {
  const tela = TELAS.find(([padrao]) => padrao.test(evento.alvo ?? '') || (!evento.alvo && padrao.test(evento.alvoTexto ?? '')));
  if (!tela) continue;
  const janela = { antes: [evento.t - 3000, evento.t + 300], depois: [evento.fim, evento.fim + 3000], volume: [evento.t - 3000, evento.fim + 3000] };
  let resultado;
  if (analise && analise.inicio.t >= evento.t - 300 && analise.inicio.t <= janela.depois[1]) {
    resultado = { estado: 'começo', texto: `o ${FUNDO} começa com este toque (subida de 600 ms)` };
  } else if (analise && janela.depois[1] < analise.inicio.t) {
    resultado = { estado: 'inconclusivo', texto: `antes de o ${FUNDO} começar` };
  } else {
    resultado = conferirPonto(janela);
  }
  pontos.push({ tipo: 'troca', nome: tela[1], t: evento.t, ...resultado });
}
const efeitos = eventos.filter((evento) => evento.tipo === 'comando' && (evento.som === 'erro' || evento.som === 'acerto') && naJanela(evento.t));
for (const efeito of efeitos) {
  const c = efeito.t;
  pontos.push({ tipo: 'efeito', nome: efeito.som, t: c, ...conferirPonto({ antes: [c - 3000, c + 50], durante: [c, c + 400], depois: [c + 150, c + 1500], volume: [c - 700, c + 1000] }) });
}
pontos.sort((a, b) => a.t - b.t);

// --- O veredito: FALHA com qualquer falha; CONTÍNUO só com tudo coberto; INCONCLUSIVO no resto (dado ausente).
const falhas = [];
const inconclusivos = [];
if (!amostras.length) inconclusivos.push('sem amostras do reprodutor de fundo no registro (o app desta árvore não as escreve, ou o registro não chegou)');
else if (!daJanela.length && !semNome) inconclusivos.push('nenhuma amostra do fundo entre a reabertura do app no fluxo 90 e o fim do fluxo 95');
if (semNome) inconclusivos.push(`${semNome} amostra(s) do fundo sem o nome do reprodutor (A ou B)`);
if (outrasFaixas.length) falhas.push(`outra faixa tocando: ${outrasFaixas.join(', ')}`);
if (daJanela.length && !doFundo.some(tocandoDeFato)) (outrasFaixas.length ? falhas : inconclusivos).push(`o ${FUNDO} não aparece tocando`);
for (const ocorrencia of analise?.ocorrencias ?? []) falhas.push(`${ocorrencia.tipo} em ${quando(ocorrencia.t)}: ${ocorrencia.texto}`);
if (!eventos.some((evento) => evento.alvo === 'enviar-resposta' && evento.status === 'COMPLETED')) inconclusivos.push('o fluxo 95 não rodou ou não chegou ao "Verificar"');
for (const som of ['erro', 'acerto']) if (!efeitos.some((efeito) => efeito.som === som)) inconclusivos.push(`sem o comando do ${som} no registro do app`);
const trocas = pontos.filter((ponto) => ponto.tipo === 'troca');
const exigidas = trocas.filter((ponto) => ponto.estado !== 'começo');
if (!exigidas.length) inconclusivos.push('nenhuma troca de tela observada depois do começo do fundo');
for (const ponto of pontos) {
  if (ponto.estado === 'falha') falhas.push(`${ponto.nome} em ${quando(ponto.t)}: ${ponto.texto}`);
  if (ponto.estado === 'inconclusivo') inconclusivos.push(`${ponto.nome} em ${quando(ponto.t)}: ${ponto.texto}`);
}
const veredito = falhas.length ? 'FALHA' : inconclusivos.length ? 'INCONCLUSIVO' : 'CONTÍNUO';

console.log('');
console.log('O fundo em cada ponto (troca de tela: de 3 s antes do toque a 3 s depois do fim dele; erro e acerto: antes, durante e depois do comando):');
if (!pontos.length) console.log('  (nenhum ponto: sem troca de tela concluída nem erro ou acerto na janela)');
for (const ponto of pontos) console.log(`  - ${quando(ponto.t)}, ${ponto.tipo === 'efeito' ? `${ponto.nome} (efeito)` : ponto.nome}: ${ponto.estado} — ${ponto.texto}.`);
const conta = (tipo) => (analise?.ocorrencias ?? []).filter((ocorrencia) => ocorrencia.tipo === tipo).length;
const estadoDo = (som) => {
  const lista = pontos.filter((ponto) => ponto.tipo === 'efeito' && ponto.nome === som);
  return lista.length ? lista.map((ponto) => ponto.estado).join('/') : 'sem dado';
};
const motivos = veredito === 'FALHA' ? falhas : inconclusivos;
const motivo = motivos.length ? ` Motivo: ${motivos.slice(0, 2).join(' | ')}${motivos.length > 2 ? ` (e mais ${motivos.length - 2})` : ''}.` : '';
console.log('');
console.log(`Fundo: ${veredito} — ${FUNDO}${analise ? '' : ' sem amostra tocando'}; trocas de tela cobertas ${exigidas.filter((ponto) => ponto.estado === 'coberto').length} de ${exigidas.length}`
  + `${trocas.length > exigidas.length ? ' (fora o toque em que o fundo começa)' : ''}; erro: ${estadoDo('erro')}; acerto: ${estadoDo('acerto')}; `
  + `pausas ${conta('pausa')}, reinícios ${conta('reinício')}, reduções ${conta('redução no efeito') + conta('redução fora de efeito')}; outras faixas: ${outrasFaixas.join(', ') || 'nenhuma'}; `
  + `${daJanela.length} amostras na janela${amostras.length > daJanela.length ? ` (${amostras.length - daJanela.length} fora dela)` : ''}; volume de referência ${analise?.referencia?.toFixed(3) ?? '?'}.`
  + `${motivo} Estado do reprodutor (expo-audio), não a saída no alto-falante.`);
