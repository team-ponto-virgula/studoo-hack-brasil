import type { EventoGeracao } from "@studoo/contratos";
import type { ConteudoLicao, EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { criarGeradorFalso } from "./falsa";

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

/** Escolhe o gerador pela variável IA. Só a IA falsa existe por enquanto (D5 em aberto). */
export function obterGerador(): GeradorTrilha {
  if (process.env.IA === "falsa") {
    return criarGeradorFalso();
  }
  throw new FalhaApi("ia_indisponivel");
}
