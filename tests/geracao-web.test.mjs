// A geração que se acompanha na web (spec 04, revisão do dono de 19/11; banca da noite, item 6; sons da spec 12): as
// regras de ritmo iguais às do app, a fila, a faixa, a placa, a pílula, o fim e os sons no ritmo da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (arquivo) => readFileSync(join(raiz, arquivo), 'utf8');
const estudo = ler('src/app/estudo.tsx');
const geracao = estudo.slice(estudo.indexOf('function useFilaDaGeracao'), estudo.indexOf('function DicaDaPlaca'));
const { RITMO_DA_GERACAO, intervaloDaFila, atrasosDaLicao, rolagemDaVaga, deixouDeAcompanhar, vagaAVista, comMaisUma } = await import('../src/app/geracao-ritmo.ts');

test('as regras de ritmo são as do app (arquivo idêntico) e os números da spec', () => {
  assert.equal(ler('src/app/geracao-ritmo.ts'), ler('apps/mobile/src/geracao-ritmo.ts'));
  const a = atrasosDaLicao(false);
  assert.deepEqual([0, a.linha, a.no, a.nome, a.cenario, a.espera], [0, 120, 320, 420, 560, 700]);
  assert.equal(atrasosDaLicao(true).no, 520, 'o marco vem 200 ms antes');
  assert.equal(intervaloDaFila(false), 320, 'a próxima começa quando a anterior chega ao passo 3');
  assert.equal(rolagemDaVaga(1000, 800, 52), Math.round(1000 - 52 - (800 - 52) * 0.6), 'a vaga a 60% do mapa');
  assert.equal(deixouDeAcompanhar(500, 541), true);
  assert.equal(deixouDeAcompanhar(502, 541), false, 'até 40 px para cima ainda acompanha');
  assert.equal(vagaAVista(600, 300, 700, 52), true);
  assert.deepEqual([1, 2, 3, 4, 5, 6].filter(comMaisUma), [3, 6], '"Mais uma!" no máximo a cada três lições');
  assert.equal(RITMO_DA_GERACAO.esperaLongaMs, 12000);
});

test('a tela usa a fila, a faixa sem pontinhos, a placa, a pílula, o fim com foco em Começar e o anúncio de cada lição', () => {
  assert.match(geracao, /intervaloDaFila\(abriu\(mostrados - 1\)\)/);
  assert.match(geracao, /anunciar\(mensagens\.geracao\.anuncioLicao\(indice \+ 1, licao\.titulo\)\)/);
  assert.match(geracao, /className="geracao-faixa"/);
  assert.doesNotMatch(geracao.slice(geracao.indexOf('className="geracao-faixa"'), geracao.indexOf('geracao-placa-lugar')), /digitando|Pontinhos|carregando/, 'sem os três pontos no alto');
  assert.match(geracao, /mensagens\.geracao\.verLicaoNova\(total\)/);
  assert.match(geracao, /mensagens\.geracao\.verFimDaTrilha/);
  assert.match(geracao, /mensagens\.geracao\.esperaLonga/);
  assert.match(geracao, /mensagens\.geracao\.placaPronta\(total, partes\)/);
  assert.match(geracao, /botaoComecar\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(geracao, /anunciar\(mensagens\.geracao\.anuncioFim\(total\)\)/);
  assert.match(geracao, /festaPermitida=\{acompanhando \|\| trofeuAVista\}/, 'sem acompanhar, o confete só cai com o troféu à vista');
});

test('sons no ritmo da tela: geracao_licao quando cada nó cai e geracao_pronta uma vez no fim, calando o resto', () => {
  const gerar = estudo.slice(estudo.indexOf('async function gerar('), estudo.indexOf('function cancelarGeracao'));
  assert.doesNotMatch(gerar, /tocarEfeito/, 'nada de um som por evento da rede');
  assert.match(geracao, /tocaSons\.tocarEfeito\('geracao_licao'\);\n\s*\}, movimentoReduzido\(\) \? 0 : atrasosDaLicao\(abreTrecho\)\.no\)/);
  const fim = geracao.slice(geracao.indexOf('if (!pronta) return;\n    somDasLicoes'));
  assert.match(fim, /^if \(!pronta\) return;\n\s*somDasLicoes\.current\.forEach\(\(relogio\) => window\.clearTimeout\(relogio\)\);[\s\S]*?tocaSons\.tocarEfeito\('geracao_pronta'\)/);
  assert.equal((geracao.match(/tocarEfeito\('geracao_pronta'\)/g) ?? []).length, 1);
  assert.doesNotMatch(geracao, /tocarEfeito\('(?!geracao_)/, '"Mais uma!", troféu e foco sem som');
});

test('CSS: a sequência de 120/320/420/560/700 ms, a placa em #FFF9EC com a dica 14/20 #0B1B5C e o movimento reduzido', () => {
  const caminho = ler('src/ui/caminho.css');
  const trilha = ler('src/app/trilha.css');
  for (const tempo of ['120ms', '320ms', '420ms', '560ms', '700ms']) assert.ok(caminho.includes(`calc(${tempo} + var(--extra))`) || caminho.includes(`${tempo} backwards`), tempo);
  assert.match(caminho, /\.caminho-no\[data-abre-trecho\] \{ --extra: 200ms; \}/);
  assert.match(caminho, /@keyframes geracao-no-cair \{ 0% \{ opacity: 0; transform: translateY\(-26px\) scale\(0\.7\); \} 60% \{ opacity: 1; transform: translateY\(0\) scale\(1\.08\); \}/);
  assert.match(caminho, /animation: caminho-aparecer 150ms linear both !important;/, 'movimento reduzido: 150 ms de opacidade');
  assert.match(caminho, /\.caminho\[data-acompanhada\] \.caminho-no\[data-estado='previa'\] \.caminho-no__titulo \{ color: #5e6a85; opacity: 1; \}/);
  assert.match(trilha, /\.geracao-faixa \{\s*position: sticky; top: 0;[^}]*min-height: 52px;/);
  assert.match(trilha, /border: 2px solid #e8d3a8; border-radius: 16px; background: #fff9ec;/);
  assert.match(trilha, /\.geracao-placa__linha \{ margin: 0; color: #0b1b5c; font-size: 14px; font-weight: 600; line-height: 20px;/);
  assert.match(trilha, /\.geracao-pilula \{\s*position: fixed; bottom: calc\(var\(--rodape-geracao, 88px\) \+ 16px\);[^}]*min-height: 44px;/);
  assert.match(trilha, /calc\(var\(--ordem\) \* 80ms\)/, 'o visto passa a cada 80 ms');
});
