import * as SecureStore from 'expo-secure-store';
import { codigoDoFragmento, emailDaLembranca, lembrancaDoEmail } from '@studoo/contratos/autenticacao';

/*
 * Os links dos e-mails abrem o app quando ele está instalado (links universais no iPhone, App Links no Android; o site
 * publica a associação em /.well-known, src/links-do-app.ts). Cada link cai numa rota (app/login.tsx, app/cadastro.tsx,
 * app/recuperar.tsx), que abre a tela dela sem sessão no aparelho.
 *
 * O código vem no fragmento (`#codigo=123456`); o e-mail não vem no link: o app lembra, no SecureStore e pelo tempo que
 * o código vale, o e-mail que pediu o código. As regras ficam em @studoo/contratos/autenticacao; a web faz o mesmo com
 * o localStorage (src/app/codigo-do-link.ts).
 */
export type AcessoPeloLink = { tela: 'entrar' | 'cadastro' | 'recuperar'; codigo: string | null };

const CHAVE = 'studoo.email-do-codigo';

/** O Expo Router entrega o fragmento do link em `params['#']` (sem o `#`). */
export function acessoDosParametros(tela: AcessoPeloLink['tela'], parametros: Record<string, string | string[] | undefined>): AcessoPeloLink {
  const fragmento = parametros['#'];
  return { tela, codigo: codigoDoFragmento(typeof fragmento === 'string' ? fragmento : null) };
}

export async function lembrarEmailDoCodigo(email: string) {
  try { await SecureStore.setItemAsync(CHAVE, lembrancaDoEmail(email)); } catch { /* Sem armazenamento, a tela pede o e-mail de novo. */ }
}

export async function emailDoCodigo(): Promise<string | null> {
  try { return emailDaLembranca(await SecureStore.getItemAsync(CHAVE)); } catch { return null; }
}

export async function esquecerEmailDoCodigo() {
  try { await SecureStore.deleteItemAsync(CHAVE); } catch { /* Nada guardado. */ }
}
