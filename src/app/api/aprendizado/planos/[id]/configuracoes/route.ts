import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { obterConfiguracoes, salvarConfiguracoes } from "@/servidor/aprendizado/configuracoes";

/** As configurações da trilha (lote 4). Só a dona; de outra pessoa, `nao_encontrado`. */
export function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    return responder(await obterConfiguracoes(usuarioId, id));
  });
}

/** Grava um ou mais campos (nome, descrição, tema, capa da galeria) e devolve as configurações atualizadas. */
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    const corpo = await request.json().catch(() => null);
    return responder(await salvarConfiguracoes(usuarioId, id, corpo));
  });
}
