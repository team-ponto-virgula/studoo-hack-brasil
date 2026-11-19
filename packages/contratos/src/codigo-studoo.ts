/*
 * Código Studoo: o QR com a cara do Studoo. Função pura (sem DOM e sem API do Node), compartilhada pela web e pelo app:
 * texto → matriz (correção de erro H) → geometria pronta para desenhar, em unidades de módulo, já com a margem de
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
  /** Clareira central (quadrada, módulos), onde entra o Stu ou o avatar. `null` quando não cabe com segurança. */
  clareira: { x: number; y: number; lado: number } | null;
  /** Desenho escuro a mais (no estilo rosto, a ponte dos óculos entre as duas lentes de cima). */
  enfeite: string;
  /** Correção de erro e versão escolhidas (ver `escolherNivel`). */
  nivel: NivelCorrecao;
  versao: number;
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

function gerarQr(texto: string, nivel: NivelCorrecao) {
  // O padrão da biblioteca corta cada caractere em 1 byte; o texto vai em UTF-8.
  const gerador = qrcode as unknown as typeof qrcode & { stringToBytes: (s: string) => number[] };
  gerador.stringToBytes = bytesUtf8;
  const qr = gerador(0, nivel);
  qr.addData(texto);
  qr.make();
  return qr;
}

/** Versão máxima sem alinhamento no centro: até a 6, o único alinhamento fica no canto de baixo à direita. */
export const VERSAO_SEM_ALINHAMENTO_CENTRAL = 6;

/**
 * A correção de erro do código: a mais forte que ainda cabe numa versão sem alinhamento no centro (H, depois Q, depois
 * M, até a versão 6), porque módulo maior lê melhor em projetor e em tela de celular. Link longo demais para isso (mais
 * de 106 bytes) fica em M, na menor versão (7 até 122 bytes), e a clareira cobre o alinhamento do centro (padrão de
 * função: apagá-lo não custa dados). Em H a versão 11 já não lê a 160 px. Provado com jsQR e ZXing em
 * `scripts/codigo-studoo-links.mjs` (links de 20 a 120 caracteres).
 */
export function escolherNivel(texto: string): NivelCorrecao {
  for (const nivel of ['H', 'Q', 'M'] as const) {
    if ((gerarQr(texto, nivel).getModuleCount() - 17) / 4 <= VERSAO_SEM_ALINHAMENTO_CENTRAL) return nivel;
  }
  return 'M';
}

/**
 * Lado máximo da clareira por correção: em M (15% de recuperação) ela fica em 7 módulos; em M com alinhamento no centro
 * (links de mais de 106 bytes), em 5, exatamente o alinhamento: não apaga nenhum módulo de dados. Medido: com 7, um caso
 * de borrão falhava no ZXing a 120 caracteres; com 5, nenhum.
 */
const CLAREIRA_MAXIMA: Record<NivelCorrecao, number> = { H: 99, Q: 99, M: 7, L: 5 };
const CLAREIRA_M_COM_ALINHAMENTO = 5;

/** A matriz do QR (UTF-8), `true` = escuro. Sem `nivel`, a escolha automática (`escolherNivel`). */
export function matrizCodigo(texto: string, nivel: NivelCorrecao = escolherNivel(texto)): boolean[][] {
  const qr = gerarQr(texto, nivel);
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

export function geometriaCodigoStudoo(texto: string, { estilo = 'rosto', clareira = 0.22, nivel: nivelPedido }: { estilo?: EstiloCodigo; clareira?: number; nivel?: NivelCorrecao } = {}): GeometriaCodigo {
  const nivel = nivelPedido ?? escolherNivel(texto);
  const matriz = matrizCodigo(texto, nivel);
  const n = matriz.length;
  const versao = (n - 17) / 4;
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
  // Clareira: lado ímpar, centrada, até `clareira` do lado. Da versão 7 em diante há um alinhamento exatamente no
  // centro: a clareira cobre esse alinhamento inteiro (lado de pelo menos 7) em vez de desistir do centro; os leitores
  // usam o alinhamento de baixo à direita. Desiste só se encostar em outro alinhamento.
  let area: GeometriaCodigo['clareira'] = null;
  const meio = (n - 1) / 2;
  const temAlinhamentoCentral = centrosAlinhamento.some(([r, c]) => r === meio && c === meio);
  let ladoClareira = Math.min(Math.max(Math.floor(n * clareira), temAlinhamentoCentral ? 7 : 0), CLAREIRA_MAXIMA[nivel]);
  if (nivel === 'M' && temAlinhamentoCentral) ladoClareira = CLAREIRA_M_COM_ALINHAMENTO;
  if (ladoClareira % 2 === 0) ladoClareira -= 1;
  if (ladoClareira >= 5) {
    const inicio = (n - ladoClareira) / 2;
    const outros = centrosAlinhamento.filter(([r, c]) => !(r === meio && c === meio));
    const cobre = outros.some(([r, c]) => r + 2 >= inicio && r - 2 < inicio + ladoClareira && c + 2 >= inicio && c - 2 < inicio + ladoClareira);
    if (!cobre) {
      area = { x: inicio + m, y: inicio + m, lado: ladoClareira };
      reservar(inicio, inicio, ladoClareira);
      centrosAlinhamento = outros;
    }
  }
  // Rosto: a linha 3 entre as lentes de cima vira a ponte dos óculos (desenhada à parte; a correção H cobre os módulos).
  // A coluna separadora (clara) ao lado de cada lente fica livre: é ela que fecha o 1:1:3:1:1 na linha do centro.
  if (estilo === 'rosto') for (let c = 8; c < n - 8; c++) reservado[3][c] = true;
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

  // A ponte: um arco suave da borda da lente esquerda à da direita, na altura do centro das lentes.
  const enfeite = estilo === 'rosto'
    ? `M${f(m + 8.15)} ${f(m + 3.9)}Q${f(m + n / 2)} ${f(m + 3.5)} ${f(m + n - 8.15)} ${f(m + 3.9)}L${f(m + n - 8.15)} ${f(m + 3.1)}Q${f(m + n / 2)} ${f(m + 2.7)} ${f(m + 8.15)} ${f(m + 3.1)}Z`
    : '';
  return { estilo, modulos: n, lado: n + 2 * m, dados: partes.join(''), olhos, alinhamentos, clareira: area, enfeite, nivel, versao };
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
    ? `<svg x="${g.clareira.x + 0.7}" y="${g.clareira.y + 0.7}" width="${g.clareira.lado - 1.4}" height="${g.clareira.lado - 1.4}" viewBox="0 0 100 100">${centro}</svg>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${g.lado} ${g.lado}">${gradiente}`
    + `<rect width="${g.lado}" height="${g.lado}" fill="${cores.fundo}"/>`
    + `<path d="${g.dados}" fill="${preenchimento}"/>`
    + g.olhos.map((o) => `<path d="${o.anel}" fill="${cores.anel}" fill-rule="evenodd"/><path d="${o.miolo}" fill="${cores.miolo}"/>`).join('')
    + g.alinhamentos.map((a) => `<path d="${a.anel}" fill="${cores.anel}" fill-rule="evenodd"/><path d="${a.miolo}" fill="${cores.anel}"/>`).join('')
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

/** O centro com a inicial do nome num círculo na cor do perfil (perfil sem foto: o mesmo avatar de todo lugar). */
export function centroComInicial(inicial: string, cor: string): string {
  const letra = (inicial.trim()[0] ?? '?').replace(/[<>&"']/g, '?');
  const fundo = /^#[0-9a-f]{6}$/i.test(cor) ? cor : '#3858d6';
  return `<circle cx="50" cy="50" r="50" fill="#fff"/><circle cx="50" cy="50" r="46" fill="${fundo}"/>`
    + `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Quicksand, Nunito, sans-serif" font-weight="700" font-size="52" fill="#fff">${letra}</text>`;
}

/**
 * O Código Studoo de um link (spec 10, etapa C1), igual na web e no app: estilo "rosto" por padrão (os três ficam no
 * gerador), miolo dos olhos na cor do perfil (`mioloCor`, um hex de FUNDO_DA_COR) e, quando houver, a foto no centro.
 */
export function svgCodigoDoLink(texto: string, { mioloCor, fotoHref, inicial, estilo = 'rosto', tamanho = 600, nivel }: { mioloCor?: string; fotoHref?: string | null; inicial?: string | null; estilo?: EstiloCodigo; tamanho?: number; nivel?: NivelCorrecao } = {}): string {
  const cores = { ...CORES_CODIGO_PADRAO, ...(mioloCor ? { miolo: mioloCor } : {}) };
  // Centro: a foto; sem foto, a inicial na cor (perfil); sem nenhum dos dois, o sorriso do Stu (trilha).
  const centro = fotoHref ? centroComFoto(fotoHref) : inicial ? centroComInicial(inicial, mioloCor ?? '#3858d6') : undefined;
  return svgCodigoStudoo(geometriaCodigoStudoo(texto, { estilo, nivel }), { tamanho, cores, ...(centro ? { centro } : {}) });
}
