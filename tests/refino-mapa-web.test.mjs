// Refinamento da UI (spec 16), o mapa na web. Cada item entra com o seu teste.
// Item 13: os enfeites do mapa na web saíam do tamanho da coluna inteira porque a regra das figuras de matemática da aula (`.desenho { width: 100% }`,
// aula.css) pisava a regra dos desenhos do mundo (`.desenho { width: var(--tam) }`, mundo.css): as duas usavam a mesma classe, e o CSS é global.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { Desenho } = await import('../src/ui/mundo.tsx');
const { desenhosMundo } = await import('../src/ui/mundo-desenhos.ts');
const { cabecalhoComMapaPorBaixo } = await import('../src/app/cabecalho-preso.ts');

/** Todos os .css de src/, com o caminho relativo à raiz. */
function folhasDeEstilo(pasta = 'src') {
  return readdirSync(join(raiz, pasta), { withFileTypes: true }).flatMap((entrada) => {
    const caminho = `${pasta}/${entrada.name}`;
    if (entrada.isDirectory()) return folhasDeEstilo(caminho);
    return entrada.name.endsWith('.css') ? [caminho] : [];
  });
}
/** Os seletores `.desenho` soltos (a classe inteira, não `.desenho-formula-texto` nem `.desenho__ponto`). */
const SELETOR_DESENHO = /\.desenho(?![\w-])/g;

test('item 13: o desenho do mundo (enfeites, paisagem) leva a classe `mundo-desenho`, nunca a `desenho` das figuras de matemática', () => {
  for (const nome of Object.keys(desenhosMundo).slice(0, 8)) {
    const html = renderToStaticMarkup(createElement(Desenho, { nome, className: 'caminho-enfeite caminho-enfeite--grande' }));
    const classe = /<svg class="([^"]*)"/.exec(html)?.[1] ?? '';
    const fichas = classe.split(/\s+/);
    assert.ok(fichas.includes('mundo-desenho'), `${nome}: ${classe}`);
    assert.ok(fichas.includes('caminho-enfeite'), `${nome}: a classe de quem usa continua junto`);
    assert.ok(!fichas.includes('desenho'), `${nome}: a classe \`desenho\` é da figura de matemática (largura 100%) e pisaria o tamanho do enfeite`);
  }
});

test('item 13: a regra do tamanho do desenho do mundo é do `mundo-desenho`, e a classe `desenho` solta só existe no CSS da aula', () => {
  const mundo = ler('src/ui/mundo.css');
  assert.match(mundo, /\.mundo-desenho \{[^}]*width: var\(--tam, 40px\)/, 'o tamanho vem da variável --tam (os enfeites do mapa a trocam por --tam-enfeite e --tam-miudo)');
  const comDesenhoSolto = folhasDeEstilo().filter((arquivo) => SELETOR_DESENHO.test(ler(arquivo)) || (SELETOR_DESENHO.lastIndex = 0, false));
  assert.deepEqual(comDesenhoSolto, ['src/app/aula.css'], 'só a figura de matemática da aula usa `.desenho`; o resto do CSS fala do `mundo-desenho`');
  assert.match(ler('src/app/aula.css'), /^\.desenho \{ display: block; width: 100%;/m, 'a figura de matemática continua ocupando a coluna da aula');
});

test('item 13: o mapa pede o tamanho do enfeite por --tam-enfeite e --tam-miudo (os mesmos números do app: 46/24, 56/28 e 62/28)', () => {
  const css = ler('src/ui/caminho.css');
  assert.match(css, /--tam-enfeite: 46px;\s*--tam-miudo: 24px;/, 'celular');
  assert.match(css, /--tam-enfeite: 56px; --tam-miudo: 28px;/, 'tablet');
  assert.match(css, /--tam-enfeite: 62px;/, 'computador');
  assert.match(css, /\.caminho-enfeite--grande \{ --tam: var\(--tam-enfeite\);/);
  assert.match(css, /\.caminho-enfeite--miudo \{ --tam: var\(--tam-miudo\);/);
});

test('item 3: o cabeçalho preso do mapa no celular tem fundo branco a 94%, sem vidro, e a linha de 1 px #E1E7FA só com o mapa rolando por baixo', () => {
  const css = ler('src/app/trilha.css');
  const bloco = css.slice(css.indexOf('/* Celular: o nome do plano fica numa barra compacta presa no topo'));
  const regra = /\.trilha-topo \{([^}]*)\}/.exec(bloco)[1];
  assert.match(regra, /position: sticky; top: 0;/);
  assert.match(regra, /background: rgb\(255 255 255 \/ 0\.94\);/);
  assert.doesNotMatch(regra, /backdrop-filter|box-shadow/, 'nada de vidro (a web e o Android não têm) e nenhuma linha fixa: a linha é do estado preso');
  assert.match(bloco, /\.trilha-topo\[data-preso\] \{ box-shadow: 0 1px 0 #e1e7fa; \}/);
});

test('item 3: o cabeçalho está "preso" quando a página rolou e o topo dele chegou a 0 (antes disso, não há mapa por baixo)', () => {
  assert.equal(cabecalhoComMapaPorBaixo(93, 0), false, 'no alto da página, com a barra da marca acima');
  assert.equal(cabecalhoComMapaPorBaixo(0, 0), false, 'no alto e sem rolar: nada passa por baixo');
  assert.equal(cabecalhoComMapaPorBaixo(40, 30), false, 'rolou, mas o cabeçalho ainda não chegou ao alto');
  assert.equal(cabecalhoComMapaPorBaixo(0, 520), true, 'preso, com o mapa rolando por baixo');
  assert.equal(cabecalhoComMapaPorBaixo(0.4, 12), true, 'meio pixel de folga');
  assert.equal(cabecalhoComMapaPorBaixo(-408, 520), true, 'rolou além (tablet e computador não têm CSS para isso)');
  const tela = ler('src/app/estudo.tsx');
  assert.match(tela, /useCabecalhoPreso\(topoDoMapa\);/);
  assert.match(tela, /<header className="trilha-topo" ref=\{topoDoMapa\}>/);
  const gancho = ler('src/app/cabecalho-preso.ts');
  assert.match(gancho, /getComputedStyle\(cabecalho\)\.position === 'sticky'/, 'só o cabeçalho que está mesmo preso recebe o estado');
  assert.match(gancho, /\{ passive: true \}/, 'a rolagem não espera pelo gancho');
});

test('item 15: até 767 px a barra da marca sai do mapa, e o selo de sincronia vem para a linha do rótulo do cabeçalho da trilha', () => {
  const estudo = ler('src/app/estudo.tsx');
  // O mapa recebe o selo pronto (o mesmo da barra) e o põe ao lado do rótulo "Sua trilha"; só com a lista de trilhas carregada.
  assert.match(estudo, /<Plano tela=\{tela\} ocupado=\{ocupado\} abrindo=\{abrindo\}\s*selo=\{inicio === 'pronto' \? <SeloSincronia sincronia=\{sincronia\} agora=\{agora\} temProgresso=\{planos\.length > 0\} \/> : null\}/);
  assert.match(estudo, /<div className="trilha-topo__linha">\s*<p className="trilha-topo__rotulo">\{mensagens\.trilha\.suaTrilha\}<\/p>\s*\{selo && <div className="trilha-topo__selo">\{selo\}<\/div>\}\s*<\/div>/);
  const css = ler('src/app/trilha.css');
  // Fora do celular o selo do mapa fica escondido (ele segue na barra), para não haver dois avisos de sincronia.
  assert.match(css, /\.trilha-topo__selo \{ display: none; \}/);
  assert.match(css, /\.trilha-topo__linha \{ display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; \}/, 'em tela estreita o selo desce para baixo do rótulo em vez de apertar os dois');
  assert.match(css, /\.trilha-topo__rotulo \{ white-space: nowrap; \}/);
  const celular = css.slice(css.indexOf('@media (max-width: 767px) {\n  .trilha-topo {'));
  assert.ok(celular.length > 0, 'o bloco do celular do cabeçalho do mapa');
  const bloco = celular.slice(0, celular.indexOf('\n}'));
  assert.match(bloco, /\.estudo:has\(\.painel--trilha\) \.estudo-cabecalho \{ display: none; \}/, 'a barra da marca não aparece no mapa até 767 px');
  assert.match(bloco, /\.estudo-principal:has\(\.painel--trilha\) \{ padding-top: 8px; \}/, 'o cabeçalho da trilha começa no alto da página (sem o vão de 20 px que a barra deixava)');
  assert.match(bloco, /\.trilha-topo__selo \{ display: block; min-width: 0; \}/, 'o selo do mapa aparece só no celular');
  assert.match(bloco, /\.trilha-topo \{ padding-top: max\(10px, env\(safe-area-inset-top\)\); \}/, 'sem a barra, o cabeçalho respeita a área segura do alto');
});
