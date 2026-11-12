import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerCampoTexto } from "@/servidor/aprendizado/http";
import { aceitarProposta, listarPlanos } from "@/servidor/aprendizado/servico";

export function GET(request: Request) {
  return rotaPrivada(request, async (usuarioId) => responder(await listarPlanos(usuarioId)));
}

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    const token = await lerCampoTexto(request, "token");
    return responder(await aceitarProposta(usuarioId, token));
  });
}
