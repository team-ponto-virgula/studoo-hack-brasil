import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { contaOpaca } from "@/servidor/acesso/conta-opaca";
import { cookieSessao } from "@/servidor/acesso/origem";
import { revogarSessao } from "@/servidor/acesso/sessao";
import { ehEmailVisitante } from "@/servidor/acesso/visitante";
import { banco } from "@/servidor/banco/cliente";

export async function GET(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    const usuario = await banco.usuario.findUnique({ where: { id: usuarioId }, select: { email: true } });
    const conta = contaOpaca(usuarioId);
    return responder({ autenticado: true, visitante: Boolean(usuario && ehEmailVisitante(usuario.email)), ...(conta ? { conta } : {}) });
  });
}

export async function DELETE(request: Request) {
  return rotaPrivada(request, async (usuarioId, { canal, token }) => {
    await revogarSessao(usuarioId, token, canal);
    const resposta = responder(null, 204);
    if (canal === "WEB") resposta.headers.set("Set-Cookie", cookieSessao("", 0));
    return resposta;
  });
}
