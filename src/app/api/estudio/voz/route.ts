import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { transcrever } from '@/servidor/estudio/voz';
import { lerArquivo } from '@/servidor/estudio/http';
export const maxDuration = 90;
export function POST(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    return responder(await transcrever(usuarioId, await lerArquivo(request)));
  });
}
