// Banca da noite (spec 04) na web, itens 8, 9 e 10: vazios sem a fileira de temas, alvos de 44×44 nos botões de texto e
// links de ação, e texto auxiliar com 13 px (metadados) ou 14 px (dicas), sem opacidade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const ler = (arquivo) => readFileSync(join(raiz, arquivo), 'utf8');
const globais = ler('src/app/globals.css');

test('item 8: com a lista vazia (Explorar, tema sem trilha ou Seguindo), a fileira de temas e as setas somem', () => {
  assert.match(ler('src/app/comunidade.tsx'), /const semFichas = Boolean\(vazio\) \|\| \(aba === 'seguindo' && pagina\?\.seguindoAlguem === false\);/);
});

test('item 9: botões de texto e links de ação com 44×44 (o link no meio da frase cresce por fora com ::after)', () => {
  const bloco = globais.slice(globais.lastIndexOf('/*\n * Banca da noite §9'));
  assert.match(bloco, /\.botao\.botao--texto \{ min-height: 44px; min-width: 44px; padding-inline: 12px; \}/);
  assert.match(bloco, /\.aula-voltar-etapa, \.exercicio-recomecar, \.como-foi__sem-cronometro, \.pedido-como, \.aula-consulta > summary/);
  assert.match(bloco, /\.aula-aviso__acao::after[^{]*\{\s*content: ''; position: absolute; inset: 50% -12px auto; height: 44px;/);
  assert.match(ler('src/app/compartilhar.css'), /\.perfil-link__titulo \{[^}]*min-height: 44px;/);
});

test('item 10: metadados em 13 px, dicas em 14 e nenhuma opacidade em texto das opções verificadas', () => {
  assert.match(globais, /\.selo-sincronia, \.plano-destaque__rotulo, \.trilha-topo__rotulo, \.estudio-selo \{ font-size: 13px; \}/);
  assert.match(globais, /\.caminho-inicio__dica \{ font-size: 14px; \}/);
  assert.match(ler('src/app/trilha.css'), /\.trilha-topo__rotulo \{ font-size: 13px; \}/);
  assert.doesNotMatch(ler('src/app/trilha.css'), /\.trilha-topo__rotulo \{ font-size: 0\.6875rem; \}/);
  const aula = ler('src/app/aula.css');
  assert.match(aula, /\.aula-titulo-topo \{ font-size: 13px; \}/);
  assert.match(aula, /\.como-foi\[data-travado\] label \{ opacity: 1; color: var\(--texto2\); \}/);
});
