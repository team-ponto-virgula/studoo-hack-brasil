import { lerJson, responder, rotaPublica } from '@/servidor/acesso/http';
import { cookieSessao } from '@/servidor/acesso/origem';
import { redefinirSenha } from '@/servidor/acesso/recuperacao';
export async function POST(request: Request) {
  return rotaPublica(request, async () => {
    const corpo = await lerJson(request) as { email?: unknown; codigo?: unknown; senha?: unknown } | null;
    const resposta = responder(await redefinirSenha(corpo?.email, corpo?.codigo, corpo?.senha));
    resposta.headers.set('Set-Cookie', cookieSessao('', 0));
    return resposta;
  });
}
