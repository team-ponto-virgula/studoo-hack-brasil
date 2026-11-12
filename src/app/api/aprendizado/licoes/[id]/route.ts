import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { buscarLicao } from "@/servidor/aprendizado/servico";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    return responder(await buscarLicao(usuarioId, id));
  });
}
