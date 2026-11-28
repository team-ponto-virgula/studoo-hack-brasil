import { FalhaApi, responder, rotaPublica } from "@/servidor/acesso/http";
import { cookieSessao, duracaoSessaoVisitante, lerCookieSessao } from "@/servidor/acesso/origem";
import { usuarioDaSessao } from "@/servidor/acesso/sessao";
import { criarSessaoVisitante, enderecoRede, visitanteAtivo } from "@/servidor/acesso/visitante";

export async function POST(request: Request) {
  return rotaPublica(request, async () => {
    if (!visitanteAtivo()) throw new FalhaApi("nao_encontrado");
    // Se o navegador já tem uma sessão WEB válida (visitante ou conta), preserva-a para não
    // invalidar outra aba ativa com 401/404; sem sessão válida, cria um visitante isolado novo.
    const tokenAtual = lerCookieSessao(request);
    if (tokenAtual && await usuarioDaSessao(tokenAtual, "WEB")) {
      return responder({ autenticado: true });
    }
    const resultado = await criarSessaoVisitante(enderecoRede(request), "WEB");
    if (resultado.estado !== "ok") throw new FalhaApi(resultado.estado);

    const resposta = responder({ autenticado: true });
    resposta.headers.set("Set-Cookie", cookieSessao(resultado.token, duracaoSessaoVisitante));
    return resposta;
  });
}
