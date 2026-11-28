import { lerJson, responder, rotaPrivada, rotaPublicaComSessao } from "@/servidor/acesso/http";
import { enderecoRede } from "@/servidor/acesso/visitante";
import { alterarLink, encerrarLink, exigirComunidade, exigirCompartilhar, limitarPublico, trilhaCompartilhada } from "@/servidor/compartilhar/servico";
import { definirVisibilidade } from "@/servidor/compartilhar/comunidade";

type Contexto = { params: Promise<{ codigo: string }> };

/**
 * Prévia pública do link (sem login). Com sessão, diz se a trilha já é da pessoa. Link encerrado e inexistente
 * respondem igual (`link_inativo`). Nada de e-mail, id de usuário, objetivo digitado ou progresso.
 */
export function GET(request: Request, context: Contexto) {
  return rotaPublicaComSessao(request, async (usuarioId) => {
    exigirCompartilhar();
    await limitarPublico(enderecoRede(request));
    const { codigo } = await context.params;
    return responder(await trilhaCompartilhada(codigo, usuarioId));
  });
}

/**
 * Mostrar ou não no perfil público (`{ noPerfil }`) ou, com a comunidade, o nível de visibilidade
 * (`{ visibilidade, tema?, legenda? }`). Só a dona; de outra pessoa responde como link inativo.
 */
export function PATCH(request: Request, context: Contexto) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    const { codigo } = await context.params;
    const entrada = await lerJson(request, 2048);
    if (entrada && typeof entrada === "object" && "visibilidade" in entrada) {
      exigirComunidade();
      return responder(await definirVisibilidade(usuarioId, codigo, entrada));
    }
    return responder(await alterarLink(usuarioId, codigo, entrada));
  });
}

/** Parar de compartilhar: o link deixa de funcionar; as cópias de quem já adicionou continuam. */
export function DELETE(request: Request, context: Contexto) {
  return rotaPrivada(request, async (usuarioId) => {
    exigirCompartilhar();
    const { codigo } = await context.params;
    await encerrarLink(usuarioId, codigo);
    return responder({ encerrado: true });
  });
}
