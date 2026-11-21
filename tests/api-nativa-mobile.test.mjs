import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// O cliente do app (apps/mobile/src/api-nativa.ts): /api/auth/config é pública e recusa pedido com Authorization (rotaPublica
// responde 401). Com sessão, o app mandava o token também nela, e a configuração nunca chegava (o compartilhar não aparecia
// e o aviso do material ficava sem o provedor). Sem React Native e sem rede: o módulo roda transpilado, com dublês.

const fonte = await readFile(new URL('../apps/mobile/src/api-nativa.ts', import.meta.url), 'utf8');
const codigo = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function montar({ semRede = false } = {}) {
  const pedidos = [];
  const sons = [];
  class ErroStudoo extends Error {
    constructor(codigo) { super(codigo); this.codigo = codigo; }
  }
  // Um cliente mínimo no formato do contrato: cada método chama o transporte com o caminho da rota.
  const criarClienteStudoo = (transporte) => ({
    configuracaoAcesso: () => transporte('/api/auth/config', { method: 'GET' }).then((r) => r.json()),
    listarPlanos: () => transporte('/api/aprendizado/planos', { method: 'GET' }).then((r) => r.json()),
    enviarFoto: (base64) => transporte('/api/perfil/foto', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64 }) }).then((r) => r.json()),
  });
  const fetch = async (url, opcoes) => {
    pedidos.push({ url, metodo: opcoes.method, headers: opcoes.headers });
    if (semRede) throw new TypeError('Network request failed');
    return { status: 200, ok: true, json: async () => ({ ok: true }), headers: { get: () => 'application/json' } };
  };
  const exports = {};
  runInNewContext(codigo, {
    exports,
    process: { env: { EXPO_PUBLIC_STUDOO_API_URL: 'https://studoo.example.test/' } },
    AbortController, setTimeout, clearTimeout, URL, JSON, Promise,
    require: (nome) => {
      const modulos = {
        '@studoo/contratos': { criarClienteStudoo, ErroStudoo },
        'expo/fetch': { fetch },
        'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
        './geracao-ao-vivo': { codigoDaResposta: () => 'falha', lerEventos: async function* () {} },
        // O toca-sons: só conta os efeitos (o erro de rede, numa ação sem rede).
        './sons': { tocaSons: { tocarEfeito: async (id) => { sons.push(id); } } },
      };
      assert.ok(nome in modulos, `módulo sem dublê: ${nome}`);
      return modulos[nome];
    },
  });
  return { ...exports, pedidos, sons };
}

test('com sessão, a configuração vai sem o token e os outros pedidos vão com ele', async () => {
  const api = montar();
  const cliente = api.criarClienteNativo('a'.repeat(43));
  await cliente.configuracaoAcesso();
  await cliente.listarPlanos();
  const [config, planos] = api.pedidos;
  assert.equal(config.url, 'https://studoo.example.test/api/auth/config');
  assert.equal(config.headers.Authorization, undefined, 'a rota pública recusa Authorization (401)');
  assert.equal(planos.url, 'https://studoo.example.test/api/aprendizado/planos');
  assert.equal(planos.headers.Authorization, `Bearer ${'a'.repeat(43)}`);
});

test('sem sessão, nada muda: a configuração vai sem token, como na entrada', async () => {
  const api = montar();
  await api.criarClienteNativo().configuracaoAcesso();
  assert.equal(api.pedidos[0].headers.Authorization, undefined);
});

test('a foto do perfil vai pelo canal do app, com o token e sem cookie', async () => {
  const api = montar();
  await api.criarClienteNativo('b'.repeat(43)).enviarFoto('QUJD');
  const [foto] = api.pedidos;
  assert.equal(foto.metodo, 'PUT');
  assert.equal(foto.url, 'https://studoo.example.test/api/perfil/foto');
  assert.equal(foto.headers.Authorization, `Bearer ${'b'.repeat(43)}`);
  assert.equal(foto.headers.Cookie, undefined);
});

test('sem rede: numa ação da pessoa (pedido que não é GET) toca o erro de rede; nas leituras, nada (spec 12, como a web)', async () => {
  const api = montar({ semRede: true });
  const cliente = api.criarClienteNativo('a'.repeat(43));
  await assert.rejects(() => cliente.listarPlanos());
  assert.deepEqual(api.sons, [], 'a leitura falha calada');
  await assert.rejects(() => cliente.enviarFoto('AAAA'));
  assert.deepEqual(api.sons, ['erro_rede']);
});
