import { View, type ViewStyle } from 'react-native';
import type { NomeIcone } from './trilha';

/*
 * Ícones da trilha, os mesmos da web (src/ui/caminho.tsx), desenhados com View porque o app não usa SVG.
 * Cada medida está na grade de 24 da versão web, com traço de 2,5, e é escalada pelo tamanho pedido.
 */

type Peca = ViewStyle & { traco?: boolean };

const desenhos: Record<NomeIcone, Peca[]> = {
  check: [
    { left: 4.44, top: 6.98, width: 15, height: 7.25, borderLeftWidth: 2.5, borderBottomWidth: 2.5, transform: [{ rotate: '-45deg' }] },
  ],
  livro: [
    { left: 3.25, top: 3.75, width: 10, height: 15.5, borderWidth: 2.5, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
    { left: 10.75, top: 3.75, width: 10, height: 15.5, borderWidth: 2.5, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  ],
  revisao: [
    { left: 3.25, top: 3.25, width: 17.5, height: 17.5, borderWidth: 2.5, borderRadius: 8.75,
      borderLeftColor: 'transparent', borderRightColor: 'transparent' },
    { left: 12.65, top: 2.25, width: 6.1, height: 6.1, borderRightWidth: 2.5, borderBottomWidth: 2.5 },
    { left: 5.25, top: 15.65, width: 6.1, height: 6.1, borderLeftWidth: 2.5, borderTopWidth: 2.5 },
  ],
  cadeado: [
    { left: 7.25, top: 3.25, width: 9.5, height: 7.25, borderWidth: 2.5, borderBottomWidth: 0,
      borderTopLeftRadius: 4.75, borderTopRightRadius: 4.75 },
    { left: 4.25, top: 9.25, width: 15.5, height: 11.5, borderWidth: 2.5, borderRadius: 3.75 },
  ],
  bandeira: [
    { left: 4.75, top: 3.25, width: 2.5, height: 18, borderRadius: 1.25, traco: true },
    { left: 6, top: 3.75, width: 11.75, height: 9.5, borderWidth: 2.5, borderLeftWidth: 0,
      borderTopRightRadius: 1, borderBottomRightRadius: 1 },
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
  fechar: [
    { left: 4.5, top: 10.75, width: 15, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '45deg' }] },
    { left: 4.5, top: 10.75, width: 15, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '-45deg' }] },
  ],
  olho: [
    { left: 2.25, top: 5.75, width: 19.5, height: 12.5, borderWidth: 2.5, borderRadius: 6.25 },
    { left: 9, top: 9, width: 6, height: 6, borderRadius: 3, traco: true },
  ],
  olhoFechado: [
    { left: 2.25, top: 5.75, width: 19.5, height: 12.5, borderWidth: 2.5, borderRadius: 6.25 },
    { left: 9, top: 9, width: 6, height: 6, borderRadius: 3, traco: true },
    { left: 1.5, top: 10.75, width: 21, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '45deg' }] },
  ],
  seta: [
    { left: 4.25, top: 10.75, width: 15.5, height: 2.5, borderRadius: 1.25, traco: true },
    { left: 11.5, top: 7.75, width: 9, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '45deg' }] },
    { left: 11.5, top: 13.75, width: 9, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '-45deg' }] },
  ],
  lampada: [
    { left: 6.5, top: 2.75, width: 11, height: 11, borderWidth: 2.5, borderRadius: 5.5 },
    { left: 9.25, top: 12.5, width: 5.5, height: 3.75, borderLeftWidth: 2.5, borderRightWidth: 2.5 },
    { left: 8.75, top: 16, width: 6.5, height: 2.5, borderRadius: 1.25, traco: true },
    { left: 10, top: 19.5, width: 4, height: 2.5, borderRadius: 1.25, traco: true },
  ],
  relogio: [
    { left: 3.5, top: 3.5, width: 17, height: 17, borderWidth: 2.5, borderRadius: 8.5 },
    { left: 10.75, top: 7, width: 2.5, height: 6.25, borderRadius: 1.25, traco: true },
    { left: 10.45, top: 11.75, width: 6.1, height: 2.5, borderRadius: 1.25, traco: true, transform: [{ rotate: '33.7deg' }] },
  ],
  alvo: [
    { left: 3.5, top: 3.5, width: 17, height: 17, borderWidth: 2.5, borderRadius: 8.5 },
    { left: 7.5, top: 7.5, width: 9, height: 9, borderWidth: 2.5, borderRadius: 4.5 },
    { left: 11, top: 11, width: 2, height: 2, borderRadius: 1, traco: true },
  ],
};

const medidas = [
  'left', 'top', 'width', 'height', 'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
] as const;

function escalar({ traco, ...peca }: Peca, escala: number, cor: string): ViewStyle {
  const escaladas: Partial<Record<(typeof medidas)[number], number>> = {};
  for (const medida of medidas) {
    const valor = peca[medida];
    if (typeof valor === 'number') escaladas[medida] = valor * escala;
  }
  return { ...peca, ...escaladas, position: 'absolute', borderColor: cor, ...(traco ? { backgroundColor: cor } : {}) };
}

/** Ícone decorativo: o significado vai sempre no texto ou no nome acessível de quem o usa. */
export function Icone({ nome, tamanho = 24, cor }: { nome: NomeIcone; tamanho?: number; cor: string }) {
  const escala = tamanho / 24;
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={{ width: tamanho, height: tamanho }}>
      {desenhos[nome].map((peca, indice) => <View key={indice} style={escalar(peca, escala, cor)} />)}
    </View>
  );
}
