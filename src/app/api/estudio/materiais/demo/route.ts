import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { criarMaterial } from '@/servidor/estudio/materiais';
export const maxDuration = 90;
export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    return responder(await criarMaterial(usuarioId, null, true));
  });
}
