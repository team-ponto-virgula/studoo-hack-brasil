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
  assert.equal(ladoDaLetra(1.5), 36.75, 'sem arredondar, como a web (36,8)');
  assert.equal(ladoDaLetra(2), 49);
  assert.equal(ladoDaLetra(0), 30);
  assert.match(opcao, /style=\{\[opcaoEstilos\.letra, \{ width: lado, height: lado \}/);
  assert.match(opcao, /letra: \{ width: 30, height: 30, flexShrink: 0, alignSelf: 'center', borderRadius: 9,/);
  // A face é uma linha (letra e texto lado a lado) e o texto ocupa o resto com flex: 1.
  assert.match(opcao, /opcao: \{ minHeight: 60, flexDirection: 'row'/);
  assert.match(opcao, /opcaoTexto: \{ flex: 1,/);
});

test('item 8: sem contagem antes da primeira letra; depois, cinza #5E6A85 até o mínimo; nada de laranja', () => {
  // A regra é a do contrato (mostrarContagemDaAberta: da primeira letra até o mínimo), a mesma da web.
  assert.match(formatos, /\{mostrarContagemDaAberta\(usados, minimo\)\n\s*\? <Text testID="aberta-contador" style=\{formatos\.contador\}>\{t\.aberta\.contador\(usados, minimo\)\}<\/Text>/);
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
  assert.match(comunidade, /<Text style=\{comunidadeEstilos\.posicaoTexto\}>\{c\.posicaoSelo\(numero\)\}<\/Text>/);
  assert.match(contrato, /posicaoSelo: \(n: number\) => `\$\{n\}º`/);
  assert.match(comunidade, /posicao: \{ position: 'absolute', top: 10, right: 10, height: 24, minWidth: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: '#FFFFFF',/);
  assert.match(comunidade, /posicaoTexto: \{ color: cores\.texto, fontFamily: fontes\.corpo, fontSize: 13, lineHeight: 18, fontWeight: '800' \}/);
  assert.match(comunidade, /\{c\.posicao\(posicao\)\}/);
  assert.match(contrato, /posicao: \(n: number\) => `\$\{n\}º em alta`/);
  assert.doesNotMatch(mensagensApp, /emAlta:/, 'o texto local saiu: vale o do contrato');
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

test('item 4: com folga (regra do contrato), o Exemplo ganha o stu-feliz de 72 acima do cartão; o Conceito só centraliza', async () => {
  const licao = await ler('licao.tsx');
  // A decisão (folga ou não) é etapaTemFolga do contrato; a conta do app está em tests/paridade-aula-mobile.test.mjs.
  assert.match(licao, /if \(!etapaTemFolga\(\{ livre: visivel, usado: conteudo \}\)\) return null;/);
  // Só no Conceito e no Exemplo (não no "Resolva comigo" nem com a ponte aberta), decorativo e sem oscilar.
  assert.match(licao, /const leitura = \(etapa\.tipo === 'conceito' \|\| \(etapa\.tipo === 'exemplo' && !resolva\.ativo\)\) && !ponteAberta;/);
  assert.match(licao, /espacoDoStuDaEtapa\(alturaConteudo\.current - acrescimoDoStu\.current, alturaVisivel\.current, comStuNaEtapa\)/);
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

test('item 24: com o "Explique" aberto, o acerto é uma linha só: "✓ Isso aí!" à esquerda e "Continuar" à direita, sem o texto', async () => {
  const licao = await ler('licao.tsx');
  assert.match(licao, /compacto=\{expliqueAberto\}/);
  assert.match(licao, /const linhaCompacta = Boolean\(compacto && certa\);/);
  assert.match(licao, /linhaCompacta && licaoEstilos\.painelLinha\]\}>/);
  // O texto do retorno já fica fora no compacto; o "Continuar" sai da metade e vai à direita do título.
  assert.match(licao, /\{!compacto && \(\n\s*<View style=\{licaoEstilos\.encolhe\}>/);
  assert.match(licao, /<View style=\{certa && !linhaCompacta \? licaoEstilos\.metade : undefined\}>/);
  assert.match(licao, /painelLinha: \{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 \}/);
  assert.match(licao, /retornoTituloLinha: \{ fontFamily: fontes\.corpo, fontWeight: '800', fontSize: 16, lineHeight: 22, letterSpacing: 0, color: cores\.sucesso \}/);
  assert.match(await ler('tema.ts'), /sucesso: '#1F7A5A'/);
});

test('item 25: os passos do "Explique" são uma linha de indicador não tocável, "Passo 1 de 3 · Gravar ou escrever"', async () => {
  const cenas = await ler('estudio-cenas.tsx');
  const nomeDaEtapaDoEnsino = funcao(cenas, 'nomeDaEtapaDoEnsino');
  assert.equal(nomeDaEtapaDoEnsino('1. Gravar ou escrever'), 'Gravar ou escrever');
  assert.equal(nomeDaEtapaDoEnsino('1. Conversar, gravar ou escrever'), 'Conversar, gravar ou escrever');
  const etapas = cenas.slice(cenas.indexOf('export function EtapasDoEnsino('), cenas.indexOf('const PESOS_ONDA'));
  assert.match(etapas, /accessibilityLabel=\{`\$\{passo\}: \$\{etapas\[ativa\]\}`\}/);
  assert.match(etapas, /\{`\$\{passo\} · \$\{etapas\[ativa\]\}`\}/);
  assert.doesNotMatch(etapas, /Pressable|onPress|borderWidth/);
  assert.match(cenas, /etapaLinha: \{ color: '#5E6A85', fontFamily: fontes\.corpo, fontWeight: '800', fontSize: 14, lineHeight: 20 \}/);
  assert.match(contrato, /ponteIndicador: \(n: number\) => `Passo \$\{n\} de 3`/);
});

test('item 29: o convite do "Explique" sem "o mascote do Studoo"', () => {
  assert.match(contrato, /ensinoDica: 'Explique a ideia desta lição como se ensinasse um amigo e dê um exemplo seu\. O Stu aponta o que fez sentido e propõe uma situação nova\.'/);
  assert.doesNotMatch(contrato, /O Stu, o mascote do Studoo, aponta/);
});

test('item 14 (ee85828): o balão do nó fecha o aviso do alto na hora; o aviso não bloqueia toque fora dele, só "Desligar" responde', async () => {
  const caminho = await ler('caminho.tsx');
  const interfaceApp = await ler('interface.tsx');
  // (1) Balão abrindo com o aviso do alto à vista: dispensar() tira o aviso na hora (sem animação de saída).
  assert.match(caminho, /const \{ aviso, dispensar \} = useContext\(AvisoDoApp\);\n\s*useEffect\(\(\) => \{\n\s*if \(aberto !== null && aviso\?\.noAlto\) dispensar\(\);/);
  assert.match(interfaceApp, /const dispensar = useCallback\(\(\) => setAviso\(null\), \[\]\);/);
  // (2) O lugar do aviso deixa passar o toque (box-none); dentro da faixa, o único tocável é a ação ("Desligar").
  const faixa = interfaceApp.slice(interfaceApp.indexOf('function FaixaDoAviso('), interfaceApp.indexOf('export function AvisoSobreAFolha('));
  assert.match(faixa, /<View pointerEvents="box-none" style=\{\[estilos\.avisoLugar,/);
  assert.equal((faixa.match(/<Pressable /g) ?? []).length, 1, 'só a ação é tocável');
  assert.match(faixa, /<Pressable testID="aviso-acao" accessibilityRole="button"/);
  assert.doesNotMatch(faixa, /onPress=\{dispensar\}|onTouch/);
});

test('item 31: um estado só, curto, no botão do mapa e no selo do cartão, vindo do contrato (estadoDoCompartilhamento)', async () => {
  const social = await ler('social.tsx');
  const estudo = await ler('estudo.tsx');
  const { estadoDoCompartilhamento } = await import('../packages/contratos/src/compartilhar.ts');
  assert.equal(estadoDoCompartilhamento(undefined), 'sem-link');
  assert.equal(estadoDoCompartilhamento({ codigo: 'x', noPerfil: false }), 'compartilhada');
  assert.equal(estadoDoCompartilhamento({ codigo: 'x', noPerfil: true, moderacao: 'pendente' }), 'em-revisao');
  assert.equal(estadoDoCompartilhamento({ codigo: 'x', noPerfil: true, moderacao: 'recusado' }), 'nao-publicada');
  assert.doesNotMatch(social + estudo, /estadoCurtoDoCompartilhar|rotuloCurtoDoCompartilhar/, 'o auxiliar local saiu');
  assert.match(social, /estado === 'sem-link' \? m\.entrada : estado === 'compartilhada' \? m\.selo : estado === 'em-revisao' \? seg\.seloEmRevisao : seg\.seloNaoPublicada/);
  assert.match(estudo, /<Botao rotulo=\{rotuloDoCompartilhamento\(estadoDoCompartilhamento\(plano\.link\)\)\} iconeAntes="compartilhar"/);
  const marca = social.slice(social.indexOf('export function MarcaCompartilhar('), social.indexOf('export function TrilhaRecebida('));
  assert.match(marca, /const estado = estadoDoCompartilhamento\(marcas\.link\);/);
  assert.match(marca, /testID=\{recusada \? 'selo-nao-publicada' : 'selo-em-revisao'\}/);
  assert.doesNotMatch(marca, /seg\.emRevisao|seg\.naoPublicada\b/);
  assert.match(social, /seloEstadoAlertaTexto: \{ color: '#9A5B00' \}/);
});

test('item 34: o alto da proposta como a web: voltar de 44, o nome da trilha em 17/22 800 até 2 linhas (15/20 com 3 ou mais)', async () => {
  const estudo = await ler('estudo.tsx');
  const faixa = estudo.slice(estudo.indexOf('const nomeNoAlto = titulo || geracao.objetivo;'), estudo.indexOf('const expirada = criacao === \'expirada\';'));
  assert.match(faixa, /<Pressable testID="geracao-voltar" accessibilityRole="button"/);
  assert.match(faixa, /onPress=\{pronta \? ajustar : cancelar\}/);
  assert.match(faixa, /<Text accessibilityRole="header" testID="geracao-nome"/);
  assert.doesNotMatch(faixa, /numberOfLines=\{1\}/, 'sem reticências');
  assert.match(faixa, /evento\.nativeEvent\.lines\.length >= 3/);
  assert.match(estudo, /geracaoVoltar: \{ width: 44, height: 44, borderRadius: 22,/);
  assert.match(estudo, /faixaGeracaoNome: \{ flex: 1, minWidth: 0, color: cores\.texto, fontFamily: fontes\.corpo, fontWeight: '800', fontSize: 17, lineHeight: 22 \}/);
  assert.match(estudo, /faixaGeracaoNomeLongo: \{ fontSize: 15, lineHeight: 20 \}/);
  // A placa "Proposta pronta" e a área livre do item 1 acompanham a faixa quando o nome ocupa duas linhas.
  assert.match(faixa, /\{ top: alturaFaixaGeracao \+ 10 \}/);
  assert.match(estudo, /const topoLivre = semPlaca \? 0 : alturaFaixaGeracaoAgora\.current \+ 10 \+ alturaPlacaAgora\.current;/);
});
