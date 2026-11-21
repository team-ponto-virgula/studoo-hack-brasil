/*
 * Visuais da lição e "Resolva comigo" (spec 15): o contrato aditivo.
 *
 * A IA nunca devolve desenho livre (SVG, HTML ou caminho): ela devolve estes dados, o Studoo valida (`visuais-validacao.ts`)
 * e desenha com um motor único (web em SVG, app em react-native-svg, servidor em PNG). Todos os campos novos são opcionais: lição
 * sem visual não muda, e `Recurso` não muda.
 */

/** Papel de um ponto: o que ele é na figura. O motor decide o que desenhar pelo papel e pelo contexto (`ContextoDoDesenho`). */
export const PAPEIS_PONTO = ["dado", "especial", "procurado", "resposta"] as const;
export type PapelPonto = (typeof PAPEIS_PONTO)[number];

/**
 * Ponto calculado pelo servidor (a IA erra conta, o servidor não): `baricentro` (3 pontos), `ponto_medio` (2 pontos) e, na
 * reta numérica, `media` (de 2 a 6 pontos). `de` lista ids de outros pontos da mesma figura que não são derivados.
 */
export type TipoDerivado = "baricentro" | "ponto_medio" | "media";
export interface Derivado {
  tipo: TipoDerivado;
  de: string[];
}

/**
 * Ponto do plano. O nome (`id`, até 3 caracteres) e as coordenadas viram o rótulo "A (1, 2)": o texto do rótulo nunca vem
 * da IA. `x` e `y` sempre existem no que o servidor guarda (o derivado é calculado); só faltam nos pontos `procurado` e
 * `resposta` do enunciado público, porque a resposta não vai pela rede (`visualParaEnunciado`).
 */
export interface PontoDoPlano {
  id: string;
  papel: PapelPonto;
  x?: number;
  y?: number;
  derivado?: Derivado;
  /** `false` tira o rótulo (até 8 rotulados por figura, para caber em 390). */
  rotulo?: boolean;
}

export interface VisualPlano {
  tipo: "plano";
  /** Texto para o leitor de tela, e a legenda do PNG da fase 1 (até 140 caracteres). Sem LaTeX; nunca traz a resposta. */
  alt: string;
  /** O que o plano mostra. A IA pode omitir: o servidor ajusta aos pontos (sempre inclui a origem) e guarda o resultado. */
  x: [number, number];
  y: [number, number];
  /** De 1 a 12 pontos. */
  pontos: PontoDoPlano[];
  /** Até 12. Um segmento que toca um ponto escondido (o procurado) não é desenhado: o desenho não pode apontar para ele. */
  segmentos?: { de: string; ate: string }[];
  /** Até 4, de 3 a 8 vértices cada um. */
  poligonos?: { pontos: string[] }[];
  /** Linha tracejada de um ponto até um eixo (`x`: até o eixo das abscissas), com o valor em foco. Até 6. */
  guias?: { ponto: string; eixo: "x" | "y" }[];
}

export interface PontoDaReta {
  id: string;
  papel: PapelPonto;
  valor?: number;
  derivado?: Derivado;
  rotulo?: boolean;
}

/** Trecho da reta (desigualdade, intervalo). Sem `de` (ou sem `ate`) o trecho segue até o infinito, com seta. */
export interface IntervaloDaReta {
  de?: number;
  ate?: number;
  /** Extremo aberto (`<`, `>`: bolinha vazia). Por padrão, fechado. */
  deAberto?: boolean;
  ateAberto?: boolean;
}

export interface VisualRetaNumerica {
  tipo: "reta_numerica";
  alt: string;
  /** O trecho da reta que aparece (o servidor ajusta aos pontos se a IA omitir). */
  de: number;
  ate: number;
  /** De 1 a 8 pontos. */
  pontos: PontoDaReta[];
  /** Até 3. */
  intervalos?: IntervaloDaReta[];
}

/**
 * Fórmula em LaTeX restrito (`formula.ts`), guardada na forma canônica. O texto falado sai da árvore, não da IA; `alt` é só uma
 * legenda curta ("Fórmula do baricentro", até 60 caracteres) que entra na descrição do PNG.
 */
export interface VisualFormula {
  tipo: "formula";
  latex: string;
  alt?: string;
}

export type VisualFigura = VisualPlano | VisualRetaNumerica;
export type Visual = VisualFigura | VisualFormula;
export const TIPOS_VISUAL = ["plano", "reta_numerica", "formula"] as const;
export type TipoVisual = (typeof TIPOS_VISUAL)[number];

/* ----- "Resolva comigo" ----- */

/** Uma opção do "Sua vez": um número (`texto`) ou uma fórmula em linha (`formula`), nunca os dois. */
export interface OpcaoDoSuaVez {
  texto?: string;
  formula?: string;
  correta: boolean;
  /** Por que esta opção está certa ou errada (a frase do cartão "Isso!" e a de cada opção errada). */
  porque: string;
}

/**
 * O "Sua vez": uma pergunta de escolha com 3 opções e exatamente 1 certa. Na segunda escolha errada o cliente mostra a certa e
 * segue. Não é corrigida pelo servidor, não tem resposta digitada e não conta no progresso nem no comprovante.
 */
export interface Tentativa {
  pergunta: string;
  opcoes: OpcaoDoSuaVez[];
}

export interface PassoDaResolucao {
  /** Até 24 caracteres: aparece na linha compacta do passo feito. */
  nome: string;
  /** A frase do passo (texto simples; fórmula só em `formula`). */
  texto: string;
  /** LaTeX restrito, canônico. Com `\foco{…}` no que mudou neste passo e `\resposta{…}` no valor achado. */
  formula?: string;
  /** O desenho inteiro deste passo; mantém os eixos e o intervalo do passo anterior (o servidor força isso). */
  visual?: VisualFigura;
  /** Exatamente um passo da resolução tem, e é o penúltimo ou o último. */
  tentativa?: Tentativa;
}

/** Exemplo resolvido junto com a pessoa: de 3 a 5 passos, com outros números que os do exercício. */
export interface Resolucao {
  problema: string;
  /** O desenho do problema, com o procurado marcado (sem a posição dele). */
  visual?: VisualFigura;
  passos: PassoDaResolucao[];
}

export const LIMITES_VISUAIS = {
  visuaisPorLicao: 3,
  pontos: 12,
  pontosComRotulo: 8,
  segmentos: 12,
  poligonos: 4,
  verticesDoPoligono: 8,
  guias: 6,
  pontosDaReta: 8,
  intervalos: 3,
  coordenadaMaxima: 1000,
  casasDecimais: 2,
  alt: 140,
  altDaFormula: 60,
  passosMin: 3,
  passosMax: 5,
  nomeDoPasso: 24,
  textoDoPasso: 300,
  problema: 300,
  pergunta: 200,
  porque: 240,
  textoDaOpcao: 60,
} as const;

/* ----- Capacidades do cliente (X-Studoo-Capacidades) ----- */

/**
 * Uma lista que o cliente manda em toda chamada: `X-Studoo-Capacidades: visuais@1,resolucao@1`. Sem o cabeçalho (build 3, site
 * antigo), o servidor omite os campos novos e entrega o desenho como PNG pelo `recurso`, que esses clientes já desenham.
 * - `visuais@1`: plano, reta numérica e fórmula; `visuais@2` (futuro): gráfico de função e os demais. As versões são
 *   cumulativas (`visuais@2` inclui `visuais@1`).
 * - `resolucao@1`: o "Resolva comigo" com o "Sua vez". Só vale junto de `visuais`.
 * - Nome ou versão desconhecidos são ignorados; o servidor responde pelo menor entre o que o cliente pede e o que ele sabe.
 */
export const CABECALHO_CAPACIDADES = "X-Studoo-Capacidades";

export interface Capacidades {
  visuais: number;
  resolucao: number;
}

/** O que este servidor sabe entregar. */
export const VERSOES_DO_SERVIDOR: Readonly<Capacidades> = { visuais: 1, resolucao: 1 };

/** O que um cliente que desenha tudo isto manda. */
export const CAPACIDADES_DESTE_CLIENTE = "visuais@1,resolucao@1";

const CABECALHO_MAXIMO = 200;

/** Lê o cabeçalho: 0 em tudo que o cliente não declarou. Nunca lança. */
export function lerCapacidades(cabecalho: string | null | undefined, servidor: Readonly<Capacidades> = VERSOES_DO_SERVIDOR): Capacidades {
  const lidas: Capacidades = { visuais: 0, resolucao: 0 };
  if (typeof cabecalho !== "string" || cabecalho.length === 0 || cabecalho.length > CABECALHO_MAXIMO) return lidas;
  for (const entrada of cabecalho.split(",")) {
    const encontrada = /^\s*([a-z][a-z0-9_]*)@(\d{1,2})\s*$/i.exec(entrada);
    if (!encontrada) continue;
    const nome = encontrada[1].toLowerCase();
    const versao = Number(encontrada[2]);
    if ((nome === "visuais" || nome === "resolucao") && versao > 0) lidas[nome] = Math.max(lidas[nome], versao);
  }
  const efetivas: Capacidades = {
    visuais: Math.min(lidas.visuais, servidor.visuais),
    resolucao: Math.min(lidas.resolucao, servidor.resolucao),
  };
  if (efetivas.visuais === 0) efetivas.resolucao = 0;
  return efetivas;
}

/** O valor do cabeçalho para uma lista de capacidades (0 não entra). */
export function cabecalhoDeCapacidades(capacidades: Partial<Capacidades>): string {
  return (["visuais", "resolucao"] as const)
    .filter((nome) => (capacidades[nome] ?? 0) > 0)
    .map((nome) => `${nome}@${capacidades[nome]}`)
    .join(",");
}

/* ----- Desenho: o que o motor devolve ----- */

/** Largura de projeto do desenho. Web e app só escalam pela largura disponível; o PNG sai desta largura vezes 4. */
export const LARGURA_DO_DESENHO = 320;

/** Teto de primitivas depois do layout, conferido no validador: acima disso o visual some e a lição segue. */
export const TETO_DE_PRIMITIVAS = 300;

/**
 * As cores são papéis, nunca hexadecimais no dado: cada cliente aplica o seu tema e o PNG do servidor usa o mesmo mapa
 * (`PALETA_DO_DESENHO`, no motor).
 */
export const PAPEIS_DE_COR = [
  "texto", "suave", "eixo", "grade", "segmento", "preenchimento", "separador", "fundo",
  "dado", "especial", "especialTexto", "procurado", "procuradoTexto", "procuradoFundo",
  "resposta", "respostaTexto", "respostaFundo", "foco", "focoTexto", "focoFundo", "soma", "subtrai",
] as const;
export type PapelDeCor = (typeof PAPEIS_DE_COR)[number];

/** Traço e vazio, em unidades de projeto. */
export type Tracejado = readonly [number, number];

/**
 * O que o motor desenha, em coordenadas da largura de projeto, com `y` para baixo. O texto (rótulos, números, a fórmula)
 * já vem como contorno de glifos num `caminho`; o `d` só tem M, L, C, Q e Z e é gerado pelo motor, nunca pela IA.
 */
export type Primitiva =
  | { tipo: "linha"; x1: number; y1: number; x2: number; y2: number; cor: PapelDeCor; largura: number; tracejado?: Tracejado; opacidade?: number; seta?: boolean }
  | { tipo: "retangulo"; x: number; y: number; largura: number; altura: number; raio?: number; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; opacidade?: number }
  | { tipo: "circulo"; cx: number; cy: number; raio: number; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; tracejado?: Tracejado; opacidade?: number }
  | { tipo: "caminho"; d: string; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; tracejado?: Tracejado; opacidade?: number };

export interface Desenho {
  /** Sempre `LARGURA_DO_DESENHO`: o `viewBox` é `0 0 largura altura`. */
  largura: number;
  altura: number;
  primitivas: Primitiva[];
  /** Texto para o leitor de tela (para a fórmula, o texto falado). */
  descricao: string;
}

/**
 * Onde o desenho aparece, e por isso o que ele pode mostrar. O ponto `procurado` (e o `resposta`) só é desenhado na posição
 * dele no último passo do "Resolva comigo" e no retorno do exercício; no enunciado, no exemplo e no PNG da fase 1 ele fica só
 * na legenda ("C = ?").
 */
export type ContextoDoDesenho =
  | { tipo: "enunciado" }
  | { tipo: "passo"; ultimo: boolean }
  | { tipo: "retorno" };

/** O ponto aparece na posição dele neste contexto? */
export function pontoApareceNaPosicao(papel: PapelPonto, contexto: ContextoDoDesenho): boolean {
  if (papel === "dado" || papel === "especial") return true;
  return contexto.tipo === "retorno" || (contexto.tipo === "passo" && contexto.ultimo);
}
