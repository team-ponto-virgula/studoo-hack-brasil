import { Platform, View, type ViewStyle } from 'react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import type { NomeIcone } from './trilha';

/** Ícones do perfil e do compartilhar: os mesmos elementos SVG da web (src/ui/caminho.tsx), na grade de 24, traço redondo. */
const DESENHOS_SVG = {
  pessoa: <><Circle cx="12" cy="8.5" r="3.8" /><Path d="M4.8 20c.9-3.8 3.7-5.8 7.2-5.8s6.3 2 7.2 5.8" /></>,
  compartilhar: <><Circle cx="17.5" cy="5.5" r="2.5" /><Circle cx="6.5" cy="12" r="2.5" /><Circle cx="17.5" cy="18.5" r="2.5" /><Path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4" /></>,
  copiar: <><Rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><Path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
  camera: <><Path d="M4 8.5A2 2 0 0 1 6 6.5h2l1.5-2h5l1.5 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><Circle cx="12" cy="13" r="3.5" /></>,
  imagem: <><Rect x="4" y="4.5" width="16" height="15" rx="3" /><Circle cx="9" cy="9.5" r="1.6" /><Path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5" /></>,
  lapis: <Path d="M14.5 5.5l4 4M5 19l1-4.5L15.5 5a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9.5 18z" />,
  lixeira: <Path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5M13.5 10.5v5" />,
  bussola: <><Circle cx="12" cy="12" r="8.5" /><Path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  // Valeu: coração com a curva de um sorriso (agradecer, não "curtir" uma pessoa).
  valeu: <Path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z" />,
  mais: <><Circle cx="6" cy="12" r="1.3" fill="currentColor" /><Circle cx="12" cy="12" r="1.3" fill="currentColor" /><Circle cx="18" cy="12" r="1.3" fill="currentColor" /></>,
  bandeirinha: <><Path d="M6 20.5V4" /><Path d="M6 4.5h11l-2.5 4 2.5 4H6" /></>,
  // Alerta (spec 11): o círculo com a exclamação dos erros de campo, da barra de salvar e do aviso.
  alerta: <><Circle cx="12" cy="12" r="8.5" /><Path d="M12 7.8v5.2" /><Circle cx="12" cy="16.3" r="0.6" fill="currentColor" /></>,
} as const;
type NomeIconeSvg = keyof typeof DESENHOS_SVG;
const ehSvg = (nome: NomeIcone): nome is NomeIconeSvg => Object.hasOwn(DESENHOS_SVG, nome);

/*
 * Ícones da trilha, os mesmos da web (src/ui/caminho.tsx), desenhados com View porque o app não usa SVG.
 * Cada medida está na grade de 24 da versão web, com traço de 2,5, e é escalada pelo tamanho pedido.
 */

/** `traco`: barra cheia (a espessura é o lado de 2,5); `recorte` + `filho`: um pedaço de círculo (arco) recortado. */
type Peca = ViewStyle & { traco?: boolean; recorte?: boolean; filho?: Peca };

const desenhos: Record<Exclude<NomeIcone, NomeIconeSvg>, Peca[]> = {
  check: [
    { left: 4.44, top: 6.98, width: 15, height: 7.25, borderLeftWidth: 2.5, borderBottomWidth: 2.5, transform: [{ rotate: '-45deg' }] },
  ],
  livro: [
    // Livro aberto: as duas páginas descem em direção à lombada, como na web.
    { left: 3.25, top: 4.25, width: 10, height: 14.5, borderWidth: 2.5, borderTopLeftRadius: 2, borderBottomLeftRadius: 2,
      transform: [{ skewY: '9deg' }] },
    { left: 10.75, top: 4.25, width: 10, height: 14.5, borderWidth: 2.5, borderTopRightRadius: 2, borderBottomRightRadius: 2,
      transform: [{ skewY: '-9deg' }] },
  ],
  // Repetir: um arco de três quartos com uma seta (dois arcos curtos ficavam picotados nesse tamanho).
  revisao: [
    { left: 3.25, top: 3.25, width: 17.5, height: 17.5, borderWidth: 2.5, borderRadius: 8.75, borderLeftColor: 'transparent' },
    { left: 4.6, top: 14.2, width: 6.5, height: 6.5, borderLeftWidth: 2.5, borderTopWidth: 2.5, borderTopLeftRadius: 1 },
  ],
  cadeado: [
    { left: 7.25, top: 3.25, width: 9.5, height: 7.25, borderWidth: 2.5, borderBottomWidth: 0,
      borderTopLeftRadius: 4.75, borderTopRightRadius: 4.75 },
    { left: 4.25, top: 9.25, width: 15.5, height: 11.5, borderWidth: 2.5, borderRadius: 3.75 },
  ],
  // Bandeira cheia: mastro e pano preenchido, legível mesmo pequena (a web preenche o mesmo desenho).
  bandeira: [
    { left: 4.75, top: 3.25, width: 2.5, height: 18, borderRadius: 1.25, traco: true },
    { left: 6, top: 3.75, width: 11.75, height: 9.5, borderTopRightRadius: 2, borderBottomRightRadius: 2, traco: true },
  ],
  trofeu: [
    { left: 6.75, top: 3.25, width: 10.5, height: 12, borderWidth: 2.5, borderBottomLeftRadius: 5.25, borderBottomRightRadius: 5.25 },
    { left: 4.25, top: 5.25, width: 3.75, height: 6, borderWidth: 2.5, borderRightWidth: 0,
      borderTopLeftRadius: 1.25, borderBottomLeftRadius: 3 },
    { left: 16, top: 5.25, width: 3.75, height: 6, borderWidth: 2.5, borderLeftWidth: 0,
      borderTopRightRadius: 1.25, borderBottomRightRadius: 3 },
    { left: 10.75, top: 14, width: 2.5, height: 4.75, traco: true },
    { left: 7.25, top: 18.75, width: 9.5, height: 2.5, borderRadius: 1.25, traco: true },
  ],
  // "M7 7l10 10M17 7L7 17" da web: cada diagonal com 14,14 + 2,5 das pontas redondas, centrada em (12, 12).
  fechar: [
    { left: 3.68, top: 10.75, width: 16.64, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '45deg' }] },
    { left: 3.68, top: 10.75, width: 16.64, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '-45deg' }] },
  ],
  // Olho como o da web: a amêndoa de 2,5 a 21,5 (dois arcos de círculo de raio 10,2 que se encontram nas pontas, cada um
  // recortado na sua metade) e a pupila em contorno (círculo de raio 3), não cheia.
  olho: [
    { left: 0, top: 0, width: 24, height: 12.6, recorte: true, filho: { left: 0.68, top: 4.37, width: 22.64, height: 22.64, borderWidth: 2.5, borderRadius: 11.32 } },
    { left: 0, top: 11.4, width: 24, height: 12.6, recorte: true, filho: { left: 0.68, top: -14.41, width: 22.64, height: 22.64, borderWidth: 2.5, borderRadius: 11.32 } },
    { left: 7.75, top: 7.75, width: 8.5, height: 8.5, borderWidth: 2.5, borderRadius: 4.25 },
  ],
  olhoFechado: [
    { left: 0, top: 0, width: 24, height: 12.6, recorte: true, filho: { left: 0.68, top: 4.37, width: 22.64, height: 22.64, borderWidth: 2.5, borderRadius: 11.32 } },
    { left: 0, top: 11.4, width: 24, height: 12.6, recorte: true, filho: { left: 0.68, top: -14.41, width: 22.64, height: 22.64, borderWidth: 2.5, borderRadius: 11.32 } },
    { left: 7.75, top: 7.75, width: 8.5, height: 8.5, borderWidth: 2.5, borderRadius: 4.25 },
    { left: 1.5, top: 10.75, width: 21, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '45deg' }] },
  ],
  // "M5 12h14M13 6l6 6-6 6" da web com as pontas redondas do traço: a haste de 3,75 a 20,25 e cada lado da ponta com
  // 8,49 + 2,5 de comprimento, centrado em (16, 9) e (16, 15).
  seta: [
    { left: 3.75, top: 10.75, width: 16.5, height: 2.5, borderRadius: 1.25, traco: true },
    { left: 10.51, top: 7.75, width: 10.99, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '45deg' }] },
    { left: 10.51, top: 13.75, width: 10.99, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '-45deg' }] },
  ],
  // Lâmpada como o caminho da web: o bulbo (círculo de raio 5,5) aberto embaixo, o gargalo que afunila até a base cheia
  // (a linha do gargalo e a de y 18 juntas) e a tampinha em y 21.
  lampada: [
    { left: 5.25, top: 2.25, width: 13.5, height: 13.5, borderWidth: 2.5, borderRadius: 6.75, borderBottomColor: 'transparent' },
    { left: 8, top: 12.3, width: 2.5, height: 4.2, borderRadius: 1.25, traco: true, transform: [{ rotate: '-22deg' }] },
    { left: 13.5, top: 12.3, width: 2.5, height: 4.2, borderRadius: 1.25, traco: true, transform: [{ rotate: '22deg' }] },
    { left: 8.25, top: 14.9, width: 7.5, height: 4.35, borderRadius: 1.6, traco: true },
    { left: 9.25, top: 19.75, width: 5.5, height: 2.5, borderRadius: 1.25, traco: true },
  ],
  relogio: [
    { left: 3.5, top: 3.5, width: 17, height: 17, borderWidth: 2.5, borderRadius: 8.5 },
    { left: 10.75, top: 7, width: 2.5, height: 6.25, borderRadius: 1.25, traco: true },
    { left: 10.45, top: 11.75, width: 6.1, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '33.7deg' }] },
  ],
  // Os círculos da web (r 8,5, 4,5 e 0,8 com traço de 2,5 centrado na linha): por fora, 19,5, 11,5 e o ponto de 4,1.
  alvo: [
    { left: 2.25, top: 2.25, width: 19.5, height: 19.5, borderWidth: 2.5, borderRadius: 9.75 },
    { left: 6.25, top: 6.25, width: 11.5, height: 11.5, borderWidth: 2.5, borderRadius: 5.75 },
    { left: 9.95, top: 9.95, width: 4.1, height: 4.1, borderRadius: 2.05, traco: true },
  ],
  // Alto-falante com duas ondas (a mesma ideia da web): ouvir uma frase, um áudio ou um acorde.
  som: [
    { left: 3, top: 8.5, width: 5.5, height: 7, borderWidth: 2.5, borderRadius: 1.5 },
    { left: 7.25, top: 5, width: 5, height: 14, borderWidth: 2.5, borderLeftWidth: 0, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
    { left: 11.5, top: 8.25, width: 5.5, height: 7.5, borderRightWidth: 2.5, borderRadius: 3.75 },
    { left: 13, top: 5, width: 8, height: 14, borderRightWidth: 2.5, borderRadius: 7 },
  ],
  // O microfone do "Conversar com o Stu", como o SVG da web (traço de 2): a cápsula, o arco de baixo, a haste e a base.
  microfone: [
    { left: 8, top: 1, width: 8, height: 14, borderWidth: 2, borderRadius: 4 },
    { left: 4, top: 2, width: 16, height: 16, borderWidth: 2, borderRadius: 8, borderTopColor: 'transparent', borderLeftColor: 'transparent',
      transform: [{ rotate: '45deg' }] },
    { left: 11, top: 17, width: 2, height: 5, borderRadius: 1, traco: true },
    { left: 7, top: 21, width: 10, height: 2, borderRadius: 1, traco: true },
  ],
};

const medidas = [
  'left', 'top', 'width', 'height', 'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
] as const;

const BORDAS = ['borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const;

/**
 * Escala a peça da grade de 24 para o tamanho pedido. `fator` é o traço pedido sobre o de desenho (2,5): engrossa as bordas
 * e as barras (a barra cresce em volta do próprio centro), como o stroke-width da web em cada uso.
 */
function escalar({ traco: barra, recorte, filho, ...peca }: Peca, escala: number, cor: string, fator: number): ViewStyle {
  const base: Record<string, unknown> = { ...peca };
  for (const borda of BORDAS) if (typeof base[borda] === 'number') base[borda] = (base[borda] as number) * fator;
  if (barra) {
    if (base.width === 2.5) { base.width = 2.5 * fator; base.left = (base.left as number) - (2.5 * fator - 2.5) / 2; }
    if (base.height === 2.5) { base.height = 2.5 * fator; base.top = (base.top as number) - (2.5 * fator - 2.5) / 2; }
    if (base.borderRadius === 1.25) base.borderRadius = 1.25 * fator;
  }
  const escaladas: Partial<Record<(typeof medidas)[number], number>> = {};
  for (const medida of medidas) {
    const valor = base[medida];
    if (typeof valor === 'number') escaladas[medida] = valor * escala;
  }
  const corBorda = recorte ? undefined : { borderColor: cor };
  return { ...(base as ViewStyle), ...escaladas, position: 'absolute', ...corBorda, ...(barra ? { backgroundColor: cor } : {}), ...(recorte ? { overflow: 'hidden' } : {}),
    ...(peca.borderBottomColor === 'transparent' ? { borderBottomColor: 'transparent' } : {}) };
}

/**
 * Ícone decorativo: o significado vai sempre no texto ou no nome acessível de quem o usa. `traco` é o stroke-width da web
 * naquele uso, na grade de 24 (2,5 por padrão; 3 no X da aula, 3,2 no visto do retorno, 2,25 no olho da senha).
 */
/**
 * Ícones da moldura no iPhone: os SF Symbols do sistema no lugar dos desenhos, só onde quem chama pede `sistema` (a barra de
 * baixo, os botões de ícone do cabeçalho e a seta dos botões). Os ícones de conteúdo (nós do mapa, etapas da aula, blocos
 * da conclusão) seguem com os desenhos, iguais aos da web. No Android e na prévia web, sempre os desenhos.
 */
const SIMBOLOS: Partial<Record<NomeIcone, { nome: SFSymbol; cheio?: SFSymbol }>> = {
  livro: { nome: 'book', cheio: 'book.fill' },
  lampada: { nome: 'lightbulb', cheio: 'lightbulb.fill' },
  fechar: { nome: 'xmark' },
  olho: { nome: 'eye' },
  olhoFechado: { nome: 'eye.slash' },
  seta: { nome: 'arrow.right' },
  pessoa: { nome: 'person', cheio: 'person.fill' },
  // A bússola do Explorar na barra de baixo (a do Safari é o símbolo de bússola do sistema).
  bussola: { nome: 'safari', cheio: 'safari.fill' },
};

export function Icone({ nome, tamanho = 24, cor, cheio = false, traco = 2.5, sistema = false }: {
  nome: NomeIcone; tamanho?: number; cor: string; cheio?: boolean; traco?: number;
  /** Só no iPhone: `true` usa o SF Symbol do ícone; `'cheio'`, a variante preenchida (a aba selecionada). */
  sistema?: boolean | 'cheio';
}) {
  const simbolo = sistema && Platform.OS === 'ios' ? SIMBOLOS[nome] : undefined;
  if (simbolo) {
    return (
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={`icone:${nome}:sf`}
        style={{ width: tamanho, height: tamanho }}>
        <SymbolView name={(sistema === 'cheio' && simbolo.cheio) || simbolo.nome} size={tamanho} tintColor={cor} weight="semibold"
          style={{ width: tamanho, height: tamanho }} />
      </View>
    );
  }
  if (ehSvg(nome)) {
    return (
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={`icone:${nome}:${traco}`}
        style={{ width: tamanho, height: tamanho }}>
        {/* `cheio` preenche o desenho na cor (o Valeu marcado, como `fill: currentColor` da web); `color` serve o currentColor. */}
        <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" color={cor} fill={cheio ? cor : 'none'} stroke={cor} strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round">
          {DESENHOS_SVG[nome]}
        </Svg>
      </View>
    );
  }
  const escala = tamanho / 24;
  const fator = traco / 2.5;
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={`icone:${nome}:${traco}`}
      style={{ width: tamanho, height: tamanho }}>
      {desenhos[nome].map((peca, indice) => (
        <View key={indice} style={[escalar(peca, escala, cor, fator), cheio && indice === 0 && { backgroundColor: cor }]}>
          {peca.filho && <View style={escalar(peca.filho, escala, cor, fator)} />}
        </View>
      ))}
    </View>
  );
}
