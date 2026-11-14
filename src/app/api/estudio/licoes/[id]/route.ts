import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { buscarApoio } from '@/servidor/estudio/apoio';
export const maxDuration = 90;
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    return responder(await buscarApoio(usuarioId, id));
  });
}
