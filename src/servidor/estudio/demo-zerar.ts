import { banco } from "../banco/cliente";
import { normalizarEmail } from "../acesso/credenciais";

export type ResultadoZerarDemo = {
  encontrada: boolean;
  planosRemovidos: number;
  materiaisRemovidos: number;
  apoiosRemovidos: number;
  sessoesRemovidas: number;
};

/**
 * Remove trilhas, lições, apoios, materiais, registros e sessões apenas da conta `STUDOO_EMAIL`.
 * Mantém a conta de demonstração intacta e nunca toca em outros usuários. Idempotente.
 */
export async function zerarContaDemo(emailEntrada = process.env.STUDOO_EMAIL): Promise<ResultadoZerarDemo> {
  const email = normalizarEmail(emailEntrada);
  if (!email) throw new Error("STUDOO_EMAIL não configurado");

  const conta = await banco.usuario.findUnique({ where: { email }, select: { id: true } });
  if (!conta) {
    return { encontrada: false, planosRemovidos: 0, materiaisRemovidos: 0, apoiosRemovidos: 0, sessoesRemovidas: 0 };
  }

  return banco.$transaction(async (tx) => {
    await tx.registroEstudo.deleteMany({ where: { usuarioId: conta.id } });
    const apoios = await tx.apoioLicao.deleteMany({ where: { usuarioId: conta.id } });
    await tx.licao.deleteMany({ where: { usuarioId: conta.id } });
    await tx.fluxo.deleteMany({ where: { usuarioId: conta.id } });
    const planos = await tx.planoAprendizado.deleteMany({ where: { usuarioId: conta.id } });
    const sessoes = await tx.sessao.deleteMany({ where: { usuarioId: conta.id } });
    const materiais = await tx.materialEstudo.deleteMany({ where: { usuarioId: conta.id } });

    return {
      encontrada: true,
      planosRemovidos: planos.count,
      materiaisRemovidos: materiais.count,
      apoiosRemovidos: apoios.count,
      sessoesRemovidas: sessoes.count,
    };
  });
}
