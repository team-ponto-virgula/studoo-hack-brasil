import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PaginaExplorar } from '@studoo/contratos';
import { comunidadeAtiva, limitarPublico } from '@/servidor/compartilhar/servico';
import { explorar } from '@/servidor/compartilhar/comunidade';
import { mensagens } from '../../mensagens/pt-BR';
import { Stu } from '../../ui';
import { ExplorarPublico } from '../comunidade';
import { PaginaPublica, baseDoSite, redeDaPagina, usuarioDaPagina } from '../publico';

export const dynamic = 'force-dynamic';
const c = mensagens.comunidade;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${c.titulo} · Studoo`,
    description: c.subtitulo,
    robots: { index: false, follow: false },
    metadataBase: baseDoSite(),
    openGraph: { type: 'website', title: `${c.titulo} · Studoo`, description: c.subtitulo, siteName: 'Studoo', locale: 'pt_BR', images: [{ url: '/marca/icone-512.png', width: 512, height: 512, alt: 'Studoo' }] },
  };
}

/**
 * Explorar público (/explorar): ver não pede conta; agir (estudar, valeu, denunciar) leva ao login e volta. A primeira
 * página vem do servidor (pelo limitador das páginas públicas); filtro e "Ver mais" vão pela API.
 */
export default async function PaginaExplorarPublica() {
  if (!comunidadeAtiva()) notFound();
  const usuarioId = await usuarioDaPagina();
  let inicial: PaginaExplorar | null = null;
  try {
    await limitarPublico(await redeDaPagina());
    inicial = await explorar(usuarioId, {});
  } catch {
    return (
      <PaginaPublica>
        <section className="pagina-publica__vazio">
          <Stu />
          <h1>{mensagens.erros.limite_compartilhar}</h1>
        </section>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica>
      <ExplorarPublico inicial={inicial} logado={Boolean(usuarioId)} />
    </PaginaPublica>
  );
}
