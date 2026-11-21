import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PALETA_DO_DESENHO, desenharFormulaEmLinha, partirTextoComFormulas } from '../packages/contratos/src/aprendizado.ts';
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
      for (const trecho of partirTextoComFormulas(texto, { heuristica: true })) {
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
  assert.match(fonte, /desenharFormulaEmLinha\(segmento\.arvore, tamanho\)/);
  assert.match(fonte, /height: desenho\.linhaDeBase \* escala, overflow: 'visible'/, 'a caixa mede só acima da linha de base: a linha não cresce');
  assert.match(fonte, /style=\{\{ position: 'absolute', top: 0, left: 0 \}\}/);
  assert.match(fonte, /pointerEvents="none"/, 'o toque chega ao Text');
  assert.match(fonte, /desenho\.largura \* escala > LARGURA_MAXIMA\) return <Text>\{segmento\.linear\}<\/Text>/, 'não quebra: se não cabe, linear');
  assert.match(fonte, /accessibilityLabel=\{accessibilityLabel \?\? falarTextoComFormulas\(texto\)\}/);
  assert.match(fonte, /const \{ fontScale \} = useWindowDimensions\(\);/, 'cresce com o tamanho de letra do sistema');
  assert.match(fonte, /createContext<\{ heuristica: boolean \}>\(\{ heuristica: false \}\)/, 'fora da lição de matemática, só a marcação');
});

test('onde o texto tem fórmula: conceito, objetivo, exemplo, enunciado, retorno, dica, opções e "Resolva comigo"; títulos sem cifrão', async () => {
  const licao = await ler('apps/mobile/src/licao.tsx');
  for (const trecho of ['texto={licao.objetivo}', 'texto={licao.exemplo}', 'texto={exercicio.enunciado}', 'texto={exercicio.contexto}', 'texto={avaliacao.feedback}', 'texto={licao.conceito}']) {
    assert.ok(licao.includes(trecho), trecho);
  }
  assert.match(licao, /<FormulasNoTexto\.Provider value=\{formulas\}>/);
  assert.equal((licao.match(/textoSemFormulas\(licao\.titulo\)/g) ?? []).length, 2);
  assert.match(await ler('apps/mobile/src/aula-formatos.tsx'), /return <TextoComFormulas texto=\{texto\} estilo=/);
  assert.match(await ler('apps/mobile/src/opcao.tsx'), /<TextoComFormulas texto=\{texto\}/);
  const resolva = await ler('apps/mobile/src/resolva-comigo.tsx');
  for (const trecho of ['texto={passo.texto}', 'texto={tentativa.pergunta}', 'texto={resposta.porque}', 'texto={resolucao.problema}']) assert.ok(resolva.includes(trecho), trecho);
  assert.match(resolva, /`\$\$\{opcao\.formula\}\$`/, 'a fórmula da opção do "Sua vez" vai marcada para o motor');
  assert.doesNotMatch(await ler('apps/mobile/src/aula-formatos.tsx'), /<TextoComFormulas[^>]*trecho/, 'nunca no trecho de código');
});
