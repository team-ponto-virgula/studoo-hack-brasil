import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';
import { GET as configHttp } from '../src/app/api/auth/config/route.ts';
import { POST as encerrarHttp } from '../src/app/api/estudio/licoes/[id]/voz-ao-vivo/encerrar/route.ts';
import { POST as iniciarHttp } from '../src/app/api/estudio/licoes/[id]/voz-ao-vivo/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { DOMINIO_EMAIL_VISITANTE, PREFIXO_EMAIL_VISITANTE } from '../src/servidor/acesso/visitante.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { buscarApoio, criarPonte, ensinarStu } from '../src/servidor/estudio/apoio.ts';
import {
  configuracaoRealtime,
  montarInstrucoesVozAoVivo,
  vozAoVivoAtiva,
  vozAoVivoVisitanteAtiva,
} from '../src/servidor/ia/realtime.ts';
import {
  estadoInicialVozAoVivo,
  extrairTranscricaoUsuario,
  formatarTempoVoz,
  reduzirEventoRealtime,
} from '../src/app/voz-ao-vivo.ts';

const usuarios = [];
const chavesLimite = [];

async function criarUsuario(email = `voz-${crypto.randomUUID()}@example.test`) {
  const u = await banco.usuario.create({
    data: { email, fuso: 'UTC' },
  });
  usuarios.push(u.id);
  const { token } = await criarSessao(u.id);
  return { u, token };
}

async function criarLicaoPara(usuarioId) {
  const iaAnterior = process.env.IA;
  process.env.IA = 'falsa';
  try {
    const proposta = await gerarProposta(usuarioId, 'Aprender frações na cozinha');
    const plano = await aceitarProposta(usuarioId, proposta.token);
    return plano.fluxos[0].licoes[0];
  } finally {
    if (iaAnterior === undefined) delete process.env.IA;
    else process.env.IA = iaAnterior;
  }
}

function origemPadrao() {
  return process.env.APP_URL || 'http://localhost:3000';
}

function reqPrivada(url, token, body) {
  const origem = origemPadrao();
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: origem,
      cookie: cookieSessao(token),
    },
    body: JSON.stringify(body),
  });
}

function reqPublica(url) {
  return new Request(url, {
    method: 'GET',
    headers: { origin: origemPadrao() },
  });
}

const SDP_OFERTA = [
  'v=0',
  'o=- 1 1 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'c=IN IP4 0.0.0.0',
  'a=rtpmap:111 opus/48000/2',
  '',
].join('\r\n');

const SDP_RESPOSTA = [
  'v=0',
  'o=- 2 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'c=IN IP4 0.0.0.0',
  'a=rtpmap:111 opus/48000/2',
  '',
].join('\r\n');

after(async () => {
  if (chavesLimite.length) {
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: chavesLimite } } }).catch(() => undefined);
  }
  if (usuarios.length) {
    await banco.usuario.deleteMany({ where: { id: { in: usuarios } } }).catch(() => undefined);
  }
  await banco.$disconnect();
});

test('flags e configuração da voz ao vivo ficam desligadas por padrão e aceitam modelo/voz', () => {
  const envAntes = {
    STUDOO_VOZ_AO_VIVO: process.env.STUDOO_VOZ_AO_VIVO,
    STUDOO_VOZ_AO_VIVO_VISITANTE: process.env.STUDOO_VOZ_AO_VIVO_VISITANTE,
    IA: process.env.IA,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_REALTIME_MODELO: process.env.OPENAI_REALTIME_MODELO,
    OPENAI_REALTIME_VOZ: process.env.OPENAI_REALTIME_VOZ,
  };
  try {
    delete process.env.STUDOO_VOZ_AO_VIVO;
    delete process.env.STUDOO_VOZ_AO_VIVO_VISITANTE;
    process.env.IA = 'openai';
    process.env.OPENAI_API_KEY = 'sk-teste-falso';
    assert.equal(vozAoVivoAtiva(), false);
    assert.equal(vozAoVivoVisitanteAtiva(), false);
    assert.equal(configuracaoRealtime(), null);

    process.env.STUDOO_VOZ_AO_VIVO = '1';
    assert.equal(vozAoVivoAtiva(), true);
    assert.equal(vozAoVivoVisitanteAtiva(), false);
    assert.deepEqual(configuracaoRealtime()?.modelo, 'gpt-realtime-2.1');
    assert.deepEqual(configuracaoRealtime()?.voz, 'marin');

    process.env.STUDOO_VOZ_AO_VIVO_VISITANTE = '1';
    process.env.OPENAI_REALTIME_MODELO = 'gpt-realtime-custom';
    process.env.OPENAI_REALTIME_VOZ = 'alloy';
    assert.equal(vozAoVivoVisitanteAtiva(), true);
    assert.equal(configuracaoRealtime()?.modelo, 'gpt-realtime-custom');
    assert.equal(configuracaoRealtime()?.voz, 'alloy');
  } finally {
    for (const [k, v] of Object.entries(envAntes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('montarInstrucoesVozAoVivo inclui as 8 regras pedagógicas e incorpora erros do apoio quando existem', () => {
  const licao = {
    titulo: 'Numerador e denominador',
    objetivo: 'Distinguir partes escolhidas do total de partes iguais',
    conceito: 'O denominador indica o total de partes iguais.',
    exemplo: 'Em 3/8, 8 é o total de fatias.',
  };

  const base = montarInstrucoesVozAoVivo(licao, null);
  assert.match(base, /estudante curioso/i);
  assert.match(base, /falando primeiro/i);
  assert.match(base, /máximo 3 perguntas curtas/i);
  assert.match(base, /máximo 2 frases curtas por turno/i);
  assert.match(base, /2 tentativas/i);
  assert.match(base, /exemplo do dia a dia/i);
  assert.match(base, /nunca mencione XP, nota, pontuação ou ranking/i);
  assert.match(base, /português do Brasil/i);
  assert.match(base, /2 minutos e 30 segundos/i);
  assert.match(base, /3 minutos/i);
  assert.doesNotMatch(base, /dificuldade observada/i);

  const comErros = montarInstrucoesVozAoVivo(licao, {
    erros: 2,
    ponte: {
      motivo: 'Confundiu numerador com denominador',
      conceito: 'O número de baixo marca o total.',
      exemplo: 'Chocolate em 4 partes',
      exercicio: { pergunta: 'p', opcoes: ['a', 'b'] },
      concluida: false,
      simulado: true,
    },
    ensino: null,
  });
  assert.match(comErros, /2 erro\(s\) anteriores/);
  assert.match(comErros, /Confundiu numerador com denominador/);
  assert.match(comErros, /O número de baixo marca o total/);
});

test('rota /api/estudio/licoes/[id]/voz-ao-vivo retorna 404 desligada e /api/auth/config expõe vozAoVivo', async () => {
  const { u, token } = await criarUsuario();
  const licao = await criarLicaoPara(u.id);

  const envAntes = {
    STUDOO_VOZ_AO_VIVO: process.env.STUDOO_VOZ_AO_VIVO,
    IA: process.env.IA,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
  try {
    delete process.env.STUDOO_VOZ_AO_VIVO;
    const cfgOff = await (await configHttp(reqPublica(`${origemPadrao()}/api/auth/config`))).json();
    assert.equal(cfgOff.vozAoVivo, false);

    const res404 = await iniciarHttp(
      reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licao.id}/voz-ao-vivo`, token, { sdp: SDP_OFERTA }),
      { params: Promise.resolve({ id: licao.id }) },
    );
    assert.equal(res404.status, 404);
  } finally {
    for (const [k, v] of Object.entries(envAntes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('interface unificada com OpenAI simulada: safety identifier, semantic_vad low, hangup, limites e visitante', async () => {
  const recebidos = [];
  const hangups = [];
  let seq = 0;

  const servidor = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks).toString('utf8');

    if (req.method === 'POST' && req.url === '/v1/realtime/calls') {
      seq += 1;
      const callId = `rtc_sim_${seq}`;
      recebidos.push({
        auth: req.headers.authorization,
        safety: req.headers['openai-safety-identifier'],
        contentType: req.headers['content-type'],
        body,
        callId,
      });
      res.writeHead(201, {
        'content-type': 'application/sdp',
        location: `/v1/realtime/calls/${callId}`,
      });
      res.end(SDP_RESPOSTA);
      return;
    }

    const matchHangup = /^\/v1\/realtime\/calls\/([^/]+)\/hangup$/.exec(req.url || '');
    if (req.method === 'POST' && matchHangup) {
      hangups.push({ callId: decodeURIComponent(matchHangup[1]), auth: req.headers.authorization });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const { port } = servidor.address();
  const baseUrl = `http://127.0.0.1:${port}/v1`;

  const envAntes = {
    STUDOO_VOZ_AO_VIVO: process.env.STUDOO_VOZ_AO_VIVO,
    STUDOO_VOZ_AO_VIVO_VISITANTE: process.env.STUDOO_VOZ_AO_VIVO_VISITANTE,
    IA: process.env.IA,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  };

  try {
    process.env.STUDOO_VOZ_AO_VIVO = '1';
    delete process.env.STUDOO_VOZ_AO_VIVO_VISITANTE;
    process.env.IA = 'openai';
    process.env.OPENAI_API_KEY = 'sk-segredo-servidor-teste';
    process.env.OPENAI_BASE_URL = baseUrl;

    const cfgOn = await (await configHttp(reqPublica(`${origemPadrao()}/api/auth/config`))).json();
    assert.equal(cfgOn.vozAoVivo, true);

    const { u, token } = await criarUsuario();
    chavesLimite.push(`ia:voz:hora:${u.id}`, `ia:voz:dia:${u.id}`);
    const licao = await criarLicaoPara(u.id);

    // 1ª chamada: valida payload multipart, safety identifier e ausência da chave do servidor na resposta
    const r1 = await iniciarHttp(
      reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licao.id}/voz-ao-vivo`, token, { sdp: SDP_OFERTA }),
      { params: Promise.resolve({ id: licao.id }) },
    );
    assert.equal(r1.status, 200);
    const body1 = await r1.json();
    assert.equal(body1.chamadaId, 'rtc_sim_1');
    assert.equal(body1.sdpResposta.trim(), SDP_RESPOSTA.trim());
    assert.equal(body1.limiteSegundos, 180);
    assert.equal(body1.avisoSegundos, 150);
    assert.equal(JSON.stringify(body1).includes('sk-segredo-servidor-teste'), false);

    assert.equal(recebidos.length, 1);
    assert.equal(recebidos[0].auth, 'Bearer sk-segredo-servidor-teste');
    assert.equal(recebidos[0].safety, assinatura(u.id));
    assert.notEqual(recebidos[0].safety, u.id);
    assert.match(recebidos[0].body, /"type":"semantic_vad"/);
    assert.match(recebidos[0].body, /"eagerness":"low"/);
    assert.match(recebidos[0].body, /"language":"pt"/);

    // Outro usuário não pode encerrar chamada alheia
    const { token: outroToken } = await criarUsuario();
    const rOutro = await encerrarHttp(
      reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licao.id}/voz-ao-vivo/encerrar`, outroToken, { chamadaId: 'rtc_sim_1' }),
    );
    assert.equal(rOutro.status, 404);

    // Dono encerra chamada -> hangup chamado na OpenAI
    const rFim = await encerrarHttp(
      reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licao.id}/voz-ao-vivo/encerrar`, token, { chamadaId: 'rtc_sim_1' }),
    );
    assert.equal(rFim.status, 204);
    assert.deepEqual(hangups, [{ callId: 'rtc_sim_1', auth: 'Bearer sk-segredo-servidor-teste' }]);

    // 2ª e 3ª chamadas passam; 4ª estoura limite de 3/hora (429)
    for (const esperado of [200, 200, 429]) {
      const r = await iniciarHttp(
        reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licao.id}/voz-ao-vivo`, token, { sdp: SDP_OFERTA }),
        { params: Promise.resolve({ id: licao.id }) },
      );
      assert.equal(r.status, esperado);
    }

    // Visitante bloqueado por padrão (403)
    const { u: vis, token: visToken } = await criarUsuario(
      `${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${crypto.randomUUID().slice(0, 6)}${DOMINIO_EMAIL_VISITANTE}`,
    );
    chavesLimite.push(`ia:voz:usuario:${vis.id}`, 'ia:voz:visitantes:dia');
    const licaoVis = await criarLicaoPara(vis.id);

    const rVisOff = await iniciarHttp(
      reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licaoVis.id}/voz-ao-vivo`, visToken, { sdp: SDP_OFERTA }),
      { params: Promise.resolve({ id: licaoVis.id }) },
    );
    assert.equal(rVisOff.status, 403);

    // Com flag de visitante ligada: 1 conversa permitida, 2ª retorna 429
    process.env.STUDOO_VOZ_AO_VIVO_VISITANTE = '1';
    const rVis1 = await iniciarHttp(
      reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licaoVis.id}/voz-ao-vivo`, visToken, { sdp: SDP_OFERTA }),
      { params: Promise.resolve({ id: licaoVis.id }) },
    );
    assert.equal(rVis1.status, 200);
    const rVis2 = await iniciarHttp(
      reqPrivada(`${origemPadrao()}/api/estudio/licoes/${licaoVis.id}/voz-ao-vivo`, visToken, { sdp: SDP_OFERTA }),
      { params: Promise.resolve({ id: licaoVis.id }) },
    );
    assert.equal(rVis2.status, 429);
  } finally {
    servidor.close();
    for (const [k, v] of Object.entries(envAntes)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('avaliador existente recebe apenas a transcrição da pessoa e grava o retorno da lição', async () => {
  const { u } = await criarUsuario();
  const licao = await criarLicaoPara(u.id);
  const transcricaoPessoa =
    'Fração mostra quantas partes escolhemos de um inteiro dividido em partes iguais, como comer duas fatias de uma pizza de oito.';

  const iaAntes = process.env.IA;
  process.env.IA = 'falsa';
  try {
    const retorno = await ensinarStu(u.id, licao.id, transcricaoPessoa);
    assert.ok(Array.isArray(retorno.acertos));
    assert.ok(retorno.lacuna.length > 0);
    assert.ok(retorno.pergunta.length > 0);
    assert.ok(retorno.proximoPasso.length > 0);

    const apoio = await buscarApoio(u.id, licao.id);
    assert.equal(apoio.ensino?.proximoPasso, retorno.proximoPasso);
  } finally {
    if (iaAntes === undefined) delete process.env.IA;
    else process.env.IA = iaAntes;
  }
});

test('máquina de estados da voz ao vivo: legendas, interrupção natural, tempo e extração só da pessoa', () => {
  let s = { ...estadoInicialVozAoVivo(), estado: 'ouvindo' };

  // Stu começa falando (delta + done)
  s = reduzirEventoRealtime(s, { type: 'response.output_audio_transcript.delta', response_id: 'r1', delta: 'Oi! ' });
  s = reduzirEventoRealtime(s, { type: 'response.output_audio_transcript.delta', response_id: 'r1', delta: 'Me explica essa lição?' });
  assert.equal(s.estado, 'stu_falando');
  s = reduzirEventoRealtime(s, {
    type: 'response.output_audio_transcript.done',
    response_id: 'r1',
    transcript: 'Oi! Me explica essa lição?',
  });

  // Pessoa interrompe naturalmente enquanto Stu fala
  s = reduzirEventoRealtime(s, { type: 'input_audio_buffer.speech_started' });
  assert.equal(s.estado, 'ouvindo');

  // Transcrição da fala da pessoa (delta + completed)
  s = reduzirEventoRealtime(s, { type: 'conversation.item.input_audio_transcription.delta', item_id: 'u1', delta: 'O denominador ' });
  s = reduzirEventoRealtime(s, {
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'u1',
    transcript: 'O denominador mostra o total de partes iguais de uma pizza.',
  });

  // Segunda fala da pessoa
  s = reduzirEventoRealtime(s, {
    type: 'conversation.item.input_audio_transcription.completed',
    item_id: 'u2',
    transcript: 'Por exemplo, três oitavos tem oito fatias no total.',
  });

  // Somente a fala da pessoa vai para o avaliador, nunca a fala do Stu
  const transcricao = extrairTranscricaoUsuario(s);
  assert.equal(
    transcricao,
    'O denominador mostra o total de partes iguais de uma pizza. Por exemplo, três oitavos tem oito fatias no total.',
  );
  assert.equal(transcricao.includes('Me explica'), false);
  assert.equal(formatarTempoVoz(150), '02:30');

  // Evento de erro leva ao estado erro
  const erro = reduzirEventoRealtime(s, { type: 'error' });
  assert.equal(erro.estado, 'erro');
  assert.equal(erro.erro, 'rede');
});
