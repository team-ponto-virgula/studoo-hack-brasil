import { responder, rotaEntradaMobile } from '@/servidor/acesso/http';
import { emitirNonceApple } from '@/servidor/acesso/apple';
import { enderecoRede } from '@/servidor/acesso/visitante';

/** Nonce de uso único para Iniciar sessão com a Apple (o app manda o hash SHA-256 dele à Apple). */
export async function POST(request: Request) {
  return rotaEntradaMobile(request, async () => responder(await emitirNonceApple(enderecoRede(request))));
}
