import { FalhaApi, lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { encerrarChamadaVozAoVivo, vozAoVivoAtiva } from "@/servidor/ia/realtime";

export async function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    if (!vozAoVivoAtiva()) throw new FalhaApi("nao_encontrado");
    const corpo = await lerJson(request, 4096) as { chamadaId?: unknown };
    if (!corpo || typeof corpo.chamadaId !== "string") throw new FalhaApi("invalido");
    await encerrarChamadaVozAoVivo(usuarioId, corpo.chamadaId);
    return responder(null, 204);
  });
}
