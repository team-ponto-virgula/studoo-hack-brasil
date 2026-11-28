import { responder, rotaPrivada } from "@/servidor/acesso/http";
import { consultarCriacao } from "@/servidor/aprendizado/servico";

/**
 * O que houve com o aceite de uma proposta (spec 04, Retomada da criação). Só lê o registro do pedido e o plano da conta: não chama a IA, não começa lote e não exige o aceite de IA.
 * O id vem do comprovante da proposta e sozinho não autoriza nada: a consulta é por conta, e o id de outra conta responde "não recebido".
 */
export function GET(request: Request, context: { params: Promise<{ pedidoId: string }> }) {
  return rotaPrivada(request, async (usuarioId) => {
    const { pedidoId } = await context.params;
    return responder(await consultarCriacao(usuarioId, pedidoId));
  });
}
