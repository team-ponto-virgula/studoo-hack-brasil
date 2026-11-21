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
