// A reação do Stu mora no painel de retorno (spec 13, emenda de 19/11): a faixa do corpo saiu, o Stu fica no painel com a
// expressão de cada estado, sai no painel compacto e o painel tem no máximo metade da tela (só o texto rola).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const aula = readFileSync(join(raiz, 'src/app/aula.tsx'), 'utf8');
const css = readFileSync(join(raiz, 'src/app/aula.css'), 'utf8');

test('a faixa de reação do corpo saiu (todos os estados) e os textos stuEstado deixaram de ser usados', () => {
  assert.doesNotMatch(aula, /aula-stu-estado/);
  assert.doesNotMatch(aula, /t\.stuEstado/);
  assert.doesNotMatch(css, /\.aula-stu-estado/);
});

test('o Stu fica no painel, com a expressão de cada estado, e sai no painel compacto', () => {
  const painel = aula.slice(aula.indexOf('<section className="aula-retorno"'), aula.indexOf('</section>', aula.indexOf('<section className="aula-retorno"')));
  assert.match(painel, /\{!compacto && \(\s*<Mascote expressao=\{expressaoDaReacao\} tamanho=\{48\} animado="acontecimento"/);
  assert.match(aula, /!avaliacao\?\.correta \? 'stu-encorajador'/);
  assert.match(aula, /pontesPorExercicio\[indice\] \? 'stu-animado' : primeiras\[indice\] === true \? 'stu-comemorando' : 'stu-feliz'/);
  assert.match(aula, /data-compacto=\{compacto \|\| undefined\}/);
});

test('no celular, 42 na ponta da linha do título, subindo 8 px; o painel até metade da tela e o Stu deixa o toque passar', () => {
  assert.match(css, /\.aula-retorno__stu \{ width: 48px; pointer-events: none; \}/);
  assert.match(css, /@media \(max-width: 767px\) \{[^}]*\.aula-retorno \{ position: relative; \}\s*\.aula-retorno__stu \{ position: absolute; top: -8px; right: 0; width: 42px; \}\s*\.aula-retorno h2 \{ padding-right: 52px; \}/);
  assert.match(css, /\.aula-retorno__corpo \{ max-height: calc\(50svh - 120px\); overflow-y: auto;/);
  assert.match(css, /\.aula-retorno__corpo\[data-rola\] \{ mask-image: linear-gradient\(to bottom, #000 calc\(100% - 24px\), transparent\); \}/);
});
