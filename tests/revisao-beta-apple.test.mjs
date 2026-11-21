import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { clienteApple, revisarBetaApple } from '../scripts/revisar-beta-apple.mjs';

const appId = '6837508955';
const buildId = '4eea9ee9-145e-4076-8ad1-e130af015d6c';
const bundleId = 'com.studoo.mobile.dev';
const reviewId = 'aaea9ee9-145e-4076-8ad1-e130af015d6c';
const review = () => ({ type: 'betaAppReviewSubmissions', id: reviewId, attributes: { betaReviewState: 'WAITING_FOR_REVIEW' } });

function cenario({ contato = {}, foreign = false, wrongBundle = false, reviewBefore = null, publicOk = true, postError = false, postStatus = 201, confirm = true, race = false, processingState = 'VALID', externalBuildState = 'READY_FOR_BETA_SUBMISSION', locale = {} } = {}) {
  const chamadas = [];
  let enviado = false, consultasReview = 0;
  const apple = async (path, options = {}) => {
    chamadas.push({ path, ...options });
    const p = path.split('?')[0];
    const ok = (data, extra = {}) => ({ status: 200, body: { data, ...extra } });
    if (options.method === 'POST') {
      enviado = confirm;
      if (postError) throw new Error('token-e-senha-privados');
      return { status: postStatus, body: { data: review() } };
    }
    if (p === `/v1/builds/${buildId}`) return ok({ type: 'builds', id: buildId, attributes: { version: '3', processingState, expired: false } });
    if (p.endsWith('/app')) return ok({ type: 'apps', id: foreign ? 'outro' : appId, attributes: { bundleId: wrongBundle ? 'com.outro.app' : bundleId } });
    if (p.endsWith('/buildBetaDetail')) return ok({ type: 'buildBetaDetails', id: buildId, attributes: { externalBuildState } });
    if (p.endsWith('/betaAppReviewSubmission')) {
      consultasReview++;
      return ok(enviado || (race && consultasReview >= 2) ? review() : reviewBefore);
    }
    if (p.endsWith('/betaAppReviewDetail')) return ok({ type: 'betaAppReviewDetails', id: appId, attributes: {
      contactFirstName: 'Pessoa', contactLastName: 'Teste', contactPhone: '+5535999999999', contactEmail: 'contato@example.test',
      demoAccountRequired: true, demoAccountName: 'review@example.test', demoAccountPassword: 'senha-privada-nao-imprimir', ...contato,
    } });
    if (p.endsWith('/betaAppLocalizations')) return ok([{ type: 'betaAppLocalizations', id: 'locale', attributes: { locale: 'pt-BR', description: 'Estudo', feedbackEmail: 'feedback@example.test', privacyPolicyUrl: 'https://example.test/privacidade', ...locale } }]);
    if (p.endsWith('/betaBuildLocalizations')) return ok([{ type: 'betaBuildLocalizations', id: 'notes', attributes: { locale: 'pt-BR', whatsNew: 'Teste a lição.' } }]);
    throw new Error('endpoint não esperado');
  };
  return {
    apple, chamadas,
    conferirPublico: async () => ({ apto: publicOk, verificacoes: publicOk ? [] : [{ codigo: 'apple_ativo', nivel: 'erro' }] }),
  };
}
const executar = (c, enviar = true) => revisarBetaApple({ appId, buildId, bundleId, ...c, enviar });
const posts = (c) => c.chamadas.filter((r) => r.method === 'POST');
const bloqueios = (r) => r.verificacoes.filter((v) => !v.ok).map((v) => v.codigo);

test('modo padrão só lê; resultado não inclui dados de contato, senha nem corpos remotos', async () => {
  const c = cenario();
  const r = await revisarBetaApple({ appId, buildId, bundleId, ...c });
  assert.equal(r.apto, true);
  assert.equal(r.enviado, false);
  assert.equal(posts(c).length, 0);
  for (const secret of ['senha-privada', 'contato@example', '+5535', 'review@example']) assert.ok(!JSON.stringify(r).includes(secret));
});

test('cria exatamente uma revisão, com o UUID explícito, e confirma por GET do build', async () => {
  const c = cenario();
  const r = await executar(c);
  assert.equal(r.enviado, true);
  assert.equal(r.envioAceito, true);
  assert.deepEqual(r.revisao, { id: reviewId, estado: 'WAITING_FOR_REVIEW' });
  assert.equal(posts(c).length, 1);
  assert.deepEqual(posts(c)[0].body, { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: buildId } } } } });
  assert.ok(c.chamadas.at(-1).path.endsWith('/betaAppReviewSubmission'));
});

test('Apple pública desligada não permite POST', async () => {
  const c = cenario({ publicOk: false });
  const r = await executar(c);
  assert.equal(r.apto, false);
  assert.deepEqual(r.bloqueiosPublicos, ['apple_ativo']);
  assert.equal(posts(c).length, 0);
});

test('conta demo ausente ou false não passa como modo visitante completo', async () => {
  for (const contato of [{ demoAccountRequired: false }, { demoAccountRequired: null }, { demoAccountName: null }, { demoAccountPassword: '' }]) {
    const c = cenario({ contato });
    const r = await executar(c);
    assert.equal(r.apto, false);
    assert.equal(posts(c).length, 0);
    assert.ok(bloqueios(r).some((b) => b === 'demo_obrigatoria' || b === 'demo_preenchida'));
  }
});

test('build de outro app, inválido ou sem estado externo de submissão não é enviado', async () => {
  for (const options of [{ foreign: true }, { wrongBundle: true }, { processingState: 'PROCESSING' }, { externalBuildState: 'IN_BETA_REVIEW' }]) {
    const c = cenario(options);
    assert.equal((await executar(c)).apto, false);
    assert.equal(posts(c).length, 0);
  }
});

test('revisão existente e corrida entre conferência/envio impedem duplicação', async () => {
  for (const options of [{ reviewBefore: review() }, { race: true }]) {
    const c = cenario(options);
    const r = await executar(c);
    assert.equal(posts(c).length, 0);
    assert.deepEqual(r.revisao, { id: reviewId, estado: 'WAITING_FOR_REVIEW' });
  }
});

test('timeout no POST consulta a revisão e não repete o envio', async () => {
  for (const confirm of [true, false]) {
    const c = cenario({ postError: true, confirm });
    const r = await executar(c);
    assert.equal(posts(c).length, 1);
    assert.equal(r.enviado, confirm);
    assert.equal(r.confirmacaoPendente, !confirm);
    assert.ok(!JSON.stringify(r).includes('token-e-senha'));
  }
});

test('conflito HTTP não dispara repetição; HTTP201 sem read-back permanece pendente', async () => {
  for (const confirm of [true, false]) {
    const c = cenario({ postStatus: 409, confirm });
    const r = await executar(c);
    assert.equal(posts(c).length, 1);
    assert.equal(r.envioAceito, false);
    assert.equal(r.enviado, confirm);
  }
  const c = cenario({ confirm: false });
  const r = await executar(c);
  assert.equal(r.envioAceito, true);
  assert.equal(r.enviado, true);
  assert.equal(r.confirmacaoPendente, true);
  assert.equal(r.revisao, null);
  assert.equal(r.apto, false);
  assert.equal(posts(c).length, 1);
});

test('campos de contato e feedback precisam estar preenchidos', async () => {
  for (const options of [{ contato: { contactPhone: '' } }, { contato: { contactEmail: '' } }, { locale: { feedbackEmail: '' } }, { locale: { description: '' } }]) {
    const c = cenario(options);
    assert.equal((await executar(c)).apto, false);
    assert.equal(posts(c).length, 0);
  }
});

test('API negada, resposta malformada ou página incompleta falham sem expor o erro', async () => {
  for (const replacement of [{ status: 403, body: { errors: [{ detail: 'segredo-remoto' }] } }, { status: 200, body: { data: 'segredo-remoto' } }, { status: 200, body: { data: [{ type: 'betaAppLocalizations' }], links: { next: 'https://malicioso.test/segredo-remoto' } } }]) {
    const c = cenario();
    const base = c.apple;
    c.apple = (path, o) => path.includes('/betaAppLocalizations') ? replacement : base(path, o);
    const r = await executar(c);
    assert.equal(r.apto, false);
    assert.equal(posts(c).length, 0);
    assert.ok(!JSON.stringify(r).includes('segredo-remoto'));
  }
});

test('cliente assina ES256 P1363 para a origem oficial, com expiração curta e redirects proibidos', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'studoo-asc-test-'));
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  try {
    const keyPath = join(dir, 'key.p8');
    await writeFile(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    const calls = [];
    const apple = await clienteApple({ env: { EXPO_ASC_API_KEY_PATH: keyPath, EXPO_ASC_KEY_ID: 'ABCDEFGHIJ', EXPO_ASC_ISSUER_ID: reviewId }, fetchImpl: async (url, o) => {
      calls.push({ url, o });
      return Response.json({ data: null });
    } });
    await apple('/v1/builds/known');
    const { url, o } = calls[0];
    assert.equal(url, 'https://api.appstoreconnect.apple.com/v1/builds/known');
    assert.equal(o.redirect, 'error');
    assert.equal(o.method, 'GET');
    assert.equal(o.body, undefined);
    const [header, payload, signature] = o.headers.Authorization.slice(7).split('.');
    assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'ES256');
    const claims = JSON.parse(Buffer.from(payload, 'base64url'));
    assert.equal(claims.exp - claims.iat, 600);
    assert.equal(claims.aud, 'appstoreconnect-v1');
    assert.equal(verify('sha256', Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
    await assert.rejects(apple('https://malicioso.test/v1/builds'));
    assert.equal(calls.length, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
