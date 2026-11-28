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
  /** `credential.fullName`: opcional e hoje não é guardado (o perfil público continua pedindo o nome à pessoa). */
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

/*
 * Os links dos e-mails. "Criar minha conta" e "Criar nova senha" levam o código já preenchido; no aparelho com o app, o
 * link universal (iPhone) ou o App Link (Android) abre o app na mesma tela, e sem o app abre o site.
 * - O código vai no fragmento (`#codigo=123456`): o fragmento não sai do aparelho (não chega ao servidor, aos registros
 *   do proxy nem ao Referer), e quem abre a tela tira ele do endereço.
 * - O e-mail da pessoa não vai no link (nenhum dado dela entra na mensagem): o app e o site lembram, só no aparelho, o
 *   e-mail que pediu o código, pelo tempo que o código vale. Em outro aparelho, a tela pede o e-mail de novo.
 */

/** As telas que os links dos e-mails abrem (no site e, com o app instalado, no app). */
export const CAMINHOS_DOS_EMAILS = { cadastro: '/cadastro', recuperar: '/recuperar', entrar: '/login' } as const;

/** O endereço da tela com o código no fragmento. */
export function linkComCodigo(endereco: string, codigo: string): string {
  return `${endereco.split('#')[0]}#codigo=${encodeURIComponent(codigo)}`;
}

/** O código que veio no fragmento do link (`#codigo=…`, com ou sem o `#`); null sem código válido. */
export function codigoDoFragmento(fragmento: string | null | undefined): string | null {
  const achado = /(?:^|[#&])codigo=([^&#]*)/.exec(fragmento ?? '');
  const codigo = achado ? achado[1] : '';
  return codigoAceito(codigo) ? codigo : null;
}

/** Por quanto tempo o aparelho lembra o e-mail que pediu o código: o tempo que o código vale. */
export const VALIDADE_EMAIL_LEMBRADO_MS = VALIDADE_CODIGO_MIN * 60_000;

/** O que o aparelho guarda ao pedir um código: o e-mail e até quando ele vale. */
export function lembrancaDoEmail(email: string, agora = Date.now()): string {
  return JSON.stringify({ email, ate: agora + VALIDADE_EMAIL_LEMBRADO_MS });
}

/** O e-mail lembrado, se ainda vale e está no formato; null em qualquer outro caso (nada guardado, vencido, estragado). */
export function emailDaLembranca(guardado: string | null | undefined, agora = Date.now()): string | null {
  if (!guardado) return null;
  try {
    const dados: unknown = JSON.parse(guardado);
    if (!dados || typeof dados !== 'object') return null;
    const { email, ate } = dados as { email?: unknown; ate?: unknown };
    if (typeof email !== 'string' || typeof ate !== 'number' || ate <= agora || ate > agora + VALIDADE_EMAIL_LEMBRADO_MS) return null;
    return normalizarEmailEntrada(email);
  } catch {
    return null;
  }
}

/** E-mail de retransmissão privada da Apple ("Ocultar meu e-mail"). */
export function emailPrivadoApple(email: string): boolean {
  return email.trim().toLowerCase().endsWith("@privaterelay.appleid.com");
}
