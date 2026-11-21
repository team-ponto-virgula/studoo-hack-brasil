import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { exigirCompartilhar, obterPerfil, salvarPerfil } from "@/servidor/compartilhar/servico";

/** O perfil da própria pessoa (nome, cor, links que compartilha). Com `STUDOO_COMPARTILHAR=1`. */
export function GET(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    return responder(await obterPerfil(usuarioId));
  });
}

/** Salva nome e cor (e cria o id público na primeira vez). Conta de visitante não tem perfil. */
export function PUT(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    return responder(await salvarPerfil(usuarioId, await lerJson(request, 1024)));
  });
}
