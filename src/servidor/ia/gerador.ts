import type { EventoGeracao, PerfilDiagnostico } from "@studoo/contratos";
import type { AmostraDemonstrada, ConteudoLicao, EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { criarGeradorFalso } from "./falsa";
import { GERADOR_DEEPSEEK, configuracaoDeepSeek, criarGeradorDeepSeek } from "./deepseek";
import { GERADOR_OPENAI, configuracaoOpenAi, criarGeradorOpenAi } from "./openai";
import { comProgressaoDiagnostica } from "./progressao";

export { REGRAS_ORDEM_DA_TRILHA, instrucoesDeOrdem } from "./ordem";

/** Eventos de estrutura: o que a pessoa vê se formar. O `pronto` e o `erro` são do serviço. */
export type EventoEstrutura = Extract<EventoGeracao, { tipo: "plano" | "fluxo" | "licao" }>;

/** Devolvido ao fim da estrutura: quem gerou (para o aceite) e a origem exibida na proposta. */
export type MetaPlano = { gerador: string; origem: string; curriculoAdaptado?: true };

/**
 * Fronteira da IA (SEGURANCA.md §5). O pedido leva só o objetivo: nenhum dado da conta.
 * O teto de gerações é verificado pelo servidor antes de chamar qualquer implementação.
 */
export interface GeradorTrilha {
  /**
   * Emite `plano`, depois cada `fluxo` e as suas `licao`, na ordem, com índices a partir de 0.
   * A ordem é a ordem de aprendizado, não de assunto: `fluxo` é um trecho da trilha (ver `REGRAS_ORDEM_DA_TRILHA`).
   * Ao terminar, devolve a `MetaPlano`.
   * `aoVivo: false` pede a estrutura sem pausas artificiais (rota que devolve a proposta de uma vez).
   * Se o sinal abortar, encerra sem emitir mais nada e sem `MetaPlano`. Um problema do provedor sobe como exceção.
   */
  gerarEstrutura(
    objetivo: string,
    sinal: AbortSignal,
    opcoes: { aoVivo: boolean; diagnostico?: PerfilDiagnostico; amostrasDemonstradas?: AmostraDemonstrada[] },
  ): AsyncGenerator<EventoEstrutura, MetaPlano | undefined>;
  /** Cria o conteúdo de uma lição do esqueleto aceito. Recusa (`proposta_invalida`) um esqueleto de outro gerador. */
  gerarConteudo(esqueleto: EsqueletoPlano, fluxo: number, licao: number, sinal: AbortSignal): Promise<ConteudoLicao>;
  revisarConteudos?(esqueleto: EsqueletoPlano, conteudos: ConteudoLicao[][], sinal: AbortSignal): Promise<ConteudoLicao[][]>;
}

export type ProvedorIa = "falsa" | "openai" | "deepseek";

/** Provedor ativo conforme a flag `IA`. */
export function provedorIaAtivo(): ProvedorIa {
  if (process.env.IA === "openai") return "openai";
  if (process.env.IA === "deepseek") return "deepseek";
  return "falsa";
}

/**
 * Escolhe o gerador pela variável IA: `falsa` (padrão local, testes e CI), `openai` (Responses API da OpenAI, com
 * OPENAI_API_KEY) ou `deepseek` (Chat Completions da DeepSeek, com DEEPSEEK_API_KEY). Com provedor real, a IA falsa
 * fica de reserva (STUDOO_IA_RESERVA, padrão `falsa`; `nenhuma` desliga): sem chave, ou se o provedor falhar antes do
 * primeiro evento, a trilha simulada entra no lugar e a origem da proposta mostra isso.
 */
export function obterGerador(): GeradorTrilha {
  if (process.env.IA === "falsa") {
    return criarGeradorFalso();
  }
  if (process.env.IA === "openai") {
    const reserva = (process.env.STUDOO_IA_RESERVA ?? "falsa").trim() === "nenhuma" ? null : criarGeradorFalso();
    const config = configuracaoOpenAi();
    if (!config) {
      if (!reserva) throw new FalhaApi("ia_indisponivel");
      console.error(JSON.stringify({ rota: "ia-openai", codigo: "reserva", motivo: "sem_configuracao" }));
      return comReserva(null, reserva, GERADOR_OPENAI, "ia-openai");
    }
    return comReserva(comProgressaoDiagnostica(criarGeradorOpenAi(config)), reserva, GERADOR_OPENAI, "ia-openai");
  }
  if (process.env.IA === "deepseek") {
    const reserva = (process.env.STUDOO_IA_RESERVA ?? "falsa").trim() === "nenhuma" ? null : criarGeradorFalso();
    const config = configuracaoDeepSeek();
    if (!config) {
      if (!reserva) throw new FalhaApi("ia_indisponivel");
      console.error(JSON.stringify({ rota: "ia-deepseek", codigo: "reserva", motivo: "sem_configuracao" }));
      return comReserva(null, reserva, GERADOR_DEEPSEEK, "ia-deepseek");
    }
    return comReserva(comProgressaoDiagnostica(criarGeradorDeepSeek(config)), reserva, GERADOR_DEEPSEEK, "ia-deepseek");
  }
  throw new FalhaApi("ia_indisponivel");
}

/**
 * Gerador principal com a IA falsa de reserva. A troca só acontece antes do primeiro evento: depois disso, a pessoa já
 * viu a trilha começar, e o erro segue para a tela. Com evidência demonstrada, o erro segue para a tela desde o início.
 * O conteúdo das lições segue quem gerou a estrutura (o `gerador` do
 * esqueleto), então uma proposta da IA falsa continua aceita mesmo com `IA=openai` ou `IA=deepseek`.
 */
function comReserva(
  principal: GeradorTrilha | null,
  reserva: GeradorTrilha | null,
  geradorPrincipal: string,
  rota: string,
): GeradorTrilha {
  const falsa = reserva ?? criarGeradorFalso();
  return {
    async *gerarEstrutura(objetivo, sinal, opcoes) {
      const podeUsarReserva = reserva && !opcoes.diagnostico?.demonstrados.length;
      if (!principal) {
        if (!podeUsarReserva) throw new FalhaApi("ia_indisponivel");
        return yield* reserva.gerarEstrutura(objetivo, sinal, opcoes);
      }
      const estrutura = principal.gerarEstrutura(objetivo, sinal, opcoes);
      let emitiu = false;
      try {
        while (true) {
          const passo = await estrutura.next();
          if (passo.done) return passo.value;
          emitiu = true;
          yield passo.value;
        }
      } catch (erro) {
        if (emitiu || !podeUsarReserva || sinal.aborted) throw erro;
        console.error(JSON.stringify({ rota, codigo: "reserva", motivo: "falha_do_provedor" }));
        return yield* reserva.gerarEstrutura(objetivo, sinal, opcoes);
      } finally {
        await estrutura.return(undefined);
      }
    },
    gerarConteudo(esqueleto, fluxo, licao, sinal) {
      if (esqueleto.gerador === geradorPrincipal) {
        if (!principal) throw new FalhaApi("ia_indisponivel");
        return principal.gerarConteudo(esqueleto, fluxo, licao, sinal);
      }
      return falsa.gerarConteudo(esqueleto, fluxo, licao, sinal);
    },
    async revisarConteudos(esqueleto, conteudos, sinal) {
      if (esqueleto.gerador !== geradorPrincipal || !principal?.revisarConteudos) return conteudos;
      return principal.revisarConteudos(esqueleto, conteudos, sinal);
    },
  };
}
