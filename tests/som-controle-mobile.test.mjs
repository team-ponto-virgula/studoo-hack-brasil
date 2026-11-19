import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';
import { OPCOES_FUNDO_UI } from '../packages/contratos/src/catalogo-sons.ts';

// Controle de som no app (spec 12), espelho de src/app/som.tsx: a folha "Som", o botão do alto da aula e o bloco do Perfil.
// Sem React Native no Node: o texto e a árvore do TypeScript dos arquivos, como os outros testes do app.

const ler = (caminho) => readFile(new URL(`../${caminho}`, import.meta.url), 'utf8');
const som = await ler('apps/mobile/src/som.tsx');
const licao = await ler('apps/mobile/src/licao.tsx');
const perfil = await ler('apps/mobile/src/perfil.tsx');
const estudo = await ler('apps/mobile/src/estudo.tsx');
const icone = await ler('apps/mobile/src/icone.tsx');
const trilha = await ler('apps/mobile/src/trilha.ts');

/** O corpo de uma função do arquivo (do nome até o primeiro "}" sozinho na linha). */
function corpoDe(fonte, nome) {
  const inicio = fonte.indexOf(`function ${nome}(`);
  assert.ok(inicio >= 0, `não achei ${nome}`);
  return fonte.slice(inicio, fonte.indexOf('\n}\n', inicio));
}

test('os textos vêm do contrato (mensagens.som), nenhum escrito no JSX', () => {
  const achados = [];
  const fonte = ts.createSourceFile('som.tsx', som, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const visitar = (no) => {
    if (ts.isJsxText(no) && /\p{L}/u.test(no.text)) achados.push(no.text.trim());
    if (ts.isJsxAttribute(no) && no.initializer && ts.isStringLiteral(no.initializer)
      && /^(accessibilityLabel|accessibilityHint|aria-label|rotulo|dica)$/.test(no.name.getText())
      && /\p{L}/u.test(no.initializer.text)) achados.push(`${no.name.getText()}="${no.initializer.text}"`);
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  assert.deepEqual(achados, []);
  assert.match(som, /const t = mensagens\.som;/);
});

test('a folha tem Mudo e os cinco climas do contrato, num grupo de escolha única, com o nome de cada linha pelo estado', () => {
  const folha = corpoDe(som, 'FolhaSom');
  assert.match(folha, /\{OPCOES_FUNDO_UI\.map\(\(opcao\) => \{/);
  assert.match(folha, /accessibilityRole="radiogroup" accessibilityLabel=\{t\.fundoTitulo\}/);
  assert.match(folha, /accessibilityRole="radio" accessibilityLabel=\{rotulo\}\s+accessibilityState=\{\{ checked: marcada \}\}/);
  assert.match(folha, /const rotulo = erro \? t\.linhaErro\(opcao\.rotulo\) : tocando \? t\.linhaTocando\(opcao\.rotulo\) : t\.linhaRotulo\(opcao\.rotulo, opcao\.descricao\);/);
  for (const texto of ['t.tocando', 't.carregando', 't.erro', 't.titulo', 't.fundoTitulo', 't.fundoDica', 't.efeitosTitulo', 't.efeitosDica', 't.rodape', 't.fechar']) {
    assert.ok(folha.includes(texto), `a folha usa ${texto}`);
  }
  // Um ícone para cada opção do contrato, na ordem dele: Mudo, Foco Calmo, Chuva Suave, Lo-fi de Estudo, Biblioteca, Brisa Natural.
  const icones = som.match(/const ICONES_FUNDO[^;]+;/s)?.[0] ?? '';
  for (const { id } of OPCOES_FUNDO_UI) assert.match(icones, new RegExp(`\\b${id}: '`), `ícone de ${id}`);
  assert.deepEqual(OPCOES_FUNDO_UI.map(({ id }) => id), ['mudo', 'foco_calmo', 'chuva_suave', 'lofi_estudo', 'biblioteca', 'brisa_natural']);
  // As medidas da spec 12: linha de 60, borda 2, raio 16, 6 entre as linhas; quadro de 40 com raio 12; marca de 24 com miolo de 12.
  assert.match(som, /lista: \{ gap: 6 \}/);
  assert.match(som, /opcao: \{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 2,/);
  assert.match(som, /opcaoMarcada: \{ borderColor: cores\.acao, backgroundColor: cores\.ceu \}/);
  assert.match(som, /opcaoIcone: \{ width: 40, height: 40, [^}]*borderRadius: 12, backgroundColor: cores\.nevoa \}/);
  assert.match(som, /marcaMiolo: \{ width: 12, height: 12, borderRadius: 6, backgroundColor: cores\.acao \}/);
  // A descrição numa linha só; o erro em até duas.
  assert.match(folha, /<Text numberOfLines=\{1\} style=\{somEstilos\.opcaoDescricao\}>/);
  assert.match(folha, /<Text numberOfLines=\{2\} style=\{somEstilos\.opcaoErro\}>\{t\.erro\}<\/Text>/);
});

test('a escolha passa pelo toca-sons: prévia com a folha aberta, espera do leitor de tela e nova tentativa no erro', () => {
  const folha = corpoDe(som, 'FolhaSom');
  assert.match(folha, /tocaSons\.definirFundoComAtraso\(id\)/);
  assert.match(folha, /if \(id === estado\.fundo && estado\.estadoFundo === 'erro'\) \{ void tocaSons\.tentarNovamenteFundo\(\); return; \}/);
  assert.match(folha, /void tocaSons\.definirPreviewFolha\(\{ aberta: true \}\)/);
  assert.match(folha, /void tocaSons\.definirPreviewFolha\(\{ aberta: false \}\)/);
  assert.match(folha, /if \(tocaSons\.obterEstado\(\)\.estadoFundo === 'erro'\) void tocaSons\.tentarNovamenteFundo\(\);/);
  // O leitor de tela ouve a escolha (antes do som) e o foco abre no título.
  assert.match(folha, /AccessibilityInfo\.announceForAccessibility\(t\.anuncioMudo\)/);
  assert.match(folha, /AccessibilityInfo\.announceForAccessibility\(t\.anuncioEscolhido\(nomeDoFundo\(estado\.fundo\)\)\)/);
  assert.match(folha, /AccessibilityInfo\.sendAccessibilityEvent\(titulo\.current, 'focus'\)/);
});

test('nada de janela nem chave do sistema: a folha e a chave são do Studoo', () => {
  const importDoRN = som.match(/^import \{[^}]*\} from 'react-native';$/m)?.[0] ?? '';
  assert.ok(importDoRN, 'o import do react-native');
  assert.doesNotMatch(importDoRN, /\bSwitch\b/);
  assert.doesNotMatch(som, /<Switch\b/);
  assert.doesNotMatch(som, /presentationStyle|Alert\.|ActionSheetIOS|ToastAndroid/);
  assert.match(som, /<Modal transparent visible=\{visivel\} animationType="fade"/);
  // A chave: 52 × 32, raio 16, trilho #C9D1EA (bordaCampo) ou na cor de ação; o botão de 26 anda 20.
  assert.match(som, /chave: \{ width: 52, height: 32, borderRadius: 16, backgroundColor: cores\.bordaCampo \}/);
  assert.match(som, /chaveBotao: \{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 13,/);
  assert.match(som, /outputRange: \[0, 20\]/);
  assert.match(corpoDe(som, 'ChaveStudoo'), /accessibilityRole="switch" accessibilityLabel=\{rotulo\} accessibilityHint=\{dica\} accessibilityState=\{\{ checked: ligada \}\}/);
  // A folha: até 480 de largura e 92% da altura, cantos de 24 em cima, alça de 40 × 4.
  assert.match(som, /folha: \{ width: '100%', maxWidth: 480, maxHeight: '92%', borderWidth: 2, borderBottomWidth: 0,/);
  assert.match(som, /alca: \{ alignSelf: 'center', width: 40, height: 4, marginTop: -8, marginBottom: 4, borderRadius: 2, backgroundColor: cores\.gelo \}/);
});

test('o botão da aula: 44 × 44, ícone pelo estado, nome pelo contrato com o motivo e a novidade, ponto de 10 a 6 do canto', () => {
  const botao = corpoDe(som, 'BotaoSom');
  assert.match(botao, /accessibilityLabel=\{t\.botaoRotulo\(\{ clima, efeitos: estado\.efeitosAtivos, motivo, novidade \}\)\}/);
  assert.match(botao, /const motivo = clima && \(estado\.motivoPausa === 'sem_gesto' \|\| estado\.motivoPausa === 'gravando'\) \? estado\.motivoPausa : null;/);
  assert.match(botao, /const icone: NomeIcone = clima \? 'somDuasOndas' : estado\.efeitosAtivos \? 'somUmaOnda' : 'somCortado';/);
  assert.match(botao, /<Icone nome=\{icone\} tamanho=\{24\} cor=\{clima \? cores\.acao : cores\.textoSecundario\} \/>/);
  // No Android, a área de toque chega a 48 (P8).
  assert.match(botao, /hitSlop=\{Platform\.OS === 'android' \? 2 : undefined\}/);
  assert.match(som, /botao: \{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 \}/);
  assert.match(som, /novidade: \{ position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 7,\s+backgroundColor: cores\.ouro \}/);
  // Ao fechar, o foco volta ao botão, depois que a folha saiu.
  assert.match(botao, /depoisDeSair\(\(\) => \{ if \(botao\.current\) AccessibilityInfo\.sendAccessibilityEvent\(botao\.current, 'focus'\); \}\)/);
});

test('a novidade usa as chaves da web e some ao abrir a folha ou na terceira lição concluída', () => {
  assert.match(som, /const CHAVE_VISTO = 'studoo\.sons\.visto';/);
  assert.match(som, /const CHAVE_LICOES = 'studoo\.sons\.licoes';/);
  assert.match(som, /vistoNaMemoria = visto === '1' \|\| Number\(licoes \?\? 0\) >= 3;/);
  assert.match(corpoDe(som, 'FolhaSom'), /marcarSomVisto\(\);/);
  // A conclusão de cada lição conta, como em src/app/estudo.tsx.
  const concluir = estudo.slice(estudo.indexOf('async function concluir('), estudo.indexOf('return false;', estudo.indexOf('async function concluir(')));
  assert.match(concluir, /if \(resultado\.ok\) \{[\s\S]*void contarLicaoParaNovidadeDoSom\(\);/);
});

test('ligado nas telas: o botão no alto da aula, à direita do andamento, e a seção "Som" logo antes de "Conta"', () => {
  const topo = licao.slice(licao.indexOf('const topo = ('), licao.indexOf('\n  );\n', licao.indexOf('const topo = (')));
  assert.ok(topo.indexOf('<BotaoSom />') > topo.indexOf('testID="titulo-topo"'), 'o botão vem depois da coluna do andamento');
  assert.equal((licao.match(/<BotaoSom \/>/g) ?? []).length, 1);
  const secaoSom = perfil.indexOf('<TituloSecao>{mensagens.som.titulo}</TituloSecao>');
  const conta = perfil.indexOf('<TituloSecao>{p.conta}</TituloSecao>');
  assert.ok(secaoSom > 0 && secaoSom < conta, 'a seção Som vem antes de Conta');
  assert.ok(perfil.indexOf('<SomNoPerfil />', secaoSom) < conta);
  // O bloco do Perfil: duas linhas de 64, borda de 2 e raio 24; o nome da linha "Som de fundo" diz o valor.
  assert.match(som, /perfil: \{ borderWidth: 2, borderColor: cores\.gelo, borderRadius: 24, overflow: 'hidden' \}/);
  assert.match(corpoDe(som, 'SomNoPerfil'), /accessibilityLabel=\{t\.perfilFundoRotulo\(valor\)\}/);
  assert.match(corpoDe(som, 'SomNoPerfil'), /dica=\{t\.efeitosDicaPerfil\}/);
});

test('no iPhone, a folha ganha a linha do modo silencioso (P24 da spec 07)', () => {
  assert.match(corpoDe(som, 'FolhaSom'), /\{Platform\.OS === 'ios' && \([\s\S]*?\{t\.rodapeIphone\}/);
});

test('os ícones do controle são os desenhos da web', () => {
  for (const nome of ['somDuasOndas', 'somUmaOnda', 'somCortado', 'ondas', 'chuva', 'fones', 'livros', 'folha', 'info']) {
    assert.match(icone, new RegExp(`^  ${nome}: <`, 'm'), `desenho de ${nome}`);
    assert.match(trilha, new RegExp(`'${nome}'`), `${nome} em NomeIcone`);
  }
  // O alto-falante com uma onda é o da web (src/ui/caminho.tsx).
  assert.match(icone, /somUmaOnda: <><Path d="M4 9\.5h3\.5L12 5\.5v13l-4\.5-4H4z" \/><Path d="M15\.5 9a4 4 0 0 1 0 6" \/><\/>,/);
});
