import { createContext } from 'react';

export const NavegacaoContexto = createContext<{
  atual: 'planos' | 'objetivo' | 'plano';
  ocupado: boolean;
  planos: () => void;
  criar: () => void;
} | null>(null);
