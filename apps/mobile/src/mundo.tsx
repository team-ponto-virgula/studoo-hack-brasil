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

/** Bolhas que fazem a borda ondulada: posição em % da largura e deslocamento vertical, em pontos. */
const bolhas = [
  { x: -10, y: 8 }, { x: 6, y: 0 }, { x: 22, y: 10 }, { x: 38, y: 2 }, { x: 54, y: 12 }, { x: 70, y: 3 }, { x: 86, y: 9 },
] as const;

/**
 * Borda ondulada de 48 pontos de altura: uma fileira de bolhas no tom do relevo e, um pouco abaixo, outra no tom do chão.
 * A parte de baixo da faixa já é o chão, para emendar com o que vem embaixo.
 */
export function Onda({ chao, relevo, estilo }: { chao: string; relevo: string; estilo?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[mundoEstilos.onda, estilo]}>
      {bolhas.map(({ x, y }, indice) => (
        <View key={`relevo-${indice}`} style={[mundoEstilos.bolha, { left: `${x}%` as DimensionValue, top: y, backgroundColor: relevo }]} />
      ))}
      {bolhas.map(({ x, y }, indice) => (
        <View key={`chao-${indice}`} style={[mundoEstilos.bolha, { left: `${x + 8}%` as DimensionValue, top: y + 12, backgroundColor: chao }]} />
      ))}
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
  bolha: { position: 'absolute', width: '22%', aspectRatio: 1, borderRadius: 9999 },
  fronteira: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  metade: { position: 'absolute', left: 0, right: 0, top: '50%', height: 48, marginTop: -24 },
  resto: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: 23, bottom: 0 },
  enfeites: { position: 'absolute', left: 0, right: 0, top: 0, bottom: '50%', marginBottom: -4 },
  enfeite: { position: 'absolute', bottom: 0 },
  paisagem: { overflow: 'hidden', backgroundColor: '#DCE7FF' },
  ceuMeio: { top: '45%', backgroundColor: '#E9F0FF' },
  colina: { position: 'absolute' },
});
