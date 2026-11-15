/*
 * Conferência da fala: compara o que a pessoa disse (o texto do reconhecimento de voz) com a frase que ela devia dizer,
 * palavra por palavra, sem ligar para maiúsculas, acentos e pontuação. Números em algarismos valem como por extenso
 * (“15 dollars” é “fifteen dollars”), contrações valem como a forma longa (“it's” é “it is”) e, em palavras de 5 letras ou
 * mais, uma letra trocada passa (o reconhecimento erra assim). Usada pela web e pelo app.
 */

export type NotaDaFala = 'otima' | 'quase' | 'tente';
export interface ConferenciaDaFala {
  acertos: number;
  total: number;
  /** As palavras da frase que não apareceram no que foi dito, na ordem da frase. */
  faltaram: string[];
  nota: NotaDaFala;
}

const UNIDADES_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const DEZENAS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const UNIDADES_PT = ['zero', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
  'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS_PT = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];

/** Um número de 0 a 100 por extenso, no idioma da frase (inglês ou português); fora disso, como veio. */
function porExtenso(numero: number, ingles: boolean): string {
  if (!Number.isInteger(numero) || numero < 0 || numero > 100) return String(numero);
  if (numero === 100) return ingles ? 'one hundred' : 'cem';
  const unidades = ingles ? UNIDADES_EN : UNIDADES_PT;
  if (numero < 20) return unidades[numero];
  const dezena = (ingles ? DEZENAS_EN : DEZENAS_PT)[Math.floor(numero / 10)];
  const unidade = numero % 10;
  if (unidade === 0) return dezena;
  return ingles ? `${dezena} ${unidades[unidade]}` : `${dezena} e ${unidades[unidade]}`;
}

const CONTRACOES: Record<string, string> = {
  "it's": 'it is', "i'm": 'i am', "what's": 'what is', "here's": 'here is', "i'd": 'i would', "you're": 'you are',
  "that's": 'that is', "there's": 'there is', "can't": 'cannot', "don't": 'do not', "isn't": 'is not', "let's": 'let us',
  "where's": 'where is', "how's": 'how is', "we're": 'we are', "they're": 'they are', "i'll": 'i will',
};

/** As mesmas contrações escritas sem apóstrofo, como o reconhecimento de voz às vezes devolve (“its”, “im”). */
const SEM_APOSTROFO: Record<string, string> = {
  its: 'it is', im: 'i am', whats: 'what is', heres: 'here is', youre: 'you are', thats: 'that is', theres: 'there is',
  cant: 'cannot', dont: 'do not', isnt: 'is not', wheres: 'where is', hows: 'how is', theyre: 'they are',
};

/** As palavras de um texto, comparáveis: minúsculas, sem acento nem pontuação, números por extenso e contrações abertas. */
function palavras(texto: string, ingles: boolean): string[] {
  const minusculo = texto.normalize('NFD').replace(/\p{M}+/gu, '').toLocaleLowerCase('pt-BR').replace(/[’‘`´]/g, "'");
  const abertas = minusculo.replace(/[a-z]+'[a-z]+/g, (palavra) => CONTRACOES[palavra] ?? palavra.replace("'", ''));
  const numeros = abertas.replace(/\d+/g, (numero) => ` ${porExtenso(Number(numero), ingles)} `);
  const separadas = numeros.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/'/g, '').split(' ').filter(Boolean);
  return ingles ? separadas.flatMap((palavra) => (SEM_APOSTROFO[palavra] ?? palavra).split(' ')) : separadas;
}

function distanciaCurta(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 2;
  let anterior = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  for (let i = 1; i <= a.length; i += 1) {
    const atual = [i];
    for (let j = 1; j <= b.length; j += 1) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length];
}

const parecidas = (esperada: string, dita: string) => esperada === dita || (esperada.length >= 5 && distanciaCurta(esperada, dita) <= 1);

/** Confere o que foi dito contra a frase: quantas palavras da frase apareceram, na ordem, e quais faltaram. */
export function conferirFala(frase: string, dito: string, idioma: string): ConferenciaDaFala {
  const ingles = idioma.toLowerCase().startsWith('en');
  const esperadas = palavras(frase, ingles);
  const ditas = palavras(dito, ingles);
  // Maior sequência em comum (com a tolerância de uma letra), para achar quais palavras da frase foram ditas.
  const tabela = Array.from({ length: esperadas.length + 1 }, () => new Array<number>(ditas.length + 1).fill(0));
  for (let i = esperadas.length - 1; i >= 0; i -= 1) {
    for (let j = ditas.length - 1; j >= 0; j -= 1) {
      tabela[i][j] = parecidas(esperadas[i], ditas[j]) ? tabela[i + 1][j + 1] + 1 : Math.max(tabela[i + 1][j], tabela[i][j + 1]);
    }
  }
  const faltaram: string[] = [];
  let i = 0;
  let j = 0;
  while (i < esperadas.length) {
    if (j < ditas.length && parecidas(esperadas[i], ditas[j])) {
      i += 1;
      j += 1;
    } else if (j < ditas.length && tabela[i][j + 1] >= tabela[i + 1][j]) {
      j += 1;
    } else {
      faltaram.push(esperadas[i]);
      i += 1;
    }
  }
  const total = esperadas.length;
  const acertos = total - faltaram.length;
  const proporcao = total === 0 ? 0 : acertos / total;
  return { acertos, total, faltaram, nota: proporcao >= 0.9 ? 'otima' : proporcao >= 0.6 ? 'quase' : 'tente' };
}
