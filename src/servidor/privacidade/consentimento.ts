import {
  CAMINHO_POLITICA,
  VERSAO_CONSENTIMENTO_IA,
  provedoresDaIa,
  type EstadoPrivacidade,
} from "@studoo/contratos/privacidade";
import { FalhaApi } from "@/servidor/acesso/http";
import { banco } from "@/servidor/banco/cliente";
import { transcricaoDisponivel } from "@/servidor/estudio/voz";
import { provedorIaAtivo } from "@/servidor/ia/gerador";
import { vozAoVivoAtiva } from "@/servidor/ia/realtime";

/**
 * Consentimento do envio a IA de terceiros (App Review 5.1.2(i)). Com a IA simulada nada sai do servidor e o aceite
 * não é pedido; com DeepSeek ou OpenAI, a conta (também a de visitante) precisa ter aceitado a versão vigente.
 */
export function consentimentoNecessario(): boolean {
  return provedorIaAtivo() !== "falsa";
}

function montarEstado(aceito: { em: Date | null; versao: string | null }): EstadoPrivacidade {
  const necessario = consentimentoNecessario();
  const vigente = aceito.em !== null && aceito.versao === VERSAO_CONSENTIMENTO_IA;
  return {
    consentimentoIa: {
      necessario,
      versao: VERSAO_CONSENTIMENTO_IA,
      aceitoEm: vigente ? aceito.em!.toISOString() : null,
      provedores: provedoresDaIa(provedorIaAtivo(), transcricaoDisponivel() || vozAoVivoAtiva()),
    },
    politica: CAMINHO_POLITICA,
  };
}

async function lerAceite(usuarioId: string) {
  const usuario = await banco.usuario.findUnique({
    where: { id: usuarioId },
    select: { consentimentoIaEm: true, consentimentoIaVersao: true },
  });
  if (!usuario) throw new FalhaApi("nao_autenticado");
  return { em: usuario.consentimentoIaEm, versao: usuario.consentimentoIaVersao };
}

export async function estadoPrivacidade(usuarioId: string): Promise<EstadoPrivacidade> {
  return montarEstado(await lerAceite(usuarioId));
}

/** Grava o aceite. Só vale a versão vigente: um cliente com texto antigo recebe `invalido` e busca o estado de novo. */
export async function aceitarConsentimentoIa(usuarioId: string, versao: unknown): Promise<EstadoPrivacidade> {
  if (versao !== VERSAO_CONSENTIMENTO_IA) throw new FalhaApi("invalido");
  const em = new Date();
  await banco.usuario.update({
    where: { id: usuarioId },
    data: { consentimentoIaEm: em, consentimentoIaVersao: VERSAO_CONSENTIMENTO_IA },
  });
  return montarEstado({ em, versao: VERSAO_CONSENTIMENTO_IA });
}

export async function revogarConsentimentoIa(usuarioId: string): Promise<EstadoPrivacidade> {
  await banco.usuario.update({
    where: { id: usuarioId },
    data: { consentimentoIaEm: null, consentimentoIaVersao: null },
  });
  return montarEstado({ em: null, versao: null });
}

/** A conta pode mandar dados à IA de terceiro agora? (Sem necessidade, sempre pode.) */
export async function podeUsarIa(usuarioId: string): Promise<boolean> {
  if (!consentimentoNecessario()) return true;
  const aceite = await lerAceite(usuarioId);
  return aceite.em !== null && aceite.versao === VERSAO_CONSENTIMENTO_IA;
}

/**
 * Barreira das rotas sem alternativa local: sem aceite vigente, responde `consentimento_ia` (428) com o estado no
 * corpo (`privacidade`), antes de ler arquivo, gastar cota ou chamar qualquer provedor.
 */
export async function exigirConsentimentoIa(usuarioId: string): Promise<void> {
  if (!consentimentoNecessario()) return;
  const aceite = await lerAceite(usuarioId);
  if (aceite.em !== null && aceite.versao === VERSAO_CONSENTIMENTO_IA) return;
  throw new FalhaApi("consentimento_ia", { privacidade: montarEstado(aceite) });
}
