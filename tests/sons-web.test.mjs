// Sons na web: cada efeito disparado existe no catálogo e tem arquivo, os momentos pedidos estão ligados, e o toca-sons
// (`src/app/sons.ts`, que usa Web Audio e localStorage) não entra em código de servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '..');
const src = join(raiz, 'src');
const sons = join(src, 'app', 'sons.ts');

function arquivos(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(?:ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}
const todos = arquivos(src);
const texto = new Map(todos.map((arquivo) => [arquivo, readFileSync(arquivo, 'utf8')]));
const cliente = (arquivo) => /^\s*['"]use client['"]/.test(texto.get(arquivo) ?? '');

const catalogo = readFileSync(join(raiz, 'packages/contratos/src/catalogo-sons.ts'), 'utf8');
const efeitos = new Map([...catalogo.matchAll(/^\s+(\w+): \{ id: '(\w+)', arquivo: '([\w.-]+)'/gm)].map(([, chave, id, arquivo]) => {
  assert.equal(chave, id, `chave e id do catálogo batem (${chave})`);
  return [id, arquivo];
}));

/**
 * Os disparos no código: os nomes entre aspas no resto da linha de `tocarEfeito(` (pega também a escolha
 * `correta ? 'acerto' : 'erro'`) e o `som` padrão do aviso do app. Fora o próprio toca-sons.
 */
const disparos = new Map();
for (const [arquivo, conteudo] of texto) {
  if (arquivo === sons) continue;
  for (const [, resto] of conteudo.matchAll(/tocarEfeito\((.*)$/gm)) {
    for (const [, id] of resto.split(';')[0].matchAll(/['"](\w+)['"]/g)) disparos.set(id, [...(disparos.get(id) ?? []), relative(raiz, arquivo)]);
  }
  for (const [, id] of conteudo.matchAll(/(?:som: IdEfeitoSonoro \| null = |opcoes\.som === undefined \? |som: )'(\w+)'/g)) disparos.set(id, [...(disparos.get(id) ?? []), relative(raiz, arquivo)]);
}

test('cada efeito disparado existe no catálogo e tem o arquivo em public/sons/sfx', () => {
  assert.ok(efeitos.size >= 20, 'o catálogo foi lido');
  assert.ok(disparos.size > 0, 'há disparos no código');
  for (const [id, onde] of disparos) {
    assert.ok(efeitos.has(id), `"${id}" (em ${onde.join(', ')}) existe no catálogo`);
    assert.ok(existsSync(join(raiz, 'public/sons/sfx', efeitos.get(id))), `arquivo de "${id}" existe`);
  }
});

test('os momentos pedidos estão ligados na web', () => {
  // `conta_criada` fica de fora: a web não tem formulário de criar conta (a conta nova vem pelo Google, no servidor).
  const pedidos = ['toque_opcao', 'acerto', 'erro', 'ponte_abrir', 'concluir_licao', 'concluir_trilha', 'entrar', 'valeu', 'seguir',
    'link_copiado', 'salvo', 'aviso', 'erro_rede', 'apagar', 'geracao_licao', 'geracao_pronta', 'cronometro_inicio', 'cronometro_fim',
    'gravacao_inicio', 'gravacao_fim'];
  for (const id of pedidos) assert.ok(disparos.has(id), `"${id}" tem disparo`);
  // Convivência: a voz de leitura e o acorde/batida abaixam o fundo; gravação e voz ao vivo param o fundo.
  const aula = texto.get(join(src, 'app/aula.tsx'));
  const estudio = texto.get(join(src, 'app/estudio.tsx'));
  assert.ok(/entrarEmFala\(\)/.test(aula) && /sairDeFala\(\)/.test(aula), 'aula entra e sai de fala');
  assert.equal((estudio.match(/entrarEmGravacaoOuVoz\(\)/g) ?? []).length, 2, 'gravação e voz ao vivo entram');
  assert.equal((estudio.match(/sairDeGravacaoOuVoz\(\)/g) ?? []).length, 2, 'gravação e voz ao vivo saem');
});

/** Resolve uma importação local (relativa ou `@/`) para o arquivo em src/. */
function resolver(de, alvo) {
  let base;
  if (alvo.startsWith('@/')) base = join(src, alvo.slice(2));
  else if (alvo.startsWith('.')) base = resolve(dirname(de), alvo);
  else return null;
  for (const candidato of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (texto.has(candidato)) return candidato;
  }
  return null;
}

test('o toca-sons não é importado por código de servidor', () => {
  const entradaDeServidor = (arquivo) => {
    const rel = relative(src, arquivo).replaceAll('\\', '/');
    return rel.startsWith('servidor/') || rel.startsWith('app/api/') || /^(?:proxy|middleware|instrumentation)\.ts$/.test(rel)
      || /(?:^|\/)(?:page|layout|route|not-found|opengraph-image|twitter-image|icon|apple-icon|manifest|robots|sitemap)\.tsx?$/.test(rel);
  };
  const entradas = todos.filter((arquivo) => entradaDeServidor(arquivo) && !cliente(arquivo));
  assert.ok(entradas.length > 10, 'achou as entradas de servidor');
  for (const entrada of entradas) {
    // Percorre as importações até a fronteira 'use client' (dali para dentro é código do navegador).
    const vistos = new Set();
    const pilha = [[entrada, [relative(raiz, entrada)]]];
    while (pilha.length) {
      const [arquivo, caminho] = pilha.pop();
      if (vistos.has(arquivo)) continue;
      vistos.add(arquivo);
      assert.notEqual(arquivo, sons, `servidor chega ao toca-sons: ${caminho.join(' → ')}`);
      for (const [, alvo] of texto.get(arquivo).matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
        const proximo = resolver(arquivo, alvo);
        if (proximo && !cliente(proximo)) pilha.push([proximo, [...caminho, relative(raiz, proximo)]]);
      }
    }
  }
});
