import { CONFIRMACAO_EXCLUSAO } from '@studoo/contratos/privacidade';
import { lerNotificacaoApple } from '@/servidor/acesso/apple';
import { cabecalhosSeguros, lerJson } from '@/servidor/acesso/http';
import { banco } from '@/servidor/banco/cliente';
import { excluirConta } from '@/servidor/privacidade/conta';

/**
 * Notificações servidor-a-servidor da Apple (configurar esta URL no Apple Developer, em Sign in with Apple).
 * - `consent-revoked`: a pessoa tirou o Studoo do ID Apple → encerra as sessões e esquece o token.
 * - `account-deleted`: o ID Apple foi apagado → a conta do Studoo é excluída como na exclusão pelo app.
 * Sem origem de navegador; só aceita o JWT assinado pela Apple para um bundle configurado.
 */
export async function POST(request: Request) {
  const responderVazio = (status: number) => new Response(null, { status, headers: cabecalhosSeguros });
  try {
    const corpo = await lerJson(request, 16_384).catch(() => null) as { payload?: unknown } | null;
    const evento = await lerNotificacaoApple(corpo?.payload);
    if (!evento) return responderVazio(400);
    const usuario = await banco.usuario.findUnique({ where: { appleSub: evento.sub }, select: { id: true } });
    if (usuario && evento.tipo === 'consent-revoked') {
      await banco.$transaction([
        banco.sessao.deleteMany({ where: { usuarioId: usuario.id } }),
        banco.usuario.update({ where: { id: usuario.id }, data: { appleRenovacao: null } }),
      ]);
    } else if (usuario && (evento.tipo === 'account-deleted' || evento.tipo === 'account-delete')) {
      await excluirConta(usuario.id, CONFIRMACAO_EXCLUSAO);
    }
    return responderVazio(200);
  } catch {
    console.error(JSON.stringify({ rota: 'apple-notificacoes', codigo: 'falha' }));
    return responderVazio(500);
  }
}
