import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import nodemailer from 'nodemailer';
import { origemStudoo } from '../acesso/origem';

function local() {
  const origem = origemStudoo();
  return origem && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origem).hostname);
}
function configuracaoSmtp() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? '587');
  const from = process.env.EMAIL_FROM?.trim();
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !from || /[\r\n]/.test(from) || !Number.isInteger(port) || port < 1 || port > 65535 || (!!user !== !!pass)) return null;
  return { host, port, from, user, pass };
}
export function recuperacaoDisponivel() {
  return !!origemStudoo() && (process.env.EMAIL === 'falso' ? !!local() : process.env.EMAIL === 'smtp' && !!configuracaoSmtp());
}
export async function enviarRecuperacao(email: string, codigo: string) {
  if (!recuperacaoDisponivel()) throw new Error('E-mail indisponível');
  const url = new URL('/recuperar', origemStudoo()!);
  const mensagem = {
    to: email, subject: 'Seu código para recuperar a senha do Studoo',
    text: `Seu código do Studoo é: ${codigo}\n\nEle vale por 15 minutos e só pode ser usado uma vez. Informe-o no app ou em ${url}.\n\nSe você não solicitou a troca, ignore esta mensagem. Sua senha continua a mesma.`,
  };
  if (process.env.EMAIL === 'falso') {
    // Somente loopback. Não escreve código nem e-mail em logs ou na resposta HTTP.
    const pasta = join(process.cwd(), '.studoo-local', 'emails');
    await mkdir(pasta, { recursive: true, mode: 0o700 });
    await writeFile(join(pasta, `${randomUUID()}.json`), JSON.stringify(mensagem, null, 2), { mode: 0o600 });
    return;
  }
  const config = configuracaoSmtp()!;
  const secure = process.env.SMTP_SECURE === 'true' || config.port === 465;
  const transporte = nodemailer.createTransport({
    host: config.host, port: config.port, secure, requireTLS: !secure,
    auth: config.user ? { user: config.user, pass: config.pass! } : undefined,
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    tls: { minVersion: 'TLSv1.2' },
    logger: false, debug: false,
  });
  try { await transporte.sendMail({ ...mensagem, from: config.from }); }
  finally { transporte.close(); }
}
