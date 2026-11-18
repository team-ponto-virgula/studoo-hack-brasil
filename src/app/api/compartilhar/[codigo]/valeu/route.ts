import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { exigirComunidade } from "@/servidor/compartilhar/servico";
import { valeu } from "@/servidor/compartilhar/comunidade";

/** Valeu `{ ativo }`: liga ou desliga; devolve o total e se a pessoa mandou. */
export function POST(request: Request, context: { params: Promise<{ codigo: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirComunidade();
    const { codigo } = await context.params;
    return responder(await valeu(usuarioId, codigo, await lerJson(request, 128)));
  });
}
