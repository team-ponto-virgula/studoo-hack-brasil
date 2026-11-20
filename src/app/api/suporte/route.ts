import { lerJson, responder, rotaPublicaComSessao } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { pedirAjuda } from "@/servidor/compartilhar/atendimento";
export function POST(request: Request) {
  return rotaPublicaComSessao(request, async () => {
    const body = await lerJson(request, 10000) as { mensagem?: unknown } | null;
    return responder(await pedirAjuda(body?.mensagem, enderecoRede(request)), 201);
  });
}
