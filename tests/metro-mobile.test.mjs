import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// O servidor de desenvolvimento do app atrás do túnel: o Expo Go de iPhone manda X-Forwarded-Proto com dois valores
// ("http, https") e o Metro respondia 500 ("Failed to load all assets" no aparelho). apps/mobile/metro.config.js é a
// configuração padrão do Expo mais um middleware que deixa o cabeçalho com um valor só.

const pasta = fileURLToPath(new URL('../apps/mobile/', import.meta.url));
const exigir = createRequire(`${pasta}package.json`);
const { protocoloUnico } = exigir('./metro-cabecalhos.js');

test('um valor só fica como veio; vários viram um ("https" se houver)', () => {
  assert.equal(protocoloUnico('https'), 'https');
  assert.equal(protocoloUnico('http'), 'http');
  assert.equal(protocoloUnico(undefined), undefined);
  assert.equal(protocoloUnico('http, https'), 'https');
  assert.equal(protocoloUnico('https,http'), 'https');
  assert.equal(protocoloUnico('http, http'), 'http');
  assert.equal(protocoloUnico('http,'), 'http');
});

test('metro.config.js passa o pedido ao Metro com o protocolo de um valor só', () => {
  const config = exigir('./metro.config.js');
  assert.equal(typeof config.server.enhanceMiddleware, 'function');
  const vistos = [];
  const middleware = config.server.enhanceMiddleware((req) => { vistos.push(req.headers['x-forwarded-proto']); }, {});
  middleware({ headers: { 'x-forwarded-proto': 'http, https' } }, {}, () => {});
  middleware({ headers: { 'x-forwarded-proto': 'https' } }, {}, () => {});
  middleware({ headers: {} }, {}, () => {});
  assert.deepEqual(vistos, ['https', 'https', undefined]);
});

test('o resto é a configuração padrão do Expo', () => {
  const config = exigir('./metro.config.js');
  const { getDefaultConfig } = exigir('expo/metro-config');
  const padrao = getDefaultConfig(pasta.replace(/\/$/, ''));
  assert.equal(config.projectRoot, padrao.projectRoot);
  assert.deepEqual(config.resolver.sourceExts, padrao.resolver.sourceExts);
  assert.deepEqual(config.resolver.assetExts, padrao.resolver.assetExts);
  assert.equal(config.transformer.babelTransformerPath, padrao.transformer.babelTransformerPath);
  assert.deepEqual(Object.keys(config.serializer).sort(), Object.keys(padrao.serializer).sort());
  assert.deepEqual(config.watchFolders, padrao.watchFolders);
});
