/*
 * Capa da trilha com foto (lote 4), pelo mesmo caminho da foto do perfil: o cliente manda o retângulo 2:1 já recortado;
 * aqui a imagem é conferida pelos bytes (JPEG, PNG ou WebP), aberta pelo sharp com teto de pixels e só o primeiro
 * quadro, girada pelo EXIF, cortada no centro em 1024×512 e 480×240 e regravada em WebP (sem EXIF, GPS, XMP nem ICC).
 * O endereço público usa um token aleatório que muda a cada troca; a trilha guarda `capa = "foto:<token>"`.
 */
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { FORMATO_CODIGO, LIMITES_CAPA, LIMITES_FOTO, ehCapaFoto, type ConfiguracoesTrilha } from "@studoo/contratos";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { banco } from "@/servidor/banco/cliente";
import { contaComPerfil, lerBase64 } from "@/servidor/compartilhar/foto";
import { revisarConteudo } from "@/servidor/compartilhar/revisao";
import { obterConfiguracoes } from "./configuracoes";

const LIMITE_TROCAS = { quantidade: LIMITES_FOTO.trocasPorHora, janelaMs: 60 * 60_000 } as const;

/** As duas versões em WebP. Falha de leitura (arquivo corrompido, pixels demais) vira `foto_invalida`. */
export async function processarCapa(bytes: Buffer): Promise<{ grande: Buffer; pequena: Buffer }> {
  try {
    const entrada = sharp(bytes, { limitInputPixels: LIMITES_FOTO.pixels, pages: 1, failOn: "error", sequentialRead: true });
    const meta = await entrada.metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new Error("formato");
    const retangulo = await entrada.rotate().resize(LIMITES_CAPA.largura, LIMITES_CAPA.altura, { fit: "cover", position: "centre" }).toColourspace("srgb").png().toBuffer();
    const [grande, pequena] = await Promise.all([
      sharp(retangulo).webp({ quality: 82, effort: 4 }).toBuffer(),
      sharp(retangulo).resize(LIMITES_CAPA.larguraPequena, LIMITES_CAPA.alturaPequena).webp({ quality: 80, effort: 4 }).toBuffer(),
    ]);
    return { grande, pequena };
  } catch {
    throw new FalhaApi("foto_invalida");
  }
}

/** Troca a capa por uma foto: só a dona, até 10 trocas por hora; passa pela revisão de conteúdo antes de gravar. */
export async function salvarCapaFoto(usuarioId: string, planoId: string, entrada: unknown): Promise<ConfiguracoesTrilha> {
  await contaComPerfil(usuarioId);
  const plano = await banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId, id: planoId } }, select: { id: true } });
  if (!plano) throw new FalhaApi("nao_encontrado");
  const bytes = lerBase64(entrada);
  const dentro = await banco.$transaction((tx) => consumirLimite(tx, `capa:${usuarioId}`, LIMITE_TROCAS.quantidade, LIMITE_TROCAS.janelaMs));
  if (!dentro) throw new FalhaApi("limite_foto");
  const { grande, pequena } = await processarCapa(bytes);
  if (!(await revisarConteudo({ tipo: "foto", usuarioId, bytes: new Uint8Array(grande) })).aprovado) throw new FalhaApi("conteudo_recusado");
  const token = randomBytes(12).toString("base64url");
  const dados = { token, grande: new Uint8Array(grande), pequena: new Uint8Array(pequena) };
  await banco.$transaction([
    banco.capaFoto.upsert({ where: { usuarioId_planoId: { usuarioId, planoId } }, create: { usuarioId, planoId, ...dados }, update: { ...dados, criadaEm: new Date() } }),
    banco.planoAprendizado.update({ where: { usuarioId_id: { usuarioId, id: planoId } }, data: { capa: `foto:${token}` } }),
  ]);
  return obterConfiguracoes(usuarioId, planoId);
}

/** Tira a foto da capa: volta a capa padrão, e o endereço antigo deixa de existir. */
export async function removerCapaFoto(usuarioId: string, planoId: string): Promise<ConfiguracoesTrilha> {
  const plano = await banco.planoAprendizado.findUnique({ where: { usuarioId_id: { usuarioId, id: planoId } }, select: { capa: true } });
  if (!plano) throw new FalhaApi("nao_encontrado");
  await banco.$transaction([
    banco.capaFoto.deleteMany({ where: { usuarioId, planoId } }),
    ...(ehCapaFoto(plano.capa) ? [banco.planoAprendizado.update({ where: { usuarioId_id: { usuarioId, id: planoId } }, data: { capa: null } })] : []),
  ]);
  return obterConfiguracoes(usuarioId, planoId);
}

/** Os bytes da capa pelo token; token fora do formato, trocado ou removido responde igual (não encontrado). */
export async function lerCapa(token: string, tamanho: string): Promise<Buffer> {
  const largura = Number(tamanho);
  if (!FORMATO_CODIGO.test(token) || (largura !== LIMITES_CAPA.largura && largura !== LIMITES_CAPA.larguraPequena)) throw new FalhaApi("nao_encontrado");
  const grande = largura === LIMITES_CAPA.largura;
  const capa = await banco.capaFoto.findUnique({ where: { token }, select: { grande, pequena: !grande } });
  const bytes = grande ? capa?.grande : capa?.pequena;
  if (!bytes) throw new FalhaApi("nao_encontrado");
  return Buffer.from(bytes);
}
