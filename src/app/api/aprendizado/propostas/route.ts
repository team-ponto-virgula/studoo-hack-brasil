import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerCampoTexto } from "@/servidor/aprendizado/http";
import { gerarProposta } from "@/servidor/aprendizado/servico";

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    const objetivo = await lerCampoTexto(request, "objetivo");
    return responder(gerarProposta(usuarioId, objetivo));
  });
}
