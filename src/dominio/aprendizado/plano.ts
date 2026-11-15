import type { ExercicioPublico, Fala, Opcao, Pratica, Progresso, Recurso, ReferenciaMaterial } from "@studoo/contratos";
import { LIMITES_RESPOSTA, TIPOS_TRECHO, inferirTipoTrecho, tamanhoDaResposta } from "@studoo/contratos";

/**
 * Exercício como fica guardado: o que a pessoa vê, mais o gabarito e os retornos.
 * - `lacuna`: as respostas aceitas;
 * - `multipla_escolha`: o id da opção certa;
 * - `ordenar`: os ids na ordem certa;
 * - `associar`: os pares `esquerda=direita`;
 * - `verdadeiro_falso`: `verdadeiro` ou `falso` e o id da justificativa certa;
 * - `aberta`: grupos de palavras-chave (`termo|sinônimo|radical`), um por ideia que a resposta precisa trazer.
 */
export type ExercicioInterno = ExercicioPublico & {
  gabarito: string[];
  feedbackCorreto: string;
  feedbackIncorreto: string;
  /** Resposta aberta: o que uma boa resposta traz, um critério por grupo do gabarito. */
  criterios?: string[];
  /** Resposta aberta: um exemplo de boa resposta, mostrado depois da correção. */
  modelo?: string;
  /**
   * Resposta aberta: os critérios (pelo índice do gabarito) sem os quais a resposta não passa, mesmo com os outros: o ponto
   * da lição (“I'd like”, e não “I like”).
   */
  essenciais?: number[];
  /** Lacuna: a grafia é o que se ensina (palavra de outro idioma, ortografia). Sem tolerância a deslize de digitação. */
  exata?: boolean;
  /**
   * Resposta aberta e lacuna: erros comuns, cada um com o seu aviso (“I want” soa brusco num pedido; “chave” é o nome
   * popular da tarraxa). Quando a resposta traz um deles (`termos`, como no gabarito: `i want|i wanna`), o retorno diz
   * exatamente isso. Na lacuna, vale a resposta inteira, e só quando ela está errada.
   */
  armadilhas?: { termos: string; aviso: string }[];
};

export type ConteudoLicao = {
  referencias?: ReferenciaMaterial[];
  objetivo: string;
  conceito: string;
  exemplo: string;
  exemploTipo?: "exemplo" | "demonstracao";
  passos?: string[];
  recurso?: Recurso;
  falas?: Fala[];
  origem: string;
  exercicio: ExercicioInterno;
  /** Exercícios além do principal (até 2). */
  extras?: ExercicioInterno[];
  pratica?: Pratica;
  /**
   * Outro jeito de entender a mesma ideia (uma analogia, uma regra prática), escrito para o reforço sem IA. Fica no
   * servidor: a lição pública não o traz.
   */
  outroJeito?: string;
  /** Erros comuns ao explicar a lição (“I here”, sem o verbo), para o retorno do "Explique com suas palavras" sem IA. */
  armadilhas?: { termos: string; aviso: string }[];
};

export type LicaoInterna = ConteudoLicao & { titulo: string };

export type PlanoInterno = {
  titulo: string;
  objetivo: string;
  origem: string;
  fluxos: { titulo: string; licoes: LicaoInterna[] }[];
};

/** Resultado da correção, antes do comprovante. */
export type ResultadoAvaliacao = {
  correta: boolean;
  feedback: string;
  observacao?: string;
  certos?: string[];
  criterios?: { texto: string; atendido: boolean }[];
  modelo?: string;
  simulado?: boolean;
};

const ID = /^[\w-]{1,20}$/;
const IMAGEM = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const IDIOMA = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function textoAte(valor: unknown, maximo: number): valor is string {
  return texto(valor) && valor.length <= maximo;
}

function opcional(valor: unknown, validar: (item: unknown) => boolean) {
  return valor === undefined || validar(valor);
}

function listaValida<T>(valor: unknown, validar: (item: unknown) => item is T): valor is T[] {
  return Array.isArray(valor) && valor.length > 0 && valor.every(validar);
}

function inteiroEntre(valor: unknown, minimo: number, maximo: number): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor >= minimo && valor <= maximo;
}

function opcaoValida(valor: unknown): valor is Opcao {
  return objeto(valor) && typeof valor.id === "string" && ID.test(valor.id) && textoAte(valor.texto, 400);
}

/** Opções com ids únicos, entre `minimo` e `maximo`. */
function opcoesValidas(valor: unknown, minimo: number, maximo: number): valor is Opcao[] {
  return Array.isArray(valor) && valor.length >= minimo && valor.length <= maximo && valor.every(opcaoValida) &&
    new Set(valor.map(({ id }) => id)).size === valor.length;
}

/** Até quatro armadilhas, cada uma com os termos e o aviso. */
function armadilhasValidas(valor: unknown): boolean {
  return opcional(valor, (armadilhas) => Array.isArray(armadilhas) && armadilhas.length <= 4 &&
    armadilhas.every((item) => objeto(item) && textoAte(item.termos, 200) && textoAte(item.aviso, 300)));
}

export function falaValida(valor: unknown): valor is Fala {
  return objeto(valor) && textoAte(valor.texto, 300) && typeof valor.idioma === "string" && IDIOMA.test(valor.idioma) &&
    opcional(valor.traducao, (item) => textoAte(item, 300)) && opcional(valor.pronuncia, (item) => textoAte(item, 160));
}

/** Nome, as seis casas (de -1, abafada, a 15) e, se houver, os dedos (0 a 4) de um acorde. */
function acordeValido(valor: Record<string, unknown>): boolean {
  return textoAte(valor.nome, 20) && Array.isArray(valor.casas) && valor.casas.length === 6 &&
    valor.casas.every((casa) => inteiroEntre(casa, -1, 15)) && valor.casas.some((casa) => casa >= 0) &&
    opcional(valor.dedos, (dedos) => Array.isArray(dedos) && dedos.length === 6 && dedos.every((dedo) => inteiroEntre(dedo, 0, 4)));
}

export function recursoValido(valor: unknown): valor is Recurso {
  if (!objeto(valor)) return false;
  switch (valor.tipo) {
    case "acorde":
      return acordeValido(valor) && opcional(valor.batida, (batida) => typeof batida === "boolean") &&
        opcional(valor.anterior, (anterior) => objeto(anterior) && acordeValido(anterior));
    case "linha_do_tempo":
      return Array.isArray(valor.eventos) && valor.eventos.length >= 2 && valor.eventos.length <= 8 &&
        valor.eventos.every((evento) => objeto(evento) && textoAte(evento.quando, 40) && textoAte(evento.texto, 200));
    case "fracao":
      return inteiroEntre(valor.denominador, 1, 12) && inteiroEntre(valor.numerador, 0, valor.denominador) &&
        opcional(valor.rotulo, (rotulo) => textoAte(rotulo, 40));
    case "imagem":
      return typeof valor.src === "string" && valor.src.length <= 700_000 && IMAGEM.test(valor.src) && textoAte(valor.descricao, 200) &&
        opcional(valor.fonte, (fonte) => textoAte(fonte, 40));
    default:
      return false;
  }
}

/** O som de referência da prática: um rótulo curto e as seis casas (de -1, abafada, a 12), com ao menos uma corda que soa. */
export function somValido(valor: unknown): valor is NonNullable<Pratica["som"]> {
  return objeto(valor) && textoAte(valor.rotulo, 60) && Array.isArray(valor.casas) && valor.casas.length === 6 &&
    valor.casas.every((casa) => inteiroEntre(casa, -1, 12)) && valor.casas.some((casa) => casa >= 0);
}

export function praticaValida(valor: unknown): valor is Pratica {
  return objeto(valor) && textoAte(valor.tarefa, 600) && inteiroEntre(valor.minutos, 1, 30) &&
    opcional(valor.passos, (passos) => Array.isArray(passos) && passos.length > 0 && passos.length <= 8 && passos.every((passo) => textoAte(passo, 200))) &&
    opcional(valor.dica, (dica) => textoAte(dica, 300)) && opcional(valor.som, somValido);
}

/** Os pares `esquerda=direita` de um gabarito de associar. */
function lerPares(valores: readonly string[]) {
  return valores.map((par) => {
    const [esquerda, direita, ...resto] = par.split("=");
    return resto.length === 0 ? { esquerda: esquerda?.trim() ?? "", direita: direita?.trim() ?? "" } : { esquerda: "", direita: "" };
  });
}

/** Grupos de palavras-chave da resposta aberta: cada grupo lista alternativas separadas por `|`. */
function gruposDoGabarito(gabarito: readonly string[]) {
  return gabarito.map((grupo) => grupo.split("|").map((termo) => normalizarResposta(termo)).filter(Boolean));
}

export function exercicioValido(valor: unknown): valor is ExercicioInterno {
  if (!objeto(valor) || !textoAte(valor.enunciado, 600) || !textoAte(valor.feedbackCorreto, 1200) ||
      !textoAte(valor.feedbackIncorreto, 1200) || !listaValida(valor.gabarito, (item): item is string => textoAte(item, 200))) {
    return false;
  }

  if (!opcional(valor.contexto, (item) => textoAte(item, 1200)) || !opcional(valor.trecho, (item) => textoAte(item, 1500)) ||
      !opcional(valor.exata, (item) => typeof item === "boolean") ||
      !opcional(valor.trechoTipo, (item) => TIPOS_TRECHO.includes(item as never)) || !opcional(valor.fala, falaValida)) {
    return false;
  }

  const gabarito = valor.gabarito;
  switch (valor.tipo) {
    case "lacuna":
      return armadilhasValidas(valor.armadilhas);
    case "multipla_escolha":
      return opcoesValidas(valor.opcoes, 2, 6) && gabarito.length === 1 && valor.opcoes.some(({ id }) => id === gabarito[0]);
    case "ordenar": {
      if (!opcoesValidas(valor.itens, 3, 7) || gabarito.length !== valor.itens.length) return false;
      const ids = new Set(valor.itens.map(({ id }) => id));
      return new Set(gabarito).size === gabarito.length && gabarito.every((id) => ids.has(id));
    }
    case "associar": {
      if (!opcoesValidas(valor.esquerda, 2, 6) || !opcoesValidas(valor.direita, 2, 6) || valor.esquerda.length !== valor.direita.length ||
          gabarito.length !== valor.esquerda.length) {
        return false;
      }
      const esquerda = new Set(valor.esquerda.map(({ id }) => id));
      const direita = new Set(valor.direita.map(({ id }) => id));
      const pares = lerPares(gabarito);
      return pares.every((par) => esquerda.has(par.esquerda) && direita.has(par.direita)) &&
        new Set(pares.map((par) => par.esquerda)).size === pares.length && new Set(pares.map((par) => par.direita)).size === pares.length;
    }
    case "verdadeiro_falso":
      return textoAte(valor.afirmacao, 400) && opcoesValidas(valor.justificativas, 2, 4) && gabarito.length === 2 &&
        (gabarito[0] === "verdadeiro" || gabarito[0] === "falso") && valor.justificativas.some(({ id }) => id === gabarito[1]);
    case "aberta":
      return inteiroEntre(valor.minimo, 10, 400) && gabarito.length <= 6 && gruposDoGabarito(gabarito).every((grupo) => grupo.length > 0) &&
        opcional(valor.criterios, (criterios) => Array.isArray(criterios) && criterios.length === gabarito.length && criterios.every((item) => textoAte(item, 200))) &&
        opcional(valor.modelo, (modelo) => textoAte(modelo, 1200)) &&
        opcional(valor.essenciais, (essenciais) => Array.isArray(essenciais) && essenciais.length <= gabarito.length &&
          essenciais.every((indice) => inteiroEntre(indice, 0, gabarito.length - 1))) &&
        armadilhasValidas(valor.armadilhas);
    default:
      return false;
  }
}

export function conteudoValido(valor: unknown): valor is ConteudoLicao {
  return objeto(valor) && texto(valor.objetivo) && texto(valor.conceito) &&
    texto(valor.exemplo) && texto(valor.origem) && exercicioValido(valor.exercicio) &&
    opcional(valor.extras, (extras) => Array.isArray(extras) && extras.length <= 2 && extras.every(exercicioValido)) &&
    opcional(valor.exemploTipo, (tipo) => tipo === "exemplo" || tipo === "demonstracao") &&
    opcional(valor.passos, (passos) => Array.isArray(passos) && passos.length > 0 && passos.length <= 10 && passos.every((passo) => textoAte(passo, 300))) &&
    opcional(valor.recurso, recursoValido) &&
    opcional(valor.falas, (falas) => Array.isArray(falas) && falas.length > 0 && falas.length <= 6 && falas.every(falaValida)) &&
    opcional(valor.pratica, praticaValida) &&
    opcional(valor.outroJeito, (outro) => textoAte(outro, 600)) &&
    armadilhasValidas(valor.armadilhas);
}

function licaoValida(valor: unknown): valor is LicaoInterna {
  return objeto(valor) && texto(valor.titulo) && conteudoValido(valor);
}

function fluxoValido(valor: unknown): valor is PlanoInterno["fluxos"][number] {
  return objeto(valor) && texto(valor.titulo) && listaValida(valor.licoes, licaoValida);
}

export function planoValido(valor: unknown): valor is PlanoInterno {
  return objeto(valor) && texto(valor.titulo) && texto(valor.objetivo) && texto(valor.origem) &&
    listaValida(valor.fluxos, fluxoValido);
}

/** Hash FNV-1a: embaralha sempre do mesmo jeito para o mesmo exercício (sem sorteio entre uma visita e outra). */
function hash(valor: string): number {
  let resultado = 0x811c9dc5;
  for (const caractere of valor) resultado = Math.imul(resultado ^ caractere.codePointAt(0)!, 0x01000193) >>> 0;
  return resultado;
}

/** Embaralha de forma determinística e garante que a ordem mostrada não seja a ordem certa. */
function embaralhar<T extends Opcao>(itens: readonly T[], certa: readonly string[], semente: string): T[] {
  const lista = [...itens];
  let valor = hash(semente);
  for (let indice = lista.length - 1; indice > 0; indice -= 1) {
    valor = (Math.imul(valor, 1664525) + 1013904223) >>> 0;
    const troca = valor % (indice + 1);
    [lista[indice], lista[troca]] = [lista[troca], lista[indice]];
  }
  if (lista.length > 1 && lista.every((item, indice) => item.id === certa[indice])) lista.push(lista.shift()!);
  return lista;
}

/** O exercício como a pessoa vê: sem gabarito nem retornos, com os itens embaralhados e o tipo do trecho definido. */
export function apresentarExercicio(exercicio: ExercicioInterno): ExercicioPublico {
  const { enunciado, contexto, trecho, fala } = exercicio;
  const trechoTipo = trecho ? exercicio.trechoTipo ?? inferirTipoTrecho(trecho) : undefined;
  const base = {
    enunciado,
    ...(contexto ? { contexto } : {}),
    ...(trecho ? { trecho, trechoTipo } : {}),
    ...(fala ? { fala } : {}),
  };
  const limpar = (opcoes: readonly Opcao[]) => opcoes.map(({ id, texto: valor }) => ({ id, texto: valor }));
  switch (exercicio.tipo) {
    case "multipla_escolha":
      return { tipo: "multipla_escolha", ...base, opcoes: limpar(exercicio.opcoes) };
    case "ordenar":
      return { tipo: "ordenar", ...base, itens: limpar(embaralhar(exercicio.itens, exercicio.gabarito, enunciado)) };
    case "associar": {
      const pares = lerPares(exercicio.gabarito);
      const certa = exercicio.esquerda.map((item) => pares.find((par) => par.esquerda === item.id)?.direita ?? "");
      return { tipo: "associar", ...base, esquerda: limpar(exercicio.esquerda), direita: limpar(embaralhar(exercicio.direita, certa, enunciado)) };
    }
    case "verdadeiro_falso":
      return { tipo: "verdadeiro_falso", ...base, afirmacao: exercicio.afirmacao, justificativas: limpar(exercicio.justificativas) };
    case "aberta":
      return { tipo: "aberta", ...base, minimo: exercicio.minimo };
    default:
      return { tipo: "lacuna", ...base };
  }
}

/**
 * Forma de comparar respostas: minúsculas, sem acento, sem aspas, com espaços simples e sem pontuação nas pontas.
 * Símbolos como `>=` ficam como estão.
 */
export function normalizarResposta(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[“”"'`´‘’]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,;:!?¡¿]+|[.,;:!?]+$/gu, "")
    .trim();
}

/** Como a pessoa escreveu, mas só com espaços simples e sem pontuação nas pontas (para comparar acentos). */
function compactar(valor: string): string {
  return valor.replace(/\s+/g, " ").trim().replace(/^[.,;:!?¡¿]+|[.,;:!?]+$/gu, "").trim();
}

const ARTIGO = /^(?:o|a|os|as|um|uma|uns|umas|the|an?)\s+/;

/**
 * Grafias que soam igual em português (ch e x, ç, ss e s, sc e xc antes de e/i, z e s entre vogais): “tarracha” e
 * “tarraxa” ficam iguais. Serve para aceitar a resposta com um aviso de grafia.
 */
function fonetica(valor: string): string {
  return normalizarResposta(valor.replace(/ç/giu, "s"))
    .replace(ARTIGO, "")
    .replace(/ch/g, "x")
    .replace(/[sx]c(?=[ei])/g, "s")
    .replace(/ss/g, "s")
    .replace(/(?<=[aeiou])z(?=[aeiou])/g, "s");
}

/** Distância de edição (inserir, apagar ou trocar uma letra), parando cedo quando passa do limite. */
export function distancia(a: string, b: string, limite = 3): number {
  if (Math.abs(a.length - b.length) > limite) return limite + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    let menor = i;
    for (let j = 1; j <= b.length; j += 1) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      menor = Math.min(menor, atual[j]);
    }
    if (menor > limite) return limite + 1;
    anterior = atual;
  }
  return anterior[b.length];
}

/**
 * Lacuna com tolerância: maiúsculas, acentos, aspas, pontuação nas pontas e artigo no começo não contam como erro.
 * Uma grafia que soa igual em português (“tarracha” por “tarraxa”) passa com um aviso de grafia. Em palavras de 5 letras
 * ou mais, um deslize de digitação (dois, a partir de 9 letras) também passa, com um aviso. Nada disso vale quando a
 * grafia é o que se ensina (`exata`). Números e símbolos (como `>=`) continuam exatos.
 */
function conferirLacuna(gabarito: readonly string[], resposta: string, exata = false, trecho?: string): { correta: boolean; observacao?: string } {
  const recebida = compactar(resposta).toLocaleLowerCase("pt-BR");
  const normalizada = normalizarResposta(resposta);
  const semArtigo = normalizada.replace(ARTIGO, "");
  for (const esperado of gabarito) {
    if (compactar(esperado).toLocaleLowerCase("pt-BR") === recebida) return { correta: true };
  }
  for (const esperado of gabarito) {
    const alvo = normalizarResposta(esperado);
    if (alvo === normalizada) {
      // Chegou aqui com os acentos diferentes (a comparação exata falhou): se a forma certa tem acento, vale o aviso.
      const acentuada = /\p{M}/u.test(esperado.normalize("NFD"));
      return acentuada ? { correta: true, observacao: `Atenção ao acento: escreve-se “${compactar(esperado)}”.` } : { correta: true };
    }
    if (semArtigo && alvo.replace(ARTIGO, "") === semArtigo) return { correta: true };
  }
  const recebidaFonetica = fonetica(resposta);
  for (const esperado of exata ? [] : gabarito) {
    const alvo = normalizarResposta(esperado).replace(ARTIGO, "");
    if (alvo.length < 4 || !/^[\p{L} ]+$/u.test(alvo)) continue;
    if (fonetica(esperado) === recebidaFonetica) {
      return { correta: true, observacao: `Atenção à grafia: escreve-se “${compactar(esperado)}”.` };
    }
  }
  for (const esperado of exata ? [] : gabarito) {
    const alvo = normalizarResposta(esperado).replace(ARTIGO, "");
    if (alvo.length < 5 || !/^[\p{L} ]+$/u.test(alvo)) continue;
    const limite = alvo.length >= 9 ? 2 : 1;
    if (distancia(semArtigo, alvo, limite) <= limite || distancia(recebidaFonetica, fonetica(esperado), limite) <= limite) {
      return { correta: true, observacao: `Quase igual: a forma certa é “${compactar(esperado)}”.` };
    }
  }
  // Escreveu a frase em volta junto (“how much” na lacuna de “How ___ is…”): vale, com o aviso de que basta o que falta.
  const semContexto = trecho ? tirarContexto(resposta, trecho) : null;
  if (semContexto && conferirLacuna(gabarito, semContexto, exata).correta) {
    return { correta: true, observacao: "Certo! Na lacuna, basta escrever o que falta." };
  }
  // Uma palavra de cortesia junto (“repeat please”) não tira o acerto: a palavra certa está lá.
  const semCortesia = tirarCortesia(semContexto ?? resposta);
  if (semCortesia && conferirLacuna(gabarito, semCortesia, exata).correta) {
    return { correta: true, observacao: "Certo! Na lacuna, basta escrever o que falta." };
  }
  // Com a lacuna no fim da frase, um complemento depois da palavra (“repeat it”, “say that again”) também é inglês certo.
  const semComplemento = tirarComplemento(semCortesia ?? semContexto ?? resposta, trecho);
  if (semComplemento && conferirLacuna(gabarito, semComplemento, exata).correta) {
    return { correta: true, observacao: "Certo! Na lacuna, basta escrever o que falta." };
  }
  // Quando a grafia é a lição, uma letra a mais ou a menos continua errada, mas o retorno diz que foi por pouco.
  for (const esperado of exata ? gabarito : []) {
    const alvo = normalizarResposta(esperado).replace(ARTIGO, "");
    if (alvo.length < 4 || !/^[\p{L} ]+$/u.test(alvo)) continue;
    const perto = alvo.length >= 6 ? 2 : 1;
    if (distancia(semArtigo, alvo, perto) <= perto) return { correta: false, observacao: "Quase! Confira a grafia: a palavra está quase certa." };
  }
  // A palavra certa está lá, mas com outras que mudam a frase: o retorno diz isso, em vez de só repetir a dica.
  const comoFrase = ` ${normalizada.replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim()} `;
  if (comoFrase.trim().includes(" ") && gabarito.some((esperado) => comoFrase.includes(` ${normalizarResposta(esperado)} `))) {
    return { correta: false, observacao: "Quase: a palavra certa está na sua resposta, mas a lacuna pede só o que falta." };
  }
  return { correta: false };
}

const CORTESIA = new Set(["please", "thanks", "por", "favor", "obrigado", "obrigada"]);
/** Complementos que podem vir depois da palavra quando a lacuna fecha a frase (“Can you ___?”: “repeat it”). */
const COMPLEMENTOS = new Set(["it", "that", "this", "again"]);

/** Tira complementos do fim da resposta, só quando a lacuna é a última coisa da frase; null quando não havia nenhum. */
function tirarComplemento(resposta: string, trecho?: string): string | null {
  if (!trecho || !/_{3,}\s*[?.!]*\s*$/u.test(trecho)) return null;
  const palavras = normalizarResposta(resposta).replace(/[^\p{L}\p{N} ]+/gu, " ").split(" ").filter(Boolean);
  let fim = palavras.length;
  while (fim > 1 && COMPLEMENTOS.has(palavras[fim - 1])) fim -= 1;
  return fim === palavras.length ? null : palavras.slice(0, fim).join(" ");
}

/** Tira palavras de cortesia do começo e do fim da resposta (“repeat please”); null quando não havia nenhuma. */
function tirarCortesia(resposta: string): string | null {
  const palavras = normalizarResposta(resposta).replace(/[^\p{L}\p{N} ]+/gu, " ").split(" ").filter(Boolean);
  let inicio = 0;
  let fim = palavras.length;
  while (inicio < fim - 1 && CORTESIA.has(palavras[inicio])) inicio += 1;
  while (fim - 1 > inicio && CORTESIA.has(palavras[fim - 1])) fim -= 1;
  if (inicio === 0 && fim === palavras.length) return null;
  return palavras.slice(inicio, fim).join(" ");
}

/**
 * Tira da resposta as palavras do trecho em volta da lacuna (as de antes, no começo; as de depois, no fim). Devolve null
 * quando não havia nada a tirar.
 */
function tirarContexto(resposta: string, trecho: string): string | null {
  const partes = trecho.split(/_{3,}/);
  if (partes.length < 2) return null;
  const palavras = (texto: string) => normalizarResposta(texto).replace(/[^\p{L}\p{N} ]+/gu, " ").split(" ").filter(Boolean);
  const recebidas = palavras(resposta);
  const antes = palavras(partes[0]);
  const depois = palavras(partes[1]);
  // Quantas palavras do começo da resposta repetem o fim do trecho antes da lacuna (sobra pelo menos uma).
  let inicio = 0;
  for (let quantas = Math.min(antes.length, recebidas.length - 1); quantas > 0; quantas -= 1) {
    if (antes.slice(-quantas).every((palavra, posicao) => palavra === recebidas[posicao])) {
      inicio = quantas;
      break;
    }
  }
  // Quantas palavras do fim da resposta repetem o começo do trecho depois da lacuna.
  let fim = recebidas.length;
  for (let quantas = Math.min(depois.length, recebidas.length - inicio - 1); quantas > 0; quantas -= 1) {
    if (depois.slice(0, quantas).every((palavra, posicao) => palavra === recebidas[recebidas.length - quantas + posicao])) {
      fim = recebidas.length - quantas;
      break;
    }
  }
  if (inicio === 0 && fim === recebidas.length) return null;
  return recebidas.slice(inicio, fim).join(" ");
}

const NEGACAO = new Set(["nao", "nunca", "nem"]);
/** Contrações do inglês sem o apóstrofo (a normalização tira as aspas): “I'm” vale como “I am”. */
const CONTRACOES: Record<string, string> = {
  im: "i am", its: "it is", whats: "what is", heres: "here is", youre: "you are", thats: "that is", theres: "there is",
  cant: "cannot", dont: "do not", isnt: "is not", wheres: "where is", theyre: "they are", id: "i would",
};
const palavrasDe = (valor: string) => normalizarResposta(valor).replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean)
  .flatMap((palavra) => (CONTRACOES[palavra] ?? palavra).split(" "));

/**
 * A ideia-chave aparece no texto? A última palavra do termo vale pelo começo (“continu” acha “continua”); palavras de
 * 5 letras ou mais aceitam um deslize de digitação (“coffe” acha “coffee”). Um “não” (ou “nunca”, “nem”) até três
 * palavras antes desfaz o achado (“não continuo” não é “continua”), a menos que o próprio termo comece com ele.
 */
function temTermo(palavras: readonly string[], termo: string, exato = false): boolean {
  const partes = palavrasDe(termo);
  if (partes.length === 0) return false;
  const negavel = !NEGACAO.has(partes[0]);
  const parecida = (palavra: string, parte: string, ultima: boolean) => {
    if (ultima ? palavra.startsWith(parte) : palavra === parte) return true;
    if (exato || parte.length < 5 || !/^\p{L}+$/u.test(parte)) return false;
    if (!ultima) return distancia(palavra, parte, 1) <= 1;
    return distancia(palavra.slice(0, parte.length + 1), parte, 1) <= 1 || distancia(palavra.slice(0, parte.length), parte, 1) <= 1;
  };
  for (let inicio = 0; inicio + partes.length <= palavras.length; inicio += 1) {
    if (!partes.every((parte, posicao) => parecida(palavras[inicio + posicao], parte, posicao === partes.length - 1))) continue;
    if (negavel && palavras.slice(Math.max(0, inicio - 3), inicio).some((palavra) => NEGACAO.has(palavra))) continue;
    return true;
  }
  return false;
}

/** Resposta aberta no modo demonstração: confere se cada ideia-chave aparece (pelo começo da palavra, sem acento). */
function conferirAberta(exercicio: Extract<ExercicioInterno, { tipo: "aberta" }>, resposta: string): ResultadoAvaliacao {
  const palavras = palavrasDe(resposta);
  const atendidos = gruposDoGabarito(exercicio.gabarito).map((grupo) => grupo.some((termo) => temTermo(palavras, termo)));
  const total = atendidos.filter(Boolean).length;
  // Passa com 60% das ideias, desde que as essenciais (o ponto da lição) estejam lá.
  const correta = total >= Math.ceil(atendidos.length * 0.6) && (exercicio.essenciais ?? []).every((indice) => atendidos[indice]);
  const criterios = atendidos.map((atendido, indice) => ({
    texto: exercicio.criterios?.[indice] ?? exercicio.gabarito[indice].split("|")[0],
    atendido,
  }));
  // Aprovada com algo faltando: o retorno diz o que faltou, em vez do elogio de resposta completa.
  const faltou = criterios.filter(({ atendido }) => !atendido).map(({ texto }) => texto.charAt(0).toLocaleLowerCase("pt-BR") + texto.slice(1));
  let feedback = correta ? exercicio.feedbackCorreto : exercicio.feedbackIncorreto;
  if (correta && faltou.length > 0) feedback = `Boa resposta! Para ficar completa, faltou: ${faltou.join("; ")}.`;
  // Um erro comum na resposta (“I want”, “I like”): o retorno fala dele, e não de um erro que a pessoa não cometeu.
  const armadilha = exercicio.armadilhas?.find(({ termos }) => termos.split("|").some((termo) => temTermo(palavras, termo.trim())));
  // Uma ideia achada só com um deslize de digitação (“coffe”): vale, mas o retorno mostra a grafia certa.
  const comDeslize = gruposDoGabarito(exercicio.gabarito).map((grupo, indice) => atendidos[indice] && !grupo.some((termo) => temTermo(palavras, termo, true))
    ? grupo[0] : null).find(Boolean);
  const aviso = armadilha?.aviso ?? (comDeslize ? `Quase: confira a grafia de “${comDeslize}”.` : null);
  return {
    correta,
    feedback,
    ...(aviso ? { observacao: aviso } : {}),
    criterios,
    ...(exercicio.modelo ? { modelo: exercicio.modelo } : {}),
    simulado: true,
  };
}

/**
 * Confere a resposta. Devolve null quando a resposta não é válida para o exercício (opção inexistente, ordem
 * incompleta, texto curto demais), o que vira `invalido` na API.
 */
export function avaliarResposta(exercicio: ExercicioInterno, resposta: string): ResultadoAvaliacao | null {
  const valor = resposta.trim();
  const aberta = exercicio.tipo === "aberta";
  if (!valor || valor.length > (aberta ? LIMITES_RESPOSTA.aberta : LIMITES_RESPOSTA.curta) || /\0/.test(valor) ||
      (!aberta && /[\r\n]/.test(valor))) {
    return null;
  }

  const resultado = (correta: boolean, extra: Partial<ResultadoAvaliacao> = {}): ResultadoAvaliacao => ({
    correta,
    feedback: correta ? exercicio.feedbackCorreto : exercicio.feedbackIncorreto,
    ...extra,
  });

  switch (exercicio.tipo) {
    case "lacuna": {
      const { correta, observacao } = conferirLacuna(exercicio.gabarito, valor, exercicio.exata === true, exercicio.trecho);
      // Um nome popular ou um erro comum (“chave” por tarraxa) ganha a sua dica, em vez de só repetir a pergunta.
      const comparavel = normalizarResposta(valor);
      const armadilha = correta ? undefined
        : exercicio.armadilhas?.find(({ termos }) => termos.split("|").some((termo) => normalizarResposta(termo) === comparavel));
      const aviso = armadilha?.aviso ?? observacao;
      return resultado(correta, aviso ? { observacao: aviso } : {});
    }
    case "multipla_escolha":
      if (!exercicio.opcoes.some(({ id }) => id === valor)) return null;
      return resultado(exercicio.gabarito.includes(valor));
    case "ordenar": {
      const ids = valor.split(",").map((id) => id.trim());
      const validos = new Set(exercicio.itens.map(({ id }) => id));
      if (ids.length !== validos.size || new Set(ids).size !== ids.length || !ids.every((id) => validos.has(id))) return null;
      const certos = ids.filter((id, indice) => exercicio.gabarito[indice] === id);
      // O retorno aponta a primeira posição errada da resposta da pessoa, em vez de uma dica sobre o começo ou o fim.
      const errada = ids.findIndex((id, indice) => exercicio.gabarito[indice] !== id);
      const texto = (id: string) => exercicio.itens.find((item) => item.id === id)?.texto ?? "";
      const observacao = errada < 0 ? undefined
        : errada === 0 ? "Confira o começo: qual item vem primeiro?"
          : `Confira a ${errada + 1}ª posição: o que vem logo depois de “${texto(ids[errada - 1])}”?`;
      return resultado(certos.length === ids.length, { certos, ...(observacao ? { observacao } : {}) });
    }
    case "associar": {
      const pares = lerPares(valor.split(","));
      const esquerda = new Set(exercicio.esquerda.map(({ id }) => id));
      const direita = new Set(exercicio.direita.map(({ id }) => id));
      if (pares.length !== esquerda.size || !pares.every((par) => esquerda.has(par.esquerda) && direita.has(par.direita)) ||
          new Set(pares.map((par) => par.esquerda)).size !== pares.length || new Set(pares.map((par) => par.direita)).size !== pares.length) {
        return null;
      }
      const certas = new Set(exercicio.gabarito.map((par) => par.replace(/\s+/g, "")));
      const certos = pares.filter((par) => certas.has(`${par.esquerda}=${par.direita}`)).map((par) => par.esquerda);
      return resultado(certos.length === pares.length, { certos });
    }
    case "verdadeiro_falso": {
      const [escolha, justificativa, ...resto] = valor.split(":");
      if (resto.length > 0 || (escolha !== "verdadeiro" && escolha !== "falso") ||
          !exercicio.justificativas.some(({ id }) => id === justificativa)) {
        return null;
      }
      const valorCerto = escolha === exercicio.gabarito[0];
      const justificativaCerta = justificativa === exercicio.gabarito[1];
      const correta = valorCerto && justificativaCerta;
      // Cada parte com a sua cor: acertar o valor e errar o porquê não pinta o valor de erro.
      const certos = [...(valorCerto ? ["valor"] : []), ...(justificativaCerta ? ["justificativa"] : [])];
      return resultado(correta, valorCerto && !correta
        ? { certos, observacao: "Você acertou se a frase é verdadeira ou falsa, mas a justificativa escolhida não explica o porquê." }
        : { certos });
    }
    case "aberta":
      // O mínimo conta letras e números, sem os espaços (como o contador da tela).
      if (tamanhoDaResposta(valor) < exercicio.minimo) return null;
      return conferirAberta(exercicio, valor);
    default:
      return null;
  }
}

/** Uma resposta certa para o exercício (testes e demonstrações). */
export function respostaCerta(exercicio: ExercicioInterno): string {
  switch (exercicio.tipo) {
    case "verdadeiro_falso":
      return `${exercicio.gabarito[0]}:${exercicio.gabarito[1]}`;
    case "ordenar":
    case "associar":
      return exercicio.gabarito.join(",");
    case "aberta":
      return exercicio.modelo ?? exercicio.gabarito.map((grupo) => grupo.split("|")[0]).join(" e ").padEnd(exercicio.minimo, ".");
    default:
      return exercicio.gabarito[0];
  }
}

/** Uma resposta válida e errada (testes): a primeira opção que não é a certa, a ordem invertida… */
export function respostaErrada(exercicio: ExercicioInterno): string {
  switch (exercicio.tipo) {
    case "multipla_escolha":
      return exercicio.opcoes.find(({ id }) => id !== exercicio.gabarito[0])!.id;
    case "ordenar":
      return [...exercicio.gabarito].reverse().join(",");
    case "associar": {
      const pares = lerPares(exercicio.gabarito);
      return pares.map((par, indice) => `${par.esquerda}=${pares[(indice + 1) % pares.length].direita}`).join(",");
    }
    case "verdadeiro_falso":
      return `${exercicio.gabarito[0] === "verdadeiro" ? "falso" : "verdadeiro"}:${exercicio.gabarito[1]}`;
    case "aberta":
      return "Não sei explicar isso ainda, preciso estudar mais.".padEnd(exercicio.minimo, ".");
    default:
      return "resposta-errada-zzz";
  }
}

export function calcularProgresso(concluidas: number, total: number): Progresso {
  return { concluidas, total, percentual: total === 0 ? null : (concluidas / total) * 100 };
}

/** Estrutura de uma proposta: títulos, sem o conteúdo das lições. É o que o token da proposta carrega. */
export type EsqueletoPlano = {
  materialId?: string;
  gerador: string;
  titulo: string;
  objetivo: string;
  origem: string;
  /** `resumo`: o que a lição ensina, para a prévia da trilha. */
  fluxos: { titulo: string; licoes: { titulo: string; resumo?: string }[] }[];
};

export const LIMITES_ESQUELETO = { fluxos: 8, licoesPorFluxo: 8, titulo: 200, objetivo: 1000 } as const;

export function esqueletoValido(valor: unknown): valor is EsqueletoPlano {
  if (!objeto(valor) || !textoAte(valor.gerador, 40) || !textoAte(valor.titulo, LIMITES_ESQUELETO.titulo) ||
      !textoAte(valor.objetivo, LIMITES_ESQUELETO.objetivo) || !textoAte(valor.origem, LIMITES_ESQUELETO.titulo) ||
      !Array.isArray(valor.fluxos) || valor.fluxos.length === 0 || valor.fluxos.length > LIMITES_ESQUELETO.fluxos) {
    return false;
  }

  return valor.fluxos.every((fluxo) =>
    objeto(fluxo) && textoAte(fluxo.titulo, LIMITES_ESQUELETO.titulo) && Array.isArray(fluxo.licoes) &&
    fluxo.licoes.length > 0 && fluxo.licoes.length <= LIMITES_ESQUELETO.licoesPorFluxo &&
    fluxo.licoes.every((licao) => objeto(licao) && textoAte(licao.titulo, LIMITES_ESQUELETO.titulo) &&
      opcional(licao.resumo, (resumo) => textoAte(resumo, 200))));
}

/**
 * As ideias-chave de uma lição, tiradas das respostas dos exercícios: o que vai na lacuna, a opção certa curta, os itens
 * de ligar e o primeiro termo de cada critério da resposta aberta. Servem para o retorno sem IA dizer o que a explicação
 * da pessoa trouxe e o que faltou.
 */
export function termosDaLicao(conteudo: ConteudoLicao): string[] {
  const termos: string[] = [];
  for (const exercicio of [conteudo.exercicio, ...(conteudo.extras ?? [])]) {
    switch (exercicio.tipo) {
      case "lacuna":
        termos.push(exercicio.gabarito[0]);
        break;
      case "multipla_escolha": {
        // Na escuta, as opções são traduções (“A conta”): não são as ideias da lição.
        if (exercicio.fala) break;
        const certa = exercicio.opcoes.find(({ id }) => id === exercicio.gabarito[0])?.texto ?? "";
        if (certa.split(/\s+/).length <= 4) termos.push(certa);
        break;
      }
      case "associar":
        termos.push(...exercicio.esquerda.map(({ texto }) => texto));
        break;
      case "aberta":
        termos.push(...exercicio.gabarito.map((grupo) => grupo.split("|")[0]));
        break;
      default:
        break;
    }
  }
  const vistos = new Set<string>();
  const unicos = termos.map((termo) => termo.replace(/[.!?]+$/u, "").trim()).filter((termo) => {
    const chave = normalizarResposta(termo);
    if (chave.length < 3 || /^\d+$/.test(chave) || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  // Uma ideia que já está dentro de outra (“from”, em “I'm from Brazil”) não conta duas vezes.
  const comoFrase = (termo: string) => ` ${palavrasDe(termo).join(" ")} `;
  return unicos.filter((termo) => !unicos.some((outro) => outro !== termo && comoFrase(outro).length > comoFrase(termo).length &&
    comoFrase(outro).includes(comoFrase(termo)))).slice(0, 6);
}

/** O aviso da primeira armadilha (da lição ou dos exercícios) que o texto traz, como “I here” sem o verbo. */
export function armadilhaNoTexto(conteudo: ConteudoLicao, texto: string): string | null {
  const palavras = palavrasDe(texto);
  // As da lacuna ficam de fora: elas valem para a resposta inteira (“de”, “do”), e num texto livre em português
  // apareceriam em qualquer frase.
  const exercicios = [conteudo.exercicio, ...(conteudo.extras ?? [])].filter(({ tipo }) => tipo === "aberta");
  const todas = [...(conteudo.armadilhas ?? []), ...exercicios.flatMap(({ armadilhas }) => armadilhas ?? [])];
  return todas.find(({ termos }) => termos.split("|").some((termo) => temTermo(palavras, termo.trim())))?.aviso ?? null;
}

/** Quais destes termos aparecem no texto (pelo começo da palavra, com um deslize, sem “não” antes). */
export function termosPresentes(texto: string, termos: readonly string[]): string[] {
  const palavras = palavrasDe(texto);
  return termos.filter((termo) => temTermo(palavras, termo));
}
