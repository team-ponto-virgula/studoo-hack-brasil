// Defeito do Lead (23/11, site publicado): o aviso "Música de fundo ligada. [Desligar]" cobria o título "O que você quer aprender?" na primeira tela do visitante em 768 px (e encostava no mascote em 390).
// O aviso continua no alto, 8 px abaixo do cabeçalho (spec 16, item 14), mas reserva a altura dele no fluxo da página enquanto está à vista: o que vem logo depois do cabeçalho desce a altura do aviso mais
// o respiro, e o aviso fica na faixa aberta. Num cabeçalho preso (o do mapa no celular, o da aula), que o conteúdo atravessa ao rolar, o cabeçalho ganha uma faixa do mesmo fundo atrás do aviso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RESPIRO_DO_AVISO, TOPO_DA_PAGINA, quemDesce, reservaDoAviso } from '../src/app/aviso-musica-regras.ts';

const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');

test('a reserva é a altura do aviso mais o respiro de 8 px (o aviso de 48 px reserva 56 px)', () => {
  assert.equal(RESPIRO_DO_AVISO, 8);
  assert.equal(reservaDoAviso(48), 56);
  assert.equal(reservaDoAviso(47.2), 56, 'arredonda a altura para cima');
  assert.equal(reservaDoAviso(72), 80, 'com o texto em duas linhas o aviso é mais alto, e a reserva acompanha');
});

test('quem desce: o que vem logo depois do cabeçalho; sem cabeçalho à vista, o conteúdo principal, mas só com a página no alto', () => {
  const [a, b, principal] = ['depois do app', 'depois do mapa', 'principal'];
  assert.equal(quemDesce(1, [a, b], principal, 0), b, 'o cabeçalho escolhido é o segundo');
  assert.equal(quemDesce(0, [a, b], principal, 500), a, 'com cabeçalho à vista, a rolagem não importa');
  assert.equal(quemDesce(-1, [a, b], principal, 0), principal, 'o computador não tem a faixa: desce o conteúdo principal');
  assert.equal(quemDesce(-1, [a, b], principal, TOPO_DA_PAGINA - 1), principal);
  assert.equal(quemDesce(-1, [a, b], principal, TOPO_DA_PAGINA), null, 'página rolada: nada se mexe sob a pessoa');
  assert.equal(quemDesce(-1, [a, b], principal, 900), null);
  assert.equal(quemDesce(0, [null, b], principal, 0), null, 'cabeçalho sem irmão seguinte: nada desce');
  assert.equal(quemDesce(-1, [a, b], null, 0), null, 'sem conteúdo principal na tela: nada desce');
});

test('o componente marca quem desce e escreve a altura numa variável; rolar a página não troca quem desce; ao sair, a reserva volta devagar', () => {
  const fonte = ler('src/app/ambiente-som.tsx');
  assert.match(fonte, /novo\.setAttribute\('data-aviso-musica-abaixo', ''\);/, 'o elemento que desce leva a marca');
  assert.match(fonte, /novo\.style\.setProperty\('--aviso-musica-reserva', `\$\{reservaDoAviso\(altura\)\}px`\);/, 'e a altura do aviso mais o respiro');
  // O navegador anota o zero antes do valor: a descida é animada.
  assert.match(fonte, /novo\.style\.setProperty\('--aviso-musica-reserva', '0px'\);\s*novo\.setAttribute\('data-aviso-musica-abaixo', ''\);\s*void novo\.offsetHeight;/);
  assert.match(fonte, /if \(evento\?\.type === 'scroll'\) return;/, 'rolar a página reposiciona o aviso, mas não troca quem desce (o conteúdo não pula sob o dedo)');
  assert.match(fonte, /quemDesce\(indice, proximos, document\.getElementById\('conteudo-principal'\), scrollY\)/);
  assert.match(fonte, /const proximos = elementos\.map\(\(cabecalho\) => cabecalho\.nextElementSibling as HTMLElement \| null\);/, 'quem vem logo depois do cabeçalho');
  // A saída: zera a variável (a margem tem transição) e só depois tira a marca, se ninguém pediu a reserva de novo nesse meio-tempo.
  assert.match(fonte, /el\.style\.setProperty\('--aviso-musica-reserva', '0px'\);\s*window\.setTimeout\(\(\) => \{\s*if \(el\.style\.getPropertyValue\('--aviso-musica-reserva'\) !== '0px'\) return;\s*el\.removeAttribute\('data-aviso-musica-abaixo'\);\s*el\.style\.removeProperty\('--aviso-musica-reserva'\);\s*\}, 320\);/);
  assert.match(fonte, /return \(\) => \{\s*devolver\(desce\);\s*desce = null;\s*marcarFaixa\(null, 0\);/, 'ao fechar (o balão, os 7 s, o "Desligar"), o conteúdo volta e a faixa sai');
  assert.match(fonte, /new MutationObserver\(\(\) => posicionar\(\)\)/, 'a tela mudou: confere de novo quem desce');
});

test('só o cabeçalho preso (sticky) ganha a faixa atrás do aviso', () => {
  const fonte = ler('src/app/ambiente-som.tsx');
  assert.match(fonte, /marcarFaixa\(indice >= 0 && getComputedStyle\(elementos\[indice\]\)\.position === 'sticky' \? elementos\[indice\] : null, altura\);/);
  assert.match(fonte, /novo\.setAttribute\('data-aviso-musica-faixa', ''\);/);
  assert.match(fonte, /faixa\.removeAttribute\('data-aviso-musica-faixa'\);/);
});

test('o CSS: a margem de quem desce acompanha a variável, com transição; a faixa do cabeçalho preso tem o mesmo fundo e é parte dele', () => {
  const css = ler('src/ui/aviso.css');
  assert.match(css, /html \[data-aviso-musica-abaixo\] \{ margin-top: var\(--aviso-musica-reserva, 0px\); transition: margin-top 220ms ease-out; \}/);
  const faixa = /\[data-aviso-musica-faixa\]::after \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(faixa, /position: absolute; inset: 100% 0 auto 0;/, 'logo embaixo do cabeçalho, na largura dele');
  assert.match(faixa, /height: calc\(var\(--aviso-musica-reserva, 0px\) \+ 8px\);/, 'a altura do aviso, o respiro e mais 8 px de folga embaixo');
  assert.match(faixa, /background: inherit;/, 'o mesmo fundo do cabeçalho');
  assert.doesNotMatch(faixa, /pointer-events: none/, 'o toque na faixa é do cabeçalho: não chega ao que está escondido por trás');
  // O aviso em si não mudou: no alto, sem pegar o toque do que está fora do "Desligar".
  assert.match(css, /\.aviso-musica \{ top: calc\(env\(safe-area-inset-top, 0px\) \+ 8px\); bottom: auto; \}/);
  assert.match(css, /\.aviso-app \{[^}]*pointer-events: none;/);
});

test('os cabeçalhos presos que o aviso respeita (o do mapa no celular e o da aula) existem como sticky no CSS', () => {
  assert.match(ler('src/app/trilha.css'), /\.trilha-topo \{\s*position: sticky; top: 0;/);
  assert.match(ler('src/app/aula.css'), /\.aula-topo \{ position: sticky;/);
});
