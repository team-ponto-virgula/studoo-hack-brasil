import type { NomeStu } from '@studoo/contratos';
import { VISUAL_ONBOARDING } from '@studoo/contratos/onboarding-visual';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stu } from './mascote';

/** Duas lentes do logo acolhem o Stu; o conteúdo do exemplo continua legível e realçado. */
export function CenaStuOnboarding({ nome, compacto = false, children }: { nome: NomeStu; compacto?: boolean; children?: ReactNode }) {
  const medidas = compacto ? VISUAL_ONBOARDING.vitoria : VISUAL_ONBOARDING.cena;
  const escala = compacto ? .76 : 1;
  const largura = Math.round(VISUAL_ONBOARDING.cena.baseLargura * escala);
  const altura = Math.round(VISUAL_ONBOARDING.cena.baseAltura * escala);
  return <View style={s.cena}>
    <View style={[s.heroi, { height: medidas.altura }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[s.base, { top: compacto ? 20 : 28, width: largura, height: altura }]}>
        <View style={[s.lente, { left: 0, width: altura, height: altura, borderRadius: altura / 2 }]} />
        <View style={[s.lente, { right: 0, width: altura, height: altura, borderRadius: altura / 2 }]} />
      </View>
      <Stu nome={nome} tamanho={medidas.stu} />
    </View>
    {children}
  </View>;
}

const s = StyleSheet.create({
  cena: { width: '100%' },
  heroi: { alignItems: 'center', justifyContent: 'center' },
  base: { position: 'absolute', alignSelf: 'center' },
  lente: { position: 'absolute', top: 0, backgroundColor: VISUAL_ONBOARDING.cores.azulSuave, borderColor: VISUAL_ONBOARDING.cores.azulLinha, borderWidth: 1, opacity: .75 },
});
