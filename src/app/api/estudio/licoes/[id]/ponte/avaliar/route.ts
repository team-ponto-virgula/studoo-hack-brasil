import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { avaliarPonte } from '@/servidor/estudio/apoio';
import { campo } from '@/servidor/estudio/http';
export const maxDuration = 90;
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    return responder(
      await avaliarPonte(usuarioId, id, await campo(request, 'resposta')),
    );
  });
}
