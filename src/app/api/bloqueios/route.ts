import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { exigirCompartilhar } from "@/servidor/compartilhar/servico";
import { bloqueados, bloquear } from "@/servidor/compartilhar/visibilidade";

export function GET(request: Request) {
  return rotaPrivada(request, async quem => { exigirCompartilhar(); return responder(await bloqueados(quem)); });
}
export function POST(request: Request) {
  return rotaPrivada(request, async quem => { exigirCompartilhar(); return responder(await bloquear(quem, await lerJson(request, 256))); });
}
