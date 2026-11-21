import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PALETA_DO_DESENHO, desenharFormulaEmLinha, marcarFormulasSoltas, partirTextoComFormulas } from '../packages/contratos/src/aprendizado.ts';
import { corDoPapel, elementoDaPrimitiva } from '../apps/mobile/src/desenho-svg.ts';

// Fórmula em linha no app (spec 15, seção 1, "Em linha"; contrato 3b): os trechos do contrato desenhados pelo motor, num Svg em
// linha dentro do Text, com a base na linha de base das palavras; nunca um cifrão cru na tela.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const textosDa = (licao) => [licao.titulo, licao.objetivo, licao.conceito, licao.exemplo, licao.exercicio.enunciado,
  licao.exercicio.feedbackCorreto, licao.exercicio.feedbackIncorreto, ...licao.exercicio.opcoes.map((opcao) => opcao.texto),
  licao.resolucao.problema, ...licao.resolucao.passos.flatMap((passo) => [passo.texto, passo.tentativa?.pergunta, ...(passo.tentativa?.opcoes ?? []).map((o) => o.porque)])]
  .filter((texto) => typeof texto === 'string');

test('as frases das fixtures: as fórmulas viram trechos desenháveis e o texto que sobra não tem cifrão', async () => {
  let formulas = 0;
  for (const nome of ['baricentro', 'abscissas', 'colinearidade']) {
    const licao = JSON.parse(await ler(`tests/fixtures/matematica/${nome}.json`)).licao;
    for (const texto of textosDa(licao)) {
      for (const trecho of partirTextoComFormulas(texto)) {
        if (trecho.tipo === 'texto') { assert.doesNotMatch(trecho.texto, /\$/, `${nome}: "${trecho.texto}"`); continue; }
        formulas++;
        const desenho = desenharFormulaEmLinha(trecho.arvore, 16);
        assert.ok(desenho.largura > 0 && desenho.altura > 0 && desenho.linhaDeBase > 0 && desenho.linhaDeBase <= desenho.altura, trecho.latex);
        for (const primitiva of desenho.primitivas) assert.ok(elementoDaPrimitiva(primitiva, '#1F7A5A'), `${trecho.latex}: ${primitiva.tipo}`);
      }
    }
  }
  assert.ok(formulas >= 10, `fórmulas em linha nas fixtures: ${formulas}`);
});

test('fora dos destaques, a fórmula toma a cor da frase; os destaques ficam com a cor do papel', () => {
  assert.equal(corDoPapel('texto', '#1F7A5A'), '#1F7A5A');
  assert.equal(corDoPapel('texto'), PALETA_DO_DESENHO.texto);
  assert.equal(corDoPapel('foco', '#1F7A5A'), PALETA_DO_DESENHO.foco);
});

test('o componente: Svg do motor em View em linha, base na linha de base, toque passa, largo demais vira linear', async () => {
  const fonte = await ler('apps/mobile/src/texto-com-formulas.tsx');
  assert.match(await ler('apps/mobile/src/formula-em-linha.ts'), /desenharFormulaEmLinha\(no, tamanho, peso\)/);
  assert.match(fonte, /height: desenho\.linhaDeBase \* escala, overflow: 'visible'/, 'a caixa mede só acima da linha de base: a linha não cresce');
  assert.match(fonte, /style=\{\{ position: 'absolute', top: 0, left: 0 \}\}/);
  assert.match(fonte, /pointerEvents="none"/, 'o toque chega ao Text');
  assert.match(fonte, /montarItens\(itensDaFrase\(trechos, tamanho, escala, limite, pesoDoTexto\(plano\.fontWeight\)\), escala, cor\)/, 'a fórmula larga vai em peças, no peso do texto em volta');
  assert.match(fonte, /const limite = largura > 0 \? Math\.min\(largura, LARGURA_MAXIMA\) : LARGURA_MAXIMA;/, 'o limite é a largura do parágrafo');
  assert.match(fonte, /accessibilityLabel=\{accessibilityLabel \?\? falarTextoComFormulas\(texto\)\}/);
  assert.match(fonte, /const \{ fontScale \} = useWindowDimensions\(\);/, 'cresce com o tamanho de letra do sistema');
  assert.match(fonte, /partirTextoComFormulas\(texto \?\? ''\), \[texto\]\)/, 'só o que está marcado: a heurística é do servidor (3c)');
  assert.doesNotMatch(fonte, /heuristica/, 'o app não adivinha fórmula em texto solto');
});

test('onde o texto tem fórmula: conceito, objetivo, exemplo, enunciado, retorno, dica, opções e "Resolva comigo"; títulos sem cifrão', async () => {
  const licao = await ler('apps/mobile/src/licao.tsx');
  for (const trecho of ['texto={licao.objetivo}', 'texto={licao.exemplo}', 'texto={exercicio.enunciado}', 'texto={exercicio.contexto}', 'texto={avaliacao.feedback}', 'texto={licao.conceito}']) {
    assert.ok(licao.includes(trecho), trecho);
  }
  assert.doesNotMatch(licao, /FormulasNoTexto|heuristica/);
  assert.equal((licao.match(/textoSemFormulas\(licao\.titulo\)/g) ?? []).length, 2);
  assert.match(await ler('apps/mobile/src/aula-formatos.tsx'), /return <TextoComFormulas texto=\{texto\} estilo=/);
  assert.match(await ler('apps/mobile/src/opcao.tsx'), /<TextoComFormulas texto=\{texto\}/);
  const resolva = await ler('apps/mobile/src/resolva-comigo.tsx');
  for (const trecho of ['texto={passo.texto}', 'texto={tentativa.pergunta}', 'texto={resposta.porque}', 'texto={resolucao.problema}']) assert.ok(resolva.includes(trecho), trecho);
  assert.match(resolva, /`\$\$\{opcao\.formula\}\$`/, 'a fórmula da opção do "Sua vez" vai marcada para o motor');
  assert.doesNotMatch(await ler('apps/mobile/src/aula-formatos.tsx'), /<TextoComFormulas[^>]*trecho/, 'nunca no trecho de código');
});

test('a pontuação colada na fórmula não vai sozinha para a outra linha', async () => {
  const fonte = await ler('apps/mobile/src/texto-com-formulas.tsx');
  assert.match(fonte, /const SEM_QUEBRA = '\\u2060';/);
  assert.match(fonte, /itens\[indice - 1\]\?\.tipo === 'desenho' && FECHA\.test\(texto\)/);
  assert.match(fonte, /<Text key=\{`j\$\{indice\}`\} style=\{\{ whiteSpace: 'nowrap' \} as TextStyle\}>\{formula\}\{pontuacao\}<\/Text>/, 'na prévia web, fórmula e pontuação num trecho sem quebra');
});

test('fórmula larga vai em peças desenhadas: nenhum _ ^ \\ { } no texto da tela (390, 320 e 200%)', async () => {
  const { itensDaFrase } = await import('../apps/mobile/src/formula-em-linha.ts');
  // Limites: o parágrafo do balão do Stu em 390 (~240) e em 320 (~170); a 200%, a mesma largura com escala 2; e um aperto extremo.
  const casos = [[1, 240], [1, 170], [2, 240], [2, 170], [1, 60]];
  const proibido = /[_^\\{}]/;
  let pecas = 0;
  const textos = [];
  for (const nome of ['baricentro', 'abscissas', 'colinearidade']) textos.push(...textosDa(JSON.parse(await ler(`tests/fixtures/matematica/${nome}.json`)).licao));
  textos.push('A abscissa do baricentro é a média das abscissas dos três vértices: $x_G = (x_A + x_B + x_C) \\div 3$.', 'Metade de 8 é $1/2$ de 8. Qual é $x_C$?', '$x^2$ é o quadrado de x.');
  for (const bruto of textos) {
    // O servidor marca os tokens soltos da lição de matemática (3c); o app lê só o que está marcado.
    const trechos = partirTextoComFormulas(marcarFormulasSoltas(bruto));
    for (const [escala, limite] of casos) {
      const itens = itensDaFrase(trechos, 16, escala, limite);
      for (const item of itens) {
        if (item.tipo === 'texto') assert.doesNotMatch(item.texto, proibido, `"${item.texto}" (escala ${escala}, limite ${limite})`);
        else assert.ok(item.desenho.largura * escala <= limite + 1e-6, `desenho de ${item.desenho.largura} cabe em ${limite}`);
      }
      if (trechos.some((t) => t.tipo === 'formula') && itens.filter((i) => i.tipo === 'desenho').length > trechos.filter((t) => t.tipo === 'formula').length) pecas++;
    }
  }
  assert.ok(pecas > 0, 'algum caso foi em peças');
});

test('o peso da fórmula segue o do texto em volta (pronto para o motor com peso)', async () => {
  const { pesoDoTexto } = await import('../apps/mobile/src/formula-em-linha.ts');
  assert.equal(pesoDoTexto(undefined), 400); assert.equal(pesoDoTexto('400'), 400); assert.equal(pesoDoTexto('500'), 400);
  assert.equal(pesoDoTexto('700'), 700); assert.equal(pesoDoTexto('800'), 700); assert.equal(pesoDoTexto('bold'), 700); assert.equal(pesoDoTexto(700), 700);
});

test('Δ e π valem como termo: "Δ ≠ 0" e "π = 3,14" saem desenhados em linha (marco 2e)', async () => {
  const { itensDaFrase } = await import('../apps/mobile/src/formula-em-linha.ts');
  for (const frase of ['Se Δ ≠ 0, há duas raízes.', 'Use π = 3,14 na conta.']) {
    const itens = itensDaFrase(partirTextoComFormulas(marcarFormulasSoltas(frase)), 16, 1, 240);
    assert.equal(itens.filter((item) => item.tipo === 'desenho').length, 1, frase);
    assert.ok(itens.every((item) => item.tipo !== 'texto' || !/[Δπ≠=]/.test(item.texto)), `${frase}: a conta inteira no desenho`);
  }
});

test('verdadeiro ou falso, associar e ordenar desenham a fórmula marcada (trilha "funcoes": "$h(x) = \\sin x$" aparecia cru)', async () => {
  const formatos = await ler('apps/mobile/src/aula-formatos.tsx');
  assert.match(formatos, /<TextoComFormulas texto=\{afirmacao\} estilo=\{formatos\.afirmacaoTexto\} \/>/);
  assert.match(formatos, /<TextoComFormulas texto=\{item\.texto\} estilo=\{\[estilos\.texto, formatos\.cartaoTexto, formatos\.cartaoParTexto\]\} \/>/);
  assert.match(await ler('apps/mobile/src/ordenar.tsx'), /<TextoComFormulas numberOfLines=\{3\} texto=\{texto\} estilo=\{estilosOrdenar\.texto\} \/>/);
  for (const trecho of partirTextoComFormulas('A onda $h(x) = \\sin x$ passa de 1 em algum ponto.')) if (trecho.tipo === 'texto') assert.doesNotMatch(trecho.texto, /[$\\]/);
});
