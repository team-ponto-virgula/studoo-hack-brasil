// #74 (spec 17, mudança 4): o tour perdeu o selo "Modo demonstração" (tests/onboarding-web.test.mjs); o Código Studoo de uma trilha de EXEMPLO mantém o selo "Exemplo", na imagem que se baixa
// e na apresentação em tela cheia. Aqui: o texto do selo, por onde ele chega à imagem e à apresentação, que o perfil não o leva, e que o selo da apresentação fica centrado sob o título
// (com uma classe só ele perdia para o `.selo-demo` de comunidade.css, que o jogava na borda esquerda; o que vale é a ordem dos arquivos na página, e ela muda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { join, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mensagens } from '@studoo/contratos/experiencia';

register('data:text/javascript,' + encodeURIComponent(`export async function load(url, contexto, proximo) {
  if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
  return proximo(url, contexto);
}`));
const raiz = resolve(import.meta.dirname, '..');
const ler = (caminho) => readFileSync(join(raiz, caminho), 'utf8');
const { ModoApresentacao } = await import('../src/app/codigo.tsx');

const codigo = ler('src/app/codigo.tsx');
const cssDoCodigo = ler('src/app/codigo.css');
const cssDaComunidade = ler('src/app/comunidade.css');

/** O texto de um bloco `function nome(` até o `}` da mesma coluna (as funções do arquivo começam na coluna 0). */
const funcao = (fonte, assinatura) => {
  const inicio = fonte.indexOf(assinatura);
  assert.ok(inicio >= 0, assinatura);
  const fim = fonte.indexOf('\n}\n', inicio);
  return fonte.slice(inicio, fim + 3);
};
/** O corpo da regra cujo seletor (inteiro) é `seletor`, numa linha só. */
const regra = (css, seletor) => new RegExp(`(?:^|\\n)${seletor.replace(/[.()[\]*+?^$|\\>]/g, '\\$&')} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
/** Quantas classes tem o seletor: a especificidade (0,N,0) de um seletor só de classes. */
const classes = (seletor) => (seletor.match(/\.[A-Za-z_-]/g) ?? []).length;

test('o selo é a palavra "Exemplo" do contrato (a mesma do Explorar), não "Modo demonstração"', () => {
  assert.equal(mensagens.comunidade.demonstracao, 'Exemplo');
  // Nenhum texto escrito à mão no desenho da imagem: o selo vem do contrato.
  assert.doesNotMatch(codigo, /fillText\(\s*['"`][^'"`]*emonstra/i);
  assert.match(codigo, /ctx\.fillText\(mensagens\.comunidade\.demonstracao, 540, y \+ 33\)/);
});

test('a imagem que se baixa desenha o selo só quando a trilha é de exemplo, e o título sobe para abrir espaço', () => {
  const imagem = funcao(codigo, 'export async function imagemDoCodigo(');
  assert.match(imagem, /demonstracao = false/, 'sem a opção, nada de selo');
  assert.match(imagem, /const topoTitulo = \(titulos\.length === 1 \? 166 : 118\) - \(demonstracao \? 24 : 0\);/);
  const bloco = /if \(demonstracao\) \{([\s\S]*?)\n  \}\n/.exec(imagem)?.[1] ?? '';
  assert.ok(bloco, 'o selo fica dentro de if (demonstracao)');
  assert.match(bloco, /ctx\.fillStyle = '#fff4d6';/, 'o fundo creme');
  assert.match(bloco, /ctx\.setLineDash\(\[6, 5\]\)/, 'a borda tracejada');
  assert.match(bloco, /ctx\.fillText\(mensagens\.comunidade\.demonstracao,/);
});

test('o painel passa "é de exemplo" para a imagem e para a apresentação', () => {
  const painel = funcao(codigo, 'export function PainelCodigo(');
  assert.match(painel, /imagemDoCodigo\(\{ texto: url, titulo, dica, cor, fotoToken, inicial: centroInicial, demonstracao \}\)/, 'baixar e compartilhar a imagem usam o mesmo gerar()');
  assert.match(painel, /<ModoApresentacao [^>]*demonstracao=\{demonstracao\}/);
});

test('a folha da trilha diz ao painel se a trilha é de exemplo; o código do perfil nunca leva o selo', () => {
  const compartilhar = ler('src/app/compartilhar.tsx');
  assert.match(compartilhar, /<PainelCodigo [^>]*\n?[^>]*demonstracao=\{Boolean\(previa\.demonstracao\)\}/);
  const perfil = funcao(codigo, 'export function FolhaCompartilharPerfil(');
  assert.doesNotMatch(perfil, /demonstracao/, 'o perfil tem o seu selo ("Perfil de demonstração") na página, não no código');
});

test('a apresentação mostra "Exemplo" entre o título e o código quando é de exemplo, e nada quando não é', () => {
  const arg = { svg: '<svg></svg>', titulo: 'Frações: do inteiro à soma', rotulo: 'Código Studoo', aoFechar: () => {} };
  const com = renderToStaticMarkup(createElement(ModoApresentacao, { ...arg, demonstracao: true }));
  assert.match(com, /<h2[^>]*>Frações: do inteiro à soma<\/h2><p class="selo-demo apresentacao-codigo__demo">Exemplo<\/p><span class="apresentacao-codigo__codigo"/);
  const sem = renderToStaticMarkup(createElement(ModoApresentacao, arg));
  assert.doesNotMatch(sem, /selo-demo|Exemplo/);
});

test('o selo da apresentação fica centrado sob o título e vence o `.selo-demo`, em qualquer ordem dos arquivos', () => {
  const seletor = /(?:^|\n)([^\n{]*\.apresentacao-codigo__demo[^\n{]*) \{/.exec(cssDoCodigo)?.[1];
  assert.ok(seletor, 'há uma regra para o selo da apresentação');
  const propria = regra(cssDoCodigo, seletor);
  assert.match(propria, /justify-self: center;/, 'centrado no bloco (a grade do bloco centra os itens)');
  assert.match(propria, /margin: -8px 0 0;/, 'colado ao título (a grade tem 20 px de vão; o selo sobe 8)');
  const doSelo = regra(cssDaComunidade, '.selo-demo');
  assert.match(doSelo, /justify-self: start;/, 'o `.selo-demo` comum fica à esquerda (Explorar e Perfil)');
  assert.equal(classes('.selo-demo'), 1);
  assert.ok(classes(seletor) > classes('.selo-demo'), `"${seletor}" precisa de mais classes que ".selo-demo": com a mesma especificidade, ganha o arquivo que chega depois à página`);
});
