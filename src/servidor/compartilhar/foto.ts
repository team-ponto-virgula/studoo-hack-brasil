import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { FORMATO_CODIGO, LIMITES_FOTO, type TamanhoFoto } from "@studoo/contratos";
import { FalhaApi } from "@/servidor/acesso/http";
import { consumirLimite } from "@/servidor/acesso/seguranca";
import { ehEmailVisitante } from "@/servidor/acesso/visitante";
import { banco } from "@/servidor/banco/cliente";

/*
 * Foto do perfil (spec 10). O cliente manda o quadrado já recortado; aqui a imagem é conferida pelos bytes (JPEG, PNG
 * ou WebP), aberta pelo sharp com teto de pixels e só o primeiro quadro, girada pela orientação do EXIF, cortada no
 * centro em 512 e 128 e regravada em WebP. O sharp não copia metadados por padrão: EXIF (com GPS), XMP e ICC ficam de
 * fora. O endereço público usa um token aleatório que muda a cada troca.
 */

const LIMITE_TROCAS = { quantidade: LIMITES_FOTO.trocasPorHora, janelaMs: 60 * 60_000 } as const;
/**
 * Fotos são pedidas por toda lista com avatar (o Explorar mostra 20 ou mais por página): balde próprio, mais largo que o
 * das páginas públicas, contado em memória. Medido: o balde no banco custava uma transação com trava por foto (todas
 * as leituras sem endereço confiável disputavam a mesma trava). Agora uma foto já lida não toca o banco.
 */
const LIMITE_LEITURA = { quantidade: 1200, janelaMs: 15 * 60_000 } as const;
const LIMITE_LEITURA_GLOBAL = { quantidade: 30_000, janelaMs: 15 * 60_000 } as const;
const baldes = new Map<string, { inicio: number; usados: number }>();

/** Cache das fotos lidas, por token e tamanho (o token muda a cada troca; trocar e remover tiram o antigo daqui). */
const CACHE = { itens: 400, bytes: 24 * 1024 * 1024, validadeMs: 10 * 60_000 } as const;
const cache = new Map<string, { bytes: Buffer; em: number }>();
let bytesNoCache = 0;
const chaveCache = (token: string, lado: number) => `${token}/${lado}`;

function guardarNoCache(chave: string, bytes: Buffer) {
  const antigo = cache.get(chave);
  if (antigo) { bytesNoCache -= antigo.bytes.length; cache.delete(chave); }
  cache.set(chave, { bytes, em: Date.now() });
  bytesNoCache += bytes.length;
  // Sai o mais antigo (a ordem do Map é a de inserção; uma leitura reinsere).
  for (const [k, v] of cache) {
    if (cache.size <= CACHE.itens && bytesNoCache <= CACHE.bytes) break;
    cache.delete(k);
    bytesNoCache -= v.bytes.length;
  }
}

function esquecerToken(token: string | null | undefined) {
  if (!token) return;
  for (const lado of [LIMITES_FOTO.lado, LIMITES_FOTO.ladoPequeno]) {
    const item = cache.get(chaveCache(token, lado));
    if (item) { bytesNoCache -= item.bytes.length; cache.delete(chaveCache(token, lado)); }
  }
}

/** Só para os testes: zera o cache e os baldes. */
export function zerarCacheFotos() {
  cache.clear();
  bytesNoCache = 0;
  baldes.clear();
}

/** O tipo pelos primeiros bytes; qualquer outra coisa (inclusive SVG, GIF, HEIC) é recusada. */
export function tipoDaImagem(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((valor, i) => bytes[i] === valor)) return "png";
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString("latin1") === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString("latin1") === "WEBP") return "webp";
  return null;
}

/** Decodifica o base64 estrito (o mesmo texto volta igual) e confere tamanho e tipo. */
function lerBase64(entrada: unknown): Buffer {
  const { base64 } = (entrada ?? {}) as { base64?: unknown };
  if (typeof base64 !== "string" || base64.length === 0 || base64.length > Math.ceil(LIMITES_FOTO.bytes / 3) * 4) throw new FalhaApi("foto_invalida");
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0 || bytes.length > LIMITES_FOTO.bytes || bytes.toString("base64") !== base64) throw new FalhaApi("foto_invalida");
  if (!tipoDaImagem(bytes)) throw new FalhaApi("foto_invalida");
  return bytes;
}

/** As duas versões em WebP. Falha de leitura (arquivo corrompido, pixels demais) vira `foto_invalida`. */
export async function processarFoto(bytes: Buffer): Promise<{ grande: Buffer; pequena: Buffer }> {
  try {
    const entrada = sharp(bytes, { limitInputPixels: LIMITES_FOTO.pixels, pages: 1, failOn: "error", sequentialRead: true });
    const meta = await entrada.metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) throw new Error("formato");
    const quadrada = await entrada.rotate().resize(LIMITES_FOTO.lado, LIMITES_FOTO.lado, { fit: "cover", position: "centre" }).toColourspace("srgb").png().toBuffer();
    const [grande, pequena] = await Promise.all([
      sharp(quadrada).webp({ quality: 82, effort: 4 }).toBuffer(),
      sharp(quadrada).resize(LIMITES_FOTO.ladoPequeno, LIMITES_FOTO.ladoPequeno).webp({ quality: 80, effort: 4 }).toBuffer(),
    ]);
    return { grande, pequena };
  } catch {
    throw new FalhaApi("foto_invalida");
  }
}

async function contaComPerfil(usuarioId: string) {
  const usuario = await banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { email: true } });
  if (ehEmailVisitante(usuario.email)) throw new FalhaApi("compartilhar_visitante");
}

/** Troca a foto: valida, conta no limite de 10 por hora, processa e grava com token novo. */
export async function salvarFoto(usuarioId: string, entrada: unknown): Promise<void> {
  await contaComPerfil(usuarioId);
  const bytes = lerBase64(entrada);
  const dentro = await banco.$transaction((tx) => consumirLimite(tx, `foto:${usuarioId}`, LIMITE_TROCAS.quantidade, LIMITE_TROCAS.janelaMs));
  if (!dentro) throw new FalhaApi("limite_foto");
  const { grande, pequena } = await processarFoto(bytes);
  const token = randomBytes(12).toString("base64url");
  const dados = { token, grande: new Uint8Array(grande), pequena: new Uint8Array(pequena) };
  const anterior = await banco.fotoPerfil.findUnique({ where: { usuarioId }, select: { token: true } });
  esquecerToken(anterior?.token);
  await banco.fotoPerfil.upsert({ where: { usuarioId }, create: { usuarioId, ...dados }, update: { ...dados, criadaEm: new Date() } });
}

export async function removerFoto(usuarioId: string): Promise<void> {
  const anterior = await banco.fotoPerfil.findUnique({ where: { usuarioId }, select: { token: true } });
  esquecerToken(anterior?.token);
  await banco.fotoPerfil.deleteMany({ where: { usuarioId } });
}

export function limitarLeituraFoto(rede: string) {
  const global = rede === "loopback" || rede === "desconhecido";
  const { quantidade, janelaMs } = global ? LIMITE_LEITURA_GLOBAL : LIMITE_LEITURA;
  const chave = global ? "global" : rede;
  const agora = Date.now();
  let balde = baldes.get(chave);
  if (!balde || agora - balde.inicio >= janelaMs) {
    if (baldes.size > 10_000) for (const [k, v] of baldes) if (agora - v.inicio >= janelaMs) baldes.delete(k);
    balde = { inicio: agora, usados: 0 };
    baldes.set(chave, balde);
  }
  if (balde.usados >= quantidade) throw new FalhaApi("limite_compartilhar");
  balde.usados += 1;
}

/** Os bytes de uma foto pelo token; token fora do formato, trocado ou removido responde igual (não encontrado). */
export async function lerFoto(token: string, tamanho: string): Promise<Buffer> {
  const lado = Number(tamanho) as TamanhoFoto;
  if (!FORMATO_CODIGO.test(token) || (lado !== LIMITES_FOTO.lado && lado !== LIMITES_FOTO.ladoPequeno)) throw new FalhaApi("nao_encontrado");
  const chave = chaveCache(token, lado);
  const guardada = cache.get(chave);
  if (guardada && Date.now() - guardada.em < CACHE.validadeMs) {
    cache.delete(chave);
    cache.set(chave, guardada);
    return guardada.bytes;
  }
  const grande = lado === LIMITES_FOTO.lado;
  const foto = await banco.fotoPerfil.findUnique({ where: { token }, select: { grande, pequena: !grande } });
  const bytes = foto && (grande ? foto.grande : foto.pequena);
  if (!bytes) {
    esquecerToken(token);
    throw new FalhaApi("nao_encontrado");
  }
  const copia = Buffer.from(bytes);
  guardarNoCache(chave, copia);
  return copia;
}
