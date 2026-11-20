import { cabecalhosSeguros, rotaPrivada } from "@/servidor/acesso/http";
import { midiaDaEquipe } from "@/servidor/compartilhar/atendimento";
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return rotaPrivada(request, async quem => new Response(await midiaDaEquipe(quem, q.get("tipo"), q.get("alvo") || ""), {
    headers: { ...cabecalhosSeguros, "Content-Type": "image/webp", "Content-Security-Policy": "default-src 'none'; sandbox" },
  }));
}
