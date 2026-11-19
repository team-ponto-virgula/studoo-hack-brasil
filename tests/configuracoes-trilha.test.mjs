// Configurações da trilha (lote 4): nome, descrição, tema e capa da galeria. Só a dona; descrição e tema são os
// mesmos da legenda e do tema do link; a cópia leva a capa da galeria e se configura sem mexer na original.
// Não depende do que já existe no banco (outras suítes, demonstração): só confere o que cria.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import sharp from 'sharp';
import { CAPAS_GALERIA } from '@studoo/contratos';
import { PUT as capaPut, DELETE as capaDelete } from '../src/app/api/aprendizado/planos/[id]/capa/route.ts';
import { GET as capaGet } from '../src/app/api/capas/[token]/[tamanho]/route.ts';
import { zerarCacheFotos } from '../src/servidor/compartilhar/foto.ts';
import { PUT as perfilPut } from '../src/app/api/perfil/route.ts';
import { GET as configGet, PATCH as configPatch } from '../src/app/api/aprendizado/planos/[id]/configuracoes/route.ts';
import { GET as planosGet } from '../src/app/api/aprendizado/planos/route.ts';
import { POST as criarPost } from '../src/app/api/aprendizado/planos/[id]/compartilhar/route.ts';
import { GET as linkGet, PATCH as linkPatch } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { POST as adicionarPost } from '../src/app/api/compartilhar/[codigo]/adicionar/route.ts';
import { GET as explorarGet } from '../src/app/api/explorar/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { definirRevisor } from '../src/servidor/compartilhar/revisao.ts';
import { zerarCacheEmAlta } from '../src/servidor/compartilhar/comunidade.ts';

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
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: ['ia:geracao', 'perfil', 'compartilhar:criar', 'compartilhar:adicionar', 'comunidade:publicar', 'trilha:configuracoes', 'capa'].map((p) => assinatura(`${p}:${id}`)) } } });
    await banco.usuario.delete({ where: { id } });
  }
  await banco.tentativaLogin.deleteMany({ where: { chave: assinatura('compartilhar:global') } });
  zerarCacheEmAlta();
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

async function pessoa(nome) {
  const u = await banco.usuario.create({ data: { email: `config-${randomUUID()}@example.test`, fuso: 'UTC' } });
  usuarios.push(u.id);
  const { token } = await criarSessao(u.id);
  if (nome) await json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token, corpo: { nome, cor: 'roxo' } })));
  return { id: u.id, token };
}
const novaTrilha = async (dona) => aceitarProposta(dona.id, (await gerarProposta(dona.id, 'Aprender frações na cozinha')).token);
const obter = (quem, planoId) => json(configGet(pedido(`/api/aprendizado/planos/${planoId}/configuracoes`, { token: quem.token }), ctx({ id: planoId })));
const mudar = (quem, planoId, corpo) => json(configPatch(pedido(`/api/aprendizado/planos/${planoId}/configuracoes`, { metodo: 'PATCH', token: quem.token, corpo }), ctx({ id: planoId })));

test('configurações: só a dona lê e muda; campos validados; o nome novo aparece na lista', async () => {
  const ana = await pessoa('Ana');
  const bia = await pessoa('Bia');
  const plano = await novaTrilha(ana);
  const inicial = await obter(ana, plano.id);
  assert.equal(inicial.status, 200);
  assert.deepEqual([inicial.corpo.titulo, inicial.corpo.descricao, inicial.corpo.tema, inicial.corpo.capa, inicial.corpo.compartilhamento, inicial.corpo.recebida], [plano.titulo, null, null, null, null, false]);
  assert.ok(inicial.corpo.temaSugerido, 'tema sugerido pelo título');
  // De outra pessoa: como se não existisse.
  assert.equal((await obter(bia, plano.id)).status, 404);
  assert.equal((await mudar(bia, plano.id, { titulo: 'Tomada' })).status, 404);
  // Inválidos: nada muda.
  for (const corpo of [{}, { titulo: 'ab' }, { titulo: 'x'.repeat(81) }, { titulo: 'Com <tag>' }, { descricao: 'Veja em exemplo.com' }, { descricao: 'x'.repeat(141) }, { tema: 'astrologia' }, { capa: 'nao-existe' }, { outra: 1 }]) {
    const r = await mudar(ana, plano.id, corpo);
    assert.equal(r.status, 400, JSON.stringify(corpo).slice(0, 40));
    assert.equal(r.corpo.codigo, 'invalido');
  }
  const r = await mudar(ana, plano.id, { titulo: '  Frações   na cozinha de casa ' });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.titulo, 'Frações na cozinha de casa', 'espaços normalizados');
  const lista = await json(planosGet(pedido('/api/aprendizado/planos', { token: ana.token })));
  assert.equal(lista.corpo.find((item) => item.id === plano.id).titulo, 'Frações na cozinha de casa');
  // Capa da galeria e volta para a padrão.
  assert.equal((await mudar(ana, plano.id, { capa: CAPAS_GALERIA[3].id })).corpo.capa, CAPAS_GALERIA[3].id);
  assert.equal((await json(planosGet(pedido('/api/aprendizado/planos', { token: ana.token })))).corpo.find((item) => item.id === plano.id).capa, CAPAS_GALERIA[3].id);
  assert.equal((await mudar(ana, plano.id, { capa: null })).corpo.capa, null);
  // O revisor de conteúdo é chamado antes de gravar o nome.
  definirRevisor(async (conteudo) => (conteudo.tipo === 'titulo' ? { aprovado: false, motivo: 'teste' } : { aprovado: true }));
  try {
    assert.equal((await mudar(ana, plano.id, { titulo: 'Nome recusado' })).corpo.codigo, 'conteudo_recusado');
    assert.equal((await obter(ana, plano.id)).corpo.titulo, 'Frações na cozinha de casa');
  } finally {
    definirRevisor();
  }
});

test('configurações: descrição e tema são a legenda e o tema do link; nome e capa chegam ao link, ao Explorar e à cópia', async () => {
  const ana = await pessoa('Ana');
  const bia = await pessoa('Bia');
  const plano = await novaTrilha(ana);
  const { corpo: link } = await json(criarPost(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token: ana.token, corpo: {} }), ctx({ id: plano.id })));
  // Publica pela folha: a legenda e o tema viram a descrição e o tema das configurações.
  await json(linkPatch(pedido(`/api/compartilhar/${link.codigo}`, { metodo: 'PATCH', token: ana.token, corpo: { visibilidade: 'explorar', tema: 'culinaria', legenda: 'Receitas com frações.' } }), ctx({ codigo: link.codigo })));
  let conf = (await obter(ana, plano.id)).corpo;
  assert.deepEqual([conf.descricao, conf.tema, conf.compartilhamento?.visibilidade, conf.compartilhamento?.estudando], ['Receitas com frações.', 'culinaria', 'explorar', 0]);
  // Muda nas configurações: o link acompanha.
  conf = (await mudar(ana, plano.id, { descricao: 'Para cozinhar medindo.', tema: 'matematica', titulo: 'Frações de cozinha', capa: 'oceano' })).corpo;
  const noLink = await banco.linkTrilha.findUnique({ where: { codigo: link.codigo }, select: { legenda: true, tema: true } });
  assert.deepEqual(noLink, { legenda: 'Para cozinhar medindo.', tema: 'matematica' });
  // Trilha no Explorar não fica sem tema.
  await mudar(ana, plano.id, { tema: null });
  assert.equal((await banco.linkTrilha.findUnique({ where: { codigo: link.codigo }, select: { tema: true } })).tema, 'matematica');
  // A página do link e o cartão do Explorar mostram nome e capa novos.
  const previa = await json(linkGet(pedido(`/api/compartilhar/${link.codigo}`), ctx({ codigo: link.codigo })));
  assert.deepEqual([previa.corpo.titulo, previa.corpo.capa], ['Frações de cozinha', 'oceano']);
  zerarCacheEmAlta();
  const explorar = await json(explorarGet(pedido('/api/explorar?tema=matematica', { token: bia.token })));
  const cartao = [...explorar.corpo.emAlta, ...explorar.corpo.novas].find((item) => item.codigo === link.codigo);
  assert.ok(cartao, 'no Explorar');
  assert.deepEqual([cartao.titulo, cartao.capa, cartao.legenda], ['Frações de cozinha', 'oceano', 'Para cozinhar medindo.']);
  // A cópia leva a capa da galeria; mudar a cópia não mexe na original.
  const { corpo: adicionada } = await json(adicionarPost(pedido(`/api/compartilhar/${link.codigo}/adicionar`, { metodo: 'POST', token: bia.token, corpo: {} }), ctx({ codigo: link.codigo })));
  const copia = (await obter(bia, adicionada.planoId)).corpo;
  assert.deepEqual([copia.capa, copia.recebida, copia.compartilhamento], ['oceano', true, null]);
  await mudar(bia, adicionada.planoId, { titulo: 'Minha cópia', capa: 'noite' });
  assert.deepEqual([(await obter(ana, plano.id)).corpo.titulo, (await obter(ana, plano.id)).corpo.capa], ['Frações de cozinha', 'oceano']);
  assert.equal((await obter(ana, plano.id)).corpo.compartilhamento.estudando, 1);
});

const enviarCapa = (quem, planoId, base64) => json(capaPut(pedido(`/api/aprendizado/planos/${planoId}/capa`, { metodo: 'PUT', token: quem.token, corpo: { base64 } }), ctx({ id: planoId })));
const lerCapa = (token, tamanho) => capaGet(pedido(`/api/capas/${token}/${tamanho}`), ctx({ token, tamanho: String(tamanho) }));

test('capa com foto: 2:1 em WebP sem metadados nos dois tamanhos, token novo a cada troca, a cópia volta à padrão', async () => {
  zerarCacheFotos();
  const ana = await pessoa('Ana');
  const bia = await pessoa('Bia');
  const plano = await novaTrilha(ana);
  // Uma foto com EXIF (orientação e GPS) e proporção qualquer: o servidor corta em 2:1 e tira os metadados.
  const foto = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#c2410c' } })
    .withMetadata({ exif: { IFD0: { Copyright: 'segredo-exif' }, GPS: { GPSLatitudeRef: 'S' } } }).jpeg().toBuffer();
  // De outra pessoa e inválidas: nada muda.
  assert.equal((await enviarCapa(bia, plano.id, foto.toString('base64'))).status, 404);
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
  assert.equal((await enviarCapa(ana, plano.id, gif.toString('base64'))).corpo.codigo, 'foto_invalida');
  assert.equal((await enviarCapa(ana, plano.id, 'nao-e-base64!')).corpo.codigo, 'foto_invalida');
  const r = await enviarCapa(ana, plano.id, foto.toString('base64'));
  assert.equal(r.status, 200);
  assert.match(r.corpo.capa, /^foto:[A-Za-z0-9_-]{16}$/);
  const token = r.corpo.capa.slice(5);
  for (const [largura, altura] of [[1024, 512], [480, 240]]) {
    const resposta = await lerCapa(token, largura);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('content-type'), 'image/webp');
    assert.match(resposta.headers.get('cache-control'), /immutable/);
    const bytes = Buffer.from(await resposta.arrayBuffer());
    const meta = await sharp(bytes).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', largura, altura]);
    assert.equal(meta.exif, undefined, 'sem EXIF');
    assert.ok(!bytes.includes('segredo-exif'));
  }
  assert.equal((await lerCapa(token, 300)).status, 404, 'só os dois tamanhos');
  // A lista e o link mostram a foto; a cópia volta à capa padrão (a foto fica com quem enviou).
  assert.equal((await json(planosGet(pedido('/api/aprendizado/planos', { token: ana.token })))).corpo.find((item) => item.id === plano.id).capa, r.corpo.capa);
  const { corpo: link } = await json(criarPost(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token: ana.token, corpo: {} }), ctx({ id: plano.id })));
  assert.equal((await json(linkGet(pedido(`/api/compartilhar/${link.codigo}`), ctx({ codigo: link.codigo })))).corpo.capa, r.corpo.capa);
  const { corpo: adicionada } = await json(adicionarPost(pedido(`/api/compartilhar/${link.codigo}/adicionar`, { metodo: 'POST', token: bia.token, corpo: {} }), ctx({ codigo: link.codigo })));
  assert.equal((await obter(bia, adicionada.planoId)).corpo.capa, null);
  // Trocar a foto: token novo, o antigo deixa de existir.
  const segunda = await enviarCapa(ana, plano.id, foto.toString('base64'));
  assert.notEqual(segunda.corpo.capa, r.corpo.capa);
  assert.equal((await lerCapa(token, 480)).status, 404);
  // Escolher uma capa da galeria apaga a foto; tirar a foto volta a padrão.
  const token2 = segunda.corpo.capa.slice(5);
  assert.equal((await mudar(ana, plano.id, { capa: 'menta' })).corpo.capa, 'menta');
  assert.equal((await lerCapa(token2, 480)).status, 404);
  await enviarCapa(ana, plano.id, foto.toString('base64'));
  const sem = await json(capaDelete(pedido(`/api/aprendizado/planos/${plano.id}/capa`, { metodo: 'DELETE', token: ana.token }), ctx({ id: plano.id })));
  assert.equal(sem.corpo.capa, null);
  // O revisor de conteúdo é chamado antes de gravar a foto.
  definirRevisor(async (conteudo) => (conteudo.tipo === 'foto' ? { aprovado: false, motivo: 'teste' } : { aprovado: true }));
  try {
    assert.equal((await enviarCapa(ana, plano.id, foto.toString('base64'))).corpo.codigo, 'conteudo_recusado');
    assert.equal((await obter(ana, plano.id)).corpo.capa, null);
  } finally {
    definirRevisor();
  }
});
