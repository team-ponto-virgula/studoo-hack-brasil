import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@/servidor/banco/gerado/client';

export function assinatura(valor: string) {
  const segredo = process.env.STUDOO_CHAVE_ASSINATURA ?? '';
  if (!/^(?:[a-fA-F0-9]{2}){32,}$/.test(segredo)) throw new Error('Configuração de autenticação ausente');
  return createHmac('sha256', Buffer.from(segredo, 'hex')).update(valor).digest('hex');
}
export function iguais(a: string, b: string) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const MAX_EMAILS_PERMITIDOS = 20;

/**
 * E-mails exatos liberados além do domínio (`STUDOO_EMAILS_PERMITIDOS`, separados por vírgula): comparados em
 * minúsculas e sem espaços; entradas vazias ou sem formato de e-mail são ignoradas; no máximo 20.
 */
export function emailsPermitidos(): Set<string> {
  const lista = (process.env.STUDOO_EMAILS_PERMITIDOS ?? '')
    .split(',')
    .map((item) => item.replace(/\s+/g, '').toLowerCase())
    .filter((item) => item.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
  return new Set(lista.slice(0, MAX_EMAILS_PERMITIDOS));
}

/**
 * Quem pode entrar (senha, recuperação e Google usam esta mesma regra): sem `STUDOO_DOMINIO_EMAIL`, qualquer e-mail;
 * com ele, o domínio informado ou um e-mail exato de `STUDOO_EMAILS_PERMITIDOS`. A lista nunca abre um domínio inteiro.
 */
export function emailPermitido(email: string) {
  const dominio = process.env.STUDOO_DOMINIO_EMAIL?.trim().toLowerCase();
  if (!dominio) return true;
  const normalizado = email.trim().toLowerCase();
  return normalizado.split('@')[1] === dominio || emailsPermitidos().has(normalizado);
}
/** Contadores persistentes, serializados entre instâncias do servidor. */
export async function consumirLimite(tx: Prisma.TransactionClient, escopo: string, limite: number, janelaMs: number) {
  const chave = assinatura(escopo);
  await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0::bigint))`;
  const agora = new Date();
  const tentativa = await tx.tentativaLogin.findUnique({ where: { chave } });
  const vigente = tentativa && agora.getTime() - tentativa.janelaInicio.getTime() < janelaMs;
  if (vigente && tentativa.falhas >= limite) return false;
  const dados = { falhas: vigente ? tentativa.falhas + 1 : 1, janelaInicio: vigente ? tentativa.janelaInicio : agora };
  await tx.tentativaLogin.upsert({ where: { chave }, create: { chave, ...dados }, update: dados });
  return true;
}
