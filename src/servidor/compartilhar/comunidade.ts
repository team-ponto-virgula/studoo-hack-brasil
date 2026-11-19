import {
  CORES_PERFIL,
  FORMATO_CODIGO,
  LIMITES_COMUNIDADE,
  MOTIVOS_DENUNCIA,
  TEMAS,
  VISIBILIDADES,
  motivoLegendaInvalida,
  normalizarResumoPerfil,
  origemDemonstracao,
  type CartaoTrilha,
  type CorPerfil,
  type LinkCompartilhado,
  type PaginaExplorar,
  type PerfilPublico,
  type ResultadoValeu,
  type Tema,
} from "@studoo/contratos";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { ehEmailVisitante } from "@/servidor/acesso/visitante";
import { banco } from "@/servidor/banco/cliente";
import { revisarConteudo } from "./revisao";
import { contarSeguidores, estadoSeguir, seguidosPor } from "./seguir";
import { camposDono, demonstracaoVisivel, ehDeMaterial, lerTrilha, linkPublico, perfilPublico, type UsuarioDono } from "./servico";

/** Sem `STUDOO_COMUNIDADE_DEMO=1`, as trilhas de perfis de demonstração ficam fora do Explorar e do Em alta. */
const semDemonstracao = () => (demonstracaoVisivel() ? {} : { plano: { usuario: { perfilDemo: false } } });

/*
 * Comunidade (spec 10, etapa B): publicar no Explorar, "Em alta esta semana", Valeu e Denunciar. O "Em alta" ordena
 * trilhas (nunca pessoas): pontos dos últimos 7 dias = contas distintas que adicionaram × 3 + valeus × 1, só com 1
 * ponto ou mais, empate para a mais recente, em cache de 60 s. Respostas públicas sem e-mail, ids internos, objetivo
 * ou progresso.
 */

const LIMITES = {
  valeu: { quantidade: 60, janelaMs: 60 * 60_000 },
  denuncia: { quantidade: 10, janelaMs: 60 * 60_000 },
  publicar: { quantidade: 30, janelaMs: 60 * 60_000 },
} as const;
const CACHE_EM_ALTA_MS = 60_000;

const ehTema = (valor: unknown): valor is Tema => (TEMAS as readonly unknown[]).includes(valor);
const corValida = (valor: unknown): valor is CorPerfil => (CORES_PERFIL as readonly unknown[]).includes(valor);

async function limitar(escopo: string, { quantidade, janelaMs }: { quantidade: number; janelaMs: number }) {
  const dentro = await banco.$transaction((tx) => consumirLimite(tx, escopo, quantidade, janelaMs));
  if (!dentro) throw new FalhaApi("limite_comunidade");
}

/** Conta comum (não visitante), para agir: publicar, valeu e denunciar. */
async function contaQueAge(usuarioId: string) {
  const usuario = await banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true, perfilNome: true } });
  if (ehEmailVisitante(usuario.email)) throw new FalhaApi("compartilhar_visitante");
  return usuario;
}

/**
 * Muda o nível de visibilidade do link: "link", "perfil" ou "explorar" (que também mostra no perfil). Publicar pede o
 * perfil com nome, um tema e aceita a legenda (até 140); trilha feita de material não vai (`409 explorar_material`).
 */
export async function definirVisibilidade(usuarioId: string, codigo: string, entrada: unknown): Promise<LinkCompartilhado> {
  const { visibilidade, tema, legenda: legendaBruta } = (entrada ?? {}) as { visibilidade?: unknown; tema?: unknown; legenda?: unknown };
  if (!(VISIBILIDADES as readonly unknown[]).includes(visibilidade)) throw new FalhaApi("invalido");
  if (!FORMATO_CODIGO.test(codigo)) throw new FalhaApi("link_inativo");
  const link = await banco.linkTrilha.findUnique({ where: { codigo }, include: { plano: { select: { titulo: true } } } });
  if (!link || link.usuarioId !== usuarioId) throw new FalhaApi("link_inativo");
  if (visibilidade !== "explorar") {
    const alterado = await banco.linkTrilha.update({ where: { codigo }, data: { noPerfil: visibilidade === "perfil", noExplorar: false } });
    return linkPublico(alterado, link.plano.titulo);
  }
  if (!ehTema(tema)) throw new FalhaApi("invalido");
  if (legendaBruta !== undefined && (typeof legendaBruta !== "string" || legendaBruta.length > 600)) throw new FalhaApi("invalido");
  const legenda = typeof legendaBruta === "string" ? normalizarResumoPerfil(legendaBruta) : "";
  if (motivoLegendaInvalida(legenda)) throw new FalhaApi("invalido");
  const usuario = await contaQueAge(usuarioId);
  if (!usuario.perfilNome) throw new FalhaApi("perfil_incompleto");
  const trilha = await lerTrilha(usuarioId, link.planoId);
  if (!trilha) throw new FalhaApi("link_inativo");
  if (ehDeMaterial(trilha.fluxos.flatMap((fluxo) => fluxo.licoes))) throw new FalhaApi("explorar_material");
  await limitar(`comunidade:publicar:${usuarioId}`, LIMITES.publicar);
  if (legenda && !(await revisarConteudo({ tipo: "legenda", usuarioId, texto: legenda })).aprovado) throw new FalhaApi("conteudo_recusado");
  const alterado = await banco.linkTrilha.update({
    where: { codigo },
    data: { noPerfil: true, noExplorar: true, tema, legenda: legenda || null, ...(link.publicadaEm ? {} : { publicadaEm: new Date() }) },
  });
  zerarCacheEmAlta();
  return linkPublico(alterado, link.plano.titulo);
}

type LinkDoCartao = { codigo: string; usuarioId: string; planoId: string; tema: string | null; legenda: string | null; adicoes: number; publicadaEm: Date | null };
const camposLink = { codigo: true, usuarioId: true, planoId: true, tema: true, legenda: true, adicoes: true, publicadaEm: true } as const;

/**
 * Os cartões de uma lista de links, em poucas leituras: trilhas (título, origem, contagens), donos, valeus e, com
 * sessão, o que já é da pessoa. Todo link daqui está no perfil ou no Explorar, então o perfil do dono é público.
 */
export async function cartoesDe(links: LinkDoCartao[], quem: string | null): Promise<CartaoTrilha[]> {
  if (links.length === 0) return [];
  const codigos = links.map((link) => link.codigo);
  const [planos, donos, valeus, copias, meusValeus] = await Promise.all([
    banco.planoAprendizado.findMany({
      where: { OR: links.map((link) => ({ usuarioId: link.usuarioId, id: link.planoId })) },
      select: { usuarioId: true, id: true, titulo: true, origem: true, fluxos: { select: { _count: { select: { licoes: true } } } } },
    }),
    banco.usuario.findMany({ where: { id: { in: [...new Set(links.map((link) => link.usuarioId))] } }, select: camposDono }),
    banco.eventoTrilha.groupBy({ by: ["codigo"], where: { tipo: "valeu", codigo: { in: codigos } }, _count: { _all: true } }),
    quem ? banco.planoAprendizado.findMany({ where: { usuarioId: quem, origemCodigo: { in: codigos } }, select: { id: true, origemCodigo: true } }) : [],
    quem ? banco.eventoTrilha.findMany({ where: { usuarioId: quem, tipo: "valeu", codigo: { in: codigos } }, select: { codigo: true } }) : [],
  ]);
  const planoDe = new Map(planos.map((plano) => [`${plano.usuarioId}/${plano.id}`, plano]));
  const donoDe = new Map(donos.map((dono: UsuarioDono) => [dono.id, dono]));
  const valeusDe = new Map(valeus.map((grupo) => [grupo.codigo, grupo._count._all]));
  const copiaDe = new Map(copias.map((copia) => [copia.origemCodigo, copia.id]));
  const meus = new Set(meusValeus.map((evento) => evento.codigo));
  const cartoes: CartaoTrilha[] = [];
  for (const link of links) {
    const plano = planoDe.get(`${link.usuarioId}/${link.planoId}`);
    const dono = donoDe.get(link.usuarioId);
    if (!plano || !dono?.perfilNome) continue;
    const cartao: CartaoTrilha = {
      codigo: link.codigo,
      titulo: plano.titulo,
      tema: ehTema(link.tema) ? link.tema : null,
      legenda: link.legenda,
      totalLicoes: plano.fluxos.reduce((total, fluxo) => total + fluxo._count.licoes, 0),
      totalPartes: plano.fluxos.length,
      estudando: link.adicoes,
      valeus: valeusDe.get(link.codigo) ?? 0,
      dono: {
        nome: dono.perfilNome,
        cor: corValida(dono.perfilCor) ? dono.perfilCor : "azul",
        foto: dono.foto?.token ?? null,
        resumo: dono.perfilResumo || null,
        perfilId: dono.perfilId,
        ...(dono.perfilDemo ? { demo: true as const } : {}),
      },
      demonstracao: origemDemonstracao(plano.origem),
      publicadaEm: link.publicadaEm?.toISOString() ?? null,
    };
    if (quem) {
      const sua = link.usuarioId === quem;
      const copia = copiaDe.get(link.codigo);
      cartao.situacao = sua ? "sua" : copia ? "adicionada" : "nova";
      if (sua) cartao.planoId = link.planoId;
      else if (copia) cartao.planoId = copia;
      cartao.valeuMeu = meus.has(link.codigo);
    }
    cartoes.push(cartao);
  }
  return cartoes;
}

let emAltaCache: { em: number; lista: { codigo: string; tema: string | null; pontos: number }[] } | null = null;

/** Só para os testes (e ao publicar): o próximo pedido recalcula o "Em alta". */
export function zerarCacheEmAlta() {
  emAltaCache = null;
}

/**
 * A classificação da semana (todas as trilhas com 1 ponto ou mais, sem o corte do top 10), recalculada a cada 60 s no
 * máximo. Exportada para os testes conferirem pontos e ordem sem depender do que mais existe no banco.
 */
export async function classificacaoDaSemana() {
  if (emAltaCache && Date.now() - emAltaCache.em < CACHE_EM_ALTA_MS) return emAltaCache.lista;
  const desde = new Date(Date.now() - LIMITES_COMUNIDADE.janelaDias * 24 * 60 * 60_000);
  const grupos = await banco.eventoTrilha.groupBy({
    by: ["codigo", "tipo"],
    where: { criadoEm: { gte: desde }, link: { noExplorar: true, oculta: false, ...semDemonstracao() } },
    _count: { _all: true },
  });
  const pontos = new Map<string, number>();
  for (const grupo of grupos) {
    const peso = grupo.tipo === "adicao" ? LIMITES_COMUNIDADE.pesoAdicao : grupo.tipo === "valeu" ? LIMITES_COMUNIDADE.pesoValeu : 0;
    pontos.set(grupo.codigo, (pontos.get(grupo.codigo) ?? 0) + grupo._count._all * peso);
  }
  const links = pontos.size === 0 ? [] : await banco.linkTrilha.findMany({
    where: { codigo: { in: [...pontos.keys()] }, noExplorar: true, oculta: false, ...semDemonstracao() },
    select: { codigo: true, tema: true, publicadaEm: true },
  });
  const lista = links
    .map((link) => ({ codigo: link.codigo, tema: link.tema, pontos: pontos.get(link.codigo) ?? 0, quando: link.publicadaEm?.getTime() ?? 0 }))
    .filter((item) => item.pontos >= 1)
    // Mais pontos primeiro; empate vai para a mais recente.
    .sort((a, b) => b.pontos - a.pontos || b.quando - a.quando || (a.codigo < b.codigo ? 1 : -1))
    .map(({ codigo, tema, pontos: total }) => ({ codigo, tema, pontos: total }));
  emAltaCache = { em: Date.now(), lista };
  return lista;
}

/** O cursor de "Novas": data de publicação e código (desempate), em base64url. */
const cursorDe = (link: { publicadaEm: Date | null; codigo: string }) => Buffer.from(`${link.publicadaEm?.toISOString() ?? ""}|${link.codigo}`).toString("base64url");
function lerCursor(cursor: string): { em: Date; codigo: string } {
  const [iso, codigo] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const em = new Date(iso ?? "");
  if (!codigo || !FORMATO_CODIGO.test(codigo) || Number.isNaN(em.getTime())) throw new FalhaApi("invalido");
  return { em, codigo };
}

/** GET /api/explorar: "Em alta" (primeira página) e "Novas" (20 por página, por cursor), com filtro de tema. */
export async function explorar(quem: string | null, filtro: { tema?: string | null; cursor?: string | null; seguindo?: boolean }): Promise<PaginaExplorar> {
  const tema = filtro.tema || null;
  if (tema !== null && !ehTema(tema)) throw new FalhaApi("invalido");
  const cursor = filtro.cursor ? lerCursor(filtro.cursor) : null;
  // Aba "Seguindo": as trilhas publicadas por quem a pessoa segue, das mais novas para as mais antigas (sem Em alta).
  if (filtro.seguindo && !quem) throw new FalhaApi("nao_autenticado");
  const seguidos = filtro.seguindo && quem ? await seguidosPor(quem) : null;
  const pagina = await banco.linkTrilha.findMany({
    where: {
      noExplorar: true,
      oculta: false,
      publicadaEm: { not: null },
      ...semDemonstracao(),
      ...(tema ? { tema } : {}),
      ...(seguidos ? { usuarioId: { in: seguidos } } : {}),
      ...(cursor ? { OR: [{ publicadaEm: { lt: cursor.em } }, { publicadaEm: cursor.em, codigo: { lt: cursor.codigo } }] } : {}),
    },
    orderBy: [{ publicadaEm: "desc" }, { codigo: "desc" }],
    take: LIMITES_COMUNIDADE.porPagina + 1,
    select: camposLink,
  });
  const temMais = pagina.length > LIMITES_COMUNIDADE.porPagina;
  const novas = pagina.slice(0, LIMITES_COMUNIDADE.porPagina);
  let emAlta: CartaoTrilha[] = [];
  if (!cursor && !seguidos) {
    const top = (await classificacaoDaSemana()).filter((item) => !tema || item.tema === tema).slice(0, LIMITES_COMUNIDADE.emAlta);
    const linksTop = top.length === 0 ? [] : await banco.linkTrilha.findMany({ where: { codigo: { in: top.map((item) => item.codigo) }, noExplorar: true, oculta: false }, select: camposLink });
    const porCodigo = new Map(linksTop.map((link) => [link.codigo, link]));
    emAlta = await cartoesDe(top.map((item) => porCodigo.get(item.codigo)).filter((link): link is LinkDoCartao => Boolean(link)), quem);
  }
  return {
    emAlta,
    novas: await cartoesDe(novas, quem),
    cursor: temMais ? cursorDe(novas[novas.length - 1]) : null,
    ...(seguidos ? { seguindoAlguem: seguidos.length > 0 } : {}),
  };
}

/** O perfil público com os cartões (com a comunidade): as trilhas marcadas, como no Explorar. */
export async function perfilPublicoComCartoes(perfilId: string, quem: string | null): Promise<PerfilPublico> {
  const perfil = await perfilPublico(perfilId);
  const usuario = await banco.usuario.findUnique({ where: { perfilId }, select: { id: true } });
  if (!usuario) return perfil;
  const links = await banco.linkTrilha.findMany({ where: { usuarioId: usuario.id, noPerfil: true }, orderBy: { criadoEm: "desc" }, select: camposLink });
  const [cartoes, seguidores, seguir] = await Promise.all([cartoesDe(links, quem), contarSeguidores(usuario.id), estadoSeguir(quem, usuario.id)]);
  return { ...perfil, alcance: { ...perfil.alcance, seguidores }, cartoes, ...(seguir ? { seguir } : {}) };
}

/** Liga ou desliga o valeu (um por conta por trilha). Não vale na própria trilha nem em conta de visitante. */
export async function valeu(usuarioId: string, codigo: string, entrada: unknown): Promise<ResultadoValeu> {
  const { ativo } = (entrada ?? {}) as { ativo?: unknown };
  if (typeof ativo !== "boolean") throw new FalhaApi("invalido");
  if (!FORMATO_CODIGO.test(codigo)) throw new FalhaApi("link_inativo");
  // Vale em qualquer link ativo: quem recebeu só pelo link também pode agradecer.
  const link = await banco.linkTrilha.findUnique({ where: { codigo }, select: { usuarioId: true } });
  if (!link) throw new FalhaApi("link_inativo");
  if (link.usuarioId === usuarioId) throw new FalhaApi("trilha_propria");
  await contaQueAge(usuarioId);
  await limitar(`comunidade:valeu:${usuarioId}`, LIMITES.valeu);
  if (ativo) await banco.eventoTrilha.createMany({ data: [{ codigo, usuarioId, tipo: "valeu" }], skipDuplicates: true });
  else await banco.eventoTrilha.deleteMany({ where: { codigo, usuarioId, tipo: "valeu" } });
  const valeus = await banco.eventoTrilha.count({ where: { codigo, tipo: "valeu" } });
  return { valeus, valeuMeu: ativo };
}

/**
 * Denuncia uma trilha (código) ou um perfil (id público): motivo da lista; uma por conta por alvo (repetir não conta
 * de novo); 10 por hora. Com 3 contas distintas, a trilha sai do Explorar até revisão. Registro no banco e uma linha no
 * log; sem painel.
 */
export async function denunciar(usuarioId: string, entrada: unknown): Promise<{ registrada: true }> {
  const { alvoTipo, alvo, motivo } = (entrada ?? {}) as { alvoTipo?: unknown; alvo?: unknown; motivo?: unknown };
  if ((alvoTipo !== "trilha" && alvoTipo !== "perfil") || typeof alvo !== "string" || !FORMATO_CODIGO.test(alvo)
    || !(MOTIVOS_DENUNCIA as readonly unknown[]).includes(motivo)) throw new FalhaApi("invalido");
  if (alvoTipo === "trilha") {
    const link = await banco.linkTrilha.findUnique({ where: { codigo: alvo }, select: { usuarioId: true } });
    if (!link) throw new FalhaApi("link_inativo");
    if (link.usuarioId === usuarioId) throw new FalhaApi("trilha_propria");
  } else {
    const dono = await banco.usuario.findUnique({ where: { perfilId: alvo }, select: { id: true } });
    if (!dono) throw new FalhaApi("nao_encontrado");
    if (dono.id === usuarioId) throw new FalhaApi("trilha_propria");
  }
  await contaQueAge(usuarioId);
  await limitar(`comunidade:denuncia:${usuarioId}`, LIMITES.denuncia);
  await banco.denuncia.createMany({ data: [{ alvoTipo, alvo, usuarioId, motivo: motivo as string }], skipDuplicates: true });
  const total = await banco.denuncia.count({ where: { alvoTipo, alvo } });
  let ocultou = false;
  if (alvoTipo === "trilha" && total >= LIMITES_COMUNIDADE.denunciasParaOcultar) {
    ocultou = (await banco.linkTrilha.updateMany({ where: { codigo: alvo, oculta: false }, data: { oculta: true } })).count > 0;
    if (ocultou) zerarCacheEmAlta();
  }
  // Uma linha no log, sem e-mail nem id de quem denunciou.
  console.info(JSON.stringify({ evento: "denuncia", alvoTipo, alvo, motivo, total, ocultou }));
  return { registrada: true };
}
