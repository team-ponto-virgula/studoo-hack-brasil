import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { desbloquear } from "@/servidor/compartilhar/visibilidade";
export function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async quem => {
    await desbloquear(quem, (await ctx.params).id);
    return responder(null, 204);
  });
}
