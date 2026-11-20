/*
 * Configurações da trilha (lote 4): nome, descrição, tema e capa da galeria, e o estado de quem pode ver. Só a dona
 * (trilha de outra pessoa responde `nao_encontrado`); trilha adicionada de outra pessoa é uma cópia, que ela configura
 * sem mexer na original. Descrição e tema são os mesmos da legenda e do tema do link (gravados juntos).
 */
import {
  LIMITES_COMUNIDADE,
  TEMAS,
  ehCapaGaleria,
  motivoLegendaInvalida,
  motivoTituloTrilhaInvalido,
  normalizarResumoPerfil,
  normalizarTituloTrilha,
  sugerirTema,
  type ConfiguracoesTrilha,
  type Tema,
  type Visibilidade,
} from "@studoo/contratos";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { banco } from "@/servidor/banco/cliente";
import { revisarConteudo } from "@/servidor/compartilhar/revisao";
import { zerarCacheEmAlta } from "@/servidor/compartilhar/comunidade";

const ehTema = (valor: unknown): valor is Tema => (TEMAS as readonly unknown[]).includes(valor);
/** Mudanças por hora e por conta (salva a cada campo; o teto só segura abuso). */
const LIMITE_MUDANCAS = { quantidade: 240, janelaMs: 60 * 60_000 };

export async function obterConfiguracoes(usuarioId: string, planoId: string): Promise<ConfiguracoesTrilha> {
  const plano = await banco.planoAprendizado.findUnique({
    where: { usuarioId_id: { usuarioId, id: planoId } },
    select: { id: true, titulo: true, descricao: true, tema: true, capa: true, capaFoto: { select: { moderacao: true } }, origemCodigo: true },
  });
  if (!plano) throw new FalhaApi("nao_encontrado");
  const link = await banco.linkTrilha.findUnique({
    where: { usuarioId_planoId: { usuarioId, planoId } },
    select: { codigo: true, noPerfil: true, noExplorar: true, moderacao: true, adicoes: true, legenda: true, tema: true },
  });
  const valeus = link ? await banco.eventoTrilha.count({ where: { codigo: link.codigo, tipo: "valeu" } }) : 0;
  const tema = ehTema(plano.tema) ? plano.tema : ehTema(link?.tema) ? link.tema : null;
  const visibilidade: Visibilidade | null = link ? (link.noExplorar ? "explorar" : link.noPerfil ? "perfil" : "link") : null;
  return {
    planoId: plano.id,
    titulo: plano.titulo,
    descricao: plano.descricao ?? link?.legenda ?? null,
    tema,
    temaSugerido: tema ?? sugerirTema(plano.titulo),
    capa: plano.capa ?? null,
    capaModeracao: plano.capaFoto?.moderacao ?? null,
    semente: link?.codigo ?? plano.id,
    compartilhamento: link && visibilidade ? { codigo: link.codigo, visibilidade, moderacao: link.moderacao, estudando: link.adicoes, valeus } : null,
    recebida: Boolean(plano.origemCodigo),
  };
}

/** Grava os campos que vieram (cada um sozinho, ao sair dele). Campo inválido responde `invalido` e nada muda. */
export async function salvarConfiguracoes(usuarioId: string, planoId: string, entrada: unknown): Promise<ConfiguracoesTrilha> {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw new FalhaApi("invalido");
  const bruto = entrada as Record<string, unknown>;
  const chaves = Object.keys(bruto);
  if (chaves.length === 0 || chaves.some((chave) => !["titulo", "descricao", "tema", "capa"].includes(chave))) throw new FalhaApi("invalido");
  const atual = await banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId, id: planoId } }, select: { id: true } });
  if (!atual) throw new FalhaApi("nao_encontrado");

  const dados: { titulo?: string; descricao?: string | null; tema?: string | null; capa?: string | null } = {};
  if ("titulo" in bruto) {
    if (typeof bruto.titulo !== "string" || bruto.titulo.length > 400) throw new FalhaApi("invalido");
    const titulo = normalizarTituloTrilha(bruto.titulo);
    if (motivoTituloTrilhaInvalido(titulo)) throw new FalhaApi("invalido");
    dados.titulo = titulo;
  }
  if ("descricao" in bruto) {
    if (bruto.descricao !== null && (typeof bruto.descricao !== "string" || bruto.descricao.length > 600)) throw new FalhaApi("invalido");
    const descricao = typeof bruto.descricao === "string" ? normalizarResumoPerfil(bruto.descricao) : "";
    if (motivoLegendaInvalida(descricao) || [...descricao].length > LIMITES_COMUNIDADE.legendaMax) throw new FalhaApi("invalido");
    dados.descricao = descricao || null;
  }
  if ("tema" in bruto) {
    if (bruto.tema !== null && !ehTema(bruto.tema)) throw new FalhaApi("invalido");
    dados.tema = bruto.tema as Tema | null;
  }
  if ("capa" in bruto) {
    if (bruto.capa !== null && !ehCapaGaleria(bruto.capa)) throw new FalhaApi("invalido");
    dados.capa = bruto.capa as string | null;
  }

  const dentro = await banco.$transaction((tx) => consumirLimite(tx, `trilha:configuracoes:${usuarioId}`, LIMITE_MUDANCAS.quantidade, LIMITE_MUDANCAS.janelaMs));
  if (!dentro) throw new FalhaApi("limite_compartilhar");
  // Aplica a mesma triagem local do editor de publicação.
  if (dados.titulo && !(await revisarConteudo({ tipo: "titulo", usuarioId, texto: dados.titulo })).aprovado) throw new FalhaApi("conteudo_recusado");
  if (dados.descricao && !(await revisarConteudo({ tipo: "legenda", usuarioId, texto: dados.descricao })).aprovado) throw new FalhaApi("conteudo_recusado");

  const link = await banco.linkTrilha.findUnique({ where: { usuarioId_planoId: { usuarioId, planoId } }, select: { codigo: true, noExplorar: true } });
  await banco.$transaction([
    // Trocar para a galeria ou para a padrão apaga a foto de capa (o endereço antigo deixa de existir).
    ...("capa" in dados ? [banco.capaFoto.deleteMany({ where: { usuarioId, planoId } })] : []),
    banco.planoAprendizado.update({ where: { usuarioId_id: { usuarioId, id: planoId } }, data: dados }),
    // A legenda e o tema do link são a descrição e o tema daqui. Trilha no Explorar não fica sem tema.
    ...(link && ("descricao" in dados || (dados.tema !== undefined && (dados.tema !== null || !link.noExplorar)))
      ? [banco.linkTrilha.update({
        where: { codigo: link.codigo },
        data: {
          ...("descricao" in dados ? { legenda: dados.descricao } : {}),
          ...(dados.tema !== undefined && (dados.tema !== null || !link.noExplorar) ? { tema: dados.tema } : {}),
        },
      })]
      : []),
  ]);
  if (link?.noExplorar && (dados.tema !== undefined || dados.titulo !== undefined)) zerarCacheEmAlta();
  return obterConfiguracoes(usuarioId, planoId);
}
