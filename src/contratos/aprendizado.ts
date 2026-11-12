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
] as const;

export type CodigoErro = typeof codigosErro[number];

export class ErroStudoo extends Error {
  constructor(public readonly codigo: CodigoErro) {
    super(codigo);
    this.name = "ErroStudoo";
  }
}

type Autenticacao = { autenticado: true };

export function criarClienteStudoo(transporte: typeof fetch = fetch) {
  async function solicitar<T>(caminho: string, metodo = "GET", dados?: object): Promise<T> {
    const resposta = await transporte(`/api${caminho}`, {
      method: metodo,
      credentials: "same-origin",
      cache: "no-store",
      ...(dados && {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      }),
    });
    if (resposta.status === 204) return null as T;
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || corpo === null) {
      const codigo = codigosErro.find((valor) => valor === corpo?.codigo);
      throw new ErroStudoo(codigo ?? "falha");
    }
    return corpo as T;
  }

  return {
    login: (email: string, senha: string) => solicitar<Autenticacao>("/login", "POST", { email, senha }),
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
