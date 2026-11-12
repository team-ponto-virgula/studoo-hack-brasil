import { FalhaApi, responder, rotaPrivada } from "@/servidor/acesso/http";
import { cookieSessao, lerCookieSessao } from "@/servidor/acesso/origem";
import { revogarSessao } from "@/servidor/acesso/sessao";

export async function GET(request: Request) {
  return rotaPrivada(request, async () => responder({ autenticado: true }));
}

export async function DELETE(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    const token = lerCookieSessao(request);
    if (!token) throw new FalhaApi("nao_autenticado");
    await revogarSessao(usuarioId, token);
    const resposta = responder(null, 204);
    resposta.headers.set("Set-Cookie", cookieSessao("", 0));
    return resposta;
  });
}
