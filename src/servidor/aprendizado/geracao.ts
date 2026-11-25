import { origemDoConteudo } from "@/dominio/aprendizado/plano";
import { randomUUID } from "node:crypto";
import { LIMITES_GERACAO, type EventoGeracao, type PerfilDiagnostico } from "@studoo/contratos";
import { esqueletoValido, type AmostraDemonstrada, type EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { obterGerador, type GeradorTrilha, type MetaPlano } from "@/servidor/ia/gerador";
import { registrarGeracao } from "@/servidor/ia/limite";
import { emitirComprovante, TAMANHO_MAXIMO_COMPROVANTE } from "./comprovantes";

const DURACAO_PROPOSTA = 30 * 60 * 1000;

export interface Geracao {
  /** Eventos da geração, em ordem. Termina em `pronto` ou `erro`, ou sem eles se o sinal abortar. */
  eventos(sinal: AbortSignal, opcoes?: { aoVivo?: boolean }): AsyncGenerator<EventoGeracao>;
}

/**
 * Tudo o que pode falhar antes de a resposta começar: objetivo, IA disponível e teto de gerações.
 * Lança FalhaApi (JSON de erro). Depois daqui, os problemas viram o evento `erro`.
 */
export function iniciarGeracao(
  usuarioId: string,
  objetivo: string,
  opcoes?: { verificarLimite?: boolean; diagnostico?: PerfilDiagnostico; amostrasDemonstradas?: AmostraDemonstrada[] },
): Geracao {
  const texto = objetivo.trim();
  if (texto.length < LIMITES_GERACAO.objetivoMin || texto.length > LIMITES_GERACAO.objetivoMax) {
    throw new FalhaApi("invalido");
  }
  const gerador = obterGerador();
  if (opcoes?.verificarLimite !== false && !registrarGeracao(usuarioId)) {
    throw new FalhaApi("limite_geracoes");
  }

  const { diagnostico, amostrasDemonstradas } = opcoes ?? {};
  return { eventos: (sinal, opcoes) => emitirEventos(gerador, usuarioId, texto, sinal, opcoes?.aoVivo ?? true, diagnostico, amostrasDemonstradas) };
}

/** Confere que cada evento segue o anterior: plano, fluxo 0, suas lições, fluxo 1, e assim por diante. */
function seguirEstrutura(esqueleto: { fluxos: EsqueletoPlano["fluxos"]; tem: boolean }, evento: EventoGeracao) {
  const { fluxos } = esqueleto;
  if (evento.tipo === "plano" && !esqueleto.tem && fluxos.length === 0) {
    esqueleto.tem = true;
    return;
  }
  if (evento.tipo === "fluxo" && esqueleto.tem && evento.fluxo === fluxos.length &&
      (fluxos.length === 0 || fluxos[fluxos.length - 1].licoes.length > 0)) {
    fluxos.push({ titulo: evento.titulo, licoes: [] });
    return;
  }
  if (evento.tipo === "licao" && fluxos.length > 0 && evento.fluxo === fluxos.length - 1 &&
      evento.licao === fluxos[evento.fluxo].licoes.length) {
    fluxos[evento.fluxo].licoes.push({ titulo: evento.titulo, ...(evento.resumo ? { resumo: evento.resumo } : {}) });
    return;
  }
  throw new FalhaApi("falha");
}

async function* emitirEventos(
  gerador: GeradorTrilha,
  usuarioId: string,
  objetivo: string,
  sinal: AbortSignal,
  aoVivo: boolean,
  diagnostico?: PerfilDiagnostico,
  amostrasDemonstradas?: AmostraDemonstrada[],
): AsyncGenerator<EventoGeracao> {
  const estrutura = gerador.gerarEstrutura(objetivo, sinal, { aoVivo, diagnostico, amostrasDemonstradas });
  try {
    let plano: { titulo: string; objetivo: string } | undefined;
    const acumulado = { fluxos: [] as EsqueletoPlano["fluxos"], tem: false };
    let meta: MetaPlano | undefined;

    while (true) {
      const passo = await estrutura.next();
      if (passo.done) {
        meta = passo.value;
        break;
      }
      seguirEstrutura(acumulado, passo.value);
      if (passo.value.tipo === "plano") {
        plano = { titulo: passo.value.titulo, objetivo: diagnostico ? objetivo : passo.value.objetivo };
      }
      yield passo.value.tipo === "plano" && diagnostico ? { ...passo.value, objetivo } : passo.value;
    }
    if (sinal.aborted) return;

    if (!meta) throw new FalhaApi("falha");
    const completo = { ...meta, origem: origemDoConteudo(meta.origem), ...plano, ...(diagnostico && { diagnostico }),
      ...(meta.curriculoAdaptado && amostrasDemonstradas?.length && { amostrasDemonstradas }), fluxos: acumulado.fluxos };
    if (!esqueletoValido(completo)) {
      throw new FalhaApi("falha");
    }
    // Os resumos comuns podem sair se a trilha ficar grande demais. No currículo adaptado eles guiam a criação de cada lição.
    const esqueleto = !completo.curriculoAdaptado && Buffer.byteLength(JSON.stringify(completo)) > 3600
      ? { ...completo, fluxos: completo.fluxos.map((fluxo) => ({ ...fluxo, licoes: fluxo.licoes.map(({ titulo }) => ({ titulo })) })) }
      : completo;
    const token = emitirComprovante("proposta", usuarioId, {
      id: randomUUID(),
      expiraEm: Date.now() + DURACAO_PROPOSTA,
      plano: esqueleto,
    });
    if (token.length > TAMANHO_MAXIMO_COMPROVANTE) throw new FalhaApi("ia_indisponivel");
    yield {
      tipo: "pronto",
      proposta: {
        token,
        titulo: esqueleto.titulo,
        objetivo: esqueleto.objetivo,
        origem: esqueleto.origem,
        fluxos: esqueleto.fluxos,
        ...(diagnostico && { diagnostico }),
      },
    };
  } catch (erro) {
    if (sinal.aborted) return;
    const codigo = erro instanceof FalhaApi ? erro.codigo : "falha";
    // Sem objetivo, e-mail ou conteúdo no log (SEGURANCA.md §8).
    console.error(JSON.stringify({ correlationId: randomUUID(), codigo, rota: "geracao-ao-vivo" }));
    yield { tipo: "erro", codigo };
  } finally {
    await estrutura.return(undefined);
  }
}
