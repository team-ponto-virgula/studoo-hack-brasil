import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { ErroStudoo } from '@studoo/contratos';
import type { PedidoEntradaApple } from '@studoo/contratos/autenticacao';
import { criarClienteNativo, guardarToken } from './api-nativa';

/*
 * "Continuar com a Apple" no iPhone (App Review 4.8, `@studoo/contratos/autenticacao`): o servidor dá um nonce de uso
 * único, o app passa o SHA-256 dele (hex minúsculo) à Apple e devolve o bruto com o identityToken e o authorizationCode;
 * o servidor confere o token (emissor, bundle, assinatura, validade e nonce) e responde a sessão do app. Nunca vincula
 * contas pelo e-mail (`apple_conta_existente`). Nonce vencido ou token recusado (`apple_invalido`): a entrada mostra o
 * erro e o próximo toque já pede um nonce novo (o token da Apple fica preso ao nonce antigo, não dá para reaproveitar).
 */

let emCurso: Promise<string | null> | null = null;

/** Só no iPhone e só quando o aparelho oferece (o servidor ainda decide com `config.apple`). */
export async function appleDisponivelNoAparelho() {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Abre a folha da Apple e devolve o token da sessão já guardado; null se a pessoa cancelou. Um pedido por vez. */
export function entrarComApple() {
  if (emCurso) return emCurso;
  emCurso = iniciar().finally(() => { emCurso = null; });
  return emCurso;
}

export const sha256Hex = (valor: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, valor, { encoding: Crypto.CryptoEncoding.HEX }).then((hex) => hex.toLowerCase());

async function iniciar(): Promise<string | null> {
  const cliente = criarClienteNativo();
  const { nonce } = await cliente.nonceApple();
  let credencial: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credencial = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: await sha256Hex(nonce),
    });
  } catch (falha) {
    if ((falha as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED') return null;
    throw new ErroStudoo('apple_invalido');
  }
  if (!credencial.identityToken || !credencial.authorizationCode) throw new ErroStudoo('apple_invalido');
  const pedido: PedidoEntradaApple = {
    identityToken: credencial.identityToken,
    authorizationCode: credencial.authorizationCode,
    nonce,
    nome: credencial.fullName ? { givenName: credencial.fullName.givenName, familyName: credencial.fullName.familyName } : null,
  };
  const { token } = await cliente.entrarApple(pedido);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErroStudoo('falha');
  try {
    await guardarToken(token);
  } catch (erro) {
    await criarClienteNativo(token).logout().catch(() => undefined);
    throw erro;
  }
  return token;
}
