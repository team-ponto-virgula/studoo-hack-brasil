import { LIMITES_FOTO } from "@studoo/contratos";
import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { exigirCompartilhar, obterPerfil } from "@/servidor/compartilhar/servico";
import { removerFoto, salvarFoto } from "@/servidor/compartilhar/foto";

/** Troca a foto do perfil (quadrado já recortado, em base64). Responde o perfil com o token novo. */
export function PUT(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    // Base64 de 2 MB mais a moldura do JSON.
    await salvarFoto(usuarioId, await lerJson(request, Math.ceil(LIMITES_FOTO.bytes / 3) * 4 + 256));
    return responder(await obterPerfil(usuarioId));
  });
}

/** Remove a foto: volta a inicial na cor, e o endereço antigo deixa de existir. */
export function DELETE(request: Request) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    await removerFoto(usuarioId);
    return responder(await obterPerfil(usuarioId));
  });
}
