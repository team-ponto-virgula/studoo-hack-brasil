import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Spec 17 (onboarding e primeira vez), no app: mudança 1 (a espera da geração ensina o produto), 2 (a faixa da proposta e o
// tour com os textos do contrato) e 4 (o tour sem selo de demonstração). Os textos vêm do contrato; o app não os escreve.
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const { ESPERA_DA_GERACAO, dicaDaEspera, faltaParaTrocarADica } = await import('../packages/contratos/src/espera-geracao.ts');
const { mensagens } = await import('../packages/contratos/src/experiencia.ts');
const estudo = await ler('estudo.tsx');
const apresentacao = await ler('apresentacao.tsx');

test('mudanças 1 e 2: os textos do contrato (frases da espera, faixa da proposta e tour) cabem na regra: sem número nem promessa', () => {
  assert.equal(mensagens.geracao.propostaPronta(6, 3), 'Sua trilha está pronta: 6 lições curtas em 3 partes.');
  assert.equal(mensagens.geracao.propostaPronta(4, 1), 'Sua trilha está pronta: 4 lições curtas.');
  assert.equal(mensagens.geracao.propostaPronta(1, 1), 'Sua trilha está pronta: 1 lição curta.');
  assert.equal(mensagens.apresentacao.passos[0].titulo, 'Seu material vira lição');
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
  assert.match(cartao, /const alturaMaxima = alturaUtilDoCartao\(height, margens\.top, margens\.bottom, teclado\);/);
  assert.match(cartao, /style=\{\[estilos\.confirmacaoCartao, \{ maxHeight: alturaMaxima \}\]\}/);
  assert.match(cartao, /<ScrollView ref=\{miolo\} testID=\{`\$\{testID\}-miolo`\} style=\{estilos\.confirmacaoMiolo\}/);
  assert.match(cartao, /AccessibilityInfo\.sendAccessibilityEvent\(titulo\.current, 'focus'\)/);
  // O título vem antes do miolo, e as ações depois dele (presas embaixo).
  assert.ok(cartao.indexOf('ref={titulo}') < cartao.indexOf('ref={miolo}') && cartao.indexOf('ref={miolo}') < cartao.indexOf('estilos.confirmacaoAcoes'));
  assert.match(interfaceApp, /confirmacaoMiolo: \{ flexGrow: 0, flexShrink: 1, minHeight: 0 \}/);
  // A lista de quem recebe rola junto com o texto no miolo (sem rolagem dentro de rolagem).
  assert.match(consentimento, /<View testID="consentimento-itens" style=\{c\.itens\}>/);
  assert.doesNotMatch(consentimento, /ScrollView/);
});

test('teclado no cartão (Android, "Excluir conta"): a altura útil desconta o teclado e o cartão sobe para cima dele', async () => {
  const interfaceApp = await ler('interface.tsx');
  const inicio = interfaceApp.indexOf('export function alturaUtilDoCartao(');
  const js = ts.transpileModule(interfaceApp.slice(inicio, interfaceApp.indexOf('\n}\n', inicio) + 2).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const alturaUtilDoCartao = new Function(`${js}; return alturaUtilDoCartao;`)();
  // Sem teclado: a janela menos as áreas seguras e 32 de folga.
  assert.equal(alturaUtilDoCartao(844, 47, 34, 0), 731);
  // Com o teclado (maior que a área segura de baixo): ele é descontado no lugar dela.
  assert.equal(alturaUtilDoCartao(640, 24, 0, 280), 304);
  assert.equal(alturaUtilDoCartao(568, 20, 0, 260), 256);
  assert.equal(alturaUtilDoCartao(500, 20, 0, 400), 200, 'nunca menos de 200');
  const cartao = interfaceApp.slice(interfaceApp.indexOf('export function CartaoConfirmacao('), interfaceApp.indexOf('export function FolhaDeAcoes('));
  assert.match(cartao, /const teclado = useAlturaDoTeclado\(\);/);
  assert.match(cartao, /style=\{\[estilos\.modalFundo, teclado > 0 && \{ paddingBottom: 16 \+ teclado \}\]\}/);
  assert.match(cartao, /miolo\.current\?\.scrollToEnd\(\{ animated: false \}\)/, 'o campo (no fim do miolo) fica à vista');
  const ouvinte = interfaceApp.slice(interfaceApp.indexOf('export function useAlturaDoTeclado('), interfaceApp.indexOf('export function CartaoConfirmacao('));
  assert.match(ouvinte, /Platform\.OS === 'ios' \? 'keyboardWillShow' : 'keyboardDidShow'/);
  assert.match(ouvinte, /evento\.endCoordinates\?\.height/);
  // O campo de EXCLUIR é o miolo do cartão de "Excluir conta".
  assert.match(await ler('privacidade.tsx'), /extra=\{\n\s*<Campo testID="excluir-conta-campo"/);
});

test('defeito B4: depois de "Agora não", o aviso do pedido tem "Permitir o uso de IA", que reabre o mesmo cartão', () => {
  assert.match(estudo, /const semAceite = falha === 'consentimento_ia';/);
  assert.match(estudo, /: semAceite \? \{ rotulo: mensagens\.privacidade\.permitirAgora, testID: 'permitir-ia-geracao', desativado: ocupado, acao: tentar \}/);
  assert.equal(mensagens.privacidade.permitirAgora, 'Permitir o uso de IA');
});

test('mudança 1 (revisão 04fe621): a placa da geração sem frases; as frases na linha embaixo do botão, depois de "Começar a lição 1"', async () => {
  const { ESPERA_DA_GERACAO, dicaDaEspera, faltaParaTrocarADica } = await import('../packages/contratos/src/espera-geracao.ts');
  assert.deepEqual({ ...ESPERA_DA_GERACAO }, { antesDaPrimeiraMs: 3000, trocaACadaMs: 5000, efeitoMs: 300 });
  // A linha aparece aos 1,5 s do toque (espera real) com "Escrevendo suas lições…"; 3 s depois (4,5 s do toque), a frase 1.
  assert.match(estudo, /const relogio = setTimeout\(\(\) => setEsperaReal\(true\), RITMO_DA_GERACAO\.esperaRealMs\);/);
  const linha = estudo.slice(estudo.indexOf('function LinhaDaEspera('), estudo.indexOf('function PassagemDaCriacao('));
  assert.match(linha, /const indice = dicaDaEspera\(agora - inicio\.current, dicas\.length\);/);
  assert.match(linha, /const texto = indice === null \? mensagens\.geracao\.escrevendoLicoes : dicas\[indice\];/);
  assert.match(linha, /setTimeout\(\(\) => setAgora\(Date\.now\(\)\), faltaParaTrocarADica\(Date\.now\(\) - inicio\.current\) \+ 5\)/);
  assert.match(linha, /if \(reduzir !== false\) \{\n\s*brilho\.setValue\(1\);\n\s*setMostrado\(texto\);/, 'movimento reduzido: troca direta');
  assert.match(linha, /const metade = ESPERA_DA_GERACAO\.efeitoMs \/ 2;/);
  // Sem anúncio a cada troca; o leitor ouve "Criando sua trilha." uma vez e o botão fica ocupado.
  assert.match(linha, /accessibilityLiveRegion="none"/);
  assert.match(estudo, /anunciar\(abrirPrimeira \? mensagens\.geracao\.anuncioCriando : mensagens\.geracao\.anuncioSalvando\);/);
  assert.match(estudo, /ocupado=\{iniciando\} afundado=\{iniciando\} giro=\{iniciando\}/);
  assert.match(estudo, /const espera = criacao === 'criando' && esperaReal && <LinhaDaEspera reduzir=\{reduzir\} \/>;/);
  // A placa da geração não usa mais as frases nem o relógio.
  const placa = estudo.slice(estudo.indexOf('function PlacaDaGeracao('), estudo.indexOf('/**\n * A espera depois de "Começar a lição 1"'));
  assert.doesNotMatch(placa, /dicas|dicaDaEspera|criando/);
  assert.equal(dicaDaEspera(2999, 3), null);
  assert.equal(dicaDaEspera(3000, 3), 0);
  assert.equal(dicaDaEspera(13000, 3), 2);
  assert.equal(dicaDaEspera(18000, 3), 0);
  assert.equal(faltaParaTrocarADica(1000), 2000);
  // Os textos do contrato (032347c): três frases (sem "Você confere a trilha…") e a linha sem prometer "alguns segundos".
  assert.deepEqual([...mensagens.geracao.dicas], ['Lições curtas, com exercício e retorno na hora.', 'Errou? O Stu explica de outro jeito.',
    'Cada lição concluída fica marcada no mapa.']);
  assert.equal(mensagens.geracao.escrevendoLicoes, 'Escrevendo suas lições…');
  assert.doesNotMatch(JSON.stringify(mensagens.geracao), /alguns segundos|Você confere a trilha/);
});

test('a pílula "Ver o fim da trilha" sai durante a criação (cobria o nome do nó 1; a web não a mostra nessa fase)', () => {
  assert.match(estudo, /const pilula = !acompanhando && total > 0 && !\(pronta && trofeuAVista\) && !salvando && \(/);
  assert.match(estudo, /const iniciando = criacao === 'criando' \|\| criacao === 'criada';/);
  assert.match(estudo, /const guardando = criacao === 'guardando';/);
  assert.match(estudo, /const salvando = iniciando \|\| guardando;/);
});
