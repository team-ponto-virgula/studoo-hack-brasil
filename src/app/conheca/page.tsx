import type { Metadata } from 'next';
import { origemStudoo } from '@/servidor/acesso/origem';
import { PaginaDeApresentacao } from './pagina';
import { textos } from './textos';

/** Sempre dinâmica: o aparelho, os links de instalação (variáveis do servidor) e a origem do QR são lidos a cada pedido. */
export const dynamic = 'force-dynamic';

/**
 * O `robots` (noindex) fica o do site, no layout raiz; aqui só o que é da página. A imagem de compartilhar vem da convenção `opengraph-image.tsx`, e o
 * endereço dela precisa sair completo: a base é a origem pública configurada (`STUDOO_ORIGEM`, a mesma que o login já exige; sem ela o Next usaria o endereço local).
 */
export function generateMetadata(): Metadata {
  const base = baseDoSite();
  return {
    ...(base ? { metadataBase: base } : {}),
    title: textos.pagina.titulo,
    description: textos.pagina.descricao,
    openGraph: { title: textos.pagina.titulo, description: textos.pagina.descricao, type: 'website', locale: 'pt_BR', siteName: 'Studoo' },
    twitter: { card: 'summary_large_image', title: textos.pagina.titulo, description: textos.pagina.descricao },
  };
}

/** A origem pública configurada (https, ou http em localhost), como base dos endereços absolutos do Open Graph. */
function baseDoSite(): URL | undefined {
  const origem = origemStudoo();
  return origem ? new URL(origem) : undefined;
}

export default function Conheca() {
  return <PaginaDeApresentacao />;
}
