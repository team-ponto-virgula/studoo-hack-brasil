import { FalhaApi, lerJson, responder, rotaPublica } from "@/servidor/acesso/http";
import { cookieSessao } from "@/servidor/acesso/origem";
import { entrar } from "@/servidor/acesso/sessao";

export async function POST(request: Request) {
  return rotaPublica(request, async () => {
    const corpo = (await lerJson(request).catch(() => null)) as { email?: unknown; senha?: unknown } | null;
    const resultado = await entrar(corpo?.email, corpo?.senha);
    if (resultado.estado !== "ok") throw new FalhaApi(resultado.estado);

    const resposta = responder({ autenticado: true });
    resposta.headers.set("Set-Cookie", cookieSessao(resultado.token));
    return resposta;
  });
}
