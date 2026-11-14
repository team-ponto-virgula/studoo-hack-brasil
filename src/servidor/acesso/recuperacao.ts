import { randomInt } from 'node:crypto';
import { banco } from '@/servidor/banco/cliente';
import { criarHashSenha, normalizarEmail, senhaValida } from './credenciais';
import { FalhaApi } from './http';
import { assinatura, consumirLimite, emailPermitido, iguais } from './seguranca';
import { enviarRecuperacao, recuperacaoDisponivel } from '../email/recuperacao';

const validadeMs = 15 * 60_000;
export async function solicitarRecuperacao(entrada: unknown) {
  const email = normalizarEmail(entrada);
  if (!email) throw new FalhaApi('invalido');
  if (!recuperacaoDisponivel()) throw new FalhaApi('recuperacao_indisponivel');
  const codigo = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codigoHash = assinatura(`senha\0${email}\0${codigo}`);
  const resultado = await banco.$transaction(async (tx) => {
    if (!await consumirLimite(tx, `recuperar\0${email}`, 3, validadeMs)) return { limitado: true };
    // O mesmo orçamento é consumido para e-mails que não existem.
    const usuario = emailPermitido(email) ? await tx.usuario.findUnique({ where: { email }, select: { id: true } }) : null;
    if (!usuario) return { limitado: false };
    const data = { codigoHash, expiraEm: new Date(Date.now() + validadeMs), tentativas: 0 };
    await tx.recuperacaoSenha.upsert({ where: { usuarioId: usuario.id }, create: { usuarioId: usuario.id, ...data }, update: data });
    return { limitado: false, usuarioId: usuario.id };
  });
  if (resultado.limitado) throw new FalhaApi('limite_recuperacao');
  if (resultado.usuarioId) {
    try { await enviarRecuperacao(email, codigo); }
    catch {
      await banco.recuperacaoSenha.deleteMany({ where: { usuarioId: resultado.usuarioId, codigoHash } });
      // Resposta neutra também quando SMTP falha, para não revelar quais e-mails existem.
      console.error(JSON.stringify({ rota: 'recuperar-senha', codigo: 'envio_indisponivel' }));
    }
  }
  return { enviado: true };
}
export async function redefinirSenha(entrada: unknown, codigo: unknown, senha: unknown) {
  const email = normalizarEmail(entrada);
  if (!email || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo) || !senhaValida(senha)) throw new FalhaApi('invalido');
  const senhaHash = await criarHashSenha(senha);
  const resultado = await banco.$transaction(async (tx) => {
    if (!await consumirLimite(tx, `redefinir\0${email}`, 5, validadeMs)) return 'limite_recuperacao';
    // Serializa com novos pedidos de código para impedir uso simultâneo ou perda de atualizações.
    const chave = assinatura(`recuperar\0${email}`);
    await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0::bigint))`;
    const usuario = emailPermitido(email) ? await tx.usuario.findUnique({ where: { email }, select: { id: true } }) : null;
    const registro = usuario && await tx.recuperacaoSenha.findUnique({ where: { usuarioId: usuario.id } });
    if (!usuario || !registro || registro.expiraEm <= new Date() || registro.tentativas >= 5) return 'codigo_invalido';
    if (!iguais(registro.codigoHash, assinatura(`senha\0${email}\0${codigo}`))) {
      await tx.recuperacaoSenha.update({ where: { usuarioId: usuario.id }, data: { tentativas: { increment: 1 } } });
      return 'codigo_invalido';
    }
    await tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash } });
    await tx.recuperacaoSenha.delete({ where: { usuarioId: usuario.id } });
    await tx.sessao.deleteMany({ where: { usuarioId: usuario.id } });
    await tx.codigoGoogleMobile.deleteMany({ where: { usuarioId: usuario.id } });
    return null;
  });
  if (resultado) throw new FalhaApi(resultado);
  return { alterada: true };
}
