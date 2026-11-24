import { lerJson, responder, rotaPublica } from '@/servidor/acesso/http';
import { origemWebDaRequisicao } from '@/servidor/acesso/origem';
import { solicitarRecuperacao } from '@/servidor/acesso/recuperacao';
export async function POST(request: Request) {
  return rotaPublica(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown; codigo?: unknown; senha?: unknown } | null;
    return responder(await solicitarRecuperacao(corpo?.email, origemWebDaRequisicao(request)));
  });
}
