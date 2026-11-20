import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Acesso no app para o TestFlight externo (App Review 4.8): "Continuar com a Apple" no iPhone (nonce do servidor, SHA-256
// hex para a Apple, o bruto de volta) e "Criar conta" por e-mail com código, com o contrato `@studoo/contratos/autenticacao`.
// Sem React Native e sem rede: o módulo roda transpilado, com dublês.

const raiz = new URL('../', import.meta.url);
const ler = (caminho) => readFile(new URL(caminho, raiz), 'utf8');
const fonteApple = await ler('apps/mobile/src/apple-nativo.ts');
const { outputText } = ts.transpileModule(fonteApple, { compilerOptions: { module: ts.ModuleKind.CommonJS } });

function ambiente({ plataforma = 'ios', disponivel = true, cancelado = false, semToken = false, falharArmazenamento = false, recusar } = {}) {
  const nonce = randomBytes(24).toString('base64url');
  const token = randomBytes(32).toString('base64url');
  const chamadas = { nonce: 0, entrada: null, pedidoApple: null, salvo: null, logout: 0 };
  class ErroStudoo extends Error { constructor(codigo) { super(codigo); this.codigo = codigo; } }
  const modulos = {
    'expo-apple-authentication': {
      AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
      isAvailableAsync: async () => disponivel,
      signInAsync: async (opcoes) => {
        chamadas.pedidoApple = opcoes;
        if (cancelado) throw Object.assign(new Error('cancelado'), { code: 'ERR_REQUEST_CANCELED' });
        return { identityToken: semToken ? null : 'jwt.da.apple', authorizationCode: 'codigo-apple', fullName: { givenName: 'Ana', familyName: 'Lima' } };
      },
    },
    'expo-crypto': { CryptoDigestAlgorithm: { SHA256: 'sha256' }, CryptoEncoding: { HEX: 'hex' },
      digestStringAsync: async (alg, texto, { encoding }) => createHash(alg).update(texto).digest(encoding).toUpperCase() },
    'react-native': { Platform: { OS: plataforma } },
    '@studoo/contratos': { ErroStudoo },
    './api-nativa': {
      guardarToken: async (valor) => { if (falharArmazenamento) throw new Error('SecureStore indisponível'); chamadas.salvo = valor; },
      criarClienteNativo: () => ({
        nonceApple: async () => { chamadas.nonce++; return { nonce, expiraEm: new Date(Date.now() + 600_000).toISOString() }; },
        entrarApple: async (pedido) => { chamadas.entrada = pedido; if (recusar) throw new ErroStudoo(recusar); return { token }; },
        logout: async () => { chamadas.logout++; },
      }),
    },
  };
  const exports = {};
  runInNewContext(outputText, { exports, require: (nome) => { assert.ok(nome in modulos, `módulo sem dublê: ${nome}`); return modulos[nome]; }, Promise, Error });
  return { api: exports, chamadas, nonce, token };
}

test('Apple: o hash do nonce vai para a Apple, o bruto e o token voltam ao servidor, e a sessão fica no SecureStore', async () => {
  const a = ambiente();
  assert.equal(await a.api.entrarComApple(), a.token);
  assert.equal(a.chamadas.nonce, 1);
  assert.equal(a.chamadas.pedidoApple.nonce, createHash('sha256').update(a.nonce).digest('hex'), 'SHA-256 em hex minúsculo do nonce bruto');
  assert.equal(JSON.stringify(a.chamadas.pedidoApple.requestedScopes), '[0,1]', 'FULL_NAME e EMAIL');
  assert.deepEqual(JSON.parse(JSON.stringify(a.chamadas.entrada)), { identityToken: 'jwt.da.apple', authorizationCode: 'codigo-apple', nonce: a.nonce, nome: { givenName: 'Ana', familyName: 'Lima' } });
  assert.equal(a.chamadas.salvo, a.token);
});

test('Apple: cancelar a folha não cria sessão nem mostra erro', async () => {
  const a = ambiente({ cancelado: true });
  assert.equal(await a.api.entrarComApple(), null);
  assert.equal(a.chamadas.entrada, null);
  assert.equal(a.chamadas.salvo, null);
});

test('Apple: sem token da Apple é apple_invalido; a recusa do servidor chega como veio', async () => {
  await assert.rejects(ambiente({ semToken: true }).api.entrarComApple(), { codigo: 'apple_invalido' });
  const conflito = ambiente({ recusar: 'apple_conta_existente' });
  await assert.rejects(conflito.api.entrarComApple(), { codigo: 'apple_conta_existente' });
  assert.equal(conflito.chamadas.salvo, null, 'nunca vincula nem entra numa conta só pelo e-mail');
});

test('Apple: sem conseguir guardar a sessão, encerra no servidor', async () => {
  const a = ambiente({ falharArmazenamento: true });
  await assert.rejects(a.api.entrarComApple());
  assert.equal(a.chamadas.logout, 1);
});

test('Apple: só no iPhone e só com o aparelho oferecendo', async () => {
  assert.equal(await ambiente().api.appleDisponivelNoAparelho(), true);
  assert.equal(await ambiente({ plataforma: 'android' }).api.appleDisponivelNoAparelho(), false);
  assert.equal(await ambiente({ disponivel: false }).api.appleDisponivelNoAparelho(), false);
});

test('entrada: Apple só com config.apple no iPhone, Criar conta só com config.cadastro, e a política pública', async () => {
  const sessao = await ler('apps/mobile/src/sessao.tsx');
  assert.match(sessao, /setAppleDisponivel\(c\.apple === true && appleNoAparelho\)/);
  assert.match(sessao, /setCadastroDisponivel\(c\.cadastro === true\)/);
  assert.match(sessao, /configuracaoCarregada && appleDisponivel && \(/);
  assert.match(sessao, /AppleAuthenticationButton/, 'botão oficial da Apple (Human Interface Guidelines)');
  assert.match(sessao, /configuracaoCarregada && cadastroDisponivel && \(/);
  assert.match(sessao, /testID="entrada-privacidade"/);
  assert.match(sessao, /cadastrarNativo\(email, codigo, senha\)/);
  const app = JSON.parse(await ler('apps/mobile/app.json')).expo;
  assert.equal(app.ios.usesAppleSignIn, true);
  assert.ok(app.plugins.includes('expo-apple-authentication'));
});

test('criar conta: código para o e-mail normalizado, regras do contrato e os textos da web', async () => {
  const tela = await ler('apps/mobile/src/cadastro.tsx');
  assert.match(tela, /pedirCodigoCadastro\(normalizado, true\)/, 'rota do app: /api/mobile/cadastro/codigo');
  for (const regra of ['normalizarEmailEntrada', 'codigoAceito', 'senhaAceita']) assert.match(tela, new RegExp(`${regra}\\(`));
  assert.match(tela, /const m = mensagens\.cadastro;/);
  assert.doesNotMatch(tela, /Alert\./, 'sem janela nativa');
  const { mensagens } = await import('../packages/contratos/src/experiencia.ts');
  for (const chave of ['titulo', 'enviado', 'criar', 'politica']) assert.ok(mensagens.cadastro[chave], `mensagens.cadastro.${chave}`);
  for (const codigo of ['cadastro_indisponivel', 'limite_cadastro', 'email_nao_permitido', 'apple_indisponivel', 'apple_invalido', 'apple_conta_existente']) {
    assert.ok(mensagens.erros[codigo], `mensagens.erros.${codigo}`);
  }
});
