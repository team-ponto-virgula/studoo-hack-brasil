import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { coresMundo, desenhosMundo, regiaoDoTrecho, type Forma, type NomeDesenho } from './mundo-desenhos';

/*
 * Mundo da trilha no app: os desenhos de mundo-desenhos.ts (o mesmo arquivo da web) feitos com View, porque o app não
 * usa SVG. A web desenha os mesmos dados em SVG (src/ui/mundo.tsx). Tudo aqui é decorativo e fica fora do leitor de tela.
 */

function estiloDaForma(forma: Forma, escala: number): ViewStyle {
  const cor = coresMundo[forma.cor];
  switch (forma.forma) {
    case 'circulo':
      return {
        position: 'absolute', left: (forma.x - forma.r) * escala, top: (forma.y - forma.r) * escala,
        width: forma.r * 2 * escala, height: forma.r * 2 * escala, borderRadius: forma.r * escala, backgroundColor: cor,
      };
    case 'elipse': {
      // Um círculo com a altura da elipse, esticado na horizontal.
      const lado = forma.ry * 2 * escala;
      return {
        position: 'absolute', left: (forma.x - forma.ry) * escala, top: (forma.y - forma.ry) * escala, width: lado, height: lado,
        borderRadius: lado / 2, backgroundColor: cor, transform: [{ scaleX: forma.rx / forma.ry }],
      };
    }
    case 'retangulo':
      return {
        position: 'absolute', left: forma.x * escala, top: forma.y * escala, width: forma.largura * escala, height: forma.altura * escala,
        borderRadius: forma.raio * escala, backgroundColor: cor, ...(forma.giro ? { transform: [{ rotate: `${forma.giro}deg` }] } : null),
      };
    case 'triangulo': {
      // Triângulo pelas bordas de uma caixa vazia: só a borda de baixo (ou a de cima, invertido) tem cor.
      const meia = (forma.largura / 2) * escala;
      const altura = forma.altura * escala;
      return {
        position: 'absolute', left: forma.x * escala, top: forma.y * escala, width: 0, height: 0, borderStyle: 'solid',
        borderLeftWidth: meia, borderRightWidth: meia, borderLeftColor: 'transparent', borderRightColor: 'transparent',
        backgroundColor: 'transparent',
        ...(forma.invertido ? { borderTopWidth: altura, borderTopColor: cor } : { borderBottomWidth: altura, borderBottomColor: cor }),
      };
    }
    case 'cupula': {
      const largura = forma.largura * escala;
      return {
        position: 'absolute', left: forma.x * escala, top: forma.y * escala, width: largura, height: forma.altura * escala,
        borderTopLeftRadius: largura / 2, borderTopRightRadius: largura / 2, backgroundColor: cor,
      };
    }
  }
}

/** Um desenho do mundo na largura pedida; a altura acompanha a proporção do desenho. */
export function Desenho({ nome, largura, estilo }: { nome: NomeDesenho; largura: number; estilo?: StyleProp<ViewStyle> }) {
  const desenho = desenhosMundo[nome];
  const escala = largura / desenho.largura;
  const formas = useMemo(() => desenho.formas.map((forma) => estiloDaForma(forma, escala)), [desenho, escala]);
  return (
    <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[{ width: largura, height: desenho.altura * escala }, estilo]}>
      {formas.map((estiloForma, indice) => <View key={indice} style={estiloForma} />)}
    </View>
  );
}

/** Cores de uma região: o chão e o relevo. */
export function coresDaRegiao(trecho: number) {
  const regiao = regiaoDoTrecho(trecho);
  return { chao: coresMundo[regiao.chao], relevo: coresMundo[regiao.relevo] };
}

/**
 * As colinas das ondas da web (os caminhos SVG de mundo.tsx e caminho.tsx da web), refeitas com arcos de círculos grandes:
 * cada colina é um círculo com o topo no pico (x em % da largura, y em pontos) e diâmetro em % da largura; os vizinhos se
 * cruzam nos vales. Duas camadas: o relevo atrás e o chão, mais baixo, na frente.
 */
type Colina = { x: number; y: number; d: number };
const formasDaOnda: Record<'fronteira' | 'inicio', { altura: number; relevo: readonly Colina[]; chao: readonly Colina[] }> = {
  // viewBox 400 × 48: "M0 22C36 6 70 4 104 14S170 36 212 22 290 2 332 12 380 26 400 18" e o chão 10 pontos abaixo.
  fronteira: {
    altura: 48,
    relevo: [{ x: 17, y: 5, d: 92 }, { x: 72, y: 4, d: 86 }, { x: 114, y: 12, d: 52 }],
    chao: [{ x: 19, y: 15, d: 92 }, { x: 73, y: 11, d: 86 }, { x: 115, y: 24, d: 52 }],
  },
  // viewBox 400 × 64 esticado em 76: "M0 30C50 6 96 4 148 22S236 52 292 30 368 8 400 18" e o chão de "M0 44C44 28…".
  inicio: {
    altura: 76,
    relevo: [{ x: 22, y: 6, d: 96 }, { x: 90, y: 11, d: 72 }],
    chao: [{ x: 21, y: 32, d: 96 }, { x: 89, y: 32, d: 72 }],
  },
};

export function Onda({ chao, relevo, estilo, forma = 'fronteira' }: { chao: string; relevo: string; estilo?: StyleProp<ViewStyle>; forma?: 'fronteira' | 'inicio' }) {
  const { altura, relevo: colinasRelevo, chao: colinasChao } = formasDaOnda[forma];
  const colina = ({ x, y, d }: Colina, cor: string, chave: string) => (
    <View key={chave} style={[mundoEstilos.colinaOnda, { left: `${x - d / 2}%` as DimensionValue, width: `${d}%` as DimensionValue, top: y, backgroundColor: cor }]} />
  );
  return (
    <View pointerEvents="none" style={[mundoEstilos.onda, { height: altura }, estilo]}>
      {colinasRelevo.map((item, indice) => colina(item, relevo, `relevo-${indice}`))}
      {colinasChao.map((item, indice) => colina(item, chao, `chao-${indice}`))}
    </View>
  );
}

/**
 * Fronteira entre duas regiões, como na web: ocupa o espaço abaixo do nó (a partir de `topo`), com a onda da região
 * seguinte na metade e o chão dela até o fim da linha. Os enfeites ficam nas bordas; o centro fica para a estrada e o marco.
 */
export function Fronteira({ trechoSeguinte, topo }: { trechoSeguinte: number; topo: number }) {
  const { chao, relevo } = coresDaRegiao(trechoSeguinte);
  const [primeiro, segundo, terceiro, quarto] = regiaoDoTrecho(trechoSeguinte).fronteira;
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      style={[mundoEstilos.fronteira, { top: topo }]}>
      <View style={mundoEstilos.metade}>
        <Onda chao={chao} relevo={relevo} />
      </View>
      <View style={[mundoEstilos.resto, { backgroundColor: chao }]} />
      <View style={mundoEstilos.enfeites}>
        <Desenho nome={primeiro} largura={46} estilo={[mundoEstilos.enfeite, { left: '2%' }]} />
        <Desenho nome={segundo} largura={34} estilo={[mundoEstilos.enfeite, { left: '15%' }]} />
        <Desenho nome={terceiro} largura={30} estilo={[mundoEstilos.enfeite, { right: '15%' }]} />
        <Desenho nome={quarto} largura={44} estilo={[mundoEstilos.enfeite, { right: '2%' }]} />
      </View>
    </View>
  );
}

/**
 * Paisagem vista de lado, como a da web: céu, sol, nuvens, balão, montanhas, colinas e árvores. As medidas acompanham a
 * largura da caixa, medida no primeiro layout. `children` fica por cima (o Stu, temas…), já com a largura.
 */
export function Paisagem({ altura, compacta = false, estilo, children }: {
  altura: number;
  compacta?: boolean;
  estilo?: StyleProp<ViewStyle>;
  children?: (largura: number) => ReactNode;
}) {
  const [largura, setLargura] = useState(0);
  const l = (fracao: number) => Math.round(largura * fracao);

  return (
    <View style={[mundoEstilos.paisagem, { height: altura }, estilo]}
      onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}>
      <View style={[StyleSheet.absoluteFill, mundoEstilos.ceuMeio]} pointerEvents="none" />
      {largura > 0 && (
        <>
          <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
            <Desenho nome="sol" largura={l(0.13)} estilo={{ position: 'absolute', top: altura * 0.08, right: l(0.08) }} />
            <Desenho nome="nuvem" largura={l(0.2)} estilo={{ position: 'absolute', top: altura * 0.09, left: l(0.07) }} />
            <Desenho nome="nuvem" largura={l(0.14)} estilo={{ position: 'absolute', top: altura * 0.2, left: l(0.46), opacity: 0.9 }} />
            {!compacta && <Desenho nome="nuvem" largura={l(0.11)} estilo={{ position: 'absolute', top: altura * 0.04, left: l(0.64), opacity: 0.8 }} />}
            {!compacta && <Desenho nome="balao" largura={l(0.07)} estilo={{ position: 'absolute', top: altura * 0.14, left: l(0.28) }} />}
            <Desenho nome="picos" largura={l(0.4)} estilo={{ position: 'absolute', bottom: altura * 0.33, right: l(0.02) }} />
            <View style={[mundoEstilos.colina, { bottom: altura * 0.16, left: -l(0.14), width: l(0.78), height: altura * 0.4,
              borderTopLeftRadius: l(0.39), borderTopRightRadius: l(0.39), backgroundColor: coresMundo.florestaRelevo }]} />
            <View style={[mundoEstilos.colina, { bottom: altura * 0.08, right: -l(0.18), width: l(0.84), height: altura * 0.38,
              borderTopLeftRadius: l(0.42), borderTopRightRadius: l(0.42), backgroundColor: coresMundo.campoRelevo }]} />
            <View style={[mundoEstilos.colina, { bottom: -altura * 0.06, left: -l(0.06), right: -l(0.06), height: altura * 0.26,
              borderTopLeftRadius: l(0.6), borderTopRightRadius: l(0.6), backgroundColor: coresMundo.campo }]} />
            <Desenho nome="pinheiro" largura={l(0.08)} estilo={{ position: 'absolute', bottom: altura * 0.41, left: l(0.08) }} />
            <Desenho nome="pinheiro" largura={l(0.06)} estilo={{ position: 'absolute', bottom: altura * 0.43, left: l(0.17) }} />
            <Desenho nome="arvore" largura={l(0.09)} estilo={{ position: 'absolute', bottom: altura * 0.33, right: l(0.18) }} />
            <Desenho nome="arvore" largura={l(0.07)} estilo={{ position: 'absolute', bottom: altura * 0.31, right: l(0.07) }} />
            {!compacta && <Desenho nome="casa" largura={l(0.08)} estilo={{ position: 'absolute', bottom: altura * 0.36, left: l(0.3) }} />}
            <Desenho nome="arbusto" largura={l(0.09)} estilo={{ position: 'absolute', bottom: altura * 0.11, left: l(0.06) }} />
            <Desenho nome="flores" largura={l(0.07)} estilo={{ position: 'absolute', bottom: altura * 0.08, right: l(0.1) }} />
          </View>
          {children?.(largura)}
        </>
      )}
    </View>
  );
}

const mundoEstilos = StyleSheet.create({
  onda: { position: 'absolute', left: 0, right: 0, top: 0, height: 48, overflow: 'hidden' },
  colinaOnda: { position: 'absolute', aspectRatio: 1, borderRadius: 9999 },
  fronteira: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  metade: { position: 'absolute', left: 0, right: 0, top: '50%', height: 48, marginTop: -24 },
  resto: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: 23, bottom: 0 },
  enfeites: { position: 'absolute', left: 0, right: 0, top: 0, bottom: '50%', marginBottom: -4 },
  enfeite: { position: 'absolute', bottom: 0 },
  paisagem: { overflow: 'hidden', backgroundColor: '#DCE7FF' },
  ceuMeio: { top: '45%', backgroundColor: '#E9F0FF' },
  colina: { position: 'absolute' },
});
