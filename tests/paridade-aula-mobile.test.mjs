import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Paridade com a web (spec 16, itens 4, 6, 8 e 10): o app decide com as mesmas contas do contrato (b87efbd) e chega aos
// mesmos números que o Web & API mediu na web.
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const { etapaTemFolga, mostrarContagemDaAberta, SOBRA_MINIMA_DA_ETAPA } = await import('../packages/contratos/src/aula-regras.ts');

function funcao(fonte, nome, antes = '') {
  const inicio = fonte.indexOf(`export function ${nome}(`);
  const fim = fonte.indexOf('\n}\n', inicio) + 2;
  const js = ts.transpileModule(antes + fonte.slice(inicio, fim).replaceAll('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function('etapaTemFolga', `${js}; return ${nome};`)(etapaTemFolga);
}

test('item 4: o app só põe o conjunto no meio quando o contrato diz que há folga (mesma regra da web)', async () => {
  const licao = await ler('licao.tsx');
  const espaco = funcao(licao, 'espacoDoStuDaEtapa', 'const STU_DA_ETAPA = 72; const STU_DA_ETAPA_VAO = 12;\n');
  assert.equal(SOBRA_MINIMA_DA_ETAPA, 0.4);
  for (const livre of [300, 450, 568, 640, 700, 844]) {
    for (let usado = 0; usado <= livre + 40; usado += 7) {
      for (const comStu of [true, false]) {
        assert.equal(espaco(usado, livre, comStu) !== null, etapaTemFolga({ livre, usado }), `livre ${livre}, usado ${usado}, Stu ${comStu}`);
      }
    }
  }
  // Com folga, o conjunto fica no meio da sobra: no Exemplo, descontando o Stu de 72 e o vão de 12; no Conceito, sem Stu.
  assert.equal(espaco(300, 700, true), 158);
  assert.equal(espaco(300, 700, false), 200);
  assert.match(licao, /const comStuNaEtapa = etapa\.tipo === 'exemplo';/);
  assert.match(licao, /if \(!comStu\) return <View testID="folga-da-etapa" pointerEvents="none" style=\{\{ height: espaco \}\} \/>;/);
});

test('item 6: o quadrinho da letra tem 30, 36,75 e 49 a 100, 150 e 200% de texto (a web mede 30, 36,8 e 49)', async () => {
  const opcao = await ler('opcao.tsx');
  const lado = funcao(opcao, 'ladoDaLetra', 'const LETRA_DA_OPCAO = 14;\n');
  assert.deepEqual([lado(1), lado(1.5), lado(2)], [30, 36.75, 49]);
  assert.equal(lado(0), 30);
});

test('item 8: a contagem da resposta aberta aparece quando o contrato manda (primeira letra até o mínimo), com o lugar guardado', async () => {
  const formatos = await ler('aula-formatos.tsx');
  assert.match(formatos, /\{mostrarContagemDaAberta\(usados, minimo\)\n\s*\? <Text testID="aberta-contador" style=\{formatos\.contador\}>/);
  assert.match(formatos, /: <View style=\{formatos\.contadorLugar\} \/>\}/);
  assert.deepEqual([0, 1, 39, 40, 41].map((usados) => mostrarContagemDaAberta(usados, 40)), [false, true, true, false, false]);
});

test('item 10: o título da entrada ao lado do Stu de 72 em 26/32 e, até 320, 22/28, como a web', async () => {
  const sessao = await ler('sessao.tsx');
  const tamanho = funcao(sessao, 'tamanhoDoTituloComStu');
  assert.deepEqual(tamanho(390), { fontSize: 26, lineHeight: 32 });
  assert.deepEqual(tamanho(360), { fontSize: 26, lineHeight: 32 });
  assert.deepEqual(tamanho(320), { fontSize: 22, lineHeight: 28 });
  assert.match(sessao, /<Titulo foco testID="titulo-entrada" estilo=\{estiloDoTituloComStu\(largura\)\}>/);
  assert.match(sessao, /const STU_DO_TITULO = 72;/);
});
