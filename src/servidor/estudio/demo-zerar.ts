import { banco } from "../banco/cliente";
import { normalizarEmail } from "../acesso/credenciais";
import { assinatura } from "../acesso/seguranca";

export type ResultadoZerarDemo = {
  encontrada: boolean;
  confirmado: boolean;
  email: string;
  planosRemovidos: number;
  materiaisRemovidos: number;
  apoiosRemovidos: number;
  sessoesRemovidas: number;
  cotasRemovidas: number;
};

/**
 * Remove trilhas, lições, apoios, materiais, registros, sessões e cota de geração (`ia:geracao:<id>`)
 * apenas da conta `STUDOO_EMAIL`. Sem `confirmar: true`, apenas conta o que seria removido sem apagar nada.
 * Mantém a conta de demonstração intacta e nunca toca em outros usuários. Idempotente.
 */
export async function zerarContaDemo(
  emailEntrada = process.env.STUDOO_EMAIL,
  opcoes: { confirmar?: boolean } = {},
): Promise<ResultadoZerarDemo> {
  const confirmar = Boolean(opcoes.confirmar);
  const email = normalizarEmail(emailEntrada);
  if (!email) throw new Error("STUDOO_EMAIL não configurado");

  const conta = await banco.usuario.findUnique({ where: { email }, select: { id: true } });
  if (!conta) {
    return {
      encontrada: false,
      confirmado: confirmar,
      email,
      planosRemovidos: 0,
      materiaisRemovidos: 0,
      apoiosRemovidos: 0,
      sessoesRemovidas: 0,
      cotasRemovidas: 0,
    };
  }

  const chaveCota = assinatura(`ia:geracao:${conta.id}`);
  if (!confirmar) {
    const [planos, materiais, apoios, sessoes, cotas] = await Promise.all([
      banco.planoAprendizado.count({ where: { usuarioId: conta.id } }),
      banco.materialEstudo.count({ where: { usuarioId: conta.id } }),
      banco.apoioLicao.count({ where: { usuarioId: conta.id } }),
      banco.sessao.count({ where: { usuarioId: conta.id } }),
      banco.tentativaLogin.count({ where: { chave: chaveCota } }),
    ]);
    return {
      encontrada: true,
      confirmado: false,
      email,
      planosRemovidos: planos,
      materiaisRemovidos: materiais,
      apoiosRemovidos: apoios,
      sessoesRemovidas: sessoes,
      cotasRemovidas: cotas,
    };
  }

  return banco.$transaction(async (tx) => {
    await tx.registroEstudo.deleteMany({ where: { usuarioId: conta.id } });
    const apoios = await tx.apoioLicao.deleteMany({ where: { usuarioId: conta.id } });
    await tx.licao.deleteMany({ where: { usuarioId: conta.id } });
    await tx.fluxo.deleteMany({ where: { usuarioId: conta.id } });
    const planos = await tx.planoAprendizado.deleteMany({ where: { usuarioId: conta.id } });
    const sessoes = await tx.sessao.deleteMany({ where: { usuarioId: conta.id } });
    const materiais = await tx.materialEstudo.deleteMany({ where: { usuarioId: conta.id } });
    const cotas = await tx.tentativaLogin.deleteMany({ where: { chave: chaveCota } });

    return {
      encontrada: true,
      confirmado: true,
      email,
      planosRemovidos: planos.count,
      materiaisRemovidos: materiais.count,
      apoiosRemovidos: apoios.count,
      sessoesRemovidas: sessoes.count,
      cotasRemovidas: cotas.count,
    };
  });
}
