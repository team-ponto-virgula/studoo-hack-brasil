import { FalhaApi, responder, rotaPublica } from "@/servidor/acesso/http";
import { cookieSessao } from "@/servidor/acesso/origem";
import { criarSessaoVisitante, enderecoRede, visitanteAtivo } from "@/servidor/acesso/visitante";

export async function POST(request: Request) {
  return rotaPublica(request, async () => {
    if (!visitanteAtivo()) throw new FalhaApi("nao_encontrado");
    const resultado = await criarSessaoVisitante(enderecoRede(request));
    if (resultado.estado !== "ok") throw new FalhaApi(resultado.estado);

    const resposta = responder({ autenticado: true });
    resposta.headers.set("Set-Cookie", cookieSessao(resultado.token));
    return resposta;
  });
}
