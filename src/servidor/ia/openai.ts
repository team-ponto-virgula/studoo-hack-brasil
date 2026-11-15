import { TIPOS_TRECHO, type Recurso, type TipoTrecho } from "@studoo/contratos";
import type { ConteudoLicao, EsqueletoPlano, ExercicioInterno } from "@/dominio/aprendizado/plano";
import {
  LIMITES_ESQUELETO,
  conteudoValido,
  exercicioValido,
  falaValida,
  normalizarResposta,
  praticaValida,
  recursoValido,
  somValido,
  termosPresentes,
} from "@/dominio/aprendizado/plano";
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

function aparar(texto: string, maximo: number) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}…`;
}

/** Uma linha JSON do modelo, aceitando cercas de código, vírgulas no fim e marcadores de lista. */
function lerLinha(bruta: string): { tipo: string; titulo: string; objetivo?: string; resumo?: string } | null {
  const linha = bruta.trim().replace(/^```\w*|```$/g, "").replace(/^[-*]\s+/, "").replace(/,\s*$/, "").trim();
  if (!linha.startsWith("{")) return null;
  try {
    const dado = JSON.parse(linha) as Record<string, unknown>;
    if (typeof dado.tipo !== "string" || typeof dado.titulo !== "string" || !dado.titulo.trim()) return null;
    return {
      tipo: dado.tipo,
      titulo: dado.titulo,
      objetivo: typeof dado.objetivo === "string" ? dado.objetivo : undefined,
      resumo: typeof dado.resumo === "string" && dado.resumo.trim() ? dado.resumo : undefined,
    };
  } catch {
    return null;
  }
}

const instrucoesDaEstrutura = [
  "Você é a IA do Studoo, um app que transforma um objetivo de estudo numa trilha de lições curtas.",
  "Monte a trilha para o objetivo da pessoa. Responda somente com linhas JSON, uma por linha, sem texto antes ou depois e sem blocos de código, neste formato:",
  '{"tipo":"plano","titulo":"<título curto da trilha>","objetivo":"<o objetivo da pessoa numa frase>"}',
  '{"tipo":"fluxo","titulo":"<nome do trecho>"}',
  '{"tipo":"licao","titulo":"<título da lição>","resumo":"<o que a pessoa vai saber fazer depois dela, numa frase curta que começa com um verbo>"}',
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
    linha(dado: { tipo: string; titulo: string; objetivo?: string; resumo?: string }): EventoEstrutura[] {
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
      eventos.push({
        tipo: "licao", fluxo: fluxos - 1, licao: licoesNoFluxo, titulo: aparar(dado.titulo, TITULO_MAXIMO),
        ...(dado.resumo ? { resumo: aparar(dado.resumo, 160) } : {}),
      });
      licoesNoFluxo += 1;
      total += 1;
      return eventos;
    },
  };
}

const textoJson = { type: "string" } as const;
const textoOuNulo = { type: ["string", "null"] } as const;
const nulo = { type: "null" } as const;
const objetoEstrito = (propriedades: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(propriedades),
  properties: propriedades,
});
const opcaoJson = objetoEstrito({ id: textoJson, texto: textoJson });
const opcoesOuNulo = { type: ["array", "null"], items: opcaoJson } as const;
/** Erros comuns de quem aprende, cada um com os termos que o denunciam e o aviso certeiro. */
const armadilhasOuNulo = { type: ["array", "null"], items: objetoEstrito({ termos: textoJson, aviso: textoJson }) } as const;

const esquemaDoExercicio = objetoEstrito({
  tipo: { type: "string", enum: ["lacuna", "multipla_escolha", "ordenar", "associar", "verdadeiro_falso", "aberta"] },
  enunciado: textoJson,
  contexto: textoOuNulo,
  trecho: textoOuNulo,
  trechoTipo: { anyOf: [{ type: "string", enum: ["codigo", "frase", "citacao", "formula", "passos"] }, nulo] },
  fala: { anyOf: [objetoEstrito({ texto: textoJson, idioma: textoJson, pronuncia: textoOuNulo }), nulo] },
  opcoes: opcoesOuNulo,
  itens: opcoesOuNulo,
  esquerda: opcoesOuNulo,
  direita: opcoesOuNulo,
  afirmacao: textoOuNulo,
  gabarito: { type: "array", items: textoJson },
  exata: { type: ["boolean", "null"] },
  criterios: { type: ["array", "null"], items: objetoEstrito({ texto: textoJson, essencial: { type: "boolean" } }) },
  modelo: textoOuNulo,
  armadilhas: armadilhasOuNulo,
  feedbackCorreto: textoJson,
  feedbackIncorreto: textoJson,
});

const esquemaDaLicao = objetoEstrito({
  objetivo: textoJson,
  conceito: textoJson,
  exemplo: textoJson,
  exemploTipo: { type: "string", enum: ["exemplo", "demonstracao"] },
  passos: { type: ["array", "null"], items: textoJson },
  outroJeito: textoOuNulo,
  recurso: {
    anyOf: [
      objetoEstrito({
        tipo: { type: "string", enum: ["acorde", "linha_do_tempo", "fracao"] },
        nome: textoOuNulo,
        casas: { type: ["array", "null"], items: { type: "integer" } },
        dedos: { type: ["array", "null"], items: { type: "integer" } },
        batida: { type: ["boolean", "null"] },
        anterior: {
          anyOf: [
            objetoEstrito({ nome: textoJson, casas: { type: "array", items: { type: "integer" } }, dedos: { type: ["array", "null"], items: { type: "integer" } } }),
            nulo,
          ],
        },
        eventos: { type: ["array", "null"], items: objetoEstrito({ quando: textoJson, texto: textoJson }) },
        numerador: { type: ["integer", "null"] },
        denominador: { type: ["integer", "null"] },
      }),
      nulo,
    ],
  },
  falas: { type: ["array", "null"], items: objetoEstrito({ texto: textoJson, idioma: textoJson, traducao: textoOuNulo, pronuncia: textoOuNulo }) },
  pratica: {
    anyOf: [
      objetoEstrito({
        tarefa: textoJson,
        minutos: { type: "integer" },
        passos: { type: ["array", "null"], items: textoJson },
        dica: textoOuNulo,
        som: { anyOf: [objetoEstrito({ rotulo: textoJson, casas: { type: "array", items: { type: "integer" } } }), nulo] },
      }),
      nulo,
    ],
  },
  exercicios: { type: "array", items: esquemaDoExercicio },
});

const instrucoesDaLicao = [
  "Você é a IA do Studoo e escreve uma lição curta de uma trilha de estudo, em português do Brasil, para alguém que está aprendendo. O assunto pode ser qualquer coisa: idioma, música, culinária, história, ciência, esporte, programação.",
  "A lição tem: objetivo (uma frase que começa com um verbo), conceito (de 2 a 4 frases simples, com um único conceito novo), exemplo (um caso concreto e resolvido) e 2 ou 3 exercícios com feedback.",
  "Exemplo e recursos:",
  "- exemploTipo é \"demonstracao\" nas habilidades práticas (tocar, cozinhar, desenhar, praticar um esporte): o exemplo apresenta e passos traz de 3 a 6 passos curtos para fazer junto. Nos outros casos, exemploTipo é \"exemplo\" e passos é null.",
  "- outroJeito: a mesma ideia central por outro caminho, para quem errou um exercício: uma analogia do dia a dia ou uma regra prática, em 1 a 3 frases, sem repetir o conceito com outras palavras.",
  "- recurso, só quando ajudar a ver: acorde de violão (tipo \"acorde\", nome como \"Am\", casas com 6 inteiros da 6ª corda à 1ª: -1 não toca, 0 solta, n é a casa; dedos com 6 inteiros de 0 a 4; batida true se a lição for de ritmo; anterior, só numa lição de troca de acordes, é o acorde de onde a mão sai, no mesmo formato, para os dois aparecerem lado a lado) ou linha_do_tempo (de 2 a 8 eventos com quando e texto, para história, processos e tempos de preparo) ou fracao (barra com denominador de 1 a 12 partes iguais e numerador partes pintadas; nome é o rótulo, como \"2/4 = 1/2\"). Nos campos que não se aplicam, use null. Sem recurso, null.",
  "- Numa lição de idioma, escreva no conceito e no exemplo cada frase do idioma estudado entre aspas curvas (“Excuse me”): a pessoa toca nelas para ouvir.",
  "- falas, em lições de idioma: de 1 a 4 frases curtas no idioma estudado, com idioma no formato BCP 47 (como en-US, es-ES, fr-FR), a traducao em português e a pronuncia: como a frase soa, escrita com as letras do português, com hífen entre as sílabas das palavras longas e a sílaba mais forte em MAIÚSCULAS (\"Excuse me, where is the station?\" vira \"eks-KIÚZ mi, UÉR iz dâ STÊI-shan?\"). Nos outros assuntos, falas é null.",
  "- pratica, nas habilidades que se treinam fora do app: uma tarefa concreta e segura, minutos de 1 a 20 para o cronômetro, até 5 passos, uma dica (ou null) e som. som só existe em lições de violão: um som de referência para comparar enquanto pratica, com rotulo curto (como \"Ouvir o Mi (6ª corda solta)\") e casas com 6 inteiros da 6ª corda à 1ª, como no acorde (de -1 a 12); nos outros casos, som é null. Sem prática, pratica é null.",
  "Exercícios (2 ou 3, em formatos variados; o primeiro é o principal). Pelo menos um pede que a pessoa produza a resposta (lacuna, ordenar ou aberta), e não só reconheça a certa:",
  "- multipla_escolha: 3 opções em opcoes (ids \"a\", \"b\", \"c\"), só uma correta; gabarito é a lista com o id da correta.",
  "- lacuna: o trecho mostra a frase com ___ no lugar da resposta, que é uma palavra, um número ou um símbolo curto; gabarito lista as respostas aceitas. exata é true quando a grafia é o que se ensina (palavra de outro idioma, ortografia); senão, false.",
  "- ordenar: itens traz de 3 a 6 itens já na ordem certa (passos de um processo, acontecimentos, falas de um diálogo); o app embaralha. gabarito é [].",
  "- associar: esquerda e direita com o mesmo número de itens (de 2 a 5), e direita[i] é o par de esquerda[i] (termo e definição, palavra e tradução, personagem e feito); o app embaralha. gabarito é [].",
  "- verdadeiro_falso: afirmacao é a frase a julgar e opcoes traz 3 justificativas, só uma explica corretamente; gabarito é [\"verdadeiro\" ou \"falso\", id da justificativa certa].",
  "- aberta: a pessoa explica com as próprias palavras (use em revisões e em lições de explicar). gabarito traz de 2 a 4 grupos de palavras-chave sem acento, com alternativas separadas por | (radicais valem, como fazendeir); criterios tem o mesmo número de itens, na mesma ordem, cada um com texto (o que o grupo procura, em linguagem simples) e essencial (true só no ponto da lição, sem o qual a resposta não serve, como \"I'd like\" e não \"I like\" num pedido; no máximo 2, e os outros false); modelo é uma boa resposta, de 2 ou 3 frases.",
  "- armadilhas, só na lacuna e na aberta (nos outros tipos, null): até 3 erros comuns de quem aprende o assunto, cada um com termos (minúsculas e sem acento, alternativas separadas por |; na lacuna, a resposta errada inteira, como um nome popular ou um falso cognato; na aberta, a expressão errada que pode aparecer no texto, como \"i want\") e aviso (uma frase gentil que explica o erro; na lacuna, sem dar a resposta). Os termos nunca aparecem no gabarito nem no modelo. Sem um erro comum claro, null.",
  "- trecho é opcional. trechoTipo diz o visual: codigo (só para código de programação), frase, citacao, formula ou passos (um passo por linha). fala, opcional, é um áudio para ouvir (texto, idioma e pronuncia, como nas falas da lição; pronuncia null fora de idiomas); num exercício de escuta, deixe o trecho null para o texto não aparecer de cara.",
  "- Nos campos que não se aplicam ao tipo, use null (e [] no gabarito de ordenar e associar).",
  "- feedbackCorreto explica por que a resposta está certa; feedbackIncorreto explica o erro e mostra o caminho certo, com gentileza.",
  "- Se o título da lição começar com \"Revisão\", misture conceitos das lições anteriores.",
  "Não use markdown nem emojis. Não peça dados pessoais. Nada de práticas perigosas.",
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
    max_output_tokens: 6000,
  };
}

/** Texto aparado, ou vazio. */
function textoDe(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Opções com texto, até `maximo`, com ids refeitos quando vierem repetidos, vazios ou longos. */
function opcoesDe(valor: unknown, maximo: number, prefixo: string): { id: string; texto: string; idOriginal: string }[] {
  const brutas = Array.isArray(valor) ? valor : [];
  const opcoes = brutas
    .map((opcao) => ({ idOriginal: textoDe((opcao as { id?: unknown })?.id), texto: textoDe((opcao as { texto?: unknown })?.texto) }))
    .filter((opcao) => opcao.texto)
    .slice(0, maximo);
  const ids = new Set(opcoes.map(({ idOriginal }) => idOriginal));
  const refazer = ids.size !== opcoes.length || opcoes.some(({ idOriginal }) => !/^[\w-]{1,20}$/.test(idOriginal));
  return opcoes.map((opcao, indice) => ({ ...opcao, id: refazer ? `${prefixo}${"abcdefgh"[indice]}` : opcao.idOriginal }));
}

/** A opção que o gabarito aponta: pelo id, pelo id antigo (antes de refazer) ou pelo texto. */
function acharOpcao(opcoes: { id: string; texto: string; idOriginal: string }[], alvo: string | undefined) {
  if (!alvo) return undefined;
  return opcoes.find((opcao) => opcao.id === alvo || opcao.idOriginal === alvo ||
    opcao.texto.toLocaleLowerCase("pt-BR") === alvo.toLocaleLowerCase("pt-BR"));
}

const limparOpcoes = (opcoes: { id: string; texto: string }[]) => opcoes.map(({ id, texto }) => ({ id, texto }));

/** Texto aparado até `maximo` caracteres, ou vazio (o campo opcional sai em vez de invalidar a lição). */
function textoAte(valor: unknown, maximo: number) {
  const texto = textoDe(valor);
  return texto.length <= maximo ? texto : "";
}

/** A pronúncia escrita de uma fala (“eks-KIÚZ mi”), quando vem e cabe. */
const pronunciaDe = (valor: unknown) => (textoAte(valor, 160) ? { pronuncia: textoAte(valor, 160) } : {});

/**
 * Erros comuns da lacuna e da aberta: até quatro, com termos e aviso nos limites. Sai o termo que `vale` (uma resposta
 * aceita, ou o que a resposta modelo traz): o aviso de erro nunca aparece para quem acertou.
 */
function armadilhasDe(valor: unknown, vale: (termo: string) => boolean) {
  if (!Array.isArray(valor)) return undefined;
  const armadilhas = valor.flatMap((item) => {
    const { termos, aviso } = (item ?? {}) as Record<string, unknown>;
    const juntos = textoDe(termos).split("|").map((termo) => termo.trim()).filter((termo) => termo && !vale(termo)).join("|");
    return juntos && juntos.length <= 200 && textoAte(aviso, 300) ? [{ termos: juntos, aviso: textoAte(aviso, 300) }] : [];
  }).slice(0, 4);
  return armadilhas.length > 0 ? armadilhas : undefined;
}

/**
 * Os critérios da aberta, no formato novo (texto e essencial) ou no antigo (só o texto). Só ficam se casarem com os
 * grupos do gabarito; os essenciais, só quando se destacam (no máximo dois, e nunca todos).
 */
function criteriosDe(valor: unknown, grupos: number) {
  const lidos = (Array.isArray(valor) ? valor : []).map((item) => typeof item === "string"
    ? { texto: textoAte(item, 200), essencial: false }
    : { texto: textoAte((item as { texto?: unknown })?.texto, 200), essencial: (item as { essencial?: unknown })?.essencial === true })
    .filter(({ texto }) => texto);
  if (lidos.length === 0 || lidos.length !== grupos) return {};
  const essenciais = lidos.flatMap(({ essencial }, indice) => (essencial ? [indice] : []));
  return {
    criterios: lidos.map(({ texto }) => texto),
    ...(essenciais.length > 0 && essenciais.length <= 2 && essenciais.length < grupos ? { essenciais } : {}),
  };
}

/** Um exercício do modelo no formato interno, ou null se não fechar (ids, gabarito, campos do tipo). */
function normalizarExercicio(bruto: unknown): ExercicioInterno | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const exercicio = bruto as Record<string, unknown>;
  const gabarito = Array.isArray(exercicio.gabarito)
    ? Array.from(new Set(exercicio.gabarito.map(textoDe).filter((valor) => valor && valor.length <= 200)))
    : [];
  const fala = exercicio.fala as { texto?: unknown; idioma?: unknown; pronuncia?: unknown } | null | undefined;
  const trecho = textoDe(exercicio.trecho);
  const trechoTipo = textoDe(exercicio.trechoTipo);
  const base = {
    enunciado: textoDe(exercicio.enunciado),
    ...(textoDe(exercicio.contexto) ? { contexto: textoDe(exercicio.contexto) } : {}),
    ...(trecho ? { trecho, ...((TIPOS_TRECHO as readonly string[]).includes(trechoTipo) ? { trechoTipo: trechoTipo as TipoTrecho } : {}) } : {}),
    ...(fala && textoDe(fala.texto) && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(textoDe(fala.idioma))
      ? { fala: { texto: textoDe(fala.texto), idioma: textoDe(fala.idioma), ...pronunciaDe(fala.pronuncia) } }
      : {}),
    feedbackCorreto: textoDe(exercicio.feedbackCorreto),
    feedbackIncorreto: textoDe(exercicio.feedbackIncorreto),
  };

  switch (exercicio.tipo) {
    case "multipla_escolha": {
      const opcoes = opcoesDe(exercicio.opcoes, 6, "");
      const certa = acharOpcao(opcoes, gabarito[0]);
      return certa ? { tipo: "multipla_escolha", ...base, opcoes: limparOpcoes(opcoes), gabarito: [certa.id] } : null;
    }
    case "ordenar": {
      // O modelo manda os itens já na ordem certa; o app embaralha ao mostrar.
      const itens = opcoesDe(exercicio.itens, 7, "i");
      return itens.length >= 3 ? { tipo: "ordenar", ...base, itens: limparOpcoes(itens), gabarito: itens.map(({ id }) => id) } : null;
    }
    case "associar": {
      // direita[i] é o par de esquerda[i].
      const esquerda = opcoesDe(exercicio.esquerda, 6, "e");
      const direita = opcoesDe(exercicio.direita, 6, "d");
      if (esquerda.length < 2 || esquerda.length !== direita.length) return null;
      const ids = esquerda.map(({ id }) => id);
      const corrigidas = direita.map((item, indice) => (ids.includes(item.id) ? { ...item, id: `d${"abcdefgh"[indice]}` } : item));
      return {
        tipo: "associar",
        ...base,
        esquerda: limparOpcoes(esquerda),
        direita: limparOpcoes(corrigidas),
        gabarito: esquerda.map((item, indice) => `${item.id}=${corrigidas[indice].id}`),
      };
    }
    case "verdadeiro_falso": {
      const justificativas = opcoesDe(exercicio.opcoes, 4, "");
      const valor = gabarito[0]?.toLocaleLowerCase("pt-BR");
      const certa = acharOpcao(justificativas, gabarito[1]);
      const afirmacao = textoDe(exercicio.afirmacao);
      if (!afirmacao || !certa || (valor !== "verdadeiro" && valor !== "falso")) return null;
      return { tipo: "verdadeiro_falso", ...base, afirmacao, justificativas: limparOpcoes(justificativas), gabarito: [valor, certa.id] };
    }
    case "aberta": {
      const grupos = gabarito.slice(0, 6);
      const modelo = textoAte(exercicio.modelo, 1200);
      // A armadilha não pode estar numa resposta certa: nem num grupo do gabarito, nem na resposta modelo.
      const certos = [...grupos.flatMap((grupo) => grupo.split("|")), modelo].filter(Boolean);
      const armadilhas = armadilhasDe(exercicio.armadilhas, (termo) => certos.some((certo) => termosPresentes(certo, [termo]).length > 0));
      return {
        tipo: "aberta",
        ...base,
        minimo: 30,
        gabarito: grupos,
        ...criteriosDe(exercicio.criterios, grupos.length),
        ...(modelo ? { modelo } : {}),
        ...(armadilhas ? { armadilhas } : {}),
      };
    }
    case "lacuna": {
      // Na lacuna, a armadilha é uma resposta errada inteira; uma resposta aceita nunca vira armadilha.
      const aceitas = new Set(gabarito.map(normalizarResposta));
      const armadilhas = armadilhasDe(exercicio.armadilhas, (termo) => aceitas.has(normalizarResposta(termo)));
      return { tipo: "lacuna", ...base, gabarito, ...(exercicio.exata === true ? { exata: true } : {}), ...(armadilhas ? { armadilhas } : {}) };
    }
    default:
      return null;
  }
}

/**
 * Ajusta o que o modelo devolveu ao formato interno: campos nulos saem, ids são refeitos quando preciso, o gabarito
 * segue os ids, e recursos, falas e prática fora do formato são descartados (a lição continua válida sem eles).
 * Aceita também o formato antigo, com um `exercicio` só.
 */
export function normalizarConteudo(bruto: unknown, origem: string): ConteudoLicao | null {
  if (typeof bruto !== "object" || bruto === null) return null;
  const dado = bruto as Record<string, unknown>;
  const brutos = Array.isArray(dado.exercicios) ? dado.exercicios : dado.exercicio ? [dado.exercicio] : [];
  const exercicios = brutos.slice(0, 3).map(normalizarExercicio);
  // O principal precisa fechar; um extra que não fecha é descartado (sem levar junto o resto da lição).
  if (!exercicios[0]) return null;
  const extras = exercicios.slice(1).filter((exercicio): exercicio is ExercicioInterno => exercicio !== null && exercicioValido(exercicio));

  const passos = Array.isArray(dado.passos) ? dado.passos.map((passo) => textoAte(passo, 300)).filter(Boolean).slice(0, 8) : [];
  const falas = Array.isArray(dado.falas)
    ? dado.falas
      .map((fala) => {
        const { texto, idioma, traducao, pronuncia } = (fala ?? {}) as Record<string, unknown>;
        return {
          texto: textoDe(texto),
          idioma: textoDe(idioma),
          ...(textoDe(traducao) ? { traducao: textoDe(traducao) } : {}),
          ...pronunciaDe(pronuncia),
        };
      })
      .filter(falaValida)
      .slice(0, 6)
    : [];
  const recursoBruto = dado.recurso as Record<string, unknown> | null | undefined;
  let recurso: Recurso | undefined;
  if (recursoBruto?.tipo === "acorde") {
    const anteriorBruto = recursoBruto.anterior as Record<string, unknown> | null | undefined;
    const anterior = anteriorBruto
      ? {
        nome: textoDe(anteriorBruto.nome),
        casas: Array.isArray(anteriorBruto.casas) ? anteriorBruto.casas as number[] : [],
        ...(Array.isArray(anteriorBruto.dedos) ? { dedos: anteriorBruto.dedos as number[] } : {}),
      }
      : undefined;
    recurso = {
      tipo: "acorde",
      nome: textoDe(recursoBruto.nome),
      casas: Array.isArray(recursoBruto.casas) ? recursoBruto.casas as number[] : [],
      ...(Array.isArray(recursoBruto.dedos) ? { dedos: recursoBruto.dedos as number[] } : {}),
      ...(recursoBruto.batida === true ? { batida: true } : {}),
      // Um acorde anterior fora do formato sai; o acorde da lição continua.
      ...(anterior && recursoValido({ tipo: "acorde", ...anterior }) ? { anterior } : {}),
    };
  } else if (recursoBruto?.tipo === "fracao") {
    recurso = {
      tipo: "fracao",
      numerador: Number(recursoBruto.numerador),
      denominador: Number(recursoBruto.denominador),
      ...(textoDe(recursoBruto.nome) ? { rotulo: textoDe(recursoBruto.nome) } : {}),
    };
  } else if (recursoBruto?.tipo === "linha_do_tempo") {
    const eventos = Array.isArray(recursoBruto.eventos) ? recursoBruto.eventos : [];
    recurso = {
      tipo: "linha_do_tempo",
      eventos: eventos.map((evento) => ({ quando: textoDe((evento as { quando?: unknown })?.quando), texto: textoDe((evento as { texto?: unknown })?.texto) })),
    };
  }
  const praticaBruta = dado.pratica as Record<string, unknown> | null | undefined;
  const somBruto = praticaBruta?.som as { rotulo?: unknown; casas?: unknown } | null | undefined;
  const som = somBruto ? { rotulo: textoDe(somBruto.rotulo), casas: somBruto.casas } : undefined;
  const passosDaPratica = Array.isArray(praticaBruta?.passos) ? praticaBruta.passos.map((passo) => textoAte(passo, 200)).filter(Boolean).slice(0, 5) : [];
  const pratica = praticaBruta && textoDe(praticaBruta.tarefa)
    ? {
      tarefa: textoDe(praticaBruta.tarefa),
      minutos: Math.min(20, Math.max(1, Math.round(Number(praticaBruta.minutos) || 3))),
      ...(passosDaPratica.length > 0 ? { passos: passosDaPratica } : {}),
      ...(textoAte(praticaBruta.dica, 300) ? { dica: textoAte(praticaBruta.dica, 300) } : {}),
      // Um som fora do formato (cinco cordas, casa 20) sai, e a prática continua.
      ...(somValido(som) ? { som } : {}),
    }
    : undefined;
  const outroJeito = textoAte(dado.outroJeito, 600);

  // Numa lição de idioma (com falas), as frases entre aspas retas viram aspas curvas, que o app torna tocáveis. Fora
  // dos idiomas, as aspas ficam como vieram (podem ser parte de um código).
  const aspas = (texto: string) => (falas.length > 0 ? texto.replace(/"([^"\n]{1,200})"/g, "“$1”") : texto);
  const conteudo: ConteudoLicao = {
    objetivo: textoDe(dado.objetivo),
    conceito: aspas(textoDe(dado.conceito)),
    exemplo: aspas(textoDe(dado.exemplo)),
    ...(dado.exemploTipo === "demonstracao" ? { exemploTipo: "demonstracao" as const } : {}),
    ...(passos.length > 0 ? { passos } : {}),
    ...(recurso && recursoValido(recurso) ? { recurso } : {}),
    ...(falas.length > 0 ? { falas } : {}),
    origem,
    exercicio: exercicios[0],
    ...(extras.length > 0 ? { extras } : {}),
    ...(pratica && praticaValida(pratica) ? { pratica } : {}),
    ...(outroJeito ? { outroJeito } : {}),
  };
  if (conteudoValido(conteudo)) return conteudo;
  // Se algo opcional não fechou, a lição ainda vale só com o essencial.
  const essencial: ConteudoLicao = {
    objetivo: textoDe(dado.objetivo),
    conceito: textoDe(dado.conceito),
    exemplo: textoDe(dado.exemplo),
    origem,
    exercicio: exercicios[0],
  };
  return conteudoValido(essencial) ? essencial : null;
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
