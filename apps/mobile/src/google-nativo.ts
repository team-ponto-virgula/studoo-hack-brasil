import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { ErroStudoo } from '@studoo/contratos';
import { criarClienteNativo, guardarToken, origemConfigurada } from './api-nativa';

export const retornoGoogle = () => process.env.EXPO_PUBLIC_STUDOO_GOOGLE_REDIRECT_URI ?? 'studoo-dev://auth/google';
const chave = () => `studoo.google.${origemConfigurada().host.replace(/[^a-z0-9._-]/gi, '_')}`;
let emCurso: Promise<string | null> | null = null;
const trocas = new Map<string, Promise<string>>();

export function entrarComGoogle() {
  if (emCurso) return emCurso;
  emCurso = iniciar().finally(() => { emCurso = null; });
  return emCurso;
}
async function iniciar() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  const verificador = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const desafio = (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verificador,
    { encoding: Crypto.CryptoEncoding.BASE64 })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await SecureStore.setItemAsync(chave(), JSON.stringify({ verificador, expiraEm: Date.now() + 600_000 }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  const url = new URL('/api/auth/google/iniciar', origemConfigurada().origin);
  url.searchParams.set('mobile', '1'); url.searchParams.set('desafio', desafio);
  const resultado = await WebBrowser.openAuthSessionAsync(url.toString(), retornoGoogle());
  // Um deep link também pode abrir a rota do Expo Router. Ela compartilha a troca abaixo.
  if (resultado.type !== 'success') return null;
  return concluirGoogle(resultado.url);
}
export function concluirGoogle(retorno: string): Promise<string> {
  const url = new URL(retorno); const esperado = new URL(retornoGoogle());
  if (url.protocol !== esperado.protocol || url.host !== esperado.host || url.pathname !== esperado.pathname) {
    return Promise.reject(new ErroStudoo('google_invalido'));
  }
  const erro = url.searchParams.get('erro');
  if (erro) return Promise.reject(new ErroStudoo(erro === 'google_conta_existente' ? erro : 'google_invalido'));
  const codigo = url.searchParams.get('codigo') ?? '';
  if (!/^[A-Za-z0-9_-]{43}$/.test(codigo)) return Promise.reject(new ErroStudoo('google_invalido'));
  const atual = trocas.get(codigo);
  if (atual) return atual;
  const troca = (async () => {
    const texto = await SecureStore.getItemAsync(chave());
    const tentativa = texto ? JSON.parse(texto) as { verificador: string; expiraEm: number } : null;
    if (!tentativa || tentativa.expiraEm < Date.now()) throw new ErroStudoo('google_invalido');
    const { token } = await criarClienteNativo().trocarCodigoGoogle(codigo, tentativa.verificador);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErroStudoo('falha');
    try { await guardarToken(token); }
    catch (erro) { await criarClienteNativo(token).logout().catch(() => undefined); throw erro; }
    await SecureStore.deleteItemAsync(chave());
    return token;
  })();
  trocas.set(codigo, troca);
  const esquecer = () => { setTimeout(() => trocas.delete(codigo), 30_000); };
  void troca.then(esquecer, esquecer);
  // Guarda apenas a troca atual, compartilhada entre browser e rota; novas tentativas substituem a anterior.
  for (const outro of trocas.keys()) if (outro !== codigo) trocas.delete(outro);
  return troca;
}
