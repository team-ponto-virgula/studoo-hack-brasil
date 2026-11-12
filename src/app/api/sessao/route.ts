import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { cookieSessao } from "@/servidor/acesso/origem";
import { revogarSessao } from "@/servidor/acesso/sessao";

export async function GET(request: Request) {
  return rotaPrivada(request, async () => responder({ autenticado: true }));
}

export async function DELETE(request: Request) {
  return rotaPrivada(request, async (usuarioId, { canal, token }) => {
    await revogarSessao(usuarioId, token, canal);
    const resposta = responder(null, 204);
    if (canal === "WEB") resposta.headers.set("Set-Cookie", cookieSessao("", 0));
    return resposta;
  });
}
