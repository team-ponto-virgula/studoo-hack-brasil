import { randomUUID } from "node:crypto";
import { LIMITES_GERACAO, type EventoGeracao } from "@studoo/contratos";
import { esqueletoValido, type EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { obterGerador, type GeradorTrilha, type MetaPlano } from "@/servidor/ia/gerador";
import { registrarGeracao } from "@/servidor/ia/limite";
import { emitirComprovante } from "./comprovantes";

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
  opcoes?: { verificarLimite?: boolean },
): Geracao {
  const texto = objetivo.trim();
  if (texto.length < LIMITES_GERACAO.objetivoMin || texto.length > LIMITES_GERACAO.objetivoMax) {
    throw new FalhaApi("invalido");
  }
  const gerador = obterGerador();
  if (opcoes?.verificarLimite !== false && !registrarGeracao(usuarioId)) {
    throw new FalhaApi("limite_geracoes");
  }

  return { eventos: (sinal, opcoes) => emitirEventos(gerador, usuarioId, texto, sinal, opcoes?.aoVivo ?? true) };
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
): AsyncGenerator<EventoGeracao> {
  const estrutura = gerador.gerarEstrutura(objetivo, sinal, { aoVivo });
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
        const limpo = passo.value.titulo
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const tituloLimpo = limpo || "Nova trilha";
        plano = { titulo: tituloLimpo, objetivo: passo.value.objetivo };
        yield { ...passo.value, titulo: tituloLimpo };
        continue;
      }
      yield passo.value;
    }
    if (sinal.aborted) return;

    const completo = { ...meta, ...plano, fluxos: acumulado.fluxos };
    if (!esqueletoValido(completo)) {
      throw new FalhaApi("falha");
    }
    // O comprovante da proposta leva a trilha inteira e tem tamanho máximo: os resumos (só para a prévia) saem se a
    // trilha ficar grande demais com eles.
    const esqueleto = Buffer.byteLength(JSON.stringify(completo)) > 3600
      ? { ...completo, fluxos: completo.fluxos.map((fluxo) => ({ ...fluxo, licoes: fluxo.licoes.map(({ titulo }) => ({ titulo })) })) }
      : completo;
    const token = emitirComprovante("proposta", usuarioId, {
      id: randomUUID(),
      expiraEm: Date.now() + DURACAO_PROPOSTA,
      plano: esqueleto,
    });
    yield {
      tipo: "pronto",
      proposta: {
        token,
        titulo: esqueleto.titulo,
        objetivo: esqueleto.objetivo,
        origem: esqueleto.origem,
        fluxos: esqueleto.fluxos,
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
