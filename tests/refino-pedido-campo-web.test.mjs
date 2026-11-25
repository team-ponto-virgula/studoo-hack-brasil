// Banca P2-5 (#82): o campo do pedido ("O que você quer aprender?") cortava o exemplo (o placeholder) com a letra a 150% e a 200% (o campo tinha duas linhas, e o exemplo pede três), e não crescia com o texto.
// Agora o campo cresce com o exemplo e com o texto (até meia tela, e depois rola por dentro): uma cópia invisível do texto, na mesma célula da grade que o campo, dá a altura.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const pedido = ler('src/app/pedido.tsx');
const css = ler('src/app/pedido.css');
// Um mesmo grupo pode atender ao campo e à réplica. Reúne a cascata dos seletores
// exatos, em vez de exigir que a declaração esteja duplicada em dois blocos.
const regra = (seletor) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, seletores]) => seletores.split(',').some((parte) => parte.trim() === seletor))
  .map(([, , corpo]) => corpo).join('\n');


test('o campo fica dentro de uma caixa que leva o texto (ou o exemplo, se vazio) para a cópia invisível', () => {
  assert.match(pedido, /<div className="pedido-campo__caixa" data-replica=\{objetivo \|\| mensagens\.inicio\.exemplo\} data-vazio=\{!objetivo \|\| undefined\}>\s*<textarea ref=\{campo\} id="objetivo"/);
  assert.match(pedido, /placeholder=\{mensagens\.inicio\.exemplo\}/, 'o exemplo continua sendo o placeholder do campo');
  assert.match(pedido, /onChange=\{evento => aoMudar\(evento\.target\.value\)\} \/>\s*<\/div>/, 'a caixa fecha logo depois do campo');
});

test('a caixa é uma grade de uma célula só: o campo e a cópia invisível dividem a célula, e a mais alta manda', () => {
  assert.match(regra('.pedido-novo .pedido-campo__caixa'), /display: grid;/);
  assert.match(css, /\.pedido-novo \.pedido-campo__caixa > textarea, \.pedido-novo \.pedido-campo__caixa::after \{ grid-area: 1 \/ 1; \}/);
  const copia = regra('.pedido-novo .pedido-campo__caixa::after');
  assert.match(copia, /content: attr\(data-replica\) ' ';/, 'o texto vem do atributo, com um espaço no fim (a última linha vazia conta)');
  assert.match(copia, /visibility: hidden; pointer-events: none;/, 'não aparece nem pega toque');
  assert.match(copia, /white-space: pre-wrap;\s*overflow-wrap: break-word;/, 'quebra as linhas como o campo');
  assert.match(copia, /box-sizing: border-box; max-height: 50svh; overflow: hidden;/, 'cresce até meia tela; passando disso o campo rola por dentro');
  assert.match(regra('.pedido-novo .pedido-campo__caixa[data-vazio]::after'), /font-weight: 600;/, 'vazio, a medida é a do exemplo (600, como o placeholder)');
});

test('a cópia repete a letra, o recuo e a borda do campo, no computador e no celular (senão a altura sai errada)', () => {
  const campo = regra('.pedido-novo .pedido-campo textarea');
  const copia = regra('.pedido-novo .pedido-campo__caixa::after');
  for (const propriedade of ['font-size', 'font-weight', 'line-height', 'padding']) {
    const doCampo = [...campo.matchAll(new RegExp(`${propriedade}: ([^;]+);`, 'g'))].at(-1)?.[1];
    const daCopia = [...copia.matchAll(new RegExp(`${propriedade}: ([^;]+);`, 'g'))].at(-1)?.[1];
    assert.ok(doCampo && daCopia, propriedade);
    assert.equal(daCopia, doCampo, `${propriedade}: a cópia e o campo têm o mesmo valor`);
  }
  assert.match(campo, /border: 1\.5px solid transparent;/);
  assert.match(campo, /border-color: var\(--borda-campo\);/);
  assert.match(copia, /border: 1\.5px solid transparent;/, 'a mesma espessura de borda do campo');
  // Jornada Azul usa a mesma anatomia nas larguras móveis e grandes; a réplica
  // compartilha a regra do campo, inclusive min-height e white-space.
  assert.match(copia, /min-height: 112px;/);
  assert.match(campo, /min-height: 112px;/);

});
