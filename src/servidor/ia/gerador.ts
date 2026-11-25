import type { EventoGeracao, PerfilDiagnostico } from "@studoo/contratos";
import type { AmostraDemonstrada, ConteudoLicao, EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { criarGeradorFalso } from "./falsa";
import { configuracaoOpenAi, criarGeradorOpenAi } from "./openai";
import { comProgressaoDiagnostica } from "./progressao";
import { provedorIaAtivo } from "./provedor";

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
  /** Cria uma lição. Com prazo compartilhado, conserva a chamada em andamento até o limite do aceite. */
  gerarConteudo(
    esqueleto: EsqueletoPlano, fluxo: number, licao: number, sinal: AbortSignal,
    opcoes?: { prazoCompartilhado?: boolean },
  ): Promise<ConteudoLicao>;
  revisarConteudos?(esqueleto: EsqueletoPlano, conteudos: ConteudoLicao[][], sinal: AbortSignal): Promise<ConteudoLicao[][]>;
}

export { provedorIaAtivo };

export function obterGerador(): GeradorTrilha {
  if (provedorIaAtivo() === "falsa") return criarGeradorFalso();

  const config = configuracaoOpenAi();
  if (!config) throw new FalhaApi("ia_indisponivel");
  return comProgressaoDiagnostica(criarGeradorOpenAi(config));
}
