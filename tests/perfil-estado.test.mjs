import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { linksPublicosNoPerfil, perfilComLink } from '../packages/contratos/src/aprendizado.ts';
import { perfilComLink as estadoWeb } from '../src/app/postar-estado.ts';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

const perfil = { nome: 'Bia', perfilModeracao: 'aprovado', links: [], publico: false, alcance: { trilhas: 0, pessoas: 0, seguidores: 2 } };
const link = { planoId: 'a', codigo: 'linkA', noPerfil: true, moderacao: 'aprovado', visibilidade: 'perfil', adicoes: 3 };

test('perfil público: combinação da aprovação do perfil e da trilha, com a compatibilidade do contrato antigo', () => {
  for (const perfilModeracao of [undefined, 'pendente', 'recusado', 'aprovado']) {
    for (const moderacao of [undefined, 'pendente', 'recusado', 'aprovado']) {
      const anterior = { ...perfil, perfilModeracao };
      const novo = { ...link, moderacao };
      const publico = [undefined, 'aprovado'].includes(perfilModeracao) && [undefined, 'aprovado'].includes(moderacao);
      const atualizado = perfilComLink(anterior, novo.planoId, novo);
      assert.equal(atualizado.publico, publico, `perfil ${perfilModeracao}, link ${moderacao}`);
      assert.equal(linksPublicosNoPerfil(atualizado).length, Number(publico));
      assert.equal(atualizado.links[0].noPerfil, true, 'a intenção de publicar não é apagada pela revisão');
      assert.equal(atualizado.links[0].moderacao, moderacao, 'a atualização local não inventa aprovação');
      assert.equal(anterior.links.length, 0, 'não modifica o estado anterior');
    }
  }
  assert.equal(estadoWeb, perfilComLink, 'a web usa o mesmo helper exportado para o app');
});

test('o rótulo público conta só as trilhas aprovadas, preservando o alcance recebido e as trilhas em revisão da dona', () => {
  let atual = perfilComLink(perfil, 'a', link);
  atual = perfilComLink(atual, 'b', { ...link, codigo: 'linkB', planoId: 'b', moderacao: 'pendente', adicoes: 4 });
  atual = perfilComLink(atual, 'c', { ...link, codigo: 'linkC', planoId: 'c', moderacao: 'recusado', adicoes: 5 });
  assert.equal(atual.publico, true);
  assert.equal(mensagens.perfil.publico(linksPublicosNoPerfil(atual).length), 'Público. 1 trilha aparece no seu perfil, para quem tiver o endereço dele.');
  assert.deepEqual(atual.alcance, { trilhas: 3, pessoas: 12, seguidores: 2 }, 'o alcance da dona segue o contrato do servidor');
  atual = perfilComLink(atual, 'a', { ...link, noPerfil: false, visibilidade: 'link' });
  assert.equal(atual.publico, false, 'links em revisão ou recusados não mantêm o perfil público');
  assert.equal(linksPublicosNoPerfil(atual).length, 0);
});

test('tirar, desfazer e encerrar um link recalculam o perfil sem alterar outros planos nem perder a moderação', () => {
  const original = { ...link, visibilidade: 'explorar', tema: 'ciencias', legenda: 'Experimentos' };
  const outro = { ...link, planoId: 'b', codigo: 'linkB', moderacao: 'pendente' };
  let atual = perfilComLink({ ...perfil, links: [outro] }, 'a', original);
  assert.equal(atual.publico, true);
  atual = perfilComLink(atual, 'a', { ...original, noPerfil: false, visibilidade: 'link' });
  assert.equal(atual.publico, false);
  atual = perfilComLink(atual, 'a', original);
  assert.equal(atual.publico, true);
  assert.deepEqual(atual.links.map(item => item.codigo), ['linkA', 'linkB']);
  assert.equal(atual.links[0].tema, original.tema);
  assert.equal(atual.links[0].legenda, original.legenda);
  atual = perfilComLink(atual, 'a', null);
  assert.equal(atual.publico, false);
  assert.deepEqual(atual.links, [outro]);
  for (const moderacao of ['pendente', 'recusado']) {
    const restaurado = perfilComLink(atual, 'a', { ...original, moderacao });
    assert.equal(restaurado.publico, false, 'desfazer não aprova um link');
  }
});

// Executa os handlers reais dos componentes com setState em memória: garante que o caminho antigo de alterarLink,
// a folha nova e o atalho de Minhas trilhas usam a mesma regra, sem precisar renderizar câmera ou navegação nativas.
async function montarHandler(caminho, nome, argumentos) {
  const fonte = ts.createSourceFile(caminho, await readFile(new URL(`../${caminho}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let corpo;
  const procurar = (no) => {
    if (ts.isFunctionDeclaration(no) && no.name?.text === nome) corpo = no.getText(fonte);
    ts.forEachChild(no, procurar);
  };
  procurar(fonte);
  assert.ok(corpo, `handler ${nome}`);
  const codigo = ts.transpileModule(`export function executar(inicial: any, antigo: any, novo: any) {
    let estado = inicial;
    const setPerfil = (atualizar: any) => { estado = atualizar(estado); };
    const aoMudarLink = () => {};
    const mudarLink = () => {};
    ${corpo}
    ${nome}(${argumentos});
    return estado;
  }`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const modulo = { exports: {}, perfilComLink };
  vm.runInNewContext(codigo, modulo);
  return modulo.exports.executar;
}

for (const [caminho, nome, argumentos] of [
  ['apps/mobile/src/perfil.tsx', 'trocarLink', 'antigo, novo'],
  ['apps/mobile/src/perfil.tsx', 'aplicarLink', 'antigo.planoId, novo'],
  ['apps/mobile/src/estudo.tsx', 'aplicarLinkNoPerfil', 'antigo.planoId, novo'],
]) {
  test(`app: ${nome} preserva aprovação, retirada e desfazer no estado exibido`, async () => {
    const executar = await montarHandler(caminho, nome, argumentos);
    for (const moderacao of ['pendente', 'recusado', 'aprovado']) {
      let atual = executar(perfil, link, { ...link, moderacao });
      assert.equal(atual.publico, moderacao === 'aprovado');
      const postagem = atual.links[0];
      atual = executar(atual, postagem, { ...postagem, noPerfil: false, visibilidade: 'link' });
      assert.equal(atual.publico, false);
      atual = executar(atual, postagem, postagem);
      assert.equal(atual.publico, moderacao === 'aprovado', 'desfazer preserva a decisão da moderação');
    }
    for (const perfilModeracao of ['pendente', 'recusado']) {
      assert.equal(executar({ ...perfil, perfilModeracao }, link, link).publico, false);
    }
    if (nome === 'trocarLink') {
      assert.equal(executar({ ...perfil, links: [link], publico: true }, link, null).publico, false, 'encerrar o último link retira o perfil público');
    }
  });
}
