/**
 * Acesso para o TestFlight externo: criar conta por e-mail (com código de posse), "Esqueci minha senha", Google e
 * Iniciar sessão com a Apple no iPhone (App Review 4.8: opção com e-mail privado ao lado do Google).
 *
 * Regras que valem em todos os canais:
 * - Nenhuma conta é vinculada a outro provedor só porque o e-mail é igual: e-mail já usado por outra forma de entrar
 *   responde `google_conta_existente` ou `apple_conta_existente` (HTTP 409).
 * - Pedir código responde sempre `{ enviado: true }`, exista ou não a conta (não revela quais e-mails existem). Se o
 *   e-mail já tem conta, a pessoa recebe um aviso para entrar ou recuperar a senha, e o código não é criado.
 * - Os limites (`limite_cadastro`, `limite_recuperacao`, `limite_login`) respondem HTTP 429.
 *
 * Rotas (web com cookie e mesma origem; app sem cookie, em `/api/mobile/...`, devolvendo `SessaoNativa`):
 * - POST /api/cadastro/codigo e /api/mobile/cadastro/codigo  `PedidoCodigoCadastro` → `{ enviado: true }`
 * - POST /api/cadastro (cookie + `{ autenticado: true }`) e /api/mobile/cadastro (`SessaoNativa`)  `PedidoCadastro`
 * - POST /api/mobile/apple/nonce → `NonceApple` (uso único, 10 minutos)
 * - POST /api/mobile/apple  `PedidoEntradaApple` → `SessaoNativa`
 * - "Esqueci minha senha" segue em /api/senha/recuperar e /api/senha/redefinir (e /api/mobile/senha/...).
 * - GET /api/auth/config traz `cadastro` e `apple` (booleans) além de `google` e `recuperacao`.
 */

/** Tamanho do código enviado por e-mail (o mesmo da recuperação de senha). */
export const DIGITOS_CODIGO = 6;
/** Validade do código de cadastro e do de recuperação. */
export const VALIDADE_CODIGO_MIN = 15;
export const SENHA_MIN = 8;
export const SENHA_MAX = 256;

export interface PedidoCodigoCadastro {
  email: string;
}

export interface PedidoCadastro {
  email: string;
  /** Os 6 dígitos recebidos por e-mail. */
  codigo: string;
  senha: string;
}

export interface NonceApple {
  /**
   * O valor bruto. O app passa `sha256Hex(nonce)` ao pedido da Apple (expo-apple-authentication `nonce`) e manda o
   * bruto de volta em `PedidoEntradaApple.nonce`; o servidor confere que o token da Apple traz o hash dele.
   */
  nonce: string;
  expiraEm: string;
}

export interface NomeApple {
  givenName?: string | null;
  familyName?: string | null;
}

export interface PedidoEntradaApple {
  /** `credential.identityToken` (JWT da Apple). */
  identityToken: string;
  /** `credential.authorizationCode`: o servidor troca por um token de renovação, usado para revogar na exclusão. */
  authorizationCode: string;
  /** O nonce bruto recebido de POST /api/mobile/apple/nonce. */
  nonce: string;
  /** `credential.fullName`: a Apple só manda no primeiro acesso; vira o nome do perfil se ainda não houver. */
  nome?: NomeApple | null;
}

const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mesma regra do servidor para o e-mail (minúsculas, sem espaços nas pontas, até 254). Null fora do formato. */
export function normalizarEmailEntrada(email: string): string | null {
  const normalizado = email.trim().toLowerCase();
  return normalizado.length <= 254 && formatoEmail.test(normalizado) ? normalizado : null;
}

export function senhaAceita(senha: string): boolean {
  return senha.length >= SENHA_MIN && senha.length <= SENHA_MAX;
}

export function codigoAceito(codigo: string): boolean {
  return new RegExp(`^\\d{${DIGITOS_CODIGO}}$`).test(codigo);
}

/** E-mail de retransmissão privada da Apple ("Ocultar meu e-mail"). */
export function emailPrivadoApple(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@privaterelay.appleid.com");
}
