import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { CABECALHO_CAPACIDADES, PALETA_DO_DESENHO, lerCapacidades, normalizarVisual, visualParaEnunciado, visualRevelado } from '../packages/contratos/src/aprendizado.ts';
import { corDoPapel, desenhoDoVisual, elementoDaPrimitiva, medidasNaTela } from '../apps/mobile/src/desenho-svg.ts';

// O adaptador do motor de desenho para react-native-svg (spec 15, fase 2 do app): cada primitiva das fixtures da folha de
// matemática vira um elemento conhecido, com as cores da paleta do contrato e as regras de desenho; visual inválido some.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const fixture = async (nome) => JSON.parse(await ler(`tests/fixtures/matematica/${nome}.json`)).licao;
const CORES = new Set(Object.values(PALETA_DO_DESENHO));

function conferirDesenho(desenho, onde) {
  assert.ok(desenho, `${onde}: o motor desenhou`);
  assert.ok(desenho.primitivas.length > 0 && desenho.primitivas.length <= 300, `${onde}: dentro do teto`);
  for (const primitiva of desenho.primitivas) {
    const item = elementoDaPrimitiva(primitiva);
    assert.ok(item, `${onde}: primitiva ${primitiva.tipo} conhecida`);
    for (const chave of ['stroke', 'fill']) {
      const valor = item.props[chave];
      if (valor !== undefined && valor !== 'none') assert.ok(CORES.has(valor), `${onde}: ${chave} ${valor} vem da paleta`);
    }
    if (item.elemento === 'Path') assert.equal(item.props.fillRule, 'nonzero');
    if (item.elemento === 'Line') assert.equal(item.props.strokeLinecap, 'butt');
  }
  assert.ok(desenho.descricao.length > 0, `${onde}: tem texto para o leitor de tela`);
}

test('as fixtures da folha (baricentro, abscissas, colinearidade) desenham em todos os contextos', async () => {
  for (const nome of ['baricentro', 'abscissas', 'colinearidade']) {
    const licao = await fixture(nome);
    for (const [i, bruto] of licao.visuais.entries()) {
      const visual = normalizarVisual(bruto);
      assert.ok(visual, `${nome}: visual ${i} normaliza`);
      conferirDesenho(desenhoDoVisual(visualParaEnunciado(visual), { tipo: 'enunciado' }), `${nome}/visuais[${i}]`);
    }
    const figura = normalizarVisual(licao.exercicio.visual);
    conferirDesenho(desenhoDoVisual(visualParaEnunciado(figura), { tipo: 'enunciado' }, { alturaMaxima: 183 }), `${nome}/enunciado`);
    conferirDesenho(desenhoDoVisual(visualRevelado(figura), { tipo: 'retorno' }), `${nome}/retorno`);
  }
});

test('visual inválido some (fórmula que não lê, tipo desconhecido): nada no lugar', () => {
  assert.equal(desenhoDoVisual({ tipo: 'formula', latex: '\\input{segredo}' }, { tipo: 'enunciado' }), null);
  assert.equal(desenhoDoVisual({ tipo: 'grafico_funcao', alt: 'x' }, { tipo: 'enunciado' }), null);
  assert.equal(elementoDaPrimitiva({ tipo: 'texto', x: 0, y: 0 }), null, 'primitiva de um contrato mais novo é ignorada');
  assert.equal(corDoPapel('papelNovo'), PALETA_DO_DESENHO.texto, 'papel desconhecido cai na cor do texto');
});

test('escala pela largura útil e rola para o lado quando a fórmula é larga', () => {
  const desenho = { largura: 320, altura: 160, primitivas: [], descricao: 'x', menorTexto: 13 };
  const medidas = medidasNaTela(desenho, 350);
  assert.equal(medidas.escala, 350 / 320);
  assert.equal(medidas.altura, 175);
  assert.equal(medidas.rola, false);
  assert.equal(medidas.viewBox, '0 0 320 160');
  const larga = medidasNaTela({ ...desenho, larguraDoConteudo: 480 }, 320);
  assert.equal(larga.rola, true);
  assert.equal(larga.larguraDoConteudo, 480);
  assert.equal(larga.viewBox, '0 0 480 160');
});

test('o app declara a própria lista de capacidades e a manda no solicitar e na geração ao vivo', async () => {
  const fonte = await ler('apps/mobile/src/api-nativa.ts');
  assert.match(fonte, /export const CAPACIDADES_DO_APP = 'visuais@1,resolucao@1';/);
  assert.equal((fonte.match(/\[CABECALHO_CAPACIDADES\]: CAPACIDADES_DO_APP,/g) ?? []).length, 2, 'nos dois fetch');
  assert.doesNotMatch(fonte, /import \{[^}]*CAPACIDADES_DESTE_CLIENTE/, 'não importa a constante do contrato');
  assert.equal(CABECALHO_CAPACIDADES, 'X-Studoo-Capacidades');
  assert.deepEqual(lerCapacidades('visuais@1,resolucao@1'), { visuais: 1, resolucao: 1 });
});

test('o componente: imagem com nome para o leitor de tela, entrada por fora do Svg, altura reservada', async () => {
  const fonte = await ler('apps/mobile/src/desenho.tsx');
  assert.match(fonte, /accessible accessibilityRole="image" accessibilityLabel=\{rotulo \?\? desenho\.descricao\}/);
  assert.match(fonte, /<Animated\.View testID=\{testID\}/);
  assert.doesNotMatch(fonte, /Animated\.createAnimatedComponent\((Path|Svg|Line)/, 'nada de animar propriedade de SVG');
  assert.match(fonte, /aspectRatio: desenho\.largura \/ desenho\.altura/);
  assert.match(fonte, /if \(!desenho\) return null;/, 'visual inválido não ocupa lugar');
});
