import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  normalizarResolucao, normalizarVisual, normalizarVisuais, partirTextoComFormulas, resolucaoParaCliente, visualParaEnunciado, visualRevelado,
} from '../packages/contratos/src/aprendizado.ts';
import { desenhoDoVisual, temProcurado } from '../apps/mobile/src/desenho-svg.ts';
import { itensDaFrase } from '../apps/mobile/src/formula-em-linha.ts';
import { resolucaoUtil } from '../apps/mobile/src/resolva-comigo-regras.ts';

// Casos que saíram da IA de verdade (cb532bb), com o que o servidor guarda (tests/fixtures/matematica/reais, sem a citação do
// material): o app trata cada um sem buraco na tela.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const real = async (nome) => JSON.parse(await ler(`tests/fixtures/matematica/reais/${nome}.json`));

test('(a) figura do exercício sem ponto procurado: enunciado e retorno são a mesma figura, e a troca no acerto não acontece', async () => {
  const caso = await real('a-figura-sem-procurado');
  const figura = normalizarVisual(caso.exercicios[0].visual);
  assert.ok(figura && figura.tipo === 'plano', 'a figura vale');
  assert.equal(temProcurado(figura), false);
  // Em 390 (200 de altura) desenha; no iPhone SE (158) o motor diz que não cabe e o app mostra o alt em texto, nos dois estados.
  for (const alturaMaxima of [158, 200]) {
    const enunciado = desenhoDoVisual(visualParaEnunciado(figura), { tipo: 'enunciado' }, { alturaMaxima });
    const retorno = desenhoDoVisual(visualRevelado(figura), { tipo: 'retorno' }, { alturaMaxima });
    assert.ok(enunciado, `o motor responde em ${alturaMaxima}`);
    assert.equal(Boolean(enunciado.naoCabe), alturaMaxima < 190, `naoCabe em ${alturaMaxima}`);
    assert.equal(Boolean(retorno.naoCabe), Boolean(enunciado.naoCabe));
    assert.deepEqual(retorno.primitivas, enunciado.primitivas, `o mesmo desenho em ${alturaMaxima}`);
  }
  const licao = await ler('apps/mobile/src/licao.tsx');
  assert.match(licao, /avaliacao\?\.correta && avaliacao\.visual && temProcurado\(exercicio\.visual\) \? \(/, 'sem procurado, fica a figura do enunciado (sem remontar nem animar)');
  assert.match(licao, /if \(!avaliacao\?\.correta \|\| !avaliacao\.visual \|\| !temProcurado\(exercicio\?\.visual\)\) return undefined;/, 'e o leitor de tela não ouve descrição nova');
  const resolva = await ler('apps/mobile/src/resolva-comigo.tsx');
  assert.match(resolva, /const revela = ultimo && temProcurado\(resolucao\.visual\);/);
  assert.match(resolva, /key=\{revela \? 'revelado' : 'passos'\}[\s\S]{0,200}entrada=\{revela\}/, 'no último passo, sem procurado, nada pisca');
});

test('(b) visuais parciais (2 de 3 aceitos) e exercício sem figura: os aceitos desenham, e o exercício fica só com o enunciado', async () => {
  const caso = await real('b-visuais-parciais-sem-figura');
  const visuais = normalizarVisuais(caso.visuais) ?? [];
  assert.equal(visuais.length, caso.relato.visuais.aceitos);
  assert.ok(caso.relato.visuais.aceitos < caso.relato.visuais.enviados, 'o caso é parcial');
  for (const visual of visuais) assert.ok(desenhoDoVisual(visual, { tipo: 'enunciado' }, { tamanho: 22, fundo: true }), visual.latex ?? visual.tipo);
  assert.equal(caso.exercicios[0].visual, null);
  const licao = await ler('apps/mobile/src/licao.tsx');
  assert.match(licao, /\{exercicio\.visual && \(avaliacao/, 'sem figura, nada no lugar dela');
  assert.match(licao, /exercicio\.visual && licaoEstilos\.perguntaComVisual/, 'o enunciado só desce para 22 com figura');
});

test('(c) resolução recusada: a lição cai no exemplo em texto, sem espaço vazio', async () => {
  const caso = await real('c-resolucao-recusada');
  assert.equal(caso.resolucao, null); assert.equal(caso.relato.resolucao.aceita, false);
  assert.equal(resolucaoUtil(caso.resolucao ?? undefined), false);
  const licao = await ler('apps/mobile/src/licao.tsx');
  assert.match(licao, /etapa\.tipo === 'exemplo' && !resolva\.ativo && \(/, 'o exemplo em texto de sempre');
  assert.match(licao, /etapa\.tipo === 'exemplo' && resolva\.ativo && <View/, 'o "Resolva comigo" só com resolução');
});

test('(d) "Sua vez" só com fórmulas (texto nulo), de largura parecida: as três desenhadas, sem caractere cru, em 390, 320 e 200%', async () => {
  const caso = await real('d-sua-vez-so-formulas');
  const guardada = normalizarResolucao(caso.resolucao);
  assert.ok(guardada, 'a resolução real vale');
  const cliente = resolucaoParaCliente(guardada);
  const suaVez = cliente.passos.find((passo) => passo.tentativa);
  assert.ok(suaVez && suaVez.tentativa.opcoes.length === 3);
  for (const opcao of suaVez.tentativa.opcoes) assert.ok(opcao.formula && !opcao.texto, 'só fórmula');
  for (const [escala, limite] of [[1, 260], [1, 200], [2, 260]]) {
    const larguras = suaVez.tentativa.opcoes.map((opcao) => {
      const itens = itensDaFrase(partirTextoComFormulas(`$${opcao.formula}$`), 16, escala, limite);
      for (const item of itens) if (item.tipo === 'texto') assert.doesNotMatch(item.texto, /[_^\\{}$]/, item.texto);
      assert.ok(itens.some((item) => item.tipo === 'desenho'), `${opcao.formula} desenhada (escala ${escala})`);
      return itens.reduce((soma, item) => soma + (item.tipo === 'desenho' ? item.desenho.largura * escala : 0), 0);
    });
    assert.ok(Math.max(...larguras) / Math.min(...larguras) < 2, `larguras parecidas: ${larguras.map(Math.round).join(', ')}`);
  }
  assert.match(await ler('apps/mobile/src/resolva-comigo.tsx'), /return opcao\.formula && formulaEmTexto\(opcao\.formula\) \? `\$\$\{opcao\.formula\}\$` : '';/);
});

test('(d) leitor de tela: a opção e o grupo do "Sua vez" leem a fórmula falada, nunca o "$…$" cru', async () => {
  const { falarTextoComFormulas } = await import('../packages/contratos/src/aprendizado.ts');
  assert.match(await ler('apps/mobile/src/opcao.tsx'), /accessibilityLabel=\{falarTextoComFormulas\(texto\)\}/);
  assert.match(await ler('apps/mobile/src/resolva-comigo.tsx'), /accessibilityRole="radiogroup" accessibilityLabel=\{falarTextoComFormulas\(tentativa\.pergunta\)\}/);
  const caso = await real('d-sua-vez-so-formulas');
  const suaVez = resolucaoParaCliente(normalizarResolucao(caso.resolucao)).passos.find((passo) => passo.tentativa);
  for (const opcao of suaVez.tentativa.opcoes) assert.doesNotMatch(falarTextoComFormulas(`$${opcao.formula}$`), /[$\\_^{}]/);
});

test('(d) os passos feitos mostram a fórmula desenhada (em peças se larga), nunca o linear com "_"', async () => {
  const fonte = await ler('apps/mobile/src/resolva-comigo.tsx');
  assert.match(fonte, /<TextoComFormulas texto=\{`\$\$\{passo\.formula\}\$`\} estilo=\{estilos\.feitoFormula\} numberOfLines=\{1\} \/>/);
  assert.doesNotMatch(fonte, /\{formula\.texto\}/);
});

test('revisão do Designer (spec 15, seção 13) sobre os casos reais', async () => {
  const desenho = await ler('apps/mobile/src/desenho.tsx');
  // (1) figura que não cabe: linha discreta, ícone de gráfico de 16, 14/20 #5E6A85 (textoSecundario), sem caixa; "Figura: <alt>".
  assert.match(desenho, /accessibilityLabel=\{`Figura: \$\{alt\}`\}/);
  assert.match(desenho, /<Icone nome="grafico" tamanho=\{16\} cor=\{cores\.textoSecundario\}/);
  assert.match(desenho, /color: cores\.textoSecundario, fontFamily: fontes\.corpo, fontSize: 14, lineHeight: 20/);
  const figura = desenho.slice(desenho.indexOf('function FiguraEmTexto'), desenho.indexOf('const blocoDaFormula'));
  assert.doesNotMatch(figura, /blocoDaFormula|backgroundColor/, 'sem caixa');
  // (3) a pergunta do "Sua vez" no peso que o motor desenha (700), o mesmo da fórmula em linha.
  const resolva = await ler('apps/mobile/src/resolva-comigo.tsx');
  assert.match(resolva, /pergunta: \{ color: cores\.texto, fontFamily: fontes\.corpo, fontWeight: '700'/);
  // (5) antes da escolha, nenhum bloco de fórmula no cartão do "Sua vez".
  assert.doesNotMatch(resolva, /resolva-formula-contexto|formulaDeContexto\(/);
  // (4) o bloco da equação real do b1 reduz (≥ 85%) e fica com 12 de folga de cada lado, sem rolar.
  const { ajusteDoBloco, FOLGA_DO_BLOCO } = await import('../apps/mobile/src/desenho-svg.ts');
  const caso = await real('b-visuais-parciais-sem-figura');
  const visuais = normalizarVisuais(caso.visuais);
  const larga = visuais.find((v) => v.tipo === 'formula' && v.latex.includes('5k'));
  const d = desenhoDoVisual(larga, { tipo: 'enunciado' }, { tamanho: 22, fundo: true });
  const ajuste = ajusteDoBloco(d);
  assert.ok(ajuste && ajuste.fator >= 0.85 && ajuste.fator < 1, `reduz: ${ajuste?.fator}`);
  const [, , vistaLargura] = ajuste.viewBox.split(' ').map(Number);
  const xs = ajuste.conteudo.flatMap((p) => (p.tipo === 'caminho' ? [...p.d.matchAll(/(-?\d*\.?\d+)[\s,]+(-?\d*\.?\d+)/g)].map((m) => Number(m[1])) : p.tipo === 'linha' ? [p.x1, p.x2] : []));
  const larguraDoConteudo = Math.max(...xs) - Math.min(...xs);
  assert.ok(((vistaLargura - larguraDoConteudo) / 2) * ajuste.fator >= FOLGA_DO_BLOCO - 0.01, 'folga de 12 de cada lado');
  const determinante = desenhoDoVisual(visuais.find((v) => v.latex.includes('vmatrix')), { tipo: 'enunciado' }, { tamanho: 22, fundo: true });
  assert.equal(ajusteDoBloco(determinante), null, 'o que já cabe com folga fica como o motor desenhou');
});
