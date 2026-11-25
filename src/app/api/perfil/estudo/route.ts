import { responder, rotaPrivada } from '@/servidor/acesso/http';
import { progressoNoPerfil } from '@/servidor/aprendizado/progresso-perfil';
import { banco } from '@/servidor/banco/cliente';

export function GET(request: Request) {
  return rotaPrivada(request, async usuarioId => {
    const { fuso } = await banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { fuso: true } });
    return responder(await progressoNoPerfil(usuarioId, fuso));
  });
}
