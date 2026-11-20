import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { caixa, decidir, detalhe } from "@/servidor/compartilhar/atendimento";
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return rotaPrivada(request, async quem => responder(q.has("alvo") ? await detalhe(quem, q.get("tipo"), q.get("alvo")!) : await caixa(quem, Number(q.get("pagina") || 0))));
}
export function POST(request: Request) {
  return rotaPrivada(request, async quem => responder(await decidir(quem, await lerJson(request, 10000))));
}
