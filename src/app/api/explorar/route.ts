import { responder, rotaPublicaComSessao } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { exigirComunidade, limitarPublico } from "@/servidor/compartilhar/servico";
import { explorar } from "@/servidor/compartilhar/comunidade";

/** Explorar (pública; ver não pede conta): "Em alta esta semana" e "Novas", com filtro de tema e cursor. */
export function GET(request: Request) {
  return rotaPublicaComSessao(request, async (usuarioId) => {
    exigirComunidade();
    await limitarPublico(enderecoRede(request));
    const busca = new URL(request.url).searchParams;
    return responder(await explorar(usuarioId, { tema: busca.get("tema"), cursor: busca.get("cursor") }));
  });
}
