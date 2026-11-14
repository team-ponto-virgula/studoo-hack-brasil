import { lerJson, responder, rotaEntradaMobile } from '@/servidor/acesso/http';
import { solicitarRecuperacao } from '@/servidor/acesso/recuperacao';
export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown; codigo?: unknown; senha?: unknown } | null;
    return responder(await solicitarRecuperacao(corpo?.email));
  });
}
