// Banca da noite (spec 04) na web, itens 5 e 7: a barra de abas desde a conta sem trilhas (com "Nova trilha" marcada) e o
// conceito em blocos curtos com as frases de áudio numa lista com "Ouvir" (a regra do contrato, a mesma do app).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { conceitoEmBlocos, falasDoTexto } from '@studoo/contratos';

const raiz = resolve(import.meta.dirname, '..');
const ler = (arquivo) => readFileSync(join(raiz, arquivo), 'utf8');
const estudo = ler('src/app/estudo.tsx');
const aula = ler('src/app/aula.tsx');
const aulaCss = ler('src/app/aula.css');

test('item 5: a barra de abas aparece nas telas de topo também sem trilhas, com "Nova trilha" marcada', () => {
  assert.match(estudo, /const comNavegacao = \(\(inicio === 'carregando' && tinhaTrilhas\) \|\| \(inicio === 'pronto' && \['planos', 'objetivo', 'plano', 'perfil', 'explorar', 'configuracoes'\]\.includes\(tela\.tipo\)\)\) && visivel;/);
  assert.doesNotMatch(estudo, /planos\.length > 0 && \['planos', 'objetivo'/);
  assert.match(estudo, /const abaNovaTrilha = tela\.tipo === 'objetivo' \|\| \(tela\.tipo === 'planos' && planos\.length === 0\);/);
  assert.match(estudo, /aria-current=\{abaNovaTrilha \? 'page' : undefined\}/);
  // No celular, com a barra, o cabeçalho fica só com a marca e o selo.
  assert.match(ler('src/app/globals.css'), /\.estudo\[data-navegacao\] \.planos-movel \{ display: none; \}/);
  assert.match(ler('src/app/compartilhar.css'), /\.estudo\[data-navegacao\] \.perfil-cabecalho \{ display: none; \}/);
});

test('item 7: o conceito mostra o começo (até 3 frases, até 60 palavras) e o resto fica em "Continuar lendo"', () => {
  const texto = 'Primeira frase curta. Segunda frase também curta. Terceira frase aqui. Quarta frase que fica para depois.';
  assert.deepEqual(conceitoEmBlocos(texto), { inicio: 'Primeira frase curta. Segunda frase também curta. Terceira frase aqui.', resto: 'Quarta frase que fica para depois.' });
  assert.deepEqual(falasDoTexto('Diga “Hello!” e depois “Good morning”. Em português: “Olá, tudo bem”.', 'en-US'), ['Hello!', 'Good morning']);
  assert.deepEqual(falasDoTexto('Diga “Hello!”.', 'pt-BR'), []);
  const explicacao = aula.slice(aula.indexOf('function ExplicacaoComFalas'), aula.indexOf('/** Na conclusão: as frases da lição'));
  assert.match(explicacao, /const \{ inicio, resto \} = conceitoEmBlocos\(texto\);/);
  assert.match(explicacao, /falasDoTexto\(aberto \? texto : inicio, idioma\)/);
  assert.match(explicacao, /aria-label=\{t\.audio\.ouvirFrase\(frase\)\}/);
  assert.doesNotMatch(explicacao, /fala-inline|toqueParaOuvir/, 'sem links no parágrafo e sem "toque para ouvir"');
  assert.match(aula, /etapa\.tipo === 'conceito' && restoDoConceito && !conceitoAberto\) \{[\s\S]*?onClick=\{abrirConceito\}>\{t\.continuarLendo\}/, 'o rodapé faz o mesmo que o balão');
  assert.match(aulaCss, /\.aula-falas-lista \{ display: grid; gap: 8px; margin: 12px 0 0; padding: 12px 0 0; border-top: 2px solid #e1e7fa;/);
  assert.match(aulaCss, /\.aula-falas-lista__frase \{[^}]*color: #0b1b5c; font-size: 16px; font-weight: 800; line-height: 22px;/);
  assert.match(aulaCss, /\.aula-falas-lista__ouvir \{[^}]*min-height: 44px;[^}]*border: 2px solid #b9c6f3;[^}]*box-shadow: 0 4px 0 #b9c6f3; font: inherit; font-size: 14px;/);
});
