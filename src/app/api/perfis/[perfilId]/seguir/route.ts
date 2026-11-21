import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { exigirComunidade } from "@/servidor/compartilhar/servico";
import { seguir } from "@/servidor/compartilhar/seguir";

/** Seguir `{ ativo }` um perfil público: devolve se segue e a contagem de seguidores (nunca a lista). */
export function POST(request: Request, context: { params: Promise<{ perfilId: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirComunidade();
    const { perfilId } = await context.params;
    return responder(await seguir(usuarioId, perfilId, await lerJson(request, 128)));
  });
}
