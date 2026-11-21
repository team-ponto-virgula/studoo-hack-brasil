import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// Banca do Mobile & QA (21/11), itens do app. P0-3: a trilha recebida de quem excluiu a conta nunca monta "Esta trilha é de "
// (nem "Compartilhada por ") com o nome vazio; a linha some, e a trilha continua recebida (sem compartilhar de novo).
const ler = (caminho) => readFile(new URL(`../apps/mobile/src/${caminho}`, import.meta.url), 'utf8');
const social = await ler('social.tsx');
const configuracoes = await ler('configuracoes.tsx');
const estudo = await ler('estudo.tsx');

function funcao(fonte, nome) {
  const inicio = fonte.indexOf(`export function ${nome}(`);
  const fim = fonte.indexOf('\n}\n', inicio) + 2;
  const js = ts.transpileModule(fonte.slice(inicio, fim).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(`${js}; return ${nome};`)();
}

test('P0-3: sem nome (vazio, espaços ou null), não há nome de quem compartilhou', () => {
  const nomeDeQuemCompartilhou = funcao(social, 'nomeDeQuemCompartilhou');
  assert.equal(nomeDeQuemCompartilhou({ nome: 'Carla Mendes' }), 'Carla Mendes');
  assert.equal(nomeDeQuemCompartilhou({ nome: '  Ana ' }), 'Ana');
  for (const vazio of [{ nome: '' }, { nome: '   ' }, { nome: null }, {}, null, undefined]) assert.equal(nomeDeQuemCompartilhou(vazio), null);
});

test('P0-3: o mapa, a marca do cartão e as configurações só montam a frase com nome', () => {
  const recebida = social.slice(social.indexOf('export function TrilhaRecebida('), social.indexOf('\n}\n', social.indexOf('export function TrilhaRecebida(')));
  assert.match(recebida, /const nome = nomeDeQuemCompartilhou\(recebida\);/);
  assert.match(recebida, /\{nome && <FraseComNome frase=\{m\.recebidaDe\(nome\)\}/);
  assert.doesNotMatch(recebida, /m\.recebidaDe\(recebida\.nome\)/);
  const marca = social.slice(social.indexOf('export function MarcaCompartilhar('), social.indexOf('export function TrilhaRecebida('));
  assert.match(marca, /const nome = nomeDeQuemCompartilhou\(marcas\.recebida\);\n    if \(!nome\) return null;/);
  // Configurações: '' continua recebida (sem "Quem pode ver" e com a capa de quem recebe), mas sem a frase.
  assert.match(estudo, /recebidaDe=\{resumo\?\.recebida \? resumo\.recebida\.nome \?\? '' : null\}/);
  assert.match(configuracoes, /\{recebidaDe\?\.trim\(\) \? <Text testID="configuracoes-recebida"/);
  assert.match(configuracoes, /daDona=\{recebidaDe == null\}/);
  assert.match(configuracoes, /\{compartilhar && recebidaDe == null && \(/);
});

test('P1-8: no Android, a borda, o fundo e o respiro dos campos ficam numa caixa em volta (o texto não encosta na borda)', async () => {
  const interfaceApp = await ler('interface.tsx');
  const formatos = await ler('aula-formatos.tsx');
  const caixa = interfaceApp.slice(interfaceApp.indexOf('export function CaixaDoCampo('), interfaceApp.indexOf('/** Botão só com ícone'));
  assert.match(caixa, /if \(Platform\.OS !== 'android'\) return <>\{children\(estilo\)\}<\/>;/, 'iPhone e prévia web sem mudança');
  assert.match(caixa, /<Pressable accessible=\{false\} importantForAccessibility="no" onPress=\{focar\} style=\{caixa\}>/);
  assert.match(caixa, /children\(\[texto, estilos\.campoSemCaixa\]\)/);
  assert.match(interfaceApp, /campoSemCaixa: \{ flexGrow: 1, padding: 0, margin: 0, borderWidth: 0, backgroundColor: 'transparent' \}/);
  const separar = interfaceApp.slice(interfaceApp.indexOf('export function separarCaixaDoTexto('), interfaceApp.indexOf('/**\n * A caixa dos campos de texto'));
  const js = ts.transpileModule(`const StyleSheet = { flatten: (e) => Object.assign({}, ...[e].flat(9).filter(Boolean)) };\n${separar.replace('export ', '')}; return separarCaixaDoTexto;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const separarCaixaDoTexto = new Function(js)();
  const { caixa: c, texto: t } = separarCaixaDoTexto([{ minHeight: 112, paddingVertical: 18, paddingHorizontal: 20, borderWidth: 3, borderRadius: 24, borderColor: '#E1E7FA', backgroundColor: '#fff', fontSize: 19, lineHeight: 27, fontWeight: '700', color: '#0B1B5C', textAlignVertical: 'top' }, false, { paddingRight: 52 }]);
  assert.deepEqual(Object.keys(c).sort(), ['backgroundColor', 'borderColor', 'borderRadius', 'borderWidth', 'minHeight', 'paddingHorizontal', 'paddingRight', 'paddingVertical']);
  assert.deepEqual(Object.keys(t).sort(), ['color', 'fontSize', 'fontWeight', 'lineHeight', 'textAlignVertical']);
  // Os campos do app (o pedido, a entrada, o perfil) passam pelo Campo; a resposta aberta da aula também usa a caixa.
  assert.match(interfaceApp, /<CaixaDoCampo focar=\{\(\) => interno\.current\?\.focus\(\)\}/);
  assert.match(formatos, /<CaixaDoCampo focar=\{\(\) => campo\.current\?\.focus\(\)\} estilo=\{\[formatos\.aberta,/);
});

test('P2-1: o troféu da criação é pré-carregado na tela do pedido (no iPhone não fica um disco branco)', async () => {
  const mascote = await ler('mascote.tsx');
  assert.match(mascote, /export const TROFEU_DA_CRIACAO = \['acessorio-trofeu-p', 'acessorio-trofeu-m'\] as const;/);
  assert.match(mascote, /lugar: \{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' \}/);
  assert.match(mascote, /accessibilityElementsHidden style=\{estilosDaPreCarga\.lugar\}/);
  assert.match(estudo, /<Tela pagina="objetivo"[^\n]*>\n\s*\{\/\*[^\n]*\*\/\}\n\s*<PreCargaDoStu arquivos=\{TROFEU_DA_CRIACAO\} \/>/);
  const arquivos = await ler('stu-arquivos.ts');
  assert.match(arquivos, /'acessorio-trofeu-p': require/);
  assert.match(arquivos, /'acessorio-trofeu-m': require/);
});

test('P2-3: a barra da lacuna fica na linha de base, como um sublinhado (não meia linha abaixo)', async () => {
  const formatos = await ler('aula-formatos.tsx');
  const inicio = formatos.indexOf('export function deslocamentoDaLacuna(');
  const js = ts.transpileModule(formatos.slice(inicio, formatos.indexOf('\n}\n', inicio) + 2).replace('export ', ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const deslocamentoDaLacuna = new Function(`${js}; return deslocamentoDaLacuna;`)();
  assert.equal(deslocamentoDaLacuna(20), 2.4);
  assert.equal(deslocamentoDaLacuna(16), 1.9);
  assert.match(formatos, /transform: \[\{ translateY: deslocamentoDaLacuna\(fonte\) \}\]/);
  assert.doesNotMatch(formatos, /linha \/ 2 - fonte \* 0\.229/);
});
