import { lerJson, responder, rotaEntradaMobile } from '@/servidor/acesso/http';
import { trocarCodigoMobile } from '@/servidor/acesso/google';
export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => {
    const corpo = await lerJson(request) as { codigo?: unknown; verificador?: unknown } | null;
    return responder(await trocarCodigoMobile(corpo?.codigo, corpo?.verificador));
  });
}
