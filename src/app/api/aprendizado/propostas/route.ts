import { diagnosticoDaGeracao } from '@/servidor/aprendizado/diagnostico';
import { FalhaApi, responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerObjeto } from "@/servidor/aprendizado/http";
import { gerarProposta } from "@/servidor/aprendizado/servico";
import { exigirConsentimentoIa } from "@/servidor/privacidade/consentimento";

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    await exigirConsentimentoIa(usuarioId);
    const { objetivo, diagnosticoId } = await lerObjeto(request);
    if (typeof objetivo !== "string") throw new FalhaApi("invalido");
    const evidencias = await diagnosticoDaGeracao(usuarioId, objetivo, diagnosticoId);
    return responder(await gerarProposta(usuarioId, objetivo, evidencias?.diagnostico, evidencias?.amostrasDemonstradas));
  });
}
