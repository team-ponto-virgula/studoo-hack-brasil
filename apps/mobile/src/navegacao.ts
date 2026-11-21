import { createContext } from 'react';

export const NavegacaoContexto = createContext<{
  atual: 'planos' | 'objetivo' | 'plano' | 'perfil' | 'explorar';
  ocupado: boolean;
  planos: () => void;
  criar: () => void;
  /** Com a comunidade (spec 10): o item "Explorar", antes de "Perfil", como na barra de baixo da web (quatro itens). */
  explorar?: () => void;
  /** Com o compartilhar ligado (spec 09): o último item, "Perfil", como na barra de baixo da web. */
  perfil?: () => void;
} | null>(null);
