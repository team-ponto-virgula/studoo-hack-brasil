import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Spec 17 (onboarding e primeira vez), no app: mudança 1 (a espera da geração ensina o produto), 2 (a faixa da proposta e o
// tour com os textos do contrato) e 4 (o tour sem selo de demonstração). Os textos vêm do contrato; o app não os escreve.
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const { ESPERA_DA_GERACAO, dicaDaEspera, faltaParaTrocarADica } = await import('../packages/contratos/src/espera-geracao.ts');
const { mensagens } = await import('../packages/contratos/src/experiencia.ts');
const estudo = await ler('estudo.tsx');
const apresentacao = await ler('apresentacao.tsx');

test('mudança 1: o relógio é o do contrato (o mesmo da web): 3 s de "Montando sua trilha", depois uma frase a cada 5 s', async () => {
  assert.deepEqual({ ...ESPERA_DA_GERACAO }, { antesDaPrimeiraMs: 3000, trocaACadaMs: 5000, efeitoMs: 300 });
  assert.equal(dicaDaEspera(2999, 4), null);
  assert.equal(dicaDaEspera(3000, 4), 0);
  assert.equal(dicaDaEspera(8000, 4), 1);
  assert.equal(dicaDaEspera(3000 + 4 * 5000, 4), 0, 'volta à primeira');
  assert.equal(faltaParaTrocarADica(1000), 2000);
  assert.equal(faltaParaTrocarADica(4000), 4000);
  const placa = estudo.slice(estudo.indexOf('function PlacaDaGeracao('), estudo.indexOf('function PassagemDaCriacao('));
  assert.match(placa, /const indice = dicaDaEspera\(agora - inicioDaEspera\.current, dicas\.length\);/);
  assert.match(placa, /setTimeout\(\(\) => setAgora\(Date\.now\(\)\), faltaParaTrocarADica\(Date\.now\(\) - inicioDaEspera\.current\) \+ 5\)/);
  assert.match(placa, /const metade = ESPERA_DA_GERACAO\.efeitoMs \/ 2;/);
  assert.doesNotMatch(await ler('geracao-ritmo.ts'), /esperaMontandoMs|fraseDaEspera/, 'sem conta local paralela');
});

test('mudanças 1 e 2: os textos do contrato (frases da espera, faixa da proposta e tour) cabem na regra: sem número nem promessa', () => {
  assert.deepEqual([...mensagens.geracao.dicas], ['Lições curtas, com exercício e retorno na hora.', 'Errou? O Stu explica de outro jeito.',
    'Você confere a trilha antes de começar.', 'Cada lição concluída fica marcada no mapa.']);
  assert.equal(mensagens.geracao.propostaPronta(6, 3), 'Sua trilha está pronta: 6 lições curtas em 3 partes.');
  assert.equal(mensagens.geracao.propostaPronta(4, 1), 'Sua trilha está pronta: 4 lições curtas.');
  assert.equal(mensagens.geracao.propostaPronta(1, 1), 'Sua trilha está pronta: 1 lição curta.');
  assert.equal(mensagens.apresentacao.passos[0].titulo, 'Seu material vira lição');
});

test('mudança 1: a placa usa as frases do contrato (geracao.dicas), a espera longa por cima e a proposta no fim', () => {
  const placa = estudo.slice(estudo.indexOf('function PlacaDaGeracao('), estudo.indexOf('function PassagemDaCriacao('));
  assert.match(placa, /const dicas = mensagens\.geracao\.dicas;/);
  assert.match(placa, /pronta \? mensagens\.geracao\.propostaPronta\(licoes, partes\) : esperaLonga \? mensagens\.geracao\.aguardandoLicao\n\s*: indice === null \? mensagens\.geracao\.montandoTitulo : dicas\[indice\]/);
  // Nenhuma frase da espera escrita no app.
  for (const frase of ['Lições curtas', 'Errou? O Stu', 'Você confere a trilha', 'fica marcada no mapa', "'Dica: "]) assert.doesNotMatch(estudo, new RegExp(frase.replace('?', '\\?')));
  // A troca em 300 ms (150 + 150); com movimento reduzido, na hora.
  assert.match(placa, /if \(reduzir !== false \|\| !espera\) \{\n\s*brilho\.setValue\(1\);\n\s*setMostrado\(texto\);/);
  // A linha da espera: 15/20 600 #0B1B5C, centralizada.
  assert.match(estudo, /placaGeracaoEspera: \{ fontSize: 15, lineHeight: 20, fontWeight: '600', textAlign: 'center' \}/);
  assert.match(estudo, /placaGeracaoTexto: \{ color: cores\.texto,/);
  // O leitor de tela: a placa fica fora dele; ouve "Montando sua trilha" uma vez e a proposta pronta.
  assert.match(placa, /<Animated\.View testID="placa-geracao" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
  assert.match(estudo, /if \(!pronta\) AccessibilityInfo\.announceForAccessibility\(mensagens\.geracao\.montandoTitulo\);/);
  assert.match(estudo, /AccessibilityInfo\.announceForAccessibility\(`\$\{mensagens\.geracao\.propostaPronta\(total, partes\)\} \$\{mensagens\.geracao\.comecarLicao1\}\.`\);/);
});

test('mudança 2: o tour usa apresentacao.passos do contrato (título em cima, texto embaixo)', () => {
  assert.match(apresentacao, /const passos = semSessao \? mensagens\.apresentacao\.passos\.slice\(0, 4\) : mensagens\.apresentacao\.passos;/);
});

test('mudança 4: o tour do app sem selo de demonstração e sem a legenda "Retorno automático"', () => {
  assert.doesNotMatch(apresentacao, /SeloDemonstracao|leitura: 'demonstracao'|simulado: true/);
  assert.match(apresentacao, /proximoPasso: ex\.ensinoProximo, simulado: false \}\} \/>/);
});

test('defeito B3: o cartão de aceite cabe na tela, com o título no alto, as ações presas e só o miolo rolando; foco no título', async () => {
  const interfaceApp = await ler('interface.tsx');
  const consentimento = await ler('consentimento-ia.tsx');
  const cartao = interfaceApp.slice(interfaceApp.indexOf('export function CartaoConfirmacao('), interfaceApp.indexOf('export function FolhaDeAcoes('));
  assert.match(cartao, /const alturaMaxima = Math\.max\(280, height - margens\.top - margens\.bottom - 32\);/);
  assert.match(cartao, /style=\{\[estilos\.confirmacaoCartao, \{ maxHeight: alturaMaxima \}\]\}/);
  assert.match(cartao, /\{extra && <View style=\{estilos\.confirmacaoMiolo\}>\{extra\}<\/View>\}/);
  assert.match(cartao, /AccessibilityInfo\.sendAccessibilityEvent\(titulo\.current, 'focus'\)/);
  // O título vem antes do miolo, e as ações depois dele (presas embaixo).
  assert.ok(cartao.indexOf('ref={titulo}') < cartao.indexOf('confirmacaoMiolo') && cartao.indexOf('confirmacaoMiolo') < cartao.indexOf('estilos.confirmacaoAcoes'));
  assert.match(interfaceApp, /confirmacaoMiolo: \{ flexShrink: 1, minHeight: 0 \}/);
  assert.match(consentimento, /testID="consentimento-itens" style=\{\{ maxHeight: Math\.round\(height \* 0\.42\), flexGrow: 0, flexShrink: 1 \}\}/);
});

test('defeito B4: depois de "Agora não", o aviso do pedido tem "Permitir o uso de IA", que reabre o mesmo cartão', () => {
  assert.match(estudo, /const semAceite = falha === 'consentimento_ia';/);
  assert.match(estudo, /: semAceite \? \{ rotulo: mensagens\.privacidade\.permitirAgora, testID: 'permitir-ia-geracao', desativado: ocupado, acao: tentar \}/);
  assert.equal(mensagens.privacidade.permitirAgora, 'Permitir o uso de IA');
});
