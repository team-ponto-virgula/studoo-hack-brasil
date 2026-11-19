import { LIMITES_FOTO } from "@studoo/contratos";
import { lerJson, responder, rotaPrivada } from "@/servidor/acesso/http";
import { removerCapaFoto, salvarCapaFoto } from "@/servidor/aprendizado/capa";
import { exigirCompartilhar } from "@/servidor/compartilhar/servico";

/** Troca a capa da trilha por uma foto (retângulo 2:1 já recortado, em base64). Responde as configurações. */
export function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    const { id } = await context.params;
    return responder(await salvarCapaFoto(usuarioId, id, await lerJson(request, Math.ceil(LIMITES_FOTO.bytes / 3) * 4 + 256)));
  });
}

/** Tira a foto da capa (volta a capa padrão). */
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    const { id } = await context.params;
    return responder(await removerCapaFoto(usuarioId, id));
  });
}
