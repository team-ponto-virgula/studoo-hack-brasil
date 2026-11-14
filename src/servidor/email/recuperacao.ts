import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { origemStudoo } from '../acesso/origem';

function local() {
  const origem = origemStudoo();
  return origem && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origem).hostname);
}
function configuracaoResend() {
  const chave = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!chave || /[\r\n]/.test(chave) || !from || /[\r\n]/.test(from)) return null;
  return { chave, from };
}
export function recuperacaoDisponivel() {
  return !!origemStudoo() && (process.env.EMAIL === 'falso' ? !!local() : process.env.EMAIL === 'resend' && !!configuracaoResend());
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
  const config = configuracaoResend()!;
  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${config.chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...mensagem, to: [email], from: config.from }),
    });
    if (!resposta.ok) throw new Error('Envio recusado');
    const dados: unknown = await resposta.json();
    if (!dados || typeof dados !== 'object' || !('id' in dados) || typeof dados.id !== 'string' || !dados.id.trim()) {
      throw new Error('Resposta inválida');
    }
  } catch {
    // Não propaga respostas do provedor, destinatários, códigos ou chaves para logs/API.
    throw new Error('E-mail indisponível');
  }
}
