import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { mensagens } from '../mensagens/pt-BR';
import './globals.css';
import { SegurancaComunidade } from './seguranca-comunidade';
import { AmbienteSom } from './ambiente-som';
import { AmbienteAceiteIa } from './aceite-ia';
import { AmbienteMovimento } from '../ui/movimento';
import { Abertura } from '../ui/abertura';

// Código fixo, sem dados de rota interpolados. A memória desta aba não contém dados de sessão ou autenticação.
const prepararAbertura = "(()=>{let dispensada=Boolean(location.hash);try{dispensada=dispensada||sessionStorage.getItem('studoo.abertura.v1')==='1';sessionStorage.setItem('studoo.abertura.v1','1')}catch{}if(dispensada)document.documentElement.dataset.aberturaDispensada='true'})()";

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

export default async function Layout({ children }: { children: ReactNode }) {
  const cabecalhos = await headers();
  const permitidaInicial = cabecalhos.get('x-studoo-abertura') === '1';
  const nonce = cabecalhos.get('x-studoo-nonce') ?? undefined;
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: prepararAbertura }} />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/marca/nunito-wght.woff2" />
        <link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href="/marca/quicksand-wght.woff2" />
      </head>
      <body><Abertura permitidaInicial={permitidaInicial}><AmbienteMovimento /><AmbienteSom /><SegurancaComunidade>{children}</SegurancaComunidade><AmbienteAceiteIa /></Abertura></body>
    </html>
  );
}
