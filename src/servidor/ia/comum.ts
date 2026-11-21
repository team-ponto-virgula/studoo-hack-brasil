import { TIPOS_TRECHO, repararBarrasDoJson, type Recurso, type TipoTrecho } from "@studoo/contratos";
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
import type { EventoEstrutura } from "./gerador";
import {
  esquemaDaResolucaoOuNula,
  esquemaDoVisual,
  esquemaDoVisualOuNulo,
  instrucoesDeMatematica,
  lerFiguraDoExercicio,
  lerResolucaoDoModelo,
  lerVisuaisDoModelo,
  relatoDaMatematica,
  type RelatoDaMatematica,
} from "./matematica";
import { instrucoesDeOrdem } from "./ordem";

export const TEMPO_ESTRUTURA_MS = 45_000;
export const TEMPO_CONTEUDO_MS = 40_000;
/**
 * A lição de matemática leva fórmulas, figuras e a resolução em passos: a resposta é bem maior (de 2 a 3 vezes), e o pedido ganha prazo
 * próprio. Fica abaixo dos 75 s do aceite para sobrar tempo ao pedido sem matemática, que é a volta quando este não fecha.
 */
export const TEMPO_CONTEUDO_DE_MATEMATICA_MS = 50_000;
export const TITULO_MAXIMO = 120;

/** Valida URL base: só aceita HTTPS (ou HTTP no próprio computador, para testes). */
export function validarBaseUrl(bruto: string | undefined, padrao: string): string | null {
  const base = (bruto?.trim() || padrao).replace(/\/+$/, "");
  try {
    const url = new URL(base);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
    return base;
  } catch {
    return null;
  }
}

/** Junta o sinal do pedido com um tempo-limite; diz depois se o fim foi da pessoa (cancelou) ou do relógio. */
export function sinalComPrazo(sinal: AbortSignal, ms: number) {
  const prazo = AbortSignal.timeout(ms);
  return { sinal: AbortSignal.any([sinal, prazo]), estourou: () => prazo.aborted && !sinal.aborted };
}

export function aparar(texto: string, maximo: number) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}…`;
}

/**
 * Tenta extrair JSON mesmo se o modelo envolver em cercas de markdown. Com `comMatematica`, a barra do LaTeX que o modelo não dobrou
 * (`\frac`, `\div`, `\resposta`) é consertada antes do parse: sem isso, `\frac` vira uma quebra de página e `\div`, um erro.
 */
export function analisarJson(bruto: string, comMatematica = false): unknown {
  const limpo = bruto.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!limpo) throw new Error("json_vazio");
  return JSON.parse(comMatematica ? repararBarrasDoJson(limpo) : limpo);
}

/** Uma linha JSON do modelo, aceitando cercas de código, vírgulas no fim e marcadores de lista. */
export function lerLinha(bruta: string): { tipo: string; titulo: string; objetivo?: string; resumo?: string } | null {
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

export const instrucoesDaEstrutura = [
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

/**
 * Transforma as linhas do modelo em eventos válidos para o serviço: o plano primeiro, os índices calculados aqui
 * (o modelo só dá tipo e título) e cada trecho emitido junto com a sua primeira lição, para nunca haver trecho vazio.
 */
export function criarMontador(objetivo: string) {
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

export const esquemaDaLicao = objetoEstrito({
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

/**
 * O esquema da lição de matemática: o de sempre, mais `visuais` e `resolucao` (antes dos exercícios, para o modelo decidir a figura e o
 * exemplo resolvido antes de escrever as perguntas) e `visual` em cada exercício (logo depois do enunciado). Mesmos campos obrigatórios,
 * `null` onde não se aplica. As figuras vêm como dados; quem desenha é o Studoo.
 */
const { exercicios: _exercicios, ...camposDaLicao } = esquemaDaLicao.properties as Record<string, unknown>;
const { tipo: _tipo, enunciado: _enunciado, ...camposDoExercicio } = esquemaDoExercicio.properties as Record<string, unknown>;
export const esquemaDaLicaoDeMatematica = objetoEstrito({
  ...camposDaLicao,
  visuais: { type: ["array", "null"], items: esquemaDoVisual },
  resolucao: esquemaDaResolucaoOuNula,
  exercicios: {
    type: "array",
    items: objetoEstrito({
      tipo: (esquemaDoExercicio.properties as Record<string, unknown>).tipo,
      enunciado: textoJson,
      visual: esquemaDoVisualOuNulo,
      ...camposDoExercicio,
    }),
  },
});

export const instrucoesDaLicao = [
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
  "- Formato das listas: cada item de opcoes, itens, esquerda e direita é um objeto com id e texto, nunca um texto solto. Exemplo de ordenar: \"itens\": [{\"id\": \"i1\", \"texto\": \"Lave as mãos\"}, {\"id\": \"i2\", \"texto\": \"Separe os ingredientes\"}, {\"id\": \"i3\", \"texto\": \"Acenda o fogo\"}]. Exemplo de associar: \"esquerda\": [{\"id\": \"e1\", \"texto\": \"6ª corda\"}, {\"id\": \"e2\", \"texto\": \"1ª corda\"}], \"direita\": [{\"id\": \"d1\", \"texto\": \"Mi grave\"}, {\"id\": \"d2\", \"texto\": \"Mi agudo\"}].",
  "- feedbackCorreto explica por que a resposta está certa; feedbackIncorreto explica o erro e mostra o caminho certo, com gentileza.",
  "- Se o título da lição começar com \"Revisão\", misture conceitos das lições anteriores.",
  "Não use markdown nem emojis. Não peça dados pessoais. Nada de práticas perigosas.",
].join("\n");

/** As instruções da lição de matemática: as de sempre e o bloco de notação, figuras e resolução. */
export const instrucoesDaLicaoDeMatematica = `${instrucoesDaLicao}\n${instrucoesDeMatematica}`;

export function promptDaLicao(esqueleto: EsqueletoPlano, fluxo: number, licao: number): string {
  const titulos = esqueleto.fluxos.flatMap((trecho) => trecho.licoes.map(({ titulo }) => titulo));
  const posicao = esqueleto.fluxos.slice(0, fluxo).reduce((soma, trecho) => soma + trecho.licoes.length, 0) + licao;
  const lista = titulos.map((titulo, indice) => `${indice + 1}. ${titulo}${indice === posicao ? "  <- esta lição" : ""}`).join("\n");
  return `Objetivo da pessoa: ${esqueleto.objetivo}\nTrilha: ${esqueleto.titulo}\nLições da trilha, em ordem:\n${lista}\n\nEscreva a lição ${posicao + 1}: "${titulos[posicao]}".`;
}

/** Texto aparado, ou vazio. */
function textoDe(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Alternativas que vieram em lista (`["fogo baixo", "brando"]`) viram o texto com `|` que o formato pede. */
function alternativasDe(valor: unknown) {
  return Array.isArray(valor) ? valor.map(textoDe).filter(Boolean).join("|") : textoDe(valor);
}

/**
 * Opções com texto, até `maximo`, com ids refeitos quando vierem repetidos, vazios ou longos. Cada item pode vir como
 * objeto `{ id, texto }` ou como texto puro (a DeepSeek, sem esquema imposto, às vezes manda `["passo 1", "passo 2"]`):
 * o texto é o próprio item e o id é refeito.
 */
function opcoesDe(valor: unknown, maximo: number, prefixo: string): { id: string; texto: string; idOriginal: string }[] {
  const brutas = Array.isArray(valor) ? valor : [];
  const opcoes = brutas
    .map((opcao) => typeof opcao === "string"
      ? { idOriginal: "", texto: textoDe(opcao) }
      : { idOriginal: textoDe((opcao as { id?: unknown })?.id), texto: textoDe((opcao as { texto?: unknown })?.texto) })
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
    const juntos = alternativasDe(termos).split("|").map((termo) => termo.trim()).filter((termo) => termo && !vale(termo)).join("|");
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
  return lerExercicio(bruto).exercicio;
}

const TIPOS_EXERCICIO = ["multipla_escolha", "lacuna", "ordenar", "associar", "verdadeiro_falso", "aberta"];

/**
 * O exercício normalizado e válido, ou o motivo de não fechar, sem conteúdo: `<tipo>:<campo>` (como `ordenar:itens`),
 * `<tipo>:validacao` (normalizou, mas não passa nas regras do domínio), `tipo` (tipo desconhecido) ou `formato`.
 */
function lerExercicio(bruto: unknown): { exercicio: ExercicioInterno | null; motivo?: string; figura?: { enviada: boolean; aceita: boolean; motivo?: string } } {
  const lido = montarExercicio(bruto);
  if (typeof lido === "string") return { exercicio: null, motivo: lido };
  if (!exercicioValido(lido)) return { exercicio: null, motivo: `${(lido as ExercicioInterno).tipo}:validacao` };
  // A figura do enunciado (matemática, spec 15) se valida sozinha: a que não vale some, e o exercício fica como sempre foi.
  // A que mostra a resposta (o par da opção certa já é um ponto rotulado dela) também some, e o relato diz qual ponto (marco 13).
  const figura = lerFiguraDoExercicio((bruto as { visual?: unknown }).visual, lido);
  if (!figura.enviada) return { exercicio: lido };
  return {
    exercicio: figura.figura ? { ...lido, visual: figura.figura } : lido,
    figura: { enviada: true, aceita: figura.figura !== undefined, ...(figura.motivo ? { motivo: figura.motivo } : {}) },
  };
}

function montarExercicio(bruto: unknown): ExercicioInterno | string {
  if (typeof bruto !== "object" || bruto === null) return "formato";
  const exercicio = bruto as Record<string, unknown>;
  // Na aberta, cada grupo pode vir como lista de alternativas; os outros tipos usam o texto como veio.
  const lerItem = exercicio.tipo === "aberta" ? alternativasDe : textoDe;
  const gabarito = Array.isArray(exercicio.gabarito)
    ? Array.from(new Set(exercicio.gabarito.map(lerItem).filter((valor) => valor && valor.length <= 200)))
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
      if (opcoes.length < 2) return "multipla_escolha:opcoes";
      const certa = acharOpcao(opcoes, gabarito[0]);
      return certa ? { tipo: "multipla_escolha", ...base, opcoes: limparOpcoes(opcoes), gabarito: [certa.id] } : "multipla_escolha:gabarito";
    }
    case "ordenar": {
      // O modelo manda os itens já na ordem certa; o app embaralha ao mostrar.
      const itens = opcoesDe(exercicio.itens, 7, "i");
      return itens.length >= 3 ? { tipo: "ordenar", ...base, itens: limparOpcoes(itens), gabarito: itens.map(({ id }) => id) } : "ordenar:itens";
    }
    case "associar": {
      // direita[i] é o par de esquerda[i].
      const esquerda = opcoesDe(exercicio.esquerda, 6, "e");
      const direita = opcoesDe(exercicio.direita, 6, "d");
      if (esquerda.length < 2 || esquerda.length !== direita.length) return "associar:esquerda_direita";
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
      // Sem afirmacao, a frase a julgar às vezes vem no trecho: ela vira a afirmação (e o trecho sai, para não repetir).
      const afirmacao = textoDe(exercicio.afirmacao) || trecho;
      if (!afirmacao) return "verdadeiro_falso:afirmacao";
      if (justificativas.length < 2) return "verdadeiro_falso:opcoes";
      if (!certa || (valor !== "verdadeiro" && valor !== "falso")) return "verdadeiro_falso:gabarito";
      if (!textoDe(exercicio.afirmacao)) {
        const { trecho: _trecho, trechoTipo: _tipo, ...semTrecho } = base as typeof base & { trecho?: string; trechoTipo?: TipoTrecho };
        return { tipo: "verdadeiro_falso", ...semTrecho, afirmacao, justificativas: limparOpcoes(justificativas), gabarito: [valor, certa.id] };
      }
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
      return TIPOS_EXERCICIO.includes(String(exercicio.tipo)) ? `${String(exercicio.tipo)}:formato` : "tipo";
  }
}

/** Instrução para a segunda tentativa, a partir do motivo (sem conteúdo): o que veio fora do formato e como corrigir. */
export function correcaoDoFormato(motivo: string): string {
  const dicas = new Set<string>();
  for (const parte of motivo.split(";")) {
    const campo = parte.split(":").slice(1).join(":");
    if (/itens|esquerda|direita|opcoes/.test(campo)) dicas.add("cada item de opcoes, itens, esquerda e direita é um objeto {\"id\": \"...\", \"texto\": \"...\"}, nunca um texto solto; ordenar tem de 3 a 6 itens e associar tem esquerda e direita com o mesmo número de itens");
    if (/gabarito/.test(campo)) dicas.add("o gabarito aponta o id de uma opção que existe (no verdadeiro_falso, [\"verdadeiro\" ou \"falso\", id da justificativa])");
    if (/afirmacao/.test(campo)) dicas.add("verdadeiro_falso tem afirmacao preenchida");
    if (parte === "json") dicas.add("a resposta é um único objeto json válido, sem texto fora dele");
    if (parte === "licao") dicas.add("objetivo, conceito e exemplo vêm preenchidos");
  }
  if (dicas.size === 0) dicas.add("todos os campos seguem o formato do exemplo");
  return `A resposta anterior veio fora do formato (${motivo}). Escreva a lição completa de novo, no formato pedido: ${[...dicas].join("; ")}.`;
}

/** O resultado da normalização com os motivos (sem conteúdo), para o registro e para a segunda tentativa. */
export type LicaoNormalizada = {
  conteudo: ConteudoLicao | null;
  /** Por que a lição não fechou (só quando `conteudo` é null). */
  motivo?: string;
  /** Exercícios descartados de uma lição aceita (`principal:ordenar:itens`, `extra2:associar:esquerda_direita`). */
  descartados: string[];
  /** O tipo do extra que virou principal quando o principal não fechou. */
  promovido?: string;
  /** O que a matemática da lição deu (visuais, figuras, resolução). Só quando o modelo mandou algo disso. */
  matematica?: RelatoDaMatematica;
};

/**
 * Ajusta o que o modelo devolveu ao formato interno: campos nulos saem, ids são refeitos quando preciso, o gabarito
 * segue os ids, e recursos, falas e prática fora do formato são descartados (a lição continua válida sem eles).
 * Aceita também o formato antigo, com um `exercicio` só.
 */
export function normalizarConteudo(bruto: unknown, origem: string): ConteudoLicao | null {
  return normalizarLicao(bruto, origem).conteudo;
}

export function normalizarLicao(bruto: unknown, origem: string): LicaoNormalizada {
  if (typeof bruto !== "object" || bruto === null) return { conteudo: null, motivo: "json", descartados: [] };
  const dado = bruto as Record<string, unknown>;
  const brutos = Array.isArray(dado.exercicios) ? dado.exercicios : dado.exercicio ? [dado.exercicio] : [];
  const lidos = brutos.slice(0, 3).map(lerExercicio);
  const rotulo = (indice: number) => (indice === 0 ? "principal" : `extra${indice}`);
  const descartados = lidos.flatMap((lido, indice) => (lido.exercicio ? [] : [`${rotulo(indice)}:${lido.motivo}`]));
  const validos = lidos.flatMap((lido) => (lido.exercicio ? [lido.exercicio] : []));
  // O principal é o primeiro exercício que fecha: se o primeiro da lista não fechar, o primeiro extra válido sobe no
  // lugar dele. A lição só é rejeitada quando nenhum exercício fecha.
  if (validos.length === 0) return { conteudo: null, motivo: descartados.join(";") || "principal:ausente", descartados: [] };
  const [principal, ...extras] = validos;
  const promovido = lidos[0]?.exercicio ? undefined : principal.tipo;

  // Matemática (spec 15): os visuais da lição, a resolução "Resolva comigo" e a figura do enunciado de cada exercício que fechou. Cada
  // coisa se valida sozinha e a que não vale some (o motivo vai no relato; no registro, só o código, sem conteúdo): a lição fica como
  // ficaria sem ela. Sem nada disso no que o modelo mandou, a lição sai exatamente como sempre saiu.
  const visuaisLidos = lerVisuaisDoModelo(dado.visuais);
  const resolucaoLida = lerResolucaoDoModelo(dado.resolucao);
  const figuras = lidos.flatMap((lido, indice) => (lido.exercicio && lido.figura ? [{ onde: rotulo(indice), ...lido.figura }] : []));
  const matematica: Pick<ConteudoLicao, "visuais" | "resolucao"> = {
    ...(visuaisLidos.visuais ? { visuais: visuaisLidos.visuais } : {}),
    ...(resolucaoLida.resolucao ? { resolucao: resolucaoLida.resolucao } : {}),
  };
  const relato = relatoDaMatematica(visuaisLidos, figuras, resolucaoLida);
  if (relato) {
    if (relato.visuais.aceitos < relato.visuais.enviados) descartados.push("visuais:recusados");
    for (const figura of figuras) if (figura.enviada && !figura.aceita) descartados.push(`${figura.onde}:visual`);
    if (relato.resolucao.enviada && !relato.resolucao.aceita) descartados.push("resolucao:recusada");
  }

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
    exercicio: principal,
    ...(extras.length > 0 ? { extras } : {}),
    ...(pratica && praticaValida(pratica) ? { pratica } : {}),
    ...(outroJeito ? { outroJeito } : {}),
    ...matematica,
  };
  const resultado = (valido: ConteudoLicao): LicaoNormalizada => ({
    conteudo: valido,
    descartados,
    ...(promovido ? { promovido } : {}),
    ...(relato ? { matematica: relato } : {}),
  });
  if (conteudoValido(conteudo)) return resultado(conteudo);
  // Se algo opcional não fechou, a lição ainda vale só com o essencial.
  const essencial: ConteudoLicao = {
    objetivo: textoDe(dado.objetivo),
    conceito: textoDe(dado.conceito),
    exemplo: textoDe(dado.exemplo),
    origem,
    exercicio: principal,
    ...(extras.length > 0 ? { extras } : {}),
    ...matematica,
  };
  if (conteudoValido(essencial)) return resultado(essencial);
  const soPrincipal: ConteudoLicao = { objetivo: textoDe(dado.objetivo), conceito: textoDe(dado.conceito), exemplo: textoDe(dado.exemplo), origem, exercicio: principal, ...matematica };
  return conteudoValido(soPrincipal) ? resultado(soPrincipal) : { conteudo: null, motivo: "licao", descartados: [] };
}
