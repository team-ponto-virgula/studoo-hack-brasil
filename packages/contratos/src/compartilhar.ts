import type { CartaoTrilha, EstadoSeguir, Visibilidade } from './comunidade';

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
  azul: '#2563ff',
  verde: '#1f7a5a',
  laranja: '#b25400',
  roxo: '#6b46c1',
  rosa: '#b83280',
  turquesa: '#0f7c86',
};

export const LIMITES_PERFIL = { nomeMin: 2, nomeMax: 40, resumoMax: 160, interessesMax: 5 } as const;

/** O nome como fica guardado: NFC, sem espaços nas pontas e com um espaço só entre as palavras. */
export function normalizarNomePerfil(bruto: string): string {
  return bruto.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** O resumo é normalizado como o nome (uma linha só). */
export const normalizarResumoPerfil = normalizarNomePerfil;

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

export type MotivoResumoInvalido = 'longo' | 'caracteres' | 'endereco';

/** Por que o resumo (já normalizado) não serve, ou null. Mesmas regras do nome; vazio vale (sem resumo). */
export function motivoResumoInvalido(resumo: string): MotivoResumoInvalido | null {
  if (!resumo) return null;
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Cs}<>]/u.test(resumo)) return 'caracteres';
  if ([...resumo].length > LIMITES_PERFIL.resumoMax) return 'longo';
  if (/@|:\/\/|\bwww\.|[\p{L}\p{N}-]\.[a-z]{2,}(?:[/:]|\b)/iu.test(resumo)) return 'endereco';
  return null;
}

/**
 * Os temas (spec 10): interesses do perfil (até 5) e, na etapa B, o tema de cada trilha publicada. A ordem é a da
 * escolha; os rótulos ficam em `experiencia.ts` (`mensagens.temas`).
 */
export const TEMAS = [
  'idiomas', 'matematica', 'ciencias', 'programacao', 'negocios', 'vestibular',
  'historia', 'artes', 'saude', 'culinaria', 'carreira', 'outros',
] as const;
export type Tema = (typeof TEMAS)[number];

/** Interesses válidos: lista de temas conhecidos, sem repetição, até 5. Devolve a lista na ordem de `TEMAS`. */
export function interessesValidos(valor: unknown): Tema[] | null {
  if (!Array.isArray(valor) || valor.length > LIMITES_PERFIL.interessesMax) return null;
  if (!valor.every((tema) => (TEMAS as readonly unknown[]).includes(tema)) || new Set(valor).size !== valor.length) return null;
  return TEMAS.filter((tema) => valor.includes(tema));
}

/**
 * Foto do perfil (spec 10). O cliente recorta o quadrado e manda a imagem (JPEG, PNG ou WebP até 2 MB, em base64); o
 * servidor confere pelos bytes, corrige a orientação, usa só o primeiro quadro, corta em 512 e 128 e regrava em WebP
 * (sem EXIF nem GPS). O endereço usa um token aleatório que muda a cada troca: nunca o id do perfil.
 */
export const LIMITES_FOTO = { bytes: 2 * 1024 * 1024, pixels: 36_000_000, trocasPorHora: 10, lado: 512, ladoPequeno: 128 } as const;
export type TamanhoFoto = typeof LIMITES_FOTO.lado | typeof LIMITES_FOTO.ladoPequeno;
/** Lado sugerido para o recorte que o cliente envia (o servidor reduz para 512). */
export const LADO_ENVIO_FOTO = 1024;

/** O caminho da foto (a web usa direto; o app soma a base do servidor). */
export function enderecoFoto(foto: string, tamanho: TamanhoFoto = LIMITES_FOTO.ladoPequeno): string {
  return `/api/fotos/${foto}/${tamanho}`;
}

/** PUT /api/perfil/foto */
export interface FotoEnviada {
  base64: string;
}

/** O alcance do perfil (etapa A): trilhas compartilhadas e pessoas que adicionaram. Valeus e seguidores entram depois. */
export interface AlcancePerfil {
  trilhas: number;
  pessoas: number;
  /** Com a comunidade (etapa C2): quantas pessoas seguem o perfil. Só a contagem; nunca a lista. */
  seguidores?: number;
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
  /** Token da foto (ver `enderecoFoto`), ou null: a inicial na cor. */
  foto: string | null;
  resumo: string | null;
  /** Só quando é um perfil de demonstração (selo "Perfil de demonstração"); ausente nos perfis de pessoas. */
  demo?: true;
  /** Só quando a pessoa tem perfil público (ao menos uma trilha marcada para aparecer nele). */
  perfilId: string | null;
}

/** Um link da própria pessoa (só a dona vê `adicoes`). */
export interface LinkCompartilhado {
  moderacao?: "pendente" | "aprovado" | "recusado";
  codigo: string;
  planoId: string;
  titulo: string;
  criadoEm: string;
  adicoes: number;
  noPerfil: boolean;
  /** Com a comunidade (spec 10, etapa B): o nível de visibilidade, o tema e a legenda de quando foi publicada. */
  visibilidade?: Visibilidade;
  tema?: Tema | null;
  legenda?: string | null;
  valeus?: number;
}

/** GET /api/perfil */
export interface Perfil {
  fotoModeracao?: 'pendente' | 'aprovado' | 'recusado' | null;
  perfilModeracao?: 'pendente' | 'aprovado' | 'recusado';
  nome: string | null;
  cor: CorPerfil | null;
  resumo: string | null;
  interesses: Tema[];
  foto: string | null;
  /** De todas as trilhas que a pessoa compartilha (o perfil público conta só as marcadas). */
  alcance: AlcancePerfil;
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
  perfil: { nome: string; cor: CorPerfil; foto: string | null } | null;
  link: LinkCompartilhado | null;
  /** Com a comunidade: o tema sugerido pelo título e se a trilha é do modo demonstração (vai com o rótulo). */
  temaSugerido?: Tema;
  demonstracao?: boolean;
}

export type SituacaoTrilhaCompartilhada = 'nova' | 'adicionada' | 'sua';

/** GET /api/compartilhar/:codigo (pública): a prévia de quem recebe. Sem e-mail, ids internos, objetivo ou progresso. */
export interface TrilhaCompartilhada {
  codigo: string;
  titulo: string;
  /** Capa (lote 4): tema do link e capa da galeria escolhida (sem ela, a capa padrão). */
  tema?: Tema | null;
  capa?: string | null;
  /** Rótulo de origem: IA, material ("Material de Ana") ou demonstração. */
  origem: string;
  totalLicoes: number;
  partes: { titulo: string; licoes: string[] }[];
  dono: DonoPublico;
  /** Só com sessão: se a pessoa já adicionou, se é a dona, ou se é nova para ela. */
  situacao?: SituacaoTrilhaCompartilhada;
  /** Com `situacao` "adicionada" ou "sua": a trilha da própria pessoa, para abrir. */
  planoId?: string;
  /** Com a comunidade e sessão: o botão Seguir do cartão "Quem compartilhou" (só quando o perfil dela é público). */
  seguirDono?: EstadoSeguir;
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
  /** Perfil de demonstração (selo). */
  demo?: true;
  resumo: string | null;
  interesses: Tema[];
  foto: string | null;
  /** Só das trilhas marcadas para aparecer no perfil. */
  alcance: AlcancePerfil;
  /** Com a comunidade: as trilhas do perfil como cartões (capa, tema, legenda, estudando e valeus). */
  cartoes?: CartaoTrilha[];
  /** Com a comunidade e sessão: se a pessoa segue este perfil e se pode seguir (não é ela, nem visitante). */
  seguir?: EstadoSeguir;
  trilhas: { codigo: string; titulo: string; totalLicoes: number; origem: string }[];
}

/** Nas listas e no mapa (com a flag): o selo da dona e o "Compartilhada por" de quem recebeu. */
export interface MarcasCompartilhar {
  /**
   * Da dona: o link ativo da trilha e, em `moderacao`, o estado da revisão da equipe (spec 16, item 31): "pendente" mostra "Em revisão", "recusado" mostra "Não publicada" e
   * "aprovado" (ou, em respostas antigas, sem o campo) mostra "Compartilhada". O mapa e o selo de Minhas trilhas dizem o mesmo que o Perfil.
   */
  link?: { codigo: string; noPerfil: boolean; moderacao?: "pendente" | "aprovado" | "recusado" };
  /**
   * De quem recebeu: de quem veio, o perfil público (se existir agora) e o código do link original, se ainda ativo. `nome` vem VAZIO quando quem compartilhou
   * excluiu a conta ou parou de compartilhar: a trilha continua recebida (sem Compartilhar nem Postar), mas as frases "Esta trilha é de …" e "Compartilhada por …"
   * não se montam (`recebidaTemNome`).
   */
  recebida?: { nome: string; perfilId: string | null; codigoAtivo: string | null; foto: string | null };
}

/** O estado curto do compartilhamento de uma trilha da própria pessoa (spec 16, item 31): o mesmo no botão do mapa, no selo de Minhas trilhas e no app. */
export type EstadoDoCompartilhamento = 'sem-link' | 'compartilhada' | 'em-revisao' | 'nao-publicada';

/**
 * Sem link: "Compartilhar". Com link aprovado (ou, em respostas antigas, sem `moderacao`): "Compartilhada". À espera da revisão da equipe: "Em revisão" (selo neutro).
 * Recusado: "Não publicada" (selo âmbar). O texto longo ("Em revisão pela equipe do Studoo. Por enquanto, só você vê.") fica só no Perfil e na folha de compartilhar.
 */
export function estadoDoCompartilhamento(link: { moderacao?: "pendente" | "aprovado" | "recusado" } | null | undefined): EstadoDoCompartilhamento {
  if (!link) return 'sem-link';
  if (link.moderacao === 'pendente') return 'em-revisao';
  if (link.moderacao === 'recusado') return 'nao-publicada';
  return 'compartilhada';
}

/** A trilha recebida diz de quem veio? Sem nome (conta excluída, link parado), o cliente não escreve a frase "de <nome>" e não deixa a linha vazia na tela. */
export function recebidaTemNome(recebida: { nome: string }): boolean {
  return recebida.nome.trim().length > 0;
}
