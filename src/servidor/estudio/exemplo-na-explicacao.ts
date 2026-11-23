/*
 * O "Explique com suas palavras" sem IA (modo demonstração ou IA fora do ar) precisa reconhecer um exemplo quando a pessoa o dá. Antes, só valia o que vinha
 * MARCADO como exemplo ("por exemplo", "tipo quando…"), e uma explicação com um exemplo concreto sem marca ("Numa pizza de 8 fatias, comer 3 é 3/8") ouvia
 * "Faltou só um exemplo seu", que contradizia o que ela tinha acabado de escrever. A IA de verdade não passa por aqui.
 */

/** Minúsculas e sem acento, para comparar sem se prender a "numa" × "Numa" nem a "exemplo" × "êxemplo". */
const simples = (texto: string) => texto.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/** O que a pessoa marca como exemplo, inclusive do jeito falado. "tipo de", "tipo do" e "tipos" são o assunto, não um exemplo; um "quando" solto também não. */
const MARCAS = /(?:^|\W)(?:por exemplo|exemplos?|ex\.|ex:|imagine|imaginem|digamos|suponha|suponhamos|pense (?:em|num|numa)|como quando|como se|tipo(?!\s+(?:de|do|da|dos|das)(?=\W|$))|quando eu|se eu|no meu caso|comigo|e o caso de|no caso de)(?=\W|$)/u;

/** Uma situação com objeto: "numa pizza", "num jogo". */
const SITUACAO = /(?:^|\W)(?:num|numa|nuns|numas)\s+\p{L}{3,}/u;

/** Uma quantidade de alguma coisa: "8 fatias", "3 acordes", "2,5 litros". Um número sozinho, sem o que ele conta, não vale. */
const QUANTIDADE = /(?:^|\s)\d+(?:[.,]\d+)?\s+(?:de\s+)?\p{L}{3,}/u;

/** Uma conta ou uma fração: "3/8", "2 + 3", "4 x 5 = 20". */
const CONTA = /\d\s*(?:\/|\+|×|\*|÷|=)\s*\d|\d\s+x\s+\d/u;

/** Um preço: "R$ 25". */
const PRECO = /r\$\s*\d/u;

/** Uma comparação com uma coisa: "como uma pizza", "como o relógio". */
const COMPARACAO = /(?:^|\W)como\s+(?:um|uma|uns|umas|o|a|os|as)\s+\p{L}{3,}/u;

/** A explicação traz um exemplo (marcado ou concreto)? */
export function explicacaoTemExemplo(explicacao: string): boolean {
  const texto = simples(explicacao);
  return [MARCAS, SITUACAO, QUANTIDADE, CONTA, PRECO, COMPARACAO].some((regra) => regra.test(texto));
}
