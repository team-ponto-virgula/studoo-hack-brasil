import { createContext } from 'react';

export const NavegacaoContexto = createContext<{
  atual: 'planos' | 'objetivo' | 'plano' | 'perfil';
  ocupado: boolean;
  planos: () => void;
  criar: () => void;
  /** Com o compartilhar ligado (spec 09): o terceiro item, "Perfil", como na barra de baixo da web. */
  perfil?: () => void;
} | null>(null);
