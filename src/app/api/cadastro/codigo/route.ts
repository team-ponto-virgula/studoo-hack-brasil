import { lerJson, responder, rotaPublica } from '@/servidor/acesso/http';
import { pedirCodigoCadastro } from '@/servidor/acesso/cadastro';
import { enderecoRede } from '@/servidor/acesso/visitante';

/** Código de posse do e-mail para criar conta (resposta sempre neutra). */
export async function POST(request: Request) {
  return rotaPublica(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown } | null;
    return responder(await pedirCodigoCadastro(corpo?.email, enderecoRede(request)));
  });
}
