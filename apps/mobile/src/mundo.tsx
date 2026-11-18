import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { coresMundo, desenhosMundo, regiaoDoTrecho, type Forma, type NomeDesenho } from './mundo-desenhos';
import { degrade } from './interface';

/*
 * Mundo da trilha no app: os desenhos de mundo-desenhos.ts (o mesmo arquivo da web) feitos com View; as ondas (começo da
 * trilha e fronteira entre partes) usam os mesmos caminhos SVG da web, com react-native-svg. A web desenha os mesmos dados
 * em SVG (src/ui/mundo.tsx). Tudo aqui é decorativo e fica fora do leitor de tela.
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
 * As ondas da web (os caminhos SVG de src/ui/mundo.tsx e src/ui/caminho.tsx), com as mesmas curvas Bézier em
 * react-native-svg e esticadas como `preserveAspectRatio="none"`: o relevo atrás e o chão na frente. A fronteira entre
 * partes ocupa 48 de altura (viewBox 400 × 48); o começo da trilha, 76 (viewBox 400 × 64 esticado).
 */
const formasDaOnda: Record<'fronteira' | 'inicio', { altura: number; caixa: string; relevo: string; chao: string }> = {
  fronteira: {
    altura: 48,
    caixa: '0 0 400 48',
    relevo: 'M0 22C36 6 70 4 104 14S170 36 212 22 290 2 332 12 380 26 400 18V48H0Z',
    chao: 'M0 32C40 16 76 14 110 24S176 44 218 30 296 10 338 20 384 34 400 28V48H0Z',
  },
  inicio: {
    altura: 76,
    caixa: '0 0 400 64',
    relevo: 'M0 30C50 6 96 4 148 22S236 52 292 30 368 8 400 18V64H0Z',
    chao: 'M0 44C44 28 90 26 140 38S228 60 286 44 364 26 400 34V64H0Z',
  },
};

export function Onda({ chao, relevo, estilo, forma = 'fronteira' }: { chao: string; relevo: string; estilo?: StyleProp<ViewStyle>; forma?: 'fronteira' | 'inicio' }) {
  const onda = formasDaOnda[forma];
  return (
    <View pointerEvents="none" style={[mundoEstilos.onda, { height: onda.altura }, estilo]}>
      <Svg width="100%" height="100%" viewBox={onda.caixa} preserveAspectRatio="none">
        <Path d={onda.relevo} fill={relevo} />
        <Path d={onda.chao} fill={chao} />
      </Svg>
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

const degradeDaPaisagem = degrade('linear-gradient(180deg, #d4e3ff 0%, #e6efff 52%, #f3f7ff 100%)');

/**
 * Colina como .paisagem__colina da web: a caixa (posição e tamanho da web) com o topo em meia elipse de raio horizontal igual
 * à metade da largura e raio vertical de `raioVertical` da altura; abaixo do arco, os lados retos. A elipse é um círculo
 * achatado (scaleY), recortado pela caixa.
 */
export function ColinaElipse({ esquerda, largura, baixo, altura, raioVertical = 1, cor, estilo }: {
  esquerda?: number; largura: number; baixo: number; altura: number; raioVertical?: number; cor: string;
  /** Posição de fora (como left 50% com a margem negativa), no lugar de `esquerda`. */
  estilo?: StyleProp<ViewStyle>;
}) {
  const ry = altura * raioVertical;
  return (
    <View style={[{ position: 'absolute', left: esquerda, bottom: baixo, width: largura, height: altura, overflow: 'hidden' }, estilo]}>
      <View style={{ position: 'absolute', left: 0, top: ry - largura / 2, width: largura, height: largura, borderRadius: largura / 2,
        backgroundColor: cor, transform: [{ scaleY: (2 * ry) / largura }] }} />
      {raioVertical < 1 && <View style={{ position: 'absolute', left: 0, right: 0, top: ry, bottom: 0, backgroundColor: cor }} />}
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
    // .paisagem da web: céu em degradê (#d4e3ff, #e6efff aos 52%, #f3f7ff). A ordem segue as camadas da web: os picos (z-index
    // -1) atrás de tudo, o sol, as nuvens e o balão na frente deles, as colinas (z 0) e os enfeites (z 1) por cima.
    <View style={[mundoEstilos.paisagem, degradeDaPaisagem, { height: altura }, estilo]}
      onLayout={(evento) => setLargura(evento.nativeEvent.layout.width)}>
      {largura > 0 && (
        <>
          <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={StyleSheet.absoluteFill}>
            <Desenho nome="picos" largura={l(0.4)} estilo={{ position: 'absolute', bottom: altura * 0.33, right: l(0.02) }} />
            <Desenho nome="sol" largura={l(0.13)} estilo={{ position: 'absolute', top: altura * 0.08, right: l(0.1) }} />
            <Desenho nome="nuvem" largura={l(0.2)} estilo={{ position: 'absolute', top: altura * 0.09, left: l(0.08) }} />
            <Desenho nome="nuvem" largura={l(0.14)} estilo={{ position: 'absolute', top: altura * 0.2, left: l(0.46), opacity: 0.9 }} />
            {!compacta && <Desenho nome="nuvem" largura={l(0.11)} estilo={{ position: 'absolute', top: altura * 0.04, left: l(0.62), opacity: 0.8 }} />}
            {!compacta && <Desenho nome="balao" largura={l(0.07)} estilo={{ position: 'absolute', top: altura * 0.14, left: l(0.28) }} />}
            {/* .paisagem__colina: meia elipse (border-radius 50% 50% 0 0 / 100% 100% 0 0); a da frente, com o raio vertical de 60%. */}
            <ColinaElipse esquerda={-l(0.14)} largura={l(0.78)} baixo={altura * 0.16} altura={altura * 0.4} cor={coresMundo.florestaRelevo} />
            <ColinaElipse esquerda={l(0.34)} largura={l(0.84)} baixo={altura * 0.08} altura={altura * 0.38} cor={coresMundo.campoRelevo} />
            <ColinaElipse esquerda={-l(0.06)} largura={l(1.12)} baixo={-altura * 0.06} altura={altura * 0.24} raioVertical={0.6} cor={coresMundo.campo} />
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
  fronteira: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  metade: { position: 'absolute', left: 0, right: 0, top: '50%', height: 48, marginTop: -24 },
  resto: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: 23, bottom: 0 },
  enfeites: { position: 'absolute', left: 0, right: 0, top: 0, bottom: '50%', marginBottom: -4 },
  enfeite: { position: 'absolute', bottom: 0 },
  paisagem: { overflow: 'hidden', backgroundColor: '#E6EFFF' },
});
