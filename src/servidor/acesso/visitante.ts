import { randomBytes } from "node:crypto";
import { banco } from "@/servidor/banco/cliente";
import { consumirLimite } from "./seguranca";
import { criarSessao } from "./sessao";

export const PREFIXO_EMAIL_VISITANTE = "visitante+";
export const DOMINIO_EMAIL_VISITANTE = "@visitante.studoo.local";
export const PRAZO_VISITANTE_MS = 24 * 60 * 60 * 1000;

const JANELA_CRIACAO_MS = 15 * 60_000;
const LIMITE_POR_IP = 5;
const LIMITE_GLOBAL_HORA = 60;

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
  | { estado: "limite_login" };

export async function criarSessaoVisitante(rede: string): Promise<ResultadoVisitante> {
  return banco.$transaction(async (tx): Promise<ResultadoVisitante> => {
    const dentroIp = await consumirLimite(tx, `visitante:ip:${rede}`, LIMITE_POR_IP, JANELA_CRIACAO_MS);
    if (!dentroIp) return { estado: "limite_login" };

    const dentroGlobal = await consumirLimite(tx, "visitante:global", LIMITE_GLOBAL_HORA, 60 * 60_000);
    if (!dentroGlobal) return { estado: "limite_login" };

    const email = `${PREFIXO_EMAIL_VISITANTE}${Date.now()}-${randomBytes(6).toString("hex")}${DOMINIO_EMAIL_VISITANTE}`;
    const usuario = await tx.usuario.create({
      data: { email, senhaHash: null, fuso: "America/Sao_Paulo" },
      select: { id: true },
    });
    const sessao = await criarSessao(usuario.id, "WEB", tx);
    return { estado: "ok", usuarioId: usuario.id, ...sessao };
  });
}
