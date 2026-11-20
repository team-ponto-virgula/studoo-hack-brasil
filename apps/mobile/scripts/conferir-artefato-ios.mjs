// Confere o que a revisão da Apple lê no pacote do iPhone: o login com a Apple (entitlement), o manifesto de privacidade, os
// textos de permissão, o ATS, a criptografia declarada e o esquema do Google. Sem Mac e sem conta: lê os arquivos.
//
// Dois modos:
//   --prebuild [perfil]   gera o projeto nativo com `expo prebuild --platform ios --no-install`, com o env do perfil do eas.json
//                         (padrão: testflight), lê Info.plist, *.entitlements, PrivacyInfo.xcprivacy e o bundle do projeto e
//                         apaga a pasta ios/ no fim (só se ela não existia antes). É o que o EAS Build gera antes de compilar,
//                         não o binário assinado.
//   --app <caminho>       lê um .app (pasta) ou um .ipa já baixado do EAS. O .ipa é aberto com `unzip` na pasta de --temp
//                         (obrigatória; apagada no fim). Os entitlements vêm do embedded.mobileprovision (o que o perfil de
//                         distribuição permite); os assinados no binário só com `codesign -d --entitlements`, num Mac.
//
// Saída: uma linha por conferência (ok, aviso ou erro) e, com --json <arquivo>, o resultado inteiro. Termina com 1 se houver erro.
// Uso, na raiz do repositório: node apps/mobile/scripts/conferir-artefato-ios.mjs --prebuild testflight --json <arquivo>
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const plistXml = require('@expo/plist').default ?? require('@expo/plist');
const bplist = require('bplist-parser');

const aqui = dirname(fileURLToPath(import.meta.url));
const app = resolve(aqui, '..');
const args = process.argv.slice(2);
const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };

/** Um plist em XML ou binário (o .ipa traz o Info.plist binário). */
function lerPlist(caminho) {
  const bruto = readFileSync(caminho);
  if (bruto.subarray(0, 8).toString('latin1') === 'bplist00') return bplist.parseBuffer(bruto)[0];
  return plistXml.parse(bruto.toString('utf8'));
}

/** O plist de dentro do embedded.mobileprovision (CMS assinado com o XML no meio). */
function lerProvisao(caminho) {
  const texto = readFileSync(caminho).toString('latin1');
  const inicio = texto.indexOf('<?xml');
  const fim = texto.indexOf('</plist>');
  if (inicio < 0 || fim < 0) return null;
  return plistXml.parse(texto.slice(inicio, fim + '</plist>'.length));
}

function envDoPerfil(perfil) {
  const eas = JSON.parse(readFileSync(join(app, 'eas.json'), 'utf8'));
  const build = eas.build?.[perfil];
  if (!build) throw new Error(`perfil "${perfil}" não existe em eas.json`);
  return { ...(build.env ?? {}), EAS_BUILD_PROFILE: perfil, NODE_ENV: 'production', CI: '1' };
}

function porPrebuild(perfil) {
  const pasta = join(app, 'ios');
  const existia = existsSync(pasta);
  if (existia) throw new Error('apps/mobile/ios já existe: rode num checkout sem a pasta nativa (ela seria sobrescrita)');
  const env = envDoPerfil(perfil);
  try {
    execFileSync('npx', ['expo', 'prebuild', '--platform', 'ios', '--no-install'], { cwd: app, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const alvo = readdirSync(pasta).find((nome) => existsSync(join(pasta, nome, 'Info.plist')));
    if (!alvo) throw new Error('o prebuild não gerou Info.plist');
    const dir = join(pasta, alvo);
    const info = lerPlist(join(dir, 'Info.plist'));
    const arquivoEnt = readdirSync(dir).find((nome) => nome.endsWith('.entitlements'));
    const entitlements = arquivoEnt ? lerPlist(join(dir, arquivoEnt)) : null;
    const privacidade = existsSync(join(dir, 'PrivacyInfo.xcprivacy')) ? lerPlist(join(dir, 'PrivacyInfo.xcprivacy')) : null;
    const projeto = readFileSync(join(pasta, `${alvo}.xcodeproj`, 'project.pbxproj'), 'utf8');
    const bundles = [...new Set([...projeto.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([^";]+)"?;/g)].map((m) => m[1]))];
    // O expo-dev-launcher acrescenta ao alvo uma fase que tira do Info.plist do Release (build sem DEBUG) o `_expo._tcp` e o
    // texto de rede local dele; o prebuild ainda mostra as chaves, o binário de loja não.
    const faseTiraRedeLocal = projeto.includes('[Expo Dev Launcher] Strip Local Network Keys for Release');
    return { origem: `prebuild do perfil ${perfil} (o projeto que o EAS compila; não é o binário assinado)`, env, info, entitlements, privacidade, bundles,
      fonteEntitlements: arquivoEnt ? `ios/${alvo}/${arquivoEnt}` : null, faseTiraRedeLocal };
  } finally {
    if (!existia) rmSync(pasta, { recursive: true, force: true });
  }
}

function porApp(caminho) {
  let dirApp = caminho;
  let temp = null;
  if (caminho.endsWith('.ipa')) {
    temp = valor('--temp');
    if (!temp) throw new Error('--temp <pasta> é obrigatório para abrir um .ipa');
    temp = join(resolve(temp), `ipa-${Date.now()}`);
    mkdirSync(temp, { recursive: true });
    execFileSync('unzip', ['-q', caminho, '-d', temp]);
    const payload = join(temp, 'Payload');
    const nome = readdirSync(payload).find((n) => n.endsWith('.app'));
    if (!nome) throw new Error('o .ipa não tem Payload/*.app');
    dirApp = join(payload, nome);
  }
  try {
    if (!statSync(dirApp).isDirectory()) throw new Error(`${dirApp} não é uma pasta .app`);
    const info = lerPlist(join(dirApp, 'Info.plist'));
    const provisao = existsSync(join(dirApp, 'embedded.mobileprovision')) ? lerProvisao(join(dirApp, 'embedded.mobileprovision')) : null;
    const privacidade = existsSync(join(dirApp, 'PrivacyInfo.xcprivacy')) ? lerPlist(join(dirApp, 'PrivacyInfo.xcprivacy')) : null;
    return { origem: `pacote ${basename(caminho)} (entitlements do perfil de provisão; os do binário só com codesign num Mac)`, env: null, info,
      entitlements: provisao?.Entitlements ?? null, privacidade, bundles: [info.CFBundleIdentifier], fonteEntitlements: provisao ? 'embedded.mobileprovision' : null };
  } finally {
    if (temp) rmSync(temp, { recursive: true, force: true });
  }
}

const PADRAO_EXPO = /Allow \$\(PRODUCT_NAME\)/;
const RAZOES_ESPERADAS = {
  NSPrivacyAccessedAPICategoryUserDefaults: ['CA92.1'],
  NSPrivacyAccessedAPICategoryFileTimestamp: ['C617.1'],
  NSPrivacyAccessedAPICategorySystemBootTime: ['35F9.1'],
  NSPrivacyAccessedAPICategoryDiskSpace: ['E174.1'],
};

function conferir(dados) {
  const r = [];
  const add = (nivel, item, detalhe) => r.push({ nivel, item, detalhe });
  const { info, entitlements, privacidade, bundles, env, faseTiraRedeLocal } = dados;
  const tiradaNoRelease = ' (removida no Release pela fase "[Expo Dev Launcher] Strip Local Network Keys for Release"; fica só no build de desenvolvimento)';

  const bundle = bundles.find((b) => !b.includes('$(')) ?? bundles[0];
  add(bundle ? 'ok' : 'erro', 'Bundle', bundle ?? 'sem PRODUCT_BUNDLE_IDENTIFIER');
  if (bundle?.endsWith('.dev') && env?.EAS_BUILD_PROFILE && env.EAS_BUILD_PROFILE !== 'development') {
    add('aviso', 'Bundle de loja', `${bundle} termina em .dev no perfil ${env.EAS_BUILD_PROFILE}; o App ID no App Store Connect precisa ser este`);
  }
  add('ok', 'Versão', `${info.CFBundleShortVersionString} (${info.CFBundleVersion}; com appVersionSource remoto, o EAS troca o número do build)`);

  const apple = entitlements?.['com.apple.developer.applesignin'];
  add(Array.isArray(apple) && apple.includes('Default') ? 'ok' : 'erro', 'Entitlement Sign in with Apple (regra 4.8)',
    apple ? JSON.stringify(apple) : `ausente${dados.fonteEntitlements ? ` em ${dados.fonteEntitlements}` : ' (sem arquivo de entitlements)'}`);

  add(info.ITSAppUsesNonExemptEncryption === false ? 'ok' : 'aviso', 'Criptografia declarada (ITSAppUsesNonExemptEncryption)', String(info.ITSAppUsesNonExemptEncryption));

  const ats = info.NSAppTransportSecurity ?? {};
  add(ats.NSAllowsArbitraryLoads === true ? 'erro' : 'ok', 'ATS sem cargas arbitrárias', JSON.stringify(ats));

  for (const chave of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSMicrophoneUsageDescription']) {
    const texto = info[chave];
    add(!texto ? 'erro' : PADRAO_EXPO.test(texto) ? 'erro' : 'ok', `Permissão ${chave}`, texto ?? 'ausente');
  }
  for (const [chave, texto] of Object.entries(info)) {
    if (!chave.endsWith('UsageDescription') || ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSMicrophoneUsageDescription'].includes(chave)) continue;
    if (PADRAO_EXPO.test(String(texto))) add('aviso', `Permissão ${chave} com o texto padrão em inglês`, String(texto));
    else if (/Expo Dev Launcher/.test(String(texto))) add(faseTiraRedeLocal ? 'ok' : 'aviso', `Permissão ${chave} do cliente de desenvolvimento (expo-dev-client)`, String(texto) + (faseTiraRedeLocal ? tiradaNoRelease : ' no pacote'));
    else add('ok', `Permissão ${chave}`, String(texto));
  }
  if (!('NSFaceIDUsageDescription' in info)) add('ok', 'NSFaceIDUsageDescription', 'ausente (o app não usa biometria; expo-secure-store com faceIDPermission: false)');
  if (Array.isArray(info.NSBonjourServices) && info.NSBonjourServices.includes('_expo._tcp')) {
    add(faseTiraRedeLocal ? 'ok' : 'aviso', 'NSBonjourServices _expo._tcp (expo-dev-client)', JSON.stringify(info.NSBonjourServices) + (faseTiraRedeLocal ? tiradaNoRelease : ' no pacote'));
  }

  if (!privacidade) add('erro', 'Manifesto de privacidade (PrivacyInfo.xcprivacy)', 'ausente');
  else {
    add(privacidade.NSPrivacyTracking === false ? 'ok' : 'erro', 'NSPrivacyTracking', String(privacidade.NSPrivacyTracking));
    const apis = Object.fromEntries((privacidade.NSPrivacyAccessedAPITypes ?? []).map((a) => [a.NSPrivacyAccessedAPIType, a.NSPrivacyAccessedAPITypeReasons ?? []]));
    for (const [api, razoes] of Object.entries(RAZOES_ESPERADAS)) {
      const tem = apis[api];
      const falta = razoes.filter((x) => !tem?.includes(x));
      add(tem && falta.length === 0 ? 'ok' : 'erro', `Razão declarada ${api.replace('NSPrivacyAccessedAPICategory', '')}`, tem ? tem.join(', ') : 'ausente');
    }
  }

  const esquemas = (info.CFBundleURLTypes ?? []).flatMap((t) => t.CFBundleURLSchemes ?? []);
  const redirect = env?.EXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI;
  if (redirect) {
    const esquema = redirect.split(':')[0];
    add(esquemas.includes(esquema) ? 'ok' : 'erro', 'Esquema do retorno do Google', `${esquema} em [${esquemas.join(', ')}]`);
  } else add('ok', 'Esquemas de URL', esquemas.join(', '));
  const api = env?.EXPO_PUBLIC_STUDOO_API_URL;
  if (env) add(api?.startsWith('https://') ? 'ok' : 'erro', 'API do perfil em HTTPS', api ? 'https' : 'ausente');
  if (info.UIBackgroundModes) add('ok', 'UIBackgroundModes', JSON.stringify(info.UIBackgroundModes));
  return r;
}

const modoPrebuild = args.includes('--prebuild');
const caminhoApp = valor('--app');
if (!modoPrebuild && !caminhoApp) {
  console.error('uso: conferir-artefato-ios.mjs --prebuild [perfil] [--json arquivo] | --app <.app|.ipa> --temp <pasta> [--json arquivo]');
  process.exit(2);
}
const perfil = modoPrebuild ? (args[args.indexOf('--prebuild') + 1]?.startsWith('--') ? 'testflight' : args[args.indexOf('--prebuild') + 1] ?? 'testflight') : null;
const dados = modoPrebuild ? porPrebuild(perfil) : porApp(resolve(caminhoApp));
const resultado = conferir(dados);
const marca = { ok: '✅', aviso: '⚠️ ', erro: '❌' };
console.log(`Origem: ${dados.origem}`);
for (const linha of resultado) console.log(`${marca[linha.nivel]} ${linha.item}: ${linha.detalhe}`);
const erros = resultado.filter((l) => l.nivel === 'erro').length;
const avisos = resultado.filter((l) => l.nivel === 'aviso').length;
console.log(`${erros} erro(s), ${avisos} aviso(s).`);
const json = valor('--json');
if (json) writeFileSync(json, JSON.stringify({ origem: dados.origem, perfil, resultado }, null, 2));
process.exit(erros ? 1 : 0);
