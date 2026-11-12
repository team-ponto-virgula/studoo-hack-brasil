import { FalhaApi, lerJson, responder, rotaEntradaMobile } from "@/servidor/acesso/http";
import { entrar } from "@/servidor/acesso/sessao";

export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => {
    const corpo = (await lerJson(request).catch(() => null)) as { email?: unknown; senha?: unknown } | null;
    const resultado = await entrar(corpo?.email, corpo?.senha, "MOBILE");
    if (resultado.estado !== "ok") throw new FalhaApi(resultado.estado);

    return responder({ token: resultado.token, expiraEm: resultado.expiraEm.toISOString() });
  });
}
