import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Um aviso do app redesenha a raiz (sessao.tsx), e `expirar` nasce de novo a cada desenho. Se o efeito que carrega
// Minhas trilhas dependesse dele, qualquer aviso recarregaria a lista e reabriria a trilha em andamento (achado nos
// quadros de "Postar no perfil", 20/11). O efeito depende só do cliente e da nova tentativa; `expirar` vai numa referência.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');

test('a raiz passa um `expirar` novo a cada desenho (por isso ele não pode ser dependência da carga da lista)', async () => {
  const sessao = await ler('apps/mobile/src/sessao.tsx');
  assert.match(sessao, /async function expirar\(\) \{/, 'função comum, recriada a cada desenho');
  assert.match(sessao, /<Estudo cliente=\{cliente\} sair=\{[^}]*\} expirar=\{expirar\} \/>/);
});

test('Minhas trilhas carrega a lista só com o cliente e a nova tentativa; `expirar` fica numa referência', async () => {
  const estudo = await ler('apps/mobile/src/estudo.tsx');
  const efeito = estudo.slice(estudo.indexOf('async function carregarPlanos()'), estudo.indexOf('// Sair do estudo no meio da geração'));
  assert.match(efeito, /const inicial = planoInicial\(lista\);/, 'é o efeito que reabre a trilha em andamento');
  assert.match(efeito, /\}, \[cliente, tentativa\]\);/);
  assert.doesNotMatch(estudo, /\[cliente, expirar, tentativa\]/);
  assert.match(estudo, /const expirarAtual = useRef\(expirar\);\s*expirarAtual\.current = expirar;/);
  assert.match(estudo, /guardarRascunho\(objetivoAtual\.current\);\s*await expirarAtual\.current\(\);/);
  // Nenhum outro efeito do Estudo depende de `expirar`.
  assert.doesNotMatch(estudo, /\], ?\[[^\]]*\bexpirar\b[^\]]*\]\)|\}, \[[^\]]*\bexpirar\b[^\]]*\]\);/);
});
