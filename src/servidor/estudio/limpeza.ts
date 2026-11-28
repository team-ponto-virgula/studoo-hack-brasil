import { banco } from "../banco/cliente";
import {
  DOMINIO_EMAIL_VISITANTE,
  PRAZO_VISITANTE_MS,
  PREFIXO_EMAIL_VISITANTE,
  timestampEmailVisitante,
} from "../acesso/visitante";

export async function limparExpirados(agora = new Date(), prazoVisitanteMs = PRAZO_VISITANTE_MS) {
  const materiais = await banco.materialEstudo.deleteMany({
    where: { expiraEm: { lte: agora } },
  });

  const candidatos = await banco.usuario.findMany({
    where: {
      email: { startsWith: PREFIXO_EMAIL_VISITANTE, endsWith: DOMINIO_EMAIL_VISITANTE },
    },
    select: { id: true, email: true },
  });

  const idsExpirados = candidatos
    .filter((u) => {
      const criadoEm = timestampEmailVisitante(u.email);
      return criadoEm !== null && agora.getTime() - criadoEm >= prazoVisitanteMs;
    })
    .map((u) => u.id);

  let visitantesExpiradosRemovidos = 0;
  if (idsExpirados.length > 0) {
    await banco.$transaction(async (tx) => {
      await tx.registroEstudo.deleteMany({ where: { usuarioId: { in: idsExpirados } } });
      await tx.apoioLicao.deleteMany({ where: { usuarioId: { in: idsExpirados } } });
      await tx.licao.deleteMany({ where: { usuarioId: { in: idsExpirados } } });
      await tx.fluxo.deleteMany({ where: { usuarioId: { in: idsExpirados } } });
      await tx.planoAprendizado.deleteMany({ where: { usuarioId: { in: idsExpirados } } });
      await tx.sessao.deleteMany({ where: { usuarioId: { in: idsExpirados } } });
      await tx.materialEstudo.deleteMany({ where: { usuarioId: { in: idsExpirados } } });
      const removidos = await tx.usuario.deleteMany({ where: { id: { in: idsExpirados } } });
      visitantesExpiradosRemovidos = removidos.count;
    });
  }

  return {
    materiaisExpiradosRemovidos: materiais.count,
    visitantesExpiradosRemovidos,
  };
}
