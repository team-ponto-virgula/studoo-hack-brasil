import { banco } from '../../src/servidor/banco/cliente.ts';

// Estas suítes começam com uma publicação já revisada. Os casos de entrada e decisão passam pela caixa real na suíte de moderação.
export async function publicacaoRevisada(usuarioId, codigo) {
  await banco.$transaction([
    banco.usuario.update({ where: { id: usuarioId }, data: { perfilModeracao: 'aprovado' } }),
    banco.linkTrilha.update({ where: { codigo }, data: { moderacao: 'aprovado' } }),
  ]);
}
