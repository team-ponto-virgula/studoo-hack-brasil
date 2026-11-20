import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { cookieSessao } from "@/servidor/acesso/origem";
import { excluirConta } from "@/servidor/privacidade/conta";

/** Exclui a conta e tudo dela, no ato e em todos os aparelhos (`{ confirmacao: "EXCLUIR" }`). Na web, limpa o cookie. */
export function DELETE(request: Request) {
  return rotaPrivada(request, async (usuarioId, { canal }) => {
    const corpo = await lerJson(request, 1024) as { confirmacao?: unknown } | null;
    await excluirConta(usuarioId, corpo?.confirmacao);
    const resposta = responder(null, 204);
    if (canal === "WEB") resposta.headers.set("Set-Cookie", cookieSessao("", 0));
    return resposta;
  });
}
