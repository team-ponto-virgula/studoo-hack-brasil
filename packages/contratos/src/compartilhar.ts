/*
 * Perfis leves e compartilhar trilha (spec 09): o contrato que a web e o app usam. Compartilhar é dar uma cópia: quem
 * abre o link vê uma prévia e adiciona a trilha às próprias, com progresso do zero e sem nada do estudo de quem
 * compartilhou. Tudo atrás de `STUDOO_COMPARTILHAR=1` (o `/api/auth/config` traz `compartilhar`).
 */

/** As seis cores do avatar (a inicial do nome num círculo), na ordem da escolha. */
export const CORES_PERFIL = ['azul', 'verde', 'laranja', 'roxo', 'rosa', 'turquesa'] as const;
export type CorPerfil = (typeof CORES_PERFIL)[number];
/** Fundo de cada cor (texto branco, contraste AA em 1.125rem negrito); a web e o app usam os mesmos valores. */
export const FUNDO_DA_COR: Record<CorPerfil, string> = {
  azul: '#3858d6',
  verde: '#1f7a5a',
  laranja: '#b25400',
  roxo: '#6b46c1',
  rosa: '#b83280',
  turquesa: '#0f7c86',
};

export const LIMITES_PERFIL = { nomeMin: 2, nomeMax: 40 } as const;

/** O nome como fica guardado: NFC, sem espaços nas pontas e com um espaço só entre as palavras. */
export function normalizarNomePerfil(bruto: string): string {
  return bruto.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export type MotivoNomeInvalido = 'curto' | 'longo' | 'caracteres' | 'endereco';

/**
 * Por que o nome (já normalizado) não serve, ou null. Sem HTML (`<`, `>`), sem caracteres de controle ou invisíveis,
 * sem endereço de site nem e-mail. O tamanho conta caracteres visíveis (um emoji composto conta como vários).
 */
export function motivoNomeInvalido(nome: string): MotivoNomeInvalido | null {
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Cs}<>]/u.test(nome)) return 'caracteres';
  const tamanho = [...nome].length;
  if (tamanho < LIMITES_PERFIL.nomeMin) return 'curto';
  if (tamanho > LIMITES_PERFIL.nomeMax) return 'longo';
  if (/@|:\/\/|\bwww\.|[\p{L}\p{N}-]\.[a-z]{2,}(?:[/:]|\b)/iu.test(nome)) return 'endereco';
  return null;
}

/** A inicial do avatar: a primeira letra ou número do nome, em maiúscula. */
export function inicialDoNome(nome: string): string {
  const primeira = [...nome].find((letra) => /[\p{L}\p{N}]/u.test(letra));
  return (primeira ?? '?').toLocaleUpperCase('pt-BR');
}

/** Código do link e id público do perfil: 16 caracteres base64url (96 bits aleatórios). */
export const FORMATO_CODIGO = /^[A-Za-z0-9_-]{16}$/;

/** O código a partir do que a pessoa colou: o endereço inteiro (`…/t/<código>`) ou só o código. */
export function codigoDoLink(entrada: string): string | null {
  const texto = entrada.trim();
  if (FORMATO_CODIGO.test(texto)) return texto;
  const achado = /\/t\/([A-Za-z0-9_-]{16})(?:[/?#]|$)/.exec(texto);
  return achado ? achado[1] : null;
}

/** `materialId` das referências numa cópia: neutro, nunca aponta para o material de quem compartilhou. */
export const MATERIAL_COMPARTILHADO = 'compartilhado';

export interface DonoPublico {
  nome: string;
  cor: CorPerfil;
  /** Só quando a pessoa tem perfil público (ao menos uma trilha marcada para aparecer nele). */
  perfilId: string | null;
}

/** Um link da própria pessoa (só a dona vê `adicoes`). */
export interface LinkCompartilhado {
  codigo: string;
  planoId: string;
  titulo: string;
  criadoEm: string;
  adicoes: number;
  noPerfil: boolean;
}

/** GET /api/perfil */
export interface Perfil {
  nome: string | null;
  cor: CorPerfil | null;
  perfilId: string | null;
  /** Ao menos uma trilha aparece no perfil: a página /p/<perfilId> existe. */
  publico: boolean;
  email: string;
  /** Conta de visitante: adiciona trilhas, mas não compartilha nem tem perfil. */
  visitante: boolean;
  links: LinkCompartilhado[];
}

/** GET /api/aprendizado/planos/:id/compartilhar: o que a folha "Compartilhar trilha" mostra para a dona. */
export interface PreviaCompartilhar {
  planoId: string;
  titulo: string;
  totalLicoes: number;
  totalPartes: number;
  /** Trilha feita de material: a folha avisa o que vai (trechos e páginas) e o que não vai. */
  deMaterial: boolean;
  /** O título traz o nome do arquivo (caso "Estudar <arquivo>"): a folha avisa. */
  tituloTemNomeDoArquivo: boolean;
  perfil: { nome: string; cor: CorPerfil } | null;
  link: LinkCompartilhado | null;
}

export type SituacaoTrilhaCompartilhada = 'nova' | 'adicionada' | 'sua';

/** GET /api/compartilhar/:codigo (pública): a prévia de quem recebe. Sem e-mail, ids internos, objetivo ou progresso. */
export interface TrilhaCompartilhada {
  codigo: string;
  titulo: string;
  /** Rótulo de origem: IA, material ("Material de Ana") ou demonstração. */
  origem: string;
  totalLicoes: number;
  partes: { titulo: string; licoes: string[] }[];
  dono: DonoPublico;
  /** Só com sessão: se a pessoa já adicionou, se é a dona, ou se é nova para ela. */
  situacao?: SituacaoTrilhaCompartilhada;
  /** Com `situacao` "adicionada" ou "sua": a trilha da própria pessoa, para abrir. */
  planoId?: string;
}

/** POST /api/compartilhar/:codigo/adicionar */
export interface TrilhaAdicionada {
  planoId: string;
  /** A pessoa já tinha esta trilha (o mesmo link): nada foi duplicado. */
  jaTinha: boolean;
  dono: DonoPublico;
}

/** GET /api/perfis/:perfilId (pública): só existe com ao menos uma trilha marcada para aparecer no perfil. */
export interface PerfilPublico {
  nome: string;
  cor: CorPerfil;
  trilhas: { codigo: string; titulo: string; totalLicoes: number; origem: string }[];
}

/** Nas listas e no mapa (com a flag): o selo da dona e o "Compartilhada por" de quem recebeu. */
export interface MarcasCompartilhar {
  /** Da dona: o link ativo da trilha. */
  link?: { codigo: string; noPerfil: boolean };
  /** De quem recebeu: de quem veio, o perfil público (se existir agora) e o código do link original, se ainda ativo. */
  recebida?: { nome: string; perfilId: string | null; codigoAtivo: string | null };
}
