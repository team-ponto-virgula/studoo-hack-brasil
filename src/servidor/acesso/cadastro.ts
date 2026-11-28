import { randomInt } from 'node:crypto';
import { banco } from '@/servidor/banco/cliente';
import type { CanalSessao } from '@/servidor/banco/gerado/client';
import { criarHashSenha, normalizarEmail, senhaValida } from './credenciais';
import { FalhaApi } from './http';
import { assinatura, consumirLimite, emailPermitido, iguais } from './seguranca';
import { criarSessao } from './sessao';
import { ehEmailVisitante } from './visitante';
import { enviarAvisoContaExistente, enviarCodigoCadastro, recuperacaoDisponivel } from '../email/recuperacao';

const validadeMs = 15 * 60_000;
const maxTentativas = 5;

/** E-mails que nunca recebem mensagem nem criam conta por aqui (domínios internos de visitante e de Apple sem e-mail). */
export function emailInterno(email: string) {
  return ehEmailVisitante(email) || email.endsWith('.studoo.local');
}

/**
 * Criar conta por e-mail: ligado com `STUDOO_CADASTRO=1` e com o envio de e-mail pronto (o mesmo da recuperação).
 * Sem e-mail não há como provar posse, então o cadastro some junto.
 */
export function cadastroAtivo() {
  return process.env.STUDOO_CADASTRO === '1' && recuperacaoDisponivel();
}

const chaveVerificacao = (email: string) => assinatura(`cadastro-verificacao\0${email}`);
const hashCodigo = (email: string, codigo: string) => assinatura(`cadastro\0${email}\0${codigo}`);

/**
 * Pede o código de posse. A resposta é sempre `{ enviado: true }` (exista ou não a conta). E-mail com conta recebe só
 * um aviso para entrar ou recuperar a senha. Limites: 3 por e-mail a cada 15 min, 10 por rede a cada 15 min, 200 por hora.
 */
export async function pedirCodigoCadastro(entrada: unknown, rede: string, origem?: string | null) {
  if (!cadastroAtivo()) throw new FalhaApi('cadastro_indisponivel');
  const email = normalizarEmail(entrada);
  if (!email || emailInterno(email)) throw new FalhaApi('invalido');
  if (!emailPermitido(email)) throw new FalhaApi('email_nao_permitido');
  const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const chave = chaveVerificacao(email);
  const resultado = await banco.$transaction(async (tx) => {
    if (!await consumirLimite(tx, `cadastro-codigo\0${email}`, 3, validadeMs)) return { limitado: true as const };
    if (!await consumirLimite(tx, `cadastro-rede\0${rede}`, 10, validadeMs)) return { limitado: true as const };
    if (!await consumirLimite(tx, 'cadastro-global', 200, 60 * 60_000)) return { limitado: true as const };
    await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0::bigint))`;
    await tx.verificacaoCadastro.deleteMany({ where: { expiraEm: { lte: new Date() } } });
    const existente = await tx.usuario.findUnique({ where: { email }, select: { perfilDemo: true } });
    if (existente) {
      await tx.verificacaoCadastro.deleteMany({ where: { chave } });
      return { limitado: false as const, existente: !existente.perfilDemo, codigo: false };
    }
    const data = { codigoHash: hashCodigo(email, codigo), expiraEm: new Date(Date.now() + validadeMs), tentativas: 0 };
    await tx.verificacaoCadastro.upsert({ where: { chave }, create: { chave, ...data }, update: data });
    return { limitado: false as const, existente: false, codigo: true };
  });
  if (resultado.limitado) throw new FalhaApi('limite_cadastro');
  try {
    if (resultado.codigo) await enviarCodigoCadastro(email, codigo);
    else if (resultado.existente) await enviarAvisoContaExistente(email, origem);
  } catch {
    if (resultado.codigo) await banco.verificacaoCadastro.deleteMany({ where: { chave, codigoHash: hashCodigo(email, codigo) } });
    // Resposta neutra também quando o provedor falha: não revela se o e-mail existe nem o motivo.
    console.error(JSON.stringify({ rota: 'cadastro-codigo', codigo: 'envio_indisponivel' }));
  }
  return { enviado: true as const };
}

/**
 * Confirma o código e cria a conta com senha, já com a sessão do canal. Código errado conta tentativa (5 no máximo);
 * e-mail que ganhou conta entre o pedido e a confirmação responde `codigo_invalido`, sem tocar na conta existente.
 */
export async function cadastrar(entrada: unknown, codigo: unknown, senha: unknown, canal: CanalSessao) {
  if (!cadastroAtivo()) throw new FalhaApi('cadastro_indisponivel');
  const email = normalizarEmail(entrada);
  if (!email || emailInterno(email) || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo) || !senhaValida(senha)) {
    throw new FalhaApi('invalido');
  }
  if (!emailPermitido(email)) throw new FalhaApi('email_nao_permitido');
  const senhaHash = await criarHashSenha(senha);
  const chave = chaveVerificacao(email);
  const resultado = await banco.$transaction(async (tx) => {
    if (!await consumirLimite(tx, `cadastro-confirmar\0${email}`, 10, validadeMs)) return { erro: 'limite_cadastro' as const };
    await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0::bigint))`;
    const registro = await tx.verificacaoCadastro.findUnique({ where: { chave } });
    if (!registro || registro.expiraEm <= new Date() || registro.tentativas >= maxTentativas) return { erro: 'codigo_invalido' as const };
    if (!iguais(registro.codigoHash, hashCodigo(email, codigo))) {
      await tx.verificacaoCadastro.update({ where: { chave }, data: { tentativas: { increment: 1 } } });
      return { erro: 'codigo_invalido' as const };
    }
    await tx.verificacaoCadastro.delete({ where: { chave } });
    if (await tx.usuario.findUnique({ where: { email }, select: { id: true } })) return { erro: 'codigo_invalido' as const };
    const usuario = await tx.usuario.create({ data: { email, senhaHash, fuso: 'America/Sao_Paulo' }, select: { id: true } });
    return { erro: null, sessao: await criarSessao(usuario.id, canal, tx) };
  });
  if (resultado.erro !== null) throw new FalhaApi(resultado.erro);
  return resultado.sessao;
}
