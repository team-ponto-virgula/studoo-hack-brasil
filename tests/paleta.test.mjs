// Paleta do kit do mascote (spec 13, B5): as cores de marca no :root, as contas de contraste da tabela e nenhuma cor
// antiga escrita à mão no código da web e do contrato.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const globais = readFileSync(join(raiz, 'src/app/globals.css'), 'utf8');
const tokens = readFileSync(join(raiz, 'src/ui/jornada-tokens.css'), 'utf8');
// O CSS gerado é importado pelos globais antes das definições auxiliares do kit.
assert.match(globais, /@import ['\"]\.\.\/ui\/jornada-tokens\.css['\"]/);
const raizCss = tokens + globais.slice(globais.indexOf(':root {'), globais.indexOf('}', globais.indexOf(':root {')));
const cor = (nome) => {
  const achado = raizCss.match(new RegExp(`--${nome}:\\s*([^;]+);`));
  assert.ok(achado, `--${nome} nos tokens ou :root`);
  const valor = achado[1].trim();
  const alias = /^var\(--([\w-]+)\)$/.exec(valor);
  if (alias) return cor(alias[1]);
  assert.match(valor, /^#[0-9a-fA-F]{3,6}$/);
  return valor.toLowerCase();
};

const canal = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminancia = (hex) => {
  const h = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const BRANCO = '#ffffff';

test('as cores de interface são as da Jornada Azul e o kit do Stu é preservado', () => {
  assert.equal(cor('acao'), '#2457dd');
  assert.equal(cor('acao-escura'), '#173b9c');
  assert.equal(cor('texto'), '#15275b');
  assert.equal(cor('ouro'), '#fbbf24');
  assert.equal(cor('violeta'), '#8b5cf6');
  assert.equal(cor('violeta-texto'), '#6d28d9');
  assert.equal(cor('azul-claro'), '#3b82f6');
  assert.equal(cor('lavanda'), '#e9e7ff');
  assert.equal(cor('ceu'), '#e9e7ff', 'o fundo suave é a lavanda');
  // Os estados semânticos permanecem; o texto secundário acompanha a nova direção.
  assert.equal(cor('texto2'), '#50607a');
  assert.equal(cor('sucesso'), '#1f7a5a');
  assert.equal(cor('alerta'), '#9a5b00');
  assert.equal(cor('erro'), '#c23b4e');
  assert.equal(cor('fundo-aviso-comunidade'), '#15275b');
});

test('as contas de contraste da B5 passam', () => {
  const casos = [
    ['branco sobre a ação (botão)', BRANCO, cor('acao'), 4.5],
    ['ação escura no branco', cor('acao-escura'), BRANCO, 4.5],
    ['ação escura na lavanda (link sobre lavanda)', cor('acao-escura'), cor('lavanda'), 4.5],
    ['texto no branco', cor('texto'), BRANCO, 7],
    ['texto do aviso da comunidade', BRANCO, cor('fundo-aviso-comunidade'), 7],
    ['texto na lavanda', cor('texto'), cor('lavanda'), 7],
    ['texto sobre o destaque', cor('texto'), cor('ouro'), 4.5],
    ['violeta de texto no branco', cor('violeta-texto'), BRANCO, 4.5],
    ['texto secundário no branco', cor('texto2'), BRANCO, 4.5],
    ['azul claro como componente (3:1)', cor('azul-claro'), BRANCO, 3],
  ];
  for (const [nome, frente, fundo, minimo] of casos) {
    const valor = contraste(frente, fundo);
    assert.ok(valor >= minimo, `${nome}: ${valor.toFixed(2)}:1 abaixo de ${minimo}:1`);
  }
  // O que a B5 proíbe como texto: a ação sobre a lavanda, o destaque no branco, o azul claro e a violeta em texto miúdo.
  assert.ok(contraste('#2563ff', cor('lavanda')) < 4.5, 'regressão histórica: o azul anterior não bastava sobre lavanda');
  assert.ok(contraste(cor('ouro'), BRANCO) < 3);
});

const arquivos = (pasta) => readdirSync(pasta).flatMap((nome) => {
  const caminho = join(pasta, nome);
  return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(css|tsx?)$/.test(nome) ? [caminho] : [];
});
const codigo = [...arquivos(join(raiz, 'src')), ...arquivos(join(raiz, 'packages/contratos/src'))];

test('nenhuma cor antiga de marca escrita à mão (nem em rgb)', () => {
  const antigas = /#3858d6|#2a44a8|#1b2a5e|#ffd166|#3050cc|rgba?\(\s*56[ ,]+88[ ,]+214|rgba?\(\s*27[ ,]+42[ ,]+94/i;
  for (const arquivo of codigo) {
    readFileSync(arquivo, 'utf8').split('\n').forEach((linha, i) => {
      // A spec 11 reserva este fundo para o aviso da comunidade. A marca continua com a paleta da B5.
      if (arquivo === join(raiz, 'src/app/globals.css') && linha.trim() === '--fundo-aviso-comunidade: #1b2a5e;') return;
      assert.doesNotMatch(linha, antigas, `${relative(raiz, arquivo)}:${i + 1} ainda tem a cor antiga`);
    });
  }
});

test('a ação não vira texto sobre a lavanda (use a ação escura)', () => {
  for (const arquivo of codigo.filter((a) => a.endsWith('.css'))) {
    for (const [, seletor, corpo] of readFileSync(arquivo, 'utf8').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sobreLavanda = /background(-color)?:\s*var\(--(ceu|lavanda)\)/.test(corpo);
      assert.ok(!(sobreLavanda && /(?<![-\w])color:\s*var\(--acao\)/.test(corpo)), `${relative(raiz, arquivo)}: ${seletor.trim()} põe a ação como texto sobre a lavanda`);
    }
  }
});
