/*
 * O balão "O Stu explica" é curto (spec 17, mudança 6; spec 04, banca §7): até 3 frases e cerca de 50 palavras em todas as lições, e na lição 1 de cada trilha até 2 frases, para a
 * primeira tela do primeiro caminho não ser a mais longa. A conta é pura e conservadora: na dúvida, uma pontuação NÃO fecha frase (o texto passa inteiro, nunca é cortado no meio de uma frase),
 * e fórmulas ($…$), citações (“…”, "…") e trechos de código (`…`) não se dividem. O servidor usa estas funções ao receber a lição da IA; os clientes podem usá-las igual.
 */

export const LIMITE_DO_CONCEITO = {
  /** Frases do balão em qualquer lição. */
  frases: 3,
  /** Frases do balão na lição 1 de cada trilha. */
  frasesNaLicao1: 2,
  /** "Cerca de 50 palavras": o que o pedido à IA diz. Até `palavras + folgaDePalavras` passa sem corte. */
  palavras: 50,
  folgaDePalavras: 10,
} as const;

/** Abreviações que terminam em ponto sem fechar a frase (em minúsculas, sem o ponto): as que vêm antes de um número ou de um nome e que, soltas, seriam lidas como "fim de frase". */
const ABREVIACOES = new Set([
  'ex', 'dr', 'dra', 'sr', 'sra', 'srta', 'prof', 'profa', 'av', 'cf', 'fig', 'obs', 'pág', 'pag', 'págs', 'pags', 'nº', 'séc', 'sec', 'aprox', 'vs', 'art', 'tel', 'cap', 'tab', 'vol',
  'a.c', 'd.c', 'p.ex', 'e.g', 'i.e',
]);

/** Pedaços que não se dividem: fórmulas, citações e código, em ordem, como [início, fim). */
function trechosProtegidos(texto: string): [number, number][] {
  const trechos: [number, number][] = [];
  const procurar = (regra: RegExp) => {
    for (const achado of texto.matchAll(regra)) trechos.push([achado.index, achado.index + achado[0].length]);
  };
  // Fórmula: o cifrão de abertura é seguido de algo que não é espaço, e o de fechamento vem depois de algo que não é espaço ("R$ 25" não abre fórmula).
  procurar(/(?<![\p{L}\d])\$(?=\S)[^$\n]{1,200}?(?<=\S)\$/gu);
  procurar(/“[^”]{1,300}”/gu);
  procurar(/"[^"\n]{1,300}"/gu);
  procurar(/`[^`\n]{1,200}`/gu);
  return trechos.sort((a, b) => a[0] - b[0]);
}

const dentroDe = (protegidos: [number, number][], indice: number) => protegidos.some(([inicio, fim]) => indice >= inicio && indice < fim);

/** O texto sem espaços sobrando nas pontas e com cada fórmula valendo uma palavra só, para contar. */
function paraContar(texto: string): string {
  return texto.replace(/(?<![\p{L}\d])\$(?=\S)[^$\n]{1,200}?(?<=\S)\$/gu, 'F').trim();
}

/** Onde cada frase termina (índice logo depois do último caractere dela, aspas de fechamento incluídas), e o do texto inteiro sem as sobras do fim. */
function fimsDasFrases(texto: string): number[] {
  const fim = texto.trimEnd().length;
  if (fim === 0) return [];
  const protegidos = trechosProtegidos(texto);
  const fins: number[] = [];
  let i = 0;
  while (i < fim) {
    const c = texto[i];
    if (!'.!?…'.includes(c) || dentroDe(protegidos, i)) { i += 1; continue; }
    // A sequência de pontuação ("?!", "...") e os fechamentos que vêm colados (”, ", ', ), ]).
    let fimDaPontuacao = i + 1;
    while (fimDaPontuacao < fim && '.!?…'.includes(texto[fimDaPontuacao])) fimDaPontuacao += 1;
    let depois = fimDaPontuacao;
    while (depois < fim && '”"\')]'.includes(texto[depois])) depois += 1;
    // Só fecha frase se vem espaço e, então, um começo de frase (maiúscula, número, abertura de citação ou de fórmula).
    const espaco = /^\s+/.exec(texto.slice(depois, fim));
    const proximo = espaco ? texto[depois + espaco[0].length] : undefined;
    const comecaFrase = proximo !== undefined && /[\p{Lu}\d“"¿¡$]/u.test(proximo);
    if (comecaFrase && !ehAbreviacao(texto, i, fimDaPontuacao, fins.length > 0 ? fins[fins.length - 1] : 0)) fins.push(depois);
    i = Math.max(depois, i + 1);
  }
  if (fins.length === 0 || fins[fins.length - 1] < fim) fins.push(fim);
  return fins;
}

/** O ponto em `i` é de uma abreviação, de uma inicial ou do número de uma lista (e não fecha a frase)? Reticências e "?!" nunca são. `inicioDaFrase` é onde a frase de agora começou. */
function ehAbreviacao(texto: string, i: number, fimDaPontuacao: number, inicioDaFrase: number): boolean {
  if (texto[i] !== '.' || fimDaPontuacao !== i + 1) return false;
  const antes = /[\p{L}\p{N}º.]+$/u.exec(texto.slice(0, i));
  if (!antes) return false;
  const palavra = antes[0].toLowerCase().replace(/^\.+/, '');
  if (ABREVIACOES.has(palavra)) return true;
  // Inicial solta ("J. Silva"): uma letra maiúscula sozinha.
  if (/^\p{Lu}$/u.test(antes[0])) return true;
  // Número de uma lista ("Passos: 1. Corte as cebolas. 2. Frite."): um ou dois dígitos que abrem a frase (ela começa neles) ou vêm depois de dois-pontos ou de quebra de linha.
  // "Divida por 2. Pronto." e "a pág. 12. Depois" não são lista: o número vem depois de palavras, no fim da frase.
  if (!/^\d{1,2}$/.test(palavra)) return false;
  return texto.slice(inicioDaFrase, i).trim() === palavra || /[:\n]\s*\d{1,2}$/.test(texto.slice(0, i));
}

/** As frases do texto, em ordem e sem as sobras de espaço. */
export function frasesDoConceito(texto: string): string[] {
  const fins = fimsDasFrases(texto);
  return fins.map((fim, indice) => texto.slice(indice === 0 ? 0 : fins[indice - 1], fim).trim()).filter(Boolean);
}

/** Quantas frases e quantas palavras tem o conceito (cada fórmula conta como uma palavra). */
export function medirConceito(texto: string): { frases: number; palavras: number } {
  const contavel = paraContar(texto);
  return { frases: frasesDoConceito(texto).length, palavras: contavel === '' ? 0 : contavel.split(/\s+/).length };
}

/** O conceito cabe no balão? Até 3 frases (2 na lição 1) e até 60 palavras ("cerca de 50"). */
export function conceitoCabe(texto: string, { primeiraLicao = false }: { primeiraLicao?: boolean } = {}): boolean {
  const { frases, palavras } = medirConceito(texto);
  const maximoDeFrases = primeiraLicao ? LIMITE_DO_CONCEITO.frasesNaLicao1 : LIMITE_DO_CONCEITO.frases;
  return frases <= maximoDeFrases && palavras <= LIMITE_DO_CONCEITO.palavras + LIMITE_DO_CONCEITO.folgaDePalavras;
}

/**
 * O conceito dentro do limite do balão: as primeiras frases, até 3 (2 na lição 1), tirando frases do fim enquanto passar de 60 palavras (sempre fica ao menos a 1ª frase, mesmo longa:
 * cortar uma frase ao meio é pior que passar do limite). `resto` é o que ficou de fora (para um "Continuar lendo"); `cortou` diz se houve corte. Um conceito que já cabe volta igual.
 */
export function encurtarConceito(texto: string, { primeiraLicao = false }: { primeiraLicao?: boolean } = {}): { conceito: string; resto: string; cortou: boolean } {
  const fins = fimsDasFrases(texto);
  if (fins.length === 0) return { conceito: texto.trim(), resto: '', cortou: false };
  const maximoDeFrases = primeiraLicao ? LIMITE_DO_CONCEITO.frasesNaLicao1 : LIMITE_DO_CONCEITO.frases;
  const maximoDePalavras = LIMITE_DO_CONCEITO.palavras + LIMITE_DO_CONCEITO.folgaDePalavras;
  let usar = Math.min(fins.length, maximoDeFrases);
  const palavrasAte = (quantas: number) => { const contavel = paraContar(texto.slice(0, fins[quantas - 1])); return contavel === '' ? 0 : contavel.split(/\s+/).length; };
  while (usar > 1 && palavrasAte(usar) > maximoDePalavras) usar -= 1;
  const corte = fins[usar - 1];
  const conceito = texto.slice(0, corte).trim();
  const resto = texto.slice(corte).trim();
  return { conceito, resto, cortou: resto !== '' };
}
