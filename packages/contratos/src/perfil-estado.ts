import type { LinkCompartilhado, Perfil } from './compartilhar';

/** A mesma regra da API: o perfil e a trilha precisam de aprovação. Sem os campos, vale o contrato anterior à moderação. */
export function linksPublicosNoPerfil(perfil: Pick<Perfil, 'perfilModeracao' | 'links'>): LinkCompartilhado[] {
  if (perfil.perfilModeracao !== undefined && perfil.perfilModeracao !== 'aprovado') return [];
  return perfil.links.filter(link => link.noPerfil && (link.moderacao === undefined || link.moderacao === 'aprovado'));
}

/** Atualiza a mesma fonte de dados usada pelo cartão, pelo mapa e pela folha, inclusive se só o POST terminou. */
export function perfilComLink(perfil: Perfil, planoId: string, novo: LinkCompartilhado | null): Perfil {
  const antigo = perfil.links.find(link => link.planoId === planoId);
  const links = perfil.links.filter(link => link.planoId !== planoId);
  if (novo) {
    const atual = { ...antigo, ...novo };
    links.splice(antigo ? perfil.links.indexOf(antigo) : 0, 0, atual);
  }
  const noPerfil = links.filter(link => link.noPerfil);
  return {
    ...perfil, links,
    publico: linksPublicosNoPerfil({ ...perfil, links }).length > 0,
    alcance: { ...perfil.alcance, trilhas: noPerfil.length, pessoas: noPerfil.reduce((total, link) => total + link.adicoes, 0) },
  };
}

