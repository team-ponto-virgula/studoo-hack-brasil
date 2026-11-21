import { FalhaApi, rotaPrivada } from "@/servidor/acesso/http";
import { lerCampoTexto } from "@/servidor/aprendizado/http";
import { iniciarGeracao } from "@/servidor/aprendizado/geracao";
import { respostaNdjson } from "@/servidor/aprendizado/ndjson";
import { consumirGeracaoPersistente } from "@/servidor/ia/limite";
import { exigirConsentimentoIa } from "@/servidor/privacidade/consentimento";

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    await exigirConsentimentoIa(usuarioId);
    const objetivo = await lerCampoTexto(request, "objetivo");
    const geracao = iniciarGeracao(usuarioId, objetivo, { verificarLimite: false });
    if (!(await consumirGeracaoPersistente(usuarioId))) {
      throw new FalhaApi("limite_geracoes");
    }
    return respostaNdjson((sinal) => geracao.eventos(sinal), request.signal);
  });
}
