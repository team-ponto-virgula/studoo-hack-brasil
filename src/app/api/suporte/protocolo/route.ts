import { lerJson, responder, rotaPublicaComSessao } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { acompanhar } from "@/servidor/compartilhar/atendimento";
export function POST(request: Request) {
  return rotaPublicaComSessao(request, async () => {
    const body = await lerJson(request, 256) as { protocolo?: unknown } | null;
    return responder(await acompanhar(body?.protocolo, enderecoRede(request)));
  });
}
