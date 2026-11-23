// W4 (fase 2 do site): os casos que saíram da IA de verdade (cb532bb, com o que o servidor guarda, sem a citação do material; as mesmas fixtures do app em
// tests/fixtures/matematica/reais) e o que a web faz com cada um: sem buraco na tela, sem caractere cru, sem espaço vazio, e igual ao app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  falarTextoComFormulas, normalizarResolucao, normalizarVisual, normalizarVisuais, partirTextoComFormulas, resolucaoParaCliente, visualParaEnunciado, visualRevelado,
} from '@studoo/contratos';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const { VisuaisDaLicao, caixaDaFigura, descricaoDaFiguraRevelada } = await import('../src/app/desenho.tsx');
const { EtapaExercicio } = await import('../src/app/aula.tsx');
const { CorpoDoResolva, textoDaOpcao } = await import('../src/app/resolva-comigo.tsx');
const { ajusteDoBloco, desenhoDoVisual, FOLGA_DO_BLOCO, temProcurado } = await import('../src/app/desenho-svg.ts');
const { itensDaFrase } = await import('../src/app/formula-em-linha.ts');
const { avancar, comecarResolva, indiceDoSuaVez, resolucaoUtil } = await import('../src/app/resolva-comigo-regras.ts');

const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const real = (nome) => JSON.parse(ler(`tests/fixtures/matematica/reais/${nome}.json`));
const exercicio = (extra = {}) => ({ tipo: 'multipla_escolha', enunciado: 'Qual é a resposta?', opcoes: [{ id: 'a', texto: '$x = 1$' }, { id: 'b', texto: '$x = 2$' }, { id: 'c', texto: '$x = 3$' }], ...extra });
const etapaDoExercicio = (props) => renderToStaticMarkup(createElement(EtapaExercicio, {
  indice: 0, total: 1, resposta: '', inicial: '', mudar() {}, ocupado: false, responder() {}, formulario: null, titulo: null, avaliacao: null, ...props,
}));
const visiveis = (html) => html.replace(/<span class="somente-leitor">[^<]*<\/span>/g, '').replace(/aria-label="[^"]*"/g, '').replace(/<[^>]*>/g, ' ');

test('(a) figura do exercício sem ponto procurado: enunciado e retorno são a mesma figura, e a troca no acerto não acontece', () => {
  const caso = real('a-figura-sem-procurado');
  const figura = normalizarVisual(caso.exercicios[0].visual);
  assert.ok(figura && figura.tipo === 'plano', 'a figura vale');
  assert.equal(temProcurado(figura), false);
  // Em 390 (200 de altura) desenha; no iPhone SE (158) o motor diz que não cabe e o site mostra o alt em texto, nos dois estados.
  for (const alturaMaxima of [158, 200]) {
    const enunciado = desenhoDoVisual(visualParaEnunciado(figura), { tipo: 'enunciado' }, { alturaMaxima });
    const retorno = desenhoDoVisual(visualRevelado(figura), { tipo: 'retorno' }, { alturaMaxima });
    assert.ok(enunciado, `o motor responde em ${alturaMaxima}`);
    assert.equal(Boolean(enunciado.naoCabe), alturaMaxima < 190, `naoCabe em ${alturaMaxima}`);
    assert.equal(Boolean(retorno.naoCabe), Boolean(enunciado.naoCabe));
    assert.deepEqual(retorno.primitivas, enunciado.primitivas, `o mesmo desenho em ${alturaMaxima}`);
  }
  // Na tela: depois do acerto continua a figura do enunciado, sem remontar nem animar, e o leitor de tela não ouve descrição nova.
  const doEnunciado = visualParaEnunciado(figura);
  const revelada = visualRevelado(figura);
  const props = { exercicio: exercicio({ visual: doEnunciado }), alturaDaFigura: 203, caixaDaFigura: caixaDaFigura(doEnunciado, 203) };
  const antes = etapaDoExercicio(props);
  const certa = etapaDoExercicio({ ...props, avaliacao: { correta: true, feedback: 'Isso!', comprovante: 'c', visual: revelada }, descricaoDoRetorno: descricaoDaFiguraRevelada(doEnunciado, revelada, 203) });
  assert.match(certa, /data-testid="visual-enunciado"/);
  assert.doesNotMatch(certa, /visual-retorno|data-entrada|desenho__ponto/, 'nada troca nem pisca');
  assert.equal(descricaoDaFiguraRevelada(doEnunciado, revelada, 203), undefined);
  assert.equal(antes.match(/aspect-ratio:320 \/ ([\d.]+)/)[1], certa.match(/aspect-ratio:320 \/ ([\d.]+)/)[1], 'a mesma caixa');
  // No "Resolva comigo": sem procurado, o último passo não revela nada (nada pisca).
  const resolucao = normalizarResolucao(caso.resolucao);
  if (resolucao?.visual) assert.equal(temProcurado(resolucao.visual), false);
  assert.match(ler('src/app/resolva-comigo.tsx'), /const revela = ultimo && temProcurado\(resolucao\.visual\);/);
});

test('(b) visuais parciais (2 de 3 aceitos) e exercício sem figura: os aceitos desenham, e o exercício fica só com o enunciado', () => {
  const caso = real('b-visuais-parciais-sem-figura');
  const visuais = normalizarVisuais(caso.visuais) ?? [];
  assert.equal(visuais.length, caso.relato.visuais.aceitos);
  assert.ok(caso.relato.visuais.aceitos < caso.relato.visuais.enviados, 'o caso é parcial');
  for (const visual of visuais) assert.ok(desenhoDoVisual(visual, { tipo: 'enunciado' }, { tamanho: 22, fundo: true }), visual.latex ?? visual.tipo);
  const html = renderToStaticMarkup(createElement(VisuaisDaLicao, { visuais }));
  assert.equal((html.match(/data-testid="visual-licao-/g) ?? []).length, visuais.length, 'os aceitos aparecem, nenhum buraco');
  assert.equal(caso.exercicios[0].visual, null);
  const sem = etapaDoExercicio({ exercicio: exercicio() });
  assert.doesNotMatch(sem, /aula-figura|data-com-visual|role="img"/, 'sem figura, nada no lugar dela');
});

test('(c) resolução recusada: a lição cai no exemplo em texto, sem espaço vazio', () => {
  const caso = real('c-resolucao-recusada');
  assert.equal(caso.resolucao, null);
  assert.equal(caso.relato.resolucao.aceita, false);
  assert.equal(resolucaoUtil(caso.resolucao ?? undefined), false);
  assert.match(ler('src/app/aula.tsx'), /etapa\.tipo === 'exemplo' && \(resolva\.ativo \? resolva\.corpo : <EtapaExemplo/, 'o exemplo em texto de sempre; o "Resolva comigo" só com resolução');
});

test('(d) "Sua vez" só com fórmulas (texto nulo), de largura parecida: as três desenhadas, sem caractere cru, em 390, 320 e 200%', () => {
  const caso = real('d-sua-vez-so-formulas');
  const guardada = normalizarResolucao(caso.resolucao);
  assert.ok(guardada, 'a resolução real vale');
  const cliente = resolucaoParaCliente(guardada);
  const suaVez = cliente.passos.find((passo) => passo.tentativa);
  assert.ok(suaVez && suaVez.tentativa.opcoes.length === 3);
  for (const opcao of suaVez.tentativa.opcoes) assert.ok(opcao.formula && !opcao.texto, 'só fórmula');
  // Antes da escolha, nada traz o resultado.
  const certa = guardada.passos.find((passo) => passo.tentativa).tentativa.opcoes.find((opcao) => opcao.correta).formula;
  const resultado = falarTextoComFormulas(`$${certa}$`);
  for (const texto of [suaVez.texto, suaVez.nome, suaVez.tentativa.pergunta]) assert.ok(!falarTextoComFormulas(texto).includes(resultado), `"${texto}" não traz "${resultado}"`);
  assert.equal(suaVez.formula, undefined, 'nem a fórmula revelada');
  for (const [escala, limite] of [[1, 260], [1, 200], [2, 260]]) {
    const larguras = suaVez.tentativa.opcoes.map((opcao) => {
      const itens = itensDaFrase(partirTextoComFormulas(`$${opcao.formula}$`), 16, escala, limite);
      for (const item of itens) if (item.tipo === 'texto') assert.doesNotMatch(item.texto, /[_^\\{}$]/, item.texto);
      assert.ok(itens.some((item) => item.tipo === 'desenho'), `${opcao.formula} desenhada (escala ${escala})`);
      return itens.reduce((soma, item) => soma + (item.tipo === 'desenho' ? item.desenho.largura * escala : 0), 0);
    });
    assert.ok(Math.max(...larguras) / Math.min(...larguras) < 2, `larguras parecidas: ${larguras.map(Math.round).join(', ')}`);
  }
  // Na tela: as três opções, a fórmula marcada (a mesma do app) e nenhum caractere cru no que se vê; o leitor de tela lê a fórmula falada.
  for (const opcao of suaVez.tentativa.opcoes) assert.equal(textoDaOpcao(opcao), `$${opcao.formula}$`);
  let estado = comecarResolva(cliente);
  while (estado.atual < indiceDoSuaVez(cliente.passos)) estado = avancar(estado);
  const html = renderToStaticMarkup(createElement(CorpoDoResolva, { resolucao: cliente, estado, formulaGeral: undefined, ocupado: false, escolher() {}, voltarUmPasso() {} }));
  assert.equal((html.match(/<label>/g) ?? []).length, 3, 'as três opções');
  assert.match(html, /role="radiogroup" aria-labelledby=/);
  for (const opcao of suaVez.tentativa.opcoes) assert.doesNotMatch(falarTextoComFormulas(`$${opcao.formula}$`), /[$\\_^{}]/);
  const pergunta = /<legend[^>]*>(.*?)<\/legend>/s.exec(html)?.[1];
  if (pergunta) assert.doesNotMatch(visiveis(pergunta), /[$\\_^{}]/, 'a pergunta sem cifrão');
});

test('(d) os passos feitos mostram a fórmula desenhada (em peças se larga), nunca o linear com "_"', () => {
  const caso = real('d-sua-vez-so-formulas');
  const cliente = resolucaoParaCliente(normalizarResolucao(caso.resolucao));
  let estado = comecarResolva(cliente);
  while (estado.atual < indiceDoSuaVez(cliente.passos)) estado = avancar(estado);
  const html = renderToStaticMarkup(createElement(CorpoDoResolva, { resolucao: cliente, estado, formulaGeral: undefined, ocupado: false, escolher() {}, voltarUmPasso() {} }));
  assert.doesNotMatch(visiveis(html), /[$\\^{}]|\b[a-z]_[A-Za-z0-9]/, 'nenhum cifrão, barra, acento circunflexo, chave ou sublinhado de índice no que se vê');
});

test('revisão do Designer (spec 15, seção 13) sobre os casos reais: o bloco da equação real reduz (≥ 85%) e fica com 12 de folga de cada lado, sem rolar', () => {
  const caso = real('b-visuais-parciais-sem-figura');
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
