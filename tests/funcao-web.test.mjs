// Marco 12a, 4b (spec 15, seções 15 a 18): o gráfico de função de ponta a ponta no site. A lição da demonstração "funções" sai do servidor para um cliente
// que anuncia `visuais@2` (o que o site passa a fazer) e a web a desenha com o motor do contrato: na lição, no enunciado (sem a curva, quando há procurado),
// no retorno (com ela e o ponto resposta) e, quando a caixa é baixa (iPhone SE), na linha "Figura: …" com as fórmulas do alt desenhadas em linha, nunca o cifrão.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { falarTextoComFormulas, normalizarVisual, textoSemFormulas } from '@studoo/contratos';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const { VisuaisDaLicao, alturaDoDesenhoDaFigura, caixaDaFigura, descricaoDaFiguraRevelada } = await import('../src/app/desenho.tsx');
const { EtapaExercicio } = await import('../src/app/aula.tsx');
const { CAPACIDADES_DO_SITE } = await import('../src/contratos/capacidades.ts');
const { lerCapacidades } = await import('@studoo/contratos');
const { apresentarExercicio } = await import('../src/dominio/aprendizado/plano.ts');
const { comFormulasParaOCliente, comVisuais, visualDoRetorno } = await import('../src/servidor/aprendizado/visuais.ts');
const { DEMOS } = await import('../src/servidor/ia/demos.ts');

const capacidades = lerCapacidades(CAPACIDADES_DO_SITE);
const demo = DEMOS.find(({ chave }) => chave === 'funcoes');
const licoes = demo.plano.fluxos.flatMap(({ licoes: lista }) => lista);
const licaoDaParabola = licoes.find(({ titulo }) => titulo === 'A parábola e os seus pontos');
const licaoDoSeno = licoes.find(({ titulo }) => titulo === 'Lendo a onda do seno');

/** A lição como o servidor a entrega ao site (visuais, figuras dos exercícios e textos), sem banco. */
const entregar = async (licao) => {
  const exercicios = [licao.exercicio, ...(licao.extras ?? [])];
  const detalhe = {
    id: 'licao-1', planoId: 'plano-1', fluxoId: 'fluxo-1', titulo: licao.titulo, objetivo: licao.objetivo, conceito: licao.conceito, exemplo: licao.exemplo,
    origem: licao.origem, exercicio: apresentarExercicio(exercicios[0]), exercicios: exercicios.map(apresentarExercicio), concluida: false,
  };
  const comFiguras = await comVisuais(detalhe, licao, { capacidades });
  return comFormulasParaOCliente(comFiguras, licao, capacidades);
};
const exercicioHtml = (props) => renderToStaticMarkup(createElement(EtapaExercicio, {
  indice: 0, total: 1, resposta: '', inicial: '', mudar() {}, ocupado: false, responder() {}, formulario: null, titulo: null, avaliacao: null, ...props,
}));
const visiveis = (html) => html.replace(/<span class="somente-leitor">[^<]*<\/span>/g, '').replace(/aria-label="[^"]*"/g, '').replace(/<[^>]*>/g, ' ');
const rotuloDaImagem = (html) => /role="img" aria-label="([^"]*)"/.exec(html)?.[1] ?? /aria-label="([^"]*)"[^>]*role="img"/.exec(html)?.[1];
const caminhosDaCurva = (html) => (html.match(/<path[^>]*stroke-width="3"[^>]*>/g) ?? []);

test('o site anuncia visuais@2 e o servidor lhe entrega o gráfico de função (a lição, a figura do exercício com a caixa do par e o retorno)', async () => {
  assert.equal(capacidades.visuais, 2);
  const entregue = await entregar(licaoDaParabola);
  assert.equal(entregue.visuais.some((visual) => visual.tipo === 'funcao'), true);
  assert.equal(entregue.visuais.some((visual) => visual.tipo === 'formula'), false, 'a fórmula igual à da faixa do gráfico não se repete');
  const figura = entregue.exercicios[0].visual;
  assert.equal(figura.tipo, 'funcao');
  assert.equal(typeof figura.alturaMinimaComRetorno, 'number');
  const procurado = figura.pontos.find((ponto) => ponto.papel === 'procurado');
  assert.deepEqual(Object.keys(procurado).sort(), ['id', 'papel', 'tipo'], 'o vértice procurado vai sem a posição');
  assert.match(figura.alt, /^Gráfico de \$f\(x\) = x\^2 - 4x \+ 3\$, com a raiz \$A\(1, 0\)\$/);
  assert.match(figura.alt, /o vértice procurado \$V\$\.$/);
});

test('a lição da parábola e a do seno: o gráfico é desenhado, a imagem tem a descrição FALADA (sem cifrão nem barra) e a curva está lá', async () => {
  for (const [licao, esperado] of [[licaoDaParabola, ['f de x é igual a x ao quadrado', 'a raiz A de coordenadas 1 e 0']], [licaoDoSeno, ['h de x é igual a seno de x', 'M de coordenadas pi sobre 2 e 1']]]) {
    const entregue = await entregar(licao);
    const html = renderToStaticMarkup(createElement(VisuaisDaLicao, { visuais: entregue.visuais }));
    assert.match(html, /data-testid="visual-licao-funcao"/);
    const rotulo = rotuloDaImagem(html);
    assert.ok(rotulo, 'a imagem leva um nome para o leitor de tela');
    for (const trecho of esperado) assert.ok(rotulo.includes(trecho), `${trecho} em "${rotulo}"`);
    assert.doesNotMatch(rotulo, /[$\\^_{}]|sin|tan/, 'a fala não tem cifrão, barra, sublinhado, chave, "sin" nem "tan"');
    assert.ok(caminhosDaCurva(html).length >= 1, 'o traço da curva está no desenho');
  }
});

test('o exercício do vértice: o enunciado sem a curva e sem a posição do procurado; o acerto troca na MESMA caixa pelo retorno com a curva e o vértice, que a fala descreve', async () => {
  const entregue = await entregar(licaoDaParabola);
  const exercicio = entregue.exercicios[0];
  const altura = 315;
  const caixa = caixaDaFigura(exercicio.visual, altura);
  assert.ok(caixa > 0);
  const antes = exercicioHtml({ exercicio, alturaDaFigura: altura, caixaDaFigura: caixa });
  assert.match(antes, /data-testid="visual-enunciado"/);
  assert.equal(caminhosDaCurva(antes).length, 0, 'sem a curva no enunciado: ele pergunta um ponto dela');
  const rotuloAntes = rotuloDaImagem(antes);
  assert.match(rotuloAntes, /o vértice procurado V/);
  assert.doesNotMatch(rotuloAntes, /2 e menos 1|coordenadas 2/, 'a descrição do enunciado não diz onde está o vértice');
  // O retorno que o servidor manda ao acertar.
  const revelada = visualDoRetorno(licaoDaParabola, 0, capacidades);
  assert.equal(revelada.pontos.find((ponto) => ponto.id === 'V').papel, 'resposta');
  const descricao = descricaoDaFiguraRevelada(exercicio.visual, revelada, altura);
  assert.match(descricao, /o vértice V de coordenadas 2 e menos 1/);
  assert.doesNotMatch(descricao, /[$\\^_{}]/);
  const certa = exercicioHtml({ exercicio, alturaDaFigura: altura, caixaDaFigura: caixa, avaliacao: { correta: true, feedback: 'Isso!', comprovante: 'c', visual: revelada }, descricaoDoRetorno: descricao });
  assert.match(certa, /data-testid="visual-retorno"[^>]*data-entrada="true"/);
  assert.ok(caminhosDaCurva(certa).length >= 1, 'o retorno desenha a curva');
  assert.match(certa, /class="desenho__ponto"/, 'e o vértice, o ponto resposta, em camada própria');
  const caixaDoHtml = (html) => /aspect-ratio:320 \/ ([\d.]+)/.exec(html)[1];
  assert.equal(caixaDoHtml(antes), caixaDoHtml(certa), 'nada pula na troca');
});

test('no iPhone SE (caixa de 158) o enunciado e o retorno da parábola não cabem JUNTOS: os dois viram a linha "Figura: …" com as fórmulas do alt em linha, sem cifrão', async () => {
  const entregue = await entregar(licaoDaParabola);
  const exercicio = entregue.exercicios[0];
  const alturaDoSE = alturaDoDesenhoDaFigura(315, 667);
  assert.ok(alturaDoSE > 150 && alturaDoSE < 175, `a caixa do SE: ${alturaDoSE}`);
  const antes = exercicioHtml({ exercicio, alturaDaFigura: alturaDoSE, caixaDaFigura: caixaDaFigura(exercicio.visual, alturaDoSE) });
  assert.match(antes, /class="figura-em-texto"/, 'o enunciado vira a linha de texto (a regra da mesma caixa)');
  assert.doesNotMatch(antes, /role="img"|data-testid="visual-enunciado"/);
  const revelada = visualDoRetorno(licaoDaParabola, 0, capacidades);
  const certa = exercicioHtml({ exercicio, alturaDaFigura: alturaDoSE, caixaDaFigura: caixaDaFigura(exercicio.visual, alturaDoSE), avaliacao: { correta: true, feedback: 'Isso!', comprovante: 'c', visual: revelada } });
  assert.match(certa, /class="figura-em-texto"/, 'e o retorno também: no acerto nada pula');
  for (const html of [antes, certa]) {
    const linha = /<p class="figura-em-texto"[^>]*>(.*?)<\/p>/s.exec(html)[1];
    assert.match(linha, /<span class="somente-leitor">Figura: <\/span>/);
    assert.doesNotMatch(visiveis(linha), /[$\\^_{}]/, 'nenhum cifrão, barra, sublinhado ou chave no que se vê');
    assert.match(visiveis(linha), /Gráfico de f\(x\) = x² − 4x \+ 3, com a raiz A\(1, 0\), a raiz B\(3, 0\)/);
  }
  assert.match(visiveis(antes), /o vértice procurado V\./);
  assert.match(visiveis(certa), /o vértice V\(2, −1\)\./);
  // Em 315 os dois desenham (a caixa do par cabe), e a linha de texto some.
  const larga = exercicioHtml({ exercicio, alturaDaFigura: 315, caixaDaFigura: caixaDaFigura(exercicio.visual, 315) });
  assert.doesNotMatch(larga, /figura-em-texto/);
});

test('o alt marcado da parábola e do seno em naoCabe: a linha de texto lê "Gráfico de f(x) = …" sem $ _ ^ \\ { } e o leitor ouve a descrição falada', async () => {
  for (const [licao, indice, linear, falado] of [
    [licaoDaParabola, 0, /^Gráfico de f\(x\) = x² − 4x \+ 3, com a raiz A\(1, 0\), a raiz B\(3, 0\), o intercepto C\(0, 3\) e o vértice procurado V\.$/, /f de x é igual a x ao quadrado.*o vértice procurado V\.$/],
    [licaoDoSeno, 0, /^Gráfico de h\(x\) = sen x, com o ponto P\(π, 0\), o ponto N\(3π\/2, −1\) e o ponto procurado M\.$/, /h de x é igual a seno de x, com o ponto P de coordenadas pi e 0, o ponto N de coordenadas 3 pi sobre 2 e menos 1 e o ponto procurado M\.$/],
  ]) {
    const entregue = await entregar(licao);
    const exercicio = entregue.exercicios[indice];
    const html = exercicioHtml({ exercicio, alturaDaFigura: 30, caixaDaFigura: caixaDaFigura(exercicio.visual, 30) });
    const linha = /<p class="figura-em-texto"[^>]*>(.*?)<\/p>/s.exec(html)[1];
    const texto = visiveis(linha).replace(/\s+/g, ' ').trim();
    assert.match(texto, linear);
    assert.doesNotMatch(texto, /[$_^\\{}]/);
    assert.match(falarTextoComFormulas(exercicio.visual.alt), falado);
    assert.equal(textoSemFormulas(exercicio.visual.alt), texto);
  }
  // O alt de uma figura que não é de função (geometria, sem marca) continua como estava.
  const plano = normalizarVisual({ tipo: 'plano', alt: 'Os pontos A (0, 1) e B (2, 5) no plano.', pontos: [{ id: 'A', papel: 'dado', x: 0, y: 1 }, { id: 'B', papel: 'dado', x: 2, y: 5 }] });
  const html = exercicioHtml({ exercicio: { tipo: 'multipla_escolha', enunciado: 'Qual?', opcoes: [{ id: 'a', texto: 'A' }, { id: 'b', texto: 'B' }], visual: plano }, alturaDaFigura: 30, caixaDaFigura: caixaDaFigura(plano, 30) });
  assert.match(html, /Os pontos A \(0, 1\) e B \(2, 5\) no plano\./);
});
