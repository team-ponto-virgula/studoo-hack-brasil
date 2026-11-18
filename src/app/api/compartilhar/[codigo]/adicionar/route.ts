import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { adicionarTrilha, exigirCompartilhar } from "@/servidor/compartilhar/servico";

/** Adiciona a cópia às trilhas da pessoa (pronta, sem IA, progresso do zero). O mesmo link de novo não duplica. */
export function POST(request: Request, context: { params: Promise<{ codigo: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    const { codigo } = await context.params;
    return responder(await adicionarTrilha(usuarioId, codigo));
  });
}
