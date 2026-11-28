import { randomBytes } from "node:crypto";
import { banco } from "@/servidor/banco/cliente";
import type { CanalSessao } from "@/servidor/banco/gerado/client";
import { duracaoSessaoVisitante } from "./origem";
import { consumirLimite } from "./seguranca";
import { criarSessao } from "./sessao";

export const PREFIXO_EMAIL_VISITANTE = "visitante+";
export const DOMINIO_EMAIL_VISITANTE = "@visitante.studoo.local";
export const PRAZO_VISITANTE_MS = 24 * 60 * 60 * 1000;

const JANELA_PADRAO_MIN = 15;
const LIMITE_IP_PADRAO = 20;
const LIMITE_GLOBAL_PADRAO = 120;

function inteiroPositivo(valor: string | undefined, padrao: number): number {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

export function visitanteAtivo() {
  return process.env.STUDOO_VISITANTE === "1";
}

export function ehEmailVisitante(email: string) {
  return email.startsWith(PREFIXO_EMAIL_VISITANTE) && email.endsWith(DOMINIO_EMAIL_VISITANTE);
}

export function timestampEmailVisitante(email: string): number | null {
  if (!ehEmailVisitante(email)) return null;
  const inicio = PREFIXO_EMAIL_VISITANTE.length;
  const traco = email.indexOf("-", inicio);
  if (traco <= inicio) return null;
  const valor = Number(email.slice(inicio, traco));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

export function enderecoRede(request: Request): string {
  if (process.env.STUDOO_PROXY_HTTPS !== "1") return "loopback";
  const encaminhado = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return encaminhado || real || "desconhecido";
}

type ResultadoVisitante =
  | { estado: "ok"; token: string; expiraEm: Date; usuarioId: string }
  | { estado: "limite_visitante" };

export async function criarSessaoVisitante(rede: string, canal: CanalSessao = "WEB"): Promise<ResultadoVisitante> {
  const limiteIp = inteiroPositivo(process.env.STUDOO_LIMITE_VISITANTES_IP, LIMITE_IP_PADRAO);
  const janelaMs = inteiroPositivo(process.env.STUDOO_JANELA_VISITANTES_MIN, JANELA_PADRAO_MIN) * 60_000;
  const limiteGlobal = inteiroPositivo(process.env.STUDOO_LIMITE_VISITANTES_GLOBAL, LIMITE_GLOBAL_PADRAO);

  return banco.$transaction(async (tx): Promise<ResultadoVisitante> => {
    const dentroIp = await consumirLimite(tx, `visitante:ip:${rede}`, limiteIp, janelaMs);
    if (!dentroIp) return { estado: "limite_visitante" };

    const dentroGlobal = await consumirLimite(tx, "visitante:global", limiteGlobal, 60 * 60_000);
    if (!dentroGlobal) return { estado: "limite_visitante" };

    const email = `${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${randomBytes(6).toString("hex")}${DOMINIO_EMAIL_VISITANTE}`;
    const usuario = await tx.usuario.create({
      data: { email, senhaHash: null, fuso: "America/Sao_Paulo" },
      select: { id: true },
    });
    const sessao = await criarSessao(usuario.id, canal, tx, duracaoSessaoVisitante);
    return { estado: "ok", usuarioId: usuario.id, ...sessao };
  });
}
