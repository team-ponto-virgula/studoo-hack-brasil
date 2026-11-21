import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PALETA_DO_DESENHO, normalizarVisual, visualParaEnunciado, visualRevelado } from '../packages/contratos/src/aprendizado.ts';
import { desenhoDoVisual, elementoDaPrimitiva, separarPontoResposta, temProcurado } from '../apps/mobile/src/desenho-svg.ts';

// Gráfico de função no app (spec 15, seção 15; motor 7332cd6): o app só desenha as primitivas do motor, em todos os lugares onde
// desenha plano e reta (conceito, exercício na caixa do enunciado com troca no acerto, retorno, último passo do "Resolva comigo").

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const fixture = async (nome) => JSON.parse(await ler(`tests/fixtures/matematica-funcao/${nome}.json`));
const CORES = new Set(Object.values(PALETA_DO_DESENHO));
const CRU = /[$_^\\{}]/;

function conferir(desenho, onde) {
  assert.ok(desenho, `${onde}: o motor desenhou`);
  if (desenho.naoCabe) return 'naoCabe';
  for (const primitiva of desenho.primitivas) {
    const item = elementoDaPrimitiva(primitiva);
    assert.ok(item, `${onde}: ${primitiva.tipo} conhecida`);
    for (const chave of ['stroke', 'fill']) {
      const valor = item.props[chave];
      if (valor !== undefined && valor !== 'none') assert.ok(CORES.has(valor), `${onde}: ${chave} ${valor} da paleta`);
    }
  }
  for (const texto of desenho.textos ?? []) assert.doesNotMatch(texto, CRU, `${onde}: "${texto}"`);
  assert.doesNotMatch(desenho.descricao, CRU, `${onde}: descrição`);
  return 'desenha';
}

test('as 3 fixtures (parábola, reta, seno) desenham no conceito, no enunciado (390 e iPhone SE) e no retorno, sem caractere cru', async () => {
  for (const nome of ['parabola', 'reta', 'seno']) {
    const { guardado } = await fixture(nome);
    const visual = normalizarVisual(guardado);
    assert.ok(visual && visual.tipo === 'funcao', `${nome}: vale como funcao`);
    assert.equal(conferir(desenhoDoVisual(visualParaEnunciado(visual), { tipo: 'enunciado' }), `${nome}/conceito`), 'desenha');
    for (const alturaMaxima of [201, 158]) {
      conferir(desenhoDoVisual(visualParaEnunciado(visual), { tipo: 'enunciado' }, { alturaMaxima }), `${nome}/enunciado ${alturaMaxima}`);
      conferir(desenhoDoVisual(visualRevelado(visual), { tipo: 'retorno' }, { alturaMaxima }), `${nome}/retorno ${alturaMaxima}`);
    }
    assert.ok(visual.alt && visual.alt.length <= 140, `${nome}: alt para o leitor de tela`);
  }
});

test('o vértice procurado: a curva não aparece no enunciado e aparece no retorno, com o ponto resposta para crescer', async () => {
  const { exercicioDoVertice } = await fixture('parabola');
  const visual = normalizarVisual(exercicioDoVertice.guardado);
  assert.ok(temProcurado(visual), 'tem procurado: a troca no acerto acontece');
  const enunciado = desenhoDoVisual(visualParaEnunciado(visual), { tipo: 'enunciado' }, { alturaMaxima: 201 });
  const retorno = desenhoDoVisual(visualRevelado(visual), { tipo: 'retorno' }, { alturaMaxima: 201 });
  conferir(enunciado, 'vértice/enunciado'); conferir(retorno, 'vértice/retorno');
  const curvas = (d) => d.primitivas.filter((p) => p.tipo === 'caminho' && p.borda && !p.preenchimento && (p.larguraDaBorda ?? 0) >= 3 && p.borda !== 'branco').length;
  assert.ok(curvas(retorno) > curvas(enunciado), `a curva só no retorno (${curvas(enunciado)} → ${curvas(retorno)})`);
  assert.ok(!enunciado.textos.some((t) => /V \(/.test(t)), 'o vértice não aparece com coordenadas no enunciado');
  assert.ok(separarPontoResposta(retorno.primitivas), 'o ponto resposta separado para crescer no acerto');
});

test('o app trata funcao como as outras figuras: nada decide por plano/reta, e o naoCabe vira a linha "Figura: <alt>"', async () => {
  for (const arquivo of ['apps/mobile/src/desenho.tsx', 'apps/mobile/src/licao.tsx', 'apps/mobile/src/resolva-comigo.tsx', 'apps/mobile/src/desenho-svg.ts']) {
    assert.doesNotMatch(await ler(arquivo), /tipo === 'plano'|tipo === 'reta_numerica'/, `${arquivo} não assume plano/reta`);
  }
  assert.match(await ler('apps/mobile/src/desenho-svg.ts'), /return \(visual\.pontos \?\? \[\]\)\.some/, 'funcao pode vir sem pontos');
  assert.match(await ler('apps/mobile/src/desenho.tsx'), /if \(desenho\.naoCabe && visual\.tipo !== 'formula'\) return <FiguraEmTexto alt=\{visual\.alt\}/);
});

test('capacidade: o app anuncia a própria lista (ainda visuais@1), não a constante do contrato', async () => {
  const api = await ler('apps/mobile/src/api-nativa.ts');
  assert.match(api, /export const CAPACIDADES_DO_APP = 'visuais@1,resolucao@1';/);
  assert.doesNotMatch(api, /import \{[^}]*CAPACIDADES_DESTE_CLIENTE/);
});
