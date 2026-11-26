// Retomada da criação de trilhas (spec 04, Retomada da criação), no servidor: o pedido registrado antes de gerar, a consulta que nunca gera, a resposta perdida, a concorrência entre
// instâncias, o dono que para, a falha confirmada (com o prazo RESTANTE do limite) e o aceite legado. Banco real, IA da OpenAI simulada por um servidor local: nenhuma chamada paga.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';

process.env.IA = 'openai';
process.env.OPENAI_API_KEY = 'chave-de-teste';
process.env.STUDOO_GERACAO_PARALELA = '10';

const { banco } = await import('../src/servidor/banco/cliente.ts');
const servico = await import('../src/servidor/aprendizado/servico.ts');
const outraInstancia = await import('../src/servidor/aprendizado/servico.ts?instancia=outra');
const pedidos = await import('../src/servidor/aprendizado/pedidos.ts');
const { emitirComprovante } = await import('../src/servidor/aprendizado/comprovantes.ts');
const { GERADOR_OPENAI } = await import('../src/servidor/ia/openai.ts');
const { assinatura } = await import('../src/servidor/acesso/seguranca.ts');
const { criarSessao } = await import('../src/servidor/acesso/sessao.ts');
const { VERSAO_CONSENTIMENTO_IA } = await import('@studoo/contratos/privacidade');
const rotaPedido = await import('../src/app/api/aprendizado/pedidos/[pedidoId]/route.ts');
const rotaPlanos = await import('../src/app/api/aprendizado/planos/route.ts');
const rotaSessao = await import('../src/app/api/sessao/route.ts');

const licaoDeEscolha = {
  objetivo: 'Reconhecer as partes do violão.',
  conceito: 'O violão tem corpo, braço e cabeça. As cordas vão da cabeça até o cavalete, no corpo.',
  exemplo: 'Ao afinar, você gira as tarraxas, que ficam na cabeça do violão.',
  exercicio: {
    tipo: 'multipla_escolha', enunciado: 'Onde ficam as tarraxas?', contexto: null, trecho: null,
    opcoes: [{ id: 'x', texto: 'Na cabeça' }, { id: 'x', texto: 'No corpo' }, { id: 'x', texto: 'No braço' }],
    gabarito: ['Na cabeça'], feedbackCorreto: 'Isso: as tarraxas ficam na cabeça do violão.', feedbackIncorreto: 'As tarraxas ficam na cabeça, a ponta do braço.',
  },
};

// O servidor que imita a OpenAI: conta os pedidos por tipo e segura as lições num portão que o teste abre.
const provedor = { triagens: 0, licoes: 0, outros: 0, decisao: 'permitir', modoLicao: 'normal', retryAfter: '120', portao: Promise.resolve(), portaDaChamada: null };
let servidor;
before(async () => {
  servidor = createServer((pedido, resposta) => {
    pedido.on('error', () => undefined);
    resposta.on('error', () => undefined);
    let corpo = '';
    pedido.on('data', (parte) => { corpo += parte; });
    pedido.on('end', async () => {
      const dados = JSON.parse(corpo || '{}');
      const formato = dados.text?.format?.name;
      const json = (status, objeto, cabecalhos = {}) => { resposta.writeHead(status, { 'Content-Type': 'application/json', ...cabecalhos }); resposta.end(JSON.stringify(objeto)); };
      if (formato === 'triagem_trilha') {
        provedor.triagens += 1;
        return json(200, { status: 'completed', output_text: JSON.stringify({ decisao: provedor.decisao }) });
      }
      if (formato === 'licao_studoo' || formato === 'licao_studoo_matematica') {
        provedor.licoes += 1;
        await (provedor.portaDaChamada ? provedor.portaDaChamada(provedor.licoes) : provedor.portao);
        if (provedor.modoLicao === 'erro500') return json(500, { error: { message: 'indisponível' } });
        if (provedor.modoLicao === 'limite429') return json(429, { error: { code: 'rate_limit_exceeded', message: 'limite' } }, { 'retry-after': provedor.retryAfter });
        return json(200, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(licaoDeEscolha) }] }] });
      }
      provedor.outros += 1;
      return json(200, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(licaoDeEscolha) }] }] });
    });
  });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${servidor.address().port}/v1`;
});
after(async () => {
  pedidos.configurarTemposDoPedido();
  servidor.closeAllConnections();
  await new Promise((resolver) => servidor.close(resolver));
  await banco.$disconnect();
});
beforeEach(() => {
  Object.assign(provedor, { triagens: 0, licoes: 0, outros: 0, decisao: 'permitir', modoLicao: 'normal', retryAfter: '120', portao: Promise.resolve(), portaDaChamada: null });
  pedidos.configurarTemposDoPedido({ validadeMs: 45_000, renovarMs: 10_000, entranteMs: 100 });
});

const LICOES = 3;
const esqueleto = () => ({
  gerador: GERADOR_OPENAI, titulo: 'Python para programadores experientes', objetivo: 'Aprender Python rápido, sem perder tempo com o básico.', origem: 'Conteúdo gerado pelo Studoo',
  fluxos: [{ titulo: 'Base', licoes: [{ titulo: 'Tipos e funções' }, { titulo: 'Coleções' }] }, { titulo: 'Prática', licoes: [{ titulo: 'Projeto pequeno' }] }],
});
async function novaConta() {
  const usuario = await banco.usuario.create({
    data: { email: `retomada-${randomUUID()}@example.test`, fuso: 'America/Sao_Paulo', consentimentoIaEm: new Date(), consentimentoIaVersao: VERSAO_CONSENTIMENTO_IA },
  });
  const { token } = await criarSessao(usuario.id, 'WEB');
  return { id: usuario.id, cookie: `studoo-sessao=${token}` };
}
function novaProposta(usuarioId, { validaPorMs = 30 * 60_000 } = {}) {
  const id = randomUUID();
  const expiraEm = Date.now() + validaPorMs;
  return { id, expiraEm, token: emitirComprovante('proposta', usuarioId, { id, expiraEm, plano: esqueleto() }) };
}
function fechar() {
  let abrir;
  provedor.portao = new Promise((resolver) => { abrir = resolver; });
  return abrir;
}
async function esperarAte(condicao, ms = 5000) {
  const limite = Date.now() + ms;
  for (;;) {
    const valor = await condicao();
    if (valor) return valor;
    if (Date.now() > limite) throw new Error('A condição não se cumpriu a tempo.');
    await new Promise((resolver) => setTimeout(resolver, 25));
  }
}
const planosDe = (usuarioId) => banco.planoAprendizado.count({ where: { usuarioId } });
const quotaGasta = async (usuarioId) => (await banco.tentativaLogin.findUnique({ where: { chave: assinatura(`ia:aceite:${usuarioId}`) } }))?.falhas ?? 0;
const pelaRota = (conta, id) => rotaPedido.GET(new Request(`http://localhost:3197/api/aprendizado/pedidos/${id}`, { headers: { cookie: conta.cookie } }), { params: Promise.resolve({ pedidoId: id }) });
async function rejeicao(promessa) {
  try { await promessa; } catch (erro) { return erro; }
  throw new Error('Era para falhar.');
}

test('o pedido é registrado ANTES de gerar: em preparo, com etapa, uma tentativa; a consulta não chama a IA e o aceite termina em "pronto" com o plano', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  assert.deepEqual(await servico.consultarCriacao(conta.id, id), { estado: 'nao_recebido', pedidoId: id });

  const abrir = fechar();
  const aceite = servico.aceitarProposta(conta.id, token);
  const preparo = await esperarAte(async () => { const e = await servico.consultarCriacao(conta.id, id); return e.estado === 'em_preparo' && e.etapa === 'licoes' ? e : null; });
  assert.equal(preparo.tentativas, 1);
  assert.equal(preparo.limiteMs, pedidos.LIMITE_DO_LOTE_MS);
  assert.ok(preparo.consultarEmMs >= 1500 && preparo.consultarEmMs <= 10_000);
  await esperarAte(() => provedor.licoes === LICOES);

  // Quantas consultas vierem, nada novo no provedor, nada novo no banco, e o estado segue em preparo.
  const antes = { ...provedor };
  for (let i = 0; i < 25; i += 1) assert.equal((await servico.consultarCriacao(conta.id, id)).estado, 'em_preparo');
  assert.deepEqual({ t: provedor.triagens, l: provedor.licoes, o: provedor.outros }, { t: antes.triagens, l: antes.licoes, o: antes.outros }, 'a consulta nunca chama a IA');
  assert.equal(await planosDe(conta.id), 0, 'nem salva trilha');

  abrir();
  const plano = await aceite;
  const pronto = await servico.consultarCriacao(conta.id, id);
  assert.equal(pronto.estado, 'pronto');
  assert.equal(pronto.tentativas, 1);
  assert.equal(pronto.plano.id, id, 'o id do pedido é o id da trilha');
  assert.deepEqual(pronto.plano.fluxos.map((f) => f.licoes.length), [2, 1]);
  assert.equal(plano.id, id);
  assert.equal(typeof pronto.duracaoMs, 'number');
  assert.equal(provedor.licoes, LICOES, 'uma geração só: uma chamada por lição');
  assert.equal(provedor.triagens, 2, 'a triagem do pedido e a revisão das lições, uma vez cada');
  assert.equal(await quotaGasta(conta.id), 1);
});

test('a resposta se perde: o cliente desiste do POST, o servidor termina e salva, e a consulta devolve a trilha (uma só)', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const abrir = fechar();
  void servico.aceitarProposta(conta.id, token).catch(() => undefined); // ninguém espera esta resposta
  await esperarAte(() => provedor.licoes === LICOES);
  assert.equal((await servico.consultarCriacao(conta.id, id)).estado, 'em_preparo');
  abrir();
  const pronto = await esperarAte(async () => { const e = await servico.consultarCriacao(conta.id, id); return e.estado === 'pronto' ? e : null; });
  assert.equal(pronto.plano.id, id);
  assert.equal(await planosDe(conta.id), 1);
  assert.equal(provedor.licoes, LICOES);
});

test('dois envios iguais ao mesmo tempo, na mesma instância, geram uma vez e devolvem o mesmo plano', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const abrir = fechar();
  const a = servico.aceitarProposta(conta.id, token);
  const b = servico.aceitarProposta(conta.id, token);
  await esperarAte(() => provedor.licoes === LICOES);
  abrir();
  const [um, dois] = await Promise.all([a, b]);
  assert.equal(um.id, id);
  assert.equal(dois.id, id);
  assert.equal(provedor.licoes, LICOES);
  assert.equal(await planosDe(conta.id), 1);
  assert.equal((await servico.consultarCriacao(conta.id, id)).tentativas, 1);
  assert.equal(await quotaGasta(conta.id), 1, 'o segundo envio não gasta o limite de novas trilhas');
});

test('duas INSTÂNCIAS com o mesmo pedido: uma gera, a outra entra no lote e devolve o mesmo plano; nada de lote dobrado nem de limite gasto duas vezes', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const abrir = fechar();
  const primeira = servico.aceitarProposta(conta.id, token);
  await esperarAte(() => provedor.licoes === LICOES);
  const segunda = outraInstancia.aceitarProposta(conta.id, token); // outro módulo, outro mapa em memória: só o banco as une
  await new Promise((resolver) => setTimeout(resolver, 400));
  assert.equal(provedor.licoes, LICOES, 'a segunda instância não começou outro lote');
  abrir();
  const [um, dois] = await Promise.all([primeira, segunda]);
  assert.equal(um.id, id);
  assert.equal(dois.id, id);
  assert.equal(provedor.licoes, LICOES);
  assert.equal(provedor.triagens, 2);
  assert.equal(await planosDe(conta.id), 1);
  assert.equal((await servico.consultarCriacao(conta.id, id)).tentativas, 1);
  assert.equal(await quotaGasta(conta.id), 1);
});

test('reenviar depois de a trilha já estar salva devolve a mesma trilha, sem gerar de novo (propostas e pedidos repetidos não duplicam)', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  await servico.aceitarProposta(conta.id, token);
  const antes = provedor.licoes;
  const outra = await servico.aceitarProposta(conta.id, token);
  assert.equal(outra.id, id);
  assert.equal(provedor.licoes, antes);
  assert.equal(await planosDe(conta.id), 1);
});

test('consultar um pedido que o servidor nunca viu não cria nada: "não recebido", sem registro, sem IA', async () => {
  const conta = await novaConta();
  const antes = { ...provedor };
  for (let i = 0; i < 10; i += 1) assert.deepEqual(await servico.consultarCriacao(conta.id, randomUUID()).then((e) => e.estado), 'nao_recebido');
  assert.equal(await banco.pedidoCriacao.count({ where: { usuarioId: conta.id } }), 0);
  assert.deepEqual({ t: provedor.triagens, l: provedor.licoes }, { t: antes.triagens, l: antes.licoes });
  assert.equal((await rejeicao(servico.consultarCriacao(conta.id, '../planos'))).codigo, 'invalido', 'só UUID entra');
});

test('autorização: o pedido é da conta; outra conta recebe "não recebido" e não consegue aceitar o token alheio; sem sessão, 401; id fora do formato, 400', async () => {
  const dona = await novaConta();
  const intrusa = await novaConta();
  const { id, token } = novaProposta(dona.id);
  await servico.aceitarProposta(dona.id, token);

  const daDona = await pelaRota(dona, id);
  assert.equal(daDona.status, 200);
  assert.equal(daDona.headers.get('cache-control'), 'no-store');
  assert.equal((await daDona.json()).estado, 'pronto');
  const daIntrusa = await pelaRota(intrusa, id);
  assert.equal(daIntrusa.status, 200);
  assert.deepEqual(await daIntrusa.json(), { estado: 'nao_recebido', pedidoId: id }, 'nada da outra conta vaza, nem que o pedido existe');
  assert.equal((await rejeicao(servico.aceitarProposta(intrusa.id, token))).codigo, 'nao_encontrado');
  assert.equal(await planosDe(intrusa.id), 0);

  const semSessao = await rotaPedido.GET(new Request(`http://localhost:3197/api/aprendizado/pedidos/${id}`), { params: Promise.resolve({ pedidoId: id }) });
  assert.equal(semSessao.status, 401);
  const invalido = await pelaRota(dona, 'nao-e-um-uuid');
  assert.equal(invalido.status, 400);
  assert.equal((await invalido.json()).codigo, 'invalido');
});

test('o aceite legado (POST /api/aprendizado/planos só com o token) continua devolvendo o PlanoDetalhe; o id do pedido não é exigido', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const resposta = await rotaPlanos.POST(new Request('http://localhost:3197/api/aprendizado/planos', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: process.env.STUDOO_ORIGEM, cookie: conta.cookie }, body: JSON.stringify({ token }),
  }));
  assert.equal(resposta.status, 200);
  const plano = await resposta.json();
  assert.equal(plano.id, id);
  assert.ok(Array.isArray(plano.fluxos) && plano.progresso.total === LICOES);
  assert.equal('estado' in plano, false, 'a resposta do POST não mudou de forma');
});

test('trilha criada antes desta versão (sem registro de pedido): a consulta devolve "pronto", e o POST antigo devolve a mesma trilha sem gerar', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  await banco.$transaction([
    banco.planoAprendizado.create({ data: { usuarioId: conta.id, id, titulo: 'Antiga', objetivo: 'Criada pelo servidor anterior.', origem: 'Conteúdo gerado pelo Studoo' } }),
    banco.fluxo.createMany({ data: [{ usuarioId: conta.id, id: `${id}-1`, planoId: id, titulo: 'Parte', ordem: 1 }] }),
    banco.licao.createMany({ data: [{ usuarioId: conta.id, id: `${id}-1-1`, fluxoId: `${id}-1`, titulo: 'Lição', ordem: 1, conteudo: licaoDeEscolha }] }),
  ]);
  const consulta = await servico.consultarCriacao(conta.id, id);
  assert.equal(consulta.estado, 'pronto');
  assert.equal('tentativas' in consulta, false, 'sem registro, sem número de tentativas inventado');
  assert.equal((await servico.aceitarProposta(conta.id, token)).id, id);
  assert.equal(provedor.licoes + provedor.triagens, 0);
});

test('o dono do lote para (reinício ou queda): a CONSULTA vira falha "interrompida" sem chamar a IA nem começar lote; só o envio explícito começa outro (tentativas 2)', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const agora = Date.now();
  await banco.pedidoCriacao.create({
    data: { usuarioId: conta.id, id, estado: 'em_preparo', etapa: 'licoes', tentativas: 1, iniciadoEm: new Date(agora - 90_000), atualizadoEm: new Date(agora - 60_000),
      validoAte: new Date(agora - 15_000), propostaExpiraEm: new Date(agora + 20 * 60_000) },
  });
  const falha = await servico.consultarCriacao(conta.id, id);
  assert.equal(falha.estado, 'falha');
  assert.equal(falha.causa, 'interrompida');
  assert.equal(falha.repetivel, true);
  assert.equal(falha.tentativas, 1);
  assert.equal(provedor.triagens + provedor.licoes, 0, 'a consulta não gera');
  assert.equal((await servico.consultarCriacao(conta.id, id)).estado, 'falha', 'e continua falha nas próximas, sem recomeçar');
  assert.equal(await planosDe(conta.id), 0);

  const plano = await servico.aceitarProposta(conta.id, token); // o envio explícito, pelo mesmo token
  assert.equal(plano.id, id);
  const pronto = await servico.consultarCriacao(conta.id, id);
  assert.equal(pronto.estado, 'pronto');
  assert.equal(pronto.tentativas, 2);
  assert.equal(provedor.licoes, LICOES);
});

test('um lote que passou do teto sem terminar vira falha "tempo" na consulta, mesmo com o dono renovando', async () => {
  const conta = await novaConta();
  const { id } = novaProposta(conta.id);
  const agora = Date.now();
  await banco.pedidoCriacao.create({
    data: { usuarioId: conta.id, id, estado: 'em_preparo', tentativas: 1, iniciadoEm: new Date(agora - pedidos.LIMITE_DO_LOTE_MS - 5_000), atualizadoEm: new Date(agora), validoAte: new Date(agora + 30_000),
      propostaExpiraEm: new Date(agora + 20 * 60_000) },
  });
  const falha = await servico.consultarCriacao(conta.id, id);
  assert.equal(falha.estado, 'falha');
  assert.equal(falha.causa, 'tempo');
  assert.equal(falha.codigo, 'ia_indisponivel');
});

test('o dono vivo renova o prazo: um lote mais longo que a validade continua "em preparo" para quem consulta (nunca é tomado de quem trabalha)', async () => {
  pedidos.configurarTemposDoPedido({ validadeMs: 500, renovarMs: 100, entranteMs: 100 });
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const abrir = fechar();
  const aceite = servico.aceitarProposta(conta.id, token);
  await esperarAte(() => provedor.licoes === LICOES);
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolver) => setTimeout(resolver, 300));
    assert.equal((await servico.consultarCriacao(conta.id, id)).estado, 'em_preparo', 'passou da validade, mas o dono renovou');
  }
  abrir();
  await aceite;
  assert.equal((await servico.consultarCriacao(conta.id, id)).tentativas, 1);
  assert.equal(provedor.licoes, LICOES);
});

test('falha confirmada pela IA: a causa é "resposta_ia", repetível; o envio explícito seguinte refaz o lote (tentativas 2) e termina pronto', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  provedor.modoLicao = 'erro500';
  const erro = await rejeicao(servico.aceitarProposta(conta.id, token));
  assert.equal(erro.codigo, 'ia_indisponivel');
  const falha = await servico.consultarCriacao(conta.id, id);
  assert.deepEqual({ estado: falha.estado, causa: falha.causa, codigo: falha.codigo, repetivel: falha.repetivel, tentativas: falha.tentativas }, { estado: 'falha', causa: 'resposta_ia', codigo: 'ia_indisponivel', repetivel: true, tentativas: 1 });
  assert.equal('aguardarSegundos' in falha, false, 'sem prazo inventado');
  assert.equal(await planosDe(conta.id), 0, 'falha não salva trilha pela metade');

  provedor.modoLicao = 'normal';
  const plano = await servico.aceitarProposta(conta.id, token);
  assert.equal(plano.id, id);
  const pronto = await servico.consultarCriacao(conta.id, id);
  assert.deepEqual({ estado: pronto.estado, tentativas: pronto.tentativas }, { estado: 'pronto', tentativas: 2 });
  assert.equal(await planosDe(conta.id), 1);
});

test('limite do provedor com Retry-After real: a falha guarda o prazo RESTANTE (cai a cada consulta, não reinicia), não deixa repetir antes e volta a ser repetível depois', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  provedor.modoLicao = 'limite429';
  provedor.retryAfter = '120';
  const erro = await rejeicao(servico.aceitarProposta(conta.id, token));
  assert.equal(erro.codigo, 'ia_indisponivel');
  const primeira = await servico.consultarCriacao(conta.id, id);
  assert.equal(primeira.estado, 'falha');
  assert.equal(primeira.causa, 'limite');
  assert.equal(primeira.repetivel, false, 'enquanto o prazo conhecido não passa, repetir só bateria no limite de novo');
  assert.ok(primeira.aguardarSegundos > 100 && primeira.aguardarSegundos <= 120, `prazo do provedor: ${primeira.aguardarSegundos}`);
  await new Promise((resolver) => setTimeout(resolver, 1200));
  const segunda = await servico.consultarCriacao(conta.id, id);
  assert.ok(segunda.aguardarSegundos < primeira.aguardarSegundos, `o prazo restante cai (${primeira.aguardarSegundos} → ${segunda.aguardarSegundos}) em vez de voltar cheio`);

  const chamadas = provedor.licoes;
  provedor.modoLicao = 'normal';
  assert.equal((await rejeicao(servico.aceitarProposta(conta.id, token))).codigo, 'ia_indisponivel', 'o envio antes do prazo devolve a mesma falha');
  assert.equal(provedor.licoes, chamadas, '...sem bater no provedor de novo');
  assert.equal((await servico.consultarCriacao(conta.id, id)).tentativas, 1, 'e sem começar outro lote');

  await banco.pedidoCriacao.update({ where: { usuarioId_id: { usuarioId: conta.id, id } }, data: { aguardarAte: new Date(Date.now() - 1000) } });
  const liberada = await servico.consultarCriacao(conta.id, id);
  assert.equal(liberada.repetivel, true);
  assert.equal('aguardarSegundos' in liberada, false, 'passado o prazo, nenhuma espera é prometida');
  assert.equal(liberada.tentativas, 1, 'terminar a espera e consultar não começa outra geração...');
  assert.equal(provedor.licoes, chamadas, '...nem chama o provedor');
  assert.equal((await servico.aceitarProposta(conta.id, token)).id, id);
  assert.equal((await servico.consultarCriacao(conta.id, id)).tentativas, 2);
});

test('limite do provedor sem Retry-After: "limite" sem prazo (o servidor não inventa), e repetível', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  provedor.modoLicao = 'limite429';
  provedor.retryAfter = '';
  await rejeicao(servico.aceitarProposta(conta.id, token));
  const falha = await servico.consultarCriacao(conta.id, id);
  assert.equal(falha.causa, 'limite');
  assert.equal(falha.repetivel, true);
  assert.equal('aguardarSegundos' in falha, false);
});

test('a recusa da triagem de segurança não se repete com o mesmo token: a mesma falha volta sem chamar a IA de novo, e a consulta diz "seguranca", não repetível', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  provedor.decisao = 'recusar';
  assert.equal((await rejeicao(servico.aceitarProposta(conta.id, token))).codigo, 'conteudo_nocivo');
  const falha = await servico.consultarCriacao(conta.id, id);
  assert.deepEqual({ causa: falha.causa, codigo: falha.codigo, repetivel: falha.repetivel }, { causa: 'seguranca', codigo: 'conteudo_nocivo', repetivel: false });
  const triagens = provedor.triagens;
  provedor.decisao = 'permitir'; // nem que o modelo mude de ideia: insistir no mesmo token não é caminho
  assert.equal((await rejeicao(servico.aceitarProposta(conta.id, token))).codigo, 'conteudo_nocivo');
  assert.equal(provedor.triagens, triagens);
  assert.equal(provedor.licoes, 0);
  assert.equal(await planosDe(conta.id), 0);
});

test('proposta vencida: uma falha antiga passa a "proposta_expirada" (montar de novo), e o envio com o token vencido é recusado', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  await banco.pedidoCriacao.create({
    data: { usuarioId: conta.id, id, estado: 'falha', tentativas: 1, codigo: 'ia_indisponivel', causa: 'resposta_ia', concluidoEm: new Date(), propostaExpiraEm: new Date(Date.now() - 1000) },
  });
  const falha = await servico.consultarCriacao(conta.id, id);
  assert.deepEqual({ causa: falha.causa, codigo: falha.codigo, repetivel: falha.repetivel }, { causa: 'proposta_expirada', codigo: 'proposta_invalida', repetivel: false });
  const vencida = novaProposta(conta.id, { validaPorMs: -1000 });
  assert.equal((await rejeicao(servico.aceitarProposta(conta.id, vencida.token))).codigo, 'proposta_invalida');
  void token;
});

test('apagar a trilha leva o pedido junto: depois, a consulta diz "não recebido"', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  await servico.aceitarProposta(conta.id, token);
  await servico.apagarPlano(conta.id, id);
  assert.equal(await banco.pedidoCriacao.count({ where: { usuarioId: conta.id, id } }), 0);
  assert.equal((await servico.consultarCriacao(conta.id, id)).estado, 'nao_recebido');
});

test('o registro e o log têm etapa, resultado e duração correlacionados pelo começo do id, sem conta, token, tema nem conteúdo', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const linhas = [];
  const info = console.info;
  const erro = console.error;
  console.info = (...partes) => { linhas.push(partes.join(' ')); };
  console.error = (...partes) => { linhas.push(partes.join(' ')); };
  try {
    await servico.aceitarProposta(conta.id, token);
  } finally {
    console.info = info;
    console.error = erro;
  }
  const meus = linhas.filter((linha) => linha.includes('"criacao-trilha"')).map((linha) => JSON.parse(linha));
  assert.ok(meus.length >= 6, 'lote, quatro etapas e resultado');
  assert.ok(meus.every((linha) => linha.pedido === id.slice(0, 8)), 'todos correlacionados pelo mesmo começo de id');
  assert.deepEqual(meus.filter((linha) => linha.evento === 'etapa').map((linha) => linha.etapa), ['triagem', 'licoes', 'revisao', 'gravacao']);
  const resultado = meus.find((linha) => linha.evento === 'resultado');
  assert.equal(resultado.resultado, 'pronto');
  assert.equal(typeof resultado.duracaoMs, 'number');
  assert.equal(resultado.tentativa, 1);
  const tudo = linhas.join('\n');
  for (const segredo of [conta.id, token, token.slice(0, 30), 'Python', 'programadores', 'Aprender Python', id]) assert.ok(!tudo.includes(segredo), `o log não leva: ${segredo.slice(0, 12)}…`);
  const registro = await banco.pedidoCriacao.findUnique({ where: { usuarioId_id: { usuarioId: conta.id, id } } });
  assert.deepEqual(Object.keys(registro).sort(), ['aguardarAte', 'atualizadoEm', 'causa', 'codigo', 'concluidoEm', 'duracaoMs', 'estado', 'etapa', 'id', 'iniciadoEm', 'motivo', 'propostaExpiraEm', 'tentativas', 'usuarioId', 'validoAte'].sort());
  assert.ok(!JSON.stringify(registro).includes('Python'), 'o registro não guarda tema nem conteúdo');
});

// Os dois lotes seguram as lições em portões separados: as três primeiras chamadas são do lote antigo, as três seguintes do que assumiu.
function doisLotes() {
  let abrirAntigo; let abrirNovo;
  const antigo = new Promise((resolver) => { abrirAntigo = resolver; });
  const novo = new Promise((resolver) => { abrirNovo = resolver; });
  provedor.portaDaChamada = (n) => (n <= LICOES ? antigo : novo);
  return { abrirAntigo, abrirNovo };
}
async function lotePerdido(conta, id, token) {
  const { abrirAntigo, abrirNovo } = doisLotes();
  const antigo = servico.aceitarProposta(conta.id, token).then((plano) => ({ plano }), (erro) => ({ erro }));
  await esperarAte(() => provedor.licoes === LICOES);
  // O dono do primeiro lote para (queda do processo): o prazo dele vence, e o envio explícito, de OUTRA instância, assume o pedido.
  await banco.pedidoCriacao.update({ where: { usuarioId_id: { usuarioId: conta.id, id } }, data: { validoAte: new Date(Date.now() - 1000) } });
  const novo = outraInstancia.aceitarProposta(conta.id, token).then((plano) => ({ plano }), (erro) => ({ erro }));
  await esperarAte(() => provedor.licoes === LICOES * 2);
  assert.equal((await banco.pedidoCriacao.findUnique({ where: { usuarioId_id: { usuarioId: conta.id, id } } })).tentativas, 2);
  return { abrirAntigo, abrirNovo, antigo, novo };
}

test('o trabalhador ANTIGO termina depois de outro lote assumir e o novo já ter gravado: o antigo não grava nada e devolve a trilha do novo (uma trilha, lições sem duplicar)', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const { abrirAntigo, abrirNovo, antigo, novo } = await lotePerdido(conta, id, token);
  abrirNovo();
  assert.equal((await novo).plano.id, id);
  abrirAntigo();
  const doAntigo = await antigo;
  assert.equal(doAntigo.plano?.id, id, 'o lote antigo, que perdeu a vez, devolve a trilha que já existe');
  assert.equal(await planosDe(conta.id), 1);
  assert.equal(await banco.licao.count({ where: { usuarioId: conta.id } }), LICOES, 'nenhuma lição duplicada');
  const pronto = await servico.consultarCriacao(conta.id, id);
  assert.deepEqual({ estado: pronto.estado, tentativas: pronto.tentativas }, { estado: 'pronto', tentativas: 2 });
  assert.equal(await quotaGasta(conta.id), 2, 'um limite gasto por lote começado, nenhum por consulta');
});

test('o trabalhador ANTIGO termina ANTES de o novo gravar: ele perdeu a vez, não publica a trilha (a transação não escreve) e o lote novo grava a única trilha', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const { abrirAntigo, abrirNovo, antigo, novo } = await lotePerdido(conta, id, token);
  abrirAntigo();
  const doAntigo = await antigo;
  assert.equal(doAntigo.plano, undefined, 'sem trilha para devolver, o lote antigo falha');
  assert.equal(doAntigo.erro.codigo, 'ia_indisponivel');
  assert.equal(await planosDe(conta.id), 0, 'e não gravou nada');
  assert.equal(await banco.licao.count({ where: { usuarioId: conta.id } }), 0);
  assert.equal((await servico.consultarCriacao(conta.id, id)).estado, 'em_preparo', 'o pedido segue com o lote novo');
  abrirNovo();
  assert.equal((await novo).plano.id, id);
  assert.equal(await planosDe(conta.id), 1);
  assert.equal(await banco.licao.count({ where: { usuarioId: conta.id } }), LICOES);
  assert.equal((await servico.consultarCriacao(conta.id, id)).tentativas, 2);
});

test('a CONSULTA só lê: não apaga, não vira, não grava (o abandono é calculado na hora; o registro "pronto" sem trilha não é apagado por ela)', async () => {
  const conta = await novaConta();
  const parado = randomUUID();
  const agora = Date.now();
  const base = { usuarioId: conta.id, tentativas: 1, propostaExpiraEm: new Date(agora + 20 * 60_000) };
  await banco.pedidoCriacao.create({ data: { ...base, id: parado, estado: 'em_preparo', etapa: 'licoes', iniciadoEm: new Date(agora - 90_000), validoAte: new Date(agora - 20_000) } });
  const sobra = randomUUID();
  await banco.pedidoCriacao.create({ data: { ...base, id: sobra, estado: 'pronto', concluidoEm: new Date() } });
  const antes = await banco.pedidoCriacao.findMany({ where: { usuarioId: conta.id }, orderBy: { id: 'asc' } });

  assert.equal((await servico.consultarCriacao(conta.id, parado)).causa, 'interrompida');
  assert.equal((await servico.consultarCriacao(conta.id, sobra)).estado, 'nao_recebido');
  assert.equal((await servico.consultarCriacao(conta.id, parado)).causa, 'interrompida');
  const depois = await banco.pedidoCriacao.findMany({ where: { usuarioId: conta.id }, orderBy: { id: 'asc' } });
  assert.deepEqual(depois, antes, 'nenhuma linha mudou nem sumiu por causa de consultas');
  assert.equal(provedor.triagens + provedor.licoes, 0);
});

test('a conclusão ENTRE as duas leituras da consulta não vira "não recebido": o registro é lido antes do plano, e o plano que apareceu manda', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const abrir = fechar();
  const aceite = servico.aceitarProposta(conta.id, token);
  await esperarAte(() => provedor.licoes === LICOES);
  let leituraDoPlano = 0;
  const estado = await pedidos.consultarPedido(conta.id, id, async (conta_, id_) => {
    leituraDoPlano += 1;
    // Entre a leitura do registro (em preparo) e a do plano, o aceite termina e grava tudo.
    abrir();
    await aceite;
    return servico.buscarPlano(conta_, id_);
  });
  assert.equal(leituraDoPlano, 1);
  assert.equal(estado.estado, 'pronto', 'não "não recebido"');
  assert.equal(estado.plano.id, id);
  assert.equal(await banco.pedidoCriacao.count({ where: { usuarioId: conta.id, id, estado: 'pronto' } }), 1, 'e o registro continua lá');
});

test('uma leitura do plano que ainda não o viu (visão velha) depois de o aceite gravar: a consulta não apaga o registro nem diz "não recebido"; a seguinte já vê a trilha', async () => {
  const conta = await novaConta();
  const { id, token } = novaProposta(conta.id);
  const abrir = fechar();
  const aceite = servico.aceitarProposta(conta.id, token);
  await esperarAte(() => provedor.licoes === LICOES);
  const estado = await pedidos.consultarPedido(conta.id, id, async () => { abrir(); await aceite; return null; });
  assert.notEqual(estado.estado, 'nao_recebido');
  assert.equal(await banco.pedidoCriacao.count({ where: { usuarioId: conta.id, id, estado: 'pronto' } }), 1);
  assert.equal((await servico.consultarCriacao(conta.id, id)).estado, 'pronto');
});

test('o envio que assume um lote parado confere o prazo NA HORA da troca: uma renovação que chegou depois da leitura vale, e o lote não é tomado', async () => {
  const conta = await novaConta();
  const { id } = novaProposta(conta.id);
  const agora = Date.now();
  await banco.pedidoCriacao.create({
    data: { usuarioId: conta.id, id, estado: 'em_preparo', etapa: 'licoes', tentativas: 1, iniciadoEm: new Date(agora - 30_000), validoAte: new Date(agora - 2_000), propostaExpiraEm: new Date(agora + 600_000) },
  });
  const expira = new Date(agora + 600_000);
  const renovou = await pedidos.registrarPedido(conta.id, id, expira, { aposLer: async () => { assert.equal(await pedidos.avancarEtapa(conta.id, id, 1, 'revisao'), true); } });
  assert.deepEqual(renovou, { acao: 'aguardar' }, 'o dono renovou entre a leitura e a troca: o lote continua dele');
  assert.equal((await banco.pedidoCriacao.findUnique({ where: { usuarioId_id: { usuarioId: conta.id, id } } })).tentativas, 1);

  await banco.pedidoCriacao.update({ where: { usuarioId_id: { usuarioId: conta.id, id } }, data: { validoAte: new Date(Date.now() - 1000) } });
  assert.deepEqual(await pedidos.registrarPedido(conta.id, id, expira), { acao: 'iniciar', tentativa: 2, origem: 'assumido' });
  assert.equal(await pedidos.avancarEtapa(conta.id, id, 1, 'gravacao'), false, 'e o dono antigo já não renova nada');
});

test('GET /api/sessao devolve a "conta" opaca: estável, diferente por conta e que não é o id', async () => {
  const a = await novaConta();
  const b = await novaConta();
  const ler = async (conta) => (await rotaSessao.GET(new Request('http://localhost:3197/api/sessao', { headers: { cookie: conta.cookie } }))).json();
  const [a1, a2, b1] = [await ler(a), await ler(a), await ler(b)];
  assert.ok(typeof a1.conta === 'string' && a1.conta.length >= 16);
  assert.equal(a1.conta, a2.conta);
  assert.notEqual(a1.conta, b1.conta);
  assert.ok(!a1.conta.includes(a.id));
  assert.equal(a1.autenticado, true);
});
