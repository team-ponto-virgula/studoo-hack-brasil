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

/* Os ícones dos marcos da trilha da página (um por parada), no mesmo traço. */
export const IconeCaderno = () => <Tracado><path d="M6.5 3.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-10z" /><path d="M6.5 3.5v17M4 7.5h2.5M4 12h2.5M4 16.5h2.5M10.5 8.5h4.5" /></Tracado>;
export const IconePonte = () => <Tracado><path d="M3 9.5c3 3.4 6 5 9 5s6-1.6 9-5" /><path d="M3 9.5v9M21 9.5v9M7.5 13v5.5M12 14.5v4M16.5 13v5.5M3 18.5h18" /></Tracado>;
export const IconeFala = () => <Tracado><path d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4.5 3.5V16.5H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" /><path d="M8 10h8M8 13h5" /></Tracado>;
export const IconeBussola = () => <Tracado><circle cx="12" cy="12" r="8.5" /><path d="M15.2 8.8l-1.7 4.7-4.7 1.7 1.7-4.7z" /></Tracado>;
export const IconeTrofeu = () => <Tracado><path d="M8 4.5h8v4.5a4 4 0 0 1-8 0z" /><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6h2.5a2.5 2.5 0 0 1-2.6 3.4M12 13v3.5M8.5 19.5h7M10 16.5h4v3h-4z" /></Tracado>;
export const IconeCamera = () => <Tracado><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.2" r="3.2" /></Tracado>;
export const IconeFolha = () => <Tracado><path d="M7 3.5h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" /><path d="M14 3.5v4h4M8.5 12.5h7M8.5 16h5" /></Tracado>;
export const IconeLampada = () => <Tracado><path d="M9 17.5h6M10 20.5h4" /><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3.5z" /></Tracado>;
export const IconeAbaixo = () => <Tracado><path d="M12 5v14M6.5 13.5L12 19l5.5-5.5" /></Tracado>;
