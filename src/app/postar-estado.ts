import type { LinkCompartilhado } from '@studoo/contratos';
import type { clienteStudooWeb } from '../contratos/cliente-web';

type ClientePublicacao = Pick<typeof clienteStudooWeb, 'criarLink' | 'definirVisibilidade'>;

// Web e app usam o mesmo estado local, sem antecipar a aprovação do servidor.
export { perfilComLink } from '@studoo/contratos';

export async function salvarPostagem(
  cliente: ClientePublicacao, planoId: string, atual: LinkCompartilhado | undefined,
  ligar: boolean, registrar: (link: LinkCompartilhado) => void, restaurar?: LinkCompartilhado,
) {
  const link = atual ?? await cliente.criarLink(planoId);
  if (!atual) registrar(link);
  const destino = ligar ? (restaurar?.visibilidade === 'explorar' ? 'explorar' : 'perfil') : 'link';
  const publicacao = destino === 'explorar' && restaurar?.tema
    ? { tema: restaurar.tema, legenda: restaurar.legenda ?? undefined }
    : undefined;
  const salvo = await cliente.definirVisibilidade(link.codigo, destino, publicacao);
  registrar(salvo);
  return salvo;
}
