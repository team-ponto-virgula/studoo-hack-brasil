import { confirmacaoExclusaoValida } from "@studoo/contratos/privacidade";
import { FalhaApi } from "@/servidor/acesso/http";
import { banco } from "@/servidor/banco/cliente";
import { encerrarChamadasDoUsuario } from "@/servidor/ia/realtime";
import { revogarApple } from "@/servidor/acesso/apple";

/**
 * Exclusão da conta pelo próprio app (App Review 5.1.1(v)): apaga no ato, numa transação, a conta e tudo o que é dela.
 * Não é desativação nem pedido por e-mail.
 *
 * - Trilhas, trechos, lições, progresso, apoio, capas, links e publicações no Explorar (os links somem, então quem
 *   abrir recebe "link inativo"); materiais enviados; foto e perfil; quem segue e quem é seguido; valeus e adições;
 *   vínculos com as denúncias e os alvos excluídos; recuperação de senha; códigos do
 *   Google; sessões de todos os aparelhos (web e app).
 * - Cópias que outras pessoas já adicionaram são delas: continuam, mas perdem o nome e o perfil de quem compartilhou.
 * - Conversa de voz ao vivo aberta é encerrada na OpenAI.
 * - Conta com Iniciar sessão com a Apple: o token é revogado na Apple (TN3194) logo depois de apagar. Se a Apple falhar,
 *   a exclusão continua valendo e a falha fica registrada sem token nem e-mail.
 *
 * Contadores de limite (`TentativaLogin`) guardam só um HMAC do escopo, sem o id legível, e vencem sozinhos.
 */
export async function excluirConta(usuarioId: string, confirmacao: unknown): Promise<void> {
  if (typeof confirmacao !== "string" || !confirmacaoExclusaoValida(confirmacao)) throw new FalhaApi("confirmacao_invalida");

  const apple = await banco.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { perfilId: true, appleRenovacao: true, appleCliente: true } });
    if (!usuario) throw new FalhaApi("nao_autenticado");

    const links = (await tx.linkTrilha.findMany({ where: { usuarioId }, select: { codigo: true } })).map(({ codigo }) => codigo);
    const relatos = await tx.denuncia.findMany({ where: { OR: [
      ...(usuario.perfilId ? [{ alvoTipo: "perfil", alvo: usuario.perfilId }] : []),
      ...(links.length ? [{ alvoTipo: "trilha", alvo: { in: links } }] : []),
    ] }, select: { id: true, estado: true } });
    for (const relato of relatos) {
      // O protocolo da pessoa que denunciou continua consultável sem guardar o identificador público excluído.
      await tx.denuncia.update({ where: { id: relato.id }, data: {
        alvo: "retirado-" + relato.id,
        ...(relato.estado === "aberto" ? { estado: "encerrado", resposta: "A publicação foi retirada." } : {}),
      } });
    }
    if (usuario.perfilId) {
      await tx.planoAprendizado.updateMany({
        where: { origemPerfilId: usuario.perfilId, NOT: { usuarioId } },
        data: { origemNome: null, origemPerfilId: null },
      });
    }

    // Sem cascata no esquema para estes: a ordem respeita as chaves (registro e apoio → lição → trecho → trilha).
    await tx.registroEstudo.deleteMany({ where: { usuarioId } });
    await tx.apoioLicao.deleteMany({ where: { usuarioId } });
    await tx.licao.deleteMany({ where: { usuarioId } });
    await tx.fluxo.deleteMany({ where: { usuarioId } });
    // Links, eventos dos links e capas caem em cascata com a trilha.
    await tx.planoAprendizado.deleteMany({ where: { usuarioId } });
    await tx.sessao.deleteMany({ where: { usuarioId } });
    // O resto cai em cascata com a conta: materiais, foto, eventos, bloqueios, seguir, recuperação, Google. As denúncias perdem o vínculo com a conta.
    await tx.usuario.delete({ where: { id: usuarioId } });
    return { renovacao: usuario.appleRenovacao, cliente: usuario.appleCliente };
  });

  await encerrarChamadasDoUsuario(usuarioId);
  await revogarApple(apple.renovacao, apple.cliente);
}
