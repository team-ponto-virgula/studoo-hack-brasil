import { responder, rotaPublica } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { exigirCompartilhar, limitarPublico, perfilPublico } from "@/servidor/compartilhar/servico";

/** Perfil público: nome, cor e as trilhas marcadas. Sem nenhuma marcada, o perfil não existe (`nao_encontrado`). */
export function GET(request: Request, context: { params: Promise<{ perfilId: string }> }) {
  return rotaPublica(request, async () => {
    exigirCompartilhar();
    await limitarPublico(enderecoRede(request));
    const { perfilId } = await context.params;
    return responder(await perfilPublico(perfilId));
  });
}
