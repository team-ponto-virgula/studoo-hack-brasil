import { publicacaoRevisada } from './fixtures/moderacao.mjs';
// Perfis e compartilhar trilha (spec 09): rotas, cópia, privacidade e flag. Provedores simulados, banco real.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { GET as configHttp } from '../src/app/api/auth/config/route.ts';
import { GET as perfilGet, PUT as perfilPut } from '../src/app/api/perfil/route.ts';
import { GET as previaGet, POST as criarPost } from '../src/app/api/aprendizado/planos/[id]/compartilhar/route.ts';
import { GET as linkGet, PATCH as linkPatch, DELETE as linkDelete } from '../src/app/api/compartilhar/[codigo]/route.ts';
import { POST as adicionarPost } from '../src/app/api/compartilhar/[codigo]/adicionar/route.ts';
import { GET as perfisGet } from '../src/app/api/perfis/[perfilId]/route.ts';
import { DELETE as planoDelete, GET as planoGet } from '../src/app/api/aprendizado/planos/[id]/route.ts';
import { GET as planosGet } from '../src/app/api/aprendizado/planos/route.ts';
import { GET as licaoGet } from '../src/app/api/aprendizado/licoes/[id]/route.ts';
import { cookieSessao } from '../src/servidor/acesso/origem.ts';
import { assinatura } from '../src/servidor/acesso/seguranca.ts';
import { criarSessao } from '../src/servidor/acesso/sessao.ts';
import { DOMINIO_EMAIL_VISITANTE, PREFIXO_EMAIL_VISITANTE } from '../src/servidor/acesso/visitante.ts';
import { aceitarProposta, gerarProposta } from '../src/servidor/aprendizado/servico.ts';
import { banco } from '../src/servidor/banco/cliente.ts';
import { LINKS_ATIVOS_MAX, conteudoParaCopia } from '../src/servidor/compartilhar/servico.ts';
import { MATERIAL_COMPARTILHADO, codigoDoLink, motivoNomeInvalido, normalizarNomePerfil } from '@studoo/contratos';

const origem = process.env.STUDOO_ORIGEM || 'http://localhost:3000';
const usuarios = [];
process.env.IA = 'falsa';
process.env.STUDOO_IA_FALSA_PAUSA_MS = '0';
const flag = (ligada) => { if (ligada) process.env.STUDOO_COMPARTILHAR = '1'; else delete process.env.STUDOO_COMPARTILHAR; };
flag(true);

after(async () => {
  for (const id of usuarios) {
    await banco.apoioLicao.deleteMany({ where: { usuarioId: id } });
    await banco.registroEstudo.deleteMany({ where: { usuarioId: id } });
    await banco.licao.deleteMany({ where: { usuarioId: id } });
    await banco.fluxo.deleteMany({ where: { usuarioId: id } });
    await banco.planoAprendizado.deleteMany({ where: { usuarioId: id } }); // o link sai em cascata
    await banco.sessao.deleteMany({ where: { usuarioId: id } });
    await banco.tentativaLogin.deleteMany({ where: { chave: { in: [`ia:geracao:${id}`, `perfil:${id}`, `compartilhar:criar:${id}`, `compartilhar:adicionar:${id}`].map(assinatura) } } });
    await banco.usuario.delete({ where: { id } });
  }
  await banco.tentativaLogin.deleteMany({ where: { chave: { in: ['compartilhar:global', 'compartilhar:ip:203.0.113.7', 'compartilhar:ip:203.0.113.8'].map(assinatura) } } });
  await banco.$disconnect();
});

async function pessoa(email = `compartilhar-${randomUUID()}@example.test`) {
  const u = await banco.usuario.create({ data: { email, fuso: 'UTC' } });
  usuarios.push(u.id);
  const { token } = await criarSessao(u.id);
  return { id: u.id, email, token };
}
const visitante = () => pessoa(`${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${randomUUID().slice(0, 12)}${DOMINIO_EMAIL_VISITANTE}`);

function pedido(caminho, { metodo = 'GET', token, corpo, semOrigem = false } = {}) {
  const headers = {};
  if (!semOrigem) headers.origin = origem;
  if (token) headers.cookie = cookieSessao(token);
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  return new Request(`${origem}${caminho}`, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
}
const ctx = (params) => ({ params: Promise.resolve(params) });
const json = async (promessa) => { const resposta = await promessa; return { status: resposta.status, corpo: await resposta.json() }; };

async function trilha(dono, objetivo = 'Aprender frações na cozinha com segredo-objetivo') {
  const proposta = await gerarProposta(dono.id, objetivo);
  return aceitarProposta(dono.id, proposta.token);
}
const salvarNome = (quem, nome = 'Ana', cor = 'verde') => json(perfilPut(pedido('/api/perfil', { metodo: 'PUT', token: quem.token, corpo: { nome, cor } })));
const criarLink = async (quem, planoId) => {
  const r = await json(criarPost(pedido(`/api/aprendizado/planos/${planoId}/compartilhar`, { metodo: 'POST', token: quem.token, corpo: {} }), ctx({ id: planoId })));
  if (r.status === 200) await publicacaoRevisada(quem.id, r.corpo.codigo);
  return r;
};
const previaPublica = (codigo, token) => json(linkGet(pedido(`/api/compartilhar/${codigo}`, { token }), ctx({ codigo })));
const adicionar = (quem, codigo) => json(adicionarPost(pedido(`/api/compartilhar/${codigo}/adicionar`, { metodo: 'POST', token: quem.token, corpo: {} }), ctx({ codigo })));

/** Uma lição da dona com progresso, ponte e Explique: nada disso pode ir para a cópia. */
async function marcarEstudo(dono, plano) {
  const licaoId = plano.fluxos[0].licoes[0].id;
  await banco.registroEstudo.create({ data: { usuarioId: dono.id, licaoId, segundos: 321, acertosDePrimeira: 1, exercicios: 2, pratica: 'consegui' } });
  await banco.apoioLicao.create({ data: { usuarioId: dono.id, licaoId, erros: 3, ultimaResposta: 'segredo-resposta', ultimoIndice: 0, ensino: { texto: 'segredo-explique' }, reforco: { motivo: 'segredo-ponte' }, reforcoConcluido: true } });
}

test('regras do nome: normaliza espaços e recusa HTML, controle, endereço, e-mail e tamanho fora de 2 a 40', () => {
  assert.equal(normalizarNomePerfil('  Ana   Maria   '), 'Ana Maria');
  assert.equal(motivoNomeInvalido('Ana Maria'), null);
  assert.equal(motivoNomeInvalido('Zé'), null);
  assert.equal(motivoNomeInvalido('A'), 'curto');
  assert.equal(motivoNomeInvalido('a'.repeat(41)), 'longo');
  assert.equal(motivoNomeInvalido('<b>Ana</b>'), 'caracteres');
  assert.equal(motivoNomeInvalido('Ana​'), 'caracteres');
  assert.equal(motivoNomeInvalido('Ana\u0007'), 'caracteres');
  for (const nome of ['ana@exemplo.com', 'site.com.br', 'www.ana', 'https://x', 'Ana loja.shop']) assert.equal(motivoNomeInvalido(nome), 'endereco', nome);
  assert.equal(codigoDoLink('https://studoo.exemplo/t/AbCdEfGhIjKlMn_-'), 'AbCdEfGhIjKlMn_-');
  assert.equal(codigoDoLink(' AbCdEfGhIjKlMn_- '), 'AbCdEfGhIjKlMn_-');
  assert.equal(codigoDoLink('https://studoo.exemplo/t/curto'), null);
});

test('sem a flag, nenhuma rota nova existe e as listas não trazem marcas', async () => {
  const dona = await pessoa();
  const plano = await trilha(dona);
  flag(false);
  try {
    const cfg = await (await configHttp(pedido('/api/auth/config'))).json();
    assert.equal(cfg.compartilhar, false);
    const codigo = 'AAAAAAAAAAAAAAAA';
    const respostas = [
      await perfilGet(pedido('/api/perfil', { token: dona.token })),
      await perfilPut(pedido('/api/perfil', { metodo: 'PUT', token: dona.token, corpo: { nome: 'Ana', cor: 'azul' } })),
      await previaGet(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { token: dona.token }), ctx({ id: plano.id })),
      await criarPost(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { metodo: 'POST', token: dona.token, corpo: {} }), ctx({ id: plano.id })),
      await linkGet(pedido(`/api/compartilhar/${codigo}`), ctx({ codigo })),
      await linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: dona.token, corpo: { noPerfil: true } }), ctx({ codigo })),
      await linkDelete(pedido(`/api/compartilhar/${codigo}`, { metodo: 'DELETE', token: dona.token }), ctx({ codigo })),
      await adicionarPost(pedido(`/api/compartilhar/${codigo}/adicionar`, { metodo: 'POST', token: dona.token, corpo: {} }), ctx({ codigo })),
      await perfisGet(pedido(`/api/perfis/${codigo}`), ctx({ perfilId: codigo })),
    ];
    for (const r of respostas) assert.equal(r.status, 404);
    const lista = await (await planosGet(pedido('/api/aprendizado/planos', { token: dona.token }))).json();
    assert.ok(lista.every((p) => !('link' in p) && !('recebida' in p)));
  } finally {
    flag(true);
  }
  assert.equal((await (await configHttp(pedido('/api/auth/config'))).json()).compartilhar, true);
});

test('perfil: visitante não tem perfil nem compartilha; sem nome, criar link pede o perfil; nome inválido é recusado', async () => {
  const vis = await visitante();
  const planoVis = await trilha(vis);
  assert.equal((await salvarNome(vis)).corpo.codigo, 'compartilhar_visitante');
  assert.equal((await criarLink(vis, planoVis.id)).status, 403);
  const perfilVis = (await json(perfilGet(pedido('/api/perfil', { token: vis.token })))).corpo;
  assert.equal(perfilVis.visitante, true);

  const dona = await pessoa();
  const plano = await trilha(dona);
  assert.equal((await criarLink(dona, plano.id)).corpo.codigo, 'perfil_incompleto');
  for (const nome of ['<i>Ana</i>', 'ana@exemplo.com', 'A', 'x'.repeat(41)]) assert.equal((await salvarNome(dona, nome)).status, 400, nome);
  assert.equal((await salvarNome(dona, 'Ana', 'preto')).status, 400, 'cor fora das seis');
  const salvo = await salvarNome(dona, '  Ana   Souza ', 'roxo');
  assert.equal(salvo.status, 200);
  assert.equal(salvo.corpo.nome, 'Ana Souza');
  assert.match(salvo.corpo.perfilId, /^[A-Za-z0-9_-]{16}$/);
  assert.equal(salvo.corpo.publico, false, 'privado por padrão');
  // Mudança de estado sem a origem do Studoo é recusada, como nas outras rotas.
  assert.equal((await perfilPut(pedido('/api/perfil', { metodo: 'PUT', token: dona.token, corpo: { nome: 'Ana', cor: 'azul' }, semOrigem: true }))).status, 403);
});

test('link: código aleatório de 96 bits, um por trilha, só a dona cria, altera ou encerra', async () => {
  const dona = await pessoa();
  const outra = await pessoa();
  await salvarNome(dona);
  await salvarNome(outra, 'Bia');
  const plano = await trilha(dona);
  const criado = await criarLink(dona, plano.id);
  assert.equal(criado.status, 200);
  const { codigo } = criado.corpo;
  assert.match(codigo, /^[A-Za-z0-9_-]{16}$/);
  assert.ok(!plano.id.includes(codigo) && !dona.id.includes(codigo));
  assert.equal((await criarLink(dona, plano.id)).corpo.codigo, codigo, 'o mesmo link de novo');
  assert.equal((await criarLink(outra, plano.id)).status, 404, 'trilha de outra pessoa');

  const patchOutra = await json(linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: outra.token, corpo: { noPerfil: true } }), ctx({ codigo })));
  const deleteOutra = await json(linkDelete(pedido(`/api/compartilhar/${codigo}`, { metodo: 'DELETE', token: outra.token }), ctx({ codigo })));
  assert.equal(patchOutra.status, 404);
  assert.equal(deleteOutra.status, 404);
  const link = await banco.linkTrilha.findUnique({ where: { codigo } });
  assert.equal(link.noPerfil, false, 'nada mudou');

  const patch = await json(linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: dona.token, corpo: { noPerfil: true } }), ctx({ codigo })));
  assert.equal(patch.corpo.noPerfil, true);
  const lista = (await json(planosGet(pedido('/api/aprendizado/planos', { token: dona.token })))).corpo;
  // O resumo traz a revisão da equipe (spec 16, item 31): o mapa e o selo de Minhas trilhas dizem "Em revisão" e "Não publicada" como o Perfil.
  assert.deepEqual(lista.find((p) => p.id === plano.id).link, { codigo, noPerfil: true, moderacao: 'aprovado' });
  const estado = async () => (await json(planosGet(pedido('/api/aprendizado/planos', { token: dona.token })))).corpo.find((p) => p.id === plano.id).link.moderacao;
  await banco.linkTrilha.update({ where: { codigo }, data: { moderacao: 'pendente' } });
  assert.equal(await estado(), 'pendente');
  await banco.linkTrilha.update({ where: { codigo }, data: { moderacao: 'recusado' } });
  assert.equal(await estado(), 'recusado');
  // O plano aberto traz a mesma marca que a lista.
  const aberto = (await json(planoGet(pedido(`/api/aprendizado/planos/${plano.id}`, { token: dona.token }), ctx({ id: plano.id })))).corpo;
  assert.deepEqual(aberto.link, { codigo, noPerfil: true, moderacao: 'recusado' });
});

test('a cópia não leva nada do estudo da dona e adicionar duas vezes não duplica', async () => {
  const dona = await pessoa();
  const quem = await pessoa();
  await salvarNome(dona, 'Ana', 'rosa');
  const plano = await trilha(dona);
  await marcarEstudo(dona, plano);
  const { codigo } = (await criarLink(dona, plano.id)).corpo;

  const previa = await previaPublica(codigo, quem.token);
  assert.equal(previa.status, 200);
  assert.equal(previa.corpo.situacao, 'nova');
  const primeira = await adicionar(quem, codigo);
  assert.equal(primeira.status, 200);
  assert.equal(primeira.corpo.jaTinha, false);
  const segunda = await adicionar(quem, codigo);
  assert.deepEqual([segunda.corpo.planoId, segunda.corpo.jaTinha], [primeira.corpo.planoId, true]);
  assert.equal(await banco.planoAprendizado.count({ where: { usuarioId: quem.id } }), 1, 'uma trilha só');
  assert.equal((await banco.linkTrilha.findUnique({ where: { codigo } })).adicoes, 1);
  assert.equal((await previaPublica(codigo, quem.token)).corpo.situacao, 'adicionada');
  assert.equal((await previaPublica(codigo, dona.token)).corpo.situacao, 'sua');
  assert.equal((await adicionar(dona, codigo)).corpo.codigo, 'trilha_propria');

  const copiaId = primeira.corpo.planoId;
  const copia = await banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId: quem.id, id: copiaId } } });
  assert.notEqual(copia.objetivo, plano.objetivo, 'o objetivo digitado não vai');
  assert.ok(!copia.objetivo.includes('segredo-objetivo'));
  assert.equal(await banco.registroEstudo.count({ where: { usuarioId: quem.id } }), 0, 'sem progresso');
  assert.equal(await banco.apoioLicao.count({ where: { usuarioId: quem.id } }), 0, 'sem respostas, erros, ponte ou Explique');
  const licoes = await banco.licao.findMany({ where: { usuarioId: quem.id } });
  assert.equal(licoes.length, plano.fluxos.reduce((n, f) => n + f.licoes.length, 0), 'todas as lições, com conteúdo');
  const tudo = JSON.stringify({ copia, licoes });
  for (const segredo of ['segredo-resposta', 'segredo-explique', 'segredo-ponte', 'segredo-objetivo', dona.id, dona.email, plano.id]) {
    assert.ok(!tudo.includes(segredo), `a cópia contém ${segredo}`);
  }
  const detalhe = (await json(planoGet(pedido(`/api/aprendizado/planos/${copiaId}`, { token: quem.token }), ctx({ id: copiaId })))).corpo;
  assert.equal(detalhe.progresso.concluidas, 0);
  assert.deepEqual(detalhe.recebida, { nome: 'Ana', perfilId: null, codigoAtivo: codigo, foto: null });
  assert.equal((await criarLink(quem, copiaId)).corpo.codigo, 'trilha_recebida', 'trilha recebida não é recompartilhada');
  assert.equal((await salvarNome(quem, 'Bia')).status, 200);
  assert.equal((await criarLink(quem, copiaId)).corpo.codigo, 'trilha_recebida');
});

test('nenhuma resposta pública traz e-mail, id de usuário, objetivo digitado ou progresso', async () => {
  const dona = await pessoa();
  await salvarNome(dona, 'Ana');
  const plano = await trilha(dona);
  await marcarEstudo(dona, plano);
  const { codigo } = (await criarLink(dona, plano.id)).corpo;
  const perfil = (await json(perfilGet(pedido('/api/perfil', { token: dona.token })))).corpo;
  await linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: dona.token, corpo: { noPerfil: true } }), ctx({ codigo }));

  const anonima = await previaPublica(codigo);
  const pagina = await json(perfisGet(pedido(`/api/perfis/${perfil.perfilId}`), ctx({ perfilId: perfil.perfilId })));
  assert.equal(anonima.status, 200);
  assert.equal(pagina.status, 200);
  assert.equal(anonima.corpo.dono.perfilId, perfil.perfilId, 'perfil público: o nome leva a ele');
  assert.ok(!('situacao' in anonima.corpo), 'sem sessão, sem situação');
  for (const corpo of [anonima.corpo, pagina.corpo]) {
    const texto = JSON.stringify(corpo);
    for (const proibido of [dona.email, dona.id, plano.id, 'segredo-objetivo', 'progresso', 'concluida', 'adicoes', 'email', 'objetivo']) {
      assert.ok(!texto.includes(proibido), `resposta pública contém ${proibido}`);
    }
  }
  assert.deepEqual(Object.keys(anonima.corpo).sort(), ['codigo', 'dono', 'origem', 'partes', 'titulo', 'totalLicoes']);
  assert.deepEqual(Object.keys(anonima.corpo.dono).sort(), ['cor', 'foto', 'nome', 'perfilId', 'resumo']);
  // Perfil rico (spec 10): resumo, interesses, foto e o alcance só das trilhas marcadas.
  assert.deepEqual(Object.keys(pagina.corpo).sort(), ['alcance', 'cor', 'foto', 'interesses', 'nome', 'resumo', 'trilhas']);
});

test('link encerrado e inexistente respondem igual; parar não apaga cópias; apagar a trilha encerra o link', async () => {
  const dona = await pessoa();
  const quem = await pessoa();
  await salvarNome(dona);
  const plano = await trilha(dona);
  const { codigo } = (await criarLink(dona, plano.id)).corpo;
  const { planoId: copiaId } = (await adicionar(quem, codigo)).corpo;

  const parar = await json(linkDelete(pedido(`/api/compartilhar/${codigo}`, { metodo: 'DELETE', token: dona.token }), ctx({ codigo })));
  assert.equal(parar.status, 200);
  const encerrado = await previaPublica(codigo);
  const inexistente = await previaPublica('ZZZZZZZZZZZZZZZZ');
  const malformado = await previaPublica('curto');
  assert.equal(encerrado.status, 404);
  assert.deepEqual(encerrado, inexistente);
  assert.deepEqual(encerrado, malformado);
  assert.equal(encerrado.corpo.codigo, 'link_inativo');
  assert.ok(await banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId: quem.id, id: copiaId } } }), 'a cópia continua');
  const detalhe = (await json(planoGet(pedido(`/api/aprendizado/planos/${copiaId}`, { token: quem.token }), ctx({ id: copiaId })))).corpo;
  assert.equal(detalhe.recebida.codigoAtivo, null, 'o link original não está mais ativo');

  const { codigo: novo } = (await criarLink(dona, plano.id)).corpo;
  assert.notEqual(novo, codigo, 'compartilhar de novo cria outro link');
  assert.equal((await json(planoDelete(pedido(`/api/aprendizado/planos/${plano.id}`, { metodo: 'DELETE', token: dona.token }), ctx({ id: plano.id })))).status, 200);
  assert.equal(await banco.linkTrilha.count({ where: { codigo: novo } }), 0, 'apagar a trilha apaga o link');
  assert.deepEqual(await previaPublica(novo), inexistente);
});

test('perfil público só existe com uma trilha marcada; o nome da trilha recebida leva a ele só então', async () => {
  const dona = await pessoa();
  const quem = await pessoa();
  const perfil = (await salvarNome(dona, 'Ana')).corpo;
  const plano = await trilha(dona);
  const { codigo } = (await criarLink(dona, plano.id)).corpo;
  const { planoId } = (await adicionar(quem, codigo)).corpo;
  const verPerfil = () => json(perfisGet(pedido(`/api/perfis/${perfil.perfilId}`), ctx({ perfilId: perfil.perfilId })));
  assert.equal((await verPerfil()).status, 404);
  assert.equal((await json(planosGet(pedido('/api/aprendizado/planos', { token: quem.token })))).corpo[0].recebida.perfilId, null);
  await linkPatch(pedido(`/api/compartilhar/${codigo}`, { metodo: 'PATCH', token: dona.token, corpo: { noPerfil: true } }), ctx({ codigo }));
  const publico = await verPerfil();
  assert.equal(publico.status, 200);
  assert.deepEqual(publico.corpo.trilhas.map((t) => t.codigo), [codigo]);
  assert.equal((await json(planosGet(pedido('/api/aprendizado/planos', { token: quem.token })))).corpo.find((p) => p.id === planoId).recebida.perfilId, perfil.perfilId);
});

test('trilha de material: a cópia não leva o nome do arquivo, o materialId nem foto de página, e a aula diz "material de Ana"', async () => {
  const dona = await pessoa();
  const quem = await pessoa();
  await salvarNome(dona, 'Ana');
  const plano = await trilha(dona);
  const material = randomUUID();
  const fluxo = plano.fluxos[0];
  // Lições como as do Estúdio: referência ao material, foto da página e origem com o nome do arquivo.
  for (const [indice, { id }] of fluxo.licoes.entries()) {
    const licao = await banco.licao.findUnique({ where: { usuarioId_id: { usuarioId: dona.id, id } } });
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    void indice;
    await banco.licao.update({
      where: { usuarioId_id: { usuarioId: dona.id, id } },
      data: { conteudo: {
        ...licao.conteudo,
        origem: 'Material enviado · apostila-secreta.pdf',
        recurso: { tipo: 'imagem', src, descricao: 'Página 1' },
        referencias: [{ materialId: material, nome: 'apostila-secreta.pdf', pagina: 2, trecho: 'O denominador indica em quantas partes iguais o inteiro foi dividido.', leitura: 'texto' }],
      } },
    });
  }
  await banco.planoAprendizado.update({ where: { usuarioId_id: { usuarioId: dona.id, id: plano.id } }, data: { titulo: 'Estudar apostila-secreta.pdf', origem: 'Material enviado · apostila-secreta.pdf' } });

  const folha = (await json(previaGet(pedido(`/api/aprendizado/planos/${plano.id}/compartilhar`, { token: dona.token }), ctx({ id: plano.id })))).corpo;
  assert.equal(folha.deMaterial, true);
  assert.equal(folha.tituloTemNomeDoArquivo, true);
  const { codigo } = (await criarLink(dona, plano.id)).corpo;
  const previa = (await previaPublica(codigo)).corpo;
  assert.equal(previa.origem, 'Material de Ana');

  const { planoId } = (await adicionar(quem, codigo)).corpo;
  const copia = await banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId: quem.id, id: planoId } } });
  assert.equal(copia.origem, 'Material de Ana');
  const licoes = await banco.licao.findMany({ where: { usuarioId: quem.id, fluxoId: { startsWith: planoId } } });
  const texto = JSON.stringify(licoes.map((l) => l.conteudo));
  assert.ok(!texto.includes('data:image'), 'nenhuma foto de página');
  assert.ok(!texto.includes(material), 'nenhum materialId de verdade');
  assert.ok(!texto.includes('Material enviado'));
  // O título é o único lugar onde o nome do arquivo pode ir, e a folha avisa isso (tituloTemNomeDoArquivo).
  assert.ok(!texto.includes('apostila-secreta'), 'o nome do arquivo não vai nas lições');
  const comReferencia = licoes.filter((l) => l.conteudo.referencias);
  assert.ok(comReferencia.length > 0);
  for (const l of comReferencia) {
    assert.deepEqual(l.conteudo.referencias, [{ materialId: MATERIAL_COMPARTILHADO, nome: 'Material de Ana', pagina: 2, trecho: 'O denominador indica em quantas partes iguais o inteiro foi dividido.', leitura: 'texto' }]);
    assert.equal(l.conteudo.origem, 'Material de Ana');
    assert.ok(!l.conteudo.recurso, 'a lição fica sem o recurso de imagem (data URL ou endereço) e continua válida');
  }
  const aula = (await json(licaoGet(pedido(`/api/aprendizado/licoes/${comReferencia[0].id}`, { token: quem.token }), ctx({ id: comReferencia[0].id })))).corpo;
  assert.equal(aula.materialDe, 'Ana');
  assert.equal(aula.referencias[0].materialId, MATERIAL_COMPARTILHADO);
});

test('teto de links ativos por conta', async () => {
  const dona = await pessoa();
  await salvarNome(dona);
  const plano = await trilha(dona);
  for (let i = 0; i < LINKS_ATIVOS_MAX; i += 1) {
    const id = `teto-${i}-${randomUUID()}`;
    await banco.planoAprendizado.create({ data: { usuarioId: dona.id, id, titulo: 'T', objetivo: 'T', origem: 'T' } });
    await banco.linkTrilha.create({ data: { codigo: `t${i}${randomUUID().replace(/-/g, '')}`.slice(0, 16), usuarioId: dona.id, planoId: id } });
  }
  assert.equal((await criarLink(dona, plano.id)).corpo.codigo, 'limite_compartilhar');
});

test('limite das rotas públicas: sem endereço confiável é um disjuntor global; com o proxy, 120 por endereço', async () => {
  const dona = await pessoa();
  await salvarNome(dona);
  const plano = await trilha(dona);
  const { codigo } = (await criarLink(dona, plano.id)).corpo;
  const abrir = (ip) => linkGet(new Request(`${origem}/api/compartilhar/${codigo}`, { headers: { origin: origem, ...(ip ? { 'x-forwarded-for': ip } : {}) } }), ctx({ codigo }));
  delete process.env.STUDOO_PROXY_HTTPS;
  for (let i = 0; i < 121; i += 1) assert.equal((await abrir()).status, 200, `abertura ${i + 1} sem o proxy`);
  process.env.STUDOO_PROXY_HTTPS = '1';
  try {
    for (let i = 0; i < 120; i += 1) assert.equal((await abrir('203.0.113.7')).status, 200);
    const barrada = await json(abrir('203.0.113.7'));
    assert.deepEqual([barrada.status, barrada.corpo.codigo], [429, 'limite_compartilhar']);
    assert.equal((await abrir('203.0.113.8')).status, 200, 'outro endereço segue livre');
  } finally {
    delete process.env.STUDOO_PROXY_HTTPS;
  }
});

test('nenhum recurso de imagem vai na cópia, seja data URL ou endereço do servidor; os outros recursos vão', () => {
  const base = { objetivo: 'O', conceito: 'C', exemplo: 'E', origem: 'IA', exercicio: { tipo: 'lacuna', enunciado: 'x', gabarito: ['a'], feedbackCorreto: 'a', feedbackIncorreto: 'b' } };
  for (const src of ['data:image/png;base64,iVBORw0KGgo=', '/api/estudio/materiais/abc/paginas/1', 'https://exemplo.com/foto.png']) {
    assert.equal(conteudoParaCopia({ ...base, recurso: { tipo: 'imagem', src, descricao: 'Página 1' } }, 'Ana').recurso, undefined, src);
  }
  const acorde = { tipo: 'acorde', nome: 'Am', casas: [-1, 0, 2, 2, 1, 0] };
  assert.deepEqual(conteudoParaCopia({ ...base, recurso: acorde }, 'Ana').recurso, acorde);
});
