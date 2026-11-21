import assert from 'node:assert/strict';
import { test } from 'node:test';
import { perfilComLink, salvarPostagem } from '../src/app/postar-estado.ts';

const pendente = { planoId: 'a', noPerfil: false, moderacao: 'pendente', codigo: 'linkA', adicoes: 3 };
const aprovado = { ...pendente, noPerfil: true, moderacao: 'aprovado', visibilidade: 'perfil' };
const perfil = { nome: 'Bia', perfilModeracao: 'aprovado', links: [], publico: false, alcance: { pessoas: 0, trilhas: 0, seguidores: 2 } };

test('postar pela primeira vez registra o link privado antes do PATCH e conserva a moderação', async () => {
  const eventos = [];
  const cliente = {
    criarLink: async id => { eventos.push(['POST', id]); return pendente; },
    definirVisibilidade: async (codigo, nivel) => { eventos.push(['PATCH', codigo, nivel]); return { ...pendente, noPerfil: true }; },
  };
  let estado = perfil;
  await salvarPostagem(cliente, 'a', undefined, true, link => { estado = perfilComLink(estado, 'a', link); });
  assert.deepEqual(eventos, [['POST','a'], ['PATCH','linkA','perfil']]);
  assert.equal(estado.links[0].noPerfil, true);
  assert.equal(estado.publico, false);
  assert.equal(perfilComLink(estado, 'a', aprovado).publico, true);
  for (const moderacao of ['pendente', 'recusado']) {
    assert.equal(perfilComLink({ ...estado, perfilModeracao: moderacao }, 'a', aprovado).publico, false);
    assert.equal(perfilComLink(estado, 'a', { ...aprovado, moderacao }).publico, false);
  }
});

test('uma falha no PATCH conserva o link e a chave desligada, e a repetição só precisa do PATCH', async () => {
  let estado = perfil;
  let criacoes = 0;
  const registrar = link => { estado = perfilComLink(estado, 'a', link); };
  const cliente = { criarLink: async () => { criacoes++; return pendente; }, definirVisibilidade: async () => { throw Error('teste de rede'); } };
  await assert.rejects(salvarPostagem(cliente, 'a', undefined, true, registrar), /teste de rede/);
  assert.equal(estado.links[0].noPerfil, false);
  cliente.definirVisibilidade = async () => aprovado;
  await salvarPostagem(cliente, 'a', estado.links[0], true, registrar);
  assert.equal(criacoes, 1);
  assert.equal(estado.links.length, 1);
  assert.equal(estado.publico, true);
});

test('tirar e desfazer mantêm código, tema e legenda do Explorar; os outros planos continuam como estavam', async () => {
  const original = { ...aprovado, visibilidade: 'explorar', tema: 'ciencias', legenda: 'Experimentos' };
  const outro = { ...aprovado, codigo: 'outro', planoId: 'b' };
  const pedidos = [];
  const cliente = { definirVisibilidade: async (codigo, nivel, opcoes) => { pedidos.push([codigo,nivel,opcoes]); return { ...original, noPerfil: nivel !== 'link', visibilidade: nivel }; } };
  let estado = { ...perfil, links: [outro, original] };
  const registrar = link => { estado = perfilComLink(estado, 'a', link); };
  const salvo = await salvarPostagem(cliente, 'a', original, false, registrar);
  assert.equal(estado.links[1].noPerfil, false);
  await salvarPostagem(cliente, 'a', salvo, true, registrar, original);
  assert.deepEqual(pedidos, [['linkA','link',undefined], ['linkA','explorar',{ tema:'ciencias', legenda:'Experimentos' }]]);
  assert.deepEqual(estado.links.map(t => t.codigo), ['outro','linkA']);
  assert.equal(estado.alcance.seguidores, 2);
});
