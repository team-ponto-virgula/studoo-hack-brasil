import { ErroStudoo, LIMITES_GERACAO, type TransporteStudoo } from './aprendizado';

/** Onboarding e retenção privados por conta; nenhum estado depende da instalação. */
export const VERSAO_ONBOARDING = 1 as const;
export const METAS_LICOES_DIA = [1, 2, 3] as const;
export type MetaLicoesDia = typeof METAS_LICOES_DIA[number];
export type ModoOnboarding = 'assunto' | 'material';
export type EtapaOnboarding = 'preparacao' | 'trilha' | 'licao' | 'concluido';

export interface EstadoOnboarding {
  versao: typeof VERSAO_ONBOARDING;
  etapa: EtapaOnboarding;
  objetivo: string | null;
  modo: ModoOnboarding;
  metaLicoesDia: MetaLicoesDia;
  planoId: string | null;
  iniciadoEm: string;
  atualizadoEm: string;
  adiadoEm: string | null;
  concluidoEm: string | null;
}

export interface ProximoPassoRetencao {
  planoId: string;
  planoTitulo: string;
  fluxoId: string;
  licaoId: string;
  licaoTitulo: string;
}

export interface ResumoRetencao {
  metaLicoesDia: MetaLicoesDia;
  /** Lições distintas concluídas pela primeira vez no dia local da conta. Rever não duplica. */
  licoesHoje: number;
  metaAtingida: boolean;
  totalLicoesConcluidas: number;
  diasSeguidos: number;
  diasDeEstudo: number;
  ultimaAtividadeEm: string | null;
  proximoPasso: ProximoPassoRetencao | null;
}

/** GET /api/onboarding, com cookie web ou Bearer nativo nos mesmos guardas privados do produto. */
export interface RespostaOnboarding {
  /** Null para contas anteriores à migração e para visitante. Nunca inferir pelo número de trilhas. */
  onboarding: EstadoOnboarding | null;
  /** Só a sessão emitida na criação da conta pode iniciar automaticamente. Login posterior não repete. */
  iniciarAutomaticamente: boolean;
  retencao: ResumoRetencao;
}

/** POST /api/onboarding. Não há ação para alegar conclusão: o servidor exige uma conclusão real. */
export type AcaoOnboarding =
  | { acao: 'iniciar' }
  | { acao: 'preparar'; objetivo: string; metaLicoesDia: MetaLicoesDia; modo?: ModoOnboarding; fuso?: string }
  | { acao: 'vincular-plano'; planoId: string }
  | { acao: 'adiar' }
  | { acao: 'retomar' }
  | { acao: 'definir-meta'; metaLicoesDia: MetaLicoesDia; fuso?: string };

export function metaLicoesDiaValida(meta: unknown): meta is MetaLicoesDia {
  return typeof meta === 'number' && (METAS_LICOES_DIA as readonly number[]).includes(meta);
}

export function objetivoOnboardingValido(objetivo: unknown): objetivo is string {
  return typeof objetivo === 'string' && objetivo.trim().length >= 3 && objetivo.trim().length <= LIMITES_GERACAO.objetivoMax;
}

/** Os dois clientes usam o mesmo caminho, corpo e conversão de falha, com seu transporte autenticado. */
export function criarClienteOnboarding(transporte: TransporteStudoo) {
  async function solicitar(acao?: AcaoOnboarding): Promise<RespostaOnboarding> {
    const resposta = await transporte('/api/onboarding', {
      method: acao ? 'POST' : 'GET',
      ...(acao && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(acao) }),
    });
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || corpo === null) {
      const recebido = typeof corpo === 'object' && corpo !== null && 'codigo' in corpo ? corpo.codigo : undefined;
      const codigos = ['invalido', 'nao_autenticado', 'nao_encontrado', 'origem_invalida', 'falha'] as const;
      throw new ErroStudoo(codigos.find(codigo => codigo === recebido) ?? 'falha', corpo ?? undefined);
    }
    return corpo as RespostaOnboarding;
  }
  return {
    obterOnboarding: () => solicitar(),
    atualizarOnboarding: (acao: AcaoOnboarding) => solicitar(acao),
  };
}
