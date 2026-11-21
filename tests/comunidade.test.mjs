import { publicacaoRevisada } from './fixtures/moderacao.mjs';
// Comunidade (spec 10, etapa B): publicar, Explorar, Em alta, Valeu e Denunciar. Provedores simulados, banco real.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { GET as configHttp } from '../src/app/api/auth/config/route.ts';
import { PUT as perfilPut, GET as perfilGet } from '../src/app/api/perfil/route.ts';
import { GET as previaGet, POST as criarPost } from '../src/app/api/aprendizado/planos/[id]/compartilhar/route.ts';
import { PATCH as linkPatch } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { POST as adicionarPost } from '../src/app/api/compartilhar/[codigo]/adicionar/route.ts';
import { POST as valeuPost } from '../src/app/api/compartilhar/[codigo]/valeu/route.ts';
import { GET as explorarGet } from '../src/app/api/explorar/route.ts';
import { POST as denunciaPost } from '../src/app/api/denuncias/route.ts';
import { GET as perfisGet } from '../src/app/api/perfis/[perfilId]/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { DOMINIO_EMAIL_VISITANTE, PREFIXO_EMAIL_VISITANTE } from '../src/servidor/acesso/visitante.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { classificacaoDaSemana, zerarCacheEmAlta } from '../src/servidor/compartilhar/comunidade.ts';
import { LIMITES_COMUNIDADE, motivoLegendaInvalida, sugerirTema, svgCapaTrilha } from '@studoo/contratos';

const origem = process.env.STUDOO_ORIGEM || 'http://localhost:3000';
const usuarios = [];
process.env.IA = 'falsa';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
process.env.STUDOO_COMPARTILHAR = '1';
process.env.STUDOO_COMUNIDADE = '1';

after(async () => {
  for (const id of usuarios) {
    await banco.licao.deleteMany({ where: { usuarioId: id } });
    await banco.fluxo.deleteMany({ where: { usuarioId: id } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } });
    await banco.sessao.deleteMany({ where: { usuarioId: id } });
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: ['ia:geracao', 'perfil', 'compartilhar:criar', 'compartilhar:adicionar', 'comunidade:publicar', 'comunidade:valeu', 'comunidade:denuncia'].map((p) => assinatura(`${p}:${id}`)) } } });
    await banco.usuario.delete({ where: { id } }); // eventos e denúncias saem em cascata
  }
  await banco.tentativaLogin.deleteMany({ where: { chave: assinatura('compartilhar:global') } });
  await banco.$disconnect();
});

async function pessoa(nome, email = `comunidade-${randomUUID()}@example.test`) {
  const u = await banco.usuario.create({ data: { email, fuso: 'UTC' } });
  usuarios.push(u.id);
  const { token } = await criarSessao(u.id);
  const quem = { id: u.id, email, token };
  if (nome) await json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token, corpo: { nome, cor: 'verde' } })));
  return quem;
}
const visitante = () => pessoa(null, `${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${randomUUID().slice(0, 12)}${DOMINIO_EMAIL_VISITANTE}`);

function pedido(caminho, { metodo = 'GET', token, corpo } = {}) {
  const headers = { origin: origem };
  if (token) headers.cookie = cookieSessao(token);
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origem}${caminho}`, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
}
const ctx = (params) => ({ params: Promise.resolve(params) });
const json = async (promessa) => { const r = await promessa; return { status: r.status, corpo: await r.json() }; };

async function trilha(dona, objetivo = 'Aprender frações na cozinha') {
  const proposta = await gerarProposta(dona.id, objetivo);
  const plano = await aceitarProposta(dona.id, proposta.token);
  const { corpo: link } = await json(criarPost(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token: dona.token, corpo: {} }), ctx({ id: plano.id })));
  await publicacaoRevisada(dona.id, link.codigo);
  return { plano, codigo: link.codigo };
}
const visibilidade = (quem, codigo, corpo) => json(linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: quem.token, corpo }), ctx({ codigo })));
const publicar = async (quem, codigo, tema = 'matematica', legenda) => {
  const r = await visibilidade(quem, codigo, { visibilidade: 'explorar', tema, ...(legenda !== undefined ? { legenda } : {}) });
  if (r.status === 200) await publicacaoRevisada(quem.id, codigo);
  return r;
};
const explorar = (token, busca = '') => json(explorarGet(pedido(`/api/explorar${busca}`, { token })));
const adicionar = (quem, codigo) => json(adicionarPost(pedido(`/api/compartilhar/${codigo}/adicionar`, { metodo: 'POST', token: quem.token, corpo: {} }), ctx({ codigo })));
const valeu = (quem, codigo, ativo = true) => json(valeuPost(pedido(`/api/compartilhar/${codigo}/valeu`, { metodo: 'POST', token: quem.token, corpo: { ativo } }), ctx({ codigo })));
const denunciar = (quem, corpo) => json(denunciaPost(pedido('/api/denuncias', { metodo: 'POST', token: quem.token, corpo })));
/**
 * Os testes não dependem do que já existe no banco (outras suítes, o conteúdo de demonstração): conferem só as trilhas
 * que criaram, pela ordem relativa, buscando em todas as páginas de "Novas" e na classificação inteira do Em alta.
 */
const cartaoEmNovas = async (token, codigo) => {
  let cursor = null;
  for (let i = 0; i < 50; i++) {
    const r = (await explorar(token, cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')).corpo;
    const achado = r.novas.find((c) => c.codigo === codigo);
    if (achado || !r.cursor) return achado ?? null;
    cursor = r.cursor;
  }
  return null;
};
/** A classificação inteira da semana (sem o corte do top 10), só com os códigos pedidos, na ordem e com os pontos. */
const classificacao = async (codigos, tema) => (await classificacaoDaSemana())
  .filter((item) => codigos.includes(item.codigo) && (!tema || item.tema === tema))
  .map((item) => [item.codigo, item.pontos]);

/** Todas as "Novas" (seguindo o cursor), só dos códigos pedidos. */
async function todasAsNovas(token, codigos, busca = '') {
  const vistos = [];
  let cursor = null;
  let paginas = 0;
  do {
    const sep = busca ? '&' : '?';
    const r = await explorar(token, `${busca}${cursor ? `${sep}cursor=${encodeURIComponent(cursor)}` : ''}`);
    assert.equal(r.status, 200);
    assert.ok(r.corpo.novas.length <= LIMITES_COMUNIDADE.porPagina);
    vistos.push(...r.corpo.novas.filter((c) => codigos.includes(c.codigo)).map((c) => c.codigo));
    cursor = r.corpo.cursor;
    paginas += 1;
  } while (cursor && paginas < 50);
  return { vistos, paginas };
}

test('contrato: tema sugerido pelo título, legenda e capa determinística', () => {
  assert.equal(sugerirTema('Inglês para viagens'), 'idiomas');
  assert.equal(sugerirTema('Frações na cozinha'), 'matematica');
  assert.equal(sugerirTema('Violão do zero: primeiros acordes'), 'artes');
  assert.equal(sugerirTema('Python para análise de dados'), 'programacao');
  assert.equal(sugerirTema('Culinária: receitas básicas'), 'culinaria');
  assert.equal(sugerirTema('Redação para o ENEM'), 'vestibular');
  assert.equal(sugerirTema('Algo bem diferente'), 'outros');
  assert.equal(motivoLegendaInvalida(''), null);
  assert.equal(motivoLegendaInvalida('Feita para quem cozinha com crianças.'), null);
  assert.equal(motivoLegendaInvalida('x'.repeat(141)), 'longa');
  assert.equal(motivoLegendaInvalida('veja em ana.com.br'), 'endereco');
  assert.equal(motivoLegendaInvalida('<b>oi</b>'), 'caracteres');
  const a = svgCapaTrilha('AbCdEfGhIjKlMn_-', 'idiomas');
  assert.equal(a, svgCapaTrilha('AbCdEfGhIjKlMn_-', 'idiomas'), 'o mesmo código dá a mesma capa');
  assert.notEqual(a, svgCapaTrilha('ZbCdEfGhIjKlMn_-', 'idiomas'), 'outro código, outra capa');
  assert.ok(!/<script|on\w+=|href=|<image/i.test(a), 'só formas, sem script nem imagem');
});

test('sem STUDOO_COMUNIDADE, nada da etapa B existe (rotas 404, config falsa, link sem visibilidade)', async () => {
  const ana = await pessoa('Ana');
  const { plano, codigo } = await trilha(ana);
  delete process.env.STUDOO_COMUNIDADE;
  try {
    assert.equal((await (await configHttp(pedido('/api/auth/config'))).json()).comunidade, false);
    assert.equal((await explorar(null)).status, 404);
    assert.equal((await valeu(ana, codigo)).status, 404);
    assert.equal((await denunciar(ana, { alvoTipo: 'trilha', alvo: codigo, motivo: 'spam' })).corpo.codigo, 'trilha_propria');
    assert.equal((await publicar(ana, codigo)).status, 404);
    const previa = (await json(previaGet(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { token: ana.token }), ctx({ id: plano.id })))).corpo;
    assert.ok(!('temaSugerido' in previa) && !('visibilidade' in previa.link));
    // A flag da comunidade sozinha não liga nada sem a do compartilhar.
    process.env.STUDOO_COMUNIDADE = '1';
    delete process.env.STUDOO_COMPARTILHAR;
    assert.equal((await explorar(null)).status, 404);
  } finally {
    process.env.STUDOO_COMUNIDADE = '1';
    process.env.STUDOO_COMPARTILHAR = '1';
  }
  assert.equal((await (await configHttp(pedido('/api/auth/config'))).json()).comunidade, true);
});

test('publicar: três níveis, tema obrigatório, legenda validada, material fica de fora, data de publicação fixa', async () => {
  const ana = await pessoa('Ana');
  const { plano, codigo } = await trilha(ana, 'Aprender violão do zero');
  const previa = (await json(previaGet(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { token: ana.token }), ctx({ id: plano.id })))).corpo;
  assert.equal(previa.temaSugerido, 'artes');
  assert.equal(typeof previa.demonstracao, 'boolean');
  assert.equal(previa.link.visibilidade, 'link');

  assert.equal((await visibilidade(ana, codigo, { visibilidade: 'explorar' })).status, 400, 'sem tema');
  assert.equal((await publicar(ana, codigo, 'astrologia')).status, 400);
  assert.equal((await publicar(ana, codigo, 'artes', 'veja ana.com.br')).status, 400);
  assert.equal((await publicar(ana, codigo, 'artes', 'x'.repeat(141))).status, 400);
  let r = await publicar(ana, codigo, 'artes', '  Para quem nunca pegou num violão. ');
  assert.equal(r.status, 200);
  assert.equal(r.corpo.visibilidade, 'explorar');
  assert.equal(r.corpo.noPerfil, true, 'o Explorar inclui o perfil');
  assert.equal(r.corpo.tema, 'artes');
  assert.equal(r.corpo.legenda, 'Para quem nunca pegou num violão.');
  const primeira = (await banco.linkTrilha.findUnique({ where: { codigo } })).publicadaEm;
  assert.ok(primeira);
  r = await publicar(ana, codigo, 'artes', 'Nova legenda');
  assert.equal((await banco.linkTrilha.findUnique({ where: { codigo } })).publicadaEm.getTime(), primeira.getTime(), 'editar não reordena');

  r = await visibilidade(ana, codigo, { visibilidade: 'perfil' });
  assert.deepEqual([r.corpo.visibilidade, r.corpo.noPerfil], ['perfil', true]);
  r = await visibilidade(ana, codigo, { visibilidade: 'link' });
  assert.deepEqual([r.corpo.visibilidade, r.corpo.noPerfil], ['link', false]);
  await publicar(ana, codigo, 'artes');
  // O interruptor antigo ("Mostrar no meu perfil" desligado) também tira do Explorar.
  r = await json(linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: ana.token, corpo: { noPerfil: false } }), ctx({ codigo })));
  assert.equal(r.corpo.visibilidade, 'link');

  // Outra pessoa não publica o link da Ana.
  const bia = await pessoa('Bia');
  assert.equal((await publicar(bia, codigo)).corpo.codigo, 'link_inativo');

  // Trilha feita de material não vai para o Explorar.
  const { plano: deMaterial, codigo: codigoMaterial } = await trilha(ana, 'Estudar meu material');
  const licao = await banco.licao.findFirst({ where: { usuarioId: ana.id, fluxo: { planoId: deMaterial.id } } });
  await banco.licao.update({ where: { usuarioId_id: { usuarioId: ana.id, id: licao.id } }, data: { conteudo: { ...licao.conteudo, referencias: [{ materialId: 'm1', nome: 'apostila.pdf', pagina: 1, trecho: 'Um trecho.', leitura: 'texto' }] } } });
  r = await publicar(ana, codigoMaterial);
  assert.equal(r.status, 409);
  assert.equal(r.corpo.codigo, 'explorar_material');
  assert.equal((await visibilidade(ana, codigoMaterial, { visibilidade: 'perfil' })).status, 200, 'no perfil ainda vale');
});

test('Explorar: público, mais novas primeiro, 20 por página por cursor, filtro de tema, cartões sem dados privados', async () => {
  const autores = [await pessoa('Caio'), await pessoa('Duda')];
  const codigos = [];
  for (let i = 0; i < 22; i++) {
    const autor = autores[i % 2];
    const { codigo } = await trilha(autor, i % 3 === 0 ? 'Inglês para viagens' : 'Frações na cozinha');
    await publicar(autor, codigo, i % 3 === 0 ? 'idiomas' : 'matematica');
    codigos.push(codigo);
  }
  const { vistos, paginas } = await todasAsNovas(null, codigos);
  assert.ok(paginas >= 2, 'mais de uma página');
  assert.deepEqual(vistos, [...codigos].reverse(), 'as mais novas primeiro, sem repetir nem pular');
  const idiomas = await todasAsNovas(null, codigos, '?tema=idiomas');
  assert.deepEqual(idiomas.vistos, codigos.filter((_, i) => i % 3 === 0).reverse());
  assert.equal((await explorar(null, '?tema=astrologia')).status, 400);
  assert.equal((await explorar(null, '?cursor=lixo')).status, 400);

  const pagina = (await explorar(null)).corpo;
  const cartao = await cartaoEmNovas(null, codigos[codigos.length - 1]);
  assert.deepEqual(Object.keys(cartao).sort(), ['codigo', 'demonstracao', 'dono', 'estudando', 'legenda', 'publicadaEm', 'tema', 'titulo', 'totalLicoes', 'totalPartes', 'valeus']);
  assert.deepEqual(Object.keys(cartao.dono).sort(), ['cor', 'foto', 'nome', 'perfilId', 'resumo']);
  assert.ok(cartao.dono.perfilId, 'quem publica tem perfil público');
  const texto = JSON.stringify(pagina);
  for (const proibido of [...autores.map((a) => a.email), ...autores.map((a) => a.id), 'objetivo', 'progresso', 'email']) assert.ok(!texto.includes(proibido), proibido);
});

test('cartão por situação: nova, adicionada (Continuar) e sua; valeu liga e desliga; regras do valeu', async () => {
  const ana = await pessoa('Ana');
  const bia = await pessoa('Bia');
  const { plano, codigo } = await trilha(ana);
  await publicar(ana, codigo, 'matematica');
  const deBia = () => cartaoEmNovas(bia.token, codigo);
  assert.equal((await deBia()).situacao, 'nova');
  const { corpo: adicionada } = await adicionar(bia, codigo);
  const cartao = await deBia();
  assert.equal(cartao.situacao, 'adicionada');
  assert.equal(cartao.planoId, adicionada.planoId);
  assert.equal(cartao.estudando, 1);
  const daAna = await cartaoEmNovas(ana.token, codigo);
  assert.equal(daAna.situacao, 'sua');
  assert.equal(daAna.planoId, plano.id);

  let r = await valeu(bia, codigo, true);
  assert.deepEqual(r.corpo, { valeus: 1, valeuMeu: true });
  r = await valeu(bia, codigo, true);
  assert.deepEqual(r.corpo, { valeus: 1, valeuMeu: true }, 'um por conta');
  assert.equal((await deBia()).valeuMeu, true);
  r = await valeu(bia, codigo, false);
  assert.deepEqual(r.corpo, { valeus: 0, valeuMeu: false });
  assert.equal((await valeu(ana, codigo)).corpo.codigo, 'trilha_propria');
  const vis = await visitante();
  assert.equal((await valeu(vis, codigo)).corpo.codigo, 'compartilhar_visitante');
  assert.equal((await valeu(bia, 'AAAAAAAAAAAAAAAA')).corpo.codigo, 'link_inativo');
  assert.equal((await json(valeuPost(pedido(`/api/compartilhar/${codigo}/valeu`, { metodo: 'POST', corpo: { ativo: true } }), ctx({ codigo })))).status, 401, 'agir pede conta');
  // Os valeus aparecem para a dona no perfil.
  await valeu(bia, codigo, true);
  const perfil = (await json(perfilGet(pedido('/api/perfil', { token: ana.token })))).corpo;
  assert.equal(perfil.links.find((l) => l.codigo === codigo).valeus, 1);
});

test('Em alta: 7 dias, adições distintas × 3 + valeus, sem visitantes, empate para a mais recente, só com ponto', async () => {
  const [ana, bia, caio, duda, edu] = [await pessoa('Ana'), await pessoa('Bia'), await pessoa('Caio'), await pessoa('Duda'), await pessoa('Edu')];
  const t = {};
  for (const nome of ['a', 'b', 'c', 'd', 'e']) {
    const { codigo } = await trilha(ana);
    await publicar(ana, codigo, nome === 'e' ? 'idiomas' : 'matematica');
    t[nome] = codigo;
  }
  // a: 2 adições (6) · b: 1 adição + 2 valeus (5) · c: 5 valeus (5, publicada depois de b) · d: só visitante e só antigos (0) · e: 1 valeu (1)
  await adicionar(bia, t.a); await adicionar(caio, t.a);
  await adicionar(bia, t.b); await valeu(caio, t.b); await valeu(duda, t.b);
  for (const quem of [bia, caio, duda, edu]) await valeu(quem, t.c);
  const vis = await visitante();
  await adicionar(vis, t.c); // visitante não conta
  await valeu(bia, t.d); await adicionar(caio, t.d);
  await banco.eventoTrilha.updateMany({ where: { codigo: t.d }, data: { criadoEm: new Date(Date.now() - 8 * 24 * 60 * 60_000) } });
  await valeu(bia, t.e);
  // Para empatar b (5) e c: mais um valeu em c (5) — c é mais recente, então vem antes de b.
  const fabi = await pessoa('Fabi');
  await valeu(fabi, t.c);
  zerarCacheEmAlta();
  const codigos = Object.values(t);
  const emAlta = await classificacao(codigos);
  assert.deepEqual(emAlta, [[t.a, 6], [t.c, 5], [t.b, 5], [t.e, 1]], 'a(6), c(5, mais nova), b(5), e(1); d fora');
  assert.deepEqual(await classificacao(codigos, 'idiomas'), [[t.e, 1]]);
  // O Em alta da página é o começo da mesma classificação, com no máximo 10, e o filtro de tema usa o mesmo cálculo.
  const pagina = (await explorar(null)).corpo.emAlta;
  assert.ok(pagina.length <= LIMITES_COMUNIDADE.emAlta);
  // Outros arquivos de teste rodam em paralelo no mesmo banco e podem apagar trilhas suas entre o cálculo (em cache) e a
  // leitura dos cartões: a página é o top 10 na mesma ordem, sem as que sumiram, e as desta suíte estão todas lá.
  const top = (await classificacaoDaSemana()).slice(0, LIMITES_COMUNIDADE.emAlta).map((i) => i.codigo);
  const naPagina = pagina.map((c) => c.codigo);
  assert.deepEqual(naPagina, top.filter((codigo) => naPagina.includes(codigo)), 'mesma ordem do top 10');
  assert.deepEqual(naPagina.filter((codigo) => codigos.includes(codigo)), top.filter((codigo) => codigos.includes(codigo)));
  const doTema = (await explorar(null, '?tema=idiomas')).corpo.emAlta;
  assert.ok(doTema.every((c) => c.tema === 'idiomas'));
  // O "Em alta" fica em cache por 60 s: um valeu novo não muda a ordem até lá.
  await valeu(duda, t.e); await valeu(edu, t.e); await adicionar(duda, t.e); await adicionar(edu, t.e);
  assert.deepEqual(await classificacao(codigos), emAlta, 'em cache: nada muda');
  zerarCacheEmAlta();
  assert.deepEqual((await classificacao(codigos))[0], [t.e, 9], 'e(9) passa a liderar');
  // Despublicar tira do Em alta.
  await visibilidade(ana, t.e, { visibilidade: 'perfil' });
  zerarCacheEmAlta();
  assert.ok(!(await classificacao(codigos)).some(([codigo]) => codigo === t.e));
});

test('Denunciar: motivo da lista, uma por conta, 3 contas tiram a trilha do Explorar, perfil registrado, limites', async () => {
  const ana = await pessoa('Ana');
  const { codigo } = await trilha(ana);
  await publicar(ana, codigo, 'matematica');
  const [bia, caio, duda] = [await pessoa('Bia'), await pessoa('Caio'), await pessoa('Duda')];
  await valeu(bia, codigo);
  assert.equal((await denunciar(bia, { alvoTipo: 'trilha', alvo: codigo, motivo: 'astrologia' })).status, 400);
  assert.equal((await denunciar(ana, { alvoTipo: 'trilha', alvo: codigo, motivo: 'spam' })).corpo.codigo, 'trilha_propria');
  const vis = await visitante();
  assert.equal((await denunciar(vis, { alvoTipo: 'trilha', alvo: codigo, motivo: 'spam' })).status, 200);
  assert.equal((await denunciar(bia, { alvoTipo: 'trilha', alvo: codigo, motivo: 'spam' })).status, 200);
  assert.equal((await denunciar(bia, { alvoTipo: 'trilha', alvo: codigo, motivo: 'ofensivo' })).status, 200, 'repetir não conta de novo');
  assert.equal((await denunciar(caio, { alvoTipo: 'trilha', alvo: codigo, motivo: 'direitos' })).status, 200);
  const naLista = async () => Boolean(await cartaoEmNovas(null, codigo));
  assert.ok(await naLista(), 'com 2 contas, segue no Explorar');
  await denunciar(duda, { alvoTipo: 'trilha', alvo: codigo, motivo: 'outro' });
  assert.ok(!(await naLista()), 'com 3 contas, sai do Explorar');
  zerarCacheEmAlta();
  assert.ok(!(await classificacao([codigo])).length, 'fora do Em alta');
  assert.equal((await banco.denuncia.count({ where: { alvo: codigo, contaVerificada: true } })), 3);
  // A retenção do link também impede que outra pessoa adicione a cópia.
  assert.equal((await adicionar(await pessoa('Edu'), codigo)).status, 404);

  const perfil = (await json(perfilGet(pedido('/api/perfil', { token: ana.token })))).corpo;
  assert.equal((await denunciar(bia, { alvoTipo: 'perfil', alvo: perfil.perfilId, motivo: 'spam' })).status, 200);
  assert.equal((await denunciar(bia, { alvoTipo: 'perfil', alvo: 'AAAAAAAAAAAAAAAA', motivo: 'spam' })).status, 404);

  // 10 por hora por conta.
  const fabi = await pessoa('Fabi');
  const alvos = [];
  for (let i = 0; i < 11; i++) alvos.push((await trilha(ana)).codigo);
  for (let i = 0; i < 10; i++) assert.equal((await denunciar(fabi, { alvoTipo: 'trilha', alvo: alvos[i], motivo: 'spam' })).status, 200);
  const excesso = await denunciar(fabi, { alvoTipo: 'trilha', alvo: alvos[10], motivo: 'spam' });
  assert.equal(excesso.status, 429);
  assert.equal(excesso.corpo.codigo, 'limite_comunidade');
});

test('perfil público com cartões (comunidade), com a situação para quem está logado', async () => {
  const ana = await pessoa('Ana');
  const { codigo } = await trilha(ana);
  await visibilidade(ana, codigo, { visibilidade: 'perfil' });
  const perfilId = (await json(perfilGet(pedido('/api/perfil', { token: ana.token })))).corpo.perfilId;
  const anonimo = (await json(perfisGet(pedido(`/api/perfis/${perfilId}`), ctx({ perfilId })))).corpo;
  assert.equal(anonimo.cartoes.length, 1);
  assert.equal(anonimo.cartoes[0].tema, null, 'no perfil sem publicar: sem tema');
  assert.ok(!('situacao' in anonimo.cartoes[0]));
  const bia = await pessoa('Bia');
  const logado = (await json(perfisGet(pedido(`/api/perfis/${perfilId}`, { token: bia.token }), ctx({ perfilId })))).corpo;
  assert.equal(logado.cartoes[0].situacao, 'nova');
  assert.ok(!JSON.stringify(logado).includes(ana.email));
});
