import { codigoDoFragmento, emailDaLembranca, lembrancaDoEmail } from '@studoo/contratos/autenticacao';

/*
 * O código que chega pelo botão do e-mail (`/cadastro#codigo=…`, `/recuperar#codigo=…`) e o e-mail que pediu o código,
 * lembrado só neste navegador pelo tempo que o código vale. As regras ficam em @studoo/contratos/autenticacao; o app faz
 * o mesmo com o SecureStore (apps/mobile/src/codigo-do-link.ts).
 *
 * O localStorage (e não o sessionStorage) porque o link do e-mail costuma abrir numa aba nova. Sem armazenamento, a
 * tela pede o e-mail de novo.
 */
const CHAVE = 'studoo.email-do-codigo';

/** Lê o código do fragmento e tira ele do endereço (não fica no histórico nem num endereço copiado). */
export function tomarCodigoDoLink(): string | null {
  const codigo = codigoDoFragmento(window.location.hash);
  if (window.location.hash) {
    try { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); }
    catch { /* Sem trocar o endereço, o código ainda funciona. */ }
  }
  return codigo;
}

export function lembrarEmailDoCodigo(email: string) {
  try { localStorage.setItem(CHAVE, lembrancaDoEmail(email)); } catch { /* Sem armazenamento, a tela pede o e-mail de novo. */ }
}

export function emailDoCodigo(): string | null {
  try { return emailDaLembranca(localStorage.getItem(CHAVE)); } catch { return null; }
}

export function esquecerEmailDoCodigo() {
  try { localStorage.removeItem(CHAVE); } catch { /* Nada guardado. */ }
}
