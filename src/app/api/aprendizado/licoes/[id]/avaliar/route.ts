import { FalhaApi, responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerObjeto } from "@/servidor/aprendizado/http";
import { avaliarLicao } from "@/servidor/aprendizado/servico";

export function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { id } = await context.params;
    const { resposta, indice = 0 } = await lerObjeto(request);
    // `indice` escolhe o exercício da lição; sem ele, é o primeiro (clientes antigos).
    if (typeof resposta !== "string" || typeof indice !== "number" || !Number.isInteger(indice) || indice < 0 || indice > 2) {
      throw new FalhaApi("invalido");
    }
    return responder(await avaliarLicao(usuarioId, id, resposta, indice));
  });
}
