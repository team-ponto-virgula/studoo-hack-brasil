import type { ImageSourcePropType } from 'react-native';

/**
 * O "G" oficial do Google (pacote de marca do Google Sign-In), o mesmo PNG da web, em packages/contratos/assets (o Metro
 * escolhe @2x e @3x pela tela). Spec 06, "Botão Continuar com Google": 20 × 20 à esquerda do rótulo, 12 até o texto, nas
 * cores originais e decorativo (o nome do botão continua "Continuar com Google").
 */
export const LOGO_GOOGLE: { fonte: ImageSourcePropType; tamanho: number } = {
  fonte: require('../../../packages/contratos/assets/google-g.png'),
  tamanho: 20,
};
