import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { origemStudoo, origemWebPermitida } from '../acesso/origem';

function ehLoopback(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}
function local() {
  const origem = origemStudoo();
  return origem && ehLoopback(new URL(origem).hostname);
}
function valorHeaderSeguro(bruto: string | undefined) {
  const valor = bruto?.trim();
  return valor && !/[\r\n]/.test(valor) ? valor : null;
}
type ConfiguracaoHttpEmail = { endpoint: string; chave: string; from: string };

function configuracaoResend(): ConfiguracaoHttpEmail | null {
  const chave = valorHeaderSeguro(process.env.RESEND_API_KEY);
  const from = valorHeaderSeguro(process.env.EMAIL_FROM);
  if (!chave || !from) return null;
  return { endpoint: 'https://api.resend.com/emails', chave, from };
}
function urlBaseMillionSend(bruto: string | undefined): string | null {
  const texto = valorHeaderSeguro(bruto);
  if (!texto) return null;
  try {
    const url = new URL(texto);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ehLoopback(url.hostname))) return null;
    const caminho = url.pathname.replace(/\/+$/, '');
    if (caminho.endsWith('/emails')) return null;
    return `${url.origin}${caminho}/emails`;
  } catch {
    return null;
  }
}
/** Provedor dedicado para o MillionSend (API transacional POST /emails, Bearer ms_...). */
function configuracaoMillionSend(): ConfiguracaoHttpEmail | null {
  const endpoint = urlBaseMillionSend(process.env.MILLIONSEND_BASE_URL);
  const chave = valorHeaderSeguro(process.env.MILLIONSEND_API_KEY);
  const from = valorHeaderSeguro(process.env.EMAIL_FROM);
  if (!endpoint || !chave || !from) return null;
  return { endpoint, chave, from };
}
function configuracaoProvedor(): ConfiguracaoHttpEmail | null {
  if (process.env.EMAIL === 'resend') return configuracaoResend();
  if (process.env.EMAIL === 'millionsend') return configuracaoMillionSend();
  return null;
}
/** O envio de e-mail está pronto (Resend ou MillionSend configurado, ou a caixa falsa só em loopback). Vale para recuperação e cadastro. */
export function recuperacaoDisponivel() {
  if (!origemStudoo()) return false;
  return process.env.EMAIL === 'falso' ? !!local() : !!configuracaoProvedor();
}
type Mensagem = { to: string; subject: string; text: string };

function urlRecuperacao(origem?: string | null) {
  const base = (origem && origemWebPermitida(origem) ? origem : origemStudoo()) ?? 'http://localhost';
  return new URL('/recuperar', base);
}

export async function enviarRecuperacao(email: string, codigo: string, origem?: string | null) {
  const url = urlRecuperacao(origem);
  await enviarEmail({
    to: email, subject: 'Seu código para recuperar a senha do Studoo',
    text: `Seu código do Studoo é: ${codigo}\n\nEle vale por 15 minutos e só pode ser usado uma vez. Informe-o no app ou em ${url}.\n\nSe você não solicitou a troca, ignore esta mensagem. Sua senha continua a mesma.`,
  });
}

/** Código de posse do e-mail para criar a conta. */
export async function enviarCodigoCadastro(email: string, codigo: string) {
  await enviarEmail({
    to: email, subject: 'Seu código para criar a conta no Studoo',
    text: `Seu código do Studoo é: ${codigo}\n\nEle vale por 15 minutos e só pode ser usado uma vez. Informe-o no app ou no site para criar sua conta.\n\nSe você não pediu para criar uma conta, ignore esta mensagem.`,
  });
}

/** Quem tenta criar conta com um e-mail que já tem conta recebe este aviso, e nenhum código (a API responde igual). */
export async function enviarAvisoContaExistente(email: string, origem?: string | null) {
  const url = urlRecuperacao(origem);
  await enviarEmail({
    to: email, subject: 'Você já tem uma conta no Studoo',
    text: `Alguém pediu para criar uma conta no Studoo com este e-mail, mas ele já tem uma conta.\n\nPara entrar, use o mesmo jeito de sempre (e-mail e senha, Google ou Apple). Se esqueceu a senha, recupere em ${url}.\n\nSe não foi você, ignore esta mensagem.`,
  });
}

async function enviarEmail(mensagem: Mensagem) {
  if (!recuperacaoDisponivel()) throw new Error('E-mail indisponível');
  const email = mensagem.to;
  if (process.env.EMAIL === 'falso') {
    // Somente loopback. Não escreve código nem e-mail em logs ou na resposta HTTP.
    const pasta = join(process.cwd(), '.studoo-local', 'emails');
    await mkdir(pasta, { recursive: true, mode: 0o700 });
    await writeFile(join(pasta, `${randomUUID()}.json`), JSON.stringify(mensagem, null, 2), { mode: 0o600 });
    return;
  }
  const config = configuracaoProvedor();
  if (!config) throw new Error('E-mail indisponível');
  try {
    const resposta = await fetch(config.endpoint, {
      method: 'POST', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${config.chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [email], subject: mensagem.subject, text: mensagem.text }),
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
