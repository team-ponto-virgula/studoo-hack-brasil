import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

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

test('a folha: duas chaves independentes, "Música de fundo" (o Lo-fi, em laço) e "Efeitos sonoros", e a linha de estado da música', () => {
  const folha = corpoDe(som, 'FolhaSom');
  const chaves = corpoDe(som, 'ChavesDoSom');
  assert.match(folha, /<ChavesDoSom estado=\{estado\} \/>/);
  assert.doesNotMatch(som, /OPCOES_FUNDO_UI|radiogroup|accessibilityRole="radio"/, 'sem lista de climas nem escolha única');
  assert.match(chaves, /<ChaveStudoo testID=\{`\$\{prefixo\}-musica`\} ligada=\{ligada\} rotulo=\{t\.musicaTitulo\} dica=\{t\.musicaEmLaco\}/);
  assert.match(chaves, /aoMudar=\{\(valor\) => void tocaSons\.definirMusicaLigada\(valor\)\}/);
  assert.match(chaves, /<ChaveStudoo testID=\{`\$\{prefixo\}-efeitos`\} ligada=\{estado\.efeitosAtivos\}/);
  assert.match(chaves, /aoMudar=\{\(valor\) => void tocaSons\.definirEfeitosAtivos\(valor\)\}/);
  // A linha de estado: tocando (barras), carregando (giro), antes do primeiro toque, gravando, erro; desligada, nada.
  const estado = corpoDe(som, 'EstadoDaMusica');
  for (const texto of ['t.musicaErro', 't.musicaComeca', 't.musicaPausada', 't.carregando', 't.tocando']) assert.ok(estado.includes(texto), `estado usa ${texto}`);
  assert.match(estado, /if \(!ligada\) return null;/);
  assert.match(som, /estadoErro: \{ marginTop: 2, color: '#C23B4E',/);
  assert.match(folha, /\{t\.rodapeMusica\}/);
  assert.match(folha, /<Stu nome="acessorio-fone" tamanho=\{40\} \/>/);
});

test('a folha passa pelo toca-sons: a música a 60% com o leitor de tela e nova tentativa no erro ao reabrir', () => {
  const folha = corpoDe(som, 'FolhaSom');
  assert.match(folha, /void tocaSons\.definirPreviewFolha\(\{ aberta: true \}\)/);
  assert.match(folha, /void tocaSons\.definirPreviewFolha\(\{ aberta: false \}\)/);
  assert.match(folha, /if \(tocaSons\.obterEstado\(\)\.estadoFundo === 'erro'\) void tocaSons\.tentarNovamenteFundo\(\);/);
  assert.match(folha, /AccessibilityInfo\.sendAccessibilityEvent\(titulo\.current, 'focus'\)/);
});

test('o aviso da primeira vez: "Música de fundo ligada." com "Desligar", uma vez por aparelho, na raiz (vale na entrada)', () => {
  const aviso = corpoDe(som, 'useAvisoDaMusica');
  assert.match(som, /const CHAVE_AVISO_MUSICA = 'studoo\.sons\.avisoMusica';/);
  assert.match(aviso, /avisar\(t\.musicaAviso, \{ som: null, noAlto: true, acao: \{ rotulo: t\.desligarMusica, aoTocar: \(\) => void tocaSons\.definirMusicaLigada\(false\) \} \}\);/);
  assert.match(aviso, /if \(avisado !== false \|\| estado\.fundo === 'mudo' \|\| estado\.estadoFundo !== 'tocando'\) return;/);
  const sessao = readFileSync(new URL('../apps/mobile/src/sessao.tsx', import.meta.url), 'utf8');
  assert.match(sessao, /const avisoDoApp = useAvisoDoAppRaiz\(\);\n\s*useAvisoDaMusica\(avisoDoApp\.avisar\);/);
  assert.match(sessao, /return <AvisoDoApp\.Provider value=\{avisoDoApp\}>\{tela\(\)\}<\/AvisoDoApp\.Provider>;/);
  assert.match(estudo, /const avisoDoApp = useContext\(AvisoDoApp\);/, 'o Estudo usa o aviso da raiz');
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

test('o botão da aula: 44 × 44, ícone pela música e pelos efeitos, nome pelo contrato com o motivo, sem ponto de novidade', () => {
  const botao = corpoDe(som, 'BotaoSom');
  assert.match(botao, /accessibilityLabel=\{t\.botaoMusicaRotulo\(ligada, estado\.efeitosAtivos, motivo\)\}/);
  assert.match(som, /const motivo = ligada && \(estado\.motivoPausa === 'sem_gesto' \|\| estado\.motivoPausa === 'gravando'\) \? estado\.motivoPausa : undefined;/);
  assert.match(botao, /const icone: NomeIcone = ligada \? 'somDuasOndas' : estado\.efeitosAtivos \? 'somUmaOnda' : 'somCortado';/);
  assert.match(botao, /<Icone nome=\{icone\} tamanho=\{24\} cor=\{ligada \? cores\.acao : cores\.textoSecundario\} \/>/);
  // No Android, a área de toque chega a 48 (P8).
  assert.match(botao, /hitSlop=\{Platform\.OS === 'android' \? 2 : undefined\}/);
  assert.match(som, /botao: \{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 \}/);
  assert.doesNotMatch(som, /novidade|CHAVE_VISTO|CHAVE_LICOES|contarLicaoParaNovidadeDoSom/, 'sem ponto de novidade (spec 12, música única)');
  assert.doesNotMatch(estudo, /contarLicaoParaNovidadeDoSom/);
  // Ao fechar, o foco volta ao botão, depois que a folha saiu.
  assert.match(botao, /depoisDeSair\(\(\) => \{ if \(botao\.current\) AccessibilityInfo\.sendAccessibilityEvent\(botao\.current, 'focus'\); \}\)/);
});

test('ligado nas telas: o botão no alto da aula, à direita do andamento, e a seção "Som" logo antes de "Conta"', () => {
  const topo = licao.slice(licao.indexOf('const topo = ('), licao.indexOf('\n  );\n', licao.indexOf('const topo = (')));
  assert.ok(topo.indexOf('<BotaoSom />') > topo.indexOf('testID="titulo-topo"'), 'o botão vem depois da coluna do andamento');
  assert.equal((licao.match(/<BotaoSom \/>/g) ?? []).length, 1);
  const secaoSom = perfil.indexOf('<TituloSecao>{mensagens.som.titulo}</TituloSecao>');
  const conta = perfil.indexOf('<TituloSecao>{p.conta}</TituloSecao>');
  assert.ok(secaoSom > 0 && secaoSom < conta, 'a seção Som vem antes de Conta');
  assert.ok(perfil.indexOf('<SomNoPerfil />', secaoSom) < conta);
  // O bloco do Perfil: as mesmas duas chaves da folha (sem seta nem folha), borda de 2 e raio 24.
  assert.match(som, /perfil: \{ borderWidth: 2, borderColor: cores\.gelo, borderRadius: 24, overflow: 'hidden' \}/);
  assert.match(corpoDe(som, 'SomNoPerfil'), /<ChavesDoSom estado=\{estado\} noPerfil \/>/);
  assert.match(corpoDe(som, 'ChavesDoSom'), /noPerfil \? t\.efeitosDicaPerfil : t\.efeitosDica/);
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
