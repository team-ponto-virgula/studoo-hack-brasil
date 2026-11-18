import type { ArquivoEstudo, MaterialEstudo, ReferenciaMaterial, ApoioEstudo, FeedbackEnsino } from './estudio';
import type { MotivoRever } from './licao';
export * from './estudio';
export * from './licao';
export * from './som';
export * from './fala';
export interface Progresso {
  concluidas: number;
  total: number;
  percentual: number | null;
}

export interface PropostaPlano {
  token: string;
  titulo: string;
  objetivo: string;
  origem: string;
  /** `resumo`: o que a lição ensina, numa frase curta, para a prévia (opcional: trilhas antigas não têm). */
  fluxos: { titulo: string; licoes: { titulo: string; resumo?: string }[] }[];
}

export interface PlanoResumo {
  id: string;
  titulo: string;
  progresso: Progresso;
}

export interface PlanoDetalhe extends PlanoResumo {
  objetivo: string;
  origem: string;
  fluxos: {
    id: string;
    titulo: string;
    progresso: Progresso;
    proximaLicaoId: string | null;
    /** `rever`: por que vale rever a lição concluída (`motivoParaRever`); o mapa marca "Vale rever" e diz o motivo. */
    licoes: { id: string; titulo: string; concluida: boolean; ponte?: { concluida: boolean }; rever?: MotivoRever }[];
  }[];
  /** Somas das lições concluídas com resumo: tempo e exercícios de primeira (para o fim da trilha). */
  estatisticas?: { segundos: number; acertosDePrimeira: number; exercicios: number };
}

/** O resumo de uma lição concluída, guardado para o total da trilha. */
export interface ResumoConclusao {
  segundos: number;
  acertosDePrimeira: number;
  exercicios: number;
}

/**
 * Como o trecho de um exercício aparece. Só `codigo` usa fonte monoespaçada; uma frase em inglês, uma citação histórica,
 * uma fórmula ou o passo a passo de uma receita têm cada um o seu visual.
 */
export const TIPOS_TRECHO = ["codigo", "frase", "citacao", "formula", "passos"] as const;
export type TipoTrecho = (typeof TIPOS_TRECHO)[number];

/**
 * Algo para ouvir em voz alta (pronúncia, diálogo): texto, idioma BCP 47 (como `en-US`), a tradução e, se houver, a
 * pronúncia escrita do jeito que se lê em português (`ek-SKIÚZ mi`), para quem está sem voz no aparelho.
 */
export interface Fala {
  texto: string;
  idioma: string;
  traducao?: string;
  pronuncia?: string;
}

/**
 * Recurso visual da lição, mostrado no exemplo. O acorde, a linha do tempo e a barra de fração são desenhados pelo
 * próprio app (e o acorde também toca); a imagem é a foto do material que a pessoa enviou.
 * - `fracao`: uma barra com `denominador` partes iguais, `numerador` delas pintadas, e um rótulo opcional (como "2/4 = 1/2").
 * - `acorde.casas`: 6 números, da 6ª corda (mi grave) à 1ª (mi agudo): -1 não toca, 0 solta, n = casa apertada.
 * - `acorde.dedos`: o dedo de cada corda (1 indicador, 2 médio, 3 anelar, 4 mínimo; 0 nenhum).
 * - `acorde.batida`: a lição é de ritmo; o app também toca o acorde numa batida para baixo e para cima.
 */
export type Recurso =
  /** `anterior`: o acorde de onde a troca parte, desenhado ao lado para comparar (Am → C). */
  | { tipo: "acorde"; nome: string; casas: number[]; dedos?: number[]; batida?: boolean; anterior?: { nome: string; casas: number[]; dedos?: number[] } }
  | { tipo: "linha_do_tempo"; eventos: { quando: string; texto: string }[] }
  | { tipo: "fracao"; numerador: number; denominador: number; rotulo?: string }
  /** `fonte`: de onde vem a imagem (sem ela, é a página do material da pessoa). */
  | { tipo: "imagem"; src: string; descricao: string; fonte?: string };

/** Prática no mundo real (instrumento, cozinha, fala): a tarefa, o tempo do cronômetro e, se houver, passos e uma dica. */
export interface Pratica {
  tarefa: string;
  minutos: number;
  passos?: string[];
  dica?: string;
  /** Um som de referência para a prática (a 6ª corda solta, para afinar), tocado pelo app: o rótulo e as casas. */
  som?: { rotulo: string; casas: number[] };
}

/** Como a pessoa diz que foi a prática, na volta do cronômetro. */
export const AUTOAVALIACOES = ["consegui", "quase", "ainda_nao"] as const;
export type AutoAvaliacao = (typeof AUTOAVALIACOES)[number];

export interface Opcao {
  id: string;
  texto: string;
}

interface Enunciado {
  enunciado: string;
  contexto?: string;
  trecho?: string;
  /** Visual do trecho; sem ele, o app trata o trecho como frase. */
  trechoTipo?: TipoTrecho;
  /** Áudio do exercício (ouça e responda). Sem trecho, o texto fica escondido até a pessoa pedir para ler. */
  fala?: Fala;
}

/**
 * Exercício como a pessoa vê, sem gabarito. A resposta vai sempre como texto (veja `codificarResposta`):
 * - `lacuna`: o que a pessoa escreveu (a correção tolera acento, maiúscula e um deslize de digitação em palavras longas);
 * - `multipla_escolha`: o id da opção;
 * - `ordenar`: os ids na ordem escolhida (os itens chegam embaralhados);
 * - `associar`: os pares esquerda=direita (a coluna da direita chega embaralhada);
 * - `verdadeiro_falso`: o valor e o id da justificativa;
 * - `aberta`: a explicação, com pelo menos `minimo` caracteres.
 */
export type ExercicioPublico = Enunciado & (
  | { tipo: "lacuna" }
  | { tipo: "multipla_escolha"; opcoes: Opcao[] }
  | { tipo: "ordenar"; itens: Opcao[] }
  | { tipo: "associar"; esquerda: Opcao[]; direita: Opcao[] }
  | { tipo: "verdadeiro_falso"; afirmacao: string; justificativas: Opcao[] }
  | { tipo: "aberta"; minimo: number }
);
export type TipoExercicio = ExercicioPublico["tipo"];

export interface LicaoDetalhe {
  referencias?: ReferenciaMaterial[];
  id: string;
  planoId: string;
  fluxoId: string;
  titulo: string;
  objetivo: string;
  conceito: string;
  exemplo: string;
  /** `demonstracao` nas habilidades práticas: o exemplo vira um passo a passo para fazer junto. */
  exemploTipo?: "exemplo" | "demonstracao";
  passos?: string[];
  recurso?: Recurso;
  /** Frases para ouvir e repetir, no exemplo. */
  falas?: Fala[];
  origem: string;
  /** O primeiro exercício (clientes antigos usam só este). */
  exercicio: ExercicioPublico;
  /** Todos os exercícios, na ordem: de 1 a 3. */
  exercicios: ExercicioPublico[];
  /** Prática no mundo real, depois dos exercícios. */
  pratica?: Pratica;
  concluida: boolean;
}

export interface Avaliacao {
  correta: boolean;
  feedback: string;
  comprovante: string;
  /** Um aviso a mais: aceitou com um deslize de digitação, acertou o valor mas não a justificativa… */
  observacao?: string;
  /** Ordenar e associar: os ids dos itens (ou dos pares, pela esquerda) que já estão certos. */
  certos?: string[];
  /** Resposta aberta: o que a correção procurou e se a resposta trouxe. */
  criterios?: { texto: string; atendido: boolean }[];
  /** Resposta aberta: um exemplo de boa resposta. */
  modelo?: string;
  /** A correção da resposta aberta foi a do modo demonstração (ideias-chave, sem IA). */
  simulado?: boolean;
}

export interface Conclusao {
  concluidaEm: string;
  plano: PlanoDetalhe;
}

const codigosErro = [
  "material_invalido", "material_ilegivel", "reforco_indisponivel", "limite_estudio",
  "voz_indisponivel", "voz_vazia", "voz_tempo", "voz_falha",
  "google_indisponivel",
  "google_invalido",
  "google_conta_existente",
  "recuperacao_indisponivel",
  "codigo_invalido",
  "limite_recuperacao",

  "invalido",
  "nao_autenticado",
  "nao_encontrado",
  "origem_invalida",
  "falha",
  "proposta_invalida",
  "avaliacao_invalida",
  "credenciais_invalidas",
  "limite_login",
  "ia_indisponivel",
  "limite_geracoes",
] as const;

export type CodigoErro = typeof codigosErro[number];

export class ErroStudoo extends Error {
  constructor(public readonly codigo: CodigoErro) {
    super(codigo);
    this.name = "ErroStudoo";
  }
}

export const LIMITES_GERACAO = { objetivoMin: 3, objetivoMax: 500 } as const;

/** Uma linha da resposta NDJSON de POST /api/aprendizado/propostas/ao-vivo. */
export type EventoGeracao =
  | { tipo: "plano"; titulo: string; objetivo: string }
  | { tipo: "fluxo"; fluxo: number; titulo: string }
  | { tipo: "licao"; fluxo: number; licao: number; titulo: string; resumo?: string }
  | { tipo: "pronto"; proposta: PropostaPlano }
  | { tipo: "erro"; codigo: CodigoErro };

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0;
}

function indice(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= 0;
}

/** Valida uma linha NDJSON. Devolve null para linha vazia ou fora do contrato. */
export function interpretarEventoGeracao(linha: string): EventoGeracao | null {
  if (!linha.trim()) return null;
  let dado: Record<string, unknown>;
  try {
    const bruto: unknown = JSON.parse(linha);
    if (typeof bruto !== "object" || bruto === null) return null;
    dado = bruto as Record<string, unknown>;
  } catch {
    return null;
  }
  switch (dado.tipo) {
    case "plano":
      return texto(dado.titulo) && texto(dado.objetivo)
        ? { tipo: "plano", titulo: dado.titulo, objetivo: dado.objetivo }
        : null;
    case "fluxo":
      return indice(dado.fluxo) && texto(dado.titulo)
        ? { tipo: "fluxo", fluxo: dado.fluxo, titulo: dado.titulo }
        : null;
    case "licao":
      return indice(dado.fluxo) && indice(dado.licao) && texto(dado.titulo)
        ? {
          tipo: "licao", fluxo: dado.fluxo, licao: dado.licao, titulo: dado.titulo,
          ...(texto(dado.resumo) && dado.resumo.length <= 200 ? { resumo: dado.resumo } : {}),
        }
        : null;
    case "pronto": {
      const proposta = dado.proposta as PropostaPlano | undefined;
      return proposta && texto(proposta.token) && Array.isArray(proposta.fluxos)
        ? { tipo: "pronto", proposta }
        : null;
    }
    case "erro": {
      const codigo = codigosErro.find((valor) => valor === dado.codigo);
      return { tipo: "erro", codigo: codigo ?? "falha" };
    }
    default:
      return null;
  }
}

type Autenticacao = { autenticado: true };

export interface SessaoNativa {
  token: string;
  expiraEm: string;
}

export type TransporteStudoo = (
  caminho: string,
  opcoes: { method: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; ok: boolean; json(): Promise<unknown> }>;

export function criarClienteStudoo(transporte: TransporteStudoo) {
  async function solicitar<T>(caminho: string, metodo = "GET", dados?: object): Promise<T> {
    const resposta = await transporte(`/api${caminho}`, {
      method: metodo,
      ...(dados && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      }),
    });
    if (resposta.status === 204) return null as T;
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || corpo === null) {
      const codigoRecebido = typeof corpo === "object" && corpo !== null && "codigo" in corpo
        ? corpo.codigo
        : undefined;
      const codigo = codigosErro.find((valor) => valor === codigoRecebido);
      throw new ErroStudoo(codigo ?? "falha");
    }
    return corpo as T;
  }

  return {
    enviarMaterial: (arquivo: ArquivoEstudo) => solicitar<MaterialEstudo>('/estudio/materiais', 'POST', arquivo),
    materialDemo: () => solicitar<MaterialEstudo>('/estudio/materiais/demo', 'POST', {}),
    excluirMaterial: (id: string) => solicitar<null>(`/estudio/materiais/${encodeURIComponent(id)}`, 'DELETE'),
    proporMaterial: (id: string, objetivo: string) => solicitar<PropostaPlano>(`/estudio/materiais/${encodeURIComponent(id)}/proposta`, 'POST', { objetivo }),
    apoioLicao: (id: string) => solicitar<ApoioEstudo>(`/estudio/licoes/${encodeURIComponent(id)}`),
    criarPonte: (id: string) => solicitar<ApoioEstudo>(`/estudio/licoes/${encodeURIComponent(id)}/ponte`, 'POST', {}),
    avaliarPonte: (id: string, resposta: string) => solicitar<{ correta: boolean; feedback: string; apoio: ApoioEstudo }>(`/estudio/licoes/${encodeURIComponent(id)}/ponte/avaliar`, 'POST', { resposta }),
    ensinarStu: (id: string, texto: string) => solicitar<FeedbackEnsino>(`/estudio/licoes/${encodeURIComponent(id)}/ensinar`, 'POST', { texto }),
    transcrever: (arquivo: ArquivoEstudo & { idioma?: string }) => solicitar<{ texto: string }>('/estudio/voz', 'POST', arquivo),
    login: (email: string, senha: string) => solicitar<Autenticacao>("/login", "POST", { email, senha }),
    loginNativo: (email: string, senha: string) => solicitar<SessaoNativa>("/mobile/sessao", "POST", { email, senha }),
    configuracaoAcesso: () => solicitar<{ google: boolean; recuperacao: boolean; ia: ProvedorIa }>("/auth/config"),
    recuperarSenha: (email: string, mobile = false) => solicitar<{ enviado: boolean }>(`${mobile ? '/mobile' : ''}/senha/recuperar`, 'POST', { email }),
    redefinirSenha: (email: string, codigo: string, senha: string, mobile = false) => solicitar<{ alterada: boolean }>(`${mobile ? '/mobile' : ''}/senha/redefinir`, 'POST', { email, codigo, senha }),
    trocarCodigoGoogle: (codigo: string, verificador: string) => solicitar<SessaoNativa>('/mobile/google', 'POST', { codigo, verificador }),
    sessao: () => solicitar<Autenticacao>("/sessao"),
    logout: () => solicitar<null>("/sessao", "DELETE"),
    gerarProposta: (objetivo: string) => solicitar<PropostaPlano>("/aprendizado/propostas", "POST", { objetivo }),
    aceitarProposta: (token: string) => solicitar<PlanoDetalhe>("/aprendizado/planos", "POST", { token }),
    listarPlanos: () => solicitar<PlanoResumo[]>("/aprendizado/planos"),
    obterPlano: (id: string) => solicitar<PlanoDetalhe>(`/aprendizado/planos/${encodeURIComponent(id)}`),
    /** Apaga a trilha, com as lições e o progresso dela. */
    apagarPlano: (id: string) => solicitar<{ apagado: true }>(`/aprendizado/planos/${encodeURIComponent(id)}`, "DELETE"),
    obterLicao: (id: string) => solicitar<LicaoDetalhe>(`/aprendizado/licoes/${encodeURIComponent(id)}`),
    /** `indice`: qual exercício da lição (0 é o primeiro). */
    avaliarLicao: (id: string, resposta: string, indice = 0) => solicitar<Avaliacao>(`/aprendizado/licoes/${encodeURIComponent(id)}/avaliar`, "POST", { resposta, indice }),
    /** `pratica`: como foi a prática no mundo real, quando a lição tem uma. */
    concluirLicao: (id: string, comprovante: string, pratica?: AutoAvaliacao, resumo?: ResumoConclusao) =>
      solicitar<Conclusao>(`/aprendizado/licoes/${encodeURIComponent(id)}/concluir`, "POST", { comprovante, ...(pratica ? { pratica } : {}), ...(resumo ? { resumo } : {}) }),
  };
}

export type ProvedorIa = "falsa" | "openai" | "deepseek";
