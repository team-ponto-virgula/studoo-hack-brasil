import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { CATALOGO_STU } from '../packages/contratos/src/catalogo-mascote.ts';
import { gerarStuArquivos } from '../apps/mobile/scripts/stu-arquivos.mjs';

// Mascote oficial no app (spec 13): o mapa estático de require() (o Metro não aceita caminho montado) tem de bater com o
// catálogo do contrato e com os arquivos da pasta; o componente segue as regras da emenda (expo-image, teto de 330 px,
// enfeite para o leitor de tela).
const raiz = new URL('../', import.meta.url);
const pasta = new URL('apps/mobile/assets/marca/stu/', raiz);
const mapa = readFileSync(new URL('apps/mobile/src/stu-arquivos.ts', raiz), 'utf8');
const componente = readFileSync(new URL('apps/mobile/src/mascote.tsx', raiz), 'utf8');

test('o mapa de require() está em dia com o catálogo (rode npx tsx apps/mobile/scripts/stu-arquivos.mjs se mudar)', () => {
  assert.equal(mapa, gerarStuArquivos());
});

test('cada imagem do mapa existe na pasta (as animadas, em @2x ou @3x)', () => {
  const faltam = [];
  for (const [, arquivo] of mapa.matchAll(/require\('\.\.\/assets\/marca\/stu\/([^']+)'\)/g)) {
    if (arquivo.endsWith('.webp')) {
      const base = arquivo.replace(/\.webp$/, '');
      if (!existsSync(new URL(`${base}@2x.webp`, pasta)) && !existsSync(new URL(`${base}@3x.webp`, pasta))) faltam.push(arquivo);
    } else if (!existsSync(new URL(arquivo, pasta))) faltam.push(arquivo);
  }
  assert.deepEqual(faltam, []);
});

test('toda imagem parada e animada do catálogo tem entrada no mapa, e nada além delas', () => {
  const esperadas = new Set();
  for (const item of Object.values(CATALOGO_STU)) {
    for (const arquivo of item.app.filter((a) => a.densidade === 1)) esperadas.add(arquivo.arquivo);
    for (const arquivo of item.animacao?.app ?? []) esperadas.add(arquivo.arquivo.replace(/@\d+x(?=\.webp$)/, ''));
  }
  const noMapa = new Set([...mapa.matchAll(/require\('\.\.\/assets\/marca\/stu\/([^']+)'\)/g)].map(([, arquivo]) => arquivo));
  assert.deepEqual([...noMapa].sort(), [...esperadas].sort());
  // Os arquivos da pasta são exatamente os do catálogo (parados em 1x, 2x e 3x; animados nas densidades geradas).
  const naPasta = readdirSync(pasta).sort();
  const doCatalogo = Object.values(CATALOGO_STU).flatMap((item) => [...item.app, ...(item.animacao?.app ?? [])].map((a) => a.arquivo)).sort();
  assert.deepEqual(naPasta, [...new Set(doCatalogo)].sort());
});

test('o componente anima pelo expo-image só até 330 px, nunca com movimento reduzido, e é enfeite para o leitor de tela', () => {
  assert.match(componente, /from 'expo-image'/);
  assert.match(componente, /TETO_ANIMADO_PX = 330/);
  assert.match(componente, /tamanho \* PixelRatio\.get\(\) <= TETO_ANIMADO_PX/);
  assert.match(componente, /reduzir === false/);
  assert.match(componente, /accessible=\{false\} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden/);
  const pacote = JSON.parse(readFileSync(new URL('apps/mobile/package.json', raiz), 'utf8'));
  assert.ok(pacote.dependencies['expo-image'], 'expo-image nas dependências do app');
});

test('o Stu antigo (stu-oi) saiu do app: nenhum uso no código e o arquivo apagado (spec 13, A2)', () => {
  const pastas = ['apps/mobile/src/', 'apps/mobile/app/'];
  const usos = [];
  for (const pasta of pastas) {
    for (const nome of readdirSync(new URL(pasta, raiz)).filter((arquivo) => /\.(ts|tsx)$/.test(arquivo))) {
      if (readFileSync(new URL(`${pasta}${nome}`, raiz), 'utf8').includes('stu-oi')) usos.push(`${pasta}${nome}`);
    }
  }
  assert.deepEqual(usos, []);
  assert.equal(existsSync(new URL('apps/mobile/assets/marca/stu-oi.png', raiz)), false);
});

test('lendo o material (spec 13, B4): na espera de mais de 1 s, o Stu do alto do pedido fica concentrado, em laço; um Stu por tela', () => {
  const pedido = readFileSync(new URL('apps/mobile/src/estudo.tsx', raiz), 'utf8');
  const material = readFileSync(new URL('apps/mobile/src/estudio-adaptativo.tsx', raiz), 'utf8');
  assert.match(pedido, /modo === 'material' && esperaMaterial \? 'stu-concentrado'/);
  assert.match(pedido, /expressaoDoPedido === 'stu-concentrado' \? 'laco'/);
  assert.match(pedido, /aoEsperar=\{setEsperaMaterial\}/);
  assert.match(material, /setTimeout\(\(\) => avisarEspera\.current\?\.\(true\), 1000\)/);
  // O cartão do material não desenha um segundo Stu.
  const corpo = material.slice(material.indexOf('export function MaterialParaTrilha'), material.indexOf('\nfunction AvisoAlerta'));
  assert.doesNotMatch(corpo, /<Stu\b/);
});

test('troféu do fim do mapa (B4, Designer 19/11): acessorio-trofeu em 72% da lente branca, silhueta #8A93B0 a 40% antes da conquista', () => {
  const caminho = readFileSync(new URL('apps/mobile/src/caminho.tsx', raiz), 'utf8');
  const chegada = caminho.slice(caminho.indexOf('function Chegada('), caminho.indexOf('\n}\n', caminho.indexOf('function Chegada(')));
  assert.match(chegada, /<Stu nome="acessorio-trofeu" tamanho=\{Math\.round\(tamanho \* 0\.72\)\} silhueta=\{feita \? undefined : '#8A93B0'\} estilo=\{feita \? undefined : \{ opacity: 0\.4 \}\}/);
  assert.match(chegada, /backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#E0A92E'/);
  assert.match(chegada, /top: 8, backgroundColor: '#C7922A'/);
  assert.doesNotMatch(chegada, /<Icone nome="trofeu"/);
  // A silhueta não anima e pinta só a imagem parada.
  assert.match(componente, /animado && !silhueta && fonteAnimada/);
  assert.match(componente, /silhueta \? \{ tintColor: silhueta \} : null/);
});

test('apresentação (B4, Designer 19/11; banca da noite §2): um Stu por passo — estudando no 1, concentrado no 3 e comemorando de 40 no 4, uma vez a cada entrada, com o pop', () => {
  const apresentacao = readFileSync(new URL('apps/mobile/src/apresentacao.tsx', raiz), 'utf8');
  assert.match(apresentacao, /<ArteProgresso largura=\{largura\} altura=\{arteDoPasso\(3\)\} ativo=\{passo === 3\} \/>/);
  assert.match(apresentacao, /<Stu nome="stu-comemorando" tamanho=\{40\} animado="acontecimento" acontecimento=\{entradas \|\| undefined\} pop=\{entradas \|\| undefined\} \/>/);
  // Banca da noite §2 (spec 04): o passo 1 ganha o stu-estudando ao lado da citação e o passo 3 fica com dois cartões e o
  // Stu concentrado na arte (antes ele vinha no cartão da pergunta do caderno). A ponte do passo 2 traz o dela, da cena.
  assert.match(apresentacao, /<Stu nome="stu-estudando" tamanho=\{tamanho\} animado="acontecimento" acontecimento=\{entradas \|\| undefined\} pop=\{entradas \|\| undefined\} \/>/);
  assert.match(apresentacao, /<Stu nome="stu-concentrado" tamanho=\{80\} animado="acontecimento" acontecimento=\{entradas \|\| undefined\} pop=\{entradas \|\| undefined\} \/>/);
  assert.equal((apresentacao.match(/<Stu\b/g) ?? []).length, 3, 'um Stu próprio em cada um dos passos 1, 3 e 4');
  // No celular, o animado tem teto de 110 (spec 13): o do passo 1 vai até 110; o do passo 3, ao lado dos cartões, tem 80.
  assert.match(apresentacao, /const tamanho = tamanhoDoStuDaArte\(altura, cartao, 72, 110\);/);
  assert.match(componente, /const chaveDoPop = `\$\{nome\}\|\$\{pop \?\? ''\}`/);
});
