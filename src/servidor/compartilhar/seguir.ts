import {
  CORES_PERFIL,
  FORMATO_CODIGO,
  type CorPerfil,
  type EstadoSeguir,
  type Novidade,
  type Novidades,
  type PessoaNovidade,
  type ResultadoSeguir,
} from "@studoo/contratos";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { ehEmailVisitante } from "@/servidor/acesso/visitante";
import { banco } from "@/servidor/banco/cliente";
import { demonstracaoVisivel } from "./servico";

/*
 * Seguir e Novidades (spec 10, etapa C2). Seguir só perfil público (ao menos uma trilha no perfil); ninguém segue a
 * si mesmo; conta de visitante não segue; perfil de demonstração pode ser seguido, mas não segue ninguém. Só a
 * contagem de seguidores é pública: nunca a lista. Sem notificação: as Novidades da dona contam os novos da semana.
 */

const LIMITE_SEGUIR = { quantidade: 60, janelaMs: 60 * 60_000 } as const;
const SEMANA_MS = 7 * 24 * 60 * 60_000;
const corValida = (valor: unknown): valor is CorPerfil => (CORES_PERFIL as readonly unknown[]).includes(valor);

export const contarSeguidores = (usuarioId: string) => banco.seguir.count({ where: { seguidoId: usuarioId } });

/** Quem pode seguir: conta comum, que não é perfil de demonstração. */
async function podeAgir(usuarioId: string) {
  const quem = await banco.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, perfilDemo: true } });
  return Boolean(quem && !ehEmailVisitante(quem.email) && !quem.perfilDemo);
}

/** O estado do botão Seguir para quem está logado (null sem sessão). */
export async function estadoSeguir(quem: string | null, alvoId: string): Promise<EstadoSeguir | undefined> {
  if (!quem) return undefined;
  if (quem === alvoId || !(await podeAgir(quem))) return { seguindo: false, podeSeguir: false };
  const existe = await banco.seguir.findUnique({ where: { seguidorId_seguidoId: { seguidorId: quem, seguidoId: alvoId } }, select: { criadoEm: true } });
  return { seguindo: Boolean(existe), podeSeguir: true };
}

/** Seguir ou deixar de seguir `{ ativo }` pelo id público do perfil. */
export async function seguir(usuarioId: string, perfilId: string, entrada: unknown): Promise<ResultadoSeguir> {
  const { ativo } = (entrada ?? {}) as { ativo?: unknown };
  if (typeof ativo !== "boolean") throw new FalhaApi("invalido");
  if (!FORMATO_CODIGO.test(perfilId)) throw new FalhaApi("nao_encontrado");
  const alvo = await banco.usuario.findUnique({ where: { perfilId }, select: { id: true, perfilNome: true, perfilDemo: true } });
  const publico = alvo?.perfilNome && (await banco.linkTrilha.count({ where: { usuarioId: alvo.id, noPerfil: true } })) > 0;
  if (!alvo || !publico || (alvo.perfilDemo && !demonstracaoVisivel())) throw new FalhaApi("nao_encontrado");
  const quem = await banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true, perfilDemo: true } });
  if (ehEmailVisitante(quem.email)) throw new FalhaApi("compartilhar_visitante");
  if (alvo.id === usuarioId || quem.perfilDemo) throw new FalhaApi("seguir_invalido");
  const dentro = await banco.$transaction((tx) => consumirLimite(tx, `comunidade:seguir:${usuarioId}`, LIMITE_SEGUIR.quantidade, LIMITE_SEGUIR.janelaMs));
  if (!dentro) throw new FalhaApi("limite_comunidade");
  if (ativo) await banco.seguir.createMany({ data: [{ seguidorId: usuarioId, seguidoId: alvo.id }], skipDuplicates: true });
  else await banco.seguir.deleteMany({ where: { seguidorId: usuarioId, seguidoId: alvo.id } });
  return { seguindo: ativo, seguidores: await contarSeguidores(alvo.id) };
}

/** Os ids de quem a pessoa segue (para a aba "Seguindo" do Explorar). */
export async function seguidosPor(usuarioId: string): Promise<string[]> {
  return (await banco.seguir.findMany({ where: { seguidorId: usuarioId }, select: { seguidoId: true } })).map((s) => s.seguidoId);
}

type UsuarioPessoa = { id: string; perfilNome: string | null; perfilCor: string | null; perfilId: string | null; foto: { token: string } | null };
const camposPessoa = { id: true, perfilNome: true, perfilCor: true, perfilId: true, foto: { select: { token: true } } } as const;

/** Separa quem tem perfil público (nome e foto) do resto ("alguém"). */
async function pessoasPublicas(usuarios: UsuarioPessoa[]): Promise<{ pessoas: PessoaNovidade[]; outros: number }> {
  if (usuarios.length === 0) return { pessoas: [], outros: 0 };
  const publicos = new Set((await banco.linkTrilha.findMany({ where: { usuarioId: { in: usuarios.map((u) => u.id) }, noPerfil: true }, select: { usuarioId: true }, distinct: ["usuarioId"] })).map((l) => l.usuarioId));
  const pessoas: PessoaNovidade[] = [];
  let outros = 0;
  for (const u of usuarios) {
    if (u.perfilNome && u.perfilId && publicos.has(u.id)) pessoas.push({ nome: u.perfilNome, cor: corValida(u.perfilCor) ? u.perfilCor : "azul", foto: u.foto?.token ?? null, perfilId: u.perfilId });
    else outros += 1;
  }
  return { pessoas, outros };
}

/**
 * As Novidades da dona: o que aconteceu com as trilhas dela nos últimos 7 dias, agrupado. Adição só pela contagem;
 * valeu e seguir com nome e foto de quem tem perfil público, e "alguém" para o resto. Mais recentes primeiro.
 */
export async function novidades(usuarioId: string, agora = new Date()): Promise<Novidades> {
  const desde = new Date(agora.getTime() - SEMANA_MS);
  const eventos = await banco.eventoTrilha.findMany({
    where: { criadoEm: { gte: desde }, link: { usuarioId }, usuarioId: { not: usuarioId } },
    orderBy: { criadoEm: "desc" },
    select: { tipo: true, criadoEm: true, link: { select: { planoId: true, plano: { select: { titulo: true } } } }, usuario: { select: camposPessoa } },
  });
  const itens: Novidade[] = [];
  const porTrilha = new Map<string, { titulo: string; adicoes: Date[]; valeus: { em: Date; usuario: UsuarioPessoa }[] }>();
  for (const e of eventos) {
    const grupo = porTrilha.get(e.link.planoId) ?? { titulo: e.link.plano.titulo, adicoes: [], valeus: [] };
    if (e.tipo === "adicao") grupo.adicoes.push(e.criadoEm);
    else if (e.tipo === "valeu") grupo.valeus.push({ em: e.criadoEm, usuario: e.usuario });
    porTrilha.set(e.link.planoId, grupo);
  }
  for (const [planoId, grupo] of porTrilha) {
    if (grupo.adicoes.length > 0) itens.push({ tipo: "adicoes", planoId, titulo: grupo.titulo, quantidade: grupo.adicoes.length, em: grupo.adicoes[0].toISOString() });
    if (grupo.valeus.length > 0) itens.push({ tipo: "valeus", planoId, titulo: grupo.titulo, ...(await pessoasPublicas(grupo.valeus.map((v) => v.usuario))), em: grupo.valeus[0].em.toISOString() });
  }
  const novos = await banco.seguir.findMany({ where: { seguidoId: usuarioId, criadoEm: { gte: desde } }, orderBy: { criadoEm: "desc" }, select: { criadoEm: true, seguidor: { select: camposPessoa } } });
  if (novos.length > 0) itens.push({ tipo: "seguidores", ...(await pessoasPublicas(novos.map((n) => n.seguidor))), em: novos[0].criadoEm.toISOString() });
  itens.sort((a, b) => b.em.localeCompare(a.em));
  return { itens };
}
