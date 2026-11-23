import type { Metadata } from 'next';
import { PaginaDeApresentacao } from './pagina';
import { textos } from './textos';

/** Sempre dinâmica: o aparelho, os links de instalação (variáveis do servidor) e a origem do QR são lidos a cada pedido. */
export const dynamic = 'force-dynamic';

/** O `robots` (noindex) fica o do site, no layout raiz; aqui só o que é da página. */
export const metadata: Metadata = {
  title: textos.pagina.titulo,
  description: textos.pagina.descricao,
  openGraph: { title: textos.pagina.titulo, description: textos.pagina.descricao, type: 'website', locale: 'pt_BR', siteName: 'Studoo' },
  twitter: { card: 'summary_large_image', title: textos.pagina.titulo, description: textos.pagina.descricao },
};

export default function Conheca() {
  return <PaginaDeApresentacao />;
}
