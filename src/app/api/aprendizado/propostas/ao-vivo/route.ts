import { diagnosticoDaGeracao } from '@/servidor/aprendizado/diagnostico';
import { FalhaApi, rotaPrivada } from "@/servidor/acesso/http";
import { lerObjeto } from "@/servidor/aprendizado/http";
import { iniciarGeracao } from "@/servidor/aprendizado/geracao";
import { respostaNdjson } from "@/servidor/aprendizado/ndjson";
import { consumirGeracaoPersistente } from "@/servidor/ia/limite";
import { exigirConsentimentoIa } from "@/servidor/privacidade/consentimento";

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    await exigirConsentimentoIa(usuarioId);
    const { objetivo, diagnosticoId } = await lerObjeto(request);
    if (typeof objetivo !== "string") throw new FalhaApi("invalido");
    const diagnostico = await diagnosticoDaGeracao(usuarioId, objetivo, diagnosticoId);
    const geracao = iniciarGeracao(usuarioId, objetivo, { verificarLimite: false, diagnostico });
    if (!(await consumirGeracaoPersistente(usuarioId))) {
      throw new FalhaApi("limite_geracoes");
    }
    return respostaNdjson((sinal) => geracao.eventos(sinal), request.signal);
  });
}
