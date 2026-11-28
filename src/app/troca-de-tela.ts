import { flushSync } from 'react-dom';
import type { DirecaoDaTroca } from '@studoo/contratos';

/*
 * Troca de tela com direção na web (contrato `transicao-de-tela.ts`). Com a View Transitions API do navegador, a tela que
 * sai desliza para um lado e a que entra chega do outro (`globals.css`, "Troca de tela"). Só o conteúdo (`.estudo-principal`)
 * anda: o cabeçalho, o menu lateral e a barra de baixo ficam parados. Sem a API (navegadores antigos), com movimento reduzido
 * ou com a aba escondida, a troca é a de sempre, na hora, com a entrada do painel.
 */

type TransicaoDoNavegador = { finished: Promise<void> };
type DocumentoComTransicao = Document & { startViewTransition?: (atualizar: () => void) => TransicaoDoNavegador };

/** Se o navegador não chamar a atualização (não deveria acontecer), a troca acontece mesmo assim depois deste tempo. */
const RESERVA_MS = 1000;

export function podeAnimarTroca(): boolean {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  if (typeof (document as DocumentoComTransicao).startViewTransition !== 'function') return false;
  if (document.visibilityState !== 'visible') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Aplica a troca de tela (`aplicar`, os `setState` da navegação) dentro de uma View Transition com a `direcao` dada. A
 * atualização roda uma vez só, de forma síncrona (`flushSync`), para o navegador fotografar a tela nova logo depois.
 * Sem direção ou sem como animar, aplica na hora.
 */
export function trocarTelaComTransicao(direcao: DirecaoDaTroca | null, aplicar: () => void) {
  if (!direcao || !podeAnimarTroca()) {
    aplicar();
    return;
  }
  const raiz = document.documentElement;
  let aplicada = false;
  const executar = () => {
    if (aplicada) return;
    aplicada = true;
    flushSync(aplicar);
  };
  raiz.dataset.trocaDeTela = direcao;
  const limpar = () => {
    if (raiz.dataset.trocaDeTela === direcao) delete raiz.dataset.trocaDeTela;
  };
  const reserva = window.setTimeout(executar, RESERVA_MS);
  try {
    const transicao = (document as DocumentoComTransicao).startViewTransition!(executar);
    transicao.finished.catch(() => undefined).finally(() => {
      window.clearTimeout(reserva);
      limpar();
    });
  } catch {
    window.clearTimeout(reserva);
    limpar();
    executar();
  }
}
