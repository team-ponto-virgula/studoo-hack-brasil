import { responder, rotaPublicaComSessao } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { comunidadeAtiva, exigirCompartilhar, limitarPublico, perfilPublico } from "@/servidor/compartilhar/servico";
import { perfilPublicoComCartoes } from "@/servidor/compartilhar/comunidade";

/**
 * Perfil público: nome, cor, foto, resumo, interesses, alcance e as trilhas marcadas (com a comunidade, também como
 * cartões; com sessão, cada cartão diz se a trilha já é da pessoa). Sem nenhuma marcada, o perfil não existe.
 */
export function GET(request: Request, context: { params: Promise<{ perfilId: string }> }) {
  return rotaPublicaComSessao(request, async (usuarioId) => {
    exigirCompartilhar();
    await limitarPublico(enderecoRede(request));
    const { perfilId } = await context.params;
    return responder(comunidadeAtiva() ? await perfilPublicoComCartoes(perfilId, usuarioId) : await perfilPublico(perfilId, usuarioId));
  });
}
