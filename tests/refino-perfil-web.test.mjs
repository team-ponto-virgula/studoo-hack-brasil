// Refinamento da UI (spec 16), o Perfil na web. Item 32: "compartilhar" é ter um link (só quem o recebe abre) e "postar" é aparecer no perfil;
// os dois termos ficam, cada um com o seu sentido, em textos do contrato (as três plataformas leem os mesmos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mensagens } from '@studoo/contratos/experiencia';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const p = mensagens.perfil;

test('item 32: o título da seção fala de link, com o total, e a linha de baixo explica como aparecer no perfil', () => {
  assert.equal(p.compartilhadas, 'Trilhas com link');
  assert.equal(p.compartilhadasTotal(1), 'Trilhas com link (1)');
  assert.equal(p.compartilhadasTotal(3), 'Trilhas com link (3)');
  assert.equal(p.compartilhadasLinha, 'Só quem tem o link abre. Para aparecer no seu perfil, use “Postar trilha no perfil”.');
  // O botão citado existe com este nome (a linha promete o que a tela tem).
  assert.equal(p.postar.botao, 'Postar trilha no perfil');
  // Sem a comunidade, o caminho é a chave de cada trilha, que também existe com este nome.
  assert.equal(p.compartilhadasLinhaSemComunidade, 'Só quem tem o link abre. Para aparecer no seu perfil, marque “Mostrar no meu perfil”.');
  assert.equal(mensagens.compartilhar.noPerfil, 'Mostrar no meu perfil');
});

test('item 32: o perfil vazio diz "Privado: nenhuma trilha está postada…" e o caminho para aparecer nele', () => {
  const frase = (dica) => `${p.privado} ${dica}`;
  assert.equal(frase(p.perfilPrivadoDica), 'Privado: nenhuma trilha está postada no seu perfil. Para aparecer nele, use “Postar trilha no perfil”.');
  assert.equal(frase(p.perfilPrivadoDicaSemComunidade), 'Privado: nenhuma trilha está postada no seu perfil. Para aparecer nele, marque “Mostrar no meu perfil” em ao menos uma trilha.');
});

test('item 32: ninguém mais diz "compartilha" para o que é postar, e a linha só aparece quando há trilhas com link', () => {
  const textos = JSON.stringify([p.compartilhadas, p.compartilhadasTotal(2), p.compartilhadasLinha, p.compartilhadasLinhaSemComunidade, p.privado, p.perfilPrivadoDica, p.perfilPrivadoDicaSemComunidade]);
  assert.doesNotMatch(textos, /Trilhas que você compartilha|Nenhuma trilha aparece|compartilhar o perfil/);
  const tela = ler('src/app/perfil.tsx');
  assert.match(tela, /perfil\.links\.length > 0 && <p className="folha-texto perfil-secao__linha">\{postagem \? p\.compartilhadasLinha : p\.compartilhadasLinhaSemComunidade\}<\/p>/);
  assert.match(tela, /perfil\.links\.length > 0 \? p\.compartilhadasTotal\(perfil\.links\.length\) : p\.compartilhadas/, 'o título com o total, ou sem ele quando não há trilhas');
});
