import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { mensagens } from '../mensagens/pt-BR';
import './globals.css';
import { AmbienteSom } from './ambiente-som';
import { AmbienteMovimento } from '../ui/movimento';

export const metadata: Metadata = {
  title: mensagens.nome,
  description: mensagens.descricao,
  robots: { index: false, follow: false },
  // iPhone com o Studoo na tela de início: abre como app, com o nome curto e a barra de status clara (o conteúdo não
  // passa por baixo dela); as áreas seguras laterais e de baixo ficam no CSS.
  appleWebApp: { capable: true, title: 'Studoo', statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: '/marca/icone.svg',
    apple: '/marca/icone-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  viewportFit: 'cover',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/marca/nunito-wght.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/marca/quicksand-wght.woff2" />
      </head>
      <body><AmbienteMovimento /><AmbienteSom />{children}</body>
    </html>
  );
}
