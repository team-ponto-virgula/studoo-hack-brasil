import { createHmac, timingSafeEqual } from "node:crypto";
import { esqueletoValido, type EsqueletoPlano } from "@/dominio/aprendizado/plano";

// Uma proposta carrega o esqueleto do plano (títulos). Com 8 fluxos de 8 lições cabe com folga.
const TAMANHO_MAXIMO = 6000;

type TipoComprovante = "proposta" | "avaliacao";

type Comprovante = {
  id: string;
  expiraEm: number;
  plano?: EsqueletoPlano;
};

function assinatura(tipo: TipoComprovante, usuarioId: string, corpo: string): string {
  const chave = process.env.STUDOO_CHAVE_ASSINATURA;
  if (!chave || !/^(?:[\da-f]{2}){32,}$/i.test(chave)) {
    throw new Error("Chave de assinatura local inválida.");
  }

  return createHmac("sha256", Buffer.from(chave, "hex"))
    .update(JSON.stringify([tipo, usuarioId, corpo]))
    .digest("base64url");
}

export function emitirComprovante(tipo: TipoComprovante, usuarioId: string, dados: Comprovante): string {
  const corpo = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return `${corpo}.${assinatura(tipo, usuarioId, corpo)}`;
}

export function lerComprovante(tipo: TipoComprovante, usuarioId: string, token: string): Comprovante | null {
  if (token.length > TAMANHO_MAXIMO) {
    return null;
  }

  const partes = /^([\w-]+)\.([\w-]{43})$/.exec(token);
  if (!partes) {
    return null;
  }

  const [, corpo, recebida] = partes;
  const esperada = assinatura(tipo, usuarioId, corpo);
  if (!timingSafeEqual(Buffer.from(esperada), Buffer.from(recebida))) {
    return null;
  }

  const dados: unknown = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
  if (typeof dados !== "object" || dados === null || !("id" in dados) || !("expiraEm" in dados)) {
    return null;
  }

  const { id, expiraEm } = dados;
  const plano = "plano" in dados ? dados.plano : undefined;
  if (typeof id !== "string" || typeof expiraEm !== "number" || !Number.isSafeInteger(expiraEm) ||
      (plano !== undefined && !esqueletoValido(plano))) {
    return null;
  }

  return { id, expiraEm, ...(plano && { plano }) };
}
