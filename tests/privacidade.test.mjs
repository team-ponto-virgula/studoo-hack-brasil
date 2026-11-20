// Privacidade (revisão Apple 5.1.1(v) e 5.1.2(i)): o aceite do envio a IA de terceiros barra as rotas no servidor, e a
// exclusão da conta apaga tudo dela no ato. Não depende do que já existe no banco: só confere o que cria.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { VERSAO_CONSENTIMENTO_IA, interpretarEstadoPrivacidade, privacidadeDoErro } from '@studoo/contratos/privacidade';
import { ErroStudoo } from '@studoo/contratos';
import { GET as privacidadeGet } from '../src/app/api/privacidade/route.ts';
import { POST as aceitePost, DELETE as aceiteDelete } from '../src/app/api/privacidade/consentimento-ia/route.ts';
import { DELETE as contaDelete } from '../src/app/api/conta/route.ts';
import { POST as propostasPost } from '../src/app/api/aprendizado/propostas/route.ts';
import { POST as aoVivoPost } from '../src/app/api/aprendizado/propostas/ao-vivo/route.ts';
import { POST as planosPost } from '../src/app/api/aprendizado/planos/route.ts';
import { POST as materiaisPost } from '../src/app/api/estudio/materiais/route.ts';
import { POST as vozPost } from '../src/app/api/estudio/voz/route.ts';
import { POST as avaliarPost } from '../src/app/api/aprendizado/licoes/[id]/avaliar/route.ts';
import { GET as sessaoGet } from '../src/app/api/sessao/route.ts';
import { PUT as perfilPut } from '../src/app/api/perfil/route.ts';
import { POST as criarLinkPost } from '../src/app/api/aprendizado/planos/[id]/compartilhar/route.ts';
import { GET as linkGet, PATCH as linkPatch } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { POST as adicionarPost } from '../src/app/api/compartilhar/[codigo]/adicionar/route.ts';
import { POST as valeuPost } from '../src/app/api/compartilhar/[codigo]/valeu/route.ts';
import { POST as seguirPost } from '../src/app/api/perfis/[perfilId]/seguir/route.ts';
import { POST as denunciaPost } from '../src/app/api/denuncias/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { DOMINIO_EMAIL_VISITANTE, PREFIXO_EMAIL_VISITANTE } from '../src/servidor/acesso/visitante.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { respostaErrada } from '../src/dominio/aprendizado/plano.ts';
import { podeUsarIa } from '../src/servidor/privacidade/consentimento.ts';

const origem = process.env.STUDOO_ORIGEM || 'http://localhost:3000';
const usuarios = [];
process.env.IA = 'falsa';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
process.env.STUDOO_COMPARTILHAR = '1';
process.env.STUDOO_COMUNIDADE = '1';
// Sem chave de provedor no teste: com IA=deepseek a barreira vale igual, e a geração cai na reserva simulada.
delete process.env.DEEPSEEK_API_KEY;
delete process.env.OPENAI_API_KEY;
process.env.STUDOO_IA_RESERVA = 'falsa';

const prefixos = ['ia:geracao', 'perfil', 'foto', 'compartilhar:criar', 'compartilhar:adicionar', 'comunidade:publicar', 'comunidade:valeu', 'comunidade:seguir', 'comunidade:denunciar', 'estudio:material', 'estudio:voz'];
after(async () => {
  process.env.IA = 'falsa';
  for (const id of usuarios) {
    const existe = await banco.usuario.findUnique({ where: { id }, select: { id: true } });
    if (existe) {
      await banco.registroEstudo.deleteMany({ where: { usuarioId: id } });
      await banco.apoioLicao.deleteMany({ where: { usuarioId: id } });
      await banco.licao.deleteMany({ where: { usuarioId: id } });
      await banco.fluxo.deleteMany({ where: { usuarioId: id } });
      await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } });
      await banco.sessao.deleteMany({ where: { usuarioId: id } });
      await banco.usuario.delete({ where: { id } });
    }
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: prefixos.map((p) => assinatura(`${p}:${id}`)) } } });
  }
  await banco.tentativaLogin.deleteMany({ where: { chave: { in: ['compartilhar:global', 'comunidade:global'].map((c) => assinatura(c)) } } });
  await banco.$disconnect();
});

function pedido(caminho, { metodo = 'GET', token, corpo } = {}) {
  const headers = { origin: origem };
  if (token) headers.cookie = cookieSessao(token);
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origem}${caminho}`, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
}
const ctx = (params) => ({ params: Promise.resolve(params) });
const json = async (promessa) => {
  const r = await promessa;
  return { status: r.status, corpo: r.status === 204 ? null : await r.json(), headers: r.headers };
};

async function pessoa(nome, email = `privacidade-${randomUUID()}@example.test`) {
  const u = await banco.usuario.create({ data: { email, fuso: 'UTC' } });
  usuarios.push(u.id);
  const { token } = await criarSessao(u.id);
  if (nome) await json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token, corpo: { nome, cor: 'verde' } })));
  const perfilId = (await banco.usuario.findUnique({ where: { id: u.id }, select: { perfilId: true } })).perfilId;
  return { id: u.id, token, perfilId };
}
const visitante = () => pessoa(null, `${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${randomUUID().slice(0, 12)}${DOMINIO_EMAIL_VISITANTE}`);
const estado = async (token) => json(privacidadeGet(pedido('/api/privacidade', { token })));
const aceitar = (token, versao = VERSAO_CONSENTIMENTO_IA) => json(aceitePost(pedido('/api/privacidade/consentimento-ia', { metodo: 'POST', token, corpo: { versao } })));
const revogar = (token) => json(aceiteDelete(pedido('/api/privacidade/consentimento-ia', { metodo: 'DELETE', token })));
const propor = (token) => json(propostasPost(pedido('/api/aprendizado/propostas', { metodo: 'POST', token, corpo: { objetivo: 'Aprender frações na cozinha' } })));

test('IA simulada: nada sai do servidor, o aceite não é pedido e a geração segue', async () => {
  process.env.IA = 'falsa';
  const ana = await pessoa(null);
  const r = await estado(ana.token);
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.consentimentoIa, { necessario: false, versao: VERSAO_CONSENTIMENTO_IA, aceitoEm: null, provedores: [] });
  assert.equal(r.corpo.politica, '/privacidade');
  assert.ok(interpretarEstadoPrivacidade(r.corpo), 'a resposta segue o contrato');
  assert.equal((await propor(ana.token)).status, 200);
  assert.equal(await podeUsarIa(ana.id), true);
});

test('IA de terceiro: sem aceite, as rotas respondem 428 com o estado; aceitar libera; revogar volta a barrar', async () => {
  process.env.IA = 'deepseek';
  try {
    const bia = await pessoa(null);
    let r = await estado(bia.token);
    assert.equal(r.corpo.consentimentoIa.necessario, true);
    assert.equal(r.corpo.consentimentoIa.aceitoEm, null);
    assert.deepEqual(r.corpo.consentimentoIa.provedores.map((p) => p.id), ['deepseek'], 'sem voz ligada, só a DeepSeek');
    assert.ok(r.corpo.consentimentoIa.provedores[0].usos.length >= 3);

    // Sem aceite: 428, com o estado no corpo para a tela abrir o aceite sem outra ida ao servidor.
    r = await propor(bia.token);
    assert.equal(r.status, 428);
    assert.equal(r.corpo.codigo, 'consentimento_ia');
    assert.equal(r.corpo.privacidade.consentimentoIa.necessario, true);
    assert.ok(privacidadeDoErro(new ErroStudoo('consentimento_ia', r.corpo)), 'o cliente lê o estado do erro');
    const aoVivo = await aoVivoPost(pedido('/api/aprendizado/propostas/ao-vivo', { metodo: 'POST', token: bia.token, corpo: { objetivo: 'Aprender frações' } }));
    assert.equal(aoVivo.status, 428, 'a trilha ao vivo barra antes de abrir o NDJSON');
    for (const [rota, chamar] of [
      ['planos', () => planosPost(pedido('/api/aprendizado/planos', { metodo: 'POST', token: bia.token, corpo: { token: 'x' } }))],
      ['materiais', () => materiaisPost(pedido('/api/estudio/materiais', { metodo: 'POST', token: bia.token, corpo: { nome: 'a.pdf', tipo: 'application/pdf', base64: 'AA==' } }))],
      ['voz', () => vozPost(pedido('/api/estudio/voz', { metodo: 'POST', token: bia.token, corpo: { nome: 'a.webm', tipo: 'audio/webm', base64: 'AA==' } }))],
    ]) {
      assert.equal((await chamar()).status, 428, `${rota} barra antes de ler o corpo ou chamar o provedor`);
    }
    assert.equal(await podeUsarIa(bia.id), false);

    // Versão antiga do texto não vale.
    r = await aceitar(bia.token, '2020-01-01');
    assert.equal(r.status, 400);
    assert.equal(r.corpo.codigo, 'invalido');

    r = await aceitar(bia.token);
    assert.equal(r.status, 200);
    assert.ok(Date.parse(r.corpo.consentimentoIa.aceitoEm) > Date.now() - 60_000);
    const gravado = await banco.usuario.findUnique({ where: { id: bia.id }, select: { consentimentoIaVersao: true } });
    assert.equal(gravado.consentimentoIaVersao, VERSAO_CONSENTIMENTO_IA);
    r = await propor(bia.token);
    assert.equal(r.status, 200, 'com aceite, a geração segue');
    const plano = await json(planosPost(pedido('/api/aprendizado/planos', { metodo: 'POST', token: bia.token, corpo: { token: r.corpo.token } })));
    assert.equal(plano.status, 200, JSON.stringify(plano.corpo));

    r = await revogar(bia.token);
    assert.equal(r.status, 200);
    assert.equal(r.corpo.consentimentoIa.aceitoEm, null);
    assert.equal((await propor(bia.token)).status, 428);

    // Correção da lição tem alternativa local: segue sem a IA, sem erro.
    const licaoId = plano.corpo.fluxos[0].licoes[0].id;
    const { conteudo } = await banco.licao.findUniqueOrThrow({ where: { usuarioId_id: { usuarioId: bia.id, id: licaoId } }, select: { conteudo: true } });
    const avaliacao = await json(avaliarPost(pedido(`/api/aprendizado/licoes/${licaoId}/avaliar`, { metodo: 'POST', token: bia.token, corpo: { resposta: respostaErrada(conteudo.exercicio), indice: 0 } }), ctx({ id: licaoId })));
    assert.equal(avaliacao.status, 200, JSON.stringify(avaliacao.corpo));
    assert.equal(typeof avaliacao.corpo.correta, 'boolean');

    // Visitante também passa pelo aceite (a sessão de visitante é uma conta).
    const vis = await visitante();
    assert.equal((await propor(vis.token)).status, 428);
    assert.equal((await aceitar(vis.token)).status, 200);
    assert.equal((await propor(vis.token)).status, 200);

    // Com a voz ligada no modo misto, a OpenAI aparece só com os usos de voz.
    process.env.STUDOO_VOZ_AO_VIVO = '1';
    process.env.OPENAI_API_KEY = 'sk-teste-sem-uso';
    process.env.DEEPSEEK_API_KEY = 'sk-teste-sem-uso';
    try {
      r = await estado(bia.token);
      assert.deepEqual(r.corpo.consentimentoIa.provedores.map((p) => p.id), ['deepseek', 'openai']);
      assert.ok(r.corpo.consentimentoIa.provedores[1].usos.every((u) => /voz|grava/i.test(u)), 'nenhum texto vai à OpenAI no modo misto');
    } finally {
      delete process.env.STUDOO_VOZ_AO_VIVO;
      delete process.env.OPENAI_API_KEY;
      delete process.env.DEEPSEEK_API_KEY;
    }
  } finally {
    process.env.IA = 'falsa';
  }
});

test('excluir conta: pede a confirmação e apaga no ato a conta, as trilhas, o social e as sessões', async () => {
  process.env.IA = 'falsa';
  const ana = await pessoa('Ana');
  const bia = await pessoa('Bia');
  const segundaSessao = (await criarSessao(ana.id, 'MOBILE')).token;
  const plano = await aceitarProposta(ana.id, (await gerarProposta(ana.id, 'Aprender frações na cozinha')).token);
  const { corpo: link } = await json(criarLinkPost(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token: ana.token, corpo: {} }), ctx({ id: plano.id })));
  await json(linkPatch(pedido(`/api/compartilhar/${link.codigo}`, { metodo: 'PATCH', token: ana.token, corpo: { visibilidade: 'explorar', tema: 'matematica' } }), ctx({ codigo: link.codigo })));
  const copia = await json(adicionarPost(pedido(`/api/compartilhar/${link.codigo}/adicionar`, { metodo: 'POST', token: bia.token, corpo: {} }), ctx({ codigo: link.codigo })));
  assert.equal(copia.status, 200);
  await json(valeuPost(pedido(`/api/compartilhar/${link.codigo}/valeu`, { metodo: 'POST', token: bia.token, corpo: { ativo: true } }), ctx({ codigo: link.codigo })));
  await json(seguirPost(pedido(`/api/perfis/${ana.perfilId}/seguir`, { metodo: 'POST', token: bia.token, corpo: { ativo: true } }), ctx({ perfilId: ana.perfilId })));
  await json(seguirPost(pedido(`/api/perfis/${bia.perfilId}/seguir`, { metodo: 'POST', token: ana.token, corpo: { ativo: true } }), ctx({ perfilId: bia.perfilId })));
  await json(denunciaPost(pedido('/api/denuncias', { metodo: 'POST', token: bia.token, corpo: { alvoTipo: 'perfil', alvo: ana.perfilId, motivo: 'spam' } })));
  await banco.registroEstudo.create({ data: { usuarioId: ana.id, licaoId: plano.fluxos[0].licoes[0].id } });

  // Sem a confirmação (ou com outra palavra), nada muda.
  for (const corpo of [{}, { confirmacao: 'apagar' }]) {
    const r = await json(contaDelete(pedido('/api/conta', { metodo: 'DELETE', token: ana.token, corpo })));
    assert.equal(r.status, 400);
    assert.equal(r.corpo.codigo, 'confirmacao_invalida');
  }
  assert.ok(await banco.usuario.findUnique({ where: { id: ana.id } }));

  const r = await json(contaDelete(pedido('/api/conta', { metodo: 'DELETE', token: ana.token, corpo: { confirmacao: 'excluir ' } })));
  assert.equal(r.status, 204);
  assert.match(r.headers.get('set-cookie') ?? '', /Max-Age=0/, 'a web perde o cookie');

  assert.equal(await banco.usuario.findUnique({ where: { id: ana.id } }), null);
  for (const [tabela, contagem] of Object.entries({
    planoAprendizado: banco.planoAprendizado.count({ where: { usuarioId: ana.id } }),
    fluxo: banco.fluxo.count({ where: { usuarioId: ana.id } }),
    licao: banco.licao.count({ where: { usuarioId: ana.id } }),
    registroEstudo: banco.registroEstudo.count({ where: { usuarioId: ana.id } }),
    sessao: banco.sessao.count({ where: { usuarioId: ana.id } }),
    linkTrilha: banco.linkTrilha.count({ where: { usuarioId: ana.id } }),
    seguir: banco.seguir.count({ where: { OR: [{ seguidorId: ana.id }, { seguidoId: ana.id }] } }),
    denunciaContraElaOuDela: banco.denuncia.count({ where: { OR: [{ usuarioId: ana.id }, { alvo: ana.perfilId }] } }),
  })) {
    assert.equal(await contagem, 0, `${tabela} da conta excluída`);
  }
  // As duas sessões (web e app) caem.
  assert.equal((await sessaoGet(pedido('/api/sessao', { token: ana.token }))).status, 401);
  assert.equal(await banco.sessao.findFirst({ where: { usuarioId: ana.id } }), null);
  assert.ok(segundaSessao);
  // O link morre; a cópia de Bia continua dela, sem o nome nem o perfil de quem compartilhou.
  assert.equal((await linkGet(pedido(`/api/compartilhar/${link.codigo}`), ctx({ codigo: link.codigo }))).status, 404);
  const daBia = await banco.planoAprendizado.findMany({ where: { usuarioId: bia.id }, select: { origemNome: true, origemPerfilId: true } });
  assert.equal(daBia.length, 1);
  assert.deepEqual(daBia[0], { origemNome: null, origemPerfilId: null });
  assert.ok(await banco.usuario.findUnique({ where: { id: bia.id } }), 'a outra conta não é tocada');
});

test('excluir conta: visitante também exclui, e sem sessão é 401', async () => {
  const vis = await visitante();
  assert.equal((await json(contaDelete(pedido('/api/conta', { metodo: 'DELETE', corpo: { confirmacao: 'EXCLUIR' } })))).status, 401);
  const r = await json(contaDelete(pedido('/api/conta', { metodo: 'DELETE', token: vis.token, corpo: { confirmacao: 'EXCLUIR' } })));
  assert.equal(r.status, 204);
  assert.equal(await banco.usuario.findUnique({ where: { id: vis.id } }), null);
});
