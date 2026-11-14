import { lerJson, responder, rotaEntradaMobile } from '@/servidor/acesso/http';
import { redefinirSenha } from '@/servidor/acesso/recuperacao';
export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown; codigo?: unknown; senha?: unknown } | null;
    return responder(await redefinirSenha(corpo?.email, corpo?.codigo, corpo?.senha));
  });
}
