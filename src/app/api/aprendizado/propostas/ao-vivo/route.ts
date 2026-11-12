import { rotaPrivada } from "@/servidor/acesso/http";
import { lerCampoTexto } from "@/servidor/aprendizado/http";
import { iniciarGeracao } from "@/servidor/aprendizado/geracao";
import { respostaNdjson } from "@/servidor/aprendizado/ndjson";

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    const objetivo = await lerCampoTexto(request, "objetivo");
    const geracao = iniciarGeracao(usuarioId, objetivo);
    return respostaNdjson((sinal) => geracao.eventos(sinal), request.signal);
  });
}
