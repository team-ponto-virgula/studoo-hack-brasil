import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';

// Uma assinatura compartilhada por todos os elementos animados da tela.
// Segundo plano e preferência ainda desconhecida suspendem movimento decorativo.
let preferencia: boolean | null = null;
let visivel = AppState.currentState === 'active';
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((ouvinte) => ouvinte());
let limpar: (() => void) | undefined;

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  if (ouvintes.size === 1) {
    let ativo = true;
    let recebeuEvento = false;
    visivel = AppState.currentState === 'active';
    const movimento = AccessibilityInfo.addEventListener('reduceMotionChanged', (valor) => {
      recebeuEvento = true;
      preferencia = valor;
      avisar();
    });
    const app = AppState.addEventListener('change', (estado) => {
      visivel = estado === 'active';
      avisar();
    });
    AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (ativo && !recebeuEvento) { preferencia = valor; avisar(); }
    }).catch(() => {
      if (ativo && !recebeuEvento) { preferencia = true; avisar(); }
    });
    limpar = () => { ativo = false; movimento.remove(); app.remove(); };
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (!ouvintes.size) { limpar?.(); limpar = undefined; }
  };
}

export function useMovimentoReduzido() {
  return useSyncExternalStore(assinar, () => !visivel ? true : preferencia, () => true);
}
