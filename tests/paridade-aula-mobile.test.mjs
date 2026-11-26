import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { VISUAL_ONBOARDING } from '../packages/contratos/src/onboarding-visual.ts';
import { renderizarCenaStu, nosDaCena, estiloDaCena } from './auxiliares/render-cena-mobile.mjs';

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

test('item 10 atualizado: login limpo e cena de boas-vindas com as dimensões compartilhadas', async () => {
  const acesso = await ler('acesso-mobile.tsx');
  const ast = ts.createSourceFile('acesso.tsx', acesso, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const componente = nome => ast.statements.find(no => ts.isFunctionDeclaration(no) && no.name?.text === nome)?.getText(ast);
  assert.ok(componente('EntradaMobile'));
  assert.doesNotMatch(componente('EntradaMobile'), /<Stu\b|entrada-stu|STU_DO_TITULO/, 'o login prioriza o acesso e deixa o mascote para a apresentação');
  assert.match(componente('BoasVindasMobile'), /<CenaStuOnboarding nome=\{atual\.stu\}/);
  const exemplo = { type: 'Exemplo', props: { children: 'Seu assunto vira uma trilha' } };
  const cena = renderizarCenaStu({ nome: 'stu-acolhida', children: exemplo });
  const nos = nosDaCena(cena);
  const stu = nos.find(no => no.type === 'Stu');
  const heroi = nos.find(no => no.props?.pointerEvents === 'none');
  assert.equal(stu.props.nome, 'stu-acolhida');
  assert.equal(stu.props.tamanho, VISUAL_ONBOARDING.cena.stu);
  assert.equal(estiloDaCena(heroi.props.style).height, VISUAL_ONBOARDING.cena.altura);
  assert.equal(heroi.props.accessibilityElementsHidden, true);
  assert.equal(heroi.props.importantForAccessibility, 'no-hide-descendants');
  assert.ok(nos.includes(exemplo), 'o exemplo faz parte da composição sem ser ocultado junto da arte decorativa');
  assert.ok(!nosDaCena(heroi).includes(exemplo), 'o conteúdo do exemplo fica fora da região decorativa oculta');
  assert.match(componente('TituloAcesso'), /width < 375 && \{ fontSize: 30, lineHeight: 36 \}/);
  assert.match(acesso, /titulo: \{[^}]*fontSize: 32, lineHeight: 38/);
  assert.doesNotMatch(acesso, /allowFontScaling=\{false\}|maxFontSizeMultiplier=/, 'mantém a ampliação de texto do aparelho');
});
