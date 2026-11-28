import { CABECALHO_CAPACIDADES, lerCapacidades } from "@studoo/contratos";
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
    const capacidades = lerCapacidades(request.headers.get(CABECALHO_CAPACIDADES));
    const resultado = responder(await avaliarLicao(usuarioId, id, resposta, indice, capacidades));
    resultado.headers.append("Vary", CABECALHO_CAPACIDADES);
    return resultado;
  });
}
