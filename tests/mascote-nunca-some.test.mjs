import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// O Stu nunca some (correção do iPhone, 20/11): na primeira execução nativa (44511779137), o WebP animado "carregou" mas não
// desenhou no Expo Go do iPhone (o log do simulador mostra "Unsupported image format 'UNKNOWN'" e "CGBitmapContextCreateImage:
// invalid context 0x0" a cada ciclo), e a imagem parada, que saía no onLoad, sumiu junto: só a sombra ficava.
const regras = await readFile(new URL('../apps/mobile/src/mascote-regras.ts', import.meta.url), 'utf8');
const m = {};
runInNewContext(ts.transpileModule(regras, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: m });
const mascote = await readFile(new URL('../apps/mobile/src/mascote.tsx', import.meta.url), 'utf8');

test('a parada só sai quando a animada está na tela e já desenhou; nunca as duas escondidas', () => {
  for (const mostrar of [false, true]) {
    for (const desenhada of [false, true]) {
      const { parada, animada } = m.camadasDoStu(mostrar, desenhada);
      assert.ok(parada + animada >= 1, `alguma camada aparece (mostrar=${mostrar}, desenhada=${desenhada})`);
      assert.equal(parada, mostrar && desenhada ? 0 : 1, 'a parada fica até a animada desenhar');
      assert.equal(animada, mostrar && desenhada ? 1 : 0, 'a animada só aparece depois de desenhar');
    }
  }
  assert.ok(m.ESPERA_DESENHO_MS > 0 && m.ESPERA_DESENHO_MS <= 3000, 'a espera para desenhar é curta');
});

test('o Stu usa o onDisplay (desenhou) e não o onLoad (carregou) para trocar, e desiste para a parada no erro ou sem desenhar a tempo', () => {
  assert.match(mascote, /onDisplay=\{\(\) => setDesenhada\(true\)\} onError=\{\(\) => setDesistiu\(true\)\}/);
  assert.doesNotMatch(mascote, /onLoad=/, 'carregar não basta para esconder a parada');
  assert.match(mascote, /const espera = setTimeout\(\(\) => setDesistiu\(true\), ESPERA_DESENHO_MS\);/);
  // Cada rodada nova remonta a animada: até ela desenhar de novo, a parada volta.
  assert.match(mascote, /useEffect\(\(\) => \{ setDesenhada\(false\); \}, \[rodada\]\);/);
  // O ciclo só conta depois de desenhar.
  assert.match(mascote, /if \(desenhada\) \{\n\s*if \(animado === 'laco'\) return;\n\s*const fim = setTimeout\(\(\) => setQuer\(false\), duracao\);/);
});

test('as camadas usam opacidade comum (sem valor animado nativo preso em 0) e o WebP passa pelo libwebp no iPhone', () => {
  assert.match(mascote, /const camadas = camadasDoStu\(mostrar, desenhada\);/);
  assert.match(mascote, /<View testID="stu-parado" style=\{\[StyleSheet\.absoluteFill, \{ opacity: camadas\.parada, transform: virar \}\]\}>/);
  assert.match(mascote, /<View testID="stu-animado" style=\{\{[^}]*opacity: camadas\.animada, transform: virar \}\}>/);
  assert.doesNotMatch(mascote, /entrada\.interpolate|new Animated\.Value\(0\)\);\n/, 'sem o valor animado da troca antiga');
  // O codec da Apple não compõe os quadros parciais (sem mistura, com descarte) dos nossos WebP animados.
  assert.match(mascote, /useAppleWebpCodec=\{false\}/);
});

test('o pop da §B7 sempre termina com o Stu inteiro, mesmo se o fim da animação nativa não chegar', () => {
  assert.equal((mascote.match(/start\(\(\{ finished \}\) => \{ if \(finished\) troca\.setValue\(1\); \}\)/g) ?? []).length, 2);
  assert.equal((mascote.match(/const garantia = setTimeout\(\(\) => troca\.setValue\(1\), /g) ?? []).length, 2);
  assert.ok(m.GARANTIA_DO_POP_MS > 240, 'a garantia vem depois do fim do pop');
});

test('só o componente Stu toca o WebP animado no app (a regra vale para todo lugar)', async () => {
  const { readdirSync } = await import('node:fs');
  const pasta = new URL('../apps/mobile/src/', import.meta.url);
  for (const nome of readdirSync(pasta).filter((n) => /\.(ts|tsx)$/.test(n) && n !== 'mascote.tsx' && n !== 'stu-arquivos.ts')) {
    const texto = await readFile(new URL(nome, pasta), 'utf8');
    assert.doesNotMatch(texto, /from 'expo-image'|ANIMADO_STU/, `${nome} não toca o animado por fora do Stu`);
  }
});
