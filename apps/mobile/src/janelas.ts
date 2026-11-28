import { useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Janelas do Studoo (regra do dono, lote 4): menus, confirmações e folhas são componentes do app, iguais no iPhone, no
 * Android e na web, e nenhum é a janela do sistema. Quando um item de um menu que fica numa janela (Modal) abre outra
 * janela (a denúncia), a segunda só abre depois que a primeira saiu de vez. Só o momento muda por plataforma, a aparência
 * não: no iPhone, o UIKit não apresenta uma janela enquanto outra está saindo (a segunda não aparecia), e o `onDismiss`
 * do Modal, que o React Native só chama no iPhone, avisa quando a saída acabou; no Android e na web, a janela sai na hora
 * e a próxima já pode abrir.
 *
 * Uso: `depoisDeSair(acao)` no item do menu, junto com o fechar, e `onDismiss={aoSair}` no Modal do menu, que fica
 * montado com `visible` ligado e desligado.
 */
export function useDepoisDeSair() {
  const pendente = useRef<(() => void) | null>(null);
  return {
    depoisDeSair: (acao: () => void) => {
      if (Platform.OS === 'ios') pendente.current = acao;
      else acao();
    },
    aoSair: () => {
      const acao = pendente.current;
      pendente.current = null;
      acao?.();
    },
  };
}
