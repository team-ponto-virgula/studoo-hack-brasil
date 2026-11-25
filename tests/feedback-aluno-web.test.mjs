import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { POST as visitante } from '../src/app/api/visitante/route.ts';
import { POST as diagnostico } from '../src/app/api/aprendizado/diagnostico/route.ts';
import { POST as proposta } from '../src/app/api/aprendizado/propostas/route.ts';
import { POST as eventosProposta } from '../src/app/api/aprendizado/propostas/ao-vivo/route.ts';
import { GET as planos, POST as salvar } from '../src/app/api/aprendizado/planos/route.ts';
import { GET as plano, DELETE as apagarPlano } from '../src/app/api/aprendizado/planos/[id]/route.ts';
import { GET as licao } from '../src/app/api/aprendizado/licoes/[id]/route.ts';
import { POST as avaliar } from '../src/app/api/aprendizado/licoes/[id]/avaliar/route.ts';
import { POST as concluir } from '../src/app/api/aprendizado/licoes/[id]/concluir/route.ts';
import { GET as progresso } from '../src/app/api/perfil/estudo/route.ts';
import { excluirConta } from '../src/servidor/privacidade/conta.ts';
import { criarSessao, usuarioDaSessao } from '../src/servidor/acesso/sessao.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { aceitarConsentimentoIa, provedoresConfiguradosIa } from '../src/servidor/privacidade/consentimento.ts';
import { VERSAO_CONSENTIMENTO_IA } from '@studoo/contratos/privacidade';
import { banco } from '../src/servidor/banco/cliente.ts';
import { dataLocalDoEstudo, indicadoresDosDias } from '../src/servidor/aprendizado/progresso-perfil.ts';
import { etapasDaLicao, migrarPassoAula, VERSAO_ETAPAS_AULA } from '@studoo/contratos';

process.env.IA = 'falsa';
process.env.STUDOO_VISITANTE = '1';
process.env.STUDOO_LIMITE_VISITANTES_IP = '50';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
process.env.STUDOO_IA_FALSA_PAUSA_PROPOSTA_MS = '0';
const origem = process.env.STUDOO_ORIGEM;
const usuarios = new Set();
const ctx = id => ({ params: Promise.resolve({ id }) });

function req(rota, cookie, body, method = body === undefined ? 'GET' : 'POST') {
  return new Request(origem + '/api/' + rota, {
    method, headers: { origin: origem, ...(cookie && { cookie }), ...(body !== undefined && { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function ok(res) {
  const resposta = await res;
  const json = await resposta.json();
  assert.equal(resposta.status, 200, JSON.stringify(json));
  return json;
}
async function novoVisitante() {
  const res = await visitante(req('visitante', '', {}, 'POST'));
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const id = await usuarioDaSessao(cookie.split('=')[1], 'WEB');
  usuarios.add(id);
  return { id, cookie };
}
after(async () => {
  try {
    for (const id of usuarios) await excluirConta(id, 'EXCLUIR');
  } finally {
    await banco.$disconnect();
  }
});

async function responder(cookie, passo, texto) {
  assert.equal(passo.tipo, 'pergunta');
  assert.deepEqual(Object.keys(passo.pergunta).sort(), ['enunciado', 'id', 'opcoes']);
  assert.ok(passo.pergunta.opcoes.some(o => o.texto === 'Ainda não sei'));
  const opcao = passo.pergunta.opcoes.find(o => o.texto === texto);
  assert.ok(opcao, texto);
  return ok(diagnostico(req('aprendizado/diagnostico', cookie, { id: passo.id, perguntaId: passo.pergunta.id, opcaoId: opcao.id })));
}

async function salvarEReabrir(cookie, p) {
  const salvo = await ok(salvar(req('aprendizado/planos', cookie, { token: p.token })));
  const reenvio = await ok(salvar(req('aprendizado/planos', cookie, { token: p.token })));
  assert.equal(reenvio.id, salvo.id);
  const lista = await ok(planos(req('aprendizado/planos', cookie)));
  assert.equal(lista.filter(item => item.id === salvo.id).length, 1);
  assert.equal(lista.find(item => item.id === salvo.id).progresso.concluidas, 0);
  const reaberto = await ok(plano(req('aprendizado/planos/' + salvo.id, cookie), ctx(salvo.id)));
  const id = reaberto.fluxos[0].proximaLicaoId;
  const primeira = await ok(licao(req('aprendizado/licoes/' + id, cookie), ctx(id)));
  assert.deepEqual(reaberto.diagnostico, p.diagnostico);
  assert.equal(primeira.titulo, p.fluxos[0].licoes[0].titulo);
  assert.equal(primeira.concluida, false);
  return { reaberto, primeira };
}

test('equação: percursos inicial e demonstrado mudam a primeira lição e o exercício depois de salvar/reabrir', async () => {
  const { cookie } = await novoVisitante();
  const objetivo = 'Equação do 1º grau';
  const inicio = await ok(diagnostico(req('aprendizado/diagnostico', cookie, { objetivo })));
  const raso = await responder(cookie, inicio, 'Ainda não sei');
  assert.equal(raso.tipo, 'resultado');
  assert.deepEqual(raso.perfil.demonstrados, []);
  assert.deepEqual(raso.perfil.lacunas, []);
  const p1 = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId: raso.id })));
  const antes = await ok(planos(req('aprendizado/planos', cookie)));
  assert.deepEqual(antes, [], 'a prévia não foi aceita');
  const uma = await salvarEReabrir(cookie, p1);

  const segunda = await responder(cookie, inicio, '4');
  assert.equal(segunda.numero, 2);
  const parcial = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId: segunda.id })));
  assert.deepEqual(parcial.diagnostico.demonstrados, ['Isolar a incógnita']);
  const fundo = await responder(cookie, segunda, '4');
  assert.equal(fundo.perfil.nivel, 'basico', 'acerto não muda profundidade desejada');
  assert.equal(fundo.perfil.demonstrados.length, 2);
  const stream = await eventosProposta(req('aprendizado/propostas/ao-vivo', cookie, { objetivo, diagnosticoId: fundo.id }));
  assert.equal(stream.status, 200);
  const eventos = (await stream.text()).trim().split('\n').map(JSON.parse);
  const p2 = eventos.at(-1).proposta;
  assert.deepEqual(p2.diagnostico, fundo.perfil);
  const outra = await salvarEReabrir(cookie, p2);
  assert.equal(uma.primeira.titulo, 'Preservar a igualdade');
  assert.equal(outra.primeira.titulo, 'Modelar um problema com equação');
  assert.match(uma.primeira.exercicio.enunciado, /x \+ 5 = 12/);
  assert.match(outra.primeira.exercicio.enunciado, /corrida/i);
  assert.ok(!Object.hasOwn(outra.primeira.exercicio, 'gabarito'));
});

test('sistema solar: até três perguntas complementares; trocar recorte invalida evidência dependente', async () => {
  const { cookie } = await novoVisitante();
  const objetivo = 'Sistema solar e seus astros';
  const escopo = await ok(diagnostico(req('aprendizado/diagnostico', cookie, { objetivo })));
  const nivel = await responder(cookie, escopo, 'Como os astros se movem');
  const q = await responder(cookie, nivel, 'Avançado');
  assert.equal(q.numero, 3);
  const final = await responder(cookie, q, 'A rotação em torno do próprio eixo');
  assert.equal(final.perfil.nivel, 'avancado');
  const p = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId: final.id })));
  const { primeira } = await salvarEReabrir(cookie, p);
  assert.match(primeira.titulo, /distância orbital/);
  assert.match(primeira.exercicio.enunciado, /Terra e Marte/);

  const mudei = await responder(cookie, escopo, 'Planetas e suas luas');
  assert.equal(mudei.numero, 2);
  const parcial = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId: final.id })));
  assert.equal(parcial.diagnostico.escopo, 'Planetas e suas luas');
  assert.deepEqual(parcial.diagnostico.demonstrados, []);
  const outro = await novoVisitante();
  assert.equal((await proposta(req('aprendizado/propostas', outro.cookie, { objetivo, diagnosticoId: final.id }))).status, 400);
});

test('primeiras conclusões agregam uma data, repetições não duplicam, e o fuso muda o dia real', async () => {
  const { cookie } = await novoVisitante();
  const objetivo = 'Equações do primeiro grau';
  const inicio = await ok(diagnostico(req('aprendizado/diagnostico', cookie, { objetivo })));
  const resultado = await responder(cookie, inicio, 'Ainda não sei');
  const p = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId: resultado.id })));
  const { reaberto } = await salvarEReabrir(cookie, p);
  for (const item of reaberto.fluxos.flatMap(f => f.licoes)) {
    const detalhe = await ok(licao(req('aprendizado/licoes/' + item.id, cookie), ctx(item.id)));
    const resposta = detalhe.exercicio.opcoes[0].id;
    const avaliacao = await ok(avaliar(req('aprendizado/licoes/' + item.id + '/avaliar', cookie, { resposta }), ctx(item.id)));
    for (let vez = 0; vez < 2; vez++) {
      await ok(concluir(req('aprendizado/licoes/' + item.id + '/concluir', cookie, { comprovante: avaliacao.comprovante }), ctx(item.id)));
    }
  }
  const obtido = await ok(progresso(req('perfil/estudo', cookie)));
  assert.equal(obtido.trilhasConcluidas, 1);
  assert.equal(obtido.diasDeEstudo, 1);
  assert.equal(obtido.diasSeguidos, 1);
  const removida = await apagarPlano(req('aprendizado/planos/' + reaberto.id, cookie, undefined, 'DELETE'), ctx(reaberto.id));
  assert.equal(removida.status, 200);
  const depois = await ok(progresso(req('perfil/estudo', cookie)));
  assert.equal(depois.trilhasConcluidas, 0);
  assert.equal(depois.diasDeEstudo, 1);

  const fuso = 'America/Sao_Paulo';
  const antesDaMeiaNoite = new Date('2026-11-25T02:59:00Z');
  const depoisDaMeiaNoite = new Date('2026-11-25T03:01:00Z');
  assert.equal(dataLocalDoEstudo(antesDaMeiaNoite, fuso), '2026-11-24');
  assert.equal(dataLocalDoEstudo(depoisDaMeiaNoite, fuso), '2026-11-25');
  const datas = ['2026-11-21', '2026-11-24', '2026-11-25', '2026-11-25'];
  assert.equal(indicadoresDosDias(datas, fuso, new Date('2026-11-26T04:00:00Z')).diasSeguidos, 2);
  assert.equal(indicadoresDosDias(datas, fuso, new Date('2026-11-27T04:00:00Z')).diasSeguidos, 0);
  assert.equal(indicadoresDosDias(datas, fuso, new Date('2026-11-27T04:00:00Z')).diasDeEstudo, 3);
});

test('nova ordem de etapas e retomada numérica antiga da prática', () => {
  const etapas = etapasDaLicao({ exercicio: { tipo: 'lacuna' }, pratica: {} });
  assert.deepEqual(etapas.map(x => x.tipo), ['conceito', 'exemplo', 'exercicio', 'ensino', 'pratica']);
  assert.equal(migrarPassoAula(etapas, 3), 4);
  assert.equal(migrarPassoAula(etapas, 3, VERSAO_ETAPAS_AULA), 3);
  assert.equal(migrarPassoAula(etapas, 2), 2);
});


test('provedor simulado: classifica Fotografia, afunila exposição e preserva geração quando o diagnóstico demora', async t => {
  const conta = await banco.usuario.create({
    data: { email: `feedback-${crypto.randomUUID()}@example.test`, fuso: 'UTC' },
  });
  usuarios.add(conta.id);
  const sessao = await criarSessao(conta.id, 'WEB');
  const cookie = cookieSessao(sessao.token).split(';')[0];
  const ambiente = { IA: 'openai', OPENAI_API_KEY: 'chave-sintetica', OPENAI_BASE_URL: 'http://127.0.0.1:1/v1' };
  const anterior = Object.fromEntries(Object.keys(ambiente).map(chave => [chave, process.env[chave]]));
  t.after(() => {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });
  assert.deepEqual(provedoresConfiguradosIa(), []);
  Object.assign(process.env, ambiente);
  assert.deepEqual(provedoresConfiguradosIa().map(p => p.id), ['openai']);
  let atrasar = false;
  const geral = 'Fotografia';
  const estreito = 'Compensar a exposição usando o obturador, no nível intermediário';
  const aplicacao = {
    habilidade: 'Escolher velocidade para movimento',
    enunciado: 'Qual velocidade congela melhor o movimento de um ciclista?',
    opcoes: ['1/500 s', '1/15 s', '2 s'], correta: 0,
  };
  const exposicao = {
    habilidade: 'Compensar a exposição mantendo a abertura',
    enunciado: 'Em prioridade à abertura, qual mudança compensa uma imagem escura sem alterar ISO nem abertura?',
    opcoes: ['Obturador mais lento', 'Obturador mais rápido', 'Mudar o ponto de foco'], correta: 0,
  };
  const pedidos = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1/v1/responses');
    const payload = JSON.parse(init.body);
    assert.doesNotMatch(init.body, /example.test/);
    pedidos.push(payload);
    if (payload.text?.format?.name === 'diagnostico') {
      assert.equal(payload.store, false);
      const { objetivo } = JSON.parse(payload.input[0].content[0].text);
      assert.ok([geral, estreito].includes(objetivo));
      if (atrasar) return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      });
      const amplo = objetivo === geral;
      return Response.json({ status: 'completed', output_text: JSON.stringify({
        escopo: amplo ? 'Fotografia' : 'Compensar exposição com o obturador',
        nivelDeclarado: amplo ? 'nao_declarado' : 'intermediario',
        questao: amplo ? aplicacao : exposicao,
        recortes: amplo ? [{ titulo: 'Fotografar movimento', questao: aplicacao }, { titulo: 'Exposição manual', questao: exposicao }] : [],
      }) });
    }
    const entrada = payload.input[1].content;
    const avancado = entrada.includes('Fotografar movimento') && entrada.includes('Escolher velocidade para movimento');
    const ajuste = entrada.includes('Compensar exposição com o obturador');
    const titulo = avancado ? 'Criar rastro sem perder a exposição' : ajuste ? 'Corrigir a subexposição' : 'Começar pela exposição';
    if (payload.stream) {
      const quebra = String.fromCharCode(10);
      const linhas = [
        { tipo: 'plano', titulo: 'Fotografia em prática', objetivo: 'Praticar fotografia.' },
        { tipo: 'fluxo', titulo: 'Aplicação' },
        { tipo: 'licao', titulo },
      ].map(x => JSON.stringify(x)).join(quebra);
      const mensagem = JSON.stringify({ type: 'response.output_text.delta', delta: linhas + quebra });
      return new Response('data: ' + mensagem + quebra + quebra, { headers: { 'Content-Type': 'text/event-stream' } });
    }
    const enunciado = avancado ? 'Qual ajuste cria um rastro de movimento sem aumentar a exposição?' : 'Qual alteração corrige a subexposição sem mudar a abertura?';
    return Response.json({ status: 'completed', output_text: JSON.stringify({
      objetivo: 'Fotografar em condições de luz variável.',
      conceito: 'A duração da exposição e a abertura controlam a luz que chega ao sensor.',
      exemplo: 'Em 1/60 s o sensor recebe luz por mais tempo do que em 1/500 s.',
      exercicio: {
        tipo: 'multipla_escolha', enunciado, contexto: null, trecho: null,
        opcoes: [{ id: 'a', texto: 'Ajustar o tempo de exposição' }, { id: 'b', texto: 'Mudar apenas o foco' }, { id: 'c', texto: 'Manter todos os ajustes' }],
        gabarito: ['Ajustar o tempo de exposição'], feedbackCorreto: 'Sim.', feedbackIncorreto: 'Considere o tempo que o sensor recebe luz.',
      },
    }) });
  });
  const pedido = objetivo => diagnostico(req('aprendizado/diagnostico', cookie, { objetivo }));
  assert.equal((await pedido(geral)).status, 428);
  assert.equal(fetch.mock.callCount(), 0);
  await aceitarConsentimentoIa(conta.id, VERSAO_CONSENTIMENTO_IA);

  const recorte = await ok(pedido(geral));
  const profundidade = await responder(cookie, recorte, 'Fotografar movimento');
  const verificacao = await responder(cookie, profundidade, 'Avançado');
  assert.match(verificacao.pergunta.enunciado, /ciclista/);
  const ampla = await responder(cookie, verificacao, '1/500 s');
  assert.deepEqual(ampla.perfil, {
    escopo: 'Fotografar movimento', nivel: 'avancado', demonstrados: ['Escolher velocidade para movimento'], lacunas: [],
  });
  const pa = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo: geral, diagnosticoId: ampla.id })));
  const a = (await salvarEReabrir(cookie, pa)).primeira;
  assert.match(a.titulo, /rastro/);
  assert.match(a.exercicio.enunciado, /rastro/);
  assert.ok(pedidos.some(p => p.stream && p.input[1].content.includes('"nivel":"avancado"')));

  const amostra = await ok(pedido(estreito));
  assert.equal(amostra.numero, 1);
  assert.match(amostra.pergunta.enunciado, /prioridade à abertura/);
  const curta = await responder(cookie, amostra, 'Ainda não sei');
  assert.equal(curta.perfil.nivel, 'intermediario');
  assert.deepEqual(curta.perfil.demonstrados, []);
  const pb = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo: estreito, diagnosticoId: curta.id })));
  const b = (await salvarEReabrir(cookie, pb)).primeira;
  assert.match(b.titulo, /subexposição/);
  assert.notEqual(a.exercicio.enunciado, b.exercicio.enunciado);

  atrasar = true;
  assert.equal((await pedido(geral)).status, 503);
  const legado = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo: geral })));
  assert.ok(legado.fluxos.length);
  assert.equal(legado.diagnostico, undefined);
});
