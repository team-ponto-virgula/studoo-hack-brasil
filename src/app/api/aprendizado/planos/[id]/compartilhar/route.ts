import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { criarLink, exigirCompartilhar, previaCompartilhar } from "@/servidor/compartilhar/servico";

type Contexto = { params: Promise<{ id: string }> };

/** O que a folha "Compartilhar trilha" mostra para a dona (e o link, se já existir). */
export function GET(request: Request, context: Contexto) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    const { id } = await context.params;
    return responder(await previaCompartilhar(usuarioId, id));
  });
}

/** Cria o link da trilha (ou devolve o que já existe). Só a dona; trilha de outra pessoa responde `nao_encontrado`. */
export function POST(request: Request, context: Contexto) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    const { id } = await context.params;
    return responder(await criarLink(usuarioId, id));
  });
}
