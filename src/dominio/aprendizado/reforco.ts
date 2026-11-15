import type { Opcao } from "@studoo/contratos";
import { avaliarResposta, normalizarResposta, type ExercicioInterno } from "./plano";

/*
 * Reforço sem IA (modo demonstração e reserva): em vez de uma pergunta genérica, uma pergunta mais simples sobre o mesmo
 * ponto do exercício que a pessoa errou, com a explicação específica do erro.
 * - escolha: só duas opções (a certa e a que a pessoa marcou);
 * - lacuna: a resposta certa e a que a pessoa escreveu;
 * - verdadeiro ou falso: só o valor, sem a justificativa;
 * - ordenar: qual item vem primeiro;
 * - associar: o par de um item (o que a pessoa ligou errado);
 * - aberta: qual ideia a resposta precisa trazer.
 */

export type ReforcoSimples = { motivo: string; conceito: string; exemplo: string; exercicio: ExercicioInterno };

function hash(valor: string): number {
  let resultado = 0x811c9dc5;
  for (const caractere of valor) resultado = Math.imul(resultado ^ caractere.codePointAt(0)!, 0x01000193) >>> 0;
  return resultado;
}

/** Escolha com a certa numa posição que varia (sempre a mesma para o mesmo enunciado). */
function escolha(enunciado: string, certa: string, erradas: string[], retornoErro: string): ExercicioInterno {
  // Sem opções repetidas (a certa fica sempre, na frente, até o giro).
  const vistas = new Set<string>();
  const textos = [certa, ...erradas].filter((texto) => {
    const chave = normalizarResposta(texto);
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  }).slice(0, 3);
  const deslocamento = hash(enunciado) % textos.length;
  const girados = [...textos.slice(deslocamento), ...textos.slice(0, deslocamento)];
  const opcoes: Opcao[] = girados.map((texto, posicao) => ({ id: "abc"[posicao], texto: texto.slice(0, 400) }));
  return {
    tipo: "multipla_escolha",
    enunciado: enunciado.slice(0, 600),
    opcoes,
    gabarito: [opcoes[girados.indexOf(certa)].id],
    feedbackCorreto: "Isso! Você pegou a ideia.",
    feedbackIncorreto: retornoErro,
  };
}

/**
 * Qual exercício da lição a resposta errada responde (a resposta é válida para ele e está errada). Os formatos com
 * resposta estruturada vêm antes: um texto qualquer também “vale” como resposta de lacuna ou aberta.
 */
export function exercicioDaResposta(exercicios: readonly ExercicioInterno[], resposta: string | null): ExercicioInterno {
  if (resposta) {
    const livre = (exercicio: ExercicioInterno) => exercicio.tipo === "lacuna" || exercicio.tipo === "aberta";
    const candidatos = [...exercicios.filter((exercicio) => !livre(exercicio)), ...exercicios.filter(livre)];
    const errado = candidatos.find((exercicio) => avaliarResposta(exercicio, resposta)?.correta === false);
    if (errado) return errado;
  }
  return exercicios[0];
}

/** Para citar uma opção dentro de uma frase: sem a pontuação final dela (“Eu sou do Brasil.” vira “Eu sou do Brasil”). */
const citar = (texto: string) => texto.trim().replace(/[.!?;:]+$/u, "");

export function reforcoDoExercicio(exercicio: ExercicioInterno, resposta: string | null, exemplo: string): ReforcoSimples {
  let motivo = "Vamos por um caminho mais curto: uma pergunta mais simples sobre o mesmo ponto.";
  const conceito = exercicio.feedbackIncorreto;
  const erro = exercicio.feedbackIncorreto;
  let simples: ExercicioInterno;
  switch (exercicio.tipo) {
    case "multipla_escolha": {
      const certa = exercicio.opcoes.find(({ id }) => id === exercicio.gabarito[0])!;
      const marcada = exercicio.opcoes.find(({ id }) => id === resposta && id !== certa.id) ?? exercicio.opcoes.find(({ id }) => id !== certa.id)!;
      simples = escolha(`Agora com duas opções: ${exercicio.enunciado}`, certa.texto, [marcada.texto], erro);
      if (resposta === marcada.id) motivo = `Você marcou “${citar(marcada.texto)}”. Agora são só duas opções: compare com calma.`;
      break;
    }
    case "lacuna": {
      const frase = exercicio.trecho ? ` ${exercicio.trecho}` : "";
      const escrita = resposta?.trim();
      const outra = escrita && normalizarResposta(escrita) !== normalizarResposta(exercicio.gabarito[0]) ? escrita : "Não sei ainda";
      simples = escolha(`Qual resposta completa a frase?${frase}`, exercicio.gabarito[0], [outra], erro);
      if (escrita) motivo = `Você escreveu “${citar(escrita)}”. Veja qual das duas respostas completa a frase.`;
      break;
    }
    case "verdadeiro_falso": {
      const verdadeira = exercicio.gabarito[0] === "verdadeiro";
      simples = escolha(`Esqueça o porquê por enquanto. A frase “${exercicio.afirmacao}” é…`, verdadeira ? "Verdadeira" : "Falsa",
        [verdadeira ? "Falsa" : "Verdadeira"], erro);
      motivo = "Um passo de cada vez: primeiro, só decida se a frase é verdadeira ou falsa.";
      break;
    }
    case "ordenar": {
      const textos = exercicio.gabarito.map((id) => exercicio.itens.find((item) => item.id === id)!.texto);
      simples = escolha("Comece pelo começo: qual destes vem primeiro?", textos[0], [textos.at(-1)!, textos[Math.floor(textos.length / 2)]], erro);
      motivo = "Vamos por partes: antes da ordem inteira, só o primeiro passo.";
      break;
    }
    case "associar": {
      const pares = exercicio.gabarito.map((par) => par.split("=") as [string, string]);
      const escolhidos = new Map((resposta ?? "").split(",").map((par) => par.split("=") as [string, string]));
      const [esquerda, direita] = pares.find(([item, certo]) => escolhidos.has(item) && escolhidos.get(item) !== certo) ?? pares[0];
      const texto = (lista: readonly Opcao[], id: string) => lista.find((item) => item.id === id)?.texto ?? "";
      const outros = pares.filter(([item]) => item !== esquerda).map(([, id]) => texto(exercicio.direita, id));
      simples = escolha(`Um par de cada vez: qual é o par de “${texto(exercicio.esquerda, esquerda)}”?`, texto(exercicio.direita, direita), outros, erro);
      const ligado = escolhidos.get(esquerda);
      if (ligado && ligado !== direita && texto(exercicio.direita, ligado)) {
        motivo = `Você ligou “${citar(texto(exercicio.esquerda, esquerda))}” a “${citar(texto(exercicio.direita, ligado))}”. Vamos ver só esse par.`;
      }
      break;
    }
    case "aberta": {
      const ideia = exercicio.criterios?.[0] ?? exercicio.gabarito[0].split("|")[0];
      simples = escolha("Qual destas ideias uma boa resposta precisa trazer?", ideia,
        ["Repetir o enunciado com outras palavras", "Dizer que é importante, sem explicar por quê"], erro);
      motivo = `Faltou uma ideia-chave na sua resposta. Vamos ver qual ela é.`;
      break;
    }
  }
  return { motivo, conceito, exemplo, exercicio: simples };
}
