import { origemDoConteudo } from "@/dominio/aprendizado/plano";
import { banco } from "@/servidor/banco/cliente";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { ehEmailVisitante } from "@/servidor/acesso/visitante";
import { conteudoValido } from "@/dominio/aprendizado/plano";
import { conteudoParaCopia, ehDeMaterial, lerTrilha } from "./servico";

const uuid = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;
const estados = { aberto: "Recebido", encerrado: "Respondido" };

async function limitar(rede: string, acao: string, quantidade: number) {
  const dentro = await banco.$transaction(tx => consumirLimite(tx, `atendimento:${acao}:${rede}`, quantidade, 3_600_000));
  if (!dentro) throw new FalhaApi("limite_comunidade");
}

export async function pedirAjuda(mensagem: unknown, rede: string) {
  if (typeof mensagem !== "string" || mensagem.trim().length < 5 || mensagem.length > 2000) throw new FalhaApi("invalido");
  await limitar(rede, "enviar", 10);
  const caso = await banco.atendimento.create({ data: { mensagem: mensagem.trim() }, select: { id: true } });
  return { protocolo: caso.id };
}

export async function acompanhar(protocolo: unknown, rede: string) {
  if (typeof protocolo !== "string" || !uuid.test(protocolo)) throw new FalhaApi("nao_encontrado");
  await limitar(rede, "consulta", 120);
  const select = { estado: true, resposta: true, criadoEm: true } as const;
  const caso = await banco.atendimento.findUnique({ where: { id: protocolo }, select })
    ?? await banco.denuncia.findUnique({ where: { id: protocolo }, select });
  if (!caso) throw new FalhaApi("nao_encontrado");
  return { protocolo, estado: estados[caso.estado as keyof typeof estados] || "Em análise", resposta: caso.resposta, criadoEm: caso.criadoEm };
}

export async function daEquipe(id: string | null) {
  if (!id) return false;
  const emails = (process.env.STUDOO_EQUIPE_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  if (!emails.length) return false;
  const u = await banco.usuario.findUnique({ where: { id }, select: { email: true, perfilDemo: true } });
  return Boolean(u && !u.perfilDemo && !ehEmailVisitante(u.email) && emails.includes(u.email.toLowerCase()));
}
export async function exigirEquipe(id: string | null) {
  if (!(await daEquipe(id))) throw new FalhaApi("nao_encontrado");
}

export type TipoRevisao = "perfil" | "trilha" | "foto" | "capa";
const paginaTamanho = 24;

export async function caixa(operador: string, pagina: number) {
  await exigirEquipe(operador);
  if (!Number.isSafeInteger(pagina) || pagina < 0 || pagina > 100000) throw new FalhaApi("invalido");
  const pag = { skip: pagina * paginaTamanho, take: paginaTamanho };
  const [perfis, links, fotos, capas, pedidos, grupos, historico] = await Promise.all([
    banco.usuario.findMany({ where: { perfilModeracao: "pendente", perfilId: { not: null }, planos: { some: { links: { some: {} } } } }, select: { perfilId: true, perfilNome: true, perfilRevisao: true }, orderBy: { id: "asc" }, ...pag }),
    banco.linkTrilha.findMany({ where: { moderacao: "pendente" }, select: { codigo: true, revisao: true, plano: { select: { titulo: true, usuario: { select: { perfilNome: true } } } } }, orderBy: { criadoEm: "asc" }, ...pag }),
    banco.fotoPerfil.findMany({ where: { moderacao: "pendente" }, select: { token: true, usuario: { select: { perfilNome: true } } }, orderBy: { criadaEm: "asc" }, ...pag }),
    banco.capaFoto.findMany({ where: { moderacao: "pendente" }, select: { token: true, plano: { select: { titulo: true, usuario: { select: { perfilNome: true } } } } }, orderBy: { criadaEm: "asc" }, ...pag }),
    banco.atendimento.findMany({ where: { estado: "aberto" }, orderBy: { criadoEm: "asc" }, ...pag }),
    banco.denuncia.groupBy({ by: ["alvoTipo", "alvo"], where: { estado: "aberto" }, _count: { _all: true }, _min: { criadoEm: true }, _max: { criadoEm: true }, orderBy: [{ alvoTipo: "asc" }, { alvo: "asc" }], ...pag }),
    banco.decisaoModeracao.findMany({ orderBy: { criadoEm: "desc" }, ...pag }),
  ]);
  const motivos = grupos.length ? await banco.denuncia.groupBy({ by: ["alvoTipo", "alvo", "motivo"], where: { estado: "aberto", OR: grupos.map(g => ({ alvo: g.alvo, alvoTipo: g.alvoTipo })) }, _count: { _all: true } }) : [];
  return {
    itens: [
      ...perfis.map(p => ({ tipo: "perfil", alvo: p.perfilId!, titulo: p.perfilNome, dono: p.perfilNome })),
      ...links.map(l => ({ tipo: "trilha", alvo: l.codigo, titulo: l.plano.titulo, dono: l.plano.usuario.perfilNome })),
      ...fotos.map(f => ({ tipo: "foto", alvo: f.token, titulo: "Foto de perfil", dono: f.usuario.perfilNome })),
      ...capas.map(c => ({ tipo: "capa", alvo: c.token, titulo: c.plano.titulo, dono: c.plano.usuario.perfilNome })),
    ],
    denuncias: grupos.map(g => ({ tipo: g.alvoTipo, alvo: g.alvo, total: g._count._all, primeira: g._min.criadoEm, ultima: g._max.criadoEm,
      motivos: motivos.filter(m => m.alvo === g.alvo && m.alvoTipo === g.alvoTipo).map(m => ({ motivo: m.motivo, total: m._count._all })) })),
    pedidos, historico, mais: [perfis, links, fotos, capas, pedidos, grupos, historico].some(a => a.length === paginaTamanho),
  };
}

export async function detalhe(operador: string, tipo: unknown, alvo: string) {
  await exigirEquipe(operador);
  if (tipo === "perfil") {
    const p = await banco.usuario.findUnique({ where: { perfilId: alvo }, select: { perfilNome: true, perfilResumo: true, perfilRevisao: true, perfilModeracao: true } });
    if (p) return { versao: p.perfilRevisao, estado: p.perfilModeracao, texto: [p.perfilNome,p.perfilResumo].filter(Boolean).join("\n") };
  } else if (tipo === "trilha") {
    const link = await banco.linkTrilha.findUnique({ where: { codigo: alvo } });
    const p = link && await lerTrilha(link.usuarioId, link.planoId);
    if (p && link) return { versao: link.revisao, estado: link.moderacao, texto: JSON.stringify({ titulo: p.titulo, descricao: p.descricao, legenda: link.legenda, origem: ehDeMaterial(p.fluxos.flatMap(f => f.licoes)) ? "Material do autor" : origemDoConteudo(p.origem),
      partes: p.fluxos.map(f => ({ titulo: f.titulo, licoes: f.licoes.map(l => ({ titulo: l.titulo, conteudo: conteudoValido(l.conteudo) ? conteudoParaCopia(l.conteudo, "autor") : null })) })) }, null, 2) };
  } else if (tipo === "foto" || tipo === "capa") {
    const item = tipo === "foto" ? await banco.fotoPerfil.findUnique({ where: { token: alvo }, select: { moderacao: true } }) : await banco.capaFoto.findUnique({ where: { token: alvo }, select: { moderacao: true } });
    if (item) return { versao: 1, estado: item.moderacao, texto: tipo === "foto" ? "Foto de perfil" : "Capa", imagem: `/api/equipe/moderacao/midia?tipo=${tipo}&alvo=${encodeURIComponent(alvo)}` };
  } else throw new FalhaApi("invalido");
  // Quem publicou pode ter retirado o conteúdo depois da denúncia.
  return { versao: 0, estado: "retirado", texto: "Quem publicou retirou este conteúdo." };
}

export async function midiaDaEquipe(operador: string, tipo: string | null, alvo: string) {
  await exigirEquipe(operador);
  const f = tipo === "foto" ? await banco.fotoPerfil.findUnique({ where: { token: alvo }, select: { grande: true } })
    : tipo === "capa" ? await banco.capaFoto.findUnique({ where: { token: alvo }, select: { grande: true } }) : null;
  if (!f) throw new FalhaApi("nao_encontrado");
  return new Uint8Array(f.grande);
}

export async function decidir(operadorId: string, entrada: unknown) {
  await exigirEquipe(operadorId);
  const { tipo, alvo, acao, versao, resposta } = (entrada ?? {}) as Record<string, unknown>;
  if (typeof alvo !== "string" || typeof tipo !== "string" || typeof acao !== "string") throw new FalhaApi("invalido");
  const mensagem = typeof resposta === "string" ? resposta.trim() : "";
  if (mensagem.length > 2000) throw new FalhaApi("invalido");
  await banco.$transaction(async tx => {
    if (tipo === "atendimento" && acao === "responder") {
      if (!mensagem || !uuid.test(alvo)) throw new FalhaApi("invalido");
      const caso = await tx.atendimento.updateMany({ where: { id: alvo, estado: "aberto" }, data: { estado: "encerrado", resposta: mensagem } });
      if (!caso.count) throw new FalhaApi("nao_encontrado");
    } else {
      if (!["aprovar","manter","remover","arquivar"].includes(acao) || !["perfil","trilha","foto","capa"].includes(tipo) || typeof versao !== "number" || !Number.isSafeInteger(versao)) throw new FalhaApi("invalido");
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${tipo + ":" + alvo}))`;
      const moderacao = acao === "remover" ? "recusado" : "aprovado";
      if (acao === "arquivar") {
        const existe = tipo === "trilha" ? await tx.linkTrilha.count({ where: { codigo: alvo } }) : await tx.usuario.count({ where: { perfilId: alvo } });
        if (versao !== 0 || existe || !["trilha","perfil"].includes(tipo)) throw new FalhaApi("invalido");
      } else {
        const item = tipo === "trilha" ? await tx.linkTrilha.updateMany({ where: { codigo: alvo, revisao: versao }, data: { moderacao, oculta: false, revisao: { increment: 1 } } })
          : tipo === "perfil" ? await tx.usuario.updateMany({ where: { perfilId: alvo, perfilRevisao: versao }, data: { perfilModeracao: moderacao, perfilRevisao: { increment: 1 } } })
          : tipo === "foto" ? await tx.fotoPerfil.updateMany({ where: { token: alvo }, data: { moderacao } })
          : await tx.capaFoto.updateMany({ where: { token: alvo }, data: { moderacao } });
        if (!item.count) throw new FalhaApi("invalido");
      }
      const retorno = mensagem || (acao === "remover" ? "A equipe retirou a publicação." : acao === "arquivar" ? "A publicação já foi retirada." : "A equipe revisou e manteve a publicação.");
      await tx.denuncia.updateMany({ where: { alvoTipo: tipo, alvo, estado: "aberto" }, data: { resposta: retorno, estado: "encerrado" } });
    }
    await tx.decisaoModeracao.create({ data: { operadorId, tipo, alvo, acao } });
  });
  return { salvo: true };
}
