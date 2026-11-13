import type { EventoGeracao } from "@studoo/contratos";
import type { ConteudoLicao, EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { criarGeradorFalso } from "./falsa";
import { GERADOR_OPENAI, configuracaoOpenAi, criarGeradorOpenAi } from "./openai";

export { REGRAS_ORDEM_DA_TRILHA, instrucoesDeOrdem } from "./ordem";

/** Eventos de estrutura: o que a pessoa vê se formar. O `pronto` e o `erro` são do serviço. */
export type EventoEstrutura = Extract<EventoGeracao, { tipo: "plano" | "fluxo" | "licao" }>;

/** Devolvido ao fim da estrutura: quem gerou (para o aceite) e a origem exibida na proposta. */
export type MetaPlano = { gerador: string; origem: string };

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
    opcoes: { aoVivo: boolean },
  ): AsyncGenerator<EventoEstrutura, MetaPlano | undefined>;
  /** Cria o conteúdo de uma lição do esqueleto aceito. Recusa (`proposta_invalida`) um esqueleto de outro gerador. */
  gerarConteudo(esqueleto: EsqueletoPlano, fluxo: number, licao: number, sinal: AbortSignal): Promise<ConteudoLicao>;
}

/**
 * Escolhe o gerador pela variável IA: `falsa` (padrão local, testes e CI) ou `openai` (Responses API da OpenAI, com
 * OPENAI_API_KEY; veja src/servidor/ia/openai.ts). Com `openai`, a IA falsa fica de reserva (STUDOO_IA_RESERVA, padrão
 * `falsa`; `nenhuma` desliga): sem chave, ou se a OpenAI falhar antes do primeiro evento, a trilha simulada entra no lugar
 * e a origem da proposta mostra isso.
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
      return reserva;
    }
    return comReserva(criarGeradorOpenAi(config), reserva);
  }
  throw new FalhaApi("ia_indisponivel");
}

/**
 * Gerador principal com a IA falsa de reserva. A troca só acontece antes do primeiro evento: depois disso, a pessoa já
 * viu a trilha começar, e o erro segue para a tela. O conteúdo das lições segue quem gerou a estrutura (o `gerador` do
 * esqueleto), então uma proposta da IA falsa continua aceita mesmo com `IA=openai`.
 */
function comReserva(principal: GeradorTrilha, reserva: GeradorTrilha | null): GeradorTrilha {
  const falsa = reserva ?? criarGeradorFalso();
  return {
    async *gerarEstrutura(objetivo, sinal, opcoes) {
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
        if (emitiu || !reserva || sinal.aborted) throw erro;
        console.error(JSON.stringify({ rota: "ia-openai", codigo: "reserva", motivo: "falha_do_provedor" }));
        return yield* reserva.gerarEstrutura(objetivo, sinal, opcoes);
      } finally {
        await estrutura.return(undefined);
      }
    },
    gerarConteudo(esqueleto, fluxo, licao, sinal) {
      if (esqueleto.gerador === GERADOR_OPENAI) return principal.gerarConteudo(esqueleto, fluxo, licao, sinal);
      return falsa.gerarConteudo(esqueleto, fluxo, licao, sinal);
    },
  };
}
