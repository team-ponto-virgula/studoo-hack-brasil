import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

/*
 * "Reduzir transparência" do iPhone (Ajustes > Acessibilidade > Tela e Tamanho do Texto). Com ela ligada, a barra de baixo
 * troca o vidro do iOS 26 pela superfície opaca, com a mesma geometria. No Android e na prévia web não há essa consulta:
 * a resposta é sempre "não" (e lá a barra já é opaca). Uma assinatura só, compartilhada por quem pergunta.
 */
let reduzida = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((ouvinte) => ouvinte());
let limpar: (() => void) | undefined;

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  if (ouvintes.size === 1) {
    let ativo = true;
    let recebeuEvento = false;
    const assinatura = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (valor) => {
      recebeuEvento = true;
      reduzida = valor;
      avisar();
    });
    // O React Native Web não tem a consulta: sem ela, fica "não".
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function') {
      AccessibilityInfo.isReduceTransparencyEnabled().then((valor) => {
        if (ativo && !recebeuEvento) { reduzida = valor; avisar(); }
      }).catch(() => undefined);
    }
    limpar = () => { ativo = false; assinatura?.remove(); };
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size) { limpar?.(); limpar = undefined; }
  };
}

/** Se a pessoa pediu menos transparência no sistema (iPhone). */
export function useTransparenciaReduzida(): boolean {
  return useSyncExternalStore(assinar, () => reduzida, () => false);
}
