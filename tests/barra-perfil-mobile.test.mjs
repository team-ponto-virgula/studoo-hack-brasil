import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Barra de salvar do Perfil no app (spec 10, 56aac7e; achado do dono no iPhone: "Tudo salvo" preso no meio da tela):
// a linha de ações fica no fluxo, no fim do cartão; só com alteração (ou erro, ou salvando) e com a linha fora da vista ela
// vira o bloco preso acima da cápsula; nunca duas cópias; some com o teclado aberto.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');

test('sem alteração, nada preso e nenhum "Tudo salvo"', async () => {
  const fonte = await ler('apps/mobile/src/perfil.tsx');
  assert.doesNotMatch(fonte, /p\.tudoSalvo/);
  assert.match(fonte, /const pendente = alterado \|\| salvando \|\| Boolean\(erroNaBarra\);/);
  assert.match(fonte, /const preso = pendente && foraDaVista && !teclado;/);
  assert.match(fonte, /definirRodape\(preso \? <View testID="editar-barra-presa" style=\{perfilEstilos\.barra\}>\{conteudoDaBarra\}<\/View> : null\);/);
});

test('a linha de ações fica no fim do cartão, depois de "Cor do perfil", e some do leitor de tela com o bloco preso', async () => {
  const fonte = await ler('apps/mobile/src/perfil.tsx');
  const cores = fonte.indexOf('<CoresDoPerfil cor={cor}'); const linha = fonte.indexOf('<View ref={linha} testID="editar-barra"');
  assert.ok(cores > 0 && linha > cores, 'a linha vem depois de "Cor do perfil"');
  assert.match(fonte, /importantForAccessibility=\{preso \? 'no-hide-descendants' : 'auto'\} accessibilityElementsHidden=\{preso\}/);
  assert.match(fonte, /Keyboard\.addListener\('keyboardDidShow', \(\) => setTeclado\(true\)\)/);
  // Fora da vista: abaixo do que a cápsula ocupa (sem contar o próprio bloco) ou acima do alto da tela.
  assert.match(fonte, /const capsula = ocupado - \(presoAgora\.current \? CAPSULA\.acimaDaCapsula \+ propria \+ 16 : 0\);/);
  assert.match(fonte, /setForaDaVista\(y \+ altura > janela - capsula \|\| y \+ altura < 0\);/);
  assert.match(fonte, /aoRolar=\{\(\) => ouvintesDaRolagem\.current\.forEach\(\(ouvinte\) => ouvinte\(\)\)\}/);
});

test('o bloco preso é o da spec 05: 12 acima da cápsula, até 480, raio 24, superfície da cápsula (Tela)', async () => {
  const tela = await ler('apps/mobile/src/interface.tsx');
  assert.match(tela, /const rodapePreso = comBarra && Boolean\(rodape\);/);
  assert.match(tela, /acimaDaCapsula: 12, raioDoBloco: 24,/);
  assert.match(tela, /bottom: zonaDaBarra \+ CAPSULA\.acimaDaCapsula/);
});
