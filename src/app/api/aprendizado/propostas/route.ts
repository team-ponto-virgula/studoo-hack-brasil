import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { lerCampoTexto } from "@/servidor/aprendizado/http";
import { gerarProposta } from "@/servidor/aprendizado/servico";
import { exigirConsentimentoIa } from "@/servidor/privacidade/consentimento";

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    await exigirConsentimentoIa(usuarioId);
    const objetivo = await lerCampoTexto(request, "objetivo");
    return responder(await gerarProposta(usuarioId, objetivo));
  });
}
