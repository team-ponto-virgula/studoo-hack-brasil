import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { exigirComunidade } from "@/servidor/compartilhar/servico";
import { denunciar } from "@/servidor/compartilhar/comunidade";

/** Denunciar trilha ou perfil `{ alvoTipo, alvo, motivo }`. */
export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirComunidade();
    return responder(await denunciar(usuarioId, await lerJson(request, 256)));
  });
}
