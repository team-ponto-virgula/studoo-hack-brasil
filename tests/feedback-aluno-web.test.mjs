import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import sharp from 'sharp';
import { POST as enviarMaterial } from '../src/app/api/estudio/materiais/route.ts';
import { POST as proporMaterial } from '../src/app/api/estudio/materiais/[id]/proposta/route.ts';
import { emitirComprovante } from '../src/servidor/aprendizado/comprovantes.ts';
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
const respostaDaOpenAi = dados => Response.json({ status: 'completed', output_text: JSON.stringify(dados) });
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
  const meioPasso = 'Com ISO fixo, qual é o tempo meio passo mais lento que 1/250 s?';
  const motivoCompleto = 'Exercício 1: de 1/250 s, meio passo mais lento é 1/200 s, não 1/160 s; o gabarito contradiz o exemplo da lição. Exercício 2: 1/80 s não é meio passo de 1/60 s (1/60→1/50 é 1/3; meio passo fica entre 1/50 e 1/40). Falta consistência verificável nos incrementos.';
  assert.equal(motivoCompleto.length, 260);
  const revisoesDeFotografia = [];
  const pedidos = [];
  let motivoInicial = motivoCompleto;
  let numeroDoParecer = 1;
  let manterDefeito = false;
  let reescritas = 0;
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1/v1/responses');
    const payload = JSON.parse(init.body);
    assert.doesNotMatch(init.body, /example.test/);
    pedidos.push(payload);
    assert.equal(payload.model, 'gpt-6-luna');
    assert.equal(payload.reasoning.effort, 'max');
    if (payload.text?.format?.name === 'triagem_trilha') return respostaDaOpenAi({ decisao: 'permitir' });
    if (payload.text?.format?.name === 'diagnostico') {
      assert.equal(payload.store, false);
      const { objetivo } = JSON.parse(payload.input[0].content[0].text);
      assert.ok([geral, estreito].includes(objetivo));
      if (atrasar) throw new DOMException('tempo simulado', 'TimeoutError');
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
      else assert.equal(exercicio.enunciado, meioPasso);
      return Response.json({ output_text: JSON.stringify({ avaliacoes: [{ numero: numeroDoParecer, resultado: avancou ? 'avanca' : 'ajustar', motivo: avancou ? '' : motivoInicial, correcoes: [] }] }) });
    }
    if (payload.text?.format?.name === 'diagnostico_reparar_curriculo') {
      const { licoes } = JSON.parse(payload.input[0].content[0].text);
      reescritas++;
      assert.equal(licoes[0].motivo, motivoCompleto);
      return Response.json({ output_text: JSON.stringify({ licoes: [{ numero: 1,
        conceito: 'Dobrar o tempo deixa entrar o dobro de luz. Fechar a abertura em um ponto compensa esse ganho.',
        exemplo: 'Com ISO fixo, passar de 1/250 s e f/4 para 1/125 s e f/5,6 mantém a exposição.',
        enunciado: manterDefeito ? meioPasso : casoDoRastro,
        opcoes: manterDefeito ? ['1/160 s', '1/200 s', '1/125 s'] : ['f/8', 'f/4', 'f/5,6'], correta: 0,
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
      return new Response('data: ' + mensagem + quebra + quebra + 'data: {"type":"response.completed"}' + quebra + quebra, { headers: { 'Content-Type': 'text/event-stream' } });
    }
    const enunciado = adaptada ? meioPasso : 'Qual alteração corrige a subexposição sem mudar a abertura?';
    const opcoes = adaptada ? ['1/160 s', '1/200 s', '1/125 s'] : ['Ajustar o tempo de exposição', 'Mudar apenas o foco', 'Manter todos os ajustes'];
    const exercicio = {
      tipo: 'multipla_escolha', enunciado, contexto: null, trecho: null,
      opcoes: opcoes.map((texto, indice) => ({ id: String(indice), texto })),
      gabarito: ['0'], feedbackCorreto: 'Sim.', feedbackIncorreto: 'Considere o tempo que o sensor recebe luz.',
    };
    return Response.json({ status: 'completed', output_text: JSON.stringify({
      objetivo: 'Fotografar em condições de luz variável.',
      conceito: 'A duração da exposição e a abertura controlam a luz que chega ao sensor.',
      exemplo: 'Em 1/60 s o sensor recebe luz por mais tempo do que em 1/500 s.',
      exercicios: adaptada ? [exercicio, {
        ...exercicio, enunciado: 'Qual é o tempo meio passo mais rápido que 1/60 s?',
        opcoes: ['1/80 s', '1/50 s', '1/40 s'].map((texto, indice) => ({ id: String(indice), texto })),
      }] : [exercicio],
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
  const aceitar = () => salvar(req('aprendizado/planos', cookie, { token: pa.token }));
  for (const invalido of [undefined, 'x'.repeat(513)]) {
    motivoInicial = invalido;
    assert.equal((await aceitar()).status, 503);
  }
  motivoInicial = motivoCompleto;
  numeroDoParecer = 2;
  assert.equal((await aceitar()).status, 503);
  assert.equal(reescritas, 0);
  numeroDoParecer = 1;
  manterDefeito = true;
  revisoesDeFotografia.length = 0;
  assert.equal((await aceitar()).status, 503);
  assert.deepEqual(revisoesDeFotografia, [meioPasso, meioPasso]);
  assert.equal(reescritas, 1);
  assert.deepEqual(await ok(planos(req('aprendizado/planos', cookie))), []);
  manterDefeito = false;
  revisoesDeFotografia.length = 0;
  const a = (await salvarEReabrir(cookie, pa)).primeira;
  assert.match(a.titulo, /rastro/);
  assert.match(a.exercicio.enunciado, /rastro/);
  assert.deepEqual(revisoesDeFotografia, [meioPasso, casoDoRastro]);
  assert.equal(reescritas, 2);
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
  assert.equal(fetch.mock.callCount(), chamadasAntesDoAtraso + 3);
  const legado = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo: geral })));
  assert.ok(legado.fluxos.length);
  assert.equal(legado.diagnostico, undefined);
});

test('OpenAI simulada: recupera História do Brasil quando a resposta tem rótulos longos', async t => {
  const { id, cookie } = await novoVisitante();
  const ambiente = { IA: 'openai', OPENAI_API_KEY: 'chave-sintetica', OPENAI_BASE_URL: 'http://127.0.0.1:1' };
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
    assert.equal(url, 'http://127.0.0.1:1/responses');
    const pedido = JSON.parse(init.body);
    if (pedido.text.format.name === 'triagem_trilha') return respostaDaOpenAi({ decisao: 'permitir' });
    assert.deepEqual(JSON.parse(pedido.input[0].content[0].text), { objetivo });
    assert.equal(pedido.text.format.type, 'json_schema');
    assert.match(pedido.instructions, /até 100 caracteres/);
    assert.match(pedido.text.format.schema.properties.questao.properties.opcoes.description, /Exatamente três alternativas distintas/);
    assert.deepEqual(pedido.text.format.schema.properties.questao.properties.correta.enum, [0, 1, 2]);
    if (respostas.length === 1) assert.match(pedido.instructions, /A resposta anterior não pôde ser usada/);
    return respostaDaOpenAi(respostas.shift());
  });
  const pedir = () => diagnostico(req('aprendizado/diagnostico', cookie, { objetivo }));
  respostas = [longo, correta];
  const recorte = await ok(pedir());
  assert.equal(fetch.mock.callCount(), 4);
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
  assert.equal(fetch.mock.callCount(), 7);
});

test('OpenAI simulada: a mesma resposta corrigida muda a ação exigida no primeiro exercício salvo', async t => {
  const { id, cookie } = await novoVisitante();
  const ambiente = { IA: 'openai', OPENAI_API_KEY: 'chave-sintetica', OPENAI_BASE_URL: 'http://127.0.0.1:1', STUDOO_LIMITE_GERACOES_VISITANTE: '4' };
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
  const decisaoDeConferencia = 'Escolher uma operação que reúne os termos em x mantendo positivo o coeficiente restante.';
  const ambigua = 'Qual é o primeiro passo mais eficiente para resolver 2x + 9 = 8x − 3?';
  const conferencia = 'Em 2x + 9 = 8x − 3, que operação elimina o termo em x à esquerda e deixa um coeficiente positivo à direita?';
  const operacoes = ['Subtrair 2x dos dois lados, porque o coeficiente 2 é menor.', 'Subtrair 8x dos dois lados, porque 8 é maior.', 'Somar 3 aos dois lados antes de mexer nos termos com x.'];
  const tituloDeConferencia = 'Reunir os termos em x';
  const revisoes = [];
  let reparos = 0;
  let deixarRepetir = false;

  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1/responses');
    assert.doesNotMatch(init.body, /example.test/);
    const requisicao = JSON.parse(init.body);
    if (requisicao.text?.format?.name === 'triagem_trilha') return respostaDaOpenAi({ decisao: 'permitir' });
    const [sistema, entrada] = requisicao.instructions
      ? [requisicao.instructions, requisicao.input[0].content[0].text]
      : requisicao.input.map(m => m.content);
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
      return new Response(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: linhas })}\n\ndata: {"type":"response.completed"}\n\n`);
    }
    if (sistema.includes('Classifique a abrangência')) {
      return respostaDaOpenAi({ escopo: 'Equações do primeiro grau', nivelDeclarado: 'nao_declarado', recortes: [], questao: {
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
      return respostaDaOpenAi({ fluxos: [{ titulo: 'Aplicações', licoes: [
        { titulo: tituloNovo, resumo: desafio }, { titulo: tituloDeConferencia, resumo: decisaoDeConferencia },
      ] }] });
    }
    if (sistema.includes('Avalie todas as lições recebidas')) {
      assert.match(sistema, /compare todas as alternativas/);
      assert.match(sistema, /Não conte um critério implícito/);
      const dados = JSON.parse(entrada);
      assert.deepEqual(dados.curriculo.map(l => l.decisao), [desafio, decisaoDeConferencia]);
      assert.equal(dados.amostrasDemonstradas.length, 1);
      revisoes.push(dados.licoes.map(l => l.exercicios[0].enunciado));
      return respostaDaOpenAi({ avaliacoes: dados.licoes.map(({ numero, exercicios: [exercicio] }) => {
        const certa = exercicio.opcoes.find(o => o.id === exercicio.gabarito[0]).texto;
        if (exercicio.enunciado === aplicacao && certa === '3k + 5 = 20'
          || exercicio.enunciado === conferencia && certa === operacoes[0]) {
          return { numero, resultado: 'avanca', motivo: '' };
        }
        if (numero === 2) {
          assert.equal(exercicio.enunciado, ambigua);
          assert.deepEqual(exercicio.opcoes.map(o => o.texto), operacoes);
          return { numero, resultado: 'ajustar', motivo: 'As três operações são válidas. Explicite o objetivo de eliminar x à esquerda e manter positivo o coeficiente à direita.', correcoes: [] };
        }
        assert.equal(exercicio.enunciado, repeticao);
        assert.equal(certa, 'Subtrair 4');
        return { numero, resultado: 'ajustar', motivo: 'Falta escolher a equação que modela a taxa fixa.' };
      }) });
    }
    if (sistema.includes('Reescreva apenas as lições indicadas')) {
      reparos++;
      const { licoes } = JSON.parse(entrada);
      assert.deepEqual(licoes.map(l => l.numero), [1, 2]);
      assert.match(licoes[0].motivo, /taxa fixa/);
      assert.match(licoes[1].motivo, /três operações são válidas/);
      assert.match(sistema, /explicite no enunciado um critério verificável/);
      return respostaDaOpenAi({ licoes: licoes.map(({ numero }) => ({
        numero, conceito: numero === 1 ? 'Some a taxa fixa ao produto do preço pela quantidade.' : 'Subtraia o termo em x de um lado dos dois membros para reunir os termos.',
        exemplo: numero === 1 ? 'Numa conta de R$ 8 fixos mais R$ 2/kg, R$ 18 corresponde a 2k + 8 = 18.' : 'Em 5x + 2 = 3x + 10, subtrair 3x dos dois lados dá 2x + 2 = 10.',
        enunciado: numero === 1 ? deixarRepetir ? repeticao : aplicacao : deixarRepetir ? ambigua : conferencia,
        opcoes: numero === 1 ? deixarRepetir ? ['Subtrair 4', 'Somar 4', 'Dividir por 4'] : ['3k + 5 = 20', '5k + 3 = 20', '3k = 20 + 5'] : operacoes,
        correta: 0, feedbackCorreto: numero === 2 ? 'Subtrair 2x dá 9 = 6x − 3. Portanto, 12 = 6x e x = 2.' : 'Confira a condição pedida.',
        feedbackIncorreto: 'Considere tanto a conta quanto a condição da pergunta.',
      })) });
    }

    const adaptada = entrada.includes('Decisão a praticar nesta lição');
    const segundaLicao = adaptada && entrada.includes('Escreva a lição 2:');
    if (adaptada) {
      assert.ok(entrada.includes(segundaLicao ? decisaoDeConferencia : desafio));
      assert.match(entrada, /explicite no enunciado um critério verificável/);
    }
    const opcoes = segundaLicao ? operacoes : adaptada ? ['Subtrair 4', 'Somar 4', 'Dividir por 4'] : ['7', '5', '12'];
    return respostaDaOpenAi({
      objetivo: habilidade,
      conceito: 'Aplique a mesma operação nos dois lados para isolar a incógnita.',
      exemplo: 'Em x + 3 = 8, subtraia 3 para encontrar x = 5.',
      exercicio: {
        tipo: 'multipla_escolha', enunciado: segundaLicao ? ambigua : adaptada ? repeticao : fundamentos,
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
  for (const opcao of segunda.exercicio.opcoes) {
    const avaliada = await ok(avaliar(req('aprendizado/licoes/' + segundaId + '/avaliar', cookie, { resposta: opcao.id }), ctx(segundaId)));
    assert.equal(avaliada.correta, opcao.texto === operacoes[0]);
    if (avaliada.correta) assert.match(avaliada.feedback, /9 = 6x − 3.*x = 2/);
  }
  assert.deepEqual(revisoes, [[repeticao, ambigua], [aplicacao, conferencia]]);
  assert.equal(reparos, 1, 'os dois exercícios foram reparados em uma chamada');

  deixarRepetir = true;
  const invalida = await pedir(corrigida.id);
  assert.equal((await salvar(req('aprendizado/planos', cookie, { token: invalida.token }))).status, 503);
  assert.deepEqual(revisoes, [[repeticao, ambigua], [aplicacao, conferencia], [repeticao, ambigua], [repeticao, ambigua]]);
  assert.equal((await ok(planos(req('aprendizado/planos', cookie)))).length, 3);
});

test('OpenAI simulada: corrige gabaritos de exposição em duas rodadas e conserva todas as lições ao salvar', async t => {
  const { id, cookie } = await novoVisitante();
  const ambiente = { IA: 'openai', OPENAI_API_KEY: 'chave-sintetica', OPENAI_BASE_URL: 'http://127.0.0.1:1' };
  const anterior = Object.fromEntries(Object.keys(ambiente).map(chave => [chave, process.env[chave]]));
  Object.assign(process.env, ambiente);
  t.after(() => {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });
  await aceitarConsentimentoIa(id, VERSAO_CONSENTIMENTO_IA);

  const objetivo = 'Aprender a compensar a exposição usando o obturador, em nível intermediário';
  const questao = {
    habilidade: 'Ajustar o obturador para clarear uma foto',
    enunciado: 'Com abertura e ISO fixos, o que muda no tempo de exposição para clarear uma foto escura?',
    opcoes: ['Aumenta', 'Diminui', 'Fica igual'], correta: 0,
  };
  const curriculo = [
    { titulo: 'Ler o fotômetro', resumo: 'Escolher os passos no obturador a partir da leitura do fotômetro.' },
    { titulo: 'Preservar o movimento', resumo: 'Escolher o ISO quando o tempo necessário borraria o movimento.' },
    { titulo: 'Equilibrar obturador e abertura', resumo: 'Escolher a direção e o tempo de obturador que compensam mudanças de abertura.' },
    { titulo: 'Manter o ISO no limite', resumo: 'Escolher como compensar quando o ISO e o tempo já chegaram ao limite.' },
  ];
  function escolha(enunciado, opcoes, correta) {
    return {
      tipo: 'multipla_escolha', enunciado, opcoes: opcoes.map((texto, i) => ({ id: 'o' + i, texto })),
      gabarito: ['o' + correta], feedbackCorreto: 'Isso mantém a exposição.', feedbackIncorreto: 'Compare os passos de luz.',
    };
  }
  const associacao = {
    tipo: 'associar', enunciado: 'Com ISO fixo, associe cada mudança de abertura ao ajuste que mantém a exposição.',
    esquerda: [{ id: 'e1', texto: 'Fechar um passo' }, { id: 'e2', texto: 'Abrir dois passos' }],
    direita: [{ id: 'd1', texto: 'Tempo quatro vezes menor' }, { id: 'd2', texto: 'Dobrar o tempo' }],
    gabarito: [], feedbackCorreto: 'Fechar pede menos tempo.', feedbackIncorreto: 'Abra o obturador por menos tempo ao fechar a abertura.',
  };
  const fotografias = [
    { conceito: 'Cada ponto no fotômetro equivale a um passo de luz.', exemplo: 'Se a leitura é −1 EV, dobre o tempo para compensar.',
      exercicios: [escolha('O fotômetro indica −2 EV. Com ISO e abertura fixos, que tempo usar no lugar de 1/250 s?', ['1/60 s', '1/125 s', '1/500 s'], 0)] },
    { conceito: 'Aumentar o ISO permite manter um tempo curto.', exemplo: 'Se o tempo de 1/500 s não pode mudar, dobrar o ISO compensa um passo de luz.',
      exercicios: [escolha('Em 1/500 s e ISO 200, falta um passo de brilho. Com abertura e tempo fixos, qual ISO escolher?', ['ISO 100', 'ISO 200', 'ISO 400'], 2)] },
    { conceito: 'A luz perdida ao fechar a abertura pode ser recuperada com um tempo maior.', exemplo: 'De f/4 para f/5,6, passe de 1/250 s para 1/125 s.',
      exercicios: [associacao, escolha('Com ISO fixo, ao passar de f/4 para f/8, qual tempo substitui 1/250 s?', ['1/60 s', '1/125 s', '1/1000 s'], 2)] },
    { conceito: 'Quando ISO e tempo já estão no limite, use a abertura para compensar.', exemplo: 'Abrir de f/8 para f/5,6 compensa um passo.',
      exercicios: [escolha('A foto em f/8 está um passo escura e ISO e tempo já estão no limite. Que abertura compensa?', ['f/11', 'f/8', 'f/5,6'], 2)] },
  ];

  const revisoes = [];
  const geradas = [];
  let recusarNaUltima = false;
  const corrigirPares = { exercicio: 1, gabarito: ['e1=d2', 'e2=d1'], feedbackCorreto: 'Fechar pede mais tempo. Abrir pede menos tempo.', feedbackIncorreto: 'Veja se a abertura deixou entrar mais ou menos luz.' };
  const corrigirTempo = { exercicio: 2, gabarito: ['o0'], feedbackCorreto: 'Fechar dois passos pede cerca de quatro vezes o tempo.', feedbackIncorreto: 'Conte os passos de f/4 até f/8.' };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1/responses');
    const pedido = JSON.parse(init.body);
    if (pedido.text?.format?.name === 'triagem_trilha') return respostaDaOpenAi({ decisao: 'permitir' });
    const [sistema, entrada] = pedido.instructions
      ? [pedido.instructions, pedido.input[0].content[0].text]
      : pedido.input.map(m => m.content);
    if (pedido.stream) {
      const linhas = [
        { tipo: 'plano', titulo: 'Fotografia em prática' }, { tipo: 'fluxo', titulo: 'Exposição' },
        ...curriculo.map(licao => ({ tipo: 'licao', ...licao })),
      ].map(linha => JSON.stringify(linha)).join('\n') + '\n';
      return new Response(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: linhas })}\n\ndata: {"type":"response.completed"}\n\n`);
    }
    if (sistema.includes('Classifique a abrangência')) {
      return respostaDaOpenAi({ escopo: 'Compensar a exposição', nivelDeclarado: 'intermediario', recortes: [], questao });
    }
    if (sistema.includes('Revise o conjunto das lições obrigatórias')) {
      return respostaDaOpenAi({ fluxos: [{ titulo: 'Exposição', licoes: curriculo }] });
    }
    if (sistema.includes('Avalie todas as lições recebidas')) {
      const { licoes } = JSON.parse(entrada);
      revisoes.push(licoes.map(l => l.numero));
      const rodada = (revisoes.length - 1) % 3 + 1;
      assert.match(sistema, /Resolva separadamente cada exercício numerado/);
      return respostaDaOpenAi({ avaliacoes: licoes.map(({ numero, exercicios }) => {
        const aprovado = { numero, resultado: 'avanca', motivo: '', correcoes: [] };
        if (numero !== 3) return aprovado;
        const [pares, escolha] = exercicios;
        assert.equal(pares.enunciado, associacao.enunciado);
        assert.deepEqual(pares.esquerda, associacao.esquerda);
        assert.deepEqual(pares.direita, associacao.direita);
        assert.equal(escolha.enunciado, fotografias[2].exercicios[1].enunciado);
        assert.deepEqual(escolha.opcoes, fotografias[2].exercicios[1].opcoes);
        assert.deepEqual(exercicios.map(e => e.numero), [1, 2]);
        if (rodada === 1) {
          assert.deepEqual(pares.gabarito, ['e1=d1', 'e2=d2']);
          assert.deepEqual(escolha.gabarito, ['o2']);
          return { numero, resultado: 'ajustar', motivo: 'Os pares estão invertidos.', correcoes: [corrigirPares] };
        }
        assert.deepEqual(pares.gabarito, ['e1=d2', 'e2=d1']);
        assert.match(pares.feedbackCorreto, /Fechar pede mais tempo/);
        if (rodada === 2) {
          assert.deepEqual(escolha.gabarito, ['o2']);
          return { numero, resultado: 'ajustar', motivo: 'De f/4 para f/8, o tempo correto é próximo de 1/60 s.', correcoes: [corrigirTempo] };
        }
        assert.deepEqual(escolha.gabarito, ['o0']);
        if (recusarNaUltima) {
          return { numero, resultado: 'ajustar', motivo: 'O feedback ainda precisa de ajuste.', correcoes: [corrigirTempo] };
        }
        return aprovado;
      }) });
    }
    assert.doesNotMatch(sistema, /Reescreva apenas as lições indicadas/);
    const numero = Number(entrada.match(/Escreva a lição (\d+):/)?.[1]);
    assert.ok(numero >= 1 && numero <= 4);
    geradas.push(numero);
    return respostaDaOpenAi({ objetivo: curriculo[numero - 1].resumo, ...fotografias[numero - 1] });
  });

  const amostra = await ok(diagnostico(req('aprendizado/diagnostico', cookie, { objetivo })));
  const demonstrado = await responder(cookie, amostra, 'Aumenta');
  const previa = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId: demonstrado.id })));
  const { reaberto } = await salvarEReabrir(cookie, previa);
  assert.deepEqual([...geradas].sort(), [1, 2, 3, 4]);
  assert.deepEqual(revisoes, [[1, 2, 3, 4], [3], [3]]);

  const ids = reaberto.fluxos[0].licoes.map(l => l.id);
  const aulas = await Promise.all(ids.map(id => ok(licao(req('aprendizado/licoes/' + id, cookie), ctx(id)))));
  assert.deepEqual(aulas.map(l => l.titulo), curriculo.map(l => l.titulo));
  assert.deepEqual(aulas.map(l => l.conceito), fotografias.map(l => l.conceito));
  assert.deepEqual(aulas.map(l => l.exemplo), fotografias.map(l => l.exemplo));
  assert.deepEqual(aulas.map(l => l.exercicio.enunciado), fotografias.map(l => l.exercicios[0].enunciado));

  const terceira = aulas[2];
  assert.equal(terceira.exercicio.tipo, 'associar');
  assert.ok(!Object.hasOwn(terceira.exercicio, 'gabarito'));
  assert.deepEqual(terceira.exercicio.esquerda, associacao.esquerda);
  assert.deepEqual(terceira.exercicio.direita.toSorted((a, b) => a.id.localeCompare(b.id)), associacao.direita);
  const verificar = (resposta, indice = 0) =>
    ok(avaliar(req('aprendizado/licoes/' + terceira.id + '/avaliar', cookie, { resposta, indice }), ctx(terceira.id)));
  assert.equal((await verificar('e1=d1,e2=d2')).correta, false);
  const pares = await verificar('e1=d2,e2=d1');
  assert.equal(pares.correta, true);
  assert.match(pares.feedback, /Fechar pede mais tempo/);
  assert.equal((await verificar(terceira.exercicios[1].opcoes.find(o => o.texto === '1/60 s').id, 1)).correta, true);
  assert.equal((await verificar(terceira.exercicios[1].opcoes.find(o => o.texto === '1/1000 s').id, 1)).correta, false);

  recusarNaUltima = true;
  const outra = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo, diagnosticoId: demonstrado.id })));
  assert.equal((await salvar(req('aprendizado/planos', cookie, { token: outra.token }))).status, 503);
  assert.deepEqual(revisoes, [[1, 2, 3, 4], [3], [3], [1, 2, 3, 4], [3], [3]]);
  assert.equal((await ok(planos(req('aprendizado/planos', cookie)))).length, 1);
});

function simularLuna(t, responder) {
  const anterior = { IA: process.env.IA, OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_BASE_URL: process.env.OPENAI_BASE_URL };
  Object.assign(process.env, { IA: 'openai', OPENAI_API_KEY: 'chave-sintetica', OPENAI_BASE_URL: 'http://127.0.0.1:1/v1' });
  t.after(() => {
    for (const [chave, valor] of Object.entries(anterior)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });
  return t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://127.0.0.1:1/v1/responses');
    const pedido = JSON.parse(init.body);
    assert.equal(pedido.model, 'gpt-6-luna');
    assert.deepEqual(pedido.reasoning, { effort: 'max' });
    assert.equal(pedido.store, false);
    assert.doesNotMatch(init.body, /@example.test|consentimentoIaEm/);
    return responder(pedido);
  });
}

test('diagnóstico, pular perguntas, proposta direta e token antigo recusam sem gerar nem salvar', async t => {
  const conta = await banco.usuario.create({ data: { email: `seguranca-${crypto.randomUUID()}@example.test`, fuso: 'UTC' } });
  const id = conta.id;
  usuarios.add(id);
  const cookie = cookieSessao((await criarSessao(id, 'WEB')).token).split(';')[0];
  const objetivo = 'Quero aprender a assaltar um banco';
  const contextoLegitimo = 'Estudar a história dos assaltos a banco';
  const triagens = [];
  let modo = 'recusar';
  const fetch = simularLuna(t, pedido => {
    assert.equal(pedido.text.format.name, 'triagem_trilha');
    const dados = JSON.parse(pedido.input[0].content[0].text);
    triagens.push(dados);
    if (modo === 'falha') return new Response('', { status: 503 });
    if (modo === 'incierto') return respostaDaOpenAi({ decisao: 'indeterminado' });
    return respostaDaOpenAi({ decisao: 'recusar' });
  });
  const rotas = [
    ['aprendizado/diagnostico', diagnostico],
    ['aprendizado/propostas', proposta],
  ];
  for (const [caminho, rota] of rotas) {
    assert.equal((await rota(req(caminho, cookie, { objetivo }))).status, 428);
  }
  assert.equal(fetch.mock.callCount(), 0);
  await aceitarConsentimentoIa(id, VERSAO_CONSENTIMENTO_IA);
  for (const [caminho, rota] of rotas) {
    const resposta = await rota(req(caminho, cookie, { objetivo }));
    assert.equal(resposta.status, 422);
    assert.equal((await resposta.json()).codigo, 'conteudo_nocivo');
  }
  const aoVivo = corpo => eventosProposta(req('aprendizado/propostas/ao-vivo', cookie, corpo));
  const recusada = await aoVivo({ objetivo });
  assert.equal(recusada.status, 200);
  const eventos = (await recusada.text()).trim().split('\n').map(JSON.parse);
  assert.deepEqual(eventos, [{ tipo: 'erro', codigo: 'conteudo_nocivo' }]);

  const antigo = emitirComprovante('proposta', id, { id: crypto.randomUUID(), expiraEm: Date.now() + 60_000,
    plano: { gerador: 'adaptador-legado', titulo: contextoLegitimo, objetivo: contextoLegitimo, origem: 'Legado',
      fluxos: [{ titulo: 'Análise', licoes: [{ titulo: 'Simulação operacional para cometer homicídio' }] }] },
  });
  const aceitada = await salvar(req('aprendizado/planos', cookie, { token: antigo }));
  assert.equal(aceitada.status, 422);
  assert.match(triagens.at(-1).plano.fluxos[0].licoes[0].titulo, /Simulação operacional/);

  const registro = await banco.diagnosticoAprendizado.create({ data: {
    usuarioId: id, objetivo: contextoLegitimo, expiraEm: new Date(Date.now() + 60_000), passo: 2,
    estado: { perfil: { nivel: 'basico', escopo: 'Finalidade operacional disfarçada', lacunas: [], demonstrados: ['Habilidade derivada do material editado'] } },
  } });
  const adaptada = await aoVivo({ objetivo: contextoLegitimo, diagnosticoId: registro.id });
  assert.deepEqual((await adaptada.text()).trim().split('\n').map(JSON.parse), [{ tipo: 'erro', codigo: 'conteudo_nocivo' }]);
  assert.equal(triagens.at(-1).diagnostico.escopo, 'Finalidade operacional disfarçada');
  for (const falha of ['falha', 'incierto']) {
    modo = falha;
    const resposta = await proposta(req('aprendizado/propostas', cookie, { objetivo: contextoLegitimo }));
    assert.equal(resposta.status, 503);
    assert.equal((await resposta.json()).codigo, 'ia_indisponivel');
  }
  assert.deepEqual(await ok(planos(req('aprendizado/planos', cookie))), []);
  assert.equal(await banco.diagnosticoAprendizado.count({ where: { usuarioId: id } }), 1, 'só o diagnóstico legado criado na prova');
});

test('arquivos, OCR e objetivo da proposta de material são triados antes de gravar ou gerar', async t => {
  const { id, cookie } = await novoVisitante();
  await aceitarConsentimentoIa(id, VERSAO_CONSENTIMENTO_IA);
  const vistas = [];
  simularLuna(t, pedido => {
    const nome = pedido.text.format.name;
    const [texto, anexo] = pedido.input[0].content;
    const dados = JSON.parse(texto.text);
    vistas.push({ nome, dados, anexo });
    if (nome === 'leitura_material') return respostaDaOpenAi({
      paginas: [{ numero: 1, texto: 'Texto extraído com instruções operacionais nocivas, exemplo sintético.' }],
    });
    assert.equal(nome, 'triagem_trilha');
    const recusar = /operacionais nocivas|objetivo operacional/i.test(JSON.stringify(dados));
    return respostaDaOpenAi({ decisao: recusar ? 'recusar' : 'permitir' });
  });
  const enviar = (nome, tipo, conteudo) => enviarMaterial(req('estudio/materiais', cookie, {
    nome, tipo, base64: Buffer.from(conteudo).toString('base64'),
  }));
  const csv = await enviar('notas.csv', 'text/csv', 'conteudo\nInstruções operacionais nocivas em um documento sintético.');
  assert.equal(csv.status, 422);
  assert.equal(vistas.length, 1);
  assert.match(vistas[0].dados.material.paginas[0].texto, /operacionais nocivas/);
  const foto = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#fff' } }).png().toBuffer();
  const resultado = await enviar('pagina.png', 'image/png', foto);
  assert.equal(resultado.status, 422);
  assert.deepEqual(vistas.map(p => p.nome), ['triagem_trilha', 'triagem_trilha', 'leitura_material', 'triagem_trilha']);
  assert.equal(vistas[1].anexo.type, 'input_image');
  assert.match(vistas[1].anexo.image_url, /^data:image\/jpeg;base64,/);
  assert.equal(await banco.materialEstudo.count({ where: { usuarioId: id } }), 0);

  const material = await ok(enviar('historia.csv', 'text/csv', 'conteudo\nHistória dos assaltos a banco e das políticas de prevenção.'));
  const resposta = await proporMaterial(req(`estudio/materiais/${material.id}/proposta`, cookie, { objetivo: 'Objetivo operacional disfarçado' }), ctx(material.id));
  assert.equal(resposta.status, 422);
  assert.equal(vistas.at(-1).dados.objetivo, 'Objetivo operacional disfarçado');
  assert.equal(await banco.materialEstudo.count({ where: { usuarioId: id } }), 1, 'nenhum rascunho criado');
});

test('uma lição nociva da OpenAI é recusada no aceite e nunca fica disponível no banco', async t => {
  const { id, cookie } = await novoVisitante();
  await aceitarConsentimentoIa(id, VERSAO_CONSENTIMENTO_IA);
  const vistos = [];
  const objetivo = 'Estudar direito penal e prevenção da violência';
  simularLuna(t, pedido => {
    const nome = pedido.text?.format?.name ?? 'estrutura';
    vistos.push(nome);
    if (nome === 'triagem_trilha') {
      const dados = JSON.parse(pedido.input[0].content[0].text);
      const recusada = dados.conteudo?.some(l => l.exercicio.feedbackCorreto === 'Instrução operacional simulada.');
      return respostaDaOpenAi({ decisao: recusada ? 'recusar' : 'permitir' });
    }
    if (pedido.stream) {
      const delta = [
        { tipo: 'plano', titulo: 'Direito penal e prevenção' }, { tipo: 'fluxo', titulo: 'Análise jurídica' },
        { tipo: 'licao', titulo: 'Reconhecer medidas preventivas' },
      ].map(JSON.stringify).join('\n') + '\n';
      return new Response(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta })}\n\ndata: {"type":"response.completed"}\n\n`);
    }
    return respostaDaOpenAi({
      objetivo: 'Reconhecer medidas preventivas', conceito: 'Prevenir é reduzir o risco de violência.',
      exemplo: 'Uma instituição pode capacitar sua equipe para pedir ajuda.',
      exercicios: [{
        tipo: 'multipla_escolha', enunciado: 'Qual medida atua antes de um incidente?',
        opcoes: [{ id: 'a', texto: 'Treinamento' }, { id: 'b', texto: 'Sentença' }, { id: 'c', texto: 'Investigação' }],
        gabarito: ['a'], feedbackCorreto: 'Instrução operacional simulada.', feedbackIncorreto: 'Pense no que acontece antes do incidente.',
      }],
    });
  });
  const p = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo })));
  const resposta = await salvar(req('aprendizado/planos', cookie, { token: p.token }));
  assert.equal(resposta.status, 422);
  assert.equal((await resposta.json()).codigo, 'conteudo_nocivo');
  assert.deepEqual(vistos, ['triagem_trilha', 'estrutura', 'triagem_trilha', 'triagem_trilha', 'licao_studoo', 'triagem_trilha']);
  assert.equal(await banco.planoAprendizado.count({ where: { usuarioId: id } }), 0);
  assert.equal(await banco.licao.count({ where: { usuarioId: id } }), 0);
});

test('aceite de proposta antiga usa Luna e triagem; trilha já salva continua abrindo com a origem original', async t => {
  const { id, cookie } = await novoVisitante();
  const objetivo = 'Aprender a identificar frações equivalentes';
  const demonstracao = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo })));
  const jaSalva = await ok(salvar(req('aprendizado/planos', cookie, { token: demonstracao.token })));
  assert.match(jaSalva.origem, /Modo demonstração/);
  const demoPendente = await ok(proposta(req('aprendizado/propostas', cookie, { objetivo: 'Aprender frações em receitas' })));

  const chamadas = [];
  simularLuna(t, pedido => {
    const nome = pedido.text.format.name;
    chamadas.push(nome);
    if (nome === 'triagem_trilha') return respostaDaOpenAi({ decisao: 'permitir' });
    assert.match(nome, /^licao_studoo(?:_matematica)?$/);
    return respostaDaOpenAi({
      objetivo: 'Reconhecer frações equivalentes',
      conceito: 'Duas frações são equivalentes quando representam a mesma parte do inteiro.',
      exemplo: 'Uma metade corresponde a dois quartos.',
      exercicios: [{
        tipo: 'multipla_escolha',
        enunciado: 'Qual fração representa a mesma parte que uma metade?',
        opcoes: [{ id: 'a', texto: 'Dois quartos' }, { id: 'b', texto: 'Dois terços' }, { id: 'c', texto: 'Três quartos' }],
        gabarito: ['a'], feedbackCorreto: 'Uma metade contém dois quartos.', feedbackIncorreto: 'Pense em quatro partes iguais.',
      }],
    });
  });

  const reaberta = await ok(plano(req('aprendizado/planos/' + jaSalva.id, cookie), ctx(jaSalva.id)));
  assert.equal(reaberta.origem, jaSalva.origem, 'a leitura não pede novo aceite nem chama a IA');
  assert.deepEqual(chamadas, []);
  await aceitarConsentimentoIa(id, VERSAO_CONSENTIMENTO_IA);
  const reenviada = await ok(salvar(req('aprendizado/planos', cookie, { token: demonstracao.token })));
  assert.equal(reenviada.id, jaSalva.id);
  assert.equal(reenviada.origem, jaSalva.origem);
  assert.deepEqual(chamadas, []);

  const legadoId = crypto.randomUUID();
  const legado = {
    titulo: 'Frações equivalentes', objetivo, origem: 'IA do Provedor Legado',
    fluxos: [{ titulo: 'Frações no cotidiano', licoes: [{ titulo: 'Reconhecer frações equivalentes' }] }],
  };
  const token = emitirComprovante('proposta', id, {
    id: legadoId, expiraEm: Date.now() + 60_000, plano: { ...legado, gerador: 'provedor-legado-v1' },
  });
  const { reaberto: aceito, primeira } = await salvarEReabrir(cookie, { ...legado, token });
  assert.equal(aceito.id, legadoId);
  assert.equal(aceito.origem, 'Conteúdo gerado pelo Studoo');
  assert.equal(primeira.origem, aceito.origem);
  assert.equal(primeira.exercicio.opcoes.find(o => o.texto === 'Dois quartos')?.texto, 'Dois quartos');
  assert.deepEqual(chamadas, ['triagem_trilha', 'licao_studoo_matematica', 'triagem_trilha']);

  const atualizada = await ok(salvar(req('aprendizado/planos', cookie, { token: demoPendente.token })));
  assert.equal(atualizada.origem, 'Conteúdo gerado pelo Studoo', 'o aceite real não herda o rótulo simulado');
  assert.equal(chamadas[3], 'triagem_trilha');
  assert.equal(chamadas.at(-1), 'triagem_trilha');
  assert.equal(chamadas.slice(4, -1).length, demoPendente.fluxos.flatMap(f => f.licoes).length);
});

test('rota NDJSON guarda toda a estrutura até a triagem final, inclusive quando falha ou expira', { timeout: 15_000 }, async t => {
  const conta = await banco.usuario.create({ data: { email: `stream-${crypto.randomUUID()}@example.test`, fuso: 'UTC' } });
  usuarios.add(conta.id);
  const cookie = cookieSessao((await criarSessao(conta.id, 'WEB')).token).split(';')[0];
  await aceitarConsentimentoIa(conta.id, VERSAO_CONSENTIMENTO_IA);
  const estrutura = [
    { tipo: 'plano', titulo: 'História e direito' },
    { tipo: 'fluxo', titulo: 'Análise de fontes' },
    { tipo: 'licao', titulo: 'Comparar documentos', resumo: 'Distinguir contexto e evidência.' },
  ];
  let modo = 'permitir';
  const iniciouRevisao = Promise.withResolvers();
  const liberarRevisao = Promise.withResolvers();
  const revisoes = [];
  simularLuna(t, async pedido => {
    if (pedido.stream) {
      const delta = estrutura.map(JSON.stringify).join('\n') + '\n';
      const primeiraParte = `data: ${JSON.stringify({ type: 'response.output_text.delta', delta })}\n\n`;
      if (modo === 'stream-erro') return new Response(primeiraParte + 'data: {"type":"response.failed"}\n\n');
      if (modo === 'stream-prazo') {
        return new Response(new ReadableStream({
          start(canal) { canal.enqueue(new TextEncoder().encode(primeiraParte)); },
          pull(canal) { canal.error(new DOMException('Prazo simulado no stream', 'TimeoutError')); },
        }));
      }
      return new Response(primeiraParte + 'data: {"type":"response.completed"}\n\n');
    }
    const dados = JSON.parse(pedido.input[0].content[0].text);
    if (!dados.estrutura) return respostaDaOpenAi({ decisao: 'permitir' });
    revisoes.push(dados.estrutura);
    if (modo === 'http') return new Response(null, { status: 503 });
    if (modo === 'prazo') throw new DOMException('Prazo simulado', 'TimeoutError');
    if (modo === 'recusar') return respostaDaOpenAi({ decisao: 'recusar' });
    iniciouRevisao.resolve();
    await liberarRevisao.promise;
    return respostaDaOpenAi({ decisao: 'permitir' });
  });
  const abrir = () => eventosProposta(req('aprendizado/propostas/ao-vivo', cookie, { objetivo: 'Estudar história e direito' }));
  const resposta = await abrir();
  const leitor = resposta.body.getReader();
  const decoder = new TextDecoder();
  try {
    const primeira = await leitor.read();
    assert.equal(decoder.decode(primeira.value), '\n', 'apenas o pulso neutro da resposta precede a revisão');
    await iniciouRevisao.promise;
    let recebeu = false;
    const proxima = leitor.read().then(item => { recebeu = true; return item; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(recebeu, false, 'título, fluxo e lição continuam retidos enquanto a triagem está pendente');
    liberarRevisao.resolve();
    const eventos = [decoder.decode((await proxima).value)];
    while (true) {
      const item = await leitor.read();
      if (item.done) break;
      eventos.push(decoder.decode(item.value));
    }
    assert.deepEqual(eventos.join('').trim().split('\n').map(linha => JSON.parse(linha).tipo),
      ['plano', 'fluxo', 'licao', 'pronto']);
  } finally {
    liberarRevisao.resolve();
    await leitor.cancel();
  }

  for (const [cenario, codigo] of [
    ['http', 'ia_indisponivel'], ['prazo', 'ia_indisponivel'], ['recusar', 'conteudo_nocivo'],
    ['stream-erro', 'ia_indisponivel'], ['stream-prazo', 'ia_indisponivel'],
  ]) {
    modo = cenario;
    const bruto = await (await abrir()).text();
    assert.deepEqual(bruto.trim().split('\n').map(JSON.parse), [{ tipo: 'erro', codigo }]);
    assert.doesNotMatch(bruto, /História e direito|Análise de fontes|Comparar documentos|Distinguir contexto/);
  }
  assert.equal(revisoes.length, 4);
  for (const vista of revisoes) assert.deepEqual(vista.map(({ titulo }) => titulo), estrutura.map(({ titulo }) => titulo));
});
