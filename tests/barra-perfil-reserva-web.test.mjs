import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// Spec 10, "Barra de salvar: só com alteração": com a barra presa, o fim da rolagem reserva a altura do bloco mais 12 px, para o
// último item da página (o botão "Sair") não ficar atrás dela. Em até 1023 px (celular e tablet, com a cápsula de abas embaixo, spec 16 item 33) a reserva é a da cápsula (--espaco-rodape); no
// computador (1024 px ou mais) a barra fica 16 px acima da borda de baixo da janela e a reserva é a do perfil.css.
const perfilCss = readFileSync('src/app/perfil.css', 'utf8');
const globaisCss = readFileSync('src/app/globals.css', 'utf8');
const perfilTsx = readFileSync('src/app/perfil.tsx', 'utf8');

/** Blocos de media query do nível de cima (condição e corpo, com as chaves casadas) e o resto do CSS sem eles. */
function separarMedia(css) {
  const blocos = [];
  let resto = '';
  let pos = 0;
  const abre = /@media\s*([^{]+)\{/g;
  for (let m; (m = abre.exec(css)); ) {
    resto += css.slice(pos, m.index);
    let prof = 1;
    let i = abre.lastIndex;
    while (i < css.length && prof > 0) {
      const c = css[i++];
      if (c === '{') prof++;
      else if (c === '}') prof--;
    }
    blocos.push({ condicao: m[1].trim().replace(/\s+/g, ' '), corpo: css.slice(abre.lastIndex, i - 1) });
    pos = i;
    abre.lastIndex = i;
  }
  return { blocos, resto: resto + css.slice(pos) };
}

const perfil = separarMedia(perfilCss);
const globais = separarMedia(globaisCss);
const SELETOR = '.estudo-principal:has(.editor-perfil__barra[data-presa])';
const reservaEm = (css) => css.match(new RegExp(`${SELETOR.replace(/[.()[\]]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? null;
const larga = [...perfil.blocos, ...globais.blocos].find((b) => b.condicao === '(min-width: 1024px)' && reservaEm(b.corpo));

test('o fim da rolagem reserva a barra presa a partir de 1024 px, e não só até 1023 px', () => {
  assert.ok(larga, `a reserva de ${SELETOR} precisa existir na media query (min-width: 1024px)`);
  // Fora de uma condição de largura ela brigaria com a reserva da cápsula no celular.
  assert.equal(reservaEm(perfil.resto), null);
  assert.equal(reservaEm(globais.resto), null);
  // E nenhuma media query de celular ou de tablet pode ser a dona dela.
  for (const b of [...perfil.blocos, ...globais.blocos]) {
    if (/max-width:\s*(767|1023)px/.test(b.condicao)) assert.equal(reservaEm(b.corpo), null);
  }
});

test('a reserva soma a margem da barra, a altura medida dela e 12 px de folga', () => {
  assert.ok(larga);
  const regra = reservaEm(larga.corpo);
  const conta = regra.match(/padding-bottom:\s*calc\(\s*(\d+)px\s*\+\s*var\(--altura-acao-fixa,\s*(\d+)px\)\s*\+\s*(\d+)px\s*\)/);
  assert.ok(conta, 'padding-bottom deve ser calc(<margem> + var(--altura-acao-fixa, <altura>) + <folga>)');
  const [margem, altura, folga] = conta.slice(1).map(Number);
  const barra = perfil.resto.match(/\.editor-perfil__barra\[data-presa\]\s*\{([^}]*)\}/)?.[1];
  assert.ok(barra, 'regra da barra presa no perfil.css');
  assert.equal(Number(barra.match(/bottom:\s*(\d+)px/)[1]), margem, 'a margem reservada é a da barra');
  assert.equal(Number(barra.match(/min-height:\s*(\d+)px/)[1]), altura, 'a altura de reserva é o mínimo da barra');
  assert.equal(folga, 12);
  const respiro = Number(globais.resto.match(/\.estudo-principal\s*\{[^}]*padding:\s*\d+px\s+var\(--espaco-pagina\)\s+(\d+)px/)[1]);
  assert.ok(margem + altura + folga > respiro, 'a reserva precisa passar do respiro normal do fim da página');
  // A altura vem da medida real da barra (muda se o texto quebrar), em qualquer largura.
  assert.match(perfilTsx, /ref=\{presa \? medirAcaoFixa : undefined\}/);
});

test('até 1023 px a reserva continua sendo a da cápsula, com a altura da barra', () => {
  const ateTablet = globais.blocos.filter((b) => /^\(max-width:\s*1023px\)$/.test(b.condicao));
  assert.ok(ateTablet.some((b) => /html:has\(\.estudo\[data-navegacao\] \.editor-perfil__barra\[data-presa\]\)\s*\{\s*--espaco-acao-fixa: calc\(var\(--altura-acao-fixa, 48px\) \+ 12px\)/.test(b.corpo)));
  assert.ok(ateTablet.some((b) => /\.estudo\[data-navegacao\] \.estudo-principal \{ padding-bottom: var\(--espaco-rodape\); \}/.test(b.corpo)));
});
