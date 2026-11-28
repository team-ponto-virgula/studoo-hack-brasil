import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { estadoPrivacidade } from "@/servidor/privacidade/consentimento";

/** O aceite do envio a IA de terceiros e quem recebe o quê (web com cookie, app com Bearer; visitante também). */
export function GET(request: Request) {
  return rotaPrivada(request, async (usuarioId) => responder(await estadoPrivacidade(usuarioId)));
}
