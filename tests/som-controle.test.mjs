// Controle de som na web (spec 12): a folha "Som", o botão da aula e a seção do Perfil; textos e estados pelo contrato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mensagens } from '@studoo/contratos/experiencia';
import { fundoUnicoDaPreferencia, PADRAO_PREFERENCIAS_SOM } from '../packages/contratos/src/catalogo-sons.ts';

const raiz = resolve(import.meta.dirname, '..');
const t = mensagens.som;
// Os componentes importam CSS (pelo ../ui e pelo compartilhar): no Node, cada .css vira um módulo vazio.
register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const { BotaoSom, FolhaSom, SecaoSomPerfil, ChaveStudoo } = await import('../src/app/som.tsx');

test('folha e perfil expõem as duas chaves independentes e identificam a faixa única', () => {
  for (const [Componente, props] of [[FolhaSom, { aoFechar() {} }], [SecaoSomPerfil, {}]]) {
    const html = renderToStaticMarkup(createElement(Componente, props));
    assert.equal((html.match(/role="switch" aria-checked="true"/g) ?? []).length, 2);
    assert.match(html, /Música de fundo/);
    assert.match(html, /Lo-fi de Estudo, em laço/);
    assert.match(html, /Efeitos sonoros/);
    assert.doesNotMatch(html, /role="radio|type="checkbox"|novidade|Chuva Suave/);
    assert.match(html, /role="status"/);
  }
  const folha = renderToStaticMarkup(createElement(FolhaSom, { aoFechar() {} }));
  assert.match(folha, /role="dialog" aria-modal="true"/);
  assert.ok(folha.includes(t.rodapeMusica));
  assert.match(folha, /acessorio-fone/);
  assert.match(renderToStaticMarkup(createElement(ChaveStudoo, { ligada: false, aoMudar() {}, rotuloId: 'x' })),
    /role="switch" aria-checked="false" aria-labelledby="x"/);
});

test('o primeiro acesso e os fundos antigos ligados recebem o Lo-fi; Mudo continua silencioso', () => {
  assert.deepEqual(PADRAO_PREFERENCIAS_SOM, { efeitosAtivos: true, fundo: 'lofi_estudo' });
  for (const anterior of [null, 'foco_calmo', 'chuva_suave', 'lofi_estudo', 'biblioteca', 'brisa_natural']) {
    assert.equal(fundoUnicoDaPreferencia(anterior), 'lofi_estudo');
  }
  assert.equal(fundoUnicoDaPreferencia('mudo'), 'mudo');
});

test('o botão da aula anuncia o estado das duas chaves e abre a folha', () => {
  const html = renderToStaticMarkup(createElement(BotaoSom));
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-label="Som: música começa no primeiro toque"/);
  assert.equal(t.botaoMusicaRotulo(true, false), 'Som: música ligada, efeitos desligados');
  assert.equal(t.botaoMusicaRotulo(false, true), 'Som: música desligada, efeitos ligados');
  assert.equal(t.botaoMusicaRotulo(true, true, 'gravando'), 'Som: música pausada enquanto você grava');
});

test('um layout comum conserva a reprodução entre a entrada e a aula', () => {
  const fonte = arq => readFileSync(join(raiz, 'src/app', arq), 'utf8');
  assert.match(fonte('layout.tsx'), /<AmbienteSom \/>/);
  assert.doesNotMatch(fonte('login/entrada.tsx'), /window\.location\.replace/);
  assert.doesNotMatch(fonte('estudo.tsx'), /useAreaDoSom|window\.location\.replace/);
  assert.match(fonte('aula.tsx'), /<BotaoSom \/>/);
  assert.ok(fonte('perfil.tsx').indexOf('<SecaoSomPerfil />') < fonte('perfil.tsx').indexOf('aria-labelledby="perfil-conta"'));
});
