import { publicacaoRevisada } from './fixtures/moderacao.mjs';
// Comunidade (spec 10, etapa C2): seguir, aba "Seguindo", Novidades e o ponto de extensão revisarConteudo.
// Não depende do que já existe no banco (outras suítes, conteúdo de demonstração): só confere o que cria.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { PUT as perfilPut, GET as perfilGet } from '../src/app/api/perfil/route.ts';
import { PUT as fotoPut } from '../src/app/api/perfil/foto/route.ts';
import { GET as novidadesGet } from '../src/app/api/perfil/novidades/route.ts';
import { POST as criarPost } from '../src/app/api/aprendizado/planos/[id]/compartilhar/route.ts';
import { GET as linkGet, PATCH as linkPatch } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { POST as adicionarPost } from '../src/app/api/compartilhar/[codigo]/adicionar/route.ts';
import { POST as valeuPost } from '../src/app/api/compartilhar/[codigo]/valeu/route.ts';
import { POST as seguirPost } from '../src/app/api/perfis/[perfilId]/seguir/route.ts';
import { GET as perfisGet } from '../src/app/api/perfis/[perfilId]/route.ts';
import { GET as explorarGet } from '../src/app/api/explorar/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { DOMINIO_EMAIL_VISITANTE, PREFIXO_EMAIL_VISITANTE } from '../src/servidor/acesso/visitante.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { seguir } from '../src/servidor/compartilhar/seguir.ts';
import { definirRevisor } from '../src/servidor/compartilhar/revisao.ts';

const origem = process.env.STUDOO_ORIGEM || 'http://localhost:3000';
const usuarios = [];
process.env.IA = 'falsa';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
process.env.STUDOO_COMPARTILHAR = '1';
process.env.STUDOO_COMUNIDADE = '1';

after(async () => {
  definirRevisor();
  for (const id of usuarios) {
    await banco.licao.deleteMany({ where: { usuarioId: id } });
    await banco.fluxo.deleteMany({ where: { usuarioId: id } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } });
    await banco.sessao.deleteMany({ where: { usuarioId: id } });
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: ['ia:geracao', 'perfil', 'foto', 'compartilhar:criar', 'compartilhar:adicionar', 'comunidade:publicar', 'comunidade:valeu', 'comunidade:seguir'].map((p) => assinatura(`${p}:${id}`)) } } });
    await banco.usuario.delete({ where: { id } }); // seguir, eventos e foto saem em cascata
  }
  await banco.tentativaLogin.deleteMany({ where: { chave: assinatura('compartilhar:global') } });
  await banco.$disconnect();
});

function pedido(caminho, { metodo = 'GET', token, corpo } = {}) {
  const headers = { origin: origem };
  if (token) headers.cookie = cookieSessao(token);
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origem}${caminho}`, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
}
const ctx = (params) => ({ params: Promise.resolve(params) });
const json = async (promessa) => { const r = await promessa; return { status: r.status, corpo: await r.json() }; };

async function pessoa(nome, email = `seguir-${randomUUID()}@example.test`) {
  const u = await banco.usuario.create({ data: { email, fuso: 'UTC' } });
  usuarios.push(u.id);
  const { token } = await criarSessao(u.id);
  if (nome) await json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token, corpo: { nome, cor: 'verde' } })));
  const perfilId = (await banco.usuario.findUnique({ where: { id: u.id }, select: { perfilId: true } })).perfilId;
  return { id: u.id, email, token, perfilId };
}
const visitante = () => pessoa(null, `${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${randomUUID().slice(0, 12)}${DOMINIO_EMAIL_VISITANTE}`);
async function trilha(dona, nivel = 'perfil') {
  const plano = await aceitarProposta(dona.id, (await gerarProposta(dona.id, 'Aprender frações na cozinha')).token);
  const { corpo: link } = await json(criarPost(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token: dona.token, corpo: {} }), ctx({ id: plano.id })));
  const corpo = nivel === 'explorar' ? { visibilidade: 'explorar', tema: 'matematica' } : { visibilidade: nivel };
  await json(linkPatch(pedido(`/api/compartilhar/${link.codigo}`, { metodo: 'PATCH', token: dona.token, corpo }), ctx({ codigo: link.codigo })));
  await publicacaoRevisada(dona.id, link.codigo);
  return { plano, codigo: link.codigo };
}
const seguirApi = (quem, alvo, ativo = true) => json(seguirPost(pedido(`/api/perfis/${alvo.perfilId}/seguir`, { metodo: 'POST', token: quem.token, corpo: { ativo } }), ctx({ perfilId: alvo.perfilId })));
const perfilPublico = (alvo, token) => json(perfisGet(pedido(`/api/perfis/${alvo.perfilId}`, { token }), ctx({ perfilId: alvo.perfilId })));
async function abaSeguindo(token, codigos) {
  const vistos = [];
  let cursor = null;
  let seguindoAlguem;
  for (let i = 0; i < 50; i++) {
    const r = await json(explorarGet(pedido(`/api/explorar?seguindo=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { token })));
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.emAlta, [], 'a aba Seguindo não tem Em alta');
    seguindoAlguem = r.corpo.seguindoAlguem;
    vistos.push(...r.corpo.novas.map((c) => c.codigo));
    if (!r.corpo.cursor) break;
    cursor = r.corpo.cursor;
  }
  return { vistos: vistos.filter((c) => !codigos || codigos.includes(c)), todos: vistos, seguindoAlguem };
}

test('seguir: só perfil público, ninguém segue a si, visitante não segue, contagem sem lista, ida e volta', async () => {
  const ana = await pessoa('Ana');
  const bia = await pessoa('Bia');
  // Sem trilha no perfil, o perfil não é público: não dá para seguir.
  assert.equal((await seguirApi(bia, ana)).status, 404);
  await trilha(ana, 'perfil');
  let r = await seguirApi(bia, ana);
  assert.deepEqual(r.corpo, { seguindo: true, seguidores: 1 });
  r = await seguirApi(bia, ana);
  assert.deepEqual(r.corpo, { seguindo: true, seguidores: 1 }, 'seguir de novo não duplica');
  assert.equal((await seguirApi(ana, ana)).corpo.codigo, 'seguir_invalido');
  const vis = await visitante();
  assert.equal((await seguirApi(vis, ana)).corpo.codigo, 'compartilhar_visitante');
  assert.equal((await json(seguirPost(pedido(`/api/perfis/${ana.perfilId}/seguir`, { metodo: 'POST', corpo: { ativo: true } }), ctx({ perfilId: ana.perfilId })))).status, 401);

  // O /p traz a contagem e, com sessão, o estado do botão; nunca a lista de quem segue.
  const anonimo = (await perfilPublico(ana)).corpo;
  assert.equal(anonimo.alcance.seguidores, 1);
  assert.ok(!('seguir' in anonimo));
  assert.ok(!JSON.stringify(anonimo).includes(bia.perfilId) && !JSON.stringify(anonimo).includes('Bia'), 'sem lista de seguidores');
  assert.deepEqual((await perfilPublico(ana, bia.token)).corpo.seguir, { seguindo: true, podeSeguir: true });
  assert.deepEqual((await perfilPublico(ana, ana.token)).corpo.seguir, { seguindo: false, podeSeguir: false }, 'a dona não se segue');
  assert.deepEqual((await perfilPublico(ana, vis.token)).corpo.seguir, { seguindo: false, podeSeguir: false }, 'visitante não segue');
  // A dona vê a contagem no próprio perfil.
  assert.equal((await json(perfilGet(pedido('/api/perfil', { token: ana.token })))).corpo.alcance.seguidores, 1);

  r = await seguirApi(bia, ana, false);
  assert.deepEqual(r.corpo, { seguindo: false, seguidores: 0 });
});

test('/t: o cartão "Quem compartilhou" traz o botão Seguir para quem está logado e pode seguir', async () => {
  const ana = await pessoa('Ana');
  const bia = await pessoa('Bia');
  const { codigo } = await trilha(ana, 'perfil');
  const previa = async (token) => (await json(linkGet(pedido(`/api/compartilhar/${codigo}`, { token }), ctx({ codigo })))).corpo;
  assert.ok(!('seguirDono' in (await previa())), 'sem sessão, sem estado');
  assert.deepEqual((await previa(bia.token)).seguirDono, { seguindo: false, podeSeguir: true });
  await seguirApi(bia, ana);
  assert.deepEqual((await previa(bia.token)).seguirDono, { seguindo: true, podeSeguir: true });
  assert.ok(!('seguirDono' in (await previa(ana.token))), 'a dona vê a própria trilha sem Seguir');
  // Link só com link (perfil não público): sem Seguir.
  const caio = await pessoa('Caio');
  const { codigo: soLink } = await trilha(caio, 'link');
  const r = (await json(linkGet(pedido(`/api/compartilhar/${soLink}`, { token: bia.token }), ctx({ codigo: soLink })))).corpo;
  assert.ok(!('seguirDono' in r));
});

test('aba Seguindo: só publicadas por quem a pessoa segue, mais novas primeiro, pede conta, vazio diz se segue alguém', async () => {
  const [ana, caio, duda, bia] = [await pessoa('Ana'), await pessoa('Caio'), await pessoa('Duda'), await pessoa('Bia')];
  assert.equal((await json(explorarGet(pedido('/api/explorar?seguindo=1')))).status, 401);
  let aba = await abaSeguindo(bia.token);
  assert.equal(aba.seguindoAlguem, false);
  const a1 = (await trilha(ana, 'explorar')).codigo;
  const c1 = (await trilha(caio, 'explorar')).codigo;
  const d1 = (await trilha(duda, 'explorar')).codigo; // a Bia não segue a Duda
  const a2 = (await trilha(ana, 'explorar')).codigo;
  await seguirApi(bia, ana);
  await seguirApi(bia, caio);
  aba = await abaSeguindo(bia.token);
  assert.equal(aba.seguindoAlguem, true);
  assert.deepEqual(aba.vistos.filter((c) => [a1, c1, d1, a2].includes(c)), [a2, c1, a1], 'só de quem segue, mais novas primeiro');
  assert.ok(!aba.todos.includes(d1));
  // Despublicar tira da aba.
  await json(linkPatch(pedido(`/api/compartilhar/${a2}`, { metodo: 'PATCH', token: ana.token, corpo: { visibilidade: 'perfil' } }), ctx({ codigo: a2 })));
  assert.ok(!(await abaSeguindo(bia.token)).todos.includes(a2));
});

test('Novidades: 7 dias, agrupadas por trilha; adição só conta, valeu e seguir com nome de quem tem perfil público, "alguém" para o resto', async () => {
  const ana = await pessoa('Ana');
  const { plano, codigo } = await trilha(ana, 'explorar');
  // Bia tem perfil público; Caio e Duda não (sem trilha no perfil).
  const bia = await pessoa('Bia');
  await trilha(bia, 'perfil');
  const caio = await pessoa('Caio');
  const duda = await pessoa('Duda');
  const vazio = (await json(novidadesGet(pedido('/api/perfil/novidades', { token: ana.token })))).corpo;
  assert.deepEqual(vazio.itens, []);
  for (const quem of [bia, caio, duda]) await json(adicionarPost(pedido(`/api/compartilhar/${codigo}/adicionar`, { metodo: 'POST', token: quem.token, corpo: {} }), ctx({ codigo })));
  for (const quem of [bia, caio]) await json(valeuPost(pedido(`/api/compartilhar/${codigo}/valeu`, { metodo: 'POST', token: quem.token, corpo: { ativo: true } }), ctx({ codigo })));
  for (const quem of [bia, duda]) await banco.seguir.create({ data: { seguidorId: quem.id, seguidoId: ana.id } });
  // Um evento antigo (8 dias) não entra.
  const velho = await pessoa('Velho');
  await json(adicionarPost(pedido(`/api/compartilhar/${codigo}/adicionar`, { metodo: 'POST', token: velho.token, corpo: {} }), ctx({ codigo })));
  await banco.eventoTrilha.updateMany({ where: { codigo, usuarioId: velho.id }, data: { criadoEm: new Date(Date.now() - 8 * 24 * 60 * 60_000) } });

  const { itens } = (await json(novidadesGet(pedido('/api/perfil/novidades', { token: ana.token })))).corpo;
  const adicoes = itens.find((i) => i.tipo === 'adicoes');
  assert.deepEqual([adicoes.planoId, adicoes.titulo, adicoes.quantidade], [plano.id, plano.titulo, 3], 'só a contagem, sem nomes');
  assert.ok(!('pessoas' in adicoes));
  const valeus = itens.find((i) => i.tipo === 'valeus');
  assert.deepEqual(valeus.pessoas.map((p) => p.nome), ['Bia']);
  assert.equal(valeus.outros, 1, 'Caio sem perfil público entra como "alguém"');
  const seguidores = itens.find((i) => i.tipo === 'seguidores');
  assert.deepEqual([seguidores.pessoas.map((p) => p.nome), seguidores.outros], [['Bia'], 1]);
  const texto = JSON.stringify(itens);
  for (const proibido of [bia.email, caio.email, 'Caio', 'Duda', caio.id, duda.id]) assert.ok(!texto.includes(proibido), proibido);
  // Mais recentes primeiro.
  assert.deepEqual(itens.map((i) => i.em), [...itens.map((i) => i.em)].sort().reverse());
  // Só a dona vê as próprias Novidades (rota privada).
  assert.equal((await json(novidadesGet(pedido('/api/perfil/novidades')))).status, 401);
});

test('perfil de demonstração pode ser seguido, mas não segue ninguém; limite de 60 por hora', async () => {
  const ana = await pessoa('Ana');
  await trilha(ana, 'perfil');
  const demo = await banco.usuario.create({ data: { email: `demo-seguir-${randomUUID()}@example.test`, fuso: 'UTC', perfilDemo: true, perfilNome: 'Demo', perfilCor: 'azul', perfilId: randomUUID().replace(/-/g, '').slice(0, 16) } });
  usuarios.push(demo.id);
  await assert.rejects(() => seguir(demo.id, ana.perfilId, { ativo: true }), (e) => e.codigo === 'seguir_invalido');
  const bia = await pessoa('Bia');
  for (let i = 0; i < 59; i++) await seguirApi(bia, ana, i % 2 === 0);
  const sexagesima = await seguirApi(bia, ana, true);
  assert.equal(sexagesima.status, 200);
  const excesso = await seguirApi(bia, ana, false);
  assert.equal(excesso.status, 429);
  assert.equal(excesso.corpo.codigo, 'limite_comunidade');
});

test('revisarConteudo: chamado antes de gravar nome, resumo, legenda e foto; recusado, nada é gravado', async () => {
  const ana = await pessoa('Ana');
  const chamadas = [];
  definirRevisor(async (conteudo) => { chamadas.push(conteudo.tipo); return { aprovado: true }; });
  await json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token: ana.token, corpo: { nome: 'Ana Souza', cor: 'roxo', resumo: 'Gosto de cozinhar.' } })));
  const { codigo } = await trilha(ana, 'perfil');
  await json(linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: ana.token, corpo: { visibilidade: 'explorar', tema: 'culinaria', legenda: 'Para começar.' } }), ctx({ codigo })));
  const png = (await import('sharp')).default({ create: { width: 64, height: 64, channels: 3, background: '#88aaff' } }).png().toBuffer();
  await json(fotoPut(pedido('/api/perfil/foto', { metodo: 'PUT', token: ana.token, corpo: { base64: (await png).toString('base64') } })));
  for (const tipo of ['nome', 'resumo', 'legenda', 'foto']) assert.ok(chamadas.includes(tipo), tipo);

  definirRevisor(async (conteudo) => (conteudo.tipo === 'resumo' ? { aprovado: false, motivo: 'teste' } : { aprovado: true }));
  const r = await json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token: ana.token, corpo: { nome: 'Ana Souza', cor: 'roxo', resumo: 'Outro resumo.' } })));
  assert.equal(r.status, 422);
  assert.equal(r.corpo.codigo, 'conteudo_recusado');
  assert.equal((await banco.usuario.findUnique({ where: { id: ana.id }, select: { perfilResumo: true } })).perfilResumo, 'Gosto de cozinhar.', 'nada gravado');
  definirRevisor(async (conteudo) => (conteudo.tipo === 'foto' ? { aprovado: false, motivo: 'teste' } : { aprovado: true }));
  const antes = (await banco.fotoPerfil.findUnique({ where: { usuarioId: ana.id }, select: { token: true } })).token;
  const f = await json(fotoPut(pedido('/api/perfil/foto', { metodo: 'PUT', token: ana.token, corpo: { base64: (await png).toString('base64') } })));
  assert.equal(f.corpo.codigo, 'conteudo_recusado');
  assert.equal((await banco.fotoPerfil.findUnique({ where: { usuarioId: ana.id }, select: { token: true } })).token, antes);
  definirRevisor();
});
