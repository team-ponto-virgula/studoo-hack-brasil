import { responder } from "@/servidor/acesso/http";
import { banco } from "@/servidor/banco/cliente";

export async function GET() {
  try {
    await banco.$queryRaw`SELECT 1`;
    return responder({ ok: true, status: "ok" });
  } catch {
    return responder({ ok: false, status: "degradado" }, 503);
  }
}
