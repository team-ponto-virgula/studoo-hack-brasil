import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { mensagens } from '../mensagens/pt-BR';
import './globals.css';

export const metadata: Metadata = {
  title: mensagens.nome,
  description: mensagens.descricao,
  robots: { index: false, follow: false },
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
  return <html lang="pt-BR"><body>{children}</body></html>;
}
