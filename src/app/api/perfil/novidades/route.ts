import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { exigirComunidade } from "@/servidor/compartilhar/servico";
import { novidades } from "@/servidor/compartilhar/seguir";

/** As Novidades da própria pessoa: o que aconteceu com as trilhas dela e quem passou a seguir, nos últimos 7 dias. */
export function GET(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirComunidade();
    return responder(await novidades(usuarioId));
  });
}
