// Fase 2 do site (spec 15): o desenho do motor na web (visuais da lição e a fórmula em linha), o mesmo motor e as mesmas regras do app.
// Sem navegador: renderToStaticMarkup, com o CSS trocado por nada. As capturas em 390, 768 e 1280 são de navegador de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CABECALHO_CAPACIDADES, falarFormula, lerFormula, normalizarVisual, visualParaEnunciado, visualRevelado } from '@studoo/contratos';
import { mensagens } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const { DesenhoDoVisual, VisuaisDaLicao, OPCOES_DA_FORMULA, CONTEXTO_DO_ENUNCIADO, CONTEXTO_DO_RETORNO } = await import('../src/app/desenho.tsx');
const { TextoComFormulas, montarItens } = await import('../src/app/texto-com-formulas.tsx');
const { itensDaFrase } = await import('../src/app/formula-em-linha.ts');
const { desenhoDoVisual, ordenarVisuais } = await import('../src/app/desenho-svg.ts');
const { partirTextoComFormulas } = await import('@studoo/contratos');

const fixture = (nome) => JSON.parse(readFileSync(join(raiz, `tests/fixtures/matematica/${nome}.json`), 'utf8')).licao;
const html = (elemento) => renderToStaticMarkup(elemento);

test('as regras puras são as mesmas do app (arquivo idêntico) quando o app já as tem; a lista de arquivos é a de sempre', () => {
  for (const arquivo of ['desenho-svg.ts', 'formula-em-linha.ts', 'resolva-comigo-regras.ts']) {
    assert.ok(existsSync(join(raiz, 'src/app', arquivo)), arquivo);
    const doApp = join(raiz, 'apps/mobile/src', arquivo);
    // O app fica em outro ramo até a junção: depois dela, o arquivo tem de ser o mesmo byte a byte.
    if (existsSync(doApp)) assert.equal(readFileSync(join(raiz, 'src/app', arquivo), 'utf8'), readFileSync(doApp, 'utf8'), `${arquivo} diverge do app`);
  }
});

test('os textos do "Resolva comigo" vêm do contrato, os mesmos da spec, e o "Verificar" é o da lição', () => {
  const t = mensagens.resolvaComigo;
  assert.deepEqual(
    { selo: t.selo, proximo: t.proximo, voltar: t.voltar, suaVez: t.suaVez, isso: t.isso, tentarDeNovo: t.tentarDeNovo, metodo: t.metodo, agora: t.agora, verificar: t.verificar },
    { selo: 'Resolva comigo', proximo: 'Próximo passo', voltar: 'Voltar um passo', suaVez: 'Sua vez', isso: 'Isso!', tentarDeNovo: 'Tentar de novo', metodo: 'O método', agora: 'Agora é com você', verificar: mensagens.licao.avaliar },
  );
  assert.equal(t.passo(2, 4), 'Passo 2 de 4');
});

test('o cliente da web manda o cabeçalho de capacidades em toda chamada e na geração ao vivo; "Sua vez" é um POST com a opção e a tentativa', async () => {
  const { CAPACIDADES_DO_SITE } = await import('../src/contratos/capacidades.ts');
  assert.equal(CAPACIDADES_DO_SITE, 'visuais@1,resolucao@1');
  assert.equal(CABECALHO_CAPACIDADES, 'X-Studoo-Capacidades');
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (caminho, opcoes) => {
    chamadas.push({ caminho, opcoes });
    return new Response(JSON.stringify({ correta: true, porque: 'ok' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { responderSuaVez } = await import('../src/contratos/cliente-web.ts');
    const corpo = await responderSuaVez('lic 1', { opcao: 2, tentativa: 1 });
    assert.deepEqual(corpo, { correta: true, porque: 'ok' });
    assert.equal(chamadas[0].caminho, '/api/aprendizado/licoes/lic%201/resolucao');
    assert.equal(chamadas[0].opcoes.method, 'POST');
    assert.equal(chamadas[0].opcoes.headers[CABECALHO_CAPACIDADES], CAPACIDADES_DO_SITE);
    assert.equal(chamadas[0].opcoes.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), { opcao: 2, tentativa: 1 });
    // O contrato de sempre (buscar a lição) também leva o cabeçalho.
    const { clienteStudooWeb } = await import('../src/contratos/cliente-web.ts');
    await clienteStudooWeb.obterLicao('x').catch(() => undefined);
    const lida = chamadas.find((chamada) => chamada.caminho.includes('/api/aprendizado/licoes/x') && !chamada.caminho.endsWith('/resolucao'));
    assert.ok(lida, 'a leitura da lição foi chamada');
    assert.equal(lida.opcoes.headers[CABECALHO_CAPACIDADES], CAPACIDADES_DO_SITE);
    // A geração ao vivo, com o mesmo cabeçalho.
    const { gerarTrilhaAoVivo } = await import('../src/app/geracao-ao-vivo.ts');
    await gerarTrilhaAoVivo('geometria analítica', new AbortController().signal).next().catch(() => undefined);
    const ao_vivo = chamadas.find((chamada) => chamada.caminho === '/api/aprendizado/propostas/ao-vivo');
    assert.ok(ao_vivo);
    assert.equal(ao_vivo.opcoes.headers[CABECALHO_CAPACIDADES], CAPACIDADES_DO_SITE);
  } finally {
    globalThis.fetch = original;
  }
  // Um erro da API vira ErroStudoo (o "Sua vez" cai no exemplo em texto): nunca trava.
  globalThis.fetch = async () => new Response(JSON.stringify({ codigo: 'nao_encontrada' }), { status: 404, headers: { 'content-type': 'application/json' } });
  try {
    const { responderSuaVez } = await import('../src/contratos/cliente-web.ts');
    await assert.rejects(() => responderSuaVez('x', { opcao: 0, tentativa: 1 }), (erro) => erro.name === 'ErroStudoo');
  } finally {
    globalThis.fetch = original;
  }
});

test('visuais da lição: a fórmula em bloco antes do diagrama, imagem com o texto falado, sem $ nem barra crua', () => {
  const licao = fixture('baricentro');
  const visuais = licao.visuais.map(normalizarVisual).filter(Boolean);
  assert.deepEqual(ordenarVisuais([visuais.find((v) => v.tipo !== 'formula'), visuais.find((v) => v.tipo === 'formula')]).map((v) => v.tipo), ['formula', 'plano']);
  const saida = html(createElement(VisuaisDaLicao, { visuais }));
  assert.ok(saida.indexOf('visual-licao-formula') >= 0 && saida.indexOf('visual-licao-formula') < saida.indexOf('visual-licao-plano'), 'a fórmula vem antes');
  assert.equal((saida.match(/role="img"/g) ?? []).length, visuais.length);
  assert.match(saida, /<div class="desenho" role="img" aria-label="x índice G é igual a [^"]*" data-testid="visual-licao-formula" style="max-width:400px">/, 'a fórmula em bloco, com a largura máxima de 400');
  assert.match(saida, /<rect x="0" y="0" width="320" height="[\d.]+" rx="14" fill="#F1F4FD">/, 'e o fundo do próprio motor');
  assert.match(saida, /aria-label="x índice G é igual a/, 'o texto falado da fórmula');
  assert.doesNotMatch(saida, /\$|\\frac|\\times|<script/);
  assert.equal((saida.match(/<svg /g) ?? []).length, visuais.length);
  assert.doesNotMatch(saida, /data-entrada/, 'os visuais da lição abertos não animam a entrada');
  // O plano usa o alt do contrato como nome (o motor monta a descrição); a imagem não é focável e o desenho não é lido.
  assert.match(saida, /<svg viewBox="0 0 [\d.]+ [\d.]+" focusable="false" aria-hidden="true">/);
});

test('visual inválido some sem deixar espaço; fórmula que o motor não desenha vira o texto linear; figura que não cabe vira uma linha discreta', () => {
  // O que não desenha deixa o contêiner vazio, e o CSS (`.aula-visuais:empty`) o tira do lugar: nenhum vão, nenhum aviso.
  assert.equal(html(createElement(VisuaisDaLicao, { visuais: [{ tipo: 'formula', latex: String.raw`\input{segredo}` }, { tipo: 'grafico_funcao', alt: 'x' }] })), '<div class="aula-visuais"></div>');
  assert.match(readFileSync(join(raiz, 'src/app/aula.css'), 'utf8'), /\.aula-visuais:empty \{ display: none; margin: 0; \}/);
  assert.equal(html(createElement(VisuaisDaLicao, { visuais: undefined })), '');
  assert.equal(html(createElement(VisuaisDaLicao, { visuais: [] })), '');
  assert.equal(html(createElement(DesenhoDoVisual, { visual: { tipo: 'formula', latex: String.raw`\input{segredo}` }, contexto: CONTEXTO_DO_ENUNCIADO })), '');
  const baricentro = fixture('baricentro');
  const figura = normalizarVisual(baricentro.visuais.find((v) => v.tipo === 'plano'));
  // Uma altura impossível: o motor avisa (`naoCabe`) e a web mostra o alt numa linha, com o ícone e o "Figura:" só para o leitor de tela.
  const apertada = html(createElement(DesenhoDoVisual, { visual: figura, contexto: CONTEXTO_DO_ENUNCIADO, opcoes: { alturaMaxima: 40 }, testID: 'f' }));
  assert.match(apertada, /class="figura-em-texto"/);
  assert.match(apertada, /<span class="somente-leitor">Figura: <\/span>/);
  assert.ok(apertada.includes(figura.alt));
  assert.doesNotMatch(apertada, /<div|role="img"/, 'sem caixa');
});

test('enunciado e retorno: o plano com o procurado e a resposta; sem ponto procurado, o desenho do retorno é o mesmo', () => {
  const figura = normalizarVisual(fixture('baricentro').exercicio.visual);
  const enunciado = html(createElement(DesenhoDoVisual, { visual: visualParaEnunciado(figura), contexto: CONTEXTO_DO_ENUNCIADO, entrada: false }));
  const retorno = html(createElement(DesenhoDoVisual, { visual: visualRevelado(figura), contexto: CONTEXTO_DO_RETORNO, entrada: true }));
  assert.notEqual(enunciado, retorno);
  assert.match(retorno, /data-entrada="true"/);
  assert.doesNotMatch(enunciado, /data-entrada/);
  assert.doesNotMatch(enunciado, /\(4, 0\)|C \(/, 'o enunciado não diz onde está o C');
});

test('a figura na caixa do exercício: proporção fixa da caixa, o ponto resposta em camada própria que cresce depois', () => {
  const figura = normalizarVisual(fixture('baricentro').exercicio.visual);
  const desenhoDoEnunciado = desenhoDoVisual(visualParaEnunciado(figura), CONTEXTO_DO_ENUNCIADO, { alturaMaxima: 203 });
  assert.ok(desenhoDoEnunciado && !desenhoDoEnunciado.naoCabe);
  const caixa = desenhoDoEnunciado.altura;
  const noRetorno = html(createElement(DesenhoDoVisual, { visual: visualRevelado(figura), contexto: CONTEXTO_DO_RETORNO, opcoes: { alturaMaxima: 203 }, caixa, entrada: true, testID: 'v' }));
  assert.match(noRetorno, new RegExp(`aspect-ratio:320 / ${String(caixa).replace('.', '\\.')}`));
  assert.match(noRetorno, /class="desenho__ponto" style="transform-origin:[\d.]+px [\d.]+px"/, 'o ponto resposta cresce a partir do centro dele');
  assert.match(noRetorno, /preserveAspectRatio="xMidYMid meet"/);
  const doEnunciado = html(createElement(DesenhoDoVisual, { visual: visualParaEnunciado(figura), contexto: CONTEXTO_DO_ENUNCIADO, opcoes: { alturaMaxima: 203 }, caixa, entrada: false }));
  assert.match(doEnunciado, new RegExp(`aspect-ratio:320 / ${String(caixa).replace('.', '\\.')}`), 'a MESMA caixa: nada pula na troca');
  assert.doesNotMatch(doEnunciado, /desenho__ponto/, 'sem ponto resposta no enunciado');
});

test('a fórmula larga em bloco: reduz até 85% antes de rolar, e só abaixo disso rola para o lado', () => {
  const larga = { tipo: 'formula', latex: String.raw`(-5) + (-k) + 2 - 5k - (-1) - (-2) = 0` };
  const saida = html(createElement(DesenhoDoVisual, { visual: larga, contexto: CONTEXTO_DO_ENUNCIADO, opcoes: OPCOES_DA_FORMULA, entrada: false }));
  assert.match(saida, /class="desenho desenho--bloco"/);
  assert.match(saida, /<g transform="scale\(0\.\d+\) translate\(/, 'o conteúdo reduzido e centralizado dentro do fundo');
  const enorme = { tipo: 'formula', latex: String.raw`x_A + x_B + x_C + x_D + x_E + x_F + x_G + x_H + x_I + x_J + x_K + x_L + x_M + x_N = 0` };
  const rolando = html(createElement(DesenhoDoVisual, { visual: enorme, contexto: CONTEXTO_DO_ENUNCIADO, opcoes: OPCOES_DA_FORMULA, entrada: false }));
  assert.doesNotMatch(rolando, /desenho--bloco/);
});

/* ----- A fórmula dentro da frase ----- */

const MEDIDAS = { tamanho: 16, peso: 400, largura: 320 };

test('texto com fórmula: sem medir (servidor ou primeira pintura) vai em texto linear, nunca com $ ou barra', () => {
  const texto = 'Com $x_A = 1$ e $x_B = 5$, o ponto médio é $x_M = (x_A + x_B) / 2$.';
  const saida = html(createElement(TextoComFormulas, { como: 'p', className: 'introducao', texto }));
  assert.equal(saida, '<p class="introducao">Com x_A = 1 e x_B = 5, o ponto médio é x_M = (x_A + x_B) ÷ 2.</p>');
  assert.doesNotMatch(saida, /\$|\\/);
  // Sem fórmula: o elemento de sempre.
  assert.equal(html(createElement(TextoComFormulas, { como: 'h1', id: 'etapa-aula', tabIndex: -1, className: 'aula-pergunta', texto: 'Qual é o ponto?' })), '<h1 id="etapa-aula" tabindex="-1" class="aula-pergunta">Qual é o ponto?</h1>');
  assert.equal(html(createElement(TextoComFormulas, { texto: 'R$ 5,00 e mais $3$' })), '<span>R$ 5,00 e mais 3</span>', 'dinheiro não é fórmula');
  // Uma marca que não lê (comando fora da lista) cai em texto, e nunca derruba o texto.
  assert.doesNotMatch(html(createElement(TextoComFormulas, { como: 'p', texto: String.raw`Veja $\input{x}$ aqui.` })), /\\input/);
});

test('texto com fórmula medido: o desenho do motor no meio da frase, o texto falado só para o leitor de tela, a cor e o peso do texto em volta', () => {
  const texto = 'O ponto médio é $x_M = \\frac{x_A + x_B}{2}$, certo?'.replace('\\\\', '\\');
  const saida = html(createElement(TextoComFormulas, { como: 'p', texto, medidas: MEDIDAS }));
  assert.match(saida, /^<p data-formulas="">/);
  assert.match(saida, /<span class="somente-leitor">O ponto médio é x índice M é igual a .*, certo\?<\/span>/);
  assert.match(saida, /<span aria-hidden="true">O ponto médio é <span class="formula-em-linha"/);
  assert.match(saida, /data-testid="formula-em-linha" aria-hidden="true" style="width:[\d.]+px;height:[\d.]+px"/);
  assert.match(saida, /<svg width="[\d.]+" height="[\d.]+" viewBox="0 0 [\d.]+ [\d.]+" focusable="false">/);
  assert.match(saida, /currentColor/, 'o traço do texto toma a cor da frase');
  assert.doesNotMatch(saida, /\$|\\frac/);
  // O peso é o do texto em volta: 400 e 700 desenham diferente.
  const regular = html(createElement(TextoComFormulas, { como: 'p', texto: 'Soma $a + b$ aqui', medidas: { ...MEDIDAS, peso: 400 } }));
  const negrito = html(createElement(TextoComFormulas, { como: 'p', texto: 'Soma $a + b$ aqui', medidas: { ...MEDIDAS, peso: 700 } }));
  assert.notEqual(regular, negrito);
  // Maior a letra, maior a fórmula (a letra grande do sistema e o zoom entram pela medida).
  const grande = html(createElement(TextoComFormulas, { como: 'p', texto: 'Soma $a + b$ aqui', medidas: { ...MEDIDAS, tamanho: 24 } }));
  const largura = (marcacao) => Number(/class="formula-em-linha"[^>]*style="width:([\d.]+)px/.exec(marcacao)[1]);
  assert.ok(largura(grande) > largura(regular) * 1.4);
});

test('a pontuação de fechar vai com a fórmula, sem quebra; o parêntese de abrir também', () => {
  const trechos = partirTextoComFormulas('Veja ($a$), e depois $b$.');
  const itens = itensDaFrase(trechos, 16, 1, 260, 400);
  const saida = renderToStaticMarkup(createElement('p', null, ...montarItens(itens)));
  assert.match(saida, /Veja <span class="sem-quebra">\(<span class="formula-em-linha"[^>]*>.*?<\/span>\),<\/span> e depois <span class="sem-quebra"><span class="formula-em-linha"/, 'o ")," cola na fórmula');
  assert.match(saida, /<\/span>\.<\/span><\/p>$/, 'o ponto final cola na última fórmula');
});

test('a fórmula mais larga que a linha vai em peças (as variáveis desenhadas, o resto em texto), e o leitor de tela lê a fórmula inteira', () => {
  const texto = 'Então $x_G = \\frac{x_A + x_B + x_C}{3}$ vale.'.replace('\\\\', '\\');
  const estreita = html(createElement(TextoComFormulas, { como: 'p', texto, medidas: { tamanho: 16, peso: 400, largura: 120 } }));
  const larga = html(createElement(TextoComFormulas, { como: 'p', texto, medidas: { tamanho: 16, peso: 400, largura: 320 } }));
  assert.ok((estreita.match(/class="formula-em-linha"/g) ?? []).length >= 1);
  assert.doesNotMatch(estreita, /[_^{}\\]/, 'nunca mostra _, ^, \\, { ou }');
  assert.match(estreita, /x índice G é igual a/);
  assert.match(larga, /x índice G é igual a/);
});

test('o texto falado é o da árvore inteira (o mesmo do contrato), e a opção "x = 3" tem nome acessível limpo', () => {
  const lida = lerFormula('x_C = 3 \\times 1 - 2 - 3');
  assert.equal(lida.ok, true);
  const saida = html(createElement(TextoComFormulas, { texto: '$x_C = 3 \\times 1 - 2 - 3$', medidas: MEDIDAS }));
  assert.ok(saida.includes(falarFormula(lida.arvore)));
});
