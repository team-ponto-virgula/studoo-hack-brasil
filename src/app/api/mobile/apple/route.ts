import { lerJson, responder, rotaEntradaMobile } from '@/servidor/acesso/http';
import { entrarApple } from '@/servidor/acesso/apple';

/** Iniciar sessão com a Apple no iPhone: token de identidade + authorizationCode + nonce bruto → sessão do app. */
export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => responder(await entrarApple(await lerJson(request, 16_384))));
}
