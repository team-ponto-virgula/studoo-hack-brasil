// Lê a prontidão do beta; só --enviar cria a Beta App Review. Não distribui builds nem convida testadores.
import { createPrivateKey, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { conferirBetaExterno } from './conferir-beta-externo.mjs';

const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEXTO = (v) => typeof v === 'string' && v.trim().length > 0;
const ESTADOS = new Set(['WAITING_FOR_REVIEW', 'IN_REVIEW', 'REJECTED', 'APPROVED']);
const LIMITES = 'Esta conferência não testa a conta demo, login Apple/Google ou o IPA no aparelho. Envio não é aprovação nem distribuição externa.';

/** Cliente restrito à origem oficial; não repassa mensagens remotas ao console. */
export async function clienteApple({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  if (!env.EXPO_ASC_API_KEY_PATH || !/^[A-Z\d]{10}$/.test(env.EXPO_ASC_KEY_ID ?? '') || !UUID.test(env.EXPO_ASC_ISSUER_ID ?? '')) throw new Error('credenciais');
  const key = createPrivateKey(await readFile(env.EXPO_ASC_API_KEY_PATH));
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('credenciais');
  const base64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return async (path, { method = 'GET', body } = {}) => {
    // Nunca seguir um link remoto com o bearer; os caminhos são construídos localmente.
    if (!path.startsWith('/v1/') || path.includes('://')) throw new Error('caminho');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${base64({ alg: 'ES256', kid: env.EXPO_ASC_KEY_ID, typ: 'JWT' })}.${base64({ iss: env.EXPO_ASC_ISSUER_ID, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' })}`;
    const signature = sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    const response = await fetchImpl(`https://api.appstoreconnect.apple.com${path}`, {
      method, redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${unsigned}.${signature}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
}

const recurso = (r, type) => r?.status === 200 && r.body?.data?.type === type ? r.body.data : null;
const colecao = (r, type) => r?.status === 200 && Array.isArray(r.body?.data) && !r.body.links?.next && r.body.data.length > 0 && r.body.data.every((d) => d.type === type) ? r.body.data : null;
const resumoRevisao = (r) => {
  const data = recurso(r, 'betaAppReviewSubmissions');
  return data && UUID.test(data.id) && ESTADOS.has(data.attributes?.betaReviewState)
    ? { id: data.id, estado: data.attributes.betaReviewState } : null;
};

/** apple é injetável para testar os bloqueios sem rede, contas ou chaves. */
export async function revisarBetaApple({ appId, buildId, bundleId, apple, conferirPublico, enviar = false }) {
  if (!/^\d+$/.test(appId ?? '') || !UUID.test(buildId ?? '')) throw new Error('argumentos');
  const verificacoes = [];
  const check = (codigo, ok) => verificacoes.push({ codigo, ok: ok === true });
  const pedir = async (path, options) => {
    try { return await apple(path, options); } catch { return null; }
  };
  const buildPath = `/v1/builds/${buildId}`;
  const caminhos = {
    build: `${buildPath}?fields[builds]=version,processingState,expired`,
    app: `${buildPath}/app?fields[apps]=bundleId`,
    beta: `${buildPath}/buildBetaDetail`,
    revisao: `${buildPath}/betaAppReviewSubmission`,
    contato: `/v1/apps/${appId}/betaAppReviewDetail`,
    locales: `/v1/apps/${appId}/betaAppLocalizations?limit=200`,
    novidades: `${buildPath}/betaBuildLocalizations?limit=200`,
  };
  const respostas = Object.fromEntries(await Promise.all(Object.entries(caminhos).map(async ([nome, path]) => [nome, await pedir(path)])));
  for (const [nome, r] of Object.entries(respostas)) check(`api_${nome}`, r?.status === 200);
  const build = recurso(respostas.build, 'builds');
  const app = recurso(respostas.app, 'apps');
  const beta = recurso(respostas.beta, 'buildBetaDetails');
  const contato = recurso(respostas.contato, 'betaAppReviewDetails')?.attributes;
  const locales = colecao(respostas.locales, 'betaAppLocalizations');
  const novidades = colecao(respostas.novidades, 'betaBuildLocalizations');
  check('build_do_app', app?.id === appId && build?.id === buildId);
  check('bundle_do_app', typeof bundleId === 'string' && /^[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(bundleId) && app?.attributes?.bundleId === bundleId);
  check('build_valido', build?.attributes?.processingState === 'VALID' && build.attributes.expired === false);
  check('pronto_para_revisao', beta?.attributes?.externalBuildState === 'READY_FOR_BETA_SUBMISSION');
  check('sem_revisao_existente', respostas.revisao?.status === 200 && respostas.revisao.body?.data === null);
  check('contato_nome', TEXTO(contato?.contactFirstName) && TEXTO(contato?.contactLastName));
  check('contato_email', EMAIL.test(contato?.contactEmail ?? ''));
  check('contato_telefone', /^\+[1-9]\d{6,14}$/.test(contato?.contactPhone ?? ''));
  // O visitante do Studoo não cobre todos os recursos sociais; false não é um atalho de revisão.
  check('demo_obrigatoria', contato?.demoAccountRequired === true);
  check('demo_preenchida', EMAIL.test(contato?.demoAccountName ?? '') && typeof contato?.demoAccountPassword === 'string' && contato.demoAccountPassword.length >= 8 && contato.demoAccountPassword.length <= 256);
  check('descricoes_feedback', Boolean(locales?.every(({ attributes: a }) => TEXTO(a?.locale) && TEXTO(a?.description) && EMAIL.test(a?.feedbackEmail ?? '') && /^https:\/\//.test(a?.privacyPolicyUrl ?? ''))));
  check('o_que_testar', Boolean(locales && novidades && locales.every(({ attributes: a }) => novidades.some(({ attributes: b }) => b?.locale === a.locale && TEXTO(b.whatsNew)))));
  let publico;
  try { publico = await conferirPublico(); } catch { publico = null; }
  check('preflight_publico', publico?.apto === true);
  const resultado = {
    appId, buildId, apto: verificacoes.every((v) => v.ok), enviado: false,
    revisao: resumoRevisao(respostas.revisao), verificacoes,
    bloqueiosPublicos: Array.isArray(publico?.verificacoes) ? publico.verificacoes.filter((v) => v.nivel === 'erro').map((v) => v.codigo).filter((v) => /^[a-z_]+$/.test(v)) : [],
    limites: LIMITES,
  };
  if (!enviar || !resultado.apto) return resultado;
  // Confere outra vez para não duplicar um envio ocorrido durante as leituras acima.
  const antes = await pedir(caminhos.revisao);
  if (antes?.status !== 200 || antes.body?.data !== null) {
    check('sem_revisao_antes_do_envio', false);
    return { ...resultado, apto: false, revisao: resumoRevisao(antes) };
  }
  const envio = await pedir('/v1/betaAppReviewSubmissions', {
    method: 'POST', body: { data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: buildId } } } } },
  });
  // Inclusive em timeout/409, ler uma vez e nunca repetir o POST às cegas.
  const depois = await pedir(caminhos.revisao);
  const revisao = resumoRevisao(depois);
  check('revisao_confirmada', Boolean(revisao));
  return { ...resultado, apto: Boolean(revisao), enviado: envio?.status === 201 || Boolean(revisao), revisao, envioAceito: envio?.status === 201, confirmacaoPendente: !revisao };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Uso: npm run beta:revisao -- --app-id <Apple ID> --build-id <UUID Apple do build> [--enviar]');
    console.log('Sem --enviar: somente leitura. Credenciais: EXPO_ASC_API_KEY_PATH, EXPO_ASC_KEY_ID, EXPO_ASC_ISSUER_ID.');
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--enviar' && options.enviar === undefined) options.enviar = true;
    else if (['--app-id', '--build-id'].includes(flag) && args[i + 1] && options[flag] === undefined) options[flag] = args[++i];
    else throw new Error('argumentos');
  }
  if (!/^\d+$/.test(options['--app-id'] ?? '') || !UUID.test(options['--build-id'] ?? '')) throw new Error('argumentos');
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const [appConfig, easConfig, apple] = await Promise.all([
    readFile(resolve(raiz, 'apps/mobile/app.json'), 'utf8').then(JSON.parse),
    readFile(resolve(raiz, 'apps/mobile/eas.json'), 'utf8').then(JSON.parse),
    clienteApple(),
  ]);
  const resultado = await revisarBetaApple({
    appId: options['--app-id'], buildId: options['--build-id'], bundleId: appConfig?.expo?.ios?.bundleIdentifier, enviar: options.enviar, apple,
    conferirPublico: () => conferirBetaExterno({ appConfig, easConfig }),
  });
  console.log(JSON.stringify(resultado, null, 2));
  process.exitCode = resultado.apto ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((erro) => {
    console.error(erro?.message === 'argumentos' ? 'Argumentos inválidos. Use --help.' : 'Não foi possível conferir a revisão. Confira acesso Apple, arquivos e rede; nenhum detalhe privado foi impresso.');
    process.exitCode = 1;
  });
}
