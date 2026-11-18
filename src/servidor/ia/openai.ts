import type { MetaPlano } from "./gerador";
import type { GeradorTrilha } from "./gerador";
import type { EsqueletoPlano } from "@/dominio/aprendizado/plano";
import { LIMITES_ESQUELETO } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import { comNovasTentativas } from "./novas-tentativas";
import {
  TEMPO_CONTEUDO_MS,
  TEMPO_ESTRUTURA_MS,
  aparar,
  criarMontador,
  esquemaDaLicao,
  instrucoesDaEstrutura,
  instrucoesDaLicao,
  lerLinha,
  correcaoDoFormato,
  normalizarConteudo,
  normalizarLicao,
  promptDaLicao,
  sinalComPrazo,
  validarBaseUrl,
} from "./comum";

export { normalizarConteudo };

/*
 * IA real do Studoo com a Responses API da OpenAI (POST /v1/responses), chamada por fetch, sem SDK.
 * - A estrutura da trilha vem por streaming: o modelo escreve uma linha JSON por evento e cada linha completa vira um
 *   evento na tela assim que chega, então a trilha nasce enquanto o modelo escreve.
 * - O conteúdo de cada lição vem com Structured Outputs (JSON Schema estrito) e passa pela mesma validação da IA falsa.
 * O pedido leva só o objetivo e os títulos da trilha: nenhum dado da conta (SEGURANCA.md §5). Os logs não levam o
 * objetivo nem o conteúdo (§8). A chave fica só no servidor.
 */

export const GERADOR_OPENAI = "openai-v1";
const BASE_PADRAO = "https://api.openai.com/v1";
/** Modelo padrão com suporte a Structured Outputs; troque por OPENAI_MODELO. */
export const MODELO_PADRAO = "gpt-4.1";

export type ConfiguracaoOpenAi = { chave: string; base: string; modelo: string; esforco: string | null };

/** Configuração da OpenAI pelo ambiente, ou null sem a chave. Só aceita HTTPS (ou HTTP no próprio computador, para testes). */
export function configuracaoOpenAi(): ConfiguracaoOpenAi | null {
  const chave = process.env.OPENAI_API_KEY?.trim();
  if (!chave) return null;
  const base = validarBaseUrl(process.env.OPENAI_BASE_URL, BASE_PADRAO);
  if (!base) return null;
  const modelo = process.env.OPENAI_MODELO?.trim() || MODELO_PADRAO;
  const definido = process.env.OPENAI_ESFORCO;
  // Modelos de raciocínio respondem mais rápido com esforço baixo; nos outros, o campo não vai.
  const esforco = definido !== undefined ? definido.trim() || null : /^(gpt-5|gpt-6|o\d)/.test(modelo) ? "low" : null;
  return { chave, base, modelo, esforco };
}

function registrar(codigo: string, detalhe: Record<string, unknown>) {
  // Sem objetivo, conteúdo ou chave no log (SEGURANCA.md §8).
  console.error(JSON.stringify({ rota: "ia-openai", codigo, ...detalhe }));
}

/**
 * Chama a Responses API. Se o modelo recusar o campo de esforço de raciocínio (400), tenta de novo sem ele.
 * Erro do provedor vira `ia_indisponivel`.
 */
async function pedir(config: ConfiguracaoOpenAi, corpo: Record<string, unknown>, sinal: AbortSignal): Promise<Response> {
  const enviar = (comEsforco: boolean) => fetch(`${config.base}/responses`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.modelo, ...(comEsforco && config.esforco ? { reasoning: { effort: config.esforco } } : {}), ...corpo }),
    signal: sinal,
  });

  let resposta = await comNovasTentativas(() => enviar(true), { rota: "ia-openai", sinal });
  if (resposta.status === 400 && config.esforco) {
    const texto = await resposta.text().catch(() => "");
    if (/reasoning|effort/i.test(texto)) resposta = await enviar(false);
    else {
      registrar("ia_indisponivel", { status: 400 });
      throw new FalhaApi("ia_indisponivel");
    }
  }
  if (!resposta.ok) {
    registrar("ia_indisponivel", { status: resposta.status });
    throw new FalhaApi("ia_indisponivel");
  }
  return resposta;
}

/** Texto das partes `output_text` de uma resposta sem streaming. Uma recusa do modelo vira erro. */
function textoDaResposta(corpo: unknown): string {
  if (typeof corpo !== "object" || corpo === null) return "";
  const dado = corpo as { output_text?: unknown; output?: unknown };
  if (typeof dado.output_text === "string") return dado.output_text;
  if (!Array.isArray(dado.output)) return "";
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
  return texto;
}

/**
 * Pedido curto com Structured Outputs, usado durante a aula (correção da resposta aberta e desempate da lacuna). Tem
 * prazo próprio, curto: se a IA demorar ou falhar, quem chamou fica com a correção local.
 */
export async function pedirCorrecao(
  config: ConfiguracaoOpenAi,
  nome: string,
  esquema: Record<string, unknown>,
  instrucoes: string,
  dados: unknown,
  ms = 15_000,
): Promise<unknown> {
  const resposta = await pedir(config, {
    input: [
      { role: "system", content: instrucoes },
      { role: "user", content: JSON.stringify(dados) },
    ],
    text: { format: { type: "json_schema", name: nome, schema: esquema, strict: true } },
    max_output_tokens: 1500,
    store: false,
  }, AbortSignal.timeout(ms));
  return JSON.parse(textoDaResposta(await resposta.json()));
}

/** Lê o streaming (SSE) e entrega os pedaços de texto à medida que chegam. */
async function* textoDoStreaming(resposta: Response, sinal: AbortSignal): AsyncGenerator<string> {
  if (!resposta.body) throw new FalhaApi("ia_indisponivel");
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let resto = "";
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
        if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") yield evento.delta;
        else if (evento.type === "error" || evento.type === "response.failed" || evento.type === "response.refusal.delta") {
          registrar("ia_indisponivel", { evento: String(evento.type) });
          throw new FalhaApi("ia_indisponivel");
        }
      }
    }
  } finally {
    leitor.cancel().catch(() => undefined);
  }
}

/** Pedido da estrutura: só o objetivo vai para a IA. */
function corpoDaEstrutura(objetivo: string) {
  return {
    input: [
      { role: "system", content: instrucoesDaEstrutura },
      { role: "user", content: `Objetivo de estudo: ${objetivo}` },
    ],
    stream: true,
    max_output_tokens: 4000,
  };
}

function corpoDaLicao(esqueleto: EsqueletoPlano, fluxo: number, licao: number, correcao = "") {
  return {
    input: [
      { role: "system", content: instrucoesDaLicao },
      { role: "user", content: promptDaLicao(esqueleto, fluxo, licao) },
      ...(correcao ? [{ role: "user", content: correcao }] : []),
    ],
    text: { format: { type: "json_schema", name: "licao_studoo", schema: esquemaDaLicao, strict: true } },
    max_output_tokens: 6000,
  };
}

/**
 * Gerador da OpenAI. A estrutura chega por streaming e vira eventos na hora; o conteúdo de cada lição é pedido no
 * aceite, com Structured Outputs, e tem uma segunda tentativa se vier fora do formato.
 */
export function criarGeradorOpenAi(config: ConfiguracaoOpenAi): GeradorTrilha {
  const origem = aparar(`IA da OpenAI (${config.modelo})`, LIMITES_ESQUELETO.titulo);

  return {
    async *gerarEstrutura(objetivo, sinal) {
      const { sinal: comPrazo, estourou } = sinalComPrazo(sinal, TEMPO_ESTRUTURA_MS);
      const montador = criarMontador(objetivo);
      try {
        const resposta = await pedir(config, corpoDaEstrutura(objetivo), comPrazo);
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
      if (esqueleto.gerador !== GERADOR_OPENAI || !esqueleto.fluxos[fluxo]?.licoes[licao]) throw new FalhaApi("proposta_invalida");
      let correcao = "";
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const { sinal: comPrazo, estourou } = sinalComPrazo(sinal, TEMPO_CONTEUDO_MS);
        let corpo: unknown;
        try {
          const resposta = await pedir(config, corpoDaLicao(esqueleto, fluxo, licao, correcao), comPrazo);
          corpo = await resposta.json();
        } catch (erro) {
          if (sinal.aborted || estourou()) throw new FalhaApi("ia_indisponivel");
          if (erro instanceof FalhaApi) throw erro; // HTTP: já registrado com o status em `pedir`.
          registrar("ia_indisponivel", { motivo: "rede", tentativa });
          continue;
        }
        let bruto: unknown;
        try {
          bruto = JSON.parse(textoDaResposta(corpo));
        } catch (erro) {
          if (erro instanceof FalhaApi) throw erro; // recusa do modelo
          registrar("ia_indisponivel", { motivo: "formato", detalhe: "json", tentativa });
          correcao = correcaoDoFormato("json");
          continue;
        }
        const lida = normalizarLicao(bruto, esqueleto.origem);
        if (lida.conteudo) {
          if (lida.descartados.length > 0) {
            registrar("licao_ajustada", { detalhe: lida.descartados.join(";"), ...(lida.promovido ? { promovido: lida.promovido } : {}), tentativa });
          }
          return lida.conteudo;
        }
        registrar("ia_indisponivel", { motivo: "formato", detalhe: lida.motivo, tentativa });
        correcao = correcaoDoFormato(lida.motivo ?? "formato");
      }
      throw new FalhaApi("ia_indisponivel");
    },
  };
}
