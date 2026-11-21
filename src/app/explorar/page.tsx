import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PaginaExplorar } from '@studoo/contratos';
import { comunidadeAtiva, limitarPublico } from '@/servidor/compartilhar/servico';
import { explorar } from '@/servidor/compartilhar/comunidade';
import { mensagens } from '../../mensagens/pt-BR';
import { Stu } from '../../ui';
import { ExplorarPublico } from '../comunidade';
import { ExplorarComSessao } from '../estudo';
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
 * Com sessão, o Explorar abre na navegação principal. Sem sessão, a página pública oferece estudo e denúncia.
 */
export default async function PaginaExplorarPublica() {
  if (!comunidadeAtiva()) notFound();
  if (await usuarioDaPagina()) return <ExplorarComSessao />;
  let inicial: PaginaExplorar | null = null;
  try {
    await limitarPublico(await redeDaPagina());
    inicial = await explorar(null, {});
  } catch {
    return (
      <PaginaPublica>
        <section className="pagina-publica__vazio">
          <Stu expressao="stu-encorajador" tamanho={96} animado="uma-vez" />
          <h1>{mensagens.erros.limite_compartilhar}</h1>
        </section>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica>
      <ExplorarPublico inicial={inicial} logado={false} />
    </PaginaPublica>
  );
}
