import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/*
 * "Reduzir transparência" do iPhone (Ajustes > Acessibilidade > Tela e Tamanho do Texto). O vidro do iOS 26 só vale depois
 * que o sistema confirma a preferência desligada: antes da resposta, se a consulta falhar e fora do iPhone, a barra fica na
 * superfície opaca, com a mesma geometria. A troca ao vivo vem do evento reduceTransparencyChanged, e vale a resposta mais
 * recente: a consulta que volta depois de um evento é mais antiga que ele e não muda nada.
 *
 * Uma assinatura só, compartilhada por quem pergunta. A troca de tela desmonta uma cápsula e monta a outra no mesmo
 * instante: o ouvinte só sai depois de 1,5 s sem ninguém, e enquanto ele está ligado a preferência continua viva. Quando ele
 * sai, a preferência volta a ser desconhecida, para uma confirmação de antes (que já não acompanha o sistema) não ser
 * reaproveitada: a próxima assinatura começa opaca e pergunta de novo, e uma resposta atrasada do ciclo antigo não vale.
 */

/** true: "Reduzir transparência" ligada; false: desligada (vidro permitido); null: ainda não confirmada. */
type Preferencia = boolean | null;
let preferencia: Preferencia = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((ouvinte) => ouvinte());
let encerrarCiclo: (() => void) | undefined;
let encerramento: ReturnType<typeof setTimeout> | undefined;

/** Quanto o ouvinte espera sem ninguém antes de sair (cobre a troca de tela e as esperas curtas sem a barra). */
export const ESPERA_SEM_OUVINTES_MS = 1500;

/** Um ciclo de escuta: o evento e uma consulta. Encerrado, nada dele muda a preferência. */
function abrirCiclo(): () => void {
  let ativo = true;
  let respondeuPorEvento = false;
  const assinatura = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (valor) => {
    if (!ativo) return;
    respondeuPorEvento = true;
    preferencia = valor;
    avisar();
  });
  AccessibilityInfo.isReduceTransparencyEnabled().then((valor) => {
    if (ativo && !respondeuPorEvento) { preferencia = valor; avisar(); }
  }).catch(() => undefined); // Sem resposta, continua desconhecida: superfície opaca.
  return () => {
    ativo = false;
    assinatura.remove();
    preferencia = null;
  };
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  if (encerramento !== undefined) { clearTimeout(encerramento); encerramento = undefined; }
  // Só o iPhone tem a preferência (e o vidro); no Android e na prévia web, a barra é sempre opaca.
  if (!encerrarCiclo && Platform.OS === 'ios' && typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function') {
    encerrarCiclo = abrirCiclo();
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (ouvintes.size || !encerrarCiclo || encerramento !== undefined) return;
    encerramento = setTimeout(() => {
      encerramento = undefined;
      if (ouvintes.size) return;
      encerrarCiclo?.();
      encerrarCiclo = undefined;
    }, ESPERA_SEM_OUVINTES_MS);
  };
}

/**
 * Se o vidro é permitido: só com a "Reduzir transparência" confirmada desligada pelo iPhone. Enquanto a resposta não chega,
 * se a consulta falha, com a preferência ligada ou fora do iPhone, não (superfície opaca).
 */
export function useVidroPermitido(): boolean {
  return useSyncExternalStore(assinar, () => preferencia === false, () => false);
}
