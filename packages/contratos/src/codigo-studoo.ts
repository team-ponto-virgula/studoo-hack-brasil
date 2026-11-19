/*
 * Código Studoo: o QR com a cara do Studoo. Função pura (sem DOM e sem API do Node), compartilhada pela web e pelo app:
 * texto → matriz (nível e máscara escolhidos pela folga) → geometria pronta para desenhar, em unidades de módulo, já com a margem de
 * silêncio. A web desenha o SVG (`svgCodigoStudoo`); o app desenha os mesmos caminhos com react-native-svg.
 *
 * Regras para ler de primeira: módulo escuro sempre escuro sobre fundo claro; margem de 4 módulos; olhos com a
 * proporção 1:1:3:1:1 nas linhas que passam pelo centro; clareira central de no máximo ~22% do lado (correção H).
 */
import qrcode from 'qrcode-generator';

/** A = rosto do Stu (pontos, olhos-lente); B = mapa de trilha (pedrinhas ligadas, olhos-nó); C = capim (colunas). */
export type EstiloCodigo = 'rosto' | 'trilha' | 'capim';

export const MARGEM_CODIGO = 4;

export interface OlhoCodigo {
  /** Canto superior esquerdo do olho (7×7), em módulos, já com a margem. */
  x: number;
  y: number;
  /** Anel externo (escuro): caminho com o furo (preencher com `fill-rule="evenodd"`). */
  anel: string;
  /** Miolo 3×3 (escuro; aceita a cor do perfil). */
  miolo: string;
}

export interface GeometriaCodigo {
  estilo: EstiloCodigo;
  /** Módulos de um lado do QR (sem a margem). */
  modulos: number;
  /** Lado total, com a margem de silêncio dos dois lados. */
  lado: number;
  /** Módulos de dados escuros (sem olhos, sem alinhamentos, sem a clareira), num caminho só. */
  dados: string;
  olhos: OlhoCodigo[];
  /** Padrões de alinhamento (5×5): anel e miolo. O último é a "chegada" no estilo trilha. */
  alinhamentos: { x: number; y: number; anel: string; miolo: string }[];
  /** Clareira central (redonda; a caixa quadrada que a contém, em módulos), onde entra o sorriso, a foto ou a inicial. */
  clareira: { x: number; y: number; lado: number } | null;
  /** Desenho escuro a mais (no estilo rosto, a ponte dos óculos entre as duas lentes de cima). */
  enfeite: string;
  /** Desenho claro a mais, por baixo do enfeite (o canal da ponte fina). */
  enfeiteFundo: string;
  /** Correção de erro e versão escolhidas (ver `escolherConfiguracao`). */
  nivel: NivelCorrecao;
  versao: number;
  configuracao: ConfiguracaoCodigo;
}

export type NivelCorrecao = 'L' | 'M' | 'Q' | 'H';

const f = (n: number) => Number(n.toFixed(3)).toString();

function circulo(cx: number, cy: number, r: number, horario = true) {
  const s = horario ? 1 : 0;
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 ${s} ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 ${s} ${f(-2 * r)} 0Z`;
}

/** Retângulo arredondado no sentido horário (para a união com `nonzero`). */
function retangulo(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${f(x + rr)} ${f(y)}h${f(w - 2 * rr)}a${f(rr)} ${f(rr)} 0 0 1 ${f(rr)} ${f(rr)}v${f(h - 2 * rr)}a${f(rr)} ${f(rr)} 0 0 1 ${f(-rr)} ${f(rr)}h${f(-(w - 2 * rr))}a${f(rr)} ${f(rr)} 0 0 1 ${f(-rr)} ${f(-rr)}v${f(-(h - 2 * rr))}a${f(rr)} ${f(rr)} 0 0 1 ${f(rr)} ${f(-rr)}Z`;
}

/** Folha: quadrado com dois cantos opostos bem arredondados (r) e dois quase vivos (q). */
function folha(x: number, y: number, l: number, r: number, q: number) {
  return `M${f(x + r)} ${f(y)}h${f(l - r - q)}a${f(q)} ${f(q)} 0 0 1 ${f(q)} ${f(q)}v${f(l - q - r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(l - r - q))}a${f(q)} ${f(q)} 0 0 1 ${f(-q)} ${f(-q)}v${f(-(l - q - r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}Z`;
}

/** Posições dos centros dos padrões de alinhamento por versão (tabela do padrão QR). */
const ALINHAMENTO: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
  [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
];

/** A matriz do QR (correção H, UTF-8), `true` = escuro. */
/** Bytes UTF-8 do texto (sem TextEncoder, que nem todo motor do app tem). */
function bytesUtf8(texto: string): number[] {
  const bytes: number[] = [];
  for (const caractere of texto) {
    const p = caractere.codePointAt(0)!;
    if (p < 0x80) bytes.push(p);
    else if (p < 0x800) bytes.push(0xc0 | (p >> 6), 0x80 | (p & 63));
    else if (p < 0x10000) bytes.push(0xe0 | (p >> 12), 0x80 | ((p >> 6) & 63), 0x80 | (p & 63));
    else bytes.push(0xf0 | (p >> 18), 0x80 | ((p >> 12) & 63), 0x80 | ((p >> 6) & 63), 0x80 | (p & 63));
  }
  return bytes;
}

function gerarQr(texto: string, nivel: NivelCorrecao, versao = 0) {
  // O padrão da biblioteca corta cada caractere em 1 byte; o texto vai em UTF-8.
  const gerador = qrcode as unknown as typeof qrcode & { stringToBytes: (s: string) => number[] };
  gerador.stringToBytes = bytesUtf8;
  const qr = gerador(versao as Parameters<typeof qrcode>[0], nivel);
  qr.addData(texto);
  qr.make();
  return qr;
}

/*
 * FOLGA GARANTIDA POR LINK. O desenho do rosto apaga ou pinta módulos de dados: a clareira do centro (sorriso, foto ou
 * inicial) e a ponte dos óculos. Cada módulo pertence a uma palavra-código, e cada palavra-código a um bloco de
 * Reed-Solomon, que corrige até metade das suas palavras de correção. Aqui o gerador calcula, para o link em mãos e sem
 * leitor nem imagem, quantas palavras de cada bloco o desenho estraga, e escolhe a configuração (nível, máscara, ponte e
 * clareira) pela regra: (1) folga — nenhum bloco gasta mais de 60% da correção e, com 8 módulos sujos ao acaso, a leitura
 * fica garantida em 99% ou mais (cálculo conservador: cada módulo sujo estraga uma palavra nova); (2) o módulo maior
 * (a menor versão) entre as que têm centro; (3) o rosto mais completo (com ponte; clareira maior; ponte cheia antes da
 * fina). A clareira é redonda (`naClareira`). A ponte fina não cobre o centro de nenhum módulo (não gasta correção), então a ponte só some quando nem ela cabe
 * no desenho; sem nenhuma candidata com centro (link longo demais), sai sem o centro: o código é sempre legível.
 * Candidatas: níveis H, Q e M, cada um na menor versão em que o link cabe e nas duas seguintes (até a 13), 8 máscaras,
 * ponte cheia, fina ou nenhuma, e clareira de 9, 7 ou 5 módulos (a que couber na versão) ou nenhuma.
 */

/** Blocos de Reed-Solomon por versão e nível: grupos [quantidade, palavras no bloco, palavras de dados]. */
const BLOCOS_RS: Record<number, Record<NivelCorrecao, number[]>> = {
  1: { L: [1, 26, 19], M: [1, 26, 16], Q: [1, 26, 13], H: [1, 26, 9] },
  2: { L: [1, 44, 34], M: [1, 44, 28], Q: [1, 44, 22], H: [1, 44, 16] },
  3: { L: [1, 70, 55], M: [1, 70, 44], Q: [2, 35, 17], H: [2, 35, 13] },
  4: { L: [1, 100, 80], M: [2, 50, 32], Q: [2, 50, 24], H: [4, 25, 9] },
  5: { L: [1, 134, 108], M: [2, 67, 43], Q: [2, 33, 15, 2, 34, 16], H: [2, 33, 11, 2, 34, 12] },
  6: { L: [2, 86, 68], M: [4, 43, 27], Q: [4, 43, 19], H: [4, 43, 15] },
  7: { L: [2, 98, 78], M: [4, 49, 31], Q: [2, 32, 14, 4, 33, 15], H: [4, 39, 13, 1, 40, 14] },
  8: { L: [2, 121, 97], M: [2, 60, 38, 2, 61, 39], Q: [4, 40, 18, 2, 41, 19], H: [4, 40, 14, 2, 41, 15] },
  9: { L: [2, 146, 116], M: [3, 58, 36, 2, 59, 37], Q: [4, 36, 16, 4, 37, 17], H: [4, 36, 12, 4, 37, 13] },
  10: { L: [2, 86, 68, 2, 87, 69], M: [4, 69, 43, 1, 70, 44], Q: [6, 43, 19, 2, 44, 20], H: [6, 43, 15, 2, 44, 16] },
  11: { L: [4, 101, 81], M: [1, 80, 50, 4, 81, 51], Q: [4, 50, 22, 4, 51, 23], H: [3, 36, 12, 8, 37, 13] },
  12: { L: [2, 116, 92, 2, 117, 93], M: [6, 58, 36, 2, 59, 37], Q: [4, 46, 20, 6, 47, 21], H: [7, 42, 14, 4, 43, 15] },
  13: { L: [4, 133, 107], M: [8, 59, 37, 1, 60, 38], Q: [8, 44, 20, 4, 45, 21], H: [12, 33, 11, 4, 34, 12] },
};
/** Até a versão 13 o centro do código é um alinhamento (da 7 em diante) ou dados; da 14 em diante, não tratamos. */
export const VERSAO_MAXIMA_CODIGO = 13;

/** Os blocos de uma versão e nível: palavras de dados e de correção de cada um. */
export function blocosRs(versao: number, nivel: NivelCorrecao): { dados: number; correcao: number }[] {
  const grupos = BLOCOS_RS[versao]?.[nivel];
  if (!grupos) throw new Error(`versão ${versao} fora da tabela do Código Studoo`);
  const blocos: { dados: number; correcao: number }[] = [];
  for (let i = 0; i < grupos.length; i += 3) for (let k = 0; k < grupos[i]; k++) blocos.push({ dados: grupos[i + 2], correcao: grupos[i + 1] - grupos[i + 2] });
  return blocos;
}

interface MapaVersao {
  n: number;
  /** Módulo de função (olhos com separador, linhas de tempo, alinhamentos, formato e versão). */
  funcao: boolean[][];
  /** Índice da palavra-código (na ordem intercalada) de cada módulo; -1 para função e bits de sobra. */
  palavra: Int16Array;
  /** Posição do bit dentro da palavra (0 = o mais significativo); -1 fora dos dados. */
  bitNaPalavra: Int8Array;
}
const mapas = new Map<number, MapaVersao>();

/** O mapa módulo → palavra-código de uma versão (posicionamento em zigue-zague do padrão QR). */
export function mapaDaVersao(versao: number): MapaVersao {
  const pronto = mapas.get(versao);
  if (pronto) return pronto;
  const n = 17 + 4 * versao;
  const funcao = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const marcar = (r0: number, c0: number, h: number, w: number) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (r >= 0 && c >= 0 && r < n && c < n) funcao[r][c] = true;
  };
  marcar(0, 0, 9, 9); marcar(0, n - 8, 9, 8); marcar(n - 8, 0, 8, 9); // olhos, separadores e formato
  marcar(6, 0, 1, n); marcar(0, 6, n, 1); // linhas de tempo
  const posicoes = ALINHAMENTO[versao] ?? [];
  for (const r of posicoes) for (const c of posicoes) {
    if ((r < 9 && c < 9) || (r < 9 && c > n - 10) || (r > n - 10 && c < 9)) continue;
    marcar(r - 2, c - 2, 5, 5);
  }
  if (versao >= 7) { marcar(0, n - 11, 6, 3); marcar(n - 11, 0, 3, 6); }
  const total = blocosRs(versao, 'L').reduce((soma, b) => soma + b.dados + b.correcao, 0);
  const palavra = new Int16Array(n * n).fill(-1);
  const bitNaPalavra = new Int8Array(n * n).fill(-1);
  let bit = 0;
  let subindo = true;
  for (let direita = n - 1; direita >= 1; direita -= 2) {
    if (direita === 6) direita = 5;
    for (let passo = 0; passo < n; passo++) {
      const r = subindo ? n - 1 - passo : passo;
      for (let j = 0; j < 2; j++) {
        const c = direita - j;
        if (funcao[r][c]) continue;
        if (bit >> 3 < total) { palavra[r * n + c] = bit >> 3; bitNaPalavra[r * n + c] = bit & 7; }
        bit++;
      }
    }
    subindo = !subindo;
  }
  const mapa = { n, funcao, palavra, bitNaPalavra };
  mapas.set(versao, mapa);
  return mapa;
}

const blocosDasPalavras = new Map<string, Int16Array>();
/** O bloco de cada palavra-código na ordem intercalada (dados de todos os blocos, depois a correção). */
function blocoDaPalavra(versao: number, nivel: NivelCorrecao): Int16Array {
  const chave = `${versao}${nivel}`;
  const pronto = blocosDasPalavras.get(chave);
  if (pronto) return pronto;
  const blocos = blocosRs(versao, nivel);
  const total = blocos.reduce((soma, b) => soma + b.dados + b.correcao, 0);
  const saida = new Int16Array(total);
  let k = 0;
  const maxDados = Math.max(...blocos.map((b) => b.dados));
  for (let i = 0; i < maxDados; i++) blocos.forEach((b, indice) => { if (i < b.dados) saida[k++] = indice; });
  for (let i = 0; i < blocos[0].correcao; i++) blocos.forEach((_, indice) => { saida[k++] = indice; });
  blocosDasPalavras.set(chave, saida);
  return saida;
}

const MASCARAS: ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0,
];
const BITS_NIVEL: Record<NivelCorrecao, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Os 15 bits de formato (nível e máscara, com BCH), como a biblioteca grava. */
function bitsDoFormato(nivel: NivelCorrecao, mascara: number): number {
  const dados = (BITS_NIVEL[nivel] << 3) | mascara;
  let resto = dados << 10;
  for (let i = 14; i >= 10; i--) if ((resto >> i) & 1) resto ^= 0x537 << (i - 10);
  return ((dados << 10) | resto) ^ 0x5412;
}

/** As posições dos 15 bits de formato (as duas cópias), na mesma ordem da biblioteca. */
function posicoesDoFormato(n: number, i: number): [[number, number], [number, number]] {
  const vertical: [number, number] = i < 6 ? [i, 8] : i < 8 ? [i + 1, 8] : [n - 15 + i, 8];
  const horizontal: [number, number] = i < 8 ? [8, n - i - 1] : i < 9 ? [8, 15 - i] : [8, 15 - i - 1];
  return [vertical, horizontal];
}

/** A máscara que a biblioteca escolheu (lida dos bits de formato). */
function mascaraDaMatriz(matriz: boolean[][], nivel: NivelCorrecao): number {
  const n = matriz.length;
  for (let m = 0; m < 8; m++) {
    const bits = bitsDoFormato(nivel, m);
    let igual = true;
    for (let i = 0; i < 15 && igual; i++) for (const [r, c] of posicoesDoFormato(n, i)) if (matriz[r][c] !== Boolean((bits >> i) & 1)) igual = false;
    if (igual) return m;
  }
  throw new Error('formato do QR não reconhecido');
}

/** A mesma matriz com outra máscara: troca os módulos de dados e regrava os bits de formato. */
function trocarMascara(matriz: boolean[][], versao: number, nivel: NivelCorrecao, de: number, para: number): boolean[][] {
  if (de === para) return matriz;
  const { n, funcao } = mapaDaVersao(versao);
  const nova = matriz.map((linha, r) => linha.map((escuro, c) => (funcao[r][c] ? escuro : escuro !== (MASCARAS[de](r, c) !== MASCARAS[para](r, c)))));
  const bits = bitsDoFormato(nivel, para);
  for (let i = 0; i < 15; i++) for (const [r, c] of posicoesDoFormato(n, i)) nova[r][c] = Boolean((bits >> i) & 1);
  return nova;
}

export type PonteCodigo = 'normal' | 'fina' | 'nenhuma';

/**
 * O que vai no centro: o sorriso (trilha) ou um disco (foto ou inicial do perfil). Um disco escuro pequeno, cercado de
 * claro, passa por um olho do QR para o ZXing (visto com foto escura lisa na clareira de 5): disco só com clareira de 7
 * ou mais, em que o tamanho dele já não bate com o dos olhos de verdade.
 */
export type CentroCodigo = 'sorriso' | 'disco';
export const CLAREIRA_MINIMA_DISCO = 7;

/**
 * A clareira é redonda, como o que vai nela (foto, inicial ou sorriso): um módulo fica livre quando o centro dele está
 * a até metade do lado do centro do código. Com lado 7, são 37 módulos (os 3 de cada canto do quadrado 7×7 ficam).
 */
export function naClareira(r: number, c: number, n: number, lado: number): boolean {
  if (!lado) return false;
  const meio = (n - 1) / 2;
  return (r - meio) ** 2 + (c - meio) ** 2 <= (lado / 2) ** 2;
}

/** A configuração escolhida para um link, com a conta da folga. */
export interface ConfiguracaoCodigo {
  nivel: NivelCorrecao;
  versao: number;
  mascara: number;
  ponte: PonteCodigo;
  /** Lado da clareira do centro, em módulos; 0 = sem centro. */
  clareira: number;
  /** Palavras-código estragadas pelo desenho, por bloco, e quantas cada bloco corrige. */
  erros: number[];
  corrige: number[];
  /** Fração da correção gasta pelo pior bloco (0 a 1). */
  uso: number;
  /** Chance mínima de ler com 8 módulos de dados sujos ao acaso (cada um estragando uma palavra nova em algum bloco). */
  leituraCom8: number;
}

export const USO_MAXIMO_CORRECAO = 0.6;
export const SUJOS_GARANTIDOS = 8;
export const LEITURA_MINIMA_COM_SUJOS = 0.99;

/** Lado da clareira cabível na versão (ímpar, até 22% do lado; da versão 7 em diante, cobre o alinhamento do centro). */
function clareirasPossiveis(versao: number): number[] {
  const n = 17 + 4 * versao;
  const meio = (n - 1) / 2;
  const posicoes = ALINHAMENTO[versao] ?? [];
  const centraisEOutros = posicoes.flatMap((r) => posicoes.map((c) => [r, c] as [number, number]))
    .filter(([r, c]) => !((r < 9 && c < 9) || (r < 9 && c > n - 10) || (r > n - 10 && c < 9)));
  const outros = centraisEOutros.filter(([r, c]) => !(r === meio && c === meio));
  const maximo = Math.max(5, Math.floor(n * 0.22));
  return [9, 7, 5].filter((lado) => {
    if (lado > maximo) return false;
    const inicio = (n - lado) / 2;
    return !outros.some(([r, c]) => r + 2 >= inicio && r - 2 < inicio + lado && c + 2 >= inicio && c - 2 < inicio + lado);
  });
}

/** Chance de os blocos aguentarem `sujos` palavras novas estragadas, distribuídas pelo tamanho de cada bloco. */
function chanceDeLer(sobra: number[], tamanho: number[], sujos: number): number {
  const total = tamanho.reduce((a, b) => a + b, 0);
  // dist[k] = chance de, até aqui, k módulos sujos terem caído nos blocos já vistos sem estourar nenhum.
  let dist = Array<number>(sujos + 1).fill(0);
  dist[0] = 1;
  let restante = 1;
  for (let b = 0; b < sobra.length; b++) {
    const p = tamanho[b] / total;
    const q = restante > 0 ? Math.min(1, p / restante) : 0;
    const nova = Array<number>(sujos + 1).fill(0);
    for (let k = 0; k <= sujos; k++) {
      if (!dist[k]) continue;
      const livres = sujos - k;
      // Dos `livres` que ainda não caíram, j caem neste bloco (binomial condicionada ao que sobrou de probabilidade).
      let comb = 1;
      for (let j = 0; j <= livres; j++) {
        if (j > 0) comb = (comb * (livres - j + 1)) / j;
        if (j > sobra[b]) break;
        nova[k + j] += dist[k] * comb * q ** j * (1 - q) ** (livres - j);
      }
    }
    dist = nova;
    restante -= p;
  }
  return dist[sujos];
}

interface BaseNivel { nivel: NivelCorrecao; versao: number; matriz: boolean[][]; base: number }

/** O módulo (r, c) da matriz com a máscara `m` (sem montar a matriz inteira). */
function moduloComMascara(base: BaseNivel, r: number, c: number, m: number): boolean {
  const { n, funcao } = mapaDaVersao(base.versao);
  if (!funcao[r][c]) return base.matriz[r][c] !== (MASCARAS[base.base](r, c) !== MASCARAS[m](r, c));
  for (let i = 0; i < 15; i++) for (const [fr, fc] of posicoesDoFormato(n, i)) if (fr === r && fc === c) return Boolean((bitsDoFormato(base.nivel, m) >> i) & 1);
  return base.matriz[r][c];
}

function avaliar(base: BaseNivel, mascara: number, ponte: PonteCodigo, clareira: number): ConfiguracaoCodigo | null {
  const { versao, nivel } = base;
  const { n, funcao, palavra } = mapaDaVersao(versao);
  const blocoDe = blocoDaPalavra(versao, nivel);
  const blocos = blocosRs(versao, nivel);
  const estragadas = new Set<number>();
  if (clareira) {
    const inicio = (n - clareira) / 2;
    for (let r = inicio; r < inicio + clareira; r++) for (let c = inicio; c < inicio + clareira; c++) {
      if (naClareira(r, c, n, clareira) && palavra[r * n + c] >= 0) estragadas.add(palavra[r * n + c]);
    }
  }
  if (ponte === 'normal') {
    // A ponte cheia pinta de escuro o centro dos módulos da linha 3, entre as lentes: estraga os claros.
    for (let c = 8; c < n - 8; c++) {
      if (moduloComMascara(base, 3, c, mascara)) continue;
      if (funcao[3][c]) return null; // não pinta formato nem versão
      if (palavra[3 * n + c] >= 0) estragadas.add(palavra[3 * n + c]);
    }
  }
  const erros = blocos.map(() => 0);
  for (const indice of estragadas) erros[blocoDe[indice]]++;
  const corrige = blocos.map((b) => Math.floor(b.correcao / 2));
  const uso = Math.max(...erros.map((e, b) => e / corrige[b]));
  const leituraCom8 = chanceDeLer(erros.map((e, b) => corrige[b] - e), blocos.map((b) => b.dados + b.correcao), SUJOS_GARANTIDOS);
  return { nivel, versao, mascara, ponte, clareira, erros, corrige, uso, leituraCom8 };
}

const passaNaFolga = (c: ConfiguracaoCodigo) => c.uso <= USO_MAXIMO_CORRECAO && c.leituraCom8 >= LEITURA_MINIMA_COM_SUJOS;
const FORCA_NIVEL: Record<NivelCorrecao, number> = { L: 0, M: 1, Q: 2, H: 3 };
const VALOR_PONTE: Record<PonteCodigo, number> = { normal: 2, fina: 1, nenhuma: 0 };

/** Compara duas candidatas que passam na folga: negativo quando `a` é melhor. */
function comparar(a: ConfiguracaoCodigo, b: ConfiguracaoCodigo, mascaraBase: Map<string, number>): number {
  return Number(b.clareira > 0) - Number(a.clareira > 0) // o centro (sorriso, foto ou inicial) só sai em último caso
    || a.versao - b.versao // módulo maior
    || Number(b.ponte !== 'nenhuma') - Number(a.ponte !== 'nenhuma') // com ponte
    || b.clareira - a.clareira // centro maior
    || VALOR_PONTE[b.ponte] - VALOR_PONTE[a.ponte] // ponte cheia antes da fina
    || FORCA_NIVEL[b.nivel] - FORCA_NIVEL[a.nivel] // mais correção
    || a.uso - b.uso
    || b.leituraCom8 - a.leituraCom8
    || Number(b.mascara === mascaraBase.get(`${b.nivel}${b.versao}`)) - Number(a.mascara === mascaraBase.get(`${a.nivel}${a.versao}`)) // a da biblioteca
    || a.mascara - b.mascara;
}

/** Versões a mais, além da menor, que entram como candidatas em cada nível. */
const VERSOES_A_MAIS = 2;

/** A menor versão em que `bytes` cabem no modo byte, pela tabela (sem gerar o QR). */
function menorVersao(bytes: number, nivel: NivelCorrecao): number {
  for (let versao = 1; versao <= VERSAO_MAXIMA_CODIGO; versao++) {
    const dados = blocosRs(versao, nivel).reduce((soma, b) => soma + b.dados, 0);
    if (4 + (versao < 10 ? 8 : 16) + 8 * bytes <= 8 * dados) return versao;
  }
  return Infinity;
}

/** Os pares (nível, versão) candidatos, da menor versão para a maior. */
function paresDoTexto(texto: string): { nivel: NivelCorrecao; versao: number }[] {
  const bytes = bytesUtf8(texto).length;
  const pares: { nivel: NivelCorrecao; versao: number }[] = [];
  for (const nivel of ['H', 'Q', 'M'] as const) {
    const menor = menorVersao(bytes, nivel);
    for (let versao = menor; versao <= Math.min(menor + VERSOES_A_MAIS, VERSAO_MAXIMA_CODIGO); versao++) pares.push({ nivel, versao });
  }
  if (pares.length === 0) throw new Error('link longo demais para o Código Studoo');
  return pares.sort((a, b) => a.versao - b.versao);
}

function baseDe(texto: string, nivel: NivelCorrecao, versao: number): BaseNivel {
  const qr = gerarQr(texto, nivel, versao);
  const n = qr.getModuleCount();
  const matriz = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  return { nivel, versao, base: mascaraDaMatriz(matriz, nivel), matriz };
}

function basesDoTexto(texto: string): BaseNivel[] {
  return paresDoTexto(texto).map(({ nivel, versao }) => baseDe(texto, nivel, versao));
}

/** Todas as candidatas avaliadas (para os testes e a prova): nível × máscara × ponte × clareira. */
export function candidatasDoCodigo(texto: string, estilo: EstiloCodigo = 'rosto', centro: CentroCodigo = 'sorriso'): ConfiguracaoCodigo[] {
  return candidatasDeBases(basesDoTexto(texto), estilo, centro);
}

function candidatasDeBases(bases: BaseNivel[], estilo: EstiloCodigo, centro: CentroCodigo): ConfiguracaoCodigo[] {
  const lista: ConfiguracaoCodigo[] = [];
  for (const base of bases) {
    const pontes: PonteCodigo[] = estilo === 'rosto' ? ['normal', 'fina', 'nenhuma'] : ['nenhuma'];
    const clareiras = [...clareirasPossiveis(base.versao).filter((lado) => centro === 'sorriso' || lado >= CLAREIRA_MINIMA_DISCO), 0];
    for (let mascara = 0; mascara < 8; mascara++) for (const ponte of pontes) for (const clareira of clareiras) {
      const c = avaliar(base, mascara, ponte, clareira);
      if (c) lista.push(c);
    }
  }
  return lista;
}

/** Só para os testes: a matriz de um nível com uma máscara qualquer (null quando passa da versão máxima). */
export function matrizComMascaraParaTeste(texto: string, nivel: NivelCorrecao, mascara: number, versao?: number): boolean[][] | null {
  const base = basesDoTexto(texto).find((b) => b.nivel === nivel && (versao === undefined || b.versao === versao));
  return base ? trocarMascara(base.matriz, base.versao, nivel, base.base, mascara) : null;
}

const escolhas = new Map<string, { config: ConfiguracaoCodigo; matriz: boolean[][] }>();

/** A configuração do código de um link (determinística: o mesmo link dá sempre o mesmo código, na web e no app). */
export function escolherConfiguracao(texto: string, estilo: EstiloCodigo = 'rosto', centro: CentroCodigo = 'sorriso'): { config: ConfiguracaoCodigo; matriz: boolean[][] } {
  const chave = `${estilo}\n${centro}\n${texto}`;
  const pronta = escolhas.get(chave);
  if (pronta) return pronta;
  // Da menor versão para a maior: a primeira versão com uma candidata com centro que passa decide (as maiores perderiam
  // no módulo). Sem nenhuma com centro, vale a melhor sem centro de todas.
  const pares = paresDoTexto(texto);
  const bases: BaseNivel[] = [];
  const mascaraBase = new Map<string, number>();
  let melhor: ConfiguracaoCodigo | null = null;
  for (let i = 0; i < pares.length; i++) {
    const base = baseDe(texto, pares[i].nivel, pares[i].versao);
    bases.push(base);
    mascaraBase.set(`${base.nivel}${base.versao}`, base.base);
    for (const c of candidatasDeBases([base], estilo, centro)) if (passaNaFolga(c) && (!melhor || comparar(c, melhor, mascaraBase) < 0)) melhor = c;
    const fimDaVersao = i === pares.length - 1 || pares[i + 1].versao !== base.versao;
    if (fimDaVersao && melhor && melhor.clareira > 0) break;
  }
  if (!melhor) throw new Error('nenhuma configuração do Código Studoo passou na folga'); // sem centro e sem ponte, nada é estragado
  const escolhida = melhor;
  const base = bases.find((b) => b.nivel === escolhida.nivel && b.versao === escolhida.versao)!;
  const resultado = { config: escolhida, matriz: trocarMascara(base.matriz, base.versao, base.nivel, base.base, escolhida.mascara) };
  if (escolhas.size > 200) escolhas.clear();
  escolhas.set(chave, resultado);
  return resultado;
}

/** A matriz do QR (UTF-8) na configuração escolhida, `true` = escuro. */
export function matrizCodigo(texto: string, estilo: EstiloCodigo = 'rosto', centro: CentroCodigo = 'sorriso'): boolean[][] {
  return escolherConfiguracao(texto, estilo, centro).matriz;
}

export function geometriaCodigoStudoo(texto: string, { estilo = 'rosto', centro = 'sorriso' }: { estilo?: EstiloCodigo; centro?: CentroCodigo } = {}): GeometriaCodigo {
  const { config, matriz } = escolherConfiguracao(texto, estilo, centro);
  const { nivel, versao } = config;
  const n = matriz.length;
  const m = MARGEM_CODIGO;
  const reservado = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const reservar = (r0: number, c0: number, tam: number) => {
    for (let r = r0; r < r0 + tam; r++) for (let c = c0; c < c0 + tam; c++) if (r >= 0 && c >= 0 && r < n && c < n) reservado[r][c] = true;
  };
  // Olhos (7×7) nos três cantos.
  const cantos = [[0, 0], [0, n - 7], [n - 7, 0]];
  for (const [r, c] of cantos) reservar(r, c, 7);
  // Alinhamentos (5×5), fora dos olhos.
  const posicoes = ALINHAMENTO[versao] ?? [];
  let centrosAlinhamento: [number, number][] = [];
  for (const r of posicoes) for (const c of posicoes) {
    if ((r < 9 && c < 9) || (r < 9 && c > n - 10) || (r > n - 10 && c < 9)) continue;
    centrosAlinhamento.push([r, c]);
    reservar(r - 2, c - 2, 5);
  }
  // Clareira (lado escolhido pela folga). Da versão 7 em diante ela cobre o alinhamento do centro (padrão de função:
  // apagá-lo não custa dados; os leitores usam o de baixo à direita).
  let area: GeometriaCodigo['clareira'] = null;
  if (config.clareira) {
    const inicio = (n - config.clareira) / 2;
    const meio = (n - 1) / 2;
    area = { x: inicio + m, y: inicio + m, lado: config.clareira };
    for (let r = inicio; r < inicio + config.clareira; r++) for (let c = inicio; c < inicio + config.clareira; c++) if (naClareira(r, c, n, config.clareira)) reservado[r][c] = true;
    centrosAlinhamento = centrosAlinhamento.filter(([r, c]) => !(r === meio && c === meio));
  }
  // Ponte cheia: a linha 3 entre as lentes vira a ponte (desenhada à parte; a conta da folga cobre os módulos).
  if (config.ponte === 'normal') for (let c = 8; c < n - 8; c++) reservado[3][c] = true;
  const escuro = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && matriz[r][c] && !reservado[r][c];

  const partes: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!escuro(r, c)) continue;
      const x = c + m;
      const y = r + m;
      if (estilo === 'rosto') {
        partes.push(circulo(x + 0.5, y + 0.5, 0.44));
      } else if (estilo === 'trilha') {
        // Pedrinha em cada módulo; ligação com o vizinho à direita e embaixo (caminho arredondado).
        partes.push(circulo(x + 0.5, y + 0.5, 0.4));
        if (escuro(r, c + 1)) partes.push(retangulo(x + 0.5, y + 0.14, 1, 0.72, 0));
        if (escuro(r + 1, c)) partes.push(retangulo(x + 0.14, y + 0.5, 0.72, 1, 0));
      } else if (!escuro(r - 1, c)) {
        // Capim: a coluna de módulos escuros seguidos vira uma folha (cápsula vertical).
        let fim = r;
        while (escuro(fim + 1, c)) fim++;
        partes.push(retangulo(x + 0.08, y + 0.05, 0.84, fim - r + 1 - 0.1, 0.42));
      }
    }
  }

  const olhos: OlhoCodigo[] = cantos.map(([r, c]) => {
    const x = c + m;
    const y = r + m;
    if (estilo === 'rosto') {
      // Lente: anel de espessura 1 e pupila de diâmetro 3 (1:1:3:1:1 nas linhas pelo centro).
      return { x, y, anel: `${circulo(x + 3.5, y + 3.5, 3.5)}${circulo(x + 3.5, y + 3.5, 2.5, false)}`, miolo: circulo(x + 3.5, y + 3.5, 1.5) };
    }
    if (estilo === 'trilha') {
      // Nó de lição: quadrado arredondado com miolo.
      return { x, y, anel: `${retangulo(x, y, 7, 7, 2.1)}${retangulo(x + 1, y + 1, 5, 5, 1.3).replace(/a([\d.]+) ([\d.]+) 0 0 1/g, 'a$1 $2 0 0 1')}`, miolo: retangulo(x + 2, y + 2, 3, 3, 0.95) };
    }
    // Capim: anel e miolo em folha (dois cantos opostos arredondados, dois quase vivos).
    return { x, y, anel: `${folha(x, y, 7, 2.6, 0.5)}${folha(x + 1, y + 1, 5, 1.8, 0.3)}`, miolo: folha(x + 2, y + 2, 3, 1.1, 0.2) };
  });

  const alinhamentos = centrosAlinhamento.map(([r, c]) => {
    const x = c - 2 + m;
    const y = r - 2 + m;
    const anel = estilo === 'rosto'
      ? `${circulo(x + 2.5, y + 2.5, 2.5)}${circulo(x + 2.5, y + 2.5, 1.5, false)}`
      : `${retangulo(x, y, 5, 5, 1.4)}${retangulo(x + 1, y + 1, 3, 3, 0.7)}`;
    return { x, y, anel, miolo: circulo(x + 2.5, y + 2.5, 0.5) };
  });

  let enfeite = '';
  let enfeiteFundo = '';
  if (config.ponte === 'normal') {
    // Ponte cheia: um arco suave da borda da lente esquerda à da direita, na altura do centro das lentes.
    enfeite = `M${f(m + 8.15)} ${f(m + 3.9)}Q${f(m + n / 2)} ${f(m + 3.5)} ${f(m + n - 8.15)} ${f(m + 3.9)}L${f(m + n - 8.15)} ${f(m + 3.1)}Q${f(m + n / 2)} ${f(m + 2.7)} ${f(m + 8.15)} ${f(m + 3.1)}Z`;
  } else if (config.ponte === 'fina') {
    // Ponte fina: passa entre as linhas 2 e 3 (centros em 2,5 e 3,5) sem cobrir o centro de nenhum módulo. Um canal
    // claro de 2,7 a 3,3 separa a ponte dos pontos vizinhos (0,2 de folga até cada centro), e o arco, de 0,46 de
    // espessura, não sai do canal (bordas entre 2,73 e 3,27). Ponte e canal começam a 0,6 da lente (que acaba em 7):
    // encostada na lente, a ponte emendava no anel e confundia o localizador de olhos do jsQR em tela cheia.
    const x0 = 7.6;
    enfeiteFundo = retangulo(m + x0, m + 2.7, n - 2 * x0, 0.6, 0.3);
    const e = 0.23;
    enfeite = `M${f(m + x0)} ${f(m + 3.04 - e)}Q${f(m + n / 2)} ${f(m + 2.88 - e)} ${f(m + n - x0)} ${f(m + 3.04 - e)}L${f(m + n - x0)} ${f(m + 3.04 + e)}Q${f(m + n / 2)} ${f(m + 2.88 + e)} ${f(m + x0)} ${f(m + 3.04 + e)}Z`;
  }
  return { estilo, modulos: n, lado: n + 2 * m, dados: partes.join(''), olhos, alinhamentos, clareira: area, enfeite, enfeiteFundo, nivel, versao, configuracao: config };
}

/** Cores do código: dados e anéis em tons escuros; o miolo dos olhos aceita a cor do perfil. */
export interface CoresCodigo {
  dados: string;
  /** Segundo tom dos dados (degradê vertical no estilo capim). */
  dadosTopo?: string;
  anel: string;
  miolo: string;
  fundo: string;
}

export const CORES_CODIGO_PADRAO: CoresCodigo = { dados: '#1b2a5e', dadosTopo: '#2a44a8', anel: '#1b2a5e', miolo: '#3858d6', fundo: '#ffffff' };

/**
 * Diâmetro do desenho do centro (em módulos): o círculo vai quase até os pontos vizinhos, a 0,12 da borda do ponto mais
 * perto, sem cobrir o centro de nenhum módulo. Assim o anel claro em volta fica estreito demais para o disco (uma foto
 * escura, por exemplo) parecer um olho do QR na proporção 1:1:3:1:1, o que confundia o ZXing.
 */
export function diametroDoCentro(lado: number): number {
  let maisPerto = Infinity;
  const raio = lado / 2;
  for (let dr = -Math.ceil(raio) - 1; dr <= Math.ceil(raio) + 1; dr++) for (let dc = -Math.ceil(raio) - 1; dc <= Math.ceil(raio) + 1; dc++) {
    const d = Math.hypot(dr, dc);
    if (d > raio) maisPerto = Math.min(maisPerto, d);
  }
  return 2 * Math.min(maisPerto - 0.44 - 0.12, raio - 0.1);
}

/** O sorriso do Stu (centro do estilo rosto: com as lentes e a ponte, o código inteiro vira o rosto dele). */
export const SORRISO_SVG = '<path d="M10 36q40 40 80 0" fill="none" stroke="#3858d6" stroke-width="16" stroke-linecap="round"/>';

/** O Stu em vetor (quadrado arredondado azul, óculos redondos e sorriso), numa caixa de 100×100. */
export const STU_SVG = '<rect width="100" height="100" rx="24" fill="#3858d6"/><g fill="none" stroke="#fff" stroke-linecap="round" stroke-width="7"><circle cx="33" cy="43" r="11.5"/><circle cx="67" cy="43" r="11.5"/><path d="M44.5 41.5q5.5-3 11 0"/><path d="M35 64q15 11 30 0"/></g>';

/**
 * O código em SVG (texto puro, sem DOM): `tamanho` em px; `centro` é o SVG de 100×100 que vai na clareira (o Stu por
 * padrão; o avatar do autor na etapa de perfil). A margem de silêncio está incluída.
 */
export function svgCodigoStudoo(g: GeometriaCodigo, { tamanho = 1200, cores = CORES_CODIGO_PADRAO, centro }: { tamanho?: number; cores?: CoresCodigo; centro?: string | null } = {}): string {
  if (centro === undefined) centro = g.estilo === 'rosto' ? SORRISO_SVG : STU_SVG;
  const gradiente = g.estilo === 'capim' && cores.dadosTopo
    ? `<defs><linearGradient id="cs-dados" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${cores.dados}"/><stop offset="1" stop-color="${cores.dadosTopo}"/></linearGradient></defs>`
    : '';
  const preenchimento = gradiente ? 'url(#cs-dados)' : cores.dados;
  const clareira = g.clareira && centro
    ? `<svg x="${f(g.clareira.x + (g.clareira.lado - diametroDoCentro(g.clareira.lado)) / 2)}" y="${f(g.clareira.y + (g.clareira.lado - diametroDoCentro(g.clareira.lado)) / 2)}" width="${f(diametroDoCentro(g.clareira.lado))}" height="${f(diametroDoCentro(g.clareira.lado))}" viewBox="0 0 100 100">${centro}</svg>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${g.lado} ${g.lado}">${gradiente}`
    + `<rect width="${g.lado}" height="${g.lado}" fill="${cores.fundo}"/>`
    + `<path d="${g.dados}" fill="${preenchimento}"/>`
    + g.olhos.map((o) => `<path d="${o.anel}" fill="${cores.anel}" fill-rule="evenodd"/><path d="${o.miolo}" fill="${cores.miolo}"/>`).join('')
    + g.alinhamentos.map((a) => `<path d="${a.anel}" fill="${cores.anel}" fill-rule="evenodd"/><path d="${a.miolo}" fill="${cores.anel}"/>`).join('')
    + (g.enfeiteFundo ? `<path d="${g.enfeiteFundo}" fill="${cores.fundo}"/>` : '')
    + (g.enfeite ? `<path d="${g.enfeite}" fill="${cores.anel}"/>` : '')
    + clareira
    + '</svg>';
}

/** O centro com a foto da pessoa num círculo branco (caixa 100×100 do centro do código). `href`: endereço ou data URL. */
export function centroComFoto(href: string): string {
  const seguro = href.replace(/["<>]/g, '');
  return '<defs><clipPath id="cs-foto"><circle cx="50" cy="50" r="48"/></clipPath></defs><circle cx="50" cy="50" r="50" fill="#fff"/>'
    + `<image href="${seguro}" x="2" y="2" width="96" height="96" preserveAspectRatio="xMidYMid slice" clip-path="url(#cs-foto)"/>`;
}

/** Um tom claro da cor (mistura com o branco), para o fundo do disco da inicial. */
export function corClara(hex: string, branco = 0.84): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#e6ecfb';
  return `#${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - branco) + 255 * branco).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * O centro com a inicial do nome (perfil sem foto): disco num tom claro da cor do perfil e a letra na cor. Ao contrário
 * (letra branca num disco escuro), a letra desenhava um falso olho do QR e o ZXing errava 1 em cada 100 (medido).
 */
export function centroComInicial(inicial: string, cor: string, comLetra = true): string {
  const letra = (inicial.trim()[0] ?? '?').replace(/[<>&"']/g, '?');
  const fundo = /^#[0-9a-f]{6}$/i.test(cor) ? cor : '#3858d6';
  return `<circle cx="50" cy="50" r="50" fill="#fff"/><circle cx="50" cy="50" r="46" fill="${corClara(fundo)}"/>`
    + (comLetra ? `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Quicksand, Nunito, sans-serif" font-weight="700" font-size="52" fill="${fundo}">${letra}</text>` : '');
}

/**
 * Onde fica o centro do código (em fração do lado total, 0 a 1) e o tamanho da letra da inicial: para quem desenha a
 * letra por fora do SVG (o canvas da imagem baixada, que não enxerga as fontes da página dentro de um SVG-imagem).
 */
export function centroDoCodigo(texto: string, estilo: EstiloCodigo = 'rosto'): { cx: number; cy: number; letra: number } | null {
  // Só a inicial usa esta conta: o centro é um disco.
  const g = geometriaCodigoStudoo(texto, { estilo, centro: 'disco' });
  if (!g.clareira) return null;
  const caixa = diametroDoCentro(g.clareira.lado) / g.lado;
  return { cx: (g.clareira.x + g.clareira.lado / 2) / g.lado, cy: (g.clareira.y + g.clareira.lado / 2) / g.lado, letra: caixa * 0.52 };
}

/**
 * O Código Studoo de um link (spec 10, etapa C1), igual na web e no app: estilo "rosto" por padrão (os três ficam no
 * gerador), miolo dos olhos na cor do perfil (`mioloCor`, um hex de FUNDO_DA_COR) e, quando houver, a foto no centro.
 */
export function svgCodigoDoLink(texto: string, { mioloCor, fotoHref, inicial, letraNoCentro = true, estilo = 'rosto', tamanho = 600 }: { mioloCor?: string; fotoHref?: string | null; inicial?: string | null; letraNoCentro?: boolean; estilo?: EstiloCodigo; tamanho?: number } = {}): string {
  const cores = { ...CORES_CODIGO_PADRAO, ...(mioloCor ? { miolo: mioloCor } : {}) };
  // Centro: a foto; sem foto, a inicial na cor (perfil); sem nenhum dos dois, o sorriso do Stu (trilha).
  const centro = fotoHref ? centroComFoto(fotoHref) : inicial ? centroComInicial(inicial, mioloCor ?? '#3858d6', letraNoCentro) : undefined;
  return svgCodigoStudoo(geometriaCodigoStudoo(texto, { estilo, centro: fotoHref || inicial ? 'disco' : 'sorriso' }), { tamanho, cores, ...(centro ? { centro } : {}) });
}
