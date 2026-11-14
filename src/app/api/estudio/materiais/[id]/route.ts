import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { excluirMaterial } from '@/servidor/estudio/materiais';
export const maxDuration = 90;
export function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    await excluirMaterial(usuarioId, id);
    return responder(null, 204);
  });
}
