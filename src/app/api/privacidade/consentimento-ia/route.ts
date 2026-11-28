import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { aceitarConsentimentoIa, revogarConsentimentoIa } from "@/servidor/privacidade/consentimento";

/** Aceita a versão vigente do texto (`{ versao }`). Outra versão responde `invalido`. */
export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    const corpo = await lerJson(request, 1024) as { versao?: unknown } | null;
    return responder(await aceitarConsentimentoIa(usuarioId, corpo?.versao));
  });
}

/** Revoga o aceite: as próximas ações com IA de terceiro voltam a pedir. */
export function DELETE(request: Request) {
  return rotaPrivada(request, async (usuarioId) => responder(await revogarConsentimentoIa(usuarioId)));
}
