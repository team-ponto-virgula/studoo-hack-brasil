import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { trilhaRepetida } from '../packages/contratos/src/aprendizado.ts';
import { mensagens } from '../packages/contratos/src/experiencia.ts';

test('trilhaRepetida compara assunto normalizado antes dos dois-pontos', () => {
  assert.equal(trilhaRepetida('Frações: da pizza à soma', 'Frações: do básico ao cálculo'), true);
  assert.equal(trilhaRepetida('fracoes', 'Frações: revisão'), true);
  assert.equal(trilhaRepetida('Inglês: viagem', 'Fotografia com celular'), false);
  assert.equal(trilhaRepetida('', 'Frações'), false);
});

test('vocabulário unificado da ponte e ausência de window.confirm / scroll smooth', async () => {
  assert.equal(mensagens.estudio.ponteMapaFeita, mensagens.licao.historia.ponteTitulo);

  const [proxySrc, estudoSrc, estudioTsxSrc, aulaSrc] = await Promise.all([
    readFile(new URL('../src/proxy.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/estudo.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/estudio.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/aula.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(proxySrc, /const estilo = desenvolvimento \? "'unsafe-inline'" : `'nonce-\$\{nonce\}'`/);
  assert.equal(estudoSrc.includes('window.confirm'), false);
  assert.match(estudioTsxSrc, /prefers-reduced-motion: reduce/);
  assert.match(aulaSrc, /prefers-reduced-motion: reduce/);
  assert.match(estudioTsxSrc, /const reaberta = Boolean\(ponte\?\.concluida && !vencidaNestaAbertura\)/);
  assert.match(estudioTsxSrc, /ponte\?\.concluida && !reaberta \? m\.pontePronta : m\.ponte/);
  assert.match(estudioTsxSrc, /reaberta \? \(\s*<p role="status" className="estudio-retorno-ponte">\{m\.ponteReabertaAviso\}<\/p>/);
  assert.match(estudioTsxSrc, /setPassoPonte\(1\);\s*setResposta\(''\);\s*setResultadoPonte\(null\);\s*setFeedback\(''\);\s*setVencidaNestaAbertura\(false\);/);
});

test('segunda ponte: mesmo erro reinicia abertura para releitura, erro diferente abre ponte nova e fim de gravação preserva estado', async () => {
  const estudioSrc = await readFile(new URL('../src/app/estudio.tsx', import.meta.url), 'utf8');
  // 1. Ao fechar a ponte (pedidoPonte === 0), pedidoAnterior zera antes de retornar, permitindo releitura no mesmo erro.
  assert.match(estudioSrc, /if \(pedidoPonte === 0\) \{\s*pedidoAnterior\.current = 0;\s*return;\s*\}\s*if \(gravando\) return;/);
  // 2. Erro diferente (chave da ponte não concluída mudou): reinicia para passo 1.
  assert.match(estudioSrc, /if \(anterior && !ponte\?\.concluida\) \{\s*setPassoPonte\(1\);/);
  // 3. Fim de gravação com a ponte aberta: só reinicia quando pedidoPonte !== pedidoAnterior.current.
  assert.match(estudioSrc, /if \(pedidoPonte !== pedidoAnterior\.current\) \{\s*pedidoAnterior\.current = pedidoPonte;\s*setPassoPonte\(1\);/);
});
