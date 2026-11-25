/**
 * Privacidade (revisão Apple para o TestFlight externo): consentimento antes de dados irem a uma IA de terceiro
 * (App Review 5.1.2(i)), exclusão da conta dentro do app (5.1.1(v)) e a política pública em `/privacidade`.
 *
 * O servidor é quem garante: toda rota que mandaria dado da pessoa à OpenAI sem um aceite vigente
 * responde `consentimento_ia` (HTTP 428) antes de qualquer envio. As que têm alternativa local (correção da resposta,
 * reforço do erro, retorno do "Explique para o Stu") seguem sem a IA, sem erro.
 */

/** Sobe quando o texto do aceite muda de forma relevante (novo provedor, novo uso): o aceite antigo deixa de valer. */
export const VERSAO_CONSENTIMENTO_IA = "2026-11-25";

/** Endereço público da política (web, sem login). O app abre `${origem}${CAMINHO_POLITICA}` no navegador do sistema. */
export const CAMINHO_POLITICA = "/privacidade";

/** O texto que a pessoa digita para confirmar a exclusão da conta. */
export const CONFIRMACAO_EXCLUSAO = "EXCLUIR";

export type IdProvedorTerceiro = "openai";

export interface ProvedorTerceiro {
  id: IdProvedorTerceiro;
  nome: string;
  /** O que vai para esse provedor, em frases curtas para a tela ("O texto do que você quer aprender"). */
  usos: string[];
  /** Política de privacidade do provedor. */
  politica: string;
}

export interface EstadoPrivacidade {
  consentimentoIa: {
    /** false quando o servidor usa a IA simulada (nada sai do servidor) e nenhum aceite é pedido. */
    necessario: boolean;
    /** A versão vigente: é a que o POST precisa mandar. */
    versao: string;
    /** Quando a pessoa aceitou a versão vigente; null sem aceite ou com aceite de versão antiga. */
    aceitoEm: string | null;
    provedores: ProvedorTerceiro[];
  };
  /** Caminho da política pública (relativo à origem do Studoo). */
  politica: string;
}

/** Corpo de POST /api/privacidade/consentimento-ia. */
export interface PedidoConsentimentoIa {
  versao: string;
}

/** Corpo de DELETE /api/conta. */
export interface PedidoExclusaoConta {
  confirmacao: typeof CONFIRMACAO_EXCLUSAO;
}

/** O aceite vale para a pessoa agora? (Sem necessidade, vale sempre.) */
export function consentimentoVigente(estado: EstadoPrivacidade): boolean {
  return !estado.consentimentoIa.necessario || estado.consentimentoIa.aceitoEm !== null;
}

/** Confere o texto digitado na confirmação da exclusão (sem diferenciar maiúsculas e espaços nas pontas). */
export function confirmacaoExclusaoValida(texto: string): boolean {
  return texto.trim().toUpperCase() === CONFIRMACAO_EXCLUSAO;
}

const POLITICA_OPENAI = "https://openai.com/policies/privacy-policy/";

const USOS_TEXTO = [
  "Seu pedido de estudo, para verificar a segurança e montar a trilha",
  "O texto e as imagens dos materiais que você envia, para leitura, verificação de segurança e criação da trilha",
  "Suas respostas abertas e explicações, para a correção e o retorno do Stu",
];
const USOS_VOZ = [
  "A gravação da sua explicação, para virar texto",
  "O áudio da conversa de voz ao vivo com o Stu",
];

/** A OpenAI recebe os dados autorizados para os recursos ativos. */
export function provedoresDaIa(ia: "falsa" | "openai", voz: boolean): ProvedorTerceiro[] {
  if (ia === "falsa") return [];
  return [{ id: "openai", nome: "OpenAI", usos: voz ? [...USOS_TEXTO, ...USOS_VOZ] : [...USOS_TEXTO], politica: POLITICA_OPENAI }];
}

/** Valida a resposta de GET /api/privacidade (e do POST/DELETE do aceite). Devolve null fora do contrato. */
export function interpretarEstadoPrivacidade(dado: unknown): EstadoPrivacidade | null {
  if (typeof dado !== "object" || dado === null) return null;
  const { consentimentoIa: c, politica } = dado as Record<string, unknown>;
  if (typeof politica !== "string" || typeof c !== "object" || c === null) return null;
  const { necessario, versao, aceitoEm, provedores } = c as Record<string, unknown>;
  if (typeof necessario !== "boolean" || typeof versao !== "string" || !Array.isArray(provedores)) return null;
  if (aceitoEm !== null && typeof aceitoEm !== "string") return null;
  const lista = provedores.filter((p): p is ProvedorTerceiro =>
    typeof p === "object" && p !== null && p.id === "openai" && typeof p.nome === "string" &&
    Array.isArray(p.usos) && p.usos.every((u: unknown) => typeof u === "string") && typeof p.politica === "string");
  return { consentimentoIa: { necessario, versao, aceitoEm, provedores: lista }, politica };
}

/**
 * O estado de privacidade que veio junto de um erro `consentimento_ia` (o 428 traz `privacidade` no corpo, e o evento
 * `erro` do NDJSON também), para abrir a tela de aceite sem outra ida ao servidor. Fora disso, null.
 */
export function privacidadeDoErro(erro: unknown): EstadoPrivacidade | null {
  if (typeof erro !== "object" || erro === null) return null;
  const { codigo, corpo, privacidade } = erro as { codigo?: unknown; corpo?: unknown; privacidade?: unknown };
  if (codigo !== "consentimento_ia") return null;
  const bruto = privacidade ?? (typeof corpo === "object" && corpo !== null ? (corpo as { privacidade?: unknown }).privacidade : undefined);
  return interpretarEstadoPrivacidade(bruto);
}
