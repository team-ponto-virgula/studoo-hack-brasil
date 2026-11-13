/*
 * Desenhos do mundo da trilha. O cenário usa só formas simples (círculo, elipse, retângulo, triângulo e cúpula),
 * para a web desenhar em SVG (src/ui/mundo.tsx) e o app com View (apps/mobile/src/mundo.tsx), com o mesmo resultado.
 * Este arquivo é igual nos dois lados; tests/paridade-mundo.test.mjs confere.
 */

export const coresMundo = {
  // Chão de cada região, claro para o texto escuro manter o contraste, e o relevo, um tom acima.
  campo: '#E3F4DA',
  campoRelevo: '#C9E9BB',
  floresta: '#D2ECD8',
  florestaRelevo: '#B1DDBE',
  montanha: '#E8E7F7',
  montanhaRelevo: '#D1CFEF',
  lago: '#DCEEFE',
  lagoRelevo: '#BFDDFA',
  vila: '#FCEEE3',
  vilaRelevo: '#F4DAC5',
  nuvens: '#ECEFFE',
  nuvensRelevo: '#D8DEFB',
  ceu: '#EAF1FF',
  // Elementos do cenário.
  folha: '#78C88B',
  folhaClara: '#A6DDB1',
  folhaEscura: '#4E9F68',
  pinho: '#3E8E62',
  pinhoClaro: '#5AAE7C',
  tronco: '#A87650',
  troncoClaro: '#D9A877',
  pedra: '#B5BCD4',
  pedraClara: '#D8DCEA',
  pedraEscura: '#979FBF',
  rocha: '#8F8CC6',
  rochaClara: '#B6B3DF',
  neve: '#FFFFFF',
  agua: '#86C1F4',
  aguaClara: '#B8DAFA',
  telhado: '#EF8467',
  parede: '#FFFFFF',
  porta: '#C46E4C',
  portaEscura: '#9E5236',
  chamine: '#B8644A',
  janela: '#9CCBF3',
  flor: '#F38FB0',
  florAmarela: '#FFD166',
  miolo: '#FFAE1A',
  nuvem: '#FFFFFF',
  sol: '#FFD166',
  solHalo: '#FFEDB8',
  bandeira: '#F2667A',
  acao: '#3858D6',
  acaoClara: '#8DA2F2',
  acaoEscura: '#2A44A8',
  sombra: 'rgba(27, 42, 94, 0.12)',
} as const;

export type CorMundo = keyof typeof coresMundo;

/**
 * Formas na grade do desenho. `x` e `y` são o centro no círculo e na elipse e o canto de cima à esquerda nas outras.
 * O triângulo aponta para cima (ou para baixo, invertido); a cúpula tem a base reta e o topo em meio círculo.
 * O giro, em graus, é em torno do centro do retângulo.
 */
export type Forma =
  | { forma: 'circulo'; x: number; y: number; r: number; cor: CorMundo }
  | { forma: 'elipse'; x: number; y: number; rx: number; ry: number; cor: CorMundo }
  | { forma: 'retangulo'; x: number; y: number; largura: number; altura: number; raio: number; giro: number; cor: CorMundo }
  | { forma: 'triangulo'; x: number; y: number; largura: number; altura: number; invertido: boolean; cor: CorMundo }
  | { forma: 'cupula'; x: number; y: number; largura: number; altura: number; cor: CorMundo };

export type Desenho = { largura: number; altura: number; formas: readonly Forma[] };

const c = (x: number, y: number, r: number, cor: CorMundo): Forma => ({ forma: 'circulo', x, y, r, cor });
const e = (x: number, y: number, rx: number, ry: number, cor: CorMundo): Forma => ({ forma: 'elipse', x, y, rx, ry, cor });
const r = (x: number, y: number, largura: number, altura: number, cor: CorMundo, raio = 0, giro = 0): Forma =>
  ({ forma: 'retangulo', x, y, largura, altura, raio, giro, cor });
const t = (x: number, y: number, largura: number, altura: number, cor: CorMundo, invertido = false): Forma =>
  ({ forma: 'triangulo', x, y, largura, altura, invertido, cor });
const d = (x: number, y: number, largura: number, altura: number, cor: CorMundo): Forma => ({ forma: 'cupula', x, y, largura, altura, cor });

export const desenhosMundo = {
  arvore: { largura: 40, altura: 52, formas: [
    e(20, 49, 13, 3, 'sombra'), r(17, 30, 6, 19, 'tronco', 2),
    c(12, 27, 9, 'folhaEscura'), c(28, 27, 9, 'folhaEscura'), c(20, 19, 14, 'folha'), c(15, 14, 5, 'folhaClara'),
  ] },
  arbusto: { largura: 40, altura: 26, formas: [
    e(20, 23.5, 16, 2.5, 'sombra'), c(11, 16, 8, 'folhaEscura'), c(29, 16, 8, 'folhaEscura'), c(20, 12, 10, 'folha'),
    c(16, 8, 3.5, 'folhaClara'),
  ] },
  flores: { largura: 28, altura: 24, formas: [
    e(14, 22, 10, 2, 'sombra'), r(7, 11, 2, 11, 'folhaEscura', 1), r(19, 13, 2, 9, 'folhaEscura', 1), e(12.5, 17.5, 3, 1.4, 'folha'),
    c(8, 5.5, 3, 'flor'), c(11.5, 9, 3, 'flor'), c(8, 12.5, 3, 'flor'), c(4.5, 9, 3, 'flor'), c(8, 9, 2.3, 'miolo'),
    c(20, 8, 2.6, 'florAmarela'), c(23, 11, 2.6, 'florAmarela'), c(20, 14, 2.6, 'florAmarela'), c(17, 11, 2.6, 'florAmarela'),
    c(20, 11, 2, 'parede'),
  ] },
  relva: { largura: 20, altura: 14, formas: [
    t(2, 4, 5, 10, 'folhaEscura'), t(7.5, 0, 5, 14, 'folha'), t(13, 3, 5, 11, 'folhaEscura'),
  ] },
  pinheiro: { largura: 34, altura: 56, formas: [
    e(17, 53, 11, 3, 'sombra'), r(15, 42, 4, 11, 'tronco', 1),
    t(2, 28, 30, 18, 'pinho'), t(5, 16, 24, 17, 'pinhoClaro'), t(9, 4, 16, 16, 'pinho'),
  ] },
  cogumelo: { largura: 24, altura: 22, formas: [
    e(12, 20.5, 9, 1.6, 'sombra'), r(9, 10, 6, 10, 'parede', 2), d(3, 2, 18, 10, 'telhado'),
    c(8.5, 7, 1.6, 'parede'), c(14, 5.5, 1.3, 'parede'), c(15.5, 9, 1.1, 'parede'),
  ] },
  tronco: { largura: 36, altura: 16, formas: [
    e(18, 14.5, 15, 1.6, 'sombra'), r(3, 4, 28, 10, 'tronco', 5), e(31, 9, 3.5, 5, 'troncoClaro'), c(31, 9, 1.5, 'tronco'),
  ] },
  pedra: { largura: 36, altura: 22, formas: [
    e(18, 20, 15, 2.2, 'sombra'), d(3, 5, 24, 15, 'pedra'), d(8, 7, 8, 5, 'pedraClara'), d(22, 11, 12, 9, 'pedraEscura'),
  ] },
  picos: { largura: 64, altura: 44, formas: [
    t(26, 10, 38, 34, 'rochaClara'), t(39.97, 10, 10.06, 9, 'neve'),
    t(0, 2, 46, 42, 'rocha'), t(16.43, 2, 13.14, 12, 'neve'),
    t(16.43, 14, 4.38, 3, 'neve', true), t(20.81, 14, 4.38, 3, 'neve', true), t(25.19, 14, 4.38, 3, 'neve', true),
  ] },
  lagoa: { largura: 64, altura: 30, formas: [
    e(32, 16, 30, 12, 'agua'), r(16, 12, 14, 3, 'aguaClara', 1.5), r(36, 18, 12, 3, 'aguaClara', 1.5),
  ] },
  ondas: { largura: 40, altura: 14, formas: [
    r(2, 3, 16, 3.5, 'aguaClara', 1.75), r(20, 8, 18, 3.5, 'aguaClara', 1.75),
  ] },
  barco: { largura: 36, altura: 34, formas: [
    e(18, 31, 15, 2, 'aguaClara'), r(15.5, 3, 2, 22, 'tronco', 1), r(17.5, 2, 6, 3.5, 'bandeira', 1),
    t(9.5, 5, 14, 19, 'parede'), r(4, 24, 28, 6, 'porta', 3),
  ] },
  casa: { largura: 40, altura: 40, formas: [
    e(20, 37.5, 16, 2.5, 'sombra'), r(26, 6, 5, 9, 'chamine'), r(7, 17, 26, 19, 'parede', 2), t(3, 4, 34, 15, 'telhado'),
    r(16, 25, 8, 11, 'porta', 2), r(26, 21, 5, 5, 'janela', 1), r(9, 21, 5, 5, 'janela', 1),
  ] },
  nuvem: { largura: 52, altura: 26, formas: [
    c(16, 15, 10, 'nuvem'), c(29, 11, 11.5, 'nuvem'), c(40, 16, 8.5, 'nuvem'), r(8, 15, 40, 9.5, 'nuvem', 4.75),
  ] },
  balao: { largura: 32, altura: 44, formas: [
    c(16, 14, 12, 'telhado'), t(5.2, 18, 21.6, 13, 'telhado', true), r(14, 2, 4, 26, 'florAmarela', 2),
    r(12.5, 30, 1, 6, 'tronco'), r(18.5, 30, 1, 6, 'tronco'), r(11, 35, 10, 7, 'porta', 2),
  ] },
  estrela: { largura: 20, altura: 20, formas: [
    r(8.5, 1, 3, 18, 'sol', 1.5), r(1, 8.5, 18, 3, 'sol', 1.5),
    r(8.75, 4, 2.5, 12, 'sol', 1.25, 45), r(4, 8.75, 12, 2.5, 'sol', 1.25, 45),
  ] },
  sol: { largura: 40, altura: 40, formas: [c(20, 20, 19, 'solHalo'), c(20, 20, 12, 'sol')] },
  bandeira: { largura: 28, altura: 44, formas: [
    e(8, 41.5, 7, 2, 'sombra'), r(6.5, 3, 3, 39, 'tronco', 1.5), r(9.5, 4, 15, 10, 'bandeira', 2),
  ] },
  // Ícones das áreas de interesse no pedido, na grade de 24.
  temaPopulares: { largura: 24, altura: 24, formas: [
    r(10.5, 2, 3, 20, 'miolo', 1.5), r(2, 10.5, 20, 3, 'miolo', 1.5),
    r(10.75, 5.5, 2.5, 13, 'miolo', 1.25, 45), r(5.5, 10.75, 13, 2.5, 'miolo', 1.25, 45), c(12, 12, 3.5, 'sol'),
  ] },
  temaIdiomas: { largura: 24, altura: 24, formas: [
    r(1.5, 2.5, 15, 10.5, 'agua', 3.5), t(4, 12, 5, 4.5, 'agua', true),
    r(8.5, 9.5, 14, 10, 'acao', 3.5), t(15.5, 19, 4.5, 4, 'acao', true),
    c(5.5, 7.75, 1.3, 'parede'), c(9, 7.75, 1.3, 'parede'), c(12.5, 7.75, 1.3, 'parede'),
  ] },
  temaMusica: { largura: 24, altura: 24, formas: [
    r(9.5, 4.5, 2.2, 14, 'flor', 1.1), r(19.3, 2.5, 2.2, 14, 'flor', 1.1), r(9.6, 3, 12, 3.2, 'flor', 1.2, -10),
    e(7.3, 18.5, 3.8, 3, 'flor'), e(17.1, 16.5, 3.8, 3, 'flor'),
  ] },
  temaMatematica: { largura: 24, altura: 24, formas: [
    r(3, 5.25, 7.5, 2.5, 'miolo', 1.25), r(5.5, 2.75, 2.5, 7.5, 'miolo', 1.25), r(13.5, 5.25, 7.5, 2.5, 'acao', 1.25),
    r(3, 16.25, 7.5, 2.5, 'acao', 1.25, 45), r(3, 16.25, 7.5, 2.5, 'acao', 1.25, -45),
    r(13.5, 14.5, 7.5, 2.5, 'miolo', 1.25), r(13.5, 18, 7.5, 2.5, 'miolo', 1.25),
  ] },
  temaCiencias: { largura: 24, altura: 24, formas: [
    t(3, 7, 18, 15.5, 'folha'), r(9.5, 4, 5, 8, 'folha'), r(8, 2, 8, 3, 'folhaEscura', 1.5),
    t(5.5, 14.5, 13, 8, 'folhaEscura'), c(10.5, 18.5, 1.5, 'parede'), c(13.5, 15.5, 1.1, 'parede'),
  ] },
  temaTecnologia: { largura: 24, altura: 24, formas: [
    r(4, 4, 16, 11.5, 'acao', 2), r(6, 6, 12, 7.5, 'janela', 1), r(1.5, 16.5, 21, 3.5, 'acaoEscura', 1.75),
  ] },
  temaArtes: { largura: 24, altura: 24, formas: [
    c(12, 12, 10, 'troncoClaro'), c(15.5, 15.8, 2.6, 'parede'),
    c(7.5, 9, 2.2, 'flor'), c(11.5, 6.2, 2.2, 'agua'), c(16.2, 7.8, 2.2, 'florAmarela'), c(7, 14.2, 2.2, 'folha'),
  ] },
  temaCarreira: { largura: 24, altura: 24, formas: [
    r(8.5, 3, 7, 2.2, 'portaEscura', 1.1), r(8.5, 3, 2, 5, 'portaEscura', 1), r(13.5, 3, 2, 5, 'portaEscura', 1),
    r(2, 7, 20, 14, 'porta', 3), r(2, 12.5, 20, 2, 'portaEscura'), r(10.5, 11, 3, 5, 'florAmarela', 1),
  ] },
  temaDiaADia: { largura: 24, altura: 24, formas: [
    r(11.25, 8, 1.5, 7, 'folhaEscura', 0.75), c(8.3, 8.2, 3.6, 'folha'), c(15.7, 7.2, 3.6, 'folha'), c(12, 4.5, 2.6, 'folhaClara'),
    r(5.5, 13.5, 13, 3, 'porta', 1.5), r(7, 15.5, 10, 6.5, 'telhado', 2),
  ] },
} satisfies Record<string, Desenho>;

export type NomeDesenho = keyof typeof desenhosMundo;

/** Desenhos que balançam devagar com o vento no mapa; pedras, casas, água e montanhas ficam paradas. */
export const desenhosQueBalancam: ReadonlySet<NomeDesenho> = new Set<NomeDesenho>(
  ['arvore', 'pinheiro', 'arbusto', 'flores', 'relva', 'cogumelo', 'balao', 'nuvem'],
);

/**
 * Regiões do mundo, uma por trecho da trilha, em ciclo: dos campos à floresta e às montanhas, e depois o lago, a vila e
 * as nuvens. A região é só cenário: não tem nome na tela nem agrupa lições por assunto (spec 03).
 */
export const regioesMundo = [
  { id: 'campos', chao: 'campo', relevo: 'campoRelevo',
    enfeites: ['arvore', 'flores', 'arbusto', 'lagoa', 'arvore', 'flores'], miudos: ['relva', 'flores', 'relva'],
    fronteira: ['arbusto', 'arvore', 'flores', 'arvore'] },
  { id: 'floresta', chao: 'floresta', relevo: 'florestaRelevo',
    enfeites: ['pinheiro', 'cogumelo', 'pinheiro', 'tronco', 'pinheiro', 'arbusto'], miudos: ['cogumelo', 'relva', 'relva'],
    fronteira: ['pinheiro', 'pinheiro', 'cogumelo', 'pinheiro'] },
  { id: 'montanhas', chao: 'montanha', relevo: 'montanhaRelevo',
    enfeites: ['picos', 'pedra', 'pinheiro', 'picos', 'pedra', 'pinheiro'], miudos: ['pedra', 'relva', 'pedra'],
    fronteira: ['picos', 'pedra', 'picos', 'pinheiro'] },
  { id: 'lago', chao: 'lago', relevo: 'lagoRelevo',
    enfeites: ['barco', 'ondas', 'nuvem', 'ondas', 'barco', 'ondas'], miudos: ['ondas', 'ondas', 'ondas'],
    fronteira: ['ondas', 'barco', 'ondas', 'ondas'] },
  { id: 'vila', chao: 'vila', relevo: 'vilaRelevo',
    enfeites: ['casa', 'arvore', 'flores', 'casa', 'arbusto', 'arvore'], miudos: ['flores', 'relva', 'flores'],
    fronteira: ['casa', 'arbusto', 'casa', 'arvore'] },
  { id: 'nuvens', chao: 'nuvens', relevo: 'nuvensRelevo',
    enfeites: ['nuvem', 'balao', 'estrela', 'nuvem', 'balao', 'estrela'], miudos: ['estrela', 'estrela', 'estrela'],
    fronteira: ['nuvem', 'balao', 'nuvem', 'estrela'] },
] as const satisfies readonly {
  id: string;
  chao: CorMundo;
  relevo: CorMundo;
  enfeites: readonly NomeDesenho[];
  miudos: readonly NomeDesenho[];
  fronteira: readonly NomeDesenho[];
}[];

export type RegiaoMundo = (typeof regioesMundo)[number];

/** Região de um trecho: os trechos seguem o ciclo das regiões. */
export function regiaoDoTrecho(trecho: number): RegiaoMundo {
  return regioesMundo[((trecho % regioesMundo.length) + regioesMundo.length) % regioesMundo.length];
}

/** Enfeites de uma linha do caminho, escolhidos pela posição do nó para variar sem sorteio (a tela não muda ao redesenhar). */
export function enfeitesDaLinha(trecho: number, indice: number) {
  const regiao = regiaoDoTrecho(trecho);
  return {
    grande: regiao.enfeites[indice % regiao.enfeites.length],
    miudo: regiao.miudos[indice % regiao.miudos.length],
  };
}
