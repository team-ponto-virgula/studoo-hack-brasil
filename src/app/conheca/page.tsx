import type { Metadata } from 'next';
import { PaginaDeApresentacao } from './pagina';
import { metadadosDaApresentacao } from './metadados';

/** Sempre dinâmica: o aparelho, os links de instalação (variáveis do servidor) e a origem do QR são lidos a cada pedido. */
export const dynamic = 'force-dynamic';

/** A imagem de compartilhar vem da convenção `opengraph-image.tsx` desta pasta. */
export function generateMetadata(): Metadata {
  return metadadosDaApresentacao();
}

export default function Conheca() {
  return <PaginaDeApresentacao />;
}
