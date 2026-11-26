// A retomada da criação na web (spec 04, Retomada da criação): o controlador sem tela, com cliente, armazenamento e relógio de mentira. O que vale aqui: o pedido é guardado ANTES
// de enviar; a resposta perdida não vira erro (o servidor é consultado, sem IA); "não recebido" logo depois do envio é corrida; consulta que não falou com o servidor é desconhecida,
// nunca ausência; "pronto" vence qualquer resposta antiga; A e B por identidade na mesma conta; e outra conta no mesmo aparelho não vê nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroStudoo, chaveDaCriacaoPendente, lerCriacoesPendentes } from '@studoo/contratos';
import { criarControladorDeCriacoes } from '../src/app/criacao-retomada.ts';

const A = '3f1c2b4a-8d7e-4a60-9b1f-0c2d3e4f5a6b';
const B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const plano = (id) => ({ id, titulo: 'Python', progresso: { concluidas: 0, total: 3, percentual: 0 }, objetivo: 'x', origem: 'Conteúdo gerado pelo Studoo', fluxos: [] });
const proposta = (id, extra = {}) => ({
  token: `corpo-${id.slice(0, 4)}.assinatura`, pedidoId: id, validaPorMs: 1_800_000, titulo: `Trilha ${id.slice(0, 4)}`, objetivo: 'Aprender Python rápido.', origem: 'Conteúdo gerado pelo Studoo',
  fluxos: [{ titulo: 'Base', licoes: [{ titulo: 'Tipos' }, { titulo: 'Coleções', resumo: 'Listas e mapas.' }] }, { titulo: 'Prática', licoes: [{ titulo: 'Projeto' }] }], ...extra,
});
const emPreparo = (id, tentativas = 1, consultarEmMs = 2000) => ({ estado: 'em_preparo', pedidoId: id, tentativas, etapa: 'licoes', decorridoMs: 5000, limiteMs: 300000, consultarEmMs });
const pronto = (id) => ({ estado: 'pronto', pedidoId: id, tentativas: 1, plano: plano(id) });
const nao = (id) => ({ estado: 'nao_recebido', pedidoId: id });
const falha = (id, extra = {}) => ({ estado: 'falha', pedidoId: id, tentativas: 1, codigo: 'ia_indisponivel', causa: 'resposta_ia', repetivel: true, ...extra });
const rede = () => { throw new TypeError('fetch failed'); };

function armazenamentoDeMemoria() {
  const dados = new Map();
  return { dados, getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => { dados.set(k, v); }, removeItem: (k) => { dados.delete(k); } };
}
const imediato = () => new Promise((resolver) => setImmediate(resolver));
async function ate(condicao, voltas = 400) {
  for (let i = 0; i < voltas; i += 1) { if (await condicao()) return; await imediato(); }
  throw new Error('A condição não se cumpriu.');
}

// `envio(token, n)` e `consulta(id, n)` são scripts: um valor, uma função ou uma lista (a última se repete). Uma função que lança vira rejeição.
function montar({ envio = () => new Promise(() => undefined), consulta = [], conta = 'conta-a', armazenamento = armazenamentoDeMemoria(), online = () => true, extra = {} } = {}) {
  const relogio = { t: 1_000_000 };
  const chamadas = { envios: [], consultas: [] };
  const fases = [];
  const eventos = { prontas: [], recusadas: 0, sessao: 0 };
  const passo = (script, n) => { const v = Array.isArray(script) ? script[Math.min(n, script.length - 1)] : script; return typeof v === 'function' ? v(n) : v; };
  const controlador = criarControladorDeCriacoes({
    conta, armazenamento, estaOnline: online,
    agora: () => relogio.t,
    dormir: async (ms, sinal) => { if (sinal.aborted) return; relogio.t += ms; await imediato(); },
    carenciaDaConsultaMs: 8_000, tempoDaConsultaMs: 1_000_000,
    cliente: {
      aceitarProposta: async (token) => { chamadas.envios.push({ token, armazenado: armazenamento.getItem(chamadas.chave ??= chaveDaCriacaoPendente(conta)) }); return passo(envio, chamadas.envios.length - 1); },
      consultarCriacao: async (id) => { chamadas.consultas.push(id); return passo(consulta, chamadas.consultas.length - 1); },
    },
    aoMudar: (lista) => { fases.push(lista.map((c) => `${c.pendente.pedidoId.slice(0, 4)}:${c.fase}`).join(',')); eventos.ultima = lista; },
    aoPronta: (c) => eventos.prontas.push(c), aoRecusada: () => { eventos.recusadas += 1; }, aoSessaoVencida: () => { eventos.sessao += 1; },
    ...extra,
  });
  return { controlador, relogio, chamadas, fases, eventos, armazenamento };
}
const guardado = (m, conta = 'conta-a') => lerCriacoesPendentes(m.armazenamento.getItem(chaveDaCriacaoPendente(conta)));
const faseDe = (m, id) => m.eventos.ultima?.find((c) => c.pendente.pedidoId === id)?.fase;

test('o pedido é guardado ANTES de o aceite sair (com a prévia, para redesenhá-la) e some quando a trilha fica pronta; a resposta do envio é a conclusão normal', async () => {
  const m = montar({ envio: () => plano(A) });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.chamadas.envios.length, 1);
  const naHora = lerCriacoesPendentes(m.chamadas.envios[0].armazenado);
  assert.equal(naHora.length, 1, 'no instante do envio, o pedido já estava guardado');
  assert.deepEqual({ id: naHora[0].pedidoId, token: naHora[0].token, intencao: naHora[0].intencao, licoes: naHora[0].licoes, partes: naHora[0].partes }, { id: A, token: proposta(A).token, intencao: 'comecar', licoes: 3, partes: 2 });
  assert.equal(naHora[0].previa.fluxos[0].licoes[1].resumo, 'Listas e mapas.');
  assert.equal(naHora[0].token.includes('Aprender'), false);
  assert.equal(guardado(m).length, 0, 'terminou: nada fica guardado');
  assert.equal(m.eventos.prontas[0].porConsulta, false);
  assert.equal(m.eventos.prontas[0].plano.id, A);
  assert.equal(m.chamadas.consultas.length, 0, 'sem corte nenhum, ninguém precisou consultar');
});

test('a resposta do envio se perde (rede): o servidor é CONSULTADO, em preparo não vira erro, e a trilha confirmada pela consulta conclui sem reenviar nada', async () => {
  const m = montar({ envio: rede, consulta: [emPreparo(A), emPreparo(A), pronto(A)] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.chamadas.envios.length, 1, 'um envio só: a consulta não reenvia');
  assert.ok(m.chamadas.consultas.length >= 3);
  assert.equal(m.eventos.prontas[0].porConsulta, true);
  assert.ok(m.fases.some((f) => f.endsWith(':em_preparo')), 'passou por em preparo');
  assert.ok(!m.fases.some((f) => /falha|nao_chegou|sem_/.test(f)), 'sem erro prematuro');
  assert.equal(guardado(m).length, 0);
});

test('o envio fica sem resposta (a conexão morreu sem avisar): a consulta, depois da carência, descobre a trilha; o erro do envio que chegar DEPOIS não desfaz o pronto', async () => {
  let falharDepois;
  const m = montar({ envio: () => new Promise((_, rejeitar) => { falharDepois = rejeitar; }), consulta: [emPreparo(A), pronto(A)] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.eventos.prontas[0].porConsulta, true);
  const fasesAntes = m.fases.length;
  falharDepois(new ErroStudoo('ia_indisponivel'));
  falharDepois(new TypeError('fetch failed'));
  await imediato(); await imediato();
  assert.equal(faseDe(m, A), 'pronta', 'pronto é final');
  assert.equal(m.eventos.prontas.length, 1);
  assert.equal(m.fases.length, fasesAntes, 'e nada mais mudou');
});

test('sem rede: "sem conexão" só quando o aparelho sabe que está offline; com rede e sem confirmação, "ainda não conseguimos confirmar"; nenhum dos dois vira ausência, e ao confirmar conclui', async () => {
  let rededisponivel = false;
  const m = montar({ envio: rede, online: () => rededisponivel, consulta: [() => rede(), () => rede(), () => rede(), () => rede(), () => rede(), pronto(A)] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.fases.some((f) => f.endsWith(':sem_conexao')));
  rededisponivel = true;
  await ate(() => m.fases.some((f) => f.endsWith(':sem_confirmacao')));
  await ate(() => m.eventos.prontas.length === 1);
  assert.ok(!m.fases.some((f) => f.endsWith(':nao_chegou')), 'consulta sem resposta nunca é "não chegou"');
  assert.equal(m.chamadas.envios.length, 1, 'e nada é reenviado por conta própria');
});

test('"não recebido" logo depois de enviar é corrida: reconfere (o envio cortado chega depois) e a trilha sai sem reenviar; "Verificar status" consulta já', async () => {
  const m = montar({ envio: rede, consulta: [nao(A), nao(A), nao(A), emPreparo(A), pronto(A)] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.chamadas.envios.length, 1);
  assert.ok(!m.fases.some((f) => f.endsWith(':nao_chegou')));
});

test('ausência que persiste depois da janela vira "reenviar" a um toque, com a MESMA proposta e o mesmo pedidoId (uma tentativa nova no servidor, uma trilha só)', async () => {
  const m = montar({ envio: [rede, () => plano(A)], consulta: [nao(A)] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => faseDe(m, A) === 'nao_chegou');
  assert.equal(m.chamadas.envios.length, 1, 'esperou a janela inteira antes de oferecer');
  assert.equal(guardado(m).length, 1, 'o pedido segue guardado');
  const consultasAntes = m.chamadas.consultas.length;
  m.controlador.reenviar(A);
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.chamadas.envios.length, 2);
  assert.equal(m.chamadas.envios[1].token, m.chamadas.envios[0].token, 'o mesmo token');
  assert.ok(m.chamadas.consultas.length >= consultasAntes);
  assert.equal(guardado(m).length, 0);
});

test('falha confirmada pelo servidor: aparece com a causa, fica guardada para tentar de novo, e uma falha ANTIGA que ainda está lá logo depois do reenvio não vale', async () => {
  const m = montar({ envio: [() => { throw new ErroStudoo('ia_indisponivel'); }, rede], consulta: [falha(A), falha(A), falha(A), emPreparo(A, 2), pronto(A)] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => faseDe(m, A) === 'falha');
  const falhou = m.eventos.ultima[0].falha;
  assert.deepEqual({ causa: falhou.causa, repetivel: falhou.repetivel, tentativas: falhou.tentativas, codigo: falhou.codigo }, { causa: 'resposta_ia', repetivel: true, tentativas: 1, codigo: 'ia_indisponivel' });
  assert.equal('aguardarSegundos' in falhou, false);
  assert.equal(guardado(m).length, 1);
  const falhasAntes = m.fases.filter((f) => f.endsWith(':falha')).length;
  m.controlador.reenviar(A);
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.fases.filter((f) => f.endsWith(':falha')).length, falhasAntes, 'a falha da tentativa 1, ainda registrada, não reapareceu depois do reenvio');
  assert.equal(m.chamadas.envios.length, 2);
});

test('limite com prazo: a falha traz o prazo e a hora em que chegou, para a tela mostrar o que RESTA (não o prazo cheio a cada consulta)', async () => {
  const m = montar({ envio: () => { throw new ErroStudoo('ia_indisponivel'); }, consulta: [falha(A, { causa: 'limite', repetivel: false, aguardarSegundos: 90 })] });
  m.controlador.iniciar(proposta(A), 'salvar');
  await ate(() => faseDe(m, A) === 'falha');
  const f = m.eventos.ultima[0].falha;
  assert.deepEqual({ causa: f.causa, repetivel: f.repetivel, aguardarSegundos: f.aguardarSegundos }, { causa: 'limite', repetivel: false, aguardarSegundos: 90 });
  assert.equal(typeof f.recebidaEm, 'number');
  assert.equal(m.chamadas.envios.length, 1, 'e o laço que espera o prazo só consulta');
  m.controlador.parar(); // o laço do prazo seguiria consultando: o teste encerra o controlador
});

test('a triagem de segurança recusou: avisa a tela (volta ao pedido), não guarda nada e não consulta', async () => {
  const m = montar({ envio: () => { throw new ErroStudoo('conteudo_nocivo'); } });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.recusadas === 1);
  assert.equal(m.eventos.ultima[0].falha.causa, 'seguranca');
  assert.equal(guardado(m).length, 0);
  assert.equal(m.chamadas.consultas.length, 0);
});

test('proposta vencida (proposta_invalida) e aceite de IA negado: falha sem consulta e sem pedido guardado (o servidor nem registrou)', async () => {
  for (const codigo of ['proposta_invalida', 'consentimento_ia']) {
    const m = montar({ envio: () => { throw new ErroStudoo(codigo); } });
    m.controlador.iniciar(proposta(A), 'comecar');
    await ate(() => faseDe(m, A) === 'falha');
    assert.equal(guardado(m).length, 0, codigo);
    assert.equal(m.chamadas.consultas.length, 0, codigo);
  }
});

test('sessão vencida: o controlador avisa a tela, para, e guarda o pedido; na volta (mesma conta) ele é retomado e conclui; outra conta no mesmo aparelho não vê nada', async () => {
  const armazenamento = armazenamentoDeMemoria();
  const m = montar({ armazenamento, envio: () => { throw new ErroStudoo('nao_autenticado'); } });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.sessao === 1);
  assert.equal(guardado(m).length, 1);
  m.controlador.parar();

  const outra = montar({ armazenamento, conta: 'conta-b', consulta: [pronto(A)] });
  outra.controlador.retomar();
  await imediato(); await imediato();
  assert.equal(outra.chamadas.consultas.length, 0, 'a outra conta não retoma o pedido');
  assert.equal(outra.controlador.criacoes().length, 0);

  const volta = montar({ armazenamento, consulta: [pronto(A)] });
  volta.controlador.retomar();
  await ate(() => volta.eventos.prontas.length === 1);
  assert.equal(volta.chamadas.envios.length, 0, 'retomar só consulta: nunca envia sozinho');
  assert.equal(volta.eventos.prontas[0].porConsulta, true);
  assert.equal(guardado(volta).length, 0);
});

test('A e B: dois pedidos na mesma conta, cada um com a sua identidade; A conclui enquanto B segue, e fechar o aviso de um não mexe no outro', async () => {
  const m = montar({ envio: () => new Promise(() => undefined), consulta: (n) => (n === 0 ? emPreparo(A) : n === 1 ? emPreparo(B) : null) });
  // as consultas respondem por pedido: A termina, B segue em preparo
  let aPronto = false;
  const m2 = montar({ envio: () => new Promise(() => undefined), consulta: [] });
  void m; void m2;
  const armazenamento = armazenamentoDeMemoria();
  const chamadas = [];
  const relogio = { t: 5_000_000 };
  const lista = { ultima: [] };
  const c = criarControladorDeCriacoes({
    conta: 'conta-a', armazenamento, agora: () => relogio.t, dormir: async (ms, sinal) => { if (sinal.aborted) return; relogio.t += ms; await imediato(); },
    carenciaDaConsultaMs: 1_000, tempoDaConsultaMs: 1_000_000,
    cliente: {
      aceitarProposta: () => new Promise(() => undefined),
      consultarCriacao: async (id) => { chamadas.push(id); return id === A ? (aPronto ? pronto(A) : emPreparo(A)) : emPreparo(B); },
    },
    aoMudar: (l) => { lista.ultima = l; },
  });
  c.iniciar(proposta(A), 'comecar');
  c.iniciar(proposta(B), 'salvar');
  await ate(() => chamadas.includes(A) && chamadas.includes(B));
  assert.deepEqual(lerCriacoesPendentes(armazenamento.getItem(chaveDaCriacaoPendente('conta-a'))).map((p) => [p.pedidoId, p.intencao]), [[A, 'comecar'], [B, 'salvar']]);
  aPronto = true;
  await ate(() => lista.ultima.find((x) => x.pendente.pedidoId === A)?.fase === 'pronta');
  assert.equal(lista.ultima.find((x) => x.pendente.pedidoId === B).fase, 'em_preparo', 'B segue em preparo');
  assert.deepEqual(lerCriacoesPendentes(armazenamento.getItem(chaveDaCriacaoPendente('conta-a'))).map((p) => p.pedidoId), [B], 'só B continua guardado');
  c.descartar(A);
  assert.deepEqual(lista.ultima.map((x) => x.pendente.pedidoId), [B]);
  c.descartar(B);
  assert.equal(armazenamento.getItem(chaveDaCriacaoPendente('conta-a')), null);
  c.parar();
});

test('ao abrir (recarregar): só consulta; um pedido antigo ainda ausente vira "reenviar" na hora, e um cuja proposta já venceu pede para montar de novo', async () => {
  const armazenamento = armazenamentoDeMemoria();
  const m1 = montar({ armazenamento, envio: rede, consulta: [emPreparo(A)] });
  m1.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m1.chamadas.consultas.length >= 2);
  m1.controlador.parar(); // a página fechou com o pedido em curso: fica guardado
  assert.equal(guardado(m1).length, 1);

  const velho = montar({ armazenamento, consulta: [nao(A)] });
  velho.relogio.t += 60_000; // reabriu um minuto depois: a janela da corrida já passou
  velho.controlador.retomar();
  await ate(() => faseDe(velho, A) === 'nao_chegou');
  assert.equal(velho.chamadas.envios.length, 0);

  const vencido = montar({ armazenamento, consulta: [nao(A)] });
  vencido.relogio.t += 40 * 60_000; // e a proposta de 30 min venceu
  vencido.controlador.retomar();
  await ate(() => faseDe(vencido, A) === 'falha');
  assert.equal(vencido.eventos.ultima[0].falha.causa, 'proposta_expirada');
  assert.equal(guardado(vencido).length, 0);
});

test('parar() encerra os laços: nada mais é consultado nem avisado, e o que estava guardado fica para a próxima abertura', async () => {
  const m = montar({ envio: rede, consulta: [emPreparo(A)] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.chamadas.consultas.length >= 2);
  m.controlador.parar();
  const consultas = m.chamadas.consultas.length;
  const fases = m.fases.length;
  for (let i = 0; i < 20; i += 1) await imediato();
  assert.equal(m.chamadas.consultas.length, consultas);
  assert.equal(m.fases.length, fases);
  assert.equal(guardado(m).length, 1);
});

test('limite com prazo conhecido: a falha fica com o prazo RESTANTE, o laço dorme até o prazo e CONSULTA O MESMO PEDIDO (nunca envia): o servidor libera, entrega a trilha ou diz o que sobrou', async () => {
  const limite = (aguardarSegundos) => falha(A, { causa: 'limite', codigo: 'limite_geracoes', repetivel: false, aguardarSegundos });
  const liberada = falha(A, { causa: 'limite', codigo: 'limite_geracoes', repetivel: true });

  // 1) Terminada a espera, o servidor liberou: a falha vira repetível, sem prazo, e NADA foi enviado de novo; só a pessoa, ao tocar, reenvia.
  const m = montar({ envio: [() => { throw new ErroStudoo('limite_geracoes'); }, () => plano(A)], consulta: [limite(30), liberada] });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.ultima?.[0]?.falha?.repetivel === true);
  assert.equal(m.chamadas.envios.length, 1, 'terminar a espera não inicia outra geração');
  assert.equal('aguardarSegundos' in m.eventos.ultima[0].falha, false, 'liberada: nenhum prazo');
  assert.equal(m.eventos.ultima[0].falha.liberadaAposEspera, true, 'a tela sabe que o limite acabou (a frase deixa de dizer "mais tarde")');
  assert.ok(m.chamadas.consultas.length >= 2, 'consultou o mesmo pedido no fim do prazo');
  assert.ok(m.fases.filter((f) => f.endsWith(':falha')).length >= 2, 'a falha com prazo ficou na tela até o servidor liberar');
  m.controlador.reenviar(A);
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.chamadas.envios.length, 2, 'o segundo envio só saiu no toque');
  assert.equal(m.chamadas.envios[1].token, m.chamadas.envios[0].token);

  // 2) No fim do prazo a trilha já estava pronta (outro aparelho, ou o envio anterior terminou): "pronta", com "Abrir lição 1", sem enviar nada.
  const pronta = montar({ envio: () => { throw new ErroStudoo('limite_geracoes'); }, consulta: [limite(30), pronto(A)] });
  pronta.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => pronta.eventos.prontas.length === 1);
  assert.equal(pronta.chamadas.envios.length, 1);
  assert.equal(pronta.eventos.prontas[0].porConsulta, true);

  // 3) O limite continua: usa o RESTANTE que o servidor devolveu (não repete o prazo cheio), segue dormindo, o botão segue desativado (repetível falso) e ainda não envia nada.
  const esperas = [];
  const seguintes = [];
  const segue = montar({
    envio: () => { throw new ErroStudoo('limite_geracoes'); }, consulta: [limite(600), limite(120), liberada],
    extra: { dormir: async (ms, sinal) => { if (sinal.aborted) return; esperas.push(ms); segue.relogio.t += ms; await imediato(); }, aoMudar: (lista) => { seguintes.push(lista[0]?.falha ? { repetivel: lista[0].falha.repetivel, restam: lista[0].falha.aguardarSegundos } : null); } },
  });
  segue.controlador.iniciar(proposta(A), 'salvar');
  await ate(() => seguintes.at(-1)?.repetivel === true);
  assert.equal(segue.chamadas.envios.length, 1);
  assert.deepEqual(esperas.filter((ms) => ms > 100_000), [600_500, 120_500], 'dormiu o prazo que o servidor deu e, na consulta seguinte, só o que ele disse que restava');
  assert.deepEqual(seguintes.filter((f) => f && f.repetivel === false).map((f) => f.restam), [600, 120], 'em toda a espera o servidor não permitiu: a tela mostra o botão desativado');
});

test('a espera do limite: a página que reaparece (ou a rede que volta) acorda o laço, que consulta já o mesmo pedido, sem esperar o prazo, e mostra o restante devolvido; nada é enviado', async () => {
  const limite = (aguardarSegundos) => falha(A, { causa: 'limite', repetivel: false, aguardarSegundos });
  const esperas = [];
  let liberar;
  const portao = new Promise((resolver) => { liberar = resolver; });
  const m = montar({
    envio: () => { throw new ErroStudoo('limite_geracoes'); },
    consulta: [limite(900), limite(840), pronto(A)],
    extra: { dormir: async (ms, sinal) => { esperas.push(ms); if (ms > 600_000 || ms === 900_500) { await new Promise((resolver) => { sinal.addEventListener('abort', resolver, { once: true }); portao.then(resolver); }); } } },
  });
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => m.eventos.ultima?.[0]?.fase === 'falha' && m.chamadas.consultas.length === 1);
  assert.deepEqual(esperas.at(-1), 900_500, 'dorme até o prazo (+0,5 s), não menos');
  const antes = m.chamadas.consultas.length;
  m.controlador.acordar(); // a página reapareceu: o laço acorda e consulta o mesmo pedido já
  await ate(() => m.chamadas.consultas.length > antes);
  assert.equal(m.eventos.ultima[0].falha.aguardarSegundos, 840, 'o restante devolvido pelo servidor, não o prazo cheio de antes');
  assert.equal(m.eventos.ultima[0].falha.repetivel, false, 'o servidor ainda não permitiu: nada se habilita pelo relógio do aparelho');
  assert.equal(m.chamadas.envios.length, 1, 'acordar não envia');
  m.controlador.acordar(); // outra vez: o laço que dorme o resto do prazo também consulta
  liberar();
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.chamadas.envios.length, 1);
  assert.equal(m.eventos.prontas[0].porConsulta, true, '"pronto" na consulta do fim da espera: "Abrir lição 1", sem enviar nada');
});

test('limite com prazo: se a consulta do FIM do prazo perde a resposta, a dúvida (com "Verificar status") aparece NA HORA; a verificação consulta o mesmo pedido e só o servidor libera; nada é enviado sozinho', async () => {
  // 6 s, como o Retry-After real da OpenAI: a espera é curta (menos que o tempo comum até a dúvida), e mesmo assim a consulta perdida no fim dela já é dúvida.
  const limite = falha(A, { causa: 'limite', codigo: 'limite_geracoes', repetivel: false, aguardarSegundos: 6 });
  const liberada = falha(A, { causa: 'limite', codigo: 'limite_geracoes', repetivel: true });
  const duvida = (extra = {}) => {
    const m = montar({
      envio: [() => { throw new ErroStudoo('limite_geracoes'); }, () => plano(A)],
      consulta: [limite, rede, liberada],
      extra: {
        // O prazo passa no relógio de mentira; a espera DEPOIS da dúvida fica parada até alguém acordar o laço (o toque em "Verificar status").
        dormir: async (ms, sinal) => {
          if (sinal.aborted) return;
          if (/:(sem_confirmacao|sem_conexao)$/.test(m.fases.at(-1) ?? '')) { await new Promise((resolver) => { sinal.addEventListener('abort', resolver, { once: true }); }); return; }
          m.relogio.t += ms; await imediato();
        },
        ...extra,
      },
    });
    return m;
  };

  // Com rede: dúvida na primeira consulta perdida (sem esperar uma segunda nem 10 s), ainda guardando o pedido.
  const m = duvida();
  m.controlador.iniciar(proposta(A), 'comecar');
  await ate(() => faseDe(m, A) === 'sem_confirmacao');
  assert.equal(m.chamadas.consultas.length, 2, 'uma consulta com o limite e UMA perdida no fim do prazo: já é dúvida');
  assert.equal(m.chamadas.envios.length, 1, 'nada foi enviado');
  assert.equal(guardado(m).length, 1, 'o pedido segue guardado');
  assert.ok(m.fases.some((f) => f.endsWith(':falha')), 'antes da dúvida a falha com prazo estava na tela');
  m.controlador.verificar(A); // "Verificar status": consulta o mesmo pedido
  await ate(() => faseDe(m, A) === 'falha');
  const f = m.eventos.ultima[0].falha;
  assert.deepEqual([f.causa, f.repetivel, f.liberadaAposEspera, 'aguardarSegundos' in f], ['limite', true, true, false], 'o servidor liberou depois da espera: só agora o botão se habilita');
  assert.equal(m.chamadas.envios.length, 1, 'liberar não envia: a geração só começa por toque explícito');
  m.controlador.reenviar(A);
  await ate(() => m.eventos.prontas.length === 1);
  assert.equal(m.chamadas.envios.length, 2);
  assert.equal(m.chamadas.envios[1].token, m.chamadas.envios[0].token, 'o mesmo pedido, o mesmo comprovante');

  // Sem rede identificada no fim do prazo: "sem conexão" (com "Verificar status"), não "ausência".
  let conectado = false;
  const sem = duvida({ estaOnline: () => conectado });
  sem.controlador.iniciar(proposta(A), 'salvar');
  await ate(() => faseDe(sem, A) === 'sem_conexao');
  assert.equal(sem.chamadas.envios.length, 1);
  conectado = true;
  sem.controlador.acordar(); // a rede voltou: consulta já
  await ate(() => faseDe(sem, A) === 'falha');
  assert.equal(sem.eventos.ultima[0].falha.repetivel, true);
  assert.equal(sem.chamadas.envios.length, 1);
});
