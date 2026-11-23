// Refinamento da UI (spec 16), lote 3, a ponte na web. Item 27: nas lições feitas de material, a ponte mostra o recolhível "De onde veio esta ideia" (a citação do material), fechado, depois do cartão do
// passo e antes de "Voltar ao exercício", como o app. Lição sem material não o mostra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mensagens } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { PonteReforco } = await import('../src/app/ponte-reforco.tsx');
const m = mensagens.estudio;

const ponte = {
  motivo: 'Você somou os de cima e os de baixo.', conceito: 'O denominador conta as partes iguais.', exemplo: 'Numa pizza de 8 fatias, comer 3 é 3/8.',
  exercicio: { tipo: 'multipla_escolha', enunciado: 'Em 5/6, o que o 6 indica?', opcoes: [{ id: 'a', texto: 'As partes escolhidas' }, { id: 'b', texto: 'O total de partes iguais' }] },
};
const origemDoMaterial = createElement('details', { className: 'estudio-card' },
  createElement('summary', null, m.origem), createElement('blockquote', null, createElement('strong', null, 'Frações.pdf · Página 3'), createElement('p', null, 'O denominador diz em quantas partes iguais o inteiro foi dividido.')));
const desenhar = (extra = {}) => renderToStaticMarkup(createElement(PonteReforco, {
  ponte, tentativa: '1/2', feedbackOriginal: 'Conte de novo.', ocupado: false, erro: '', tentarCarregar() {}, verificar: async () => undefined, voltar() {}, ...extra,
}));

test('item 27: "De onde veio esta ideia" é o texto do contrato, o mesmo do recolhível do exercício', () => {
  assert.equal(m.origem, 'De onde veio esta ideia');
});

test('item 27: na ponte de uma lição feita de material, o recolhível vem depois do cartão do passo e antes de "Voltar ao exercício", fechado', () => {
  const html = desenhar({ origem: origemDoMaterial });
  const cartao = html.indexOf('reforco__cartao');
  const origem = html.indexOf(`<summary>${m.origem}</summary>`);
  const voltar = html.indexOf(m.ponteVoltarExercicio);
  const rodape = html.indexOf('reforco__rodape');
  assert.ok(cartao > 0 && origem > cartao, 'depois do cartão do passo');
  assert.ok(voltar > origem, 'antes de "Voltar ao exercício"');
  assert.ok(rodape > voltar, 'o rodapé preso da ponte segue por último');
  assert.doesNotMatch(html.slice(origem - 60, origem), /<details[^>]*\sopen/, 'fechado');
  assert.match(html, /Frações\.pdf · Página 3/, 'a citação do material está dentro do recolhível');
});

test('item 27: lição sem material não mostra o recolhível na ponte', () => {
  const html = desenhar();
  assert.doesNotMatch(html, new RegExp(m.origem));
  assert.match(html, new RegExp(m.ponteVoltarExercicio), 'o resto da ponte segue igual');
});

test('item 27: o estudo monta o recolhível uma vez só (com a guarda das referências) e o usa sob o exercício e na ponte', () => {
  const fonte = ler('src/app/estudio.tsx');
  assert.equal((fonte.match(/<summary>\{m\.origem\}<\/summary>/g) ?? []).length, 1, 'um único desenho do recolhível');
  assert.match(fonte, /const cartaoOrigem = !!licao\.referencias\?\.length && \(\s*<details className="estudio-card">\s*<summary>\{m\.origem\}<\/summary>/, 'só com referências (lição de material)');
  assert.match(fonte, /<PonteReforco key=\{pedidoPonte\}[^>]*origem=\{cartaoOrigem \|\| undefined\}/, 'a ponte recebe o recolhível');
  assert.match(fonte, /\{cartaoOrigem\}\s*\{ultimo && <details/, 'sob o exercício continua no mesmo lugar, antes do "Explique"');
  const ponteFonte = ler('src/app/ponte-reforco.tsx');
  assert.match(ponteFonte, /<\/div>\s*\{origem\}\s*\{!concluida && <Botao variante="texto" onClick=\{voltar\}>\{m\.ponteVoltarExercicio\}<\/Botao>\}/, 'entre o cartão e "Voltar ao exercício"');
});
