import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { apagarPlano, buscarPlano } from "@/servidor/aprendizado/servico";

export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    return responder(await buscarPlano(usuarioId, id));
  });
}

/** Apaga a trilha (com as lições e o progresso dela). Só a dona apaga; de outra pessoa, `nao_encontrado`. */
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    await apagarPlano(usuarioId, id);
    return responder({ apagado: true });
  });
}
