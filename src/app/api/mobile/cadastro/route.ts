import { lerJson, responder, rotaEntradaMobile } from '@/servidor/acesso/http';
import { cadastrar } from '@/servidor/acesso/cadastro';

export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown; codigo?: unknown; senha?: unknown } | null;
    const sessao = await cadastrar(corpo?.email, corpo?.codigo, corpo?.senha, 'MOBILE');
    return responder({ token: sessao.token, expiraEm: sessao.expiraEm.toISOString() }, 201);
  });
}
