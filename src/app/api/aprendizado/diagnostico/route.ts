import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { iniciarDiagnostico, responderDiagnostico } from '@/servidor/aprendizado/diagnostico';
import { lerObjeto } from '@/servidor/aprendizado/http';
import { exigirConsentimentoIa } from '@/servidor/privacidade/consentimento';

export const maxDuration = 90;

export function POST(request: Request) {
  return rotaPrivada(request, async usuarioId => {
    await exigirConsentimentoIa(usuarioId);
    const entrada = await lerObjeto(request);
    return responder(await (entrada.id === undefined
      ? iniciarDiagnostico(usuarioId, entrada.objetivo)
      : responderDiagnostico(usuarioId, entrada)));
  });
}
