import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerCampoTexto } from "@/servidor/aprendizado/http";
import { avaliarLicao } from "@/servidor/aprendizado/servico";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    const resposta = await lerCampoTexto(request, "resposta");
    return responder(await avaliarLicao(usuarioId, id, resposta));
  });
}
