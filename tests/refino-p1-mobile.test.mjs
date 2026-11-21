import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Spec 16 (refinamento de UI), P1 do app, lotes 1 a 3: itens 5, 6, 8, 9 (com a apresentação sem selo), 16 e 17.
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const contrato = await readFile(new URL('../packages/contratos/src/experiencia.ts', import.meta.url), 'utf8');
const opcao = await ler('opcao.tsx');
const formatos = await ler('aula-formatos.tsx');
const comunidade = await ler('comunidade.tsx');
const apresentacao = await ler('apresentacao.tsx');
const mensagensApp = await ler('mensagens.ts');

function funcao(fonte, nome, antes = '') {
  const inicio = fonte.indexOf(`export function ${nome}(`);
  const fim = fonte.indexOf('\n}\n', inicio) + 2;
  const js = ts.transpileModule(antes + fonte.slice(inicio, fim).replaceAll('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(`${js}; return ${nome};`)();
}

test('item 5: a dica "use as teclas de A a C" nunca aparece no app', async () => {
  const arquivos = (await readdir(new URL('../apps/mobile/src/', import.meta.url))).filter((nome) => /\.tsx?$/.test(nome));
  for (const nome of arquivos) {
    const fonte = await ler(nome);
    assert.doesNotMatch(fonte, /\.atalho\(/, nome);
    assert.doesNotMatch(fonte, /teclas de A a/, nome);
  }
  assert.match(contrato, /atalho: \(total: number\) => `Dica: use as teclas de A a/);
});

test('item 6: o quadrinho da letra cresce com o texto (1,75 × a letra, mínimo 30, quadrado, raio 9) e o texto quebra ao lado', () => {
  const ladoDaLetra = funcao(opcao, 'ladoDaLetra', 'const LETRA_DA_OPCAO = 14;\n');
  assert.equal(ladoDaLetra(1), 30);
  assert.equal(ladoDaLetra(1.3), 32);
  assert.equal(ladoDaLetra(2), 49);
  assert.equal(ladoDaLetra(0), 30);
  assert.match(opcao, /style=\{\[opcaoEstilos\.letra, \{ width: lado, height: lado \}/);
  assert.match(opcao, /letra: \{ width: 30, height: 30, flexShrink: 0, alignSelf: 'center', borderRadius: 9,/);
  // A face é uma linha (letra e texto lado a lado) e o texto ocupa o resto com flex: 1.
  assert.match(opcao, /opcao: \{ minHeight: 60, flexDirection: 'row'/);
  assert.match(opcao, /opcaoTexto: \{ flex: 1,/);
});

test('item 8: sem contagem antes da primeira letra; depois, cinza #5E6A85 até o mínimo; nada de laranja', () => {
  assert.match(formatos, /\{usados > 0 && usados < minimo && <Text testID="aberta-contador" style=\{formatos\.contador\}>\{t\.aberta\.contador\(usados, minimo\)\}<\/Text>\}/);
  assert.match(formatos, /contador: \{ alignSelf: 'flex-end', color: cores\.textoSecundario,/);
  assert.doesNotMatch(formatos, /formatos\.contador, usados >= minimo/);
});

test('item 9: "Exemplo" no selo neutro, sem o parágrafo explicativo, com o nome inteiro para o leitor de tela', () => {
  assert.match(contrato, /demonstracao: 'Exemplo',/);
  assert.match(contrato, /demonstracaoRotulo: 'Exemplo criado pelo Studoo para mostrar o app',/);
  assert.doesNotMatch(comunidade, /demonstracaoExplica|explorar-demo/);
  assert.match(comunidade, /accessible accessibilityLabel=\{c\.demonstracaoRotulo\} style=\{comunidadeEstilos\.seloNeutro\}/);
  assert.match(comunidade, /seloNeutro: \{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 1, backgroundColor: '#F1F4FD' \}/);
  assert.match(comunidade, /seloNeutroTexto: \{ color: '#5E6A85', fontFamily: fontes\.corpo, fontWeight: '800', fontSize: 13/);
});

test('item 9 (c103c3b): a apresentação não mostra selo de demonstração nem de exemplo', () => {
  assert.doesNotMatch(apresentacao, /SeloDemonstracao|leitura: 'demonstracao'|demonstracaoRotulo|c\.demonstracao/);
  assert.match(apresentacao, /function Quadro\(\{ children \}: \{ children: ReactNode \}\)/);
});

test('item 16: a posição do Em alta é a pílula "1º" (13 800 #0B1B5C, branco, 24 de altura, raio 12) e o leitor ouve "1º em alta"', () => {
  assert.match(comunidade, /<Text style=\{comunidadeEstilos\.posicaoTexto\}>\{`\$\{numero\}º`\}<\/Text>/);
  assert.match(comunidade, /posicao: \{ position: 'absolute', top: 10, right: 10, height: 24, minWidth: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#FFFFFF',/);
  assert.match(comunidade, /posicaoTexto: \{ color: cores\.texto, fontFamily: fontes\.corpo, fontSize: 13, lineHeight: 18, fontWeight: '800' \}/);
  assert.match(comunidade, /\{mensagens\.emAlta\.posicao\(posicao\)\}/);
  assert.match(mensagensApp, /emAlta: \{ posicao: \(n: number\) => `\$\{n\}º em alta` \}/);
  assert.doesNotMatch(comunidade, /FeDropShadow|fontSize=\{80\}/);
});

test('item 17: a capa leva só o tema; "Exemplo" vai para a linha "6 lições · 3 partes · Exemplo"', () => {
  const capa = comunidade.slice(comunidade.indexOf('<View style={[comunidadeEstilos.capa'), comunidade.indexOf('<View style={comunidadeEstilos.corpo}>'));
  assert.doesNotMatch(capa, /demonstracao/);
  assert.match(capa, /temas\[cartao\.tema\]/);
  const linha = comunidade.slice(comunidade.indexOf('<View style={comunidadeEstilos.metaLinha}>'), comunidade.indexOf('testID={`${id}-numeros`}'));
  assert.match(linha, /c\.contagem\(cartao\.totalLicoes, cartao\.totalPartes\)\}\{cartao\.demonstracao \? ' · ' : ''\}/);
  assert.match(linha, /\{c\.demonstracao\}/);
});

test('item 23: a aula do app usa a semente do contrato (id da lição, índice, rodada), como a web, sem sorteio', async () => {
  const licao = await ler('licao.tsx');
  const aulaWeb = await readFile(new URL('../src/app/aula.tsx', import.meta.url), 'utf8');
  const chamada = /embaralharExercicioDaRodada\(exercicio, licao\.id, numero, rodadaDeOpcoes\)/;
  assert.match(licao, chamada);
  assert.match(aulaWeb, chamada, 'a mesma chamada da web');
  assert.doesNotMatch(licao, /Math\.random/, 'nada de sorteio na aula: a ordem é a mesma na web e no app');
  assert.doesNotMatch(licao, /embaralharExercicio\(/, 'a semente avulsa saiu da aula');
  assert.match(licao, /setRodadaDeOpcoes\(/, 'a revisão rápida continua subindo a rodada');
  assert.match(licao, /\[licao, rodadaDeOpcoes\],/);
});

test('item 19: a política de privacidade fica só em "Ajuda" (sai da seção "Privacidade e dados")', async () => {
  const privacidade = await ler('privacidade.tsx');
  const seguranca = await ler('seguranca.tsx');
  assert.doesNotMatch(privacidade, /privacidade-politica|t\.politica\b/);
  assert.match(seguranca, /\{ rotulo: s\.politica, caminho: s\.rotas\.politica, testID: 'ajuda-politica' \}/);
  // Na seção sobram "Ver quem recebe" e "Permitir o uso de IA" (ou revogar), conforme o estado.
  assert.match(privacidade, /testID="privacidade-ver-quem"/);
  assert.match(privacidade, /testID="privacidade-permitir"/);
});

test('item 20: "Excluir conta" é o secundário de 44 com borda e texto #C23B4E, depois de "Sair"', async () => {
  const privacidade = await ler('privacidade.tsx');
  const perfil = await ler('perfil.tsx');
  const interfaceApp = await ler('interface.tsx');
  assert.match(privacidade, /testID="excluir-conta" variante="destrutivoBaixo"/);
  assert.match(interfaceApp, /botaoFaceDestrutivaBaixa: \{ minHeight: 44, borderColor: cores\.erro, backgroundColor: cores\.fundo \}/);
  assert.match(interfaceApp, /variante === 'destrutivoBaixo' \? cores\.erro :/);
  assert.match(await ler('tema.ts'), /erro: '#C23B4E'/);
  for (const sair of perfil.matchAll(/testID="sair"[^\n]*\n\s*<BotaoExcluirConta /g)) assert.ok(sair);
  assert.equal([...perfil.matchAll(/testID="sair"[^\n]*\n\s*<BotaoExcluirConta /g)].length, 2, 'nas duas telas de perfil, logo depois de Sair');
});

test('item 32: com trilhas com link, a linha diz que só quem tem o link abre e como aparecer no perfil', async () => {
  const perfil = await ler('perfil.tsx');
  assert.match(perfil, /\{perfil\.links\.length > 0 && \(\n\s*<Text testID="perfil-links-linha" style=\{perfilEstilos\.linhaSecao\}>\{comunidade \? p\.compartilhadasLinha : p\.compartilhadasLinhaSemComunidade\}<\/Text>/);
  assert.match(contrato, /compartilhadasTotal: \(n: number\) => `Trilhas com link/);
});

test('item 14: o aviso "Música de fundo ligada." fica no alto, 8 abaixo do que está preso, em todas as telas', async () => {
  const som = await ler('som.tsx');
  const interfaceApp = await ler('interface.tsx');
  assert.match(som, /avisar\(t\.musicaAviso, \{ som: null, noAlto: true, acao:/);
  // A Tela desenha o aviso do alto dentro da área abaixo da área segura e da barra fixa; o de baixo continua para os outros.
  assert.match(interfaceApp, /\{aviso\?\.noAlto && <FaixaDoAviso key=\{aviso\.vez\} aviso=\{aviso\} alto=\{altoDoAviso\} \/>\}/);
  assert.match(interfaceApp, /\{aviso && !aviso\.noAlto && <FaixaDoAviso key=\{aviso\.vez\} aviso=\{aviso\} baixo=\{baixoDoAviso\} \/>\}/);
  assert.match(interfaceApp, /const altoDoAviso = 8 \+ \(faixaFixa\n\s*\? Math\.max\(0, inicioDaFaixa - roladoDoAviso\) \+ alturaFaixa\n\s*: cabecalhoNaRolagem \? Math\.max\(0, alturaCabecalho - roladoDoAviso\) : 0\);/);
  assert.match(interfaceApp, /deCima \? \{ top: alto \} : \{ bottom: baixo \}/);
});

test('item 4: Conceito e Exemplo curtos ganham o stu-feliz de 72 acima do cartão, com o conjunto no meio da sobra', async () => {
  const licao = await ler('licao.tsx');
  const espacoDoStuDaEtapa = funcao(licao, 'espacoDoStuDaEtapa', 'const STU_DA_ETAPA = 72; const STU_DA_ETAPA_VAO = 12;\n');
  // Visível 700: conteúdo de 300 sobra 400 (57%): o Stu entra e o espaço acima dele é (400 - 84) / 2.
  assert.equal(espacoDoStuDaEtapa(300, 700), 158);
  // Sobra de 39% não basta; conteúdo maior que a tela, também não.
  assert.equal(espacoDoStuDaEtapa(428, 700), null);
  assert.equal(espacoDoStuDaEtapa(420, 700), 98);
  assert.equal(espacoDoStuDaEtapa(900, 700), null);
  assert.equal(espacoDoStuDaEtapa(0, 700), null);
  // Só no Conceito e no Exemplo (não no "Resolva comigo" nem com a ponte aberta), decorativo e sem oscilar.
  assert.match(licao, /const leitura = \(etapa\.tipo === 'conceito' \|\| \(etapa\.tipo === 'exemplo' && !resolva\.ativo\)\) && !ponteAberta;/);
  assert.match(licao, /espacoDoStuDaEtapa\(alturaConteudo\.current - acrescimoDoStu\.current, alturaVisivel\.current\)/);
  assert.match(licao, /<View testID="stu-da-etapa" pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
  assert.match(licao, /<Stu nome="stu-feliz" tamanho=\{STU_DA_ETAPA\} \/>/);
});

test('item 10: na entrada do celular, o stu-acolhida de 72 acena à direita do título (parado com movimento reduzido)', async () => {
  const sessao = await ler('sessao.tsx');
  assert.match(sessao, /<View testID="entrada-stu" style=\{entradaEstilos\.stuDoTitulo\} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>\n\s*<Stu nome="stu-acolhida" tamanho=\{STU_DO_TITULO\} animado="laco" pausado=\{recolher\} \/>/);
  assert.match(sessao, /const STU_DO_TITULO = 72;/);
  assert.match(sessao, /tituloComStu: \{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 \}/);
  // Com a paisagem (tela alta), o Stu já está nela: não aparece duas vezes.
  assert.match(sessao, /\{ilustracao > 0 \? \(\n\s*<Titulo foco testID="titulo-entrada"/);
  // O laço do Stu para com movimento reduzido (o próprio componente do mascote).
  assert.match(await ler('mascote.tsx'), /useMovimentoReduzido/);
});
