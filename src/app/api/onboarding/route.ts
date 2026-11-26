import { lerJson, responder, rotaPrivada } from '@/servidor/acesso/http';
import { atualizarOnboarding, obterOnboarding } from '@/servidor/onboarding/servico';

export function GET(request: Request) {
  return rotaPrivada(request, async (usuarioId, credencial) => responder(await obterOnboarding(usuarioId, credencial)));
}

export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId, credencial) =>
    responder(await atualizarOnboarding(usuarioId, await lerJson(request), credencial)));
}
