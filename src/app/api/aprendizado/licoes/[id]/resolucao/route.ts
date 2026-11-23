import { FalhaApi, responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerObjeto } from "@/servidor/aprendizado/http";
import { responderSuaVezDaLicao } from "@/servidor/aprendizado/servico";

/**
 * O "Sua vez" do "Resolva comigo": `{ opcao: 0 a 2, tentativa: 1 ou 2 }`. Acertou ou errou pela segunda vez: a revelação do passo e
 * os passos que faltam; errou a primeira: só o porquê da opção. Não conta no progresso nem no comprovante.
 */
export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    const { opcao, tentativa } = await lerObjeto(request);
    if (typeof opcao !== "number" || !Number.isInteger(opcao) || opcao < 0 || opcao > 2 || (tentativa !== 1 && tentativa !== 2)) {
      throw new FalhaApi("invalido");
    }
    return responder(await responderSuaVezDaLicao(usuarioId, id, { opcao, tentativa }));
  });
}
