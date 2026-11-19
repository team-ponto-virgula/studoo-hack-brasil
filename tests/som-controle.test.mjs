// Controle de som na web (spec 12): a folha "Som", o botão da aula e a seção do Perfil; textos e estados pelo contrato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mensagens } from '@studoo/contratos/experiencia';
import { OPCOES_FUNDO_UI } from '../packages/contratos/src/catalogo-sons.ts';

const raiz = resolve(import.meta.dirname, '..');
const t = mensagens.som;
// Os componentes importam CSS (pelo ../ui e pelo compartilhar): no Node, cada .css vira um módulo vazio.
register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const { BotaoSom, FolhaSom, SecaoSomPerfil, ChaveStudoo } = await import('../src/app/som.tsx');

test('a folha tem Mudo e os cinco climas, nesta ordem, num grupo de escolha única com Mudo marcado', () => {
  const html = renderToStaticMarkup(createElement(FolhaSom, { aoFechar() {} }));
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /role="radiogroup"/);
  const radios = [...html.matchAll(/role="radio" aria-checked="(true|false)" aria-label="([^"]+)"/g)];
  assert.deepEqual(radios.map(([, , rotulo]) => rotulo), OPCOES_FUNDO_UI.map((o) => t.linhaRotulo(o.rotulo, o.descricao)));
  assert.deepEqual(OPCOES_FUNDO_UI.map((o) => o.rotulo), ['Mudo', 'Foco Calmo', 'Chuva Suave', 'Lo-fi de Estudo', 'Biblioteca', 'Brisa Natural']);
  assert.equal(radios.filter(([, marcado]) => marcado === 'true').length, 1);
  assert.equal(radios[0][1], 'true', 'padrão: Mudo');
  assert.match(html, /tabindex="0"[^>]*>|role="radio" aria-checked="true"[^>]*tabindex="0"/, 'só a marcada entra na ordem de Tab');
  assert.match(html, new RegExp(t.fundoDica));
  assert.match(html, new RegExp(t.rodape));
  assert.match(html, /role="switch" aria-checked="true"/, 'efeitos ligados por padrão, na chave do Studoo');
  assert.doesNotMatch(html, /type="checkbox"|type="radio"/, 'nenhum controle do sistema');
});

test('as descrições curtas cabem numa linha (as da spec 12)', () => {
  assert.deepEqual(OPCOES_FUNDO_UI.map((o) => o.descricao), [
    'Sem som de fundo', 'Acordes suaves e quentes', 'Chuva leve na janela', 'Batida lenta e abafada', 'Ambiente quieto, bom para ler', 'Vento suave entre as folhas',
  ]);
});

test('o botão da aula diz o estado do som e abre a folha (aria-haspopup)', () => {
  const html = renderToStaticMarkup(createElement(BotaoSom));
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-label="Som: fundo mudo, efeitos ligados"/);
  assert.equal(t.botaoRotulo({ clima: 'Chuva Suave', efeitos: true }), 'Som: Chuva Suave, efeitos ligados');
  assert.equal(t.botaoRotulo({ clima: 'Chuva Suave', efeitos: false }), 'Som: Chuva Suave, efeitos desligados');
  assert.equal(t.botaoRotulo({ clima: null, efeitos: false }), 'Som: tudo desligado');
  assert.equal(t.botaoRotulo({ clima: 'Chuva Suave', efeitos: true, motivo: 'sem_gesto' }), 'Som: Chuva Suave, começa no primeiro toque');
  assert.equal(t.botaoRotulo({ clima: 'Chuva Suave', efeitos: true, motivo: 'gravando' }), 'Som: Chuva Suave, pausado enquanto você grava');
  assert.equal(t.botaoRotulo({ clima: null, efeitos: true, novidade: true }), 'Som: fundo mudo, efeitos ligados, novidade');
});

test('a seção do Perfil: "Som de fundo" abre a folha e "Efeitos sonoros" tem a chave', () => {
  const html = renderToStaticMarkup(createElement(SecaoSomPerfil));
  assert.match(html, />Som<\/h2>/);
  assert.match(html, /aria-label="Som de fundo: Mudo"/);
  assert.match(html, /role="switch" aria-checked="true"/);
  assert.match(html, new RegExp(t.efeitosDicaPerfil));
  const desligada = renderToStaticMarkup(createElement(ChaveStudoo, { ligada: false, aoMudar() {}, rotuloId: 'x' }));
  assert.match(desligada, /role="switch" aria-checked="false" aria-labelledby="x"/);
});

test('ligado nas telas: botão no alto da aula, seção antes de Conta e o fundo só dentro do app', () => {
  const aula = readFileSync(join(raiz, 'src/app/aula.tsx'), 'utf8');
  const perfil = readFileSync(join(raiz, 'src/app/perfil.tsx'), 'utf8');
  const estudo = readFileSync(join(raiz, 'src/app/estudo.tsx'), 'utf8');
  assert.ok(aula.indexOf('<BotaoSom />') > aula.indexOf('className="aula-andamento"') && aula.indexOf('<BotaoSom />') < aula.indexOf('</header>'));
  assert.ok(perfil.indexOf('<SecaoSomPerfil />') < perfil.indexOf('aria-labelledby="perfil-conta"'));
  assert.match(estudo, /useAreaDoSom\(inicio === 'pronto'\)/);
  for (const publica of ['src/app/login/entrada.tsx', 'src/app/t/[codigo]/page.tsx', 'src/app/p/[id]/page.tsx']) {
    assert.doesNotMatch(readFileSync(join(raiz, publica), 'utf8'), /useAreaDoSom/, `${publica} não liga o fundo`);
  }
});
