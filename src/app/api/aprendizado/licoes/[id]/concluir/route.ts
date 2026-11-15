import { AUTOAVALIACOES, type AutoAvaliacao } from "@studoo/contratos";
import { FalhaApi, responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerObjeto } from "@/servidor/aprendizado/http";
import { concluirLicao } from "@/servidor/aprendizado/servico";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    const { comprovante, pratica } = await lerObjeto(request);
    // `pratica`: como foi a prática no mundo real, quando a lição tem uma.
    if (typeof comprovante !== "string" || (pratica !== undefined && !AUTOAVALIACOES.includes(pratica as AutoAvaliacao))) {
      throw new FalhaApi("invalido");
    }
    return responder(await concluirLicao(usuarioId, id, comprovante, pratica as AutoAvaliacao | undefined));
  });
}
