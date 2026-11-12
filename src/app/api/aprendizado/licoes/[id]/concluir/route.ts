import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerCampoTexto } from "@/servidor/aprendizado/http";
import { concluirLicao } from "@/servidor/aprendizado/servico";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    const comprovante = await lerCampoTexto(request, "comprovante");
    return responder(await concluirLicao(usuarioId, id, comprovante));
  });
}
