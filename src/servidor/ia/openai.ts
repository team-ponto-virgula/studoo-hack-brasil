import type { ConteudoLicao, EsqueletoPlano, ExercicioInterno } from "@/dominio/aprendizado/plano";
import { LIMITES_ESQUELETO, conteudoValido } from "@/dominio/aprendizado/plano";
import { FalhaApi } from "@/servidor/acesso/http";
import type { EventoEstrutura, GeradorTrilha, MetaPlano } from "./gerador";
import { instrucoesDeOrdem } from "./ordem";

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
const TEMPO_ESTRUTURA_MS = 45_000;
const TEMPO_CONTEUDO_MS = 40_000;
const TITULO_MAXIMO = 120;

export type ConfiguracaoOpenAi = { chave: string; base: string; modelo: string; esforco: string | null };

/** Configuração da OpenAI pelo ambiente, ou null sem a chave. Só aceita HTTPS (ou HTTP no próprio computador, para testes). */
export function configuracaoOpenAi(): ConfiguracaoOpenAi | null {
  const chave = process.env.OPENAI_API_KEY?.trim();
  if (!chave) return null;
  const base = (process.env.OPENAI_BASE_URL?.trim() || BASE_PADRAO).replace(/\/+$/, "");
  try {
    const url = new URL(base);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
  } catch {
    return null;
  }
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

/** Junta o sinal do pedido com um tempo-limite; diz depois se o fim foi da pessoa (cancelou) ou do relógio. */
function sinalComPrazo(sinal: AbortSignal, ms: number) {
  const prazo = AbortSignal.timeout(ms);
  return { sinal: AbortSignal.any([sinal, prazo]), estourou: () => prazo.aborted && !sinal.aborted };
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

  let resposta = await enviar(true);
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

function aparar(texto: string, maximo: number) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}…`;
}

/** Uma linha JSON do modelo, aceitando cercas de código, vírgulas no fim e marcadores de lista. */
function lerLinha(bruta: string): { tipo: string; titulo: string; objetivo?: string } | null {
  const linha = bruta.trim().replace(/^```\w*|```$/g, "").replace(/^[-*]\s+/, "").replace(/,\s*$/, "").trim();
  if (!linha.startsWith("{")) return null;
  try {
    const dado = JSON.parse(linha) as Record<string, unknown>;
    if (typeof dado.tipo !== "string" || typeof dado.titulo !== "string" || !dado.titulo.trim()) return null;
    return { tipo: dado.tipo, titulo: dado.titulo, objetivo: typeof dado.objetivo === "string" ? dado.objetivo : undefined };
  } catch {
    return null;
  }
}

const instrucoesDaEstrutura = [
  "Você é a IA do Studoo, um app que transforma um objetivo de estudo numa trilha de lições curtas.",
  "Monte a trilha para o objetivo da pessoa. Responda somente com linhas JSON, uma por linha, sem texto antes ou depois e sem blocos de código, neste formato:",
  '{"tipo":"plano","titulo":"<título curto da trilha>","objetivo":"<o objetivo da pessoa numa frase>"}',
  '{"tipo":"fluxo","titulo":"<nome do trecho>"}',
  '{"tipo":"licao","titulo":"<título da lição>"}',
  "Regras:",
  "- Escreva em português do Brasil. Títulos curtos (até 60 caracteres), concretos, sem numeração e sem emojis.",
  "- A primeira linha é a do plano. Depois, 3 trechos com 2 a 4 lições cada (de 7 a 10 lições no total): cada trecho começa com a sua linha de fluxo, seguida das linhas de lição dele.",
  "- Comece do nível que o objetivo indica e avance até o que a pessoa quer alcançar.",
  "- Inclua ao menos uma lição de revisão, com o título começando por \"Revisão:\".",
  instrucoesDeOrdem(),
].join("\n");

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

/**
 * Transforma as linhas do modelo em eventos válidos para o serviço: o plano primeiro, os índices calculados aqui
 * (o modelo só dá tipo e título) e cada trecho emitido junto com a sua primeira lição, para nunca haver trecho vazio.
 */
function criarMontador(objetivo: string) {
  let plano = false;
  let fluxos = 0;
  let licoesNoFluxo = 0;
  let pendente: string | null = null;
  let total = 0;

  function iniciarPlano(titulo?: string, objetivoDaIa?: string): EventoEstrutura[] {
    plano = true;
    return [{
      tipo: "plano",
      titulo: aparar(titulo ?? objetivo, TITULO_MAXIMO),
      objetivo: aparar(objetivoDaIa?.trim() ? objetivoDaIa : objetivo, LIMITES_ESQUELETO.objetivo),
    }];
  }

  return {
    get total() {
      return total;
    },
    linha(dado: { tipo: string; titulo: string; objetivo?: string }): EventoEstrutura[] {
      const eventos: EventoEstrutura[] = [];
      if (dado.tipo === "plano") return plano ? [] : iniciarPlano(dado.titulo, dado.objetivo);
      if (!plano) eventos.push(...iniciarPlano());
      if (dado.tipo === "fluxo") {
        if (fluxos < LIMITES_ESQUELETO.fluxos) pendente = aparar(dado.titulo, TITULO_MAXIMO);
        return eventos;
      }
      if (dado.tipo !== "licao") return eventos;
      if (pendente === null && fluxos === 0) pendente = "Primeiros passos";
      if (pendente !== null) {
        eventos.push({ tipo: "fluxo", fluxo: fluxos, titulo: pendente });
        fluxos += 1;
        licoesNoFluxo = 0;
        pendente = null;
      }
      if (licoesNoFluxo >= LIMITES_ESQUELETO.licoesPorFluxo) return eventos;
      eventos.push({ tipo: "licao", fluxo: fluxos - 1, licao: licoesNoFluxo, titulo: aparar(dado.titulo, TITULO_MAXIMO) });
      licoesNoFluxo += 1;
      total += 1;
      return eventos;
    },
  };
}

const esquemaDaLicao = {
  type: "object",
  additionalProperties: false,
  required: ["objetivo", "conceito", "exemplo", "exercicio"],
  properties: {
    objetivo: { type: "string" },
    conceito: { type: "string" },
    exemplo: { type: "string" },
    exercicio: {
      type: "object",
      additionalProperties: false,
      required: ["tipo", "enunciado", "contexto", "trecho", "opcoes", "gabarito", "feedbackCorreto", "feedbackIncorreto"],
      properties: {
        tipo: { type: "string", enum: ["lacuna", "multipla_escolha"] },
        enunciado: { type: "string" },
        contexto: { type: ["string", "null"] },
        trecho: { type: ["string", "null"] },
        opcoes: {
          type: ["array", "null"],
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "texto"],
            properties: { id: { type: "string" }, texto: { type: "string" } },
          },
        },
        gabarito: { type: "array", items: { type: "string" } },
        feedbackCorreto: { type: "string" },
        feedbackIncorreto: { type: "string" },
      },
    },
  },
} as const;

const instrucoesDaLicao = [
  "Você é a IA do Studoo e escreve uma lição curta de uma trilha de estudo, em português do Brasil, para alguém que está aprendendo.",
  "A lição tem: objetivo (uma frase que começa com um verbo), conceito (de 2 a 4 frases simples, com um único conceito novo), exemplo (um caso concreto e resolvido) e um exercício com feedback.",
  "Exercício:",
  "- Prefira multipla_escolha com 3 opções (ids \"a\", \"b\" e \"c\") e só uma correta; o gabarito é a lista com o id da correta.",
  "- Use lacuna quando a resposta for uma palavra, um número ou um símbolo curto: o trecho mostra a frase com ___ no lugar da resposta, o gabarito lista as respostas aceitas (por exemplo, com e sem acento) e opcoes é null.",
  "- contexto e trecho são opcionais: use null quando não ajudarem.",
  "- feedbackCorreto explica por que a resposta está certa; feedbackIncorreto explica o erro e mostra o caminho certo, com gentileza.",
  "- Se o título da lição começar com \"Revisão\", misture conceitos das lições anteriores.",
  "Não use markdown nem emojis. Não peça dados pessoais.",
].join("\n");

function corpoDaLicao(esqueleto: EsqueletoPlano, fluxo: number, licao: number) {
  const titulos = esqueleto.fluxos.flatMap((trecho) => trecho.licoes.map(({ titulo }) => titulo));
  const posicao = esqueleto.fluxos.slice(0, fluxo).reduce((soma, trecho) => soma + trecho.licoes.length, 0) + licao;
  const lista = titulos.map((titulo, indice) => `${indice + 1}. ${titulo}${indice === posicao ? "  <- esta lição" : ""}`).join("\n");
  return {
    input: [
      { role: "system", content: instrucoesDaLicao },
      {
        role: "user",
        content: `Objetivo da pessoa: ${esqueleto.objetivo}\nTrilha: ${esqueleto.titulo}\nLições da trilha, em ordem:\n${lista}\n\nEscreva a lição ${posicao + 1}: "${titulos[posicao]}".`,
      },
    ],
    text: { format: { type: "json_schema", name: "licao_studoo", schema: esquemaDaLicao, strict: true } },
    max_output_tokens: 4000,
  };
}

/** Ajusta o que o modelo devolveu ao formato interno: campos nulos saem, ids repetidos são refeitos e o gabarito segue o id. */
export function normalizarConteudo(bruto: unknown, origem: string): ConteudoLicao | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const dado = bruto as Record<string, unknown>;
  const exercicio = dado.exercicio as Record<string, unknown> | undefined;
  if (!exercicio || typeof exercicio !== "object") return null;
  const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");
  const opcional = (valor: unknown) => texto(valor) || undefined;
  const gabarito = Array.isArray(exercicio.gabarito)
    ? Array.from(new Set(exercicio.gabarito.map(texto).filter((valor) => valor && valor.length <= 100)))
    : [];
  const base = {
    enunciado: texto(exercicio.enunciado),
    contexto: opcional(exercicio.contexto),
    trecho: opcional(exercicio.trecho),
    feedbackCorreto: texto(exercicio.feedbackCorreto),
    feedbackIncorreto: texto(exercicio.feedbackIncorreto),
  };

  let final: ExercicioInterno;
  if (exercicio.tipo === "multipla_escolha") {
    const brutas = Array.isArray(exercicio.opcoes) ? exercicio.opcoes : [];
    const opcoes = brutas
      .map((opcao) => ({ id: texto((opcao as { id?: unknown })?.id), texto: texto((opcao as { texto?: unknown })?.texto) }))
      .filter((opcao) => opcao.texto)
      .slice(0, 6);
    const ids = new Set(opcoes.map(({ id }) => id));
    const refazer = ids.size !== opcoes.length || opcoes.some(({ id }) => !id || id.length > 20);
    const corrigidas = refazer ? opcoes.map((opcao, indice) => ({ ...opcao, id: "abcdef"[indice] })) : opcoes;
    // O gabarito pode vir com o id, o texto da opção ou o id antigo (antes de refazer).
    const alvo = gabarito[0];
    const certa = corrigidas.find((opcao, indice) => opcao.id === alvo || opcoes[indice].id === alvo ||
      opcao.texto.toLocaleLowerCase("pt-BR") === alvo?.toLocaleLowerCase("pt-BR"));
    if (!certa) return null;
    final = { tipo: "multipla_escolha", ...base, opcoes: corrigidas, gabarito: [certa.id] };
  } else {
    final = { tipo: "lacuna", ...base, gabarito };
  }

  const conteudo: ConteudoLicao = {
    objetivo: texto(dado.objetivo),
    conceito: texto(dado.conceito),
    exemplo: texto(dado.exemplo),
    origem,
    exercicio: final,
  };
  return conteudoValido(conteudo) ? conteudo : null;
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
      for (let tentativa = 0; tentativa < 2; tentativa += 1) {
        const { sinal: comPrazo, estourou } = sinalComPrazo(sinal, TEMPO_CONTEUDO_MS);
        try {
          const resposta = await pedir(config, corpoDaLicao(esqueleto, fluxo, licao), comPrazo);
          const texto = textoDaResposta(await resposta.json());
          const conteudo = normalizarConteudo(JSON.parse(texto), esqueleto.origem);
          if (conteudo) return conteudo;
          registrar("ia_indisponivel", { motivo: "formato", tentativa });
        } catch (erro) {
          if (sinal.aborted || estourou()) throw new FalhaApi("ia_indisponivel");
          if (erro instanceof FalhaApi) throw erro;
          registrar("ia_indisponivel", { motivo: "formato", tentativa });
        }
      }
      throw new FalhaApi("ia_indisponivel");
    },
  };
}
