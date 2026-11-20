import type { LinkCompartilhado, Perfil } from '@studoo/contratos';
import type { clienteStudooWeb } from '../contratos/cliente-web';

type ClientePublicacao = Pick<typeof clienteStudooWeb, 'criarLink' | 'definirVisibilidade'>;

/** Atualiza a mesma fonte de dados usada pelo cartão, pelo mapa e pela folha, inclusive se só o POST terminou. */
export function perfilComLink(perfil: Perfil, planoId: string, novo: LinkCompartilhado | null): Perfil {
  const antigo = perfil.links.find(link => link.planoId === planoId);
  const links = perfil.links.filter(link => link.planoId !== planoId);
  if (novo) {
    const atual = { ...antigo, ...novo };
    links.splice(antigo ? perfil.links.indexOf(antigo) : 0, 0, atual);
  }
  const noPerfil = links.filter(link => link.noPerfil);
  const aprovado = perfil.perfilModeracao === undefined || perfil.perfilModeracao === 'aprovado';
  return {
    ...perfil, links,
    publico: aprovado && noPerfil.some(link => link.moderacao === undefined || link.moderacao === 'aprovado'),
    alcance: { ...perfil.alcance, trilhas: noPerfil.length, pessoas: noPerfil.reduce((total, link) => total + link.adicoes, 0) },
  };
}

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
