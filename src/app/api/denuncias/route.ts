import { lerJson, responder, rotaPublicaComSessao } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { exigirCompartilhar } from "@/servidor/compartilhar/servico";
import { denunciar } from "@/servidor/compartilhar/comunidade";
import { lembrarRelato } from "@/servidor/compartilhar/anonimo";

export function POST(request: Request) {
  return rotaPublicaComSessao(request, async usuarioId => {
    exigirCompartilhar();
    const caso = await denunciar(usuarioId, await lerJson(request, 256), enderecoRede(request));
    const resposta = responder(caso);
    if (!usuarioId) lembrarRelato(request, resposta, caso.protocolo);
    return resposta;
  });
}
