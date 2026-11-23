import type { Metadata } from 'next';
import { origemStudoo } from '@/servidor/acesso/origem';
import { textos } from './textos';

/** A origem pública configurada (https, ou http em localhost), como base dos endereços absolutos do Open Graph. */
function baseDoSite(): URL | undefined {
  const origem = origemStudoo();
  return origem ? new URL(origem) : undefined;
}

/** Onde a imagem de compartilhar mora (a convenção `opengraph-image.tsx` de /conheca). */
export const IMAGEM_DE_COMPARTILHAR = '/conheca/opengraph-image';

/**
 * Os metadados da página de apresentação (spec 18, seção 3). O `robots` (noindex) fica o do site, no layout raiz. O endereço da imagem precisa sair completo: a base é a origem
 * pública configurada (`STUDOO_ORIGEM`, a mesma que o login já exige; sem ela o Next usaria o endereço local). Em /conheca a imagem vem da convenção `opengraph-image.tsx` (com o
 * código de conteúdo no endereço); na raiz "/", que serve a mesma página a quem não entrou, a convenção não vale (a imagem mora em /conheca), então ela é dita aqui (`imagem: true`).
 */
export function metadadosDaApresentacao({ imagem = false }: { imagem?: boolean } = {}): Metadata {
  const base = baseDoSite();
  const imagens = imagem ? [{ url: IMAGEM_DE_COMPARTILHAR, width: 1200, height: 630, alt: 'Studoo: aprenda qualquer coisa, uma lição por vez' }] : undefined;
  return {
    ...(base ? { metadataBase: base } : {}),
    title: textos.pagina.titulo,
    description: textos.pagina.descricao,
    openGraph: { title: textos.pagina.titulo, description: textos.pagina.descricao, type: 'website', locale: 'pt_BR', siteName: 'Studoo', ...(imagens ? { images: imagens } : {}) },
    twitter: { card: 'summary_large_image', title: textos.pagina.titulo, description: textos.pagina.descricao, ...(imagens ? { images: imagens } : {}) },
  };
}
