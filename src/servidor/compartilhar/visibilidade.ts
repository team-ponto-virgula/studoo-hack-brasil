import { relatosDoNavegador } from "./anonimo";
import { FORMATO_CODIGO } from "@studoo/contratos";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { banco } from "@/servidor/banco/cliente";
import type { Prisma } from "@/servidor/banco/gerado/client";

export type AlvoTipo = "trilha" | "perfil";

export async function autorDoAlvo(tipo: unknown, alvo: unknown) {
  if ((tipo !== "trilha" && tipo !== "perfil") || typeof alvo !== "string" || !FORMATO_CODIGO.test(alvo)) throw new FalhaApi("invalido");
  const autor = tipo === "perfil"
    ? (await banco.usuario.findUnique({ where: { perfilId: alvo }, select: { id: true } }))?.id
    : (await banco.linkTrilha.findUnique({ where: { codigo: alvo }, select: { usuarioId: true } }))?.usuarioId;
  if (!autor) throw new FalhaApi(tipo === "perfil" ? "nao_encontrado" : "link_inativo");
  return autor;
}

export async function restricoesDe(quem: string | null) {
  if (!quem) {
    const ids = await relatosDoNavegador();
    const casos = ids.length ? await banco.denuncia.findMany({ where: { id: { in: ids }, usuarioId: null }, select: { alvo: true, alvoTipo: true } }) : [];
    return { autores: [] as string[], perfis: casos.filter(c => c.alvoTipo === "perfil").map(c => c.alvo), trilhas: casos.filter(c => c.alvoTipo === "trilha").map(c => c.alvo) };
  }
  const [pares, denuncias] = await Promise.all([
    banco.bloqueio.findMany({ where: { OR: [{ deId: quem }, { paraId: quem }] }, select: { deId: true, paraId: true } }),
    banco.denuncia.findMany({ where: { usuarioId: quem }, select: { alvoTipo: true, alvo: true } }),
  ]);
  return {
    autores: pares.map(p => p.deId === quem ? p.paraId : p.deId),
    perfis: denuncias.filter(d => d.alvoTipo === "perfil").map(d => d.alvo),
    trilhas: denuncias.filter(d => d.alvoTipo === "trilha").map(d => d.alvo),
  };
}

export async function filtroPublico(quem: string | null): Promise<Prisma.LinkTrilhaWhereInput> {
  const { autores, perfis, trilhas } = await restricoesDe(quem);
  return {
    moderacao: "aprovado", oculta: false,
    codigo: { notIn: trilhas }, usuarioId: { notIn: autores },
    plano: { usuario: {
      perfilModeracao: "aprovado", comunidadeSuspensa: false,
      ...(process.env.STUDOO_COMUNIDADE_DEMO === "1" ? {} : { perfilDemo: false }),
      ...(perfis.length ? { NOT: { perfilId: { in: perfis } } } : {}),
    } },
  };
}

export async function bloquear(quem: string, entrada: unknown) {
  const { alvoTipo, alvo } = (entrada ?? {}) as Record<string, unknown>;
  const autor = await autorDoAlvo(alvoTipo, alvo);
  if (quem === autor) throw new FalhaApi("invalido");
  return banco.$transaction(async tx => {
    if (!(await consumirLimite(tx, `comunidade:bloqueio:${quem}`, 60, 3_600_000))) throw new FalhaApi("limite_comunidade");
    const par = await tx.bloqueio.upsert({ where: { deId_paraId: { deId: quem, paraId: autor } }, create: { deId: quem, paraId: autor }, update: {}, select: { id: true } });
    await tx.seguir.deleteMany({ where: { OR: [{ seguidorId: quem, seguidoId: autor }, { seguidorId: autor, seguidoId: quem }] } });
    return { bloqueado: true, id: par.id };
  });
}

export async function bloqueados(quem: string) {
  const pares = await banco.bloqueio.findMany({ where: { deId: quem }, select: { id: true, para: { select: { perfilNome: true, perfilId: true, perfilModeracao: true } } }, orderBy: { id: "asc" } });
  return { itens: pares.map(p => ({ id: p.id, nome: p.para.perfilModeracao === "aprovado" ? p.para.perfilNome || "Pessoa" : "Pessoa", perfilId: p.para.perfilId })) };
}

export async function desbloquear(quem: string, id: string) {
  await banco.bloqueio.deleteMany({ where: { id, deId: quem } });
}

/** Uma mídia só integra a publicação com decisão própria e um vínculo ainda público para esta pessoa. */
export async function midiaVisivel(tipo: "foto" | "capa", token: string, quem: string | null) {
  const item = tipo === "foto"
    ? await banco.fotoPerfil.findUnique({ where: { token }, select: { usuarioId: true, moderacao: true } })
    : await banco.capaFoto.findUnique({ where: { token }, select: { usuarioId: true, planoId: true, moderacao: true } });
  if (!item) return false;
  if (item.usuarioId === quem) return true;
  if (item.moderacao !== "aprovado") return false;
  return Boolean(await banco.linkTrilha.findFirst({ where: { AND: [await filtroPublico(quem), { usuarioId: item.usuarioId, ...("planoId" in item ? { planoId: String(item.planoId) } : {}) }] }, select: { codigo: true } }));
}
