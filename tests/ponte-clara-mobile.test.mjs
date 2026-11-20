import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// Ponte clara no app (spec 05, 62b964b; pedido do dono: "Outro jeito de entender" estava confuso). Selo e título, por que
// estou aqui, um só indicador, um passo por vez num cartão, a saída depois dele e a ação do passo no rodapé da aula.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const m = mensagens.estudio;

test('os textos novos vêm do contrato (e021550)', () => {
  assert.equal(m.ponteMotivoResposta('normal'), 'Você respondeu “normal”. Em 3 passos curtos, você vê a ideia por outro caminho e volta ao exercício.');
  assert.equal(m.ponteMotivo, 'Em 3 passos curtos, você vê a ideia por outro caminho e volta ao exercício.');
  assert.equal(m.ponteIndicador(2), 'Passo 2 de 3');
  assert.deepEqual([m.pontePassoExplicacao, m.pontePassoExemplo, m.pontePassoDesafio, m.ponteMargemVolta], ['Outro caminho', 'Um exemplo', 'Desafio', 'Exercício']);
});

test('a ordem na tela: selo, título, porquê, indicador, cartão do passo e só então "Voltar ao exercício"', async () => {
  const fonte = await ler('apps/mobile/src/estudio-adaptativo.tsx');
  const bloco = fonte.slice(fonte.indexOf('testID="ponte-clara"'), fonte.indexOf('{ponteAberta && cartaoOrigem}'));
  const ordem = ['<SeloDaPonte', 'testID="titulo-ponte"', 'testID="ponte-motivo"', '<FaixaDaPonte', 'style={[s.ponteCartao', 'testID="ponte-voltar"'].map((x) => bloco.indexOf(x));
  assert.ok(ordem.every((x) => x > 0) && ordem.every((x, i) => i === 0 || x > ordem[i - 1]), `ordem: ${ordem}`);
  assert.match(bloco, /ultimaResposta\.trim\(\) \? m\.ponteMotivoResposta\(ultimaResposta\) : m\.ponteMotivo/);
  assert.doesNotMatch(bloco, /CenaPonte/, 'os quatro cartões e a cena antiga saem');
  assert.doesNotMatch(fonte, /m\.ponteDica|m\.pontePassoErro|m\.construir\b|m\.pontePronta/);
});

test('a ação de cada passo vai para o rodapé preso da aula', async () => {
  const fonte = await ler('apps/mobile/src/estudio-adaptativo.tsx');
  const efeito = fonte.slice(fonte.indexOf('if (!definirRodapePonte) return;'), fonte.indexOf('useEffect(() => () => definirRodapePonte?.(null)'));
  const ordem = ['ponte-voltar-rodape', 'ponte-ver-exemplo', 'ponte-ir-desafio', 'ponte-tentar-de-novo', 'ponte-conferir'].map((x) => efeito.indexOf(x));
  assert.ok(ordem.every((x) => x > 0), `ações: ${ordem}`);
  assert.match(efeito, /variante="sucesso" rotulo=\{m\.ponteVoltarExercicio\}/);
  assert.match(efeito, /desativado=\{ocupado \|\| gravando \|\| !resposta\} acao=\{verificarPonte\}/);
  assert.match(efeito, /rotulo=\{m\.ponteTentarDeNovo\} desativado=\{ocupado\} acao=\{\(\) => setResposta\(''\)\}/);
  assert.match(fonte, /void tocaSons\.tocarEfeito\(r\.correta \? 'acerto' : 'erro'\);/);
  const licao = await ler('apps/mobile/src/licao.tsx');
  assert.match(licao, /if \(ponteAberta\) rodape = rodapePonte \?\? undefined;/);
  assert.match(licao, /definirRodapePonte=\{setRodapePonte\}/);
});

test('o indicador: três tábuas, o Stu na atual, "Passo n de 3 · nome" ou "Ponte construída!", não tocável', async () => {
  const cenas = await ler('apps/mobile/src/estudio-cenas.tsx');
  const faixa = cenas.slice(cenas.indexOf('export function FaixaDaPonte'), cenas.indexOf('export function SeloDaPonte'));
  assert.match(faixa, /const alvo = carregando \? 0 : construida \? 4 : passo;/);
  assert.match(faixa, /<Stu nome="stu-perfil" tamanho=\{36\} \/>/);
  assert.match(faixa, /importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
  assert.match(faixa, /\{construida \? m\.ponteConstruida : `\$\{m\.ponteIndicador\(passo\)\} · \$\{nomes\[passo - 1\]\}`\}/);
  assert.match(faixa, /if \(reduzir !== false\) \{ posicao\.setValue\(alvo\); salto\.setValue\(0\); return; \}/);
  assert.match(faixa, /duration: 320/);
});
