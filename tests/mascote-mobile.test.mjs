import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOGO_STU } from '../packages/contratos/src/catalogo-mascote.ts';
import { gerarStuArquivos } from '../apps/mobile/scripts/stu-arquivos.mjs';

// Mascote oficial no app (spec 13): o mapa estático de require() (o Metro não aceita caminho montado) tem de bater com o
// catálogo do contrato e com os arquivos da pasta; o componente segue as regras da emenda (expo-image, teto de 330 px,
// enfeite para o leitor de tela).
const raiz = new URL('../', import.meta.url);
const pasta = new URL('apps/mobile/assets/marca/stu/', raiz);
const mapa = readFileSync(new URL('apps/mobile/src/stu-arquivos.ts', raiz), 'utf8');
const componente = readFileSync(new URL('apps/mobile/src/mascote.tsx', raiz), 'utf8');

test('o mapa de require() está em dia com o catálogo (rode npx tsx apps/mobile/scripts/stu-arquivos.mjs se mudar)', () => {
  assert.equal(mapa, gerarStuArquivos());
});

test('cada imagem do mapa existe na pasta (as animadas, em @2x ou @3x)', () => {
  const faltam = [];
  for (const [, arquivo] of mapa.matchAll(/require\('\.\.\/assets\/marca\/stu\/([^']+)'\)/g)) {
    if (arquivo.endsWith('.webp')) {
      const base = arquivo.replace(/\.webp$/, '');
      if (!existsSync(new URL(`${base}@2x.webp`, pasta)) && !existsSync(new URL(`${base}@3x.webp`, pasta))) faltam.push(arquivo);
    } else if (!existsSync(new URL(arquivo, pasta))) faltam.push(arquivo);
  }
  assert.deepEqual(faltam, []);
});

test('toda imagem parada e animada do catálogo tem entrada no mapa, e nada além delas', () => {
  const esperadas = new Set();
  for (const item of Object.values(CATALOGO_STU)) {
    for (const arquivo of item.app.filter((a) => a.densidade === 1)) esperadas.add(arquivo.arquivo);
    for (const arquivo of item.animacao?.app ?? []) esperadas.add(arquivo.arquivo.replace(/@\d+x(?=\.webp$)/, ''));
  }
  const noMapa = new Set([...mapa.matchAll(/require\('\.\.\/assets\/marca\/stu\/([^']+)'\)/g)].map(([, arquivo]) => arquivo));
  assert.deepEqual([...noMapa].sort(), [...esperadas].sort());
  // Os arquivos da pasta são exatamente os do catálogo (parados em 1x, 2x e 3x; animados nas densidades geradas).
  const naPasta = readdirSync(pasta).sort();
  const doCatalogo = Object.values(CATALOGO_STU).flatMap((item) => [...item.app, ...(item.animacao?.app ?? [])].map((a) => a.arquivo)).sort();
  assert.deepEqual(naPasta, [...new Set(doCatalogo)].sort());
});

test('o componente anima pelo expo-image só até 330 px, nunca com movimento reduzido, e é enfeite para o leitor de tela', () => {
  assert.match(componente, /from 'expo-image'/);
  assert.match(componente, /TETO_ANIMADO_PX = 330/);
  assert.match(componente, /tamanho \* PixelRatio\.get\(\) <= TETO_ANIMADO_PX/);
  assert.match(componente, /reduzir === false/);
  assert.match(componente, /accessible=\{false\} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
  const pacote = JSON.parse(readFileSync(new URL('apps/mobile/package.json', raiz), 'utf8'));
  assert.ok(pacote.dependencies['expo-image'], 'expo-image nas dependências do app');
});
