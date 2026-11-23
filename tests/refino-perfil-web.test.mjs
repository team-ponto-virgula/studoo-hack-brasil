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

test('item 19: a política de privacidade do Studoo sai de "Privacidade e dados" (inclusive da lista "Ver quem recebe") e fica só em "Ajuda"', () => {
  const secao = ler('src/app/privacidade-perfil.tsx');
  assert.doesNotMatch(secao, /t\.politica\b|CAMINHO_POLITICA/, 'a seção não tem mais o link da política do Studoo');
  assert.match(secao, /<ListaProvedores estado=\{estado\} semPoliticaDoStudoo \/>/, 'a lista "Ver quem recebe" também fica sem ele');
  const lista = ler('src/app/aceite-ia.tsx');
  assert.match(lista, /\{!semPoliticaDoStudoo && <a href=\{estado\.politica \|\| CAMINHO_POLITICA\} target="_blank" rel="noopener">\{t\.politica\}<\/a>\}/, 'a lista segue com o link no cartão de aceite (o padrão é mostrar)');
  assert.match(lista, /semPoliticaDoStudoo = false/);
  const perfil = ler('src/app/perfil.tsx');
  assert.match(perfil, /<Link href=\{mensagens\.seguranca\.rotas\.politica\}>\{mensagens\.seguranca\.politica\}<Icone nome="seta" \/><\/Link>/, '"Ajuda" tem a política');
  // Na seção sobram "Ver quem recebe" e o "Permitir o uso de IA" (ou a chave, conforme o estado), os dois secundários.
  assert.match(secao, /<Botao variante="secundario" aria-expanded=\{verQuem\} onClick=\{\(\) => setVerQuem\(\(v\) => !v\)\}>\{t\.verQuem\}<\/Botao>/);
  assert.match(secao, /\{t\.revogar\}<\/Botao>\s*: <Botao variante="secundario" disabled=\{ocupado\} onClick=\{\(\) => void mudarAceite\(true\)\}>\{t\.permitirAgora\}<\/Botao>/);
});

test('item 20: "Excluir conta" é o botão secundário de 44 px, com borda e texto #C23B4E, depois de "Sair" na seção "Conta" (antes, um texto vermelho solto em "Privacidade e dados")', () => {
  const perfil = ler('src/app/perfil.tsx');
  const sair = perfil.indexOf('<Botao variante="secundario" onClick={sair}>{mensagens.sair}</Botao>');
  const excluir = perfil.indexOf('<BotaoExcluirConta visitante={visitante} />');
  assert.ok(sair > 0 && excluir > sair, '"Excluir conta" vem depois de "Sair"');
  assert.ok(perfil.indexOf('</section>', sair) > excluir, 'na mesma seção "Conta"');
  const secao = ler('src/app/privacidade-perfil.tsx');
  assert.match(secao, /<Botao variante="secundario" className="privacidade-excluir" onClick=\{\(\) => setExcluindo\(true\)\}>\{t\.excluir\}<\/Botao>/, 'secundário, não mais de texto');
  assert.doesNotMatch(secao.slice(0, secao.indexOf('export function BotaoExcluirConta')), /privacidade-excluir/, 'a seção de privacidade não tem mais o botão');
  const css = ler('src/app/privacidade.css');
  assert.match(css, /\.botao\.privacidade-excluir \{ height: 44px; min-height: 44px; padding-block: 0; border-color: #c23b4e; color: #c23b4e; \}/);
  assert.doesNotMatch(css, /\.privacidade-excluir \{ color: var\(--erro\); \}/, 'o texto vermelho solto saiu');
});

