// Fase 2 do site (spec 15, seções 3, 12 e 13): a figura do exercício na web, a mesma ordem, a mesma caixa e a mesma troca do app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { normalizarVisual, visualParaEnunciado, visualRevelado } from '@studoo/contratos';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const { alturaDaFiguraNaWeb, alturaDoDesenhoDaFigura, caixaDaFigura, descricaoDaFiguraRevelada } = await import('../src/app/desenho.tsx');
const { alturaMaximaDaFigura, desenhoDoVisual, temProcurado } = await import('../src/app/desenho-svg.ts');
const { EtapaExercicio } = await import('../src/app/aula.tsx');

const fixture = (nome) => JSON.parse(readFileSync(join(raiz, `tests/fixtures/matematica/${nome}.json`), 'utf8')).licao;
const figura = normalizarVisual(fixture('baricentro').exercicio.visual);
const doEnunciado = visualParaEnunciado(figura);
const revelada = visualRevelado(figura);
// Os pontos todos dados e só os segmentos (a colinearidade da IA real): nada a procurar, nada a revelar.
const semProcurado = normalizarVisual({
  tipo: 'plano', alt: 'Os pontos A (0, 1), B (2, 5) e C (3, 7) no plano, ligados pelos segmentos AB e BC.',
  pontos: [{ id: 'A', papel: 'dado', x: 0, y: 1 }, { id: 'B', papel: 'dado', x: 2, y: 5 }, { id: 'C', papel: 'dado', x: 3, y: 7 }],
  segmentos: [{ de: 'A', ate: 'B' }, { de: 'B', ate: 'C' }],
});

const exercicio = (extra = {}) => ({
  tipo: 'multipla_escolha', enunciado: 'Qual é o terceiro vértice, C?',
  opcoes: [{ id: 'a', texto: '$C(4, 0)$' }, { id: 'b', texto: '$C(0, 4)$' }, { id: 'c', texto: '$C(2, 6)$' }], ...extra,
});
const desenhar = (props) => renderToStaticMarkup(createElement(EtapaExercicio, {
  indice: 0, total: 1, resposta: '', inicial: '', mudar() {}, ocupado: false, responder() {}, formulario: null, titulo: null, avaliacao: null, ...props,
}));

test('a altura da figura: 200 em 390, 480 no computador, em linha reta entre os dois, e menos numa janela baixa', () => {
  assert.equal(alturaDaFiguraNaWeb(315, 844), 200);
  assert.equal(alturaDaFiguraNaWeb(315, 667), 158, 'o iPhone SE, como no app');
  assert.equal(alturaDaFiguraNaWeb(612, 900), 480);
  assert.equal(alturaDaFiguraNaWeb(900, 1200), 480, 'nunca passa de 480');
  assert.equal(alturaDaFiguraNaWeb(0, 900), 200, 'sem medida ainda: o valor do celular');
  const meio = alturaDaFiguraNaWeb(460, 900);
  assert.ok(meio > 200 && meio < 480, String(meio));
  let anterior = 0;
  for (let largura = 280; largura <= 700; largura += 20) {
    const altura = alturaDaFiguraNaWeb(largura, 900);
    assert.ok(altura >= anterior, `cresce com a largura (${largura}: ${altura})`);
    anterior = altura;
  }
  // No desenho (320 de largura): 200 em 315 vira 203, a conta do app; e a de 480 em 612, 251.
  assert.equal(alturaDoDesenhoDaFigura(315, 844), 203);
  assert.equal(alturaDoDesenhoDaFigura(315, 844), alturaMaximaDaFigura(315, 200));
  assert.equal(alturaDoDesenhoDaFigura(612, 900), alturaMaximaDaFigura(612, 480));
  assert.equal(alturaDoDesenhoDaFigura(0, 844), 203);
});

test('a ordem do exercício com figura: o enunciado (menor), a figura e as opções; sem figura, como sempre', () => {
  const com = desenhar({ exercicio: exercicio({ visual: doEnunciado }), alturaDaFigura: 203, caixaDaFigura: caixaDaFigura(doEnunciado, 203) });
  const posicao = (marca) => com.indexOf(marca);
  assert.ok(posicao('class="aula-pergunta"') >= 0 && posicao('data-com-visual=""') >= 0, 'o enunciado com a marca de figura');
  assert.ok(posicao('aula-pergunta') < posicao('class="aula-figura"') && posicao('class="aula-figura"') < posicao('<form'), 'enunciado, figura, opções');
  assert.match(com, /data-testid="visual-enunciado"/);
  assert.doesNotMatch(com, /data-entrada/, 'o enunciado não anima');
  assert.doesNotMatch(com, /desenho__ponto/, 'e não mostra o procurado');
  const sem = desenhar({ exercicio: exercicio() });
  assert.doesNotMatch(sem, /aula-figura|data-com-visual|role="img"/);
  // O CSS que acompanha: 22 de fonte com figura, e a caixa da figura.
  const css = readFileSync(join(raiz, 'src/app/aula.css'), 'utf8');
  assert.match(css, /\.aula-miolo \.aula-pergunta\[data-com-visual\] \{ font-size: 1\.375rem; line-height: 1\.875rem; \}/);
  assert.match(css, /\.aula-figura \{ margin: 2px 0 4px; \}/);
});

test('a caixa da figura do exercício: a altura da figura do enunciado, e o retorno do acerto entra na MESMA caixa, com o ponto que cresce', () => {
  const caixa = caixaDaFigura(doEnunciado, 203);
  assert.ok(caixa > 0 && caixa <= 203);
  const antes = desenhar({ exercicio: exercicio({ visual: doEnunciado }), alturaDaFigura: 203, caixaDaFigura: caixa });
  const certa = desenhar({
    exercicio: exercicio({ visual: doEnunciado }), alturaDaFigura: 203, caixaDaFigura: caixa,
    avaliacao: { correta: true, feedback: 'Isso!', comprovante: 'c', visual: revelada },
    descricaoDoRetorno: descricaoDaFiguraRevelada(doEnunciado, revelada, 203),
  });
  const caixaDoHtml = (html) => /aspect-ratio:320 \/ ([\d.]+)/.exec(html)[1];
  assert.equal(caixaDoHtml(antes), caixaDoHtml(certa), 'nada pula na troca');
  assert.match(certa, /data-testid="visual-retorno"[^>]*data-entrada="true"/, 'a figura nova entra uma vez');
  assert.match(certa, /class="desenho__ponto"/, 'o ponto resposta em camada própria');
  assert.doesNotMatch(certa, /data-testid="visual-enunciado"/, 'no lugar da figura do enunciado');
  // O erro não troca nada.
  const errada = desenhar({
    exercicio: exercicio({ visual: doEnunciado }), alturaDaFigura: 203, caixaDaFigura: caixa,
    avaliacao: { correta: false, feedback: 'Quase', comprovante: 'c' },
  });
  assert.match(errada, /data-testid="visual-enunciado"/);
  assert.doesNotMatch(errada, /visual-retorno|desenho__ponto/);
});

test('a descrição da figura revelada vai na fala do retorno, e a do enunciado não diz onde está o procurado', () => {
  const descricao = descricaoDaFiguraRevelada(doEnunciado, revelada, 203);
  assert.match(descricao, /C \(4, 0\)/, 'o texto do motor, montado dos dados: o ponto achado');
  assert.doesNotMatch(desenhoDoVisual(doEnunciado, { tipo: 'enunciado' }).descricao, /\(4, 0\)/, 'o enunciado não entrega');
  // Com a figura revelada no rótulo da imagem e a descrição na fala do título do retorno (uma frase só), como no app.
  const certa = desenhar({
    exercicio: exercicio({ visual: doEnunciado }), alturaDaFigura: 203, caixaDaFigura: caixaDaFigura(doEnunciado, 203),
    avaliacao: { correta: true, feedback: 'Isso!', comprovante: 'c', visual: revelada }, descricaoDoRetorno: descricao,
  });
  assert.ok(certa.includes(`aria-label="${descricao}"`));
  const fonte = readFileSync(join(raiz, 'src/app/aula.tsx'), 'utf8');
  assert.match(fonte, /<span className="somente-leitor"> \{avaliacao\.correta \? t\.correta : t\.incorreta\}\.\{descricaoDoRetorno \? ` \$\{descricaoDoRetorno\}` : ''\}<\/span>/);
});

test('figura sem ponto procurado: o enunciado e o retorno são o mesmo desenho, sem troca nem animação, e o leitor de tela não ouve nada a mais', () => {
  assert.equal(temProcurado(semProcurado), false);
  assert.equal(descricaoDaFiguraRevelada(semProcurado, revelada, 203), undefined);
  const caixa = caixaDaFigura(semProcurado, 203);
  const antes = desenhar({ exercicio: exercicio({ visual: semProcurado }), alturaDaFigura: 203, caixaDaFigura: caixa });
  const certa = desenhar({
    exercicio: exercicio({ visual: semProcurado }), alturaDaFigura: 203, caixaDaFigura: caixa,
    avaliacao: { correta: true, feedback: 'Isso!', comprovante: 'c', visual: semProcurado },
  });
  const figuraDe = (html) => /<div class="aula-figura">.*?<\/div><\/div>/.exec(html)?.[0] ?? /<div class="aula-figura">.*<\/svg><\/div>/.exec(html)[0];
  assert.equal(figuraDe(certa), figuraDe(antes), 'o mesmo desenho, byte a byte');
  assert.doesNotMatch(certa, /visual-retorno|data-entrada/);
});

test('a figura que não cabe (janela muito baixa) vira a linha de texto no lugar da caixa, e o exercício segue', () => {
  const html = desenhar({ exercicio: exercicio({ visual: doEnunciado }), alturaDaFigura: 30, caixaDaFigura: caixaDaFigura(doEnunciado, 30) });
  assert.match(html, /class="figura-em-texto"/);
  assert.match(html, /<span class="somente-leitor">Figura: <\/span>/);
  assert.match(html, /<form/, 'as opções seguem');
  assert.doesNotMatch(html, /role="img"/);
});
