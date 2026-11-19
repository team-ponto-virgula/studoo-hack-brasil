import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// A reação do Stu mora no painel de retorno (spec 13, emenda de 19/11, c9f6f1c): o que a lição e o mascote do app seguem.
const licao = await readFile(new URL('../apps/mobile/src/licao.tsx', import.meta.url), 'utf8');
const mascote = await readFile(new URL('../apps/mobile/src/mascote.tsx', import.meta.url), 'utf8');

test('a faixa de reação do corpo sai em todos os estados (e os textos licao.stuEstado deixam de ser usados no app)', () => {
  assert.doesNotMatch(licao, /StuDoExercicio|stu-do-exercicio|stuEstado|EstadoStu/);
});

test('as expressões: acerto feliz, de primeira comemorando, depois da ponte animado, erro encorajador', () => {
  assert.match(licao, /acerto: 'stu-feliz',\n\s*primeira: 'stu-comemorando',\n\s*ponte: 'stu-animado',\n\s*erro: 'stu-encorajador',/);
  assert.match(licao, /!avaliacao\.correta \? 'erro'\n\s*: pontesPorExercicio\[indice\] \? 'ponte' : primeiras\[indice\] === true \? 'primeira' : 'acerto'/);
  assert.match(licao, /<PainelRetorno avaliacao=\{avaliacao\} reacao=\{reacaoDoStu\}/);
});

test('no painel: 42 px na ponta direita da linha do título, subindo 8 no respiro do rodapé, sem Stu no compacto', () => {
  assert.match(licao, /const comStu = reacao !== undefined && !compacto;/);
  assert.match(licao, /retornoStu: \{ position: 'absolute', right: 0, top: -8, width: 42, height: 42 \}/);
  assert.match(licao, /retornoTituloComStu: \{ marginRight: 52 \}/, 'o título ganha 52 de respiro à direita');
  // Pop aos 160 ms e um ciclo no acontecimento; o toque passa e o leitor de tela não lê.
  assert.match(licao, /<Stu nome=\{expressaoDaReacao\[reacao\]\} tamanho=\{42\} animado="acontecimento" acontecimento=\{reacao\} popAoMontar=\{160\} \/>/);
  assert.match(licao, /testID="stu-do-retorno" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
});

test('o painel cabe em metade da janela: só o texto rola, com o esmaecer de 24 enquanto há texto embaixo', () => {
  // O rodapé inteiro (com a pílula "Ver mais abaixo", quando ela divide o rodapé) cabe em metade da janela.
  assert.match(licao, /Math\.floor\(janela\.height \* 0\.5\) - MOLDURA_DO_RODAPE - margens\.bottom - reservaAcima/);
  assert.match(licao, /reservaAcima=\{temAbaixo && etapa\.tipo === 'exercicio' && alturaDaPilula > 0 \? alturaDaPilula - 6 - 2 \+ 10 : 0\}/);
  assert.match(licao, /maxHeight: alturaMaxima/);
  assert.match(licao, /<ScrollView testID="retorno-texto"[^>]*\n?[^>]*scrollEnabled=\{transborda\}/);
  assert.match(licao, /\{transborda && !noFim && <EsmaecerTexto/);
  assert.match(licao, /<Svg width="100%" height=\{24\}>/);
});

test('o mascote: popAoMontar deixa o Stu invisível até o pop; com movimento reduzido, aparece parado na hora', () => {
  assert.match(mascote, /new Animated\.Value\(popAoMontar !== undefined \? 0 : 1\)/);
  assert.match(mascote, /if \(reduzir !== false\) \{ troca\.setValue\(1\); return; \}\n\s*const entrar = Animated\.sequence\(\[\n\s*Animated\.delay\(popAoMontar \?\? 0\),/);
});
