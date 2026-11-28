import { lerJson, responder, rotaPublica } from '@/servidor/acesso/http';
import { cadastrar } from '@/servidor/acesso/cadastro';
import { cookieSessao } from '@/servidor/acesso/origem';

/** Confirma o código e cria a conta com senha; entra na hora (cookie da web). */
export async function POST(request: Request) {
  return rotaPublica(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown; codigo?: unknown; senha?: unknown } | null;
    const sessao = await cadastrar(corpo?.email, corpo?.codigo, corpo?.senha, 'WEB');
    const resposta = responder({ autenticado: true }, 201);
    resposta.headers.set('Set-Cookie', cookieSessao(sessao.token));
    return resposta;
  });
}
