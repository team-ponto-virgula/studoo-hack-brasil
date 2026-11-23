// Banca (P0-3): a trilha recebida de quem excluiu a conta (ou parou de compartilhar) chega com `recebida.nome` vazio. A tela escrevia "Esta trilha é de " e
// "Compartilhada por " sem ninguém, e as configurações liberavam "Quem pode ver" numa trilha que não é da pessoa. O servidor segue mandando `recebida` (é ela que
// esconde Compartilhar e Postar); quem decide mostrar ou esconder a frase é `recebidaTemNome`, do contrato, e os clientes a seguem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { recebidaTemNome } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('recebidaTemNome: sem nome (vazio ou só espaços) não há frase "de <nome>"; com nome há', () => {
  assert.equal(recebidaTemNome({ nome: 'Ana' }), true);
  assert.equal(recebidaTemNome({ nome: ' Ana ' }), true);
  assert.equal(recebidaTemNome({ nome: '' }), false);
  assert.equal(recebidaTemNome({ nome: '   ' }), false);
  // O que o servidor manda quando a dona excluiu a conta (tests/privacidade.test.mjs confere o corpo real da API).
  assert.equal(recebidaTemNome({ nome: '', perfilId: null, codigoAtivo: null, foto: null }), false);
});

test('o texto das configurações para a trilha recebida sem nome não repete um nome que não existe', () => {
  const k = mensagens.configuracoes;
  assert.equal(k.recebida('Ana'), 'Trilha adicionada de Ana. As mudanças valem só para a sua cópia; a original continua como Ana deixou.');
  assert.equal(k.recebidaSemNome, 'Trilha adicionada da comunidade. As mudanças valem só para a sua cópia; a original continua como está.');
  assert.doesNotMatch(k.recebidaSemNome, /\$\{|undefined|\s{2,}/);
});

test('web: o mapa e o cartão não escrevem a frase sem nome, mas a trilha continua recebida (sem Compartilhar nem Postar)', () => {
  const tela = ler('src/app/estudo.tsx');
  // A linha do mapa: só aparece com nome (ou com o link original, que sozinho ainda diz algo útil); o "Esta trilha é de" só com nome.
  assert.match(tela, /plano\.recebida && \(recebidaTemNome\(plano\.recebida\) \|\| plano\.recebida\.codigoAtivo\) \? \(\s*<p className="trilha-recebida">/);
  assert.match(tela, /\{recebidaTemNome\(plano\.recebida\) && <span>\{plano\.recebida\.perfilId/);
  // O selo "Compartilhada por" do cartão some sem nome.
  assert.match(tela, /if \(!recebidaTemNome\(plano\.recebida\)\) return null;\s*const texto = mensagens\.compartilhar\.compartilhadaPor\(nome\);/);
  // Quem é "recebida" continua sendo o objeto (não o nome): Compartilhar segue escondido no mapa (o "•••" do alto do mapa saiu: spec 16, item 26; o "Postar" mora nos cartões de Minhas trilhas, que não o oferecem à recebida).
  assert.match(tela, /!plano\.recebida && compartilhar && \(/);
  assert.doesNotMatch(tela.slice(tela.indexOf('function Plano('), tela.indexOf('/** Anel de progresso do plano')), /MenuCartao/);
  assert.match(tela, /compartilhar=\{abrirFolha && !tela\.plano\.recebida \? \(\) => abrirFolha\(tela\.plano\.id\) : undefined\}/);
  // As configurações recebem "" (recebida sem nome), não null (da própria pessoa).
  assert.match(tela, /recebidaDe=\{resumo\?\.recebida \? resumo\.recebida\.nome : null\}/);
});

test('web: as configurações da trilha recebida sem nome mostram o aviso sem nome e escondem "Quem pode ver"', () => {
  const tela = ler('src/app/configuracoes.tsx');
  assert.match(tela, /const recebida = recebidaDe !== null && recebidaDe !== undefined;/);
  assert.match(tela, /\{recebida && <p className="configuracoes__recebida" role="note">\{recebidaDe \? k\.recebida\(recebidaDe\) : k\.recebidaSemNome\}<\/p>\}/);
  assert.match(tela, /\{compartilhar && !recebida && \(/);
  assert.doesNotMatch(tela, /!recebidaDe/, 'nada decide pela verdade do nome: "" é uma trilha recebida');
});
