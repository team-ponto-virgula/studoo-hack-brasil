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
  fluxos: { titulo: string; licoes: { titulo: string }[] }[];
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
    licoes: { id: string; titulo: string; concluida: boolean }[];
  }[];
}

interface Enunciado {
  enunciado: string;
  contexto?: string;
  trecho?: string;
}

export type ExercicioPublico = Enunciado & (
  | { tipo: "lacuna" }
  | { tipo: "multipla_escolha"; opcoes: { id: string; texto: string }[] }
);

export interface LicaoDetalhe {
  id: string;
  planoId: string;
  fluxoId: string;
  titulo: string;
  objetivo: string;
  conceito: string;
  exemplo: string;
  origem: string;
  exercicio: ExercicioPublico;
  concluida: boolean;
}

export interface Avaliacao {
  correta: boolean;
  feedback: string;
  comprovante: string;
}

export interface Conclusao {
  concluidaEm: string;
  plano: PlanoDetalhe;
}

const codigosErro = [
  "invalido",
  "nao_autenticado",
  "nao_encontrado",
  "origem_invalida",
  "falha",
  "objetivo_fora_do_piloto",
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
  | { tipo: "licao"; fluxo: number; licao: number; titulo: string }
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
        ? { tipo: "licao", fluxo: dado.fluxo, licao: dado.licao, titulo: dado.titulo }
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
    login: (email: string, senha: string) => solicitar<Autenticacao>("/login", "POST", { email, senha }),
    loginNativo: (email: string, senha: string) => solicitar<SessaoNativa>("/mobile/sessao", "POST", { email, senha }),
    sessao: () => solicitar<Autenticacao>("/sessao"),
    logout: () => solicitar<null>("/sessao", "DELETE"),
    gerarProposta: (objetivo: string) => solicitar<PropostaPlano>("/aprendizado/propostas", "POST", { objetivo }),
    aceitarProposta: (token: string) => solicitar<PlanoDetalhe>("/aprendizado/planos", "POST", { token }),
    listarPlanos: () => solicitar<PlanoResumo[]>("/aprendizado/planos"),
    obterPlano: (id: string) => solicitar<PlanoDetalhe>(`/aprendizado/planos/${encodeURIComponent(id)}`),
    obterLicao: (id: string) => solicitar<LicaoDetalhe>(`/aprendizado/licoes/${encodeURIComponent(id)}`),
    avaliarLicao: (id: string, resposta: string) => solicitar<Avaliacao>(`/aprendizado/licoes/${encodeURIComponent(id)}/avaliar`, "POST", { resposta }),
    concluirLicao: (id: string, comprovante: string) => solicitar<Conclusao>(`/aprendizado/licoes/${encodeURIComponent(id)}/concluir`, "POST", { comprovante }),
  };
}
