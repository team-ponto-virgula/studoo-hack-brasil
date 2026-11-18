import type { ReactNode } from 'react';

/**
 * Fora do iPhone não há gesto de borda: o Android volta pelo botão do sistema (`BackHandler`, em `voltar.ts`) e a prévia web
 * pelo navegador. A versão do iPhone fica em `borda-voltar.ios.tsx`, e o Metro só a põe no pacote de iOS.
 */
export function BordaDeVoltar({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
