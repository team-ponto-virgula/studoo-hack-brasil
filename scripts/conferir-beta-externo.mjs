// Preflight público do beta externo. Não faz login, cria contas, gera builds nem envia à Apple.
// O resultado não comprova assinatura, credenciais ou o funcionamento real do login Apple.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FLAGS_PUBLICAS = ['google', 'apple', 'cadastro', 'recuperacao', 'visitante', 'compartilhar', 'comunidade'];
const IAS_REAIS = new Set(['openai', 'deepseek']);
const LIMITES_DA_CONFERENCIA = 'Este preflight confere configuração e respostas públicas; não comprova login real, credenciais Apple, assinatura do IPA ou aprovação da revisão beta.';

function perfilTestflight(easConfig) {
  const vistos = new Set();
  function ler(nome) {
    if (vistos.has(nome)) return null;
    vistos.add(nome);
    const perfil = easConfig?.build?.[nome];
    if (!perfil || typeof perfil !== 'object') return null;
    if (!perfil.extends) return perfil;
    const base = ler(perfil.extends);
    return base ? { ...base, ...perfil, env: { ...base.env, ...perfil.env }, ios: { ...base.ios, ...perfil.ios } } : null;
  }
  return ler('testflight');
}

function origemPublica(valor) {
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Só lê endpoints públicos. fetchImpl permite testar sem rede nem contas. */
export async function conferirBetaExterno({ appConfig, easConfig, fetchImpl = globalThis.fetch, timeoutMs = 15_000 }) {
  const verificacoes = [];
  const registrar = (codigo, nivel, mensagem, extra = {}) => verificacoes.push({ codigo, nivel, mensagem, ...extra });
  const conferir = (codigo, ok, mensagem) => registrar(codigo, ok ? 'ok' : 'erro', mensagem);
  const expo = appConfig?.expo;
  const perfil = perfilTestflight(easConfig);
  const origem = origemPublica(perfil?.env?.EXPO_PUBLIC_STUDOO_API_URL);

  conferir('expo_owner', typeof expo?.owner === 'string' && /^[a-z\d_-]+$/i.test(expo.owner), 'Conta Expo definida no app.json.');
  conferir('eas_project_id', typeof expo?.extra?.eas?.projectId === 'string' && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(expo.extra.eas.projectId), 'Projeto EAS vinculado no app.json.');
  conferir('ios_bundle', typeof expo?.ios?.bundleIdentifier === 'string' && /^[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(expo.ios.bundleIdentifier), 'Bundle ID iOS definido.');
  conferir('distribuicao_store', perfil?.distribution === 'store' && perfil?.ios?.simulator !== true && perfil?.developmentClient !== true, 'Perfil testflight de loja, para aparelho e sem cliente de desenvolvimento.');
  const pluginApple = Array.isArray(expo?.plugins) && expo.plugins.some((p) => (Array.isArray(p) ? p[0] : p) === 'expo-apple-authentication');
  conferir('apple_nativo', expo?.ios?.usesAppleSignIn === true && pluginApple, 'Sign in with Apple habilitado e plugin presente no app.');
  conferir('origem_https', Boolean(origem), 'API do perfil testflight usa uma origem HTTPS sem credenciais, caminho ou parâmetros.');

  let flags = {};
  if (origem) {
    const endpoints = [
      { codigo: 'saude', caminho: '/api/saude', status: 200, tipo: 'json' },
      { codigo: 'auth_config', caminho: '/api/auth/config', status: 200, tipo: 'json' },
      { codigo: 'privacidade', caminho: '/privacidade', status: 200, tipo: 'html' },
      { codigo: 'suporte', caminho: '/suporte', status: 200, tipo: 'html' },
      { codigo: 'apple_nonce', caminho: '/api/mobile/apple/nonce', status: 405 },
    ];
    const resultados = await Promise.all(endpoints.map(async (endpoint) => {
      try {
        const resposta = await fetchImpl(new URL(endpoint.caminho, origem), {
          method: 'GET', redirect: 'error',
          headers: { Accept: endpoint.tipo === 'html' ? 'text/html' : 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        const status = Number.isInteger(resposta.status) && resposta.status >= 100 && resposta.status <= 599 ? resposta.status : null;
        if (status !== endpoint.status) return { endpoint, status, erro: 'Status HTTP inesperado.' };
        const tipo = resposta.headers.get('content-type') ?? '';
        if (endpoint.tipo === 'json') {
          if (!/^application\/(?:[\w.-]+\+)?json(?:;|$)/i.test(tipo)) return { endpoint, status, erro: 'A resposta precisa ser JSON.' };
          const dados = await resposta.json();
          if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return { endpoint, status, erro: 'Objeto JSON ausente.' };
          return { endpoint, status, dados };
        }
        if (endpoint.tipo === 'html') {
          if (!/^text\/html(?:;|$)/i.test(tipo) || !/<(?:!doctype\s+html|html\b)/i.test(await resposta.text())) return { endpoint, status, erro: 'A página precisa responder HTML.' };
        }
        return { endpoint, status };
      } catch (erro) {
        // Não imprimir mensagens de exceção ou corpos: podem conter URLs, dados ou chaves.
        return { endpoint, erro: ['TimeoutError', 'AbortError'].includes(erro?.name) ? 'Tempo limite esgotado.' : 'Pedido indisponível, redirecionado ou resposta inválida.' };
      }
    }));
    for (const { endpoint, status, dados, erro } of resultados) {
      registrar(endpoint.codigo, erro ? 'erro' : 'ok', `${endpoint.caminho}: ${erro ?? 'resposta esperada.'}`, status === undefined ? {} : { status });
      if (erro) continue;
      if (endpoint.codigo === 'saude') conferir('saude_ok', dados.ok === true && dados.status === 'ok', 'API anuncia saúde ok.');
      if (endpoint.codigo === 'auth_config') {
        // Nunca copiar o objeto remoto: só estas flags booleanas e provedores conhecidos.
        flags = Object.fromEntries(FLAGS_PUBLICAS.filter((chave) => typeof dados[chave] === 'boolean').map((chave) => [chave, dados[chave]]));
        if (['falsa', ...IAS_REAIS].includes(dados.ia)) flags.ia = dados.ia;
        conferir('apple_ativo', dados.apple === true, dados.google === true
          ? 'Com Google habilitado, o beta externo exige Apple também habilitada no servidor.'
          : 'Apple precisa estar habilitada no servidor para esta candidata de beta externo.');
        conferir('ia_real', IAS_REAIS.has(dados.ia), 'Servidor usa um provedor real de IA reconhecido, sem IA falsa.');
        for (const [chave, nome] of [['cadastro', 'Cadastro por email'], ['recuperacao', 'Recuperação de senha']]) {
          registrar(`${chave}_email`, dados[chave] === true ? 'ok' : 'aviso', dados[chave] === true
            ? `${nome} anunciado pelo servidor.`
            : `${nome} não anunciado: a interface o esconde; não bloqueia este preflight.`);
        }
      }
    }
  }

  return {
    perfil: 'testflight', beta: 'externo',
    apto: !verificacoes.some((v) => v.nivel === 'erro'),
    flags, verificacoes, limites: LIMITES_DA_CONFERENCIA,
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Uso: node --use-env-proxy scripts/conferir-beta-externo.mjs [--json [arquivo]]');
    return;
  }
  const json = args[0] === '--json';
  if ((args.length && !json) || args.length > 2 || args[1]?.startsWith('--')) throw new Error('argumentos');
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  let appConfig, easConfig;
  try {
    [appConfig, easConfig] = await Promise.all(['app.json', 'eas.json'].map(async (nome) => JSON.parse(await readFile(resolve(raiz, 'apps/mobile', nome), 'utf8'))));
  } catch {
    throw new Error('configuracao');
  }
  const resultado = await conferirBetaExterno({ appConfig, easConfig });
  const relatorio = `${JSON.stringify(resultado, null, 2)}\n`;
  if (json && !args[1]) console.log(relatorio.trimEnd());
  else {
    for (const v of resultado.verificacoes) console.log(`${v.nivel.toUpperCase()} ${v.codigo}: ${v.mensagem}${v.status === undefined ? '' : ` (HTTP ${v.status})`}`);
    console.log(resultado.limites);
    console.log(resultado.apto ? 'Preflight público aprovado.' : 'Beta externo bloqueado neste preflight.');
    if (args[1]) await writeFile(resolve(args[1]), relatorio, { mode: 0o600 });
  }
  process.exitCode = resultado.apto ? 0 : 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((erro) => {
    console.error(erro?.message === 'argumentos'
      ? 'Argumentos inválidos. Use --help.'
      : 'Não foi possível concluir o preflight ou salvar o relatório. Confira os arquivos locais e tente novamente.');
    process.exitCode = 1;
  });
}
