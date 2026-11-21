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
  /**
   * Só no que vai pela rede, e só na figura que tem ponto procurado (`comCaixaDoPar`, no servidor): a menor `alturaMaxima` em que o enunciado E o retorno dela
   * desenham. O motor a lê para que os dois usem a MESMA caixa: se um não cabe, nenhum desenha (`naoCabe` nos dois, e o cliente mostra o `alt`), e nada
   * pula no acerto. Sem ela, cada contexto decide sozinho. Nunca é guardada: o validador a descarta.
   */
  alturaMinimaComRetorno?: number;
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
  /**
   * Só no que vai pela rede, e só na figura que tem ponto procurado (`comCaixaDoPar`, no servidor): a menor `alturaMaxima` em que o enunciado E o retorno dela
   * desenham. O motor a lê para que os dois usem a MESMA caixa: se um não cabe, nenhum desenha (`naoCabe` nos dois, e o cliente mostra o `alt`), e nada
   * pula no acerto. Sem ela, cada contexto decide sozinho. Nunca é guardada: o validador a descarta.
   */
  alturaMinimaComRetorno?: number;
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

/* ----- Gráfico de função (spec 15, seção 15): `visuais@2` ----- */

export const NOMES_DE_CURVA = ["f", "g", "h"] as const;
export type NomeDeCurva = (typeof NOMES_DE_CURVA)[number];

/**
 * Uma curva de uma função de x. `latex` é a expressão no LaTeX restrito (`funcao-expressao.ts`), guardada na forma canônica e sem o `f(x) =`;
 * `nome` é a letra da curva (f, g ou h; sem ela, na ordem); `de` e `ate`, o domínio, que a IA pode omitir (o motor escolhe pelo que aparece).
 */
export interface CurvaDaFuncao {
  nome: NomeDeCurva;
  latex: string;
  de?: number;
  ate?: number;
}

/** O que o servidor sabe calcular numa curva: raiz e vértice (até o grau 2), intercepto em y, interseção de duas curvas (12b) e o valor f(a). */
export const TIPOS_DE_DESTAQUE = ["raiz", "vertice", "intercepto", "intersecao", "valor"] as const;
export type TipoDeDestaque = (typeof TIPOS_DE_DESTAQUE)[number];

/**
 * Ponto sobre a curva. Raiz, vértice, intercepto e interseção são sempre do papel `especial` (losango), a não ser que sejam o procurado. As
 * coordenadas, no que o servidor guarda, sempre existem (ele as calcula e confere); só faltam nos pontos `procurado` e `resposta` do enunciado
 * público (`visualParaEnunciado`).
 */
export interface PontoDaFuncao {
  id: string;
  papel: PapelPonto;
  tipo?: TipoDeDestaque;
  curva?: NomeDeCurva;
  x?: number;
  y?: number;
  rotulo?: boolean;
}

/**
 * O gráfico de uma ou até três funções, com os pontos de destaque. Quando o exercício pergunta um ponto da curva (há um ponto `procurado`),
 * o motor NÃO desenha a curva no enunciado: ler o cruzamento com o eixo ou a ponta da parábola entregaria a resposta.
 */
export interface VisualFuncao {
  tipo: "funcao";
  alt: string;
  /** De 1 a 3. */
  curvas: CurvaDaFuncao[];
  pontos?: PontoDaFuncao[];
  /**
   * Só no que vai pela rede, e só na figura que tem ponto procurado (`comCaixaDoPar`, no servidor): a menor `alturaMaxima` em que o enunciado E o retorno dela
   * desenham. O motor a lê para que os dois usem a MESMA caixa: se um não cabe, nenhum desenha (`naoCabe` nos dois, e o cliente mostra o `alt`), e nada
   * pula no acerto. Sem ela, cada contexto decide sozinho. Nunca é guardada: o validador a descarta.
   */
  alturaMinimaComRetorno?: number;
}

export type VisualFigura = VisualPlano | VisualRetaNumerica | VisualFuncao;
export type Visual = VisualFigura | VisualFormula;
export const TIPOS_VISUAL = ["plano", "reta_numerica", "funcao", "formula"] as const;
export type TipoVisual = (typeof TIPOS_VISUAL)[number];

/* ----- "Resolva comigo" ----- */

/**
 * O "Sua vez" é uma pergunta de escolha com 3 opções e exatamente 1 certa. Não é corrigido para valer nota, não tem resposta
 * digitada e não conta no progresso nem no comprovante. Na segunda escolha errada o cliente mostra a certa e segue.
 *
 * Duas formas, para a resposta não ir pela rede antes da hora:
 * - `Tentativa` é o que o cliente recebe: a pergunta e as opções (um número em `texto` ou uma fórmula em linha em `formula`,
 *   nunca os dois), sem `correta` nem `porque`;
 * - `TentativaGuardada` é o que o servidor guarda: as mesmas opções com `correta` e o `porque` de cada uma.
 */
export interface OpcaoDoSuaVez {
  texto?: string;
  formula?: string;
}
export interface OpcaoCorrigida extends OpcaoDoSuaVez {
  correta: boolean;
  /** Por que esta opção está certa ou errada (a frase do cartão "Isso!" e a de cada opção errada). */
  porque: string;
}
export interface Tentativa {
  pergunta: string;
  opcoes: OpcaoDoSuaVez[];
}
export interface TentativaGuardada {
  pergunta: string;
  opcoes: OpcaoCorrigida[];
}

/**
 * Passo como o cliente o recebe. No passo do "Sua vez", `formula` e `visual` são a REVELAÇÃO (o resultado que a pessoa vai
 * escolher e o desenho dele): o servidor só os manda depois do acerto ou da segunda escolha errada (`RespostaDoSuaVez.depois`),
 * e tira o `\resposta{}` e a posição do ponto procurado de tudo o que vem antes.
 */
export interface PassoDaResolucao {
  /** Até 24 caracteres: aparece na linha compacta do passo feito. */
  nome: string;
  /** A frase do passo (texto simples; fórmula só em `formula`). */
  texto: string;
  /** LaTeX restrito, canônico. Com `\foco{…}` no que mudou neste passo e `\resposta{…}` no valor achado. */
  formula?: string;
  /** O desenho inteiro deste passo; mantém os eixos e o intervalo do passo anterior (o servidor força isso). */
  visual?: VisualFigura;
  tentativa?: Tentativa;
}
export interface PassoGuardado extends Omit<PassoDaResolucao, "tentativa"> {
  /** Exatamente um passo da resolução tem, e é o penúltimo ou o último. */
  tentativa?: TentativaGuardada;
}

/**
 * "Resolva comigo" como o cliente recebe, ANTES do "Sua vez": os passos até o do "Sua vez", sem a revelação dele e sem os que
 * vêm depois. `total` é o número de passos da resolução inteira ("Passo 2 de 4").
 */
export interface Resolucao {
  problema: string;
  /** O desenho do problema, com o procurado marcado (sem a posição dele). */
  visual?: VisualFigura;
  total: number;
  passos: PassoDaResolucao[];
}

/** O que o servidor guarda: de 3 a 5 passos, com outros números que os do exercício, e a resposta de tudo. */
export interface ResolucaoGuardada {
  problema: string;
  visual?: VisualFigura;
  passos: PassoGuardado[];
}

/** Quantas vezes a pessoa já escolheu no "Sua vez" (1 ou 2): na segunda errada o servidor mostra a certa. */
export interface EscolhaNoSuaVez {
  opcao: number;
  tentativa: 1 | 2;
}

/** A resposta de `POST /api/aprendizado/licoes/[id]/resolucao`: a correção de uma escolha e, quando vale, o que vem depois. */
export interface RespostaDoSuaVez {
  correta: boolean;
  /** O porquê da opção escolhida. */
  porque: string;
  /** Só na segunda escolha errada: o índice da opção certa e o porquê dela ("o Studoo mostra a certa, com o porquê"). */
  certa?: number;
  porqueDaCerta?: string;
  /**
   * Só no acerto e na segunda errada: o que o passo do "Sua vez" mostra depois (a fórmula e o desenho dele) e os passos que
   * faltam, com o `\resposta{}` e o ponto procurado na posição.
   */
  depois?: { formula?: string; visual?: VisualFigura; passos: PassoDaResolucao[] };
}

/**
 * A janela de um eixo ajustada aos dados (spec 15, seção 11): do menor ao maior valor, com `folga` unidades a mais de cada lado, em
 * inteiros, incluindo a origem se `incluirOrigem`, e no mínimo 4 de largura. Sem unidades vazias: o gráfico estreita quando a altura
 * limita, em vez de abrir a janela para encher a largura.
 */
export function janelaDosDados(valores: readonly number[], incluirOrigem: boolean, folga = 1): [number, number] {
  const todos = incluirOrigem ? [...valores, 0] : [...valores];
  if (todos.length === 0) return [-2, 2];
  let minimo = Math.floor(Math.min(...todos) - folga);
  let maximo = Math.ceil(Math.max(...todos) + folga);
  while (maximo - minimo < 4) {
    minimo -= 1;
    maximo += 1;
  }
  return [minimo, maximo];
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
  curvas: 3,
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
 * - `visuais@1`: plano, reta numérica e fórmula; `visuais@2`: o gráfico de função (`funcao`) também. As versões são
 *   cumulativas (`visuais@2` inclui `visuais@1`).
 * - `resolucao@1`: o "Resolva comigo" com o "Sua vez". Só vale junto de `visuais`.
 * - Nome ou versão desconhecidos são ignorados; o servidor responde pelo menor entre o que o cliente pede e o que ele sabe.
 */
export const CABECALHO_CAPACIDADES = "X-Studoo-Capacidades";

export interface Capacidades {
  visuais: number;
  resolucao: number;
}

/** O que este servidor sabe entregar: `visuais@2` é o gráfico de função (marco 12a); quem anuncia só `visuais@1` não o recebe. */
export const VERSOES_DO_SERVIDOR: Readonly<Capacidades> = { visuais: 2, resolucao: 1 };

/** A versão de `visuais` a partir da qual o cliente desenha o gráfico de função (spec 15, seção 15). */
export const VISUAIS_COM_FUNCAO = 2;

/**
 * O que um cliente que desenha tudo isto manda. `visuais@2` (marco 12a): o cliente desenha o gráfico de função (`funcao`) com o motor deste contrato (a web e o app já o
 * fazem a partir das mesmas fixtures); `resolucao@1`: o "Resolva comigo". Cada cliente tem a sua constante (a web em `src/contratos/capacidades.ts`, o app na dele): esta é a do
 * contrato, para quem desenha tudo.
 */
export const CAPACIDADES_DESTE_CLIENTE = "visuais@2,resolucao@1";

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
 * As cores são papéis, nunca hexadecimais no dado: cada cliente aplica o seu tema e o PNG do servidor usa o mesmo mapa,
 * `PALETA_DO_DESENHO` (o app importa este e o teste de paleta o trava).
 */
export const PAPEIS_DE_COR = [
  "texto", "suave", "eixo", "grade", "segmento", "preenchimento", "separador", "fundo", "branco",
  "dado", "especial", "especialTexto", "procurado", "procuradoTexto", "procuradoFundo",
  "resposta", "respostaTexto", "respostaFundo", "foco", "focoTexto", "focoFundo", "soma", "subtrai",
] as const;
export type PapelDeCor = (typeof PAPEIS_DE_COR)[number];

/**
 * Cores da spec 15 (as finais, do Designer). Texto a pelo menos 4,5:1 sobre o fundo dele; gráfico a pelo menos 3:1 sobre o
 * branco. Cada cor de traço tem um par mais escuro para texto: o roxo `#7C5CFF` do losango e `#5B3FD9` no texto, o azul `#2563FF`
 * do traço e `#1D4ED8` do texto em foco, o âmbar `#B9780F` do anel do procurado e `#9A5B00` no "C = ?". O vermelho não existe
 * aqui: fica só no retorno de erro. `preenchimento` vale com opacidade 0,07 e `fundo` é o bloco da fórmula no app (no PNG o
 * fundo é branco).
 */
export const PALETA_DO_DESENHO: Readonly<Record<PapelDeCor, string>> = {
  texto: "#0B1B5C",
  suave: "#5E6A85",
  eixo: "#0B1B5C",
  grade: "#E1E7FA",
  segmento: "#2563FF",
  preenchimento: "#2563FF",
  separador: "#E1E7FA",
  fundo: "#F1F4FD",
  branco: "#FFFFFF",
  dado: "#2563FF",
  especial: "#7C5CFF",
  especialTexto: "#5B3FD9",
  procurado: "#B9780F",
  procuradoTexto: "#9A5B00",
  procuradoFundo: "#FFF6EA",
  resposta: "#1F7A5A",
  respostaTexto: "#1F7A5A",
  respostaFundo: "#E8F6EF",
  foco: "#2563FF",
  focoTexto: "#1D4ED8",
  focoFundo: "#EAF0FF",
  soma: "#2563FF",
  subtrai: "#B9780F",
};

/** Traço e vazio, em unidades de projeto. */
export type Tracejado = readonly [number, number];

/**
 * O que o motor desenha, em coordenadas da largura de projeto, com `y` para baixo. O texto (rótulos, números, a fórmula)
 * já vem como contorno de glifos num `caminho`, e a ponta de seta também é um `caminho` preenchido, de tamanho fixo (nada de
 * `Marker`: ele é instável no Android). O `d` só tem M, L, Q e Z e é gerado pelo motor, nunca pela IA.
 *
 * Regras que todo cliente aplica igual (senão o desenho muda de um para o outro):
 * - preenchimento `nonzero` (`REGRA_DE_PREENCHIMENTO`): os contornos de dentro (o miolo do "o", do "8", do Δ) vêm no sentido
 *   contrário do de fora, e é isso que os deixa vazados;
 * - ponta da linha `butt` e junção `round` (`PONTA_DA_LINHA`, `JUNCAO_DA_LINHA`): a ponta redonda alongaria cada traço do tracejado;
 * - `opacidade` vale para o primitivo inteiro (preenchimento e borda);
 * - o texto sobre o gráfico (rótulos, números e nomes dos eixos) leva um halo: um `caminho` só de contorno (borda `branco`, 6) que o
 *   motor desenha por baixo dos textos e por cima da grade e dos traços, para nenhuma linha atravessar uma letra.
 */
export type Primitiva =
  | { tipo: "linha"; x1: number; y1: number; x2: number; y2: number; cor: PapelDeCor; largura: number; tracejado?: Tracejado; opacidade?: number }
  | { tipo: "retangulo"; x: number; y: number; largura: number; altura: number; raio?: number; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; opacidade?: number }
  | { tipo: "circulo"; cx: number; cy: number; raio: number; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; tracejado?: Tracejado; opacidade?: number }
  | { tipo: "caminho"; d: string; preenchimento?: PapelDeCor; borda?: PapelDeCor; larguraDaBorda?: number; tracejado?: Tracejado; opacidade?: number };

export const REGRA_DE_PREENCHIMENTO = "nonzero" as const;
export const PONTA_DA_LINHA = "butt" as const;
export const JUNCAO_DA_LINHA = "round" as const;

/**
 * O menor tamanho de texto do desenho, em unidades de projeto (decisão do Designer, spec 15, seção 8). Na largura útil de um
 * iPhone SE (cerca de 280) a escala é 0,875: 13 unidades saem com 11,4 pt, acima do mínimo de 11. O motor nunca desenha texto
 * menor (rótulo, número do eixo, índice, expoente). Tamanhos: rótulos de ponto 14 em 800, legenda 14, números dos eixos 13,
 * índice e expoente com 65% da base (piso 13), fórmula 22.
 */
export const PISO_DO_TEXTO = 13;

/**
 * Uma fórmula em linha, para o cliente encaixar no meio da frase como uma caixa do tamanho do texto ao redor: `largura` e `altura`
 * em unidades de projeto (escalam com o corpo do texto), `linhaDeBase` é a distância do topo da caixa à linha de base do texto (para
 * alinhar com as palavras), e as primitivas ficam em coordenadas da caixa, com os mesmos papéis de cor do resto do desenho.
 */
export interface DesenhoEmLinha {
  largura: number;
  altura: number;
  linhaDeBase: number;
  primitivas: Primitiva[];
  /** O texto falado da fórmula, para o rótulo do leitor de tela do trecho. */
  falado: string;
  menorTexto: number;
}

/** Retângulo de um texto do gráfico, do canto de cima à esquerda, em unidades de projeto. */
export interface CaixaDeTexto {
  tipo: "numero" | "rotulo" | "eixo" | "foco";
  texto: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface Desenho {
  /** Sempre `LARGURA_DO_DESENHO`: o `viewBox` é `0 0 largura altura`. */
  largura: number;
  altura: number;
  primitivas: Primitiva[];
  /** Texto para o leitor de tela (para a fórmula, o texto falado). */
  descricao: string;
  /** O menor texto que o desenho usa, em unidades de projeto (nunca menos que `PISO_DO_TEXTO`). */
  menorTexto: number;
  /** Os textos que o desenho escreve, na ordem em que saem (rótulos, números dos eixos, legenda): para conferir e para o teste. */
  textos: string[];
  /** Onde cada texto da figura (número de eixo, rótulo de ponto, nome de eixo) ficou, em unidades de projeto: o teste prova que nada bate em nada. */
  caixas: CaixaDeTexto[];
  /** Fórmula mais larga que o desenho (depois de encolher até 85%): o cliente rola para o lado. Sem isto, tudo cabe. */
  larguraDoConteudo?: number;
  /**
   * A figura não coube em `alturaMaxima`, nem depois de descer a escala do gráfico e a legenda até o menor tamanho (o texto nunca
   * desce do piso). `altura` passa de `alturaMaxima` e o cliente NÃO deve mostrá-la: o visual vale como inválido e a lição segue
   * em texto. Também sai `naoCabe` o desenho que cabe, quando o enunciado e o retorno da mesma figura (com ponto procurado) não cabem na mesma caixa:
   * se um não cabe nenhum desenha (`alturaMinimaComRetorno`). Sem este campo, `altura <= alturaMaxima`, sempre.
   */
  naoCabe?: true;
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
