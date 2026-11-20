import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { proporMaterial } from '@/servidor/estudio/materiais';
import { campo } from '@/servidor/estudio/http';
import { exigirConsentimentoIa } from '@/servidor/privacidade/consentimento';
export const maxDuration = 90;
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return rotaPrivada(request, async (usuarioId) => {
    await exigirConsentimentoIa(usuarioId);
    const { id } = await context.params;
    return responder(
      await proporMaterial(usuarioId, id, await campo(request, 'objetivo')),
    );
  });
}
