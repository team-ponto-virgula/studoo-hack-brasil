import { lerJson, responder, rotaEntradaMobile } from '@/servidor/acesso/http';
import { pedirCodigoCadastro } from '@/servidor/acesso/cadastro';
import { enderecoRede } from '@/servidor/acesso/visitante';

export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown } | null;
    return responder(await pedirCodigoCadastro(corpo?.email, enderecoRede(request)));
  });
}
