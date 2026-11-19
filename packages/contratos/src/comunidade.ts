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

/** Um cartão de trilha: o mesmo no Explorar, no perfil e na prévia. Sem e-mail, ids internos, objetivo ou progresso. */
export interface CartaoTrilha {
  codigo: string;
  titulo: string;
  tema: Tema | null;
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
