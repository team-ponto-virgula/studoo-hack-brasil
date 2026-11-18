import { randomBytes, randomUUID } from "node:crypto";
import {
  CORES_PERFIL,
  FORMATO_CODIGO,
  MATERIAL_COMPARTILHADO,
  motivoNomeInvalido,
  normalizarNomePerfil,
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

/** Sem a flag, nenhuma rota nova existe: responde como rota desconhecida. */
export function exigirCompartilhar(): void {
  if (!compartilharAtivo()) throw new FalhaApi("nao_encontrado");
}

/** 96 bits aleatórios em base64url (16 caracteres), sem relação com ids internos. */
const novoCodigo = () => randomBytes(12).toString("base64url");

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

const linkPublico = (link: { codigo: string; planoId: string; criadoEm: Date; adicoes: number; noPerfil: boolean }, titulo: string): LinkCompartilhado => ({
  codigo: link.codigo,
  planoId: link.planoId,
  titulo,
  criadoEm: link.criadoEm.toISOString(),
  adicoes: link.adicoes,
  noPerfil: link.noPerfil,
});

/** O perfil é público quando ao menos uma trilha está marcada para aparecer nele. */
async function perfilEhPublico(usuarioId: string) {
  return (await banco.linkTrilha.count({ where: { usuarioId, noPerfil: true } })) > 0;
}

async function donoPublico(usuario: { id: string; perfilNome: string | null; perfilCor: string | null; perfilId: string | null }): Promise<DonoPublico> {
  return {
    nome: usuario.perfilNome ?? "",
    cor: corValida(usuario.perfilCor) ? usuario.perfilCor : "azul",
    perfilId: usuario.perfilId && (await perfilEhPublico(usuario.id)) ? usuario.perfilId : null,
  };
}

export async function obterPerfil(usuarioId: string): Promise<Perfil> {
  const usuario = await banco.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { email: true, perfilNome: true, perfilCor: true, perfilId: true },
  });
  const links = await banco.linkTrilha.findMany({
    where: { usuarioId },
    orderBy: { criadoEm: "desc" },
    select: { codigo: true, planoId: true, criadoEm: true, adicoes: true, noPerfil: true, plano: { select: { titulo: true } } },
  });
  return {
    nome: usuario.perfilNome,
    cor: corValida(usuario.perfilCor) ? usuario.perfilCor : null,
    perfilId: usuario.perfilId,
    publico: links.some((link) => link.noPerfil),
    email: usuario.email,
    visitante: ehEmailVisitante(usuario.email),
    links: links.map((link) => linkPublico(link, link.plano.titulo)),
  };
}

export async function salvarPerfil(usuarioId: string, entrada: unknown): Promise<Perfil> {
  const { nome: bruto, cor } = (entrada ?? {}) as { nome?: unknown; cor?: unknown };
  if (typeof bruto !== "string" || bruto.length > 200 || !corValida(cor)) throw new FalhaApi("invalido");
  const nome = normalizarNomePerfil(bruto);
  if (motivoNomeInvalido(nome)) throw new FalhaApi("invalido");
  const usuario = await banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true, perfilId: true } });
  if (ehEmailVisitante(usuario.email)) throw new FalhaApi("compartilhar_visitante");
  await limitar(`perfil:${usuarioId}`, LIMITES.perfil);
  await banco.usuario.update({
    where: { id: usuarioId },
    data: { perfilNome: nome, perfilCor: cor, ...(usuario.perfilId ? {} : { perfilId: novoCodigo() }) },
  });
  return obterPerfil(usuarioId);
}

type LicaoComConteudo = { titulo: string; conteudo: Prisma.JsonValue };

/** Lições da trilha, em ordem, com o conteúdo (para a prévia e para a cópia). */
async function lerTrilha(usuarioId: string, planoId: string) {
  return banco.planoAprendizado.findUnique({
    where: { usuarioId_id: { usuarioId, id: planoId } },
    select: {
      id: true,
      titulo: true,
      origem: true,
      origemCodigo: true,
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
const ehDeMaterial = (licoes: LicaoComConteudo[]) => licoes.some((licao) => referenciasDe(licao).length > 0);

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
    origem: deMaterial ? rotuloMaterial(nomeDono) : conteudo.origem,
  };
}

/** A folha da dona: o que vai e o link, se já existir. */
export async function previaCompartilhar(usuarioId: string, planoId: string): Promise<PreviaCompartilhar> {
  const plano = await lerTrilha(usuarioId, planoId);
  if (!plano) throw new FalhaApi("nao_encontrado");
  const licoes = plano.fluxos.flatMap((fluxo) => fluxo.licoes);
  const [usuario, link] = await Promise.all([
    banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { perfilNome: true, perfilCor: true } }),
    banco.linkTrilha.findUnique({ where: { usuarioId_planoId: { usuarioId, planoId } } }),
  ]);
  return {
    planoId: plano.id,
    titulo: plano.titulo,
    totalLicoes: licoes.length,
    totalPartes: plano.fluxos.length,
    deMaterial: ehDeMaterial(licoes),
    tituloTemNomeDoArquivo: tituloTemNomeDoArquivo(plano.titulo, licoes),
    perfil: usuario.perfilNome ? { nome: usuario.perfilNome, cor: corValida(usuario.perfilCor) ? usuario.perfilCor : "azul" } : null,
    link: link ? linkPublico(link, plano.titulo) : null,
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
  const alterado = await banco.linkTrilha.update({ where: { codigo }, data: { noPerfil } });
  return linkPublico(alterado, link.plano.titulo);
}

/** Encerra o link. As cópias de quem já adicionou continuam (são trilhas delas). */
export async function encerrarLink(usuarioId: string, codigo: string): Promise<void> {
  await linkDaDona(usuarioId, codigo);
  await banco.linkTrilha.deleteMany({ where: { codigo, usuarioId } });
}

async function linkAtivo(codigo: string) {
  validarCodigo(codigo);
  const link = await banco.linkTrilha.findUnique({
    where: { codigo },
    select: {
      codigo: true,
      usuarioId: true,
      planoId: true,
      plano: { select: { usuario: { select: { id: true, perfilNome: true, perfilCor: true, perfilId: true } } } },
    },
  });
  // Encerrado e inexistente respondem igual.
  if (!link || !link.plano.usuario.perfilNome) throw new FalhaApi("link_inativo");
  return link;
}

/** A prévia pública. Com sessão, diz se a trilha já é da pessoa (dela ou adicionada). */
export async function trilhaCompartilhada(codigo: string, usuarioId: string | null): Promise<TrilhaCompartilhada> {
  const link = await linkAtivo(codigo);
  const plano = await lerTrilha(link.usuarioId, link.planoId);
  if (!plano) throw new FalhaApi("link_inativo");
  const dono = await donoPublico(link.plano.usuario);
  const licoes = plano.fluxos.flatMap((fluxo) => fluxo.licoes);
  const previa: TrilhaCompartilhada = {
    codigo: link.codigo,
    titulo: plano.titulo,
    origem: ehDeMaterial(licoes) ? rotuloMaterial(dono.nome) : plano.origem,
    totalLicoes: licoes.length,
    partes: plano.fluxos.map((fluxo) => ({ titulo: fluxo.titulo, licoes: fluxo.licoes.map((licao) => licao.titulo) })),
    dono,
  };
  if (!usuarioId) return previa;
  if (usuarioId === link.usuarioId) return { ...previa, situacao: "sua", planoId: link.planoId };
  const copia = await banco.planoAprendizado.findUnique({ where: { usuarioId_origemCodigo: { usuarioId, origemCodigo: codigo } }, select: { id: true } });
  return copia ? { ...previa, situacao: "adicionada", planoId: copia.id } : { ...previa, situacao: "nova" };
}

/**
 * Adiciona a cópia às trilhas da pessoa: lê as lições da trilha original agora e grava uma trilha nova, sem progresso.
 * O mesmo link adicionado de novo devolve a trilha que a pessoa já tem (sem duplicar).
 */
export async function adicionarTrilha(usuarioId: string, codigo: string): Promise<TrilhaAdicionada> {
  const link = await linkAtivo(codigo);
  if (link.usuarioId === usuarioId) throw new FalhaApi("trilha_propria");
  const dono = await donoPublico(link.plano.usuario);
  const ja = await banco.planoAprendizado.findUnique({ where: { usuarioId_origemCodigo: { usuarioId, origemCodigo: codigo } }, select: { id: true } });
  if (ja) return { planoId: ja.id, jaTinha: true, dono };
  await limitar(`compartilhar:adicionar:${usuarioId}`, LIMITES.adicionar);

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
    await banco.$transaction([
      banco.planoAprendizado.create({
        data: {
          usuarioId,
          id,
          titulo: original.titulo,
          // O objetivo que a dona digitou não vai: a cópia guarda o título no lugar.
          objetivo: original.titulo,
          origem: deMaterial ? rotuloMaterial(dono.nome) : original.origem,
          origemNome: dono.nome,
          origemPerfilId: link.plano.usuario.perfilId,
          origemCodigo: codigo,
        },
      }),
      banco.fluxo.createMany({ data: fluxos }),
      banco.licao.createMany({ data: copias }),
      banco.linkTrilha.update({ where: { codigo }, data: { adicoes: { increment: 1 } } }),
    ]);
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
export async function perfilPublico(perfilId: string): Promise<PerfilPublico> {
  if (!FORMATO_CODIGO.test(perfilId)) throw new FalhaApi("nao_encontrado");
  const usuario = await banco.usuario.findUnique({ where: { perfilId }, select: { id: true, perfilNome: true, perfilCor: true } });
  if (!usuario?.perfilNome) throw new FalhaApi("nao_encontrado");
  const links = await banco.linkTrilha.findMany({ where: { usuarioId: usuario.id, noPerfil: true }, orderBy: { criadoEm: "desc" }, select: { codigo: true, planoId: true } });
  if (links.length === 0) throw new FalhaApi("nao_encontrado");
  const trilhas = await Promise.all(links.map(async (link) => {
    const plano = await lerTrilha(usuario.id, link.planoId);
    const licoes = plano?.fluxos.flatMap((fluxo) => fluxo.licoes) ?? [];
    return plano && { codigo: link.codigo, titulo: plano.titulo, totalLicoes: licoes.length, origem: ehDeMaterial(licoes) ? rotuloMaterial(usuario.perfilNome!) : plano.origem };
  }));
  return { nome: usuario.perfilNome, cor: corValida(usuario.perfilCor) ? usuario.perfilCor : "azul", trilhas: trilhas.filter((trilha) => trilha !== null) };
}

/**
 * As marcas das listas e do mapa (só com a flag): o link ativo da dona e, na trilha recebida, de quem veio, o perfil
 * público (se existir agora) e o código original (se ainda ativo).
 */
export async function marcasDasTrilhas(usuarioId: string, planos: { id: string; origemNome: string | null; origemPerfilId: string | null; origemCodigo: string | null }[]) {
  const marcas = new Map<string, { link?: { codigo: string; noPerfil: boolean }; recebida?: { nome: string; perfilId: string | null; codigoAtivo: string | null } }>();
  if (!compartilharAtivo() || planos.length === 0) return marcas;
  const links = await banco.linkTrilha.findMany({ where: { usuarioId, planoId: { in: planos.map((plano) => plano.id) } }, select: { planoId: true, codigo: true, noPerfil: true } });
  for (const link of links) marcas.set(link.planoId, { link: { codigo: link.codigo, noPerfil: link.noPerfil } });
  const recebidas = planos.filter((plano) => plano.origemCodigo);
  if (recebidas.length > 0) {
    const ativos = new Set((await banco.linkTrilha.findMany({ where: { codigo: { in: recebidas.map((plano) => plano.origemCodigo!) } }, select: { codigo: true } })).map((link) => link.codigo));
    const perfisIds = [...new Set(recebidas.map((plano) => plano.origemPerfilId).filter((valor): valor is string => Boolean(valor)))];
    const publicos = new Set((await banco.usuario.findMany({
      where: { perfilId: { in: perfisIds }, planos: { some: { links: { some: { noPerfil: true } } } } },
      select: { perfilId: true },
    })).map((usuario) => usuario.perfilId));
    for (const plano of recebidas) {
      marcas.set(plano.id, {
        recebida: {
          nome: plano.origemNome ?? "",
          perfilId: plano.origemPerfilId && publicos.has(plano.origemPerfilId) ? plano.origemPerfilId : null,
          codigoAtivo: ativos.has(plano.origemCodigo!) ? plano.origemCodigo : null,
        },
      });
    }
  }
  return marcas;
}
