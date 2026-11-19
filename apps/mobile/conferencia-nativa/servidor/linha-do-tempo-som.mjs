// A linha do tempo da prova da criação de trilha: os comandos do Maestro (o gesto, a tela que apareceu, a captura) e os
// eventos de áudio registrados enquanto o fluxo rodava, numa escala só, com o zero no toque em "Montar minha trilha".
// Três origens que não se confundem:
//   - comando: o gesto do Maestro (commands.json) e, se o app registrar, a chamada de som no app ("[som] comando <id> <ms>");
//   - reprodução: o que o sistema de áudio registrou (iPhone: log stream do simulador; Android: logcat) e, se o app
//     registrar, o player dizendo que tocou ("[som] reproducao <id> <ms>");
//   - saída gravada: indisponível no CI (o simulador e o emulador não têm saída de áudio que se possa gravar; o emulador
//     roda com -noaudio). Não se mede latência física.
// O registro do app vem de apps/mobile/src/sons.ts (registrarSom, com EXPO_PUBLIC_STUDOO_REGISTRO_SOM=1):
// console.info(`[som] ${tipo} ${id} ${Date.now()}`), com tipo comando ou reproducao e o id do efeito ou do fundo. A mesma
// linha pode chegar por mais de um registro (o log do sistema e o do Metro): conta uma vez só.
// O fundo (o Lo-fi, que toca por baixo de tudo) manda amostras do que o expo-audio expõe do reprodutor (registrarFundo):
// "[som] fundo <id> <A|B> <tocando|parado> <pos_ms>/<dur_ms> <volume> <ms>", a cada atualização de estado (500 ms enquanto
// toca, e no play e no pause) e logo depois do comando de cada efeito e 200 ms depois. Com elas, a linha diz se o fundo
// seguiu ao trocar de tela e no acerto e no erro: sem pausa (o reprodutor parado ou a posição atrás do relógio), sem
// reinício (a posição voltando, ou o outro reprodutor entrando fora do fim da faixa) e sem redução (o volume do reprodutor
// abaixo do de referência). É o estado do reprodutor, não a mistura nem a saída no alto-falante, que o CI não tem.
// Uso: node linha-do-tempo-som.mjs --comandos <commands.json> --audio <registro> [--audio <outro>] --plataforma iphone|android
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: opcoes } = parseArgs({
  options: { comandos: { type: 'string', multiple: true }, audio: { type: 'string', multiple: true }, plataforma: { type: 'string', default: 'iphone' } },
});

const eventos = [];
let ano = new Date().getUTCFullYear();

// --- Comandos do Maestro (relógio da máquina do CI, em ms desde 1970): os do fluxo 90 e, se houver, os do 95.
for (const arquivo of (opcoes.comandos ?? []).filter((caminho) => existsSync(caminho))) {
  for (const item of JSON.parse(readFileSync(arquivo, 'utf8'))) {
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
      eventos.push({ t: fim, origem: 'tela (Maestro)', texto: `${alvo} à vista (${meta.status})`, alvo: seletor.idRegex });
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
const vistas = new Set();
const amostras = [];
for (const arquivo of (opcoes.audio ?? []).filter((caminho) => existsSync(caminho))) {
  for (const linha of readFileSync(arquivo, 'utf8').split('\n')) {
    const fundo = linha.match(/\[som\] fundo ([a-z0-9_]+) ([AB]) (tocando|parado) (\d+)\/(\d+) (\d+(?:\.\d+)?) (\d{13})/);
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

// --- O fundo: começo, voltas do laço e o que fugiu do contínuo (pausa, reinício, redução), sobre as amostras do reprodutor.
const efeitosDoApp = () => eventos.filter((evento) => evento.tipo === 'comando' && !amostras.some((amostra) => amostra.id === evento.som));
function analisarFundo(lista) {
  const ordem = [...lista].sort((a, b) => a.t - b.t);
  const inicio = ordem.find((amostra) => amostra.tocando);
  if (!inicio) return null;
  const ocorrencias = [];
  const voltas = [];
  const ultima = { A: null, B: null };
  let ativo = inicio.jogador;
  const subidaAte = inicio.t + 1200;
  const naTroca = (t) => voltas.some((volta) => t >= volta.t - 500 && t <= volta.t + 1500);
  const segmentos = [];
  let segmento = [];
  for (const amostra of ordem.filter((item) => item.t >= inicio.t)) {
    const anterior = ultima[amostra.jogador];
    if (amostra.jogador !== ativo && amostra.tocando) {
      const saindo = ultima[ativo];
      // O outro reprodutor entrou: volta do laço se o que saía estava no fim da faixa; senão, a música recomeçou.
      if (saindo && saindo.dur > 0 && saindo.pos >= saindo.dur - 3000) {
        voltas.push({ t: amostra.t, de: ativo, para: amostra.jogador });
      } else {
        ocorrencias.push({ t: amostra.t, tipo: 'reinício', texto: `o reprodutor ${amostra.jogador} entrou em ${(amostra.pos / 1000).toFixed(2)} s com o ${ativo} longe do fim da faixa (${saindo ? (saindo.pos / 1000).toFixed(2) : '?'} s)` });
      }
      ativo = amostra.jogador;
      if (segmento.length) segmentos.push(segmento);
      segmento = [];
    } else if (amostra.jogador === ativo && !amostra.tocando) {
      if (!naTroca(amostra.t)) ocorrencias.push({ t: amostra.t, tipo: 'pausa', texto: `o reprodutor ${ativo} parou em ${(amostra.pos / 1000).toFixed(2)} s` });
      if (segmento.length) segmentos.push(segmento);
      segmento = [];
    } else if (amostra.jogador === ativo && anterior?.tocando && amostra.pos < anterior.pos - 1000 && !(anterior.dur > 0 && anterior.pos >= anterior.dur - 3000)) {
      ocorrencias.push({ t: amostra.t, tipo: 'reinício', texto: `a posição voltou de ${(anterior.pos / 1000).toFixed(2)} s para ${(amostra.pos / 1000).toFixed(2)} s` });
      if (segmento.length) segmentos.push(segmento);
      segmento = [amostra];
    } else if (amostra.jogador === ativo) {
      segmento.push(amostra);
    }
    ultima[amostra.jogador] = amostra;
  }
  if (segmento.length) segmentos.push(segmento);
  // Pausa sem "parado": a posição para enquanto o relógio anda. O registro chega pelo JavaScript, que pode atrasar uma
  // amostra (o relógio dela adianta), mas nunca a deixa à frente da posição: vale o piso de t - posição nas próximas seis.
  // Um degrau que cresce em amostras seguidas é uma pausa só; se o piso volta ao de antes, era atraso do registro.
  for (const trecho of segmentos) {
    const pisos = [];
    for (let i = 0; i + 3 <= trecho.length; i += 1) pisos.push(Math.min(...trecho.slice(i, i + 6).map((amostra) => amostra.t - amostra.pos)));
    let base = pisos[0];
    let aberta = null;
    pisos.forEach((piso, i) => {
      if (piso - base > 400) {
        aberta ??= { t: trecho[i].t, ms: 0, estavel: 0 };
        aberta.estavel = piso - base <= aberta.ms + 50 ? aberta.estavel + 1 : 0;
        aberta.ms = Math.max(aberta.ms, piso - base);
        if (aberta.estavel >= 2) {
          ocorrencias.push({ t: aberta.t, tipo: 'pausa', texto: `a posição do reprodutor ${trecho[i].jogador} parou ${aberta.ms} ms enquanto o relógio andava` });
          base = piso;
          aberta = null;
        }
      } else {
        aberta = null;
        base = Math.min(base, piso);
      }
    });
    if (aberta) ocorrencias.push({ t: aberta.t, tipo: 'pausa', texto: `a posição do reprodutor ${trecho[0].jogador} parou ${aberta.ms} ms enquanto o relógio andava (no fim das amostras)` });
  }
  // Volume: o de referência é o maior do reprodutor que toca depois da subida; abaixo dele (fora da subida e das voltas do
  // laço), é redução, no efeito se começou até 1 s depois do comando de um efeito.
  const tocandoAtivo = segmentos.flat().filter((amostra) => amostra.t > subidaAte && !naTroca(amostra.t));
  const referencia = tocandoAtivo.length ? Math.max(...tocandoAtivo.map((amostra) => amostra.vol)) : null;
  let reducao = null;
  const fecharReducao = () => {
    if (!reducao) return;
    const efeito = efeitosDoApp().find((evento) => reducao.t >= evento.t - 200 && reducao.t <= evento.t + 1000);
    const duracao = reducao.n > 1 ? `${reducao.n} amostras, ${((reducao.ate - reducao.t) / 1000).toFixed(2)} s` : '1 amostra';
    ocorrencias.push({ t: reducao.t, tipo: efeito ? 'redução no efeito' : 'redução fora de efeito', texto: `o volume do reprodutor foi a ${reducao.minimo.toFixed(3)} (referência ${referencia.toFixed(3)}; ${duracao})${efeito ? `, perto do comando de ${efeito.som}` : ''}` });
    reducao = null;
  };
  for (const amostra of tocandoAtivo) {
    if (referencia !== null && amostra.vol < referencia - 0.01) {
      reducao ??= { t: amostra.t, ate: amostra.t, minimo: amostra.vol, n: 0 };
      reducao.n += 1;
      reducao.ate = amostra.t;
      reducao.minimo = Math.min(reducao.minimo, amostra.vol);
    } else {
      fecharReducao();
    }
  }
  fecharReducao();
  ocorrencias.sort((a, b) => a.t - b.t);
  return { inicio, fim: ordem[ordem.length - 1], ocorrencias, voltas, referencia, ordem };
}
const analise = analisarFundo(amostras);
if (analise) {
  const { inicio } = analise;
  eventos.push({ t: inicio.t, origem: 'fundo (player do app)', texto: `${inicio.id} tocando (reprodutor ${inicio.jogador}, posição ${(inicio.pos / 1000).toFixed(2)} s, volume ${inicio.vol.toFixed(3)})` });
  for (const volta of analise.voltas) eventos.push({ t: volta.t, origem: 'fundo (player do app)', texto: `volta do laço: o reprodutor ${volta.para} entra no fim da faixa do ${volta.de}` });
  for (const ocorrencia of analise.ocorrencias) eventos.push({ t: ocorrencia.t, origem: 'fundo (player do app)', texto: `${ocorrencia.tipo.toUpperCase()}: ${ocorrencia.texto}` });
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
console.log(`Eventos de áudio do sistema: ${doSistema}. Registros de som do app: ${doApp}${doApp ? '' : ' (o app não registra os sons que toca; ver LEIA-ME)'}. Amostras do fundo: ${amostras.length}.`);
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
      const amostra = comando ? amostras.find((item) => item.t >= comando.t + de && item.t <= comando.t + ate) : null;
      return amostra ? `${amostra.tocando ? 'tocando' : 'PARADO'} em ${(amostra.pos / 1000).toFixed(2)} s, volume ${amostra.vol.toFixed(3)}` : 'sem amostra';
    };
    const partes = [
      comando ? `resposta confirmada (o app manda tocar ${comando.som}) ${s(toque.t, comando.t)} depois do toque` : 'sem registro do som do resultado no app',
      reproducao ? `início relatado pelo player ${s(comando.t, reproducao.t)} depois do comando` : comando ? 'sem início relatado pelo player' : null,
      retorno ? `retorno à vista no Maestro ${s(toque.t, retorno.t)} depois do toque (pelo ritmo das leituras de tela)` : 'retorno não visto pelo Maestro',
      comando && amostras.length ? `fundo no comando: ${noFundo(0, 150)}; 200 ms depois: ${noFundo(150, 400)}` : null,
      'saída no alto-falante: não medida (CI sem saída de áudio)',
    ].filter(Boolean);
    console.log(`  ${posicao + 1}. toque em Verificar em ${((toque.t - zero) / 1000).toFixed(3)} s: ${partes.join('; ')}.`);
  });
}

// --- O fundo em cada troca de tela dos fluxos 90 e 95 (de 1 s antes do toque a 2,5 s depois) e o veredito.
const TELAS = [
  [/^nav-objetivo$/, 'aba Objetivo'], [/^gerar-trilha$/, 'geração da trilha'], [/^comecar-trilha$/, 'etapa 1 da primeira lição'],
  [/^voltar-plano$/, 'mapa da trilha'], [/^comecar-licao$/, 'lição pelo mapa'], [/Começar\|Continuar/, 'lição pelo mapa'],
  [/^ler-mais\|avancar-licao$/, 'próxima etapa da lição'], [/^enviar-resposta$/, 'retorno da resposta'], [/^tentar-de-novo$/, 'nova tentativa'],
];
console.log('');
if (!analise) {
  console.log(amostras.length
    ? 'Fundo: as amostras do reprodutor de fundo não o mostram tocando nesta janela.'
    : 'Fundo: sem amostras do reprodutor de fundo (o app desta árvore não as registra, ou o fundo não tocou). Nada a afirmar sobre pausa, reinício ou redução.');
} else {
  console.log('O fundo em cada troca de tela (amostras do reprodutor de 1 s antes do toque a 2,5 s depois):');
  for (const evento of eventos.filter((item) => item.origem === 'comando (Maestro)')) {
    const tela = TELAS.find(([padrao]) => padrao.test(evento.alvo ?? '') || (!evento.alvo && padrao.test(evento.texto)));
    if (!tela) continue;
    const janela = analise.ordem.filter((amostra) => amostra.t >= evento.t - 1000 && amostra.t <= evento.t + 2500);
    const tocando = janela.filter((amostra) => amostra.tocando);
    const problemas = analise.ocorrencias.filter((ocorrencia) => ocorrencia.t >= evento.t - 1000 && ocorrencia.t <= evento.t + 2500);
    const quando = `${((evento.t - zero) / 1000).toFixed(3)} s`;
    if (!janela.length) {
      console.log(`  - ${quando}, ${tela[1]}: sem amostra do fundo${evento.t < analise.inicio.t ? ' (antes de o fundo começar)' : ''}.`);
      continue;
    }
    const mesmo = tocando.filter((amostra) => amostra.jogador === tocando[tocando.length - 1]?.jogador);
    const andou = mesmo.length > 1 ? `posição ${(mesmo[0].pos / 1000).toFixed(2)} → ${(mesmo[mesmo.length - 1].pos / 1000).toFixed(2)} s em ${((mesmo[mesmo.length - 1].t - mesmo[0].t) / 1000).toFixed(2)} s de relógio` : 'uma amostra só';
    const volumes = tocando.map((amostra) => amostra.vol);
    const volume = volumes.length ? (Math.max(...volumes) - Math.min(...volumes) <= 0.01 ? `volume ${volumes[0].toFixed(3)}` : `volume de ${Math.min(...volumes).toFixed(3)} a ${Math.max(...volumes).toFixed(3)}`) : 'sem volume';
    const veredito = problemas.length ? problemas.map((ocorrencia) => ocorrencia.tipo.toUpperCase()).join(', ') : tocando.length === janela.length ? 'seguiu' : 'parado em parte da janela';
    const comeco = analise.inicio.t >= evento.t - 1000 && analise.inicio.t <= evento.t + 2500 ? ' (o fundo começa aqui, com a subida de 600 ms)' : '';
    console.log(`  - ${quando}, ${tela[1]}: ${veredito}; tocando em ${tocando.length} de ${janela.length} amostras; ${andou}; ${volume}${comeco}.`);
  }
  const conta = (tipo) => analise.ocorrencias.filter((ocorrencia) => ocorrencia.tipo === tipo).length;
  console.log('');
  console.log(`Fundo: ${analise.inicio.id} de ${((analise.inicio.t - zero) / 1000).toFixed(3)} s a ${((analise.fim.t - zero) / 1000).toFixed(3)} s, ${analise.ordem.length} amostras do reprodutor; `
    + `pausas ${conta('pausa')}, reinícios ${conta('reinício')}, reduções no efeito ${conta('redução no efeito')}, outras reduções ${conta('redução fora de efeito')}; `
    + `voltas do laço ${analise.voltas.length}; volume de referência ${analise.referencia?.toFixed(3) ?? '?'}. Estado do reprodutor (expo-audio), não a saída no alto-falante.`);
}
