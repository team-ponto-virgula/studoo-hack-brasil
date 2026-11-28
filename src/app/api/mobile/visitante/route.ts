import { FalhaApi, responder, rotaEntradaMobile } from "@/servidor/acesso/http";
import { criarSessaoVisitante, enderecoRede, visitanteAtivo } from "@/servidor/acesso/visitante";

export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => {
    if (!visitanteAtivo()) throw new FalhaApi("nao_encontrado");
    const resultado = await criarSessaoVisitante(enderecoRede(request), "MOBILE");
    if (resultado.estado !== "ok") throw new FalhaApi(resultado.estado);

    return responder({ token: resultado.token, expiraEm: resultado.expiraEm.toISOString() });
  });
}
