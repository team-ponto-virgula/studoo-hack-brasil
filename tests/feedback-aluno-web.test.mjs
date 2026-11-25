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
  const questaoGeral = {
    habilidade: 'Identificar funções da câmera',
    enunciado: 'Qual controle da câmera determina o tempo de exposição?',
    opcoes: ['Obturador', 'Visor', 'Ponto de foco'], correta: 0,
  };
  const tituloDoRastro = 'Criar rastro sem perder a exposição';
  const decisaoDoRastro = 'Escolher a abertura que mantém a exposição ao dobrar o tempo para criar um rastro de movimento.';
  const casoDoRastro = 'Em 1/125 s e f/5,6 a exposição está correta. Ao passar para 1/60 s para criar rastro, qual abertura mantém o brilho com ISO fixo?';
  const revisoesDeFotografia = [];
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
        questao: amplo ? questaoGeral : exposicao,
        recortes: amplo ? [{ titulo: 'Fotografar movimento', questao: aplicacao }, { titulo: 'Exposição manual', questao: exposicao }] : [],
      }) });
    }
    if (payload.text?.format?.name === 'diagnostico_curriculo') {
      const dados = JSON.parse(payload.input[0].content[0].text);
      assert.deepEqual(dados.amostrasDemonstradas, [{ habilidade: aplicacao.habilidade, enunciado: aplicacao.enunciado }]);
      return Response.json({ output_text: JSON.stringify({ fluxos: [{ titulo: 'Movimento', licoes: [{ titulo: tituloDoRastro, resumo: decisaoDoRastro }] }] }) });
    }
    if (payload.text?.format?.name === 'diagnostico_verificar_curriculo') {
      const { licoes } = JSON.parse(payload.input[0].content[0].text);
      const { exercicios: [exercicio] } = licoes[0];
      revisoesDeFotografia.push(exercicio.enunciado);
      const avancou = exercicio.enunciado === casoDoRastro;
      if (avancou) assert.equal(exercicio.opcoes.find(o => o.id === exercicio.gabarito[0]).texto, 'f/8');
      else assert.equal(exercicio.enunciado, aplicacao.enunciado);
      return Response.json({ output_text: JSON.stringify({ avaliacoes: [{ numero: 1, resultado: avancou ? 'avanca' : 'ajustar', motivo: avancou ? '' : 'Faltam o tempo inicial, o novo tempo e uma decisão sobre a abertura.' }] }) });
    }
    if (payload.text?.format?.name === 'diagnostico_reparar_curriculo') {
      const { licoes } = JSON.parse(payload.input[0].content[0].text);
      assert.match(licoes[0].motivo, /novo tempo/);
      return Response.json({ output_text: JSON.stringify({ licoes: [{ numero: 1,
        conceito: 'Dobrar o tempo deixa entrar o dobro de luz. Fechar a abertura em um ponto compensa esse ganho.',
        exemplo: 'Com ISO fixo, passar de 1/250 s e f/4 para 1/125 s e f/5,6 mantém a exposição.',
        enunciado: casoDoRastro, opcoes: ['f/8', 'f/4', 'f/5,6'], correta: 0,
        feedbackCorreto: 'Fechar de f/5,6 para f/8 compensa o tempo dobrado.', feedbackIncorreto: 'O tempo maior já aumentou a luz. Veja qual abertura deixa entrar menos luz.',
      }] }) });
    }
    const entrada = payload.input[1].content;
    const adaptada = entrada.includes('Fotografar movimento') && entrada.includes('Escolher velocidade para movimento');
    const ajuste = entrada.includes('Compensar exposição com o obturador');
    const titulo = adaptada ? tituloDoRastro : ajuste ? 'Corrigir a subexposição' : 'Começar pela exposição';
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
    const enunciado = adaptada ? aplicacao.enunciado : 'Qual alteração corrige a subexposição sem mudar a abertura?';
    const opcoes = adaptada ? aplicacao.opcoes : ['Ajustar o tempo de exposição', 'Mudar apenas o foco', 'Manter todos os ajustes'];
    return Response.json({ status: 'completed', output_text: JSON.stringify({
      objetivo: 'Fotografar em condições de luz variável.',
      conceito: 'A duração da exposição e a abertura controlam a luz que chega ao sensor.',
      exemplo: 'Em 1/60 s o sensor recebe luz por mais tempo do que em 1/500 s.',
      exercicio: {
        tipo: 'multipla_escolha', enunciado, contexto: null, trecho: null,
        opcoes: opcoes.map((texto, indice) => ({ id: String(indice), texto })),
        gabarito: ['0'], feedbackCorreto: 'Sim.', feedbackIncorreto: 'Considere o tempo que o sensor recebe luz.',
      },
    }) });
  });
  const pedido = objetivo => diagnostico(req('aprendizado/diagnostico', cookie, { objetivo }));
  assert.equal((await pedido(geral)).status, 428);
  assert.equal(fetch.mock.callCount(), 0);
  await aceitarConsentimentoIa(conta.id, VERSAO_CONSENTIMENTO_IA);

  const recorte = await ok(pedido(geral));
  assert.deepEqual(recorte.pergunta.opcoes.map(o => o.texto), ['Visão geral', 'Fotografar movimento', 'Exposição manual', 'Ainda não sei']);
  const profundidade = await responder(cookie, recorte, 'Fotografar movimento');
  const verificacao = await responder(cookie, profundidade, 'Intermediário');
  assert.match(verificacao.pergunta.enunciado, /ciclista/);
  const ampla = await responder(cookie, verificacao, '1/500 s');
  assert.deepEqual(ampla.perfil, {
    escopo: 'Fotografar movimento', nivel: 'intermediario', demonstrados: ['Escolher velocidade para movimento'], lacunas: [],
  });
  const pa = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo: geral, diagnosticoId: ampla.id })));
  const a = (await salvarEReabrir(cookie, pa)).primeira;
  assert.match(a.titulo, /rastro/);
  assert.match(a.exercicio.enunciado, /rastro/);
  assert.deepEqual(revisoesDeFotografia, [aplicacao.enunciado, casoDoRastro]);
  const aberturaCerta = a.exercicio.opcoes.find(o => o.texto === 'f/8');
  assert.equal((await ok(avaliar(req('aprendizado/licoes/' + a.id + '/avaliar', cookie, { resposta: aberturaCerta.id }), ctx(a.id)))).correta, true);
  assert.ok(pedidos.some(p => p.stream && p.input[1].content.includes('"nivel":"intermediario"')));

  for (const opcao of ['Visão geral', 'Ainda não sei']) {
    const escolha = await ok(pedido(geral));
    const nivel = await responder(cookie, escolha, opcao);
    const amostraGeral = await responder(cookie, nivel, 'Básico');
    assert.equal(amostraGeral.numero, 3);
    assert.equal(amostraGeral.pergunta.enunciado, questaoGeral.enunciado);
    const perfilGeral = await responder(cookie, amostraGeral, opcao === 'Visão geral' ? 'Obturador' : 'Ainda não sei');
    assert.deepEqual(perfilGeral.perfil, {
      escopo: geral, nivel: 'basico', demonstrados: opcao === 'Visão geral' ? [questaoGeral.habilidade] : [], lacunas: [],
    });
  }

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
  const chamadasAntesDoAtraso = fetch.mock.callCount();
  assert.equal((await pedido(geral)).status, 503);
  assert.equal(fetch.mock.callCount(), chamadasAntesDoAtraso + 1);
  const legado = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo: geral })));
  assert.ok(legado.fluxos.length);
  assert.equal(legado.diagnostico, undefined);
});

test('DeepSeek simulado: recupera História do Brasil quando a resposta tem rótulos longos', async t => {
  const { id, cookie } = await novoVisitante();
  const ambiente = { IA: 'deepseek', DEEPSEEK_API_KEY: 'chave-sintetica', DEEPSEEK_BASE_URL: 'http://127.0.0.1:1' };
  const anterior = Object.fromEntries(Object.keys(ambiente).map(chave => [chave, process.env[chave]]));
  Object.assign(process.env, ambiente);
  await aceitarConsentimentoIa(id, VERSAO_CONSENTIMENTO_IA);
  t.after(() => {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });
  const objetivo = 'História do Brasil';
  const vargas = {
    habilidade: 'Relacionar CLT e Era Vargas',
    enunciado: 'Qual medida da Era Vargas reuniu a legislação trabalhista em 1943?',
    opcoes: ['Lei Áurea', 'Código Eleitoral', 'CLT'], correta: 2,
  };
  const correta = {
    escopo: objetivo, nivelDeclarado: 'nao_declarado',
    questao: {
      habilidade: 'Situar o início do Brasil republicano',
      enunciado: 'Qual mudança de regime ocorreu no Brasil em 1889?',
      opcoes: ['Proclamação da República', 'Independência', 'Início da Era Vargas'], correta: 0,
    },
    recortes: [
      { titulo: ' Panorama geral da História do Brasil. ', questao: { habilidade: 'Identificar a produção açucareira', enunciado: 'Qual produto era feito nos engenhos coloniais?', opcoes: ['Borracha', 'Açúcar', 'Ferro'], correta: 1 } },
      { titulo: 'Império', questao: { habilidade: 'Situar a Independência', enunciado: 'Em que ano foi proclamada a Independência do Brasil?', opcoes: ['1808', '1822', '1889'], correta: 1 } },
      { titulo: ' Era Vargas ', questao: { ...vargas, habilidade: ` ${vargas.habilidade} `, opcoes: ['Lei Áurea', 'Código Eleitoral', ' CLT '] } },
    ],
  };
  const longo = structuredClone(correta);
  for (const questao of [longo.questao, ...longo.recortes.map(item => item.questao)]) {
    questao.habilidade = 'Identificar características da política trabalhista do período Vargas e seus vínculos com o controle estatal dos sindicatos.';
  }
  let respostas;
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1/chat/completions');
    const pedido = JSON.parse(init.body);
    assert.deepEqual(JSON.parse(pedido.messages[1].content), { objetivo });
    assert.deepEqual(pedido.response_format, { type: 'json_object' });
    assert.match(pedido.messages[0].content, /até 100 caracteres/);
    assert.match(pedido.messages[0].content, /Exatamente três alternativas distintas/);
    assert.match(pedido.messages[0].content, /"enum":\[0,1,2\]/);
    if (respostas.length === 1) assert.match(pedido.messages[0].content, /A resposta anterior não pôde ser usada/);
    return Response.json({ choices: [{ message: { content: JSON.stringify(respostas.shift()) } }] });
  });
  const pedir = () => diagnostico(req('aprendizado/diagnostico', cookie, { objetivo }));
  respostas = [longo, correta];
  const recorte = await ok(pedir());
  assert.equal(fetch.mock.callCount(), 2);
  assert.deepEqual(recorte.pergunta.opcoes.map(o => o.texto), ['Visão geral', 'Império', 'Era Vargas', 'Ainda não sei']);
  const profundidade = await responder(cookie, recorte, 'Era Vargas');
  const amostra = await responder(cookie, profundidade, 'Intermediário');
  assert.equal(amostra.pergunta.enunciado, vargas.enunciado);
  const resultado = await responder(cookie, amostra, 'CLT');
  assert.deepEqual(resultado.perfil, { escopo: 'Era Vargas', nivel: 'intermediario', demonstrados: [vargas.habilidade], lacunas: [] });

  respostas = [
    { ...correta, questao: { ...correta.questao, correta: 3 } },
    { ...correta, questao: { ...correta.questao, opcoes: ['CLT', ' clt ', 'Outro'] } },
  ];
  assert.equal((await pedir()).status, 503);
  assert.equal(fetch.mock.callCount(), 4);
});

test('DeepSeek simulado: a mesma resposta corrigida muda a ação exigida no primeiro exercício salvo', async t => {
  const { id, cookie } = await novoVisitante();
  const ambiente = { IA: 'deepseek', DEEPSEEK_API_KEY: 'chave-sintetica', DEEPSEEK_BASE_URL: 'http://127.0.0.1:1', STUDOO_IA_RESERVA: 'nenhuma', STUDOO_LIMITE_GERACOES_VISITANTE: '4' };
  const anterior = Object.fromEntries(Object.keys(ambiente).map(chave => [chave, process.env[chave]]));
  Object.assign(process.env, ambiente);
  t.after(() => {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });
  await aceitarConsentimentoIa(id, VERSAO_CONSENTIMENTO_IA);

  const objetivo = 'Aprender a resolver equações do primeiro grau com uma única incógnita';
  const habilidade = 'Isolar a incógnita em equação simples';
  const tituloRepetido = 'Reconhecer uma equação do primeiro grau';
  const tituloNovo = 'Traduzir um problema em equação';
  const desafio = 'Escolher a equação que representa uma taxa fixa e um valor por unidade.';
  const fundamentos = 'Qual valor de x torna x + 5 = 12 verdadeira?';
  const repeticao = 'Em x + 4 = 9, qual operação ajuda a isolar x?';
  const aplicacao = 'Uma corrida cobra R$ 5 fixos e R$ 3 por km. Qual equação representa um total de R$ 20?';
  const decisaoDeConferencia = 'Verificar se a solução cabe na unidade e nas condições do problema.';
  const conferencia = 'A conta deu 2,5 ingressos e só se vendem ingressos inteiros. O que essa solução mostra?';
  const tituloDeConferencia = 'Conferir a solução no contexto';
  const revisoes = [];
  let reparos = 0;
  let deixarRepetir = false;

  const respostaJson = dados => Response.json({ choices: [{ message: { content: JSON.stringify(dados) } }] });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1/chat/completions');
    assert.doesNotMatch(init.body, /example.test/);
    const requisicao = JSON.parse(init.body);
    const [sistema, entrada] = requisicao.messages.map(m => m.content);
    if (requisicao.stream) {
      const demonstrou = entrada.includes(`"demonstrados":["${habilidade}"]`);
      const linhas = [
        { tipo: 'plano', titulo: 'Equações do primeiro grau' },
        { tipo: 'fluxo', titulo: 'Primeiros passos' },
        { tipo: 'licao', titulo: demonstrou ? tituloRepetido : 'O que é uma equação', resumo: demonstrou ? 'Identificar qual sentença é uma equação.' : 'Aprender a isolar x.' },
        ...(demonstrou ? [
          { tipo: 'licao', titulo: 'Usar operações inversas' }, { tipo: 'licao', titulo: 'Equilibrar os dois lados' },
        ] : []),
      ].map(x => JSON.stringify(x)).join('\n') + '\n';
      return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: linhas } }] })}\n\ndata: [DONE]\n\n`);
    }
    if (sistema.includes('Classifique a abrangência')) {
      return respostaJson({ escopo: 'Equações do primeiro grau', nivelDeclarado: 'nao_declarado', recortes: [], questao: {
        habilidade, enunciado: 'Na equação 3x + 5 = 20, qual é o valor de x?', opcoes: ['5', '8', '15'], correta: 0,
      } });
    }
    if (sistema.includes('Revise o conjunto das lições obrigatórias')) {
      const dados = JSON.parse(entrada);
      assert.equal(dados.objetivo, objetivo);
      assert.deepEqual(dados.diagnostico.demonstrados, [habilidade]);
      assert.equal(dados.diagnostico.nivel, 'basico');
      assert.deepEqual(dados.amostrasDemonstradas, [{ habilidade, enunciado: 'Na equação 3x + 5 = 20, qual é o valor de x?' }]);
      assert.deepEqual(dados.candidato[0].licoes.map(l => l.titulo), [tituloRepetido, 'Usar operações inversas', 'Equilibrar os dois lados']);
      return respostaJson({ fluxos: [{ titulo: 'Aplicações', licoes: [
        { titulo: tituloNovo, resumo: desafio }, { titulo: tituloDeConferencia, resumo: decisaoDeConferencia },
      ] }] });
    }
    if (sistema.includes('Avalie todas as lições recebidas')) {
      const dados = JSON.parse(entrada);
      assert.deepEqual(dados.curriculo.map(l => l.decisao), [desafio, decisaoDeConferencia]);
      assert.equal(dados.amostrasDemonstradas.length, 1);
      revisoes.push(dados.licoes.map(l => l.exercicios[0].enunciado));
      return respostaJson({ avaliacoes: dados.licoes.map(({ numero, exercicios: [exercicio] }) => {
        const certa = exercicio.opcoes.find(o => o.id === exercicio.gabarito[0]).texto;
        if (exercicio.enunciado === aplicacao && certa === '3k + 5 = 20'
          || exercicio.enunciado === conferencia && certa === 'O resultado não é válido nesse contexto') {
          return { numero, resultado: 'avanca', motivo: '' };
        }
        assert.equal(exercicio.enunciado, repeticao);
        assert.equal(certa, 'Subtrair 4');
        return { numero, resultado: 'ajustar', motivo: numero === 1
          ? 'Falta escolher a equação que modela a taxa fixa.' : 'Falta decidir se o valor da solução cabe na unidade.' };
      }) });
    }
    if (sistema.includes('Reescreva apenas as lições indicadas')) {
      reparos++;
      const { licoes } = JSON.parse(entrada);
      assert.deepEqual(licoes.map(l => l.numero), [1, 2]);
      assert.match(licoes[0].motivo, /taxa fixa/);
      assert.match(licoes[1].motivo, /na unidade/);
      return respostaJson({ licoes: licoes.map(({ numero }) => ({
        numero, conceito: numero === 1 ? 'Some a taxa fixa ao produto do preço pela quantidade.' : 'Confira se o resultado faz sentido na unidade pedida.',
        exemplo: numero === 1 ? 'Numa conta de R$ 8 fixos mais R$ 2/kg, R$ 18 corresponde a 2k + 8 = 18.' : 'Não se podem comprar 2,5 ingressos inteiros.',
        enunciado: deixarRepetir ? repeticao : numero === 1 ? aplicacao : conferencia,
        opcoes: deixarRepetir ? ['Subtrair 4', 'Somar 4', 'Dividir por 4'] : numero === 1 ? ['3k + 5 = 20', '5k + 3 = 20', '3k = 20 + 5']
          : ['O resultado não é válido nesse contexto', 'Compre 2,5 ingressos', 'O arredondamento sempre resolve'],
        correta: 0, feedbackCorreto: 'Confira a condição pedida.', feedbackIncorreto: 'Considere tanto a conta quanto a situação.',
      })) });
    }

    const adaptada = entrada.includes('Decisão a praticar nesta lição');
    if (adaptada) assert.ok(entrada.includes(entrada.includes('Escreva a lição 1:') ? desafio : decisaoDeConferencia));
    const opcoes = adaptada ? ['Subtrair 4', 'Somar 4', 'Dividir por 4'] : ['7', '5', '12'];
    return respostaJson({
      objetivo: habilidade,
      conceito: 'Aplique a mesma operação nos dois lados para isolar a incógnita.',
      exemplo: 'Em x + 3 = 8, subtraia 3 para encontrar x = 5.',
      exercicio: {
        tipo: 'multipla_escolha', enunciado: adaptada ? repeticao : fundamentos,
        opcoes: opcoes.map((texto, indice) => ({ id: String(indice), texto })), gabarito: ['0'],
        feedbackCorreto: 'Está certo.', feedbackIncorreto: 'Observe cada parte do problema.',
      },
    });
  });

  const amostra = await ok(diagnostico(req('aprendizado/diagnostico', cookie, { objetivo })));
  assert.match(amostra.pergunta.enunciado, /3x \+ 5 = 20/);
  const pedir = diagnosticoId => ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId })));
  for (const resposta of ['8', 'Ainda não sei']) {
    const perfil = await responder(cookie, amostra, resposta);
    assert.deepEqual(perfil.perfil.lacunas, resposta === '8' ? [habilidade] : []);
    const { primeira } = await salvarEReabrir(cookie, await pedir(perfil.id));
    assert.equal(primeira.exercicio.enunciado, fundamentos);
  }
  assert.deepEqual(revisoes, []);

  const corrigida = await responder(cookie, amostra, '5');
  assert.deepEqual(corrigida.perfil.demonstrados, [habilidade]);
  assert.deepEqual(corrigida.perfil.lacunas, []);
  const stream = await eventosProposta(req('aprendizado/propostas/ao-vivo', cookie, { objetivo, diagnosticoId: corrigida.id }));
  assert.equal(stream.status, 200);
  const eventos = (await stream.text()).trim().split('\n').map(JSON.parse);
  assert.equal(eventos.find(e => e.tipo === 'licao').resumo, desafio);
  const { primeira, reaberto } = await salvarEReabrir(cookie, eventos.at(-1).proposta);
  assert.equal(primeira.titulo, tituloNovo);
  assert.equal(primeira.exercicio.enunciado, aplicacao);
  const opcao = primeira.exercicio.opcoes.find(o => o.texto === '3k + 5 = 20');
  assert.equal((await ok(avaliar(req('aprendizado/licoes/' + primeira.id + '/avaliar', cookie, { resposta: opcao.id }), ctx(primeira.id)))).correta, true);
  const segundaId = reaberto.fluxos[0].licoes[1].id;
  const segunda = await ok(licao(req('aprendizado/licoes/' + segundaId, cookie), ctx(segundaId)));
  assert.equal(segunda.titulo, tituloDeConferencia);
  assert.equal(segunda.exercicio.enunciado, conferencia);
  assert.deepEqual(revisoes, [[repeticao, repeticao], [aplicacao, conferencia]]);
  assert.equal(reparos, 1, 'os dois exercícios foram reparados em uma chamada');

  deixarRepetir = true;
  const invalida = await pedir(corrigida.id);
  assert.equal((await salvar(req('aprendizado/planos', cookie, { token: invalida.token }))).status, 503);
  assert.deepEqual(revisoes, [[repeticao, repeticao], [aplicacao, conferencia], [repeticao, repeticao], [repeticao, repeticao]]);
  assert.equal((await ok(planos(req('aprendizado/planos', cookie)))).length, 3);
});
