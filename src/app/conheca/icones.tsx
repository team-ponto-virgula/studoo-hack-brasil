import type { ReactNode } from 'react';

/*
 * Ícones da página, em traço próprio do Studoo (2 px, pontas e quinas redondas), desenhados aqui para a página não carregar o
 * conjunto de ícones do app. Sempre decorativos: o texto ao lado diz tudo.
 */
function Tracado({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className ?? 'cn-icone'} viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const IconeBaixar = () => <Tracado><path d="M12 4v10.5M12 14.5l-4-4M12 14.5l4-4" /><path d="M5 19.5h14" /></Tracado>;
export const IconeCelular = () => <Tracado><rect x="7" y="2.5" width="10" height="19" rx="2.6" /><path d="M10.5 18.5h3" /></Tracado>;
export const IconeVisto = () => <Tracado><path d="M5 12.5l4.5 4.5L19 7.5" /></Tracado>;
export const IconeCompartilharIos = () => (
  <Tracado className="cn-icone cn-icone--passo">
    <path d="M12 14.5V4M12 4L8.5 7.5M12 4l3.5 3.5" /><path d="M8 10H7a2 2 0 0 0-2 2v6.5A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-1" />
  </Tracado>
);
export const IconeAdicionarIos = () => (
  <Tracado className="cn-icone cn-icone--passo"><rect x="4" y="4" width="16" height="16" rx="4.2" /><path d="M12 8.5v7M8.5 12h7" /></Tracado>
);
export const IconeConfirmarIos = () => (
  <Tracado className="cn-icone cn-icone--passo"><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.5 2.5 4.7-5" /></Tracado>
);
export const IconeSeta = () => <Tracado><path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5" /></Tracado>;
