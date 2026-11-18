import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { TrilhaCompartilhada } from '@studoo/contratos';
import { FalhaApi } from '@/servidor/acesso/http';
import { compartilharAtivo, limitarPublico, trilhaCompartilhada } from '@/servidor/compartilhar/servico';
import { mensagens } from '../../../mensagens/pt-BR';
import { Stu } from '../../../ui';
import { AcoesDaPaginaPublica, PreviaTrilha } from '../../compartilhar';
import { PaginaPublica, baseDoSite, redeDaPagina, usuarioDaPagina } from '../../publico';

export const dynamic = 'force-dynamic';
const m = mensagens.compartilhar;

type Resultado =
  | { estado: 'ok'; trilha: TrilhaCompartilhada; logado: boolean }
  | { estado: 'inativo' | 'limite'; logado: boolean };

/**
 * A prévia do link, lida direto do serviço (sem chamar a API) e uma vez por abertura: a página e os metadados usam o
 * mesmo resultado (`cache` do React vale para o pedido inteiro), então o limite das rotas públicas conta uma vez só.
 */
const carregar = cache(async (codigo: string): Promise<Resultado | null> => {
  if (!compartilharAtivo()) return null;
  const usuarioId = await usuarioDaPagina();
  try {
    await limitarPublico(await redeDaPagina());
  } catch {
    return { estado: 'limite', logado: Boolean(usuarioId) };
  }
  try {
    return { estado: 'ok', trilha: await trilhaCompartilhada(codigo, usuarioId), logado: Boolean(usuarioId) };
  } catch (erro) {
    if (erro instanceof FalhaApi && erro.codigo === 'link_inativo') return { estado: 'inativo', logado: Boolean(usuarioId) };
    throw erro;
  }
});

type Props = { params: Promise<{ codigo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resultado = await carregar((await params).codigo);
  const base: Metadata = { robots: { index: false, follow: false }, metadataBase: baseDoSite() };
  if (resultado?.estado !== 'ok') return { ...base, title: `${m.inativo} · Studoo` };
  const { trilha } = resultado;
  const descricao = m.publicoDescricao(trilha.totalLicoes, trilha.dono.nome);
  return {
    ...base,
    title: `${trilha.titulo} · Studoo`,
    description: descricao,
    openGraph: { type: 'website', title: trilha.titulo, description: descricao, siteName: 'Studoo', locale: 'pt_BR' },
    twitter: { card: 'summary_large_image', title: trilha.titulo, description: descricao },
  };
}

export default async function PaginaDoLink({ params }: Props) {
  const resultado = await carregar((await params).codigo);
  // Sem a flag e link encerrado ou inexistente: 404 (a tela do link encerrado está em not-found.tsx).
  if (!resultado || resultado.estado === 'inativo') notFound();
  if (resultado.estado !== 'ok') {
    return (
      <PaginaPublica>
        <section className="pagina-publica__vazio">
          <Stu />
          <h1>{mensagens.erros.limite_compartilhar}</h1>
          <a className="botao botao--primario" href={resultado.logado ? '/' : '/login'}>{m.criarMinha}</a>
        </section>
      </PaginaPublica>
    );
  }
  return (
    <PaginaPublica>
      <PreviaTrilha trilha={resultado.trilha} calor acoes={<AcoesDaPaginaPublica trilha={resultado.trilha} logado={resultado.logado} />} />
    </PaginaPublica>
  );
}

