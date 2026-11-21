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
  assert.match(fonte, /if \(!desenho\) return visual\.tipo === 'formula' \? <FormulaEmTexto latex=\{visual\.latex\} testID=\{testID\} \/> : null;/, 'figura inválida não ocupa lugar; fórmula vira texto linear');
  assert.match(fonte, /if \(!lida\.ok\) return null;/, 'fórmula que nem se lê some');
});

test('visuais abertos na lição: conceito e exemplo com a fórmula antes do diagrama; nada atrás do "Ver a ilustração"', async () => {
  const { ordenarVisuais, alturaMaximaDaFigura } = await import('../apps/mobile/src/desenho-svg.ts');
  const plano = { tipo: 'plano', alt: 'p', x: [0, 4], y: [0, 4], pontos: [{ id: 'A', papel: 'dado', x: 1, y: 1 }] };
  const formula = { tipo: 'formula', latex: 'x = 1' };
  assert.deepEqual(ordenarVisuais([plano, formula]).map((v) => v.tipo), ['formula', 'plano']);
  assert.equal(alturaMaximaDaFigura(358), Math.round(200 * 320 / 358), 'figura do exercício com até 200 na tela de 390');
  const { alturaDaFiguraNaTela } = await import('../apps/mobile/src/desenho-svg.ts');
  assert.equal(alturaDaFiguraNaTela(844), 200); assert.equal(alturaDaFiguraNaTela(932), 200);
  assert.equal(alturaDaFiguraNaTela(667), 158, 'no iPhone SE, a figura encolhe para as opções começarem na primeira tela');
  assert.match(await ler('apps/mobile/src/licao.tsx'), /alturaMaximaDaFigura\(larguraJanela - 32 - 2 \* \(respiroQuadro\.padding \+ 2\), alturaDaFiguraNaTela\(alturaJanela\)\)/);
  const licao = await ler('apps/mobile/src/licao.tsx');
  assert.match(licao, /<VisuaisDaLicao visuais=\{licao\.visuais\} \/>/, 'no conceito');
  assert.match(licao, /<VisuaisDaLicao visuais=\{licao\.visuais\} testID="visual-exemplo" \/>/, 'no exemplo');
  const consulta = licao.slice(licao.indexOf('testID="consultar-recurso"') - 1500, licao.indexOf('testID="consultar-recurso"'));
  assert.doesNotMatch(consulta, /visua/i, 'o "Ver a ilustração" segue só com o recurso (a foto do material)');
});

test('exercício: enunciado, visual e opções; a figura troca no lugar só depois do acerto, e a retomada guarda a Avaliacao', async () => {
  const licao = await ler('apps/mobile/src/licao.tsx');
  const pergunta = licao.indexOf('testID="pergunta-exercicio"');
  const visual = licao.indexOf('testID="visual-enunciado"');
  const campo = licao.indexOf('{campoDoExercicio(exercicio)}');
  assert.ok(pergunta > 0 && pergunta < visual && visual < campo, 'a ordem da spec 15');
  assert.match(licao, /exercicio\.visual && licaoEstilos\.perguntaComVisual/);
  assert.match(licao, /perguntaComVisual: \{ fontSize: 22/);
  assert.match(licao, /avaliacao\?\.correta && avaliacao\.visual && temProcurado\(exercicio\.visual\) \? \(\s*<DesenhoDoVisual key="retorno" visual=\{avaliacao\.visual\} contexto=\{CONTEXTO_DO_RETORNO\}/,
    'no acerto, o visual do retorno; no erro, segue o do enunciado');
  assert.match(licao, /key="enunciado" visual=\{exercicio\.visual\} contexto=\{CONTEXTO_DO_ENUNCIADO\}[^>]*entrada=\{false\}/);
  assert.match(licao, /passo, respostas, avaliacoes, primeiras/, 'as avaliações (com o visual do retorno) entram no andamento guardado');
});

test('o enunciado nunca desenha o procurado na posição; o retorno o desenha como resposta', async () => {
  const licao = await fixture('abscissas');
  const figura = normalizarVisual(licao.exercicio.visual);
  const enunciado = desenhoDoVisual(visualParaEnunciado(figura), { tipo: 'enunciado' });
  const retorno = desenhoDoVisual(visualRevelado(figura), { tipo: 'retorno' });
  assert.ok(enunciado.textos.some((texto) => /C\s*=\s*\?/.test(texto)), `"C = ?" na legenda: ${enunciado.textos.join(' | ')}`);
  assert.ok(!enunciado.textos.some((texto) => /^C\s*\(?\s*\d/.test(texto)), 'sem o valor de C no enunciado');
  assert.ok(retorno.primitivas.some((p) => (p.preenchimento ?? p.cor) === 'resposta'), 'o procurado vira resposta (verde)');
});

test('figura que não cabe na altura (naoCabe): no lugar dela, o alt em texto, com o mesmo rótulo', async () => {
  const fonte = await ler('apps/mobile/src/desenho.tsx');
  assert.match(fonte, /if \(desenho\.naoCabe && visual\.tipo !== 'formula'\) return <FiguraEmTexto alt=\{visual\.alt\} descricao=\{desenho\.descricao\} testID=\{testID\} \/>;/);
  assert.match(fonte, /accessibilityRole="text" accessibilityLabel=\{`Figura: \$\{descricao \|\| falarTextoComFormulas\(alt\)\}`\}/);
  const licao = await fixture('baricentro');
  const figura = visualParaEnunciado(normalizarVisual(licao.exercicio.visual));
  const apertado = desenhoDoVisual(figura, { tipo: 'enunciado' }, { alturaMaxima: 40 });
  assert.ok(!apertado || apertado.naoCabe || apertado.altura <= 40, 'o motor respeita a altura ou avisa que não cabe');
});

test('troca no acerto (spec 15, seção 12): a figura reenquadrada fica na caixa do enunciado, só a escala muda; o ponto resposta cresce numa camada própria', async () => {
  const { separarPontoResposta, medidasNaCaixa } = await import('../apps/mobile/src/desenho-svg.ts');
  for (const nome of ['baricentro', 'colinearidade']) {
    const licao = await fixture(nome);
    const figura = normalizarVisual(licao.exercicio.visual);
    const enunciado = desenhoDoVisual(visualParaEnunciado(figura), { tipo: 'enunciado' }, { alturaMaxima: 179 });
    const retorno = desenhoDoVisual(visualRevelado(figura), { tipo: 'retorno' }, { alturaMaxima: 179 });
    for (const largura of [302, 318, 343]) {
      const caixaEnunciado = medidasNaCaixa(enunciado, largura, enunciado.altura);
      const caixaRetorno = medidasNaCaixa(retorno, largura, enunciado.altura);
      assert.equal(caixaRetorno.alturaDaCaixa, caixaEnunciado.alturaDaCaixa, `${nome}: a caixa não muda (${largura})`);
      assert.ok(caixaRetorno.altura <= caixaRetorno.alturaDaCaixa + 0.01 && caixaRetorno.largura <= largura + 0.01, `${nome}: o retorno cabe na caixa`);
    }
    const camadas = separarPontoResposta(retorno.primitivas);
    assert.ok(camadas && camadas.ponto.length >= 1, `${nome}: o ponto resposta separado`);
    assert.equal(camadas.base.length + camadas.ponto.length, retorno.primitivas.length);
    assert.equal(separarPontoResposta(enunciado.primitivas), null, `${nome}: o enunciado não tem ponto resposta`);
  }
  const fonte = await ler('apps/mobile/src/desenho.tsx');
  assert.match(fonte, /entrada && \{ opacity: aparecer \}/, 'a figura nova aparece no lugar (200 ms), sem subir');
  assert.match(fonte, /const crescer = useAparecer\(200, 200\);/, 'depois, o ponto cresce em 200 ms (movimento reduzido: na hora)');
  assert.match(fonte, /transform: \[\{ scale: entrada \? crescer : 1 \}\]/);
  const licaoFonte = await ler('apps/mobile/src/licao.tsx');
  assert.match(licaoFonte, /testID="visual-retorno" caixa=\{caixaDaFigura\}/);
  assert.match(licaoFonte, /testID="visual-enunciado" entrada=\{false\} caixa=\{caixaDaFigura\}/);
  assert.match(licaoFonte, /\$\{certa && descricaoDaFigura \? ` \$\{descricaoDaFigura\}` : ''\}/, 'a descrição nova na fala do retorno, numa frase só');
  const resolva = await ler('apps/mobile/src/resolva-comigo.tsx');
  assert.match(resolva, /key=\{revela \? 'revelado' : 'passos'\}[\s\S]{0,200}entrada=\{revela\} caixa=\{caixa\}/);
  assert.match(resolva, /`\$\{t\.passo\(estado\.atual \+ 1, estado\.total\)\}\. \$\{descricao\}`/);
});
