/*
 * Comunidade (spec 10, etapa B): publicar no Explorar, "Em alta esta semana", Valeu e Denunciar. Tudo atrás de
 * `STUDOO_COMUNIDADE=1` (que só vale com `STUDOO_COMPARTILHAR=1`; o `/api/auth/config` traz `comunidade`).
 * O "Em alta" ordena trilhas, nunca pessoas (D16).
 */
import type { CorPerfil, DonoPublico, SituacaoTrilhaCompartilhada, Tema } from './compartilhar';

/** Quem pode ver a trilha: só quem tem o link, quem abre o perfil, ou qualquer pessoa no Explorar (que inclui o perfil). */
export const VISIBILIDADES = ['link', 'perfil', 'explorar'] as const;
export type Visibilidade = (typeof VISIBILIDADES)[number];

export const LIMITES_COMUNIDADE = {
  legendaMax: 140,
  porPagina: 20,
  emAlta: 10,
  janelaDias: 7,
  /** Contas distintas que denunciam uma trilha até ela sair do Explorar (até revisão). */
  denunciasParaOcultar: 3,
  /** Pontos do "Em alta": cada conta distinta que adicionou vale 3; cada valeu, 1. */
  pesoAdicao: 3,
  pesoValeu: 1,
} as const;

export const MOTIVOS_DENUNCIA = ['spam', 'ofensivo', 'direitos', 'outro'] as const;
export type MotivoDenuncia = (typeof MOTIVOS_DENUNCIA)[number];

export type MotivoLegendaInvalida = 'longa' | 'caracteres' | 'endereco';

/** Legenda (já normalizada como o nome): opcional, até 140 caracteres, sem site, e-mail, HTML nem invisíveis. */
export function motivoLegendaInvalida(legenda: string): MotivoLegendaInvalida | null {
  if (!legenda) return null;
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Cs}<>]/u.test(legenda)) return 'caracteres';
  if ([...legenda].length > LIMITES_COMUNIDADE.legendaMax) return 'longa';
  if (/@|:\/\/|\bwww\.|[\p{L}\p{N}-]\.[a-z]{2,}(?:[/:]|\b)/iu.test(legenda)) return 'endereco';
  return null;
}

/** Palavras que sugerem cada tema (sem acento, minúsculas). A pessoa sempre confirma. */
const PALAVRAS_DO_TEMA: [Exclude<Tema, 'outros'>, string[]][] = [
  ['idiomas', ['ingles', 'espanhol', 'frances', 'alemao', 'italiano', 'japones', 'chines', 'coreano', 'libras', 'idioma', 'lingua', 'english', 'conversacao', 'vocabulario', 'pronuncia', 'gramatica']],
  ['matematica', ['matematica', 'fracao', 'fracoes', 'algebra', 'geometria', 'calculo', 'equacao', 'porcentagem', 'estatistica', 'trigonometria', 'aritmetica', 'tabuada', 'funcao']],
  ['ciencias', ['fisica', 'quimica', 'biologia', 'ciencia', 'astronomia', 'genetica', 'ecologia', 'celula', 'evolucao', 'geologia']],
  ['programacao', ['programacao', 'python', 'javascript', 'sql', 'codigo', 'excel', 'computador', 'tecnologia', 'algoritmo', 'html', 'css', 'react', 'dados', 'inteligencia artificial', 'planilha', 'git']],
  ['negocios', ['financa', 'financas', 'investimento', 'negocio', 'empreender', 'marketing', 'vendas', 'contabilidade', 'economia', 'orcamento', 'dinheiro']],
  ['vestibular', ['enem', 'vestibular', 'concurso', 'fuvest', 'redacao', 'prova', 'oab']],
  ['historia', ['historia', 'geografia', 'filosofia', 'sociologia', 'politica', 'brasil colonia', 'guerra', 'cidadania']],
  ['artes', ['violao', 'guitarra', 'piano', 'musica', 'canto', 'desenho', 'pintura', 'fotografia', 'arte', 'teatro', 'danca', 'ukulele', 'bateria', 'cinema']],
  ['saude', ['saude', 'primeiros socorros', 'nutricao', 'yoga', 'meditacao', 'exercicio', 'corrida', 'sono', 'ansiedade', 'treino', 'alongamento']],
  ['culinaria', ['culinaria', 'cozinha', 'receita', 'receitas', 'pao', 'bolo', 'cozinhar', 'jardinagem', 'horta', 'costura', 'limpeza', 'casa']],
  ['carreira', ['carreira', 'produtividade', 'entrevista', 'curriculo', 'lideranca', 'oratoria', 'comunicacao', 'organizacao', 'gestao', 'apresentacao']],
];

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O tema sugerido pelas palavras do título (o primeiro que casar), ou "outros". */
export function sugerirTema(titulo: string): Tema {
  const texto = ` ${semAcento(titulo).replace(/[^a-z0-9]+/g, ' ')} `;
  for (const [tema, palavras] of PALAVRAS_DO_TEMA) {
    if (palavras.some((palavra) => texto.includes(` ${palavra} `) || texto.includes(` ${palavra}s `))) return tema;
  }
  return 'outros';
}

/** A cor de cada tema na capa e na ficha (fundo da capa; o desenho vai em branco translúcido por cima). */
export const COR_DO_TEMA: Record<Tema, string> = {
  idiomas: '#2f6fdf',
  matematica: '#5b4bd1',
  ciencias: '#0f8a7e',
  programacao: '#2a3f8f',
  negocios: '#1f7a4c',
  vestibular: '#c2410c',
  historia: '#8a5a2b',
  artes: '#b8327e',
  saude: '#2f9e6f',
  culinaria: '#d9822b',
  carreira: '#475569',
  outros: '#3858d6',
};

/** Número de 32 bits estável a partir do código (FNV-1a), para o desenho da capa ser sempre o mesmo. */
function semente(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
function sorteio(inicial: number) {
  let a = inicial;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (valor: number) => Number(valor.toFixed(1));

/**
 * A capa da trilha em SVG (texto puro, sem DOM; 320×160): a cor do tema e um padrão geométrico determinístico pelo
 * código do link (círculos, ondas, losangos ou trilha pontilhada). Sem imagem enviada e sem IA. Decorativa.
 */
export function svgCapaTrilha(codigo: string, tema: Tema | null): string {
  const cor = COR_DO_TEMA[tema ?? 'outros'];
  const r = sorteio(semente(codigo));
  const padrao = Math.floor(r() * 4);
  const formas: string[] = [];
  if (padrao === 0) {
    // Bolhas de tamanhos variados.
    for (let i = 0; i < 9; i++) formas.push(`<circle cx="${n(r() * 320)}" cy="${n(r() * 160)}" r="${n(10 + r() * 46)}" fill="#fff" fill-opacity="${n(0.08 + r() * 0.16)}"/>`);
  } else if (padrao === 1) {
    // Ondas paralelas.
    const fase = r() * 80;
    for (let i = 0; i < 6; i++) {
      const y = 18 + i * 26 + r() * 6;
      formas.push(`<path d="M-20 ${n(y)} C ${n(60 + fase)} ${n(y - 26)}, ${n(140 + fase)} ${n(y + 26)}, 340 ${n(y - 6)}" fill="none" stroke="#fff" stroke-opacity="${n(0.12 + r() * 0.14)}" stroke-width="${n(5 + r() * 8)}" stroke-linecap="round"/>`);
    }
  } else if (padrao === 2) {
    // Losangos em grade, alguns cheios.
    const passo = 40 + Math.floor(r() * 3) * 8;
    for (let x = 0; x < 360; x += passo) for (let y = (x / passo) % 2 ? passo / 2 : 0; y < 200; y += passo) {
      const s = passo * (0.18 + r() * 0.16);
      formas.push(`<path d="M${n(x)} ${n(y - s)}L${n(x + s)} ${n(y)}L${n(x)} ${n(y + s)}L${n(x - s)} ${n(y)}Z" fill="#fff" fill-opacity="${n(r() < 0.3 ? 0.26 : 0.1)}"/>`);
    }
  } else {
    // Uma trilha pontilhada com marcos (o mapa do Studoo).
    const y0 = 40 + r() * 80;
    const y1 = 30 + r() * 100;
    formas.push(`<path d="M-10 ${n(y0)} C 90 ${n(y1 - 70)}, 200 ${n(y0 + 80)}, 330 ${n(y1)}" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 17"/>`);
    for (let i = 0; i < 3; i++) formas.push(`<circle cx="${n(50 + i * 110 + r() * 30)}" cy="${n(30 + r() * 100)}" r="${n(9 + r() * 6)}" fill="#fff" fill-opacity="0.28"/>`);
    formas.push(`<circle cx="${n(250 + r() * 50)}" cy="${n(20 + r() * 30)}" r="${n(26 + r() * 20)}" fill="#fff" fill-opacity="0.12"/>`);
  }
  const giro = n(r() * 360);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="capa-${codigo.replace(/[^A-Za-z0-9]/g, '')}" gradientTransform="rotate(${giro} .5 .5)"><stop offset="0" stop-color="${cor}"/><stop offset="1" stop-color="${cor}" stop-opacity="0.78"/></linearGradient></defs>`
    + `<rect width="320" height="160" fill="#fff"/><rect width="320" height="160" fill="url(#capa-${codigo.replace(/[^A-Za-z0-9]/g, '')})"/>`
    + formas.join('')
    + '</svg>';
}

/**
 * Galeria de capas do Studoo (lote 4): 12 capas prontas, desenhadas em código como a capa padrão (sem arquivo de
 * imagem). O id fica guardado na trilha; `null` é a capa padrão (a cor e o desenho do tema).
 */
export const CAPAS_GALERIA = [
  { id: 'aurora', de: '#5b3fd1', ate: '#e46fae', padrao: 'bolhas' },
  { id: 'oceano', de: '#0f5fa8', ate: '#2bb3c9', padrao: 'ondas' },
  { id: 'floresta', de: '#1f6b47', ate: '#6fbf73', padrao: 'montanhas' },
  { id: 'por-do-sol', de: '#d9480f', ate: '#f6b24a', padrao: 'raios' },
  { id: 'noite', de: '#1b2a5e', ate: '#4b3a9e', padrao: 'estrelas' },
  { id: 'areia', de: '#b7791f', ate: '#f0d08a', padrao: 'ondas' },
  { id: 'lavanda', de: '#7c4dcc', ate: '#c6a8f0', padrao: 'losangos' },
  { id: 'menta', de: '#0f7c6c', ate: '#7fdcc3', padrao: 'pontos' },
  { id: 'coral', de: '#c2410c', ate: '#f58f84', padrao: 'bolhas' },
  { id: 'ceu', de: '#2a6fdb', ate: '#9cd3ff', padrao: 'trilha' },
  { id: 'cereja', de: '#9d174d', ate: '#f472b6', padrao: 'losangos' },
  { id: 'grafite', de: '#2f3a4f', ate: '#6b7a99', padrao: 'pontos' },
] as const;
export type CapaGaleria = (typeof CAPAS_GALERIA)[number]['id'];
export const ehCapaGaleria = (valor: unknown): valor is CapaGaleria => CAPAS_GALERIA.some((capa) => capa.id === valor);

/** Uma capa da galeria em SVG (320×160), determinística pelo id. Decorativa. */
export function svgCapaGaleria(id: CapaGaleria): string {
  const capa = CAPAS_GALERIA.find((item) => item.id === id) ?? CAPAS_GALERIA[0];
  const r = sorteio(semente(`galeria-${capa.id}`));
  const formas: string[] = [];
  const branco = (opacidade: number) => `fill="#fff" fill-opacity="${n(opacidade)}"`;
  if (capa.padrao === 'bolhas') {
    for (let i = 0; i < 10; i++) formas.push(`<circle cx="${n(r() * 320)}" cy="${n(r() * 160)}" r="${n(10 + r() * 44)}" ${branco(0.08 + r() * 0.16)}/>`);
  } else if (capa.padrao === 'ondas') {
    for (let i = 0; i < 6; i++) {
      const y = 16 + i * 26;
      formas.push(`<path d="M-20 ${n(y)} C 70 ${n(y - 24)}, 150 ${n(y + 24)}, 340 ${n(y - 4)}" fill="none" stroke="#fff" stroke-opacity="${n(0.12 + r() * 0.16)}" stroke-width="${n(5 + r() * 7)}" stroke-linecap="round"/>`);
    }
  } else if (capa.padrao === 'montanhas') {
    formas.push(`<path d="M-10 160 L70 70 L130 120 L200 40 L270 110 L330 70 L330 160Z" ${branco(0.16)}/>`, `<path d="M-10 160 L50 115 L120 150 L190 95 L260 140 L330 110 L330 160Z" ${branco(0.22)}/>`, `<circle cx="262" cy="36" r="18" ${branco(0.3)}/>`);
  } else if (capa.padrao === 'raios') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI;
      formas.push(`<path d="M160 170 L${n(160 + Math.cos(a) * 260)} ${n(170 - Math.sin(a) * 260)} L${n(160 + Math.cos(a + 0.12) * 260)} ${n(170 - Math.sin(a + 0.12) * 260)}Z" ${branco(0.12)}/>`);
    }
    formas.push(`<circle cx="160" cy="170" r="54" ${branco(0.28)}/>`);
  } else if (capa.padrao === 'estrelas') {
    for (let i = 0; i < 26; i++) formas.push(`<circle cx="${n(r() * 320)}" cy="${n(r() * 160)}" r="${n(1 + r() * 2.4)}" ${branco(0.4 + r() * 0.5)}/>`);
    formas.push(`<circle cx="250" cy="44" r="22" ${branco(0.85)}/><circle cx="260" cy="38" r="20" fill="${capa.de}"/>`);
  } else if (capa.padrao === 'losangos') {
    for (let x = 0; x < 360; x += 44) for (let y = (x / 44) % 2 ? 22 : 0; y < 200; y += 44) {
      const t = 9 + r() * 6;
      formas.push(`<path d="M${x} ${n(y - t)}L${n(x + t)} ${y}L${x} ${n(y + t)}L${n(x - t)} ${y}Z" ${branco(r() < 0.3 ? 0.26 : 0.1)}/>`);
    }
  } else if (capa.padrao === 'pontos') {
    for (let x = 12; x < 330; x += 22) for (let y = 12; y < 170; y += 22) formas.push(`<circle cx="${x}" cy="${y}" r="${n(2 + r() * 2.5)}" ${branco(0.14 + r() * 0.16)}/>`);
  } else {
    formas.push(`<path d="M-10 110 C 80 30, 190 150, 330 50" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 17"/>`);
    for (const [x, y] of [[70, 72], [168, 98], [262, 66]]) formas.push(`<circle cx="${x}" cy="${y}" r="11" ${branco(0.3)}/>`);
  }
  const idGradiente = `galeria-${capa.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="${idGradiente}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${capa.de}"/><stop offset="1" stop-color="${capa.ate}"/></linearGradient></defs>`
    + `<rect width="320" height="160" fill="url(#${idGradiente})"/>${formas.join('')}</svg>`;
}

/** A capa de uma trilha: a da galeria, quando escolhida; senão, a padrão (cor e desenho do tema, pelo código). */
export function svgCapa({ codigo, tema, capa }: { codigo: string; tema: Tema | null; capa?: string | null }): string {
  return ehCapaGaleria(capa) ? svgCapaGaleria(capa) : svgCapaTrilha(codigo, tema);
}

/**
 * Capa com foto (lote 4): a trilha guarda `capa = "foto:<token>"`; a imagem (2:1, WebP sem metadados) sai por
 * `/api/capas/<token>/<largura>`, com cache imutável (o token muda a cada troca). Usa a mesma flag da foto do perfil.
 */
export const LIMITES_CAPA = { largura: 1024, altura: 512, larguraPequena: 480, alturaPequena: 240 } as const;
export type TamanhoCapa = typeof LIMITES_CAPA.largura | typeof LIMITES_CAPA.larguraPequena;
export const ehCapaFoto = (capa: unknown): capa is `foto:${string}` => typeof capa === 'string' && /^foto:[A-Za-z0-9_-]{16}$/.test(capa);
export const tokenDaCapa = (capa: string) => capa.slice('foto:'.length);
/** O caminho da capa com foto (a web usa direto; o app soma a base do servidor). */
export function enderecoCapa(capa: string, tamanho: TamanhoCapa = LIMITES_CAPA.larguraPequena): string {
  return `/api/capas/${tokenDaCapa(capa)}/${tamanho}`;
}

/**
 * A capa pronta para pôr na página (HTML): a foto, com um véu escuro suave onde ficam o tema, "Demonstração" e o
 * numeral do Em alta, ou o SVG da galeria ou da capa padrão. Decorativa.
 */
export function marcacaoCapa({ codigo, tema, capa, tamanho }: { codigo: string; tema: Tema | null; capa?: string | null; tamanho?: TamanhoCapa }): string {
  if (ehCapaFoto(capa)) {
    return `<img class="capa-foto" src="${enderecoCapa(capa, tamanho)}" alt="" loading="lazy" decoding="async"/><span class="capa-veu"></span>`;
  }
  return svgCapa({ codigo, tema, capa });
}

/** As duas cores de uma capa (para a imagem de prévia do link, que pinta o painel da capa). */
export function coresDaCapa(tema: Tema | null, capa?: string | null): { de: string; ate: string } {
  const galeria = CAPAS_GALERIA.find((item) => item.id === capa);
  if (galeria) return { de: galeria.de, ate: galeria.ate };
  const cor = COR_DO_TEMA[tema ?? 'outros'];
  return { de: cor, ate: cor };
}

/** Configurações da trilha (lote 4): o que só a dona muda, na tela "Configurações da trilha". */
export const LIMITES_TRILHA = { tituloMin: 3, tituloMax: 80 } as const;
export type MotivoTituloInvalido = 'curto' | 'longo' | 'caracteres';
export const normalizarTituloTrilha = (titulo: string) => titulo.normalize('NFC').replace(/\s+/g, ' ').trim();
export function motivoTituloTrilhaInvalido(titulo: string): MotivoTituloInvalido | null {
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Cs}<>]/u.test(titulo)) return 'caracteres';
  const tamanho = [...titulo].length;
  if (tamanho < LIMITES_TRILHA.tituloMin) return 'curto';
  if (tamanho > LIMITES_TRILHA.tituloMax) return 'longo';
  return null;
}

export interface ConfiguracoesTrilha {
  planoId: string;
  titulo: string;
  /** O mesmo texto que aparece no cartão e no link (a legenda); até 140. */
  descricao: string | null;
  tema: Tema | null;
  /** Sugerido pelo título, para quando ainda não há tema. */
  temaSugerido: Tema;
  /** Id da capa da galeria; `null` = a capa padrão. */
  capa: string | null;
  /** Código para desenhar a capa padrão (o do link, ou o id da trilha sem link). */
  semente: string;
  /** Quem pode ver: `null` quando a trilha não tem link (só a dona vê). */
  compartilhamento: { codigo: string; visibilidade: Visibilidade; estudando: number; valeus: number } | null;
  /** Trilha adicionada de outra pessoa: a cópia é dela, mas não se compartilha de novo. */
  recebida: boolean;
}

export type MudancaConfiguracoes = Partial<{ titulo: string; descricao: string | null; tema: Tema | null; capa: string | null }>;

/** Um cartão de trilha: o mesmo no Explorar, no perfil e na prévia. Sem e-mail, ids internos, objetivo ou progresso. */
export interface CartaoTrilha {
  codigo: string;
  titulo: string;
  tema: Tema | null;
  /** Capa da galeria escolhida pela dona (sem ela, a capa padrão). */
  capa?: string | null;
  legenda: string | null;
  totalLicoes: number;
  totalPartes: number;
  /** Contas que adicionaram a trilha ("12 estudando"). */
  estudando: number;
  valeus: number;
  dono: DonoPublico;
  /** Trilha do modo demonstração (conteúdo pronto, sem a IA): vai com o rótulo. */
  demonstracao: boolean;
  publicadaEm: string | null;
  /** Só com sessão: "nova" (Quero estudar), "adicionada" (Continuar) ou "sua" (Sua trilha). */
  situacao?: SituacaoTrilhaCompartilhada;
  /** Com `situacao` "adicionada" ou "sua": a trilha da própria pessoa, para abrir. */
  planoId?: string;
  /** Só com sessão: a pessoa mandou valeu. */
  valeuMeu?: boolean;
}

/** GET /api/explorar?tema=&cursor= (pública; com sessão, traz a situação de cada cartão). */
export interface PaginaExplorar {
  /** Top 10 da semana (só na primeira página; com tema, o top daquele tema). */
  emAlta: CartaoTrilha[];
  /** As mais novas primeiro, 20 por página. */
  novas: CartaoTrilha[];
  /** Para a próxima página de "Novas", ou null no fim. */
  cursor: string | null;
  /** Só na aba "Seguindo": se a pessoa segue alguém (para o vazio certo). */
  seguindoAlguem?: boolean;
}

/** POST /api/compartilhar/:codigo/valeu */
export interface ResultadoValeu {
  valeus: number;
  valeuMeu: boolean;
}

/** POST /api/denuncias */
export interface PedidoDenuncia {
  alvoTipo: 'trilha' | 'perfil';
  /** Código do link ou id público do perfil. */
  alvo: string;
  motivo: MotivoDenuncia;
}

/** Seguir (etapa C2): o estado do botão para quem está logado. */
export interface EstadoSeguir {
  seguindo: boolean;
  /** Falso para a própria pessoa e para conta de visitante: o botão não aparece. */
  podeSeguir: boolean;
}

/** POST /api/perfis/:perfilId/seguir */
export interface ResultadoSeguir {
  seguindo: boolean;
  seguidores: number;
}

/** Uma pessoa nas Novidades: só quem tem perfil público aparece com nome e foto; o resto entra em "outros". */
export interface PessoaNovidade {
  nome: string;
  cor: CorPerfil;
  foto: string | null;
  perfilId: string;
}

/** As Novidades da dona (últimos 7 dias), agrupadas. Adição mostra só a contagem. */
export type Novidade =
  | { tipo: 'adicoes'; planoId: string; titulo: string; quantidade: number; em: string }
  | { tipo: 'valeus'; planoId: string; titulo: string; pessoas: PessoaNovidade[]; outros: number; em: string }
  | { tipo: 'seguidores'; pessoas: PessoaNovidade[]; outros: number; em: string };

/** GET /api/perfil/novidades */
export interface Novidades {
  itens: Novidade[];
}
