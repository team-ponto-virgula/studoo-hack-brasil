import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Spec 01 (e198866; achado do dono: o balão abria atrás do cabeçalho preso da trilha). No app, a lição concluída ou
// bloqueada abre uma folha (Modal) por cima de tudo, que nunca fica atrás do cabeçalho; a atual abre a aula. O que rola é
// "Mostrar a lição atual no mapa": o nó inteiro na área livre, 16 abaixo do cabeçalho preso medido e acima do card.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');

test('o nó concluído ou bloqueado abre a folha em Modal (não um balão dentro da rolagem)', async () => {
  const caminho = await ler('apps/mobile/src/caminho.tsx');
  assert.match(caminho, /if \(no\.estado === 'atual'\) \{\s*setAberto\(null\);\s*aoAbrir\?\.\(no\);\s*return;\s*\}\s*setAberto\(no\.id\);/);
  const folha = caminho.slice(caminho.indexOf('\nfunction Folha'));
  assert.match(folha, /<Modal visible transparent statusBarTranslucent/);
});

test('"Mostrar a lição atual no mapa" mede com as faixas do alto e com a altura do cabeçalho preso', async () => {
  const caminho = await ler('apps/mobile/src/caminho.tsx');
  const ir = caminho.slice(caminho.indexOf('function irParaAtual'), caminho.indexOf('function fechar('));
  assert.match(ir, /const topo = deslocamento \+ caminho \+ lista \+ linha\.y;/);
  assert.match(ir, /aoRolar\(topo - BALAO_DO_ATUAL, topo \+ medidas\.lente, true, undefined, coberto\);/, 'o topo do conjunto é o do balão do nó atual');
  assert.match(caminho, /const BALAO_DO_ATUAL = 22 \+ 96;/);
  assert.match(caminho, /const coberto = useContext\(AlturaDaFaixaFixa\);/);
});

test('a rolagem: 16 abaixo do cabeçalho, nada rola se já cabe, rola o mínimo, e o topo tem prioridade', async () => {
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  const rolar = estudo.slice(estudo.indexOf('function rolar(topo: number'), estudo.indexOf('const novo = <Botao rotulo={mensagens.planos.novo}'));
  assert.match(rolar, /const cima = cobertoNoAlto \+ 16;/);
  assert.match(rolar, /if \(topo - atual >= cima && pe - atual <= limite\) return;/);
  assert.match(rolar, /let y = pe - atual > limite \? pe - limite : topo - cima;\s*if \(topo - y < cima\) y = topo - cima;/);
  assert.match(rolar, /animated: reduzir === false/);
  // Conta: com o cabeçalho de 260 (trilha recebida) e o nó acima dele, o nó para 16 abaixo do cabeçalho.
  const cobertoNoAlto = 260, atual = 900, topo = 1000, pe = 1100, limite = 844 - 168;
  const cima = cobertoNoAlto + 16;
  let y = pe - atual > limite ? pe - limite : topo - cima; if (topo - y < cima) y = topo - cima;
  assert.equal(topo - y, cima);
});
