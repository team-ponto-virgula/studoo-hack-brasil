import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { criarMaterial } from '@/servidor/estudio/materiais';
import { lerArquivo } from '@/servidor/estudio/http';
import { exigirConsentimentoIa } from '@/servidor/privacidade/consentimento';
export const maxDuration = 120;
export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    await exigirConsentimentoIa(usuarioId);
    return responder(await criarMaterial(usuarioId, await lerArquivo(request)));
  });
}
