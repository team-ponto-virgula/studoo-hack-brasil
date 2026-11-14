import { LIMITES_ESTUDIO } from '@studoo/contratos';
import { FalhaApi, lerJson } from '../acesso/http';
export const lerArquivo = (request: Request) =>
  lerJson(request, Math.ceil(LIMITES_ESTUDIO.arquivoBytes / 3) * 4 + 1024);
export async function campo(request: Request, nome: string) {
  const corpo = await lerJson(request, 16384);
  if (
    !corpo ||
    typeof corpo !== 'object' ||
    !(nome in corpo) ||
    typeof (corpo as Record<string, unknown>)[nome] !== 'string'
  )
    throw new FalhaApi('invalido');
  return (corpo as Record<string, string>)[nome];
}
