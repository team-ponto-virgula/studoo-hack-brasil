import { origemDoConteudo } from "@/dominio/aprendizado/plano";
import { randomBytes, randomUUID } from "node:crypto";
import {
  CORES_PERFIL,
  FORMATO_CODIGO,
  LIMITES_PERFIL,
  MATERIAL_COMPARTILHADO,
  interessesValidos,
  motivoNomeInvalido,
  motivoResumoInvalido,
  normalizarNomePerfil,
  normalizarResumoPerfil,
  origemDemonstracao,
  sugerirTema,
  TEMAS,
  type Tema,
  type Visibilidade,
  type CorPerfil,
  type DonoPublico,
  type LinkCompartilhado,
  type Perfil,
  type PerfilPublico,
  type PreviaCompartilhar,
  type TrilhaAdicionada,
  type TrilhaCompartilhada,
} from "@studoo/contratos";
import { conteudoValido, type ConteudoLicao } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { ehEmailVisitante } from "@/servidor/acesso/visitante";
import { banco } from "@/servidor/banco/cliente";
import { exigirParLivre, filtroPublico } from "./visibilidade";
import { revisarConteudo } from "./revisao";
import type { Prisma } from "@/servidor/banco/gerado/client";

/*
 * Perfis leves e compartilhar trilha (spec 09). Compartilhar é dar uma cópia: o link mostra uma prévia e quem adiciona
 * recebe a trilha pronta (sem geração, sem IA), com progresso do zero. Nada do estudo de quem compartilhou vai junto, e
 * a cópia não aponta para nenhum registro dela. Respostas públicas nunca trazem e-mail, id de usuário, objetivo
 * digitado nem progresso.
 */

/** Teto de links ativos por conta. */
export const LINKS_ATIVOS_MAX = 20;
const LIMITES = {
  /** Rotas públicas (prévia e perfil), por endereço de rede, quando o endereço é confiável (atrás do proxy HTTPS). */
  publico: { quantidade: 120, janelaMs: 15 * 60_000 },
  /**
   * Sem endereço confiável ("loopback" ou "desconhecido", como no site sem `STUDOO_PROXY_HTTPS=1`), todos caem no mesmo
   * balde: ele vira um disjuntor global, com teto bem mais alto, para uma plateia (e os robôs de prévia dos apps de
   * mensagem) abrindo o mesmo link não travar os links de todo mundo.
   */
  publicoGlobal: { quantidade: 3000, janelaMs: 15 * 60_000 },
  criar: { quantidade: 20, janelaMs: 60 * 60_000 },
  adicionar: { quantidade: 30, janelaMs: 60 * 60_000 },
  perfil: { quantidade: 30, janelaMs: 60 * 60_000 },
} as const;

export function compartilharAtivo(): boolean {
  return process.env.STUDOO_COMPARTILHAR === "1";
}

/** Comunidade (spec 10, etapa B): só com as duas flags. */
export function comunidadeAtiva(): boolean {
  return compartilharAtivo() && process.env.STUDOO_COMUNIDADE === "1";
}

export function exigirComunidade(): void {
  if (!comunidadeAtiva()) throw new FalhaApi("nao_encontrado");
}

export const visibilidadeDe = (link: { noPerfil: boolean; noExplorar?: boolean }): Visibilidade =>
  link.noExplorar ? "explorar" : link.noPerfil ? "perfil" : "link";

/** Sem a flag, nenhuma rota nova existe: responde como rota desconhecida. */
export function exigirCompartilhar(): void {
  if (!compartilharAtivo()) throw new FalhaApi("nao_encontrado");
}

/** 96 bits aleatórios em base64url (16 caracteres), sem relação com ids internos. */
const novoCodigo = () => randomBytes(12).toString("base64url");

const ehTemaValido = (valor: unknown): valor is Tema => (TEMAS as readonly unknown[]).includes(valor);

const corValida = (valor: unknown): valor is CorPerfil => (CORES_PERFIL as readonly unknown[]).includes(valor);

async function limitar(escopo: string, { quantidade, janelaMs }: { quantidade: number; janelaMs: number }) {
  const dentro = await banco.$transaction((tx) => consumirLimite(tx, escopo, quantidade, janelaMs));
  if (!dentro) throw new FalhaApi("limite_compartilhar");
}

export const limitarPublico = (rede: string) =>
  rede === "loopback" || rede === "desconhecido"
    ? limitar("compartilhar:global", LIMITES.publicoGlobal)
    : limitar(`compartilhar:ip:${rede}`, LIMITES.publico);

function validarCodigo(codigo: string) {
  // Código fora do formato responde igual a link encerrado ou inexistente.
  if (!FORMATO_CODIGO.test(codigo)) throw new FalhaApi("link_inativo");
}

type LinkGuardado = { moderacao?: LinkCompartilhado['moderacao']; codigo: string; planoId: string; criadoEm: Date; adicoes: number; noPerfil: boolean; noExplorar?: boolean; tema?: string | null; legenda?: string | null };

export const linkPublico = (link: LinkGuardado, titulo: string, valeus?: number): LinkCompartilhado => ({
  codigo: link.codigo,
  moderacao: link.moderacao,
  planoId: link.planoId,
  titulo,
  criadoEm: link.criadoEm.toISOString(),
  adicoes: link.adicoes,
  noPerfil: link.noPerfil,
  // Com a comunidade: o nível, o tema e a legenda (e os valeus, quando quem chama conta).
  ...(comunidadeAtiva() ? {
    visibilidade: visibilidadeDe(link),
    tema: (link.tema as Tema | null | undefined) ?? null,
    legenda: link.legenda ?? null,
    ...(valeus !== undefined ? { valeus } : {}),
  } : {}),
});

/** O perfil é público quando ao menos uma trilha está marcada para aparecer nele. */
async function perfilEhPublico(usuarioId: string, quem: string | null) {
  return (await banco.linkTrilha.count({ where: { AND: [await filtroPublico(quem), { usuarioId, noPerfil: true }] } })) > 0;
}

/** O que entra na leitura do usuário para montar o dono público (nome, cor, foto, resumo). */
export const camposDono = { id: true, perfilRevisao: true, perfilNome: true, perfilCor: true, perfilId: true, perfilResumo: true, perfilDemo: true, foto: { select: { token: true, moderacao: true } } } as const;
export type UsuarioDono = { id: string; perfilRevisao: number; perfilNome: string | null; perfilCor: string | null; perfilId: string | null; perfilResumo: string | null; perfilDemo: boolean; foto: { token: string; moderacao: string } | null };

/**
 * Conteúdo de demonstração (spec 10, etapa C): só aparece com `STUDOO_COMUNIDADE_DEMO=1`. Sem a flag, perfis e trilhas
 * de demonstração somem do Explorar, do Em alta, do /p e do /t (sem apagar nada).
 */
export function demonstracaoVisivel(): boolean {
  return process.env.STUDOO_COMUNIDADE_DEMO === "1";
}

async function donoPublico(usuario: UsuarioDono, quem: string | null): Promise<DonoPublico> {
  return {
    nome: usuario.perfilNome ?? "",
    cor: corValida(usuario.perfilCor) ? usuario.perfilCor : "azul",
    foto: usuario.foto?.moderacao === 'aprovado' ? usuario.foto.token : null,
    resumo: usuario.perfilResumo || null,
    perfilId: usuario.perfilId && (await perfilEhPublico(usuario.id, quem)) ? usuario.perfilId : null,
    ...(usuario.perfilDemo ? { demo: true as const } : {}),
  };
}

/** Só temas conhecidos, na ordem da lista (o banco guarda texto). */
const temasGuardados = (valores: string[]): Tema[] => interessesValidos(valores.slice(0, LIMITES_PERFIL.interessesMax)) ?? [];

const alcanceDe = (links: { adicoes: number }[]) => ({ trilhas: links.length, pessoas: links.reduce((total, link) => total + link.adicoes, 0) });

export async function obterPerfil(usuarioId: string): Promise<Perfil> {
  const usuario = await banco.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { email: true, perfilModeracao: true, perfilNome: true, perfilCor: true, perfilId: true, perfilResumo: true, perfilInteresses: true, foto: { select: { token: true, moderacao: true } } },
  });
  const links = await banco.linkTrilha.findMany({
    where: { usuarioId },
    orderBy: { criadoEm: "desc" },
    select: { codigo: true, planoId: true, criadoEm: true, adicoes: true, moderacao: true, noPerfil: true, noExplorar: true, tema: true, legenda: true, plano: { select: { titulo: true } } },
  });
  const valeus = comunidadeAtiva() && links.length > 0
    ? new Map((await banco.eventoTrilha.groupBy({ by: ["codigo"], where: { tipo: "valeu", codigo: { in: links.map((link) => link.codigo) } }, _count: { _all: true } }))
      .map((grupo) => [grupo.codigo, grupo._count._all]))
    : null;
  return {
    nome: usuario.perfilNome,
    cor: corValida(usuario.perfilCor) ? usuario.perfilCor : null,
    resumo: usuario.perfilResumo || null,
    interesses: temasGuardados(usuario.perfilInteresses),
    foto: usuario.foto?.token ?? null,
    perfilModeracao: usuario.perfilModeracao,
    fotoModeracao: usuario.foto?.moderacao ?? null,
    // O mesmo alcance da página pública (só as trilhas no perfil): o total, com as só por link, fica no título da lista.
    alcance: { ...alcanceDe(links.filter((link) => link.noPerfil)), ...(comunidadeAtiva() ? { seguidores: await banco.seguir.count({ where: { seguidoId: usuarioId } }) } : {}) },
    perfilId: usuario.perfilId,
    publico: usuario.perfilModeracao === "aprovado" && links.some((link) => link.noPerfil && link.moderacao === "aprovado"),
    email: usuario.email,
    visitante: ehEmailVisitante(usuario.email),
    links: links.map((link) => linkPublico(link, link.plano.titulo, valeus ? valeus.get(link.codigo) ?? 0 : undefined)),
  };
}

/**
 * Salva nome e cor e, quando vierem, resumo e interesses (sem eles, o que já existe fica: o app antigo só manda nome e
 * cor). Resumo vazio apaga o resumo.
 */
export async function salvarPerfil(usuarioId: string, entrada: unknown): Promise<Perfil> {
  const { nome: bruto, cor, resumo: resumoBruto, interesses: interessesBrutos } = (entrada ?? {}) as { nome?: unknown; cor?: unknown; resumo?: unknown; interesses?: unknown };
  if (typeof bruto !== "string" || bruto.length > 200 || !corValida(cor)) throw new FalhaApi("invalido");
  const nome = normalizarNomePerfil(bruto);
  if (motivoNomeInvalido(nome)) throw new FalhaApi("invalido");
  if (resumoBruto !== undefined && (typeof resumoBruto !== "string" || resumoBruto.length > 800)) throw new FalhaApi("invalido");
  const resumo = typeof resumoBruto === "string" ? normalizarResumoPerfil(resumoBruto) : undefined;
  if (resumo && motivoResumoInvalido(resumo)) throw new FalhaApi("invalido");
  const interesses = interessesBrutos === undefined ? undefined : interessesValidos(interessesBrutos);
  if (interesses === null) throw new FalhaApi("invalido");
  const usuario = await banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true, perfilId: true } });
  if (ehEmailVisitante(usuario.email)) throw new FalhaApi("compartilhar_visitante");
  await limitar(`perfil:${usuarioId}`, LIMITES.perfil);
  // Triagem local antes de enviar a nova versão do perfil à equipe.
  for (const [tipo, texto] of [["nome", nome], ["resumo", resumo ?? ""]] as const) {
    if (texto && !(await revisarConteudo({ tipo, usuarioId, texto })).aprovado) throw new FalhaApi("conteudo_recusado");
  }
  await banco.usuario.update({
    where: { id: usuarioId },
    data: {
      perfilNome: nome,
      perfilCor: cor,
      ...(resumo !== undefined ? { perfilResumo: resumo || null } : {}),
      ...(interesses !== undefined ? { perfilInteresses: interesses } : {}),
      ...(usuario.perfilId ? {} : { perfilId: novoCodigo() }),
    },
  });
  return obterPerfil(usuarioId);
}

type LicaoComConteudo = { titulo: string; conteudo: Prisma.JsonValue };

/** Lições da trilha, em ordem, com o conteúdo (para a prévia e para a cópia). */
export async function lerTrilha(usuarioId: string, planoId: string) {
  return banco.planoAprendizado.findUnique({
    where: { usuarioId_id: { usuarioId, id: planoId } },
    select: {
      id: true,
      titulo: true,
      origem: true,
      origemCodigo: true,
      capa: true,
      capaFoto: { select: { moderacao: true } },
      descricao: true,
      tema: true,
      fluxos: {
        orderBy: { ordem: "asc" },
        select: { titulo: true, licoes: { orderBy: { ordem: "asc" }, select: { titulo: true, conteudo: true } } },
      },
    },
  });
}

const referenciasDe = (licao: LicaoComConteudo) =>
  conteudoValido(licao.conteudo) ? licao.conteudo.referencias ?? [] : [];

/** Trilha feita de material: alguma lição traz referência ao material. */
export const ehDeMaterial = (licoes: LicaoComConteudo[]) => licoes.some((licao) => referenciasDe(licao).length > 0);

/** O título traz o nome do arquivo (com ou sem a extensão), como no caso "Estudar <arquivo>". */
function tituloTemNomeDoArquivo(titulo: string, licoes: LicaoComConteudo[]) {
  const comparavel = titulo.toLocaleLowerCase("pt-BR");
  return licoes.some((licao) => referenciasDe(licao).some(({ nome, materialId }) => {
    if (materialId === MATERIAL_COMPARTILHADO) return false;
    const arquivo = nome.trim().toLocaleLowerCase("pt-BR");
    const semExtensao = arquivo.replace(/\.[a-z0-9]{1,5}$/, "");
    return Boolean(arquivo) && (comparavel.includes(arquivo) || (semExtensao.length >= 3 && comparavel.includes(semExtensao)));
  }));
}

const rotuloMaterial = (nome: string) => `Material de ${nome}`;

/**
 * O conteúdo de uma lição na cópia. As referências ficam com o trecho citado e a página, mas sem o nome do arquivo
 * ("Material de Ana") e com um `materialId` neutro. Nenhum recurso de imagem vai, seja qual for o endereço: hoje é a
 * foto de página em data URL, e se um dia virar um endereço do servidor a cópia não pode apontar para o material de outra
 * pessoa.
 */
export function conteudoParaCopia(conteudo: ConteudoLicao, nomeDono: string): ConteudoLicao {
  const deMaterial = Boolean(conteudo.referencias?.length);
  const { recurso, referencias, ...resto } = conteudo;
  return {
    ...resto,
    ...(recurso && recurso.tipo !== "imagem" ? { recurso } : {}),
    ...(referencias?.length
      ? { referencias: referencias.map(({ pagina, localizacao, trecho, leitura }) => ({ materialId: MATERIAL_COMPARTILHADO, nome: rotuloMaterial(nomeDono), pagina, ...(localizacao ? { localizacao } : {}), trecho, leitura })) }
      : {}),
    origem: deMaterial ? rotuloMaterial(nomeDono) : origemDoConteudo(conteudo.origem),
  };
}

/** A folha da dona: o que vai e o link, se já existir. */
export async function previaCompartilhar(usuarioId: string, planoId: string): Promise<PreviaCompartilhar> {
  const plano = await lerTrilha(usuarioId, planoId);
  if (!plano) throw new FalhaApi("nao_encontrado");
  const licoes = plano.fluxos.flatMap((fluxo) => fluxo.licoes);
  const [usuario, link] = await Promise.all([
    banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { perfilNome: true, perfilCor: true, foto: { select: { token: true, moderacao: true } } } }),
    banco.linkTrilha.findUnique({ where: { usuarioId_planoId: { usuarioId, planoId } } }),
  ]);
  return {
    planoId: plano.id,
    titulo: plano.titulo,
    totalLicoes: licoes.length,
    totalPartes: plano.fluxos.length,
    deMaterial: ehDeMaterial(licoes),
    tituloTemNomeDoArquivo: tituloTemNomeDoArquivo(plano.titulo, licoes),
    perfil: usuario.perfilNome ? { nome: usuario.perfilNome, cor: corValida(usuario.perfilCor) ? usuario.perfilCor : "azul", foto: usuario.foto?.moderacao === 'aprovado' ? usuario.foto.token : null } : null,
    link: link ? linkPublico(link, plano.titulo) : null,
    // O tema das configurações, quando a dona já escolheu; senão, o sugerido pelo título.
    ...(comunidadeAtiva() ? { temaSugerido: (ehTemaValido(plano.tema) ? plano.tema : null) ?? sugerirTema(plano.titulo), demonstracao: origemDemonstracao(plano.origem) } : {}),
  };
}

/** Cria o link da trilha (ou devolve o que já existe). Só a dona; nunca de trilha recebida nem de conta de visitante. */
export async function criarLink(usuarioId: string, planoId: string): Promise<LinkCompartilhado> {
  const [usuario, plano] = await Promise.all([
    banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true, perfilNome: true } }),
    banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId, id: planoId } }, select: { titulo: true, origemCodigo: true } }),
  ]);
  if (!plano) throw new FalhaApi("nao_encontrado");
  if (ehEmailVisitante(usuario.email)) throw new FalhaApi("compartilhar_visitante");
  if (plano.origemCodigo) throw new FalhaApi("trilha_recebida");
  if (!usuario.perfilNome) throw new FalhaApi("perfil_incompleto");
  const existente = await banco.linkTrilha.findUnique({ where: { usuarioId_planoId: { usuarioId, planoId } } });
  if (existente) return linkPublico(existente, plano.titulo);
  if ((await banco.linkTrilha.count({ where: { usuarioId } })) >= LINKS_ATIVOS_MAX) throw new FalhaApi("limite_compartilhar");
  await limitar(`compartilhar:criar:${usuarioId}`, LIMITES.criar);
  try {
    if (!(await revisarConteudo({ tipo: "titulo", usuarioId, texto: plano.titulo })).aprovado) throw new FalhaApi("conteudo_recusado");
    const link = await banco.linkTrilha.create({ data: { codigo: novoCodigo(), usuarioId, planoId } });
    return linkPublico(link, plano.titulo);
  } catch (erro) {
    // Dois pedidos ao mesmo tempo: o segundo devolve o link do primeiro.
    if ((erro as { code?: string })?.code !== "P2002") throw erro;
    const simultaneo = await banco.linkTrilha.findUniqueOrThrow({ where: { usuarioId_planoId: { usuarioId, planoId } } });
    return linkPublico(simultaneo, plano.titulo);
  }
}

/** O link, só para a dona. De outra pessoa (ou inexistente) responde como link inativo. */
async function linkDaDona(usuarioId: string, codigo: string) {
  validarCodigo(codigo);
  const link = await banco.linkTrilha.findUnique({ where: { codigo }, include: { plano: { select: { titulo: true } } } });
  if (!link || link.usuarioId !== usuarioId) throw new FalhaApi("link_inativo");
  return link;
}

export async function alterarLink(usuarioId: string, codigo: string, entrada: unknown): Promise<LinkCompartilhado> {
  const { noPerfil } = (entrada ?? {}) as { noPerfil?: unknown };
  if (typeof noPerfil !== "boolean") throw new FalhaApi("invalido");
  const link = await linkDaDona(usuarioId, codigo);
  // Tirar do perfil também tira do Explorar (o Explorar inclui o perfil).
  const alterado = await banco.linkTrilha.update({ where: { codigo }, data: { noPerfil, ...(noPerfil ? {} : { noExplorar: false }) } });
  return linkPublico(alterado, link.plano.titulo);
}

/** Encerra o link. As cópias de quem já adicionou continuam (são trilhas delas). */
export async function encerrarLink(usuarioId: string, codigo: string): Promise<void> {
  await linkDaDona(usuarioId, codigo);
  await banco.linkTrilha.deleteMany({ where: { codigo, usuarioId } });
}

async function linkAtivo(codigo: string, quem: string | null) {
  validarCodigo(codigo);
  const link = await banco.linkTrilha.findFirst({
    where: { AND: [await filtroPublico(quem), { codigo }] },
    select: {
      codigo: true,
      revisao: true,
      usuarioId: true,
      planoId: true,
      plano: { select: { usuario: { select: camposDono } } },
    },
  });
  // Encerrado e inexistente respondem igual.
  if (!link || !link.plano.usuario.perfilNome || (link.plano.usuario.perfilDemo && !demonstracaoVisivel())) throw new FalhaApi("link_inativo");
  return link;
}

/** A prévia pública. Com sessão, diz se a trilha já é da pessoa (dela ou adicionada). */
export async function trilhaCompartilhada(codigo: string, usuarioId: string | null): Promise<TrilhaCompartilhada> {
  const link = await linkAtivo(codigo, usuarioId);
  const plano = await lerTrilha(link.usuarioId, link.planoId);
  if (!plano) throw new FalhaApi("link_inativo");
  const dono = await donoPublico(link.plano.usuario, usuarioId);
  const licoes = plano.fluxos.flatMap((fluxo) => fluxo.licoes);
  const atual = await banco.linkTrilha.findFirst({
    where: { AND: [await filtroPublico(usuarioId), { codigo, revisao: link.revisao, plano: { usuario: { perfilRevisao: link.plano.usuario.perfilRevisao } } }] },
    select: { tema: true },
  });
  if (!atual) throw new FalhaApi("link_inativo");
  const temaLink = atual.tema ?? plano.tema;
  const previa: TrilhaCompartilhada = {
    codigo: link.codigo,
    titulo: plano.titulo,
    // Tema e capa só quando existem (campos opcionais da resposta pública).
    ...(ehTemaValido(temaLink) ? { tema: temaLink } : {}),
    ...(plano.capa && (!plano.capa.startsWith('foto:') || plano.capaFoto?.moderacao === 'aprovado') ? { capa: plano.capa } : {}),
    origem: ehDeMaterial(licoes) ? rotuloMaterial(dono.nome) : origemDoConteudo(plano.origem),
    totalLicoes: licoes.length,
    partes: plano.fluxos.map((fluxo) => ({ titulo: fluxo.titulo, licoes: fluxo.licoes.map((licao) => licao.titulo) })),
    dono,
  };
  if (!usuarioId) return previa;
  if (usuarioId === link.usuarioId) return { ...previa, situacao: "sua", planoId: link.planoId };
  const copia = await banco.planoAprendizado.findUnique({ where: { usuarioId_origemCodigo: { usuarioId, origemCodigo: codigo } }, select: { id: true } });
  // Com a comunidade: o botão Seguir do cartão "Quem compartilhou" (só com perfil público; visitante e demonstração não seguem).
  let seguirDono: TrilhaCompartilhada["seguirDono"];
  if (comunidadeAtiva() && dono.perfilId) {
    const quem = await banco.usuario.findUnique({ where: { id: usuarioId }, select: { email: true, perfilDemo: true } });
    const pode = Boolean(quem && !ehEmailVisitante(quem.email) && !quem.perfilDemo);
    const segue = pode && Boolean(await banco.seguir.findUnique({ where: { seguidorId_seguidoId: { seguidorId: usuarioId, seguidoId: link.usuarioId } }, select: { criadoEm: true } }));
    seguirDono = { seguindo: segue, podeSeguir: pode };
  }
  const situacao = copia ? { situacao: "adicionada" as const, planoId: copia.id } : { situacao: "nova" as const };
  return { ...previa, ...situacao, ...(seguirDono ? { seguirDono } : {}) };
}

/**
 * Adiciona a cópia às trilhas da pessoa: lê as lições da trilha original agora e grava uma trilha nova, sem progresso.
 * O mesmo link adicionado de novo devolve a trilha que a pessoa já tem (sem duplicar).
 */
export async function adicionarTrilha(usuarioId: string, codigo: string): Promise<TrilhaAdicionada> {
  const link = await linkAtivo(codigo, usuarioId);
  if (link.usuarioId === usuarioId) throw new FalhaApi("trilha_propria");
  const dono = await donoPublico(link.plano.usuario, usuarioId);
  const ja = await banco.planoAprendizado.findUnique({ where: { usuarioId_origemCodigo: { usuarioId, origemCodigo: codigo } }, select: { id: true } });
  if (ja) return { planoId: ja.id, jaTinha: true, dono };
  await limitar(`compartilhar:adicionar:${usuarioId}`, LIMITES.adicionar);
  // O evento com data (para o "Em alta"): um por conta por trilha; conta de visitante não conta.
  const quem = await banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true } });
  const contarEvento = !ehEmailVisitante(quem.email);

  const original = await lerTrilha(link.usuarioId, link.planoId);
  if (!original) throw new FalhaApi("link_inativo");
  const licoes = original.fluxos.flatMap((fluxo) => fluxo.licoes);
  if (licoes.length === 0 || !licoes.every((licao) => conteudoValido(licao.conteudo))) throw new FalhaApi("falha");
  const deMaterial = ehDeMaterial(licoes);
  const id = randomUUID();
  const fluxos = original.fluxos.map(({ titulo }, indice) => ({ usuarioId, id: `${id}-${indice + 1}`, planoId: id, titulo, ordem: indice + 1 }));
  const copias = original.fluxos.flatMap((fluxo, indiceFluxo) => fluxo.licoes.map((licao, indiceLicao) => {
    const conteudo = conteudoParaCopia(licao.conteudo as unknown as ConteudoLicao, dono.nome);
    if (!conteudoValido(conteudo)) throw new FalhaApi("falha");
    return {
      usuarioId,
      id: `${fluxos[indiceFluxo].id}-${indiceLicao + 1}`,
      fluxoId: fluxos[indiceFluxo].id,
      titulo: licao.titulo,
      ordem: indiceLicao + 1,
      conteudo: JSON.parse(JSON.stringify(conteudo)) as Prisma.InputJsonValue,
    };
  }));
  try {
    await banco.$transaction(async tx => {
      await exigirParLivre(tx, usuarioId, link.usuarioId, "link_inativo");
      const vigente = await tx.linkTrilha.updateMany({
        where: { codigo, revisao: link.revisao, moderacao: "aprovado", oculta: false, plano: { usuario: { perfilModeracao: "aprovado", perfilRevisao: link.plano.usuario.perfilRevisao } } },
        data: { adicoes: { increment: 1 } },
      });
      if (!vigente.count) throw new FalhaApi("link_inativo");
      await tx.planoAprendizado.create({
        data: {
          usuarioId,
          id,
          titulo: original.titulo,
          // O objetivo que a dona digitou não vai: a cópia guarda o título no lugar.
          objetivo: original.titulo,
          origem: deMaterial ? rotuloMaterial(dono.nome) : origemDoConteudo(original.origem),
          origemNome: dono.nome,
          origemPerfilId: link.plano.usuario.perfilId,
          origemCodigo: codigo,
          // A capa da galeria vai junto na cópia (a foto, quando houver, fica com quem enviou).
          capa: original.capa && !original.capa.startsWith("foto:") ? original.capa : null,
        },
      });
      await tx.fluxo.createMany({ data: fluxos });
      await tx.licao.createMany({ data: copias });
      if (contarEvento) await tx.eventoTrilha.createMany({ data: [{ codigo, usuarioId, tipo: "adicao" }], skipDuplicates: true });
    });
  } catch (erro) {
    // Dois pedidos ao mesmo tempo: o segundo encontra a trilha do primeiro.
    if ((erro as { code?: string })?.code !== "P2002") throw erro;
    const simultaneo = await banco.planoAprendizado.findUnique({ where: { usuarioId_origemCodigo: { usuarioId, origemCodigo: codigo } }, select: { id: true } });
    if (!simultaneo) throw erro;
    return { planoId: simultaneo.id, jaTinha: true, dono };
  }
  return { planoId: id, jaTinha: false, dono };
}

/** A página pública do perfil: só as trilhas marcadas. Sem nenhuma marcada, o perfil não existe. */
export async function perfilPublico(perfilId: string, quem: string | null = null): Promise<PerfilPublico> {
  if (!FORMATO_CODIGO.test(perfilId)) throw new FalhaApi("nao_encontrado");
  const usuario = await banco.usuario.findUnique({
    where: { perfilId },
    select: { id: true, perfilRevisao: true, perfilNome: true, perfilCor: true, perfilResumo: true, perfilInteresses: true, perfilDemo: true, foto: { select: { token: true, moderacao: true } } },
  });
  if (!usuario?.perfilNome || (usuario.perfilDemo && !demonstracaoVisivel())) throw new FalhaApi("nao_encontrado");
  const links = await banco.linkTrilha.findMany({ where: { AND: [await filtroPublico(quem), { usuarioId: usuario.id, noPerfil: true }] }, orderBy: { criadoEm: "desc" }, select: { codigo: true, planoId: true, adicoes: true, revisao: true } });
  if (links.length === 0) throw new FalhaApi("nao_encontrado");
  const trilhas = await Promise.all(links.map(async (link) => {
    const plano = await lerTrilha(usuario.id, link.planoId);
    const licoes = plano?.fluxos.flatMap((fluxo) => fluxo.licoes) ?? [];
    return plano && { codigo: link.codigo, titulo: plano.titulo, totalLicoes: licoes.length, origem: ehDeMaterial(licoes) ? rotuloMaterial(usuario.perfilNome!) : origemDoConteudo(plano.origem) };
  }));
  const atuais = await banco.linkTrilha.findMany({
    where: { AND: [await filtroPublico(quem), { usuarioId: usuario.id, noPerfil: true, plano: { usuario: { perfilRevisao: usuario.perfilRevisao } } }] },
    select: { codigo: true, revisao: true },
  });
  const revisoes = new Map(atuais.map(link => [link.codigo, link.revisao]));
  const linksVisiveis = links.filter(link => revisoes.get(link.codigo) === link.revisao);
  if (!linksVisiveis.length) throw new FalhaApi("nao_encontrado");
  const codigosVisiveis = new Set(linksVisiveis.map(link => link.codigo));
  const visiveis = trilhas.filter(trilha => trilha !== null).filter(trilha => codigosVisiveis.has(trilha.codigo));
  return {
    nome: usuario.perfilNome,
    cor: corValida(usuario.perfilCor) ? usuario.perfilCor : "azul",
    resumo: usuario.perfilResumo || null,
    interesses: temasGuardados(usuario.perfilInteresses),
    foto: usuario.foto?.moderacao === 'aprovado' ? usuario.foto.token : null,
    alcance: alcanceDe(linksVisiveis),
    trilhas: visiveis,
    ...(usuario.perfilDemo ? { demo: true as const } : {}),
  };
}

/**
 * As marcas das listas e do mapa (só com a flag): o link ativo da dona e, na trilha recebida, de quem veio, o perfil
 * público (se existir agora) e o código original (se ainda ativo).
 */
export async function marcasDasTrilhas(usuarioId: string, planos: { id: string; origemNome: string | null; origemPerfilId: string | null; origemCodigo: string | null }[]) {
  const marcas = new Map<string, { link?: { codigo: string; noPerfil: boolean }; recebida?: { nome: string; perfilId: string | null; codigoAtivo: string | null; foto: string | null } }>();
  if (!compartilharAtivo() || planos.length === 0) return marcas;
  const links = await banco.linkTrilha.findMany({ where: { usuarioId, planoId: { in: planos.map((plano) => plano.id) } }, select: { planoId: true, codigo: true, noPerfil: true } });
  for (const link of links) marcas.set(link.planoId, { link: { codigo: link.codigo, noPerfil: link.noPerfil } });
  const recebidas = planos.filter((plano) => plano.origemCodigo);
  if (recebidas.length > 0) {
    const filtro = await filtroPublico(usuarioId);
    const ativos = new Set((await banco.linkTrilha.findMany({ where: { AND: [filtro, { codigo: { in: recebidas.map((plano) => plano.origemCodigo!) } }] }, select: { codigo: true } })).map((link) => link.codigo));
    const perfisIds = [...new Set(recebidas.map((plano) => plano.origemPerfilId).filter((valor): valor is string => Boolean(valor)))];
    // A foto é a de agora (se a pessoa remover, some daqui também); o perfil só aparece se for público agora.
    const donos = await banco.usuario.findMany({
      where: { perfilId: { in: perfisIds }, planos: { some: { links: { some: filtro } } } },
      select: { perfilId: true, foto: { select: { token: true, moderacao: true } }, planos: { where: { links: { some: { AND: [filtro, { noPerfil: true }] } } }, select: { id: true }, take: 1 } },
    });
    const publicos = new Set(donos.filter((dono) => dono.planos.length > 0).map((dono) => dono.perfilId));
    const fotos = new Map(donos.map((dono) => [dono.perfilId, dono.foto?.moderacao === 'aprovado' ? dono.foto.token : null]));
    for (const plano of recebidas) {
      marcas.set(plano.id, {
        recebida: {
          nome: ativos.has(plano.origemCodigo!) ? plano.origemNome ?? "" : "",
          perfilId: plano.origemPerfilId && publicos.has(plano.origemPerfilId) ? plano.origemPerfilId : null,
          codigoAtivo: ativos.has(plano.origemCodigo!) ? plano.origemCodigo : null,
          foto: (plano.origemPerfilId && fotos.get(plano.origemPerfilId)) || null,
        },
      });
    }
  }
  return marcas;
}
