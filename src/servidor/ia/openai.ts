import type { PerfilDiagnostico } from '@studoo/contratos';
import type { GeradorTrilha, MetaPlano } from "./gerador";
import type { ConteudoLicao, EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { ORIGEM_GERADA, origemDoConteudo } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { comNovasTentativas } from "./novas-tentativas";
import {
  TEMPO_CONTEUDO_DE_MATEMATICA_MS,
  TEMPO_CONTEUDO_MS,
  TEMPO_ESTRUTURA_MS,
  analisarJson,
  contextoDiagnostico,
  criarMontador,
  esquemaDaLicao,
  esquemaDaLicaoDeMatematica,
  instrucoesDaEstruturaAdaptada,
  instrucoesDaLicao,
  instrucoesDaLicaoDeMatematica,
  lerLinha,
  maximoDeLicoesDiagnostico,
  correcaoDoFormato,
  normalizarConteudo,
  normalizarLicaoSegura,
  promptDaLicao,
  sinalComPrazo,
  validarBaseUrl,
} from "./comum";
import { contagensDoRelato, correcaoDaResolucao, licaoEhDeMatematica, motivoDaFiguraQueEntrega, motivoDaResolucao, valorDaMatematica } from "./matematica";

export { normalizarConteudo };

/*
 * IA real do Studoo com a Responses API da OpenAI (POST /v1/responses), chamada por fetch, sem SDK.
 * - A estrutura chega por streaming da OpenAI. O serviço confere a segurança antes de publicar os eventos da proposta.
 * - O conteúdo de cada lição vem com Structured Outputs (JSON Schema estrito) e passa pela mesma validação da IA falsa.
 * A geração recebe o objetivo, a estrutura e, quando houver, o diagnóstico. Não recebe dados da conta (SEGURANCA.md §5). Os logs não levam o
 * objetivo nem o conteúdo (§8). A chave fica só no servidor.
 */

export const GERADOR_OPENAI = "openai-v1";
const BASE_PADRAO = "https://api.openai.com/v1";
export const MODELO_PADRAO = "gpt-6-luna";
export const ESFORCO_OPENAI = "max";
// A Responses API conta raciocínio e texto visível no mesmo teto.
const TOKENS_DA_LICAO = 25_000;
const TOKENS_DA_LICAO_DE_MATEMATICA = 32_000;
const INSTRUCAO_LICAO_CURTA = [
  "Escreva uma versão compacta desta mesma lição, diretamente no JSON do esquema.",
  "Inclua dois exercícios curtos, explique o gabarito e mantenha o critério da atividade.",
  "Use null nos recursos dispensáveis. Preserve as fórmulas e a resolução curta quando forem necessárias para aprender.",
].join(" ");

export type ConfiguracaoOpenAi = { chave: string; base: string };

/** Só aceita HTTPS (ou HTTP no próprio computador, para testes). */
export function configuracaoOpenAi(): ConfiguracaoOpenAi | null {
  const chave = process.env.OPENAI_API_KEY?.trim();
  const base = validarBaseUrl(process.env.OPENAI_BASE_URL, BASE_PADRAO);
  return chave && base ? { chave, base } : null;
}

function registrar(codigo: string, detalhe: Record<string, unknown>) {
  // Sem objetivo, conteúdo ou chave no log (SEGURANCA.md §8).
  console.error(JSON.stringify({ rota: "ia-openai", codigo, ...detalhe }));
}

export async function pedirRespostaOpenAi(config: ConfiguracaoOpenAi, corpo: Record<string, unknown>, sinal: AbortSignal, repetir429 = true): Promise<Response> {
  const enviar = () => fetch(`${config.base}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...corpo, model: MODELO_PADRAO, reasoning: { effort: ESFORCO_OPENAI }, store: false }),
    redirect: "error",
    signal: sinal,
  });
  const resposta = await (repetir429 ? comNovasTentativas(enviar, { rota: "ia-openai", sinal }) : enviar());
  if (!resposta.ok) {
    registrar("ia_indisponivel", { status: resposta.status });
    throw new FalhaApi("ia_indisponivel");
  }
  return resposta;
}

/** Texto das partes `output_text` de uma resposta sem streaming. Uma recusa do modelo vira erro. */
function textoDaResposta(corpo: unknown): string {
  if (typeof corpo !== "object" || corpo === null) return "";
  const dado = corpo as {
    status?: unknown;
    incomplete_details?: { reason?: unknown } | null;
    output_text?: unknown;
    output?: unknown;
  };
  if (dado.status === "incomplete") {
    const motivo = dado.incomplete_details?.reason === "max_output_tokens" ? "limite_tokens" : "resposta_incompleta";
    throw new FalhaApi("ia_indisponivel", undefined, motivo);
  }
  if (dado.status !== undefined && dado.status !== "completed") throw new FalhaApi("ia_indisponivel");
  if (!Array.isArray(dado.output)) return typeof dado.output_text === "string" ? dado.output_text : "";
  let texto = "";
  for (const item of dado.output) {
    const conteudo = (item as { content?: unknown }).content;
    if (!Array.isArray(conteudo)) continue;
    for (const parte of conteudo) {
      const { type, text } = parte as { type?: unknown; text?: unknown };
      if (type === "refusal") throw new FalhaApi("ia_indisponivel");
      if (type === "output_text" && typeof text === "string") texto += text;
    }
  }
  return texto || (typeof dado.output_text === "string" ? dado.output_text : "");
}

export type OpcoesDoPedidoJson = {
  prazoMs?: number;
  tentativas?: number;
  matematica?: boolean;
  sinal?: AbortSignal;
  maxTokens?: number;
};

/** Pedido estruturado com os dados e anexos sempre na mensagem da pessoa. */
export async function pedirJsonOpenAi(
  config: ConfiguracaoOpenAi,
  nome: string,
  esquema: unknown,
  instrucoes: string,
  dados: unknown,
  anexos: unknown[] = [],
  opcoes: OpcoesDoPedidoJson = {},
): Promise<unknown> {
  const prazo = AbortSignal.timeout(opcoes.prazoMs ?? 60_000);
  const sinal = opcoes.sinal ? AbortSignal.any([opcoes.sinal, prazo]) : prazo;
  const resposta = await pedirRespostaOpenAi(config, {
    instructions: instrucoes,
    input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(dados) }, ...anexos] }],
    text: { format: { type: "json_schema", name: nome, schema: esquema, strict: true } },
    max_output_tokens: opcoes.maxTokens ?? 10_000,
  }, sinal, opcoes.tentativas !== 1);
  return analisarJson(textoDaResposta(await resposta.json()), opcoes.matematica);
}

/** A correção em aula mantém a alternativa local caso a IA demore ou falhe. */
export async function pedirCorrecao(
  config: ConfiguracaoOpenAi,
  nome: string,
  esquema: Record<string, unknown>,
  instrucoes: string,
  dados: unknown,
  ms = 15_000,
): Promise<unknown> {
  const resposta = await pedirRespostaOpenAi(config, {
    input: [{ role: "system", content: instrucoes }, { role: "user", content: JSON.stringify(dados) }],
    text: { format: { type: "json_schema", name: nome, schema: esquema, strict: true } },
    max_output_tokens: 4096,
  }, AbortSignal.timeout(ms));
  return analisarJson(textoDaResposta(await resposta.json()));
}

/** Lê o streaming (SSE) e entrega os pedaços de texto à medida que chegam. */
async function* textoDoStreaming(resposta: Response, sinal: AbortSignal): AsyncGenerator<string> {
  if (!resposta.body) throw new FalhaApi("ia_indisponivel");
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let resto = "";
  let completou = false;
  try {
    while (!sinal.aborted) {
      const { done, value } = await leitor.read();
      if (done) break;
      resto += decodificador.decode(value, { stream: true });
      const linhas = resto.split("\n");
      resto = linhas.pop() ?? "";
      for (const linha of linhas) {
        if (!linha.startsWith("data:")) continue;
        const dado = linha.slice(5).trim();
        if (!dado || dado === "[DONE]") continue;
        let evento: { type?: unknown; delta?: unknown };
        try {
          evento = JSON.parse(dado);
        } catch {
          continue;
        }
        if (evento.type === "response.completed") completou = true;
        if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") yield evento.delta;
        else if (evento.type === "error" || evento.type === "response.failed" || evento.type === "response.incomplete" || evento.type === "response.refusal.delta") {
          registrar("ia_indisponivel", { evento: String(evento.type) });
          throw new FalhaApi("ia_indisponivel");
        }
      }
    }
    if (!sinal.aborted && !completou) throw new FalhaApi("ia_indisponivel", undefined, "stream_incompleto");
  } finally {
    leitor.cancel().catch(() => undefined);
  }
}

/** Pedido da estrutura: só o objetivo vai para a IA. */
function corpoDaEstrutura(objetivo: string, diagnostico?: PerfilDiagnostico) {
  return {
    input: [
      { role: "system", content: instrucoesDaEstruturaAdaptada(diagnostico) },
      { role: "user", content: `Objetivo de estudo: ${objetivo}` },
    ],
    stream: true,
    max_output_tokens: 8192,
  };
}

/** O pedido da lição. Só a lição de matemática leva o bloco de fórmulas e figuras, o esquema com `visuais` e `resolucao` e mais espaço para a resposta. */
export function corpoDaLicao(esqueleto: EsqueletoPlano, fluxo: number, licao: number, correcao = "", matematica = false) {
  return {
    input: [
      { role: "system", content: matematica ? instrucoesDaLicaoDeMatematica : instrucoesDaLicao },
      { role: "user", content: promptDaLicao(esqueleto, fluxo, licao) },
      ...(correcao ? [{ role: "user", content: correcao }] : []),
    ],
    text: {
      format: {
        type: "json_schema",
        name: matematica ? "licao_studoo_matematica" : "licao_studoo",
        schema: matematica ? esquemaDaLicaoDeMatematica : esquemaDaLicao,
        strict: true,
      },
    },
    max_output_tokens: matematica ? TOKENS_DA_LICAO_DE_MATEMATICA : TOKENS_DA_LICAO,
  };
}

/**
 * A estrutura chega por streaming. No aceite, cada lição usa Structured Outputs com uma única tentativa de recuperação.
 */
export function criarGeradorOpenAi(config: ConfiguracaoOpenAi): GeradorTrilha {
  const origem = ORIGEM_GERADA;

  return {
    async *gerarEstrutura(pedido, sinal, { diagnostico }) {
      const objetivo = pedido + contextoDiagnostico(diagnostico);
      const { sinal: comPrazo, estourou } = sinalComPrazo(sinal, TEMPO_ESTRUTURA_MS);
      const montador = criarMontador(pedido, maximoDeLicoesDiagnostico(diagnostico));
      try {
        const resposta = await pedirRespostaOpenAi(config, corpoDaEstrutura(objetivo, diagnostico), comPrazo);
        let resto = "";
        for await (const pedaco of textoDoStreaming(resposta, comPrazo)) {
          resto += pedaco;
          const linhas = resto.split("\n");
          resto = linhas.pop() ?? "";
          for (const linha of linhas) {
            const dado = lerLinha(linha);
            if (dado) yield* montador.linha(dado);
          }
        }
        const ultima = lerLinha(resto);
        if (ultima) yield* montador.linha(ultima);
      } catch (erro) {
        if (sinal.aborted) return undefined;
        if (estourou()) {
          registrar("ia_indisponivel", { motivo: "tempo" });
          throw new FalhaApi("ia_indisponivel");
        }
        if (erro instanceof FalhaApi) throw erro;
        registrar("ia_indisponivel", { motivo: "rede" });
        throw new FalhaApi("ia_indisponivel");
      }
      if (sinal.aborted) return undefined;
      if (montador.total === 0) {
        registrar("ia_indisponivel", { motivo: "sem_licoes" });
        throw new FalhaApi("ia_indisponivel");
      }
      const meta: MetaPlano = { gerador: GERADOR_OPENAI, origem };
      return meta;
    },

    async gerarConteudo(esqueleto, fluxo, licao, sinal) {
      // Registra o motivo da última falha sem registrar conteúdo.
      let ultimoMotivo: string | undefined;
      const registrarFalha = (dados: { motivo: string; detalhe?: string; tentativa: number }) => {
        ultimoMotivo = dados.motivo;
        registrar("ia_indisponivel", dados);
      };
      if (esqueleto.gerador !== GERADOR_OPENAI || !esqueleto.fluxos[fluxo]?.licoes[licao]) throw new FalhaApi("proposta_invalida");
      // Lição de matemática: o primeiro pedido leva fórmulas, figuras e resolução. Se ele não fecha (prazo, erro do provedor, formato), a
      // segunda tentativa volta ao pedido de sempre, sem matemática: a matemática nunca derruba a lição, e o aceite não falha por ela.
      let matematica = licaoEhDeMatematica(esqueleto, fluxo, licao);
      const desligarMatematica = (motivo: string) => {
        if (!matematica) return;
        registrar("matematica_desligada", { motivo });
        matematica = false;
      };
      // A primeira lição válida cuja resolução foi recusada (estrutura, formato ou conta): a segunda tentativa, uma só, pede a lição de novo com
      // o motivo e só a substitui se for melhor. Qualquer falha dela (prazo, erro, formato) devolve esta: nunca pior do que a primeira.
      let reserva: { conteudo: ConteudoLicao; valor: number } | undefined;
      let correcao = "";
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const { sinal: comPrazo, estourou } = sinalComPrazo(sinal, matematica ? TEMPO_CONTEUDO_DE_MATEMATICA_MS : TEMPO_CONTEUDO_MS);
        let corpo: unknown;
        try {
          const resposta = await pedirRespostaOpenAi(config, corpoDaLicao(esqueleto, fluxo, licao, correcao, matematica), comPrazo);
          corpo = await resposta.json();
        } catch (erro) {
          if (reserva) {
            registrar("resolucao_nova_tentativa", { aceita: false, motivo: "falhou" });
            return reserva.conteudo;
          }
          if (sinal.aborted) throw new FalhaApi("ia_indisponivel", undefined, "tempo");
          if (matematica && tentativa === 0) {
            desligarMatematica(estourou() ? "tempo" : erro instanceof FalhaApi ? "http" : "rede");
            continue;
          }
          if (estourou()) throw new FalhaApi("ia_indisponivel", undefined, "tempo");
          if (erro instanceof FalhaApi) throw erro; // HTTP: já registrado com o status em `pedir`.
          registrarFalha({ motivo: "rede", tentativa });
          continue;
        }
        let bruto: unknown;
        try {
          bruto = JSON.parse(textoDaResposta(corpo));
        } catch (erro) {
          const limiteDeTokens = erro instanceof FalhaApi && erro.motivo === "limite_tokens";
          if (reserva) {
            registrar("resolucao_nova_tentativa", { aceita: false, motivo: limiteDeTokens ? "limite_tokens" : "formato" });
            return reserva.conteudo;
          }
          if (limiteDeTokens && tentativa === 0 && !sinal.aborted) {
            registrarFalha({ motivo: "limite_tokens", tentativa });
            correcao = INSTRUCAO_LICAO_CURTA;
            continue;
          }
          if (erro instanceof FalhaApi) throw erro;
          registrarFalha({ motivo: "formato", detalhe: "json", tentativa });
          correcao = correcaoDoFormato("json");
          desligarMatematica("formato");
          continue;
        }
        const lida = normalizarLicaoSegura(bruto, origemDoConteudo(esqueleto.origem), { primeiraLicao: fluxo === 0 && licao === 0 });
        if (lida.conteudo) {
          const ajustes = [...lida.descartados, ...(lida.conceitoCortado ? ["conceito:cortado"] : []), ...(lida.rotuloDoConceitoTirado ? ["conceito:rotulo_tirado"] : []), ...(lida.dicaDaLacunaAparada ? ["lacuna:dica_aparada"] : [])];
          if (ajustes.length > 0) {
            registrar("licao_ajustada", { detalhe: ajustes.join(";"), ...(lida.promovido ? { promovido: lida.promovido } : {}), tentativa });
          }
          // O que a matemática deu, só em contagens (os motivos de recusa citam fórmulas: não vão ao registro).
          if (lida.matematica) registrar("licao_matematica", { ...contagensDoRelato(lida.matematica), tentativa });
          if (reserva) {
            const melhor = valorDaMatematica(lida.matematica) > reserva.valor;
            registrar("resolucao_nova_tentativa", { aceita: lida.matematica?.resolucao.aceita === true, melhor });
            return melhor ? lida.conteudo : reserva.conteudo;
          }
          const motivo = matematica && tentativa === 0 ? motivoDaResolucao(lida.matematica) : undefined;
          if (motivo) {
            reserva = { conteudo: lida.conteudo, valor: valorDaMatematica(lida.matematica) };
            correcao = correcaoDaResolucao(motivo, motivoDaFiguraQueEntrega(lida.matematica));
            continue;
          }
          return lida.conteudo;
        }
        if (reserva) {
          registrar("resolucao_nova_tentativa", { aceita: false, motivo: "formato" });
          return reserva.conteudo;
        }
        registrarFalha({ motivo: "formato", detalhe: lida.motivo, tentativa });
        correcao = correcaoDoFormato(lida.motivo ?? "formato");
        desligarMatematica("formato");
      }
      if (reserva) return reserva.conteudo;
      throw new FalhaApi("ia_indisponivel", undefined, ultimoMotivo);
    },
  };
}
