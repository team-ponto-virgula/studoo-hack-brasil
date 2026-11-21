import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { falarTextoComFormulas } from '../packages/contratos/src/aprendizado.ts';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

// P32 (spec 07): o leitor de tela nunca ouve o texto marcado ($…$) de uma lição de matemática; rótulos, instruções e anúncios
// passam pela fala da fórmula (falarTextoComFormulas), como a web (f13b4a5): "seno de x", "a sobre b".

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const CRU = /[$\\_^{}]/;
// Itens de exercício por formato, como a IA marca numa lição de matemática.
const ITENS = { seno: '$\\sin x$', fracao: '$a/b$', indice: '$x_A + x_B$', afirmacao: 'A onda $h(x) = \\sin x$ passa de 1 em algum ponto.' };

test('a fala de cada formato: "seno de x", "a sobre b", "x índice A", sem caractere cru', () => {
  assert.equal(falarTextoComFormulas(ITENS.seno), 'seno de x');
  assert.equal(falarTextoComFormulas(ITENS.fracao), 'a sobre b');
  assert.match(falarTextoComFormulas(ITENS.indice), /x índice A mais x índice B/);
  for (const texto of Object.values(ITENS)) assert.doesNotMatch(falarTextoComFormulas(texto), CRU, texto);
  const a = mensagens.licao.associar;
  const o = mensagens.licao.ordenar;
  const falas = [
    a.escolhido(falarTextoComFormulas(ITENS.seno)), a.escolhidoDireita(falarTextoComFormulas(ITENS.fracao)),
    a.ligar(falarTextoComFormulas(ITENS.seno), falarTextoComFormulas(ITENS.fracao)),
    a.desfazer(falarTextoComFormulas(ITENS.seno), falarTextoComFormulas(ITENS.fracao)),
    a.travado(falarTextoComFormulas(ITENS.seno), falarTextoComFormulas(ITENS.fracao)),
    o.avisoEscolhido(falarTextoComFormulas(ITENS.seno)), o.avisoTrocaram(falarTextoComFormulas(ITENS.seno), falarTextoComFormulas(ITENS.fracao)),
    o.avisoPosicao(falarTextoComFormulas(ITENS.indice), 2, 3), o.cartaoRotulo(1, 3, falarTextoComFormulas(ITENS.fracao)),
  ];
  for (const fala of falas) assert.doesNotMatch(fala, CRU, fala);
  assert.match(falas[0], /seno de x/); assert.match(falas[1], /a sobre b/);
});

test('Associar: cada botão, a instrução e os anúncios usam a fala', async () => {
  const fonte = await ler('apps/mobile/src/aula-formatos.tsx');
  assert.match(fonte, /const fala = \(lista: Opcao\[\], id: string\) => falarTextoComFormulas\(texto\(lista, id\)\);/);
  assert.match(fonte, /announceForAccessibility\(t\.associar\.escolhido\(fala\(esquerda, nova\)\)\)/);
  assert.match(fonte, /announceForAccessibility\(t\.associar\.escolhidoDireita\(fala\(direita, nova\)\)\)/);
  assert.match(fonte, /let rotulo = falaDoItem;/);
  for (const chamada of ['travado(fala(', 'ligar(fala(esquerda, escolhida), falaDoItem)', 'ligar(falaDoItem, fala(direita', 'desfazer(fala(']) assert.ok(fonte.includes(chamada), chamada);
  assert.doesNotMatch(fonte, /t\.associar\.(travado|ligar|desfazer|escolhido|escolhidoDireita)\([^)]*item\.texto/, 'nenhum rótulo com o texto marcado');
  assert.match(fonte, /<TextoComFormulas estilo=\{formatos\.instrucao\} accessibilityLiveRegion="polite"/, 'a instrução desenha a fórmula e o leitor ouve a fala');
});

test('Ordenar: o cartão e os anúncios ("escolhi", "troquei", "mudei de lugar") usam a fala', async () => {
  const fonte = await ler('apps/mobile/src/ordenar.tsx');
  assert.match(fonte, /const falaDe = \(id: string\) => falarTextoComFormulas\(textoDe\(id\)\);/);
  for (const chamada of ['avisoEscolhido(falaDe(id))', 'avisoTrocaram(falaDe(escolhido), falaDe(id))', 'avisoPosicao(falaDe(id),', 'avisoPosicao(falaDe(atual.id),']) assert.ok(fonte.includes(chamada), chamada);
  assert.doesNotMatch(fonte, /anunciar\([^)]*textoDe\(/, 'nenhum anúncio com o texto marcado');
  assert.match(fonte, /const falado = falarTextoComFormulas\(texto\);\s*const rotulo = travado \? t\.travadoRotulo\(falado, posicao\) : t\.cartaoRotulo\(posicao, total, falado\);/);
});

test('o resto do app: lacuna, critérios da resposta aberta, ponte e títulos de lição nos anúncios', async () => {
  const formatos = await ler('apps/mobile/src/aula-formatos.tsx');
  assert.match(formatos, /partes\.map\(\(parte\) => falarTextoComFormulas\(parte\)\)\.join/, 'trecho com lacuna: rótulo falado');
  assert.match(formatos, /<ComLacunas texto=\{texto\} estilo=\{formatos\.codigo\} preenchimento=\{preenchimento\} puro \/>/, 'o código fica puro');
  assert.match(formatos, /\$\{falarTextoComFormulas\(criterio\.texto\)\}/);
  const ponte = await ler('apps/mobile/src/estudio-adaptativo.tsx');
  assert.match(ponte, /accessibilityLabel=\{falarTextoComFormulas\(ponte\.exercicio\.enunciado\)\}/);
  assert.equal((ponte.match(/<TF texto=\{ponte\.motivo\} \/>/g) ?? []).length, 3);
  assert.doesNotMatch(ponte, /<Text[^>]*>\{ponte\.(exemplo|motivo|exercicio\.enunciado)\}<\/Text>/, 'nada da ponte em texto cru');
  assert.match(await ler('apps/mobile/src/estudo.tsx'), /anuncioLicao\(indice \+ 1, falarTextoComFormulas\(licao\.titulo\)\)/);
  assert.match(await ler('apps/mobile/src/estudo.tsx'), /accessibilityLabel=\{falarTextoComFormulas\(titulo\)\}/);
  assert.match(await ler('apps/mobile/src/caminho.tsx'), /mensagens\.trilha\.liberada\(falarTextoComFormulas\(tituloLiberada\)\)/);
});
